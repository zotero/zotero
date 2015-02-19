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
Zotero.ItemTreeView = function(itemGroup, sourcesOnly)
{
	this.wrappedJSObject = this;
	this.rowCount = 0;
	this.itemGroup = itemGroup;
	// Deprecated
	// TODO: remove
	this._itemGroup = itemGroup;
	
	this._initialized = false;
	this._skipKeypress = false;
	
	this._sourcesOnly = sourcesOnly;
	
	this._callbacks = [];
	
	this._treebox = null;
	this._ownerDocument = null;
	this._needsSort = false;
	
	this._dataItems = [];
	this._itemImages = {};
	
	this._unregisterID = Zotero.Notifier.registerObserver(
		this, ['item', 'collection-item', 'item-tag', 'share-items', 'bucket']
	);
}

Zotero.ItemTreeView.prototype = Object.create(Zotero.LibraryTreeView.prototype);
Zotero.ItemTreeView.prototype.type = 'item';

Zotero.ItemTreeView.prototype.addCallback = function(callback) {
	this._callbacks.push(callback);
}


Zotero.ItemTreeView.prototype._runCallbacks = function() {
	for each(var cb in this._callbacks) {
		cb();
	}
}


/**
 * Called by the tree itself
 */
Zotero.ItemTreeView.prototype.setTree = function(treebox)
{
	var generator = this._setTreeGenerator(treebox);
	if(generator.next()) {
		Zotero.pumpGenerator(generator);
	}
}

/**
 * Generator used internally for setting the tree
 */
Zotero.ItemTreeView.prototype._setTreeGenerator = function(treebox)
{
	try {
		//Zotero.debug("Calling setTree()");
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
				this.sort();
			}
			yield false;
		}
		
		if (!treebox) {
			Components.utils.reportError("Passed treebox empty in setTree()");
		}
		
		this._treebox = treebox;
		
		if (this._ownerDocument.defaultView.ZoteroPane_Local) {
			this._ownerDocument.defaultView.ZoteroPane_Local.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
			this._waitAfter = start + 100;
		}
		
		if (Zotero.locked) {
			var msg = "Zotero is locked -- not loading items tree";
			Zotero.debug(msg, 2);
			
			if (this._ownerDocument.defaultView.ZoteroPane_Local) {
				this._ownerDocument.defaultView.ZoteroPane_Local.clearItemsPaneMessage();
			}
			yield false;
		}
		
		// If a DB transaction is open, display error message and bail
		if (!Zotero.stateCheck()) {
			if (this._ownerDocument.defaultView.ZoteroPane_Local) {
				this._ownerDocument.defaultView.ZoteroPane_Local.displayErrorMessage();
			}
			yield false;
		}
		
		var generator = this._refreshGenerator();
		while(generator.next()) yield true;
		
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
							self.expandSelectedRows();
							break;
							
						case 37:
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
			
			Q.fcall(function () {
				if (coloredTagsRE.test(key)) {
					let libraryID = self._itemGroup.ref.libraryID;
					libraryID = libraryID ? parseInt(libraryID) : 0;
					let position = parseInt(key) - 1;
					return Zotero.Tags.getColorByPosition(libraryID, position)
					.then(function (colorData) {
						// If a color isn't assigned to this number or any
						// other numbers, allow key navigation
						if (!colorData) {
							return Zotero.Tags.getColors(libraryID)
							.then(function (colors) {
								return !Object.keys(colors).length;
							});
						}
						
						var items = self.getSelectedItems();
						return Zotero.Tags.toggleItemsListTags(libraryID, items, colorData.name)
						.then(function () {
							return false;
						});
					});
				}
				return true;
			})
			// We have to disable key navigation on the tree in order to
			// keep it from acting on the 1-6 keys used for colored tags.
			// To allow navigation with other keys, we temporarily enable
			// key navigation and recreate the keyboard event. Since
			// that will trigger this listener again, we set a flag to
			// ignore the event, and then clear the flag above when the
			// event comes in. I see no way this could go wrong...
			.then(function (resend) {
				if (!resend) {
					return;
				}
				
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
				Zotero.debug(e, 1);
				Components.utils.reportError(e);
			})
			.done();
		};
		// Store listener so we can call removeEventListener() in ItemTreeView.unregister()
		this.listener = listener;
		tree.addEventListener('keypress', listener);
		
		// This seems to be the only way to prevent Enter/Return
		// from toggle row open/close. The event is handled by
		// handleKeyPress() in zoteroPane.js.
		tree._handleEnter = function () {};
		
		this.sort();
		
		// Only yield if there are callbacks; otherwise, we're almost done
		if(this._callbacks.length && this._waitAfter && Date.now() > this._waitAfter) yield true;
		
		this.expandMatchParents();
		
		//Zotero.debug('Running callbacks in itemTreeView.setTree()', 4);
		this._runCallbacks();
		
		if (this._ownerDocument.defaultView.ZoteroPane_Local) {
			this._ownerDocument.defaultView.ZoteroPane_Local.clearItemsPaneMessage();
		}
		
		// Select a queued item from selectItem()
		if (this._itemGroup && this._itemGroup.itemToSelect) {
			var item = this._itemGroup.itemToSelect;
			this.selectItem(item['id'], item['expand']);
			this._itemGroup.itemToSelect = null;
		}
		
		delete this._waitAfter;
		Zotero.debug("Set tree in "+(Date.now()-start)+" ms");
	} catch(e) {
		Zotero.logError(e);
	}
	yield false;
}

/**
 *  Reload the rows from the data access methods
 *  (doesn't call the tree.invalidate methods, etc.)
 */
Zotero.ItemTreeView.prototype.refresh = function()
{
	var generator = this._refreshGenerator();
	while(generator.next()) {};
}

/**
 * Generator used internally for refresh
 */
