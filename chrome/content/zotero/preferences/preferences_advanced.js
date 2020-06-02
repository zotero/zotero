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
import FilePicker from 'zotero/filePicker';

Zotero_Preferences.Advanced = {
	_openURLResolvers: null,
	
	
	init: function () {
		Zotero_Preferences.Keys.init();
		
		// Show Memory Info button
		if (Zotero.Prefs.get('debug.memoryInfo')) {
			document.getElementById('memory-info').hidden = false;
		}
		
		this.onDataDirLoad();
		this.refreshLocale();
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
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		
		// If there's a migration marker, point data directory back to the current location and remove
		// it to trigger the migration again
		var marker = OS.Path.join(defaultDir, Zotero.DataDirectory.MIGRATION_MARKER);
		if (yield OS.File.exists(marker)) {
			Zotero.Prefs.clear('dataDir');
			Zotero.Prefs.clear('useDataDir');
			yield OS.File.remove(marker);
			try {
				yield OS.File.remove(OS.Path.join(defaultDir, '.DS_Store'));
			}
			catch (e) {}
		}
		
		// ~/Zotero exists and is non-empty
		if ((yield OS.File.exists(defaultDir)) && !(yield Zotero.File.directoryIsEmpty(defaultDir))) {
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
					Zotero.isWin ? OS.Path.dirname(defaultDir) : defaultDir
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
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		
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
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		
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
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		
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
	
	
	onDataDirUpdate: Zotero.Promise.coroutine(function* (event, forceNew) {
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
			() => Zotero_Preferences.openURL('https://www.zotero.org/support/zotero_data')
		);
		radiogroup.selectedIndex = this._usingDefaultDataDir() ? 0 : 1;
	}),
	
	
	chooseDataDir: function(event) {
		document.getElementById('data-dir').selectedIndex = 1;
		this.onDataDirUpdate(event, true);
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
	
	
	populateOpenURLResolvers: function () {
		var openURLMenu = document.getElementById('openURLMenu');
		
		this._openURLResolvers = Zotero.OpenURL.discoverResolvers();
		var i = 0;
		for (let r of this._openURLResolvers) {
			openURLMenu.insertItemAt(i, r.name);
			if (r.url == Zotero.Prefs.get('openURL.resolver') && r.version == Zotero.Prefs.get('openURL.version')) {
				openURLMenu.selectedIndex = i;
			}
			i++;
		}
		
		var button = document.getElementById('openURLSearchButton');
		switch (this._openURLResolvers.length) {
			case 0:
				var num = 'zero';
				break;
			case 1:
				var num = 'singular';
				break;
			default:
				var num = 'plural';
		}
		
		button.setAttribute('label', Zotero.getString('zotero.preferences.openurl.resolversFound.' + num, this._openURLResolvers.length));
	},
	
	
	onOpenURLSelected: function () {
		var openURLServerField = document.getElementById('openURLServerField');
		var openURLVersionMenu = document.getElementById('openURLVersionMenu');
		var openURLMenu = document.getElementById('openURLMenu');
		
		if(openURLMenu.value == "custom")
		{
			openURLServerField.focus();
		}
		else
		{
			openURLServerField.value = this._openURLResolvers[openURLMenu.selectedIndex]['url'];
			openURLVersionMenu.value = this._openURLResolvers[openURLMenu.selectedIndex]['version'];
			Zotero.Prefs.set("openURL.resolver", this._openURLResolvers[openURLMenu.selectedIndex]['url']);
			Zotero.Prefs.set("openURL.version", this._openURLResolvers[openURLMenu.selectedIndex]['version']);
		}
	},
	
	onOpenURLCustomized: function () {
		document.getElementById('openURLMenu').value = "custom";
	},
	
	
	_getAutomaticLocaleMenuLabel: function () {
		return Zotero.getString(
			'zotero.preferences.locale.automaticWithLocale',
			Zotero.Locale.availableLocales[Zotero.locale] || Zotero.locale
		);
	},
	
	
	refreshLocale: function () {
		var autoLocaleName, currentValue;
		
		// If matching OS, get the name of the current locale
		if (Zotero.Prefs.get('intl.locale.requested', true) === '') {
			autoLocaleName = this._getAutomaticLocaleMenuLabel();
			currentValue = 'automatic';
		}
		// Otherwise get the name of the locale specified in the pref
		else {
			autoLocaleName = Zotero.getString('zotero.preferences.locale.automatic');
			currentValue = Zotero.locale;
		}
		
		// Populate menu
		var menu = document.getElementById('locale-menu');
		var menupopup = menu.firstChild;
		menupopup.textContent = '';
		// Show "Automatic (English)", "Automatic (Français)", etc.
		menu.appendItem(autoLocaleName, 'automatic');
		menu.menupopup.appendChild(document.createElement('menuseparator'));
		// Add all available locales
		for (let locale in Zotero.Locale.availableLocales) {
			menu.appendItem(Zotero.Locale.availableLocales[locale], locale);
		}
		menu.value = currentValue;
	},
	
	onLocaleChange: function () {
		var requestedLocale = Services.locale.getRequestedLocale();
		var menu = document.getElementById('locale-menu');
		if (menu.value == 'automatic') {
			// Changed if not already set to automatic (unless we have the automatic locale name,
			// meaning we just switched away to the same manual locale and back to automatic)
			var changed = requestedLocale && menu.label != this._getAutomaticLocaleMenuLabel();
			Services.locale.setRequestedLocales(null);
		}
		else {
			// Changed if moving to a locale other than the current one
			var changed = Zotero.locale != menu.value
			Services.locale.setRequestedLocales([menu.value]);
		}
		
		if (!changed) {
			return;
		}
		
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
		var index = ps.confirmEx(null,
			Zotero.getString('general.restartRequired'),
			Zotero.getString('general.restartRequiredForChange', Zotero.appName),
			buttonFlags,
			Zotero.getString('general.restartNow'),
			Zotero.getString('general.restartLater'),
			null, null, {});
		
		if (index == 0) {
			Zotero.Utilities.Internal.quitZotero(true);
		}
	}
};


Zotero_Preferences.Attachment_Base_Directory = {


	manageBaseDirs: function () {
		var io = {};
		window.openDialog('chrome://zotero/content/preferences/libraryAttachmentBaseDirs.xul',
			"zotero-preferences-libraryAttachmentBaseDirsDialog", "chrome,modal,centerscreen", io);
	},


	dblClickLibraryAttachmentBaseDir: async function (event) {
		var tree = document.getElementById("library-attachment-base-dirs-tree");
		var row = {}, col = {}, child = {};
		tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, child);

		// Below the list
		if (!col.value) {
			return;
		}
		var index = row.value;

		var treechildren = document.getElementById("library-attachment-base-dirs-rows");
		if (index >= treechildren.childNodes.length) {
			return;
		}

		var treeRow = treechildren.childNodes[index];

		var libraryID = treeRow.firstChild.childNodes[1].getAttribute("value");
		if (!libraryID) {
			return;
		}
		libraryID = parseInt(libraryID);

		var checkboxCell = treeRow.firstChild.childNodes[0];
		var pathCell = treeRow.firstChild.childNodes[2];
		var oldPath = pathCell.getAttribute("value");

		var newPath = await this.getNewBaseDir(oldPath);
		if (!newPath) {
			return;
		}

		if (await this.changeBaseDirByLibrary(libraryID, newPath)) {
			checkboxCell.setAttribute("value", true);
			pathCell.setAttribute("label", newPath);
			pathCell.setAttribute("value", newPath);
		}
	},


	clickLibraryAttachmentBaseDir: function (event) {
		var tree = document.getElementById("library-attachment-base-dirs-tree");
		var row = {}, col = {}, child = {};
		tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, child);

		// Below the list or not on checkmark column
		if (!col.value || col.value.element.id != "library-attachment-base-dirs-checked") {
			return;
		}

		this.toggleLibraryAttachmentBaseDir(row.value);
	},


	toggleLibraryAttachmentBaseDir: async function (index) {
		var treechildren = document.getElementById("library-attachment-base-dirs-rows");
		if (index >= treechildren.childNodes.length) {
			return;
		}

		var row = treechildren.childNodes[index];
		var libraryID = row.firstChild.childNodes[1].getAttribute("value");
		if (!libraryID) {
			return;
		}
		libraryID = parseInt(libraryID);
		var checkboxCell = row.firstChild.childNodes[0];
		var checked = checkboxCell.getAttribute("value") === "true";
		var pathCell = row.firstChild.childNodes[2];
		var oldPath = pathCell.getAttribute("value");

		if (checked) {
			var newPath = await this.getNewBaseDir(oldPath);
			if (!newPath) {
				checkboxCell.setAttribute("value", false);
				return;
			}
			var changed = await this.changeBaseDirByLibrary(libraryID, newPath)
			checkboxCell.setAttribute("value", changed);
			if (changed) {
				pathCell.setAttribute("label", newPath);
				pathCell.setAttribute("value", newPath);
			}
		} else {
			var cleared = await this.clearBaseDirByLibrary(libraryID)
			checkboxCell.setAttribute("value", !cleared);
			if (cleared) {
				pathCell.setAttribute("label", "");
				pathCell.setAttribute("value", "");
			}
		}
	},

	getNewBaseDir: async function (oldBaseDir) {
		// Prompt user to choose new base directory
		if (oldBaseDir) {
			var oldPathFile = Zotero.File.pathToFile(oldBaseDir);
		}
		var fp = new FilePicker();
		if (oldPathFile) {
			fp.displayDirectory = oldPathFile;
		}
		fp.init(window, Zotero.getString('attachmentBasePath.selectDir'), fp.modeGetFolder);
		fp.appendFilters(fp.filterAll);
		if (await fp.show() != fp.returnOK) {
			return false;
		}
		var newPath = fp.file;
		
		if (oldBaseDir && oldBaseDir == newPath) {
			return false;
		}

		return newPath;
	},


	initLibraryAttachmentBaseDirs: function () {
		var tree = document.getElementById('library-attachment-base-dirs-tree');
		var treechildren = document.getElementById('library-attachment-base-dirs-rows');
		while (treechildren.hasChildNodes()) {
			treechildren.removeChild(treechildren.firstChild);
		}

		// Add library rows
		var libraries = Zotero.Libraries.getAll()
			.filter(l => l.libraryType === "user" || l.libraryType === "group");

		for (let library of libraries) {
			var libraryName = library.name;
			var libraryID = parseInt(library.libraryID);
			var checked = Zotero.Attachments.getSaveRelativePathByLibrary(libraryID);
			var attachmentBaseDir = Zotero.Attachments.getBaseDirByLibrary(libraryID);

			var treeitem = document.createElement('treeitem');
			var treerow = document.createElement('treerow');
			var checkboxCell = document.createElement('treecell');
			var nameCell = document.createElement('treecell');
			var pathCell = document.createElement('treecell');

			checkboxCell.setAttribute('value', checked);
			checkboxCell.setAttribute('editable', true);
			nameCell.setAttribute('label', libraryName);
			nameCell.setAttribute('value', libraryID);
			nameCell.setAttribute('editable', false);
			if (attachmentBaseDir) {
				pathCell.setAttribute('label', attachmentBaseDir);
				pathCell.setAttribute('value', attachmentBaseDir);
			}
			pathCell.setAttribute('editable', false);

			treerow.appendChild(checkboxCell);
			treerow.appendChild(nameCell);
			treerow.appendChild(pathCell);
			treeitem.appendChild(treerow);
			treechildren.appendChild(treeitem);
		}

		// Prune preferences of any libraries that no longer exist
		var existentLibraryIDs = libraries.map(l => parseInt(l.libraryID));
		var savedLibraryIDs =
			Object.keys(
				JSON.parse(
					Zotero.Prefs.get("librarySaveRelativeAttachmentPaths") || "{}"
				)
			).map(id => parseInt(id));

		savedLibraryIDs.forEach(function (libraryID) {
			if (existentLibraryIDs.indexOf(libraryID) == -1) {
				Zotero.debug(`Pruning attachment base directory preferences for non-existent library '${libraryID}'`);
				Zotero.Attachments.setSaveRelativePathByLibrary(libraryID, false);
				Zotero.Attachments.setBaseDirByLibrary(libraryID, false);
			}
		});
	},
	
	
	changeBaseDirByLibrary: Zotero.Promise.coroutine(function* (libraryID, baseDir) {
		Zotero.debug(`Setting new attachment base directory for '${libraryID}': '${baseDir}'`);
		
		if (Zotero.File.directoryContains(Zotero.DataDirectory.dir, baseDir)) {
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
		
		// Find all attachments on the new base directory
		var sql = "SELECT itemID FROM itemAttachments WHERE linkMode=?";
		var params = [Zotero.Attachments.LINK_MODE_LINKED_FILE];
		var allAttachmentIDs = yield Zotero.DB.columnQueryAsync(sql, params);
		var isLibraryBaseDirSet = Zotero.Attachments.getBaseDirByLibrary(libraryID);
		var newAttachmentPaths = {};
		var numNewAttachments = 0;
		var numOldAttachments = 0;
		for (let i=0; i<allAttachmentIDs.length; i++) {
			let attachmentID = allAttachmentIDs[i];
			let attachmentPath;
			let relPath = false;
			
			try {
				let attachment = yield Zotero.Items.getAsync(attachmentID);
				// This will return FALSE for relative paths if base directory
				// isn't currently set
				attachmentPath = attachment.getFilePath();
				// Make sure we only change paths for the specified library
				if (attachment.libraryID !== libraryID) {
					continue;
				}
				// Get existing relative path
				let storedPath = attachment.attachmentPath;
				if (storedPath.startsWith(Zotero.Attachments.BASE_PATH_PLACEHOLDER)) {
					relPath = storedPath.substr(Zotero.Attachments.BASE_PATH_PLACEHOLDER.length);
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
				if (yield OS.File.exists(OS.Path.join(baseDir, relPath))) {
					numNewAttachments++;
					continue;
				}
			}
			
			// Files within the new base directory need to be updated to use
			// relative paths (or, if the new base directory is an ancestor or
			// descendant of the old one, new relative paths)
			if (attachmentPath && Zotero.File.directoryContains(baseDir, attachmentPath)) {
				Zotero.debug(`Will convert '${attachmentPath}' to relative path`);
				newAttachmentPaths[attachmentID] = relPath ? attachmentPath : null;
				numNewAttachments++;
			}
			// Existing relative attachments not within the new base directory
			// will be converted to absolute paths
			else if (relPath && isLibraryBaseDirSet) {
				Zotero.debug(`Will convert '${relPath}' to absolute path`);
				newAttachmentPaths[attachmentID] = attachmentPath;
				numOldAttachments++;
			}
			else {
				Zotero.debug(`'${attachmentPath}' is not within the base directory for library '${libraryID}': '${baseDir}'`);
			}
		}
		
		// Confirm change of the base directory
		var chooseStrPrefix = 'attachmentBasePath.chooseNewPath.';
		var clearStrPrefix = 'attachmentBasePath.clearBasePath.';
		var title = Zotero.getString(chooseStrPrefix + 'title');
		var messages = [];
		switch (numNewAttachments) {
			case 0:
				break;

			case 1:
				messages.push(
					Zotero.getString(chooseStrPrefix + 'existingAttachments.singular')
				);
				break;

			default:
				messages.push(
					Zotero.getString(
						chooseStrPrefix + 'existingAttachments.plural',
						numNewAttachments
					)
				);
		}
		
		switch (numOldAttachments) {
			case 0:
				break;

			case 1:
				messages.push(
					Zotero.getString(clearStrPrefix + 'existingAttachments.singular')
				);
				break;

			default:
				messages.push(
					Zotero.getString(
						clearStrPrefix + 'existingAttachments.plural',
						numOldAttachments
					)
				)
		}
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		var index = ps.confirmEx(
			null,
			title,
			messages.length ?
				Zotero.getString(chooseStrPrefix + 'message') + "\n\n" + messages.join(" ") :
				Zotero.getString(chooseStrPrefix + 'message'),
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
		Zotero.Attachments.setBaseDirByLibrary(libraryID, baseDir);
		Zotero.Attachments.setSaveRelativePathByLibrary(libraryID, true);

		// Resave all attachments on base directory (so that their paths become relative)
		// and all other relative attachments (so that their paths become absolute)
		yield Zotero.Utilities.Internal.forEachChunkAsync(
			Object.keys(newAttachmentPaths),
			100,
			function (chunk) {
				return Zotero.DB.executeTransaction(function* () {
					for (let id of chunk) {
						let attachment = Zotero.Items.get(id);
						attachment.attachmentPath =
							newAttachmentPaths[id] || attachment.getFilePath();
						yield attachment.save({
							skipDateModifiedUpdate: true
						});
					}
				})
			}
		);
		
		return true;
	}),
	
	
	clearBaseDirByLibrary: Zotero.Promise.coroutine(function* (libraryID) {
		// Find all current attachments with relative paths
		var sql = "SELECT itemID FROM itemAttachments WHERE linkMode=? AND path LIKE ?";
		var params = [
			Zotero.Attachments.LINK_MODE_LINKED_FILE,
			Zotero.Attachments.BASE_PATH_PLACEHOLDER + "%"
		];
		var relativeAttachmentIDs = yield Zotero.DB.columnQueryAsync(sql, params);
		
		// Prompt for confirmation
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		
		var strPrefix = 'attachmentBasePath.clearBasePath.';
		var title = Zotero.getString(strPrefix + 'title');
		var messages = [Zotero.getString(strPrefix + 'message')];
		switch (relativeAttachmentIDs.length) {
			case 0:
				break;
			
			case 1:
				messages.push(
					Zotero.getString(strPrefix + 'existingAttachments.singular')
				);
				break;
			
			default:
				messages.push(
					Zotero.getString(
						strPrefix + 'existingAttachments.plural',
						relativeAttachmentIDs.length
					)
				);
		}
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		var index = ps.confirmEx(
			window,
			title,
			messages.join("\n\n"),
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
		Zotero.debug(`Clearing base directory from library ${libraryID}`);
		Zotero.Attachments.setSaveRelativePathByLibrary(libraryID, false);
		
		yield Zotero.Utilities.Internal.forEachChunkAsync(
			relativeAttachmentIDs,
			100,
			function (chunk) {
				return Zotero.DB.executeTransaction(function* () {
					for (let id of chunk) {
						let attachment = yield Zotero.Items.getAsync(id);
						if (attachment.libraryID !== libraryID) {
							continue;
						}
						attachment.attachmentPath = attachment.getFilePath();
						yield attachment.save({
							skipDateModifiedUpdate: true
						});
					}
				}.bind(this));
			}.bind(this)
		);
		
		Zotero.Attachments.setBaseDirByLibrary(libraryID, null);

		return true;
	}),
};


Zotero_Preferences.Keys = {
	init: function () {
		var rows = document.getElementById('zotero-prefpane-advanced-keys-tab').getElementsByTagName('row');
		for (var i=0; i<rows.length; i++) {
			// Display the appropriate modifier keys for the platform
			let label = rows[i].firstChild.nextSibling;
			if (label.className == 'modifier') {
				label.value = Zotero.isMac ? Zotero.getString('general.keys.cmdShift') : Zotero.getString('general.keys.ctrlShift');
			}
		}
		
		var textboxes = document.getElementById('zotero-keys-rows').getElementsByTagName('textbox');
		for (let i=0; i<textboxes.length; i++) {
			let textbox = textboxes[i];
			textbox.value = textbox.value.toUpperCase();
			// .value takes care of the initial value, and this takes care of direct pref changes
			// while the window is open
			textbox.setAttribute('onsyncfrompreference', 'return Zotero_Preferences.Keys.capitalizePref(this.id)');
			textbox.setAttribute('oninput', 'this.value = this.value.toUpperCase()');
		}
	},
	
	
	capitalizePref: function (id) {
		var elem = document.getElementById(id);
		var pref = document.getElementById(elem.getAttribute('preference'));
		if (pref.value) {
			return pref.value.toUpperCase();
		}
	}
};
