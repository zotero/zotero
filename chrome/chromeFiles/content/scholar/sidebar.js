var ScholarLocalizedStrings;

var treeView = {
	treebox: null,
	dataObjects: null,
	
    get rowCount() { return this.dataObjects.length; },
    getCellText: function(row,column){
      	obj = this.dataObjects[row];
      	
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
    },
    setTree: function(treebox){ 
    	this.treebox = treebox;
    	this.dataObjects = Scholar.Objects.getAll();
    },
    isContainer: function(row){ return false; },
    isSeparator: function(row){ return false; },
    isSorted: function(){ return false; },
    getLevel: function(row){ return 0; },
    getImageSrc: function(row,col){ return null; },
    getRowProperties: function(row,props){},
    getCellProperties: function(row,col,props){},
    getColumnProperties: function(colid,col,props){},
    selectionChanged: function(){
		if(this.selection.count == 0)
		{
			document.getElementById('status-text').value = "(No selection)";
			setObjectPaneVisibility(false);
		}
		else if(this.selection.count == 1)
		{
			populateObjectPane(this.dataObjects[this.selection.currentIndex]);
			setObjectPaneVisibility(true);
		}
		else
		{
			document.getElementById('status-text').value = "(Multiple selection)";
			setObjectPaneVisibility(false);
		}
	}
};

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
			row.appendChild(label)
			row.appendChild(valueElement)
			
			dynamicBox.appendChild(row);
		}
	}
	
}

function selectionChanged()
{
	treeView.selectionChanged();
}

function setView()
{
	ScholarLocalizedStrings = document.getElementById('scholar-strings');
    document.getElementById('scholar-sidebar-items').view=treeView;
}

Scholar.testString = 'Sidebar is registered.';