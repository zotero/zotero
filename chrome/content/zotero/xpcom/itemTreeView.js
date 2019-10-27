/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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

////////////////////////////////////////////////////////////////////////////////
///
///  ItemTreeView
///    -- handles the link between an individual tree and the data layer
///    -- displays only items (no collections, no hierarchy)
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Constructor for the ItemTreeView object
 */
Zotero.ItemTreeView = function (collectionTreeRow) {
	Zotero.LibraryTreeView.apply(this);
	
	this.wrappedJSObject = this;
	this.rowCount = 0;
	this.collectionTreeRow = collectionTreeRow;
	collectionTreeRow.view.itemTreeView = this;
	
	this._skipKeypress = false;
	
	this._ownerDocument = null;
	this._needsSort = false;
	this._introText = null;
	
	this._cellTextCache = {};
	this._itemImages = {};
	
	this._refreshPromise = Zotero.Promise.resolve();
	
	this._notifierObserverID = Zotero.Notifier.registerObserver(
		this,
		['item', 'collection-item', 'item-tag', 'share-items', 'bucket', 'feedItem', 'search'],
		'itemTreeView',
		50
	);
	this._prefObserverID = Zotero.Prefs.registerObserver('recursiveCollections', this.refresh.bind(this));
}

Zotero.ItemTreeView.prototype = Object.create(Zotero.LibraryTreeView.prototype);
Zotero.ItemTreeView.prototype.type = 'item';
Zotero.ItemTreeView.prototype.regularOnly = false;
Zotero.ItemTreeView.prototype.expandAll = false;
Zotero.ItemTreeView.prototype.collapseAll = false;

Object.defineProperty(Zotero.ItemTreeView.prototype, 'window', {
	get: function () {
		return this._ownerDocument.defaultView;
	},
	enumerable: true
});

/**
 * Called by the tree itself
 */
Zotero.ItemTreeView.prototype.setTree = async function (treebox) {
	try {
		if (this._treebox) {
			if (this._needsSort) {
				this.sort();
			}
			return;
		}
		
		var start = Date.now();
		
		Zotero.debug("Setting tree for " + this.collectionTreeRow.id + " items view " + this.id);
		
		if (!treebox) {
			Zotero.debug("Treebox not passed in setTree()", 2);
			return;
		}
		this._treebox = treebox;
		
		if (!this._ownerDocument) {
			try {
				this._ownerDocument = treebox.treeBody.ownerDocument;
			}
			catch (e) {}
			
			if (!this._ownerDocument) {
				Zotero.debug("No owner document in setTree()", 2);
				return;
			}
		}
		
		this.setSortColumn();
		
		if (this.window.ZoteroPane) {
			this.window.ZoteroPane.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
		}
		
		if (Zotero.locked) {
			Zotero.debug("Zotero is locked -- not loading items tree", 2);
			
			if (this.window.ZoteroPane) {
				this.window.ZoteroPane.clearItemsPaneMessage();
			}
			return;
		}
		
		// Don't expand to show search matches in My Publications
		var skipExpandMatchParents = this.collectionTreeRow.isPublications();
		
		await this.refresh(skipExpandMatchParents);
		if (!this._treebox.treeBody) {
			return;
		}
		
		// Expand all parent items in the view, regardless of search matches. We do this here instead
		// of refresh so that it doesn't get reverted after item changes.
		if (this.expandAll) {
			var t = new Date();
			for (let i = 0; i < this._rows.length; i++) {
				if (this.isContainer(i) && !this.isContainerOpen(i)) {
					this.toggleOpenState(i, true);
				}
			}
			Zotero.debug(`Opened all parent items in ${new Date() - t} ms`);
		}
		this._refreshItemRowMap();
		
		// Add a keypress listener for expand/collapse
		var tree = this._getTreeElement();
		var self = this;
		var coloredTagsRE = new RegExp("^[0-" + Zotero.Tags.MAX_COLORED_TAGS + "]{1}$");
		var listener = function(event) {
			if (self._skipKeyPress) {
				self._skipKeyPress = false;
				return;
			}
			
			// Handle arrow keys specially on multiple selection, since
			// otherwise the tree just applies it to the last-selected row
			if (event.keyCode == event.DOM_VK_RIGHT || event.keyCode == event.DOM_VK_LEFT) {
				if (self._treebox.view.selection.count > 1) {
					switch (event.keyCode) {
						case event.DOM_VK_RIGHT:
							self.expandSelectedRows();
							break;
							
						case event.DOM_VK_LEFT:
							self.collapseSelectedRows();
							break;
					}
					
					event.preventDefault();
				}
				return;
			}
			
			var key = String.fromCharCode(event.which);
			if (key == '+' && !(event.ctrlKey || event.altKey || event.metaKey)) {
				self.expandAllRows();
				event.preventDefault();
				return;
			}
			else if (key == '-' && !(event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)) {
				self.collapseAllRows();
				event.preventDefault();
				return;
			}
			
			// Ignore other non-character keypresses
			if (!event.charCode || event.shiftKey || event.ctrlKey ||
					event.altKey || event.metaKey) {
				return;
			}
			
			event.preventDefault();
			event.stopPropagation();
			
			Zotero.spawn(function* () {
				if (coloredTagsRE.test(key)) {
					let libraryID = self.collectionTreeRow.ref.libraryID;
					let position = parseInt(key) - 1;
					// When 0 is pressed, remove all colored tags
					if (position == -1) {
						let items = self.getSelectedItems();
						return Zotero.Tags.removeColoredTagsFromItems(items);
					}
					let colorData = Zotero.Tags.getColorByPosition(libraryID, position);
					// If a color isn't assigned to this number or any
					// other numbers, allow key navigation
					if (!colorData) {
						return !Zotero.Tags.getColors(libraryID).size;
					}
					
					var items = self.getSelectedItems();
					yield Zotero.Tags.toggleItemsListTags(items, colorData.name);
					return;
				}
				
				// We have to disable key navigation on the tree in order to
				// keep it from acting on the 1-9 keys used for colored tags.
				// To allow navigation with other keys, we temporarily enable
				// key navigation and recreate the keyboard event. Since
				// that will trigger this listener again, we set a flag to
				// ignore the event, and then clear the flag above when the
				// event comes in. I see no way this could go wrong...
				tree.disableKeyNavigation = false;
				self._skipKeyPress = true;
				var clonedEvent = new this.window.KeyboardEvent("keypress", event);
				event.explicitOriginalTarget.dispatchEvent(clonedEvent);
				tree.disableKeyNavigation = true;
			}.bind(this))
			.catch(function (e) {
				Zotero.logError(e);
			})
		}.bind(this);
		// Store listener so we can call removeEventListener() in ItemTreeView.unregister()
		this.listener = listener;
		tree.addEventListener('keypress', listener);
		
		// This seems to be the only way to prevent Enter/Return
		// from toggle row open/close. The event is handled by
		// handleKeyPress() in zoteroPane.js.
		tree._handleEnter = function () {};
		
		this._updateIntroText();
		
		if (this.collectionTreeRow && this.collectionTreeRow.itemsToSelect) {
			await this.selectItems(this.collectionTreeRow.itemsToSelect);
			this.collectionTreeRow.itemsToSelect = null;
		}
		
		Zotero.debug("Set tree for items view " + this.id + " in " + (Date.now() - start) + " ms");
		
		this._initialized = true;
		await this.runListeners('load');
	}
	catch (e) {
		Zotero.debug(e, 1);
		Components.utils.reportError(e);
		if (this.onError) {
			this.onError(e);
		}
		throw e;
	}
}


Zotero.ItemTreeView.prototype.setSortColumn = function() {
	var dir, col, currentCol, currentDir;
	
	for (let i=0, len=this._treebox.columns.count; i<len; i++) {
		let column = this._treebox.columns.getColumnAt(i);
		if (column.element.getAttribute('sortActive')) {
			currentCol = column;
			currentDir = column.element.getAttribute('sortDirection');
			column.element.removeAttribute('sortActive');
			column.element.removeAttribute('sortDirection');
			break;
		}
	}
	
	let colID = Zotero.Prefs.get('itemTree.sortColumnID');
	// Restore previous sort setting (feed -> non-feed)
	if (! this.collectionTreeRow.isFeed() && colID) {
		col = this._treebox.columns.getNamedColumn(colID);
		dir = Zotero.Prefs.get('itemTree.sortDirection');
		Zotero.Prefs.clear('itemTree.sortColumnID');
		Zotero.Prefs.clear('itemTree.sortDirection');
	// No previous sort setting stored, so store it (non-feed -> feed)
	} else if (this.collectionTreeRow.isFeed() && !colID && currentCol) {
		Zotero.Prefs.set('itemTree.sortColumnID', currentCol.id);
		Zotero.Prefs.set('itemTree.sortDirection', currentDir);
	// Retain current sort setting (non-feed -> non-feed)
	} else {
		col = currentCol;
		dir = currentDir;
	}
	if (col) {
		col.element.setAttribute('sortActive', true);
		col.element.setAttribute('sortDirection', dir);
	}
}


