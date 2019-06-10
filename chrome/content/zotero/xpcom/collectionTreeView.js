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
	
	this.itemTreeView = null;
	this.itemToSelect = null;
	this.hideSources = [];
	
	this._highlightedRows = {};
	this._unregisterID = Zotero.Notifier.registerObserver(
		this,
		[
			'collection',
			'search',
			'feed',
			'share',
			'group',
			'feedItem',
			'trash',
			'bucket'
		],
		'collectionTreeView',
		25
	);
	this._containerState = {};
	this._virtualCollectionLibraries = {};
	this._trashNotEmpty = {};
}

Zotero.CollectionTreeView.prototype = Object.create(Zotero.LibraryTreeView.prototype);
Zotero.CollectionTreeView.prototype.type = 'collection';

Object.defineProperty(Zotero.CollectionTreeView.prototype, "selectedTreeRow", {
	get: function () {
		if (!this.selection || !this.selection.count) {
			return false;
		}
		return this.getRow(this.selection.currentIndex);
	}
});


Object.defineProperty(Zotero.CollectionTreeView.prototype, 'window', {
	get: function () {
		return this._ownerDocument.defaultView;
	},
	enumerable: true
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
		
		if (!this._ownerDocument) {
			try {
				this._ownerDocument = treebox.treeBody.ownerDocument;
			}
			catch (e) {}
		}
		
		// Add a keypress listener for expand/collapse
		var tree = this._treebox.treeBody.parentNode;
		tree.addEventListener('keypress', function(event) {
			if (tree.editingRow != -1) return; // In-line editing active
			
			var libraryID = this.getSelectedLibraryID();
			if (!libraryID) return;
			
			var key = String.fromCharCode(event.which);
			if (key == '+' && !(event.ctrlKey || event.altKey || event.metaKey)) {
				this.expandLibrary(libraryID, true);
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
		
		yield this.runListeners('load');
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
	
	var userLibraryID = Zotero.Libraries.userLibraryID;
	
	if (this.hideSources.indexOf('duplicates') == -1) {
		this._virtualCollectionLibraries.duplicates =
			Zotero.Utilities.Internal.getVirtualCollectionState('duplicates')
	}
	this._virtualCollectionLibraries.unfiled =
			Zotero.Utilities.Internal.getVirtualCollectionState('unfiled')
	this._virtualCollectionLibraries.retracted =
			Zotero.Utilities.Internal.getVirtualCollectionState('retracted');
	
	var oldCount = this.rowCount || 0;
	var newRows = [];
	var added = 0;
	
	//
	// Add "My Library"
	//
	this._addRowToArray(
		newRows,
		new Zotero.CollectionTreeRow(this, 'library', { libraryID: Zotero.Libraries.userLibraryID }),
		added++
	);
	added += yield this._expandRow(newRows, 0);
	
	// TODO: Unify feed and group adding code
	
	// Add groups
	var groups = Zotero.Groups.getAll();
	if (groups.length) {
		this._addRowToArray(
			newRows,
			new Zotero.CollectionTreeRow(this, 'separator', false),
			added++
		);
		this._addRowToArray(
			newRows,
			new Zotero.CollectionTreeRow(this, 'header', {
				id: "group-libraries-header",
				label: Zotero.getString('pane.collections.groupLibraries'),
				libraryID: -1
			}, 0),
			added++
		);
		for (let group of groups) {
			this._addRowToArray(
				newRows,
				new Zotero.CollectionTreeRow(this, 'group', group),
				added++
			);
			added += yield this._expandRow(newRows, added - 1);
		}
	}
	
	// Add feeds
	if (this.hideSources.indexOf('feeds') == -1) {
		var feeds = Zotero.Feeds.getAll();
		
		// Alphabetize
		var collation = Zotero.getLocaleCollation();
		feeds.sort(function(a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		
		if (feeds.length) {
			this._addRowToArray(
				newRows,
				new Zotero.CollectionTreeRow(this, 'separator', false),
				added++
			);
			this._addRowToArray(
				newRows,
				new Zotero.CollectionTreeRow(this, 'header', {
					id: "feed-libraries-header",
					label: Zotero.getString('pane.collections.feedLibraries'),
					libraryID: -1
				}, 0),
				added++
			);
			for (let feed of feeds) {
				this._addRowToArray(
					newRows,
					new Zotero.CollectionTreeRow(this, 'feed', feed),
					added++
				);
			}
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


/**
 * Refresh tree and invalidate
 *
 * See note for refresh() for requirements of calling code
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
	var promise = this.waitForSelect();
	this.selection.select(row);
	return promise;
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
	
	if (!this.selection) {
		Zotero.debug("Selection didn't exist in collectionTreeView.notify()");
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
			this._trashNotEmpty[ids[0]] = yield Zotero.Items.hasDeleted(ids[0]);
			let row = this.getRowIndexByID("T" + ids[0]);
			this._treebox.invalidateRow(row);
		}
		return;
	}
	if (type == 'feed' && (action == 'unreadCountUpdated' || action == 'statusChanged')) {
		for (let i=0; i<ids.length; i++) {
			this._treebox.invalidateRow(this._rowMap['L' + ids[i]]);
		}
		return;
	}
	
	//
	// Actions that can change the selection
	//
	var currentTreeRow = this.getRow(this.selection.currentIndex);
	this.selection.selectEventsSuppressed = true;
	
	// If there's not at least one new collection to be selected, get a scroll position to restore later
	var scrollPosition = false;
	if (action != 'add' || ids.every(id => extraData[id] && extraData[id].skipSelect)) {
		if (action == 'delete' && (type == 'group' || type == 'feed')) {
			// Don't try to access deleted library
		}
		else {
			scrollPosition = this._saveScrollPosition();
		}
	}
	
	if (action == 'delete') {
		let selectedIndex = this.selection.count ? this.selection.currentIndex : 0;
		let refreshFeeds = false;
		
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

				case 'feed':
				case 'group':
					let row = this.getRowIndexByID("L" + extraData[id].libraryID);
					let level = this.getLevel(row);
					do {
						rows.push(row);
						row++;
					}
					while (row < this.rowCount && this.getLevel(row) > level);
					
					if (type == 'feed') {
						refreshFeeds = true;
					}
					break;
			}
		}
		
		if (rows.length > 0) {
			rows.sort(function(a,b) { return a-b });
			
			for (let i = rows.length - 1; i >= 0; i--) {
				let row = rows[i];
				this._removeRow(row);
			}
			
			// If a feed was removed and there are no more, remove Feeds header
			if (refreshFeeds && !Zotero.Feeds.haveFeeds()) {
				for (let i = 0; i < this._rows.length; i++) {
					let row = this._rows[i];
					if (row.ref.id == 'feed-libraries-header') {
						this._removeRow(i);
						this._removeRow(i - 1);
						break;
					}
				}
			}
			
			this._refreshRowMap();
		}
		
		this.selectAfterRowRemoval(selectedIndex);
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
				yield this.selectByID(currentTreeRow.id);
				if (reopen) {
					let newRow = this.getRowIndexByID(rowID);
					if (!this.isContainerOpen(newRow)) {
						yield this.toggleOpenState(newRow);
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
		// skipSelect isn't necessary if more than one object
		let selectRow = ids.length == 1 && (!extraData[ids[0]] || !extraData[ids[0]].skipSelect);
		
		for (let id of ids) {
			switch (type) {
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
				case 'feed':
					if (type == 'groups' && ids.length != 1) {
						Zotero.logError("WARNING: Multiple groups shouldn't currently be added "
							+ "together in collectionTreeView::notify()")
					}
					yield this.reload();
					yield this.selectByID(
						// Groups only come from sync, so they should never be auto-selected
						(type != 'group' && selectRow)
							? "L" + id
							: currentTreeRow.id
					);
					break;
			}
		}
	}
	
	this._rememberScrollPosition(scrollPosition);
	
	var promise = this.waitForSelect();
	this.selection.selectEventsSuppressed = false;
	return promise;
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
						// If going from lower level to a row higher than the target level, we found
						// our place:
						//
						// - 1
						//   - 3
						//     - 4
						// - 2 <<<< 5, a sibling of 3, goes above here
						if (rowLevel < level) {
							break loop;
						}
					}
					
					if (Zotero.localeCompare(treeRow.ref.name, collection.name) > 0) {
						break;
					}
				}
			}
		}
		this._addRow(
			new Zotero.CollectionTreeRow(this, 'collection', collection, level),
			beforeRow
		);
	}
	else if (objectType == 'search') {
		let search = Zotero.Searches.get(id);
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
			new Zotero.CollectionTreeRow(this, 'search', search, level),
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
	
	if (!ids || !ids.length) {
		return;
	}
	
	// Make sure all highlighted collections are shown
	for (let id of ids) {
		if (id[0] == 'C') {
			yield this.expandToCollection(parseInt(id.substr(1)));
		}
	}
	
	// Highlight rows
	var rows = [];
	for (let id of ids) {
		let row = this._rowMap[id];
		this._highlightedRows[row] = true;
		this._treebox.invalidateRow(row);
		rows.push(row);
	}
	rows.sort();
	var firstRow = this._treebox.getFirstVisibleRow();
	var lastRow = this._treebox.getLastVisibleRow();
	var scrolled = false;
	for (let row of rows) {
		// If row is visible, stop
		if (row >= firstRow && row <= lastRow) {
			scrolled = true;
			break;
		}
	}
	// Select first collection
	// TODO: Select closest? Select a few rows above or below?
	if (!scrolled) {
		this._treebox.ensureRowIsVisible(rows[0]);
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
	var suffix = Zotero.hiDPISuffix;
	
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
		case 'feed':
			// Better alternative needed: https://github.com/zotero/zotero/pull/902#issuecomment-183185973
			/*
			if (treeRow.ref.updating) {
				collectionType += '-updating';
			} else */if (treeRow.ref.lastCheckError) {
				collectionType += '-error';
			}
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
			else if (treeRow.ref.id == 'feed-libraries-header') {
				collectionType = 'feedLibrary';
			}
			else if (treeRow.ref.id == 'commons-header') {
				collectionType = 'commons';
			}
			break;
		
		
			collectionType = 'library';
			break;
		
		case 'collection':
		case 'search':
			// Keep in sync with Zotero.(Collection|Search).prototype.treeViewImage
			if (Zotero.isMac) {
				return `chrome://zotero-platform/content/treesource-${collectionType}${Zotero.hiDPISuffix}.png`;
			}
			break;
		
		case 'publications':
			return "chrome://zotero/skin/treeitem-journalArticle" + suffix + ".png";
		
		case 'retracted':
			return "chrome://zotero/skin/cross" + suffix + ".png";
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
				// Duplicate Items not shown
				&& (this.hideSources.indexOf('duplicates') != -1
					|| this._virtualCollectionLibraries.duplicates[libraryID] === false)
				// Unfiled Items not shown
				&& this._virtualCollectionLibraries.unfiled[libraryID] === false
				// Retracted Items not shown
				&& this._virtualCollectionLibraries.retracted[libraryID] === false
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
	this._startSaveOpenStatesTimer();
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
	this._startSaveOpenStatesTimer();
}


/**
 * After a short delay, persist the open states of the tree, or if already queued, cancel and requeue.
 * This avoids repeated saving while opening or closing multiple rows.
 */
Zotero.CollectionTreeView.prototype._startSaveOpenStatesTimer = function () {
	if (this._saveOpenStatesTimeoutID) {
		clearTimeout(this._saveOpenStatesTimeoutID);
	}
	this._saveOpenStatesTimeoutID = setTimeout(() => {
		this._saveOpenStates();
		this._saveOpenStatesTimeoutID = null;
	}, 250)
};


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


/**
 * @param {Integer} libraryID
 * @param {Boolean} [recursive=false] - Expand all collections and subcollections
 */
Zotero.CollectionTreeView.prototype.expandLibrary = Zotero.Promise.coroutine(function* (libraryID, recursive) {
	var row = this._rowMap['L' + libraryID]
	if (row === undefined) {
		return false;
	}
	if (!this.isContainerOpen(row)) {
		yield this.toggleOpenState(row);
	}
	
	if (recursive) {
		for (let i = row; i < this.rowCount && this.getRow(i).ref.libraryID == libraryID; i++) {
			if (this.isContainer(i) && !this.isContainerOpen(i)) {
				yield this.toggleOpenState(i);
			}
		}
	}
	
	return true;
});


Zotero.CollectionTreeView.prototype.collapseLibrary = function (libraryID) {
	var row = this._rowMap['L' + libraryID]
	if (row === undefined) {
		return false;
	}
	
	var closed = [];
	var found = false;
	for (let i = this.rowCount - 1; i >= row; i--) {
		let treeRow = this.getRow(i);
		if (treeRow.ref.libraryID !== libraryID) {
			// Once we've moved beyond the original library, stop looking
			if (found) {
				break;
			}
			continue;
		}
		found = true;
		
		if (this.isContainer(i) && this.isContainerOpen(i)) {
			closed.push(treeRow.id);
			this._closeContainer(i);
		}
	}
	
	// Select the collapsed library
	this.selection.select(row);
	
	// We have to manually delete closed rows from the container state object, because otherwise
	// _saveOpenStates() wouldn't see any of the rows under the library (since the library is now
	// collapsed) and they'd remain as open in the persisted object.
	closed.forEach(id => { delete this._containerState[id]; });
	this._saveOpenStates();
	
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
	for (let id of path) {
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
	id = parseInt(('' + id).substr(1));
	
	switch (type) {
	case 'L':
		return yield this.selectLibrary(id);
	
	case 'C':
		yield this.expandToCollection(id);
		break;
	
	case 'S':
		var search = yield Zotero.Searches.getAsync(id);
		yield this.expandLibrary(search.libraryID);
		break;
	
	case 'D':
	case 'U':
	case 'R':
		yield this.expandLibrary(id);
		break;
	
	case 'T':
		return yield this.selectTrash(id);
	}
	
	var row = this._rowMap[type + id];
	if (!row) {
		return false;
	}
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
	if (this.selection && this.selection.count && this.selection.currentIndex != -1) {
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
	if (this.selection && this.selection.count && this.selection.currentIndex != -1) {
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


/**
 * Find an item in the current collection, or, if not there, in a library root, and select it
 *
 * @param {Integer} - itemID
 * @param {Boolean} [inLibraryRoot=false] - Always show in library root
 * @return {Boolean} - TRUE if the item was selected, FALSE if not
 */
Zotero.CollectionTreeView.prototype.selectItem = async function (itemID, inLibraryRoot) {
	return !!(await this.selectItems([itemID], inLibraryRoot));
};


/**
 * Find items in current collection, or, if not there, in a library root, and select them
 *
 * @param {Integer[]} itemIDs
 * @param {Boolean} [inLibraryRoot=false] - Always show in library root
 * @return {Integer} - The number of items selected
 */
Zotero.CollectionTreeView.prototype.selectItems = async function (itemIDs, inLibraryRoot) {
	if (!itemIDs.length) {
		return 0;
	}
	
	var items = await Zotero.Items.getAsync(itemIDs);
	if (!items.length) {
		return 0;
	}
	
	await this.waitForLoad();
	
	// Check if items from multiple libraries were specified
	if (items.length > 1 && new Set(items.map(item => item.libraryID)).size > 1) {
		Zotero.debug("Can't select items in multiple libraries", 2);
		return 0;
	}
	
	var currentLibraryID = this.getSelectedLibraryID();
	var libraryID = items[0].libraryID;
	// If in a different library
	if (libraryID != currentLibraryID) {
		Zotero.debug("Library ID differs; switching library");
		await this.selectLibrary(libraryID);
	}
	// Force switch to library view
	else if (!this.selectedTreeRow.isLibrary() && inLibraryRoot) {
		Zotero.debug("Told to select in library; switching to library");
		await this.selectLibrary(libraryID);
	}
	
	await this.itemTreeView.waitForLoad();
	
	var numSelected = await this.itemTreeView.selectItems(itemIDs);
	if (numSelected == items.length) {
		return numSelected;
	}
	
	// If there's a single item and it's in the trash, switch to that
	if (items.length == 1 && items[0].deleted) {
		Zotero.debug("Item is deleted; switching to trash");
		await this.selectTrash(libraryID);
	}
	else {
		Zotero.debug("Item was not selected; switching to library");
		await this.selectLibrary(libraryID);
	}
	
	await this.itemTreeView.waitForLoad();
	return this.itemTreeView.selectItems(itemIDs);
};


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
		if (treeRow.isCollection() || treeRow.isFeed()) {
			yield treeRow.ref.eraseTx({ deleteItems });
			if (treeRow.isFeed()) {
				refreshFeeds = true;
			}
		}
		else if (treeRow.isSearch()) {
			yield Zotero.Searches.erase(treeRow.ref.id);
		}
	}
	//this._treebox.endUpdateBatch();
});


Zotero.CollectionTreeView.prototype.selectAfterRowRemoval = function (row) {
	// If last row was selected, stay on the last row
	if (row >= this.rowCount) {
		row = this.rowCount - 1;
	};
	
	// Make sure the selection doesn't land on a separator (e.g. deleting last feed)
	while (row >= 0 && !this.isSelectable(row)) {
		// move up, since we got shifted down
		row--;
	}
	
	this.selection.select(row);
};


/**
 * Expand row based on last state
 */
Zotero.CollectionTreeView.prototype._expandRow = Zotero.Promise.coroutine(function* (rows, row, forceOpen) {
	var treeRow = rows[row];
	var level = rows[row].level;
	var isLibrary = treeRow.isLibrary(true);
	var isCollection = treeRow.isCollection();
	var libraryID = treeRow.ref.libraryID;
	
	if (treeRow.isPublications() || treeRow.isFeed()) {
		return false;
	}
	
	if (isLibrary) {
		var collections = Zotero.Collections.getByLibrary(libraryID);
	}
	else if (isCollection) {
		var collections = Zotero.Collections.getByParent(treeRow.ref.id);
	}
	
	if (isLibrary) {
		var savedSearches = yield Zotero.Searches.getAll(libraryID);
		// Virtual collections default to showing if not explicitly hidden
		var showDuplicates = this.hideSources.indexOf('duplicates') == -1
				&& this._virtualCollectionLibraries.duplicates[libraryID] !== false;
		var showUnfiled = this._virtualCollectionLibraries.unfiled[libraryID] !== false;
		var showRetracted = this._virtualCollectionLibraries.retracted[libraryID] !== false
			&& Zotero.Retractions.libraryHasRetractedItems(libraryID);
		var showPublications = libraryID == Zotero.Libraries.userLibraryID;
		var showTrash = this.hideSources.indexOf('trash') == -1;
	}
	else {
		var savedSearches = [];
		var showDuplicates = false;
		var showUnfiled = false;
		var showRetracted = false;
		var showPublications = false;
		var showTrash = false;
	}
	
	// If not a manual open and either the library is set to be collapsed or this is a collection that isn't explicitly opened,
	// set the initial state to closed
	if (!forceOpen &&
			(this._containerState[treeRow.id] === false
				|| (isCollection && !this._containerState[treeRow.id]))) {
		rows[row].isOpen = false;
		return 0;
	}
	
	var startOpen = !!(collections.length || savedSearches.length || showDuplicates || showUnfiled || showRetracted || showTrash);
	
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
			new Zotero.CollectionTreeRow(this, 'collection', collections[i], level + 1),
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
			new Zotero.CollectionTreeRow(this, 'search', savedSearches[i], level + 1),
			row + 1 + newRows
		);
		newRows++;
	}
	
	if (showPublications) {
		// Add "My Publications"
		this._addRowToArray(
			rows,
			new Zotero.CollectionTreeRow(this,
				'publications',
				{
					libraryID,
					treeViewID: "P" + libraryID
				},
				level + 1
			),
			row + 1 + newRows
		);
		newRows++
	}
	
	// Duplicate items
	if (showDuplicates) {
		let d = new Zotero.Duplicates(libraryID);
		this._addRowToArray(
			rows,
			new Zotero.CollectionTreeRow(this, 'duplicates', d, level + 1),
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
			new Zotero.CollectionTreeRow(this, 'unfiled', s, level + 1),
			row + 1 + newRows
		);
		newRows++;
	}
	
	// Retracted items
	if (showRetracted) {
		let s = new Zotero.Search;
		s.libraryID = libraryID;
		s.name = Zotero.getString('pane.collections.retracted');
		s.addCondition('libraryID', 'is', libraryID);
		s.addCondition('retracted', 'true');
		this._addRowToArray(
			rows,
			new Zotero.CollectionTreeRow(this, 'retracted', s, level + 1),
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
				new Zotero.CollectionTreeRow(this, 'trash', ref, level + 1),
				row + 1 + newRows
			);
			newRows++;
		}
		this._trashNotEmpty[libraryID] = !!deletedItems.length;
	}
	
	return newRows;
});


/**
 * Return libraryID of selected row (which could be a collection, etc.)
 */
Zotero.CollectionTreeView.prototype.getSelectedLibraryID = function() {
	if (!this.selection || !this.selection.count || this.selection.currentIndex == -1) return false;
	
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


/**
 * Persist the current open/closed state of rows to a pref
 */
Zotero.CollectionTreeView.prototype._saveOpenStates = Zotero.Promise.coroutine(function* () {
	var state = this._containerState;
	
	// Every so often, remove obsolete rows
	if (Math.random() < 1/20) {
		Zotero.debug("Purging sourceList.persist");
		for (var id in state) {
			var m = id.match(/^C([0-9]+)$/);
			if (m) {
				if (!(yield Zotero.Collections.getAsync(parseInt(m[1])))) {
					delete state[id];
				}
				continue;
			}
			
			var m = id.match(/^G([0-9]+)$/);
			if (m) {
				if (!Zotero.Groups.get(parseInt(m[1]))) {
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
		
		// Collections and feeds default to closed
		if ((!open && treeRow.isCollection()) || treeRow.isFeed()) {
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
	if (Zotero.isWin || Zotero.isLinux) {
		event.dataTransfer.effectAllowed = 'copyMove';
	}
	
	var treeRow = this.selectedTreeRow;
	if (!treeRow.isCollection()) {
		return;
	}
	event.dataTransfer.setData("zotero/collection", treeRow.ref.id);
	Zotero.debug("Dragging collection " + treeRow.id);
}


/**
 * Called by treechildren.onDragOver() before setting the dropEffect,
 * which is checked in libraryTreeView.canDrop()
 */
Zotero.CollectionTreeView.prototype.canDropCheck = function (row, orient, dataTransfer) {
	// TEMP
	Zotero.debug("Row is " + row + "; orient is " + orient);
	
	var dragData = Zotero.DragDrop.getDataFromDataTransfer(dataTransfer);
	if (!dragData) {
		Zotero.debug("No drag data");
		return false;
	}
	var dataType = dragData.dataType;
	var data = dragData.data;
	
	// Empty space below rows
	if (row == -1) {
		return false;
	}
	
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
		
		if (treeRow.isFeed()) {
			Zotero.debug("Cannot drop into feeds");
			return false;
		}
		
		if (dataType == 'zotero/item') {
			var ids = data;
			var items = Zotero.Items.get(ids);
			items = Zotero.Items.keepParents(items);
			var skip = true;
			for (let item of items) {
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
				
				if (treeRow.isPublications()) {
					if (item.isAttachment() || item.isNote()) {
						Zotero.debug("Top-level attachments and notes cannot be added to My Publications");
						return false;
					}
					if(item instanceof Zotero.FeedItem) {
						Zotero.debug("FeedItems cannot be added to My Publications");
						return false;
					}
					if (item.inPublications) {
						Zotero.debug("Item " + item.id + " already exists in My Publications");
						continue;
					}
					if (treeRow.ref.libraryID != item.libraryID) {
						Zotero.debug("Cross-library drag to My Publications not allowed");
						continue;
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
				if (draggedCollection.hasDescendent('collection', treeRow.ref.id)) {
					return false;
				}
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
				
				// Intra-library drags have already been vetted by canDrop(). This 'break' should be
				// changed to a 'continue' if any asynchronous checks that stop the drag are added above
				skip = false;
				break;
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
				if (yield draggedCollection.getLinkedCollection(treeRow.ref.libraryID, true)) {
					Zotero.debug("Linked collection already exists in library");
					return false;
				}
				
				let descendents = draggedCollection.getDescendents(false, 'collection');
				for (let descendent of descendents) {
					descendent = Zotero.Collections.get(descendent.id);
					// Disallow if linked collection already exists for any subcollections
					//
					// If this is allowed in the future for the root collection,
					// need to allow drag only to root
					if (yield descendent.getLinkedCollection(treeRow.ref.libraryID, true)) {
						Zotero.debug("Linked subcollection already exists in library");
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
		var targetLibraryType = Zotero.Libraries.get(targetLibraryID).libraryType;
		
		// Check if there's already a copy of this item in the library
		var linkedItem = yield item.getLinkedItem(targetLibraryID, true);
		if (linkedItem) {
			// If linked item is in the trash, undelete it and remove it from collections
			// (since it shouldn't be restored to previous collections)
			if (linkedItem.deleted) {
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
		var newItem = item.clone(targetLibraryID, { skipTags: !options.tags });
		
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
			var noteIDs = item.getNotes();
			var notes = Zotero.Items.get(noteIDs);
			for (let note of notes) {
				let newNote = note.clone(targetLibraryID, { skipTags: !options.tags });
				newNote.parentID = newItemID;
				yield newNote.save({
					skipSelect: true
				})
				
				yield newNote.addLinkedItem(note);
			}
		}
		
		// Child attachments
		if (options.childLinks || options.childFileAttachments) {
			var attachmentIDs = item.getAttachments();
			var attachments = Zotero.Items.get(attachmentIDs);
			for (let attachment of attachments) {
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
				var copyCollections = Zotero.Promise.coroutine(function* (descendents, parentID, addItems) {
					for (var desc of descendents) {
						// Collections
						if (desc.type == 'collection') {
							var c = yield Zotero.Collections.getAsync(desc.id);
							let newCollection = c.clone(targetLibraryID);
							if (parentID) {
								newCollection.parentID = parentID;
							}
							var collectionID = yield newCollection.save();
							
							// Record link
							yield c.addLinkedCollection(newCollection);
							
							// Recursively copy subcollections
							if (desc.children.length) {
								yield copyCollections(desc.children, collectionID, addItems);
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
								let parentItems = addItems.get(parentID);
								if (!parentItems) {
									parentItems = [];
									addItems.set(parentID, parentItems);
								}
								
								// If source item is a top-level non-regular item (which can exist in a
								// collection) but target item is a child item (which can't), add
								// target item's parent to collection instead
								if (!item.isRegularItem()) {
									let targetItem = yield Zotero.Items.getAsync(id);
									let targetItemParentID = targetItem.parentItemID;
									if (targetItemParentID) {
										id = targetItemParentID;
									}
								}
								
								parentItems.push(id);
							}
						}
					}
				});
				
				var collections = [{
					id: droppedCollection.id,
					children: droppedCollection.getDescendents(true),
					type: 'collection'
				}];
				
				var addItems = new Map();
				yield copyCollections(collections, targetCollectionID, addItems);
				for (let [collectionID, items] of addItems.entries()) {
					let collection = yield Zotero.Collections.getAsync(collectionID);
					yield collection.addItems(items);
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
		
		var items = yield Zotero.Items.getAsync(ids);
		if (items.length == 0) {
			return;
		}
		
		if (items[0] instanceof Zotero.FeedItem) {
			if (!(targetTreeRow.isCollection() || targetTreeRow.isLibrary() || targetTreeRow.isGroup())) {
				return;
			}
			
			let promises = [];
			for (let item of items) {
				// No transaction, because most time is spent traversing urls
				promises.push(item.translate(targetLibraryID, targetCollectionID))
			}
			return Zotero.Promise.all(promises);	
		}
		
		if (targetTreeRow.isPublications()) {
			items = Zotero.Items.keepParents(items);
			let io = this._treebox.treeBody.ownerDocument.defaultView
				.ZoteroPane.showPublicationsWizard(items);
			if (!io) {
				return;
			}
			copyOptions.childNotes = io.includeNotes;
			copyOptions.childFileAttachments = io.includeFiles;
			copyOptions.childLinks = true;
			['keepRights', 'license', 'licenseName'].forEach(function (field) {
				copyOptions[field] = io[field];
			});
		}
		
		let newItems = [];
		let newIDs = [];
		let toMove = [];
		// TODO: support items coming from different sources?
		let sameLibrary = items[0].libraryID == targetLibraryID
		
		for (let item of items) {
			if (!item.isTopLevelItem()) {
				continue;
			}
			
			newItems.push(item);
			
			if (sameLibrary) {
				newIDs.push(item.id);
				toMove.push(item.id);
			}
		}
		
		if (!sameLibrary) {
			let toReconcile = [];
			
			yield Zotero.Utilities.Internal.forEachChunkAsync(
				newItems,
				100,
				function (chunk) {
					return Zotero.DB.executeTransaction(async function () {
						for (let item of chunk) {
							var id = await copyItem(item, targetLibraryID, copyOptions)
							// Standalone attachments might not get copied
							if (!id) {
								continue;
							}
							newIDs.push(id);
						}
					});
				}
			);
			
			if (toReconcile.length) {
				let sourceName = Zotero.Libraries.getName(items[0].libraryID);
				let targetName = Zotero.Libraries.getName(targetLibraryID);
				
				let io = {
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
				
				let lastWin = Services.wm.getMostRecentWindow("navigator:browser");
				lastWin.openDialog('chrome://zotero/content/merge.xul', '', 'chrome,modal,centerscreen', io);
				
				yield Zotero.DB.executeTransaction(function* () {
					// DEBUG: This probably needs to be updated if this starts being used
					for (let obj of io.dataOut) {
						yield obj.ref.save();
					}
				});
			}
		}
		
		// Add items to target collection
		if (targetCollectionID) {
			let ids = newIDs.filter(itemID => Zotero.Items.get(itemID).isTopLevelItem());
			yield Zotero.DB.executeTransaction(function* () {
				let collection = yield Zotero.Collections.getAsync(targetCollectionID);
				yield collection.addItems(ids);
			}.bind(this));
		}
		else if (targetTreeRow.isPublications()) {
			yield Zotero.Items.addToPublications(newItems, copyOptions);
		}
		
		// If moving, remove items from source collection
		if (dropEffect == 'move' && toMove.length) {
			if (!sameLibrary) {
				throw new Error("Cannot move items between libraries");
			}
			if (!sourceTreeRow || !sourceTreeRow.isCollection()) {
				throw new Error("Drag source must be a collection for move action");
			}
			yield Zotero.DB.executeTransaction(function* () {
				yield sourceTreeRow.ref.removeItems(toMove);
			}.bind(this));
		}
	}
	else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
		var targetLibraryID = targetTreeRow.ref.libraryID;
		if (targetTreeRow.isCollection()) {
			var parentCollectionID = targetTreeRow.ref.id;
		}
		else {
			var parentCollectionID = false;
		}
		var addedItems = [];
		
		for (var i=0; i<data.length; i++) {
			var file = data[i];
			
			if (dataType == 'text/x-moz-url') {
				var url = data[i];
				let item;
				
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
					let win = Services.wm.getMostRecentWindow("navigator:browser");
					win.ZoteroPane.addItemFromURL(url, 'temporaryPDFHack', null, row); // TODO: don't do this
					continue;
				}
				
				// Otherwise file, so fall through
			}
			
			if (dropEffect == 'link') {
				item = yield Zotero.Attachments.linkFromFile({
					file: file,
					collections: parentCollectionID ? [parentCollectionID] : undefined
				});
			}
			else {
				item = yield Zotero.Attachments.importFromFile({
					file: file,
					libraryID: targetLibraryID,
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
			
			addedItems.push(item);
		}
		
		// Automatically retrieve metadata for PDFs
		Zotero.RecognizePDF.autoRecognizeItems(addedItems);
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
	else if (treeRow.ref && treeRow.ref.unreadCount) {
		props.push('unread');
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
		if (this.lastTempTable) {
			let tableName = this.lastTempTable;
			let id = Zotero.DB.addCallback('commit', async function () {
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS " + tableName);
				Zotero.DB.removeCallback('commit', id);
			});
		}
		this.lastTempTable = null;
		this.lastResults = null;
	}
};
