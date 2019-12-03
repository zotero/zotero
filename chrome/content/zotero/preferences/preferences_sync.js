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
Components.utils.import("resource://zotero/config.js");

Zotero_Preferences.Sync = {
	checkmarkChar: '\u2705',
	noChar: '\uD83D\uDEAB',
	
	init: Zotero.Promise.coroutine(function* () {
		this.updateStorageSettingsUI();
		this.updateStorageSettingsGroupsUI();

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
			}
			catch (e) {
				// API key wrong/invalid
				if (e instanceof Zotero.Error && e.error == Zotero.Error.ERROR_API_KEY_INVALID) {
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
		
		this.initResetPane();
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


	credentialsChange: function (event) {
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
	},
	
	
	credentialsKeyPress: function (event) {
		if (event.keyCode == 13) {
			this.linkAccount(event);
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
		try {
			var json = yield Zotero.Sync.Runner.createAPIKeyFromCredentials(username, password);
		}
		catch (e) {
			setTimeout(function () {
				Zotero.alert(
					window,
					Zotero.getString('general.error'),
					e.message
				);
			});
			throw e;
		}
		finally {
			this.updateSyncIndicator();
		}
		
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
		
		// Below the list or on checkmark column
		if (!col.value || col.value.element.id == 'libraries-to-sync-checked') {
			return;
		}
		// if dblclicked anywhere but the checkbox update pref
		return this.toggleLibraryToSync(row.value);
	},


	clickLibraryToSync: function (event) {
		var tree = document.getElementById("libraries-to-sync-tree");
		var row = {}, col = {}, child = {};
		tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, child);
		
		// Below the list or not on checkmark column
		if (!col.value || col.value.element.id != 'libraries-to-sync-checked') {
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
		var spacing = Zotero.isWin ? '  ' : '   ';
		cell.setAttribute('label', spacing + (indexOfId != -1 ? this.checkmarkChar : this.noChar));
		cell.setAttribute('value', indexOfId != -1);
	},
	
	
	initLibrariesToSync: Zotero.Promise.coroutine(function* () {
		var tree = document.getElementById("libraries-to-sync-tree");
		var treechildren = document.getElementById('libraries-to-sync-rows');
		while (treechildren.hasChildNodes()) {
			treechildren.removeChild(treechildren.firstChild);
		}
		
		var addRow = function (libraryName, id, checked=false, editable=true) {
			var treeitem = document.createElement('treeitem');
			var treerow = document.createElement('treerow');
			var checkboxCell = document.createElement('treecell');
			var nameCell = document.createElement('treecell');
			
			nameCell.setAttribute('label', libraryName);
			nameCell.setAttribute('value', id);
			nameCell.setAttribute('editable', false);
			var spacing = Zotero.isWin ? '  ' : '   ';
			checkboxCell.setAttribute(
				'label',
				id == 'loading' ? '' : (spacing + (checked ? this.checkmarkChar : this.noChar))
			);
			checkboxCell.setAttribute('value', checked);
			checkboxCell.setAttribute('editable', false);
			
			treerow.appendChild(checkboxCell);
			treerow.appendChild(nameCell);
			treeitem.appendChild(treerow);
			treechildren.appendChild(treeitem);
		}.bind(this);
		
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
		
		// Sort groups
		var collation = Zotero.getLocaleCollation();
		groups.sort((a, b) => collation.compareString(1, a.data.name, b.data.name));
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
		
		document.getElementById('storage-user-download-mode').disabled = !enabled;
		this.updateStorageTerms();
		
		window.sizeToContent();
	}),
	
	
	updateStorageSettingsGroupsUI: function () {
		setTimeout(() => {
			var enabled = document.getElementById('pref-storage-groups-enabled').value;
			document.getElementById('storage-groups-download-mode').disabled = !enabled;
			this.updateStorageTerms();
		});
	},
	
	
	updateStorageTerms: function () {
		var terms = document.getElementById('storage-terms');
		
		var libraryEnabled = document.getElementById('pref-storage-enabled').value;
		var storageProtocol = document.getElementById('pref-storage-protocol').value;
		var groupsEnabled = document.getElementById('pref-storage-groups-enabled').value;
		
		terms.hidden = !((libraryEnabled && storageProtocol == 'zotero') || groupsEnabled);
	},
	
	
	onStorageSettingsKeyPress: Zotero.Promise.coroutine(function* (event) {
		if (event.keyCode == 13) {
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
			yield Zotero.Sync.Storage.Local.resetAllSyncStates(Zotero.Libraries.userLibraryID);
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
		// onchange weirdly isn't triggered when clicking straight from a field to the button,
		// so we have to trigger this here (and we don't trigger it for Enter in
		// onStorageSettingsKeyPress()).
		yield this.onStorageSettingsChange();
		
		Zotero.debug("Verifying storage");
		
		var verifyButton = document.getElementById("storage-verify");
		var abortButton = document.getElementById("storage-abort");
		var progressMeter = document.getElementById("storage-progress");
		var urlField = document.getElementById("storage-url");
		var usernameField = document.getElementById("storage-username");
		var passwordField = document.getElementById("storage-password");
		
		// These don't get set until window close on Windows/Linux (no instantApply),
		// so set them explicitly when verifying
		Zotero.Prefs.set('sync.storage.url', urlField.value);
		Zotero.Prefs.set('sync.storage.username', usernameField.value);
		
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
	
	
	//
	// Reset pane
	//
	initResetPane: function () {
		//
		// Build library selector
		//
		var libraryMenu = document.getElementById('sync-reset-library-menu');
		// Some options need to be disabled when certain libraries are selected
		libraryMenu.onchange = (event) => {
			this.onResetLibraryChange(parseInt(event.target.value));
		}
		this.onResetLibraryChange(Zotero.Libraries.userLibraryID);
		var libraries = Zotero.Libraries.getAll()
			.filter(x => x.libraryType == 'user' || x.libraryType == 'group');
		Zotero.Utilities.Internal.buildLibraryMenuHTML(libraryMenu, libraries);
		// Disable read-only libraries, at least until there are options that make sense for those
		Array.from(libraryMenu.querySelectorAll('option'))
			.filter(x => x.getAttribute('data-editable') == 'false')
			.forEach(x => x.disabled = true);
		
		var list = document.getElementById('sync-reset-list');
		for (let li of document.querySelectorAll('#sync-reset-list li')) {
			li.addEventListener('click', function (event) {
				// Ignore clicks if disabled
				if (this.hasAttribute('disabled')) {
					event.stopPropagation();
					return;
				}
				document.getElementById('sync-reset-button').disabled = false;
			});
		}
	},
	
	
	onResetLibraryChange: function (libraryID) {
		var library = Zotero.Libraries.get(libraryID);
		var section = document.getElementById('reset-file-sync-history');
		var input = section.querySelector('input');
		if (library.filesEditable) {
			section.removeAttribute('disabled');
			input.disabled = false;
		}
		else {
			section.setAttribute('disabled', '');
			// If radio we're disabling is already selected, select the first one in the list
			// instead
			if (input.checked) {
				document.querySelector('#sync-reset-list li:first-child input').checked = true;
			}
			input.disabled = true;
		}
	},
	
	
	reset: async function () {
		var ps = Services.prompt;
		
		if (Zotero.Sync.Runner.syncInProgress) {
			Zotero.alert(
				null,
				Zotero.getString('general.error'),
				Zotero.getString('sync.error.syncInProgress')
					+ "\n\n"
					+ Zotero.getString('general.operationInProgress.waitUntilFinishedAndTryAgain')
			);
			return;
		}
		
		var libraryID = parseInt(
			Array.from(document.querySelectorAll('#sync-reset-library-menu option'))
				.filter(x => x.selected)[0]
				.value
		);
		var library = Zotero.Libraries.get(libraryID);
		var action = Array.from(document.querySelectorAll('#sync-reset-list input[name=sync-reset-radiogroup]'))
			.filter(x => x.checked)[0]
			.getAttribute('value');
		
		switch (action) {
			/*case 'full-sync':
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
					await Zotero.DB.executeTransaction(function* () {
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
						var callback = async function () {
							Zotero.Schema.stopRepositoryTimer();
							Zotero.Sync.Runner.clearSyncTimeout();
							
							Zotero.DB.skipBackup = true;
							
							await Zotero.File.putContentsAsync(
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
				break;*/
			
			case 'restore-to-server':
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
					+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL)
					+ ps.BUTTON_POS_1_DEFAULT;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					Zotero.getString(
						'zotero.preferences.sync.reset.restoreToServer',
						[Zotero.clientName, library.name, ZOTERO_CONFIG.DOMAIN_NAME]
					),
					buttonFlags,
					Zotero.getString('zotero.preferences.sync.reset.restoreToServer.button'),
					null, null, null, {}
				);
				
				switch (index) {
					case 0:
						var resetButton = document.getElementById('sync-reset-button');
						resetButton.disabled = true;
						try {
							await Zotero.Sync.Runner.sync({
								libraries: [libraryID],
								resetMode: Zotero.Sync.Runner.RESET_MODE_TO_SERVER
							});
						}
						finally {
							resetButton.disabled = false;
						}
						break;
					
					// Cancel
					case 1:
						return;
				}
				
				break;
			
			
			case 'reset-file-sync-history':
				var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
					+ ps.BUTTON_POS_1_DEFAULT;
				var index = ps.confirmEx(
					null,
					Zotero.getString('general.warning'),
					Zotero.getString(
						'zotero.preferences.sync.reset.fileSyncHistory',
						[Zotero.clientName, library.name]
					),
					buttonFlags,
					Zotero.getString('general.reset'),
					null, null, null, {}
				);
				
				switch (index) {
					case 0:
						await Zotero.Sync.Storage.Local.resetAllSyncStates(libraryID);
						ps.alert(
							null,
							Zotero.getString('general.success'),
							Zotero.getString(
								'zotero.preferences.sync.reset.fileSyncHistory.cleared',
								library.name
							)
						);
						break;
					
					// Cancel
					case 1:
						return;
				}
				
				break;
			
			default:
				throw new Error(`Invalid action '${action}' in handleSyncReset()`);
		}
	}
};
