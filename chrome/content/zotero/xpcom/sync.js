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


Zotero.Sync = new function() {
	// Keep in sync with syncObjectTypes table
	this.__defineGetter__('syncObjects', function () {
		return {
			creator: {
				singular: 'Creator',
				plural: 'Creators'
			},
			item: {
				singular: 'Item',
				plural: 'Items'
			},
			collection: {
				singular: 'Collection',
				plural: 'Collections'
			},
			search: {
				singular: 'Search',
				plural: 'Searches'
			},
			tag: {
				singular: 'Tag',
				plural: 'Tags'
			},
			relation: {
				singular: 'Relation',
				plural: 'Relations'
			},
			setting: {
				singular: 'Setting',
				plural: 'Settings'
			},
			fulltext: {
				singular: 'Fulltext',
				plural: 'Fulltexts'
			}
		};
	});
}


/**
 * Methods for syncing with the Zotero Server
 */
Zotero.Sync.Server = new function () {
	this.canAutoResetClient = true;
	this.manualSyncRequired = false;
	this.upgradeRequired = false;
	this.nextLocalSyncDate = false;
	
	function clear(callback) {
		if (!_sessionID) {
			Zotero.debug("Session ID not available -- logging in");
			Zotero.Sync.Server.login()
			.then(function () {
				Zotero.Sync.Server.clear(callback);
			})
			.done();
			return;
		}
		
		var url = _serverURL + "clear";
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent;
		
		Zotero.HTTP.doPost(url, body, function (xmlhttp) {
			if (_invalidSession(xmlhttp)) {
				Zotero.debug("Invalid session ID -- logging in");
				_sessionID = false;
				Zotero.Sync.Server.login()
				.then(function () {
					Zotero.Sync.Server.clear(callback);
				})
				.done();
				return;
			}
			
			_checkResponse(xmlhttp);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			if (response.firstChild.tagName != 'cleared') {
				_error('Invalid response from server', xmlhttp.responseText);
			}
			
			Zotero.Sync.Server.resetClient();
			
			if (callback) {
				callback();
			}
		});
	}
	
	
	function resetClient() {
		Zotero.debug("Resetting client");
		
		Zotero.DB.beginTransaction();
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('lastlocalsync', 'lastremotesync', 'syncdeletelog')";
		Zotero.DB.query(sql);
		
		var sql = "DELETE FROM version WHERE schema IN "
			+ "('lastlocalsync', 'lastremotesync', 'syncdeletelog')";
		Zotero.DB.query(sql);
		
		Zotero.DB.query("DELETE FROM syncDeleteLog");
		Zotero.DB.query("DELETE FROM storageDeleteLog");
		
		sql = "INSERT INTO version VALUES ('syncdeletelog', ?)";
		Zotero.DB.query(sql, Zotero.Date.getUnixTimestamp());
		
		var sql = "UPDATE syncedSettings SET synced=0";
		Zotero.DB.query(sql);
		
		Zotero.DB.commitTransaction();
	}
	
	
	function _checkResponse(xmlhttp, noReloadOnFailure) {
		
		
		if (!xmlhttp.responseXML || !xmlhttp.responseXML.childNodes[0] ||
				xmlhttp.responseXML.childNodes[0].tagName != 'response' ||
				!xmlhttp.responseXML.childNodes[0].firstChild) {
			Zotero.debug(xmlhttp.responseText);
			_error(Zotero.getString('general.invalidResponseServer') + Zotero.getString('general.tryAgainLater'),
				xmlhttp.responseText, noReloadOnFailure);
		}
		
		var firstChild = xmlhttp.responseXML.firstChild.firstChild;
		
		if (firstChild.localName == 'error') {
			// Don't automatically retry 400 errors
			if (xmlhttp.status >= 400 && xmlhttp.status < 500 && !_invalidSession(xmlhttp)) {
				Zotero.debug("Server returned " + xmlhttp.status + " -- manual sync required", 2);
				Zotero.Sync.Server.manualSyncRequired = true;
			}
			else {
				Zotero.debug("Server returned " + xmlhttp.status, 3);
			}
			
			switch (firstChild.getAttribute('code')) {
				case 'INVALID_UPLOAD_DATA':
					// On the off-chance that this error is due to invalid characters
					// in a filename, check them all (since getting a more specific
					// error from the server would be difficult)
					var sql = "SELECT itemID FROM itemAttachments WHERE linkMode IN (?,?)";
					var ids = Zotero.DB.columnQuery(sql, [Zotero.Attachments.LINK_MODE_IMPORTED_FILE, Zotero.Attachments.LINK_MODE_IMPORTED_URL]);
					if (ids) {
						var items = Zotero.Items.get(ids);
						var rolledBack = false;
						for (let item of items) {
							var file = item.getFile();
							if (!file) {
								continue;
							}
							try {
								var fn = file.leafName;
								// TODO: move stripping logic (copied from _xmlize()) to Utilities
								var xmlfn = file.leafName.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/g, '');
								if (fn != xmlfn) {
									if (!rolledBack) {
										Zotero.DB.rollbackAllTransactions();
									}
									Zotero.debug("Changing invalid filename to " + xmlfn);
									item.renameAttachmentFile(xmlfn);
								}
							}
							catch (e) {
								Zotero.debug(e);
								Components.utils.reportError(e);
							}
						}
					}
					
					// Make sure this isn't due to relations using a local user key
					//
					// TEMP: This can be removed once a DB upgrade step is added
					try {
						var sql = "SELECT libraryID FROM relations WHERE libraryID LIKE 'local/%' LIMIT 1";
						var repl = Zotero.DB.valueQuery(sql);
						if (repl) {
							Zotero.Relations.updateUser(repl, repl, Zotero.userID, Zotero.libraryID);
						}
					}
					catch (e) {
						Components.utils.reportError(e);
						Zotero.debug(e);
					}
					break;
				
				case 'FULL_SYNC_REQUIRED':
					// Let current sync fail, and then do a full sync
					var background = Zotero.Sync.Runner.background;
					setTimeout(function () {
						if (Zotero.Prefs.get('sync.debugNoAutoResetClient')) {
							Components.utils.reportError("Skipping automatic client reset due to debug pref");
							return;
						}
						if (!Zotero.Sync.Server.canAutoResetClient) {
							Components.utils.reportError("Client has already been auto-reset in Zotero.Sync.Server._checkResponse()");
							return;
						}
						
						Zotero.Sync.Server.resetClient();
						Zotero.Sync.Server.canAutoResetClient = false;
						Zotero.Sync.Runner.sync({
							background: background
						});
					}, 1);
					break;
				
				case 'LIBRARY_ACCESS_DENIED':
					var background = Zotero.Sync.Runner.background;
					setTimeout(function () {
						var libraryID = parseInt(firstChild.getAttribute('libraryID'));
						
						try {
							var group = Zotero.Groups.getByLibraryID(libraryID);
						}
						catch (e) {
							// Not sure how this is possible, but it's affecting some people
							// TODO: Clean up in schema updates with FK check
							if (!Zotero.Libraries.exists(libraryID)) {
								let sql = "DELETE FROM syncedSettings WHERE libraryID=?";
								Zotero.DB.query(sql, libraryID);
								return;
							}
						}
						
						var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
												.getService(Components.interfaces.nsIPromptService);
						var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
										+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
										+ ps.BUTTON_DELAY_ENABLE;
						var index = ps.confirmEx(
							null,
							Zotero.getString('general.warning'),
							Zotero.getString('sync.error.writeAccessLost', group.name) + "\n\n"
								+ Zotero.getString('sync.error.groupWillBeReset') + "\n\n"
								+ Zotero.getString('sync.error.copyChangedItems'),
							buttonFlags,
							Zotero.getString('sync.resetGroupAndSync'),
							null, null, null, {}
						);
						
						if (index == 0) {
							group.erase();
							Zotero.Sync.Server.resetClient();
							Zotero.Sync.Storage.resetAllSyncStates();
							Zotero.Sync.Runner.sync();
							return;
						}
					}, 1);
					break;
				
				
				// We can't reproduce it, but we can fix it
				case 'WRONG_LIBRARY_TAG_ITEM':
					var background = Zotero.Sync.Runner.background;
					setTimeout(function () {
						var sql = "CREATE TEMPORARY TABLE tmpWrongLibraryTags AS "
							+ "SELECT itemTags.ROWID AS tagRowID, tagID, name, itemID, "
							+ "IFNULL(tags.libraryID,0) AS tagLibraryID, "
							+ "IFNULL(items.libraryID,0) AS itemLibraryID FROM tags "
							+ "NATURAL JOIN itemTags JOIN items USING (itemID) "
							+ "WHERE IFNULL(tags.libraryID, 0)!=IFNULL(items.libraryID,0)";
						Zotero.DB.query(sql);
						
						sql = "SELECT COUNT(*) FROM tmpWrongLibraryTags";
						var badTags = !!Zotero.DB.valueQuery(sql);
						
						if (badTags) {
							sql = "DELETE FROM itemTags WHERE ROWID IN (SELECT tagRowID FROM tmpWrongLibraryTags)";
							Zotero.DB.query(sql);
						}
						
						Zotero.DB.query("DROP TABLE tmpWrongLibraryTags");
						
						// If error was actually due to a missing item, do a Full Sync
						if (!badTags) {
							if (Zotero.Prefs.get('sync.debugNoAutoResetClient')) {
								Components.utils.reportError("Skipping automatic client reset due to debug pref");
								return;
							}
							if (!Zotero.Sync.Server.canAutoResetClient) {
								Components.utils.reportError("Client has already been auto-reset in Zotero.Sync.Server._checkResponse()");
								return;
							}
							
							Zotero.Sync.Server.resetClient();
							Zotero.Sync.Server.canAutoResetClient = false;
						}
						
						Zotero.Sync.Runner.sync({
							background: background
						});
					}, 1);
					break;
				
				case 'INVALID_TIMESTAMP':
					var validClock = Zotero.DB.valueQuery("SELECT CURRENT_TIMESTAMP BETWEEN '1970-01-01 00:00:01' AND '2038-01-19 03:14:07'");
					if (!validClock) {
						_error(Zotero.getString('sync.error.invalidClock'));
					}
					
					setTimeout(function () {
						Zotero.DB.beginTransaction();
						
						var types = ['collections', 'creators', 'items', 'savedSearches', 'tags'];
						for (let type of types) {
							var sql = "UPDATE " + type + " SET dateAdded=CURRENT_TIMESTAMP "
									+ "WHERE dateAdded NOT BETWEEN '1970-01-01 00:00:01' AND '2038-01-19 03:14:07'";
							Zotero.DB.query(sql);
							var sql = "UPDATE " + type + " SET dateModified=CURRENT_TIMESTAMP "
									+ "WHERE dateModified NOT BETWEEN '1970-01-01 00:00:01' AND '2038-01-19 03:14:07'";
							Zotero.DB.query(sql);
							var sql = "UPDATE " + type + " SET clientDateModified=CURRENT_TIMESTAMP "
									+ "WHERE clientDateModified NOT BETWEEN '1970-01-01 00:00:01' AND '2038-01-19 03:14:07'";
							Zotero.DB.query(sql);
						}
						
						Zotero.DB.commitTransaction();
					}, 1);
					break;
				
				case 'UPGRADE_REQUIRED':
					Zotero.Sync.Server.upgradeRequired = true;
					break;
			}
		}
	}
	
	
	/**
	 * @private
	 * @param	{DOMElement}	response
	 * @param	{Function}		callback
	 */
	function _checkServerLock(response, callback) {
		_checkTimer = null;
		
		var mode;
		
		switch (response.firstChild.localName) {
			case 'queued':
				mode = 'queued';
				break;
			
			case 'locked':
				mode = 'locked';
				break;
				
			default:
				return false;
		}
		
		if (mode == 'queued') {
			var msg = "Upload queued";
		}
		else {
			var msg = "Associated libraries are locked";
		}
		
		var wait = parseInt(response.firstChild.getAttribute('wait'));
		if (!wait || isNaN(wait)) {
			wait = 5000;
		}
		Zotero.debug(msg + " -- waiting " + wait + "ms before next check");
		_checkTimer = setTimeout(function () { callback(mode); }, wait);
		return true;
	}
}