/**
 *  Reload the rows from the data access methods
 *  (doesn't call the tree.invalidate methods, etc.)
 */
Zotero.ItemTreeView.prototype.refresh = Zotero.serial(Zotero.Promise.coroutine(function* (skipExpandMatchParents) {
	Zotero.debug('Refreshing items list for ' + this.id);
	
	// DEBUG: necessary?
	try {
		this._treebox.columns.count
	}
	// If treebox isn't ready, skip refresh
	catch (e) {
		return false;
	}
	
	var resolve, reject;
	this._refreshPromise = new Zotero.Promise(function () {
		resolve = arguments[0];
		reject = arguments[1];
	});
	
	try {
		Zotero.CollectionTreeCache.clear();
		// Get the full set of items we want to show
		let newSearchItems = yield this.collectionTreeRow.getItems();
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
		
		if (!this.selection.selectEventsSuppressed) {
			var unsuppress = this.selection.selectEventsSuppressed = true;
			this._treebox.beginUpdateBatch();
		}
		var savedSelection = this.getSelectedItems(true);
		
		var oldCount = this.rowCount;
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
			let row = new Zotero.ItemTreeRow(item, 0, false);
			newRows.push(row);
			allItemIDs.add(item.id);
			addedItemIDs.add(item.id);
		}
		
		this._rows = newRows;
		this.rowCount = this._rows.length;
		this._refreshItemRowMap();
		// Sort only the new items
		//
		// This still results in a lot of extra work (e.g., when clearing a quick search, we have to
		// re-sort all items that didn't match the search), so as a further optimization we could keep
		// a sorted list of items for a given column configuration and restore items from that.
		this.sort([...addedItemIDs]);
		
		var diff = this.rowCount - oldCount;
		if (diff != 0) {
			this._treebox.rowCountChanged(0, diff);
		}
		
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
		
		this._refreshItemRowMap();
		
		this._searchMode = newSearchMode;
		this._searchItemIDs = newSearchItemIDs; // items matching the search
		this._cellTextCache = {};
		
		this.rememberSelection(savedSelection);
		if (!skipExpandMatchParents) {
			this.expandMatchParents(newSearchParentIDs);
		}
		if (unsuppress) {
			this._treebox.endUpdateBatch();
			this.selection.selectEventsSuppressed = false;
		}
		
		// Clear My Publications intro text on a refresh with items
		if (this.collectionTreeRow.isPublications() && this.rowCount) {
			this.window.ZoteroPane.clearItemsPaneMessage();
		}
		
		yield this.runListeners('refresh');
		
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
}));


/*
 *  Called by Zotero.Notifier on any changes to items in the data layer
 */
Zotero.ItemTreeView.prototype.notify = Zotero.Promise.coroutine(function* (action, type, ids, extraData)
{
	Zotero.debug("Yielding for refresh promise"); // TEMP
	yield this._refreshPromise;
	
	if (!this._treebox || !this._treebox.treeBody) {
		Zotero.debug("Treebox didn't exist in itemTreeView.notify()");
		return;
	}
	
	if (!this._rowMap) {
		Zotero.debug("Item row map didn't exist in itemTreeView.notify()");
		return;
	}
	
	if (type == 'search' && action == 'modify') {
		// TODO: Only refresh on condition change (not currently available in extraData)
		yield this.refresh();
		return;
	}
	
	// Clear item type icon and tag colors when a tag is added to or removed from an item
	if (type == 'item-tag') {
		// TODO: Only update if colored tag changed?
		ids.map(val => val.split("-")[0]).forEach(function (val) {
			delete this._itemImages[val];
		}.bind(this));
		return;
	}
	
	var collectionTreeRow = this.collectionTreeRow;

	if (collectionTreeRow.isFeed() && action == 'modify') {
		for (let i=0; i<ids.length; i++) {
			this._treebox.invalidateRow(this._rowMap[ids[i]]);
		}
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
	
	// Redraw the tree (for tag color and progress changes)
	if (action == 'redraw') {
		// Redraw specific rows
		if (type == 'item' && ids.length) {
			// Redraw specific cells
			if (extraData && extraData.column) {
				var col = this._treebox.columns.getNamedColumn(
					'zotero-items-column-' + extraData.column
				);
				for (let id of ids) {
					if (extraData.column == 'title') {
						delete this._itemImages[id];
					}
					this._treebox.invalidateCell(this._rowMap[id], col);
				}
			}
			else {
				for (let id of ids) {
					delete this._itemImages[id];
					this._treebox.invalidateRow(this._rowMap[id]);
				}
			}
		}
		// Redraw the whole tree
		else {
			this._itemImages = {};
			this._treebox.invalidate();
		}
		return;
	}
	
	if (action == 'refresh') {
		if (type == 'share-items') {
			if (collectionTreeRow.isShare()) {
				yield this.refresh();
				refreshed = true;
			}
		}
		else if (type == 'bucket') {
			if (collectionTreeRow.isBucket()) {
				yield this.refresh();
				refreshed = true;
			}
		}
		// If refreshing a single item, clear caches and then deselect and reselect row
		else if (savedSelection.length == 1 && savedSelection[0] == ids[0]) {
			let id = ids[0];
			let row = this._rowMap[id];
			delete this._cellTextCache[row];
			delete this._itemImages[id];
			this._treebox.invalidateRow(row);
			
			this.selection.clearSelection();
			this.rememberSelection(savedSelection);
		}
		else {
			for (let id of ids) {
				let row = this._rowMap[id];
				if (row === undefined) continue;
				delete this._cellTextCache[row];
				delete this._itemImages[id];
				this._treebox.invalidateRow(row);
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
		
		// Select the last item even if there are no changes (e.g. if the tag
		// selector is open and already refreshed the pane)
		/*if (splitIDs.length > 0 && (action == 'add' || action == 'modify')) {
			var selectItem = splitIDs[splitIDs.length - 1];
		}*/
	}
	
	this.selection.selectEventsSuppressed = true;
	this._treebox.beginUpdateBatch();
	
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
		var items = Zotero.Items.get(ids);
		for (let i=0; i<items.length; i++) {
			let id = items[i].id;
			delete this._itemImages[id];
			delete this._cellTextCache[id];
		}
		
		// If saved search, publications, or trash, just re-run search
		if (collectionTreeRow.isSearch()
				|| collectionTreeRow.isPublications()
				|| collectionTreeRow.isTrash()
				|| hasQuickSearch) {
			let skipExpandMatchParents = collectionTreeRow.isPublications();
			yield this.refresh(skipExpandMatchParents);
			refreshed = true;
			madeChanges = true;
			// Don't bother re-sorting in trash, since it's probably just a modification of a parent
			// item that's about to be deleted
			if (!collectionTreeRow.isTrash()) {
				sort = true;
			}
		}
		else if (collectionTreeRow.isFeed()) {
			this.window.ZoteroPane.updateReadLabel();
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
							sort = id;
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
						this._addRow(new Zotero.ItemTreeRow(item, 0, false), beforeRow);
						
						sort = id;
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
						this._addRow(new Zotero.ItemTreeRow(item, 0, false), beforeRow);
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
			yield this.refresh();
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
					this._addRow(new Zotero.ItemTreeRow(item, 0, false), beforeRow);
					madeChanges = true;
				}
			}
			if (madeChanges) {
				sort = (items.length == 1) ? items[0].id : true;
			}
		}
	}
	
	var reselect = false;
	if(madeChanges)
	{
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
			this.sort(typeof sort == 'number' ? [sort] : false);
		}
		else {
			this._refreshItemRowMap();
		}
		
		if (singleSelect) {
			if (!extraData[singleSelect] || !extraData[singleSelect].skipSelect) {
				// Reset to Info tab
				this._ownerDocument.getElementById('zotero-view-tabbox').selectedIndex = 0;
				yield this.selectItem(singleSelect);
				reselect = true;
			}
		}
		// If single item is selected and was modified
		else if (action == 'modify' && ids.length == 1 &&
				savedSelection.length == 1 && savedSelection[0] == ids[0]) {
			if (activeWindow) {
				yield this.selectItem(ids[0]);
				reselect = true;
			}
			else {
				this.rememberSelection(savedSelection);
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
						// Mirror ZoteroPane.onTreeMouseDown behavior
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
					
					if (previousFirstSelectedRow !== undefined && this._rows[previousFirstSelectedRow]) {
						this.selection.select(previousFirstSelectedRow);
						reselect = true;
					}
					// If no item at previous position, select last item in list
					else if (this._rows[this._rows.length - 1]) {
						this.selection.select(this._rows.length - 1);
						reselect = true;
					}
				}
			}
			else {
				this.rememberSelection(savedSelection);
				reselect = true;
			}
		}
		
		this._rememberScrollPosition(scrollPosition);
	}
	// For special case in which an item needs to be selected without changes
	// necessarily having been made
	// ('collection-item' add with tag selector open)
	/*else if (selectItem) {
		yield this.selectItem(selectItem);
	}*/
	
	this._updateIntroText();
	
	this._treebox.endUpdateBatch();
	
	// If we made changes to the selection (including reselecting the same item, which will register as
	// a selection when selectEventsSuppressed is set to false), wait for a select event on the tree
	// view (e.g., as triggered by itemsView.runListeners('select') in ZoteroPane::itemSelected())
	// before returning. This guarantees that changes are reflected in the middle and right-hand panes
	// before returning from the save transaction.
	//
	// If no onselect handler is set on the tree element, as is the case in the Advanced Search window,
	// the select listeners never get called, so don't wait.
	let selectPromise;
	var tree = this._getTreeElement();
	var hasOnSelectHandler = tree.getAttribute('onselect') != '';
	if (reselect && hasOnSelectHandler) {
		selectPromise = this.waitForSelect();
		this.selection.selectEventsSuppressed = false;
		Zotero.debug("Yielding for select promise"); // TEMP
		return selectPromise;
	}
	else {
		this.selection.selectEventsSuppressed = false;
	}
});


