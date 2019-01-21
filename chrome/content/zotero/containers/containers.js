/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2018 Center for History and New Media
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

'use strict';

const { defineMessages } = require('react-intl');

ZoteroPane.Containers = {
	async init() {
		await this.initIntlStrings();
	},
	
	loadPane() {
		var tagSelector = document.getElementById('zotero-tag-selector');
		ZoteroPane.tagSelector = Zotero.TagSelector.init(tagSelector, {
			onSelection: ZoteroPane.updateTagFilter.bind(ZoteroPane)
		});
	},
	
	async initIntlStrings() {
		this.intlMessages = {};
		const intlFiles = ['zotero.dtd'];
		for (let intlFile of intlFiles) {
			let localeXML = await Zotero.File.getContentsFromURLAsync(`chrome://zotero/locale/${intlFile}`);
			let regexp = /<!ENTITY ([^\s]+)\s+"([^"]+)/g;
			let regexpResult;
			while (regexpResult = regexp.exec(localeXML)) {
				this.intlMessages[regexpResult[1]] = regexpResult[2];
			}
		}
	},
	
	destroy() {
		ZoteroPane.tagSelector.unregister();
	}
}

