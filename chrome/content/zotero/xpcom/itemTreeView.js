/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
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
	this._initialized = false;
	
	this._itemGroup = itemGroup;
	this._sourcesOnly = sourcesOnly;
	
	this._callbacks = [];
	
	this._treebox = null;
	this._ownerDocument = null;
	this._needsSort = false;
	
	this._dataItems = [];
	this.rowCount = 0;
	
	this._unregisterID = Zotero.Notifier.registerObserver(this, ['item', 'collection-item']);
}


Zotero.ItemTreeView.prototype.addCallback = function(callback) {
	this._callbacks.push(callback);
}


Zotero.ItemTreeView.prototype._runCallbacks = function() {
	for each(var cb in this._callbacks) {
		cb();
	}
}


/*
 *  Called by the tree itself
 */
Zotero.ItemTreeView.prototype.setTree = function(treebox)
{
	//Zotero.debug("Calling setTree()");
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
		return;
	}
	
	if (!treebox) {
		Components.utils.reportError("Passed treebox empty in setTree()");
	}
	
	this._treebox = treebox;
	
	if (this._ownerDocument.defaultView.ZoteroPane) {
		this._ownerDocument.defaultView.ZoteroPane.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
	}
	
	// Generate the tree contents in a timer to allow message above to display
	var paneLoader = function(obj) {
		// If a DB transaction is open, display error message and bail
		if (!Zotero.stateCheck()) {
			if (obj._ownerDocument.defaultView.ZoteroPane) {
				obj._ownerDocument.defaultView.ZoteroPane.displayErrorMessage();
			}
			return;
		}
		
		obj.refresh();
		
		// Add a keypress listener for expand/collapse
		var expandAllRows = obj.expandAllRows;
		var collapseAllRows = obj.collapseAllRows;
		var tree = obj._treebox.treeBody.parentNode;
		tree.addEventListener('keypress', function(event) {
			var key = String.fromCharCode(event.which);
			
			if (key == '+' && !(event.ctrlKey || event.altKey || event.metaKey)) {
				expandAllRows(treebox);
				return;
			}
			else if (key == '-' && !(event.shiftKey || event.ctrlKey ||
					event.altKey || event.metaKey)) {
				collapseAllRows(treebox);
				return;
			}
		}, false);
		
		obj.sort();
		obj.expandMatchParents();
		
		//Zotero.debug('Running callbacks in itemTreeView.setTree()', 4);
		obj._runCallbacks();
		
		if (obj._ownerDocument.defaultView.ZoteroPane) {
			obj._ownerDocument.defaultView.ZoteroPane.clearItemsPaneMessage();
		}
		
		// Select a queued item from selectItem()
		if (obj._itemGroup && obj._itemGroup.itemToSelect) {
			var item = obj._itemGroup.itemToSelect;
			obj.selectItem(item['id'], item['expand']);
			obj._itemGroup.itemToSelect = null;
		}
	}
	
	this._ownerDocument.defaultView.setTimeout(paneLoader, 50, this);
}


/*
 *  Reload the rows from the data access methods
 *  (doesn't call the tree.invalidate methods, etc.)
 */
