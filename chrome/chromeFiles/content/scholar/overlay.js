/*
 * This object contains the various functions for the interface
 */
var ScholarPane = new function()
{
	var collectionsView;
	var itemsView;
	var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
	
	//Privileged methods
	this.onLoad = onLoad;
	this.onUnload = onUnload;
	this.toggleDisplay = toggleDisplay;
	this.newItem = newItem;
	this.newCollection = newCollection;
	this.onCollectionSelected = onCollectionSelected;
	this.itemSelected = itemSelected;
	this.deleteSelectedItem = deleteSelectedItem;
	this.deleteSelectedCollection = deleteSelectedCollection;
	this.renameSelectedCollection = renameSelectedCollection;
	this.search = search;
	this.getCollectionsView = getCollectionsView;
	this.getItemsView = getItemsView;
	this.buildCollectionContextMenu = buildCollectionContextMenu;
	this.buildItemContextMenu = buildItemContextMenu;
	
	/*
	 * Called when the window is open
	 */
	function onLoad()
	{
		//Initialize collections view
		collectionsView = new Scholar.CollectionTreeView();
		document.getElementById('collections-tree').view = collectionsView;

		//select Library
		collectionsView.selection.select(0);
	}
	
	/*
	 * Called when the window closes
	 */
	function onUnload()
	{
		collectionsView.unregister();
		if(itemsView)
			itemsView.unregister();
	}

	/*
	 * Hides/displays the Scholar interface
	 */
	function toggleDisplay()
	{
		var visible = document.getElementById('scholar-pane').getAttribute('collapsed') == 'true';
		
		document.getElementById('scholar-pane').setAttribute('collapsed',!visible);
		document.getElementById('scholar-splitter').setAttribute('collapsed',!visible);
	}
		
	/*
	 * Create a new item
	 */
	function newItem(typeID)
	{
		if(document.getElementById('tb-search').value != "")
		{
			document.getElementById('tb-search').value = "";
			document.getElementById('tb-search').doCommand();
		}
		
		var item = new Scholar.Item(typeID);
		item.save();
		if(itemsView && itemsView._itemGroup.isCollection())
			itemsView._itemGroup.ref.addItem(item.getID());
			
		document.getElementById('scholar-view-item').selectedIndex = 1;
	}
	
	function newCollection()
	{
		Scholar.Collections.add(Scholar.getString('pane.collections.untitled'));
	}
	
	function onCollectionSelected()
	{
		if(itemsView)
			itemsView.unregister();
		
		document.getElementById('tb-search').value = "";
			
		if(collectionsView.selection.count == 1 && collectionsView.selection.currentIndex != -1)
		{
			var collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			collection.setSearch('');
			
			itemsView = new Scholar.ItemTreeView(collection);
			document.getElementById('items-tree').view = itemsView;
			document.getElementById('tb-rename').disabled = collection.isLibrary();
			itemsView.selection.clearSelection();
		}
		else
		{
			document.getElementById('items-tree').view = itemsView = null;
			document.getElementById('tb-rename').disabled = true;
		}
	}
	
	function itemSelected()
	{
		if(itemsView && itemsView.selection.count == 1 && itemsView.selection.currentIndex != -1)
		{
			var item = itemsView._getItemAtRow(itemsView.selection.currentIndex);
			
			ScholarItemPane.viewItem(item);

			document.getElementById('scholar-view-item').hidden = false;
			document.getElementById('scholar-view-selected-label').hidden = true;
		}
		else
		{
			document.getElementById('scholar-view-item').hidden = true;
			var label = document.getElementById('scholar-view-selected-label');
			label.hidden = false;
			label.value = itemsView.selection.count + " items selected";	
		}

	}
	
	function deleteSelectedItem()
	{
		if(itemsView && itemsView.selection.count > 0 && confirm(Scholar.getString('pane.items.delete')))
			itemsView.deleteSelection();
	}
	
	function deleteSelectedCollection()
	{
		if(collectionsView.selection.count > 0 && confirm(Scholar.getString('pane.collections.delete')))
			collectionsView.deleteSelection();
	}
	
	function renameSelectedCollection()
	{
		if(collectionsView.selection.count > 0)
		{
			collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			
			var newName = prompt(Scholar.getString('pane.collections.rename'),collection.getName());
			if(newName)
				collection.ref.rename(newName);
		}
	}
	
	function search()
	{
		if(itemsView)
			itemsView.searchText(document.getElementById('tb-search').value);
	}
	
	function getCollectionsView()
	{
		return collectionsView;
	}
	
	function getItemsView()
	{
		return itemsView;
	}
	
	function buildCollectionContextMenu()
	{
		var menu = document.getElementById('scholar-collectionmenu');
		
		if(collectionsView.selection.count == 1 && !collectionsView._getItemAtRow(collectionsView.selection.currentIndex).isLibrary())
		{
			menu.childNodes[2].removeAttribute('disabled');
			menu.childNodes[3].removeAttribute('disabled');
		}
		else
		{
			menu.childNodes[2].setAttribute('disabled', true);
			menu.childNodes[3].setAttribute('disabled', true);
		}
	}
	
	function buildItemContextMenu()
	{
		var menu = document.getElementById('scholar-itemmenu');
		
		if(itemsView && itemsView.selection.count > 0)
			menu.childNodes[2].removeAttribute('disabled');
		else
			menu.childNodes[2].setAttribute('disabled', true);
	
		if(itemsView && itemsView.selection.count > 1)
			menu.childNodes[2].setAttribute('label', 'Remove Selected Items...');
		else
			menu.childNodes[2].setAttribute('label', 'Remove Selected Item...');	
	}
}

window.addEventListener("load", function(e) { ScholarPane.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ScholarPane.onUnload(e); }, false);