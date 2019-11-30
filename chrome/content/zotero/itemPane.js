/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

import React from 'react';
import ReactDOM from 'react-dom';
import TagsBoxContainer from 'containers/tagsBoxContainer';

var ZoteroItemPane = new function() {
	var _lastItem, _itemBox, _notesLabel, _notesButton, _notesList, _tagsBox, _relatedBox;
	var _selectedNoteID;
	var _translationTarget;
	var _noteIDs;
	
	this.onLoad = function () {
		if (!Zotero) {
			return;
		}
		
		// Not in item pane, so skip the introductions
		//
		// DEBUG: remove?
		if (!document.getElementById('zotero-view-tabbox')) {
			return;
		}
		
		_itemBox = document.getElementById('zotero-editpane-item-box');
		_notesLabel = document.getElementById('zotero-editpane-notes-label');
		_notesButton = document.getElementById('zotero-editpane-notes-add');
		_notesList = document.getElementById('zotero-editpane-dynamic-notes');
		// Fake a ref
		_tagsBox = {
			current: null
		};
		_relatedBox = document.getElementById('zotero-editpane-related');
		
		this._unregisterID = Zotero.Notifier.registerObserver(this, ['item'], 'itemPane');
	}
	
	
	this.onUnload = function () {
		Zotero.Notifier.unregisterObserver(this._unregisterID);
	},
	
	
	/*
	 * Load a top-level item
	 */
	this.viewItem = Zotero.Promise.coroutine(function* (item, mode, index) {
		if (!index) {
			index = 0;
		}
		
		Zotero.debug('Viewing item in pane ' + index);
		
		switch (index) {
			case 0:
				var box = _itemBox;
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
					yield box.blurOpenField();
					// DEBUG: Currently broken
					//box.scrollToTop();
					break;
				
				case 2:
					_tagsBox.current.blurOpenField();
					break;
			}
		}
		
		_lastItem = item;
		
		var viewBox = document.getElementById('zotero-view-item');
		viewBox.classList.remove('no-tabs');
		
		if (index == 0) {
			document.getElementById('zotero-editpane-tabs').setAttribute('hidden', item.isFeedItem);
			
			if (item.isFeedItem) {
				viewBox.classList.add('no-tabs');
				
				let lastTranslationTarget = Zotero.Prefs.get('feeds.lastTranslationTarget');
				if (lastTranslationTarget) {
					let id = parseInt(lastTranslationTarget.substr(1));
					if (lastTranslationTarget[0] == "L") {
						_translationTarget = Zotero.Libraries.get(id);
					}
					else if (lastTranslationTarget[0] == "C") {
						_translationTarget = Zotero.Collections.get(id);
					}
				}
				if (!_translationTarget) {
					_translationTarget = Zotero.Libraries.userLibrary;
				}	
				this.setTranslateButton();
			}
		}
		else if (index == 1) {
			var editable = ZoteroPane_Local.canEdit();
			_notesButton.hidden = !editable;
			
			while(_notesList.hasChildNodes()) {
				_notesList.removeChild(_notesList.firstChild);
			}
			
			_noteIDs = new Set();
			let notes = yield Zotero.Items.getAsync(item.getNotes());
			if (notes.length) {
				for (var i = 0; i < notes.length; i++) {
					let note = notes[i];
					let id = notes[i].id;
					
					var icon = document.createElement('image');
					icon.className = "zotero-box-icon";
					icon.setAttribute('src', `chrome://zotero/skin/treeitem-note${Zotero.hiDPISuffix}.png`);
					
					var label = document.createElement('label');
					label.className = "zotero-box-label";
					var title = note.getNoteTitle();
					title = title ? title : Zotero.getString('pane.item.notes.untitled');
					label.setAttribute('value', title);
					label.setAttribute('flex','1');	//so that the long names will flex smaller
					label.setAttribute('crop','end');
					
					var box = document.createElement('box');
					box.setAttribute('class','zotero-clicky');
					box.addEventListener('click', function () { ZoteroPane_Local.selectItem(id); });
					box.appendChild(icon);
					box.appendChild(label);
					
					if (editable) {
						var removeButton = document.createElement('label');
						removeButton.setAttribute("value","-");
						removeButton.setAttribute("class","zotero-clicky zotero-clicky-minus");
						removeButton.addEventListener('click', function () { ZoteroItemPane.removeNote(id); });
					}
					
					var row = document.createElement('row');
					row.appendChild(box);
					if (editable) {
						row.appendChild(removeButton);
					}
					
					_notesList.appendChild(row);
					_noteIDs.add(id);
				}
			}
			
			_updateNoteCount();
			return;
		}
		else if (index == 2) {
			ReactDOM.render(
				<TagsBoxContainer
					key={"tagsBox-" + item.id}
					item={item}
					editable={mode != 'view'}
					ref={_tagsBox}
					onResetSelection={focusItemsList}
				/>,
				document.getElementById('tags-box-container'),
				() => ZoteroPane.updateTagsBoxSize()
			);
		}
		
		if (box) {
			if (mode) {
				box.mode = mode;
				
				if (box.mode == 'view') {
					box.hideEmptyFields = true;
				}
			}
			else {
				box.mode = 'edit';
			}
			
			box.item = item;
		}
	});
	
	
	this.notify = Zotero.Promise.coroutine(function* (action, type, ids, extraData) {
		var viewBox = document.getElementById('zotero-view-item');
		// If notes pane is selected, refresh it if any of the notes change or are deleted
		if (viewBox.selectedIndex == 1 && (action == 'modify' || action == 'delete')) {
			let refresh = false;
			if (ids.some(id => _noteIDs.has(id))) {
				refresh = true;
			}
			if (refresh) {
				yield this.viewItem(_lastItem, null, 1);
			}
		}
	});
	
	
	this.blurOpenField = Zotero.Promise.coroutine(function* () {
		var tabBox = document.getElementById('zotero-view-tabbox');
		switch (tabBox.selectedIndex) {
		case 0:
			var box = _itemBox;
			if (box) {
				yield box.blurOpenField();
			}
			break;
			
		case 2:
			var box = _tagsBox.current;
			if (box) {
				box.blurOpenField();
			}
			break;
		}
	});
	
	
	function focusItemsList() {
		var tree = document.getElementById('zotero-items-tree');
		if (tree) {
			tree.focus();
		}
	}
	
	
	this.onNoteSelected = function (item, editable) {
		_selectedNoteID = item.id;
		
		// If an external note window is open for this item, don't show the editor
		if (ZoteroPane.findNoteWindow(item.id)) {
			this.showNoteWindowMessage();
			return;
		}
		
		var noteEditor = document.getElementById('zotero-note-editor');
		
		// If loading new or different note, disable undo while we repopulate the text field
		// so Undo doesn't end up clearing the field. This also ensures that Undo doesn't
		// undo content from another note into the current one.
		var clearUndo = noteEditor.item ? noteEditor.item.id != item.id : false;
		
		noteEditor.mode = editable ? 'edit' : 'view';
		noteEditor.parent = null;
		noteEditor.item = item;
		
		if (clearUndo) {
			noteEditor.clearUndo();
		}
		
		document.getElementById('zotero-view-note-button').hidden = !editable;
		document.getElementById('zotero-item-pane-content').selectedIndex = 2;
	};
	
	
	this.showNoteWindowMessage = function () {
		ZoteroPane.setItemPaneMessage(Zotero.getString('pane.item.notes.editingInWindow'));
	};
	
	
	/**
	 * Select the parent item and open the note editor
	 */
	this.openNoteWindow = async function () {
		var selectedNote = Zotero.Items.get(_selectedNoteID);
		
		// We don't want to show the note in two places, since it causes unnecessary UI updates
		// and can result in weird bugs where note content gets lost.
		//
		// If this is a child note, select the parent
		if (selectedNote.parentID) {
			await ZoteroPane.selectItem(selectedNote.parentID);
		}
		// Otherwise, hide note and replace with a message that we're editing externally
		else {
			this.showNoteWindowMessage();
		}
		ZoteroPane.openNoteWindow(selectedNote.id);
	};
	
	
	this.addNote = function (popup) {
		ZoteroPane_Local.newNote(popup, _lastItem.key);
	}
	
	
	this.removeNote = function (id) {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		if (ps.confirm(null, '', Zotero.getString('pane.item.notes.delete.confirm'))) {
			Zotero.Items.trashTx(id);
		}
	}
	
	
	this.onTagsContextPopupShowing = function () {
		if (!_lastItem.isEditable()) {
			return false;
		}
	}
	
	
	this.removeAllTags = async function () {
		if (Services.prompt.confirm(null, "", Zotero.getString('pane.item.tags.removeAll'))) {
			_lastItem.setTags([]);
			await _lastItem.saveTx();
		}
	}
	
	
	this.translateSelectedItems = Zotero.Promise.coroutine(function* () {
		var collectionID = _translationTarget.objectType == 'collection' ? _translationTarget.id : undefined;
		var items = ZoteroPane_Local.itemsView.getSelectedItems();
		for (let item of items) {
			yield item.translate(_translationTarget.libraryID, collectionID);
		}
	});
	
	
	this.buildTranslateSelectContextMenu = function (event) {
		var menu = document.getElementById('zotero-item-addTo-menu');
		// Don't trigger rebuilding on nested popupmenu open/close
		if (event.target != menu) {
			return;
		}
		// Clear previous items
		while (menu.firstChild) {
			menu.removeChild(menu.firstChild);
		}
		
		let target = Zotero.Prefs.get('feeds.lastTranslationTarget');
		if (!target) {
			target = "L" + Zotero.Libraries.userLibraryID;
		}
		
		var libraries = Zotero.Libraries.getAll();
		for (let library of libraries) {
			if (!library.editable || library.libraryType == 'publications') {
				continue;
			}
			Zotero.Utilities.Internal.createMenuForTarget(
				library,
				menu,
				target,
				function(event, libraryOrCollection) {
					if (event.target.tagName == 'menu') {
						Zotero.Promise.coroutine(function* () {
							// Simulate menuitem flash on OS X
							if (Zotero.isMac) {
								event.target.setAttribute('_moz-menuactive', false);
								yield Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', true);
								yield Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', false);
								yield Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', true);
							}
							menu.hidePopup();
							
							ZoteroItemPane.setTranslationTarget(libraryOrCollection);
							event.stopPropagation();
						})();
					}
					else {
						ZoteroItemPane.setTranslationTarget(libraryOrCollection);
						event.stopPropagation();
					}
				}
			);
		}
	};
	
	
	this.setTranslateButton = function() {
		var label = Zotero.getString('pane.item.addTo', _translationTarget.name);
		var elem = document.getElementById('zotero-feed-item-addTo-button');
		elem.setAttribute('label', label);

		var key = Zotero.Keys.getKeyForCommand('saveToZotero');
		
		var tooltip = label 
			+ (Zotero.rtl ? ' \u202B' : ' ') + '(' 
			+ (Zotero.isMac ? '⇧⌘' : Zotero.getString('general.keys.ctrlShift'))
			+ key + ')';
		elem.setAttribute('tooltiptext', tooltip);
		elem.setAttribute('image', _translationTarget.treeViewImage);
	};
	

	this.setTranslationTarget = function(translationTarget) {
		_translationTarget = translationTarget;
		Zotero.Prefs.set('feeds.lastTranslationTarget', translationTarget.treeViewID);
		ZoteroItemPane.setTranslateButton();
	};
	
	
	this.setReadLabel = function (isRead) {
		var elem = document.getElementById('zotero-feed-item-toggleRead-button');
		var label = Zotero.getString('pane.item.' + (isRead ? 'markAsUnread' : 'markAsRead'));
		elem.setAttribute('label', label);

		var key = Zotero.Keys.getKeyForCommand('toggleRead');
		var tooltip = label + (Zotero.rtl ? ' \u202B' : ' ') + '(' + key + ')'
		elem.setAttribute('tooltiptext', tooltip);
	};
	
	
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
addEventListener("unload", function(e) { ZoteroItemPane.onUnload(e); }, false);
