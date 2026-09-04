/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
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

'use strict';

// Using 'import' breaks hooks
var React = require('react');
var ReactDOM = require('react-dom');
import TabBar from 'components/tabBar';

// Reduce loaded tabs limit if the system has 8 GB or less memory.
// TODO: Revise this after upgrading to Zotero 7
const MAX_LOADED_TABS = Services.sysinfo.getProperty("memsize") / 1024 / 1024 / 1024 <= 8 ? 3 : 5;
const UNLOAD_UNUSED_AFTER = 86400; // 24h

// Keep in sync with reader/src/common/components/sidebar/sidebar-resizer.js
const SIDEBAR_DEFAULT_WIDTH = 240; // Pixels
const SIDEBAR_MIN_WIDTH = 180; // Pixels

var Zotero_Tabs = new function () {
	Object.defineProperty(this, 'selectedID', {
		get: () => this._selectedID
	});

	Object.defineProperty(this, 'selectedType', {
		get: () => this._getTab(this._selectedID).tab?.type
	});

	// Whether the selected tab is a library tab, including one whose view is still loading
	Object.defineProperty(this, 'selectedIsLibrary', {
		get: () => this._isLibraryTab(this._getTab(this._selectedID).tab)
	});

	Object.defineProperty(this, 'selectedIndex', {
		get: () => this._getTab(this._selectedID).tabIndex
	});

	Object.defineProperty(this, 'deck', {
		get: () => document.getElementById('tabs-deck')
	});

	Object.defineProperty(this, 'windowID', {
		get: () => this._windowID
	});

	Object.defineProperty(this, 'numTabs', {
		get: () => this._tabs.length
	});

	Object.defineProperty(this, 'focusOptions', {
		get: () => this._focusOptions
	});

	Object.defineProperty(this, 'tabsMenuPanel', {
		get: () => document.getElementById('zotero-tabs-menu-panel')
	});

	this._tabBarRef = React.createRef();
	// Identifies this window in tab notifications and in the session
	this._windowID = 'win-' + Zotero.Utilities.randomString();
	this._tabs = [];
	this._selectedID = null;
	this._prevSelectedID = null;
	this._history = [];
	this._focusOptions = {};

	this._loadableTypes = ['reader', 'note', 'library'];

	this._hasContextPaneTypes = ['reader', 'note'];

	this._hasNoteContextTypes = ['reader', 'note'];

	this._sidebarState = null;

	this.hasContextPane = function (type) {
		return this._hasContextPaneTypes.includes(type);
	};

	this.hasNoteContext = function (type) {
		return this._hasNoteContextTypes.includes(type);
	};

	this.tabHooks = {
		load: {
			reader: async (tab, tabIndex, options) => {
				let reader = await Zotero.Reader.open(tab.data.itemID, options && options.location, {
					tabID: tab.id,
					title: tab.title,
					tabIndex,
					allowDuplicate: true,
					secondViewState: tab.data.secondViewState,
					preventJumpback: true,
					window
				});
				await reader._initPromise;
			},
			note: async (tab, tabIndex, options) => {
				let editorInstance = await Zotero.Notes.open(tab.data.itemID, options && options.location, {
					tabID: tab.id,
					title: tab.title,
					tabIndex,
					allowDuplicate: true,
					preventJumpback: true,
					window
				});
				await editorInstance._initPromise;
			},
			library: async (tab, _tabIndex, options) => {
				let container = this.getTabContent(tab.id);
				let libraryView = document.createXULElement('library-view');
				container.append(libraryView);
				await libraryView.load(tab.data.state);
				if (tab.id == this._selectedID && options?.keepTabFocused !== true) {
					let focusElement = options?.focusElementID
						&& libraryView.getElement(options.focusElementID);
					(focusElement || libraryView.itemsView).focus();
				}
			}
		},
		focusFirst: {
			library: async (tab) => {
				let libraryView = ZoteroPane.getLibraryView(tab.id);
				if (!libraryView) {
					return;
				}
				let collectionsPane = libraryView.getElement("zotero-collections-pane");
				if (collectionsPane.hasAttribute("collapsed")) {
					libraryView.getElement('zotero-tb-add').focus();
					return;
				}
				libraryView.getElement('zotero-tb-collection-add').focus();
			},
			reader: async (tab) => {
				let reader = Zotero.Reader.getByTabID(tab.id);
				if (reader) {
					// Move focus to the reader and focus the toolbar
					reader.focusFirst();
					reader.focusToolbar();
				}
			},
			note: async (tab) => {
				let noteEditor = Zotero.Notes.getByTabID(tab.id);
				if (noteEditor) {
					// Move focus to the note editor and focus the toolbar
					noteEditor.focusToolbar();
				}
			},
		},
		refocus: {
			library: async (tab, tabIndex, options) => {
				let libraryView = ZoteroPane.getLibraryView(tab.id);
				// A view that's still loading is focused by the load hook when it finishes
				if (!libraryView?.loaded) {
					return;
				}
				// Move focus to the last focused element of the view if any or itemTree otherwise
				if (options.focusElementID) {
					tab.lastFocusedElement = libraryView?.getElement(options.focusElementID);
				}
				// Small delay to make sure the focus does not remain on the actual
				// tab after mouse click
				setTimeout(() => {
					if (tab.lastFocusedElement) {
						tab.lastFocusedElement.focus();
					}
					if (document.activeElement !== tab.lastFocusedElement) {
						libraryView?.itemsView?.focus();
					}
					tab.lastFocusedElement = null;
				});
			},
			reader: async (tab, _tabIndex, _options) => {
				let reader = Zotero.Reader.getByTabID(tab.id);
				if (reader) {
					reader.focus();
				}
			},
			note: async (tab, _tabIndex, _options) => {
				let noteEditor = Zotero.Notes.getByTabID(tab.id);
				if (noteEditor) {
					noteEditor.focus();
				}
			}
		},
		moveToNewWindow: {
			library: async (tab, _tabIndex) => {
				this._captureLibraryTabState(tab);
				Zotero_Tabs.close(tab.id);
				Zotero.openMainWindow({ libraryTabState: tab.data.state });
			},
			reader: async (tab, _tabIndex) => {
				let { itemID, secondViewState } = tab.data;
				let { title } = tab;
				Zotero_Tabs.close(tab.id);
				Zotero.openMainWindow({ readerTabState: { itemID, secondViewState, title } });
			},
			note: async (tab, _tabIndex) => {
				Zotero_Tabs.close(tab.id);
				let { itemID } = tab.data;
				await Zotero.Notes.open(itemID, null, { openInWindow: true, window });
			}
		},
		duplicate: {
			library: async (tab, tabIndex) => {
				this._captureLibraryTabState(tab);
				this.addLibraryTab({
					title: tab.title,
					icon: tab.data.icon,
					state: tab.data.state,
					index: tabIndex + 1
				});
			},
			reader: async (tab, tabIndex) => {
				if (tab.data.itemID) {
					let { secondViewState } = tab.data;
					await Zotero.Reader.open(tab.data.itemID, null, { tabIndex: tabIndex + 1, allowDuplicate: true, secondViewState, window });
				}
			},
			note: async (tab, tabIndex) => {
				if (tab.data.itemID) {
					await Zotero.Notes.open(tab.data.itemID, null, { tabIndex: tabIndex + 1, allowDuplicate: true, window });
				}
			}
		},
		undoClose: {
			library: async (tab, tabIndex) => {
				this.addLibraryTab({
					title: tab.title,
					icon: tab.data.icon,
					state: tab.data.state,
					index: tabIndex,
					select: false
				});
				return true;
			},
			reader: async (tab, tabIndex) => {
				if (Zotero.Items.exists(tab.data.itemID)) {
					await Zotero.Reader.open(tab.data.itemID,
						null,
						{
							tabIndex,
							openInBackground: true,
							allowDuplicate: true,
							window
						}
					);
					return true;
				}
				return false;
			},
			note: async (tab, tabIndex) => {
				if (Zotero.Items.exists(tab.data.itemID)) {
					await Zotero.Notes.open(tab.data.itemID,
						null,
						{
							tabIndex,
							openInBackground: true,
							allowDuplicate: true,
							window
						}
					);
					return true;
				}
				return false;
			}
		},
		restoreState: {
			library: async (tab, tabIndex, _context) => {
				// Library tabs are added as tabs whose views are created when they're first
				// shown, with the window's first one keeping the legacy tab id
				this.add({
					id: this._tabs.some(x => this._isLibraryTab(x)) ? undefined : 'zotero-pane',
					type: 'library-unloaded',
					title: tab.title,
					index: tabIndex,
					data: tab.data || {},
					select: tab.selected
				});
				return {
					itemID: null,
				};
			},
			reader: async (tab, tabIndex) => {
				if (Zotero.Items.exists(tab.data.itemID)) {
					// Strip non-printable characters, which can result in DOM syntax errors
					// ("An invalid or illegal string was specified") -- reproduced with "\u0001"
					// in a title in session.json
					let title = tab.title.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
					this.add({
						type: 'reader-unloaded',
						title,
						index: tabIndex,
						data: tab.data,
						select: tab.selected
					});
					return {
						itemID: tab.data.itemID,
					};
				}
				return {
					itemID: null,
				};
			},
			note: async (tab, tabIndex) => {
				if (Zotero.Items.exists(tab.data.itemID)) {
					let title = tab.title.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
					this.add({
						type: 'note-unloaded',
						title,
						index: tabIndex,
						data: tab.data,
						select: tab.selected
					});
					return {
						itemID: tab.data.itemID,
					};
				}
				return {
					itemID: null,
				};
			}
		},
		getTitle: {
			library: async (tab) => {
				// A library tab whose view hasn't been created yet keeps its title
				let collectionTreeRows = ZoteroPane.getLibraryView(tab.id)?.getCollectionTreeRows() || [];
				if (!collectionTreeRows.length) {
					return tab.title;
				}
				return collectionTreeRows.length == 1
					? collectionTreeRows[0].getName()
					: Zotero.getString('tab-title-multiple-collections');
			},
			reader: async (tab) => {
				let item = Zotero.Items.get(tab.data.itemID);
				return item ? item.getTabTitle() : "";
			},
			note: async (tab) => {
				let item = Zotero.Items.get(tab.data.itemID);
				if (!item) {
					return "";
				}
				let title = await item.getTabTitle();
				if (!title) {
					return Zotero.getString("item-title-empty-note");
				}
				return title;
			}
		},
		toggleAudio: {
			reader: (tab) => {
				Zotero.Reader.getByTabID(tab.id).toggleReadAloudPaused();
			}
		},
	};

	this._getHook = function (type, action) {
		if (this.tabHooks[action] && this.tabHooks[action][type]) {
			return this.tabHooks[action][type];
		}
		return async () => {};
	};

	this._hasHook = function (type, action) {
		return !!(this.tabHooks[action] && this.tabHooks[action][type]);
	};

	this.parseTabType = function (type) {
		if (!type) {
			type = this.selectedType || '';
		}
		if (type === 'zotero-pane') {
			return {
				tabContentType: 'library',
				tabState: '',
			};
		}
		let [tabContentType, tabState] = type.split('-');
		return {
			tabContentType,
			tabState
		};
	};

	// Update tab titles when their item, collection, search, or library is renamed
	this._notifierID = Zotero.Notifier.registerObserver(
		this, ['item', 'collection', 'search', 'feed', 'group'], 'tabs'
	);

	// Update the title when pref of title format is changed
	this._prefsObserverID = Zotero.Prefs.registerObserver('tabs.title.reader', async () => {
		for (let tab of this._tabs) {
			if (!tab.data.itemID) continue;
			this.rename(tab.id);
		}
	});
	
	window.addEventListener('unload', () => {
		Zotero.Notifier.unregisterObserver(this._notifierID);
		Zotero.Prefs.unregisterObserver(this._prefsObserverID);
	});

	this._unloadInterval = setInterval(() => {
		this.unloadUnusedTabs();
	}, 60000); // Trigger every minute

	/**
	 * Extra data for a 'tab' notification, tagged with this window's id
	 *
	 * @param {String[]} ids - Tab ids the notification is for
	 * @param {Object} [data] - Extra data for each tab
	 * @return {Object}
	 */
	this._getNotifierExtraData = function (ids, data) {
		let extraData = {};
		for (let id of ids) {
			extraData[id] = Object.assign({}, data, { windowID: this._windowID });
		}
		return extraData;
	};
	
	/**
	 * Whether a 'tab' notification came from this window
	 *
	 * @param {Object} extraData
	 * @param {String} id - Tab id from the notification
	 * @return {Boolean}
	 */
	this.isOwnTabEvent = function (extraData, id) {
		let windowID = extraData?.[id]?.windowID;
		return !windowID || windowID === this._windowID;
	};
	
	this._getTab = function (id) {
		var tabIndex = this._tabs.findIndex(tab => tab.id == id);
		return { tab: this._tabs[tabIndex], tabIndex };
	};

	this._isLibraryTab = function (tab) {
		return !!tab && this.parseTabType(tab.type).tabContentType === 'library';
	};

	/**
	 * Whether a tab id belongs to a library tab
	 *
	 * @param {String} id
	 * @return {Boolean}
	 */
	this.isLibraryTab = function (id) {
		return this._isLibraryTab(this._getTab(id).tab);
	};

	/**
	 * The saved tab data of the most recently selected library tab whose view hasn't been
	 * created yet
	 *
	 * @return {Object|null} - { title, icon, state }, or null if no such tab has a saved
	 *     collection selection
	 */
	this.getUnloadedLibraryTabData = function () {
		let tab = this._tabs
			.filter(x => this._isLibraryTab(x)
				&& x.data?.state?.collections?.length
				&& !ZoteroPane.getLibraryView(x.id))
			.sort((a, b) => (b.timeSelected || 0) - (a.timeSelected || 0))[0];
		if (!tab) {
			return null;
		}
		let { collections, focusedCollection } = tab.data.state;
		return {
			title: tab.title,
			icon: tab.data.icon,
			state: { collections, focusedCollection }
		};
	};

	/**
	 * Index of the first tab that can be reordered, which is the number of pinned tabs
	 *
	 * @return {Integer}
	 */
	this._getFirstUnpinnedIndex = function () {
		let index = this._tabs.findIndex(tab => !tab.pinned);
		return index === -1 ? this._tabs.length : index;
	};

	this.getTabContent = function (id) {
		if (!id) {
			id = this._selectedID;
		}
		return document.getElementById(id);
	};

	// TODO: update this
	this._update = function () {
		// Go through all tabs and try to save their icons to tab.data
		for (let tab of this._tabs) {
			// Find the icon for a library tab from its view. A tab whose view hasn't been
			// created yet keeps its stored icon.
			if (this._isLibraryTab(tab)) {
				let collectionsView = ZoteroPane.getLibraryView(tab.id)?.collectionsView;
				let index = collectionsView?.selection?.focused;
				if (typeof index !== 'undefined' && collectionsView.getRow(index)) {
					let iconName = collectionsView.getIconName(index);
					tab.data.icon = iconName;
				}
			}
			else if (!tab.data.icon) {
				// Try to fetch the icon for the reader tab
				try {
					let item = Zotero.Items.get(tab.data.itemID);
					tab.data.icon = item.getItemTypeIconName(true);
				}
				catch {
					// item might not yet be loaded, we will get the right icon on the next update
				}
			}
		}

		this._tabBarRef.current?.setTabs(this._tabs.map((tab) => {
			let { tabContentType } = this.parseTabType(tab.type);
			return {
				id: tab.id,
				type: tab.type,
				title: tab.title,
				renderTitle: tabContentType === 'reader',
				selected: tab.id == this._selectedID,
				isItemType: tabContentType !== 'library',
				pinned: !!tab.pinned,
				closable: this._isClosable(tab),
				movable: !!tab.movable,
				icon: tab.data?.icon || null,
				audioStatus: tab.audioStatus,
			};
		}));
		var { tab } = this._getTab(this._selectedID);
		// Disable File > Close if the selected tab can't be closed and closing the window instead
		// would take other tabs with it or, for the last tab of the last window, quit
		document.getElementById('cmd_close').toggleAttribute(
			'disabled',
			!!tab && !this._isClosable(tab) && (this._tabs.length > 1 || tab.closable)
		);
		if (!tab) {
			return;
		}
		document.title = (tab.title.length ? tab.title + ' - ' : '') + Zotero.appName;

		let panel = this.tabsMenuPanel;
		if (panel.visible) {
			panel.refreshList();
		}
	};

	this.updateSidebarLayout = ({ width } = {}) => {
		let { tabContentType: tabType } = Zotero_Tabs.parseTabType();
		if (!tabType) {
			return {};
		}
		let sidebarState;
		if (typeof width === 'number') {
			// If width is a number, update the width and open state
			sidebarState = this.updateSidebarState(tabType, { width: width, open: width > 0 });
		}
		else if (typeof width === 'boolean') {
			// If width is a boolean, update the open state only
			sidebarState = this.updateSidebarState(tabType, { open: width });
			width = sidebarState.width || 0;
		}
		else {
			// If width is not provided, use the saved state
			sidebarState = this.getSidebarState(tabType);
			width = sidebarState.width || 0;
			if (sidebarState.open === false) {
				width = 0;
			}
		}

		if (width) {
			let sidebarWidth = `${width}px`;
			let placeholder = document.getElementById('zotero-reader-sidebar-pane');
			placeholder.toggleAttribute('collapsed', !sidebarWidth);
			placeholder.setAttribute('width', sidebarWidth);
		}

		return { sidebarState };
	};

	this.getSidebarState = (tabType) => {
		if (!this._sidebarState) {
			this._loadSidebarState();
		}
		if (!this._sidebarState[tabType]) {
			this._sidebarState[tabType] = {
				width: SIDEBAR_DEFAULT_WIDTH,
				open: false,
			};
		}
		return this._sidebarState[tabType];
	};

	this.updateSidebarState = (tabType, state) => {
		if (!this._sidebarState) {
			this._loadSidebarState();
		}
		if (!this._sidebarState[tabType]) {
			this._sidebarState[tabType] = {};
		}
		state = state || {};
		let hasChanges = false;
		for (let key in state) {
			if (this._sidebarState[tabType][key] !== state[key]) {
				hasChanges = true;
				break;
			}
		}
		if (!hasChanges) {
			return this._sidebarState[tabType];
		}
		Object.assign(this._sidebarState[tabType], state);
		this._saveSidebarState();
		return this._sidebarState[tabType];
	};

	this._loadSidebarState = () => {
		let sidebarState = Zotero.Prefs.get('sidebarState') || '{}';
		try {
			sidebarState = JSON.parse(sidebarState);
			for (let tabType in sidebarState) {
				if (typeof sidebarState[tabType].width !== 'number' || sidebarState[tabType].width < SIDEBAR_MIN_WIDTH) {
					sidebarState[tabType].width = SIDEBAR_DEFAULT_WIDTH;
				}
			}
		}
		catch {
			sidebarState = {};
		}
		this._sidebarState = sidebarState;
	};

	this._saveSidebarState = () => {
		let sidebarState;
		try {
			sidebarState = JSON.stringify(this._sidebarState);
		}
		catch {
			// Default status if serialization fails
			sidebarState = JSON.stringify({
				reader: {
					width: SIDEBAR_DEFAULT_WIDTH,
					open: false,
				},
				note: {
					width: SIDEBAR_DEFAULT_WIDTH,
					open: false,
				},
			});
		}
		Zotero.Prefs.set('sidebarState', sidebarState);
	};

	this.getTabIDByItemID = function (itemID) {
		let tab = this._tabs.find(tab => tab.data && tab.data.itemID === itemID);
		return tab && tab.id;
	};

	this.setTabData = function (tabID, data) {
		let { tab } = this._getTab(tabID);
		Object.assign(tab.data, data);
		Zotero.Session.debounceSave();
	};

	this.init = function () {
		ReactDOM.createRoot(document.getElementById('tab-bar-container')).render(
			<TabBar
				ref={this._tabBarRef}
				onTabSelect={this.select.bind(this)}
				onTabMove={this.move.bind(this)}
				onTabClose={id => this.canClose(id) && this.close(id)}
				onContextMenu={this._openMenu.bind(this)}
				onRefocus={this.refocus.bind(this)}
				onToggleAudio={this.toggleAudio.bind(this)}
				onLoad={this._update.bind(this)}
			/>
		);

		this._loadSidebarState();
	};

	this.notify = async (event, type, ids, _) => {
		if (event !== "modify") return;
		// Library tabs are titled after a collection, saved search, or library
		if (type != 'item') {
			for (let tab of this._tabs) {
				if (this._isLibraryTab(tab)) {
					this.rename(tab.id);
				}
			}
			return;
		}
		for (let id of ids) {
			let item = Zotero.Items.get(id);
			// If a top-level item is updated, update all tabs that have its attachments and notes
			// Otherwise, just update the tab with the updated attachment
			let itemIDs = [];
			if (item.isAttachment() || item.isNote()) {
				itemIDs.push(id);
			}
			else if (item.isRegularItem()) {
				itemIDs.push(
					...item.getAttachments(),
					...item.getNotes()
				);
			}
			for (let itemID of itemIDs) {
				let relevantTabs = this._tabs.filter(tab => tab.data.itemID == itemID);
				if (!relevantTabs.length) continue;
				for (let tab of relevantTabs) {
					this.rename(tab.id);
				}
			}
		}
	};

	/**
	 * Store the current state of a library tab's view on the tab
	 *
	 * @param {Object} tab
	 */
	this._captureLibraryTabState = function (tab) {
		if (typeof ZoteroPane == 'undefined') {
			return;
		}
		let libraryView = ZoteroPane.getLibraryView(tab.id);
		if (!libraryView?.loaded) {
			return;
		}
		try {
			let state = libraryView.captureLibraryTabState();
			if (state) {
				tab.data.state = state;
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
	};

	/**
	 * The collection selection of a library tab, the only part of it the session saves
	 *
	 * @param {Object} tab
	 * @return {Object|undefined}
	 */
	this._getLibraryTabCollectionsState = function (tab) {
		let state = ZoteroPane.getLibraryView(tab.id)?.captureCollectionsState()
			|| tab.data?.state;
		if (!state) {
			return undefined;
		}
		let { collections, focusedCollection } = state;
		return { collections, focusedCollection };
	};

	this.getState = function () {
		return this._tabs.map((tab) => {
			let type = tab.type;
			// If type matches *-unloaded, use the base type
			if (type.endsWith('-unloaded')) {
				type = type.replace(/-unloaded$/, '');
			}
			var o = {
				type,
				title: tab.title,
				timeUnselected: tab.timeUnselected
			};
			if (tab.data) {
				o.data = tab.data;
			}
			if (this._isLibraryTab(tab)) {
				// The session keeps only the collection selection of a library tab, so that a
				// restart shows it as a fresh view of its collections
				o.data = Object.assign({}, tab.data, {
					state: this._getLibraryTabCollectionsState(tab)
				});
			}
			if (tab.id == this._selectedID) {
				o.selected = true;
			}
			return o;
		});
	};

	this.restoreState = async function (tabs) {
		let itemIDs = [];
		let context = {};
		for (let i = 0; i < tabs.length; i++) {
			let tab = tabs[i];
			let { tabContentType } = this.parseTabType(tab.type);
			let restoreStateHook = this._getHook(tabContentType, 'restoreState');
			let { itemID } = await restoreStateHook(tab, i, context);
			if (itemID) {
				itemIDs.push(itemID);
			}
		}
		if (!this._getTab(this._selectedID).tab && this._tabs.length) {
			this.select(this._tabs[0].id);
		}
		// Unset the previously selected tab id, because it was set when restoring tabs
		this._prevSelectedID = null;
		// Some items may belong to groups that are not yet loaded. Load them here so that
		// every component related to tabs (e.g. tabs menu) does not have to handle
		// potentially not-yet-loaded items.
		let items = await Zotero.Items.getAsync(itemIDs);
		await Zotero.Items.loadDataTypes(items);
	};
	
	/**
	 * Create a library tab
	 *
	 * @param {Object} [options]
	 * @param {String} [options.id] - Generated if not provided
	 * @param {String} [options.type='library-unloaded'] - 'library' for a tab whose view already
	 *     exists, or 'library-unloaded' for one whose view is created when it's first shown
	 * @param {String} [options.title]
	 * @param {Object} [options.data]
	 * @return {Object}
	 */
	function createLibraryTab({ id, type = 'library-unloaded', title = '', data = {} } = {}) {
		return {
			id: id || 'tab-' + Zotero.Utilities.randomString(),
			type,
			title,
			data,
			pinned: false,
			closable: true,
			movable: true
		};
	}

	/**
	 * Add a new tab
	 *
	 * @param {String} type
	 * @param {String} [title] - Tab title. If empty and data.itemID is set, the title will be fetched automatically
	 * @param {String} data - Extra data about the tab to pass to notifier and session
	 * @param {Integer} index
	 * @param {Boolean} select
	 * @param {Object} selectOptions - Passed to select()
	 * @param {Function} onClose
	 * @return {{ id: string, container: XULElement}} id - tab id, container - a new tab container created in the deck
	 */
	this.add = function ({ id, type, data, title, index, select, selectOptions, onClose, preventJumpback }) {
		if (typeof type != 'string') {
		}
		if (title && typeof title != 'string') {
			throw new Error(`'title' should be string or undefined (was ${typeof title})`);
		}
		if (!title) {
			title = "";
		}
		let minIndex = this._getFirstUnpinnedIndex();
		if (index !== undefined && (!Number.isInteger(index) || index < minIndex)) {
			throw new Error(`'index' should be an integer >= ${minIndex} (was ${index} (${typeof index})`);
		}
		if (onClose !== undefined && typeof onClose != 'function') {
			throw new Error(`'onClose' should be a function (was ${typeof onClose})`);
		}
		id = id || 'tab-' + Zotero.Utilities.randomString();
		var container = document.createXULElement('tab-content');
		container.id = id;
		var tab;
		if (this.parseTabType(type).tabContentType === 'library') {
			// Route key events through the pane's handlers, like the primary library tab's container
			container.setAttribute('onkeydown', 'ZoteroPane_Local.handleKeyDown(event, this.id)');
			container.setAttribute('onkeyup', 'ZoteroPane_Local.handleKeyUp(event, this.id)');
			container.setAttribute('onkeypress', 'ZoteroPane_Local.handleKeyPress(event)');
			tab = createLibraryTab({ id, type, title, data });
			tab.onClose = onClose;
		}
		else {
			tab = { id, type, title, data, onClose, pinned: false, closable: true, movable: true };
		}
		this.deck.appendChild(container);
		if (index === undefined) {
			index = this._tabs.length;
		}
		this._tabs.splice(index, 0, tab);
		this._update();
		Zotero.Notifier.trigger(
			'add', 'tab', [id], this._getNotifierExtraData([id], Object.assign({}, data, { type })), true
		);
		if (select) {
			let previousID = this._selectedID;
			this.select(id, false, selectOptions);
			if (!preventJumpback) {
				this._prevSelectedID = previousID;
			}
		}
		if (!title && data.itemID) {
			// Not awaited as the id and container should be returned synchronously
			this.rename(tab.id);
		}
		return { id, container };
	};

	/**
	 * Open a new library tab
	 *
	 * @param {Object} [options]
	 * @param {String} [options.id] - Generated if not provided
	 * @param {String} [options.title]
	 * @param {String} [options.icon] - Collection tree icon name
	 * @param {Object} [options.state] - Library view state, as returned by
	 *     LibraryView#captureLibraryTabState()
	 * @param {Integer} [options.index]
	 * @param {Boolean} [options.select=true]
	 * @param {Object} [options.selectOptions] - Passed to select()
	 * @return {String} - The id of the new tab
	 */
	this.addLibraryTab = function ({ id, title, icon, state, index, select = true, selectOptions } = {}) {
		let data = {};
		if (icon) {
			data.icon = icon;
		}
		if (state) {
			data.state = JSON.parse(JSON.stringify(state));
		}
		({ id } = this.add({ id, type: 'library-unloaded', title, data, index, select, selectOptions }));
		return id;
	};

	/**
	 * Set a new tab title
	 *
	 * @param {String} id
	 * @param {String} title
	 */
	this.rename = async function (id, title) {
		if (title && typeof title != 'string') {
			throw new Error(`'title' should be string or undefined (was ${typeof title})`);
		}
		let { tab } = this._getTab(id);
		if (!tab) {
			return;
		}
		if (!title) {
			let { tabContentType } = this.parseTabType(tab.type);
			if (this._hasHook(tabContentType, 'getTitle')) {
				title = await this._getHook(tabContentType, 'getTitle')(tab);
			}
		}

		tab.title = title;
		this._update();
	};
	
	this.setAudioStatus = function (id, status) {
		if (!status || typeof status != 'object' || !('active' in status && 'paused' in status)) {
			throw new Error(`'status' should be an object with { active, paused } properties`);
		}
		var { tab } = this._getTab(id);
		if (!tab) {
			return;
		}
		tab.audioStatus = status;
		this._update();
	};
	
	this.toggleAudio = function (id) {
		var { tab } = this._getTab(id);
		if (!tab) {
			return;
		}
		let { tabContentType } = this.parseTabType(tab.type);
		let toggleAudioHook = this._getHook(tabContentType, 'toggleAudio');
		toggleAudioHook(tab);
	};

	/**
	 * Close tabs
	 *
	 * @param {String|Array<String>|undefined} ids One or more ids, or empty for the current tab
	 * @param {Object} [options]
	 * @param {Boolean} [options.skipHistory=false] - Don't make the tabs reopenable with undoClose()
	 * @param {Boolean} [options.skipWindowClose=false] - Leave the window open if no tabs are left
	 */
	this.close = function (ids, { skipHistory = false, skipWindowClose = false } = {}) {
		if (!ids) {
			ids = [this._selectedID];
		}
		else if (!Array.isArray(ids)) {
			ids = [ids];
		}
		for (let closeID of ids) {
			let { tab } = this._getTab(closeID);
			if (tab && !tab.closable) {
				throw new Error(`Tab '${closeID}' cannot be closed`);
			}
		}
		var historyEntry = [];
		var closedIDs = [];
		var tmpTabs = this._tabs.slice();
		for (var id of ids) {
			let { tab, tabIndex } = this._getTab(id);
			if (!tab) {
				continue;
			}
			if (tab.id == this._selectedID) {
				let tabToSelect = null;
				if (this._prevSelectedID && !ids.includes(this._prevSelectedID)) {
					tabToSelect = this._getTab(this._prevSelectedID).tab;
				}
				else {
					tabToSelect = this._tabs
						.slice(tabIndex + 1)
						.concat(this._tabs.slice(0, tabIndex).reverse())
						.find(x => !ids.includes(x.id));
				}
				if (tabToSelect) {
					let selectOptions = {};
					// If the tabs menu is visible, let the tab bar handle focus
					if (this.tabsMenuPanel.visible) {
						selectOptions.keepTabFocused = true;
					}
					this.select(tabToSelect.id, false, selectOptions);
				}
			}
			if (tab.id == this._prevSelectedID) {
				this._prevSelectedID = null;
			}
			tabIndex = this._tabs.findIndex(x => x.id === id);
			this._tabs.splice(tabIndex, 1);
			if (tab.onClose) {
				tab.onClose();
			}
			// Keep the view's state for reopening the tab, and stop routing the window's view
			// surface to a view that's going away
			if (this._isLibraryTab(tab)) {
				this._captureLibraryTabState(tab);
				let libraryView = ZoteroPane.getLibraryView(tab.id);
				if (libraryView) {
					ZoteroPane.unregisterLibraryView(libraryView);
				}
			}
			historyEntry.push({ index: tmpTabs.indexOf(tab), data: tab.data, title: tab.title, type: tab.type });
			closedIDs.push(id);

			setTimeout(() => {
				document.getElementById(tab.id).remove();
				// For unknown reason fx102, unlike 60, sometimes doesn't automatically update selected index
				let selectedIndex = Array.from(this.deck.children).findIndex(x => x.id == this._selectedID);
				if (this.deck.selectedIndex !== selectedIndex) {
					this.deck.selectedIndex = selectedIndex;
				}
			});
		}
		if (!skipHistory) {
			this._history.push(historyEntry);
		}
		Zotero.Notifier.trigger('close', 'tab', [closedIDs], this._getNotifierExtraData(closedIDs));
		this._update();
		// A window without tabs has nothing left to show
		if (!skipWindowClose && !this._tabs.length) {
			window.close();
		}
	};

	/**
	 * Close all closable tabs, leaving the window open for its caller to close
	 */
	this.closeAll = function () {
		this.close(this._tabs.filter(x => x.closable).map(x => x.id), { skipWindowClose: true });
	};
	
	/**
	 * Undo tabs closing
	 */
	this.undoClose = async function () {
		var historyEntry = this._history.pop();
		if (historyEntry) {
			let maxIndex = -1;
			let openPromises = [];
			for (let tab of historyEntry) {
				let { tabContentType } = this.parseTabType(tab.type);
				let undoCloseHook = this._getHook(tabContentType, 'undoClose');
				openPromises.push(undoCloseHook({ data: tab.data, title: tab.title }, tab.index)
					.then((opened) => {
						if (opened && tab.index > maxIndex) {
							maxIndex = tab.index;
						}
					}));
			}
			await Promise.all(openPromises);
			// Select last reopened tab
			if (maxIndex > -1) {
				this.jump(maxIndex);
			}
		}
	};

	/**
	 * Move a tab to the specified index
	 *
	 * @param {String} id
	 * @param {Integer} newIndex
	 */
	this.move = function (id, newIndex) {
		let minIndex = this._getFirstUnpinnedIndex();
		if (!Number.isInteger(newIndex) || newIndex < minIndex) {
			throw new Error(`'newIndex' should be an integer >= ${minIndex} (was ${newIndex} (${typeof newIndex})`);
		}
		var { tab, tabIndex } = this._getTab(id);
		if (tab && !tab.movable) {
			throw new Error(`Tab '${id}' cannot be moved`);
		}
		if (!tab || tabIndex == newIndex) {
			return;
		}
		if (newIndex > tabIndex) {
			newIndex--;
		}
		this._tabs.splice(tabIndex, 1);
		this._tabs.splice(newIndex, 0, tab);
		this._update();
	};

	/**
	 * Select a tab
	 *
	 * @param {String} id
	 * @param {Boolean} reopening
	 * @param {Object} options - Additional options for selecting the tab. Passed to tab hooks
	 * @param {Boolean} options.keepTabFocused
	 * @return {Promise}
	 */
	this.select = function (id, reopening, options = {}) {
		let { tab, tabIndex } = this._getTab(id);
		let { tabContentType, tabState } = this.parseTabType(tab.type);

		let isEditorFocused = false;

		if (
			// Tab focus can change
			!options.keepTabFocused
			// Has note context
			&& this.hasNoteContext(tabContentType)
			// Tabs menu popup is not open
			&& !this.tabsMenuPanel.visible
			// Note context editor is active
			&& ZoteroContextPane.activeEditor?.contains(document.activeElement)
			// Opened as a child note of the tab
			&& ZoteroContextPane.activeEditor?.closest(".context-note-standalone")) {
			let currentItem = Zotero.Items.get(tab.data.itemID);
			let editorItem = ZoteroContextPane.activeEditor.item;
			// In the same library
			if (!currentItem || editorItem.libraryID === currentItem.libraryID) {
				isEditorFocused = true;
			}
		}

		if (!tab || tab.id === this._selectedID) {
			// Focus on reader or zotero pane when keepTabFocused is explicitly false
			// E.g. when a tab is selected via Space or Enter
			if (!isEditorFocused && options.keepTabFocused === false && tab?.id === this._selectedID) {
				let refocusHook = this._getHook(tabContentType, 'refocus');
				setTimeout(() => refocusHook(tab, tabIndex, options), 0);
			}
			return;
		}
		let selectedTab;
		if (this._selectedID) {
			selectedTab = this._getTab(this._selectedID).tab;
			if (selectedTab) {
				selectedTab.timeUnselected = Zotero.Date.getUnixTimestamp();
			}
		}

		// If the current tab left behind open popups, they'll remain as empty
		// ghosts in the new tab. Close them.
		if (this.deck.selectedPanel) {
			try {
				for (let popup of this.deck.selectedPanel.querySelectorAll('panel, menupopup')) {
					popup.hidePopup();
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		
		// If the last focus data was recorded for a different item, discard it
		if (!this._focusOptions.itemID || this._focusOptions.itemID != tab?.data?.itemID) {
			this._focusOptions = {};
		}
		// Save focus option for this item to tell reader and contextPane how to handle focus
		if (Object.keys(options).length && selectedTab) {
			this._focusOptions.keepTabFocused = !!options.keepTabFocused;
			this._focusOptions.itemID = tab?.data?.itemID;
		}
		if (this._isLibraryTab(selectedTab)
		&& !document.activeElement.classList.contains("tab")
		&& document.activeElement.tagName !== 'window') {
			// never return focus to another tab or <window>
			selectedTab.lastFocusedElement = document.activeElement;
		}

		if (tabState === 'unloaded') {
			tab.type = `${tabContentType}-loading`;
			// Make sure the loading message is displayed first.
			// Then, open reader and hide the loading message once it has loaded.
			ZoteroContextPane.showLoadingMessage(true);
			let loadHook = this._getHook(tabContentType, 'load');
			loadHook(tab, tabIndex, options).then(() => {
				ZoteroContextPane.showLoadingMessage(false);
				this.markAsLoaded(tab.id);
			});
		}
		// Notify previously selected tab content about selection change
		let prevTabContent = this.getTabContent(this._selectedID);
		prevTabContent?.onTabSelectionChanged(false);

		this._prevSelectedID = reopening ? this._selectedID : null;
		this._selectedID = id;
		this.deck.selectedIndex = Array.from(this.deck.children).findIndex(x => x.id == id);
		// ZoteroPane's library view properties and methods follow the selected library tab
		if (this._isLibraryTab(tab)) {
			let libraryView = ZoteroPane.getLibraryView(id);
			if (libraryView) {
				ZoteroPane.setActiveLibraryView(libraryView);
			}
		}
		this._update();
		Zotero.Notifier.trigger(
			'select', 'tab', [tab.id], this._getNotifierExtraData([tab.id], { type: tab.type }), true
		);

		let currentTabContent = this.getTabContent(id);

		if (!isEditorFocused) {
			if (options.keepTabFocused !== true) {
				let refocusHook = this._getHook(tabContentType, 'refocus');
				setTimeout(() => refocusHook(tab, tabIndex, options), 0);
			}
			else {
				let tabNode = document.querySelector(`#tab-bar-container .tab[data-id="${tab.id}"]`);
				if (tabNode
						&& document.activeElement.getAttribute('data-id') != tabNode.getAttribute('data-id')) {
					// Keep focus on the currently selected tab during keyboard navigation
					tabNode.focus();
				}
			}
		}
		else {
			setTimeout(() => ZoteroContextPane.activeEditor?.focus(), 0);
		}
		
		tab.timeSelected = Zotero.Date.getUnixTimestamp();
		// Without `setTimeout` the tab closing that happens in `unloadUnusedTabs` results in
		// tabs deck selection index bigger than the deck children count. It feels like something
		// isn't update synchronously
		setTimeout(() => this.unloadUnusedTabs());

		// Notify tab content about selection change
		currentTabContent?.onTabSelectionChanged(true);
	};
	
	this.canUnload = function (id) {
		var { tab } = this._getTab(id);
		return tab && tab.id !== this._selectedID && this._loadableTypes.includes(tab.type)
			// A window's last loaded library view stays, so that the window remains a main window
			// for plugins and for library actions (e.g., connector saves)
			&& !(this._isLibraryTab(tab) && (!ZoteroPane.getLibraryView(tab.id)?.loaded
				|| ZoteroPane.libraryViews.filter(view => view.loaded).length < 2))
			&& !(tab.audioStatus && tab.audioStatus.active && !tab.audioStatus.paused);
	};

	this.unload = function (id) {
		if (!this.canUnload(id)) {
			return;
		}
		var { tab, tabIndex } = this._getTab(id);
		// The tab stays in place, so it isn't reopenable and can't be the last one to go
		this.close(tab.id, { skipHistory: true, skipWindowClose: true });
		this.add({
			id: tab.id,
			type: `${tab.type}-unloaded`,
			title: tab.title,
			index: tabIndex,
			data: tab.data
		});
	};
	
	// Mark a tab as loaded
	this.markAsLoaded = function (id) {
		let { tab } = this._getTab(id);
		if (!tab) return;
		let { tabContentType, tabState } = this.parseTabType(tab.type);
		if (tabState !== 'loading') {
			return;
		}
		let prevType = tab.type;
		tab.type = tabContentType;
		Zotero.Notifier.trigger(
			"load", "tab", [id], this._getNotifierExtraData([id], Object.assign({}, tab, { prevType })), true
		);
	};

	this.unloadUnusedTabs = function () {
		for (let tab of this._tabs) {
			if (Zotero.Date.getUnixTimestamp() - tab.timeUnselected > UNLOAD_UNUSED_AFTER) {
				this.unload(tab.id);
			}
		}
		// TODO: also proactively unload note tabs, though they are already lazy loaded
		// We don't for now because the open-with-location is not implemented.
		// Unload them will cause cursor position to be reset.
		// Each type gets its own allowance of loaded tabs
		for (let type of ['reader', 'library']) {
			let tabs = this._tabs.slice().filter(x => x.type === type);
			tabs.sort((a, b) => b.timeUnselected - a.timeUnselected);
			tabs = tabs.slice(MAX_LOADED_TABS);
			for (let tab of tabs) {
				this.unload(tab.id);
			}
		}
	};

	/**
	 * Select this window's active library tab -- the most recently selected one
	 *
	 * @param {Object} [options] - Additional options, passed to select()
	 */
	this.selectLibraryTab = function (options = {}) {
		let tabID = ZoteroPane.libraryView?.tabID;
		let tab = (tabID && this._getTab(tabID).tab) || this._tabs.find(x => this._isLibraryTab(x));
		if (tab) {
			this.select(tab.id, false, options);
			return;
		}
		ZoteroPane.newLibraryTab();
	};

	/**
	 * Whether a tab can be closed
	 *
	 * @param {String} [id] - Defaults to the selected tab
	 * @return {Boolean}
	 */
	this.canClose = function (id) {
		var { tab } = this._getTab(id || this._selectedID);
		return !!tab && this._isClosable(tab);
	};
	
	/**
	 * Outside of macOS, the last tab of the last window stays open, so that closing a tab
	 * doesn't quit the app
	 */
	this._isClosable = function (tab) {
		if (!tab.closable) {
			return false;
		}
		if (Zotero.isMac || this._tabs.length > 1) {
			return true;
		}
		return Zotero.getMainWindows().some(win => win != window && !win.closed);
	};

	/**
	 * Select the previous tab (closer to the library tab)
	 */
	this.selectPrev = function (options) {
		var { tabIndex } = this._getTab(this._selectedID);
		this.select((this._tabs[tabIndex - 1] || this._tabs[this._tabs.length - 1]).id, false, options || {});
	};

	/**
	 * Select the next tab (farther to the library tab)
	 */
	this.selectNext = function (options) {
		var { tabIndex } = this._getTab(this._selectedID);
		this.select((this._tabs[tabIndex + 1] || this._tabs[0]).id, false, options || {});
	};
	
	/**
	 * Select the last tab
	 */
	this.selectLast = function () {
		this.select(this._tabs[this._tabs.length - 1].id);
	};

	/**
	 * Return focus into the content of the selected tab.
	 * Required to move focus from the tab into the content after drag.
	 */
	this.refocus = function (id) {
		if (!id) id = this._selectedID;
		let { tab, tabIndex } = this._getTab(id);
		if (!tab) return;
		let { tabContentType } = this.parseTabType(tab.type);
		let refocusHook = this._getHook(tabContentType, 'refocus');
		refocusHook(tab, tabIndex, this._focusOptions);
	};

	/**
	 * Move focus into the first element in content of the selected tab.
	 * Required to move focus from the outside into the tab content.
	 */
	this.focusFirst = function (id) {
		if (!id) id = this._selectedID;
		let { tab, tabIndex } = this._getTab(id);
		if (!tab) return;
		let { tabContentType } = this.parseTabType(tab.type);
		let focusFirstHook = this._getHook(tabContentType, 'focusFirst');
		focusFirstHook(tab, tabIndex);
	};

	/**
	 * Move focus back from the tab content,
	 * e.g. shift-tab from the first focusable element.
	 */
	this.focusBack = function () {
		document.getElementById("zotero-tb-sync").focus();
	};

	/**
	 * Move focus to the next focusable element after the tab content,
	 * e.g. tab from the last focusable element.
	 */
	this.focusForward = function () {
		let focused = ZoteroContextPane.focus();
		// If context pane wasn't focused (e.g. it's collapsed), focus the tab bar
		if (!focused) {
			this.moveFocus("current");
		}
	};

	/**
	 * Moves focus to a tab in the specified direction.
	 * @param {String} direction. "first", "last", "previous", "next", or "current"
	 * If document.activeElement is a tab, "previous" or "next" direction moves focus from that tab.
	 * Otherwise, focus is moved in the given direction from the currently selected tab.
	 */
	this.moveFocus = function (direction) {
		let focusedTabID = document.activeElement.getAttribute('data-id');
		var { tabIndex } = this._getTab(this._selectedID);

		let tabIndexToFocus = null;
	
		if (direction === "last") {
			tabIndexToFocus = this._tabs.length - 1;
		}
		else if (direction == "first") {
			tabIndexToFocus = 0;
		}
		else if (direction == "current") {
			tabIndexToFocus = tabIndex;
		}
		else {
			let focusedTabIndex = this._tabs.findIndex(tab => tab.id === focusedTabID);
			
			// If the currently focused element is not a tab, use tab that is selected
			if (focusedTabIndex === -1) {
				focusedTabIndex = tabIndex;
			}
	
			switch (direction) {
				case "previous":
					tabIndexToFocus = focusedTabIndex > 0 ? focusedTabIndex - 1 : null;
					break;
				case "next":
					tabIndexToFocus = focusedTabIndex < this._tabs.length - 1 ? focusedTabIndex + 1 : null;
					break;
				default:
					throw new Error(`${direction} is an invalid direction.`);
			}
		}
	
		if (tabIndexToFocus !== null) {
			this._focusTabNode(this._tabs[tabIndexToFocus].id);
		}
	};

	/**
	 * Focus the tab bar node of a tab. A pinned tab is rendered both in the pinned slot and in
	 * the scrollable tab list, so go through all candidates and focus the visible one.
	 *
	 * @param {String} id
	 * @return {Boolean} - Whether a node was focused
	 */
	this._focusTabNode = function (id) {
		let candidates = document.querySelectorAll(`#tab-bar-container .tab[data-id="${id}"]`);
		for (let node of candidates) {
			node.focus();
			if (document.activeElement == node) {
				return true;
			}
		}
		return false;
	};

	/**
	 * Jump to the tab at a particular index. If the index points beyond the array, jump to the last
	 * tab.
	 *
	 * @param {Integer} index
	 */
	this.jump = function (index) {
		this.select(this._tabs[Math.min(index, this._tabs.length - 1)].id);
	};

	this._openMenu = function (x, y, id) {
		let { tab, tabIndex } = this._getTab(id);
		let { tabContentType } = this.parseTabType(tab.type);
		let menuitem;
		let popup = document.createXULElement('menupopup');
		document.querySelector('popupset').appendChild(popup);
		popup.addEventListener('popuphidden', function (event) {
			if (event.target === popup) {
				popup.remove();
			}
		});
		if (!this._isLibraryTab(tab)) {
			// Show in library
			menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('general.showInLibrary'));
			menuitem.addEventListener('command', () => {
				let { tab } = this._getTab(id);
				let itemID = tab.data.itemID;
				let item = Zotero.Items.get(itemID);
				if (item && item.parentItemID) {
					itemID = item.parentItemID;
				}
				ZoteroPane_Local.selectItem(itemID);
			});
			popup.appendChild(menuitem);
		}
		if (tab.movable) {
			let firstUnpinnedIndex = this._getFirstUnpinnedIndex();
			// Move tab
			let menu = document.createXULElement('menu');
			menu.setAttribute('label', Zotero.getString('tabs.move'));
			let menupopup = document.createXULElement('menupopup');
			menu.append(menupopup);
			popup.appendChild(menu);
			// Move to start
			menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('tabs.moveToStart'));
			menuitem.toggleAttribute('disabled', tabIndex == firstUnpinnedIndex);
			menuitem.addEventListener('command', () => {
				this.move(id, firstUnpinnedIndex);
			});
			menupopup.appendChild(menuitem);
			// Move to end
			menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('tabs.moveToEnd'));
			menuitem.toggleAttribute('disabled', tabIndex == this._tabs.length - 1);
			menuitem.addEventListener('command', () => {
				this.move(id, this._tabs.length);
			});
			menupopup.appendChild(menuitem);
			// Move to new window
			if (this._hasHook(tabContentType, 'moveToNewWindow')) {
				menuitem = document.createXULElement('menuitem');
				menuitem.setAttribute('label', Zotero.getString('tabs.moveToWindow'));
				menuitem.toggleAttribute('disabled', this._tabs.length == 1);
				menuitem.addEventListener('command', () => {
					let { tabContentType } = this.parseTabType(tab.type);
					let moveHook = this._getHook(tabContentType, 'moveToNewWindow');
					moveHook(tab, tabIndex);
				});
				menupopup.appendChild(menuitem);
			}
		}
		// Duplicate tab
		if (this._hasHook(tabContentType, 'duplicate')) {
			menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('tabs.duplicate'));
			menuitem.addEventListener('command', () => {
				let { tabContentType } = this.parseTabType(tab.type);
				let duplicateHook = this._getHook(tabContentType, 'duplicate');
				duplicateHook(tab, tabIndex);
			});
			popup.appendChild(menuitem);
		}
		// Separator
		if (popup.hasChildNodes()) {
			popup.appendChild(document.createXULElement('menuseparator'));
		}
		// Close
		if (this._isClosable(tab)) {
			menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('general.close'));
			menuitem.addEventListener('command', () => {
				this.close(id);
			});
			popup.appendChild(menuitem);
		}
		// Close other tabs
		let otherClosableIDs = this._tabs.filter(x => x.closable && x.id != id).map(x => x.id);
		if (otherClosableIDs.length) {
			menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('tabs.closeOther'));
			menuitem.addEventListener('command', () => {
				this.close(otherClosableIDs);
			});
			popup.appendChild(menuitem);
		}
		// Undo close
		if (this._hasHook(tabContentType, 'undoClose')) {
			menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute(
				'label',
				Zotero.getString(
					'tabs.undoClose',
					[],
					// If not disabled, show proper plural for tabs to reopen
					this._history.length ? this._history[this._history.length - 1].length : 1
				)
			);
			menuitem.toggleAttribute('disabled', !this._history.length);
			menuitem.addEventListener('command', () => {
				this.undoClose();
			});
			popup.appendChild(menuitem);
		}

		Zotero.MenuManager.updateMenuPopup(
			popup,
			"main/tab",
			{
				getContext: () => {
					let item = tab.data.itemID && Zotero.Items.get(tab.data.itemID);
					let ret = {
						items: item ? [item] : [],
						tabType: tab.type,
						tabID: id,
						tabSubType: item ? item.attachmentReaderType : undefined,
					};
					return ret;
				}
			}
		);

		popup.openPopupAtScreen(x, y, true);
		return popup;
	};

	// Used to move focus back or sidenav from the tabs.
	this.focusWrapAround = function () {
		// Focus the first focusable button of context pane sidenav when reader is opened
		let itemSideNav = Zotero_Tabs.selectedIsLibrary
			&& ZoteroPane.libraryView?.getElement("zotero-view-item-sidenav");
		if (!itemSideNav) {
			Services.focus.moveFocus(window, document.getElementById("zotero-context-pane-sidenav"),
				Services.focus.MOVEFOCUS_FORWARD, 0);
			return;
		}
		if (itemSideNav.hidden) {
			// If sidenav is hidden, focus the last focusable element of item pane
			Services.focus.moveFocus(window, document.getElementById("zotero-context-splitter"),
				Services.focus.MOVEFOCUS_BACKWARD, 0);
		}
		else {
			// Focus the first focusable button of item pane sidenav
			Services.focus.moveFocus(window, itemSideNav,
				Services.focus.MOVEFOCUS_FORWARD, 0);
		}
	};

	this.showTabsMenu = function (visibility = undefined, button = undefined) {
		if (visibility === undefined) {
			visibility = !this.tabsMenuPanel.visible;
		}
		if (button === undefined) {
			button = document.getElementById("zotero-tb-tabs-menu");
		}
		if (visibility) {
			this.tabsMenuPanel.show(button);
		}
		else {
			this.tabsMenuPanel.hidePopup();
		}
	};

	this.getTabInfo = function (tabID) {
		if (!tabID) {
			tabID = this._selectedID;
		}
		let { tab } = this._getTab(tabID);
		let info = Object.assign({}, tab);
		if (!this._isLibraryTab(info)) {
			let item = Zotero.Items.get(info.data?.itemID);
			if (item && item.isAttachment()) {
				info.subType = item.attachmentReaderType;
			}
		}
		return info;
	};
};
