Scholar.ItemTreeView = function(itemGroup)
{
	this._treebox = null;
	this._dataItems = new Array();
	this.rowCount = 0;
	this._itemGroup = itemGroup;
}

Scholar.ItemTreeView.prototype.setTree = function(treebox)
{
	if(this._treebox)
		return;
	this._treebox = treebox;
	
	var newRows = this._itemGroup.getChildItems();
	for(var i = 0; i < newRows.length; i++)
		this._showItem(newRows[i], i+1); //item ref, before row
		
	this._refreshHashMap();
}

Scholar.ItemTreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getItemAtRow(row);
	var val = obj.getField(column.id);
	
	if(column.id == 'dateAdded' || column.id == 'dateModified')		//this is not so much that we will use this format for date, but a simple template for later revisions.
	{
		//
		var d = val.split(' ');
		var date = d[0].split('-');
		var time = d[1].split('-');
		
		var myDate = new Date();
		myDate.setFullYear(date[0],date[1]-1,date[2]);
		
		val = myDate.getMonth()+1 + '/' + myDate.getDate() + '/' + myDate.getFullYear();
	}
	
	return val;
	
}


Scholar.ItemTreeView.prototype._showItem = function(item, beforeRow) 			{ this._dataItems.splice(beforeRow, 0, item); this.rowCount++; }

Scholar.ItemTreeView.prototype._hideItem = function(row) 						{ this._dataItems.splice(row,1); this.rowCount--; }

Scholar.ItemTreeView.prototype._getItemAtRow = function(row)					{ return this._dataItems[row]; }

Scholar.ItemTreeView.prototype.isSorted = function() 							{ return false; }
Scholar.ItemTreeView.prototype.isSeparator = function(row) 						{ return false; }
Scholar.ItemTreeView.prototype.isContainer = function(row) 						{ return false; }
Scholar.ItemTreeView.prototype.getLevel = function(row) 						{ return 0; }
Scholar.ItemTreeView.prototype.getRowProperties = function(row, prop) 			{ }
Scholar.ItemTreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Scholar.ItemTreeView.prototype.getCellProperties = function(row, col, prop) 	{ }
Scholar.ItemTreeView.prototype.getImageSrc = function(row, col) 				{ }

Scholar.ItemTreeView.prototype.cycleHeader = function(column)
{
	var order = 0;
	if(order==0)
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
	this._treebox.invalidate();
}

Scholar.ItemTreeView.prototype.deleteSelection = function()
{
	if(this.selection.count == 0)
		return;

	//create an array of selected items
	var rows = new Array();
	var start = new Object();
	var end = new Object();
	for (var i=0, len=this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++)
			rows.push(j);
	}
	
	//iterate and erase...
	this._treebox.beginUpdateBatch();
	for (var i=0; i<rows.length; i++)
	{
		if(this._itemGroup.isLibrary()) //erase item from DB
			this._getItemAtRow(rows[i]-i).erase();
		else if(this._itemGroup.isCollection())
			this._itemGroup.ref.removeItem(this._getItemAtRow(rows[i]-i).getID());

		
		//remove row from tree:
		this._hideItem(rows[i]-i);
		this._treebox.rowCountChanged(rows[i]-i, -1);
	}
	this._treebox.endUpdateBatch();
	
	this._refreshHashMap();
}

Scholar.ItemTreeView.prototype.searchText = function(search)
{
	//does nothing, right now.
//	this._refreshHashMap();
}

Scholar.ItemTreeView.prototype._refreshHashMap = function()
{	
	// Create hash map of folder and object ids to row indexes
	
	this._itemRowMap = new Array();
	for(var i=0; i < this.rowCount; i++)
		this._itemRowMap[this._getItemAtRow(i).getID()] = i;
		
	//Scholar.debug(Scholar.varDump(this.folderRowMap));
	//Scholar.debug(Scholar.varDump(this.objectRowMap));

}