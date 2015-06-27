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
Zotero.ItemTreeView = function (collectionTreeRow, sourcesOnly) {
	Zotero.LibraryTreeView.apply(this);
	
	this.wrappedJSObject = this;
	this.rowCount = 0;
	this.collectionTreeRow = collectionTreeRow;
	
	this._skipKeypress = false;
	
	this._sourcesOnly = sourcesOnly;
	
	this._ownerDocument = null;
	this._needsSort = false;
	
	this._cellTextCache = {};
	this._itemImages = {};
	
	this._refreshPromise = Zotero.Promise.resolve();
	
	this._unregisterID = Zotero.Notifier.registerObserver(
		this,
		['item', 'collection-item', 'item-tag', 'share-items', 'bucket'],
		'itemTreeView',
		50
	);
}

Zotero.ItemTreeView.prototype = Object.create(Zotero.LibraryTreeView.prototype);
Zotero.ItemTreeView.prototype.type = 'item';


/**
 * Called by the tree itself
 */
Zotero.ItemTreeView.prototype.setTree = Zotero.Promise.coroutine(function* (treebox) {
	try {
		Zotero.debug("Setting tree for " + this.collectionTreeRow.id + " items view " + this.id);
		var start = Date.now();
		// Try to set the window document if not yet set
		if (treebox && !this._ownerDocument) {
			try {
				this._ownerDocument = treebox.treeBody.ownerDocument;
			}
			catch (e) {}
		}
		
		if (this._treebox) {
			if (this._needsSort) {
				yield this.sort();
			}
			return;
		}
		
		if (!treebox) {
			Zotero.debug("Treebox not passed in setTree()", 2);
			return;
		}
		
		if (!this._ownerDocument) {
			Zotero.debug("No owner document in setTree()", 2);
			return;
		}
		
		this._treebox = treebox;
		
		if (this._ownerDocument.defaultView.ZoteroPane_Local) {
			this._ownerDocument.defaultView.ZoteroPane_Local.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
		}
		
		if (Zotero.locked) {
			Zotero.debug("Zotero is locked -- not loading items tree", 2);
			
			if (this._ownerDocument.defaultView.ZoteroPane_Local) {
				this._ownerDocument.defaultView.ZoteroPane_Local.clearItemsPaneMessage();
			}
			return;
		}
		
		yield this.refresh();
		if (!this._treebox.treeBody) {
			return;
		}
		
		// Add a keypress listener for expand/collapse
		var tree = this._treebox.treeBody.parentNode;
		var self = this;
		var coloredTagsRE = new RegExp("^[1-" + Zotero.Tags.MAX_COLORED_TAGS + "]{1}$");
		var listener = function(event) {
			if (self._skipKeyPress) {
				self._skipKeyPress = false;
				return;
			}
			
			// Handle arrow keys specially on multiple selection, since
			// otherwise the tree just applies it to the last-selected row
			if (event.keyCode == 39 || event.keyCode == 37) {
				if (self._treebox.view.selection.count > 1) {
					switch (event.keyCode) {
						case 39:
							self.expandSelectedRows().done();
							break;
							
						case 37:
							self.collapseSelectedRows().done();
							break;
					}
					
					event.preventDefault();
				}
				return;
			}
			
			var key = String.fromCharCode(event.which);
			if (key == '+' && !(event.ctrlKey || event.altKey || event.metaKey)) {
				self.expandAllRows().done();
				event.preventDefault();
				return;
			}
			else if (key == '-' && !(event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)) {
				self.collapseAllRows().done();
				event.preventDefault();
				return;
			}
			
			// Ignore other non-character keypresses
			if (!event.charCode || event.shiftKey || event.ctrlKey ||
					event.altKey || event.metaKey) {
				return;
			}
			
			event.preventDefault();
			
			Zotero.spawn(function* () {
				if (coloredTagsRE.test(key)) {
					let libraryID = self.collectionTreeRow.ref.libraryID;
					let position = parseInt(key) - 1;
					let colorData = yield Zotero.Tags.getColorByPosition(libraryID, position);
					// If a color isn't assigned to this number or any
					// other numbers, allow key navigation
					if (!colorData) {
						let colors = yield Zotero.Tags.getColors(libraryID);
						return !colors.size;
					}
					
					var items = self.getSelectedItems();
					yield Zotero.Tags.toggleItemsListTags(libraryID, items, colorData.name);
					return;
				}
				
				// We have to disable key navigation on the tree in order to
				// keep it from acting on the 1-6 keys used for colored tags.
				// To allow navigation with other keys, we temporarily enable
				// key navigation and recreate the keyboard event. Since
				// that will trigger this listener again, we set a flag to
				// ignore the event, and then clear the flag above when the
				// event comes in. I see no way this could go wrong...
				tree.disableKeyNavigation = false;
				self._skipKeyPress = true;
				var nsIDWU = Components.interfaces.nsIDOMWindowUtils;
				var domWindowUtils = event.originalTarget.ownerDocument.defaultView
					.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
					.getInterface(nsIDWU);
				var modifiers = 0;
				if (event.altKey) {
					modifiers |= nsIDWU.MODIFIER_ALT;
				}
				if (event.ctrlKey) {
					modifiers |= nsIDWU.MODIFIER_CONTROL;
				}
				if (event.shiftKey) {
					modifiers |= nsIDWU.MODIFIER_SHIFT;
				}
				if (event.metaKey) {
					modifiers |= nsIDWU.MODIFIER_META;
				}
				domWindowUtils.sendKeyEvent(
					'keypress',
					event.keyCode,
					event.charCode,
					modifiers
				);
				tree.disableKeyNavigation = true;
			})
			.catch(function (e) {
				Zotero.logError(e);
			})
		};
		// Store listener so we can call removeEventListener() in ItemTreeView.unregister()
		this.listener = listener;
		tree.addEventListener('keypress', listener);
		
		// This seems to be the only way to prevent Enter/Return
		// from toggle row open/close. The event is handled by
		// handleKeyPress() in zoteroPane.js.
		tree._handleEnter = function () {};
		
		yield this.sort();
		yield this.expandMatchParents();
		
		if (this._ownerDocument.defaultView.ZoteroPane_Local) {
			this._ownerDocument.defaultView.ZoteroPane_Local.clearItemsPaneMessage();
		}
		
		// Select a queued item from selectItem()
		if (this.collectionTreeRow && this.collectionTreeRow.itemToSelect) {
			var item = this.collectionTreeRow.itemToSelect;
			yield this.selectItem(item['id'], item['expand']);
			this.collectionTreeRow.itemToSelect = null;
		}
		
		Zotero.debug("Set tree for items view " + this.id + " in " + (Date.now() - start) + " ms");
		
		this._initialized = true;
		yield this._runListeners('load');
	}
	catch (e) {
		Zotero.debug(e, 1);
		Components.utils.reportError(e);
		if (this.onError) {
			this.onError(e);
		}
		throw e;
	}
});


