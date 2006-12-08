/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/


var Zotero_Report_Interface = new function() {
	this.loadCollectionReport = loadCollectionReport;
	this.loadItemReport = loadItemReport;
	this.loadItemReportByIds = loadItemReportByIds;
	
	
	/*
	 * Load a report for the currently selected collection
	 */
	function loadCollectionReport() {
		var queryString = '';
		
		var id = ZoteroPane.getSelectedCollection(true);
		var sortColumn = ZoteroPane.getSortField();
		var sortDirection = ZoteroPane.getSortDirection();
		
		if (sortColumn != 'title' || sortDirection != 'ascending') {
			queryString = '?sort=' + sortColumn +
				(sortDirection != 'ascending' ? '/d' : '');
		}
		
		if (id) {
			window.loadURI('zotero://report/collection/' + id + queryString);
			return;
		}
		
		var id = ZoteroPane.getSelectedSavedSearch(true);
		if (id) {
			window.loadURI('zotero://report/search/' + id + queryString);
			return;
		}
		
		throw ('No collection currently selected');
	}
	
	
	/*
	 * Load a report for the currently selected collection
	 */
	function loadItemReport() {
		var items = ZoteroPane.getSelectedItems(true);
		
		if (!items || !items.length) {
			throw ('No items currently selected');
		}
		
		window.loadURI('zotero://report/items/' + items.join('-'));
	}
	
	
	/*
	 * Load a report for the specified items
	 */
	function loadItemReportByIds(ids) {
		if (!ids || !ids.length) {
			throw ('No itemIDs provided to loadItemReportByIds()');
		}
		
		window.loadURI('zotero://report/items/' + ids.join('-'));
	}
}
