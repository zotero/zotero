/*
	Zotero
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
*/

////////////////////////////////////////////////////////////////////////////////
///
///  ItemTreeView
///    -- handles the link between an individual tree and the data layer
///    -- displays only items (no collections, no hierarchy)
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Constructor the the ItemTreeView object
 */
Scholar.ItemTreeView = function(itemGroup)
{
	this._itemGroup = itemGroup;
	
	this._treebox = null;
	this.refresh();
	
	this._unregisterID = Scholar.Notifier.registerItemTree(this);
}

/*
 *  Called by the tree itself
 */
Scholar.ItemTreeView.prototype.setTree = function(treebox)
{
	if(this._treebox)
		return;
	this._treebox = treebox;
	
	if(!this.isSorted())
	{
		this.cycleHeader(this._treebox.columns.getNamedColumn('firstCreator'));
	}
	else
	{
		this.sort();
	}
}

/*
 *  Reload the rows from the data access methods
 *  (doesn't call the tree.invalidate methods, etc.)
 */
Scholar.ItemTreeView.prototype.refresh = function()
{
	this._dataItems = new Array();
	this.rowCount = 0;
	
	var newRows = this._itemGroup.getChildItems();
	if (newRows.length)
	{
		for(var i = 0, len = newRows.length; i < len; i++)
		{
			if(newRows[i])
			{
				this._showItem(new Scholar.ItemTreeView.TreeRow(newRows[i],0,false), i+1); //item ref, before row
			}
		}
	}
	
	this._refreshHashMap();
}

/*
 *  Called by Scholar.Notifier on any changes to items in the data layer
 */
Scholar.ItemTreeView.prototype.notify = function(action, type, ids)
{
	var madeChanges = false;
		
	this.selection.selectEventsSuppressed = true;
	var savedSelection = this.saveSelection();
	
	ids = Scholar.flattenArguments(ids);
	
	if((action == 'remove' && !this._itemGroup.isLibrary()) || (action == 'delete' && this._itemGroup.isLibrary()))
	{
		//Since a remove involves shifting of rows, we have to do it in order
		
		//sort the ids by row
		var rows = new Array();
		for(var i=0, len=ids.length; i<len; i++)
			if(action == 'delete' || !this._itemGroup.ref.hasItem(ids[i]))
				rows.push(this._itemRowMap[ids[i]]);
		
		if(rows.length > 0)
		{
			rows.sort(function(a,b) { return a-b });
			
			for(var i=0, len=rows.length; i<len; i++)
			{
				var row = rows[i];
				if(row != null)
				{
					this._hideItem(row-i);
					this._treebox.rowCountChanged(row-i,-1);
				}
			}
			
			madeChanges = true;
		}		
		
	}
	else if(action == 'modify') 	//must check for null because it could legitimately be 0
	{
		for(var i=0, len=ids.length; i<len; i++)
		{
			var row = this._itemRowMap[ids[i]];
			if( row != null)
			{
				if(this.isContainer(row) && this.isContainerOpen(row))
				{
					this.toggleOpenState(row);
					this.toggleOpenState(row);
				}
				else if(this.getParentIndex(row))
				{
					
				}
				else
				{
					this._treebox.invalidateRow(row);
				}
				madeChanges = true;
			}
			else if(this._itemGroup.isLibrary() || this._itemGroup.ref.hasItem(ids[i]))
			{
				var item = Scholar.Items.get(ids[i]);
				
				if(!item.getSource())
				{
					//most likely, the note or attachment's parent was removed.
					this._showItem(new Scholar.ItemTreeView.TreeRow(item,0,false),this.rowCount);
					this._treebox.rowCountChanged(this.rowCount-1,1);
					madeChanges = true;
				}
			}
		}
	}
	else if(action == 'add')
	{
		var items = Scholar.Items.get(ids);
		
		for (var i in items){
			if((this._itemGroup.isLibrary() || items[i].inCollection(this._itemGroup.ref.getID()))	// if the item belongs in this collection
				&& this._itemRowMap[items[i].getID()] == null											// if we haven't already added it to our hash map
				&& (items[i].isRegularItem() || !items[i].getSource()))								// if it's stand-alone
			{
				this._showItem(new Scholar.ItemTreeView.TreeRow(items[i],0,false),this.rowCount);
				this._treebox.rowCountChanged(this.rowCount-1,1);
		
				madeChanges = true;
			}
		}
	}
	
	if(madeChanges)
	{
		if(this.isSorted())
		{
			this.sort();				//this also refreshes the hash map
			this._treebox.invalidate();
		}
		else if(action != 'modify') //no need to update this if we modified
		{
			this._refreshHashMap();
		}
		
		if(action == 'add')
		{
			if (ids.length===1){
				this.selectItem(ids[0]);
			}
		}
		else
		{
			this.rememberSelection(savedSelection);
		}
	}
	this.selection.selectEventsSuppressed = false;
}

