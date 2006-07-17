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
Scholar.CollectionTreeView = function()
{
	this._treebox = null;
	this.refresh();
	
	this._unregisterID = Scholar.Notifier.registerColumnTree(this);
}

/*
 *  Called by the tree itself
 */
Scholar.CollectionTreeView.prototype.setTree = function(treebox)
{
	if(this._treebox)
		return;
	this._treebox = treebox;
	//select Library
	this.selection.select(0);
}

/*
 *  Reload the rows from the data access methods
 *  (doesn't call the tree.invalidate methods, etc.)
 */
Scholar.CollectionTreeView.prototype.refresh = function()
{
	this._dataItems = new Array();
	this.rowCount = 0;
	this._showItem(new Scholar.ItemGroup('library',null),0,1);
	
	var newRows = Scholar.getCollections();
	for(var i = 0; i < newRows.length; i++)
		this._showItem(new Scholar.ItemGroup('collection',newRows[i]),  0, this._dataItems.length); //item ref, level, beforeRow
		
	this._refreshHashMap();
}

/*
 *  Called by Scholar.Notifier on any changes to collections in the data layer
 */
Scholar.CollectionTreeView.prototype.notify = function(action, type, ids)
{
	var madeChanges = false;
	
	if(action == 'remove')
	{
		ids = Scholar.flattenArguments(ids);
		//Since a remove involves shifting of rows, we have to do it in order
		
		//sort the ids by row
		var rows = new Array();
		for(var i=0, len=ids.length; i<len; i++)
			if(this._collectionRowMap[ids[i]] != null)
				rows.push(this._collectionRowMap[ids[i]]);
		
		if(rows.length > 0)
		{
			rows.sort(function(a,b) { return a-b });
			
			for(var i=0, len=rows.length; i<len; i++)
			{
				var row = rows[i];
				this._hideItem(row-i);
				this._treebox.rowCountChanged(row-i,-1);
			}
			
			madeChanges = true;
		}		
		
	}
	else if(action == 'move')
	{
		var openCollections = new Array();
		
		for(var i = 0; i < this.rowCount; i++)
			if(this.isContainer(i) && this.isContainerOpen(i))
				openCollections.push(this._getItemAtRow(i).ref.getID());
		
		var oldCount = this.rowCount;
		this._treebox.beginUpdateBatch();
		this.refresh();
		this._treebox.rowCountChanged(0,this.rowCount - oldCount);
		
		for(var i = 0; i < openCollections.length; i++)
		{
			var row = this._collectionRowMap[openCollections[i]];
			if(row != null)
				this.toggleOpenState(row);
		}
		this._treebox.invalidate();
		this._treebox.endUpdateBatch();
	}
	else if(action == 'modify')
	{
		var row = this._collectionRowMap[ids];
		if(row != null)
			this._treebox.invalidateRow(row);
	}
	else if(action == 'add')
	{
		var item = Scholar.Collections.get(ids);
		
		this._showItem(new Scholar.ItemGroup('collection',item), 0, this.rowCount);
		this._treebox.rowCountChanged(this.rowCount-1,1);
	
		madeChanges = true;
	}
	
	if(madeChanges)
		this._refreshHashMap();
}

/*
 *  Unregisters view from Scholar.Notifier (called on window close)
 */
Scholar.CollectionTreeView.prototype.unregister = function()
{
	Scholar.Notifier.unregisterColumnTree(this._unregisterID);
}

////////////////////////////////////////////////////////////////////////////////
///
///  nsITreeView functions
///  http://www.xulplanet.com/references/xpcomref/ifaces/nsITreeView.html
///
////////////////////////////////////////////////////////////////////////////////

Scholar.CollectionTreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getItemAtRow(row);
	
	if(column.id == "name_column")
		return obj.getName();
	else
		return "";
}

Scholar.CollectionTreeView.prototype.getImageSrc = function(row, col)
{
	var collectionType = this._getItemAtRow(row).type;
	return "chrome://scholar/skin/treesource-" + collectionType + ".png";
}

Scholar.CollectionTreeView.prototype.isContainer = function(row)
{
	return this._getItemAtRow(row).isCollection();
}

Scholar.CollectionTreeView.prototype.isContainerOpen = function(row)
{
	return this._dataItems[row][1];
}

