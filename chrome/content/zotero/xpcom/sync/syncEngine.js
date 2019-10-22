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
	this.userID = options.userID;
	this.libraryID = options.libraryID;
	this.library = Zotero.Libraries.get(options.libraryID);
	this.libraryTypeID = this.library.libraryTypeID;
	this.uploadBatchSize = 10;
	this.uploadDeletionBatchSize = 25;
	this.maxUploadTries = 5;
	
	this.failed = false;
	this.failedItems = [];
	
	// Options to pass through to processing functions
	this.optionNames = [
		'setStatus',
		'onError',
		'stopOnError',
		'background',
		'firstInSession',
		'resetMode'
	];
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
Zotero.Sync.Data.Engine.prototype.DOWNLOAD_RESULT_LIBRARY_UNMODIFIED = 4;
Zotero.Sync.Data.Engine.prototype.DOWNLOAD_RESULT_RESTART = 5;

Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_SUCCESS = 1;
Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_NOTHING_TO_UPLOAD = 2;
Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_LIBRARY_CONFLICT = 3;
Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_OBJECT_CONFLICT = 4;
Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_RESTART = 5;
Zotero.Sync.Data.Engine.prototype.UPLOAD_RESULT_CANCEL = 6;

Zotero.Sync.Data.Engine.prototype.start = Zotero.Promise.coroutine(function* () {
	Zotero.debug("Starting data sync for " + this.library.name);
	
	// TODO: Handle new/changed user when setting key
	if (this.library.libraryType == 'user' && !this.libraryTypeID) {
		let info = yield this.apiClient.getKeyInfo();
		Zotero.debug("Got userID " + info.userID + " for API key");
		this.libraryTypeID = info.userID;
	}
	
	this._statusCheck();
	this._restoringToServer = false;
	
	// Check if we've synced this library with the current architecture yet
	var libraryVersion = this.library.libraryVersion;
	if (this.resetMode == Zotero.Sync.Runner.RESET_MODE_TO_SERVER) {
		yield this._restoreToServer();
	}
	else if (!libraryVersion || libraryVersion == -1) {
		let versionResults = yield this._upgradeCheck();
		if (versionResults) {
			libraryVersion = this.library.libraryVersion;
		}
		
		this._statusCheck();
		
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
	
	this.downloadDelayGenerator = null;
	var autoReset = false;
	
	sync:
	while (true) {
		this._statusCheck();
		
		let downloadResult, uploadResult;
		
		try {
			uploadResult = yield this._startUpload();
		}
		catch (e) {
			if (e instanceof Zotero.Sync.UserCancelledException) {
				throw e;
			}
			Zotero.debug("Upload failed -- performing download", 2);
			downloadResult = yield this._startDownload();
			Zotero.debug("Download result is " + downloadResult, 4);
			throw e;
		}
		
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
			if (!gen) {
				var gen = Zotero.Utilities.Internal.delayGenerator(
					Zotero.Sync.Data.conflictDelayIntervals, 60 * 1000
				);
			}
			// After the first upload version conflict (which is expected after remote changes),
			// start delaying to give other sync sessions time to complete
			else {
				let keepGoing = yield gen.next().value;
				if (!keepGoing) {
					throw new Error("Could not sync " + this.library.name + " -- too many retries");
				}
			}
			
			downloadResult = yield this._startDownload();
			Zotero.debug("Download result is " + downloadResult, 4);
			break;
		
		case this.UPLOAD_RESULT_RESTART:
			Zotero.debug("Restarting sync for " + this.library.name);
			break;
		
		case this.UPLOAD_RESULT_CANCEL:
			Zotero.debug("Cancelling sync for " + this.library.name);
			return;
		}
	}
	
	this.library.updateLastSyncTime();
	yield this.library.saveTx({
		skipNotifier: true
	});
	
	Zotero.debug("Done syncing " + this.library.name);
});


/**
 * Stop the sync process
 */
Zotero.Sync.Data.Engine.prototype.stop = function () {
	Zotero.debug("Stopping data sync for " + this.library.name);
	this._stopping = true;
}


/**
 * Download updated objects from API and save to DB
 *
 * @return {Promise<Integer>} - A download result code (this.DOWNLOAD_RESULT_*)
 */
