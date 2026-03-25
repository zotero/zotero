/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
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

var FileRenamingDialog = { // eslint-disable-line no-unused-vars
	prompted: false,
	_settingsChanged: false,
	_currentLibraryID: null,

	init: function () {
		const { DEFAULT_ATTACHMENT_RENAME_TEMPLATE, DEFAULT_AUTO_RENAME_FILE_TYPES } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");
		this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE = DEFAULT_ATTACHMENT_RENAME_TEMPLATE;
		this.DEFAULT_AUTO_RENAME_FILE_TYPES = DEFAULT_AUTO_RENAME_FILE_TYPES;

		this.settingsEl = document.getElementById('file-renaming-settings');
		this.libraryPicker = document.getElementById('library-picker');

		// Populate library picker
		let libraries = Zotero.Libraries.getAll().filter(lib => !(lib instanceof Zotero.Feed));
		console.log("FileRenamingDialog: libraries: "
			+ libraries.map(lib => `${lib.name} (id=${lib.libraryID}, isAdmin=${lib.isAdmin})`).join(", "));
		let menupopup = this.libraryPicker.querySelector('menupopup');
		for (let lib of libraries) {
			let menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', lib.name);
			menuitem.setAttribute('value', lib.libraryID);
			menupopup.appendChild(menuitem);
		}

		// Default to user library, or use passed-in libraryID
		let initialLibraryID = window.arguments?.[0]?.wrappedJSObject?.libraryID ?? Zotero.Libraries.userLibraryID;
		this.libraryPicker.value = String(initialLibraryID);

		this.libraryPicker.addEventListener('command', this.handleLibraryChange.bind(this));
		this.settingsEl.addEventListener('change', this.handleSettingsChange.bind(this));
		this.settingsEl.addEventListener('rename', this.handleRename.bind(this));

		this._handleDonePrefChange = this._handleDonePrefChange.bind(this);
		this._renameFilesPrefObserver = Zotero.Prefs.registerObserver('autoRenameFiles.done', this._handleDonePrefChange);

		this.loadSettingsForLibrary(initialLibraryID);
		this._currentLibraryID = initialLibraryID;

		window.addEventListener('unload', () => {
			if (this._shouldPromptRename(this._currentLibraryID)) {
				this._promptRename(this._currentLibraryID);
			}
			Zotero.Prefs.unregisterObserver(this._renameFilesPrefObserver);
		});
	},

	get libraryID() {
		return parseInt(this.libraryPicker.value);
	},

	get isUserLibrary() {
		return this.libraryID === Zotero.Libraries.userLibraryID;
	},

	loadSettingsForLibrary: function (libraryID) {
		this._settingsChanged = false;
		let isUserLib = libraryID === Zotero.Libraries.userLibraryID;

		let autoRenameEnabled;
		let fileTypes;
		let formatTemplate;
		let renameLinked;

		if (isUserLib) {
			autoRenameEnabled = Zotero.Prefs.get('autoRenameFiles');
			fileTypes = Zotero.Prefs.get('autoRenameFiles.fileTypes');
			renameLinked = Zotero.Prefs.get('autoRenameFiles.linked');
			formatTemplate = Zotero.SyncedSettings.get(libraryID, 'attachmentRenameTemplate')
				?? this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE;

			this.settingsEl.setAttribute('readonly', 'false');
			this.settingsEl.setAttribute('rename-linked-hidden', 'false');
			this.settingsEl.setAttribute('rename-linked-enabled', String(renameLinked));

			this._baselineDone = Zotero.Prefs.get('autoRenameFiles.done');
			this.settingsEl.setAttribute('rename-now-disabled', String(this._baselineDone));
		}
		else {
			autoRenameEnabled = Zotero.Attachments.isAutoRenameFilesEnabledForLibrary(libraryID);
			fileTypes = Zotero.SyncedSettings.get(libraryID, 'autoRenameFilesFileTypes')
				?? this.DEFAULT_AUTO_RENAME_FILE_TYPES;
			formatTemplate = Zotero.SyncedSettings.get(libraryID, 'attachmentRenameTemplate')
				?? this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE;

			let isAdmin = Zotero.Libraries.get(libraryID).isAdmin;
			this.settingsEl.setAttribute('readonly', String(!isAdmin));
			this.settingsEl.setAttribute('rename-linked-hidden', 'true');
			this.settingsEl.setAttribute('rename-now-disabled', String(!autoRenameEnabled));
		}

		// Store baseline for comparing against future changes
		// renameLinked is only relevant for the user library
		this._baselineSettings = isUserLib
			? { autoRenameEnabled, fileTypes, formatTemplate, renameLinked }
			: { autoRenameEnabled, fileTypes, formatTemplate };

		this.settingsEl.setAttribute('auto-rename-enabled', String(autoRenameEnabled));
		this.settingsEl.setAttribute('file-types', fileTypes);
		this.settingsEl.setAttribute('format-template', formatTemplate);
	},

	handleLibraryChange: async function () {
		let previousLibraryID = this._currentLibraryID;
		let newLibraryID = this.libraryID;
		if (this._shouldPromptRename(previousLibraryID)) {
			// Revert picker so the previous library is visible behind the prompt
			this.libraryPicker.value = String(previousLibraryID);
			let userChoseRename = await this._promptRename(previousLibraryID);
			if (userChoseRename) {
				return;
			}
			// User declined -- proceed with the switch
			this.libraryPicker.value = String(newLibraryID);
		}
		this._currentLibraryID = newLibraryID;
		this.prompted = false;
		this.loadSettingsForLibrary(newLibraryID);
	},

	handleSettingsChange: function (event) {
		if (!event.detail) {
			return;
		}

		const { autoRenameEnabled, enabledFileTypes, renameLinkedEnabled, formatTemplate } = event.detail;
		let base = this._baselineSettings;

		if (this.isUserLibrary) {
			Zotero.Prefs.set('autoRenameFiles', autoRenameEnabled);
			Zotero.Prefs.set('autoRenameFiles.fileTypes', enabledFileTypes);
			Zotero.Prefs.set('autoRenameFiles.linked', renameLinkedEnabled);

			// Handle template changes
			if (formatTemplate.replace(/\s/g, '') === '') {
				Zotero.SyncedSettings.clear(Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate');
			}
			else {
				Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate', formatTemplate);
			}

			// If settings match the baseline and files were already renamed, mark as done;
			// otherwise, files need renaming
			let settingsMatch = autoRenameEnabled === base.autoRenameEnabled
				&& enabledFileTypes === base.fileTypes
				&& formatTemplate === base.formatTemplate
				&& renameLinkedEnabled === base.renameLinked;
			Zotero.Prefs.set('autoRenameFiles.done', settingsMatch && this._baselineDone);
		}
		else {
			Zotero.SyncedSettings.set(this.libraryID, 'autoRenameFiles', autoRenameEnabled);
			Zotero.SyncedSettings.set(this.libraryID, 'autoRenameFilesFileTypes', enabledFileTypes);
			Zotero.SyncedSettings.set(this.libraryID, 'attachmentRenameTemplate', formatTemplate);

			this._settingsChanged = autoRenameEnabled !== base.autoRenameEnabled
				|| enabledFileTypes !== base.fileTypes
				|| formatTemplate !== base.formatTemplate;
			this.settingsEl.setAttribute('rename-now-disabled', String(!autoRenameEnabled));
		}
	},

	handleRename: function () {
		const { openRenameFilesPreview } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");
		openRenameFilesPreview(this.libraryID);
		if (!this.isUserLibrary) {
			this._settingsChanged = false;
			this._baselineSettings = {
				autoRenameEnabled: Zotero.Attachments.isAutoRenameFilesEnabledForLibrary(this.libraryID),
				fileTypes: Zotero.SyncedSettings.get(this.libraryID, 'autoRenameFilesFileTypes')
					?? this.DEFAULT_AUTO_RENAME_FILE_TYPES,
				formatTemplate: Zotero.SyncedSettings.get(this.libraryID, 'attachmentRenameTemplate')
					?? this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE,
			};
		}
	},

	_handleDonePrefChange: function (newValue) {
		if (!this.isUserLibrary) return;

		this.settingsEl.setAttribute('rename-now-disabled', String(newValue));

		// Renaming has finished -- update baseline to current settings
		if (newValue) {
			this._baselineSettings = {
				autoRenameEnabled: Zotero.Prefs.get('autoRenameFiles'),
				fileTypes: Zotero.Prefs.get('autoRenameFiles.fileTypes'),
				formatTemplate: Zotero.SyncedSettings.get(
					Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate'
				) ?? this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE,
				renameLinked: Zotero.Prefs.get('autoRenameFiles.linked'),
			};
			this._baselineDone = true;
			this.prompted = false;
		}
	},

	_shouldPromptRename: function (libraryID) {
		if (libraryID === Zotero.Libraries.userLibraryID) {
			// User library tracks rename-needed state via the autoRenameFiles.done pref
			return Zotero.Prefs.get('autoRenameFiles') && !Zotero.Prefs.get('autoRenameFiles.done');
		}
		// Group libraries use the local "_settingsChanged" flag
		return this._settingsChanged
			&& Zotero.Attachments.isAutoRenameFilesEnabledForLibrary(libraryID);
	},

	_promptRename: async function (libraryID) {
		const { promptAutoRenameFiles } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");
		let renamed = await promptAutoRenameFiles(libraryID);
		this._settingsChanged = false;
		return renamed;
	},

	promptReplace: function () {
		if (!this.isUserLibrary) return;
		if (!this.prompted && !Zotero.Prefs.get('autoRenameFiles.done')) {
			this.prompted = true;
			const { promptAutoRenameFiles } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");
			promptAutoRenameFiles();
		}
	}
};
