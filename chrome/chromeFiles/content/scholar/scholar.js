var foldersView;
var itemsView;

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
	if(itemsView.selection.count == 1)
	{
		var item = itemsView._getItemAtRow(itemsView.selection.currentIndex);
		document.getElementById('view-pane').setAttribute('src','http://www.google.com/search?q='+encodeURIComponent('"'+item.getField("title")+'"')+'&btnI');
	}
}

function deleteSelection()
{
	if(itemsView && itemsView.selection.count > 0 && confirm("Are you sure you want to delete the selection????"))
	{
		itemsView.deleteSelection();
	}
}

function search()
{
	//TO DO: reload items tree with a search instead of a root folder
	alert(document.getElementById('tb-search').value);
}