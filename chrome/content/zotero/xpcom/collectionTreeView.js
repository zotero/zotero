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
///  CollectionTreeView
///    -- handles the link between an individual tree and the data layer
///    -- displays only collections, in a hierarchy (no items)
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Constructor for the CollectionTreeView object
 */
Zotero.CollectionTreeView = function()
{
	this.itemToSelect = null;
	this.hideSources = [];
	
	this._treebox = null;
	this._highlightedRows = {};
	this._unregisterID = Zotero.Notifier.registerObserver(this, ['collection', 'search', 'share', 'group', 'trash', 'bucket']);
	this._containerState = {};
	this._duplicateLibraries = [];
	this._unfiledLibraries = [];
	this._trashNotEmpty = {};
}

Zotero.CollectionTreeView.prototype = Object.create(Zotero.LibraryTreeView.prototype);
Zotero.CollectionTreeView.prototype.type = 'collection';

Object.defineProperty(Zotero.CollectionTreeView.prototype, "itemGroup", {
	get: function () {
		return this.getItemGroupAtRow(this.selection.currentIndex);
	}
})


/*
 *  Called by the tree itself
 */
Zotero.CollectionTreeView.prototype.setTree = function(treebox)
{
	if (this._treebox || !treebox) {
		return;
	}
	this._treebox = treebox;
	
	// Add a keypress listener for expand/collapse
	var tree = this._treebox.treeBody.parentNode;
	var self = this;
	
	tree.addEventListener('keypress', function(event) {
		var key = String.fromCharCode(event.which);
		
		if (key == '+' && !(event.ctrlKey || event.altKey || event.metaKey)) {
			self.expandLibrary(self);
			return;
		}
		else if (key == '-' && !(event.shiftKey || event.ctrlKey ||
				event.altKey || event.metaKey)) {
			self.collapseLibrary(self);
			return;
		}
	}, false);
	
	try {
		this.refresh();
	}
	// Tree errors don't get caught by default
	catch (e) {
		Zotero.debug(e);
		Components.utils.reportError(e);
		throw (e);
	}
	
	this.selection.currentColumn = this._treebox.columns.getFirstColumn();
	
	var row = this.getLastViewedRow();
	this.selection.select(row);
	
	// TODO: make better
	var tb = this._treebox;
	setTimeout(function () {
		tb.ensureRowIsVisible(row);
	}, 1);
}


/*
 *  Reload the rows from the data access methods
 *  (doesn't call the tree.invalidate methods, etc.)
 */
Zotero.CollectionTreeView.prototype.refresh = function()
{
	// Record open states before refreshing
	if (this._dataItems) {
		for (var i=0, len=this._dataItems.length; i<len; i++) {
			var itemGroup = this._dataItems[i][0]
			if (itemGroup.ref && itemGroup.ref.id == 'commons-header') {
				var commonsExpand = this.isContainerOpen(i);
			}
		}
	}
	
	this.selection.clearSelection();
	var oldCount = this.rowCount;
	this._dataItems = [];
	this.rowCount = 0;
	
	try {
		this._containerState = JSON.parse(Zotero.Prefs.get("sourceList.persist"));
	}
	catch (e) {
		this._containerState = {};
	}
	
	if (this.hideSources.indexOf('duplicates') == -1) {
		try {
			this._duplicateLibraries = Zotero.Prefs.get('duplicateLibraries').split(',');
		}
		catch (e) {
			// Add to personal library by default
			Zotero.Prefs.set('duplicateLibraries', '0');
			this._duplicateLibraries = ['0'];
		}
	}
	
	try {
		this._unfiledLibraries = Zotero.Prefs.get('unfiledLibraries').split(',');
	}
	catch (e) {
		// Add to personal library by default
		Zotero.Prefs.set('unfiledLibraries', '0');
		this._unfiledLibraries = ['0'];
	}
	
	var self = this;
	var library = {
		libraryID: null
	};
	
	 // itemgroup, level, beforeRow, startOpen
	this._showRow(new Zotero.ItemGroup('library', library), 0, 1);
	this._expandRow(0);
	
	var groups = Zotero.Groups.getAll();
	if (groups.length) {
		this._showRow(new Zotero.ItemGroup('separator', false));
		var header = {
			id: "group-libraries-header",
			label: Zotero.getString('pane.collections.groupLibraries'),
			expand: function (beforeRow, groups) {
				if (!groups) {
					var groups = Zotero.Groups.getAll();
				}
				
				var newRows = 0;
				for (var i = 0, len = groups.length; i < len; i++) {
					var row = self._showRow(new Zotero.ItemGroup('group', groups[i]), 1, beforeRow ? beforeRow + i + newRows : null);
					newRows += self._expandRow(row);
				}
				return newRows;
			}
		}
		var row = this._showRow(new Zotero.ItemGroup('header', header));
		if (this._containerState.HG) {
			this._dataItems[row][1] = true;
			header.expand(null, groups);
		}
	}
	
	try {
		this._refreshHashMap();
	}
	catch (e) {
		Components.utils.reportError(e);
		Zotero.debug(e);
		throw (e);
	}
	
	// Update the treebox's row count
	var diff = this.rowCount - oldCount;
	if (diff != 0) {
		this._treebox.rowCountChanged(0, diff);
	}
}


/*
 *  Redisplay everything
 */
Zotero.CollectionTreeView.prototype.reload = function()
{
	this._treebox.beginUpdateBatch();
	this.refresh();
	this._treebox.invalidate();
	this._treebox.endUpdateBatch();
}

/*
 *  Called by Zotero.Notifier on any changes to collections in the data layer
 */
