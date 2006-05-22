var myTreeView;
var dynamicBox;
var itemBeingEdited; 			//the item currently being edited

Scholar.TreeView = function()
{
	this._treebox = null;
	this._dataItems = new Array();
	this.rowCount = 0;
}

Scholar.TreeView.prototype.setTree = function(treebox)
{
	if(this._treebox)
		return;
	this._treebox = treebox;
	
	var newRows = Scholar.Items.getTreeRows();
	for(var i = 0; i < newRows.length; i++)
		this._showItem(newRows[i],  0, i+1); //item ref, isContainerOpen, level
}

Scholar.TreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getItemAtRow(row);
	
	if(obj.isFolder())
	{
		if(column.id == "title_column")
			return obj.getName();
		else
			return "";
	}
	else
	{
		if(column.id == "title_column")
			return obj.getField("title");
		else if(column.id == "creator_column")
			return obj.getField("firstCreator");
		else
			return obj.getField("source");
	}
}

Scholar.TreeView.prototype.isContainer = function(row) 		{ return this._getItemAtRow(row).isFolder(); }
Scholar.TreeView.prototype.isContainerOpen = function(row)  { return this._dataItems[row][1]; }
Scholar.TreeView.prototype.isContainerEmpty = function(row) { return (this.isContainer(row) && this._getItemAtRow(row).isEmpty()); }
Scholar.TreeView.prototype.getLevel = function(row) 		{ return this._dataItems[row][2]; }

Scholar.TreeView.prototype.getParentIndex = function(row)
{
	var thisLevel = this.getLevel(row);
	if(thisLevel == 0) return -1;
	for(var i = row - 1; i >= 0; i--)
		if(this.getLevel(i) < thisLevel)
			return i;
	return -1;
}

Scholar.TreeView.prototype.hasNextSibling = function(row, afterIndex)
{
	var thisLevel = this.getLevel(row);
	for(var i = afterIndex + 1; i < this.rowCount; i++)
	{	
		var nextLevel = this.getLevel(i);
		if(nextLevel == thisLevel) return true;
		else if(nextLevel < thisLevel) return false;
	}
}

Scholar.TreeView.prototype.toggleOpenState = function(row)
{
	var count = 0;		//used to tell the tree how many rows were added/removed
	var thisLevel = this.getLevel(row);

	this._treebox.beginUpdateBatch();
	if(this.isContainerOpen(row))
	{
		while((row + 1 < this._dataItems.length) && (this.getLevel(row + 1) > thisLevel))
		{
			this._hideItem(row+1);
			count--;	//count is negative when closing a container because we are removing rows
		}
	}
	else
	{
		var newRows = Scholar.Items.getTreeRows(this._getItemAtRow(row).getID()); //Get children
		
		for(var i = 0; i < newRows.length; i++)
		{
			count++;
			this._showItem(newRows[i], thisLevel+1, row+i+1); //insert new row
		}
	}
	this._dataItems[row][1] = !this._dataItems[row][1];  //toggle container open value

	this._treebox.rowCountChanged(row+1, count); //tell treebox to repaint these
	this._treebox.invalidateRow(row);
	this._treebox.endUpdateBatch();	
}

Scholar.TreeView.prototype.selectionChanged = function()
{
	if(this.selection.count == 1 && this.selection.currentIndex != -1 && !this.isContainer(this.selection.currentIndex))
	{
		viewSelectedItem();
		document.getElementById('tb-edit').hidden = false;
	}
	else
	{
		removeDynamicRows(dynamicBox);
		document.getElementById('tb-edit').hidden = true;
	}
}


Scholar.TreeView.prototype._showItem = function(item, level, beforeRow) 	{ this._dataItems.splice(beforeRow, 0, [item, false, level]); this.rowCount++; }

Scholar.TreeView.prototype._hideItem = function(row) 						{ this._dataItems.splice(row,1); this.rowCount--; }

Scholar.TreeView.prototype._getItemAtRow = function(row)					{ return this._dataItems[row][0]; }
Scholar.TreeView.prototype.isSorted = function() 							{ return false; }
Scholar.TreeView.prototype.isSeparator = function(row) 						{ return false; }
Scholar.TreeView.prototype.isEditable = function(row, idx) 					{ return false; }
Scholar.TreeView.prototype.getRowProperties = function(row, prop) 			{ }
Scholar.TreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Scholar.TreeView.prototype.getCellProperties = function(row, col, prop) 	{ }
Scholar.TreeView.prototype.getImageSrc = function(row, col) 				{ }
Scholar.TreeView.prototype.performAction = function(action) 				{ }
Scholar.TreeView.prototype.performActionOnCell = function(action, row, col)	{ }
Scholar.TreeView.prototype.getProgressMode = function(row, col) 			{ }