Zotero.Sync.Server.Data = new function() {
	/**
	 * @param	{String}	itemTypes
	 * @param	{String}	localName
	 * @param	{String}	remoteName
	 * @param	{Boolean}	[remoteMoreRecent=false]
	 */
	function _generateAutoChangeAlertMessage(itemTypes, localName, remoteName, remoteMoreRecent) {
		if (localName === null) {
			var localDelete = true;
		}
		else if (remoteName === null) {
			var remoteDelete = true;
		}
		
		var msg = Zotero.getString('sync.conflict.autoChange.alert', itemTypes) + " ";
		if (localDelete) {
			msg += Zotero.getString('sync.conflict.remoteVersionsKept');
		}
		else if (remoteDelete) {
			msg += Zotero.getString('sync.conflict.localVersionsKept');
		}
		else {
			msg += Zotero.getString('sync.conflict.recentVersionsKept');
		}
		msg += "\n\n" + Zotero.getString('sync.conflict.viewErrorConsole',
				(Zotero.isStandalone ? "" : "Firefox")).replace(/\s+/, " ");
		return msg;
	}
	
	
	/**
	 * @param	{String}	itemType
	 * @param	{String}	localName
	 * @param	{String}	remoteName
	 * @param	{Boolean}	[remoteMoreRecent=false]
	 */
	function _generateAutoChangeLogMessage(itemType, localName, remoteName, remoteMoreRecent) {
		if (localName === null) {
			localName = Zotero.getString('sync.conflict.deleted');
			var localDelete = true;
		}
		else if (remoteName === null) {
			remoteName = Zotero.getString('sync.conflict.deleted');
			var remoteDelete = true;
		}
		
		var msg = Zotero.getString('sync.conflict.autoChange.log', itemType) + "\n\n";
		msg += Zotero.getString('sync.conflict.localVersion', localName) + "\n";
		msg += Zotero.getString('sync.conflict.remoteVersion', remoteName);
		msg += "\n\n";
		if (localDelete) {
			msg += Zotero.getString('sync.conflict.remoteVersionKept');
		}
		else if (remoteDelete) {
			msg += Zotero.getString('sync.conflict.localVersionKept');
		}
		else {
			var moreRecent = remoteMoreRecent ? remoteName : localName;
			msg += Zotero.getString('sync.conflict.recentVersionKept', moreRecent);
		}
		return msg;
	}
	
	
	function _generateCollectionItemMergeAlertMessage() {
		var msg = Zotero.getString('sync.conflict.collectionItemMerge.alert') + "\n\n"
			+ Zotero.getString('sync.conflict.viewErrorConsole',
				(Zotero.isStandalone ? "" : "Firefox")).replace(/\s+/, " ");
		return msg;
	}
	
	
	/**
	 * @param	{String}		collectionName
	 * @param	{Integer[]}		addedItemIDs
	 */
	function _generateCollectionItemMergeLogMessage(collectionName, addedItemIDs) {
		var introMsg = Zotero.getString('sync.conflict.collectionItemMerge.log', collectionName);
		var itemText = [];
		var max = addedItemIDs.length;
		for (var i=0; i<max; i++) {
			var id = addedItemIDs[i];
			var item = Zotero.Items.get(id);
			var title = item.getDisplayTitle();
			var text = " \u2022 " + title;
			var firstCreator = item.getField('firstCreator');
			if (firstCreator) {
				text += " (" + firstCreator + ")";
			}
			itemText.push(text);
			
			if (i == 19 && max > 20) {
				itemText.push(" \u2022 ...");
				break;
			}
		}
		return introMsg + "\n\n" + itemText.join("\n");
	}
	
	
	function _generateTagItemMergeAlertMessage() {
		var msg = Zotero.getString('sync.conflict.tagItemMerge.alert') + "\n\n"
			+ Zotero.getString('sync.conflict.viewErrorConsole',
				(Zotero.isStandalone ? "" : "Firefox")).replace(/\s+/, " ");
		return msg;
	}
	
	
	/**
	 * @param	{String}		tagName
	 * @param	{Integer[]}		addedItemIDs
	 * @param	{Boolean}		remoteIsTarget
	 */
	function _generateTagItemMergeLogMessage(tagName, addedItemIDs, remoteIsTarget) {
		var introMsg = Zotero.getString('sync.conflict.tagItemMerge.log', tagName) + " ";
		
		if (remoteIsTarget) {
			introMsg += Zotero.getString('sync.conflict.tag.addedToRemote');
		}
		else {
			introMsg += Zotero.getString('sync.conflict.tag.addedToLocal');
		}
		var itemText = [];
		for (let id of addedItemIDs) {
			var item = Zotero.Items.get(id);
			var title = item.getField('title');
			var text = " - " + title;
			var firstCreator = item.getField('firstCreator');
			if (firstCreator) {
				text += " (" + firstCreator + ")";
			}
			itemText.push(text);
		}
		return introMsg + "\n\n" + itemText.join("\n");
	}
	
	
	function _xmlize(str) {
		return str.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/g, '\u2B1A');
	}
}
