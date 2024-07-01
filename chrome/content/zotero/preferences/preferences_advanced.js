/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2006–2013 Center for History and New Media
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

Components.utils.import("resource://gre/modules/Services.jsm");
var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');

Zotero_Preferences.Advanced = {	
	init: function () {
		Zotero_Preferences.Keys.init();
		
		// Show Memory Info button
		if (Zotero.Prefs.get('debug.memoryInfo')) {
			document.getElementById('memory-info').hidden = false;
		}

		// This might not work for checkboxes if we later need to create them
		// with html
		var inputs = document.querySelectorAll('input[data-preference]');
		for (let input of inputs) {
			let preferenceName = input.dataset.preference;
			input.addEventListener('change', function () {
				let value = input.value;
				Zotero.Prefs.set(preferenceName, value);
			});
			input.value = Zotero.Prefs.get(preferenceName);
		}
		
		document.getElementById('baseAttachmentPath').addEventListener('syncfrompreference',
			() => Zotero_Preferences.Attachment_Base_Directory.updateUI());
		
		document.getElementById('data-dir').addEventListener('syncfrompreference', (event) => {
			event.target.value = this.onDataDirLoad();
		});

		document.getElementById('data-dir').addEventListener('synctopreference', () => {
			this.onDataDirUpdate();
		});

		document.getElementById('data-dir-path').addEventListener('syncfrompreference', (event) => {
			event.target.value = this.getDataDirPath();
		});
		
		this.onDataDirLoad();

		document.getElementById('fulltext-rebuildIndex').setAttribute('label',
			Zotero.getString('zotero.preferences.search.rebuildIndex')
				+ Zotero.getString('punctuation.ellipsis'));
		document.getElementById('fulltext-clearIndex').setAttribute('label',
			Zotero.getString('zotero.preferences.search.clearIndex')
				+ Zotero.getString('punctuation.ellipsis'));
		
		this.updateIndexStats();
	},
	
	
	updateTranslators: Zotero.Promise.coroutine(function* () {
		var updated = yield Zotero.Schema.updateFromRepository(Zotero.Schema.REPO_UPDATE_MANUAL);
		var button = document.getElementById('updateButton');
		if (button) {
			if (updated===-1) {
				var label = Zotero.getString('zotero.preferences.update.upToDate');
			}
			else if (updated) {
				var label = Zotero.getString('zotero.preferences.update.updated');
			}
			else {
				var label = Zotero.getString('zotero.preferences.update.error');
			}
			button.setAttribute('label', label);
			
			if (updated && Zotero_Preferences.Cite) {
				yield Zotero_Preferences.Cite.refreshStylesList();
			}
		}
	}),
	
	
	migrateDataDirectory: Zotero.Promise.coroutine(function* () {
		var currentDir = Zotero.DataDirectory.dir;
		var defaultDir = Zotero.DataDirectory.defaultDir;
		if (currentDir == defaultDir) {
			Zotero.debug("Already using default directory");
			return;
		}
		
		Components.utils.import("resource://zotero/config.js")
		var ps = Services.prompt;
		
		// If there's a migration marker, point data directory back to the current location and remove
		// it to trigger the migration again
		var marker = PathUtils.join(defaultDir, Zotero.DataDirectory.MIGRATION_MARKER);
		if (yield IOUtils.exists(marker)) {
			Zotero.Prefs.clear('dataDir');
			Zotero.Prefs.clear('useDataDir');
			yield IOUtils.remove(marker);
			try {
				yield IOUtils.remove(PathUtils.join(defaultDir, '.DS_Store'));
			}
			catch (e) {}
		}
		
		// ~/Zotero exists and is non-empty
		if ((yield IOUtils.exists(defaultDir)) && !(yield Zotero.File.directoryIsEmpty(defaultDir))) {
			let buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
				+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
			let index = ps.confirmEx(
				window,
				Zotero.getString('general.error'),
				Zotero.getString('zotero.preferences.advanced.migrateDataDir.directoryExists1', defaultDir)
					+ "\n\n"
					+ Zotero.getString('zotero.preferences.advanced.migrateDataDir.directoryExists2'),
				buttonFlags,
				Zotero.getString('general.showDirectory'),
				null, null, null, {}
			);
			if (index == 0) {
				yield Zotero.File.reveal(
					// Windows opens the directory, which might be confusing here, so open parent instead
					Zotero.isWin ? PathUtils.parent(defaultDir) : defaultDir
				);
			}
			return;
		}
		
		var additionalText = '';
		if (Zotero.isWin) {
			try {
				let numItems = yield Zotero.DB.valueQueryAsync(
					"SELECT COUNT(*) FROM itemAttachments WHERE linkMode IN (?, ?)",
					[Zotero.Attachments.LINK_MODE_IMPORTED_FILE, Zotero.Attachments.LINK_MODE_IMPORTED_URL]
				);
				if (numItems > 100) {
					additionalText = '\n\n' + Zotero.getString(
						'zotero.preferences.advanced.migrateDataDir.manualMigration',
						[Zotero.appName, defaultDir, ZOTERO_CONFIG.CLIENT_NAME]
					);
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		
		// Prompt to restart
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
					+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		var index = ps.confirmEx(window,
			Zotero.getString('zotero.preferences.advanced.migrateDataDir.title'),
			Zotero.getString(
				'zotero.preferences.advanced.migrateDataDir.directoryWillBeMoved',
				[ZOTERO_CONFIG.CLIENT_NAME, defaultDir]
			) + '\n\n'
			+ Zotero.getString(
				'zotero.preferences.advanced.migrateDataDir.appMustBeRestarted', Zotero.appName
			) + additionalText,
			buttonFlags,
			Zotero.getString('general.continue'),
			null, null, null, {}
		);
		
		if (index == 0) {
			yield Zotero.DataDirectory.markForMigration(currentDir);
			Zotero.Utilities.Internal.quitZotero(true);
		}
	}),
	
	
	runIntegrityCheck: async function (button) {
		button.disabled = true;
		
		try {
			let ps = Services.prompt;
			
			var ok = await Zotero.DB.integrityCheck();
			if (ok) {
				ok = await Zotero.Schema.integrityCheck();
				if (!ok) {
					var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
						+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
					var index = ps.confirmEx(window,
						Zotero.getString('general.failed'),
						Zotero.getString('db.integrityCheck.failed') + "\n\n" +
							Zotero.getString('db.integrityCheck.repairAttempt') + " " +
							Zotero.getString('db.integrityCheck.appRestartNeeded', Zotero.appName),
						buttonFlags,
						Zotero.getString('db.integrityCheck.fixAndRestart', Zotero.appName),
						null, null, null, {}
					);
					
					if (index == 0) {
						// Safety first
						await Zotero.DB.backupDatabase();
						
						// Fix the errors
						await Zotero.Schema.integrityCheck(true);
						
						// And run the check again
						ok = await Zotero.Schema.integrityCheck();
						var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING);
						if (ok) {
							var str = 'success';
							var msg = Zotero.getString('db.integrityCheck.errorsFixed');
						}
						else {
							var str = 'failed';
							var msg = Zotero.getString('db.integrityCheck.errorsNotFixed')
										+ "\n\n" + Zotero.getString('db.integrityCheck.reportInForums');
						}
						
						ps.confirmEx(window,
							Zotero.getString('general.' + str),
							msg,
							buttonFlags,
							Zotero.getString('general.restartApp', Zotero.appName),
							null, null, null, {}
						);
						
						var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
								.getService(Components.interfaces.nsIAppStartup);
						appStartup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit
							| Components.interfaces.nsIAppStartup.eRestart);
					}
					
					return;
				}
				
				try {
					await Zotero.DB.vacuum();
				}
				catch (e) {
					Zotero.logError(e);
					ok = false;
				}
			}
			var str = ok ? 'passed' : 'failed';
			
			ps.alert(window,
				Zotero.getString('general.' + str),
				Zotero.getString('db.integrityCheck.' + str)
				+ (!ok ? "\n\n" + Zotero.getString('db.integrityCheck.dbRepairTool') : ''));
		}
		finally {
			button.disabled = false;
		}
	},
	
	
	resetTranslatorsAndStyles: function () {
		var ps = Services.prompt;
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		
		var index = ps.confirmEx(null,
			Zotero.getString('general.warning'),
			Zotero.getString('zotero.preferences.advanced.resetTranslatorsAndStyles.changesLost'),
			buttonFlags,
			Zotero.getString('zotero.preferences.advanced.resetTranslatorsAndStyles'),
			null, null, null, {});
		
		if (index == 0) {
			Zotero.Schema.resetTranslatorsAndStyles()
			.then(function () {
				if (Zotero_Preferences.Export) {
					Zotero_Preferences.Export.populateQuickCopyList();
				}
			});
		}
	},
	
	
	resetTranslators: async function () {
		var ps = Services.prompt;
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		
		var index = ps.confirmEx(null,
			Zotero.getString('general.warning'),
			Zotero.getString('zotero.preferences.advanced.resetTranslators.changesLost'),
			buttonFlags,
			Zotero.getString('zotero.preferences.advanced.resetTranslators'),
			null, null, null, {});
		
		if (index == 0) {
			let button = document.getElementById('reset-translators-button');
			button.disabled = true;
			try {
				await Zotero.Schema.resetTranslators();
				if (Zotero_Preferences.Export) {
					Zotero_Preferences.Export.populateQuickCopyList();
				}
			}
			finally {
				button.disabled = false;
			}
		}
	},
	
	
	resetStyles: async function () {
		var ps = Services.prompt;
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		
		var index = ps.confirmEx(null,
			Zotero.getString('general.warning'),
			Zotero.getString('zotero.preferences.advanced.resetStyles.changesLost'),
			buttonFlags,
			Zotero.getString('zotero.preferences.advanced.resetStyles'),
			null, null, null, {});
		
		if (index == 0) {
			let button = document.getElementById('reset-styles-button');
			button.disabled = true;
			try {
				await Zotero.Schema.resetStyles()
				if (Zotero_Preferences.Export) {
					Zotero_Preferences.Export.populateQuickCopyList();
				}
			}
			finally {
				button.disabled = false;
			}
		}
	},
	
	
	onDataDirLoad: function () {
		var useDataDir = Zotero.Prefs.get('useDataDir');
		var dataDir = Zotero.Prefs.get('lastDataDir') || Zotero.Prefs.get('dataDir');
		var currentDir = Zotero.DataDirectory.dir;
		var defaultDataDir = Zotero.DataDirectory.defaultDir;
		
		if (Zotero.forceDataDir) {
			document.getElementById('command-line-data-dir-path').textContent = currentDir;
			document.getElementById('command-line-data-dir').hidden = false;
			document.getElementById('data-dir').hidden = true;
		}
		
		// Change "Use profile directory" label to home directory location unless using profile dir
		if (useDataDir || currentDir == defaultDataDir) {
			document.getElementById('default-data-dir').setAttribute(
				'label', Zotero.getString('dataDir.default', Zotero.DataDirectory.defaultDir)
			);
		}
		
		// Don't show custom data dir as in-use if set to the default
		if (dataDir == defaultDataDir) {
			useDataDir = false;
		}
		
		document.getElementById('data-dir-path').setAttribute('disabled', !useDataDir);
		document.getElementById('migrate-data-dir').setAttribute(
			'hidden', !Zotero.DataDirectory.canMigrate()
		);
		
		return useDataDir;
	},
	
	
	onDataDirUpdate: Zotero.Promise.coroutine(function* (forceNew) {
		var radiogroup = document.getElementById('data-dir');
		var newUseDataDir = radiogroup.selectedIndex == 1;
		
		if (!forceNew && newUseDataDir && !this._usingDefaultDataDir()) {
			return;
		}
		
		// This call shows a filepicker if needed, forces a restart if required, and does nothing if
		// cancel was pressed or value hasn't changed
		yield Zotero.DataDirectory.choose(
			true,
			!newUseDataDir,
			() => Zotero.launchURL('https://www.zotero.org/support/zotero_data')
		);
		radiogroup.selectedIndex = this._usingDefaultDataDir() ? 0 : 1;
	}),
	
	
	chooseDataDir: function() {
		let radiogroup = document.getElementById('data-dir');
		if (radiogroup.selectedIndex == 0) {
			radiogroup.selectedIndex = 1;
		}
		else {
			this.onDataDirUpdate(true);
		}
	},
	
	
	getDataDirPath: function () {
		// TEMP: lastDataDir can be removed once old persistent descriptors have been
		// converted, which they are in getZoteroDirectory() in 5.0
		var prefValue = Zotero.Prefs.get('lastDataDir') || Zotero.Prefs.get('dataDir');
		
		// Don't show path if the default
		if (prefValue == Zotero.DataDirectory.defaultDir) {
			return '';
		}
		
		return prefValue || '';
	},
	
	
	_usingDefaultDataDir: function () {
		// Legacy profile directory location
		if (!Zotero.Prefs.get('useDataDir')) {
			return true;
		}
		
		var dataDir = Zotero.Prefs.get('lastDataDir') || Zotero.Prefs.get('dataDir');
		// Default home directory location
		if (dataDir == Zotero.DataDirectory.defaultDir) {
			return true;
		}
		
		return false;
	},
	
	updateIndexStats: Zotero.Promise.coroutine(function* () {
		var stats = yield Zotero.Fulltext.getIndexStats();
		document.getElementById('fulltext-stats-indexed')
			.setAttribute('value', stats.indexed);
		document.getElementById('fulltext-stats-partial')
			.setAttribute('value', stats.partial);
		document.getElementById('fulltext-stats-unindexed')
			.setAttribute('value', stats.unindexed);
		document.getElementById('fulltext-stats-words')
			.setAttribute('value', stats.words);
	}),
	
	
	rebuildIndexPrompt: async function () {
		var buttons = [
			document.getElementById('fulltext-rebuildIndex'),
			document.getElementById('fulltext-clearIndex')
		];
		buttons.forEach(b => b.disabled = true);
		
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
		
		var index = ps.confirmEx(null,
			Zotero.getString('zotero.preferences.search.rebuildIndex'),
			Zotero.getString('zotero.preferences.search.rebuildWarning',
				Zotero.getString('zotero.preferences.search.indexUnindexed')),
			buttonFlags,
			Zotero.getString('zotero.preferences.search.rebuildIndex'),
			null,
			// Position 2 because of https://bugzilla.mozilla.org/show_bug.cgi?id=345067
			Zotero.getString('zotero.preferences.search.indexUnindexed'),
			null, {});
		
		try {
			if (index == 0) {
				await Zotero.Fulltext.rebuildIndex();
			}
			else if (index == 2) {
				await Zotero.Fulltext.rebuildIndex(true)
			}
			
			await this.updateIndexStats();
		}
		catch (e) {
			Zotero.alert(null, Zotero.getString('general.error'), e);
		}
		finally {
			buttons.forEach(b => b.disabled = false);
		}
	},

	clearIndexPrompt: async function () {
		var buttons = [
			document.getElementById('fulltext-rebuildIndex'),
			document.getElementById('fulltext-clearIndex')
		];
		buttons.forEach(b => b.disabled = true);
		
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
		
		var index = ps.confirmEx(null,
			Zotero.getString('zotero.preferences.search.clearIndex'),
			Zotero.getString('zotero.preferences.search.clearWarning',
				Zotero.getString('zotero.preferences.search.clearNonLinkedURLs')),
			buttonFlags,
			Zotero.getString('zotero.preferences.search.clearIndex'),
			null,
			// Position 2 because of https://bugzilla.mozilla.org/show_bug.cgi?id=345067
			Zotero.getString('zotero.preferences.search.clearNonLinkedURLs'), null, {});
		
		try {
			if (index == 0) {
				await Zotero.Fulltext.clearIndex();
			}
			else if (index == 2) {
				await Zotero.Fulltext.clearIndex(true);
			}
			
			await this.updateIndexStats();
		}
		catch (e) {
			Zotero.alert(null, Zotero.getString('general.error'), e);
		}
		finally {
			buttons.forEach(b => b.disabled = false);
		}
	}
};


Zotero_Preferences.Attachment_Base_Directory = {
	getPath: function () {
		var oldPath = Zotero.Prefs.get('baseAttachmentPath');
		if (oldPath) {
			try {
				return PathUtils.normalize(oldPath);
			}
			catch (e) {
				Zotero.logError(e);
				return false;
			}
		}
	},
	
	
	choosePath: async function () {
		var oldPath = this.getPath();
		
		//Prompt user to choose new base path
		var fp = new FilePicker();
		if (oldPath) {
			fp.displayDirectory = oldPath;
		}
		fp.init(window, Zotero.getString('attachmentBasePath.selectDir'), fp.modeGetFolder);
		fp.appendFilters(fp.filterAll);
		if (await fp.show() != fp.returnOK) {
			return false;
		}
		var newPath = PathUtils.normalize(fp.file);
		
		if (oldPath && oldPath == newPath) {
			Zotero.debug("Base directory hasn't changed");
			return false;
		}
		
		try {
			return await this.changePath(newPath);
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.alert(null, Zotero.getString('general.error'), e.message);
		}
	},
	
	
	changePath: Zotero.Promise.coroutine(function* (basePath) {
		Zotero.debug(`New base directory is ${basePath}`);
		
		if (Zotero.File.directoryContains(Zotero.DataDirectory.dir, basePath)) {
			throw new Error(
				Zotero.getString(
					'zotero.preferences.advanced.baseDirectory.withinDataDir',
					Zotero.appName
				)
			);
		}
		
		// Find all current attachments with relative attachment paths
		var sql = "SELECT itemID FROM itemAttachments WHERE linkMode=? AND path LIKE ?";
		var params = [
			Zotero.Attachments.LINK_MODE_LINKED_FILE,
			Zotero.Attachments.BASE_PATH_PLACEHOLDER + "%"
		];
		var oldRelativeAttachmentIDs = yield Zotero.DB.columnQueryAsync(sql, params);
		
		//Find all attachments on the new base path
		var sql = "SELECT itemID FROM itemAttachments WHERE linkMode=?";
		var params = [Zotero.Attachments.LINK_MODE_LINKED_FILE];
		var allAttachments = yield Zotero.DB.columnQueryAsync(sql, params);
		var newAttachmentPaths = {};
		var numNewAttachments = 0;
		var numOldAttachments = 0;
		for (let i=0; i<allAttachments.length; i++) {
			let attachmentID = allAttachments[i];
			let attachmentPath;
			let relPath = false
			
			try {
				let attachment = yield Zotero.Items.getAsync(attachmentID);
				// This will return FALSE for relative paths if base directory
				// isn't currently set
				attachmentPath = attachment.getFilePath();
				// Get existing relative path
				let storedPath = attachment.attachmentPath;
				if (storedPath.startsWith(Zotero.Attachments.BASE_PATH_PLACEHOLDER)) {
					relPath = storedPath.substr(Zotero.Attachments.BASE_PATH_PLACEHOLDER.length);
					// Use platform-specific slashes, which PathUtils.joinRelative() requires below
					relPath = Zotero.Attachments.fixPathSlashes(relPath);
				}
			}
			catch (e) {
				// Don't deal with bad attachment paths. Just skip them.
				Zotero.debug(e, 2);
				continue;
			}
			
			// If a file with the same relative path exists within the new base directory,
			// don't touch the attachment, since it will continue to work
			if (relPath) {
				if (yield IOUtils.exists(PathUtils.joinRelative(basePath, relPath))) {
					Zotero.debug(`${relPath} found within new base path -- skipping`);
					numNewAttachments++;
					continue;
				}
			}
			
			// Files within the new base directory need to be updated to use
			// relative paths (or, if the new base directory is an ancestor or
			// descendant of the old one, new relative paths)
			if (attachmentPath && Zotero.File.directoryContains(basePath, attachmentPath)) {
				Zotero.debug(`Converting ${attachmentPath} to relative path`);
				newAttachmentPaths[attachmentID] = relPath ? attachmentPath : null;
				numNewAttachments++;
			}
			// Existing relative attachments not within the new base directory
			// will be converted to absolute paths
			else if (relPath && Zotero.Prefs.get('baseAttachmentPath')) {
				Zotero.debug(`Converting ${relPath} to absolute path`);
				newAttachmentPaths[attachmentID] = attachmentPath;
				numOldAttachments++;
			}
			else {
				Zotero.debug(`${attachmentPath} is not within the base directory`);
			}
		}
		
		//Confirm change of the base path
		var ps = Services.prompt;
		
		var chooseStrPrefix = 'attachmentBasePath.chooseNewPath.';
		var clearStrPrefix = 'attachmentBasePath.clearBasePath.';
		var title = Zotero.getString(chooseStrPrefix + 'title');
		var msg1 = Zotero.getString(chooseStrPrefix + 'message') + "\n\n", msg2 = "", msg3 = "";
		switch (numNewAttachments) {
			case 0:
				break;
			
			case 1:
				msg2 += Zotero.getString(chooseStrPrefix + 'existingAttachments.singular') + " ";
				break;
			
			default:
				msg2 += Zotero.getString(chooseStrPrefix + 'existingAttachments.plural', numNewAttachments) + " ";
		}
		
		switch (numOldAttachments) {
			case 0:
				break;
			
			case 1:
				msg3 += Zotero.getString(clearStrPrefix + 'existingAttachments.singular');
				break;
			
			default:
				msg3 += Zotero.getString(clearStrPrefix + 'existingAttachments.plural', numOldAttachments);
		}
		
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		var index = ps.confirmEx(
			null,
			title,
			(msg1 + msg2 + msg3).trim(),
			buttonFlags,
			Zotero.getString(chooseStrPrefix + 'button'),
			null,
			null,
			null,
			{}
		);
		
		if (index == 1) {
			return false;
		}
		
		// Set new base directory
		Zotero.debug("Setting base directory to " + basePath);
		Zotero.Prefs.set('baseAttachmentPath', basePath);
		Zotero.Prefs.set('saveRelativeAttachmentPath', true);
		// Resave all attachments on base path (so that their paths become relative)
		// and all other relative attachments (so that their paths become absolute)
		yield Zotero.Utilities.Internal.forEachChunkAsync(
			Object.keys(newAttachmentPaths),
			100,
			function (chunk) {
				return Zotero.DB.executeTransaction(async function () {
					for (let id of chunk) {
						let attachment = Zotero.Items.get(id);
						if (newAttachmentPaths[id]) {
							attachment.attachmentPath = newAttachmentPaths[id];
						}
						else {
							attachment.attachmentPath = attachment.getFilePath();
						}
						await attachment.save({
							skipDateModifiedUpdate: true
						});
					}
				})
			}
		);
		
		return true;
	}),
	
	
	clearPath: Zotero.Promise.coroutine(function* () {
		// Find all current attachments with relative paths
		var sql = "SELECT itemID FROM itemAttachments WHERE linkMode=? AND path LIKE ?";
		var params = [
			Zotero.Attachments.LINK_MODE_LINKED_FILE,
			Zotero.Attachments.BASE_PATH_PLACEHOLDER + "%"
		];
		var relativeAttachmentIDs = yield Zotero.DB.columnQueryAsync(sql, params);
		
		// Prompt for confirmation
		var ps = Services.prompt;
		
		var strPrefix = 'attachmentBasePath.clearBasePath.';
		var title = Zotero.getString(strPrefix + 'title');
		var msg = Zotero.getString(strPrefix + 'message');
		switch (relativeAttachmentIDs.length) {
			case 0:
				break;
			
			case 1:
				msg += "\n\n" + Zotero.getString(strPrefix + 'existingAttachments.singular');
				break;
			
			default:
				msg += "\n\n" + Zotero.getString(strPrefix + 'existingAttachments.plural',
					relativeAttachmentIDs.length);
		}
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		var index = ps.confirmEx(
			window,
			title,
			msg,
			buttonFlags,
			Zotero.getString(strPrefix + 'button'),
			null,
			null,
			null,
			{}
		);
		
		if (index == 1) {
			return false;
		}
		
		// Disable relative path saving and then resave all relative
		// attachments so that their absolute paths are stored
		Zotero.debug('Clearing base directory');
		Zotero.Prefs.set('saveRelativeAttachmentPath', false);
		
		yield Zotero.Utilities.Internal.forEachChunkAsync(
			relativeAttachmentIDs,
			100,
			function (chunk) {
				return Zotero.DB.executeTransaction(async function () {
					for (let id of chunk) {
						let attachment = await Zotero.Items.getAsync(id);
						attachment.attachmentPath = attachment.getFilePath();
						await attachment.save({
							skipDateModifiedUpdate: true
						});
					}
				}.bind(this));
			}.bind(this)
		);
		
		Zotero.Prefs.set('baseAttachmentPath', '');
	}),
	
	
	updateUI: async function () {
		var filefield = document.getElementById('baseAttachmentPath');
		var path = Zotero.Prefs.get('baseAttachmentPath');
		if (path && await IOUtils.exists(path)) {
			filefield.style.backgroundImage = 'url(moz-icon://' + Zotero.File.pathToFileURI(path) + '?size=16)';
			filefield.value = path;
		}
		else {
			filefield.value = '';
		}
		document.getElementById('resetBasePath').disabled = !path;
	}
};


Zotero_Preferences.Keys = {
	init: function () {
		for (let label of document.querySelectorAll('#zotero-keys-grid .modifier')) {
			// Display the appropriate modifier keys for the platform
			label.textContent = Zotero.isMac ? Zotero.getString('general.keys.cmdShift') : Zotero.getString('general.keys.ctrlShift');
		}
		
		var textboxes = document.querySelectorAll('#zotero-keys-grid input');
		for (let i=0; i<textboxes.length; i++) {
			let textbox = textboxes[i];
			textbox.value = textbox.value.toUpperCase();
			// .value takes care of the initial value, and this takes care of direct pref changes
			// while the window is open
			textbox.addEventListener('syncfrompreference', () => {
				textbox.value = Zotero_Preferences.Keys.capitalizePref(textbox.id) || '';
			});
			textbox.addEventListener('input', () => {
				textbox.value = textbox.value.toUpperCase();
			});
		}
	},
	
	
	capitalizePref: function (id) {
		var elem = document.getElementById(id);
		return Zotero.Prefs.get(elem.getAttribute('preference'), true).toUpperCase();
	}
};
