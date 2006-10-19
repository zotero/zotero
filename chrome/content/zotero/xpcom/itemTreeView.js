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
///  ItemTreeView
///    -- handles the link between an individual tree and the data layer
///    -- displays only items (no collections, no hierarchy)
///
////////////////////////////////////////////////////////////////////////////////

/*
 *  Constructor the the ItemTreeView object
 */
Zotero.ItemTreeView = function(itemGroup, sourcesOnly)
{
	this._itemGroup = itemGroup;
	this._sourcesOnly = sourcesOnly;
	
	this._treebox = null;
	this.refresh();
	
	this._unregisterID = Zotero.Notifier.registerItemObserver(this);
}

/*
 *  Called by the tree itself
 */
Zotero.ItemTreeView.prototype.setTree = function(treebox)
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
Zotero.ItemTreeView.prototype.refresh = function()
{
	this._dataItems = new Array();
	this.rowCount = 0;
	
	var newRows = this._itemGroup.getChildItems();
	if (newRows.length)
	{
		for(var i = 0, len = newRows.length; i < len; i++)
		{
			if(newRows[i] &&
			  (!this._sourcesOnly || (!newRows[i].isAttachment() && !newRows[i].isNote())))
			{
				this._showItem(new Zotero.ItemTreeView.TreeRow(newRows[i],0,false), i+1); //item ref, before row
			}
		}
	}
	
	this._refreshHashMap();
}

/*
 *  Called by Zotero.Notifier on any changes to items in the data layer
 */
Zotero.ItemTreeView.prototype.notify = function(action, type, ids)
{
	var madeChanges = false;
	this.selection.selectEventsSuppressed = true;
	var savedSelection = this.saveSelection();
	
	// See if we're in the active window
	var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		.getService(Components.interfaces.nsIWindowMediator);
	if (wm.getMostRecentWindow("navigator:browser") ==
			this._treebox.treeBody.ownerDocument.defaultView){
		var activeWindow = true;
	}
	
	var quicksearch = this._treebox.treeBody.ownerDocument.getElementById('tb-search');
	
	if((action == 'remove' && !this._itemGroup.isLibrary())
		|| (action == 'delete' && (this._itemGroup.isLibrary() || this._itemGroup.isSearch())))
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
		// If no quicksearch, process modifications manually
		if (quicksearch.value == '')
		{
			for(var i=0, len=ids.length; i<len; i++)
			{
				var row = this._itemRowMap[ids[i]];
				// Item already exists in this view
				if( row != null)
				{
					if (this.isContainer(row) && this.isContainerOpen(row))
					{
						this.toggleOpenState(row);
						this.toggleOpenState(row);
					}
					// If item moved from top-level to under another item,
					// remove the old row
					else if (!this.isContainer(row) && this.getParentIndex(row)==-1
						&& this._getItemAtRow(row).ref.getSource())
					{
							this._hideItem(row);
							this._treebox.rowCountChanged(row+1, -1)
					}
					// If 
					else if (!this.isContainer(row) && this.getParentIndex(row)!=-1
						&& !this._getItemAtRow(row).ref.getSource())
					{
						var item = Zotero.Items.get(ids[i]);
						this._showItem(new Zotero.ItemTreeView.TreeRow(item, 0, false), this.rowCount);
						this._treebox.rowCountChanged(this.rowCount-1, 1);
					}
					else
					{
						this._treebox.invalidateRow(row);
					}
					madeChanges = true;
				}
				
				//else if(this._itemGroup.isLibrary() || this._itemGroup.ref.hasItem(ids[i]))
				else
				{
					var item = Zotero.Items.get(ids[i]);
					
					if(item.isRegularItem() || !item.getSource())
					{
						//most likely, the note or attachment's parent was removed.
						this._showItem(new Zotero.ItemTreeView.TreeRow(item,0,false),this.rowCount);
						this._treebox.rowCountChanged(this.rowCount-1,1);
						madeChanges = true;
					}
				}
			}
		}
		
		// If quicksearch, re-run it, since the results may have changed
		else
		{
			quicksearch.doCommand();
			madeChanges = true;
		}
	}
	else if(action == 'add')
	{
		// If no quicksearch, process new items manually
		if (quicksearch.value == '')
		{
			var items = Zotero.Items.get(ids);
			
			for (var i in items)
			{
				// if the item belongs in this collection
				if((this._itemGroup.isLibrary() || items[i].inCollection(this._itemGroup.ref.getID()))
					// if we haven't already added it to our hash map
					&& this._itemRowMap[items[i].getID()] == null
					// Regular item or standalone note/attachment
					&& (items[i].isRegularItem() || !items[i].getSource()))
				{
					this._showItem(new Zotero.ItemTreeView.TreeRow(items[i],0,false),this.rowCount);
					this._treebox.rowCountChanged(this.rowCount-1,1);
			
					madeChanges = true;
				}
			}
		}
		// Otherwise rerun the search, which refreshes the item list
		else
		{
			// If active window, clear search first
			if (activeWindow)
			{
				quicksearch.value = '';
			}
			quicksearch.doCommand();
			madeChanges = true;
		}
	}
	
	if(madeChanges)
	{
		if(this.isSorted())
		{
			this.sort();				//this also refreshes the hash map
			this._treebox.invalidate();
		}
		//else if(action != 'modify') //no need to update this if we modified
		else //no need to update this if we modified
		{
			this._refreshHashMap();
		}
		
		// If adding and this is the active window, select the item
		if(action == 'add' && ids.length===1 && activeWindow)
		{
			// Reset to Info tab
			this._treebox.treeBody.ownerDocument.
			getElementById('zotero-view-tabs').selectedIndex = 0;
			
			this.selectItem(ids[0]);
		}
		else
		{
			this.rememberSelection(savedSelection);
		}
	}
	this.selection.selectEventsSuppressed = false;
}

