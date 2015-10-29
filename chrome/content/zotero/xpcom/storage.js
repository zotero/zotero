/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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


Zotero.Sync.Storage = new function () {
	//
	// Constants
	//
	this.SYNC_STATE_TO_UPLOAD = 0;
	this.SYNC_STATE_TO_DOWNLOAD = 1;
	this.SYNC_STATE_IN_SYNC = 2;
	this.SYNC_STATE_FORCE_UPLOAD = 3;
	this.SYNC_STATE_FORCE_DOWNLOAD = 4;
	this.SYNC_STATE_IN_CONFLICT = 5;
	
	this.SUCCESS = 1;
	this.ERROR_NO_URL = -1;
	this.ERROR_NO_USERNAME = -2;
	this.ERROR_NO_PASSWORD = -3;
	this.ERROR_OFFLINE = -4;
	this.ERROR_UNREACHABLE = -5;
	this.ERROR_SERVER_ERROR = -6;
	this.ERROR_NOT_DAV = -7;
	this.ERROR_BAD_REQUEST = -8;
	this.ERROR_AUTH_FAILED = -9;
	this.ERROR_FORBIDDEN = -10;
	this.ERROR_PARENT_DIR_NOT_FOUND = -11;
	this.ERROR_ZOTERO_DIR_NOT_FOUND = -12;
	this.ERROR_ZOTERO_DIR_NOT_WRITABLE = -13;
	this.ERROR_NOT_ALLOWED = -14;
	this.ERROR_UNKNOWN = -15;
	this.ERROR_FILE_MISSING_AFTER_UPLOAD = -16;
	this.ERROR_NONEXISTENT_FILE_NOT_MISSING = -17;
	
	// TEMP
	this.__defineGetter__("defaultError", function () Zotero.getString('sync.storage.error.default', Zotero.appName));
	this.__defineGetter__("defaultErrorRestart", function () Zotero.getString('sync.storage.error.defaultRestart', Zotero.appName));
	
	var _itemDownloadPercentages = {};
	
	//
	// Public properties
	//
	this.compressionTracker = {
		compressed: 0,
		uncompressed: 0,
		get ratio() {
			return (Zotero.Sync.Storage.compressionTracker.uncompressed - 
				Zotero.Sync.Storage.compressionTracker.compressed) /
				Zotero.Sync.Storage.compressionTracker.uncompressed;
		}
	}
	
	
	/**
	 * Check if modification time of file on disk matches the mod time
	 * in the database
	 *
	 * @param	{Integer}	itemID
	 * @return	{Boolean}
	 */
	this.isFileModified = function (itemID) {
		var item = Zotero.Items.get(itemID);
		var file = item.getFile();
		if (!file) {
			return false;
		}
		
		var fileModTime = item.attachmentModificationTime;
		if (!fileModTime) {
			return false;
		}
		
		var syncModTime = Zotero.Sync.Storage.getSyncedModificationTime(itemID);
		if (fileModTime != syncModTime) {
			var syncHash = Zotero.Sync.Storage.getSyncedHash(itemID);
			if (syncHash) {
				var fileHash = item.attachmentHash;
				if (fileHash && fileHash == syncHash) {
					Zotero.debug("Mod time didn't match (" + fileModTime + "!=" + syncModTime + ") "
						+ "but hash did for " + file.leafName + " -- ignoring");
					return false;
				}
			}
			return true;
		}
		
		return false;
	}
	
	
	this.checkServerPromise = function (mode) {
		return mode.checkServer()
		.spread(function (uri, status) {
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						   .getService(Components.interfaces.nsIWindowMediator);
			var lastWin = wm.getMostRecentWindow("navigator:browser");
			
			var success = mode.checkServerCallback(uri, status, lastWin, true);
			if (!success) {
				Zotero.debug(mode.name + " verification failed");
				
				var e = new Zotero.Error(
					Zotero.getString('sync.storage.error.verificationFailed', mode.name),
					0,
					{
						dialogButtonText: Zotero.getString('sync.openSyncPreferences'),
						dialogButtonCallback: function () {
							var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
									   .getService(Components.interfaces.nsIWindowMediator);
							var lastWin = wm.getMostRecentWindow("navigator:browser");
							lastWin.ZoteroPane.openPreferences('zotero-prefpane-sync');
						}
					}
				);
				throw e;
			}
		})
		.then(function () {
			Zotero.debug(mode.name + " file sync is successfully set up");
			Zotero.Prefs.set("sync.storage.verified", true);
		});
	}
	
	
	this.getItemDownloadImageNumber = function (item) {
		var numImages = 64;
		
		var lk = item.libraryID + "/" + item.key;
		
		if (typeof _itemDownloadPercentages[lk] == 'undefined') {
			return false;
		}
		
		var percentage = _itemDownloadPercentages[lk];
		return Math.round(percentage / 100 * (numImages - 1)) + 1;
	}
	
	
	this.setItemDownloadPercentage = function (libraryKey, percentage) {
		Zotero.debug("Setting image download percentage to " + percentage
			+ " for item " + libraryKey);
		
		if (percentage !== false) {
			_itemDownloadPercentages[libraryKey] = percentage;
		}
		else {
			delete _itemDownloadPercentages[libraryKey];
		}
		
		var libraryID, key;
		[libraryID, key] = libraryKey.split("/");
		var item = Zotero.Items.getByLibraryAndKey(libraryID, key);
		// TODO: yield or switch to queue
		Zotero.Notifier.trigger('redraw', 'item', item.id, { column: "hasAttachment" });
		
		var parent = item.parentItemKey;
		if (parent) {
			var parentItem = Zotero.Items.getByLibraryAndKey(libraryID, parent);
			var parentLibraryKey = libraryID + "/" + parentItem.key;
			if (percentage !== false) {
				_itemDownloadPercentages[parentLibraryKey] = percentage;
			}
			else {
				delete _itemDownloadPercentages[parentLibraryKey];
			}
			Zotero.Notifier.trigger('redraw', 'item', parentItem.id, { column: "hasAttachment" });
		}
	}
	
	
	this.resetAllSyncStates = function (syncState, includeUserFiles, includeGroupFiles) {
		if (!includeUserFiles && !includeGroupFiles) {
			includeUserFiles = true;
			includeGroupFiles = true;
		}
		
		if (!syncState) {
			syncState = this.SYNC_STATE_TO_UPLOAD;
		}
		
		switch (syncState) {
			case this.SYNC_STATE_TO_UPLOAD:
			case this.SYNC_STATE_TO_DOWNLOAD:
			case this.SYNC_STATE_IN_SYNC:
				break;
			
			default:
				throw ("Invalid sync state '" + syncState + "' in "
					+ "Zotero.Sync.Storage.resetAllSyncStates()");
		}
		
		//var sql = "UPDATE itemAttachments SET syncState=?, storageModTime=NULL, storageHash=NULL";
		var sql = "UPDATE itemAttachments SET syncState=?";
		var params = [syncState];
		if (includeUserFiles && !includeGroupFiles) {
			sql += " WHERE itemID IN (SELECT itemID FROM items WHERE libraryID = ?)";
			params.push(Zotero.Libraries.userLibraryID);
		}
		else if (!includeUserFiles && includeGroupFiles) {
			sql += " WHERE itemID IN (SELECT itemID FROM items WHERE libraryID != ?)";
			params.push(Zotero.Libraries.userLibraryID);
		}
		Zotero.DB.query(sql, [syncState]);
		
		var sql = "DELETE FROM version WHERE schema LIKE 'storage_%'";
		Zotero.DB.query(sql);
	}
	
	
	
	

	
	
	
	
	
	
	
	
	
	function error(e) {
		if (_syncInProgress) {
			Zotero.Sync.Storage.QueueManager.cancel(true);
			_syncInProgress = false;
		}
		
		Zotero.DB.rollbackAllTransactions();
		
		if (e) {
			Zotero.debug(e, 1);
		}
		else {
			e = Zotero.Sync.Storage.defaultError;
		}
		
		if (e.error && e.error == Zotero.Error.ERROR_ZFS_FILE_EDITING_DENIED) {
			setTimeout(function () {
				var group = Zotero.Groups.get(e.data.groupID);
				
				var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
								+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
								+ ps.BUTTON_DELAY_ENABLE;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					Zotero.getString('sync.storage.error.fileEditingAccessLost', group.name) + "\n\n"
						+ Zotero.getString('sync.error.groupWillBeReset') + "\n\n"
						+ Zotero.getString('sync.error.copyChangedItems'),
					buttonFlags,
					Zotero.getString('sync.resetGroupAndSync'),
					null, null, null, {}
				);
				
				if (index == 0) {
					// TODO: transaction
					group.erase();
					Zotero.Sync.Server.resetClient();
					Zotero.Sync.Storage.resetAllSyncStates();
					Zotero.Sync.Runner.sync();
					return;
				}
			}, 1);
		}
	}
}



