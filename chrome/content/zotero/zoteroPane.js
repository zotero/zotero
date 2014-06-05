/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/
const ZOTERO_TAB_URL = "chrome://zotero/content/tab.xul";

/*
 * This object contains the various functions for the interface
 */
var ZoteroPane = new function()
{
	var _unserialized = false;
	this.collectionsView = false;
	this.itemsView = false;
	this.__defineGetter__('loaded', function () _loaded);
	
	//Privileged methods
	this.init = init;
	this.destroy = destroy;
	this.makeVisible = makeVisible;
	this.isShowing = isShowing;
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
	this.reindexItem = reindexItem;
	this.duplicateSelectedItem = duplicateSelectedItem;
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
	
	this.document = document;
	
	const COLLECTIONS_HEIGHT = 32; // minimum height of the collections pane and toolbar
	
	var self = this,
		_loaded = false, _madeVisible = false,
		titlebarcolorState, titleState, observerService,
		_reloadFunctions = [], _beforeReloadFunctions = [];
	
	/**
	 * Called when the window containing Zotero pane is open
	 */
	function init() {
		// Set "Report Errors..." label via property rather than DTD entity,
		// since we need to reference it in script elsewhere
		document.getElementById('zotero-tb-actions-reportErrors').setAttribute('label',
			Zotero.getString('errorReport.reportErrors'));
		// Set key down handler
		document.getElementById('appcontent').addEventListener('keydown', ZoteroPane_Local.handleKeyDown, true);
		
		if (Zotero.locked) {
			return;
		}
		_loaded = true;
		
		var zp = document.getElementById('zotero-pane');
		Zotero.setFontSize(zp);
		ZoteroPane_Local.updateToolbarPosition();
		window.addEventListener("resize", ZoteroPane_Local.updateToolbarPosition, false);
		window.setTimeout(ZoteroPane_Local.updateToolbarPosition, 0);
		
		Zotero.updateQuickSearchBox(document);
		
		if (Zotero.isMac) {
			//document.getElementById('zotero-tb-actions-zeroconf-update').setAttribute('hidden', false);
			document.getElementById('zotero-pane-stack').setAttribute('platform', 'mac');
		} else if(Zotero.isWin) {
			document.getElementById('zotero-pane-stack').setAttribute('platform', 'win');
		}
		
		// register an observer for Zotero reload
		observerService = Components.classes["@mozilla.org/observer-service;1"]
					  .getService(Components.interfaces.nsIObserverService);
		observerService.addObserver(_reloadObserver, "zotero-reloaded", false);
		observerService.addObserver(_reloadObserver, "zotero-before-reload", false);
		this.addBeforeReloadListener(function(newMode) {
			if(newMode == "connector") {
				ZoteroPane_Local.setItemsPaneMessage(Zotero.getString('connector.standaloneOpen'));
			}
			return;
		});
		this.addReloadListener(_loadPane);
		
		// continue loading pane
		_loadPane();
	}
	
	/**
	 * Called on window load or when has been reloaded after switching into or out of connector
	 * mode
	 */
	function _loadPane() {
		if(!Zotero || !Zotero.initialized || Zotero.isConnector) return;
		
		ZoteroPane_Local.clearItemsPaneMessage();
		
		//Initialize collections view
		ZoteroPane_Local.collectionsView = new Zotero.CollectionTreeView();
		var collectionsTree = document.getElementById('zotero-collections-tree');
		collectionsTree.view = ZoteroPane_Local.collectionsView;
		collectionsTree.controllers.appendController(new Zotero.CollectionTreeCommandController(collectionsTree));
		collectionsTree.addEventListener("mousedown", ZoteroPane_Local.onTreeMouseDown, true);
		collectionsTree.addEventListener("click", ZoteroPane_Local.onTreeClick, true);
		
		var itemsTree = document.getElementById('zotero-items-tree');
		itemsTree.controllers.appendController(new Zotero.ItemTreeCommandController(itemsTree));
		itemsTree.addEventListener("mousedown", ZoteroPane_Local.onTreeMouseDown, true);
		itemsTree.addEventListener("click", ZoteroPane_Local.onTreeClick, true);
		
		var menu = document.getElementById("contentAreaContextMenu");
		menu.addEventListener("popupshowing", ZoteroPane_Local.contextPopupShowing, false);
		
		Zotero.Keys.windowInit(document);
		
		if (Zotero.restoreFromServer) {
			Zotero.restoreFromServer = false;
			
			setTimeout(function () {
				var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
				var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
									+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
				var index = ps.confirmEx(
					null,
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
							
							ps.alert(
								null,
								"Restore Completed",
								"The local Zotero database has been successfully restored."
							);
						},
						
						onError: function (msg) {
							ps.alert(
								null,
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
		// If the database was initialized or there are no sync credentials and
		// Zotero hasn't been run before in this profile, display the start page
		// -- this way the page won't be displayed when they sync their DB to
		// another profile or if the DB is initialized erroneously (e.g. while
		// switching data directory locations)
		else if (Zotero.Prefs.get('firstRun2')) {
			if (Zotero.Schema.dbInitialized || !Zotero.Sync.Server.enabled) {
				setTimeout(function () {
					if(Zotero.isStandalone) {
						ZoteroPane_Local.loadURI("https://www.zotero.org/start_standalone");
					} else {
						gBrowser.selectedTab = gBrowser.addTab("https://www.zotero.org/start");
					}
				}, 400);
			}
			Zotero.Prefs.set('firstRun2', false);
			try {
				Zotero.Prefs.clear('firstRun');
			}
			catch (e) {}
		}
		
		// Hide sync debugging menu by default
		if (Zotero.Prefs.get('sync.debugMenu')) {
			var sep = document.getElementById('zotero-tb-actions-sync-separator');
			sep.hidden = false;
			sep.nextSibling.hidden = false;
			sep.nextSibling.nextSibling.hidden = false;
			sep.nextSibling.nextSibling.nextSibling.hidden = false;
		}
		
		if (Zotero.openPane) {
			Zotero.openPane = false;
			setTimeout(function () {
				ZoteroPane_Local.show();
			}, 0);
		}
	}
	
	
	/*
	 * Create the New Item (+) submenu with each item type
	 */
	this.buildItemTypeSubMenu = function () {
		var moreMenu = document.getElementById('zotero-tb-add-more');
		
		while (moreMenu.hasChildNodes()) {
			moreMenu.removeChild(moreMenu.firstChild);
		}
		
		// Sort by localized name
		var t = Zotero.ItemTypes.getSecondaryTypes();
		var itemTypes = [];
		for (var i=0; i<t.length; i++) {
			itemTypes.push({
				id: t[i].id,
				name: t[i].name,
				localized: Zotero.ItemTypes.getLocalizedString(t[i].id)
			});
		}
		var collation = Zotero.getLocaleCollation();
		itemTypes.sort(function(a, b) {
			return collation.compareString(1, a.localized, b.localized);
		});
		
		for (var i = 0; i<itemTypes.length; i++) {
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label", itemTypes[i].localized);
			menuitem.setAttribute("tooltiptext", "");
			let type = itemTypes[i].id;
			menuitem.addEventListener("command", function() { ZoteroPane_Local.newItem(type, {}, null, true); }, false);
			moreMenu.appendChild(menuitem);
		}
	}
	
	
	this.updateNewItemTypes = function () {
		var addMenu = document.getElementById('zotero-tb-add').firstChild;
		
		// Remove all nodes so we can regenerate
		var options = addMenu.getElementsByAttribute("class", "zotero-tb-add");
		while (options.length) {
			var p = options[0].parentNode;
			p.removeChild(options[0]);
		}
		
		var separator = addMenu.firstChild;
		
		// Sort by localized name
		var t = Zotero.ItemTypes.getPrimaryTypes();
		var itemTypes = [];
		for (var i=0; i<t.length; i++) {
			itemTypes.push({
				id: t[i].id,
				name: t[i].name,
				localized: Zotero.ItemTypes.getLocalizedString(t[i].id)
			});
		}
		var collation = Zotero.getLocaleCollation();
		itemTypes.sort(function(a, b) {
			return collation.compareString(1, a.localized, b.localized);
		});
		
		for (var i = 0; i<itemTypes.length; i++) {
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("label", itemTypes[i].localized);
			menuitem.setAttribute("tooltiptext", "");
			let type = itemTypes[i].id;
			menuitem.addEventListener("command", function() { ZoteroPane_Local.newItem(type, {}, null, true); }, false);
			menuitem.className = "zotero-tb-add";
			addMenu.insertBefore(menuitem, separator);
		}
	}
	
	
	
	/*
	 * Called when the window closes
	 */
	function destroy()
	{
		if (!Zotero || !Zotero.initialized || !_loaded) {
			return;
		}
		
		if(this.isShowing()) {
			this.serializePersist();
		}
		
		var tagSelector = document.getElementById('zotero-tag-selector');
		tagSelector.unregister();
		
		if(this.collectionsView) this.collectionsView.unregister();
		if(this.itemsView) this.itemsView.unregister();
		
		observerService.removeObserver(_reloadObserver, "zotero-reloaded");
	}
	
	/**
	 * Called before Zotero pane is to be made visible
	 * @return {Boolean} True if Zotero pane should be loaded, false otherwise (if an error
	 * 		occurred)
	 */
	function makeVisible()
	{
		// If pane not loaded, load it or display an error message
		if (!ZoteroPane_Local.loaded) {
			if (Zotero.locked) {
				var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
				var msg = Zotero.getString('general.operationInProgress') + '\n\n' + Zotero.getString('general.operationInProgress.waitUntilFinished');
				ps.alert(null, "", msg);
				return false;
			}
			ZoteroPane_Local.init();
		}
		
		// If Zotero could not be initialized, display an error message and return
		if(!Zotero || !Zotero.initialized) {
			this.displayStartupError();
			return false;
		}
		
		if(!_madeVisible) {
			this.buildItemTypeSubMenu();
		}
		_madeVisible = true;
		
		this.unserializePersist();
		this.updateToolbarPosition();
		this.updateTagSelectorSize();
		
		// restore saved row selection (for tab switching)
		var containerWindow = (window.ZoteroTab ? window.ZoteroTab.containerWindow : window);
		if(containerWindow.zoteroSavedCollectionSelection) {
			this.collectionsView.rememberSelection(containerWindow.zoteroSavedCollectionSelection);
			delete containerWindow.zoteroSavedCollectionSelection;
		}
		
		// restore saved item selection (for tab switching)
		if(containerWindow.zoteroSavedItemSelection) {
			var me = this;
			// hack to restore saved selection after itemTreeView finishes loading
			window.setTimeout(function() {
				if(containerWindow.zoteroSavedItemSelection) {
					me.itemsView.rememberSelection(containerWindow.zoteroSavedItemSelection);
					delete containerWindow.zoteroSavedItemSelection;
				}
			}, 51);
		}
		
		// Focus the quicksearch on pane open
		var searchBar = document.getElementById('zotero-tb-search');
		setTimeout(function () {
			searchBar.inputField.select();
		}, 1);
		
		var d = new Date();
		Zotero.purgeDataObjects();
		var d2 = new Date();
		Zotero.debug("Purged data tables in " + (d2 - d) + " ms");
		
		// Auto-sync on pane open
		if (Zotero.Prefs.get('sync.autoSync')) {
			Zotero.proxyAuthComplete
			.delay(1000)
			.then(function () {
				if (!Zotero.Sync.Server.enabled) {
					Zotero.debug('Sync not enabled -- skipping auto-sync', 4);
					return;
				}
				
				if (Zotero.Sync.Server.syncInProgress || Zotero.Sync.Storage.syncInProgress) {
					Zotero.debug('Sync already running -- skipping auto-sync', 4);
					return;
				}
				
				if (Zotero.Sync.Server.manualSyncRequired) {
					Zotero.debug('Manual sync required -- skipping auto-sync', 4);
					return;
				}
				
				Zotero.Sync.Runner.sync({
					background: true
				});
			})
			.done();
		}
		
		// Set sync icon to spinning or not
		//
		// We don't bother setting an error state at open
		if (Zotero.Sync.Server.syncInProgress || Zotero.Sync.Storage.syncInProgress) {
			Zotero.Sync.Runner.setSyncIcon('animate');
		}
		
		return true;
	}
	
	/**
	 * Function to be called before ZoteroPane_Local is hidden. Does not actually hide the Zotero pane.
	 */
	this.makeHidden = function() {
		this.serializePersist();
	}
	
	function isShowing() {
		var zoteroPane = document.getElementById('zotero-pane-stack');
		return zoteroPane.getAttribute('hidden') != 'true' &&
				zoteroPane.getAttribute('collapsed') != 'true';
	}
	
	function isFullScreen() {
		return document.getElementById('zotero-pane-stack').getAttribute('fullscreenmode') == 'true';
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
					notify: ZoteroPane_Local.setHighlightedRowsCallback
				}, 225, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
			}
			// Unhighlight on key up
			else if ((Zotero.isWin && event.ctrlKey) ||
					(!Zotero.isWin && event.altKey)) {
				if (this.highlightTimer) {
					this.highlightTimer.cancel();
					this.highlightTimer = null;
				}
				ZoteroPane_Local.collectionsView.setHighlightedRows();
			}
		}
	}
	
	
	function handleKeyUp(event, from) {
		if (from == 'zotero-pane') {
			if ((Zotero.isWin && event.keyCode == 17) ||
					(!Zotero.isWin && event.keyCode == 18)) {
				if (this.highlightTimer) {
					this.highlightTimer.cancel();
					this.highlightTimer = null;
				}
				ZoteroPane_Local.collectionsView.setHighlightedRows();
			}
		}
	}
	
	
	/*
	 * Highlights collections containing selected items on Ctrl (Win) or
	 * Option/Alt (Mac/Linux) press
	 */
	function setHighlightedRowsCallback() {
		var itemIDs = ZoteroPane_Local.getSelectedItems(true);
		if (itemIDs && itemIDs.length) {
			var collectionIDs = Zotero.Collections.getCollectionsContainingItems(itemIDs, true);
			if (collectionIDs) {
				ZoteroPane_Local.collectionsView.setHighlightedRows(collectionIDs);
			}
		}
	}
	
	
	function handleKeyPress(event) {
		var from = event.originalTarget.id;
		
		// Ignore keystrokes if Zotero pane is closed
		var zoteroPane = document.getElementById('zotero-pane-stack');
		if (zoteroPane.getAttribute('hidden') == 'true' ||
				zoteroPane.getAttribute('collapsed') == 'true') {
			return;
		}
		
		if (Zotero.locked) {
			event.preventDefault();
			return;
		}
		
		if (from == 'zotero-collections-tree') {
			if ((event.keyCode == event.DOM_VK_BACK_SPACE && Zotero.isMac) ||
					event.keyCode == event.DOM_VK_DELETE) {
				var deleteItems = event.metaKey || (!Zotero.isMac && event.shiftKey);
				ZoteroPane_Local.deleteSelectedCollection(deleteItems);
				event.preventDefault();
				return;
			}
		}
		else if (from == 'zotero-items-tree') {
			// Focus TinyMCE explicitly on tab key, since the normal focusing
			// doesn't work right
			if (!event.shiftKey && event.keyCode == event.DOM_VK_TAB) {
				var deck = document.getElementById('zotero-item-pane-content');
				if (deck.selectedPanel.id == 'zotero-view-note') {
					setTimeout(function () {
						document.getElementById('zotero-note-editor').focus();
					}, 0);
				}
			}
			else if ((event.keyCode == event.DOM_VK_BACK_SPACE && Zotero.isMac) ||
					event.keyCode == event.DOM_VK_DELETE) {
				// If Cmd/Ctrl delete, use forced mode, which does different
				// things depending on the context
				var force = event.metaKey || (!Zotero.isMac && event.shiftKey);
				ZoteroPane_Local.deleteSelectedItems(force);
				event.preventDefault();
				return;
			}
			else if (event.keyCode == event.DOM_VK_RETURN) {
				var items = this.itemsView.getSelectedItems();
				// Don't do anything if more than 20 items selected
				if (!items.length || items.length > 20) {
					return;
				}
				ZoteroPane_Local.viewItems(items, event);
				// These don't seem to do anything. Instead we override
				// the tree binding's _handleEnter method in itemTreeView.js.
				//event.preventDefault();
				//event.stopPropagation();
				return;
			}
		}
		
		var key = String.fromCharCode(event.which);
		if (!key) {
			Zotero.debug('No key');
			return;
		}
		
		// Ignore modifiers other than Ctrl-Shift/Cmd-Shift
		if (!((Zotero.isMac ? event.metaKey : event.ctrlKey) && event.shiftKey)) {
			return;
		}
		
		var command = Zotero.Keys.getCommand(key);
		if (!command) {
			return;
		}
		
		Zotero.debug(command);
		
		// Errors don't seem to make it out otherwise
		try {
			switch (command) {
				case 'openZotero':
					try {
						// Ignore Cmd-Shift-Z keystroke in text areas
						if (Zotero.isMac && key == 'Z' &&
								(event.originalTarget.localName == 'input'
									|| event.originalTarget.localName == 'textarea')) {
							try {
								var isSearchBar = event.originalTarget.parentNode.parentNode.id == 'zotero-tb-search';
							}
							catch (e) {
								Zotero.debug(e, 1);
								Components.utils.reportError(e);
							}
							if (!isSearchBar) {
								Zotero.debug('Ignoring keystroke in text field');
								return;
							}
						}
					}
					catch (e) {
						Zotero.debug(e);
					}
					if (window.ZoteroOverlay) window.ZoteroOverlay.toggleDisplay()
					break;
				case 'library':
					document.getElementById('zotero-collections-tree').focus();
					break;
				case 'quicksearch':
					document.getElementById('zotero-tb-search').select();
					break;
				case 'newItem':
					// Default to most recent item type from here or the
					// New Type menu
					var mru = Zotero.Prefs.get('newItemTypeMRU');
					// Or fall back to 'book'
					var typeID = mru ? mru.split(',')[0] : 2;
					ZoteroPane_Local.newItem(typeID);
					let itemBox = document.getElementById('zotero-editpane-item-box');
					var menu = itemBox.itemTypeMenu;
					var self = this;
					var handleTypeChange = function () {
						self.addItemTypeToNewItemTypeMRU(this.itemTypeMenu.value);
						itemBox.removeHandler('itemtypechange', handleTypeChange);
					};
					// Only update the MRU when the menu is opened for the
					// keyboard shortcut, not on subsequent opens
					var removeTypeChangeHandler = function () {
						itemBox.removeHandler('itemtypechange', handleTypeChange);
						itemBox.itemTypeMenu.firstChild.removeEventListener('popuphiding', removeTypeChangeHandler);
						// Focus the title field after menu closes
						itemBox.focusFirstField();
					};
					itemBox.addHandler('itemtypechange', handleTypeChange);
					itemBox.itemTypeMenu.firstChild.addEventListener('popuphiding', removeTypeChangeHandler);
					
					menu.focus();
					document.getElementById('zotero-editpane-item-box').itemTypeMenu.menupopup.openPopup(menu, "before_start", 0, 0);
					break;
				case 'newNote':
					// If a regular item is selected, use that as the parent.
					// If a child item is selected, use its parent as the parent.
					// Otherwise create a standalone note.
					var parent = false;
					var items = ZoteroPane_Local.getSelectedItems();
					if (items.length == 1) {
						if (items[0].isRegularItem()) {
							parent = items[0].id;
						}
						else {
							parent = items[0].getSource();
						}
					}
					// Use key that's not the modifier as the popup toggle
					ZoteroPane_Local.newNote(event.altKey, parent);
					break;
				case 'toggleTagSelector':
					ZoteroPane_Local.toggleTagSelector();
					break;
				case 'toggleFullscreen':
					ZoteroPane_Local.toggleTab();
					break;
				case 'copySelectedItemCitationsToClipboard':
					ZoteroPane_Local.copySelectedItemsToClipboard(true)
					break;
				case 'copySelectedItemsToClipboard':
					ZoteroPane_Local.copySelectedItemsToClipboard();
					break;
				case 'importFromClipboard':
					Zotero_File_Interface.importFromClipboard();
					break;
				default:
					throw ('Command "' + command + '" not found in ZoteroPane_Local.handleKeyDown()');
			}
		}
		catch (e) {
			Zotero.debug(e, 1);
			Components.utils.reportError(e);
		}
		
		event.preventDefault();
	}
	
	
	/*
	 * Create a new item
	 *
	 * _data_ is an optional object with field:value for itemData
	 */
	function newItem(typeID, data, row, manual)
	{
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return false;
		}
		
		if ((row === undefined || row === null) && this.collectionsView.selection) {
			row = this.collectionsView.selection.currentIndex;
			
			// Make sure currently selected view is editable
			if (!this.canEdit(row)) {
				this.displayCannotEditLibraryMessage();
				return;
			}
		}
		
		if (row !== undefined && row !== null) {
			var itemGroup = this.collectionsView._getItemAtRow(row);
			var libraryID = itemGroup.ref.libraryID;
		}
		else {
			var libraryID = null;
			var itemGroup = null;
		}
		
		Zotero.DB.beginTransaction();
		
		var item = new Zotero.Item(typeID);
		item.libraryID = libraryID;
		for (var i in data) {
			item.setField(i, data[i]);
		}
		var itemID = item.save();
		
		if (itemGroup && itemGroup.isCollection()) {
			itemGroup.ref.addItem(itemID);
		}
		
		Zotero.DB.commitTransaction();
		
		//set to Info tab
		document.getElementById('zotero-view-item').selectedIndex = 0;
		
		if (manual) {
			// Focus the title field
			if (this.selectItem(itemID)) {
				setTimeout(function () {
					document.getElementById('zotero-editpane-item-box').focusFirstField();
				}, 0);
			}
			
			// Update most-recently-used list for New Item menu
			this.addItemTypeToNewItemTypeMRU(typeID);
		}
		
		return Zotero.Items.get(itemID);
	}
	
	
	this.addItemTypeToNewItemTypeMRU = function (itemTypeID) {
		var mru = Zotero.Prefs.get('newItemTypeMRU');
		if (mru) {
			var mru = mru.split(',');
			var pos = mru.indexOf(itemTypeID + '');
			if (pos != -1) {
				mru.splice(pos, 1);
			}
			mru.unshift(itemTypeID);
		}
		else {
			var mru = [itemTypeID + ''];
		}
		Zotero.Prefs.set('newItemTypeMRU', mru.slice(0, 5).join(','));
	}
	
	
	function newCollection(parent)
	{
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return false;
		}
		
		if (!this.canEditLibrary()) {
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
		this.loadURI(Zotero.Groups.addGroupURL);
	}
	
	
	function newSearch()
	{
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage(true);
			return false;
		}
		
		var s = new Zotero.Search();
		s.libraryID = this.getSelectedLibraryID();
		s.addCondition('title', 'contains', '');
		
		var untitled = Zotero.getString('pane.collections.untitled');
		untitled = Zotero.DB.getNextName('savedSearches', 'savedSearchName',
			Zotero.getString('pane.collections.untitled'));
		var io = {dataIn: {search: s, name: untitled}, dataOut: null};
		window.openDialog('chrome://zotero/content/searchDialog.xul','','chrome,modal',io);
	}
	
	
	this.setVirtual = function (libraryID, mode, show) {
		switch (mode) {
			case 'duplicates':
				var prefKey = 'duplicateLibraries';
				var lastViewedFolderID = 'D' + (libraryID ? libraryID : 0);
				break;
			
			case 'unfiled':
				var prefKey = 'unfiledLibraries';
				var lastViewedFolderID = 'U' + (libraryID ? libraryID : 0);
				break;
			
			default:
				throw ("Invalid virtual mode '" + mode + "' in ZoteroPane.setVirtual()");
		}
		
		try {
			var ids = Zotero.Prefs.get(prefKey).split(',');
		}
		catch (e) {
			var ids = [];
		}
		
		if (!libraryID) {
			libraryID = 0;
		}
		
		var newids = [];
		for each(var id in ids) {
			id = parseInt(id);
			if (isNaN(id)) {
				continue;
			}
			// Remove current library if hiding
			if (id == libraryID && !show) {
				continue;
			}
			// Remove libraryIDs that no longer exist
			if (id != 0 && !Zotero.Libraries.exists(id)) {
				continue;
			}
			newids.push(id);
		}
		
		// Add the current library if it's not already set
		if (show && newids.indexOf(libraryID) == -1) {
			newids.push(libraryID);
		}
		
		newids.sort();
		
		Zotero.Prefs.set(prefKey, newids.join());
		
		this.collectionsView.refresh();
		
		// If group is closed, open it
		this.collectionsView.selectLibrary(libraryID);
		row = this.collectionsView.selection.currentIndex;
		if (!this.collectionsView.isContainerOpen(row)) {
			this.collectionsView.toggleOpenState(row);
		}
		
		// Select new row
		if (show) {
			Zotero.Prefs.set('lastViewedFolder', lastViewedFolderID);
			var row = this.collectionsView.getLastViewedRow();
			this.collectionsView.selection.select(row);
		}
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
		s.libraryID = this.getSelectedLibraryID();
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
		
		
		/*Zotero.debug("tagSelector.boxObject.height: " + tagSelector.boxObject.height);
		Zotero.debug("tagSelector.getAttribute('height'): " + tagSelector.getAttribute('height'));
		Zotero.debug("zoteroPane.boxObject.height: " + zoteroPane.boxObject.height);
		Zotero.debug("zoteroPane.getAttribute('height'): " + zoteroPane.getAttribute('height'));*/
		
		
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
		if (!Zotero.Utilities.isEmpty(this.getTagSelection())) {
			var tagSelector = document.getElementById('zotero-tag-selector');
			tagSelector.clearAll();
		}
	}
	
	
	/*
	 * Sets the tag filter on the items view
	 */
	function updateTagFilter(){
		if (this.itemsView) {
			this.itemsView.setFilter('tags', getTagSelection());
		}
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
			document.getElementById('zotero-items-tree').view = this.itemsView = null;
		}
		
		// Clear quick search and tag selector when switching views
		document.getElementById('zotero-tb-search').value = "";
		document.getElementById('zotero-tag-selector').clearAll();
		
		if (this.collectionsView.selection.count != 1) {
			document.getElementById('zotero-items-tree').view = this.itemsView = null;
			return;
		}
		
		// this.collectionsView.selection.currentIndex != -1
		
		var itemgroup = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
		
		// Not necessary with seltype="cell", which calls nsITreeView::isSelectable()
		/*if (itemgroup.isSeparator()) {
			document.getElementById('zotero-items-tree').view = this.itemsView = null;
			return;
		}*/
		
		itemgroup.setSearch('');
		itemgroup.setTags(getTagSelection());
		
		// Enable or disable toolbar icons and menu options as necessary
		const disableIfNoEdit = [
			"cmd_zotero_newCollection",
			"cmd_zotero_newSavedSearch",
			"zotero-tb-add",
			"cmd_zotero_newItemFromCurrentPage",
			"zotero-tb-lookup",
			"cmd_zotero_newStandaloneNote",
			"zotero-tb-note-add",
			"zotero-tb-attachment-add"
		];
		for(var i=0; i<disableIfNoEdit.length; i++) {
			var el = document.getElementById(disableIfNoEdit[i]);
			
			// If a trash is selected, new collection depends on the
			// editability of the library
			if (itemgroup.isTrash() &&
					disableIfNoEdit[i] == 'cmd_zotero_newCollection') {
				if (itemgroup.ref.libraryID) {
					var overrideEditable =
						Zotero.Libraries.isEditable(itemgroup.ref.libraryID);
				}
				else {
					var overrideEditable = true;
				}
			}
			else {
				var overrideEditable = false;
			}
			
			if (itemgroup.editable || overrideEditable) {
				if(el.hasAttribute("disabled")) el.removeAttribute("disabled");
			} else {
				el.setAttribute("disabled", "true");
			}
		}
		
		try {
			Zotero.UnresponsiveScriptIndicator.disable();
			this.itemsView = new Zotero.ItemTreeView(itemgroup);
			this.itemsView.addCallback(_setTagScope);
			document.getElementById('zotero-items-tree').view = this.itemsView;
			this.itemsView.selection.clearSelection();
			
			// Add events to treecolpicker to update menu before showing/hiding
			try {
				let treecols = document.getElementById('zotero-items-columns-header');
				let treecolpicker = treecols.boxObject.firstChild.nextSibling;
				let menupopup = treecolpicker.boxObject.firstChild.nextSibling;
				let attr = menupopup.getAttribute('onpopupshowing');
				if (attr.indexOf('Zotero') == -1) {
					menupopup.setAttribute('onpopupshowing', 'ZoteroPane.itemsView.onColumnPickerShowing(event);')
						// Keep whatever else is there
						+ ' ' + attr;
					menupopup.setAttribute('onpopuphidden', 'ZoteroPane.itemsView.onColumnPickerHidden(event);')
						// Keep whatever else is there
						+ ' ' + menupopup.getAttribute('onpopuphidden');
				}
			}
			catch (e) {
				Zotero.debug(e);
			}
		}
		finally {
			Zotero.UnresponsiveScriptIndicator.enable();
		}
		
		Zotero.Prefs.set('lastViewedFolder', itemgroup.id);
	}
	
	
	this.getItemGroup = function () {
		if (!this.collectionsView.selection) {
			return false;
		}
		return this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
	}
	
	
	this.itemSelected = function (event) {
		if (!Zotero.stateCheck()) {
			this.displayErrorMessage();
			return;
		}
		
		// DEBUG: Is this actually possible?
		if (!this.itemsView) {
			Components.utils.reportError("this.itemsView is not defined in ZoteroPane.itemSelected()");
		}
		
		// Display restore button if items selected in Trash
		if (this.itemsView.selection.count) {
			document.getElementById('zotero-item-restore-button').hidden
				= !this.itemsView._itemGroup.isTrash()
					|| _nonDeletedItemsSelected(this.itemsView);
		}
		else {
			document.getElementById('zotero-item-restore-button').hidden = true;
		}
		
		var tabs = document.getElementById('zotero-view-tabbox');
		
		// save note when switching from a note
		if(document.getElementById('zotero-item-pane-content').selectedIndex == 2) {
			document.getElementById('zotero-note-editor').save();
		}
		
		var itemGroup = this.getItemGroup();
		
		// Single item selected
		if (this.itemsView.selection.count == 1 && this.itemsView.selection.currentIndex != -1)
		{
			var item = this.itemsView.getSelectedItems()[0];
			
			if (item.isNote()) {
				var noteEditor = document.getElementById('zotero-note-editor');
				noteEditor.mode = this.collectionsView.editable ? 'edit' : 'view';
				
				var clearUndo = noteEditor.item ? noteEditor.item.id != item.id : false;
				
				noteEditor.parent = null;
				noteEditor.item = item;
				
				// If loading new or different note, disable undo while we repopulate the text field
				// so Undo doesn't end up clearing the field. This also ensures that Undo doesn't
				// undo content from another note into the current one.
				if (clearUndo) {
					noteEditor.clearUndo();
				}
				
				var viewButton = document.getElementById('zotero-view-note-button');
				if (this.collectionsView.editable) {
					viewButton.hidden = false;
					viewButton.setAttribute('noteID', item.id);
					if (item.getSource()) {
						viewButton.setAttribute('sourceID', item.getSource());
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
			
			else if (item.isAttachment()) {
				var attachmentBox = document.getElementById('zotero-attachment-box');
				attachmentBox.mode = this.collectionsView.editable ? 'edit' : 'view';
				attachmentBox.item = item;
				
				document.getElementById('zotero-item-pane-content').selectedIndex = 3;
			}
			
			// Regular item
			else {
				var isCommons = itemGroup.isBucket();
				
				document.getElementById('zotero-item-pane-content').selectedIndex = 1;
				var tabBox = document.getElementById('zotero-view-tabbox');
				var pane = tabBox.selectedIndex;
				tabBox.firstChild.hidden = isCommons;
				
				var button = document.getElementById('zotero-item-show-original');
				if (isCommons) {
					button.hidden = false;
					button.disabled = !this.getOriginalItem();
				}
				else {
					button.hidden = true;
				}
				
				if (this.collectionsView.editable) {
					ZoteroItemPane.viewItem(item, null, pane);
					tabs.selectedIndex = document.getElementById('zotero-view-item').selectedIndex;
				}
				else {
					ZoteroItemPane.viewItem(item, 'view', pane);
					tabs.selectedIndex = document.getElementById('zotero-view-item').selectedIndex;
				}
			}
		}
		// Zero or multiple items selected
		else {
			var count = this.itemsView.selection.count;
			
			// Display duplicates merge interface in item pane
			if (itemGroup.isDuplicates()) {
				if (!itemGroup.editable) {
					if (count) {
						var msg = Zotero.getString('pane.item.duplicates.writeAccessRequired');
					}
					else {
						var msg = Zotero.getString('pane.item.selected.zero');
					}
					this.setItemPaneMessage(msg);
				}
				else if (count) {
					document.getElementById('zotero-item-pane-content').selectedIndex = 4;
					
					// Load duplicates UI code
					if (typeof Zotero_Duplicates_Pane == 'undefined') {
						Zotero.debug("Loading duplicatesMerge.js");
						Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
							.getService(Components.interfaces.mozIJSSubScriptLoader)
							.loadSubScript("chrome://zotero/content/duplicatesMerge.js");
					}
					
					// On a Select All of more than a few items, display a row
					// count instead of the usual item type mismatch error
					var displayNumItemsOnTypeError = count > 5 && count == this.itemsView.rowCount;
					
					// Initialize the merge pane with the selected items
					Zotero_Duplicates_Pane.setItems(this.getSelectedItems(), displayNumItemsOnTypeError);
				}
				else {
					var msg = Zotero.getString('pane.item.duplicates.selectToMerge');
					this.setItemPaneMessage(msg);
				}
			}
			// Display label in the middle of the item pane
			else {
				if (count) {
					var msg = Zotero.getString('pane.item.selected.multiple', count);
				}
				else {
					var rowCount = this.itemsView.rowCount;
					var str = 'pane.item.unselected.';
					switch (rowCount){
						case 0:
							str += 'zero';
							break;
						case 1:
							str += 'singular';
							break;
						default:
							str += 'plural';
							break;
					}
					var msg = Zotero.getString(str, [rowCount]);
				}
				
				this.setItemPaneMessage(msg);
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
		var items = ZoteroPane_Local.getSelectedItems();
		var button = document.getElementById('zotero-tb-add-child-note');
		button.disabled = !this.canEdit() ||
			!(items.length == 1 && (items[0].isRegularItem() || !items[0].isTopLevelItem()));
	}
	
	
	this.updateAttachmentButtonMenu = function (popup) {
		var items = ZoteroPane_Local.getSelectedItems();
		
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
			var className = node.className.replace('standalone-no-display', '').trim();
			
			switch (className) {
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
					throw ("Invalid class name '" + className + "' in ZoteroPane_Local.updateAttachmentButtonMenu()");
			}
		}
	}
	
	
	this.checkPDFConverter = function () {
		if (Zotero.Fulltext.pdfConverterIsRegistered()) {
			return true;
		}
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
			+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
		var index = ps.confirmEx(
			null,
			Zotero.getString('pane.item.attachments.PDF.installTools.title'),
			Zotero.getString('pane.item.attachments.PDF.installTools.text'),
			buttonFlags,
			Zotero.getString('general.openPreferences'),
			null, null, null, {}
		);
		if (index == 0) {
			ZoteroPane_Local.openPreferences('zotero-prefpane-search', 'pdftools-install');
		}
		return false;
	}
	
	
	function reindexItem() {
		var items = this.getSelectedItems();
		if (!items) {
			return;
		}
		
		var itemIDs = [];
		var checkPDF = false;
		for (var i=0; i<items.length; i++) {
			// If any PDFs, we need to make sure the converter is installed and
			// prompt for installation if not
			if (!checkPDF && items[i].attachmentMIMEType && items[i].attachmentMIMEType == "application/pdf") {
				checkPDF = true;
			}
			itemIDs.push(items[i].id);
		}
		
		if (checkPDF) {
			var installed = this.checkPDFConverter();
			if (!installed) {
				document.getElementById('zotero-attachment-box').updateItemIndexedState();
				return;
			}
		}
		
		Zotero.Fulltext.indexItems(itemIDs, true);
		document.getElementById('zotero-attachment-box').updateItemIndexedState();
	}
	
	
	function duplicateSelectedItem() {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var item = this.getSelectedItems()[0];
		
		Zotero.DB.beginTransaction();
		
		// Create new unsaved clone item in target library
		var newItem = new Zotero.Item(item.itemTypeID);
		newItem.libraryID = item.libraryID;
		// DEBUG: save here because clone() doesn't currently work on unsaved tagged items
		var id = newItem.save();
		
		var newItem = Zotero.Items.get(id);
		item.clone(false, newItem, false, !Zotero.Prefs.get('groups.copyTags'));
		newItem.save();
		
		if (this.itemsView._itemGroup.isCollection() && !newItem.getSource()) {
			this.itemsView._itemGroup.ref.addItem(newItem.id);
		}
		
		Zotero.DB.commitTransaction();
		
		this.selectItem(newItem.id);
	}
	
	
	this.deleteSelectedItem = function () {
		Zotero.debug("ZoteroPane_Local.deleteSelectedItem() is deprecated -- use ZoteroPane_Local.deleteSelectedItems()");
		this.deleteSelectedItems();
	}
	
	/*
	 * Remove, trash, or delete item(s), depending on context
	 *
	 * @param  {Boolean}  [force=false]     Trash or delete even if in a collection or search,
	 *                                      or trash without prompt in library
	 * @param  {Boolean}  [fromMenu=false]  If triggered from context menu, which always prompts for deletes
	 */
	this.deleteSelectedItems = function (force, fromMenu) {
		if (!this.itemsView || !this.itemsView.selection.count) {
			return;
		}
		var itemGroup = this.itemsView._itemGroup;
		
		if (!itemGroup.isTrash() && !itemGroup.isBucket() && !this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var toTrash = {
			title: Zotero.getString('pane.items.trash.title'),
			text: Zotero.getString(
				'pane.items.trash' + (this.itemsView.selection.count > 1 ? '.multiple' : '')
			)
		};
		var toDelete = {
			title: Zotero.getString('pane.items.delete.title'),
			text: Zotero.getString(
				'pane.items.delete' + (this.itemsView.selection.count > 1 ? '.multiple' : '')
			)
		};
		
		if (itemGroup.isLibrary(true)) {
			// In library, don't prompt if meta key was pressed
			var prompt = (force && !fromMenu) ? false : toTrash;
		}
		else if (itemGroup.isCollection()) {
			// In collection, only prompt if trashing
			var prompt = force ? toTrash : false;
		}
		else if (itemGroup.isSearch() || itemGroup.isUnfiled() || itemGroup.isDuplicates()) {
			if (!force) {
				return;
			}
			var prompt = toTrash;
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
			var prompt = toDelete;
		}
		else if (itemGroup.isBucket()) {
			var prompt = toDelete;
		}
		// Do nothing in share views
		else if (itemGroup.isShare()) {
			return;
		}
		
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
										.getService(Components.interfaces.nsIPromptService);
		if (!prompt || promptService.confirm(window, prompt.title, prompt.text)) {
			this.itemsView.deleteSelection(force);
		}
	}
	
	
	this.mergeSelectedItems = function () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		document.getElementById('zotero-item-pane-content').selectedIndex = 4;
		
		if (typeof Zotero_Duplicates_Pane == 'undefined') {
			Zotero.debug("Loading duplicatesMerge.js");
			Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
				.getService(Components.interfaces.mozIJSSubScriptLoader)
				.loadSubScript("chrome://zotero/content/duplicatesMerge.js");
		}
		
		// Initialize the merge pane with the selected items
		Zotero_Duplicates_Pane.setItems(this.getSelectedItems());
	}
	
	
	this.deleteSelectedCollection = function (deleteItems) {
		var itemGroup = this.getItemGroup();
		
		// Remove virtual duplicates collection
		if (itemGroup.isDuplicates()) {
			this.setVirtual(itemGroup.ref.libraryID, 'duplicates', false);
			return;
		}
		// Remove virtual unfiled collection
		else if (itemGroup.isUnfiled()) {
			this.setVirtual(itemGroup.ref.libraryID, 'unfiled', false);
			return;
		}
		
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
		if (this.collectionsView.selection.count == 1) {
			if (itemGroup.isCollection())
			{
				if (deleteItems) {
					var index = ps.confirmEx(
						null,
						Zotero.getString('pane.collections.deleteWithItems.title'),
						Zotero.getString('pane.collections.deleteWithItems'),
						buttonFlags,
						Zotero.getString('pane.collections.deleteWithItems.title'),
						"", "", "", {}
					);
				}
				else {
					var index = ps.confirmEx(
						null,
						Zotero.getString('pane.collections.delete.title'),
						Zotero.getString('pane.collections.delete')
							+ "\n\n"
							+ Zotero.getString('pane.collections.delete.keepItems'),
						buttonFlags,
						Zotero.getString('pane.collections.delete.title'),
						"", "", "", {}
					);
				}
				if (index == 0) {
					this.collectionsView.deleteSelection(deleteItems);
				}
			}
			else if (itemGroup.isSearch())
			{
				
				var index = ps.confirmEx(
					null,
					Zotero.getString('pane.collections.deleteSearch.title'),
					Zotero.getString('pane.collections.deleteSearch'),
					buttonFlags,
					Zotero.getString('pane.collections.deleteSearch.title'),
					"", "", "", {}
				);
				if (index == 0) {
					this.collectionsView.deleteSelection();
				}
			}
		}
	}
	
	
	// Currently used only for Commons to find original linked item
	this.getOriginalItem = function () {
		var item = this.getSelectedItems()[0];
		var itemGroup = this.getItemGroup();
		// TEMP: Commons buckets only
		return itemGroup.ref.getLocalItem(item);
	}
	
	
	this.showOriginalItem = function () {
		var item = this.getOriginalItem();
		if (!item) {
			Zotero.debug("Original item not found");
			return;
		}
		this.selectItem(item.id);
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
		var libraryID = this.getSelectedLibraryID();
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		var result = ps.confirm(
			null,
			"",
			Zotero.getString('pane.collections.emptyTrash') + "\n\n"
				+ Zotero.getString('general.actionCannotBeUndone')
		);
		if (result) {
			Zotero.Items.emptyTrash(libraryID);
			Zotero.purgeDataObjects(true);
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
		
		// Make sure at least one item is a regular item
		//
		// DEBUG: We could copy notes via keyboard shortcut if we altered
		// Z_F_I.copyItemsToClipboard() to use Z.QuickCopy.getContentFromItems(),
		// but 1) we'd need to override that function's drag limit and 2) when I
		// tried it the OS X clipboard seemed to be getting text vs. HTML wrong,
		// automatically converting text/html to plaintext rather than using
		// text/unicode. (That may be fixable, however.)
		var canCopy = false;
		for each(var item in items) {
			if (item.isRegularItem()) {
				canCopy = true;
				break;
			}
		}
		if (!canCopy) {
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			ps.alert(null, "", Zotero.getString("fileInterface.noReferencesError"));
			return;
		}
		
		var url = (window.content && window.content.location ? window.content.location.href : null);
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
			ZoteroPane_Local.search();
		}
	}
	
	
	function handleSearchKeypress(textbox, event) {
		// Events that turn find-as-you-type on
		if (event.keyCode == event.DOM_VK_ESCAPE) {
			textbox.value = '';
			ZoteroPane_Local.setItemsPaneMessage(Zotero.getString('searchInProgress'));
			setTimeout(function () {
				ZoteroPane_Local.search();
				ZoteroPane_Local.clearItemsPaneMessage();
			}, 1);
		}
		else if (event.keyCode == event.DOM_VK_RETURN || event.keyCode == event.DOM_VK_ENTER) {
			ZoteroPane_Local.setItemsPaneMessage(Zotero.getString('searchInProgress'));
			setTimeout(function () {
				ZoteroPane_Local.search(true);
				ZoteroPane_Local.clearItemsPaneMessage();
			}, 1);
		}
	}
	
	
	function handleSearchInput(textbox, event) {
		// This is the new length, except, it seems, when the change is a
		// result of Undo or Redo
		if (!textbox.value.length) {
			ZoteroPane_Local.setItemsPaneMessage(Zotero.getString('searchInProgress'));
			setTimeout(function () {
				ZoteroPane_Local.search();
				ZoteroPane_Local.clearItemsPaneMessage();
			}, 1);
		}
		else if (textbox.value.indexOf('"') != -1) {
			ZoteroPane_Local.setItemsPaneMessage(Zotero.getString('advancedSearchMode'));
		}
	}
	
	
	function search(runAdvanced)
	{
		if (this.itemsView) {
			var search = document.getElementById('zotero-tb-search');
			if (!runAdvanced && search.value.indexOf('"') != -1) {
				return;
			}
			var searchVal = search.value;
			this.itemsView.setFilter('search', searchVal);
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
			Components.utils.reportError("Items view not set in ZoteroPane_Local.selectItem()");
			return false;
		}
		
		var currentLibraryID = this.getSelectedLibraryID();
		// If in a different library
		if (item.libraryID != currentLibraryID) {
			Zotero.debug("Library ID differs; switching library");
			this.collectionsView.selectLibrary(item.libraryID);
		}
		// Force switch to library view
		else if (!this.itemsView._itemGroup.isLibrary() && inLibrary) {
			Zotero.debug("Told to select in library; switching to library");
			this.collectionsView.selectLibrary(item.libraryID);
		}
		
		var selected = this.itemsView.selectItem(itemID, expand);
		if (!selected) {
			Zotero.debug("Item was not selected; switching to library");
			this.collectionsView.selectLibrary(item.libraryID);
			this.itemsView.selectItem(itemID, expand);
		}
		
		return true;
	}
	
	
	this.getSelectedLibraryID = function () {
		return this.collectionsView.getSelectedLibraryID();
	}
	
	
	function getSelectedCollection(asID) {
		return this.collectionsView ? this.collectionsView.getSelectedCollection(asID) : false;
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
		
			var itemGroup = this.getItemGroup();
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
		var options = [
			"newCollection",
			"newSavedSearch",
			"newSubcollection",
			"sep1",
			"showDuplicates",
			"showUnfiled",
			"editSelectedCollection",
			"deleteCollection",
			"deleteCollectionAndItems",
			"sep2",
			"exportCollection",
			"createBibCollection",
			"exportFile",
			"loadReport",
			"emptyTrash",
			"createCommonsBucket",
			"refreshCommonsBucket"
		];
		
		var m = {};
		var i = 0;
		for each(var option in options) {
			m[option] = i++;
		}
		
		var menu = document.getElementById('zotero-collectionmenu');
		
		var itemGroup = this.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
		
		// By default things are hidden and visible, so we only need to record
		// when things are visible and when they're visible but disabled
		var show = [], disable = [];
		
		if (itemGroup.isCollection()) {
			show = [
				m.newSubcollection,
				m.sep1,
				m.editSelectedCollection,
				m.deleteCollection,
				m.deleteCollectionAndItems,
				m.sep2,
				m.exportCollection,
				m.createBibCollection,
				m.loadReport
			];
			var s = [m.exportCollection, m.createBibCollection, m.loadReport];
			if (!this.itemsView.rowCount) {
				if (!this.collectionsView.isContainerEmpty(this.collectionsView.selection.currentIndex)) {
					disable = [m.createBibCollection, m.loadReport];
				}
				else {
					disable = s;
				}
			}
			
			// Adjust labels
			menu.childNodes[m.editSelectedCollection].setAttribute('label', Zotero.getString('pane.collections.menu.rename.collection'));
			menu.childNodes[m.deleteCollection].setAttribute('label', Zotero.getString('pane.collections.menu.delete.collection'));
			menu.childNodes[m.deleteCollectionAndItems].setAttribute('label', Zotero.getString('pane.collections.menu.delete.collectionAndItems'));
			menu.childNodes[m.exportCollection].setAttribute('label', Zotero.getString('pane.collections.menu.export.collection'));
			menu.childNodes[m.createBibCollection].setAttribute('label', Zotero.getString('pane.collections.menu.createBib.collection'));
			menu.childNodes[m.loadReport].setAttribute('label', Zotero.getString('pane.collections.menu.generateReport.collection'));
		}
		else if (itemGroup.isSearch()) {
			show = [
				m.editSelectedCollection,
				m.deleteCollection,
				m.sep2,
				m.exportCollection,
				m.createBibCollection,
				m.loadReport
			];
			
			menu.childNodes[m.deleteCollection].setAttribute('label', Zotero.getString('pane.collections.menu.delete.savedSearch'));
			
			var s = [m.exportCollection, m.createBibCollection, m.loadReport];
			if (!this.itemsView.rowCount) {
				disable = s;
			}
			
			// Adjust labels
			menu.childNodes[m.editSelectedCollection].setAttribute('label', Zotero.getString('pane.collections.menu.edit.savedSearch'));
			menu.childNodes[m.exportCollection].setAttribute('label', Zotero.getString('pane.collections.menu.export.savedSearch'));
			menu.childNodes[m.createBibCollection].setAttribute('label', Zotero.getString('pane.collections.menu.createBib.savedSearch'));
			menu.childNodes[m.loadReport].setAttribute('label', Zotero.getString('pane.collections.menu.generateReport.savedSearch'));
		}
		else if (itemGroup.isTrash()) {
			show = [m.emptyTrash];
		}
		else if (itemGroup.isGroup()) {
			show = [m.newCollection, m.newSavedSearch, m.sep1, m.showDuplicates, m.showUnfiled];
		}
		else if (itemGroup.isDuplicates() || itemGroup.isUnfiled()) {
			show = [
				m.deleteCollection
			];
			
			menu.childNodes[m.deleteCollection].setAttribute('label', Zotero.getString('general.hide'));
		}
		else if (itemGroup.isHeader()) {
			if (itemGroup.ref.id == 'commons-header') {
				show = [m.createCommonsBucket];
			}
		}
		else if (itemGroup.isBucket()) {
			show = [m.refreshCommonsBucket];
		}
		// Library
		else
		{
			show = [m.newCollection, m.newSavedSearch, m.sep1, m.showDuplicates, m.showUnfiled, m.sep2, m.exportFile];
		}
		
		// Disable some actions if user doesn't have write access
		//
		// Some actions are disabled via their commands in onCollectionSelected()
		var s = [m.newSubcollection, m.editSelectedCollection, m.deleteCollection, m.deleteCollectionAndItems];
		if (itemGroup.isWithinGroup() && !itemGroup.editable && !itemGroup.isDuplicates() && !itemGroup.isUnfiled()) {
			disable = disable.concat(s);
		}
		
		// If within non-editable group or trash it empty, disable Empty Trash
		if (itemGroup.isTrash()) {
			if ((itemGroup.isWithinGroup() && !itemGroup.isWithinEditableGroup()) || !this.itemsView.rowCount) {
				disable.push(m.emptyTrash);
			}
		}
		
		// Hide and enable all actions by default (so if they're shown they're enabled)
		for each(var pos in m) {
			menu.childNodes[pos].setAttribute('hidden', true);
			menu.childNodes[pos].setAttribute('disabled', false);
		}
		
		for (var i in show)
		{
			menu.childNodes[show[i]].setAttribute('hidden', false);
		}
		
		for (var i in disable)
		{
			menu.childNodes[disable[i]].setAttribute('disabled', true);
		}
	}
	
	function buildItemContextMenu()
	{
		var options = [
			'showInLibrary',
			'sep1',
			'addNote',
			'addAttachments',
			'sep2',
			'duplicateItem',
			'deleteItem',
			'deleteFromLibrary',
			'restoreToLibrary',
			'mergeItems',
			'sep3',
			'exportItems',
			'createBib',
			'loadReport',
			'sep4',
			'recognizePDF',
			'createParent',
			'renameAttachments',
			'reindexItem'
		];
		
		var m = {};
		var i = 0;
		for each(var option in options) {
			m[option] = i++;
		}
		
		var menu = document.getElementById('zotero-itemmenu');
		
		// remove old locate menu items
		while(menu.firstChild && menu.firstChild.getAttribute("zotero-locate")) {
			menu.removeChild(menu.firstChild);
		}
		
		var disable = [], show = [], multiple = '';
		
		if (!this.itemsView) {
			return;
		}
		
		var itemGroup = this.getItemGroup();
		
		if(itemGroup.isTrash()) {
			show.push(m.restoreToLibrary);
		} else {
			show.push(m.deleteFromLibrary);
		}
		
		show.push(m.sep3, m.exportItems, m.createBib, m.loadReport);
		
		if (this.itemsView.selection.count > 0) {
			// Multiple items selected
			if (this.itemsView.selection.count > 1) {
				var multiple =  '.multiple';
				
				var items = this.getSelectedItems();
				var canMerge = true, canIndex = true, canRecognize = true, canRename = true;
				
				if (!Zotero.Fulltext.pdfConverterIsRegistered()) {
					canIndex = false;
				}
				
				for each(var item in items) {
					if (canMerge && !item.isRegularItem() || itemGroup.isDuplicates()) {
						canMerge = false;
					}
					
					if (canIndex && !Zotero.Fulltext.canReindex(item.id)) {
						canIndex = false;
					}
					
					if (canRecognize && !Zotero_RecognizePDF.canRecognize(item)) {
						canRecognize = false;
					}
					
					// Show rename option only if all items are child attachments
					if (canRename && (!item.isAttachment() || !item.getSource() || item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL)) {
						canRename = false;
					}
				}
				
				if (canMerge) {
					show.push(m.mergeItems);
				}
				
				if (canIndex) {
					show.push(m.reindexItem);
				}
				
				if (canRecognize) {
					show.push(m.recognizePDF);
				}
				
				var canCreateParent = true;
				for each(var item in items) {
					if (!item.isTopLevelItem() || !item.isAttachment()) {
						canCreateParent = false;
						break;
					}
				}
				if (canCreateParent) {
					show.push(m.createParent);
				}
				
				if (canRename) {
					show.push(m.renameAttachments);
				}
				
				// Add in attachment separator
				if (canCreateParent || canRecognize || canRename || canIndex) {
					show.push(m.sep4);
				}
				
				// Block certain actions on files if no access and at least one item
				// is an imported attachment
				if (!itemGroup.filesEditable) {
					var hasImportedAttachment = false;
					for (var i=0; i<items.length; i++) {
						var item = items[i];
						if (item.isImportedAttachment()) {
							hasImportedAttachment = true;
							break;
						}
					}
					if (hasImportedAttachment) {
						disable.push(m.deleteFromLibrary, m.createParent, m.renameAttachments);
					}
				}
			}
			
			// Single item selected
			else
			{
				var item = this.getSelectedItems()[0];
				var itemID = item.id;
				menu.setAttribute('itemID', itemID);
				
				// Show in Library
				if (!itemGroup.isLibrary() && !itemGroup.isWithinGroup()) {
					show.push(m.showInLibrary, m.sep1);
				}
				
				// Disable actions in the trash
				if (itemGroup.isTrash()) {
					disable.push(m.deleteItem);
				}
				
				if (item.isRegularItem()) {
					show.push(m.addNote, m.addAttachments, m.sep2);
				}
				
				if (item.isAttachment()) {
					var showSep4 = false;
					
					if (Zotero_RecognizePDF.canRecognize(item)) {
						show.push(m.recognizePDF);
						showSep4 = true;
					}
					
					// Allow parent item creation for standalone attachments
					if (item.isTopLevelItem()) {
						show.push(m.createParent);
						showSep4 = true;
					}
					
					// Attachment rename option
					if (item.getSource() && item.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) {
						show.push(m.renameAttachments);
						showSep4 = true;
					}
					
					// If not linked URL, show reindex line
					if (Zotero.Fulltext.pdfConverterIsRegistered()
							&& Zotero.Fulltext.canReindex(item.id)) {
						show.push(m.reindexItem);
						showSep4 = true;
					}
					
					if (showSep4) {
						show.push(m.sep4);
					}
				}
				else {
					show.push(m.duplicateItem);
				}
				
				// Update attachment submenu
				var popup = document.getElementById('zotero-add-attachment-popup')
				this.updateAttachmentButtonMenu(popup);
				
				// Block certain actions on files if no access
				if (item.isImportedAttachment() && !itemGroup.filesEditable) {
					var d = [m.deleteFromLibrary, m.createParent, m.renameAttachments];
					for each(var val in d) {
						disable.push(val);
					}
				}
			}
		}
		// No items selected
		else
		{
			// Show in Library
			if (!itemGroup.isLibrary()) {
				show.push(m.showInLibrary, m.sep1);
			}
			
			disable.push(m.showInLibrary, m.duplicateItem, m.deleteItem,
				m.deleteFromLibrary, m.exportItems, m.createBib, m.loadReport);
		}
		
		// TODO: implement menu for remote items
		if (!itemGroup.editable) {
			for (var i in m) {
				// Still show export/bib/report for non-editable views
				// (other than Commons buckets, which aren't real items)
				if (!itemGroup.isBucket()) {
					switch (i) {
						case 'exportItems':
						case 'createBib':
						case 'loadReport':
						case 'restoreToLibrary':
							continue;
					}
				}
				disable.push(m[i]);
			}
		}
		
		// Remove from collection
		if (itemGroup.isCollection() && !(item && item.getSource()))
		{
			menu.childNodes[m.deleteItem].setAttribute('label', Zotero.getString('pane.items.menu.remove' + multiple));
			show.push(m.deleteItem);
		}
		
		// Plural if necessary
		menu.childNodes[m.deleteFromLibrary].setAttribute('label', Zotero.getString('pane.items.menu.moveToTrash' + multiple));
		menu.childNodes[m.exportItems].setAttribute('label', Zotero.getString('pane.items.menu.export' + multiple));
		menu.childNodes[m.createBib].setAttribute('label', Zotero.getString('pane.items.menu.createBib' + multiple));
		menu.childNodes[m.loadReport].setAttribute('label', Zotero.getString('pane.items.menu.generateReport' + multiple));
		menu.childNodes[m.createParent].setAttribute('label', Zotero.getString('pane.items.menu.createParent' + multiple));
		menu.childNodes[m.recognizePDF].setAttribute('label', Zotero.getString('pane.items.menu.recognizePDF' + multiple));
		menu.childNodes[m.renameAttachments].setAttribute('label', Zotero.getString('pane.items.menu.renameAttachments' + multiple));
		menu.childNodes[m.reindexItem].setAttribute('label', Zotero.getString('pane.items.menu.reindexItem' + multiple));
		
		// Hide and enable all actions by default (so if they're shown they're enabled)
		for each(var pos in m) {
			menu.childNodes[pos].setAttribute('hidden', true);
			menu.childNodes[pos].setAttribute('disabled', false);
		}
		
		for (var i in disable)
		{
			menu.childNodes[disable[i]].setAttribute('disabled', true);
		}
		
		for (var i in show)
		{
			menu.childNodes[show[i]].setAttribute('hidden', false);
		}
		
		// add locate menu options
		Zotero_LocateMenu.buildContextMenu(menu, true);
	}
	
	
	this.onTreeMouseDown = function (event) {
		var t = event.originalTarget;
		var tree = t.parentNode;
		
		// Ignore click on column headers
		if (!tree.treeBoxObject) {
			return;
		}
		
		var row = {}, col = {}, obj = {};
		tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
		if (row.value == -1) {
			return;
		}
		
		if (tree.id == 'zotero-collections-tree') {
			let itemGroup = ZoteroPane_Local.collectionsView._getItemAtRow(row.value);
			
			// Prevent the tree's select event from being called for a click
			// on a library sync error icon
			if (itemGroup.isLibrary(true)) {
				if (col.value.id == 'zotero-collections-sync-status-column') {
					var libraryID = itemGroup.isLibrary() ? 0 : itemGroup.ref.libraryID;
					var errors = Zotero.Sync.Runner.getErrors(libraryID);
					if (errors) {
						event.stopPropagation();
						return;
					}
				}
			}
		}
		
		// Automatically select all equivalent items when clicking on an item
		// in duplicates view
		else if (tree.id == 'zotero-items-tree') {
			let itemGroup = ZoteroPane_Local.getItemGroup();
			
			if (itemGroup.isDuplicates()) {
				// Trigger only on primary-button single clicks without modifiers
				// (so that items can still be selected and deselected manually)
				if (!event || event.detail != 1 || event.button != 0 || event.metaKey
					|| event.shiftKey || event.altKey || event.ctrlKey) {
					return;
				}
				
				var t = event.originalTarget;
				
				if (t.localName != 'treechildren') {
					return;
				}
				
				var tree = t.parentNode;
				
				var row = {}, col = {}, obj = {};
				tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
				
				// obj.value == 'cell'/'text'/'image'/'twisty'
				if (!obj.value) {
					return;
				}
				
				// Duplicated in itemTreeView.js::notify()
				var itemID = ZoteroPane_Local.itemsView._getItemAtRow(row.value).ref.id;
				var setItemIDs = itemGroup.ref.getSetItemsByItemID(itemID);
				ZoteroPane_Local.itemsView.selectItems(setItemIDs);
				
				// Prevent the tree's select event from being called here,
				// since it's triggered by the multi-select
				event.stopPropagation();
			}
		}
	}
	
	
	// Adapted from: http://www.xulplanet.com/references/elemref/ref_tree.html#cmnote-9
	this.onTreeClick = function (event) {
		var t = event.originalTarget;
		
		if (t.localName != 'treechildren') {
			return;
		}
		
		var tree = t.parentNode;
		
		var row = {}, col = {}, obj = {};
		tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
		
		// We care only about primary-button double and triple clicks
		if (!event || (event.detail != 2 && event.detail != 3) || event.button != 0) {
			if (row.value == -1) {
				return;
			}
			
			if (tree.id == 'zotero-collections-tree') {
				let itemGroup = ZoteroPane_Local.collectionsView._getItemAtRow(row.value);
				
				// Show the error panel when clicking a library-specific
				// sync error icon
				if (itemGroup.isLibrary(true)) {
					if (col.value.id == 'zotero-collections-sync-status-column') {
						var libraryID = itemGroup.isLibrary() ? 0 : itemGroup.ref.libraryID;
						var errors = Zotero.Sync.Runner.getErrors(libraryID);
						if (!errors) {
							return;
						}
						
						var panel = Zotero.Sync.Runner.updateErrorPanel(window.document, errors);
						
						var anchor = document.getElementById('zotero-collections-tree-shim');
						
						var x = {}, y = {}, width = {}, height = {};
						tree.treeBoxObject.getCoordsForCellItem(row.value, col.value, 'image', x, y, width, height);
						
						x = x.value + Math.round(width.value / 2);
						y = y.value + height.value + 3;
						
						panel.openPopup(anchor, "after_start", x, y, false, false);
					}
					return;
				}
			}
			
			// The Mozilla tree binding fires select() in mousedown(),
			// but if when it gets to click() the selection differs from
			// what it expects (say, because multiple items had been
			// selected during mousedown(), as is the case in duplicates mode),
			// it fires select() again. We prevent that here.
			else if (tree.id == 'zotero-items-tree') {
				let itemGroup = ZoteroPane_Local.getItemGroup();
				if (itemGroup.isDuplicates()) {
					if (event.button != 0 || event.metaKey || event.shiftKey
						|| event.altKey || event.ctrlKey) {
						return;
					}
					
					if (obj.value == 'twisty') {
						return;
					}
					
					event.stopPropagation();
					event.preventDefault();
				}
			}
			
			return;
		}
		
		var itemGroup = ZoteroPane_Local.getItemGroup();
		
		// Ignore double-clicks in duplicates view on everything except attachments
		if (itemGroup.isDuplicates()) {
			var items = ZoteroPane_Local.getSelectedItems();
			if (items.length != 1 || !items[0].isAttachment()) {
				event.stopPropagation();
				event.preventDefault();
				return;
			}
		}
		
		// obj.value == 'cell'/'text'/'image'
		if (!obj.value) {
			return;
		}
		
		if (tree.id == 'zotero-collections-tree') {                                                    
			// Ignore triple clicks for collections
			if (event.detail != 2) {
				return;
			}
			
			if (itemGroup.isLibrary()) {
				var uri = Zotero.URI.getCurrentUserLibraryURI();
				if (uri) {
					ZoteroPane_Local.loadURI(uri);
					event.stopPropagation();
				}
				return;
			}
			
			if (itemGroup.isSearch()) {
				ZoteroPane_Local.editSelectedCollection();
				return;
			}
			
			if (itemGroup.isGroup()) {
				var uri = Zotero.URI.getGroupURI(itemGroup.ref, true);
				ZoteroPane_Local.loadURI(uri);
				event.stopPropagation();
				return;
			}
			
			// Ignore double-clicks on Unfiled Items source row
			if (itemGroup.isUnfiled()) {
				return;
			}
			
			if (itemGroup.isHeader()) {
				if (itemGroup.ref.id == 'group-libraries-header') {
					var uri = Zotero.URI.getGroupsURL();
					ZoteroPane_Local.loadURI(uri);
					event.stopPropagation();
				}
				return;
			}

			if (itemGroup.isBucket()) {
				ZoteroPane_Local.loadURI(itemGroup.ref.uri);
				event.stopPropagation();
			}
		}
		else if (tree.id == 'zotero-items-tree') {
			var viewOnDoubleClick = Zotero.Prefs.get('viewOnDoubleClick');
			if (viewOnDoubleClick) {
				// Expand/collapse on triple-click, though the double-click
				// will still trigger
				if (event.detail == 3) {
					tree.view.toggleOpenState(tree.view.selection.currentIndex);
					return;
				}
				
				// Don't expand/collapse on double-click
				event.stopPropagation();
			}
			
			if (tree.view && tree.view.selection.currentIndex > -1) {
				var item = ZoteroPane_Local.getSelectedItems()[0];
				if (item) {
					if (!viewOnDoubleClick && item.isRegularItem()) {
						return;
					}
					ZoteroPane_Local.viewItems([item], event);
				}
			}
		}
	}
	
	
	this.openPreferences = function (paneID, action) {
		var io = {
			pane: paneID,
			action: action
		};
		
		var win = null;
		// If window is already open, just focus it
		if (!action) {
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				.getService(Components.interfaces.nsIWindowMediator);
			var enumerator = wm.getEnumerator("zotero:pref");
			if (enumerator.hasMoreElements()) {
				var win = enumerator.getNext();
				win.focus();
				if (paneID) {
					var pane = win.document.getElementsByAttribute('id', paneID)[0];
					pane.parentElement.showPane(pane);
				}
			}
		}
		if (!win) {
			window.openDialog('chrome://zotero/content/preferences/preferences.xul',
				'zotero-prefs',
				'chrome,titlebar,toolbar,centerscreen,'
					+ Zotero.Prefs.get('browser.preferences.instantApply', true) ? 'dialog=no' : 'modal',
				io
			);
		}
	}
	
	
	/*
	 * Loads a URL following the standard modifier key behavior
	 *  (e.g. meta-click == new background tab, meta-shift-click == new front tab,
	 *  shift-click == new window, no modifier == frontmost tab
	 */
	function loadURI(uris, event) {
		if(typeof uris === "string") {
			uris = [uris];
		}
		
		for each(var uri in uris) {
			// Ignore javascript: and data: URIs
			if (uri.match(/^(javascript|data):/)) {
				return;
			}
			
			if (Zotero.isStandalone) {
				if(uri.match(/^https?/)) {
					this.launchURL(uri);
				} else {
					ZoteroStandalone.openInViewer(uri);
				}
				return;
			}
			
			// Open in new tab
			var openInNewTab = event && (event.metaKey || (!Zotero.isMac && event.ctrlKey));
			if (event && event.shiftKey && !openInNewTab) {
				window.open(uri, "zotero-loaded-page",
					"menubar=yes,location=yes,toolbar=yes,personalbar=yes,resizable=yes,scrollbars=yes,status=yes");
			}
			else if (openInNewTab || !window.loadURI || uris.length > 1) {
				// if no gBrowser, find it
				if(!gBrowser) {
					var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
									   .getService(Components.interfaces.nsIWindowMediator);
					var browserWindow = wm.getMostRecentWindow("navigator:browser");
					var gBrowser = browserWindow.gBrowser;
				}
				
				// load in a new tab
				var tab = gBrowser.addTab(uri);
				var browser = gBrowser.getBrowserForTab(tab);
				
				if (event && event.shiftKey || !openInNewTab) {
					// if shift key is down, or we are opening in a new tab because there is no loadURI,
					// select new tab
					gBrowser.selectedTab = tab;
				}
			}
			else {
				window.loadURI(uri);
			}
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
	
	
	this.setItemPaneMessage = function (msg) {
		document.getElementById('zotero-item-pane-content').selectedIndex = 0;
		
		var label = document.getElementById('zotero-item-pane-message');
		label.value = msg;
	}
	
	
	// Updates browser context menu options
	function contextPopupShowing()
	{
		if (!Zotero.Prefs.get('browserContentContextMenu')) {
			return;
		}
		
		var menuitem = document.getElementById("zotero-context-add-to-current-note");
		if (menuitem){
			var items = ZoteroPane_Local.getSelectedItems();
			if (ZoteroPane_Local.itemsView.selection && ZoteroPane_Local.itemsView.selection.count==1
				&& items[0] && items[0].isNote()
				&& window.gContextMenu.isTextSelected)
			{
				menuitem.hidden = false;
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
			}
			else {
				menuitem.hidden = true;
			}
		}
		
		// If Zotero is locked or library is read-only, disable menu items
		var menu = document.getElementById('zotero-content-area-context-menu');
		var disabled = Zotero.locked;
		if (!disabled && self.collectionsView.selection && self.collectionsView.selection.count) {
			var itemGroup = self.collectionsView._getItemAtRow(self.collectionsView.selection.currentIndex);
			disabled = !itemGroup.editable;
		}
		for each(var menuitem in menu.firstChild.childNodes) {
			menuitem.disabled = disabled;
		}
	}
	
	
	this.newNote = function (popup, parent, text, citeURI) {
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
			text = Zotero.Utilities.trim(text);
			
			if (text) {
				text = '<blockquote'
						+ (citeURI ? ' cite="' + citeURI + '"' : '')
						+ '>' + Zotero.Utilities.text2html(text) + "</blockquote>";
			}
			
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
				this.openNoteWindow(null, c.id, parent);
			}
			else {
				this.openNoteWindow(null, null, parent);
			}
		}
	}
	
	
	function addTextToNote(text, citeURI)
	{
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		if (!text) {
			return false;
		}
		
		text = Zotero.Utilities.trim(text);
		
		if (!text.length) {
			return false;
		}
		
		text = '<blockquote'
					+ (citeURI ? ' cite="' + citeURI + '"' : '')
					+ '>' + Zotero.Utilities.text2html(text) + "</blockquote>";
		
		var items = this.getSelectedItems();
		if (this.itemsView.selection.count == 1 && items[0] && items[0].isNote()) {
			var note = items[0].getNote()
			
			items[0].setNote(note + text);
			items[0].save();
			
			var noteElem = document.getElementById('zotero-note-editor')
			noteElem.focus();
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
			var e = wm.getEnumerator('zotero:note');
			while (e.hasMoreElements()) {
				var w = e.getNext();
				if (w.name == name) {
					w.focus();
					return;
				}
			}
		}
		
		var io = { itemID: itemID, collectionID: col, parentItemID: parentItemID };
		window.openDialog('chrome://zotero/content/note.xul', name, 'chrome,resizable,centerscreen,dialog=false', io);
	}
	
	
	this.addAttachmentFromURI = function (link, itemID) {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
		
		var input = {};
		var check = {value : false};
		
		// TODO: Allow title to be specified?
		var result = ps.prompt(null, Zotero.getString('pane.items.attach.link.uri.title'),
			Zotero.getString('pane.items.attach.link.uri'), input, "", {});
		if (!result || !input.value) return false;
		
		// Create a new attachment
		Zotero.Attachments.linkFromURL(input.value, itemID);
	}
	
	
	function addAttachmentFromDialog(link, id)
	{
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var itemGroup = ZoteroPane_Local.collectionsView._getItemAtRow(this.collectionsView.selection.currentIndex);
		if (link && itemGroup.isWithinGroup()) {
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			ps.alert(null, "", "Linked files cannot be added to group libraries.");
			return;
		}
		
		// TODO: disable in menu
		if (!this.canEditFiles()) {
			this.displayCannotEditLibraryFilesMessage();
			return;
		}
		
		var libraryID = itemGroup.ref.libraryID;
		
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
					attachmentID = Zotero.Attachments.importFromFile(file, id, libraryID);
			
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
		if(Zotero.isConnector) {
			// In connector, save page via Zotero Standalone
			var doc = window.content.document;
			Zotero.Connector.callMethod("saveSnapshot", {"url":doc.location.toString(),
					"cookie":doc.cookie, "html":doc.documentElement.innerHTML},
			function(returnValue, status) {
				_showPageSaveStatus(doc.title);
			});
			return;
		}
		
		if ((row || (this.collectionsView && this.collectionsView.selection)) && !this.canEdit(row)) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		return this.addItemFromDocument(window.content.document, itemType, saveSnapshot, row);
	}
	
	/**
	 * Shows progress dialog for a webpage/snapshot save request
	 */
	function _showPageSaveStatus(title) {
		var progressWin = new Zotero.ProgressWindow();
		progressWin.changeHeadline(Zotero.getString('ingester.scraping'));
		var icon = 'chrome://zotero/skin/treeitem-webpage.png';
		progressWin.addLines(title, icon)
		progressWin.show();
		progressWin.startCloseTimer();
	}
	
	/**
	 * @param	{Document}			doc
	 * @param	{String|Integer}	[itemType='webpage']	Item type id or name
	 * @param	{Boolean}			[saveSnapshot]			Force saving or non-saving of a snapshot,
	 *														regardless of automaticSnapshots pref
	 */
	this.addItemFromDocument = function (doc, itemType, saveSnapshot, row) {
		_showPageSaveStatus(doc.title);
		
		// Save snapshot if explicitly enabled or automatically pref is set and not explicitly disabled
		saveSnapshot = saveSnapshot || (saveSnapshot !== false && Zotero.Prefs.get('automaticSnapshots'));
		
		// TODO: this, needless to say, is a temporary hack
		if (itemType == 'temporaryPDFHack') {
			itemType = null;
			var isPDF = false;
			if (doc.title.indexOf('application/pdf') != -1 || Zotero.Attachments.isPDFJS(doc)
					|| doc.contentType == 'application/pdf') {
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
			
			if (isPDF && saveSnapshot) {
				//
				// Duplicate newItem() checks here
				//
				if (!Zotero.stateCheck()) {
					this.displayErrorMessage(true);
					return false;
				}
				
				// Currently selected row
				if (row === undefined && this.collectionsView && this.collectionsView.selection) {
					row = this.collectionsView.selection.currentIndex;
				}
				
				if (row && !this.canEdit(row)) {
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
				
				var itemID = Zotero.Attachments.importFromDocument(doc, false, false, collectionID, null, libraryID);
				
				// importFromDocument() doesn't trigger the notifier for a second
				//
				// The one-second delay is weird but better than nothing
				var self = this;
				setTimeout(function () {
					self.selectItem(itemID);
				}, 1001);
				
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
			var filesEditable = group.filesEditable;
		}
		else {
			var filesEditable = true;
		}
		
		if (saveSnapshot) {
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
		if (window.content && url == window.content.document.location.href) {
			return this.addItemFromPage(itemType, saveSnapshot, row);
		}
		
		var self = this;
		
		url = Zotero.Utilities.resolveIntermediateURL(url);
		
		Zotero.MIME.getMIMETypeFromURL(url, function (mimeType, hasNativeHandler) {
			// If native type, save using a hidden browser
			if (hasNativeHandler) {
				var processor = function (doc) {
					ZoteroPane_Local.addItemFromDocument(doc, itemType, saveSnapshot, row);
				};
				
				var done = function () {}
				
				var exception = function (e) {
					Zotero.debug(e);
				}
				
				Zotero.HTTP.processDocuments([url], processor, done, exception);
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
							ZoteroPane_Local.displayErrorMessage(true);
							return false;
						}
						
						// Currently selected row
						if (row === undefined) {
							row = ZoteroPane_Local.collectionsView.selection.currentIndex;
						}
						
						if (!ZoteroPane_Local.canEdit(row)) {
							ZoteroPane_Local.displayCannotEditLibraryMessage();
							return;
						}
						
						if (row !== undefined) {
							var itemGroup = ZoteroPane_Local.collectionsView._getItemAtRow(row);
							var libraryID = itemGroup.ref.libraryID;
						}
						else {
							var libraryID = null;
							var itemGroup = null;
						}
						//
						//
						//
						
						if (!ZoteroPane_Local.canEditFiles(row)) {
							ZoteroPane_Local.displayCannotEditLibraryFilesMessage();
							return;
						}
						
						if (itemGroup && itemGroup.isCollection()) {
							var collectionID = itemGroup.ref.id;
						}
						else {
							var collectionID = false;
						}
						
						var attachmentItem = Zotero.Attachments.importFromURL(url, false,
							false, false, collectionID, mimeType, libraryID,
							function(attachmentItem) {
								self.selectItem(attachmentItem.id);
							});
							
						return;
					}
				}
				
				if (!itemType) {
					itemType = 'webpage';
				}
				
				var item = ZoteroPane_Local.newItem(itemType, {}, row);
				
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
			throw ("itemID must be an integer in ZoteroPane_Local.addAttachmentFromPage()");
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
	
	
	this.viewItems = function (items, event) {
		if (items.length > 1) {
			if (!event || (!event.metaKey && !event.shiftKey)) {
				event = { metaKey: true, shiftKey: true };
			}
		}
		
		for each(var item in items) {
			if (item.isRegularItem()) {
				// Prefer local file attachments
				var uri = Components.classes["@mozilla.org/network/standard-url;1"]
							.createInstance(Components.interfaces.nsIURI);
				var snapID = item.getBestAttachment();
				if (snapID) {
					ZoteroPane_Local.viewAttachment(snapID, event);
					continue;
				}
				
				// Fall back to URI field, then DOI
				var uri = item.getField('url');
				if (!uri) {
					var doi = item.getField('DOI');
					if (doi) {
						// Pull out DOI, in case there's a prefix
						doi = Zotero.Utilities.cleanDOI(doi);
						if (doi) {
							uri = "http://dx.doi.org/" + encodeURIComponent(doi);
						}
					}
				}
				
				// Fall back to first attachment link
				if (!uri) {
					var link = item.getAttachments()[0];
					if (link) {
						link = Zotero.Items.get(link);
						if (link) uri = link.getField('url');
					}
				}
				
				if (uri) {
					ZoteroPane_Local.loadURI(uri, event);
				}
			}
			else if (item.isNote()) {
				if (!ZoteroPane_Local.collectionsView.editable) {
					continue;
				}
				document.getElementById('zotero-view-note-button').doCommand();
			}
			else if (item.isAttachment()) {
				ZoteroPane_Local.viewAttachment(item.id, event);
			}
		}
	}
	
	
	function viewAttachment(itemIDs, event, noLocateOnMissing, forceExternalViewer) {
		Components.utils.import("resource://zotero/q.js");
		
		// If view isn't editable, don't show Locate button, since the updated
		// path couldn't be sent back up
		if (!this.collectionsView.editable) {
			noLocateOnMissing = true;
		}
		
		if(typeof itemIDs != "object") itemIDs = [itemIDs];
		
		// If multiple items, set up event so we open in new tab
		if(itemIDs.length > 1) {
			if(!event || (!event.metaKey && !event.shiftKey)) {
				event = {"metaKey":true, "shiftKey":true};
			}
		}
		
		for each(var itemID in itemIDs) {
			var item = Zotero.Items.get(itemID);
			if (!item.isAttachment()) {
				throw ("Item " + itemID + " is not an attachment in ZoteroPane_Local.viewAttachment()");
			}
			
			if (item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
				this.loadURI(item.getField('url'), event);
				continue;
			}
			
			var file = item.getFile();
			if (file) {
				Zotero.debug("Opening " + file.path);
				
				if(forceExternalViewer !== undefined) {
					var externalViewer = forceExternalViewer;
				} else {
					var mimeType = Zotero.MIME.getMIMETypeFromFile(file);
					
					//var mimeType = attachment.attachmentMIMEType;
					// TODO: update DB with new info if changed?
					
					var ext = Zotero.File.getExtension(file);
					var externalViewer = Zotero.isStandalone || (!Zotero.MIME.hasNativeHandler(mimeType, ext) &&
						(!Zotero.MIME.hasInternalHandler(mimeType, ext) || Zotero.Prefs.get('launchNonNativeFiles')));
				}
				
				if (!externalViewer) {
					var url = 'zotero://attachment/' + itemID + '/';
					this.loadURI(url, event);
				}
				else {
					Zotero.Notifier.trigger('open', 'file', itemID);
					Zotero.launchFile(file);
				}
			}
			else {
				if (!item.isImportedAttachment() || !Zotero.Sync.Storage.downloadAsNeeded(item.libraryID)) {
					this.showAttachmentNotFoundDialog(itemID, noLocateOnMissing);
					return;
				}
				
				let downloadedItem = item;
				Q.fcall(function () {
					return Zotero.Sync.Storage.downloadFile(
						downloadedItem,
						{
							onProgress: function (progress, progressMax) {}
						});
				})
				.then(function () {
					if (!downloadedItem.getFile()) {
						ZoteroPane_Local.showAttachmentNotFoundDialog(downloadedItem.id, noLocateOnMissing);
						return;
					}
					
					// check if unchanged?
					// maybe not necessary, since we'll get an error if there's an error
					
					
					Zotero.Notifier.trigger('redraw', 'item', []);
					
					ZoteroPane_Local.viewAttachment(downloadedItem.id, event, false, forceExternalViewer);
				})
				.fail(function (e) {
					// TODO: show error somewhere else
					Zotero.debug(e, 1);
					ZoteroPane_Local.syncAlert(e);
				})
				.done();
			}
		}
	}
	
	
	/**
	 * @deprecated
	 */
	this.launchFile = function (file) {
		Zotero.debug("ZoteroPane.launchFile() is deprecated -- use Zotero.launchFile()", 2);
		Zotero.launchFile(file);
	}
	
	
	/**
	 * Launch an HTTP URL externally, the best way we can
	 *
	 * Used only by Standalone
	 */
	this.launchURL = function (url) {
		if (!url.match(/^https?/)) {
			throw new Error("launchURL() requires an HTTP(S) URL");
		}
		
		try {
			var io = Components.classes['@mozilla.org/network/io-service;1']
						.getService(Components.interfaces.nsIIOService);
			var uri = io.newURI(url, null, null);
			var handler = Components.classes['@mozilla.org/uriloader/external-protocol-service;1']
							.getService(Components.interfaces.nsIExternalProtocolService)
							.getProtocolHandlerInfo('http');
			handler.preferredAction = Components.interfaces.nsIHandlerInfo.useSystemDefault;
			handler.launchWithURI(uri, null);
		}
		catch (e) {
			Zotero.debug("launchWithURI() not supported -- trying fallback executable");
			
			if (Zotero.isWin) {
				var pref = "fallbackLauncher.windows";
			}
			else {
				var pref = "fallbackLauncher.unix";
			}
			var path = Zotero.Prefs.get(pref);
			
			var exec = Components.classes["@mozilla.org/file/local;1"]
						.createInstance(Components.interfaces.nsILocalFile);
			exec.initWithPath(path);
			if (!exec.exists()) {
				throw ("Fallback executable not found -- check extensions.zotero." + pref + " in about:config");
			}
			
			var proc = Components.classes["@mozilla.org/process/util;1"]
							.createInstance(Components.interfaces.nsIProcess);
			proc.init(exec);
			
			var args = [url];
			proc.runw(false, args, args.length);
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
			if (file) {
				try {
					file.reveal();
				}
				catch (e) {
					// On platforms that don't support nsILocalFile.reveal() (e.g. Linux),
					// launch the parent directory
					var parent = file.parent.QueryInterface(Components.interfaces.nsILocalFile);
					Zotero.launchFile(parent);
				}
				Zotero.Notifier.trigger('open', 'file', attachment.id);
			}
			else {
				this.showAttachmentNotFoundDialog(attachment.id, noLocateOnMissing)
			}
		}
	}
	
	
	/**
	 * Test if the user can edit the currently selected view
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
	 * Test if the user can edit the parent library of the selected view
	 *
	 * @param	{Integer}	[row]
	 * @return	{Boolean}		TRUE if user can edit, FALSE if not
	 */
	this.canEditLibrary = function (row) {
		// Currently selected row
		if (row === undefined) {
			row = this.collectionsView.selection.currentIndex;
		}
		
		var itemGroup = this.collectionsView._getItemAtRow(row);
		// TODO: isEditable for user library should just return true
		if (itemGroup.ref.libraryID) {
			return Zotero.Libraries.isEditable(itemGroup.ref.libraryID);
		}
		return true;
	}
	
	
	/**
	 * Test if the user can edit the currently selected library/collection
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
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		ps.alert(null, "", Zotero.getString('save.error.cannotMakeChangesToCollection'));
	}
	
	
	this.displayCannotEditLibraryFilesMessage = function () {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		ps.alert(null, "", Zotero.getString('save.error.cannotAddFilesToCollection'));
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
	
	
	this.syncAlert = function (e) {
		e = Zotero.Sync.Runner.parseSyncError(e);
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK
							+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
		
		// Warning
		if (e.errorMode == 'warning') {
			var title = Zotero.getString('general.warning');
			
			// If secondary button not specified, just use an alert
			if (e.buttonText) {
				var buttonText = e.buttonText;
			}
			else {
				ps.alert(null, title, e.message);
				return;
			}
			
			var index = ps.confirmEx(
				null,
				title,
				e.message,
				buttonFlags,
				"",
				buttonText,
				"", null, {}
			);
			
			if (index == 1) {
				setTimeout(function () { buttonCallback(); }, 1);
			}
		}
		// Error
		else if (e.errorMode == 'error') {
			var title = Zotero.getString('general.error');
			
			// If secondary button is explicitly null, just use an alert
			if (buttonText === null) {
				ps.alert(null, title, e.message);
				return;
			}
			
			if (typeof buttonText == 'undefined') {
				var buttonText = Zotero.getString('errorReport.reportError');
				var buttonCallback = function () {
					ZoteroPane.reportErrors();
				};
			}
			else {
				var buttonText = e.buttonText;
				var buttonCallback = e.buttonCallback;
			}
			
			var index = ps.confirmEx(
				null,
				title,
				e.message,
				buttonFlags,
				"",
				buttonText,
				"", null, {}
			);
			
			if (index == 1) {
				setTimeout(function () { buttonCallback(); }, 1);
			}
		}
		// Upgrade
		else if (e.errorMode == 'upgrade') {
			ps.alert(null, "", e.message);
		}
	};
	
	
	this.createParentItemsFromSelected = function () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		
		var items = this.getSelectedItems();
		for (var i=0; i<items.length; i++) {
			var item = items[i];
			if (!item.isTopLevelItem() || item.isRegularItem()) {
				throw('Item ' + itemID + ' is not a top-level attachment or note in ZoteroPane_Local.createParentItemsFromSelected()');
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
				throw('Item ' + itemID + ' is not a child file attachment in ZoteroPane_Local.renameAttachmentFromParent()');
			}
			
			var file = item.getFile();
			if (!file) {
				continue;
			}
			
			var parentItemID = item.getSource();
			var newName = Zotero.Attachments.getFileBaseNameFromItem(parentItemID);
			
			var ext = file.leafName.match(/\.[^\.]+$/);
			if (ext) {
				newName = newName + ext;
			}
			
			var renamed = item.renameAttachmentFile(newName);
			if (renamed !== true) {
				Zotero.debug("Could not rename file (" + renamed + ")");
				continue;
			}
			
			item.setField('title', newName);
			item.save();
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
			throw('Item ' + itemID + ' not found in ZoteroPane_Local.relinkAttachment()');
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
	
	
	function reportErrors() {
		var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
				   .getService(Components.interfaces.nsIWindowWatcher);
		var data = {
			msg: Zotero.getString('errorReport.followingReportWillBeSubmitted'),
			errorData: Zotero.getErrors(true),
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
			var msg = Zotero.getString('general.restartFirefox', Zotero.appName) + ' '
				+ reportInstructions;
			pw.addDescription(msg);
			pw.show();
			pw.startCloseTimer(8000);
		}
		// Display as items pane message
		else {
			var msg = Zotero.getString('general.errorHasOccurred') + ' '
				+ Zotero.getString('general.restartFirefox', Zotero.appName) + '\n\n'
				+ reportInstructions;
			self.setItemsPaneMessage(msg, true);
		}
		Zotero.debug(msg, 1);
	}
	
	this.displayStartupError = function(asPaneMessage) {
		if(!Zotero || !Zotero.initialized) {
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
				//if(asPaneMessage) {
				//	ZoteroPane_Local.setItemsPaneMessage(errMsg, true);
				//} else {
					var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
											.getService(Components.interfaces.nsIPromptService);
					ps.alert(null, "", errMsg);
				//}
			}
		}
	}
	
	/**
	 * Toggles Zotero-as-a-tab by passing off the request to the ZoteroOverlay object associated
	 * with the present window
	 */
	this.toggleTab = function() {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						   .getService(Components.interfaces.nsIWindowMediator);
		var browserWindow = wm.getMostRecentWindow("navigator:browser");
		if(browserWindow.ZoteroOverlay) browserWindow.ZoteroOverlay.toggleTab();
	}
	
	/**
	 * Shows the Zotero pane, making it visible if it is not and switching to the appropriate tab
	 * if necessary.
	 */
	this.show = function() {
		if(window.ZoteroOverlay) {
			if(ZoteroOverlay.isTab) {
				ZoteroOverlay.loadZoteroTab();
			} else if(!this.isShowing()) {
				ZoteroOverlay.toggleDisplay();
			}
		}
	}
		
	/**
	 * Unserializes zotero-persist elements from preferences
	 */
	this.unserializePersist = function() {
		_unserialized = true;
		var serializedValues = Zotero.Prefs.get("pane.persist");
		if(!serializedValues) return;
		serializedValues = JSON.parse(serializedValues);
		for(var id in serializedValues) {
			var el = document.getElementById(id);
			if(!el) return;
			var elValues = serializedValues[id];
			for(var attr in elValues) {
				el.setAttribute(attr, elValues[attr]);
			}
		}
		
		if(this.itemsView) {
			// may not yet be initialized
			try {
				this.itemsView.sort();
			} catch(e) {};
		}
	}

	/**
	 * Serializes zotero-persist elements to preferences
	 */
	this.serializePersist = function() {
		if(!_unserialized) return;
		var serializedValues = {};
		for each(var el in document.getElementsByAttribute("zotero-persist", "*")) {
			if(!el.getAttribute) continue;
			var id = el.getAttribute("id");
			if(!id) continue;
			var elValues = {};
			for each(var attr in el.getAttribute("zotero-persist").split(/[\s,]+/)) {
				var attrValue = el.getAttribute(attr);
				elValues[attr] = attrValue;
			}
			serializedValues[id] = elValues;
		}
		Zotero.Prefs.set("pane.persist", JSON.stringify(serializedValues));
	}
	
	/**
	 * Moves around the toolbar when the user moves around the pane
	 */
	this.updateToolbarPosition = function() {
		if(document.getElementById("zotero-pane-stack").hidden) return;
		const PANES = ["collections", "items"];
		for each(var paneName in PANES) {
			var pane = document.getElementById("zotero-"+paneName+"-pane");
			var splitter = document.getElementById("zotero-"+paneName+"-splitter");
			var toolbar = document.getElementById("zotero-"+paneName+"-toolbar");
			
			var paneComputedStyle = window.getComputedStyle(pane, null);
			var splitterComputedStyle = window.getComputedStyle(splitter, null);
			
			toolbar.style.width = paneComputedStyle.getPropertyValue("width");
			toolbar.style.marginRight = splitterComputedStyle.getPropertyValue("width");
		}
	}
	
	/**
	 * Opens the about dialog
	 */
	this.openAboutDialog = function() {
		window.openDialog('chrome://zotero/content/about.xul', 'about', 'chrome');
	}
	
	/**
	 * Adds or removes a function to be called when Zotero is reloaded by switching into or out of
	 * the connector
	 */
	this.addReloadListener = function(/** @param {Function} **/func) {
		if(_reloadFunctions.indexOf(func) === -1) _reloadFunctions.push(func);
	}
	
	/**
	 * Adds or removes a function to be called just before Zotero is reloaded by switching into or
	 * out of the connector
	 */
	this.addBeforeReloadListener = function(/** @param {Function} **/func) {
		if(_beforeReloadFunctions.indexOf(func) === -1) _beforeReloadFunctions.push(func);
	}
	
	/**
	 * Implements nsIObserver for Zotero reload
	 */
	var _reloadObserver = {	
		/**
		 * Called when Zotero is reloaded (i.e., if it is switched into or out of connector mode)
		 */
		"observe":function(aSubject, aTopic, aData) {
			if(aTopic == "zotero-reloaded") {
				Zotero.debug("Reloading Zotero pane");
				for each(var func in _reloadFunctions) func(aData);
			} else if(aTopic == "zotero-before-reload") {
				Zotero.debug("Zotero pane caught before-reload event");
				for each(var func in _beforeReloadFunctions) func(aData);
			}
		}
	};
}

/**
 * Keep track of which ZoteroPane was local (since ZoteroPane object might get swapped out for a
 * tab's ZoteroPane)
 */
var ZoteroPane_Local = ZoteroPane;
