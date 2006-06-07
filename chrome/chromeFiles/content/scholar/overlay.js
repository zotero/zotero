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
	this.deleteItemSelection = deleteItemSelection;
	this.deleteCollectionSelection = deleteCollectionSelection;
	this.renameSelectedCollection = renameSelectedCollection;
	this.search = search;
	
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
	
		//Create the add menu with each item type
		var addMenu = document.getElementById('tb-add').firstChild;
		var itemTypes = Scholar.ItemTypes.getTypes();
		for(var i = 0; i<itemTypes.length; i++)
		{
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label", Scholar.getString("itemTypes."+itemTypes[i]['name']));
			menuitem.setAttribute("oncommand","ScholarPane.newItem("+itemTypes[i]['id']+")");
			addMenu.appendChild(menuitem);
		}
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
	 * Called when the window closes
	 */
	function newItem(typeID)
	{
		MetadataPane.viewItem(new Scholar.Item(typeID));
		document.getElementById('scholar-view-item').hidden = false;
		document.getElementById('scholar-view-splitter').hidden = false;
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
			
			MetadataPane.viewItem(item);

			document.getElementById('scholar-view-item').hidden=false;
		document.getElementById('scholar-view-splitter').hidden = false;
		}
		else
		{
			document.getElementById('scholar-view-item').hidden=true;
		document.getElementById('scholar-view-splitter').hidden = true;
			
		}

	}
	
	function deleteItemSelection()
	{
		if(itemsView && itemsView.selection.count > 0 && confirm(Scholar.getString('pane.items.delete')))
			itemsView.deleteSelection();
	}
	
	function deleteCollectionSelection()
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
}

var ScholarItemsDragObserver =
{ 
	onDragStart: function (evt,transferData,action)
	{ 
		transferData.data=new TransferData(); 
		transferData.data.addDataForFlavour("text/unicode","random data"); 
		
	}	
}; 

var ScholarCollectionsDragObserver =
{
	getSupportedFlavours : function () 
	{ 
		var flavours = new FlavourSet(); 
		flavours.appendFlavour("text/unicode"); 
		
		return flavours; 
	}, 
	onDragOver: function (evt,dropdata,session){}, 
	onDrop: function (evt,dropdata,session)
	{ 
		alert(dropdata.data);
	}
}

window.addEventListener("load", function(e) { ScholarPane.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ScholarPane.onUnload(e); }, false);