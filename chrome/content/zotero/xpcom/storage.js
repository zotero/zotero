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
	
	// TEMP
	this.__defineGetter__("defaultError", function () { return Zotero.getString('sync.storage.error.default', Zotero.appName); });
	this.__defineGetter__("defaultErrorRestart", function () { return Zotero.getString('sync.storage.error.defaultRestart', Zotero.appName); });
	
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
		
		var syncModTime = item.attachmentSyncedModificationTime;
		if (fileModTime != syncModTime) {
			var syncHash = item.attachmentSyncedHash;
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
	
	
	this.getItemDownloadImageNumber = function (item) {
		var numImages = 64;
		
		var lk = item.libraryID + "/" + item.key;
		
		if (typeof _itemDownloadPercentages[lk] == 'undefined') {
			return false;
		}
		
		var percentage = _itemDownloadPercentages[lk];
		return Math.round(percentage / 100 * (numImages - 1)) + 1;
	}
	
	
	/**
	 * @param {String} libraryKey
	 * @param {Number|NULL}
	 */
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