Zotero.CollectionTreeView.prototype.notify = function(action, type, ids)
{
	if ((!ids || ids.length == 0) && action != 'refresh' && action != 'redraw') {
		return;
	}
	
	if (!this._collectionRowMap) {
		Zotero.debug("Collection row map didn't exist in collectionTreeView.notify()");
		return;
	}
	
	if (action == 'refresh' && type == 'trash') {
		this._trashNotEmpty[ids[0]] = !!Zotero.Items.getDeleted(ids[0]).length;
		return;
	}
	
	if (action == 'redraw') {
		this._treebox.invalidate();
		return;
	}
	
	this.selection.selectEventsSuppressed = true;
	var savedSelection = this.saveSelection();
	
	if (action == 'delete') {
		var selectedIndex = this.selection.count ? this.selection.selectedIndex : 0;
		
		//Since a delete involves shifting of rows, we have to do it in order
		
		//sort the ids by row
		var rows = new Array();
		for (var i in ids)
		{
			switch (type)
			{
				case 'collection':
					if (typeof this._rowMap['C' + ids[i]] != 'undefined') {
						rows.push(this._rowMap['C' + ids[i]]);
					}
					break;
				
				case 'search':
					if (typeof this._rowMap['S' + ids[i]] != 'undefined') {
						rows.push(this._rowMap['S' + ids[i]]);
					}
					break;
				
				case 'group':
					//if (this._rowMap['G' + ids[i]] != null) {
					//	rows.push(this._rowMap['G' + ids[i]]);
					//}
					
					// For now, just reload if a group is removed, since otherwise
					// we'd have to remove collections too
					this.reload();
					this.rememberSelection(savedSelection);
					break;
			}
		}
		
		if(rows.length > 0)
		{
			rows.sort(function(a,b) { return a-b });
			
			for(var i=0, len=rows.length; i<len; i++)
			{
				var row = rows[i];
				this._hideItem(row-i);
				this._treebox.rowCountChanged(row-i,-1);
			}
			
			this._refreshHashMap();
		}
		
		if (!this.selection.count) {
			this.selection.select(selectedIndex)
		}
	}
	else if(action == 'move')
	{
		for (var i=0; i<ids.length; i++) {
			// Open the parent collection if closed
			var collection = Zotero.Collections.get(ids[i]);
			var parentID = collection.parent;
			if (parentID && this._collectionRowMap[parentID] &&
					!this.isContainerOpen(this._collectionRowMap[parentID])) {
				this.toggleOpenState(this._collectionRowMap[parentID]);
			}
		}
		
		this.reload();
		this.rememberSelection(savedSelection);
	}
	else if (action == 'modify' || action == 'refresh') {
		if (type != 'bucket') {
			this.reload();
		}
		this.rememberSelection(savedSelection);
	}
	else if(action == 'add')
	{
		// Multiple adds not currently supported
		ids = ids[0];
		
		switch (type)
		{
			case 'collection':
				var collection = Zotero.Collections.get(ids);
				
				// Open container if creating subcollection
				var parentID = collection.parent;
				if (parentID) {
					if (!this.isContainerOpen(this._collectionRowMap[parentID])){
						this.toggleOpenState(this._collectionRowMap[parentID]);
					}
				}
				
				this.reload();
				if (Zotero.suppressUIUpdates) {
					this.rememberSelection(savedSelection);
					break;
				}
				this.selection.select(this._collectionRowMap[collection.id]);
				break;
				
			case 'search':
				this.reload();
				if (Zotero.suppressUIUpdates) {
					this.rememberSelection(savedSelection);
					break;
				}
				this.selection.select(this._rowMap['S' + ids]);
				break;
			
			case 'group':
				this.reload();
				// Groups can only be created during sync
				this.rememberSelection(savedSelection);
				break;

			case 'bucket':
				this.reload();
				this.rememberSelection(savedSelection);
				break;
		}
	}
	
	this.selection.selectEventsSuppressed = false;
}


/*
 * Set the rows that should be highlighted -- actual highlighting is done
 * by getRowProperties based on the array set here
 */
Zotero.CollectionTreeView.prototype.setHighlightedRows = function (ids) {
	this._highlightedRows = {};
	this._treebox.invalidate();
	
	for each(var id in ids) {
		this.expandToCollection(id);
		this._highlightedRows[this._collectionRowMap[id]] = true;
		this._treebox.invalidateRow(this._collectionRowMap[id]);
	}
}


/*
 *  Unregisters view from Zotero.Notifier (called on window close)
 */
Zotero.CollectionTreeView.prototype.unregister = function()
{
	Zotero.Notifier.unregisterObserver(this._unregisterID);
}


////////////////////////////////////////////////////////////////////////////////
///
///  nsITreeView functions
///  http://www.xulplanet.com/references/xpcomref/ifaces/nsITreeView.html
///
////////////////////////////////////////////////////////////////////////////////

Zotero.CollectionTreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getItemAtRow(row);
	
	if (column.id == 'zotero-collections-name-column') {
		return obj.getName();
	}
	else
		return "";
}

Zotero.CollectionTreeView.prototype.getImageSrc = function(row, col)
{
	var itemGroup = this._getItemAtRow(row);
	var collectionType = itemGroup.type;
	
	if (collectionType == 'group') {
		collectionType = 'library';
	}
	
	// Show sync icons only in library rows
	if (collectionType != 'library' && col.index != 0) {
		return '';
	}
	
	switch (collectionType) {
		case 'library':
			break;
		
		case 'trash':
			if (this._trashNotEmpty[itemGroup.ref.libraryID ? itemGroup.ref.libraryID : 0]) {
				collectionType += '-full';
			}
			break;
		
		case 'header':
			if (itemGroup.ref.id == 'group-libraries-header') {
				collectionType = 'groups';
			}
			else if (itemGroup.ref.id == 'commons-header') {
				collectionType = 'commons';
			}
			break;
		
		
			collectionType = 'library';
			break;
		
		case 'collection':
		case 'search':
			return "chrome://zotero-platform/content/treesource-" + collectionType + ".png";
	}
	
	return "chrome://zotero/skin/treesource-" + collectionType + ".png";
}

Zotero.CollectionTreeView.prototype.isContainer = function(row)
{
	var itemGroup = this._getItemAtRow(row);
	return itemGroup.isLibrary(true) || itemGroup.isCollection() || itemGroup.isHeader() || itemGroup.isBucket();
}

Zotero.CollectionTreeView.prototype.isContainerOpen = function(row)
{
	return this._dataItems[row][1];
}

/*
 * Returns true if the collection has no child collections
 */
Zotero.CollectionTreeView.prototype.isContainerEmpty = function(row)
{
	var itemGroup = this._getItemAtRow(row);
	if (itemGroup.isLibrary()) {
		return false;
	}
	if (itemGroup.isHeader()) {
		return false;
	}
	if (itemGroup.isBucket()) {
		return true;
	}
	if (itemGroup.isGroup()) {
		var libraryID = itemGroup.ref.libraryID;
		libraryID = (libraryID ? libraryID : 0) + '';
		
		return !itemGroup.ref.hasCollections()
				&& !itemGroup.ref.hasSearches()
				&& this._duplicateLibraries.indexOf(libraryID) == -1
				&& this._unfiledLibraries.indexOf(libraryID) == -1
				&& this.hideSources.indexOf('trash') != -1;
	}
	if (itemGroup.isCollection()) {
		return !itemGroup.ref.hasChildCollections();
	}
	return true;
}

Zotero.CollectionTreeView.prototype.getLevel = function(row)
{
	return this._dataItems[row][2];
}

Zotero.CollectionTreeView.prototype.getParentIndex = function(row)
{
	var thisLevel = this.getLevel(row);
	if(thisLevel == 0) return -1;
	for(var i = row - 1; i >= 0; i--)
		if(this.getLevel(i) < thisLevel)
			return i;
	return -1;
}

Zotero.CollectionTreeView.prototype.hasNextSibling = function(row, afterIndex)
{
	var thisLevel = this.getLevel(row);
	for(var i = afterIndex + 1; i < this.rowCount; i++)
	{	
		var nextLevel = this.getLevel(i);
		if(nextLevel == thisLevel) return true;
		else if(nextLevel < thisLevel) return false;
	}
}

/*
 *  Opens/closes the specified row
 */
