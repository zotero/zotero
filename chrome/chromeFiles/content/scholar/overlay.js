/*
	Scholar
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
	
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

/*
 * This object contains the various functions for the interface
 */
var ScholarPane = new function()
{
	var collectionsView;
	var itemsView;
	
	//Privileged methods
	this.onLoad = onLoad;
	this.onUnload = onUnload;
	this.toggleDisplay = toggleDisplay;
	this.fullScreen = fullScreen;
	this.newItem = newItem;
	this.newCollection = newCollection;
	this.newSearch = newSearch;
	this.onCollectionSelected = onCollectionSelected;
	this.itemSelected = itemSelected;
	this.deleteSelectedItem = deleteSelectedItem;
	this.deleteSelectedCollection = deleteSelectedCollection;
	this.renameSelectedCollection = renameSelectedCollection;
	this.search = search;
	this.getCollectionsView = getCollectionsView;
	this.getItemsView = getItemsView;
	this.selectItem = selectItem;
	this.getSelectedCollection = getSelectedCollection;
	this.getSelectedItems = getSelectedItems;
	this.buildCollectionContextMenu = buildCollectionContextMenu;
	this.buildItemContextMenu = buildItemContextMenu;
	this.onDoubleClick = onDoubleClick;
	this.openNoteWindow = openNoteWindow;
	this.newNote = newNote;
	this.addAttachmentFromDialog = addAttachmentFromDialog;
	this.addAttachmentFromPage = addAttachmentFromPage;
	this.viewSelectedAttachment = viewSelectedAttachment;
	
	/*
	 * Called when the window is open
	 */
	function onLoad()
	{
		if(Scholar.Prefs.get("scholarPaneOnTop"))
		{
			var oldPane = document.getElementById('scholar-pane');
			var oldSplitter = document.getElementById('scholar-splitter');
			var appContent = document.getElementById('appcontent');
			
			var newPane = document.createElement('hbox');
			newPane.setAttribute('id','scholar-pane');
			newPane.setAttribute('collapsed',true);
			newPane.setAttribute('flex','1');
			newPane.height = oldPane.height;
			while(oldPane.hasChildNodes())
				newPane.appendChild(oldPane.firstChild);
			appContent.removeChild(oldPane);
			appContent.insertBefore(newPane, document.getElementById('content'));
			
			var newSplitter = document.createElement('splitter');
			newSplitter.setAttribute('id','scholar-splitter');
			newSplitter.setAttribute('collapsed',true);
			newSplitter.setAttribute('resizebefore','closest');
			newSplitter.setAttribute('resizeafter','closest');
			appContent.removeChild(oldSplitter);
			appContent.insertBefore(newSplitter, document.getElementById('content'));
			
			document.getElementById('tb-fullscreen').setAttribute('scholartop','true');
		}
		
		//Initialize collections view
		collectionsView = new Scholar.CollectionTreeView();
		var collectionsTree = document.getElementById('collections-tree');
		collectionsTree.view = collectionsView;
		collectionsTree.controllers.appendController(new Scholar.CollectionTreeCommandController(collectionsTree));
		
		var itemsTree = document.getElementById('items-tree');
		itemsTree.controllers.appendController(new Scholar.ItemTreeCommandController(itemsTree));
		
		//Create the add menu with each item type
		var addMenu = document.getElementById('tb-add').firstChild;
		var itemTypes = Scholar.ItemTypes.getTypes();
		for(var i = 0; i<itemTypes.length; i++)
		{
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label", Scholar.getString("itemTypes."+itemTypes[i]['name']));
			menuitem.setAttribute("oncommand","ScholarPane.newItem("+itemTypes[i]['id']+")");
			addMenu.appendChild(menuitem);
		}
	}
	
	/*
	 * Called when the window closes
	 */
	function onUnload()
	{
		collectionsView.unregister();
		if(itemsView)
			itemsView.unregister();
	}

	/*
	 * Hides/displays the Scholar interface
	 */
	function toggleDisplay()
	{
		var visible = document.getElementById('scholar-pane').getAttribute('collapsed') == 'true';
		
		document.getElementById('scholar-pane').setAttribute('collapsed',!visible);
		document.getElementById('scholar-splitter').setAttribute('collapsed',!visible);
		
		if(!visible)
		{
			document.getElementById('content').setAttribute('collapsed', false);
			document.getElementById('tb-fullscreen').setAttribute('fullscreenmode', false);
		}
	}
	
	function fullScreen()
	{
		var visible = document.getElementById('content').getAttribute('collapsed') == 'true';
		document.getElementById('content').setAttribute('collapsed', !visible);
		document.getElementById('scholar-splitter').setAttribute('collapsed', !visible);
		document.getElementById('tb-fullscreen').setAttribute('fullscreenmode', !visible);
	}
		
	/*
	 * Create a new item
	 */
	function newItem(typeID)
	{
		if(document.getElementById('tb-search').value != "")
		{
			document.getElementById('tb-search').value = "";
			document.getElementById('tb-search').doCommand();
		}
		
		var item = new Scholar.Item(typeID);
		item.save();
		if(itemsView && itemsView._itemGroup.isCollection())
			itemsView._itemGroup.ref.addItem(item.getID());
			
		//set to Info tab
		document.getElementById('scholar-view-item').selectedIndex = 0;
		
		return item;
	}
	
	function newCollection()
	{
		Scholar.Collections.add(Scholar.getString('pane.collections.untitled'));
	}
	
	function newSearch()
	{
		var s = new Scholar.Search();
		s.addCondition('title','contains','');
		
		var io = {dataIn: {search: s, name: 'Untitled'}, dataOut: null};
		window.openDialog('chrome://scholar/content/searchDialog.xul','','chrome,modal',io);

		if(io.dataOut)
			getCollectionsView().reload(); //we don't have notification support for searches
	}
	
	function onCollectionSelected()
	{
		if(itemsView)
			itemsView.unregister();
		
		document.getElementById('tb-search').value = "";
		
		if(collectionsView.selection.count == 1 && collectionsView.selection.currentIndex != -1)
		{
			var itemgroup = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			itemgroup.setSearch('');
			
			itemsView = new Scholar.ItemTreeView(itemgroup);
			document.getElementById('items-tree').view = itemsView;
			document.getElementById('tb-collection-rename').disabled = itemgroup.isLibrary();
			itemsView.selection.clearSelection();
		}
		else
		{
			document.getElementById('items-tree').view = itemsView = null;
			document.getElementById('tb-collection-rename').disabled = true;
		}
	}
	
	function itemSelected()
	{
		if(itemsView && itemsView.selection.count == 1 && itemsView.selection.currentIndex != -1)
		{
			var item = itemsView._getItemAtRow(itemsView.selection.currentIndex);
			
			if(item.isNote())
			{
				var noteEditor = document.getElementById('scholar-note-editor');
				noteEditor.item = null;
				noteEditor.note = item.ref;
				document.getElementById('scholar-view-note-button').setAttribute('noteID',item.ref.getID());
				if(item.ref.getSource() != null)
					document.getElementById('scholar-view-note-button').setAttribute('sourceID',item.ref.getSource());
				else
					document.getElementById('scholar-view-note-button').removeAttribute('sourceID');
				document.getElementById('item-pane').selectedIndex = 2;
			}
			else if(item.isAttachment())
			{
				document.getElementById('scholar-attachment-label').setAttribute('value',item.getField('title'));
				document.getElementById('scholar-attachment-view').setAttribute('disabled', item.ref.getAttachmentLinkMode() == Scholar.Attachments.LINK_MODE_LINKED_URL);
				document.getElementById('scholar-attachment-links').item = item.ref;
				document.getElementById('item-pane').selectedIndex = 3;
			}
			else
			{
				ScholarItemPane.viewItem(item.ref);
				document.getElementById('item-pane').selectedIndex = 1;
			}
		}
		else
		{
			document.getElementById('item-pane').selectedIndex = 0;
			
			var label = document.getElementById('scholar-view-selected-label');
		
			if(itemsView && itemsView.selection.count)
				label.value = Scholar.getString('pane.item.selected.multiple').replace('%1', itemsView.selection.count);	
			else
				label.value = Scholar.getString('pane.item.selected.zero');
		}

	}
	
	function deleteSelectedItem()
	{
		if(itemsView && itemsView.selection.count > 0)
		{
			var eraseChildren = {value: true};
			var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                    						.getService(Components.interfaces.nsIPromptService);
			var hasChildren;
			
			if(!getSelectedCollection())
			{
				var start = new Object();
				var end = new Object();
				for (var i=0, len=itemsView.selection.getRangeCount(); i<len && !hasChildren; i++)
				{
					itemsView.selection.getRangeAt(i,start,end);
					for (var j=start.value; j<=end.value && !hasChildren; j++)
						if(itemsView._getItemAtRow(j).numChildren())
							hasChildren = true;
				}
			}

			if(promptService.confirmCheck(window, Scholar.getString('pane.items.delete.title'), Scholar.getString('pane.items.delete'), ( hasChildren ? Scholar.getString('pane.items.delete.attached') : ''), eraseChildren))
				itemsView.deleteSelection(eraseChildren.value);
		}
	}
	
	function deleteSelectedCollection()
	{
		if(collectionsView.selection.count > 0 && confirm(Scholar.getString('pane.collections.delete')))
			collectionsView.deleteSelection();
	}
	
	function renameSelectedCollection()
	{
		if(collectionsView.selection.count > 0)
		{
			var collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			
			if(collection.isCollection())
			{
				var newName = prompt(Scholar.getString('pane.collections.rename'),collection.getName());
				if(newName)
					collection.ref.rename(newName);
			}
			else
			{
				var s = new Scholar.Search();
				s.load(collection.ref['id']);
				var io = {dataIn: {search: s, name: collection.getName()}, dataOut: null};
				window.openDialog('chrome://scholar/content/searchDialog.xul','','chrome,modal',io);
				if(io.dataOut)
					onCollectionSelected(); //reload itemsView
			}
		}
	}
	
	function search()
	{
		if(itemsView)
		{
			searchVal = document.getElementById('tb-search').value;
			itemsView.searchText(searchVal);
			
			document.getElementById('tb-search-cancel').hidden = searchVal == "";
		}
		
	}
	
	function getCollectionsView()
	{
		return collectionsView;
	}
	
	function getItemsView()
	{
		return itemsView;
	}
	
	function selectItem(id)
	{
		if(itemsView)
		{
			if(!itemsView._itemGroup.isLibrary())
			{
				//select the Library if the item is not in the current collection
				
				var item = Scholar.Items.get(id);
				var collectionID = itemsView._itemGroup.ref.getID();
				if(!item.isRegularItem())
				{ 
					if(!Scholar.Items.get(item.getSource()).inCollection(collectionID))
						collectionsView.selection.select(0);
				}
				else if(!item.inCollection(collectionID))
					collectionsView.selection.select(0);
			}
			itemsView.selectItem(id);
		}
	}
	
	function getSelectedCollection()
	{
		if(collectionsView.selection.count > 0 && collectionsView.selection.currentIndex != -1)
		{
			collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			if(collection && collection.isCollection())
				return collection.ref;
		}
	}
	
	function getSelectedItems()
	{
		if(itemsView)
		{
			var items = new Array();
			var start = new Object();
			var end = new Object();
			for (var i=0, len=itemsView.selection.getRangeCount(); i<len; i++)
			{
				itemsView.selection.getRangeAt(i,start,end);
				for (var j=start.value; j<=end.value; j++)
					items.push(itemsView._getItemAtRow(j).ref);
			}
		}
		return items;
	}
	
	function buildCollectionContextMenu()
	{
		var menu = document.getElementById('scholar-collectionmenu');
		
		if(collectionsView.selection.count == 1 && !collectionsView._getItemAtRow(collectionsView.selection.currentIndex).isLibrary())
		{
			menu.childNodes[2].removeAttribute('disabled');
			menu.childNodes[3].removeAttribute('disabled');
			menu.childNodes[5].removeAttribute('disabled');
			menu.childNodes[6].removeAttribute('disabled');
		}
		else
		{
			menu.childNodes[2].setAttribute('disabled', true);
			menu.childNodes[3].setAttribute('disabled', true);
			menu.childNodes[5].setAttribute('disabled', true);
			menu.childNodes[6].setAttribute('disabled', true);
		}
	}
	
	function buildItemContextMenu()
	{
		var menu = document.getElementById('scholar-itemmenu');
		
		if(itemsView && itemsView.selection.count > 0)
		{
			menu.childNodes[2].removeAttribute('disabled');
			menu.childNodes[4].removeAttribute('disabled');
			menu.childNodes[5].removeAttribute('disabled');
		}
		else
		{
			menu.childNodes[2].setAttribute('disabled', true);
			menu.childNodes[4].setAttribute('disabled', true);
			menu.childNodes[5].setAttribute('disabled', true);
		}
	
		if(itemsView && itemsView.selection.count > 1)
		{
			menu.childNodes[2].setAttribute('label', Scholar.getString('pane.items.menu.remove.multiple'));
			menu.childNodes[4].setAttribute('label', Scholar.getString('pane.items.menu.export.multiple'));
			menu.childNodes[5].setAttribute('label', Scholar.getString('pane.items.menu.createBib.multiple'));
		}
		else
		{
			menu.childNodes[2].setAttribute('label', Scholar.getString('pane.items.menu.remove'));
			menu.childNodes[4].setAttribute('label', Scholar.getString('pane.items.menu.export'));
			menu.childNodes[5].setAttribute('label', Scholar.getString('pane.items.menu.createBib'));
		}
	}
	
	// Adapted from: http://www.xulplanet.com/references/elemref/ref_tree.html#cmnote-9
	function onDoubleClick(event, tree)
	{
		if (event && tree && (event.type == "click" || event.type == "dblclick"))
		{
			var row = {}, col = {}, obj = {};
			tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
			// obj.value == cell/text/image
			// TODO: handle collection double-click
			if (obj.value && itemsView && itemsView.selection.currentIndex > -1)
			{
				var item = getSelectedItems()[0];
				if(item && item.isNote())
				{
					document.getElementById('scholar-view-note-button').doCommand();
				}
				else if(item && item.isAttachment())
				{
					viewSelectedAttachment();
				}
			}
		}
	}
	
	function newNote()
	{
		var c = getSelectedCollection();
		if(c)
			openNoteWindow(null, c.getID());
		else
			openNoteWindow();
	}
	
	function openNoteWindow(id, parent)
	{
		window.open('chrome://scholar/content/note.xul?v=1'+(id ? '&id='+id : '')+(parent ? '&coll='+parent : ''),'','chrome,resizable,centerscreen');
	}
	
	function addAttachmentFromDialog(link, id)
	{
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
        					.createInstance(nsIFilePicker);
		fp.init(window, Scholar.getString('pane.item.attachments.select'), nsIFilePicker.modeOpen);
		
		if(fp.show() == nsIFilePicker.returnOK)
		{
			var attachmentID;
			if(link)
				attachmentID = Scholar.Attachments.linkFromFile(fp.file, id);
			else
				attachmentID = Scholar.Attachments.importFromFile(fp.file, id);
		
			if(attachmentID && !id)
			{
				var c = getSelectedCollection();
				if(c)
					c.addItem(attachmentID);
			}
		}
	}
	
	function addAttachmentFromPage(link, id)
	{
		var item;
		if(id == null)
		{
			item = newItem(Scholar.ItemTypes.getID('website'));
			if(item)
			{
				id = item.getID();
				var c = getSelectedCollection();
				if(c)
					c.addItem(id);
			}
		}
		
		var attachmentID;
		if(link)
			attachmentID = Scholar.Attachments.linkFromDocument(window.content.document, id);
		else
			attachmentID = Scholar.Attachments.importFromDocument(window.content.document, id);
		
		if(attachmentID && item)
		{			
			var attachment = Scholar.Items.get(attachmentID);
			if(attachment)
			{
				item.setField('title',attachment.getField('title'));
				item.save();
			}
		}
	}
	
	function viewSelectedAttachment()
	{
		if(itemsView && itemsView.selection.count == 1)
		{
			var attachment = getSelectedItems()[0];
			
			if(attachment.getAttachmentLinkMode() != Scholar.Attachments.LINK_MODE_LINKED_URL)
			{
				var file = attachment.getFile();
				if (Scholar.MIME.fileHasInternalHandler(file))
				{
					window.loadURI(attachment.getLocalFileURL());
				}
				else {
					file.launch();
				}
			}
			else
			{
				window.loadURI(attachment.getURL());
			}
		}
	}
}

window.addEventListener("load", function(e) { ScholarPane.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ScholarPane.onUnload(e); }, false);