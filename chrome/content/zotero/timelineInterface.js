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


var Zotero_Timeline_Interface = new function() {
	/*
	 * Load a timeline for the currently selected collection
	 */
	this.loadTimeline = function () {
		var uri = 'zotero://timeline/';
		var col = ZoteroPane.getSelectedCollection();
		
		if (col) {
			window.loadURI(uri + 'collection/' + Zotero.Collections.getLibraryKeyHash(col));
			return;
		}
		
		var s = ZoteroPane.getSelectedSavedSearch();
		if (s) {
			window.loadURI(uri + 'search/' + Zotero.Searches.getLibraryKeyHash(s));
			return;
		}
		
		window.loadURI(uri);
	}
}
