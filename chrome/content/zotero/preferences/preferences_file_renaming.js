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

Zotero_Preferences.FileRenaming = {
	mockItem: null,
	defaultExt: 'pdf',
	origTemplate: null,
	
	init: function () {
		this.origTemplate = Zotero.Prefs.get('attachmentRenameTemplate');
		this.inputEl = document.getElementById('file-renaming-format-template');
		this.backButtonEl = document.getElementById('prefs-subpane-back-button');
		this.navigationEl = document.getElementById('prefs-navigation');
		this.updatePreview();
		this.inputEl.addEventListener('input', this.updatePreview.bind(this));
		this.inputEl.addEventListener('blur', this.handleInputBlur.bind(this));

		this._itemsView = Zotero.getActiveZoteroPane()?.itemsView;
		this._updatePreview = this.updatePreview.bind(this);
		this._promptReplace = this.promptReplace.bind(this);

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
		this.promptReplace();
	},

	promptReplace: function () {
		if (this.inputEl.value !== this.origTemplate) {
			this.origTemplate = Zotero.Prefs.get('attachmentRenameTemplate');
			Zotero_Preferences.General.promptAutoRenameFiles();
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

	handleInputBlur() {
		const formatString = this.inputEl.value;
		const prefKey = this.inputEl.getAttribute('preference');
		if (formatString.replace(/\s/g, '') === '') {
			Zotero.Prefs.clear(prefKey, true);
			this.updatePreview();
		}
	},

	makeMockItem() {
		this.mockItem = new Zotero.Item('journalArticle');
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
