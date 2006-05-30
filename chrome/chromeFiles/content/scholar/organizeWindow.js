var foldersView;
var itemsView;
var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

function init()
{
	foldersView = new Scholar.TreeView(0); //pass params here?
	document.getElementById('folders-tree').view = foldersView;
	itemsView = new Scholar.ItemTreeView(0);
	document.getElementById('items-tree').view = itemsView;

	var addMenu = document.getElementById('tb-add').firstChild;
	var itemTypes = Scholar.ItemTypes.getTypes();
	for(var i = 0; i<itemTypes.length; i++)
	{
		var menuitem = document.createElement("menuitem");
		menuitem.setAttribute("label", Scholar.getString("itemTypes."+itemTypes[i]['name']));
		menuitem.setAttribute("oncommand","newItem("+itemTypes[i]['id']+")");
		addMenu.appendChild(menuitem);
	}
}

function newItem(typeID)
{
	alert("new item of type: "+typeID);
}

function newFolder()
{
	alert("new folder");
}

function folderSelected()
{
	if(foldersView.selection.count == 1 && foldersView.selection.currentIndex != -1)
	{
		itemsView = new Scholar.ItemTreeView(foldersView._getItemAtRow(foldersView.selection.currentIndex).getID());
		document.getElementById('items-tree').view = itemsView;
	}
	else if(foldersView.selection.count == 0)
	{
		itemsView = new Scholar.ItemTreeView(0);
		document.getElementById('items-tree').view = itemsView;
	}
	else
	{
		document.getElementById('items-tree').view = null;
	}
	
}

function itemSelected()
{
	var tabs = document.getElementById('item-tabs');
	var editButton = document.getElementById('metadata-pane-edit-button');
	
	if(editButton.checked)
	{
		var flags=promptService.BUTTON_TITLE_SAVE * promptService.BUTTON_POS_0 +
				  promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1 +
				  promptService.BUTTON_TITLE_DONT_SAVE * promptService.BUTTON_POS_2;
				  
		var response = promptService.confirmEx(window,"",
							  "Do you want to save the changes?", // to '"+_itemBeingEdited.getField("title")+"'
							  flags, null, null, null, null, {});
		if(response == 1)
			return;
		else if(response == 0)
			MetadataPane.toggleEdit();
		else
			editButton.checked = false;
	}
	
	if(itemsView && itemsView.selection.count == 1)
	{
		var item = itemsView._getItemAtRow(itemsView.selection.currentIndex);
		tabs.hidden=false;
		
		if(tabs.firstChild.selectedIndex == 0)
		{
			document.getElementById('view-pane').setAttribute('src','http://www.google.com/search?q='+encodeURIComponent('"'+item.getField("title")+'"')+'&btnI');
		}
		else if(tabs.firstChild.selectedIndex == 1)
		{
			MetadataPane.viewItem(item);
		}
		else
		{
			//do notes
		}
	}
	else
	{
		tabs.hidden=true;
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