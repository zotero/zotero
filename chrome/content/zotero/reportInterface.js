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
	/*
	 * Load a report for the currently selected collection
	 */
	this.loadCollectionReport = function (event) {
		var sortColumn = ZoteroPane_Local.getSortField();
		var sortDirection = ZoteroPane_Local.getSortDirection();
		var queryString = '?sort=' + sortColumn
			+ '&direction=' + (sortDirection == 'ascending' ? 'asc' : 'desc');
		
		var url = 'zotero://report/';
		
		var source = ZoteroPane_Local.getSelectedCollection();
		if (!source) {
			source = ZoteroPane_Local.getSelectedSavedSearch();
		}
		if (!source) {
			throw new Error('No collection currently selected');
		}
		
		url += Zotero.API.getLibraryPrefix(source.libraryID) + '/';
		
		if (source instanceof Zotero.Collection) {
			url += 'collections/' + source.key;
		}
		else {
			url += 'searches/' + source.key;
		}
		
		url += '/items' + queryString;
		
		ZoteroPane_Local.loadURI(url, event);
	}
	
	
	/*
	 * Load a report for the currently selected items
	 */
	this.loadItemReport = function (event) {
		var libraryID = ZoteroPane_Local.getSelectedLibraryID();
		var items = ZoteroPane_Local.getSelectedItems();
		
		if (!items || !items.length) {
			throw new Error('No items currently selected');
		}
		
		var url = 'zotero://report/' + Zotero.API.getLibraryPrefix(libraryID) + '/items'
			+ '?itemKey=' + items.map(item => item.key).join(',');
		ZoteroPane_Local.loadURI(url, event);
	}
}
