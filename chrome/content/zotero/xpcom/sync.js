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
	
	var _typesLoaded = false;
	var _objectTypeIDs = {};
	var _objectTypeNames = {};
	
	var _deleteLogDays = 30;
	
	
	this.init = function () {
		Zotero.debug("Syncing is disabled", 1);
		return;
		
		Zotero.DB.beginTransaction();
		
		var sql = "SELECT version FROM version WHERE schema='syncdeletelog'";
		if (!Zotero.DB.valueQuery(sql)) {
			sql = "SELECT COUNT(*) FROM syncDeleteLog";
			if (Zotero.DB.valueQuery(sql)) {
				throw ('syncDeleteLog not empty and no timestamp in Zotero.Sync.delete()');
			}
			
			var syncInitTime = Zotero.DB.transactionDate;
			syncInitTime = Zotero.Date.toUnixTimestamp(syncInitTime);
			
			sql = "INSERT INTO version VALUES ('syncdeletelog', ?)";
			Zotero.DB.query(sql, syncInitTime);
		}
		
		Zotero.DB.commitTransaction();
	}
	
	
	/**
	 * @param	int		deleteOlderThan		Unix timestamp
	 */
	this.purgeDeletedObjects = function (deleteOlderThan) {
		if (isNaN(parseInt(deleteOlderThan))) {
			throw ("Invalid timestamp '" + deleteOlderThan
				+ "' in Zotero.Sync.purgeDeletedObjects");
		}
		var sql = "DELETE FROM syncDeleteLog WHERE timestamp<?";
		Zotero.DB.query(sql, { int: deleteOlderThan });
	}
	
	
	function _loadObjectTypes() {
		// TEMP: Take this out once system.sql > 31
		var sql = "UPDATE syncObjectTypes SET name='relation' WHERE syncObjectTypeID=6 AND name='relations'";
		Zotero.DB.query(sql);
		
		var sql = "SELECT * FROM syncObjectTypes";
		var types = Zotero.DB.query(sql);
		for each(var type in types) {
			_objectTypeNames[type.syncObjectTypeID] = type.name;
			_objectTypeIDs[type.name] = type.syncObjectTypeID;
		}
		_typesLoaded = true;
	}
}


/**
 * Methods for syncing with the Zotero Server
 */
