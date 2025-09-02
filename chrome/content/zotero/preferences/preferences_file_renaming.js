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
	mockItem: null,
	defaultExt: 'pdf',
	prompted: false,

	init: function () {
		this.lastFormatString = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate') ?? DEFAULT_ATTACHMENT_RENAME_TEMPLATE;
		this.isTemplateInSync = Zotero.Prefs.get('autoRenameFiles.done');
		this.inputEl = document.getElementById('file-renaming-format-template');
		this.backButtonEl = document.getElementById('prefs-subpane-back-button');
		this.navigationEl = document.getElementById('prefs-navigation');
		this.renameNowBtnEl = document.getElementById('file-renaming-rename-now');

		this.updatePreview();
		this.inputEl.addEventListener('input', this.handleInputChange.bind(this));
		this.inputEl.addEventListener('blur', this.handleInputBlur.bind(this));
		this.renameNowBtnEl.addEventListener('command', this.renameNow.bind(this));
		this.renameNowBtnEl.setAttribute('disabled', Zotero.Prefs.get('autoRenameFiles.done'));
		this.inputEl.value = this.lastFormatString;

		this._itemsView = Zotero.getActiveZoteroPane()?.itemsView;
		this._updatePreview = this.updatePreview.bind(this);
		this._promptReplace = this.promptReplace.bind(this);
		this._handleDonePrefChange = this.handleDonePrefChange.bind(this);

		this._renameFilesPrefObserver = Zotero.Prefs.registerObserver('autoRenameFiles.done', this._handleDonePrefChange);

		if (this._itemsView) {
			this._itemsView.onSelect.addListener(this._updatePreview);
		}
		if (this.backButtonEl) {
			this.backButtonEl.addEventListener('command', this._promptReplace);
		}
		if (this.navigationEl) {
			this.navigationEl.addEventListener('select', this._promptReplace);
		}
	},

	uninit: function () {
		this._itemsView.onSelect.removeListener(this._updatePreview);
		this.backButtonEl.removeEventListener('command', this._promptReplace);
		this.navigationEl.removeEventListener('select', this._promptReplace);
		Zotero.Prefs.unregisterObserver(this._renameFilesPrefObserver);
		this.promptReplace();
	},

	async handleInputChange() {
		const formatString = this.inputEl.value;
		// Ignore empty value, which we'll reset in handleInputBlur() if necessary
		if (formatString.replace(/\s/g, '') === '') {
			return;
		}
		this.updatePreview();
		await Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate', formatString);
		
		// reset 'done' to enable the rename button, set it to `false` if the
		// template is out of sync (e.g., the user changed it and declined
		// renaming) or if the new template has changed
		Zotero.Prefs.set('autoRenameFiles.done', this.isTemplateInSync ? formatString === this.lastFormatString : false);
	},

	async handleInputBlur() {
		const formatString = this.inputEl.value;
		if (formatString.replace(/\s/g, '') === '') {
			this.inputEl.value = this.lastFormatString = DEFAULT_ATTACHMENT_RENAME_TEMPLATE;
			this.updatePreview();
			await Zotero.SyncedSettings.clear(Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate');
		}
	},

	handleDonePrefChange(newValue) {
		this.renameNowBtnEl.setAttribute('disabled', newValue);

		// renaming has finished, store the new value of the template and reset the flags
		if (newValue) {
			this.lastFormatString = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'attachmentRenameTemplate');
			this.isTemplateInSync = true;
			this.prompted = false;
		}
	},

	promptReplace: function () {
		if (!this.prompted && !Zotero.Prefs.get('autoRenameFiles.done')) {
			// Set the flag to avoid repeating the prompt while renaming is in progress or user declined renaming
			this.prompted = true;
			promptAutoRenameFiles();
		}
	},

	getActiveItem() {
		let selectedItem = Zotero.getActiveZoteroPane()?.getSelectedItems()?.[0];
		if (selectedItem) {
			if (selectedItem.isRegularItem() && !selectedItem.parentKey) {
				return [selectedItem, this.defaultExt, ''];
			}
			if (selectedItem.isFileAttachment() && selectedItem.parentKey) {
				let ext = Zotero.Attachments.getCorrectFileExtension(selectedItem);
				let parentItem = Zotero.Items.getByLibraryAndKey(selectedItem.libraryID, selectedItem.parentKey);
				return [parentItem, ext ?? this.defaultExt, selectedItem.getField('title')];
			}
		}

		return null;
	},

	updatePreview() {
		const [item, ext, attachmentTitle] = this.getActiveItem() ?? [this.mockItem ?? this.makeMockItem(), this.defaultExt, ''];
		const formatString = this.inputEl.value;
		const preview = Zotero.Attachments.getFileBaseNameFromItem(item, { formatString, attachmentTitle });
		document.getElementById('file-renaming-format-preview').innerText = `${preview}.${ext}`;
	},

	async renameNow() {
		openRenameFilesPreview();
	},

	makeMockItem() {
		this.mockItem = new Zotero.Item('journalArticle');
		this.mockItem.libraryID = Zotero.Libraries.userLibraryID;
		this.mockItem.setField('title', 'Example Title: Example Subtitle');
		this.mockItem.setCreators([
			{ firstName: 'Jane', lastName: 'Doe', creatorType: 'author' },
			{ firstName: 'John', lastName: 'Smith', creatorType: 'author' }
		]);
		this.mockItem.setField('shortTitle', 'Example Title');
		this.mockItem.setField('publicationTitle', 'Advances in Example Engineering');
		this.mockItem.setField('volume', '9');
		this.mockItem.setField('issue', '1');
		this.mockItem.setField('pages', '34-55');
		this.mockItem.setField('date', '2018');
		this.mockItem.setField('DOI', '10.1016/1234-example');
		this.mockItem.setField('ISSN', '1234-5678');
		this.mockItem.setField('abstractNote', 'This is an example abstract.');
		this.mockItem.setField('extra', 'This is an example Extra field.');
		this.mockItem.setField('accessDate', '2020-01-01');
		this.mockItem.setField('url', 'https://example.com');
		this.mockItem.setField('libraryCatalog', 'Example Library Catalog');
		return this.mockItem;
	},
};
