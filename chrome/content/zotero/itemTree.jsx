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
const { VirtualizedTree, formatColumnName } = VirtualizedTable;
const { COLUMNS } = require("zotero/itemTreeColumns");
const { ItemTreeRow } = require('zotero/itemTreeRow');
const { OS } = ChromeUtils.importESModule("chrome://zotero/content/osfile.mjs");
const { ZOTERO_CONFIG } = ChromeUtils.importESModule('resource://zotero/config.mjs');

/**
 * @typedef {import("./itemTreeColumns.jsx").ItemTreeColumnOptions} ItemTreeColumnOptions
 */

const CHILD_INDENT = 16;
const COLUMN_PREFS_FILEPATH = OS.Path.join(Zotero.Profile.dir, "treePrefs.json");

/**
 * Base row data provider for ItemTree.
 *
 * Methods follow a private/public pattern:
 * - Private methods perform data operations without emitting
 *   update events. This allows them to be freely composed within other methods
 *   without triggering redundant UI updates.
 * - Public methods call one or more private methods, then emit update events
 *   via runListeners().
 *
 * Subclasses (e.g. CollectionViewItemTreeRowProvider) should follow the same
 * pattern when adding new functionality.
 */
class ItemTreeRowProvider {
	constructor(itemTree) {
		this.itemTree = itemTree;
		this._rows = [];
		this._rowMap = {};
		this._searchMode = false;
		this._searchItemIDs = new Set();
		this._searchParentIDs = new Set();
		this._includeTrashed = false;
		this.onUpdate = this.createEventBinding('update');
	}

	/**
	 * Create an ItemTreeRow for a reference object.
	 * Subclasses can override to return custom row types.
	 *
	 * @param {Object} ref - The reference object (e.g. Zotero.Item, Zotero.Collection)
	 * @param {number} level - The nesting level
	 * @param {boolean} isOpen - Whether the row is open (if a container)
	 * @returns {ItemTreeRow}
	 */
	createRow(ref, level, isOpen) {
		return ItemTreeRow.create(ref, level, isOpen);
	}

	/**
	 * Whether a container row's children should be sorted with the current
	 * tree comparator when the container is opened.
	 *
	 * Default delegates to the row's sortChildren property. Subclasses can
	 * override for view-specific behavior.
	 *
	 * @param {ItemTreeRow} row
	 * @returns {boolean}
	 */
	shouldSortChildren(row) {
		return !!row.sortChildren;
	}

	get includeTrashed() {
		return this._includeTrashed;
	}

	get rows() {
		return this._rows;
	}
	
	get rowCount() {
		return this._rows.length;
	}

	get rowMap() {
		return this._rowMap;
	}

	get searchMode() {
		return this._searchMode;
	}

	get searchItemIDs() {
		return this._searchItemIDs;
	}

	get searchParentIDs() {
		return this._searchParentIDs;
	}

	getRowCount() {
		return this._rows.length;
	}

	/**
	 * Return a reference to the tree row at a given row
	 *
	 * @return {TreeRow}
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
		if (!(id in this._rowMap)) {
			Zotero.debug(`${this.itemTree.id}: Trying to access a row with invalid ID ${id}`);
			return false;
		}
		return this._rowMap[id];
	}

	getLevel(index) {
		return this._rows[index].level;
	}

	isContainer(index) {
		let row = this.getRow(index);
		if (!row) return false;
		return row.isContainer();
	}

	isContainerOpen(index) {
		return this.getRow(index)?.isContainerOpen() ?? false;
	}

	isContainerEmpty(index) {
		if (this.itemTree.props.isContainerEmpty) {
			return this.itemTree.props.isContainerEmpty(index);
		}
		if (this.itemTree.props.regularOnly) {
			return true;
		}

		let row = this.getRow(index);
		if (!row) {
			return true;
		}
		return row.isContainerEmpty({
			searchMode: this._searchMode,
			searchItemIDs: this._searchItemIDs,
			includeTrashed: this._includeTrashed,
		});
	}
	
	_closeContainer(index, skipRowMapRefresh = false) {
		if (this.isContainerOpen(index)) {
			this._toggleOpenState(index, skipRowMapRefresh);
		}
	}
	
	_openContainer(index, skipRowMapRefresh = false) {
		if (!this.isContainerOpen(index)) {
			this._toggleOpenState(index, skipRowMapRefresh);
		}
	}

	_refreshContainer(index, skipRowMapRefresh = false) {
		if (!this.isContainer(index)) return;
		this._closeContainer(index, true);
		this._openContainer(index, true);
		if (!skipRowMapRefresh) {
			this.refreshRowMap();
		}
	}

	_toggleOpenState(index, skipRowMapRefresh = false) {
		if (!this.isContainer(index)) {
			return false;
		}

		let count = 0;

		if (this.isContainerOpen(index)) {
			// Close
			let level = this.getLevel(index);
			// Remove child rows
			while ((index + 1 < this._rows.length) && (this.getLevel(index + 1) > level)) {
				this._removeRow(index + 1, true);
				count++;
			}
			this._rows[index].isOpen = false;
		}
		else if (!this.isContainerEmpty(index)) {
			// Open
			let row = this.getRow(index);
			let level = this.getLevel(index);
			let childRefs = row.getChildItems({
				searchMode: this._searchMode,
				searchItemIDs: this._searchItemIDs,
				includeTrashed: this._includeTrashed,
				filterChildItems: this.itemTree.props.filterChildItems,
			});

			let childRows = childRefs.map(ref => this.createRow(ref, level + 1, false));
			if (this._sortFields && this.shouldSortChildren(row)) {
				childRows.sort((a, b) => this._compareRows(a, b));
			}

			for (let i = 0; i < childRows.length; i++) {
				count++;
				this._addRow(childRows[i], index + i + 1, true);
			}

			this._rows[index].isOpen = true;
		}
		if (!skipRowMapRefresh && count > 0) {
			this.refreshRowMap();
		}
	}

	toggleOpenState(index, skipRowMapRefresh = false) {
		this.itemTree._cacheState();
		this._toggleOpenState(index, skipRowMapRefresh);
		// Preserve viewport when toggling a container instead of jumping to the current selection.
		this.runListeners('update', true, {
			restoreSelection: true,
			expandCollapsedParents: false,
			restoreScroll: true,
		});
	}

	/**
	 * Expand rows level-by-level, or across all levels when requested.
	 *
	 * @param {boolean} [acrossAllLevels=false]
	 */
	expandAllRows(acrossAllLevels = false) {
		if (!this.rowCount) {
			return;
		}

		this.itemTree._cacheState();

		let deepestExpandedLevel = 0;
		for (let i = 0; i < this.rowCount; i++) {
			if (this.isContainer(i) && this.isContainerOpen(i) && this.getLevel(i) > deepestExpandedLevel) {
				deepestExpandedLevel = this.getLevel(i);
			}
		}

		let rowsToExpandAtThatLevel = false;
		for (let i = 0; i < this.rowCount; i++) {
			if (this.isContainer(i)
					&& !this.isContainerOpen(i)
					&& !this.isContainerEmpty(i)
					&& this.getLevel(i) == deepestExpandedLevel) {
				rowsToExpandAtThatLevel = true;
				break;
			}
		}
		if (!rowsToExpandAtThatLevel) {
			deepestExpandedLevel++;
		}

		for (let i = 0; i < this.rowCount; i++) {
			if (this.isContainer(i)
					&& !this.isContainerOpen(i)
					&& !this.isContainerEmpty(i)
					&& (acrossAllLevels || this.getLevel(i) <= deepestExpandedLevel)) {
				this._toggleOpenState(i, true);
			}
		}
		this.refreshRowMap();
		this.runListeners('update', true, {
			restoreSelection: true,
			expandCollapsedParents: false,
			restoreScroll: true,
		});
	}

