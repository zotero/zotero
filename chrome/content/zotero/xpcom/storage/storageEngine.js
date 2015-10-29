/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2015 Center for History and New Media
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


if (!Zotero.Sync.Storage) {
	Zotero.Sync.Storage = {};
}

/**
 * An Engine manages file sync processes for a given library
 *
 * @param {Object} options
 * @param {Zotero.Sync.APIClient} options.apiClient
 * @param {Integer} options.libraryID
 * @param {Function} [onError] - Function to run on error
 * @param {Boolean} [stopOnError]
 */
Zotero.Sync.Storage.Engine = function (options) {
	if (options.apiClient == undefined) {
		throw new Error("options.apiClient not set");
	}
	if (options.libraryID == undefined) {
		throw new Error("options.libraryID not set");
	}
	
	this.apiClient = options.apiClient;
	this.background = options.background;
	this.firstInSession = options.firstInSession;
	this.lastFullFileCheck = options.lastFullFileCheck;
	this.libraryID = options.libraryID;
	this.library = Zotero.Libraries.get(options.libraryID);
	
	this.local = Zotero.Sync.Storage.Local;
	this.utils = Zotero.Sync.Storage.Utilities;
	this.mode = this.local.getModeForLibrary(this.libraryID);
	var modeClass = this.utils.getClassForMode(this.mode);
	this.controller = new modeClass(options);
	this.setStatus = options.setStatus || function () {};
	this.onError = options.onError || function (e) {};
	this.stopOnError = options.stopOnError || false;
	
	this.queues = [];
	['download', 'upload'].forEach(function (type) {
		this.queues[type] = new ConcurrentCaller({
			id: `${this.libraryID}/${type}`,
			numConcurrent: Zotero.Prefs.get(
				'sync.storage.max' + Zotero.Utilities.capitalize(type) + 's'
			),
			onError: this.onError,
			stopOnError: this.stopOnError,
			logger: Zotero.debug
		});
	}.bind(this))
	
	this.maxCheckAge = 10800; // maximum age in seconds for upload modification check (3 hours)
}

