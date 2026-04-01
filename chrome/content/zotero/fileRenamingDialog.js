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

/* global FileRenamingPreview */
var FileRenamingDialog = { // eslint-disable-line no-unused-vars
	_state: 'settings',
	_settingsChanged: false,
	_currentLibraryID: null,
	_continuation: null,
	_forceClose: false,

	init: function () {
		const { DEFAULT_ATTACHMENT_RENAME_TEMPLATE, DEFAULT_AUTO_RENAME_FILE_TYPES } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");
		this.DEFAULT_ATTACHMENT_RENAME_TEMPLATE = DEFAULT_ATTACHMENT_RENAME_TEMPLATE;
		this.DEFAULT_AUTO_RENAME_FILE_TYPES = DEFAULT_AUTO_RENAME_FILE_TYPES;

		// Settings elements
		this.settingsEl = document.getElementById('file-renaming-settings');
		this.libraryPicker = document.getElementById('library-picker');
		this.deck = document.getElementById('file-renaming-deck');

		// Preview elements
		this.previewIntroEl = document.getElementById('preview-intro');
		this.previewFilesListEl = document.getElementById('preview-files-list');
		this.previewLoadingEl = document.getElementById('preview-loading');
		this.previewProgressEl = document.getElementById('preview-progress');

		// Buttons
		this.secondaryBtn = document.getElementById('file-renaming-secondary-btn');
		this.primaryBtn = document.getElementById('file-renaming-primary-btn');

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
		this.secondaryBtn.addEventListener('command', this._handleSecondaryClick.bind(this));
		this.primaryBtn.addEventListener('command', this._handlePrimaryClick.bind(this));

		this._handleDonePrefChange = this._handleDonePrefChange.bind(this);
		this._renameFilesPrefObserver = Zotero.Prefs.registerObserver('autoRenameFiles.done', this._handleDonePrefChange);

		// Initialize preview renderer
		FileRenamingPreview.init(this.previewFilesListEl, this.previewProgressEl);

		this.loadSettingsForLibrary(initialLibraryID);
		this._currentLibraryID = initialLibraryID;
		this._showSettings();

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

	// --- State: Settings ---

	_showSettings: function () {
		this._state = 'settings';
		this.deck.selectedIndex = 0;
		this.libraryPicker.disabled = false;

		// Reset preview panel for next use
		this.previewFilesListEl.hidden = false;
		this.previewLoadingEl.hidden = false;
		this.previewProgressEl.classList.add('hidden');
		this.previewProgressEl.value = 0;
		this.previewIntroEl.dataset.l10nId = 'rename-files-preview-intro';

		this._updateSettingsButtons();
	},

	_updateSettingsButtons: function () {
		let autoRenameEnabled = this.settingsEl.autoRenameEnabled;

		this.secondaryBtn.hidden = !autoRenameEnabled;
		this.secondaryBtn.disabled = this._isRenameNowDisabled();
		document.l10n.setAttributes(this.secondaryBtn, 'preferences-file-renaming-rename-now');

		this.primaryBtn.hidden = false;
		this.primaryBtn.disabled = false;
		document.l10n.setAttributes(this.primaryBtn, 'file-renaming-done-button');
	},

	_isRenameNowDisabled: function () {
		let libraryID = this._currentLibraryID;
		if (libraryID === Zotero.Libraries.userLibraryID) {
			return Zotero.Prefs.get('autoRenameFiles.done');
		}
		return !Zotero.Attachments.isAutoRenameFilesEnabledForLibrary(libraryID);
	},

	// --- State: Preview ---

	_enterPreview: async function (libraryID, continuation) {
		this._state = 'preview-loading';
		this._continuation = continuation;
		this._previewLibraryID = libraryID;

		this.deck.selectedIndex = 1;
		this.libraryPicker.disabled = true;

		// Reset preview UI
		this.previewLoadingEl.hidden = false;
		this.previewProgressEl.classList.add('hidden');
		this.previewProgressEl.value = 0;
		this.previewIntroEl.dataset.l10nId = 'rename-files-preview-intro';

		// Show Cancel, disable Rename Files until loading completes
		this.secondaryBtn.hidden = false;
		this.secondaryBtn.disabled = false;
		document.l10n.setAttributes(this.secondaryBtn, 'file-renaming-cancel-button');

		this.primaryBtn.hidden = false;
		this.primaryBtn.disabled = true;
		document.l10n.setAttributes(this.primaryBtn, 'file-renaming-rename-files');

		let results = await FileRenamingPreview.loadPreview(libraryID);

		this.previewLoadingEl.hidden = true;

		if (results.length === 0) {
			this._state = 'no-files';
			this.previewIntroEl.dataset.l10nId = 'rename-files-preview-no-files';

			// Mark as done for user library
			if (libraryID === Zotero.Libraries.userLibraryID) {
				Zotero.Prefs.set('autoRenameFiles.done', true);
			}

			// Show only Done
			this.secondaryBtn.hidden = true;
			document.l10n.setAttributes(this.primaryBtn, 'file-renaming-done-button');
			this.primaryBtn.disabled = false;
		}
		else {
			this._state = 'preview-ready';
			this.primaryBtn.disabled = false;
		}
	},

	_handlePrimaryClick: async function () {
		switch (this._state) {
			case 'settings':
				// "Done" button in settings -- prompt if dirty, then close
				if (this._shouldPromptRename(this._currentLibraryID)) {
					this._handleWindowClosePrompt();
				}
				else {
					window.close(); // bypasses the onclose handler
				}
				break;

			case 'preview-ready':
				await this._startRename();
				break;

			case 'no-files':
				this._executeContinuation();
				break;
		}
	},

	_handleSecondaryClick: function () {
		switch (this._state) {
			case 'settings':
				// "Preview Changes..." button -- enter preview
				this._enterPreview(this._currentLibraryID, () => {
					this._resetBaseline(this._currentLibraryID);
					FileRenamingPreview.destroy();
					this._showSettings();
				});
				break;

			default:
				// "Cancel" from any preview sub-state
				FileRenamingPreview.destroy();
				this._showSettings();
				break;
		}
	},

	_startRename: async function () {
		this._state = 'renaming';

		this.previewFilesListEl.hidden = true;
		this.previewProgressEl.classList.remove('hidden');
		this.previewIntroEl.dataset.l10nId = 'rename-files-preview-renaming';

		this.secondaryBtn.hidden = true;
		this.primaryBtn.hidden = true;

		await FileRenamingPreview.runRename(this._previewLibraryID);

		this._executeContinuation();
	},

	_executeContinuation: function () {
		let continuation = this._continuation;
		this._continuation = null;
		FileRenamingPreview.destroy();
		if (continuation) {
			continuation();
		}
	},

	// --- Settings management ---

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
			if (wantsRename) {
				this._enterPreview(previousLibraryID, () => {
					this._resetBaseline(previousLibraryID);
					FileRenamingPreview.destroy();
					this._currentLibraryID = newLibraryID;
					this.libraryPicker.value = String(newLibraryID);
					this.loadSettingsForLibrary(newLibraryID);
					this._showSettings();
				});
				return;
			}
			// User declined -- proceed with the switch
			this.libraryPicker.value = String(newLibraryID);
		}
		this._currentLibraryID = newLibraryID;
		this.loadSettingsForLibrary(newLibraryID);
		this._updateSettingsButtons();
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
		}

		this._updateSettingsButtons();
	},

	handleWindowClose: function (event) {
		if (this._forceClose || this._state !== 'settings') {
			return true;
		}
		if (this._shouldPromptRename(this._currentLibraryID)) {
			event.preventDefault();
			this._handleWindowClosePrompt();
			return false;
		}
		return true;
	},

	_handleWindowClosePrompt: async function () {
		let libraryID = this._currentLibraryID;
		let wantsRename = await this._promptRename(libraryID);
		if (wantsRename) {
			this._enterPreview(libraryID, () => {
				this._forceClose = true;
				window.close();
			});
		}
		else {
			this._forceClose = true;
			window.close();
		}
	},

	_handleDonePrefChange: function (newValue) {
		if (this._currentLibraryID !== Zotero.Libraries.userLibraryID) return;

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
		}

		if (this._state === 'settings') {
			this._updateSettingsButtons();
		}
	},

	_shouldPromptRename: function (libraryID) {
		if (libraryID === Zotero.Libraries.userLibraryID) {
			return Zotero.Prefs.get('autoRenameFiles') && !Zotero.Prefs.get('autoRenameFiles.done');
		}
		return this._settingsChanged
			&& Zotero.Attachments.isAutoRenameFilesEnabledForLibrary(libraryID);
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
		if (libraryID === Zotero.Libraries.userLibraryID) {
			this._baselineDone = true;
		}
		else {
			this._settingsChanged = false;
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
