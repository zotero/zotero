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
	this.library = Zotero.Libraries.get(options.libraryID);
	this.libraryTypeID = this.library.libraryTypeID;
	this.requests = [];
	this.uploadBatchSize = 25;
	this.uploadDeletionBatchSize = 50;
	
	this.failed = false;
	this.failedItems = [];
	
	// Options to pass through to processing functions
	this.optionNames = ['setStatus', 'onError', 'stopOnError', 'background', 'firstInSession'];
	this.options = {};
	this.optionNames.forEach(x => {
		// Create dummy functions if not set
		if (x == 'setStatus' || x == 'onError') {
			this[x] = options[x] || function () {};
		}
		else {
			this[x] = options[x];
		}
	});
};

Zotero.Sync.Data.Engine.prototype.DOWNLOAD_RESULT_CONTINUE = 1;
Zotero.Sync.Data.Engine.prototype.DOWNLOAD_RESULT_CHANGES_TO_UPLOAD = 2;
Zotero.Sync.Data.Engine.prototype.DOWNLOAD_RESULT_NO_CHANGES_TO_UPLOAD = 3;
Zotero.Sync.Data.Engine.prototype.DOWNLOAD_RESULT_RESTART = 4;

Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_SUCCESS = 1;
Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_NOTHING_TO_UPLOAD = 2;
Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_LIBRARY_CONFLICT = 3;
Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_OBJECT_CONFLICT = 4;

Zotero.Sync.Data.Engine.prototype.start = Zotero.Promise.coroutine(function* () {
	Zotero.debug("Starting data sync for " + this.library.name);
	
	// TODO: Handle new/changed user when setting key
	if (this.library.libraryType == 'user' && !this.libraryTypeID) {
		let info = yield this.apiClient.getKeyInfo();
		Zotero.debug("Got userID " + info.userID + " for API key");
		this.libraryTypeID = info.userID;
	}
	
	// Check if we've synced this library with the current architecture yet
	var libraryVersion = this.library.libraryVersion;
	if (!libraryVersion || libraryVersion == -1) {
		let versionResults = yield this._upgradeCheck();
		if (versionResults) {
			libraryVersion = this.library.libraryVersion;
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
		let downloadResult;
		Zotero.debug("Upload result is " + uploadResult, 4);
		
		switch (uploadResult) {
		// If upload succeeded, we're done
		case this.UPLOAD_RESULT_SUCCESS:
			break sync;
		
		case this.UPLOAD_RESULT_OBJECT_CONFLICT:
			if (Zotero.Prefs.get('sync.debugNoAutoResetClient')) {
				throw new Error("Skipping automatic client reset due to debug pref");
			}
			if (autoReset) {
				throw new Error(this.library.name + " has already been auto-reset");
			}
			Zotero.logError("Object in " + this.library.name + " is out of date -- resetting library");
			autoReset = true;
			yield this._fullSync();
			break;
		
		case this.UPLOAD_RESULT_NOTHING_TO_UPLOAD:
			downloadResult = yield this._startDownload();
			Zotero.debug("Download result is " + downloadResult, 4);
			if (downloadResult == this.DOWNLOAD_RESULT_CHANGES_TO_UPLOAD) {
				break;
			}
			break sync;
		
		// If conflict, start at beginning with downloads
		case this.UPLOAD_RESULT_LIBRARY_CONFLICT:
			downloadResult = yield this._startDownload();
			Zotero.debug("Download result is " + downloadResult, 4);
			
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
					throw new Error("Could not sync " + this.library.name + " -- too many retries");
				}
			}
		}
	}
	
	yield Zotero.Libraries.updateLastSyncTime(this.libraryID);
	
	Zotero.debug("Done syncing " + this.library.name);
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
 * @return {Promise<Integer>} - A download result code (this.DOWNLOAD_RESULT_*)
 */
Zotero.Sync.Data.Engine.prototype._startDownload = Zotero.Promise.coroutine(function* () {
	var localChanges = false;
	var libraryVersion = this.library.libraryVersion;
	var newLibraryVersion;
	
	this.downloadDelayGenerator = Zotero.Utilities.Internal.delayGenerator(
		Zotero.Sync.Data.delayIntervals, 60 * 60 * 1000
	);
	
	loop:
	while (true) {
		// Get synced settings first, since they affect how other data is displayed
		newLibraryVersion = yield this._downloadSettings(libraryVersion);
		if (newLibraryVersion === false) {
			break;
		}
		
		//
		// Get other object types
		//
		for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(this.libraryID)) {
			this._failedCheck();
			
			// For items, fetch top-level items first
			//
			// The next run below will then see the same items in the non-top versions request,
			// but they'll have been downloaded already and will be skipped.
			if (objectType == 'item') {
				let result = yield this._downloadUpdatedObjects(
					objectType,
					libraryVersion,
					newLibraryVersion,
					{
						top: true
					}
				);
				if (result == this.DOWNLOAD_RESULT_RESTART) {
					continue loop;
				}
			}
			
			let result = yield this._downloadUpdatedObjects(
				objectType,
				libraryVersion,
				newLibraryVersion
			);
			if (result == this.DOWNLOAD_RESULT_RESTART) {
				continue loop;
			}
		}
		
		let deletionsResult = yield this._downloadDeletions(libraryVersion, newLibraryVersion);
		if (deletionsResult == this.DOWNLOAD_RESULT_RESTART) {
			continue loop;
		}
		
		break;
	}
	
	if (newLibraryVersion) {
		yield Zotero.Libraries.setVersion(this.libraryID, newLibraryVersion);
	}
	
	return localChanges
		? this.DOWNLOAD_RESULT_CHANGES_TO_UPLOAD
		: this.DOWNLOAD_RESULT_NO_CHANGES_TO_UPLOAD;
});