Zotero.Sync.Storage.Engine.prototype.start = Zotero.Promise.coroutine(function* () {
	var libraryID = this.libraryID;
	if (!Zotero.Prefs.get("sync.storage.enabled")) {
		Zotero.debug("File sync is not enabled for " + this.library.name);
		return false;
	}
	
	Zotero.debug("Starting file sync for " + this.library.name);
	
	if (!this.controller.verified) {
		Zotero.debug(`${this.mode} file sync is not active`);
		
		throw new Error("Storage mode verification not implemented");
		
		// TODO: Check server
	}
	if (this.controller.cacheCredentials) {
		yield this.controller.cacheCredentials();
	}
	
	// Get library last-sync time for download-on-sync libraries.
	var lastSyncTime = null;
	var downloadAll = this.local.downloadOnSync(libraryID);
	if (downloadAll) {
		lastSyncTime = yield this.controller.getLastSyncTime(libraryID);
	}
	
	// Check for updated files to upload
	if (!Zotero.Libraries.isFilesEditable(libraryID)) {
		Zotero.debug("No file editing access -- skipping file modification check for "
			+ this.library.name);
	}
	// If this is a background sync, it's not the first sync of the session, the library has had
	// at least one full check this session, and it's been less than maxCheckAge since the last
	// full check of this library, check only files that were previously modified or opened
	// recently
	else if (this.background
			&& !this.firstInSession
			&& this.local.lastFullFileCheck[libraryID]
			&& (this.local.lastFullFileCheck[libraryID]
				+ (this.maxCheckAge * 1000)) > new Date().getTime()) {
		let itemIDs = this.local.getFilesToCheck(libraryID, this.maxCheckAge);
		yield this.local.checkForUpdatedFiles(libraryID, itemIDs);
	}
	// Otherwise check all files in library
	else {
		this.local.lastFullFileCheck[libraryID] = new Date().getTime();
		yield this.local.checkForUpdatedFiles(libraryID);
	}
	
	yield this.local.resolveConflicts(libraryID);
	
	var downloadForced = yield this.local.checkForForcedDownloads(libraryID);
	
	// If we don't have any forced downloads, we can skip downloads if the last sync time hasn't
	// changed or doesn't exist on the server (meaning there are no files)
	if (downloadAll && !downloadForced) {
		if (lastSyncTime) {
			if (this.library.lastStorageSync == lastSyncTime) {
				Zotero.debug("Last " + this.mode.toUpperCase() + " sync id hasn't changed for "
					+ this.library.name + " -- skipping file downloads");
				downloadAll = false;
			}
		}
		else {
			Zotero.debug(`No last ${this.mode} sync time for ${this.library.name}`
				+ " -- skipping file downloads");
			downloadAll = false;
		}
	}
	
	// Get files to download
	if (downloadAll || downloadForced) {
		let itemIDs = yield this.local.getFilesToDownload(libraryID, !downloadAll);
		if (itemIDs.length) {
			Zotero.debug(itemIDs.length + " file" + (itemIDs.length == 1 ? '' : 's') + " to "
				+ "download for " + this.library.name);
			for (let itemID of itemIDs) {
				let item = yield Zotero.Items.getAsync(itemID);
				yield this.queueItem(item);
			}
		}
		else {
			Zotero.debug("No files to download for " + this.library.name);
		}
	}
	
	// Get files to upload
	if (Zotero.Libraries.isFilesEditable(libraryID)) {
		let itemIDs = yield this.local.getFilesToUpload(libraryID);
		if (itemIDs.length) {
			Zotero.debug(itemIDs.length + " file" + (itemIDs.length == 1 ? '' : 's') + " to "
				+ "upload for " + this.library.name);
			for (let itemID of itemIDs) {
				let item = yield Zotero.Items.getAsync(itemID, { noCache: true });
				yield this.queueItem(item);
			}
		}
		else {
			Zotero.debug("No files to upload for " + this.library.name);
		}
	}
	else {
		Zotero.debug("No file editing access -- skipping file uploads for " + this.library.name);
	}
	
	var promises = {
		download: this.queues.download.runAll(),
		upload: this.queues.upload.runAll()
	}
	
	// Process the results
	var changes = new Zotero.Sync.Storage.Result;
	for (let type of ['download', 'upload']) {
		let results = yield promises[type];
		
		if (this.stopOnError) {
			for (let p of results) {
				if (p.isRejected()) {
					let e = p.reason();
					Zotero.debug(`File ${type} sync failed for ${this.library.name}`);
					throw e;
				}
			}
		}
		
		Zotero.debug(`File ${type} sync finished for ${this.library.name}`);
		
		changes.updateFromResults(results.filter(p => p.isFulfilled()).map(p => p.value()));
	}
	
	// If files were uploaded, update the remote last-sync time
	if (changes.remoteChanges) {
		lastSyncTime = yield this.controller.setLastSyncTime(libraryID);
		if (!lastSyncTime) {
			throw new Error("Last sync time not set after sync");
		}
	}
	
	// If there's a remote last-sync time from either the check before downloads or when it
	// was changed after uploads, store that locally so we know we can skip download checks
	// next time
	if (lastSyncTime) {
		this.library.lastStorageSync = lastSyncTime;
		yield this.library.saveTx();
	}
	
	// If WebDAV sync, purge deleted and orphaned files
	if (this.mode == 'webdav') {
		try {
			yield this.controller.purgeDeletedStorageFiles(libraryID);
			yield this.controller.purgeOrphanedStorageFiles(libraryID);
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	if (!changes.localChanges) {
		Zotero.debug("No local changes made during file sync");
	}
	
	Zotero.debug("Done with file sync for " + this.library.name);
	
	return changes;
})


Zotero.Sync.Storage.Engine.prototype.stop = function () {
	for (let type in this.queues) {
		this.queues[type].stop();
	}
}

Zotero.Sync.Storage.Engine.prototype.queueItem = Zotero.Promise.coroutine(function* (item) {
	switch (yield this.local.getSyncState(item.id)) {
		case Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD:
		case Zotero.Sync.Storage.SYNC_STATE_FORCE_DOWNLOAD:
			var type = 'download';
			var onStart = Zotero.Promise.method(function (request) {
				return this.controller.downloadFile(request);
			}.bind(this));
			break;
		
		case Zotero.Sync.Storage.SYNC_STATE_TO_UPLOAD:
		case Zotero.Sync.Storage.SYNC_STATE_FORCE_UPLOAD:
			var type = 'upload';
			var onStart = Zotero.Promise.method(function (request) {
				return this.controller.uploadFile(request);
			}.bind(this));
			break;
		
		case false:
			Zotero.debug("Sync state for item " + item.id + " not found", 2);
			return;
		
		default:
			throw new Error("Invalid sync state " + (yield this.local.getSyncState(item.id)));
	}
	
	var request = new Zotero.Sync.Storage.Request({
		type,
		libraryID: this.libraryID,
		name: item.libraryKey,
		onStart,
		onProgress: this.onProgress
	});
	if (type == 'upload') {
		try {
			request.setMaxSize(yield Zotero.Attachments.getTotalFileSize(item));
		}
		// If this fails, ignore it, though we might fail later
		catch (e) {
			// But if the file doesn't exist yet, don't try to upload it
			//
			// This isn't a perfect test, because the file could still be in the process of being
			// downloaded (e.g., from the web). It'd be better to download files to a temp
			// directory and move them into place.
			if (!(yield item.getFilePathAsync())) {
				Zotero.debug("File " + item.libraryKey + " not yet available to upload -- skipping");
				return;
			}
			
			Zotero.logError(e);
		}
	}
	this.queues[type].add(request.start.bind(request));
})