Zotero.Sync.Data.Engine.prototype._startDownload = Zotero.Promise.coroutine(function* () {
	var localChanges = false;
	var libraryVersion = this.library.libraryVersion;
	var newLibraryVersion;
	
	loop:
	while (true) {
		this._statusCheck();
		
		// Get synced settings first, since they affect how other data is displayed
		let results = yield this._downloadSettings(libraryVersion);
		if (results.result == this.DOWNLOAD_RESULT_LIBRARY_UNMODIFIED) {
			let stop = true;
			// If it's the first sync of the session or a manual sync and there are objects in the
			// sync queue, or it's a subsequent auto-sync but there are objects that it's time to try
			// again, go through all the steps even though the library version is unchanged.
			//
			// TODO: Skip the steps without queued objects.
			if (this.firstInSession || !this.background) {
				stop = !(yield Zotero.Sync.Data.Local.hasObjectsInSyncQueue(this.libraryID));
			}
			else {
				stop = !(yield Zotero.Sync.Data.Local.hasObjectsToTryInSyncQueue(this.libraryID));
			}
			if (stop) {
				break;
			}
		}
		newLibraryVersion = results.libraryVersion;
		
		//
		// Get other object types
		//
		for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(this.libraryID)) {
			this._statusCheck();
			
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
					yield this._onLibraryVersionChange();
					continue loop;
				}
			}
			
			let result = yield this._downloadUpdatedObjects(
				objectType,
				libraryVersion,
				newLibraryVersion
			);
			if (result == this.DOWNLOAD_RESULT_RESTART) {
				yield this._onLibraryVersionChange();
				continue loop;
			}
		}
		
		let deletionsResult = yield this._downloadDeletions(libraryVersion, newLibraryVersion);
		if (deletionsResult.result == this.DOWNLOAD_RESULT_RESTART) {
			yield this._onLibraryVersionChange();
			continue loop;
		}
		
		break;
	}
	
	if (newLibraryVersion) {
		// After data is downloaded, the library version is updated to match the remote version. We
		// track a library version for file syncing separately, so that even if Zotero is closed or
		// interrupted between a data sync and a file sync, we know that file syncing has to be
		// performed for any files marked for download during data sync (based on outdated mtime/md5).
		// Files may be missing remotely, though, so it's only necessary to try to download them once
		// every time there are remote storage changes, which we indicate with a 'storageDownloadNeeded'
		// flag set in syncLocal. If the storage version was already behind, though, a storage download
		// is needed, regardless of whether storage metadata was updated.
		if (this.library.storageVersion < this.library.libraryVersion) {
			this.library.storageDownloadNeeded = true;
		}
		// Update library version to match remote
		this.library.libraryVersion = newLibraryVersion;
		// Skip storage downloads if not needed
		if (!this.library.storageDownloadNeeded) {
			this.library.storageVersion = newLibraryVersion;
		}
		yield this.library.saveTx();
	}
	
	return localChanges
		? this.DOWNLOAD_RESULT_CHANGES_TO_UPLOAD
		: this.DOWNLOAD_RESULT_NO_CHANGES_TO_UPLOAD;
});


/**
 * Download settings modified since the given version
 *
 * Unlike the other download methods, this method, which runs first in the main download process,
 * returns an object rather than just a download result code. It does this so it can return the
 * current library version from the API to pass to later methods, allowing them to restart the download
 * process if there was a remote change.
 *
 * @param {Integer} since - Last-known library version; get changes since this version
 * @param {Integer} [newLibraryVersion] - Newest library version seen in this sync process; if newer
 *     version is seen, restart the sync
 * @return {Object} - Object with 'result' (DOWNLOAD_RESULT_*) and 'libraryVersion'
 */
