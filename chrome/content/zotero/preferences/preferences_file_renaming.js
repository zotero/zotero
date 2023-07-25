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
/* eslint-disable camelcase */
/* global Zotero_Preferences: false */

Zotero_Preferences.FileRenaming = {
	mockItem: null,
	init: function () {
		this.inputRef = document.getElementById('file-renaming-template');
		this.updatePreview();
		this.inputRef.addEventListener('keyup', this.updatePreview.bind(this));
		Zotero.getActiveZoteroPane()?.itemsView.onSelect.addListener(this.updatePreview.bind(this));
	},

	updatePreview() {
		const item = Zotero.getActiveZoteroPane()?.getSelectedItems()?.[0] ?? this.mockItem ?? this.makeMockItem();
		const tpl = document.getElementById('file-renaming-template').value;
		const preview = Zotero.Attachments.getFileBaseNameFromItem(item, tpl);
		document.getElementById('file-renaming-preview').innerText = `${preview}.pdf`;
	},

	makeMockItem() {
		this.mockItem = new Zotero.Item('journalArticle');
		this.mockItem.setField('title', 'Example Article: Zotero Engineering');
		this.mockItem.setCreators([
			{ firstName: 'Jane', lastName: 'Doe', creatorType: 'author' },
			{ firstName: 'John', lastName: 'Smith', creatorType: 'author' }
		]);
		this.mockItem.setField('shortTitle', 'Example Article');
		this.mockItem.setField('publicationTitle', 'Advances in Zotero Engineering');
		this.mockItem.setField('volume', '9');
		this.mockItem.setField('issue', '1');
		this.mockItem.setField('pages', '34-55');
		this.mockItem.setField('date', '2016');
		this.mockItem.setField('DOI', '10.1016/1234-example');
		this.mockItem.setField('ISSN', '1234-5678');
		this.mockItem.setField('abstractNote', 'This is an example abstract.');
		this.mockItem.setField('extra', 'This is an example extra field.');
		this.mockItem.setField('accessDate', '2020-01-01');
		this.mockItem.setField('url', 'https://example.com');
		this.mockItem.setField('libraryCatalog', 'Example Library Catalog');
		return this.mockItem;
	},
};