/*
 *  Unregisters view from Zotero.Notifier (called on window close)
 */
Zotero.ItemTreeView.prototype.unregister = function()
{
	Zotero.Notifier.unregisterItemObserver(this._unregisterID);
}

////////////////////////////////////////////////////////////////////////////////
///
///  nsITreeView functions
///  http://www.xulplanet.com/references/xpcomref/ifaces/nsITreeView.html
///
////////////////////////////////////////////////////////////////////////////////

Zotero.ItemTreeView.prototype.getCellText = function(row, column)
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
		val = Zotero.getString('itemTypes.'+Zotero.ItemTypes.getName(obj.getType()));
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

Zotero.ItemTreeView.prototype.getImageSrc = function(row, col)
{
	if(col.id == 'title')
	{
		var item = this._getItemAtRow(row);
		var itemType = Zotero.ItemTypes.getName(item.getType());
		if(itemType == 'attachment')
		{
			var linkMode = item.ref.getAttachmentLinkMode();
			if(linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_FILE)
			{
				itemType = itemType + "-file";
			}
			else if(linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE)
			{
				itemType = itemType + "-link";
			}
			else if(linkMode == Zotero.Attachments.LINK_MODE_IMPORTED_URL)
			{
				itemType = itemType + "-snapshot";
			}
			else if(linkMode == Zotero.Attachments.LINK_MODE_LINKED_URL)
			{
				itemType = itemType + "-web-link";
			}
		}
		
		// DEBUG: only have icons for some types so far
		switch (itemType)
		{
			case 'attachment-file':
			case 'attachment-link':
			case 'attachment-snapshot':
			case 'attachment-web-link':
			case 'artwork':
			case 'audioRecording':
			case 'blogPost':
			case 'book':
			case 'bookSection':
			case 'computerProgram':
			case 'email':
			case 'film':
			case 'forumPost':
			case 'interview':
			case 'journalArticle':
			case 'letter':
			case 'magazineArticle':
			case 'manuscript':
			case 'map':
			case 'newspaperArticle':
			case 'note':
			case 'podcast':
			case 'report':
			case 'thesis':
			case 'tvBroadcast':
			case 'videoRecording':
			case 'webpage':
				
				return "chrome://zotero/skin/treeitem-"+itemType+".png";
		}
		
		return "chrome://zotero/skin/treeitem.png";
	}
}

Zotero.ItemTreeView.prototype.isContainer = function(row)
{
	return this._getItemAtRow(row).isRegularItem();
}

Zotero.ItemTreeView.prototype.isContainerOpen = function(row)
{
	return this._dataItems[row].isOpen;
}

Zotero.ItemTreeView.prototype.isContainerEmpty = function(row)
{
	if(this._sourcesOnly) {
		return true;
	} else {
		return (this._getItemAtRow(row).numNotes() == 0 && this._getItemAtRow(row).numAttachments() == 0);
	}
}

