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

const { noop, getDragTargetOrient } = require("components/utils");
const PropTypes = require("prop-types");
const React = require('react');
const ReactDOM = require('react-dom');
const LibraryTree = require('./libraryTree');
const VirtualizedTable = require('components/virtualized-table');
const { renderCell, formatColumnName } = VirtualizedTable;
const Icons = require('components/icons');
const { getCSSIcon, getCSSItemTypeIcon } = Icons;
const { COLUMNS } = require("zotero/itemTreeColumns");
const { Cc, Ci, Cu, ChromeUtils } = require('chrome');
const { OS } = ChromeUtils.importESModule("chrome://zotero/content/osfile.mjs");

/**
 * @typedef {import("./itemTreeColumns.jsx").ItemTreeColumnOptions} ItemTreeColumnOptions
 */

const CHILD_INDENT = 16;
const COLORED_TAGS_RE = new RegExp("^(?:Numpad|Digit)([0-" + Zotero.Tags.MAX_COLORED_TAGS + "]{1})$");
const COLUMN_PREFS_FILEPATH = OS.Path.join(Zotero.Profile.dir, "treePrefs.json");
const ATTACHMENT_STATE_LOAD_DELAY = 150; //ms

var ItemTree = class ItemTree extends LibraryTree {
	static async init(domEl, opts={}) {
		Zotero.debug(`Initializing React ItemTree ${opts.id}`);
		var ref;
		opts.domEl = domEl;
		await new Promise((resolve) => {
			ReactDOM.createRoot(domEl).render(<ItemTree ref={(c) => {
				ref = c;
				resolve();
			} } {...opts} />);
		});
		
		Zotero.debug(`React ItemTree ${opts.id} initialized`);
		return ref;
	}
	
	static defaultProps = {
		dragAndDrop: false,
		persistColumns: false,
		columnPicker: false,
		columns: COLUMNS,
		onContextMenu: noop,
		onActivate: noop,
		emptyMessage: '',
	};

	static propTypes = {
		id: PropTypes.string.isRequired,
		
		dragAndDrop: PropTypes.bool,
		persistColumns: PropTypes.bool,
		columnPicker: PropTypes.bool,
		columns: PropTypes.array,
		onSelectionChange: PropTypes.func,
		onContextMenu: PropTypes.func,
		onActivate: PropTypes.func,
		emptyMessage: PropTypes.string,
	};
	
	constructor(props) {
		super(props);
		
		this.type = 'item';
		this.name = 'ItemTree';
		
		this._skipKeypress = false;
		this._initialized = false;
		
		this._needsSort = false;
		this._introText = null;
		
		this._rowCache = {};
		
		this._modificationLock = Zotero.Promise.resolve();
		this._refreshPromise = Zotero.Promise.resolve();
		
		this._dropRow = null;
		
		this._unregisterID = Zotero.Notifier.registerObserver(
			this,
			['item', 'collection-item', 'item-tag', 'share-items', 'bucket', 'feedItem', 'search', 'itemtree', 'collection'],
			'itemTreeView',
			50
		);
		
		this._itemsPaneMessage = null;
		
		this._columnsId = null;

		if (this.collectionTreeRow) {
			this.collectionTreeRow.view.itemTreeView = this;
		}
		
		this._itemTreeLoadingDeferred = Zotero.Promise.defer();
	}

	unregister() {
		this._uninitialized = true;
		Zotero.Notifier.unregisterObserver(this._unregisterID);
		this._writeColumnPrefsToFile(true);
	}

	componentDidMount() {
		this._initialized = true;
		this._itemTreeLoadingDeferred.resolve();
		// Create an element where we can create drag images to be displayed next to the cursor while dragging
		// since for multiple item drags we need to display all the elements
		let elem = this._dragImageContainer = document.createElement("div");
		elem.style.width = "100%";
		elem.style.height = "2000px";
		elem.style.position = "absolute";
		elem.style.top = "-10000px";
		elem.className = "drag-image-container";
		this.domEl.appendChild(elem);
	}
	
	componentWillUnmount() {
		this.domEl.removeChild(this._dragImageContainer);
	}
	
	
	/**
	 * Get global columns from ItemTreeColumns and local columns from this.columns
	 * @returns {ItemTreeColumnOptions[]}
	 */
	getColumns() {
		const extraColumns = Zotero.ItemTreeManager.getCustomColumns(this.props.id);

		/** @type {ItemTreeColumnOptions[]} */
		const currentColumns = this.props.columns.map(col => Object.assign({}, col));
		extraColumns.forEach((column) => {
			if (!currentColumns.find(c => c.dataKey === column.dataKey)) {
				currentColumns.push(column);
			}
		});
		return currentColumns;
	}

	/**
	 * NOTE: In XUL item tree waitForLoad() just returned this._waitForEvent('load').
	 * That was because on each collection change the item tree class was reset and the
	 * `load` event was a `once` and `triggerImmediately` event.
	 *
	 * Since in this implementation the item tree class is created once and stays up through
	 * the lifetime of Zotero we cannot replicate the previous behaviour with events easily
	 * so we use a deferred promise instead
	 * @returns {Promise}
	 */
	waitForLoad() {
		return this._itemTreeLoadingDeferred.promise;
	}
	
	async setItemsPaneMessage(message, lock=false) {
		if (this._locked) return;
		if (typeof message == 'string') {
			// Hack to keep "Loading items…" small
			if (message == Zotero.getString('pane.items.loading')) {}
			else {
				let messageParts = message.split("\n\n");
				message = messageParts.map(part => `<p>${part}</p>`).join('');
			}
		}
		else if (message.outerHTML) {
			message = message.outerHTML;
		}
		const shouldRerender = this._itemsPaneMessage != message;
		this._itemsPaneMessage = message;
		this._locked = lock;
		return shouldRerender && new Promise(resolve => this.forceUpdate(resolve));
	}
	
	async clearItemsPaneMessage() {
		const shouldRerender = this._itemsPaneMessage;
		this._itemsPaneMessage = null;
		return shouldRerender && new Promise(resolve => this.forceUpdate(resolve));
	}
	
	refresh = Zotero.serial(async function (skipExpandMatchParents) {
		Zotero.debug('Refreshing items list for ' + this.id);
		
		var resolve, reject;
		this._refreshPromise = new Zotero.Promise(function () {
			resolve = arguments[0];
			reject = arguments[1];
		});
		
		try {
			Zotero.CollectionTreeCache.clear();
			// Get the full set of items we want to show
			let newSearchItems = await this.collectionTreeRow.getItems();
			if (this.collectionTreeRow.isTrash()) {
				// When in trash, also fetch trashed collections and searched
				// So that they are displayed among deleted items
				newSearchItems = newSearchItems
					.concat(await this.collectionTreeRow.getTrashedCollections())
					.concat(await Zotero.Searches.getDeleted(this.collectionTreeRow.ref.libraryID));
			}
			// TEMP: Hide annotations
			newSearchItems = newSearchItems.filter(item => !item.isAnnotation());
			// Remove notes and attachments if necessary
			if (this.regularOnly) {
				newSearchItems = newSearchItems.filter((item) => {
					return item instanceof Zotero.Collection
						|| item instanceof Zotero.Search
						|| item.isRegularItem();
				});
			}
			let newSearchItemIDs = new Set(newSearchItems.map(item => item.id));
			// Find the items that aren't yet in the tree
			let itemsToAdd = newSearchItems.filter(item => this._rowMap[item.treeViewID] === undefined);
			// Find the parents of search matches
			let newSearchParentIDs = new Set(
				this.regularOnly
					? []
					: newSearchItems.filter(item => !!item.parentItemID).map(item => item.parentItemID)
			);
			this._searchParentIDs = newSearchParentIDs;
			newSearchItems = new Set(newSearchItems);
			
			var newCellTextCache = {};
			var newSearchMode = this.collectionTreeRow.isSearchMode();
			var newRows = [];
			var allItemIDs = new Set();
			var addedItemIDs = new Set();
			
			// Copy old rows to new array, omitting top-level items not in the new set and their children
			//
			// This doesn't add new child items to open parents or remove child items that no longer exist,
			// which is done by toggling all open containers below.
			var skipChildren;
			for (let i = 0; i < this._rows.length; i++) {
				let row = this._rows[i];
				// Top-level items
				if (row.level == 0) {
					// A top-level attachment moved into a parent. Don't copy, it will be added
					// via this loop for the parent item.
					if (row.ref instanceof Zotero.Item && row.ref.parentID) {
						continue;
					}
					let isSearchParent = newSearchParentIDs.has(row.ref.treeViewID);
					// If not showing children or no children match the search, close
					if (this.regularOnly || !isSearchParent) {
						row.isOpen = false;
						skipChildren = true;
					}
					else {
						skipChildren = false;
					}
					// Skip items that don't match the search and don't have children that do
					if (!newSearchItems.has(row.ref) && !isSearchParent) {
						continue;
					}
				}
				else if (row.level == 1 && !row.ref.parentID) {
					// A child attachment moved into top-level. It needs to be added anew in a different
					// location.
					itemsToAdd.push(row.ref);
					continue;
				}
				// Child items
				else if (skipChildren) {
					continue;
				}
				newRows.push(row);
				allItemIDs.add(row.ref.treeViewID);
			}
			
			// Add new items
			for (let i = 0; i < itemsToAdd.length; i++) {
				let item = itemsToAdd[i];

				// If child item matches search and parent hasn't yet been added, add parent
				let parentItemID = item.parentItemID;
				if (parentItemID) {
					if (allItemIDs.has(parentItemID)) {
						continue;
					}
					item = Zotero.Items.get(parentItemID);
				}
				// Parent item may have already been added from child
				else if (allItemIDs.has(item.treeViewID)) {
					continue;
				}
				
				// Add new top-level items
				let row = new ItemTreeRow(item, 0, false);
				newRows.push(row);
				allItemIDs.add(item.treeViewID);
				addedItemIDs.add(item.treeViewID);
			}
			
			this._rows = newRows;
			this._refreshRowMap();
			// Sort only the new items
			//
			// This still results in a lot of extra work (e.g., when clearing a quick search, we have to
			// re-sort all items that didn't match the search), so as a further optimization we could keep
			// a sorted list of items for a given column configuration and restore items from that.
			await this.sort([...addedItemIDs]);
			
			// Toggle all open containers closed and open to refresh child items
			//
			// This could be avoided by making sure that items in notify() that aren't present are always
			// added.
			var t = new Date();
			for (let i = 0; i < this._rows.length; i++) {
				if (this.isContainer(i) && this.isContainerOpen(i)) {
					this.toggleOpenState(i, true);
					this.toggleOpenState(i, true);
				}
			}
			Zotero.debug(`Refreshed open parents in ${new Date() - t} ms`);
			
			this._refreshRowMap();
			
			this._searchMode = newSearchMode;
			this._searchItemIDs = newSearchItemIDs; // items matching the search
			this._rowCache = {};
				
			if (!this.collectionTreeRow.isPublications()) {
				this.expandMatchParents(newSearchParentIDs);
			}
			
			// Clear My Publications intro text on a refresh with items
			if (this.collectionTreeRow.isPublications() && this.rowCount) {
				this.clearItemsPaneMessage();
			}
			
			await this.runListeners('refresh');
			
			setTimeout(function () {
				resolve();
			});
		}
		catch (e) {
			setTimeout(function () {
				reject(e);
			});
			throw e;
		}
	})

	/*
	 *  Called by Zotero.Notifier on any changes to items in the data layer
	 */
	async notify(action, type, ids, extraData) {
		Zotero.debug("Yielding for refresh promise"); // TEMP
		await this._refreshPromise;

		if (!this._treebox) {
			Zotero.debug("Treebox didn't exist in itemTree.notify()");
			return;
		}

		if (!this._rowMap) {
			Zotero.debug("Item row map didn't exist in itemTree.notify()");
			return;
		}

		// Reset columns on custom column change
		if(type === "itemtree" && action === "refresh") {
			await this._resetColumns();
			return;
		}

		// If a collection with subcollections is deleted/restored, ids will include subcollections
		// though they are not showing in itemTree.
		// Filter subcollections out to treat it as single selected row
		if (type == 'collection' && action == "modify") {
			let deletedParents = new Set();
			let collections = [];
			for (let id of ids) {
				let collection = Zotero.Collections.get(id);
				deletedParents.add(collection.key);
				collections.push(collection);
			}
			ids = collections.filter(c => !c.parentKey || !deletedParents.has(c.parentKey)).map(c => c.id);
		}

		// Add C or S prefix to match .treeViewID
		if (type == 'collection' || type == 'search') {
			let prefix = type == 'collection' ? 'C' : 'S';
			ids = ids.map(id => prefix + id);
		}

		// Clear item type icon and tag colors when a tag is added to or removed from an item
		if (type == 'item-tag') {
			// TODO: Only update if colored tag changed?
			ids.map(val => val.split("-")[0]).forEach(function (val) {
				this.tree.invalidateRow(this._rowMap[val]);
			}.bind(this));
			return;
		}

		const collectionTreeRow = this.collectionTreeRow;

		if (collectionTreeRow.isFeedsOrFeed() && action == 'modify') {
			for (const id of ids) {
				this.tree.invalidateRow(this._rowMap[id]);
			}
		}

		// Redraw the tree (for tag color and progress changes)
		if (action == 'redraw') {
			// Redraw specific rows
			if (type == 'item' && ids.length) {
				for (let id of ids) {
					this.tree.invalidateRow(this._rowMap[id]);
				}
			}
			// Redraw the whole tree
			else {
				this.tree.invalidate();
			}
			return;
		}

		var madeChanges = false;
		var refreshed = false;
		var sort = false;

		var savedSelection = this.getSelectedObjects();
		var previousFirstSelectedRow = this._rowMap[
			// 'collection-item' ids are in the form <collectionID>-<itemID>
			// 'item' events are just integers
			type == 'collection-item' ? ids[0].split('-')[1] : ids[0]
		];

		// If there's not at least one new item to be selected, get a scroll position to restore later
		var scrollPosition = false;
		if (action != 'add' || ids.every(id => extraData[id] && extraData[id].skipSelect)) {
			scrollPosition = this._saveScrollPosition();
		}

		if (action == 'refresh') {
			if (type == 'share-items') {
				if (collectionTreeRow.isShare()) {
					await this.refresh();
					refreshed = true;
				}
			}
			else if (type == 'bucket') {
				if (collectionTreeRow.isBucket()) {
					await this.refresh();
					refreshed = true;
				}
			}
			// If refreshing a single item, clear caches and then deselect and reselect row
			else if (savedSelection.length == 1 && savedSelection[0].id == ids[0]) {
				let id = ids[0];
				let row = this._rowMap[id];
				delete this._rowCache[id];
				this.tree.invalidateRow(row);

				this.selection.clearSelection();
				this._restoreSelection(savedSelection);
			}
			else {
				for (let id of ids) {
					let row = this._rowMap[id];
					if (row === undefined) continue;
					delete this._rowCache[id];
					this.tree.invalidateRow(row);
				}
			}

			// For a refresh on an item in the trash, check if the item still belongs
			if (type == 'item' && collectionTreeRow.isTrash()) {
				let rows = [];
				for (let id of ids) {
					let row = this.getRowIndexByID(id);
					if (row === false) continue;
					let item = Zotero.Items.get(id);
					// Remove parent row if it isn't deleted and doesn't have any deleted children
					// (shown by the numChildren including deleted being the same as numChildren not including deleted)
					if (!item.deleted && (!item.isRegularItem() || item.numChildren(true) == item.numChildren(false))) {
						rows.push(row);
						// And all its children in the tree
						for (let child = row + 1; child < this.rowCount && this.getLevel(child) > this.getLevel(row); child++) {
							rows.push(child);
						}
					}
				}
				if (rows.length) {
					this._removeRows(rows);
					this.tree.invalidate();
				}
			}

			return;
		}

		if (collectionTreeRow.isShare()) {
			return;
		}

		// See if we're in the active window
		var zp = Zotero.getActiveZoteroPane();
		var activeWindow = zp && zp.itemsView == this;

		var quickSearch = this._ownerDocument.getElementById('zotero-tb-search');
		var hasQuickSearch = quickSearch && quickSearch.searchTextbox.value != '';

		// 'collection-item' ids are in the form collectionID-itemID
		if (type == 'collection-item') {
			if (!collectionTreeRow.isCollection()) {
				return;
			}

			var visibleSubcollections = Zotero.Prefs.get('recursiveCollections')
				? collectionTreeRow.ref.getDescendents(false, 'collection')
				: [];
			var splitIDs = [];
			for (let id of ids) {
				var split = id.split('-');
				// Include if an item in this collection or a visible subcollection
				if (split[0] == collectionTreeRow.ref.id
						|| visibleSubcollections.some(c => split[0] == c.id)) {
					splitIDs.push(split[1]);
				}
			}
			ids = splitIDs;
		}

		this.selection.selectEventsSuppressed = true;

		if ((action == 'remove' && !collectionTreeRow.isLibrary(true))
			|| action == 'delete' || action == 'trash'
			|| (action == 'removeDuplicatesMaster' && collectionTreeRow.isDuplicates())) {
			// Since a remove involves shifting of rows, we have to do it in order,
			// so sort the ids by row
			var rows = [];
			let push = action == 'delete' || action == 'trash' || action == 'removeDuplicatesMaster';
			for (var i=0, len=ids.length; i<len; i++) {
				if (!push) {
					push = !collectionTreeRow.ref.hasItem(ids[i]);
				}
				// Row might already be gone (e.g. if this is a child and
				// 'modify' was sent to parent)
				let row = this._rowMap[ids[i]];
				if (push && row !== undefined) {
					// Don't remove child items from collections, because it's handled by 'modify'
					if (action == 'remove' && this.getParentIndex(row) != -1) {
						continue;
					}
					rows.push(row);

					// Remove child items of removed parents
					if (this.isContainer(row) && this.isContainerOpen(row)) {
						while (++row < this.rowCount && this.getLevel(row) > 0) {
							rows.push(row);
						}
					}
				}
			}

			if (rows.length > 0) {
				this._removeRows(rows);
				madeChanges = true;
			}
		}
		else if (['item', 'collection', 'search'].includes(type) && action == 'modify')
		{
			// Clear row caches
			for (const id of ids) {
				delete this._rowCache[id];
			}

			// If saved search, publications, or trash, just re-run search
			if (collectionTreeRow.isSearch()
				|| collectionTreeRow.isPublications()
				|| collectionTreeRow.isTrash()
				|| hasQuickSearch) {
				await this.refresh();
				refreshed = true;
				madeChanges = true;
				// Don't bother re-sorting in trash, since it's probably just a modification of a parent
				// item that's about to be deleted
				if (!collectionTreeRow.isTrash()) {
					sort = true;
				}
			}
			else if (collectionTreeRow.isFeedsOrFeed()) {
				// Moved to itemPane CE
			}
			// If not a search, process modifications manually
			else {
				var items = Zotero.Items.get(ids);

				for (let i = 0; i < items.length; i++) {
					let item = items[i];
					let id = item.id;

					let row = this._rowMap[id];

					// Deleted items get a modify that we have to ignore when
					// not viewing the trash
					if (item.deleted) {
						continue;
					}

					// Item already exists in this view
					if (row !== undefined) {
						let parentItemID = this.getRow(row).ref.parentItemID;
						let parentIndex = this.getParentIndex(row);

						// Top-level item
						if (this.isContainer(row)) {
							// If Unfiled Items and itm was added to a collection, remove from view
							if (collectionTreeRow.isUnfiled() && item.getCollections().length) {
								this._removeRow(row);
							}
							// Otherwise just resort
							else {
								sort = true;
							}
						}
						// If item moved from top-level to under another item, remove the old row.
						else if (parentIndex == -1 && parentItemID) {
							this._removeRow(row);
						}
						// If moved from under another item to top level, remove old row and add new one
						else if (parentIndex != -1 && !parentItemID) {
							this._removeRow(row);

							let beforeRow = this.rowCount;
							this._addRow(new ItemTreeRow(item, 0, false), beforeRow);

							sort = true;
						}
						// If item was moved from one parent to another, remove from old parent
						else if (parentItemID && parentIndex != -1 && this._rowMap[parentItemID] != parentIndex) {
							this._removeRow(row);
						}
						// If not moved from under one item to another, just resort the row,
						// which also invalidates it and refreshes it
						else {
							sort = id;
						}

						madeChanges = true;
					}
					// Otherwise, for a top-level item in a library root or a collection
					// containing the item, the item has to be added
					else if (item.isTopLevelItem()) {
						// Root view
						let add = collectionTreeRow.isLibrary(true)
							&& collectionTreeRow.ref.libraryID == item.libraryID;
						// Collection containing item
						if (!add && collectionTreeRow.isCollection()) {
							add = item.inCollection(collectionTreeRow.ref.id);
						}
						if (add) {
							//most likely, the note or attachment's parent was removed.
							let beforeRow = this.rowCount;
							this._addRow(new ItemTreeRow(item, 0, false), beforeRow);
							madeChanges = true;
							sort = id;
						}
					}
				}

				if (sort && ids.length != 1) {
					sort = true;
				}
			}
		}
		else if(type == 'item' && action == 'add')
		{
			let items = Zotero.Items.get(ids);

			// In some modes, just re-run search
			if (collectionTreeRow.isSearch()
					|| collectionTreeRow.isPublications()
					|| collectionTreeRow.isTrash()
					|| collectionTreeRow.isUnfiled()
					|| hasQuickSearch) {
				if (hasQuickSearch) {
					// For item adds, clear the quick search, unless all the new items have
					// skipSelect or are child items
					if (activeWindow && type == 'item') {
						let clear = false;
						for (let i=0; i<items.length; i++) {
							if (!extraData[items[i].id].skipSelect && items[i].isTopLevelItem()) {
								clear = true;
								break;
							}
						}
						if (clear) {
							quickSearch.value = '';
							collectionTreeRow.setSearch('');
						}
					}
				}
				await this.refresh();
				refreshed = true;
				madeChanges = true;
				sort = true;
			}
			// Otherwise process new items manually
			else {
				for (let i=0; i<items.length; i++) {
					let item = items[i];
					// if the item belongs in this collection
					if (((collectionTreeRow.isLibrary(true)
						&& collectionTreeRow.ref.libraryID == item.libraryID)
						|| (collectionTreeRow.isCollection() && item.inCollection(collectionTreeRow.ref.id)))
						// if we haven't already added it to our hash map
						&& this._rowMap[item.id] == null
						// Regular item or standalone note/attachment
						&& item.isTopLevelItem()) {
						let beforeRow = this.rowCount;
						this._addRow(new ItemTreeRow(item, 0, false), beforeRow);
						madeChanges = true;
					}
				}
				if (madeChanges) {
					sort = (items.length == 1) ? items[0].id : true;
				}
			}
		}
		
		var reselect = false;
		if (madeChanges) {
			// If we made individual changes, we have to clear the cache
			if (!refreshed) {
				Zotero.CollectionTreeCache.clear();
			}

			var singleSelect = false;
			// If adding a single top-level item and this is the active window, select it
			if (action == 'add' && activeWindow) {
				if (ids.length == 1) {
					singleSelect = ids[0];
				}
				// If there's only one parent item in the set of added items,
				// mark that for selection in the UI
				//
				// Only bother checking for single parent item if 1-5 total items,
				// since a translator is unlikely to save more than 4 child items
				else if (ids.length <= 5) {
					var items = Zotero.Items.get(ids);
					if (items) {
						let itemTypeAttachment = Zotero.ItemTypes.getID('attachment');
						let itemTypeNote = Zotero.ItemTypes.getID('note');

						var found = false;
						for (let item of items) {
							// Check for attachment and note types, since it's quicker
							// than checking for parent item
							if (item.itemTypeID == itemTypeAttachment || item.itemTypeID == itemTypeNote) {
								continue;
							}

							// We already found a top-level item, so cancel the
							// single selection
							if (found) {
								singleSelect = false;
								break;
							}
							found = true;
							singleSelect = item.id;
						}
					}
				}
			}

			if (sort) {
				await this.sort(typeof sort == 'number' ? [sort] : false);
			}
			else {
				this._refreshRowMap();
			}

			if (singleSelect) {
				if (!extraData[singleSelect] || !extraData[singleSelect].skipSelect) {
					this._ownerDocument.getElementById('zotero-view-item').scrollTop = 0;
					await this.selectItem(singleSelect);
					reselect = true;
				}
			}
			// If single item is selected and was modified
			else if (action == 'modify' && ids.length == 1 &&
				savedSelection.length == 1 && savedSelection[0].id == ids[0]) {
				if (activeWindow) {
					await this.selectItem(ids[0]);
					reselect = true;
				}
				else {
					this._restoreSelection(savedSelection);
					reselect = true;
				}
			}
			// On removal of a selected row, select item at previous position
			else if (savedSelection.length) {
				if ((action == 'remove'
						|| action == 'trash'
						|| action == 'delete'
						|| action == 'removeDuplicatesMaster')
					&& savedSelection.some(o => this.getRowIndexByID(o.id) === false)) {
					// In duplicates view, select the next set on delete
					if (collectionTreeRow.isDuplicates()) {
						if (this._rows[previousFirstSelectedRow]) {
							var itemID = this._rows[previousFirstSelectedRow].ref.id;
							var setItemIDs = collectionTreeRow.ref.getSetItemsByItemID(itemID);
							this.selectItems(setItemIDs);
							reselect = true;
						}
					}
					else {
						// If this was a child item and the next item at this
						// position is a top-level item, move selection one row
						// up to select a sibling or parent
						if (ids.length == 1 && previousFirstSelectedRow > 0) {
							let previousItem = Zotero.Items.get(ids[0]);
							if (previousItem && !previousItem.isTopLevelItem()) {
								if (this._rows[previousFirstSelectedRow]
									&& this.getLevel(previousFirstSelectedRow) == 0) {
									previousFirstSelectedRow--;
								}
							}
						}

						if (previousFirstSelectedRow !== undefined && previousFirstSelectedRow in this._rows) {
							this.selection.select(previousFirstSelectedRow);
							reselect = true;
						}
						// If no item at previous position, select last item in list
						else if (this._rows.length > 0 && this._rows[this._rows.length - 1]) {
							this.selection.select(this._rows.length - 1);
							reselect = true;
						}
					}
				}
				else {
					await this._restoreSelection(savedSelection);
					reselect = true;
				}
			}

			this._rememberScrollPosition(scrollPosition);
		}

		this._updateIntroText();

		// If we made changes to the selection (including reselecting the same item, which will register as
		// a selection when selectEventsSuppressed is set to false), wait for a select event on the tree
		// view (e.g., as triggered by itemsView.runListeners('select') in ZoteroPane::itemSelected())
		// before returning. This guarantees that changes are reflected in the middle and right-hand panes
		// before returning from the save transaction.
		//
		// If no onselect handler is set on the tree element, as is the case in the Advanced Search window,
		// the select listeners never get called, so don't wait.
		if (reselect && this.props.onSelectionChange) {
			var selectPromise = this.waitForSelect();
			this.selection.selectEventsSuppressed = false;
			Zotero.debug("Yielding for select promise"); // TEMP
			return selectPromise;
		}
		else {
			this.selection.selectEventsSuppressed = false;
		}
	}
	
	handleActivate = (event, indices) => {
		// Ignore double-clicks in duplicates view on everything except attachments
		let items = indices.map(index => this.getRow(index).ref);
		if (event.button == 0 && this.collectionTreeRow.isDuplicates()) {
			if (items.length != 1 || !items[0].isAttachment()) {
				return false;
			}
		}
		this.props.onActivate(event, items);
	}

	/**
	 * @param event {InputEvent}
	 * @returns {boolean} false to prevent any handling by the virtualized-table
	 */
	handleKeyDown = (event) => {
		if (Zotero.locked) {
			return false;
		}
		
		// Handle arrow keys specially on multiple selection, since
		// otherwise the tree just applies it to the last-selected row
		if (this.selection.count > 1 && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
			if (event.key == Zotero.arrowNextKey) {
				this.expandSelectedRows();
			}
			else {
				this.collapseSelectedRows();
			}
			return false;
		}
		if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && COLORED_TAGS_RE.test(event.code)) {
			let libraryID = this.collectionTreeRow.ref.libraryID;
			let position = COLORED_TAGS_RE.exec(event.code)[1] - 1;
			// When 0 is pressed, remove all colored tags
			if (position == -1) {
				let items = this.getSelectedItems();
				return Zotero.Tags.removeColoredTagsFromItems(items);
			}
			let colorData = Zotero.Tags.getColorByPosition(libraryID, position);
			// If a color isn't assigned to this number or any
			// other numbers, allow key navigation
			if (!colorData) {
				return !Zotero.Tags.getColors(libraryID).size;
			}

			var items = this.getSelectedItems();
			// Async operation and we're not waiting for the promise
			// since we need to return false below to prevent virtualized-table from handling the event
			const _promise = Zotero.Tags.toggleItemsListTags(items, colorData.name);
			return false;
		}
		else if (event.key == 'a'
				&& !event.altKey
				&& !event.shiftKey
				&& (Zotero.isMac ? (event.metaKey && !event.ctrlKey) : event.ctrlKey)) {
			if (!this.collectionTreeRow.isPublications()) {
				this.expandMatchParents(this._searchParentIDs);
			}
		}
		else if (event.key == '+' && !(event.ctrlKey || event.altKey || event.metaKey)) {
			this.expandAllRows();
			return false;
		}
		else if (event.key == '-' && !(event.shiftKey || event.ctrlKey
			|| event.altKey || event.metaKey)) {
			this.collapseAllRows();
			return false;
		}
		return true;
	}

	/**
	 * Select the first row when the tree is focused by the keyboard.
	 */
	handleKeyUp = (event) => {
		if (!Zotero.locked && event.code === 'Tab' && this.selection.count == 0) {
			this.selection.select(this.selection.focused);
		}
	};
	
	render() {
		const itemsPaneMessageHTML = this._itemsPaneMessage || this.props.emptyMessage;
		const showMessage = !this.collectionTreeRow || this._itemsPaneMessage;
		
		const itemsPaneMessage = (<div
			key="items-pane-message"
			onDragOver={e => this.props.dragAndDrop && this.onDragOver(e, -1)}
			onDrop={e => this.props.dragAndDrop && this.onDrop(e, -1)}
			onClick={(e) => {
				if (e.target.dataset.href) {
					window.ZoteroPane.loadURI(e.target.dataset.href);
				}
				if (e.target.dataset.action == 'open-sync-prefs') {
					Zotero.Utilities.Internal.openPreferences('zotero-prefpane-sync');
				}
			}}
			className={"items-tree-message"}
			style={{ display: showMessage ? "flex" : "none" }}
			dangerouslySetInnerHTML={{ __html: itemsPaneMessageHTML }}>
		</div>);

		let virtualizedTable = (<div style={{display: showMessage ? 'none' : 'flex'}}
			className="virtualized-table" key="virtualized-table-stub"></div>);
		if (this.collectionTreeRow) {
			virtualizedTable = React.createElement(VirtualizedTable,
				{
					getRowCount: () => this._rows.length,
					id: this.id,
					ref: ref => this.tree = ref,
					treeboxRef: ref => this._treebox = ref,
					renderItem: this._renderItem.bind(this),
					hide: showMessage,
					key: "virtualized-table",

					showHeader: true,
					columns: this._getColumns(),
					onColumnPickerMenu: this._displayColumnPickerMenu,
					onColumnSort: this.collectionTreeRow.isFeedsOrFeed() ? null : this._handleColumnSort,
					getColumnPrefs: this._getColumnPrefs,
					storeColumnPrefs: this._storeColumnPrefs,
					getDefaultColumnOrder: this._getDefaultColumnOrder,
					containerWidth: this.domEl.clientWidth,
					firstColumnExtraWidth: 28, // 16px for twisty + 16px for icon - 8px column padding + 4px margin

					multiSelect: true,

					onSelectionChange: this._handleSelectionChange,
					isSelectable: this.isSelectable,
					getParentIndex: this.getParentIndex,
					isContainer: this.isContainer,
					isContainerEmpty: this.isContainerEmpty,
					isContainerOpen: this.isContainerOpen,
					toggleOpenState: this.toggleOpenState,

					getRowString: this.getRowString.bind(this),

					onDragOver: e => this.props.dragAndDrop && this.onDragOver(e, -1),
					onDrop: e => this.props.dragAndDrop && this.onDrop(e, -1),
					onKeyDown: this.handleKeyDown,
					onKeyUp: this.handleKeyUp,
					onActivate: this.handleActivate,

					onItemContextMenu: (...args) => this.props.onContextMenu(...args),
					
					role: 'tree',
					label: Zotero.getString('pane.items.title'),
				}
			);
		}
		Zotero.debug(`itemTree.render(). Displaying ${showMessage ? "Item Pane Message" : "Item Tree"}`);

		return [
			itemsPaneMessage,
			virtualizedTable
		];
	}
	
	async changeCollectionTreeRow(collectionTreeRow) {
		if (this._locked) return;
		if (!collectionTreeRow) {
			this.tree = null;
			this._treebox = null;
			return this.clearItemsPaneMessage();
		}
		Zotero.debug(`itemTree.changeCollectionTreeRow(): ${collectionTreeRow.id}`);
		this._itemTreeLoadingDeferred = Zotero.Promise.defer();
		this.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
		let newId = "item-tree-" + this.props.id + "-" + collectionTreeRow.visibilityGroup;
		if (this.id != newId && this.props.persistColumns) {
			await this._writeColumnPrefsToFile(true);
			this.id = newId;
			await this._loadColumnPrefsFromFile();
		}
		this.id = newId;
		this.collectionTreeRow = collectionTreeRow;
		this.selection.selectEventsSuppressed = true;
		this.collectionTreeRow.view.itemTreeView = this;
		// Ensures that an up to date this._columns is set
		this._getColumns();

		this.selection.clearSelection();
		this.selection.focused = 0;
		await this.refresh();
		if (Zotero.CollectionTreeCache.error) {
			return this.setItemsPaneMessage(Zotero.getString('pane.items.loadError'));
		}
		else {
			this.clearItemsPaneMessage();
		}
		this.forceUpdate(() => {
			this.selection.selectEventsSuppressed = false;
			// Reset scrollbar to top
			this._treebox && this._treebox.scrollTo(0);
			this._updateIntroText();
			this._itemTreeLoadingDeferred.resolve();
		});
		await this._itemTreeLoadingDeferred.promise;
	}
	
	async refreshAndMaintainSelection(clearItemsPaneMessage=true) {
		if (this.selection) {
			this.selection.selectEventsSuppressed = true;
		}
		const selection = this.getSelectedObjects();
		await this.refresh();
		clearItemsPaneMessage && this.clearItemsPaneMessage();
		await new Promise((resolve) => {
			this.forceUpdate(() => {
				if (this.tree) {
					this.tree.invalidate();
					this._restoreSelection(selection);
					if (this.selection) {
						this.selection.selectEventsSuppressed = false;
					}
				}
				resolve();
			});
		});
	}
	
	async selectItem(id, noRecurse) {
		return this.selectItems([id], noRecurse);
	}
	
	async selectItems(ids, noRecurse) {
		if (!ids.length) return 0;
		
		// If no row map, we're probably in the process of switching collections,
		// so store the items to select on the item group for later
		if (!this._rowMap) {
			if (this.collectionTreeRow) {
				this.collectionTreeRow.itemsToSelect = ids;
				Zotero.debug("_rowMap not yet set; not selecting items");
				return 0;
			}

			Zotero.debug('Item group not found and no row map in ItemTree.selectItem() -- discarding select', 2);
			return 0;
		}
		
		var idsToSelect = [];
		for (let id of ids) {
			let row = this._rowMap[id];
			let item = Zotero.Items.get(id);
			
			// Can't select a deleted item if we're not in the trash
			if (item.deleted && !this.collectionTreeRow.isTrash()) {
				continue;
			}
			
			// Get the row of the parent, if there is one
			let parent = item.parentItemID;
			let parentRow = parent && this._rowMap[parent];
			
			// If row with id isn't visible, check to see if it's hidden under a parent
			if (row == undefined) {
				if (!parent || parentRow === undefined) {
					// No parent -- it's not here
					
					// Clear the quick search and tag selection and try again (once)
					if (!noRecurse && window.ZoteroPane) {
						let cleared1 = await window.ZoteroPane.clearQuicksearch();
						let cleared2 = window.ZoteroPane.tagSelector
							&& window.ZoteroPane.tagSelector.clearTagSelection();
						if (cleared1 || cleared2) {
							return this.selectItems(ids, true);
						}
					}
					
					Zotero.debug(`Couldn't find row for item ${id} -- not selecting`);
					continue;
				}
				
				// If parent is already open and we haven't found the item, the child
				// hasn't yet been added to the view, so close parent to allow refresh
				await this._closeContainer(parentRow);
				
				// Open the parent
				await this.toggleOpenState(parentRow);
			}
			
			// Since we're opening containers, we still need to reference by id
			idsToSelect.push(id);
		}
		
		// Now that all items have been expanded, get associated rows
		var rowsToSelect = [];
		for (let id of idsToSelect) {
			let row = this._rowMap[id];
			if (row === undefined) {
				Zotero.debug(`Item ${id} not in row map -- skipping`);
				continue;
			}
			rowsToSelect.push(row);
		}
		
		if (!rowsToSelect.length) {
			return 0;
		}
		
		// If items are already selected, just scroll to the top-most one
		var selectedRows = this.selection.selected;
		if (rowsToSelect.length == selectedRows.size && rowsToSelect.every(row => selectedRows.has(row))) {
			this.ensureRowsAreVisible(rowsToSelect);
			return rowsToSelect.length;
		}
		
		// Single item
		if (rowsToSelect.length == 1) {
			// this.selection.select() triggers the tree onSelect handler attribute, which calls
			// ZoteroPane.itemSelected(), which calls ZoteroPane.itemPane.render(), which refreshes the
			// itembox. But since the 'onselect' doesn't handle promises, itemSelected() isn't waited for
			// here, which means that 'yield selectItem(itemID)' continues before the itembox has been
			// refreshed. To get around this, we wait for a select event that's triggered by
			// itemSelected() when it's done.
			let promise;
			let nothingToSelect = false;
			try {
				if (!this.selection.selectEventsSuppressed) {
					promise = this.waitForSelect();
				}
				nothingToSelect = !this.selection.select(rowsToSelect[0]);
			}
			catch (e) {
				Zotero.logError(e);
			}

			if (!nothingToSelect && promise) {
				await promise;
			}
		}
		// Multiple items
		else {
			this.selection.clearSelection();
			this.selection.selectEventsSuppressed = true;
			
			var lastStart = 0;
			for (let i = 0, len = rowsToSelect.length; i < len; i++) {
				if (i == len - 1 || rowsToSelect[i + 1] != rowsToSelect[i] + 1) {
					this.selection.rangedSelect(rowsToSelect[lastStart], rowsToSelect[i], true);
					lastStart = i + 1;
				}
			}
			
			this.selection.selectEventsSuppressed = false;
		}
		
		this.ensureRowsAreVisible(rowsToSelect);
		
		return rowsToSelect.length;
	}

	/*
	 *  Sort the items by the currently sorted column.
	 */
	async sort(itemIDs) {
		var t = new Date;
		
		// For child items, just close and reopen parents
		if (itemIDs) {
			let parentItemIDs = new Set();
			let skipped = [];
			for (let itemID of itemIDs) {
				let row = this._rowMap[itemID];
				let item = this.getRow(row).ref;
				let parentItemID = item.parentItemID;
				if (!parentItemID) {
					skipped.push(itemID);
					continue;
				}
				parentItemIDs.add(parentItemID);
			}
			
			let parentRows = [...parentItemIDs].map(itemID => this._rowMap[itemID]);
			parentRows.sort();
			
			for (let i = parentRows.length - 1; i >= 0; i--) {
				let row = parentRows[i];
				this._closeContainer(row, true, true);
				this.toggleOpenState(row, true, true);
			}
			this._refreshRowMap();
			
			let numSorted = itemIDs.length - skipped.length;
			if (numSorted) {
				Zotero.debug(`Sorted ${numSorted} child items by parent toggle`);
			}
			if (!skipped.length) {
				return;
			}
			itemIDs = skipped;
			if (numSorted) {
				Zotero.debug(`${itemIDs.length} items left to sort`);
			}
		}
		
		var primaryField = this.getSortField();
		var sortFields = this.getSortFields();
		var order = this.getSortDirection(sortFields);
		var collation = Zotero.getLocaleCollation();
		var sortCreatorAsString = Zotero.Prefs.get('sortCreatorAsString');
		
		Zotero.debug(`Sorting items list by ${sortFields.join(", ")} ${order == 1 ? "ascending" : "descending"} `
			+ (itemIDs && itemIDs.length
				? `for ${itemIDs.length} ` + Zotero.Utilities.pluralize(itemIDs.length, ['item', 'items'])
				: ""));
		
		// Set whether rows with empty values should sort at the beginning
		var emptyFirst = {
			title: true,
			
			// Date columns start descending, so put empty rows at end
			date: true,
			year: true,
		};
		
		// Cache primary values while sorting, since base-field-mapped getField()
		// calls are relatively expensive
		var cache = {};
		sortFields.forEach(x => cache[x] = {});
		
		// Get the display field for a row (which might be a placeholder title)
		let getField = (field, row) => {
			var item = row.ref;
			
			switch (field) {
			case 'title':
				return Zotero.Items.getSortTitle(item.getDisplayTitle());
			
			case 'hasAttachment':
				if (this._canGetBestAttachmentState(item)) {
					return item.getBestAttachmentStateCached();
				}
				else {
					return 0;
				}
			
			case 'numNotes':
				return row.numNotes(false, true) || 0;
			
			// Use unformatted part of date strings (YYYY-MM-DD) for sorting
			case 'date':
				var val = row.ref.getField('date', true, true);
				if (val) {
					val = val.substr(0, 10);
					if (val.indexOf('0000') == 0) {
						val = "";
					}
				}
				return val;
			
			case 'year':
				var val = row.ref.getField('date', true, true);
				if (val) {
					val = val.substr(0, 4);
					if (val == '0000') {
						val = "";
					}
				}
				return val;
				
			case 'feed':
				return (row.ref.isFeedItem && Zotero.Feeds.get(row.ref.libraryID).name) || "";
			
			default:
				// Get from row.getField() to allow for custom fields
				return row.getField(field, false, true);
			}
		}
		
		var includeTrashed = this.collectionTreeRow.isTrash();
		
		function fieldCompare(a, b, sortField) {
			var aItemID = a.id;
			var bItemID = b.id;
			var fieldA = cache[sortField][aItemID];
			var fieldB = cache[sortField][bItemID];
			
			switch (sortField) {
			case 'firstCreator':
				return creatorSort(a, b);
			
			case 'itemType':
				var typeA = Zotero.ItemTypes.getLocalizedString(a.ref.itemTypeID);
				var typeB = Zotero.ItemTypes.getLocalizedString(b.ref.itemTypeID);
				return (typeA > typeB) ? 1 : (typeA < typeB) ? -1 : 0;
				
			default:
				if (fieldA === undefined) {
					cache[sortField][aItemID] = fieldA = getField(sortField, a);
				}
				
				if (fieldB === undefined) {
					cache[sortField][bItemID] = fieldB = getField(sortField, b);
				}
				
				// Display rows with empty values last
				if (!emptyFirst[sortField]) {
					if(fieldA === '' && fieldB !== '') return 1;
					if(fieldA !== '' && fieldB === '') return -1;
				}
				
				if (sortField == 'hasAttachment') {
					// PDFs at the top
					const order = ['pdf', 'snapshot', 'epub', 'image', 'video', 'other', 'none'];
					fieldA = order.indexOf(fieldA.type || 'none') + (fieldA.exists ? 0 : (order.length - 1));
					fieldB = order.indexOf(fieldB.type || 'none') + (fieldB.exists ? 0 : (order.length - 1));
					return fieldA - fieldB;
				}

				if (sortField == 'callNumber') {
					return Zotero.Utilities.Item.compareCallNumbers(fieldA, fieldB);
				}
				
				return collation.compareString(1, fieldA, fieldB);
			}
		}
		
		var rowSort = function (a, b) {
			for (let i = 0; i < sortFields.length; i++) {
				let cmp = fieldCompare(a, b, sortFields[i]);
				if (cmp !== 0) {
					return cmp;
				}
			}
			return 0;
		};
		
		var creatorSortCache = {};
		
		function creatorSort(a, b) {
			var itemA = a.ref;
			var itemB = b.ref;
			//
			// Try sorting by the first name in the firstCreator field, since we already have it
			//
			// For sortCreatorAsString mode, just use the whole string
			//
			var aItemID = a.id,
				bItemID = b.id,
				fieldA = creatorSortCache[aItemID],
				fieldB = creatorSortCache[bItemID];
			var prop = sortCreatorAsString ? 'firstCreator' : 'sortCreator';
			var sortStringA = itemA[prop];
			var sortStringB = itemB[prop];
			if (fieldA === undefined) {
				let firstCreator = Zotero.Items.getSortTitle(sortStringA);
				fieldA = firstCreator;
				creatorSortCache[aItemID] = fieldA;
			}
			if (fieldB === undefined) {
				let firstCreator = Zotero.Items.getSortTitle(sortStringB);
				fieldB = firstCreator;
				creatorSortCache[bItemID] = fieldB;
			}
			
			if (fieldA === "" && fieldB === "") {
				return 0;
			}
			
			// Display rows with empty values last
			if (fieldA === '' && fieldB !== '') return 1;
			if (fieldA !== '' && fieldB === '') return -1;
			
			return collation.compareString(1, fieldA, fieldB);
		}
		
		var savedSelection = this.getSelectedObjects();
		
		// Save open state and close containers before sorting
		var openItemIDs = this._saveOpenState(true);
		
		// Sort specific items
		try {
			if (itemIDs) {
				let idsToSort = new Set(itemIDs);
				this._rows.sort((a, b) => {
					// Don't re-sort existing items. This assumes a stable sort(), which is the case in Firefox
					// but not Chrome/v8.
					if (!idsToSort.has(a.ref.id) && !idsToSort.has(b.ref.id)) return 0;
					return rowSort(a, b) * order;
				});
			}
			// Full sort
			else {
				this._rows.sort((a, b) => rowSort(a, b) * order);
			}
		}
		catch (e) {
			Zotero.logError("Error sorting fields: " + e.message);
			Zotero.debug(e, 1);
			// Clear anything that might be contributing to the error
			Zotero.Prefs.clear('secondarySort.' + this.getSortField());
			Zotero.Prefs.clear('fallbackSort');
		}
		
		this._refreshRowMap();
		
		this._rememberOpenState(openItemIDs);
		this._restoreSelection(savedSelection);
		
		if (this.tree && !this.selection.selectEventsSuppressed) {
			this.tree.invalidate();
		}

		var numSorted = itemIDs ? itemIDs.length : this._rows.length;
		Zotero.debug(`Sorted ${numSorted} ${Zotero.Utilities.pluralize(numSorted, ['item', 'items'])} `
			+ `in ${new Date - t} ms`);
	}

	async setFilter(type, data) {
		if (this._locked) return;
		switch (type) {
			case 'search':
				this.collectionTreeRow.setSearch(data);
				break;
			case 'tags':
				this.collectionTreeRow.setTags(data);
				break;
			default:
				throw ('Invalid filter type in setFilter');
		}
		await this.refreshAndMaintainSelection();
	};

	ensureRowsAreVisible(indices) {
		if (!this._treebox) return;
		let itemHeight = this.tree._rowHeight;
		
		const pageLength = Math.floor(this._treebox.getWindowHeight() / itemHeight);
		const maxBuffer = 5;
		
		indices = Array.from(indices).filter(index => index < this._rows.length);
		indices.sort((a, b) => a - b);
		
		// If all rows are already visible, don't do anything
		if (indices.every(x => this.tree.rowIsVisible(x))) {
			//Zotero.debug("All indices are already visible");
			return;
		}
		
		var indicesWithParents = [];
		for (let row of indices) {
			let parent = this.getParentIndex(row);
			indicesWithParents.push(parent != -1 ? parent : row);
		}
		
		// If we can fit all parent indices in view, do that
		for (let buffer = maxBuffer; buffer >= 0; buffer--) {
			if (indicesWithParents[indicesWithParents.length - 1] - indicesWithParents[0] - buffer < pageLength) {
				//Zotero.debug(`We can fit all parent indices with buffer ${buffer}`);
				this.ensureRowIsVisible(indicesWithParents[0] - buffer);
				this.ensureRowIsVisible(indicesWithParents[indicesWithParents.length-1] + buffer);
				return;
			}
		}
		
		// If we can fit all indices in view, do that
		for (let buffer = maxBuffer; buffer >= 0; buffer--) {
			if (indices[indices.length - 1] - indices[0] - buffer < pageLength) {
				//Zotero.debug(`We can fit all indices with buffer ${buffer}`);
				this.ensureRowIsVisible(indices[0] - buffer);
				this.ensureRowIsVisible(indices[indices.length-1] + buffer);
				return;
			}
		}
	
		// If the first parent row isn't in view and we have enough room, make it visible, trying to
		// put it five indices from the top
		if (indices[0] != indicesWithParents[0]) {
			for (let buffer = maxBuffer; buffer >= 0; buffer--) {
				if (indices[0] - indicesWithParents[0] - buffer <= pageLength) {
					//Zotero.debug(`Scrolling to first parent minus ${buffer}`);
					this.ensureRowIsVisible(indicesWithParents[0] + buffer);
					this.ensureRowIsVisible(indicesWithParents[0] - buffer);
					return;
				}
			}
		}
		
		// Otherwise just put the first row at the top
		//Zotero.debug("Scrolling to first row " + Math.max(indices[0] - maxBuffer, 0));
		this.ensureRowIsVisible(indices[0] - maxBuffer);
		this.ensureRowIsVisible(indices[0] + maxBuffer);
	}
	
	toggleOpenState = async (index, skipRowMapRefresh=false) => {
		// Shouldn't happen but does if an item is dragged over a closed
		// container until it opens and then released, since the container
		// is no longer in the same place when the spring-load closes
		if (!this.isContainer(index)) {
			return;
		}

		this._lastToggleOpenStateIndex = index;

		if (this.isContainerOpen(index)) {
			await this._closeContainer(index, skipRowMapRefresh, true);
			this._lastToggleOpenStateIndex = null;
			return;
		}
		if (!skipRowMapRefresh) {
			var savedSelection = this.getSelectedObjects();
		}

		var count = 0;
		var level = this.getLevel(index);

		//
		// Open
		//
		var item = this.getRow(index).ref;

		//Get children
		var includeTrashed = this.collectionTreeRow.isTrash();
		var attachments = item.getAttachments(includeTrashed);
		var notes = item.getNotes(includeTrashed);

		var newRows;
		if (attachments.length && notes.length) {
			newRows = notes.concat(attachments);
		}
		else if (attachments.length) {
			newRows = attachments;
		}
		else if (notes.length) {
			newRows = notes;
		}

		if (newRows) {
			newRows = Zotero.Items.get(newRows);

			for (let i = 0; i < newRows.length; i++) {
				count++;
				this._addRow(
					new ItemTreeRow(newRows[i], level + 1, false),
					index + i + 1,
					true
				);
			}
		}

		this._rows[index].isOpen = true;

		if (count == 0) {
			this._lastToggleOpenStateIndex = null;
			return;
		}

		if (!skipRowMapRefresh) {
			Zotero.debug('Refreshing item row map');
			this._refreshRowMap();
			
			await this._refreshPromise;
			this._restoreSelection(savedSelection, false, true);
			this.tree.invalidate();
		}
		this._lastToggleOpenStateIndex = null;
	}

	expandMatchParents(searchParentIDs) {
		// Expand parents of child matches
		if (!this._searchMode) {
			return;
		}

		var savedSelection = this.getSelectedObjects();
		for (var i=0; i<this.rowCount; i++) {
			var id = this.getRow(i).ref.id;
			if (searchParentIDs.has(id) && this.isContainer(i) && !this.isContainerOpen(i)) {
				this.toggleOpenState(i, true);
			}
		}
		this._refreshRowMap();
		this._restoreSelection(savedSelection);
	}

	expandAllRows() {
		this.selection.selectEventsSuppressed = true;
		var selectedItems = this.getSelectedObjects();
		for (var i=0; i<this.rowCount; i++) {
			if (this.isContainer(i) && !this.isContainerOpen(i)) {
				this.toggleOpenState(i, true);
			}
		}
		this._refreshRowMap();
		this._restoreSelection(selectedItems);
		this.tree.invalidate();
		this.selection.selectEventsSuppressed = false;
	}


	collapseAllRows() {
		this.selection.selectEventsSuppressed = true;
		const selectedItems = this.getSelectedObjects();
		for (var i=0; i<this.rowCount; i++) {
			if (this.isContainer(i)) {
				this._closeContainer(i, true);
			}
		}
		this._refreshRowMap();
		this._restoreSelection(selectedItems, false);
		this.tree.invalidate();
		this.selection.selectEventsSuppressed = false;
	};


	expandSelectedRows() {
		this.selection.selectEventsSuppressed = true;
		const selectedItems = this.getSelectedObjects();
		// Reverse sort so we don't mess up indices of subsequent
		// items when expanding
		const indices = Array.from(this.selection.selected).sort((a, b) => b - a);
		for (const index of indices) {
			if (this.isContainer(index) && !this.isContainerOpen(index)) {
				this.toggleOpenState(index, true);
			}
		}
		this._refreshRowMap();
		this._restoreSelection(selectedItems, false, indices.length == 1);
		this.tree.invalidate();
		this.selection.selectEventsSuppressed = false;
	}


	collapseSelectedRows() {
		this.selection.selectEventsSuppressed = true;
		const selectedItems = this.getSelectedObjects();
		// Reverse sort and so we don't mess up indices of subsequent
		// items when collapsing
		const indices = Array.from(this.selection.selected).sort((a, b) => b - a);
		for (const index of indices) {
			if (this.isContainer(index)) {
				this._closeContainer(index, true);
			}
		}
		this._refreshRowMap();
		this._restoreSelection(selectedItems, false, true);
		this.tree.invalidate();
		this.selection.selectEventsSuppressed = false;
	}

	// //////////////////////////////////////////////////////////////////////////////
	//
	//  Data access methods
	//
	// //////////////////////////////////////////////////////////////////////////////

	getCellText(index, column) {
		return this._getRowData(index)[column];
	}

	getRowString(index) {
		return this.getCellText(index, this.getSortField())
	}

	async deleteSelection(force) {
		if (arguments.length > 1) {
			throw new Error("ItemTree.deleteSelection() no longer takes two parameters");
		}

		if (this.selection.count == 0) {
			return;
		}
		
		try {
			this.selection.selectEventsSuppressed = true;

			// Collapse open items
			for (var i = 0; i < this.rowCount; i++) {
				if (this.selection.isSelected(i) && this.isContainer(i)) {
					await this._closeContainer(i, false, true);
				}
			}
			this._refreshRowMap();
			this.tree.invalidate();

			let selectedObjects = [...this.selection.selected].map(index => this.getRow(index).ref);
			let selectedItems = selectedObjects.filter(o => o instanceof Zotero.Item);
			let selectedItemIDs = selectedItems.map(o => o.id);

			let collectionTreeRow = this.collectionTreeRow;

			if (collectionTreeRow.isBucket()) {
				collectionTreeRow.ref.deleteItems(ids);
			}
			else if (collectionTreeRow.isTrash()) {
				let [trashedCollectionIDs, trashedSearches] = [[], []];
				for (let obj of selectedObjects) {
					if (obj instanceof Zotero.Collection) {
						trashedCollectionIDs.push(obj.id);
					}
					if (obj instanceof Zotero.Search) {
						trashedSearches.push(obj.id);
					}
				}
				if (trashedCollectionIDs.length > 0) {
					await Zotero.Collections.erase(trashedCollectionIDs);
				}
				if (trashedSearches.length > 0) {
					await Zotero.Searches.erase(trashedSearches);
				}
				if (selectedItemIDs.length > 0) {
					await Zotero.Items.erase(selectedItemIDs);
				}
			}
			else if (collectionTreeRow.isLibrary(true)
					|| collectionTreeRow.isSearch()
					|| collectionTreeRow.isUnfiled()
					|| collectionTreeRow.isRetracted()
					|| collectionTreeRow.isDuplicates()
					|| force) {
				await Zotero.Items.trashTx(selectedItemIDs);
			}
			else if (collectionTreeRow.isCollection()) {
				let collectionIDs = [collectionTreeRow.ref.id];
				if (Zotero.Prefs.get('recursiveCollections')) {
					collectionIDs.push(...collectionTreeRow.ref.getDescendents(false, 'collection').map(c => c.id));
				}

				await Zotero.DB.executeTransaction(async () => {
					for (let item of selectedItems) {
						for (let collectionID of collectionIDs) {
							item.removeFromCollection(collectionID);
						}
						await item.save({
							skipDateModifiedUpdate: true
						});
					}
				});
			}
			else if (collectionTreeRow.isPublications()) {
				await Zotero.Items.removeFromPublications(selectedItems);
			}
		}
		finally {
			this.selection.selectEventsSuppressed = false;
		}
	}
	
	/**
	 * Get selected objects, including collections and searches in the trash
	 */
	getSelectedObjects() {
		var indexes = this.selection ? Array.from(this.selection.selected) : [];
		indexes = indexes.filter(index => index < this._rows.length);
		try {
			return indexes.map(index => this.getRow(index).ref);
		}
		catch (e) {
			Zotero.debug(indexes);
			throw e;
		}
	}
	
	/**
	 * Get selected items, omitting collections and searches in the trash
	 */
	getSelectedItems(asIDs) {
		var items = this.getSelectedObjects().filter(o => o instanceof Zotero.Item);
		return asIDs ? items.map(x => x.id) : items;
	}
	
	/**
	 * Returns an array of items of visible items in current sort order
	 *
	 * @param {Boolean} asIDs - Return itemIDs
	 * @return {Zotero.Item[]|Integer[]} - An array of Zotero.Item objects or itemIDs
	 */
	getSortedItems(asIDs) {
		return this._rows.map(row => asIDs ? row.ref.id : row.ref);
	}

	/**
	 * Get the current sort order of the items list
	 *
	 * @return {Number} - -1 for descending, 1 for ascending
	 */
	getSortDirection(sortFields) {
		sortFields = sortFields || this.getSortFields();
		if (this.collectionTreeRow.isFeedsOrFeed()) {
			return Zotero.Prefs.get('feeds.sortAscending') ? 1 : -1;
		}
		const columns = this._getColumns();
		for (const field of sortFields) {
			const col = columns.find(c => c.dataKey == field);
			if (col) {
				return col.sortDirection || 1;
			}
		}
		return 1;
	}

	getSortField() {
		if (this.collectionTreeRow.isFeedsOrFeed()) {
			return 'id';
		}
		var column = this._sortedColumn;
		if (!column) {
			column = this._getColumns().find(col => !col.hidden);
		}
		// zotero-items-column-_________
		return column.dataKey;
	}


	getSortFields() {
		var fields = [this.getSortField()];
		var secondaryField = this._getSecondarySortField();
		if (secondaryField) {
			fields.push(secondaryField);
		}
		try {
			var fallbackFields = Zotero.Prefs.get('fallbackSort')
				.split(',')
				.map((x) => x.trim())
				.filter((x) => x !== '');
		}
		catch (e) {
			Zotero.debug(e, 1);
			Zotero.logError(e);
			// This should match the default value for the fallbackSort pref
			var fallbackFields = ['firstCreator', 'date', 'title', 'dateAdded'];
		}
		fields = Zotero.Utilities.arrayUnique(fields.concat(fallbackFields));

		// If date appears after year, remove it, unless it's the explicit secondary sort
		var yearPos = fields.indexOf('year');
		if (yearPos != -1) {
			let datePos = fields.indexOf('date');
			if (datePos > yearPos && secondaryField != 'date') {
				fields.splice(datePos, 1);
			}
		}

		return fields;
	}

	/**
	 * @param index {Integer}
	 * @param selectAll {Boolean} Whether the selection is part of a select-all event
	 * @returns {Boolean}
	 */
	isSelectable = (index, selectAll=false) => {
		if (!selectAll || !this._searchMode || this.collectionTreeRow.isPublications()) return true;

		let row = this.getRow(index);
		if (!row) {
			return false;
		}
		if (this.collectionTreeRow.isTrash()) {
			return row.ref.deleted;
		}
		else {
			return this._searchItemIDs.has(row.id);
		}
	};
	
	isContainer = (index) => {
		return this.getRow(index).ref.isRegularItem();
	};

	isContainerOpen = (index) => {
		return this.getRow(index).isOpen;
	};

	isContainerEmpty = (index) => {
		if (this.regularOnly) {
			return true;
		}

		var item = this.getRow(index).ref;
		if (!item.isRegularItem()) {
			return true;
		}
		var includeTrashed = this.collectionTreeRow.isTrash();
		return item.numNotes(includeTrashed) === 0 && item.numAttachments(includeTrashed) == 0;
	};

	////////////////////////////////////////////////////////////////////////////////
	///
	///  Drag-and-drop methods
	///
	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Start a drag using HTML 5 Drag and Drop
	 */
	onDragStart = (event, index) => {
		// Propagate selection before we set the drag image if dragging not one of the selected rows
		if (!this.selection.isSelected(index)) {
			this.selection.select(index);
		}
		// Set drag image
		const dragElems = this.domEl.querySelectorAll('.selected');
		for (let elem of dragElems) {
			elem = elem.cloneNode(true);
			elem.style.position = "initial";
			this._dragImageContainer.appendChild(elem);
		}

		let itemIDs = this.getSelectedItems(true);
		// Get selected item IDs in the item tree order
		itemIDs = this.getSortedItems(true).filter(id => itemIDs.includes(id));

		Zotero.DragDrop.currentDragSource = this.collectionTreeRow;

		Zotero.Utilities.Internal.onDragItems(event, itemIDs, this._dragImageContainer);
	};

	/**
	 * We use this to set the drag action, which is used by view.canDrop(),
	 * based on the view's canDropCheck() and modifier keys.
	 */
	onDragOver = (event, row) => {
		try {
			event.preventDefault();
			event.stopPropagation();
			var previousOrientation = Zotero.DragDrop.currentOrientation;
			Zotero.DragDrop.currentOrientation = getDragTargetOrient(event);
			Zotero.debug(`Dragging over item ${row} with ${Zotero.DragDrop.currentOrientation}, drop row: ${this._dropRow}`);

			var target = event.currentTarget;
			if (target.classList.contains('items-tree-message')) {
				let doc = target.ownerDocument;
				// Consider a drop on the items pane message box (e.g., when showing the welcome text)
				// a drop on the items tree
				if (target.firstChild.dataset.allowdrop) {
					target = doc.querySelector('#zotero-items-tree treechildren');
				}
				else {
					this.setDropEffect(event, "none");
					return false;
				}
			}

			if (!this.canDropCheck(row, Zotero.DragDrop.currentOrientation, event.dataTransfer)) {
				this.setDropEffect(event, "none");
				return false;
			}

			if (event.dataTransfer.getData("zotero/item")) {
				var sourceCollectionTreeRow = Zotero.DragDrop.getDragSource();
				if (sourceCollectionTreeRow) {
					var targetCollectionTreeRow = this.collectionTreeRow;

					if (!targetCollectionTreeRow) {
						this.setDropEffect(event, "none");
						return false;
					}

					if (sourceCollectionTreeRow.id == targetCollectionTreeRow.id) {
						// If dragging from the same source, do a move
						this.setDropEffect(event, "move");
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
		}
		finally {
			let prevDropRow = this._dropRow;
			if (event.dataTransfer.dropEffect != 'none') {
				this._dropRow = row;
			} else {
				this._dropRow = null;
			}
			if (prevDropRow != this._dropRow || previousOrientation != Zotero.DragDrop.currentOrientation) {
				typeof prevDropRow == 'number' && this.tree.invalidateRow(prevDropRow);
				this.tree.invalidateRow(row);
			}
		}
	};

	onDragEnd = () => {
		this._dragImageContainer.innerHTML = "";
		this._dropRow = null;
		this.tree.invalidate();
	};

	onDragLeave = () => {
		let dropRow = this._dropRow;
		this._dropRow = null;
		this.tree.invalidateRow(dropRow);
	};

	/**
	 * Called by treeRow.onDragOver() before setting the dropEffect
	 */
	canDropCheck = (row, orient, dataTransfer) => {
		//Zotero.debug("Row is " + row + "; orient is " + orient);

		var dragData = Zotero.DragDrop.getDataFromDataTransfer(dataTransfer);
		if (!dragData) {
			Zotero.debug("No drag data");
			return false;
		}
		var dataType = dragData.dataType;
		var data = dragData.data;

		var collectionTreeRow = this.collectionTreeRow;

		if (row != -1 && orient == 0) {
			var rowItem = this.getRow(row).ref; // the item we are dragging over
			// Cannot drop anything on attachments/notes
			if (!rowItem.isRegularItem()) {
				return false;
			}
		}

		if (dataType == 'zotero/item') {
			let items = Zotero.Items.get(data);

			// Directly on a row
			if (rowItem) {
				var canDrop = false;

				for (let item of items) {
					// If any regular items, disallow drop
					if (item.isRegularItem()) {
						return false;
					}

					// Disallow cross-library child drag
					if (item.libraryID != collectionTreeRow.ref.libraryID) {
						return false;
					}

					// Only allow dragging of notes and attachments
					// that aren't already children of the item
					if (item.parentItemID != rowItem.id) {
						canDrop = true;
					}
				}
				return canDrop;
			}

			// In library, allow children to be dragged out of parent
			else if (collectionTreeRow.isLibrary(true) || collectionTreeRow.isCollection()) {
				for (let item of items) {
					// Don't allow drag if any top-level items
					if (item.isTopLevelItem()) {
						return false;
					}

					// Don't allow web attachments to be dragged out of parents,
					// but do allow PDFs for now so they can be recognized
					if (item.isWebAttachment() && item.attachmentContentType != 'application/pdf') {
						return false;
					}

					// Don't allow children to be dragged within their own parents
					var parentItemID = item.parentItemID;
					var parentIndex = this._rowMap[parentItemID];
					if (row != -1 && this.getLevel(row) > 0) {
						if (this.getRow(this.getParentIndex(row)).ref.id == parentItemID) {
							return false;
						}
					}
					// Including immediately after the parent
					if (orient == 1) {
						if (row == parentIndex) {
							return false;
						}
					}
					// And immediately before the next parent
					if (orient == -1) {
						var nextParentIndex = null;
						for (var i = parentIndex + 1; i < this.rowCount; i++) {
							if (this.getLevel(i) == 0) {
								nextParentIndex = i;
								break;
							}
						}
						if (row === nextParentIndex) {
							return false;
						}
					}

					// Disallow cross-library child drag
					if (item.libraryID != collectionTreeRow.ref.libraryID) {
						return false;
					}
				}
				return true;
			}
			return false;
		}
		else if (dataType == "text/x-moz-url" || dataType == 'application/x-moz-file') {
			// Disallow direct drop on a non-regular item (e.g. note)
			if (rowItem) {
				if (!rowItem.isRegularItem()) {
					return false;
				}
			}
			// Don't allow drop into searches or publications
			else if (collectionTreeRow.isSearch() || collectionTreeRow.isPublications()) {
				return false;
			}

			return true;
		}

		return false;
	};

	/*
	 *  Called when something's been dropped on or next to a row
	 */
	onDrop = async (event, row) => {
		const dataTransfer = event.dataTransfer;
		var orient = Zotero.DragDrop.currentOrientation;
		if (row == -1) {
			row = 0;
			orient = -1;
		}
		this._dropRow = null;
		Zotero.DragDrop.currentDragSource = null;
		if (!dataTransfer.dropEffect || dataTransfer.dropEffect == "none") {
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
		var sourceCollectionTreeRow = Zotero.DragDrop.getDragSource(dataTransfer);
		var collectionTreeRow = this.collectionTreeRow;
		var targetLibraryID = collectionTreeRow.ref.libraryID;

		if (dataType == 'zotero/item') {
			var ids = data;
			var items = Zotero.Items.get(ids);
			if (items.length < 1) {
				return;
			}

			// TEMP: This is always false for now, since cross-library drag
			// is disallowed in canDropCheck()
			//
			// TODO: support items coming from different sources?
			if (items[0].libraryID == targetLibraryID) {
				var sameLibrary = true;
			}
			else {
				var sameLibrary = false;
			}

			var toMove = [];

			// Dropped directly on a row
			if (orient == 0) {
				// Set drop target as the parent item for dragged items
				//
				// canDrop() limits this to child items
				var rowItem = this.getRow(row).ref; // the item we are dragging over
				await Zotero.DB.executeTransaction(async function () {
					for (let i=0; i<items.length; i++) {
						let item = items[i];
						item.parentID = rowItem.id;
						await item.save();
					}
				});
			}

			// Dropped outside of a row
			else
			{
				// Remove from parent and make top-level
				if (collectionTreeRow.isLibrary(true)) {
					await Zotero.DB.executeTransaction(async function () {
						for (let i=0; i<items.length; i++) {
							let item = items[i];
							if (!item.isRegularItem()) {
								item.parentID = false;
								await item.save()
							}
						}
					});
				}
				// Add to collection
				else
				{
					await Zotero.DB.executeTransaction(async function () {
						for (let i=0; i<items.length; i++) {
							let item = items[i];
							var source = item.isRegularItem() ? false : item.parentItemID;
							// Top-level item
							if (source) {
								item.parentID = false;
								item.addToCollection(collectionTreeRow.ref.id);
								await item.save();
							}
							else {
								item.addToCollection(collectionTreeRow.ref.id);
								await item.save();
							}
							toMove.push(item.id);
						}
					});
				}
			}
		}
		else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
			// Disallow drop into read-only libraries
			if (!collectionTreeRow.editable) {
				window.ZoteroPane.displayCannotEditLibraryMessage();
				return;
			}
			
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
			
			var targetLibraryID = collectionTreeRow.ref.libraryID;

			var parentItemID = false;
			var parentCollectionID = false;

			if (orient == 0) {
				let treerow = this.getRow(row);
				parentItemID = treerow.ref.id;
			}
			else if (collectionTreeRow.isCollection()) {
				var parentCollectionID = collectionTreeRow.ref.id;
			}

			let addedItems = [];
			var notifierQueue = new Zotero.Notifier.Queue;
			try {
				// If there's a single file being added to a parent, automatic renaming is enabled,
				// and there are no other non-HTML attachments, we'll rename the file as long as it's
				// an allowed type. The dragged data could be a URL, so we don't yet know the file type.
				// This should be kept in sync with ZoteroPane.addAttachmentFromDialog().
				let renameIfAllowedType = false;
				let parentItem;
				if (parentItemID
					&& data.length == 1
					&& Zotero.Attachments.shouldAutoRenameFile(dropEffect == 'link')) {
					parentItem = Zotero.Items.get(parentItemID);
					if (!parentItem.numNonHTMLFileAttachments()) {
						renameIfAllowedType = true;
					}
				}

				for (var i=0; i<data.length; i++) {
					var file = data[i];

					if (dataType == 'text/x-moz-url') {
						var url = data[i];

						// Still string, so remote URL
						if (typeof file == 'string') {
							let item;
							if (parentItemID) {
								if (!collectionTreeRow.filesEditable) {
									window.ZoteroPane.displayCannotEditLibraryFilesMessage();
									return;
								}
								item = await Zotero.Attachments.importFromURL({
									libraryID: targetLibraryID,
									url,
									renameIfAllowedType,
									parentItemID,
									saveOptions: {
										notifierQueue
									}
								});
							}
							else {
								item = await window.ZoteroPane.addItemFromURL(url, 'temporaryPDFHack'); // TODO: don't do this
							}
							if (item) {
								addedItems.push(item);
							}
							continue;
						}

						// Otherwise file, so fall through
					}

					file = file.path;

					// Rename file if it's an allowed type
					let fileBaseName = false;
					if (renameIfAllowedType) {
						fileBaseName = await Zotero.Attachments.getRenamedFileBaseNameIfAllowedType(
							parentItem, file
						);
					}

					let item;
					if (dropEffect == 'link') {
						// Rename linked file, with unique suffix if necessary
						try {
							if (fileBaseName) {
								let ext = Zotero.File.getExtension(file);
								let newName = await Zotero.File.rename(
									file,
									fileBaseName + (ext ? '.' + ext : ''),
									{
										unique: true
									}
								);
								// Update path in case the name was changed to be unique
								file = PathUtils.join(PathUtils.parent(file), newName);
							}
						}
						catch (e) {
							Zotero.logError(e);
						}

						item = await Zotero.Attachments.linkFromFile({
							file,
							parentItemID,
							collections: parentCollectionID ? [parentCollectionID] : undefined,
							saveOptions: {
								notifierQueue
							}
						});
					}
					else {
						if (file.endsWith(".lnk")) {
							window.ZoteroPane.displayCannotAddShortcutMessage(file);
							continue;
						}

						item = await Zotero.Attachments.importFromFile({
							file,
							fileBaseName,
							libraryID: targetLibraryID,
							parentItemID,
							collections: parentCollectionID ? [parentCollectionID] : undefined,
							saveOptions: {
								notifierQueue
							}
						});
						// If moving, delete original file
						if (dropEffect == 'move') {
							try {
								await OS.File.remove(file);
							}
							catch (e) {
								Zotero.logError("Error deleting original file " + file + " after drag");
							}
						}
					}

					if (item) {
						addedItems.push(item);
					}
				}
			}
			finally {
				await Zotero.Notifier.commit(notifierQueue);
			}

			// Automatically retrieve metadata for PDFs and ebooks
			if (!parentItemID) {
				Zotero.RecognizeDocument.autoRecognizeItems(addedItems);
			}
		}
	};

	// //////////////////////////////////////////////////////////////////////////////
	//
	//  Menu utilities for ZoteroPane
	//
	// //////////////////////////////////////////////////////////////////////////////

	buildColumnPickerMenu(menupopup) {
		const prefix = 'zotero-column-picker-';
		// Filter out ignored columns
		const columns = this._getColumns();
		let columnMenuitemElements = {};
		for (let i = 0; i < columns.length; i++) {
			const column = columns[i];
			if (column.showInColumnPicker === false) continue;
			let label = formatColumnName(column);
			let menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('type', 'checkbox');
			menuitem.setAttribute('label', label);
			menuitem.setAttribute('colindex', i);
			menuitem.addEventListener('command', () => this.tree._columns.toggleHidden(i));
			if (!column.hidden) {
				menuitem.setAttribute('checked', true);
			}
			if (column.disabledIn && column.disabledIn.includes(this.collectionTreeRow.visibilityGroup)) {
				menuitem.setAttribute('disabled', true);
			}
			columnMenuitemElements[column.dataKey] = menuitem;
			menupopup.appendChild(menuitem);
		}

		try {
			// More Columns menu
			let id = prefix + 'more-menu';

			let moreMenu = document.createXULElement('menu');
			moreMenu.setAttribute('label', Zotero.getString('pane.items.columnChooser.moreColumns'));
			moreMenu.setAttribute('anonid', id);

			let moreMenuPopup = document.createXULElement('menupopup');
			moreMenuPopup.setAttribute('anonid', id + '-popup');

			let moreItems = [];
			for (let i = 0; i < columns.length; i++) {
				const column = columns[i];
				if (column.columnPickerSubMenu) {
					moreItems.push(columnMenuitemElements[column.dataKey]);
				}
			}

			// Sort fields and move to submenu
			var collation = Zotero.getLocaleCollation();
			moreItems.sort(function (a, b) {
				return collation.compareString(1, a.getAttribute('label'), b.getAttribute('label'));
			});
			moreItems.forEach(function (elem) {
				moreMenuPopup.appendChild(menupopup.removeChild(elem));
			});

			let sep = document.createXULElement('menuseparator');
			menupopup.appendChild(sep);
			moreMenu.appendChild(moreMenuPopup);
			menupopup.appendChild(moreMenu);
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug(e, 1);
		}

		//
		// Secondary Sort menu
		//
		if (!this.collectionTreeRow.isFeedsOrFeed()) {
			try {
				const id = prefix + 'sort-menu';
				const primaryField = this.getSortField();
				const sortFields = this.getSortFields();
				let secondaryField = false;
				if (sortFields[1]) {
					secondaryField = sortFields[1];
				}

				const primaryFieldLabel = formatColumnName(columns.find(c => c.dataKey == primaryField));

				const sortMenu = document.createXULElement('menu');
				sortMenu.setAttribute('label',
					Zotero.getString('pane.items.columnChooser.secondarySort', primaryFieldLabel));
				sortMenu.setAttribute('anonid', id);

				const sortMenuPopup = document.createXULElement('menupopup');
				sortMenuPopup.setAttribute('anonid', id + '-popup');

				// Generate menuitems
				const sortOptions = [
					'title',
					'firstCreator',
					'itemType',
					'date',
					'year',
					'publisher',
					'publicationTitle',
					'dateAdded',
					'dateModified'
				];
				for (let field of sortOptions) {
					// Hide current primary field, and don't show Year for Date, since it would be a no-op
					if (field == primaryField || (primaryField == 'date' && field == 'year')) {
						continue;
					}
					let column = columns.find(c => c.dataKey == field);
					let label = formatColumnName(column);

					let sortMenuItem = document.createXULElement('menuitem');
					sortMenuItem.setAttribute('fieldName', field);
					sortMenuItem.setAttribute('label', label);
					sortMenuItem.setAttribute('type', 'checkbox');
					if (field == secondaryField) {
						sortMenuItem.setAttribute('checked', 'true');
					}
					sortMenuItem.addEventListener('command', async () => {
						if (this._setSecondarySortField(field)) {
							await this.sort();
						}
					})
					sortMenuPopup.appendChild(sortMenuItem);
				}

				sortMenu.appendChild(sortMenuPopup);
				menupopup.appendChild(sortMenu);
			}
			catch (e) {
				Zotero.logError(e);
				Zotero.debug(e, 1);
			}
		}

		let sep = document.createXULElement('menuseparator');
		// sep.setAttribute('anonid', prefix + 'sep');
		menupopup.appendChild(sep);

		//
		// Restore Default Column Order
		//
		let menuitem = document.createXULElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('zotero.items.restoreColumnOrder.label'));
		menuitem.setAttribute('anonid', prefix + 'restore-order');
		menuitem.addEventListener('command', () => this.tree._columns.restoreDefaultOrder());
		menupopup.appendChild(menuitem);
	}

	buildSortMenu(menupopup) {
		this._getColumns()
			.filter(column => !column.hidden)
			.forEach((column, i) => {
				let menuItem = document.createXULElement('menuitem');
				menuItem.setAttribute('type', 'checkbox');
				menuItem.setAttribute('checked', this.getSortField() == column.dataKey);
				menuItem.setAttribute('label', formatColumnName(column));
				menuItem.addEventListener('command', () => {
					this.toggleSort(i, true);
				});
				menupopup.append(menuItem);
			});
	}

	toggleSort(sortIndex, countVisible = false) {
		if (countVisible) {
			let cols = this._getColumns();
			sortIndex = cols.indexOf(cols.filter(col => !col.hidden)[sortIndex]);
			if (sortIndex == -1) {
				return;
			}
		}
		this.tree._columns.toggleSort(sortIndex);
	}


	// //////////////////////////////////////////////////////////////////////////////
	//
	//  Private methods
	//
	// //////////////////////////////////////////////////////////////////////////////

	_titleMarkup = {
		'<i>': {
			beginsTag: 'i',
			inverseStyle: { fontStyle: 'normal' }
		},
		'</i>': {
			endsTag: 'i'
		},
		'<b>': {
			beginsTag: 'b',
			inverseStyle: { fontWeight: 'normal' }
		},
		'</b>': {
			endsTag: 'b'
		},
		'<sub>': {
			beginsTag: 'sub'
		},
		'</sub>': {
			endsTag: 'sub'
		},
		'<sup>': {
			beginsTag: 'sup'
		},
		'</sup>': {
			endsTag: 'sup'
		},
		'<span style="font-variant:small-caps;">': {
			beginsTag: 'span',
			style: { fontVariant: 'small-caps' }
		},
		'<span class="nocase">': {
			// No effect in item tree
			beginsTag: 'span'
		},
		'</span>': {
			endsTag: 'span'
		}
	};

	_renderItemTitle(title, targetNode) {
		let markupStack = [];
		let nodeStack = [targetNode];
		let textContent = '';

		for (let token of title.split(/(<[^>]+>)/)) {
			if (this._titleMarkup.hasOwnProperty(token)) {
				let markup = this._titleMarkup[token];
				if (markup.beginsTag) {
					let node = document.createElement(markup.beginsTag);
					if (markup.style) {
						Object.assign(node.style, markup.style);
					}
					if (markup.inverseStyle && markupStack.some(otherMarkup => otherMarkup.beginsTag === markup.beginsTag)) {
						Object.assign(node.style, markup.inverseStyle);
					}
					markupStack.push({ ...markup, token });
					nodeStack.push(node);
					continue;
				}
				else if (markup.endsTag && markupStack.some(otherMarkup => otherMarkup.beginsTag === markup.endsTag)) {
					while (markupStack.length) {
						let discardedMarkup = markupStack.pop();
						let discardedNode = nodeStack.pop();
						if (discardedMarkup.beginsTag === markup.endsTag) {
							nodeStack[nodeStack.length - 1].append(discardedNode);
							break;
						}
						else {
							nodeStack[nodeStack.length - 1].append(discardedMarkup.token, ...discardedNode.childNodes);
						}
					}

					continue;
				}
			}

			nodeStack[nodeStack.length - 1].append(token);
			textContent += token;
		}

		while (markupStack.length) {
			let discardedMarkup = markupStack.pop();
			let discardedNode = nodeStack.pop();
			nodeStack[0].append(discardedMarkup.token, ...discardedNode.childNodes);
		}

		return textContent;
	}

	_renderPrimaryCell(index, data, column) {
		let span = document.createElement('span');
		span.className = `cell ${column.className}`;
		span.classList.add('primary');

		const item = this.getRow(index).ref;
		let retracted = "";
		let retractedAriaLabel = "";
		if (Zotero.Retractions.isRetracted(item)) {
			retracted = getCSSIcon("IconCross");
			retracted.classList.add("retracted");
			retractedAriaLabel = Zotero.getString('retraction.banner');
		}

		let tagAriaLabel = '';
		let tagSpans = [];
		let coloredTags = item.getItemsListTags();
		if (coloredTags.length) {
			let { emoji, colored } = coloredTags.reduce((acc, tag) => {
				acc[Zotero.Utilities.Internal.containsEmoji(tag.tag) ? 'emoji' : 'colored'].push(tag);
				return acc;
			}, { emoji: [], colored: [] });
			
			// Add colored tags first
			if (colored.length) {
				let coloredTagSpans = colored.map(x => this._getTagSwatch(x.tag, x.color));
				let coloredTagSpanWrapper = document.createElement('span');
				coloredTagSpanWrapper.className = 'colored-tag-swatches';
				coloredTagSpanWrapper.append(...coloredTagSpans);
				tagSpans.push(coloredTagSpanWrapper);
			}
			
			// Add emoji tags after
			tagSpans.push(...emoji.map(x => this._getTagSwatch(x.tag)));

			tagAriaLabel = coloredTags.length == 1 ? Zotero.getString('searchConditions.tag') : Zotero.getString('itemFields.tags');
			tagAriaLabel += ' ' + coloredTags.map(x => x.tag).join(', ') + '.';
		}

		let itemTypeAriaLabel;
		try {
			// Special treatment for trashed collections or searches since they are not an actual
			// item and do not have an item type
			if (item instanceof Zotero.Collection) {
				itemTypeAriaLabel = Zotero.getString('searchConditions.collection') + '.';
			}
			else if (item instanceof Zotero.Search) {
				itemTypeAriaLabel = Zotero.getString('searchConditions.savedSearch') + '.';
			}
			else {
				var itemType = Zotero.ItemTypes.getName(item.itemTypeID);
				itemTypeAriaLabel = Zotero.getString(`itemTypes.${itemType}`) + '.';
			}
		}
		catch (e) {
			Zotero.debug('Error attempting to get a localized item type label for ' + itemType, 1);
			Zotero.debug(e, 1);
		}
		
		let textSpan = document.createElement('span');
		let textWithFullStop = this._renderItemTitle(data, textSpan);
		if (!textWithFullStop.match(/\.$/)) {
			textWithFullStop += '.';
		}
		let textSpanAriaLabel = [textWithFullStop, itemTypeAriaLabel, tagAriaLabel, retractedAriaLabel].join(' ');
		textSpan.className = "cell-text";
		textSpan.dir = 'auto';
		textSpan.setAttribute('aria-label', textSpanAriaLabel);

		if (Zotero.Prefs.get('ui.tagsAfterTitle')) {
			span.append(retracted, textSpan, ...tagSpans);
		}
		else {
			span.append(retracted, ...tagSpans, textSpan);
		}

		return span;
	}

	_renderHasAttachmentCell(index, data, column) {
		let span = document.createElement('span');
		span.className = `cell ${column.className}`;

		if (this.collectionTreeRow.isTrash()) return span;

		const item = this.getRow(index).ref;

		if ((!this.isContainer(index) || !this.isContainerOpen(index))
			&& Zotero.Sync.Storage.getItemDownloadImageNumber(item)) {
			return span;
		}

		// TEMP: For now, we use the blue bullet for all non-PDF attachments, but there's
		// commented-out code for showing different icons for snapshots, files, and URL/DOI links
		if (this._canGetBestAttachmentState(item)) {
			const { type, exists } = item.getBestAttachmentStateCached();
			let icon = "";
			let ariaLabel;
			// If the item has a child attachment
			if (type !== null && type != 'none') {
				if (type == 'pdf') {
					icon = getCSSItemTypeIcon('attachmentPDF', 'attachment-type');
					ariaLabel = Zotero.getString('pane.item.attachments.hasPDF');
				}
				else if (type == 'snapshot') {
					icon = getCSSItemTypeIcon('attachmentSnapshot', 'attachment-type');
					ariaLabel = Zotero.getString('pane.item.attachments.hasSnapshot');
				}
				else if (type == 'epub') {
					icon = getCSSItemTypeIcon('attachmentEPUB', 'attachment-type');
					ariaLabel = Zotero.getString('pane.item.attachments.hasEPUB');
				}
				else if (type == 'image') {
					icon = getCSSItemTypeIcon('attachmentImage', 'attachment-type');
					ariaLabel = Zotero.getString('pane.item.attachments.hasImage');
				}
				else if (type == 'video') {
					icon = getCSSItemTypeIcon('attachmentVideo', 'attachment-type');
					ariaLabel = Zotero.getString('pane.item.attachments.hasVideo');
				}
				else {
					icon = getCSSItemTypeIcon('attachmentFile', 'attachment-type');
					ariaLabel = Zotero.getString('pane.item.attachments.has');
				}
				
				if (!exists) {
					icon.classList.add('icon-missing-file');
				}
			}
			//else if (type == 'none') {
			//	if (item.getField('url') || item.getField('DOI')) {
			//		icon = getCSSIcon('IconLink');
			//		ariaLabel = Zotero.getString('pane.item.attachments.hasLink');
			//		icon.classList.add('cell-icon');
			//	}
			//}
			if (ariaLabel) {
				icon.setAttribute('aria-label', ariaLabel + '.');
				span.setAttribute('title', ariaLabel);
			}
			span.append(icon);

			// Don't run this immediately since it might cause a db check and disk access
			// but delay for some time and see if the item is still visible in the tree
			// (i.e. if we haven't scrolled right past it)
			setTimeout(() => {
				if (!this.tree.rowIsVisible(index)) return;
				item.getBestAttachmentState()
					// Refresh cell when promise is fulfilled
					.then(({ type: newType, exists: newExists }) => {
						if (newType !== type || newExists !== exists) {
							this.tree.invalidateRow(index);
						}
					});
			}, ATTACHMENT_STATE_LOAD_DELAY);
		}

		return span;
	}

	_renderCell(index, data, column, isFirstColumn) {
		let cell;
		if (column.primary) {
			cell = this._renderPrimaryCell(index, data, column);
		}
		else if (column.dataKey === 'hasAttachment') {
			cell = this._renderHasAttachmentCell(index, data, column);
		}
		else if (column.renderCell) {
			try {
				cell = column.renderCell.apply(this, arguments);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		else {
			cell = renderCell.apply(this, arguments);
			if (column.dataKey === 'numNotes' && data) {
				cell.dataset.l10nId = 'items-table-cell-notes';
				cell.dataset.l10nArgs = JSON.stringify({ count: data });
			}
			else if (column.dataKey === 'itemType') {
				cell.setAttribute('aria-hidden', true);
			}
		}

		if (column.noPadding) {
			cell.classList.add('no-padding');
		}

		if (isFirstColumn) {
			// Add depth indent, twisty and icon
			const depth = this.getLevel(index);
			let indentSpan = document.createElement('span');
			indentSpan.className = "cell-indent";
			indentSpan.style.paddingInlineStart = (CHILD_INDENT * depth) + 'px';

			let twisty;
			if (this.isContainerEmpty(index)) {
				twisty = document.createElement('span');
				twisty.classList.add("spacer-twisty");
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
				twisty.addEventListener('dblclick', event => event.stopImmediatePropagation(),
					{ passive: true });
			}

			const icon = this._getIcon(index);
			icon.classList.add('cell-icon');

			if (cell.querySelector('.cell-text') === null) {
				// convert text-only cell to a cell with text and icon
				let textSpan = document.createElement('span');
				textSpan.className = "cell-text";
				textSpan.innerHTML = cell.innerHTML;
				cell.innerHTML = "";
				cell.append(textSpan);
			}

			cell.prepend(indentSpan, twisty, icon);
			cell.classList.add('first-column');
		}
		return cell;
	}

	_renderItem(index, selection, oldDiv=null, columns) {
		let div;
		if (oldDiv) {
			div = oldDiv;
			div.innerHTML = "";
		}
		else {
			div = document.createElement('div');
			div.className = "row";
		}

		div.classList.toggle('selected', selection.isSelected(index));
		div.classList.toggle('first-selected', selection.isFirstRowOfSelectionBlock(index));
		div.classList.toggle('last-selected', selection.isLastRowOfSelectionBlock(index));
		div.classList.toggle('focused', selection.focused == index);
		div.classList.remove('drop', 'drop-before', 'drop-after');
		const rowData = this._getRowData(index);
		div.classList.toggle('context-row', !!rowData.contextRow);
		div.classList.toggle('unread', !!rowData.unread);
		if (this._dropRow == index) {
			let span;
			if (Zotero.DragDrop.currentOrientation != 0) {
				span = document.createElement('span');
				span.className = Zotero.DragDrop.currentOrientation < 0 ? "drop-before" : "drop-after";
				div.appendChild(span);
			} else {
				div.classList.add('drop');
			}
		}

		let { firstColumn } = columns.reduce((acc, column) => {
			return !column.hidden && column.ordinal < acc.lowestOrdinal
				? { lowestOrdinal: column.ordinal, firstColumn: column }
				: acc;
		}, { lowestOrdinal: Infinity, firstColumn: null });

		for (let column of columns) {
			if (column.hidden) continue;
			div.appendChild(this._renderCell(index, rowData[column.dataKey], column, column === firstColumn));
		}

		if (!oldDiv) {
			// No drag-drop for collections or searches in the trash
			if (this.props.dragAndDrop && rowData.isItem) {
				div.setAttribute('draggable', true);
				div.addEventListener('dragstart', e => this.onDragStart(e, index), { passive: true });
				div.addEventListener('dragover', e => this.onDragOver(e, index));
				div.addEventListener('dragend', this.onDragEnd, { passive: true });
				div.addEventListener('dragleave', this.onDragLeave, { passive: true });
				div.addEventListener('drop', (e) => {
					e.stopPropagation();
					this.onDrop(e, index);
				}, { passive: true });
			}
			div.addEventListener('mousedown', this._handleRowMouseUpDown, { passive: true });
			div.addEventListener('mouseup', this._handleRowMouseUpDown, { passive: true });
		}

		// Accessibility
		div.setAttribute('role', 'treeitem');
		div.setAttribute('aria-level', this.getLevel(index) + 1);
		if (!this.isContainerEmpty(index)) {
			div.setAttribute('aria-expanded', this.isContainerOpen(index));
		}
		if (rowData.contextRow) {
			div.setAttribute('aria-disabled', true);
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
	};
	
	_handleRowMouseUpDown = (event) => {
		const modifierIsPressed = ['ctrlKey', 'metaKey', 'shiftKey', 'altKey'].some(key => event[key]);
		if (this.collectionTreeRow.isDuplicates() && !modifierIsPressed) {
			this.duplicateMouseSelection = true;
		}
	}

	_handleSelectionChange = (selection, shouldDebounce) => {
		if (this.collectionTreeRow.isDuplicates() && selection.count == 1 && this.duplicateMouseSelection) {
			var itemID = this.getRow(selection.focused).ref.id;
			var setItemIDs = this.collectionTreeRow.ref.getSetItemsByItemID(itemID);
			
			// We are modifying the selection object directly here
			// which won't trigger item updates
			for (let id of setItemIDs) {
				selection.selected.add(this._rowMap[id]);
				this.tree.invalidateRow(this._rowMap[id]);
			}
		}
		this.duplicateMouseSelection = false;
		if (shouldDebounce) {
			this._onSelectionChangeDebounced();
		}
		else {
			this._onSelectionChange();
		}
	}

	async _closeContainer(index, skipRowMapRefresh, dontEnsureRowsVisible=false) {
		// isContainer == false shouldn't happen but does if an item is dragged over a closed
		// container until it opens and then released, since the container is no longer in the same
		// place when the spring-load closes
		if (!this.isContainer(index)) return;
		if (!this.isContainerOpen(index)) return;

		if (!skipRowMapRefresh) {
			var savedSelection = this.getSelectedObjects();
		}

		var count = 0;
		var level = this.getLevel(index);

		// Remove child rows
		while ((index + 1 < this._rows.length) && (this.getLevel(index + 1) > level)) {
			// Skip the map update here and just refresh the whole map below,
			// since we might be removing multiple rows
			this._removeRow(index + 1, true);
			count++;
		}

		this._rows[index].isOpen = false;

		if (count == 0) {
			return;
		}

		if (!skipRowMapRefresh) {
			Zotero.debug('Refreshing item row map');
			this._refreshRowMap();
			
			await this._refreshPromise;
			this._restoreSelection(savedSelection, false, dontEnsureRowsVisible);
			this.tree.invalidate();
		}
	}

	/**
	 * Returns an object describing the row data for each column.
	 * The keys are column dataKey properties and the entries are the corresponding data.
	 * @param index {Integer} the row index
	 * @returns {Object}
	 */
	_getRowData = (index) => {
		var treeRow = this.getRow(index);
		if (!treeRow) {
			throw new Error(`Attempting to get row data for a non-existant tree row ${index}`);
		}
		var itemID = treeRow.id;
		
		// If value is available, retrieve synchronously
		if (this._rowCache[itemID]) {
			return this._rowCache[itemID];
		}
		
		let row = {
			// Not a collection or search in the trash
			isItem: treeRow.ref instanceof Zotero.Item
		};
		
		// Mark items not matching search as context rows, displayed in gray
		if (row.isItem && this._searchMode && !this._searchItemIDs.has(itemID)) {
			row.contextRow = true;
		}
		
		row.hasAttachment = "";
		// Don't show pie for open parent items, since we show it for the
		// child item
		if (!this.isContainer(index) || !this.isContainerOpen(index)) {
			var num = Zotero.Sync.Storage.getItemDownloadImageNumber(treeRow.ref);
			row.hasAttachment = num === false ? "pie" : "pie" + num;
		}
		
		// Style unread items in feeds
		if (treeRow.ref.isFeedItem && !treeRow.ref.isRead) {
			row.unread = true;
		}
		
		if (!(treeRow.ref instanceof Zotero.Collection || treeRow.ref instanceof Zotero.Search)) {
			row.itemType = Zotero.ItemTypes.getLocalizedString(treeRow.ref.itemTypeID);
		}
		// Year column is just date field truncated
		row.year = treeRow.getField('date', true).substr(0, 4);
		if (row.year) {
			// Don't show anything for unparsed year
			if (row.year === "0000") {
				row.year = "";
			}
			// Show pre-1000 year without leading zeros
			else if (row.year < 1000) {
				row.year = parseInt(row.year);
			}
		}
		row.numNotes = treeRow.numNotes() || "";
		row.feed = (treeRow.ref.isFeedItem && Zotero.Feeds.get(treeRow.ref.libraryID).name) || "";
		row.title = treeRow.ref.getDisplayTitle();
		
		const columns = this.getColumns();
		for (let col of columns) {
			let key = col.dataKey;
			let val = row[key];
			if (val === undefined) {
				val = treeRow.getField(key);
			}
			
			switch (key) {
			// Format dates as short dates in proper locale order and locale time
			// (e.g. "4/4/07 14:27:23")
			case 'dateAdded':
			case 'dateModified':
			case 'accessDate':
			case 'date':
				if (key == 'date' && !this.collectionTreeRow.isFeedsOrFeed()) {
					break;
				}
				if (val) {
					let date = Zotero.Date.sqlToDate(val, true);
					if (date) {
						// If no time, interpret as local, not UTC
						if (Zotero.Date.isSQLDate(val)) {
							date = Zotero.Date.sqlToDate(val);
							val = date.toLocaleDateString();
						}
						else {
							val = date.toLocaleString();
						}
					}
					else {
						val = '';
					}
				}
			}
			row[key] = val;
		}
		return this._rowCache[itemID] = row;
	}

	_getColumnPrefs = () => {
		if (!this.props.persistColumns) return {};
		return this._columnPrefs || {};
	}

	_storeColumnPrefs = (prefs) => {
		// Even if we don't persist column info we still need to store it on the itemTree instance
		// otherwise sorting and such breaks after dragging columns
		this._columns = this._columns.map(column => Object.assign(column, prefs[column.dataKey]))
			.sort((a, b) => a.ordinal - b.ordinal);
		
		if (!this.props.persistColumns) return;
		Zotero.debug(`Storing itemTree ${this.id} column prefs`, 2);
		this._columnPrefs = prefs;
		if (!this._columns) {
			Zotero.debug(new Error(), 1);
		}
		
		this._writeColumnPrefsToFile();
	}
	
	_getDefaultColumnOrder = () => {
		let columnOrder = {};
		this.getColumns().forEach((column, index) => columnOrder[column.dataKey] = index);
		return columnOrder;
	}
	
	_loadColumnPrefsFromFile = async () => {
		if (!this.props.persistColumns) return;
		try {
			let columnPrefs = await Zotero.File.getContentsAsync(COLUMN_PREFS_FILEPATH);
			let persistSettings = JSON.parse(columnPrefs);
			this._columnPrefs = persistSettings[this.id] || {};
		}
		catch (e) {
			this._columnPrefs = {};
		}
	}

	/**
	 * Writes column prefs to file, but is throttled to not do it more often than
	 * every 60s. Can use the force param to force write to file immediately.
	 * @param force {Boolean} force an immediate write to file without throttling
	 * @returns {Promise}
	 */
	_writeColumnPrefsToFile = async (force=false) => {
		if (!this.props.persistColumns) return;
		var writeToFile = async () => {
			try {
				let persistSettingsString = await Zotero.File.getContentsAsync(COLUMN_PREFS_FILEPATH);
				var persistSettings = JSON.parse(persistSettingsString);
			}
			catch {
				persistSettings = {};
			}
			persistSettings[this.id] = this._columnPrefs;

			let prefString = JSON.stringify(persistSettings);
			Zotero.debug(`Writing column prefs of length ${prefString.length} to file ${COLUMN_PREFS_FILEPATH}`);

			return Zotero.File.putContentsAsync(COLUMN_PREFS_FILEPATH, prefString);
		};
		if (this._writeColumnsTimeout) {
			clearTimeout(this._writeColumnsTimeout);
		}
		if (force) {
			return writeToFile();
		}
		else {
			this._writeColumnsTimeout = setTimeout(writeToFile, 60000);
		}
	};

	_setLegacyColumnSettings(column) {
		let persistSettings = JSON.parse(Zotero.Prefs.get('pane.persist') || "{}");
		const legacyDataKey = "zotero-items-column-" + column.dataKey;
		const legacyPersistSetting = persistSettings[legacyDataKey];
		if (legacyPersistSetting) {
			// Remove legacy pref
			delete persistSettings[legacyDataKey];
			for (const key in legacyPersistSetting) {
				if (typeof legacyPersistSetting[key] == "string") {
					if (key == 'sortDirection') {
						legacyPersistSetting[key] = legacyPersistSetting[key] == 'ascending' ? 1 : -1;
					}
					else {
						try {
							legacyPersistSetting[key] = JSON.parse(legacyPersistSetting[key]);
						} catch (e) {}
					}
				}
				if (key == 'ordinal') {
					legacyPersistSetting[key] /= 2;
				}
			}
			Zotero.Prefs.set('pane.persist', JSON.stringify(persistSettings));
		}
		return Object.assign({}, column, legacyPersistSetting || {});
	}

	_getColumns() {
		if (!this.collectionTreeRow) {
			return [];
		}
		
		const visibilityGroup = this.collectionTreeRow.visibilityGroup;
		const prefKey = this.id;
		if (this._columnsId == prefKey) {
			return this._columns;
		}
		
		this._columnsId = prefKey;
		this._columns = [];
		
		let columnsSettings = this._getColumnPrefs();

		// Refresh columns from itemTreeColumns
		const columns = this.getColumns();
		let hasDefaultIn = columns.some(column => 'defaultIn' in column);
		for (let column of columns) {
			if (this.props.persistColumns) {
				if (column.disabledIn && column.disabledIn.includes(visibilityGroup)) continue;;
				const columnSettings = columnsSettings[column.dataKey];
				if (!columnSettings && this.id === 'main') {
					column = this._setLegacyColumnSettings(column);
				}

				// Also includes a `hidden` pref and overrides the above if available
				column = Object.assign({}, column, columnSettings || {});

				if (column.sortDirection) {
					this._sortedColumn = column;
				}
				// If column does not have an "ordinal" field it means it
				// is newly added
				if (!("ordinal" in column)) {
					column.ordinal = columns.findIndex(c => c.dataKey == column.dataKey);
				}
			}
			else {
				column = Object.assign({}, column);
			}
			// Initial hidden value
			if (!("hidden" in column)) {
				if (hasDefaultIn) {
					column.hidden = !(column.defaultIn && column.defaultIn.includes(visibilityGroup));
				}
				else {
					column.hidden = false;
				}
			}
			this._columns.push(column);
		}

		return this._columns.sort((a, b) => a.ordinal - b.ordinal);
	}
	
	_getColumn(index) {
		return this._getColumns()[index];
	}

	_updateIntroText() {
		if (!window.ZoteroPane) {
			return;
		}

		if (this.collectionTreeRow && !this.rowCount) {
			let doc = this._ownerDocument;
			let div;

			// My Library and no groups
			if (this.collectionTreeRow.isLibrary() && !Zotero.Groups.getAll().length) {
				div = doc.createElement('div');
				let p = doc.createElement('p');
				let html = Zotero.getString(
					'pane.items.intro.text1',
					[
						Zotero.clientName
					]
				);
				// Encode special chars, which shouldn't exist
				html = Zotero.Utilities.htmlSpecialChars(html);
				html = `<b>${html}</b>`;
				p.innerHTML = html;
				div.appendChild(p);

				p = doc.createElement('p');
				html = Zotero.getString(
					'pane.items.intro.text2',
					[
						Zotero.getString('connector.name', Zotero.clientName),
						Zotero.clientName
					]
				);
				// Encode special chars, which shouldn't exist
				html = Zotero.Utilities.htmlSpecialChars(html);
				html = html.replace(
					/\[([^\]]+)](.+)\[([^\]]+)]/,
					`<span class="text-link" data-href="${window.ZOTERO_CONFIG.QUICK_START_URL}">$1</span>`
					+ '$2'
					+ `<span class="text-link" data-href="${window.ZOTERO_CONFIG.CONNECTORS_URL}">$3</span>`
				);
				p.innerHTML = html;
				div.appendChild(p);

				p = doc.createElement('p');
				html = Zotero.getString('pane.items.intro.text3', [Zotero.clientName]);
				// Encode special chars, which shouldn't exist
				html = Zotero.Utilities.htmlSpecialChars(html);
				html = html.replace(
					/\[([^\]]+)]/,
					'<span class="text-link" data-action="open-sync-prefs">$1</span>'
				);
				p.innerHTML = html;
				div.appendChild(p);

				// Activate text links
				for (let span of div.getElementsByTagName('span')) {
					if (span.classList.contains('text-link')) {
						span.setAttribute('role', 'link');
						if (span.hasAttribute('data-href')) {
							span.onclick = function () {
								doc.defaultView.ZoteroPane.loadURI(this.getAttribute('data-href'));
							};
						}
						else if (span.hasAttribute('data-action')) {
							if (span.getAttribute('data-action') == 'open-sync-prefs') {
								span.onclick = () => {
									Zotero.Utilities.Internal.openPreferences('zotero-prefpane-sync');
								};
							}
						}
					}
				}

				div.dataset.allowdrop = true;
			}
			// My Publications
			else if (this.collectionTreeRow.isPublications()) {
				div = doc.createElement('div');
				div.className = 'publications';
				let p = doc.createElement('p');
				p.textContent = Zotero.getString('publications.intro.text1', window.ZOTERO_CONFIG.DOMAIN_NAME);
				div.appendChild(p);

				p = doc.createElement('p');
				p.textContent = Zotero.getString('publications.intro.text2');
				div.appendChild(p);

				p = doc.createElement('p');
				let html = Zotero.getString('publications.intro.text3');
				// Convert <b> tags to placeholders
				html = html.replace('<b>', ':b:').replace('</b>', ':/b:');
				// Encode any other special chars, which shouldn't exist
				html = Zotero.Utilities.htmlSpecialChars(html);
				// Restore bold text
				html = html.replace(':b:', '<strong>').replace(':/b:', '</strong>');
				p.innerHTML = html; // AMO note: markup from hard-coded strings and filtered above
				div.appendChild(p);
			}
			if (div) {
				this._introText = true;
				doc.defaultView.ZoteroPane_Local.setItemsPaneMessage(div);
				return;
			}
			this._introText = null;
		}

		if (this._introText || this._introText === null) {
			window.ZoteroPane.clearItemsPaneMessage();
			this._introText = false;
		}
	}

	/**
	 * Restore a scroll position returned from _saveScrollPosition()
	 */
	_rememberScrollPosition(scrollPosition) {
		if (!scrollPosition || !scrollPosition.id || !this._treebox) {
			return;
		}
		var row = this.getRowIndexByID(scrollPosition.id);
		if (row === false) {
			return;
		}
		this._treebox.scrollToRow(Math.max(row - scrollPosition.offset, 0));
	}

	/**
	 * Return an object describing the current scroll position to restore after changes
	 *
	 * @return {Object|Boolean} - Object with .id (a treeViewID) and .offset, or false if no rows
	 */
	_saveScrollPosition() {
		if (!this._treebox) return false;
		var treebox = this._treebox;
		var first = treebox.getFirstVisibleRow();
		if (!first) {
			return false;
		}
		var last = treebox.getLastVisibleRow();
		var firstSelected = null;
		for (let i = first; i <= last; i++) {
			// If an object is selected, keep the first selected one in position
			if (this.selection.isSelected(i)) {
				let row = this.getRow(i);
				if (!row) return false;
				return {
					id: row.ref.treeViewID,
					offset: i - first
				};
			}
		}

		// Otherwise keep the first visible row in position
		let row = this.getRow(first);
		if (!row) return false;
		return {
			id: row.ref.treeViewID,
			offset: 0
		};
	}

	_saveOpenState(close) {
		if (!this.tree) return [];
		var itemIDs = [];
		if (close) {
			if (!this.selection.selectEventsSuppressed) {
				var unsuppress = this.selection.selectEventsSuppressed = true;
			}
		}
		for (var i=0; i<this._rows.length; i++) {
			if (this.isContainer(i) && this.isContainerOpen(i)) {
				itemIDs.push(this.getRow(i).ref.id);
				if (close) {
					this._closeContainer(i, true);
				}
			}
		}
		if (close) {
			this._refreshRowMap();
			if (unsuppress) {
				this.selection.selectEventsSuppressed = false;
			}
		}
		return itemIDs;
	}

	_rememberOpenState(itemIDs) {
		if (!this.tree) return;
		var rowsToOpen = [];
		for (let id of itemIDs) {
			var row = this._rowMap[id];
			// Item may not still exist
			if (row == undefined) {
				continue;
			}
			rowsToOpen.push(row);
		}
		rowsToOpen.sort(function (a, b) {
			return a - b;
		});

		if (!this.selection.selectEventsSuppressed) {
			var unsuppress = this.selection.selectEventsSuppressed = true;
		}
		// Reopen from bottom up
		for (var i=rowsToOpen.length-1; i>=0; i--) {
			this.toggleOpenState(rowsToOpen[i], true);
		}
		this._refreshRowMap();
		if (unsuppress) {
			this.selection.selectEventsSuppressed = false;
		}
	}

	/**
	 *
	 * @param selection
	 * @param {Boolean} expandCollapsedParents - if an item to select is in a collapsed parent
	 * 					will expand the parent, otherwise the item is ignored
	 * @param {Boolean}	dontEnsureRowsVisible - do not scroll the item tree after restoring selection
	 * 					to ensure restored selection is visible
	 * @private
	 */
	async _restoreSelection(selection, expandCollapsedParents=true, dontEnsureRowsVisible=false) {
		if (!selection.length || !this._treebox) {
			return;
		}

		if (!this.selection.selectEventsSuppressed) {
			var unsuppress = this.selection.selectEventsSuppressed = true;
		}

		this.selection.clearSelection();

		let focusedSet = false;
		var toggleSelect = (function (itemID) {
			if (!focusedSet) {
				this.selection.select(this._rowMap[itemID]);
				focusedSet = true;
			}
			else {
				this.selection.toggleSelect(this._rowMap[itemID]);
			}
		}).bind(this);
		try {
			for (let i = 0; i < selection.length; i++) {
				if (this._rowMap[selection[i].treeViewID] != null) {
					toggleSelect(selection[i].treeViewID);
				}
				// Try the parent
				else {
					let item = selection[i];
					if (!item) {
						continue;
					}

					var parent = item.parentItemID;
					if (!parent) {
						continue;
					}

					if (this._rowMap[parent] != null) {
						if (expandCollapsedParents) {
							await this._closeContainer(this._rowMap[parent]);
							await this.toggleOpenState(this._rowMap[parent]);
							toggleSelect(selection[i].treeViewID);
						}
						else {
							!this.selection.isSelected(this._rowMap[parent]) &&
								toggleSelect(parent);
						}
					}
				}
			}
		}
			// Ignore NS_ERROR_UNEXPECTED from nsITreeSelection::toggleSelect(), apparently when the tree
			// disappears before it's called (though I can't reproduce it):
			//
			// https://forums.zotero.org/discussion/69226/papers-become-invisible-in-the-middle-pane
		catch (e) {
			Zotero.logError(e);
		}

		if (!dontEnsureRowsVisible) {
			this.ensureRowsAreVisible(Array.from(this.selection.selected));
		}

		if (unsuppress) {
			this.selection.selectEventsSuppressed = false;
		}
	}
	
	_handleColumnSort = async (index, sortDirection) => {
		let columnSettings = this._getColumnPrefs();
		let column = this._getColumn(index);
		if (column.dataKey == 'hasAttachment') {
			Zotero.debug("Caching best attachment states");
			if (!this._cachedBestAttachmentStates) {
				let t = new Date();
				for (let i = 0; i < this._rows.length; i++) {
					let item = this.getRow(i).ref;
					if (this._canGetBestAttachmentState(item)) {
						await item.getBestAttachmentState();
					}
				}
				Zotero.debug("Cached best attachment states in " + (new Date - t) + " ms");
				this._cachedBestAttachmentStates = true;
			}
		}
		if (this._sortedColumn && this._sortedColumn.dataKey == column.dataKey) {
			this._sortedColumn.sortDirection = sortDirection;
			if (columnSettings[column.dataKey]) {
				columnSettings[column.dataKey].sortDirection = this._sortedColumn.sortDirection;
			}
		}
		else {
			if (this._sortedColumn) {
				delete this._sortedColumn.sortDirection;
				if (columnSettings[column.dataKey]) {
					delete columnSettings[this._sortedColumn.dataKey].sortDirection;
				}
			}
			this._sortedColumn = column;
			this._sortedColumn.sortDirection = sortDirection;
			if (columnSettings[column.dataKey]) {
				columnSettings[column.dataKey].sortDirection = this._sortedColumn.sortDirection;
			}
		}

		await this._refreshPromise;
		this.selection.selectEventsSuppressed = true;
		await this.sort();
		this.forceUpdate(() => {
			this.selection.selectEventsSuppressed = false;
			// Store column prefs as a final action because it freezes the UI momentarily
			// and makes the column sorting look laggy
			this._storeColumnPrefs(columnSettings);
		});
	}

	_displayColumnPickerMenu = (event) => {
		if (!this.props.columnPicker) return;
		let popupset = document.querySelector('#zotero-column-picker-popupset');
		if (!popupset) {
			popupset = document.createXULElement('popupset');
			popupset.id = 'zotero-column-picker-popupset';
			document.children[0].appendChild(popupset);
		}
		
		const menupopup = document.createXULElement('menupopup');
		menupopup.id = 'zotero-column-picker';
		menupopup.addEventListener('popuphiding', (event) => {
			if (event.target.id == menupopup.id) {
				popupset.removeChild(menupopup);
			}
		});
		
		this.buildColumnPickerMenu(menupopup);

		popupset.appendChild(menupopup);
		menupopup.openPopupAtScreen(
			window.screenX + event.clientX + 2,
			window.screenY + event.clientY + 2,
			true
		);
	}

	_getSecondarySortField() {
		var primaryField = this.getSortField();
		var secondaryField = Zotero.Prefs.get('secondarySort.' + primaryField);
		if (!secondaryField || secondaryField == primaryField) {
			return false;
		}
		return secondaryField;
	}
	
	_setSecondarySortField(secondaryField) {
		var primaryField = this.getSortField();
		var currentSecondaryField = this._getSecondarySortField();
		var sortFields = this.getSortFields();
		
		if (primaryField == secondaryField) {
			return false;
		}
		
		if (currentSecondaryField) {
			// If same as the current explicit secondary sort, ignore
			if (currentSecondaryField == secondaryField) {
				return false;
			}
			
			// If not, but same as first implicit sort, remove current explicit sort
			if (sortFields[2] && sortFields[2] == secondaryField) {
				Zotero.Prefs.clear('secondarySort.' + primaryField);
				return true;
			}
		}
		// If same as current implicit secondary sort, ignore
		else if (sortFields[1] && sortFields[1] == secondaryField) {
			return false;
		}
		
		Zotero.Prefs.set('secondarySort.' + primaryField, secondaryField);
		return true;
	}
	
	_getIcon(index) {
		var item = this.getRow(index).ref;
		
		// Non-item objects that can be appear in the trash
		if (item instanceof Zotero.Collection || item instanceof Zotero.Search) {
			let icon;
			if (item instanceof Zotero.Collection) {
				icon = getCSSIcon('collection');
			}
			else if (item instanceof Zotero.Search) {
				icon = getCSSIcon('search');
			}
			icon.classList.add('icon-item-type');
			return icon;
		}
		
		var itemType = item.getItemTypeIconName();
		return getCSSItemTypeIcon(itemType);
	}

	_canGetBestAttachmentState(item) {
		return (item.isRegularItem() && item.numAttachments())
			|| (item.isFileAttachment() && item.isTopLevelItem());
	}
	
	_getTagSwatch(tag, color) {
		let span = document.createElement('span');
		span.className = 'tag-swatch';
		let extractedEmojis = Zotero.Tags.extractEmojiForItemsList(tag);
		// If contains emojis, display directly
		//
		// TODO: Check for a maximum number of graphemes, which is hard to do
		// https://stackoverflow.com/a/54369605
		if (extractedEmojis) {
			span.textContent = extractedEmojis;
			span.className += ' emoji';
		}
		// Otherwise display color
		else {
			span.className += ' colored';
			span.dataset.color = color.toLowerCase();
			span.style.color = color;
		}
		return span;
	}

	async _resetColumns(){
		this._columnsId = null;
		return new Promise((resolve) => this.forceUpdate(async () => {
			await this.tree._resetColumns();
			await this.refreshAndMaintainSelection();
			resolve();
		}));
	}
};

var ItemTreeRow = function(ref, level, isOpen)
{
	this.ref = ref;			//the item associated with this
	this.level = level;
	this.isOpen = isOpen;
	this.id = ref.treeViewID;
}

ItemTreeRow.prototype.getField = function(field, unformatted)
{
	if (!Zotero.ItemTreeManager.isCustomColumn(field)) {
		return this.ref.getField(field, unformatted, true);
	}
	return Zotero.ItemTreeManager.getCustomCellData(this.ref, field);
}

ItemTreeRow.prototype.numNotes = function() {
	if (this.ref.isNote()) {
		return 0;
	}
	if (this.ref.isAttachment()) {
		return this.ref.note !== '' ? 1 : 0;
	}
	return this.ref.numNotes(false, true) || 0;
}

Zotero.Utilities.Internal.makeClassEventDispatcher(ItemTree);

module.exports = ItemTree;
