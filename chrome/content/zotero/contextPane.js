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

var ZoteroContextPane = new function () {
	var _tabCover;
	var _contextPane;
	var _contextPaneInner;
	var _contextPaneSplitter;
	var _contextPaneSplitterStacked;
	var _sidenav;
	var _panesDeck;
	var _itemPaneDeck;
	var _notesPaneDeck;
	
	var _itemContexts = [];
	var _notesContexts = [];

	var _globalDeckIndex = [];
	var _preventGlobalDeckChange = false;

	// Using attribute instead of property to set 'selectedIndex'
	// is more reliable
	
	this.update = _update;
	this.getActiveEditor = _getActiveEditor;
	this.focus = _focus;
	this.togglePane = _togglePane;

	this.init = function () {
		if (!Zotero) {
			return;
		}

		_tabCover = document.getElementById('zotero-tab-cover');
		_contextPane = document.getElementById('zotero-context-pane');
		_contextPaneInner = document.getElementById('zotero-context-pane-inner');
		_contextPaneSplitter = document.getElementById('zotero-context-splitter');
		_contextPaneSplitterStacked = document.getElementById('zotero-context-splitter-stacked');
		_sidenav = document.getElementById('zotero-context-pane-sidenav');
		
		_panesDeck = document.createXULElement('deck');
		_panesDeck.setAttribute('flex', 1);
		_panesDeck.setAttribute('selectedIndex', 0);
		_panesDeck.classList = "zotero-context-panes-deck";

		_contextPaneInner.append(_panesDeck);

		// Item pane deck
		_itemPaneDeck = document.createXULElement('deck');
		// Notes pane deck
		_notesPaneDeck = document.createXULElement('deck');
		_notesPaneDeck.setAttribute('flex', 1);
		_notesPaneDeck.className = 'notes-pane-deck';

		_panesDeck.append(_itemPaneDeck, _notesPaneDeck);

		_sidenav.contextNotesPane = _notesPaneDeck;

		this._notifierID = Zotero.Notifier.registerObserver(this, ['item', 'tab'], 'contextPane');
		window.addEventListener('resize', _update);
		Zotero.Reader.onChangeSidebarWidth = _updatePaneWidth;
		Zotero.Reader.onToggleSidebar = _updatePaneWidth;
		_contextPaneInner.addEventListener("keypress", ZoteroPane.itemPane._itemDetails.handleKeypress);
	};

	this.destroy = function () {
		window.removeEventListener('resize', _update);
		_contextPaneInner.removeEventListener("keypress", ZoteroPane.itemPane._itemDetails.handleKeypress);
		Zotero.Notifier.unregisterObserver(this._notifierID);
		Zotero.Reader.onChangeSidebarWidth = () => {};
		Zotero.Reader.onToggleSidebar = () => {};
		_contextPaneInner.innerHTML = '';
		_itemContexts = [];
		_notesContexts = [];
	};

	this.notify = function (action, type, ids, extraData) {
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
				if (item && (item.isNote() || item.isRegularItem())) {
					libraryIDs.push(item.libraryID);
				}
				else if (action == 'delete') {
					libraryIDs.push(extraData[id].libraryID);
				}
			}
			for (let context of _notesContexts) {
				if (libraryIDs.includes(context.libraryID)) {
					context.affectedIDs = new Set([...context.affectedIDs, ...ids]);
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
					_notesContexts.forEach(x => x.notesList.expanded = false);
				}
				// Close tab specific notes if tab id no longer exists, but
				// do that only when unloaded tab is reloaded
				setTimeout(() => {
					var contextNodes = Array.from(_notesPaneDeck.children);
					for (let contextNode of contextNodes) {
						var nodes = Array.from(contextNode.querySelector('.zotero-context-pane-tab-notes-deck').children);
						for (let node of nodes) {
							var tabID = node.getAttribute('data-tab-id');
							if (!document.getElementById(tabID)) {
								node.remove();
							}
						}
					}
					// For unknown reason fx102, unlike 60, sometimes doesn't automatically update selected index
					_selectItemContext(Zotero_Tabs.selectedID);
				});
			}
			else if (action == 'select') {
				// It seems that changing `hidden` or `collapsed` values might
				// be related with significant slow down when there are too many
				// DOM nodes (i.e. 10k notes)
				if (Zotero_Tabs.selectedType == 'library') {
					_contextPaneSplitter.setAttribute('hidden', true);
					_contextPane.setAttribute('collapsed', true);
					_tabCover.classList.add('hidden');
					_sidenav.hidden = true;
				}
				else if (Zotero_Tabs.selectedType == 'reader') {
					if (_panesDeck.selectedIndex == 1
						&& _notesPaneDeck.selectedPanel.selectedIndex != 2
						&& !_preventGlobalDeckChange) {
						let libraryID = _notesPaneDeck.selectedPanel.getAttribute('data-library-id');
						_globalDeckIndex[libraryID] = _notesPaneDeck.selectedPanel.selectedIndex;
					}
					_preventGlobalDeckChange = false;

					var reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
					if (reader) {
						_tabCover.classList.remove('hidden');
						(async () => {
							await reader._initPromise;
							_tabCover.classList.add('hidden');
							// Focus reader pages view if context pane note editor is not selected
							if (Zotero_Tabs.selectedID == reader.tabID
								&& !Zotero_Tabs.isTabsMenuVisible()
								&& (!document.activeElement
									|| !document.activeElement.closest('.context-node iframe[id="editor-view"]'))) {
								if (!Zotero_Tabs.focusOptions?.keepTabFocused) {
									// Do not move focus to the reader during keyboard navigation
									reader.focus();
								}
							}
							
							var attachment = await Zotero.Items.getAsync(reader.itemID);
							if (attachment) {
								_selectNotesContext(attachment.libraryID);
								var notesContext = _getNotesContext(attachment.libraryID);
								notesContext.updateFromCache();
							}

							let tabNotesDeck = _notesPaneDeck.selectedPanel.querySelector('.zotero-context-pane-tab-notes-deck');
							let selectedIndex = Array.from(tabNotesDeck.children).findIndex(x => x.getAttribute('data-tab-id') == ids[0]);
							if (selectedIndex != -1) {
								tabNotesDeck.setAttribute('selectedIndex', selectedIndex);
								_notesPaneDeck.selectedPanel.setAttribute('selectedIndex', 2);
							}
							else {
								let libraryID = _notesPaneDeck.selectedPanel.getAttribute('data-library-id');
								_notesPaneDeck.selectedPanel.setAttribute('selectedIndex', _globalDeckIndex[libraryID] || 0);
							}
						})();
					}
				
					_contextPaneSplitter.setAttribute('hidden', false);

					_contextPane.setAttribute('collapsed', !(_contextPaneSplitter.getAttribute('state') != 'collapsed'));
					// It seems that on heavy load (i.e. syncing) the line below doesn't set the correct value,
					// therefore we repeat the same operation at the end of JS message queue
					setTimeout(() => {
						_contextPane.setAttribute('collapsed', !(_contextPaneSplitter.getAttribute('state') != 'collapsed'));
					});
					
					_sidenav.hidden = false;
				}

				_selectItemContext(ids[0]);
				_update();
			}
		}
	};

	function _toggleItemButton() {
		_togglePane(0);
	}

	function _toggleNotesButton() {
		_togglePane(1);
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
			if (_panesDeck.selectedIndex == 1) {
				var libraryContext = _notesPaneDeck.selectedPanel;
				// Global note
				if (libraryContext.selectedIndex == 1) {
					return libraryContext.querySelector('note-editor');
				}
				// Tab specific child note
				else if (libraryContext.selectedIndex == 2) {
					return libraryContext.querySelector('.zotero-context-pane-tab-notes-deck').selectedPanel.querySelector('note-editor');
				}
			}
		}
		return null;
	}

	function _focus() {
		var splitter;
		let node;
		if (Zotero.Prefs.get('layout') == 'stacked') {
			splitter = _contextPaneSplitterStacked;
		}
		else {
			splitter = _contextPaneSplitter;
		}

		if (splitter.getAttribute('state') != 'collapsed') {
			if (_panesDeck.selectedIndex == 0) {
				// Focus the title in the header
				var header = _itemPaneDeck.selectedPanel.querySelector("pane-header editable-text");
				header.focus();
				return true;
			}
			else {
				node = _notesPaneDeck.selectedPanel;
				if (node.selectedIndex == 0) {
					node.querySelector('search-textbox').focus();
					return true;
				}
				else {
					node.querySelector('note-editor').focusFirst();
					return true;
				}
			}
		}
		return false;
	}

	function _updateAddToNote() {
		var reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
		if (reader) {
			var editor = _getActiveEditor();
			var libraryReadOnly = editor && editor.item && _isLibraryReadOnly(editor.item.libraryID);
			var noteReadOnly = editor && editor.item
				&& (editor.item.deleted || editor.item.parentItem && editor.item.parentItem.deleted);
			reader.enableAddToNote(!!editor && !libraryReadOnly && !noteReadOnly);
		}
	}
	
	function _updatePaneWidth() {
		var stacked = Zotero.Prefs.get('layout') == 'stacked';
		var width = Zotero.Reader.getSidebarWidth() + 'px';
		if (!Zotero.Reader.getSidebarOpen()) {
			width = 0;
		}
		let contextPaneWidth = _contextPane.getAttribute("width");
		if (contextPaneWidth && !_contextPane.style.width) {
			_contextPane.style.width = `${contextPaneWidth}px`;
		}
		if (Zotero.rtl) {
			_contextPane.style.left = 0;
			_contextPane.style.right = stacked ? width : 'unset';
		}
		else {
			_contextPane.style.left = stacked ? width : 'unset';
			_contextPane.style.right = 0;
		}
	}

	function _update() {
		if (Zotero_Tabs.selectedIndex == 0) {
			return;
		}
	
		var stacked = Zotero.Prefs.get('layout') == 'stacked';
		if (stacked) {
			_contextPaneSplitterStacked.setAttribute('hidden', false);
			_contextPaneSplitter.setAttribute('state', 'open');
			_contextPaneSplitter.setAttribute('hidden', true);
			_contextPane.classList.add('stacked');
			_contextPane.classList.remove('standard');
			_sidenav.classList.add('stacked');
			_contextPaneInner.append(_sidenav);
			// Fx115: in stacked layout, make contextPane occupy all width and remove min-height
			// needed for standard layout
			_contextPane.style.width = 'auto';
			_contextPaneInner.style.removeProperty("min-height");
		}
		else {
			_contextPaneSplitter.setAttribute('hidden', false);
			_contextPaneSplitterStacked.setAttribute('hidden', true);
			_contextPaneSplitterStacked.setAttribute('state', 'open');
			_contextPane.classList.add('standard');
			_contextPane.classList.remove('stacked');
			_sidenav.classList.remove('stacked');
			_contextPane.append(_sidenav);
			// FX115: in standard layout, make contextPane have the width it's supposed to and
			// force it to occupy all height available
			_contextPaneInner.style.minHeight = `100%`;
			_contextPane.style.width = `${_contextPane.getAttribute("width")}px`;
		}
		
		if (Zotero_Tabs.selectedIndex > 0) {
			var height = null;
			if (Zotero.Prefs.get('layout') == 'stacked') {
				height = 0;
				if (_contextPane.getAttribute('collapsed') != 'true') {
					height = _contextPaneInner.getBoundingClientRect().height;
				}
			}
			Zotero.Reader.setBottomPlaceholderHeight(height);
		}
		
		_updatePaneWidth();
		_updateAddToNote();
		_sidenav.container?.render();
	}

	function _togglePane() {
		var splitter = Zotero.Prefs.get('layout') == 'stacked'
			? _contextPaneSplitterStacked
			: _contextPaneSplitter;

		var open = true;
		if (splitter.getAttribute('state') != 'collapsed') {
			open = false;
		}
		
		splitter.setAttribute('state', open ? 'open' : 'collapsed');
		_update();
	}
	
	function _getCurrentAttachment() {
		var reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
		if (reader) {
			return Zotero.Items.get(reader.itemID);
		}
		return null;
	}
	
	function _addNotesContext(libraryID) {
		let readOnly = _isLibraryReadOnly(libraryID);
		
		var list = document.createXULElement('vbox');
		list.setAttribute('flex', 1);
		list.className = 'zotero-context-notes-list';

		let noteContainer = document.createXULElement('vbox');
		noteContainer.classList.add('zotero-context-note-container');
		let title = document.createXULElement('vbox');
		title.className = 'zotero-context-pane-editor-parent-line';
		let divider = document.createElement("div");
		divider.classList.add("divider");
		let editor = new (customElements.get('note-editor'));
		editor.className = 'zotero-context-pane-pinned-note';
		editor.setAttribute('flex', 1);
		noteContainer.append(title, divider, editor);

		let tabNotesContainer = document.createXULElement('vbox');
		tabNotesContainer.classList.add('zotero-context-note-container');
		title = document.createXULElement('vbox');
		title.className = 'zotero-context-pane-editor-parent-line';
		divider = document.createElement("div");
		divider.classList.add("divider");
		let tabNotesDeck = document.createXULElement('deck');
		tabNotesDeck.className = 'zotero-context-pane-tab-notes-deck';
		tabNotesDeck.setAttribute('flex', 1);
		tabNotesContainer.append(title, divider, tabNotesDeck);
		
		let contextNode = document.createXULElement('deck');
		contextNode.append(list, noteContainer, tabNotesContainer);
		_notesPaneDeck.append(contextNode);
		
		contextNode.className = 'context-node';
		contextNode.setAttribute('data-library-id', libraryID);
		contextNode.setAttribute('selectedIndex', 0);
		
		var head = document.createXULElement('hbox');
		head.style.display = 'flex';
		
		async function _createNoteFromAnnotations(child) {
			var attachment = _getCurrentAttachment();
			if (!attachment) {
				return;
			}
			var annotations = attachment.getAnnotations().filter(x => x.annotationType != 'ink');
			if (!annotations.length) {
				return;
			}
			var note = await Zotero.EditorInstance.createNoteFromAnnotations(
				annotations,
				{
					parentID: child && attachment.parentID
				}
			);

			_updateAddToNote();

			input.value = '';
			_updateNotesList();

			_setPinnedNote(note);
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
			_setPinnedNote(item);
			_updateAddToNote();
			
			input.value = '';
			_updateNotesList();
		}

		var vbox = document.createXULElement('vbox');
		vbox.style.flex = '1';
		var input = document.createXULElement('search-textbox');
		input.setAttribute('data-l10n-id', 'context-notes-search');
		input.setAttribute('data-l10n-attrs', 'placeholder');
		input.style.margin = '6px 8px 7px 8px';
		input.setAttribute('type', 'search');
		input.setAttribute('timeout', '250');
		input.addEventListener('command', () => {
			notesList.expanded = false;
			_updateNotesList();
		});
		vbox.append(input);
		
		head.append(vbox);

		var listBox = document.createXULElement('vbox');
		listBox.style.display = 'flex';
		listBox.style.minWidth = '0';
		listBox.setAttribute('flex', '1');
		var listInner = document.createElement('div');
		listInner.className = 'notes-list-container';
		// Otherwise it can be focused with tab
		listInner.tabIndex = -1;
		listBox.append(listInner);

		list.append(head, listBox);

		var notesList = document.createXULElement('context-notes-list');
		notesList.addEventListener('note-click', (event) => {
			let { id } = event.detail;
			let item = Zotero.Items.get(id);
			if (item) {
				_setPinnedNote(item);
			}
		});
		notesList.addEventListener('note-contextmenu', (event) => {
			let { id, screenX, screenY } = event.detail;
			let item = Zotero.Items.get(id);
			if (item) {
				document.getElementById('context-pane-list-move-to-trash').setAttribute('disabled', readOnly);
				var popup = document.getElementById('context-pane-list-popup');
				let handleCommand = event => _handleListPopupClick(id, event);
				popup.addEventListener('popupshowing', () => {
					popup.addEventListener('command', handleCommand, { once: true });
					popup.addEventListener('popuphiding', () => {
						popup.removeEventListener('command', handleCommand);
					}, { once: true });
				}, { once: true });
				popup.openPopupAtScreen(screenX, screenY, true);
			}
		});
		notesList.addEventListener('add-child', (event) => {
			document.getElementById('context-pane-add-child-note').setAttribute('disabled', readOnly);
			document.getElementById('context-pane-add-child-note-from-annotations').setAttribute('disabled', readOnly);
			var popup = document.getElementById('context-pane-add-child-note-button-popup');
			popup.onclick = _handleAddChildNotePopupClick;
			popup.openPopup(event.detail.button, 'after_end');
		});
		notesList.addEventListener('add-standalone', (event) => {
			document.getElementById('context-pane-add-standalone-note').setAttribute('disabled', readOnly);
			document.getElementById('context-pane-add-standalone-note-from-annotations').setAttribute('disabled', readOnly);
			var popup = document.getElementById('context-pane-add-standalone-note-button-popup');
			popup.onclick = _handleAddStandaloneNotePopupClick;
			popup.openPopup(event.detail.button, 'after_end');
		});

		function _isVisible() {
			let splitter = Zotero.Prefs.get('layout') == 'stacked'
				? _contextPaneSplitterStacked
				: _contextPaneSplitter;
			
			return Zotero_Tabs.selectedID != 'zotero-pane'
				&& _panesDeck.selectedIndex == 1
				&& context.node.selectedIndex == 0
				&& splitter.getAttribute('state') != 'collapsed';
		}

		async function _updateNotesList(useCached) {
			var query = input.value;
			var notes;
			
			// Calls itself and debounces until notes list becomes
			// visible, and then updates
			if (!useCached && !_isVisible()) {
				context.update();
				return;
			}
			
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
				if (Zotero.Prefs.get('sortNotesChronologically.reader')) {
					notes.sort((a, b) => {
						a = a.dateModified;
						b = b.dateModified;
						return (a > b ? -1 : (a < b ? 1 : 0));
					});
				}
				else {
					let collation = Zotero.getLocaleCollation();
					notes.sort((a, b) => {
						let aTitle = Zotero.Items.getSortTitle(a.getNoteTitle());
						let bTitle = Zotero.Items.getSortTitle(b.getNoteTitle());
						return collation.compareString(1, aTitle, bTitle);
					});
				}
				
				let cachedNotesIndex = new Map();
				for (let cachedNote of context.cachedNotes) {
					cachedNotesIndex.set(cachedNote.id, cachedNote);
				}
				notes = notes.map((note) => {
					var parentItem = note.parentItem;
					// If neither note nor parent item is affected try to return the cached note
					if (!context.affectedIDs.has(note.id)
						&& (!parentItem || !context.affectedIDs.has(parentItem.id))) {
						let cachedNote = cachedNotesIndex.get(note.id);
						if (cachedNote) {
							return cachedNote;
						}
					}
					var text = note.note;
					text = Zotero.Utilities.unescapeHTML(text);
					text = text.trim();
					text = text.slice(0, 500);
					var parts = text.split('\n').map(x => x.trim()).filter(x => x.length);
					var title = parts[0] && parts[0].slice(0, Zotero.Notes.MAX_TITLE_LENGTH);
					var date = Zotero.Date.sqlToDate(note.dateModified, true);
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
				context.affectedIDs = new Set();
			}

			var attachment = _getCurrentAttachment();
			var parentID = attachment && attachment.parentID;
			notesList.hasParent = !!parentID;
			notesList.notes = notes.map(note => ({
				...note,
				isCurrentChild: parentID && note.parentID == parentID
			}));
		}

		var context = {
			libraryID,
			node: contextNode,
			editor,
			notesList,
			cachedNotes: [],
			affectedIDs: new Set(),
			update: Zotero.Utilities.throttle(_updateNotesList, 1000, { leading: false }),
			updateFromCache: () => _updateNotesList(true)
		};
		
		function _handleListPopupClick(id, event) {
			switch (event.originalTarget.id) {
				case 'context-pane-list-show-in-library':
					ZoteroPane_Local.selectItem(id);
					Zotero_Tabs.select('zotero-pane');
					break;

				case 'context-pane-list-edit-in-window':
					ZoteroPane_Local.openNoteWindow(id);
					break;

				case 'context-pane-list-move-to-trash':
					if (!readOnly) {
						Zotero.Items.trashTx(id);
						context.cachedNotes = context.cachedNotes.filter(x => x.id != id);
						_updateNotesList(true);
					}
					break;

				default:
			}
		}
		
		function _handleAddChildNotePopupClick(event) {
			if (readOnly) {
				return;
			}
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
			if (readOnly) {
				return;
			}
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

		listInner.append(notesList);
		_updateNotesList();
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
	
	function _isLibraryReadOnly(libraryID) {
		return !Zotero.Libraries.get(libraryID).editable;
	}

	function _setPinnedNote(item) {
		var readOnly = _isLibraryReadOnly(item.libraryID);
		var context = _getNotesContext(item.libraryID);
		if (context) {
			var { editor, node } = context;

			let isChild = false;
			var reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
			if (reader) {
				let attachment = Zotero.Items.get(reader.itemID);
				if (attachment.parentItemID == item.parentItemID) {
					isChild = true;
				}
			}

			var tabNotesDeck = _notesPaneDeck.selectedPanel.querySelector('.zotero-context-pane-tab-notes-deck');
			var parentTitleContainer;
			let vbox;
			if (isChild) {
				vbox = document.createXULElement('vbox');
				vbox.setAttribute('data-tab-id', Zotero_Tabs.selectedID);
				vbox.style.display = 'flex';

				editor = new (customElements.get('note-editor'));
				editor.style.display = 'flex';
				editor.style.width = '100%';
				vbox.append(editor);

				tabNotesDeck.append(vbox);

				editor.mode = readOnly ? 'view' : 'edit';
				editor.item = item;
				editor.parentItem = null;

				_notesPaneDeck.selectedPanel.setAttribute('selectedIndex', 2);
				tabNotesDeck.setAttribute('selectedIndex', tabNotesDeck.children.length - 1);

				parentTitleContainer = _notesPaneDeck.selectedPanel.children[2].querySelector('.zotero-context-pane-editor-parent-line');
			}
			else {
				node.setAttribute('selectedIndex', 1);
				editor.mode = readOnly ? 'view' : 'edit';
				editor.item = item;
				editor.parentItem = null;

				parentTitleContainer = node.querySelector('.zotero-context-pane-editor-parent-line');
			}

			editor.focus();

			let parentItem = item.parentItem;
			let container = document.createElement('div');
			container.classList.add("parent-title-container");
			let returnBtn = document.createXULElement("toolbarbutton");
			returnBtn.classList.add("zotero-tb-note-return");
			returnBtn.addEventListener("command", () => {
				// Immediately save note content before vbox with note-editor iframe is destroyed below
				editor.saveSync();
				_panesDeck.setAttribute('selectedIndex', 1);
				_notesPaneDeck.selectedPanel.setAttribute('selectedIndex', 0);
				vbox?.remove();
				_updateAddToNote();
				_preventGlobalDeckChange = true;
			});
			let title = document.createElement('div');
			title.className = 'parent-title';
			title.textContent = parentItem?.getDisplayTitle() || '';
			container.append(returnBtn, title);
			parentTitleContainer.replaceChildren(container);
			_updateAddToNote();
		}
	}

	function _removeItemContext(tabID) {
		document.getElementById(tabID + '-context').remove();
		_itemContexts = _itemContexts.filter(x => x.tabID != tabID);
	}

	function _selectItemContext(tabID) {
		let previousPinnedPane = _sidenav.container?.pinnedPane || "";
		let selectedPanel = Array.from(_itemPaneDeck.children).find(x => x.id == tabID + '-context');
		if (selectedPanel) {
			_itemPaneDeck.selectedPanel = selectedPanel;
			selectedPanel.sidenav = _sidenav;
			if (previousPinnedPane) selectedPanel.pinnedPane = previousPinnedPane;
		}
	}

	async function _addItemContext(tabID, itemID) {
		var { libraryID } = Zotero.Items.getLibraryAndKeyFromID(itemID);
		var library = Zotero.Libraries.get(libraryID);
		await library.waitForDataLoad('item');

		var item = Zotero.Items.get(itemID);
		if (!item) {
			return;
		}
		libraryID = item.libraryID;
		var readOnly = _isLibraryReadOnly(libraryID);
		var parentID = item.parentID;
		
		var context = {
			tabID,
			itemID,
			parentID,
			libraryID,
			update: () => {}
		};
		_itemContexts.push(context);

		let previousPinnedPane = _sidenav.container?.pinnedPane || "";
		
		let targetItem = parentID ? Zotero.Items.get(parentID) : item;

		let itemDetails = document.createXULElement('item-details');
		itemDetails.id = tabID + '-context';
		itemDetails.className = 'zotero-item-pane-content';
		_itemPaneDeck.appendChild(itemDetails);

		itemDetails.mode = readOnly ? "view" : null;
		itemDetails.item = targetItem;
		itemDetails.sidenav = _sidenav;
		if (previousPinnedPane) itemDetails.pinnedPane = previousPinnedPane;

		_selectItemContext(tabID);
		await itemDetails.render();
	}
};
