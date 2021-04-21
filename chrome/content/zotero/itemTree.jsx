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
const { IntlProvider } = require('react-intl');
const LibraryTree = require('libraryTree');
const VirtualizedTable = require('components/virtualized-table');
const { renderCell, TreeSelectionStub } = VirtualizedTable;
const Icons = require('components/icons');
const { getDOMElement } = Icons;
const { COLUMNS } = require('itemTreeColumns');
const { Cc, Ci, Cu } = require('chrome');
Cu.import("resource://gre/modules/osfile.jsm");

const TYPING_TIMEOUT = 1000;
const CHILD_INDENT = 20;
const COLORED_TAGS_RE = new RegExp("^[0-" + Zotero.Tags.MAX_COLORED_TAGS + "]{1}$");

function makeItemRenderer(itemTree) {
	function renderPrimaryCell(index, data, column) {
		let span = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
		span.className = `cell ${column.className}`;
		span.classList.add('primary');
		
		// Add twisty, icon, tag swatches and retraction indicator
		let twisty;
		if (itemTree.isContainerEmpty(index)) {
			twisty = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
			twisty.classList.add("spacer-twisty");
		}
		else {
			twisty = getDOMElement("IconTwisty");
			twisty.classList.add('twisty');
			if (itemTree.isContainerOpen(index)) {
				twisty.classList.add('open');
			}
			twisty.style.pointerEvents = 'auto';
			twisty.addEventListener('mousedown', event => event.stopPropagation());
			twisty.addEventListener('mouseup', event => itemTree.handleTwistyMouseUp(event, index),
				{ passive: true });
		}
		
		const icon = itemTree._getIcon(index);
		icon.classList.add('cell-icon');
		
		const item = itemTree.getRow(index).ref;
		let retracted = "";
		if (Zotero.Retractions.isRetracted(item)) {
			retracted = getDOMElement('IconCross');
			retracted.classList.add("retracted");
		}
		
		let tags = item.getTagColors().map(color => itemTree._getTagSwatch(color));

		let textSpan = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
		textSpan.className = "cell-text";
		textSpan.innerText = data;

		span.append(twisty, icon, retracted, ...tags, textSpan);

		// Set depth indent
		const depth = itemTree.getLevel(index);
		span.style.paddingInlineStart = (CHILD_INDENT * depth) + 'px';
		
		return span;
	}
	
	function renderHasAttachmentCell(index, data, column) {
		let span = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
		span.className = `cell ${column.className}`;
		
		if (itemTree.collectionTreeRow.isTrash()) return span;

		const item = itemTree.getRow(index).ref;
		
		if ((!itemTree.isContainer(index) || !itemTree.isContainerOpen(index))
				&& Zotero.Sync.Storage.getItemDownloadImageNumber(item)) {
			return span;
		}
		
		if (itemTree.isContainer(index)) {
			if (item.isRegularItem()) {
				const state = item.getBestAttachmentStateCached();
				let icon = "";
				if (state === 1) {
					icon = getDOMElement('IconBulletBlue');
					icon.classList.add('cell-icon');
				}
				else if (state === -1) {
					icon = getDOMElement('IconBulletBlueEmpty');
					icon.classList.add('cell-icon');
				}
				span.append(icon);
				
				item.getBestAttachmentState()
				// TODO: With no cell refreshing this is possibly somewhat inefficient
				// Refresh cell when promise is fulfilled
				.then(bestState => bestState != state && itemTree.tree.invalidateRow(index));
			}
		}
		
		if (item.isFileAttachment()) {
			const exists = item.fileExistsCached();
			let icon = "";
			if (exists !== null) {
				icon = exists ? getDOMElement('IconBulletBlue') : getDOMElement('IconBulletBlueEmpty');
				icon.classList.add('cell-icon');
			}
			span.append(icon);
			
			item.fileExists()
			// TODO: With no cell refreshing this is possibly somewhat inefficient
			// Refresh cell when promise is fulfilled
			.then(realExists => realExists != exists && itemTree.tree.invalidateRow(index));
		}
		
		return span;
	}
	
	return function (index, selection, oldDiv=null, columns) {
		let div;
		if (oldDiv) {
			div = oldDiv;
			div.innerHTML = "";
		}
		else {
			div = document.createElementNS("http://www.w3.org/1999/xhtml", 'div');
			div.className = "row";
		}
		
		div.classList.toggle('selected', selection.isSelected(index));
		div.classList.remove('drop', 'drop-before', 'drop-after');
		const rowData = itemTree._getRowData(index);
		div.classList.toggle('context-row', !!rowData.contextRow);
		div.classList.toggle('unread', !!rowData.unread);
		if (itemTree._dropRow == index) {
			let span;
			if (Zotero.DragDrop.currentOrientation != 0) {
				span = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
				span.className = Zotero.DragDrop.currentOrientation < 0 ? "drop-before" : "drop-after";
				div.appendChild(span);
			} else {
				div.classList.add('drop');
			}
		}

		for (let column of columns) {
			if (column.hidden) continue;
			
			if (column.primary) {
				div.appendChild(renderPrimaryCell(index, rowData[column.dataKey], column));
			}
			else if (column.dataKey === 'hasAttachment') {
				div.appendChild(renderHasAttachmentCell(index, rowData[column.dataKey], column));
			}
			else {
				div.appendChild(renderCell(index, rowData[column.dataKey], column));
			}
		}
		
		if (!oldDiv) {
			if (itemTree.props.dragAndDrop) {
				div.setAttribute('draggable', true);
				div.addEventListener('dragstart', e => itemTree.onDragStart(e, index), { passive: true });
				div.addEventListener('dragover', e => itemTree.onDragOver(e, index));
				div.addEventListener('dragend', itemTree.onDragEnd, { passive: true });
				div.addEventListener('dragleave', itemTree.onDragLeave, { passive: true });
				div.addEventListener('drop', (e) => {
					e.stopPropagation();
					itemTree.onDrop(e, index);
				}, { passive: true });
			}
		}
		
		return div;
	};
}

