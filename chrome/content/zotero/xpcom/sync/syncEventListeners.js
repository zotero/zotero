"use strict";

Zotero.Sync.EventListeners = {
	/**
	 * Start all listeners
	 */
	init: function () {
		for (let i in this) {
			if (i.indexOf('Listener') != -1) {
				if (this[i].init) {
					this[i].init();
				}
			}
		}
	}
};


/**
 * Notifier observer to add deleted objects to syncDeleteLog/storageDeleteLog
 * plus related methods
 */
Zotero.Sync.EventListeners.ChangeListener = new function () {
	this.init = function () {
		// Initialize delete log listener
		// TODO: Support clearing of full-text for an item?
		Zotero.Notifier.registerObserver(
			this, ['collection', 'item', 'search', 'setting'], 'deleteLog'
		);
	}
	
	this.notify = Zotero.Promise.method(function (event, type, ids, extraData) {
		var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(type);
		if (!syncObjectTypeID) {
			return;
		}
		
		if (event != 'delete') {
			return;
		}
		
		var syncSQL = "REPLACE INTO syncDeleteLog (syncObjectTypeID, libraryID, key) VALUES ";
		var storageSQL = "REPLACE INTO storageDeleteLog (libraryID, key) VALUES ";
		
		var storageForLibrary = {};
		
		return Zotero.Utilities.Internal.forEachChunkAsync(
			ids,
			100,
			async function (chunk) {
				var syncSets = [];
				var storageSets = [];
				chunk
					.filter(id => !extraData[id] || !extraData[id].skipDeleteLog)
					.forEach(id => {
						if (type == 'setting') {
							var [libraryID, key] = id.split("/");
						}
						else {
							var { libraryID, key } = extraData[id];
						}
						if (!key) {
							throw new Error("Key not provided in notifier object");
						}
						syncSets.push(syncObjectTypeID, libraryID, key);
						
						if (type == 'item') {
							if (storageForLibrary[libraryID] === undefined) {
								storageForLibrary[libraryID] =
									Zotero.Sync.Storage.Local.getModeForLibrary(libraryID) == 'webdav';
							}
							if (storageForLibrary[libraryID] && extraData[id].storageDeleteLog) {
								storageSets.push(libraryID, key);
							}
						}
					});
				
				if (storageSets.length) {
					return Zotero.DB.executeTransaction(function* () {
						yield Zotero.DB.queryAsync(
							syncSQL + Array(syncSets.length / 3).fill('(?, ?, ?)').join(', '),
							syncSets
						);
						yield Zotero.DB.queryAsync(
							storageSQL + Array(storageSets.length / 2).fill('(?, ?)').join(', '),
							storageSets
						);
					});
				}
				else if (syncSets.length) {
					await Zotero.DB.queryAsync(
						syncSQL + Array(syncSets.length / 3).fill('(?, ?, ?)').join(', '), syncSets
					);
				}
			}
		);
	});
}


Zotero.Sync.EventListeners.AutoSyncListener = {
	_editTimeout: 15,
	_observerID: null,
	
	init: function () {
		// If auto-sync is enabled, initialize the save observer
		if (Zotero.Prefs.get('sync.autoSync')) {
			this.register();
		}
	},
	
	register: function () {
		this._observerID = Zotero.Notifier.registerObserver(this, false, 'autosync');
	},
	
	notify: function (event, type, ids, extraData) {
		// TODO: skip others
		if (event == 'refresh' || event == 'redraw') {
			return;
		}
		
		if (Zotero.Sync.Runner.syncInProgress) {
			return;
		}
		
		// Only trigger sync for certain types
		//
		// TODO: settings, full text
		if (!Zotero.DataObjectUtilities.getTypes().includes(type)) {
			return;
		}
		
		// Determine affected libraries so only those can be synced
		let libraries = [];
		let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(type);
		ids.forEach(id => {
			let lk = objectsClass.getLibraryAndKeyFromID(id);
			if (lk) {
				let library = Zotero.Libraries.get(lk.libraryID);
				if (library.syncable) {
					libraries.push(library);
				}
			}
		});
		
		libraries = Zotero.Sync.Data.Local.filterSkippedLibraries(libraries);
		if (!libraries.length) {
			return;
		}
		
		Zotero.Sync.Runner.setSyncTimeout(
			this._editTimeout,
			false,
			{
				libraries: libraries.map(library => library.libraryID)
			}
		);
	},
	
	unregister: function () {
		if (this._observerID) {
			Zotero.Notifier.unregisterObserver(this._observerID);
		}
	}
}


