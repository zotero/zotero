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
	this.toggleView = toggleView;
	
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
		
//		Drag.init(document.getElementById('scholar-floater-handle'),document.getElementById('scholar-floater'), 0, 400, 0, 500, true, true);
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
			
			MetadataPane.viewItem(item);
			var url = item.getField('source');
			if(!validURL(url))
				url = 'http://www.google.com/search?q='+encodeURIComponent('"'+item.getField("title")+'"'); //+'&btnI'
			
			document.getElementById('content').loadURI(url);
			document.getElementById('scholar-floater').hidden=false;
		}
		else
		{
			document.getElementById('scholar-floater').hidden=true;
			
		}

	}
	
	function deleteSelection()
	{
		if(itemsView && itemsView.selection.count > 0 && confirm("Are you sure you want to delete the selected items?"))
			itemsView.deleteSelection();
	}
	
	function search()
	{
		if(itemsView)
			itemsView.searchText(document.getElementById('tb-search').value);
	}

	function toggleView(id)
	{		
		var button = document.getElementById('tb-'+id);
		var elem = document.getElementById('scholar-'+id);
		
		button.checked = !button.checked;
		elem.hidden = !elem.hidden;
	}
	
	//Thanks: http://www.bigbold.com/snippets/posts/show/452
	//TODO: move this out of overlay.js, into Scholar.js?
	function validURL(s)
	{
		var regexp = /(http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
		return regexp.test(s);
	}
}

window.addEventListener("load", function(e) { ScholarPane.init(e); }, false);