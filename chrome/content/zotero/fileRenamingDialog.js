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

	init: function () {
		const { DEFAULT_ATTACHMENT_RENAME_TEMPLATE, DEFAULT_AUTO_RENAME_FILE_TYPES } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");
		this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE = DEFAULT_ATTACHMENT_RENAME_TEMPLATE;
		this.DEFAULT_AUTO_RENAME_FILE_TYPES = DEFAULT_AUTO_RENAME_FILE_TYPES;

		this.settingsEl = document.getElementById('file-renaming-settings');
		this.libraryPicker = document.getElementById('library-picker');

		// Populate library picker
		let libraries = Zotero.Libraries.getAll().filter(lib => !(lib instanceof Zotero.Feed));
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
	},

	get libraryID() {
		return parseInt(this.libraryPicker.value);
	},

	get isUserLibrary() {
		return this.libraryID === Zotero.Libraries.userLibraryID;
	},

	loadSettingsForLibrary: function (libraryID) {
		let isUserLib = libraryID === Zotero.Libraries.userLibraryID;

		let autoRenameEnabled;
		let fileTypes;
		let formatTemplate;

		if (isUserLib) {
			autoRenameEnabled = Zotero.Prefs.get('autoRenameFiles');
			fileTypes = Zotero.Prefs.get('autoRenameFiles.fileTypes');
			formatTemplate = Zotero.SyncedSettings.get(libraryID, 'attachmentRenameTemplate')
				?? this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE;

			this.settingsEl.setAttribute('rename-linked-hidden', 'false');
			this.settingsEl.setAttribute('rename-linked-enabled',
				String(Zotero.Prefs.get('autoRenameFiles.linked')));

			// Track template state for user library prompt-to-rename logic
			this.lastFormatString = formatTemplate;
			this.isTemplateInSync = Zotero.Prefs.get('autoRenameFiles.done');
			this.settingsEl.setAttribute('rename-now-disabled', String(Zotero.Prefs.get('autoRenameFiles.done')));
		}
		else {
			autoRenameEnabled = Zotero.Attachments.isAutoRenameFilesEnabledForLibrary(libraryID);
			fileTypes = Zotero.SyncedSettings.get(libraryID, 'autoRenameFilesFileTypes')
				?? this.DEFAULT_AUTO_RENAME_FILE_TYPES;
			formatTemplate = Zotero.SyncedSettings.get(libraryID, 'attachmentRenameTemplate')
				?? this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE;

			this.settingsEl.setAttribute('rename-linked-hidden', 'true');
			this.settingsEl.setAttribute('rename-now-disabled', String(!autoRenameEnabled));
		}

		this.settingsEl.setAttribute('auto-rename-enabled', String(autoRenameEnabled));
		this.settingsEl.setAttribute('file-types', fileTypes);
		this.settingsEl.setAttribute('format-template', formatTemplate);
	},

	handleLibraryChange: function () {
		this.prompted = false;
		this.loadSettingsForLibrary(this.libraryID);
	},

	handleSettingsChange: function (event) {
		if (!event.detail) {
			return;
		}

		const { autoRenameEnabled, enabledFileTypes, renameLinkedEnabled, formatTemplate } = event.detail;

		if (this.isUserLibrary) {
			const { promptAutoRenameFiles } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");

			if (enabledFileTypes !== Zotero.Prefs.get('autoRenameFiles.fileTypes')) {
				Zotero.Prefs.set('autoRenameFiles.done', false);
			}

			if (!Zotero.Prefs.get('autoRenameFiles') && autoRenameEnabled) {
				promptAutoRenameFiles();
			}

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

			// Update rename-now-disabled based on template sync state
			Zotero.Prefs.set('autoRenameFiles.done',
				this.isTemplateInSync ? formatTemplate === this.lastFormatString : false);
		}
		else {
			this.settingsEl.setAttribute('rename-now-disabled', String(!autoRenameEnabled));
			Zotero.SyncedSettings.set(this.libraryID, 'autoRenameFiles', autoRenameEnabled);
			Zotero.SyncedSettings.set(this.libraryID, 'autoRenameFilesFileTypes', enabledFileTypes);
			Zotero.SyncedSettings.set(this.libraryID, 'attachmentRenameTemplate', formatTemplate);
		}
	},

	handleRename: function () {
		const { openRenameFilesPreview } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");
		openRenameFilesPreview(this.libraryID);
	},

	_handleDonePrefChange: function (newValue) {
		if (!this.isUserLibrary) return;

		this.settingsEl.setAttribute('rename-now-disabled', String(newValue));

		// Renaming has finished -- store the new value of the template and reset the flags
		if (newValue) {
			this.lastFormatString = Zotero.SyncedSettings.get(
				Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate'
			);
			this.isTemplateInSync = true;
			this.prompted = false;
		}
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
