/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2019 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
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

const React = require('react');
const ReactDOM = require('react-dom');
const { IntlProvider } = require('react-intl');
const LibraryTree = require('libraryTree');
const VirtualizedTable = require('components/virtualized-table');
const { TreeSelectionStub } = VirtualizedTable;
const Icons = require('components/icons');
const { getDOMElement: getDOMIcon } = Icons;
const { getDragTargetOrient } = require('components/utils');
const { Cc, Ci, Cu } = require('chrome');

const CHILD_INDENT = 20;
const TYPING_TIMEOUT = 1000;

var CollectionTree = class CollectionTree extends LibraryTree {
	static async init(domEl, opts) {
		Zotero.debug("Initializing React CollectionTree");
		var ref;
		opts.domEl = domEl;
		let elem = (
			<IntlProvider locale={Zotero.locale} messages={Zotero.Intl.strings}>
				<CollectionTree ref={c => ref = c } {...opts} />
			</IntlProvider>
		);
		await new Promise(resolve => ReactDOM.render(elem, domEl, resolve));

		Zotero.debug('React CollectionTree initialized');
		return ref;
	}
	
	constructor(props) {
		super(props);
		this.itemTreeView = null;
		this.itemToSelect = null;
		this.hideSources = [];

		this.type = 'collection';
		this.name = "CollectionTree";
		this.id = "collection-tree";
		this._highlightedRows = new Set();
		this._unregisterID = Zotero.Notifier.registerObserver(
			this,
			[
				'collection',
				'search',
				'feed',
				'share',
				'group',
				'trash',
				'bucket'
			],
			'collectionTree',
			25
		);
		
		try {
			this._containerState = JSON.parse(Zotero.Prefs.get("sourceList.persist"));
		}
		catch (e) {
			this._containerState = {};
		}
		this._virtualCollectionLibraries = {};
		this._trashNotEmpty = {};
		this._editing = null;
		this._editingInput = null;
		this._dropRow = null;
		this._typingString = "";
		this._typingTimeout = null;
		
		this.onLoad = this.createEventBinding('load', true, true);
	}
	
	async makeVisible() {
		await this.refresh();
		var lastViewedID = Zotero.Prefs.get('lastViewedFolder');
		if (lastViewedID) {
			var selected = await this.selectByID(lastViewedID);
		}
		if (!selected) {
			await this.selectByID('L' + Zotero.Libraries.userLibraryID);
		}
		if (this.selection.selectEventsSuppressed) {
			let promise = this.waitForSelect();
			this.selection.selectEventsSuppressed = false;
			await promise;
		}
		await this.runListeners('load');
		Zotero.debug("React CollectionTree loaded");
	}

	componentDidMount() {
		this.selection.select(0);
		this.makeVisible();
	}
	
	componentDidUpdate() {
		this.runListeners('refresh');
	}

	// Add a keypress listener for expand/collapse
	handleKeyDown = (event) => {
		if (this._editing) {
			if (event.key == 'Enter' || event.key == 'Escape') {
				if (event.key != 'Escape') {
					this.commitEditingName(this._editing);
				}
				this.stopEditing();
			}
			return false; // In-line editing active
		}
		
		var libraryID = this.getSelectedLibraryID();
		if (!libraryID) return true;
		let treeRow = this.getRow(this.selection.focused);
		
		if (event.key == '+' && !(event.ctrlKey || event.altKey || event.metaKey)) {
			this.expandLibrary(libraryID, true);
		}
		else if (event.key == '-' && !(event.shiftKey || event.ctrlKey
				|| event.altKey || event.metaKey)) {
			this.collapseLibrary(libraryID);
		}
		else if ((event.key == 'Backspace' && Zotero.isMac) || event.key == 'Delete') {
			var deleteItems = event.metaKey || (!Zotero.isMac && event.shiftKey);
			window.ZoteroPane.deleteSelectedCollection(deleteItems);
			event.preventDefault();
		}
		else if (event.key == "F2" && !Zotero.isMac && treeRow.isCollection()) {
			this.handleActivate(event, [this.selection.focused]);
		}
		else if (event.key.length == 1) {
			this.handleTyping(event.key);
		}
		return true;
	}
	
	_handleSelectionChange = (shouldDebounce) => {
		let selection = this.selection;
		let treeRow = this.getRow(selection.focused);
		// If selection changed (by click on a different row) and we are editing
		// commit the edit
		if (this._editing) {
			if (this._editing == treeRow) return;
			this.commitEditingName(this._editing);
			this._editing = null;
		}
		// Update aria-activedescendant on the tree
		this.forceUpdate();
		if (shouldDebounce) {
			this._onSelectionChangeDebounced();
		}
		else {
			this._onSelectionChange();
		}
	}
	
	handleActivate = (event, indices) => {
		let index = indices[0];
		let treeRow = this.getRow(index);
		if (treeRow.isCollection() && this.editable) {
			this._editing = treeRow;
			treeRow.editingName = treeRow.ref.name;
			this.tree.invalidateRow(index);
		}
		else if (treeRow.isLibrary()) {
			let uri = Zotero.URI.getCurrentUserLibraryURI();
			if (uri) {
				window.ZoteroPane.loadURI(uri);
				event.stopPropagation();
			}
		}
		else if (treeRow.isSearch()) {
			window.ZoteroPane.editSelectedCollection();
		}
		else if (treeRow.isGroup()) {
			let uri = Zotero.URI.getGroupURI(treeRow.ref, true);
			window.ZoteroPane.loadURI(uri);
		}
	}
	
	handleEditingChange = (event, index) => {
		this.getRow(index).editingName = event.target.value;
	}
	
	async handleTyping(char) {
		this._typingString += char.toLowerCase();
		let allSameChar = true;
		for (let i = this._typingString.length - 1; i >= 0; i--) {
			if (char != this._typingString[i]) {
				allSameChar = false;
				break;
			}
		}
		if (allSameChar) {
			for (let i = this.selection.focused + 1, checked = 0; checked < this._rows.length; i++, checked++) {
				i %= this._rows.length;
				let row = this.getRow(i);
				if (this.isSelectable(i) && row.getName().toLowerCase().indexOf(char) == 0) {
					if (i != this.selection.focused) {
						this.ensureRowIsVisible(i);
						await this.selectWait(i);
					}
					break;
				}
			}
		}
		else {
			for (let i = 0; i < this._rows.length; i++) {
				let row = this.getRow(i);
				if (this.isSelectable(i) && row.getName().toLowerCase().indexOf(this._typingString) == 0) {
					if (i != this.selection.focused) {
						this.ensureRowIsVisible(i);
						await this.selectWait(i);
					}
					break;
				}
			}
		}
		clearTimeout(this._typingTimeout);
		this._typingTimeout = setTimeout(() => {
			this._typingString = "";
		}, TYPING_TIMEOUT);
	}
	
	async commitEditingName() {
		let treeRow = this._editing;
		if (!treeRow.editingName) return;
		treeRow.ref.name = treeRow.editingName;
		delete treeRow.editingName;
		await treeRow.ref.saveTx();
	}
	
	stopEditing = () => {
		this._editing = null;
		// Returning focus to the tree container
		this.tree.invalidate();
		this.tree.focus();
	}

	renderItem = (index, selection, oldDiv, columns) => {
		const treeRow = this.getRow(index);
		
		// Div creation and content
		let div = oldDiv || document.createElementNS("http://www.w3.org/1999/xhtml", 'div');
		div.innerHTML = "";
		
		// Classes
		div.className = "row";
		div.classList.toggle('selected', selection.isSelected(index));
		div.classList.toggle('highlighted', this._highlightedRows.has(treeRow.id));
		div.classList.toggle('drop', this._dropRow == index);
		div.classList.toggle('unread', treeRow.ref && treeRow.ref.unreadCount > 0);

		// Depth indent
		let depth = treeRow.level;
		// The arrow on macOS is a full icon's width.
		// For non-userLibrary items that are drawn under headers
		// we do not draw the arrow and need to move all items 1 level up
		if (Zotero.isMac && !treeRow.isHeader() && treeRow.ref
			&& treeRow.ref.libraryID != Zotero.Libraries.userLibraryID) {
			depth--;
		}
		div.style.paddingInlineStart = (CHILD_INDENT * depth) + 'px';
		
		// Create a single-cell for the row (for the single-column layout)
		let cell = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
		cell.className = "cell label primary";
		
		// Twisty/spacer
		let twisty;
		if (this.isContainerEmpty(index)) {
			twisty = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
			twisty.classList.add("spacer-twisty");
		}
		else {
			twisty = getDOMIcon("IconTwisty");
			twisty.classList.add('twisty');
			if (this.isContainerOpen(index)) {
				twisty.classList.add('open');
			}
			twisty.style.pointerEvents = 'auto';
			twisty.addEventListener('mousedown', event => event.stopPropagation());
			twisty.addEventListener('mouseup', event => this.handleTwistyMouseUp(event, index),
				{ passive: true });
		}
		
		const icon = this._getIcon(index);
		icon.classList.add('cell-icon');
		
		// Label
		let label = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
		label.innerText = treeRow.getName();
		label.className = 'cell-text';

		// Editing input
		div.classList.toggle('editing', treeRow == this._editing);
		if (treeRow == this._editing) {
			div.style.pointerEvents = 'auto';
			label = document.createElementNS("http://www.w3.org/1999/xhtml", 'input');
			label.className = 'cell-text';
			label.setAttribute("size", 5);
			label.value = treeRow.editingName;
			label.addEventListener('input', e => this.handleEditingChange(e, index));
			label.addEventListener('blur', async () => {
				await this.commitEditingName();
				this.stopEditing();
			});
			// Feels like a bit of a hack, but it gets the job done
			setTimeout(() => {
				label.focus();
			});
		}

		cell.appendChild(twisty);
		cell.appendChild(icon);
		cell.appendChild(label);
		div.appendChild(cell);

		// Drag-and-drop stuff
		if (this.props.dragAndDrop) {
			div.setAttribute('draggable', treeRow != this._editing);
		}
		if (!oldDiv) {
			if (this.props.dragAndDrop) {
				div.addEventListener('dragstart', e => this.onDragStart(e, index), { passive: true });
				div.addEventListener('dragover', e => this.onDragOver(e, index));
				div.addEventListener('dragend', this.onDragEnd, { passive: true });
				div.addEventListener('dragleave', this.onDragLeave, { passive: true });
				div.addEventListener('drop', (e) => {
					e.stopPropagation();
					this.onDrop(e, index);
				}, { passive: true });
			}
		}

		return div;
	}
	
	render() {
		return React.createElement(VirtualizedTable,
			{
				getRowCount: () => this._rows.length,
				id: this.id,
				ref: ref => this.tree = ref,
				treeboxRef: ref => this._treebox = ref,
				renderItem: this.renderItem,

				onSelectionChange: this._handleSelectionChange,
				isSelectable: this.isSelectable,
				getParentIndex: this.getParentIndex,
				isContainer: this.isContainer,
				isContainerEmpty: this.isContainerEmpty,
				isContainerOpen: this.isContainerOpen,
				toggleOpenState: this.toggleOpenState,
				onItemContextMenu: (e) => this.props.onContextMenu && this.props.onContextMenu(e),

				onKeyDown: this.handleKeyDown,
				onActivate: this.handleActivate,

				label: Zotero.getString('pane.collections.title')
			}
		);
	}

////////////////////////////////////////////////////////////////////////////////
///
///  Component control methods
///
////////////////////////////////////////////////////////////////////////////////

	/**
	 *  Rebuild the tree from the data access methods and clear the selection
	 *
	 *  Calling code must restore the selection, and unsuppress selection events
	 */
	async refresh() {
		try {
			Zotero.debug("Refreshing collections pane");
		
			if (this.hideSources.indexOf('duplicates') == -1) {
				this._virtualCollectionLibraries.duplicates =
					Zotero.Prefs.getVirtualCollectionState('duplicates');
			}
			this._virtualCollectionLibraries.unfiled =
					Zotero.Prefs.getVirtualCollectionState('unfiled');
			this._virtualCollectionLibraries.retracted =
				Zotero.Prefs.getVirtualCollectionState('retracted');
			
			var newRows = [];
			var added = 0;
			
			//
			// Add "My Library"
			//
			newRows.splice(added++, 0,
				new Zotero.CollectionTreeRow(this, 'library', { libraryID: Zotero.Libraries.userLibraryID }));
			newRows[0].isOpen = true;
			added += await this._expandRow(newRows, 0);
			
			// Add groups
			var groups = Zotero.Groups.getAll();
			if (groups.length) {
				newRows.splice(added++, 0, new Zotero.CollectionTreeRow(this, 'separator', false));
				let groupHeader = new Zotero.CollectionTreeRow(this, 'header', {
					id: "group-libraries-header",
					label: Zotero.getString('pane.collections.groupLibraries'),
					libraryID: -1
				});
				newRows.splice(added++, 0, groupHeader);
				for (let group of groups) {
					newRows.splice(added++, 0,
						new Zotero.CollectionTreeRow(this, 'group', group, 1),
					);
					added += await this._expandRow(newRows, added - 1);
				}
			}
			
			// Add feeds
			if (this.hideSources.indexOf('feeds') == -1) {
				var feeds = Zotero.Feeds.getAll();
				
				// Alphabetize
				var collation = Zotero.getLocaleCollation();
				feeds.sort(function (a, b) {
					return collation.compareString(1, a.name, b.name);
				});
				
				if (feeds.length) {
					newRows.splice(added++, 0,
						new Zotero.CollectionTreeRow(this, 'separator', false),
					);
					let feedHeader = new Zotero.CollectionTreeRow(this, 'header', {
						id: "feed-libraries-header",
						label: Zotero.getString('pane.collections.feedLibraries'),
						libraryID: -1
					});
					newRows.splice(added++, 0, feedHeader);
					for (let feed of feeds) {
						newRows.splice(added++, 0,
							new Zotero.CollectionTreeRow(this, 'feed', feed, 1)
						);
					}
				}
			}
			
			this.selection.selectEventsSuppressed = true;
			
			this._rows = newRows;
			this._refreshRowMap();
		} catch (e) {
			Zotero.logError(e);
			window.ZoteroPane.displayErrorMessage();
		}
	}
	
	/**
	 * Refresh tree, restore selection and unsuppress select events
	 *
	 * See note for refresh() for requirements of calling code
	 */
	async reload() {
		await this.refresh();
		this.selection.select(0);
		this.selection.selectEventsSuppressed = false;
	}
	
	async selectByID(id) {
		var type = id[0];
		id = parseInt(('' + id).substr(1));
		
		switch (type) {
		case 'L':
			return this.selectLibrary(id);
		
		case 'C':
			await this.expandToCollection(id);
			break;
		
		case 'S':
			var search = await Zotero.Searches.getAsync(id);
			await this.expandLibrary(search.libraryID);
			break;
		
		case 'D':
		case 'U':
		case 'T':
			await this.expandLibrary(id);
			break;
		}
		
		var row = this.getRowIndexByID(type + id);
		if (!row) {
			return false;
		}
		this.ensureRowIsVisible(row);
		await this.selectWait(row);
		
		return true;
	}
	
	/**
	 * Select a row and wait for its items view to be created
	 *
	 * Note that this doesn't wait for the items view to be loaded. For that, add a 'load' event
	 * listener to the items view.
	 *
	 * @param {Integer} index
	 * @return {Promise}
	 */
	async selectWait(index) {
		if (this.tree && this.selection.isSelected(index)) {
			Zotero.debug(`CollectionTree.selectWait(): row ${index} already selected`);
			return;
		}
		var promise = this.waitForSelect();
		this.selection.select(index);
		
		if (this.selection.selectEventsSuppressed) {
			Zotero.debug(`CollectionTree.selectWait(): selectEventsSuppressed. Not waiting to select row ${index}`);
			return;
		}
		return promise;
	}
	
	async selectLibrary(libraryID=0) {
		var row = this.getRowIndexByID('L' + libraryID);
		if (row === undefined) {
			Zotero.debug(`CollectionTree.selectLibrary(): library with ID ${libraryID} not found in collection tree`);
			return false;
		}
		this.ensureRowIsVisible(row);
		await this.selectWait(row);
		return true;
	}
	
	async selectTrash(libraryID) {
		return this.selectByID('T'+libraryID);
	}
	
	async selectCollection(id) {
		return this.selectByID('C' + id);
	}

	selectSearch(id) {
		return this.selectByID('S' + id);
	}

	async selectItem(itemID, inLibraryRoot) {
		return !!(await this.selectItems([itemID], inLibraryRoot));
	}
	
	/**
	 * Find items in current collection, or, if not there, in a library root, and select it
	 *
	 * @param {Array{Integer}} itemID
	 * @param {Boolean} [inLibraryRoot=false] - Always show in library root
	 * @return {Boolean} - True if item was found, false if not
	 */
	async selectItems(itemIDs, inLibraryRoot) {
		if (!itemIDs.length) {
			return false;
		}
		
		var items = await Zotero.Items.getAsync(itemIDs);
		if (!items.length) {
			return false;
		}
		
		await this.waitForLoad();

		// Check if items from multiple libraries were specified
		if (items.length > 1 && new Set(items.map(item => item.libraryID)).size > 1) {
			Zotero.debug("Can't select items in multiple libraries", 2);
			return 0;
		}
		
		var currentLibraryID = this.getSelectedLibraryID();
		var libraryID = items[0].libraryID;
		// If in a different library
		if (libraryID != currentLibraryID) {
			Zotero.debug("Library ID differs; switching library");
			await this.selectLibrary(libraryID);
		}
		// Force switch to library view
		else if (!this.getRow(this.selection.focused).isLibrary() && inLibraryRoot) {
			Zotero.debug("Told to select in library; switching to library");
			await this.selectLibrary(libraryID);
		}
		
		await this.itemTreeView.waitForLoad();
		
		var numSelected = await this.itemTreeView.selectItems(itemIDs);
		if (numSelected == items.length) {
			return numSelected;
		}
		
		// If there's a single item and it's in the trash, switch to that
		if (items.length == 1 && items[0].deleted) {
			Zotero.debug("Item is deleted; switching to trash");
			await this.selectTrash(libraryID);
		}
		else {
			Zotero.debug("Item was not selected; switching to library");
			await this.selectLibrary(libraryID);
		}
		
		await this.itemTreeView.waitForLoad();
		return this.itemTreeView.selectItems(itemIDs);
	}

	waitForLoad() {
		return this._waitForEvent('load');
	}
	
	/*
	 *  Called by Zotero.Notifier on any changes to collections in the data layer
	 */
	async notify(action, type, ids, extraData) {
		if ((!ids || ids.length == 0) && action != 'refresh' && action != 'redraw') {
			return;
		}
		
		if (!this._rowMap) {
			Zotero.debug("Row map didn't exist in collectionTree.notify()");
			return;
		}
		
		//
		// Actions that don't change the selection
		//
		if (action == 'redraw') {
			this.tree.invalidate();
			return;
		}
		if (action == 'refresh') {
			// If trash is refreshed, we probably need to update the icon from full to empty
			if (type == 'trash') {
				this.tree.invalidate();
			}
			return;
		}
		if (type == 'feed' && (action == 'unreadCountUpdated' || action == 'statusChanged')) {
			this.tree.invalidate();
			return;
		}
		
		//
		// Actions that can change the selection
		//
		var currentTreeRow = this.getRow(this.selection.focused);
		this.selection.selectEventsSuppressed = true;
		
		if (action == 'delete') {
			let selectedIndex = this.selection.focused;
			let feedDeleted = false;
			
			// Since a delete involves shifting of rows, we have to do it in reverse order
			let rows = [];
			for (let i = 0; i < ids.length; i++) {
				let id = ids[i];
				switch (type) {
					case 'collection':
						if (this._rowMap['C' + id] !== undefined) {
							rows.push(this._rowMap['C' + id]);
						}
						break;
					
					case 'search':
						if (this._rowMap['S' + id] !== undefined) {
							rows.push(this._rowMap['S' + id]);
						}
						break;

					case 'feed':
					case 'group':
						let row = this._rowMap["L" + extraData[id].libraryID];
						let level = this.getLevel(row);
						do {
							rows.push(row);
							row++;
						}
						while (row < this._rows.length && this.getLevel(row) > level);
						
						if (type == 'feed') {
							feedDeleted = true;
						}
						break;
				}
			}
			
			if (rows.length > 0) {
				rows.sort(function(a,b) { return b-a });
				
				for (let row of rows) {
					this._removeRow(row);
				}
				
				// If a feed was removed and there are no more, remove the 'Feeds' header
				// (and the splitter before it)
				if (feedDeleted && !Zotero.Feeds.haveFeeds()) {
					let row = this._rowMap['HF'];
					this._removeRow(row);
					this._removeRow(row - 1);
				}
			}
		}
		else if (action == 'modify') {
			let row;
			let id = ids[0];
			let rowID = "C" + id;
			let selectedIndex = this.selection.count ? this.selection.currentIndex : 0;
			
			switch (type) {
			case 'collection':
				let collection = Zotero.Collections.get(id);
				row = this.getRowIndexByID(rowID);
				// If collection is visible
				if (row !== false) {
					// TODO: Only move if name changed
					let reopen = this.isContainerOpen(row);
					if (reopen) {
						this._closeContainer(row);
					}
					this._removeRow(row);
					// Collection was moved to trash, so don't add it back
					if (collection.deleted) {
						this._refreshRowMap();
						this.selectAfterRowRemoval(selectedIndex);
					}
					else {
						await this._addSortedRow('collection', id);
						await this.selectByID(currentTreeRow.id);
						if (reopen) {
							let newRow = this.getRowIndexByID(rowID);
							if (!this.isContainerOpen(newRow)) {
								await this.toggleOpenState(newRow);
							}
						}
					}
				}
				// If collection isn't currently visible and it isn't in the trash (because it was
				// undeleted), add it (if possible without opening any containers)
				else if (!collection.deleted) {
					await this._addSortedRow('collection', id);
					// Invalidate parent in case it's become non-empty
					let parentRow = this.getRowIndexByID("C" + collection.parentID);
					if (parentRow !== false) {
						this._treebox.invalidateRow(parentRow);
					}
				}
				break;
			
			case 'search':
				let search = Zotero.Searches.get(id);
				row = this.getRowIndexByID("S" + id);
				if (row !== false) {
					// TODO: Only move if name changed
					this._removeRow(row);
					// Search moved to trash
					if (search.deleted) {
						this._refreshRowMap();
						this.selectAfterRowRemoval(selectedIndex);
					}
					// If search isn't in trash, add it back
					else {
						await this._addSortedRow('search', id);
						await this.selectByID(currentTreeRow.id);
					}
				}
				break;
			
			default:
				await this.reload();
				await this.selectByID(currentTreeRow.id);
				break;
			}
		}
		else if(action == 'add')
		{
			// skipSelect isn't necessary if more than one object
			let selectRow = ids.length == 1 && (!extraData[ids[0]] || !extraData[ids[0]].skipSelect);
			
			for (let id of ids) {
				switch (type) {
					case 'collection':
					case 'search':
						const addedIndex = await this._addSortedRow(type, id);
						
						if (selectRow) {
							if (type == 'collection') {
								await this.selectByID("C" + id);
							}
							else if (type == 'search') {
								await this.selectByID("S" + id);
							}
						}
						else if (addedIndex !== false && addedIndex <= this.selection.focused) {
							await this.selectWait(this.selection.focused+1);
						}
						
						break;
					
					case 'group':
					case 'feed':
						if (type == 'groups' && ids.length != 1) {
							Zotero.logError("WARNING: Multiple groups shouldn't currently be added "
								+ "together in collectionTree::notify()")
						}
						await this.reload();
						await this.selectByID(
							// Groups only come from sync, so they should never be auto-selected
							(type != 'group' && selectRow)
								? "L" + id
								: currentTreeRow.id
						);
						break;
				}
			}
		}

		this.forceUpdate();
		var promise = this.waitForSelect();
		this.selection.selectEventsSuppressed = false;
		return promise;
	}

	/**
	 * Set the rows that should be highlighted
	 *
	 * @param ids {String[]} list of row ids to be highlighted
	 */
	async setHighlightedRows(ids) {
		try {
			this._highlightedRows = new Set();
			
			if (!ids || !ids.length) {
				return;
			}
			
			// Make sure all highlighted collections are shown
			for (let id of ids) {
				if (id[0] == 'C') {
					await this.expandToCollection(parseInt(id.substr(1)));
				}
			}
			
			// Highlight rows
			var rows = [];
			for (let id of ids) {
				let row = this._rowMap[id];
				this._highlightedRows.add(id);
				rows.push(row);
			}
			rows.sort();
			// Select first collection
			// TODO: This is slightly annoying if some subsequent
			// but not the first row is visible
			if (rows.length) {
				this.ensureRowIsVisible(rows[0]);
			}
		} finally {
			this.tree.invalidate();
		}
	}

	/**
	 *
	 * @param rowID {String}
	 * @returns {Promise<boolean>}
	 */
	async expandToCollection(collectionID) {
		var col = await Zotero.Collections.getAsync(collectionID);
		if (!col) {
			Zotero.debug("Cannot expand to nonexistent collection " + collectionID, 2);
			return false;
		}
		
		// Open library if closed
		var libraryRow = this._rowMap['L' + col.libraryID];
		if (!this.isContainerOpen(libraryRow)) {
			await this.toggleOpenState(libraryRow);
		}
		
		var row = this._rowMap["C" + collectionID];
		if (row !== undefined) {
			return true;
		}
		var path = [];
		var parentID;
		while (parentID = col.parentID) {
			path.unshift(parentID);
			col = await Zotero.Collections.getAsync(parentID);
		}
		for (let id of path) {
			row = this._rowMap["C" + id];
			if (!this.isContainerOpen(row)) {
				await this.toggleOpenState(row);
			}
		}
		this.tree.invalidate();
		return true;
	}

	/**
	 * @param {Integer} libraryID
	 * @param {Boolean} [recursive=false] - Expand all collections and subcollections
	 */
	async expandLibrary(libraryID, recursive) {
		var row = this._rowMap['L' + libraryID];
		if (row === undefined) {
			return false;
		}
		if (!this.isContainerOpen(row)) {
			await this.toggleOpenState(row);
		}
		
		if (recursive) {
			for (let i = row; i < this._rows.length && this.getRow(i).ref.libraryID == libraryID; i++) {
				if (this.isContainer(i) && !this.isContainerOpen(i)) {
					await this.toggleOpenState(i);
				}
			}
		}
		
		this.tree.invalidate();
		this._saveOpenStates();
		return true;
	}
	
	collapseLibrary(libraryID) {
		var row = this._rowMap['L' + libraryID];
		if (row === undefined) {
			return false;
		}
		
		var closed = [];
		var found = false;
		for (let i = this._rows.length - 1; i >= row; i--) {
			let treeRow = this.getRow(i);
			if (treeRow.ref.libraryID !== libraryID) {
				// Once we've moved beyond the original library, stop looking
				if (found) {
					break;
				}
				continue;
			}
			found = true;
			
			if (this.isContainer(i) && this.isContainerOpen(i)) {
				closed.push(treeRow.id);
				this._closeContainer(i);
			}
		}
		
		// Select the collapsed library
		this.selection.select(row);
		
		// We have to manually delete closed rows from the container state object, because otherwise
		// _saveOpenStates() wouldn't see any of the rows under the library (since the library is now
		// collapsed) and they'd remain as open in the persisted object.
		closed.forEach(id => { delete this._containerState[id]; });
		
		this.tree.invalidate();
		this._saveOpenStates();
	}
	
	toggleOpenState = async (index) => {
		if (this.isContainerOpen(index)) {
			return this._closeContainer(index);
		}

		this.selection.selectEventsSuppressed = true;
		var count = 0;
		var treeRow = this.getRow(index);
		if (treeRow.isLibrary(true) || treeRow.isCollection()) {
			count = await this._expandRow(this._rows, index, true);
		}
		if (this.selection.focused > index) {
			this.selection.select(this.selection.focused + count);
		}
		this.selection.selectEventsSuppressed = false;
		
		this._rows[index].isOpen = true;
		this.tree.invalidate(index);
		this._refreshRowMap();
		this._saveOpenStates();
	}

	/**
	 * Toggle virtual collection (duplicates/unfiled) visibility
	 *
	 * @param libraryID {Number}
	 * @param type {String}
	 * @param show {Boolean}
	 * @returns {Promise}
	 */
	async toggleVirtualCollection(libraryID, type, show, select) {
		const types = {
			duplicates: 'D',
			unfiled: 'U',
			retracted: 'R'
		};
		if (!(type in types)) {
			throw new Error("Invalid virtual collection type '" + type + "'");
		}
		let treeViewID = types[type] + libraryID;
		
		Zotero.Prefs.setVirtualCollectionStateForLibrary(libraryID, type, show);
		
		var promise = this.waitForSelect();
		var selectedRow = this.selection.focused;
		var selectedRowID = this.getRow(selectedRow).id;
		
		await this.refresh();
		
		// Select new or original row
		if (show) {
			await this.selectByID(select ? treeViewID : selectedRowID);
		}
		else if (type == 'retracted') {
			await this.selectByID("L" + libraryID);
		}
		// Select next appropriate row after removal
		else {
			await this.selectWait(this.selection.focused);
		}
		this.selection.selectEventsSuppressed = false;
		
		return promise;
	}

	/**
	 * Deletes the selected collection and optionally items within it
	 *
	 * @param deleteItems[boolean] Whether items contained in the collection should be removed
	 * @returns {Promise<void>}
	 */
	async deleteSelection(deleteItems) {
		var treeRow = this.getRow(this.selection.focused);
		if (treeRow.isCollection() || treeRow.isFeed()) {
			await treeRow.ref.eraseTx({ deleteItems });
		}
		else if (treeRow.isSearch()) {
			await Zotero.Searches.erase(treeRow.ref.id);
		}
	}
	
	unregister() {
		this._uninitialized = true;
		Zotero.Notifier.unregisterObserver(this._unregisterID);
	}

////////////////////////////////////////////////////////////////////////////////
///
///  Component data access methods
///
////////////////////////////////////////////////////////////////////////////////

	get selectedTreeRow() {
		if (!this.selection || !this.selection.count) {
			return false;
		}
		return this.getRow(this.selection.focused);
	}

	/**
	 * Returns TRUE if the underlying view is editable
	 */
	get editable() {
		return this.getRow(this.selection.focused).editable;
	}
	
	/**
	 * Return libraryID of selected row (which could be a collection, etc.)
	 */
	getSelectedLibraryID() {
		var treeRow = this.getRow(this.selection.focused);
		return treeRow && treeRow.ref && treeRow.ref.libraryID !== undefined
			&& treeRow.ref.libraryID;
	}
	
	getSelectedCollection(asID) {
		var collection = this.getRow(this.selection.focused);
		if (collection && collection.isCollection()) {
			return asID ? collection.ref.id : collection.ref;
		}
	}
	
	getSelectedSearch(asID) {
		if (this.getRow(this.selection.focused)) {
			var search = this.getRow(this.selection.focused);
			if (search && search.isSearch()) {
				return asID ? search.ref.id : search.ref;
			}
		}
		return false;
	}
	
	getSelectedGroup(asID) {
		if (this.getRow(this.selection.focused)) {
			var group = this.getRow(this.selection.focused);
			if (group && group.isGroup()) {
				return asID ? group.ref.id : group.ref;
			}
		}
		return false;
	}


////////////////////////////////////////////////////////////////////////////////
///
///  Drag-and-drop methods
///
////////////////////////////////////////////////////////////////////////////////

	onDragStart(event, index) {
		const treeRow = this.getRow(index);
		// See note in #setDropEffect()
		if (Zotero.isWin || Zotero.isLinux) {
			event.dataTransfer.effectAllowed = 'copyMove';
		}
		
		if (!treeRow.isCollection()) {
			return;
		}
		event.dataTransfer.setData("zotero/collection", treeRow.ref.id);
		Zotero.debug("Dragging collection " + treeRow.id);
	}

	onDragOver(event, index) {
		if (!event.currentTarget.classList.contains('row')) return;
		const treeRow = this.getRow(index);
		try {
			// Prevent modifier keys from doing their normal things
			event.preventDefault();
			Zotero.DragDrop.currentOrientation = getDragTargetOrient(event);
			
			if (!this.canDropCheck(index, Zotero.DragDrop.currentOrientation, event.dataTransfer)) {
				this.setDropEffect(event, "none");
				return;
			}
			
			if (event.dataTransfer.getData("zotero/item")) {
				var sourceCollectionTreeRow = Zotero.DragDrop.getDragSource(event.dataTransfer);
				if (sourceCollectionTreeRow) {
					var targetCollectionTreeRow = treeRow;
					
					if (sourceCollectionTreeRow.id == targetCollectionTreeRow.id) {
						// Ignore drag into the same collection
						this.setDropEffect(event, "none");
						return false;
					}
					// If the source isn't a collection, the action has to be a copy
					if (!sourceCollectionTreeRow.isCollection()) {
						this.setDropEffect(event, "copy");
						return false;
					}
					// For now, all cross-library drags are copies
					if (sourceCollectionTreeRow.ref.libraryID != targetCollectionTreeRow.ref.libraryID) {
						this.setDropEffect(event, "copy");
						return false;
					}
				}
				
				if ((Zotero.isMac && event.metaKey) || (!Zotero.isMac && event.shiftKey)) {
					this.setDropEffect(event, "move");
				}
				else {
					this.setDropEffect(event, "copy");
				}
			}
			else if (event.dataTransfer.getData("zotero/collection")) {
				let collectionID = Zotero.DragDrop.getDataFromDataTransfer(event.dataTransfer).data[0];
				let { libraryID: sourceLibraryID } = Zotero.Collections.getLibraryAndKeyFromID(collectionID);
				
				var targetCollectionTreeRow = treeRow;
				
				// For now, all cross-library drags are copies
				if (sourceLibraryID != targetCollectionTreeRow.ref.libraryID) {
					/*if ((Zotero.isMac && event.metaKey) || (!Zotero.isMac && event.shiftKey)) {
						this.setDropEffect(event, "move");
					}
					else {
						this.setDropEffect(event, "copy");
					}*/
					this.setDropEffect(event, "copy");
					return false;
				}
				
				// And everything else is a move
				this.setDropEffect(event, "move");
			}
			else if (event.dataTransfer.types.contains("application/x-moz-file")) {
				// As of Aug. 2013 nightlies:
				//
				// - Setting the dropEffect only works on Linux and OS X.
				//
				// - Modifier keys don't show up in the drag event on OS X until the
				//   drop (https://bugzilla.mozilla.org/show_bug.cgi?id=911918),
				//   so since we can't show a correct effect, we leave it at
				//   the default 'move', the least misleading option, and set it
				//   below in onDrop().
				//
				// - The cursor effect gets set by the system on Windows 7 and can't
				//   be overridden.
				if (!Zotero.isMac) {
					if (event.shiftKey) {
						if (event.ctrlKey) {
							event.dataTransfer.dropEffect = "link";
						}
						else {
							event.dataTransfer.dropEffect = "move";
						}
					}
					else {
						event.dataTransfer.dropEffect = "copy";
					}
				}
			}
			return false;
		} finally {
			let prevDropRow = this._dropRow;
			if (event.dataTransfer.dropEffect != 'none') {
				this._dropRow = index;
			} else {
				this._dropRow = null;
			}
			if (prevDropRow != this._dropRow) {
				typeof prevDropRow == 'number' && this.tree.invalidateRow(prevDropRow);
				this.tree.invalidateRow(index);
			}
		}
	}
	
	onDragEnd = () => {
		let dropRow = this._dropRow;
		this._dropRow = null;
		this.tree.invalidateRow(dropRow);
	}
	
	onDragLeave = (e) => {
		if (!e.currentTarget.classList.contains('row')) return;
		let dropRow = this._dropRow;
		this._dropRow = null;
		this.tree.invalidateRow(dropRow);
	}

	canDropCheck = (row, orient, dataTransfer) => {
		const treeRow = this.getRow(row);
		// TEMP
		Zotero.debug("Row is " + row + "; orient is " + orient);
		
		var dragData = Zotero.DragDrop.getDataFromDataTransfer(dataTransfer);
		if (!dragData) {
			Zotero.debug("No drag data");
			return false;
		}
		var {dataType, data} = dragData;
		
		// Directly on a row
		if (orient === 0) {
			if (!treeRow.editable) {
				// Zotero.debug("Drop target not editable");
				return false;
			}
			
			if (dataType == 'zotero/item') {
				// TODO: Is this still required?
				if (treeRow.isBucket()) {
					return true;
				}

				var ids = data;
				var items = Zotero.Items.get(ids);
				items = Zotero.Items.keepParents(items);
				var skip = true;
				for (let item of items) {
					// Can only drag top-level items
					if (!item.isTopLevelItem()) {
						Zotero.debug("Can't drag child item");
						return false;
					}
					
					if (treeRow.isWithinGroup() && item.isAttachment()) {
						// Linked files can't be added to groups
						if (item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
							Zotero.debug("Linked files cannot be added to groups");
							return false;
						}
						if (!treeRow.filesEditable) {
							Zotero.debug("Drop target does not allow files to be edited");
							return false;
						}
						skip = false;
						continue;
					}
					
					if (treeRow.isPublications()) {
						if (item.isAttachment() || item.isNote()) {
							Zotero.debug("Top-level attachments and notes cannot be added to My Publications");
							return false;
						}
						if(item instanceof Zotero.FeedItem) {
							Zotero.debug("FeedItems cannot be added to My Publications");
							return false;
						}
						if (item.inPublications) {
							Zotero.debug("Item " + item.id + " already exists in My Publications");
							continue;
						}
						if (treeRow.ref.libraryID != item.libraryID) {
							Zotero.debug("Cross-library drag to My Publications not allowed");
							continue;
						}
						skip = false;
						continue;
					}
					
					// Cross-library drag
					if (treeRow.ref.libraryID != item.libraryID) {
						// Only allow cross-library drag to root library and collections
						if (!(treeRow.isLibrary(true) || treeRow.isCollection())) {
							Zotero.debug("Cross-library drag to non-collection not allowed");
							return false;
						}
						skip = false;
						continue;
					}
					
					// Intra-library drag
					
					// Don't allow drag onto root of same library
					if (treeRow.isLibrary(true)) {
						Zotero.debug("Can't drag into same library root");
						return false;
					}
					
					// Make sure there's at least one item that's not already in this destination
					if (treeRow.isCollection()) {
						if (treeRow.ref.hasItem(item.id)) {
							Zotero.debug("Item " + item.id + " already exists in collection");
							continue;
						}
						skip = false;
						continue;
					}
				}
				if (skip) {
					Zotero.debug("Drag skipped");
					return false;
				}
				return true;
			}
			else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
				if (treeRow.isSearch() || treeRow.isPublications()) {
					return false;
				}
				if (dataType == 'application/x-moz-file') {
					// Don't allow folder drag
					if (data[0].isDirectory()) {
						return false;
					}
					// Don't allow drop if no permissions
					if (!treeRow.filesEditable) {
						return false;
					}
				}
				
				return true;
			}
			else if (dataType == 'zotero/collection') {
				if (!treeRow.isLibrary() && !treeRow.isCollection()) {
					return false;
				}
				
				let draggedCollectionID = data[0];
				let draggedCollection = Zotero.Collections.get(draggedCollectionID);
				
				if (treeRow.ref.libraryID == draggedCollection.libraryID) {
					// Collections cannot be dropped on themselves
					if (draggedCollectionID == treeRow.ref.id) {
						return false;
					}
					
					// Nor in their children
					if (draggedCollection.hasDescendent('collection', treeRow.ref.id)) {
						return false;
					}
				}
				// Dragging a collection to a different library
				else {
					// Allow cross-library drag only to root library and collections
					if (!treeRow.isLibrary(true) && !treeRow.isCollection()) {
						return false;
					}
				}
				
				return true;
			}
		}
		return false;	
	}
	
	async canDropCheckAsync(row, orient, dataTransfer) {
		//Zotero.debug("Row is " + row + "; orient is " + orient);
		
		var dragData = Zotero.DragDrop.getDataFromDataTransfer(dataTransfer);
		if (!dragData) {
			Zotero.debug("No drag data");
			return false;
		}
		var dataType = dragData.dataType;
		var data = dragData.data;
		
		if (orient == 0) {
			var treeRow = this.getRow(row); //the collection we are dragging over
			
			if (dataType == 'zotero/item' && treeRow.isBucket()) {
				return true;
			}
			
			if (dataType == 'zotero/item') {
				var ids = data;
				var items = Zotero.Items.get(ids);
				var skip = true;
				for (let i=0; i<items.length; i++) {
					let item = items[i];
					
					// Cross-library drag
					if (treeRow.ref.libraryID != item.libraryID) {
						let linkedItem = await item.getLinkedItem(treeRow.ref.libraryID, true);
						if (linkedItem && !linkedItem.deleted) {
							// For drag to root, skip if linked item exists
							if (treeRow.isLibrary(true)) {
								Zotero.debug("Linked item " + linkedItem.key + " already exists "
									+ "in library " + treeRow.ref.libraryID);
								continue;
							}
							// For drag to collection
							else if (treeRow.isCollection()) {
								// skip if linked item is already in it
								if (treeRow.ref.hasItem(linkedItem.id)) {
									Zotero.debug("Linked item " + linkedItem.key + " already exists "
										+ "in collection");
									continue;
								}
								// or if linked item is a child item
								else if (!linkedItem.isTopLevelItem()) {
									Zotero.debug("Linked item " + linkedItem.key + " already exists "
										+ "as child item");
									continue;
								}
							}
						}
						skip = false;
						continue;
					}
					
					// Intra-library drags have already been vetted by canDrop(). This 'break' should be
					// changed to a 'continue' if any asynchronous checks that stop the drag are added above
					skip = false;
					break;
				}
				if (skip) {
					Zotero.debug("Drag skipped");
					return false;
				}
			}
			else if (dataType == 'zotero/collection') {
				let draggedCollectionID = data[0];
				let draggedCollection = Zotero.Collections.get(draggedCollectionID);
				
				// Dragging a collection to a different library
				if (treeRow.ref.libraryID != draggedCollection.libraryID) {
					// Disallow if linked collection already exists
					if (await draggedCollection.getLinkedCollection(treeRow.ref.libraryID, true)) {
						Zotero.debug("Linked collection already exists in library");
						return false;
					}
					
					let descendents = draggedCollection.getDescendents(false, 'collection');
					for (let descendent of descendents) {
						descendent = Zotero.Collections.get(descendent.id);
						// Disallow if linked collection already exists for any subcollections
						//
						// If this is allowed in the future for the root collection,
						// need to allow drag only to root
						if (await descendent.getLinkedCollection(treeRow.ref.libraryID, true)) {
							Zotero.debug("Linked subcollection already exists in library");
							return false;
						}
					}
				}
			}
		}
		return true;
	}
	
	async onDrop(event, index) {
		const treeRow = this.getRow(index);
		this._dropRow = null;
		this.tree.invalidate();
		let orient = Zotero.DragDrop.currentOrientation;
		let row = this._rowMap[treeRow.id];
		let dataTransfer = event.dataTransfer;
		
		if (!dataTransfer.dropEffect || dataTransfer.dropEffect == "none"
				|| !(await this.canDropCheckAsync(row, orient, dataTransfer))) {
			return false;
		}
		
		var dragData = Zotero.DragDrop.getDataFromDataTransfer(dataTransfer);
		if (!dragData) {
			Zotero.debug("No drag data");
			return false;
		}
		var dropEffect = dragData.dropEffect;
		var dataType = dragData.dataType;
		var data = dragData.data;
		var sourceTreeRow = Zotero.DragDrop.getDragSource(dataTransfer);
		var targetTreeRow = treeRow;
		
		var copyOptions = {
			tags: Zotero.Prefs.get('groups.copyTags'),
			childNotes: Zotero.Prefs.get('groups.copyChildNotes'),
			childLinks: Zotero.Prefs.get('groups.copyChildLinks'),
			childFileAttachments: Zotero.Prefs.get('groups.copyChildFileAttachments')
		};
		var copyItem = async function (item, targetLibraryID, options) {
			var targetLibraryType = Zotero.Libraries.get(targetLibraryID).libraryType;
			
			// Check if there's already a copy of this item in the library
			var linkedItem = await item.getLinkedItem(targetLibraryID, true);
			if (linkedItem) {
				// If linked item is in the trash, undelete it and remove it from collections
				// (since it shouldn't be restored to previous collections)
				if (linkedItem.deleted) {
					linkedItem.setCollections();
					linkedItem.deleted = false;
					await linkedItem.save({
						skipSelect: true
					});
				}
				return linkedItem.id;
				
				/*
				// TODO: support tags, related, attachments, etc.
				
				// Overlay source item fields on unsaved clone of linked item
				var newItem = item.clone(false, linkedItem.clone(true));
				newItem.setField('dateAdded', item.dateAdded);
				newItem.setField('dateModified', item.dateModified);
				
				var diff = newItem.diff(linkedItem, false, ["dateAdded", "dateModified"]);
				if (!diff) {
					// Check if creators changed
					var creatorsChanged = false;
					
					var creators = item.getCreators();
					var linkedCreators = linkedItem.getCreators();
					if (creators.length != linkedCreators.length) {
						Zotero.debug('Creators have changed');
						creatorsChanged = true;
					}
					else {
						for (var i=0; i<creators.length; i++) {
							if (!creators[i].ref.equals(linkedCreators[i].ref)) {
								Zotero.debug('changed');
								creatorsChanged = true;
								break;
							}
						}
					}
					if (!creatorsChanged) {
						Zotero.debug("Linked item hasn't changed -- skipping conflict resolution");
						continue;
					}
				}
				toReconcile.push([newItem, linkedItem]);
				continue;
				*/
			}
			
			// Standalone attachment
			if (item.isAttachment()) {
				var linkMode = item.attachmentLinkMode;
				
				// Skip linked files
				if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
					Zotero.debug("Skipping standalone linked file attachment on drag");
					return false;
				}
				
				if (!targetTreeRow.filesEditable) {
					Zotero.debug("Skipping standalone file attachment on drag");
					return false;
				}
				
				return Zotero.Attachments.copyAttachmentToLibrary(item, targetLibraryID);
			}
			
			// Create new clone item in target library
			var newItem = item.clone(targetLibraryID, { skipTags: !options.tags });
			
			var newItemID = await newItem.save({
				skipSelect: true
			});
			
			// Record link
			await newItem.addLinkedItem(item);
			
			if (item.isNote()) {
				return newItemID;
			}
			
			// For regular items, add child items if prefs and permissions allow
			
			// Child notes
			if (options.childNotes) {
				var noteIDs = item.getNotes();
				var notes = Zotero.Items.get(noteIDs);
				for (let note of notes) {
					let newNote = note.clone(targetLibraryID, { skipTags: !options.tags });
					newNote.parentID = newItemID;
					await newNote.save({
						skipSelect: true
					})
					
					await newNote.addLinkedItem(note);
				}
			}
			
			// Child attachments
			if (options.childLinks || options.childFileAttachments) {
				var attachmentIDs = item.getAttachments();
				var attachments = Zotero.Items.get(attachmentIDs);
				for (let attachment of attachments) {
					var linkMode = attachment.attachmentLinkMode;
					
					// Skip linked files
					if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
						Zotero.debug("Skipping child linked file attachment on drag");
						continue;
					}
					
					// Skip imported files if we don't have pref and permissions
					if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
						if (!options.childLinks) {
							Zotero.debug("Skipping child link attachment on drag");
							continue;
						}
					}
					else {
						if (!options.childFileAttachments
								|| (!targetTreeRow.filesEditable && !targetTreeRow.isPublications())) {
							Zotero.debug("Skipping child file attachment on drag");
							continue;
						}
					}
					await Zotero.Attachments.copyAttachmentToLibrary(attachment, targetLibraryID, newItemID);
				}
			}
			
			return newItemID;
		};
		
		var targetLibraryID = targetTreeRow.ref.libraryID;
		var targetCollectionID = targetTreeRow.isCollection() ? targetTreeRow.ref.id : false;
		
		if (dataType == 'zotero/collection') {
			var droppedCollection = await Zotero.Collections.getAsync(data[0]);
			
			// Collection drag between libraries
			if (targetLibraryID != droppedCollection.libraryID) {
				await Zotero.DB.executeTransaction(async function () {
					var copyCollections = async function (descendents, parentID, addItems) {
						for (var desc of descendents) {
							// Collections
							if (desc.type == 'collection') {
								var c = await Zotero.Collections.getAsync(desc.id);
								let newCollection = c.clone(targetLibraryID);
								if (parentID) {
									newCollection.parentID = parentID;
								}
								var collectionID = await newCollection.save();
								
								// Record link
								await newCollection.addLinkedCollection(c);
								
								// Recursively copy subcollections
								if (desc.children.length) {
									await copyCollections(desc.children, collectionID, addItems);
								}
							}
							// Items
							else {
								var item = await Zotero.Items.getAsync(desc.id);
								var id = await copyItem(item, targetLibraryID, copyOptions);
								// Standalone attachments might not get copied
								if (!id) {
									continue;
								}
								// Mark copied item for adding to collection
								if (parentID) {
									let parentItems = addItems.get(parentID);
									if (!parentItems) {
										parentItems = [];
										addItems.set(parentID, parentItems);
									}
									
									// If source item is a top-level non-regular item (which can exist in a
									// collection) but target item is a child item (which can't), add
									// target item's parent to collection instead
									if (!item.isRegularItem()) {
										let targetItem = await Zotero.Items.getAsync(id);
										let targetItemParentID = targetItem.parentItemID;
										if (targetItemParentID) {
											id = targetItemParentID;
										}
									}
									
									parentItems.push(id);
								}
							}
						}
					};
					
					var collections = [{
						id: droppedCollection.id,
						children: droppedCollection.getDescendents(true),
						type: 'collection'
					}];
					
					var addItems = new Map();
					await copyCollections(collections, targetCollectionID, addItems);
					for (let [collectionID, items] of addItems.entries()) {
						let collection = await Zotero.Collections.getAsync(collectionID);
						await collection.addItems(items);
					}
					
					// TODO: add subcollections and subitems, if they don't already exist,
					// and display a warning if any of the subcollections already exist
				});
			}
			// Collection drag within a library
			else {
				droppedCollection.parentID = targetCollectionID;
				await droppedCollection.saveTx();
			}
		}
		else if (dataType == 'zotero/item') {
			var ids = data;
			if (ids.length < 1) {
				return;
			}
			
			if (targetTreeRow.isBucket()) {
				targetTreeRow.ref.uploadItems(ids);
				return;
			}
			
			var items = await Zotero.Items.getAsync(ids);
			if (items.length == 0) {
				return;
			}
			
			if (items[0] instanceof Zotero.FeedItem) {
				if (!(targetTreeRow.isCollection() || targetTreeRow.isLibrary() || targetTreeRow.isGroup())) {
					return;
				}
				
				let promises = [];
				for (let item of items) {
					// No transaction, because most time is spent traversing urls
					promises.push(item.translate(targetLibraryID, targetCollectionID))
				}
				return Zotero.Promise.all(promises);	
			}
			
			if (targetTreeRow.isPublications()) {
				items = Zotero.Items.keepParents(items);
				let io = window.ZoteroPane.showPublicationsWizard(items);
				if (!io) {
					return;
				}
				copyOptions.childNotes = io.includeNotes;
				copyOptions.childFileAttachments = io.includeFiles;
				copyOptions.childLinks = true;
				['keepRights', 'license', 'licenseName'].forEach(function (field) {
					copyOptions[field] = io[field];
				});
			}
			
			let newItems = [];
			let newIDs = [];
			let toMove = [];
			// TODO: support items coming from different sources?
			let sameLibrary = items[0].libraryID == targetLibraryID
			
			for (let item of items) {
				if (!item.isTopLevelItem()) {
					continue;
				}
				
				newItems.push(item);
				
				if (sameLibrary) {
					newIDs.push(item.id);
					toMove.push(item.id);
				}
			}
			
			if (!sameLibrary) {
				let toReconcile = [];
				
				await Zotero.Utilities.Internal.forEachChunkAsync(
					newItems,
					100,
					function (chunk) {
						return Zotero.DB.executeTransaction(async function () {
							for (let item of chunk) {
								var id = await copyItem(item, targetLibraryID, copyOptions)
								// Standalone attachments might not get copied
								if (!id) {
									continue;
								}
								newIDs.push(id);
							}
						});
					}
				);
				
				if (toReconcile.length) {
					let sourceName = Zotero.Libraries.getName(items[0].libraryID);
					let targetName = Zotero.Libraries.getName(targetLibraryID);
					
					let io = {
						dataIn: {
							type: "item",
							captions: [
								// TODO: localize
								sourceName,
								targetName,
								"Merged Item"
							],
							objects: toReconcile
						}
					};
					
					/*
					if (type == 'item') {
						if (!Zotero.Utilities.isEmpty(changedCreators)) {
							io.dataIn.changedCreators = changedCreators;
						}
					}
					*/
					
					window.openDialog('chrome://zotero/content/merge.xul', '', 'chrome,modal,centerscreen', io);
					
					await Zotero.DB.executeTransaction(async function () {
						// DEBUG: This probably needs to be updated if this starts being used
						for (let obj of io.dataOut) {
							await obj.ref.save();
						}
					});
				}
			}
			
			// Add items to target collection
			if (targetCollectionID) {
				let ids = newIDs.filter(itemID => Zotero.Items.get(itemID).isTopLevelItem());
				await Zotero.DB.executeTransaction(async function () {
					let collection = await Zotero.Collections.getAsync(targetCollectionID);
					await collection.addItems(ids);
				}.bind(this));
			}
			else if (targetTreeRow.isPublications()) {
				await Zotero.Items.addToPublications(newItems, copyOptions);
			}
			
			// If moving, remove items from source collection
			if (dropEffect == 'move' && toMove.length) {
				if (!sameLibrary) {
					throw new Error("Cannot move items between libraries");
				}
				if (!sourceTreeRow || !sourceTreeRow.isCollection()) {
					throw new Error("Drag source must be a collection for move action");
				}
				await Zotero.DB.executeTransaction(async function () {
					await sourceTreeRow.ref.removeItems(toMove);
				}.bind(this));
			}
		}
		else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
			var targetLibraryID = targetTreeRow.ref.libraryID;
			if (targetTreeRow.isCollection()) {
				var parentCollectionID = targetTreeRow.ref.id;
			}
			else {
				var parentCollectionID = false;
			}
			var addedItems = [];
			
			for (var i=0; i<data.length; i++) {
				var file = data[i];

				let item;
				if (dataType == 'text/x-moz-url') {
					var url = data[i];
				
					// Still string, so remote URL
					if (typeof file == 'string') {
						window.ZoteroPane.addItemFromURL(url, 'temporaryPDFHack', null, row); // TODO: don't do this
						continue;
					}
					
					// Otherwise file, so fall through
				}
				
				if (dropEffect == 'link') {
					item = await Zotero.Attachments.linkFromFile({
						file: file,
						collections: parentCollectionID ? [parentCollectionID] : undefined
					});
				}
				else {
					item = await Zotero.Attachments.importFromFile({
						file: file,
						libraryID: targetLibraryID,
						collections: parentCollectionID ? [parentCollectionID] : undefined
					});
					// If moving, delete original file
					if (dragData.dropEffect == 'move') {
						try {
							file.remove(false);
						}
						catch (e) {
							Cu.reportError("Error deleting original file " + file.path + " after drag");
						}
					}
				}
				
				addedItems.push(item);
			}
			
			// Automatically retrieve metadata for PDFs
			Zotero.RecognizePDF.autoRecognizeItems(addedItems);
		}
	}

