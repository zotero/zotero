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
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/osfile.jsm");

Zotero_Preferences.Sync = {
	init: Zotero.Promise.coroutine(function* () {
		this.updateStorageSettingsUI();

		var username = Zotero.Users.getCurrentUsername() || Zotero.Prefs.get('sync.server.username') || " ";
		var apiKey = yield Zotero.Sync.Data.Local.getAPIKey();
		this.displayFields(apiKey ? username : "");
		
		var pass = Zotero.Sync.Runner.getStorageController('webdav').password;
		if (pass) {
			document.getElementById('storage-password').value = pass;
		}
		
		if (apiKey) {
			try {
				var keyInfo = yield Zotero.Sync.Runner.checkAccess(
					Zotero.Sync.Runner.getAPIClient({apiKey}),
					{timeout: 5000}
				);
				this.displayFields(keyInfo.username);
				Zotero.Users.setCurrentUsername(keyInfo.username);
			}
			catch (e) {
				// API key wrong/invalid
				if (!(e instanceof Zotero.HTTP.UnexpectedStatusException)
						&& !(e instanceof Zotero.HTTP.TimeoutException)
						&& !(e instanceof Zotero.HTTP.BrowserOfflineException)) {
					Zotero.alert(
						window,
						Zotero.getString('general.error'),
						Zotero.getString('sync.error.apiKeyInvalid', Zotero.clientName)
					);
					this.unlinkAccount(false);
				}
				else {
					throw e;
				}
			}
		}
	}),

	displayFields: function (username) {
		document.getElementById('sync-unauthorized').hidden = !!username;
		document.getElementById('sync-authorized').hidden = !username;
		document.getElementById('sync-reset-tab').disabled = !username;
		document.getElementById('sync-username').value = username;
		document.getElementById('sync-password').value = '';
		document.getElementById('sync-username-textbox').value = Zotero.Prefs.get('sync.server.username');

		var img = document.getElementById('sync-status-indicator');
		img.removeAttribute('verified');
		img.removeAttribute('animated');
		
		window.sizeToContent();
	},


	credentialsKeyPress: function (event) {
		var username = document.getElementById('sync-username-textbox');
		var password = document.getElementById('sync-password');

		var syncAuthButton = document.getElementById('sync-auth-button');

		syncAuthButton.setAttribute('disabled', 'true');

		// When using backspace, the value is not updated until after the keypress event
		setTimeout(function() {
			if (username.value.length && password.value.length) {
				syncAuthButton.setAttribute('disabled', 'false');
			}
		});

		if (event.keyCode == 13) {
			Zotero_Preferences.Sync.linkAccount(event);
			event.preventDefault();
		}
	},
	
	
	trimUsername: function () {
		var tb = document.getElementById('sync-username-textbox');
		var username = tb.value;
		var trimmed = username.trim();
		if (username != trimmed) {
			tb.value = trimmed;
			// Setting .value alone doesn't seem to cause the pref to sync, so set it manually
			Zotero.Prefs.set('sync.server.username', trimmed);
		}
	},
	
	
	linkAccount: Zotero.Promise.coroutine(function* (event) {
		this.trimUsername();
		var username = document.getElementById('sync-username-textbox').value;
		var password = document.getElementById('sync-password').value;

		if (!username.length || !password.length) {
			this.updateSyncIndicator();
			return;
		}

		// Try to acquire API key with current credentials
		this.updateSyncIndicator('animated');
		var json = yield Zotero.Sync.Runner.createAPIKeyFromCredentials(username, password);
		this.updateSyncIndicator();

		// Invalid credentials
		if (!json) {
			Zotero.alert(window,
				Zotero.getString('general.error'),
				Zotero.getString('sync.error.invalidLogin')
			);
			return;
		}

		if (!(yield Zotero.Sync.Data.Local.checkUser(window, json.userID, json.username))) {
			// createAPIKeyFromCredentials will have created an API key,
			// but user decided not to use it, so we remove it here.
			Zotero.Sync.Runner.deleteAPIKey();
			return;
		}
		this.displayFields(json.username);
	}),

	/**
	 * Updates the auth indicator icon, depending on status
	 * @param {string} status
	 */
	updateSyncIndicator: function (status) {
		var img = document.getElementById('sync-status-indicator');
		
		img.removeAttribute('animated');
		if (status == 'animated') {
			img.setAttribute('animated', true);
		}
	},

	unlinkAccount: Zotero.Promise.coroutine(function* (showAlert=true) {
		if (showAlert) {
			var check = {value: false};
			var ps = Services.prompt;
			var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING) +
				(ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
			var index = ps.confirmEx(
				null,
				Zotero.getString('general.warning'),
				Zotero.getString('account.unlinkWarning', Zotero.clientName),
				buttonFlags,
				Zotero.getString('account.unlinkWarning.button'), null, null,
				Zotero.getString('account.unlinkWarning.removeData', Zotero.clientName),
				check
			);
			if (index == 0) {
				if (check.value) {
					var resetDataDirFile = OS.Path.join(Zotero.DataDirectory.dir, 'reset-data-directory');
					yield Zotero.File.putContentsAsync(resetDataDirFile, '');

					yield Zotero.Sync.Runner.deleteAPIKey();
					Zotero.Prefs.clear('sync.server.username');
					return Zotero.Utilities.Internal.quitZotero(true);
				}
			} else {
				return;
			}
		}

		this.displayFields();
		Zotero.Prefs.clear('sync.librariesToSync');
		yield Zotero.Sync.Runner.deleteAPIKey();
	}),
	
	
	showLibrariesToSyncDialog: function() {
		var io = {};
		window.openDialog('chrome://zotero/content/preferences/librariesToSync.xul',
			"zotero-preferences-librariesToSyncDialog", "chrome,modal,centerscreen", io);
	},
	
	
	dblClickLibraryToSync: function (event) {
		var tree = document.getElementById("libraries-to-sync-tree");
		var row = {}, col = {}, child = {};
		tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, child);
		
		if (col.value.element.id == 'libraries-to-sync-checked') {
			return;
		}
		// if dblclicked anywhere but the checkbox update pref
		return this.toggleLibraryToSync(row.value);
	},


	clickLibraryToSync: function (event) {
		var tree = document.getElementById("libraries-to-sync-tree");
		var row = {}, col = {}, child = {};
		tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, child);
		
		if (col.value.element.id != 'libraries-to-sync-checked') {
			return;
		}
		// if clicked on checkbox update pref
		return this.toggleLibraryToSync(row.value);
	},
	
	
	toggleLibraryToSync: function (index) {
		var treechildren = document.getElementById('libraries-to-sync-rows');
		if (index >= treechildren.childNodes.length) {
			return;
		}
		var row = treechildren.childNodes[index];
		var val = row.firstChild.childNodes[1].getAttribute('value');
		if (!val) {
			return
		}
		
		var librariesToSkip = JSON.parse(Zotero.Prefs.get('sync.librariesToSkip') || '[]');
		var indexOfId = librariesToSkip.indexOf(val);
		if (indexOfId == -1) {
			librariesToSkip.push(val);
		} else {
			librariesToSkip.splice(indexOfId, 1);
		}
		Zotero.Prefs.set('sync.librariesToSkip', JSON.stringify(librariesToSkip));
		 
		var cell = row.firstChild.firstChild;
		cell.setAttribute('value', indexOfId != -1);
	},
	
	
	initLibrariesToSync: Zotero.Promise.coroutine(function* () {
		var tree = document.getElementById("libraries-to-sync-tree");
		var treechildren = document.getElementById('libraries-to-sync-rows');
		while (treechildren.hasChildNodes()) {
			treechildren.removeChild(treechildren.firstChild);
		}
		
		function addRow(libraryName, id, checked=false, editable=true) {
			var treeitem = document.createElement('treeitem');
			var treerow = document.createElement('treerow');
			var checkboxCell = document.createElement('treecell');
			var nameCell = document.createElement('treecell');
			
			nameCell.setAttribute('label', libraryName);
			nameCell.setAttribute('value', id);
			nameCell.setAttribute('editable', false);
			checkboxCell.setAttribute('value', checked);
			checkboxCell.setAttribute('editable', editable);
			
			treerow.appendChild(checkboxCell);
			treerow.appendChild(nameCell);
			treeitem.appendChild(treerow);
			treechildren.appendChild(treeitem);
		}
		
		// Add loading row while we're loading a group list
		var loadingLabel = Zotero.getString("zotero.preferences.sync.librariesToSync.loadingLibraries");
		addRow(loadingLabel, "loading", false, false);

		var apiKey = yield Zotero.Sync.Data.Local.getAPIKey();
		var client = Zotero.Sync.Runner.getAPIClient({apiKey});
		var groups = [];
		try {
			// Load up remote groups
			var keyInfo = yield Zotero.Sync.Runner.checkAccess(client, {timeout: 5000});
			groups = yield client.getGroups(keyInfo.userID);
		}
		catch (e) {
			// Connection problems
			if ((e instanceof Zotero.HTTP.UnexpectedStatusException)
					|| (e instanceof Zotero.HTTP.TimeoutException)
					|| (e instanceof Zotero.HTTP.BrowserOfflineException)) {
				Zotero.alert(
					window,
					Zotero.getString('general.error'),
					Zotero.getString('sync.error.checkConnection', Zotero.clientName)
				);
			}
			else {
				throw e;
			}
			document.getElementsByTagName('dialog')[0].acceptDialog();
		}

		// Remove the loading row
		treechildren.removeChild(treechildren.firstChild);

		var librariesToSkip = JSON.parse(Zotero.Prefs.get('sync.librariesToSkip') || '[]');
		// Add default rows
		addRow(Zotero.getString("pane.collections.libraryAndFeeds"), "L" + Zotero.Libraries.userLibraryID, 
			librariesToSkip.indexOf("L" + Zotero.Libraries.userLibraryID) == -1);
		addRow(Zotero.getString("pane.collections.publications"), "L" + Zotero.Libraries.publicationsLibraryID, 
			librariesToSkip.indexOf("L" + Zotero.Libraries.publicationsLibraryID) == -1);
		
		// Add group rows
		for (let group of groups) {
			addRow(group.data.name, "G" + group.id, librariesToSkip.indexOf("G" + group.id) == -1);
		}
	}),


	updateStorageSettingsUI: Zotero.Promise.coroutine(function* () {
		this.unverifyStorageServer();
		
		var protocol = document.getElementById('pref-storage-protocol').value;
		var enabled = document.getElementById('pref-storage-enabled').value;
		
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
		
		var menulists = document.querySelectorAll('#storage-settings menulist.storage-mode');
		for (let menulist of menulists) {
			menulist.disabled = !enabled;
		}
		
		this.updateStorageTerms();
		
		window.sizeToContent();
	}),
	
	
	updateStorageSettingsGroups: function (enabled) {
		var storageSettings = document.getElementById('storage-settings');
		var menulists = storageSettings.getElementsByTagName('menulist');
		for (let menulist of menulists) {
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
	
	
	onStorageSettingsKeyPress: Zotero.Promise.coroutine(function* (event) {
		if (event.keyCode == 13) {
			yield this.onStorageSettingsChange();
			yield this.verifyStorageServer();
		}
	}),
	
	
	onStorageSettingsChange: Zotero.Promise.coroutine(function* () {
		// Clean URL
		var urlPref = document.getElementById('pref-storage-url');
		urlPref.value = urlPref.value.replace(/(^https?:\/\/|\/zotero\/?$|\/$)/g, '');
		
		var oldProtocol = document.getElementById('pref-storage-protocol').value;
		var oldEnabled = document.getElementById('pref-storage-enabled').value;
		
		yield Zotero.Promise.delay(1);
		
		var newProtocol = document.getElementById('pref-storage-protocol').value;
		var newEnabled = document.getElementById('pref-storage-enabled').value;
		
		if (oldProtocol != newProtocol) {
			yield Zotero.Sync.Storage.Local.resetAllSyncStates();
		}
		
		if (oldProtocol == 'webdav') {
			this.unverifyStorageServer();
			Zotero.Sync.Runner.resetStorageController(oldProtocol);
			
			var username = document.getElementById('storage-username').value;
			var password = document.getElementById('storage-password').value;
			if (username) {
				Zotero.Sync.Runner.getStorageController('webdav').password = password;
			}
		}
		
		if (oldProtocol == 'zotero' && newProtocol == 'webdav') {
			var sql = "SELECT COUNT(*) FROM settings "
				+ "WHERE setting='storage' AND key='zfsPurge' AND value='user'";
			if (!Zotero.DB.valueQueryAsync(sql)) {
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
					yield Zotero.DB.queryAsync(sql, ['storage', 'zfsPurge', 'user']);
					
					try {
						yield Zotero.Sync.Storage.ZFS.purgeDeletedStorageFiles();
						ps.alert(
							null,
							Zotero.getString("general.success"),
							"Attachment files from your personal library have been removed from the Zotero servers."
						);
					}
					catch (e) {
						Zotero.logError(e);
						ps.alert(
							null,
							Zotero.getString("general.error"),
							"An error occurred. Please try again later."
						);
					}
				}
			}
		}
		
		this.updateStorageSettingsUI();
	}),
	
	
	verifyStorageServer: Zotero.Promise.coroutine(function* () {
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
		
		var success = false;
		var request = null;
		
		var controller = Zotero.Sync.Runner.getStorageController('webdav');
		
		try {
			yield controller.checkServer({
				// Get the XMLHttpRequest for possible cancelling
				onRequest: r => request = r
			})
			
			success = true;
		}
		catch (e) {
			if (e instanceof controller.VerificationError) {
				switch (e.error) {
				case "NO_URL":
					urlField.focus();
					break;
				
				case "NO_USERNAME":
					usernameField.focus();
					break;
				
				case "NO_PASSWORD":
				case "AUTH_FAILED":
					passwordField.focus();
					break;
				}
			}
			success = yield controller.handleVerificationError(e);
		}
		finally {
			verifyButton.hidden = false;
			abortButton.hidden = true;
			progressMeter.hidden = true;
		}
		
		if (success) {
			Zotero.debug("WebDAV verification succeeded");
			
			Zotero.alert(
				window,
				Zotero.getString('sync.storage.serverConfigurationVerified'),
				Zotero.getString('sync.storage.fileSyncSetUp')
			);
		}
		else {
			Zotero.logError("WebDAV verification failed");
		}
		
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
	}),
	
	
	unverifyStorageServer: function () {
		Zotero.debug("Unverifying storage");
		Zotero.Prefs.set('sync.storage.verified', false);
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
	
	
	handleSyncReset: Zotero.Promise.coroutine(function* (action) {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		if (!Zotero.Sync.Runner.enabled) {
			ps.alert(
				null,
				Zotero.getString('general.error'),
				Zotero.getString('zotero.preferences.sync.reset.userInfoMissing',
								document.getElementById('zotero-prefpane-sync')
								.getElementsByTagName('tab')[0].label)
			);
			return;
		}
		
		switch (action) {
			case 'full-sync':
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
					+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
					+ ps.BUTTON_POS_1_DEFAULT;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					// TODO: localize
					"On the next sync, Zotero will compare all local and remote data and merge any "
						+ "data that does not exist in both locations.\n\n"
						+ "This option is not necessary during normal usage and should "
						+ "generally be used only to troubleshoot specific issues as recommended "
						+ "by Zotero support staff.",
					buttonFlags,
					Zotero.getString('general.reset'),
					null, null, null, {}
				);
				
				switch (index) {
				case 0:
					let libraries = Zotero.Libraries.getAll().filter(library => library.syncable);
					yield Zotero.DB.executeTransaction(function* () {
						for (let library of libraries) {
							library.libraryVersion = -1;
							yield library.save();
						}
					});
					break;
					
					// Cancel
				case 1:
					return;
				}
				
				break;
			
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
						var callback = Zotero.Promise.coroutine(function* () {
							Zotero.Schema.stopRepositoryTimer();
							Zotero.Sync.Runner.clearSyncTimeout();
							
							Zotero.DB.skipBackup = true;
							
							yield Zotero.File.putContentsAsync(
								OS.Path.join(Zotero.DataDirectory.dir, 'restore-from-server'),
								''
							);
							
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
						});
						
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
						yield Zotero.Sync.Storage.Local.resetAllSyncStates();
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
	})
};
