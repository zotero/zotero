/*
	Scholar
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
	http://chnm.gmu.edu/
	
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

var itemsView;
var collectionsView;
var io;

function doLoad()
{
	io = window.arguments[0];
	
	collectionsView = new Scholar.CollectionTreeView();
	document.getElementById('collections-tree').view = collectionsView;
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

		itemsView = new Scholar.ItemTreeView(collection);
		document.getElementById('items-tree').view = itemsView;
	}

}

function onItemSelected()
{
	
}

function doAccept()
{
	var start = new Object();
	var end = new Object();
	io.dataOut = new Array();
	
	for(var i = 0, rangeCount = itemsView.selection.getRangeCount(); i < rangeCount; i++)
	{
		itemsView.selection.getRangeAt(i,start,end);
		for(var j = start.value; j <= end.value; j++)
		{
			io.dataOut.push(itemsView._getItemAtRow(j).ref.getID());
		}
	}
}