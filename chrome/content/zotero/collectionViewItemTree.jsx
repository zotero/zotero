/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
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

/**
 * CollectionViewItemTree - Item tree for collection-based views.
 *
 * This class extends ItemTree with behaviors for views backed by a CollectionTreeRow:
 * - Drag and drop with library/collection awareness
 * - Duplicates set selection
 * - Feed-specific sorting
 * - Colored tag keyboard shortcuts
 * - Intro/welcome text
 * - Collection-aware delete behavior
 * - Quick search integration
 *
 * Used in ZoteroPane, Advanced Search, and other collection-based contexts.
 */

const { getDragTargetOrient } = require("components/utils");
const React = require('react');
const ReactDOM = require('react-dom');
const ItemTree = require('zotero/itemTree');
const { ItemTreeRowProvider, ItemTreeRow } = ItemTree;
const { OS } = ChromeUtils.importESModule("chrome://zotero/content/osfile.mjs");
const { ZOTERO_CONFIG } = ChromeUtils.importESModule('resource://zotero/config.mjs');

const COLORED_TAGS_RE = new RegExp("^(?:Numpad|Digit)([0-" + Zotero.Tags.MAX_COLORED_TAGS + "]{1})$");

// Minimal CollectionTreeRow-like object for callers that pass plain objects to
// changeCollectionTreeRow()/setCollectionTreeRow() (e.g. advanced search).
const STUB_COLLECTION_TREE_ROW = {
	// Properties set by CollectionTreeRow constructor
	view: null,
	type: null,
	ref: {},
	level: 0,
	isOpen: false,
	onUnload: null,
	searchText: "",
	searchMode: "search",
	tags: [],
	
	// Extra props/methods expected by CollectionViewItemTree
	visibilityGroup: "",
	getItems: async () => [],
	isSearchMode: () => false,
	isLibrary: () => false,
	isCollection: () => false,
	isSearch: () => false,
	isPublications: () => false,
	isDuplicates: () => false,
	isFeed: () => false,
	isFeeds: () => false,
	isFeedsOrFeed: () => false,
	isShare: () => false,
	isTrash: () => false,
	isBucket: () => false,
	isUnfiled: () => false,
	isRetracted: () => false,
	setSearch: () => false,
	setTags: () => false,
	clearCache: () => {}
};

class CollectionViewItemTreeRowProvider extends ItemTreeRowProvider {
	constructor(itemTree) {
		super(itemTree);
		this.collectionTreeRow = null;
	}

	/**
	 * Check if the quick search box has a search term.
	 * @returns {boolean}
	 */
	hasQuickSearch() {
		return this.collectionTreeRow?.searchText.length > 0;
	}

	/**
	 * Set a new collectionTreeRow and refresh items.
	 * This handles the data/model logic; UI orchestration stays in ItemTree.
	 * @param {Object} collectionTreeRow - The collection tree row to set
	 * @returns {Promise<void>}
	 */
	async setCollectionTreeRow(collectionTreeRow) {
		// Normalize stub objects to include default CollectionTreeRow methods
		if (collectionTreeRow.constructor.name == "Object") {
			collectionTreeRow = Object.assign({}, STUB_COLLECTION_TREE_ROW, collectionTreeRow);
		}
		// No-op if same collection
		if (this.collectionTreeRow && this.collectionTreeRow.id === collectionTreeRow.id) {
			return;
		}
		this.collectionTreeRow = collectionTreeRow;
		this._includeTrashed = collectionTreeRow.isTrash();
		// Emit loading state - only setCollectionTreeRow shows loading UI
		await this.runListeners('update', null, { loading: true });
		await this.itemTree._ensureSortContextReady();
		this.itemTree._getColumns();
		await this.refresh();
	}

	/**
	 * Set a filter on the item tree.
	 * This handles the data/model logic; UI orchestration stays in ItemTree.
	 * @param {string} type - Filter type ('search', 'citation-search', 'tags')
	 * @param {*} data - Filter data
	 * @returns {Promise<void>}
	 */
	async setFilter(type, data) {
		let changed;
		switch (type) {
			case 'search':
				changed = this.collectionTreeRow.setSearch(data);
				break;
			case 'citation-search':
				changed = this.collectionTreeRow.setSearch(data, 'fields');
				break;
			case 'tags':
				changed = this.collectionTreeRow.setTags(data);
				break;
			default:
				throw ('Invalid filter type in setFilter');
		}
		if (changed) {
			await this.refresh(false, true);
		}
	}

