/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://digitalscholar.org
    
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

// TODO: Fix import/require related isues that might be
//  related with `require` not reusing the context
var React = require('react');
var ReactDOM = require('react-dom');
var TagsBoxContainer = require('containers/tagsBoxContainer').default;
var NotesList = require('components/itemPane/notesList').default;

var ZoteroContextPane = new function () {
	const HTML_NS = 'http://www.w3.org/1999/xhtml';
	
	var _tabCover;
	var _contextPane;
	var _contextPaneInner;
	var _contextPaneSplitter;
	var _contextPaneSplitterStacked;
	var _itemToggle;
	var _notesToggle;
	var _panesDeck;
	var _itemPaneDeck;
	var _notesPaneDeck;
	
	var _itemToolbar;
	var _splitButton;
	var _itemPaneToggle;
	var _notesPaneToggle;
	var _toolbar;
	var _tabToolbarContainer;
	
	var _itemContexts = [];
	var _notesContexts = [];
	
	// Using attribute instead of propery to set 'selectedIndex'
	// is more reliable
	
	this.update = _update;
	this.getActiveEditor = _getActiveEditor;
	
	this.onLoad = function () {
		if (!Zotero) {
			return;
		}

		_tabCover = document.getElementById('zotero-tab-cover');
		_itemToggle = document.getElementById('zotero-tb-toggle-item-pane');
		_notesToggle = document.getElementById('zotero-tb-toggle-notes-pane');
		_contextPane = document.getElementById('zotero-context-pane');
		_contextPaneInner = document.getElementById('zotero-context-pane-inner');
		_contextPaneSplitter = document.getElementById('zotero-context-splitter');
		_contextPaneSplitterStacked = document.getElementById('zotero-context-splitter-stacked');
		
		_itemToolbar = document.getElementById('zotero-item-toolbar');
		_splitButton = document.getElementById('zotero-tb-split');
		_itemPaneToggle = document.getElementById('zotero-tb-toggle-item-pane');
		_notesPaneToggle = document.getElementById('zotero-tb-toggle-notes-pane');
		_toolbar = document.getElementById('zotero-toolbar');
		_tabToolbarContainer = document.getElementById('zotero-tab-toolbar-container');

		_init();

		this._notifierID = Zotero.Notifier.registerObserver(this, ['item', 'tab'], 'contextPane');
		window.addEventListener('resize', _update);
		_itemToggle.addEventListener('click', _toggleItemButton);
		_notesToggle.addEventListener('click', _toggleNotesButton);
		Zotero.Reader.onChangeSidebarWidth = _updatePaneWidth;
		Zotero.Reader.onChangeSidebarOpen = _updatePaneWidth;
		
		this._mutationObserver = new MutationObserver(() => {
			_updateToolbarWidth();
			// Sometimes XUL is late to reflow
			setTimeout(_updateToolbarWidth, 100);
		});
		this._mutationObserver.observe(_tabToolbarContainer, { attributes: true, childList: true, subtree: true });
	};

	this.onUnload = function () {
		_itemToggle.removeEventListener('click', _toggleItemButton);
		_notesToggle.removeEventListener('click', _toggleNotesButton);
		window.removeEventListener('resize', _update);
		Zotero.Notifier.unregisterObserver(this._notifierID);
		this._mutationObserver.disconnect();
		Zotero.Reader.onChangeSidebarWidth = () => {};
		Zotero.Reader.onChangeSidebarOpen = () => {};
		_contextPaneInner.innerHTML = '';
		_itemContexts = [];
		_notesContexts = [];
	};

	this.notify = Zotero.Promise.coroutine(function* (action, type, ids, extraData) {
		if (type == 'item') {
			// Update, remove or re-create item panes
			for (let context of _itemContexts.slice()) {
				let item = Zotero.Items.get(context.itemID);
				if (!item) {
					_removeItemContext(context.tabID);
				}
				else if (item.parentID != context.parentID) {
					_removeItemContext(context.tabID);
					_addItemContext(context.tabID, context.itemID);
				}
				else {
					context.update();
				}
			}
			
			// Update notes lists for affected libraries
			let libraryIDs = [];
			for (let id of ids) {
				let item = Zotero.Items.get(id);
				if (item && item.isNote()) {
					libraryIDs.push(item.libraryID);
				}
				else if (action == 'delete') {
					libraryIDs.push(extraData[id].libraryID);
				}
			}
			for (let context of _notesContexts) {
				if (libraryIDs.includes(context.libraryID)) {
					context.update();
				}
			}
		}
		else if (type == 'tab') {
			if (action == 'add') {
				_addItemContext(ids[0], extraData[ids[0]].itemID);
			}
			else if (action == 'close') {
				_removeItemContext(ids[0]);
				if (Zotero_Tabs.deck.children.length == 1) {
					_notesContexts.forEach(x => x.notesListRef.current.setExpanded(false));
				}
			}
			else if (action == 'select') {
				if (Zotero_Tabs.selectedIndex == 0) {
					_contextPaneSplitter.setAttribute('hidden', true);
					_contextPane.setAttribute('collapsed', true);
					_toolbar.append(_itemToolbar);
					_itemToolbar.classList.remove('tab-mode');
					_splitButton.classList.add('hidden');
					_tabCover.hidden = true;
				}
				else {
					var reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
					if (reader) {
						_tabCover.hidden = false;
						(async () => {
							await reader._initPromise;
							_tabCover.hidden = true;
						})();

						var attachment = Zotero.Items.get(reader.itemID);
						_selectNotesContext(attachment.libraryID);
						var notesContext = _getNotesContext(attachment.libraryID);
						notesContext.updateFromCache();
					}
				
					_contextPaneSplitter.setAttribute('hidden', false);
					_contextPane.setAttribute('collapsed', !(_contextPaneSplitter.getAttribute('state') != 'collapsed'));
					_tabToolbarContainer.append(_itemToolbar);
					_itemToolbar.classList.add('tab-mode');
					_splitButton.classList.remove('hidden');
				}
				
				_selectItemContext(ids[0]);
				_update();
			}
		}
	});

	function _toggleItemButton() {
		_togglePane(0);
	}

	function _toggleNotesButton() {
		_togglePane(1);
	}
	
	function _removeNote(id) {
		var ps = Components.classes['@mozilla.org/embedcomp/prompt-service;1']
		.getService(Components.interfaces.nsIPromptService);
		if (ps.confirm(null, '', Zotero.getString('pane.item.notes.delete.confirm'))) {
			Zotero.Items.trashTx(id);
		}
	}

	function _getActiveEditor() {
		var splitter;
		if (Zotero.Prefs.get('layout') == 'stacked') {
			splitter = _contextPaneSplitterStacked;
		}
		else {
			splitter = _contextPaneSplitter;
		}

		if (splitter.getAttribute('state') != 'collapsed') {
			if (_panesDeck.selectedIndex == 0) {
				let child = _itemPaneDeck.selectedPanel;
				if (child) {
					var tabPanels = child.querySelector('tabpanels');
					if (tabPanels && tabPanels.selectedIndex == 1) {
						var notesDeck = child.querySelector('.notes-deck');
						if (notesDeck.selectedIndex == 1) {
							return child.querySelector('zoteronoteeditor');
						}
					}
				}
			}
			else {
				var node = _notesPaneDeck.selectedPanel;
				if (node.selectedIndex == 1) {
					return node.querySelector('zoteronoteeditor');
				}
			}
		}
	}

	function _updateAddToNote() {
		var reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
		if (reader) {
			var editor = _getActiveEditor();
			reader.enableAddToNote(!!editor);
		}
	}
	
	function _updatePaneWidth() {
		var stacked = Zotero.Prefs.get('layout') == 'stacked';
		var width = Zotero.Reader.getSidebarWidth() + 'px';
		if (!Zotero.Reader.getSidebarOpen()) {
			width = 0;
		}
		_contextPane.style.left = stacked ? width : 'unset';
	}

	function _updateToolbarWidth() {
		var stacked = Zotero.Prefs.get('layout') == 'stacked';
		var reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
		if (reader) {
			if ((stacked || _contextPaneSplitter.getAttribute('state') == 'collapsed')) {
				reader.setToolbarPlaceholderWidth(_tabToolbarContainer.boxObject.width);
			}
			else {
				reader.setToolbarPlaceholderWidth(0);
			}
		}
	}

	function _update() {
		if (Zotero_Tabs.selectedIndex == 0) {
			return;
		}
	
		var splitter;
		var stacked = Zotero.Prefs.get('layout') == 'stacked';
		if (stacked) {
			_contextPaneSplitterStacked.setAttribute('hidden', false);
			_contextPaneSplitter.setAttribute('state', 'open');
			_contextPaneSplitter.setAttribute('hidden', true);
			_contextPane.classList.add('stacked');
			_contextPane.classList.remove('standard');
			splitter = _contextPaneSplitterStacked;
		}
		else {
			_contextPaneSplitter.setAttribute('hidden', false);
			_contextPaneSplitterStacked.setAttribute('hidden', true);
			_contextPaneSplitterStacked.setAttribute('state', 'open');
			_contextPane.classList.add('standard');
			_contextPane.classList.remove('stacked');
			splitter = _contextPaneSplitter;
		}
		
		var collapsed = splitter.getAttribute('state') == 'collapsed';
		
		var selectedIndex = _panesDeck.selectedIndex;
		if (!collapsed && selectedIndex == 0) {
			_itemPaneToggle.classList.add('toggled');
		}
		else {
			_itemPaneToggle.classList.remove('toggled');
		}

		if (!collapsed && selectedIndex == 1) {
			_notesPaneToggle.classList.add('toggled');
		}
		else {
			_notesPaneToggle.classList.remove('toggled');
		}
		
		if (Zotero_Tabs.selectedIndex > 0) {
			var height = 0;
			if (Zotero.Prefs.get('layout') == 'stacked'
				&& _contextPane.getAttribute('collapsed') != 'true') {
				height = _contextPaneInner.boxObject.height;
			}
			Zotero.Reader.setBottomPlaceholderHeight(height);
		}
		
		_updatePaneWidth();
		_updateToolbarWidth();
		_updateAddToNote();
	}

	function _togglePane(paneIndex) {
		var splitter = Zotero.Prefs.get('layout') == 'stacked'
			? _contextPaneSplitterStacked : _contextPaneSplitter;

		var isOpen = splitter.getAttribute('state') != 'collapsed';
		var hide = false;
		var currentPane = _panesDeck.selectedIndex;
		if (isOpen && currentPane == paneIndex) {
			hide = true;
		}
		else {
			_panesDeck.setAttribute('selectedIndex', paneIndex);
		}
		
		splitter.setAttribute('state', hide ? 'collapsed' : 'open');
		_update();
	}

	function _init() {
		// vbox
		var vbox = document.createElement('vbox');
		vbox.setAttribute('flex', '1');

		_contextPaneInner.append(vbox);

		// Toolbar extension
		var toolbarExtension = document.createElement('box');
		toolbarExtension.style.height = '32px';
		toolbarExtension.id = 'zotero-context-toolbar-extension';
		
		_panesDeck = document.createElement('deck');
		_panesDeck.setAttribute('flex', 1);
		_panesDeck.setAttribute('selectedIndex', 0);

		vbox.append(toolbarExtension, _panesDeck);

		// Item pane deck
		_itemPaneDeck = document.createElement('deck');
		// Notes pane deck
		_notesPaneDeck = document.createElement('deck');
		_notesPaneDeck.style.backgroundColor = 'white';
		_notesPaneDeck.setAttribute('flex', 1);
		_notesPaneDeck.className = 'notes-pane-deck';

		_panesDeck.append(_itemPaneDeck, _notesPaneDeck);
	}
	
	function _getCurrentAttachment() {
		var reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
		if (reader) {
			return Zotero.Items.get(reader.itemID);
		}
	}
	
	function _addNotesContext(libraryID) {
		var list = document.createElement('vbox');
		list.setAttribute('flex', 1);
		list.className = 'zotero-context-notes-list';

		var noteContainer = document.createElement('vbox');
		var title = document.createElement('vbox');
		title.className = 'zotero-context-pane-editor-parent-line';
		var editor = document.createElement('zoteronoteeditor');
		editor.className = 'zotero-context-pane-pinned-note';
		editor.setAttribute('flex', 1);
		noteContainer.append(title, editor);
		
		let contextNode = document.createElement('deck');
		contextNode.append(list, noteContainer);
		_notesPaneDeck.append(contextNode);
		
		contextNode.className = 'context-node';
		contextNode.setAttribute('selectedIndex', 0);
		
		editor.returnHandler = () => {
			contextNode.setAttribute('selectedIndex', 0);
			_updateAddToNote();
		};
		
		var head = document.createElement('hbox');
		head.style.display = 'flex';
		
		async function _createNoteFromAnnotations(child) {
			var attachment = _getCurrentAttachment();
			if (!attachment) {
				return;
			}
			var note = await Zotero.EditorInstance.createNoteFromAnnotations(
				attachment.getAnnotations(), child && attachment.parentID
			);

			_updateAddToNote();

			input.value = '';
			_updateNotesList();

			_setPinnedNote(note.id);
		}

		function _createNote(child) {
			contextNode.setAttribute('selectedIndex', 1);
			var item = new Zotero.Item('note');
			item.libraryID = libraryID;
			if (child) {
				var attachment = _getCurrentAttachment();
				if (!attachment) {
					return;
				}
				item.parentID = attachment.parentID;
			}
			editor.mode = 'edit';
			editor.item = item;
			editor.parentItem = null;
			editor.focus();
			_updateAddToNote();
			
			input.value = '';
			_updateNotesList();
		}

		var vbox = document.createElement('vbox');
		vbox.style.flex = '1';
		var input = document.createElement('textbox');
		input.style.width = 'calc(100% - 42px)';
		input.style.marginLeft = '12px';
		input.setAttribute('type', 'search');
		input.setAttribute('timeout', '250');
		input.addEventListener('command', () => {
			notesListRef.current.setExpanded(false);
			_updateNotesList();
		});
		vbox.append(input);
		
		head.append(vbox);

		var listBox = document.createElement('vbox');
		listBox.style.display = 'flex';
		listBox.setAttribute('flex', '1');
		var listInner = document.createElementNS(HTML_NS, 'div');
		listInner.className = 'notes-list-container';
		listBox.append(listInner);

		list.append(head, listBox);

		var notesListRef = React.createRef();

		async function _updateNotesList(useCached) {
			var query = input.value;
			var notes;
			if (useCached && context.cachedNotes.length) {
				notes = context.cachedNotes;
			}
			else {
				await Zotero.Schema.schemaUpdatePromise;
				var s = new Zotero.Search();
				s.addCondition('libraryID', 'is', libraryID);
				s.addCondition('itemType', 'is', 'note');
				if (query) {
					let parts = Zotero.SearchConditions.parseSearchString(query);
					for (let part of parts) {
						s.addCondition('note', 'contains', part.text);
					}
				}
				notes = await s.search();
				notes = Zotero.Items.get(notes);
				notes.sort((a, b) => {
					a = a.getField('dateModified');
					b = b.getField('dateModified');
					return b.localeCompare(a);
				});
				
				notes = notes.map(note => {
					var parentItem = note.parentItem;
					var text = note.note;
					text = Zotero.Utilities.unescapeHTML(text);
					text = text.trim();
					text = text.slice(0, 500);
					var parts = text.split('\n').map(x => x.trim()).filter(x => x.length);
					var title = parts[0] && parts[0].slice(0, Zotero.Notes.MAX_TITLE_LENGTH);
					var date = Zotero.Date.sqlToDate(note.dateModified);
					date = Zotero.Date.toFriendlyDate(date);
					
					return {
						id: note.id,
						title: title || Zotero.getString('pane.item.notes.untitled'),
						body: parts[1] || '',
						date,
						parentID: note.parentID,
						parentItemType: parentItem && parentItem.itemType,
						parentTitle: parentItem && parentItem.getDisplayTitle()
					};
				});
				context.cachedNotes = notes;
			}

			var attachment = _getCurrentAttachment();
			var parentID = attachment && attachment.parentID;
			notesListRef.current.setHasParent(!!parentID);
			notesListRef.current.setNotes(notes.map(note => ({
				...note,
				isCurrentChild: parentID && note.parentID == parentID
			})));
		}

		var context = {
			libraryID,
			node: contextNode,
			editor,
			notesListRef,
			cachedNotes: [],
			update: Zotero.Utilities.throttle(_updateNotesList, 1000, { leading: false }),
			updateFromCache: () => _updateNotesList(true)
		};
		
		function _handleAddChildNotePopupClick(event) {
			switch (event.originalTarget.id) {
				case 'context-pane-add-child-note':
					_createNote(true);
					break;

				case 'context-pane-add-child-note-from-annotations':
					_createNoteFromAnnotations(true);
					break;

				default:
			}
		}
		
		function _handleAddStandaloneNotePopupClick(event) {
			switch (event.originalTarget.id) {
				case 'context-pane-add-standalone-note':
					_createNote();
					break;

				case 'context-pane-add-standalone-note-from-annotations':
					_createNoteFromAnnotations();
					break;

				default:
			}
		}

		ReactDOM.render(
			<NotesList
				ref={notesListRef}
				onClick={(id) => {
					_setPinnedNote(id);
				}}
				onAddChildButtonDown={(event) => {
					var popup = document.getElementById('context-pane-add-child-note-button-popup');
					popup.onclick = _handleAddChildNotePopupClick;
					popup.openPopup(event.target, 'after_end');
				}}
				onAddStandaloneButtonDown={(event) => {
					var popup = document.getElementById('context-pane-add-standalone-note-button-popup');
					popup.onclick = _handleAddStandaloneNotePopupClick;
					popup.openPopup(event.target, 'after_end');
				}}
			/>,
			listInner,
			() => {
				_updateNotesList();
			}
		);
		_notesContexts.push(context);
		return context;
	}
	
	function _getNotesContext(libraryID) {
		var context = _notesContexts.find(x => x.libraryID == libraryID);
		if (!context) {
			context = _addNotesContext(libraryID);
		}
		return context;
	}
	
	function _selectNotesContext(libraryID) {
		let context = _getNotesContext(libraryID);
		_notesPaneDeck.setAttribute('selectedIndex', Array.from(_notesPaneDeck.children).findIndex(x => x == context.node));
	}
	
	function _removeNotesContext(libraryID) {
		var context = _notesContexts.find(x => x.libraryID == libraryID);
		context.node.remove();
		_notesContexts = _notesContexts.filter(x => x.libraryID != libraryID);
	}
	
	function _isLibraryEditable(libraryID) {
		var type = Zotero.Libraries.get(libraryID).libraryType;
		if (type == 'group') {
			var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
			var group = Zotero.Groups.get(groupID);
			return group.editable;
		}
		return true;
	}

	function _setPinnedNote(itemID) {
		var item = Zotero.Items.get(itemID);
		if (!item) {
			return;
		}
		var editable = _isLibraryEditable(item.libraryID);
		var context = _getNotesContext(item.libraryID);
		if (context) {
			var { editor, node } = context;
			node.setAttribute('selectedIndex', 1);
			editor.mode = editable ? 'edit' : 'view';
			editor.item = item;
			editor.parentItem = null;
			editor.hideLinksContainer = true;
			
			node.querySelector('.zotero-context-pane-editor-parent-line').innerHTML = '';
			var parentItem = item.parentItem;
			if (parentItem) {
				var container = document.createElementNS(HTML_NS, 'div');
				var img = document.createElementNS(HTML_NS, 'img');
				img.src = Zotero.ItemTypes.getImageSrc(parentItem.itemType);
				img.className = 'parent-item-type';
				var title = document.createElementNS(HTML_NS, 'div');
				title.append(parentItem.getDisplayTitle());
				title.className = 'parent-title';
				container.append(img, title);
				node.querySelector('.zotero-context-pane-editor-parent-line').append(container);
			}
			_updateAddToNote();
		}
	}

	function _removeItemContext(tabID) {
		document.getElementById(tabID + '-context').remove();
		_itemContexts = _itemContexts.filter(x => x.tabID != tabID);
	}

	function _selectItemContext(tabID) {
		let selectedIndex = Array.from(_itemPaneDeck.children).findIndex(x => x.id == tabID + '-context');
		if (selectedIndex != -1) {
			_itemPaneDeck.setAttribute('selectedIndex', selectedIndex);
		}
	}

	function _addItemContext(tabID, itemID) {
		var item = Zotero.Items.get(itemID);
		if (!item) {
			return;
		}
		var libraryID = item.libraryID;
		var editable = _isLibraryEditable(libraryID);
		var parentID = item.parentID;
	
		var container = document.createElement('vbox');
		container.id = tabID + '-context';
		container.className = 'zotero-item-pane-content';
		_itemPaneDeck.appendChild(container);
		
		var context = {
			tabID,
			itemID,
			parentID,
			libraryID,
			update: () => {}
		};
		_itemContexts.push(context);
		
		if (!parentID) {
			var vbox = document.createElement('vbox');
			vbox.setAttribute('flex', '1');
			vbox.setAttribute('align', 'center');
			vbox.setAttribute('pack', 'center');
			var description = document.createElement('description');
			vbox.append(description);
			description.append(Zotero.getString('pane.context.noParent'));
			container.append(vbox);
			return;
		}
		var parentItem = Zotero.Items.get(item.parentID);

		// Info pane
		var panelInfo = document.createElement('vbox');
		panelInfo.setAttribute('flex', '1');
		panelInfo.className = 'zotero-editpane-item-box';
		var itemBox = document.createElement('zoteroitembox');
		itemBox.setAttribute('flex', '1');
		panelInfo.append(itemBox);
		container.append(panelInfo);

		itemBox.mode = editable ? 'edit' : 'view';
		itemBox.item = parentItem;
	}
};

addEventListener('load', function (e) { ZoteroContextPane.onLoad(e); }, false);
addEventListener('unload', function (e) { ZoteroContextPane.onUnload(e); }, false);