Zotero.Sync.EventListeners.IdleListener = {
	_idleTimeout: 3600,
	_backTimeout: 900,
	
	init: function () {
		// DEBUG: Allow override for testing
		var idleTimeout = Zotero.Prefs.get("sync.autoSync.idleTimeout");
		if (idleTimeout) {
			this._idleTimeout = idleTimeout;
		}
		var backTimeout = Zotero.Prefs.get("sync.autoSync.backTimeout");
		if (backTimeout) {
			this._backTimeout = backTimeout;
		}
		
		if (Zotero.Prefs.get("sync.autoSync")) {
			this.register();
		}
	},
	
	register: function () {
		Zotero.debug("Registering auto-sync idle observer");
		var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
				.getService(Components.interfaces.nsIIdleService);
		idleService.addIdleObserver(this, this._idleTimeout);
		idleService.addIdleObserver(this._backObserver, this._backTimeout);
	},
	
	observe: function (subject, topic, data) {
		if (topic != 'idle') {
			return;
		}
		
		if (!Zotero.Sync.Runner.enabled || Zotero.Sync.Runner.syncInProgress) {
			return;
		}
		
		// TODO: move to Runner.sync()?
		if (Zotero.locked) {
			Zotero.debug('Zotero is locked -- skipping idle sync', 4);
			return;
		}
		
		if (Zotero.Sync.Server.manualSyncRequired) {
			Zotero.debug('Manual sync required -- skipping idle sync', 4);
			return;
		}
		
		Zotero.debug("Beginning idle sync");
		
		Zotero.Sync.Runner.setSyncTimeout(this._idleTimeout, true);
		
		Zotero.Sync.Runner.sync({
			background: true
		});
	},
	
	_backObserver: {
		observe: function (subject, topic, data) {
			if (topic !== 'active') {
				return;
			}
			
			Zotero.Sync.Runner.clearSyncTimeout();
			if (!Zotero.Sync.Runner.enabled || Zotero.Sync.Runner.syncInProgress) {
				return;
			}
			Zotero.debug("Beginning return-from-idle sync");
			Zotero.Sync.Runner.sync({
				background: true
			});
		}
	},
	
	unregister: function () {
		Zotero.debug("Unregistering auto-sync idle observer");
		var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
				.getService(Components.interfaces.nsIIdleService);
		idleService.removeIdleObserver(this, this._idleTimeout);
		idleService.removeIdleObserver(this._backObserver, this._backTimeout);
	}
}



Zotero.Sync.EventListeners.progressListener = {
	onStart: function () {
		
	},
	
	
	onProgress: function (current, max) {
		
	},
	
	
	onStop: function () {
		
	}
};


Zotero.Sync.EventListeners.StorageFileOpenListener = {
	init: function () {
		Zotero.Notifier.registerObserver(this, ['file'], 'storageFileOpen');
	},
	
	notify: function (event, type, ids, extraData) {
		if (event == 'open' && type == 'file') {
			let timestamp = new Date().getTime();
			
			for (let i = 0; i < ids.length; i++) {
				Zotero.Sync.Storage.Local.uploadCheckFiles.push({
					itemID: ids[i],
					timestamp: timestamp
				});
			}
		}
	}
}