Scholar.CollectionTreeView.prototype.isContainerEmpty = function(row)
{
	//NOTE: this returns true if the collection has no child collections
	
	var itemGroup = this._getItemAtRow(row);
	if(itemGroup.isCollection())
		return !itemGroup.ref.hasChildCollections();
	else
		return true;
}

Scholar.CollectionTreeView.prototype.getLevel = function(row)
{
	return this._dataItems[row][2];
}

Scholar.CollectionTreeView.prototype.getParentIndex = function(row)
{
	var thisLevel = this.getLevel(row);
	if(thisLevel == 0) return -1;
	for(var i = row - 1; i >= 0; i--)
		if(this.getLevel(i) < thisLevel)
			return i;
	return -1;
}

Scholar.CollectionTreeView.prototype.hasNextSibling = function(row, afterIndex)
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
Scholar.CollectionTreeView.prototype.toggleOpenState = function(row)
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
		var newRows = Scholar.getCollections(this._getItemAtRow(row).ref.getID()); //Get children
		
		for(var i = 0; i < newRows.length; i++)
		{
			count++;
			this._showItem(new Scholar.ItemGroup('collection',newRows[i]), thisLevel+1, row+i+1); //insert new row
		}
	}
	this._dataItems[row][1] = !this._dataItems[row][1];  //toggle container open value

	this._treebox.rowCountChanged(row+1, count); //tell treebox to repaint these
	this._treebox.invalidateRow(row);
	this._treebox.endUpdateBatch();	
	this._refreshHashMap();
}

////////////////////////////////////////////////////////////////////////////////
///
///  Additional functions for managing data in the tree
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Delete the selection
 */
Scholar.CollectionTreeView.prototype.deleteSelection = function()
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
		this._getItemAtRow(rows[i]-i).ref.erase();
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
Scholar.CollectionTreeView.prototype._showItem = function(itemGroup, level, beforeRow)
{
	this._dataItems.splice(beforeRow, 0, [itemGroup, false, level]); this.rowCount++;
}

/*
 *  Called by view to hide specified row
 */
Scholar.CollectionTreeView.prototype._hideItem = function(row)
{
	this._dataItems.splice(row,1); this.rowCount--;
}

/*
 *  Returns a reference to the collection at row (see Scholar.Collection in data_access.js)
 */
Scholar.CollectionTreeView.prototype._getItemAtRow = function(row)
{
	return this._dataItems[row][0];
}

/*
 * Creates hash map of collection ids to row indexes
 * e.g., var rowForID = this._collectionRowMap[]
 */
