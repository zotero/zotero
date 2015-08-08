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
	Zotero.LibraryTreeView.apply(this);
	
	this.itemToSelect = null;
	this.hideSources = [];
	
	this._highlightedRows = {};
	this._unregisterID = Zotero.Notifier.registerObserver(
		this,
		[
			'collection',
			'search',
			'publications',
			'share',
			'group',
			'trash',
			'bucket'
		],
		'collectionTreeView',
		25
	);
	this._containerState = {};
	this._duplicateLibraries = [];
	this._unfiledLibraries = [];
	this._trashNotEmpty = {};
}

Zotero.CollectionTreeView.prototype = Object.create(Zotero.LibraryTreeView.prototype);
Zotero.CollectionTreeView.prototype.type = 'collection';

Object.defineProperty(Zotero.CollectionTreeView.prototype, "selectedTreeRow", {
	get: function () {
		return this.getRow(this.selection.currentIndex);
	}
});


/*
 *  Called by the tree itself
 */
Zotero.CollectionTreeView.prototype.setTree = Zotero.Promise.coroutine(function* (treebox)
{
	try {
		if (this._treebox || !treebox) {
			return;
		}
		this._treebox = treebox;
		
		// Add a keypress listener for expand/collapse
		var tree = this._treebox.treeBody.parentNode;
		tree.addEventListener('keypress', function(event) {
			if (tree.editingRow != -1) return; // In-line editing active
			
			var libraryID = this.getSelectedLibraryID();
			if (!libraryID) return;
			
			var key = String.fromCharCode(event.which);
			if (key == '+' && !(event.ctrlKey || event.altKey || event.metaKey)) {
				this.expandLibrary(libraryID);
			}
			else if (key == '-' && !(event.shiftKey || event.ctrlKey ||
					event.altKey || event.metaKey)) {
				this.collapseLibrary(libraryID);
			}
		}.bind(this), false);
		
		yield this.refresh();
		if (!this._treebox.columns) {
			return;
		}
		this.selection.currentColumn = this._treebox.columns.getFirstColumn();
		
		var lastViewedID = Zotero.Prefs.get('lastViewedFolder');
		if (lastViewedID) {
			var selected = yield this.selectByID(lastViewedID);
		}
		if (!selected) {
			this.selection.select(0);
		}
		this.selection.selectEventsSuppressed = false;
		
		yield this._runListeners('load');
		this._initialized = true;
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
 *  Rebuild the tree from the data access methods and clear the selection
 *
 *  Calling code must invalidate the tree, restore the selection, and unsuppress selection events
 */
Zotero.CollectionTreeView.prototype.refresh = Zotero.Promise.coroutine(function* ()
{
	Zotero.debug("Refreshing collections pane");
	
	// Record open states before refreshing
	if (this._rows) {
		for (var i=0, len=this._rows.length; i<len; i++) {
			var treeRow = this._rows[i];
			if (treeRow.ref && treeRow.ref.id == 'commons-header') {
				var commonsExpand = this.isContainerOpen(i);
			}
		}
	}
	
	try {
		this._containerState = JSON.parse(Zotero.Prefs.get("sourceList.persist"));
	}
	catch (e) {
		this._containerState = {};
	}
	
	if (this.hideSources.indexOf('duplicates') == -1) {
		try {
			this._duplicateLibraries = Zotero.Prefs.get('duplicateLibraries').split(',').map(function (val) parseInt(val));
		}
		catch (e) {
			// Add to personal library by default
			Zotero.Prefs.set('duplicateLibraries', '0');
			this._duplicateLibraries = [0];
		}
	}
	
	try {
		this._unfiledLibraries = Zotero.Prefs.get('unfiledLibraries').split(',').map(function (val) parseInt(val));
	}
	catch (e) {
		// Add to personal library by default
		Zotero.Prefs.set('unfiledLibraries', '0');
		this._unfiledLibraries = [0];
	}
	
	var oldCount = this.rowCount || 0;
	var newRows = [];
	var added = 0;
	
	//
	// Add "My Library"
	//
	this._addRowToArray(
		newRows,
		new Zotero.CollectionTreeRow('library', { libraryID: Zotero.Libraries.userLibraryID }),
		added++
	);
	added += yield this._expandRow(newRows, 0);
	
	this._addRowToArray(newRows, new Zotero.CollectionTreeRow('separator', false), added++);
	
	// Add "My Publications"
	this._addRowToArray(
		newRows,
		new Zotero.CollectionTreeRow('publications', {
			libraryID: Zotero.Libraries.publicationsLibraryID
		}),
		added++
	);
	
	// Add groups
	var groups = Zotero.Groups.getAll();
	if (groups.length) {
		this._addRowToArray(
			newRows,
			new Zotero.CollectionTreeRow('separator', false),
			added++
		);
		this._addRowToArray(
			newRows,
			new Zotero.CollectionTreeRow('header', {
				id: "group-libraries-header",
				label: Zotero.getString('pane.collections.groupLibraries'),
				libraryID: -1
			}, 0),
			added++
		);
		for (let i = 0, len = groups.length; i < len; i++) {
			this._addRowToArray(
				newRows,
				new Zotero.CollectionTreeRow('group', groups[i]),
				added++
			);
		}
	}
	
	this.selection.selectEventsSuppressed = true;
	this.selection.clearSelection();
	this._rows = newRows;
	this.rowCount = this._rows.length;
	this._refreshRowMap();
	
	var diff = this.rowCount - oldCount;
	if (diff != 0) {
		this._treebox.rowCountChanged(0, diff);
	}
});


/*
 *  Redisplay everything
 */
Zotero.CollectionTreeView.prototype.reload = function()
{
	return this.refresh()
	.then(function () {
		this._treebox.invalidate();
	}.bind(this));
}


/**
 * Select a row and wait for its items view to be created
 *
 * Note that this doesn't wait for the items view to be loaded. For that, add a 'load' event
 * listener to the items view.
 *
 * @param {Integer} row
 * @return {Promise}
 */
Zotero.CollectionTreeView.prototype.selectWait = Zotero.Promise.method(function (row) {
	if (this.selection.selectEventsSuppressed) {
		this.selection.select(row);
		return;
	}
	if (this.selection.currentIndex == row) {
		return;
	};
	var deferred = Zotero.Promise.defer();
	this.addEventListener('select', () => deferred.resolve());
	this.selection.select(row);
	return deferred.promise;
});



/*
 *  Called by Zotero.Notifier on any changes to collections in the data layer
 */
Zotero.CollectionTreeView.prototype.notify = Zotero.Promise.coroutine(function* (action, type, ids, extraData) {
	if ((!ids || ids.length == 0) && action != 'refresh' && action != 'redraw') {
		return;
	}
	
	if (!this._rowMap) {
		Zotero.debug("Row map didn't exist in collectionTreeView.notify()");
		return;
	}
	
	//
	// Actions that don't change the selection
	//
	if (action == 'redraw') {
		this._treebox.invalidate();
		return;
	}
	if (action == 'refresh') {
		// If trash is refreshed, we probably need to update the icon from full to empty
		if (type == 'trash') {
			// libraryID is passed as parameter to 'refresh'
			let deleted = yield Zotero.Items.getDeleted(ids[0], true);
			this._trashNotEmpty[ids[0]] = !!deleted.length;
			let row = this.getRowIndexByID("T" + ids[0]);
			this._treebox.invalidateRow(row);
		}
		return;
	}
	
	//
	// Actions that can change the selection
	//
	var currentTreeRow = this.getRow(this.selection.currentIndex);
	this.selection.selectEventsSuppressed = true;
	
	if (action == 'delete') {
		var selectedIndex = this.selection.count ? this.selection.currentIndex : 0;
		
		// Since a delete involves shifting of rows, we have to do it in reverse order
		let rows = [];
		for (let i = 0; i < ids.length; i++) {
			let id = ids[i];
			switch (type) {
				case 'collection':
					if (this._rowMap['C' + id] !== undefined) {
						rows.push(this._rowMap['C' + id]);
					}
					break;
				
				case 'search':
					if (this._rowMap['S' + id] !== undefined) {
						rows.push(this._rowMap['S' + id]);
					}
					break;
				
				case 'group':
					let row = this.getRowIndexByID("L" + extraData[id].libraryID);
					let groupLevel = this.getLevel(row);
					do {
						rows.push(row);
						row++;
					}
					while (row < this.rowCount && this.getLevel(row) > groupLevel);
					break;
			}
		}
		
		if (rows.length > 0) {
			rows.sort(function(a,b) { return a-b });
			
			for (let i = rows.length - 1; i >= 0; i--) {
				let row = rows[i];
				this._removeRow(row);
			}
			
			this._refreshRowMap();
		}
		
		if (!this.selection.count) {
			// If last row was selected, stay on the last row
			if (selectedIndex >= this.rowCount) {
				selectedIndex = this.rowCount - 1;
			};
			this.selection.select(selectedIndex)
		}
	}
	else if (action == 'modify') {
		let row;
		let id = ids[0];
		let rowID = "C" + id;
		
		switch (type) {
		case 'collection':
			row = this.getRowIndexByID(rowID);
			if (row !== false) {
				// TODO: Only move if name changed
				let reopen = this.isContainerOpen(row);
				if (reopen) {
					this._closeContainer(row);
				}
				this._removeRow(row);
				yield this._addSortedRow('collection', id);
				if (!extraData[id].skipSelect) {
					yield this.selectByID(currentTreeRow.id);
					if (reopen) {
						let newRow = this.getRowIndexByID(rowID);
						if (!this.isContainerOpen(newRow)) {
							yield this.toggleOpenState(newRow);
						}
					}
				}
			}
			break;
		
		case 'search':
			row = this.getRowIndexByID("S" + id);
			if (row !== false) {
				// TODO: Only move if name changed
				this._removeRow(row);
				yield this._addSortedRow('search', id);
				yield this.selectByID(currentTreeRow.id);
			}
			break;
		
		default:
			yield this.reload();
			yield this.selectByID(currentTreeRow.id);
			break;
		}
	}
	else if(action == 'add')
	{
		// Multiple adds not currently supported
		let id = ids[0];
		let selectRow = !extraData[id] || !extraData[id].skipSelect;
		
		switch (type)
		{
			case 'collection':
			case 'search':
				yield this._addSortedRow(type, id);
				
				if (selectRow) {
					if (type == 'collection') {
						yield this.selectCollection(id);
					}
					else if (type == 'search') {
						yield this.selectSearch(id);
					}
				}
				
				break;
			
			case 'group':
				yield this.reload();
				yield this.selectByID(currentTreeRow.id);
				break;
		}
	}
	
	var deferred = Zotero.Promise.defer();
	this.addEventListener('select', () => deferred.resolve());
	this.selection.selectEventsSuppressed = false;
	return deferred.promise;
});

/**
 * Add a row in the appropriate place
 *
 * This only adds a row if it would be visible without opening any containers
 *
 * @param {String} objectType
 * @param {Integer} id - collectionID
 * @return {Integer|false} - Index at which the row was added, or false if it wasn't added
 */
Zotero.CollectionTreeView.prototype._addSortedRow = Zotero.Promise.coroutine(function* (objectType, id) {
	let beforeRow;
	if (objectType == 'collection') {
		let collection = yield Zotero.Collections.getAsync(id);
		let parentID = collection.parentID;
		
		// If parent isn't visible, don't add
		if (parentID && this._rowMap["C" + parentID] === undefined) {
			return false;
		}
		
		let libraryID = collection.libraryID;
		let startRow;
		if (parentID) {
			startRow = this._rowMap["C" + parentID];
		}
		else {
			startRow = this._rowMap['L' + libraryID];
		}
		
		// If container isn't open, don't add
		if (!this.isContainerOpen(startRow)) {
			return false;
		}
		
		let level = this.getLevel(startRow) + 1;
		// If container is empty, just add after
		if (this.isContainerEmpty(startRow)) {
			beforeRow = startRow + 1;
		}
		else {
			// Get all collections at the same level that don't have a different parent
			startRow++;
			loop:
			for (let i = startRow; i < this.rowCount; i++) {
				let treeRow = this.getRow(i);
				beforeRow = i;
				
				// Since collections come first, if we reach something that's not a collection,
				// stop
				if (!treeRow.isCollection()) {
					break;
				}
				
				let rowLevel = this.getLevel(i);
				if (rowLevel < level) {
					break;
				}
				else {
					// Fast forward through subcollections
					while (rowLevel > level) {
						beforeRow = ++i;
						if (i == this.rowCount || !this.getRow(i).isCollection()) {
							break loop;
						}
						treeRow = this.getRow(i);
						rowLevel = this.getLevel(i);
					}
					
					if (Zotero.localeCompare(treeRow.ref.name, collection.name) > 0) {
						break;
					}
				}
			}
		}
		this._addRow(
			new Zotero.CollectionTreeRow('collection', collection, level),
			beforeRow
		);
	}
	else if (objectType == 'search') {
		let search = yield Zotero.Searches.getAsync(id);
		let libraryID = search.libraryID;
		let startRow = this._rowMap['L' + libraryID];
		
		// If container isn't open, don't add
		if (!this.isContainerOpen(startRow)) {
			return false;
		}
		
		let level = this.getLevel(startRow) + 1;
		// If container is empty, just add after
		if (this.isContainerEmpty(startRow)) {
			beforeRow = startRow + 1;
		}
		else {
			startRow++;
			var inSearches = false;
			for (let i = startRow; i < this.rowCount; i++) {
				let treeRow = this.getRow(i);
				Zotero.debug(treeRow.id);
				beforeRow = i;
				
				// If we've reached something other than collections, stop
				if (treeRow.isSearch()) {
					// If current search sorts after, stop
					if (Zotero.localeCompare(treeRow.ref.name, search.name) > 0) {
						break;
					}
				}
				// If it's not a search and it's not a collection, stop
				else if (!treeRow.isCollection()) {
					break;
				}
			}
		}
		this._addRow(
			new Zotero.CollectionTreeRow('search', search, level),
			beforeRow
		);
	}
	return beforeRow;
});


/*
 * Set the rows that should be highlighted -- actual highlighting is done
 * by getRowProperties based on the array set here
 */
Zotero.CollectionTreeView.prototype.setHighlightedRows = Zotero.Promise.coroutine(function* (ids) {
	this._highlightedRows = {};
	this._treebox.invalidate();
	
	if (!ids) return;
	for (let id of ids) {
		var row = null;
		if (id[0] == 'C') {
			id = id.substr(1);
			yield this.expandToCollection(id);
			row = this._rowMap["C" + id];
		}
		if (row) {
			this._highlightedRows[row] = true;
			this._treebox.invalidateRow(row);
		}
	}
});


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
	var obj = this.getRow(row);
	
	if (column.id == 'zotero-collections-name-column') {
		return obj.getName();
	}
	else
		return "";
}

Zotero.CollectionTreeView.prototype.getImageSrc = function(row, col)
{
	var suffix = Zotero.hiDPI ? "@2x" : "";
	
	var treeRow = this.getRow(row);
	var collectionType = treeRow.type;
	
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
			if (this._trashNotEmpty[treeRow.ref.libraryID]) {
				collectionType += '-full';
			}
			break;
		
		case 'header':
			if (treeRow.ref.id == 'group-libraries-header') {
				collectionType = 'groups';
			}
			else if (treeRow.ref.id == 'commons-header') {
				collectionType = 'commons';
			}
			break;
		
		
			collectionType = 'library';
			break;
		
		case 'collection':
		case 'search':
			if (Zotero.isMac) {
				return "chrome://zotero-platform/content/treesource-" + collectionType + ".png";
			}
			break;
		
		case 'publications':
			return "chrome://zotero/skin/treeitem-journalArticle" + suffix + ".png";
	}
	
	return "chrome://zotero/skin/treesource-" + collectionType + suffix + ".png";
}

Zotero.CollectionTreeView.prototype.isContainer = function(row)
{
	var treeRow = this.getRow(row);
	return treeRow.isLibrary(true) || treeRow.isCollection() || treeRow.isPublications() || treeRow.isBucket();
}

/*
 * Returns true if the collection has no child collections
 */
Zotero.CollectionTreeView.prototype.isContainerEmpty = function(row)
{
	var treeRow = this.getRow(row);
	if (treeRow.isLibrary()) {
		return false;
	}
	if (treeRow.isBucket()) {
		return true;
	}
	if (treeRow.isGroup()) {
		var libraryID = treeRow.ref.libraryID;
		
		return !treeRow.ref.hasCollections()
				&& !treeRow.ref.hasSearches()
				&& this._duplicateLibraries.indexOf(libraryID) == -1
				&& this._unfiledLibraries.indexOf(libraryID) == -1
				&& this.hideSources.indexOf('trash') != -1;
	}
	if (treeRow.isCollection()) {
		return !treeRow.ref.hasChildCollections();
	}
	return true;
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
Zotero.CollectionTreeView.prototype.toggleOpenState = Zotero.Promise.coroutine(function* (row) {
	if (this.isContainerOpen(row)) {
		return this._closeContainer(row);
	}
	
	var count = 0;
	
	var treeRow = this.getRow(row);
	if (treeRow.isLibrary(true) || treeRow.isCollection()) {
		count = yield this._expandRow(this._rows, row, true);
	}
	this.rowCount += count;
	this._treebox.rowCountChanged(row + 1, count);
	
	this._rows[row].isOpen = true;
	this._treebox.invalidateRow(row);
	this._refreshRowMap();
});


Zotero.CollectionTreeView.prototype._closeContainer = function (row) {
	if (!this.isContainerOpen(row)) return;
	
	var count = 0;
	var level = this.getLevel(row);
	var nextRow = row + 1;
	
	// Remove child rows
	while ((nextRow < this._rows.length) && (this.getLevel(nextRow) > level)) {
		this._removeRow(nextRow);
		count--;
	}
	
	this._rows[row].isOpen = false;
	this._treebox.invalidateRow(row);
	this._refreshRowMap();
}


Zotero.CollectionTreeView.prototype.isSelectable = function (row, col) {
	var treeRow = this.getRow(row);
	switch (treeRow.type) {
	case 'separator':
	case 'header':
		return false;
	}
	return true;
}


/**
 * Tree method for whether to allow inline editing (not to be confused with this.editable)
 */
Zotero.CollectionTreeView.prototype.isEditable = function (row, col) {
	return this.selectedTreeRow.isCollection() && this.editable;
}


Zotero.CollectionTreeView.prototype.setCellText = function (row, col, val) {
	val = val.trim();
	if (val === "") {
		return;
	}
	var treeRow = this.getRow(row);
	treeRow.ref.name = val;
	treeRow.ref.saveTx();
}



/**
 * Returns TRUE if the underlying view is editable
 */
Zotero.CollectionTreeView.prototype.__defineGetter__('editable', function () {
	return this.getRow(this.selection.currentIndex).editable;
});


Zotero.CollectionTreeView.prototype.expandLibrary = Zotero.Promise.coroutine(function* (libraryID) {
	var row = this._rowMap['L' + libraryID]
	if (row === undefined) {
		return false;
	}
	if (!this.isContainerOpen(row)) {
		yield this.toggleOpenState(row);
	}
	return true;
});


Zotero.CollectionTreeView.prototype.collapseLibrary = function (libraryID) {
	var row = this._rowMap['L' + libraryID]
	if (row === undefined) {
		return false;
	}
	this._closeContainer(row);
	this.selection.select(row);
	return true;
};


Zotero.CollectionTreeView.prototype.expandToCollection = Zotero.Promise.coroutine(function* (collectionID) {
	var col = yield Zotero.Collections.getAsync(collectionID);
	if (!col) {
		Zotero.debug("Cannot expand to nonexistent collection " + collectionID, 2);
		return false;
	}
	
	// Open library if closed
	var libraryRow = this._rowMap['L' + col.libraryID];
	if (!this.isContainerOpen(libraryRow)) {
		yield this.toggleOpenState(libraryRow);
	}
	
	var row = this._rowMap["C" + collectionID];
	if (row !== undefined) {
		return true;
	}
	var path = [];
	var parentID;
	while (parentID = col.parentID) {
		path.unshift(parentID);
		col = yield Zotero.Collections.getAsync(parentID);
	}
	for each(var id in path) {
		row = this._rowMap["C" + id];
		if (!this.isContainerOpen(row)) {
			yield this.toggleOpenState(row);
		}
	}
	return true;
});



////////////////////////////////////////////////////////////////////////////////
///
///  Additional functions for managing data in the tree
///
////////////////////////////////////////////////////////////////////////////////
Zotero.CollectionTreeView.prototype.selectByID = Zotero.Promise.coroutine(function* (id) {
	var type = id[0];
	id = ('' + id).substr(1);
	
	switch (type) {
	case 'L':
		var found = yield this.selectLibrary(id);
		break;
	
	case 'C':
		var found = yield this.expandToCollection(id);
		break;
		
	case 'S':
		var search = yield Zotero.Searches.getAsync(id);
		var found = yield this.expandLibrary(search.libraryID);
		break;
	
	case 'T':
		var found = yield this.selectTrash(id);
		break;
	}
	
	if (!found) {
		return false;
	}
	var row = this._rowMap[type + id];
	this._treebox.ensureRowIsVisible(row);
	yield this.selectWait(row);
	
	return true;
});


/**
 * @param	{Integer}		libraryID		Library to select
 */
Zotero.CollectionTreeView.prototype.selectLibrary = Zotero.Promise.coroutine(function* (libraryID) {
	// Select local library
	if (!libraryID) {
		this._treebox.ensureRowIsVisible(0);
		yield this.selectWait(0);
		return true;
	}
	
	// Check if library is already selected
	if (this.selection.currentIndex != -1) {
		var treeRow = this.getRow(this.selection.currentIndex);
		if (treeRow.isLibrary(true) && treeRow.ref.libraryID == libraryID) {
			this._treebox.ensureRowIsVisible(this.selection.currentIndex);
			return true;
		}
	}
	
	// Find library
	var row = this._rowMap['L' + libraryID];
	if (row !== undefined) {
		this._treebox.ensureRowIsVisible(row);
		yield this.selectWait(row);
		return true;
	}
	
	return false;
});


Zotero.CollectionTreeView.prototype.selectCollection = function (id) {
	return this.selectByID('C' + id);
}


Zotero.CollectionTreeView.prototype.selectSearch = function (id) {
	return this.selectByID('S' + id);
}


Zotero.CollectionTreeView.prototype.selectTrash = Zotero.Promise.coroutine(function* (libraryID) {
	// Check if trash is already selected
	if (this.selection.currentIndex != -1) {
		let itemGroup = this.getRow(this.selection.currentIndex);
		if (itemGroup.isTrash() && itemGroup.ref.libraryID == libraryID) {
			this._treebox.ensureRowIsVisible(this.selection.currentIndex);
			return true;
		}
	}
	
	// Find library trash
	for (let i = 0; i < this.rowCount; i++) {
		let itemGroup = this.getRow(i);
		
		// If library is closed, open it
		if (itemGroup.isLibrary(true) && itemGroup.ref.libraryID == libraryID
				&& !this.isContainerOpen(i)) {
			yield this.toggleOpenState(i);
			continue;
		}
		
		if (itemGroup.isTrash() && itemGroup.ref.libraryID == libraryID) {
			this._treebox.ensureRowIsVisible(i);
			this.selection.select(i);
			return true;
		}
	}
	
	return false;
});


/*
 *  Delete the selection
 */
Zotero.CollectionTreeView.prototype.deleteSelection = Zotero.Promise.coroutine(function* (deleteItems)
{
	if(this.selection.count == 0)
		return;

	//collapse open collections
	for (let i=0; i<this.rowCount; i++) {
		if (this.selection.isSelected(i) && this.isContainer(i)) {
			this._closeContainer(i);
		}
	}
	this._refreshRowMap();
	
	//create an array of collections
	var rows = new Array();
	var start = new Object();
	var end = new Object();
	for (var i=0, len=this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++)
			if(!this.getRow(j).isLibrary())
				rows.push(j);
	}
	
	//iterate and erase...
	//this._treebox.beginUpdateBatch();
	for (var i=0; i<rows.length; i++)
	{
		//erase collection from DB:
		var treeRow = this.getRow(rows[i]-i);
		if (treeRow.isCollection()) {
			yield treeRow.ref.erase(deleteItems);
		}
		else if (treeRow.isSearch()) {
			yield Zotero.Searches.erase(treeRow.ref.id);
		}
	}
	//this._treebox.endUpdateBatch();
	
	if (end.value < this.rowCount) {
		var row = this.getRow(end.value);
		if (row.isSeparator()) {
			return;
		}
		this.selection.select(end.value);
	}
	else {
		this.selection.select(this.rowCount-1);
	}
});


/**
 * Expand row based on last state, or manually from toggleOpenState()
 */
Zotero.CollectionTreeView.prototype._expandRow = Zotero.Promise.coroutine(function* (rows, row, forceOpen) {
	var treeRow = rows[row];
	var level = rows[row].level;
	var isLibrary = treeRow.isLibrary(true);
	var isCollection = treeRow.isCollection();
	var libraryID = treeRow.ref.libraryID;
	
	if (treeRow.isPublications()) {
		return false;
	}
	
	if (isLibrary) {
		var collections = yield Zotero.Collections.getByLibrary(libraryID, treeRow.ref.id);
	}
	else if (isCollection) {
		var collections = yield Zotero.Collections.getByParent(treeRow.ref.id);
	}
	
	if (isLibrary) {
		var savedSearches = yield Zotero.Searches.getAll(libraryID);
		var showDuplicates = (this.hideSources.indexOf('duplicates') == -1
				&& this._duplicateLibraries.indexOf(libraryID) != -1);
		var showUnfiled = this._unfiledLibraries.indexOf(libraryID) != -1;
		var showTrash = this.hideSources.indexOf('trash') == -1;
	}
	else {
		var savedSearches = [];
		var showDuplicates = false;
		var showUnfiled = false;
		var showTrash = false;
	}
	
	// If not a manual open and either the library is set to be hidden
	// or this is a collection that isn't explicitly opened,
	// set the initial state to closed
	if (!forceOpen &&
			(this._containerState[treeRow.id] === false
				|| (isCollection && !this._containerState[treeRow.id]))) {
		rows[row].isOpen = false;
		return 0;
	}
	
	var startOpen = !!(collections.length || savedSearches.length || showDuplicates || showUnfiled || showTrash);
	
	// If this isn't a manual open, set the initial state depending on whether
	// there are child nodes
	if (!forceOpen) {
		rows[row].isOpen = startOpen;
	}
	
	if (!startOpen) {
		return 0;
	}
	
	var newRows = 0;
	
	// Add collections
	for (var i = 0, len = collections.length; i < len; i++) {
		let beforeRow = row + 1 + newRows;
		this._addRowToArray(
			rows,
			new Zotero.CollectionTreeRow('collection', collections[i], level + 1),
			beforeRow
		);
		newRows++;
		// Recursively expand child collections that should be open
		newRows += yield this._expandRow(rows, beforeRow);
	}
	
	if (isCollection) {
		return newRows;
	}
	
	// Add searches
	for (var i = 0, len = savedSearches.length; i < len; i++) {
		this._addRowToArray(
			rows,
			new Zotero.CollectionTreeRow('search', savedSearches[i], level + 1),
			row + 1 + newRows
		);
		newRows++;
	}
	
	// Duplicate items
	if (showDuplicates) {
		let d = new Zotero.Duplicates(libraryID);
		this._addRowToArray(
			rows,
			new Zotero.CollectionTreeRow('duplicates', d, level + 1),
			row + 1 + newRows
		);
		newRows++;
	}
	
	// Unfiled items
	if (showUnfiled) {
		let s = new Zotero.Search;
		s.libraryID = libraryID;
		s.name = Zotero.getString('pane.collections.unfiled');
		s.addCondition('libraryID', 'is', libraryID);
		s.addCondition('unfiled', 'true');
		this._addRowToArray(
			rows,
			new Zotero.CollectionTreeRow('unfiled', s, level + 1),
			row + 1 + newRows
		);
		newRows++;
	}
	
	if (showTrash) {
		let deletedItems = yield Zotero.Items.getDeleted(libraryID);
		if (deletedItems.length || Zotero.Prefs.get("showTrashWhenEmpty")) {
			var ref = {
				libraryID: libraryID
			};
			this._addRowToArray(
				rows,
				new Zotero.CollectionTreeRow('trash', ref, level + 1),
				row + 1 + newRows
			);
			newRows++;
		}
		this._trashNotEmpty[libraryID] = !!deletedItems.length;
	}
	
	return newRows;
});


/**
 * Returns libraryID or FALSE if not a library
 */
Zotero.CollectionTreeView.prototype.getSelectedLibraryID = function() {
	var treeRow = this.getRow(this.selection.currentIndex);
	return treeRow && treeRow.ref && treeRow.ref.libraryID !== undefined
			&& treeRow.ref.libraryID;
}


Zotero.CollectionTreeView.prototype.getSelectedCollection = function(asID) {
	if (this.selection
			&& this.selection.count > 0
			&& this.selection.currentIndex != -1) {
		var collection = this.getRow(this.selection.currentIndex);
		if (collection && collection.isCollection()) {
			return asID ? collection.ref.id : collection.ref;
		}
	}
	return false;
}


/**
 * Creates mapping of item group ids to tree rows
 */
Zotero.CollectionTreeView.prototype._refreshRowMap = function() {
	this._rowMap = {};
	for (let i = 0, len = this.rowCount; i < len; i++) {
		this._rowMap[this.getRow(i).id] = i;
	}
}


Zotero.CollectionTreeView.prototype._rememberOpenStates = Zotero.Promise.coroutine(function* () {
	var state = this._containerState;
	
	// Every so often, remove obsolete rows
	if (Math.random() < 1/20) {
		Zotero.debug("Purging sourceList.persist");
		for (var id in state) {
			var m = id.match(/^C([0-9]+)$/);
			if (m) {
				if (!(yield Zotero.Collections.getAsync(m[1]))) {
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
		
		var treeRow = this.getRow(i);
		if (!treeRow.id) {
			continue;
		}
		
		var open = this.isContainerOpen(i);
		
		// Collections default to closed
		if (!open && treeRow.isCollection()) {
			delete state[treeRow.id];
			continue;
		}
		
		state[treeRow.id] = open;
	}
	
	this._containerState = state;
	Zotero.Prefs.set("sourceList.persist", JSON.stringify(state));
});


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
	// See note in LibraryTreeView::_setDropEffect()
	if (Zotero.isWin) {
		event.dataTransfer.effectAllowed = 'move';
	}
	
	var treeRow = this.selectedTreeRow;
	if (!treeRow.isCollection()) {
		return;
	}
	event.dataTransfer.setData("zotero/collection", treeRow.ref.id);
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
		var treeRow = this.getRow(row); //the collection we are dragging over
		
		if (dataType == 'zotero/item' && treeRow.isBucket()) {
			return true;
		}
		
		if (!treeRow.editable) {
			Zotero.debug("Drop target not editable");
			return false;
		}
		
		if (dataType == 'zotero/item') {
			var ids = data;
			var items = Zotero.Items.get(ids);
			var skip = true;
			for each(var item in items) {
				// Can only drag top-level items
				if (!item.isTopLevelItem()) {
					Zotero.debug("Can't drag child item");
					return false;
				}
				
				if (treeRow.isWithinGroup() && item.isAttachment()) {
					// Linked files can't be added to groups
					if (item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
						Zotero.debug("Linked files cannot be added to groups");
						return false;
					}
					if (!treeRow.filesEditable) {
						Zotero.debug("Drop target does not allow files to be edited");
						return false;
					}
					skip = false;
					continue;
				}
				
				if (treeRow.isPublications() && treeRow.ref.libraryID != item.libraryID) {
					if (item.isAttachment() || item.isNote()) {
						Zotero.debug("Top-level attachments and notes cannot be added to My Publications");
						return false;
					}
					skip = false;
					continue;
				}
				
				// Cross-library drag
				if (treeRow.ref.libraryID != item.libraryID) {
					// Only allow cross-library drag to root library and collections
					if (!(treeRow.isLibrary(true) || treeRow.isCollection())) {
						Zotero.debug("Cross-library drag to non-collection not allowed");
						return false;
					}
					skip = false;
					continue;
				}
				
				// Intra-library drag
				
				// Don't allow drag onto root of same library
				if (treeRow.isLibrary(true)) {
					Zotero.debug("Can't drag into same library root");
					return false;
				}
				
				// Allow drags to collections. Item collection membership is an asynchronous
				// check, so we do that on drop()
				if (treeRow.isCollection()) {
					skip = false;
				}
			}
			if (skip) {
				Zotero.debug("Drag skipped");
				return false;
			}
			return true;
		}
		else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
			if (treeRow.isSearch() || treeRow.isPublications()) {
				return false;
			}
			if (dataType == 'application/x-moz-file') {
				// Don't allow folder drag
				if (data[0].isDirectory()) {
					return false;
				}
				// Don't allow drop if no permissions
				if (!treeRow.filesEditable) {
					return false;
				}
			}
			
			return true;
		}
		else if (dataType == 'zotero/collection') {
			if (treeRow.isPublications()) {
				return false;
			}
			
			let draggedCollectionID = data[0];
			let draggedCollection = Zotero.Collections.get(draggedCollectionID);
			
			if (treeRow.ref.libraryID == draggedCollection.libraryID) {
				// Collections cannot be dropped on themselves
				if (draggedCollectionID == treeRow.ref.id) {
					return false;
				}
				
				// Nor in their children
				// TODO: figure out synchronously from tree
				/*if (yield col.hasDescendent('collection', treeRow.ref.id)) {
					return false;
				}*/
			}
			// Dragging a collection to a different library
			else {
				// Allow cross-library drag only to root library and collections
				if (!treeRow.isLibrary(true) && !treeRow.isCollection()) {
					return false;
				}
			}
			
			return true;
		}
	}
	return false;
};


/**
 * Perform additional asynchronous drop checks
 *
 * Called by treechildren.drop()
 */
Zotero.CollectionTreeView.prototype.canDropCheckAsync = Zotero.Promise.coroutine(function* (row, orient, dataTransfer) {
	//Zotero.debug("Row is " + row + "; orient is " + orient);
	
	var dragData = Zotero.DragDrop.getDataFromDataTransfer(dataTransfer);
	if (!dragData) {
		Zotero.debug("No drag data");
		return false;
	}
	var dataType = dragData.dataType;
	var data = dragData.data;
	
	if (orient == 0) {
		var treeRow = this.getRow(row); //the collection we are dragging over
		
		if (dataType == 'zotero/item' && treeRow.isBucket()) {
			return true;
		}
		
		if (dataType == 'zotero/item') {
			if (treeRow.isCollection()) {
				yield treeRow.ref.loadChildItems();
			}
			
			var ids = data;
			var items = Zotero.Items.get(ids);
			var skip = true;
			for (let i=0; i<items.length; i++) {
				let item = items[i];
				
				// Cross-library drag
				if (treeRow.ref.libraryID != item.libraryID) {
					let linkedItem = yield item.getLinkedItem(treeRow.ref.libraryID, true);
					if (linkedItem && !linkedItem.deleted) {
						// For drag to root, skip if linked item exists
						if (treeRow.isLibrary(true)) {
							Zotero.debug("Linked item " + linkedItem.key + " already exists "
								+ "in library " + treeRow.ref.libraryID);
							continue;
						}
						// For drag to collection
						else if (treeRow.isCollection()) {
							// skip if linked item is already in it
							if (treeRow.ref.hasItem(linkedItem.id)) {
								Zotero.debug("Linked item " + linkedItem.key + " already exists "
									+ "in collection");
								continue;
							}
							// or if linked item is a child item
							else if (!linkedItem.isTopLevelItem()) {
								Zotero.debug("Linked item " + linkedItem.key + " already exists "
									+ "as child item");
								continue;
							}
						}
					}
					skip = false;
					continue;
				}
				
				// Intra-library drag
				
				// Make sure there's at least one item that's not already in this destination
				if (treeRow.isCollection()) {
					if (treeRow.ref.hasItem(item.id)) {
						Zotero.debug("Item " + item.id + " already exists in collection");
						continue;
					}
					skip = false;
					continue;
				}
			}
			if (skip) {
				Zotero.debug("Drag skipped");
				return false;
			}
		}
		else if (dataType == 'zotero/collection') {
			let draggedCollectionID = data[0];
			let draggedCollection = Zotero.Collections.get(draggedCollectionID);
			
			// Dragging a collection to a different library
			if (treeRow.ref.libraryID != draggedCollection.libraryID) {
				// Disallow if linked collection already exists
				if (yield col.getLinkedCollection(treeRow.ref.libraryID)) {
					return false;
				}
				
				var descendents = yield col.getDescendents(false, 'collection');
				for each(var descendent in descendents) {
					descendent = yield Zotero.Collections.getAsync(descendent.id);
					// Disallow if linked collection already exists for any subcollections
					//
					// If this is allowed in the future for the root collection,
					// need to allow drag only to root
					if (yield descendent.getLinkedCollection(treeRow.ref.libraryID)) {
						return false;
					}
				}
			}
		}
	}
	return true;
});


/*
 *  Called when something's been dropped on or next to a row
 */
Zotero.CollectionTreeView.prototype.drop = Zotero.Promise.coroutine(function* (row, orient, dataTransfer)
{
	if (!this.canDrop(row, orient, dataTransfer)
			|| !(yield this.canDropCheckAsync(row, orient, dataTransfer))) {
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
	var event = Zotero.DragDrop.currentEvent;
	var sourceTreeRow = Zotero.DragDrop.getDragSource(dataTransfer);
	var targetTreeRow = Zotero.DragDrop.getDragTarget(event);
	
	var copyOptions = {
		tags: Zotero.Prefs.get('groups.copyTags'),
		childNotes: Zotero.Prefs.get('groups.copyChildNotes'),
		childLinks: Zotero.Prefs.get('groups.copyChildLinks'),
		childFileAttachments: Zotero.Prefs.get('groups.copyChildFileAttachments')
	};
	var copyItem = Zotero.Promise.coroutine(function* (item, targetLibraryID, options) {
		var targetLibraryType = Zotero.Libraries.getType(targetLibraryID);
		
		// Check if there's already a copy of this item in the library
		var linkedItem = yield item.getLinkedItem(targetLibraryID, true);
		if (linkedItem) {
			// If linked item is in the trash, undelete it and remove it from collections
			// (since it shouldn't be restored to previous collections)
			if (linkedItem.deleted) {
				yield linkedItem.loadCollections();
				linkedItem.setCollections();
				linkedItem.deleted = false;
				yield linkedItem.save({
					skipSelect: true
				});
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
			
			if (!targetTreeRow.filesEditable) {
				Zotero.debug("Skipping standalone file attachment on drag");
				return false;
			}
			
			return Zotero.Attachments.copyAttachmentToLibrary(item, targetLibraryID);
		}
		
		// Create new clone item in target library
		var newItem = yield item.clone(targetLibraryID, false, !options.tags);
		
		// Set Rights field for My Publications
		if (options.license) {
			if (!options.useRights || !newItem.getField('rights')) {
				newItem.setField('rights', options.licenseName);
			}
		}
		
		var newItemID = yield newItem.save({
			skipSelect: true
		});
		
		// Record link
		yield newItem.addLinkedItem(item);
		
		if (item.isNote()) {
			return newItemID;
		}
		
		// For regular items, add child items if prefs and permissions allow
		
		// Child notes
		if (options.childNotes) {
			yield item.loadChildItems();
			var noteIDs = item.getNotes();
			var notes = yield Zotero.Items.getAsync(noteIDs);
			for each(var note in notes) {
				let newNote = yield note.clone(targetLibraryID);
				newNote.parentID = newItemID;
				yield newNote.save({
					skipSelect: true
				})
				
				yield newNote.addLinkedItem(note);
			}
		}
		
		// Child attachments
		if (options.childLinks || options.childFileAttachments) {
			yield item.loadChildItems();
			var attachmentIDs = item.getAttachments();
			var attachments = yield Zotero.Items.getAsync(attachmentIDs);
			for each(var attachment in attachments) {
				var linkMode = attachment.attachmentLinkMode;
				
				// Skip linked files
				if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
					Zotero.debug("Skipping child linked file attachment on drag");
					continue;
				}
				
				// Skip imported files if we don't have pref and permissions
				if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
					if (!options.childLinks) {
						Zotero.debug("Skipping child link attachment on drag");
						continue;
					}
				}
				else {
					if (!options.childFileAttachments
							|| (!targetTreeRow.filesEditable && !targetTreeRow.isPublications())) {
						Zotero.debug("Skipping child file attachment on drag");
						continue;
					}
				}
				yield Zotero.Attachments.copyAttachmentToLibrary(attachment, targetLibraryID, newItemID);
			}
		}
		
		return newItemID;
	});
	
	var targetLibraryID = targetTreeRow.ref.libraryID;
	var targetCollectionID = targetTreeRow.isCollection() ? targetTreeRow.ref.id : false;
	
	if (dataType == 'zotero/collection') {
		var droppedCollection = yield Zotero.Collections.getAsync(data[0]);
		
		// Collection drag between libraries
		if (targetLibraryID != droppedCollection.libraryID) {
			yield Zotero.DB.executeTransaction(function* () {
				function copyCollections(descendents, parentID, addItems) {
					for each(var desc in descendents) {
						// Collections
						if (desc.type == 'collection') {
							var c = yield Zotero.Collections.getAsync(desc.id);
							
							var newCollection = new Zotero.Collection;
							newCollection.libraryID = targetLibraryID;
							yield c.clone(false, newCollection);
							if (parentID) {
								newCollection.parentID = parentID;
							}
							var collectionID = yield newCollection.save();
							
							// Record link
							c.addLinkedCollection(newCollection);
							
							// Recursively copy subcollections
							if (desc.children.length) {
								copyCollections(desc.children, collectionID, addItems);
							}
						}
						// Items
						else {
							var item = yield Zotero.Items.getAsync(desc.id);
							var id = yield copyItem(item, targetLibraryID, copyOptions);
							// Standalone attachments might not get copied
							if (!id) {
								continue;
							}
							// Mark copied item for adding to collection
							if (parentID) {
								if (!addItems[parentID]) {
									addItems[parentID] = [];
								}
								addItems[parentID].push(id);
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
					var collection = yield Zotero.Collections.getAsync(collectionID);
					collection.addItems(addItems[collectionID]);
				}
				
				// TODO: add subcollections and subitems, if they don't already exist,
				// and display a warning if any of the subcollections already exist
			});
		}
		// Collection drag within a library
		else {
			droppedCollection.parentID = targetCollectionID;
			yield droppedCollection.saveTx();
		}
	}
	else if (dataType == 'zotero/item') {
		var ids = data;
		if (ids.length < 1) {
			return;
		}
		
		if (targetTreeRow.isBucket()) {
			targetTreeRow.ref.uploadItems(ids);
			return;
		}
		
		if (targetTreeRow.isPublications()) {
			let items = yield Zotero.Items.getAsync(ids);
			let io = yield this._treebox.treeBody.ownerDocument.defaultView.ZoteroPane
				.showPublicationsWizard(items);
			if (!io) {
				return;
			}
			copyOptions.childNotes = io.includeNotes;
			copyOptions.childFileAttachments = io.includeFiles;
			copyOptions.childLinks = true;
			copyOptions.tags = true; // TODO: add checkbox
			['useRights', 'license', 'licenseName'].forEach(function (field) {
				copyOptions[field] = io[field];
			});
		}
		
		yield Zotero.DB.executeTransaction(function* () {
			var items = yield Zotero.Items.getAsync(ids);
			if (!items) {
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
				if (!item.isTopLevelItem()) {
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
					var id = yield copyItem(item, targetLibraryID, copyOptions)
					// Standalone attachments might not get copied
					if (!id) {
						continue;
					}
					newIDs.push(id);
				}
				
				if (toReconcile.length) {
					var sourceName = Zotero.Libraries.getName(items[0].libraryID);
					var targetName = Zotero.Libraries.getName(targetLibraryID);
					
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
						yield obj.ref.save();
					}
				}
			}
			
			// Add items to target collection
			if (targetCollectionID) {
				let ids = newIDs.filter(function (itemID) {
					var item = Zotero.Items.get(itemID);
					return item.isTopLevelItem();
				});
				var collection = yield Zotero.Collections.getAsync(targetCollectionID);
				yield collection.addItems(ids);
			}
			
			// If moving, remove items from source collection
			if (dropEffect == 'move' && toMove.length) {
				if (!sameLibrary) {
					throw new Error("Cannot move items between libraries");
				}
				if (!sourceTreeRow || !sourceTreeRow.isCollection()) {
					throw new Error("Drag source must be a collection for move action");
				}
				yield sourceTreeRow.ref.removeItems(toMove);
			}
		});
	}
	else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
		var targetLibraryID = targetTreeRow.ref.libraryID;
		
		if (targetTreeRow.isCollection()) {
			var parentCollectionID = targetTreeRow.ref.id;
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
				
				if (dropEffect == 'link') {
					yield Zotero.Attachments.linkFromFile({
						file: file,
						collections: [parentCollectionID]
					});
				}
				else {
					yield Zotero.Attachments.importFromFile({
						file: file,
						libraryID: targetLibraryID,
						collections: [parentCollectionID]
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

Zotero.CollectionTreeView.prototype.isSorted = function() 							{ return false; }

/* Set 'highlighted' property on rows set by setHighlightedRows */
Zotero.CollectionTreeView.prototype.getRowProperties = function(row, prop) {
	var props = [];
	
	var treeRow = this.getRow(row);
	if (treeRow.isHeader()) {
		props.push("header");
	}
	else if (this._highlightedRows[row]) {
		props.push("highlighted");
	}
	
	return props.join(" ");
}

Zotero.CollectionTreeView.prototype.getColumnProperties = function(col, prop) {}

Zotero.CollectionTreeView.prototype.getCellProperties = function(row, col, prop) {
	var props = [];
	
	var treeRow = this.getRow(row);
	if (treeRow.isHeader()) {
		props.push("header");
		props.push("notwisty");
	}
	else if (treeRow.isPublications()) {
		props.push("notwisty");
	}
	
	return props.join(" ");

}
Zotero.CollectionTreeView.prototype.isSeparator = function(index) {
	var source = this.getRow(index);
	return source.type == 'separator';
}
Zotero.CollectionTreeView.prototype.performAction = function(action) 				{ }
Zotero.CollectionTreeView.prototype.performActionOnCell = function(action, row, col)	{ }
Zotero.CollectionTreeView.prototype.getProgressMode = function(row, col) 			{ }
Zotero.CollectionTreeView.prototype.cycleHeader = function(column)					{ }


Zotero.CollectionTreeCache = {
	"lastTreeRow":null,
	"lastTempTable":null,
	"lastSearch":null,
	"lastResults":null,
	
	"clear": function () {
		this.lastTreeRow = null;
		this.lastSearch = null;
		if(this.lastTempTable) {
			// Drop the last temp table when we can. We don't wait on this because it can cause a
			// deadlock: this waits on open transactions, but a transaction could be waiting on
			// ItemTreeView::notify(), which waits on ItemTreeView::refresh(), which calls this.
			Zotero.DB.queryTx("DROP TABLE IF EXISTS " + this.lastTempTable).done();
		}
		this.lastTempTable = null;
		this.lastResults = null;
	}
};

Zotero.CollectionTreeRow = function(type, ref, level, isOpen)
{
	this.type = type;
	this.ref = ref;
	this.level = level || 0
	this.isOpen = isOpen || false;
}


Zotero.CollectionTreeRow.prototype.__defineGetter__('id', function () {
	switch (this.type) {
		case 'library':
		case 'publications':
		case 'group':
			return 'L' + this.ref.libraryID;
		
		case 'collection':
			return 'C' + this.ref.id;
		
		case 'search':
			return 'S' + this.ref.id;
		
		case 'duplicates':
			return 'D' + this.ref.libraryID;
		
		case 'unfiled':
			return 'U' + this.ref.libraryID;
		
		case 'trash':
			return 'T' + this.ref.libraryID;
		
		case 'header':
			if (this.ref.id == 'group-libraries-header') {
				return 'HG';
			}
			break;
	}
	
	return '';
});

Zotero.CollectionTreeRow.prototype.isLibrary = function (includeGlobal)
{
	if (includeGlobal) {
		return this.type == 'library' || this.type == 'publications' || this.type == 'group';
	}
	return this.type == 'library';
}

Zotero.CollectionTreeRow.prototype.isCollection = function()
{
	return this.type == 'collection';
}

Zotero.CollectionTreeRow.prototype.isSearch = function()
{
	return this.type == 'search';
}

Zotero.CollectionTreeRow.prototype.isDuplicates = function () {
	return this.type == 'duplicates';
}

Zotero.CollectionTreeRow.prototype.isUnfiled = function () {
	return this.type == 'unfiled';
}

Zotero.CollectionTreeRow.prototype.isTrash = function()
{
	return this.type == 'trash';
}

Zotero.CollectionTreeRow.prototype.isHeader = function () {
	return this.type == 'header';
}

Zotero.CollectionTreeRow.prototype.isPublications = function() {
	return this.type == 'publications';
}

Zotero.CollectionTreeRow.prototype.isGroup = function() {
	return this.type == 'group';
}

Zotero.CollectionTreeRow.prototype.isSeparator = function () {
	return this.type == 'separator';
}

Zotero.CollectionTreeRow.prototype.isBucket = function()
{
	return this.type == 'bucket';
}

Zotero.CollectionTreeRow.prototype.isShare = function()
{
	return this.type == 'share';
}



// Special
Zotero.CollectionTreeRow.prototype.isWithinGroup = function () {
	return this.ref && !this.isHeader()
		&& Zotero.Libraries.getType(this.ref.libraryID) == 'group';
}

Zotero.CollectionTreeRow.prototype.isWithinEditableGroup = function () {
	if (!this.isWithinGroup()) {
		return false;
	}
	var groupID = Zotero.Groups.getGroupIDFromLibraryID(this.ref.libraryID);
	return Zotero.Groups.get(groupID).editable;
}

Zotero.CollectionTreeRow.prototype.__defineGetter__('editable', function () {
	if (this.isTrash() || this.isShare() || this.isBucket()) {
		return false;
	}
	if (!this.isWithinGroup() || this.isPublications()) {
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
		throw ("Unknown library type '" + type + "' in Zotero.CollectionTreeRow.editable");
	}
	return false;
});

Zotero.CollectionTreeRow.prototype.__defineGetter__('filesEditable', function () {
	if (this.isTrash() || this.isShare()) {
		return false;
	}
	if (!this.isWithinGroup() || this.isPublications()) {
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
		throw ("Unknown library type '" + type + "' in Zotero.CollectionTreeRow.filesEditable");
	}
	return false;
});

Zotero.CollectionTreeRow.prototype.getName = function()
{
	switch (this.type) {
		case 'library':
			return Zotero.getString('pane.collections.library');
		
		case 'publications':
			return Zotero.getString('pane.collections.publications');
		
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

Zotero.CollectionTreeRow.prototype.getItems = Zotero.Promise.coroutine(function* ()
{
	switch (this.type) {
		// Fake results if this is a shared library
		case 'share':
			return this.ref.getAll();
		
		case 'bucket':
			return this.ref.getItems();
	}
	
	var ids = yield this.getSearchResults();
	if (!ids.length) {
		return []
	}
	return Zotero.Items.getAsync(ids);
});

Zotero.CollectionTreeRow.prototype.getSearchResults = Zotero.Promise.coroutine(function* (asTempTable) {
	if (Zotero.CollectionTreeCache.lastTreeRow && Zotero.CollectionTreeCache.lastTreeRow.id !== this.id) {
		Zotero.CollectionTreeCache.clear();
	}
	
	if(!Zotero.CollectionTreeCache.lastResults) {
		var s = yield this.getSearchObject();
		Zotero.CollectionTreeCache.lastResults = yield s.search();
		Zotero.CollectionTreeCache.lastTreeRow = this;
	}
	
	if(asTempTable) {
		if(!Zotero.CollectionTreeCache.lastTempTable) {
			Zotero.CollectionTreeCache.lastTempTable = yield Zotero.Search.idsToTempTable(Zotero.CollectionTreeCache.lastResults);
		}
		return Zotero.CollectionTreeCache.lastTempTable;
	}
	return Zotero.CollectionTreeCache.lastResults;
});

/*
 * Returns the search object for the currently display
 *
 * This accounts for the collection, saved search, quicksearch, tags, etc.
 */
Zotero.CollectionTreeRow.prototype.getSearchObject = Zotero.Promise.coroutine(function* () {
	if (Zotero.CollectionTreeCache.lastTreeRow && Zotero.CollectionTreeCache.lastTreeRow.id !== this.id) {
		Zotero.CollectionTreeCache.clear();
	}
	
	if(Zotero.CollectionTreeCache.lastSearch) {
		return Zotero.CollectionTreeCache.lastSearch;
	}	
	
	var includeScopeChildren = false;
	
	// Create/load the inner search
	if (this.ref instanceof Zotero.Search) {
		var s = this.ref;
	}
	else if (this.isDuplicates()) {
		var s = yield this.ref.getSearchObject();
	}
	else {
		var s = new Zotero.Search();
		s.addCondition('libraryID', 'is', this.ref.libraryID);
		// Library root
		if (this.isLibrary(true)) {
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
			s.addCondition('deleted', 'true');
		}
		else {
			throw new Error('Invalid search mode ' + this.type);
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
		for (let tag of this.tags) {
			s2.addCondition('tag', 'is', tag);
		}
	}
	
	Zotero.CollectionTreeCache.lastTreeRow = this;
	Zotero.CollectionTreeCache.lastSearch = s2;
	return s2;
});


/**
 * Returns all the tags used by items in the current view
 *
 * @return {Promise}
 */
Zotero.CollectionTreeRow.prototype.getChildTags = Zotero.Promise.coroutine(function* () {
	switch (this.type) {
		// TODO: implement?
		case 'share':
			return false;
		
		case 'bucket':
			return false;
	}
	var results = yield this.getSearchResults(true);
	return Zotero.Tags.getAllWithinSearchResults(results);
});


Zotero.CollectionTreeRow.prototype.setSearch = function (searchText) {
	Zotero.CollectionTreeCache.clear();
	this.searchText = searchText;
}

Zotero.CollectionTreeRow.prototype.setTags = function (tags) {
	Zotero.CollectionTreeCache.clear();
	this.tags = tags;
}

/*
 * Returns TRUE if saved search, quicksearch or tag filter
 */
Zotero.CollectionTreeRow.prototype.isSearchMode = function() {
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
	if (this.tags && this.tags.size) {
		return true;
	}
}