Zotero.ItemTreeView.prototype.refresh = function()
{
	this._searchMode = this._itemGroup.isSearchMode();
	
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
		return;
	}
	for (var i=0; i<visibleFields.length; i++) {
		var field = visibleFields[i];
		if (field == 'year') {
			field = 'date';
		}
		if (cacheFields.indexOf(field) == -1) {
			cacheFields = cacheFields.concat(field);
		}
	}
	
	Zotero.DB.beginTransaction();
	Zotero.Items.cacheFields(cacheFields);
	
	var newRows = this._itemGroup.getChildItems();
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
		this._searchItemIDs[newRows[i].getID()] = true;
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
	
	this._refreshHashMap();
	
	// Update the treebox's row count
	var diff = this.rowCount - oldRows;
	if (diff != 0) {
		this._treebox.rowCountChanged(0, diff);
	}
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
	
	var madeChanges = false;
	var sort = false;
	
	var savedSelection = this.saveSelection();
	
	// If refreshing a single item, just unselect and reselect it
	if (action == 'refresh') {
		if (savedSelection.length == 1 && savedSelection[0] == ids[0]) {
			this.selection.clearSelection();
			this.rememberSelection(savedSelection);
		}
		
		return;
	}
	
	this.selection.selectEventsSuppressed = true;
	
	// See if we're in the active window
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		.getService(Components.interfaces.nsIWindowMediator);
	if (wm.getMostRecentWindow("navigator:browser") == this._ownerDocument.defaultView){
		var activeWindow = true;
	}
	
	var quicksearch = this._ownerDocument.getElementById('zotero-tb-search');
	
	// 'collection-item' ids are in the form collectionID-itemID
	if (type == 'collection-item') {
		var splitIDs = [];
		for each(var id in ids) {
			var split = id.split('-');
			// Skip if not collection or not an item in this collection
			if (!this._itemGroup.isCollection() || split[0] != this._itemGroup.ref.getID()) {
				continue;
			}
			splitIDs.push(split[1]);
		}
		ids = splitIDs;
		
		// Select the last item even if there are no changes (e.g. if the tag
		// selector is open and already refreshed the pane)
		if (splitIDs.length > 0) {
			var selectItem = splitIDs[splitIDs.length - 1];
		}
	}
	
	if((action == 'remove' && !this._itemGroup.isLibrary()) || action == 'delete')
	{
		//Since a remove involves shifting of rows, we have to do it in order
		
		//sort the ids by row
		var rows = new Array();
		for(var i=0, len=ids.length; i<len; i++)
		{
			if (action == 'delete' || !this._itemGroup.ref.hasItem(ids[i])) {
				// Row might already be gone (e.g. if this is a child and
				// 'modify' was sent to parent)
				if (this._itemRowMap[ids[i]] != undefined) {
					rows.push(this._itemRowMap[ids[i]]);
				}
			}
		}
		
		if(rows.length > 0)
		{
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
	else if (action == 'modify')
	{
		// If saved search, just re-run search
		if (this._itemGroup.isSearch())
		{
			this.refresh();
			madeChanges = true;
			sort = true;
		}
		
		// If no quicksearch, process modifications manually
		else if (!quicksearch || quicksearch.value == '')
		{
			for(var i=0, len=ids.length; i<len; i++)
			{
				var row = this._itemRowMap[ids[i]];
				// Item already exists in this view
				if( row != null)
				{
					var sourceItemID = this._getItemAtRow(row).ref.getSource();
					var parentIndex = this.getParentIndex(row);
					
					if (this.isContainer(row) && this.isContainerOpen(row))
					{
						this.toggleOpenState(row);
						this.toggleOpenState(row);
					}
					// If item moved from top-level to under another item,
					// remove the old row
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
						var item = Zotero.Items.get(ids[i]);
						this._showItem(new Zotero.ItemTreeView.TreeRow(item, 0, false), this.rowCount);
						this._treebox.rowCountChanged(this.rowCount-1, 1);
						sort = ids[i];
					}
					// If not moved from under one item to another
					else if (!(sourceItemID && parentIndex != -1 && this._itemRowMap[sourceItemID] != parentIndex)) {
						sort = ids[i];
					}
					madeChanges = true;
				}
				
				else if (this._itemGroup.isLibrary() || this._itemGroup.ref.hasItem(ids[i])) {
					var item = Zotero.Items.get(ids[i]);
					if (!item) {
						// DEBUG: this shouldn't really happen but could if a
						// modify comes in after a delete
						continue;
					}
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
			quicksearch.doCommand();
			madeChanges = true;
			sort = true;
		}
	}
	else if(action == 'add')
	{
		// If saved search, just re-run search
		if (this._itemGroup.isSearch())
		{
			this.refresh();
			madeChanges = true;
			sort = true;
		}
		
		// If not a quicksearch and not background window saved search,
		// process new items manually
		else if (quicksearch && quicksearch.value == '')
		{
			var items = Zotero.Items.get(ids);
			for (var i in items)
			{
				// if the item belongs in this collection
				if((this._itemGroup.isLibrary() || items[i].inCollection(this._itemGroup.ref.getID()))
					// if we haven't already added it to our hash map
					&& this._itemRowMap[items[i].getID()] == null
					// Regular item or standalone note/attachment
					&& (items[i].isRegularItem() || !items[i].getSource()))
				{
					this._showItem(new Zotero.ItemTreeView.TreeRow(items[i],0,false),this.rowCount);
					this._treebox.rowCountChanged(this.rowCount-1,1);
					
					madeChanges = true;
				}
			}
			
			if (madeChanges) {
				sort = (ids.length == 1) ? ids[0] : true;
			}
		}
		// Otherwise re-run the search, which refreshes the item list
		else
		{
			// For item adds, clear quicksearch
			if (activeWindow && type == 'item') {
				quicksearch.value = '';
			}
			quicksearch.doCommand();
			madeChanges = true;
			sort = true;
		}
	}
	
	if(madeChanges)
	{
		// If adding and this is the active window, select the item
		if(action == 'add' && ids.length===1 && activeWindow)
		{
			if (sort) {
				this.sort(typeof sort == 'number' ? sort : false);
			}
			else {
				this._refreshHashMap();
			}
			
			// Reset to Info tab
			this._ownerDocument.getElementById('zotero-view-tabs').selectedIndex = 0;
			this.selectItem(ids[0]);
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
			if (sort) {
				this.sort(typeof sort == 'number' ? sort : false);
			}
			else {
				this._refreshHashMap();
			}
			this.rememberSelection(savedSelection);
		}
		
		this._treebox.invalidate();
	}
	// For special case in which an item needs to be selected without changes
	// necessarily having been made
	// ('collection-item' add with tag selector open)
	else if (selectItem) {
		this.selectItem(selectItem);
	}
	
	this.selection.selectEventsSuppressed = false;
}

/*
 *  Unregisters view from Zotero.Notifier (called on window close)
 */
Zotero.ItemTreeView.prototype.unregister = function()
{
	Zotero.Notifier.unregisterObserver(this._unregisterID);
}

////////////////////////////////////////////////////////////////////////////////
///
///  nsITreeView functions
///  http://www.xulplanet.com/references/xpcomref/ifaces/nsITreeView.html
///
////////////////////////////////////////////////////////////////////////////////

Zotero.ItemTreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getItemAtRow(row);
	var val;
	
	if(column.id == "zotero-items-column-numChildren")
	{
		var c = obj.numChildren();
		if(c)	//don't display '0'
			val = c;
	}
	else if(column.id == "zotero-items-column-type")
	{
		val = Zotero.getString('itemTypes.'+Zotero.ItemTypes.getName(obj.getType()));
	}
	// Year column is just date field truncated
	else if (column.id == "zotero-items-column-year") {
		val = obj.getField('date', true).substr(0, 4)
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
	
	if(column.id == 'zotero-items-column-dateAdded' || column.id == 'zotero-items-column-dateModified')		//this is not so much that we will use this format for date, but a simple template for later revisions.
	{
		// Format date as short date in proper locale order and locale time
		// (e.g. "4/4/07 14:27:23")
		var order = Zotero.Date.getLocaleDateOrder();
		var date = Zotero.Date.sqlToDate(val, true);
		var parts = [];
		for (var i=0; i<3; i++) {
			switch (order[i]) {
				case 'y':
					parts.push(date.getFullYear().toString().substr(2));
					break;
					
				case 'm':
					parts.push((date.getMonth() + 1));
					break;
					
				case 'd':
					parts.push(date.getDate());
					break;
			}
			
			val = parts.join('/');
			val += ' ' + date.toLocaleTimeString();
		}
	}
	
	return val;
}

Zotero.ItemTreeView.prototype.getImageSrc = function(row, col)
{
	if(col.id == 'zotero-items-column-title')
	{
		return this._getItemAtRow(row).ref.getImageSrc();
	}
}

Zotero.ItemTreeView.prototype.isContainer = function(row)
{
	return this._getItemAtRow(row).isRegularItem();
}

Zotero.ItemTreeView.prototype.isContainerOpen = function(row)
{
	return this._dataItems[row].isOpen;
}

Zotero.ItemTreeView.prototype.isContainerEmpty = function(row)
{
	if(this._sourcesOnly) {
		return true;
	} else {
		return (this._getItemAtRow(row).numNotes() == 0 && this._getItemAtRow(row).numAttachments() == 0);
	}
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

Zotero.ItemTreeView.prototype.toggleOpenState = function(row)
{
	// Shouldn't happen but does if an item is dragged over a closed
	// container until it opens and then released, since the container
	// is no longer in the same place when the spring-load closes
	if (!this.isContainer(row)) {
		return;
	}
	
	var count = 0;		//used to tell the tree how many rows were added/removed
	var thisLevel = this.getLevel(row);
	
	if(this.isContainerOpen(row))
	{
		while((row + 1 < this._dataItems.length) && (this.getLevel(row + 1) > thisLevel))
		{
			this._hideItem(row+1);
			count--;	//count is negative when closing a container because we are removing rows
		}
	}
	else
	{
		var item = this._getItemAtRow(row).ref;
		//Get children
		var attachments = item.getAttachments();
		var notes = item.getNotes();
		
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
	
	this._treebox.beginUpdateBatch();
	
	this._dataItems[row].isOpen = !this._dataItems[row].isOpen;
	this._treebox.rowCountChanged(row+1, count); //tell treebox to repaint these
	this._treebox.invalidateRow(row);
	this._treebox.endUpdateBatch();
	this._refreshHashMap();
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
			col.element.setAttribute('sortActive',true);
			col.element.setAttribute('sortDirection',col.element.getAttribute('sortDirection') == 'descending' ? 'ascending' : 'descending');
		}
	}
	
	this.selection.selectEventsSuppressed = true;
	var savedSelection = this.saveSelection();
	this.sort();
	this.rememberSelection(savedSelection);
	this._treebox.invalidate();
	this.selection.selectEventsSuppressed = false;
}

/*
 *  Sort the items by the currently sorted column.
 *  Simply uses Array.sort() function, and refreshes the hash map.
 */
Zotero.ItemTreeView.prototype.sort = function(itemID)
{
	// If Zotero pane is hidden, mark tree for sorting later in setTree()
	if (!this._treebox.columns) {
		this._needsSort = true;
		return;
	}
	else {
		this._needsSort = false;
	}
	
	// Single child item sort -- just toggle parent open and closed
	if (itemID && this._itemRowMap[itemID] &&
			this._getItemAtRow(this._itemRowMap[itemID]).ref.getSource()) {
		var parentIndex = this.getParentIndex(this._itemRowMap[itemID]);
		this.toggleOpenState(parentIndex);
		this.toggleOpenState(parentIndex);
		return;
	}
	
	var columnField = this.getSortField();
	var order = this.getSortDirection() == 'ascending';
	
	var collation = Zotero.getLocaleCollation();
	
	// Year is really the date field truncated
	if (columnField == 'year') {
		columnField = 'date';
	}
	
	// Some fields (e.g. dates) need to be retrieved unformatted for sorting
	switch (columnField) {
		case 'date':
			var unformatted = true;
			break;
		
		default:
			var unformatted = false;
	}
	
	// Hash table of fields for which rows with empty values should be displayed last
	var emptyFirst = {
		title: true
	};
	
	// Cache primary values while sorting, since base-field-mapped getField()
	// calls are relatively expensive
	var cache = [];
	
	// Get the display field for a row (which might be a placeholder title)
	function getField(row) {
		var field;
		var type = row.getType();
		if (columnField == 'title') {
			if (type == 8 || type == 10) { // 'letter' and 'interview' itemTypeIDs
				field = row.ref.getDisplayTitle();
			}
			else {
				field = row.getField(columnField, unformatted, true);
			}
			// Ignore some leading and trailing characters when sorting
			field = Zotero.Items.getSortTitle(field);
		}
		else {
			field = row.getField(columnField, unformatted, true);
		}
		return field;
	}
	
	function rowSort(a,b) {
		var cmp, fieldA, fieldB;
		
		var aItemID = a.ref.id;
		if (cache[aItemID]) {
			fieldA = cache[aItemID];
		}
		var bItemID = b.ref.id;
		if (cache[bItemID]) {
			fieldB = cache[bItemID];
		}
		
		switch (columnField) {
			case 'type':
				var typeA = Zotero.getString('itemTypes.'+Zotero.ItemTypes.getName(a.getType()));
				var typeB = Zotero.getString('itemTypes.'+Zotero.ItemTypes.getName(b.getType()));
				
				cmp = (typeA > typeB) ? -1 : (typeA < typeB) ? 1 : 0;
				if (cmp) {
					return cmp;
				}
				break;
				
			case 'numChildren':
				cmp = b.numChildren() - a.numChildren();
				if (cmp) {
					return cmp;
				}
				break;
			
			default:
				if (fieldA == undefined) {
					fieldA = getField(a);
					cache[aItemID] = fieldA;
				}
				
				if (fieldB == undefined) {
					fieldB = getField(b);
					cache[bItemID] = fieldB;
				}
				
				// Display rows with empty values last
				if (!emptyFirst[columnField]) {
					cmp = (fieldA == '' && fieldB != '') ? -1 :
						(fieldA != '' && fieldB == '') ? 1 : 0;
					if (cmp) {
						return cmp;
					}
				}
				
				cmp = collation.compareString(1, fieldB, fieldA);
				if (cmp) {
					return cmp;
				}
		}
		
		if (columnField != 'firstCreator') {
			fieldA = a.getField('firstCreator');
			fieldB = b.getField('firstCreator');
			
			// Display rows with empty values last
			cmp = (fieldA == '' && fieldB != '') ? -1 :
				(fieldA != '' && fieldB == '') ? 1 : 0;
			if (cmp) {
				return cmp;
			}
			
			//cmp = (fieldA > fieldB) ? -1 : (fieldA < fieldB) ? 1 : 0;
			cmp = collation.compareString(1, fieldB, fieldA);
			if (cmp) {
				return cmp;
			}
		}
		
		if (columnField != 'date') {
			fieldA = a.getField('date', true, true);
			fieldB = b.getField('date', true, true);
			
			// Display rows with empty values last
			cmp = (fieldA == '' && fieldB != '') ? -1 :
				(fieldA != '' && fieldB == '') ? 1 : 0;
			if (cmp) {
				return cmp;
			}
			
			cmp = (fieldA > fieldB) ? -1 : (fieldA < fieldB) ? 1 : 0;
			if (cmp) {
				return cmp;
			}
		}
		
		fieldA = a.getField('dateModified');
		fieldB = b.getField('dateModified');
		return (fieldA > fieldB) ? -1 : (fieldA < fieldB) ? 1 : 0;
	}
	
	function doSort(a,b)
	{
		return rowSort(a,b);
	}
	
	function reverseSort(a,b)
	{
		return rowSort(a,b) * -1;
	}
	
	// Need to close all containers before sorting
	var openRows = new Array();
	for (var i=0; i<this._dataItems.length; i++) {
		if(this.isContainer(i) && this.isContainerOpen(i))
		{
			openRows.push(this._getItemAtRow(i).ref.getID());
			this.toggleOpenState(i);
		}
	}
	
	// Single-row sort
	if (itemID) {
		this._refreshHashMap();
		var row = this._itemRowMap[itemID];
		for (var i=0, len=this._dataItems.length; i<len; i++) {
			if (i == row) {
				continue;
			}
			
			if (order) {
				var cmp = reverseSort(this._dataItems[i], this._dataItems[row]);
			}
			else {
				var cmp = doSort(this._dataItems[i], this._dataItems[row]);
			}
			
			// As soon as we find a value greater (or smaller if reverse sort),
			// insert row at that position
			if (cmp < 0) {
				var rowItem = this._dataItems.splice(row, 1);
				this._dataItems.splice(row < i ? i-1 : i, 0, rowItem[0]);
				this._treebox.invalidate();
				break;
			}
			
			// If greater than last row, move to end
			if (i == len-1) {
				var rowItem = this._dataItems.splice(row, 1);
				this._dataItems.splice(i, 0, rowItem[0]);
				this._treebox.invalidate();
			}
		}
	}
	// Full sort
	else {
		if (order) {
			this._dataItems.sort(doSort);
		}
		else {
			this._dataItems.sort(reverseSort);
		}
	}
		
	this._refreshHashMap();
	
	// Reopen closed containers
	for (var i = 0; i < openRows.length; i++) {
		this.toggleOpenState(this._itemRowMap[openRows[i]]);
	}
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
	// If no row map, we're probably in the process of switching collections,
	// so store the item to select on the item group for later
	if (!this._itemRowMap) {
		if (this._itemGroup) {
			this._itemGroup.itemToSelect = { id: id, expand: expand };
			return false;
		}
		
		Zotero.debug('Item group not found and no row map in ItemTreeView.selectItem() -- discarding select', 2);
		return false;
	}
	
	var row = this._itemRowMap[id];
	
	// Get the row of the parent, if there is one
	var parentRow = null;
	var item = Zotero.Items.get(id);
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
				this._ownerDocument.defaultView.ZoteroPane.clearQuicksearch();
				this._ownerDocument.defaultView.ZoteroPane.clearTagSelection();
				return this.selectItem(id, expand, true);
			}
			
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
				items.push(this._getItemAtRow(j).ref.getID());
			}
			else {
				items.push(this._getItemAtRow(j).ref);
			}
		}
	}
	return items;
}


