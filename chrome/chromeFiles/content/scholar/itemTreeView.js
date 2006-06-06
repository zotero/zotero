Scholar.ItemTreeView = function(itemGroup)
{
	this._treebox = null;
	this._savedSelection = null;
	this._dataItems = new Array();
	this.rowCount = 0;
	this._itemGroup = itemGroup;
	this.refresh();
	
	this._unregisterID = Scholar.Notifier.registerItemTree(this);
}

Scholar.ItemTreeView.prototype.refresh = function()
{
	this._dataItems = new Array();
	this.rowCount = 0;
	
	var newRows = this._itemGroup.getChildItems();
	for(var i = 0; i < newRows.length; i++)
		if(newRows[i])
			this._showItem(newRows[i], i+1); //item ref, before row
	
	this._refreshHashMap();
}

Scholar.ItemTreeView.prototype.unregister = function()
{
	Scholar.Notifier.unregisterItemTree(this._unregisterID);
}

Scholar.ItemTreeView.prototype.setTree = function(treebox)
{
	if(this._treebox)
		return;
	this._treebox = treebox;
	this.sort();
}

Scholar.ItemTreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getItemAtRow(row);
	var val = obj.getField(column.id);
	
	if(column.id == 'dateAdded' || column.id == 'dateModified')		//this is not so much that we will use this format for date, but a simple template for later revisions.
	{
		val = new Date(Date.parse(val.replace(/-/g,"/"))).toLocaleString();
	}
	
	return val;
}


Scholar.ItemTreeView.prototype._showItem = function(item, beforeRow) 			{ this._dataItems.splice(beforeRow, 0, item); this.rowCount++; }

Scholar.ItemTreeView.prototype._hideItem = function(row) 						{ this._dataItems.splice(row,1); this.rowCount--; }

Scholar.ItemTreeView.prototype._getItemAtRow = function(row)					{ return this._dataItems[row]; }

Scholar.ItemTreeView.prototype.isSorted = function()
{
	for(var i=0, len=this._treebox.columns.count; i<len; i++)
		if(this._treebox.columns.getColumnAt(i).element.getAttribute('sortActive'))
			return true;
	return false;
}

Scholar.ItemTreeView.prototype.isSeparator = function(row) 						{ return false; }
Scholar.ItemTreeView.prototype.isContainer = function(row) 						{ return false; }
Scholar.ItemTreeView.prototype.getLevel = function(row) 						{ return 0; }
Scholar.ItemTreeView.prototype.getRowProperties = function(row, prop) 			{ }
Scholar.ItemTreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Scholar.ItemTreeView.prototype.getCellProperties = function(row, col, prop) 	{ }
Scholar.ItemTreeView.prototype.getImageSrc = function(row, col) 				{ }

Scholar.ItemTreeView.prototype.cycleHeader = function(column)
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
	this.saveSelection();
	this.sort();
	this.rememberSelection();
	this.selection.selectEventsSuppressed = false;
	this._treebox.invalidate();
}

Scholar.ItemTreeView.prototype.sort = function()
{
	
	var column = this._treebox.columns.getSortedColumn()
	var order = column.element.getAttribute('sortDirection') == 'descending';
	if(order)
	{
		function columnSort(a,b)
		{
			return(a.getField(column.id) < b.getField(column.id)) ? -1 : (a.getField[column.id] > b.getField(column.id)) ? 1 : 0;
		}
	}
	else
	{
		function columnSort(a,b)
		{
			return(a.getField(column.id) > b.getField(column.id)) ? -1 : (a.getField[column.id] < b.getField(column.id)) ? 1 : 0;
		}
	}
	
	this._dataItems.sort(columnSort);
	this._refreshHashMap();
	
}

Scholar.ItemTreeView.prototype.deleteSelection = function()
{
	if(this.selection.count == 0)
		return;

	//create an array of selected items
	var items = new Array();
	var start = new Object();
	var end = new Object();
	for (var i=0, len=this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++)
			items.push(this._getItemAtRow(j));
	}
	
	//iterate and erase...
	this._treebox.beginUpdateBatch();
	for (var i=0; i<items.length; i++)
	{
		if(this._itemGroup.isLibrary()) //erase item from DB
			items[i].erase();
		else if(this._itemGroup.isCollection())
			this._itemGroup.ref.removeItem(items[i].getID());

		/* Disabled for now (notifier)
		//remove row from tree:
		this._hideItem(rows[i]-i);
		this._treebox.rowCountChanged(rows[i]-i, -1); */
	}
	this._treebox.endUpdateBatch();
}

Scholar.ItemTreeView.prototype.searchText = function(search)
{
	this.selection.selectEventsSuppressed = true;
	this.saveSelection();
	
	this._itemGroup.setSearch(search);
	var oldCount = this.rowCount;
	this.refresh();
	this._treebox.rowCountChanged(0,this.rowCount-oldCount);
	
	this.sort();

	this.rememberSelection();
	this.selection.selectEventsSuppressed = false;
	this._treebox.invalidate();
}

Scholar.ItemTreeView.prototype._refreshHashMap = function()
{	
	// Create hash map of item ids to row indexes
	
	this._itemRowMap = new Array();
	for(var i=0; i < this.rowCount; i++)
		this._itemRowMap[this._getItemAtRow(i).getID()] = i;
}

Scholar.ItemTreeView.prototype.getCollectionID = function()
{
	if(this._itemGroup.isCollection())
		return this._itemGroup.ref.getID();
	
}

//CALLED BY DATA LAYER ON CHANGE:
Scholar.ItemTreeView.prototype.notify = function(action, type, ids)
{
	ids = Scholar.flattenArguments(ids);
	var madeChanges = false;
	
	if(action == 'remove')
	{
		//Since a remove involves shifting of rows, we have to do it in order
		
		//sort the ids by row
		var rows = new Array();
		for(var i=0, len=ids.length; i<len; i++)
			if(this._itemRowMap[ids[i]] != null)
				rows.push(this._itemRowMap[ids[i]]);
		
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
		
			var row = this._itemRowMap[ids[i]];
			if(action == 'modify' && row != null) 	//must check for null because it could legitimately be 0
			{
				var item = Scholar.Items.get(ids[i]);
				
				this._treebox.invalidateRow(row);
				madeChanges = true;
			}
			else if(action == 'add' && row == null)
			{
				var item = Scholar.Items.get(ids[i]);
				
				if(this._itemGroup.isLibrary() || item.inCollection(this.getCollectionID()))
				{
					this._showItem(item,this.rowCount);
					this._treebox.rowCountChanged(this.rowCount-1,1);
				}
			
				madeChanges = true;
			}
			
		}
	}
	
	if(madeChanges)
	{
		if(action == 'add')
			this.selection.select(this._itemRowMap[item.getID()]);

		if(this.isSorted())
			this.sort();				//this also refreshes the hash map
		else if(action != 'modify') //no need to update this if we just modified
			this._refreshHashMap();
			
	}	
}

Scholar.ItemTreeView.prototype.saveSelection = function()
{
	this._savedSelection = new Array();
	
	var start = new Object();
	var end = new Object();
	for (var i=0, len=this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++)
			this._savedSelection.push(this._getItemAtRow(j).getID());
	}
}

Scholar.ItemTreeView.prototype.rememberSelection = function()
{
	this.selection.clearSelection();
	for(var i=0; i < this._savedSelection.length; i++)
	{
		if(this._itemRowMap[this._savedSelection[i]] != null)
			this.selection.toggleSelect(this._itemRowMap[this._savedSelection[i]]);
	}
}

Scholar.ItemTreeView.prototype.canDrop = function(index, orient)
{
	return false;
}