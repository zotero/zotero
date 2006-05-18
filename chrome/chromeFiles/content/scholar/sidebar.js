var ScholarLocalizedStrings;
var myTreeView;
var dynamicBox;

Scholar.TreeView = function()
{
	this._treebox = null;
	this._dataObjects = new Array();
	this.rowCount = 0;
}

Scholar.TreeView.prototype.setTree = function(treebox)
{
	if(this._treebox)
		return;
	this._treebox = treebox;
	
	var newRows = Scholar.Items.getTreeRows();
	for(var i = 0; i < newRows.length; i++)
		this._insertItem(newRows[i],  0, i+1); //object ref, isContainerOpen, level
	
	this.rowCount = this._dataObjects.length;
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
Scholar.TreeView.prototype.isContainerOpen = function(row)  { return this._dataObjects[row][1]; }
Scholar.TreeView.prototype.isContainerEmpty = function(row) { return (this.isContainer(row) && this._getItemAtRow(row).isEmpty()); }
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
	var count = 0;		//used to tell the tree how many rows were added/removed
	var thisLevel = this.getLevel(row);

	if(this.isContainerOpen(row))
	{
		while((row + 1 < this._dataObjects.length) && (this.getLevel(row + 1) > thisLevel))
		{
			this._deleteItem(row+1);
			count--;	//count is negative when closing a container because we are removing rows
		}
	}
	else
	{
		var newRows = Scholar.Items.getTreeRows(this._getItemAtRow(row).getID()); //Get children
		
		for(var i = 0; i < newRows.length; i++)
		{
			count++;
			this._insertItem(newRows[i], thisLevel+1, row+i+1); //insert new row
		}
	}
	
	this._dataObjects[row][1] = !this._dataObjects[row][1];  //toggle container open value
	this.rowCount = this._dataObjects.length;
	
	this._treebox.rowCountChanged(row, count); //tell treebox to repaint these
}

Scholar.TreeView.prototype.selectionChanged = function()
{
	if(this.selection.count == 1 && !this.isContainer(this.selection.currentIndex))
	{
		populateObjectPane(this._getItemAtRow(this.selection.currentIndex));
		document.getElementById('object-pane').hidden = false;
		document.getElementById('tb-edit').hidden = false;
	}
	else
	{
		document.getElementById('object-pane').hidden = true;
		document.getElementById('tb-edit').hidden = true;
	}
}


Scholar.TreeView.prototype._insertItem = function(item, level, beforeRow) 	{ this._dataObjects.splice(beforeRow, 0, [item, false, level]); }

Scholar.TreeView.prototype._deleteItem = function(row) 						{ this._dataObjects.splice(row,1);; }


Scholar.TreeView.prototype._getItemAtRow = function(row)					{ return this._dataObjects[row][0]; }
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

/*
DRAG AND DROP (IMPLEMENT LATER)
Scholar.TreeView.prototype.canDrop = function(row, orient)					{ return !orient; }
Scholar.TreeView.prototype.drop = function(row, orient)						{ }
*/

function populateObjectPane(thisItem)
{
	removeDynamicRows();
	
	var fieldNames = getFullFieldList(thisItem);

	for(var i = 0; i<fieldNames.length; i++)
	{
		if(thisItem.getField(fieldNames[i]) != "")
		{
			var label = document.createElement("label");
			label.setAttribute("value",ScholarLocalizedStrings.getString("objectFields."+fieldNames[i])+":");
			
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

function newItem()
{

}

function editSelectedItem()
{
	document.getElementById('view-pane').hidden = true;
	document.getElementById('edit-pane').hidden = false;

	var thisItem = myTreeView._getItemAtRow(myTreeView.selection.currentIndex);
	
	removeDynamicRows();
	var fieldNames = getFullFieldList(thisItem);

	for(var i = 0; i<fieldNames.length; i++)
	{
		if(!thisItem.isPrimaryField(fieldNames[i]) || thisItem.isEditableField(fieldNames[i]))
		{
			var label = document.createElement("label");
			label.setAttribute("value",ScholarLocalizedStrings.getString("objectFields."+fieldNames[i])+":");
			label.setAttribute("control","dynamic-field-"+i);
			
			//create the textbox
			var valueElement = document.createElement("textbox");
			valueElement.setAttribute("value",thisItem.getField(fieldNames[i]));
			valueElement.setAttribute("id","dynamic-field-"+i);		//just so the label can be assigned to this valueElement
			valueElement.setAttribute("fieldName",fieldNames[i]);	//we will use this later
			
			var row = document.createElement("row");
			row.appendChild(label);
			row.appendChild(valueElement);
			dynamicBox.appendChild(row);
		}
	}
	
	var beforeField = dynamicBox.firstChild.nextSibling;

/* DISABLE EDITING OF CREATORS UNTIL WE COME UP WITH A GOOD METHOD	
	for (var i=0,len=thisItem.numCreators(); i<len; i++)
	{
		var creator = thisItem.getCreator(i);
		
		var label = document.createElement("label");
		label.setAttribute("value","Creator:");
		label.setAttribute("control","dynamic-creator-"+i);

		var valueElement = document.createElement("textbox");
		valueElement.setAttribute("value",creator.lastName+", "+creator.firstName);
		valueElement.setAttribute("id","dynamic-field-"+i);
		
		var row = document.createElement("row");
		row.appendChild(label);
		row.appendChild(valueElement);
		
		dynamicBox.insertBefore(row, beforeField);
	}
*/
	
}

function removeDynamicRows()
{
	while(dynamicBox.hasChildNodes())
		dynamicBox.removeChild(dynamicBox.firstChild);
}

function getFullFieldList(item)
{
	var fields = Scholar.ItemFields.getItemTypeFields(item.getField("itemTypeID"));
	var fieldNames = new Array("title","dateAdded","dateModified","source","rights");
	for(var i = 0; i<fields.length; i++)
		fieldNames.push(Scholar.ItemFields.getName(fields[i]));
	return fieldNames;
}

function returnToTree(save)
{
	var thisItem = myTreeView._getItemAtRow(myTreeView.selection.currentIndex);

	if(save)
	{
	
		//get fields, call data access methods
		var valueElements = dynamicBox.getElementsByTagName("textbox");		//All elements of tagname 'textbox' should be the values of edits
		for(var i=0; i<valueElements.length; i++)
			thisItem.setField(valueElements[i].getAttribute("fieldName"),valueElements[i].value,false);
	
		thisItem.save();
	}
	
	document.getElementById('view-pane').hidden = false;
	document.getElementById('edit-pane').hidden = true;

	populateObjectPane(thisItem);
}

function init()
{
	myTreeView = new Scholar.TreeView();
	ScholarLocalizedStrings = document.getElementById('scholar-strings');
	dynamicBox = document.getElementById('dynamic-fields');

    document.getElementById('list-tree').view=myTreeView;
}

Scholar.testString = 'Sidebar is registered.';