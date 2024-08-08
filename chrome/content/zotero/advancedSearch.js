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
import ItemTree from 'zotero/itemTree';
import { COLUMNS } from 'zotero/itemTreeColumns';


var ZoteroAdvancedSearch = new function() {
	this.onLoad = onLoad;
	this.search = search;
	this.clear = clear;
	this.onItemActivate = onItemActivate;
	
	this.itemsView = false;

	var _searchBox;
	var _libraryID;
	
	async function onLoad() {
		_searchBox = document.getElementById('zotero-search-box');
		
		// Set font size from pref
		var sbc = document.getElementById('zotero-search-box-container');
		Zotero.UIProperties.registerRoot(sbc);
		
		_searchBox.onLibraryChange = this.onLibraryChange;
		var io = window.arguments[0];
		
		io.dataIn.search.loadPrimaryData()
		.then(function () {
			_searchBox.search = io.dataIn.search;
		});
		
		var elem = document.getElementById('zotero-items-tree');
		const columns = COLUMNS.map((column) => {
			column = Object.assign({}, column);
			column.hidden = !['title', 'firstCreator', 'year', 'hasAttachment'].includes(column.dataKey);
			return column;
		});
		this.itemsView = await ItemTree.init(elem, {
			id: "advanced-search",
			dragAndDrop: true,
			persistColumns: true,
			columnPicker: true,
			onActivate: this.onItemActivate.bind(this),
			columns,
		});

		// A minimal implementation of Zotero.CollectionTreeRow
		var collectionTreeRow = {
			view: {},
			ref: _searchBox.search,
			visibilityGroup: 'default',
			isSearchMode: () => true,
			getItems: async () => [],
			isLibrary: () => false,
			isCollection: () => false,
			isSearch: () => true,
			isPublications: () => false,
			isDuplicates: () => false,
			isFeed: () => false,
			isFeeds: () => false,
			isFeedsOrFeed: () => false,
			isShare: () => false,
			isTrash: () => false
		};

		this.itemsView.changeCollectionTreeRow(collectionTreeRow);
		// Focus the first field in the window
		Services.focus.moveFocus(window, null, Services.focus.MOVEFOCUS_FORWARD, 0);
	}
	
	this.onUnload = function () {
		this.itemsView.unregister();
	}
	
	function search() {
		_searchBox.updateSearch();
		_searchBox.active = true;
		
		// A minimal implementation of Zotero.CollectionTreeRow
		var collectionTreeRow = {
			view: {},
			ref: _searchBox.search,
			visibilityGroup: 'default',
			isSearchMode: () => true,
			getItems: async function () {
				await Zotero.Libraries.get(_libraryID).waitForDataLoad('item');

				var search = _searchBox.search.clone();
				search.libraryID = _libraryID;
				var ids = await search.search();
				return Zotero.Items.get(ids);
			},
			isLibrary: () => false,
			isCollection: () => false,
			isSearch: () => true,
			isPublications: () => false,
			isDuplicates: () => false,
			isFeed: () => false,
			isFeeds: () => false,
			isFeedsOrFeed: () => false,
			isShare: () => false,
			isTrash: () => false
		};
		
		return this.itemsView.changeCollectionTreeRow(collectionTreeRow);
	}
	
	
	function clear() {
		this.itemsView.changeCollectionTreeRow(null);
		
		var s = new Zotero.Search();
		// Don't clear the selected library
		s.libraryID = _searchBox.search.libraryID;
		s.addCondition('title', 'contains', '');
		_searchBox.search = s;
		_searchBox.active = false;
	}
	
	
	this.save = Zotero.Promise.coroutine(function* () {
		_searchBox.updateSearch();
		
		var promptService = Services.prompt;
		
		var libraryID = _searchBox.search.libraryID;
		
		var searches = yield Zotero.Searches.getAll(libraryID)
		var prefix = Zotero.getString('pane.collections.untitled');
		var name = Zotero.Utilities.Internal.getNextName(
			prefix,
			searches.map(s => s.name).filter(n => n.startsWith(prefix))
		);
		
		name = { value: name };
		var result = promptService.prompt(window,
			Zotero.getString('pane.collections.newSavedSeach'),
			Zotero.getString('pane.collections.savedSearchName'), name, "", {});
		
		if (!result) {
			return;
		}
		
		if (!name.value) {
			name.value = 'untitled';
		}
		
		var s = _searchBox.search.clone();
		s.name = name.value;
		yield s.saveTx();
		
		window.close();
	});
	
	
	this.onLibraryChange = function (libraryID) {
		_libraryID = libraryID;
		var library = Zotero.Libraries.get(libraryID);
		var isEditable = library.editable && library.libraryType != 'publications';
		document.getElementById('zotero-search-save').disabled = !isEditable;
	}
	
	
	function onItemActivate(event, items)
	{
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					   .getService(Components.interfaces.nsIWindowMediator);
		
		var lastWin = wm.getMostRecentWindow("navigator:browser");
		
		if (!lastWin) {
			return;
		}
		
		lastWin.ZoteroPane.selectItems(items.map(item => item.id), false);
		lastWin.focus();
	}
}
