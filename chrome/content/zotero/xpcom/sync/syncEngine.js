/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2014 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

if (!Zotero.Sync.Data) {
	Zotero.Sync.Data = {};
}

// TODO: move?
Zotero.Sync.Data.conflictDelayIntervals = [10000, 20000, 40000, 60000, 120000, 240000, 300000];
Zotero.Sync.Data.failureDelayIntervals = [2500, 5000, 10000, 20000, 40000, 60000, 120000, 240000, 300000];

/**
 * An Engine manages sync processes for a given library
 *
 * @param {Object} options
 * @param {Zotero.Sync.APIClient} options.apiClient
 * @param {Integer} options.libraryID
 */
Zotero.Sync.Data.Engine = function (options) {
	if (options.apiClient == undefined) {
		throw new Error("options.apiClient not set");
	}
	if (options.libraryID == undefined) {
		throw new Error("options.libraryID not set");
	}
	
	this.apiClient = options.apiClient;
	this.libraryID = options.libraryID;
	this.libraryName = Zotero.Libraries.getName(options.libraryID);
	this.libraryType = Zotero.Libraries.getType(options.libraryID);
	switch (this.libraryType) {
	case 'user':
	case 'publications':
		this.libraryTypeID = Zotero.Users.getCurrentUserID();
		break;
	
	case 'group':
		this.libraryTypeID = Zotero.Groups.getGroupIDFromLibraryID(options.libraryID);
		break;
	}
	this.setStatus = options.setStatus || function () {};
	this.onError = options.onError || function (e) {};
	this.stopOnError = options.stopOnError;
	this.requests = [];
	this.uploadBatchSize = 25;
	
	this.failed = false;
	
	this.options = {
		setStatus: this.setStatus,
		stopOnError: this.stopOnError,
		onError: this.onError
	}
	
	this.syncCachePromise = Zotero.Promise.resolve().bind(this);
};

Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_SUCCESS = 1;
Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_NOTHING_TO_UPLOAD = 2;
Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_LIBRARY_CONFLICT = 3;
Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_OBJECT_CONFLICT = 4;

Zotero.Sync.Data.Engine.prototype.start = Zotero.Promise.coroutine(function* () {
	Zotero.debug("Starting data sync for " + this.libraryName);
	
	// TODO: Handle new/changed user when setting key
	if (this.libraryType == 'user' && !this.libraryTypeID) {
		let info = yield this.apiClient.getKeyInfo();
		Zotero.debug("Got userID " + info.userID + " for API key");
		this.libraryTypeID = info.userID;
	}
	
	// Check if we've synced this library with the current architecture yet
	var libraryVersion = Zotero.Libraries.getVersion(this.libraryID);
	if (!libraryVersion || libraryVersion == -1) {
		let versionResults = yield this._upgradeCheck();
		if (versionResults) {
			libraryVersion = Zotero.Libraries.getVersion(this.libraryID)
		}
		
		// Perform a full sync if necessary, passing the getVersions() results if available.
		//
		// The full-sync flag (libraryID == -1) is set at the end of a successful upgrade, so this
		// won't run for installations that have just never synced before (which also lack library
		// versions). We can't rely on last classic sync time because it's cleared after the last
		// library is upgraded.
		//
		// Version results won't be available if an upgrade happened on a previous run but the
		// full sync failed.
		if (libraryVersion == -1) {
			yield this._fullSync(versionResults);
		}
	}
	
	var autoReset = false;
	
	sync:
	while (true) {
		let uploadResult = yield this._startUpload();
		Zotero.debug("UPLOAD RESULT WITH " + uploadResult);
		
		switch (uploadResult) {
		// If upload succeeded, we're done
		case this.UPLOAD_RESULT_SUCCESS:
			break sync;
		
		case this.UPLOAD_RESULT_OBJECT_CONFLICT:
			if (Zotero.Prefs.get('sync.debugNoAutoResetClient')) {
				throw new Error("Skipping automatic client reset due to debug pref");
			}
			if (autoReset) {
				throw new Error(this.libraryName + " has already been auto-reset");
			}
			Zotero.logError("Object in " + this.libraryName + " is out of date -- resetting library");
			autoReset = true;
			yield this._fullSync();
			break;
		
		// If conflict, start at beginning with downloads
		case this.UPLOAD_RESULT_NOTHING_TO_UPLOAD:
			let localChanges = yield this._startDownload();
			if (!localChanges) {
				break sync;
			}
			break;
			
		case this.UPLOAD_RESULT_LIBRARY_CONFLICT:
			yield this._startDownload();
			
			if (!gen) {
				var gen = Zotero.Utilities.Internal.delayGenerator(
					Zotero.Sync.Data.delayIntervals, 60 * 1000
				);
			}
			// After the first upload version conflict (which is expected after remote changes),
			// start delaying to give other sync sessions time to complete
			else {
				let keepGoing = yield gen.next();
				if (!keepGoing) {
					throw new Error("Could not sync " + this.libraryName + " -- too many retries");
				}
			}
		}
	}
	
	// TEMP: make more reliable
	while (this.syncCachePromise.isPending()) {
		Zotero.debug("Waiting for sync cache to be processed");
		yield this.syncCachePromise;
		yield Zotero.Promise.delay(50);
	}
	
	yield Zotero.Libraries.updateLastSyncTime(this.libraryID);
	
	Zotero.debug("Done syncing " + this.libraryName);
});


