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
///  CollectionTreeView
///    -- handles the link between an individual tree and the data layer
///    -- displays only collections, in a hierarchy (no items)
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Constructor the the CollectionTreeView object
 */
Zotero.CollectionTreeView = function()
{
	this._treebox = null;
	this.itemToSelect = null;
	this._highlightedRows = {};
	this._unregisterID = Zotero.Notifier.registerObserver(this, ['collection', 'search']);
}

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
	
	this.refresh();
	
	//select Library
	this.selection.select(0);
}

/*
 *  Reload the rows from the data access methods
 *  (doesn't call the tree.invalidate methods, etc.)
 */
Zotero.CollectionTreeView.prototype.refresh = function()
{
	this.selection.clearSelection();
	var oldCount = this.rowCount;
	this._dataItems = [];
	this.rowCount = 0;
	this._showItem(new Zotero.ItemGroup('library',null),0,1);
	
	var newRows = Zotero.getCollections();
	for(var i = 0; i < newRows.length; i++)
		this._showItem(new Zotero.ItemGroup('collection',newRows[i]),  0, this._dataItems.length); //itemgroup ref, level, beforeRow
	
	var savedSearches = Zotero.Searches.getAll();
	if (savedSearches) {
		for (var i=0; i<savedSearches.length; i++) {
			this._showItem(new Zotero.ItemGroup('search',savedSearches[i]),  0, this._dataItems.length); //itemgroup ref, level, beforeRow
		}
	}
	
	this._refreshHashMap();
	
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
	var openCollections = [];
	
	for (var i=0; i<this.rowCount; i++) {
		if (this.isContainer(i) && this.isContainerOpen(i)) {
			openCollections.push(this._getItemAtRow(i).ref.getID());
		}
	}
	
	this._treebox.beginUpdateBatch();
	this.refresh();
	
	for(var i = 0; i < openCollections.length; i++)
	{
		var row = this._collectionRowMap[openCollections[i]];
		if (row != null) {
			this.toggleOpenState(row);
		}
	}
	this._treebox.invalidate();
	this._treebox.endUpdateBatch();
}

/*
 *  Called by Zotero.Notifier on any changes to collections in the data layer
 */
