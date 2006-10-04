/*
	Zotero
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
*/

/*
 * This object contains the various functions for the interface
 */
var ZoteroPane = new function()
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
	this.editSelectedCollection = editSelectedCollection;
	this.search = search;
	this.getCollectionsView = getCollectionsView;
	this.getItemsView = getItemsView;
	this.selectItem = selectItem;
	this.getSelectedCollection = getSelectedCollection;
	this.getSelectedSavedSearch = getSelectedSavedSearch;
	this.getSelectedItems = getSelectedItems;
	this.buildCollectionContextMenu = buildCollectionContextMenu;
	this.buildItemContextMenu = buildItemContextMenu;
	this.onDoubleClick = onDoubleClick;
	this.openNoteWindow = openNoteWindow;
	this.newNote = newNote;
	this.addItemFromPage = addItemFromPage;
	this.addAttachmentFromDialog = addAttachmentFromDialog;
	this.addAttachmentFromPage = addAttachmentFromPage;
	this.viewSelectedAttachment = viewSelectedAttachment;
	this.showSelectedAttachmentInFilesystem = showSelectedAttachmentInFilesystem;
	
	/*
	 * Called when the window is open
	 */
	function onLoad()
	{
		if(Zotero.Prefs.get("zoteroPaneOnTop"))
		{
			var oldPane = document.getElementById('zotero-pane');
			var oldSplitter = document.getElementById('zotero-splitter');
			var appContent = document.getElementById('appcontent');
			
			var newPane = document.createElement('hbox');
			newPane.setAttribute('id','zotero-pane');
			newPane.setAttribute('collapsed',true);
			newPane.setAttribute('flex','1');
			newPane.height = oldPane.height;
			while(oldPane.hasChildNodes())
				newPane.appendChild(oldPane.firstChild);
			appContent.removeChild(oldPane);
			appContent.insertBefore(newPane, document.getElementById('content'));
			
			var newSplitter = document.createElement('splitter');
			newSplitter.setAttribute('id','zotero-splitter');
			newSplitter.setAttribute('collapsed',true);
			newSplitter.setAttribute('resizebefore','closest');
			newSplitter.setAttribute('resizeafter','closest');
			appContent.removeChild(oldSplitter);
			appContent.insertBefore(newSplitter, document.getElementById('content'));
			
			document.getElementById('tb-fullscreen').setAttribute('zoterotop','true');
		}
		
		//Initialize collections view
		collectionsView = new Zotero.CollectionTreeView();
		var collectionsTree = document.getElementById('collections-tree');
		collectionsTree.view = collectionsView;
		collectionsTree.controllers.appendController(new Zotero.CollectionTreeCommandController(collectionsTree));
		
		var itemsTree = document.getElementById('items-tree');
		itemsTree.controllers.appendController(new Zotero.ItemTreeCommandController(itemsTree));
		
		// Create the New Item (+) menu with each item type
		var addMenu = document.getElementById('tb-add').firstChild;
		var separator = document.getElementById('tb-add').firstChild.firstChild;
		var moreMenu = document.getElementById('tb-add-more');
		var itemTypes = Zotero.ItemTypes.getPrimaryTypes();
		for(var i = 0; i<itemTypes.length; i++)
		{
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label", Zotero.getString("itemTypes."+itemTypes[i]['name']));
			menuitem.setAttribute("oncommand","ZoteroPane.newItem("+itemTypes[i]['id']+")");
			addMenu.insertBefore(menuitem, separator);
		}
		// Create submenu for secondary item types
		var itemTypes = Zotero.ItemTypes.getSecondaryTypes();
		for(var i = 0; i<itemTypes.length; i++)
		{
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label", Zotero.getString("itemTypes."+itemTypes[i]['name']));
			menuitem.setAttribute("oncommand","ZoteroPane.newItem("+itemTypes[i]['id']+")");
			moreMenu.appendChild(menuitem);
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
	 * Hides/displays the Zotero interface
	 */
	function toggleDisplay()
	{
		// Visible == target visibility
		var visible = document.getElementById('zotero-pane').getAttribute('collapsed') == 'true';
		
		document.getElementById('zotero-pane').setAttribute('collapsed',!visible);
		document.getElementById('zotero-splitter').setAttribute('collapsed',!visible);
		
		if(!visible)
		{
			document.getElementById('content').setAttribute('collapsed', false);
			document.getElementById('tb-fullscreen').setAttribute('fullscreenmode', false);
			
			// Return focus to the browser content pane
			window.content.window.focus();
		}
	}
	
	function fullScreen()
	{
		var visible = document.getElementById('content').getAttribute('collapsed') == 'true';
		document.getElementById('content').setAttribute('collapsed', !visible);
		document.getElementById('zotero-splitter').setAttribute('collapsed', !visible);
		document.getElementById('tb-fullscreen').setAttribute('fullscreenmode', !visible);
	}
		
	/*
	 * Create a new item
	 *
	 * _data_ is an optional object with field:value for itemData
	 */
	function newItem(typeID, data)
	{
		var item = new Zotero.Item(typeID);
		
		for (var i in data)
		{
			item.setField(i, data[i]);
		}
		
		item.save();
		if(itemsView && itemsView._itemGroup.isCollection())
			itemsView._itemGroup.ref.addItem(item.getID());
			
		//set to Info tab
		document.getElementById('zotero-view-item').selectedIndex = 0;
		
		return item;
	}
	
	function newCollection()
	{
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		var untitled = Zotero.getString('pane.collections.untitled');
		untitled = Zotero.DB.getNextName('collections', 'collectionName',
			Zotero.getString('pane.collections.untitled'));
		
		var newName = { value: untitled };
		var result = promptService.prompt(window, "",
			Zotero.getString('pane.collections.name'), newName, "", {});
		
		if (!result)
		{
			return false;
		}
		
		if (!newName.value)
		{
			newName.value = untitled;
		}
		
		Zotero.Collections.add(newName.value);
	}
	
	function newSearch()
	{
		var s = new Zotero.Search();
		s.addCondition('title','contains','');
		
		var untitled = Zotero.getString('pane.collections.untitled');
		untitled = Zotero.DB.getNextName('savedSearches', 'savedSearchName',
			Zotero.getString('pane.collections.untitled'));
		var io = {dataIn: {search: s, name: untitled}, dataOut: null};
		window.openDialog('chrome://zotero/content/searchDialog.xul','','chrome,modal',io);
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
			
			itemsView = new Zotero.ItemTreeView(itemgroup);
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
				var noteEditor = document.getElementById('zotero-note-editor');
				noteEditor.item = null;
				noteEditor.note = item.ref;
				document.getElementById('zotero-view-note-button').setAttribute('noteID',item.ref.getID());
				if(item.ref.getSource())
				{
					document.getElementById('zotero-view-note-button').setAttribute('sourceID',item.ref.getSource());
				}
				else
				{
					document.getElementById('zotero-view-note-button').removeAttribute('sourceID');
				}
				document.getElementById('item-pane').selectedIndex = 2;
			}
			else if(item.isAttachment())
			{
				// DEBUG: this is annoying -- we really want to use an abstracted
				// version of createValueElement() from itemPane.js
				// (ideally in an XBL binding)
				
				// Wrap title to multiple lines if necessary
				var label = document.getElementById('zotero-attachment-label');
				while (label.hasChildNodes())
				{
					label.removeChild(label.firstChild);
				}
				var val = item.getField('title');
				
				var firstSpace = val.indexOf(" ");
				// Crop long uninterrupted text
				if ((firstSpace == -1 && val.length > 29 ) || firstSpace > 29)
				{
					label.setAttribute('crop', 'end');
					label.setAttribute('value', val);
				}
				// Create a <description> element, essentially
				else
				{
					label.appendChild(document.createTextNode(val));
				}
				
				// For the time being, use a silly little popup
				label.className = 'clicky';
				label.onclick = function(event){
					var newTitle = prompt(Zotero.getString('itemFields.title') + ':', val);
					if (newTitle && newTitle != val)
					{
						item.ref.setField('title', newTitle);
						item.ref.save();
					}
				}
				
				
				// Metadata for URL's
				if (item.ref.getAttachmentLinkMode() == Zotero.Attachments.LINK_MODE_LINKED_URL
					|| item.ref.getAttachmentLinkMode() == Zotero.Attachments.LINK_MODE_IMPORTED_URL)
				{
					// "View Page"/"View Snapshot" label
					if (item.ref.getAttachmentLinkMode() == Zotero.Attachments.LINK_MODE_IMPORTED_URL)
					{
						var str = Zotero.getString('pane.item.attachments.view.snapshot');
					}
					else
					{
						var str = Zotero.getString('pane.item.attachments.view.link');
					}
					
					document.getElementById('zotero-attachment-show').setAttribute('hidden', true);
					
					// URL
					document.getElementById('zotero-attachment-url').setAttribute('value', item.getField('url'));
					document.getElementById('zotero-attachment-url').setAttribute('hidden', false);
					// Access date
					document.getElementById('zotero-attachment-accessed').setAttribute('value',
						Zotero.getString('itemFields.accessDate') + ': '
						+ Zotero.Date.sqlToDate(item.getField('accessDate'), true).toLocaleString());
					document.getElementById('zotero-attachment-accessed').setAttribute('hidden', false);
				}
				// Metadata for files
				else
				{
					var str = Zotero.getString('pane.item.attachments.view.file');
					document.getElementById('zotero-attachment-show').setAttribute('hidden', false);
					document.getElementById('zotero-attachment-url').setAttribute('hidden', true);
					document.getElementById('zotero-attachment-accessed').setAttribute('hidden', true);
				}
				
				document.getElementById('zotero-attachment-view').setAttribute('label', str);
				
				var noteEditor = document.getElementById('zotero-attachment-note-editor');
				noteEditor.item = null;
				noteEditor.note = item.ref;
				
				document.getElementById('item-pane').selectedIndex = 3;
			}
			else
			{
				ZoteroItemPane.viewItem(item.ref);
				document.getElementById('item-pane').selectedIndex = 1;
			}
		}
		else
		{
			document.getElementById('item-pane').selectedIndex = 0;
			
			var label = document.getElementById('zotero-view-selected-label');
		
			if(itemsView && itemsView.selection.count)
				label.value = Zotero.getString('pane.item.selected.multiple').replace('%1', itemsView.selection.count);	
			else
				label.value = Zotero.getString('pane.item.selected.zero');
		}

	}
	
	
	/*
	 *  _force_ deletes item from DB even if removing from a collection or search
	 */
	function deleteSelectedItem(force)
	{
		if(itemsView && itemsView.selection.count > 0)
		{
			if (!force){
				if (itemsView._itemGroup.isCollection()){
					var noPrompt = true;
				}
				// Do nothing in search view
				else if (itemsView._itemGroup.isSearch()){
					return;
				}
			}
			
			var eraseChildren = {value: true};
			var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                    						.getService(Components.interfaces.nsIPromptService);
			var hasChildren;
			
			if(!getSelectedCollection())
			{
				var start = new Object();
				var end = new Object();
				for (var i=0, len=itemsView.selection.getRangeCount(); i<len; i++)
				{
					itemsView.selection.getRangeAt(i,start,end);
					for (var j=start.value; j<=end.value; j++)
						if (itemsView._getItemAtRow(j).numChildren())
						{
							hasChildren = true;
							break;
						}
				}
			}
			
			if (noPrompt || promptService.confirmCheck(
				window,
				Zotero.getString('pane.items.delete.title'),
				Zotero.getString('pane.items.delete' + (itemsView.selection.count>1 ? '.multiple' : '')),
				hasChildren ? Zotero.getString('pane.items.delete.attached') : '',
				eraseChildren))
			{
				itemsView.deleteSelection(eraseChildren.value, force);
			}
		}
	}
	
	function deleteSelectedCollection()
	{
		if (collectionsView.selection.count == 1)
		{
			var row =
				collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			
			if (row.isCollection())
			{
				if (confirm(Zotero.getString('pane.collections.delete')))
				{
					collectionsView.deleteSelection();
				}
			}
			else if (row.isSearch())
			{
				if (confirm(Zotero.getString('pane.collections.deleteSearch')))
				{
					collectionsView.deleteSelection();
				}
			}
		}
	}
	
	function editSelectedCollection()
	{
		if(collectionsView.selection.count > 0)
		{
			var collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			
			if(collection.isCollection())
			{
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
				
				var newName = { value: collection.getName() };
				var result = promptService.prompt(window, "",
					Zotero.getString('pane.collections.rename'), newName, "", {});
				
				if (result && newName.value)
				{
					collection.ref.rename(newName.value);
				}
			}
			else
			{
				var s = new Zotero.Search();
				s.load(collection.ref['id']);
				var io = {dataIn: {search: s, name: collection.getName()}, dataOut: null};
				window.openDialog('chrome://zotero/content/searchDialog.xul','','chrome,modal',io);
				if(io.dataOut)
					onCollectionSelected(); //reload itemsView
			}
		}
	}
	
	function search()
	{
		if(itemsView)
		{
			var searchVal = document.getElementById('tb-search').value;
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
				
				var item = Zotero.Items.get(id);
				var collectionID = itemsView._itemGroup.ref.getID();
				if(!item.isRegularItem())
				{ 
					if(!Zotero.Items.get(item.getSource()).inCollection(collectionID))
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
			var collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			if(collection && collection.isCollection())
				return collection.ref;
		}
	}
	
	function getSelectedSavedSearch()
	{
		if(collectionsView.selection.count > 0 && collectionsView.selection.currentIndex != -1)
		{
			var collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			if(collection && collection.isSearch())
			{
				return collection.ref;
			}
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
		var menu = document.getElementById('zotero-collectionmenu');
		
		// Collection
		if (collectionsView.selection.count == 1 &&
			collectionsView._getItemAtRow(collectionsView.selection.currentIndex).isCollection())
		{
			var hide = [4,6,9,11,12];
			var show = [3,5,7,8,10];
			if (itemsView.rowCount>0)
			{
				var enable = [8,10];
			}
			else
			{
				var disable = [8,10];
			}
		
		}
		// Saved Search
		else if (collectionsView.selection.count == 1 &&
			collectionsView._getItemAtRow(collectionsView.selection.currentIndex).isSearch())
		{
			var hide = [3,5,8,10,12];
			var show = [4,6,7,9,11];
			if (itemsView.rowCount>0)
			{
				var enable = [9,11];
			}
			else
			{
				var disable = [9,11];
			}
		}
		// Library
		else
		{
			var hide = [3,4,5,6,7,8,9,10,11];
			var show = [12];
		}
		
		for (var i in disable)
		{
			menu.childNodes[disable[i]].setAttribute('disabled', true);
		}
		
		for (var i in enable)
		{
			menu.childNodes[enable[i]].setAttribute('disabled', false);
		}
		
		for (var i in hide)
		{
			menu.childNodes[hide[i]].setAttribute('hidden', true);
		}
		
		for (var i in show)
		{
			menu.childNodes[show[i]].setAttribute('hidden', false);
		}
	}
	
	function buildItemContextMenu()
	{
		var menu = document.getElementById('zotero-itemmenu');
		
		if(itemsView && itemsView.selection.count > 0)
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
		
		var multiple = (itemsView && itemsView.selection.count > 1) ? '.multiple' : '';
		
		if (itemsView._itemGroup.isCollection())
		{
			menu.childNodes[2].setAttribute('label', Zotero.getString('pane.items.menu.remove' + multiple));
			menu.childNodes[2].setAttribute('hidden', false);
		}
		else
		{
			menu.childNodes[2].setAttribute('hidden', true);
		}
		
		menu.childNodes[3].setAttribute('label', Zotero.getString('pane.items.menu.erase' + multiple));
		menu.childNodes[5].setAttribute('label', Zotero.getString('pane.items.menu.export' + multiple));
		menu.childNodes[6].setAttribute('label', Zotero.getString('pane.items.menu.createBib' + multiple));
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
					document.getElementById('zotero-view-note-button').doCommand();
				}
				else if(item && item.isAttachment())
				{
					viewSelectedAttachment();
				}
			}
		}
	}
	
	function newNote(popup)
	{
		if (!popup)
		{
			var item = this.newItem(Zotero.ItemTypes.getID('note'));
			document.getElementById('zotero-note-editor').focus();
		}
		else
		{
			var c = getSelectedCollection();
			if (c)
			{
				openNoteWindow(null, c.getID());
			}
			else
			{
				openNoteWindow();
			}
		}
	}
	
	function openNoteWindow(id, parent)
	{
		window.open('chrome://zotero/content/note.xul?v=1'+(id ? '&id='+id : '')+(parent ? '&coll='+parent : ''),'','chrome,resizable,centerscreen');
	}
	
	function addAttachmentFromDialog(link, id)
	{
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
        					.createInstance(nsIFilePicker);
		fp.init(window, Zotero.getString('pane.item.attachments.select'), nsIFilePicker.modeOpen);
		
		if(fp.show() == nsIFilePicker.returnOK)
		{
			var attachmentID;
			if(link)
				attachmentID = Zotero.Attachments.linkFromFile(fp.file, id);
			else
				attachmentID = Zotero.Attachments.importFromFile(fp.file, id);
		
			if(attachmentID && !id)
			{
				var c = getSelectedCollection();
				if(c)
					c.addItem(attachmentID);
			}
		}
	}
	
	
	function addItemFromPage()
	{
		var data = {
			title: window.content.document.title,
			url: window.content.document.location.href,
			accessDate: "CURRENT_TIMESTAMP"
		}
		
		newItem(Zotero.ItemTypes.getID('webpage'), data);
	}
	
	
	function addAttachmentFromPage(link, id)
	{
		if(link)
		{
			var attachmentID =
				Zotero.Attachments.linkFromDocument(window.content.document, id);
		}
		else
		{
			var attachmentID =
				Zotero.Attachments.importFromDocument(window.content.document, id);
		}
		
		if (attachmentID && itemsView && itemsView._itemGroup.isCollection())
		{
			itemsView._itemGroup.ref.addItem(attachmentID);
		}
	}
	
	
	function viewSelectedAttachment()
	{
		if(itemsView && itemsView.selection.count == 1)
		{
			var attachment = getSelectedItems()[0];
			
			if(attachment.getAttachmentLinkMode() != Zotero.Attachments.LINK_MODE_LINKED_URL)
			{
				var file = attachment.getFile();
				if (Zotero.MIME.fileHasInternalHandler(file))
				{
					window.loadURI(attachment.getLocalFileURL());
				}
				else {
					file.launch();
				}
			}
			else
			{
				window.loadURI(attachment.getField('url'));
			}
		}
	}
	
	
	function showSelectedAttachmentInFilesystem()
	{
		if(itemsView && itemsView.selection.count == 1)
		{
			var attachment = getSelectedItems()[0];
			
			if (attachment.getAttachmentLinkMode() != Zotero.Attachments.LINK_MODE_LINKED_URL)
			{
				var file = attachment.getFile();
				file.reveal();
			}
		}
	}
}

window.addEventListener("load", function(e) { ZoteroPane.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ZoteroPane.onUnload(e); }, false);