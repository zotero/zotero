/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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


var Zotero_Report_Interface = new function() {
	/**
	 * Load a report for the selected collections/searches
	 */
	this.loadCollectionReport = function () {
		var libraryID = ZoteroPane_Local.getSelectedLibraryID();
		var collections = ZoteroPane_Local.getSelectedCollections();
		var items = collections.length
			? _getCollectionItems(collections)
			: ZoteroPane_Local.getSortedItems();
		if (!items.length) {
			throw new Error('No items in selected collections');
		}
		
		var sortColumn = ZoteroPane_Local.getSortField();
		var url = 'zotero://report/'
			+ Zotero.API.getLibraryPrefix(libraryID) + '/'
			+ 'items?sort=' + sortColumn
			+ '&direction=' + (ZoteroPane.getSortDirection() == 1 ? 'asc' : 'desc')
			+ '&itemKey=' + items.map(item => item.key).join(',');
		
		Zotero.openInViewer(url, { allowJavaScript: false });
	}
	
	
	/**
	 * Load a report for the currently selected items
	 */
	this.loadItemReport = function () {
		var items = ZoteroPane_Local.getSelectedItems();
		if (!items || !items.length) {
			throw new Error('No items currently selected');
		}
		
		var libraryID = items[0].libraryID;
		var url = 'zotero://report/'
			+ Zotero.API.getLibraryPrefix(libraryID) + '/'
			+ 'items?itemKey=' + items.map(item => item.key).join(',');

		Zotero.openInViewer(url, { allowJavaScript: false });
	}


	/**
	 * Get all items from the given collections, respecting recursiveCollections
	 */
	function _getCollectionItems(collections) {
		var items = new Set();
		var recursive = Zotero.Prefs.get('recursiveCollections');
		for (let collection of collections) {
			for (let item of collection.getChildItems()) {
				items.add(item);
			}
			if (recursive) {
				for (let desc of collection.getDescendents(false, 'collection')) {
					let col = Zotero.Collections.get(desc.id);
					if (col) {
						for (let item of col.getChildItems()) {
							items.add(item);
						}
					}
				}
			}
		}
		return [...items];
	}
}