Zotero.CollectionTreeView.prototype.notify = function(action, type, ids)
{
	if (!ids || ids.length == 0) {
		return;
	}
	
	this.selection.selectEventsSuppressed = true;
	var savedSelection = this.saveSelection();
	
	var madeChanges = false;
	
	if(action == 'delete')
	{
		//Since a delete involves shifting of rows, we have to do it in order
		
		//sort the ids by row
		var rows = new Array();
		for (var i in ids)
		{
			switch (type)
			{
				case 'collection':
					if(this._collectionRowMap[ids[i]] != null)
					{
						rows.push(this._collectionRowMap[ids[i]]);
					}
					break;
				
				case 'search':
					if(this._searchRowMap[ids[i]] != null)
					{
						rows.push(this._searchRowMap[ids[i]]);
					}
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
	}
	else if(action == 'move')
	{
		for (var i=0; i<ids.length; i++) {
			// Open the parent collection if closed
			var collection = Zotero.Collections.get(ids[i]);
			var parentID = collection.getParent();
			if (parentID && !this.isContainerOpen(this._collectionRowMap[parentID])) {
				this.toggleOpenState(this._collectionRowMap[parentID]);
			}
		}
		
		this.reload();
		this.rememberSelection(savedSelection);
	}
	else if(action == 'modify')
	{
		this.reload();
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
				var collectionID = collection.getID();
				// Open container if creating subcollection
				var parentID = collection.getParent();
				if (parentID) {
					if (!this.isContainerOpen(this._collectionRowMap[parentID])){
						this.toggleOpenState(this._collectionRowMap[parentID]);
					}
				}
				
				this.reload();
				this.selection.select(this._collectionRowMap[collectionID]);
				break;
				
			case 'search':
				var search = Zotero.Searches.get(ids);
				this.reload();
				this.selection.select(this._searchRowMap[search.id]);
				break;
		}
	}
	
	this.selection.selectEventsSuppressed = false;
}


/*
 * Set the rows that should be highlighted -- actually highlighting is done
 * by getRowProperties based on the array set here
 */
Zotero.CollectionTreeView.prototype.setHighlightedRows = function (ids) {
	this._highlightedRows = {};
	this._treebox.invalidate();
	
	for each(var id in ids) {
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

Zotero.CollectionTreeView.prototype.isLibrary = function(row)
{
	return this._getItemAtRow(row).isLibrary();
}

Zotero.CollectionTreeView.prototype.isCollection = function(row)
{
	return this._getItemAtRow(row).isCollection();
}

Zotero.CollectionTreeView.prototype.isSearch = function(row)
{
	return this._getItemAtRow(row).isSearch();
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
	
	if(column.id == "zotero-collections-name-column")
		return obj.getName();
	else
		return "";
}

Zotero.CollectionTreeView.prototype.getImageSrc = function(row, col)
{
	var collectionType = this._getItemAtRow(row).type;
	return "chrome://zotero/skin/treesource-" + collectionType + ".png";
}

Zotero.CollectionTreeView.prototype.isContainer = function(row)
{
	return this._getItemAtRow(row).isCollection();
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
		var newRows = Zotero.getCollections(this._getItemAtRow(row).ref.getID()); //Get children
		
		for(var i = 0; i < newRows.length; i++)
		{
			count++;
			this._showItem(new Zotero.ItemGroup('collection',newRows[i]), thisLevel+1, row+i+1); //insert new row
		}
	}
	this._dataItems[row][1] = !this._dataItems[row][1];  //toggle container open value

	this._treebox.rowCountChanged(row+1, count); //tell treebox to repaint these
	this._treebox.invalidateRow(row);
	this._treebox.endUpdateBatch();	
	this._refreshHashMap();
}


Zotero.CollectionTreeView.prototype.expandAllRows = function(treebox) {
	var view = treebox.view;
	treebox.beginUpdateBatch();
	for (var i=0; i<view.rowCount; i++) {
		if (view.isContainer(i) && !view.isContainerOpen(i)) {
			view.toggleOpenState(i);
		}
	}
	treebox.endUpdateBatch();
}


Zotero.CollectionTreeView.prototype.collapseAllRows = function(treebox) {
	var view = treebox.view;
	treebox.beginUpdateBatch();
	for (var i=0; i<view.rowCount; i++) {
		if (view.isContainer(i) && view.isContainerOpen(i)) {
			view.toggleOpenState(i);
		}
	}
	treebox.endUpdateBatch();
}


////////////////////////////////////////////////////////////////////////////////
///
///  Additional functions for managing data in the tree
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Delete the selection
 */
Zotero.CollectionTreeView.prototype.deleteSelection = function()
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
		var group = this._getItemAtRow(rows[i]-i);
		if(group.isCollection())
		{
			group.ref.erase();
		}
		else if(group.isSearch())
		{
			Zotero.Searches.erase(group.ref['id']);
		}
	}
	this._treebox.endUpdateBatch();
	
	if(end.value < this.rowCount)
		this.selection.select(end.value);
	else
		this.selection.select(this.rowCount-1);
}

/*
 *  Called by various view functions to show a row
 * 
 *  	itemGroup:	reference to the ItemGroup
 *  	level:	the indent level of the row
 *      beforeRow:	row index to insert new row before
 */
Zotero.CollectionTreeView.prototype._showItem = function(itemGroup, level, beforeRow)
{
	this._dataItems.splice(beforeRow, 0, [itemGroup, false, level]);
	this.rowCount++;
}

/*
 *  Called by view to hide specified row
 */
Zotero.CollectionTreeView.prototype._hideItem = function(row)
{
	this._dataItems.splice(row,1); this.rowCount--;
}

/*
 *  Returns a reference to the collection at row (see Zotero.Collection in data_access.js)
 */
Zotero.CollectionTreeView.prototype._getItemAtRow = function(row)
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
			if (this._getItemAtRow(i).isLibrary()) {
				return 'L';
			}
			else if (this._getItemAtRow(i).isCollection()) {
				return 'C' + this._getItemAtRow(i).ref.getID();
			}
			else if (this._getItemAtRow(i).isSearch()) {
				return 'S' + this._getItemAtRow(i).ref.id;
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
	var id = selection.substr(1);
	switch (selection.substr(0, 1)) {
		// Library
		case 'L':
			this.selection.select(0);
			break;
		
		// Collection
		case 'C':
			// This only selects the collection if it's still visible,
			// so we open the parent in notify()
			if (this._collectionRowMap[id] != undefined) {
				this.selection.select(this._collectionRowMap[id]);
			}
			break;
		
		// Saved search
		case 'S':
			if (this._searchRowMap[id] != undefined) {
				this.selection.select(this._searchRowMap[id]);
			}
			break;
	}
}



/*
 * Creates hash map of collection and search ids to row indexes
 * e.g., var rowForID = this._collectionRowMap[]
 */
