/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

var ZoteroItemPane = new function() {
	var _lastItem;
	
	this.onLoad = onLoad;
	
	
	function onLoad()
	{
		if (!Zotero || !Zotero.initialized) {
			return;
		}
		
		// Not in item pane, so skip the introductions
		if (!document.getElementById('zotero-view-tabbox')) {
			return;
		}
		
		_itemBox = document.getElementById('zotero-editpane-item-box');
		_notesLabel = document.getElementById('zotero-editpane-notes-label');
		_notesButton = document.getElementById('zotero-editpane-notes-add');
		_notesList = document.getElementById('zotero-editpane-dynamic-notes');
		_tagsBox = document.getElementById('zotero-editpane-tags');
		_relatedBox = document.getElementById('zotero-editpane-related');
	}
	
	
	/*
	 * Load an item
	 */
	this.viewItem = function (item, mode, index) {
		if (!index) {
			index = 0;
		}
		
		Zotero.debug('Viewing item in pane ' + index);
		
		switch (index) {
			case 0:
				var box = _itemBox;
				break;
			
			case 2:
				var box = _tagsBox;
				break;
			
			case 3:
				var box = _relatedBox;
				break;
		}
		
		// Force blur() when clicking off a textbox to another item in middle
		// pane, since for some reason it's not being called automatically
		if (_lastItem && _lastItem != item) {
			switch (index) {
				case 0:
				case 2:
					box.blurOpenField();
					// DEBUG: Currently broken
					//box.scrollToTop();
					break;
			}
		}
		
		_lastItem = item;
		
		if (index == 1) {
			var editable = ZoteroPane.canEdit();
			_notesButton.hidden = !editable;
			
			while(_notesList.hasChildNodes()) {
				_notesList.removeChild(_notesList.firstChild);
			}
			
			var notes = Zotero.Items.get(item.getNotes());
			if (notes.length) {
				for(var i = 0; i < notes.length; i++) {
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
					
					if (editable) {
						var removeButton = document.createElement('label');
						removeButton.setAttribute("value","-");
						removeButton.setAttribute("class","zotero-clicky");
						removeButton.setAttribute("onclick","ZoteroItemPane.removeNote(" + notes[i].id + ")");
					}
					
					var row = document.createElement('row');
					row.appendChild(box);
					if (editable) {
						row.appendChild(removeButton);
					}
					
					_notesList.appendChild(row);
				}
			}
			
			_updateNoteCount();
			return;
		}
		
		if (mode) {
			box.mode = mode;
		}
		else {
			box.mode = 'edit';
		}
		box.item = item;
	}
	
	
	this.addNote = function (popup) {
		ZoteroPane.newNote(popup, _lastItem.id);
	}
	
	
	this.removeNote = function (id) {
		var note = Zotero.Items.get(id);
		var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
						.createInstance(Components.interfaces.nsIPrompt);
		if (note && pr.confirm('', Zotero.getString('pane.item.notes.delete.confirm'))) {
			note.erase();
		}
	}
	
	
	function _updateNoteCount() {
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
}   

addEventListener("load", function(e) { ZoteroItemPane.onLoad(e); }, false);