Zotero.Sync.Server = new function () {
	this.login = login;
	this.sync = sync;
	this.clear = clear;
	this.resetClient = resetClient;
	
	this.__defineGetter__('enabled', function () {
		if (_throttleTimeout && new Date() < _throttleTimeout) {
			Zotero.debug("Auto-syncing is disabled until " + Zotero.Date.dateToSQL(_throttleTimeout) + " -- skipping sync");
			return false;
		}
		return this.username && this.password;
	});
	
	this.__defineGetter__("syncInProgress", function () _syncInProgress);
	this.__defineGetter__("updatesInProgress", function () _updatesInProgress);
	this.__defineGetter__("sessionIDComponent", function () {
		return 'sessionid=' + _sessionID;
	});
	this.__defineSetter__("lastLocalSyncTime", function (val) {
		Zotero.DB.query("REPLACE INTO version VALUES ('lastlocalsync', ?)", { int: val });
	});
	
	
	this.canAutoResetClient = true;
	this.manualSyncRequired = false;
	this.upgradeRequired = false;
	this.nextLocalSyncDate = false;
	
	var _syncInProgress;
	var _updatesInProgress;
	var _sessionID;
	var _throttleTimeout;
	var _checkTimer;
	
	var _callbacks = {
		onSuccess: function () {
			Zotero.Sync.Runner.setSyncIcon();
		},
		onSkip: function () {
			Zotero.Sync.Runner.setSyncIcon();
		},
		onStop: function () {
			Zotero.Sync.Runner.setSyncIcon();
		},
		onError: function (msg) {
			Zotero.Sync.Runner.error(msg);
		}
	};
	
	function login() {
		var url = _serverURL + "login";
		
		var username = Zotero.Sync.Server.username;
		if (!username) {
			var e = new Zotero.Error(Zotero.getString('sync.error.usernameNotSet'), "SYNC_USERNAME_NOT_SET");
			_error(e);
		}
		
		var password = Zotero.Sync.Server.password;
		if (!password) {
			var e = new Zotero.Error(Zotero.getString('sync.error.passwordNotSet'), "INVALID_SYNC_LOGIN");
			_error(e);
		}
		
		// TEMP
		if (Zotero.Prefs.get("sync.fulltext.enabled") &&
				Zotero.DB.valueQuery("SELECT version FROM version WHERE schema='userdata'") < 77) {
			// Don't show multiple times on idle
			_syncInProgress = true;
			
			let ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				.getService(Components.interfaces.nsIPromptService);
			let buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
				+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
				+ ps.BUTTON_DELAY_ENABLE;
			let index = ps.confirmEx(
				null,
				Zotero.getString('sync.fulltext.upgradePrompt.title'),
				Zotero.getString('sync.fulltext.upgradePrompt.text') + "\n\n"
					+ Zotero.getString('sync.fulltext.upgradePrompt.changeLater'),
				buttonFlags,
				Zotero.getString('sync.fulltext.upgradePrompt.enable'),
				Zotero.getString('general.notNow'),
				null, null, {}
			);
			
			_syncInProgress = false;
			
			// Enable
			if (index == 0) {
				Zotero.DB.backupDatabase(76, true);
				Zotero.DB.query("UPDATE version SET version=77 WHERE schema='userdata'");
				Zotero.wait(1000);
			}
			// Disable
			else {
				Zotero.Prefs.set("sync.fulltext.enabled", false);
			}
		}
		
		username = encodeURIComponent(username);
		password = encodeURIComponent(password);
		var body = _apiVersionComponent
					+ "&username=" + username
					+ "&password=" + password;
		
		Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.loggingIn'));
		
		return Zotero.HTTP.promise("POST", url,
			{ body: body, successCodes: false, foreground: !Zotero.Sync.Runner.background })
		.then(function (xmlhttp) {
			_checkResponse(xmlhttp, true);
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			if (response.firstChild.tagName == 'error') {
				if (response.firstChild.getAttribute('code') == 'INVALID_LOGIN') {
					var e = new Zotero.Error(Zotero.getString('sync.error.invalidLogin'), "INVALID_SYNC_LOGIN");
					_error(e, false, true);
				}
				_error(response.firstChild.firstChild.nodeValue, false, true);
			}
			
			if (_sessionID) {
				_error("Session ID already set in Zotero.Sync.Server.login()", false, true)
			}
			
			// <response><sessionID>[abcdefg0-9]{32}</sessionID></response>
			_sessionID = response.firstChild.firstChild.nodeValue;
			
			var re = /^[abcdefg0-9]{32}$/;
			if (!re.test(_sessionID)) {
				_sessionID = null;
				_error('Invalid session ID received from server', false, true);
			}
			
			
			//Zotero.debug('Got session ID ' + _sessionID + ' from server');
		});
	}
	
	
	function sync(callbacks, restart, upload) {
		for (var func in callbacks) {
			_callbacks[func] = callbacks[func];
		}
		
		var self = this;
		
		Zotero.Sync.Runner.setErrors();
		Zotero.Sync.Runner.setSyncIcon('animate');
		
		if (!_sessionID) {
			Zotero.debug("Session ID not available -- logging in");
			Zotero.Sync.Server.login()
			.then(function () {
				Zotero.Sync.Server.sync(_callbacks);
			})
			.done();
			return;
		}
		
		if (!restart) {
			if (_syncInProgress) {
				var msg = Zotero.localeJoin([
					Zotero.getString('sync.error.syncInProgress'),
					Zotero.getString('sync.error.syncInProgress.wait', Zotero.appName)
				]);
				var e = new Zotero.Error(msg, 0, { dialogButtonText: null, frontWindowOnly: true });
				_error(e);
			}
			
			Zotero.debug("Beginning server sync");
			_syncInProgress = true;
		}
		
		// Get updated data
		var url = _serverURL + 'updated';
		var lastsync = Zotero.Sync.Server.lastRemoteSyncTime;
		if (!lastsync) {
			lastsync = 1;
		}
		
		// If no local timestamp is stored, don't use remote time
		//
		// This used to be possible when remote time was saved whether or not
		// the subsequent upload went through
		var lastLocalSyncTime = Zotero.Sync.Server.lastLocalSyncTime;
		if (!lastLocalSyncTime) {
			lastsync = 1;
		}
		
		var body = _apiVersionComponent
					+ '&' + Zotero.Sync.Server.sessionIDComponent
					+ '&lastsync=' + lastsync;
		// Tell server to check for read locks as well as write locks,
		// since we'll be uploading
		if (upload) {
			body += '&upload=1';
		}
		
		if (Zotero.Prefs.get("sync.fulltext.enabled")) {
			body += "&ft=1" + Zotero.Fulltext.getUndownloadedPostData();
		}
		else {
			body += "&ft=0";
		}
		
		Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.gettingUpdatedData'));
		
		Zotero.HTTP.doPost(url, body, function (xmlhttp) {
			Zotero.debug(xmlhttp.responseText);
			
			_checkResponse(xmlhttp, !restart);
			
			if (_invalidSession(xmlhttp)) {
				Zotero.debug("Invalid session ID -- logging in");
				_sessionID = false;
				_syncInProgress = false;
				Zotero.Sync.Server.login()
				.then(function () {
					Zotero.Sync.Server.sync(_callbacks);
				})
				.done();
				return;
			}
			
			var response = xmlhttp.responseXML.childNodes[0];
			
			// If server session is locked, keep checking back
			if (_checkServerLock(response, function () { Zotero.Sync.Server.sync(_callbacks, true, upload); })) {
				return;
			}
			
			// Error that's not handled by _checkResponse()
			if (response.firstChild.localName == 'error') {
				_error(response.firstChild.firstChild.nodeValue);
			}
			
			try {
				var responseNode = xmlhttp.responseXML.documentElement;
				
				var updateKey = responseNode.getAttribute('updateKey');
				
				// If no earliest date is provided by the server, the server
				// account is empty
				var earliestRemoteDate = responseNode.getAttribute('earliest');
				earliestRemoteDate = parseInt(earliestRemoteDate) ?
					new Date((earliestRemoteDate + 43200) * 1000) : false;
				var noServerData = !!earliestRemoteDate;
				
				// Check to see if we're syncing with a different user
				var userID = parseInt(responseNode.getAttribute('userID'));
				var libraryID = parseInt(responseNode.getAttribute('defaultLibraryID'));
				var c = _checkSyncUser(userID, libraryID, noServerData);
				if (c == 0) {
					// Groups were deleted, so restart sync
					Zotero.debug("Restarting sync");
					_syncInProgress = false;
					Zotero.Sync.Server.sync(_callbacks);
					return;
				}
				else if (c == -1) {
					Zotero.debug("Sync cancelled");
					_syncInProgress = false;
					_callbacks.onStop();
					return;
				}
				
				Zotero.DB.beginTransaction();
				
				Zotero.UnresponsiveScriptIndicator.disable();
				
				var lastLocalSyncDate = lastLocalSyncTime ?
					new Date(lastLocalSyncTime * 1000) : false;
				
				var syncSession = new Zotero.Sync.Server.Session;
				
				// Fetch old objects not on server (due to a clear) and new
				// objects added since last sync, or all local objects if neither is set
				Zotero.Sync.getObjectsByDate(
					earliestRemoteDate, lastLocalSyncDate, syncSession.uploadKeys.updated
				);
				
				var deleted = Zotero.Sync.getDeletedObjects(lastLocalSyncDate, syncSession.uploadKeys.deleted);
				if (deleted == -1) {
					var msg = "Sync delete log starts after last sync date in Zotero.Sync.Server.sync()";
					var e = new Zotero.Error(msg, "FULL_SYNC_REQUIRED");
					throw (e);
				}
				
				var nextLocalSyncDate = Zotero.DB.transactionDate;
				var nextLocalSyncTime = Zotero.Date.toUnixTimestamp(nextLocalSyncDate);
				Zotero.Sync.Server.nextLocalSyncDate = nextLocalSyncDate;
				
				Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.processingUpdatedData'));
				
				// Reconcile and save updated data from server and
				// prepare local data to upload
				
				Zotero.suppressUIUpdates = true;
				_updatesInProgress = true;
				
				var errorHandler = function (e, rethrow) {
					Zotero.DB.rollbackTransaction();
					
					Zotero.UnresponsiveScriptIndicator.enable();
					
					if (Zotero.locked) {
						Zotero.hideZoteroPaneOverlays();
					}
					Zotero.suppressUIUpdates = false;
					_updatesInProgress = false;
					
					if (rethrow) {
						throw (e);
					}
					_error(e);
				}
				
				var result = Q.async(Zotero.Sync.Server.Data.processUpdatedXML(
					responseNode.getElementsByTagName('updated')[0],
					lastLocalSyncDate,
					syncSession,
					libraryID,
					function (xmlstr) {
						Zotero.UnresponsiveScriptIndicator.enable();
						
						if (Zotero.locked) {
							Zotero.hideZoteroPaneOverlays();
						}
						Zotero.suppressUIUpdates = false;
						_updatesInProgress = false;
						
						if (xmlstr === false) {
							Zotero.debug("Sync cancelled");
							Zotero.DB.rollbackTransaction();
							Zotero.reloadDataObjects();
							Zotero.Sync.EventListener.resetIgnored();
							_syncInProgress = false;
							_callbacks.onStop();
							return;
						}
						
						if (xmlstr) {
							Zotero.debug(xmlstr);
						}
						
						if (Zotero.Prefs.get('sync.debugBreak')) {
							Zotero.debug('===============');
							throw ("break");
						}
						
						if (!xmlstr) {
							Zotero.debug("Nothing to upload to server");
							Zotero.Sync.Server.lastRemoteSyncTime = response.getAttribute('timestamp');
							Zotero.Sync.Server.lastLocalSyncTime = nextLocalSyncTime;
							Zotero.Sync.Server.nextLocalSyncDate = false;
							Zotero.DB.commitTransaction();
							_syncInProgress = false;
							_callbacks.onSuccess();
							return;
						}
						
						Zotero.DB.commitTransaction();
						
						Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.uploadingData'));
						
						var url = _serverURL + 'upload';
						var body = _apiVersionComponent
									+ '&' + Zotero.Sync.Server.sessionIDComponent
									+ '&updateKey=' + updateKey
									+ '&data=' + encodeURIComponent(xmlstr);
						
						//var file = Zotero.getZoteroDirectory();
						//file.append('lastupload.txt');
						//Zotero.File.putContents(file, body);
						
						var uploadCallback = function (xmlhttp) {
							if (xmlhttp.status == 409) {
								Zotero.debug("Upload key is no longer valid -- restarting sync");
								setTimeout(function () {
									Zotero.Sync.Server.sync(_callbacks, true, true);
								}, 1);
								return;
							}
							
							_checkResponse(xmlhttp);
							
							Zotero.debug(xmlhttp.responseText);
							var response = xmlhttp.responseXML.childNodes[0];
							
							if (_checkServerLock(response, function (mode) {
								switch (mode) {
									// If the upload was queued, keep checking back
									case 'queued':
										Zotero.Sync.Runner.setSyncStatus(Zotero.getString('sync.status.uploadAccepted'));
										
										var url = _serverURL + 'uploadstatus';
										var body = _apiVersionComponent
													+ '&' + Zotero.Sync.Server.sessionIDComponent;
										Zotero.HTTP.doPost(url, body, function (xmlhttp) {
											uploadCallback(xmlhttp);
										});
										break;
									
									// If affected libraries were locked, restart sync,
									// since the upload key would be out of date anyway
									case 'locked':
										setTimeout(function () {
											Zotero.Sync.Server.sync(_callbacks, true, true);
										}, 1);
										break;
										
									default:
										throw ("Unexpected server lock mode '" + mode + "' in Zotero.Sync.Server.upload()");
								}
							})) { return; }
							
							if (response.firstChild.tagName == 'error') {
								// handle error
								_error(response.firstChild.firstChild.nodeValue);
							}
							
							if (response.firstChild.localName != 'uploaded') {
								_error("Unexpected upload response '" + response.firstChild.localName
										+ "' in Zotero.Sync.Server.sync()");
							}
							
							Zotero.DB.beginTransaction();
							Zotero.Sync.purgeDeletedObjects(nextLocalSyncTime);
							Zotero.Sync.Server.lastLocalSyncTime = nextLocalSyncTime;
							Zotero.Sync.Server.nextLocalSyncDate = false;
							Zotero.Sync.Server.lastRemoteSyncTime = response.getAttribute('timestamp');
							
							var sql = "UPDATE syncedSettings SET synced=1";
							Zotero.DB.query(sql);
							
							if (syncSession.fulltextItems && syncSession.fulltextItems.length) {
								let sql = "UPDATE fulltextItems SET synced=1 WHERE itemID=?";
								for each (let lk in syncSession.fulltextItems) {
									let item = Zotero.Items.getByLibraryAndKey(lk.libraryID, lk.key);
									Zotero.DB.query(sql, item.id);
								}
							}
							
							//throw('break2');
							
							Zotero.DB.commitTransaction();
							
							// Check if any items were modified during /upload,
							// and restart the sync if so
							if (Zotero.Items.getNewer(nextLocalSyncDate, true)) {
								Zotero.debug("Items were modified during upload -- restarting sync");
								Zotero.Sync.Server.sync(_callbacks, true, true);
								return;
							}
							
							_syncInProgress = false;
							_callbacks.onSuccess();
						}
						
						var compress = Zotero.Prefs.get('sync.server.compressData');
						// Compress upload data
						if (compress) {
							// Callback when compressed data is available
							var bufferUploader = function (data) {
								var gzurl = url + '?gzip=1';
								
								var oldLen = body.length;
								var newLen = data.length;
								var savings = Math.round(((oldLen - newLen) / oldLen) * 100)
								Zotero.debug("HTTP POST " + newLen + " bytes to " + gzurl
									+ " (gzipped from " + oldLen + " bytes; "
									+ savings + "% savings)");
								
								if (Zotero.HTTP.browserIsOffline()) {
									Zotero.debug('Browser is offline');
									return false;
								}
								
								var req =
									Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].
										createInstance();
								req.open('POST', gzurl, true);
								req.setRequestHeader('Content-Type', "application/octet-stream");
								req.setRequestHeader('Content-Encoding', 'gzip');
								
								req.onreadystatechange = function () {
									if (req.readyState == 4) {
										uploadCallback(req);
									}
								};
								try {
									// Send binary data
									let numBytes = data.length, ui8Data = new Uint8Array(numBytes);
									for (let i = 0; i < numBytes; i++) {
										ui8Data[i] = data.charCodeAt(i) & 0xff;
									}
									req.send(ui8Data);
								}
								catch (e) {
									_error(e);
								}
							}
							
							// Get input stream from POST data
							var unicodeConverter =
								Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
									.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
							unicodeConverter.charset = "UTF-8";
							var bodyStream = unicodeConverter.convertToInputStream(body);
							
							// Get listener for when compression is done
							var listener = new Zotero.BufferedInputListener(bufferUploader);
							
							// Initialize stream converter
							var converter =
								Components.classes["@mozilla.org/streamconv;1?from=uncompressed&to=gzip"]
									.createInstance(Components.interfaces.nsIStreamConverter);
							converter.asyncConvertData("uncompressed", "gzip", listener, null);
							
							// Send input stream to stream converter
							var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"].
									createInstance(Components.interfaces.nsIInputStreamPump);
							pump.init(bodyStream, -1, -1, 0, 0, true);
							pump.asyncRead(converter, null);
						}
						
						// Don't compress upload data
						else {
							Zotero.HTTP.doPost(url, body, uploadCallback);
						}
					}
				))();
				
				if (Q.isPromise(result)) {
					result.catch(errorHandler);
				}
			}
			catch (e) {
				_error(e);
			}
			finally {
				Zotero.UnresponsiveScriptIndicator.enable();
			}
		});
		
		return;
	}
	
	
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
		if (!xmlhttp.responseText) {
			var channel = xmlhttp.channel;
			// Check SSL cert
			if (channel) {
				var secInfo = channel.securityInfo;
				if (secInfo instanceof Ci.nsITransportSecurityInfo) {
					secInfo.QueryInterface(Ci.nsITransportSecurityInfo);
					if ((secInfo.securityState & Ci.nsIWebProgressListener.STATE_IS_INSECURE) == Ci.nsIWebProgressListener.STATE_IS_INSECURE) {
						var url = channel.name;
						var ios = Components.classes["@mozilla.org/network/io-service;1"].
									getService(Components.interfaces.nsIIOService);
						try {
							var uri = ios.newURI(url, null, null);
							var host = uri.host;
						}
						catch (e) {
							Zotero.debug(e);
						}
						var kbURL = 'https://zotero.org/support/kb/ssl_certificate_error';
						_error(Zotero.getString('sync.storage.error.webdav.sslCertificateError', host) + "\n\n"
							+ Zotero.getString('general.seeForMoreInformation', kbURL),
							false, noReloadOnFailure);
					}
					else if ((secInfo.securityState & Ci.nsIWebProgressListener.STATE_IS_BROKEN) == Ci.nsIWebProgressListener.STATE_IS_BROKEN) {
						_error(Zotero.getString('sync.error.sslConnectionError'), false, noReloadOnFailure);
					}
				}
			}
			if (xmlhttp.status === 0) {
				_error(Zotero.getString('sync.error.checkConnection'), false, noReloadOnFailure);
			}
			_error(Zotero.getString('sync.error.emptyResponseServer') + Zotero.getString('general.tryAgainLater'),
				false, noReloadOnFailure);
		}
		
		if (!xmlhttp.responseXML || !xmlhttp.responseXML.childNodes[0] ||
				xmlhttp.responseXML.childNodes[0].tagName != 'response' ||
				!xmlhttp.responseXML.childNodes[0].firstChild) {
			Zotero.debug(xmlhttp.responseText);
			_error(Zotero.getString('general.invalidResponseServer') + Zotero.getString('general.tryAgainLater'),
				xmlhttp.responseText, noReloadOnFailure);
		}
		
		var firstChild = xmlhttp.responseXML.firstChild.firstChild;
		
		// Temporarily disable auto-sync if instructed by server
		if (firstChild.localName == 'throttle') {
			Zotero.debug(xmlhttp.responseText);
			var delay = first.getAttribute('delay');
			var time = new Date();
			time = time.getTime() + (delay * 1000);
			time = new Date(time);
			_throttleTimeout = time;
			if (delay < 86400000) {
				var timeStr = time.toLocaleTimeString();
			}
			else {
				var timeStr = time.toLocaleString();
			}
			_error("Auto-syncing disabled until " + timeStr, false, noReloadOnFailure);
		}
		
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
						for each(var item in items) {
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
				
				case 'NOTE_TOO_LONG':
					if (!Zotero.Sync.Runner.background) {
						let libraryKey = xmlhttp.responseXML.firstChild.getElementsByTagName('item');
						if (libraryKey.length) {
							let [libraryID, key] = libraryKey[0].textContent.split('/');
							if (Zotero.Libraries.getType(libraryID) == 'user') {
								libraryID = null;
							}
							let item = Zotero.Items.getByLibraryAndKey(libraryID, key);
							if (item) {
								let msg = xmlhttp.responseXML.firstChild.getElementsByTagName('error')[0].textContent;
								let e = new Zotero.Error(
									msg,
									0,
									{
										dialogText: msg,
										dialogButtonText: Zotero.getString('pane.items.showItemInLibrary'),
										dialogButtonCallback: function () {
											var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
												.getService(Components.interfaces.nsIWindowMediator);
											var win = wm.getMostRecentWindow("navigator:browser");
											win.ZoteroPane.selectItem(item.id);
										}
									}
								);
								_error(e);
							}
							else {
								let msg = "Long note " + libraryKey[0].textContent + " not found!";
								Zotero.debug(msg, 1);
								Components.utils.reportError(msg);
							}
						}
					}
					break;
				
				case 'TAG_TOO_LONG':
					if (!Zotero.Sync.Runner.background) {
						var tag = xmlhttp.responseXML.firstChild.getElementsByTagName('tag');
						if (tag.length) {
							var tag = tag[0].firstChild.nodeValue;
							setTimeout(function () {
								var callback = function () {
									var sql = "SELECT DISTINCT name FROM tags WHERE LENGTH(name)>255 LIMIT 1";
									var tag = Zotero.DB.valueQuery(sql);
									if (tag) {
										var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
												   .getService(Components.interfaces.nsIWindowMediator);
										var lastWin = wm.getMostRecentWindow("navigator:browser");
										var dataOut = { result: null };
										lastWin.openDialog('chrome://zotero/content/longTagFixer.xul', '', 'chrome,modal,centerscreen', tag, dataOut);
										if (dataOut.result) {
											callback();
										}
									}
									else {
										Zotero.Sync.Runner.sync();
									}
								};
								
								callback();
							}, 1);
						}
					}
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
						for each (var type in types) {
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
	var _noMergeTypes = ['search'];
	
	/**
	 * Pull out collections from delete queue in XML
	 *
	 * @param	{DOMNode}			xml
	 * @return	{String[]}					Array of collection keys
	 */
	function _getDeletedCollectionKeys(updatedNode) {
		var keys = [];
		for each(var c in updatedNode.xpath("deleted/collections/collection")) {
			var libraryID = c.getAttribute('libraryID');
			libraryID = libraryID ? parseInt(libraryID) : null;
			keys.push({
				libraryID: libraryID,
				key: c.getAttribute('key')
			});
		}
		return keys;
	}
	
	
	this.processUpdatedXML = function (updatedNode, lastLocalSyncDate, syncSession, defaultLibraryID, callback) {
		updatedNode.xpath = function (path) {
			return Zotero.Utilities.xpath(this, path);
		};
		
		if (updatedNode.childNodes.length == 0) {
			Zotero.debug('No changes received from server');
			callback(Zotero.Sync.Server.Data.buildUploadXML(syncSession));
			return;
		}
		
		function _libID(libraryID) {
			return _getLibraryID(libraryID, defaultLibraryID);
		}
		
		function _timeToYield() {
			if (!progressMeter) {
				if (Date.now() - start > progressMeterThreshold) {
					Zotero.showZoteroPaneProgressMeter(
						Zotero.getString('sync.status.processingUpdatedData'),
						false,
						"chrome://zotero/skin/arrow_rotate_animated.png"
					);
					progressMeter = true;
				}
			}
			else if (Date.now() - lastRepaint > repaintTime) {
				lastRepaint = Date.now();
				return true;
			}
			return false;
		}
		
		var progressMeter = false;
		var progressMeterThreshold = 100;
		var start = Date.now();
		var repaintTime = 100;
		var lastRepaint = Date.now();
		
		var deletedCollectionKeys = _getDeletedCollectionKeys(updatedNode);
		
		var remoteCreatorStore = {};
		var relatedItemsStore = {};
		var itemStorageModTimes = {};
		var childItemStore = [];
		
		// Remotely changed groups
		var groupNodes = updatedNode.xpath("groups/group");
		if (groupNodes.length) {
			Zotero.debug("Processing remotely changed groups");
			for each(var groupNode in groupNodes) {
				var group = Zotero.Sync.Server.Data.xmlToGroup(groupNode);
				group.save();
			}
		}
		
		if (_timeToYield()) yield true;
		
		// Remotely deleted groups
		var deletedGroups = updatedNode.xpath("deleted/groups");
		if (deletedGroups.length && deletedGroups[0].textContent) {
			Zotero.debug("Processing remotely deleted groups");
			var groupIDs = deletedGroups[0].textContent.split(' ');
			Zotero.debug(groupIDs);
			
			for each(var groupID in groupIDs) {
				var group = Zotero.Groups.get(groupID);
				if (!group) {
					continue;
				}
				
				// TODO: prompt to save data to local library?
				
				group.erase();
			}
		}
		
		if (_timeToYield()) yield true;
		
		
		// TEMP: Resend tags requested by server
		try {
			for each(var tagsNode in updatedNode.xpath("fixtags/tags")) {
				var libraryID = _libID(tagsNode.getAttribute('libraryID'));
				if (libraryID && !Zotero.Libraries.isEditable(libraryID)) {
					continue;
				}
				var tagsKeys = tagsNode.textContent.split(' ');
				for each(var key in tagsKeys) {
					var sql = "SELECT tagID FROM tags WHERE libraryID=? AND key=?";
					var tagID = Zotero.DB.valueQuery(sql, [libraryID, key]);
					
					var sql = "SELECT COUNT(*) > 0 FROM itemTags WHERE tagID=?";
					if (tagID && Zotero.DB.valueQuery(sql, [tagID])) {
						var sql = "UPDATE tags SET clientDateModified=CURRENT_TIMESTAMP "
							+ "WHERE tagID=?";
						Zotero.DB.query(sql, [tagID]);
						syncSession.addToUpdated({
							objectType: 'tag',
							libraryID: libraryID,
							key: key
						});
					}
				}
			}
		}
		catch (e) {
			Components.utils.reportError(e);
			Zotero.debug(e);
		}
		if (_timeToYield()) yield true;
		
		
		// Get unmodified creators embedded within items -- this is necessary if, say,
		// a creator was deleted locally and appears in a new/modified item remotely
		var embeddedCreators = {};
		for each(var creatorNode in updatedNode.xpath("items/item/creator/creator")) {
			var libraryID = _libID(creatorNode.getAttribute('libraryID'));
			var key = creatorNode.getAttribute('key');
			
			var creatorObj = Zotero.Creators.getByLibraryAndKey(libraryID, key);
			// If creator exists locally, we don't need it
			if (creatorObj) {
				continue;
			}
			// Note which embedded creators are available
			var lkh = Zotero.Creators.makeLibraryKeyHash(libraryID, key);
			if (!embeddedCreators[lkh]) {
				embeddedCreators[lkh] = true;
			}
		}
		// Make sure embedded creators aren't already provided in the <creators> node
		// This isn't necessary if the server data is correct
		for each(var creatorNode in updatedNode.xpath("creators/creator")) {
			var libraryID = _libID(creatorNode.getAttribute('libraryID'));
			var key = creatorNode.getAttribute('key');
			var lkh = Zotero.Creators.makeLibraryKeyHash(libraryID, key);
			if (embeddedCreators[lkh]) {
				var msg = "Creator " + libraryID + "/" + key + " was unnecessarily embedded in server response "
							+ "in Zotero.Sync.Server.Data.processUpdatedXML()";
				Zotero.debug(msg, 2);
				Components.utils.reportError(msg)
				delete embeddedCreators[lkh];
			}
		}
		// For any embedded creators that don't exist locally and aren't already
		// included in the <creators> node, copy the node into <creators> for saving
		var creatorsNode = false;
		for each(var creatorNode in updatedNode.xpath("items/item/creator/creator")) {
			var libraryID = _libID(creatorNode.getAttribute('libraryID'));
			var key = creatorNode.getAttribute('key');
			
			var lkh = Zotero.Creators.makeLibraryKeyHash(libraryID, key);
			if (embeddedCreators[lkh]) {
				if (!creatorsNode) {
					creatorsNode = updatedNode.xpath("creators");
					if (creatorsNode.length) {
						creatorsNode = creatorsNode[0];
					}
					else {
						creatorsNode = updatedNode.ownerDocument.createElement("creators");
						updatedNode.appendChild(creatorsNode);
					}
				}
				
				Zotero.debug("Adding embedded creator " + libraryID + "/" + key + " to <creators>");
				
				creatorsNode.appendChild(creatorNode);
				delete embeddedCreators[lkh];
			}
		}
		
		if (_timeToYield()) yield true;
		
		// Other objects
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			
			var toSave = [];
			var toDelete = [];
			var toReconcile = [];
			var skipDateModifiedUpdateItems = {};
			
			// Display a warning once for each object type
			syncSession.suppressWarnings = false;
			
			//
			// Handle modified objects
			//
			Zotero.debug("Processing remotely changed " + types);
			
			typeloop:
			for each(var objectNode in updatedNode.xpath(types + "/" + type)) {
				var libraryID = _libID(objectNode.getAttribute('libraryID'));
				
				// Process remote settings
				if (type == 'setting') {
					var name = objectNode.getAttribute('name');
					if (!libraryID) {
						libraryID = 0;
					}
					Zotero.debug("Processing remote setting " + libraryID + "/" + name);
					var version = objectNode.getAttribute('version');
					var value = JSON.parse(objectNode.textContent);
					Zotero.SyncedSettings.setSynchronous(libraryID, name, value, version, true);
					continue;
				}
				else if (type == 'fulltext') {
					if (!libraryID) {
						libraryID = 0;
					}
					let key = objectNode.getAttribute('key');
					Zotero.debug("Processing remote full-text content for item " + libraryID + "/" + key);
					Zotero.Fulltext.setItemContent(
						libraryID,
						key,
						objectNode.textContent,
						{
							indexedChars: parseInt(objectNode.getAttribute('indexedChars')),
							totalChars: parseInt(objectNode.getAttribute('totalChars')),
							indexedPages: parseInt(objectNode.getAttribute('indexedPages')),
							totalPages: parseInt(objectNode.getAttribute('totalPages'))
						},
						parseInt(objectNode.getAttribute('version'))
					);
					continue;
				}
				
				var key = objectNode.getAttribute('key');
				var objLibraryKeyHash = Zotero[Types].makeLibraryKeyHash(libraryID, key);
				
				Zotero.debug("Processing remote " + type + " " + libraryID + "/" + key, 4);
				var isNewObject;
				var localDelete = false;
				var skipCR = false;
				var deletedItemKeys = null;
				
				// Get local object with same library and key
				var obj = Zotero[Types].getByLibraryAndKey(libraryID, key);
				if (obj) {
					Zotero.debug("Matching local " + type + " exists", 4);
					isNewObject = false;
					
					var objDate = Zotero.Date.sqlToDate(obj.dateModified, true);
					
					// Local object has been modified since last sync
					if ((objDate > lastLocalSyncDate &&
								objDate < Zotero.Sync.Server.nextLocalSyncDate)
							// Check for object in updated array, since it might
							// have been modified during sync process, making its
							// date equal to Zotero.Sync.Server.nextLocalSyncDate
							// and therefore excluded above
							|| syncSession.objectInUpdated(obj)) {
						
						Zotero.debug("Local " + type + " " + obj.id
								+ " has been modified since last sync", 4);
						
						// Merge and store related items, since CR doesn't
						// affect related items
						if (type == 'item') {
							// Remote
							var relKeys = _getFirstChildContent(objectNode, 'related');
							relKeys = relKeys ? relKeys.split(' ') : [];
							// Local
							for each(var relID in obj.relatedItems) {
								var relKey = Zotero.Items.get(relID).key;
								if (relKeys.indexOf(relKey) == -1) {
									relKeys.push(relKey);
								}
							}
							if (relKeys.length) {
								relatedItemsStore[objLibraryKeyHash] = relKeys;
							}
							Zotero.Sync.Server.Data.removeMissingRelatedItems(objectNode);
						}
						
						var remoteObj = Zotero.Sync.Server.Data['xmlTo' + Type](objectNode, null, null, defaultLibraryID);

						// Some types we don't bother to reconcile
						if (_noMergeTypes.indexOf(type) != -1) {
							// If local is newer, send to server
							if (obj.dateModified > remoteObj.dateModified) {
								syncSession.addToUpdated(obj);
								continue;
							}
							
							// Overwrite local below
						}
						// Mark other types for conflict resolution
						else {
							// Skip item if dateModified is the only modified
							// field (and no linked creators changed)
							switch (type) {
								// Will be handled by item CR for now
								case 'creator':
									remoteCreatorStore[Zotero.Creators.getLibraryKeyHash(remoteObj)] = remoteObj;
									syncSession.removeFromUpdated(obj);
									continue;
									
								case 'item':
									var diff = obj.diff(remoteObj, false, ["dateAdded", "dateModified"]);
									if (diff) {
										Zotero.debug('Diff:');
										Zotero.debug(diff);
										
										try {
											let dateField;
											if (!Object.keys(diff[0].primary).length
													&& !Object.keys(diff[1].primary).length
													&& !diff[0].creators.length
													&& !diff[1].creators.length
													&& Object.keys(diff[0].fields).length == 1
													&& (dateField = Object.keys(diff[0].fields)[0])
													&& Zotero.ItemFields.isFieldOfBase(dateField, 'date')
													&& /[0-9]{2}:[0-9]{2}:[0-9]{2}/.test(diff[0].fields[dateField])
													&& Zotero.Date.isSQLDateTime(diff[1].fields[dateField])
													&& diff[1].fields[dateField].substr(11).indexOf(diff[0].fields[dateField]) == 0) {
												Zotero.debug("Marking local item with corrupted SQL date for overwriting", 2);
												obj.setField(dateField, diff[1].fields[dateField]);
												skipDateModifiedUpdateItems[obj.id] = true;
												syncSession.removeFromUpdated(obj);
												skipCR = true;
												break;
											}
										}
										catch (e) {
											Components.utils.reportError(e);
											Zotero.debug(e, 1);
										}
									}
									else {
										// Check if creators changed
										var creatorsChanged = false;
										
										var creators = obj.getCreators();
										var remoteCreators = remoteObj.getCreators();
										
										if (creators.length != remoteCreators.length) {
											Zotero.debug('Creators have changed');
											creatorsChanged = true;
										}
										else {
											creators = creators.concat(remoteCreators);
											for each(var creator in creators) {
												var r = remoteCreatorStore[Zotero.Creators.getLibraryKeyHash(creator.ref)];
												// Doesn't include dateModified
												if (r && !r.equals(creator.ref)) {
													creatorsChanged = true;
													break;
												}
											}
										}
										if (!creatorsChanged) {
											syncSession.removeFromUpdated(obj);
											continue;
										}
									}
									
									// Always keep the parent item if there is one,
									// regardless of which side is chosen during CR
									var localParent = obj.getSourceKey();
									var remoteParent = remoteObj.getSourceKey();
									if (!localParent && remoteParent) {
										obj.setSourceKey(remoteParent);
									}
									else if (localParent && !remoteParent) {
										remoteObj.setSourceKey(localParent);
									}
									
									/*
									if (obj.deleted && !remoteObj.deleted) {
										obj = 'trashed';
									}
									else if (!obj.deleted && remoteObj.deleted) {
										remoteObj = 'trashed';
									}
									*/
									break;
								
								case 'collection':
									var changed = _mergeCollection(obj, remoteObj, syncSession);
									if (!changed) {
										syncSession.removeFromUpdated(obj);
										continue;
									}
									// The merged collection needs to be saved
									skipCR = true;
									break;
								
								case 'tag':
									var changed = _mergeTag(obj, remoteObj, syncSession);
									if (!changed) {
										syncSession.removeFromUpdated(obj);
									}
									continue;
							}
							
							// TODO: order reconcile by parent/child?
							
							if (!skipCR) {
								toReconcile.push([
									obj,
									remoteObj
								]);
								
								continue;
							}
						}
					}
					else {
						Zotero.debug("Local " + type + " has not changed", 4);
					}
					
					// Overwrite local below
				}
				
				// Object doesn't exist locally
				else {
					isNewObject = true;
					
					// Check if object has been deleted locally
					var fakeObj = {
						objectType: type,
						libraryID: libraryID,
						key: key
					};
					
					if (syncSession.objectInDeleted(fakeObj)) {
						// TODO: non-merged items
						
						switch (type) {
							case 'item':
								localDelete = true;
								break;
							
							// Auto-restore locally deleted tags and collections that
							// have changed remotely
							case 'tag':
							case 'collection':
								syncSession.removeFromDeleted(fakeObj);
								
								var msg = _generateAutoChangeLogMessage(
									type, null, objectNode.getAttribute('name')
								);
								Zotero.log(msg, 'warning');
								
								if (!syncSession.suppressWarnings) {
									var msg = _generateAutoChangeAlertMessage(
										types, null, objectNode.getAttribute('name')
									);
									alert(msg);
									syncSession.suppressWarnings = true;
								}
								
								deletedItemKeys = syncSession.getDeleted('item', libraryID);
								break;
							
							default:
								var msg = 'Cannot reconcile delete conflict for ' + type;
								var e = new Zotero.Error(msg, "FULL_SYNC_REQUIRED");
								throw (e);
						}
					}
				}
				
				
				// Temporarily remove and store related items that don't yet exist
				if (type == 'item') {
					var missing = Zotero.Sync.Server.Data.removeMissingRelatedItems(objectNode);
					if (missing.length) {
						relatedItemsStore[objLibraryKeyHash] = missing;
					}
				}
				
				// Create or overwrite locally
				//
				// If we skipped CR above, we already have an object to use
				if (!skipCR) {
					obj = Zotero.Sync.Server.Data['xmlTo' + Type](objectNode, obj, false, defaultLibraryID, deletedItemKeys);
				}
				
				if (isNewObject && type == 'tag') {
					// If a local tag matches the name of a different remote tag,
					// delete the local tag and add items linked to it to the
					// matching remote tag
					//
					// DEBUG: why use objectNode?
					var tagName = objectNode.getAttribute('name');
					var tagType = objectNode.getAttribute('type');
					tagType = tagType ? parseInt(tagType) : 0;
					var linkedItems = _deleteConflictingTag(syncSession, tagName, tagType, obj.libraryID);
					if (linkedItems) {
						var mod = false;
						for each(var id in linkedItems) {
							var added = obj.addItem(id);
							if (added) {
								mod = true;
							}
						}
						if (mod) {
							obj.dateModified = Zotero.DB.transactionDateTime;
							syncSession.addToUpdated({
								objectType: 'tag',
								libraryID: obj.libraryID,
								key: objectNode.getAttribute('key')
							});
						}
					}
				}
				
				if (localDelete) {
					// TODO: order reconcile by parent/child?
					
					toReconcile.push([
						'deleted',
						obj
					]);
				}
				else {
					toSave.push(obj);
				}
				
				if (type == 'item') {
					// Make sure none of the item's creators are marked as
					// deleted, which could happen if a creator was deleted
					// locally but attached to a new/modified item remotely
					// and added back in xmlToItem()
					if (obj.isRegularItem()) {
						var creators = obj.getCreators();
						for each(var creator in creators) {
							syncSession.removeFromDeleted(creator.ref);
						}
					}
					else if (obj.isImportedAttachment()) {
						// Mark new attachments for download
						if (isNewObject) {
							obj.attachmentSyncState =
								Zotero.Sync.Storage.SYNC_STATE_TO_DOWNLOAD;
						}
						// Set existing attachments for mtime update check
						else {
							var mtime = objectNode.getAttribute('storageModTime');
							if (mtime) {
								// Convert previously used Unix timestamps to ms-based timestamps
								if (mtime < 10000000000) {
									Zotero.debug("Converting Unix timestamp '" + mtime + "' to milliseconds");
									mtime = mtime * 1000;
								}
								itemStorageModTimes[obj.id] = parseInt(mtime);
							}
						}
					}
				}
				// Fix potential FK constraint error on fki_collectionItems_itemID_sourceItemID
				//
				// STR:
				// 
				// Create an empty note on A.
				// Create an empty item on A.
				// Create a collection on A.
				// Drag item to collection on A.
				// Sync A.
				// Sync B.
				// Drag note to collection on B.
				// Sync B.
				// Drag note under item on A.
				// Sync A.
				// 
				// Explanation:
				//
				// Dragging note to collection on B doesn't modify the note
				// and only sends the collection-items change.
				// When sync on A tries to add the note to the collection,
				// an error occurs, because the note is now a child note locally,
				// and a child note can't belong to a collection.
				//
				// We fix this by removing child items from collections they
				// would be in after saving, and we add their parents instead.
				else if (type == 'collection') {
					var childItems = obj.getChildItems(false, true);
					var existing = [];
					var toAdd = [];
					var toRemove = [];
					for each(var childItem in childItems) {
						existing.push(childItem.id);
						var parentItem = childItem.getSource();
						if (parentItem) {
							parentItem = Zotero.Items.get(parentItem);
							// Add parent to collection
							toAdd.push(parentItem.id);
							// Remove child from collection
							toRemove.push(childItem.id);
						}
					}
					// Add
					toAdd = Zotero.Utilities.arrayDiff(toAdd, existing);
					var changed = toAdd.length > 0;
					existing = existing.concat(toAdd);
					var origLen = existing.length;
					// Remove
					existing = Zotero.Utilities.arrayDiff(existing, toRemove);
					changed = changed || origLen != existing.length;
					// Set
					if (changed) {
						obj.childItems = existing;
						syncSession.addToUpdated(obj);
					}
				}
				
				if (_timeToYield()) yield true;
			}
			
			//
			// Handle remotely deleted objects
			//
			var deletedObjectNodes = updatedNode.xpath("deleted/" + types + "/" + type);
			if (deletedObjectNodes.length) {
				Zotero.debug("Processing remotely deleted " + types);
				
				syncSession.suppressWarnings = false;
				
				for each(var delNode in deletedObjectNodes) {
					var libraryID = _libID(delNode.getAttribute('libraryID'));
					var key = delNode.getAttribute('key');
					
					// Process remote settings deletions
					if (type == 'setting') {
						if (!libraryID) {
							libraryID = 0;
						}
						Zotero.debug("Processing remote setting " + libraryID + "/" + key);
						Zotero.Sync.EventListener.ignoreDeletions('setting', [libraryID + "/" + key]);
						Zotero.SyncedSettings.setSynchronous(libraryID, key);
						continue;
					}
					
					var obj = Zotero[Types].getByLibraryAndKey(libraryID, key);
					// Object can't be found
					if (!obj) {
						// Since it's already deleted remotely, don't include
						// the object in the deleted array if something else
						// caused its deletion during the sync
						syncSession.removeFromDeleted({
							objectType: type,
							libraryID: libraryID,
							key: key
						});
						continue;
					}
					
					var modDate = Zotero.Date.sqlToDate(obj.dateModified, true);
					
					// Local object hasn't been modified -- delete
					if (modDate < lastLocalSyncDate) {
						toDelete.push(obj.id);
						continue;
					}
					
					// Local object has been modified since last sync -- reconcile
					switch (type) {
						case 'item':
							// TODO: order reconcile by parent/child
							toReconcile.push([obj, 'deleted']);
							break;
						
						case 'tag':
						case 'collection':
							var msg = _generateAutoChangeLogMessage(
								type, obj.name, null
							);
							Zotero.log(msg, 'warning');
							
							if (!syncSession.suppressWarnings) {
								var msg = _generateAutoChangeAlertMessage(
									types, obj.name, null
								);
								alert(msg);
								syncSession.suppressWarnings = true;
							}
							continue;
							
						default:
							Components.utils.reportError('Delete reconciliation unimplemented for ' + types + ' -- ignoring');
							continue;
					}
				}
				
				if (_timeToYield()) yield true;
			}
			
			
			//
			// Reconcile objects that have changed locally and remotely
			//
			if (toReconcile.length) {
				if (Zotero.Sync.Runner.background) {
					Zotero.Sync.Server.manualSyncRequired = true;
					
					var msg = Zotero.getString('sync.error.manualInterventionRequired')
					  + "\n\n"
					  + Zotero.getString('sync.error.clickSyncIcon');
					var e = new Zotero.Error(msg, 0, { dialogButtonText: null });
					throw (e);
				}
				
				var mergeData = _reconcile(type, toReconcile, remoteCreatorStore);
				if (!mergeData) {
					Zotero.DB.rollbackTransaction();
					callback(false);
					return;
				}
				_processMergeData(
					syncSession,
					type,
					mergeData,
					toSave,
					toDelete,
					relatedItemsStore
				);
			}
			
			if (_timeToYield()) yield true;
			
			// Save objects
			Zotero.debug('Saving merged ' + types);
			
			if (type == 'collection') {
				for each(var col in toSave) {
					var changed = _removeChildItemsFromCollection(col, childItemStore);
					if (changed) {
						syncSession.addToUpdated(col);
					}
				}
				
				// Save collections recursively from the top down
				_saveCollections(toSave);
			}
			else if (type == 'item') {
				// Save parent items first
				for (var i=0; i<toSave.length; i++) {
					if (!toSave[i].getSourceKey()) {
						toSave[i].save({
							skipDateModifiedUpdate: !!skipDateModifiedUpdateItems[toSave[i].id]
						});
						toSave.splice(i, 1);
						i--;
					}
				}
				
				// Save the rest
				for each(var obj in toSave) {
					// Keep list of all child items being saved
					var store = false;
					if (!obj.isTopLevelItem()) {
						store = true;
					}
					
					obj.save();
					
					if (store) {
						childItemStore.push(obj.id)
					}
					
					if (_timeToYield()) yield true;
				}
				
				// Add back related items (which now exist)
				for (var libraryKeyHash in relatedItemsStore) {
					var lk = Zotero.Items.parseLibraryKeyHash(libraryKeyHash);
					var item = Zotero.Items.getByLibraryAndKey(lk.libraryID, lk.key);
					for each(var relKey in relatedItemsStore[libraryKeyHash]) {
						var relItem = Zotero.Items.getByLibraryAndKey(lk.libraryID, relKey);
						if (!relItem) {
							var msg = "Related item doesn't exist in Zotero.Sync.Server.Data.processUpdatedXML() "
										+ "(" + lk.libraryID + "/" + relKey + ")";
							var e = new Zotero.Error(msg, "MISSING_OBJECT");
							throw (e);
						}
						item.addRelatedItem(relItem.id);
					}
					item.save({
						skipDateModifiedUpdate: true
					});
				}
			}
			else if (type == 'tag') {
				// Use a special saving mode for tags to avoid an issue that
				// occurs if a tag has changed names remotely but another tag
				// conflicts with the local version after the first tag has been
				// updated in memory, causing a deletion of the local tag.
				// Using the normal save mode, when the first remote tag then
				// goes to save, the linked items aren't saved, since as far
				// as the in-memory object is concerned, they haven't changed,
				// even though they've been deleted from the DB.
				//
				// To replicate, add an item, add a tag, sync both sides,
				// rename the tag, add a new one with the old name, and sync.
				for each(var obj in toSave) {
					obj.save(true);
					
					if (_timeToYield()) yield true;
				}
			}
			else if (type == 'relation') {
				for each(var obj in toSave) {
					if (obj.exists()) {
						continue;
					}
					obj.save();
					
					if (_timeToYield()) yield true;
				}
			}
			else {
				for each(var obj in toSave) {
					obj.save();
					
					if (_timeToYield()) yield true;
				}
			}
			
			// Delete
			Zotero.debug('Deleting merged ' + types);
			if (toDelete.length) {
				// Items have to be deleted children-first
				if (type == 'item') {
					var parents = [];
					var children = [];
					for each(var id in toDelete) {
						var item = Zotero.Items.get(id);
						if (item.getSource()) {
							children.push(item.id);
						}
						else {
							parents.push(item.id);
						}
						
						if (_timeToYield()) yield true;
					}
					
					// Lock dateModified in local versions of remotely deleted
					// collections so that any deleted items within them don't
					// update them, which would trigger erroneous conflicts
					var collections = [];
					for each(var col in deletedCollectionKeys) {
						col = Zotero.Collections.getByLibraryAndKey(col.libraryID, col.key);
						// If collection never existed on this side
						if (!col) {
							continue;
						}
						col.lockDateModified();
						collections.push(col);
					}
					
					if (children.length) {
						Zotero.Sync.EventListener.ignoreDeletions('item', children);
						Zotero.Items.erase(children);
					}
					if (parents.length) {
						Zotero.Sync.EventListener.ignoreDeletions('item', parents);
						Zotero.Items.erase(parents);
					}
					
					// Unlock dateModified for deleted collections
					for each(var col in collections) {
						col.unlockDateModified();
					}
					collections = null;
				}
				else {
					Zotero.Sync.EventListener.ignoreDeletions(type, toDelete);
					Zotero[Types].erase(toDelete);
				}
			}
			
			if (_timeToYield()) yield true;
			
			// Check mod times and hashes of updated items against stored values to see
			// if they've been updated elsewhere and mark for download if so
			if (type == 'item' && Object.keys(itemStorageModTimes).length) {
				yield Zotero.Sync.Storage.checkForUpdatedFiles(null, null, itemStorageModTimes);
			}
		}
		
		if (_timeToYield()) yield true;
		
		callback(Zotero.Sync.Server.Data.buildUploadXML(syncSession));
	};
	
	
	/**
	 * @param	{Zotero.Sync.Server.Session}		syncSession
	 */
	this.buildUploadXML = function (syncSession) {
		//Zotero.debug(syncSession);
		var keys = syncSession.uploadKeys;
		
		var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
						.createInstance(Components.interfaces.nsIDOMParser);
		var doc = parser.parseFromString("<data/>", "text/xml");
		var docElem = doc.documentElement;
		
		// Add API version attribute
		docElem.setAttribute('version', Zotero.Sync.Server.apiVersion);
		
		// Updates
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			var objectsNode = false;
			
			if (type == 'setting') {
				continue;
			}
			
			Zotero.debug("Processing locally changed " + types);
			
			var libraryID, key;
			for (var libraryID in keys.updated[types]) {
				for (var key in keys.updated[types][libraryID]) {
					// Insert the <[types]> node
					if (!objectsNode) {
						objectsNode = docElem.appendChild(doc.createElement(types));
					}
					
					var l = parseInt(libraryID);
					l = l ? l : null;
					var obj = Zotero[Types].getByLibraryAndKey(l, key);
					if (!obj) {
						Zotero.debug("Updated " + type + " " + l + "/" + key + " has disappeared -- skipping");
						syncSession.removeFromUpdated({
							objectType: type,
							libraryID: l,
							key: key
						});
						continue;
					}
					
					if (type == 'item') {
						// itemToXML needs the sync session
						var elem = this.itemToXML(obj, doc, syncSession);
					}
					else {
						var elem = this[type + 'ToXML'](obj, doc);
					}
					
					objectsNode.appendChild(elem);
				}
			}
		}
		
		// Add unsynced settings
		var sql = "SELECT libraryID, setting, value FROM syncedSettings WHERE synced=0";
		var rows = Zotero.DB.query(sql);
		if (rows) {
			var settingsNode = doc.createElement('settings');
			for (var i=0; i<rows.length; i++) {
				var settingNode = doc.createElement('setting');
				settingNode.setAttribute('libraryID', rows[i].libraryID ? rows[i].libraryID : Zotero.libraryID);
				settingNode.setAttribute('name', rows[i].setting);
				settingNode.appendChild(doc.createTextNode(_xmlize(rows[i].value)));
				settingsNode.appendChild(settingNode);
			}
			docElem.appendChild(settingsNode);
		}
		
		if (Zotero.Prefs.get("sync.fulltext.enabled")) {
			// Add up to 500K characters of full-text content
			try {
				var rows = Zotero.Fulltext.getUnsyncedContent(500000);
			}
			catch (e) {
				Zotero.debug(e, 1);
				Components.utils.reportError(e);
				var rows = [];
			}
			if (rows.length) {
				let fulltextsNode = doc.createElement('fulltexts');
				syncSession.fulltextItems = [];
				for (let i=0; i<rows.length; i++) {
					syncSession.fulltextItems.push({
						libraryID: rows[i].libraryID,
						key: rows[i].key
					})
					let node = doc.createElement('fulltext');
					node.setAttribute('libraryID', rows[i].libraryID ? rows[i].libraryID : Zotero.libraryID);
					node.setAttribute('key', rows[i].key);
					node.setAttribute('indexedChars', rows[i].indexedChars);
					node.setAttribute('totalChars', rows[i].totalChars);
					node.setAttribute('indexedPages', rows[i].indexedPages);
					node.setAttribute('totalPages', rows[i].totalPages);
					node.appendChild(doc.createTextNode(_xmlize(rows[i].text)));
					fulltextsNode.appendChild(node);
				}
				docElem.appendChild(fulltextsNode);
			}
		}
		
		// Deletions
		var deletedNode = doc.createElement('deleted');
		var inserted = false;
		
		var defaultLibraryID = Zotero.libraryID;
		
		for each(var syncObject in Zotero.Sync.syncObjects) {
			var Type = syncObject.singular; // 'Item'
			var Types = syncObject.plural; // 'Items'
			var type = Type.toLowerCase(); // 'item'
			var types = Types.toLowerCase(); // 'items'
			var deletedObjectsNode = false;
			
			Zotero.debug('Processing locally deleted ' + types);
			
			var elementCreated = false;
			var libraryID, key;
			for (var libraryID in keys.deleted[types]) {
				for (var key in keys.deleted[types][libraryID]) {
					// Insert the <deleted> node
					if (!inserted) {
						docElem.appendChild(deletedNode);
						inserted = true;
					}
					// Insert the <deleted><[types]></deleted> node
					if (!deletedObjectsNode) {
						deletedObjectsNode = deletedNode.appendChild(doc.createElement(types));
					}
					
					var n = doc.createElement(type);
					n.setAttribute('libraryID', parseInt(libraryID) ? parseInt(libraryID) : defaultLibraryID);
					n.setAttribute('key', key);
					deletedObjectsNode.appendChild(n);
				}
			}
		}
		
		
		var s = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
					.createInstance(Components.interfaces.nsIDOMSerializer);
		var xmlstr = s.serializeToString(doc);
		
		// No updated data
		if (docElem.childNodes.length == 0) {
			return '';
		}
		
		return xmlstr;
	}
	
	
	// Remove any child items from collection, which might exist if an attachment in a collection was
	// remotely changed from a	top-level item to a child item
	function _removeChildItemsFromCollection(collection, childItems) {
		if (!childItems.length) {
			return false;
		}
		var itemIDs = collection.getChildItems(true);
		// TODO: fix to always return array
		if (!itemIDs) {
			return false;
		}
		var newItemIDs = Zotero.Utilities.arrayDiff(itemIDs, childItems);
		if (itemIDs.length == newItemIDs.length) {
			return false;
		}
		collection.childItems = newItemIDs;
		return true;
	}
	
	
	function _mergeCollection(localObj, remoteObj, syncSession) {
		var diff = localObj.diff(remoteObj, false, true);
		if (!diff) {
			return false;
		}
		
		Zotero.debug("COLLECTION HAS CHANGED");
		Zotero.debug(diff);
		
		// Local is newer
		if (diff[0].primary.dateModified > diff[1].primary.dateModified) {
			Zotero.debug("Local is newer");
			var remoteIsTarget = false;
			var targetObj = localObj;
		}
		// Remote is newer
		else {
			Zotero.debug("Remote is newer");
			var remoteIsTarget = true;
			var targetObj = remoteObj;
		}
		
		if (diff[0].fields.name) {
			var msg = _generateAutoChangeLogMessage(
				'collection', diff[0].fields.name, diff[1].fields.name, remoteIsTarget
			);
			Zotero.log(msg, 'warning');
			
			if (!syncSession.suppressWarnings) {
				var msg = _generateAutoChangeAlertMessage(
					'collections', diff[0].fields.name, diff[1].fields.name, remoteIsTarget
				);
				alert(msg);
				syncSession.suppressWarnings = true;
			}
		}
		
		// Check for child collections in the other object
		// that aren't in the target one
		if (diff[1].childCollections.length) {
			// TODO: log
			// TODO: add
			throw ("Collection hierarchy conflict resolution is unimplemented");
		}
		
		// Add items to local object, which is what's saved
		if (diff[1].childItems.length) {
			var childItems = localObj.getChildItems(true);
			if (childItems) {
				localObj.childItems = childItems.concat(diff[1].childItems);
			}
			else {
				localObj.childItems = diff[1].childItems;
			}
			
			var msg = _generateCollectionItemMergeLogMessage(
				targetObj.name,
				diff[0].childItems.concat(diff[1].childItems)
			);
			Zotero.log('warning');
			
			if (!syncSession.suppressWarnings) {
				
				alert(msg);
			}
		}
		
		return true;
	}
	
	
	function _mergeTag(localObj, remoteObj, syncSession) {
		var diff = localObj.diff(remoteObj, false, true);
		if (!diff) {
			return false;
		}
		
		Zotero.debug("TAG HAS CHANGED");
		Zotero.debug(diff);
		
		// Local is newer
		if (diff[0].primary.dateModified >
				diff[1].primary.dateModified) {
			var remoteIsTarget = false;
			var targetObj = localObj;
			var targetDiff = diff[0];
			var otherDiff = diff[1];
		}
		// Remote is newer
		else {
			var remoteIsTarget = true;
			var targetObj = remoteObj;
			var targetDiff = diff[1];
			var otherDiff = diff[0];
		}
		
		if (targetDiff.fields.name) {
			var msg = _generateAutoChangeLogMessage(
				'tag', diff[0].fields.name, diff[1].fields.name, remoteIsTarget
			);
			Zotero.log(msg, 'warning');
			
			if (!syncSession.suppressWarnings) {
				var msg = _generateAutoChangeAlertMessage(
					'tags', diff[0].fields.name, diff[1].fields.name, remoteIsTarget
				);
				alert(msg);
				syncSession.suppressWarnings = true;
			}
		}
		
		// Add linked items in the other object to the target one
		if (otherDiff.linkedItems.length) {
			// need to handle changed items
			
			var linkedItems = targetObj.getLinkedItems(true);
			targetObj.linkedItems = linkedItems.concat(otherDiff.linkedItems);
			
			var msg = _generateTagItemMergeLogMessage(
				targetObj.name,
				otherDiff.linkedItems,
				remoteIsTarget
			);
			Zotero.log(msg, 'warning');
			
			if (!syncSession.suppressWarnings) {
				var msg = _generateTagItemMergeAlertMessage();
				alert(msg);
				syncSession.suppressWarnings = true;
			}
		}
		
		targetObj.save();
		return true;
	}
	
	
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
		for each(var id in addedItemIDs) {
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
	
	
	/**
	 * Process the results of conflict resolution
	 */
	function _processMergeData(syncSession, type, data, toSave, toDelete, relatedItems) {
		var Types = Zotero.Sync.syncObjects[type].plural;
		var types = Zotero.Sync.syncObjects[type].plural.toLowerCase();
		
		for each(var obj in data) {
			// TODO: do we need to make sure item isn't already being saved?
			
			// Handle items deleted during merge
			if (obj.ref == 'deleted') {
				// Deleted item was remote
				if (obj.left != 'deleted') {
					toDelete.push(obj.id);
					
					var libraryKeyHash = Zotero[Types].getLibraryKeyHash(obj.ref);
					if (relatedItems[libraryKeyHash]) {
						delete relatedItems[libraryKeyHash];
					}
					
					syncSession.addToDeleted(obj.left);
				}
				continue;
			}
			
			toSave.push(obj.ref);
			
			// Item had been deleted locally, so remove from
			// deleted array
			if (obj.left == 'deleted') {
				syncSession.removeFromDeleted(obj.ref);
			}
			
			// TODO: only upload if the local item was chosen
			// or remote item was changed
			syncSession.addToUpdated(obj.ref);
		}
	}
	
	
	this.removeMissingRelatedItems = function (itemNode) {
		var relatedNode = Zotero.Utilities.xpath(itemNode, "related");
		if (!relatedNode.length) {
			return [];
		}
		relatedNode = relatedNode[0];
		var libraryID = parseInt(itemNode.getAttribute('libraryID'));
		var exist = [];
		var missing = [];
		var relKeys = relatedNode.textContent;
		relKeys = relKeys ? relKeys.split(' ') : [];
		for each(var relKey in relKeys) {
			if (Zotero.Items.getByLibraryAndKey(libraryID, relKey)) {
				exist.push(relKey);
			}
			else {
				missing.push(relKey);
			}
		}
		relatedNode.textContent = exist.join(' ');
		return missing;
	}
	
	
	function _xmlize(str) {
		return str.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/g, '\u2B1A');
	}
}