	/**
	 * Core refresh logic - data work only, no update emissions.
	 * Handles _refreshPromise so sort waits for refresh to complete.
	 * @param {boolean} skipExpandMatchParents
	 */
	async _refresh(skipExpandMatchParents) {
		Zotero.debug('Refreshing items list for ' + this.itemTree.id);

		var deferred = Zotero.Promise.defer();
		this.itemTree._refreshPromise = deferred.promise;
		
		try {
			this.collectionTreeRow.clearCache();
			// Get the full set of items we want to show
			let newSearchItems = await this.collectionTreeRow.getItems();
			if (this.collectionTreeRow.isTrash()) {
				// When in trash, also fetch trashed collections and searched
				// So that they are displayed among deleted items
				newSearchItems = newSearchItems
					.concat(await this.collectionTreeRow.getTrashedCollections())
					.concat(await Zotero.Searches.getDeleted(this.collectionTreeRow.ref.libraryID));
			}
			// Remove notes and attachments if necessary
			if (this.itemTree.props.regularOnly) {
				newSearchItems = newSearchItems.filter((item) => {
					return item instanceof Zotero.Collection
						|| item instanceof Zotero.Search
						|| item.isRegularItem();
				});
			}
			let newSearchItemIDs = new Set(newSearchItems.map(item => item.treeViewID));
			// Find the items that aren't yet in the tree
			let itemsToAdd = newSearchItems.filter(item => this._rowMap[item.treeViewID] === undefined);
			// Find the parents of search matches
			let newSearchParentIDs = new Set(
				this.itemTree.props.regularOnly
					? []
					: newSearchItems.filter(item => !!item.parentItemID).map(item => item.parentItemID)
			);
			this._searchParentIDs = newSearchParentIDs;
			
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
					let attachments = (!this.itemTree.props.regularOnly && row.ref.isRegularItem())
						? row.ref.getAttachments()
						: [];
					let isSearchParent = newSearchParentIDs.has(row.ref.treeViewID) || attachments.some(id => newSearchParentIDs.has(id));
					// If not showing children or no children match the search, close
					if (this.itemTree.props.regularOnly || !isSearchParent) {
						row.isOpen = false;
						skipChildren = true;
					}
					else {
						skipChildren = false;
					}
					// Skip items that don't match the search and don't have children that do
					if (!newSearchItemIDs.has(row.ref.treeViewID) && !isSearchParent) {
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
				if (!allItemIDs.has(row.ref.id)) {
					newRows.push(row);
					allItemIDs.add(row.ref.treeViewID);
				}
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
					// Go up one more level to check for parents of annotation rows
					let parentsParent = item.parentItemID;
					if (parentsParent) {
						if (allItemIDs.has(parentsParent)) {
							continue;
						}
						item = Zotero.Items.get(parentsParent);
					}
				}
				// Parent item may have already been added from child
				else if (allItemIDs.has(item.treeViewID)) {
					continue;
				}
				
				// Add new top-level items
				let row = new ItemTreeRow(item, 0, false);
				if (!allItemIDs.has(item.treeViewID)) {
					newRows.push(row);
					allItemIDs.add(item.treeViewID);
					addedItemIDs.add(item.treeViewID);
				}
			}
			
			this._rows = newRows;
			this.refreshRowMap();
			await this.itemTree._ensureSortContextReady();
			this._sort([...addedItemIDs]);
			
			// Toggle all open containers closed and open to refresh child items
			var t = new Date();
			for (let i = this.rows.length - 1; i >= 0; i--) {
				if (this.isContainerOpen(i)) {
					this._refreshContainer(i, true);
				}
			}
			this.refreshRowMap();
			Zotero.debug(`Refreshed open parents in ${new Date() - t} ms`);
			
			this._searchMode = newSearchMode;
			this._searchItemIDs = newSearchItemIDs; // items matching the search
			this.itemTree.invalidateRowCache(true);
				
			if (!this.collectionTreeRow.isPublications()) {
				this._expandMatchParents(newSearchParentIDs);
			}
			
			deferred.resolve();
		}
		catch (e) {
			this._rows = [];
			this.refreshRowMap();
			deferred.reject(e);
			throw e;
		}
	}

	_expandMatchParents() {
		const searchParentIDs = this.searchParentIDs;
		// Expand parents of child matches
		if (!this._searchMode || this.itemTree.props.regularOnly) {
			return;
		}

		let rowsToOpen = [];
		for (let i = 0; i < this.rowCount; i++) {
			if (!this.isContainer(i) || this.isContainerOpen(i)) {
				continue;
			}
			let item = this.getRow(i).ref;
			let attachments = item.isRegularItem() ? item.getAttachments() : [];
			// expand item row if it is a parent of a match
			// OR if it has a child that is a parent of a match
			let shouldBeOpened = searchParentIDs.has(item.id) || attachments.some(id => searchParentIDs.has(id));
			if (shouldBeOpened) {
				rowsToOpen.push(i);
			}
		}
		this._expandRows(rowsToOpen);
	}

	expandMatchParents() {
		this._expandMatchParents();
		this.runListeners('update', true, { restoreSelection: true, ensureRowsAreVisible: true });
	}

	/**
	 * Public refresh - calls _refresh() and emits update.
	 * Does NOT emit loading state - caller is responsible for that.
	 */
	refresh = Zotero.serial(async function (skipExpandMatchParents, restoreSelection = false) {
		try {
			await this._refresh(skipExpandMatchParents);

			this.runListeners('update', true, { restoreSelection });
			await this.itemTree.waitForLoad();
			this.itemTree.runListeners('refresh');
		}
		catch (e) {
			// SearchError is thrown by CollectionTreeRow.getSearchResults() when the
			// underlying search query fails (e.g., a saved search with invalid conditions like
			// "too many SQL variables"). We show a load-error message but don't re-throw, so
			// the UI stays functional and the user can still edit/delete the broken search
			// from the collection tree. See Zotero.CollectionTreeRow.SearchError and the
			// constructor comment in CollectionTreeRow for the full caching/error design.
			if (e instanceof Zotero.CollectionTreeRow.SearchError) {
				this.runListeners('update', true, {
					message: Zotero.getString('pane.items.loadError')
				});
				return;
			}
			await Zotero.Promise.delay();
			this.runListeners('update', true, {
				message: Zotero.getString('pane.items.loadError')
			});
			throw e;
		}
	})

	/*
	 *  Called by Zotero.Notifier on any changes to items in the data layer.
	 *  ZoteroPane-specific implementation with full add/remove/modify handling.
	 */
	async notify(action, type, ids, extraData) {
		// Wait for any in-progress refresh to complete (including view update)
		await this.itemTree._refreshPromise;

		const cachedSelection = this.itemTree._cachedSelection;
		const collectionTreeRow = this.collectionTreeRow;

		var madeChanges = false;
		var refresh = false;
		var sort = false;

		// Selection strategy
		let firstAffectedRowIdx = this._rowMap[
			// 'collection-item' ids are in the form <collectionID>-<itemID>
			// 'item' events are just integers
			type == 'collection-item' ? ids[0].split('-')[1] : ids[0]
		];

		let selectInActiveWindow = false;
		let restoreSelection = true;
		let restoreScroll = true;
		let rowsToSelect = null;
		let items = null;

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

		if (type == 'item' && action == 'add') {
			items = Zotero.Items.get(ids);

			// When an image is pasted into a note, an invisible attachment child
			// of that note is created. Filter out such items, since they
			// do not appear in the itemTree and should not cause a refresh.
			items = items.filter(item => !item.isEmbeddedImageAttachment());
			// If there are no other items, just stop.
			if (items.length == 0) return;
		}

		if (action == 'refresh') {
			// Clear row display cache and invalidate rows for refreshed items
			let rowsToInvalidate = [];
			for (let id of ids) {
				let row = this._rowMap[id];
				if (row === undefined) continue;
				rowsToInvalidate.push(row);
			}

			// For a refresh on an item in the trash, check if the item hadn't been restored
			if (type == 'item' && collectionTreeRow.isTrash()) {
				let rows = [];
				for (let id of ids) {
					let row = this.getRowIndexByID(id);
					if (row === false) continue;
					let item = Zotero.Items.get(id);
					let isParentTrashed = item.parentItemID
						? Zotero.Items.get(item.parentItemID).deleted
						: false;
					// Remove parent row if it isn't deleted, its parent isn't deleted, and it
					// doesn't have any deleted children (shown by numChildren including deleted
					// being the same as numChildren not including deleted)
					if (!item.deleted && !isParentTrashed
							&& (!item.isRegularItem() || item.numChildren(true) == item.numChildren(false))) {
						rows.push(row);
						// And all its children in the tree
						for (let child = row + 1; child < this.getRowCount() && this.itemTree.getLevel(child) > this.itemTree.getLevel(row); child++) {
							rows.push(child);
						}
					}
				}
				if (rows.length) {
					this._removeRows(rows);
					rowsToInvalidate = true; // all rows
					this.runListeners('update', true);
				}
			}

			this.itemTree.invalidateRowCache(ids);
			if (rowsToInvalidate) {
				await this.runListeners('update', rowsToInvalidate);
			}
			return;
		}

		if ((action == 'remove' && !collectionTreeRow.isLibrary(true))
			|| action == 'delete' || action == 'trash'
			|| (action == 'removeDuplicatesMaster' && collectionTreeRow.isDuplicates())) {
			// Since a remove involves shifting of rows, we have to do it in order,
			// so sort the ids by row
			var rows = [];
			let push = action == 'delete' || action == 'trash' || action == 'removeDuplicatesMaster';
			for (var i = 0, len = ids.length; i < len; i++) {
				if (!push) {
					push = !collectionTreeRow.ref.hasItem(ids[i]);
				}
				// Row might already be gone (e.g. if this is a child and
				// 'modify' was sent to parent)
				let row = this._rowMap[ids[i]];
				if (push && row !== undefined) {
					// Don't remove child items from collections, because it's handled by 'modify'
					if (action == 'remove' && this.itemTree.getParentIndex(row) != -1) {
						continue;
					}
					rows.push(row);

					// Remove child items of removed parents
					if (this.itemTree.isContainer(row) && this.itemTree.isContainerOpen(row)) {
						while (++row < this.getRowCount() && this.itemTree.getLevel(row) > 0) {
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
		else if (collectionTreeRow.isSearchMode() && ['item', 'collection', 'search'].includes(type) && ['add', 'modify'].includes(action)) {
			// If search mode, just re-run search
			if (action == 'add' && this.hasQuickSearch()) {
				// For item adds, clear the quick search, unless all the new items have
				// skipSelect or are child items
				if (!items) items = Zotero.Items.get(ids);
				let clear = false;
				for (let item of items) {
					if (!extraData[item.id].skipSelect && item.isTopLevelItem()) {
						clear = true;
						break;
					}
				}
				if (clear) {
					var search = document.getElementById('zotero-tb-search');
					if (search) {
						search.searchTextbox.value = '';
					}
					this.collectionTreeRow.setSearch('');
				}
			}
			this.itemTree.invalidateRowCache(ids);
			refresh = true;
			madeChanges = true;
			// refresh automatically sorts newly added items, so only need to sort on modify
			sort = action == 'modify' ? (ids.length === 1 ? ids[0] : true) : false;
		}
		else if (type === 'item' && action == 'modify') {
			if (!items) items = Zotero.Items.get(ids);

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
					let parentIndex = this.itemTree.getParentIndex(row);

					// If item moved from top level to under another item, remove the old row
					if (parentIndex == -1 && parentItemID) {
						// Close container to remove any sub-items
						this._closeContainer(row, true);
						this._removeRow(row);
					}
					// If moved from under another item to top level, remove old row and add new one
					else if (parentIndex != -1 && !parentItemID) {
						this._closeContainer(row, true);
						this._removeRow(row, true);

						let beforeRow = this.getRowCount();
						this._addRow(new ItemTreeRow(item, 0, false), beforeRow);

						sort = id;
					}
					// If moved from one parent to another, remove from old parent
					else if (parentItemID && parentIndex != -1 && this._rowMap[parentItemID] != parentIndex) {
						this._refreshContainer(parentIndex);
						
						const newParentIndex = this._rowMap[parentItemID];
						if (newParentIndex !== undefined) {
							this._refreshContainer(newParentIndex);
						}
					}
					// If Unfiled Items and item was added to a collection, remove from view
					else if (this.itemTree.isContainer(row) && collectionTreeRow.isUnfiled() && item.getCollections().length) {
						this._closeContainer(row);
						this._removeRow(row);
					}
					else {
						// If not moved from under one item to another, just resort the row
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
						// Most likely, the note or attachment's parent was removed.
						let beforeRow = this.getRowCount();
						this._addRow(new ItemTreeRow(item, 0, false), beforeRow);
						madeChanges = true;
						sort = id;
					}
				}
				// If a trashed child item is restored while its parent's row is expanded,
				// collapse and re-open the parent to have that child item row added.
				else {
					let parentItemRowIndex = this._rowMap[item.parentItemID];
					if (parentItemRowIndex === undefined) continue;
					if (this.isContainerOpen(parentItemRowIndex)) {
						this._refreshContainer(parentItemRowIndex);
					}
				}

				if (sort && ids.length != 1) {
					sort = true;
				}
			}
			
			this.itemTree.invalidateRowCache(ids);
		}
		else if (type == 'item' && action == 'add') {
			for (let item of items) {
				// if the item belongs in this collection
				if (((collectionTreeRow.isLibrary(true)
					&& collectionTreeRow.ref.libraryID == item.libraryID)
					|| (collectionTreeRow.isCollection() && item.inCollection(collectionTreeRow.ref.id)))
					// if we haven't already added it to our hash map
					&& !this._rowMap[item.id]
					// Regular item or standalone note/attachment
					&& item.isTopLevelItem()) {
					let beforeRow = this.getRowCount();
					this._addRow(new ItemTreeRow(item, 0, false), beforeRow);
					madeChanges = true;
				}
			}
			if (madeChanges) {
				sort = (items.length == 1) ? [items[0].id] : true;
			}
		}
		
		if (refresh) {
			await this._refresh();
		}
		if (sort) {
			await this.itemTree._ensureSortContextReady();
			this._sort(typeof sort == 'number' ? [sort] : false);
		}

		if (madeChanges) {
			this.refreshRowMap();

			// If we refreshed, we have to clear the cache
			if (!refresh) {
				this.collectionTreeRow.clearCache();
			}

			var singleSelect = false;
			// If adding a single top-level item and this is the active window, select it
			if (action == 'add') {
				if (ids.length == 1) {
					singleSelect = ids[0];
				}
				// If there's only one parent item in the set of added items,
				// mark that for selection in the UI
				//
				// Only bother checking for single parent item if 1-5 total items,
				// since a translator is unlikely to save more than 4 child items
				else if (ids.length <= 5) {
					if (!items) items = Zotero.Items.get(ids);
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

			if (singleSelect) {
				if (!extraData[singleSelect] || !extraData[singleSelect].skipSelect) {
					selectInActiveWindow = true;
					rowsToSelect = singleSelect;
					restoreSelection = false;
					restoreScroll = false;
				}
			}
			// If a single item was selected, got modified, and still belongs in this view
			// (e.g. it wasn't filtered out by getting moved to a different collection
			// or no longer belongs under current search filter), select it
			else if (action == 'modify' && ids.length == 1
				&& cachedSelection.length == 1 && cachedSelection[0].id === ids[0]
				&& this.getRowIndexByID(ids[0]) !== false) {
				selectInActiveWindow = true;
				rowsToSelect = ids;
			}
			// On removal of a selected row, select item at previous position
			else if (cachedSelection.length) {
				if ((action == 'remove'
						|| action == 'trash'
						|| action == 'delete'
						|| action == 'removeDuplicatesMaster')
					&& cachedSelection.some(o => this.getRowIndexByID(o.id) === false)) {
					// In duplicates view, select the next set on delete
					if (collectionTreeRow.isDuplicates()) {
						if (this._rows[firstAffectedRowIdx]) {
							var itemID = this._rows[firstAffectedRowIdx].ref.id;
							var setItemIDs = collectionTreeRow.ref.getSetItemsByItemID(itemID);
							rowsToSelect = setItemIDs;
							restoreSelection = false;
						}
					}
					else {
						// If this was a child item and the next item at this
						// position is a top-level item, move selection one row
						// up to select a sibling or parent
						if (ids.length == 1 && firstAffectedRowIdx > 0) {
							let previousItem = Zotero.Items.get(ids[0]);
							if (previousItem && !previousItem.isTopLevelItem()) {
								if (this._rows[firstAffectedRowIdx]
									&& this.getLevel(firstAffectedRowIdx) == 0) {
									firstAffectedRowIdx--;
								}
							}
						}

						if (firstAffectedRowIdx !== undefined && firstAffectedRowIdx in this._rows) {
							rowsToSelect = this._rows[firstAffectedRowIdx].id;
							restoreSelection = false;
						}
						// If no item at previous position, select last item in list
						else if (this._rows.length > 0 && this._rows[this._rows.length - 1]) {
							rowsToSelect = this._rows[this._rows.length - 1].id;
							restoreSelection = false;
						}
					}
				}
			}

			await this.runListeners('update', true, {
				restoreSelection,
				restoreScroll,
				selectInActiveWindow,
				selection: rowsToSelect
			});
		}
	}
}


class CollectionViewItemTree extends ItemTree {
	constructor(props) {
		super(props);
		// Set on changeCollectionTreeRow();
		this._id = null;
		this._refreshPromise = Zotero.Promise.resolve();
		this.duplicateMouseSelection = false;

		this.rowProvider = new CollectionViewItemTreeRowProvider(this);
		this._setRowProviderUpdateHandler();

		// Triggered when the item tree is refreshed:
		// - Collection/view changed (changeCollectionTreeRow)
		// - Search/filter updated (setFilter)
		// - Items added/removed/modified (notify -> refresh)
		this.onRefresh = this.createEventBinding('refresh');
	}

	get collectionTreeRow() { return this.rowProvider.collectionTreeRow; }

	get visibilityGroup() {
		return this.collectionTreeRow?.visibilityGroup || 'default';
	}

	get isSortable() {
		return !this.collectionTreeRow?.isFeedsOrFeed();
	}

	_getColumns() {
		if (!this.collectionTreeRow) {
			this._columns = [];
			return this._columns;
		}
		return super._getColumns();
	}

	async changeCollectionTreeRow(collectionTreeRow) {
		if (this._locked) return;
		if (!collectionTreeRow) {
			this.tree = null;
			this._treebox = null;
			return this.clearItemsPaneMessage();
		}
		Zotero.debug(`CollectionViewItemTree.changeCollectionTreeRow(): ${collectionTreeRow.id}`);

		// Set ID based on visibilityGroup
		const visibilityGroup = collectionTreeRow.visibilityGroup || 'default';
		await this.setId("item-tree-" + this.props.id + "-" + visibilityGroup);

		if (collectionTreeRow.view) {
			collectionTreeRow.view.itemTreeView = this;
		}
		await this.rowProvider.setCollectionTreeRow(collectionTreeRow);
		return this.waitForLoad();
	}

	async sort(itemIDs, awaitRefresh = true) {
		awaitRefresh && await this._refreshPromise;
		return super.sort(itemIDs);
	}

	render() {
		const showMessage = !this.collectionTreeRow || this._itemsPaneMessage;

		// If no collectionTreeRow yet, render stub div instead of VirtualizedTable.
		// This prevents VirtualizedTable from trying to use undefined ID.
		if (!this.collectionTreeRow) {
			return [
				this._renderItemsPaneMessage(showMessage),
				<div
					style={{ display: 'none' }}
					className="virtualized-table focus-states-target"
					key="virtualized-table-stub"
				/>
			];
		}

		// Otherwise, use parent render which creates full VirtualizedTable
		return super.render();
	}

	async handleRowModelUpdate(rows, options = {}) {
		const completed = await super.handleRowModelUpdate(rows, options);
		if (completed) {
			await this._updateIntroText();
		}
		return completed;
	}

	async notify(action, type, ids, extraData) {
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

		return super.notify(action, type, ids, extraData);
	}

	async selectItems(ids, noRecurse, noScroll) {
		if (!ids.length) return 0;
		// If no row map, we're probably in the process of switching collections,
		// so store the items to select on the collectionTreeRow for later
		if (!this._rowMap && this.collectionTreeRow) {
			this.collectionTreeRow.itemsToSelect = ids;
			Zotero.debug("_rowMap not yet set; not selecting items");
			return 0;
		}
		// Filter out deleted items if not in trash
		if (!this.collectionTreeRow.isTrash()) {
			ids = ids.filter(id => !Zotero.Items.get(id).deleted);
		}
		return super.selectItems(ids, noRecurse, noScroll);
	}

	/**
	 * @param index {Integer}
	 * @param selectAll {Boolean} Whether the selection is part of a select-all event
	 * @returns {Boolean}
	 */
	isSelectable(index, selectAll=false) {
		// Every listed item is selectable individually. There are exceptions
		// for select-all selections.
		if (!selectAll) return true;

		// Every item is selectable in publications (even when not in a search)
		// or when the tree is not in search mode
		if (!this._searchMode || this.collectionTreeRow.isPublications()) return true;
		
		let row = this.getRow(index);
		if (!row) return false;

		// Only deleted items are selectable in trash
		if (this.collectionTreeRow.isTrash()) {
			return row.ref.deleted;
		}
		else {
			return this._searchItemIDs.has(row.id);
		}
	}

	buildColumnPickerMenu(menupopup) {
		const prefix = 'zotero-column-picker-';
		const columns = this._getColumns();

		const columnMenuitemElements = this._buildColumnPickerMenu(menupopup, prefix, columns);
		if (!this.collectionTreeRow.isFeedsOrFeed()) {
			this._buildSecondarySortMenu(menupopup, prefix, columns);
		}
		this._buildMoveColumnMenu(menupopup, prefix, columns);
	}

	_getRowData(index) {
		var treeRow = this.getRow(index);
		if (!treeRow) {
			throw new Error(`Attempting to get row data for a non-existant tree row ${index}`);
		}
		let itemID = treeRow.id;

		// If value is available, retrieve immediately
		if (this._rowCache[itemID]) {
			return this._rowCache[itemID];
		}
		
		let row = super._getRowData(index);
		// Don't change the format of date in feeds
		if (this.collectionTreeRow.isFeedsOrFeed() && row.date) {
			let val;
			let customRowValue = this.props.getExtraField(treeRow.ref, 'date');
			if (customRowValue !== undefined) {
				val = customRowValue;
			}
			else {
				val = treeRow.getField('date');
			}
			row.date = val;
		}
		this._rowCache[itemID] = row;
		return row;
	}

	async setFilter(type, data) {
		if (this._locked) return;
		this._cacheState();
		await this.rowProvider.setFilter(type, data);
		await this.waitForLoad();
	};

	// ///////////////////////////////////////////////////////////////////////////
	//
	//  Drag and Drop
	//
	// ///////////////////////////////////////////////////////////////////////////

	/**
	 * Start a drag using HTML 5 Drag and Drop
	 */
	onDragStart(event, index) {
		Zotero.DragDrop.currentDragSource = this.collectionTreeRow;
		return super.onDragStart(event, index);
	};

	/**
	 * We use this to set the drag action, which is used by view.canDrop(),
	 * based on the view's canDropCheck() and modifier keys.
	 */
	onDragOver(event, row) {
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
		}
		finally {
			let prevDropRow = this._dropRow;
			if (event.dataTransfer.dropEffect != 'none') {
				this._dropRow = row;
			}
			else {
				this._dropRow = null;
			}
			if (prevDropRow != this._dropRow || previousOrientation != Zotero.DragDrop.currentOrientation) {
				typeof prevDropRow == 'number' && this.tree.invalidateRow(prevDropRow);
				this.tree.invalidateRow(row);
			}
		}
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

					// Disallow drag of annotation items
					if (item.isAnnotation()) {
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
				let targetRow = row != -1 ? this.getRow(row) : null;
				for (let item of items) {
					// Don't allow drag if any top-level items
					if (item.isTopLevelItem()) {
						return false;
					}

					// Disallow drag of annotation items
					if (item.isAnnotation()) {
						return false;
					}

					// Don't allow web attachments to be dragged out of parents,
					// except for files that can be recognized
					if (item.isWebAttachment()
							// Keep in sync with Zotero.RecognizeDocument.canRecognize()
							&& !item.isPDFAttachment()
							&& !item.isEPUBAttachment()) {
						return false;
					}

					// Can always drop into empty space
					if (!targetRow) continue;
					// Can only drop before or after a top-level item
					if (!targetRow.ref.isTopLevelItem()) return false;
					// Cannot drop between an opened container and the first child row
					if (orient == 1 && targetRow.isOpen) return false;
					// Cannot drop after the last child of a parent container
					if (orient == -1) {
						let parentIndex = this._rowMap[item.parentItemID];
						let nextParentIndex = null;
						for (let i = parentIndex + 1; i < this.rowProvider.rowCount; i++) {
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
		else if (dataType == 'application/x-moz-file') {
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
					for (let i = 0; i < items.length; i++) {
						let item = items[i];
						item.parentID = rowItem.id;
						await item.save();
					}
				});
			}

			// Dropped outside of a row
			else {
				// Remove from parent and make top-level
				if (collectionTreeRow.isLibrary(true)) {
					await Zotero.DB.executeTransaction(async function () {
						for (let i = 0; i < items.length; i++) {
							let item = items[i];
							if (!item.isRegularItem()) {
								item.parentID = false;
								await item.save();
							}
						}
					});
				}
				// Add to collection
				else {
					await Zotero.DB.executeTransaction(async function () {
						for (let i = 0; i < items.length; i++) {
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
		else if (dataType == 'application/x-moz-file') {
			// Disallow drop into read-only libraries
			if (!collectionTreeRow.editable) {
				window.ZoteroPane.displayCannotEditLibraryMessage();
				return;
			}
			
			// See note in onDragOver() above
			if (Zotero.isMac) {
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
					&& Zotero.Attachments.shouldAutoRenameFile(dropEffect == 'link', targetLibraryID)) {
					parentItem = Zotero.Items.get(parentItemID);
					if (!parentItem.numNonHTMLFileAttachments()) {
						renameIfAllowedType = true;
					}
				}

				// If we have more than one file, we only want to call setAutoAttachmentTitle()
				// at the end, once the attachments know whether they have siblings
				let delaySetAutoAttachmentTitle = data.length > 1;

				for (var i = 0; i < data.length; i++) {
					var file = data[i].path;

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
							title: delaySetAutoAttachmentTitle ? '' : undefined,
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
							title: delaySetAutoAttachmentTitle ? '' : undefined,
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
				if (delaySetAutoAttachmentTitle) {
					for (let item of addedItems) {
						item.setAutoAttachmentTitle();
						await item.saveTx({ notifierQueue });
					}
				}
				// Select children created after drag-drop onto a top-level item
				if (parentItemID && addedItems.length) {
					await this.selectItems(addedItems.map(item => item.id));
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

	// ///////////////////////////////////////////////////////////////////////////
	//
	//  Duplicates handling
	//
	// ///////////////////////////////////////////////////////////////////////////

	handleActivate(event, indices) {
		let items = indices.map(index => this.getRow(index).ref);
		// Ignore double-clicks in duplicates view on everything except attachments
		if (event.button == 0 && this.collectionTreeRow?.isDuplicates()) {
			if (items.length != 1 || !items[0].isAttachment()) {
				return false;
			}
		}
		return super.handleActivate(event, indices);
	}

	_handleRowMouseUpDown(event) {
		const modifierIsPressed = ['ctrlKey', 'metaKey', 'shiftKey', 'altKey'].some(key => event[key]);
		if (this.collectionTreeRow?.isDuplicates() && !modifierIsPressed) {
			this.duplicateMouseSelection = true;
		}
	};

	_handleSelectionChange = (selection, shouldDebounce) => {
		if (this.collectionTreeRow?.isDuplicates() && selection.count == 1 && this.duplicateMouseSelection) {
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
		return super._handleSelectionChange(selection, shouldDebounce);
	};

	// ///////////////////////////////////////////////////////////////////////////
	//
	//  Feed-specific sorting
	//
	// ///////////////////////////////////////////////////////////////////////////

	getSortDirection(sortFields) {
		if (this.collectionTreeRow?.isFeedsOrFeed()) {
			return Zotero.Prefs.get('feeds.sortAscending') ? 1 : -1;
		}
		return super.getSortDirection(sortFields);
	}

	getSortField() {
		if (this.collectionTreeRow?.isFeedsOrFeed()) {
			return 'id';
		}
		return super.getSortField();
	}

	// ///////////////////////////////////////////////////////////////////////////
	//
	//  Colored tag keyboard shortcuts
	//
	// ///////////////////////////////////////////////////////////////////////////

	handleKeyDown(event) {
		const result = super.handleKeyDown(event);
		// False means the operation was handled by the base class
		if (!result) {
			return result;
		}

		// In search when performing selectAll, expand parents of matches
		if (event.key == 'a'
				&& !event.altKey
				&& !event.shiftKey
				&& (Zotero.isMac ? (event.metaKey && !event.ctrlKey) : event.ctrlKey)
				&& !this.collectionTreeRow.isPublications()) {
			this.rowProvider.expandMatchParents();
			return true;
		}

		// Colored tag handling (ZoteroPane-specific)
		if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && COLORED_TAGS_RE.test(event.code)) {
			let libraryID = this.collectionTreeRow?.ref?.libraryID;
			if (!libraryID) {
				return true;
			}
			let position = COLORED_TAGS_RE.exec(event.code)[1] - 1;
			// When 0 is pressed, remove all colored tags
			if (position == -1) {
				let items = this.getSelectedItems();
				Zotero.Tags.removeColoredTagsFromItems(items);
				// Disable find-as-you-type for 0 keypress
				return false;
			}
			let colorData = Zotero.Tags.getColorByPosition(libraryID, position);
			// If a color isn't assigned to this number or any
			// other numbers, allow key navigation
			if (!colorData) {
				return !Zotero.Tags.getColors(libraryID).size;
			}

			let items = this.getSelectedItems();
			// Check for toggle
			// If tag is assigned to any of the selected items, remove from all
			// selected items.
			// Otherwise, add to all selected items.
			let tagRemove = items.some(item => item.hasTag(colorData.name));

			// Async but no need to wait
			(async () => {
				for (let item of items) {
					if (tagRemove) {
						item.removeTag(colorData.name);
					}
					else {
						item.addTag(colorData.name);
					}
					await item.saveTx();
				}
			})();

			// We handled this
			return false;
		}

		// Duplicates view arrow key handling
		if (this.collectionTreeRow?.isDuplicates() && ["ArrowUp", "ArrowDown"].includes(event.key)
				&& !event.ctrlKey && !event.metaKey && !event.shiftKey
				&& this.selection.count > 1) {
			let focused = this.selection.focused;
			let nextItem = this.getRow(focused + (event.key == "ArrowUp" ? -1 : 1));
			if (nextItem) {
				var setItemIDs = this.collectionTreeRow.ref.getSetItemsByItemID(nextItem.id);
				// If next item is part of the set, we skip the whole set
				if (this.selection.isSelected(this._rowMap[nextItem.id])) {
					let newIndex;
					if (event.key == "ArrowDown") {
						newIndex = Math.max(...setItemIDs.map(id => this._rowMap[id])) + 1;
					}
					else {
						newIndex = Math.min(...setItemIDs.map(id => this._rowMap[id])) - 1;
					}
					if (newIndex >= 0 && newIndex < this.rowProvider.rowCount) {
						this.selection.select(newIndex);
						this.ensureRowIsVisible(newIndex);
						return false;
					}
				}
			}
		}
		return true;
	};

	// ///////////////////////////////////////////////////////////////////////////
	//
	//  Collection-aware delete
	//
	// ///////////////////////////////////////////////////////////////////////////

	async deleteSelection(force) {
		if (this.selection.count == 0) {
			return;
		}
		
		try {
			this.selection.selectEventsSuppressed = true;

			// Collapse open items
			for (var i = 0; i < this.rowCount; i++) {
				if (this.selection.isSelected(i) && this.isContainer(i)) {
					await this.closeContainer(i, false);
				}
			}
			this.rowProvider.refreshRowMap();
			this.tree.invalidate();

			let selectedObjects = [...this.selection.selected].map(index => this.getRow(index).ref);
			let selectedItems = selectedObjects.filter(o => o instanceof Zotero.Item);
			let selectedItemIDs = selectedItems.map(o => o.id);

			let collectionTreeRow = this.collectionTreeRow;

			// If all selected items are annotations, for now erase them skipping trash
			if (selectedItems.length && selectedItems.every(item => item.isAnnotation())) {
				await Zotero.Items.erase(selectedItemIDs);
			}
			else if (collectionTreeRow.isBucket()) {
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

	// ///////////////////////////////////////////////////////////////////////////
	//
	//  Intro text (welcome message, publications intro)
	//
	// ///////////////////////////////////////////////////////////////////////////

	async _updateIntroText() {
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
					`<span class="text-link" data-href="${ZOTERO_CONFIG.QUICK_START_URL}">$1</span>`
					+ '$2'
					+ `<span class="text-link" data-href="${ZOTERO_CONFIG.CONNECTORS_URL}">$3</span>`
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
				p.textContent = Zotero.getString('publications.intro.text1', ZOTERO_CONFIG.DOMAIN_NAME);
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
				await this.setItemsPaneMessage(div);
				return;
			}
			this._introText = null;
		}

		if (this._introText || this._introText === null) {
			await this.clearItemsPaneMessage();
			this._introText = false;
		}
	}

	// ///////////////////////////////////////////////////////////////////////////
	//
	//  Column menu - Secondary sort (hidden for feeds)
	//
	// ///////////////////////////////////////////////////////////////////////////

	buildColumnPickerMenu(menupopup) {
		// Call parent to build the base menu
		super.buildColumnPickerMenu(menupopup);

		// Add secondary sort menu (not for feeds)
		if (!this.collectionTreeRow?.isFeedsOrFeed()) {
			this._buildSecondarySortMenu(menupopup);
		}
	}

	_buildSecondarySortMenu(menupopup) {
		const { formatColumnName } = require('components/virtualized-table');
		const prefix = 'zotero-column-picker-';
		const columns = this._getColumns();

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
				});
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
}

module.exports = CollectionViewItemTree;