Zotero.ItemTreeView.prototype.unregister = async function() {
	Zotero.Notifier.unregisterObserver(this._notifierObserverID);
	Zotero.Prefs.unregisterObserver(this._prefObserverID);
	
	if (this.collectionTreeRow.onUnload) {
		await this.collectionTreeRow.onUnload();
	}
	
	if (this.listener) {
		if (!this._treebox.treeBody) {
			Zotero.debug("No more tree body in Zotero.ItemTreeView::unregister()");
			this.listener = null;
			return;
		}
		let tree = this._getTreeElement();
		tree.removeEventListener('keypress', this.listener, false);
		this.listener = null;
	}
};

////////////////////////////////////////////////////////////////////////////////
///
///  nsITreeView functions
///
////////////////////////////////////////////////////////////////////////////////

Zotero.ItemTreeView.prototype.getCellText = function (row, column)
{
	var obj = this.getRow(row);
	var itemID = obj.id;
	
	// If value is available, retrieve synchronously
	if (this._cellTextCache[itemID] && this._cellTextCache[itemID][column.id] !== undefined) {
		return this._cellTextCache[itemID][column.id];
	}
	
	if (!this._cellTextCache[itemID]) {
		this._cellTextCache[itemID] = {}
	}
	
	var val;
	
	// Image only
	if (column.id === "zotero-items-column-hasAttachment") {
		return;
	}
	else if(column.id == "zotero-items-column-itemType")
	{
		val = Zotero.ItemTypes.getLocalizedString(obj.ref.itemTypeID);
	}
	// Year column is just date field truncated
	else if (column.id == "zotero-items-column-year") {
		val = obj.getField('date', true).substr(0, 4)
	}
	else if (column.id === "zotero-items-column-numNotes") {
		val = obj.numNotes();
		if (!val) {
			val = '';
		}
	}
	else {
		var col = column.id.substring(20);
		
		if (col == 'title') {
			val = obj.ref.getDisplayTitle();
		}
		else {
			val = obj.getField(col);
		}
	}
	
	switch (column.id) {
		// Format dates as short dates in proper locale order and locale time
		// (e.g. "4/4/07 14:27:23")
		case 'zotero-items-column-dateAdded':
		case 'zotero-items-column-dateModified':
		case 'zotero-items-column-accessDate':
		case 'zotero-items-column-date':
			if (column.id == 'zotero-items-column-date' && !this.collectionTreeRow.isFeed()) {
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
	
	return this._cellTextCache[itemID][column.id] = val;
}

Zotero.ItemTreeView.prototype.getImageSrc = function(row, col)
{
	if(col.id == 'zotero-items-column-title')
	{
		// Get item type icon and tag swatches
		var item = this.getRow(row).ref;
		var itemID = item.id;
		if (this._itemImages[itemID]) {
			return this._itemImages[itemID];
		}
		item.getImageSrcWithTags()
		.then(function (uriWithTags) {
			this._itemImages[itemID] = uriWithTags;
			this._treebox.invalidateCell(row, col);
		}.bind(this));
		return item.getImageSrc();
	}
	else if (col.id == 'zotero-items-column-hasAttachment') {
		if (this.collectionTreeRow.isTrash()) return false;
		
		var treerow = this.getRow(row);
		var item = treerow.ref;
		
		if ((!this.isContainer(row) || !this.isContainerOpen(row))
				&& Zotero.Sync.Storage.getItemDownloadImageNumber(item)) {
			return '';
		}
		
		var itemID = item.id;
		let suffix = Zotero.hiDPISuffix;
		
		if (treerow.level === 0) {
			if (item.isRegularItem()) {
				let state = item.getBestAttachmentStateCached();
				if (state !== null) {
					switch (state) {
						case 1:
							return `chrome://zotero/skin/bullet_blue${suffix}.png`;
						
						case -1:
							return `chrome://zotero/skin/bullet_blue_empty${suffix}.png`;
						
						default:
							return "";
					}
				}
				
				item.getBestAttachmentState()
				// Refresh cell when promise is fulfilled
				.then(function (state) {
					this._treebox.invalidateCell(row, col);
				}.bind(this))
				.done();
			}
		}
		
		if (item.isFileAttachment()) {
			let exists = item.fileExistsCached();
			if (exists !== null) {
				return exists
					? `chrome://zotero/skin/bullet_blue${suffix}.png`
					: `chrome://zotero/skin/bullet_blue_empty${suffix}.png`;
			}
			
			item.fileExists()
			// Refresh cell when promise is fulfilled
			.then(function (exists) {
				this._treebox.invalidateCell(row, col);
			}.bind(this));
		}
	}
	
	return "";
}

Zotero.ItemTreeView.prototype.isContainer = function(row)
{
	return this.getRow(row).ref.isRegularItem();
}

Zotero.ItemTreeView.prototype.isContainerEmpty = function(row)
{
	if (this.regularOnly) {
		return true;
	}
	
	var item = this.getRow(row).ref;
	if (!item.isRegularItem()) {
		return false;
	}
	var includeTrashed = this.collectionTreeRow.isTrash();
	return item.numNotes(includeTrashed) === 0 && item.numAttachments(includeTrashed) == 0;
}

// Gets the index of the row's container, or -1 if none (top-level)
Zotero.ItemTreeView.prototype.getParentIndex = function(row)
{
	if (row==-1)
	{
		return -1;
	}
	var thisLevel = this.getLevel(row);
	if(thisLevel == 0) return -1;
	for(var i = row - 1; i >= 0; i--)
		if(this.getLevel(i) < thisLevel)
			return i;
	return -1;
}

Zotero.ItemTreeView.prototype.hasNextSibling = function(row,afterIndex)
{
	var thisLevel = this.getLevel(row);
	for(var i = afterIndex + 1; i < this.rowCount; i++)
	{	
		var nextLevel = this.getLevel(i);
		if(nextLevel == thisLevel) return true;
		else if(nextLevel < thisLevel) return false;
	}
}

Zotero.ItemTreeView.prototype.toggleOpenState = function (row, skipRowMapRefresh) {
	// Shouldn't happen but does if an item is dragged over a closed
	// container until it opens and then released, since the container
	// is no longer in the same place when the spring-load closes
	if (!this.isContainer(row)) {
		return;
	}
	
	if (this.isContainerOpen(row)) {
		return this._closeContainer(row, skipRowMapRefresh);
	}
	
	var count = 0;
	var level = this.getLevel(row);
	
	//
	// Open
	//
	var item = this.getRow(row).ref;
	
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
				new Zotero.ItemTreeRow(newRows[i], level + 1, false),
				row + i + 1,
				true
			);
		}
	}
	
	this._rows[row].isOpen = true;
	
	if (count == 0) {
		return;
	}
	
	this._treebox.invalidateRow(row);
	
	if (!skipRowMapRefresh) {
		Zotero.debug('Refreshing item row map');
		this._refreshItemRowMap();
	}
}