	/**
	 * Collapse rows one level at a time, or across all levels when requested.
	 *
	 * @param {boolean} [acrossAllLevels=false]
	 */
	collapseAllRows(acrossAllLevels = false) {
		if (!this.rowCount) {
			return;
		}

		this.itemTree._cacheState();

		let maxLevelWithExpanded = -1;
		for (let i = 0; i < this.rowCount; i++) {
			if (this.isContainer(i) && this.isContainerOpen(i) && this.getLevel(i) > maxLevelWithExpanded) {
				maxLevelWithExpanded = this.getLevel(i);
			}
		}

		for (let i = 0; i < this.rowCount; i++) {
			if (this.isContainer(i)
					&& this.isContainerOpen(i)
					&& (acrossAllLevels || this.getLevel(i) === maxLevelWithExpanded)) {
				this._toggleOpenState(i, true);
			}
		}
		this.refreshRowMap();
		this.runListeners('update', true, {
			restoreSelection: true,
			expandCollapsedParents: false,
			restoreScroll: true,
		});
	}

	_expandRows(indices) {
		// Reverse sort so that as we open indices don't change.
		indices.sort((a, b) => b - a);
		for (let index of indices) {
			if (!this.isContainerOpen(index)) {
				this._toggleOpenState(index, true);
			}
		}
		this.refreshRowMap();
	}

	expandRows(indices) {
		this.itemTree._cacheState();
		this._expandRows(indices);
		this.runListeners('update', true, { restoreSelection: true, ensureRowsAreVisible: true });
	}

	collapseRows(indices) {
		this.itemTree._cacheState();
		indices.sort((a, b) => b - a);
		for (let index of indices) {
			if (this.isContainerOpen(index)) {
				this._toggleOpenState(index, true);
			}
		}
		this.refreshRowMap();
		this.runListeners('update', true, { restoreSelection: true, expandCollapsedParents: false });
	}

	/**
	 * Expand all ancestors of the specified item id to make it visible.
	 * Issues a single update at the end.
	 * @param {number} id - The item ID to expand to
	 * @returns {boolean} True if the item is now in the tree
	 */
	_expandToItem(id) {
		// Stop if the row already exists or if the item is not found
		if (this._rowMap[id] !== undefined) return true;

		let item = Zotero.Items.get(id);
		if (!item) return false;

		let toExpand = [];
		// Collect all ancestors of the item that are not in the tree
		while (item.parentItemID && this._rowMap[item.id] === undefined) {
			item = Zotero.Items.get(item.parentItemID);
			toExpand.push(item.id);
		}

		// Check if the top-most ancestor is in the tree
		if (this._rowMap[item.id] === undefined) return false;

		// Go through ancestors starting from the top-most one
		// and expand them
		while (toExpand.length > 0) {
			let ancestorID = toExpand.pop();
			let ancestorRow = this._rowMap[ancestorID];

			// Close and re-open the ancestor to refresh children and reveal the next row
			this._refreshContainer(ancestorRow);
		}
		return true;
	}

	/**
	 * Expand all ancestors of the specified item id to make it visible.
	 * Issues a single update at the end.
	 * @param {number} id - The item ID to expand to
	 */
	expandToItem(id) {
		this.itemTree._cacheState();
		this._expandToItem(id);
		this.runListeners('update', true, { restoreSelection: true, ensureRowsAreVisible: true });
	}

	refreshRowMap() {
		var rowMap = {};
		for (let i = 0; i < this._rows.length; i++) {
			let id = this._rows[i].id;
			if (rowMap[id] !== undefined) {
				Zotero.debug(`WARNING: refreshRowMap(): item row ${rowMap[id]} already found for item ${id} at ${i}`, 2);
				Zotero.debug(new Error().stack, 2);
			}
			rowMap[id] = i;
		}
		this._rowMap = rowMap;
	}

	_addRow(row, index, skipRowMapRefresh = false) {
		this._rows.splice(index, 0, row);
		if (!skipRowMapRefresh) {
			this.refreshRowMap();
		}
	}

	_removeRow(index, skipRowMapRefresh = false) {
		this._rows.splice(index, 1);
		if (!skipRowMapRefresh) {
			this.refreshRowMap();
		}
	}

	_removeRows(indices) {
		indices.sort((a, b) => b - a);
		for (let index of indices) {
			this._rows.splice(index, 1);
		}
		this.refreshRowMap();
	}

	/**
	 * Save which containers are open and close them.
	 * @returns {number[]} - Array of item IDs that were open
	 */
	_saveOpenState() {
		var openIDs = [];
		var toClose = [];
		for (var i = 0; i < this._rows.length; i++) {
			if (this.isContainer(i) && this.isContainerOpen(i)) {
				let row = this.getRow(i);
				openIDs.push(row.id);
				if (row.level == 0) {
					toClose.push(row.id);
				}
			}
		}
		// Close top-level containers from bottom up
		for (let i = toClose.length - 1; i >= 0; i--) {
			let row = this._rowMap[toClose[i]];
			if (row !== undefined && this.isContainerOpen(row)) {
				this._toggleOpenState(row, true);
			}
		}
		this.refreshRowMap();
		return openIDs;
	}

	/**
	 * Restore previously open containers.
	 * @param {Array} ids - Array of row IDs (treeViewIDs) to reopen
	 * @param {boolean} secondLevel - Internal flag for recursive call
	 */
	_restoreOpenState(ids, secondLevel = false) {
		var rowsToOpen = [];
		var nextLevelToOpen = [];
		for (let id of ids) {
			var row = this._rowMap[id];
			if (row === undefined) {
				if (!secondLevel) {
					nextLevelToOpen.push(id);
				}
				continue;
			}
			rowsToOpen.push(row);
		}
		rowsToOpen.sort((a, b) => a - b);

		// Reopen from bottom up
		for (var i = rowsToOpen.length - 1; i >= 0; i--) {
			if (!this.isContainerOpen(rowsToOpen[i])) {
				this._toggleOpenState(rowsToOpen[i], true);
			}
		}
		this.refreshRowMap();

		if (nextLevelToOpen.length) {
			this._restoreOpenState(nextLevelToOpen, true);
		}
	}

	/**
	 * Initialize sort state from current tree settings.
	 * Called at the start of _sort(). The state is stored on the instance
	 * so that _compareRows() can be used by both _sort() and _toggleOpenState().
	 */
	_initSortState() {
		this._sortFields = this.itemTree.getSortFields();
		this._sortDirection = this.itemTree.getSortDirection(this._sortFields);
		this._sortCollation = Zotero.getLocaleCollation();
		this._sortCreatorAsString = Zotero.Prefs.get('sortCreatorAsString');
		this._sortCache = {};
		this._sortFields.forEach(x => this._sortCache[x] = {});
		this._sortCreatorCache = {};
	}

	/**
	 * Get a sortable field value for a row.
	 * Uses this._sortCache for memoization.
	 */
	_getSortField(field, row) {
		let aID = row.id;
		if (this._sortCache[field] && this._sortCache[field][aID] !== undefined) {
			return this._sortCache[field][aID];
		}

		let val;
		switch (field) {
			case 'title':
				val = Zotero.Items.getSortTitle(row.getDisplayTitle());
				break;

			case 'hasAttachment':
				val = row.getBestAttachmentStateCached() || 0;
				break;

			case 'numNotes':
				val = row.numNotes() || 0;
				break;

			case 'date':
				val = row.ref.getField('date', true, true);
				if (val) {
					val = val.substr(0, 10);
					if (val.indexOf('0000') == 0) {
						val = "";
					}
				}
				break;

			case 'year':
				val = row.ref.getField('date', true, true);
				if (val) {
					val = val.substr(0, 4);
					if (val == '0000') {
						val = "";
					}
				}
				break;

			case 'feed':
				val = (row.ref.isFeedItem && Zotero.Feeds.get(row.ref.libraryID).name) || "";
				break;

			case 'lastRead':
				val = row.ref.getItemLastRead() || '';
				break;

			case 'addedBy':
				val = row.ref.createdByUserID
					? Zotero.Users.getName(row.ref.createdByUserID) : '';
				break;

			case 'lastModifiedBy':
				let userID = row.ref.lastModifiedByUserID || row.ref.createdByUserID;
				val = userID ? Zotero.Users.getName(userID) : '';
				break;

			default: {
				let extraField = this.itemTree.props.getExtraField(row.ref, field);
				if (extraField !== undefined) {
					val = extraField;
				}
				else {
					val = row.getField(field, false, true);
				}
				break;
			}
		}

		if (this._sortCache[field]) {
			this._sortCache[field][aID] = val;
		}
		return val;
	}

