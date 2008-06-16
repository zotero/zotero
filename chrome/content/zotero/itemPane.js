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

var ZoteroItemPane = new function() {
	var _itemBeingEdited;
	
	var _notesList;
	var _linksBox;
	var _notesLabel;
	
	var _lastPane;
	var _loaded;
	
	var _tabs;
	var _lastTabIndex;
	var _tabDirection;
	var _tabIndexMaxTagsFields = 0;
	
	this.onLoad = onLoad;
	this.viewItem = viewItem;
	this.loadPane = loadPane;
	this.removeNote = removeNote;
	this.addNote = addNote;
	this.removeAttachment = removeAttachment;
	this.addAttachmentFromDialog = addAttachmentFromDialog;
	this.addAttachmentFromPage = addAttachmentFromPage;
	
	
	function onLoad()
	{
		if (!Zotero || !Zotero.initialized) {
			return;
		}
		
		_tabs = document.getElementById('zotero-view-tabs');
		
		// Not in item pane, so skip the introductions
		if (!_tabs) {
			return;
		}
		
		_itemBox = document.getElementById('zotero-editpane-item-box');
		_notesList = document.getElementById('zotero-editpane-dynamic-notes');
		_notesLabel = document.getElementById('zotero-editpane-notes-label');
		_attachmentsList = document.getElementById('zotero-editpane-dynamic-attachments');
		_attachmentsLabel = document.getElementById('zotero-editpane-attachments-label');
		_tagsBox = document.getElementById('zotero-editpane-tags');
		_relatedBox = document.getElementById('zotero-editpane-related');
	}
	
	/*
	 * Loads an item 
	 */
	function viewItem(thisItem, mode) {
		//Zotero.debug('Viewing item');
		
		// Force blur() when clicking off a textbox to another item in middle
		// pane, since for some reason it's not being called automatically
		if (_itemBeingEdited && _itemBeingEdited != thisItem) {
			switch (_tabs.selectedIndex) {
				// Info
				case 0:
					// TODO: fix
					//var boxes = _itemBox.getElementsByTagName('textbox');
					
					// When coming from another element, scroll pane to top
					//scrollToTop();
					break;
					
				// Tags
				case 3:
					var boxes = document.getAnonymousNodes(_tagsBox)[0].getElementsByTagName('textbox');
					break;
			}
			
			if (boxes && boxes.length == 1) {
				//boxes[0].inputField.blur();
			}
		}
		
		_itemBeingEdited = thisItem;
		_loaded = {};
		
		loadPane(_tabs.selectedIndex, mode);
	}
	
	
	function loadPane(index, mode) {
		//Zotero.debug('Loading item pane ' + index);
		
		// Clear the tab index when switching panes
		if (_lastPane!=index) {
			_lastTabIndex = null;
		}
		_lastPane = index;
		
		if (_loaded[index]) {
			return;
		}
		_loaded[index] = true;
		
		// Info pane
		if (index == 0) {
			// Hack to allow read-only mode in right pane -- probably a better
			// way to allow access to this
			if (mode) {
				_itemBox.mode = mode;
			}
			else {
				_itemBox.mode = 'edit';
			}
			_itemBox.item = _itemBeingEdited;
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
					var title = Zotero.Notes.noteToTitle(notes[i].getNote());
					title = title ? title : Zotero.getString('pane.item.notes.untitled');
					label.setAttribute('value', title);
					label.setAttribute('flex','1');	//so that the long names will flex smaller
					label.setAttribute('crop','end');
				
					var box = document.createElement('box');
					box.setAttribute('onclick',"ZoteroPane.selectItem(" + notes[i].id + ");");
					box.setAttribute('class','zotero-clicky');
					box.appendChild(icon);
					box.appendChild(label);
				
					var removeButton = document.createElement('label');
					removeButton.setAttribute("value","-");
					removeButton.setAttribute("class","zotero-clicky");
					removeButton.setAttribute("onclick","ZoteroItemPane.removeNote(" + notes[i].id + ")");
				
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
					var itemType = '';
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
					box.setAttribute('onclick',"ZoteroPane.selectItem('" + attachments[i].id + "')");
					box.setAttribute('class','zotero-clicky');
					box.appendChild(icon);
					box.appendChild(label);
				
					var removeButton = document.createElement('label');
					removeButton.setAttribute("value","-");
					removeButton.setAttribute("class","zotero-clicky");
					removeButton.setAttribute("onclick","ZoteroItemPane.removeAttachment(" + attachments[i].id + ")");
				
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
			if (mode) {
				_tagsBox.mode = mode;
			}
			else {
				_tagsBox.mode = 'edit';
			}
			
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
	
	
	function removeNote(id)
	{
		var note = Zotero.Items.get(id);
		if(note)
			if(confirm(Zotero.getString('pane.item.notes.delete.confirm')))
				note.erase();
	}
	
	function addNote()
	{
		ZoteroPane.openNoteWindow(null, null, _itemBeingEdited.id);
	}
	
	function _updateNoteCount()
	{
		var c = _notesList.childNodes.length;
		
		var str = 'pane.item.notes.count.';
		switch (c){
			case 0:
				str += 'zero';
				break;
			case 1:
				str += 'singular';
				break;
			default:
				str += 'plural';
				break;
		}
		
		_notesLabel.value = Zotero.getString(str, [c]);
	}
	
	function _updateAttachmentCount()
	{
		var c = _attachmentsList.childNodes.length;
		
		var str = 'pane.item.attachments.count.';
		switch (c){
			case 0:
				str += 'zero';
				break;
			case 1:
				str += 'singular';
				break;
			default:
				str += 'plural';
				break;
		}
		
		_attachmentsLabel.value = Zotero.getString(str, [c]);
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
		ZoteroPane.addAttachmentFromDialog(link, _itemBeingEdited.id);
	}
	
	function addAttachmentFromPage(link)
	{
		ZoteroPane.addAttachmentFromPage(link, _itemBeingEdited.id);
	}
}

addEventListener("load", function(e) { ZoteroItemPane.onLoad(e); }, false);