Zotero.ItemTreeView.prototype._closeContainer = function (row, skipRowMapRefresh) {
	// isContainer == false shouldn't happen but does if an item is dragged over a closed
	// container until it opens and then released, since the container is no longer in the same
	// place when the spring-load closes
	if (!this.isContainer(row)) return;
	if (!this.isContainerOpen(row)) return;
	
	var count = 0;
	var level = this.getLevel(row);
	
	// Remove child rows
	while ((row + 1 < this._rows.length) && (this.getLevel(row + 1) > level)) {
		// Skip the map update here and just refresh the whole map below,
		// since we might be removing multiple rows
		this._removeRow(row + 1, true);
		count--;
	}
	
	this._rows[row].isOpen = false;
	
	if (count == 0) {
		return;
	}
	
	this._treebox.invalidateRow(row);
	
	if (!skipRowMapRefresh) {
		Zotero.debug('Refreshing item row map');
		this._refreshItemRowMap();
	}
}


Zotero.ItemTreeView.prototype.isSorted = function()
{
	// We sort by the first column if none selected, so return true
	return true;
}

Zotero.ItemTreeView.prototype.cycleHeader = Zotero.Promise.coroutine(function* (column) {
	if (this.collectionTreeRow.isFeed()) {
		return;
	}
	if (column.id == 'zotero-items-column-hasAttachment') {
		Zotero.debug("Caching best attachment states");
		if (!this._cachedBestAttachmentStates) {
			let t = new Date();
			for (let i = 0; i < this._rows.length; i++) {
				let item = this.getRow(i).ref;
				if (item.isRegularItem()) {
					yield item.getBestAttachmentState();
				}
			}
			Zotero.debug("Cached best attachment states in " + (new Date - t) + " ms");
			this._cachedBestAttachmentStates = true;
		}
	}
	for(var i=0, len=this._treebox.columns.count; i<len; i++)
	{
		col = this._treebox.columns.getColumnAt(i);
		if(column != col)
		{
			col.element.removeAttribute('sortActive');
			col.element.removeAttribute('sortDirection');
		}
		else
		{
			// If not yet selected, start with ascending
			if (!col.element.getAttribute('sortActive')) {
				col.element.setAttribute('sortDirection', 'ascending');
			}
			else {
				col.element.setAttribute('sortDirection', col.element.getAttribute('sortDirection') == 'descending' ? 'ascending' : 'descending');
			}
			col.element.setAttribute('sortActive', true);
		}
	}
	
	this.selection.selectEventsSuppressed = true;
	var savedSelection = this.getSelectedItems(true);
	if (savedSelection.length == 1) {
		var pos = this._rowMap[savedSelection[0]] - this._treebox.getFirstVisibleRow();
	}
	this.sort();
	this.rememberSelection(savedSelection);
	// If single row was selected, try to keep it in the same place
	if (savedSelection.length == 1) {
		var newRow = this._rowMap[savedSelection[0]];
		// Calculate the last row that would give us a full view
		var fullTop = Math.max(0, this._rows.length - this._treebox.getPageLength());
		// Calculate the row that would give us the same position
		var consistentTop = Math.max(0, newRow - pos);
		this._treebox.scrollToRow(Math.min(fullTop, consistentTop));
	}
	this._treebox.invalidate();
	this.selection.selectEventsSuppressed = false;
});

/*
 *  Sort the items by the currently sorted column.
 */
Zotero.ItemTreeView.prototype.sort = function (itemIDs) {
	var t = new Date;
	
	// If Zotero pane is hidden, mark tree for sorting later in setTree()
	if (!this._treebox.columns) {
		this._needsSort = true;
		return;
	}
	this._needsSort = false;
	
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
			this._closeContainer(row, true);
			this.toggleOpenState(row, true);
		}
		this._refreshItemRowMap();
		
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
	var dir = this.getSortDirection();
	var order = dir == 'descending' ? -1 : 1;
	var collation = Zotero.getLocaleCollation();
	var sortCreatorAsString = Zotero.Prefs.get('sortCreatorAsString');
	
	Zotero.debug(`Sorting items list by ${sortFields.join(", ")} ${dir} `
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
	sortFields.forEach(x => cache[x] = {})
	
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
				var fieldA = matches ? matches[0] : '';
			}
			creatorSortCache[aItemID] = fieldA;
		}
		if (fieldB === undefined) {
			let firstCreator = Zotero.Items.getSortTitle(sortStringB);
			if (sortCreatorAsString) {
				var fieldB = firstCreator;
			}
			else {
				var matches = andEtAlRegExp.exec(firstCreator);
				var fieldB = matches ? matches[0] : '';
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
	
	// Need to close all containers before sorting
	if (!this.selection.selectEventsSuppressed) {
		var unsuppress = this.selection.selectEventsSuppressed = true;
		this._treebox.beginUpdateBatch();
	}
	var savedSelection = this.getSelectedItems(true);
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
	
	this._refreshItemRowMap();
	
	this.rememberOpenState(openItemIDs);
	this.rememberSelection(savedSelection);
	
	if (unsuppress) {
		this._treebox.endUpdateBatch();
		this.selection.selectEventsSuppressed = false;
	}
	
	this._treebox.invalidate();
	
	var numSorted = itemIDs ? itemIDs.length : this._rows.length;
	Zotero.debug(`Sorted ${numSorted} ${Zotero.Utilities.pluralize(numSorted, ['item', 'items'])} `
		+ `in ${new Date - t} ms`);
};


/**
 * Show intro text in middle pane for some views when no items
 */
Zotero.ItemTreeView.prototype._updateIntroText = function() {
	if (!this.window.ZoteroPane) {
		return;
	}
	
	if (this.collectionTreeRow && !this.rowCount) {
		let doc = this._ownerDocument;
		let ns = 'http://www.w3.org/1999/xhtml'
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
				`<span class="text-link" data-href="${ZOTERO_CONFIG.QUICK_START_URL}">$1</span>`
					+ '$2'
					+ `<span class="text-link" data-href="${ZOTERO_CONFIG.CONNECTORS_URL}">$3</span>`
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
			p.textContent = Zotero.getString('publications.intro.text1', ZOTERO_CONFIG.DOMAIN_NAME);
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
		this.window.ZoteroPane.clearItemsPaneMessage();
		this._introText = false;
	}
};


////////////////////////////////////////////////////////////////////////////////
///
///  Additional functions for managing data in the tree
///
////////////////////////////////////////////////////////////////////////////////


/*
 *  Select an item
 */
Zotero.ItemTreeView.prototype.selectItem = async function (id) {
	return this.selectItems([id]);
};

Zotero.ItemTreeView.prototype.selectItems = async function (ids, noRecurse) {
	if (!ids.length) return 0;
	
	// If no row map, we're probably in the process of switching collections,
	// so store the items to select on the item group for later
	if (!this._rowMap) {
		if (this.collectionTreeRow) {
			this.collectionTreeRow.itemsToSelect = ids;
			Zotero.debug("_rowMap not yet set; not selecting items");
			return 0;
		}
		
		Zotero.debug('Item group not found and no row map in ItemTreeView.selectItem() -- discarding select', 2);
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
				if (!noRecurse && this.window.ZoteroPane) {
					let cleared1 = await this.window.ZoteroPane.clearQuicksearch();
					let cleared2 = this.window.ZoteroPane.tagSelector
						&& this.window.ZoteroPane.tagSelector.clearTagSelection();
					if (cleared1 || cleared2) {
						return this.selectItems(ids, true);
					}
				}
				
				Zotero.debug(`Couldn't find row for item ${id} -- not selecting`);
				continue;
			}
			
			// If parent is already open and we haven't found the item, the child
			// hasn't yet been added to the view, so close parent to allow refresh
			this._closeContainer(parentRow);
			
			// Open the parent
			this.toggleOpenState(parentRow);
		}
		
		// Since we're opening containers, we still need to reference by id
		idsToSelect.push(id);
	}
	
	// Now that all items have been expanded, get associated rows
	var rowsToSelect = [];
	for (let id of idsToSelect) {
		let row = this._rowMap[id];
		rowsToSelect.push(row);
	}
	
	// If items are already selected, just scroll to the top-most one
	var selectedRows = new Set(this.getSelectedRowIndexes());
	if (rowsToSelect.length == selectedRows.size && rowsToSelect.every(row => selectedRows.has(row))) {
		this.ensureRowsAreVisible(rowsToSelect);
		return rowsToSelect.length;
	}
	
	// Single item
	if (rowsToSelect.length == 1) {
		// this.selection.select() triggers the <tree>'s 'onselect' attribute, which calls
		// ZoteroPane.itemSelected(), which calls ZoteroItemPane.viewItem(), which refreshes the
		// itembox. But since the 'onselect' doesn't handle promises, itemSelected() isn't waited for
		// here, which means that 'yield selectItem(itemID)' continues before the itembox has been
		// refreshed. To get around this, we wait for a select event that's triggered by
		// itemSelected() when it's done.
		let promise;
		try {
			if (!this.selection.selectEventsSuppressed) {
				promise = this.waitForSelect();
			}
			this.selection.select(rowsToSelect[0]);
		}
		// Ignore NS_ERROR_UNEXPECTED from nsITreeSelection::select(), apparently when the tree
		// disappears before it's called (though I can't reproduce it):
		//
		// https://forums.zotero.org/discussion/comment/297039/#Comment_297039
		catch (e) {
			Zotero.logError(e);
		}
		
		if (promise) {
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
};


Zotero.ItemTreeView.prototype.ensureRowsAreVisible = function (rows) {
	const firstVisibleRow = this._treebox.getFirstVisibleRow();
	const pageLength = this._treebox.getPageLength();
	const lastVisibleRow = firstVisibleRow + pageLength;
	const maxBuffer = 5;
	
	var isRowVisible = function (row) {
		return row >= firstVisibleRow && row <= lastVisibleRow;
	};
	
	rows = rows.concat();
	rows.sort((a, b) => a - b);
	
	var rowsWithParents = [];
	for (let row of rows) {
		let parent = this.getParentIndex(row);
		rowsWithParents.push(parent != -1 ? parent : row);
	}
	
	// If all rows are visible, don't change anything
	if (rows.every(row => isRowVisible(row))) {
		//Zotero.debug("All rows are visible");
		return;
	}
	
	// If we can fit all parent rows in view, do that
	for (let buffer = maxBuffer; buffer >= 0; buffer--) {
		if (rowsWithParents[rowsWithParents.length - 1] - rowsWithParents[0] - buffer < pageLength) {
			//Zotero.debug(`We can fit all parent rows with buffer ${buffer}`);
			this._treebox.scrollToRow(rowsWithParents[0] - buffer);
			return;
		}
	}
	
	// If we can fit all rows in view, do that
	for (let buffer = maxBuffer; buffer >= 0; buffer--) {
		if (rows[rows.length - 1] - rows[0] - buffer < pageLength) {
			//Zotero.debug(`We can fit all rows with buffer ${buffer}`);
			this._treebox.scrollToRow(rows[0] - buffer);
			return;
		}
	}
	
	// If more than half of the rows are visible, don't change anything
	var visible = 0;
	for (let row of rows) {
		if (isRowVisible(row)) {
			visible++;
		}
	}
	if (visible > rows / 2) {
		//Zotero.debug("More than half of rows are visible");
		return;
	}
	
	// If the first parent row isn't in view and we have enough room, make it visible, trying to
	// put it five rows from the top
	if (rows[0] != rowsWithParents[0]) {
		for (let buffer = maxBuffer; buffer >= 0; buffer--) {
			 if (rows[0] - rowsWithParents[0] - buffer <= pageLength) {
				//Zotero.debug(`Scrolling to first parent minus ${buffer}`);
				this._treebox.scrollToRow(rowsWithParents[0] - buffer);
				return;
			}
		}
	}
	
	// Otherwise just put the first row at the top
	//Zotero.debug("Scrolling to first row " + Math.max(rows[0] - maxBuffer, 0));
	this._treebox.scrollToRow(Math.max(rows[0] - maxBuffer, 0));
};


/*
 * Return an array of Item objects for selected items
 *
 * If asIDs is true, return an array of itemIDs instead
 */
Zotero.ItemTreeView.prototype.getSelectedItems = function(asIDs)
{
	var items = [], start = {}, end = {};
	for (var i=0, len = this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++) {
			let row = this.getRow(j);
			if (!row) {
				Zotero.logError(`Row ${j} not found`);
				continue;
			}
			items.push(asIDs ? row.id : row.ref);
		}
	}
	return items;
}