/*
 *  Unregisters view from Scholar.Notifier (called on window close)
 */
Scholar.ItemTreeView.prototype.unregister = function()
{
	Scholar.Notifier.unregisterItemTree(this._unregisterID);
}

////////////////////////////////////////////////////////////////////////////////
///
///  nsITreeView functions
///  http://www.xulplanet.com/references/xpcomref/ifaces/nsITreeView.html
///
////////////////////////////////////////////////////////////////////////////////

Scholar.ItemTreeView.prototype.getCellText = function(row, column)
{
	var obj = this._getItemAtRow(row);
	var val;
	
	if(column.id == "numChildren")
	{
		var c = obj.numChildren();
		if(c)	//don't display '0'
			val = c;
	}
	else if(column.id == "typeIcon")
	{
		val = Scholar.getString('itemTypes.'+Scholar.ItemTypes.getName(obj.getType()));
	}
	else
	{
		val = obj.getField(column.id);
	}
	
	if(column.id == 'dateAdded' || column.id == 'dateModified')		//this is not so much that we will use this format for date, but a simple template for later revisions.
	{
		val = new Date(Date.parse(val.replace(/-/g,"/"))).toLocaleString();
	}
	
	return val;
}

Scholar.ItemTreeView.prototype.getImageSrc = function(row, col)
{
	if(col.id == 'title')
	{
		var item = this._getItemAtRow(row);
		var itemType = Scholar.ItemTypes.getName(item.getType());
		if(itemType == 'attachment')
		{
			var linkMode = item.ref.getAttachmentLinkMode();
			if(linkMode == Scholar.Attachments.LINK_MODE_IMPORTED_FILE)
			{
				itemType = itemType + "-file";
			}
			else if(linkMode == Scholar.Attachments.LINK_MODE_LINKED_FILE)
			{
				itemType = itemType + "-link";
			}
			else if(linkMode == Scholar.Attachments.LINK_MODE_IMPORTED_URL)
			{
				itemType = itemType + "-snapshot";
			}
			else if(linkMode == Scholar.Attachments.LINK_MODE_LINKED_URL)
			{
				itemType = itemType + "-web-link";
			}
		}
		
		return "chrome://scholar/skin/treeitem-"+itemType+".png";
	}
}

Scholar.ItemTreeView.prototype.isContainer = function(row)
{
	return this._getItemAtRow(row).isRegularItem();
}

Scholar.ItemTreeView.prototype.isContainerOpen = function(row)
{
	return this._dataItems[row].isOpen;
}

Scholar.ItemTreeView.prototype.isContainerEmpty = function(row)
{
	return (this._getItemAtRow(row).numNotes() == 0 && this._getItemAtRow(row).numAttachments() == 0);
}

Scholar.ItemTreeView.prototype.getLevel = function(row)
{
	return this._getItemAtRow(row).level;
}

Scholar.ItemTreeView.prototype.getParentIndex = function(row)
{
	var thisLevel = this.getLevel(row);
	if(thisLevel == 0) return -1;
	for(var i = row - 1; i >= 0; i--)
		if(this.getLevel(i) < thisLevel)
			return i;
	return -1;
}

Scholar.ItemTreeView.prototype.hasNextSibling = function(row,afterIndex)
{
	var thisLevel = this.getLevel(row);
	for(var i = afterIndex + 1; i < this.rowCount; i++)
	{	
		var nextLevel = this.getLevel(i);
		if(nextLevel == thisLevel) return true;
		else if(nextLevel < thisLevel) return false;
	}
}