Scholar.CollectionTreeView.prototype._refreshHashMap = function()
{	
	this._collectionRowMap = new Array();
	for(var i=0; i < this.rowCount; i++)
		if (this.isContainer(i))
			this._collectionRowMap[this._getItemAtRow(i).ref.getID()] = i;
		
	
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
Scholar.CollectionTreeView.prototype.canDrop = function(row, orient)
{
	if(typeof row == 'object')	//workaround... two different services call canDrop (nsDragAndDrop, and the tree)
		return false;
		
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
	
	
	//Highlight the rows correctly on drag:
	if(orient == 1 && row == 0 && dataType == 'scholar/collection') //for dropping collections into root level
	{
		return true;
	}
	else if(orient == 0)	//directly on a row...
	{
		var rowCollection = this._getItemAtRow(row).ref; //the collection we are dragging over
		
		if(dataType == 'scholar/item' || dataType == "text/x-moz-url")
			return true;	//items can be dropped on anything
		else if(dataType='scholar/collection' && data.data != rowCollection.getID() && !Scholar.Collections.get(data.data).hasDescendent('collection',rowCollection.getID()) )
			return true;	//collections cannot be dropped on themselves, nor in their children
	}
	return false;
}

/*
 *  Called when something's been dropped on or next to a row
 */
Scholar.CollectionTreeView.prototype.drop = function(row, orient)
{
	var dataSet = nsTransferable.get(this.getSupportedFlavours(),nsDragAndDrop.getDragData, true);
	var data = dataSet.first.first;
	var dataType = data.flavour.contentType;
	
	if(dataType == 'scholar/collection')
	{
		var oldCount = this.rowCount;
		
		var targetCollectionID;
		if(this._getItemAtRow(row).isCollection())
			targetCollectionID = this._getItemAtRow(row).ref.getID();
		var droppedCollection = Scholar.Collections.get(data.data);
		droppedCollection.changeParent(targetCollectionID);
		
		var selectRow = this._collectionRowMap[data.data];
		if(selectRow == null)
			selectRow = this._collectionRowMap[targetCollectionID];
		
		this.selection.selectEventsSuppressed = true;
		this.selection.clearSelection();
		this.selection.select(selectRow);
		this.selection.selectEventsSuppressed = false;
			
	}
	else if(dataType == 'scholar/item' && this.canDrop(row, orient))
	{
		var ids = data.data.split(',');
		var targetCollection = this._getItemAtRow(row).ref;
		for(var i = 0; i<ids.length; i++)
			targetCollection.addItem(ids[i]);
	}
	else if(dataType == 'text/x-moz-url' && this.canDrop(row, orient))
	{
		var url = data.data.split("\n")[0];
		
		/* WAITING FOR INGESTER SUPPORT
		var newItem = Scholar.Ingester.scrapeURL(url);
		
		if(newItem)
			this._getItemAtRow(row).ref.addItem(newItem.getID());
		*/
	}
}

/*
 *  Begin a drag
 */
Scholar.CollectionTreeView.prototype.onDragStart = function(evt,transferData,action)
{
	transferData.data=new TransferData();
	
	//attach ID
	transferData.data.addDataForFlavour("scholar/collection",this._getItemAtRow(this.selection.currentIndex).ref.getID());
}

/*
 *  Returns the supported drag flavors
 */
Scholar.CollectionTreeView.prototype.getSupportedFlavours = function () 
{ 
	var flavors = new FlavourSet();
	flavors.appendFlavour("text/x-moz-url");
	flavors.appendFlavour("scholar/item");
	flavors.appendFlavour("scholar/collection");
	return flavors; 
}

/*
 *  Called by nsDragAndDrop.js for any sort of drop on the tree
 */
Scholar.CollectionTreeView.prototype.onDrop = function (evt,dropdata,session) { }

////////////////////////////////////////////////////////////////////////////////
///
///  Functions for nsITreeView that we have to stub out.
///
////////////////////////////////////////////////////////////////////////////////

Scholar.CollectionTreeView.prototype.isSorted = function() 							{ return false; }
Scholar.CollectionTreeView.prototype.isSeparator = function(row) 					{ return false; }
Scholar.CollectionTreeView.prototype.isEditable = function(row, idx) 				{ return false; }
Scholar.CollectionTreeView.prototype.getRowProperties = function(row, prop) 		{ }
Scholar.CollectionTreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Scholar.CollectionTreeView.prototype.getCellProperties = function(row, col, prop) 	{ }
Scholar.CollectionTreeView.prototype.performAction = function(action) 				{ }
Scholar.CollectionTreeView.prototype.performActionOnCell = function(action, row, col)	{ }
Scholar.CollectionTreeView.prototype.getProgressMode = function(row, col) 			{ }
Scholar.CollectionTreeView.prototype.cycleHeader = function(column)					{ }

////////////////////////////////////////////////////////////////////////////////
///
///  Scholar ItemGroup -- a sort of "super class" for Collection, library, 
///  	and eventually smartSearch
///
////////////////////////////////////////////////////////////////////////////////

Scholar.ItemGroup = function(type, ref)
{
	this.type = type;
	this.ref = ref;
}

Scholar.ItemGroup.prototype.isLibrary = function()
{
	return this.type == 'library';
}

Scholar.ItemGroup.prototype.isCollection = function()
{
	return this.type == 'collection';
}

Scholar.ItemGroup.prototype.getName = function()
{
	if(this.isCollection())
		return this.ref.getName();
	else if(this.isLibrary())
		return Scholar.getString('pane.collections.library');
	else
		return "";
}

Scholar.ItemGroup.prototype.getChildItems = function()
{
	if(this.searchText)
	{
		return Scholar.Items.get(Scholar.Items.search(this.searchText,(this.isCollection() ? this.ref.getID() : null)));
	}
	else
	{
		if(this.isCollection())
			return Scholar.getItems(this.ref.getID());
		else if(this.isLibrary())
			return Scholar.getItems();
		else
			return null;
	}
}

Scholar.ItemGroup.prototype.setSearch = function(searchText)
{
	this.searchText = searchText;
}