/**
 * Stop all active requests
 *
 * @return {Promise<PromiseInspection[]>} Promise from Zotero.Promise.settle()
 */
Zotero.Sync.Data.Engine.prototype.stop = function () {
	var funcs;
	var request;
	while (request = this.requests.shift()) {
		funcs.push(() => request.stop());
	}
	return Zotero.Promise.settle(funcs);
}


/**
 * Download updated objects from API and save to local cache
 *
 * @return {Boolean} True if an upload is needed, false otherwise
 */
Zotero.Sync.Data.Engine.prototype._startDownload = Zotero.Promise.coroutine(function* () {
	var localChanges = false;
	var libraryVersion = Zotero.Libraries.getVersion(this.libraryID);
	var lastLibraryVersion;
	
	var gen = Zotero.Utilities.Internal.delayGenerator(
		Zotero.Sync.Data.delayIntervals, 60 * 60 * 1000
	);
	
	loop:
	while (true) {
		// Get synced settings first, since they affect how other data is displayed
		lastLibraryVersion = yield this._downloadSettings(libraryVersion);
		if (lastLibraryVersion === false) {
			break;
		}
		
		//
		// Get other object types
		//
		for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(this.libraryID)) {
			this._failedCheck();
			this._processCache(objectType);
			
			let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
			
			// Get versions of all objects updated remotely since the current local library version
			Zotero.debug("Checking for updated " + objectTypePlural + " in " + this.libraryName);
			let results = yield this.apiClient.getVersions(
				this.libraryType,
				this.libraryTypeID,
				objectType,
				libraryVersion ? { since: libraryVersion } : undefined
			);
			
			Zotero.debug("VERSIONS:");
			Zotero.debug(JSON.stringify(results));
			
			if (lastLibraryVersion) {
				// If something else modified the remote library while we were getting updates,
				// wait for increasing amounts of time before trying again, and then start from
				// the beginning
				if (lastLibraryVersion != results.libraryVersion) {
					Zotero.logError("Library version changed since last download -- restarting sync");
					let keepGoing = yield gen.next();
					if (!keepGoing) {
						throw new Error("Could not update " + this.libraryName + " -- library in use");
					}
					continue loop;
				}
			}
			else {
				lastLibraryVersion = results.libraryVersion;
			}
			
			var numObjects = Object.keys(results.versions).length;
			if (!numObjects) {
				Zotero.debug("No " + objectTypePlural + " modified remotely since last check");
				continue;
			}
			Zotero.debug(numObjects + " " + (numObjects == 1 ? objectType : objectTypePlural)
				+ " modified since last check");
			
			let keys = [];
			for (let key in results.versions) {
				// Skip objects that are already up-to-date in the sync cache. Generally all returned
				// objects should have newer version numbers, but there are some situations, such as
				// full syncs or interrupted syncs, where we may get versions for objects that are
				// already up-to-date locally.
				let version = yield Zotero.Sync.Data.Local.getLatestCacheObjectVersion(
					objectType, this.libraryID, key
				);
				if (version == results.versions[key]) {
					Zotero.debug("Skipping up-to-date " + objectType + " " + this.libraryID + "/" + key);
					continue;
				}
				keys.push(key);
			}
			
			if (keys.length) {
				yield this._downloadObjects(objectType, keys);
			}
		}
		
		// Wait for sync process to clear
		// TEMP: make more reliable
		while (this.syncCachePromise.isPending()) {
			Zotero.debug("Waiting for sync cache to be processed");
			yield this.syncCachePromise;
			yield Zotero.Promise.delay(50);
		}
		
		//
		// Get deleted objects
		//
		results = yield this.apiClient.getDeleted(
			this.libraryType,
			this.libraryTypeID,
			libraryVersion
		);
		if (lastLibraryVersion) {
			// If something else modified the remote library while we were getting updates,
			// wait for increasing amounts of time before trying again, and then start from
			// the beginning
			if (lastLibraryVersion != results.libraryVersion) {
				Zotero.logError("Library version changed since last download -- restarting sync");
				let keepGoing = yield gen.next();
				if (!keepGoing) {
					throw new Error("Could not update " + this.libraryName + " -- library in use");
				}
				continue loop;
			}
		}
		else {
			lastLibraryVersion = results.libraryVersion;
		}
		
		var numObjects = Object.keys(results.deleted).reduce((n, k) => n + results.deleted[k].length, 0);
		if (numObjects) {
			Zotero.debug(numObjects + " objects deleted remotely since last check");
			
			// Process deletions
			for (let objectTypePlural in results.deleted) {
				let objectType = Zotero.DataObjectUtilities.getObjectTypeSingular(objectTypePlural);
				let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
				let toDelete = [];
				let conflicts = [];
				for (let key of results.deleted[objectTypePlural]) {
					// TODO: Remove from request?
					if (objectType == 'tag') {
						continue;
					}
					
					if (objectType == 'setting') {
						let meta = yield Zotero.SyncedSettings.getMetadata(this.libraryID, key);
						if (!meta) {
							continue;
						}
						if (meta.synced) {
							yield Zotero.SyncedSettings.clear(this.libraryID, key, {
								skipDeleteLog: true
							});
						}
						
						// Ignore setting if changed locally
						continue;
					}
					
					let obj = yield objectsClass.getByLibraryAndKeyAsync(
						this.libraryID, key, { noCache: true }
					);
					if (!obj) {
						continue;
					}
					if (obj.synced) {
						toDelete.push(obj);
					}
					// Conflict resolution
					else if (objectType == 'item') {
						conflicts.push({
							left: yield obj.toJSON(),
							right: {
								deleted: true
							}
						});
					}
					
					// Ignore deletion if collection/search changed locally
				}
				
				if (conflicts.length) {
					conflicts.sort(function (a, b) {
						var d1 = a.left.dateModified;
						var d2 = b.left.dateModified;
						if (d1 > d2) {
							return 1
						}
						if (d1 < d2) {
							return -1;
						}
						return 0;
					});
					var mergeData = Zotero.Sync.Data.Local.resolveConflicts(conflicts);
					if (mergeData) {
						let concurrentObjects = 50;
						yield Zotero.Utilities.Internal.forEachChunkAsync(
							mergeData,
							concurrentObjects,
							function (chunk) {
								return Zotero.DB.executeTransaction(function* () {
									for (let json of chunk) {
										if (!json.deleted) continue;
										let obj = yield objectsClass.getByLibraryAndKeyAsync(
											this.libraryID, json.key, { noCache: true }
										);
										if (!obj) {
											Zotero.logError("Remotely deleted " + objectType
												+ " didn't exist after conflict resolution");
											continue;
										}
										yield obj.erase();
									}
								}.bind(this));
							}.bind(this)
						);
					}
				}
				
				if (toDelete.length) {
					yield Zotero.DB.executeTransaction(function* () {
						for (let obj of toDelete) {
							yield obj.erase({
								skipDeleteLog: true
							});
						}
					});
				}
			}
		}
		else {
			Zotero.debug("No objects deleted remotely since last check");
		}
		
		break;
	}
	
	if (lastLibraryVersion) {
		yield Zotero.Libraries.setVersion(this.libraryID, lastLibraryVersion);
	}
	
	return localChanges;
});


