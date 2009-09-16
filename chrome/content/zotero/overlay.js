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
	this.collectionsView = false;
	this.itemsView = false;
	this.__defineGetter__('loaded', function () _loaded);
	
	//Privileged methods
	this.onLoad = onLoad;
	this.onUnload = onUnload;
	this.toggleDisplay = toggleDisplay;
	this.isShowing = isShowing;
	this.fullScreen = fullScreen;
	this.isFullScreen = isFullScreen;
	this.handleKeyDown = handleKeyDown;
	this.handleKeyUp = handleKeyUp;
	this.setHighlightedRowsCallback = setHighlightedRowsCallback;
	this.handleKeyPress = handleKeyPress;
	this.newItem = newItem;
	this.newCollection = newCollection;
	this.newSearch = newSearch;
	this.openAdvancedSearchWindow = openAdvancedSearchWindow;
	this.toggleTagSelector = toggleTagSelector;
	this.updateTagSelectorSize = updateTagSelectorSize;
	this.getTagSelection = getTagSelection;
	this.clearTagSelection = clearTagSelection;
	this.updateTagFilter = updateTagFilter;
	this.onCollectionSelected = onCollectionSelected;
	this.itemSelected = itemSelected;
	this.reindexItem = reindexItem;
	this.duplicateSelectedItem = duplicateSelectedItem;
	this.deleteSelectedCollection = deleteSelectedCollection;
	this.editSelectedCollection = editSelectedCollection;
	this.copySelectedItemsToClipboard = copySelectedItemsToClipboard;
	this.clearQuicksearch = clearQuicksearch;
	this.handleSearchKeypress = handleSearchKeypress;
	this.handleSearchInput = handleSearchInput;
	this.search = search;
	this.selectItem = selectItem;
	this.getSelectedCollection = getSelectedCollection;
	this.getSelectedSavedSearch = getSelectedSavedSearch;
	this.getSelectedItems = getSelectedItems;
	this.getSortedItems = getSortedItems;
	this.getSortField = getSortField;
	this.getSortDirection = getSortDirection;
	this.buildItemContextMenu = buildItemContextMenu;
	this.loadURI = loadURI;
	this.setItemsPaneMessage = setItemsPaneMessage;
	this.clearItemsPaneMessage = clearItemsPaneMessage;
	this.contextPopupShowing = contextPopupShowing;
	this.openNoteWindow = openNoteWindow;
	this.addTextToNote = addTextToNote;
	this.addAttachmentFromDialog = addAttachmentFromDialog;
	this.viewAttachment = viewAttachment;
	this.viewSelectedAttachment = viewSelectedAttachment;
	this.showAttachmentNotFoundDialog = showAttachmentNotFoundDialog;
	this.relinkAttachment = relinkAttachment;
	this.reportErrors = reportErrors;
	this.displayErrorMessage = displayErrorMessage;
	
	const DEFAULT_ZPANE_HEIGHT = 300;
	const COLLECTIONS_HEIGHT = 32; // minimum height of the collections pane and toolbar
	
	var self = this;
	var _loaded = false;
	var titlebarcolorState, toolbarCollapseState, titleState;
	
	// Also needs to be changed in collectionTreeView.js
	var _lastViewedFolderRE = /^(?:(C|S|G)([0-9]+)|L)$/;
	
	/*
	 * Called when the window is open
	 */
	function onLoad()
	{
		if (!Zotero || !Zotero.initialized) {
			return;
		}
		
		if (Zotero.locked) {
			return;
		}
		_loaded = true;
		
		Zotero.setFontSize(document.getElementById('zotero-pane'))
		
		if (Zotero.isMac) {
			//document.getElementById('zotero-tb-actions-zeroconf-update').setAttribute('hidden', false);
			document.getElementById('zotero-pane-stack').setAttribute('platform', 'mac');
		} else if(Zotero.isWin) {
			document.getElementById('zotero-pane-stack').setAttribute('platform', 'win');
		}
		
		if(Zotero.isFx30) document.documentElement.setAttribute("moz-version", "3.0");
		if(Zotero.isFx35) document.documentElement.setAttribute("moz-version", "3.5");
		
		//Initialize collections view
		this.collectionsView = new Zotero.CollectionTreeView();
		var collectionsTree = document.getElementById('zotero-collections-tree');
		collectionsTree.view = this.collectionsView;
		collectionsTree.controllers.appendController(new Zotero.CollectionTreeCommandController(collectionsTree));
		collectionsTree.addEventListener("click", ZoteroPane.onTreeClick, true);
		
		var itemsTree = document.getElementById('zotero-items-tree');
		itemsTree.controllers.appendController(new Zotero.ItemTreeCommandController(itemsTree));
		itemsTree.addEventListener("click", ZoteroPane.onTreeClick, true);
		
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
		
		if (Zotero.restoreFromServer) {
			Zotero.restoreFromServer = false;
			
			setTimeout(function () {
				var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
							.getService(Components.interfaces.nsIPrompt);
				var buttonFlags = (pr.BUTTON_POS_0) * (pr.BUTTON_TITLE_IS_STRING)
									+ (pr.BUTTON_POS_1) * (pr.BUTTON_TITLE_CANCEL);
				var index = pr.confirmEx(
					"Zotero Restore",
					"The local Zotero database has been cleared."
						+ " "
						+ "Would you like to restore from the Zotero server now?",
					buttonFlags,
					"Sync Now",
					null, null, null, {}
				);
				
				if (index == 0) {
					Zotero.Sync.Server.sync({
						onSuccess: function () {
							Zotero.Sync.Runner.setSyncIcon();
							
							pr.alert(
								"Restore Completed",
								"The local Zotero database has been successfully restored."
							);
						},
						
						onError: function (msg) {
							pr.alert(
								"Restore Failed",
								"An error occurred while restoring from the server:\n\n"
									+ msg
							);
							
							Zotero.Sync.Runner.error(msg);
						}
					});
				}
			}, 1000);
		}
		// If the database was initialized and Zotero hasn't been run before
		// in this profile, display the Quick Start Guide -- this way the guide
		// won't be displayed when they sync their DB to another profile or if
		// they the DB is initialized erroneously (e.g. while switching data
		// directory locations)
		else if (Zotero.Schema.dbInitialized && Zotero.Prefs.get('firstRun')) {
			/*
			setTimeout(function () {
				var url = "http://www.zotero.org/support/quick_start_guide";
				gBrowser.selectedTab = gBrowser.addTab(url);/
			}, 400);
			Zotero.Prefs.set('firstRun', false);
			*/
		}
		
		// Hide sync debugging menu by default
		if (Zotero.Prefs.get('sync.debugMenu')) {
			var sep = document.getElementById('zotero-tb-actions-sync-separator');
			var menuitems = [];
			sep.nextSibling.hidden = false;
			sep.nextSibling.nextSibling.hidden = false;
			sep.nextSibling.nextSibling.nextSibling.hidden = false;
			sep.nextSibling.nextSibling.nextSibling.nextSibling.hidden = false;
			sep.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling.nextSibling.hidden = false;
		}
		
		if (Zotero.Prefs.get('debugShowDuplicates')) {
			document.getElementById('zotero-tb-actions-showDuplicates').hidden = false;
		}
		
		// use appropriate search box
		if(Zotero.isFx30) {
			document.getElementById("zotero-tb-search-label").hidden = false;
			document.getElementById("zotero-tb-search").setAttribute("type", "conditional-timed");
		}
	}
	
	
	/*
	 * Called when the window closes
	 */
	function onUnload()
	{
		if (!Zotero || !Zotero.initialized || !_loaded) {
			return;
		}
		
		var tagSelector = document.getElementById('zotero-tag-selector');
		tagSelector.unregister();
		
		this.collectionsView.unregister();
		if (this.itemsView)
			this.itemsView.unregister();
	}

	/*
	 * Hides/displays the Zotero interface
	 */
	function toggleDisplay()
	{
		if (!ZoteroPane.loaded) {
			if (Zotero.locked) {
				var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
							.getService(Components.interfaces.nsIPrompt);
				// TODO: localize
				var msg = "Another Zotero operation is currently in progress.\n\nPlease wait until it has finished.";
				pr.alert("", msg);
				return;
			}
			ZoteroPane.onLoad();
		}
		
		var zoteroPane = document.getElementById('zotero-pane-stack');
		var zoteroSplitter = document.getElementById('zotero-splitter')
		
		if (zoteroPane.getAttribute('hidden') == 'true') {
			var isHidden = true;
		}
		else if (zoteroPane.getAttribute('collapsed') == 'true') {
			var isCollapsed = true;
		}
		
		if (isHidden || isCollapsed) {
			var makeVisible = true;
		}
		
		// If Zotero not initialized, try to get the error handler
		// or load the default error page
		if (makeVisible && (!Zotero || !Zotero.initialized)) {
			if (Zotero) {
				var errMsg = Zotero.startupError;
				var errFunc = Zotero.startupErrorHandler;
			}
			
			if (!errMsg) {
				// Get the stringbundle manually
				var src = 'chrome://zotero/locale/zotero.properties';
				var localeService = Components.classes['@mozilla.org/intl/nslocaleservice;1'].
						getService(Components.interfaces.nsILocaleService);
				var appLocale = localeService.getApplicationLocale();
				var stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
					.getService(Components.interfaces.nsIStringBundleService);
				var stringBundle = stringBundleService.createBundle(src, appLocale);
				
				var errMsg = stringBundle.GetStringFromName('startupError');
			}
			
			if (errFunc) {
				errFunc();
			}
			else {
				// TODO: Add a better error page/window here with reporting
				// instructions
				// window.loadURI('chrome://zotero/content/error.xul');
				var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
							.getService(Components.interfaces.nsIPrompt);
				pr.alert("", errMsg);
			}
			
			return;
		}
		
		zoteroSplitter.setAttribute('hidden', !makeVisible);
		
		// Make sure tags splitter isn't missing for people upgrading from <2.0b7
		if (makeVisible) {
			document.getElementById('zotero-tags-splitter').collapsed = false;
		}
		
		// Restore fullscreen mode if necessary
		if (makeVisible && isFullScreen()) {
			this.fullScreen(true);
		}
		
		if (zoteroPane.hasAttribute('savedHeight')) {
			var savedHeight = zoteroPane.getAttribute('savedHeight');
		}
		else {
			var savedHeight = DEFAULT_ZPANE_HEIGHT;
		}
		
		/*
		Zotero.debug("zoteroPane.boxObject.height: " + zoteroPane.boxObject.height);
		Zotero.debug("zoteroPane.getAttribute('height'): " + zoteroPane.getAttribute('height'));
		Zotero.debug("zoteroPane.getAttribute('minheight'): " + zoteroPane.getAttribute('minheight'));
		Zotero.debug("savedHeight: " + savedHeight);
		*/
		
		if (makeVisible) {
			this.updateTagSelectorSize();
			
			var max = document.getElementById('appcontent').boxObject.height
						- zoteroSplitter.boxObject.height;
			
			if (isHidden) {
				zoteroPane.setAttribute('height', Math.min(savedHeight, max));
				zoteroPane.setAttribute('hidden', false);
			}
			else if (isCollapsed) {
				zoteroPane.setAttribute('height', Math.min(savedHeight, max));
				zoteroPane.setAttribute('collapsed', false);
			}
			
			// Focus the quicksearch on pane open
			setTimeout("document.getElementById('zotero-tb-search').inputField.select();", 1);
			
			var d = new Date();
			Zotero.purgeDataObjects();
			var d2 = new Date();
			Zotero.debug("Purged data tables in " + (d2 - d) + " ms");
			
			if (Zotero.Prefs.get('sync.autoSync') && Zotero.Sync.Server.enabled) {
				setTimeout(function () {
					Zotero.Sync.Runner.sync(true);
				}, 1000);
			}
		}
		else {
			zoteroPane.setAttribute('collapsed', true);
			zoteroPane.height = 0;
			
			document.getElementById('content').setAttribute('collapsed', false);
			
			// turn off full window mode, if it was on
			_setFullWindowMode(false);
			
			// Return focus to the browser content pane
			window.content.window.focus();
		}
	}
	
	
	function isShowing() {
		var zoteroPane = document.getElementById('zotero-pane-stack');
		return zoteroPane.getAttribute('hidden') != 'true' &&
				zoteroPane.getAttribute('collapsed') != 'true';
	}
	
	
	function fullScreen(set)
	{
		var zoteroPane = document.getElementById('zotero-pane-stack');
		
		if (set != undefined) {
			var makeFullScreen = !!set;
		}
		else {
			var makeFullScreen = zoteroPane.getAttribute('fullscreenmode') != 'true';
		}
		
		// Turn Z-pane flex on to stretch to window in full-screen, but off otherwise so persist works
		zoteroPane.setAttribute('flex', makeFullScreen ? "1" : "0");
		document.getElementById('content').setAttribute('collapsed', makeFullScreen);
		document.getElementById('zotero-splitter').setAttribute('hidden', makeFullScreen);
		
		zoteroPane.setAttribute('fullscreenmode', makeFullScreen);
		_setFullWindowMode(makeFullScreen);
	}
	
	/**
	 * Hides or shows navigation toolbars
	 * @param set {Boolean} Whether navigation toolbars should be hidden or shown
	 */
	function _setFullWindowMode(set) {
		// hide or show navigation toolbars
		var toolbox = getNavToolbox();
		if(set) {
			// the below would be a good thing to do if the whole title bar (and not just the center
			// part) got updated when it happened...
			/*if(Zotero.isMac) {
				titlebarcolorState = document.documentElement.getAttribute("activetitlebarcolor");
				document.documentElement.removeAttribute("activetitlebarcolor");
			}*/
			if(document.title != "Zotero") {
				titleState = document.title;
				document.title = "Zotero";
			}
			
			if(!toolbarCollapseState) {
				toolbarCollapseState = [node.collapsed for each (node in toolbox.childNodes)];
				for(var i=0; i<toolbox.childNodes.length; i++) {
					toolbox.childNodes[i].collapsed = true;
				}
			}
		} else {
			/*if(Zotero.isMac) {
				document.documentElement.setAttribute("activetitlebarcolor", titlebarcolorState);
			}*/
			if(document.title == "Zotero") document.title = titleState;
			
			if(toolbarCollapseState) {
				for(var i=0; i<toolbox.childNodes.length; i++) {
					toolbox.childNodes[i].collapsed = toolbarCollapseState[i];
				}
				toolbarCollapseState = undefined;
			}
		}
	}
	
	function isFullScreen() {
		return document.getElementById('zotero-pane').getAttribute('fullscreenmode') == 'true';
	}
	
	
	/*
	 * Trigger actions based on keyboard shortcuts
	 */
	function handleKeyDown(event, from) {
		try {
			// Ignore keystrokes outside of Zotero pane
			if (!(event.originalTarget.ownerDocument instanceof XULDocument)) {
				return;
			}
		}
		catch (e) {
			Zotero.debug(e);
		}
		
		if (Zotero.locked) {
			event.preventDefault();
			return;
		}
		
		if (from == 'zotero-pane') {
			// Highlight collections containing selected items
			//
			// We use Control (17) on Windows because Alt triggers the menubar;
			// 	otherwise we use Alt/Option (18)
			if ((Zotero.isWin && event.keyCode == 17 && !event.altKey) ||
					(!Zotero.isWin && event.keyCode == 18 && !event.ctrlKey)
					&& !event.shiftKey && !event.metaKey) {
				
				this.highlightTimer = Components.classes["@mozilla.org/timer;1"].
					createInstance(Components.interfaces.nsITimer);
				// {} implements nsITimerCallback
				this.highlightTimer.initWithCallback({
					notify: ZoteroPane.setHighlightedRowsCallback
				}, 225, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
			}
			else if ((Zotero.isWin && event.ctrlKey) ||
					(!Zotero.isWin && event.altKey)) {
				if (this.highlightTimer) {
					this.highlightTimer.cancel();
					this.highlightTimer = null;
				}
				ZoteroPane.collectionsView.setHighlightedRows();
			}
			
			return;
		}
		
		// Ignore keystrokes if Zotero pane is closed
		var zoteroPane = document.getElementById('zotero-pane-stack');
		if (zoteroPane.getAttribute('hidden') == 'true' ||
				zoteroPane.getAttribute('collapsed') == 'true') {
			return;
		}
		
		var useShift = Zotero.isMac;
		
		var key = String.fromCharCode(event.which);
		if (!key) {
			Zotero.debug('No key');
			return;
		}
		
		// Ignore modifiers other than Ctrl-Alt or Cmd-Shift
		if (!((Zotero.isMac ? event.metaKey : event.ctrlKey) &&
				(useShift ? event.shiftKey : event.altKey))) {
			return;
		}
		
		var command = Zotero.Keys.getCommand(key);
		if (!command) {
			return;
		}
		
		Zotero.debug(command);
		
		switch (command) {
			case 'openZotero':
				try {
					// Ignore Cmd-Shift-Z keystroke in text areas
					if (Zotero.isMac && key == 'Z' &&
							event.originalTarget.localName == 'textarea') {
						Zotero.debug('Ignoring keystroke in text area');
						return;
					}
				}
				catch (e) {
					Zotero.debug(e);
				}
				ZoteroPane.toggleDisplay()
				break;
			case 'library':
				document.getElementById('zotero-collections-tree').focus();
				ZoteroPane.collectionsView.selection.select(0);
				break;
			case 'quicksearch':
				document.getElementById('zotero-tb-search').select();
				break;
			case 'newItem':
				ZoteroPane.newItem(2); // book
				document.getElementById('zotero-editpane-type-menu').focus();
				break;
			case 'newNote':
				// Use key that's not the modifier as the popup toggle
				ZoteroPane.newNote(useShift ? event.altKey : event.shiftKey);
				break;
			case 'toggleTagSelector':
				ZoteroPane.toggleTagSelector();
				break;
			case 'toggleFullscreen':
				ZoteroPane.fullScreen();
				break;
			case 'copySelectedItemCitationsToClipboard':
				ZoteroPane.copySelectedItemsToClipboard(true)
				break;
			case 'copySelectedItemsToClipboard':
				ZoteroPane.copySelectedItemsToClipboard();
				break;
			case 'importFromClipboard':
				Zotero_File_Interface.importFromClipboard();
				break;
			default:
				throw ('Command "' + command + '" not found in ZoteroPane.handleKeyDown()');
		}
		
		event.preventDefault();
	}
	
	
	function handleKeyUp(event, from) {
		if (from == 'zotero-pane') {
			if ((Zotero.isWin && event.keyCode == 17) ||
					(!Zotero.isWin && event.keyCode == 18)) {
				if (this.highlightTimer) {
					this.highlightTimer.cancel();
					this.highlightTimer = null;
				}
				ZoteroPane.collectionsView.setHighlightedRows();
			}
		}
	}
	
	
	/*
	 * Highlights collections containing selected items on Ctrl (Win) or
	 * Option/Alt (Mac/Linux) press
	 */
	function setHighlightedRowsCallback() {
		var itemIDs = ZoteroPane.getSelectedItems(true);
		if (itemIDs && itemIDs.length) {
			var collectionIDs = Zotero.Collections.getCollectionsContainingItems(itemIDs, true);
			if (collectionIDs) {
				ZoteroPane.collectionsView.setHighlightedRows(collectionIDs);
			}
		}
	}
	
	
	function handleKeyPress(event, from) {
		if (from == 'zotero-collections-tree') {
			if (event.keyCode == event.DOM_VK_BACK_SPACE ||
					event.keyCode == event.DOM_VK_DELETE) {
				ZoteroPane.deleteSelectedCollection();
				event.preventDefault();
				return;
			}
		}
		else if (from == 'zotero-items-tree') {
			if (event.keyCode == event.DOM_VK_BACK_SPACE ||
					event.keyCode == event.DOM_VK_DELETE) {
				// If Cmd or Ctrl delete, delete from Library (with prompt)
				var fromDB = event.metaKey || (!Zotero.isMac && event.ctrlKey);
				ZoteroPane.deleteSelectedItems(fromDB);
				event.preventDefault();
				return;
			}
		}
	}
	
	
	/*
	 * Create a new item
	 *
	 * _data_ is an optional object with field:value for itemData
	 */
	function newItem(typeID, data, row)
	{
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return false;
		}
		
		// Currently selected row
		if (row === undefined) {
			row = this.collectionsView.selection.currentIndex;
		}
		
		if (!this.canEdit(row)) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		if (row !== undefined) {
			var itemGroup = this.collectionsView._getItemAtRow(row);
			var libraryID = itemGroup.ref.libraryID;
		}
		else {
			var libraryID = null;
			var itemGroup = null;
		}
		
		var item = new Zotero.Item(typeID);
		item.libraryID = libraryID;
		for (var i in data) {
			item.setField(i, data[i]);
		}
		var itemID = item.save();
		
		if (itemGroup && itemGroup.isCollection()) {
			itemGroup.ref.addItem(itemID);
		}
		
		//set to Info tab
		document.getElementById('zotero-view-item').selectedIndex = 0;
		
		this.selectItem(itemID);
		
		return Zotero.Items.get(itemID);
	}
	
	
	function newCollection(parent)
	{
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return false;
		}
		
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		var untitled = Zotero.DB.getNextName('collections', 'collectionName',
			Zotero.getString('pane.collections.untitled'));
		
		var newName = { value: untitled };
		var result = promptService.prompt(window,
			Zotero.getString('pane.collections.newCollection'),
			Zotero.getString('pane.collections.name'), newName, "", {});
		
		if (!result)
		{
			return;
		}
		
		if (!newName.value)
		{
			newName.value = untitled;
		}
		
		var collection = new Zotero.Collection;
		collection.libraryID = this.getSelectedLibraryID();
		collection.name = newName.value;
		collection.parent = parent;
		collection.save();
	}
	
	
	this.newGroup = function () {
		if (this.isFullScreen()) {
			this.toggleDisplay();
		}
		
		window.loadURI(Zotero.Groups.addGroupURL);
	}
	
	
	function newSearch()
	{
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return false;
		}
		
		var s = new Zotero.Search();
		s.addCondition('title', 'contains', '');
		
		var untitled = Zotero.getString('pane.collections.untitled');
		untitled = Zotero.DB.getNextName('savedSearches', 'savedSearchName',
			Zotero.getString('pane.collections.untitled'));
		var io = {dataIn: {search: s, name: untitled}, dataOut: null};
		window.openDialog('chrome://zotero/content/searchDialog.xul','','chrome,modal',io);
	}
	
	
	this.openLookupWindow = function () {
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return false;
		}
		
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		window.openDialog('chrome://zotero/content/lookup.xul', 'zotero-lookup', 'chrome,modal');
	}
	
	
	function openAdvancedSearchWindow() {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
		var enumerator = wm.getEnumerator('zotero:search');
		while (enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
		}
		
		if (win) {
			win.focus();
			return;
		}
		
		var s = new Zotero.Search();
		s.addCondition('title', 'contains', '');
		var io = {dataIn: {search: s}, dataOut: null};
		window.openDialog('chrome://zotero/content/advancedSearch.xul', '', 'chrome,dialog=no,centerscreen', io);
	}
	
	
	function toggleTagSelector(){
		var tagSelector = document.getElementById('zotero-tag-selector');
		
		var showing = tagSelector.getAttribute('collapsed') == 'true';
		tagSelector.setAttribute('collapsed', !showing);
		this.updateTagSelectorSize();
		
		// If showing, set scope to items in current view
		// and focus filter textbox
		if (showing) {
			_setTagScope();
			tagSelector.focusTextbox();
		}
		// If hiding, clear selection
		else {
			tagSelector.uninit();
		}
	}
	
	
	function updateTagSelectorSize() {
		//Zotero.debug('Updating tag selector size');
		var zoteroPane = document.getElementById('zotero-pane-stack');
		var splitter = document.getElementById('zotero-tags-splitter');
		var tagSelector = document.getElementById('zotero-tag-selector');
		
		// Nothing should be bigger than appcontent's height
		var max = document.getElementById('appcontent').boxObject.height
					- splitter.boxObject.height;
		
		// Shrink tag selector to appcontent's height
		var maxTS = max - COLLECTIONS_HEIGHT;
		if (parseInt(tagSelector.getAttribute("height")) > maxTS) {
			//Zotero.debug("Limiting tag selector height to appcontent");
			tagSelector.setAttribute('height', maxTS);
		}
		
		var height = tagSelector.boxObject.height;
		
		/*
		Zotero.debug("tagSelector.boxObject.height: " + tagSelector.boxObject.height);
		Zotero.debug("tagSelector.getAttribute('height'): " + tagSelector.getAttribute('height'));
		Zotero.debug("zoteroPane.boxObject.height: " + zoteroPane.boxObject.height);
		Zotero.debug("zoteroPane.getAttribute('height'): " + zoteroPane.getAttribute('height'));
		*/
		
		// Don't let the Z-pane jump back down to its previous height
		// (if shrinking or hiding the tag selector let it clear the min-height)
		if (zoteroPane.getAttribute('height') < zoteroPane.boxObject.height) {
			//Zotero.debug("Setting Zotero pane height attribute to " +  zoteroPane.boxObject.height);
			zoteroPane.setAttribute('height', zoteroPane.boxObject.height);
		}
		
		if (tagSelector.getAttribute('collapsed') == 'true') {
			// 32px is the default Z pane min-height in overlay.css
			height = 32;
		}
		else {
			// tS.boxObject.height doesn't exist at startup, so get from attribute
			if (!height) {
				height = parseInt(tagSelector.getAttribute('height'));
			}
			// 121px seems to be enough room for the toolbar and collections
			// tree at minimum height
			height = height + COLLECTIONS_HEIGHT;
		}
		
		//Zotero.debug('Setting Zotero pane minheight to ' + height);
		zoteroPane.setAttribute('minheight', height);
		
		if (this.isShowing() && !this.isFullScreen()) {
			zoteroPane.setAttribute('savedHeight', zoteroPane.boxObject.height);
		}
		
		// Fix bug whereby resizing the Z pane downward after resizing
		// the tag selector up and then down sometimes caused the Z pane to
		// stay at a fixed size and get pushed below the bottom
		tagSelector.height++;
		tagSelector.height--;
	}
	
	
	function getTagSelection(){
		var tagSelector = document.getElementById('zotero-tag-selector');
		return tagSelector.selection ? tagSelector.selection : {};
	}
	
	
	function clearTagSelection() {
		if (Zotero.hasValues(this.getTagSelection())) {
			var tagSelector = document.getElementById('zotero-tag-selector');
			tagSelector.clearAll();
		}
	}
	
	
	/*
	 * Sets the tag filter on the items view
	 */
	function updateTagFilter(){
		this.itemsView.setFilter('tags', getTagSelection());
	}
	
	
	/*
	 * Set the tags scope to the items in the current view
	 *
	 * Passed to the items tree to trigger on changes
	 */
	function _setTagScope() {
		var itemGroup = self.collectionsView._getItemAtRow(self.collectionsView.selection.currentIndex);
		var tagSelector = document.getElementById('zotero-tag-selector');
		if (!tagSelector.getAttribute('collapsed') ||
				tagSelector.getAttribute('collapsed') == 'false') {
			Zotero.debug('Updating tag selector with current tags');
			if (itemGroup.editable) {
				tagSelector.mode = 'edit';
			}
			else {
				tagSelector.mode = 'view';
			}
			tagSelector.libraryID = itemGroup.ref.libraryID;
			tagSelector.scope = itemGroup.getChildTags();
		}
	}
	
	
	function onCollectionSelected()
	{
		if (this.itemsView)
		{
			this.itemsView.unregister();
			if (this.itemsView.wrappedJSObject.listener) {
				document.getElementById('zotero-items-tree').removeEventListener(
					'keypress', this.itemsView.wrappedJSObject.listener, false
				);
			}
			this.itemsView.wrappedJSObject.listener = null;
			document.getElementById('zotero-items-tree').view = this.itemsView = null;
		}
		
		document.getElementById('zotero-tb-search').value = ""; 
		
		if (this.collectionsView.selection.count != 1) {
			document.getElementById('zotero-items-tree').view = this.itemsView = null;
			return;
		}
		
		// this.collectionsView.selection.currentIndex != -1
		
		var itemgroup = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
		
		/*
		if (itemgroup.isSeparator()) {
			document.getElementById('zotero-items-tree').view = this.itemsView = null;
			return;
		}
		*/
		
		itemgroup.setSearch('');
		itemgroup.setTags(getTagSelection());
		itemgroup.showDuplicates = false;
		
		try {
			Zotero.UnresponsiveScriptIndicator.disable();
			this.itemsView = new Zotero.ItemTreeView(itemgroup);
			this.itemsView.addCallback(_setTagScope);
			document.getElementById('zotero-items-tree').view = this.itemsView;
			this.itemsView.selection.clearSelection();
		}
		finally {
			Zotero.UnresponsiveScriptIndicator.enable();
		}
		
		if (itemgroup.isLibrary()) {
			Zotero.Prefs.set('lastViewedFolder', 'L');
		}
		if (itemgroup.isCollection()) {
			Zotero.Prefs.set('lastViewedFolder', 'C' + itemgroup.ref.id);
		}
		else if (itemgroup.isSearch()) {
			Zotero.Prefs.set('lastViewedFolder', 'S' + itemgroup.ref.id);
		}
		else if (itemgroup.isGroup()) {
			Zotero.Prefs.set('lastViewedFolder', 'G' + itemgroup.ref.id);
		}
	}
	
	
	this.showDuplicates = function () {
		if (this.collectionsView.selection.count == 1 && this.collectionsView.selection.currentIndex != -1) {
			var itemGroup = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
			itemGroup.showDuplicates = true;
			
			try {
				Zotero.UnresponsiveScriptIndicator.disable();
				this.itemsView.refresh();
			}
			finally {
				Zotero.UnresponsiveScriptIndicator.enable();
			}
		}
	}


	function itemSelected()
	{
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage();
			return;
		}
		
		// Display restore button if items selected in Trash
		if (this.itemsView && this.itemsView.selection.count) {
			document.getElementById('zotero-item-restore-button').hidden
				= !this.itemsView._itemGroup.isTrash()
					|| _nonDeletedItemsSelected(this.itemsView);
		}
		else {
			document.getElementById('zotero-item-restore-button').hidden = true;
		}
		
		var tabs = document.getElementById('zotero-view-tabbox');
		
		if (this.itemsView && this.itemsView.selection.count == 1 && this.itemsView.selection.currentIndex != -1)
		{
			var item = this.itemsView._getItemAtRow(this.itemsView.selection.currentIndex);
			
			if(item.ref.isNote()) {
				var noteEditor = document.getElementById('zotero-note-editor');
				noteEditor.mode = this.collectionsView.editable ? 'edit' : 'view';
				
				// If loading new or different note, disable undo while we repopulate the text field
				// so Undo doesn't end up clearing the field. This also ensures that Undo doesn't
				// undo content from another note into the current one.
				if (!noteEditor.item || noteEditor.item.id != item.ref.id) {
					noteEditor.disableUndo();
				}
				noteEditor.parent = null;
				noteEditor.item = item.ref;
				
				noteEditor.enableUndo();
				
				var viewButton = document.getElementById('zotero-view-note-button');
				if (this.collectionsView.editable) {
					viewButton.hidden = false;
					viewButton.setAttribute('noteID', item.ref.id);
					if (item.ref.getSource()) {
						viewButton.setAttribute('sourceID', item.ref.getSource());
					}
					else {
						viewButton.removeAttribute('sourceID');
					}
				}
				else {
					viewButton.hidden = true;
				}
				
				document.getElementById('zotero-item-pane-content').selectedIndex = 2;
			}
			
			else if(item.ref.isAttachment()) {
				var attachmentBox = document.getElementById('zotero-attachment-box');
				attachmentBox.mode = this.collectionsView.editable ? 'edit' : 'view';
				attachmentBox.item = item.ref;
				
				document.getElementById('zotero-item-pane-content').selectedIndex = 3;
			}
			
			// Regular item
			else
			{
				document.getElementById('zotero-item-pane-content').selectedIndex = 1;
				var pane = document.getElementById('zotero-view-tabbox').selectedIndex;
				if (this.collectionsView.editable) {
					ZoteroItemPane.viewItem(item.ref, null, pane);
					tabs.selectedIndex = document.getElementById('zotero-view-item').selectedIndex;
				}
				else {
					ZoteroItemPane.viewItem(item.ref, 'view', pane);
					tabs.selectedIndex = document.getElementById('zotero-view-item').selectedIndex;
				}
			}
		}
		else
		{
			document.getElementById('zotero-item-pane-content').selectedIndex = 0;
			
			var label = document.getElementById('zotero-view-selected-label');
			
			if (this.itemsView && this.itemsView.selection.count) {
				label.value = Zotero.getString('pane.item.selected.multiple', this.itemsView.selection.count);
			}
			else {
				label.value = Zotero.getString('pane.item.selected.zero');
			}
		}
	}
	
	
	/**
	 * Check if any selected items in the passed (trash) treeview are not deleted
	 *
	 * @param	{nsITreeView}
	 * @return	{Boolean}
	 */
	function _nonDeletedItemsSelected(itemsView) {
		var start = {};
		var end = {};
		for (var i=0, len=itemsView.selection.getRangeCount(); i<len; i++) {
			itemsView.selection.getRangeAt(i, start, end);
			for (var j=start.value; j<=end.value; j++) {
				if (!itemsView._getItemAtRow(j).ref.deleted) {
					return true;
				}
			}
		}
		return false;
	}
	
	
	this.updateNoteButtonMenu = function () {
		var items = ZoteroPane.getSelectedItems();
		var button = document.getElementById('zotero-tb-add-child-note');
		button.disabled = this.canEdit() && !(items.length == 1
				&& (items[0].isRegularItem() || !items[0].isTopLevelItem()));
	}
	
	
	this.updateAttachmentButtonMenu = function (popup) {
		var items = ZoteroPane.getSelectedItems();
		
		var disabled = !this.canEdit() || !(items.length == 1 && items[0].isRegularItem());
		
		if (disabled) {
			for each(var node in popup.childNodes) {
				node.disabled = true;
			}
			return;
		}
		
		var itemgroup = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
		var canEditFiles = this.canEditFiles();
		
		var prefix = "menuitem-iconic zotero-menuitem-attachments-";
		
		for (var i=0; i<popup.childNodes.length; i++) {
			var node = popup.childNodes[i];
			
			switch (node.className) {
				case prefix + 'link':
					node.disabled = itemgroup.isWithinGroup();
					break;
				
				case prefix + 'snapshot':
				case prefix + 'file':
					node.disabled = !canEditFiles;
					break;
				
				case prefix + 'web-link':
					node.disabled = false;
					break;
				
				default:
					throw ("Invalid class name '" + node.className + "' in ZoteroPane.updateAttachmentButtonMenu()");
			}
		}
	}
	
	
	function reindexItem() {
		var items = this.getSelectedItems();
		if (!items) {
			return;
		}
		
		for (var i=0; i<items.length; i++) {
			if (!items[i].isAttachment()) {
				continue;
			}
			var itemID = items[i].id;
			Zotero.Fulltext.indexItems(itemID, true);
		}
		document.getElementById('zotero-attachment-box').updateItemIndexedState();
	}
	
	
	function duplicateSelectedItem() {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var item = this.getSelectedItems()[0];
		
		// Create new unsaved clone item in target library
		var newItem = new Zotero.Item(item.itemTypeID);
		newItem.libraryID = item.libraryID;
		// DEBUG: save here because clone() doesn't currently work on unsaved tagged items
		var id = newItem.save();
		
		var newItem = Zotero.Items.get(id);
		item.clone(false, newItem);
		newItem.save();
		
		if (this.itemsView._itemGroup.isCollection() && !newItem.getSource()) {
			this.itemsView._itemGroup.ref.addItem(newItem.id);
		}
		this.selectItem(newItem.id);
	}
	
	
	this.deleteSelectedItem = function () {
		Zotero.debug("ZoteroPane.deleteSelectedItem() is deprecated -- use ZoteroPane.deleteSelectedItems()");
		this.deleteSelectedItems();
	}
	
	/*
	 *  _force_ deletes item from DB even if removing from a collection or search
	 */
	this.deleteSelectedItems = function (force) {
		if (this.itemsView && this.itemsView.selection.count > 0) {
			var itemGroup = this.itemsView._itemGroup;
			
			if (!itemGroup.isTrash() && !this.canEdit()) {
				this.displayCannotEditLibraryMessage();
				return;
			}
			
			if (!force){
				if (itemGroup.isCollection()) {
					var noPrompt = true;
				}
				// Do nothing in search and share views
				else if (itemGroup.isSearch() || itemGroup.isShare()) {
					return;
				}
				// Do nothing in trash view if any non-deleted items are selected
				else if (itemGroup.isTrash()) {
					var start = {};
					var end = {};
					for (var i=0, len=this.itemsView.selection.getRangeCount(); i<len; i++) {
						this.itemsView.selection.getRangeAt(i, start, end);
						for (var j=start.value; j<=end.value; j++) {
							if (!this.itemsView._getItemAtRow(j).ref.deleted) {
								return;
							}
						}
					}
				}
			}
			
			var eraseChildren = {value: true};
			var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                    						.getService(Components.interfaces.nsIPromptService);
			var hasChildren;
			
			if (!this.getSelectedCollection()) {
				var start = {};
				var end = {};
				for (var i=0, len=this.itemsView.selection.getRangeCount(); i<len; i++) {
					this.itemsView.selection.getRangeAt(i, start, end);
					for (var j=start.value; j<=end.value; j++) {
						if (this.itemsView._getItemAtRow(j).numChildren()) {
							hasChildren = true;
							break;
						}
					}
				}
			}
			
			if (noPrompt || promptService.confirmCheck(
				window,
				Zotero.getString('pane.items.delete.title'),
				Zotero.getString('pane.items.delete' + (this.itemsView.selection.count>1 ? '.multiple' : '')),
				hasChildren ? Zotero.getString('pane.items.delete.attached') : '',
				eraseChildren))
			{
				this.itemsView.deleteSelection(eraseChildren.value, force);
			}
		}
	}
	
	function deleteSelectedCollection()
	{
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		if (this.collectionsView.selection.count == 1) {
			var row =
				this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
			
			if (row.isCollection())
			{
				if (confirm(Zotero.getString('pane.collections.delete')))
				{
					this.collectionsView.deleteSelection();
				}
			}
			else if (row.isSearch())
			{
				if (confirm(Zotero.getString('pane.collections.deleteSearch')))
				{
					this.collectionsView.deleteSelection();
				}
			}
		}
	}
	
	
	this.restoreSelectedItems = function () {
		var items = this.getSelectedItems();
		if (!items) {
			return;
		}
		
		Zotero.DB.beginTransaction();
		for (var i=0; i<items.length; i++) {
			items[i].deleted = false;
			items[i].save();
		}
		Zotero.DB.commitTransaction();
	}
	
	
	this.emptyTrash = function () {
		var prompt = Components.classes["@mozilla.org/network/default-prompt;1"]
								.getService(Components.interfaces.nsIPrompt);
		
		var result = prompt.confirm("",
			Zotero.getString('pane.collections.emptyTrash') + "\n\n" +
			Zotero.getString('general.actionCannotBeUndone'));
		if (result) {
			Zotero.Items.emptyTrash();
		}
	}

	this.createBucket = function() {
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		var bucketName = { value: '' };
		// TODO localize
		var result = promptService.prompt(window,
			"New Bucket",
			"Enter a name for this bucket:", bucketName, "", {});
		
		if (result && bucketName.value) {
			Zotero.Commons.createBucket(bucketName.value);
		}
	}

	this.removeBucket = function() {
		if (this.collectionsView
				&& this.collectionsView.selection
				&& this.collectionsView.selection.count > 0
				&& this.collectionsView.selection.currentIndex != -1) {
			var bucket = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
			if (bucket && bucket.isBucket()) {
				Zotero.Commons.removeBucket(bucket.getName());
			}
		}
	}
	
	
	function editSelectedCollection()
	{
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		if (this.collectionsView.selection.count > 0) {
			var row = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
			
			if (row.isCollection()) {
				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
				
				var newName = { value: row.getName() };
				var result = promptService.prompt(window, "",
					Zotero.getString('pane.collections.rename'), newName, "", {});
				
				if (result && newName.value) {
					row.ref.name = newName.value;
					row.ref.save();
				}
			}
			else {
				var s = new Zotero.Search();
				s.id = row.ref.id;
				var io = {dataIn: {search: s, name: row.getName()}, dataOut: null};
				window.openDialog('chrome://zotero/content/searchDialog.xul','','chrome,modal',io);
				if (io.dataOut) {
					this.onCollectionSelected(); //reload itemsView
				}
			}
		}
	}
	
	
	function copySelectedItemsToClipboard(asCitations) {
		var items = this.getSelectedItems();
		if (!items.length) {
			return;
		}
		
		// Make sure at least one item is not a standalone note or attachment
		var haveRegularItem = false;
		for each(var item in items) {
			if (item.isRegularItem()) {
				haveRegularItem = true;
				break;
			}
		}
		if (!haveRegularItem) {
			window.alert(Zotero.getString("fileInterface.noReferencesError"));
			return;
		}
		
		var url = window.content.location.href;
		var [mode, format] = Zotero.QuickCopy.getFormatFromURL(url).split('=');
		var [mode, contentType] = mode.split('/');
		
		if (mode == 'bibliography') {
			if (asCitations) {
				Zotero_File_Interface.copyCitationToClipboard(items, format, contentType == 'html');
			}
			else {
				Zotero_File_Interface.copyItemsToClipboard(items, format, contentType == 'html');
			}
		}
		else if (mode == 'export') {
			// Copy citations doesn't work in export mode
			if (asCitations) {
				return;
			}
			else {
				Zotero_File_Interface.exportItemsToClipboard(items, format);
			}
		}
	}
	
	
	function clearQuicksearch() {
		var search = document.getElementById('zotero-tb-search');
		if (search.value != '') {
			search.value = '';
			search.doCommand('cmd_zotero_search');
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
		if (this.itemsView) {
			var searchVal = document.getElementById('zotero-tb-search').value;
			this.itemsView.setFilter('search', searchVal);
			
			document.getElementById('zotero-tb-search-cancel').hidden = searchVal == "";
		}
		
	}
	
	
	/*
	 * Select item in current collection or, if not there, in Library
	 *
	 * If _inLibrary_, force switch to Library
	 * If _expand_, open item if it's a container
	 */
	function selectItem(itemID, inLibrary, expand)
	{
		if (!itemID) {
			return false;
		}
		
		var item = Zotero.Items.get(itemID);
		if (!item) {
			return false;
		}
		
		if (!this.itemsView) {
			Components.utils.reportError("Items view not set in ZoteroPane.selectItem()");
			return false;
		}
		
		var currentLibraryID = this.getSelectedLibraryID();
		// If in a different library
		if (item.libraryID != currentLibraryID) {
			this.collectionsView.selectLibrary(item.libraryID);
		}
		// Force switch to library view
		else if (!this.itemsView._itemGroup.isLibrary() && inLibrary) {
			this.collectionsView.selectLibrary(item.libraryID);
		}
		
		var selected = this.itemsView.selectItem(itemID, expand);
		if (!selected) {
			this.collectionsView.selectLibrary(item.libraryID);
			this.itemsView.selectItem(itemID, expand);
		}
		
		return true;
	}
	
	
	this.getSelectedLibraryID = function () {
		var group = this.getSelectedGroup();
		if (group) {
			return group.libraryID;
		}
		var collection = this.getSelectedCollection();
		if (collection) {
			return collection.libraryID;
		}
		return null;
	}
	
	
	function getSelectedCollection(asID) {
		if (this.collectionsView
				&& this.collectionsView.selection
				&& this.collectionsView.selection.count > 0
				&& this.collectionsView.selection.currentIndex != -1) {
			var collection = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
			if (collection && collection.isCollection()) {
				return asID ? collection.ref.id : collection.ref;
			}
		}
		return false;
	}
	
	
	function getSelectedSavedSearch(asID)
	{
		if (this.collectionsView.selection.count > 0 && this.collectionsView.selection.currentIndex != -1) {
			var collection = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
			if (collection && collection.isSearch()) {
				return asID ? collection.ref.id : collection.ref;
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
		if (!this.itemsView) {
			return [];
		}
		
		return this.itemsView.getSelectedItems(asIDs);
	}
	
	
	this.getSelectedGroup = function (asID) {
		if (this.collectionsView.selection
				&& this.collectionsView.selection.count > 0
				&& this.collectionsView.selection.currentIndex != -1) {
			var itemGroup = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
			if (itemGroup && itemGroup.isGroup()) {
				return asID ? itemGroup.ref.id : itemGroup.ref;
			}
		}
		return false;
	}
	
	
	/*
	 * Returns an array of Zotero.Item objects of visible items in current sort order
	 *
	 * If asIDs is true, return an array of itemIDs instead
	 */
	function getSortedItems(asIDs) {
		if (!this.itemsView) {
			return [];
		}
		
		return this.itemsView.getSortedItems(asIDs);
	}
	
	
	function getSortField() {
		if (!this.itemsView) {
			return false;
		}
		
		return this.itemsView.getSortField();
	}
	
	
	function getSortDirection() {
		if (!this.itemsView) {
			return false;
		}
		
		return this.itemsView.getSortDirection();
	}
	
	
	this.buildCollectionContextMenu = function buildCollectionContextMenu()
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
			loadReport: 10,
			emptyTrash: 11,
			createBucket: 12,
			syncBucketList: 13,
			removeBucket: 14
		};
		
		var itemGroup = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
		
		var enable = [], disable = [], show = [];
		
		// Collection
		if (itemGroup.isCollection()) {
			show = [
				m.newSubcollection,
				m.sep1,
				m.editSelectedCollection,
				m.removeCollection,
				m.sep2,
				m.exportCollection,
				m.createBibCollection,
				m.loadReport
			];
			var s = [m.exportCollection, m.createBibCollection, m.loadReport];
			if (this.itemsView.rowCount>0) {
				enable = s;
			}
			else if (!this.collectionsView.isContainerEmpty(this.collectionsView.selection.currentIndex)) {
				enable = [m.exportCollection];
				disable = [m.createBibCollection, m.loadReport];
			}
			else {
				disable = s;
			}
			
			// Adjust labels
			menu.childNodes[m.editSelectedCollection].setAttribute('label', Zotero.getString('pane.collections.menu.rename.collection'));
			menu.childNodes[m.removeCollection].setAttribute('label', Zotero.getString('pane.collections.menu.remove.collection'));
			menu.childNodes[m.exportCollection].setAttribute('label', Zotero.getString('pane.collections.menu.export.collection'));
			menu.childNodes[m.createBibCollection].setAttribute('label', Zotero.getString('pane.collections.menu.createBib.collection'));
			menu.childNodes[m.loadReport].setAttribute('label', Zotero.getString('pane.collections.menu.generateReport.collection'));
		}
		// Saved Search
		else if (itemGroup.isSearch()) {
			show = [
				m.editSelectedCollection,
				m.removeCollection,
				m.sep2,
				m.exportCollection,
				m.createBibCollection,
				m.loadReport
			];
			
			var s = [m.exportCollection, m.createBibCollection, m.loadReport];
			if (this.itemsView.rowCount>0) {
				enable = s;
			}
			else {
				disable = s;
			}
			
			// Adjust labels
			menu.childNodes[m.editSelectedCollection].setAttribute('label', Zotero.getString('pane.collections.menu.edit.savedSearch'));
			menu.childNodes[m.removeCollection].setAttribute('label', Zotero.getString('pane.collections.menu.remove.savedSearch'));
			menu.childNodes[m.exportCollection].setAttribute('label', Zotero.getString('pane.collections.menu.export.savedSearch'));
			menu.childNodes[m.createBibCollection].setAttribute('label', Zotero.getString('pane.collections.menu.createBib.savedSearch'));
			menu.childNodes[m.loadReport].setAttribute('label', Zotero.getString('pane.collections.menu.generateReport.savedSearch'));
		}
		// Trash
		else if (itemGroup.isTrash()) {
			show = [m.emptyTrash];
		}
		// Header
		else if (itemGroup.isHeader()) {
			if (itemGroup.ref.id == 'commons-header') {
				show = [m.createBucket, m.syncBucketList];
			}
		}
		else if (itemGroup.isBucket()) {
			show = [m.removeBucket];
		}
		// Group
		else if (itemGroup.isGroup()) {
			show = [m.newCollection];
		}
		// Library
		else
		{
			show = [m.newCollection, m.newSavedSearch, m.sep1, m.exportFile];
		}
		
		// Disable some actions if user doesn't have write access
		var s = [m.editSelectedCollection, m.removeCollection, m.newCollection, m.newSavedSearch];
		if (itemGroup.isGroup() && !itemGroup.ref.editable) {
			disable = disable.concat(s);
		}
		else {
			enable = enable.concat(s);
		}
		
		for (var i in disable)
		{
			menu.childNodes[disable[i]].setAttribute('disabled', true);
		}
		
		for (var i in enable)
		{
			menu.childNodes[enable[i]].setAttribute('disabled', false);
		}
		
		// Hide all items by default
		for each(var pos in m) {
			menu.childNodes[pos].setAttribute('hidden', true);
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
			addAttachments: 3,
			sep2: 4,
			duplicateItem: 5,
			deleteItem: 6,
			deleteFromLibrary: 7,
			sep3: 8,
			exportItems: 9,
			createBib: 10,
			loadReport: 11,
			sep4: 12,
			createParent: 13,
			recognizePDF: 14,
			renameAttachments: 15,
			reindexItem: 16
		};
		
		var menu = document.getElementById('zotero-itemmenu');
		
		var enable = [], disable = [], show = [], hide = [], multiple = '';
		
		// TODO: implement menu for remote items
		if (!this.collectionsView.editable) {
			for each(var pos in m) {
				disable.push(pos);
			}
		}
		
		else if (this.itemsView && this.itemsView.selection.count > 0) {
			enable.push(m.showInLibrary, m.addNote, m.addAttachments,
				m.sep2, m.duplicateItem, m.deleteItem, m.deleteFromLibrary,
				m.exportItems, m.createBib, m.loadReport);
			
			// Multiple items selected
			if (this.itemsView.selection.count > 1) {
				var multiple =  '.multiple';
				hide.push(m.showInLibrary, m.sep1, m.addNote, m.addAttachments,
					m.sep2, m.duplicateItem);
				
				// If all items can be reindexed, or all items can be recognized, show option
				var items = this.getSelectedItems();
				var canIndex = true;
				var canRecognize = true;
				if (!Zotero.Fulltext.pdfConverterIsRegistered()) {
					canIndex = false;
				}
				for (var i=0; i<items.length; i++) {
					if (canIndex && !Zotero.Fulltext.canReindex(items[i].id)) {
						canIndex = false;
					}
					if (canRecognize && !Zotero_RecognizePDF.canRecognize(items[i])) {
						canRecognize = false;
					}
					if (!canIndex && !canRecognize) {
						break;
					}
				}
				if (canIndex) {
					show.push(m.reindexItem);
				}
				else {
					hide.push(m.reindexItem);
				}
				if (canRecognize) {
					show.push(m.recognizePDF);
					hide.push(m.createParent);
				}
				else {
					hide.push(m.recognizePDF);
					
					var canCreateParent = true;
					for (var i=0; i<items.length; i++) {
						if (!items[i].isTopLevelItem() || items[i].isRegularItem() || Zotero_RecognizePDF.canRecognize(items[i])) {
							canCreateParent = false;
							break;
						}
					}
					if (canCreateParent) {
						show.push(m.createParent);
					}
					else {
						hide.push(m.createParent);
					}
				}
				
				// If all items are child attachments, show rename option
				var canRename = true;
				for (var i=0; i<items.length; i++) {
					var item = items[i];
					// Same check as in rename function
					if (!item.isAttachment() || !item.getSource() || item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
						canRename = false;
						break;
					}
				}
				if (canRename) {
					show.push(m.renameAttachments);
				}
				else {
					hide.push(m.renameAttachments);
				}
				
				// Add in attachment separator
				if (canCreateParent || canRecognize || canRename || canIndex) {
					show.push(m.sep4);
				}
				else {
					hide.push(m.sep4);
				}

			}
			// Single item selected
			else
			{
				var item = this.itemsView._getItemAtRow(this.itemsView.selection.currentIndex).ref;
				var itemID = item.id;
				menu.setAttribute('itemID', itemID);
				
				// Show in Library
				if (!this.itemsView._itemGroup.isLibrary()) {
					show.push(m.showInLibrary, m.sep1);
				}
				else {
					hide.push(m.showInLibrary, m.sep1);
				}
				
				if (item.isRegularItem())
				{
					show.push(m.addNote, m.addAttachments, m.sep2);
				}
				else
				{
					hide.push(m.addNote, m.addAttachments, m.sep2);
				}
				
				if (item.isAttachment()) {
					var showSep4 = false;
					hide.push(m.duplicateItem);
					
					if (Zotero_RecognizePDF.canRecognize(item)) {
						show.push(m.recognizePDF);
						hide.push(m.createParent);
						showSep4 = true;
					}
					else {
						hide.push(m.recognizePDF);
						
						// If not a PDF, allow parent item creation
						if (item.isTopLevelItem()) {
							show.push(m.createParent);
							showSep4 = true;
						}
						else {
							hide.push(m.createParent);
						}
					}
					
					// Attachment rename option
					if (item.getSource() && item.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) {
						show.push(m.renameAttachments);
						showSep4 = true;
					}
					else {
						hide.push(m.renameAttachments);
					}
					
					if (showSep4) {
						show.push(m.sep4);
					}
					else {
						hide.push(m.sep4);
					}
					
					// If not linked URL, show reindex line
					if (Zotero.Fulltext.pdfConverterIsRegistered()
							&& Zotero.Fulltext.canReindex(item.id)) {
						show.push(m.reindexItem);
						showSep4 = true;
					}
					else {
						hide.push(m.reindexItem);
					}
				}
				else {
					if (item.isNote() && item.isTopLevelItem()) {
						show.push(m.sep4, m.createParent);
					}
					else {
						hide.push(m.sep4, m.createParent);
					}
					
					show.push(m.duplicateItem);
					hide.push(m.recognizePDF, m.renameAttachments, m.reindexItem);
				}
				
				// Update attachment submenu
				var popup = document.getElementById('zotero-add-attachment-popup')
				this.updateAttachmentButtonMenu(popup);
			}
		}
		// No items selected
		else
		{
			// Show in Library
			if (!this.itemsView._itemGroup.isLibrary()) {
				show.push(m.showInLibrary, m.sep1);
			}
			else {
				hide.push(m.showInLibrary, m.sep1);
			}
			
			disable.push(m.showInLibrary, m.duplicateItem, m.deleteItem,
				m.deleteFromLibrary, m.exportItems, m.createBib, m.loadReport);
			hide.push(m.addNote, m.addAttachments, m.sep2, m.sep4, m.reindexItem,
				m.createParent, m.recognizePDF, m.renameAttachments);
		}
		
		// Remove from collection
		if (this.itemsView._itemGroup.isCollection() && !(item && item.getSource()))
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
		// TODO: localize
		menu.childNodes[m.createParent].setAttribute('label', multiple ? "Create Parent Items from Selected Items" : "Create Parent Item from Selected Item");
		menu.childNodes[m.recognizePDF].setAttribute('label', Zotero.getString('pane.items.menu.recognizePDF' + multiple));
		// TODO: localize
		menu.childNodes[m.renameAttachments].setAttribute('label', multiple ? "Rename Files from Parent Metadata" : "Rename File from Parent Metadata");
		menu.childNodes[m.reindexItem].setAttribute('label', Zotero.getString('pane.items.menu.reindexItem' + multiple));
		
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
	this.onTreeClick = function (event) {
		// We only care about primary button double and triple clicks
		if (!event || (event.detail != 2 && event.detail != 3) || event.button != 0) {
			return;
		}
		
		var t = event.originalTarget;
		
		if (t.localName != 'treechildren') {
			return;
		}
		
		var tree = t.parentNode;
		
		var row = {}, col = {}, obj = {};
		tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
		
		// obj.value == 'cell'/'text'/'image'
		if (!obj.value) {
			return;
		}
		
		if (tree.id == 'zotero-collections-tree') {
			// Ignore triple clicks for collections
			if (event.detail != 2) {
				return;
			}
			
			var itemGroup = ZoteroPane.collectionsView._getItemAtRow(tree.view.selection.currentIndex);
			if (itemGroup.isLibrary()) {
				var uri = Zotero.URI.getCurrentUserLibraryURI();
				if (uri) {
					ZoteroPane.loadURI(uri);
					event.stopPropagation();
				}
				return;
			}
			
			if (itemGroup.isSearch()) {
				ZoteroPane.editSelectedCollection();
				return;
			}
			
			if (itemGroup.isGroup()) {
				var uri = Zotero.URI.getGroupURI(itemGroup.ref, true);
				ZoteroPane.loadURI(uri);
				event.stopPropagation();
				return;
			}
			
			if (itemGroup.isHeader()) {
				if (itemGroup.ref.id == 'group-libraries-header') {
					var uri = Zotero.URI.getGroupsURL();
					ZoteroPane.loadURI(uri);
					event.stopPropagation();
				}
				else if(itemGroup.ref.id == 'commons-header') {
					ZoteroPane.loadURI(Zotero.Commons.uri);
					event.stopPropagation();
				}
				return;
			}

			if (itemGroup.isBucket()) {
				ZoteroPane.loadURI(itemGroup.ref.uri);
				event.stopPropagation();
			}
		}
		else if (tree.id == 'zotero-items-tree') {
			var viewOnDoubleClick = Zotero.Prefs.get('viewOnDoubleClick');
			
			// Expand/collapse on triple-click
			if (viewOnDoubleClick) {
				if (event.detail == 3) {
					tree.view.toggleOpenState(tree.view.selection.currentIndex);
					return;
				}
				
				// Don't expand/collapse on double-click
				event.stopPropagation();
			}
			
			if (tree.view && tree.view.selection.currentIndex > -1) {
				var item = ZoteroPane.getSelectedItems()[0];
				if (item) {
					if (item.isRegularItem()) {
						if (!viewOnDoubleClick) {
							return;
						}
						
						var uri = Components.classes["@mozilla.org/network/standard-url;1"].
								createInstance(Components.interfaces.nsIURI);
						var snapID = item.getBestSnapshot();
						if (snapID) {
							spec = Zotero.Items.get(snapID).getLocalFileURL();
							if (spec) {
								uri.spec = spec;
								if (uri.scheme && uri.scheme == 'file') {
									ZoteroPane.viewAttachment(snapID, event);
									return;
								}
							}
						}
						
						var uri = item.getField('url');
						if (!uri) {
							var doi = item.getField('DOI');
							if (doi) {
								// Pull out DOI, in case there's a prefix
								doi = Zotero.Utilities.prototype.cleanDOI(doi);
								if (doi) {
									uri = "http://dx.doi.org/" + encodeURIComponent(doi);
								}
							}
						}
						if (uri) {
							ZoteroPane.loadURI(uri);
						}
					}
					else if (item.isNote()) {
						if (!ZoteroPane.collectionsView.editable) {
							return;
						}
						document.getElementById('zotero-view-note-button').doCommand();
					}
					else if (item.isAttachment()) {
						ZoteroPane.viewSelectedAttachment(event);
					}
				}
			}
		}
	}
	
	
	this.startDrag = function (event, element) {
		if (Zotero.isFx2 || Zotero.isFx30) {
			nsDragAndDrop.startDrag(event, element);
			return;
		}
		element.onDragStart(event);
	}
	
	
	this.dragEnter = function (event, element) {
		if (Zotero.isFx2 || Zotero.isFx30) {
			return;
		}
		return element.onDragEnter(event);
	}
	
	
	this.dragOver = function (event, element) {
		if (Zotero.isFx2 || Zotero.isFx30) {
			return nsDragAndDrop.dragOver(event, element);
		}
		return element.onDragOver(event);
	}
	
	
	this.dragDrop = function (event, element) {
		if (Zotero.isFx2 || Zotero.isFx30) {
			return nsDragAndDrop.drop(event, element);
		}
		return element.onDrop(event);
	}
	
	
	this.openPreferences = function (paneID, action) {
		var io = {
			pane: paneID,
			action: action
		};
		window.openDialog('chrome://zotero/content/preferences/preferences.xul',
			'zotero-prefs',
			'chrome,titlebar,toolbar,'
				+ Zotero.Prefs.get('browser.preferences.instantApply', true) ? 'dialog=no' : 'modal',
			io
		);
	}
	
	
	/*
	 * Loads a URL following the standard modifier key behavior
	 *  (e.g. meta-click == new background tab, meta-shift-click == new front tab,
	 *  shift-click == new window, no modifier == frontmost tab
	 */
	function loadURI(uri, event, data) {
		// Open in new tab
		if (event && (event.metaKey || (!Zotero.isMac && event.ctrlKey))) {
			var tab = gBrowser.addTab(uri);
			var browser = gBrowser.getBrowserForTab(tab);
			
			if (event.shiftKey) {
				gBrowser.selectedTab = tab;
			}
		}
		else if (event && event.shiftKey) {
			window.open(uri, "zotero-loaded-page",
				"menubar=yes,location=yes,toolbar=yes,personalbar=yes,resizable=yes,scrollbars=yes,status=yes");
		}
		else {
			window.loadURI(uri);
		}
	}
	
	
	function setItemsPaneMessage(msg, lock) {
		var elem = document.getElementById('zotero-items-pane-message-box');
		
		if (elem.getAttribute('locked') == 'true') {
			return;
		}
		
		while (elem.hasChildNodes()) {
			elem.removeChild(elem.firstChild);
		}
		var msgParts = msg.split("\n\n");
		for (var i=0; i<msgParts.length; i++) {
			var desc = document.createElement('description');
			desc.appendChild(document.createTextNode(msgParts[i]));
			elem.appendChild(desc);
		}
		
		// Make message permanent
		if (lock) {
			elem.setAttribute('locked', true);
		}
		
		document.getElementById('zotero-items-pane-content').selectedIndex = 1;
	}
	
	
	function clearItemsPaneMessage() {
		// If message box is locked, don't clear
		var box = document.getElementById('zotero-items-pane-message-box');
		if (box.getAttribute('locked') == 'true') {
			return;
		}
		
		document.getElementById('zotero-items-pane-content').selectedIndex = 0;
	}
	
	
	// Updates browser context menu options
	function contextPopupShowing()
	{
		if (!Zotero.Prefs.get('browserContentContextMenu')) {
			return;
		}
		
		var menuitem = document.getElementById("zotero-context-add-to-current-note");
		var showing = false;
		if (menuitem){
			var items = ZoteroPane.getSelectedItems();
			if (ZoteroPane.itemsView.selection && ZoteroPane.itemsView.selection.count==1
				&& items[0] && items[0].isNote()
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
		
		var menuitem = document.getElementById("zotero-context-save-link-as-item");
		if (menuitem) {
			if (window.gContextMenu.onLink) {
				menuitem.hidden = false;
				showing = true;
			}
			else {
				menuitem.hidden = true;
			}
		}
		
		var menuitem = document.getElementById("zotero-context-save-image-as-item");
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
		
		// If Zotero is locked or library is read-only, disable menu items
		var menu = document.getElementById('zotero-content-area-context-menu');
		menu.hidden = !showing;
		var disabled = Zotero.locked;
		if (!disabled && self.collectionsView.selection && self.collectionsView.selection.count) {
			var itemGroup = self.collectionsView._getItemAtRow(self.collectionsView.selection.currentIndex);
			disabled = !itemGroup.editable;
		}
		for each(var menuitem in menu.firstChild.childNodes) {
			menuitem.disabled = disabled;
		}
	}
	
	
	this.newNote = function (popup, parent, text) {
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return;
		}
		
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		if (!popup) {
			if (!text) {
				text = '';
			}
			text = Zotero.Utilities.prototype.trim(text);
			
			var item = new Zotero.Item('note');
			item.libraryID = this.getSelectedLibraryID();
			item.setNote(text);
			if (parent) {
				item.setSource(parent);
			}
			var itemID = item.save();
			
			if (!parent && this.itemsView && this.itemsView._itemGroup.isCollection()) {
				this.itemsView._itemGroup.ref.addItem(itemID);
			}
			
			this.selectItem(itemID);
			
			document.getElementById('zotero-note-editor').focus();
		}
		else
		{
			// TODO: _text_
			var c = this.getSelectedCollection();
			if (c) {
				this.openNoteWindow(null, c.id);
			}
			else {
				this.openNoteWindow();
			}
		}
	}
	
	
	function addTextToNote(text)
	{
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		try {
			// trim
			text = text.replace(/^[\xA0\r\n\s]*(.*)[\xA0\r\n\s]*$/m, "$1");
		}
		catch (e){}
		
		if (!text || !text.length)
		{
			return false;
		}
		
		var items = this.getSelectedItems();
		if (this.itemsView.selection.count == 1 && items[0] && items[0].isNote()) {
			var note = items[0].getNote()
			
			items[0].setNote(note == '' ? text : note + "\n\n" + text);
			items[0].save();
			
			var noteElem = document.getElementById('zotero-note-editor')
			noteElem.focus();
			noteElem.noteField.inputField.editor.
				selectionController.scrollSelectionIntoView(1,
					1,
					true);
			return true;
		}
		
		return false;
	}
	
	function openNoteWindow(itemID, col, parentItemID)
	{
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var name = null;
		
		if (itemID) {
			// Create a name for this window so we can focus it later
			//
			// Collection is only used on new notes, so we don't need to
			// include it in the name
			name = 'zotero-note-' + itemID;
			
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
			var e = wm.getEnumerator('');
			while (e.hasMoreElements()) {
				var w = e.getNext();
				if (w.name == name) {
					w.focus();
					return;
				}
			}
		}
		
		window.open('chrome://zotero/content/note.xul?v=1'
			+ (itemID ? '&id=' + itemID : '') + (col ? '&coll=' + col : '')
			+ (parentItemID ? '&p=' + parentItemID : ''),
			name, 'chrome,resizable,centerscreen');
	}
	
	
	function addAttachmentFromDialog(link, id)
	{
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		if (!this.canEditFiles()) {
			this.displayCannotEditLibraryFilesMessage();
			return;
		}
		
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
        					.createInstance(nsIFilePicker);
		fp.init(window, Zotero.getString('pane.item.attachments.select'), nsIFilePicker.modeOpenMultiple);
		fp.appendFilters(Components.interfaces.nsIFilePicker.filterAll);
		
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
					var c = this.getSelectedCollection();
					if(c)
						c.addItem(attachmentID);
				}
			}
		}
	}
	
	
	this.addItemFromPage = function (itemType, saveSnapshot, row) {
		if (!this.canEdit(row)) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		return this.addItemFromDocument(window.content.document, itemType, saveSnapshot, row);
	}
	
	
	/**
	 * @param	{Document}			doc
	 * @param	{String|Integer}	[itemType='webpage']	Item type id or name
	 * @param	{Boolean}			[saveSnapshot]			Force saving or non-saving of a snapshot,
	 *														regardless of automaticSnapshots pref
	 */
	this.addItemFromDocument = function (doc, itemType, saveSnapshot, row) {
		var progressWin = new Zotero.ProgressWindow();
		progressWin.changeHeadline(Zotero.getString('ingester.scraping'));
		var icon = 'chrome://zotero/skin/treeitem-webpage.png';
		progressWin.addLines(doc.title, icon)
		progressWin.show();
		progressWin.startCloseTimer();
		
		// TODO: this, needless to say, is a temporary hack
		if (itemType == 'temporaryPDFHack') {
			itemType = null;
			var isPDF = false;
			if (doc.title.indexOf('application/pdf') != -1) {
				isPDF = true;
			}
			else {
				var ios = Components.classes["@mozilla.org/network/io-service;1"].
							getService(Components.interfaces.nsIIOService);
				try {
					var uri = ios.newURI(doc.location, null, null);
					if (uri.fileName && uri.fileName.match(/pdf$/)) {
						isPDF = true;
					}
				}
				catch (e) {
					Zotero.debug(e);
					Components.utils.reportError(e);
				}
			}
			
			if (isPDF) {
				//
				// Duplicate newItem() checks here
				//
				if (!Zotero.stateCheck()) {
					this.displayErrorMessage(true);
					return false;
				}
				
				// Currently selected row
				if (row === undefined) {
					row = this.collectionsView.selection.currentIndex;
				}
				
				if (!this.canEdit(row)) {
					this.displayCannotEditLibraryMessage();
					return;
				}
				
				if (row !== undefined) {
					var itemGroup = this.collectionsView._getItemAtRow(row);
					var libraryID = itemGroup.ref.libraryID;
				}
				else {
					var libraryID = null;
					var itemGroup = null;
				}
				//
				//
				//
				
				if (!this.canEditFiles(row)) {
					this.displayCannotEditLibraryFilesMessage();
					return;
				}
				
				if (itemGroup && itemGroup.isCollection()) {
					var collectionID = itemGroup.ref.id;
				}
				else {
					var collectionID = false;
				}
				
				Zotero.Attachments.importFromDocument(doc, false, false, collectionID, null, libraryID);
				return;
			}
		}
		
		// Save web page item by default
		if (!itemType) {
			itemType = 'webpage';
		}
		var data = {
			title: doc.title,
			url: doc.location.href,
			accessDate: "CURRENT_TIMESTAMP"
		}
		itemType = Zotero.ItemTypes.getID(itemType);
		var item = this.newItem(itemType, data, row);
		
		if (item.libraryID) {
			var group = Zotero.Groups.getByLibraryID(item.libraryID);
			filesEditable = group.filesEditable;
		}
		else {
			filesEditable = true;
		}
		
		// Save snapshot if explicitly enabled or automatically pref is set and not explicitly disabled
		if (saveSnapshot || (saveSnapshot !== false && Zotero.Prefs.get('automaticSnapshots'))) {
			var link = false;
			
			if (link) {
				Zotero.Attachments.linkFromDocument(doc, item.id);
			}
			else if (filesEditable) {
				Zotero.Attachments.importFromDocument(doc, item.id);
			}
		}
		
		return item.id;
	}
	
	
	this.addItemFromURL = function (url, itemType, saveSnapshot, row) {
		if (url == window.content.document.location.href) {
			return this.addItemFromPage(itemType, saveSnapshot, row);
		}
		
		Zotero.MIME.getMIMETypeFromURL(url, function (mimeType, hasNativeHandler) {
			// If native type, save using a hidden browser
			if (hasNativeHandler) {
				var processor = function (doc) {
					ZoteroPane.addItemFromDocument(doc, itemType, saveSnapshot, row);
				};
				
				var done = function () {}
				
				var exception = function (e) {
					Zotero.debug(e);
				}
				
				Zotero.Utilities.HTTP.processDocuments([url], processor, done, exception);
			}
			// Otherwise create placeholder item, attach attachment, and update from that
			else {
				// TODO: this, needless to say, is a temporary hack
				if (itemType == 'temporaryPDFHack') {
					itemType = null;
					
					if (mimeType == 'application/pdf') {
						//
						// Duplicate newItem() checks here
						//
						if (!Zotero.stateCheck()) {
							ZoteroPane.displayErrorMessage(true);
							return false;
						}
						
						// Currently selected row
						if (row === undefined) {
							row = ZoteroPane.collectionsView.selection.currentIndex;
						}
						
						if (!ZoteroPane.canEdit(row)) {
							ZoteroPane.displayCannotEditLibraryMessage();
							return;
						}
						
						if (row !== undefined) {
							var itemGroup = ZoteroPane.collectionsView._getItemAtRow(row);
							var libraryID = itemGroup.ref.libraryID;
						}
						else {
							var libraryID = null;
							var itemGroup = null;
						}
						//
						//
						//
						
						if (libraryID) {
							var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
										.getService(Components.interfaces.nsIPrompt);
							pr.alert("", "Files cannot currently be added to group libraries.");
							return;
						}
						
						if (itemGroup && itemGroup.isCollection()) {
							var collectionID = itemGroup.ref.id;
						}
						else {
							var collectionID = false;
						}
						
						Zotero.Attachments.importFromURL(url, false, false, false, collectionID);
						return;
					}
				}
				
				if (!itemType) {
					itemType = 'webpage';
				}
				
				var item = ZoteroPane.newItem(itemType, {}, row);
				
				if (item.libraryID) {
					var group = Zotero.Groups.getByLibraryID(item.libraryID);
					filesEditable = group.filesEditable;
				}
				else {
					filesEditable = true;
				}
				
				// Save snapshot if explicitly enabled or automatically pref is set and not explicitly disabled
				if (saveSnapshot || (saveSnapshot !== false && Zotero.Prefs.get('automaticSnapshots'))) {
					var link = false;
					
					if (link) {
						//Zotero.Attachments.linkFromURL(doc, item.id);
					}
					else if (filesEditable) {
						var attachmentItem = Zotero.Attachments.importFromURL(url, item.id, false, false, false, mimeType);
						if (attachmentItem) {
							item.setField('title', attachmentItem.getField('title'));
							item.setField('url', attachmentItem.getField('url'));
							item.setField('accessDate', attachmentItem.getField('accessDate'));
							item.save();
						}
					}
				}
				
				return item.id;

			}
		});
	}
	
	
	/*
	 * Create an attachment from the current page
	 *
	 * |itemID|    -- itemID of parent item
	 * |link|      -- create web link instead of snapshot
	 */
	this.addAttachmentFromPage = function (link, itemID)
	{
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return;
		}
		
		if (typeof itemID != 'number') {
			throw ("itemID must be an integer in ZoteroPane.addAttachmentFromPage()");
		}
		
		var progressWin = new Zotero.ProgressWindow();
		progressWin.changeHeadline(Zotero.getString('save.' + (link ? 'link' : 'attachment')));
		var type = link ? 'web-link' : 'snapshot';
		var icon = 'chrome://zotero/skin/treeitem-attachment-' + type + '.png';
		progressWin.addLines(window.content.document.title, icon)
		progressWin.show();
		progressWin.startCloseTimer();
		
		if (link) {
			Zotero.Attachments.linkFromDocument(window.content.document, itemID);
		}
		else {
			Zotero.Attachments.importFromDocument(window.content.document, itemID);
		}
	}
	
	
	function viewAttachment(itemID, event, noLocateOnMissing) {
		var attachment = Zotero.Items.get(itemID);
		if (!attachment.isAttachment()) {
			throw ("Item " + itemID + " is not an attachment in ZoteroPane.viewAttachment()");
		}
		
		if (attachment.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
			this.loadURI(attachment.getField('url'), event);
			return;
		}
		
		var file = attachment.getFile();
		if (file) {
			var mimeType = attachment.getAttachmentMIMEType();
			// If no MIME type specified, try to detect again (I guess in case
			// we've gotten smarter since the file was imported?)
			if (!mimeType) {
				var mimeType = Zotero.MIME.getMIMETypeFromFile(file);
				var ext = Zotero.File.getExtension(file);
				
				// TODO: update DB with new info
			}
			var ext = Zotero.File.getExtension(file);
			var isNative = Zotero.MIME.hasNativeHandler(mimeType, ext);
			var internal = Zotero.MIME.hasInternalHandler(mimeType, ext);
			
			if (isNative ||
					(internal && !Zotero.Prefs.get('launchNonNativeFiles'))) {
				
				var url = 'zotero://attachment/' + itemID + '/';
				this.loadURI(url, event, { attachmentID: itemID});
			}
			else {
				var fileURL = attachment.getLocalFileURL();
				
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
			this.showAttachmentNotFoundDialog(itemID, noLocateOnMissing);
		}
	}
	
	
	function viewSelectedAttachment(event, noLocateOnMissing)
	{
		if (this.itemsView && this.itemsView.selection.count == 1) {
			this.viewAttachment(this.getSelectedItems(true)[0], event, noLocateOnMissing);
		}
	}
	
	
	this.showAttachmentInFilesystem = function (itemID, noLocateOnMissing) {
		var attachment = Zotero.Items.get(itemID)
		if (attachment.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) {
			var file = attachment.getFile();
			if (file){
				try {
					file.reveal();
				}
				catch (e) {
					// On platforms that don't support nsILocalFile.reveal() (e.g. Linux),
					// "double-click" the parent directory
					try {
						var parent = file.parent.QueryInterface(Components.interfaces.nsILocalFile);
						parent.launch();
					}
					// If launch also fails, try the OS handler
					catch (e) {
						var uri = Components.classes["@mozilla.org/network/io-service;1"].
									getService(Components.interfaces.nsIIOService).
									newFileURI(parent);
						var protocolService =
							Components.classes["@mozilla.org/uriloader/external-protocol-service;1"].
								getService(Components.interfaces.nsIExternalProtocolService);
						protocolService.loadUrl(uri);
					}
				}
			}
			else {
				this.showAttachmentNotFoundDialog(attachment.id, noLocateOnMissing)
			}
		}
	}
	
	
	/**
	 * Test if the user can edit the currently selected library/collection,
	 * and display an error if not
	 *
	 * @param	{Integer}	[row]
	 *
	 * @return	{Boolean}		TRUE if user can edit, FALSE if not
	 */
	this.canEdit = function (row) {
		// Currently selected row
		if (row === undefined) {
			row = this.collectionsView.selection.currentIndex;
		}
		
		var itemGroup = this.collectionsView._getItemAtRow(row);
		return itemGroup.editable;
	}
	
	
	/**
	 * Test if the user can edit the currently selected library/collection,
	 * and display an error if not
	 *
	 * @param	{Integer}	[row]
	 *
	 * @return	{Boolean}		TRUE if user can edit, FALSE if not
	 */
	this.canEditFiles = function (row) {
		// Currently selected row
		if (row === undefined) {
			row = this.collectionsView.selection.currentIndex;
		}
		
		var itemGroup = this.collectionsView._getItemAtRow(row);
		return itemGroup.filesEditable;
	}
	
	
	this.displayCannotEditLibraryMessage = function () {
		var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
					.getService(Components.interfaces.nsIPrompt);
		pr.alert("", "You cannot make changes to the currently selected library.");
	}
	
	
	this.displayCannotEditLibraryFilesMessage = function () {
		var pr = Components.classes["@mozilla.org/network/default-prompt;1"]
					.getService(Components.interfaces.nsIPrompt);
		pr.alert("", "You cannot add files to the currently selected library.");
	}
	
	
	function showAttachmentNotFoundDialog(itemID, noLocate) {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
				createInstance(Components.interfaces.nsIPromptService);
		
		
		// Don't show Locate button
		if (noLocate) {
			var index = ps.alert(null,
				Zotero.getString('pane.item.attachments.fileNotFound.title'),
				Zotero.getString('pane.item.attachments.fileNotFound.text')
			);
			return;
		}
		
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		var index = ps.confirmEx(null,
			Zotero.getString('pane.item.attachments.fileNotFound.title'),
			Zotero.getString('pane.item.attachments.fileNotFound.text'),
			buttonFlags, Zotero.getString('general.locate'), null,
			null, null, {});
		
		if (index == 0) {
			this.relinkAttachment(itemID);
		}
	}
	
	
	this.createParentItemsFromSelected = function () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		
		var items = this.getSelectedItems();
		for (var i=0; i<items.length; i++) {
			var item = items[i];
			if (!item.isTopLevelItem() || item.isRegularItem()) {
				throw('Item ' + itemID + ' is not a top-level attachment or note in ZoteroPane.createParentItemsFromSelected()');
			}
			
			Zotero.DB.beginTransaction();
			// TODO: remove once there are no top-level web attachments
			if (item.isWebAttachment()) {
				var parent = new Zotero.Item('webpage');
			}
			else {
				var parent = new Zotero.Item('document');
			}
			parent.libraryID = item.libraryID;
			parent.setField('title', item.getField('title'));
			if (item.isWebAttachment()) {
				parent.setField('accessDate', item.getField('accessDate'));
				parent.setField('url', item.getField('url'));
			}
			var itemID = parent.save();
			item.setSource(itemID);
			item.save();
			Zotero.DB.commitTransaction();
		}
	}
	
	
	this.renameSelectedAttachmentsFromParents = function () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var items = this.getSelectedItems();
		
		for (var i=0; i<items.length; i++) {
			var item = items[i];
			
			if (!item.isAttachment() || !item.getSource() || item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
				throw('Item ' + itemID + ' is not a child file attachment in ZoteroPane.renameAttachmentFromParent()');
			}
			
			var file = item.getFile();
			if (!file) {
				continue;
			}
			
			// If the attachment title was the same as the filename, change it too
			var renameTitle = item.getField('title') == file.leafName;
			
			var parentItemID = item.getSource();
			var newName = Zotero.Attachments.getFileBaseNameFromItem(parentItemID);
			
			var ext = file.leafName.match(/[^\.]+$/);
			if (ext) {
				newName = newName + '.' + ext;
			}
			
			var renamed = item.renameAttachmentFile(newName);
			if (renamed !== true) {
				Zotero.debug("Could not rename file (" + renamed + ")");
				continue;
			}
			
			if (renameTitle) {
				item.setField('title', newName);
				item.save();
			}
		}
		
		return true;
	}
	
	
	function relinkAttachment(itemID) {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var item = Zotero.Items.get(itemID);
		if (!item) {
			throw('Item ' + itemID + ' not found in ZoteroPane.relinkAttachment()');
		}
		
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
					.createInstance(nsIFilePicker);
		fp.init(window, Zotero.getString('pane.item.attachments.select'), nsIFilePicker.modeOpen);
		
		
		var file = item.getFile(false, true);
		var dir = Zotero.File.getClosestDirectory(file);
		if (dir) {
			dir.QueryInterface(Components.interfaces.nsILocalFile);
			fp.displayDirectory = dir;
		}
		
		fp.appendFilters(Components.interfaces.nsIFilePicker.filterAll);
		
		if (fp.show() == nsIFilePicker.returnOK) {
			var file = fp.file;
			file.QueryInterface(Components.interfaces.nsILocalFile);
			item.relinkAttachmentFile(file);
		}
	}
	
	
	this.setLastSyncStatus = function (tooltip) {
		var label = tooltip.firstChild.nextSibling;
		
		var lastSyncTime = Zotero.Sync.Server.lastLocalSyncTime;
		// TODO: localize
		msg = 'Last sync: ';
		if (lastSyncTime) {
			var time = new Date(lastSyncTime * 1000);
			msg += Zotero.Date.toRelativeDate(time);
		}
		else {
			msg += 'Not yet synced';
		}
		label.value = msg;
	}
	
	
	function reportErrors() {
		var errors = Zotero.getErrors(true);
		var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
				   .getService(Components.interfaces.nsIWindowWatcher);
		var data = {
			msg: Zotero.getString('errorReport.followingErrors', Zotero.appName),
			e: errors.join('\n\n'),
			askForSteps: true
		};
		var io = { wrappedJSObject: { Zotero: Zotero, data:  data } };
		var win = ww.openWindow(null, "chrome://zotero/content/errorReport.xul",
					"zotero-error-report", "chrome,centerscreen,modal", io);
	}
	
	
	/*
	 * Display an error message saying that an error has occurred and Firefox
	 * needs to be restarted.
	 *
	 * If |popup| is TRUE, display in popup progress window; otherwise, display
	 * as items pane message
	 */
	function displayErrorMessage(popup) {
		var reportErrorsStr = Zotero.getString('errorReport.reportErrors');
		var reportInstructions =
			Zotero.getString('errorReport.reportInstructions', reportErrorsStr)
		
		// Display as popup progress window
		if (popup) {
			var pw = new Zotero.ProgressWindow();
			pw.changeHeadline(Zotero.getString('general.errorHasOccurred'));
			var desc = Zotero.getString('general.restartFirefox') + ' '
				+ reportInstructions;
			pw.addDescription(desc);
			pw.show();
			pw.startCloseTimer(8000);
		}
		// Display as items pane message
		else {
			var msg = Zotero.getString('general.errorHasOccurred') + ' '
				+ Zotero.getString('general.restartFirefox') + '\n\n'
				+ reportInstructions;
			self.setItemsPaneMessage(msg, true);
		}
	}
}

window.addEventListener("load", function(e) { ZoteroPane.onLoad(e); }, false);
window.addEventListener("unload", function(e) { ZoteroPane.onUnload(e); }, false);
