/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2008–2013 Center for History and New Media
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

"use strict";

Zotero_Preferences.Sync = {
	init: function () {
		this.updateStorageSettings(null, null, true);
		
		document.getElementById('sync-password').value = Zotero.Sync.Server.password;
		var pass = Zotero.Sync.Storage.WebDAV.password;
		if (pass) {
			document.getElementById('storage-password').value = pass;
		}
	},
	
	updateStorageSettings: function (enabled, protocol, skipWarnings) {
		if (enabled === null) {
			enabled = document.getElementById('pref-storage-enabled').value;
		}
		
		var oldProtocol = document.getElementById('pref-storage-protocol').value;
		if (protocol === null) {
			protocol = oldProtocol;
		}
		
		var storageSettings = document.getElementById('storage-settings');
		var protocolMenu = document.getElementById('storage-protocol');
		var settings = document.getElementById('storage-webdav-settings');
		var sep = document.getElementById('storage-separator');
		
		if (!enabled || protocol == 'zotero') {
			settings.hidden = true;
			sep.hidden = false;
		}
		else {
			settings.hidden = false;
			sep.hidden = true;
		}
		
		var menulists = storageSettings.getElementsByTagName('menulist');
		for each(var menulist in menulists) {
			if (menulist.className == 'storage-personal') {
				menulist.disabled = !enabled;
			}
		}
		
		if (!skipWarnings) {
			// WARN if going between
		}
		
		if (oldProtocol == 'zotero' && protocol == 'webdav') {
			var sql = "SELECT COUNT(*) FROM version WHERE schema LIKE 'storage_zfs%'";
			if (Zotero.DB.valueQuery(sql)) {
				var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
									+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING)
									+ ps.BUTTON_DELAY_ENABLE;
				var account = Zotero.Sync.Server.username;
				var index = ps.confirmEx(
					null,
					Zotero.getString('zotero.preferences.sync.purgeStorage.title'),
					Zotero.getString('zotero.preferences.sync.purgeStorage.desc'),
					buttonFlags,
					Zotero.getString('zotero.preferences.sync.purgeStorage.confirmButton'),
					Zotero.getString('zotero.preferences.sync.purgeStorage.cancelButton'), null, null, {}
				);
				
				if (index == 0) {
					var sql = "INSERT OR IGNORE INTO settings VALUES (?,?,?)";
					Zotero.DB.query(sql, ['storage', 'zfsPurge', 'user']);
					
					Zotero.Sync.Storage.ZFS.purgeDeletedStorageFiles()
					.then(function () {
						ps.alert(
							null,
							Zotero.getString("general.success"),
							"Attachment files from your personal library have been removed from the Zotero servers."
						);
					})
					.catch(function (e) {
						Zotero.debug(e, 1);
						Components.utils.reportError(e);
						
						ps.alert(
							null,
							Zotero.getString("general.error"),
							"An error occurred. Please try again later."
						);
					});
				}
			}
		}
		
		var self = this;
		setTimeout(function () {
			self.updateStorageTerms();
		}, 1)
	},
	
	
	updateStorageSettingsGroups: function (enabled) {
		var storageSettings = document.getElementById('storage-settings');
		var menulists = storageSettings.getElementsByTagName('menulist');
		for each(var menulist in menulists) {
			if (menulist.className == 'storage-groups') {
				menulist.disabled = !enabled;
			}
		}
		
		var self = this;
		setTimeout(function () {
			self.updateStorageTerms();
		}, 1)
	},
	
	
	updateStorageTerms: function () {
		var terms = document.getElementById('storage-terms');
		
		var libraryEnabled = document.getElementById('pref-storage-enabled').value;
		var storageProtocol = document.getElementById('pref-storage-protocol').value;
		var groupsEnabled = document.getElementById('pref-group-storage-enabled').value;
		
		terms.hidden = !((libraryEnabled && storageProtocol == 'zotero') || groupsEnabled);
	},
	
	
	unverifyStorageServer: function () {
		Zotero.Prefs.set('sync.storage.verified', false);
		Zotero.Sync.Storage.WebDAV.clearCachedCredentials();
		Zotero.Sync.Storage.resetAllSyncStates(null, true, false);
	},
	
	
	verifyStorageServer: function () {
		Zotero.debug("Verifying storage");
		
		var verifyButton = document.getElementById("storage-verify");
		var abortButton = document.getElementById("storage-abort");
		var progressMeter = document.getElementById("storage-progress");
		var urlField = document.getElementById("storage-url");
		var usernameField = document.getElementById("storage-username");
		var passwordField = document.getElementById("storage-password");
		
		verifyButton.hidden = true;
		abortButton.hidden = false;
		progressMeter.hidden = false;
		
		var request = null;
		var onDone = false;
		
		Zotero.Sync.Storage.WebDAV.checkServer()
		// Get the XMLHttpRequest for possible cancelling
		.progress(function (obj) {
			request = obj.xmlhttp;
		})
		.finally(function () {
			verifyButton.hidden = false;
			abortButton.hidden = true;
			progressMeter.hidden = true;
		})
		.spread(function (uri, status) {
			switch (status) {
				case Zotero.Sync.Storage.ERROR_NO_URL:
					onDone = function () {
						urlField.focus();
					};
					break;
				
				case Zotero.Sync.Storage.ERROR_NO_USERNAME:
					onDone = function () {
						usernameField.focus();
					};
					break;
				
				case Zotero.Sync.Storage.ERROR_NO_PASSWORD:
				case Zotero.Sync.Storage.ERROR_AUTH_FAILED:
					onDone = function () {
						passwordField.focus();
					};
					break;
			}
			
			return Zotero.Sync.Storage.WebDAV.checkServerCallback(uri, status, window);
		})
		.then(function (success) {
			if (success) {
				Zotero.debug("WebDAV verification succeeded");
				
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
				promptService.alert(
					window,
					Zotero.getString('sync.storage.serverConfigurationVerified'),
					Zotero.getString('sync.storage.fileSyncSetUp')
				);
				Zotero.Prefs.set("sync.storage.verified", true);
			}
			else {
				Zotero.debug("WebDAV verification failed");
				if (onDone) {
					setTimeout(function () {
						onDone();
					}, 1);
				}
			}
		})
		.catch(function (e) {
			Zotero.debug("WebDAV verification failed");
			Zotero.debug(e, 1);
			Components.utils.reportError(e);
			Zotero.Utilities.Internal.errorPrompt(Zotero.getString('general.error'), e);
			
			if (onDone) {
				setTimeout(function () {
					onDone();
				}, 1);
			}
		})
		.done();
		
		abortButton.onclick = function () {
			if (request) {
				Zotero.debug("Cancelling verification request");
				request.onreadystatechange = undefined;
				request.abort();
				verifyButton.hidden = false;
				abortButton.hidden = true;
				progressMeter.hidden = true;
			}
		}
	},
	
	
	handleSyncResetSelect: function (obj) {
		var index = obj.selectedIndex;
		var rows = obj.getElementsByTagName('row');
		
		for (var i=0; i<rows.length; i++) {
			if (i == index) {
				rows[i].setAttribute('selected', 'true');
			}
			else {
				rows[i].removeAttribute('selected');
			}
		}
	},
	
	
	handleSyncReset: function (action) {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		if (!Zotero.Sync.Server.enabled) {
			ps.alert(
				null,
				Zotero.getString('general.error'),
				Zotero.getString('zotero.preferences.sync.reset.userInfoMissing',
								document.getElementById('zotero-prefpane-sync')
								.getElementsByTagName('tab')[0].label)
			);
			return;
		}
		
		var account = Zotero.Sync.Server.username;
		
		switch (action) {
			case 'restore-from-server':
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
									+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
									+ ps.BUTTON_POS_1_DEFAULT;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					Zotero.getString('zotero.preferences.sync.reset.restoreFromServer', account),
					buttonFlags,
					Zotero.getString('zotero.preferences.sync.reset.replaceLocalData'),
					null, null, null, {}
				);
				
				switch (index) {
					case 0:
						// TODO: better error handling
						
						// Verify username and password
						var callback = function () {
							Zotero.Schema.stopRepositoryTimer();
							Zotero.Sync.Runner.clearSyncTimeout();
							
							Zotero.DB.skipBackup = true;
							
							var file = Zotero.getZoteroDirectory();
							file.append('restore-from-server');
							Zotero.File.putContents(file, '');
							
							var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING);
							var index = ps.confirmEx(
								null,
								Zotero.getString('general.restartRequired'),
								Zotero.getString('zotero.preferences.sync.reset.restartToComplete'),
								buttonFlags,
								Zotero.getString('general.restartNow'),
								null, null, null, {}
							);
							
							var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
									.getService(Components.interfaces.nsIAppStartup);
							appStartup.quit(Components.interfaces.nsIAppStartup.eRestart | Components.interfaces.nsIAppStartup.eAttemptQuit);
						};
						
						// TODO: better way of checking for an active session?
						if (Zotero.Sync.Server.sessionIDComponent == 'sessionid=') {
							Zotero.Sync.Server.login()
							.then(callback)
							.done();
						}
						else {
							callback();
						}
						break;
					
					// Cancel
					case 1:
						return;
				}
				break;
			
			case 'restore-to-server':
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
								+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
								+ ps.BUTTON_POS_1_DEFAULT;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					Zotero.getString('zotero.preferences.sync.reset.restoreToServer', account),
					buttonFlags,
					Zotero.getString('zotero.preferences.sync.reset.replaceServerData'),
					null, null, null, {}
				);
				
				switch (index) {
					case 0:
						// TODO: better error handling
						Zotero.Sync.Server.clear(function () {
							Zotero.Sync.Server.sync(/*{
								
								// TODO: this doesn't work if the pref window is 
								closed. fix, perhaps by making original callbacks
								available to the custom callbacks
								
								onSuccess: function () {
									Zotero.Sync.Runner.updateIcons();
									ps.alert(
										null,
										"Restore Completed",
										"Data on the Zotero server has been successfully restored."
									);
								},
								onError: function (msg) {
									// TODO: combine with error dialog for regular syncs
									ps.alert(
										null,
										"Restore Failed",
										"An error occurred uploading your data to the server.\n\n"
											+ "Click the sync error icon in the Zotero toolbar "
											+ "for further information."
									);
									Zotero.Sync.Runner.error(msg);
								}
							}*/);
						});
						break;
					
					// Cancel
					case 1:
						return;
				}
				
				break;
			
			
			case 'reset-storage-history':
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
								+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
								+ ps.BUTTON_POS_1_DEFAULT;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					Zotero.getString('zotero.preferences.sync.reset.fileSyncHistory'),
					buttonFlags,
					Zotero.getString('general.reset'),
					null, null, null, {}
				);
				
				switch (index) {
					case 0:
						Zotero.Sync.Storage.resetAllSyncStates();
						ps.alert(
							null,
							"File Sync History Cleared",
							"The file sync history has been cleared."
						);
						break;
					
					// Cancel
					case 1:
						return;
				}
				
				break;
			
			default:
				throw ("Invalid action '" + action + "' in handleSyncReset()");
		}
	}
};