/**
 * @param {Integer} since - Last-known library version; get changes since this version
 * @return {Integer|Boolean} - Library version returned from server, or false if no changes since
 *                             specified version
 */
Zotero.Sync.Data.Engine.prototype._downloadSettings = Zotero.Promise.coroutine(function* (since) {
	let results = yield this.apiClient.getSettings(
		this.library.libraryType,
		this.libraryTypeID,
		since
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


/**
 * Get versions of objects updated remotely since the last sync time and kick off object downloading
 *
 * @param {String} objectType
 * @param {Integer} since - Last-known library version; get changes sinces this version
 * @param {Integer} newLibraryVersion - Last library version seen in this sync process; if newer version
 *     is seen, restart the sync
 * @param {Object} [options]
 * @return {Promise<Integer>} - A download result code (this.DOWNLOAD_RESULT_*)
 */
Zotero.Sync.Data.Engine.prototype._downloadUpdatedObjects = Zotero.Promise.coroutine(function* (objectType, since, newLibraryVersion, options = {}) {
	var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
	var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
	
	// Get versions of all objects updated remotely since the current local library version
	Zotero.debug(`Checking for updated ${options.top ? 'top-level ' : ''}`
		+ `${objectTypePlural} in ${this.library.name}`);
	var queryParams = {};
	if (since) {
		queryParams.since = since;
	}
	if (options.top) {
		queryParams.top = true;
	}
	var results = yield this.apiClient.getVersions(
		this.library.libraryType,
		this.libraryTypeID,
		objectType,
		queryParams
	);
	
	Zotero.debug("VERSIONS:");
	Zotero.debug(JSON.stringify(results));
	
	// If something else modified the remote library while we were getting updates,
	// wait for increasing amounts of time before trying again, and then start from
	// the beginning
	if (newLibraryVersion != results.libraryVersion) {
		return this._onLibraryVersionChange();
	}
	
	
	var numObjects = Object.keys(results.versions).length;
	if (numObjects) {
		Zotero.debug(numObjects + " " + (numObjects == 1 ? objectType : objectTypePlural)
			+ " modified since last check");
	}
	else {
		Zotero.debug("No " + objectTypePlural + " modified remotely since last check");
	}
	
	// Get objects that should be retried based on the current time, unless it's top-level items mode.
	// (We don't know if the queued items are top-level or not, so we do them with child items.)
	let queuedKeys = [];
	if (objectType != 'item' || !options.top) {
		queuedKeys = yield Zotero.Sync.Data.Local.getObjectsToTryFromSyncQueue(
			objectType, this.libraryID
		);
		if (queuedKeys.length) {
			Zotero.debug(`Refetching ${queuedKeys.length} queued `
				+ (queuedKeys.length == 1 ? objectType : objectTypePlural))
		}
	}
	
	if (!numObjects && !queuedKeys.length) {
		return false;
	}
	
	let keys = [];
	let versions = yield objectsClass.getObjectVersions(
		this.libraryID, Object.keys(results.versions)
	);
	for (let key in results.versions) {
		// Skip objects that are already up-to-date. Generally all returned objects should have
		// newer version numbers, but there are some situations, such as full syncs or
		// interrupted syncs, where we may get versions for objects that are already up-to-date
		// locally.
		if (versions[key] == results.versions[key]) {
			Zotero.debug("Skipping up-to-date " + objectType + " " + this.libraryID + "/" + key);
			continue;
		}
		keys.push(key);
	}
	
	// In child-items mode, remove top-level items that just failed
	if (objectType == 'item' && !options.top && this.failedItems.length) {
		keys = Zotero.Utilities.arrayDiff(keys, this.failedItems);
	}
	
	keys.push(...queuedKeys);
	
	if (!keys.length) {
		Zotero.debug(`No ${objectTypePlural} to download`);
		return this.DOWNLOAD_RESULT_CONTINUE;
	}
	
	return this._downloadObjects(objectType, keys);
});


/**
 * Download data for specified objects from the API and run processing on them, and show the conflict
 * resolution window if necessary
 *
 * @return {Promise<Integer>} - A download result code (this.DOWNLOAD_RESULT_*)
 */
Zotero.Sync.Data.Engine.prototype._downloadObjects = Zotero.Promise.coroutine(function* (objectType, keys) {
	var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
	
	var lastLength = keys.length;
	var objectData = {};
	keys.forEach(key => objectData[key] = null);
	
	while (true) {
		this._failedCheck();
		
		let lastError = false;
		
		// Get data we've downloaded in a previous loop but failed to process
		var json = [];
		let keysToDownload = [];
		for (let key in objectData) {
			if (objectData[key] === null) {
				keysToDownload.push(key);
			}
			else {
				json.push(objectData[key]);
			}
		}
		if (json.length) {
			json = [json];
		}
		// Add promises for batches of downloaded data for remaining keys
		json.push(...this.apiClient.downloadObjects(
			this.library.libraryType,
			this.libraryTypeID,
			objectType,
			keysToDownload
		));
		
		// TODO: localize
		this.setStatus(
			"Downloading "
			+ (keysToDownload.length == 1
				? "1 " + objectType
				: Zotero.Utilities.numberFormat(keys.length, 0) + " " + objectTypePlural)
			+ " in " + this.library.name
		);
		
		var conflicts = [];
		var num = 0;
		
		// Process batches when they're available, one at a time
		yield Zotero.Promise.map(
			json,
			function (batch) {
				this._failedCheck();
				
				Zotero.debug(`Processing batch of downloaded ${objectTypePlural} in `
					+ this.library.name);
				
				
				if (!Array.isArray(batch)) {
					this.failed = batch;
					lastError = batch;
					return;
				}
				
				// Save downloaded JSON for later attempts
				batch.forEach(obj => {
					objectData[obj.key] = obj;
				});
				
				// Process objects
				return Zotero.Sync.Data.Local.processObjectsFromJSON(
					objectType,
					this.libraryID,
					batch,
					this._getOptions({
						onObjectProcessed: () => {
							num++;
						},
						// Increase the notifier batch size as we go
						getNotifierBatchSize: () => {
							var size;
							if (num < 10) {
								size = 1;
							}
							else if (num < 50) {
								size = 5;
							}
							else if (num < 150) {
								size = 25;
							}
							else {
								size = 50;
							}
							return Math.min(size, batch.length);
						}
					})
				)
				.then(function (results) {
					num += results.length;
					let processedKeys = [];
					let conflictResults = [];
					results.forEach(x => {
						// If data was processed, remove JSON
						if (x.processed) {
							delete objectData[x.key];
						}
						// If object shouldn't be retried, mark as processed
						if (x.processed || !x.retry) {
							processedKeys.push(x.key);
						}
						if (x.conflict) {
							conflictResults.push(x);
						}
					});
					keys = Zotero.Utilities.arrayDiff(keys, processedKeys);
					conflicts.push(...conflictResults);
				}.bind(this));
			}.bind(this),
			{
				concurrency: 1
			}
		);
		
		if (!keys.length || keys.length == lastLength) {
			// Add failed objects to sync queue
			let failedKeys = Object.keys(objectData).filter(key => objectData[key])
			if (failedKeys.length) {
				let objDesc = `${failedKeys.length == 1 ? objectType : objectTypePlural}`;
				Zotero.debug(`Queueing ${failedKeys.length} failed ${objDesc} for later`, 2);
				yield Zotero.Sync.Data.Local.addObjectsToSyncQueue(
					objectType, this.libraryID, failedKeys
				);
				
				// Note failed item keys so child items step (if this isn't it) can skip them
				if (objectType == 'item') {
					this.failedItems = failedKeys;
				}
			}
			else {
				Zotero.debug("All " + objectTypePlural + " for "
					+ this.library.name + " saved to database");
				
				if (objectType == 'item') {
					this.failedItems = [];
				}
			}
			break;
		}
		
		lastLength = keys.length;
		
		var remainingObjectDesc = `${keys.length == 1 ? objectType : objectTypePlural}`;
		Zotero.debug(`Retrying ${keys.length} remaining ${remainingObjectDesc}`);
	}
	
	// Show conflict resolution window
	if (conflicts.length) {
		let results = yield Zotero.Sync.Data.Local.processConflicts(
			objectType, this.libraryID, conflicts, this._getOptions()
		);
		// Keys can be unprocessed if conflict resolution is cancelled
		let keys = results.filter(x => x.processed).map(x => x.key);
		if (!keys.length) {
			throw new Zotero.Sync.UserCancelledException();
		}
		yield Zotero.Sync.Data.Local.removeObjectsFromSyncQueue(objectType, this.libraryID, keys);
	}
	
	return this.DOWNLOAD_RESULT_CONTINUE;
});


/**
 * Get deleted objects from the API and process them
 *
 * @param {Integer} since - Last-known library version; get changes sinces this version
 * @param {Integer} newLibraryVersion - Newest library version seen in this sync process; if newer version
 *     is seen, restart the sync
 * @return {Promise<Integer>} - A download result code (this.DOWNLOAD_RESULT_*)
 */
Zotero.Sync.Data.Engine.prototype._downloadDeletions = Zotero.Promise.coroutine(function* (since, newLibraryVersion) {
	let results = yield this.apiClient.getDeleted(
		this.library.libraryType,
		this.libraryTypeID,
		since
	);
	if (newLibraryVersion != results.libraryVersion) {
		return this._onLibraryVersionChange();
	}
	
	var numObjects = Object.keys(results.deleted).reduce((n, k) => n + results.deleted[k].length, 0);
	if (!numObjects) {
		Zotero.debug("No objects deleted remotely since last check");
		return this.DOWNLOAD_RESULT_CONTINUE;
	}
	
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
				let meta = Zotero.SyncedSettings.getMetadata(this.libraryID, key);
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
			
			let obj = objectsClass.getByLibraryAndKey(this.libraryID, key);
			if (!obj) {
				continue;
			}
			if (obj.synced) {
				toDelete.push(obj);
			}
			// Conflict resolution
			else if (objectType == 'item') {
				conflicts.push({
					left: obj.toJSON(),
					right: {
						deleted: true
					}
				});
			}
			
			// Ignore deletion if collection/search changed locally
		}
		
		if (conflicts.length) {
			// Sort conflicts by Date Modified
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
			var mergeData = Zotero.Sync.Data.Local.showConflictResolutionWindow(conflicts);
			if (!mergeData) {
				Zotero.debug("Cancelling sync");
				throw new Zotero.Sync.UserCancelledException();
			}
			let concurrentObjects = 50;
			yield Zotero.Utilities.Internal.forEachChunkAsync(
				mergeData,
				concurrentObjects,
				function (chunk) {
					return Zotero.DB.executeTransaction(function* () {
						for (let json of chunk) {
							if (!json.deleted) continue;
							let obj = objectsClass.getByLibraryAndKey(
								this.libraryID, json.key
							);
							if (!obj) {
								Zotero.logError("Remotely deleted " + objectType
									+ " didn't exist after conflict resolution");
								continue;
							}
							yield obj.erase({
								skipEditCheck: true
							});
						}
					}.bind(this));
				}.bind(this)
			);
		}
		
		if (toDelete.length) {
			yield Zotero.DB.executeTransaction(function* () {
				for (let obj of toDelete) {
					yield obj.erase({
						skipEditCheck: true,
						skipDeleteLog: true
					});
				}
			});
		}
	}
	
	return this.DOWNLOAD_RESULT_CONTINUE;
});


/**
 * If something else modified the remote library while we were getting updates, wait for increasing
 * amounts of time before trying again, and then start from the beginning
 */
Zotero.Sync.Data.Engine.prototype._onLibraryVersionChange = Zotero.Promise.coroutine(function* (mode) {
	Zotero.logError("Library version changed since last download -- restarting sync");
	let keepGoing = yield this.downloadDelayGenerator.next();
	if (!keepGoing) {
		throw new Error("Could not update " + this.library.name + " -- library in use");
	}
	return this.DOWNLOAD_RESULT_RESTART;
});


/**
 * Get unsynced objects, build upload JSON, and start API requests
 *
 * @throws {Zotero.HTTP.UnexpectedStatusException}
 * @return {Promise<Integer>} - An upload result code (this.UPLOAD_RESULT_*)
 */
Zotero.Sync.Data.Engine.prototype._startUpload = Zotero.Promise.coroutine(function* () {
	var libraryVersion = this.library.libraryVersion;
	
	var settingsUploaded = false;
	var uploadNeeded = false;
	var objectIDs = {};
	var objectDeletions = {};
	
	// Upload synced settings
	try {
		let settings = yield Zotero.SyncedSettings.getUnsynced(this.libraryID);
		if (Object.keys(settings).length) {
			libraryVersion = yield this._uploadSettings(settings, libraryVersion);
			settingsUploaded = true;
		}
		else {
			Zotero.debug("No settings to upload in " + this.library.name);
		}
	}
	catch (e) {
		if (e instanceof Zotero.HTTP.UnexpectedStatusException && e.status == 412) {
			return this.UPLOAD_RESULT_LIBRARY_CONFLICT;
		}
		throw e;
	}
	
	// Get unsynced local objects for each object type
	for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(this.libraryID)) {
		let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		
		// New/modified objects
		let ids = yield Zotero.Sync.Data.Local.getUnsynced(objectType, this.libraryID);
		
		// Skip objects in sync queue, because they might have unresolved conflicts.
		// The queue only has keys, so we have to convert to keys and back.
		let unsyncedKeys = ids.map(id => objectsClass.getLibraryAndKeyFromID(id).key);
		let queueKeys = yield Zotero.Sync.Data.Local.getObjectsFromSyncQueue(objectType, this.libraryID);
		unsyncedKeys = Zotero.Utilities.arrayDiff(unsyncedKeys, queueKeys);
		ids = unsyncedKeys.map(key => objectsClass.getIDFromLibraryAndKey(this.libraryID, key));
		
		if (ids.length) {
			Zotero.debug(ids.length + " "
				+ (ids.length == 1 ? objectType : objectTypePlural)
				+ " to upload in library " + this.libraryID);
			objectIDs[objectType] = ids;
		}
		else {
			Zotero.debug("No " + objectTypePlural + " to upload in " + this.library.name);
		}
		
		// Deleted objects
		let keys = yield Zotero.Sync.Data.Local.getDeleted(objectType, this.libraryID);
		if (keys.length) {
			Zotero.debug(`${keys.length} ${objectType} deletion`
				+ (keys.length == 1 ? '' : 's')
				+ ` to upload in ${this.library.name}`);
			objectDeletions[objectType] = keys;
		}
		else {
			Zotero.debug(`No ${objectType} deletions to upload in ${this.library.name}`);
		}
		
		if (ids.length || keys.length) {
			uploadNeeded = true;
		}
	}
	
	if (!uploadNeeded) {
		return settingsUploaded ? this.UPLOAD_RESULT_SUCCESS : this.UPLOAD_RESULT_NOTHING_TO_UPLOAD;
	}
	
	try {
		Zotero.debug(JSON.stringify(objectIDs));
		for (let objectType in objectIDs) {
			libraryVersion = yield this._uploadObjects(
				objectType, objectIDs[objectType], libraryVersion
			);
		}
		
		Zotero.debug(JSON.stringify(objectDeletions));
		for (let objectType in objectDeletions) {
			libraryVersion = yield this._uploadDeletions(
				objectType, objectDeletions[objectType], libraryVersion
			);
		}
	}
	catch (e) {
		if (e instanceof Zotero.HTTP.UnexpectedStatusException && e.status == 412) {
			return this.UPLOAD_RESULT_LIBRARY_CONFLICT;
		}
		throw e;
	}
	
	return this.UPLOAD_RESULT_SUCCESS;
});