Zotero.CollectionTreeView.prototype.toggleOpenState = function(row)
{
	var count = 0;		//used to tell the tree how many rows were added/removed
	var thisLevel = this.getLevel(row);
	
	this._treebox.beginUpdateBatch();
	if (this.isContainerOpen(row)) {
		while((row + 1 < this._dataItems.length) && (this.getLevel(row + 1) > thisLevel))
		{
			this._hideItem(row+1);
			count--;	//count is negative when closing a container because we are removing rows
		}
	}
	else {
		var itemGroup = this._getItemAtRow(row);
		if (itemGroup.type == 'header') {
			count = itemGroup.ref.expand(row + 1);
		}
		else if (itemGroup.isLibrary(true) || itemGroup.isCollection()) {
			count = this._expandRow(row, true);
		}
	}
	this._dataItems[row][1] = !this._dataItems[row][1];  //toggle container open value
	
	this._treebox.rowCountChanged(row+1, count); //tell treebox to repaint these
	this._treebox.invalidateRow(row);
	this._treebox.endUpdateBatch();	
	this._refreshHashMap();
	this._rememberOpenStates();
}


Zotero.CollectionTreeView.prototype.isSelectable = function (row, col) {
	var itemGroup = this._getItemAtRow(row);
	switch (itemGroup.type) {
		case 'separator':
			return false;
	}
	return true;
}


/**
 * Tree method for whether to allow inline editing (not to be confused with this.editable)
 */
Zotero.CollectionTreeView.prototype.isEditable = function (row, col) {
	return this.itemGroup.isCollection() && this.editable;
}


Zotero.CollectionTreeView.prototype.setCellText = function (row, col, val) {
	val = val.trim();
	if (val === "") {
		return;
	}
	var itemGroup = this._getItemAtRow(row);
	itemGroup.ref.name = val;
	itemGroup.ref.save();
}



/**
 * Returns TRUE if the underlying view is editable
 */
Zotero.CollectionTreeView.prototype.__defineGetter__('editable', function () {
	return this._getItemAtRow(this.selection.currentIndex).editable;
});


Zotero.CollectionTreeView.prototype.expandLibrary = function(self) {
	var selectedLibraryID = self.getSelectedLibraryID();
	if (selectedLibraryID === false) {
		return;
	}
	
	self._treebox.beginUpdateBatch();
	
	var selection = self.saveSelection();
	
	var found = false;
	for (var i=0; i<self.rowCount; i++) {
		if (self._getItemAtRow(i).ref.libraryID != selectedLibraryID) {
			// Once we've moved beyond the original library, stop looking
			if (found) {
				break;
			}
			continue;
		}
		
		found = true;
		
		if (self.isContainer(i) && !self.isContainerOpen(i)) {
			self.toggleOpenState(i);
		}
	}
	
	self._treebox.endUpdateBatch();
	
	self.rememberSelection(selection);
}


Zotero.CollectionTreeView.prototype.collapseLibrary = function(self) {
	var selectedLibraryID = self.getSelectedLibraryID();
	if (selectedLibraryID === false) {
		return;
	}
	
	self._treebox.beginUpdateBatch();
	
	var found = false;
	for (var i=self.rowCount-1; i>=0; i--) {
		if (self._getItemAtRow(i).ref.libraryID !== selectedLibraryID) {
			// Once we've moved beyond the original library, stop looking
			if (found) {
				break;
			}
			continue;
		}
		
		found = true;
		
		if (self.isContainer(i) && self.isContainerOpen(i)) {
			self.toggleOpenState(i);
		}
	}
	
	self._treebox.endUpdateBatch();
	
	// Select the collapsed library
	self.selectLibrary(selectedLibraryID);
}


Zotero.CollectionTreeView.prototype.expandToCollection = function(collectionID) {
	var col = Zotero.Collections.get(collectionID);
	if (!col) {
		Zotero.debug("Cannot expand to nonexistent collection " + collectionID, 2);
		return false;
	}
	var row = this._collectionRowMap[collectionID];
	if (row) {
		return true;
	}
	var path = [];
	var parent;
	while (parent = col.getParent()) {
		path.unshift(parent);
		col = Zotero.Collections.get(parent);
	}
	for each(var id in path) {
		row = this._collectionRowMap[id];
		if (!this.isContainerOpen(row)) {
			this.toggleOpenState(row);
		}
	}
	return true;
}



////////////////////////////////////////////////////////////////////////////////
///
///  Additional functions for managing data in the tree
///
////////////////////////////////////////////////////////////////////////////////
/**
 * @param	{Integer|null}		libraryID		Library to select, or null for local library
 */
Zotero.CollectionTreeView.prototype.selectLibrary = function (libraryID) {
	if (Zotero.suppressUIUpdates) {
		Zotero.debug("UI updates suppressed -- not changing library selection");
		return false;
	}
	
	// Select local library
	if (!libraryID) {
		this._treebox.ensureRowIsVisible(0);
		this.selection.select(0);
		return true;
	}
	
	// Check if library is already selected
	if (this.selection.currentIndex != -1) {
		var itemGroup = this._getItemAtRow(this.selection.currentIndex);
		if (itemGroup.isLibrary(true) && itemGroup.ref.libraryID == libraryID) {
			this._treebox.ensureRowIsVisible(this.selection.currentIndex);
			return true;
		}
	}
	
	// Find library
	for (var i = 0; i < this.rowCount; i++) {
		var itemGroup = this._getItemAtRow(i);
		
		// If group header is closed, open it
		if (itemGroup.isHeader() && itemGroup.ref.id == 'group-libraries-header'
				&& !this.isContainerOpen(i)) {
			this.toggleOpenState(i);
			continue;
		}
		
		if (itemGroup.ref && itemGroup.ref.libraryID == libraryID) {
			this._treebox.ensureRowIsVisible(i);
			this.selection.select(i);
			return true;
		}
	}
	
	return false;
}


/**
 * Select the last-viewed source
 */
Zotero.CollectionTreeView.prototype.getLastViewedRow = function () {
	var lastViewedFolder = Zotero.Prefs.get('lastViewedFolder');
	var matches = lastViewedFolder.match(/^([A-Z])([G0-9]+)?$/);
	var select = 0;
	if (matches) {
		if (matches[1] == 'C') {
			if (this._collectionRowMap[matches[2]]) {
				select = this._collectionRowMap[matches[2]];
			}
			// Search recursively
			else {
				var path = [];
				var failsafe = 10; // Only go up ten levels
				var lastCol = matches[2];
				do {
					failsafe--;
					var col = Zotero.Collections.get(lastCol);
					if (!col) {
						var msg = "Last-viewed collection not found";
						Zotero.debug(msg);
						path = [];
						break;
					}
					var par = col.getParent();
					if (!par) {
						var msg = "Parent collection not found in "
							+ "Zotero.CollectionTreeView.setTree()";
						Zotero.debug(msg, 1);
						Components.utils.reportError(msg);
						path = [];
						break;
					}
					lastCol = par;
					path.push(lastCol);
				}
				while (!this._collectionRowMap[lastCol] && failsafe > 0)
				if (path.length) {
					for (var i=path.length-1; i>=0; i--) {
						var id = path[i];
						var row = this._collectionRowMap[id];
						if (!row) {
							var msg = "Collection not found in tree in "
								+ "Zotero.CollectionTreeView.setTree()";
							Zotero.debug(msg, 1);
							Components.utils.reportError(msg);
							break;
						}
						if (!this.isContainerOpen(row)) {
							this.toggleOpenState(row);
							if (this._collectionRowMap[matches[2]]) {
								select = this._collectionRowMap[matches[2]];
								break;
							}
						}
					}
				}
			}
		}
		else {
			var id = matches[1] + (matches[2] ? matches[2] : "");
			if (this._rowMap[id]) {
				select = this._rowMap[id];
			}
		}
	}
	
	return select;
}


