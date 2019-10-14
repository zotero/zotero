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
 * @param {Integer} options.libraryID
 * @param {Object} options.controller - Storage controller instance (ZFS_Controller/WebDAV_Controller)
 * @param {Function} [onProgress] - Function to run when a request finishes: f(progress, progressMax)
 * @param {Function} [onError] - Function to run on error
 * @param {Boolean} [stopOnError]
 */
Zotero.Sync.Storage.Engine = function (options) {
	if (options.libraryID == undefined) {
		throw new Error("options.libraryID not set");
	}
	if (options.controller == undefined) {
		throw new Error("options.controller not set");
	}
	
	this.background = options.background;
	this.firstInSession = options.firstInSession;
	this.lastFullFileCheck = options.lastFullFileCheck;
	this.libraryID = options.libraryID;
	this.library = Zotero.Libraries.get(options.libraryID);
	this.controller = options.controller;
	
	this.numRequests = 0;
	this.requestsRemaining = 0;
	
	this.local = Zotero.Sync.Storage.Local;
	this.utils = Zotero.Sync.Storage.Utilities;
	
	this.setStatus = options.setStatus || function () {};
	this.onError = options.onError || function (e) {};
	this.onProgress = options.onProgress || function (progress, progressMax) {};
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
	if (!Zotero.Sync.Storage.Local.getEnabledForLibrary(libraryID)) {
		Zotero.debug("File sync is not enabled for " + this.library.name);
		return false;
	}
	
	Zotero.debug("Starting file sync for " + this.library.name);
	
	if (!this.controller.verified) {
		Zotero.debug(`${this.controller.name} file sync is not active -- verifying`);
		
		try {
			yield this.controller.checkServer();
		}
		catch (e) {
			let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			   .getService(Components.interfaces.nsIWindowMediator);
			let lastWin = wm.getMostRecentWindow("navigator:browser");
			
			let success = yield this.controller.handleVerificationError(e, lastWin, true);
			if (!success) {
				Zotero.debug(this.controller.name + " verification failed", 2);
				
				throw new Zotero.Error(
					Zotero.getString('sync.storage.error.verificationFailed', this.controller.name),
					0,
					{
						dialogButtonText: Zotero.getString('sync.openSyncPreferences'),
						dialogButtonCallback: function () {
							let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
									   .getService(Components.interfaces.nsIWindowMediator);
							let lastWin = wm.getMostRecentWindow("navigator:browser");
							lastWin.ZoteroPane.openPreferences('zotero-prefpane-sync');
						}
					}
				);
			}
		}
	}
	
	if (this.controller.cacheCredentials) {
		yield this.controller.cacheCredentials();
	}
	
	var lastSyncTime = null;
	var downloadAll = this.local.downloadOnSync(libraryID);
	//
	// TODO: If files are persistently missing, don't try to download them each time
	
	var filesEditable = Zotero.Libraries.get(libraryID).filesEditable;
	this.requestsRemaining = 0;
	
	// Clear over-quota flag on manual sync
	if (!this.background && Zotero.Sync.Storage.Local.storageRemainingForLibrary.has(libraryID)) {
		Zotero.debug("Clearing over-quota flag for " + this.library.name);
		Zotero.Sync.Storage.Local.storageRemainingForLibrary.delete(libraryID)
	}
	
	// Check for updated files to upload
	if (!filesEditable) {
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
	
	// If we don't have any forced downloads, we can skip downloads if no storage metadata has
	// changed (meaning nothing else has uploaded files since the last successful file sync)
	if (downloadAll && !downloadForced) {
		if (this.library.storageVersion == this.library.libraryVersion) {
			Zotero.debug("No remote storage changes for " + this.library.name
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
	if (filesEditable) {
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
	var downloadSuccessful = false;
	var changes = new Zotero.Sync.Storage.Result;
	for (let type of ['download', 'upload']) {
		let results = yield promises[type];
		let succeeded = 0;
		let failed = 0;
		
		for (let p of results) {
			if (p.isFulfilled()) {
				succeeded++;
			}
			else if (!p.isPending()) {
				let e = p.reason();
				if (e instanceof Zotero.HTTP.CancelledException) {
					Zotero.debug(`File ${type} sync cancelled for ${this.library.name} `
						+ `(${succeeded} succeeded, ${failed} failed)`);
					throw new Zotero.Sync.UserCancelledException();
				}
				if (this.stopOnError) {
					Zotero.debug(`File ${type} sync failed for ${this.library.name}`);
					throw e;
				}
				failed++;
			}
		}
		
		Zotero.debug(`File ${type} sync finished for ${this.library.name} `
			+ `(${succeeded} succeeded, ${failed} failed)`);
		
		changes.updateFromResults(results.filter(p => p.isFulfilled()).map(p => p.value()));
		
		if (type == 'download'
				// Not stopped
				&& this.requestsRemaining == 0
				// No errors
				&& results.every(p => !p.isRejected())) {
			downloadSuccessful = true;
		}
	}
	
	if (downloadSuccessful) {
		this.library.storageDownloadNeeded = false;
		this.library.storageVersion = this.library.libraryVersion;
		yield this.library.saveTx();
	}
	
	// For ZFS, this purges all files on server based on flag set when switching from ZFS
	// to WebDAV in prefs. For WebDAV, this purges locally deleted files on server.
	try {
		yield this.controller.purgeDeletedStorageFiles(libraryID);
	}
	catch (e) {
		Zotero.logError(e);
	}
	
	// If WebDAV sync, purge orphaned files
	if (downloadSuccessful && this.controller.mode == 'webdav') {
		try {
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
	Zotero.debug("Stopping file sync for " + this.library.name);
	for (let type in this.queues) {
		this.queues[type].stop();
	}
}

Zotero.Sync.Storage.Engine.prototype.queueItem = Zotero.Promise.coroutine(function* (item) {
	switch (item.attachmentSyncState) {
		case Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD:
		case Zotero.Sync.Storage.Local.SYNC_STATE_FORCE_DOWNLOAD:
			var type = 'download';
			var fn = 'downloadFile';
			break;
		
		case Zotero.Sync.Storage.Local.SYNC_STATE_TO_UPLOAD:
		case Zotero.Sync.Storage.Local.SYNC_STATE_FORCE_UPLOAD:
			var type = 'upload';
			var fn = 'uploadFile';
			break;
		
		case false:
			Zotero.debug("Sync state for item " + item.id + " not found", 2);
			return;
		
		default:
			throw new Error("Invalid sync state " + item.attachmentSyncState);
	}
	
	if (type == 'upload') {
		if (!(yield item.fileExists())) {
			Zotero.debug("File " + item.libraryKey + " not yet available to upload -- skipping");
			return;
		}
	}
	this.queues[type].add(() => {
		var request = new Zotero.Sync.Storage.Request({
			type,
			libraryID: this.libraryID,
			name: item.libraryKey,
			onStart: request => this.controller[fn](request),
			onStop: () => {
				this.requestsRemaining--;
				this.onProgress(this.numRequests - this.requestsRemaining, this.numRequests);
			}
		});
		return request.start();
	});
	this.numRequests++;
	this.requestsRemaining++;
})