Zotero.Sync.Data.Engine.prototype._uploadSettings = Zotero.Promise.coroutine(function* (settings, libraryVersion) {
	let json = {};
	for (let key in settings) {
		json[key] = {
			value: settings[key]
		};
	}
	libraryVersion = yield this.apiClient.uploadSettings(
		this.library.libraryType,
		this.libraryTypeID,
		libraryVersion,
		json
	);
	yield Zotero.SyncedSettings.markAsSynced(
		this.libraryID,
		Object.keys(settings),
		libraryVersion
	);
	Zotero.debug("Done uploading settings in " + this.library.name);
	return libraryVersion;
});


Zotero.Sync.Data.Engine.prototype._uploadObjects = Zotero.Promise.coroutine(function* (objectType, ids, libraryVersion) {
	let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
	let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
	
	let queue = [];
	for (let id of ids) {
		queue.push({
			id: id,
			json: null,
			tries: 0,
			failed: false
		});
	}
	
	while (queue.length) {
		// Get a slice of the queue and generate JSON for objects if necessary
		let batch = [];
		let numSkipped = 0;
		for (let i = 0; i < queue.length && i < this.uploadBatchSize; i++) {
			let o = queue[i];
			// Skip requests that failed with 4xx
			if (o.failed) {
				numSkipped++;
				continue;
			}
			if (!o.json) {
				o.json = yield this._getJSONForObject(
					objectType,
					o.id,
					{
						// Only storage properties ('mtime', 'md5') for WebDAV files
						skipStorageProperties:
							objectType == 'item'
								? Zotero.Sync.Storage.Local.getModeForLibrary(this.library.libraryID)
									!= 'webdav'
								: undefined
					}
				);
			}
			batch.push(o.json);
		}
		
		// No more non-failed requests
		if (!batch.length) {
			break;
		}
		
		// Remove selected and skipped objects from queue
		queue.splice(0, batch.length + numSkipped);
		
		Zotero.debug("UPLOAD BATCH:");
		Zotero.debug(batch);
		
		let results;
		let numSuccessful = 0;
		({ libraryVersion, results } = yield this.apiClient.uploadObjects(
			this.library.libraryType,
			this.libraryTypeID,
			"POST",
			libraryVersion,
			objectType,
			batch
		));
		
		Zotero.debug("===");
		Zotero.debug(results);
		
		// Mark successful and unchanged objects as synced with new version,
		// and save uploaded JSON to cache
		let ids = [];
		let toSave = [];
		let toCache = [];
		for (let state of ['successful', 'unchanged']) {
			for (let index in results[state]) {
				let current = results[state][index];
				// 'successful' includes objects, not keys
				let key = state == 'successful' ? current.key : current;
				
				if (key != batch[index].key) {
					throw new Error("Key mismatch (" + key + " != " + batch[index].key + ")");
				}
				
				let obj = objectsClass.getByLibraryAndKey(this.libraryID, key);
				ids.push(obj.id);
				
				if (state == 'successful') {
					// Update local object with saved data if necessary
					yield obj.loadAllData();
					obj.fromJSON(current.data);
					toSave.push(obj);
					toCache.push(current);
				}
				else {
					// This won't reflect the actual version of the item on the server, but
					// it will guarantee that the item won't be redownloaded unnecessarily
					// in the case of a full sync, because the version will be higher than
					// whatever version is on the server.
					batch[index].version = libraryVersion
					toCache.push(batch[index]);
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
			this.library.libraryVersion = libraryVersion;
			yield this.library.save();
			objectsClass.updateVersion(ids, libraryVersion);
			objectsClass.updateSynced(ids, true);
		}.bind(this));
		
		// Handle failed objects
		for (let index in results.failed) {
			let { code, message, data } = results.failed[index];
			let e = new Error(message);
			e.name = "ZoteroObjectUploadError";
			e.code = code;
			if (data) {
				e.data = data;
			}
			Zotero.logError("Error for " + objectType + " " + batch[index].key + " in "
				+ this.library.name + ":\n\n" + e);
			
			// This shouldn't happen, because the upload request includes a library
			// version and should prevent an outdated upload before the object version is
			// checked. If it does, we need to do a full sync.
			if (e.code == 412) {
				return this.UPLOAD_RESULT_OBJECT_CONFLICT;
			}
			
			if (this.onError) {
				this.onError(e);
			}
			if (this.stopOnError) {
				throw new Error(e);
			}
			batch[index].tries++;
			// Mark 400 errors as permanently failed
			if (e.code >= 400 && e.code < 500) {
				batch[index].failed = true;
			}
			// 500 errors should stay in queue and be retried
		}
		
		// Add failed objects back to end of queue
		var numFailed = 0;
		for (let o of batch) {
			if (o !== undefined) {
				queue.push(o);
				// TODO: Clear JSON?
				numFailed++;
			}
		}
		Zotero.debug("Failed: " + numFailed, 2);
		
		// If we didn't make any progress, bail
		if (!numSuccessful) {
			throw new Error("Made no progress during upload -- stopping");
		}
	}
	Zotero.debug("Done uploading " + objectTypePlural + " in library " + this.libraryID);
	
	return libraryVersion;
})


Zotero.Sync.Data.Engine.prototype._uploadDeletions = Zotero.Promise.coroutine(function* (objectType, keys, libraryVersion) {
	let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
	let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
	
	while (keys.length) {
		let batch = keys.slice(0, this.uploadDeletionBatchSize);
		libraryVersion = yield this.apiClient.uploadDeletions(
			this.library.libraryType,
			this.libraryTypeID,
			libraryVersion,
			objectType,
			batch
		);
		keys.splice(0, batch.length);
		
		// Update library version
		this.library.libraryVersion = libraryVersion;
		yield this.library.saveTx();
		
		// Remove successful deletions from delete log
		yield Zotero.Sync.Data.Local.removeObjectsFromDeleteLog(
			objectType, this.libraryID, batch
		);
	}
	Zotero.debug(`Done uploading ${objectType} deletions in ${this.library.name}`);
	
	return libraryVersion;
});


Zotero.Sync.Data.Engine.prototype._getJSONForObject = function (objectType, id, options = {}) {
	return Zotero.DB.executeTransaction(function* () {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		var obj = objectsClass.get(id);
		var cacheObj = false;
		// If the object has been synced before, get the pristine version from the cache so we can
		// use PATCH mode and include only fields that have changed
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
			// Whether to skip 'mtime' and 'md5'
			skipStorageProperties: options.skipStorageProperties,
			// Use last-synced mtime/md5 instead of current values from the file itself
			syncedStorageProperties: true,
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
	var libraryVersion = this.library.libraryVersion;
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
			this.setStatus("Updating " + objectTypePlural + " in " + this.library.name);
			
			// Get versions from API for all objects
			let allResults = yield this.apiClient.getVersions(
				this.library.libraryType,
				this.libraryTypeID,
				objectType
			);
			
			// Get versions from API for objects modified remotely since the last classic sync time
			let sinceResults = yield this.apiClient.getVersions(
				this.library.libraryType,
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
					throw new Error("Could not update " + this.library.name + " -- library in use");
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
			this.setStatus("Updating " + objectTypePlural + " in " + this.library.name);
			
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
		this.library.libraryVersion = -1;
		yield this.library.save();
		
		// If this is the last classic sync library, delete old timestamps
		if (!(yield Zotero.DB.valueQueryAsync("SELECT COUNT(*) FROM libraries WHERE version=0"))) {
			yield Zotero.DB.queryAsync(
				"DELETE FROM version WHERE schema IN ('lastlocalsync', 'lastremotesync')"
			);
		}
	}.bind(this));
	
	Zotero.debug("Done upgrading " + this.library.name);
	
	return versionResults;
});


/**
 * Perform a full sync
 *
 * Get all object versions from the API and compare to the local database. If any objects are
 * missing or outdated, download them. If any local objects are marked as synced but aren't available
 * remotely, mark them as unsynced for later uploading.
 *
 * (Technically this isn't a full sync on its own, because local objects are only flagged for later
 * upload.)
 *
 * @param {Object[]} [versionResults] - Objects returned from getVersions(), keyed by objectType
 * @return {Promise<Integer>} - Promise for the library version after syncing
 */
Zotero.Sync.Data.Engine.prototype._fullSync = Zotero.Promise.coroutine(function* (versionResults) {
	Zotero.debug("Performing a full sync of " + this.library.name);
	
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
			let ObjectType = Zotero.Utilities.capitalize(objectType);
			
			// TODO: localize
			this.setStatus("Updating " + objectTypePlural + " in " + this.library.name);
			
			let results = {};
			// Use provided versions
			if (versionResults) {
				results = versionResults[objectType];
			}
			// If not available, get from API
			else {
				results = yield this.apiClient.getVersions(
					this.library.libraryType,
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
						throw new Error("Could not update " + this.library.name + " -- library in use");
					}
					continue loop;
				}
			}
			else {
				lastLibraryVersion = results.libraryVersion;
			}
			
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
			let toDownload = [];
			let localVersions = yield objectsClass.getObjectVersions(this.libraryID);
			// Queue objects that are out of date or don't exist locally
			for (let key in results.versions) {
				let version = results.versions[key];
				let obj = objectsClass.getByLibraryAndKey(this.libraryID, key);
				// If object already at latest version, skip
				let localVersion = localVersions[key];
				if (localVersion && localVersion === version) {
					continue;
				}
				
				// This should never happen
				if (localVersion > version) {
					Zotero.logError(`Local version of ${objectType} ${this.libraryID}/${key} `
						+ `is later than remote! (${localVersion} > ${version})`);
					// Delete cache version if it's there
					yield Zotero.Sync.Data.Local.deleteCacheObjectVersions(
						objectType, this.libraryID, key, localVersion, localVersion
					);
				}
				
				if (obj) {
					Zotero.debug(`${ObjectType} ${obj.libraryKey} is older than remote version`);
				}
				else {
					Zotero.debug(`${ObjectType} ${this.libraryID}/${key} does not exist locally`);
				}
				
				toDownload.push(key);
			}
			
			if (toDownload.length) {
				Zotero.debug("Downloading missing/outdated " + objectTypePlural);
				yield this._downloadObjects(objectType, toDownload);
			}
			else {
				Zotero.debug(`No missing/outdated ${objectTypePlural} to download`);
			}
			
			// Mark synced objects that don't exist remotely as unsynced
			let syncedKeys = yield Zotero.Sync.Data.Local.getSynced(objectType, this.libraryID);
			let remoteMissing = Zotero.Utilities.arrayDiff(syncedKeys, Object.keys(results.versions));
			if (remoteMissing.length) {
				Zotero.debug("Checking remotely missing synced " + objectTypePlural);
				Zotero.debug(remoteMissing);
				
				// Check remotely deleted objects
				if (!remoteDeleted) {
					let results = yield this.apiClient.getDeleted(
						this.library.libraryType, this.libraryTypeID
					);
					remoteDeleted = results.deleted;
				}
				
				let toDelete = [];
				let toUpload = [];
				for (let key of remoteMissing) {
					let id = objectsClass.getIDFromLibraryAndKey(this.libraryID, key);
					if (!id) {
						Zotero.logError(`ObjectType ${key} not found to mark as unsynced`);
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
					yield objectsClass.erase(
						toDelete,
						{
							skipEditCheck: true,
							skipDeleteLog: true
						}
					);
				}
				// For remotely missing objects that exist locally, reset version, since old
				// version will no longer match remote, and mark for upload
				if (toUpload.length) {
					Zotero.debug(`Marking remotely missing synced ${objectTypePlural} as unsynced`);
					yield objectsClass.updateVersion(toUpload, 0);
					yield objectsClass.updateSynced(toUpload, false);
				}
			}
			else {
				Zotero.debug(`No remotely missing synced ${objectTypePlural}`);
			}
		}
		break;
	}
	
	yield Zotero.Libraries.setVersion(this.libraryID, lastLibraryVersion);
	
	Zotero.debug("Done with full sync for " + this.library.name);
	
	return lastLibraryVersion;
});


Zotero.Sync.Data.Engine.prototype._getOptions = function (additionalOpts = {}) {
	var options = {};
	this.optionNames.forEach(x => options[x] = this[x]);
	for (let opt in additionalOpts) {
		options[opt] = additionalOpts[opt];
	}
	return options;
}


Zotero.Sync.Data.Engine.prototype._failedCheck = function () {
	if (this.stopOnError && this.failed) {
		Zotero.logError("Stopping on error");
		throw this.failed;
	}
};