	/**
	 * Compare two rows on a single sort field.
	 */
	_compareField(a, b, sortField) {
		// Set whether rows with empty values should sort at the beginning
		var emptyFirst = { title: true, date: true, year: true, lastRead: true };

		switch (sortField) {
			case 'firstCreator': {
				let prop = this._sortCreatorAsString ? 'firstCreator' : 'sortCreator';
				let cache = this._sortCreatorCache;
				let fieldA = cache[a.id];
				let fieldB = cache[b.id];
				if (fieldA === undefined) {
					let s = a.ref[prop];
					if (!s) s = a.ref.getField('firstCreator');
					cache[a.id] = fieldA = Zotero.Items.getSortTitle(s || '');
				}
				if (fieldB === undefined) {
					let s = b.ref[prop];
					if (!s) s = b.ref.getField('firstCreator');
					cache[b.id] = fieldB = Zotero.Items.getSortTitle(s || '');
				}
				if (fieldA === '' && fieldB === '') return 0;
				if (fieldA === '' && fieldB !== '') return 1;
				if (fieldA !== '' && fieldB === '') return -1;
				return this._sortCollation.compareString(1, fieldA, fieldB);
			}

			case 'itemType': {
				let typeA = a.getTypeLabel();
				let typeB = b.getTypeLabel();
				return (typeA > typeB) ? 1 : (typeA < typeB) ? -1 : 0;
			}

			default: {
				let fieldA = this._getSortField(sortField, a);
				let fieldB = this._getSortField(sortField, b);

				if (!emptyFirst[sortField]) {
					if (fieldA === '' && fieldB !== '') return 1;
					if (fieldA !== '' && fieldB === '') return -1;
				}

				if (sortField == 'hasAttachment') {
					const order = ['pdf', 'snapshot', 'epub', 'image', 'video', 'other', 'none'];
					fieldA = order.indexOf(fieldA.type || 'none') + (fieldA.exists ? 0 : (order.length - 1));
					fieldB = order.indexOf(fieldB.type || 'none') + (fieldB.exists ? 0 : (order.length - 1));
					return fieldA - fieldB;
				}

				if (sortField == 'callNumber') {
					return Zotero.Utilities.Item.compareCallNumbers(fieldA, fieldB);
				}

				return this._sortCollation.compareString(1, String(fieldA), String(fieldB));
			}
		}
	}

	/**
	 * Compare two rows using the current sort state.
	 *
	 * Uses sort state initialized by _initSortState() (called from _sort()).
	 * Also used by _toggleOpenState() to sort child rows when containers are
	 * opened, ensuring the same ordering is applied at every tree level.
	 *
	 * @param {ItemTreeRow} a
	 * @param {ItemTreeRow} b
	 * @returns {number}
	 */
	_compareRows(a, b) {
		let cmp = this.itemTree.props.compareItems(a, b, this._sortDirection);
		if (cmp !== 0) return cmp;
		for (let i = 0; i < this._sortFields.length; i++) {
			cmp = this._compareField(a, b, this._sortFields[i]);
			if (cmp !== 0) {
				return cmp * this._sortDirection;
			}
		}
		return 0;
	}

