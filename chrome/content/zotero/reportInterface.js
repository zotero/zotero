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
	this.loadCollectionReport = loadCollectionReport;
	this.loadItemReport = loadItemReport;
	this.loadItemReportByIds = loadItemReportByIds;
	
	
	/*
	 * Load a report for the currently selected collection
	 */
	function loadCollectionReport(event) {
		var queryString = '';
		
		var col = ZoteroPane_Local.getSelectedCollection();
		var sortColumn = ZoteroPane_Local.getSortField();
		var sortDirection = ZoteroPane_Local.getSortDirection();
		if (sortColumn != 'title' || sortDirection != 'ascending') {
			queryString = '?sort=' + sortColumn + (sortDirection == 'ascending' ? '' : '/d');
		}
		
		if (col) {
			ZoteroPane_Local.loadURI('zotero://report/collection/'
				+ Zotero.Collections.getLibraryKeyHash(col)
				+ '/html/report.html' + queryString, event);
			return;
		}
		
		var s = ZoteroPane_Local.getSelectedSavedSearch();
		if (s) {
			ZoteroPane_Local.loadURI('zotero://report/search/'
				+ Zotero.Searches.getLibraryKeyHash(s)
				+ '/html/report.html' + queryString, event);
			return;
		}
		
		throw ('No collection currently selected');
	}
	
	
	/*
	 * Load a report for the currently selected items
	 */
	function loadItemReport(event) {
		var items = ZoteroPane_Local.getSelectedItems();
		
		if (!items || !items.length) {
			throw ('No items currently selected');
		}
		
		var keyHashes = [];
		for each(var item in items) {
			keyHashes.push(Zotero.Items.getLibraryKeyHash(item));
		}
		
		ZoteroPane_Local.loadURI('zotero://report/items/' + keyHashes.join('-') + '/html/report.html', event);
	}
	
	
	/*
	 * Load a report for the specified items
	 */
	function loadItemReportByIds(ids) {
		if (!ids || !ids.length) {
			throw ('No itemIDs provided to loadItemReportByIds()');
		}
		
		ZoteroPane_Local.loadURI('zotero://report/items/' + ids.join('-') + '/html/report.html');
	}
}