/*
 * Delete the selection
 *
 * _force_ deletes item from DB even if removing from a collection
 */
Zotero.ItemTreeView.prototype.deleteSelection = function(eraseChildren, force)
{
	if(this.selection.count == 0)
		return;
		
	//collapse open items
	for(var i=0; i<this.rowCount; i++)
		if(this.selection.isSelected(i) && this.isContainer(i) && this.isContainerOpen(i))
			this.toggleOpenState(i);
	this._refreshHashMap();
	
	//create an array of selected items
	var ids = [];
	var start = {};
	var end = {};
	for (var i=0, len=this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++)
			ids.push(this._getItemAtRow(j).ref.getID());
	}
	
	//iterate and erase...
	this._treebox.beginUpdateBatch();
	
	// Erase item(s) from DB
	if (this._itemGroup.isLibrary() || force) {
		Zotero.Items.erase(ids, eraseChildren);
	}
	else if (this._itemGroup.isCollection()) {
		this._itemGroup.ref.removeItems(ids);
	}
	this._treebox.endUpdateBatch();
}


/*
 * Set the tags filter on the view
 */
Zotero.ItemTreeView.prototype.setFilter = function(type, data) {
	if (!this._treebox || !this._treebox.treeBody) {
		Components.utils.reportError("Treebox didn't exist in itemTreeView.setFilter()");
		return;
	}
	
	this.selection.selectEventsSuppressed = true;
	var savedSelection = this.saveSelection();
	var savedOpenState = this.saveOpenState();
	var savedFirstRow = this.saveFirstRow();
	
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
	
	this.rememberOpenState(savedOpenState);
	this.expandMatchParents();
	this.rememberFirstRow(savedFirstRow);
	this.rememberSelection(savedSelection);
	this._treebox.invalidate();
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
	this._itemRowMap = new Array();
	for(var i=0; i < this.rowCount; i++)
	{
		var row = this._getItemAtRow(i);
		this._itemRowMap[row.ref.getID()] = i;
	}
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
			savedSelection.push(item.ref.getID());
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
}


