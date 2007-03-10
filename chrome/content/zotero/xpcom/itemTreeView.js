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
	this._itemGroup = itemGroup;
	this._sourcesOnly = sourcesOnly;
	
	this._callbacks = [];
	
	this._treebox = null;
	this._ownerDocument = null;
	this._needsSort = false;
	
	this.refresh();
	
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
	this._treebox = treebox;
	
	// Add a keypress listener for expand/collapse
	var expandAllRows = this.expandAllRows;
	var collapseAllRows = this.collapseAllRows;
	var tree = this._treebox.treeBody.parentNode;
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
	
	this.sort();
	
	//Zotero.debug('Running callbacks in itemTreeView.setTree()', 4);
	this._runCallbacks();
}


/*
 *  Reload the rows from the data access methods
 *  (doesn't call the tree.invalidate methods, etc.)
 */
Zotero.ItemTreeView.prototype.refresh = function()
{
	var oldRows = this.rowCount;
	
	this._dataItems = new Array();
	this.rowCount = 0;
	
	var newRows = this._itemGroup.getChildItems();
	if (newRows.length)
	{
		for(var i = 0, len = newRows.length; i < len; i++)
		{
			if(newRows[i] &&
			  (!this._sourcesOnly || (!newRows[i].isAttachment() && !newRows[i].isNote())))
			{
				this._showItem(new Zotero.ItemTreeView.TreeRow(newRows[i],0,false), i+1); //item ref, before row
			}
		}
	}
	
	this._refreshHashMap();
	
	// Update the treebox's row count
	var diff = this.rowCount - oldRows;
	if (this._treebox && diff != 0) {
		this._treebox.rowCountChanged(0, diff);
	}
}

/*
 *  Called by Zotero.Notifier on any changes to items in the data layer
 */
Zotero.ItemTreeView.prototype.notify = function(action, type, ids)
{
	var madeChanges = false;
	this.selection.selectEventsSuppressed = true;
	var savedSelection = this.saveSelection();
	
	if (this._treebox && this._treebox.treeBody) {
		// See if we're in the active window
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
		if (wm.getMostRecentWindow("navigator:browser") == this._ownerDocument.defaultView){
			var activeWindow = true;
		}
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
		}		
		
	}
	else if (action == 'modify')
	{
		// If saved search, just re-run search
		if (this._itemGroup.isSearch())
		{
			this.refresh();
			madeChanges = true;
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
					if (this.isContainer(row) && this.isContainerOpen(row))
					{
						this.toggleOpenState(row);
						this.toggleOpenState(row);
					}
					// If item moved from top-level to under another item,
					// remove the old row
					else if (!this.isContainer(row) && this.getParentIndex(row)==-1
						&& this._getItemAtRow(row).ref.getSource())
					{
							this._hideItem(row);
							this._treebox.rowCountChanged(row+1, -1)
					}
					else if (!this.isContainer(row) && this.getParentIndex(row)!=-1
						&& !this._getItemAtRow(row).ref.getSource())
					{
						var item = Zotero.Items.get(ids[i]);
						this._showItem(new Zotero.ItemTreeView.TreeRow(item, 0, false), this.rowCount);
						this._treebox.rowCountChanged(this.rowCount-1, 1);
					}
					else
					{
						this._treebox.invalidateRow(row);
					}
					madeChanges = true;
				}
				
				//else if(this._itemGroup.isLibrary() || this._itemGroup.ref.hasItem(ids[i]))
				else
				{
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
					}
				}
			}
		}
		
		// If quicksearch, re-run it, since the results may have changed
		else
		{
			quicksearch.doCommand();
			madeChanges = true;
		}
	}
	else if(action == 'add')
	{
		// If saved search, just re-run search
		if (this._itemGroup.isSearch())
		{
			this.refresh();
			madeChanges = true;
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
		}
		// Otherwise re-run the search, which refreshes the item list
		else
		{
			if (activeWindow) {
				quicksearch.value = '';
			}
			quicksearch.doCommand();
			madeChanges = true;
		}
	}
	
	if(madeChanges)
	{
		this.sort();				//this also refreshes the hash map
		this._treebox.invalidate();
		
		// If adding and this is the active window, select the item
		if(action == 'add' && ids.length===1 && activeWindow)
		{
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
				this.sort();
				this._treebox.invalidate();
			}
			
			this.rememberSelection(savedSelection);
			
			if (activeWindow) {
				this.selectItem(ids[0]);
			}
		}
		else
		{
			this.rememberSelection(savedSelection);
		}
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
	else
	{
		val = obj.getField(column.id.substring(20));
	}
	
	if(column.id == 'zotero-items-column-dateAdded' || column.id == 'zotero-items-column-dateModified')		//this is not so much that we will use this format for date, but a simple template for later revisions.
	{
		val = new Date(Date.parse(val.replace(/-/g,"/"))).toLocaleString();
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

// Gets the index of the row's container, or -1 if none (container itself or top-level)
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
	this.selection.selectEventsSuppressed = false;
	this._treebox.invalidate();
}

/*
 *  Sort the items by the currently sorted column.
 *  Simply uses Array.sort() function, and refreshes the hash map.
 */