Scholar.ItemTreeView.prototype.toggleOpenState = function(row)
{
	var count = 0;		//used to tell the tree how many rows were added/removed
	var thisLevel = this.getLevel(row);
	
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
		var item = this._getItemAtRow(row).ref;
		//Get children
		var attachments = item.getAttachments();
		var notes = item.getNotes();
		
		var newRows;
		if(attachments && notes)
			newRows = attachments.concat(notes);
		else if(attachments)
			newRows = attachments;
		else if(notes)
			newRows = notes;
		
		newRows = Scholar.Items.get(newRows); 
		
		for(var i = 0; i < newRows.length; i++)
		{
			count++;
			this._showItem(new Scholar.ItemTreeView.TreeRow(newRows[i],thisLevel+1,false), row+i+1); //item ref, before row
		}
	}
	
	this._treebox.beginUpdateBatch();
	
	this._dataItems[row].isOpen = !this._dataItems[row].isOpen;
	this._treebox.rowCountChanged(row+1, count); //tell treebox to repaint these
	this._treebox.invalidateRow(row);
	this._treebox.endUpdateBatch();
	this._refreshHashMap();
}

Scholar.ItemTreeView.prototype.isSorted = function()
{
	for(var i=0, len=this._treebox.columns.count; i<len; i++)
		if(this._treebox.columns.getColumnAt(i).element.getAttribute('sortActive'))
			return true;
	return false;
}

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
	var savedSelection = this.saveSelection();
	this.sort();
	this.rememberSelection(savedSelection);
	this.selection.selectEventsSuppressed = false;
	this._treebox.invalidate();
}

/*
 *  Sort the items by the currently sorted column.
 *  Simply uses Array.sort() function, and refreshes the hash map.
 */
Scholar.ItemTreeView.prototype.sort = function()
{
	var column = this._treebox.columns.getSortedColumn()
	var order = column.element.getAttribute('sortDirection') == 'descending';
	
	if(column.id == 'typeIcon')
	{
		function columnSort(a,b)
		{
			var typeA = Scholar.getString('itemTypes.'+Scholar.ItemTypes.getName(a.getType()));
			var typeB = Scholar.getString('itemTypes.'+Scholar.ItemTypes.getName(b.getType()));
			
			return (typeA > typeB) ? -1 : (typeA < typeB) ? 1 : 0;
		}
	}
	else if(column.id == 'numNotes')
	{
		function columnSort(a,b)
		{
			return b.numNotes() - a.numNotes();
		}
	}
	else
	{
		function columnSort(a,b)
		{
			var fieldA = a.getField(column.id);
			var fieldB = b.getField(column.id);
			
			if(typeof fieldA == 'string')
			{
				fieldA = fieldA.toLowerCase();
				fieldB = fieldB.toLowerCase();
			}
			
			return (fieldA > fieldB) ? -1 : (fieldA < fieldB) ? 1 : 0;
		}
	}
	
	function doSort(a,b)
	{
		var s = columnSort(a,b);
		if(s)
			return s;
		else
			return secondarySort(a,b);
	}
	
	function oppositeSort(a,b)
	{
		return(doSort(a,b) * -1);
	}
	
	function secondarySort(a,b)
	{
		return (a.getField('dateModified') > b.getField('dateModified')) ? -1 : (a.getField('dateModified') < b.getField('dateModified')) ? 1 : 0;
	}
	
	var openRows = new Array();
	for(var i = 0; i < this._dataItems.length; i++)
	{
		if(this.isContainer(i) && this.isContainerOpen(i))
		{
			openRows.push(this._getItemAtRow(i).ref.getID());
			this.toggleOpenState(i);
		}
	}
	
	if(order)
		this._dataItems.sort(oppositeSort);
	else
		this._dataItems.sort(doSort);
		
	this._refreshHashMap();
	
	for(var i = 0; i < openRows.length; i++)
		this.toggleOpenState(this._itemRowMap[openRows[i]]);
	
}

////////////////////////////////////////////////////////////////////////////////
///
///  Additional functions for managing data in the tree
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Select an item
 */
