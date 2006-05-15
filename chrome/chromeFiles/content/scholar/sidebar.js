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
	this._dataObjects = Scholar.Objects.getTreeRows();
	this.rowCount = this._dataObjects.length;
}

Scholar.TreeView.prototype.getCellText = function(row, column)
{
	var obj = this._dataObjects[row];
	
	if(column.id == "title_column")
	{
		return obj.getField("title");
	}
	else if(column.id == "creator_column")
	{
		return obj.getField("firstCreator");
	}
	else
	{
		return obj.getField("source");
	}
}

Scholar.TreeView.prototype.isContainer = function(row)
{
	return this._dataObjects(row).isFolder();
}

Scholar.TreeView.prototype.isContainerOpen = function(row)
{
	return false;
}

Scholar.TreeView.prototype.isContainerEmpty = function(row)
{
}

Scholar.TreeView.prototype.getLevel = function(row)
{
	return this._dataObjects(row).getLevel();
}

Scholar.TreeView.prototype.toggleOpenState = function(row)
{
	if(this.isContainerOpen(row))
	{
		var thisLevel = this._dataObjects[row].getLevel();
		while(this._dataObjects[row + 1].getLevel > thisLevel)
		{
			this._dataObjects.splice(row+1,1);
		}
	}
	else
	{
		var newRows = Scholar.Objects.getTreeRows(this._dataObjects[row].getID()); //Get children of 
		for(i in newRows)
		{
			this._dataObjects.splice(row+i+1,0,newRows[i]);
		}
	}
	
	this.rowCount = this._dataObjects.length;
}

Scholar.TreeView.prototype.selectionChanged = function()
{
	if(this.selection.count == 0)
	{
		document.getElementById('status-text').value = "(No selection)";
		setObjectPaneVisibility(false);
	}
	else if(this.selection.count == 1)
	{
		populateObjectPane(this._dataObjects[this.selection.currentIndex]);
		setObjectPaneVisibility(true);
	}
	else
	{
		document.getElementById('status-text').value = "(Multiple selection)";
		setObjectPaneVisibility(false);
	}

}

Scholar.TreeView.prototype.isSorted = function()
{
	return false;
}

Scholar.TreeView.prototype.getColumnProperties = function(col, prop)
{
	return null;
}

function setObjectPaneVisibility(vis)
{
	document.getElementById('scholar-sidebar-object-pane').hidden = !vis;
	document.getElementById('status-text').hidden = vis;
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

function selectionChanged()
{
	myTreeView.selectionChanged();
}

function setView()
{
	myTreeView = new Scholar.TreeView();
	ScholarLocalizedStrings = document.getElementById('scholar-strings');
    document.getElementById('scholar-sidebar-items').view=myTreeView;
}

Scholar.testString = 'Sidebar is registered.';