Zotero.CollectionTreeView.prototype._refreshHashMap = function()
{	
	this._collectionRowMap = [];
	this._searchRowMap = [];
	for(var i=0; i < this.rowCount; i++){
		if (this.isCollection(i)){
			this._collectionRowMap[this._getItemAtRow(i).ref.getID()] = i;
		}
		else if (this.isSearch(i)){
			this._searchRowMap[this._getItemAtRow(i).ref.id] = i;
		}
	}
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
///		onDragStart(), getSupportedFlavours(), and onDrop() for nsDragAndDrop.js + nsTransferable.js
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Called while a drag is over the tree.
 */
Zotero.CollectionTreeView.prototype.canDrop = function(row, orient)
{
	// workaround... two different services call canDrop
	// (nsDragAndDrop, and the tree) -- this is for the former,
	// used when dragging between windows
	if (typeof row == 'object') {
		return false;
	}
	
	//Zotero.debug('Row is ' + row);
	//Zotero.debug('Orient is ' + orient);
	
	try
	{
		var dataSet = nsTransferable.get(this.getSupportedFlavours(),nsDragAndDrop.getDragData, true);
	}
	catch (e)
	{
		//a work around a limitation in nsDragAndDrop.js -- the mDragSession is not set until the drag moves over another control.
		//(this will only happen if the first drag is from the collection list)
		nsDragAndDrop.mDragSession = nsDragAndDrop.mDragService.getCurrentSession();
		return false;
	}
	
	var data = dataSet.first.first;
	var dataType = data.flavour.contentType;
	
	// For dropping collections onto root level
	if (orient == 1 && row == 0 && dataType == 'zotero/collection') {
		return true;
	}
	else if(orient == 0)	//directly on a row...
	{
		var rowCollection = this._getItemAtRow(row).ref; //the collection we are dragging over
		
		if (dataType == 'zotero/item') {
			var ids = data.data.split(',');
			for each(var id in ids)
			{
				var item = Zotero.Items.get(id);
				// Can only drag top-level items into collections
				if (item.isRegularItem() || !item.getSource())
				{
					// Make sure there's at least one item that's not already
					// in this collection
					if (!rowCollection.hasItem(id))
					{
						return true;
					}
				}
			}
			return false;
		}
		else if (dataType == 'text/x-moz-url'
				|| dataType == 'application/x-moz-file') {
			if (this._getItemAtRow(row).isSearch()) {
				return false;
			}
			// Don't allow folder drag
			if (dataType == 'application/x-moz-file' && data.data.isDirectory()) {
				return false;
			}
			return true;
		}
		else if (dataType == 'zotero/collection'
				&& data.data != rowCollection.getID()
				&& !Zotero.Collections.get(data.data).hasDescendent('collection', rowCollection.getID())) {
			return true;//collections cannot be dropped on themselves, nor in their children
		}
	}
	return false;
}

/*
 *  Called when something's been dropped on or next to a row
 */
Zotero.CollectionTreeView.prototype.drop = function(row, orient)
{
	var dataSet = nsTransferable.get(this.getSupportedFlavours(),nsDragAndDrop.getDragData, true);
	var data = dataSet.first.first;
	var dataType = data.flavour.contentType;
	
	if (!this.canDrop(row, orient)) {
		return false;
	}
	
	if(dataType == 'zotero/collection')
	{
		var targetCollectionID;
		if(this._getItemAtRow(row).isCollection())
			targetCollectionID = this._getItemAtRow(row).ref.getID();
		var droppedCollection = Zotero.Collections.get(data.data);
		droppedCollection.changeParent(targetCollectionID);
	}
	else if (dataType == 'zotero/item') {
		var ids = data.data.split(',');
		if (ids.length < 1) {
			return;
		}
		
		var toAdd = [];
		for (var i=0; i<ids.length; i++) {
			var item = Zotero.Items.get(ids[i]);
			// Only accept top-level items
			if (item.isRegularItem() || !item.getSource()) {
				toAdd.push(ids[i]);
			}
		}
		
		if (toAdd.length > 0) {
			this._getItemAtRow(row).ref.addItems(toAdd);
		}
	}
	else if (dataType == 'text/x-moz-url' || dataType == 'application/x-moz-file') {
		if (this._getItemAtRow(row).isCollection()) {
			var parentCollectionID = this._getItemAtRow(row).ref.getID();
		}
		else {
			var parentCollectionID = false;
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
						Zotero.Attachments.importFromURL(url, false, false, false, parentCollectionID);
						continue;
					}
					
					// Otherwise file, so fall through
				}
				
				try {
					Zotero.DB.beginTransaction();
					var itemID = Zotero.Attachments.importFromFile(file, false);
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
 *  Begin a drag
 */
Zotero.CollectionTreeView.prototype.onDragStart = function(evt,transferData,action)
{
	transferData.data=new TransferData();
	
	//attach ID
	transferData.data.addDataForFlavour("zotero/collection",this._getItemAtRow(this.selection.currentIndex).ref.getID());
}

/*
 *  Returns the supported drag flavors
 */
Zotero.CollectionTreeView.prototype.getSupportedFlavours = function () 
{ 
	var flavors = new FlavourSet();
	flavors.appendFlavour("zotero/collection");
	flavors.appendFlavour("zotero/item");
	flavors.appendFlavour("text/x-moz-url");
	flavors.appendFlavour("application/x-moz-file", "nsIFile");
	return flavors; 
}

/*
 *  Called by nsDragAndDrop.js for any sort of drop on the tree
 */
Zotero.CollectionTreeView.prototype.onDrop = function (evt,dropdata,session) { }

////////////////////////////////////////////////////////////////////////////////
///
///  Functions for nsITreeView that we have to stub out.
///
////////////////////////////////////////////////////////////////////////////////

Zotero.CollectionTreeView.prototype.isSorted = function() 							{ return false; }
Zotero.CollectionTreeView.prototype.isSeparator = function(row) 					{ return false; }
Zotero.CollectionTreeView.prototype.isEditable = function(row, idx) 				{ return false; }

/* Set 'highlighted' property on rows set by setHighlightedRows */
Zotero.CollectionTreeView.prototype.getRowProperties = function(row, props) {
	if (this._highlightedRows[row]) {
		var aServ = Components.classes["@mozilla.org/atom-service;1"].
			getService(Components.interfaces.nsIAtomService);
		props.AppendElement(aServ.getAtom("highlighted"));
	}
}

Zotero.CollectionTreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Zotero.CollectionTreeView.prototype.getCellProperties = function(row, col, prop) 	{ }
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

Zotero.ItemGroup = function(type, ref)
{
	this.type = type;
	this.ref = ref;
}

Zotero.ItemGroup.prototype.isLibrary = function()
{
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

Zotero.ItemGroup.prototype.getName = function()
{
	if(this.isCollection())
		return this.ref.getName();
	else if(this.isLibrary())
		return Zotero.getString('pane.collections.library');
	else if(this.isSearch())
		return this.ref['name'];
	else
		return "";
}

Zotero.ItemGroup.prototype.getChildItems = function()
{
	var s = this.getSearchObject();
	try {
		var ids = s.search();
	}
	catch (e) {
		if (e.match(/Saved search [0-9]+ does not exist/)) {
			Zotero.DB.rollbackTransaction();
			Zotero.debug(e, 2);
			return false;
		}
		else {
			throw (e);
		}
	}
	return Zotero.Items.get(ids);
}


/*
 * Returns the search object for the currently display
 *
 * This accounts for the collection, saved search, quicksearch, tags, etc.
 */
Zotero.ItemGroup.prototype.getSearchObject = function() {
	var includeScopeChildren = false;
	
	// Create/load the inner search
	var s = new Zotero.Search();
	if (this.isLibrary()) {
		s.addCondition('noChildren', 'true');
		includeScopeChildren = true;
	}
	else if (this.isCollection()) {
		s.addCondition('noChildren', 'true');
		s.addCondition('collectionID', 'is', this.ref.getID());
		if (Zotero.Prefs.get('recursiveCollections')) {
			s.addCondition('recursive', 'true');
		}
		includeScopeChildren = true;
	}
	else if (this.isSearch()){
		s.load(this.ref['id']);
	}
	else {
		throw ('Invalid search mode in Zotero.ItemGroup.getSearchObject()');
	}
	
	// Create the outer (filter) search
	var s2 = new Zotero.Search();
	s2.setScope(s, includeScopeChildren);
	
	if (this.searchText) {
		s2.addCondition('quicksearch', 'contains', this.searchText);
	}
	
	if (this.tags){
		for (var tag in this.tags){
			if (this.tags[tag]){
				s2.addCondition('tag', 'is', tag);
			}
		}
	}
	
	return s2;
}


/*
 * Returns all the tags used by items in the current view
 */
Zotero.ItemGroup.prototype.getChildTags = function() {
	var s = this.getSearchObject();
	return Zotero.Tags.getAllWithinSearch(s);
}


Zotero.ItemGroup.prototype.setSearch = function(searchText)
{
	this.searchText = searchText;
}

Zotero.ItemGroup.prototype.setTags = function(tags)
{
	this.tags = tags;
}

/*
 * Returns TRUE if saved search, quicksearch or tag filter
 */
Zotero.ItemGroup.prototype.isSearchMode = function() {
	// Search
	if (this.isSearch()) {
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