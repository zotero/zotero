/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2019 Center for History and New Media
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

'use strict';

const React = require('react');
const ReactDOM = require('react-dom');
const { IntlProvider } = require('react-intl');
const Tree = require('components/tree');
const Icons = require('components/icons');
const { getDragTargetOrient } = require('components/utils');
const cx = require('classnames');
const { Cc, Ci } = require('chrome');

const noop = Promise.resolve;

const MARGIN_LEFT = 3;
const CHILD_INDENT = 20;

Zotero.CollectionTree = class CollectionTree extends React.Component {
	static init(domEl, opts) {
		Zotero.debug("Initializing React CollectionTree");
		var ref;
		let elem = (
			<IntlProvider locale={Zotero.locale} messages={Zotero.Intl.strings}>
				<CollectionTree ref={c => ref = c } {...opts} />
			</IntlProvider>
		);
		ReactDOM.render(elem, domEl);
		ref.domEl = domEl;
		
		// We need to return ref before issuing select events
		// which will trigger a ZoteroPane listener that requires
		// ZoteroPane.collectionsView to be assigned
		(async function() {
			await ref.refresh();
			var lastViewedID = Zotero.Prefs.get('lastViewedFolder');
			if (lastViewedID) {
				var selected = await ref.selectByID(lastViewedID);
			}
			if (!selected) {
				await ref.selectByID('L' + Zotero.Libraries.userLibraryID);
			}
			ref.selectEventsSuppressed = false;
			await ref.runListeners('load');
			Zotero.debug("React CollectionTree initialized");
		})();
		
		return ref;
	}
	
	constructor(props) {
		super(props);
		this.itemTreeView = null;
		this.itemToSelect = null;
		this.hideSources = [];
		
		this._rows = [];
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
		this._containerState = {};
		this._virtualCollectionLibraries = {};
		this._trashNotEmpty = {};
		this.refs;
		this._selectEventsSuppressed = false;
		this._focused = null;
		
		this.onLoad = this._createEventBinding('load', true, true);
		this.onSelect = this._createEventBinding('select');
		this.onRefresh = this._createEventBinding('refresh');
	}
	
	componentDidUpdate() {
		this.runListeners('refresh');
	}

	// Add a keypress listener for expand/collapse
	handleKeyDown = (event) => {
		// if (this.editingRow != -1) return; // In-line editing active
		
		var libraryID = this.getSelectedLibraryID();
		if (!libraryID) return;
		
		if (event.key == '+' && !(event.ctrlKey || event.altKey || event.metaKey)) {
			this.expandLibrary(libraryID, true);
		}
		else if (event.key == '-' && !(event.shiftKey || event.ctrlKey ||
				event.altKey || event.metaKey)) {
			this.collapseLibrary(libraryID);
		}
		else if ((event.key == 'Backspace' && Zotero.isMac) ||
				event.key == 'Delete') {
			var deleteItems = event.metaKey || (!Zotero.isMac && event.shiftKey);
			ZoteroPane.deleteSelectedCollection(deleteItems);
			event.preventDefault();
			return;
		}
	}
	
	handleRowFocus = (treeRow) => {
		this.focused = treeRow;
		if (this.selectEventsSuppressed) return;
		this.forceUpdate();
		this.props.onFocus && this.props.onFocus();
	}

	getRoots() {
		return this._rows.filter(row => row.level == 0);
	}
	
	forceUpdateOnce = new function() {
		let animationId = null;
		return function() {
			if (animationId !== null) {
				return;
			}
			
			let onNextFrame = window.requestAnimationFrame;
			if (Zotero.isWin) {
				// requestAnimationFrame on Windows doesn't redraw the tree fast enough
				// so we have to redraw on next event loop turn instead
				onNextFrame = window.setTimeout;
			}

			animationId = onNextFrame(() => {
				this.forceUpdate();
				animationId = null;
			});
		};	
	}
	
	render() {
		let focused;
		if (this.focused) {
			focused = this.focused;
			this.focusedIdx = this._rowMap[focused.id];
		}
		let itemHeight = 20; //px
		if (Zotero.isLinux) {
			itemHeight = 22;
		}
		itemHeight *= Zotero.Prefs.get('fontSize');
		
		let toggleTreeRow = (treeRow) => this.toggleOpenState(this._rowMap[treeRow.id]);
		return React.createElement(
			Tree,
			{
				itemHeight,
				
				getRoots: () => this.getRoots(),
				getKey: treeRow => treeRow.id,
				getParent: treeRow => treeRow.parent,
				getChildren: treeRow => treeRow.children,
				isSeparator: treeRow => treeRow.isSeparator(),
				isExpanded: treeRow => treeRow.isOpen,
				
				renderItem: (treeRow, depth, isFocused, arrow, isExpanded) => {
					let icon = this.getIcon(treeRow);
					let classes = cx(['tree-node', 
						{focused: isFocused},
						{highlighted: this._highlightedRows.has(treeRow.id)},
						{drop: this._dropRow == treeRow.id},
						{unread: treeRow.ref && treeRow.ref.unreadCount}
					]);
					
					let props = {
						className: classes,
						style: {
							paddingLeft: (MARGIN_LEFT + CHILD_INDENT * depth) + 'px',
						},
						onContextMenu: async (e) => {
							e.persist();
							await this.handleRowFocus(treeRow);
							this.props.onContext && this.props.onContext(e);
						},
						draggable: true,
					}
					if (this.props.dragAndDrop) {
						props.onDragStart = e => this.onDragStart(treeRow, e);
						props.onDragOver = e => this.onDragOver(treeRow, e);
						props.onDrop = e => this.onDrop(treeRow, e);
					}
					
					return (
						<div {...props}>
							{arrow}
							{icon}
							<span className="tree-node-label">{treeRow.getName()}</span>
						</div>
					);
				},
				
				focused: focused,
				highlighted: this._highlightedRows,
				drop: this._dropRow,
				
				onDragLeave: (e) => this.props.dragAndDrop && this.onTreeDragLeave(e),
				onFocus: this.handleRowFocus,
				onExpand: toggleTreeRow,
				onCollapse: toggleTreeRow,
				onKeyDown: this.handleKeyDown,

				autoExpandAll: false,
				autoExpandDepth: 0,
				ref: tree => this.ref = tree,
			}
		);
	}
	
////////////////////////////////////////////////////////////////////////////////
///
///  Component control methods
///
////////////////////////////////////////////////////////////////////////////////
	
	// TODO: this should just be a function to not obfuscate
	// that setting to false causes a refresh
	get selectEventsSuppressed() {
		return this._selectEventsSuppressed;
	}
	
	set selectEventsSuppressed(val) {
		this._selectEventsSuppressed = val;
		if (!val) {
			this.handleRowFocus(this.focused);
		}
		return val;
	}

	get focused() {
		return this._focused;
	}
	
	set focused(val) {
		this._focused = val;
		this.focusedIdx = val && this._rowMap[val.id];
		return val;
	}
		
	/**
	 *  Rebuild the tree from the data access methods and clear the selection
	 *
	 *  Calling code must restore the selection, and unsuppress selection events
	 */
	async refresh() {
		try {
			Zotero.debug("Refreshing collections pane");
			
			try {
				this._containerState = JSON.parse(Zotero.Prefs.get("sourceList.persist"));
			}
			catch (e) {
				this._containerState = {};
			}
			
			if (this.hideSources.indexOf('duplicates') == -1) {
				this._virtualCollectionLibraries.duplicates =
					Zotero.Prefs.getVirtualCollectionState('duplicates');
			}
			this._virtualCollectionLibraries.unfiled =
					Zotero.Prefs.getVirtualCollectionState('unfiled');
			
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
				newRows.splice(added++, 0, 
					new Zotero.CollectionTreeRow(this, 'header', {
						id: "group-libraries-header",
						label: Zotero.getString('pane.collections.groupLibraries'),
						libraryID: -1
					}, 0)
				);
				for (let group of groups) {
					newRows.splice(added++, 0, 
						new Zotero.CollectionTreeRow(this, 'group', group),
					);
					added += await this._expandRow(newRows, added - 1);
				}
			}
			
			// Add feeds
			if (this.hideSources.indexOf('feeds') == -1) {
				var feeds = Zotero.Feeds.getAll();
				
				// Alphabetize
				var collation = Zotero.getLocaleCollation();
				feeds.sort(function(a, b) {
					return collation.compareString(1, a.name, b.name);
				});
				
				if (feeds.length) {
					newRows.splice(added++, 0, 
						new Zotero.CollectionTreeRow(this, 'separator', false),
					);
					newRows.splice(added++, 0, 
						new Zotero.CollectionTreeRow(this, 'header', {
							id: "feed-libraries-header",
							label: Zotero.getString('pane.collections.feedLibraries'),
							libraryID: -1
						}, 0),
					);
					for (let feed of feeds) {
						newRows.splice(added++, 0, 
							new Zotero.CollectionTreeRow(this, 'feed', feed),
						);
					}
				}
			}
			
			this.selectEventsSuppressed = true;
			this.focused = null;
			
			this._rows = newRows;
			this._refreshRowMap();
		} catch (e) {
			Zotero.logError(e);
			ZoteroPane.displayErrorMessage();
		}
	}
	
	/**
	 * Refresh tree, restore selection and unsuppress select events
	 *
	 * See note for refresh() for requirements of calling code
	 */
	async reload() {
		await this.refresh();
		this.focused = this._rows[0];
		this.selectEventsSuppressed = false;
	}
	
	async selectByID(id) {
		let index = this._rowMap[id];
		if (index == undefined) return false;
		this.ensureRowIsVisible(index);
		await this.selectWait(index);
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
	selectWait(index) {
		if (this.selectEventsSuppressed) {
			this.handleRowFocus(this._rows[index]);
			return;
		}
		var promise = this.waitForSelect();
		this.handleRowFocus(this._rows[index]);
		return promise;
	}
	
	selectLibrary(libraryID) {
		// Select local library
		if (libraryID == undefined) {
			libraryID = this._rows[0].ref.libraryID;
		}
		return this.selectByID('L' + libraryID);
	}
	
	async selectTrash(libraryID) {
		await this.expandToRow('T'+libraryID);
		return this.selectByID('T'+libraryID);
	}
	
	async selectCollection(id) {
		await this.expandToRow('C' + id);
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
		else if (!this.focused.isLibrary() && inLibraryRoot) {
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
	
	// The caller has to ensure the tree is redrawn
	ensureRowIsVisible(index) {
		this.expandToRow(this._rows[index].id);
		this.ref._scrollIntoView(index);
	}
	
	waitForLoad() {
		return this._waitForEvent('load');
	}
	
	
	waitForSelect() {
		return this._waitForEvent('select');
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
		
		if (!ZoteroPane.isShowing()) {
			Zotero.debug("ZoteroPane is hidden in collectionTree.notify()");
			return;
		}
		
		//
		// Actions that don't change the selection
		//
		if (action == 'redraw') {
			this.forceUpdate();
			return;
		}
		if (action == 'refresh') {
			// If trash is refreshed, we probably need to update the icon from full to empty
			if (type == 'trash') {
				this.forceUpdate();
			}
			return;
		}
		if (type == 'feed' && (action == 'unreadCountUpdated' || action == 'statusChanged')) {
			this.forceUpdate();
			return;
		}
		
		//
		// Actions that can change the selection
		//
		var currentTreeRow = this.focused;
		this.selectEventsSuppressed = true;
		
		if (action == 'delete') {
			let selectedIndex = this.focused && this._rowMap[this.focused.id];
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
			
			this.selectNextAppropriate(selectedIndex);
		}
		else if (action == 'modify') {
			let row;
			let id = ids[0];
			let rowID = "C" + id;
			
			switch (type) {
			case 'collection':
				row = this._rowMap['C' + id];
				if (row !== undefined) {
					this._removeRow(row);
					await this._addSortedRow(type, id);
					await this.selectByID(currentTreeRow.id);
				}
				break;
			
			case 'search':
				row = this._rowMap['S' + id];
				if (row !== undefined) {
					this._removeRow(row);
					await this._addSortedRow(type, id);
					await this.selectByID(currentTreeRow.id);
				}
				break;
			
			default:
				await this.refresh();
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
						await this._addSortedRow(type, id);
						
						if (selectRow) {
							if (type == 'collection') {
								await this.selectByID("C" + id);
							}
							else if (type == 'search') {
								await this.selectByID("S" + id);
							}
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
		this.selectEventsSuppressed = false;
		this.handleRowFocus(this.focused);
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
				await this.expandToRow(id);
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
			this.forceUpdate();
		}
	}

	/**
	 * 
	 * @param rowID {String}
	 * @returns {Promise<boolean>}
	 */
	expandToRow(rowID) {
		var row = this._rowMap[rowID];
		if (!row) {
			Zotero.debug("Cannot expand to nonexistent row " + rowID, 2);
			return false;
		}
		
		let treeRow = this._rows[row];
		while (treeRow.parent) {
			treeRow.parent.isOpen = true;
			treeRow = treeRow.parent;
		}

		this._saveOpenStates();
		return true;
	}

	/**
	 * @param {Integer} libraryID
	 * @param {Boolean} [recursive=false] - Expand all collections and subcollections
	 */
	expandLibrary(libraryID, recursive) {
		this._rows[this._rowMap['L'+libraryID]].isOpen = true;
		if (recursive) {
			for (let i = this._rowMap['L'+libraryID]; true; i++) {
				let row = this._rows[i];
				if (!row.ref || row.ref.libraryID != libraryID) break;
				row.isOpen = !!row.children.length;
			}
		}
		this.forceUpdate();
		this._saveOpenStates();
	}
	
	collapseLibrary(libraryID) {
		for (let i = this._rowMap['L'+libraryID]; true; i++) {
			let row = this._rows[i];
			if (!row.ref || row.ref.libraryID != libraryID) break;
			row.isOpen = false;
		}
		this._ensureFocusedIsNotACollapseChild();
		this.forceUpdate();
		this._saveOpenStates();
	}
	
	toggleOpenState(row, state) {
		this._rows[row].isOpen = state != undefined ? state : !this._rows[row].isOpen;
		this._ensureFocusedIsNotACollapseChild();
		this.forceUpdate();
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
	async toggleVirtualCollection(libraryID, type, show) {
		const types = {
			duplicates: 'D',
			unfiled: 'U'
		};
		if (!(type in types)) {
			throw new Error("Invalid virtual collection type '" + type + "'");
		}
		let treeViewID = types[type] + libraryID;
		
		Zotero.Prefs.setVirtualCollectionStateForLibrary(libraryID, type, show);
		
		var promise = this.waitForSelect();
		var selectedRow = this.focusedIdx;
		
		await this.refresh();
		
		// Select new row
		if (show) {
			await this.selectByID(treeViewID);
		}
		// Select next appropriate row after removal
		else {
			await this.selectWait(selectedRow);
		}
		this.selectEventsSuppressed = false;
		
		return promise;
	}

	/**
	 * Deletes the selected collection and optionally items within it
	 * 
	 * @param deleteItems[boolean] Whether items contained in the collection should be removed
	 * @returns {Promise<void>}
	 */
	async deleteSelection(deleteItems) {
		if(!this.focused) {
			return;
		}
		var treeRow = this.focused;
		if (treeRow.isCollection() || treeRow.isFeed()) {
			await treeRow.ref.eraseTx({ deleteItems });
		}
		else if (treeRow.isSearch()) {
			await Zotero.Searches.erase(treeRow.ref.id);
		}
	}
	
	selectNextAppropriate(index) {
		while (index > 0 && (!this._rows[index]
								|| this._rows[index].isSeparator()
								|| this._rows[index].isHeader())) {
			index--;
		}
		return this.selectWait(index);
	}

	unregister() {
		Zotero.Notifier.unregisterObserver(this._unregisterID);
	}

////////////////////////////////////////////////////////////////////////////////
///
///  Component data access methods
///
////////////////////////////////////////////////////////////////////////////////

	/**
	 * Returns TRUE if the underlying view is editable
	 */
	get editable() {
		return this.focused.editable;
	}
	
	/**
	 * Return a reference to the tree row at a given row
	 *
	 * @return {Zotero.CollectionTreeRow}
	 */	
	getRow(index) {
		return this._rows[index];
	}
	
	/**
	 * Return the index of the row with a given ID (e.g., "C123" for collection 123)
	 *
	 * @param {String} - Row id
	 * @return {Integer|false}
	 */
	getRowIndexByID(id) {
		return (id in this._rowMap) && this._rowMap[id];
	}
	
	/**
	 * Return libraryID of selected row (which could be a collection, etc.)
	 */
	getSelectedLibraryID() {
		var treeRow = this.focused;
		return treeRow && treeRow.ref && treeRow.ref.libraryID !== undefined
			&& treeRow.ref.libraryID;
	}
	
	getSelectedCollection(asID) {
		if (this.focused) {
			var collection = this.focused;
			if (collection && collection.isCollection()) {
				return asID ? collection.ref.id : collection.ref;
			}
		}	
	}
	
	getSelectedSearch(asID) {
		if (this.focused) {
			var search = this.focused;
			if (search && search.isSearch()) {
				return asID ? search.ref.id : search.ref;
			}
		}
		return false;
	}
	
	getSelectedGroup(asID) {
		if (this.focused) {
			var group = this.focused;
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

	onDragStart(treeRow, event) {
		// See note in #setDropEffect()
		if (Zotero.isWin || Zotero.isLinux) {
			event.dataTransfer.effectAllowed = 'copyMove';
		}
		
		if (!treeRow.isCollection()) {
			return;
		}
		event.dataTransfer.setData("zotero/collection", treeRow.ref.id);
	}

	onDragOver(treeRow, event) {
		try {
			// Prevent modifier keys from doing their normal things
			event.preventDefault();
			Zotero.DragDrop.currentOrientation = getDragTargetOrient(event);
			
			if (!this.canDropCheck(treeRow, event.dataTransfer)) {
				this.setDropEffect(event, "none");
				return;
			}
			
			if (event.dataTransfer.getData("zotero/item")) {
				var sourceCollectionTreeRow = Zotero.DragDrop.getDragSource(event.dataTransfer);
				if (sourceCollectionTreeRow) {
					var targetCollectionTreeRow = treeRow;
					
					if (sourceCollectionTreeRow.id == targetCollectionTreeRow.id) {
						// Ignore drag into the same collection
						if (this.type == 'collection') {
							this.setDropEffect(event, "none");
						}
						// If dragging from the same source, do a move
						else {
							this.setDropEffect(event, "move");
						}
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
				this._dropRow = treeRow.id;
			} else {
				this._dropRow = null;
			}
			if (this._dropRow != prevDropRow) {
				this.forceUpdateOnce();
			}
		}
	}
	
	onTreeDragLeave(event) {
		this._dropRow = null;
		this.forceUpdateOnce();
	}
	
	canDropCheck(treeRow, dataTransfer) {
		let orient = Zotero.DragDrop.currentOrientation;
		let row = this._rowMap[treeRow.id];
		//Zotero.debug("Row is " + row + "; orient is " + orient);
		
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
	
	async onDrop(treeRow, event) {
		this._dropRow = null;
		this.forceUpdateOnce();
		event.persist();
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
								await c.addLinkedCollection(newCollection);
								
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
				let io = event.target.ownerDocument.defaultView
					.ZoteroPane.showPublicationsWizard(items);
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
					
					let lastWin = Services.wm.getMostRecentWindow("navigator:browser");
					lastWin.openDialog('chrome://zotero/content/merge.xul', '', 'chrome,modal,centerscreen', io);
					
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
					
					if (url.indexOf('file:///') == 0) {
						let win = Services.wm.getMostRecentWindow("navigator:browser");
						// If dragging currently loaded page, only convert to
						// file if not an HTML document
						if (win.content.location.href != url ||
								win.content.document.contentType != 'text/html') {
							var nsIFPH = Components.classes["@mozilla.org/network/protocol;1?name=file"]
									.getService(Components.interfaces.nsIFileProtocolHandler);
							try {
								var file = nsIFPH.getFileFromURLSpec(url);
							}
							catch (e) {
								Zotero.debug(e);
							}
						}
					}
					
					// Still string, so remote URL
					if (typeof file == 'string') {
						let win = Services.wm.getMostRecentWindow("navigator:browser");
						win.ZoteroPane.addItemFromURL(url, 'temporaryPDFHack', null, row); // TODO: don't do this
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
							Components.utils.reportError("Error deleting original file " + file.path + " after drag");
						}
					}
				}
				
				addedItems.push(item);
			}
			
			// Automatically retrieve metadata for PDFs
			Zotero.RecognizePDF.autoRecognizeItems(addedItems);
		}
	}
	
	setDropEffect(event, effect) {
		// On Windows (in Fx26), Firefox uses 'move' for unmodified drags
		// and 'copy'/'link' for drags with system-default modifier keys
		// as long as the actions are allowed by the initial effectAllowed set
		// in onDragStart, regardless of the effectAllowed or dropEffect set
		// in onDragOver. It doesn't seem to be possible to use 'copy' for
		// the default and 'move' for modified, as we need to in the collections
		// tree. To prevent inaccurate cursor feedback, we set effectAllowed to
		// 'copy' in onDragStart, which locks the cursor at 'copy'. ('none' still
		// changes the cursor, but 'move'/'link' do not.) It'd be better to use
		// the unadorned 'move', but we use 'copy' instead because with 'move' text
		// can't be dragged to some external programs (e.g., Chrome, Notepad++),
		// which seems worse than always showing 'copy' feedback.
		//
		// However, since effectAllowed is enforced, leaving it at 'copy'
		// would prevent our modified 'move' in the collections tree from working,
		// so we also have to set effectAllowed here (called from onDragOver) to
		// the same action as the dropEffect. This allows the dropEffect setting
		// (which we use in the tree's canDrop() and drop() to determine the desired
		// action) to be changed, even if the cursor doesn't reflect the new setting.
		if (Zotero.isWin || Zotero.isLinux) {
			event.dataTransfer.effectAllowed = effect;
		}
		event.dataTransfer.dropEffect = effect;
	}

////////////////////////////////////////////////////////////////////////////////
///
///  Private methods
///
////////////////////////////////////////////////////////////////////////////////
	
	/**
	* Remove a row from the main array and parent row children arrays,
	* delete the row from the map, and optionally update all rows above it in the map
	*/
	_removeRow(row) {
		let treeRow = this._rows[row];
		let id = treeRow.id;
		
		for (let child of treeRow.children.reverse()) {
			this._removeRow(this._rowMap[child.id]);
		}
		
		this._rows.splice(row, 1);
		treeRow.parent && treeRow.parent.children.splice(treeRow.parent.children.indexOf(treeRow), 1);
		delete this._rowMap[id];
		for (let i in this._rowMap) {
			if (this._rowMap[i] > row) {
				this._rowMap[i]--;
			}
		}
	}
	
	
	getLevel(row) {
		return this._rows[row].level;
	}
	
	
	isContainerOpen(row) {
		return !!this._rows[row].children.length && this._rows[row].isOpen;
	}


	isContainerEmpty(row) {
		return !this._rows[row].children.length;
	}
	
	
	getIcon(treeRow) {
		var collectionType = treeRow.type;
		
		if (collectionType == 'group') {
			collectionType = 'Library';
		}
		let iconCls;
		
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
				iconCls = Icons.IconTreeitemJournalArticle;
		}
		
		collectionType = Zotero.Utilities.capitalize(collectionType);
		iconCls = iconCls || Icons["IconTreesource"+collectionType];
		
		if (!iconCls) {
			if (collectionType != 'Separator') {
				Zotero.debug('Could not find tree icon for "' + collectionType + '"');
			}
			return '';
		}
		return React.createElement(iconCls);
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
		Zotero.Prefs.set("sourceList.persist", JSON.stringify(state));
	});
	
	_ensureFocusedIsNotACollapseChild() {
		if (this.focused && this.focused.parent && !this.focused.parent.isOpen) {
			this.focused = this.focused.parent;
			this._ensureFocusedIsNotACollapseChild();
		}
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
		Zotero.Prefs.set("sourceList.persist", JSON.stringify(state));
	});
	
	/**
	 * Creates mapping of item group ids to tree rows
	 */
	_refreshRowMap() {
		this._rowMap = {};
		for (let i = 0; i < this._rows.length; i++) {
			this._rowMap[this.getRow(i).id] = i;
		}
	}
	
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
			var showPublications = libraryID == Zotero.Libraries.userLibraryID;
			var showTrash = this.hideSources.indexOf('trash') == -1;
		}
		else {
			var savedSearches = [];
			var showDuplicates = false;
			var showUnfiled = false;
			var showPublications = false;
			var showTrash = false;
		}
		
		// If not a manual open and either the library is set to be collapsed or this is a collection that isn't explicitly opened,
		// set the initial state to closed
		if (!forceOpen &&
				(this._containerState[treeRow.id] === false
					|| (isCollection && !this._containerState[treeRow.id]))) {
			rows[row].isOpen = false;
		} else {
			var startOpen = !!(collections.length || savedSearches.length || showDuplicates || showUnfiled || showTrash);
			
			// // If this isn't a manual open, set the initial state depending on whether
			// // there are child nodes
			if (!forceOpen) {
				rows[row].isOpen = startOpen;
			}
		}
		
		var newRows = 0;
		
		// Add collections
		for (var i = 0, len = collections.length; i < len; i++) {
			let beforeRow = row + 1 + newRows;
			rows.splice(beforeRow, 0, 
				new Zotero.CollectionTreeRow(this, 'collection', collections[i], level + 1, treeRow));
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
				new Zotero.CollectionTreeRow(this, 'search', savedSearches[i], level + 1, treeRow));
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
					level + 1, treeRow
				)
			);
			newRows++
		}
		
		// Duplicate items
		if (showDuplicates) {
			let d = new Zotero.Duplicates(libraryID);
			rows.splice(row + 1 + newRows, 0, 
				new Zotero.CollectionTreeRow(this, 'duplicates', d, level + 1, treeRow));
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
				new Zotero.CollectionTreeRow(this, 'unfiled', s, level + 1, treeRow));
			newRows++;
		}
		
		if (showTrash) {
			let deletedItems = await Zotero.Items.getDeleted(libraryID);
			if (deletedItems.length || Zotero.Prefs.get("showTrashWhenEmpty")) {
				var ref = {
					libraryID: libraryID
				};
				rows.splice(row + 1 + newRows, 0,
					new Zotero.CollectionTreeRow(this, 'trash', ref, level + 1, treeRow));
				newRows++;
			}
			this._trashNotEmpty[libraryID] = !!deletedItems.length;
		}
		
		return newRows;	
	}
	
		
	/**
	 * Add a tree row to the main array, update the row count, tell the treebox that the row
	 * count changed, and update the row map
	 *
	 * @param {Zotero.CollectionTreeRow} treeRow
	 * @param {Number} [beforeRow] - Row index to insert new row before
	 */
	_addRow(treeRow, beforeRow, skipRowMapRefresh) {
		this._rows.splice(beforeRow, 0, treeRow);
		if (!skipRowMapRefresh) {
			// Increment all rows in map at or above insertion point
			for (let i in this._rowMap) {
				if (this._rowMap[i] >= beforeRow) {
					this._rowMap[i]++
				}
			}
			// Add new row to map
			this._rowMap[treeRow.id] = beforeRow;
		}
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
			let libraryID = collection.libraryID;
			
			let parentRow;
			if (parentID) {
				parentRow = this._rowMap["C" + parentID];
			}
			else {
				parentRow = this._rowMap['L' + libraryID];
			}
			
			let i;
			let level = this.getLevel(parentRow) + 1;
			for (i = 0; i < this._rows[parentRow].children.length; i++) {
				let child = this._rows[parentRow].children[i];
				if (!child.isCollection() ||
						Zotero.localeCompare(child.ref.name, collection.name) > 0) {
					beforeRow = this._rowMap[child.id];
					break;
				}
			}
			if (beforeRow == undefined) {
				for (beforeRow = parentRow+1; this.getLevel(beforeRow) >= level; beforeRow++);
			}
			this._addRow(
				new Zotero.CollectionTreeRow(
					this, 'collection', collection, level, this._rows[parentRow], i),
				beforeRow
			);
			await this._expandRow(this._rows, beforeRow)
		}
		else if (objectType == 'search') {
			let search = Zotero.Searches.get(id);
			let libraryID = search.libraryID;
			let parentRow = this._rowMap['L' + libraryID];
			
			let level = this.getLevel(parentRow) + 1;
			let i;
			if (this._rows[parentRow].children.length) {
				for (i = 0; i < this._rows[parentRow].children.length; i++) {
					let child = this._rows[parentRow].children[i];
					if (child.isSearch()) {
						// If current search sorts after, stop
						if (Zotero.localeCompare(child.ref.name, search.name) > 0) {
							beforeRow = this._rowMap[child.id];
							break;
						}
					}
					// If it's not a search and it's not a collection, stop
					else if (!child.isCollection()) {
						beforeRow = this._rowMap[child.id];
						break;
					}
				}
			}
			if (beforeRow == undefined) {
				for (beforeRow = parentRow+1; this.getLevel(beforeRow) > level; beforeRow++);
			}
			this._addRow(
				new Zotero.CollectionTreeRow(this, 'search', search, level, this._rows[parentRow], i),
				beforeRow
			);
		}
		this._refreshRowMap();
		return beforeRow;
	}
}

Zotero.Utilities.Internal.makeClassEventDispatcher(Zotero.CollectionTree);


Zotero.CollectionTreeCache = {
	"lastTreeRow":null,
	"lastTempTable":null,
	"lastSearch":null,
	"lastResults":null,
	
	"clear": function () {
		this.lastTreeRow = null;
		this.lastSearch = null;
		if (this.lastTempTable) {
			let tableName = this.lastTempTable;
			let id = Zotero.DB.addCallback('commit', async function () {
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS " + tableName);
				Zotero.DB.removeCallback('commit', id);
			});
		}
		this.lastTempTable = null;
		this.lastResults = null;
	}
}