Zotero.ItemTreeView.prototype.sort = function()
{
	// If Zotero pane is hidden, mark tree for sorting later in setTree()
	if (!this._treebox.columns) {
		this._needsSort = true;
		return;
	}
	else {
		this._needsSort = false;
	}
	
	var column = this._treebox.columns.getSortedColumn();
	if (!column){
		column = this._treebox.columns.getFirstColumn();
	}
	var order = column.element.getAttribute('sortDirection') == 'ascending';
	var columnField = column.id.substring(20);
	
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
	
	function columnSort(a,b) {
		var cmp, fieldA, fieldB;
		
		var aItemID = a.ref.getID();
		if (cache[aItemID]) {
			fieldA = cache[aItemID];
		}
		var bItemID = b.ref.getID();
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
					fieldA = a.getField(columnField, unformatted, true);
					if (typeof fieldA == 'string') {
						fieldA = fieldA.toLowerCase();
					}
					cache[aItemID] = fieldA;
				}
				
				if (fieldB == undefined) {
					fieldB = b.getField(columnField, unformatted, true);
					if (typeof fieldB == 'string') {
						fieldB = fieldB.toLowerCase();
					}
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
				
				cmp = (fieldA > fieldB) ? -1 : (fieldA < fieldB) ? 1 : 0;
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
			
			cmp = (fieldA > fieldB) ? -1 : (fieldA < fieldB) ? 1 : 0;
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
		return columnSort(a,b);
	}
	
	function oppositeSort(a,b)
	{
		return(doSort(a,b) * -1);
	}
	
	var openRows = new Array();
	for(var i = 0; i < this._dataItems.length; i++)
	{
		if(this.isContainer(i) && this.isContainerOpen(i))
		{
			openRows.push(this._getItemAtRow(i).ref.getID());
			this.toggleOpenState(i);
		}
	}
	
	if(order)
		this._dataItems.sort(doSort);
	else
		this._dataItems.sort(oppositeSort);
		
	this._refreshHashMap();
	
	for(var i = 0; i < openRows.length; i++)
		this.toggleOpenState(this._itemRowMap[openRows[i]]);
	
}

////////////////////////////////////////////////////////////////////////////////
///
///  Additional functions for managing data in the tree
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Select an item
 */
Zotero.ItemTreeView.prototype.selectItem = function(id, expand)
{
	var row = this._itemRowMap[id];
	
	// Get the row of the parent, if there is one
	var parentRow = null;
	var item = Zotero.Items.get(id);
	var parent = item.getSource();
	if (parent && this._itemRowMap[parent]) {
		parentRow = this._itemRowMap[parent];
	}
	
	// If row with id not visible, check to see if it's hidden under a parent
	if(row == null)
	{
		if (!parent || !parentRow)
		{
			// No parent -- it's not here
			return false;
		}
		this.toggleOpenState(parentRow); //opens the parent of the item
		row = this._itemRowMap[id];
	}
		
	this.selection.select(row);
	// If _expand_, open container
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
		for each(var id in ids) {
			this._itemGroup.ref.removeItem(id);
		}
	}
	this._treebox.endUpdateBatch();
}


/*
 * Set the tags filter on the view
 */
Zotero.ItemTreeView.prototype.setFilter = function(type, data) {
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
	this.rememberFirstRow(savedFirstRow);
	this.rememberSelection(savedSelection);
	this.selection.selectEventsSuppressed = false;
	this._treebox.invalidate();
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
		if (!row || !this.isContainer(row) || this.isContainerOpen(row)) {
			continue;
		}
		this.toggleOpenState(row);
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
 */
Zotero.ItemTreeView.prototype.getSortDirection = function() {
	var column = this._treebox.columns.getSortedColumn();
	if (!column) {
		return 'ascending';
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
	transferData.data=new TransferData();
	transferData.data.addDataForFlavour("zotero/item", this.saveSelection());
}

/*
 *  Called by nsDragAndDrop.js for any sort of drop on the tree
 */
Zotero.ItemTreeView.prototype.getSupportedFlavours = function () 
{ 
	var flavors = new FlavourSet();
	flavors.appendFlavour("zotero/item");
	flavors.appendFlavour("text/x-moz-url");
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
	
	switch (dataType) {
		case 'zotero/item':
			var ids = data.data.split(','); // ids of rows we are dragging in
			break;
		
		case 'text/x-moz-url':
			var url = data.data.split("\n")[0];
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
			else if (dataType == 'text/x-moz-url') {
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
			for each(var id in ids)
			{
				var item = Zotero.Items.get(id);
				// Only allow dragging of notes and attachments
				// that aren't already children of the item
				if (!item.isRegularItem() && item.getSource()!=rowItem.getID())
				{
					return true;
				}
			}
		}
		
		// In library, allow children to be dragged out of parent
		else if (this._itemGroup.isLibrary())
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
	else if (dataType == "text/x-moz-url") {
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
					if (!source)
					{
						this._itemGroup.ref.addItem(id);
					}
					// Non-top-level item - currently unused
					else
					{
						// TODO: Prompt before moving source item to collection
						this._itemGroup.ref.addItem(source);
					}
				}
			}
		}
	}
	else if (dataType == 'text/x-moz-url') {
		var url = data.data.split("\n")[0];
		
		var sourceItemID = false;
		var parentCollectionID = false;
		
		if (orient == 0) {
			var rowItem = this._getItemAtRow(row).ref;
			sourceItemID = rowItem.getID()
		}
		else if (this._itemGroup.isCollection()) {
			var parentCollectionID = this._itemGroup.ref.getID();
		}
		
		Zotero.Attachments.importFromURL(url, sourceItemID, false, parentCollectionID);
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
Zotero.ItemTreeView.prototype.getRowProperties = function(row, prop) 			{ }
Zotero.ItemTreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Zotero.ItemTreeView.prototype.getCellProperties = function(row, col, prop) 	{ }

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