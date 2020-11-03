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
import NotesList from 'components/itemPane/notesList';

var ZoteroItemPane = new function() {
	var _lastItem, _itemBox, _notesLabel, _notesButton, _notesList, _tagsBox, _relatedBox;
	var _selectedNoteID;
	var _translationTarget;
	var _noteIDs;
	var _contextNoteUpdaters = [];
	let _pdfTabHidden = false;
	
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
		
		this._unregisterID = Zotero.Notifier.registerObserver(this, ['item', 'tab'], 'itemPane');

		document.getElementById('temp-toggle-1').addEventListener('click', () => {
			this.togglePane();
		});
		document.getElementById('temp-toggle-2').addEventListener('click', () => {
			this.togglePane();
		});
		this.initStandaloneNotesView();
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
		if(type == 'item') {
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
			this.updateStandaloneNotesList();
			for (let updater of _contextNoteUpdaters) {
				updater.callback();
			}
		}
		else if (type == 'tab') {
			if (action == 'add') {
				this.addPDFTabContext(ids[0], extraData.itemID);
			}
			else if (action == 'close') {
				this.removeTabContext(ids[0]);
			}
			else if (action == 'select') {
				this.selectTabContext(ids[0], extraData.type);
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
		// if (ZoteroPane.findNoteWindow(item.id)) {
		// 	this.showNoteWindowMessage();
		// 	return;
		// }
		
		var noteEditor = document.getElementById('zotero-note-editor');
		
		// If loading new or different note, disable undo while we repopulate the text field
		// so Undo doesn't end up clearing the field. This also ensures that Undo doesn't
		// undo content from another note into the current one.
		// var clearUndo = noteEditor.item ? noteEditor.item.id != item.id : false;
		
		noteEditor.mode = editable ? 'edit' : 'view';
		noteEditor.parent = null;
		noteEditor.item = item;
		
		// if (clearUndo) {
		// 	noteEditor.clearUndo();
		// }
		
		document.getElementById('zotero-view-note-sidebar-button').hidden = !!item.parentID;
		document.getElementById('zotero-view-note-button').hidden = !editable;
		document.getElementById('zotero-item-pane-content').selectedIndex = 2;
	};
	
	
	this.showNoteWindowMessage = function () {
		// ZoteroPane.setItemPaneMessage(Zotero.getString('pane.item.notes.editingInWindow'));
	};
	
	this.openNoteSidebar = async function () {
		var selectedNote = Zotero.Items.get(_selectedNoteID);

		if (!selectedNote.parentID) {
			let editor = document.getElementById('zotero-item-pane-pinned-note');
			editor.mode = 'edit';
			editor.item = selectedNote;
			document.getElementById('zotero-item-pane-pin-deck2').setAttribute('selectedIndex', 1);
			this.togglePane(false);
		}
	}
	
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

	this.getActiveNote = function () {
		let mainDeck = document.getElementById('zotero-item-pane-main-deck');
		if (mainDeck.selectedIndex == 0) {
			let contextualDeck = document.getElementById('zotero-item-pane-contextual-deck');
			if (contextualDeck.selectedIndex > 0) {
				let child = contextualDeck.children[contextualDeck.selectedIndex];
				if (child.querySelector('deck').selectedIndex == 1) {
					return child.querySelector('zoteronoteeditor');
				}
			}
		}
		else {
			let pinnedDeck = document.getElementById('zotero-item-pane-pin-deck2');
			if (pinnedDeck.selectedIndex == 1) {
				return pinnedDeck.querySelector('zoteronoteeditor');
			}
		}
		return null;
	}

	this.togglePane = function (forceItem) {
		let mainDeck = document.getElementById('zotero-item-pane-main-deck');
		let value;
		if (forceItem !== undefined) {
			value = forceItem ? 0 : 1;
		}
		else {
			value = mainDeck.selectedIndex == 0 ? 1 : 0;
		}

		document.getElementById('temp-toggle-1').firstChild.remove();
		document.getElementById('temp-toggle-2').firstChild.remove();
		if (value == 0) {
			document.getElementById('temp-toggle-1').append('■ □');
			document.getElementById('temp-toggle-2').append('■ □');
		}
		else {
			document.getElementById('temp-toggle-1').append('□ ■');
			document.getElementById('temp-toggle-2').append('□ ■');
		}

		mainDeck.selectedIndex = value;

		let contextualDeck = document.getElementById('zotero-item-pane-contextual-deck');
		contextualDeck.children[contextualDeck.selectedIndex].setAttribute('state', value);
	}

	this.initStandaloneNotesView = async function () {
		let container = document.getElementById('zotero-item-pane-pin-deck');

		let bar = document.createElement('hbox');
		container.appendChild(bar);
		let inner = document.createElement('deck');
		inner.id = 'zotero-item-pane-pin-deck2';
		inner.style.backgroundColor = 'white';
		inner.setAttribute('flex', 1);
		container.appendChild(inner);

		let returnButton = document.createElement('toolbarbutton');
		returnButton.className = 'zotero-tb-button';
		returnButton.id = 'zotero-tb-return';
		returnButton.style.listStyleImage = 'url(\'chrome://zotero/skin/citation-delete.png\')'
		returnButton.addEventListener('click', () => {
			inner.setAttribute('selectedIndex', 0);
		});


		bar.append(returnButton, 'Standalone Notes');
		bar.style.overflowX = 'hidden';
		bar.style.textOverflow = 'ellipsis';
		bar.style.fontWeight = 'bold';


		let list = document.createElement('vbox');
		list.setAttribute('flex', 1);
		list.className = 'zotero-box';


		let note = document.createElement('zoteronoteeditor');
		note.id = 'zotero-item-pane-pinned-note';
		note.setAttribute('flex', 1);
		inner.appendChild(list);
		inner.appendChild(note);

		inner.setAttribute('selectedIndex', 0);


		let head = document.createElement('hbox');
		let label = document.createElement('label');
		let button = document.createElement('button');
		button.setAttribute('label', Zotero.Intl.strings['zotero.item.add']);
		button.addEventListener('click', async () => {
			inner.setAttribute('selectedIndex', 1);
			let item = new Zotero.Item('note');
			item.libraryID = ZoteroPane_Local.getSelectedLibraryID();
			// item.parentKey = parentItem.key;
			note.mode = 'edit';
			note.item = item;
			note.parentItem = null;
			note.focus();
		});
		
		head.style.paddingRight = '10px';


		let input = document.createElement('textbox');
		input.setAttribute('type', 'search');
		input.setAttribute('timeout', '250');
		
		input.addEventListener('command', (event) => {
			_updateStandaloneNotesList();
		})


		let vbox1 = document.createElement('vbox');
		vbox1.append(label, button);

		let vbox2 = document.createElement('vbox');
		vbox2.append(input);

		head.append(vbox2, vbox1);

		head.style.display = 'flex';
		vbox2.style.flex = '1';
		
		
		let listBox = document.createElement('vbox');
		listBox.style.display = 'flex';
		listBox.setAttribute('flex', '1')

		const HTML_NS = 'http://www.w3.org/1999/xhtml';
		var listInner = document.createElementNS(HTML_NS, 'div');
		listInner.className = 'notes-list-container';
		list.append(head, listBox);
		
		listBox.append(listInner);
		
		let noteListRef = React.createRef();
		
		let _updateStandaloneNotesList = async (reset) => {
			if (reset) {
				input.value = '';
				inner.setAttribute('selectedIndex', 0);
			}
			let text = input.value;

			await Zotero.Schema.schemaUpdatePromise;
			var s = new Zotero.Search();
			s.addCondition('libraryID', 'is', ZoteroPane_Local.getSelectedLibraryID());
			s.addCondition('itemType', 'is', 'note');
			s.addCondition('noChildren', 'true');
			if (text) {
				s.addCondition('note', 'contains', text, true);
			}
			let notes = await s.search();
			notes = Zotero.Items.get(notes);
			notes.sort((a, b) => {
				a = a.getField('dateModified');
				b = b.getField('dateModified');
				return b.localeCompare(a);
			});
			
			noteListRef.current.setNotes(notes.map(note => {
				let text2 = note.note;
				text2 = text2.trim();
				// TODO: Fix a potential performance issuse
				text2 = Zotero.Utilities.unescapeHTML(text2);
				let parts = text2.split('\n').map(x => x.trim()).filter(x => x.length);
				return {
					id: note.id,
					title: parts[0] || Zotero.getString('pane.item.notes.untitled'),
					body: parts[1] || '',
					date: (new Date(note.dateModified).toLocaleDateString(Zotero.locale))
				};
			}));

			var c = notes.length;
			var str = 'pane.item.notes.count.' + (c == 0 && 'zero' || c == 1 && 'singular' || 'plural');
			label.value = Zotero.getString(str, [c]);
		}

		ReactDOM.render(
			<NotesList
				ref={noteListRef}
				onClick={(id) => {
					this._setPinnedNote(id);
				}}
			/>,
			listInner,
			() => {
				_updateStandaloneNotesList();
			}
		);


		this.updateStandaloneNotesList = _updateStandaloneNotesList;
	}

	this._setPinnedNote = function (itemID) {
		let pinnedDeck = document.getElementById('zotero-item-pane-pin-deck2');
		pinnedDeck.setAttribute('selectedIndex', 1);
		let pinnedNote = document.getElementById('zotero-item-pane-pinned-note');
		pinnedNote.mode = 'edit';
		pinnedNote.item = Zotero.Items.get(itemID);
		pinnedNote.parentItem = null;
		this.togglePane(false);
	}

	this._appendNoteRows = function (notes, list, editable, onClick, onDelete) {
		for (var i = 0; i < notes.length; i++) {
			let note = notes[i];
			let id = notes[i].id;

			var icon = document.createElement('image');
			icon.className = 'zotero-box-icon';
			icon.setAttribute('src', `chrome://zotero/skin/treeitem-note${Zotero.hiDPISuffix}.png`);

			var label = document.createElement('label');
			label.className = 'zotero-box-label';
			var title = note.getNoteTitle();
			title = title ? title : Zotero.getString('pane.item.notes.untitled');
			label.setAttribute('value', title);
			label.setAttribute('flex', '1');	//so that the long names will flex smaller
			label.setAttribute('crop', 'end');

			var box = document.createElement('box');
			box.setAttribute('class', 'zotero-clicky');
			box.addEventListener('click', () => {
				onClick(id);
			});
			box.appendChild(icon);
			box.appendChild(label);

			if (editable) {
				var removeButton = document.createElement('label');
				removeButton.setAttribute('value', '-');
				removeButton.setAttribute('class', 'zotero-clicky zotero-clicky-minus');
				removeButton.addEventListener('click', function () {
					onDelete(id)
				});
			}

			var row = document.createElement('row');
			row.appendChild(box);
			if (editable) {
				row.appendChild(removeButton);
			}

			list.appendChild(row);
		}
	}

	this.removeTabContext = function (tabID) {
		document.getElementById(tabID + '-context').remove();
		_contextNoteUpdaters = _contextNoteUpdaters.filter(x => x.tabID != tabID);
	};
	
	this.selectTabContext = function (tabID, type) {
		let contextualDeck = document.getElementById('zotero-item-pane-contextual-deck');
		let prevIndex = contextualDeck.selectedIndex;
		contextualDeck.selectedIndex = Array.from(contextualDeck.children).findIndex(x => x.id == tabID + '-context');

		let toolbar = document.getElementById('zotero-pane-horizontal-space');
		let extendedToolbar = document.getElementById('zotero-item-pane-padding-top');
		let itemPane = document.getElementById('zotero-item-pane');

		if (prevIndex != 0) {
			_pdfTabHidden = itemPane.hidden;
		}

		if (type == 'library') {
			toolbar.hidden = false;
			extendedToolbar.hidden = true;
			itemPane.hidden = false;
		}
		else {
			toolbar.hidden = true;
			extendedToolbar.hidden = false;
			itemPane.hidden = _pdfTabHidden;
		}

		let state = contextualDeck.children[contextualDeck.selectedIndex].getAttribute('state');
		let mainDeck = document.getElementById('zotero-item-pane-main-deck');
		document.getElementById('temp-toggle-1').firstChild.remove();
		document.getElementById('temp-toggle-2').firstChild.remove();
		if (state == 0) {
			document.getElementById('temp-toggle-1').append('■ □');
			document.getElementById('temp-toggle-2').append('■ □');
			mainDeck.selectedIndex = state;
		}
		else if (state == 1) {
			document.getElementById('temp-toggle-1').append('□ ■');
			document.getElementById('temp-toggle-2').append('□ ■');
			mainDeck.selectedIndex = state;
		}
	};


	this.addPDFTabContext = function (tabID, itemID) {
		let contextualDeck = document.getElementById('zotero-item-pane-contextual-deck');

		let container = document.createElement('vbox');
		container.id = tabID + '-context';
		container.className = 'zotero-item-pane-content';
		contextualDeck.appendChild(container);

		var item = Zotero.Items.get(itemID);
		if (!item.parentID) {
			container.append('The PDF doesn\'t have a parent');
			return;
		}

		let parentID = item.parentID;

		let mainDeck = document.getElementById('zotero-item-pane-main-deck');
		let pinDeck = document.getElementById('zotero-item-pane-pin-deck2');
		container.setAttribute('state', (mainDeck.selectedIndex == 1 && pinDeck.selectedIndex == 1) ? 1 : 0)


		let parentItem = Zotero.Items.get(parentID);

		let tabbox = document.createElement('tabbox');
		tabbox.setAttribute('flex', '1');
		tabbox.className = 'zotero-view-tabbox';
		let tabs = document.createElement('tabs');
		tabs.className = 'zotero-editpane-tabs';

		container.append(tabbox);


		let tabInfo = document.createElement('tab');
		tabInfo.setAttribute('label', Zotero.Intl.strings['zotero.tabs.info.label']);
		let tabNotes = document.createElement('tab');
		tabNotes.setAttribute('label', Zotero.Intl.strings['zotero.tabs.notes.label']);
		let tabTags = document.createElement('tab');
		tabTags.setAttribute('label', Zotero.Intl.strings['zotero.tabs.tags.label']);
		let tabRelated = document.createElement('tab');
		tabRelated.setAttribute('label', Zotero.Intl.strings['zotero.tabs.related.label']);
		tabs.append(tabInfo, tabNotes, tabTags, tabRelated);

		let tabpanels = document.createElement('tabpanels');
		tabpanels.setAttribute('flex', '1');
		tabpanels.className = 'zotero-view-item';

		tabbox.append(tabs, tabpanels);

		let panelInfo = document.createElement('tabpanel');
		panelInfo.setAttribute('flex', '1')
		panelInfo.className = 'zotero-editpane-item-box';
		let itemBox = document.createElement('zoteroitembox');
		itemBox.setAttribute('flex', '1');
		panelInfo.append(itemBox);

		let panelNotes = document.createElement('tabpanel');
		panelNotes.setAttribute('flex', '1');
		panelNotes.setAttribute('orient', 'vertical');

		var deck = document.createElement('deck');
		deck.setAttribute('flex', '1');

		panelNotes.append(deck);

		var vbox2 = document.createElement('vbox');


		let returnButton = document.createElement('toolbarbutton');
		returnButton.className = 'zotero-tb-button';
		returnButton.id = 'zotero-tb-return';
		returnButton.style.listStyleImage = 'url(\'chrome://zotero/skin/citation-delete.png\')'
		returnButton.addEventListener('click', () => {
			deck.setAttribute('selectedIndex', 0);
		});

		var bar = document.createElement('hbox')
		bar.append(returnButton, 'Child Notes');
		bar.style.overflowX = 'hidden';
		bar.style.textOverflow = 'ellipsis';
		bar.style.fontWeight = 'bold';

		let note = document.createElement('zoteronoteeditor');

		note.setAttribute('flex', 1);

		vbox2.append(bar, note);


		var vbox = document.createElement('vbox');
		vbox.setAttribute('flex', '1');
		vbox.setAttribute('class', 'zotero-box');
		panelNotes.append(vbox);

		var hbox = document.createElement('hbox');
		hbox.setAttribute('align', 'center');

		var label = document.createElement('label');
		var button = document.createElement('button');
		button.setAttribute('label', Zotero.Intl.strings['zotero.item.add']);
		button.addEventListener('click', () => {
			deck.setAttribute('selectedIndex', 1);
			let item = new Zotero.Item('note');
			item.libraryID = parentItem.libraryID;
			item.parentItemID = parentItem.id;
			note.mode = 'edit';
			note.item = item;
			note.focus();
		});
		hbox.append(label, button);

		var grid = document.createElement('grid');
		grid.setAttribute('flex', 1);
		var columns = document.createElement('columns');
		var column = document.createElement('column');
		column.setAttribute('flex', 1);
		columns.append(column);
		var column = document.createElement('column');
		columns.append(column);
		grid.append(columns);
		var rows = document.createElement('rows');
		rows.setAttribute('flex', 1);
		grid.append(rows);

		vbox.append(hbox, grid);

		deck.append(vbox, vbox2);

		deck.setAttribute('selectedIndex', 0);
		deck.className = 'zotero-item-pane-content';


		let panelTags = document.createElement('tabpanel');
		panelTags.setAttribute('orient', 'vertical');
		panelTags.setAttribute('context', 'tags-context-menu');
		panelTags.className = 'tags-pane';
		panelTags.style.display = 'flex';
		const HTML_NS = 'http://www.w3.org/1999/xhtml';
		var div = document.createElementNS(HTML_NS, 'div');
		div.className = 'tags-box-container';
		div.style.display = 'flex';
		div.style.flexGrow = '1';
		panelTags.append(div);

		let panelRelated = document.createElement('tabpanel');
		let relatedBox = document.createElement('relatedbox');
		relatedBox.setAttribute('flex', '1');
		relatedBox.className = 'zotero-editpane-related';
		panelRelated.append(relatedBox);

		tabpanels.append(panelInfo, panelNotes, panelTags, panelRelated);

		itemBox.mode = 'edit';
		itemBox.item = Zotero.Items.get(parentID);

		relatedBox.mode = 'edit';
		relatedBox.item = parentItem;

		panelRelated.addEventListener('click', (event) => {
			if (event.originalTarget.closest('.zotero-clicky')) {
				Zotero_Tabs.select('zotero-pane');
			}
		});

		let _renderNotesPanel = () => {
			while (rows.firstChild) {
				rows.firstChild.remove();
			}

			let parentNotes = Zotero.Items.get(parentItem.getNotes());
			this._appendNoteRows(parentNotes, rows, true, (id) => {
				deck.setAttribute('selectedIndex', 1);
				note.mode = 'edit';
				note.item = Zotero.Items.get(id);
				note.parentItem = null;
			}, (id) => {
				ZoteroItemPane.removeNote(id);
			});

			var c = parentNotes.length;
			var str = 'pane.item.notes.count.' + (c == 0 && 'zero' || c == 1 && 'singular' || 'plural');
			label.value = Zotero.getString(str, [c]);
		}

		_contextNoteUpdaters.push({
			tabID,
			callback: _renderNotesPanel
		});

		_renderNotesPanel();

		let mode = 'edit';

		let _tagsBox = { current: null };
		let focusItemsList = false;

		let _renderTagsPanel = () => {
			ReactDOM.render(
				<TagsBoxContainer
					key={'tagsBox-' + parentItem.id}
					item={parentItem}
					editable={mode != 'view'}
					ref={_tagsBox}
					onResetSelection={focusItemsList}
				/>,
				div
			);
		}

		_renderTagsPanel();
	}
}   

addEventListener("load", function(e) { ZoteroItemPane.onLoad(e); }, false);
addEventListener("unload", function(e) { ZoteroItemPane.onUnload(e); }, false);