/*
 *  Delete the selection
 */
Zotero.CollectionTreeView.prototype.deleteSelection = function(deleteItems)
{
	if(this.selection.count == 0)
		return;

	//collapse open collections
	for(var i=0; i<this.rowCount; i++)
		if(this.selection.isSelected(i) && this.isContainer(i) && this.isContainerOpen(i))
			this.toggleOpenState(i);
	this._refreshHashMap();
	
	//create an array of collections
	var rows = new Array();
	var start = new Object();
	var end = new Object();
	for (var i=0, len=this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++)
			if(!this._getItemAtRow(j).isLibrary())
				rows.push(j);
	}
	
	//iterate and erase...
	this._treebox.beginUpdateBatch();
	for (var i=0; i<rows.length; i++)
	{
		//erase collection from DB:
		var itemGroup = this._getItemAtRow(rows[i]-i);
		if (itemGroup.isCollection()) {
			itemGroup.ref.erase(deleteItems);
		}
		else if (itemGroup.isSearch()) {
			Zotero.Searches.erase(itemGroup.ref.id);
		}
	}
	this._treebox.endUpdateBatch();
	
	if (end.value < this.rowCount) {
		var row = this._getItemAtRow(end.value);
		if (row.isSeparator()) {
			return;
		}
		this.selection.select(end.value);
	}
	else {
		this.selection.select(this.rowCount-1);
	}
}


/**
 * Expand row based on last state, or manually from toggleOpenState()
 */
Zotero.CollectionTreeView.prototype._expandRow = function (row, forceOpen) {
	var itemGroup = this._getItemAtRow(row);
	var isGroup = itemGroup.isGroup();
	var isCollection = itemGroup.isCollection();
	var level = this.getLevel(row) + 1;
	var libraryID = itemGroup.ref.libraryID;
	var intLibraryID = libraryID ? libraryID : 0;
	
	if (isGroup) {
		var group = Zotero.Groups.getByLibraryID(libraryID);
		var collections = group.getCollections();
	}
	else {
		var collections = Zotero.getCollections(itemGroup.ref.id);
	}
	
	var savedSearches = Zotero.Searches.getAll(libraryID);
	var showDuplicates = this.hideSources.indexOf('duplicates') == -1
							&& this._duplicateLibraries.indexOf(intLibraryID + '') != -1;
	var showUnfiled = this._unfiledLibraries.indexOf(intLibraryID + '') != -1;
	var showTrash = this.hideSources.indexOf('trash') == -1;
	
	// If not a manual open and either the library is set to be hidden
	// or this is a collection that isn't explicitly opened,
	// set the initial state to closed
	if (!forceOpen &&
			(this._containerState[itemGroup.id] === false
				|| (isCollection && !this._containerState[itemGroup.id]))) {
		this._dataItems[row][1] = false;
		return 0;
	}
	
	var startOpen = !!(collections.length || savedSearches.length || showDuplicates || showUnfiled || showTrash);
	
	// If this isn't a manual open, set the initial state depending on whether
	// there are child nodes
	if (!forceOpen) {
		this._dataItems[row][1] = startOpen;
	}
	
	if (!startOpen) {
		return 0;
	}
	
	var newRows = 0;
	
	// Add collections
	for (var i = 0, len = collections.length; i < len; i++) {
		// In personal library root, skip group collections
		if (!isGroup && !isCollection && collections[i].libraryID) {
			continue;
		}
		
		var newRow = this._showRow(new Zotero.ItemGroup('collection', collections[i]), level, row + 1 + newRows);
		
		// Recursively expand child collections that should be open
		newRows += this._expandRow(newRow);
		
		newRows++;
	}
	
	if (isCollection) {
		return newRows;
	}
	
	// Add searches
	for (var i = 0, len = savedSearches.length; i < len; i++) {
		this._showRow(new Zotero.ItemGroup('search', savedSearches[i]), level, row + 1 + newRows);
		newRows++;
	}
	
	// Duplicate items
	if (showDuplicates) {
		var d = new Zotero.Duplicates(intLibraryID);
		this._showRow(new Zotero.ItemGroup('duplicates', d), level, row + 1 + newRows);
		newRows++;
	}
	
	// Unfiled items
	if (showUnfiled) {
		var s = new Zotero.Search;
		if (isGroup) {
			s.libraryID = libraryID;
		}
		s.name = Zotero.getString('pane.collections.unfiled');
		s.addCondition('libraryID', 'is', libraryID);
		s.addCondition('unfiled', 'true');
		this._showRow(new Zotero.ItemGroup('unfiled', s), level, row + 1 + newRows);
		newRows++;
	}
	
	if (showTrash) {
		var deletedItems = Zotero.Items.getDeleted(libraryID);
		if (deletedItems.length || Zotero.Prefs.get("showTrashWhenEmpty")) {
			var ref = {
				libraryID: libraryID
			};
			this._showRow(new Zotero.ItemGroup('trash', ref), level, row + 1 + newRows);
			newRows++;
		}
		this._trashNotEmpty[intLibraryID] = !!deletedItems.length;
	}
	
	return newRows;
}


/*
 *  Called by various view functions to show a row
 */
Zotero.CollectionTreeView.prototype._showRow = function(itemGroup, level, beforeRow)
{
	if (!level) {
		level = 0;
	}
	
	if (!beforeRow) {
		beforeRow = this._dataItems.length;
	}
	
	this._dataItems.splice(beforeRow, 0, [itemGroup, false, level]);
	this.rowCount++;
	
	return beforeRow;
}


/*
 *  Called by view to hide specified row
 */
Zotero.CollectionTreeView.prototype._hideItem = function(row)
{
	this._dataItems.splice(row,1); this.rowCount--;
}


/**
 * Returns Zotero.ItemGroup at row
 *
 * @deprecated  Use getItemGroupAtRow()
 */
Zotero.CollectionTreeView.prototype._getItemAtRow = function(row)
{
	return this._dataItems[row][0];
}


Zotero.CollectionTreeView.prototype.getItemGroupAtRow = function(row)
{
	return this._dataItems[row][0];
}


/*
 *  Saves the ids of the currently selected item for later
 */
Zotero.CollectionTreeView.prototype.saveSelection = function()
{
	for (var i=0, len=this.rowCount; i<len; i++) {
		if (this.selection.isSelected(i)) {
			var itemGroup = this._getItemAtRow(i);
			var id = itemGroup.id;
			if (id) {
				return id;
			}
			else {
				break;
			}
		}
	}
	return false;
}

/*
 *  Sets the selection based on saved selection ids (see above)
 */
Zotero.CollectionTreeView.prototype.rememberSelection = function(selection)
{
	if (selection && this._rowMap[selection] != 'undefined') {
		this.selection.select(this._rowMap[selection]);
	}
}


/**
 * Returns libraryID, null for personal library, or false if not a library
 */
