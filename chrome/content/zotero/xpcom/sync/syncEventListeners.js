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
		
		var syncSQL = "REPLACE INTO syncDeleteLog (syncObjectTypeID, libraryID, key, synced) "
			+ "VALUES (?, ?, ?, 0)";
		
		if (type == 'item' && Zotero.Sync.Storage.WebDAV.includeUserFiles) {
			var storageSQL = "REPLACE INTO storageDeleteLog VALUES (?, ?, 0)";
		}
		
		return Zotero.DB.executeTransaction(function* () {
			for (let i = 0; i < ids.length; i++) {
				let id = ids[i];
				
				if (extraData[id] && extraData[id].skipDeleteLog) {
					continue;
				}
				
				var libraryID, key;
				if (type == 'setting') {
					[libraryID, key] = ids[i].split("/");
				}
				else {
					let d = extraData[ids[i]];
					libraryID = d.libraryID;
					key = d.key;
				}
				
				if (!key) {
					throw new Error("Key not provided in notifier object");
				}
				
				yield Zotero.DB.queryAsync(
					syncSQL,
					[
						syncObjectTypeID,
						libraryID,
						key
					]
				);
				if (storageSQL && oldItem.itemType == 'attachment' &&
						[
							Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
							Zotero.Attachments.LINK_MODE_IMPORTED_URL
						].indexOf(oldItem.linkMode) != -1) {
					yield Zotero.DB.queryAsync(
						storageSQL,
						[
							libraryID,
							key
						]
					);
				}
			}
		});
	});
}


Zotero.Sync.EventListeners.AutoSyncListener = {
	init: function () {
		// Initialize save observer
		Zotero.Notifier.registerObserver(this);
	},
	
	notify: function (event, type, ids, extraData) {
		// TODO: skip others
		if (event == 'refresh' || event == 'redraw') {
			return;
		}
		
		if (Zotero.Prefs.get('sync.autoSync') && Zotero.Sync.Server.enabled) {
			Zotero.Sync.Runner.setSyncTimeout(false, false, true);
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
		Zotero.debug("Initializing sync idle observer");
		var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
				.getService(Components.interfaces.nsIIdleService);
		idleService.addIdleObserver(this, this._idleTimeout);
		idleService.addIdleObserver(this._backObserver, this._backTimeout);
	},
	
	observe: function (subject, topic, data) {
		if (topic != 'idle') {
			return;
		}
		
		if (!Zotero.Sync.Server.enabled
				|| Zotero.Sync.Server.syncInProgress
				|| Zotero.Sync.Storage.syncInProgress) {
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
		
		Zotero.Sync.Runner.sync({
			background: true
		});
		Zotero.Sync.Runner.setSyncTimeout(this._idleTimeout, true, true);
	},
	
	_backObserver: {
		observe: function (subject, topic, data) {
			if (topic != 'back') {
				return;
			}
			
			Zotero.Sync.Runner.clearSyncTimeout();
			if (!Zotero.Sync.Server.enabled
					|| Zotero.Sync.Server.syncInProgress
					|| Zotero.Sync.Storage.syncInProgress) {
				return;
			}
			Zotero.debug("Beginning return-from-idle sync");
			Zotero.Sync.Runner.sync({
				background: true
			});
		}
	},
	
	unregister: function () {
		Zotero.debug("Stopping sync idle observer");
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