/**
 * @param {Integer} libraryVersion - Last library version
 * @return {Integer|Boolean} - Library version returned from server, or false if no changes since
 *                             specified version
 */
Zotero.Sync.Data.Engine.prototype._downloadSettings = Zotero.Promise.coroutine(function* (libraryVersion) {
	let results = yield this.apiClient.getSettings(
		this.libraryType,
		this.libraryTypeID,
		libraryVersion
	);
	// If library version hasn't changed remotely, the local library is up-to-date and we
	// can skip all remaining downloads
	if (results === false) {
		Zotero.debug("Library " + this.libraryID + " hasn't been modified "
			+ "-- skipping further object downloads");
		return false;
	}
	var numObjects = Object.keys(results.settings).length;
	if (numObjects) {
		Zotero.debug(numObjects + " settings modified since last check");
		// Settings we process immediately rather than caching
		for (let setting in results.settings) {
			yield Zotero.SyncedSettings.set(
				this.libraryID,
				setting,
				results.settings[setting].value,
				results.settings[setting].version,
				true
			);
		}
	}
	else {
		Zotero.debug("No settings modified remotely since last check");
	}
	return results.libraryVersion;
})


Zotero.Sync.Data.Engine.prototype._downloadObjects = Zotero.Promise.coroutine(function* (objectType, keys) {
	var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
	var failureDelayGenerator = null;
	
	var lastLength = keys.length;
	
	while (true) {
		this._failedCheck();
		
		let lastError = false;
		
		// TODO: localize
		this.setStatus(
			"Downloading "
			+ (keys.length == 1
				? "1 " + objectType
				: Zotero.Utilities.numberFormat(keys.length, 0) + " " + objectTypePlural)
			+ " in " + this.libraryName
		);
		
		// Process batches as soon as they're available
		yield Zotero.Promise.map(
			this.apiClient.downloadObjects(
				this.libraryType,
				this.libraryTypeID,
				objectType,
				keys
			),
			function (batch) {
				this._failedCheck();
				
				Zotero.debug("MAPPING");
				if (!Array.isArray(batch)) {
					Zotero.debug("WE GOT AN ERROR");
					Components.utils.reportError(batch);
					Zotero.debug(batch, 1);
					this.failed = batch;
					lastError = batch;
					return;
				}
				
				// Save objects to sync cache
				return Zotero.Sync.Data.Local.saveCacheObjects(
					objectType, this.libraryID, batch
				)
				.then(function () {
					let processedKeys = batch.map(item => item.key);
					keys = Zotero.Utilities.arrayDiff(keys, processedKeys);
					
					// Create/update objects as they come in
					this._processCache(objectType);
				}.bind(this));
			}.bind(this)
		);
		
		if (!keys.length) {
			Zotero.debug("All " + objectTypePlural + " for library "
				+ this.libraryID + " saved to sync cache");
			break;
		}
		
		// If we're not making process, delay for increasing amounts of time
		// and then keep going
		if (keys.length == lastLength) {
			if (!failureDelayGenerator) {
				// Keep trying for up to an hour
				failureDelayGenerator = Zotero.Utilities.Internal.delayGenerator(
					Zotero.Sync.Data.failureDelayIntervals, 60 * 60 * 1000
				);
			}
			let keepGoing = yield failureDelayGenerator.next();
			if (!keepGoing) {
				Zotero.logError("Failed too many times");
				throw lastError;
			}
		}
		else {
			failureDelayGenerator = null;
		}
		
		lastLength = keys.length;
	}
});