Zotero.ItemTreeView.prototype.saveOpenState = function() {
	var ids = [];
	for (var i=0, len=this.rowCount; i<len; i++) {
		if (this.isContainer(i) && this.isContainerOpen(i)) {
			ids.push(this._getItemAtRow(i).ref.getID());
		}
	}
	return ids;
}


Zotero.ItemTreeView.prototype.rememberOpenState = function(ids) {
	for each(var id in ids) {
		var row = this._itemRowMap[id];
		if (row == undefined || !this.isContainer(row) || this.isContainerOpen(row)) {
			continue;
		}
		this.toggleOpenState(row);
	}
}


Zotero.ItemTreeView.prototype.expandMatchParents = function () {
	// Expand parents of child matches
	if (this._searchMode) {
		var view = this._treebox.view;
		for (var id in this._searchParentIDs) {
			if (!view.isContainerOpen(this._itemRowMap[id])) {
				view.toggleOpenState(this._itemRowMap[id]);
			}
		}
	}
}


Zotero.ItemTreeView.prototype.saveFirstRow = function() {
	var row = this._treebox.getFirstVisibleRow();
	if (row) {
		return this._getItemAtRow(row).ref.getID();
	}
	return false;
}


Zotero.ItemTreeView.prototype.rememberFirstRow = function(firstRow) {
	if (firstRow && this._itemRowMap[firstRow]) {
		this._treebox.scrollToRow(this._itemRowMap[firstRow]);
	}
}


