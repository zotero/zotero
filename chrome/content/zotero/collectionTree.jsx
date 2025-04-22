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
const LibraryTree = require('./libraryTree');
const VirtualizedTable = require('components/virtualized-table');
const { getCSSIcon } = require('components/icons');
const { getDragTargetOrient } = require('components/utils');
const { noop } = require("./components/utils");
const PropTypes = require("prop-types");

const CHILD_INDENT = 16;

var CollectionTree = class CollectionTree extends LibraryTree {
	static async init(domEl, opts) {
		Zotero.debug("Initializing React CollectionTree");
		var ref;
		opts.domEl = domEl;
		await new Promise(resolve => {
			ReactDOM.createRoot(domEl).render(<CollectionTree ref={(c) => { ref = c; resolve()} } {...opts } />)
		});
		Zotero.debug('React CollectionTree initialized');
		return ref;
	}

	static defaultProps = {
		dragAndDrop: false,
		filterLibraryIDs: false,
		hideSources: [],
		onContextMenu: noop,
	};

	static propTypes = {
		onSelectionChange: PropTypes.func.isRequired,
		
		dragAndDrop: PropTypes.bool,
		filterLibraryIDs: PropTypes.array,
		hideSources: PropTypes.array,
		onContextMenu: PropTypes.func,
	};

	constructor(props) {
		super(props);
		this.itemTreeView = null;
		this.itemToSelect = null;

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
		this._dragoverRow = null;
		this._flashingRow = null;
		this._typingTimeout = null;
		this._customRowHeights = [];
		this._separatorHeight = 8;
		
		this._filter = "";
		this._filterResultsCache = {};
		this._filterInitialScrollPosition = null;
		this._filterInitialCollapsedRows = [];
		this._treeWasFocused = false;
		this._hiddenFocusedRow = null;
		this._expandedRowsOnDrag = new Set();
		this._expandRowOnHoverTimer = null;
		this._collapseExpandedRowsTimer = null;
		
		this.onLoad = this.createEventBinding('load', true, true);
	}
	
	async makeVisible() {
		await this.refresh();
		var lastViewedID = this.props.initialFolder || Zotero.Prefs.get('lastViewedFolder');
		if (lastViewedID) {
			var selected = await this.selectByID(lastViewedID);
		}
		if (!selected) {
			// If the last viewed folder was not selected, default to the first library from
			// filterLibraryIDs (if any), or the user library
			let libraryToSelect = ((this.props.filterLibraryIDs || [])[0] || Zotero.Libraries.userLibraryID);
			await this.selectByID('L' + libraryToSelect);
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
		if (this.props.dragAndDrop) {
			this.domEl.addEventListener('dragleave', this.onDragLeaveFromTheTree);
		}
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
		else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
			// Specific logic for keypress navigation during collection filtering
			// that skips context-rows
			if (!this._isFilterEmpty()) {
				this.focusNextMatchingRow(this.selection.focused, event.key == "ArrowUp", false);
				return false;
			}
		}
		else if (["ArrowRight", "ArrowLeft"].includes(event.key)) {
			// No collapsing rows with arrows to avoid focusing on context rows
			if (!this._isFilterEmpty()) {
				return false;
			}
		}
		else if (event.key == "End" && !this._isFilterEmpty()) {
			this.focusLastMatchingRow();
			return false;
		}
		else if (event.key == "Home" && !this._isFilterEmpty()) {
			this.focusFirstMatchingRow(true);
			return false;
		}
		return true;
	}
	
	_handleSelectionChange = (selection, shouldDebounce) => {
		let treeRow = this.getRow(selection.focused);
		// If selection changed (by click on a different row) and we are editing
		// commit the edit
		if (this._editing) {
			if (this._editing == treeRow) return;
			this.commitEditingName(this._editing);
			this._editing = null;
		}
		// If the filter is on, the last row can be a previously focused
		// row that does not match the filter. If the focus moves
		// away to another row, we can delete it.
		if (!this._isFilterEmpty() && this._hiddenFocusedRow && treeRow) {
			if (this._hiddenFocusedRow.isCollection()
				|| this._hiddenFocusedRow.isGroup()
				|| this._hiddenFocusedRow.isSearch()
				|| this._hiddenFocusedRow.isFeed()) {
				if (!this._includedInTree(this._hiddenFocusedRow.ref) && treeRow.id !== this._hiddenFocusedRow.id) {
					let indexToDelete = this.getRowIndexByID(this._hiddenFocusedRow.id);
					if (indexToDelete) {
						this._removeRow(indexToDelete);
						this._hiddenFocusedRow = null;
					}
				}
			}
		}
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
		if (treeRow.isCollection() && this.editable && this.selection.focused == index) {
			this.startEditing(treeRow);
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
		else if (treeRow.isFeed()) {
			window.ZoteroPane.editSelectedFeed();
		}
		else if (treeRow.isGroup()) {
			let uri = Zotero.URI.getGroupURI(treeRow.ref, true);
			window.ZoteroPane.loadURI(uri);
		}
	}
	
	handleEditingChange = (event, index) => {
		this.getRow(index).editingName = event.target.value;
	}

	async commitEditingName() {
		let treeRow = this._editing;
		if (!treeRow.editingName) return;
		treeRow.ref.name = treeRow.editingName;
		delete treeRow.editingName;
		await treeRow.ref.saveTx();
		window.Zotero_Tabs.rename("zotero-pane", treeRow.ref.name);
	}
	
	startEditing = (treeRow) => {
		if (!treeRow.isCollection()) {
			throw new Error('Only collections can be edited inline');
		}
		this._editing = treeRow;
		treeRow.editingName = treeRow.ref.name;
		this.tree.invalidateRow(this._rowMap[treeRow.id]);
	};
	
	stopEditing = () => {
		this._editing = null;
		this._editingInput = null;
		// Returning focus to the tree container
		this.tree.invalidate();
		this.tree.focus();
	}

	renderItem = (index, selection, oldDiv, columns) => {
		const treeRow = this.getRow(index);
		
		// Div creation and content
		let div = oldDiv || document.createElement('div');
		div.innerHTML = "";
		// When a hidden focused row is added last during filtering, it
		// is removed on focus change, which can happen at the same time as rendering.
		// In this case, just return empty div.
		if (index >= this._rows.length) {
			return div;
		}
		
		// Classes
		div.className = "row";
		div.classList.toggle('selected', selection.isSelected(index));
		div.classList.toggle('highlighted', this._highlightedRows.has(treeRow.id));
		div.classList.toggle('drop', this._dropRow == index);
		div.classList.toggle('flashing', this._flashingRow == index);
		div.classList.toggle('unread', treeRow.ref && treeRow.ref.unreadCount > 0);
		let { matchesFilter, hasChildMatchingFilter } = this._matchesFilter(treeRow.ref);
		div.classList.toggle('context-row', !matchesFilter && hasChildMatchingFilter);
		// Hide currently focused but filtered out row to avoid confusing itemTree
		if (this._hiddenFocusedRow && this._hiddenFocusedRow.id == treeRow.id) {
			div.style.display = "none";
		}
		else if (div.style.display == "none") {
			// Make sure we unhide the div if the row matches filter conditions
			div.style.display = "";
		}

		// Depth indent
		let depth = treeRow.level;
		// The arrow on macOS is a full icon's width.
		// For non-userLibrary/feed items that are drawn under headers
		// we do not draw the arrow and need to move all items 1 level up
		if (Zotero.isMac && !treeRow.isHeader() && !treeRow.isFeed()
				&& treeRow.ref && treeRow.ref.libraryID != Zotero.Libraries.userLibraryID) {
			depth--;
		}
		// Ensures the feeds row has no padding
		if (treeRow.isFeeds()) {
			depth = 0;
		}
		div.style.paddingInlineStart = (CHILD_INDENT * depth) + 'px';
		
		// Create a single-cell for the row (for the single-column layout)
		let cell = document.createElement('span');
		cell.className = "cell label primary";
		
		// Twisty/spacer
		let twisty;
		if (this.isContainerEmpty(index) || !hasChildMatchingFilter) {
			twisty = document.createElement('span');
			if (Zotero.isMac && treeRow.isHeader()) {
				twisty.classList.add("spacer-header");
			}
			else {
				twisty.classList.add("spacer-twisty");
			}
		}
		else {
			twisty = getCSSIcon("twisty");
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
		let label = document.createElement('span');
		label.innerText = treeRow.getName();
		label.className = 'cell-text';
		label.dir = 'auto';

		// Editing input
		div.classList.toggle('editing', treeRow == this._editing);
		if (treeRow == this._editing) {
			if (this._editingInput
					&& this._editingInput.dataset.rowId === treeRow.id
					&& this._editingInput.value === treeRow.editingName) {
				label = this._editingInput;
				// Feels like a bit of a hack, but it gets the job done
				setTimeout(() => {
					label.focus();
				});
			}
			else {
				label = this._editingInput = document.createElement('input');
				label.className = 'cell-text';
				label.dataset.rowId = treeRow.id;
				label.setAttribute("size", 5);
				label.toggleAttribute("no-windows-native", true);
				label.value = treeRow.editingName;
				label.addEventListener('input', e => this.handleEditingChange(e, index));
				label.addEventListener('mousedown', (e) => e.stopImmediatePropagation());
				label.addEventListener('mouseup', (e) => e.stopImmediatePropagation());
				label.addEventListener('dblclick', (e) => e.stopImmediatePropagation());
				label.addEventListener('blur', async (e) => {
					await this.commitEditingName();
					this.stopEditing();
				});
				setTimeout(() => {
					label.focus();
					label.select();
				});
			}
		}

		cell.appendChild(twisty);
		cell.appendChild(icon);
		cell.appendChild(label);
		div.appendChild(cell);
		
		// Accessibility
		div.setAttribute('aria-level', depth+1);
		if (!this.isContainerEmpty(index)) {
			div.setAttribute('aria-expanded', this.isContainerOpen(index));
		}
		div.setAttribute('role', 'treeitem');
		if (treeRow.isSeparator()) {
			div.setAttribute('role', 'none');
		}
		let children = [];
		for (let i = index + 1; ; i++) {
			let row = this.getRow(i);
			if (!row || treeRow.level >= row.level) break;
			children.push(this.id + '-row-' + i);
		}

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

		// since row has been re-rendered, if it has been toggled open/close, we need to force twisty animation
		if (this._lastToggleOpenStateIndex === index) {
			let twisty = div.querySelector('.twisty');
			if (twisty) {
				twisty.classList.toggle('open', !this.isContainerOpen(index));
				setTimeout(() => {
					twisty.classList.toggle('open', this.isContainerOpen(index));
				}, 0);
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
				alternatingRowColors: null,

				onSelectionChange: this._handleSelectionChange,
				isSelectable: this.isSelectable,
				getParentIndex: this.getParentIndex,
				isContainer: this.isContainer,
				isContainerEmpty: this.isContainerEmpty,
				isContainerOpen: this.isContainerOpen,
				toggleOpenState: this.toggleOpenState,
				getRowString: this.getRowString.bind(this),
				
				onItemContextMenu: (...args) => this.props.onContextMenu && this.props.onContextMenu(...args),

				onKeyDown: this.handleKeyDown,
				onActivate: (...args) => (this.props.onActivate ? this.props.onActivate(...args) : this.handleActivate(...args)),

				role: 'tree',
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
			
			if (this.props.hideSources.indexOf('duplicates') == -1) {
				this._virtualCollectionLibraries.duplicates =
					Zotero.Prefs.getVirtualCollectionState('duplicates');
			}
			this._virtualCollectionLibraries.unfiled =
					Zotero.Prefs.getVirtualCollectionState('unfiled');
			this._virtualCollectionLibraries.retracted =
				Zotero.Prefs.getVirtualCollectionState('retracted');
			
			var newRows = [];
			var added = 0;
			this._filterResultsCache = {};
			let libraryIncluded, groupsIncluded, feedsIncluded;
			//
			// Add "My Library"
			//
			libraryIncluded = this._includedInTree({ libraryID: Zotero.Libraries.userLibraryID });
			if (libraryIncluded) {
				newRows.splice(added++, 0,
					new Zotero.CollectionTreeRow(this, 'library', Zotero.Libraries.userLibrary));
				newRows[0].isOpen = true;
				added += await this._expandRow(newRows, 0);
			}
			
			// Add groups
			var groups = Zotero.Groups.getAll();
			groupsIncluded = groups.some(group => this._includedInTree(group));
			if (groups.length && groupsIncluded) {
				if (libraryIncluded) {
					newRows.splice(added++, 0, new Zotero.CollectionTreeRow(this, 'separator', false, 0));
				}
				let groupHeader = new Zotero.CollectionTreeRow(this, 'header', {
					id: "group-libraries-header",
					label: Zotero.getString('pane.collections.groupLibraries'),
					libraryID: -1
				});
				newRows.splice(added++, 0, groupHeader);
				for (let group of groups) {
					if (!this._includedInTree(group)) continue;
					newRows.splice(added++, 0,
						new Zotero.CollectionTreeRow(this, 'group', group, 1),
					);
					added += await this._expandRow(newRows, added - 1);
				}
			}
			
			let feeds = {
				get unreadCount() {
					return Zotero.Feeds.totalUnreadCount();
				},
				
				async updateFeed() {
					for (let feed of Zotero.Feeds.getAll()) {
						await feed.updateFeed();
					}
				}
			};
			feedsIncluded = this._includedInTree(feeds);
			if (this.props.hideSources.indexOf('feeds') == -1 && Zotero.Feeds.haveFeeds() && feedsIncluded) {
				if (groupsIncluded || libraryIncluded) {
					newRows.splice(added++, 0,
						new Zotero.CollectionTreeRow(this, 'separator', false),
					);
				}
				newRows.splice(added++, 0,
					new Zotero.CollectionTreeRow(this, 'feeds', feeds)
				);
				added += await this._expandRow(newRows, added - 1);
			}
			
			this.selection.selectEventsSuppressed = true;
			// If the focused row does not match the filter, create a hidden dummy row at the bottom
			//  of the tree to focus on to prevent itemTree from changing selection
			this._hiddenFocusedRow = this._createFocusedFilteredRow(newRows);
			if (this._hiddenFocusedRow) {
				newRows.splice(added++, 0,
					this._hiddenFocusedRow
				);
			}
			this._rows = newRows;
			this._refreshRowMap();
			if (this._editing) {
				let editingName = this._editing.editingName;
				let editingIdx = this._rowMap[this._editing.id];
				if (editingIdx !== undefined) {
					this._editing = this.getRow(editingIdx);
					this._editing.editingName = editingName;
				}
			}
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
		this.tree.invalidate();
	}
	
	async selectByID(id, ensureRowVisible = true) {
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
		if (row === false) {
			return false;
		}
		if (ensureRowVisible) {
			this.ensureRowIsVisible(row);
		}
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
	
	async selectLibrary(libraryID = 1) {
		var row = this.getRowIndexByID('L' + libraryID);
		if (row === false) {
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

	async selectSearch(id) {
		return this.selectByID('S' + id);
	}
	
	async selectFeeds() {
		return this.selectByID('F1');
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
		
		// If there's a single item and it or an ancestor are in the trash, switch to that
		if (items.length == 1 && items[0].isInTrash()) {
			Zotero.debug("Item is in trash; switching to trash");
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
		if (action == 'refresh' && type != 'trash') {
			// Trash handled below
			return;
		}
		if (type == 'feed' && (action == 'unreadCountUpdated' || action == 'statusChanged')) {
			// Refresh the feed
			let feedRow = this.getRowIndexByID("L" + ids[0]);
			if (feedRow !== false) {
				this.tree.invalidateRow(feedRow);
			}
			// Refresh the Feeds row
			let feedsRow = this.getRowIndexByID("F1");
			if (feedsRow !== false) {
				this.tree.invalidateRow(feedsRow);
			}
			return;
		}
		
		//
		// Actions that can change the selection
		//
		var currentTreeRow = this.getRow(this.selection.focused);
		// Set to true if selectByID()/selectWait() is awaited
		var skipWait = false;
		this.selection.selectEventsSuppressed = true;
		
		if (action == 'delete') {
			let selectedIndex = this.selection.focused;
			let feedDeleted = false;
			var offset = 0;
			
			// Since a delete involves shifting of rows, we have to do it in reverse order
			let rows = [];
			for (let i = 0; i < ids.length; i++) {
				let id = ids[i];
				switch (type) {
					case 'collection':
						if (this._rowMap['C' + id] !== undefined) {
							// During filtering, calculate by how many rows focus needs to be shifted.
							// e.g. Shift focus by 2 if a child is deleted and it's parent does not match the filter
							offset = Math.max(this._calculateOffsetForRowSelection('C' + id), offset);
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
				
				// If a feed was removed and there are no more, remove the 'Feeds' row
				// (and the splitter before it)
				if (feedDeleted && !Zotero.Feeds.haveFeeds()) {
					let row = this._rowMap['F1'];
					this._removeRow(row);
					this._removeRow(row - 1);
				}
				this._refreshRowMap();
			}
			// If there's an active filter, we can have a child matching filter be deleted
			// which means the non-matching parent needs to be removed, so the tree is rebuilt
			if (!this._isFilterEmpty()) {
				await this.reload();
			}
			this._selectAfterRowRemoval(selectedIndex - offset);
		}
		else if (action == 'modify') {
			let row;
			
			for (let id of ids) {
				let rowID = "C" + id;
				let selectedIndex = this.selection.focused;
				
				let handleFocusDuringSearch = async (type) => {
					let object = type == 'collection' ? Zotero.Collections.get(id) : Zotero.Searches.get(id);
					// If collections/searches are being filtered, some rows
					// need to be (un-)greyed out or removed, so reload.
					if (!this._isFilterEmpty()) {
						let offset = 0;
						if (!this._includedInTree(object, true)) {
							offset = this._calculateOffsetForRowSelection(type[0].toUpperCase() + id);
						}
						await this.reload();
						this._selectAfterRowRemoval(selectedIndex - offset);
					}
				};
				
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
								// If collection was selected, select next row
								if (selectedIndex == row) {
									this._selectAfterRowRemoval(selectedIndex);
								}
							}
							else {
								await this._addSortedRow('collection', id);
								await this.selectByID(currentTreeRow.id);
								skipWait = true;
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
							await this.selectByID(currentTreeRow.id);
							skipWait = true;
							// Invalidate parent in case it's become non-empty
							if (collection.parentID) {
								let parentRow = this.getRowIndexByID("C" + collection.parentID);
								this.tree.invalidateRow(parentRow);
							}
						}
						await handleFocusDuringSearch('collection');
						break;
					
					case 'search':
						let search = Zotero.Searches.get(id);
						row = this.getRowIndexByID("S" + id);
						if (row !== false) {
							// TODO: Only move if name changed
							this._removeRow(row);
							
							// Search was moved to trash
							if (search.deleted) {
								this._refreshRowMap();
								// If search was selected, select next row
								if (selectedIndex == row) {
									this._selectAfterRowRemoval(selectedIndex);
								}
							}
							// If search isn't in trash, add it back
							else {
								await this._addSortedRow('search', id);
								await this.selectByID(currentTreeRow.id);
								skipWait = true;
							}
						}
						// If search isn't currently visible and it isn't in the trash (because it was
						// undeleted), add it
						else if (!search.deleted) {
							await this._addSortedRow('search', id);
							await this.selectByID(currentTreeRow.id);
							skipWait = true;
							// Invalidate parent in case it's become non-empty
							// NOTE: Not currently used, because searches can't yet have parents
							if (search.parentID) {
								let parentRow = this.getRowIndexByID("S" + search.parentID);
								if (parentRow !== false) {
									this.tree.invalidateRow(parentRow);
								}
							}
						}
						await handleFocusDuringSearch('search');
						break;
						
					case 'feed':
						break;
					
					default:
						await this.reload();
						await this.selectByID(currentTreeRow.id);
						skipWait = true;
						break;
				}
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
								skipWait = true;
							}
							else if (type == 'search') {
								await this.selectByID("S" + id);
								skipWait = true;
							}
						}
						else if (addedIndex !== false && addedIndex <= this.selection.focused) {
							await this.selectWait(this.selection.focused+1);
							skipWait = true;
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
						skipWait = true;
						break;
				}
			}
			// After new collections were added, we need to update parents' info on if they have
			// a child matching the filter to show the arrow or not.
			if (!this._isFilterEmpty() && type == "collection") {
				for (let id of ids) {
					let rowIndex = this.getRowIndexByID("C" + id);
					let parentIndex = rowIndex ? this.getParentIndex(rowIndex) : -1;
					while (parentIndex > 0) {
						let parent = this.getRow(parentIndex);
						this._matchesFilter(parent.ref, true);
						parentIndex = this.getParentIndex(parentIndex);
					}
				}
			}
			this._refreshRowMap();
		}
		else if (action == 'refresh' && type == 'trash') {
			// We need to update the trash's status (full or empty), and if empty,
			// the row might be removed
			await this.reload();
		}

		this.forceUpdate();
		// Only wait for select if we didn't already do that above
		var promise = skipWait ? Promise.resolve() : this.waitForSelect();
		this.selection.selectEventsSuppressed = false;
		return promise;
	}

	/**
	 * Set the rows that should be highlighted
	 *
	 * @param ids {String[]} list of row ids to be highlighted
	 */
	async setHighlightedRows(ids) {
		if (this._editing) return;
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
				if (row) {
					this._highlightedRows.add(id);
					rows.push(row);
				}
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
		if (!this._includedInTree(col)) {
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
		var seen = new Set([col.id])
		while (parentID = col.parentID) {
			// Detect infinite loop due to invalid nesting in DB
			if (seen.has(parentID)) {
				await Zotero.Schema.setIntegrityCheckRequired(true);
				Zotero.crash();
				return;
			}
			seen.add(parentID);
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
		if (this.isContainerEmpty(index)) return;

		this._lastToggleOpenStateIndex = index;
		if (this.isContainerOpen(index)) {
			await this._closeContainer(index);
			this._lastToggleOpenStateIndex = null;
			return;
		}

		this.selection.selectEventsSuppressed = true;
		var count = 0;
		var treeRow = this.getRow(index);
		if (treeRow.isLibrary(true) || treeRow.isCollection() || treeRow.isFeeds()) {
			count = await this._expandRow(this._rows, index, true);
		}
		if (this.selection.focused > index) {
			this.selection.select(this.selection.focused + count);
		}
		this.selection.selectEventsSuppressed = false;
		
		this._rows[index].isOpen = true;
		this._refreshRowMap();
		this._saveOpenStates();
		this.tree.invalidate(index);
		this._lastToggleOpenStateIndex = null;
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
		if (treeRow.isFeed()) {
			await treeRow.ref.eraseTx();
			return;
		}
		treeRow.ref.deleted = true;
		if (treeRow.isCollection()) {
			await treeRow.ref.saveTx({ deleteItems });
			return;
		}
		await treeRow.ref.saveTx();
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
	
	getRowString(index) {
		// During filtering, context rows return an empty string to not be selectable
		// with key-based navigation
		if (!this._isFilterEmpty()) {
			if (!this._matchesFilter(this.getRow(index).ref).matchesFilter) {
				return "";
			}
		}
		return this.getRow(index).getName();
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

	getIconName(index) {
		const treeRow = this.getRow(index);
		let collectionType = treeRow.type;
		let icon = collectionType;

		switch (collectionType) {
			case 'group':
				icon = 'library-group';
				break;
			case 'feed':
				// Better alternative needed: https://github.com/zotero/zotero/pull/902#issuecomment-183185973
				/*
				if (treeRow.ref.updating) {
					collectionType += 'Updating';
				} else */if (treeRow.ref.lastCheckError) {
					icon += '-error';
				}
				break;
			case 'trash':
				if (this._trashNotEmpty[treeRow.ref.libraryID]) {
					icon += '-full';
				}
				break;

			case 'feeds':
				icon = 'feed-library';
				break;

			case 'header':
				if (treeRow.ref.id == 'group-libraries-header') {
					icon = 'groups';
				}
				break;
			case 'separator':
				return null;
		}
		return icon;
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
		
		if (!treeRow.isCollection() && !treeRow.isSearch()) {
			return;
		}
		let type = treeRow.isCollection() ? "zotero/collection" : "zotero/search";
		event.dataTransfer.setData(type, treeRow.ref.id);
		Zotero.debug(`Dragging ${type} ` + treeRow.id);
	}

	onDragOver(event, index) {
		if (!event.currentTarget.classList.contains('row')) return;
		const treeRow = this.getRow(index);
		let previousDragoverRow = this._dragoverRow;
		this._dragoverRow = index;
		try {
			// Prevent modifier keys from doing their normal things
			event.preventDefault();
			var previousOrientation = Zotero.DragDrop.currentOrientation;
			Zotero.DragDrop.currentOrientation = getDragTargetOrient(event);

			// Expand collapsed collections and groups when they are dragged over for 1 second
			if (!this.isContainerEmpty(index) && !this.isContainerOpen(index)) {
				// If dragged over row has changed, clear the timer
				if (this._expandRowOnHoverTimer && previousDragoverRow !== index) {
					clearTimeout(this._expandRowOnHoverTimer);
					this._expandRowOnHoverTimer = null;
				}
				// set a new timer for currently hovered row if it does not yet exist
				if (!this._expandRowOnHoverTimer) {
					this._expandRowOnHoverTimer = setTimeout(async () => {
						// if the dragged over row is still the same after delay, expand it
						if (!this.isContainerOpen(index) && this._dragoverRow == index) {
							this._flashingRow = index;
							this.tree.invalidateRow(index);
							// wait for the flashing to finish and then expand the container
							await Zotero.Promise.delay(300); // 0.2s CSS animation length * 1.5 runs
							this._flashingRow = null;
							this._expandedRowsOnDrag.add(treeRow.id);
							if (!this.isContainerOpen(index)) {
								this.toggleOpenState(index);
							}
						}
						this._expandRowOnHoverTimer = null;
					}, 1000);
				}
			}
			// If the expanded rows were to be collapsed after the mouse left collectionTree,
			// don't do it because now the mouse is back in the collectionTree
			if (this._collapseExpandedRowsTimer) {
				clearTimeout(this._collapseExpandedRowsTimer);
				this._collapseExpandedRowsTimer = null;
			}
			
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
			else if (event.dataTransfer.types.includes("application/x-moz-file")) {
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
			if (prevDropRow != this._dropRow || previousOrientation != Zotero.DragDrop.currentOrientation) {
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
		this._dragoverRow = null;
		this.tree.invalidateRow(dropRow);
	}

	// when something is dragged over the container rows, they may be expanded.
	// if the mouse then leaves the collectionTree, collapse all expanded rows after delay
	// (unless onDragOver is called soon, which will clear the timeout)
	onDragLeaveFromTheTree = (e) => {
		if (!e.relatedTarget) return;
		let fromOutOfTree = this.domEl.contains(e.target) && !this.domEl.contains(e.relatedTarget);
		if (fromOutOfTree && !this._collapseExpandedRowsTimer) {
			this._collapseExpandedRowsTimer = setTimeout(() => {
				this.closeContainersExpandedOnDrag();
				this._collapseExpandedRowsTimer = null;
			}, 1000);
		}
	};

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
				// Can drop collections, searches, and items into trash of their own library
				if (treeRow.isTrash()) {
					let objects = [];
					if (dataType === 'zotero/item') {
						objects = Zotero.Items.get(data);
					}
					else if (dataType === 'zotero/collection') {
						objects = Zotero.Collections.get(data);
					}
					else if (dataType === 'zotero/search') {
						objects = Zotero.Searches.get(data);
					}
					let allInSameLibrary = objects.every(object => object.libraryID === treeRow.ref.libraryID);
					return allInSameLibrary;
				}
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
				items = Zotero.Items.keepTopLevel(items);
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
				if (!treeRow.isLibrary(true) && !treeRow.isCollection()) {
					return false;
				}
				
				let draggedCollectionID = data[0];
				let draggedCollection = Zotero.Collections.get(draggedCollectionID);
				
				// Dragging within same library
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

	/**
	 * Copy a given item into another library. Used when we need to create a copy of a collection
	 * in another library if collection is drag-dropped into a group it is not a part of.
	 */
	async _copyItem({ item, targetLibraryID, targetTreeRow, options }) {
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
			
			let newAttachment = await Zotero.Attachments.copyAttachmentToLibrary(item, targetLibraryID);
			if (options.annotations) {
				await Zotero.Items.copyChildItems(item, newAttachment);
			}
			
			return newAttachment.id;
		}
		
		// Create new clone item in target library
		var newItem = item.clone(targetLibraryID, { skipTags: !options.tags });
		
		var newItemID = await newItem.save({
			skipSelect: true
		});
		
		// Record link
		await newItem.addLinkedItem(item);
		
		if (item.isNote()) {
			if (Zotero.Libraries.get(newItem.libraryID).filesEditable) {
				await Zotero.Notes.copyEmbeddedImages(item, newItem);
			}
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

				if (Zotero.Libraries.get(newNote.libraryID).filesEditable) {
					await Zotero.Notes.copyEmbeddedImages(note, newNote);
				}
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
				let newAttachment = await Zotero.Attachments.copyAttachmentToLibrary(
					attachment, targetLibraryID, newItemID
				);
				
				if (options.annotations) {
					await Zotero.Items.copyChildItems(attachment, newAttachment);
				}
			}
		}
		
		return newItemID;
	}
	
	/**
	 * Helper function used by executeCollectionCopy to recursively copy collections from one library
	 * into another, or from one collection to another within the same library.
	 */
	async _copyCollections({ descendents, parentID, addItems, targetLibraryID, targetTreeRow, copyOptions }) {
		for (var desc of descendents) {
			// Collections
			if (desc.type == 'collection') {
				var c = await Zotero.Collections.getAsync(desc.id);
				let newCollection = c.clone(targetLibraryID);
				if (parentID) {
					newCollection.parentID = parentID;
				}
				var collectionID = await newCollection.save();
				
				// Record link only if copying to a different library
				if (targetLibraryID !== c.libraryID) {
					await newCollection.addLinkedCollection(c);
				}
				
				// Recursively copy subcollections
				if (desc.children.length) {
					await this._copyCollections({
						descendents: desc.children,
						parentID: collectionID,
						addItems,
						targetLibraryID,
						targetTreeRow,
						copyOptions
					});
				}
			}
			// Items
			else {
				var item = await Zotero.Items.getAsync(desc.id);
				let id = desc.id;
				// Actually copy items only if moving to another library
				if (item.libraryID !== targetLibraryID) {
					id = await this._copyItem({
						item,
						targetLibraryID,
						targetTreeRow,
						options: copyOptions
					});
					// Standalone attachments might not get copied
					if (!id) {
						continue;
					}
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
	}

	/**
	 * Copy a given collection into another library, or duplicate it within the same library
	 *
	 * Used for drag-and-drop and the "Copy To" context menu option
	 *
	 * @param {Zotero.Collection} collection - collection to copy
	 * @param {String} targetCollectionID - id of the collection to copy to
	 * @param {String} targetLibraryID - id of the library to copy to
	 * @param {Zotero.CollectionTreeRow } targetTreeRow - tree row of the target
	 * @param {Object} copyOptions - options how to perform the copy - see onDrop for an example
	*/
	async executeCollectionCopy({ collection, targetCollectionID, targetLibraryID, targetTreeRow, copyOptions }) {
		await Zotero.DB.executeTransaction(async () => {
			var collections = [{
				id: collection.id,
				children: collection.getDescendents(true),
				type: 'collection'
			}];
			
			var addItems = new Map();
			await this._copyCollections({
				descendents: collections,
				parentID: targetCollectionID,
				addItems,
				targetLibraryID,
				targetTreeRow,
				copyOptions
			});
			for (let [collectionID, items] of addItems.entries()) {
				let collection = await Zotero.Collections.getAsync(collectionID);
				await collection.addItems(items);
			}
			
			// TODO: add subcollections and subitems, if they don't already exist,
			// and display a warning if any of the subcollections already exist
		});
	}

	async onDrop(event, index) {
		const treeRow = this.getRow(index);
		this._dropRow = null;
		this.tree.invalidate();
		let orient = Zotero.DragDrop.currentOrientation;
		let row = this._rowMap[treeRow.id];
		let dataTransfer = event.dataTransfer;
		
		// Prevent potential container row opening and flashing started in onDragOver
		clearTimeout(this._expandRowOnHoverTimer);
		this._expandRowOnHoverTimer = null;
		let oldFlashing = this._flashingRow;
		this._flashingRow = null;
		this.tree.invalidateRow(oldFlashing);

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
			childFileAttachments: Zotero.Prefs.get('groups.copyChildFileAttachments'),
			annotations: Zotero.Prefs.get('groups.copyAnnotations'),
		};

		// Dropping items, collections, or searches into trash
		if (targetTreeRow.isTrash()) {
			let objects = [];
			if (dataType == 'zotero/collection') {
				objects = await Zotero.Collections.getAsync(data);
			}
			else if (dataType == 'zotero/search') {
				objects = await Zotero.Searches.getAsync(data);
			}
			else if (dataType == 'zotero/item') {
				objects = await Zotero.Items.getAsync(data);
			}
			await Zotero.DB.executeTransaction(async function () {
				for (let obj of objects) {
					obj.deleted = true;
					await obj.save();
				}
			});
			return;
		}
		
		var targetLibraryID = targetTreeRow.ref.libraryID;
		var targetCollectionID = targetTreeRow.isCollection() ? targetTreeRow.ref.id : false;
		
		if (dataType == 'zotero/collection') {
			var droppedCollection = await Zotero.Collections.getAsync(data[0]);
			// Collection drag between libraries
			if (targetLibraryID != droppedCollection.libraryID) {
				await this.executeCollectionCopy({
					collection: droppedCollection,
					targetCollectionID,
					targetLibraryID,
					targetTreeRow,
					copyOptions
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
				items = Zotero.Items.keepTopLevel(items);
				let io = window.ZoteroPane.showPublicationsWizard(items);
				if (!io) {
					return;
				}
				copyOptions.childNotes = io.includeNotes;
				copyOptions.childFileAttachments = io.includeFiles;
				copyOptions.childLinks = true;
				copyOptions.annotations = false;
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
						return Zotero.DB.executeTransaction(async () => {
							for (let item of chunk) {
								var id = await this._copyItem({
									item,
									targetLibraryID,
									targetTreeRow,
									options: copyOptions
								});
								// Standalone attachments might not get copied
								if (!id) {
									continue;
								}
								newIDs.push(id);
							}
						});
					}.bind(this)
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
					
					window.openDialog('chrome://zotero/content/merge.xhtml', '', 'chrome,modal,centerscreen', io);
					
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
			// See note in onDragOver() above
			if (dataType == 'application/x-moz-file' && Zotero.isMac) {
				if (event.metaKey) {
					if (event.altKey) {
						dropEffect = 'link';
					}
					else {
						dropEffect = 'move';
					}
				}
				else {
					dropEffect = 'copy';
				}
			}
			
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
					if (dropEffect == 'move') {
						try {
							file.remove(false);
						}
						catch (e) {
							Zotero.logError("Error deleting original file " + file.path + " after drag");
						}
					}
				}
				
				addedItems.push(item);
			}
			
			// Automatically retrieve metadata for PDFs and ebooks
			Zotero.RecognizeDocument.autoRecognizeItems(addedItems);
		}
		this.closeContainersExpandedOnDrag();
	}

	async closeContainersExpandedOnDrag() {
		let expandedRows = [...this._expandedRowsOnDrag];
		if (!expandedRows.length) return;
		this._expandedRowsOnDrag.clear();
		// Record the ancestors of the currently selected collection to not collapse them
		let col = this.selectedTreeRow.ref;
		let parentIDs = new Set();
		parentIDs.add(Zotero.Libraries.get(col.libraryID).treeViewID);
		while (col.parentID) {
			col = Zotero.Collections.get(col.parentID);
			parentIDs.add(col.treeViewID);
		}

		// Collapse all remaining rows that were expanded during drag-drop
		for (let rowID of expandedRows) {
			let index = this.getRowIndexByID(rowID);
			let row = this._rows[index];
			if (row && row.isOpen && !parentIDs.has(row.ref.treeViewID)) {
				this.toggleOpenState(index);
			}
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
					&& (this.props.hideSources.indexOf('duplicates') != -1
						|| this._virtualCollectionLibraries.duplicates[libraryID] === false)
					// Unfiled Items not shown
					&& this._virtualCollectionLibraries.unfiled[libraryID] === false
					&& this.props.hideSources.indexOf('trash') != -1;
		}
		if (treeRow.isCollection()) {
			return !treeRow.ref.hasChildCollections();
		}
		else if (treeRow.isFeeds()) {
			// Hidden when empty
			return false;
		}
		return true;
	}
	
	isSelectable = index => {
		let treeRow = this.getRow(index);
		return treeRow && !(treeRow.isSeparator() || treeRow.isHeader());
	}

	_closeContainer(row, skipMap) {
		if (!this.isContainerOpen(row) || this.isContainerEmpty(row)) return;
		
		this.selection.selectEventsSuppressed = true;
		
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
		let iconName = this.getIconName(index);
		
		return iconName
			? getCSSIcon(iconName)
			: document.createElement('span');
	}

	/**
	 * Persist the current open/closed state of rows to a pref
	 */
	_saveOpenStates = async function() {
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
		this._storeOpenStates(state);
	};
	
	_storeOpenStates = Zotero.Utilities.debounce(function(state) {
		Zotero.Prefs.set("sourceList.persist", JSON.stringify(state));
	})

	// When collections are renamed or deleted during search, more than
	// a single row can be filtered out (if a child matching the filter is deleted,
	// its non-matching parent is deleted too). To select the right row
	// after such actions, the index should be offset by the total number of rows removed
	_calculateOffsetForRowSelection(id) {
		let rowIndex = this.getRowIndexByID(id);
		let offset = 0;
		let parentRowIndex = this.getParentIndex(rowIndex);
		while (parentRowIndex > 0) {
			let parentRow = this.getRow(parentRowIndex);
			if (parentRow.depth < 1 || this._matchesFilter(parentRow.ref).matchesFilter) {
				break;
			}
			parentRowIndex = this.getParentIndex(parentRowIndex);
			offset += 1;
		}
		return offset;
	}


	// Record if the collection tree has been focused. this._treeWasFocused is set to false when
	// filtering starts. When the filter is cleared, if this._treeWasFocused is still false,
	// no selection/focusing was done on the collectionTree, so we should reset previous scroll
	// position. Otherwise, we should scroll to place the selected row in the middle.
	recordCollectionTreeFocus = () => {
		this._treeWasFocused = true;
	};

	/**
	 * Set collection filter and refresh collectionTree to only include
	 * rows that match the filter. Rows that do not match the filter but have children that do
	 * are displayed as context rows. All relevant rows are toggled open. Selection is kept
	 * on the currently selected row if any. If the filter is emptied out, the currently selected
	 * row is scrolled to. Otherwise, scroll to the very top.
	 * @param {String} filterText - Text that rows have to contain to match the filter
	 * @param {Bool} focusTree - Focus the collection tree after the filtering is complete
	 */
	async setFilter(filterText, focusTree = false) {
		let collectionTable = document.getElementById("collection-tree").firstElementChild;
		let isEmpty = this._isFilterEmpty();
		let willBeEmpty = filterText.length == 0;
		this._filter = filterText.toLowerCase();
		let currentRow = this.getRow(this.selection.focused) || this._hiddenFocusedRow;
		let currentRowDisplayed = currentRow && this._includedInTree(currentRow.ref);
		let shouldRestoreScrollPosition = willBeEmpty && !isEmpty && !this._treeWasFocused;
		// Save the initial scroll position, selected row and which rows were collapsed before the filtering starts
		if (!willBeEmpty && isEmpty) {
			this._filterInitialScrollPosition = collectionTable.scrollTop;
			this._filterInitialCollapsedRows = this._rows.filter(r => !r.isOpen).map(r => r.id);
			this._treeWasFocused = false;
		}
		// If current row does not match any filters, it'll be hidden, so clear selection
		if (!currentRowDisplayed) {
			this.selection.clearSelection();
		}
		await this.reload();
		if (currentRow) {
			// Special treatment for when there are no filter matches
			// Otherwise, selection.focused does not get updated by selectByID, which breaks ZoteroPane.
			if (this._rows.length == 1) {
				this.selection.select(0);
			}
			// Re-select previously selected row
			else {
				await this.selectByID(currentRow.id, !shouldRestoreScrollPosition);
			}
		}

		let promise = this.waitForSelect();
		this.selection.selectEventsSuppressed = false;
		await promise;

		// Expand all container rows to see all search results
		if (!this._isFilterEmpty()) {
			for (let i = 0; i < this._rows.length; i++) {
				let row = this._rows[i];
				if (this.isContainer(i) && this._matchesFilter(row.ref).hasChildMatchingFilter && !row.isOpen) {
					await this.toggleOpenState(i);
				}
			}
		}
		// If the filter has been cleared and the selection has not changed, restore the initial scroll position
		if (shouldRestoreScrollPosition) {
			// For the initial scroll position to make sense, collapse rows that were initially collapsed
			for (let rowID of this._filterInitialCollapsedRows) {
				let index = this.getRowIndexByID(rowID);
				if (index && this._rows[index].isOpen) {
					this.toggleOpenState(index);
				}
			}
			this._filterInitialCollapsedRows = [];
			collectionTable.scrollTop = this._filterInitialScrollPosition;
			this._filterInitialScrollPosition = null;
		}
		// During filtering, scroll to the very top
		else if (!willBeEmpty) {
			collectionTable.scrollTop = 0;
		}
		// If the filtering is cleared and the selection has changed, scroll to have the
		// newly selected row in the middle
		else if (willBeEmpty && !isEmpty) {
			let selectedRow = collectionTable.querySelector(".row.selected");
			let rowRect = selectedRow.getBoundingClientRect();
			let tableRect = collectionTable.getBoundingClientRect();
			let rowMiddle = rowRect.top + rowRect.height / 2;
			let tableMiddle = tableRect.top + tableRect.height / 2;
			let scrollPosition = collectionTable.scrollTop + rowMiddle - tableMiddle;
			collectionTable.scrollTop = scrollPosition;
		}
		// Focus the collection tree
		if (focusTree) {
			collectionTable.parentNode.focus();
		}
	}


	/**
	 * Creates an extra hidden row to keep focus on it when a currently focused row does not match the filter.
	 * Required to avoid changes in itemTree during collection search.
	 * @param {CollectionTreeRow[]} rows - Rows of collectionTree.
	 * @return {CollectionTreeRow|null}
	 */
	_createFocusedFilteredRow(rows) {
		if (this._isFilterEmpty()) {
			return null;
		}
		let focused = this.getRow(this.selection.focused);
		// If row already exists - nothing to add
		let focusedRowAlreadyExists = rows.some(row => row.id == focused?.id);
		if (!focused || focusedRowAlreadyExists) {
			return null;
		}

		return new Zotero.CollectionTreeRow(this, focused.type, focused.ref, 0, false);
	}

	focusedRowMatchesFilter() {
		let row = this.getRow(this.selection.focused);
		if (row.isDuplicates() || row.isUnfiled() || row.isRetracted() || row.isTrash() || row.isPublications()) {
			return false;
		}
		return this._matchesFilter(row.ref).matchesFilter;
	}

	filterEquals(filterValue) {
		return filterValue.toLowerCase() === this._filter;
	}
	
	_isFilterEmpty() {
		return this._filter === "";
	}

	clearFilter() {
		// Clear the search field
		if (collectionsSearchField.value.length) {
			collectionsSearchField.value = '';
			ZoteroPane.handleCollectionSearchInput();
			return null;
		}
		// If the search field is empty, focus the collection tree
		return document.getElementById('collection-tree');
	}

	/**
	 * Select and focus the first row matching the collection filter. If it is a child of a collapsed
	 * container(s), the container(s) on the way will be toggled open.
	 * @param {Bool} scrollToLibrary - Scroll to the very top after selection
	 */
	async focusFirstMatchingRow(scrollToLibrary) {
		let index = 0;
		let row = this.getRow(index);
		while (index < this._rows.length) {
			row = this.getRow(index);
			if (this._matchesFilter(row.ref).matchesFilter) {
				// The matching row may not be selectable (e.g. Group Libraries header).
				// In that case, just keep looking for the next row
				let wasSelected = await this.selectByID(row.id);
				if (wasSelected) {
					// If selection happened, move focus onto the tree
					this.tree.focus();
					if (scrollToLibrary) {
						this.ensureRowIsVisible(0);
					}
					return;
				}
			}
			// Selection did not happen - keep going. Open any containers on the way
			if (!this.isContainerOpen(index)) {
				await this.toggleOpenState(index);
			}
			index += 1;
		}
	}

	/**
	 * Select the last row matching collection filter. Opens any container rows on the way.
	 */
	async focusLastMatchingRow() {
		let loopCounter = 0;
		let offset = 1;
		if (this._hiddenFocusedRow) {
			offset = 2;
		}
		let lastRow = this.getRow(this._rows.length - offset);
		while (lastRow && !lastRow.isOpen && this._matchesFilter(lastRow.ref).hasChildMatchingFilter) {
			await this.toggleOpenState(this._rows.length - 1);
			lastRow = this.getRow(this._rows.length - offset);
			// Sanity check to make sure we are not stuck in an infinite loop if something goes wrong
			loopCounter++;
			if (loopCounter > 100) {
				Zotero.debug("Reasonable collections depth exceeded");
				return false;
			}
		}
		return this.selectByID(lastRow.id);
	}

	/**
	 * Select and focus the next row after startIndex that matches the filter
	 *
	 * @param {Int} startIndex - Index of the row from which the search of the next matching row begins
	 * @param {Bool} up - Move focus up the collection tree. Unless true, default direction is down.
	 * @return {Bool} true if focus was shifted, false if selected row was not changed
	 */
	async focusNextMatchingRow(startIndex, up) {
		if (this._isFilterEmpty()) {
			return false;
		}
		// Increment or decrement the row index depending on direction
		let moveInDirection = (rowIndex) => {
			return up ? rowIndex - 1 : rowIndex + 1;
		};

		let rowIndex = startIndex;
		while (rowIndex < this._rows.length && rowIndex >= 0) {
			let nextIndex = moveInDirection(rowIndex);
			let nextRow = this.getRow(nextIndex);

			// If there is not next row or the next row is hidden (which should never happen), stop
			if (!nextRow || nextRow.id == this._hiddenFocusedRow?.id) {
				// If we stopped going up, make sure the library or group row is visible
				if (up && !this.tree.rowIsVisible(0)) {
					this.ensureRowIsVisible(0);
				}
				return false;
			}
			// Select the row if it's matching the filter unless it's a header or separator
			if (this._matchesFilter(nextRow.ref).matchesFilter
				&& !["separator", "header"].includes(nextRow.type)) {
				this.tree.focus();
				return this.selectByID(nextRow.id);
			}
			rowIndex = nextIndex;
		}
		return false;
	}

	/**
	 * Check if a given object matches filter or has children that match the filter.
	 *
	 * @param {Collection|Search|Library|Group} object - Object to check
	 * @param {Bool} resetCache - Ignore and reset existing cache value for that object
	 * @return {Object} { matchesFilter: Bool, hasChildMatchingFilter: Bool }
	 * 		matchesFilter = object itself matches the filter
	 *		hasChildMatchingFilter = object has children that match the filter
	 */
	_matchesFilter(object, resetCache = false) {
		// When the filter is empty, everything matches
		if (this._isFilterEmpty()) {
			return { matchesFilter: true, hasChildMatchingFilter: true };
		}
		// Handle separator or group headers
		if ((object.libraryID === undefined || object.libraryID === -1) && !object.updateFeed) {
			return { matchesFilter: true, hasChildMatchingFilter: false };
		}
		// Define objectID to be used in cache
		let objectID = "L" + object.libraryID;
		if (['Collection', 'Search', 'Feed'].includes(object._ObjectType)) {
			objectID = object._ObjectType[0] + object.id;
		}
		else if (object.updateFeed && !object.libraryID) {
			// Special ID for 'Feeds' parent row of all feeds
			objectID = 'feeds';
		}
		// If we found the filter status during previous recursions, return that
		if (this._filterResultsCache[objectID] && !resetCache) {
			return this._filterResultsCache[objectID];
		}
		// Filtering is case insensitive
		let objectName = (object.name || "").toLowerCase();
		// Special treatment to fetch the name for My Library or Feeds
		if (objectID[0] == 'L' && object._ObjectType !== "Group") {
			objectName = Zotero.getString('pane.collections.library').toLowerCase();
		}
		else if (objectID == 'feeds') {
			objectName = Zotero.getString('pane.collections.feedLibraries').toLowerCase();
		}
		let filterValue = this._filter;

		let childrenToSearch = [];
		if (object._ObjectType == 'Collection') {
			let collection = Zotero.Collections.get(object.id);
			childrenToSearch = collection.getChildCollections();
		}
		else if (object.libraryID && !["Search", "Feeds"].includes(object._ObjectType)) {
			childrenToSearch = Zotero.Collections.getByLibrary(object.libraryID);
			childrenToSearch = childrenToSearch.concat(Zotero.Searches.getByLibrary(object.libraryID));
		}
		else if (objectID == 'feeds') {
			childrenToSearch = Zotero.Feeds.getAll();
		}
		let matchesFilter = objectName.includes(filterValue);
		// For libraries, groups and collections, recursively check if they have any children that match the filter
		let hasChildMatchingFilter = childrenToSearch.some((child) => {
			let { matchesFilter, hasChildMatchingFilter } = this._matchesFilter(child);
			return matchesFilter || hasChildMatchingFilter;
		});
		// Save filter status to cache
		this._filterResultsCache[objectID] = {
			matchesFilter: matchesFilter,
			hasChildMatchingFilter: hasChildMatchingFilter
		};
		return this._filterResultsCache[objectID];
	}

	/**
	 * Returns true if the object should be included in the tree because:
	 * 	1. It matches the searchbox filter OR
	 * 	2. Its children match the searchbox filter AND
	 * 	3. It is allowed by filter prop
	 * @param {Collection|Search|Library|Group} object - Object to check
	 * @param {Bool} resetCache - Ignore and reset existing cache value for that object
	 * @returns {boolean} Whether the object should be included in the tree
	 */
	_includedInTree(object, resetCache) {
		const notACollection = (object.libraryID === undefined || object.libraryID === -1) && !object.updateFeed;
		const treeHasFilterProp = Array.isArray(this.props.filterLibraryIDs) && this.props.filterLibraryIDs;
		const isAllowedByPropFilter = notACollection || !treeHasFilterProp
			|| this.props.filterLibraryIDs.includes(object.libraryID)
		;
		
		if (!isAllowedByPropFilter) return false;

		const { matchesFilter, hasChildMatchingFilter } = this._matchesFilter(object, resetCache);
		return matchesFilter || hasChildMatchingFilter;
	}

	async _expandRow(rows, row, forceOpen) {
		var treeRow = rows[row];
		var level = rows[row].level;
		var isLibrary = treeRow.isLibrary(true);
		var isCollection = treeRow.isCollection();
		var isFeeds = treeRow.isFeeds();
		var libraryID = treeRow.ref.libraryID;
		
		if (treeRow.isPublications() || treeRow.isFeed()) {
			return false;
		}
		
		var collections = treeRow.getChildren();
		
		if (isLibrary) {
			var savedSearches = await Zotero.Searches.getAll(libraryID).filter(s => !s.deleted);
			// Virtual collections default to showing if not explicitly hidden
			var showDuplicates = this.props.hideSources.indexOf('duplicates') == -1
				&& this._virtualCollectionLibraries.duplicates[libraryID] !== false;
			var showUnfiled = this.props.hideSources.indexOf('unfiled') == -1
				&& this._virtualCollectionLibraries.unfiled?.[libraryID] !== false;
			var showRetracted = this.props.hideSources.indexOf('retracted') == -1
				&& this._virtualCollectionLibraries.retracted?.[libraryID] !== false
				&& Zotero.Retractions.libraryHasRetractedItems(libraryID);
			var showPublications = this.props.hideSources.indexOf('publications') == -1
				&& libraryID == Zotero.Libraries.userLibraryID;
			var showTrash = this.props.hideSources.indexOf('trash') == -1;
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
			// Skip collections that do not match the filter and have no matching children
			if (!this._includedInTree(collections[i])) continue;
			let beforeRow = row + 1 + newRows;
			rows.splice(beforeRow, 0,
				new Zotero.CollectionTreeRow(this, isFeeds ? 'feed' : 'collection', collections[i], level + 1));
			newRows++;
			// Recursively expand child collections that should be open
			newRows += await this._expandRow(rows, beforeRow);
		}
		
		if (isCollection) {
			return newRows;
		}
		
		// Add searches
		for (var i = 0, len = savedSearches.length; i < len; i++) {
			// Skip searches in trash
			if (savedSearches[i].deleted) continue;
			// Skip searches not matching the filter
			if (!this._includedInTree(savedSearches[i])) continue;
			rows.splice(row + 1 + newRows, 0,
				new Zotero.CollectionTreeRow(this, 'search', savedSearches[i], level + 1));
			newRows++;
		}
		
		if (showPublications && this._isFilterEmpty()) {
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
		if (showDuplicates && this._isFilterEmpty()) {
			let d = new Zotero.Duplicates(libraryID);
			rows.splice(row + 1 + newRows, 0,
				new Zotero.CollectionTreeRow(this, 'duplicates', d, level + 1));
			newRows++;
		}
		
		// Unfiled items
		if (showUnfiled && this._isFilterEmpty()) {
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
		if (showRetracted && this._isFilterEmpty()) {
			let s = new Zotero.Search;
			s.libraryID = libraryID;
			s.name = Zotero.getString('pane.collections.retracted');
			s.addCondition('libraryID', 'is', libraryID);
			s.addCondition('retracted', 'true');
			rows.splice(row + 1 + newRows, 0,
				new Zotero.CollectionTreeRow(this, 'retracted', s, level + 1, treeRow));
			newRows++;
		}
		
		if (showTrash && this._isFilterEmpty()) {
			let deletedItems = await Zotero.Items.getDeleted(libraryID, true);
			let deletedCollections = await Zotero.Collections.getDeleted(libraryID, true);
			let deletedSearches = await Zotero.Searches.getDeleted(libraryID, true);
			let trashNotEmpty = deletedItems.length || deletedCollections.length || deletedSearches.length;
			if (trashNotEmpty || Zotero.Prefs.get("showTrashWhenEmpty")) {
				var ref = {
					libraryID: libraryID
				};
				rows.splice(row + 1 + newRows, 0,
					new Zotero.CollectionTreeRow(this, 'trash', ref, level + 1));
				newRows++;
			}
			this._trashNotEmpty[libraryID] = trashNotEmpty;
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
			if (this._includedInTree(collection)) {
				this._addRow(
					new Zotero.CollectionTreeRow(this, 'collection', collection, level),
					beforeRow
				);
			}
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
			if (this._includedInTree(search)) {
				this._addRow(
					new Zotero.CollectionTreeRow(this, 'search', search, level),
					beforeRow
				);
			}
		}
		
		return beforeRow;
	}
	
	_refreshRowMap() {
		super._refreshRowMap();
		let customRowHeights = [];
		for (var i = 0; i < this.rowCount; i++) {
			let row = this.getRow(i);
			if (row.isSeparator()) {
				customRowHeights.push([i, this._separatorHeight]);
			}
		}
		this._customRowHeights = customRowHeights;
		this.tree.updateCustomRowHeights(this._customRowHeights);
	}
	
	_selectAfterRowRemoval(row) {
		// If last row was selected, stay on the last row
		if (row >= this._rows.length) {
			row = this._rows.length - 1;
		};

		// Make sure the selection doesn't land on a separator (e.g. deleting last feed)
		while (row >= 0 && !this.isSelectable(row)) {
			// move up, since we got shifted down
			row--;
		}
		
		this.selection.select(row);
	}
}

module.exports = CollectionTree;
