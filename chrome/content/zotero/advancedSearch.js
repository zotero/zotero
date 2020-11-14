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


Components.utils.import("resource://gre/modules/Services.jsm");
const AdvancedSearch = require('components/advancedSearch.js');

var ZoteroAdvancedSearch = new function() {
	this.onLoad = onLoad;
	this.search = search;
	this.onLibraryChange = onLibraryChange;
	this.clear = clear;
	this.onDblClick = onDblClick;
	this.onUnload = onUnload;
	this.renderButtons = renderButtons;
	
	this.itemsView = false;
	
	var _searchBoxReact;
	var _searchObject;
	var _libraryID;
	var _searchButtons;
	var _self = this;
	
	// Keeping state inside and outside React is a recipe for disaster, because we can't track
	// of changes outside React. So we use this property, which simply inverts when we need
	// React to go back to the state of truth (properties) and ignore it's internal state. This
	// is used by the clear function below.
	var _refreshReact = false;

	// Only used for testing
	this.getSearchObject = function () {
		return _searchObject;
	};
	this.updateSearchObject = function (searchObject) {
		_searchObject = searchObject;
		_refreshReact = !_refreshReact;
		renderSearchBox();
	};
	
	function onLoad() {
		_searchBoxReact = document.getElementById('zotero-search-box');
		
		// Set font size from pref
		var sbc = document.getElementById('zotero-search-box-container');
		Zotero.setFontSize(sbc);
		
		var io = window.arguments[0];
		
		io.dataIn.search.loadPrimaryData()
		.then(function () {
			_searchObject = io.dataIn.search;
			renderSearchBox();
		});

		_searchButtons = document.getElementById('zotero-search-buttons');
		this.renderButtons(false);
	}

	function renderSearchBox() {
		Zotero.ZoteroSearch.render(
			_searchBoxReact,
			{
				searchObject: _searchObject,
				onLibraryChange: onLibraryChange.bind(this),
				refresh: _refreshReact,
				onCommand: search.bind(this)
			}
		);
	}


	/**
	 * This is a temporary fix so that on the library change we can rerender the component.
	 * Once the whole search is converted to react, we can handle that inside react.
	 */
	function renderButtons(libraryIsEditable) {
		Zotero.AdvancedSearch.render(
			_searchButtons,
			{
				onSearch: search.bind(this),
				onClear: clear.bind(this),
				onSaveSearch: this.save.bind(this),
				libraryIsEditable: libraryIsEditable
			}
		);
	}
	
	
	function search() {
		// A minimal implementation of Zotero.CollectionTreeRow
		var collectionTreeRow = {
			view: {},
			ref: _searchObject,
			isSearchMode: function() { return true; },
			getItems: Zotero.Promise.coroutine(function* () {
				var search = _searchObject.clone();
				search.libraryID = _libraryID;
				var ids = yield search.search();
				return Zotero.Items.get(ids);
			}),
			isLibrary: function () { return false; },
			isCollection: function () { return false; },
			isSearch: function () { return true; },
			isPublications: () => false,
			isFeed: () => false,
			isShare: function () { return false; },
			isTrash: function () { return false; }
		}
		
		if (this.itemsView) {
			this.itemsView.unregister();
		}
		
		this.itemsView = new Zotero.ItemTreeView(collectionTreeRow, false);
		document.getElementById('zotero-items-tree').view = this.itemsView;
	}
	
	
	function clear() {
		if (this.itemsView) {
			this.itemsView.unregister();
		}
		document.getElementById('zotero-items-tree').view = null;
		
		var s = new Zotero.Search();
		// Don't clear the selected library
		s.libraryID = _searchObject.libraryID;
		s.addCondition('title', 'contains', '')
		_searchObject = s;
		_refreshReact = !_refreshReact;
		renderSearchBox();
	}
	
	
	this.save = Zotero.Promise.coroutine(function* () {
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		var libraryID = _searchObject.libraryID;
		
		var searches = yield Zotero.Searches.getAll(libraryID)
		var prefix = Zotero.getString('pane.collections.untitled');
		var name = Zotero.Utilities.Internal.getNextName(
			prefix,
			searches.map(s => s.name).filter(n => n.startsWith(prefix))
		);
		
		var name = { value: name };
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
		
		var s = _searchObject.clone();
		s.name = name.value;
		yield s.save();
		
		window.close()
	});
	
	
	function onLibraryChange(libraryID) {
		_libraryID = libraryID;
		if (!_searchObject.id) {
			_searchObject.libraryID = libraryID;
		}
		var library = Zotero.Libraries.get(libraryID);
		var isEditable = library.editable && library.libraryType != 'publications';
		_self.renderButtons.call(_self, isEditable);
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
				
				lastWin.ZoteroPane.selectItem(item.getID(), false, true);
				lastWin.focus();
			}
		}
	}
	
	
	function onUnload() {
		Zotero.AdvancedSearch.destroy(_searchButtons);
		Zotero.ZoteroSearch.destroy(_searchBoxReact);
		// Unregister search from Notifier
		if (this.itemsView) {
			this.itemsView.unregister();
		}
	}
}