/**
 * Get unsynced objects, build upload JSON, and start API requests
 *
 * @throws {Zotero.HTTP.UnexpectedStatusException}
 * @return {Promise<Integer>} - An upload result code (this.UPLOAD_RESULT_*)
 */
Zotero.Sync.Data.Engine.prototype._startUpload = Zotero.Promise.coroutine(function* () {
	var libraryVersion = Zotero.Libraries.getVersion(this.libraryID);
	
	var uploadNeeded = false;
	var objectIDs = {};
	
	// Get unsynced local objects for each object type
	for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(this.libraryID)) {
		let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		
		let ids = yield Zotero.Sync.Data.Local.getUnsynced(this.libraryID, objectType);
		if (!ids.length) {
			Zotero.debug("No " + objectTypePlural + " to upload in " + this.libraryName);
			continue;
		}
		Zotero.debug(ids.length + " "
			+ (ids.length == 1 ? objectType : objectTypePlural)
			+ " to upload in library " + this.libraryID);
		objectIDs[objectType] = ids;
		uploadNeeded = true;
	}
	
	if (!uploadNeeded) {
		return this.UPLOAD_RESULT_NOTHING_TO_UPLOAD;
	}
	
	Zotero.debug(JSON.stringify(objectIDs));
	
	for (let objectType in objectIDs) {
		let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		
		let queue = [];
		for (let id of objectIDs[objectType]) {
			queue.push({
				id: id,
				json: null,
				tries: 0,
				failed: false
			});
		}
		
		let failureDelayGenerator = null;
		
		while (queue.length) {
			// Get a slice of the queue and generate JSON for objects if necessary
			let batch = [];
			for (let i = 0; i < queue.length && queue.length < this.uploadBatchSize; i++) {
				let o = queue[i];
				// Skip requests that failed with 4xx
				if (o.failed) {
					continue;
				}
				if (!o.json) {
					o.json = yield this._getJSONForObject(objectType, o.id);
				}
				batch.push(o.json);
			}
			
			// No more non-failed requests
			if (!batch.length) {
				break;
			}
			
			// Remove selected and skipped objects from queue
			queue.splice(0, batch.length);
			
			Zotero.debug("UPLOAD BATCH:");
			Zotero.debug(batch);
			
			let numSuccessful = 0;
			try {
				let json = yield this.apiClient.uploadObjects(
					this.libraryType,
					this.libraryTypeID,
					objectType,
					"POST",
					libraryVersion,
					batch
				);
				
				Zotero.debug('======');
				Zotero.debug(json);
				
				libraryVersion = json.libraryVersion;
				
				// Mark successful and unchanged objects as synced with new version,
				// and save uploaded JSON to cache
				let ids = [];
				let toSave = [];
				let toCache = [];
				for (let state of ['successful', 'unchanged']) {
					for (let index in json.results[state]) {
						let current = json.results[state][index];
						// 'successful' includes objects, not keys
						let key = state == 'successful' ? current.key : current;
						
						if (key != batch[index].key) {
							throw new Error("Key mismatch (" + key + " != " + batch[index].key + ")");
						}
						
						let obj = objectsClass.getByLibraryAndKey(this.libraryID, key, { noCache: true })
						ids.push(obj.id);
						
						if (state == 'successful') {
							// Update local object with saved data if necessary
							yield obj.fromJSON(current.data);
							toSave.push(obj);
							toCache.push(current);
						}
						else {
							let j = yield obj.toJSON();
							j.version = json.libraryVersion;
							toCache.push(j);
						}
						
						numSuccessful++;
						// Remove from batch to mark as successful
						delete batch[index];
					}
				}
				yield Zotero.Sync.Data.Local.saveCacheObjects(
					objectType, this.libraryID, toCache
				);
				yield Zotero.DB.executeTransaction(function* () {
					for (let i = 0; i < toSave.length; i++) {
						yield toSave[i].save();
					}
					yield Zotero.Libraries.setVersion(this.libraryID, json.libraryVersion);
					objectsClass.updateVersion(ids, json.libraryVersion);
					objectsClass.updateSynced(ids, true);
				}.bind(this));
				
				// Handle failed objects
				for (let index in json.results.failed) {
					let e = json.results.failed[index];
					Zotero.logError(e.message);
					
					// This shouldn't happen, because the upload request includes a library
					// version and should prevent an outdated upload before the object version is
					// checked. If it does, we need to do a full sync.
					if (e.code == 412) {
						return this.UPLOAD_RESULT_OBJECT_CONFLICT;
					}
					
					if (this.stopOnError) {
						Zotero.debug("WE FAILED!!!");
						throw new Error(e.message);
					}
					if (this.onError) {
						this.onError(e.message);
					}
					batch[index].tries++;
					// Mark 400 errors as permanently failed
					if (e.code >= 400 && e.code < 500) {
						batch[index].failed = true;
					}
					// 500 errors should stay in queue and be retried
				}
				
				// Add failed objects back to end of queue
				Zotero.debug("ADDING BACK FAILED");
				Zotero.debug(batch);
				var numFailed = 0;
				for (let o of batch) {
					if (o !== undefined) {
						queue.push(o);
						// TODO: Clear JSON?
						numFailed++;
					}
				}
				Zotero.debug(queue);
				Zotero.debug("Failed: " + numFailed, 2);
			}
			catch (e) {
				if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
					if (e.status == 412) {
						return this.UPLOAD_RESULT_LIBRARY_CONFLICT;
					}
					
					// On 5xx, delay and retry
					if (e.status >= 500 && e.status <= 600) {
						if (!failureDelayGenerator) {
							// Keep trying for up to an hour
							failureDelayGenerator = Zotero.Utilities.Internal.delayGenerator(
								Zotero.Sync.Data.failureDelayIntervals, 60 * 60 * 1000
							);
						}
						let keepGoing = yield failureDelayGenerator.next();
						if (!keepGoing) {
							Zotero.logError("Failed too many times");
							throw e;
						}
						continue;
					}
				}
				throw e;
			}
			// If we didn't make any progress, bail
			if (!numSuccessful) {
				throw new Error("Made no progress during upload -- stopping");
			}
		}
		Zotero.debug("Done uploading " + objectTypePlural + " in library " + this.libraryID);
	}
	
	return this.UPLOAD_RESULT_SUCCESS;
});


