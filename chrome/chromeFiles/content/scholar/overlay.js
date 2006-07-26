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
	this.fullScreen = fullScreen;
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
	this.getSelectedCollection = getSelectedCollection;
	this.getSelectedItem = getSelectedItem;
	this.buildCollectionContextMenu = buildCollectionContextMenu;
	this.buildItemContextMenu = buildItemContextMenu;
	this.openNoteWindow = openNoteWindow;
	this.newNote = newNote;
	
	/*
	 * Called when the window is open
	 */
	function onLoad()
	{
		if(Scholar.Prefs.get("scholarPaneOnTop"))
		{
			var oldPane = document.getElementById('scholar-pane');
			var oldSplitter = document.getElementById('scholar-splitter');
			var appContent = document.getElementById('appcontent');
			
			var newPane = document.createElement('hbox');
			newPane.setAttribute('id','scholar-pane');
			newPane.setAttribute('collapsed',true);
			newPane.setAttribute('flex','1');
			while(oldPane.hasChildNodes())
				newPane.appendChild(oldPane.firstChild);
			appContent.removeChild(oldPane);
			appContent.insertBefore(newPane, document.getElementById('content'));
			
			var newSplitter = document.createElement('splitter');
			newSplitter.setAttribute('id','scholar-splitter');
			newSplitter.setAttribute('collapsed',true);
			newSplitter.setAttribute('resizebefore','closest');
			newSplitter.setAttribute('resizeafter','closest');
			appContent.removeChild(oldSplitter);
			appContent.insertBefore(newSplitter, document.getElementById('content'));
		}
		
		//Initialize collections view
		collectionsView = new Scholar.CollectionTreeView();
		document.getElementById('collections-tree').view = collectionsView;
		
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
		
		if(!visible)
			document.getElementById('content').setAttribute('collapsed', false);
	}
	
	function fullScreen()
	{
		var visible = document.getElementById('content').getAttribute('collapsed') == 'true';
		document.getElementById('content').setAttribute('collapsed', !visible);
		document.getElementById('scholar-splitter').setAttribute('collapsed', !visible);
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
			
		//set to Info tab
		document.getElementById('scholar-view-item').selectedIndex = 0;
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
		document.getElementById('scholar-search-options').hidden = true;
		
		if(collectionsView.selection.count == 1 && collectionsView.selection.currentIndex != -1)
		{
			var collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			collection.setSearch('');
			
			itemsView = new Scholar.ItemTreeView(collection);
			document.getElementById('items-tree').view = itemsView;
			document.getElementById('tb-collection-rename').disabled = collection.isLibrary();
			itemsView.selection.clearSelection();
		}
		else
		{
			document.getElementById('items-tree').view = itemsView = null;
			document.getElementById('tb-collection-rename').disabled = true;
		}
	}
	
	function itemSelected()
	{
		if(itemsView && itemsView.selection.count == 1 && itemsView.selection.currentIndex != -1)
		{
			var item = itemsView._getItemAtRow(itemsView.selection.currentIndex);
			
			if(item.isNote())
			{
				var noteEditor = document.getElementById('scholar-note-editor');
				noteEditor.item = null;
				noteEditor.note = item.ref;
				document.getElementById('scholar-view-note').lastChild.setAttribute('noteID',item.ref.getID());
				document.getElementById('item-pane').selectedIndex = 2;
				document.getElementById('scholar-view-tabs').setAttribute('hidden',true);
			}
			else
			{
				ScholarItemPane.viewItem(item.ref);
				document.getElementById('item-pane').selectedIndex = 1;
				document.getElementById('scholar-view-tabs').setAttribute('hidden',false);
			}
		}
		else
		{
			document.getElementById('item-pane').selectedIndex = 0;
				document.getElementById('scholar-view-tabs').setAttribute('hidden',true);
			
			var label = document.getElementById('scholar-view-selected-label');
		
			if(itemsView && itemsView.selection.count)
				label.value = Scholar.getString('pane.item.selected.multiple').replace('%1', itemsView.selection.count);	
			else
				label.value = Scholar.getString('pane.item.selected.zero');
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
			var collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			
			var newName = prompt(Scholar.getString('pane.collections.rename'),collection.getName());
			if(newName)
				collection.ref.rename(newName);
		}
	}
	
	function search()
	{
		if(itemsView)
		{
			searchVal = document.getElementById('tb-search').value;
			itemsView.searchText(searchVal);
			
			//do something about granularity
			//document.getElementById('scholar-search-options').getElementsByAttribute('checked','true')[0].label
			
			document.getElementById('scholar-search-options').hidden = searchVal == "";
		}
		
	}
	
	function getCollectionsView()
	{
		return collectionsView;
	}
	
	function getItemsView()
	{
		return itemsView;
	}
	
	function getSelectedCollection()
	{
		if(collectionsView.selection.count > 0 && collectionsView.selection.currentIndex != -1)
		{
			collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			if(collection && collection.isCollection())
				return collection.ref;
		}
	}
	
	function getSelectedItem()
	{
		if(itemsView && itemsView.selection.count == 1 && itemsView.selection.currentIndex != -1)
		{
			var item = itemsView._getItemAtRow(itemsView.selection.currentIndex);
			if(item)
				return item.ref;
		}
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
			menu.childNodes[2].setAttribute('label', Scholar.getString('pane.items.menu.remove.multiple'));
		else
			menu.childNodes[2].setAttribute('label', Scholar.getString('pane.items.menu.remove'));	
	}
	
	function newNote()
	{
		var c = getSelectedCollection();
		if(c)
			openNoteWindow(null, c.getID());
		else
			openNoteWindow();
	}
	
	function openNoteWindow(id, parent)
	{
		window.open('chrome://scholar/content/note.xul?v=1'+(id ? '&id='+id : '')+(parent ? '&coll='+parent : ''),'','chrome,resizable,centerscreen');
	}
}

window.addEventListener("load", function(e) { ScholarPane.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ScholarPane.onUnload(e); }, false);