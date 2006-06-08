Scholar.CollectionTreeView = function()
{
	this._treebox = null;
	this._unregisterID = Scholar.Notifier.registerColumnTree(this);
	this.refresh();
}

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
 *  Unregisters itself from Scholar.Notifier (called on window close)
 */
Scholar.CollectionTreeView.prototype.unregister = function()
{
	Scholar.Notifier.unregisterColumnTree(this._unregisterID);
}

/*
 *  Is called by Scholar.Notifier on any changes to the data layer
 */
Scholar.CollectionTreeView.prototype.notify = function(action, type, ids)
{
	ids = Scholar.flattenArguments(ids);
	var madeChanges = false;
	
	if(action == 'remove')
	{
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
	else
	{
		for (var i=0, len=ids.length; i<len; i++)
		{
		
			var row = this._collectionRowMap[ids[i]];
			if(action == 'modify' && row != null) 	//must check for null because it could legitimately be 0
			{
				this._treebox.invalidateRow(row)
			}
			else if(action == 'add' && row == null)
			{
				var item = Scholar.Collections.get(ids[i]);
				
				this._showItem(new Scholar.ItemGroup('collection',item), 0, this.rowCount);
				this._treebox.rowCountChanged(this.rowCount-1,1);
			
				madeChanges = true;
			}
			
		}
	}
	
	if(madeChanges)
		this._refreshHashMap();
}

Scholar.CollectionTreeView.prototype.setTree = function(treebox)
{
	if(this._treebox)
		return;
	this._treebox = treebox;
}

Scholar.CollectionTreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getItemAtRow(row);
	
	if(column.id == "name_column")
		return obj.getName();
	else
		return "";
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
	var itemGroup = this._getItemAtRow(row);
	if(itemGroup.isCollection())
		return !itemGroup.ref.hasChildCollections();
	else
		return true;
}

Scholar.CollectionTreeView.prototype.getLevel = function(row) 		{ return this._dataItems[row][2]; }

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

Scholar.CollectionTreeView.prototype._showItem = function(item, level, beforeRow) 	{ this._dataItems.splice(beforeRow, 0, [item, false, level]); this.rowCount++; }

Scholar.CollectionTreeView.prototype._hideItem = function(row) 						{ this._dataItems.splice(row,1); this.rowCount--; }

Scholar.CollectionTreeView.prototype._getItemAtRow = function(row)					{ return this._dataItems[row][0]; }
Scholar.CollectionTreeView.prototype.isSorted = function() 							{ return false; }
Scholar.CollectionTreeView.prototype.isSeparator = function(row) 						{ return false; }
Scholar.CollectionTreeView.prototype.isEditable = function(row, idx) 					{ return false; }
Scholar.CollectionTreeView.prototype.getRowProperties = function(row, prop) 			{ }
Scholar.CollectionTreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Scholar.CollectionTreeView.prototype.getCellProperties = function(row, col, prop) 	{ }
Scholar.CollectionTreeView.prototype.getImageSrc = function(row, col) 				{ }
Scholar.CollectionTreeView.prototype.performAction = function(action) 				{ }
Scholar.CollectionTreeView.prototype.performActionOnCell = function(action, row, col)	{ }
Scholar.CollectionTreeView.prototype.getProgressMode = function(row, col) 			{ }
Scholar.CollectionTreeView.prototype.cycleHeader = function(column)					{ }

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

Scholar.CollectionTreeView.prototype._refreshHashMap = function()
{	
	// Create hash map of collection and object ids to row indexes
	
	this._collectionRowMap = new Array();
	for(var i=0; i < this.rowCount; i++){
		if (this.isContainer(i)){
			this._collectionRowMap[this._getItemAtRow(i).ref.getID()] = i;
		}
	}
	//Scholar.debug(Scholar.varDump(this.collectionRowMap));
	//Scholar.debug(Scholar.varDump(this.objectRowMap));
}

Scholar.CollectionTreeView.prototype.canDrop = function(row, orient)
{
	if(orient == 0 && this._getItemAtRow(row).isCollection())
	{
		Scholar.debug("drag on row: " + row + "      orient: " + orient);
		return true;
	}
	else
		return false;
}

Scholar.CollectionTreeView.prototype.drop = function(row, orient)
{
	var dataSet = nsTransferable.get(this.getSupportedFlavours(),nsDragAndDrop.getDragData, true);
	var data = dataSet.first.first;
	var dataType = data.flavour.contentType;
	var ids = data.data.split(',');
	
	if(dataType == 'scholar/collection')
	{
		var oldCount = this.rowCount;
		
		var targetCollectionID;
		if(this.canDrop(row,orient))
			targetCollectionID = this._getItemAtRow(row).ref.getID();
			
		var droppedCollection = Scholar.Collections.get(ids[0]);
		droppedCollection.changeParent(targetCollectionID);
		this.refresh();
		this._treebox.rowCountChanged(0,this.rowCount-oldCount);
		this._treebox.invalidate();
	}
	else if(dataType == 'scholar/item' && this.canDrop(row, orient))
	{
		var targetCollection = this._getItemAtRow(row).ref;
		for(var i = 0; i<ids.length; i++)
			targetCollection.addItem(ids[i]);
	}
}

Scholar.CollectionTreeView.prototype.onDragStart = function(evt,transferData,action)
{
	transferData.data=new TransferData();
	transferData.data.addDataForFlavour("scholar/collection",this._getItemAtRow(this.selection.currentIndex).ref.getID());
}

Scholar.CollectionTreeView.prototype.getSupportedFlavours = function () 
{ 
	var flavors = new FlavourSet();
	flavors.appendFlavour("scholar/item");
	flavors.appendFlavour("scholar/collection");
	return flavors; 
}

Scholar.CollectionTreeView.prototype.onDragOver = function (evt,dropdata,session) { }
Scholar.CollectionTreeView.prototype.onDrop = function (evt,dropdata,session) { }

//
// SCHOLAR ITEMGROUP
//
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