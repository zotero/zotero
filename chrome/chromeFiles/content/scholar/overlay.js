var ScholarPane = new function()
{
	
	var foldersView;
	var itemsView;
	var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
	
	this.init = init;
	this.toggleScholar = toggleScholar;
	this.newItem = newItem;
	this.newCollection = newCollection;
	this.folderSelected = folderSelected;
	this.itemSelected = itemSelected;
	this.deleteSelection = deleteSelection;
	this.search = search;
	
	function init()
	{
		foldersView = new Scholar.FolderTreeView(); //pass params here?
		document.getElementById('folders-tree').view = foldersView;
		foldersView.selection.select(0);
	
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
	
	function toggleScholar()
	{
		var visible = document.getElementById('scholar-pane').getAttribute('collapsed') == 'true';
		
		document.getElementById('scholar-pane').setAttribute('collapsed',!visible);
		document.getElementById('scholar-splitter').setAttribute('collapsed',!visible);
	}
	
	function newItem(typeID)
	{
		document.getElementById('content').loadURI('chrome://scholar/content/view.xul?new='+typeID);
	}
	
	function newCollection()
	{
		alert("new collection");
	}
	
	function folderSelected()
	{
		if(foldersView.selection.count == 1 && foldersView.selection.currentIndex != -1)
		{
			itemsView = new Scholar.ItemTreeView(foldersView._getItemAtRow(foldersView.selection.currentIndex));
			document.getElementById('items-tree').view = itemsView;
		}
		else if(foldersView.selection.count == 0)
		{
			document.getElementById('items-tree').view = null;
		}
		else
		{
			document.getElementById('items-tree').view = null;
		}
		
	}
	
	function itemSelected()
	{
		var editButton = document.getElementById('metadata-pane-edit-button');
				
		if(itemsView && itemsView.selection.count == 1)
		{
			var item = itemsView._getItemAtRow(itemsView.selection.currentIndex);
			
			document.getElementById('content').loadURI('chrome://scholar/content/view.xul?id='+encodeURIComponent(item.getID()));
		}
		else
		{
			
		}

	}
	
	function deleteSelection()
	{
		if(itemsView && itemsView.selection.count > 0 && confirm("Are you sure you want to delete the selected items?"))
			itemsView.deleteSelection();
	}
	
	function search()
	{
		//TO DO: reload items tree with a search instead of a root folder
		alert(document.getElementById('tb-search').value);
	}
}

window.addEventListener("load", function(e) { ScholarPane.init(e); }, false);