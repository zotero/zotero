MetadataPane = new function()
{
	var _dynamicFields;
	var _dynamicCreators;
	var _itemBeingEdited;
	var _creatorTypes = Scholar.CreatorTypes.getTypes();
	var	_editButton;
	
	this.init = init;
	this.viewItem = viewItem;
	this.toggleEdit = toggleEdit;
	this.saveItem = saveItem;
	this.addCreator = addCreator;
	this.removeCreator = removeCreator;
	
	function init()
	{
		_metadataPane = document.getElementById('metadata-pane');
		_dynamicFields = document.getElementById('editpane-dynamic-fields');
		_dynamicCreators = document.getElementById('editpane-dynamic-creators');
		_editButton = document.getElementById('metadata-pane-edit-button');
		
		return true;
	}
	
	function viewItem(thisItem)
	{		
		removeDynamicRows(_dynamicFields);
		var fieldNames = getFullFieldList(thisItem);
	
		for(var i = 0; i<fieldNames.length; i++)
		{
			if(!thisItem.isPrimaryField(fieldNames[i]) || thisItem.isEditableField(fieldNames[i]))
			{
				var label = document.createElement("label");
				label.setAttribute("value",Scholar.getString("itemFields."+fieldNames[i])+":");
				label.setAttribute("control","dynamic-field-"+i);
				
				//create the textbox
				var valueElement = document.createElement("textbox");
				valueElement.setAttribute("value",thisItem.getField(fieldNames[i]));
				valueElement.setAttribute("id","dynamic-field-"+i);		//just so the label can be assigned to this valueElement
				valueElement.setAttribute("fieldName",fieldNames[i]);	//we will use this later
				valueElement.setAttribute("disabled",true);
				
				var row = document.createElement("row");
				row.appendChild(label);
				row.appendChild(valueElement);
				_dynamicFields.appendChild(row);
			}
		}
		
		removeDynamicRows(_dynamicCreators);
				
		for(var i = 0, len=thisItem.numCreators(); i<len; i++)
			addCreator(thisItem.getCreator(i)['firstName'],thisItem.getCreator(i)['lastName'],thisItem.getCreator(i)['creatorTypeID']);
	
		_itemBeingEdited = thisItem;
	}
	
	function toggleEdit()
	{
		if(_editButton.checked)
			saveItem();
		
		_editButton.checked = !_editButton.checked;
		var disabledElements = [];
	
		for(var i = 0, row; row = _dynamicFields.childNodes[i]; i++)
		{
			disabledElements.push(row.lastChild);
		}
	
		for(var i = 0, row; row = _dynamicCreators.childNodes[i]; i++)
		{
			for(var j = 0, col; col = row.childNodes[j]; j++)
			{
				disabledElements.push(col);
			}
		}
		
		disabledElements.push(document.getElementById('tb-creator-add'));
		
		for(var i = 0, elem; elem = disabledElements[i]; i++)
		{
			if(_editButton.checked)
				elem.removeAttribute("disabled");
			else
				elem.setAttribute("disabled",true);
		}
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
		
		if(!_itemBeingEdited.getID())  //NEW ITEM
		{
			/* get ref to myTreeView?
			myTreeView._showItem(_itemBeingEdited, 0, myTreeView.rowCount);
			myTreeView._treebox.rowCountChanged(myTreeView.rowCount-1,1);
			*/
		}
		
		_itemBeingEdited.save();
	}

	function getFullFieldList(item)
	{
		var fields = Scholar.ItemFields.getItemTypeFields(item.getField("itemTypeID"));
		var fieldNames = new Array("title","dateAdded","dateModified","source","rights");
		for(var i = 0; i<fields.length; i++)
			fieldNames.push(Scholar.ItemFields.getName(fields[i]));
		return fieldNames;
	}
	
	function removeDynamicRows(box)
	{
		while(box.hasChildNodes())
			box.removeChild(box.firstChild);
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
		remove.setAttribute("label","x");
		remove.setAttribute("oncommand","MetadataPane.removeCreator(this.parentNode);");
		
		if(!_editButton.checked)
		{
			first.setAttribute("disabled",true);
			last.setAttribute("disabled",true);
			type.setAttribute("disabled",true);
			remove.setAttribute("disabled",true);
		}
		
		var row = document.createElement("row");
		row.appendChild(first);
		row.appendChild(last);
		row.appendChild(type);
		row.appendChild(remove);
		_dynamicCreators.appendChild(row);
		
	}
	
	function removeCreator(row)
	{
		_dynamicCreators.removeChild(row);
	}
}

document.addEventListener("load", function(e) { MetadataPane.init(e); }, false);