Scholar.ItemTreeView.prototype.selectItem = function(id)
{
	var row = this._itemRowMap[id];
	if(row == null)
	{
		var item = Scholar.Items.get(id);
		this.toggleOpenState(this._itemRowMap[item.getSource()]); //opens the parent of the item
		row = this._itemRowMap[id];
	}
		
	this.selection.select(row);
	this._treebox.ensureRowIsVisible(row);
}

/*
 *  Delete the selection
 */
Scholar.ItemTreeView.prototype.deleteSelection = function(eraseChildren)
{
	if(this.selection.count == 0)
		return;
		
	//collapse open items
	for(var i=0; i<this.rowCount; i++)
		if(this.selection.isSelected(i) && this.isContainer(i) && this.isContainerOpen(i))
			this.toggleOpenState(i);
	this._refreshHashMap();
	
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
		if(this._itemGroup.isLibrary() || !items[i].isRegularItem()) //erase item from DB
			items[i].ref.erase(eraseChildren);
		else if(this._itemGroup.isCollection())
			this._itemGroup.ref.removeItem(items[i].ref.getID());
	}
	this._treebox.endUpdateBatch();
}

/*
 *  Set the search filter on the view
 */
Scholar.ItemTreeView.prototype.searchText = function(search)
{
	this.selection.selectEventsSuppressed = true;
	var savedSelection = this.saveSelection();
	
	this._itemGroup.setSearch(search);
	var oldCount = this.rowCount;
	this.refresh();
	this._treebox.rowCountChanged(0,this.rowCount-oldCount);
	
	this.sort();

	this.rememberSelection(savedSelection);
	this.selection.selectEventsSuppressed = false;
	this._treebox.invalidate();
}

/*
 *  Called by various view functions to show a row
 * 
 *  	item:	reference to the Item
 *      beforeRow:	row index to insert new row before
 */
Scholar.ItemTreeView.prototype._showItem = function(item, beforeRow)
{
	this._dataItems.splice(beforeRow, 0, item);
	this.rowCount++;
}

/*
 *  Called by view to hide specified row
 */
Scholar.ItemTreeView.prototype._hideItem = function(row)
{
	this._dataItems.splice(row,1);
	this.rowCount--;
}

/*
 *  Returns a reference to the item at row (see Scholar.Item in data_access.js)
 */
Scholar.ItemTreeView.prototype._getItemAtRow = function(row)
{
	return this._dataItems[row];
}

/*
 *  Create hash map of item ids to row indexes
 */
Scholar.ItemTreeView.prototype._refreshHashMap = function()
{
	this._itemRowMap = new Array();
	for(var i=0; i < this.rowCount; i++)
	{
		var row = this._getItemAtRow(i);
		this._itemRowMap[row.ref.getID()] = i;
	}
}

/*
 *  Saves the ids of currently selected items for later
 */
Scholar.ItemTreeView.prototype.saveSelection = function()
{
	savedSelection = new Array();
	
	var start = new Object();
	var end = new Object();
	for (var i=0, len=this.selection.getRangeCount(); i<len; i++)
	{
		this.selection.getRangeAt(i,start,end);
		for (var j=start.value; j<=end.value; j++)
		{
			savedSelection.push(this._getItemAtRow(j).ref.getID());
		}
	}
	return savedSelection;
}

/*
 *  Sets the selection based on saved selection ids (see above)
 */
Scholar.ItemTreeView.prototype.rememberSelection = function(selection)
{
	this.selection.clearSelection();
	for(var i=0; i < selection.length; i++)
	{
		if(this._itemRowMap[selection[i]] != null)
			this.selection.toggleSelect(this._itemRowMap[selection[i]]);
	}
}

////////////////////////////////////////////////////////////////////////////////
///
///  Command Controller:
///		for Select All, etc.
///
////////////////////////////////////////////////////////////////////////////////

Scholar.ItemTreeCommandController = function(tree)
{
	this.tree = tree;
}

Scholar.ItemTreeCommandController.prototype.supportsCommand = function(cmd)
{
	return (cmd == 'cmd_selectAll' || cmd == 'cmd_delete');
}

