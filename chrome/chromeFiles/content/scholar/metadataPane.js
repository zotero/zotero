MetadataPane = new function()
{
	var _dynamicFields;
	var _dynamicCreators;
	var	_editButton;
	var	_cancelButton;
	var	_saveButton;
	var _creatorsToolbar;
	
	var _itemBeingEdited;
	var _creatorTypes = Scholar.CreatorTypes.getTypes();
	
	this.onLoad = onLoad;
	this.viewItem = viewItem;
	this.toggleEdit = toggleEdit;
	this.saveItem = saveItem;
	this.addCreator = addCreator;
	this.removeCreator = removeCreator;
	
	function onLoad()
	{
		_metadataPane = document.getElementById('scholar-metadata');
		_dynamicFields = document.getElementById('editpane-dynamic-fields');
		_dynamicCreators = document.getElementById('editpane-dynamic-creators');
		_editButton = document.getElementById('metadata-pane-edit-button');
		_cancelButton = document.getElementById('metadata-pane-cancel-button');
		_saveButton = document.getElementById('metadata-pane-save-button');
		_creatorsToolbar = document.getElementById('metadata-creators-toolbar');
		
		return true;
	}
	
	/*
	 * Loads an item 
	 */
	function viewItem(thisItem)
	{
		if(_editButton.hidden)
			toggleEdit(confirm("Save changes to '"+_itemBeingEdited.getField('title')+"'?"));
		
		_itemBeingEdited = thisItem;
		
		reloadFields();
	
	}
	
	function reloadFields()
	{
		removeDynamicRows(_dynamicFields);
		removeDynamicRows(_dynamicCreators);
		thisItem = _itemBeingEdited;
		
		var fieldNames = getFullFieldList(thisItem);
		var editingMode = _editButton.hidden;
		
		for(var i = 0; i<fieldNames.length; i++)
		{
			rowValue = thisItem.getField(fieldNames[i]);
			if(!editingMode || !thisItem.isPrimaryField(fieldNames[i]) || thisItem.isEditableField(fieldNames[i]))
			{
				if(editingMode || rowValue)
					addDynamicField(Scholar.getString("itemFields."+fieldNames[i])+":",rowValue,editingMode ? fieldNames[i] : null);
			}
		}
		
		if(thisItem.numCreators() > 0)
		{
			for(var i = 0, len=thisItem.numCreators(); i<len; i++)
			{
				var creator = thisItem.getCreator(i);
				if(editingMode)
				{
					addCreator(creator['firstName'],creator['lastName'],creator['creatorTypeID']);
				}
				else
				{
					addDynamicField(Scholar.getString('creatorTypes.'+Scholar.CreatorTypes.getTypeName(creator['creatorTypeID']))+":",
									creator['firstName']+' '+creator['lastName'],
									false);
				}
			}
		}
		else if(editingMode)
		{
			//display a empty creator box if editing, and if there are no creators
			addCreator();
		}
	}
	
	function toggleEdit(save)
	{
		if(_editButton.hidden && save)
			saveItem();
		
		_cancelButton.hidden = _editButton.hidden;
		_saveButton.hidden = _editButton.hidden;
		_creatorsToolbar.hidden = _editButton.hidden;
		
		_editButton.hidden = !_editButton.hidden;
		
		reloadFields();
	}
	
	function saveItem()
	{
		//get fields, call data access methods
		var valueElements = _dynamicFields.getElementsByTagName("textbox");		//All elements of tagname 'textbox' should be the values of edits
		for(var i=0; i<valueElements.length; i++)
			_itemBeingEdited.setField(valueElements[i].getAttribute("fieldName"),valueElements[i].value);
		
		var numCreatorsBefore = _itemBeingEdited.numCreators();
		
		var creatorRows = _dynamicCreators.childNodes;
		for(var i=0; i < creatorRows.length; i++)
		{
			var firstname = creatorRows[i].firstChild.value;
			var lastname = creatorRows[i].firstChild.nextSibling.value;
			var typeMenu = creatorRows[i].firstChild.nextSibling.nextSibling;
			var typeID = typeMenu.firstChild.childNodes[typeMenu.selectedIndex].getAttribute('typeid');
			
			_itemBeingEdited.setCreator(i, firstname, lastname, typeID);
		}
		
		for(var i = creatorRows.length; i < numCreatorsBefore; i++)
			_itemBeingEdited.setCreator(i, false);
		
		_itemBeingEdited.save();
	}

	function getFullFieldList(item)
	{
		var fieldNames = new Array("title","dateAdded","dateModified");
		var fields = Scholar.ItemFields.getItemTypeFields(item.getField("itemTypeID"));
		for(var i = 0; i<fields.length; i++)
			fieldNames.push(Scholar.ItemFields.getName(fields[i]));
		return fieldNames;
	}
	
	function removeDynamicRows(box)
	{
		while(box.hasChildNodes())
			box.removeChild(box.firstChild);
	}
	
	function addDynamicField(labelText, valueText, editable)
	{
		var label = document.createElement("label");
		label.setAttribute("value",labelText);
		
		var valueElement;
		if(editable)
		{
			valueElement = document.createElement("textbox");
			valueElement.setAttribute("value",valueText);
			valueElement.setAttribute("fieldName",editable);	//used for identifying the field for saving
		}
		else
		{
			valueElement = document.createElement("label");
			valueElement.appendChild(document.createTextNode(valueText));
		}
		
		var row = document.createElement("row");
		row.align="center";
		row.appendChild(label);
		row.appendChild(valueElement);
		_dynamicFields.appendChild(row);		
	}
	
	function addCreator(firstname, lastname, typeID)
	{
		if(!lastname)
			lastname = "";
		if(!firstname)
			firstname = "";
		if(!typeID)
			typeID = 0;
		
		var first = document.createElement("textbox");
		first.setAttribute("value",firstname);
		var last = document.createElement("textbox");
		last.setAttribute("value",lastname);

		var type = document.createElement("menulist");
		type.setAttribute("label","Type");
		var typeMenu = document.createElement("menupopup");
		for(var j = 0; j < _creatorTypes.length; j++)
		{
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label",Scholar.getString('creatorTypes.'+_creatorTypes[j]['name']));
			menuitem.setAttribute("typeid",_creatorTypes[j]['id']);
			if(_creatorTypes[j]['id'] == typeID)
				menuitem.setAttribute("selected",true);
			typeMenu.appendChild(menuitem);
		}
		type.appendChild(typeMenu);
		
		var remove = document.createElement("toolbarbutton");
		remove.setAttribute("label","-");
		remove.setAttribute("class","addremove");
		remove.setAttribute("oncommand","MetadataPane.removeCreator(this.parentNode);");
		
		var add = document.createElement("toolbarbutton");
		add.setAttribute("label","+");
		add.setAttribute("class","addremove");
		add.setAttribute("oncommand","MetadataPane.addCreator();");
		
		var row = document.createElement("row");
		row.appendChild(first);
		row.appendChild(last);
		row.appendChild(type);
		row.appendChild(remove);
		row.appendChild(add);
		_dynamicCreators.appendChild(row);
		
	}
	
	function removeCreator(row)
	{
		_dynamicCreators.removeChild(row);
	}
}

addEventListener("load", function(e) { MetadataPane.onLoad(e); }, false);
