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
	this.buildCollectionContextMenu = buildCollectionContextMenu;
	this.buildItemContextMenu = buildItemContextMenu;
	this.onDoubleClick = onDoubleClick;
	this.loadURI = loadURI;
	this.setItemsPaneMessage = setItemsPaneMessage;
	this.clearItemsPaneMessage = clearItemsPaneMessage;
	this.contextPopupShowing = contextPopupShowing;
	this.openNoteWindow = openNoteWindow;
	this.newNote = newNote;
	this.addTextToNote = addTextToNote;
	this.addItemFromPage = addItemFromPage;
	this.addAttachmentFromDialog = addAttachmentFromDialog;
	this.addAttachmentFromPage = addAttachmentFromPage;
	this.viewAttachment = viewAttachment;
	this.viewSelectedAttachment = viewSelectedAttachment;
	this.showAttachmentNotFoundDialog = showAttachmentNotFoundDialog;
	this.relinkAttachment = relinkAttachment;
	this.reportErrors = reportErrors;
	this.displayErrorMessage = displayErrorMessage;
	
	const DEFAULT_ZPANE_HEIGHT = 300;
	const COLLECTIONS_HEIGHT = 125; // minimum height of the collections pane and toolbar
	
	var self = this;
	
	/*
	 * Called when the window is open
	 */
	function onLoad()
	{
		if (!Zotero || !Zotero.initialized) {
			return;
		}
		
		if(Zotero.Prefs.get("zoteroPaneOnTop"))
		{
			var oldPane = document.getElementById('zotero-pane');
			var oldSplitter = document.getElementById('zotero-splitter');
			var appContent = document.getElementById('appcontent');
			
			var newPane = document.createElement('hbox');
			newPane.setAttribute('id','zotero-pane');
			newPane.setAttribute('persist','savedHeight');
			newPane.setAttribute('hidden', true);
			newPane.setAttribute('onkeydown', 'ZoteroPane.handleKeyDown(event, this.id)');
			newPane.setAttribute('onkeyup', 'ZoteroPane.handleKeyUp(event, this.id)');
			newPane.setAttribute('chromedir', '&locale.dir;');
			
			newPane.height = oldPane.height;
			while(oldPane.hasChildNodes())
				newPane.appendChild(oldPane.firstChild);
			appContent.removeChild(oldPane);
			appContent.insertBefore(newPane, document.getElementById('content'));
			
			var newSplitter = document.createElement('splitter');
			newSplitter.setAttribute('id','zotero-splitter');
			newSplitter.setAttribute('hidden', true);
			newSplitter.setAttribute('resizebefore','closest');
			newSplitter.setAttribute('resizeafter','closest');
			newSplitter.setAttribute('onmouseup', 'ZoteroPane.updateTagSelectorSize()');
			appContent.removeChild(oldSplitter);
			appContent.insertBefore(newSplitter, document.getElementById('content'));
			
			document.getElementById('zotero-tb-fullscreen').setAttribute('zoterotop','true');
		}
		
		Zotero.setFontSize(document.getElementById('zotero-pane'))
		
		if (Zotero.isMac) {
			document.getElementById('zotero-tb-actions-zeroconf-update').setAttribute('hidden', false);
		}
		
		//Initialize collections view
		this.collectionsView = new Zotero.CollectionTreeView();
		var collectionsTree = document.getElementById('zotero-collections-tree');
		collectionsTree.view = this.collectionsView;
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
		
		// If the database was initialized and Zotero hasn't been run before
		// in this profile, display the Quick Start Guide -- this way the guide
		// won't be displayed when they sync their DB to another profile or if
		// they the DB is initialized erroneously (e.g. while switching data
		// directory locations)
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
					Zotero.Sync.Server.sync(function () {
						pr.alert(
							"Restore Completed",
							"The local Zotero database has been successfully restored."
						);
					});
				}
			}, 1000);
		}
		else if (Zotero.Schema.dbInitialized && Zotero.Prefs.get('firstRun')) {
			setTimeout(function () {
				gBrowser.selectedTab = gBrowser.addTab(ZOTERO_CONFIG.FIRST_RUN_URL);
			}, 400);
			Zotero.Prefs.set('firstRun', false);
		}
		
		// Hide sync debugging menu by default
		if (Zotero.Prefs.get('sync.debugMenu')) {
			var sep = document.getElementById('zotero-tb-actions-sync-separator');
			var menuitems = [];
			sep.nextSibling.hidden = false;
			sep.nextSibling.nextSibling.hidden = false;
			sep.nextSibling.nextSibling.nextSibling.hidden = false;
			sep.nextSibling.nextSibling.nextSibling.nextSibling.hidden = false;
		}
	}
	
	
	/*
	 * Called when the window closes
	 */
	function onUnload()
	{
		if (!Zotero || !Zotero.initialized) {
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
		var zoteroPane = document.getElementById('zotero-pane');
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
				alert(errMsg);
			}
			
			return;
		}
		
		zoteroSplitter.setAttribute('hidden', !makeVisible);
		
		// Restore fullscreen mode if necessary
		var fullScreenMode = document.getElementById('zotero-tb-fullscreen').getAttribute('fullscreenmode') == 'true';
		if (makeVisible && fullScreenMode) {
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
			Zotero.purgeDataObjects(true);
			var d2 = new Date();
			Zotero.debug("Purged data tables in " + (d2 - d) + " ms");
			
			if (Zotero.Prefs.get('sync.autoSync') && Zotero.Sync.Server.enabled) {
				setTimeout(function () {
					Zotero.Sync.Runner.sync();
				}, 1000);
			}
		}
		else {
			zoteroPane.setAttribute('collapsed', true);
			zoteroPane.height = 0;
			
			document.getElementById('content').setAttribute('collapsed', false);
			
			// Return focus to the browser content pane
			window.content.window.focus();
		}
	}
	
	
	function isShowing() {
		var zoteroPane = document.getElementById('zotero-pane');
		return zoteroPane.getAttribute('hidden') != 'true' &&
				zoteroPane.getAttribute('collapsed') != 'true';
	}
	
	
	function fullScreen(set)
	{
		var fs = document.getElementById('zotero-tb-fullscreen');
		
		if (set != undefined) {
			var makeFullScreen = set;
		}
		else {
			var makeFullScreen = fs.getAttribute('fullscreenmode') != 'true';
		}
		
		// Turn Z-pane flex on to stretch to window in full-screen, but off otherwise so persist works
		document.getElementById('zotero-pane').setAttribute('flex', makeFullScreen ? "1" : "0");
		document.getElementById('content').setAttribute('collapsed', makeFullScreen);
		document.getElementById('zotero-splitter').setAttribute('hidden', makeFullScreen);
		fs.setAttribute('fullscreenmode', makeFullScreen);
	}
	
	
	function isFullScreen() {
		var fs = document.getElementById('zotero-tb-fullscreen');
		return fs.getAttribute('fullscreenmode') == 'true'
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
		var zoteroPane = document.getElementById('zotero-pane');
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
	function newItem(typeID, data)
	{
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return false;
		}
		
		var item = new Zotero.Item(false, typeID);
		
		for (var i in data)
		{
			item.setField(i, data[i]);
		}
		
		item.save();
		
		if (this.itemsView && this.itemsView._itemGroup.isCollection()) {
			this.itemsView._itemGroup.ref.addItem(item.id);
		}
		
		//set to Info tab
		document.getElementById('zotero-view-item').selectedIndex = 0;
		
		this.selectItem(item.id);
		
		return item;
	}
	
	function newCollection(parent)
	{
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
		collection.name = newName.value;
		collection.parent = parent;
		collection.save();
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
		var zoteroPane = document.getElementById('zotero-pane');
		var splitter = document.getElementById('zotero-tags-splitter');
		var tagSelector = document.getElementById('zotero-tag-selector');
		
		var showing = tagSelector.getAttribute('collapsed') == 'true';
		tagSelector.setAttribute('collapsed', !showing);
		splitter.setAttribute('collapsed', !showing);
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
		var zoteroPane = document.getElementById('zotero-pane');
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
			height = height + 125;
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
		var itemgroup = self.collectionsView.
			_getItemAtRow(self.collectionsView.selection.currentIndex);
		var tagSelector = document.getElementById('zotero-tag-selector');
		if (!tagSelector.getAttribute('collapsed') ||
				tagSelector.getAttribute('collapsed') == 'false') {
			Zotero.debug('Updating tag selector with current tags');
			tagSelector.scope = itemgroup.getChildTags();
		}
	}
	
	
	function onCollectionSelected()
	{
		if (this.itemsView)
		{
			this.itemsView.unregister();
		}
		
		document.getElementById('zotero-tb-search').value = ""; 
		
		if (this.collectionsView.selection.count == 1 && this.collectionsView.selection.currentIndex != -1) {
			var itemgroup = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
			itemgroup.setSearch('');
			itemgroup.setTags(getTagSelection());
			
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
		}
		else
		{
			document.getElementById('zotero-items-tree').view = this.itemsView = null;
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
		
		var tabs = document.getElementById('zotero-view-tabs');
		
		if (this.itemsView && this.itemsView.selection.count == 1 && this.itemsView.selection.currentIndex != -1)
		{
			var item = this.itemsView._getItemAtRow(this.itemsView.selection.currentIndex);
			
			if(item.ref.isNote()) {
				tabs.hidden = true;
				
				var noteEditor = document.getElementById('zotero-note-editor');
				noteEditor.mode = this.itemsView.readOnly ? 'view' : 'edit';
				
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
				if (this.itemsView.readOnly) {
					viewButton.hidden = true;
				}
				else {
					viewButton.hidden = false;
					viewButton.setAttribute('noteID', item.ref.id);
					if (item.ref.getSource()) {
						viewButton.setAttribute('sourceID', item.ref.getSource());
					}
					else {
						viewButton.removeAttribute('sourceID');
					}
				}
				
				document.getElementById('zotero-item-pane-content').selectedIndex = 2;
			}
			
			else if(item.ref.isAttachment()) {
				tabs.hidden = true;
				
				var attachmentBox = document.getElementById('zotero-attachment-box');
				attachmentBox.mode = this.itemsView.readOnly ? 'view' : 'edit';
				attachmentBox.item = item.ref;
				
				document.getElementById('zotero-item-pane-content').selectedIndex = 3;
			}
			
			// Regular item
			else
			{
				document.getElementById('zotero-item-pane-content').selectedIndex = 1;
				if (this.itemsView.readOnly) {
					document.getElementById('zotero-view-item').selectedIndex = 0;
					ZoteroItemPane.viewItem(item.ref, 'view');
					tabs.hidden = true;
				}
				else {
					ZoteroItemPane.viewItem(item.ref);
					tabs.selectedIndex = document.getElementById('zotero-view-item').selectedIndex;
					tabs.hidden = false;
				}
			}
		}
		else
		{
			tabs.hidden = true;
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
		var item = this.getSelectedItems()[0];
		if (item.getTags()) {
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
											.getService(Components.interfaces.nsIPromptService);
			ps.alert(null, "Error", "Duplication of tagged items is not available in this Zotero release.");
			return;
		}
		
		var newItem = this.getSelectedItems()[0].clone();
		var newItemID = newItem.save()
		var newItem = Zotero.Items.get(newItemID);
		
		if (this.itemsView._itemGroup.isCollection()) {
			this.itemsView._itemGroup.ref.addItem(newItem.id);
			this.selectItem(newItemID);
		}
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
			if (!force){
				if (this.itemsView._itemGroup.isCollection()) {
					var noPrompt = true;
				}
				// Do nothing in search view
				else if (this.itemsView._itemGroup.isSearch() ||
						this.itemsView._itemGroup.isShare()) {
					return;
				}
				// Do nothing in trash view if any non-deleted items are selected
				else if (this.itemsView._itemGroup.isTrash()) {
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
	
	
	function editSelectedCollection()
	{
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
				var s = new Zotero.Search(row.ref.id);
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
			return;
		}
		
		if (this.itemsView) {
			if (!this.itemsView._itemGroup.isLibrary() && inLibrary) {
				this.collectionsView.selection.select(0);
			}
			
			var selected = this.itemsView.selectItem(itemID, expand);
			if (!selected) {
				this.collectionsView.selection.select(0);
				this.itemsView.selectItem(itemID, expand);
			}
		}
	}
	
	function getSelectedCollection(asID) {
		if (this.collectionsView.selection
				&& this.collectionsView.selection.count > 0
				&& this.collectionsView.selection.currentIndex != -1) {
			var collection = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
			if (collection && collection.isCollection()) {
				return asID ? collection.ref.id : collection.ref;
			}
		}
		// If the Zotero pane hasn't yet been opened, use the lastViewedFolder pref
		else {
			var lastViewedFolder = Zotero.Prefs.get('lastViewedFolder');
			var matches = lastViewedFolder.match(/^(?:(C|S)([0-9]+)|L)$/);
			if (matches && matches[1] == 'C') {
				var col = Zotero.Collections.get(matches[2]);
				if (col) {
					return asID ? col.id : col;
				}
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
		// If the Zotero pane hasn't yet been opened, use the lastViewedFolder pref
		else {
			var lastViewedFolder = Zotero.Prefs.get('lastViewedFolder');
			var matches = lastViewedFolder.match(/^(?:(C|S)([0-9]+)|L)$/);
			if (matches && matches[1] == 'S') {
				var search = Zotero.Search.get(matches[2]);
				if (search) {
					return asID ? search.id : search;
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
		if (!this.itemsView) {
			return [];
		}
		
		return this.itemsView.getSelectedItems(asIDs);
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
			loadReport: 10,
			emptyTrash: 11
		};
		
		// Collection
		if (this.collectionsView.selection.count == 1 &&
			this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex).isCollection())
		{
			var show = [m.newSubcollection, m.sep1, m.editSelectedCollection, m.removeCollection,
				m.sep2, m.exportCollection, m.createBibCollection, m.loadReport];
			if (this.itemsView.rowCount>0) {
				var enable = [m.exportCollection, m.createBibCollection, m.loadReport];
			}
			else if (!this.collectionsView.isContainerEmpty(this.collectionsView.selection.currentIndex)) {
				var enable = [m.exportCollection];
				var disable = [m.createBibCollection, m.loadReport];
			}
			else
			{
				var disable = [m.exportCollection, m.createBibCollection, m.loadReport];
			}
			
			// Adjust labels
			menu.childNodes[m.editSelectedCollection].setAttribute('label', Zotero.getString('pane.collections.menu.rename.collection'));
			menu.childNodes[m.removeCollection].setAttribute('label', Zotero.getString('pane.collections.menu.remove.collection'));
			menu.childNodes[m.exportCollection].setAttribute('label', Zotero.getString('pane.collections.menu.export.collection'));
			menu.childNodes[m.createBibCollection].setAttribute('label', Zotero.getString('pane.collections.menu.createBib.collection'));
			menu.childNodes[m.loadReport].setAttribute('label', Zotero.getString('pane.collections.menu.generateReport.collection'));
		}
		// Saved Search
		else if (this.collectionsView.selection.count == 1 &&
				this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex).isSearch()) {
			var show = [m.editSelectedCollection, m.removeCollection, m.sep2, m.exportCollection,
				m.createBibCollection, m.loadReport];
			
			if (this.itemsView.rowCount>0) {
				var enable = [m.exportCollection, m.createBibCollection, m.loadReport];
			}
			else
			{
				var disable = [m.exportCollection, m.createBibCollection, m.loadReport];
			}
			
			// Adjust labels
			menu.childNodes[m.editSelectedCollection].setAttribute('label', Zotero.getString('pane.collections.menu.edit.savedSearch'));
			menu.childNodes[m.removeCollection].setAttribute('label', Zotero.getString('pane.collections.menu.remove.savedSearch'));
			menu.childNodes[m.exportCollection].setAttribute('label', Zotero.getString('pane.collections.menu.export.savedSearch'));
			menu.childNodes[m.createBibCollection].setAttribute('label', Zotero.getString('pane.collections.menu.createBib.savedSearch'));
			menu.childNodes[m.loadReport].setAttribute('label', Zotero.getString('pane.collections.menu.generateReport.savedSearch'));
		}
		// Trash
		else if (this.collectionsView.selection.count == 1 &&
				this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex).isTrash()) {
			var show = [m.emptyTrash];
		}
		// Library
		else
		{
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
			attachSnapshot: 3,
			attachLink: 4,
			sep2: 5,
			duplicateItem: 6,
			deleteItem: 7,
			deleteFromLibrary: 8,
			sep3: 9,
			exportItems: 10,
			createBib: 11,
			loadReport: 12,
			sep4: 13,
			reindexItem: 14,
			recognizePDF: 15
		};
		
		var menu = document.getElementById('zotero-itemmenu');
		
		var enable = [], disable = [], show = [], hide = [], multiple = '';
		
		// TODO: implement menu for remote items
		if (this.itemsView.readOnly) {
			for each(var pos in m) {
				disable.push(pos);
			}
		}
		
		else if (this.itemsView && this.itemsView.selection.count > 0) {
			enable.push(m.showInLibrary, m.addNote, m.attachSnapshot, m.attachLink,
				m.sep2, m.duplicateItem, m.deleteItem, m.deleteFromLibrary,
				m.exportItems, m.createBib, m.loadReport);
			
			// Multiple items selected
			if (this.itemsView.selection.count > 1) {
				var multiple =  '.multiple';
				hide.push(m.showInLibrary, m.sep1, m.addNote, m.attachSnapshot,
					m.attachLink, m.sep2, m.duplicateItem);
				
				// If all items can be reindexed, or all items can be recognized, show option
				if (Zotero.Fulltext.pdfConverterIsRegistered()) {
					var items = this.getSelectedItems();
					var canIndex = true;
					var canRecognize = true;
					for (var i=0; i<items.length; i++) {
						if (!Zotero.Fulltext.canReindex(items[i].id)) {
							canIndex = false;
						}
						if(!Zotero_RecognizePDF.canRecognize(items[i])) {
							canRecognize = false;
						}
						if(!canIndex && !canRecognize) {
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
					}
					else {
						hide.push(m.recognizePDF);
					}
					if (canIndex || canRecognize) {
						show.push(m.sep4);
					}
					else {
						hide.push(m.sep4);
					}
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
					show.push(m.addNote, m.attachSnapshot, m.attachLink, m.sep2);
				}
				else
				{
					hide.push(m.addNote, m.attachSnapshot, m.attachLink, m.sep2);
				}
				
				if (item.isAttachment()) {
					var showSep4 = false;
					hide.push(m.duplicateItem);
					if (Zotero.Fulltext.pdfConverterIsRegistered()) {
						// If not linked URL, show reindex line
						if (Zotero.Fulltext.canReindex(item.id)) {
							show.push(m.reindexItem);
							showSep4 = true;
						}
						else {
							hide.push(m.reindexItem);
						}
					}
					
					if (Zotero_RecognizePDF.canRecognize(item)) {
						show.push(m.recognizePDF);
						showSep4 = true;
					}
					else {
						hide.push(m.recognizePDF);
					}
					
					if (showSep4) {
						show.push(m.sep4);
					}
					else {
						hide.push(m.sep4);
					}
				}
				else {
					show.push(m.duplicateItem);
					hide.push(m.sep4, m.reindexItem, m.recognizePDF);
				}
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
			hide.push(m.addNote, m.attachSnapshot, m.attachLink, m.sep2, m.sep4, m.reindexItem,
				m.recognizePDF);
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
		menu.childNodes[m.reindexItem].setAttribute('label', Zotero.getString('pane.items.menu.reindexItem' + multiple));
		menu.childNodes[m.recognizePDF].setAttribute('label', Zotero.getString('pane.items.menu.recognizePDF' + multiple));
		
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
		if (event && tree && event.type == "dblclick") {
			var row = {}, col = {}, obj = {};
			tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
			
			// obj.value == 'cell'/'text'/'image'
			if (!obj.value) {
				return;
			}
			
			if (tree.id == 'zotero-collections-tree') {
				var s = this.getSelectedSavedSearch();
				if (s) {
					this.editSelectedCollection();
				}
			}
			else if (tree.id == 'zotero-items-tree') {
				if (this.itemsView.readOnly) {
					return;
				}
				
				if (this.itemsView && this.itemsView.selection.currentIndex > -1) {
					var item = this.getSelectedItems()[0];
					if (item && item.isNote()) {
						document.getElementById('zotero-view-note-button').doCommand();
					}
					else if (item && item.isAttachment()) {
						this.viewSelectedAttachment(event);
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
	
	
	/*
	 * Loads a URL following the standard modifier key behavior
	 *  (e.g. meta-click == new background tab, meta-shift-click == new front tab,
	 *  shift-click == new window, no modifier == frontmost tab
	 */
	function loadURI(uri, event, data) {
		// Open in new tab
		if (event.metaKey || (!Zotero.isMac && event.ctrlKey)) {
			var tab = gBrowser.addTab(uri);
			var browser = gBrowser.getBrowserForTab(tab);
			
			if (event.shiftKey) {
				gBrowser.selectedTab = tab;
			}
		} else if (event.shiftKey) {
			window.open(uri, "zotero-loaded-page",
				"menubar=yes,location=yes,toolbar=yes,personalbar=yes,resizable=yes,scrollbars=yes,status=yes");
		} else {
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
	
	
	function newNote(popup, parent, text) {
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return;
		}
		
		if (!popup) {
			if (!text) {
				text = '';
			}
			text = Zotero.Utilities.prototype.trim(text);
			
			var item = new Zotero.Item(false, 'note');
			item.setNote(text);
			if (parent) {
				item.setSource(parent);
			}
			var itemID = item.save();
			
			if (this.itemsView && this.itemsView._itemGroup.isCollection()) {
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
	
	
	function addItemFromPage() {
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return false;
		}
		
		var progressWin = new Zotero.ProgressWindow();
		progressWin.changeHeadline(Zotero.getString('ingester.scraping'));
		var icon = 'chrome://zotero/skin/treeitem-webpage.png';
		progressWin.addLines(window.content.document.title, icon)
		progressWin.show();
		progressWin.startCloseTimer();
		
		var data = {
			title: window.content.document.title,
			url: window.content.document.location.href,
			accessDate: "CURRENT_TIMESTAMP"
		}
		
		var item = this.newItem(Zotero.ItemTypes.getID('webpage'), data);
		
		// Automatically save snapshot if pref set
		if (item.id && Zotero.Prefs.get('automaticSnapshots'))
		{
			var f = function() {
				// We set |noParent|, since child items don't belong to collections
				ZoteroPane.addAttachmentFromPage(false, item.id, true);
			}
			// Give progress window time to appear
			setTimeout(f, 300);
		}
		
		return item.id;
	}
	
	
	/*
	 * Create an attachment from the current page
	 *
	 * |link|      -- create web link instead of snapshot
	 * |itemID|    -- itemID of parent item
	 * |noParent|  -- don't add to current collection
	 */
	function addAttachmentFromPage(link, itemID, noParent)
	{
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return;
		}
		
		if (!noParent) {
			var progressWin = new Zotero.ProgressWindow();
			progressWin.changeHeadline(Zotero.getString('save.' + (link ? 'link' : 'attachment')));
			var type = link ? 'web-link' : 'snapshot';
			var icon = 'chrome://zotero/skin/treeitem-attachment-' + type + '.png';
			progressWin.addLines(window.content.document.title, icon)
			progressWin.show();
			progressWin.startCloseTimer();
			
			if (this.itemsView && this.itemsView._itemGroup.isCollection()) {
				var parentCollectionID = this.itemsView._itemGroup.ref.id;
			}
		}
		
		var f = function() {
			if (link) {
				Zotero.Attachments.linkFromDocument(window.content.document, itemID, parentCollectionID);
			}
			else {
				Zotero.Attachments.importFromDocument(window.content.document, itemID, false, parentCollectionID);
			}
		}
		// Give progress window time to appear
		setTimeout(f, 100);
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
	
	
	function relinkAttachment(itemID) {
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
		
		var msg = Zotero.Sync.Runner.lastSyncError;
		if (msg) {
			label.value = 'Last error: ' + msg; // TODO: localize
			return;
		}
		
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
			msg: Zotero.getString('errorReport.followingErrors'),
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