var ItemTree = class ItemTree extends LibraryTree {
	static async init(domEl, opts={}) {
		Zotero.debug("Initializing React ItemTree");
		var ref;
		opts.domEl = domEl;
		let elem = (
			<IntlProvider locale={Zotero.locale} messages={Zotero.Intl.strings}>
				<ItemTree ref={c => ref = c } {...opts} />
			</IntlProvider>
		);
		await new Promise(resolve => ReactDOM.render(elem, domEl, resolve));
		
		Zotero.debug('React ItemTree initialized');
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
		
		this._typingString = "";
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
			['item', 'collection-item', 'item-tag', 'share-items', 'bucket', 'feedItem', 'search'],
			'itemTreeView',
			50
		);
		
		this._itemsPaneMessage = null;
		
		this._columnsId = null;
		this.columns = null;
		
		if (this.collectionTreeRow) {
			this.collectionTreeRow.view.itemTreeView = this;
		}
		
		this.renderItem = makeItemRenderer(this);
		
		this._itemTreeLoadingDeferred = Zotero.Promise.defer();
	}

	unregister() {
		this._uninitialized = true;
		Zotero.Notifier.unregisterObserver(this._unregisterID);
	}

	componentDidMount() {
		this._initialized = true;
		this._itemTreeLoadingDeferred.resolve();
		// Create an element where we can create drag images to be displayed next to the cursor while dragging
		// since for multiple item drags we need to display all the elements
		let elem = this._dragImageContainer = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
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
	
	async setItemsPaneMessage(message) {
		if (message.outerHTML) {
			message = message.outerHTML;
		}
		const shouldRerender = this._itemsPaneMessage != message;
		this._itemsPaneMessage = message;
		return shouldRerender && new Promise(resolve => this.forceUpdate(resolve));
	}
	
	async clearItemsPaneMessage() {
		const shouldRerender = !this._itemsPaneMessage;
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
			// TEMP: Hide annotations
			newSearchItems = newSearchItems.filter(item => !item.isAnnotation());
			// A temporary workaround to make item tree crash less often
			newSearchItems = newSearchItems.filter(item => !(item.isAttachment() && item.attachmentLinkMode === Zotero.Attachments.LINK_MODE_EMBEDDED_IMAGE));
			// Remove notes and attachments if necessary
			if (this.regularOnly) {
				newSearchItems = newSearchItems.filter(item => item.isRegularItem());
			}
			let newSearchItemIDs = new Set(newSearchItems.map(item => item.id));
			// Find the items that aren't yet in the tree
			let itemsToAdd = newSearchItems.filter(item => this._rowMap[item.id] === undefined);
			// Find the parents of search matches
			let newSearchParentIDs = new Set(
				this.regularOnly
					? []
					: newSearchItems.filter(item => !!item.parentItemID).map(item => item.parentItemID)
			);
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
					let isSearchParent = newSearchParentIDs.has(row.ref.id);
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
				// Child items
				else if (skipChildren) {
					continue;
				}
				newRows.push(row);
				allItemIDs.add(row.ref.id);
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
				else if (allItemIDs.has(item.id)) {
					continue;
				}
				
				// Add new top-level items
				let row = new ItemTreeRow(item, 0, false);
				newRows.push(row);
				allItemIDs.add(item.id);
				addedItemIDs.add(item.id);
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

		if (type == 'search' && action == 'modify') {
			// TODO: Only refresh on condition change (not currently available in extraData)
			await this.refresh();
			return;
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

		if (collectionTreeRow.isFeed() && action == 'modify') {
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

		var savedSelection = this.getSelectedItems(true);
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
			else if (savedSelection.length == 1 && savedSelection[0] == ids[0]) {
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
					if (!item.deleted && !item.numChildren()) {
						rows.push(row);
					}
				}
				this._removeRows(rows);
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
		var hasQuickSearch = quickSearch && quickSearch.value != '';

		// 'collection-item' ids are in the form collectionID-itemID
		if (type == 'collection-item') {
			if (!collectionTreeRow.isCollection()) {
				return;
			}

			var splitIDs = [];
			for (let id of ids) {
				var split = id.split('-');
				// Skip if not an item in this collection
				if (split[0] != collectionTreeRow.ref.id) {
					continue;
				}
				splitIDs.push(split[1]);
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
		else if (type == 'item' && action == 'modify')
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
			else if (collectionTreeRow.isFeed()) {
				window.ZoteroPane.updateReadLabel();
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
					// Reset to Info tab
					this._ownerDocument.getElementById('zotero-view-tabbox').selectedIndex = 0;
					await this.selectItem(singleSelect);
					reselect = true;
				}
			}
			// If single item is selected and was modified
			else if (action == 'modify' && ids.length == 1 &&
				savedSelection.length == 1 && savedSelection[0] == ids[0]) {
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
				if ((action == 'remove' || action == 'trash' || action == 'delete')
					&& savedSelection.some(id => this.getRowIndexByID(id) === false)) {
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

	handleTyping(char) {
		this._typingString += char.toLowerCase();
		let allSameChar = true;
		for (let i = this._typingString.length - 1; i >= 0; i--) {
			if (char != this._typingString[i]) {
				allSameChar = false;
				break;
			}
		}
		if (allSameChar) {
			for (let i = this.selection.pivot + 1, checked = 0; checked < this._rows.length; i++, checked++) {
				i %= this._rows.length;
				let row = this.getRow(i);
				if (row.getField('title').toLowerCase().indexOf(char) == 0) {
					if (i != this.selection.pivot) {
						this.ensureRowIsVisible(i);
						this.selectItem([row.ref.id]);
					}
					break;
				}
			}
		}
		else {
			for (let i = 0; i < this._rows.length; i++) {
				let row = this.getRow(i);
				if (row.getField('title').toLowerCase().indexOf(this._typingString) == 0) {
					if (i != this.selection.pivot) {
						this.ensureRowIsVisible(i);
						this.selectItem([row.ref.id]);
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
	
	handleActivate = (event, indices) => {
		// Ignore double-clicks in duplicates view on everything except attachments
		let items = indices.map(index => this.getRow(index).ref);
		if (event.button == 0 && this.collectionTreeRow.isDuplicates) {
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
			if (event.key == "ArrowRight") {
				this.expandSelectedRows();
			}
			else {
				this.collapseSelectedRows();
			}
			return false;
		}
		if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && COLORED_TAGS_RE.test(event.key)) {
			let libraryID = this.collectionTreeRow.ref.libraryID;
			let position = parseInt(event.key) - 1;
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
		else if (event.key == '+' && !(event.ctrlKey || event.altKey || event.metaKey)) {
			this.expandAllRows();
			return false;
		}
		else if (event.key == '-' && !(event.shiftKey || event.ctrlKey
			|| event.altKey || event.metaKey)) {
			this.collapseAllRows();
			return false;
		}
		else if (!event.ctrlKey && !event.metaKey && (event.key.length == 1 && (event.key != " " || this.selection.isSelected(this.selection.focused)))) {
			this.handleTyping(event.key);
			return false;
		}
		return true;
	}
	
	render() {
		const itemsPaneMessageHTML = this._itemsPaneMessage || this.props.emptyMessage;
		const showMessage = !this.collectionTreeRow || this._itemsPaneMessage;
		
		const itemsPaneMessage = (<div
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
			// Due to some collision between React and the XUL environment
			// setting innerHTML on a cached React node triggers an XML
			// parsing error god knows where. So on every refresh we set a new
			// key for the element, forcing it to be recreated. This shouldn't
			// be a major performance concern since we're not calling #forceUpdate()
			// that often and even if we did it's just a single div here.
			key={Date.now()}
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
					renderItem: this.renderItem,
					hide: showMessage,
					key: "virtualized-table",
					label: Zotero.getString('pane.items.title'),
					alternatingRowColors: Zotero.isMac ? ['-moz-OddTreeRow', '-moz-EvenTreeRow'] : null,

					showHeader: true,
					columns: this._getColumns(),
					onColumnPickerMenu: this._displayColumnPickerMenu,
					onColumnSort: this._handleColumnSort,
					getColumnPrefs: this._getColumnPrefs,
					storeColumnPrefs: this._storeColumnPrefs,
					containerWidth: this.domEl.clientWidth,

					multiSelect: true,

					onSelectionChange: this._handleSelectionChange,
					isSelectable: () => true,
					getParentIndex: this.getParentIndex,
					isContainer: this.isContainer,
					isContainerEmpty: this.isContainerEmpty,
					isContainerOpen: this.isContainerOpen,
					toggleOpenState: this.toggleOpenState,

					onDragOver: e => this.props.dragAndDrop && this.onDragOver(e, -1),
					onDrop: e => this.props.dragAndDrop && this.onDrop(e, -1),
					onKeyDown: this.handleKeyDown,
					onActivate: this.handleActivate,

					onItemContextMenu: e => this.props.onContextMenu(e),
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
		Zotero.debug(`itemTree.changeCollectionTreeRow(): ${collectionTreeRow.id}`);
		this.selection.selectEventsSuppressed = true;
		this.collectionTreeRow = collectionTreeRow;
		this.id = "item-tree-" + this.props.id + "-" + this.collectionTreeRow.visibilityGroup;
		if (!collectionTreeRow) {
			this.tree = null;
			this._treebox = null;
			return this.clearItemsPaneMessage();
		}
		this._itemTreeLoadingDeferred = Zotero.Promise.defer();
		this.collectionTreeRow.view.itemTreeView = this;
		this.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
		// Ensures that an up to date this._columns is set
		this._getColumns();

		this.selection.clearSelection();
		await this.refresh();
		if (Zotero.CollectionTreeCache.error) {
			return this.setItemsPaneMessage(Zotero.getString('pane.items.loadError'));
		}
		else {
			this.clearItemsPaneMessage();
		}
		this.forceUpdate(() => {
			this.selection.selectEventsSuppressed = false;
			this._updateIntroText();
			this._itemTreeLoadingDeferred.resolve();
		});
		await this._itemTreeLoadingDeferred.promise;
	}
	
	async refreshAndMaintainSelection(clearItemsPaneMessage=true) {
		if (this.selection) {
			this.selection.selectEventsSuppressed = true;
		}
		const selection = this.getSelectedItems(true);
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
			// ZoteroPane.itemSelected(), which calls ZoteroItemPane.viewItem(), which refreshes the
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
		
		var primaryField = this._getSortField();
		var sortFields = this._getSortFields();
		var order = 1;
		const columns = this._getColumns();
		for (const field of sortFields) {
			const col = columns.find(c => c.dataKey == primaryField);
			if (col) {
				order = col.sortDirection;
				break;
			}
		}
		var collation = Zotero.getLocaleCollation();
		var sortCreatorAsString = Zotero.Prefs.get('sortCreatorAsString');
		
		Zotero.debug(`Sorting items list by ${sortFields.join(", ")} ${order == 1 ? "ascending" : "descending"} `
			+ (itemIDs && itemIDs.length
				? `for ${itemIDs.length} ` + Zotero.Utilities.pluralize(itemIDs.length, ['item', 'items'])
				: ""));
		
		// Set whether rows with empty values should be displayed last,
		// which may be different for primary and secondary sorting.
		var emptyFirst = {};
		switch (primaryField) {
		case 'title':
			emptyFirst.title = true;
			break;
		
		// When sorting by title we want empty titles at the top, but if not
		// sorting by title, empty titles should sort to the bottom so that new
		// empty items don't get sorted to the middle of the items list.
		default:
			emptyFirst.title = false;
		}
		
		// Cache primary values while sorting, since base-field-mapped getField()
		// calls are relatively expensive
		var cache = {};
		sortFields.forEach(x => cache[x] = {});
		
		// Get the display field for a row (which might be a placeholder title)
		function getField(field, row) {
			var item = row.ref;
			
			switch (field) {
			case 'title':
				return Zotero.Items.getSortTitle(item.getDisplayTitle());
			
			case 'hasAttachment':
				if (item.isFileAttachment()) {
					var state = item.fileExistsCached() ? 1 : -1;
				}
				else if (item.isRegularItem()) {
					var state = item.getBestAttachmentStateCached();
				}
				else {
					return 0;
				}
				// Make sort order present, missing, empty when ascending
				if (state === 1) {
					state = 2;
				}
				else if (state === -1) {
					state = 1;
				}
				return state;
			
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
			
			default:
				return row.ref.getField(field, false, true);
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
					return fieldB - fieldA;
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
		
		// Regexp to extract the whole string up to an optional "and" or "et al."
		var andEtAlRegExp = new RegExp(
			// Extract the beginning of the string in non-greedy mode
			"^.+?"
			// up to either the end of the string, "et al." at the end of string
			+ "(?=(?: " + Zotero.getString('general.etAl').replace('.', '\.') + ")?$"
			// or ' and '
			+ "| " + Zotero.getString('general.and') + " "
			+ ")"
		);
		
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
				if (sortCreatorAsString) {
					var fieldA = firstCreator;
				}
				else {
					var matches = andEtAlRegExp.exec(firstCreator);
					fieldA = matches ? matches[0] : '';
				}
				creatorSortCache[aItemID] = fieldA;
			}
			if (fieldB === undefined) {
				let firstCreator = Zotero.Items.getSortTitle(sortStringB);
				if (sortCreatorAsString) {
					var fieldB = firstCreator;
				}
				else {
					matches = andEtAlRegExp.exec(firstCreator);
					fieldB = matches ? matches[0] : '';
				}
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
		
		var savedSelection = this.getSelectedItems(true);
		
		// Save open state and close containers before sorting
		var openItemIDs = this._saveOpenState(true);
		
		// Sort specific items
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
		
		this.tree && this.tree.invalidate();
		
		this._refreshRowMap();
		
		this._rememberOpenState(openItemIDs);
		this._restoreSelection(savedSelection);
		
		var numSorted = itemIDs ? itemIDs.length : this._rows.length;
		Zotero.debug(`Sorted ${numSorted} ${Zotero.Utilities.pluralize(numSorted, ['item', 'items'])} `
			+ `in ${new Date - t} ms`);
	}

	async setFilter(type, data) {
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
		await this.refreshAndMaintainSelection()
	};

	ensureRowsAreVisible(indices) {
		if (!this._treebox) return;
		let itemHeight = 20; // px
		if (Zotero.isLinux) {
			itemHeight = 22;
		}
		itemHeight *= Zotero.Prefs.get('fontSize');
		
		const pageLength = Math.floor(this._treebox.getWindowHeight() / itemHeight);
		const maxBuffer = 5;
		
		indices = Array.from(indices).filter(index => index < this._rows.length);
		indices.sort((a, b) => a - b);
		
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

		if (this.isContainerOpen(index)) {
			return this._closeContainer(index, skipRowMapRefresh);
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
			return;
		}

		if (!skipRowMapRefresh) {
			await this._refreshPromise;
			this.tree.invalidate(index);
			
			Zotero.debug('Refreshing item row map');
			this._refreshRowMap();
		}
	}

	expandMatchParents(searchParentIDs) {
		// Expand parents of child matches
		if (!this._searchMode) {
			return;
		}

		var savedSelection = this.getSelectedItems(true);
		for (var i=0; i<this.rowCount; i++) {
			var id = this.getRow(i).ref.id;
			if (searchParentIDs.has(id) && this.isContainer(i) && !this.isContainerOpen(i)) {
				this.toggleOpenState(i, true);
			}
		}
		this.tree && this.tree.invalidate();
		this._refreshRowMap();
		this._restoreSelection(savedSelection);
	}

	expandAllRows() {
		this.selection.selectEventsSuppressed = true;
		var selectedItems = this.getSelectedItems(true);
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
		const selectedItems = this.getSelectedItems(true);
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
		const selectedItems = this.getSelectedItems(true);
		// Reverse sort so we don't mess up indices of subsequent
		// items when expanding
		const indices = Array.from(this.selection.selected).sort((a, b) => b - a);
		for (const index of indices) {
			if (this.isContainer(index) && !this.isContainerOpen(index)) {
				this.toggleOpenState(index, true);
			}
		}
		this._refreshRowMap();
		this._restoreSelection(selectedItems);
		this.tree.invalidate();
		this.selection.selectEventsSuppressed = false;
	}


	collapseSelectedRows() {
		this.selection.selectEventsSuppressed = true;
		const selectedItems = this.getSelectedItems(true);
		// Reverse sort and so we don't mess up indices of subsequent
		// items when collapsing
		const indices = Array.from(this.selection.selected).sort((a, b) => b - a);
		for (const index of indices) {
			if (this.isContainer(index)) {
				this._closeContainer(index, true);
			}
		}
		this._refreshRowMap();
		this._restoreSelection(selectedItems, false);
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

	async deleteSelection(force) {
		if (arguments.length > 1) {
			throw new Error("ItemTree.deleteSelection() no longer takes two parameters");
		}

		if (this.selection.count == 0) {
			return;
		}

		// Collapse open items
		for (var i=0; i<this.rowCount; i++) {
			if (this.selection.isSelected(i) && this.isContainer(i)) {
				this._closeContainer(i, true, true);
			}
		}
		this._refreshRowMap();
		this.tree.invalidate();

		// Create an array of selected items
		var ids = Array.from(this.selection.selected).map(index => this.getRow(index).id);

		var collectionTreeRow = this.collectionTreeRow;

		if (collectionTreeRow.isBucket()) {
			collectionTreeRow.ref.deleteItems(ids);
		}
		if (collectionTreeRow.isTrash()) {
			await Zotero.Items.erase(ids);
		}
		else if (collectionTreeRow.isLibrary(true) || force) {
			await Zotero.Items.trashTx(ids);
		}
		else if (collectionTreeRow.isCollection()) {
			await Zotero.DB.executeTransaction(async () => {
				await collectionTreeRow.ref.removeItems(ids);
			});
		}
		else if (collectionTreeRow.isPublications()) {
			await Zotero.Items.removeFromPublications(ids.map(id => Zotero.Items.get(id)));
		}
	}
	
	getSelectedItems(asIDs) {
		var items = this.selection ? Array.from(this.selection.selected) : [];
		items = items.filter(index => index < this._rows.length);
		try {
			if (asIDs) return items.map(index => this.getRow(index).ref.id);
			return items.map(index => this.getRow(index).ref);
		} catch (e) {
			Zotero.debug(items);
			throw e;
		}
	}

	isContainer = (index) => {
		return this.getRow(index).ref.isRegularItem();
	}

	isContainerOpen = (index) => {
		return this.getRow(index).isOpen;
	}

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
	}

	////////////////////////////////////////////////////////////////////////////////
	///
	///  Drag-and-drop methods
	///
	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Start a drag using HTML 5 Drag and Drop
	 */
	onDragStart = (event, index) => {
		// See note in LibraryTreeView::setDropEffect()
		if (Zotero.isWin || Zotero.isLinux) {
			event.dataTransfer.effectAllowed = 'copyMove';
		}
		
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
		event.dataTransfer.setDragImage(this._dragImageContainer, 0, 0);

		var itemIDs = this.getSelectedItems(true);
		event.dataTransfer.setData("zotero/item", itemIDs);

		var items = Zotero.Items.get(itemIDs);
		Zotero.DragDrop.currentDragSource = this.collectionTreeRow;

		// If at least one file is a non-web-link attachment and can be found,
		// enable dragging to file system
		var files = items
			.filter(item => item.isAttachment())
			.map(item => item.getFilePath())
			.filter(path => path);

		if (files.length) {
			// Advanced multi-file drag (with unique filenames, which otherwise happen automatically on
			// Windows but not Linux) and auxiliary snapshot file copying on macOS
			let dataProvider;
			if (Zotero.isMac) {
				dataProvider = new Zotero.FileDragDataProvider(itemIDs);
			}

			for (let i = 0; i < files.length; i++) {
				let file = Zotero.File.pathToFile(files[i]);

				if (dataProvider) {
					Zotero.debug("Adding application/x-moz-file-promise");
					event.dataTransfer.mozSetDataAt("application/x-moz-file-promise", dataProvider, i);
				}

				// Allow dragging to filesystem on Linux and Windows
				let uri;
				if (!Zotero.isMac) {
					Zotero.debug("Adding text/x-moz-url " + i);
					let fph = Cc["@mozilla.org/network/protocol;1?name=file"]
						.createInstance(Ci.nsIFileProtocolHandler);
					uri = fph.getURLSpecFromFile(file);
					event.dataTransfer.mozSetDataAt("text/x-moz-url", uri + '\n' + file.leafName, i);
				}

				// Allow dragging to web targets (e.g., Gmail)
				Zotero.debug("Adding application/x-moz-file " + i);
				event.dataTransfer.mozSetDataAt("application/x-moz-file", file, i);

				if (Zotero.isWin) {
					event.dataTransfer.mozSetDataAt("application/x-moz-file-promise-url", uri, i);
				}
				else if (Zotero.isLinux) {
					// Don't create a symlink for an unmodified drag
					event.dataTransfer.effectAllowed = 'copy';
				}
			}
		}

		// Get Quick Copy format for current URL (set via /ping from connector)
		var format = Zotero.QuickCopy.getFormatFromURL(Zotero.QuickCopy.lastActiveURL);

		Zotero.debug("Dragging with format " + format);

		var exportCallback = function(obj, worked) {
			if (!worked) {
				Zotero.log(Zotero.getString("fileInterface.exportError"), 'warning');
				return;
			}

			var text = obj.string.replace(/\r\n/g, "\n");
			event.dataTransfer.setData("text/plain", text);
		}

		format = Zotero.QuickCopy.unserializeSetting(format);
		try {
			if (format.mode == 'export') {
				Zotero.QuickCopy.getContentFromItems(items, format, exportCallback);
			}
			else if (format.mode == 'bibliography') {
				var content = Zotero.QuickCopy.getContentFromItems(items, format, null, event.shiftKey);
				if (content) {
					if (content.html) {
						event.dataTransfer.setData("text/html", content.html);
					}
					event.dataTransfer.setData("text/plain", content.text);
				}
			}
			else {
				Cu.reportError("Invalid Quick Copy mode");
			}
		}
		catch (e) {
			Zotero.debug(e);
			Cu.reportError(e + " with '" + format.id + "'");
		}
	}

	/**
	 * We use this to set the drag action, which is used by view.canDrop(),
	 * based on the view's canDropCheck() and modifier keys.
	 */
	onDragOver = (event, row) => {
		try {
			event.preventDefault();
			event.stopPropagation();
			Zotero.DragDrop.currentOrientation = getDragTargetOrient(event);
			Zotero.debug(`Dragging over item ${row} with ${Zotero.DragDrop.currentOrientation}, drop row: ${this._dropRow}`);

			var target = event.target;
			if (target.classList.contains('items-tree-message')) {
				let doc = target.ownerDocument;
				// Consider a drop on the items pane message box (e.g., when showing the welcome text)
				// a drop on the items tree
				if (target.firstChild.hasAttribute('allowdrop')) {
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
		} finally {
			let prevDropRow = this._dropRow;
			if (event.dataTransfer.dropEffect != 'none') {
				this._dropRow = row;
			} else {
				this._dropRow = null;
			}
			if (prevDropRow != this._dropRow) {
				typeof prevDropRow == 'number' && this.tree.invalidateRow(prevDropRow);
				this.tree.invalidateRow(row);
			}
		}
	}

	onDragEnd = () => {
		this._dragImageContainer.innerHTML = "";
		this._dropRow = null;
		this.tree.invalidate();
	}

	onDragLeave = () => {
		let dropRow = this._dropRow;
		this._dropRow = null;
		this.tree.invalidateRow(dropRow);
	}

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

			// If moving, remove items from source collection
			if (dropEffect == 'move' && toMove.length) {
				if (!sameLibrary) {
					throw new Error("Cannot move items between libraries");
				}
				if (!sourceCollectionTreeRow || !sourceCollectionTreeRow.isCollection()) {
					throw new Error("Drag source must be a collection");
				}
				if (collectionTreeRow.id != sourceCollectionTreeRow.id) {
					await Zotero.DB.executeTransaction(async function () {
						await collectionTreeRow.ref.removeItems(toMove);
					}.bind(this));
				}
			}
		}
		else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
			// Disallow drop into read-only libraries
			if (!collectionTreeRow.editable) {
				window.ZoteroPane.displayCannotEditLibraryMessage();
				return;
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
								file = OS.Path.join(OS.Path.dirname(file), newName);
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
						if (dragData.dropEffect == 'move') {
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

			// Automatically retrieve metadata for PDFs
			if (!parentItemID) {
				Zotero.RecognizePDF.autoRecognizeItems(addedItems);
			}
		}
	};

	// //////////////////////////////////////////////////////////////////////////////
	//
	//  Private methods
	//
	// //////////////////////////////////////////////////////////////////////////////

	_handleSelectionChange = (shouldDebounce) => {
		let selection = this.selection;
		// Update aria-activedescendant on the tree
		if (this.collectionTreeRow.isDuplicates() && selection.count == 1) {
			var itemID = this.getRow(selection.focused).ref.id;
			var setItemIDs = this.collectionTreeRow.ref.getSetItemsByItemID(itemID);
			
			// We are modifying the selection object directly here
			// which won't trigger item updates
			for (let id of setItemIDs) {
				selection.selected.add(this._rowMap[id]);
			}
		}
		if (shouldDebounce) {
			this._onSelectionChangeDebounced();
		}
		else {
			this._onSelectionChange();
		}
	}

	async _closeContainer(index, skipRowMapRefresh) {
		// isContainer == false shouldn't happen but does if an item is dragged over a closed
		// container until it opens and then released, since the container is no longer in the same
		// place when the spring-load closes
		if (!this.isContainer(index)) return;
		if (!this.isContainerOpen(index)) return;

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
			await this._refreshPromise;
			this.tree.invalidate(index);
			
			Zotero.debug('Refreshing item row map');
			this._refreshRowMap();
		}
	}

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
		
		let row = {};
		
		// Mark items not matching search as context rows, displayed in gray
		if (this._searchMode && !this._searchItemIDs.has(itemID)) {
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
		
		
		row.itemType = Zotero.ItemTypes.getLocalizedString(treeRow.ref.itemTypeID);
		// Year column is just date field truncated
		row.year = treeRow.getField('date', true).substr(0, 4);
		row.numNotes = treeRow.numNotes() || "";
		row.title = treeRow.ref.getDisplayTitle();
		
		for (let col of this.props.columns) {
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
				if (key == 'date' && !this.collectionTreeRow.isFeed()) {
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
		if (this._columnPrefs) return this._columnPrefs;
		
		const persistSettings = JSON.parse(Zotero.Prefs.get('pane.persist') || "{}");
		this._columnPrefs = persistSettings[this._columnsId];
		return this._columnPrefs || {};
	}

	// N.B. We are banging the prefs with this new implementation somewhat more:
	// column resize, hiding and order changes require pref reads and sets
	// but we do not have the magic of xul itemtree to handle this for us.
	// We should try to avoid calling this function as much as possible since it writes
	// to disk and might introduce undesirable performance costs on HDDs (which
	// will not be obvious on SSDs)
	_storeColumnPrefs = (prefs) => {
		if (!this.props.persistColumns) return;
		Zotero.debug(`Storing itemTree ${this._columnsId} column prefs`, 2);
		this._columnPrefs = prefs;
		let persistSettings = JSON.parse(Zotero.Prefs.get('pane.persist') || "{}");
		persistSettings[this._columnsId] = prefs;
		this._columns = this._columns.map(column => Object.assign(column, prefs[column.dataKey]))
			.sort((a, b) => a.ordinal - b.ordinal);
		Zotero.Prefs.set('pane.persist', JSON.stringify(persistSettings));
	}

	_setLegacyColumnSettings(column) {
		let persistSettings = JSON.parse(Zotero.Prefs.get('pane.persist') || "{}");
		const legacyDataKey = "zotero-items-column-" + column.dataKey;
		const legacyPersistSetting = persistSettings[legacyDataKey];
		if (legacyPersistSetting) {
			// Remove legacy pref
			// TODO: uncomment once xul item tree fully phased out
			// delete persistSettings[legacyDataKey];
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
		this._columnPrefs = null;
		
		let columnsSettings = this._getColumnPrefs();

		let hasDefaultIn = this.props.columns.some(column => 'defaultIn' in column);
		for (let column of this.props.columns) {
			if (this.props.persistColumns) {
				if (column.disabledIn && column.disabledIn.includes(visibilityGroup)) continue;
				const columnSettings = columnsSettings[column.dataKey];
				if (!columnSettings) {
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
					column.ordinal = this.props.columns.findIndex(c => c.dataKey == column.dataKey);
				}
			}
			else {
				column = Object.assign({}, column);
			}
			// Initial hidden value
			if (!("hidden" in column)) {
				if (hasDefaultIn) {
					column.hidden = !(column.defaultIn && column.defaultIn.has(visibilityGroup));
				}
				else {
					column.hidden = false;
				}
			}
			this._columns.push(column);
		}
		
		return this._columns;
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
			let ns = 'http://www.w3.org/1999/xhtml';
			let div;

			// My Library and no groups
			if (this.collectionTreeRow.isLibrary() && !Zotero.Groups.getAll().length) {
				div = doc.createElementNS(ns, 'div');
				let p = doc.createElementNS(ns, 'p');
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

				p = doc.createElementNS(ns, 'p');
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

				p = doc.createElementNS(ns, 'p');
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

				div.setAttribute('allowdrop', true);
			}
			// My Publications
			else if (this.collectionTreeRow.isPublications()) {
				div = doc.createElementNS(ns, 'div');
				div.className = 'publications';
				let p = doc.createElementNS(ns, 'p');
				p.textContent = Zotero.getString('publications.intro.text1', window.ZOTERO_CONFIG.DOMAIN_NAME);
				div.appendChild(p);

				p = doc.createElementNS(ns, 'p');
				p.textContent = Zotero.getString('publications.intro.text2');
				div.appendChild(p);

				p = doc.createElementNS(ns, 'p');
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
	 * @private
	 */
	async _restoreSelection(selection, expandCollapsedParents=true) {
		if (!selection.length || !this._treebox) {
			return;
		}

		this.selection.clearSelection();

		if (!this.selection.selectEventsSuppressed) {
			var unsuppress = this.selection.selectEventsSuppressed = true;
		}

		try {
			for (let i = 0; i < selection.length; i++) {
				if (this._rowMap[selection[i]] != null) {
					this.selection.toggleSelect(this._rowMap[selection[i]]);
				}
				// Try the parent
				else if (expandCollapsedParents) {
					var item = Zotero.Items.get(selection[i]);
					if (!item) {
						continue;
					}

					var parent = item.parentItemID;
					if (!parent) {
						continue;
					}

					if (this._rowMap[parent] != null) {
						await this._closeContainer(this._rowMap[parent]);
						await this.toggleOpenState(this._rowMap[parent]);
						this.selection.toggleSelect(this._rowMap[selection[i]]);
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

		this.ensureRowsAreVisible(Array.from(this.selection.selected.keys()));

		if (unsuppress) {
			this.selection.selectEventsSuppressed = false;
		}
	}
	
	_handleColumnSort = async (index, sortDirection) => {
		let columnSettings = this._getColumnPrefs();
		let column = this._getColumn(index);
		if (this.collectionTreeRow.isFeed()) {
			return;
		}
		if (column.dataKey == 'hasAttachment') {
			Zotero.debug("Caching best attachment states");
			if (!this._cachedBestAttachmentStates) {
				let t = new Date();
				for (let i = 0; i < this._rows.length; i++) {
					let item = this.getRow(i).ref;
					if (item.isRegularItem()) {
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

		this._storeColumnPrefs(columnSettings);
		await this._refreshPromise;
		this.selection.selectEventsSuppressed = true;
		await this.sort();
		this.forceUpdate(() => {
			this.tree.invalidate();
			this.selection.selectEventsSuppressed = false;
		})
	}

	_displayColumnPickerMenu = (event) => {
		if (!this.props.columnPicker) return;
		const ns = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
		const prefix = 'zotero-column-picker-';
		const doc = document;
		
		const menupopup = doc.createElementNS(ns, 'menupopup');
		menupopup.id = 'zotero-column-picker';
		menupopup.addEventListener('popuphiding', (event) => {
			if (event.target.id == menupopup.id) {
				document.children[0].removeChild(menupopup);
			}
		});
		
		const columns = this._getColumns();
		for (let i = 0; i < columns.length; i++) {
			const column = columns[i];
			let menuitem = doc.createElementNS(ns, 'menuitem');
			menuitem.setAttribute('type', 'checkbox');
			menuitem.setAttribute('label', Zotero.Intl.strings[column.label]);
			menuitem.setAttribute('colindex', i);
			menuitem.addEventListener('command', () => this.tree._columns.toggleHidden(i));
			if (!column.hidden) {
				menuitem.setAttribute('checked', true);
			}
			if (column.disabledIn && column.disabledIn.includes(this.collectionTreeRow.visibilityGroup)) {
				menuitem.setAttribute('disabled', true);
			}
			menupopup.appendChild(menuitem);
		}
		
		try {
			// More Columns menu
			let id = prefix + 'more-menu';
			
			let moreMenu = doc.createElementNS(ns, 'menu');
			moreMenu.setAttribute('label', Zotero.getString('pane.items.columnChooser.moreColumns'));
			moreMenu.setAttribute('anonid', id);
			
			let moreMenuPopup = doc.createElementNS(ns, 'menupopup');
			moreMenuPopup.setAttribute('anonid', id + '-popup');

			let moreItems = [];
			for (let i = 0; i < columns.length; i++) {
				const column = columns[i];
				if (column.submenu) {
					moreItems.push(menupopup.children[i]);
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

			let sep = doc.createElementNS(ns, 'menuseparator');
			menupopup.appendChild(sep);
			moreMenu.appendChild(moreMenuPopup);
			menupopup.appendChild(moreMenu);
		}
		catch (e) {
			Cu.reportError(e);
			Zotero.debug(e, 1);
		}
		
		//
		// Secondary Sort menu
		//
		if (!this.collectionTreeRow.isFeed()) {
			try {
				const id = prefix + 'sort-menu';
				const primaryField = this._getSortField();
				const sortFields = this._getSortFields();
				let secondaryField = false;
				if (sortFields[1]) {
					secondaryField = sortFields[1];
				}
				
				const primaryFieldLabel = Zotero.Intl.strings[columns.find(c => c.dataKey == primaryField).label];
				
				const sortMenu = doc.createElementNS(ns, 'menu');
				sortMenu.setAttribute('label',
					Zotero.getString('pane.items.columnChooser.secondarySort', primaryFieldLabel));
				sortMenu.setAttribute('anonid', id);
				
				const sortMenuPopup = doc.createElementNS(ns, 'menupopup');
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
					let label = Zotero.Intl.strings[columns.find(c => c.dataKey == field).label];
					
					let sortMenuItem = doc.createElementNS(ns, 'menuitem');
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
				Cu.reportError(e);
				Zotero.debug(e, 1);
			}
		}
		
		let sep = doc.createElementNS(ns, 'menuseparator');
		sep.setAttribute('anonid', prefix + 'sep');
		menupopup.appendChild(sep);
		
		// TODO: RESTORE DEFAULT ORDER option
		//
		
		document.children[0].appendChild(menupopup);
		menupopup.openPopup(null, null, event.clientX + 2, event.clientY + 2);
	}

	_getSortField() {
		if (this.collectionTreeRow.isFeed()) {
			return 'id';
		}
		var column = this._sortedColumn;
		if (!column) {
			column = this._getColumns().find(col => !col.hidden);
		}
		// zotero-items-column-_________
		return column.dataKey;
	}


	_getSortFields() {
		var fields = [this._getSortField()];
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
			Cu.reportError(e);
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
	
	_getSecondarySortField() {
		var primaryField = this._getSortField();
		var secondaryField = Zotero.Prefs.get('secondarySort.' + primaryField);
		if (!secondaryField || secondaryField == primaryField) {
			return false;
		}
		return secondaryField;
	}
	
	_setSecondarySortField(secondaryField) {
		var primaryField = this._getSortField();
		var currentSecondaryField = this._getSecondarySortField();
		var sortFields = this._getSortFields();
		
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
		var itemType = Zotero.ItemTypes.getName(item.itemTypeID);
		if (itemType == 'attachment') {
			var linkMode = item.attachmentLinkMode;
			
			if (item.attachmentContentType == 'application/pdf' && item.isFileAttachment()) {
				if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
					itemType += 'PdfLink';
				}
				else {
					itemType += 'Pdf';
				}
			}
			else if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE) {
				itemType += "File";
			}
			else if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
				itemType += "Link";
			}
			else if (linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL) {
				itemType += "Snapshot";
			}
			else if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
				itemType += "WebLink";
			}
		}
		let iconClsName = "IconTreeitem" + Zotero.Utilities.capitalize(itemType);
		if (!Icons[iconClsName]) {
			iconClsName = "IconTreeitem";
		}
		var icon = getDOMElement(iconClsName);
		if (!icon) {
			Zotero.debug('Could not find tree icon for "' + itemType + '"');
			return document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
		}
		return icon;
	}
	
	_getTagSwatch(color) {
		let span = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
		span.className = 'tag-swatch';
		span.style.backgroundColor = color;
		return span;
	}
};

var ItemTreeRow = function(ref, level, isOpen)
{
	this.ref = ref;			//the item associated with this
	this.level = level;
	this.isOpen = isOpen;
	this.id = ref.id;
}

ItemTreeRow.prototype.getField = function(field, unformatted)
{
	return this.ref.getField(field, unformatted, true);
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