/**
 * Delete the selection
 *
 * @param	{Boolean}	[force=false]	Delete item even if removing from a collection
 */
Zotero.ItemTreeView.prototype.deleteSelection = Zotero.Promise.coroutine(function* (force)
{
	if (arguments.length > 1) {
		throw ("deleteSelection() no longer takes two parameters");
	}
	
	if (this.selection.count == 0) {
		return;
	}
	
	//this._treebox.beginUpdateBatch();
	
	// Collapse open items
	for (var i=0; i<this.rowCount; i++) {
		if (this.selection.isSelected(i) && this.isContainer(i)) {
			this._closeContainer(i, true);
		}
	}
	this._refreshItemRowMap();
	
	// Create an array of selected items
	var ids = [];
	var start = {};
	var end = {};
	for (var i=0, len=this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++)
			ids.push(this.getRow(j).id);
	}
	
	var collectionTreeRow = this.collectionTreeRow;
	
	if (collectionTreeRow.isBucket()) {
		collectionTreeRow.ref.deleteItems(ids);
	}
	if (collectionTreeRow.isTrash()) {
		yield Zotero.Items.erase(ids);
	}
	else if (collectionTreeRow.isLibrary(true) || force) {
		yield Zotero.Items.trashTx(ids);
	}
	else if (collectionTreeRow.isCollection()) {
		yield Zotero.DB.executeTransaction(function* () {
			yield collectionTreeRow.ref.removeItems(ids);
		});
	}
	else if (collectionTreeRow.isPublications()) {
		yield Zotero.Items.removeFromPublications(ids.map(id => Zotero.Items.get(id)));
	}

	//this._treebox.endUpdateBatch();
});


/*
 * Set the search/tags filter on the view
 */
Zotero.ItemTreeView.prototype.setFilter = Zotero.Promise.coroutine(function* (type, data) {
	if (!this._treebox || !this._treebox.treeBody) {
		Components.utils.reportError("Treebox didn't exist in itemTreeView.setFilter()");
		return;
	}
	
	this.selection.selectEventsSuppressed = true;
	//this._treebox.beginUpdateBatch();
	
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
	var oldCount = this.rowCount;
	yield this.refresh();
	
	//this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
});


/*
 *  Create map of item ids to row indexes
 */
Zotero.ItemTreeView.prototype._refreshItemRowMap = function()
{
	var rowMap = {};
	for (var i=0, len=this.rowCount; i<len; i++) {
		let row = this.getRow(i);
		let id = row.ref.id;
		if (rowMap[id] !== undefined) {
			Zotero.debug(`WARNING: Item row ${rowMap[id]} already found for item ${id} at ${i}`, 2);
			Zotero.debug(new Error().stack, 2);
		}
		rowMap[id] = i;
	}
	this._rowMap = rowMap;
}


Zotero.ItemTreeView.prototype.saveSelection = function () {
	Zotero.debug("Zotero.ItemTreeView::saveSelection() is deprecated -- use getSelectedItems(true)");
	return this.getSelectedItems(true);
}


/*
 *  Sets the selection based on saved selection ids
 */
