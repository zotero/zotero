Scholar.FolderTreeView = function()
{
	this._treebox = null;
	this._dataItems = new Array();
	this.rowCount = 0;
	this._showItem(new Scholar.ItemGroup('library',null),0,1);
	this._unregisterID = Scholar.Notifier.registerColumnTree(this);
}

Scholar.FolderTreeView.prototype.unregister = function()
{
	Scholar.Notifier.unregisterColumnTree(this._unregisterID);
}

//CALLED BY DATA LAYER ON CHANGE:
Scholar.FolderTreeView.prototype.notify = function(action, type, ids)
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
				var item = Scholar.Items.get(ids[i]);
				
				this._showItem(item,this.rowCount);
				this._treebox.rowCountChanged(this.rowCount,1);
			
				madeChanges = true;
			}
			
		}
	}
	
	if(madeChanges)
		this._refreshHashMap();
}

Scholar.FolderTreeView.prototype.setTree = function(treebox)
{
	if(this._treebox)
		return;
	this._treebox = treebox;
	
	var newRows = Scholar.getCollections();
	for(var i = 0; i < newRows.length; i++)
		this._showItem(new Scholar.ItemGroup('collection',newRows[i]),  0, this._dataItems.length); //item ref, level, beforeRow
		
	this._refreshHashMap();
}

Scholar.FolderTreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getItemAtRow(row);
	
	if(column.id == "name_column")
		return obj.getName();
	else
		return "";
}

Scholar.FolderTreeView.prototype.isContainer = function(row)
{
	return this._getItemAtRow(row).isCollection();
}

Scholar.FolderTreeView.prototype.isContainerOpen = function(row)
{
	return this._dataItems[row][1];
}

Scholar.FolderTreeView.prototype.isContainerEmpty = function(row)
{
	var itemGroup = this._getItemAtRow(row);
	if(itemGroup.isCollection())
		return !itemGroup.ref.hasChildCollections();
	else
		return true;
}

Scholar.FolderTreeView.prototype.getLevel = function(row) 		{ return this._dataItems[row][2]; }

Scholar.FolderTreeView.prototype.getParentIndex = function(row)
{
	var thisLevel = this.getLevel(row);
	if(thisLevel == 0) return -1;
	for(var i = row - 1; i >= 0; i--)
		if(this.getLevel(i) < thisLevel)
			return i;
	return -1;
}

Scholar.FolderTreeView.prototype.hasNextSibling = function(row, afterIndex)
{
	var thisLevel = this.getLevel(row);
	for(var i = afterIndex + 1; i < this.rowCount; i++)
	{	
		var nextLevel = this.getLevel(i);
		if(nextLevel == thisLevel) return true;
		else if(nextLevel < thisLevel) return false;
	}
}

Scholar.FolderTreeView.prototype.toggleOpenState = function(row)
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

Scholar.FolderTreeView.prototype._showItem = function(item, level, beforeRow) 	{ this._dataItems.splice(beforeRow, 0, [item, false, level]); this.rowCount++; }

Scholar.FolderTreeView.prototype._hideItem = function(row) 						{ this._dataItems.splice(row,1); this.rowCount--; }

Scholar.FolderTreeView.prototype._getItemAtRow = function(row)					{ return this._dataItems[row][0]; }
Scholar.FolderTreeView.prototype.isSorted = function() 							{ return false; }
Scholar.FolderTreeView.prototype.isSeparator = function(row) 						{ return false; }
Scholar.FolderTreeView.prototype.isEditable = function(row, idx) 					{ return false; }
Scholar.FolderTreeView.prototype.getRowProperties = function(row, prop) 			{ }
Scholar.FolderTreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Scholar.FolderTreeView.prototype.getCellProperties = function(row, col, prop) 	{ }
Scholar.FolderTreeView.prototype.getImageSrc = function(row, col) 				{ }
Scholar.FolderTreeView.prototype.performAction = function(action) 				{ }
Scholar.FolderTreeView.prototype.performActionOnCell = function(action, row, col)	{ }
Scholar.FolderTreeView.prototype.getProgressMode = function(row, col) 			{ }

Scholar.FolderTreeView.prototype.deleteSelection = function()
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
		//erase item/collection from DB:
		this._getItemAtRow(rows[i]-i).ref.erase();

		/* Disabled for now because notifier handles it this:
		//remove row from tree:
		this._hideItem(rows[i]-i);
		this._treebox.rowCountChanged(rows[i]-i, -1);*/
	}
	this._treebox.endUpdateBatch();
	
	this._refreshHashMap();
	
}

Scholar.FolderTreeView.prototype._refreshHashMap = function()
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

Scholar.FolderTreeView.prototype.canDrop = function(row, orient)
{
	if(orient == this.DROP_ON && this._getItemAtRow(row).isCollection())
		return true;
	else
		return false;
		
}

Scholar.FolderTreeView.prototype.drop = function(row, orient)
{
	//you can't really do anything here, look to overlay.js - ScholarCollectionsDragObserver
}

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
		return "Library";
	else
		return "";
}

Scholar.ItemGroup.prototype.getChildItems = function()
{
	if(this.isCollection())
		return Scholar.getItems(this.ref.getID());
	else if(this.isLibrary())
		return Scholar.getItems();
	else
		return null;
}