/*
	Scholar
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
	
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

ScholarItemPane = new function()
{
	var _dynamicFields;
	var _creatorTypeMenu;
	var _beforeRow;
	var _notesList;
	var _linksBox;
	var _notesLabel;
	
	var _creatorCount;
	
	var _loaded;
	
	var _itemBeingEdited;
	
	var _lastTabIndex;
	var _tabDirection;
	var _tabIndexMinCreators = 10;
	var _tabIndexMaxCreators = 0;
	var _tabIndexMinFields = 1000;
	var _tabIndexMaxFields = 0;
	
	this.onLoad = onLoad;
	this.viewItem = viewItem;
	this.loadPane = loadPane;
	this.changeTypeTo = changeTypeTo;
	this.onOpenURLClick = onOpenURLClick;
	this.addCreatorRow = addCreatorRow;
	this.disableButton = disableButton;
	this.removeCreator = removeCreator;
	this.showEditor = showEditor;
	this.handleKeyPress = handleKeyPress;
	this.hideEditor = hideEditor;
	this.modifyField = modifyField;
	this.getCreatorFields = getCreatorFields;
	this.modifyCreator = modifyCreator;
	this.removeNote = removeNote;
	this.addNote = addNote;
	this.removeAttachment = removeAttachment;
	this.addAttachmentFromDialog = addAttachmentFromDialog;
	this.addAttachmentFromPage = addAttachmentFromPage;
	
	
	function onLoad()
	{
		_tabs = document.getElementById('scholar-view-tabs');
		_dynamicFields = document.getElementById('editpane-dynamic-fields');
		_itemTypeMenu = document.getElementById('editpane-type-menu');
		_creatorTypeMenu = document.getElementById('creatorTypeMenu');
		_notesList = document.getElementById('editpane-dynamic-notes');
		_notesLabel = document.getElementById('editpane-notes-label');
		_attachmentsList = document.getElementById('editpane-dynamic-attachments');
		_attachmentsLabel = document.getElementById('editpane-attachments-label');
		_tagsBox = document.getElementById('editpane-tags');
		_relatedBox = document.getElementById('editpane-related');
		
		var creatorTypes = Scholar.CreatorTypes.getTypes();
		for(var i = 0; i < creatorTypes.length; i++)
		{
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label",Scholar.getString('creatorTypes.'+creatorTypes[i]['name']));
			menuitem.setAttribute("typeid",creatorTypes[i]['id']);
			if(creatorTypes[i]['id'] == 0)
				menuitem.setAttribute("selected",true);
			_creatorTypeMenu.appendChild(menuitem);
		}
		
		var itemTypes = Scholar.ItemTypes.getTypes();
		for(var i = 0; i<itemTypes.length; i++)
			if(itemTypes[i]['name'] != 'note' && itemTypes[i]['name'] != 'attachment')
				_itemTypeMenu.appendItem(Scholar.getString("itemTypes."+itemTypes[i]['name']),itemTypes[i]['id']);
		
		return true;
	}
	
	/*
	 * Loads an item 
	 */
	function viewItem(thisItem)
	{
		_itemBeingEdited = thisItem;
		
		_loaded = {};
		
		loadPane(_tabs.selectedIndex);
	}
	
	
	function loadPane(index)
	{
		//Scholar.debug('Loading item pane ' + index);
		
		if(_loaded[index])
		{
			return;
		}
		_loaded[index] = true;
		
		// Info pane
		if(index == 0)
		{
			while(_dynamicFields.hasChildNodes())
				_dynamicFields.removeChild(_dynamicFields.firstChild);
		
			for(var i = 0, len = _itemTypeMenu.firstChild.childNodes.length; i < len; i++)
				if(_itemTypeMenu.firstChild.childNodes[i].value == _itemBeingEdited.getType())
					_itemTypeMenu.selectedIndex = i;
		
			var fieldNames = new Array("title");
			var fields = Scholar.ItemFields.getItemTypeFields(_itemBeingEdited.getField("itemTypeID"));
			for(var i = 0; i<fields.length; i++)
				fieldNames.push(Scholar.ItemFields.getName(fields[i]));
			fieldNames.push("dateAdded","dateModified");
			
			for(var i = 0; i<fieldNames.length; i++)
			{
				var editable = (!_itemBeingEdited.isPrimaryField(fieldNames[i]) || _itemBeingEdited.isEditableField(fieldNames[i]));
				
				var val = _itemBeingEdited.getField(fieldNames[i]);
				
				// Convert dates from UTC
				if (fieldNames[i]=='dateAdded' || fieldNames[i]=='dateModified'){
					val = Scholar.Date.sqlToDate(val, true).toLocaleString();
				}
				
				// Start tabindex at 1000 after creators
				var tabindex = editable ? (i>0 ? _tabIndexMinFields + i : 1) : 0;
				
				var valueElement = createValueElement(
					val, editable ? fieldNames[i] : null, tabindex
				);
				
				_tabIndexMaxFields = Math.max(_tabIndexMaxFields, tabindex);
				
				var label = document.createElement("label");
				label.setAttribute("value",Scholar.getString("itemFields."+fieldNames[i])+":");
				label.setAttribute("onclick","this.nextSibling.blur();");
			
				addDynamicRow(label,valueElement);
			}
		
			//CREATORS:
			_beforeRow = _dynamicFields.firstChild.nextSibling;
			_creatorCount = 0;
			if(_itemBeingEdited.numCreators() > 0)
			{
				for(var i = 0, len=_itemBeingEdited.numCreators(); i<len; i++)
				{
					var creator = _itemBeingEdited.getCreator(i);
					addCreatorRow(creator['firstName'], creator['lastName'], creator['creatorTypeID']);
				}
			}
			else
			{
				// Add default row
				addCreatorRow('', '', 1, true, true);
			}
			
			// Move to next or previous field if (shift-)tab was pressed
			if (_tabDirection)
			{
				_focusNextField(_lastTabIndex, _tabDirection==-1);
			}
		}
		
		// Notes pane
		else if(index == 1)
		{
			while(_notesList.hasChildNodes())
				_notesList.removeChild(_notesList.firstChild);
				
			var notes = Scholar.Items.get(_itemBeingEdited.getNotes());
			if(notes.length)
			{
				for(var i = 0; i < notes.length; i++)
				{
					var icon = document.createElement('image');
					icon.setAttribute('src','chrome://scholar/skin/treeitem-note.png');
				
					var label = document.createElement('label');
					label.setAttribute('value',_noteToTitle(notes[i].getNote()));
					label.setAttribute('flex','1');	//so that the long names will flex smaller
					label.setAttribute('crop','end');
				
					var box = document.createElement('box');
					box.setAttribute('onclick',"ScholarPane.selectItem("+notes[i].getID()+");");
					box.setAttribute('class','clicky');
					box.appendChild(icon);
					box.appendChild(label);
				
					var removeButton = document.createElement('label');
					removeButton.setAttribute("value","-");
					removeButton.setAttribute("class","clicky");
					removeButton.setAttribute("onclick","ScholarItemPane.removeNote("+notes[i].getID()+")");
				
					var row = document.createElement('row');
					row.appendChild(box);
					row.appendChild(removeButton);
				
					_notesList.appendChild(row);
				}
			}
		
			_updateNoteCount();
		}
		
		// Attachments pane
		else if(index == 2)
		{
			while(_attachmentsList.hasChildNodes())
				_attachmentsList.removeChild(_attachmentsList.firstChild);
				
			var attachments = Scholar.Items.get(_itemBeingEdited.getAttachments());
			if(attachments.length)
			{
				for(var i = 0; i < attachments.length; i++)
				{
					var icon = document.createElement('image');
					var linkMode = attachments[i].getAttachmentLinkMode();
					if(linkMode == Scholar.Attachments.LINK_MODE_IMPORTED_FILE)
					{
						itemType = "-file";
					}
					else if(linkMode == Scholar.Attachments.LINK_MODE_LINKED_FILE)
					{
						itemType = "-link";
					}
					else if(linkMode == Scholar.Attachments.LINK_MODE_IMPORTED_URL)
					{
						itemType = "-snapshot";
					}
					else if(linkMode == Scholar.Attachments.LINK_MODE_LINKED_URL)
					{
						itemType = "-web-link";
					}
					icon.setAttribute('src','chrome://scholar/skin/treeitem-file'+itemType+'.png');
				
					var label = document.createElement('label');
					label.setAttribute('value',attachments[i].getField('title'));
					label.setAttribute('flex','1');	//so that the long names will flex smaller
					label.setAttribute('crop','end');
				
					var box = document.createElement('box');
					box.setAttribute('onclick',"ScholarPane.selectItem('"+attachments[i].getID()+"')");
					box.setAttribute('class','clicky');
					box.appendChild(icon);
					box.appendChild(label);
				
					var removeButton = document.createElement('label');
					removeButton.setAttribute("value","-");
					removeButton.setAttribute("class","clicky");
					removeButton.setAttribute("onclick","ScholarItemPane.removeAttachment("+attachments[i].getID()+")");
				
					var row = document.createElement('row');
					row.appendChild(box);
					row.appendChild(removeButton);
				
					_attachmentsList.appendChild(row);
				}
			}
		
			_updateAttachmentCount();
			
		}
		
		// Tags pane
		else if(index == 3)
		{
			_tagsBox.item = _itemBeingEdited;
		}
		
		// Related pane
		else if(index == 4)
		{
			_relatedBox.item = _itemBeingEdited;
		}
	}
	
	function changeTypeTo(id)
	{
		if(id != _itemBeingEdited.getType() && confirm(Scholar.getString('pane.item.changeType')))
		{
			_itemBeingEdited.setType(id);
			_itemBeingEdited.save();
			loadPane(0);
		}
	}
	
	function onOpenURLClick()
	{
		window.open(Scholar.OpenURL.resolve(_itemBeingEdited));
	}
	
	function addDynamicRow(label, value, beforeElement)
	{
		var row = document.createElement("row");
		row.appendChild(label);
		row.appendChild(value);
		if(beforeElement)
			_dynamicFields.insertBefore(row, _beforeRow);
		else	
			_dynamicFields.appendChild(row);		
	}
	
	function addCreatorRow(firstName, lastName, typeID, unsaved, defaultRow)
	{
		// Disable the "+" button on previous rows
		var elems = _dynamicFields.getElementsByAttribute('value', '+');
		if (elems.length){
			ScholarItemPane.disableButton(elems[elems.length-1]);
		}
		
		if(!firstName)
			firstName = "(" + Scholar.getString('pane.item.defaultFirstName') + ")";
		if(!lastName)
			lastName = "(" + Scholar.getString('pane.item.defaultLastName') + ")";
		var label = document.createElement("label");
		label.setAttribute("value",Scholar.getString('creatorTypes.'+Scholar.CreatorTypes.getName(typeID))+":");
		label.setAttribute("popup","creatorTypeMenu");
		label.setAttribute("fieldname",'creator-'+_creatorCount+'-typeID');
		
		label.className = 'clicky';
		
		// getCreatorFields() needs to be adjusted if this DOM structure changes
		var row = document.createElement("hbox");
		
		var firstlast = document.createElement("hbox");
		firstlast.setAttribute("flex","1");
		
		var tabindex = _tabIndexMinCreators + (_creatorCount * 2);
		firstlast.appendChild(
			createValueElement(
				lastName + ",",
				'creator-' + _creatorCount + '-lastName',
				tabindex
			)
		);
		firstlast.appendChild(
			createValueElement(
				firstName,
				'creator-' + _creatorCount + '-firstName',
				tabindex + 1
			)
		);
		_tabIndexMaxCreators = Math.max(_tabIndexMaxCreators, tabindex + 1);
		
		row.appendChild(firstlast);
		
		var removeButton = document.createElement('label');
		removeButton.setAttribute("value","-");
		// If default first row, don't let user remove it
		if (defaultRow){
			disableButton(removeButton);
		}
		else {
			removeButton.setAttribute("class","clicky");
			removeButton.setAttribute("onclick","ScholarItemPane.removeCreator("+_creatorCount+", this.parentNode.parentNode)");
		}
		row.appendChild(removeButton);
		
		var addButton = document.createElement('label');
		addButton.setAttribute("value","+");
		// If row isn't saved, don't let user add more
		if (unsaved)
		{
			disableButton(addButton);
		}
		else
		{
			_enablePlusButton(addButton);
		}
		row.appendChild(addButton);
		
		_creatorCount++;
		
		addDynamicRow(label, row, true);
	}
	
	function disableButton(button)
	{
		button.setAttribute('disabled', true);
		button.setAttribute('class', 'unclicky');
		button.setAttribute('onclick', false); 
	}
	
	function _enablePlusButton(button)
	{
		button.setAttribute('disabled', false);
		button.setAttribute("class","clicky");
		button.setAttribute("onclick","ScholarItemPane.disableButton(this); ScholarItemPane.addCreatorRow('','',1,true);");
	}
	
	function createValueElement(valueText, fieldName, tabindex)
	{
	 	var valueElement = document.createElement("label");
		if(fieldName)
		{
			valueElement.setAttribute('fieldname',fieldName);
			valueElement.setAttribute('tabindex', tabindex);
			valueElement.setAttribute('onclick', 'ScholarItemPane.showEditor(this);');
			valueElement.className = 'clicky';
		}

		var firstSpace;		
		if(typeof valueText == 'string')
			firstSpace = valueText.indexOf(" ");

		if((firstSpace == -1 && valueText.length > 29 ) || firstSpace > 29)
		{
			valueElement.setAttribute('crop', 'end');
			valueElement.setAttribute('value',valueText);
		}
		else
		{
			// Wrap to multiple lines
			valueElement.appendChild(document.createTextNode(valueText));
		}
		return valueElement;
	}
	
	function removeCreator(index, labelToDelete)
	{
		// If unsaved row, just remove element
		if (!_itemBeingEdited.hasCreatorAt(index)){
			labelToDelete.parentNode.removeChild(labelToDelete);
			
			// Enable the "+" button on the previous row
			var elems = _dynamicFields.getElementsByAttribute('value', '+');
			_enablePlusButton(elems[elems.length-1]);
			
			_creatorCount--;
			return;
		}
		_itemBeingEdited.removeCreator(index);
		_itemBeingEdited.save();
		loadPane(0);
	}
	
	function showEditor(elem)
	{
		//Scholar.debug('Showing editor');
		
		var fieldName = elem.getAttribute('fieldname');
		var tabindex = elem.getAttribute('tabindex');
		var value = '';
		var creatorFields = fieldName.split('-');
		if(creatorFields[0] == 'creator')
		{
			var c = _itemBeingEdited.getCreator(creatorFields[1]);
			if(c)
				value = c[creatorFields[2]];
		}
		else
		{
			value = _itemBeingEdited.getField(fieldName);
		}
		
		var t = document.createElement("textbox");
		t.setAttribute('value',value);
		t.setAttribute('fieldname',fieldName);
		t.setAttribute('tabindex', tabindex);
		t.setAttribute('flex','1');
		t.className = 'fieldeditor';
		
		var box = elem.parentNode;
		box.replaceChild(t,elem);
		
		t.select();
		
		t.setAttribute('onblur',"ScholarItemPane.hideEditor(this, true);");
		t.setAttribute('onkeypress',"return ScholarItemPane.handleKeyPress(event)");
		
		_tabDirection = false;
		_lastTabIndex = tabindex;
	}
	
	
	function handleKeyPress(event){
		switch (event.keyCode)
		{
			case event.DOM_VK_RETURN:
				document.commandDispatcher.focusedElement.blur();
				break;
				
			case event.DOM_VK_ESCAPE:
				ScholarItemPane.hideEditor(document.commandDispatcher.focusedElement, false);
				break;
				
			case event.DOM_VK_TAB:
				_tabDirection = event.shiftKey ? -1 : 1;
				break;
		}
		
		return true;
	}
	
	function hideEditor(t, saveChanges)
	{
		//Scholar.debug('Hiding editor');
		var textbox = t.parentNode.parentNode;
		var fieldName = textbox.getAttribute('fieldname');
		var tabindex = textbox.getAttribute('tabindex');
		var value = t.value;
		
		var elem;
		var creatorFields = fieldName.split('-');
		if(creatorFields[0] == 'creator')
		{
			if (saveChanges){
				var otherFields =
					this.getCreatorFields(textbox.parentNode.parentNode.parentNode);
				modifyCreator(creatorFields[1], creatorFields[2], value, otherFields);
			}
			
			var val = _itemBeingEdited.getCreator(creatorFields[1])[creatorFields[2]];
			
			if (!val){
				// Reset to '(first)' or '(last)'
				if (creatorFields[2]=='lastName'){
					val = "(" + Scholar.getString('pane.item.defaultLastName') + ")";
				}
				else if (creatorFields[2]=='firstName'){
					val = "(" + Scholar.getString('pane.item.defaultFirstName') + ")";
				}
			}
			
			// Add trailing comma
			if (creatorFields[2]=='lastName'){
				val += ',';
			}
			
			elem = createValueElement(val, fieldName, tabindex);
		}
		else
		{
			if(saveChanges)
				modifyField(fieldName,value);
		
			elem = createValueElement(_itemBeingEdited.getField(fieldName), fieldName, tabindex);
		}
		
		var box = textbox.parentNode;
		box.replaceChild(elem,textbox);
		
		if (_tabDirection)
		{
			_focusNextField(_lastTabIndex, _tabDirection==-1);
		}
	}
	
	function modifyField(field, value)
	{
		_itemBeingEdited.setField(field,value);
		_itemBeingEdited.save();
	}
	
	function getCreatorFields(row){
		var type = row.getElementsByTagName('label')[0].getAttribute('value');
		var label1 = row.getElementsByTagName('hbox')[0].firstChild.firstChild;
		var label2 = label1.nextSibling;
		
		return {
			lastName: label1.firstChild ? label1.firstChild.nodeValue
				// Strip trailing comma
				.substr(0, label1.firstChild.nodeValue.length-1): label1.value,
			firstName: label2.firstChild ? label2.firstChild.nodeValue
				: label2.value,
			typeID: Scholar.CreatorTypes.getID(type.substr(0, type.length-1).toLowerCase()),
			isInstitution: null // placeholder
		}
	}
	
	function modifyCreator(index, field, value, otherFields)
	{
		if (otherFields){
			var firstName = otherFields.firstName;
			var lastName = otherFields.lastName;
			var typeID = otherFields.typeID;
			// var isInstitution = otherFields.isInstitution;
			
			// Ignore '(first)' and '(last)'
			if (firstName == "(" + Scholar.getString('pane.item.defaultFirstName') + ")"){
				firstName = '';
			}
			if (lastName == "(" + Scholar.getString('pane.item.defaultLastName') + ")"){
				lastName = '';
			}
		}
		else {
			var creator = _itemBeingEdited.getCreator(index);
			var firstName = creator['firstName'];
			var lastName = creator['lastName'];
			var typeID = creator['creatorTypeID'];
			// var isInstitution = creator['isInstitution'];
		}
		
		if (!_itemBeingEdited.hasCreatorAt(index) && !firstName && !lastName){
			return;
		}
		
		switch (field){
			case 'firstName':
				firstName = value;
				break;
			case 'lastName':
				lastName = value;
				break;
			case 'typeID':
				typeID = value;
				break;
		}
		
		_itemBeingEdited.setCreator(index, firstName, lastName, typeID);
		_itemBeingEdited.save();
	}
	
	function removeNote(id)
	{
		var note = Scholar.Items.get(id);
		if(note)
			if(confirm(Scholar.getString('pane.item.notes.delete.confirm')))
				note.erase();
	}
	
	function addNote()
	{
		ScholarPane.openNoteWindow(_itemBeingEdited.getID());
	}
	
	function _noteToTitle(text)
	{
		var MAX_LENGTH = 100;
		
		var t = text.substring(0, MAX_LENGTH);
		var ln = t.indexOf("\n");
		if (ln>-1 && ln<MAX_LENGTH)
		{
			t = t.substring(0, ln);
		}
		
		if(t == "")
		{
			return Scholar.getString('pane.item.notes.untitled');
		}
		else
		{
			return t;
		}
	}
	
	function _updateNoteCount()
	{
		var c = _notesList.childNodes.length;
		
		_notesLabel.value = Scholar.getString('pane.item.notes.count.'+(c != 1 ? "plural" : "singular")).replace('%1',c) + ":";
	}
	
	function _updateAttachmentCount()
	{
		var c = _attachmentsList.childNodes.length;
		
		_attachmentsLabel.value = Scholar.getString('pane.item.attachments.count.'+(c != 1 ? "plural" : "singular")).replace('%1',c) + ":";
	}
	
	function removeAttachment(id)
	{
		var attachment = Scholar.Items.get(id);
		if(attachment)
			if(confirm(Scholar.getString('pane.item.attachments.delete.confirm')))
				attachment.erase();
	}
	
	function addAttachmentFromDialog(link)
	{
		ScholarPane.addAttachmentFromDialog(link, _itemBeingEdited.getID());
	}
	
	function addAttachmentFromPage(link)
	{
		ScholarPane.addAttachmentFromPage(link, _itemBeingEdited.getID());
	}
	
	
	/*
	 * Advance the field focus forward or backward
	 *
	 * Note: We're basically replicating the built-in tabindex functionality,
	 * which doesn't work well with the weird label/textbox stuff we're doing.
	 * (The textbox being tabbed away from is deleted before the blur()
	 * completes, so it doesn't know where it's supposed to go next.)
	 *
	 * Use of the 'tabindex' attribute is arbitrary.
	 */
	function _focusNextField(tabindex, back){
		tabindex = parseInt(tabindex);
		if (back)
		{
			switch (tabindex)
			{
				case 1:
					//Scholar.debug('At beginning');
					return false;
				
				case _tabIndexMinCreators:
					var nextIndex = 1;
					break;
				
				case _tabIndexMinFields:
					var nextIndex = _tabIndexMaxCreators;
					break;
				
				default:
					var nextIndex = tabindex - 1;
			}
		}
		else
		{
			switch (tabindex)
			{
				case 1:
					var nextIndex = _tabIndexMinCreators;
					break;
				
				case _tabIndexMaxCreators:
					var nextIndex = _tabIndexMinFields;
					break;
				
				case _tabIndexMaxFields:
					//Scholar.debug('At end');
					return false;
				
				default:
					var nextIndex = tabindex + 1;
			}
		}
		
		//Scholar.debug('Looking for tabindex ' + nextIndex);
		var next = _dynamicFields.getElementsByAttribute('tabindex', nextIndex);
		
		if (!next[0])
		{
			//Scholar.debug("Next field not found");
			return _focusNextField(nextIndex, back);
		}
		
		next[0].click();
		return true;
	}
}

addEventListener("load", function(e) { ScholarItemPane.onLoad(e); }, false);