Zotero.CollectionTreeView.prototype.getSelectedLibraryID = function() {
	var itemGroup = this._getItemAtRow(this.selection.currentIndex);
	return itemGroup && itemGroup.ref && itemGroup.ref.libraryID !== undefined
			&& (itemGroup.ref.libraryID ? itemGroup.ref.libraryID : null);
}


Zotero.CollectionTreeView.prototype.getSelectedCollection = function(asID) {
	if (this.selection
			&& this.selection.count > 0
			&& this.selection.currentIndex != -1) {
		var collection = this._getItemAtRow(this.selection.currentIndex);
		if (collection && collection.isCollection()) {
			return asID ? collection.ref.id : collection.ref;
		}
	}
	return false;
}


/**
 * Creates mapping of item group ids to tree rows
 */
Zotero.CollectionTreeView.prototype._refreshHashMap = function()
{	
	this._collectionRowMap = [];
	this._rowMap = [];
	for(var i = 0, len = this.rowCount; i < len; i++) {
		var itemGroup = this._getItemAtRow(i);
		
		// Collections get special treatment for now
		if (itemGroup.isCollection()) {
			this._collectionRowMap[itemGroup.ref.id] = i;
		}
		
		this._rowMap[itemGroup.id] = i;
	}
}


Zotero.CollectionTreeView.prototype._rememberOpenStates = function () {
	var state = this._containerState;
	
	// Every so often, remove obsolete rows
	if (Math.random() < 1/20) {
		Zotero.debug("Purging sourceList.persist");
		for (var id in state) {
			var m = id.match(/^C([0-9]+)$/);
			if (m) {
				if (!Zotero.Collections.get(m[1])) {
					delete state[id];
				}
				continue;
			}
			
			var m = id.match(/^G([0-9]+)$/);
			if (m) {
				if (!Zotero.Groups.get(m[1])) {
					delete state[id];
				}
				continue;
			}
		}
	}
	
	for (var i = 0, len = this.rowCount; i < len; i++) {
		if (!this.isContainer(i)) {
			continue;
		}
		
		var itemGroup = this._getItemAtRow(i);
		if (!itemGroup.id) {
			continue;
		}
		
		var open = this.isContainerOpen(i);
		
		// Collections default to closed
		if (!open && itemGroup.isCollection()) {
			delete state[itemGroup.id];
			continue;
		}
		
		state[itemGroup.id] = open;
	}
	
	this._containerState = state;
	Zotero.Prefs.set("sourceList.persist", JSON.stringify(state));
}


////////////////////////////////////////////////////////////////////////////////
///
///  Command Controller:
///		for Select All, etc.
///
////////////////////////////////////////////////////////////////////////////////

Zotero.CollectionTreeCommandController = function(tree)
{
	this.tree = tree;
}

Zotero.CollectionTreeCommandController.prototype.supportsCommand = function(cmd)
{
}

Zotero.CollectionTreeCommandController.prototype.isCommandEnabled = function(cmd)
{
}

Zotero.CollectionTreeCommandController.prototype.doCommand = function(cmd)
{
}

Zotero.CollectionTreeCommandController.prototype.onEvent = function(evt)
{
}

////////////////////////////////////////////////////////////////////////////////
///
///  Drag-and-drop functions:
///		canDrop() and drop() are for nsITreeView
///		onDragStart() and onDrop() are for HTML 5 Drag and Drop
///
////////////////////////////////////////////////////////////////////////////////


/*
 * Start a drag using HTML 5 Drag and Drop
 */
Zotero.CollectionTreeView.prototype.onDragStart = function(event) {
	var itemGroup = this.itemGroup;
	if (!itemGroup.isCollection()) {
		return;
	}
	event.dataTransfer.setData("zotero/collection", itemGroup.ref.id);
}


/**
 * Called by treechildren.onDragOver() before setting the dropEffect,
 * which is checked in libraryTreeView.canDrop()
 */
Zotero.CollectionTreeView.prototype.canDropCheck = function (row, orient, dataTransfer) {
	//Zotero.debug("Row is " + row + "; orient is " + orient);
	
	var dragData = Zotero.DragDrop.getDataFromDataTransfer(dataTransfer);
	if (!dragData) {
		Zotero.debug("No drag data");
		return false;
	}
	var dataType = dragData.dataType;
	var data = dragData.data;
	
	// For dropping collections onto root level
	if (orient == 1 && row == 0 && dataType == 'zotero/collection') {
		return true;
	}
	// Directly on a row
	else if (orient == 0) {
		var itemGroup = this._getItemAtRow(row); //the collection we are dragging over
		
		if (dataType == 'zotero/item' && itemGroup.isBucket()) {
			return true;
		}
		
		if (!itemGroup.editable) {
			return false;
		}
		
		if (dataType == 'zotero/item') {
			var ids = data;
			var items = Zotero.Items.get(ids);
			var skip = true;
			for each(var item in items) {
				// Can only drag top-level items
				if (!item.isTopLevelItem()) {
					return false;
				}
				
				if (itemGroup.isWithinGroup() && item.isAttachment()) {
					// Linked files can't be added to groups
					if (item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
						return false;
					}
					if (!itemGroup.filesEditable) {
						return false;
					}
					skip = false;
					continue;
				}
				
				// Cross-library drag
				if (itemGroup.ref.libraryID != item.libraryID) {
					// Only allow cross-library drag to root library and collections
					if (!(itemGroup.isLibrary(true) || itemGroup.isCollection())) {
						return false;
					}
					
					var linkedItem = item.getLinkedItem(itemGroup.ref.libraryID);
					if (linkedItem && !linkedItem.deleted) {
						// For drag to root, skip if linked item exists
						if (itemGroup.isLibrary(true)) {
							continue;
						}
						// For drag to collection
						else if (itemGroup.isCollection()) {
							// skip if linked item is already in it
							if (itemGroup.ref.hasItem(linkedItem.id)) {
								continue;
							}
							// or if linked item is a child item
							else if (linkedItem.getSource()) {
								continue;
							}
						}
					}
					skip = false;
					continue;
				}
				
				// Intra-library drag
				
				// Don't allow drag onto root of same library
				if (itemGroup.isLibrary(true)) {
					return false;
				}
				
				// Make sure there's at least one item that's not already
				// in this collection
				if (itemGroup.isCollection() && !itemGroup.ref.hasItem(item.id)) {
					skip = false;
					continue;
				}
			}
			if (skip) {
				return false;
			}
			return true;
		}
		else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
			if (itemGroup.isSearch()) {
				return false;
			}
			if (dataType == 'application/x-moz-file') {
				// Don't allow folder drag
				if (data[0].isDirectory()) {
					return false;
				}
				// Don't allow drop if no permissions
				if (!itemGroup.filesEditable) {
					return false;
				}
			}
			
			return true;
		}
		else if (dataType == 'zotero/collection') {
			var col = Zotero.Collections.get(data[0]);
			
			if (itemGroup.ref.libraryID == col.libraryID) {
				// Collections cannot be dropped on themselves
				if (data[0] == itemGroup.ref.id) {
					return false;
				}
				
				// Nor in their children
				if (Zotero.Collections.get(data[0]).hasDescendent('collection', itemGroup.ref.id)) {
					return false;
				}
			}
			// Dragging a collection to a different library
			else {
				// Allow cross-library drag only to root library and collections
				if (!itemGroup.isLibrary(true) && !itemGroup.isCollection()) {
					return false;
				}
				
				// Disallow if linked collection already exists
				if (col.getLinkedCollection(itemGroup.ref.libraryID)) {
					return false;
				}
				
				var descendents = col.getDescendents(false, 'collection');
				for each(var descendent in descendents) {
					descendent = Zotero.Collections.get(descendent.id);
					// Disallow if linked collection already exists for any subcollections
					//
					// If this is allowed in the future for the root collection,
					// need to allow drag only to root
					if (descendent.getLinkedCollection(itemGroup.ref.libraryID)) {
						return false;
					}
				}
			}
			
			return true;
		}
	}
	return false;
}

