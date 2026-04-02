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
	_settingsChanged: false,
	_currentLibraryID: null,
	_forceClose: false,

	init: function () {
		const { DEFAULT_ATTACHMENT_RENAME_TEMPLATE, DEFAULT_AUTO_RENAME_FILE_TYPES } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");
		this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE = DEFAULT_ATTACHMENT_RENAME_TEMPLATE;
		this.DEFAULT_AUTO_RENAME_FILE_TYPES = DEFAULT_AUTO_RENAME_FILE_TYPES;

		this.settingsEl = document.getElementById('file-renaming-settings');
		this.libraryPicker = document.getElementById('library-picker');
		this.renameFilesBtn = document.getElementById('file-renaming-rename-files-btn');
		this.doneBtn = document.getElementById('file-renaming-done-btn');

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
		this.renameFilesBtn.addEventListener('command', this._handleRenameFilesClick.bind(this));
		this.doneBtn.addEventListener('command', this._handleDoneClick.bind(this));

		this._handleDonePrefChange = this._handleDonePrefChange.bind(this);
		this._renameFilesPrefObserver = Zotero.Prefs.registerObserver('autoRenameFiles.done', this._handleDonePrefChange);

		this.loadSettingsForLibrary(initialLibraryID);
		this._currentLibraryID = initialLibraryID;
		this._updateButtons();

		window.addEventListener('unload', () => {
			Zotero.Prefs.unregisterObserver(this._renameFilesPrefObserver);
		});
	},

	get libraryID() {
		return parseInt(this.libraryPicker.value);
	},

	get isUserLibrary() {
		return this.libraryID === Zotero.Libraries.userLibraryID;
	},

	_updateButtons: function () {
		let autoRenameEnabled = this.settingsEl.autoRenameEnabled;
		let library = Zotero.Libraries.get(this._currentLibraryID);
		let isAdmin = this.isUserLibrary || library.isAdmin;
		this.renameFilesBtn.hidden = !autoRenameEnabled || !isAdmin;
		this.renameFilesBtn.disabled = this._isRenameFilesBtnDisabled();
	},

	_isRenameFilesBtnDisabled: function () {
		let libraryID = this._currentLibraryID;
		if (libraryID === Zotero.Libraries.userLibraryID) {
			return Zotero.Prefs.get('autoRenameFiles.done');
		}
		return !Zotero.Attachments.isAutoRenameFilesEnabledForLibrary(libraryID);
	},

	_openRenameFilesPreview: function (libraryID) {
		let args = { libraryID };
		Services.ww.openWindow(null, "chrome://zotero/content/renameFilesPreview.xhtml",
			"renameFilesPreview", "chrome,dialog=yes,centerscreen,modal", args);
		if (!args.cancelled) {
			this._resetBaseline(libraryID);
		}
		return !args.cancelled;
	},

	_handleDoneClick: async function () {
		// "Done" button -- prompt if dirty, then close
		if (this._shouldPromptRename(this._currentLibraryID)) {
			let wantsRename = await this._promptRename(this._currentLibraryID);
			if (wantsRename) {
				this._openRenameFilesPreview(this._currentLibraryID);
			}
		}
		window.close(); // bypasses the onclose handler
	},

	_handleRenameFilesClick: function () {
		// "Rename Files..." button
		this._openRenameFilesPreview(this._currentLibraryID);
		this._updateButtons();
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
		}

		// Store baseline for comparing against future changes
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
		if (newLibraryID === previousLibraryID) {
			return;
		}
		if (this._shouldPromptRename(previousLibraryID)) {
			// Revert picker so the previous library is visible behind the prompt
			this.libraryPicker.value = String(previousLibraryID);
			let wantsRename = await this._promptRename(previousLibraryID);
			if (wantsRename && !this._openRenameFilesPreview(previousLibraryID)) {
				// User cancelled the preview -- stay on the current library
				return;
			}
			this.libraryPicker.value = String(newLibraryID);
		}
		this._currentLibraryID = newLibraryID;
		this.loadSettingsForLibrary(newLibraryID);
		this._updateButtons();
	},

	handleSettingsChange: function (event) {
		if (!event.detail) {
			return;
		}

		let { autoRenameEnabled, enabledFileTypes, renameLinkedEnabled, formatTemplate } = event.detail;
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

			let settingsMatch = autoRenameEnabled === base.autoRenameEnabled
				&& enabledFileTypes === base.fileTypes
				&& formatTemplate === base.formatTemplate
				&& renameLinkedEnabled === base.renameLinked;
			Zotero.Prefs.set('autoRenameFiles.done', settingsMatch && this._baselineDone);
			this._settingsChanged = !settingsMatch;
		}
		else {
			Zotero.SyncedSettings.set(this.libraryID, 'autoRenameFiles', autoRenameEnabled);
			Zotero.SyncedSettings.set(this.libraryID, 'autoRenameFilesFileTypes', enabledFileTypes);
			Zotero.SyncedSettings.set(this.libraryID, 'attachmentRenameTemplate', formatTemplate);

			this._settingsChanged = autoRenameEnabled !== base.autoRenameEnabled
				|| enabledFileTypes !== base.fileTypes
				|| formatTemplate !== base.formatTemplate;
		}

		this._updateButtons();
	},

	handleWindowClose: async function (event) {
		if (this._forceClose) {
			return true;
		}
		if (this._shouldPromptRename(this._currentLibraryID)) {
			event.preventDefault();
			let wantsRename = await this._promptRename(this._currentLibraryID);
			if (wantsRename) {
				this._openRenameFilesPreview(this._currentLibraryID);
			}
			this._forceClose = true;
			window.close();
			return false;
		}
		return true;
	},

	_handleDonePrefChange: function () {
		if (this._currentLibraryID !== Zotero.Libraries.userLibraryID) {
			return;
		}

		this._updateButtons();
	},

	_shouldPromptRename: function (libraryID) {
		if (!this._settingsChanged) {
			return false;
		}
		if (libraryID === Zotero.Libraries.userLibraryID) {
			return Zotero.Prefs.get('autoRenameFiles') && !Zotero.Prefs.get('autoRenameFiles.done');
		}
		return Zotero.Attachments.isAutoRenameFilesEnabledForLibrary(libraryID);
	},

	_promptRename: async function (libraryID) {
		let isUserLib = libraryID === Zotero.Libraries.userLibraryID;
		let bodyID = isUserLib
			? { id: 'file-renaming-auto-rename-prompt-body' }
			: { id: 'file-renaming-auto-rename-prompt-body-library', args: { library: Zotero.Libraries.get(libraryID).name } };
		let [title, description, yes, no] = await document.l10n.formatValues([
			'file-renaming-auto-rename-prompt-title',
			bodyID,
			'file-renaming-auto-rename-prompt-yes',
			'file-renaming-auto-rename-prompt-no'
		]);
		let index = Zotero.Prompt.confirm({
			title,
			text: description,
			button0: yes,
			button1: no
		});
		if (index === 0) {
			return true;
		}
		if (isUserLib) {
			Zotero.Prefs.set('autoRenameFiles.done', false);
		}
		return false;
	},

	_resetBaseline: function (libraryID) {
		this._settingsChanged = false;
		if (libraryID === Zotero.Libraries.userLibraryID) {
			this._baselineDone = true;
			this._baselineSettings = {
				autoRenameEnabled: Zotero.Prefs.get('autoRenameFiles'),
				fileTypes: Zotero.Prefs.get('autoRenameFiles.fileTypes'),
				formatTemplate: Zotero.SyncedSettings.get(
					Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate'
				) ?? this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE,
				renameLinked: Zotero.Prefs.get('autoRenameFiles.linked'),
			};
		}
		else {
			this._baselineSettings = {
				autoRenameEnabled: Zotero.Attachments.isAutoRenameFilesEnabledForLibrary(libraryID),
				fileTypes: Zotero.SyncedSettings.get(libraryID, 'autoRenameFilesFileTypes')
					?? this.DEFAULT_AUTO_RENAME_FILE_TYPES,
				formatTemplate: Zotero.SyncedSettings.get(libraryID, 'attachmentRenameTemplate')
					?? this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE,
			};
		}
	}
};
