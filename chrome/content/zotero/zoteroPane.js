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

var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');

/*
 * This object contains the various functions for the interface
 */
var ZoteroPane = new function()
{
	var _unserialized = false;
	this.collectionsView = false;
	this.itemsView = false;
	this.itemPane = false;
	this.progressWindow = false;
	this._listeners = {};
	this.__defineGetter__('loaded', function () { return _loaded; });
	var _lastSelectedItems = [];
	var lastFocusedElement = null;
	this.lastKeyPress = null;
	
	//Privileged methods
	this.destroy = destroy;
	this.isFullScreen = isFullScreen;
	this.handleKeyDown = handleKeyDown;
	this.captureKeyDown = captureKeyDown;
	this.handleKeyUp = handleKeyUp;
	this.handleKeyPress = handleKeyPress;
	this.getSelectedCollection = getSelectedCollection;
	this.getSelectedSavedSearch = getSelectedSavedSearch;
	this.getSortField = getSortField;
	this.getSortDirection = getSortDirection;
	this.setItemsPaneMessage = setItemsPaneMessage;
	this.clearItemsPaneMessage = clearItemsPaneMessage;
	this.viewSelectedAttachment = viewSelectedAttachment;
	this.reportErrors = reportErrors;
	
	this.document = document;

	const modifierIsNotShift = ev => ev.getModifierState("Meta") || ev.getModifierState("Alt")
	|| ev.getModifierState("Control") || ev.getModifierState("OS");
	
	const TAB_NUMBER_CODE_RE = /^(?:Numpad|Digit)([0-9])$/;

	var self = this,
		_loaded = false, _madeVisible = false,
		titlebarcolorState, titleState, observerService,
		_reloadFunctions = [], _beforeReloadFunctions = [];
	
	/**
	 * Called when the window containing Zotero pane is open
	 */
	this.init = function () {
		Zotero.debug("Initializing Zotero pane");
		
		// Set key down handler
		document.addEventListener('keydown', ZoteroPane_Local.handleKeyDown);
		// Keydown handling that captures events. E.g. tab navigation
		document.addEventListener('keydown', ZoteroPane.captureKeyDown, true);
		// focusout, unlike blur, bubbles up to document level
		// so handleBlur gets triggered when any field, not just the document, looses focus
		document.addEventListener('focusout', ZoteroPane.handleBlur);
		
		// Init toolbar buttons for all progress queues
		let progressQueueButtons = document.getElementById('zotero-pq-buttons');
		let progressQueues = Zotero.ProgressQueues.getAll();
		for (let progressQueue of progressQueues) {
			let button = document.createXULElement('toolbarbutton');
			button.id = 'zotero-tb-pq-' + progressQueue.getID();
			button.hidden = progressQueue.getTotal() < 1;
			button.addEventListener('command', function () {
				Zotero.ProgressQueues.get(progressQueue.getID()).getDialog().open();
			}, false);
			
			progressQueue.addListener('empty', function () {
				button.hidden = true;
			});
			
			progressQueue.addListener('nonempty', function () {
				button.hidden = false;
			});
			
			progressQueueButtons.appendChild(button);
		}
		
		_loaded = true;
		
		var zp = document.getElementById('zotero-pane');
		Zotero.UIProperties.registerRoot(zp);
		zp.addEventListener('UIPropertiesChanged', () => {
			this.collectionsView?.updateFontSize();
			this.itemsView?.updateFontSize();
			this.updatePostUpgradeBanner();
		});
		Zotero.UIProperties.registerRoot(document.getElementById('zotero-context-pane'));
		this.itemPane = document.querySelector("#zotero-item-pane");
		ZoteroPane_Local.updateLayout();
		this.updateWindow();
		window.addEventListener("resize", () => {
			this.updateWindow();
			let tabsDeck = document.querySelector('#tabs-deck')
			if (!tabsDeck || tabsDeck.getAttribute('selectedIndex') == 0) {
				this.updateLayoutConstraints();
			}
		});
		window.setTimeout(this.updateLayoutConstraints.bind(this), 0);
		
		Zotero.updateQuickSearchBox(document);
		
		if (Zotero.isMac) {
			document.getElementById('zotero-pane-stack').setAttribute('platform', 'mac');
		} else if(Zotero.isWin) {
			document.getElementById('zotero-pane-stack').setAttribute('platform', 'win');
		}
		
		// Set the sync tooltip label
		Components.utils.import("resource://zotero/config.js");
		let syncLabel = document.getElementById('zotero-tb-sync-label');
		syncLabel.value = Zotero.getString('sync.syncWith', ZOTERO_CONFIG.DOMAIN_NAME);
		let syncButton = document.querySelector("#zotero-tb-sync");
		syncButton.setAttribute("aria-label", syncLabel.value);
		// Update the aria-description on focus
		syncButton.addEventListener("focus", function (_) {
			Zotero.Sync.Runner.registerSyncStatus(this.firstChild);
			let lastSync = document.querySelector("#zotero-tb-sync-last-sync").value;
			this.setAttribute("aria-description", lastSync || "");
		});
		
		// register an observer for Zotero reload
		observerService = Components.classes["@mozilla.org/observer-service;1"]
					.getService(Components.interfaces.nsIObserverService);
		observerService.addObserver(_reloadObserver, "zotero-reloaded", false);
		observerService.addObserver(_reloadObserver, "zotero-before-reload", false);
		this.addReloadListener(_loadPane);
		
		// continue loading pane
		_loadPane();
		setUpKeyboardNavigation();
	};

	function setUpKeyboardNavigation() {
		let collectionTreeToolbar = this.document.getElementById("zotero-toolbar-collection-tree");
		let itemTreeToolbar = this.document.getElementById("zotero-toolbar-item-tree");
		let titleBar = this.document.getElementById("zotero-title-bar");
		let itemTree = this.document.getElementById("zotero-items-tree");
		let collectionsTree = this.document.getElementById("zotero-collections-tree");
		let tagSelector = this.document.getElementById("zotero-tag-selector");
		let tagContainer = this.document.getElementById('zotero-tag-selector-container');
		let collectionsPane = this.document.getElementById("zotero-collections-pane");

		// function to handle actual focusing based on a given event
		// and a mapping of event targets + keys to the focus destinations
		let moveFocus = function (actionsMap, event, verticalArrowIsTab = false) {
			var key = event.key;
			if (key === 'Tab' && modifierIsNotShift(event)) return;

			if (event.shiftKey) {
				key = 'Shift' + key;
			}
			// ArrowUp or ArrowDown act the same way as as
			// shift-tab/tab unless it is on a menu, in which case
			// it'll open the menu popup
			let isMenu = event.target.getAttribute('type') === 'menu'
						|| event.originalTarget?.getAttribute('type') === 'menu';
			if (isMenu && ['ArrowUp', 'ArrowDown'].includes(key)) {
				return;
			}
			let onInput = event.originalTarget.tagName.toLowerCase() == "input";
			if (verticalArrowIsTab && key == 'ArrowUp' && !onInput) {
				key = 'ShiftTab';
			}
			else if (verticalArrowIsTab && key == 'ArrowDown' && !onInput) {
				key = 'Tab';
			}
			if (key == Zotero.arrowPreviousKey) {
				key = 'ArrowPrevious';
			}
			else if (key == Zotero.arrowNextKey) {
				key = 'ArrowNext';
			}
			// Fetch the focusFunction by target id
			let focusFunction = actionsMap[event.target.id]?.[key];
			// If no function found by target id, try to search by class names
			if (focusFunction === undefined) {
				for (let className of event.target.classList) {
					focusFunction = actionsMap[className]?.[key];
					if (focusFunction) break;
				}
			}
			// If the focusFunction is undefined, nothing was found
			// for this combination of keys, so do nothing
			if (focusFunction === undefined) {
				return;
			}
			// Otherwise, fetch the target to focus on
			let target = focusFunction(event);
			// If returned target is false, focusing was not handled,
			// so fallback to default focus target
			if (target === false) {
				return;
			}
			// If target is undefined, the actionsMap's function
			// handled focus by itself (e.g. by calling .click)
			if (target) {
				// If desired target is hidden/disabled, create a fake event
				// and dispatch it on the hidden target to rerun moveFocus
				// and place focus on the next non-hidden node
				if (target.disabled || target.hidden || target.parentNode.hidden) {
					event.target = target;
					let fakeEventCopy = new KeyboardEvent('keydown', {
						key: event.key,
						shiftKey: event.shiftKey,
						bubbles: true
					});
					target.dispatchEvent(fakeEventCopy);
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				target.focus();
			}
			event.preventDefault();
			event.stopPropagation();
		};

		titleBar.addEventListener("keydown", (event) => {
			let cmdOrCtrlOnly = e => (Zotero.isMac ? (e.metaKey && !e.ctrlKey) : e.ctrlKey) && !e.shiftKey && !e.altKey;

			// Mapping of target ids and possible key presses to desired focus outcomes
			let actionsMap = {
				'zotero-tb-tabs-menu': {
					ArrowNext: () => null,
					ArrowPrevious: () => null,
					Tab: () => document.getElementById('zotero-tb-sync-error'),
					ShiftTab: () => {
						Zotero_Tabs.moveFocus("current");
					},
				},
				'zotero-tb-sync': {
					ArrowNext: () => null,
					ArrowPrevious: () => null,
					Tab: () => {
						if (Zotero_Tabs.selectedIndex > 0) {
							let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
							if (reader) {
								// Move focus to the reader and focus the toolbar
								reader.focusFirst();
								reader.focusToolbar();
							}
							return null;
						}
						if (collectionsPane.getAttribute("collapsed")) {
							return document.getElementById('zotero-tb-add');
						}
						return document.getElementById('zotero-tb-collection-add');
					},
					ShiftTab: () => document.getElementById('zotero-tb-sync-error')
				},
				'zotero-tb-sync-error': {
					ArrowNext: () => null,
					ArrowPrevious: () => null,
					Tab: () => document.getElementById('zotero-tb-sync'),
					ShiftTab: () => document.getElementById('zotero-tb-tabs-menu'),
					Enter: () => document.getElementById("zotero-tb-sync-error")
						.dispatchEvent(new MouseEvent("click", { target: event.target })),
					' ': () => document.getElementById("zotero-tb-sync-error")
						.dispatchEvent(new MouseEvent("click", { target: event.target }))
				},
				tab: {
					// keyboard navigation for tabs. 'tab' is the class, not the id
					Tab: () => document.getElementById('zotero-tb-tabs-menu'),
					ShiftTab: Zotero_Tabs.focusWrapAround,
					ArrowNext: (e) => {
						if (cmdOrCtrlOnly(e)) {
							Zotero_Tabs.moveFocus("next");
						}
						else {
							Zotero_Tabs.selectNext({ keepTabFocused: true });
						}
					},
					ArrowPrevious: (e) => {
						if (cmdOrCtrlOnly(e)) {
							Zotero_Tabs.moveFocus("previous");
						}
						else {
							Zotero_Tabs.selectPrev({ keepTabFocused: true });
						}
					},
					Enter: (e) => {
						Zotero_Tabs.select(e.target.getAttribute('data-id'), false, { keepTabFocused: false });
					},
					' ': (e) => {
						Zotero_Tabs.select(e.target.getAttribute('data-id'), false, { keepTabFocused: false });
					}
				}
			};
			moveFocus(actionsMap, event, true);
		});

		let collectionsSearchField = document.getElementById("zotero-collections-search");
		let clearCollectionSearch = () => {
			// If empty filter - just focus the collectionTree
			if (collectionsSearchField.value.length == 0) {
				return document.getElementById("collection-tree");
			}
			// Clear the search field and focus collection tree
			if (collectionsSearchField.value.length) {
				collectionsSearchField.value = '';
				ZoteroPane.collectionsView.setFilter("", true);
			}
			ZoteroPane.hideCollectionSearch();
			return null;
		};
		let focusCollectionTree = () => {
			// Prevent Enter/Tab pressed before the filtering ran from doing anything
			if (!ZoteroPane.collectionsView.filterEquals(collectionsSearchField.value)) {
				return null;
			}
			// If the current row passes the filter, make sure it is visible and focus collectionTree
			if (ZoteroPane.collectionsView.focusedRowMatchesFilter()) {
				ZoteroPane.collectionsView.ensureRowIsVisible(ZoteroPane.collectionsView.selection.focused);
				return document.getElementById('collection-tree');
			}
			// Otherwise, focus the first row passing the filter
			ZoteroPane.collectionsView.focusFirstMatchingRow(false);
			return null;
		};
		collectionTreeToolbar.addEventListener("keydown", (event) => {
			let actionsMap = {
				'zotero-tb-collection-add': {
					ArrowNext: () => null,
					ArrowPrevious: () => null,
					Tab: () => document.getElementById('zotero-tb-collections-search').click(),
					ShiftTab: () => document.getElementById('zotero-tb-sync')
				},
				'zotero-collections-search': {
					Tab: focusCollectionTree,
					ShiftTab: () => document.getElementById('zotero-tb-collection-add'),
					Enter: focusCollectionTree,
					Escape: clearCollectionSearch
				},
			};
			moveFocus(actionsMap, event, true);
		});

		itemTreeToolbar.addEventListener("keydown", (event) => {
			let actionsMap = {
				'zotero-tb-add': {
					ArrowNext: () => document.getElementById("zotero-tb-lookup"),
					ArrowPrevious: () => null,
					Tab: () => document.getElementById("zotero-tb-search")._searchModePopup.flattenedTreeParentNode.focus(),
					ShiftTab: () => {
						if (collectionsPane.getAttribute("collapsed")) {
							return document.getElementById('zotero-tb-sync');
						}
						if (tagContainer.getAttribute('collapsed') == "true") {
							return focusCollectionTree();
						}
						return document.querySelector("#zotero-tag-selector button");
					}
				},
				'zotero-tb-lookup': {
					ArrowNext: () => document.getElementById("zotero-tb-attachment-add"),
					ArrowPrevious: () => document.getElementById("zotero-tb-add"),
					Tab: () => document.getElementById("zotero-tb-search")._searchModePopup.flattenedTreeParentNode.focus(),
					ShiftTab: () => document.getElementById('zotero-tb-collections-search').click(),
					Enter: () => Zotero_Lookup.showPanel(event.target),
					' ': () => Zotero_Lookup.showPanel(event.target)
				},
				'zotero-tb-attachment-add': {
					ArrowNext: () => document.getElementById("zotero-tb-note-add"),
					ArrowPrevious: () => document.getElementById("zotero-tb-lookup"),
					Tab: () => document.getElementById("zotero-tb-search")._searchModePopup.flattenedTreeParentNode.focus(),
					ShiftTab: () => document.getElementById('zotero-tb-collections-search').click()
				},
				'zotero-tb-note-add': {
					ArrowNext: () => null,
					ArrowPrevious: () => document.getElementById("zotero-tb-attachment-add"),
					Tab: () => document.getElementById("zotero-tb-search")._searchModePopup.flattenedTreeParentNode.focus(),
					ShiftTab: () => document.getElementById('zotero-tb-collections-search').click()
				},
				'zotero-tb-search-textbox': {
					ShiftTab: () => {
						document.getElementById("zotero-tb-search")._searchModePopup.flattenedTreeParentNode.focus();
					},
					Tab: () => itemTree.querySelector(".virtualized-table")
				},
				'zotero-tb-search-dropmarker': {
					ArrowNext: () => null,
					ArrowPrevious: () => null,
					Tab: () => document.getElementById("zotero-tb-search-textbox"),
					ShiftTab: () => document.getElementById('zotero-tb-add')
				}
			};
			moveFocus(actionsMap, event, true);
		});

		collectionsTree.addEventListener("keydown", (event) => {
			let actionsMap = {
				'collection-tree': {
					ShiftTab: () => document.getElementById('zotero-tb-collections-search').click(),
					Tab: () => {
						if (tagContainer.getAttribute('collapsed') == "true") {
							return document.getElementById('zotero-tb-add');
						}
						// If tag selector is collapsed, go to "New item" button, otherwise focus tag selector
						if (ZoteroPane.tagSelector.isTagListEmpty()) {
							return tagSelector.querySelector(".search-input");
						}
						ZoteroPane.tagSelector.focusTagList();
						return null;
					},
					Escape: clearCollectionSearch
				}
			};
			moveFocus(actionsMap, event);
		});

		itemTree.addEventListener("keydown", (event) => {
			let actionsMap = {
				'item-tree-main-default': {
					ShiftTab: () => document.getElementById('zotero-tb-search-textbox')
				}
			};
			moveFocus(actionsMap, event);
		});

		tagSelector.addEventListener("keydown", (e) => {
			let actionsMap = {
				'search-input': {
					Tab: () => tagSelector.querySelector('.tag-selector-actions'),
					ShiftTab: () => {
						if (ZoteroPane.tagSelector.isTagListEmpty()) {
							return document.getElementById("collection-tree");
						}
						ZoteroPane.tagSelector.focusTagList();
						return null;
					},
				},
				'tag-selector-item': {
					Tab: () => tagSelector.querySelector(".search-input"),
					ShiftTab: () => document.getElementById("collection-tree"),
				},
				'tag-selector-actions': {
					Tab: () => document.getElementById('zotero-tb-add'),
					ShiftTab: () => tagSelector.querySelector(".search-input")
				},
				'tag-selector-list': {
					Tab: () => tagSelector.querySelector(".search-input"),
					ShiftTab: () => document.getElementById("collection-tree"),
				}
			};
			moveFocus(actionsMap, e);
		});
	}

	function addFocusHandlers() {
		// When the item type menupopup from itemBoxshows,
		// hide the focus ring around the currently focused element
		document.addEventListener("popupshowing", (e) => {
			if (e.target.tagName == "menupopup" && e.target.parentNode.id == "item-type-menu") {
				document.activeElement.style.setProperty('--width-focus-border', '0');
				document.activeElement.classList.add("hidden-focus");
			}
		});

		// When a panel popup hides, refocus the previous element
		// When a menupopup hides, stop hiding the focus-ring
		document.addEventListener("popuphiding", (e) => {
			if (ZoteroPane.lastFocusedElement && e.target.tagName == "panel"
					&& document.activeElement && e.target.contains(document.activeElement)) {
				ZoteroPane.lastFocusedElement.focus();
			}
			let noFocus = [...document.querySelectorAll(".hidden-focus")];
			for (let node of noFocus) {
				node.style.removeProperty('--width-focus-border');
				node.classList.remove("hidden-focus");
			}
		});
	}

	/**
	 * Called on window load or when pane has been reloaded after switching into or out of connector
	 * mode
	 */
	async function _loadPane() {
		if (!Zotero || !Zotero.initialized) return;
		
		// Set flags for hi-res displays
		Zotero.hiDPI = window.devicePixelRatio > 1;
		Zotero.hiDPISuffix = Zotero.hiDPI ? "@2x" : "";
		
		// Show warning in toolbar for 'dev' channel builds and troubleshooting mode
		try {
			let afterElement = 'zotero-tb-tabs-menu';
			let isDevBuild = Zotero.isDevBuild;
			let isSafeMode = Services.appinfo.inSafeMode;
			// Uncomment to test
			//isDevBuild = true;
			//isSafeMode = true;
			if (isDevBuild || isSafeMode) {
				let label = document.createElement('div');
				label.className = "toolbar-mode-warning";
				let msg = '';
				if (isDevBuild) {
					label.onclick = function () {
						Zotero.launchURL('https://www.zotero.org/support/kb/test_builds');
					};
					msg = 'TEST BUILD — DO NOT USE';
				}
				else if (isSafeMode) {
					label.classList.add('safe-mode');
					label.onclick = function () {
						Zotero.Utilities.Internal.quit(true);
					};
					msg = 'Troubleshooting Mode';
				}
				label.textContent = msg;
				document.getElementById(afterElement).after(label);
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
			
		Zotero_Tabs.init();
		ZoteroContextPane.init();
		await ZoteroPane.initCollectionsTree();
		await ZoteroPane.initItemsTree();
		ZoteroPane.initCollectionTreeSearch();
		
		// Add a default progress window
		ZoteroPane.progressWindow = new Zotero.ProgressWindow({ window });
		
		ZoteroPane.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
		
		Zotero.Keys.windowInit(document);
		
		if (Zotero.restoreFromServer) {
			Zotero.restoreFromServer = false;
			
			setTimeout(function () {
				var ps = Services.prompt;
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
							Zotero.Sync.Runner.updateIcons([]);
							
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
					ZoteroPane_Local.loadURI(ZOTERO_CONFIG.START_URL);
				}, 400);
			}
			Zotero.Prefs.set('firstRun2', false);
			try {
				Zotero.Prefs.clear('firstRun');
			}
			catch (e) {}
		}
		
		if (Zotero.openPane) {
			Zotero.openPane = false;
			setTimeout(function () {
				ZoteroPane_Local.show();
			}, 0);
		}
		
		setTimeout(function () {
			ZoteroPane.setBannerZIndexes();
			ZoteroPane.showPostUpgradeBanner();
			ZoteroPane.showRetractionBanner();
			ZoteroPane.showArchitectureWarning();
			ZoteroPane.initSyncReminders(true);
		});
		
		// TEMP: Clean up extra files from Mendeley imports <5.0.51
		setTimeout(async function () {
			var needsCleanup = await Zotero.DB.valueQueryAsync(
				"SELECT COUNT(*) FROM settings WHERE setting='mImport' AND key='cleanup'"
			)
			if (!needsCleanup) return;
			
			Components.utils.import("chrome://zotero/content/import/mendeley/mendeleyImport.js");
			var importer = new Zotero_Import_Mendeley();
			importer.deleteNonPrimaryFiles();
		}, 10000)
		
		// Restore pane state
		try {
			let state = Zotero.Session.state.windows.find(x => x.type == 'pane');
			if (state) {
				Zotero_Tabs.restoreState(state.tabs);
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		addFocusHandlers();
	}
	
	
	this.initContainers = function () {
		this.initTagSelector();
	};
	
	
	this.uninitContainers = function () {
		if (this.tagSelector) this.tagSelector.uninit();
	};
	
	
	var _lastPrimaryTypes;
	this.updateNewItemTypes = function () {
		var primaryTypes = Zotero.ItemTypes.getPrimaryTypes();
		var primaryTypesJoined = primaryTypes.join(',');
		if (_lastPrimaryTypes == primaryTypesJoined) {
			return;
		}
		
		var addMenu = document.getElementById('zotero-tb-add').firstElementChild;
		
		// Remove all nodes so we can regenerate
		addMenu.replaceChildren();
		
		// Primary types from MRU
		let primaryItemTypes = primaryTypes.map((type) => {
			return {
				id: type.id,
				name: type.name,
				localized: Zotero.ItemTypes.getLocalizedString(type.id)
			};
		});
		// Item types not in the MRU list
		let secondaryItemTypes = Zotero.ItemTypes.getSecondaryTypes().map((type) => {
			return {
				id: type.id,
				name: type.name,
				localized: Zotero.ItemTypes.getLocalizedString(type.id)
			};
		});

		let allItemTypes = [...primaryItemTypes, ...secondaryItemTypes];
		
		var collation = Zotero.getLocaleCollation();
		primaryItemTypes.sort(function (a, b) {
			return collation.compareString(1, a.localized, b.localized);
		});
		allItemTypes.sort(function (a, b) {
			return collation.compareString(1, a.localized, b.localized);
		});
		// The array of all item types with MRU prepended to the top
		let itemTypes = primaryItemTypes.concat(allItemTypes);
		for (let itemType of itemTypes) {
			let menuitem = document.createXULElement("menuitem");
			menuitem.setAttribute("label", itemType.localized);
			menuitem.setAttribute("tooltiptext", "");
			let type = itemType.id;
			menuitem.addEventListener("command", function () {
				ZoteroPane.newItem(type, {}, null, true);
			});
			addMenu.appendChild(menuitem);
			// Add a separator between primary and secondary types
			if (addMenu.childElementCount == primaryItemTypes.length) {
				let separator = document.createXULElement("menuseparator");
				addMenu.appendChild(separator);
			}
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
		
		this.serializePersist();

		if(this.collectionsView) this.collectionsView.unregister();
		if(this.itemsView) this.itemsView.unregister();
		if (_syncRemindersObserverID) {
			Zotero.Notifier.unregisterObserver(_syncRemindersObserverID);
		}
		
		this.uninitContainers();
		
		observerService.removeObserver(_reloadObserver, "zotero-reloaded");
		
		ZoteroContextPane.destroy();

		if (!Zotero.getZoteroPanes().length) {
			Zotero.Session.setLastClosedZoteroPaneState(this.getState());
		}

		Zotero_Tabs.closeAll();
	}
	
	/**
	 * Called before Zotero pane is to be made visible
	 * @return {Boolean} True if Zotero pane should be loaded, false otherwise (if an error
	 * 		occurred)
	 */
	this.makeVisible = Zotero.Promise.coroutine(function* () {
		if (Zotero.locked) {
			Zotero.showZoteroPaneProgressMeter();
		}
		
		yield Zotero.unlockPromise;
		
		// The items pane is hidden initially to avoid showing column lines
		Zotero.hideZoteroPaneOverlays();
		
		// If pane not loaded, load it or display an error message
		if (!ZoteroPane_Local.loaded) {
			ZoteroPane_Local.init();
		}
		
		// If Zotero could not be initialized, display an error message and return
		if (!Zotero || Zotero.skipLoading || Zotero.crashed) {
			this.displayStartupError();
			return false;
		}
		
		_madeVisible = true;

		this.unserializePersist();
		this.updateLayout();
		this.initContainers();
		
		// Focus the quicksearch on pane open
		var searchBar = document.getElementById('zotero-tb-search');
		setTimeout(function () {
			searchBar.searchTextbox.select();
		}, 1);
		
		//
		// TEMP: Remove after people are no longer upgrading from Zotero for Firefox
		//
		var showFxProfileWarning = false;
		var pref = 'firstRun.skipFirefoxProfileAccessCheck';
		if (Zotero.fxProfileAccessError != undefined && Zotero.fxProfileAccessError) {
			showFxProfileWarning = true;
		}
		else if (!Zotero.Prefs.get(pref)) {
			showFxProfileWarning = !(yield Zotero.Profile.checkFirefoxProfileAccess());
		}
		if (showFxProfileWarning) {
			Zotero.uiReadyPromise.delay(2000).then(function () {
				var ps = Services.prompt;
				var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
				var text = "Zotero was unable to access your Firefox profile to check for "
					+ "existing Zotero data.\n\n"
					+ "If you’ve upgraded from Zotero 4.0 for Firefox and don’t see the data "
					+ "you expect, it may be located elsewhere on your computer. "
					+ "Click “More Information” for help restoring your previous data.\n\n"
					+ "If you’re new to Zotero, you can ignore this message.";
				var url = 'https://www.zotero.org/support/kb/data_missing_after_zotero_5_upgrade';
				var dontShowAgain = {};
				let index = ps.confirmEx(null,
					Zotero.getString('general.warning'),
					text,
					buttonFlags,
					Zotero.getString('general.moreInformation'),
					"Ignore",
					null,
					Zotero.getString('general.dontShowAgain'),
					dontShowAgain
				);
				if (dontShowAgain.value) {
					Zotero.Prefs.set(pref, true)
				}
				if (index == 0) {
					this.loadURI(url);
				}
			}.bind(this));
		}
		// Once we successfully find it once, don't bother checking again
		else {
			Zotero.Prefs.set(pref, true);
		}
		
		if (Zotero.proxyFailure) {
			try {
				Zotero.Sync.Runner.updateIcons(Zotero.proxyFailure);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		
		// Auto-sync on pane open or if new account
		if (Zotero.Prefs.get('sync.autoSync') || Zotero.initAutoSync) {
			yield Zotero.proxyAuthComplete;
			yield Zotero.uiReadyPromise;
			
			if (!Zotero.Sync.Runner.enabled) {
				Zotero.debug('Sync not enabled -- skipping auto-sync', 4);
			}
			else if (Zotero.Sync.Runner.syncInProgress) {
				Zotero.debug('Sync already running -- skipping auto-sync', 4);
			}
			else if (Zotero.Sync.Server.manualSyncRequired) {
				Zotero.debug('Manual sync required -- skipping auto-sync', 4);
			}
			else if (showFxProfileWarning) {
				Zotero.debug('Firefox profile access error -- skipping initial auto-sync', 4);
			}
			else {
				Zotero.Sync.Runner.sync({
					background: true
				}).then(() => Zotero.initAutoSync = false);
			}
		}
		
		// Set sync icon to spinning if there's an existing sync
		//
		// We don't bother setting an existing error state at open
		if (Zotero.Sync.Runner.syncInProgress) {
			Zotero.Sync.Runner.updateIcons('animate');
		}
		
		return true;
	});
	
	
	function isFullScreen() {
		return document.getElementById('zotero-pane-stack').getAttribute('fullscreenmode') == 'true';
	}
	
	/**
	 * Capturing listener to handle shortcut-related keypresses when we need
	 * to be sure that the events are not handled by any other lower-level component.
	 * E.g. tab navigation hotkeys should work regardless of which component is focused.
	 */
	function captureKeyDown(event) {
		ZoteroPane.lastKeyPress = (event.shiftKey ? "Shift" : "") + event.key;
		const cmdOrCtrlOnly = Zotero.isMac
			? (event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey)
			: (event.ctrlKey && !event.shiftKey && !event.altKey);
		
		// Close current tab
		if (event.key == 'w') {
			if (cmdOrCtrlOnly) {
				if (Zotero_Tabs.selectedIndex > 0) {
					Zotero_Tabs.close();
					event.preventDefault();
					event.stopPropagation();
				}
				return;
			}
		}

		// Undo closed tabs
		if ((Zotero.isMac && event.metaKey || !Zotero.isMac && event.ctrlKey)
				&& event.shiftKey && !event.altKey && event.key.toLowerCase() == 't') {
			Zotero_Tabs.undoClose();
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		
		// Tab navigation: Ctrl-PageUp / PageDown
		// TODO: Select across tabs without selecting with Ctrl-Shift, as in Firefox?
		if (event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
			if (event.key == 'PageUp') {
				Zotero_Tabs.selectPrev();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			else if (event.key == 'PageDown') {
				Zotero_Tabs.selectNext();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
		}
		
		// Tab navigation: Cmd-Shift-[ / ]
		// Common shortcut on macOS, but typically only supported on that platform to match OS
		// conventions users expect from other macOS apps.
		if (Zotero.isMac) {
			if (event.metaKey && event.shiftKey && !event.altKey && !event.ctrlKey) {
				if (event.key == '[') {
					Zotero_Tabs.selectPrev();
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				else if (event.key == ']') {
					Zotero_Tabs.selectNext();
					event.preventDefault();
					event.stopPropagation();
					return;
				}
			}
			else if (event.metaKey && event.altKey) {
				if (event.key == Zotero.arrowPreviousKey) {
					Zotero_Tabs.selectPrev();
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				else if (event.key == Zotero.arrowNextKey) {
					Zotero_Tabs.selectNext();
					event.preventDefault();
					event.stopPropagation();
					return;
				}
			}
		}
		
		// Tab navigation: Ctrl-Tab / Ctrl-Shift-Tab
		if (event.ctrlKey && !event.altKey && !event.metaKey && event.key == 'Tab') {
			if (event.shiftKey) {
				Zotero_Tabs.selectPrev();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			else {
				Zotero_Tabs.selectNext();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
		}
		
		// Tab navigation: CmdOrCtrl-1 through 9
		// Jump to tab N (or to the last tab if there are less than N tabs)
		// CmdOrCtrl-9 is specially defined to jump to the last tab no matter how many there are.
		if (cmdOrCtrlOnly) {
			let tabNumberMatch = event.code.match(TAB_NUMBER_CODE_RE);
			if (tabNumberMatch) {
				let tabNumber = tabNumberMatch[1];
				switch (tabNumber) {
					case '1':
					case '2':
					case '3':
					case '4':
					case '5':
					case '6':
					case '7':
					case '8':
						Zotero_Tabs.jump(parseInt(tabNumber) - 1);
						event.preventDefault();
						event.stopPropagation();
						return;
					case '9':
						Zotero_Tabs.selectLast();
						event.preventDefault();
						event.stopPropagation();
						return;
				}
			}
		}
	}
	
	/*
	 * Bubbling listener for navigation or shortcuts keydown events that should be
	 * handled only if no lower-level element overrode it by stopping event propagation.
	 * E.g. Escape when reader is opened refocuses the scrollable area of the reader. This should
	 * not happen if Escape was pressed when a menupopup is opened - just let menupopup handle the
	 * Escape and close the popup.
	 */
	function handleKeyDown(event, from) {
		if (Zotero_Tabs.selectedIndex > 0) {
			// Escape from outside of the reader will focus reader's scrollable area
			if (event.key === 'Escape') {
				if (!document.activeElement.classList.contains('reader')) {
					let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
					if (reader) {
						reader.focus();
					}
				}
			}
			// Tab into the reader from outside of it (e.g. from the contextPane)
			// will focus the scrollable area
			else if (event.key === 'Tab') {
				if (!document.activeElement.classList.contains('reader')) {
					setTimeout(() => {
						if (document.activeElement.classList.contains('reader')) {
							let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
							if (reader) {
								reader.focus();
							}
						}
					});
				}
			}
		}
		
		let tgt = event.target;
		if ([" ", "Enter"].includes(event.key)
			&& (["button", "toolbarbutton"].includes(tgt.tagName)
				|| tgt.classList.contains("keyboard-clickable"))) {
			event.target.click();
			// Some menus have a history of not opening on programmatic click
			// If event.target.click above worked, this will be a noop.
			if (event.target.menupopup) {
				event.target.open = true;
			}
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		try {
			// Ignore keystrokes outside of Zotero pane
			if (!(event.originalTarget.ownerDocument instanceof HTMLDocument)) {
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
			// We use Control (17) on Windows and Linux because Alt triggers the menubar;
			// On Mac, we use Option (18)
			let enableHighlight = false;
			if (Zotero.isMac) {
				enableHighlight = !event.shiftKey && !event.metaKey && event.key == "Alt" && !event.ctrlKey;
			}
			else {
				enableHighlight = !event.shiftKey && !event.metaKey && event.key == "Control" && !event.altKey;
			}
			let isItemTreeFocused = document.activeElement.id == "item-tree-main-default";
			// Only highlight collections when itemTree is focused to try to avoid
			// conflicts with other shortcuts
			if (enableHighlight && isItemTreeFocused) {
				// On windows, the event is re-triggered multiple times
				// for as long as Control is held.
				// To account for that, stop if a highlight timer already exists.
				if (this.highlightTimer) {
					return;
				}
				this.highlightTimer = Components.classes["@mozilla.org/timer;1"].
					createInstance(Components.interfaces.nsITimer);
				// {} implements nsITimerCallback
				this.highlightTimer.initWithCallback({
					notify: () => this._setHighlightedRowsCallback()
				}, 225, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
			}
			// If anything but Ctlr/Options was pressed, most likely a different shortcut using Ctlr/Options
			// is being used (e.g. Ctrl-Shift-A on windows). In that case, stop highlighting
			else if ((Zotero.isMac && event.altKey) || (!Zotero.isMac && event.ctrlKey)) {
				if (this.highlightTimer) {
					this.highlightTimer.cancel();
					this.highlightTimer = null;
				}
				ZoteroPane.collectionsView.setHighlightedRows();
			}
		}
	}
	
	this.handleBlur = (event) => {
		// If one tabs through the item/context pane all the way to the end and
		// the focus leaves the pane, wrap it around to refocus the selected tab
		let itemPane = document.getElementById("zotero-item-pane");
		let contextPane = document.getElementById("zotero-context-pane");
		let loosingFocus = event.target;
		let receivingFocus = event.relatedTarget;
		let itemPaneLostFocus = itemPane.contains(loosingFocus) && !itemPane.contains(receivingFocus);
		let contextPaneLostFocus = contextPane.contains(loosingFocus) && !contextPane.contains(receivingFocus);
		// Do not do anything if the window lost focus or if the last
		// keypress was anything but a Tab. That way, it won't interfere with other navigation such as
		// Shift-tab from the header into the itemsView.
		if (Services.focus.activeWindow === window && this.lastKeyPress === "Tab"
			&& (itemPaneLostFocus || contextPaneLostFocus)) {
			// event.relatedTarget is null when moving focus in or out of <iframe> or <browser>
			// so make sure to not refocus tabs when focusing inside of note-editor or reader
			if (receivingFocus) {
				Zotero_Tabs.moveFocus("current");
			}
			this.lastKeyPress = null;
		}
		// When focus shifts, unless we are inside of a panel, save
		// the last focused element to be able to return focus to it when the panel closes
		if (!event.target.closest("panel")) {
			this.lastFocusedElement = event.target;
			// Special treatment to focus on quick-search dropmarker inside of the shadow DOM
			if (this.lastFocusedElement.id == "zotero-tb-search-dropmarker") {
				this.lastFocusedElement = document.getElementById("zotero-tb-search")._searchModePopup.parentElement;
			}
		}
		if (this.highlightTimer) {
			this.highlightTimer.cancel();
			this.highlightTimer = null;
		}
		ZoteroPane_Local.collectionsView.setHighlightedRows();
	}

	this.hideCollectionSearch = function () {
		let collectionSearchField = document.getElementById("zotero-collections-search");
		let collectionSearchButton = document.getElementById("zotero-tb-collections-search");
		if (!collectionSearchField.value.length && collectionSearchField.classList.contains("visible")) {
			collectionSearchField.classList.remove("visible");
			collectionSearchField.setAttribute("disabled", true);
			setTimeout(() => {
				collectionSearchButton.style.display = '';
				collectionSearchField.style.visibility = 'hidden';
				collectionSearchField.style.removeProperty('max-width');
			}, 50);
		}
	}

	this.initCollectionTreeSearch = function () {
		let collectionSearchField = document.getElementById("zotero-collections-search");
		let collectionSearchButton = document.getElementById("zotero-tb-collections-search");
		collectionSearchField.style.visibility = 'hidden';
		collectionSearchField.addEventListener("blur", ZoteroPane.hideCollectionSearch);
		collectionSearchButton.addEventListener("click", (_) => {
			if (!collectionSearchField.classList.contains("visible")) {
				collectionSearchButton.style.display = 'none';
				// If the collectionPane is narrow, set smaller max-width
				let maxWidth = collectionSearchField.getAttribute("data-expanded-width");
				if (maxWidth) {
					collectionSearchField.style.maxWidth = `${maxWidth}px`;
				}
				collectionSearchField.style.visibility = 'visible';
				collectionSearchField.classList.add("visible", "expanding");
				// Enable and focus the field only after it was revealed to prevent the cursor
				// from changing between 'text' and 'pointer' back and forth as the input field expands
				setTimeout(() => {
					collectionSearchField.removeAttribute("disabled");
					collectionSearchField.classList.remove("expanding");
					collectionSearchField.focus();
				}, 250);
				return;
			}
			collectionSearchField.focus();
		});
	};

	
	function handleKeyUp(event) {
		// When Option/Control is released, clear collection highlighting
		if ((Zotero.isMac && event.key == "Alt")
				|| (!Zotero.isMac && event.key == "Control")) {
			if (this.highlightTimer) {
				this.highlightTimer.cancel();
				this.highlightTimer = null;
			}
			ZoteroPane_Local.collectionsView.setHighlightedRows();
			return;
		}
	}
	
	
	this.handleClose = function (event) {
		// Don't close the window from the first tab if other tabs are open
		if (Zotero_Tabs.numTabs > 1) {
			return;
		}
		window.close();
	};
	
	
	/*
	 * Highlights collections containing selected items on Ctrl (Win) or
	 * Option/Alt (Mac/Linux) press
	 */
	this._setHighlightedRowsCallback = async function () {
		var objects = this.getSelectedObjects();
		
		// If no items or an unreasonable number, don't try
		if (!objects.length || objects.length > 100) return;
		
		var collections = objects.filter(o => o instanceof Zotero.Collection);
		var items = objects.filter(o => o instanceof Zotero.Item);
		
		// Get parent collections of collections
		var toHighlight = [];
		for (let collection of collections) {
			if (collection.parentID) {
				toHighlight.push(collection.parentID);
			}
		}
		// Get collections containing items
		toHighlight.push(...await Zotero.Collections.getCollectionsContainingItems(
			items.map(x => x.id),
			true
		));
		var treeViewIDs = toHighlight.map(id => 'C' + id);
		var userLibraryID = Zotero.Libraries.userLibraryID;
		// If no collections selected and every item is in My Publications, highlight that
		var allInPublications = !collections.length && items.every((item) => {
			return item.libraryID == userLibraryID && item.inPublications;
		});
		if (allInPublications) {
			treeViewIDs.push("P" + Zotero.Libraries.userLibraryID);
		}
		if (treeViewIDs.length) {
			await this.collectionsView.setHighlightedRows(treeViewIDs);
		}
	};
	
	
	function handleKeyPress(event) {
		var from = event.originalTarget.id;
		
		if (Zotero.locked) {
			event.preventDefault();
			return;
		}

		if (this.itemsView && from == this.itemsView.id) {
			// Focus TinyMCE explicitly on tab key, since the normal focusing doesn't work right
			if (!event.shiftKey && event.keyCode == event.DOM_VK_TAB) {
				if (ZoteroPane.itemPane.mode == "note") {
					document.getElementById('zotero-note-editor').focus();
					event.preventDefault();
					return;
				}
			}
			else if ((event.keyCode == event.DOM_VK_BACK_SPACE && Zotero.isMac) ||
					event.keyCode == event.DOM_VK_DELETE) {
				// If Cmd/Shift delete, use forced mode, which does different
				// things depending on the context
				var force = event.metaKey || (!Zotero.isMac && event.shiftKey);
				ZoteroPane_Local.deleteSelectedItems(force);
				event.preventDefault();
				return;
			}
		}
		
		var command = Zotero.Keys.getCommand(event.key);
		if (!command) {
			return;
		}

		// Ignore modifiers other than Ctrl-Shift/Cmd-Shift
		if (!((Zotero.isMac ? event.metaKey : event.ctrlKey) && event.shiftKey)) {
			return;
		}
		
		Zotero.debug('Keyboard shortcut: ' + command);
		
		// Errors don't seem to make it out otherwise
		try {
			switch (command) {
				case 'library':
					document.getElementById(ZoteroPane.collectionsView.id).focus();
					break;
				case 'quicksearch':
					document.getElementById('zotero-tb-search-textbox').select();
					break;
				case 'newItem':
					(async function () {
						// Default to most recent item type from here or the New Type menu,
						// or fall back to 'book'
						var mru = Zotero.Prefs.get('newItemTypeMRU');
						var type = mru ? mru.split(',')[0] : 'book';
						await ZoteroPane.newItem(Zotero.ItemTypes.getID(type));
						let itemBox = document.getElementById('zotero-editpane-info-box');
						// Ensure itemBox is opened
						itemBox.open = true;
						var menu = itemBox.itemTypeMenu;
						// If the new item's type is changed immediately, update the MRU
						var handleTypeChange = function () {
							this.addItemTypeToNewItemTypeMRU(Zotero.ItemTypes.getName(menu.getAttribute('value')));
							itemBox.removeHandler('itemtypechange', handleTypeChange);
						}.bind(this);
						// Don't update the MRU on subsequent opens of the item type menu
						var removeTypeChangeHandler = function () {
							itemBox.removeHandler('itemtypechange', handleTypeChange);
							itemBox.itemTypeMenu.firstChild.removeEventListener('popuphiding', removeTypeChangeHandler);
						};
						itemBox.addHandler('itemtypechange', handleTypeChange);
						itemBox.itemTypeMenu.firstChild.addEventListener('popuphiding', removeTypeChangeHandler);
						
						Services.focus.setFocus(menu, Services.focus.FLAG_SHOWRING);
						itemBox.itemTypeMenu.menupopup.openPopup(menu, "before_start", 0, 0);
					}.bind(this)());
					break;
				case 'newNote':
					// If a regular item is selected, use that as the parent.
					// If a child item is selected, use its parent as the parent.
					// Otherwise create a standalone note.
					var parentKey = false;
					var items = ZoteroPane_Local.getSelectedItems();
					if (items.length == 1) {
						if (items[0].isRegularItem()) {
							parentKey = items[0].key;
						}
						else {
							parentKey = items[0].parentItemKey;
						}
					}
					// Use key that's not the modifier as the popup toggle
					ZoteroPane_Local.newNote(event.altKey, parentKey);
					break;
				case 'sync':
					Zotero.Sync.Runner.sync();
					break;
				case 'saveToZotero':
					var collectionTreeRow = this.getCollectionTreeRow();
					if (collectionTreeRow.isFeedsOrFeed()) {
						this.itemPane.translateSelectedItems();
					} else {
						Zotero.debug(command + ' does not do anything in non-feed views')
					}
					break;
				case 'toggleAllRead':
					var collectionTreeRow = this.getCollectionTreeRow();
					if (collectionTreeRow.isFeed()) {
						this.markFeedRead();
					}
					break;
				case 'toggleRead':
					// Toggle read/unread
					let row = this.getCollectionTreeRow();
					if (!row || !row.isFeedsOrFeed()) return;
					this.toggleSelectedItemsRead();
					if (itemReadPromise) {
						itemReadPromise.cancel();
						itemReadPromise = null;
					}
					break;
				
				// Handled by <key>s in standalone.js, pointing to <command>s in zoteroPane.xul,
				// which are enabled or disabled by this.updateQuickCopyCommands(), called by
				// this.itemSelected()
				case 'copySelectedItemCitationsToClipboard':
				case 'copySelectedItemsToClipboard':
					return;
				
				default:
					throw new Error('Command "' + command + '" not found in ZoteroPane_Local.handleKeyPress()');
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
	this.newItem = Zotero.Promise.coroutine(function* (typeID, data, row, manual)
	{
		if ((row === undefined || row === null) && this.getCollectionTreeRow()) {
			row = this.collectionsView.selection.focused;
			
			// Make sure currently selected view is editable
			if (!this.canEdit(row)) {
				this.displayCannotEditLibraryMessage();
				return;
			}
		}
		
		yield this.itemPane.handleBlur();
		
		if (row !== undefined && row !== null) {
			var collectionTreeRow = this.collectionsView.getRow(row);
			var libraryID = collectionTreeRow.ref.libraryID;
		}
		else {
			var libraryID = Zotero.Libraries.userLibraryID;
			var collectionTreeRow = null;
		}
		
		let itemID;
		yield Zotero.DB.executeTransaction(async function () {
			var item = new Zotero.Item(typeID);
			item.libraryID = libraryID;
			for (var i in data) {
				item.setField(i, data[i]);
			}
			itemID = await item.save();
			
			if (collectionTreeRow && collectionTreeRow.isCollection()) {
				await collectionTreeRow.ref.addItem(itemID);
			}
		});
		
		// Expand the item pane if it's closed
		if (this.itemPane.getAttribute("collapsed") == "true") {
			this.itemPane.setAttribute("collapsed", false);
		}
		
		//set to Info tab
		document.getElementById('zotero-view-item').selectedIndex = 0;
		
		// Ensure item is visible
		yield this.selectItem(itemID);

		if (manual) {
			// Update most-recently-used list for New Item menu
			this.addItemTypeToNewItemTypeMRU(Zotero.ItemTypes.getName(typeID));
			let itemBox = ZoteroPane.itemPane.querySelector("info-box");
			// Make sure the item box is opened
			itemBox.open = true;
			// Focus the title field
			itemBox.getTitleField().focus();
		}
		
		return Zotero.Items.getAsync(itemID);
	});
	
	
	this.addItemTypeToNewItemTypeMRU = function (itemType) {
		if (!itemType) {
			throw new Error(`Item type not provided`);
		}
		var mru = Zotero.Prefs.get('newItemTypeMRU');
		if (mru) {
			var mru = mru.split(',');
			var pos = mru.indexOf(itemType);
			if (pos != -1) {
				mru.splice(pos, 1);
			}
			mru.unshift(itemType);
		}
		else {
			var mru = [itemType];
		}
		Zotero.Prefs.set('newItemTypeMRU', mru.slice(0, 5).join(','));
	}
	
	
	this.newCollection = async function (parentKey = null) {
		if (!this.canEditLibrary()) {
			this.displayCannotEditLibraryMessage();
			return null;
		}
		
		var libraryID = this.getSelectedLibraryID();
		
		// Get a unique "Untitled" name for this level in the collection hierarchy
		var collections;
		var parentCollectionID = null;
		if (parentKey) {
			let parent = Zotero.Collections.getIDFromLibraryAndKey(libraryID, parentKey);
			collections = Zotero.Collections.getByParent(parent);
			parentCollectionID = parent;
		}
		else {
			collections = Zotero.Collections.getByLibrary(libraryID);
		}
		var prefix = Zotero.getString('pane.collections.untitled');
		var name = Zotero.Utilities.Internal.getNextName(
			prefix,
			collections.map(c => c.name).filter(n => n.startsWith(prefix))
		);
		
		var io = { name, libraryID, parentCollectionID };
		window.openDialog("chrome://zotero/content/newCollectionDialog.xhtml",
			"_blank", "chrome,modal,centerscreen,resizable=no", io);
		var dataOut = io.dataOut;
		if (!dataOut) {
			return null;
		}
		
		if (!dataOut.name) {
			dataOut.name = name;
		}
		
		var collection = new Zotero.Collection();
		collection.libraryID = dataOut.libraryID;
		collection.name = dataOut.name;
		collection.parentID = dataOut.parentCollectionID;
		return collection.saveTx();
	};
	
	this.importFeedsFromOPML = async function (event) {
		while (true) {
			let fp = new FilePicker();
			fp.init(window, Zotero.getString('fileInterface.importOPML'), fp.modeOpen);
			fp.appendFilter(Zotero.getString('fileInterface.OPMLFeedFilter'), '*.opml; *.xml');
			fp.appendFilters(fp.filterAll);
			if (await fp.show() == fp.returnOK) {
				var contents = await Zotero.File.getContentsAsync(fp.file);
				var success = await Zotero.Feeds.importFromOPML(contents);
				if (success) {
					return true;
				}
				// Try again
				Zotero.alert(window, Zotero.getString('general.error'), Zotero.getString('fileInterface.unsupportedFormat'));
			} else {
				return false;
			}
		}
	};
	
	
	this.newFeedFromURL = Zotero.Promise.coroutine(function* () {
		let data = {};
		window.openDialog('chrome://zotero/content/feedSettings.xhtml',
			null, 'centerscreen, modal', data);
		if (!data.cancelled) {
			let feed = new Zotero.Feed();
			feed.url = data.url;
			feed.name = data.title;
			feed.refreshInterval = data.ttl;
			feed.cleanupReadAfter = data.cleanupReadAfter;
			feed.cleanupUnreadAfter = data.cleanupUnreadAfter;
			yield feed.saveTx();
			yield feed.updateFeed();
		}
	});
	
	this.newGroup = function () {
		this.loadURI(Zotero.Groups.addGroupURL);
	}
	
	
	this.newSearch = Zotero.Promise.coroutine(function* () {
		if (Zotero.DB.inTransaction()) {
			yield Zotero.DB.waitForTransaction();
		}
		
		var libraryID = this.getSelectedLibraryID();
		
		var s = new Zotero.Search();
		s.libraryID = libraryID;
		s.addCondition('title', 'contains', '');
		
		var searches = yield Zotero.Searches.getAll(libraryID)
		var prefix = Zotero.getString('pane.collections.untitled');
		var name = Zotero.Utilities.Internal.getNextName(
			prefix,
			searches.map(s => s.name).filter(n => n.startsWith(prefix))
		);
		
		var io = { dataIn: { search: s, name }, dataOut: null };
		window.openDialog('chrome://zotero/content/searchDialog.xhtml','','chrome,modal,centerscreen',io);
		if (!io.dataOut) {
			return false;
		}
		s.fromJSON(io.dataOut.json);
		yield s.saveTx();
		return s.id;
	});
	
	this.setVirtual = function(libraryID, type, show, select) {
		return this.collectionsView.toggleVirtualCollection(libraryID, type, show, select);
	};
	
	this.openAdvancedSearchWindow = function () {
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
		window.openDialog('chrome://zotero/content/advancedSearch.xhtml', '', 'chrome,dialog=no,centerscreen', io);
	};

	this.initItemsTree = async function () {
		try {
			const ItemTree = require('zotero/itemTree');
			var itemsTree = document.getElementById('zotero-items-tree');
			ZoteroPane.itemsView = await ItemTree.init(itemsTree, {
				id: "main",
				dragAndDrop: true,
				persistColumns: true,
				columnPicker: true,
				onSelectionChange: selection => ZoteroPane.itemSelected(selection),
				onContextMenu: (...args) => ZoteroPane.onItemsContextMenuOpen(...args),
				onActivate: (event, items) => ZoteroPane.onItemTreeActivate(event, items),
				emptyMessage: Zotero.getString('pane.items.loading')
			});
			ZoteroPane.itemsView.onRefresh.addListener(() => ZoteroPane.setTagScope());
			ZoteroPane.itemsView.waitForLoad().then(() => Zotero.uiIsReady());

			ItemTreeMenuBar.setItemTreeSortKeys(ZoteroPane.itemsView);
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug(e, 1);
		}
	}

	this.initCollectionsTree = async function () {
		try {
			const CollectionTree = require('zotero/collectionTree');
			var collectionsTree = document.getElementById('zotero-collections-tree');
			ZoteroPane.collectionsView = await CollectionTree.init(collectionsTree, {
				onSelectionChange: prevSelection => ZoteroPane.onCollectionSelected(prevSelection),
				onContextMenu: (...args) => ZoteroPane.onCollectionsContextMenuOpen(...args),
				dragAndDrop: true
			});
			collectionsTree.firstChild.addEventListener("focus", ZoteroPane.collectionsView.recordCollectionTreeFocus);
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug(e, 1);
		}
	};

	this.initTagSelector = async function () {
		try {
			var container = document.getElementById('zotero-tag-selector-container');
			if (!container.hasAttribute('collapsed') || container.getAttribute('collapsed') == 'false') {
				this.tagSelector = await Zotero.TagSelector.init(
					document.getElementById('zotero-tag-selector'),
					{
						container: 'zotero-tag-selector-container',
						onSelection: this.updateTagFilter.bind(this),
					}
				);
				// Occasionally, when the app is first opened, the scrollable tag list doesn't
				// occupy the full height of the tag selector. This ensures that it occupies all
				// available space.
				setTimeout(() => {
					this.tagSelector.handleResize();
				}, 100);
			}
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug(e, 1);
		}
	};
	
	
	this.handleTagSelectorResize = Zotero.Utilities.debounce(function() {
		if (this.tagSelectorShown()) {
			// Initialize if dragging open after startup
			if (!this.tagSelector) {
				this.initTagSelector();
				this.setTagScope();
			}
			this.tagSelector.handleResize();
		}
		if (this.collectionsView) {
			this.collectionsView.updateHeight();
		}
	}, 100);
	
	
	/*
	 * Sets the tag filter on the items view
	 */
	this.updateTagFilter = Zotero.Promise.coroutine(function* () {
		if (this.itemsView) {
			yield this.itemsView.setFilter('tags', ZoteroPane_Local.tagSelector.getTagSelection());
		}
	});
	
	
	// Keep in sync with ZoteroStandalone.updateViewOption()
	this.toggleTagSelector = function () {
		var container = document.getElementById('zotero-tag-selector-container');
		var showing = container.getAttribute('collapsed') == 'true';
		container.setAttribute('collapsed', !showing);
		
		// If showing, set scope to items in current view
		// and focus filter textbox
		if (showing) {
			this.initTagSelector();
			ZoteroPane.tagSelector.focusTextbox();
			this.setTagScope();
		}
		// If hiding, clear selection
		else {
			ZoteroPane.tagSelector.uninit();
			ZoteroPane.tagSelector = null;
		}
	};
	
	
	this.tagSelectorShown = function () {
		var collectionTreeRow = this.getCollectionTreeRow();
		if (!collectionTreeRow) return;
		var tagSelector = document.getElementById('zotero-tag-selector-container');
		return !tagSelector.hasAttribute('collapsed')
			|| tagSelector.getAttribute('collapsed') == 'false';
	};
	
	
	/*
	 * Set the tags scope to the items in the current view
	 *
	 * Passed to the items tree to trigger on changes
	 */
	this.setTagScope = function () {
		var collectionTreeRow = self.getCollectionTreeRow();
		if (self.tagSelectorShown()) {
			if (collectionTreeRow.editable) {
				ZoteroPane_Local.tagSelector.setMode('edit');
			}
			else {
				ZoteroPane_Local.tagSelector.setMode('view');
			}
			ZoteroPane_Local.tagSelector.onItemViewChanged({
				libraryID: collectionTreeRow.ref && collectionTreeRow.ref.libraryID,
				collectionTreeRow
			});
		}
	};
	
	
	this.onCollectionSelected = Zotero.serial(async function () {
		var collectionTreeRow = this.getCollectionTreeRow();
		if (!collectionTreeRow) {
			Zotero.debug('ZoteroPane.onCollectionSelected: No selected collection found');
			return;
		}
		
		if (this.itemsView && this.itemsView.collectionTreeRow && this.itemsView.collectionTreeRow.id == collectionTreeRow.id) {
			Zotero.debug("ZoteroPane.onCollectionSelected: Collection selection hasn't changed");

			// Update enabled actions, in case editability has changed
			this._updateEnabledActionsForRow(collectionTreeRow);
			return;
		}
		
		// Rename tab
		Zotero_Tabs.rename('zotero-pane', collectionTreeRow.getName());
		
		let type = Zotero.Libraries.get(collectionTreeRow.ref.libraryID).libraryType;
		
		// Clear quick search and tag selector when switching views
		document.getElementById('zotero-tb-search-textbox').value = "";
		if (ZoteroPane.tagSelector) {
			ZoteroPane.tagSelector.clearTagSelection();
		}
		
		collectionTreeRow.setSearch('');
		if (ZoteroPane.tagSelector) {
			collectionTreeRow.setTags(ZoteroPane.tagSelector.getTagSelection());
		}
		
		this._updateEnabledActionsForRow(collectionTreeRow);

		// If item data not yet loaded for library, load it now.
		// Other data types are loaded at startup
		if (collectionTreeRow.isFeeds()) {
			var feedsToLoad = Zotero.Feeds.getAll().filter(feed => !feed.getDataLoaded('item'));
			if (feedsToLoad.length) {
				Zotero.debug("Waiting for items to load for feeds " + feedsToLoad.map(feed => feed.libraryID));
				ZoteroPane_Local.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
				for (let feed of feedsToLoad) {
					await feed.waitForDataLoad('item');
				}
			}
		}
		else {
			var library = Zotero.Libraries.get(collectionTreeRow.ref.libraryID);
			if (!library.getDataLoaded('item')) {
				Zotero.debug("Waiting for items to load for library " + library.libraryID);
				ZoteroPane_Local.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
				await library.waitForDataLoad('item');
			}
		}
		
		this.itemsView.changeCollectionTreeRow(collectionTreeRow);
		
		Zotero.Prefs.set('lastViewedFolder', collectionTreeRow.id);
	});
	
	
	/**
	 * Enable or disable toolbar icons, menu options, and commands as necessary
	 */
	this._updateEnabledActionsForRow = function (collectionTreeRow) {
		const disableIfNoEdit = [
			"menu_newItem",
			"cmd_zotero_addByIdentifier",
			"menu_attachmentAdd",
			"menu_noteAdd",
			
			"cmd_zotero_newCollection",
			"cmd_zotero_newSavedSearch",
			"cmd_zotero_import",
			"cmd_zotero_importFromClipboard",
			
			"cmd_zotero_newStandaloneFileAttachment",
			"cmd_zotero_newStandaloneLinkedFileAttachment",
			"cmd_zotero_newChildFileAttachment",
			"cmd_zotero_newChildLinkedFileAttachment",
			"cmd_zotero_newChildURLAttachment",
			"cmd_zotero_newStandaloneNote",
			"cmd_zotero_newChildNote",
			
			"zotero-tb-add",
			"zotero-tb-lookup",
			"zotero-tb-attachment-add",
			"zotero-tb-note-add",
		];
		for (let i = 0; i < disableIfNoEdit.length; i++) {
			let command = disableIfNoEdit[i];
			let el = document.getElementById(command);
			if (!el) continue;
			
			// If a trash is selected, new collection depends on the
			// editability of the library
			if (collectionTreeRow.isTrash() && command == 'cmd_zotero_newCollection') {
				var overrideEditable = Zotero.Libraries.get(collectionTreeRow.ref.libraryID).editable;
			}
			else {
				var overrideEditable = false;
			}
			
			// Don't allow normal buttons in My Publications, because things need to
			// be dragged and go through the wizard
			let forceDisable = collectionTreeRow.isPublications()
				&& command != 'cmd_zotero_newCollection'
				&& command != 'zotero-tb-note-add';
			
			if ((collectionTreeRow.editable || overrideEditable) && !forceDisable) {
				if(el.hasAttribute("disabled")) el.removeAttribute("disabled");
			} else {
				el.setAttribute("disabled", "true");
			}
		}
	};
	
	
	this.getCollectionTreeRow = function () {
		return this.collectionsView && this.collectionsView.selection.count
			&& this.collectionsView.getRow(this.collectionsView.selection.focused);
	}
	
	
	/**
	 * @return {Promise<Boolean>} - Promise that resolves to true if an item was selected,
	 *                              or false if not (used for tests, though there could possibly
	 *                              be a better test for whether the item pane changed)
	 */
	this.itemSelected = function () {
		return Zotero.Promise.coroutine(function* () {
			if (!this.itemsView || !this.itemsView.selection) {
				Zotero.debug("Items view not available in itemSelected", 2);
				return false;
			}
			let collectionTreeRow = this.getCollectionTreeRow();
			// I don't think this happens in normal usage, but it can happen during tests
			if (!collectionTreeRow) {
				return false;
			}
			
			var selectedItems = this.itemsView.getSelectedObjects();
			
			// Display buttons at top of item pane depending on context. This needs to run even if the
			// selection hasn't changed, because the selected items might have been modified.
			this.itemPane.data = selectedItems;
			this.itemPane.collectionTreeRow = collectionTreeRow;
			this.itemPane.itemsView = this.itemsView;
			this.itemPane.editable = this.collectionsView.editable;
			this.itemPane.updateItemPaneButtons(selectedItems);
			
			// Tab selection observer in standalone.js makes sure that
			// updateQuickCopyCommands is called
			if (Zotero_Tabs.selectedType == 'library') {
				this.updateQuickCopyCommands(selectedItems);
			}
			
			// Check if selection has actually changed. The onselect event that calls this
			// can be called in various situations where the selection didn't actually change,
			// such as whenever selectEventsSuppressed is set to false.
			var ids = selectedItems.map(item => item.id);
			ids.sort();
			if (ids.length && Zotero.Utilities.arrayEquals(_lastSelectedItems, ids)) {
				return false;
			}
			_lastSelectedItems = ids;
			
			return this.itemPane.render();
		}.bind(this))()
		.catch((e) => {
			Zotero.logError(e);
			Zotero.crash();
			throw e;
		});
	}
	
	this.updateAddAttachmentMenu = function (popup) {
		if (!this.canEdit()) {
			for (let node of popup.childNodes) {
				if (node.tagName == 'menuitem') {
					node.disabled = true;
				}
			}
			return;
		}
		
		var items = ZoteroPane.getSelectedItems();
		var oneItemSelected = items.length == 1 && items[0].isRegularItem();
		var canEditFiles = this.canEditFiles();
		var commandsEnabled = [
			['cmd_zotero_newStandaloneFileAttachment', canEditFiles],
			['cmd_zotero_newStandaloneLinkedFileAttachment', canEditFiles],
			['cmd_zotero_newChildFileAttachment', oneItemSelected && canEditFiles],
			['cmd_zotero_newChildLinkedFileAttachment', oneItemSelected && canEditFiles],
			['cmd_zotero_newChildURLAttachment', oneItemSelected],
		];
		for (let command of commandsEnabled) {
			document.getElementById(command[0]).setAttribute('disabled', !command[1]);
		}
	};
	
	/**
	 * @return {Promise}
	 */
	this.updateNewNoteMenu = function () {
		var items = ZoteroPane_Local.getSelectedItems();
		var cmd = document.getElementById('cmd_zotero_newChildNote');
		cmd.setAttribute("disabled", !this.canEdit() ||
			!(items.length == 1 && (items[0].isRegularItem() || !items[0].isTopLevelItem())));
	};
	
	/**
	 * Update the <command> elements that control the shortcut keys and the enabled state of the
	 * "Copy Citation"/"Copy Bibliography"/"Copy as"/"Copy Note" menu options. When disabled, the shortcuts are
	 * still caught in handleKeyPress so that we can show an alert about not having references selected.
	 */
	this.updateQuickCopyCommands = function (selectedItems) {
		let canCopy = false;
		// If all items are notes/attachments and at least one note is not empty
		if (selectedItems.every(item => item.isNote() || item.isAttachment())) {
			if (selectedItems.some(item => item.note)) {
				canCopy = true;
			}
		}
		else {
			let format = Zotero.QuickCopy.getFormatFromURL(Zotero.QuickCopy.lastActiveURL);
			format = Zotero.QuickCopy.unserializeSetting(format);
			if (format.mode == 'bibliography') {
				canCopy = selectedItems.some(item => item.isRegularItem());
			}
			else {
				canCopy = true;
			}
		}
		
		document.getElementById('cmd_zotero_copyCitation').setAttribute('disabled', !canCopy);
		document.getElementById('cmd_zotero_copyBibliography').setAttribute('disabled', !canCopy);
	};
	
	
	/**
	 * @return {Promise}
	 */
	this.reindexItem = Zotero.Promise.coroutine(function* () {
		var items = this.getSelectedItems();
		if (!items) {
			return;
		}
		
		var itemIDs = [];

		for (var i=0; i<items.length; i++) {
			itemIDs.push(items[i].id);
		}
		
		yield Zotero.FullText.indexItems(itemIDs, { complete: true });
		yield document.getElementById('zotero-attachment-box').updateItemIndexedState();
	});
	
	
	/**
	 * @return {Promise<Zotero.Item>} - The new Zotero.Item
	 */
	this.duplicateSelectedItem = Zotero.Promise.coroutine(function* () {
		var self = this;
		if (!self.canEdit()) {
			self.displayCannotEditLibraryMessage();
			return;
		}
		
		var item = self.getSelectedItems()[0];
		if (item.isNote()
			&& !(yield Zotero.Notes.ensureEmbeddedImagesAreAvailable(item))
			&& !Zotero.Notes.promptToIgnoreMissingImage()) {
			return;
		}
		
		var newItem;
		
		yield Zotero.DB.executeTransaction(async function () {
			newItem = item.clone();
			// If in a collection, add new item to it
			if (self.getCollectionTreeRow().isCollection() && newItem.isTopLevelItem()) {
				newItem.setCollections([self.getCollectionTreeRow().ref.id]);
			}
			await newItem.save();
			if (item.isNote() && Zotero.Libraries.get(newItem.libraryID).filesEditable) {
				await Zotero.Notes.copyEmbeddedImages(item, newItem);
			}
			for (let relItemKey of item.relatedItems) {
				try {
					let relItem = await Zotero.Items.getByLibraryAndKeyAsync(item.libraryID, relItemKey);
					if (relItem.addRelatedItem(newItem)) {
						await relItem.save({
							skipDateModifiedUpdate: true
						});
					}
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		});
		
		yield self.selectItem(newItem.id);
		
		return newItem;
	});
	

	this.duplicateAndConvertSelectedItem = async function () {
		if (this.getSelectedItems().length != 1
				|| !['book', 'bookSection'].includes(this.getSelectedItems()[0].itemType)) {
			throw new Error('duplicateAndConvertSelectedItem requires a single book or bookSection to be selected');
		}

		let authorCreatorType = Zotero.CreatorTypes.getID('author');
		let bookAuthorCreatorType = Zotero.CreatorTypes.getID('bookAuthor');
		
		let original = this.getSelectedItems()[0];
		let duplicate = await this.duplicateSelectedItem();
		if (!duplicate) return null;
		
		// TODO: Move this logic to duplicateSelectedItem() with a `targetItemType` flag to avoid
		// extra saves?
		if (duplicate.itemType == 'book') {
			duplicate.setType(Zotero.ItemTypes.getID('bookSection'));
			for (let i = 0; i < duplicate.numCreators(); i++) {
				let creator = duplicate.getCreator(i);
				if (creator.creatorTypeID == authorCreatorType) {
					creator.creatorTypeID = bookAuthorCreatorType;
				}
				duplicate.setCreator(i, creator);
			}
			// Remove related-item relations to other book sections of this book
			for (let relItemKey of [...duplicate.relatedItems]) {
				let relItem = await Zotero.Items.getByLibraryAndKeyAsync(
					duplicate.libraryID, relItemKey
				);
				if (relItem.itemType == 'bookSection'
						&& relItem.getField('bookTitle') == original.getField('title')) {
					duplicate.removeRelatedItem(relItem);
					relItem.removeRelatedItem(duplicate);
					await relItem.saveTx();
				}
			}
		}
		else {
			duplicate.setField('title', false); // So bookTitle becomes title
			duplicate.setType(Zotero.ItemTypes.getID('book'));
			// Get creators from the original item because setType() will have changed the types
			let creators = original.getCreators()
				// Remove authors of the individual book section
				.filter(creator => creator.creatorTypeID !== authorCreatorType);
			for (let creator of creators) {
				if (creator.creatorTypeID == bookAuthorCreatorType) {
					creator.creatorTypeID = authorCreatorType;
				}
			}
			duplicate.setCreators(creators);
		}
		
		duplicate.setField('abstractNote', '');

		duplicate.addRelatedItem(original);
		original.addRelatedItem(duplicate);
		
		await original.saveTx({ skipDateModifiedUpdate: true });
		await duplicate.saveTx();
		
		ZoteroPane.itemPane.querySelector("info-box").getTitleField().focus();
		return duplicate;
	};
	

	/**
	 * Return whether every selected item can be deleted from the current
	 * collection context (library, trash, collection, etc.).
	 *
	 * @return {Boolean}
	 */
	this.canDeleteSelectedItems = function () {
		let collectionTreeRow = this.getCollectionTreeRow();
		if (collectionTreeRow.isTrash()) {
			for (let index of this.itemsView.selection.selected) {
				while (index != -1 && !this.itemsView.getRow(index).ref.deleted) {
					index = this.itemsView.getParentIndex(index);
				}
				if (index == -1) {
					return false;
				}
			}
		}
		else if (collectionTreeRow.isShare()) {
			return false;
		}
		return true;
	};

	
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
		var collectionTreeRow = this.getCollectionTreeRow();
		
		if (!collectionTreeRow.isTrash() && !collectionTreeRow.isBucket() && !this.canEdit()) {
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
		var toRemove = {
			title: Zotero.getString('pane.items.remove.title'),
			text: Zotero.getString(
				'pane.items.remove' + (this.itemsView.selection.count > 1 ? '.multiple' : '')
			)
		};

		if (!this.canDeleteSelectedItems()) {
			return;
		}
		
		if (collectionTreeRow.isPublications()) {
			let toRemoveFromPublications = {
				title: Zotero.getString('pane.items.removeFromPublications.title'),
				text: Zotero.getString(
					'pane.items.removeFromPublications' + (this.itemsView.selection.count > 1 ? '.multiple' : '')
				)
			};
			var prompt = force ? toTrash : toRemoveFromPublications;
		}
		else if (collectionTreeRow.isLibrary(true)
				|| collectionTreeRow.isSearch()
				|| collectionTreeRow.isUnfiled()
				|| collectionTreeRow.isRetracted()
				|| collectionTreeRow.isDuplicates()) {
			// In library, don't prompt if meta key was pressed
			var prompt = (force && !fromMenu) ? false : toTrash;
		}
		else if (collectionTreeRow.isCollection()) {
			if (force) {
				var prompt = toTrash;
			}
			else {
				// Ignore unmodified action if only child items are selected
				if (this.itemsView.getSelectedItems().every(item => !item.isTopLevelItem())) {
					return;
				}

				// If unmodified, recursiveCollections is true, and items are in
				// descendant collections (even if also in the selected collection),
				// prompt to remove from all
				if (Zotero.Prefs.get('recursiveCollections')) {
					let descendants = collectionTreeRow.ref.getDescendents(false, 'collection');
					let inSubcollection = descendants
						.some(({ id }) => this.itemsView.getSelectedItems()
							.some(item => item.inCollection(id)));
					if (inSubcollection) {
						var prompt = {
							title: Zotero.getString('pane.items.removeRecursive.title'),
							text: Zotero.getString(
								'pane.items.removeRecursive' + (this.itemsView.selection.count > 1 ? '.multiple' : '')
							)
						};
					}
					else {
						var prompt = toRemove;
					}
				}
				else {
					var prompt = toRemove;
				}
			}
		}
		else if (collectionTreeRow.isTrash() || collectionTreeRow.isBucket()) {
			var prompt = toDelete;
		}
		
		if (!prompt || Services.prompt.confirm(window, prompt.title, prompt.text)) {
			this.itemsView.deleteSelection(force);
		}
	}
	
	
	this.mergeSelectedItems = function () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		this.itemPane.mode = "duplicates";
		
		// Initialize the merge pane with the selected items
		this.itemPane._duplicatesPane.setItems(this.getSelectedItems());
	};
	
	
	this.deleteSelectedCollection = function (deleteItems) {
		var collectionTreeRow = this.getCollectionTreeRow();
		
		// Don't allow deleting libraries or My Publications
		if (collectionTreeRow.isLibrary(true) && !collectionTreeRow.isFeed()
				|| collectionTreeRow.isPublications()) {
			return;
		}
		
		// Remove virtual duplicates collection
		if (collectionTreeRow.isDuplicates()) {
			this.setVirtual(collectionTreeRow.ref.libraryID, 'duplicates', false);
			return;
		}
		// Remove virtual unfiled collection
		else if (collectionTreeRow.isUnfiled()) {
			this.setVirtual(collectionTreeRow.ref.libraryID, 'unfiled', false);
			return;
		}
		// Remove virtual retracted collection
		else if (collectionTreeRow.isRetracted()) {
			this.setVirtual(collectionTreeRow.ref.libraryID, 'retracted', false);
			return;
		}
		
		if (!this.canEdit() && !collectionTreeRow.isFeedsOrFeed()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		
		var ps = Services.prompt;
		buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
		if (this.getCollectionTreeRow()) {
			var title, message;
			// Work out the required title and message
			if (collectionTreeRow.isCollection()) {
				if (deleteItems) {
					title = Zotero.getString('pane.collections.deleteWithItems.title');
					message = Zotero.getString('pane.collections.deleteWithItems');
				}
				else {
					title = Zotero.getString('pane.collections.delete.title');
					message = Zotero.getString('pane.collections.delete')
							+ "\n\n"
							+ Zotero.getString('pane.collections.delete.keepItems');
				}
			}
			else if (collectionTreeRow.isFeed()) {
				title = Zotero.getString('pane.feed.deleteWithItems.title');
				message = Zotero.getString('pane.feed.deleteWithItems');
			}
			else if (collectionTreeRow.isSearch()) {
				title = Zotero.getString('pane.collections.deleteSearch.title');
				message = Zotero.getString('pane.collections.deleteSearch');
			}
			
			// Display prompt
			var index = ps.confirmEx(
				null,
				title,
				message,
				buttonFlags,
				title,
				"", "", "", {}
			);
			if (index == 0) {
				return this.collectionsView.deleteSelection(deleteItems);
			}
		}
	}

	/**
	 * Check whether every selected item can be restored from trash
	 *
	 * @return {Boolean}
	 */
	this.canRestoreSelectedItems = function () {
		let collectionTreeRow = this.getCollectionTreeRow();
		if (!collectionTreeRow.isTrash()) {
			return false;
		}

		return this.getSelectedObjects().some(o => o.deleted);
	};
	
	
	/**
	 * @return {Promise}
	 */
	this.restoreSelectedItems = async function () {
		let selectedObjects = this.getSelectedObjects();
		if (!selectedObjects.length) {
			return;
		}

		let isSelected = object => selectedObjects.includes(object);

		await Zotero.DB.executeTransaction(async () => {
			for (let row = 0; row < this.itemsView.rowCount; row++) {
				// Only look at top-level items
				if (this.itemsView.getLevel(row) !== 0) {
					continue;
				}

				let parent = this.itemsView.getRow(row).ref;
				let childIDs = [];
				let subcollections = [];
				if (parent instanceof Zotero.Collection) {
					// If the restored item is a collection, restore its subcollections too
					if (isSelected(parent)) {
						subcollections = parent.getDescendents(false, 'collection', true).map(col => col.id);
					}
				}
				else {
					if (!parent.isNote()) {
						childIDs.push(...parent.getNotes(true));
					}
					if (!parent.isAttachment()) {
						childIDs.push(...parent.getAttachments(true));
					}
				}
				let childItems = Zotero.Items.get(childIDs);
				if (isSelected(parent)) {
					if (parent.deleted) {
						parent.deleted = false;
						await parent.save();
					}

					let noneSelected = !childItems.some(isSelected);
					let allChildren = childItems.concat(Zotero.Collections.get(subcollections));
					for (let child of allChildren) {
						if ((noneSelected || isSelected(child)) && child.deleted) {
							child.deleted = false;
							await child.save();
						}
					}
				}
				else {
					for (let child of childItems) {
						if (isSelected(child) && child.deleted) {
							child.deleted = false;
							await child.save();
						}
					}
				}
			}
		});
	};
	
	
	/**
	 * @return {Promise}
	 */
	this.emptyTrash = Zotero.Promise.coroutine(function* () {
		var libraryID = this.getSelectedLibraryID();
		
		var result = Services.prompt.confirm(
			null,
			"",
			Zotero.getString('pane.collections.emptyTrash') + "\n\n"
				+ Zotero.getString('general.actionCannotBeUndone')
		);
		if (result) {
			Zotero.showZoteroPaneProgressMeter(null, true);
			try {
				let deletedSearches = yield Zotero.Searches.getDeleted(libraryID, true);
				yield Zotero.Searches.erase(deletedSearches);
				let deletedCollections = yield Zotero.Collections.getDeleted(libraryID, true);
				yield Zotero.Collections.erase(deletedCollections);
				let deleted = yield Zotero.Items.emptyTrash(
					libraryID,
					{
						onProgress: (progress, progressMax) => {
							var percentage = Math.round((progress / progressMax) * 100);
							Zotero.updateZoteroPaneProgressMeter(percentage);
						}
					}
				);
			}
			finally {
				Zotero.hideZoteroPaneOverlays();
			}
			yield Zotero.purgeDataObjects();
		}
	});
	
	
	// Currently only works on searches
	this.duplicateSelectedCollection = async function () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}

		var row = this.getCollectionTreeRow();
		if (!row) {
			return;
		}
		
		let o = row.ref.clone();
		o.name = await row.ref.ObjectsClass.getNextName(row.ref.libraryID, o.name);
		await o.saveTx();
	};
	
	
	this.editSelectedCollection = Zotero.Promise.coroutine(function* () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}

		var row = this.getCollectionTreeRow();
		if (row) {
			if (row.isCollection()) {
				this.collectionsView.startEditing(row);
			}
			else {
				let s = row.ref.clone();
				let groups = [];
				// Promises don't work in the modal dialog, so get the group name here, if
				// applicable, and pass it in. We only need the group that this search belongs
				// to, if any, since the library drop-down is disabled for saved searches.
				if (Zotero.Libraries.get(s.libraryID).libraryType == 'group') {
					groups.push(Zotero.Groups.getByLibraryID(s.libraryID));
				}
				var io = {
					dataIn: {
						search: s,
						name: row.getName(),
						groups: groups
					},
					dataOut: null
				};
				window.openDialog('chrome://zotero/content/searchDialog.xhtml','','chrome,modal,centerscreen',io);
				if (io.dataOut) {
					row.ref.fromJSON(io.dataOut.json);
					yield row.ref.saveTx();
					Zotero_Tabs.rename("zotero-pane", row.ref.name);
				}
			}
		}
	});

	// Move selected collection to specified target collection or library.
	// Target has to be in the same library as the currently selected collection.
	this.moveCollection = async (target) => {
		let selected = this.getSelectedCollection();
		if (!selected) return;

		if (target.libraryID !== selected.libraryID) {
			throw new Error("Moving collections is only possible within the same library.");
		}
		if (target instanceof Zotero.Library) {
			selected.parentID = null;
		}
		else {
			selected.parentID = target.id;
		}
		
		await selected.saveTx();
	};

	// Copy selected collection into another collection or library.
	// Partially, a replication of drag-drop mechanism from CollectionTree.onDrop.
	this.copyCollection = async (target) => {
		let selected = this.getSelectedCollection();
		if (!selected) return;

		let targetTreeRowID = `L${target.libraryID}`;
		if (target instanceof Zotero.Collection) {
			targetTreeRowID = `C${target.id}`;
			// Make sure the row is actually visible
			await ZoteroPane.collectionsView.expandToCollection(target.id);
		}
		let targetTreeRowIndex = ZoteroPane.collectionsView.getRowIndexByID(targetTreeRowID);
		let targetTreeRow = ZoteroPane.collectionsView.getRow(targetTreeRowIndex);
		let copyOptions = {
			tags: Zotero.Prefs.get('groups.copyTags'),
			childNotes: Zotero.Prefs.get('groups.copyChildNotes'),
			childLinks: Zotero.Prefs.get('groups.copyChildLinks'),
			childFileAttachments: Zotero.Prefs.get('groups.copyChildFileAttachments'),
			annotations: Zotero.Prefs.get('groups.copyAnnotations'),
		};
		ZoteroPane.collectionsView.executeCollectionCopy({
			collection: selected,
			targetCollectionID: target instanceof Zotero.Collection ? target.id : null,
			targetLibraryID: target.libraryID,
			targetTreeRow,
			copyOptions
		});
	};

	this.toggleSelectedItemsRead = Zotero.Promise.coroutine(function* () {
		yield Zotero.FeedItems.toggleReadByID(this.getSelectedItems(true));
	});

	this.markFeedRead = Zotero.Promise.coroutine(function* () {
		var row = this.getCollectionTreeRow();
		if (!row) return;

		let feeds = row.isFeeds() ? Zotero.Feeds.getAll() : [row.ref];
		for (let feed of feeds) {
			let feedItemIDs = yield Zotero.FeedItems.getAll(feed.libraryID, true, false, true);
			yield Zotero.FeedItems.toggleReadByID(feedItemIDs, true);
		}
	});

	
	this.editSelectedFeed = Zotero.Promise.coroutine(function* () {
		var row = this.getCollectionTreeRow();
		if (!row) return;
		
		let feed = row.ref;
		let data = {
			url: feed.url,
			title: feed.name,
			ttl: feed.refreshInterval,
			cleanupReadAfter: feed.cleanupReadAfter,
			cleanupUnreadAfter: feed.cleanupUnreadAfter
		};
		
		window.openDialog('chrome://zotero/content/feedSettings.xhtml',
			null, 'centerscreen, modal', data);
		if (data.cancelled) return;
		
		feed.name = data.title;
		feed.refreshInterval = data.ttl;
		feed.cleanupReadAfter = data.cleanupReadAfter;
		feed.cleanupUnreadAfter = data.cleanupUnreadAfter;
		yield feed.saveTx();
		Zotero_Tabs.rename("zotero-pane", feed.name);
	});
	
	this.refreshFeed = function() {
		var row = this.getCollectionTreeRow();
		if (!row) return;
		
		let feed = row.ref;
		
		return feed.updateFeed();
	}
	
	
	this.copySelectedItemsToClipboard = function (asCitations) {
		var items = [];
		let itemIDs = this.getSelectedItems(true);
		// Get selected item IDs in the item tree order
		itemIDs = this.getSortedItems(true).filter(id => itemIDs.includes(id));
		items = Zotero.Items.get(itemIDs);
		
		if (!items.length) {
			return;
		}
		
		var format = Zotero.QuickCopy.getFormatFromURL(Zotero.QuickCopy.lastActiveURL);
		if (items.every(item => item.isNote() || item.isAttachment())) {
			format = Zotero.QuickCopy.getNoteFormat();
		}
		format = Zotero.QuickCopy.unserializeSetting(format);
		
		// In bibliography mode, remove notes and attachments
		if (format.mode == 'bibliography') {
			items = items.filter(item => item.isRegularItem());
		}
		
		// DEBUG: We could copy notes via keyboard shortcut if we altered
		// Z_F_I.copyItemsToClipboard() to use Z.QuickCopy.getContentFromItems(),
		// but 1) we'd need to override that function's drag limit and 2) when I
		// tried it the OS X clipboard seemed to be getting text vs. HTML wrong,
		// automatically converting text/html to plaintext rather than using
		// text/unicode. (That may be fixable, however.)
		//
		// This isn't currently shown, because the commands are disabled when not relevant, so this
		// function isn't called
		if (!items.length) {
			Services.prompt.alert(null, "", Zotero.getString("fileInterface.noReferencesError"));
			return;
		}
		
		// determine locale preference
		var locale = format.locale ? format.locale : Zotero.Prefs.get('export.quickCopy.locale');
		
		if (format.mode == 'bibliography') {
			Zotero_File_Interface.copyItemsToClipboard(
				items, format.id, locale, format.contentType == 'html', asCitations
			);
		}
		else if (format.mode == 'export') {
			// Copy citations doesn't work in export mode
			if (asCitations) {
				return;
			}
			else {
				Zotero_File_Interface.exportItemsToClipboard(items, format);
			}
		}
	}
	
	
	this.clearQuicksearch = Zotero.Promise.coroutine(function* () {
		var search = document.getElementById('zotero-tb-search');
		if (search.searchTextbox.value !== '') {
			search.searchTextbox.value = '';
			yield this.search();
			return true;
		}
		return false;
	});
	
	
	/**
	 * Some keys trigger an immediate search
	 */
	this.handleSearchKeypress = function (textbox, event) {
		if (event.keyCode == event.DOM_VK_ESCAPE) {
			if (textbox.searchTextbox.value) {
				textbox.searchTextbox.value = '';
				this.search();
			}
			else {
				this.itemsView?.focus();
			}
		}
		else if (event.keyCode == event.DOM_VK_RETURN) {
			this.search(true);
		}
	}


	this.handleCollectionSearchInput = function () {
		let collectionsSearchField = document.getElementById("zotero-collections-search");
		this.collectionsView.setFilter(collectionsSearchField.value);
		// Make sure that the filter ends up being hidden if the value is cleared
		// after the blur event fires. This happens on windows on cross icon click.
		if (collectionsSearchField.value.length == 0
				&& document.activeElement !== collectionsSearchField) {
			this.hideCollectionSearch();
		}
	}
	
	
	this.handleSearchInput = function (textbox, event) {
		if (textbox.searchTextbox.value.indexOf('"') != -1) {
			this.setItemsPaneMessage(Zotero.getString('advancedSearchMode'));
		}
	}
	
	
	/**
	 * @return {Promise}
	 */
	this.search = Zotero.Promise.coroutine(function* (runAdvanced) {
		if (!this.itemsView) {
			return;
		}
		var search = document.getElementById('zotero-tb-search');
		var searchVal = search.searchTextbox.value;
		if (!runAdvanced && searchVal.indexOf('"') != -1) {
			return;
		}
		var spinner = document.getElementById('zotero-tb-search-spinner');
		spinner.setAttribute("status", "animate");
		spinner.style.visibility = 'visible';
		yield this.itemsView.setFilter('search', searchVal);
		spinner.style.removeProperty("visibility");
		spinner.removeAttribute("status");
		if (runAdvanced) {
			this.clearItemsPaneMessage();
		}
	});
	
	
	this.sync = function () {
		if (Zotero.Sync.Runner.syncInProgress) {
			Zotero.Sync.Runner.stop();
		}
		else {
			this.hideSyncReminder();

			Zotero.Sync.Server.canAutoResetClient = true;
			Zotero.Sync.Server.manualSyncRequired = false;
			Zotero.Sync.Runner.sync();
		}
	};


	var _syncRemindersObserverID = null;
	this.initSyncReminders = function (startup) {
		if (startup) {
			Zotero.Notifier.registerObserver(
				{
					notify: (event) => {
						// When the API Key is deleted we need to add an observer
						if (event === 'delete') {
							Zotero.Prefs.set('sync.reminder.setUp.enabled', true);
							Zotero.Prefs.set('sync.reminder.setUp.lastDisplayed', Math.round(Date.now() / 1000));
							ZoteroPane.initSyncReminders(false);
						}
						// When API Key is added we can remove the observer
						else if (event === 'add') {
							ZoteroPane.initSyncReminders(false);
						}
					}
				},
				'api-key');
		}

		// If both reminders are disabled, we don't need an observer
		if (!Zotero.Prefs.get('sync.reminder.setUp.enabled')
				&& !Zotero.Prefs.get('sync.reminder.autoSync.enabled')) {
			if (_syncRemindersObserverID) {
				Zotero.Notifier.unregisterObserver(_syncRemindersObserverID);
				_syncRemindersObserverID = null;
			}
			return;
		}

		// If we are syncing and auto-syncing then no need for observer
		if (Zotero.Sync.Runner.enabled && Zotero.Prefs.get('sync.autoSync')) {
			if (_syncRemindersObserverID) {
				Zotero.Notifier.unregisterObserver(_syncRemindersObserverID);
				_syncRemindersObserverID = null;
			}
			return;
		}

		// If we already have an observer don't add another one
		if (_syncRemindersObserverID) {
			return;
		}

		const eventTypes = ['add', 'modify', 'delete'];
		_syncRemindersObserverID = Zotero.Notifier.registerObserver(
			{
				notify: (event) => {
					if (!eventTypes.includes(event)) {
						return;
					}
					setTimeout(() => {
						this.showSetUpSyncReminder();
						this.showAutoSyncReminder();
					}, 5000);
				}
			},
			'item',
			'syncReminder');
	};


	this.showSetUpSyncReminder = function () {
		const sevenDays = 60 * 60 * 24 * 7;

		// Reasons not to show reminder:
		// - User turned reminder off
		// - Sync is enabled
		if (!Zotero.Prefs.get('sync.reminder.setUp.enabled')
				|| Zotero.Sync.Runner.enabled) {
			return;
		}

		// Check lastDisplayed was 7+ days ago
		let lastDisplayed = Zotero.Prefs.get('sync.reminder.setUp.lastDisplayed');
		if (lastDisplayed > Math.round(Date.now() / 1000) - sevenDays) {
			return;
		}

		this.showSyncReminder('setUp', { learnMoreURL: ZOTERO_CONFIG.SYNC_INFO_URL });
	};


	this.showAutoSyncReminder = function () {
		const sevenDays = 60 * 60 * 24 * 7;

		// Reasons not to show reminder:
		// - User turned reminder off
		// - Sync is not enabled
		// - Auto-Sync is enabled
		// - Last sync for all libraries was within 7 days
		if (!Zotero.Prefs.get('sync.reminder.autoSync.enabled')
				|| !Zotero.Sync.Runner.enabled
				|| Zotero.Prefs.get('sync.autoSync')
				|| Zotero.Libraries.getAll()
					.every(library => !library.syncable
						|| (library.lastSync
							&& library.lastSync.getTime() > Date.now() - 1000 * sevenDays))) {
			return;
		}

		// Check lastDisplayed was 7+ days ago
		let lastDisplayed = Zotero.Prefs.get('sync.reminder.autoSync.lastDisplayed');
		if (lastDisplayed > Math.round(Date.now() / 1000) - sevenDays) {
			return;
		}
		
		this.showSyncReminder('autoSync');
	};


	/**
	 * Configure the UI and show the sync reminder panel for a given type of reminder
	 *
	 * @param {String} reminderType - Possible values: 'setUp' or 'autoSync'
	 * @param {Object} [options]
	 * @param {String} [options.learnMoreURL] - Show "Learn More" link to this URL
	 */
	this.showSyncReminder = function (reminderType, options = {}) {
		if (!['setUp', 'autoSync'].includes(reminderType)) {
			throw new Error(`Invalid reminder type: ${reminderType}`);
		}

		let panel = document.getElementById('sync-reminder-container');
		panel.setAttribute('data-reminder-type', reminderType);

		let message = document.getElementById('sync-reminder-message');
		message.textContent = Zotero.getString(`sync.reminder.${reminderType}.message`, Zotero.appName);

		let actionLink = document.getElementById('sync-reminder-action');
		switch (reminderType) {
			case 'autoSync':
				var actionStr = Zotero.getString('general.enable');
				break;
			
			default:
				var actionStr = Zotero.getString(`sync.reminder.${reminderType}.action`);
				break;
		}
		actionLink.textContent = actionStr;
		actionLink.onclick = () => {
			this.hideSyncReminder();

			switch (reminderType) {
				case 'setUp':
					Zotero.Utilities.Internal.openPreferences('zotero-prefpane-sync');
					break;
				case 'autoSync':
					Zotero.Prefs.set(`sync.autoSync`, true);
					break;
			}
		};

		let learnMoreLink = document.getElementById('sync-reminder-learn-more');
		learnMoreLink.textContent = Zotero.getString('general.learnMore');
		learnMoreLink.hidden = !options.learnMoreURL;
		learnMoreLink.onclick = () => Zotero.launchURL(options.learnMoreURL);
		
		let dontShowAgainLink = document.getElementById('sync-reminder-disable');
		dontShowAgainLink.textContent = Zotero.getString('general.dontAskAgain');
		dontShowAgainLink.onclick = () => {
			this.hideSyncReminder();
			Zotero.Prefs.set(`sync.reminder.${reminderType}.enabled`, false);
			// Check if we no longer need to observe item modifications
			ZoteroPane.initSyncReminders(false);
		};

		let remindMeLink = document.getElementById('sync-reminder-remind');
		remindMeLink.textContent = Zotero.getString('general.remindMeLater');
		remindMeLink.onclick = () => this.hideSyncReminder();

		let closeButton = document.getElementById('sync-reminder-close');
		closeButton.onclick = () => this.hideSyncReminder();

		panel.removeAttribute('collapsed');
	};


	/**
	 * Hide the currently displayed sync reminder and update its associated
	 * lastDisplayed time.
	 */
	this.hideSyncReminder = function () {
		let panel = document.getElementById('sync-reminder-container');
		let reminderType = panel.getAttribute('data-reminder-type');
		panel.setAttribute('collapsed', true);
		panel.removeAttribute('data-reminder-type');

		if (['setUp', 'autoSync'].includes(reminderType)) {
			Zotero.Prefs.set(`sync.reminder.${reminderType}.lastDisplayed`, Math.round(Date.now() / 1000));
		}
	};


	this.selectItem = async function (itemID, options) {
		if (!itemID) {
			return false;
		}
		return this.selectItems([itemID], options);
	};
	
	
	this.selectItems = async function (itemIDs, options = {}) {
		if (typeof options == "boolean") {
			Zotero.warn("ZoteroPane.selectItems() now takes an 'options' object -- update your code");
			options = { inLibraryRoot: options };
		}
		let { inLibraryRoot, noTabSwitch } = options;
		if (!itemIDs.length) {
			return false;
		}
		
		var items = await Zotero.Items.getAsync(itemIDs);
		if (!items.length) {
			return false;
		}
		
		// Restore window if it's in the dock
		if (window.windowState == window.STATE_MINIMIZED) {
			window.restore();
		}
		
		if (!this.collectionsView) {
			throw new Error("Collections view not loaded");
		}
		
		var found = await this.collectionsView.selectItems(itemIDs, inLibraryRoot);
		
		// Focus the items pane
		if (found) {
			document.getElementById(ZoteroPane.itemsView.id).focus();
		}
		
		if (!noTabSwitch) {
			Zotero_Tabs.select('zotero-pane', false, { focusElementID: ZoteroPane.itemsView.id });
		}
		return true;
	};
	
	
	this.getSelectedLibraryID = function () {
		return this.collectionsView.getSelectedLibraryID();
	}
	
	
	function getSelectedCollection(asID) {
		return this.collectionsView.getSelectedCollection(asID);
	}
	
	
	function getSelectedSavedSearch(asID) {
		return this.collectionsView.getSelectedSearch(asID);
	}
	
	
	this.getSelectedGroup = function (asID) {
		return this.collectionsView.getSelectedGroup(asID);
	}
	
	
	this.getSelectedObjects = function () {
		if (!this.itemsView) return [];
		return this.itemsView.getSelectedObjects();
	};
	
	
	/*
	 * Return an array of Item objects for selected items
	 *
	 * If asIDs is true, return an array of itemIDs instead
	 */
	this.getSelectedItems = function (asIDs) {
		switch (Zotero_Tabs.selectedType) {
			case 'library':
				if (!this.itemsView) {
					return [];
				}
				return this.itemsView.getSelectedItems(asIDs);
			case 'reader': {
				let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
				if (reader) {
					let item = Zotero.Items.get(reader.itemID);
					if (item.parentItem) {
						item = item.parentItem;
					}
					return asIDs ? [item.id] : [item];
				}
				return [];
			}
			default:
				return [];
		}
	};
	

	/*
	 * Returns an array of Zotero.Item objects of visible items in current sort order
	 *
	 * If asIDs is true, return an array of itemIDs instead
	 */
	this.getSortedItems = function (asIDs) {
		switch (Zotero_Tabs.selectedType) {
			case 'library':
				if (!this.itemsView) {
					return [];
				}
				return this.itemsView.getSortedItems(asIDs);
			default:
				// ALl non-library tabs: Visible items == "selected" items
				return this.getSelectedItems(asIDs);
		}
	};
	
	
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


	function openPopup(popup, screenX, screenY) {
		popup.openPopupAtScreen(screenX + 1, screenY + 1, true);
	}
	
	
	/**
	 * Show context menu once it's ready
	 */
	this.onCollectionsContextMenuOpen = async function (event, x, y) {
		await ZoteroPane.buildCollectionContextMenu();
		x = x || event.screenX;
		y = y || event.screenY;
		// TEMP: Quick fix for https://forums.zotero.org/discussion/105103/
		if (Zotero.isWin) {
			x += 10;
		}
		openPopup(document.getElementById('zotero-collectionmenu'), x, y);
	};
	
	
	/**
	 * Show context menu once it's ready
	 */
	this.onItemsContextMenuOpen = async function (event, x, y) {
		await ZoteroPane.buildItemContextMenu();
		x = x || event.screenX;
		y = y || event.screenY;
		// TEMP: Quick fix for https://forums.zotero.org/discussion/105103/
		if (Zotero.isWin) {
			x += 10;
		}
		openPopup(document.getElementById('zotero-itemmenu'), x, y);
	};
	
	
	this.onCollectionContextMenuSelect = function (event) {
		event.stopPropagation();
		var o = _collectionContextMenuOptions.find(o => o.id == event.target.id)
		if (o.oncommand) {
			o.oncommand();
		}
	};
	
	
	// menuitem configuration
	//
	// This has to be kept in sync with zotero-collectionmenu in zoteroPane.xhtml. We could do this
	// entirely in JS, but various localized strings are only in zotero.dtd, and they're used in
	// standalone.xul as well, so for now they have to remain as XML entities.
	var _collectionContextMenuOptions = [
		{
			id: "sync",
			label: Zotero.getString('sync.sync'),
			oncommand: () => {
				Zotero.Sync.Runner.sync({
					libraries: [this.getSelectedLibraryID()],
				});
			}
		},
		{
			id: "sep1",
		},
		{
			id: "newCollection",
			command: "cmd_zotero_newCollection"
		},
		{
			id: "newSavedSearch",
			command: "cmd_zotero_newSavedSearch"
		},
		{
			id: "newSubcollection",
			oncommand: () => {
				this.newCollection(this.getSelectedCollection().key);
			}
		},
		{
			id: "refreshFeed",
			oncommand: () => this.refreshFeed()
		},
		{
			id: "sep2",
		},
		{
			id: "showDuplicates",
			oncommand: () => {
				this.setVirtual(this.getSelectedLibraryID(), 'duplicates', true, true);
			}
		},
		{
			id: "showUnfiled",
			oncommand: () => {
				this.setVirtual(this.getSelectedLibraryID(), 'unfiled', true, true);
			}
		},
		{
			id: "showRetracted",
			oncommand: () => {
				this.setVirtual(this.getSelectedLibraryID(), 'retracted', true, true);
			}
		},
		{
			id: "editSelectedCollection",
			oncommand: () => this.editSelectedCollection()
		},
		{
			id: "moveCollection",
		},
		{
			id: "copyCollection"
		},
		{
			id: "duplicate",
			oncommand: () => this.duplicateSelectedCollection()
		},
		{
			id: "markReadFeed",
			oncommand: () => this.markFeedRead()
		},
		{
			id: "editSelectedFeed",
			oncommand: () => this.editSelectedFeed()
		},
		{
			id: 'addFeed'
		},
		{
			id: "deleteCollection",
			oncommand: () => this.deleteSelectedCollection()
		},
		{
			id: "deleteCollectionAndItems",
			oncommand: () => this.deleteSelectedCollection(true)
		},
		{
			id: "sep3",
		},
		{
			id: "exportCollection",
			oncommand: () => Zotero_File_Interface.exportCollection()
		},
		{
			id: "createBibCollection",
			oncommand: () => Zotero_File_Interface.bibliographyFromCollection()
		},
		{
			id: "exportFile",
			oncommand: () => Zotero_File_Interface.exportFile()
		},
		{
			id: "loadReport",
			oncommand: () => Zotero_Report_Interface.loadCollectionReport()
		},
		{
			id: "emptyTrash",
			oncommand: () => this.emptyTrash()
		},
		{
			id: "removeLibrary",
			label: Zotero.getString('pane.collections.menu.remove.library'),
			oncommand: () => {
				let library = Zotero.Libraries.get(this.getSelectedLibraryID());
				let ps = Services.prompt;
				let buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_IS_STRING)
					+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_CANCEL);
				let index = ps.confirmEx(
					null,
					Zotero.getString('pane.collections.removeLibrary'),
					Zotero.getString('pane.collections.removeLibrary.text', library.name),
					buttonFlags,
					Zotero.getString('general.remove'),
					null,
					null, null, {}
				);
				if (index == 0) {
					library.eraseTx();
				}
			}
		},
	];
	
	this.buildCollectionContextMenu = async function () {
		var libraryID = this.getSelectedLibraryID();
		var options = _collectionContextMenuOptions;
		
		var collectionTreeRow = this.getCollectionTreeRow();
		// This can happen if selection is changing during delayed second call below
		if (!collectionTreeRow) {
			return;
		}
		
		// If the items view isn't initialized, this was a right-click on a different collection
		// and the new collection's items are still loading, so continue menu after loading is
		// done. This causes some menu items (e.g., export/createBib/loadReport) to appear gray
		// in the menu at first and then turn black once there are items
		if (!collectionTreeRow.isHeader() && !this.itemsView.initialized) {
			await this.itemsView.waitForLoad();
		}
		
		// Set attributes on the menu from the configuration object
		var menu = document.getElementById('zotero-collectionmenu');
		var m = {};
		for (let i = 0; i < options.length; i++) {
			let option = options[i];
			let menuitem = menu.childNodes[i];
			m[option.id] = menuitem;
			
			menuitem.id = option.id;
			if (!menuitem.classList.contains('menuitem-iconic')) {
				menuitem.classList.add('menuitem-iconic');
			}
			if (option.label) {
				menuitem.setAttribute('label', option.label);
			}
			if (option.command) {
				menuitem.setAttribute('command', option.command);
			}
		}
		
		// By default things are hidden and visible, so we only need to record
		// when things are visible and when they're visible but disabled
		var show = [], disable = [];
		
		let useHideOrDelete = "delete";
		if (collectionTreeRow.isCollection()) {
			show = [
				'newSubcollection',
				'sep2',
				'editSelectedCollection',
				'moveCollection',
				'copyCollection',
				'deleteCollection',
				'deleteCollectionAndItems',
				'sep3',
				'exportCollection',
				'createBibCollection',
				'loadReport'
			];
			
			if (!this.itemsView.rowCount) {
				disable = ['createBibCollection', 'loadReport'];
				
				// If no items in subcollections either, disable export
				if (!(await collectionTreeRow.ref.getDescendents(false, 'item', false).length)) {
					disable.push('exportCollection');
				}
			}
			
			// Adjust labels
			document.l10n.setAttributes(m.editSelectedCollection, 'collections-menu-rename-collection');
			document.l10n.setAttributes(m.moveCollection, 'collections-menu-move-collection');
			document.l10n.setAttributes(m.copyCollection, 'collections-menu-copy-collection');
			
			m.deleteCollection.setAttribute('label', Zotero.getString('pane.collections.menu.delete.collection'));
			m.deleteCollectionAndItems.setAttribute('label', Zotero.getString('pane.collections.menu.delete.collectionAndItems'));
			m.exportCollection.setAttribute('label', Zotero.getString('pane.collections.menu.export.collection'));
			m.createBibCollection.setAttribute('label', Zotero.getString('pane.collections.menu.createBib.collection'));
			m.loadReport.setAttribute('label', Zotero.getString('pane.collections.menu.generateReport.collection'));
		}
		else if (collectionTreeRow.isFeed()) {
			show = [
				'refreshFeed',
				'sep2',
				'markReadFeed',
				'editSelectedFeed',
				'deleteCollectionAndItems'
			];
			
			if (collectionTreeRow.ref.unreadCount == 0) {
				disable = ['markReadFeed'];
			}
			
			// Adjust labels
			m.refreshFeed.setAttribute('label', Zotero.getString('pane.collections.menu.refresh.feed'));
			m.markReadFeed.setAttribute('label', Zotero.getString('pane.collections.menu.markAsRead.feed'));
			m.deleteCollectionAndItems.setAttribute('label', Zotero.getString('pane.collections.menu.delete.feedAndItems'));
		}
		else if (collectionTreeRow.isFeeds()) {
			show = [
				'refreshFeed',
				'sep2',
				'markReadFeed',
				'addFeed',
			];

			if (collectionTreeRow.ref.unreadCount == 0) {
				disable = ['markReadFeed'];
			}

			// Adjust labels
			m.refreshFeed.setAttribute('label', Zotero.getString('pane.collections.menu.refresh.allFeeds'));
			m.markReadFeed.setAttribute('label', Zotero.getString('pane.collections.menu.markAsRead.allFeeds'));
		}
		else if (collectionTreeRow.isSearch()) {
			show = [
				'editSelectedCollection',
				'duplicate',
				'deleteCollection',
				'sep3',
				'exportCollection',
				'createBibCollection',
				'loadReport'
			];
			
			
			if (!this.itemsView.rowCount) {
				disable.push('exportCollection', 'createBibCollection', 'loadReport');
			}
			
			// Adjust labels
			document.l10n.setAttributes(m.editSelectedCollection, 'collections-menu-edit-saved-search');
			m.duplicate.setAttribute('label', Zotero.getString('pane.collections.menu.duplicate.savedSearch'));
			m.deleteCollection.setAttribute('label', Zotero.getString('pane.collections.menu.delete.savedSearch'));
			m.exportCollection.setAttribute('label', Zotero.getString('pane.collections.menu.export.savedSearch'));
			m.createBibCollection.setAttribute('label', Zotero.getString('pane.collections.menu.createBib.savedSearch'));
			m.loadReport.setAttribute('label', Zotero.getString('pane.collections.menu.generateReport.savedSearch'));
		}
		else if (collectionTreeRow.isTrash()) {
			show = ['emptyTrash'];
		}
		else if (collectionTreeRow.isDuplicates() || collectionTreeRow.isUnfiled() || collectionTreeRow.isRetracted()) {
			show = ['deleteCollection'];
			
			m.deleteCollection.setAttribute('label', Zotero.getString('general.hide'));
			useHideOrDelete = "hide";
		}
		else if (collectionTreeRow.isHeader()) {
		}
		else if (collectionTreeRow.isPublications()) {
			show = [
				'exportFile'
			];
		}
		// Library
		else {
			let library = Zotero.Libraries.get(libraryID);
			show = [];
			if (!library.archived) {
				show.push(
					'sync',
					'sep1',
					'newCollection',
					'newSavedSearch'
				);
			}
				// Only show "Show Duplicates", "Show Unfiled Items", and "Show Retracted" if rows are hidden
			let duplicates = Zotero.Prefs.getVirtualCollectionStateForLibrary(
				libraryID, 'duplicates'
			);
			let unfiled = Zotero.Prefs.getVirtualCollectionStateForLibrary(
				libraryID, 'unfiled'
			);
			let retracted = Zotero.Prefs.getVirtualCollectionStateForLibrary(
				libraryID, 'retracted'
			);
			if (!duplicates || !unfiled || !retracted) {
				if (!library.archived) {
					show.push('sep2');
				}
				if (!duplicates) {
					show.push('showDuplicates');
				}
				if (!unfiled) {
					show.push('showUnfiled');
				}
				if (!retracted) {
					show.push('showRetracted');
				}
			}
			if (!library.archived) {
				show.push('sep3');
			}
			show.push(
				'exportFile'
			);
			if (library.archived) {
				show.push('removeLibrary');
			}
		}

		if (useHideOrDelete === 'delete') {
			m.deleteCollection.classList.add('zotero-menuitem-delete-collection');
			m.deleteCollection.classList.remove('zotero-menuitem-hide-collection');
		}
		else {
			m.deleteCollection.classList.add('zotero-menuitem-hide-collection');
			m.deleteCollection.classList.remove('zotero-menuitem-delete-collection');
		}
		
		// Disable some actions if user doesn't have write access
		//
		// Some actions are disabled via their commands in onCollectionSelected()
		if (collectionTreeRow.isWithinGroup()
				&& !collectionTreeRow.editable
				&& !collectionTreeRow.isDuplicates()
				&& !collectionTreeRow.isUnfiled()
				&& !collectionTreeRow.isRetracted()) {
			disable.push(
				'newSubcollection',
				'editSelectedCollection',
				'duplicate',
				'deleteCollection',
				'deleteCollectionAndItems'
			);
		}
		
		// If within non-editable group or trash it empty, disable Empty Trash
		if (collectionTreeRow.isTrash()) {
			if ((collectionTreeRow.isWithinGroup() && !collectionTreeRow.isWithinEditableGroup()) || !this.itemsView.rowCount) {
				disable.push('emptyTrash');
			}
		}
		
		// Hide and enable all actions by default (so if they're shown they're enabled)
		for (let i in m) {
			m[i].setAttribute('hidden', true);
			m[i].setAttribute('disabled', false);
		}
		
		for (let id of show) {
			m[id].setAttribute('hidden', false);
		}
		
		for (let id of disable) {
			m[id].setAttribute('disabled', true);
		}
	};
	
	
	this.buildItemContextMenu = Zotero.Promise.coroutine(function* () {
		var options = [
			'showInLibrary',
			'sep1',
			'addNote',
			'createNoteFromAnnotations',
			'addAttachments',
			'sep2',
			'findFile',
			'sep3',
			'toggleRead',
			'changeParentItem',
			'addToCollection',
			'removeItems',
			'duplicateAndConvert',
			'duplicateItem',
			'restoreToLibrary',
			'moveToTrash',
			'deleteFromLibrary',
			'mergeItems',
			'sep4',
			'exportItems',
			'createBib',
			'loadReport',
			'sep5',
			'recognizePDF',
			'unrecognize',
			'createParent',
			'renameAttachments',
			'reindexItem',
		];
		
		var m = {};
		for (let i = 0; i < options.length; i++) {
			m[options[i]] = i;
		}
		
		var menu = document.getElementById('zotero-itemmenu');
		
		// remove old locate menu items
		while(menu.firstChild && menu.firstChild.getAttribute("zotero-locate")) {
			menu.removeChild(menu.firstChild);
		}
		
		var disable = new Set(), show = new Set(), multiple = '';
		
		if (!this.itemsView) {
			return;
		}
		
		var collectionTreeRow = this.getCollectionTreeRow();
		var isTrash = collectionTreeRow.isTrash();
		
		if (isTrash) {
			show.add(m.deleteFromLibrary);
			show.add(m.restoreToLibrary);
			if (!ZoteroPane_Local.canDeleteSelectedItems()) {
				disable.add(m.deleteFromLibrary);
			}
			if (!ZoteroPane_Local.canRestoreSelectedItems()) {
				disable.add(m.restoreToLibrary);
			}
		}
		else if (!collectionTreeRow.isFeedsOrFeed()) {
			show.add(m.moveToTrash);
		}

		if(!collectionTreeRow.isFeedsOrFeed()) {
			show.add(m.sep4);
			show.add(m.exportItems);
			show.add(m.createBib);
			show.add(m.loadReport);
		}
		
		var items = this.getSelectedObjects();
		
		if (items.length > 0) {
			// Multiple items selected
			if (items.length > 1) {
				var multiple =  '.multiple';
				
				var canMerge = true,
					canIndex = true,
					canRecognize = true,
					canUnrecognize = true,
					canRename = true;
				var canMarkRead = collectionTreeRow.isFeedsOrFeed();
				var markUnread = true;
				
				for (let i = 0; i < items.length; i++) {
					let item = items[i];
					if (canMerge && (!item.isRegularItem() || item.isFeedItem || collectionTreeRow.isDuplicates())) {
						canMerge = false;
					}
					
					if (canIndex && !(yield Zotero.Fulltext.canReindex(item))) {
						canIndex = false;
					}
					
					if (canRecognize && !Zotero.RecognizeDocument.canRecognize(item)) {
						canRecognize = false;
					}
					
					if (canUnrecognize && !Zotero.RecognizeDocument.canUnrecognize(item)) {
						canUnrecognize = false;
					}
					
					// Show rename option only if all items are child attachments
					if (canRename && (!item.isAttachment() || item.isTopLevelItem() || item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL)) {
						canRename = false;
					}
					
					if(canMarkRead && markUnread && !item.isRead) {
						markUnread = false;
					}
				}
				
				if (canMerge) {
					show.add(m.mergeItems);
				}
				
				if (canIndex) {
					show.add(m.reindexItem);
				}
				
				if (canRecognize) {
					show.add(m.recognizePDF);
				}
				
				if (canUnrecognize) {
					show.add(m.unrecognize);
				}
				
				if (canMarkRead) {
					show.add(m.toggleRead);
					if (markUnread) {
						menu.childNodes[m.toggleRead].setAttribute('label', Zotero.getString('pane.item.markAsUnread'));
					} else {
						menu.childNodes[m.toggleRead].setAttribute('label', Zotero.getString('pane.item.markAsRead'));
					}
				}
				
				// "Add/Create Note from Annotations" and "Find Available PDFs"
				if (collectionTreeRow.filesEditable
						&& !collectionTreeRow.isDuplicates()
						&& !collectionTreeRow.isFeedsOrFeed()) {
					if (items.some(item => attachmentsWithExtractableAnnotations(item).length)
							|| items.some(item => isAttachmentWithExtractableAnnotations(item))) {
						let menuitem = menu.childNodes[m.createNoteFromAnnotations];
						show.add(m.createNoteFromAnnotations);
						let key;
						// If all from a single item, show "Add Note from Annotations"
						if (Zotero.Items.getTopLevel(items).length == 1) {
							key = 'addNoteFromAnnotations';
							menuitem.setAttribute('oncommand', 'ZoteroPane.addNoteFromAnnotationsFromSelected()');
						}
						// Otherwise show "Create Note from Annotations"
						else {
							key = 'createNoteFromAnnotations';
							menuitem.setAttribute('oncommand', 'ZoteroPane.createStandaloneNoteFromAnnotationsFromSelected()');
						}
						menuitem.setAttribute(
							'label',
							Zotero.getString('pane.items.menu.' + key)
						);
						show.add(m.sep3);
					}
					
					if (items.some(item => item.isRegularItem())) {
						show.add(m.findFile);
						show.add(m.sep3);
					}
				}

				let canCreateParent = true;
				for (let i = 0; i < items.length; i++) {
					let item = items[i];
					if (!item.isTopLevelItem() || !item.isAttachment() || item.isFeedItem) {
						canCreateParent = false;
						break;
					}
				}
				if (canCreateParent) {
					show.add(m.createParent);
				}
				
				if (canRename) {
					show.add(m.renameAttachments);
				}
				
				// Add in attachment separator
				if (canCreateParent || canRecognize || canUnrecognize || canRename || canIndex) {
					show.add(m.sep5);
				}
				
				// Block certain actions on files if no access and at least one item is a file
				// attachment
				if (!collectionTreeRow.filesEditable) {
					for (let item of items) {
						if (item.isFileAttachment()) {
							disable.add(m.moveToTrash);
							disable.add(m.createParent);
							disable.add(m.renameAttachments);
							break;
						}
					}
				}
				
			}
			
			// Single item selected
			else
			{
				let item = items[0];
				menu.setAttribute('itemID', item.id);
				menu.setAttribute('itemKey', item.key);
				
				if (!isTrash) {
					// Show in Library
					if (!collectionTreeRow.isLibrary(true)) {
						show.add(m.showInLibrary);
						show.add(m.sep1);
					}
					
					// Show "Add Note from Annotations" on parent item with any extractable annotations
					if (item.isRegularItem() && !item.isFeedItem) {
						show.add(m.addNote);
						show.add(m.addAttachments);
						show.add(m.sep2);
						
						let attachmentsWithAnnotations = Zotero.Items.get(item.getAttachments())
							.filter(item => isAttachmentWithExtractableAnnotations(item));
						if (attachmentsWithAnnotations.length) {
							show.add(m.createNoteFromAnnotations);
						}
					}
					// Show "(Create|Add) Note from Annotations" on attachment with extractable annotations
					else if (isAttachmentWithExtractableAnnotations(item)) {
						show.add(m.createNoteFromAnnotations);
						show.add(m.sep2);
					}
					if (show.has(m.createNoteFromAnnotations)) {
						let menuitem = menu.childNodes[m.createNoteFromAnnotations];
						let str;
						// Show "Create" on standalone attachments
						if (item.isAttachment() && item.isTopLevelItem()) {
							str = 'pane.items.menu.createNoteFromAnnotations';
							menuitem.setAttribute('oncommand', 'ZoteroPane.createStandaloneNoteFromAnnotationsFromSelected()');
						}
						// And "Add" otherwise
						else {
							str = 'pane.items.menu.addNoteFromAnnotations';
							menuitem.setAttribute('oncommand', 'ZoteroPane.addNoteFromAnnotationsFromSelected()');
						}
						menuitem.setAttribute('label', Zotero.getString(str));
					}
					
					if (Zotero.Attachments.canFindFileForItem(item)) {
						show.add(m.findFile);
						show.add(m.sep3);
						if (!collectionTreeRow.filesEditable) {
							disable.add(m.findFile);
						}
					}
					
					if (Zotero.RecognizeDocument.canUnrecognize(item)) {
						show.add(m.sep5);
						show.add(m.unrecognize);
					}
					
					if (item.isAttachment()) {
						var showSep5 = false;
						
						if (Zotero.RecognizeDocument.canRecognize(item)) {
							show.add(m.recognizePDF);
							showSep5 = true;
						}
						
						// Allow parent item creation for standalone attachments
						if (item.isTopLevelItem()) {
							show.add(m.createParent);
							showSep5 = true;
						}
						
						// Attachment rename option
						if (!item.isTopLevelItem() && item.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) {
							show.add(m.renameAttachments);
							showSep5 = true;
						}
						
						// If not linked URL, show reindex line
						if (yield Zotero.Fulltext.canReindex(item)) {
							show.add(m.reindexItem);
							showSep5 = true;
						}
						
						if (showSep5) {
							show.add(m.sep5);
						}
					}
					else if (item.isFeedItem) {
						show.add(m.toggleRead);
						if (item.isRead) {
							menu.childNodes[m.toggleRead].setAttribute('label', Zotero.getString('pane.item.markAsUnread'));
						} else {
							menu.childNodes[m.toggleRead].setAttribute('label', Zotero.getString('pane.item.markAsRead'));
						}
					}
					else if (!collectionTreeRow.isPublications()) {
						if (item.itemType == 'book' || item.itemType == 'bookSection') {
							let toBookMenuItem = menu.childNodes[m.duplicateAndConvert];
							toBookMenuItem.setAttribute('label', Zotero.getString('pane.items.menu.duplicateAndConvert.'
								+ (item.itemType == 'book' ? 'toBookSection' : 'toBook')));
							if (item.itemType === 'book') {
								toBookMenuItem.classList.add('zotero-menuitem-convert-to-book-section');
								toBookMenuItem.classList.remove('zotero-menuitem-convert-to-book');
							}
							else {
								toBookMenuItem.classList.add('zotero-menuitem-convert-to-book');
								toBookMenuItem.classList.remove('zotero-menuitem-convert-to-book-section');
							}
							show.add(m.duplicateAndConvert);
						}

						show.add(m.duplicateItem);
					}
				}
				
				// Update attachment submenu
				var popup = document.getElementById('zotero-add-attachment-popup')
				this.updateAddAttachmentMenu(popup);
				
				// Block certain actions on files if no access
				if (item.isFileAttachment() && !collectionTreeRow.filesEditable) {
					[m.moveToTrash, m.createParent, m.renameAttachments]
						.forEach(function (x) {
							disable.add(x);
						});
				}
			}
		}
		// No items selected
		else
		{
			// Show in Library
			if (!collectionTreeRow.isLibrary()) {
				show.add(m.showInLibrary);
				show.add(m.sep1);
			}
			
			[
				m.showInLibrary,
				m.duplicateItem,
				m.removeItems,
				m.moveToTrash,
				m.deleteFromLibrary,
				m.exportItems,
				m.createBib,
				m.loadReport
			].forEach(x => disable.add(x));
			
		}
		// Show "Export Note…" if all notes or attachments
		var noteExport = items.every(item => item.isNote() || item.isAttachment());
		// Disable export if all notes are empty
		if (noteExport) {
			// If no non-empty notes, hide if all attachments and disable if all notes or a mixture
			// of notes and attachments
			if (!items.some(item => item.note)) {
				if (items.every(item => item.isAttachment())) {
					show.delete(m.exportItems);
				}
				else {
					disable.add(m.exportItems);
				}
			}
		}
		
		// Disable Create Bibliography if no regular items
		if (show.has(m.createBib) && !items.some(item => item.isRegularItem())) {
			show.delete(m.createBib);
		}
		
		if ((!collectionTreeRow.editable || collectionTreeRow.isPublications()) && !collectionTreeRow.isFeedsOrFeed()) {
			for (let i in m) {
				// Still allow some options for non-editable views
				switch (i) {
					case 'showInLibrary':
					case 'exportItems':
					case 'createBib':
					case 'loadReport':
					case 'toggleRead':
						continue;
				}
				if (isTrash) {
					switch (i) {
					case 'restoreToLibrary':
					case 'deleteFromLibrary':
						continue;
					}
				}
				else if (collectionTreeRow.isPublications()) {
					switch (i) {
					case 'addNote':
					case 'removeItems':
					case 'moveToTrash':
						continue;
					}
				}
				disable.add(m[i]);
			}
		}

		// Add to collection
		if (!collectionTreeRow.isFeedsOrFeed()
			&& collectionTreeRow.editable
			&& Zotero.Items.keepTopLevel(items).every(item => item.isTopLevelItem())
		) {
			menu.childNodes[m.addToCollection].setAttribute('label', Zotero.getString('pane.items.menu.addToCollection'));
			show.add(m.addToCollection);
		}
		
		// Remove from collection
		if (collectionTreeRow.isCollection() && items.every(item => item.isTopLevelItem())) {
			menu.childNodes[m.removeItems].setAttribute('label', Zotero.getString('pane.items.menu.remove' + multiple));
			show.add(m.removeItems);
		}
		else if (collectionTreeRow.isPublications()) {
			menu.childNodes[m.removeItems].setAttribute('label', Zotero.getString('pane.items.menu.removeFromPublications' + multiple));
			show.add(m.removeItems);
		}
		
		// Show in library
		if (collectionTreeRow.isFeeds()) {
			menu.childNodes[m.showInLibrary].setAttribute('label', Zotero.getString('pane.items.menu.showInFeed'));
		}
		else {
			menu.childNodes[m.showInLibrary].setAttribute('label', Zotero.getString('general.showInLibrary'));
		}
		// For collections and search, only keep restore/delete options
		if (items.some(item => item instanceof Zotero.Collection || item instanceof Zotero.Search)) {
			for (let option of options) {
				if (!['restoreToLibrary', 'deleteFromLibrary'].includes(option)) {
					show.delete(m[option]);
				}
			}
		}
		
		// Update parent item of notes/attachments
		if (items.every(item => item.isNote() || item.isAttachment())) {
			show.add(m.changeParentItem);
		}

		// Set labels, plural if necessary
		menu.childNodes[m.findFile].setAttribute('label', Zotero.getString('pane.items.menu.findAvailableFile'));
		menu.childNodes[m.moveToTrash].setAttribute('label', Zotero.getString('pane.items.menu.moveToTrash' + multiple));
		menu.childNodes[m.deleteFromLibrary].setAttribute('label', Zotero.getString('pane.items.menu.delete'));
		menu.childNodes[m.exportItems].setAttribute('label', Zotero.getString(`pane.items.menu.export${noteExport ? 'Note' : ''}` + multiple));
		menu.childNodes[m.createBib].setAttribute('label', Zotero.getString('pane.items.menu.createBib' + multiple));
		menu.childNodes[m.loadReport].setAttribute('label', Zotero.getString('pane.items.menu.generateReport' + multiple));
		menu.childNodes[m.createParent].setAttribute('label', Zotero.getString('pane.items.menu.createParent' + multiple));
		menu.childNodes[m.recognizePDF].setAttribute('label', Zotero.getString('pane.items.menu.recognizeDocument'));
		menu.childNodes[m.renameAttachments].setAttribute('label', Zotero.getString('pane.items.menu.renameAttachments' + multiple));
		menu.childNodes[m.reindexItem].setAttribute('label', Zotero.getString('pane.items.menu.reindexItem' + multiple));
		
		// Hide and enable all actions by default (so if they're shown they're enabled)
		for (let i in m) {
			let pos = m[i];
			menu.childNodes[pos].setAttribute('hidden', true);
			menu.childNodes[pos].setAttribute('disabled', false);
		}
		
		for (let x of disable) {
			menu.childNodes[x].setAttribute('disabled', true);
		}
		
		for (let x of show) {
			menu.childNodes[x].setAttribute('hidden', false);
		}
		
		// add locate menu options
		yield Zotero_LocateMenu.buildContextMenu(menu, true);
	});


	// Build a menu to move or copy a collection into another collection and library.
	// Alternative to dropping collection into another collection or group
	this.buildMoveCollectionMenu = function (event) {
		if (event.target !== event.currentTarget) return;
		let popup = event.target;
		popup.replaceChildren();

		let selected = this.getSelectedCollection();

		// Add current library at the top to be able to move collections into it
		let library = Zotero.Libraries.get(ZoteroPane.getSelectedLibraryID());
		let libraryMenuItem = document.createXULElement("menuitem");
		libraryMenuItem.setAttribute("label", library.name);
		libraryMenuItem.setAttribute("image", library.treeViewImage);
		libraryMenuItem.setAttribute("value", library.treeViewID);
		libraryMenuItem.addEventListener("command", (event) => {
			if (event.target.tagName == 'menuitem') {
				this.moveCollection(library);
				event.stopPropagation();
			}
		});
		// Disable for already top-level collections
		libraryMenuItem.disabled = !selected.parentID;
		popup.appendChild(libraryMenuItem);
		popup.appendChild(document.createXULElement("menuseparator"));
		
		// Build menus for each top-level collection of this library
		let collections = Zotero.Collections.getByLibrary(this.getSelectedLibraryID());
		for (let col of collections) {
			let menuItem = Zotero.Utilities.Internal.createMenuForTarget(
				col,
				popup,
				null,
				(event, collection) => {
					if (event.target.tagName == 'menuitem') {
						this.moveCollection(collection);
						event.stopPropagation();
					}
				},
				
				(target) => {
					// can't move collection into itself, its parent or its children
					return selected == target
						|| selected.parentKey == target.key
						|| selected.hasDescendent('collection', target.id);
				}
			);
			popup.append(menuItem);
		}
	};


	this.buildCopyCollectionMenu = function (event) {
		if (event.target !== event.currentTarget) return;
		let popup = document.getElementById("zotero-copy-collection-popup");
		popup.replaceChildren();
		let selected = this.getSelectedCollection();

		// Fetch all libraries
		let topLevelEntries = Zotero.Libraries.getAll().filter(lib => !(lib instanceof Zotero.Feed));

		// Check which libraries have collections linked to the selected collection
		// and disable their menuitems. Same logic as in CollectionTree.canDropCheckAsync.
		let linkedCollectionsExist = {};
		(async () => {
			for (let library of topLevelEntries) {
				if (library.libraryID == selected.libraryID) continue;
				// Check which library has a collection linked to the selected collection
				let linkedCollection = await selected.getLinkedCollection(library.libraryID, true);
				linkedCollectionsExist[library.libraryID] = linkedCollection;
				// Also check which library has collections linked to a subcollection of the selected collection
				for (let descendent of selected.getDescendents(false, 'collection')) {
					let subcollection = Zotero.Collections.get(descendent.id);
					let linkedSubcollection = await subcollection.getLinkedCollection(library.libraryID, true);
					if (linkedSubcollection) {
						linkedCollectionsExist[library.libraryID] = linkedSubcollection;
					}
				}
			}
			// Libraries that have linked collections have their menus disabled
			for (let libraryMenuItem of [...popup.childNodes]) {
				let menuItemLibID = libraryMenuItem.getAttribute("value").substring(1);
				if (linkedCollectionsExist[menuItemLibID]) {
					libraryMenuItem.disabled = true;
				}
			}
		})();
		
		// If there is only one library, display its collections as top-level menuitems
		if (topLevelEntries.length == 1) {
			// Manually add My Library menuitem at the top, so one can still copy into it
			let myLibrary = topLevelEntries[0];
			let myLibraryMenuItem = document.createXULElement("menuitem");
			myLibraryMenuItem.setAttribute("label", myLibrary.name);
			myLibraryMenuItem.setAttribute("image", myLibrary.treeViewImage);
			myLibraryMenuItem.setAttribute("value", myLibrary.treeViewID);
			myLibraryMenuItem.addEventListener("command", (event) => {
				if (event.target.tagName == 'menuitem') {
					this.copyCollection(myLibrary);
					event.stopPropagation();
				}
			});
			popup.appendChild(myLibraryMenuItem);
			popup.appendChild(document.createXULElement("menuseparator"));

			// Top-level collections used to construct the menus
			topLevelEntries = Zotero.Collections.getByLibrary(topLevelEntries[0].id);
		}
		
		// Build menus for all libraries (or collections)
		for (let obj of topLevelEntries) {
			let menuItem = Zotero.Utilities.Internal.createMenuForTarget(
				obj,
				popup,
				null,
				(event, collection) => {
					if (event.target.tagName == 'menuitem') {
						this.copyCollection(collection);
						event.stopPropagation();
					}
				},
				
				(target) => {
					// can't copy collection into itself or into non-editable groups
					return selected == target
						|| (target instanceof Zotero.Group && !target.editable);
				}
			);
			popup.append(menuItem);
		}
	};

	this.buildAddItemToCollectionMenu = function (event, items = this.getSelectedItems()) {
		if (event.target !== event.currentTarget) return;
		let popup = event.target;

		items = Zotero.Items.keepTopLevel(items);
		
		let newCollectionMenuitem = document.createXULElement('menuitem');
		document.l10n.setAttributes(newCollectionMenuitem, 'menu-new-collection');
		newCollectionMenuitem.addEventListener('command', () => this.addItemsToCollection(items, null, true));
		let separator = document.createXULElement('menuseparator');
		popup.replaceChildren(newCollectionMenuitem, separator);
		
		if (!items.length) {
			separator.hidden = true;
			return;
		}

		let libraryID = items[0].libraryID;
		if (items.some(item => item.libraryID !== libraryID)) {
			throw new Error('All items must be the same library');
		}
		
		let collections = Zotero.Collections.getByLibrary(libraryID);
		for (let col of collections) {
			let menuItem = Zotero.Utilities.Internal.createMenuForTarget(
				col,
				popup,
				null,
				(event, collection) => {
					if (event.target.tagName == 'menuitem') {
						this.addItemsToCollection(items, collection);
						event.stopPropagation();
					}
				},
				collection => items.every(item => collection.hasItem(item))
			);
			popup.append(menuItem);
		}

		separator.hidden = !collections.length;
	};


	this.addItemsToCollection = async function (items, collection, createNew = false) {
		items = Zotero.Items.keepTopLevel(items);

		if (createNew) {
			if (collection) {
				throw new Error('collection must be null if createNew is true');
			}
			// Only allow targets within the current library for now
			// TODO: Come back to this once we support copying items between libraries from the Add to Collection menu
			let id = await this.newCollection();
			if (!id) {
				return;
			}
			collection = Zotero.Collections.get(id);
		}

		await Zotero.DB.executeTransaction(
			() => collection.addItems(items.map(item => item.id)));
	};


	this.addSelectedItemsToCollection = function (collection, createNew = false) {
		return this.addItemsToCollection(this.getSelectedItems(), collection, createNew);
	};

	
	this.onItemTreeActivate = function(event, items) {
		var viewOnDoubleClick = Zotero.Prefs.get('viewOnDoubleClick');
		// Mouse event
		if (event.button && items.length == 1 && viewOnDoubleClick) {
			ZoteroPane.viewItems([items[0]], event);
		}
		// Keyboard event
		else if (items.length < 20) {
			ZoteroPane_Local.viewItems(items, event);
		}
	};
	
	
	function attachmentsWithExtractableAnnotations(item) {
		if (!item.isRegularItem()) return [];
		return Zotero.Items.get(item.getAttachments())
			.filter(item => isAttachmentWithExtractableAnnotations(item));
	}
	
	
	function isAttachmentWithExtractableAnnotations(item) {
		// For now, consider all PDF attachments eligible, since we want to extract external
		// annotations in unprocessed files if present
		// item.isPDFAttachment() && item.getAnnotations().some(x => x.annotationType != 'ink');
		return item.isPDFAttachment()
			|| (item.isEPUBAttachment() || item.isSnapshotAttachment()) && item.getAnnotations().length;
	}
	
	
	this.openPreferences = function (paneID) {
		Zotero.warn("ZoteroPane.openPreferences() is deprecated"
			+ " -- use Zotero.Utilities.Internal.openPreferences() instead");
		Zotero.Utilities.Internal.openPreferences(paneID);
	}
	
	
	/*
	 * Loads a URL following the standard modifier key behavior
	 *  (e.g. meta-click == new background tab, meta-shift-click == new front tab,
	 *  shift-click == new window, no modifier == frontmost tab
	 */
	this.loadURI = function (uris, event) {
		if(typeof uris === "string") {
			uris = [uris];
		}
		
		for (let i = 0; i < uris.length; i++) {
			let uri = uris[i];
			// Ignore javascript: and data: URIs
			if (uri.match(/^(javascript|data):/)) {
				return;
			}
			
			if (uri.match(/^(chrome|resource):/)) {
				Zotero.openInViewer(uri);
				continue;
			}
			
			// Handle no-content zotero: URLs (e.g., zotero://select) without opening viewer
			if (uri.startsWith('zotero:')) {
				let nsIURI = Services.io.newURI(uri, null, null);
				let handler = Services.io.getProtocolHandler("zotero").wrappedJSObject;
				let extension = handler.getExtension(nsIURI);
				if (extension.noContent) {
					extension.doAction(nsIURI);
					return;
				}
			}
			
			try {
				Zotero.launchURL(uri);
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
	}
	
	// TODO upon electron:
	// Technically just forwards to the react itemsView
	// but it is not as robust as XUL. Unfortunately we cannot use the original XUL
	// version since it causes terrible layout issues when mixing XUL and HTML
	// Keeping this function here since setting this message is technically
	// the responsibility of the ZoteroPane and should be independent upon itemsView,
	// which hopefully we will fix once electronero arrives
	function setItemsPaneMessage(content, lock) {
		if (this._itemsPaneMessageLocked) {
			return;
		}

		// Make message permanent
		if (lock) {
			this._itemsPaneMessageLocked = true;
		}

		if (this.itemsView) {
			this.itemsView.setItemsPaneMessage(content, lock);
		}
	}
	
	function clearItemsPaneMessage() {
		// If message box is locked, don't clear
		if (this._itemsPaneMessageLocked) {
			return;
		}
		
		if (this.itemsView) {
			this.itemsView.clearItemsPaneMessage();
		}
	}
	
	
	/**
	 * @return {Promise<Integer|null|false>} - The id of the new note in non-popup mode, null in
	 *     popup mode (where a note isn't created immediately), or false if library isn't editable
	 */
	this.newNote = Zotero.Promise.coroutine(function* (popup, parentKey, text, citeURI) {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return false;
		}
		
		if (popup) {
			// TODO: _text_
			var c = this.getSelectedCollection();
			if (c) {
				this.openNoteWindow(null, c.id, parentKey);
			}
			else {
				this.openNoteWindow(null, null, parentKey);
			}
			return null;
		}
		
		if (!text) {
			text = '';
		}
		text = text.trim();
		
		if (text) {
			text = '<blockquote'
					+ (citeURI ? ' cite="' + citeURI + '"' : '')
					+ '>' + Zotero.Utilities.text2html(text) + "</blockquote>";
		}
		
		var item = new Zotero.Item('note');
		item.libraryID = this.getSelectedLibraryID();
		item.setNote(text);
		if (parentKey) {
			item.parentKey = parentKey;
		}
		else if (this.getCollectionTreeRow().isCollection()) {
			item.addToCollection(this.getCollectionTreeRow().ref.id);
		}
		var itemID = yield item.saveTx({
			notifierData: {
				autoSyncDelay: Zotero.Notes.AUTO_SYNC_DELAY
			}
		});
		
		yield this.selectItem(itemID);
		
		document.getElementById('zotero-note-editor').focus();
		
		return itemID;
	});
	
	
	/**
	 * Creates a child note for the selected item or the selected item's parent
	 *
	 * @return {Promise}
	 */
	this.newChildNote = function (popup) {
		var selected = this.getSelectedItems()[0];
		var parentKey = selected.parentItemKey;
		parentKey = parentKey ? parentKey : selected.key;
		this.newNote(popup, parentKey);
	}
	
	
	// TODO: Move to server_connector
	this.addSelectedTextToCurrentNote = Zotero.Promise.coroutine(function* () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var text = event.currentTarget.ownerDocument.popupNode.ownerDocument.defaultView.getSelection().toString();
		var uri = event.currentTarget.ownerDocument.popupNode.ownerDocument.location.href;
		
		if (!text) {
			return false;
		}
		
		text = text.trim();
		
		if (!text.length) {
			return false;
		}
		
		text = '<blockquote' + (uri ? ' cite="' + uri + '"' : '') + '>'
			+ Zotero.Utilities.text2html(text) + "</blockquote>";
		
		var items = this.getSelectedItems();
		
		if (this.itemsView.selection.count == 1 && items[0] && items[0].isNote()) {
			var note = items[0].note;
			
			items[0].setNote(note + text);
			yield items[0].saveTx();
			
			var noteElem = document.getElementById('zotero-note-editor')
			noteElem.focus();
			return true;
		}
		
		return false;
	});
	
	
	this.openNoteWindow = function (itemID, col, parentKey) {
		var item = Zotero.Items.get(itemID);
		var type = Zotero.Libraries.get(item.libraryID).libraryType;
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var name = null;
		
		if (itemID) {
			let w = this.findNoteWindow(itemID);
			if (w) {
				w.focus();
				return;
			}
			
			// Create a name for this window so we can focus it later
			//
			// Collection is only used on new notes, so we don't need to
			// include it in the name
			name = 'zotero-note-' + itemID;
		}
		
		var io = { itemID: itemID, collectionID: col, parentItemKey: parentKey };
		window.openDialog('chrome://zotero/content/note.xhtml', name, 'chrome,resizable,centerscreen,dialog=false', io);
	}
	
	
	this.findNoteWindow = function (itemID) {
		var name = 'zotero-note-' + itemID;
		var wm = Services.wm;
		var e = wm.getEnumerator('zotero:note');
		while (e.hasMoreElements()) {
			var w = e.getNext();
			if (w.name == name) {
				return w;
			}
		}
	};
	
	
	this.addAttachmentFromURI = Zotero.Promise.method(function (link, itemID) {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var io = {};
		window.openDialog('chrome://zotero/content/attachLink.xhtml',
			'zotero-attach-uri-dialog', 'centerscreen, modal', io);
		if (!io.out) return;
		return Zotero.Attachments.linkFromURL({
			url: io.out.link,
			parentItemID: itemID,
			title: io.out.title
		});
	});
	
	/**
	 * @param {Boolean} [link]
	 * @param {Number} [parentItemID]
	 * @param {String[]} [files] Used instead of showing a file picker - for tests
	 * @returns {Promise<Zotero.Item[] | null>}
	 */
	this.addAttachmentFromDialog = async function (link, parentItemID, files = null) {
		var libraryID;
		if (Zotero_Tabs.selectedType === 'library') {
			let collectionTreeRow = this.getCollectionTreeRow();
			if (link && collectionTreeRow.isPublications()) {
				Zotero.alert(
					null,
					Zotero.getString('general.error'),
					Zotero.getString('publications.error.linkedFilesCannotBeAdded')
				);
				return null;
			}
			libraryID = collectionTreeRow.ref.libraryID;
		}
		else {
			libraryID = Zotero.Items.get(parentItemID).libraryID;
		}
		
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return null;
		}
		// TODO: disable in menu
		if (!this.canEditFiles()) {
			this.displayCannotEditLibraryFilesMessage();
			return null;
		}
		if (link && Zotero.Libraries.get(libraryID).isGroup) {
			Zotero.alert(null, "", "Linked files cannot be added to group libraries.");
			return null;
		}
		
		if (!files) {
			var fp = new FilePicker();
			fp.init(window, Zotero.getString('pane.item.attachments.select'), fp.modeOpenMultiple);
			fp.appendFilters(fp.filterAll);

			if (await fp.show() != fp.returnOK) {
				return null;
			}

			files = fp.files;
		}
		var addedItems = [];
		var collection;
		var fileBaseName;
		if (parentItemID) {
			// If only one item is being added, automatic renaming is enabled, and the parent item
			// doesn't have any other non-HTML file attachments, rename the file.
			// This should be kept in sync with itemTreeView::drop().
			if (files.length == 1 && Zotero.Attachments.shouldAutoRenameFile(link)) {
				let parentItem = Zotero.Items.get(parentItemID);
				if (!parentItem.numNonHTMLFileAttachments()) {
					fileBaseName = await Zotero.Attachments.getRenamedFileBaseNameIfAllowedType(
						parentItem, files[0]
					);
				}
			}
		}
		// If not adding to an item, add to the current collection
		else {
			collection = this.getSelectedCollection(true);
		}
		
		for (let file of files) {
			let item;
			
			if (link) {
				// Rename linked file, with unique suffix if necessary
				try {
					if (fileBaseName) {
						let ext = Zotero.File.getExtension(file);
						let newName = await Zotero.File.rename(
							file,
							fileBaseName + (ext ? '.' + ext : ''),
							{
								unique: true
							}
						);
						// Update path in case the name was changed to be unique
						file = PathUtils.join(PathUtils.parent(file), newName);
					}
				}
				catch (e) {
					Zotero.logError(e);
				}
				
				item = await Zotero.Attachments.linkFromFile({
					file,
					parentItemID,
					collections: collection ? [collection] : undefined
				});
			}
			else {
				if (file.endsWith(".lnk")) {
					let win = Services.wm.getMostRecentWindow("navigator:browser");
					win.ZoteroPane.displayCannotAddShortcutMessage(file);
					continue;
				}
				
				item = await Zotero.Attachments.importFromFile({
					file,
					libraryID,
					fileBaseName,
					parentItemID,
					collections: collection ? [collection] : undefined
				});
			}
			
			addedItems.push(item);
		}
		
		// Automatically retrieve metadata for top-level PDFs
		if (!parentItemID) {
			Zotero.RecognizeDocument.autoRecognizeItems(addedItems);
		}
		
		return addedItems;
	};
	
	
	this.findFilesForSelectedItems = async function () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		await Zotero.Attachments.addAvailableFiles(this.getSelectedItems());
	};
	
	
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
	 * @return {Promise<Zotero.Item>|false}
	 */
	this.addItemFromDocument = Zotero.Promise.coroutine(function* (doc, itemType, saveSnapshot, row) {
		_showPageSaveStatus(doc.title);
		
		// Save snapshot if explicitly enabled or automatically pref is set and not explicitly disabled
		saveSnapshot = saveSnapshot || (saveSnapshot !== false && Zotero.Prefs.get('automaticSnapshots'));
		
		// TODO: this, needless to say, is a temporary hack
		if (itemType == 'temporaryPDFHack') {
			itemType = null;
			var isPDF = false;
			if (doc.title.indexOf('application/pdf') != -1 || Zotero.Attachments.isPDFJSDocument(doc)
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
				if (Zotero.DB.inTransaction()) {
					yield Zotero.DB.waitForTransaction();
				}
				
				// Currently selected row
				if (row === undefined && this.collectionsView && this.getCollectionTreeRow()) {
					row = this.collectionsView.selection.focused;
				}
				
				if (row && !this.canEdit(row)) {
					this.displayCannotEditLibraryMessage();
					return false;
				}
				
				if (row !== undefined) {
					var collectionTreeRow = this.collectionsView.getRow(row);
					var libraryID = collectionTreeRow.ref.libraryID;
				}
				else {
					var libraryID = Zotero.Libraries.userLibraryID;
					var collectionTreeRow = null;
				}
				//
				//
				//
				
				if (row && !this.canEditFiles(row)) {
					this.displayCannotEditLibraryFilesMessage();
					return false;
				}
				
				if (collectionTreeRow && collectionTreeRow.isCollection()) {
					var collectionID = collectionTreeRow.ref.id;
				}
				else {
					var collectionID = false;
				}
				
				let item = yield Zotero.Attachments.importFromDocument({
					libraryID: libraryID,
					document: doc,
					collections: collectionID ? [collectionID] : []
				});
				
				yield this.selectItem(item.id);
				return false;
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
		var item = yield this.newItem(itemType, data, row);
		var filesEditable = Zotero.Libraries.get(item.libraryID).filesEditable;
		
		if (saveSnapshot) {
			var link = false;
			
			if (link) {
				yield Zotero.Attachments.linkFromDocument({
					document: doc,
					parentItemID: item.id
				});
			}
			else if (filesEditable) {
				yield Zotero.Attachments.importFromDocument({
					document: doc,
					parentItemID: item.id
				});
			}
		}
		
		return item;
	});
	
	
	/**
	 * @return {Zotero.Item|false} - The saved item, or false if item can't be saved
	 */
	this.addItemFromURL = Zotero.Promise.coroutine(function* (url, itemType, saveSnapshot, row) {
		url = Zotero.Utilities.Internal.resolveIntermediateURL(url);
		
		let [mimeType, hasNativeHandler] = yield Zotero.MIME.getMIMETypeFromURL(url);
		
		// If native type, save using a hidden browser
		if (hasNativeHandler) {
			var deferred = Zotero.Promise.defer();
			
			var processor = function (doc) {
				return ZoteroPane_Local.addItemFromDocument(doc, itemType, saveSnapshot, row)
				.then(function (item) {
					deferred.resolve(item)
				});
			};
			try {
				yield Zotero.HTTP.processDocuments([url], processor);
			} catch (e) {
				Zotero.debug(e, 1);
				deferred.reject(e);
			}
			
			return deferred.promise;
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
					if (Zotero.DB.inTransaction()) {
						yield Zotero.DB.waitForTransaction();
					}
					
					// Currently selected row
					if (row === undefined) {
						row = ZoteroPane_Local.collectionsView.selection.focused;
					}
					
					if (!ZoteroPane_Local.canEdit(row)) {
						ZoteroPane_Local.displayCannotEditLibraryMessage();
						return false;
					}
					
					if (row !== undefined) {
						var collectionTreeRow = ZoteroPane_Local.collectionsView.getRow(row);
						var libraryID = collectionTreeRow.ref.libraryID;
					}
					else {
						var libraryID = Zotero.Libraries.userLibraryID;
						var collectionTreeRow = null;
					}
					//
					//
					//
					
					if (!ZoteroPane_Local.canEditFiles(row)) {
						ZoteroPane_Local.displayCannotEditLibraryFilesMessage();
						return false;
					}
					
					if (collectionTreeRow && collectionTreeRow.isCollection()) {
						var collectionID = collectionTreeRow.ref.id;
					}
					else {
						var collectionID = false;
					}
					
					let attachmentItem = yield Zotero.Attachments.importFromURL({
						libraryID,
						url,
						collections: collectionID ? [collectionID] : undefined,
						contentType: mimeType
					});
					this.selectItem(attachmentItem.id)
					return attachmentItem;
				}
			}
			
			if (!itemType) {
				itemType = 'webpage';
			}
			
			var item = yield ZoteroPane_Local.newItem(itemType, {}, row)
			var filesEditable = Zotero.Libraries.get(item.libraryID).filesEditable;
			
			// Save snapshot if explicitly enabled or automatically pref is set and not explicitly disabled
			if (saveSnapshot || (saveSnapshot !== false && Zotero.Prefs.get('automaticSnapshots'))) {
				var link = false;
				
				if (link) {
					//Zotero.Attachments.linkFromURL(doc, item.id);
				}
				else if (filesEditable) {
					var attachmentItem = yield Zotero.Attachments.importFromURL({
						url,
						parentItemID: item.id,
						contentType: mimeType
					});
					if (attachmentItem) {
						item.setField('title', attachmentItem.getField('title'));
						item.setField('url', attachmentItem.getField('url'));
						item.setField('accessDate', attachmentItem.getField('accessDate'));
						yield item.saveTx();
					}
				}
			}
			
			return item;
		}
	});
	
	
	this.viewItems = Zotero.Promise.coroutine(function* (items, event) {
		for (let i = 0; i < items.length; i++) {
			let item = items[i];
			if (item.isRegularItem()) {
				// Prefer local file attachments
				let attachment = yield item.getBestAttachment();
				if (attachment) {
					yield this.viewAttachment(attachment.id, event);
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
							uri = "https://doi.org/" + encodeURIComponent(doi);
						}
					}
				}
				
				// Fall back to first attachment link
				if (!uri) {
					let attachmentID = item.getAttachments()[0];
					if (attachmentID) {
						let attachment = yield Zotero.Items.getAsync(attachmentID);
						if (attachment) uri = attachment.getField('url');
					}
				}
				
				if (uri) {
					this.loadURI(uri, event);
				}
			}
			else if (item.isNote()) {
				if (!this.collectionsView.editable) {
					continue;
				}
				ZoteroPane.openNoteWindow(item.id);
			}
			else if (item.isAttachment()) {
				yield this.viewAttachment(item.id, event);
			}
		}
	});
	
	
	this.viewAttachment = Zotero.serial(async function (itemIDs, event, noLocateOnMissing, extraData) {
		// If view isn't editable, don't show Locate button, since the updated
		// path couldn't be sent back up
		if (!this.collectionsView.editable) {
			noLocateOnMissing = true;
		}
		
		if(typeof itemIDs != "object") itemIDs = [itemIDs];
		
		var launchFile = async (path, item) => {
			let contentType = item.attachmentContentType;
			// Fix blank/incorrect EPUB and PDF content types
			let sniffType = async () => {
				let path = await item.getFilePathAsync();
				return Zotero.MIME.sniffForMIMEType(await Zotero.File.getSample(path));
			};
			if (!contentType || contentType === 'application/octet-stream') {
				let sniffedType = await sniffType();
				if (sniffedType === 'application/pdf' || sniffedType === 'application/epub+zip') {
					contentType = sniffedType;
				}
			}
			else if (contentType === 'application/epub' && await sniffType() === 'application/epub+zip') {
				contentType = 'application/epub+zip';
			}
			if (item.attachmentContentType !== contentType) {
				item.attachmentContentType = contentType;
				await item.saveTx();
			}

			let openInWindow = Zotero.Prefs.get('openReaderInNewWindow');
			let useAlternateWindowBehavior = event?.shiftKey || extraData?.forceAlternateWindowBehavior;
			if (useAlternateWindowBehavior) {
				openInWindow = !openInWindow;
			}
			await Zotero.FileHandlers.open(item, {
				location: extraData?.location,
				openInWindow,
			});
		};
		
		for (let i = 0; i < itemIDs.length; i++) {
			let itemID = itemIDs[i];
			let item = await Zotero.Items.getAsync(itemID);
			if (!item.isAttachment()) {
				throw new Error("Item " + itemID + " is not an attachment");
			}
			
			Zotero.debug("Viewing attachment " + item.libraryKey);
			
			if (item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
				this.loadURI(item.getField('url'), event);
				continue;
			}
			
			let isLinkedFile = !item.isStoredFileAttachment();
			let path = item.getFilePath();
			if (!path) {
				ZoteroPane_Local.showAttachmentNotFoundDialog(
					item,
					path,
					{
						noLocate: true,
						notOnServer: true,
						linkedFile: isLinkedFile
					}
				);
				return;
			}
			let fileExists;
			try {
				fileExists = await IOUtils.exists(path);
			}
			catch (e) {
				Zotero.logError(e);
				fileExists = false;
			}
			
			// If the file is an evicted iCloud Drive file, launch that to trigger a download.
			// As of 10.13.6, launching an .icloud file triggers the download and opens the
			// associated program (e.g., Preview) but won't actually open the file, so we wait a bit
			// for the original file to exist and then continue with regular file opening below.
			//
			// To trigger eviction for testing, use Cirrus from https://eclecticlight.co/downloads/
			if (!fileExists && Zotero.isMac && isLinkedFile) {
				// Get the path to the .icloud file
				let iCloudPath = Zotero.File.getEvictedICloudPath(path);
				if (await IOUtils.exists(iCloudPath)) {
					Zotero.debug("Triggering download of iCloud file");
					await launchFile(iCloudPath, item);
					let time = new Date();
					let maxTime = 5000;
					let revealed = false;
					while (true) {
						// If too much time has elapsed, just reveal the file in Finder instead
						if (new Date() - time > maxTime) {
							Zotero.debug(`File not available after ${maxTime} -- revealing instead`);
							try {
								Zotero.File.reveal(iCloudPath);
								revealed = true;
							}
							catch (e) {
								Zotero.logError(e);
								// In case the main file became available
								try {
									Zotero.File.reveal(path);
									revealed = true;
								}
								catch (e) {
									Zotero.logError(e);
								}
							}
							break;
						}
						
						// Wait a bit for the download and check again
						await Zotero.Promise.delay(250);
						Zotero.debug("Checking for downloaded file");
						if (await IOUtils.exists(path)) {
							Zotero.debug("File is ready");
							fileExists = true;
							break;
						}
					}
					
					if (revealed) {
						continue;
					}
				}
			}
			
			let fileSyncingEnabled = Zotero.Sync.Storage.Local.getEnabledForLibrary(item.libraryID);
			let redownload = false;
			
			// TEMP: If file is queued for download, download first. Starting in 5.0.85, files
			// modified remotely get marked as SYNC_STATE_FORCE_DOWNLOAD, causing them to get
			// downloaded at sync time even in download-as-needed mode, but this causes files
			// modified previously to be downloaded on open.
			if (fileExists
					&& !isLinkedFile
					&& fileSyncingEnabled
					&& ([
							Zotero.Sync.Storage.Local.SYNC_STATE_TO_DOWNLOAD,
							Zotero.Sync.Storage.Local.SYNC_STATE_FORCE_DOWNLOAD
					].includes(item.attachmentSyncState))) {
				Zotero.debug("File exists but is queued for download -- re-downloading");
				redownload = true;
			}
			
			if (fileExists && !redownload) {
				Zotero.debug("Opening " + path);
				Zotero.Notifier.trigger('open', 'file', item.id);
				await launchFile(path, item);
				continue;
			}
			
			if (isLinkedFile || !fileSyncingEnabled) {
				this.showAttachmentNotFoundDialog(
					item,
					path,
					{
						noLocate: noLocateOnMissing,
						notOnServer: false,
						linkedFile: isLinkedFile
					}
				);
				return;
			}
			
			try {
				let results = await Zotero.Sync.Runner.downloadFile(item);
				if (!results || !results.localChanges) {
					Zotero.debug("Download failed -- opening existing file");
				}
			}
			catch (e) {
				// TODO: show error somewhere else
				Zotero.logError(e);
				Zotero.Sync.Runner.alert(e);
				return;
			}
			
			if (!await item.getFilePathAsync()) {
				ZoteroPane_Local.showAttachmentNotFoundDialog(
					item,
					path,
					{
						noLocate: noLocateOnMissing,
						notOnServer: true
					}
				);
				return;
			}
			
			Zotero.Notifier.trigger('redraw', 'item', []);
			
			Zotero.debug("Opening " + path);
			Zotero.Notifier.trigger('open', 'file', item.id);
			await launchFile(path, item);
		}
	});
	
	this.viewPDF = async function (itemID, location) {
		await this.viewAttachment(itemID, null, false, { location });
	};
	
	
	/**
	 * Update the parent of the selected items
	 *
	 * An accessible alternative to dragging/dropping a child item between top-level items
	*/
	this.changeParentItem = async function () {
		let selectedItems = this.getSelectedItems();
		// Only applies when selected items are not top level items
		if (selectedItems.some(item => item.isRegularItem())) return;

		let libraryID = this.getSelectedLibraryID();
		let shouldConvertToStandaloneAttachment = false;
		let extraButtons = [];
		// Keep in sync with Zotero.RecognizeDocument.canRecognize()
		let canBeMovedOutOfParent = !selectedItems.some(item => item.isWebAttachment() && !item.isPDFAttachment() && !item.isEPUBAttachment());
		// Add a button to the dialog to make items standalone, if applicable
		if (canBeMovedOutOfParent) {
			// Determine which label to show. "Convert to standalone attachment(s)/note(s)"
			let allNotes = selectedItems.every(item => item.isNote());
			let allAttachments = selectedItems.every(item => item.isAttachment());
			let l10nId = `select-items-convertToStandalone${allNotes ? "Note" : ""}${allAttachments ? "Attachment" : ""}`;
			extraButtons = [{
				type: "extra1",
				l10nLabel: l10nId,
				l10nArgs: { count: selectedItems.length },
				onclick: function (event) {
					shouldConvertToStandaloneAttachment = true;
					let doc = event.target.ownerDocument;
					// if accept button is disabled, dialog cannot be accepted
					doc.querySelector("dialog button[dlgtype='accept']").removeAttribute("disabled");
					doc.querySelector("dialog").acceptDialog();
				},
				isHidden: function () {
					return selectedItems.every(item => !item.parentID);
				}
			}];
		}
		let io = {
			dataIn: null,
			dataOut: null,
			itemTreeID: 'change-parent-item-select-item-dialog',
			filterLibraryIDs: [libraryID],
			singleSelection: true,
			onlyRegularItems: true,
			hideCollections: ['duplicates', 'trash', 'feeds', 'unfiled', 'retracted', 'publications'],
			extraButtons: extraButtons
		};
		// The new parent needs to be selected in the dialog
		window.openDialog('chrome://zotero/content/selectItemsDialog.xhtml', '',
			'chrome,dialog=no,modal,centerscreen,resizable=yes', io);

		// If "Convert to Standalone Attachment" is selected, make all attachments top-level items
		if (shouldConvertToStandaloneAttachment) {
			await Zotero.DB.executeTransaction(async () => {
				for (let item of selectedItems) {
					let parent = Zotero.Items.get(item.parentID);
					if (parent) {
						// Place attachment into the same collections as the old parent item
						for (let collectionID of parent.getCollections()) {
							item.addToCollection(collectionID);
						}
					}
					// Unlink parent item
					item.parentID = null;
					await item.save({ skipSelect: true });
				}
			});
			return;
		}
		if (!io.dataOut?.length) return;

		let newParentItem = Zotero.Items.get(io.dataOut);
		
		if (!newParentItem.length) return;

		await Zotero.DB.executeTransaction(async () => {
			for (let item of selectedItems) {
				item.parentID = newParentItem[0].id;
				await item.save({ skipSelect: true });
			}
		});
	};
	/**
	 * @deprecated
	 */
	this.launchFile = function (file) {
		Zotero.debug("ZoteroPane.launchFile() is deprecated -- use Zotero.launchFile()", 2);
		Zotero.launchFile(file);
	}
	
	
	/**
	 * @deprecated
	 */
	this.launchURL = function (url) {
		Zotero.debug("ZoteroPane.launchURL() is deprecated -- use Zotero.launchURL()", 2);
		return Zotero.launchURL(url);
	}
	
	
	function viewSelectedAttachment(event, noLocateOnMissing)
	{
		if (this.itemsView && this.itemsView.selection.count == 1) {
			this.viewAttachment(this.getSelectedItems(true)[0], event, noLocateOnMissing);
		}
	}
	
	
	this.canShowItemInFilesystem = function (item) {
		return (item.isRegularItem() && item.numFileAttachments()) || item.isFileAttachment();
	};
	
	
	this.showItemsInFilesystem = async function (items = this.getSelectedItems()) {
		let attachments = (await Promise.all(
			items.map((item) => {
				if (item.isRegularItem()) {
					return item.getBestAttachment();
				}
				else if (item.isFileAttachment()) {
					return item;
				}
				else {
					return null;
				}
			})
		)).filter(Boolean);
		for (let attachment of attachments) {
			await this.showAttachmentInFilesystem(attachment.id);
		}
	};
	
	
	this.showAttachmentInFilesystem = async function (itemID, noLocateOnMissing) {
		var attachment = await Zotero.Items.getAsync(itemID)
		if (attachment.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) return;
		
		var path = attachment.getFilePath();
		var fileExists = await IOUtils.exists(path);
		
		// If file doesn't exist but an evicted iCloud Drive file does, reveal that instead
		if (!fileExists && Zotero.isMac && !attachment.isStoredFileAttachment()) {
			let iCloudPath = Zotero.File.getEvictedICloudPath(path);
			if (await IOUtils.exists(iCloudPath)) {
				path = iCloudPath;
				fileExists = true;
			}
		}
		
		if (!fileExists) {
			this.showAttachmentNotFoundDialog(
				attachment,
				path,
				{
					noLocate: noLocateOnMissing,
					notOnServer: false,
					linkedFile: attachment.isLinkedFileAttachment()
				}
			);
			return;
		}
		
		let file = Zotero.File.pathToFile(path);
		try {
			Zotero.debug("Revealing " + file.path);
			file.reveal();
		}
		catch (e) {
			// On platforms that don't support nsIFile.reveal() (e.g. Linux),
			// launch the parent directory
			Zotero.launchFile(file.parent);
		}
		Zotero.Notifier.trigger('open', 'file', attachment.id);
	};
	
	
	this.showPublicationsWizard = function (items) {
		var io = {
			hasFiles: false,
			hasNotes: false,
			hasRights: null // 'all', 'some', or 'none'
		};
		var allItemsHaveRights = true;
		var noItemsHaveRights = true;
		// Determine whether any/all items have files, notes, or Rights values
		for (let i = 0; i < items.length; i++) {
			let item = items[i];
			
			// Files
			if (!io.hasFiles && item.numAttachments()) {
				let attachmentIDs = item.getAttachments();
				io.hasFiles = Zotero.Items.get(attachmentIDs).some(
					attachment => attachment.isStoredFileAttachment()
				);
			}
			// Notes
			if (!io.hasNotes && item.numNotes()) {
				io.hasNotes = true;
			}
			// Rights
			if (item.getField('rights')) {
				noItemsHaveRights = false;
			}
			else {
				allItemsHaveRights = false;
			}
		}
		io.hasRights = allItemsHaveRights ? 'all' : (noItemsHaveRights ? 'none' : 'some');
		window.openDialog('chrome://zotero/content/publicationsDialog.xhtml', '', 'chrome,modal,centerscreen', io);
		return io.keepRights !== undefined ? io : false;
	};
	
	
	/**
	 * Test if the user can edit the currently selected view
	 *
	 * @param {Integer} [row] Row index - ignored if not in library tab
	 * @return {Boolean} TRUE if user can edit, FALSE if not
	 */
	this.canEdit = function (row) {
		switch (Zotero_Tabs.selectedType) {
			case 'library':
				// Currently selected row
				if (row === undefined) {
					row = this.collectionsView.selection.focused;
				}
				return this.collectionsView.getRow(row).editable;
			case 'reader': {
				let itemID = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)?.itemID;
				if (!itemID) {
					throw new Error('Reader tab has no itemID');
				}
				return Zotero.Items.get(itemID).library.editable;
			}
			default:
				return false;
		}
	};
	
	
	/**
	 * Test if the user can edit the parent library of the selected view
	 *
	 * @param {Integer} [row] Row index - ignored if not in library tab
	 * @return {Boolean} TRUE if user can edit, FALSE if not
	 */
	this.canEditLibrary = function (row) {
		switch (Zotero_Tabs.selectedType) {
			case 'library': // Currently selected row
				if (row === undefined) {
					row = this.collectionsView.selection.focused;
				}
				return Zotero.Libraries.get(this.collectionsView.getRow(row).ref.libraryID).editable;
			default:
				// All non-library tabs: canEditLibrary() == canEdit()
				return this.canEdit(row);
		}
	};
	
	
	/**
	 * Test if the user can edit the currently selected library/collection
	 *
	 * @param	{Integer}	[row]
	 *
	 * @return	{Boolean}		TRUE if user can edit, FALSE if not
	 */
	this.canEditFiles = function (row) {
		switch (Zotero_Tabs.selectedType) {
			case 'library':
				// Currently selected row
				if (row === undefined) {
					row = this.collectionsView.selection.focused;
				}
				return this.collectionsView.getRow(row).filesEditable;
			case 'reader': {
				let itemID = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)?.itemID;
				if (!itemID) {
					throw new Error('Reader tab has no itemID');
				}
				return Zotero.Items.get(itemID).library.filesEditable;
			}
			default:
				return false;
		}
	};
	
	
	this.displayCannotEditLibraryMessage = function () {
		Services.prompt.alert(null, "", Zotero.getString('save.error.cannotMakeChangesToCollection'));
	}
	
	
	this.displayCannotEditLibraryFilesMessage = function () {
		Services.prompt.alert(null, "", Zotero.getString('save.error.cannotAddFilesToCollection'));
	}
	
	
	this.displayCannotAddToMyPublicationsMessage = function () {
		Services.prompt.alert(null, "", Zotero.getString('save.error.cannotAddToMyPublications'));
	}
	
	
	// TODO: Figure out a functioning way to get the original path and just copy the real file
	this.displayCannotAddShortcutMessage = function (path) {
		Zotero.alert(
			null,
			Zotero.getString("general.error"),
			Zotero.getString("file.error.cannotAddShortcut") + (path ? "\n\n" + path : "")
		);
	}
	
	
	this.showAttachmentNotFoundDialog = async function (item, path, options = {}) {
		var { noLocate, notOnServer, linkedFile } = options;

		if (item.isLinkedFileAttachment() && await this.checkForLinkedFilesToRelink(item)) {
			return;
		}

		var title = Zotero.getString('pane.item.attachments.fileNotFound.title');
		var text = Zotero.getString(
				'pane.item.attachments.fileNotFound.text1' + (path ? '.path' : '')
			)
			+ (path ? "\n\n" + path : '')
			+ "\n\n"
			+ Zotero.getString(
				'pane.item.attachments.fileNotFound.text2.'
					+ (options.linkedFile
						? 'linked'
						: 'stored' + (notOnServer ? '.notOnServer' : '')
					),
				[ZOTERO_CONFIG.CLIENT_NAME, ZOTERO_CONFIG.DOMAIN_NAME]
			);
		var supportURL = linkedFile
			? 'https://www.zotero.org/support/kb/missing_linked_file'
			: 'https://www.zotero.org/support/kb/files_not_syncing';
		
		var ps = Services.prompt;
		
		// Don't show Locate button
		if (noLocate) {
			let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK
				+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
			let index = ps.confirmEx(null,
				title,
				text,
				buttonFlags,
				null,
				Zotero.getString('general.moreInformation'),
				null, null, {}
			);
			if (index == 1) {
				this.loadURI(supportURL, { metaKey: true, shiftKey: true });
			}
			return;
		}
		
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
		var index = ps.confirmEx(null,
			title,
			text,
			buttonFlags,
			Zotero.getString('general.locate'),
			null,
			Zotero.getString('general.moreInformation')
			, null, {}
		);
		
		if (index == 0) {
			this.relinkAttachment(item.id);
		}
		else if (index == 2) {
			this.loadURI(supportURL, { metaKey: true, shiftKey: true });
		}
	}


	/**
	 * Prompt the user to relink one or all of the attachment files found in
	 * the LABD.
	 *
	 * @param {Zotero.Item} item
	 * @param {String} path Path to the file matching `item`
	 * @param {Number} numOthers If zero, "Relink All" option is not offered
	 * @return {'one' | 'all' | 'manual' | 'cancel'}
	 */
	this.showLinkedFileFoundAutomaticallyDialog = function (item, path, numOthers) {
		let ps = Services.prompt;

		let title = Zotero.getString('pane.item.attachments.autoRelink.title');
		let text = Zotero.getString('pane.item.attachments.autoRelink.text1') + '\n\n'
			+ Zotero.getString('pane.item.attachments.autoRelink.text2', item.getFilePath()) + '\n\n'
			+ Zotero.getString('pane.item.attachments.autoRelink.text3', path) + '\n\n'
			+ Zotero.getString('pane.item.attachments.autoRelink.text4', Zotero.appName);
		let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
		let index = ps.confirmEx(null,
			title,
			text,
			buttonFlags,
			Zotero.getString('pane.item.attachments.autoRelink.relink'),
			null,
			Zotero.getString('pane.item.attachments.autoRelink.locateManually'),
			null, {}
		);
		
		if (index == 1) {
			// Cancel
			return 'cancel';
		}
		else if (index == 2) {
			// Locate Manually...
			return 'manual';
		}
		
		// Relink
		if (!numOthers) {
			return 'one';
		}

		title = Zotero.getString('pane.item.attachments.autoRelinkOthers.title');
		text = Zotero.getString('pane.item.attachments.autoRelinkOthers.text', numOthers, numOthers);
		buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
		index = ps.confirmEx(null,
			title,
			text,
			buttonFlags,
			Zotero.getString(
				numOthers == 1
					? 'pane.item.attachments.autoRelink.relink'
					: 'pane.item.attachments.autoRelink.relinkAll'
			),
			null, null, null, {}
		);
		
		return index == 0 ? 'all' : 'one';
	};
	
	
	this.recognizeSelected = function() {
		Zotero.RecognizeDocument.recognizeItems(ZoteroPane.getSelectedItems());
		Zotero.ProgressQueues.get('recognize').getDialog().open();
	};
	
	
	this.unrecognizeSelected = async function () {
		var items = ZoteroPane.getSelectedItems();
		for (let item of items) {
			await Zotero.RecognizeDocument.unrecognize(item);
		}
	};
	
	
	this.createParentItemsFromSelected = async function () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		let items = this.getSelectedItems();

		if (items.length > 1) {
			for (let i = 0; i < items.length; i++) {
				let item = items[i];
				if (!item.isTopLevelItem() || item.isRegularItem()) {
					throw new Error('Item ' + item.id + ' is not a top-level attachment');
				}

				await this.createEmptyParent(item);
			}
		}
		else {
			// Ask for an identifier if there is only one item
			let item = items[0];
			if (!item.isAttachment() || !item.isTopLevelItem()) {
				throw new Error('Item ' + item.id + ' is not a top-level attachment');
			}

			let io = { dataIn: { item }, dataOut: null };
			window.openDialog('chrome://zotero/content/createParentDialog.xhtml', '', 'chrome,modal,centerscreen', io);
			if (!io.dataOut) {
				return false;
			}

			// If we made a parent, attach the child
			if (io.dataOut.parent) {
				await Zotero.DB.executeTransaction(async function () {
					item.parentID = io.dataOut.parent.id;
					await item.save();
				});
			}
			// If they clicked manual entry then make a dummy parent
			else {
				await this.createEmptyParent(item);
			}
		}

		for (let item of items) {
			if (Zotero.Attachments.shouldAutoRenameAttachment(item)) {
				let path = item.getFilePath();
				if (!path) {
					Zotero.debug('No path for attachment ' + item.key);
					continue;
				}
				let fileBaseName = Zotero.Attachments.getFileBaseNameFromItem(item.parentItem, { attachmentTitle: item.getField('title') });
				let ext = Zotero.Attachments.getCorrectFileExtension(item);
				let newName = fileBaseName + (ext ? '.' + ext : '');
				let result = await item.renameAttachmentFile(newName, false, true);
				if (result !== true) {
					throw new Error('Error renaming ' + path);
				}
				item.setAutoAttachmentTitle({ ignoreAutoRenamePrefs: true });
				await item.saveTx();
			}
		}
	};
	
	
	this.addNoteFromAnnotationsForAttachment = async function (attachment, { skipSelect } = {}) {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		if (attachment.isPDFAttachment()) {
			await Zotero.PDFWorker.import(attachment.id, true);
		}
		var annotations = attachment.getAnnotations().filter(x => x.annotationType != 'ink');
		if (!annotations.length) {
			return;
		}
		var note = await Zotero.EditorInstance.createNoteFromAnnotations(
			annotations,
			{
				parentID: attachment.parentID
			}
		);
		if (!skipSelect) {
			await this.selectItem(note.id);
		}
		return note;
	};
	
	
	/**
	 * Add a single child note with the annotations from all selected items, including from all
	 * child attachments of a selected regular item
	 *
	 * Selected items must all have the same top-level item
	 */
	this.addNoteFromAnnotationsFromSelected = async function () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		var items = this.getSelectedItems();
		var topLevelItems = [...new Set(Zotero.Items.getTopLevel(items))];
		if (topLevelItems.length > 1) {
			throw new Error("Can't create child attachment from different top-level items");
		}
		var topLevelItem = topLevelItems[0];
		if (!topLevelItem.isRegularItem()) {
			throw new Error("Can't add note to standalone attachment");
		}
		
		// Ignore top-level item if specific child items are also selected
		if (items.length > 1) {
			items = items.filter(item => !item.isRegularItem());
		}
		
		var attachments = [];
		for (let item of items) {
			if (item.isRegularItem()) {
				// Find all child items with extractable annotations
				attachments.push(
					...Zotero.Items.get(item.getAttachments())
						.filter(item => isAttachmentWithExtractableAnnotations(item))
				);
			}
			else if (isAttachmentWithExtractableAnnotations(item)) {
				attachments.push(item);
			}
			else {
				continue;
			}
		}
		
		if (!attachments.length) {
			Zotero.debug("No attachments found", 2);
			return;
		}
		
		var annotations = [];
		for (let attachment of attachments) {
			if (attachment.isPDFAttachment()) {
				try {
					await Zotero.PDFWorker.import(attachment.id, true);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			annotations.push(...attachment.getAnnotations().filter(x => x.annotationType != 'ink'));
		}
		var note = await Zotero.EditorInstance.createNoteFromAnnotations(
			annotations,
			{
				parentID: topLevelItem.id
			}
		);
		await this.selectItem(note.id);
	};
	
	
	/**
	 * Create separate child notes for each selected item, including all child attachments of
	 * selected regular items
	 *
	 * No longer exposed via UI
	 */
	this.addNotesFromAnnotationsFromSelected = async function () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		var items = this.getSelectedItems();
		var itemIDsToSelect = [];
		for (let item of items) {
			let attachments = [];
			if (item.isRegularItem()) {
				// Find all child attachments with extractable annotations
				attachments.push(
					...Zotero.Items.get(item.getAttachments())
						.filter(item => isAttachmentWithExtractableAnnotations(item))
				);
			}
			else if (item.isFileAttachment() && !item.isTopLevelItem()) {
				attachments.push(item);
			}
			else if (items.length == 1) {
				throw new Error("Not a regular item or child file attachment");
			}
			else {
				continue;
			}
			for (let attachment of attachments) {
				let note = await this.addNoteFromAnnotationsForAttachment(
					attachment,
					{ skipSelect: true }
				);
				if (note) {
					itemIDsToSelect.push(note.id);
				}
			}
		}
		await this.selectItems(itemIDsToSelect);
	};
	
	
	this.createStandaloneNoteFromAnnotationsFromSelected = async function () {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		var items = this.getSelectedItems();
		
		// Ignore selected top-level items if any descendant items are also selected
		var topLevelOfSelectedDescendants = new Set();
		for (let item of items) {
			if (!item.isTopLevelItem()) {
				topLevelOfSelectedDescendants.add(item.topLevelItem);
			}
		}
		items = items.filter(item => !topLevelOfSelectedDescendants.has(item));
		
		var annotations = [];
		for (let item of items) {
			let attachments = [];
			if (item.isRegularItem()) {
				// Find all child attachments with extractable annotations
				attachments.push(
					...Zotero.Items.get(item.getAttachments())
						.filter(item => isAttachmentWithExtractableAnnotations(item))
				);
			}
			else if (isAttachmentWithExtractableAnnotations(item)) {
				attachments.push(item);
			}
			else {
				continue;
			}
			for (let attachment of attachments) {
				if (attachment.isPDFAttachment()) {
					try {
						await Zotero.PDFWorker.import(attachment.id, true);
					}
					catch (e) {
						Zotero.logError(e);
					}
				}
				annotations.push(...attachment.getAnnotations().filter(x => x.annotationType != 'ink'));
			}
		}
		
		if (!annotations.length) {
			Zotero.debug("No annotations found", 2);
			return;
		}
		
		var note = await Zotero.EditorInstance.createNoteFromAnnotations(
			annotations,
			{
				collectionID: this.getSelectedCollection(true)
			}
		);
		await this.selectItem(note.id);
	};
	
	
	this.createEmptyParent = async function (item) {
		await Zotero.DB.executeTransaction(async function () {
			// TODO: remove once there are no top-level web attachments
			if (item.isWebAttachment()) {
				var parent = new Zotero.Item('webpage');
			}
			else {
				var parent = new Zotero.Item('document');
			}
			parent.libraryID = item.libraryID;
			
			let title = item.getField('title');
			// If the attachment was named after its filename, remove the extension
			if (title === item.attachmentFilename) {
				title = title.replace(/\.[^.]+$/, '');
			}
			parent.setField('title', title);
			
			if (item.isWebAttachment()) {
				parent.setField('accessDate', item.getField('accessDate'));
				parent.setField('url', item.getField('url'));
			}
			
			let itemID = await parent.save();
			item.parentID = itemID;
			await item.save();
		});
	};
	
	
	this.exportPDF = async function (itemID) {
		let item = await Zotero.Items.getAsync(itemID);
		if (!item || !item.isPDFAttachment()) {
			throw new Error('Item ' + itemID + ' is not a PDF attachment');
		}
		let filename = item.attachmentFilename;
		
		var fp = new FilePicker();
		// TODO: Localize
		fp.init(window, "Export File", fp.modeSave);
		fp.appendFilter("PDF", "*.pdf");
		fp.defaultString = filename;
		
		var rv = await fp.show();
		if (rv === fp.returnOK || rv === fp.returnReplace) {
			let outputFile = fp.file;
			await Zotero.PDFWorker.export(item.id, outputFile, true);
		}
	};
	
	
	// TEMP: Quick implementation
	this.exportSelectedFiles = async function () {
		var items = ZoteroPane.getSelectedItems()
			.reduce((arr, item) => {
				if (item.isPDFAttachment()) {
					return arr.concat([item]);
				}
				if (item.isRegularItem()) {
					return arr.concat(item.getAttachments()
						.map(x => Zotero.Items.get(x))
						.filter(x => x.isPDFAttachment()));
				}
				return arr;
			}, []);
		// Deduplicate, in case parent and child items are both selected
		items = [...new Set(items)];
		
		if (!items.length) return;
		if (items.length == 1) {
			await this.exportPDF(items[0].id);
			return;
		}
		
		var fp = new FilePicker();
		// TODO: Localize
		fp.init(window, "Export Files", fp.modeGetFolder);
		
		var rv = await fp.show();
		if (rv === fp.returnOK || rv === fp.returnReplace) {
			let folder = fp.file;
			for (let item of items) {
				let outputFile = PathUtils.join(folder, item.attachmentFilename);
				if (await IOUtils.exists(outputFile)) {
					let newNSIFile = Zotero.File.pathToFile(outputFile);
					newNSIFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o644);
					outputFile = newNSIFile.path;
					newNSIFile.remove(null);
				}
				await Zotero.PDFWorker.export(item.id, outputFile, true);
			}
		}
	};
	
	
	this.renameSelectedAttachmentsFromParents = async function () {
		// TEMP: fix
		
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var items = this.getSelectedItems();
		if (!items.length) return;
		
		var progressWin = new Zotero.ProgressWindow();
		
		for (var i=0; i<items.length; i++) {
			var item = items[i];
			
			if (!item.isAttachment() || item.isTopLevelItem() || item.attachmentLinkMode == Zotero.Attachments.LINK_MODE_LINKED_URL) {
				throw('Item ' + itemID + ' is not a child file attachment in ZoteroPane_Local.renameAttachmentFromParent()');
			}
			
			var file = await item.getFilePathAsync();
			if (!file) {
				continue;
			}
			
			let parentItemID = item.parentItemID;
			let parentItem = await Zotero.Items.getAsync(parentItemID);
			var oldBaseName = item.attachmentFilename.replace(/\.[^.]+$/, '');
			var fileBaseName = Zotero.Attachments.getFileBaseNameFromItem(parentItem, { attachmentTitle: item.getField('title') });
			let ext = Zotero.Attachments.getCorrectFileExtension(item);
			let newName = fileBaseName + (ext ? '.' + ext : '');
			
			var renamed = await item.renameAttachmentFile(newName, false, true);
			if (renamed !== true) {
				Zotero.debug("Could not rename file (" + renamed + ")");
				continue;
			}
			
			if (item.getField('title') === oldBaseName) {
				item.setAutoAttachmentTitle({ ignoreAutoRenamePrefs: true });
				await item.saveTx();
			}
			
			let str = await document.l10n.formatValue('file-renaming-file-renamed-to', { filename: newName });
			progressWin.addLines(str, item.getItemTypeIconName());
			progressWin.show();
		}
		
		progressWin.startCloseTimer(4000);
	};
	
	
	this.convertLinkedFilesToStoredFiles = async function () {
		if (!this.canEdit() || !this.canEditFiles()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var items = this.getSelectedItems();
		var attachments = new Set();
		for (let item of items) {
			// Add all child link attachments of regular items
			if (item.isRegularItem()) {
				for (let id of item.getAttachments()) {
					let attachment = await Zotero.Items.getAsync(id);
					if (attachment.isLinkedFileAttachment()) {
						attachments.add(attachment);
					}
				}
			}
			// And all selected link attachments
			else if (item.isLinkedFileAttachment()) {
				attachments.add(item);
			}
		}
		var num = attachments.size;
		
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
		var deleteOriginal = {};
		var index = ps.confirmEx(null,
			Zotero.getString('attachment.convertToStored.title', [num], num),
			Zotero.getString('attachment.convertToStored.text', [num], num),
			buttonFlags,
			Zotero.getString('general.continue'),
			null,
			null,
			Zotero.getString('attachment.convertToStored.deleteOriginal', [num], num),
			deleteOriginal
		);
		if (index != 0) {
			return;
		}
		for (let item of attachments) {
			try {
				let converted = await Zotero.Attachments.convertLinkedFileToStoredFile(
					item,
					{
						move: deleteOriginal.value
					}
				);
				if (!converted) {
					// Not found
					continue;
				}
			}
			catch (e) {
				Zotero.logError(e);
				continue;
			}
		}
	};


	/**
	 * Attempt to find a file in the LABD matching the passed attachment
	 * by searching successive subdirectories. Prompt the user if a match is
	 * found and offer to relink one or all matching files in the directory.
	 * The user can also choose to relink manually, which opens a file picker.
	 *
	 * If the synced path is 'C:\Users\user\Documents\Dissertation\Files\Paper.pdf',
	 * the LABD is '/Users/user/Documents', and the (not yet known) correct local
	 * path is '/Users/user/Documents/Dissertation/Files/Paper.pdf', check:
	 *
	 * 1. /Users/user/Documents/Users/user/Documents/Dissertation/Files/Paper.pdf
	 * 2. /Users/user/Documents/user/Documents/Dissertation/Files/Paper.pdf
	 * 3. /Users/user/Documents/Documents/Dissertation/Files/Paper.pdf
	 * 4. /Users/user/Documents/Dissertation/Files/Paper.pdf
	 *
	 * If line 4 had not been the correct local path (in other words, if no file
	 * existed at that path), we would have continued on to check
	 * '/Users/user/Documents/Dissertation/Paper.pdf'. If that did not match,
	 * with no more segments in the synced path to drop, we would have given up.
	 *
	 * Once we find the file, check for other linked files beginning with
	 * C:\Users\user\Documents\Dissertation\Files and see if they exist relative
	 * to /Users/user/Documents/Dissertation/Files, and prompt to relink them
	 * all if so.
	 *
	 * @param {Zotero.Item} item
	 * @return {Promise<Boolean>} True if relinked successfully or canceled
	 */
	this.checkForLinkedFilesToRelink = async function (item) {
		const PATH_SEP = Zotero.isWin ? '\\' : '/';
		
		// Split on any separator, join with the platform separator for PathUtils
		let split = path => path.split(/[/\\]/);
		let join = (base, ...segments) => [base.replace(/\//g, PATH_SEP), ...segments].join(PATH_SEP);
		
		Zotero.debug('Attempting to relink automatically');
		
		let basePath = Zotero.Prefs.get('baseAttachmentPath');
		if (!basePath) {
			Zotero.debug('No LABD');
			return false;
		}
		basePath = Zotero.File.normalizeToUnix(basePath);
		Zotero.debug('LABD path: ' + basePath);

		let syncedPath = item.getFilePath();
		if (!syncedPath) {
			Zotero.debug('No synced path');
			return false;
		}
		syncedPath = Zotero.File.normalizeToUnix(syncedPath);
		Zotero.debug('Synced path: ' + syncedPath);

		if (Zotero.File.directoryContains(basePath, syncedPath)) {
			// Already in the LABD - nothing to do
			Zotero.debug('Synced path is already within LABD');
			return false;
		}

		// We can't use PathUtils.parent because that function expects paths valid for the current platform...
		// but we can't normalize first because we're going to be comparing it to other un-normalized paths
		let unNormalizedDirname = item.getFilePath();
		let lastSlash = Math.max(
			unNormalizedDirname.lastIndexOf('/'),
			unNormalizedDirname.lastIndexOf('\\')
		);
		if (lastSlash != -1) {
			unNormalizedDirname = unNormalizedDirname.substring(0, lastSlash + 1);
		}

		let parts = split(syncedPath);
		for (let segmentsToDrop = 0; segmentsToDrop < parts.length; segmentsToDrop++) {
			let correctedPath = join(basePath, ...parts.slice(segmentsToDrop));

			try {
				if (!(await IOUtils.exists(correctedPath))) {
					Zotero.debug('Does not exist: ' + correctedPath);
					continue;
				}
			}
			catch (e) {
				// IOUtils.exists() throws if the path is invalid - suppress that
				if (e.message.includes('Could not parse path')) {
					Zotero.debug('Invalid path: ' + correctedPath);
					continue;
				}
				// Otherwise this could be a meaningful filesystem error, so re-throw
				throw e;
			}
			Zotero.debug('Exists! ' + correctedPath);

			let otherUnlinked = await Zotero.Items.findMissingLinkedFiles(
				item.libraryID,
				unNormalizedDirname
			);
			let othersToRelink = new Map();
			for (let otherItem of otherUnlinked) {
				if (otherItem.id === item.id) continue;
				let otherParts = split(otherItem.getFilePath())
					// Slice as much off the beginning as when creating correctedPath
					.slice(segmentsToDrop);
				if (!otherParts.length) continue;
				let otherCorrectedPath = join(basePath, ...otherParts);
				if (await IOUtils.exists(otherCorrectedPath)) {
					othersToRelink.set(otherItem, otherCorrectedPath);
				}
			}

			let choice = this.showLinkedFileFoundAutomaticallyDialog(item, correctedPath, othersToRelink.size);
			switch (choice) {
				case 'one':
					await item.relinkAttachmentFile(correctedPath);
					return true;
				case 'all':
					await item.relinkAttachmentFile(correctedPath);
					for (let [otherItem, otherCorrectedPath] of othersToRelink) {
						await otherItem.relinkAttachmentFile(otherCorrectedPath);
					}
					return true;
				case 'manual':
					await this.relinkAttachment(item.id);
					return true;
				case 'cancel':
					return true;
			}
		}
		
		Zotero.debug('No segments left to drop; match not found in LABD');
		return false;
	};
	
	
	this.relinkAttachment = async function (itemID) {
		if (!this.canEdit()) {
			this.displayCannotEditLibraryMessage();
			return;
		}
		
		var item = Zotero.Items.get(itemID);
		if (!item) {
			throw new Error('Item ' + itemID + ' not found in ZoteroPane_Local.relinkAttachment()');
		}

		while (true) {
			let fp = new FilePicker();
			fp.init(window, Zotero.getString('pane.item.attachments.select'), fp.modeOpen);
			
			var file = item.getFilePath();
			if (!file) {
				Zotero.debug("Invalid path", 2);
				break;
			}
			
			var dir = await Zotero.File.getClosestDirectory(file);
			if (dir) {
				try {
					fp.displayDirectory = dir;
				}
				catch (e) {
					// Directory is invalid; ignore and go with the home directory
					fp.displayDirectory = OS.Constants.Path.homeDir;
				}
			}
			
			fp.appendFilters(fp.filterAll);
			
			if (await fp.show() == fp.returnOK) {
				let file = Zotero.File.pathToFile(fp.file);
				
				// Disallow hidden files
				// TODO: Display a message
				if (file.leafName.startsWith('.')) {
					continue;
				}
				
				// Disallow Windows shortcuts
				if (file.leafName.endsWith(".lnk")) {
					this.displayCannotAddShortcutMessage(file.path);
					continue;
				}
				
				await item.relinkAttachmentFile(file.path);
				break;
			}
			
			break;
		}
	};
	
	var itemReadPromise;
	this.startItemReadTimeout = function (feedItemID) {
		if (itemReadPromise) {
			itemReadPromise.cancel();
		}
		
		const FEED_READ_TIMEOUT = 1000;
		
		itemReadPromise = Zotero.Promise.delay(FEED_READ_TIMEOUT)
		.then(async function () {
			itemReadPromise = null;
			
			// Check to make sure we're still on the same item
			var items = this.getSelectedItems();
			if (items.length != 1 || items[0].id != feedItemID) {
				return;
			}
			var feedItem = items[0];
			if (!(feedItem instanceof Zotero.FeedItem)) {
				throw new Zotero.Promise.CancellationError('Not a FeedItem');
			}
			if (feedItem.isRead) {
				return;
			}
			
			await feedItem.toggleRead(true);
			this.itemPane.setReadLabel(true);
		}.bind(this))
		.catch(function (e) {
			if (e instanceof Zotero.Promise.CancellationError) {
				Zotero.debug(e.message);
				return;
			}
			Zotero.logError(e);
		});
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
		var win = ww.openWindow(null, "chrome://zotero/content/errorReport.xhtml",
					"zotero-error-report", "chrome,centerscreen,modal", io);
	}
	
	this.displayErrorMessage = function (popup) {
		Zotero.debug("ZoteroPane.displayErrorMessage() is deprecated -- use Zotero.crash() instead");
		Zotero.crash(popup);
	}
	
	this.displayStartupError = function(asPaneMessage) {
		if (Zotero) {
			var errMsg = Zotero.startupError;
			var errFunc = Zotero.startupErrorHandler;
		}
		
		var stringBundleService = Services.strings;
		var src = 'chrome://zotero/locale/zotero.properties';
		var stringBundle = stringBundleService.createBundle(src);
		
		var title = stringBundle.GetStringFromName('general.error');
		if (!errMsg) {
			var appName = Zotero && Zotero.appName
				? Zotero.appName
				: stringBundleService
					.createBundle('chrome://branding/locale/brand.properties')
					.GetStringFromName('brandShortName');
			var errMsg = stringBundle.formatStringFromName('startupError', [appName], 1);
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
				Zotero.alert(null, title, errMsg);
			//}
		}
	}
	
	
	/**
	 * Set descending z-index on banner containers so drop-shadow works when multiple are visible
	 */
	this.setBannerZIndexes = function () {
		var containers = document.querySelectorAll('.banner-container');
		var max = containers.length;
		for (let container of containers) {
			container.style.zIndex = max--;
		}
	};
	
	
	/**
	 * Show a retraction banner if there are retracted items that we haven't warned about
	 */
	this.showRetractionBanner = async function (items) {
		var items;
		try {
			items = JSON.parse(Zotero.Prefs.get('retractions.recentItems'));
		}
		catch (e) {
			Zotero.Prefs.clear('retractions.recentItems');
			Zotero.logError(e);
			return;
		}
		if (!items.length) {
			return;
		}
		items = await Zotero.Items.getAsync(items);
		if (!items.length) {
			return;
		}
		
		document.getElementById('retracted-items-container').removeAttribute('collapsed');
		
		var message = document.getElementById('retracted-items-message');
		var link = document.getElementById('retracted-items-link');
		var close = document.getElementById('retracted-items-close');
		
		var suffix = items.length > 1 ? 'multiple' : 'single';
		message.textContent = Zotero.getString('retraction.alert.' + suffix);
		link.textContent = Zotero.getString('retraction.alert.view.' + suffix);
		link.onclick = async function () {
			this.hideRetractionBanner();
			// Select newly detected item if only one
			if (items.length == 1) {
				await this.selectItem(items[0].id);
			}
			// Otherwise select Retracted Items collection
			else {
				let libraryID = this.getSelectedLibraryID();
				await this.collectionsView.selectByID("R" + libraryID);
			}
		}.bind(this);
		
		close.onclick = function () {
			this.hideRetractionBanner();
		}.bind(this);
	};
	
	
	this.hideRetractionBanner = function () {
		document.getElementById('retracted-items-container').setAttribute('collapsed', true);
		Zotero.Prefs.clear('retractions.recentItems');
	};
	
	
	this.promptToHideRetractionForReplacedItem = function (item) {
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
		let index = ps.confirmEx(
			null,
			Zotero.getString('retraction.replacedItem.title'),
			Zotero.getString('retraction.replacedItem.text1')
				+ "\n\n"
				+ Zotero.getString('retraction.replacedItem.text2'),
			buttonFlags,
			Zotero.getString('retraction.replacedItem.button'),
			null,
			null,
			null,
			{}
		);
		if (index == 0) {
			Zotero.Retractions.hideRetraction(item);
			this.hideRetractionBanner();
		}
	};

	/**
	 * Shows a Mac Word plugin installation warning (intended to be used with Sequoia and up)
	 * before the installer displays the "scary" OS prompt to access other application data.
	 * @returns {Promise<Object>} Object with either install, dismiss or remindLater set to true.
	 */
	this.showMacWordPluginInstallWarning = function () {
		return new Promise((resolve) => {
			const panel = document.getElementById('mac-word-plugin-install-container');
			const action = document.getElementById('mac-word-plugin-install-action');
			const remind = document.getElementById('mac-word-plugin-install-remind-later');
			const dontAskAgain = document.getElementById('mac-word-plugin-install-dont-ask-again');
			
			// TODO: Replace with ftl string
			dontAskAgain.label = Zotero.getString('general.dontAskAgain');
			
			panel.removeAttribute('collapsed');
			action.onclick = () => {
				this.hideMacWordPluginInstallWarning();
				resolve({ install: true });
			};
			remind.onclick = () => {
				this.hideMacWordPluginInstallWarning();
				resolve({ remindLater: true });
			};
			dontAskAgain.onclick = () => {
				this.hideMacWordPluginInstallWarning();
				resolve({ dontAskAgain: true });
			};
		});
	};
	
	this.hideMacWordPluginInstallWarning = function () {
		document.querySelector('#mac-word-plugin-install-container').setAttribute('collapsed', true);
	};

	this.showArchitectureWarning = async function () {
		const remindInterval = 60 * 60 * 24 * 30;
		const lastDisplayed = Zotero.Prefs.get('architecture.warning.lastDisplayed') ?? 0;
		
		if (lastDisplayed > Math.round(Date.now() / 1000) - remindInterval) {
			return;
		}
		
		const isWow64 = (await Services.sysinfo.processInfo).isWow64;
		const isX64OnArm = Zotero.isWin64EmulatedOnArm();
		
		if (Zotero.isWin && (isWow64 || isX64OnArm)) {
			let panel = document.getElementById('architecture-warning-container');
			let action = document.getElementById('architecture-warning-action');
			let close = document.getElementById('architecture-warning-close');
			let remind = document.getElementById('architecture-warning-remind');
			let message = document.getElementById('architecture-warning-message');

			if (isWow64) {
				message.dataset.l10nId = 'architecture-win32-warning-message';
				action.dataset.l10nId = 'architecture-warning-action';
			}
			else if (isX64OnArm) {
				message.dataset.l10nId = 'architecture-x64-on-arm64-message';
				action.dataset.l10nId = 'architecture-x64-on-arm64-action';
			}
			
			panel.removeAttribute('collapsed');
			action.onclick = function () {
				let url = Zotero.isBetaBuild
					? 'https://www.zotero.org/support/beta_builds'
					: 'https://www.zotero.org/download/';
				Zotero.launchURL(url);
			};
			close.onclick = function () {
				this.hideArchitectureWarning();
			}.bind(this);
			remind.onclick = function () {
				Zotero.Prefs.set(`architecture.warning.lastDisplayed`, Math.round(Date.now() / 1000));
				this.hideArchitectureWarning();
			}.bind(this);
		}
	};

	this.hideArchitectureWarning = function () {
		document.getElementById('architecture-warning-container').setAttribute('collapsed', true);
	};

	
	this.showPostUpgradeBanner = function () {
		if (Zotero.isBetaBuild || Zotero.Prefs.get('firstRunGuidanceShown.z7Banner')) {
			return;
		}
		document.getElementById('post-upgrade-container').removeAttribute('collapsed');
		this.updatePostUpgradeBanner();
	};
	
	
	this.updatePostUpgradeBanner = function () {
		document.getElementById('post-upgrade-density').value = Zotero.Prefs.get('uiDensity');
	};
	
	
	this.hidePostUpgradeBanner = function (remindMeLater = false) {
		document.getElementById('post-upgrade-container').setAttribute('collapsed', true);
		if (remindMeLater) {
			// The pref should already be false if the banner was showing, but just in case
			Zotero.Prefs.set('firstRunGuidanceShown.z7Banner', false);
			setTimeout(() => {
				this.showPostUpgradeBanner();
			}, 1000 * 60 * 60 * 24); // 24 hours
		}
		else {
			Zotero.Prefs.set('firstRunGuidanceShown.z7Banner', true);
		}
	};


	/**
	 * Sets the layout to either a three-vertical-pane layout and a layout where itemsPane is above itemPane
	 */
	this.updateLayout = function() {
		var layoutSwitcher = document.getElementById("zotero-layout-switcher");
		var itemsSplitter = document.getElementById("zotero-items-splitter");
		var sidenav = document.getElementById("zotero-view-item-sidenav");
		// DeepTutorZ: add chatbot splitter into the collection
		var chatbotSplitter = document.getElementById("zotero-deeptutor-splitter");

		if (Zotero.Prefs.get("layout") === "stacked") { // itemsPane above itemPane
			layoutSwitcher.setAttribute("orient", "vertical");
			itemsSplitter.setAttribute("orient", "vertical");
			chatbotSplitter.setAttribute("orient", "vertical");
			sidenav.classList.add("stacked");
			this.itemPane.classList.add("stacked");
			document.documentElement.classList.add("stacked");
		}
		else {  // three-vertical-pane
			layoutSwitcher.setAttribute("orient", "horizontal");
			itemsSplitter.setAttribute("orient", "horizontal");
			chatbotSplitter.setAttribute("orient", "horizontal");
			sidenav.classList.remove("stacked");
			this.itemPane.classList.remove("stacked");
			document.documentElement.classList.remove("stacked");
		}

		this.updateLayoutConstraints();
		if (ZoteroPane.itemsView) {
			// Need to immediately rerender the items here without any debouncing
			// since tree height will have changed
			ZoteroPane.itemsView._updateHeight();
		}
		ZoteroContextPane.update();
	}
	
	
	this.getState = function () {
		return {
			type: 'pane',
			tabs: Zotero_Tabs.getState()
		};
	};
	
	/**
	 * Unserializes zotero-persist elements from preferences
	 */
	this.unserializePersist = function () {
		_unserialized = true;
		var serializedValues = Zotero.Prefs.get("pane.persist") || "{}";
		serializedValues = JSON.parse(serializedValues);
		
		for (var id in serializedValues) {
			var el = document.getElementById(id);
			if (!el) {
				Zotero.debug(`Trying to restore persist data for #${id} but elem not found`, 5);
				continue;
			}
			
			let allowedAttributes = (el.getAttribute('zotero-persist') || '').split(/[\s,]+/);
			
			var elValues = serializedValues[id];
			for (var attr in elValues) {
				// Ignore persisted collapsed state for collection and item pane splitters, since
				// people close them by accident and don't know how to get them back
				// TODO: Add a hidden pref to allow them to stay closed if people really want that?
				if ((el.id == 'zotero-collections-splitter' || el.id == 'zotero-items-splitter')
						&& attr == 'state'
						&& Zotero.Prefs.get('reopenPanesOnRestart')) {
					continue;
				}
				// For some reason, the persisted state of the splitter is empty. This will cause
				// the splitter to behave unexpectedly. We set it to 'collapsed' here.
				if (["zotero-context-splitter-stacked", "zotero-context-splitter"].includes(el.id)
						&& attr === 'state' && elValues[attr] === '') {
					elValues[attr] = 'collapsed';
				}
				// Ignore attributes that are no longer persisted for the element
				if (!allowedAttributes.includes(attr)) {
					Zotero.debug(`Not restoring '${attr}' for #${id}`);
					continue;
				}
				if (["width", "height"].includes(attr)) {
					el.style[attr] = `${elValues[attr]}px`;
				}
				el.setAttribute(attr, elValues[attr]);
			}
		}
		
		if (this.itemsView) {
			// may not yet be initialized
			try {
				this.itemsView.sort();
			}
			catch (e) {}
		}
	};

	/**
	 * Serializes zotero-persist attributes to preferences
	 */
	this.serializePersist = function() {
		if (!_unserialized) return;
		try {
			var serializedValues = JSON.parse(Zotero.Prefs.get('pane.persist'));
		}
		catch (e) {
			serializedValues = {};
		}
		var persistedElements = new Set();
		for (let el of document.querySelectorAll("[zotero-persist]")) {
			if (!el.getAttribute) continue;
			var id = el.getAttribute("id");
			if (!id) continue;
			var elValues = {};
			for (let attr of el.getAttribute("zotero-persist").split(/[\s,]+/)) {
				if (el.hasAttribute(attr)) {
					elValues[attr] = el.getAttribute(attr);
					persistedElements.add(id);
				}
			}
			serializedValues[id] = elValues;
		}
		// Remove elements that no longer persist anything
		for (let i in serializedValues) {
			if (!persistedElements.has(i)) {
				delete serializedValues[i];
			}
		}
		Zotero.Prefs.set("pane.persist", JSON.stringify(serializedValues));
	}
	
	
	this.updateWindow = function () {
		var zoteroPane = document.getElementById('zotero-pane');
		// Must match value in overlay.css
		var breakpoint = 1000;
		var className = `width-${breakpoint}`;
		if (window.innerWidth >= breakpoint) {
			zoteroPane.classList.add(className);
		}
		else {
			zoteroPane.classList.remove(className);
		}
	};
	
	
	/**
	 * Update the window min-width/height, collections search width, tag selector, and sidenav
	 * when the window or elements within it are resized.
	 */
	this.updateLayoutConstraints = function () {
		var paneStack = document.getElementById("zotero-pane-stack");
		if (paneStack.hidden) return;

		var titlebar = document.getElementById('zotero-title-bar');
		var trees = document.getElementById('zotero-trees');
		var itemsPaneContainer = document.getElementById('zotero-items-pane-container');
		var collectionsPane = document.getElementById("zotero-collections-pane");
		var tagSelector = document.getElementById("zotero-tag-selector");
		let layoutModeMenus = [
			document.getElementById("view-menuitem-standard"),
			document.getElementById("view-menuitem-stacked"),
		];

		let isStackedMode = Zotero.Prefs.get('layout') === 'stacked';
		let isTempStackedMode = Zotero.Prefs.get('tempStackedMode');
		let isItemPaneCollapsed = ZoteroPane.itemPane.collapsed && ZoteroContextPane.collapsed;

		// Keep in sycn with abstracts/variables.scss > $min-width-collections-pane
		const collectionsPaneMinWidth = collectionsPane.hasAttribute("collapsed") ? 0 : 200;
		// Keep in sycn with abstracts/variables.scss > $min-width-item-pane
		// DeeptutorZ: to accomodate new pane, reduce from 320 to 250
		const itemPaneMinWidth = (isStackedMode || isItemPaneCollapsed) ? 0 : 250;
		const libraryItemPaneMinWidth = (isStackedMode || ZoteroPane.itemPane.collapsed) ? 0 : 320;
		// Keep in sycn with abstracts/variables.scss > $width-sidenav
		const sideNavMinWidth = isStackedMode ? 0 : 37;
		// Keep in sycn with abstracts/variables.scss > $min-width-items-pane
		// DeeptutorZ: to accomodate new pane, reduce from 370 to 300
		const itemsPaneMinWidth = 300;

		let fixedComponentWidth = collectionsPaneMinWidth + itemPaneMinWidth + sideNavMinWidth;

		// Calculate the heights of the components that aren't able to shrink automatically
		// when the window is resized
		let fixedComponentHeight = titlebar.scrollHeight + trees.scrollHeight - itemsPaneContainer.scrollHeight;
		document.documentElement.style.setProperty('--width-of-fixed-components', `${fixedComponentWidth}px`);
		document.documentElement.style.setProperty('--height-of-fixed-components', `${fixedComponentHeight}px`);

		let layoutChanged = false;
		// Collections pane + items pane + items pane + sidenav + 3px for draggability
		const windowAutoStackMinWidth = 930;
		if (window.innerWidth < windowAutoStackMinWidth) {
			// Disable layout mode menus because the standard mode is not available
			layoutModeMenus.forEach(menu => menu.setAttribute("disabled", "true"));
			// If the window is too small in standard mode, enter stack mode temporarily
			if (!isStackedMode && !isTempStackedMode) {
				Zotero.Prefs.set('tempStackedMode', true);
				Zotero.Prefs.set('layout', 'stacked');
				layoutChanged = true;
			}
		}
		else {
			layoutModeMenus.forEach(menu => menu.removeAttribute("disabled"));
			if (isTempStackedMode) {
				Zotero.Prefs.clear('tempStackedMode');
				Zotero.Prefs.set('layout', 'standard');
				layoutChanged = true;
			}
		}

		if (layoutChanged) {
			// Compute the layout constraints again after the layout change to avoid weirdness
			setTimeout(() => {
				this.updateLayoutConstraints();
			}, 0);
		}

		// This is important to avoid other panes be pushed out of the window
		collectionsPane.style.setProperty(
			"--max-width-collections-pane",
			`${window.innerWidth - libraryItemPaneMinWidth - sideNavMinWidth - itemsPaneMinWidth}px`);

		var collectionsPaneWidth = collectionsPane.getBoundingClientRect().width;
		tagSelector.style.maxWidth = collectionsPaneWidth + 'px';
		if (ZoteroPane.itemsView) {
			ZoteroPane.itemsView.updateHeight();
		}

		this.handleTagSelectorResize();

		this.itemPane.handleResize();
	}

	
	// Set the label of the dynamic tooltip. Can be used when we cannot set .tooltiptext
	// property, e.g. if we don't want the tooltip to be announced by screenreaders.
	this.setDynamicTooltip = function (event) {
		let tooltip = event.target;
		let triggerNode = tooltip.triggerNode;
		if (!triggerNode || !triggerNode.getAttribute("dynamic-tooltiptext")) {
			event.preventDefault();
			return;
		}
		tooltip.setAttribute("label", triggerNode.getAttribute("dynamic-tooltiptext"));
	};

	/**
	 * Opens the about dialog
	 */
	this.openAboutDialog = function() {
		window.openDialog('chrome://zotero/content/about.xhtml', 'about', 'chrome,centerscreen');
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
		observe: function (aSubject, aTopic, aData) {
			if (aTopic == "zotero-reloaded") {
				Zotero.debug("Reloading Zotero pane");
				for (let func of _reloadFunctions) func(aData);
			}
			else if (aTopic == "zotero-before-reload") {
				Zotero.debug("Zotero pane caught before-reload event");
				for (let func of _beforeReloadFunctions) func(aData);
			}
		}
	};

	this.buildFieldTransformMenu = function ({ target, onTransform }) {
		let doc = target.ownerDocument;
		let value = target.value;
		let valueTitleCased = Zotero.Utilities.capitalizeTitle(value, true);
		let valueSentenceCased = Zotero.Utilities.sentenceCase(value);

		let menupopup = doc.createXULElement('menupopup');

		let titleCase = doc.createXULElement('menuitem');
		titleCase.setAttribute('label', Zotero.getString('zotero.item.textTransform.titlecase'));
		titleCase.addEventListener('command', () => {
			onTransform(valueTitleCased);
		});
		titleCase.disabled = valueTitleCased == value;
		menupopup.append(titleCase);

		let sentenceCase = doc.createXULElement('menuitem');
		sentenceCase.setAttribute('label', Zotero.getString('zotero.item.textTransform.sentencecase'));
		sentenceCase.addEventListener('command', () => {
			onTransform(valueSentenceCased);
		});
		sentenceCase.disabled = valueSentenceCased == value;
		menupopup.append(sentenceCase);

		Zotero.Utilities.Internal.updateEditContextMenu(menupopup, target);

		return menupopup;
	};
};

/**
 * Keep track of which ZoteroPane was local (since ZoteroPane object might get swapped out for a
 * tab's ZoteroPane)
 */
var ZoteroPane_Local = ZoteroPane;
