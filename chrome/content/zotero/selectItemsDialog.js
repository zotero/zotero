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

var itemsView;
var collectionsView;
var io;
var connectionSelectedDeferred;

/*
 * window takes two arguments:
 * io - used for input/output (dataOut is list of item IDs)
 * sourcesOnly - whether only sources should be shown in the window
 */
var doLoad = Zotero.Promise.coroutine(function* () {
	// Set font size from pref
	var sbc = document.getElementById('zotero-select-items-container');
	Zotero.setFontSize(sbc);
	
	io = window.arguments[0];
	if(io.wrappedJSObject) io = io.wrappedJSObject;
	if(io.addBorder) document.getElementsByTagName("dialog")[0].style.border = "1px solid black";
	if(io.singleSelection) document.getElementById("zotero-items-tree").setAttribute("seltype", "single");
	
	setItemsPaneMessage(Zotero.getString('pane.items.loading'));
	
	collectionsView = new Zotero.CollectionTreeView();
	collectionsView.hideSources = ['duplicates', 'trash', 'feeds'];
	document.getElementById('zotero-collections-tree').view = collectionsView;
	
	yield collectionsView.waitForLoad();
	
	connectionSelectedDeferred = Zotero.Promise.defer();
	yield connectionSelectedDeferred.promise;
	
	if (io.select) {
		yield collectionsView.selectItem(io.select);
	}
	
	Zotero.updateQuickSearchBox(document);
});

function doUnload()
{
	collectionsView.unregister();
	if(itemsView)
		itemsView.unregister();
}

var onCollectionSelected = Zotero.Promise.coroutine(function* ()
{
	if(itemsView)
		itemsView.unregister();

	if(collectionsView.selection.count == 1 && collectionsView.selection.currentIndex != -1)
	{
		var collectionTreeRow = collectionsView.getRow(collectionsView.selection.currentIndex);
		collectionTreeRow.setSearch('');
		Zotero.Prefs.set('lastViewedFolder', collectionTreeRow.id);
		
		setItemsPaneMessage(Zotero.getString('pane.items.loading'));
		
		// Load library data if necessary
		var library = Zotero.Libraries.get(collectionTreeRow.ref.libraryID);
		if (!library.getDataLoaded('item')) {
			Zotero.debug("Waiting for items to load for library " + library.libraryID);
			yield library.waitForDataLoad('item');
		}
		
		// Create items list and wait for it to load
		itemsView = new Zotero.ItemTreeView(collectionTreeRow);
		itemsView.sourcesOnly = !!window.arguments[1];
		document.getElementById('zotero-items-tree').view = itemsView;
		yield itemsView.waitForLoad();
		
		clearItemsPaneMessage();
		
		connectionSelectedDeferred.resolve();
		collectionsView.runListeners('select');
	}
});

function onSearch()
{
	if(itemsView)
	{
		var searchVal = document.getElementById('zotero-tb-search').value;
		itemsView.setFilter('search', searchVal);
	}
}

function onItemSelected()
{
	itemsView.runListeners('select');
}

function setItemsPaneMessage(content) {
	var elem = document.getElementById('zotero-items-pane-message-box');
	elem.textContent = '';
	if (typeof content == 'string') {
		let contentParts = content.split("\n\n");
		for (let part of contentParts) {
			var desc = document.createElement('description');
			desc.appendChild(document.createTextNode(part));
			elem.appendChild(desc);
		}
	}
	else {
		elem.appendChild(content);
	}
	document.getElementById('zotero-items-pane-content').selectedIndex = 1;
}


function clearItemsPaneMessage() {
	var box = document.getElementById('zotero-items-pane-message-box');
	document.getElementById('zotero-items-pane-content').selectedIndex = 0;
}

function doAccept()
{
	io.dataOut = itemsView.getSelectedItems(true);
}