Zotero.ItemTreeView.prototype.getLevel = function(row)
{
	return this._getItemAtRow(row).level;
}

// Gets the index of the row's container, or -1 if none (container itself or top-level)
Zotero.ItemTreeView.prototype.getParentIndex = function(row)
{
	if (row==-1)
	{
		return -1;
	}
	var thisLevel = this.getLevel(row);
	if(thisLevel == 0) return -1;
	for(var i = row - 1; i >= 0; i--)
		if(this.getLevel(i) < thisLevel)
			return i;
	return -1;
}

Zotero.ItemTreeView.prototype.hasNextSibling = function(row,afterIndex)
{
	var thisLevel = this.getLevel(row);
	for(var i = afterIndex + 1; i < this.rowCount; i++)
	{	
		var nextLevel = this.getLevel(i);
		if(nextLevel == thisLevel) return true;
		else if(nextLevel < thisLevel) return false;
	}
}

Zotero.ItemTreeView.prototype.toggleOpenState = function(row)
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
		
		newRows = Zotero.Items.get(newRows); 
		
		for(var i = 0; i < newRows.length; i++)
		{
			count++;
			this._showItem(new Zotero.ItemTreeView.TreeRow(newRows[i],thisLevel+1,false), row+i+1); //item ref, before row
		}
	}
	
	this._treebox.beginUpdateBatch();
	
	this._dataItems[row].isOpen = !this._dataItems[row].isOpen;
	this._treebox.rowCountChanged(row+1, count); //tell treebox to repaint these
	this._treebox.invalidateRow(row);
	this._treebox.endUpdateBatch();
	this._refreshHashMap();
}

Zotero.ItemTreeView.prototype.isSorted = function()
{
	for(var i=0, len=this._treebox.columns.count; i<len; i++)
		if(this._treebox.columns.getColumnAt(i).element.getAttribute('sortActive'))
			return true;
	return false;
}