Zotero.ItemTreeView.prototype.expandAllRows = function(treebox) {
	var view = treebox.view;
	treebox.beginUpdateBatch();
	for (var i=0; i<view.rowCount; i++) {
		if (view.isContainer(i) && !view.isContainerOpen(i)) {
			view.toggleOpenState(i);
		}
	}
	treebox.endUpdateBatch();
}


Zotero.ItemTreeView.prototype.collapseAllRows = function(treebox) {
	var view = treebox.view;
	treebox.beginUpdateBatch();
	for (var i=0; i<view.rowCount; i++) {
		if (view.isContainer(i) && view.isContainerOpen(i)) {
			view.toggleOpenState(i);
		}
	}
	treebox.endUpdateBatch();
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


/*
 * Returns an array of item ids of visible items in current sort order
 */
Zotero.ItemTreeView.prototype.getSortedItems = function() {
	var ids = [];
	for each(var item in this._dataItems) {
		ids.push(item.ref.getID());
	}
	return ids;
}

Zotero.ItemTreeView.prototype.getSortField = function() {
	var column = this._treebox.columns.getSortedColumn()
	if (!column) {
		column = this._treebox.columns.getFirstColumn()
	}
	// zotero-items-column-_________
	return column.id.substring(20);
}


/*
 * Returns 'ascending' or 'descending'
 *
 * A-Z == 'descending'
 */
Zotero.ItemTreeView.prototype.getSortDirection = function() {
	var column = this._treebox.columns.getSortedColumn();
	if (!column) {
		return 'descending';
	}
	return column.element.getAttribute('sortDirection');
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
	if(cmd == 'cmd_selectAll')
		this.tree.view.selection.selectAll();
}

Zotero.ItemTreeCommandController.prototype.onEvent = function(evt)
{
	
}

////////////////////////////////////////////////////////////////////////////////
///
///  Drag-and-drop functions:
///		for nsDragAndDrop.js + nsTransferable.js
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Begin a drag
 */
Zotero.ItemTreeView.prototype.onDragStart = function (evt,transferData,action)
{ 
	try {
	
	
	transferData.data = new TransferData();
	transferData.data.addDataForFlavour("zotero/item", this.saveSelection());
	
	var items = Zotero.Items.get(this.saveSelection());
	
	// If at least one file is a non-web-link attachment and can be found,
	// enable dragging to file system
	for (var i=0; i<items.length; i++) {
		if (items[i].isAttachment() &&
				items[i].getAttachmentLinkMode() != Zotero.Attachments.LINK_MODE_LINKED_URL
					&& items[i].getFile()) {
			transferData.data.addDataForFlavour("application/x-moz-file-promise",
				new Zotero.ItemTreeView.fileDragDataProvider(), 0, Components.interfaces.nsISupports);
			break;
		}
	}
	
	// Get Quick Copy format for current URL
	var url = this._ownerDocument.defaultView.content.location.href;
	var format = Zotero.QuickCopy.getFormatFromURL(url);
	
	Zotero.debug("Dragging with format " + Zotero.QuickCopy.getFormattedNameFromSetting(format));
	
	var exportCallback = function(obj, worked) {
		if (!worked) {
			Zotero.log(Zotero.getString("fileInterface.exportError"), 'warning');
			return;
		}
		
		var text = obj.output.replace(/\r\n/g, "\n");
		transferData.data.addDataForFlavour("text/unicode", text);
	}
	
	var [mode, ] = format.split('=');
	if (mode == 'export') {
		Zotero.QuickCopy.getContentFromItems(items, format, exportCallback);
	}
	else if (mode == 'bibliography') {
		var content = Zotero.QuickCopy.getContentFromItems(items, format);
		transferData.data.addDataForFlavour("text/unicode", content.text);
		transferData.data.addDataForFlavour("text/html", content.html);
	}
	
	
	
	}
	catch (e) {
		Zotero.debug(e);
	}
}


// Implements nsIFlavorDataProvider for dragging attachment files to OS
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
						items[i].getAttachmentLinkMode() == Zotero.Attachments.LINK_MODE_LINKED_URL) {
					continue;
				}
				
				var file = items[i].getFile();
				
				// Determine if we need to copy multiple files for this item
				// (web page snapshots)
				if (items[i].getAttachmentLinkMode() != Zotero.Attachments.LINK_MODE_LINKED_FILE) {
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
					var dirName = Zotero.Attachments.getFileBaseNameFromItem(items[i].getID());
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
							existingItems.push(items[i].getID());
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
							existingItems.push(items[i].getID());
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


/*
 *  Called by nsDragAndDrop.js for any sort of drop on the tree
 */
Zotero.ItemTreeView.prototype.getSupportedFlavours = function () 
{ 
	var flavors = new FlavourSet();
	flavors.appendFlavour("zotero/item");
	flavors.appendFlavour("text/x-moz-url");
	flavors.appendFlavour("application/x-moz-file", "nsIFile");
	return flavors; 
}

Zotero.ItemTreeView.prototype.canDrop = function(row, orient)
{
	if (row == -1 && orient == -1) {
		return true;
	}
	
	try
	{
		var dataSet = nsTransferable.get(this.getSupportedFlavours(),
			nsDragAndDrop.getDragData, true);
	}
	catch (e)
	{
		// A work around a limitation in nsDragAndDrop.js -- the mDragSession
		// is not set until the drag moves over another control.
		// (This will only happen if the first drag is from the item list.)
		nsDragAndDrop.mDragSession = nsDragAndDrop.mDragService.getCurrentSession();
		return false;
	}
	
	var data = dataSet.first.first;
	var dataType = data.flavour.contentType;
	
	//Zotero.debug("Drag data type is " + dataType);
	
	switch (dataType) {
		case 'zotero/item':
			var ids = data.data.split(','); // ids of rows we are dragging in
			break;
		
		case 'text/x-moz-url':
			var url = data.data.split("\n")[0];
			break;
			
		case 'application/x-moz-file':
			var file = data.data;
			// Don't allow folder drag
			if (file.isDirectory()) {
				return false;
			}
			break;
	}
	
	// workaround... two different services call canDrop
	// (nsDragAndDrop, and the tree) -- this is for the former,
	// used when dragging between windows
	if (typeof row == 'object')
	{
		// If drag to different window
		if (nsDragAndDrop.mDragSession.sourceNode!=row.target)
		{
			if (dataType == 'zotero/item') {
				// Check if at least one item (or parent item for children) doesn't
				// already exist in target
				for each(var id in ids)
				{
					var item = Zotero.Items.get(id);
					
					// Skip non-top-level items
					if (!item.isRegularItem() && item.getSource())
					{
						continue;
					}
					// DISABLED: move parent on child drag
					//var source = item.isRegularItem() ? false : item.getSource();
					//if (!this._itemGroup.ref.hasItem(source ? source : id))
					if (this._itemGroup.ref && !this._itemGroup.ref.hasItem(id))
					{
						return true;
					}
				}
			}
			else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
				if (this._itemGroup.isSearch()) {
					return false;
				}
				
				return true;
			}
		}
		
		return false;
	}
	
	//Zotero.debug('row is ' + row);
	//Zotero.debug('orient is ' + orient);
	
	// Highlight the rows correctly on drag
	
	var rowItem = this._getItemAtRow(row).ref; //the item we are dragging over
	if (dataType == 'zotero/item')
	{
		// Directly on a row
		if (orient == 0)
		{
			var canDrop = false;
			for each(var id in ids) {
				var item = Zotero.Items.get(id);
				
				// If any regular items, disallow drop
				if (item.isRegularItem()) {
					canDrop = false;
					break;
				}
				
				// Only allow dragging of notes and attachments
				// that aren't already children of the item
				if (item.getSource() != rowItem.getID()) {
					canDrop = true;
				}
			}
			
			return canDrop;
		}
		
		// In library, allow children to be dragged out of parent
		else if (this._itemGroup.isLibrary() || this._itemGroup.isCollection())
		{
			for each(var id in ids)
			{
				// Don't allow drag if any top-level items
				var item = Zotero.Items.get(id);
				if (item.isRegularItem() || !item.getSource())
				{
					return false;
				}
			}
			return true;
		}
		return false;
	}
	else if (dataType == "text/x-moz-url" || dataType == 'application/x-moz-file') {
		// Disallow direct drop on a non-regular item (e.g. note)
		if (orient == 0) {
			if (!rowItem.isRegularItem()) {
				return false;
			}
		}
		else if (this._itemGroup.isSearch()) {
			return false;
		}
		
		return true;
	}
	
	return false;
}

