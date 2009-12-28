/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

var itemsView;
var collectionsView;
var io;

/*
 * window takes two arguments:
 * io - used for input/output (dataOut is list of item IDs)
 * sourcesOnly - whether only sources should be shown in the window
 */
function doLoad()
{
	// Set font size from pref
	var sbc = document.getElementById('zotero-select-items-container');
	Zotero.setFontSize(sbc);
	
	io = window.arguments[0];
	if(io.wrappedJSObject) io = io.wrappedJSObject;
	if(io.addBorder) document.getElementsByTagName("dialog")[0].style.border = "1px solid black";
	if(io.singleSelection) document.getElementById("zotero-items-tree").setAttribute("seltype", "single");
	
	collectionsView = new Zotero.CollectionTreeView();
	document.getElementById('zotero-collections-tree').view = collectionsView;
	if(io.select) itemsView.selectItem(io.select);
}

function doUnload()
{
	collectionsView.unregister();
	if(itemsView)
		itemsView.unregister();
}

function onCollectionSelected()
{
	if(itemsView)
		itemsView.unregister();

	if(collectionsView.selection.count == 1 && collectionsView.selection.currentIndex != -1)
	{
		var collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
		collection.setSearch('');
		
		try {
			Zotero.UnresponsiveScriptIndicator.disable();
			itemsView = new Zotero.ItemTreeView(collection, (window.arguments[1] ? true : false));
			document.getElementById('zotero-items-tree').view = itemsView;
		}
		finally {
			Zotero.UnresponsiveScriptIndicator.enable();
		}
		
		if (collection.isLibrary()) {
			Zotero.Prefs.set('lastViewedFolder', 'L');
		}
		if (collection.isCollection()) {
			Zotero.Prefs.set('lastViewedFolder', 'C' + collection.ref.getID());
		}
		else if (collection.isSearch()) {
			Zotero.Prefs.set('lastViewedFolder', 'S' + collection.ref.id);
		}
	}
}

function onSearch()
{
	if(itemsView)
	{
		var searchVal = document.getElementById('zotero-tb-search').value;
		itemsView.setFilter('search', searchVal);
		
		document.getElementById('zotero-tb-search-cancel').hidden = searchVal == "";
	}
}

function onItemSelected()
{
	
}

function doAccept()
{
	io.dataOut = itemsView.getSelectedItems(true);
}