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

ZoteroPane.React = {
	init() {
		var tagSelector = document.getElementById('zotero-tag-selector');
		ZoteroPane_Local.tagSelector = ZoteroPane.React.TagSelector.init(tagSelector, {
			onSelection: ZoteroPane_Local.updateTagFilter.bind(ZoteroPane_Local)
		});
	},
	
	destroy() {
		ZoteroPane_Local.tagSelector.unregister();
	}
}