Zotero.Sync.Data.Engine.prototype._downloadSettings = Zotero.Promise.coroutine(function* (since, newLibraryVersion) {
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
		return {
			result: this.DOWNLOAD_RESULT_LIBRARY_UNMODIFIED,
			libraryVersion: since
		};
	}
	if (newLibraryVersion !== undefined && newLibraryVersion != results.libraryVersion) {
		return {
			result: this.DOWNLOAD_RESULT_RESTART,
			libraryVersion: results.libraryVersion
		};
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
	return {
		result: this.DOWNLOAD_RESULT_CONTINUE,
		libraryVersion: results.libraryVersion
	};
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
		return this.DOWNLOAD_RESULT_RESTART;
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
		if (this.firstInSession || !this.background) {
			queuedKeys = yield Zotero.Sync.Data.Local.getObjectsFromSyncQueue(
				objectType, this.libraryID
			);
		}
		else {
			queuedKeys = yield Zotero.Sync.Data.Local.getObjectsToTryFromSyncQueue(
				objectType, this.libraryID
			);
		}
		// Don't include items that just failed in the top-level run
		if (this.failedItems.length) {
			queuedKeys = Zotero.Utilities.arrayDiff(queuedKeys, this.failedItems);
		}
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
	let upToDate = [];
	for (let key in results.versions) {
		// Skip objects that are already up-to-date. Generally all returned objects should have
		// newer version numbers, but there are some situations, such as full syncs or
		// interrupted syncs, where we may get versions for objects that are already up-to-date
		// locally.
		if (versions[key] == results.versions[key]) {
			upToDate.push(key);
			continue;
		}
		keys.push(key);
	}
	if (upToDate.length) {
		Zotero.debug(`Skipping up-to-date ${objectTypePlural} in library ${this.libraryID}: `
			+ upToDate.sort().join(", "));
	}
	
	// In child-items mode, remove top-level items that just failed
	if (objectType == 'item' && !options.top && this.failedItems.length) {
		keys = Zotero.Utilities.arrayDiff(keys, this.failedItems);
	}
	
	keys.push(...queuedKeys);
	keys = Zotero.Utilities.arrayUnique(keys);
	
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
Zotero.Sync.Data.Engine.prototype._downloadObjects = async function (objectType, keys) {
	var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
	
	var remainingKeys = [...keys];
	var lastLength = keys.length;
	var objectData = {};
	keys.forEach(key => objectData[key] = null);
	
	while (true) {
		this._statusCheck();
		
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
				: Zotero.Utilities.numberFormat(remainingKeys.length, 0) + " " + objectTypePlural)
			+ " in " + this.library.name
		);
		
		var conflicts = [];
		var restored = [];
		var num = 0;
		
		// Process batches of object data as they're available, one at a time
		await Zotero.Promise.map(
			json,
			async function (batch) {
				this._statusCheck();
				
				Zotero.debug(`Processing batch of downloaded ${objectTypePlural} in ${this.library.name}`);
				
				if (!Array.isArray(batch)) {
					this.failed = batch;
					return;
				}
				
				// Save downloaded JSON for later attempts
				batch.forEach(obj => {
					objectData[obj.key] = obj;
				});
				
				// Process objects
				let results = await Zotero.Sync.Data.Local.processObjectsFromJSON(
					objectType,
					this.libraryID,
					batch,
					this._getOptions({
						onObjectProcessed: () => {
							num++;
							// Check for stop every 5 items
							if (num % 5 == 0) {
								this._statusCheck();
							}
						},
						// Increase the notifier batch size as we go, so that new items start coming in
						// one by one but then switch to larger chunks
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
				);
				
				num += results.length;
				let processedKeys = [];
				let conflictResults = [];
				results.forEach(x => {
					// If data was processed, remove JSON
					if (x.processed) {
						delete objectData[x.key];
						
						// We'll need to add items back to restored collections
						if (x.restored) {
							restored.push(x.key);
						}
					}
					// If object shouldn't be retried, mark as processed
					if (x.processed || !x.retry) {
						processedKeys.push(x.key);
					}
					if (x.conflict) {
						conflictResults.push(x);
					}
				});
				remainingKeys = Zotero.Utilities.arrayDiff(remainingKeys, processedKeys);
				conflicts.push(...conflictResults);
			}.bind(this),
			{
				concurrency: 1
			}
		);
		
		// If any locally deleted collections were restored, either add them back to the collection
		// (if the items still exist) or remove them from the delete log and add them to the sync queue
		if (restored.length && objectType == 'collection') {
			await this._restoreRestoredCollectionItems(restored);
		}
		
		this._statusCheck();
		
		// If all requests were successful, such that we had a chance to see all keys, remove keys we
		// didn't see from the sync queue so they don't keep being retried forever
		if (!this.failed) {
			let missingKeys = keys.filter(key => objectData[key] === null);
			if (missingKeys.length) {
				Zotero.debug(`Removing ${missingKeys.length} missing `
					+ Zotero.Utilities.pluralize(missingKeys.length, [objectType, objectTypePlural])
					+ " from sync queue");
				await Zotero.Sync.Data.Local.removeObjectsFromSyncQueue(objectType, this.libraryID, missingKeys);
				remainingKeys = Zotero.Utilities.arrayDiff(remainingKeys, missingKeys);
			}
		}
		
		if (!remainingKeys.length || remainingKeys.length == lastLength) {
			// Add failed objects to sync queue
			let failedKeys = keys.filter(key => objectData[key]);
			if (failedKeys.length) {
				Zotero.debug(`Queueing ${failedKeys.length} failed `
					+ Zotero.Utilities.pluralize(failedKeys.length, [objectType, objectTypePlural])
					+ " for later", 2);
				await Zotero.Sync.Data.Local.addObjectsToSyncQueue(
					objectType, this.libraryID, failedKeys
				);
				
				// Note failed item keys so child items step (if this isn't it) can skip them
				if (objectType == 'item') {
					this.failedItems = failedKeys;
				}
			}
			else {
				Zotero.debug(`All ${objectTypePlural} for ${this.library.name} saved to database`);
				
				if (objectType == 'item') {
					this.failedItems = [];
				}
			}
			break;
		}
		
		lastLength = remainingKeys.length;
		
		Zotero.debug(`Retrying ${remainingKeys.length} remaining `
			+ Zotero.Utilities.pluralize(remainingKeys, [objectType, objectTypePlural]));
	}
	
	// Show conflict resolution window
	if (conflicts.length) {
		this._statusCheck();
		
		let results = await Zotero.Sync.Data.Local.processConflicts(
			objectType, this.libraryID, conflicts, this._getOptions()
		);
		let keys = results.filter(x => x.processed).map(x => x.key);
		// If all keys are unprocessed and didn't fail from an error, conflict resolution was cancelled
		if (results.every(x => !x.processed && !x.error)) {
			throw new Zotero.Sync.UserCancelledException();
		}
		await Zotero.Sync.Data.Local.removeObjectsFromSyncQueue(objectType, this.libraryID, keys);
	}
	
	return this.DOWNLOAD_RESULT_CONTINUE;
};


/**
 * If a collection is deleted locally but modified remotely between syncs, the local collection is
 * restored, but collection membership is a property of items, the local items that were previously
 * in that collection won't be any longer (or they might have been deleted along with the collection),
 * so we have to get the current collection items from the API and either add them back
 * (if they exist) or clear them from the delete log and mark them for download.
 *
 * Remote items in the trash aren't currently restored and will be removed from the collection when the
 * local collection-item removal syncs up.
 */
Zotero.Sync.Data.Engine.prototype._restoreRestoredCollectionItems = async function (collectionKeys) {
	for (let collectionKey of collectionKeys) {
		let { keys: itemKeys } = await this.apiClient.getKeys(
			this.library.libraryType,
			this.libraryTypeID,
			{
				target: `collections/${collectionKey}/items/top`,
				format: 'keys'
			}
		);
		
		if (itemKeys.length) {
			let collection = Zotero.Collections.getByLibraryAndKey(this.libraryID, collectionKey);
			let addToCollection = [];
			let addToQueue = [];
			for (let itemKey of itemKeys) {
				let o = Zotero.Items.getByLibraryAndKey(this.libraryID, itemKey);
				if (o) {
					addToCollection.push(o.id);
					// Remove item from trash if it's there, since it's not in the trash remotely.
					// (This would happen if items were moved to the trash along with the collection
					// deletion.)
					if (o.deleted) {
						o.deleted = false
						await o.saveTx();
					}
				}
				else {
					addToQueue.push(itemKey);
				}
			}
			if (addToCollection.length) {
				Zotero.debug(`Restoring ${addToCollection.length} `
					+ `${Zotero.Utilities.pluralize(addToCollection.length, ['item', 'items'])} `
					+ `to restored collection ${collection.libraryKey}`);
				await Zotero.DB.executeTransaction(function* () {
					yield collection.addItems(addToCollection);
				}.bind(this));
			}
			if (addToQueue.length) {
				Zotero.debug(`Restoring ${addToQueue.length} deleted `
					+ `${Zotero.Utilities.pluralize(addToQueue.length, ['item', 'items'])} `
					+ `in restored collection ${collection.libraryKey}`);
				await Zotero.Sync.Data.Local.removeObjectsFromDeleteLog(
					'item', this.libraryID, addToQueue
				);
				await Zotero.Sync.Data.Local.addObjectsToSyncQueue(
					'item', this.libraryID, addToQueue
				);
			}
		}
	}
};



/**
 * Get deleted objects from the API and process them
 *
 * @param {Integer} since - Last-known library version; get changes sinces this version
 * @param {Integer} [newLibraryVersion] - Newest library version seen in this sync process; if newer
 *     version is seen, restart the sync
 * @return {Object} - Object with 'result' (DOWNLOAD_RESULT_*) and 'libraryVersion'
 */
Zotero.Sync.Data.Engine.prototype._downloadDeletions = Zotero.Promise.coroutine(function* (since, newLibraryVersion) {
	const batchSize = 50;
	
	let results = yield this.apiClient.getDeleted(
		this.library.libraryType,
		this.libraryTypeID,
		since
	);
	if (newLibraryVersion && newLibraryVersion != results.libraryVersion) {
		return {
			result: this.DOWNLOAD_RESULT_RESTART,
			libraryVersion: results.libraryVersion
		};
	}
	
	var numObjects = Object.keys(results.deleted).reduce((n, k) => n + results.deleted[k].length, 0);
	if (!numObjects) {
		Zotero.debug("No objects deleted remotely since last check");
		return {
			result: this.DOWNLOAD_RESULT_CONTINUE,
			libraryVersion: results.libraryVersion
		};
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
				// If item is already in trash locally, just delete it
				if (obj.deleted) {
					Zotero.debug("Local item is in trash -- applying remote deletion");
					yield obj.eraseTx({
						skipDeleteLog: true
					});
					continue;
				}
				conflicts.push({
					libraryID: this.libraryID,
					left: obj.toJSON(),
					right: {
						deleted: true
					}
				});
			}
		}
		
		if (conflicts.length) {
			this._statusCheck();
			
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
			yield Zotero.Utilities.Internal.forEachChunkAsync(
				mergeData,
				batchSize,
				function (chunk) {
					return Zotero.DB.executeTransaction(function* () {
						for (let json of chunk) {
							let data = json.data;
							if (!data.deleted) continue;
							let obj = objectsClass.getByLibraryAndKey(this.libraryID, data.key);
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
			yield Zotero.Utilities.Internal.forEachChunkAsync(
				toDelete,
				batchSize,
				function (chunk) {
					return Zotero.DB.executeTransaction(function* () {
						for (let obj of chunk) {
							yield obj.erase({
								skipEditCheck: true,
								skipDeleteLog: true
							});
						}
					});
				}
			);
		}
	}
	
	return {
		result: this.DOWNLOAD_RESULT_CONTINUE,
		libraryVersion: results.libraryVersion
	};
});


/**
 * If something else modified the remote library while we were getting updates, wait for increasing
 * amounts of time before trying again, and then start from the beginning
 */
Zotero.Sync.Data.Engine.prototype._onLibraryVersionChange = Zotero.Promise.coroutine(function* (mode) {
	Zotero.logError("Library version changed since last download -- restarting sync");
	
	if (!this.downloadDelayGenerator) {
		this.downloadDelayGenerator = Zotero.Utilities.Internal.delayGenerator(
			Zotero.Sync.Data.conflictDelayIntervals, 60 * 60 * 1000
		);
	}
	
	let keepGoing = yield this.downloadDelayGenerator.next().value;
	if (!keepGoing) {
		throw new Error("Could not update " + this.library.name + " -- library in use");
	}
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
		return this._handleUploadError(e);
	}
	
	// Get unsynced local objects for each object type
	for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(this.libraryID)) {
		this._statusCheck();
		
		let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		
		// New/modified objects
		let ids = yield Zotero.Sync.Data.Local.getUnsynced(objectType, this.libraryID);
		
		// Skip objects in sync queue, because they might have unresolved conflicts.
		// The queue only has keys, so we have to convert to keys and back.
		let unsyncedKeys = ids.map(id => objectsClass.getLibraryAndKeyFromID(id).key);
		let origUnsynced = unsyncedKeys; // TEMP
		let queueKeys = yield Zotero.Sync.Data.Local.getObjectsFromSyncQueue(objectType, this.libraryID);
		let newUnsyncedKeys = Zotero.Utilities.arrayDiff(unsyncedKeys, queueKeys);
		if (newUnsyncedKeys.length < unsyncedKeys.length) {
			Zotero.debug(`Skipping ${unsyncedKeys.length - newUnsyncedKeys.length} key(s) in sync queue`);
			Zotero.debug(Zotero.Utilities.arrayDiff(unsyncedKeys, newUnsyncedKeys));
		}
		unsyncedKeys = newUnsyncedKeys;
		
		// TEMP
		//ids = unsyncedKeys.map(key => objectsClass.getIDFromLibraryAndKey(this.libraryID, key));
		let missing = [];
		ids = unsyncedKeys.map(key => {
			let id = objectsClass.getIDFromLibraryAndKey(this.libraryID, key)
			if (!id) {
				Zotero.debug("Missing id for key " + key);
				missing.push(key);
			}
			return id;
		});
		if (missing.length) {
			Zotero.debug("Missing " + objectTypePlural + ":");
			Zotero.debug(ids.filter(id => !id));
			Zotero.debug(ids.filter(id => !objectsClass.getLibraryAndKeyFromID(id)));
			Zotero.debug(missing);
		}
		
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
			this._statusCheck();
			
			libraryVersion = yield this._uploadObjects(
				objectType, objectIDs[objectType], libraryVersion
			);
		}
		
		Zotero.debug(JSON.stringify(objectDeletions));
		for (let objectType in objectDeletions) {
			this._statusCheck();
			
			libraryVersion = yield this._uploadDeletions(
				objectType, objectDeletions[objectType], libraryVersion
			);
		}
	}
	catch (e) {
		return this._handleUploadError(e);
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
	if (this.library.libraryVersion == this.library.storageVersion) {
		this.library.storageVersion = libraryVersion;
	}
	this.library.libraryVersion = libraryVersion;
	yield this.library.saveTx({
		skipNotifier: true
	});
	
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
	
	// Watch for objects that change locally during the sync, so that we don't overwrite them with the
	// older saved server version after uploading
	var changedObjects = new Set();
	var observerID = Zotero.Notifier.registerObserver(
		{
			notify: function (event, type, ids, extraData) {
				let keys = [];
				if (event == 'modify') {
					keys = ids.map(id => {
						var { libraryID, key } = objectsClass.getLibraryAndKeyFromID(id);
						return (libraryID == this.libraryID) ? key : false;
					});
				}
				else if (event == 'delete') {
					keys = ids.map(id => {
						if (!extraData[id]) return false;
						var { libraryID, key } = extraData[id];
						return (libraryID == this.libraryID) ? key : false;
					});
				}
				keys.filter(key => key).forEach(key => changedObjects.add(key));
			}.bind(this)
		},
		[objectType],
		objectTypePlural + "Upload"
	);
	
	try {
		while (queue.length) {
			this._statusCheck();
			
			// Get a slice of the queue and generate JSON for objects if necessary
			let batch = [];
			let numSkipped = 0;
			for (let i = 0; i < queue.length && i < this.uploadBatchSize; i++) {
				let o = queue[i];
				// Skip requests that failed with 4xx or that have been retried too many times
				if (o.failed || o.tries >= this.maxUploadTries) {
					numSkipped++;
					continue;
				}
				if (!o.json) {
					o.json = yield this._getJSONForObject(
						objectType,
						o.id,
						{
							restoreToServer: this._restoringToServer,
							// Only include storage properties ('mtime', 'md5') when restoring to
							// server and for WebDAV files
							skipStorageProperties:
								objectType == 'item'
									? !this._restoringToServer
										&& Zotero.Sync.Storage.Local.getModeForLibrary(this.library.libraryID) != 'webdav'
									: undefined
						}
					);
				}
				batch.push(o);
			}
			
			// No more non-failed requests
			if (!batch.length) {
				Zotero.debug(`No more ${objectTypePlural} to upload`);
				break;
			}
			
			// Remove selected and skipped objects from queue
			queue.splice(0, batch.length + numSkipped);
			
			let jsonBatch = batch.map(o => o.json);
			
			Zotero.debug("UPLOAD BATCH:");
			Zotero.debug(jsonBatch);
			
			let results;
			let numSuccessful = 0;
			({ libraryVersion, results } = yield this.apiClient.uploadObjects(
				this.library.libraryType,
				this.libraryTypeID,
				"POST",
				libraryVersion,
				objectType,
				jsonBatch
			));
			
			// Mark successful and unchanged objects as synced with new version,
			// and save uploaded JSON to cache
			let updateVersionIDs = [];
			let updateSyncedIDs = [];
			let toSave = [];
			let toCache = [];
			for (let state of ['successful', 'unchanged']) {
				for (let index in results[state]) {
					let current = results[state][index];
					// 'successful' includes objects, not keys
					let key = state == 'successful' ? current.key : current;
					let changed = changedObjects.has(key);
					
					if (key != jsonBatch[index].key) {
						throw new Error("Key mismatch (" + key + " != " + jsonBatch[index].key + ")");
					}
					
					let obj = objectsClass.getByLibraryAndKey(this.libraryID, key);
					// This might not exist if the object was deleted during the upload
					if (obj) {
						updateVersionIDs.push(obj.id);
						if (!changed) {
							updateSyncedIDs.push(obj.id);
						}
					}
					
					if (state == 'successful') {
						// Update local object with saved data if necessary, as long as it hasn't
						// changed locally since the upload
						if (!changed) {
							obj.fromJSON(current.data, { strict: true });
							toSave.push(obj);
						}
						else {
							Zotero.debug("Local version changed during upload "
								+ "-- not updating from remotely saved version");
						}
						toCache.push(current);
					}
					else {
						// This won't necessarily reflect the actual version of the object on the server,
						// since objects are uploaded in batches and we only get the final version, but it
						// will guarantee that the item won't be redownloaded unnecessarily in the case of
						// a full sync, because the version will be higher than whatever version is on the
						// server.
						jsonBatch[index].version = libraryVersion;
						toCache.push(jsonBatch[index]);
					}
					
					numSuccessful++;
					// Remove from batch to mark as successful
					delete batch[index];
					delete jsonBatch[index];
				}
			}
			yield Zotero.Sync.Data.Local.saveCacheObjects(
				objectType, this.libraryID, toCache
			);
			yield Zotero.DB.executeTransaction(function* () {
				for (let i = 0; i < toSave.length; i++) {
					yield toSave[i].save({
						skipSelect: true,
						skipSyncedUpdate: true,
						// We want to minimize the times when server writes actually result in local
						// updates, but when they do, don't update the user-visible timestamp
						skipDateModifiedUpdate: true
					});
				}
				if (this.library.libraryVersion == this.library.storageVersion) {
					this.library.storageVersion = libraryVersion;
				}
				this.library.libraryVersion = libraryVersion;
				yield this.library.save();
				objectsClass.updateVersion(updateVersionIDs, libraryVersion);
				objectsClass.updateSynced(updateSyncedIDs, true);
			}.bind(this));
			
			// Purge older objects in sync cache
			if (toSave.length) {
				yield Zotero.Sync.Data.Local.purgeCache(objectType, this.libraryID);
			}
			
			// Handle failed objects
			for (let index in results.failed) {
				let { code, message, data } = results.failed[index];
				let key = jsonBatch[index].key;
				// API errors are HTML
				message = Zotero.Utilities.unescapeHTML(message);
				let e = new Error(message);
				e.name = "ZoteroObjectUploadError";
				e.code = code;
				if (data) {
					e.data = data;
				}
				e.objectType = objectType;
				e.object = objectsClass.getByLibraryAndKey(this.libraryID, key);
				
				Zotero.logError(`Error ${code} for ${objectType} ${key} in `
					+ this.library.name + ":\n\n" + e);
				
				let keepGoing = yield this._checkObjectUploadError(objectType, key, e, queue, batch);
				if (keepGoing) {
					numSuccessful++;
					continue;
				}
				
				if (this.onError) {
					this.onError(e);
				}
				if (this.stopOnError) {
					throw e;
				}
				batch[index].tries++;
				// Mark 400 errors as permanently failed
				if (e.code < 500) {
					batch[index].failed = true;
				}
				// 500 errors should stay in queue and be retried, unless a dependency also failed
				else if (objectType == 'item') {
					// Check parent item
					let parentItem = batch[index].json.parentItem;
					if (parentItem) {
						for (let i in batch) {
							if (i == index) break;
							let o = batch[i];
							if (o.failed && o.json.key) {
								Zotero.debug(`Not retrying child of failed parent ${parentItem}`);
								batch[index].failed = true;
							}
						}
					}
				}
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
	}
	finally {
		Zotero.Notifier.unregisterObserver(observerID);
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
		if (this.library.libraryVersion == this.library.storageVersion) {
			this.library.storageVersion = libraryVersion;
		}
		this.library.libraryVersion = libraryVersion;
		yield this.library.saveTx({
			skipNotifier: true
		});
		
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
		var patchBase = false;
		// If restoring to server, use full mode. (The version and cache are cleared, so we would
		// use "new" otherwise, which might be slightly different.)
		if (options.restoreToServer) {
			var mode = 'full';
		}
		// If copy of object in cache, use patch mode with cache data as the base
		else if (cacheObj) {
			var mode = 'patch';
			patchBase = cacheObj.data;
		}
		// Otherwise use full mode if there's a version
		else {
			var mode = obj.version ? "full" : "new";
		}
		return obj.toJSON({
			mode,
			includeKey: true,
			includeVersion: !options.restoreToServer,
			includeDate: true,
			// Whether to skip 'mtime' and 'md5'
			skipStorageProperties: options.skipStorageProperties,
			// Use last-synced mtime/md5 instead of current values from the file itself
			syncedStorageProperties: true,
			patchBase
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
				let keepGoing = yield gen.next().value;
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
	
	loop:
	while (true) {
		this._statusCheck();
		
		// Reprocess all deletions available from API
		let results = yield this._downloadDeletions(0);
		lastLibraryVersion = results.libraryVersion;
		
		// Get synced settings
		results = yield this._downloadSettings(0, lastLibraryVersion);
		if (results.result == this.DOWNLOAD_RESULT_RESTART) {
			yield this._onLibraryVersionChange();
			continue loop;
		}
		else {
			lastLibraryVersion = results.libraryVersion;
		}
		
		// Get object types
		for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(this.libraryID)) {
			this._statusCheck();
			
			let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
			let ObjectType = Zotero.Utilities.capitalize(objectType);
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
			
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
			if (lastLibraryVersion != results.libraryVersion) {
				yield this._onLibraryVersionChange();
				continue loop;
			}
			
			let toDownload = [];
			let localVersions = yield objectsClass.getObjectVersions(this.libraryID);
			// Queue objects that are out of date or don't exist locally
			for (let key in results.versions) {
				let version = results.versions[key];
				let obj = objectsClass.getByLibraryAndKey(this.libraryID, key);
				// If object is already at or above latest version, skip. Local version can be
				// higher because, as explained in _uploadObjects(), we upload items in batches
				// and only get the last version to record in the database.
				let localVersion = localVersions[key];
				if (localVersion && localVersion >= version) {
					continue;
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
			
			// Mark local objects that don't exist remotely as unsynced and version 0
			let allKeys = yield objectsClass.getAllKeys(this.libraryID);
			let remoteMissing = Zotero.Utilities.arrayDiff(allKeys, Object.keys(results.versions));
			if (remoteMissing.length) {
				Zotero.debug("Checking remotely missing " + objectTypePlural);
				Zotero.debug(remoteMissing);
				
				let toUpload = remoteMissing.map(
					key => objectsClass.getIDFromLibraryAndKey(this.libraryID, key)
				// Remove any objects deleted since getAllKeys() call
				).filter(id => id);
				
				// For remotely missing objects that exist locally, reset version, since old
				// version will no longer match remote, and mark for upload
				if (toUpload.length) {
					Zotero.debug(`Marking remotely missing ${objectTypePlural} as unsynced`);
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
	
	this.library.libraryVersion = lastLibraryVersion;
	yield this.library.saveTx();
	
	Zotero.debug("Done with full sync for " + this.library.name);
	
	return lastLibraryVersion;
});


Zotero.Sync.Data.Engine.prototype._restoreToServer = async function () {
	Zotero.debug("Performing a restore-to-server for " + this.library.name);
	
	var libraryVersion;
	
	// Flag engine as restore-to-server mode so it uses library version only
	this._restoringToServer = true;
	
	await Zotero.DB.executeTransaction(function* () {
		yield Zotero.Sync.Data.Local.clearCacheForLibrary(this.libraryID);
		yield Zotero.Sync.Data.Local.clearQueueForLibrary(this.libraryID);
		yield Zotero.Sync.Data.Local.clearDeleteLogForLibrary(this.libraryID);
		
		// Mark all local settings as unsynced
		yield Zotero.SyncedSettings.markAllAsUnsynced(this.libraryID);
		
		// Mark all objects as unsynced
		for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(this.libraryID)) {
			let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
			// Reset version on all objects and mark as unsynced
			let ids = yield objectsClass.getAllIDs(this.libraryID)
			yield objectsClass.updateVersion(ids, 0);
			yield objectsClass.updateSynced(ids, false);
		}
	}.bind(this));
	
	var remoteUpdatedError = "Online library updated since restore began";
	
	for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(this.libraryID)) {
		this._statusCheck();
		
		let objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		let ObjectType = Zotero.Utilities.capitalize(objectType);
		let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		
		// Get all object versions from the API
		let results = await this.apiClient.getVersions(
			this.library.libraryType,
			this.libraryTypeID,
			objectType
		);
		if (libraryVersion && libraryVersion != results.libraryVersion) {
			throw new Error(remoteUpdatedError
				+ ` (${libraryVersion} != ${results.libraryVersion})`);
		}
		libraryVersion = results.libraryVersion;
		
		// Filter to objects that don't exist locally and delete those objects remotely
		let remoteKeys = Object.keys(results.versions);
		let locallyMissingKeys = remoteKeys.filter((key) => {
			return !objectsClass.getIDFromLibraryAndKey(this.libraryID, key);
		});
		if (locallyMissingKeys.length) {
			Zotero.debug(`Deleting remote ${objectTypePlural} that don't exist locally`);
			try {
				libraryVersion = await this._uploadDeletions(
					objectType, locallyMissingKeys, libraryVersion
				);
			}
			catch (e) {
				if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
					// Let's just hope this doesn't happen
					if (e.status == 412) {
						throw new Error(remoteUpdatedError);
					}
				}
				throw e;
			}
		}
		else {
			Zotero.debug(`No remote ${objectTypePlural} that don't exist locally`);
		}
	}
	
	this.library.libraryVersion = libraryVersion;
	await this.library.saveTx();
	
	// Upload the local data, which has all been marked as unsynced. We could just fall through to
	// the normal _startUpload() in start(), but we don't want to accidentally restart and
	// start downloading data if there's an error condition, so it's safer to call it explicitly
	// here.
	var uploadResult;
	try {
		uploadResult = await this._startUpload();
	}
	catch (e) {
		if (e instanceof Zotero.Sync.UserCancelledException) {
			throw e;
		}
		Zotero.logError("Restore-to-server failed for " + this.library.name);
		throw e;
	}
	
	Zotero.debug("Upload result is " + uploadResult, 4);
	
	switch (uploadResult) {
	case this.UPLOAD_RESULT_SUCCESS:
	case this.UPLOAD_RESULT_NOTHING_TO_UPLOAD:
		// Force all files to be checked for upload. If an attachment's hash was changed, it will
		// no longer have an associated file, and then upload check will cause a file to be
		// uploaded (or, more likely if this is a restoration from a backup, reassociated with
		// another existing file). If the attachment's hash wasn't changed, it should already
		// have the correct file.
		await Zotero.Sync.Storage.Local.resetAllSyncStates(this.libraryID);
		
		Zotero.debug("Restore-to-server completed");
		break;
	
	case this.UPLOAD_RESULT_LIBRARY_CONFLICT:
		throw new Error(remoteUpdatedError);
	
	case this.UPLOAD_RESULT_RESTART:
		return this._restoreToServer()
	
	case this.UPLOAD_RESULT_CANCEL:
		throw new Zotero.Sync.UserCancelledException;
	
	default:
		throw new Error("Restore-to-server failed for " + this.library.name);
	}
	
	this._restoringToServer = false;
};


Zotero.Sync.Data.Engine.prototype._getOptions = function (additionalOpts = {}) {
	var options = {};
	this.optionNames.forEach(x => options[x] = this[x]);
	for (let opt in additionalOpts) {
		options[opt] = additionalOpts[opt];
	}
	return options;
}


Zotero.Sync.Data.Engine.prototype._handleUploadError = Zotero.Promise.coroutine(function* (e) {
	if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
		switch (e.status) {
		// This should only happen if library permissions were changed between the group check at
		// sync start and now, or to people who upgraded from <5.0-beta.r25+66ca2cf with unsynced local
		// changes.
		case 403:
			let index = Zotero.Sync.Data.Utilities.showWriteAccessLostPrompt(null, this.library);
			if (index === 0) {
				yield Zotero.Sync.Data.Local.resetUnsyncedLibraryData(this.libraryID);
				return this.UPLOAD_RESULT_RESTART;
			}
			if (index == 1) {
				return this.UPLOAD_RESULT_CANCEL;
			}
			throw new Error(`Unexpected index value ${index}`);
		
		case 409: // TEMP: from classic sync
		case 412:
			return this.UPLOAD_RESULT_LIBRARY_CONFLICT;
		}
	}
	else if (e.name == "ZoteroObjectUploadError") {
		switch (e.code) {
		case 404:
		case 412:
			return this.UPLOAD_RESULT_OBJECT_CONFLICT;
		}
	}
	else if (e.name == "ZoteroUploadRestartError") {
		return this.UPLOAD_RESULT_RESTART;
	}
	else if (e.name == "ZoteroUploadCancelError") {
		return this.UPLOAD_RESULT_CANCEL;
	}
	throw e;
});


Zotero.Sync.Data.Engine.prototype._checkObjectUploadError = Zotero.Promise.coroutine(function* (objectType, key, e, queue, batch) {
	var { code, data, message } = e;
	
	// If an item's dependency is missing remotely and it isn't in the queue (which
	// shouldn't happen), mark it as unsynced
	if (code == 400 || code == 409) {
		if (data) {
			if (objectType == 'collection' && code == 409) {
				if (data.collection) {
					let collection = Zotero.Collections.getByLibraryAndKey(this.libraryID, data.collection);
					if (!collection) {
						throw new Error(`Collection ${this.libraryID}/${key} `
							+ `references parent collection ${data.collection}, which doesn't exist`);
					}
					Zotero.logError(`Marking collection ${data.collection} as unsynced`);
					yield Zotero.Sync.Data.Local.markObjectAsUnsynced(collection);
				}
			}
			else if (objectType == 'item') {
				if (data.collection) {
					let collection = Zotero.Collections.getByLibraryAndKey(this.libraryID, data.collection);
					if (!collection) {
						throw new Error(`Item ${this.libraryID}/${key} `
							+ `references collection ${data.collection}, which doesn't exist`);
					}
					Zotero.logError(`Marking collection ${data.collection} as unsynced`);
					yield Zotero.Sync.Data.Local.markObjectAsUnsynced(collection);
				}
				else if (data.parentItem) {
					let parentItem = Zotero.Items.getByLibraryAndKey(this.libraryID, data.parentItem);
					if (!parentItem) {
						throw new Error(`Item ${this.libraryID}/${key} references parent `
							+ `item ${data.parentItem}, which doesn't exist`);
					}
					
					let id = parentItem.id;
					// If parent item isn't already in queue, mark it as unsynced and add it
					if (!queue.find(o => o.id == id)
							// TODO: Don't use 'delete' on batch, which results in undefineds
							&& !batch.find(o => o && o.id == id)) {
						yield Zotero.Sync.Data.Local.markObjectAsUnsynced(parentItem);
						Zotero.logError(`Adding parent item ${data.parentItem} to upload queue`);
						queue.push({
							id,
							json: null,
							tries: 0,
							failed: false
						});
						// Pretend that we were successful so syncing continues
						return true;
					}
				}
			}
		}
	}
	else if (code == 403) {
		// If we get a 403 for a local group attachment, check the group permissions to confirm
		// that we no longer have file-editing access and prompt to reset local group files
		if (objectType == 'item') {
			let item = Zotero.Items.getByLibraryAndKey(this.libraryID, key);
			if (this.library.libraryType == 'group' && item.isFileAttachment()) {
				let reset = false;
				let groupID = Zotero.Groups.getGroupIDFromLibraryID(this.libraryID);
				let info = yield this.apiClient.getGroup(groupID);
				if (info) {
					Zotero.debug(info);
					let { editable, filesEditable } = Zotero.Groups.getPermissionsFromJSON(
						info.data, this.userID
					);
					// If we do still have file-editing access, something else went wrong,
					// and we should just fail without resetting
					if (!filesEditable) {
						let index = Zotero.Sync.Storage.Utilities.showFileWriteAccessLostPrompt(
							null, this.library
						);
						
						let e = new Error(message);
						if (index === 0) {
							let group = Zotero.Groups.get(groupID);
							group.filesEditable = false;
							yield group.saveTx();
							
							yield Zotero.Sync.Data.Local.resetUnsyncedLibraryFiles(this.libraryID);
							e.name = "ZoteroUploadRestartError";
						}
						else {
							e.name = "ZoteroUploadCancelError";
						}
						throw e;
					}
				}
				else {
					Zotero.logError("Couldn't get metadata for group " + groupID);
				}
			}
		}
	}
	// This shouldn't happen, because the upload request includes a library version and should
	// prevent an outdated upload before the object version is checked. If it does, we need to
	// do a full sync. This error is checked in handleUploadError().
	else if (code == 404 || code == 412) {
		throw e;
	}
	
	return false;
});


Zotero.Sync.Data.Engine.prototype._statusCheck = function () {
	this._stopCheck();
	this._failedCheck();
}


Zotero.Sync.Data.Engine.prototype._stopCheck = function () {
	if (!this._stopping) return;
	Zotero.debug("Sync stopped for " + this.library.name);
	throw new Zotero.Sync.UserCancelledException;
}


Zotero.Sync.Data.Engine.prototype._failedCheck = function () {
	if (this.stopOnError && this.failed) {
		Zotero.logError("Stopping on error");
		throw this.failed;
	}
};
