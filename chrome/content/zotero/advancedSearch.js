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


var ZoteroAdvancedSearch = new function() {
	this.onLoad = onLoad;
	this.search = search;
	this.clear = clear;
	this.save = save;
	this.onDblClick = onDblClick;
	this.onUnload = onUnload;
	
	this.itemsView = false;
	
	var _searchBox;
	
	function onLoad() {
		_searchBox = document.getElementById('zotero-search-box');
		
		// Set font size from pref
		var sbc = document.getElementById('zotero-search-box-container');
		Zotero.setFontSize(sbc);
		
		_searchBox.onLibraryChange = this.onLibraryChange;
		var io = window.arguments[0];
		_searchBox.search = io.dataIn.search;
	}
	
	
	function search() {
		_searchBox.updateSearch();
		_searchBox.active = true;
		
		// A minimal implementation of Zotero.CollectionTreeView
		var itemGroup = {
			isSearchMode: function() { return true; },
			getItems: function () {
				var search = _searchBox.search.clone();
				
				// Hack to create a condition for the search's library --
				// this logic should really go in the search itself instead of here
				// and in collectionTreeView.js
				var conditions = search.getSearchConditions();
				if (!conditions.some(function (condition) condition.condition == 'libraryID')) {
					let libraryID = _searchBox.search.libraryID;
					// TEMP: libraryIDInt
					if (libraryID) {
						search.addCondition('libraryID', 'is', libraryID);
					}
					else {
						let groups = Zotero.Groups.getAll();
						for (let i=0; i<groups.length; i++) {
							search.addCondition('libraryID', 'isNot', groups[i].libraryID);
						}
					}
				}
				
				return Zotero.Items.get(search.search());
			},
			isLibrary: function () { return false; },
			isCollection: function () { return false; },
			isSearch: function () { return true; },
			isShare: function () { return false; },
			isTrash: function () { return false; }
		}
		
		if (this.itemsView) {
			this.itemsView.unregister();
		}
		
		this.itemsView = new Zotero.ItemTreeView(itemGroup, false);
		document.getElementById('zotero-items-tree').view = this.itemsView;
	}
	
	
	function clear() {
		if (this.itemsView) {
			this.itemsView.unregister();
		}
		document.getElementById('zotero-items-tree').view = null;
		
		var s = new Zotero.Search();
		// Don't clear the selected library
		s.libraryID = _searchBox.search.libraryID;
		s.addCondition('title', 'contains', '');
		_searchBox.search = s;
		_searchBox.active = false;
	}
	
	
	function save() {
		_searchBox.updateSearch();
		
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		var untitled = Zotero.DB.getNextName(
			_searchBox.search.libraryID,
			'savedSearches',
			'savedSearchName',
			Zotero.getString('pane.collections.untitled')
		);
		
		var name = { value: untitled };
		var result = promptService.prompt(window,
			Zotero.getString('pane.collections.newSavedSeach'),
			Zotero.getString('pane.collections.savedSearchName'), name, "", {});
		
		if (!result)
		{
			return;
		}
		
		if (!name.value)
		{
			name.value = untitled;
		}
		
		var s = _searchBox.search.clone();
		s.name = name.value;
		s.save();
		
		window.close();
	}
	
	
	this.onLibraryChange = function (libraryID) {
		document.getElementById('zotero-search-save').disabled = !Zotero.Libraries.isEditable(libraryID);
	}
	
	
	// Adapted from: http://www.xulplanet.com/references/elemref/ref_tree.html#cmnote-9
	function onDblClick(event, tree)
	{
		if (event && tree && event.type == "dblclick")
		{
			var row = {}, col = {}, obj = {};
			tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
			// obj.value == cell/text/image
			// TODO: handle collection double-click
			if (obj.value && this.itemsView && this.itemsView.selection.currentIndex > -1)
			{
				var item = this.itemsView.getSelectedItems()[0];
				
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
							   .getService(Components.interfaces.nsIWindowMediator);
				
				var lastWin = wm.getMostRecentWindow("navigator:browser");
				
				if (!lastWin) {
					window.open();
					var newWindow = wm.getMostRecentWindow("navigator:browser");
					var b = newWindow.getBrowser();
					return;
				}
				
				if (lastWin.ZoteroOverlay) {
					lastWin.ZoteroOverlay.toggleDisplay(true);
				}
				
				lastWin.ZoteroPane.selectItem(item.getID(), false, true);
				lastWin.focus();
			}
		}
	}
	
	
	function onUnload() {
		// Unregister search from Notifier
		if (this.itemsView) {
			this.itemsView.unregister();
		}
	}
}