Zotero.Sync.Data.Engine.prototype._getJSONForObject = function (objectType, id) {
	return Zotero.DB.executeTransaction(function* () {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		var obj = yield objectsClass.getAsync(id, { noCache: true });
		var cacheObj = false;
		if (obj.version) {
			cacheObj = yield Zotero.Sync.Data.Local.getCacheObject(
				objectType, obj.libraryID, obj.key, obj.version
			);
		}
		return obj.toJSON({
			// JSON generation mode depends on whether a copy is in the cache
			// and, failing that, whether the object is new
			mode: cacheObj
				? "patch"
				: (obj.version ? "full" : "new"),
			includeKey: true,
			includeVersion: true, // DEBUG: remove?
			includeDate: true,
			patchBase: cacheObj ? cacheObj.data : false
		});
	});
}


/**
 * Upgrade library to current sync architecture
 *
 * This sets the 'synced' and 'version' properties based on classic last-sync times and object
 * modification times. Objects are marked as:
 *
 * - synced=1 if modified locally before the last classic sync time
 * - synced=0 (unchanged) if modified locally since the last classic sync time
 * - version=<remote version> if modified remotely before the last classic sync time
 * - version=0 if modified remotely since the last classic sync time
 *
 * If both are 0, that's a conflict.
 *
 * @return {Object[]} - Objects returned from getVersions(), keyed by objectType, for use
 *                      by _fullSync()
 */
