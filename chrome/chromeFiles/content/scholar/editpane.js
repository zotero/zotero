Scholar.EditPane = new function()
{
	var _editpane;
	var _dynamicFields;
	var _dynamicCreators;
	var _itemBeingEdited;
	var _creatorTypes = Scholar.CreatorTypes.getTypes();
	var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
	
	this.init = init;
	this.editItem = editItem;
	this.close = close;
	this.addCreator = addCreator;
	this.removeCreator = removeCreator;
	
	function init()
	{
		_editpane = document.getElementById('editpane');
		_dynamicFields = document.getElementById('editpane-dynamic-fields');
		_dynamicCreators = document.getElementById('editpane-dynamic-creators');
		
		return true;
	}
	
	function editItem(thisItem)
	{
		if(!_editpane.hidden)
		{
			var flags=promptService.BUTTON_TITLE_SAVE * promptService.BUTTON_POS_0 +
					  promptService.BUTTON_TITLE_CANCEL * promptService.BUTTON_POS_1 +
					  promptService.BUTTON_TITLE_DONT_SAVE * promptService.BUTTON_POS_2;
					  
			var response = promptService.confirmEx(window,"",
								  "Do you want to save the changes to '"+_itemBeingEdited.getField("title")+"'?",
								  flags, null, null, null, null, {});
			if(response == 1)
				return;
			else if(response == 0)
				saveItem();

		}
		_editpane.hidden = false;

		removeDynamicRows(_dynamicFields);
		var fieldNames = getFullFieldList(thisItem);
	
		for(var i = 0; i<fieldNames.length; i++)
		{
			if(!thisItem.isPrimaryField(fieldNames[i]) || thisItem.isEditableField(fieldNames[i]))
			{
				var label = document.createElement("label");
				label.setAttribute("value",Scholar.LocalizedStrings.getString("itemFields."+fieldNames[i])+":");
				label.setAttribute("control","dynamic-field-"+i);
				
				//create the textbox
				var valueElement = document.createElement("textbox");
				valueElement.setAttribute("value",thisItem.getField(fieldNames[i]));
				valueElement.setAttribute("id","dynamic-field-"+i);		//just so the label can be assigned to this valueElement
				valueElement.setAttribute("fieldName",fieldNames[i]);	//we will use this later
				
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
	
	function close(save)
	{
		if(save)
			saveItem();
		
		_itemBeingEdited = null;
	
		_editpane.hidden = true;
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
			menuitem.setAttribute("label",Scholar.LocalizedStrings.getString('creatorTypes.'+_creatorTypes[j]['name']));
			menuitem.setAttribute("typeid",_creatorTypes[j]['id']);
			if(_creatorTypes[j]['id'] == typeID)
				menuitem.setAttribute("selected",true);
			typeMenu.appendChild(menuitem);
		}
		type.appendChild(typeMenu);
		
		var remove = document.createElement("toolbarbutton");
		remove.setAttribute("label","x");
		remove.setAttribute("oncommand","Scholar.EditPane.removeCreator(this.parentNode);");
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

window.addEventListener("load", function(e) { Scholar.EditPane.init(e); }, false);
