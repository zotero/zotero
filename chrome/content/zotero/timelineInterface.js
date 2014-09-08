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


var Zotero_Timeline_Interface = new function() {
	/*
	 * Load a timeline for the currently selected collection
	 */
	this.loadTimeline = function () {
		var uri = 'zotero://timeline/';
		
		var col = ZoteroPane_Local.getSelectedCollection();
		if (col) {
			uri += Zotero.API.getLibraryPrefix(col.libraryID) + '/collections/' + col.key;
		}
		else {
			var s = ZoteroPane_Local.getSelectedSavedSearch();
			if (s) {
				uri += Zotero.API.getLibraryPrefix(s.libraryID) + '/searches/' + s.key;
			}
			else {
				let libraryID = ZoteroPane_Local.getSelectedLibraryID();
				if (libraryID) {
					uri += Zotero.API.getLibraryPrefix(libraryID);
				}
			}
		}
		ZoteroPane_Local.loadURI(uri);
	}
}