	/**
	 * Core sorting logic without view updates.
	 * Saves and restores open state internally.
	 *
	 * Initializes sort state so that _compareRows() is available to both
	 * the top-level sort and _toggleOpenState() when containers are reopened.
	 *
	 * @param {number[]|null} itemIDs - Specific items to sort, or null for full sort
	 */
	_sort(itemIDs) {
		// Initialize sort state
		this._initSortState();
	
		// For child items, just close and reopen parents
		if (itemIDs) {
			let parentItemIDs = new Set();
			let skipped = [];
			for (let itemID of itemIDs) {
				let row = this._rowMap[itemID];
				if (row === undefined) continue;
				let item = this.getRow(row).ref;
				let parentItemID = item.parentItemID;
				if (!parentItemID) {
					skipped.push(itemID);
					continue;
				}
				parentItemIDs.add(parentItemID);
			}

			let parentRows = [...parentItemIDs].map(itemID => this._rowMap[itemID]);
			parentRows.sort((a, b) => b - a);

			for (let row of parentRows) {
				this._refreshContainer(row, true);
			}
			this.refreshRowMap();

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

		// Save open state and close containers before sorting
		var openIDs = this._saveOpenState();

		Zotero.debug(`Sorting items list by ${this._sortFields.join(", ")} `
			+ `${this._sortDirection == 1 ? "ascending" : "descending"} `
			+ (itemIDs && itemIDs.length
				? `for ${itemIDs.length} ` + Zotero.Utilities.pluralize(itemIDs.length, ['item', 'items'])
				: ""));

		// Sort specific items or all
		try {
			if (itemIDs) {
				let idsToSort = new Set(itemIDs);
				this._rows.sort((a, b) => {
					if (!idsToSort.has(a.ref.id) && !idsToSort.has(b.ref.id)) return 0;
					return this._compareRows(a, b);
				});
			}
			else {
				this._rows.sort((a, b) => this._compareRows(a, b));
			}
		}
		catch (e) {
			Zotero.logError("Error sorting fields: " + e.message);
			Zotero.debug(e, 1);
			Zotero.Prefs.clear('secondarySort.' + this._sortFields[0]);
			Zotero.Prefs.clear('fallbackSort');
		}

		// Restore open state — _toggleOpenState() sorts children
		// using _compareRows() with the same sort state
		this.refreshRowMap();
		this._restoreOpenState(openIDs);
	}

	/**
	 * Sort rows and trigger view update.
	 * @param {number[]|null} itemIDs - Specific items to sort, or null for full sort
	 */
	sort(itemIDs) {
		this.itemTree._cacheState();
		this._sort(itemIDs);
		this.runListeners('update', true, { restoreSelection: true });
	}

	/**
	 * Called by ItemTree.notify() for changes that require data/row mutations
	 * (e.g. adding, removing, or restructuring rows). Visual-only updates
	 * (redraws, tag color changes, column resets) are handled by ItemTree.notify()
	 * directly.
	 *
	 * Base implementation handles cache clearing for refresh/modify actions,
	 * and on modify also re-sorts changed rows and invalidates the whole view.
	 * Subclasses should override to handle adds,
	 * removes, and collection-specific logic if required.
	 */
	async notify(action, type, ids, extraData) {
		if (action == 'refresh') {
			// Clear row display cache and invalidate rows for refreshed items
			let rowsToInvalidate = [];
			let idsToInvalidate = [];
			for (let id of ids) {
				let row = this._rowMap[id];
				if (row === undefined) continue;
				idsToInvalidate.push(id);
				rowsToInvalidate.push(row);
			}
			this.itemTree.invalidateRowCache(idsToInvalidate);
			await this.runListeners('update', rowsToInvalidate);
			return;
		}

		if (['item', 'collection', 'search'].includes(type) && action == 'modify') {
			// Clear row display cache, re-sort modified rows, and redraw the whole tree.
			// A modified row can move, which shifts many surrounding rows.
			this.itemTree.invalidateRowCache(ids);
			await this.itemTree._ensureSortContextReady();
			this._sort(ids);
			await this.runListeners('update', true, {
				restoreSelection: true,
				restoreScroll: true
			});
			return;
		}

		// For remove/delete/trash: log if items are currently displayed
		if (action == 'remove' || action == 'delete' || action == 'trash') {
			let displayedIds = ids.filter(id => this._rowMap[id] !== undefined);
			if (displayedIds.length) {
				Zotero.debug(`ItemTreeRowProvider.notify: ${action} on displayed items: ${displayedIds.join(', ')}. Subclass should handle removal.`);
			}
			return;
		}
	}
}

var ItemTree = class ItemTree extends LibraryTree {
	static async init(domEl, opts={}) {
		Zotero.debug(`Initializing React ${this.name} ${opts.id}`);
		var ref;
		opts.domEl = domEl;
		let itemTreeMenuBar = null;
		// Add a menubar with View options to manipulate the table (only if a menubar doesn't already exist in .xhtml)
		if (!document.querySelector("menubar")) {
			itemTreeMenuBar = document.createXULElement("item-tree-menu-bar");
			document.documentElement.prepend(itemTreeMenuBar);
		}
		await new Promise((resolve) => {
			ReactDOM.createRoot(domEl).render(<this ref={(c) => {
				ref = c;
				resolve();
			} } {...opts} />);
		});
		
		if (itemTreeMenuBar) {
			itemTreeMenuBar.init(ref);
		}
		Zotero.debug(`React ${this.name} ${opts.id} initialized`);
		return ref;
	}
	
	static defaultProps = {
		dragAndDrop: false,
		columnPicker: false,
		regularOnly: false,
		multiSelect: true,
		shouldListenForNotifications: true,
		columns: COLUMNS,
		onContextMenu: noop,
		onActivate: noop,
		emptyMessage: '',
		getExtraField: noop,
		filterChildItems: null,
		compareItems: () => 0,
	};

	static propTypes = {
		id: PropTypes.string.isRequired,
		
		dragAndDrop: PropTypes.bool,
		columnPicker: PropTypes.bool,
		regularOnly: PropTypes.bool,
		multiSelect: PropTypes.bool,
		shouldListenForNotifications: PropTypes.bool,
		columns: PropTypes.array,
		onSelectionChange: PropTypes.func,
		onContextMenu: PropTypes.func,
		onActivate: PropTypes.func,
		emptyMessage: PropTypes.string,
		getExtraField: PropTypes.func,
		// TODO: This is a bad pattern after item tree refactor and needs to be fixed (should not be used as an example)
		filterChildItems: PropTypes.func,
		// A master sorting function. If it returns 0 then default sorting priorities take over
		compareItems: PropTypes.func,
	};
	
	constructor(props) {
		super(props);

		this.type = 'item';
		this.name = 'ItemTree';
		this._id = "item-tree-" + props.id;
		
		this._skipKeypress = false;
		this._initialized = false;
		
		this._needsSort = false;
		this._introText = null;
		
		this._highlightedRows = new Set();
		this._cachedSelection = [];
		this._cachedScrollPosition = null;
		
		this._modificationLock = Zotero.Promise.resolve();
		this._dropRow = null;
		this._rowCache = {};
		
		this.rowProvider = new ItemTreeRowProvider(this);
		this._renderCtx = {
			renderCell: (...args) => this._renderCell(...args),
			firstColumn: null,
			includeTrashed: false,
			invalidateRow: (index) => this.tree?.invalidateRow(index),
		};

		if (props.shouldListenForNotifications) {
			this._unregisterID = Zotero.Notifier.registerObserver(
				this,
				['item', 'collection-item', 'item-tag', 'share-items', 'bucket', 'feedItem', 'search', 'itemtree', 'collection'],
				'itemTreeView',
				50
			);
		}
		this._prefsObserverIDs = [
			Zotero.Prefs.registerObserver('recursiveCollections', this.refreshAndMaintainSelection.bind(this)),
			Zotero.Prefs.registerObserver('showAttachmentFilenames', () => {
				this.invalidateRowCache(true);
				this.tree.invalidate();
			}),
			Zotero.Prefs.registerObserver('hideContextAnnotationRows', async () => {
				await this.refresh();
				this.tree.invalidate();
			}),
		];
		
		this._itemsPaneMessage = null;
		
		this._columnsId = null;
		this._sortContextReadyPromise = Zotero.Promise.resolve();

		// Initial deferred to be resolved on componentDidMount()
		this._itemTreeLoadingDeferred = Zotero.Promise.defer();
		this._loadingDeferredResolved = false;
		
		this._setRowProviderUpdateHandler();
	}

	get id() {
		return this._id;
	}

	/**
	 * Set a new ID for the item tree.
	 * @param newId
	 * @returns {Promise<boolean>} True if the ID was changed
	 */
	async setId(newId) {
		if (this._id === newId) {
			await this._ensureSortContextReady();
			return false;
		}

		// Save current columns (only if we have an existing id)
		if (this._id != null && this.props.columnPicker) {
			await this._writeColumnPrefsToFile(true);
		}

		this._id = newId;

		if (!this.props.columnPicker) {
			this._sortContextReadyPromise = Zotero.Promise.resolve();
			return;
		}

		this._sortContextReadyPromise = (async () => {
			await this._loadColumnPrefsFromFile();
			// Force columns/sort metadata to be rebuilt from newly loaded prefs
			this._columnsId = null;
			this._sortedColumn = null;
			// Initialize columns once so _sortedColumn is ready before first sort
			this._getColumns();
		})();
		await this._sortContextReadyPromise;
		return true;
	}

	async _ensureSortContextReady() {
		await this._sortContextReadyPromise;
	}

	get visibilityGroup() {
		return 'default';
	}

	get isSortable() {
		return true;
	}

	get hasDependOnChildrenColumn() {
		return this._hasDependOnChildrenColumn;
	}

	/**
	 * Invalidate cached row display data.
	 * @param {number[]|boolean} ids - Array of item IDs to invalidate,
	 *   or `true` to clear the entire cache.
	 */
	invalidateRowCache(ids) {
		if (ids === true) {
			this._rowCache = {};
		}
		else {
			for (let id of ids) {
				delete this._rowCache[id];
			}
		}
	}

	// Backward compatibility proxies
	get _rows() { return this.rowProvider.rows; }
	get _rowMap() { return this.rowProvider.rowMap; }
	get _searchMode() { return this.rowProvider.searchMode; }
	get _searchItemIDs() { return this.rowProvider.searchItemIDs; }

	// Row access proxies
	getRow(index) { return this.rowProvider.getRow(index); }
	getRowCount() { return this.rowProvider.getRowCount(); }
	getRowIndexByID(id) { return this.rowProvider.getRowIndexByID(id); }
	getLevel(index) { return this.rowProvider.getLevel(index); }
	isContainer(index) { return this.rowProvider.isContainer(index); }
	isContainerOpen(index) { return this.rowProvider.isContainerOpen(index); }
	isContainerEmpty(index) { return this.rowProvider.isContainerEmpty(index); }
	expandAllRows(acrossAllLevels = false) {
		return this.rowProvider.expandAllRows(acrossAllLevels);
	}
	collapseAllRows(acrossAllLevels = false) {
		return this.rowProvider.collapseAllRows(acrossAllLevels);
	}
	
	_setRowProviderUpdateHandler() {
		this.rowProvider.onUpdate.addListener(async (...args) => {
			// Create a new deferred if the view is currently settled.
			// This ensures waitForLoad() has something to wait on.
			// Leave any existing unresolved deferred in place
			if (this._loadingDeferredResolved) {
				this._loadingDeferredResolved = false;
				this._itemTreeLoadingDeferred = Zotero.Promise.defer();
			}
			const result = await this.handleRowModelUpdate(...args);

			if (result) {
				this._loadingDeferredResolved = true;
				this._itemTreeLoadingDeferred.resolve();
			}
			return result;
		});
	}

	unregister() {
		this._uninitialized = true;
		Zotero.Notifier.unregisterObserver(this._unregisterID);
		for (let id of this._prefsObserverIDs) {
			Zotero.Prefs.unregisterObserver(id);
		}
		this._writeColumnPrefsToFile(true);
	}

	componentDidMount() {
		this._initialized = true;
		this._loadingDeferredResolved = true;
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
		Zotero.debug('clearItemsPaneMessage called, current message: ' + !!this._itemsPaneMessage);
		const shouldRerender = this._itemsPaneMessage;
		this._itemsPaneMessage = null;
		return shouldRerender && new Promise(resolve => this.forceUpdate(resolve));
	}
	
	refresh = Zotero.serial(async function (options) {
		return this.rowProvider.refresh(options);
	})

	_cacheState() {
		this._cachedSelection = this.getSelectedObjects();
		this._cachedScrollPosition = this._saveScrollPosition();
	}

	/**
	 * NOTE: This method must not trigger further update events (e.g. by calling
	 * sort() or refresh()) to avoid recursive update loops and UI flashing.
	 *
	 * @param {Object[]|boolean} rows - The rows that need redrawing/invalidating. If true, invalidate the whole tree.
	 * @param {Object} options
	 * @param {Object[]|Object} options.selection - The selection to restore.
	 * @param {boolean} options.selectInActiveWindow - Whether to select the items in the active window.
	 * @param {boolean} options.restoreSelection - Whether to restore the cached selection.
	 * @param {boolean} options.ensureRowsAreVisible - Whether to ensure selected rows are visible.
	 * @param {boolean} options.restoreScroll - Whether to restore the cached scroll position.
	 * @param {boolean} options.loading - Whether to show loading state (hides tree, shows message).
	 * @param {string} options.message - Optional message to display (for loading, errors, intro text).
	 */
	async handleRowModelUpdate(rows, options = {
		selection: null,
		selectInActiveWindow: false,
		restoreSelection: false,
		expandCollapsedParents: true,
		ensureRowsAreVisible: true,
		restoreScroll: false,
		loading: false,
		message: null,
	}) {
		// Handle loading/message state
		if (options.loading) {
			options.message ||= Zotero.getString('pane.items.loading');
			this.selection.clearSelection();
			this.selection.focused = 0;
		}
		if (options.message) {
			await this.setItemsPaneMessage(options.message);
			return false; // Not complete and deferred unresolved — completion call will come later
		}

		if (this._itemsPaneMessage) {
			await this.clearItemsPaneMessage();
			// Reset scrollbar to top (at end of loading/showing message)
			this._treebox && this._treebox.scrollTo(0);
		}

		if (rows === true) {
			if (this.tree) {
				this.tree.invalidate();
			}
		}
		else if (Array.isArray(rows)) {
			rows.forEach(row => this.tree.invalidateRow(row));
		}

		const itemsViewInActiveWindow = Zotero.getActiveZoteroPane()?.itemsView == this;
		const prioritizeRestore = !(options.selectInActiveWindow && itemsViewInActiveWindow);
		const ensureVisible = options.restoreScroll ? false : options.ensureRowsAreVisible;

		if (prioritizeRestore && options.restoreSelection) {
			this._restoreSelection(null, options.expandCollapsedParents, ensureVisible);
		}
		else if (options.selection) {
			if (Array.isArray(options.selection)) {
				this.selectItems(options.selection, options.expandCollapsedParents, !ensureVisible);
			}
			else {
				this.selectItem(options.selection, options.expandCollapsedParents, !ensureVisible);
			}
		}

		if (options.restoreScroll) {
			this._restoreScrollPosition();
		}

		// Allow selection events to propagate and redraw the needed rows
		this.selection.selectEventsSuppressed = false;

		return true;
	}

	/**
	 * Called by Zotero.Notifier on any changes to items in the data layer.
	 *
	 * Handles visual-only updates (redraws, tag colors, column resets) directly.
	 * Delegates data/row mutations to rowProvider.notify() for changes that
	 * require adding, removing, or restructuring rows.
	 */
	async notify(action, type, ids, extraData) {
		// Reset columns on custom column change
		if (type === "itemtree" && action === "refresh") {
			await this._resetColumns();
			await this.refreshAndMaintainSelection();
			return;
		}

		// Clear item type icon and tag colors when a tag is added to or removed from an item
		if (type == 'item-tag') {
			// TODO: Only update if colored tag changed?
			let rowsToInvalidate = ids.map(val => val.split("-")[0])
				.map(val => this._rowMap[val])
				.filter(row => row !== undefined);
			rowsToInvalidate.forEach(row => this.tree.invalidateRow(row));
			return;
		}

		// Redraw the tree (for tag color and progress changes)
		if (action == 'redraw') {
			// Redraw specific rows
			if (type == 'item' && ids.length) {
				let rowsToInvalidate = ids.map(id => this._rowMap[id]).filter(row => row !== undefined);
				rowsToInvalidate.forEach(row => this.tree.invalidateRow(row));
			}
			// Redraw the whole tree
			else {
				this.tree.invalidate();
			}
			return;
		}
		
		this._cacheState();

		await this.rowProvider.notify(action, type, ids, extraData);
	}
	
	handleActivate(event, indices) {
		let items = indices.map(index => this.getRow(index).ref);
		this.props.onActivate(event, items);
	}

	/**
	 * @param event {InputEvent}
	 * @returns {boolean} false to prevent any handling by the virtualized-table
	 */
	handleKeyDown(event) {
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
		if (event.key == '+' && !(event.ctrlKey || event.altKey || event.metaKey)) {
			this.rowProvider.expandAllRows();
			return false;
		}
		else if (event.key == '-' && !(event.shiftKey || event.ctrlKey
			|| event.altKey || event.metaKey)) {
			this.rowProvider.collapseAllRows();
			return false;
		}
		return true;
	}

	/**
	 * Select the first row when the tree is focused by the keyboard.
	 */
	handleKeyUp = (event) => {
		if (!Zotero.locked && (event.code === 'Tab' || event.key.includes("Arrow")) && this.selection.count == 0) {
			this.selection.select(this.selection.focused);
		}
	};

	_renderItemsPaneMessage(showMessage) {
		const itemsPaneMessageHTML = this._itemsPaneMessage || this.props.emptyMessage;
		return (<div
			key="items-pane-message"
			onDragOver={e => this.props.dragAndDrop && this.onDragOver(e, -1)}
			onDrop={e => this.props.dragAndDrop && this.onDrop(e, -1)}
			onClick={(e) => {
				if (e.target.dataset.href) {
					window.ZoteroPane.loadURI(e.target.dataset.href);
				}
				if (e.target.dataset.action == 'open-sync-prefs') {
					Zotero.Utilities.Internal.openPreferences('zotero-prefpane-account');
				}
			}}
			className={"items-tree-message"}
			style={{ display: showMessage ? "flex" : "none" }}
			dangerouslySetInnerHTML={{ __html: itemsPaneMessageHTML }}>
		</div>);
	}

	render() {
		const showMessage = !!this._itemsPaneMessage;
		const itemsPaneMessage = this._renderItemsPaneMessage(showMessage);

		let virtualizedTable = React.createElement(VirtualizedTree,
			{
				getRowCount: () => this.rowProvider.getRowCount(),
				id: this.id,
				ref: ref => this.tree = ref,
				treeboxRef: ref => this._treebox = ref,
				renderItem: this._renderItem.bind(this),
				hide: showMessage,
				key: "virtualized-table",

				showHeader: true,
				columns: this._getColumns(),
				onColumnPickerMenu: this._displayColumnPickerMenu.bind(this),
				onColumnSort: this.isSortable ? this._handleColumnSort : null,
				getColumnPrefs: this._getColumnPrefs.bind(this),
				storeColumnPrefs: this._storeColumnPrefs.bind(this),
				getDefaultColumnOrder: this._getDefaultColumnOrder.bind(this),
				containerWidth: this.domEl.clientWidth,
				firstColumnExtraWidth: 16 + 16 + 4, // 16px for twisty, 16px for icon + 4px for margin-right

				multiSelect: this.props.multiSelect,

				onSelectionChange: this._handleSelectionChange.bind(this),
				isSelectable: this.isSelectable.bind(this),
				getParentIndex: this.getParentIndex.bind(this),
				isContainer: this.isContainer.bind(this),
				isContainerEmpty: this.isContainerEmpty.bind(this),
				isContainerOpen: this.isContainerOpen.bind(this),
				onToggleOpenState: this.onToggleOpenState.bind(this),

				getRowString: this.getRowString.bind(this),

				onDragOver: e => this.props.dragAndDrop && this.onDragOver(e, -1),
				onDrop: e => this.props.dragAndDrop && this.onDrop(e, -1),
				onKeyDown: this.handleKeyDown.bind(this),
				onKeyUp: this.handleKeyUp.bind(this),
				onActivate: this.handleActivate.bind(this),

				onItemContextMenu: (...args) => this.props.onContextMenu(...args),
				
				role: 'tree',
				label: Zotero.getString('pane.items.title'),
			}
		);
		Zotero.debug(`itemTree.render(). Displaying ${showMessage ? "Item Pane Message" : "Item Tree"}`);

		return [
			itemsPaneMessage,
			virtualizedTable
		];
	}

	// TODO investigate usage
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
	
	async selectItems(ids, noRecurse, noScroll) {
		if (!ids.length) return 0;
		
		var idsToSelect = [];
		for (let id of ids) {
			let row = this._rowMap[id];
			
			// If row with id isn't visible, check to see if it's hidden under a parent
			if (row == undefined) {
				await this.expandToItem(id);
				if (!this._rowMap[id]) {
					// The row is still not found
					// Clear the quick search and tag selection and try again (once)
					if (!noRecurse && window.ZoteroPane) {
						let hasQuickSearch = !!this.collectionTreeRow.searchText;
						let hasTagFilters = this.collectionTreeRow.tags?.size > 0;
						if (hasQuickSearch || hasTagFilters) {
							// Clear all searches set on the collection tree row directly on
							// collectionTreeRow (vs using ZoteroPane functions) to avoid
							// refreshing the itemTree multiple times at the same time, which can lead
							// to tag selector not showing all tags after quickSearch is cleared
							this.collectionTreeRow.setTags(new Set());
							this.collectionTreeRow.setSearch('');
							// Clear quickSearch text field and tag selection without
							// rerunning search
							if (window.ZoteroPane.tagSelector) {
								window.ZoteroPane.tagSelector.clearTagSelection();
							}
							window.ZoteroPane.clearQuicksearch(true);
							// Rerun search and refresh the itemTree
							await this.refreshAndMaintainSelection();
							// Try to select the item(s) again
							return this.selectItems(ids, true);
						}
					}
					
					Zotero.debug(`Couldn't find row for item ${id} -- not selecting`);
					continue;
				}
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
			this._handleSelectionChange(this.selection, false);
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
		if (!noScroll) {
			this.ensureRowsAreVisible(rowsToSelect);
		}
		
		return rowsToSelect.length;
	}

	/*
	 *  Sort the items by the currently sorted column.
	 */
	async sort(itemIDs) {
		var t = new Date();

		await this._ensureSortContextReady();
		this.rowProvider.sort(itemIDs);
		await this.waitForLoad();

		var numSorted = itemIDs ? itemIDs.length : this._rows.length;
		Zotero.debug(`Sorted ${numSorted} ${Zotero.Utilities.pluralize(numSorted, ['item', 'items'])} `
			+ `in ${new Date() - t} ms`);
	}

	/**
	 * Set a filter on the item tree.
	 * @param {string} type - Filter type ('search', 'citation-search', 'tags')
	 * @param {*} data - Filter data
	 */
	async setFilter(type, data) {
		throw new Error('setFilter not implemented');
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
	
	async setHighlightedRows(ids) {
		if (!Array.isArray(ids)) {
			return;
		}
		this._highlightedRows = new Set(ids);
		this.tree.invalidate();
	}
	
	closeContainer(index, skipRowMapRefresh=false) {
		if (!this.isContainerOpen(index)) return;
		return this.toggleOpenState(index, skipRowMapRefresh);
	}

	openContainer(index, skipRowMapRefresh=false) {
		if (this.isContainerOpen(index)) return;
		return this.toggleOpenState(index, skipRowMapRefresh);
	}
	
	toggleOpenState(index, skipRowMapRefresh=false) {
		return this.tree.toggleOpenState(index, skipRowMapRefresh);
	}

	onToggleOpenState(index, skipRowMapRefresh=false) {
		// Shouldn't happen but does if an item is dragged over a closed
		// container until it opens and then released, since the container
		// is no longer in the same place when the spring-load closes
		if (!this.isContainer(index)) {
			return;
		}
		
		this._cacheState();
		return this.rowProvider.toggleOpenState(index, skipRowMapRefresh);
	}

	expandSelectedRows() {
		this._cacheState();
		let rowsToOpen = [];
		for (const index of this.selection.selected) {
			if (this.isContainer(index) && !this.isContainerOpen(index)) {
				rowsToOpen.push(index);
			}
		}
		this.rowProvider.expandRows(rowsToOpen);
	}

	collapseSelectedRows() {
		this._cacheState();
		let rowsToClose = [];
		for (const index of this.selection.selected) {
			if (this.isContainer(index)) {
				rowsToClose.push(index);
			}
		}
		this.rowProvider.collapseRows(rowsToClose);
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
		let row = this.getRow(index);
		if (row.ref.isFeedItem) {
			return this.getCellText(index, 'title');
		}
		return this.getCellText(index, this.getSortField());
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
	isSelectable(index, selectAll=false) {
		// Override in subclasses
		return true;
	}
	
	isContainer = (index) => this.rowProvider.isContainer(index);

	isContainerOpen = (index) => this.rowProvider.isContainerOpen(index);

	isContainerEmpty = (index) => this.rowProvider.isContainerEmpty(index);

	getLevel = (index) => this.rowProvider.getLevel(index);

	// Expand all ancestors of the specified item id
	async expandToItem(id) {
		this.rowProvider.expandToItem(id);
		await this.waitForLoad();
	}

	////////////////////////////////////////////////////////////////////////////////
	//
	//  Drag and Drop - override in subclasses for full implementation
	//
	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Start a drag using HTML 5 Drag and Drop.
	 * Base implementation - override in subclasses for full functionality.
	 */
	onDragStart(event, index) {
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

		Zotero.Utilities.Internal.onDragItems(event, itemIDs, this._dragImageContainer);
	};

	/**
	 * Handle drag over event.
	 * Base implementation - override in subclasses for full functionality.
	 */
	onDragOver(event, row) {
		event.preventDefault();
		event.stopPropagation();
		this.setDropEffect(event, "none");
		return false;
	};

	onDragEnd() {
		this._dragImageContainer.innerHTML = "";
		this._dropRow = null;
		this.tree.invalidate();
	};

	onDragLeave() {
		let dropRow = this._dropRow;
		this._dropRow = null;
		if (dropRow !== null) {
			this.tree.invalidateRow(dropRow);
		}
	};


	/**
	 * Handle drop event.
	 * Base implementation does nothing - override in subclasses.
	 */
	async onDrop(event, row) {
		// Base implementation - override in subclasses
	};

	// //////////////////////////////////////////////////////////////////////////////
	//
	//  Menu utilities for ZoteroPane
	//
	// //////////////////////////////////////////////////////////////////////////////

	_buildColumnPickerMenu(menupopup, prefix, columns) {
		let columnMenuitemElements = {};
		// Build menuitem entries for all columns
		for (let i = 0; i < columns.length; i++) {
			const column = columns[i];
			// Filter out columns that are not shown in the column picker
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
			if (column.disabledIn && column.disabledIn.includes(this.visibilityGroup)) {
				menuitem.setAttribute('disabled', true);
			}
			columnMenuitemElements[column.dataKey] = menuitem;
			menupopup.appendChild(menuitem);
		}

		try {
			// Move columnPickerSubMenu columns to a "More Columns" submenu
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
	}

	_buildSecondarySortMenu(menupopup, prefix, columns) {
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

	_buildMoveColumnMenu(menupopup, prefix, columns) {
		let sep = document.createXULElement('menuseparator');
		// sep.setAttribute('anonid', prefix + 'sep');
		menupopup.appendChild(sep);

		//
		// Move Column Left
		//
		let moveColumnMenu = document.createXULElement('menu');
		document.l10n.setAttributes(
			moveColumnMenu,
			Zotero.rtl ? 'menu-view-columns-move-right' : 'menu-view-columns-move-left'
		);
		moveColumnMenu.setAttribute('anonid', prefix + 'move-column');
		let moveColumnPopup = document.createXULElement('menupopup');
		moveColumnPopup.setAttribute('anonid', prefix + 'move-column-popup');
		moveColumnMenu.appendChild(moveColumnPopup);
		menupopup.appendChild(moveColumnMenu);

		let firstColumn = true;
		// Only list visible columns
		for (let i = 0; i < columns.length; i++) {
			let column = columns[i];
			if (column.hidden) continue;
			// Skip first column (since there is nowhere to move it)
			if (firstColumn) {
				firstColumn = false;
				continue;
			}
			let label = formatColumnName(column);
			let menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', label);
			menuitem.setAttribute('colindex', i);
			// Swap the column with its previous visible neighbor
			menuitem.addEventListener('command', () => {
				let previousIndex = columns.findLastIndex((col, index) => index < i && !col.hidden);
				this.tree._columns.setOrder(i, previousIndex);
			});
			moveColumnPopup.appendChild(menuitem);
		}
		//
		// Restore Default Column Order
		//
		let menuitem = document.createXULElement('menuitem');
		menuitem.setAttribute('label', Zotero.getString('zotero.items.restoreColumnOrder.label'));
		menuitem.setAttribute('anonid', prefix + 'restore-order');
		menuitem.addEventListener('command', () => this.tree._columns.restoreDefaultOrder());
		menupopup.appendChild(menuitem);
	}
	
	buildColumnPickerMenu(menupopup) {
		if (!this.props.columnPicker) return;
		const prefix = 'zotero-column-picker-';
		const columns = this._getColumns();

		const columnMenuitemElements = this._buildColumnPickerMenu(menupopup, prefix, columns);
		if (this.isSortable) {
			this._buildSecondarySortMenu(menupopup, prefix, columns);
		}
		this._buildMoveColumnMenu(menupopup, prefix, columns);
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
	
	_renderItem(index, selection, oldDiv = null, columns = []) {
		let row = this.getRow(index);
		let rowData = this._getRowData(index);
		let div;
		if (oldDiv) {
			div = oldDiv;
			div.innerHTML = "";
		}
		else {
			div = document.createElement('div');
			div.className = 'row';
		}

		// Toggle these here rather than in ItemTreeRow.renderRow()
		// because div elements are reused to reduce DOM churn and need resetting
		div.classList.toggle('selected', selection.isSelected(index));
		div.classList.toggle('first-selected', selection.isFirstRowOfSelectionBlock(index));
		div.classList.toggle('last-selected', selection.isLastRowOfSelectionBlock(index));
		div.classList.toggle('focused', selection.focused == index);
		div.classList.remove('drop', 'drop-before', 'drop-after');
		div.classList.toggle('context-row', !!rowData.contextRow);
		div.classList.toggle('unread', !!rowData.unread);
		div.classList.toggle('highlighted', this._highlightedRows.has(rowData.id));
		let nextRowID = this.getRow(index + 1)?.id;
		let prevRowID = this.getRow(index - 1)?.id;
		div.classList.toggle('first-highlighted', this._highlightedRows.has(rowData.id) && !this._highlightedRows.has(prevRowID));
		div.classList.toggle('last-highlighted', this._highlightedRows.has(rowData.id) && !this._highlightedRows.has(nextRowID));
		div.classList.toggle('annotation-row', row.type === 'annotation');
		if (row.type !== 'annotation') {
			div.classList.remove('tight');
		}
		
		if (this._dropRow == index) {
			let span;
			if (Zotero.DragDrop.currentOrientation != 0) {
				span = document.createElement('span');
				span.className = Zotero.DragDrop.currentOrientation < 0 ? 'drop-before' : 'drop-after';
				div.appendChild(span);
			}
			else {
				div.classList.add('drop');
			}
		}

		let { firstColumn } = columns.reduce((acc, column) => {
			return !column.hidden && column.ordinal < acc.lowestOrdinal
				? { lowestOrdinal: column.ordinal, firstColumn: column }
				: acc;
		}, { lowestOrdinal: Infinity, firstColumn: null });

		this._renderCtx.firstColumn = firstColumn;
		this._renderCtx.includeTrashed = this.rowProvider.includeTrashed;

		row.renderRow(div, index, columns, rowData, this._renderCtx);

		if (!oldDiv) {
			if (this.props.dragAndDrop && row.isDraggable) {
				div.setAttribute('draggable', true);
				div.addEventListener('dragstart', e => this.onDragStart(e, index), { passive: true });
				div.addEventListener('dragover', e => this.onDragOver(e, index));
				div.addEventListener('dragend', this.onDragEnd.bind(this), { passive: true });
				div.addEventListener('dragleave', this.onDragLeave.bind(this), { passive: true });
				div.addEventListener('drop', (e) => {
					e.stopPropagation();
					this.onDrop(e, index);
				}, { passive: true });
			}
			div.addEventListener('mousedown', this._handleRowMouseUpDown.bind(this), { passive: true });
			div.addEventListener('mouseup', this._handleRowMouseUpDown.bind(this), { passive: true });
		}

		if (rowData.contextRow) {
			div.setAttribute('aria-disabled', true);
		}

		return div;
	}

	_renderCell(index, data, column, isFirstColumn) {
		const row = this.getRow(index);
		let cell;

		if (column.renderCell) {
			try {
				// Pass document to renderCell so that it can create elements
				cell = column.renderCell.apply(this, [index, data, column, isFirstColumn, document]);
				if (!(cell instanceof window.Element)) {
					cell = null;
					throw new Error('renderCell must return an Element');
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
			column = Object.assign({}, column, { renderCell: null });
		}

		if (!cell) {
			cell = row.renderCell(index, data, column, isFirstColumn, this._renderCtx);
		}

		if (isFirstColumn) {
			const icon = row.getIcon();
			icon.classList.add('cell-icon', 'item-icon');

			if (cell.querySelector('.cell-text') === null) {
				let textSpan = document.createElement('span');
				textSpan.className = 'cell-text';
				textSpan.innerHTML = cell.innerHTML;
				cell.innerHTML = '';
				cell.append(textSpan);
			}

			cell.prepend(icon);
			cell.classList.add('first-column');
		}

		return cell;
	}


	_handleRowMouseUpDown(event) {
		// Base implementation - override in subclasses for special behavior
	}

	_handleSelectionChange(selection, shouldDebounce) {
		if (shouldDebounce) {
			this._onSelectionChangeDebounced();
		}
		else {
			this._onSelectionChange();
		}
	}


	/**
	 * Returns an object describing the row data for each column.
	 * The keys are column dataKey properties and the entries are the corresponding data.
	 * @param index {Integer} the row index
	 * @returns {Object}
	 */
	_getRowData(index) {
		var treeRow = this.getRow(index);
		if (!treeRow) {
			throw new Error(`Attempting to get row data for a non-existant tree row ${index}`);
		}
		var itemID = treeRow.id;
		
		// If value is available, retrieve immediatelly
		if (this._rowCache[itemID]) {
			return this._rowCache[itemID];
		}
		
		let row = {
			id: itemID,
			// Not a collection or search in the trash
			isItem: treeRow.ref instanceof Zotero.Item
		};
		
		// Mark items not matching search as context rows, displayed in gray
		if (row.isItem && this._searchMode && !this._searchItemIDs.has(itemID)) {
			row.contextRow = true;
		}
		
		row.hasAttachment = "";
		// Style unread items in feeds
		if (treeRow.ref.isFeedItem && !treeRow.ref.isRead) {
			row.unread = true;
		}
		
		row.itemType = treeRow.getTypeLabel();
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
		row.lastRead = row.isItem ? treeRow.ref.getItemLastRead() : "";
		row.addedBy = row.isItem && treeRow.getAddedBy();
		row.lastModifiedBy = row.isItem && treeRow.getLastModifiedBy();
		row.title = treeRow.getDisplayTitle();
		
		const columns = this.getColumns();
		for (let col of columns) {
			let key = col.dataKey;
			let val = row[key];
			if (val === undefined) {
				let customRowValue = this.props.getExtraField(treeRow.ref, key);
				if (customRowValue !== undefined) {
					val = customRowValue;
				}
				else {
					val = treeRow.getField(key);
				}
			}
			
			switch (key) {
			// Format dates as short dates in proper locale order and locale time
			// (e.g. "4/4/07 14:27:23")
			case 'dateAdded':
			case 'dateModified':
			case 'accessDate':
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
				break;
			case 'lastRead':
				if (val) {
					let date = new Date(val * 1000);
					val = date.toLocaleString();
				}
				break;
			}
			row[key] = val;
		}
		return this._rowCache[itemID] = row;
	}

	_getColumnPrefs = () => {
		if (!this.props.columnPicker) return {};
		return this._columnPrefs || {};
	}

	_storeColumnPrefs = (prefs) => {
		// Even if we don't persist column info we still need to store it on the itemTree instance
		// otherwise sorting and such breaks after dragging columns
		this._columns = this._columns.map(column => Object.assign(column, prefs[column.dataKey]))
			.sort((a, b) => a.ordinal - b.ordinal);
		
		if (!this.props.columnPicker) return;
		Zotero.debug(`Storing itemTree ${this.id} column prefs`, 2);
		// Preserve prefs for columns not active in the current view (e.g.,
		// group-only columns when viewing a personal library)
		if (this._columnPrefs) {
			for (let [key, val] of Object.entries(this._columnPrefs)) {
				if (!(key in prefs) && COLUMNS.some(c => c.dataKey === key)) {
					prefs[key] = val;
				}
			}
		}
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
		if (!this.props.columnPicker) return;
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
		if (!this.props.columnPicker) return;
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
		const visibilityGroup = this.visibilityGroup;
		const prefKey = this.id;
		// Include group status in cache key so groupLibrariesOnly columns
		// are recalculated when switching between personal and group libraries
		let cacheKey = prefKey
			+ (this.collectionTreeRow.isWithinGroup?.() ? '-group' : '');
		if (this._columnsId == cacheKey) {
			return this._columns;
		}

		this._columnsId = prefKey;
		this._columns = [];
		
		let columnsSettings = this._getColumnPrefs();

		// Refresh columns from itemTreeColumns
		const columns = this.getColumns();
		let hasDefaultIn = columns.some(column => 'defaultIn' in column);
		for (let column of columns) {
			if (this.props.columnPicker) {
				if (column.disabledIn && column.disabledIn.includes(visibilityGroup)) continue;
				if (column.groupLibrariesOnly && (!this.collectionTreeRow.isWithinGroup || !this.collectionTreeRow.isWithinGroup())) continue;
				const columnSettings = columnsSettings[column.dataKey];
				if (!columnSettings && this.id === 'main') {
					column = this._setLegacyColumnSettings(column);
				}

				// Also includes a `hidden` pref and overrides the above if available
				column = Object.assign({}, column, columnSettings || {});
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
				if (hasDefaultIn && visibilityGroup) {
					column.hidden = !(column.defaultIn && column.defaultIn.includes(visibilityGroup));
				}
				else {
					column.hidden = false;
				}
			}
			if (column.sortDirection) {
				this._sortedColumn = column;
			}
			if (!column.hidden && column.dependsOnChildren) {
				this._hasDependOnChildrenColumn = true;
			}
			this._columns.push(column);
		}

		// Ensure at least one primary column is visible -- if a plugin hid
		// the Title column without providing its own, force-show it
		if (!this._columns.some(c => c.primary && !c.hidden)) {
			let title = this._columns.find(c => c.dataKey === 'title');
			if (title) {
				title.hidden = false;
			}
		}

		// Force sort indicator for views with a fixed sort order
		if (this.collectionTreeRow?.isRecentlyRead()) {
			let col = this._columns.find(c => c.dataKey === 'lastRead');
			if (col) {
				col.sortDirection = -1;
				this._sortedColumn = col;
			}
		}

		return this._columns.sort((a, b) => a.ordinal - b.ordinal);
	}
	
	_getColumn(index) {
		return this._getColumns()[index];
	}


	/**
	 * Restore scroll position from either a provided object or the cached scroll position.
	 * If scrollPosition is null, restores from cache and clears it.
	 * If scrollPosition is provided, restores from it without touching the cache.
	 *
	 * @param {Object|null} scrollPosition - Scroll position to restore, or null to use cached
	 */
	_restoreScrollPosition(scrollPosition = null) {
		if (scrollPosition === null) {
			scrollPosition = this._cachedScrollPosition;
			this._cachedScrollPosition = null;
		}
		if (!scrollPosition || !scrollPosition.id || !this._treebox) {
			return;
		}
		var row = this._rowMap[scrollPosition.id];
		if (row === undefined) {
			return;
		}
		this._treebox.scrollToRow(Math.max(row - scrollPosition.offset, 0), true);
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
		if (first === undefined || first === null) {
			return false;
		}
		var last = treebox.getLastVisibleRow();
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

		// With no selection to anchor to, don't save a scroll position when the
		// view is already at the top of the list. Otherwise restoring after an
		// insertion would pin the previously-top row in place (pushing the view
		// down) instead of leaving the list scrolled to its new top.
		if (!first) {
			return false;
		}

		// Otherwise keep the first visible row in position
		let row = this.getRow(first);
		if (!row) return false;
		return {
			id: row.ref.treeViewID,
			offset: 0
		};
	}

	/**
	 * Restore selection from either a provided array or the cached selection.
	 * If selection is null, restores from cache and clears it.
	 * If selection is provided, restores from it without touching the cache.
	 *
	 * @param {Array|null} selection - Selection to restore, or null to use cached selection
	 * @param {Boolean} expandCollapsedParents - if an item to select is in a collapsed parent
	 * 					will expand the parent, otherwise the item is ignored
	 * @param {Boolean}	ensureRowsAreVisible - scroll the item tree after restoring selection
	 * 					to ensure restored selection is visible
	 * @private
	 */
	async _restoreSelection(selection = null, expandCollapsedParents = true, ensureRowsAreVisible = true) {
		if (selection === null) {
			selection = this._cachedSelection;
			this._cachedSelection = [];
		}
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
				if (this._rowMap[selection[i].treeViewID] !== undefined) {
					toggleSelect(selection[i].treeViewID);
				}
				else if (expandCollapsedParents && this.rowProvider._expandToItem(selection[i].treeViewID)) {
					// Try expanding to item
					toggleSelect(selection[i].treeViewID);
				}
				else {
					// Try selecting the parent (child gone in this view)
					var parent = selection[i].parentItemID;

					if (parent && this._rowMap[parent] !== undefined && !this.selection.isSelected(this._rowMap[parent])) {
						toggleSelect(parent);
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

		if (ensureRowsAreVisible) {
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
					let row = this.getRow(i);
					await row.getBestAttachmentState();
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
			event.screenX + 1,
			event.screenY + 1,
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
	
	/**
	 * Reset column state: invalidate the derived-columns cache, re-render the
	 * item tree so fresh props flow down, and rebuild the VirtualizedTable's
	 * internal `Columns` object.
	 *
	 * Does NOT refresh rows or restore selection. Callers that need row data
	 * refreshed (e.g. because column visibility affects what's shown) must
	 * either follow this with a refresh or call `refreshAndMaintainSelection`
	 * explicitly (see e.g. the custom-column change path in `notify()`).
	 */
	async _resetColumns(){
		this._columnsId = null;
		return new Promise((resolve) => this.forceUpdate(async () => {
			await this.tree._resetColumns();
			resolve();
		}));
	}
};

Zotero.Utilities.Internal.makeClassEventDispatcher(ItemTree);
Zotero.Utilities.Internal.makeClassEventDispatcher(ItemTreeRowProvider);

module.exports = ItemTree;
module.exports.ItemTreeRow = ItemTreeRow;
module.exports.ItemTreeRowProvider = ItemTreeRowProvider;
