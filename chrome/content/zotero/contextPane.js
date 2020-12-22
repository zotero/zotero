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
			}
			else if (action == 'select') {
				if (Zotero_Tabs.selectedIndex == 0) {
					_contextPaneSplitter.setAttribute('hidden', true);
					_contextPane.setAttribute('collapsed', true);
					_toolbar.append(_itemToolbar);
					_itemToolbar.classList.remove('tab-mode');
					_splitButton.classList.add('hidden');
				}
				else {
					var reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
					if (reader) {
						_tabCover.hidden = false;
						(async () => {
							await reader._initPromise;
							_tabCover.hidden = true;
						})();
					}
				
					_contextPaneSplitter.setAttribute('hidden', false);
					_contextPane.setAttribute('collapsed', !(_contextPaneSplitter.getAttribute('state') != 'collapsed'));
					_tabToolbarContainer.append(_itemToolbar);
					_itemToolbar.classList.add('tab-mode');
					_splitButton.classList.remove('hidden');
				}
				
				var context = _itemContexts.find(x => x.tabID == ids[0]);
				if (context) {
					_selectNotesContext(context.libraryID);
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
	
	function _addNotesContext(libraryID) {
		var list = document.createElement('vbox');
		list.setAttribute('flex', 1);
		list.className = 'zotero-context-notes-list';

		var noteContainer = document.createElement('vbox');
		var editor = document.createElement('zoteronoteeditor');
		editor.className = 'zotero-context-pane-pinned-note';
		editor.setAttribute('flex', 1);
		noteContainer.appendChild(editor);
		
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
		
		var label = document.createElement('label');
		var button = document.createElement('button');
		button.setAttribute('label', Zotero.Intl.strings['zotero.toolbar.newNote']);
		button.addEventListener('click', () => {
			contextNode.setAttribute('selectedIndex', 1);
			var item = new Zotero.Item('note');
			item.libraryID = libraryID;
			// item.parentKey = parentItem.key;
			editor.mode = 'edit';
			editor.item = item;
			editor.parentItem = null;
			editor.focus();
			_updateAddToNote();
		});


		var vbox1 = document.createElement('vbox');
		vbox1.append(label, button);

		var vbox2 = document.createElement('vbox');
		vbox2.style.flex = '1';
		var input = document.createElement('textbox');
		input.setAttribute('type', 'search');
		input.setAttribute('timeout', '250');
		input.addEventListener('command', () => {
			_updateNotesList();
		});
		vbox2.append(input);
		
		head.append(vbox2, vbox1);

		var listBox = document.createElement('vbox');
		listBox.style.display = 'flex';
		listBox.setAttribute('flex', '1');
		var listInner = document.createElementNS(HTML_NS, 'div');
		listInner.className = 'notes-list-container';
		listBox.append(listInner);

		list.append(head, listBox);

		var notesListRef = React.createRef();

		async function _updateNotesList(reset) {
			if (reset) {
				input.value = '';
				contextNode.setAttribute('selectedIndex', 0);
			}
			var query = input.value;

			await Zotero.Schema.schemaUpdatePromise;
			var s = new Zotero.Search();
			s.addCondition('libraryID', 'is', libraryID);
			s.addCondition('itemType', 'is', 'note');
			s.addCondition('noChildren', 'true');
			if (query) {
				s.addCondition('note', 'contains', query, true);
			}
			var notes = await s.search();
			notes = Zotero.Items.get(notes);
			notes.sort((a, b) => {
				a = a.getField('dateModified');
				b = b.getField('dateModified');
				return b.localeCompare(a);
			});

			notesListRef.current.setNotes(notes.map(note => {
				var text = note.note;
				text = Zotero.Utilities.unescapeHTML(text);
				text = text.trim();
				text = text.slice(0, 500);
				var parts = text.split('\n').map(x => x.trim()).filter(x => x.length);
				var title = parts[0] && parts[0].slice(0, Zotero.Notes.MAX_TITLE_LENGTH);
				return {
					id: note.id,
					title: title || Zotero.getString('pane.item.notes.untitled'),
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
				ref={notesListRef}
				onClick={(id) => {
					_setPinnedNote(libraryID, id);
				}}
			/>,
			listInner,
			() => {
				_updateNotesList();
			}
		);

		var context = {
			libraryID,
			node: contextNode,
			update: Zotero.Utilities.throttle(_updateNotesList, 1000, { leading: false }),
			editor
		};

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

	function _setPinnedNote(libraryID, itemID) {
		var editable = _isLibraryEditable(libraryID);
		var context = _getNotesContext(libraryID);
		if (context) {
			let { editor, node } = context;
			node.setAttribute('selectedIndex', 1);
			editor.mode = editable ? 'edit' : 'view';
			editor.item = Zotero.Items.get(itemID);
			editor.parentItem = null;
			editor.hideLinksContainer = true;
			_updateAddToNote();
		}
	}
	
	function _appendNoteRows(notes, list, editable, onClick, onDelete) {
		for (var i = 0; i < notes.length; i++) {
			var note = notes[i];
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
			
			var row = document.createElement('row');
			row.appendChild(box);
			if (editable) {
				var removeButton = document.createElement('label');
				removeButton.setAttribute('value', '-');
				removeButton.setAttribute('class', 'zotero-clicky zotero-clicky-minus');
				removeButton.addEventListener('click', function () {
					onDelete(id);
				});
				row.appendChild(removeButton);
			}

			list.appendChild(row);
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

		// tabbox
		var tabbox = document.createElement('tabbox');
		tabbox.setAttribute('flex', '1');
		tabbox.className = 'zotero-view-tabbox';

		container.append(tabbox);

		// tabs
		var tabs = document.createElement('tabs');
		tabs.className = 'zotero-editpane-tabs';
		// tabpanels
		var tabpanels = document.createElement('tabpanels');
		tabpanels.setAttribute('flex', '1');
		tabpanels.className = 'zotero-view-item';
		tabpanels.addEventListener('select', () => {
			_updateAddToNote();
		});

		tabbox.append(tabs, tabpanels);

		// Info tab
		var tabInfo = document.createElement('tab');
		tabInfo.setAttribute('label', Zotero.Intl.strings['zotero.tabs.info.label']);
		// Notes tab
		var tabNotes = document.createElement('tab');
		tabNotes.setAttribute('label', Zotero.Intl.strings['zotero.tabs.notes.label']);
		// Tags tab
		var tabTags = document.createElement('tab');
		tabTags.setAttribute('label', Zotero.Intl.strings['zotero.tabs.tags.label']);
		// Related tab
		var tabRelated = document.createElement('tab');
		tabRelated.setAttribute('label', Zotero.Intl.strings['zotero.tabs.related.label']);

		tabs.append(tabInfo, tabNotes, tabTags, tabRelated);

		// Info panel
		var panelInfo = document.createElement('tabpanel');
		panelInfo.setAttribute('flex', '1');
		panelInfo.className = 'zotero-editpane-item-box';
		var itemBox = document.createElement('zoteroitembox');
		itemBox.setAttribute('flex', '1');
		panelInfo.append(itemBox);
		// Notes panel
		var panelNotes = document.createElement('tabpanel');
		panelNotes.setAttribute('flex', '1');
		panelNotes.setAttribute('orient', 'vertical');
		var deck = document.createElement('deck');
		deck.className = 'notes-deck';
		deck.setAttribute('flex', '1');
		panelNotes.append(deck);
		var vbox2 = document.createElement('vbox');
		var note = document.createElement('zoteronoteeditor');
		note.setAttribute('flex', 1);
		vbox2.append(note);
		var vbox = document.createElement('vbox');
		vbox.setAttribute('flex', '1');
		vbox.setAttribute('class', 'zotero-box');
		vbox.style.overflowY = 'auto';
		panelNotes.append(vbox);
		var hbox = document.createElement('hbox');
		hbox.setAttribute('align', 'center');
		var label = document.createElement('label');
		var button = document.createElement('button');
		button.hidden = !editable;
		button.setAttribute('label', Zotero.Intl.strings['zotero.item.add']);
		button.addEventListener('click', () => {
			deck.setAttribute('selectedIndex', 1);
			var item = new Zotero.Item('note');
			item.libraryID = parentItem.libraryID;
			item.parentID = parentItem.id;
			note.returnHandler = () => {
				deck.setAttribute('selectedIndex', 0);
				_updateAddToNote();
			};
			note.mode = editable ? 'edit' : 'view';
			note.item = item;
			note.focus();
			_updateAddToNote();
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
		// Tags panel
		var panelTags = document.createElement('tabpanel');
		panelTags.setAttribute('orient', 'vertical');
		panelTags.setAttribute('context', 'tags-context-menu');
		panelTags.className = 'tags-pane';
		panelTags.style.display = 'flex';
		var div = document.createElementNS(HTML_NS, 'div');
		div.className = 'tags-box-container';
		div.style.display = 'flex';
		div.style.flexGrow = '1';
		panelTags.append(div);
		var tagsBoxRef = React.createRef();
		ReactDOM.render(
			<TagsBoxContainer
				key={'tagsBox-' + parentItem.id}
				item={parentItem}
				editable={editable}
				ref={tagsBoxRef}
			/>,
			div
		);
		// Related panel
		var panelRelated = document.createElement('tabpanel');
		var relatedBox = document.createElement('relatedbox');
		relatedBox.setAttribute('flex', '1');
		relatedBox.className = 'zotero-editpane-related';
		panelRelated.addEventListener('click', (event) => {
			if (event.originalTarget.closest('.zotero-clicky')) {
				Zotero_Tabs.select('zotero-pane');
			}
		});
		panelRelated.append(relatedBox);

		tabpanels.append(panelInfo, panelNotes, panelTags, panelRelated);
		tabbox.selectedIndex = 0;


		itemBox.mode = editable ? 'edit' : 'view';
		itemBox.item = parentItem;

		relatedBox.mode = editable ? 'edit' : 'view';
		relatedBox.item = parentItem;

		function _renderNotesPanel() {
			rows.innerHTML = '';
			var parentItem = Zotero.Items.get(parentID);
			if (!parentItem) {
				return;
			}
			var parentNotes = Zotero.Items.get(parentItem.getNotes());
			_appendNoteRows(parentNotes, rows, editable, (id) => {
				deck.setAttribute('selectedIndex', 1);
				note.returnHandler = () => {
					deck.setAttribute('selectedIndex', 0);
					_updateAddToNote();
				};
				note.mode = editable ? 'edit' : 'view';
				note.item = Zotero.Items.get(id);
				note.parentItem = null;
				_updateAddToNote();
			}, (id) => {
				_removeNote(id);
			});
			var c = parentNotes.length;
			var str = 'pane.item.notes.count.' + (c == 0 && 'zero' || c == 1 && 'singular' || 'plural');
			label.value = Zotero.getString(str, [c]);
		}

		context.update = Zotero.Utilities.throttle(_renderNotesPanel, 500);
		_renderNotesPanel();
	}
};

addEventListener('load', function (e) { ZoteroContextPane.onLoad(e); }, false);
addEventListener('unload', function (e) { ZoteroContextPane.onUnload(e); }, false);
