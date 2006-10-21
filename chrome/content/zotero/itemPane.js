/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

var ZoteroItemPane = new function()
{
	var _dynamicFields;
	var _creatorTypeMenu;
	var _beforeRow;
	var _notesList;
	var _linksBox;
	var _notesLabel;
	
	var _creatorCount;
	
	var _lastPane;
	var _loaded;
	
	var _itemBeingEdited;
	
	var _lastTabIndex;
	var _tabDirection;
	var _tabIndexMinCreators = 10;
	var _tabIndexMaxCreators = 0;
	var _tabIndexMinFields = 1000;
	var _tabIndexMaxInfoFields = 0;
	var _tabIndexMaxTagsFields = 0;
	
	const _defaultFirstName =
		'(' + Zotero.getString('pane.item.defaultFirstName') + ')';
	const _defaultLastName =
		'(' + Zotero.getString('pane.item.defaultLastName') + ')';
	const _defaultFullName =
		'(' + Zotero.getString('pane.item.defaultFullName') + ')';
	
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
	this.handleCreatorAutoCompleteSelect = handleCreatorAutoCompleteSelect;
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
		_tabs = document.getElementById('zotero-view-tabs');
		
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
		
		var itemTypes = Zotero.ItemTypes.getTypes();
		for(var i = 0; i<itemTypes.length; i++)
			if(itemTypes[i]['name'] != 'note' && itemTypes[i]['name'] != 'attachment')
				_itemTypeMenu.appendItem(Zotero.getString("itemTypes."+itemTypes[i]['name']),itemTypes[i]['id']);
		
		return true;
	}
	
	/*
	 * Loads an item 
	 */
	function viewItem(thisItem)
	{
		//Zotero.debug('Viewing item');
		
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
		//Zotero.debug('Loading item pane ' + index);
		
		// Clear the tab index when switching panes
		if (_lastPane!=index)
		{
			_lastTabIndex = null;
		}
		_lastPane = index;
		
		if(_loaded[index])
		{
			return;
		}
		_loaded[index] = true;
		
		// Info pane
		if(index == 0)
		{
			// Enable/disable "View =>" button
			testView: try
			{
				var validURI = false;
				
				var snapID = _itemBeingEdited.getBestSnapshot();
				if (snapID)
				{
					var spec = Zotero.Items.get(snapID).getLocalFileURL();
				}
				else
				{
					var spec = _itemBeingEdited.getField('url');
				}
				
				if (!spec)
				{
					break testView;
				}
				var uri = Components.classes["@mozilla.org/network/io-service;1"]
							.getService(Components.interfaces.nsIIOService)
							.newURI(spec, null, null);
				
				validURI = uri.scheme && (uri.host || uri.scheme=='file');
				
				document.getElementById('tb-go-to-url').setAttribute('viewURL', spec);
			}
			catch (e){}
			document.getElementById('tb-go-to-url').setAttribute('disabled', !validURI);
			
			// Enable/disable "Locate =>" (OpenURL) button
			switch (_itemBeingEdited.getType())
			{
				// DEBUG: handle descendents of these types as well?
				case Zotero.ItemTypes.getID('book'):
				case Zotero.ItemTypes.getID('bookSection'):
				case Zotero.ItemTypes.getID('journalArticle'):
				case Zotero.ItemTypes.getID('thesis'):
					var openURL = true;
					break;
				
				default:
					var openURL = false;
			}
			document.getElementById('tb-openurl').setAttribute('disabled', !openURL);
			
			// Clear and rebuild creator type menu
			while(_creatorTypeMenu.hasChildNodes())
			{
				_creatorTypeMenu.removeChild(_creatorTypeMenu.firstChild);
			}
			
			var creatorTypes = Zotero.CreatorTypes.getTypesForItemType(_itemBeingEdited.getType());
			var localized = [];
			for (var i in creatorTypes)
			{
				localized[creatorTypes[i]['name']]
					= Zotero.getString('creatorTypes.' + creatorTypes[i]['name']);
			}
			
			for (var i in localized)
			{
				var menuitem = document.createElement("menuitem");
				menuitem.setAttribute("label", localized[i]);
				menuitem.setAttribute("typeid", Zotero.CreatorTypes.getID(i));
				_creatorTypeMenu.appendChild(menuitem);
			}
			
			
			//
			// Clear and rebuild metadata fields
			//
			while(_dynamicFields.hasChildNodes())
				_dynamicFields.removeChild(_dynamicFields.firstChild);
		
			for(var i = 0, len = _itemTypeMenu.firstChild.childNodes.length; i < len; i++)
				if(_itemTypeMenu.firstChild.childNodes[i].value == _itemBeingEdited.getType())
					_itemTypeMenu.selectedIndex = i;
		
			var fieldNames = new Array("title");
			var fields = Zotero.ItemFields.getItemTypeFields(_itemBeingEdited.getField("itemTypeID"));
			for(var i = 0; i<fields.length; i++)
				fieldNames.push(Zotero.ItemFields.getName(fields[i]));
			fieldNames.push("dateAdded","dateModified");
			
			for(var i = 0; i<fieldNames.length; i++)
			{
				var editable = (!_itemBeingEdited.isPrimaryField(fieldNames[i]) || _itemBeingEdited.isEditableField(fieldNames[i]));
				
				var val = _itemBeingEdited.getField(fieldNames[i]);
				
				// Start tabindex at 1000 after creators
				var tabindex = editable ? (i>0 ? _tabIndexMinFields + i : 1) : 0;
				
				var valueElement = createValueElement(
					val, editable ? fieldNames[i] : null, tabindex
				);
				
				_tabIndexMaxInfoFields = Math.max(_tabIndexMaxInfoFields, tabindex);
				
				var label = document.createElement("label");
				label.setAttribute("value",Zotero.getString("itemFields."+fieldNames[i])+":");
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
					addCreatorRow(creator['firstName'], creator['lastName'], creator['creatorTypeID'], creator['fieldMode']);
				}
			}
			else
			{
				// Add default row
				addCreatorRow('', '', false, Zotero.Prefs.get('lastCreatorFieldMode'), true, true);
			}
			
			var focusMode = 'info';
			var focusBox = _dynamicFields;
		}
		
		// Notes pane
		else if(index == 1)
		{
			while(_notesList.hasChildNodes())
				_notesList.removeChild(_notesList.firstChild);
				
			var notes = Zotero.Items.get(_itemBeingEdited.getNotes());
			if(notes.length)
			{
				for(var i = 0; i < notes.length; i++)
				{
					var icon = document.createElement('image');
					icon.setAttribute('src','chrome://zotero/skin/treeitem-note.png');
				
					var label = document.createElement('label');
					label.setAttribute('value',_noteToTitle(notes[i].getNote()));
					label.setAttribute('flex','1');	//so that the long names will flex smaller
					label.setAttribute('crop','end');
				
					var box = document.createElement('box');
					box.setAttribute('onclick',"ZoteroPane.selectItem("+notes[i].getID()+");");
					box.setAttribute('class','clicky');
					box.appendChild(icon);
					box.appendChild(label);
				
					var removeButton = document.createElement('label');
					removeButton.setAttribute("value","-");
					removeButton.setAttribute("class","clicky");
					removeButton.setAttribute("onclick","ZoteroItemPane.removeNote("+notes[i].getID()+")");
				
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
				
			var attachments = Zotero.Items.get(_itemBeingEdited.getAttachments());
			if(attachments.length)
			{
				for(var i = 0; i < attachments.length; i++)
				{
					var icon = document.createElement('image');
					var linkMode = attachments[i].getAttachmentLinkMode();
					if(linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE)
					{
						itemType = "-file";
					}
					else if(linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE)
					{
						itemType = "-link";
					}
					else if(linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL)
					{
						itemType = "-snapshot";
					}
					else if(linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL)
					{
						itemType = "-web-link";
					}
					icon.setAttribute('src','chrome://zotero/skin/treeitem-file'+itemType+'.png');
				
					var label = document.createElement('label');
					label.setAttribute('value',attachments[i].getField('title'));
					label.setAttribute('flex','1');	//so that the long names will flex smaller
					label.setAttribute('crop','end');
				
					var box = document.createElement('box');
					box.setAttribute('onclick',"ZoteroPane.selectItem('"+attachments[i].getID()+"')");
					box.setAttribute('class','clicky');
					box.appendChild(icon);
					box.appendChild(label);
				
					var removeButton = document.createElement('label');
					removeButton.setAttribute("value","-");
					removeButton.setAttribute("class","clicky");
					removeButton.setAttribute("onclick","ZoteroItemPane.removeAttachment("+attachments[i].getID()+")");
				
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
			var focusMode = 'tags';
			var focusBox = _tagsBox;
			_tagsBox.item = _itemBeingEdited;
		}
		
		// Related pane
		else if(index == 4)
		{
			_relatedBox.item = _itemBeingEdited;
		}
		
		
		// Move to next or previous field if (shift-)tab was pressed
		if (focusMode && _lastTabIndex && _tabDirection)
		{
			_focusNextField(focusMode, focusBox, _lastTabIndex, _tabDirection==-1);
		}
	}
	
	function changeTypeTo(id)
	{
		if(id != _itemBeingEdited.getType() && confirm(Zotero.getString('pane.item.changeType')))
		{
			_itemBeingEdited.setType(id);
			_itemBeingEdited.save();
			loadPane(0);
		}
	}
	
	function onOpenURLClick()
	{
		var url = Zotero.OpenURL.resolve(_itemBeingEdited);
		if (url)
		{
			window.loadURI(Zotero.OpenURL.resolve(_itemBeingEdited));
		}
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
			ZoteroItemPane.disableButton(elems[elems.length-1]);
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
		
		// Use the first entry in the drop-down for the default type
		if (!typeID)
		{
			typeID = _creatorTypeMenu.childNodes[0].getAttribute('typeid');
		}
		
		var label = document.createElement("toolbarbutton");
		label.setAttribute("label",Zotero.getString('creatorTypes.'+Zotero.CreatorTypes.getName(typeID))+":");
		label.setAttribute("typeid", typeID);
		label.setAttribute("popup","creatorTypeMenu");
		label.setAttribute("fieldname",'creator-'+_creatorCount+'-typeID');
		label.className = 'clicky';
		
		// getCreatorFields(), switchCreatorMode() and handleCreatorAutoCompleteSelect()
		// may need need to be adjusted if this DOM structure changes
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
		
		// Comma
		var comma = document.createElement('label');
		comma.setAttribute('value', ',');
		comma.className = 'comma';
		firstlast.appendChild(comma);
		
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
			removeButton.setAttribute("onclick","ZoteroItemPane.removeCreator("+_creatorCount+", this.parentNode.parentNode)");
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
			_enablePlusButton(addButton, typeID, singleField);
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
		var comma = hbox.firstChild.nextSibling;
		var firstName = hbox.lastChild;
		
		// Switch to single-field mode
		if (singleField)
		{
			button.setAttribute('image', 'chrome://zotero/skin/textfield-dual.png');
			button.setAttribute('tooltiptext', 'Switch to two fields');
			lastName.setAttribute('singleField', 'true');
			button.setAttribute('onclick', "ZoteroItemPane.switchCreatorMode(this.parentNode.parentNode, false)");
			
			// Remove firstname field from tabindex
			var tab = parseInt(firstName.getAttribute('tabindex'));
			firstName.setAttribute('tabindex', -1);
			if (_tabIndexMaxCreators==tab)
			{
				_tabIndexMaxCreators--;
			}
			
			// Hide first name field and prepend to last name field
			firstName.setAttribute('hidden', true);
			comma.setAttribute('hidden', true);
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
			button.setAttribute('image', 'chrome://zotero/skin/textfield-single.png');
			button.setAttribute('tooltiptext', 'Switch to single field');
			lastName.setAttribute('singleField', 'false');
			button.setAttribute('onclick', "ZoteroItemPane.switchCreatorMode(this.parentNode.parentNode, true)");
			
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
			comma.setAttribute('hidden', false);
		}
		
		// Save the last-used field mode
		Zotero.Prefs.set('lastCreatorFieldMode', singleField);
		
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
	
	function _enablePlusButton(button, creatorTypeID, fieldMode)
	{
		button.setAttribute('disabled', false);
		button.setAttribute("class","clicky");
		button.setAttribute("onclick",
			"ZoteroItemPane.disableButton(this); ZoteroItemPane.addCreatorRow('', '', " + (creatorTypeID ? creatorTypeID : 'false') + ", " + fieldMode + ", true);");
	}
	
	function createValueElement(valueText, fieldName, tabindex)
	{
		if (fieldName=='extra')
		{
			var valueElement = document.createElement("vbox");
		}
		else
		{
			var valueElement = document.createElement("label");
		}
		
		if(fieldName)
		{
			valueElement.setAttribute('fieldname',fieldName);
			valueElement.setAttribute('tabindex', tabindex);
			valueElement.setAttribute('onclick', 'ZoteroItemPane.showEditor(this)');
			valueElement.className = 'clicky';
			
			switch (fieldName)
			{
				case 'tag':
					_tabIndexMaxTagsFields = Math.max(_tabIndexMaxTagsFields, tabindex);
					break;
				
				// Convert dates from UTC
				case 'dateAdded':
				case 'dateModified':
				case 'accessDate':
					if (valueText)
					{
						var date = Zotero.Date.sqlToDate(valueText, true);
						valueText = date ? date.toLocaleString() : '';
					}
					break;
			}
		}
		
		var firstSpace;		
		if(typeof valueText == 'string')
			firstSpace = valueText.indexOf(" ");
		
		// To support newlines in 'extra' fields, we use multiple
		// <description> elements inside a vbox
		if (fieldName=='extra')
		{
			var lines = valueText.split("\n");
			for (var i = 0; i < lines.length; i++) {
				var descriptionNode = document.createElement("description");
				var linetext = document.createTextNode(lines[i]);
				descriptionNode.appendChild(linetext);
				valueElement.appendChild(descriptionNode);
			}
		}
		// 29 == arbitary length at which to chop uninterrupted text
		else if ((firstSpace == -1 && valueText.length > 29 ) || firstSpace > 29)
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
			var button = elems[elems.length-1];
			var creatorFields = getCreatorFields(Zotero.getAncestorByTagName(button, 'row'));
			_enablePlusButton(button, creatorFields.typeID, creatorFields.singleField);
			
			_creatorCount--;
			return;
		}
		_itemBeingEdited.removeCreator(index);
		_itemBeingEdited.save();
		loadPane(0);
	}
	
	function showEditor(elem)
	{
		//Zotero.debug('Showing editor');
		
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
			var value = tagID ? Zotero.Tags.getName(tagID) : '';
			var itemID = Zotero.getAncestorByTagName(elem, 'tagsbox').item.getID();
		}
		else
		{
			var value = _itemBeingEdited.getField(fieldName);
			var itemID = _itemBeingEdited.getID();
			
			// Access date needs to be converted from UTC
			if (fieldName=='accessDate' && value!='')
			{
				var localDate = Zotero.Date.sqlToDate(value, true);
				var value = Zotero.Date.dateToSQL(localDate);
			}
		}
		
		var t = document.createElement("textbox");
		t.setAttribute('value',value);
		t.setAttribute('fieldname', fieldName);
		t.setAttribute('tabindex', tabindex);
		t.setAttribute('flex','1');
		
		if (creatorField=='lastName')
		{
			t.setAttribute('singleField', elem.getAttribute('singleField'));
		}
		
		if (fieldName=='extra')
		{
			t.setAttribute('multiline', true);
			t.setAttribute('rows', 8);
		}
		else
		{
			// Add auto-complete for certain fields
			switch (field)
			{
				case 'creator':
				case 'publisher':
				case 'place':
				case 'publicationTitle':
				case 'journalAbbreviation':
				case 'seriesTitle':
				case 'seriesText':
				case 'tag':
				// DEBUG: should have type and medium, but they need to be
				// broken out first into multiple fields (artworkType,
				// interviewMedium, etc.)
					t.setAttribute('type', 'autocomplete');
					t.setAttribute('autocompletesearch', 'zotero');
					var suffix = itemID ? itemID : '';
					if (field=='creator')
					{
						suffix = (elem.getAttribute('singleField')=='true'
							? '1' : '0') + '-' + suffix;
					}
					t.setAttribute('autocompletesearchparam',
						fieldName + '/' + suffix);
					t.setAttribute('ontextentered',
							'ZoteroItemPane.handleCreatorAutoCompleteSelect(this)');
					break;
			}
		}
		var box = elem.parentNode;
		box.replaceChild(t,elem);
		
		t.select();
		
		t.setAttribute('onblur',"ZoteroItemPane.hideEditor(this, true)");
		t.setAttribute('onkeypress',"return ZoteroItemPane.handleKeyPress(event)");
		
		_tabDirection = false;
		_lastTabIndex = tabindex;
	}
	
	
	/*
	 * Save a multiple-field selection for the creator autocomplete
	 * (e.g. "Shakespeare, William")
	 */
	function handleCreatorAutoCompleteSelect(textbox)
	{
		var comment = Zotero.Utilities.AutoComplete.getResultComment(textbox);
		if (!comment)
		{
			return;
		}
		
		var [creatorID, numFields] = comment.split('-');
		
		// If result uses two fields, save both
		if (numFields==2)
		{
			var [field, creatorIndex, creatorField] =
				textbox.getAttribute('fieldname').split('-');
			
			var creator = Zotero.Creators.get(creatorID);
			
			var row = textbox.parentNode.parentNode.parentNode;
			var otherFields = ZoteroItemPane.getCreatorFields(row);
			var otherField = creatorField=='lastName' ? 'firstName' : 'lastName';
			otherFields[otherField] = creator[otherField];
			
			ZoteroItemPane.modifyCreator(creatorIndex, creatorField,
				creator[creatorField], otherFields);
		}
		
		// Otherwise let the autocomplete popup handle matters
	}
	
	function handleKeyPress(event){
		var target = document.commandDispatcher.focusedElement;
		switch (event.keyCode)
		{
			case event.DOM_VK_RETURN:
				// Use shift-enter as the save action for the 'extra' field
				if (target.parentNode.parentNode.getAttribute('fieldname')=='extra'
					&& !event.shiftKey)
				{
					break;
				}
				else if (target.parentNode.parentNode.
					parentNode.getAttribute('fieldname')=='tag')
				{
					// If last tag row, create new one
					var row = target.parentNode.parentNode.parentNode.parentNode;
					if (row == row.parentNode.lastChild)
					{
						_tabDirection = 1;
					}
				}
				target.blur();
				return false;
				
			case event.DOM_VK_ESCAPE:
				// Reset field to original value
				target.value = target.getAttribute('value');
				target.blur();
				return false;
				
			case event.DOM_VK_TAB:
				_tabDirection = event.shiftKey ? -1 : 1;
				// Blur the old manually -- not sure why this is necessary,
				// but it prevents an immediate blur() on the next tag
				target.blur();
				return false;
		}
		
		return true;
	}
	
	function hideEditor(t, saveChanges)
	{
		//Zotero.debug('Hiding editor');
		var textbox = Zotero.getAncestorByTagName(t, 'textbox');
		if (!textbox){
			Zotero.debug('Textbox not found in hideEditor');
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
			var tagsbox = Zotero.getAncestorByTagName(textbox, 'tagsbox');
			if (!tagsbox)
			{
				Zotero.debug('Tagsbox not found', 1);
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
						// If trying to replace with another existing tag
						// (which causes a delete of the row),
						// clear the tab direction so we don't advance
						// when the notifier kicks in
						var existing = Zotero.Tags.getID(value);
						if (existing && id != existing)
						{
							_tabDirection = false;
						}
						var changed = tagsbox.replace(id, value);
						if (changed)
						{
							return;
						}
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
				_tabDirection = false;
				return;
			}
			
			var focusMode = 'tags';
			var focusBox = tagsbox;
		}
		
		// Fields
		else
		{
			// Access date needs to be converted to UTC
			if (fieldName=='accessDate' && value!='')
			{
				var localDate = Zotero.Date.sqlToDate(value);
				var value = Zotero.Date.dateToSQL(localDate, true);
			}
			
			if(saveChanges)
				modifyField(fieldName,value);
			
			elem = createValueElement(_itemBeingEdited.getField(fieldName), fieldName, tabindex);
		}
		
		var box = textbox.parentNode;
		box.replaceChild(elem,textbox);
		
		if (_tabDirection)
		{
			if (!focusMode)
			{
				var focusMode = 'info';
				var focusBox = _dynamicFields;
			}
			_focusNextField(focusMode, focusBox, _lastTabIndex, _tabDirection==-1);
		}
	}
	
	function modifyField(field, value)
	{
		_itemBeingEdited.setField(field,value);
		return _itemBeingEdited.save();
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
		var typeID = row.getElementsByTagName('toolbarbutton')[0].getAttribute('typeid');
		var label1 = row.getElementsByTagName('hbox')[0].firstChild.firstChild;
		var label2 = label1.parentNode.lastChild;
		
		return {
			lastName: label1.firstChild ? label1.firstChild.nodeValue
				: label1.value,
			firstName: label2.firstChild ? label2.firstChild.nodeValue
				: label2.value,
			typeID: typeID,
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
			var singleField = creator['singleField'];
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
		var note = Zotero.Items.get(id);
		if(note)
			if(confirm(Zotero.getString('pane.item.notes.delete.confirm')))
				note.erase();
	}
	
	function addNote()
	{
		ZoteroPane.openNoteWindow(_itemBeingEdited.getID());
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
			return Zotero.getString('pane.item.notes.untitled');
		}
		else
		{
			return t;
		}
	}
	
	function _updateNoteCount()
	{
		var c = _notesList.childNodes.length;
		
		_notesLabel.value = Zotero.getString('pane.item.notes.count.'+(c != 1 ? "plural" : "singular"), [c]) + ":";
	}
	
	function _updateAttachmentCount()
	{
		var c = _attachmentsList.childNodes.length;
		
		_attachmentsLabel.value = Zotero.getString('pane.item.attachments.count.'+(c != 1 ? "plural" : "singular"), [c]) + ":";
	}
	
	function removeAttachment(id)
	{
		var attachment = Zotero.Items.get(id);
		if(attachment)
			if(confirm(Zotero.getString('pane.item.attachments.delete.confirm')))
				attachment.erase();
	}
	
	function addAttachmentFromDialog(link)
	{
		ZoteroPane.addAttachmentFromDialog(link, _itemBeingEdited.getID());
	}
	
	function addAttachmentFromPage(link)
	{
		ZoteroPane.addAttachmentFromPage(link, _itemBeingEdited.getID());
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
	function _focusNextField(mode, box, tabindex, back){
		tabindex = parseInt(tabindex);
		if (back)
		{
			if (mode=='info')
			{
				switch (tabindex)
				{
					case 1:
						//Zotero.debug('At beginning');
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
			else if (mode=='tags')
			{
				switch (tabindex)
				{
					case 1:
						return false;
					
					default:
						var nextIndex = tabindex - 1;
				}
			}
		}
		else
		{
			if (mode=='info')
			{
				switch (tabindex)
				{
					case 1:
						var nextIndex = _tabIndexMinCreators;
						break;
					
					case _tabIndexMaxCreators:
						var nextIndex = _tabIndexMinFields;
						break;
					
					case _tabIndexMaxInfoFields:
						//Zotero.debug('At end');
						return false;
					
					default:
						var nextIndex = tabindex + 1;
				}
			}
			else if (mode=='tags')
			{
				switch (tabindex)
				{
					case _tabIndexMaxTagsFields:
						// In tags box, keep going to create new row
						var nextIndex = tabindex + 1;
						break;
					
					default:
						var nextIndex = tabindex + 1;
				}
			}
		}
		
		Zotero.debug('Looking for tabindex ' + nextIndex, 4);
		switch (mode)
		{
			case 'info':
				var next = box.getElementsByAttribute('tabindex', nextIndex);
				if (!next[0])
				{
					//Zotero.debug("Next field not found");
					return _focusNextField(mode, box, nextIndex, back);
				}
				break;
			
			// Tags pane
			case 'tags':
				var next = document.getAnonymousNodes(box)[0].
					getElementsByAttribute('tabindex', nextIndex);
				if (!next[0]){
					next[0] = box.addDynamicRow();
				}
				break;
		}
		
		next[0].click();
		return true;
	}
}

addEventListener("load", function(e) { ZoteroItemPane.onLoad(e); }, false);