/**
 *  Reload the rows from the data access methods
 *  (doesn't call the tree.invalidate methods, etc.)
 */
Zotero.ItemTreeView.prototype.refresh = Zotero.serial(Zotero.Promise.coroutine(function* () {
	Zotero.debug('Refreshing items list for ' + this.id);
	//if(!Zotero.ItemTreeView._haveCachedFields) yield Zotero.Promise.resolve();
	
	var cacheFields = ['title', 'date'];
	
	// Cache the visible fields so they don't load individually
	try {
		var visibleFields = this.getVisibleFields();
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
		for (let i=0; i<visibleFields.length; i++) {
			let field = visibleFields[i];
			switch (field) {
				case 'hasAttachment':
					// Needed by item.getBestAttachments(), called by getBestAttachmentStateAsync()
					field = 'url';
					break;
				
				case 'numNotes':
					continue;
				
				case 'year':
					field = 'date';
					break;
				
				case 'itemType':
					field = 'itemTypeID';
					break;
			}
			if (cacheFields.indexOf(field) == -1) {
				cacheFields = cacheFields.concat(field);
			}
		}
		
		yield Zotero.Items.cacheFields(this.collectionTreeRow.ref.libraryID, cacheFields);
		Zotero.ItemTreeView._haveCachedFields = true;
		
		Zotero.CollectionTreeCache.clear();
		
		if (!this.selection.selectEventsSuppressed) {
			var unsuppress = this.selection.selectEventsSuppressed = true;
			//this._treebox.beginUpdateBatch();
		}
		var savedSelection = this.getSelectedItems(true);
		var savedOpenState = this._saveOpenState();
		
		var oldCount = this.rowCount;
		var newSearchItemIDs = {};
		var newSearchParentIDs = {};
		var newCellTextCache = {};
		var newSearchMode = this.collectionTreeRow.isSearchMode();
		var newRows = [];
		var newItems = yield this.collectionTreeRow.getItems();
		
		var added = 0;
		
		for (let i=0, len=newItems.length; i < len; i++) {
			let item = newItems[i];
			
			// Only add regular items if sourcesOnly is set
			if (this._sourcesOnly && !item.isRegularItem()) {
				continue;
			}
			
			// Don't add child items directly (instead mark their parents for
			// inclusion below)
			let parentItemID = item.parentItemID;
			if (parentItemID) {
				newSearchParentIDs[parentItemID] = true;
			}
			// Add top-level items
			else {
				this._addRowToArray(
					newRows,
					new Zotero.ItemTreeRow(item, 0, false),
					added++
				);
			}
			newSearchItemIDs[item.id] = true;
		}
		
		// Add parents of matches if not matches themselves
		for (let id in newSearchParentIDs) {
			if (!newSearchItemIDs[id]) {
				let item = yield Zotero.Items.getAsync(id);
				this._addRowToArray(
					newRows,
					new Zotero.ItemTreeRow(item, 0, false),
					added++
				);
			}
		}
		
		this._rows = newRows;
		this.rowCount = this._rows.length;
		var diff = this.rowCount - oldCount;
		if (diff != 0) {
			this._treebox.rowCountChanged(0, diff);
		}
		this._refreshItemRowMap();
		
		this._searchMode = newSearchMode;
		this._searchItemIDs = newSearchItemIDs; // items matching the search
		this._searchParentIDs = newSearchParentIDs;
		this._cellTextCache = {};
		
		yield this.rememberOpenState(savedOpenState);
		yield this.rememberSelection(savedSelection);
		yield this.expandMatchParents();
		if (unsuppress) {
			// This causes a problem with the row count being wrong between views
			//this._treebox.endUpdateBatch();
			this.selection.selectEventsSuppressed = false;
		}
		
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


/**
 * Generator used internally for refresh
 */
Zotero.ItemTreeView._haveCachedFields = false;


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
	
	// Clear item type icon and tag colors when a tag is added to or removed from an item
	if (type == 'item-tag') {
		// TODO: Only update if colored tag changed?
		ids.map(function (val) val.split("-")[0]).forEach(function (val) {
			delete this._itemImages[val];
		}.bind(this));
		return;
	}
	
	var collectionTreeRow = this.collectionTreeRow;
	
	var madeChanges = false;
	var refreshed = false;
	var sort = false;
	
	var savedSelection = this.getSelectedItems(true);
	var previousFirstRow = this._rowMap[ids[0]];
	
	// Redraw the tree (for tag color and progress changes)
	if (action == 'redraw') {
		// Redraw specific rows
		if (type == 'item' && ids.length) {
			// Redraw specific cells
			if (extraData && extraData.column) {
				var col = this._treebox.columns.getNamedColumn(
					'zotero-items-column-' + extraData.column
				);
				for each(var id in ids) {
					if (extraData.column == 'title') {
						delete this._itemImages[id];
					}
					this._treebox.invalidateCell(this._rowMap[id], col);
				}
			}
			else {
				for each(var id in ids) {
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
		else if (type == 'publications') {
			if (collectionTreeRow.isPublications()) {
				yield this.refresh();
				refreshed = true;
			}
		}
		// If refreshing a single item, clear caches and then unselect and reselect row
		else if (savedSelection.length == 1 && savedSelection[0] == ids[0]) {
			let row = this._rowMap[ids[0]];
			delete this._cellTextCache[row];
			
			this.selection.clearSelection();
			yield this.rememberSelection(savedSelection);
		}
		else {
			this._cellTextCache = {};
		}
		
		return;
	}
	
	if (collectionTreeRow.isShare()) {
		return;
	}
	
	// See if we're in the active window
	var zp = Zotero.getActiveZoteroPane();
	var activeWindow = zp && zp.itemsView == this;
	
	var quicksearch = this._ownerDocument.getElementById('zotero-tb-search');
	
	// 'collection-item' ids are in the form collectionID-itemID
	if (type == 'collection-item') {
		if (!collectionTreeRow.isCollection()) {
			return;
		}
		
		var splitIDs = [];
		for each(var id in ids) {
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
	//this._treebox.beginUpdateBatch();
	
	if ((action == 'remove' && !collectionTreeRow.isLibrary(true))
			|| action == 'delete' || action == 'trash') {
		
		// On a delete in duplicates mode, just refresh rather than figuring
		// out what to remove
		if (collectionTreeRow.isDuplicates()) {
			yield this.refresh();
			refreshed = true;
			madeChanges = true;
			sort = true;
		}
		else {
			// Since a remove involves shifting of rows, we have to do it in order,
			// so sort the ids by row
			var rows = [];
			for (var i=0, len=ids.length; i<len; i++) {
				let push = false;
				if (action == 'delete' || action == 'trash') {
					push = true;
				}
				else {
					yield collectionTreeRow.ref.loadChildItems();
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
				// Child items might have been added more than once
				rows = Zotero.Utilities.arrayUnique(rows);
				rows.sort(function(a,b) { return a-b });
				
				for (let i = rows.length - 1; i >= 0; i--) {
					this._removeRow(rows[i]);
				}
				
				madeChanges = true;
				sort = true;
			}
		}
	}
	else if (action == 'modify')
	{
		// Clear row caches
		var items = yield Zotero.Items.getAsync(ids);
		for (let i=0; i<items.length; i++) {
			let id = items[i].id;
			delete this._itemImages[id];
			delete this._cellTextCache[id];
		}
		
		// If trash or saved search, just re-run search
		if (collectionTreeRow.isTrash() || collectionTreeRow.isSearch())
		{
			yield this.refresh();
			refreshed = true;
			madeChanges = true;
			sort = true;
		}
		
		// If no quicksearch, process modifications manually
		else if (!quicksearch || quicksearch.value == '')
		{
			var items = yield Zotero.Items.getAsync(ids);
			
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
					
					// Top-level items just have to be resorted
					if (this.isContainer(row)) {
						sort = id;
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
					// If not moved from under one item to another, just resort the row,
					// which also invalidates it and refreshes it
					else if (!(parentItemID && parentIndex != -1 && this._rowMap[parentItemID] != parentIndex)) {
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
						yield item.loadCollections();
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
		
		// If quicksearch, re-run it, since the results may have changed
		else
		{
			var allDeleted = true;
			var isTrash = collectionTreeRow.isTrash();
			var items = yield Zotero.Items.getAsync(ids);
			for each(var item in items) {
				// If not viewing trash and all items were deleted, ignore modify
				if (allDeleted && !isTrash && !item.deleted) {
					allDeleted = false;
				}
			}
			
			if (!allDeleted) {
				quicksearch.doCommand();
				madeChanges = true;
				sort = true;
			}
		}
	}
	else if(action == 'add')
	{
		// New items need their item data and collections loaded
		// before they're inserted into the tree
		let items = yield Zotero.Items.getAsync(ids);
		for (let i=0; i<items.length; i++) {
			let item = items[i];
			yield item.loadItemData();
			yield item.loadCollections();
		}
		
		// In some modes, just re-run search
		if (collectionTreeRow.isSearch() || collectionTreeRow.isTrash() || collectionTreeRow.isUnfiled()) {
			yield this.refresh();
			refreshed = true;
			madeChanges = true;
			sort = true;
		}
		
		// If not a quicksearch, process new items manually
		else if (!quicksearch || quicksearch.value == '')
		{
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
		// Otherwise re-run the quick search, which refreshes the item list
		else
		{
			// For item adds, clear the quicksearch, unless all the new items
			// are child items
			if (activeWindow && type == 'item') {
				let clear = false;
				for (let i=0; i<items.length; i++) {
					if (items[i].isTopLevelItem()) {
						clear = true;
						break;
					}
				}
				if (clear) {
					quicksearch.value = '';
				}
			}
			quicksearch.doCommand();
			madeChanges = true;
			sort = true;
		}
	}
	
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
				var items = yield Zotero.Items.getAsync(ids);
				if (items) {
					var found = false;
					for each(var item in items) {
						// Check for note and attachment type, since it's quicker
						// than checking for parent item
						if (item.itemTypeID == 1 || item.itemTypeID == 14) {
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
			yield this.sort(typeof sort == 'number' ? sort : false);
		}
		else {
			this._refreshItemRowMap();
		}
		
		if (singleSelect) {
			if (!extraData[singleSelect] || !extraData[singleSelect].skipSelect) {
				// Reset to Info tab
				this._ownerDocument.getElementById('zotero-view-tabbox').selectedIndex = 0;
				yield this.selectItem(singleSelect);
			}
		}
		// If single item is selected and was modified
		else if (action == 'modify' && ids.length == 1 &&
				savedSelection.length == 1 && savedSelection[0] == ids[0]) {
			// If the item no longer matches the search term, clear the search
			// DEBUG: Still needed/wanted? (and search is async, so doesn't work anyway,
			// here or above)
			if (quicksearch && this._rowMap[ids[0]] == undefined) {
				Zotero.debug('Selected item no longer matches quicksearch -- clearing');
				quicksearch.value = '';
				quicksearch.doCommand();
			}
			
			if (activeWindow) {
				yield this.selectItem(ids[0]);
			}
			else {
				yield this.rememberSelection(savedSelection);
			}
		}
		// On removal of a row, select item at previous position
		else if (savedSelection.length) {
			if (action == 'remove' || action == 'trash' || action == 'delete') {
				// In duplicates view, select the next set on delete
				if (collectionTreeRow.isDuplicates()) {
					if (this._rows[previousFirstRow]) {
						// Mirror ZoteroPane.onTreeMouseDown behavior
						var itemID = this._rows[previousFirstRow].ref.id;
						var setItemIDs = collectionTreeRow.ref.getSetItemsByItemID(itemID);
						this.selectItems(setItemIDs);
					}
				}
				else {
					// If this was a child item and the next item at this
					// position is a top-level item, move selection one row
					// up to select a sibling or parent
					if (ids.length == 1 && previousFirstRow > 0) {
						let previousItem = yield Zotero.Items.getAsync(ids[0]);
						if (previousItem && !previousItem.isTopLevelItem()) {
							if (this._rows[previousFirstRow] && this.getLevel(previousFirstRow) == 0) {
								previousFirstRow--;
							}
						}
					}
					
					if (previousFirstRow !== undefined && this._rows[previousFirstRow]) {
						this.selection.select(previousFirstRow);
					}
					// If no item at previous position, select last item in list
					else if (this._rows[this._rows.length - 1]) {
						this.selection.select(this._rows.length - 1);
					}
				}
			}
			else {
				yield this.rememberSelection(savedSelection);
			}
		}
		
		this._treebox.invalidate();
	}
	// For special case in which an item needs to be selected without changes
	// necessarily having been made
	// ('collection-item' add with tag selector open)
	/*else if (selectItem) {
		yield this.selectItem(selectItem);
	}*/
	
	//this._treebox.endUpdateBatch();
	if (madeChanges) {
		var deferred = Zotero.Promise.defer();
		this.addEventListener('select', () => deferred.resolve());
	}
	this.selection.selectEventsSuppressed = false;
	if (madeChanges) {
		Zotero.debug("Yielding for select promise"); // TEMP
		return deferred.promise;
	}
});

/*
 *  Unregisters view from Zotero.Notifier (called on window close)
 */
Zotero.ItemTreeView.prototype.unregister = function()
{
	Zotero.Notifier.unregisterObserver(this._unregisterID);
	if (this.listener) {
		let tree = this._treebox.treeBody.parentNode;
		tree.removeEventListener('keypress', this.listener, false);
		this.listener = null;
	}
}

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
			if (val) {
				var order = Zotero.Date.getLocaleDateOrder();
				if (order == 'mdy') {
					order = 'mdy';
					var join = '/';
				}
				else if (order == 'dmy') {
					order = 'dmy';
					var join = '.';
				}
				else if (order == 'ymd') {
					order = 'YMD';
					var join = '-';
				}
				var date = Zotero.Date.sqlToDate(val, true);
				var parts = [];
				for (var i=0; i<3; i++) {
					switch (order[i]) {
						case 'y':
							parts.push(date.getFullYear().toString().substr(2));
							break;
							
						case 'Y':
							parts.push(date.getFullYear());
							break;
						
						case 'm':
							parts.push((date.getMonth() + 1));
							break;
						
						case 'M':
							parts.push(Zotero.Utilities.lpad((date.getMonth() + 1).toString(), '0', 2));
							break;
						
						case 'd':
							parts.push(date.getDate());
							break;
						
						case 'D':
							parts.push(Zotero.Utilities.lpad(date.getDate().toString(), '0', 2));
							break;
					}
					
					val = parts.join(join);
					val += ' ' + date.toLocaleTimeString();
				}
			}
	}
	
	return this._cellTextCache[itemID][column.id] = val;
}

Zotero.ItemTreeView.prototype.getImageSrc = function(row, col)
{
	var self = this;
	
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
		
		if (treerow.level === 0) {
			if (item.isRegularItem()) {
				let state = item.getBestAttachmentStateCached();
				if (state !== null) {
					switch (state) {
						case 1:
							return "chrome://zotero/skin/bullet_blue.png";
						
						case -1:
							return "chrome://zotero/skin/bullet_blue_empty.png";
						
						default:
							return "";
					}
				}
				
				item.getBestAttachmentState()
				// Refresh cell when promise is fulfilled
				.then(function (state) {
					self._treebox.invalidateCell(row, col);
				})
				.done();
			}
		}
		
		if (item.isFileAttachment()) {
			let exists = item.fileExistsCached();
			if (exists !== null) {
				return exists
					? "chrome://zotero/skin/bullet_blue.png"
					: "chrome://zotero/skin/bullet_blue_empty.png";
			}
			
			item.fileExists()
			// Refresh cell when promise is fulfilled
			.then(function (exists) {
				self._treebox.invalidateCell(row, col);
			});
		}
	}
}

Zotero.ItemTreeView.prototype.isContainer = function(row)
{
	return this.getRow(row).ref.isRegularItem();
}

Zotero.ItemTreeView.prototype.isContainerEmpty = function(row)
{
	if (this._sourcesOnly) {
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

Zotero.ItemTreeView.prototype.toggleOpenState = Zotero.Promise.coroutine(function* (row, skipItemMapRefresh)
{
	// Shouldn't happen but does if an item is dragged over a closed
	// container until it opens and then released, since the container
	// is no longer in the same place when the spring-load closes
	if (!this.isContainer(row)) {
		return;
	}
	
	if (this.isContainerOpen(row)) {
		return this._closeContainer(row, skipItemMapRefresh);
	}
	
	var count = 0;
	var level = this.getLevel(row);
	
	//
	// Open
	//
	var item = this.getRow(row).ref;
	yield item.loadChildItems();
	
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
		newRows = yield Zotero.Items.getAsync(newRows);
		
		for (let i = 0; i < newRows.length; i++) {
			count++;
			this._addRow(
				new Zotero.ItemTreeRow(newRows[i], level + 1, false),
				row + i + 1
			);
		}
	}
	
	this._rows[row].isOpen = true;
	
	if (count == 0) {
		return;
	}
	
	this._treebox.invalidateRow(row);
	
	if (!skipItemMapRefresh) {
		Zotero.debug('Refreshing hash map');
		this._refreshItemRowMap();
	}
});


Zotero.ItemTreeView.prototype._closeContainer = function (row, skipItemMapRefresh) {
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
	
	if (!skipItemMapRefresh) {
		Zotero.debug('Refreshing hash map');
		this._refreshItemRowMap();
	}
}


Zotero.ItemTreeView.prototype.isSorted = function()
{
	// We sort by the first column if none selected, so return true
	return true;
}

Zotero.ItemTreeView.prototype.cycleHeader = Zotero.Promise.coroutine(function* (column)
{
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
	yield this.sort();
	yield this.rememberSelection(savedSelection);
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
Zotero.ItemTreeView.prototype.sort = Zotero.Promise.coroutine(function* (itemID) {
	var t = new Date;
	
	// If Zotero pane is hidden, mark tree for sorting later in setTree()
	if (!this._treebox.columns) {
		this._needsSort = true;
		return;
	}
	this._needsSort = false;
	
	// Single child item sort -- just toggle parent closed and open
	if (itemID && this._rowMap[itemID] &&
			this.getRow(this._rowMap[itemID]).ref.parentKey) {
		let parentIndex = this.getParentIndex(this._rowMap[itemID]);
		this._closeContainer(parentIndex);
		yield this.toggleOpenState(parentIndex);
		return;
	}
	
	var primaryField = this.getSortField();
	var sortFields = this.getSortFields();
	var dir = this.getSortDirection();
	var order = dir == 'descending' ? -1 : 1;
	var collation = Zotero.getLocaleCollation();
	var sortCreatorAsString = Zotero.Prefs.get('sortCreatorAsString');
	
	Zotero.debug("Sorting items list by " + sortFields.join(", ") + " " + dir);
	
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
	sortFields.forEach(function (x) cache[x] = {})
	
	// Get the display field for a row (which might be a placeholder title)
	function getField(field, row) {
		var item = row.ref;
		
		switch (field) {
			case 'title':
				return Zotero.Items.getSortTitle(item.getDisplayTitle());
			
			case 'hasAttachment':
				if (item.isAttachment()) {
					var state = item.fileExistsCached() ? 1 : -1;
				}
				else if (item.isRegularItem()) {
					var state = item.getBestAttachmentState();
				}
				else {
					return 0;
				}
				// Make sort order present, missing, empty when ascending
				if (state === -1) {
					state = 2;
				}
				return state * -1;
			
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
				
				return collation.compareString(1, fieldA, fieldB);
		}
	}
	
	var rowSort = function (a, b) {
		var sortFields = Array.slice(arguments, 2);
		var sortField;
		while (sortField = sortFields.shift()) {
			let cmp = fieldCompare(a, b, sortField);
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
		//this._treebox.beginUpdateBatch();
	}
	var savedSelection = this.getSelectedItems(true);
	var openItemIDs = this._saveOpenState(true);
	
	// Single-row sort
	if (itemID) {
		let row = this._rowMap[itemID];
		for (let i=0, len=this._rows.length; i<len; i++) {
			if (i === row) {
				continue;
			}
			
			let cmp = rowSort.apply(this, [this._rows[i], this._rows[row]].concat(sortFields)) * order;
			
			// As soon as we find a value greater (or smaller if reverse sort),
			// insert row at that position
			if (cmp > 0) {
				let rowItem = this._rows.splice(row, 1);
				this._rows.splice(row < i ? i-1 : i, 0, rowItem[0]);
				this._treebox.invalidate();
				break;
			}
			
			// If greater than last row, move to end
			if (i == len-1) {
				let rowItem = this._rows.splice(row, 1);
				this._rows.splice(i, 0, rowItem[0]);
				this._treebox.invalidate();
			}
		}
	}
	// Full sort
	else {
		this._rows.sort(function (a, b) {
			return rowSort.apply(this, [a, b].concat(sortFields)) * order;
		}.bind(this));
		
		Zotero.debug("Sorted items list without creators in " + (new Date - t) + " ms");
	}
	
	this._refreshItemRowMap();
	
	yield this.rememberOpenState(openItemIDs);
	yield this.rememberSelection(savedSelection);
	
	if (unsuppress) {
		this.selection.selectEventsSuppressed = false;
		//this._treebox.endUpdateBatch();
	}
	
	Zotero.debug("Sorted items list in " + (new Date - t) + " ms");
});


////////////////////////////////////////////////////////////////////////////////
///
///  Additional functions for managing data in the tree
///
////////////////////////////////////////////////////////////////////////////////


/*
 *  Select an item
 */
Zotero.ItemTreeView.prototype.selectItem = Zotero.Promise.coroutine(function* (id, expand, noRecurse) {
	// If no row map, we're probably in the process of switching collections,
	// so store the item to select on the item group for later
	if (!this._rowMap) {
		if (this.collectionTreeRow) {
			this.collectionTreeRow.itemToSelect = { id: id, expand: expand };
			Zotero.debug("_rowMap not yet set; not selecting item");
			return false;
		}
		
		Zotero.debug('Item group not found and no row map in ItemTreeView.selectItem() -- discarding select', 2);
		return false;
	}
	
	var selected = this.getSelectedItems(true);
	if (selected.length == 1 && selected[0] == id) {
		Zotero.debug("Item " + id + " is already selected");
		return;
	}
	
	var row = this._rowMap[id];
	
	// Get the row of the parent, if there is one
	var parentRow = null;
	var item = yield Zotero.Items.getAsync(id);
	
	// Can't select a deleted item if we're not in the trash
	if (item.deleted && !this.collectionTreeRow.isTrash()) {
		return false;
	}
	
	var parent = item.parentItemID;
	if (parent && this._rowMap[parent] != undefined) {
		parentRow = this._rowMap[parent];
	}
	
	// If row with id not visible, check to see if it's hidden under a parent
	if(row == undefined)
	{
		if (!parent || parentRow === null) {
			// No parent -- it's not here
			
			// Clear the quicksearch and tag selection and try again (once)
			if (!noRecurse && this._ownerDocument.defaultView.ZoteroPane_Local) {
				let cleared1 = yield this._ownerDocument.defaultView.ZoteroPane_Local.clearQuicksearch();
				let cleared2 = yield this._ownerDocument.defaultView.ZoteroPane_Local.clearTagSelection();
				if (cleared1 || cleared2) {
					return this.selectItem(id, expand, true);
				}
			}
			
			Zotero.debug("Could not find row for item; not selecting item");
			return false;
		}
		
		// If parent is already open and we haven't found the item, the child
		// hasn't yet been added to the view, so close parent to allow refresh
		this._closeContainer(parentRow);
		
		// Open the parent
		yield this.toggleOpenState(parentRow);
		row = this._rowMap[id];
	}
	
	// this.selection.select() triggers the <tree>'s 'onselect' attribute, which calls
	// ZoteroPane.itemSelected(), which calls ZoteroItemPane.viewItem(), which refreshes the
	// itembox. But since the 'onselect' doesn't handle promises, itemSelected() isn't waited for
	// here, which means that 'yield selectItem(itemID)' continues before the itembox has been
	// refreshed. To get around this, we wait for a select event that's triggered by
	// itemSelected() when it's done.
	if (this.selection.selectEventsSuppressed) {
		this.selection.select(row);
	}
	else {
		var deferred = Zotero.Promise.defer();
		this.addEventListener('select', () => deferred.resolve());
		this.selection.select(row);
	}
	
	// If |expand|, open row if container
	if (expand && this.isContainer(row) && !this.isContainerOpen(row)) {
		yield this.toggleOpenState(row);
	}
	this.selection.select(row);
	
	if (deferred) {
		yield deferred.promise;
	}
	
	// We aim for a row 5 below the target row, since ensureRowIsVisible() does
	// the bare minimum to get the row in view
	for (var v = row + 5; v>=row; v--) {
		if (this._rows[v]) {
			this._treebox.ensureRowIsVisible(v);
			if (this._treebox.getFirstVisibleRow() <= row) {
				break;
			}
		}
	}
	
	// If the parent row isn't in view and we have enough room, make parent visible
	if (parentRow !== null && this._treebox.getFirstVisibleRow() > parentRow) {
		if ((row - parentRow) < this._treebox.getPageLength()) {
			this._treebox.ensureRowIsVisible(parentRow);
		}
	}
	
	return true;
});


/**
 * Select multiple top-level items
 *
 * @param {Integer[]} ids	An array of itemIDs
 */
Zotero.ItemTreeView.prototype.selectItems = function(ids) {
	if (ids.length == 0) {
		return;
	}
	
	var rows = [];
	for each(var id in ids) {
		if(this._rowMap[id] !== undefined) rows.push(this._rowMap[id]);
	}
	rows.sort(function (a, b) {
		return a - b;
	});
	
	this.selection.clearSelection();
	
	this.selection.selectEventsSuppressed = true;
	
	var lastStart = 0;
	for (var i = 0, len = rows.length; i < len; i++) {
		if (i == len - 1 || rows[i + 1] != rows[i] + 1) {
			this.selection.rangedSelect(rows[lastStart], rows[i], true);
			lastStart = i + 1;
		}
	}
	
	this.selection.selectEventsSuppressed = false;
}


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
			if (asIDs) {
				items.push(this.getRow(j).id);
			}
			else {
				items.push(this.getRow(j).ref);
			}
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
	else if (collectionTreeRow.isTrash() || collectionTreeRow.isPublications()) {
		Zotero.Items.erase(ids);
	}
	else if (collectionTreeRow.isLibrary(true) || force) {
		Zotero.Items.trash(ids);
	}
	else if (collectionTreeRow.isCollection()) {
		collectionTreeRow.ref.removeItems(ids);
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
	
	yield this.sort();
	
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
			Zotero.debug("WARNING: Item row already found", 2);
		}
		rowMap[id] = i;
	}
	this._rowMap = rowMap;
}


Zotero.ItemTreeView.prototype.saveSelection = function () {
	return this.getSelectedItems(true);
}


/*
 *  Sets the selection based on saved selection ids
 */
Zotero.ItemTreeView.prototype.rememberSelection = Zotero.Promise.coroutine(function* (selection)
{
	if (!selection.length) {
		return;
	}
	
	this.selection.clearSelection();
	
	if (!this.selection.selectEventsSuppressed) {
		var unsuppress = this.selection.selectEventsSuppressed = true;
		//this._treebox.beginUpdateBatch();
	}
	for(var i=0; i < selection.length; i++)
	{
		if (this._rowMap[selection[i]] != null) {
			this.selection.toggleSelect(this._rowMap[selection[i]]);
		}
		// Try the parent
		else {
			var item = yield Zotero.Items.getAsync(selection[i]);
			if (!item) {
				continue;
			}
			
			var parent = item.parentItemID;
			if (!parent) {
				continue;
			}
			
			if (this._rowMap[parent] != null) {
				this._closeContainer(this._rowMap[parent]);
				yield this.toggleOpenState(this._rowMap[parent]);
				this.selection.toggleSelect(this._rowMap[selection[i]]);
			}
		}
	}
	if (unsuppress) {
		//this._treebox.endUpdateBatch();
		this.selection.selectEventsSuppressed = false;
	}
});


Zotero.ItemTreeView.prototype.selectSearchMatches = Zotero.Promise.coroutine(function* () {
	if (this._searchMode) {
		var ids = [];
		for (var id in this._searchItemIDs) {
			ids.push(id);
		}
		yield this.rememberSelection(ids);
	}
	else {
		this.selection.clearSelection();
	}
});


Zotero.ItemTreeView.prototype._saveOpenState = function (close) {
	var itemIDs = [];
	if (close) {
		if (!this.selection.selectEventsSuppressed) {
			var unsuppress = this.selection.selectEventsSuppressed = true;
			//this._treebox.beginUpdateBatch();
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
			//this._treebox.endUpdateBatch();
			this.selection.selectEventsSuppressed = false;
		}
	}
	return itemIDs;
}


Zotero.ItemTreeView.prototype.rememberOpenState = Zotero.Promise.coroutine(function* (itemIDs) {
	var rowsToOpen = [];
	for each(var id in itemIDs) {
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
		//this._treebox.beginUpdateBatch();
	}
	// Reopen from bottom up
	for (var i=rowsToOpen.length-1; i>=0; i--) {
		yield this.toggleOpenState(rowsToOpen[i], true);
	}
	this._refreshItemRowMap();
	if (unsuppress) {
		//this._treebox.endUpdateBatch();
		this.selection.selectEventsSuppressed = false;
	}
});


Zotero.ItemTreeView.prototype.expandMatchParents = Zotero.Promise.coroutine(function* () {
	// Expand parents of child matches
	if (!this._searchMode) {
		return;
	}
	
	var hash = {};
	for (var id in this._searchParentIDs) {
		hash[id] = true;
	}
	
	if (!this.selection.selectEventsSuppressed) {
		var unsuppress = this.selection.selectEventsSuppressed = true;
		//this._treebox.beginUpdateBatch();
	}
	for (var i=0; i<this.rowCount; i++) {
		var id = this.getRow(i).ref.id;
		if (hash[id] && this.isContainer(i) && !this.isContainerOpen(i)) {
			yield this.toggleOpenState(i, true);
		}
	}
	this._refreshItemRowMap();
	if (unsuppress) {
		//this._treebox.endUpdateBatch();
		this.selection.selectEventsSuppressed = false;
	}
});


Zotero.ItemTreeView.prototype.saveFirstRow = function() {
	var row = this._treebox.getFirstVisibleRow();
	if (row) {
		return this.getRow(row).ref.id;
	}
	return false;
}


Zotero.ItemTreeView.prototype.rememberFirstRow = function(firstRow) {
	if (firstRow && this._rowMap[firstRow]) {
		this._treebox.scrollToRow(this._rowMap[firstRow]);
	}
}


Zotero.ItemTreeView.prototype.expandAllRows = Zotero.Promise.coroutine(function* () {
	var unsuppress = this.selection.selectEventsSuppressed = true;
	//this._treebox.beginUpdateBatch();
	for (var i=0; i<this.rowCount; i++) {
		if (this.isContainer(i) && !this.isContainerOpen(i)) {
			yield this.toggleOpenState(i, true);
		}
	}
	this._refreshItemRowMap();
	//this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
});


Zotero.ItemTreeView.prototype.collapseAllRows = Zotero.Promise.coroutine(function* () {
	var unsuppress = this.selection.selectEventsSuppressed = true;
	//this._treebox.beginUpdateBatch();
	for (var i=0; i<this.rowCount; i++) {
		if (this.isContainer(i)) {
			this._closeContainer(i, true);
		}
	}
	this._refreshItemRowMap();
	//this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
});


Zotero.ItemTreeView.prototype.expandSelectedRows = Zotero.Promise.coroutine(function* () {
	var start = {}, end = {};
	this.selection.selectEventsSuppressed = true;
	//this._treebox.beginUpdateBatch();
	for (var i = 0, len = this.selection.getRangeCount(); i<len; i++) {
		this.selection.getRangeAt(i, start, end);
		for (var j = start.value; j <= end.value; j++) {
			if (this.isContainer(j) && !this.isContainerOpen(j)) {
				yield this.toggleOpenState(j, true);
			}
		}
	}
	this._refreshItemRowMap();
	//this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
});


Zotero.ItemTreeView.prototype.collapseSelectedRows = Zotero.Promise.coroutine(function* () {
	var start = {}, end = {};
	this.selection.selectEventsSuppressed = true;
	//this._treebox.beginUpdateBatch();
	for (var i = 0, len = this.selection.getRangeCount(); i<len; i++) {
		this.selection.getRangeAt(i, start, end);
		for (var j = start.value; j <= end.value; j++) {
			if (this.isContainer(j)) {
				this._closeContainer(j, true);
			}
		}
	}
	this._refreshItemRowMap();
	//this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
});


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
 * @param	bool	asIDs		Return itemIDs
 * @return	array				An array of Zotero.Item objects or itemIDs
 */
Zotero.ItemTreeView.prototype.getSortedItems = function(asIDs) {
	var items = [];
	for each(var item in this._rows) {
		if (asIDs) {
			items.push(item.ref.id);
		}
		else {
			items.push(item.ref);
		}
	}
	return items;
}


Zotero.ItemTreeView.prototype.getSortField = function() {
	var column = this._treebox.columns.getSortedColumn()
	if (!column) {
		column = this._treebox.columns.getFirstColumn()
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
	
	// More Columns menu
	try {
		let id = prefix + 'more-menu';
		
		let moreMenu = doc.createElementNS(ns, 'menu');
		moreMenu.setAttribute('label', Zotero.getString('pane.items.columnChooser.moreColumns'));
		moreMenu.setAttribute('anonid', id);
		
		let moreMenuPopup = doc.createElementNS(ns, 'menupopup');
		moreMenuPopup.setAttribute('anonid', id + '-popup');
		
		let treecols = menupopup.parentNode.parentNode;
		let subs = [x.getAttribute('label') for (x of treecols.getElementsByAttribute('submenu', 'true'))];
		
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
	
	// Secondary Sort menu
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

Zotero.ItemTreeCommandController.prototype.doCommand = Zotero.Promise.coroutine(function* (cmd)
{
	if (cmd == 'cmd_selectAll') {
		if (this.tree.view.wrappedJSObject.collectionTreeRow.isSearchMode()) {
			yield this.tree.view.wrappedJSObject.selectSearchMatches();
		}
		else {
			this.tree.view.selection.selectAll();
		}
	}
});

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
	if (Zotero.isWin) {
		event.dataTransfer.effectAllowed = 'copy';
	}
	
	var itemIDs = this.getSelectedItems(true);
	event.dataTransfer.setData("zotero/item", itemIDs);
	
	var items = Zotero.Items.get(itemIDs);
	
	// Multi-file drag
	//  - Doesn't work on Windows
	if (!Zotero.isWin) {
		// If at least one file is a non-web-link attachment and can be found,
		// enable dragging to file system
		for (var i=0; i<items.length; i++) {
			if (items[i].isAttachment()
					&& items[i].attachmentLinkMode
						!= Zotero.Attachments.LINK_MODE_LINKED_URL
					&& items[i].getFile()) {
				Zotero.debug("Adding file via x-moz-file-promise");
				event.dataTransfer.mozSetDataAt(
					"application/x-moz-file-promise",
					new Zotero.ItemTreeView.fileDragDataProvider(),
					0
				);
				break;
			}
		}
	}
	// Copy first file on Windows
	else {
		var index = 0;
		for (var i=0; i<items.length; i++) {
			if (items[i].isAttachment() &&
					items[i].getAttachmentLinkMode() != Zotero.Attachments.LINK_MODE_LINKED_URL) {
				var file = items[i].getFile();
				if (!file) {
					continue;
				}
				
				var fph = Components.classes["@mozilla.org/network/protocol;1?name=file"]
							.createInstance(Components.interfaces.nsIFileProtocolHandler);
				var uri = fph.getURLSpecFromFile(file);
				
				event.dataTransfer.mozSetDataAt("text/x-moz-url", uri + "\n" + file.leafName, index);
				event.dataTransfer.mozSetDataAt("application/x-moz-file", file, index);
				event.dataTransfer.mozSetDataAt("application/x-moz-file-promise-url", uri, index);
				// DEBUG: possible to drag multiple files without x-moz-file-promise?
				break;
				index++
			}
		}
	}
	
	// TEMP
	Zotero.debug("TEMP: Skipping Quick Copy");
	return;
	
	// Get Quick Copy format for current URL
	var url = this._ownerDocument.defaultView.content && this._ownerDocument.defaultView.content.location ?
				this._ownerDocument.defaultView.content.location.href : null;
	var format = Zotero.QuickCopy.getFormatFromURL(url);
	
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


// Implements nsIFlavorDataProvider for dragging attachment files to OS
//
// Not used on Windows in Firefox 3 or higher
Zotero.ItemTreeView.fileDragDataProvider = function() { };

Zotero.ItemTreeView.fileDragDataProvider.prototype = {
	QueryInterface : function(iid) {
		if (iid.equals(Components.interfaces.nsIFlavorDataProvider) ||
				iid.equals(Components.interfaces.nsISupports)) {
			return this;
		}
		throw Components.results.NS_NOINTERFACE;
	},
	
	getFlavorData : function(transferable, flavor, data, dataLen) {
		if (flavor == "application/x-moz-file-promise") {
			// On platforms other than OS X, the only directory we know of here
			// is the system temp directory, and we pass the nsIFile of the file
			// copied there in data.value below
			var useTemp = !Zotero.isMac;
			
			// Get the destination directory
			var dirPrimitive = {};
			var dataSize = {};
			transferable.getTransferData("application/x-moz-file-promise-dir", dirPrimitive, dataSize);
			var destDir = dirPrimitive.value.QueryInterface(Components.interfaces.nsILocalFile);
			
			// Get the items we're dragging
			var items = {};
			transferable.getTransferData("zotero/item", items, dataSize);
			items.value.QueryInterface(Components.interfaces.nsISupportsString);
			
			var draggedItems = Zotero.Items.get(items.value.data.split(','));
			
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
				destDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
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
						f.QueryInterface(Components.interfaces.nsILocalFile);
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
									copiedFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
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
									copiedFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
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
					for each(var name in notFoundNames) {
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
			
			for each(var item in items) {
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
			for each(var item in items) {
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
		// Don't allow drop into searches
		else if (collectionTreeRow.isSearch()) {
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
						yield item.loadCollections();
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
				yield collectionTreeRow.ref.removeItems(toMove);
			}
		}
	}
	else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
		// Disallow drop into read-only libraries
		if (!collectionTreeRow.editable) {
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					   .getService(Components.interfaces.nsIWindowMediator);
			var win = wm.getMostRecentWindow("navigator:browser");
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
		
		var unlock = Zotero.Notifier.begin(true);
		try {
			for (var i=0; i<data.length; i++) {
				var file = data[i];
				
				if (dataType == 'text/x-moz-url') {
					var url = data[i];
					
					if (url.indexOf('file:///') == 0) {
						var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								   .getService(Components.interfaces.nsIWindowMediator);
						var win = wm.getMostRecentWindow("navigator:browser");
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
						if (parentItemID) {
							if (!collectionTreeRow.filesEditable) {
								var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
										   .getService(Components.interfaces.nsIWindowMediator);
								var win = wm.getMostRecentWindow("navigator:browser");
								win.ZoteroPane.displayCannotEditLibraryFilesMessage();
								return;
							}
							Zotero.Attachments.importFromURL(url, parentItemID, false, false, null, null, targetLibraryID);
						}
						else {
							var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
									   .getService(Components.interfaces.nsIWindowMediator);
							var win = wm.getMostRecentWindow("navigator:browser");
							win.ZoteroPane.addItemFromURL(url, 'temporaryPDFHack'); // TODO: don't do this
						}
						continue;
					}
					
					// Otherwise file, so fall through
				}
				
				if (dropEffect == 'link') {
					yield Zotero.Attachments.linkFromFile({
						file: file,
						parentItemID: parentItemID,
						collections: parentCollectionID ? [parentCollectionID] : undefined
					});
				}
				else {
					if (file.leafName.endsWith(".lnk")) {
						let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						   .getService(Components.interfaces.nsIWindowMediator);
						let win = wm.getMostRecentWindow("navigator:browser");
						win.ZoteroPane.displayCannotAddShortcutMessage(file.path);
						continue;
					}
					yield Zotero.Attachments.importFromFile({
						file: file,
						libraryID: targetLibraryID,
						parentItemID: parentItemID,
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
			}
		}
		finally {
			Zotero.Notifier.commit(unlock);
		}
	}
});


////////////////////////////////////////////////////////////////////////////////
///
///  Functions for nsITreeView that we have to stub out.
///
////////////////////////////////////////////////////////////////////////////////

Zotero.ItemTreeView.prototype.isSeparator = function(row) 						{ return false; }
Zotero.ItemTreeView.prototype.getRowProperties = function(row, prop) {}
Zotero.ItemTreeView.prototype.getColumnProperties = function(col, prop) {}
Zotero.ItemTreeView.prototype.getCellProperties = function(row, col, prop) {
	var treeRow = this.getRow(row);
	var itemID = treeRow.ref.id;
	
	var props = [];
	
	// Mark items not matching search as context rows, displayed in gray
	if (this._searchMode && !this._searchItemIDs[itemID]) {
		// <=Fx21
		if (prop) {
			var aServ = Components.classes["@mozilla.org/atom-service;1"].
				getService(Components.interfaces.nsIAtomService);
			prop.AppendElement(aServ.getAtom("contextRow"));
		}
		// Fx22+
		else {
			props.push("contextRow");
		}
	}
	
	// Mark hasAttachment column, which needs special image handling
	if (col.id == 'zotero-items-column-hasAttachment') {
		// <=Fx21
		if (prop) {
			var aServ = Components.classes["@mozilla.org/atom-service;1"].
					getService(Components.interfaces.nsIAtomService);
			prop.AppendElement(aServ.getAtom("hasAttachment"));
		}
		// Fx22+
		else {
			props.push("hasAttachment");
		}
		
		// Don't show pie for open parent items, since we show it for the
		// child item
		if (this.isContainer(row) && this.isContainerOpen(row)) {
			return props.join(" ");
		}
		
		var num = Zotero.Sync.Storage.getItemDownloadImageNumber(treeRow.ref);
		//var num = Math.round(new Date().getTime() % 10000 / 10000 * 64);
		if (num !== false) {
			// <=Fx21
			if (prop) {
				if (!aServ) {
					var aServ = Components.classes["@mozilla.org/atom-service;1"].
							getService(Components.interfaces.nsIAtomService);
				}
				prop.AppendElement(aServ.getAtom("pie"));
				prop.AppendElement(aServ.getAtom("pie" + num));
			}
			// Fx22+
			else {
				props.push("pie", "pie" + num);
			}
		}
	}
	
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
		return '';
	}
	return this.ref.numNotes(false, true) || '';
}
