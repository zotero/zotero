var foldersView;
var itemsView;

function init()
{
	foldersView = new Scholar.TreeView(0); //pass params here?
	document.getElementById('folders-tree').view = foldersView;
	itemsView = new Scholar.TreeView(0);
	document.getElementById('items-tree').view = itemsView;

	var addMenu = document.getElementById('tb-add').firstChild;
	var itemTypes = Scholar.ItemTypes.getTypes();
	for(var i = 0; i<itemTypes.length; i++)
	{
		var menuitem = document.createElement("menuitem");
		menuitem.setAttribute("label",Scholar.LocalizedStrings.getString("itemTypes."+itemTypes[i]['name']));
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
		itemsView = new Scholar.TreeView(foldersView._getItemAtRow(foldersView.selection.currentIndex).getID());
		document.getElementById('items-tree').view = itemsView;
	}
	else if(foldersView.selection.count == 0)
	{
		itemsView = new Scholar.TreeView(0);
		document.getElementById('items-tree').view = itemsView;
	}
	else
	{
		document.getElementById('items-tree').view = null;
	}
	
}

function itemSelected()
{
	document.getElementById('view-pane').setAttribute('src','http://www.apple.com/');
}

function deleteSelection()
{
	if(itemsView && itemsView.selection.count > 0 && confirm("Are you sure you want to delete the selection????"))
	{
		itemsView.deleteSelection();
	}
}