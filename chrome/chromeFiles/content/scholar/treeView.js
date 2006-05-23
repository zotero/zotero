Scholar.TreeView = function(root)
{
	this._treebox = null;
	this._dataItems = new Array();
	this.rowCount = 0;
	this._treeType;
	this._rootFolder = root;
}

Scholar.TreeView.prototype.setTree = function(treebox)
{
	if(this._treebox)
		return;
	this._treebox = treebox;
	this._treeType = treebox.element.getAttribute("treeviewtype");
	
	var newRows = Scholar.Items.getTreeRows(this._rootFolder,this._treeType);
	for(var i = 0; i < newRows.length; i++)
		this._showItem(newRows[i],  0, i+1); //item ref, isContainerOpen, level
		
	this._refreshHashMap();
}

Scholar.TreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getItemAtRow(row);
	
	if(obj.isFolder())
	{
		if(column.id == "name_column")
			return obj.getName();
		else
			return "";
	}
	else
	{
		if(column.id == "title_column")
			return obj.getField("title");
		else if(column.id == "creator_column")
			return obj.getField("firstCreator");
		else if(column.id == "source_column")
			return obj.getField("source");
		else
			return "";
	}
}

Scholar.TreeView.prototype.isContainer = function(row) 		{ return this._getItemAtRow(row).isFolder(); }
Scholar.TreeView.prototype.isContainerOpen = function(row)  { return this._dataItems[row][1]; }
Scholar.TreeView.prototype.isContainerEmpty = function(row)
{
	if(this._treeType == 'folders')
		return !this._getItemAtRow(row).hasChildFolders();
	else
		return (this.isContainer(row) && this._getItemAtRow(row).isEmpty());
}

Scholar.TreeView.prototype.getLevel = function(row) 		{ return this._dataItems[row][2]; }

Scholar.TreeView.prototype.getParentIndex = function(row)
{
	var thisLevel = this.getLevel(row);
	if(thisLevel == 0) return -1;
	for(var i = row - 1; i >= 0; i--)
		if(this.getLevel(i) < thisLevel)
			return i;
	return -1;
}

Scholar.TreeView.prototype.hasNextSibling = function(row, afterIndex)
{
	var thisLevel = this.getLevel(row);
	for(var i = afterIndex + 1; i < this.rowCount; i++)
	{	
		var nextLevel = this.getLevel(i);
		if(nextLevel == thisLevel) return true;
		else if(nextLevel < thisLevel) return false;
	}
}

Scholar.TreeView.prototype.toggleOpenState = function(row)
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
		var newRows = Scholar.Items.getTreeRows(this._getItemAtRow(row).getID(),this._treeType); //Get children
		
		for(var i = 0; i < newRows.length; i++)
		{
			count++;
			this._showItem(newRows[i], thisLevel+1, row+i+1); //insert new row
		}
	}
	this._dataItems[row][1] = !this._dataItems[row][1];  //toggle container open value

	this._treebox.rowCountChanged(row+1, count); //tell treebox to repaint these
	this._treebox.invalidateRow(row);
	this._treebox.endUpdateBatch();	
	this._refreshHashMap();
}

Scholar.TreeView.prototype._showItem = function(item, level, beforeRow) 	{ this._dataItems.splice(beforeRow, 0, [item, false, level]); this.rowCount++; }

Scholar.TreeView.prototype._hideItem = function(row) 						{ this._dataItems.splice(row,1); this.rowCount--; }

Scholar.TreeView.prototype._getItemAtRow = function(row)					{ return this._dataItems[row][0]; }
Scholar.TreeView.prototype.isSorted = function() 							{ return false; }
Scholar.TreeView.prototype.isSeparator = function(row) 						{ return false; }
Scholar.TreeView.prototype.isEditable = function(row, idx) 					{ return false; }
Scholar.TreeView.prototype.getRowProperties = function(row, prop) 			{ }
Scholar.TreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Scholar.TreeView.prototype.getCellProperties = function(row, col, prop) 	{ }
Scholar.TreeView.prototype.getImageSrc = function(row, col) 				{ }
Scholar.TreeView.prototype.performAction = function(action) 				{ }
Scholar.TreeView.prototype.performActionOnCell = function(action, row, col)	{ }
Scholar.TreeView.prototype.getProgressMode = function(row, col) 			{ }

Scholar.TreeView.prototype.deleteSelection = function()
{
	if(this.selection.count == 0)
		return;
	
	if(!confirm("Are you sure you want to delete the selected item"+(this.selection.count > 1 ? "s" : "")+"?"))
		return;

	//collapse open folders
	for(var i=0; i<this.rowCount; i++)
		if(this.selection.isSelected(i) && this.isContainer(i) && this.isContainerOpen(i))
			this.toggleOpenState(i);
	
	//create an array of selected items/folders
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
		//erase item/folder from DB:
		this._getItemAtRow(rows[i]-i).erase();		
		
		//remove row from tree:
		this._hideItem(rows[i]-i);
		this._treebox.rowCountChanged(rows[i]-i, -1);
	}
	this._treebox.endUpdateBatch();
	
	this._refreshHashMap();
}

Scholar.TreeView.prototype._refreshHashMap = function()
{	
	// Create hash map of folder and object ids to row indexes
	
	this._itemRowMap = new Array();
	this._folderRowMap = new Array();
	for(var i=0; i < this.rowCount; i++){
		if (this.isContainer(i)){
			this._folderRowMap[this._getItemAtRow(i).getID()] = i;
		}
		else {
			this._itemRowMap[this._getItemAtRow(i).getID()] = i;
		}
	}
	//Scholar.debug(Scholar.varDump(this.folderRowMap));
	//Scholar.debug(Scholar.varDump(this.objectRowMap));

}