/*
 *  Called when something's been dropped on or next to a row
 */
Zotero.ItemTreeView.prototype.drop = function(row, orient)
{
	try
	{
		var dataSet = nsTransferable.get(this.getSupportedFlavours(),
			nsDragAndDrop.getDragData, true);
	}
	catch (e)
	{
		// A work around a limitation in nsDragAndDrop.js -- the mDragSession
		// is not set until the drag moves over another control.
		// (This will only happen if the first drag is from the item list.)
		nsDragAndDrop.mDragSession = nsDragAndDrop.mDragService.getCurrentSession();
		var dataSet = nsTransferable.get(this.getSupportedFlavours(),
			nsDragAndDrop.getDragData, true);
	}
	
	var data = dataSet.first.first;
	var dataType = data.flavour.contentType;
	
	if (!this.canDrop(row, orient)) {
		return false;
	}
	
	if (dataType == 'zotero/item') {
		var ids = data.data.split(','); // ids of rows we are dragging in
		
		// Dropped directly on a row
		if (orient == 0)
		{
			// If item was a top-level item and it exists in a collection,
			// replace it in collections with the parent item
			var rowItem = this._getItemAtRow(row).ref; // the item we are dragging over
			for each(var id in ids)
			{
				var item = Zotero.Items.get(id);
				item.setSource(rowItem.getID());
			}
		}
		
		// Dropped outside of a row
		else
		{
			// Remove from parent and make top-level
			if (this._itemGroup.isLibrary())
			{
				for each(var id in ids)
				{
					var item = Zotero.Items.get(id);
					if (!item.isRegularItem())
					{
						item.setSource();
					}
				}
			}
			// Add to collection
			else
			{
				for each(var id in ids)
				{
					var item = Zotero.Items.get(id);
					var source = item.isRegularItem() ? false : item.getSource();
					
					// Top-level item
					if (source) {
						item.setSource();
					}
					this._itemGroup.ref.addItem(id);
				}
			}
		}
	}
	else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
		var sourceItemID = false;
		var parentCollectionID = false;
		
		if (orient == 0) {
			sourceItemID = this._getItemAtRow(row).ref.getID()
		}
		else if (this._itemGroup.isCollection()) {
			var parentCollectionID = this._itemGroup.ref.getID();
		}
		
		var unlock = Zotero.Notifier.begin(true);
		try {
			var dataList = dataSet.dataList;
			for (var i=0, len=dataList.length; i<len; i++) {
				var file = dataList[i].first.data;
				
				if (dataType == 'text/x-moz-url') {
					var url = file.split("\n")[0];
					
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
						Zotero.Attachments.importFromURL(url, sourceItemID, false, false, parentCollectionID);
						continue;
					}
					
					// Otherwise file, so fall through
				}
				
				try {
					Zotero.DB.beginTransaction();
					var itemID = Zotero.Attachments.importFromFile(file, sourceItemID);
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

/*
 * Called by nsDragAndDrop.js for any sort of drop on the tree
 */
Zotero.ItemTreeView.prototype.onDrop = function (evt,dropdata,session){ }

Zotero.ItemTreeView.prototype.onDragOver = function (evt,dropdata,session) { }

////////////////////////////////////////////////////////////////////////////////
///
///  Functions for nsITreeView that we have to stub out.
///
////////////////////////////////////////////////////////////////////////////////

Zotero.ItemTreeView.prototype.isSeparator = function(row) 						{ return false; }
Zotero.ItemTreeView.prototype.getRowProperties = function(row, prop) { }
Zotero.ItemTreeView.prototype.getColumnProperties = function(col, prop) 		{ }

/* Mark items not matching search as context rows, displayed in gray */
Zotero.ItemTreeView.prototype.getCellProperties = function(row, col, prop) {
	if (this._searchMode && !this._searchItemIDs[this._getItemAtRow(row).ref.getID()]) {
		var aServ = Components.classes["@mozilla.org/atom-service;1"].
			getService(Components.interfaces.nsIAtomService);
		prop.AppendElement(aServ.getAtom("contextRow"));
	}
}

Zotero.ItemTreeView.TreeRow = function(ref, level, isOpen)
{
	this.ref = ref;			//the item associated with this
	this.level = level;
	this.isOpen = isOpen;
}

Zotero.ItemTreeView.TreeRow.prototype.isNote = function()
{
	return this.ref.isNote();
}

Zotero.ItemTreeView.TreeRow.prototype.isAttachment = function()
{
	return this.ref.isAttachment();
}

Zotero.ItemTreeView.TreeRow.prototype.isRegularItem = function()
{
	return this.ref.isRegularItem();
}

Zotero.ItemTreeView.TreeRow.prototype.getField = function(field, unformatted)
{
	return this.ref.getField(field, unformatted, true);
}

Zotero.ItemTreeView.TreeRow.prototype.getType = function()
{
	return this.ref.getType();
}

Zotero.ItemTreeView.TreeRow.prototype.numChildren = function()
{
	if(this.isRegularItem())
		return this.ref.numChildren();
	else
		return 0;
}

Zotero.ItemTreeView.TreeRow.prototype.numNotes = function()
{
	if(this.isRegularItem())
		return this.ref.numNotes();
	else
		return 0;
}

Zotero.ItemTreeView.TreeRow.prototype.numAttachments = function()
{
	if(this.isRegularItem())
		return this.ref.numAttachments();
	else
		return 0;
}