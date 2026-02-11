/*
	***** BEGIN LICENSE BLOCK *****
    
	Copyright © Corporation for Digital Scholarship
				Vienna, Virginia, USA
				https://www.zotero.org
    
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
/* global Zotero_Preferences: false */

const { DEFAULT_ATTACHMENT_RENAME_TEMPLATE, openRenameFilesPreview,
	promptAutoRenameFiles } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");

Zotero_Preferences.FileRenaming = {
	prompted: false,

	init: function () {
		this.backButtonEl = document.getElementById('prefs-subpane-back-button');
		this.navigationEl = document.getElementById('prefs-navigation');
		this.settingsEl = document.getElementById('file-renaming-template');
		
		this.lastFormatString = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate') ?? DEFAULT_ATTACHMENT_RENAME_TEMPLATE;
		this.isTemplateInSync = Zotero.Prefs.get('autoRenameFiles.done');
		
		this.settingsEl.addEventListener('rename', openRenameFilesPreview);
		this.settingsEl.addEventListener('change', this.handleSettingsChange.bind(this));
		this.settingsEl.setAttribute('rename-now-disabled', Zotero.Prefs.get('autoRenameFiles.done'));
		this.settingsEl.setAttribute('format-template', this.lastFormatString);
		
		this._promptReplace = this.promptReplace.bind(this);
		this._handleDonePrefChange = this.handleDonePrefChange.bind(this);
		this._renameFilesPrefObserver = Zotero.Prefs.registerObserver('autoRenameFiles.done', this._handleDonePrefChange);
		
		if (this.backButtonEl) {
			this.backButtonEl.addEventListener('command', this._promptReplace);
		}
		if (this.navigationEl) {
			this.navigationEl.addEventListener('select', this._promptReplace);
		}
	},

	uninit: function () {
		this.backButtonEl.removeEventListener('command', this._promptReplace);
		this.navigationEl.removeEventListener('select', this._promptReplace);
		Zotero.Prefs.unregisterObserver(this._renameFilesPrefObserver);
		this.promptReplace();
	},

	async handleSettingsChange(event) {
		if (!event.detail) {
			return;
		}
		
		const { formatTemplate } = event.detail;
		if (formatTemplate.replace(/\s/g, '') === '') {
			await Zotero.SyncedSettings.clear(Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate');
		}
		else {
			await Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate', formatTemplate);
		}

		// reset 'done' to enable the rename button, set it to `false` if the
		// template is out of sync (e.g., the user changed it and declined
		// renaming) or if the new template has changed
		Zotero.Prefs.set('autoRenameFiles.done', this.isTemplateInSync ? formatTemplate === this.lastFormatString : false);
	},

	handleDonePrefChange(newValue) {
		this.settingsEl.setAttribute('rename-now-disabled', newValue);

		// renaming has finished, store the new value of the template and reset the flags
		if (newValue) {
			this.lastFormatString = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate');
			this.isTemplateInSync = true;
			this.prompted = false;
		}
	},

	promptReplace: function () {
		if (!this.prompted && !Zotero.Prefs.get('autoRenameFiles.done')) {
			// Set the flag to avoid repeating the prompt while renaming is in progress or the user declined renaming
			this.prompted = true;
			promptAutoRenameFiles();
		}
	}
};
