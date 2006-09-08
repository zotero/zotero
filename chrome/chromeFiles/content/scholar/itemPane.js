/*
	Zotero
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
*/

var ScholarItemPane = new function()
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
	
	const _defaultFirstName =
		'(' + Scholar.getString('pane.item.defaultFirstName') + ')';
	const _defaultLastName =
		'(' + Scholar.getString('pane.item.defaultLastName') + ')';
	const _defaultFullName =
		'(' + Scholar.getString('pane.item.defaultFullName') + ')';
	
	this.onLoad = onLoad;
	this.viewItem = viewItem;
	this.loadPane = loadPane;
	this.changeTypeTo = changeTypeTo;
	this.onOpenURLClick = onOpenURLClick;
	this.addCreatorRow = addCreatorRow;
	this.switchCreatorMode = switchCreatorMode;
	this.disableButton = disableButton;
	this.createValueElement = createValueElement;
	this.removeCreator = removeCreator;
	this.showEditor = showEditor;
	this.handleKeyPress = handleKeyPress;
	this.hideEditor = hideEditor;
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
		
		// Not in item pane, so skip the introductions
		if (!_tabs)
		{
			return false;
		}
		
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
		// Force blur() when clicking off a textbox to another item in middle
		// pane, since for some reason it's not being called automatically
		if (_itemBeingEdited && _itemBeingEdited!=thisItem)
		{
			switch (_tabs.selectedIndex)
			{
				// Info
				case 0:
					var boxes = _dynamicFields.getElementsByTagName('textbox');
					break;
					
				// Tags
				case 3:
					var boxes = document.getAnonymousNodes(_tagsBox)[0].getElementsByTagName('textbox');
					break;
			}
			
			if (boxes && boxes.length==1)
			{
				boxes[0].inputField.blur();
			}
		}
		
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
					addCreatorRow(creator['firstName'], creator['lastName'], creator['creatorTypeID'], creator['isInstitution']);
				}
			}
			else
			{
				// Add default row
				addCreatorRow('', '', 1, false, true, true);
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
	
	function addCreatorRow(firstName, lastName, typeID, singleField, unsaved, defaultRow)
	{
		// Disable the "+" button on previous rows
		var elems = _dynamicFields.getElementsByAttribute('value', '+');
		if (elems.length){
			ScholarItemPane.disableButton(elems[elems.length-1]);
		}
		
		if (singleField)
		{
			if (!lastName)
			{
				lastName = _defaultFullName;
			}
		}
		else
		{
			if (!firstName)
			{
				firstName = _defaultFirstName;
			}
			if (!lastName)
			{
				lastName = _defaultLastName;
			}
		}
		
		var label = document.createElement("label");
		label.setAttribute("value",Scholar.getString('creatorTypes.'+Scholar.CreatorTypes.getName(typeID))+":");
		label.setAttribute("popup","creatorTypeMenu");
		label.setAttribute("fieldname",'creator-'+_creatorCount+'-typeID');
		label.className = 'clicky';
		
		// getCreatorFields() and switchCreatorMode() may need need to be
		// adjusted if this DOM structure changes
		var hbox = document.createElement("hbox");
		
		// Name
		var firstlast = document.createElement("hbox");
		firstlast.setAttribute("flex","1");
		
		var tabindex = _tabIndexMinCreators + (_creatorCount * 2);
		firstlast.appendChild(
			createValueElement(
				lastName,
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
		if (singleField)
		{
			firstlast.lastChild.setAttribute('hidden', true);
		}
		_tabIndexMaxCreators = Math.max(_tabIndexMaxCreators, tabindex);
		
		hbox.appendChild(firstlast);
		
		// Single/double field toggle
		var toggleButton = document.createElement('toolbarbutton');
		toggleButton.setAttribute('fieldname', 'creator-' + _creatorCount + '-singleField');
		toggleButton.className = 'clicky';
		hbox.appendChild(toggleButton);
		
		// Minus (-) button
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
		hbox.appendChild(removeButton);
		
		// Plus (+) button
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
		hbox.appendChild(addButton);
		
		_creatorCount++;
		
		addDynamicRow(label, hbox, true);
		
		// Set single/double field toggle mode
		if (singleField)
		{
			switchCreatorMode(hbox.parentNode, true, true);
		}
		else
		{
			switchCreatorMode(hbox.parentNode, false, true);
		}
	}
	
	function switchCreatorMode(row, singleField, initial)
	{
		// Change if button position changes
		// row->hbox->label->label->toolbarbutton
		var button = row.lastChild.lastChild.previousSibling.previousSibling;
		var hbox = button.previousSibling;
		var lastName = hbox.firstChild;
		var firstName = hbox.lastChild;
		
		// Switch to single-field mode
		if (singleField)
		{
			button.setAttribute('image', 'chrome://scholar/skin/textfield-dual.png');
			button.setAttribute('tooltiptext', 'Switch to two fields');
			lastName.setAttribute('singleField', 'true');
			button.setAttribute('onclick', "ScholarItemPane.switchCreatorMode(this.parentNode.parentNode, false)");
			
			// Remove firstname field from tabindex
			var tab = parseInt(firstName.getAttribute('tabindex'));
			firstName.setAttribute('tabindex', -1);
			if (_tabIndexMaxCreators==tab)
			{
				_tabIndexMaxCreators--;
			}
			
			// Hide first name field and prepend to last name field
			firstName.setAttribute('hidden', true);
			var first = _getFieldValue(firstName);
			if (first && first != _defaultFirstName)
			{
				var last = _getFieldValue(lastName);
				_setFieldValue(lastName, first + ' ' + last);
			}
			
			if (_getFieldValue(lastName) == _defaultLastName)
			{
				_setFieldValue(lastName, _defaultFullName);
			}
		}
		// Switch to two-field mode
		else
		{
			button.setAttribute('image', 'chrome://scholar/skin/textfield-single.png');
			button.setAttribute('tooltiptext', 'Switch to single field');
			lastName.setAttribute('singleField', 'false');
			button.setAttribute('onclick', "ScholarItemPane.switchCreatorMode(this.parentNode.parentNode, true)");
			
			// Add firstname field to tabindex
			var tab = parseInt(lastName.getAttribute('tabindex'));
			firstName.setAttribute('tabindex', tab + 1);
			if (_tabIndexMaxCreators==tab)
			{
				_tabIndexMaxCreators++;
			}
			
			// Move all but last word to first name field and show it
			var last = _getFieldValue(lastName);
			if (last && last != _defaultFullName)
			{
				var lastNameRE = /(.*?)[ ]*([^ ]+[ ]*)$/;
				var parts = lastNameRE.exec(last);
				if (parts[2] && parts[2] != last)
				{
					_setFieldValue(lastName, parts[2]);
					_setFieldValue(firstName, parts[1]);
				}
			}
			
			if (!_getFieldValue(firstName))
			{
				_setFieldValue(firstName, _defaultFirstName);
			}
			
			if (_getFieldValue(lastName) == _defaultFullName)
			{
				_setFieldValue(lastName, _defaultLastName);
			}
			
			firstName.setAttribute('hidden', false);
		}
		
		if (!initial)
		{
			var [, index, field] = button.getAttribute('fieldname').split('-');
			
			var otherFields = getCreatorFields(row); // row
			modifyCreator(index, field, !!singleField, otherFields);
		}
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
		button.setAttribute("onclick","ScholarItemPane.disableButton(this); ScholarItemPane.addCreatorRow('','',1,false,true);");
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
		var [field, creatorIndex, creatorField] = fieldName.split('-');
		if (field == 'creator')
		{
			var c = _itemBeingEdited.getCreator(creatorIndex);
			var value = c ? c[creatorField] : '';
			var itemID = _itemBeingEdited.getID();
		}
		else if (fieldName=='tag')
		{
			var tagID = elem.parentNode.getAttribute('id').split('-')[1];
			var value = tagID ? Scholar.Tags.getName(tagID) : '';
			var itemID = Scholar.getAncestorByTagName(elem, 'tagsbox').item.getID();
		}
		else
		{
			var value = _itemBeingEdited.getField(fieldName);
			var itemID = _itemBeingEdited.getID();
		}
		
		var t = document.createElement("textbox");
		t.setAttribute('type', 'autocomplete');
		t.setAttribute('autocompletesearch', 'zotero');
		t.setAttribute('autocompletesearchparam', fieldName + (itemID ? '/' + itemID : ''));
		t.setAttribute('value',value);
		t.setAttribute('fieldname', fieldName);
		t.setAttribute('tabindex', tabindex);
		t.setAttribute('flex','1');
		if (creatorField=='lastName')
		{
			t.setAttribute('singleField', elem.getAttribute('singleField'));
		}
		
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
		var textbox = Scholar.getAncestorByTagName(t, 'textbox');
		if (!textbox){
			Scholar.debug('Textbox not found in hideEditor');
			return;
		}
		var fieldName = textbox.getAttribute('fieldname');
		var tabindex = textbox.getAttribute('tabindex');
		var value = t.value;
		
		var elem;
		var [field, creatorIndex, creatorField] = fieldName.split('-');
		
		// Creator fields
		if (field == 'creator')
		{
			var row = textbox.parentNode.parentNode.parentNode;
			
			var otherFields = getCreatorFields(row);
			
			if (saveChanges){
				modifyCreator(creatorIndex, creatorField, value, otherFields);
			}
			
			var val = _itemBeingEdited.getCreator(creatorIndex)[creatorField];
			
			if (!val){
				// Reset to '(first)'/'(last)'/'(name)'
				if (creatorField=='lastName')
				{
					val = otherFields['singleField']
						? _defaultFullName : _defaultLastName;
				}
				else if (creatorField=='firstName')
				{
					val = _defaultFirstName;
				}
			}
			
			elem = createValueElement(val, fieldName, tabindex);
			
			// Reset creator mode settings
			if (otherFields['singleField'])
			{
				switchCreatorMode(row, true, true);
			}
			else
			{
				switchCreatorMode(row, false, true);
			}
		}
		
		// Tags
		else if (fieldName=='tag')
		{
			var tagsbox = Scholar.getAncestorByTagName(textbox, 'tagsbox');
			if (!tagsbox)
			{
				Scholar.debug('Tagsbox not found', 1);
				return;
			}
			
			var row = textbox.parentNode;
			var rows = row.parentNode;
			
			// Tag id encoded as 'tag-1234'
			var id = row.getAttribute('id').split('-')[1];
			
			if (saveChanges)
			{
				if (id)
				{
					if (value)
					{
						tagsbox.replace(id, value);
						return;
					}
					else
					{
						tagsbox.remove(id);
						return;
					}
				}
				else
				{
					var id = tagsbox.add(value);
				}
			}
			
			if (id)
			{
				elem = createValueElement(value, 'tag', tabindex);
			}
			else
			{
				// Just remove the row
				var row = rows.removeChild(row);
				tagsbox.fixPopup();
				return;
			}
		}
			
		// Fields
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
	
	function _getFieldValue(field)
	{
		return field.firstChild
			? field.firstChild.nodeValue : field.value;
	}
	
	function _setFieldValue(field, value)
	{
		if (field.firstChild)
		{
			field.firstChild.nodeValue = value;
		}
		else
		{
			field.value = value;
		}
	}
	
	function getCreatorFields(row){
		var type = row.getElementsByTagName('label')[0].getAttribute('value');
		var label1 = row.getElementsByTagName('hbox')[0].firstChild.firstChild;
		var label2 = label1.nextSibling;
		
		return {
			lastName: label1.firstChild ? label1.firstChild.nodeValue
				: label1.value,
			firstName: label2.firstChild ? label2.firstChild.nodeValue
				: label2.value,
			typeID: Scholar.CreatorTypes.getID(type.substr(0, type.length-1).toLowerCase()),
			singleField: label1.getAttribute('singleField') == 'true'
		}
	}
	
	function modifyCreator(index, field, value, otherFields)
	{
		if (otherFields){
			var firstName = otherFields.firstName;
			var lastName = otherFields.lastName;
			var typeID = otherFields.typeID;
			var singleField = otherFields.singleField;
			
			// Ignore '(first)'/'(last)' or '(name)'
			if (singleField || firstName == _defaultFirstName){
				firstName = '';
			}
			
			if (lastName==_defaultFullName || lastName == _defaultLastName){
				lastName = '';
			}
		}
		else {
			var creator = _itemBeingEdited.getCreator(index);
			var firstName = creator['firstName'];
			var lastName = creator['lastName'];
			var typeID = creator['creatorTypeID'];
			var singleField = creator['isInstitution'];
		}
		
		// Don't save empty creators
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
			case 'singleField':
				singleField = value;
				break;
		}
		
		_itemBeingEdited.setCreator(index, firstName, lastName, typeID, singleField);
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