Zotero.ItemTreeView._haveCachedFields = false;
Zotero.ItemTreeView.prototype._refreshGenerator = function()
{
	Zotero.debug('Refreshing items list');
	if(!Zotero.ItemTreeView._haveCachedFields) yield true;
	
	var usiDisabled = Zotero.UnresponsiveScriptIndicator.disable();
	
	Zotero.ItemGroupCache.clear();
	
	this._searchMode = this._itemGroup.isSearchMode();
	
	if (!this.selection.selectEventsSuppressed) {
		var unsuppress = this.selection.selectEventsSuppressed = true;
		//this._treebox.beginUpdateBatch();
	}
	var savedSelection = this.saveSelection();
	var savedOpenState = this.saveOpenState();
	
	var oldRows = this.rowCount;
	this._dataItems = [];
	this._searchItemIDs = {}; // items matching the search
	this._searchParentIDs = {};
	this.rowCount = 0;
	var cacheFields = ['title', 'date'];
	
	// Cache the visible fields so they don't load individually
	try {
		var visibleFields = this.getVisibleFields();
	}
	// If treebox isn't ready, skip refresh
	catch (e) {
		yield false;
	}
	
	for (var i=0; i<visibleFields.length; i++) {
		var field = visibleFields[i];
		switch (field) {
			case 'hasAttachment':
			case 'numNotes':
				continue;
			
			case 'year':
				field = 'date';
				break;
		}
		if (cacheFields.indexOf(field) == -1) {
			cacheFields = cacheFields.concat(field);
		}
	}
	
	Zotero.DB.beginTransaction();
	Zotero.Items.cacheFields(cacheFields);
	Zotero.ItemTreeView._haveCachedFields = true;
	
	var newRows = this._itemGroup.getItems();
	
	var added = 0;
	
	for (var i=0, len=newRows.length; i < len; i++) {
		// Only add regular items if sourcesOnly is set
		if (this._sourcesOnly && !newRows[i].isRegularItem()) {
			continue;
		}
		
		// Don't add child items directly (instead mark their parents for
		// inclusion below)
		var sourceItemID = newRows[i].getSource();
		if (sourceItemID) {
			this._searchParentIDs[sourceItemID] = true;
		}
		// Add top-level items
		else {
			this._showItem(new Zotero.ItemTreeView.TreeRow(newRows[i], 0, false), added + 1); //item ref, before row
			added++;
		}
		this._searchItemIDs[newRows[i].id] = true;
	}
	
	// Add parents of matches if not matches themselves
	for (var id in this._searchParentIDs) {
		if (!this._searchItemIDs[id]) {
			var item = Zotero.Items.get(id);
			this._showItem(new Zotero.ItemTreeView.TreeRow(item, 0, false), added + 1); //item ref, before row
			added++;
		}
	}
	
	Zotero.DB.commitTransaction();
		
	if(this._waitAfter && Date.now() > this._waitAfter) yield true;
	
	this._refreshHashMap();
	
	// Update the treebox's row count
	// this.rowCount isn't always up-to-date, so use the view's count
	var diff = this._treebox.view.rowCount - oldRows;
	if (diff != 0) {
		this._treebox.rowCountChanged(0, diff);
	}
	
	if (usiDisabled) {
		Zotero.UnresponsiveScriptIndicator.enable();
	}
	
	this.rememberOpenState(savedOpenState);
	this.rememberSelection(savedSelection);
	this.expandMatchParents();
	if (unsuppress) {
		// This causes a problem with the row count being wrong between views
		//this._treebox.endUpdateBatch();
		this.selection.selectEventsSuppressed = false;
	}
	
	yield false;
}


/*
 *  Called by Zotero.Notifier on any changes to items in the data layer
 */
