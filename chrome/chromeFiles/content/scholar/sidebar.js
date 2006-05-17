var ScholarLocalizedStrings;
var myTreeView;

Scholar.TreeView = function()
{
	this._treebox = null;
	this._dataObjects = new Array();
	this.rowCount = 0;
}

Scholar.TreeView.prototype.setTree = function(treebox)
{
	this._treebox = treebox;
	
	var newRows = Scholar.Objects.getTreeRows();
	for(var i = 0; i < newRows.length; i++)
		this._dataObjects.push( [ newRows[i], false, 0 ] ); //object ref, isContainerOpen, level
	
	this.rowCount = this._dataObjects.length;
}

Scholar.TreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getObjectAtRow(row);
	
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

Scholar.TreeView.prototype.isContainer = function(row) 		{ return this._getObjectAtRow(row).isFolder(); }
Scholar.TreeView.prototype.isContainerOpen = function(row)  { return this._dataObjects[row][1]; }
Scholar.TreeView.prototype.isContainerEmpty = function(row) { return (this.isContainer(row) && this._getObjectAtRow(row).isEmpty()); }
Scholar.TreeView.prototype.getLevel = function(row) 		{ return this._dataObjects[row][2]; }

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
	var count = 0;
	var thisLevel = this.getLevel(row);

	if(this.isContainerOpen(row))
	{
		while((row + 1 < this._dataObjects.length) && (this.getLevel(row + 1) > thisLevel))
		{
			this._dataObjects.splice(row+1,1);
			count--;
		}
	}
	else
	{
		var newRows = Scholar.Objects.getTreeRows(this._getObjectAtRow(row).getID()); //Get children
		
		for(var i = 0; i < newRows.length; i++)
		{
			count++;
			this._dataObjects.splice(row+i+1,0,[ newRows[i], false, thisLevel+1 ]); //insert new row
		}
	}
	
	this._dataObjects[row][1] = !this._dataObjects[row][1];
	this.rowCount = this._dataObjects.length;
	
	this._treebox.rowCountChanged(row, count); //tell treebox to repaint these
}

Scholar.TreeView.prototype.selectionChanged = function()
{
	if(this.selection.count == 1 && !this.isContainer(this.selection.currentIndex))
	{
		populateObjectPane(this._getObjectAtRow(this.selection.currentIndex));
		setObjectPaneVisibility(true);
	}
	else
	{
		setObjectPaneVisibility(false);
	}
}

/*
Scholar.TreeView.prototype._insertRow = function(item, beforeRow)
{
	return false;
}

Scholar.TreeView.prototype._deleteRow = function(row)
{
	return false;
}
*/

Scholar.TreeView.prototype._getObjectAtRow = function(row)					{ return this._dataObjects[row][0]; }

/*
DRAG AND DROP (IMPLEMENT LATER)
Scholar.TreeView.prototype.canDrop = function(row, orient)					{ return !orient; }
Scholar.TreeView.prototype.drop = function(row, orient)						{ }
*/

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

function setObjectPaneVisibility(vis)
{
	document.getElementById('scholar-sidebar-object-pane').hidden = !vis;
}

function populateObjectPane(objectRow)
{
	var dynamicBox = document.getElementById('scholar-sidebar-object-pane-dynamic-fields');
	while(dynamicBox.hasChildNodes())
		dynamicBox.removeChild(dynamicBox.firstChild);
	
	var fields = Scholar.ObjectFields.getObjectTypeFields(objectRow.getField("objectTypeID"));
	var fieldNames = new Array("title","dateAdded","dateModified","source","rights");
	for(var i = 0; i<fields.length; i++)
		fieldNames.push(Scholar.ObjectFields.getName(fields[i]));

	for(var i = 0; i<fieldNames.length; i++)
	{
		if(objectRow.getField(fieldNames[i]) != "")
		{
			var label = document.createElement("label");
			label.setAttribute("value",ScholarLocalizedStrings.getString("objectFields."+fieldNames[i])+":");
			
			var valueElement = document.createElement("description");
			valueElement.appendChild(document.createTextNode(objectRow.getField(fieldNames[i])));
			
			var row = document.createElement("row");
			row.appendChild(label);
			row.appendChild(valueElement);
			row.setAttribute("id","dynamic-"+fieldNames[i]);
			
			dynamicBox.appendChild(row);
		}
	}
	
	var beforeField = document.getElementById('dynamic-title');
	beforeField = beforeField.nextSibling;
	
	for (var i=0,len=objectRow.numCreators(); i<len; i++)
	{
		var creator = objectRow.getCreator(i);
		
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

function editSelectedRow()
{
	var thisRow = myTreeView._getObjectAtRow(myTreeView.selection.currentIndex);
	window.openDialog('chrome://scholar/content/editDialog.xul','editDialog','modal,dialog,chrome',thisRow);
	
}



function setView()
{
	myTreeView = new Scholar.TreeView();
	ScholarLocalizedStrings = document.getElementById('scholar-strings');
    document.getElementById('scholar-sidebar-items').view=myTreeView;
}

Scholar.testString = 'Sidebar is registered.';