Scholar.ItemTreeCommandController.prototype.isCommandEnabled = function(cmd)
{
	return (cmd == 'cmd_selectAll' || (cmd == 'cmd_delete' && this.tree.view.selection.count > 0));
}

Scholar.ItemTreeCommandController.prototype.doCommand = function(cmd)
{
	if(cmd == 'cmd_selectAll')
		this.tree.view.selection.selectAll();
	else if(cmd == 'cmd_delete')
		ScholarPane.deleteSelectedItem();
}

Scholar.ItemTreeCommandController.prototype.onEvent = function(evt)
{
	
}

////////////////////////////////////////////////////////////////////////////////
///
///  Drag-and-drop functions:
///		for nsDragAndDrop.js + nsTransferable.js
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Begin a drag
 */
Scholar.ItemTreeView.prototype.onDragStart = function (evt,transferData,action)
{ 
	transferData.data=new TransferData();
	transferData.data.addDataForFlavour("scholar/item",this.saveSelection());
}

/*
 *  Called by nsDragAndDrop.js for any sort of drop on the tree
 */
Scholar.ItemTreeView.prototype.getSupportedFlavours = function () 
{ 
	var flavors = new FlavourSet();
	flavors.appendFlavour("scholar/item");
	flavors.appendFlavour("text/x-moz-url");
	return flavors; 
}

/*
 *  Called by nsDragAndDrop.js for any sort of drop on the tree
 */
Scholar.ItemTreeView.prototype.onDrop = function (evt,data,session)
{
	var dataType = data.flavour.contentType;
	
	if(dataType == 'scholar/item')
	{
		var ids = data.data.split(',');
		for(var i = 0; i<ids.length; i++)
			this._itemGroup.ref.addItem(ids[i]);
	}
	else if(dataType == 'text/x-moz-url')
	{
		var url = data.data.split("\n")[0];
		
		/* WAITING FOR INGESTER SUPPORT
		var newItem = Scholar.Ingester.scrapeURL(url);
		
		if(newItem)
			this._itemGroup.ref.addItem(newItem.getID());
		*/
	}
}

Scholar.ItemTreeView.prototype.onDragOver = function (evt,dropdata,session) { }

////////////////////////////////////////////////////////////////////////////////
///
///  Functions for nsITreeView that we have to stub out.
///
////////////////////////////////////////////////////////////////////////////////

Scholar.ItemTreeView.prototype.isSeparator = function(row) 						{ return false; }
Scholar.ItemTreeView.prototype.getRowProperties = function(row, prop) 			{ }
Scholar.ItemTreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Scholar.ItemTreeView.prototype.getCellProperties = function(row, col, prop) 	{ }

Scholar.ItemTreeView.TreeRow = function(ref, level, isOpen)
{
	this.ref = ref;			//the item associated with this
	this.level = level;
	this.isOpen = isOpen;
}

Scholar.ItemTreeView.TreeRow.prototype.isNote = function()
{
	return this.ref.isNote();
}

Scholar.ItemTreeView.TreeRow.prototype.isAttachment = function()
{
	return this.ref.isAttachment();
}

Scholar.ItemTreeView.TreeRow.prototype.isRegularItem = function()
{
	return this.ref.isRegularItem();
}

Scholar.ItemTreeView.TreeRow.prototype.getField = function(field)
{
	if(this.isNote() && field == 'title')
	{
		var t = this.ref.getNote();
		if(t)
		{
			var n = t.indexOf("\n");
			if(n > -1)
				t = t.substring(0,n);
			return t;
		}
	}
	else
	{
		return this.ref.getField(field);
	}
	
}

Scholar.ItemTreeView.TreeRow.prototype.getType = function()
{
	return this.ref.getType();
}

Scholar.ItemTreeView.TreeRow.prototype.numChildren = function()
{
	if(this.isRegularItem())
		return this.ref.numChildren();
	else
		return 0;
}

Scholar.ItemTreeView.TreeRow.prototype.numNotes = function()
{
	if(this.isRegularItem())
		return this.ref.numNotes();
	else
		return 0;
}

Scholar.ItemTreeView.TreeRow.prototype.numAttachments = function()
{
	if(this.isRegularItem())
		return this.ref.numAttachments();
	else
		return 0;
}