Zotero.ItemTreeView.prototype.notify = function(action, type, ids, extraData)
{
	if (!this._treebox || !this._treebox.treeBody) {
		Components.utils.reportError("Treebox didn't exist in itemTreeView.notify()");
		return;
	}
	
	if (!this._itemRowMap) {
		Zotero.debug("Item row map didn't exist in itemTreeView.notify()");
		return;
	}
	
	// Clear item type icon and tag colors
	if (type == 'item-tag') {
		ids.map(function (val) val.split("-")[0]).forEach(function (val) {
			delete this._itemImages[val];
		}.bind(this));
		return;
	}
	
	var itemGroup = this._itemGroup;
	
	var madeChanges = false;
	var sort = false;
	
	var savedSelection = this.saveSelection();
	var previousRow = false;
	
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
					this._treebox.invalidateCell(this._itemRowMap[id], col);
				}
			}
			else {
				for each(var id in ids) {
					delete this._itemImages[id];
					this._treebox.invalidateRow(this._itemRowMap[id]);
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
	
	// If refreshing a single item, just unselect and reselect it
	if (action == 'refresh') {
		if (type == 'share-items') {
			if (itemGroup.isShare()) {
				this.refresh();
			}
		}
		else if (type == 'bucket') {
			if (itemGroup.isBucket()) {
				this.refresh();
			}
		}
		else if (savedSelection.length == 1 && savedSelection[0] == ids[0]) {
			this.selection.clearSelection();
			this.rememberSelection(savedSelection);
		}
		
		return;
	}
	
	if (itemGroup.isShare()) {
		return;
	}
	
	// See if we're in the active window
	var zp = Zotero.getActiveZoteroPane();
	var activeWindow = zp && zp.itemsView == this;
	
	var quicksearch = this._ownerDocument.getElementById('zotero-tb-search');
	
	// 'collection-item' ids are in the form collectionID-itemID
	if (type == 'collection-item') {
		if (!itemGroup.isCollection()) {
			return;
		}
		
		var splitIDs = [];
		for each(var id in ids) {
			var split = id.split('-');
			// Skip if not an item in this collection
			if (split[0] != itemGroup.ref.id) {
				continue;
			}
			splitIDs.push(split[1]);
		}
		ids = splitIDs;
		
		// Select the last item even if there are no changes (e.g. if the tag
		// selector is open and already refreshed the pane)
		if (splitIDs.length > 0 && (action == 'add' || action == 'modify')) {
			var selectItem = splitIDs[splitIDs.length - 1];
		}
	}
	
	this.selection.selectEventsSuppressed = true;
	this._treebox.beginUpdateBatch();
	
	if ((action == 'remove' && !itemGroup.isLibrary(true))
			|| action == 'delete' || action == 'trash') {
		
		// On a delete in duplicates mode, just refresh rather than figuring
		// out what to remove
		if (itemGroup.isDuplicates()) {
			previousRow = this._itemRowMap[ids[0]];
			this.refresh();
			madeChanges = true;
			sort = true;
		}
		else {
			// Since a remove involves shifting of rows, we have to do it in order,
			// so sort the ids by row
			var rows = [];
			for (var i=0, len=ids.length; i<len; i++) {
				if (action == 'delete' || action == 'trash' ||
						!itemGroup.ref.hasItem(ids[i])) {
					let row = this._itemRowMap[ids[i]];
					
					// Row might already be gone (e.g. if this is a child and
					// 'modify' was sent to parent)
					if (row == undefined) {
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
				rows.sort(function(a,b) { return a-b });
				
				for(var i=0, len=rows.length; i<len; i++)
				{
					var row = rows[i];
					if(row != null)
					{
						this._hideItem(row-i);
						this._treebox.rowCountChanged(row-i,-1);
					}
				}
				
				madeChanges = true;
				sort = true;
			}
		}
	}
	else if (action == 'modify')
	{
		// If trash or saved search, just re-run search
		if (itemGroup.isTrash() || itemGroup.isSearch())
		{
			// Clear item type icons
			var items = Zotero.Items.get(ids);
			for (let i=0; i<items.length; i++) {
				let id = items[i].id;
				delete this._itemImages[id];
			}
			
			this.refresh();
			madeChanges = true;
			sort = true;
		}
		
		// If no quicksearch, process modifications manually
		else if (!quicksearch || quicksearch.value == '')
		{
			var items = Zotero.Items.get(ids);
			
			for each(var item in items) {
				let id = item.id;
				
				// Make sure row map is up to date
				// if we made changes in a previous loop
				if (madeChanges) {
					this._refreshHashMap();
				}
				var row = this._itemRowMap[id];
				// Clear item type icon
				delete this._itemImages[id];
				
				// Deleted items get a modify that we have to ignore when
				// not viewing the trash
				if (item.deleted) {
					continue;
				}
				
				// Item already exists in this view
				if( row != null)
				{
					var sourceItemID = this._getItemAtRow(row).ref.getSource();
					var parentIndex = this.getParentIndex(row);
					
					if (this.isContainer(row) && this.isContainerOpen(row))
					{
						this.toggleOpenState(row);
						this.toggleOpenState(row);
						sort = id;
					}
					// If item moved from top-level to under another item,
					// remove the old row -- the container refresh above
					// takes care of adding the new row
					else if (!this.isContainer(row) && parentIndex == -1
						&& sourceItemID)
					{
						this._hideItem(row);
						this._treebox.rowCountChanged(row+1, -1)
					}
					// If moved from under another item to top level, add row
					else if (!this.isContainer(row) && parentIndex != -1
						&& !sourceItemID)
					{
						this._showItem(new Zotero.ItemTreeView.TreeRow(item, 0, false), this.rowCount);
						this._treebox.rowCountChanged(this.rowCount-1, 1);
						sort = id;
					}
					// If not moved from under one item to another, resort the row
					else if (!(sourceItemID && parentIndex != -1 && this._itemRowMap[sourceItemID] != parentIndex)) {
						sort = id;
					}
					madeChanges = true;
				}
				
				else if (((itemGroup.isLibrary() || itemGroup.isGroup()) && itemGroup.ref.libraryID == item.libraryID)
							|| (itemGroup.isCollection() && item.inCollection(itemGroup.ref.id))) {
					// Otherwise the item has to be added
					if(item.isRegularItem() || !item.getSource())
					{
						//most likely, the note or attachment's parent was removed.
						this._showItem(new Zotero.ItemTreeView.TreeRow(item,0,false),this.rowCount);
						this._treebox.rowCountChanged(this.rowCount-1,1);
						madeChanges = true;
						sort = true;
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
			var isTrash = itemGroup.isTrash();
			var items = Zotero.Items.get(ids);
			for each(var item in items) {
				let id = item.id;
				// Clear item type icon
				delete this._itemImages[id];
				
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
		// In some modes, just re-run search
		if (itemGroup.isSearch() || itemGroup.isTrash() || itemGroup.isUnfiled()) {
			this.refresh();
			madeChanges = true;
			sort = true;
		}
		
		// If not a quicksearch, process new items manually
		else if (!quicksearch || quicksearch.value == '')
		{
			var items = Zotero.Items.get(ids);
			for each(var item in items) {
				// if the item belongs in this collection
				if ((((itemGroup.isLibrary() || itemGroup.isGroup()) && itemGroup.ref.libraryID == item.libraryID)
						|| (itemGroup.isCollection() && item.inCollection(itemGroup.ref.id)))
					// if we haven't already added it to our hash map
					&& this._itemRowMap[item.id] == null
					// Regular item or standalone note/attachment
					&& (item.isRegularItem() || !item.getSource())) {
					this._showItem(new Zotero.ItemTreeView.TreeRow(item, 0, false), this.rowCount);
					this._treebox.rowCountChanged(this.rowCount-1,1);
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
				var clear = false;
				var items = Zotero.Items.get(ids);
				for each(var item in items) {
					if (!item.getSource()) {
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
		
		if (singleSelect) {
			if (sort) {
				this.sort(typeof sort == 'number' ? sort : false);
			}
			else {
				this._refreshHashMap();
			}
			
			// Reset to Info tab
			this._ownerDocument.getElementById('zotero-view-tabbox').selectedIndex = 0;
			
			this.selectItem(singleSelect);
		}
		// If single item is selected and was modified
		else if (action == 'modify' && ids.length == 1 &&
				savedSelection.length == 1 && savedSelection[0] == ids[0]) {
			// If the item no longer matches the search term, clear the search
			if (quicksearch && this._itemRowMap[ids[0]] == undefined) {
				Zotero.debug('Selected item no longer matches quicksearch -- clearing');
				quicksearch.value = '';
				quicksearch.doCommand();
			}
			
			if (sort) {
				this.sort(typeof sort == 'number' ? sort : false);
			}
			else {
				this._refreshHashMap();
			}
			
			if (activeWindow) {
				this.selectItem(ids[0]);
			}
			else {
				this.rememberSelection(savedSelection);
			}
		}
		else
		{
			if (previousRow === false) {
				previousRow = this._itemRowMap[ids[0]];
			}
			
			if (sort) {
				this.sort(typeof sort == 'number' ? sort : false);
			}
			else {
				this._refreshHashMap();
			}
			
			// On removal of a row, select item at previous position
			if (action == 'remove' || action == 'trash' || action == 'delete') {
				// In duplicates view, select the next set on delete
				if (itemGroup.isDuplicates()) {
					if (this._dataItems[previousRow]) {
						// Mirror ZoteroPane.onTreeMouseDown behavior
						var itemID = this._dataItems[previousRow].ref.id;
						var setItemIDs = itemGroup.ref.getSetItemsByItemID(itemID);
						this.selectItems(setItemIDs);
					}
				}
				else {
					// If this was a child item and the next item at this
					// position is a top-level item, move selection one row
					// up to select a sibling or parent
					if (ids.length == 1 && previousRow > 0) {
						var previousItem = Zotero.Items.get(ids[0]);
						if (previousItem && previousItem.getSource()) {
							if (this._dataItems[previousRow] && this.getLevel(previousRow) == 0) {
								previousRow--;
							}
						}
					}
					
					if (this._dataItems[previousRow]) {
						this.selection.select(previousRow);
					}
					// If no item at previous position, select last item in list
					else if (this._dataItems[this._dataItems.length - 1]) {
						this.selection.select(this._dataItems.length - 1);
					}
				}
			}
			else {
				this.rememberSelection(savedSelection);
			}
		}
		
		this._treebox.invalidate();
	}
	// For special case in which an item needs to be selected without changes
	// necessarily having been made
	// ('collection-item' add with tag selector open)
	else if (selectItem) {
		this.selectItem(selectItem);
	}
	
	if (Zotero.suppressUIUpdates) {
		this.rememberSelection(savedSelection);
	}
	
	this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
}

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

Zotero.ItemTreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getItemAtRow(row);
	
	var val;
	
	// Image only
	if (column.id === "zotero-items-column-hasAttachment") {
		return;
	}
	else if (column.id == "zotero-items-column-itemType") {
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
	
	return val;
}

Zotero.ItemTreeView.prototype.getImageSrc = function(row, col)
{
	if(col.id == 'zotero-items-column-title')
	{
		// Get item type icon and tag swatches
		var item = this._getItemAtRow(row).ref;
		var itemID = item.id;
		if (this._itemImages[itemID]) {
			return this._itemImages[itemID];
		}
		var uri = item.getImageSrc();
		var tags = item.getTags();
		if (!tags.length) {
			this._itemImages[itemID] = uri;
			return uri;
		}
		
		//Zotero.debug("Generating tree image for item " + itemID);
		
		var colorData = [];
		for (let i=0, len=tags.length; i<len; i++) {
			let libraryIDInt = item.libraryIDInt; // TEMP
			colorData.push(Zotero.Tags.getColor(libraryIDInt, tags[i].name));
		}
		var self = this;
		Q.all(colorData)
		.then(function (colorData) {
			colorData = colorData.filter(function (val) val !== false);
			if (!colorData.length) {
				return false;
			}
			colorData.sort(function (a, b) {
				return a.position - b.position;
			});
			var colors = colorData.map(function (val) val.color);
			return Zotero.Tags.generateItemsListImage(colors, uri);
		})
		// When the promise is fulfilled, the data URL is ready, so invalidate
		// the cell to force requesting it again
		.then(function (dataURL) {
			self._itemImages[itemID] = dataURL ? dataURL : uri;
			if (dataURL) {
				self._treebox.invalidateCell(row, col);
			}
		})
		.done();
		
		this._itemImages[itemID] = uri;
		return uri;
	}
	else if (col.id == 'zotero-items-column-hasAttachment') {
		if (this._itemGroup.isTrash()) return false;
		
		var treerow = this._getItemAtRow(row);
		var item = treerow.ref;
		
		if ((!this.isContainer(row) || !this.isContainerOpen(row))
				&& Zotero.Sync.Storage.getItemDownloadImageNumber(item)) {
			return '';
		}
		
		var itemID = item.id;
		
		if (treerow.level === 0) {
			if (item.isRegularItem()) {
				let state = item.getBestAttachmentState(true);
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
				
				item.getBestAttachmentStateAsync()
				// Refresh cell when promise is fulfilled
				.then(function (state) {
					this._treebox.invalidateCell(row, col);
				}.bind(this))
				.done();
			}
		}
		
		if (item.isFileAttachment()) {
			let exists = item.fileExists(true);
			if (exists !== null) {
				return exists
					? "chrome://zotero/skin/bullet_blue.png"
					: "chrome://zotero/skin/bullet_blue_empty.png";
			}
			
			item.fileExistsAsync()
			// Refresh cell when promise is fulfilled
			.then(function (exists) {
				this._treebox.invalidateCell(row, col);
			}.bind(this));
		}
	}
}

Zotero.ItemTreeView.prototype.isContainer = function(row)
{
	return this._getItemAtRow(row).ref.isRegularItem();
}

Zotero.ItemTreeView.prototype.isContainerOpen = function(row)
{
	return this._dataItems[row].isOpen;
}

Zotero.ItemTreeView.prototype.isContainerEmpty = function(row)
{
	if (this._sourcesOnly) {
		return true;
	}
	
	var item = this._getItemAtRow(row).ref;
	if (!item.isRegularItem()) {
		return false;
	}
	var includeTrashed = this._itemGroup.isTrash();
	return item.numNotes(includeTrashed) === 0 && item.numAttachments(includeTrashed) == 0;
}

Zotero.ItemTreeView.prototype.getLevel = function(row)
{
	return this._getItemAtRow(row).level;
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

Zotero.ItemTreeView.prototype.toggleOpenState = function(row, skipItemMapRefresh)
{
	// Shouldn't happen but does if an item is dragged over a closed
	// container until it opens and then released, since the container
	// is no longer in the same place when the spring-load closes
	if (!this.isContainer(row)) {
		return;
	}
	
	var count = 0;		//used to tell the tree how many rows were added/removed
	var thisLevel = this.getLevel(row);
	
	// Close
	if (this.isContainerOpen(row)) {
		while((row + 1 < this._dataItems.length) && (this.getLevel(row + 1) > thisLevel))
		{
			this._hideItem(row+1);
			count--;	//count is negative when closing a container because we are removing rows
		}
	}
	// Open
	else {
		var item = this._getItemAtRow(row).ref;
		//Get children
		var includeTrashed = this._itemGroup.isTrash();
		var attachments = item.getAttachments(includeTrashed);
		var notes = item.getNotes(includeTrashed);
		
		var newRows;
		if(attachments && notes)
			newRows = notes.concat(attachments);
		else if(attachments)
			newRows = attachments;
		else if(notes)
			newRows = notes;
		
		if (newRows) {
			newRows = Zotero.Items.get(newRows);
			
			for(var i = 0; i < newRows.length; i++)
			{
				count++;
				this._showItem(new Zotero.ItemTreeView.TreeRow(newRows[i], thisLevel + 1, false), row + i + 1); // item ref, before row
			}
		}
	}
	
	this._dataItems[row].isOpen = !this._dataItems[row].isOpen;
	
	if (!count) {
		return;
	}
	
	this._treebox.rowCountChanged(row+1, count); //tell treebox to repaint these
	this._treebox.invalidateRow(row);
	
	if (!skipItemMapRefresh) {
		Zotero.debug('Refreshing hash map');
		this._refreshHashMap();
	}
}


Zotero.ItemTreeView.prototype.isSorted = function()
{
	// We sort by the first column if none selected, so return true
	return true;
}

Zotero.ItemTreeView.prototype.cycleHeader = function(column)
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
	var savedSelection = this.saveSelection();
	if (savedSelection.length == 1) {
		var pos = this._itemRowMap[savedSelection[0]] - this._treebox.getFirstVisibleRow();
	}
	this.sort();
	this.rememberSelection(savedSelection);
	// If single row was selected, try to keep it in the same place
	if (savedSelection.length == 1) {
		var newRow = this._itemRowMap[savedSelection[0]];
		// Calculate the last row that would give us a full view
		var fullTop = Math.max(0, this._dataItems.length - this._treebox.getPageLength());
		// Calculate the row that would give us the same position
		var consistentTop = Math.max(0, newRow - pos);
		this._treebox.scrollToRow(Math.min(fullTop, consistentTop));
	}
	this._treebox.invalidate();
	this.selection.selectEventsSuppressed = false;
}

/*
 *  Sort the items by the currently sorted column.
 */
Zotero.ItemTreeView.prototype.sort = function(itemID)
{
	var t = new Date;
	
	// If Zotero pane is hidden, mark tree for sorting later in setTree()
	if (!this._treebox.columns) {
		this._needsSort = true;
		return;
	}
	this._needsSort = false;
	
	// Single child item sort -- just toggle parent open and closed
	if (itemID && this._itemRowMap[itemID] &&
			this._getItemAtRow(this._itemRowMap[itemID]).ref.getSource()) {
		var parentIndex = this.getParentIndex(this._itemRowMap[itemID]);
		this.toggleOpenState(parentIndex);
		this.toggleOpenState(parentIndex);
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
					var state = item.fileExists() ? 1 : -1;
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
	
	var includeTrashed = this._itemGroup.isTrash();
	
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
	
	function rowSort(a, b) {
		var sortFields = Array.slice(arguments, 2);
		var sortField;
		while (sortField = sortFields.shift()) {
			let cmp = fieldCompare(a, b, sortField);
			if (cmp !== 0) {
				return cmp;
			}
		}
		return 0;
	}
	
	var firstCreatorSortCache = {};
	
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
		//
		// Try sorting by the first name in the firstCreator field, since we already have it
		//
		// For sortCreatorAsString mode, just use the whole string
		//
		var aItemID = a.id,
			bItemID = b.id,
			fieldA = firstCreatorSortCache[aItemID],
			fieldB = firstCreatorSortCache[bItemID];
		if (fieldA === undefined) {
			let firstCreator = Zotero.Items.getSortTitle(a.getField('firstCreator'));
			if (sortCreatorAsString) {
				var fieldA = firstCreator;
			}
			else {
				var matches = andEtAlRegExp.exec(firstCreator);
				var fieldA = matches ? matches[0] : '';
			}
			firstCreatorSortCache[aItemID] = fieldA;
		}
		if (fieldB === undefined) {
			let firstCreator = Zotero.Items.getSortTitle(b.getField('firstCreator'));
			if (sortCreatorAsString) {
				var fieldB = firstCreator;
			}
			else {
				var matches = andEtAlRegExp.exec(firstCreator);
				var fieldB = matches ? matches[0] : '';
			}
			firstCreatorSortCache[bItemID] = fieldB;
		}
		
		if (fieldA === "" && fieldB === "") {
			return 0;
		}
		
		var cmp = strcmp(fieldA, fieldB);
		if (cmp !== 0 || sortCreatorAsString) {
			return cmp;
		}
		
		//
		// If first name is the same, compare actual creators
		//
		var aRef = a.ref,
			bRef = b.ref,
			aCreators = aRef.getCreators(),
			bCreators = bRef.getCreators(),
			aNumCreators = aCreators.length,
			bNumCreators = bCreators.length,
			aPrimary = Zotero.CreatorTypes.getPrimaryIDForType(aRef.itemTypeID),
			bPrimary = Zotero.CreatorTypes.getPrimaryIDForType(bRef.itemTypeID);
		const editorTypeID = 3,
			contributorTypeID = 2;
		
		// Find the first position of each possible creator type
		var aPrimaryFoundAt = false;
		var aEditorFoundAt = false;
		var aContributorFoundAt = false;
		loop:
		for (var orderIndex in aCreators) {
			switch (aCreators[orderIndex].creatorTypeID) {
				case aPrimary:
					aPrimaryFoundAt = orderIndex;
					// If we find a primary, no need to continue looking
					break loop;
				
				case editorTypeID:
					if (aEditorFoundAt === false) {
						aEditorFoundAt = orderIndex;
					}
					break;
				
				case contributorTypeID:
					if (aContributorFoundAt === false) {
						aContributorFoundAt = orderIndex;
					}
					break;
			}
		}
		if (aPrimaryFoundAt !== false) {
			var aFirstCreatorTypeID = aPrimary;
			var aPos = aPrimaryFoundAt;
		}
		else if (aEditorFoundAt !== false) {
			var aFirstCreatorTypeID = editorTypeID;
			var aPos = aEditorFoundAt;
		}
		else {
			var aFirstCreatorTypeID = contributorTypeID;
			var aPos = aContributorFoundAt;
		}
		
		// Same for b
		var bPrimaryFoundAt = false;
		var bEditorFoundAt = false;
		var bContributorFoundAt = false;
		loop:
		for (var orderIndex in bCreators) {
			switch (bCreators[orderIndex].creatorTypeID) {
				case bPrimary:
					bPrimaryFoundAt = orderIndex;
					break loop;
				
				case 3:
					if (bEditorFoundAt === false) {
						bEditorFoundAt = orderIndex;
					}
					break;
				
				case 2:
					if (bContributorFoundAt === false) {
						bContributorFoundAt = orderIndex;
					}
					break;
			}
		}
		if (bPrimaryFoundAt !== false) {
			var bFirstCreatorTypeID = bPrimary;
			var bPos = bPrimaryFoundAt;
		}
		else if (bEditorFoundAt !== false) {
			var bFirstCreatorTypeID = editorTypeID;
			var bPos = bEditorFoundAt;
		}
		else {
			var bFirstCreatorTypeID = contributorTypeID;
			var bPos = bContributorFoundAt;
		}
		
		while (true) {
			// Compare names
			fieldA = Zotero.Items.getSortTitle(aCreators[aPos].ref.lastName);
			fieldB = Zotero.Items.getSortTitle(bCreators[bPos].ref.lastName);
			cmp = strcmp(fieldA, fieldB);
			if (cmp) {
				return cmp;
			}
			
			fieldA = Zotero.Items.getSortTitle(aCreators[aPos].ref.firstName);
			fieldB = Zotero.Items.getSortTitle(bCreators[bPos].ref.firstName);
			cmp = strcmp(fieldA, fieldB);
			if (cmp) {
				return cmp;
			}
			
			// If names match, find next creator of the relevant type
			aPos++;
			var aFound = false;
			while (aPos < aNumCreators) {
				// Don't die if there's no creator at an index
				if (!aCreators[aPos]) {
					Components.utils.reportError(
						"Creator is missing at position " + aPos
						+ " for item " + aRef.libraryID + "/" + aRef.key
					);
					return -1;
				}
				
				if (aCreators[aPos].creatorTypeID == aFirstCreatorTypeID) {
					aFound = true;
					break;
				}
				aPos++;
			}
			
			bPos++;
			var bFound = false;
			while (bPos < bNumCreators) {
				// Don't die if there's no creator at an index
				if (!bCreators[bPos]) {
					Components.utils.reportError(
						"Creator is missing at position " + bPos
						+ " for item " + bRef.libraryID + "/" + bRef.key
					);
					return -1;
				}
				
				if (bCreators[bPos].creatorTypeID == bFirstCreatorTypeID) {
					bFound = true;
					break;
				}
				bPos++;
			}
			
			if (aFound && !bFound) {
				return -1;
			}
			if (bFound && !aFound) {
				return 1;
			}
			if (!aFound && !bFound) {
				return 0;
			}
		}
	}
	
	function strcmp(a, b, collationSort) {
		// Display rows with empty values last
		if (a === '' && b !== '') return 1;
		if (a !== '' && b === '') return -1;
		
		return collation.compareString(1, a, b);
	}
	
	// Need to close all containers before sorting
	if (!this.selection.selectEventsSuppressed) {
		var unsuppress = this.selection.selectEventsSuppressed = true;
		this._treebox.beginUpdateBatch();
	}
	var savedSelection = this.saveSelection();
	var openItemIDs = this.saveOpenState(true);
	
	// Single-row sort
	if (itemID) {
		let row = this._itemRowMap[itemID];
		for (let i=0, len=this._dataItems.length; i<len; i++) {
			if (i === row) {
				continue;
			}
			
			let cmp = rowSort.apply(this,
				[this._dataItems[i], this._dataItems[row]].concat(sortFields)) * order;
			
			// As soon as we find a value greater (or smaller if reverse sort),
			// insert row at that position
			if (cmp > 0) {
				let rowItem = this._dataItems.splice(row, 1);
				this._dataItems.splice(row < i ? i-1 : i, 0, rowItem[0]);
				this._treebox.invalidate();
				break;
			}
			
			// If greater than last row, move to end
			if (i == len-1) {
				let rowItem = this._dataItems.splice(row, 1);
				this._dataItems.splice(i, 0, rowItem[0]);
				this._treebox.invalidate();
			}
		}
	}
	// Full sort
	else {
		this._dataItems.sort(function (a, b) {
			return rowSort.apply(this, [a, b].concat(sortFields)) * order;
		}.bind(this));
	}
	
	this._refreshHashMap();
	
	this.rememberOpenState(openItemIDs);
	this.rememberSelection(savedSelection);
	
	if (unsuppress) {
		this.selection.selectEventsSuppressed = false;
		this._treebox.endUpdateBatch();
	}
	
	Zotero.debug("Sorted items list in " + (new Date - t) + " ms");
}

////////////////////////////////////////////////////////////////////////////////
///
///  Additional functions for managing data in the tree
///
////////////////////////////////////////////////////////////////////////////////


/*
 *  Select an item
 */
Zotero.ItemTreeView.prototype.selectItem = function(id, expand, noRecurse)
{
	// Don't change selection if UI updates are disabled (e.g., during sync)
	if (Zotero.suppressUIUpdates) {
		Zotero.debug("Sync is running; not selecting item");
		return false;
	}
	
	// If no row map, we're probably in the process of switching collections,
	// so store the item to select on the item group for later
	if (!this._itemRowMap) {
		if (this._itemGroup) {
			this._itemGroup.itemToSelect = { id: id, expand: expand };
			Zotero.debug("_itemRowMap not yet set; not selecting item");
			return false;
		}
		
		Zotero.debug('Item group not found and no row map in ItemTreeView.selectItem() -- discarding select', 2);
		return false;
	}
	
	var row = this._itemRowMap[id];
	
	// Get the row of the parent, if there is one
	var parentRow = null;
	var item = Zotero.Items.get(id);
	
	// Can't select a deleted item if we're not in the trash
	if (item.deleted && !this.itemGroup.isTrash()) {
		return false;
	}
	
	var parent = item.getSource();
	if (parent && this._itemRowMap[parent] != undefined) {
		parentRow = this._itemRowMap[parent];
	}
	
	// If row with id not visible, check to see if it's hidden under a parent
	if(row == undefined)
	{
		if (!parent || parentRow === null) {
			// No parent -- it's not here
			
			// Clear the quicksearch and tag selection and try again (once)
			if (!noRecurse) {
				if (this._ownerDocument.defaultView.ZoteroPane_Local) {
					this._ownerDocument.defaultView.ZoteroPane_Local.clearQuicksearch();
					this._ownerDocument.defaultView.ZoteroPane_Local.clearTagSelection();
				}
				return this.selectItem(id, expand, true);
			}
			
			Zotero.debug("Could not find row for item; not selecting item");
			return false;
		}
		
		// If parent is already open and we haven't found the item, the child
		// hasn't yet been added to the view, so close parent to allow refresh
		if (this.isContainerOpen(parentRow)) {
			this.toggleOpenState(parentRow);
		}
		// Open the parent
		this.toggleOpenState(parentRow);
		row = this._itemRowMap[id];
	}
	
	this.selection.select(row);
	// If |expand|, open row if container
	if (expand && this.isContainer(row) && !this.isContainerOpen(row)) {
		this.toggleOpenState(row);
	}
	this.selection.select(row);
	
	// We aim for a row 5 below the target row, since ensureRowIsVisible() does
	// the bare minimum to get the row in view
	for (var v = row + 5; v>=row; v--) {
		if (this._dataItems[v]) {
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
}


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
		if(this._itemRowMap[id] !== undefined) rows.push(this._itemRowMap[id]);
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
				items.push(this._getItemAtRow(j).id);
			}
			else {
				items.push(this._getItemAtRow(j).ref);
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
Zotero.ItemTreeView.prototype.deleteSelection = function (force)
{
	if (arguments.length > 1) {
		throw ("deleteSelection() no longer takes two parameters");
	}
	
	if (this.selection.count == 0) {
		return;
	}
	
	this._treebox.beginUpdateBatch();
	
	// Collapse open items
	for (var i=0; i<this.rowCount; i++) {
		if (this.selection.isSelected(i) && this.isContainer(i) && this.isContainerOpen(i)) {
			this.toggleOpenState(i, true);
		}
	}
	this._refreshHashMap();
	
	// Create an array of selected items
	var ids = [];
	var start = {};
	var end = {};
	for (var i=0, len=this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++)
			ids.push(this._getItemAtRow(j).id);
	}
	
	Zotero.ItemGroupCache.clear();
	var itemGroup = this._itemGroup;
	
	if (itemGroup.isBucket()) {
		itemGroup.ref.deleteItems(ids);
	}
	else if (itemGroup.isTrash()) {
		Zotero.Items.erase(ids);
	}
	else if (itemGroup.isLibrary(true) || force) {
		Zotero.Items.trash(ids);
	}
	else if (itemGroup.isCollection()) {
		itemGroup.ref.removeItems(ids);
	}
	this._treebox.endUpdateBatch();
}


/*
 * Set the search/tags filter on the view
 */
Zotero.ItemTreeView.prototype.setFilter = function(type, data) {
	if (!this._treebox || !this._treebox.treeBody) {
		Components.utils.reportError("Treebox didn't exist in itemTreeView.setFilter()");
		return;
	}
	
	this.selection.selectEventsSuppressed = true;
	this._treebox.beginUpdateBatch();
	
	switch (type) {
		case 'search':
			this._itemGroup.setSearch(data);
			break;
		case 'tags':
			this._itemGroup.setTags(data);
			break;
		default:
			throw ('Invalid filter type in setFilter');
	}
	var oldCount = this.rowCount;
	this.refresh();
	
	this.sort();
	
	this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
	
	//Zotero.debug('Running callbacks in itemTreeView.setFilter()', 4);
	this._runCallbacks();
}


/*
 *  Called by various view functions to show a row
 * 
 *  	item:	reference to the Item
 *      beforeRow:	row index to insert new row before
 */
Zotero.ItemTreeView.prototype._showItem = function(item, beforeRow)
{
	this._dataItems.splice(beforeRow, 0, item);
	this.rowCount++;
}

/*
 *  Called by view to hide specified row
 */
Zotero.ItemTreeView.prototype._hideItem = function(row)
{
	this._dataItems.splice(row,1);
	this.rowCount--;
}

/*
 *  Returns a reference to the item at row (see Zotero.Item in data_access.js)
 */
Zotero.ItemTreeView.prototype._getItemAtRow = function(row)
{
	return this._dataItems[row];
}

/*
 *  Create hash map of item ids to row indexes
 */
Zotero.ItemTreeView.prototype._refreshHashMap = function()
{
	var rowMap = {};
	for (var i=0, len=this.rowCount; i<len; i++) {
		var row = this._getItemAtRow(i);
		rowMap[row.ref.id] = i;
	}
	this._itemRowMap = rowMap;
}

/*
 *  Saves the ids of currently selected items for later
 */
Zotero.ItemTreeView.prototype.saveSelection = function()
{
	var savedSelection = new Array();
	
	var start = new Object();
	var end = new Object();
	for (var i=0, len=this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++)
		{
			var item = this._getItemAtRow(j);
			if (!item) {
				continue;
			}
			savedSelection.push(item.ref.id);
		}
	}
	return savedSelection;
}

/*
 *  Sets the selection based on saved selection ids (see above)
 */
Zotero.ItemTreeView.prototype.rememberSelection = function(selection)
{	
	this.selection.clearSelection();
	
	if (!this.selection.selectEventsSuppressed) {
		var unsuppress = this.selection.selectEventsSuppressed = true;
		this._treebox.beginUpdateBatch();
	}
	for(var i=0; i < selection.length; i++)
	{
		if (this._itemRowMap[selection[i]] != null) {
			this.selection.toggleSelect(this._itemRowMap[selection[i]]);
		}
		// Try the parent
		else {
			var item = Zotero.Items.get(selection[i]);
			if (!item) {
				continue;
			}
			
			var parent = item.getSource();
			if (!parent) {
				continue;
			}
			
			if (this._itemRowMap[parent] != null) {
				if (this.isContainerOpen(this._itemRowMap[parent])) {
					this.toggleOpenState(this._itemRowMap[parent]);
				}
				this.toggleOpenState(this._itemRowMap[parent]);
				this.selection.toggleSelect(this._itemRowMap[selection[i]]);
			}
		}
	}
	if (unsuppress) {
		this._treebox.endUpdateBatch();
		this.selection.selectEventsSuppressed = false;
	}
}


Zotero.ItemTreeView.prototype.selectSearchMatches = function () {
	if (this._searchMode) {
		var ids = [];
		for (var id in this._searchItemIDs) {
			ids.push(id);
		}
		this.rememberSelection(ids);
	}
	else {
		this.selection.clearSelection();
	}
}


Zotero.ItemTreeView.prototype.saveOpenState = function(close) {
	var itemIDs = [];
	if (close) {
		if (!this.selection.selectEventsSuppressed) {
			var unsuppress = this.selection.selectEventsSuppressed = true;
			this._treebox.beginUpdateBatch();
		}
	}
	for (var i=0; i<this._dataItems.length; i++) {
		if (this.isContainer(i) && this.isContainerOpen(i)) {
			itemIDs.push(this._getItemAtRow(i).ref.id);
			if (close) {
				this.toggleOpenState(i, true);
			}
		}
	}
	if (close) {
		this._refreshHashMap();
		if (unsuppress) {
			this._treebox.endUpdateBatch();
			this.selection.selectEventsSuppressed = false;
		}
	}
	return itemIDs;
}


Zotero.ItemTreeView.prototype.rememberOpenState = function(itemIDs) {
	var rowsToOpen = [];
	for each(var id in itemIDs) {
		var row = this._itemRowMap[id];
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
	this._refreshHashMap();
	if (unsuppress) {
		this._treebox.endUpdateBatch();
		this.selection.selectEventsSuppressed = false;
	}
}


Zotero.ItemTreeView.prototype.expandMatchParents = function () {
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
		this._treebox.beginUpdateBatch();
	}
	for (var i=0; i<this.rowCount; i++) {
		var id = this._getItemAtRow(i).ref.id;
		if (hash[id] && this.isContainer(i) && !this.isContainerOpen(i)) {
			this.toggleOpenState(i, true);
		}
	}
	this._refreshHashMap();
	if (unsuppress) {
		this._treebox.endUpdateBatch();
		this.selection.selectEventsSuppressed = false;
	}
}


Zotero.ItemTreeView.prototype.saveFirstRow = function() {
	var row = this._treebox.getFirstVisibleRow();
	if (row) {
		return this._getItemAtRow(row).ref.id;
	}
	return false;
}


Zotero.ItemTreeView.prototype.rememberFirstRow = function(firstRow) {
	if (firstRow && this._itemRowMap[firstRow]) {
		this._treebox.scrollToRow(this._itemRowMap[firstRow]);
	}
}


Zotero.ItemTreeView.prototype.expandAllRows = function() {
	var unsuppress = this.selection.selectEventsSuppressed = true;
	this._treebox.beginUpdateBatch();
	for (var i=0; i<this.rowCount; i++) {
		if (this.isContainer(i) && !this.isContainerOpen(i)) {
			this.toggleOpenState(i, true);
		}
	}
	this._refreshHashMap();
	this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
}


Zotero.ItemTreeView.prototype.collapseAllRows = function() {
	var unsuppress = this.selection.selectEventsSuppressed = true;
	this._treebox.beginUpdateBatch();
	for (var i=0; i<this.rowCount; i++) {
		if (this.isContainer(i) && this.isContainerOpen(i)) {
			this.toggleOpenState(i, true);
		}
	}
	this._refreshHashMap();
	this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
}


Zotero.ItemTreeView.prototype.expandSelectedRows = function() {
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
	this._refreshHashMap();
	this._treebox.endUpdateBatch();
	this.selection.selectEventsSuppressed = false;
}


Zotero.ItemTreeView.prototype.collapseSelectedRows = function() {
	var start = {}, end = {};
	this.selection.selectEventsSuppressed = true;
	this._treebox.beginUpdateBatch();
	for (var i = 0, len = this.selection.getRangeCount(); i<len; i++) {
		this.selection.getRangeAt(i, start, end);
		for (var j = start.value; j <= end.value; j++) {
			if (this.isContainer(j) && this.isContainerOpen(j)) {
				this.toggleOpenState(j, true);
			}
		}
	}
	this._refreshHashMap();
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
 * @param	bool	asIDs		Return itemIDs
 * @return	array				An array of Zotero.Item objects or itemIDs
 */
Zotero.ItemTreeView.prototype.getSortedItems = function(asIDs) {
	var items = [];
	for each(var item in this._dataItems) {
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

Zotero.ItemTreeCommandController.prototype.doCommand = function(cmd)
{
	if (cmd == 'cmd_selectAll') {
		if (this.tree.view.wrappedJSObject._itemGroup.isSearchMode()) {
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
	if (Zotero.isWin) {
		event.dataTransfer.effectAllowed = 'copy';
	}
	
	var itemIDs = this.saveSelection();
	var items = Zotero.Items.get(itemIDs);
	
	event.dataTransfer.setData("zotero/item", itemIDs.join());
	
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
	
	// Get Quick Copy format for current URL
	var url = this._ownerDocument.defaultView.content && this._ownerDocument.defaultView.content.location ?
				this._ownerDocument.defaultView.content.location.href : null;
	var format = Zotero.QuickCopy.getFormatFromURL(url);
	
	Zotero.debug("Dragging with format " + Zotero.QuickCopy.getFormattedNameFromSetting(format));
	
	var exportCallback = function(obj, worked) {
		if (!worked) {
			Zotero.log(Zotero.getString("fileInterface.exportError"), 'warning');
			return;
		}
		
		var text = obj.string.replace(/\r\n/g, "\n");
		event.dataTransfer.setData("text/plain", text);
	}
	
	try {
		var [mode, ] = format.split('=');
		if (mode == 'export') {
			Zotero.QuickCopy.getContentFromItems(items, format, exportCallback);
		}
		else if (mode.indexOf('bibliography') == 0) {
			var content = Zotero.QuickCopy.getContentFromItems(items, format, null, event.shiftKey);
			if (content) {
				if (content.html) {
					event.dataTransfer.setData("text/html", content.html);
				}
				event.dataTransfer.setData("text/plain", content.text);
			}
		}
		else {
			Components.utils.reportError("Invalid Quick Copy mode '" + mode + "'");
		}
	}
	catch (e) {
		Components.utils.reportError(e + " with format '" + format + "'");
	}
}


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
					var dirName = Zotero.Attachments.getFileBaseNameFromItem(items[i].id);
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
						
						parentDir.copyTo(destDir, newName ? newName : dirName);
						
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
						
						file.copyTo(destDir, newName ? newName : null);
						
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
	
	if (dataType == 'zotero/item') {
		var ids = data;
	}
	
	var itemGroup = this._itemGroup;
	
	if (row != -1 && orient == 0) {
		var rowItem = this._getItemAtRow(row).ref; // the item we are dragging over
	}
	
	if (dataType == 'zotero/item') {
		var items = Zotero.Items.get(ids);
		
		// Directly on a row
		if (rowItem) {
			var canDrop = false;
			
			for each(var item in items) {
				// If any regular items, disallow drop
				if (item.isRegularItem()) {
					return false;
				}
				
				// Disallow cross-library child drag
				if (item.libraryID != itemGroup.ref.libraryID) {
					return false;
				}
				
				// Only allow dragging of notes and attachments
				// that aren't already children of the item
				if (item.getSource() != rowItem.id) {
					canDrop = true;
				}
			}
			
			return canDrop;
		}
		
		// In library, allow children to be dragged out of parent
		else if (itemGroup.isLibrary(true) || itemGroup.isCollection()) {
			for each(var item in items) {
				// Don't allow drag if any top-level items
				if (item.isTopLevelItem()) {
					return false;
				}
				
				// Don't allow web attachments to be dragged out of parents,
				// but do allow PDFs for now so they can be recognized
				if (item.isWebAttachment() && item.attachmentMIMEType != 'application/pdf') {
					return false;
				}
				
				// Don't allow children to be dragged within their own parents
				var parentItemID = item.getSource();
				var parentIndex = this._itemRowMap[parentItemID];
				if (this.getLevel(row) > 0) {
					if (this._getItemAtRow(this.getParentIndex(row)).ref.id == parentItemID) {
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
				if (item.libraryID != itemGroup.ref.libraryID) {
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
		else if (itemGroup.isSearch()) {
			return false;
		}
		
		return true;
	}
	
	return false;
}

/*
 *  Called when something's been dropped on or next to a row
 */
Zotero.ItemTreeView.prototype.drop = function(row, orient, dataTransfer) {
	if (!this.canDropCheck(row, orient, dataTransfer)) {
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
	var itemGroup = this.itemGroup;
	var targetLibraryID = itemGroup.isWithinGroup() ? itemGroup.ref.libraryID : null;
	
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
			var rowItem = this._getItemAtRow(row).ref; // the item we are dragging over
			for each(var item in items) {
				item.setSource(rowItem.id);
				item.save();
			}
		}
		
		// Dropped outside of a row
		else
		{
			// Remove from parent and make top-level
			if (itemGroup.isLibrary(true)) {
				for each(var item in items) {
					if (!item.isRegularItem())
					{
						item.setSource();
						item.save()
					}
				}
			}
			// Add to collection
			else
			{
				for each(var item in items)
				{
					var source = item.isRegularItem() ? false : item.getSource();
					// Top-level item
					if (source) {
						item.setSource();
						item.save()
					}
					itemGroup.ref.addItem(item.id);
					toMove.push(item.id);
				}
			}
		}
		
		// If moving, remove items from source collection
		if (dropEffect == 'move' && toMove.length) {
			if (!sameLibrary) {
				throw new Error("Cannot move items between libraries");
			}
			let targetItemGroup = Zotero.DragDrop.getDragSource();
			if (!targetItemGroup || !targetItemGroup.isCollection()) {
				throw new Error("Drag source must be a collection");
			}
			if (itemGroup.id != targetItemGroup.id) {
				itemGroup.ref.removeItems(toMove);
			}
		}
	}
	else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
		// Disallow drop into read-only libraries
		if (!itemGroup.editable) {
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					   .getService(Components.interfaces.nsIWindowMediator);
			var win = wm.getMostRecentWindow("navigator:browser");
			win.ZoteroPane.displayCannotEditLibraryMessage();
			return;
		}
		
		if (itemGroup.isWithinGroup()) {
			var targetLibraryID = itemGroup.ref.libraryID;
		}
		else {
			var targetLibraryID = null;
		}
		
		var sourceItemID = false;
		var parentCollectionID = false;
		
		var treerow = this._getItemAtRow(row);
		if (orient == 0) {
			sourceItemID = treerow.ref.id
		}
		else if (itemGroup.isCollection()) {
			var parentCollectionID = itemGroup.ref.id;
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
						if (sourceItemID) {
							if (!itemGroup.filesEditable) {
								var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
										   .getService(Components.interfaces.nsIWindowMediator);
								var win = wm.getMostRecentWindow("navigator:browser");
								win.ZoteroPane.displayCannotEditLibraryFilesMessage();
								return;
							}
							Zotero.Attachments.importFromURL(url, sourceItemID, false, false, null, null, targetLibraryID);
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
				
				try {
					Zotero.DB.beginTransaction();
					if (dropEffect == 'link') {
						var itemID = Zotero.Attachments.linkFromFile(file, sourceItemID);
					}
					else {
						var itemID = Zotero.Attachments.importFromFile(file, sourceItemID, targetLibraryID);
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
					if (parentCollectionID) {
						var col = Zotero.Collections.get(parentCollectionID);
						if (col) {
							col.addItem(itemID);
						}
					}
					Zotero.DB.commitTransaction();
				}
				catch (e) {
					Zotero.DB.rollbackTransaction();
					throw (e);
				}
			}
		}
		finally {
			Zotero.Notifier.commit(unlock);
		}
	}
}


////////////////////////////////////////////////////////////////////////////////
///
///  Functions for nsITreeView that we have to stub out.
///
////////////////////////////////////////////////////////////////////////////////

Zotero.ItemTreeView.prototype.isSeparator = function(row) 						{ return false; }
Zotero.ItemTreeView.prototype.getRowProperties = function(row, prop) {}
Zotero.ItemTreeView.prototype.getColumnProperties = function(col, prop) {}
Zotero.ItemTreeView.prototype.getCellProperties = function(row, col, prop) {
	var treeRow = this._getItemAtRow(row);
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

Zotero.ItemTreeView.TreeRow = function(ref, level, isOpen)
{
	this.ref = ref;			//the item associated with this
	this.level = level;
	this.isOpen = isOpen;
	this.id = ref.id;
}

Zotero.ItemTreeView.TreeRow.prototype.getField = function(field, unformatted)
{
	return this.ref.getField(field, unformatted, true);
}

Zotero.ItemTreeView.TreeRow.prototype.numNotes = function() {
	if (this.ref.isNote()) {
		return '';
	}
	return this.ref.numNotes(false, true) || '';
}