Zotero.ItemTreeView.prototype.rememberSelection = function (selection) {
	if (!selection.length) {
		return;
	}
	
	this.selection.clearSelection();
	
	if (!this.selection.selectEventsSuppressed) {
		var unsuppress = this.selection.selectEventsSuppressed = true;
		this._treebox.beginUpdateBatch();
	}
	
	try {
		for (let i = 0; i < selection.length; i++) {
			if (this._rowMap[selection[i]] != null) {
				this.selection.toggleSelect(this._rowMap[selection[i]]);
			}
			// Try the parent
			else {
				var item = Zotero.Items.get(selection[i]);
				if (!item) {
					continue;
				}
				
				var parent = item.parentItemID;
				if (!parent) {
					continue;
				}
				
				if (this._rowMap[parent] != null) {
					this._closeContainer(this._rowMap[parent]);
					this.toggleOpenState(this._rowMap[parent]);
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
	
	if (unsuppress) {
		this._treebox.endUpdateBatch();
		this.selection.selectEventsSuppressed = false;
	}
}


Zotero.ItemTreeView.prototype.selectSearchMatches = function () {
	if (this._searchMode) {
		this.rememberSelection(Array.from(this._searchItemIDs));
	}
	else {
		this.selection.clearSelection();
	}
}


Zotero.ItemTreeView.prototype._saveOpenState = function (close) {
	var itemIDs = [];
	if (close) {
		if (!this.selection.selectEventsSuppressed) {
			var unsuppress = this.selection.selectEventsSuppressed = true;
			this._treebox.beginUpdateBatch();
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
		this._refreshItemRowMap();
		if (unsuppress) {
			this._treebox.endUpdateBatch();
			this.selection.selectEventsSuppressed = false;
		}
	}
	return itemIDs;
}


Zotero.ItemTreeView.prototype.rememberOpenState = function (itemIDs) {
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
		this._treebox.beginUpdateBatch();
	}
	// Reopen from bottom up
	for (var i=rowsToOpen.length-1; i>=0; i--) {
		this.toggleOpenState(rowsToOpen[i], true);
	}
	this._refreshItemRowMap();
	if (unsuppress) {
		this._treebox.endUpdateBatch();
		this.selection.selectEventsSuppressed = false;
	}
}


Zotero.ItemTreeView.prototype.expandMatchParents = function (searchParentIDs) {
	var t = new Date();
	var time = 0;
	// Expand parents of child matches
	if (!this._searchMode) {
		return;
	}
	
	if (!this.selection.selectEventsSuppressed) {
		var unsuppress = this.selection.selectEventsSuppressed = true;
		this._treebox.beginUpdateBatch();
	}
	for (var i=0; i<this.rowCount; i++) {
		var id = this.getRow(i).ref.id;
		if (searchParentIDs.has(id) && this.isContainer(i) && !this.isContainerOpen(i)) {
			var t2 = new Date();
			this.toggleOpenState(i, true);
			time += (new Date() - t2);
		}
	}
	this._refreshItemRowMap();
	if (unsuppress) {
		this._treebox.endUpdateBatch();
		this.selection.selectEventsSuppressed = false;
	}
}


Zotero.ItemTreeView.prototype.expandAllRows = function () {
	var unsuppress = this.selection.selectEventsSuppressed = true;
	this._treebox.beginUpdateBatch();
	for (var i=0; i<this.rowCount; i++) {
		if (this.isContainer(i) && !this.isContainerOpen(i)) {
			this.toggleOpenState(i, true);
		}
	}
	this._refreshItemRowMap();
	this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
}


Zotero.ItemTreeView.prototype.collapseAllRows = function () {
	var unsuppress = this.selection.selectEventsSuppressed = true;
	this._treebox.beginUpdateBatch();
	for (var i=0; i<this.rowCount; i++) {
		if (this.isContainer(i)) {
			this._closeContainer(i, true);
		}
	}
	this._refreshItemRowMap();
	this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
};


Zotero.ItemTreeView.prototype.expandSelectedRows = function () {
	var start = {}, end = {};
	this.selection.selectEventsSuppressed = true;
	this._treebox.beginUpdateBatch();
	for (var i = 0, len = this.selection.getRangeCount(); i<len; i++) {
		this.selection.getRangeAt(i, start, end);
		for (var j = start.value; j <= end.value; j++) {
			if (this.isContainer(j) && !this.isContainerOpen(j)) {
				this.toggleOpenState(j, true);
			}
		}
	}
	this._refreshItemRowMap();
	this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
}


Zotero.ItemTreeView.prototype.collapseSelectedRows = function () {
	var start = {}, end = {};
	this.selection.selectEventsSuppressed = true;
	this._treebox.beginUpdateBatch();
	for (var i = 0, len = this.selection.getRangeCount(); i<len; i++) {
		this.selection.getRangeAt(i, start, end);
		for (let j = end.value; j >= start.value; j--) {
			if (this.isContainer(j)) {
				this._closeContainer(j, true);
			}
		}
	}
	this._refreshItemRowMap();
	this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
}


Zotero.ItemTreeView.prototype.getVisibleFields = function() {
	var columns = [];
	for (var i=0, len=this._treebox.columns.count; i<len; i++) {
		var col = this._treebox.columns.getColumnAt(i);
		if (col.element.getAttribute('hidden') != 'true') {
			columns.push(col.id.substring(20));
		}
	}
	return columns;
}


/**
 * Returns an array of items of visible items in current sort order
 *
 * @param {Boolean} asIDs - Return itemIDs
 * @return {Zotero.Item[]|Integer[]} - An array of Zotero.Item objects or itemIDs
 */
Zotero.ItemTreeView.prototype.getSortedItems = function(asIDs) {
	return this._rows.map(row => asIDs ? row.ref.id : row.ref);
}


Zotero.ItemTreeView.prototype.getSortField = function() {
	if (this.collectionTreeRow.isFeed()) {
		return 'id';
	}
	var column = this._treebox.columns.getSortedColumn();
	if (!column) {
		column = this._treebox.columns.getFirstColumn();
	}
	// zotero-items-column-_________
	return column.id.substring(20);
}


Zotero.ItemTreeView.prototype.getSortFields = function () {
	var fields = [this.getSortField()];
	var secondaryField = this.getSecondarySortField();
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
		Components.utils.reportError(e);
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


/*
 * Returns 'ascending' or 'descending'
 */
Zotero.ItemTreeView.prototype.getSortDirection = function() {
	if (this.collectionTreeRow.isFeed()) {
		return Zotero.Prefs.get('feeds.sortAscending') ? 'ascending' : 'descending';
	}
	var column = this._treebox.columns.getSortedColumn();
	if (!column) {
		return 'ascending';
	}
	return column.element.getAttribute('sortDirection');
}


Zotero.ItemTreeView.prototype.getSecondarySortField = function () {
	var primaryField = this.getSortField();
	var secondaryField = Zotero.Prefs.get('secondarySort.' + primaryField);
	if (!secondaryField || secondaryField == primaryField) {
		return false;
	}
	return secondaryField;
}


Zotero.ItemTreeView.prototype.setSecondarySortField = function (secondaryField) {
	var primaryField = this.getSortField();
	var currentSecondaryField = this.getSecondarySortField();
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
 * Build the More Columns and Secondary Sort submenus while the popup is opening
 */
Zotero.ItemTreeView.prototype.onColumnPickerShowing = function (event) {
	var menupopup = event.originalTarget;
	
	var ns = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
	var prefix = 'zotero-column-header-';
	var doc = menupopup.ownerDocument;
	
	var anonid = menupopup.getAttribute('anonid');
	if (anonid.indexOf(prefix) == 0) {
		return;
	}
	
	var lastChild = menupopup.lastChild;
	
	try {
		// More Columns menu
		let id = prefix + 'more-menu';
		
		let moreMenu = doc.createElementNS(ns, 'menu');
		moreMenu.setAttribute('label', Zotero.getString('pane.items.columnChooser.moreColumns'));
		moreMenu.setAttribute('anonid', id);
		
		let moreMenuPopup = doc.createElementNS(ns, 'menupopup');
		moreMenuPopup.setAttribute('anonid', id + '-popup');
		
		let treecols = menupopup.parentNode.parentNode;
		let subs = Array.from(treecols.getElementsByAttribute('submenu', 'true'))
			.map(x => x.getAttribute('label'));
		
		var moreItems = [];
		
		for (let i=0; i<menupopup.childNodes.length; i++) {
			let elem = menupopup.childNodes[i];
			if (elem.localName == 'menuseparator') {
				break;
			}
			if (elem.localName == 'menuitem' && subs.indexOf(elem.getAttribute('label')) != -1) {
				moreItems.push(elem);
			}
		}

		// Disable certain fields for feeds
		let labels = Array.from(treecols.getElementsByAttribute('disabled-in', '*'))
			.filter(e => e.getAttribute('disabled-in').split(' ').indexOf(this.collectionTreeRow.type) != -1)
			.map(e => e.getAttribute('label'));
		for (let i = 0; i < menupopup.childNodes.length; i++) {
			let elem = menupopup.childNodes[i];
			elem.setAttribute('disabled', labels.indexOf(elem.getAttribute('label')) != -1);
		}
		
		// Sort fields and move to submenu
		var collation = Zotero.getLocaleCollation();
		moreItems.sort(function (a, b) {
			return collation.compareString(1, a.getAttribute('label'), b.getAttribute('label'));
		});
		moreItems.forEach(function (elem) {
			moreMenuPopup.appendChild(menupopup.removeChild(elem));
		});
		
		moreMenu.appendChild(moreMenuPopup);
		menupopup.insertBefore(moreMenu, lastChild);
	}
	catch (e) {
		Components.utils.reportError(e);
		Zotero.debug(e, 1);
	}
	
	//
	// Secondary Sort menu
	//
	if (!this.collectionTreeRow.isFeed()) {
		try {
			let id = prefix + 'sort-menu';
			let primaryField = this.getSortField();
			let sortFields = this.getSortFields();
			let secondaryField = false;
			if (sortFields[1]) {
				secondaryField = sortFields[1];
			}
			
			// Get localized names from treecols, since the names are currently done via .dtd
			let treecols = menupopup.parentNode.parentNode;
			let primaryFieldLabel = treecols.getElementsByAttribute('id',
				'zotero-items-column-' + primaryField)[0].getAttribute('label');
			
			let sortMenu = doc.createElementNS(ns, 'menu');
			sortMenu.setAttribute('label',
				Zotero.getString('pane.items.columnChooser.secondarySort', primaryFieldLabel));
			sortMenu.setAttribute('anonid', id);
			
			let sortMenuPopup = doc.createElementNS(ns, 'menupopup');
			sortMenuPopup.setAttribute('anonid', id + '-popup');
			
			// Generate menuitems
			let sortOptions = [
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
			for (let i=0; i<sortOptions.length; i++) {
				let field = sortOptions[i];
				// Hide current primary field, and don't show Year for Date, since it would be a no-op
				if (field == primaryField || (primaryField == 'date' && field == 'year')) {
					continue;
				}
				let label = treecols.getElementsByAttribute('id',
					'zotero-items-column-' + field)[0].getAttribute('label');
				
				let sortMenuItem = doc.createElementNS(ns, 'menuitem');
				sortMenuItem.setAttribute('fieldName', field);
				sortMenuItem.setAttribute('label', label);
				sortMenuItem.setAttribute('type', 'checkbox');
				if (field == secondaryField) {
					sortMenuItem.setAttribute('checked', 'true');
				}
				sortMenuItem.setAttribute('oncommand',
					'var view = ZoteroPane.itemsView; '
					+ 'if (view.setSecondarySortField(this.getAttribute("fieldName"))) { view.sort(); }');
				sortMenuPopup.appendChild(sortMenuItem);
			}
			
			sortMenu.appendChild(sortMenuPopup);
			menupopup.insertBefore(sortMenu, lastChild);
		}
		catch (e) {
			Components.utils.reportError(e);
			Zotero.debug(e, 1);
		}
	}
	
	sep = doc.createElementNS(ns, 'menuseparator');
	sep.setAttribute('anonid', prefix + 'sep');
	menupopup.insertBefore(sep, lastChild);
}


Zotero.ItemTreeView.prototype.onColumnPickerHidden = function (event) {
	var menupopup = event.originalTarget;
	var prefix = 'zotero-column-header-';
	
	for (let i=0; i<menupopup.childNodes.length; i++) {
		let elem = menupopup.childNodes[i];
		if (elem.getAttribute('anonid').indexOf(prefix) == 0) {
			try {
				menupopup.removeChild(elem);
			}
			catch (e) {
				Zotero.debug(e, 1);
			}
			i--;
		}
	}
}


Zotero.ItemTreeView.prototype._getTreeElement = function () {
	return this._treebox.treeBody && this._treebox.treeBody.parentNode;
}


////////////////////////////////////////////////////////////////////////////////
///
///  Command Controller:
///		for Select All, etc.
///
////////////////////////////////////////////////////////////////////////////////

Zotero.ItemTreeCommandController = function(tree)
{
	this.tree = tree;
}

Zotero.ItemTreeCommandController.prototype.supportsCommand = function(cmd)
{
	return (cmd == 'cmd_selectAll');
}

Zotero.ItemTreeCommandController.prototype.isCommandEnabled = function(cmd)
{
	return (cmd == 'cmd_selectAll');
}

Zotero.ItemTreeCommandController.prototype.doCommand = function (cmd) {
	if (cmd == 'cmd_selectAll') {
		if (this.tree.view.wrappedJSObject.collectionTreeRow.isSearchMode()) {
			this.tree.view.wrappedJSObject.selectSearchMatches();
		}
		else {
			this.tree.view.selection.selectAll();
		}
	}
}

Zotero.ItemTreeCommandController.prototype.onEvent = function(evt)
{
	
}

////////////////////////////////////////////////////////////////////////////////
///
///  Drag-and-drop functions
///
////////////////////////////////////////////////////////////////////////////////

/**
 * Start a drag using HTML 5 Drag and Drop
 */
Zotero.ItemTreeView.prototype.onDragStart = function (event) {
	// See note in LibraryTreeView::_setDropEffect()
	if (Zotero.isWin || Zotero.isLinux) {
		event.dataTransfer.effectAllowed = 'copyMove';
	}
	
	var itemIDs = this.getSelectedItems(true);
	event.dataTransfer.setData("zotero/item", itemIDs);
	// dataTransfer.mozSourceNode doesn't seem to be properly set anymore (tested in 50), so store
	// event target separately
	if (!event.dataTransfer.mozSourceNode) {
		Zotero.debug("mozSourceNode not set -- storing source node");
		Zotero.DragDrop.currentSourceNode = event.target;
	}
	
	var items = Zotero.Items.get(itemIDs);
	
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
			dataProvider = new Zotero.ItemTreeView.fileDragDataProvider(itemIDs);
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
				let fph = Components.classes["@mozilla.org/network/protocol;1?name=file"]
					.createInstance(Components.interfaces.nsIFileProtocolHandler);
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
			Components.utils.reportError("Invalid Quick Copy mode");
		}
	}
	catch (e) {
		Zotero.debug(e);
		Components.utils.reportError(e + " with '" + format.id + "'");
	}
};

Zotero.ItemTreeView.prototype.onDragEnd = function (event) {
	setTimeout(function () {
		Zotero.DragDrop.currentDragSource = null;
	});
}


// Implements nsIFlavorDataProvider for dragging attachment files to OS
//
// Not used on Windows in Firefox 3 or higher
Zotero.ItemTreeView.fileDragDataProvider = function (itemIDs) {
	this._itemIDs = itemIDs;
};

Zotero.ItemTreeView.fileDragDataProvider.prototype = {
	QueryInterface : function(iid) {
		if (iid.equals(Components.interfaces.nsIFlavorDataProvider) ||
				iid.equals(Components.interfaces.nsISupports)) {
			return this;
		}
		throw Components.results.NS_NOINTERFACE;
	},
	
	getFlavorData : function(transferable, flavor, data, dataLen) {
		Zotero.debug("Getting flavor data for " + flavor);
		if (flavor == "application/x-moz-file-promise") {
			// On platforms other than OS X, the only directory we know of here
			// is the system temp directory, and we pass the nsIFile of the file
			// copied there in data.value below
			var useTemp = !Zotero.isMac;
			
			// Get the destination directory
			var dirPrimitive = {};
			var dataSize = {};
			transferable.getTransferData("application/x-moz-file-promise-dir", dirPrimitive, dataSize);
			var destDir = dirPrimitive.value.QueryInterface(Components.interfaces.nsIFile);
			
			var draggedItems = Zotero.Items.get(this._itemIDs);
			var items = [];
			
			// Make sure files exist
			var notFoundNames = [];
			for (var i=0; i<draggedItems.length; i++) {
				// TODO create URL?
				if (!draggedItems[i].isAttachment() ||
						draggedItems[i].getAttachmentLinkMode() == Zotero.Attachments.LINK_MODE_LINKED_URL) {
					continue;
				}
				
				if (draggedItems[i].getFile()) {
					items.push(draggedItems[i]);
				}
				else {
					notFoundNames.push(draggedItems[i].getField('title'));
				}
			}
			
			// If using the temp directory, create a directory to store multiple
			// files, since we can (it seems) only pass one nsIFile in data.value
			if (useTemp && items.length > 1) {
				var tmpDirName = 'Zotero Dragged Files';
				destDir.append(tmpDirName);
				if (destDir.exists()) {
					destDir.remove(true);
				}
				destDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
			}
			
			var copiedFiles = [];
			var existingItems = [];
			var existingFileNames = [];
			
			for (var i=0; i<items.length; i++) {
				// TODO create URL?
				if (!items[i].isAttachment() ||
						items[i].attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
					continue;
				}
				
				var file = items[i].getFile();
				
				// Determine if we need to copy multiple files for this item
				// (web page snapshots)
				if (items[i].attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_FILE) {
					var parentDir = file.parent;
					var files = parentDir.directoryEntries;
					var numFiles = 0;
					while (files.hasMoreElements()) {
						var f = files.getNext();
						f.QueryInterface(Components.interfaces.nsIFile);
						if (f.leafName.indexOf('.') != 0) {
							numFiles++;
						}
					}
				}
				
				// Create folder if multiple files
				if (numFiles > 1) {
					var dirName = Zotero.Attachments.getFileBaseNameFromItem(items[i]);
					try {
						if (useTemp) {
							var copiedFile = destDir.clone();
							copiedFile.append(dirName);
							if (copiedFile.exists()) {
								// If item directory already exists in the temp dir,
								// delete it
								if (items.length == 1) {
									copiedFile.remove(true);
								}
								// If item directory exists in the container
								// directory, it's a duplicate, so give this one
								// a different name
								else {
									copiedFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o644);
									var newName = copiedFile.leafName;
									copiedFile.remove(null);
								}
							}
						}
						
						parentDir.copyToFollowingLinks(destDir, newName ? newName : dirName);
						
						// Store nsIFile
						if (useTemp) {
							copiedFiles.push(copiedFile);
						}
					}
					catch (e) {
						if (e.name == 'NS_ERROR_FILE_ALREADY_EXISTS') {
							// Keep track of items that already existed
							existingItems.push(items[i].id);
							existingFileNames.push(dirName);
						}
						else {
							throw (e);
						}
					}
				}
				// Otherwise just copy
				else {
					try {
						if (useTemp) {
							var copiedFile = destDir.clone();
							copiedFile.append(file.leafName);
							if (copiedFile.exists()) {
								// If file exists in the temp directory,
								// delete it
								if (items.length == 1) {
									copiedFile.remove(true);
								}
								// If file exists in the container directory,
								// it's a duplicate, so give this one a different
								// name
								else {
									copiedFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o644);
									var newName = copiedFile.leafName;
									copiedFile.remove(null);
								}
							}
						}
						
						file.copyToFollowingLinks(destDir, newName ? newName : null);
						
						// Store nsIFile
						if (useTemp) {
							copiedFiles.push(copiedFile);
						}
					}
					catch (e) {
						if (e.name == 'NS_ERROR_FILE_ALREADY_EXISTS') {
							existingItems.push(items[i].id);
							existingFileNames.push(items[i].getFile().leafName);
						}
						else {
							throw (e);
						}
					}
				}
			}
			
			// Files passed via data.value will be automatically moved
			// from the temp directory to the destination directory
			if (useTemp && copiedFiles.length) {
				if (items.length > 1) {
					data.value = destDir.QueryInterface(Components.interfaces.nsISupports);
				}
				else {
					data.value = copiedFiles[0].QueryInterface(Components.interfaces.nsISupports);
				}
				dataLen.value = 4;
			}
			
			if (notFoundNames.length || existingItems.length) {
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
			}
			
			// Display alert if files were not found
			if (notFoundNames.length > 0) {
				// On platforms that use a temporary directory, an alert here
				// would interrupt the dragging process, so we just log a
				// warning to the console
				if (useTemp) {
					for (let name of notFoundNames) {
						var msg = "Attachment file for dragged item '" + name + "' not found";
						Zotero.log(msg, 'warning',
							'chrome://zotero/content/xpcom/itemTreeView.js');
					}
				}
				else {
					promptService.alert(null, Zotero.getString('general.warning'),
						Zotero.getString('dragAndDrop.filesNotFound') + "\n\n"
						+ notFoundNames.join("\n"));
				}
			}
			
			// Display alert if existing files were skipped
			if (existingItems.length > 0) {
				promptService.alert(null, Zotero.getString('general.warning'),
					Zotero.getString('dragAndDrop.existingFiles') + "\n\n"
					+ existingFileNames.join("\n"));
			}
		}
	}
}


/**
 * Called by treechildren.onDragOver() before setting the dropEffect,
 * which is checked in libraryTreeView.canDrop()
 */
Zotero.ItemTreeView.prototype.canDropCheck = function (row, orient, dataTransfer) {
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
Zotero.ItemTreeView.prototype.drop = Zotero.Promise.coroutine(function* (row, orient, dataTransfer) {
	if (!this.canDrop(row, orient, dataTransfer)) {
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
			yield Zotero.DB.executeTransaction(function* () {
				for (let i=0; i<items.length; i++) {
					let item = items[i];
					item.parentID = rowItem.id;
					yield item.save();
				}
			});
		}
		
		// Dropped outside of a row
		else
		{
			// Remove from parent and make top-level
			if (collectionTreeRow.isLibrary(true)) {
				yield Zotero.DB.executeTransaction(function* () {
					for (let i=0; i<items.length; i++) {
						let item = items[i];
						if (!item.isRegularItem()) {
							item.parentID = false;
							yield item.save()
						}
					}
				});
			}
			// Add to collection
			else
			{
				yield Zotero.DB.executeTransaction(function* () {
					for (let i=0; i<items.length; i++) {
						let item = items[i];
						var source = item.isRegularItem() ? false : item.parentItemID;
						// Top-level item
						if (source) {
							item.parentID = false;
							item.addToCollection(collectionTreeRow.ref.id);
							yield item.save();
						}
						else {
							item.addToCollection(collectionTreeRow.ref.id);
							yield item.save();
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
				yield Zotero.DB.executeTransaction(function* () {
					yield collectionTreeRow.ref.removeItems(toMove);
				}.bind(this));
			}
		}
	}
	else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
		// Disallow drop into read-only libraries
		if (!collectionTreeRow.editable) {
			let win = Services.wm.getMostRecentWindow("navigator:browser");
			win.ZoteroPane.displayCannotEditLibraryMessage();
			return;
		}
		
		var targetLibraryID = collectionTreeRow.ref.libraryID;
		
		var parentItemID = false;
		var parentCollectionID = false;
		
		if (orient == 0) {
			let treerow = this.getRow(row);
			parentItemID = treerow.ref.id
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
						let item;
						if (parentItemID) {
							if (!collectionTreeRow.filesEditable) {
								let win = Services.wm.getMostRecentWindow("navigator:browser");
								win.ZoteroPane.displayCannotEditLibraryFilesMessage();
								return;
							}
							item = yield Zotero.Attachments.importFromURL({
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
							let win = Services.wm.getMostRecentWindow("navigator:browser");
							item = yield win.ZoteroPane.addItemFromURL(url, 'temporaryPDFHack'); // TODO: don't do this
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
					 fileBaseName = yield Zotero.Attachments.getRenamedFileBaseNameIfAllowedType(
						parentItem, file
					);
				}
				
				let item;
				if (dropEffect == 'link') {
					// Rename linked file, with unique suffix if necessary
					try {
						if (fileBaseName) {
							let ext = Zotero.File.getExtension(file);
							let newName = yield Zotero.File.rename(
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
					
					item = yield Zotero.Attachments.linkFromFile({
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
						let win = Services.wm.getMostRecentWindow("navigator:browser");
						win.ZoteroPane.displayCannotAddShortcutMessage(file);
						continue;
					}
					
					item = yield Zotero.Attachments.importFromFile({
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
							yield OS.File.remove(file);
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
			yield Zotero.Notifier.commit(notifierQueue);
		}
		
		// Automatically retrieve metadata for PDFs
		if (!parentItemID) {
			Zotero.RecognizePDF.autoRecognizeItems(addedItems);
		}
	}
});


////////////////////////////////////////////////////////////////////////////////
///
///  Functions for nsITreeView that we have to stub out.
///
////////////////////////////////////////////////////////////////////////////////

Zotero.ItemTreeView.prototype.isSeparator = function(row) 						{ return false; }
Zotero.ItemTreeView.prototype.isSelectable = function (row, col) { return true; }
Zotero.ItemTreeView.prototype.getRowProperties = function(row, prop) {}
Zotero.ItemTreeView.prototype.getColumnProperties = function(col, prop) {}
Zotero.ItemTreeView.prototype.getCellProperties = function(row, col, prop) {
	var treeRow = this.getRow(row);
	var itemID = treeRow.ref.id;
	
	var props = [];
	
	// Mark items not matching search as context rows, displayed in gray
	if (this._searchMode && !this._searchItemIDs.has(itemID)) {
		props.push("contextRow");
	}
	
	// Mark hasAttachment column, which needs special image handling
	if (col.id == 'zotero-items-column-hasAttachment') {
		props.push("hasAttachment");
		
		// Don't show pie for open parent items, since we show it for the
		// child item
		if (!this.isContainer(row) || !this.isContainerOpen(row)) {
			var num = Zotero.Sync.Storage.getItemDownloadImageNumber(treeRow.ref);
			//var num = Math.round(new Date().getTime() % 10000 / 10000 * 64);
			if (num !== false) props.push("pie", "pie" + num);
		}
	}
	
	// Style unread items in feeds
	if (treeRow.ref.isFeedItem && !treeRow.ref.isRead) props.push('unread');
	
	return props.join(" ");
}

Zotero.ItemTreeRow = function(ref, level, isOpen)
{
	this.ref = ref;			//the item associated with this
	this.level = level;
	this.isOpen = isOpen;
	this.id = ref.id;
}

Zotero.ItemTreeRow.prototype.getField = function(field, unformatted)
{
	return this.ref.getField(field, unformatted, true);
}

Zotero.ItemTreeRow.prototype.numNotes = function() {
	if (this.ref.isNote()) {
		return 0;
	}
	if (this.ref.isAttachment()) {
		return this.ref.getNote() !== '' ? 1 : 0;
	}
	return this.ref.numNotes(false, true) || 0;
}