////////////////////////////////////////////////////////////////////////////////
///
///  Private methods
///
////////////////////////////////////////////////////////////////////////////////

	isContainer = (index) => {
		return this.getRow(index).isContainer();
	}
	
	isContainerOpen = (index) => {
		return this.getRow(index).isOpen;
	}

	isContainerEmpty = (index) => {
		var treeRow = this.getRow(index);
		if (treeRow.isLibrary()) {
			return false;
		}
		if (treeRow.isBucket()) {
			return true;
		}
		if (treeRow.isGroup()) {
			var libraryID = treeRow.ref.libraryID;
			
			return !treeRow.ref.hasCollections()
					&& !treeRow.ref.hasSearches()
					// Duplicate Items not shown
					&& (this.hideSources.indexOf('duplicates') != -1
						|| this._virtualCollectionLibraries.duplicates[libraryID] === false)
					// Unfiled Items not shown
					&& this._virtualCollectionLibraries.unfiled[libraryID] === false
					&& this.hideSources.indexOf('trash') != -1;
		}
		if (treeRow.isCollection()) {
			return !treeRow.ref.hasChildCollections();
		}
		return true;
	}
	
	isSelectable = index => {
		let treeRow = this.getRow(index);
		return !(treeRow.isSeparator() || treeRow.isHeader());
	}

	_closeContainer(row, skipMap) {
		if (!this.isContainerOpen(row)) return;
		
		this.selection.selectEventsSuppressed = true;
		let selectParent = this.getParentIndex(this.selection.focused);
		while (selectParent != -1) {
			if (selectParent === row) this.selection.select(row);
			selectParent = this.getParentIndex(selectParent);
		}
		
		var level = this.getLevel(row);
		var nextRow = row + 1;
		
		// Remove child rows
		while ((nextRow < this._rows.length) && (this.getLevel(nextRow) > level)) {
			this._removeRow(nextRow, true);
		}
		this.selection.selectEventsSuppressed = false;
		
		this._rows[row].isOpen = false;
		this._refreshRowMap();
		this._saveOpenStates();
		this.tree.invalidate();
	}
	
	_getIcon(index) {
		const treeRow = this.getRow(index);
		var collectionType = treeRow.type;
		
		if (collectionType == 'group') {
			collectionType = 'Library';
		}
		let iconClsName;
		
		switch (collectionType) {
			case 'library':
			case 'feed':
				// Better alternative needed: https://github.com/zotero/zotero/pull/902#issuecomment-183185973
				/*
				if (treeRow.ref.updating) {
					collectionType += 'Updating';
				} else */if (treeRow.ref.lastCheckError) {
					collectionType += 'Error';
				}
				break;
			
			case 'trash':
				if (this._trashNotEmpty[treeRow.ref.libraryID]) {
					collectionType += 'Full';
				}
				break;
			
			case 'header':
				if (treeRow.ref.id == 'group-libraries-header') {
					collectionType = 'Groups';
				}
				else if (treeRow.ref.id == 'feed-libraries-header') {
					collectionType = 'FeedLibrary';
				}
				else if (treeRow.ref.id == 'commons-header') {
					collectionType = 'Commons';
				}
				break;
			
			case 'publications':
				iconClsName = "IconTreeitemJournalArticle";
				break;

			case 'retracted':
				iconClsName = "IconCross";
				break;
		}
		
		collectionType = Zotero.Utilities.capitalize(collectionType);
		iconClsName = iconClsName || "IconTreesource" + collectionType;

		if (collectionType == 'Separator') {
			return document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
		}
		
		var icon = getDOMIcon(iconClsName);
		if (!icon) {
			return document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
		}
		return icon;
	}

	/**
	 * Persist the current open/closed state of rows to a pref
	 */
	_saveOpenStates = Zotero.Utilities.debounce(async function() {
		var state = this._containerState;
		
		// Every so often, remove obsolete rows
		if (Math.random() < 1/20) {
			Zotero.debug("Purging sourceList.persist");
			for (var id in state) {
				var m = id.match(/^C([0-9]+)$/);
				if (m) {
					if (!(await Zotero.Collections.getAsync(parseInt(m[1])))) {
						delete state[id];
					}
					continue;
				}
				
				var m = id.match(/^G([0-9]+)$/);
				if (m) {
					if (!Zotero.Groups.get(parseInt(m[1]))) {
						delete state[id];
					}
					continue;
				}
			}
		}
		
		for (var i = 0, len = this._rows.length; i < len; i++) {
			var treeRow = this.getRow(i);
			if (!treeRow.isContainer()) {
				continue;
			}
			
			var open = this.isContainerOpen(i);
			
			if ((!open && treeRow.isCollection())) {
				delete state[treeRow.id];
				continue;
			}
			
			state[treeRow.id] = open;
		}
		
		this._containerState = state;
		this._storeOpenStates = state;
	});
	
	_storeOpenStates = Zotero.Utilities.debounce(function(state) {
		Zotero.Prefs.set("sourceList.persist", JSON.stringify(state));
	})

	async _expandRow(rows, row, forceOpen) {
		var treeRow = rows[row];
		var level = rows[row].level;
		var isLibrary = treeRow.isLibrary(true);
		var isCollection = treeRow.isCollection();
		var libraryID = treeRow.ref.libraryID;
		
		if (treeRow.isPublications() || treeRow.isFeed()) {
			return false;
		}
		
		if (isLibrary) {
			var collections = Zotero.Collections.getByLibrary(libraryID);
		}
		else if (isCollection) {
			var collections = Zotero.Collections.getByParent(treeRow.ref.id);
		}
		
		if (isLibrary) {
			var savedSearches = await Zotero.Searches.getAll(libraryID);
			// Virtual collections default to showing if not explicitly hidden
			var showDuplicates = this.hideSources.indexOf('duplicates') == -1
					&& this._virtualCollectionLibraries.duplicates[libraryID] !== false;
			var showUnfiled = this._virtualCollectionLibraries.unfiled[libraryID] !== false;
			var showRetracted = this._virtualCollectionLibraries.retracted[libraryID] !== false
				&& Zotero.Retractions.libraryHasRetractedItems(libraryID);
			var showPublications = libraryID == Zotero.Libraries.userLibraryID;
			var showTrash = this.hideSources.indexOf('trash') == -1;
		}
		else {
			var savedSearches = [];
			var showDuplicates = false;
			var showUnfiled = false;
			var showRetracted = false;
			var showPublications = false;
			var showTrash = false;
		}
		
		// If not a manual open and either the library is set to be collapsed or this is a collection that isn't explicitly opened,
		// set the initial state to closed
		if (!forceOpen
				&& (this._containerState[treeRow.id] === false
					|| (isCollection && !this._containerState[treeRow.id]))) {
			rows[row].isOpen = false;
			return 0;
		}

		var startOpen = !!(collections.length || savedSearches.length || showDuplicates || showUnfiled || showRetracted || showTrash);
		
		// If this isn't a manual open, set the initial state depending on whether
		// there are child nodes
		if (!forceOpen) {
			rows[row].isOpen = startOpen;
		}
		
		if (!startOpen) {
			return 0;
		}
		
		var newRows = 0;
		
		// Add collections
		for (var i = 0, len = collections.length; i < len; i++) {
			// Skip collections in trash
			if (collections[i].deleted) continue;
			let beforeRow = row + 1 + newRows;
			rows.splice(beforeRow, 0,
				new Zotero.CollectionTreeRow(this, 'collection', collections[i], level + 1));
			newRows++;
			// Recursively expand child collections that should be open
			newRows += await this._expandRow(rows, beforeRow);
		}
		
		if (isCollection) {
			return newRows;
		}
		
		// Add searches
		for (var i = 0, len = savedSearches.length; i < len; i++) {
			rows.splice(row + 1 + newRows, 0,
				new Zotero.CollectionTreeRow(this, 'search', savedSearches[i], level + 1));
			newRows++;
		}
		
		if (showPublications) {
			// Add "My Publications"
			rows.splice(row + 1 + newRows, 0,
				new Zotero.CollectionTreeRow(this,
					'publications',
					{
						libraryID,
						treeViewID: "P" + libraryID
					},
					level + 1
				)
			);
			newRows++;
		}
		
		// Duplicate items
		if (showDuplicates) {
			let d = new Zotero.Duplicates(libraryID);
			rows.splice(row + 1 + newRows, 0,
				new Zotero.CollectionTreeRow(this, 'duplicates', d, level + 1));
			newRows++;
		}
		
		// Unfiled items
		if (showUnfiled) {
			let s = new Zotero.Search;
			s.libraryID = libraryID;
			s.name = Zotero.getString('pane.collections.unfiled');
			s.addCondition('libraryID', 'is', libraryID);
			s.addCondition('unfiled', 'true');
			rows.splice(row + 1 + newRows, 0,
				new Zotero.CollectionTreeRow(this, 'unfiled', s, level + 1));
			newRows++;
		}

		// Retracted items
		if (showRetracted) {
			let s = new Zotero.Search;
			s.libraryID = libraryID;
			s.name = Zotero.getString('pane.collections.retracted');
			s.addCondition('libraryID', 'is', libraryID);
			s.addCondition('retracted', 'true');
			rows.splice(row + 1 + newRows, 0,
				new Zotero.CollectionTreeRow(this, 'retracted', s, level + 1, treeRow));
			newRows++;
		}
		
		if (showTrash) {
			let deletedItems = await Zotero.Items.getDeleted(libraryID);
			if (deletedItems.length || Zotero.Prefs.get("showTrashWhenEmpty")) {
				var ref = {
					libraryID: libraryID
				};
				rows.splice(row + 1 + newRows, 0,
					new Zotero.CollectionTreeRow(this, 'trash', ref, level + 1));
				newRows++;
			}
			this._trashNotEmpty[libraryID] = !!deletedItems.length;
		}
		
		return newRows;
	}

	/**
	 * Add a row in the appropriate place
	 *
	 * @param {String} objectType
	 * @param {Integer} id - collectionID
	 * @return {Integer|false} - Index at which the row was added, or false if it wasn't added
	 */
	async _addSortedRow(objectType, id) {
		let beforeRow;
		if (objectType == 'collection') {
			let collection = await Zotero.Collections.getAsync(id);
			let parentID = collection.parentID;
			
			// If parent isn't visible, don't add
			if (parentID && this._rowMap["C" + parentID] === undefined) {
				return false;
			}
			
			let libraryID = collection.libraryID;
			let startRow;
			if (parentID) {
				startRow = this._rowMap["C" + parentID];
			}
			else {
				startRow = this._rowMap['L' + libraryID];
			}
			
			// If container isn't open, don't add
			if (!this.isContainerOpen(startRow)) {
				return false;
			}
			
			let level = this.getLevel(startRow) + 1;
			// If container is empty, just add after
			if (this.isContainerEmpty(startRow)) {
				beforeRow = startRow + 1;
			}
			else {
				// Get all collections at the same level that don't have a different parent
				startRow++;
				loop:
				for (let i = startRow; i < this._rows.length; i++) {
					let treeRow = this.getRow(i);
					beforeRow = i;
					
					// Since collections come first, if we reach something that's not a collection,
					// stop
					if (!treeRow.isCollection()) {
						break;
					}
					
					let rowLevel = this.getLevel(i);
					if (rowLevel < level) {
						break;
					}
					else {
						// Fast forward through subcollections
						while (rowLevel > level) {
							beforeRow = ++i;
							if (i == this._rows.length || !this.getRow(i).isCollection()) {
								break loop;
							}
							treeRow = this.getRow(i);
							rowLevel = this.getLevel(i);
							// If going from lower level to a row higher than the target level, we found
							// our place:
							//
							// - 1
							//   - 3
							//     - 4
							// - 2 <<<< 5, a sibling of 3, goes above here
							if (rowLevel < level) {
								break loop;
							}
						}
						
						if (Zotero.localeCompare(treeRow.ref.name, collection.name) > 0) {
							break;
						}
					}
				}
			}
			this._addRow(
				new Zotero.CollectionTreeRow(this, 'collection', collection, level),
				beforeRow
			);
		}
		else if (objectType == 'search') {
			let search = Zotero.Searches.get(id);
			let libraryID = search.libraryID;
			let startRow = this._rowMap['L' + libraryID];
			
			// If container isn't open, don't add
			if (!this.isContainerOpen(startRow)) {
				return false;
			}
			
			let level = this.getLevel(startRow) + 1;
			// If container is empty, just add after
			if (this.isContainerEmpty(startRow)) {
				beforeRow = startRow + 1;
			}
			else {
				startRow++;
				for (let i = startRow; i < this._rows.length; i++) {
					let treeRow = this.getRow(i);
					beforeRow = i;
					
					// If we've reached something other than collections, stop
					if (treeRow.isSearch()) {
						// If current search sorts after, stop
						if (Zotero.localeCompare(treeRow.ref.name, search.name) > 0) {
							break;
						}
					}
					// If it's not a search and it's not a collection, stop
					else if (!treeRow.isCollection()) {
						break;
					}
				}
			}
			this._addRow(
				new Zotero.CollectionTreeRow(this, 'search', search, level),
				beforeRow
			);
		}

		let moveSelect = beforeRow + 1;
		if (moveSelect <= this.selection.focused) {
			while (!this.isSelectable(moveSelect)) {
				moveSelect++;
			}
			this.selection.select(moveSelect);
		}
		return beforeRow;
	}
}

module.exports = CollectionTree;