Scholar.TreeView.prototype.deleteSelection = function()
{
	if(this.selection.count == 0)
	{
		return;
	}
	if(!confirm("Are you sure you want to delete the selected item"+(this.selection.count > 1 ? "s" : "")+"?"))
	{
		return;
	}

	//collapse open folders
	for(var i=0; i<this.rowCount; i++)
	{
		if(this.selection.isSelected(i) && this.isContainer(i) && this.isContainerOpen(i))
			this.toggleOpenState(i);
	}
	
	//create an array of selected items/folders
	var rows = new Array();
	var start = new Object();
	var end = new Object();
	for (var i=0, len=this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++)
			rows.push(j);
	}
	
	//iterate and erase...
	this._treebox.beginUpdateBatch();
	for (var i=0; i<rows.length; i++)
	{
		this._getItemAtRow(rows[i]-i).erase();		//erases item/folder from DB
		
		//remove row from tree
		this._hideItem(rows[i]-i);
		this._treebox.rowCountChanged(rows[i]-i, -1);
	}
	this._treebox.endUpdateBatch();

}
/*
DRAG AND DROP (IMPLEMENT LATER)
Scholar.DragObserver.canDrop = function(row, orient)					{ return !orient; }
Scholar.DragObserver.drop = function(row, orient)						{ }
*/

function viewSelectedItem()
{
	removeDynamicRows(dynamicBox);

	var thisItem = myTreeView._getItemAtRow(myTreeView.selection.currentIndex);

	var fieldNames = getFullFieldList(thisItem);

	for(var i = 0; i<fieldNames.length; i++)
	{
		if(thisItem.getField(fieldNames[i]) != "")
		{
			var label = document.createElement("label");
			label.setAttribute("value",Scholar.LocalizedStrings.getString("itemFields."+fieldNames[i])+":");
			
			var valueElement = document.createElement("description");
			valueElement.appendChild(document.createTextNode(thisItem.getField(fieldNames[i])));
			
			var row = document.createElement("row");
			row.appendChild(label);
			row.appendChild(valueElement);
			row.setAttribute("id","dynamic-"+fieldNames[i]);
			
			dynamicBox.appendChild(row);
		}
	}
	
	var beforeField = dynamicBox.firstChild.nextSibling;
	
	for (var i=0,len=thisItem.numCreators(); i<len; i++)
	{
		var creator = thisItem.getCreator(i);
		
		var label = document.createElement("label");
		label.setAttribute("value","Creator:");
		
		var valueElement = document.createElement("description");
		valueElement.appendChild(document.createTextNode(creator.lastName+", "+creator.firstName));
		
		var row = document.createElement("row");
		row.appendChild(label);
		row.appendChild(valueElement);

		dynamicBox.insertBefore(row, beforeField);
	}

}

function newItem(typeID)
{
	Scholar.EditPane.editItem(Scholar.Items.getNewItemByType(typeID));
}

function editSelectedItem()
{
	Scholar.EditPane.editItem(myTreeView._getItemAtRow(myTreeView.selection.currentIndex));
//	editItem(myTreeView._getItemAtRow(myTreeView.selection.currentIndex));
}

function removeDynamicRows(box)
{
	while(box.hasChildNodes())
		box.removeChild(box.firstChild);
}

function getFullFieldList(item)
{
	var fields = Scholar.ItemFields.getItemTypeFields(item.getField("itemTypeID"));
	var fieldNames = new Array("title","dateAdded","dateModified","source","rights");
	for(var i = 0; i<fields.length; i++)
		fieldNames.push(Scholar.ItemFields.getName(fields[i]));
	return fieldNames;
}

function init()
{
	myTreeView = new Scholar.TreeView();
	
	dynamicBox = document.getElementById('dynamic-fields');
	
	var addMenu = document.getElementById('tb-add').firstChild;
	var itemTypes = Scholar.ItemTypes.getTypes();
	for(var i = 0; i<itemTypes.length; i++)
	{
		var menuitem = document.createElement("menuitem");
		menuitem.setAttribute("label",Scholar.LocalizedStrings.getString("itemTypes."+itemTypes[i]['name']));
		menuitem.setAttribute("oncommand","newItem("+itemTypes[i]['id']+")");
		addMenu.appendChild(menuitem);
	}

    document.getElementById('list-tree').view=myTreeView;
}

Scholar.testString = 'Sidebar is registered.';