Zotero.ItemTreeView.prototype.cycleHeader = function(column)
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
Zotero.ItemTreeView.prototype.sort = function()
{
	var column = this._treebox.columns.getSortedColumn()
	var order = column.element.getAttribute('sortDirection') == 'descending';
	
	if(column.id == 'typeIcon')
	{
		function columnSort(a,b)
		{
			var typeA = Zotero.getString('itemTypes.'+Zotero.ItemTypes.getName(a.getType()));
			var typeB = Zotero.getString('itemTypes.'+Zotero.ItemTypes.getName(b.getType()));
			
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
Zotero.ItemTreeView.prototype.selectItem = function(id)
{
	var row = this._itemRowMap[id];
	if(row == null)
	{
		var item = Zotero.Items.get(id);
		this.toggleOpenState(this._itemRowMap[item.getSource()]); //opens the parent of the item
		row = this._itemRowMap[id];
	}
		
	this.selection.select(row);
	this._treebox.ensureRowIsVisible(row);
}

/*
 * Delete the selection
 *
 * _force_ deletes item from DB even if removing from a collection
 */
Zotero.ItemTreeView.prototype.deleteSelection = function(eraseChildren, force)
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
		if(this._itemGroup.isLibrary() || force) //erase item from DB
			items[i].ref.erase(eraseChildren);
		else if(this._itemGroup.isCollection())
			this._itemGroup.ref.removeItem(items[i].ref.getID());
	}
	this._treebox.endUpdateBatch();
}

/*
 *  Set the search filter on the view
 */
Zotero.ItemTreeView.prototype.searchText = function(search)
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
Zotero.ItemTreeView.prototype._showItem = function(item, beforeRow)
{
	this._dataItems.splice(beforeRow, 0, item);
	this.rowCount++;
}

/*
 *  Called by view to hide specified row
 */
Zotero.ItemTreeView.prototype._hideItem = function(row)
{
	this._dataItems.splice(row,1);
	this.rowCount--;
}

/*
 *  Returns a reference to the item at row (see Zotero.Item in data_access.js)
 */
Zotero.ItemTreeView.prototype._getItemAtRow = function(row)
{
	return this._dataItems[row];
}

/*
 *  Create hash map of item ids to row indexes
 */
Zotero.ItemTreeView.prototype._refreshHashMap = function()
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
Zotero.ItemTreeView.prototype.saveSelection = function()
{
	var savedSelection = new Array();
	
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
Zotero.ItemTreeView.prototype.rememberSelection = function(selection)
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

Zotero.ItemTreeCommandController = function(tree)
{
	this.tree = tree;
}

Zotero.ItemTreeCommandController.prototype.supportsCommand = function(cmd)
{
	return (cmd == 'cmd_selectAll');
}

Zotero.ItemTreeCommandController.prototype.isCommandEnabled = function(cmd)
{
	return (cmd == 'cmd_selectAll');
}

Zotero.ItemTreeCommandController.prototype.doCommand = function(cmd)
{
	if(cmd == 'cmd_selectAll')
		this.tree.view.selection.selectAll();
}

Zotero.ItemTreeCommandController.prototype.onEvent = function(evt)
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
Zotero.ItemTreeView.prototype.onDragStart = function (evt,transferData,action)
{ 
	transferData.data=new TransferData();
	transferData.data.addDataForFlavour("zotero/item", this.saveSelection());
}

/*
 *  Called by nsDragAndDrop.js for any sort of drop on the tree
 */
Zotero.ItemTreeView.prototype.getSupportedFlavours = function () 
{ 
	var flavors = new FlavourSet();
	flavors.appendFlavour("zotero/item");
	flavors.appendFlavour("text/x-moz-url");
	return flavors; 
}

Zotero.ItemTreeView.prototype.canDrop = function(row, orient)
{
	try
	{
		var dataSet = nsTransferable.get(this.getSupportedFlavours(),
			nsDragAndDrop.getDragData, true);
	}
	catch (e)
	{
		// A work around a limitation in nsDragAndDrop.js -- the mDragSession
		// is not set until the drag moves over another control.
		// (This will only happen if the first drag is from the item list.)
		nsDragAndDrop.mDragSession = nsDragAndDrop.mDragService.getCurrentSession();
		return false;
	}
	
	var data = dataSet.first.first;
	var dataType = data.flavour.contentType;
	var ids = data.data.split(','); // ids of rows we are dragging in
	
	if (row==-1 && orient==-1)
	{
		return true;
	}
	
	// workaround... two different services call canDrop
	// (nsDragAndDrop, and the tree) -- this is for the former,
	// used when dragging between windows
	if (typeof row == 'object')
	{
		// If drag to different window
		if (nsDragAndDrop.mDragSession.sourceNode!=row.target)
		{
			// Check if at least one item (or parent item for children) doesn't
			// already exist in target
			for each(var id in ids)
			{
				var item = Zotero.Items.get(id);
				
				// Skip non-top-level items
				if (!item.isRegularItem() && item.getSource())
				{
					continue;
				}
				// DISABLED: move parent on child drag
				//var source = item.isRegularItem() ? false : item.getSource();
				//if (!this._itemGroup.ref.hasItem(source ? source : id))
				if (!this._itemGroup.ref.hasItem(id))
				{
					return true;
				}
			}
		}
		
		return false;
	}
	
	//Zotero.debug('row is ' + row);
	//Zotero.debug('orient is ' + orient);
	
	// Highlight the rows correctly on drag
	
	var rowItem = this._getItemAtRow(row).ref; //the item we are dragging over
	if (dataType == 'zotero/item')
	{
		// Directly on a row
		if (orient == 0)
		{
			for each(var id in ids)
			{
				var item = Zotero.Items.get(id);
				// Only allow dragging of notes and attachments
				// that aren't already children of the item
				if (!item.isRegularItem() && item.getSource()!=rowItem.getID())
				{
					return true;
				}
			}
		}
		
		// In library, allow children to be dragged out of parent
		else if (this._itemGroup.isLibrary())
		{
			for each(var id in ids)
			{
				// Don't allow drag if any top-level items
				var item = Zotero.Items.get(id);
				if (item.isRegularItem() || !item.getSource())
				{
					return false;
				}
			}
			return true;
		}
		
		return false;
	}
	/*
	else if (dataType == "text/x-moz-url")
	{
		return true;
	}
	*/
	
	return false;
}

/*
 *  Called when something's been dropped on or next to a row
 */
Zotero.ItemTreeView.prototype.drop = function(row, orient)
{
	try
	{
		var dataSet = nsTransferable.get(this.getSupportedFlavours(),
			nsDragAndDrop.getDragData, true);
	}
	catch (e)
	{
		// A work around a limitation in nsDragAndDrop.js -- the mDragSession
		// is not set until the drag moves over another control.
		// (This will only happen if the first drag is from the item list.)
		nsDragAndDrop.mDragSession = nsDragAndDrop.mDragService.getCurrentSession();
		var dataSet = nsTransferable.get(this.getSupportedFlavours(),
			nsDragAndDrop.getDragData, true);
	}
	
	var data = dataSet.first.first;
	var dataType = data.flavour.contentType;
	
	if (dataType == 'zotero/item' && this.canDrop(row, orient))
	{
		var ids = data.data.split(','); // ids of rows we are dragging in
		
		// Dropped directly on a row
		if (orient == 0)
		{
			// If item was a top-level item and it exists in a collection,
			// replace it in collections with the parent item
			rowItem = this._getItemAtRow(row).ref; // the item we are dragging over
			for each(var id in ids)
			{
				var item = Zotero.Items.get(id);
				item.setSource(rowItem.getID());
			}
		}
		
		// Dropped outside of a row
		else
		{
			// Remove from parent and make top-level
			if (this._itemGroup.isLibrary())
			{
				for each(var id in ids)
				{
					var item = Zotero.Items.get(id);
					if (!item.isRegularItem())
					{
						item.setSource();
					}
				}
			}
			// Add to collection
			else
			{
				for each(var id in ids)
				{
					var item = Zotero.Items.get(id);
					var source = item.isRegularItem() ? false : item.getSource();
					
					// Top-level item
					if (!source)
					{
						this._itemGroup.ref.addItem(id);
					}
					// Non-top-level item - currently unused
					else
					{
						// TODO: Prompt before moving source item to collection
						this._itemGroup.ref.addItem(source);
					}
				}
			}
		}
	}
	else if (dataType == 'text/x-moz-url' && this.canDrop(row, orient))
	{
		var url = data.data.split("\n")[0];
		
		/* WAITING FOR INGESTER SUPPORT
		var newItem = Zotero.Ingester.scrapeURL(url);
		
		if(newItem)
			this._getItemAtRow(row).ref.addItem(newItem.getID());
		*/
	}
}

/*
 * Called by nsDragAndDrop.js for any sort of drop on the tree
 */
Zotero.ItemTreeView.prototype.onDrop = function (evt,dropdata,session){ }

Zotero.ItemTreeView.prototype.onDragOver = function (evt,dropdata,session) { }

////////////////////////////////////////////////////////////////////////////////
///
///  Functions for nsITreeView that we have to stub out.
///
////////////////////////////////////////////////////////////////////////////////

Zotero.ItemTreeView.prototype.isSeparator = function(row) 						{ return false; }
Zotero.ItemTreeView.prototype.getRowProperties = function(row, prop) 			{ }
Zotero.ItemTreeView.prototype.getColumnProperties = function(col, prop) 		{ }
Zotero.ItemTreeView.prototype.getCellProperties = function(row, col, prop) 	{ }

Zotero.ItemTreeView.TreeRow = function(ref, level, isOpen)
{
	this.ref = ref;			//the item associated with this
	this.level = level;
	this.isOpen = isOpen;
}

Zotero.ItemTreeView.TreeRow.prototype.isNote = function()
{
	return this.ref.isNote();
}

Zotero.ItemTreeView.TreeRow.prototype.isAttachment = function()
{
	return this.ref.isAttachment();
}

Zotero.ItemTreeView.TreeRow.prototype.isRegularItem = function()
{
	return this.ref.isRegularItem();
}

Zotero.ItemTreeView.TreeRow.prototype.getField = function(field)
{
	return this.ref.getField(field);
}

Zotero.ItemTreeView.TreeRow.prototype.getType = function()
{
	return this.ref.getType();
}

Zotero.ItemTreeView.TreeRow.prototype.numChildren = function()
{
	if(this.isRegularItem())
		return this.ref.numChildren();
	else
		return 0;
}

Zotero.ItemTreeView.TreeRow.prototype.numNotes = function()
{
	if(this.isRegularItem())
		return this.ref.numNotes();
	else
		return 0;
}

Zotero.ItemTreeView.TreeRow.prototype.numAttachments = function()
{
	if(this.isRegularItem())
		return this.ref.numAttachments();
	else
		return 0;
}