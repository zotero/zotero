MetadataPane = new function()
{
	var _dynamicFields;
	
	var _itemBeingEdited;
	var _creatorTypes = Scholar.CreatorTypes.getTypes();
	
	this.onLoad = onLoad;
	this.viewItem = viewItem;
/*	this.saveItem = saveItem;
	this.addCreator = addCreator;
	this.removeCreator = removeCreator; */
	this.showEditor = showEditor;
	this.hideEditor = hideEditor;
	
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
		_itemBeingEdited = thisItem;
		
		reloadFields();
	}
	
	function reloadFields()
	{
		removeDynamicRows(_dynamicFields);
		thisItem = _itemBeingEdited;
		
		var fieldNames = getFullFieldList(thisItem);
		
		for(var i = 0; i<fieldNames.length; i++)
		{
			var editable = (!thisItem.isPrimaryField(fieldNames[i]) || thisItem.isEditableField(fieldNames[i]));
			
			var label = document.createElement("label");
			label.setAttribute("value",Scholar.getString("itemFields."+fieldNames[i])+":");
			
			addDynamicRow(label,createValueElement(thisItem.getField(fieldNames[i]), editable ? fieldNames[i] : null));
		}
		
		if(thisItem.numCreators() > 0)
		{
			for(var i = 0, len=thisItem.numCreators(); i<len; i++)
			{
				var creator = thisItem.getCreator(i);
				
				var label = document.createElement("label");
				label.setAttribute("value",Scholar.getString('creatorTypes.'+Scholar.CreatorTypes.getTypeName(creator['creatorTypeID']))+":");
				
				addDynamicRow(label, createValueElement(creator['firstName']+' '+creator['lastName'], null), _dynamicFields.firstChild.nextSibling);
			}
		}
	}
	/*
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
	*/
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
	
	function addDynamicRow(label, value, beforeElement)
	{		
		var row = document.createElement("row");
		row.appendChild(label);
		row.appendChild(value);
		if(beforeElement)
			_dynamicFields.insertBefore(row, beforeElement);
		else	
			_dynamicFields.appendChild(row);		
	}
	
	function createValueElement(valueText, fieldName)
	{
	 	var valueElement = document.createElement("label");
		valueElement.appendChild(document.createTextNode(valueText));
		if(fieldName)
		{
			valueElement.setAttribute('fieldname',fieldName);
			valueElement.setAttribute('onclick', 'MetadataPane.showEditor(this);');
		}
		return valueElement;
	}
	/*
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
	}*/
	
	
	function showEditor(elem)
	{
		var t = document.createElement("textbox");
		t.setAttribute('value',_itemBeingEdited.getField(elem.getAttribute('fieldname')));
		t.setAttribute('fieldname',elem.getAttribute('fieldname'));
		
		var box = elem.parentNode;
		box.removeChild(elem);
		box.appendChild(t);
		t.select();
		t.setAttribute('onblur',"MetadataPane.hideEditor(this);");
		t.setAttribute('onkeypress','if(event.keyCode == event.DOM_VK_RETURN) document.commandDispatcher.focusedElement.blur()'); //for some reason I can't just say this.blur();
	}
	
	function hideEditor(t)
	{
		var textbox = t.parentNode.parentNode;
		var fieldName = textbox.getAttribute('fieldname');
		var value = t.value;
		Scholar.debug(value);
		
		_itemBeingEdited.setField(fieldName,value);
		_itemBeingEdited.save();
		
		var elem = createValueElement(value,fieldName);
		
		var box = textbox.parentNode;
		box.removeChild(textbox);
		box.appendChild(elem);
		
	}
}

addEventListener("load", function(e) { MetadataPane.onLoad(e); }, false);