Zotero.Sync.Data.Engine.prototype._upgradeCheck = Zotero.Promise.coroutine(function* () {
	var libraryVersion = Zotero.Libraries.getVersion(this.libraryID);
	if (libraryVersion) return;
	
	var lastLocalSyncTime = yield Zotero.DB.valueQueryAsync(
		"SELECT version FROM version WHERE schema='lastlocalsync'"
	);
	// Never synced with classic architecture, or already upgraded and full sync (which updates
	// library version) didn't finish
	if (!lastLocalSyncTime) return;
	
	Zotero.debug("Upgrading library to current sync architecture");
	
	var lastRemoteSyncTime = yield Zotero.DB.valueQueryAsync(
		"SELECT version FROM version WHERE schema='lastremotesync'"
	);
	// Shouldn't happen
	if (!lastRemoteSyncTime) lastRemoteSyncTime = lastLocalSyncTime;
	
	var objectTypes = Zotero.DataObjectUtilities.getTypesForLibrary(this.libraryID);
	
	// Mark all items modified locally before the last classic sync time as synced
	if (lastLocalSyncTime) {
		lastLocalSyncTime = new Date(lastLocalSyncTime * 1000);
		for (let objectType of objectTypes) {
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
			let ids = yield objectsClass.getOlder(this.libraryID, lastLocalSyncTime);
			yield objectsClass.updateSynced(ids, true);
		}
	}
	
	var versionResults = {};
	var currentVersions = {};
	var gen;
	loop:
	while (true) {
		let lastLibraryVersion = 0;
		for (let objectType of objectTypes) {
			currentVersions[objectType] = {};
			
			let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
			 // TODO: localize
			this.setStatus("Updating " + objectTypePlural + " in " + this.libraryName);
			
			// Get versions from API for all objects
			let allResults = yield this.apiClient.getVersions(
				this.libraryType,
				this.libraryTypeID,
				objectType
			);
			
			// Get versions from API for objects modified remotely since the last classic sync time
			let sinceResults = yield this.apiClient.getVersions(
				this.libraryType,
				this.libraryTypeID,
				objectType,
				{
					sincetime: lastRemoteSyncTime
				}
			);
			
			// If something else modified the remote library while we were getting updates,
			// wait for increasing amounts of time before trying again, and then start from
			// the first object type
			if (allResults.libraryVersion != sinceResults.libraryVersion
					|| (lastLibraryVersion && allResults.libraryVersion != lastLibraryVersion)) {
				if (!gen) {
					gen = Zotero.Utilities.Internal.delayGenerator(
						Zotero.Sync.Data.conflictDelayIntervals, 60 * 60 * 1000
					);
				}
				Zotero.debug("Library version changed since last check ("
					+ allResults.libraryVersion + " != "
					+ sinceResults.libraryVersion + " != "
					+ lastLibraryVersion + ") -- waiting");
				let keepGoing = yield gen.next();
				if (!keepGoing) {
					throw new Error("Could not update " + this.libraryName + " -- library in use");
				}
				continue loop;
			}
			else {
				lastLibraryVersion = allResults.libraryVersion;
			}
			
			versionResults[objectType] = allResults;
			
			// Get versions for remote objects modified remotely before the last classic sync time,
			// which is all the objects not modified since that time
			for (let key in allResults.versions) {
				if (!sinceResults.versions[key]) {
					currentVersions[objectType][key] = allResults.versions[key];
				}
			}
		}
		break;
	}
	
	// Update versions on local objects modified remotely before last classic sync time,
	// to indicate that they don't need to receive remote updates
	yield Zotero.DB.executeTransaction(function* () {
		for (let objectType in currentVersions) {
			let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
			
			// TODO: localize
			this.setStatus("Updating " + objectTypePlural + " in " + this.libraryName);
			
			// Group objects with the same version together and update in batches
			let versionObjects = {};
			for (let key in currentVersions[objectType]) {
				let id = objectsClass.getIDFromLibraryAndKey(this.libraryID, key);
				// If local object doesn't exist, skip
				if (!id) continue;
				let version = currentVersions[objectType][key];
				if (!versionObjects[version]) {
					versionObjects[version] = [];
				}
				versionObjects[version].push(id);
			}
			for (let version in versionObjects) {
				yield objectsClass.updateVersion(versionObjects[version], version);
			}
		}
		
		// Mark library as requiring full sync
		yield Zotero.Libraries.setVersion(this.libraryID, -1);
		
		// If this is the last classic sync library, delete old timestamps
		if (!(yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM libraries WHERE version=0"))) {
			yield Zotero.DB.queryAsync(
				"DELETE FROM version WHERE schema IN ('lastlocalsync', 'lastremotesync')"
			);
		}
	}.bind(this));
	
	Zotero.debug("Done upgrading " + this.libraryName);
	
	return versionResults;
});


/**
 * Perform a full sync
 *
 * Get all object versions from the API and compare to the local database. If any objects are
 * missing or outdated and not up-to-date in the sync cache, download them. If any local objects
 * are marked as synced but aren't available remotely, mark them as unsynced for later uploading.
 *
 * (Technically this isn't a full sync on its own, because objects are only flagged for later
 * upload.)
 *
 * @param {Object[]} [versionResults] - Objects returned from getVersions(), keyed by objectType
 * @return {Promise<Integer>} - Promise for the library version after syncing
 */
Zotero.Sync.Data.Engine.prototype._fullSync = Zotero.Promise.coroutine(function* (versionResults) {
	Zotero.debug("Performing a full sync of " + this.libraryName);
	
	var gen;
	var lastLibraryVersion;
	var remoteDeleted;
	
	loop:
	while (true) {
		// Get synced settings
		lastLibraryVersion = yield this._downloadSettings();
		
		// Get other object types
		for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(this.libraryID)) {
			this._failedCheck();
			
			let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
			let ObjectType = objectType[0].toUpperCase() + objectType.substr(1);
			
			// TODO: localize
			this.setStatus("Updating " + objectTypePlural + " in " + this.libraryName);
			
			// Start processing cached objects while waiting for API
			this._processCache(objectType);
			
			let results = {};
			// Use provided versions
			if (versionResults) {
				results = versionResults[objectType];
			}
			// If not available, get from API
			else {
				results = yield this.apiClient.getVersions(
					this.libraryType,
					this.libraryTypeID,
					objectType
				);
			}
			if (lastLibraryVersion) {
				// If something else modified the remote library while we were getting updates,
				// wait for increasing amounts of time before trying again, and then start from
				// the first object type
				if (lastLibraryVersion != results.libraryVersion) {
					if (!gen) {
						gen = Zotero.Utilities.Internal.delayGenerator(
							Zotero.Sync.Data.conflictDelayIntervals, 60 * 60 * 1000
						);
					}
					let keepGoing = yield gen.next();
					if (!keepGoing) {
						throw new Error("Could not update " + this.libraryName + " -- library in use");
					}
					continue loop;
				}
			}
			else {
				lastLibraryVersion = results.libraryVersion;
			}
			
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
			let toDownload = [];
			let cacheVersions = yield Zotero.Sync.Data.Local.getLatestCacheObjectVersions(
				this.libraryID, objectType
			);
			// Queue objects that are out of date or don't exist locally and aren't up-to-date
			// in the cache
			for (let key in results.versions) {
				let version = results.versions[key];
				let obj = yield objectsClass.getByLibraryAndKeyAsync(this.libraryID, key, {
					noCache: true
				});
				// If object already at latest version, skip
				if (obj && obj.version === version) {
					continue;
				}
				let cacheVersion = cacheVersions[key];
				// If cache already has latest version, skip
				if (cacheVersion == version) {
					continue;
				}
				if (cacheVersion > version) {
					throw new Error("Sync cache had later version than remote for "
						+ objectType + + this.libraryID + "/" + key
						+ "(" + cacheVersion + " > " + version + ")");
				}
				
				if (obj) {
					Zotero.debug(Zotero.Utilities.capitalize(objectType) + " " + obj.libraryKey
						+ " is older than version in sync cache");
				}
				else {
					Zotero.debug(Zotero.Utilities.capitalize(objectType) + " "
						+ this.libraryID + "/" + key + " in sync cache not found locally");
				}
				
				toDownload.push(key);
			}
			
			if (toDownload.length) {
				Zotero.debug("Downloading missing/outdated " + objectTypePlural + " in " + this.libraryName);
				yield this._downloadObjects(objectType, toDownload);
			}
			
			// Mark synced objects that don't exist remotely as unsynced
			let syncedKeys = yield Zotero.Sync.Data.Local.getSynced(this.libraryID, objectType);
			let remoteMissing = Zotero.Utilities.arrayDiff(syncedKeys, Object.keys(results.versions));
			if (remoteMissing.length) {
				Zotero.debug("Checking remotely missing synced " + objectTypePlural);
				Zotero.debug(remoteMissing);
				
				// Check remotely deleted objects
				if (!remoteDeleted) {
					let results = yield this.apiClient.getDeleted(
						this.libraryType, this.libraryTypeID
					);
					remoteDeleted = results.deleted;
				}
				
				let toDelete = [];
				let toUpload = [];
				for (let key of remoteMissing) {
					let id = objectsClass.getIDFromLibraryAndKey(this.libraryID, key);
					if (!id) {
						Zotero.logError(ObjectType + " " + this.libraryID + "/" + key
							+ " not found to mark as unsynced");
						continue;
					}
					if (remoteDeleted[objectTypePlural].indexOf(key) != -1) {
						toDelete.push(id);
						continue;
					}
					toUpload.push(id);
				}
				// Delete local objects that were deleted remotely
				if (toDelete.length) {
					Zotero.debug("Deleting remotely deleted synced " + objectTypePlural);
					yield objectsClass.erase(toDelete, { skipDeleteLog: true });
				}
				// For remotely missing objects that exist locally, reset version, since old
				// version will no longer match remote, and mark for upload
				if (toUpload.length) {
					Zotero.debug("Marking remotely missing synced " + objectTypePlural
						+ " as unsynced");
					yield objectsClass.updateVersion(toUpload, 0);
					yield objectsClass.updateSynced(toUpload, false);
				}
			}
			
			// Process newly cached objects
			this._processCache(objectType);
		}
		break;
	}
	
	yield this.syncCachePromise;
	
	yield Zotero.Libraries.setVersion(this.libraryID, lastLibraryVersion);
	
	Zotero.debug("Done with full sync for " + this.libraryName);
	
	return lastLibraryVersion;
});


/**
 * Chain sync cache processing for a given object type
 *
 * On error, check if errors should be fatal and set the .failed flag
 *
 * @param {String} objectType
 */
Zotero.Sync.Data.Engine.prototype._processCache = function (objectType) {
	var self = this;
	this.syncCachePromise = this.syncCachePromise.then(function () {
		self._failedCheck();
		return Zotero.Sync.Data.Local.processSyncCacheForObjectType(
			self.libraryID, objectType, self.options
		)
		.catch(function (e) {
			Zotero.logError(e);
			if (self.stopOnError) {
				Zotero.debug("WE FAILED!!!");
				self.failed = e;
			}
		});
	})
}


Zotero.Sync.Data.Engine.prototype._failedCheck = function () {
	if (this.stopOnError && this.failed) {
		Zotero.debug("STOPPING ON ERROR 1");
		throw this.failed;
	}
};
