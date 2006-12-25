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
	io = window.arguments[0];
	
	collectionsView = new Zotero.CollectionTreeView();
	document.getElementById('zotero-collections-tree').view = collectionsView;

	// move to center of screen
	window.sizeToContent();
	window.moveTo(
		(self.screen.width-window.innerWidth)/2,
		(self.screen.height-window.innerHeight)/2
	);
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

		itemsView = new Zotero.ItemTreeView(collection, (window.arguments[1] ? true : false));
		document.getElementById('zotero-items-tree').view = itemsView;
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

function getSelectedItems(byID) {
	var start = new Object();
	var end = new Object();
	var returnArray = new Array();
	
	for(var i = 0, rangeCount = itemsView.selection.getRangeCount(); i < rangeCount; i++)
	{
		itemsView.selection.getRangeAt(i,start,end);
		for(var j = start.value; j <= end.value; j++)
		{
			if(byID) {
				returnArray.push(itemsView._getItemAtRow(j).ref.getID());
			} else {
				returnArray.push(itemsView._getItemAtRow(j).ref);
			}
		}
	}
	
	return returnArray;
}

function doAccept()
{
	io.dataOut = getSelectedItems(true);
}