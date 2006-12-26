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
	this.handleKeyPress = handleKeyPress;
	this.newItem = newItem;
	this.newCollection = newCollection;
	this.newSearch = newSearch;
	this.toggleTagSelector = toggleTagSelector;
	this.getTagSelection = getTagSelection;
	this.updateTagFilter = updateTagFilter;
	this.onCollectionSelected = onCollectionSelected;
	this.itemSelected = itemSelected;
	this.deleteSelectedItem = deleteSelectedItem;
	this.deleteSelectedCollection = deleteSelectedCollection;
	this.editSelectedCollection = editSelectedCollection;
	this.handleSearchKeypress = handleSearchKeypress;
	this.handleSearchInput = handleSearchInput;
	this.search = search;
	this.getCollectionsView = getCollectionsView;
	this.getItemsView = getItemsView;
	this.selectItem = selectItem;
	this.getSelectedCollection = getSelectedCollection;
	this.getSelectedSavedSearch = getSelectedSavedSearch;
	this.getSelectedItems = getSelectedItems;
	this.getSortField = getSortField;
	this.getSortDirection = getSortDirection;
	this.buildCollectionContextMenu = buildCollectionContextMenu;
	this.buildItemContextMenu = buildItemContextMenu;
	this.onDoubleClick = onDoubleClick;
	this.setItemsPaneMessage = setItemsPaneMessage;
	this.clearItemsPaneMessage = clearItemsPaneMessage;
	this.contextPopupShowing = contextPopupShowing;
	this.openNoteWindow = openNoteWindow;
	this.toggleAbstractForSelectedItem = toggleAbstractForSelectedItem
	this.newNote = newNote;
	this.addTextToNote = addTextToNote;
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
			newPane.setAttribute('persist','height');
			newPane.setAttribute('collapsed',true);
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
			
			document.getElementById('zotero-tb-fullscreen').setAttribute('zoterotop','true');
		}
		
		//Initialize collections view
		collectionsView = new Zotero.CollectionTreeView();
		var collectionsTree = document.getElementById('zotero-collections-tree');
		collectionsTree.view = collectionsView;
		collectionsTree.controllers.appendController(new Zotero.CollectionTreeCommandController(collectionsTree));
		
		var itemsTree = document.getElementById('zotero-items-tree');
		itemsTree.controllers.appendController(new Zotero.ItemTreeCommandController(itemsTree));
		
		// Create the New Item (+) menu with each item type
		var addMenu = document.getElementById('zotero-tb-add').firstChild;
		var separator = document.getElementById('zotero-tb-add').firstChild.firstChild;
		var moreMenu = document.getElementById('zotero-tb-add-more');
		var itemTypes = Zotero.ItemTypes.getPrimaryTypes();
		for(var i = 0; i<itemTypes.length; i++)
		{
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label", Zotero.getString("itemTypes."+itemTypes[i]['name']));
			menuitem.setAttribute("oncommand","ZoteroPane.newItem("+itemTypes[i]['id']+")");
			menuitem.setAttribute("tooltiptext", "");
			addMenu.insertBefore(menuitem, separator);
		}
		// Create submenu for secondary item types
		var itemTypes = Zotero.ItemTypes.getSecondaryTypes();
		for(var i = 0; i<itemTypes.length; i++)
		{
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label", Zotero.getString("itemTypes."+itemTypes[i]['name']));
			menuitem.setAttribute("oncommand","ZoteroPane.newItem("+itemTypes[i]['id']+")");
			menuitem.setAttribute("tooltiptext", "");
			moreMenu.appendChild(menuitem);
		}
		
		var menu = document.getElementById("contentAreaContextMenu");
		menu.addEventListener("popupshowing", ZoteroPane.contextPopupShowing, false);
		
		Zotero.Keys.windowInit(document);
	}
	
	/*
	 * Called when the window closes
	 */
	function onUnload()
	{
		var tagSelector = document.getElementById('zotero-tag-selector');
		tagSelector.unregister();
		
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
		
		if (visible) {
			document.getElementById('zotero-pane').focus();
		}
		else {
			document.getElementById('content').setAttribute('collapsed', false);
			document.getElementById('zotero-tb-fullscreen').setAttribute('fullscreenmode', false);
			
			// Return focus to the browser content pane
			window.content.window.focus();
		}
	}
	
	function fullScreen()
	{
		var collapsed = document.getElementById('content').getAttribute('collapsed') == 'true';
		// Turn Z-pane flex on to stretch to window in full-screen, but off otherwise so persist works
		document.getElementById('zotero-pane').setAttribute('flex', collapsed ? "0" : "1");
		document.getElementById('content').setAttribute('collapsed', !collapsed);
		document.getElementById('zotero-splitter').setAttribute('collapsed', !collapsed);
		document.getElementById('zotero-tb-fullscreen').setAttribute('fullscreenmode', !collapsed);
	}
	
	
	function handleKeyPress(event) {
		// Ignore keystrokes if Zotero pane is closed
		if (document.getElementById('zotero-pane').getAttribute('collapsed') == 'true') {
			return;
		}
		
		var useShift = Zotero.isMac;
		
		var key = String.fromCharCode(event.which);
		if (!key) {
			Zotero.debug('No key');
			return;
		}
		
		// Ignore modifiers other than accel-alt (or accel-shift if useShift is on)
		if (!((Zotero.isMac ? event.metaKey : event.ctrlKey) &&
				useShift ? event.shiftKey : event.altKey)) {
			return;
		}
		
		var command = Zotero.Keys.getCommand(key);
		if (!command) {
			return;
		}
		
		Zotero.debug(command);
		
		switch (command) {
			case 'library':
				document.getElementById('zotero-collections-tree').focus();
				collectionsView.selection.select(0);
				break;
			case 'quicksearch':
				document.getElementById('zotero-tb-search').select();
				break;
			case 'newItem':
				newItem(2); // book
				document.getElementById('zotero-editpane-type-menu').focus();
				break;
			case 'newNote':
				// Use key that's not the modifier as the popup toggle
				newNote(useShift ? event.altKey : event.shiftKey);
				break;
			case 'toggleTagSelector':
				toggleTagSelector();
				break;
			case 'toggleFullscreen':
				fullScreen();
				break;
			default:
				throw ('Command "' + command + '" not found in ZoteroPane.handleKeyPress()');
		}
		
		event.preventDefault();
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
	
	function newCollection(parent)
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
			return;
		}
		
		if (!newName.value)
		{
			newName.value = untitled;
		}
		
		Zotero.Collections.add(newName.value, parent);
	}
	
	function newSearch()
	{
		var s = new Zotero.Search();
		s.addCondition('title', 'contains', '');
		
		var untitled = Zotero.getString('pane.collections.untitled');
		untitled = Zotero.DB.getNextName('savedSearches', 'savedSearchName',
			Zotero.getString('pane.collections.untitled'));
		var io = {dataIn: {search: s, name: untitled}, dataOut: null};
		window.openDialog('chrome://zotero/content/searchDialog.xul','','chrome,modal',io);
	}
	
	
	function toggleTagSelector(){
		var tagSelector = document.getElementById('zotero-tag-selector');
		var collapsed = tagSelector.getAttribute('collapsed')=='true';
		tagSelector.setAttribute('collapsed', !collapsed);
		// If showing, set scope to items in current view
		// and focus filter textbox
		if (collapsed) {
			tagSelector.init();
			_setTagScope();
			tagSelector.focusTextbox();
		}
		// If hiding, clear selection
		else {
			tagSelector.uninit();
		}
	}
	
	
	function getTagSelection(){
		var tagSelector = document.getElementById('zotero-tag-selector');
		return tagSelector.selection ? tagSelector.selection : {};
	}
	
	
	/*
	 * Sets the tag filter on the items view
	 */
	function updateTagFilter(){
		itemsView.setFilter('tags', getTagSelection());
	}
	
	
	/*
	 * Set the tags scope to the items in the current view
	 *
	 * Passed to the items tree to trigger on changes
	 */
	function _setTagScope() {
		var itemgroup = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
		var tagSelector = document.getElementById('zotero-tag-selector');
		if (tagSelector.getAttribute('collapsed') == 'false') {
			Zotero.debug('Updating tag selector with current tags');
			tagSelector.scope = itemgroup.getChildTags();
		}
	}
	
	
	function onCollectionSelected()
	{
		if(itemsView)
			itemsView.unregister();
		
		document.getElementById('zotero-tb-search').value = "";
		
		if(collectionsView.selection.count == 1 && collectionsView.selection.currentIndex != -1)
		{
			var itemgroup = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			itemgroup.setSearch('');
			itemgroup.setTags(getTagSelection());
			
			itemsView = new Zotero.ItemTreeView(itemgroup);
			itemsView.addCallback(_setTagScope);
			document.getElementById('zotero-items-tree').view = itemsView;
			itemsView.selection.clearSelection();
		}
		else
		{
			document.getElementById('zotero-items-tree').view = itemsView = null;
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
				document.getElementById('zotero-item-pane-content').selectedIndex = 2;
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
				label.className = 'zotero-clicky';
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
				
				document.getElementById('zotero-item-pane-content').selectedIndex = 3;
			}
			else
			{
				ZoteroItemPane.viewItem(item.ref);
				document.getElementById('zotero-item-pane-content').selectedIndex = 1;
			}
		}
		else
		{
			document.getElementById('zotero-item-pane-content').selectedIndex = 0;
			
			var label = document.getElementById('zotero-view-selected-label');
		
			if(itemsView && itemsView.selection.count)
				label.value = Zotero.getString('pane.item.selected.multiple', itemsView.selection.count);
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
	
	
	function handleSearchKeypress(textbox, event) {
		// Events that turn find-as-you-type on
		if (event.keyCode == event.DOM_VK_ESCAPE) {
			textbox.value = '';
			ZoteroPane.setItemsPaneMessage(Zotero.getString('searchInProgress'));
			setTimeout("document.getElementById('zotero-tb-search').doCommand('cmd_zotero_search'); ZoteroPane.clearItemsPaneMessage();", 1);
		}
		else if (event.keyCode == event.DOM_VK_RETURN ||
			event.keyCode == event.DOM_VK_ENTER) {
			textbox.skipTimeout = true;
			ZoteroPane.setItemsPaneMessage(Zotero.getString('searchInProgress'));
			setTimeout("document.getElementById('zotero-tb-search').doCommand('cmd_zotero_search'); ZoteroPane.clearItemsPaneMessage();", 1);
		}
	}
	
	
	function handleSearchInput(textbox, event) {
		// This is the new length, except, it seems, when the change is a
		// result of Undo or Redo
		if (!textbox.value.length) {
			textbox.skipTimeout = true;
			ZoteroPane.setItemsPaneMessage(Zotero.getString('searchInProgress'));
			setTimeout("document.getElementById('zotero-tb-search').doCommand('cmd_zotero_search'); ZoteroPane.clearItemsPaneMessage();", 1);
		}
		else if (textbox.value.indexOf('"') != -1) {
			ZoteroPane.setItemsPaneMessage(Zotero.getString('advancedSearchMode'));
		}
	}
	
	
	function search()
	{
		if(itemsView)
		{
			var searchVal = document.getElementById('zotero-tb-search').value;
			itemsView.setFilter('search', searchVal);
			
			document.getElementById('zotero-tb-search-cancel').hidden = searchVal == "";
		}
		
	}
	
	/*
	 * Returns Zotero.ItemTreeView instance for collections pane
	 */
	function getCollectionsView()
	{
		return collectionsView;
	}
	
	/*
	 * Returns Zotero.ItemTreeView instance for items pane
	 */
	function getItemsView()
	{
		return itemsView;
	}
	
	
	/*
	 * Select item in current collection or, if not there, in Library
	 *
	 * If _inLibrary_, force switch to Library
	 */
	function selectItem(itemID, inLibrary)
	{
		if (!itemID) {
			return;
		}
		if(itemsView)
		{
			if(!itemsView._itemGroup.isLibrary())
			{
				if (inLibrary) {
					collectionsView.selection.select(0);
				}
				// Select the Library if the item is not in the current collection
				// TODO: does not work in saved searches
				else {
					var item = Zotero.Items.get(itemID);
					var collectionID = itemsView._itemGroup.ref.getID();
					if (!item.isRegularItem()) {
						// If this isn't a regular item, check if the parent is
						// in the collection instead
						if (!Zotero.Items.get(item.getSource()).inCollection(collectionID)) {
							collectionsView.selection.select(0);
						}
					}
					else if (!item.inCollection(collectionID)) {
						collectionsView.selection.select(0);
					}
				}
			}
			itemsView.selectItem(itemID);
		}
	}
	
	function getSelectedCollection(asID)
	{
		if(collectionsView.selection.count > 0 && collectionsView.selection.currentIndex != -1)
		{
			var collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			if (collection && collection.isCollection()) {
				if (asID) {
					return collection.ref.getID();
				}
				else {
					return collection.ref;
				}
			}
		}
		return false;
	}
	
	function getSelectedSavedSearch(asID)
	{
		if(collectionsView.selection.count > 0 && collectionsView.selection.currentIndex != -1)
		{
			var collection = collectionsView._getItemAtRow(collectionsView.selection.currentIndex);
			if (collection && collection.isSearch()) {
				if (asID) {
					return collection.ref.id;
				}
				else {
					return collection.ref;
				}
			}
		}
		return false;
	}
	
	/*
	 * Return an array of Item objects for selected items
	 *
	 * If asIDs is true, return an array of itemIDs instead
	 */
	function getSelectedItems(asIDs)
	{
		if(itemsView)
		{
			var items = new Array();
			var start = new Object();
			var end = new Object();
			for (var i=0, len=itemsView.selection.getRangeCount(); i<len; i++)
			{
				itemsView.selection.getRangeAt(i,start,end);
				for (var j=start.value; j<=end.value; j++) {
					if (asIDs) {
						items.push(itemsView._getItemAtRow(j).ref.getID());
					}
					else {
						items.push(itemsView._getItemAtRow(j).ref);
					}
				}
			}
		}
		return items;
	}
	
	
	function getSortField() {
		if (!itemsView) {
			return false;
		}
		
		return itemsView.getSortField();
	}
	
	
	function getSortDirection() {
		if (!itemsView) {
			return false;
		}
		
		return itemsView.getSortDirection();
	}
	
	
	function buildCollectionContextMenu()
	{
		var menu = document.getElementById('zotero-collectionmenu');
		
		var m = {
			newCollection: 0,
			newSavedSearch: 1,
			newSubcollection: 2,
			sep1: 3,
			editSelectedCollection: 4,
			removeCollection: 5,
			sep2: 6,
			exportCollection: 7,
			createBibCollection: 8,
			exportFile: 9,
			loadReport: 10
		};
		
		// Collection
		if (collectionsView.selection.count == 1 &&
			collectionsView._getItemAtRow(collectionsView.selection.currentIndex).isCollection())
		{
			var hide = [m.newCollection, m.newSavedSearch, m.exportFile];
			var show = [m.newSubcollection, m.sep1, m.editSelectedCollection, m.removeCollection,
				m.sep2, m.exportCollection, m.createBibCollection, m.loadReport];
			if (itemsView.rowCount>0)
			{
				var enable = [m.exportCollection, m.createBibCollection, m.loadReport];
			}
			else
			{
				var disable = [m.exportCollection, m.createBibCollection, m.loadReport];
			}
			
			menu.childNodes[m.editSelectedCollection].setAttribute('label', Zotero.getString('pane.collections.menu.rename.collection'));
			menu.childNodes[m.removeCollection].setAttribute('label', Zotero.getString('pane.collections.menu.remove.collection'));
			menu.childNodes[m.exportCollection].setAttribute('label', Zotero.getString('pane.collections.menu.export.collection'));
			menu.childNodes[m.createBibCollection].setAttribute('label', Zotero.getString('pane.collections.menu.createBib.collection'));
			menu.childNodes[m.loadReport].setAttribute('label', Zotero.getString('pane.collections.menu.generateReport.collection'));
		}
		// Saved Search
		else if (collectionsView.selection.count == 1 &&
			collectionsView._getItemAtRow(collectionsView.selection.currentIndex).isSearch())
		{
			var hide = [m.newCollection, m.newSavedSearch, m.newSubcollection, m.sep1, m.exportFile]
			var show = [m.editSelectedCollection, m.removeCollection, m.sep2, m.exportCollection,
				m.createBibCollection, m.loadReport];
			
			if (itemsView.rowCount>0)
			{
				var enable = [m.exportCollection, m.createBibCollection, m.loadReport];
			}
			else
			{
				var disable = [m.exportCollection, m.createBibCollection, m.loadReport];
			}
			
			menu.childNodes[m.editSelectedCollection].setAttribute('label', Zotero.getString('pane.collections.menu.edit.savedSearch'));
			menu.childNodes[m.removeCollection].setAttribute('label', Zotero.getString('pane.collections.menu.remove.savedSearch'));
			menu.childNodes[m.exportCollection].setAttribute('label', Zotero.getString('pane.collections.menu.export.savedSearch'));
			menu.childNodes[m.createBibCollection].setAttribute('label', Zotero.getString('pane.collections.menu.createBib.savedSearch'));
			menu.childNodes[m.loadReport].setAttribute('label', Zotero.getString('pane.collections.menu.generateReport.savedSearch'));
		}
		// Library
		else
		{
			var hide = [m.newSubcollection, m.editSelectedCollection, m.removeCollection, m.sep2,
				m.exportCollection, m.createBibCollection, m.loadReport];
			var show = [m.newCollection, m.newSavedSearch, m.sep1, m.exportFile];
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
		var m = {
			showInLibrary: 0,
			sep1: 1,
			addNote: 2,
			attachSnapshot: 3,
			attachLink: 4,
			toggleAbstract: 5,
			sep2: 6,
			deleteItem: 7,
			deleteFromLibrary: 8,
			sep3: 9,
			exportItems: 10,
			createBib: 11,
			loadReport: 12
		};
		
		var menu = document.getElementById('zotero-itemmenu');
		
		var enable = [], disable = [], show = [], hide = [], multiple = '';
		
		if(itemsView && itemsView.selection.count > 0)
		{
			enable.push(m.showInLibrary, m.addNote, m.attachSnapshot, m.attachLink, m.sep2,
				m.deleteItem, m.deleteFromLibrary, m.exportItems, m.createBib, m.loadReport);
			
			// Multiple items selected
			if (itemsView.selection.count > 1)
			{
				var multiple =  '.multiple';
				hide.push(m.showInLibrary, m.sep1, m.addNote, m.attachSnapshot,
					m.attachLink, m.toggleAbstract, m.sep2);
			}
			// Single item selected
			else
			{
				var item = itemsView._getItemAtRow(itemsView.selection.currentIndex).ref;
				var itemID = item.getID();
				menu.setAttribute('itemID', itemID);
				
				// Show in Library
				if (!itemsView._itemGroup.isLibrary()) {
					show.push(m.showInLibrary, m.sep1);
				}
				else {
					hide.push(m.showInLibrary, m.sep1);
				}
				
				if (item.isRegularItem())
				{
					show.push(m.addNote, m.attachSnapshot, m.attachLink, m.sep2);
					hide.push(m.toggleAbstract);
				}
				else
				{
					hide.push(m.addNote, m.attachSnapshot, m.attachLink);
					
					// Abstract
					if (item.isNote() && item.getSource()) {
						show.push(m.toggleAbstract, m.sep2);
						if (item.isAbstract()) {
							menu.childNodes[m.toggleAbstract].setAttribute('label', Zotero.getString('pane.items.menu.abstract.unset'));
						}
						else {
							menu.childNodes[m.toggleAbstract].setAttribute('label', Zotero.getString('pane.items.menu.abstract.set'));
						}
					}
					else {
						hide.push(m.toggleAbstract, m.sep2);
					}
				}
			}
		}
		else
		{
			// Show in Library
			if (!itemsView._itemGroup.isLibrary()) {
				show.push(m.showInLibrary, m.sep1);
			}
			else {
				hide.push(m.showInLibrary, m.sep1);
			}
			
			disable.push(m.showInLibrary, m.addNote, m.attachSnapshot, m.attachLink,
				m.deleteItem, m.deleteFromLibrary, m.exportItems, m.createBib, m.loadReport);
			hide.push(m.toggleAbstract);
			show.push(m.sep2);
		}
		
		// Remove from collection
		if (itemsView._itemGroup.isCollection())
		{
			menu.childNodes[m.deleteItem].setAttribute('label', Zotero.getString('pane.items.menu.remove' + multiple));
			show.push(m.deleteItem);
		}
		else
		{
			hide.push(m.deleteItem);
		}
		
		// Plural if necessary
		menu.childNodes[m.deleteFromLibrary].setAttribute('label', Zotero.getString('pane.items.menu.erase' + multiple));
		menu.childNodes[m.exportItems].setAttribute('label', Zotero.getString('pane.items.menu.export' + multiple));
		menu.childNodes[m.createBib].setAttribute('label', Zotero.getString('pane.items.menu.createBib' + multiple));
		menu.childNodes[m.loadReport].setAttribute('label', Zotero.getString('pane.items.menu.generateReport' + multiple));
		
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
	
	
	function setItemsPaneMessage(msg) {
		document.getElementById('zotero-items-pane-content').selectedIndex = 1;
		var elem = document.getElementById('zotero-items-pane-message');
		elem.value = msg;
	}
	
	
	function clearItemsPaneMessage() {
		document.getElementById('zotero-items-pane-content').selectedIndex = 0;
		document.getElementById('zotero-items-pane-message').value = '';
	}
	
	
	// Updates browser context menu options
	function contextPopupShowing()
	{
		var menuitem = document.getElementById("zotero-context-add-to-current-note");
		var showing = false;
		if (menuitem){
			var items = getSelectedItems();
			if (itemsView.selection.count==1 && items[0] && items[0].isNote()
				&& window.gContextMenu.isTextSelected)
			{
				menuitem.hidden = false;
				showing = true;
			}
			else
			{
				menuitem.hidden = true;
			}
		}
		
		var menuitem = document.getElementById("zotero-context-add-to-new-note");
		if (menuitem){
			if (window.gContextMenu.isTextSelected)
			{
				menuitem.hidden = false;
				showing = true;
			}
			else
			{
				menuitem.hidden = true;
			}
		}
		
		var menuitem = document.getElementById("zotero-context-save-link-as-snapshot");
		if (menuitem) {
			if (window.gContextMenu.onLink) {
				menuitem.hidden = false;
				showing = true;
			}
			else {
				menuitem.hidden = true;
			}
		}
		
		var menuitem = document.getElementById("zotero-context-save-image-as-snapshot");
		if (menuitem) {
			// Not using window.gContextMenu.hasBGImage -- if the user wants it,
			// they can use the Firefox option to view and then import from there
			if (window.gContextMenu.onImage) {
				menuitem.hidden = false;
				showing = true;
			}
			else {
				menuitem.hidden = true;
			}
		}
		
		var separator = document.getElementById("zotero-context-separator");
		separator.hidden = !showing;
	}
	
	
	function newNote(popup, parent, text)
	{
		if (!popup)
		{
			var item = newItem(Zotero.ItemTypes.getID('note'));
			var note = document.getElementById('zotero-note-editor');
			try {
				// trim
				text = text.replace(/^[\xA0\r\n\s]*(.*)[\xA0\r\n\s]*$/m, "$1");
			}
			catch (e){}
			if (text)
			{
				note.value = text;
			}
			note.save();
			note.focus();
			
			if (parent)
			{
				item.setSource(parent);
				selectItem(item.getID());
			}
		}
		else
		{
			// TODO: _text_
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
	
	function addTextToNote(text)
	{
		try {
			// trim
			text = text.replace(/^[\xA0\r\n\s]*(.*)[\xA0\r\n\s]*$/m, "$1");
		}
		catch (e){}
		
		if (!text || !text.length)
		{
			return false;
		}
		
		var items = getSelectedItems();
		if (itemsView.selection.count == 1 && items[0] && items[0].isNote())
		{
			var note = items[0].getNote()
			items[0].updateNote(note + "\n\n" + text);
			var noteElem = document.getElementById('zotero-note-editor')
			noteElem.focus();
			noteElem.id('noteField').inputField.editor.
				selectionController.scrollSelectionIntoView(1,
					1,
					true);
			return true;
		}
		
		return false;
	}
	
	function openNoteWindow(id, parent)
	{
		window.open('chrome://zotero/content/note.xul?v=1'+(id ? '&id='+id : '')+(parent ? '&coll='+parent : ''),'','chrome,resizable,centerscreen');
	}
	
	
	function toggleAbstractForSelectedItem() {
		var items = getSelectedItems();
		if (itemsView.selection.count == 1 && items[0] && items[0].isNote()
				&& items[0].getSource()) {
			
			items[0].setAbstract(!items[0].isAbstract())
			return true;
		}
		
		return false;
	}
	
	
	function addAttachmentFromDialog(link, id)
	{
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
        					.createInstance(nsIFilePicker);
		fp.init(window, Zotero.getString('pane.item.attachments.select'), nsIFilePicker.modeOpenMultiple);
		
		if(fp.show() == nsIFilePicker.returnOK)
		{
			var files = fp.files;
			while (files.hasMoreElements()){
				var file = files.getNext();
				file.QueryInterface(Components.interfaces.nsILocalFile);
				var attachmentID;
				if(link)
					attachmentID = Zotero.Attachments.linkFromFile(file, id);
				else
					attachmentID = Zotero.Attachments.importFromFile(file, id);
			
				if(attachmentID && !id)
				{
					var c = getSelectedCollection();
					if(c)
						c.addItem(attachmentID);
				}
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
		
		var item = newItem(Zotero.ItemTypes.getID('webpage'), data);
		
		// Automatically save snapshot if pref set
		if (item.getID() && Zotero.Prefs.get('automaticSnapshots'))
		{
			addAttachmentFromPage(false, item.getID(), true);
		}
	}
	
	
	function addAttachmentFromPage(link, id, noParent)
	{
		if (itemsView && itemsView._itemGroup.isCollection() && !noParent)
		{
			var parentCollectionID = itemsView._itemGroup.ref.getID();
		}
		
		if(link)
		{
			Zotero.Attachments.linkFromDocument(window.content.document, id, parentCollectionID);
		}
		else
		{
			Zotero.Attachments.importFromDocument(window.content.document, id, false, parentCollectionID);
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
				if (file){
					var mimeType = attachment.getAttachmentMimeType();
					if (mimeType) {
						var ext = Zotero.File.getExtension(file);
						var internal = Zotero.MIME.hasInternalHandler(mimeType, ext);
					}
					
					var fileURL = attachment.getLocalFileURL();
					
					if (internal || Zotero.MIME.fileHasInternalHandler(file))
					{
						window.loadURI(fileURL);
					}
					else {
						// Some platforms don't have nsILocalFile.launch, so we just load it and
						// let the Firefox external helper app window handle it
						try {
							file.launch();
						}
						catch (e) {
							window.loadURI(fileURL);
						}
					}
				}
				else {
					alert(Zotero.getString('pane.item.attachments.fileNotFound'));
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
				if (file){
					try {
						file.reveal();
					}
					catch (e) {
						// On platforms that don't support nsILocalFile.reveal() (e.g. Linux), we
						// open a small window with a selected read-only textbox containing the
						// file path, so the user can open it, Control-c, Control-w, Alt-Tab, and
						// Control-v the path into another app
						var io = {alertText: file.path};
						window.openDialog('chrome://zotero/content/selectableAlert.xul', "zotero-reveal-window", "chrome", io);
					}
				}
				else {
					alert(Zotero.getString('pane.item.attachments.fileNotFound'));
				}
			}
		}
	}
}

window.addEventListener("load", function(e) { ZoteroPane.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ZoteroPane.onUnload(e); }, false);