/*
 *  Called when something's been dropped on or next to a row
 */
Zotero.CollectionTreeView.prototype.drop = function(row, orient, dataTransfer)
{
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
	var itemGroup = this.getItemGroupAtRow(row);
	
	function copyItem (item, targetLibraryID) {
		// Check if there's already a copy of this item in the library
		var linkedItem = item.getLinkedItem(targetLibraryID);
		if (linkedItem) {
			// If linked item is in the trash, undelete it
			if (linkedItem.deleted) {
				// Remove from any existing collections, or else when it gets
				// undeleted it would reappear in those collections
				var collectionIDs = linkedItem.getCollections();
				for each(var collectionID in collectionIDs) {
					var col = Zotero.Collections.get(collectionID);
					col.removeItem(linkedItem.id);
				}
				linkedItem.deleted = false;
				linkedItem.save();
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
			
			if (!itemGroup.filesEditable) {
				Zotero.debug("Skipping standalone file attachment on drag");
				return false;
			}
			
			return Zotero.Attachments.copyAttachmentToLibrary(item, targetLibraryID);
		}
		
		// Create new unsaved clone item in target library
		var newItem = new Zotero.Item(item.itemTypeID);
		newItem.libraryID = targetLibraryID;
		// DEBUG: save here because clone() doesn't currently work on unsaved tagged items
		var id = newItem.save();
		newItem = Zotero.Items.get(id);
		item.clone(false, newItem, false, !Zotero.Prefs.get('groups.copyTags'));
		newItem.save();
		//var id = newItem.save();
		//var newItem = Zotero.Items.get(id);
		
		// Record link
		newItem.addLinkedItem(item);
		var newID = id;
		
		if (item.isNote()) {
			return newID;
		}
		
		// For regular items, add child items if prefs and permissions allow
		
		// Child notes
		if (Zotero.Prefs.get('groups.copyChildNotes')) {
			var noteIDs = item.getNotes();
			var notes = Zotero.Items.get(noteIDs);
			for each(var note in notes) {
				var newNote = new Zotero.Item('note');
				newNote.libraryID = targetLibraryID;
				// DEBUG: save here because clone() doesn't currently work on unsaved tagged items
				var id = newNote.save();
				newNote = Zotero.Items.get(id);
				note.clone(false, newNote);
				newNote.setSource(newItem.id);
				newNote.save();
				
				newNote.addLinkedItem(note);
			}
		}
		
		// Child attachments
		var copyChildLinks = Zotero.Prefs.get('groups.copyChildLinks');
		var copyChildFileAttachments = Zotero.Prefs.get('groups.copyChildFileAttachments');
		if (copyChildLinks || copyChildFileAttachments) {
			var attachmentIDs = item.getAttachments();
			var attachments = Zotero.Items.get(attachmentIDs);
			for each(var attachment in attachments) {
				var linkMode = attachment.attachmentLinkMode;
				
				// Skip linked files
				if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
					Zotero.debug("Skipping child linked file attachment on drag");
					continue;
				}
				
				// Skip imported files if we don't have pref and permissions
				if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
					if (!copyChildLinks) {
						Zotero.debug("Skipping child link attachment on drag");
						continue;
					}
				}
				else {
					if (!copyChildFileAttachments || !itemGroup.filesEditable) {
						Zotero.debug("Skipping child file attachment on drag");
						continue;
					}
				}
				
				Zotero.Attachments.copyAttachmentToLibrary(attachment, targetLibraryID, newItem.id);
			}
		}
		
		return newID;
	}
	
	
	var targetLibraryID = itemGroup.isWithinGroup() ? itemGroup.ref.libraryID : null;
	var targetCollectionID = itemGroup.isCollection() ? itemGroup.ref.id : false;
	
	if (dataType == 'zotero/collection') {
		var droppedCollection = Zotero.Collections.get(data[0]);
		
		// Collection drag between libraries
		if (targetLibraryID != droppedCollection.libraryID) {
			Zotero.DB.beginTransaction();
			
			function copyCollections(descendents, parent, addItems) {
				for each(var desc in descendents) {
					// Collections
					if (desc.type == 'collection') {
						var c = Zotero.Collections.get(desc.id);
						
						var newCollection = new Zotero.Collection;
						newCollection.libraryID = targetLibraryID;
						c.clone(false, newCollection);
						if (parent) {
							newCollection.parent = parent;
						}
						var collectionID = newCollection.save();
						
						// Record link
						c.addLinkedCollection(newCollection);
						
						// Recursively copy subcollections
						if (desc.children.length) {
							copyCollections(desc.children, collectionID, addItems);
						}
					}
					// Items
					else {
						var item = Zotero.Items.get(desc.id);
						var id = copyItem(item, targetLibraryID);
						// Standalone attachments might not get copied
						if (!id) {
							continue;
						}
						// Mark copied item for adding to collection
						if (parent) {
							if (!addItems[parent]) {
								addItems[parent] = [];
							}
							addItems[parent].push(id);
						}
					}
				}
			}
			
			var collections = [{
				id: droppedCollection.id,
				children: droppedCollection.getDescendents(true),
				type: 'collection'
			}];
			
			var addItems = {};
			copyCollections(collections, targetCollectionID, addItems);
			for (var collectionID in addItems) {
				var collection = Zotero.Collections.get(collectionID);
				collection.addItems(addItems[collectionID]);
			}
			
			// TODO: add subcollections and subitems, if they don't already exist,
			// and display a warning if any of the subcollections already exist
			
			Zotero.DB.commitTransaction();
		}
		// Collection drag within a library
		else {
			droppedCollection.parent = targetCollectionID;
			droppedCollection.save();
		}
	}
	else if (dataType == 'zotero/item') {
		var ids = data;
		if (ids.length < 1) {
			return;
		}
		
		if(itemGroup.isBucket()) {
			itemGroup.ref.uploadItems(ids);
			return;
		}
		
		Zotero.DB.beginTransaction();
		
		var items = Zotero.Items.get(ids);
		if (!items) {
			Zotero.DB.commitTransaction();
			return;
		}
		
		var newItems = [];
		var newIDs = [];
		var toMove = [];
		// TODO: support items coming from different sources?
		if (items[0].libraryID == targetLibraryID) {
			var sameLibrary = true;
		}
		else {
			var sameLibrary = false;
		}
		
		for each(var item in items) {
			if (!(item.isRegularItem() || !item.getSource())) {
				continue;
			}
			
			if (sameLibrary) {
				newIDs.push(item.id);
				toMove.push(item.id);
			}
			else {
				newItems.push(item);
			}
		}
		
		if (!sameLibrary) {
			var toReconcile = [];
			
			var newIDs = [];
			for each(var item in newItems) {
				var id = copyItem(item, targetLibraryID)
				// Standalone attachments might not get copied
				if (!id) {
					continue;
				}
				newIDs.push(id);
			}
			
			if (toReconcile.length) {
				var sourceName = items[0].libraryID ? Zotero.Libraries.getName(items[0].libraryID)
									: Zotero.getString('pane.collections.library');
				var targetName = targetLibraryID ? Zotero.Libraries.getName(libraryID)
									: Zotero.getString('pane.collections.library');
				
				var io = {
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
				
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						   .getService(Components.interfaces.nsIWindowMediator);
				var lastWin = wm.getMostRecentWindow("navigator:browser");
				lastWin.openDialog('chrome://zotero/content/merge.xul', '', 'chrome,modal,centerscreen', io);
				
				for each(var obj in io.dataOut) {
					obj.ref.save();
				}
			}
		}
		
		// Add items to target collection
		if (targetCollectionID) {
			var collection = Zotero.Collections.get(targetCollectionID);
			collection.addItems(newIDs);
		}
		
		// If moving, remove items from source collection
		if (dropEffect == 'move' && toMove.length) {
			if (!sameLibrary) {
				throw new Error("Cannot move items between libraries");
			}
			let itemGroup = Zotero.DragDrop.getDragSource();
			if (!itemGroup || !itemGroup.isCollection()) {
				throw new Error("Drag source must be a collection for move action");
			}
			itemGroup.ref.removeItems(toMove);
		}
		
		Zotero.DB.commitTransaction();
	}
	else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
		if (itemGroup.isWithinGroup()) {
			var targetLibraryID = itemGroup.ref.libraryID;
		}
		else {
			var targetLibraryID = null;
		}
		
		if (itemGroup.isCollection()) {
			var parentCollectionID = itemGroup.ref.id;
		}
		else {
			var parentCollectionID = false;
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
						var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								   .getService(Components.interfaces.nsIWindowMediator);
						var win = wm.getMostRecentWindow("navigator:browser");
						win.ZoteroPane.addItemFromURL(url, 'temporaryPDFHack', null, row); // TODO: don't do this
						continue;
					}
					
					// Otherwise file, so fall through
				}
				
				try {
					Zotero.DB.beginTransaction();
					if (dropEffect == 'link') {
						var itemID = Zotero.Attachments.linkFromFile(file);
					}
					else {
						var itemID = Zotero.Attachments.importFromFile(file, false, targetLibraryID);
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

Zotero.CollectionTreeView.prototype.isSorted = function() 							{ return false; }

/* Set 'highlighted' property on rows set by setHighlightedRows */
Zotero.CollectionTreeView.prototype.getRowProperties = function(row, prop) {
	var props = [];
	
	if (this._highlightedRows[row]) {
		// <=Fx21
		if (prop) {
			var aServ = Components.classes["@mozilla.org/atom-service;1"].
				getService(Components.interfaces.nsIAtomService);
			prop.AppendElement(aServ.getAtom("highlighted"));
		}
		// Fx22+
		else {
			props.push("highlighted");
		}
	}
	
	return props.join(" ");
}

Zotero.CollectionTreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Zotero.CollectionTreeView.prototype.getCellProperties = function(row, col, prop) 	{ }
Zotero.CollectionTreeView.prototype.isSeparator = function(index) {
	var source = this._getItemAtRow(index);
	return source.type == 'separator';
}
Zotero.CollectionTreeView.prototype.performAction = function(action) 				{ }
Zotero.CollectionTreeView.prototype.performActionOnCell = function(action, row, col)	{ }
Zotero.CollectionTreeView.prototype.getProgressMode = function(row, col) 			{ }
Zotero.CollectionTreeView.prototype.cycleHeader = function(column)					{ }

////////////////////////////////////////////////////////////////////////////////
///
///  Zotero ItemGroup -- a sort of "super class" for collection, library,
///  	and saved search
///
////////////////////////////////////////////////////////////////////////////////

Zotero.ItemGroupCache = {
	"lastItemGroup":null,
	"lastTempTable":null,
	"lastSearch":null,
	"lastResults":null,
	
	"clear":function() {
		this.lastItemGroup = null;
		this.lastSearch = null;
		if(this.lastTempTable) {
			Zotero.DB.query("DROP TABLE "+this.lastTempTable);
		}
		this.lastTempTable = null;
		this.lastResults = null;
	}
};

Zotero.ItemGroup = function(type, ref)
{
	this.type = type;
	this.ref = ref;
}


Zotero.ItemGroup.prototype.__defineGetter__('id', function () {
	switch (this.type) {
		case 'library':
			return 'L';
		
		case 'collection':
			return 'C' + this.ref.id;
		
		case 'search':
			return 'S' + this.ref.id;
		
		case 'duplicates':
			return 'D' + (this.ref.libraryID ? this.ref.libraryID : 0);
		
		case 'unfiled':
			return 'U' + (this.ref.libraryID ? this.ref.libraryID : 0);
		
		case 'trash':
			return 'T' + (this.ref.libraryID ? this.ref.libraryID : 0);
		
		case 'header':
			if (this.ref.id == 'group-libraries-header') {
				return 'HG';
			}
			break;
		
		case 'group':
			return 'G' + this.ref.id;
	}
	
	return '';
});

Zotero.ItemGroup.prototype.isLibrary = function (includeGlobal)
{
	if (includeGlobal) {
		return this.type == 'library' || this.type == 'group';
	}
	return this.type == 'library';
}

Zotero.ItemGroup.prototype.isCollection = function()
{
	return this.type == 'collection';
}

Zotero.ItemGroup.prototype.isSearch = function()
{
	return this.type == 'search';
}

Zotero.ItemGroup.prototype.isDuplicates = function () {
	return this.type == 'duplicates';
}

Zotero.ItemGroup.prototype.isUnfiled = function () {
	return this.type == 'unfiled';
}

Zotero.ItemGroup.prototype.isTrash = function()
{
	return this.type == 'trash';
}

Zotero.ItemGroup.prototype.isHeader = function () {
	return this.type == 'header';
}

Zotero.ItemGroup.prototype.isGroup = function() {
	return this.type == 'group';
}

Zotero.ItemGroup.prototype.isSeparator = function () {
	return this.type == 'separator';
}

Zotero.ItemGroup.prototype.isBucket = function()
{
	return this.type == 'bucket';
}

Zotero.ItemGroup.prototype.isShare = function()
{
	return this.type == 'share';
}



// Special
Zotero.ItemGroup.prototype.isWithinGroup = function () {
	return this.ref && !!this.ref.libraryID;
}

Zotero.ItemGroup.prototype.isWithinEditableGroup = function () {
	if (!this.isWithinGroup()) {
		return false;
	}
	var groupID = Zotero.Groups.getGroupIDFromLibraryID(this.ref.libraryID);
	return Zotero.Groups.get(groupID).editable;
}

Zotero.ItemGroup.prototype.__defineGetter__('editable', function () {
	if (this.isTrash() || this.isShare() || this.isBucket()) {
		return false;
	}
	if (!this.isWithinGroup()) {
		return true;
	}
	var libraryID = this.ref.libraryID;
	if (this.isGroup()) {
		return this.ref.editable;
	}
	if (this.isCollection() || this.isSearch() || this.isDuplicates() || this.isUnfiled()) {
		var type = Zotero.Libraries.getType(libraryID);
		if (type == 'group') {
			var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
			var group = Zotero.Groups.get(groupID);
			return group.editable;
		}
		throw ("Unknown library type '" + type + "' in Zotero.ItemGroup.editable");
	}
	return false;
});

Zotero.ItemGroup.prototype.__defineGetter__('filesEditable', function () {
	if (this.isTrash() || this.isShare()) {
		return false;
	}
	if (!this.isWithinGroup()) {
		return true;
	}
	var libraryID = this.ref.libraryID;
	if (this.isGroup()) {
		return this.ref.filesEditable;
	}
	if (this.isCollection() || this.isSearch() || this.isDuplicates() || this.isUnfiled()) {
		var type = Zotero.Libraries.getType(libraryID);
		if (type == 'group') {
			var groupID = Zotero.Groups.getGroupIDFromLibraryID(libraryID);
			var group = Zotero.Groups.get(groupID);
			return group.filesEditable;
		}
		throw ("Unknown library type '" + type + "' in Zotero.ItemGroup.filesEditable");
	}
	return false;
});

Zotero.ItemGroup.prototype.getName = function()
{
	switch (this.type) {
		case 'library':
			return Zotero.getString('pane.collections.library');
		
		case 'trash':
			return Zotero.getString('pane.collections.trash');
		
		case 'header':
			return this.ref.label;
		
		case 'separator':
			return "";
		
		default:
			return this.ref.name;
	}
}

Zotero.ItemGroup.prototype.getItems = function()
{
	switch (this.type) {
		// Fake results if this is a shared library
		case 'share':
			return this.ref.getAll();
		
		case 'bucket':
			return this.ref.getItems();
		
		case 'header':
			return [];
	}
	
	try {
		var ids = this.getSearchResults();
	}
	catch (e) {
		Zotero.DB.rollbackAllTransactions();
		Zotero.debug(e, 2);
		throw (e);
	}
	
	return Zotero.Items.get(ids);
}

Zotero.ItemGroup.prototype.getSearchResults = function(asTempTable) {
	if(Zotero.ItemGroupCache.lastItemGroup !== this) {
		Zotero.ItemGroupCache.clear();
	}
	
	if(!Zotero.ItemGroupCache.lastResults) {
		var s = this.getSearchObject();
	
		// FIXME: Hack to exclude group libraries for now
		if (this.isSearch()) {
			var currentLibraryID = this.ref.libraryID;
			if (currentLibraryID) {
				s.addCondition('libraryID', 'is', currentLibraryID);
			}
			else {
				var groups = Zotero.Groups.getAll();
				for each(var group in groups) {
					s.addCondition('libraryID', 'isNot', group.libraryID);
				}
			}
		}
		
		Zotero.ItemGroupCache.lastResults = s.search();
		Zotero.ItemGroupCache.lastItemGroup = this;
	}
	
	if(asTempTable) {
		if(!Zotero.ItemGroupCache.lastTempTable) {
			Zotero.ItemGroupCache.lastTempTable = Zotero.Search.idsToTempTable(Zotero.ItemGroupCache.lastResults);
		}
		return Zotero.ItemGroupCache.lastTempTable;
	}
	return Zotero.ItemGroupCache.lastResults;
}

/*
 * Returns the search object for the currently display
 *
 * This accounts for the collection, saved search, quicksearch, tags, etc.
 */
Zotero.ItemGroup.prototype.getSearchObject = function() {
	if(Zotero.ItemGroupCache.lastItemGroup !== this) {
		Zotero.ItemGroupCache.clear();
	}
	
	if(Zotero.ItemGroupCache.lastSearch) {
		return Zotero.ItemGroupCache.lastSearch;
	}	
	
	var includeScopeChildren = false;
	
	// Create/load the inner search
	if (this.ref instanceof Zotero.Search) {
		var s = this.ref;
	}
	else if (this.isDuplicates()) {
		var s = this.ref.getSearchObject();
	}
	else {
		var s = new Zotero.Search();
		if (this.isLibrary()) {
			s.addCondition('libraryID', 'is', null);
			s.addCondition('noChildren', 'true');
			includeScopeChildren = true;
		}
		else if (this.isGroup()) {
			s.addCondition('libraryID', 'is', this.ref.libraryID);
			s.addCondition('noChildren', 'true');
			includeScopeChildren = true;
		}
		else if (this.isCollection()) {
			s.addCondition('noChildren', 'true');
			s.addCondition('collectionID', 'is', this.ref.id);
			if (Zotero.Prefs.get('recursiveCollections')) {
				s.addCondition('recursive', 'true');
			}
			includeScopeChildren = true;
		}
		else if (this.isTrash()) {
			s.addCondition('libraryID', 'is', this.ref.libraryID);
			s.addCondition('deleted', 'true');
		}
		else {
			throw ('Invalid search mode in Zotero.ItemGroup.getSearchObject()');
		}
	}
	
	// Create the outer (filter) search
	var s2 = new Zotero.Search();
	if (this.isTrash()) {
		s2.addCondition('deleted', 'true');
	}
	s2.setScope(s, includeScopeChildren);
	
	if (this.searchText) {
		var cond = 'quicksearch-' + Zotero.Prefs.get('search.quicksearch-mode');
		s2.addCondition(cond, 'contains', this.searchText);
	}
	
	if (this.tags){
		for (var tag in this.tags){
			if (this.tags[tag]){
				s2.addCondition('tag', 'is', tag);
			}
		}
	}
	
	Zotero.ItemGroupCache.lastItemGroup = this;
	Zotero.ItemGroupCache.lastSearch = s2;
	return s2;
}


/*
 * Returns all the tags used by items in the current view
 */
Zotero.ItemGroup.prototype.getChildTags = function() {
	switch (this.type) {
		// TODO: implement?
		case 'share':
			return false;
		
		case 'bucket':
			return false;
		
		case 'header':
			return false;
	}
	
	return Zotero.Tags.getAllWithinSearch(this.getSearchObject(),
		undefined, this.getSearchResults(true));
}


Zotero.ItemGroup.prototype.setSearch = function(searchText)
{
	Zotero.ItemGroupCache.clear();
	this.searchText = searchText;
}

Zotero.ItemGroup.prototype.setTags = function(tags)
{
	Zotero.ItemGroupCache.clear();
	this.tags = tags;
}

/*
 * Returns TRUE if saved search, quicksearch or tag filter
 */
Zotero.ItemGroup.prototype.isSearchMode = function() {
	switch (this.type) {
		case 'search':
		case 'trash':
			return true;
	}
	
	// Quicksearch
	if (this.searchText != '') {
		return true;
	}
	
	// Tag filter
	if (this.tags) {
		for (var i in this.tags) {
			return true;
		}
	}
}
