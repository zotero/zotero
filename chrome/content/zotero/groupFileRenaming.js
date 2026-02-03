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

var GroupFileRenaming = { // eslint-disable-line no-unused-vars
	init: function () {
		const { DEFAULT_ATTACHMENT_RENAME_TEMPLATE, DEFAULT_AUTO_RENAME_FILE_TYPES } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");
		
		this.libraryID = window.arguments[0].wrappedJSObject.libraryID;
		
		let group = Zotero.Groups.getByLibraryID(this.libraryID);
		document.l10n.setAttributes(
			window.document.documentElement,
			'group-file-renaming-settings-window',
			{ groupName: group.name }
		);
		
		this.settingsEl = document.getElementById('file-renaming-settings');
		this.settingsEl.setAttribute(
			'auto-rename-enabled',
			Zotero.Attachments.isAutoRenameFilesEnabledForLibrary(this.libraryID)
		);
		this.settingsEl.setAttribute(
			'file-types',
			Zotero.SyncedSettings.get(this.libraryID, 'autoRenameFilesFileTypes') ?? DEFAULT_AUTO_RENAME_FILE_TYPES
		);
		this.settingsEl.setAttribute(
			'format-template',
			Zotero.SyncedSettings.get(this.libraryID, 'attachmentRenameTemplate') ?? DEFAULT_ATTACHMENT_RENAME_TEMPLATE
		);
		this.settingsEl.addEventListener('change', this.handleSettingsChange.bind(this));
		this.settingsEl.addEventListener('rename', this.handleRename.bind(this));
	},

	handleSettingsChange: function (event) {
		if (!event.detail) {
			return;
		}

		const { autoRenameEnabled, enabledFileTypes, formatTemplate } = event.detail;
		this.settingsEl.setAttribute('rename-now-disabled', !autoRenameEnabled);
		Zotero.SyncedSettings.set(this.libraryID, 'autoRenameFiles', autoRenameEnabled);
		Zotero.SyncedSettings.set(this.libraryID, 'autoRenameFilesFileTypes', enabledFileTypes);
		Zotero.SyncedSettings.set(this.libraryID, 'attachmentRenameTemplate', formatTemplate);
	},
	
	handleRename: function () {
		const { openRenameFilesPreview } = ChromeUtils.importESModule("chrome://zotero/content/renameFiles.mjs");
		openRenameFilesPreview(this.libraryID);
	}
};
