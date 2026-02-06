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

// Configure loaded tabs limit
const MAX_LOADED_TABS = Zotero.Prefs.get("tabs.maxLoadedTabs");
const UNLOAD_UNUSED_AFTER = Zotero.Prefs.get("tabs.unloadUnusedAfter");

// Keep in sync with reader/src/common/components/sidebar/sidebar-resizer.js
const SIDEBAR_DEFAULT_WIDTH = 240; // Pixels
const SIDEBAR_MIN_WIDTH = 180; // Pixels

var Zotero_Tabs = new function () {
	Object.defineProperty(this, 'selectedID', {
		get: () => this._selectedID
	});

	Object.defineProperty(this, 'selectedType', {
		get: () => this._getTab(this._selectedID).tab.type
	});

	Object.defineProperty(this, 'selectedIndex', {
		get: () => this._getTab(this._selectedID).tabIndex
	});

	Object.defineProperty(this, 'deck', {
		get: () => document.getElementById('tabs-deck')
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
	this._tabs = [{
		id: 'zotero-pane',
		type: 'library',
		title: '',
		data: {}
	}];
	this._selectedID = 'zotero-pane';
	this._prevSelectedID = null;
	this._history = [];
	this._focusOptions = {};

	this._loadableTypes = ['reader', 'note'];

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
					preventJumpback: true
				});
				await reader._initPromise;
			},
			note: async (tab, tabIndex, options) => {
				let editorInstance = await Zotero.Notes.open(tab.data.itemID, options && options.location, {
					tabID: tab.id,
					title: tab.title,
					tabIndex,
					allowDuplicate: true,
					preventJumpback: true
				});
				await editorInstance._initPromise;
			}
		},
		focusFirst: {
			library: async () => {
				let collectionsPane = document.getElementById("zotero-collections-pane");
				if (collectionsPane.getAttribute("collapsed")) {
					document.getElementById('zotero-tb-add').focus();
					return;
				}
				document.getElementById('zotero-tb-collection-add').focus();
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
				// Move focus to the last focused element of zoteroPane if any or itemTree otherwise
				if (options.focusElementID) {
					tab.lastFocusedElement = document.getElementById(options.focusElementID);
				}
				// Small delay to make sure the focus does not remain on the actual
				// tab after mouse click
				setTimeout(() => {
					if (tab.lastFocusedElement) {
						tab.lastFocusedElement.focus();
					}
					if (document.activeElement !== tab.lastFocusedElement) {
						ZoteroPane.itemsView.focus();
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
			reader: async (tab, _tabIndex) => {
				Zotero_Tabs.close(tab.id);
				let { itemID, secondViewState } = tab.data;
				await Zotero.Reader.open(itemID, null, { openInWindow: true, secondViewState });
			},
			note: async (tab, _tabIndex) => {
				Zotero_Tabs.close(tab.id);
				let { itemID } = tab.data;
				await Zotero.Notes.open(itemID, null, { openInWindow: true });
			}
		},
		duplicate: {
			reader: async (tab, tabIndex) => {
				if (tab.data.itemID) {
					let { secondViewState } = tab.data;
					await Zotero.Reader.open(tab.data.itemID, null, { tabIndex: tabIndex + 1, allowDuplicate: true, secondViewState });
				}
			},
			note: async (tab, tabIndex) => {
				if (tab.data.itemID) {
					await Zotero.Notes.open(tab.data.itemID, null, { tabIndex: tabIndex + 1, allowDuplicate: true });
				}
			}
		},
		undoClose: {
			reader: async (tab, _tabIndex) => {
				if (Zotero.Items.exists(tab.data.itemID)) {
					await Zotero.Reader.open(tab.data.itemID,
						null,
						{
							tabIndex: tab.index,
							openInBackground: true,
							allowDuplicate: true
						}
					);
					return true;
				}
				return false;
			},
			note: async (tab, _tabIndex) => {
				if (Zotero.Items.exists(tab.data.itemID)) {
					await Zotero.Notes.open(tab.data.itemID,
						null,
						{
							tabIndex: tab.index,
							openInBackground: true,
							allowDuplicate: true
						}
					);
					return true;
				}
				return false;
			}
		},
		restoreState: {
			library: async (tab, _tabIndex) => {
				this.rename('zotero-pane', tab.title);
				// At first, library tab is added without the icon data. We set it here once we know what it is
				let libraryTab = this._getTab('zotero-pane');
				libraryTab.tab.data = tab.data || {};
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
		}
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
			type = this.selectedType;
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

	// Keep track of item modifications to update the title
	this._notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'tabs');

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

	this._getTab = function (id) {
		var tabIndex = this._tabs.findIndex(tab => tab.id == id);
		return { tab: this._tabs[tabIndex], tabIndex };
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
			// Find the icon for the library tab
			if (tab.id === 'zotero-pane') {
				let index = ZoteroPane.collectionsView?.selection?.focused;
				if (typeof index !== 'undefined' && ZoteroPane.collectionsView.getRow(index)) {
					let iconName = ZoteroPane.collectionsView.getIconName(index);
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

		this._tabBarRef.current.setTabs(this._tabs.map((tab) => {
			let { tabContentType } = this.parseTabType(tab.type);
			return {
				id: tab.id,
				type: tab.type,
				title: tab.title,
				renderTitle: tabContentType === 'reader',
				selected: tab.id == this._selectedID,
				isItemType: tab.id !== 'zotero-pane',
				icon: tab.data?.icon || null
			};
		}));
		// Disable File > Close menuitem if multiple tabs are open
		const multipleTabsOpen = this._tabs.length > 1;
		document.getElementById('cmd_close').setAttribute('disabled', multipleTabsOpen);
		var { tab } = this._getTab(this._selectedID);
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
			placeholder.setAttribute('collapsed', sidebarWidth ? 'false' : 'true');
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
				onTabClose={this.close.bind(this)}
				onContextMenu={this._openMenu.bind(this)}
				onRefocus={this.refocus.bind(this)}
				onLoad={this._update.bind(this)}
			/>
		);

		this._loadSidebarState();
	};

	this.destroy = function () {
		this._saveSidebarState();
	};

	// When an item is modified, update the title accordingly
	this.notify = async (event, type, ids, _) => {
		if (event !== "modify") return;
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
			if (tab.id == this._selectedID) {
				o.selected = true;
			}
			return o;
		});
	};

	this.restoreState = async function (tabs) {
		let itemIDs = [];
		for (let i = 0; i < tabs.length; i++) {
			let tab = tabs[i];
			let { tabContentType } = this.parseTabType(tab.type);
			let restoreStateHook = this._getHook(tabContentType, 'restoreState');
			let { itemID } = await restoreStateHook(tab, i);
			if (itemID) {
				itemIDs.push(itemID);
			}
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
	 * Add a new tab
	 *
	 * @param {String} type
	 * @param {String} [title] - Tab title. If empty and data.itemID is set, the title will be fetched automatically
	 * @param {String} data - Extra data about the tab to pass to notifier and session
	 * @param {Integer} index
	 * @param {Boolean} select
	 * @param {Function} onClose
	 * @return {{ id: string, container: XULElement}} id - tab id, container - a new tab container created in the deck
	 */
	this.add = function ({ id, type, data, title, index, select, onClose, preventJumpback }) {
		if (typeof type != 'string') {
		}
		if (title && typeof title != 'string') {
			throw new Error(`'title' should be string or undefined (was ${typeof title})`);
		}
		if (!title) {
			title = "";
		}
		if (index !== undefined && (!Number.isInteger(index) || index < 1)) {
			throw new Error(`'index' should be an integer > 0 (was ${index} (${typeof index})`);
		}
		if (onClose !== undefined && typeof onClose != 'function') {
			throw new Error(`'onClose' should be a function (was ${typeof onClose})`);
		}
		id = id || 'tab-' + Zotero.Utilities.randomString();
		var container = document.createXULElement('tab-content');
		container.id = id;
		this.deck.appendChild(container);
		var tab = { id, type, title, data, onClose };
		index = index || this._tabs.length;
		this._tabs.splice(index, 0, tab);
		this._update();
		Zotero.Notifier.trigger('add', 'tab', [id], { [id]: Object.assign({}, data, { type }) }, true);
		if (select) {
			let previousID = this._selectedID;
			this.select(id);
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

	/**
	 * Close tabs
	 *
	 * @param {String|Array<String>|undefined} ids One or more ids, or empty for the current tab
	 */
	this.close = function (ids) {
		if (!ids) {
			ids = [this._selectedID];
		}
		else if (!Array.isArray(ids)) {
			ids = [ids];
		}
		if (ids.includes('zotero-pane')) {
			throw new Error('Library tab cannot be closed');
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
				let selectOptions = {};
				// If the tabs menu is visible, let the tab bar handle focus
				if (this.tabsMenuPanel.visible) {
					selectOptions.keepTabFocused = true;
				}
				this.select(
					this._prevSelectedID || (this._tabs[tabIndex + 1] || this._tabs[tabIndex - 1]).id,
					false, selectOptions
				);
			}
			if (tab.id == this._prevSelectedID) {
				this._prevSelectedID = null;
			}
			tabIndex = this._tabs.findIndex(x => x.id === id);
			this._tabs.splice(tabIndex, 1);
			if (tab.onClose) {
				tab.onClose();
			}
			historyEntry.push({ index: tmpTabs.indexOf(tab), data: tab.data, type: tab.type });
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
		this._history.push(historyEntry);
		Zotero.Notifier.trigger('close', 'tab', [closedIDs], true);
		this._update();
	};

	/**
	 * Close all tabs except the first one
	 */
	this.closeAll = function () {
		this.close(this._tabs.slice(1).map(x => x.id));
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
				openPromises.push(undoCloseHook({ data: tab.data }, tab.index)
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
		if (!Number.isInteger(newIndex) || newIndex < 1) {
			throw new Error(`'newIndex' should be an interger > 0 (was ${newIndex} (${typeof newIndex})`);
		}
		var { tab, tabIndex } = this._getTab(id);
		if (tabIndex == 0) {
			throw new Error('Library tab cannot be moved');
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
		if (this._selectedID === 'zotero-pane'
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
		this._update();
		Zotero.Notifier.trigger('select', 'tab', [tab.id], { [tab.id]: { type: tab.type } }, true);

		let currentTabContent = this.getTabContent(id);

		if (!isEditorFocused) {
			if (options.keepTabFocused !== true) {
				let refocusHook = this._getHook(tabContentType, 'refocus');
				setTimeout(() => refocusHook(tab, tabIndex, options), 0);
			}
			else {
				let tabNode = document.querySelector(`#tab-bar-container .tab[data-id="${tab.id}"]`);
				if (document.activeElement.getAttribute('data-id') != tabNode.getAttribute('data-id')) {
					// Keep focus on the currently selected tab during keyboard navigation
					if (tab.id == 'zotero-pane') {
						// Since there is more than one zotero-pane tab (pinned and not pinned),
						// use moveFocus() to focus on the visible one
						this.moveFocus('first');
					}
					else {
						tabNode.focus();
					}
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

	this.unload = function (id) {
		var { tab, tabIndex } = this._getTab(id);
		if (!tab || tab.id === this._selectedID || !this._loadableTypes.includes(tab.type)) {
			return;
		}
		this.close(tab.id);
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
		Zotero.Notifier.trigger("load", "tab", [id], { [id]: Object.assign({}, tab, { prevType }) }, true);
	};

	this.unloadUnusedTabs = function () {
		for (let tab of this._tabs) {
			if (Zotero.Date.getUnixTimestamp() - tab.timeUnselected > UNLOAD_UNUSED_AFTER) {
				this.unload(tab.id);
			}
		}
		// TODO: also unload note tabs
		let tabs = this._tabs.slice().filter(x => x.type === 'reader');
		tabs.sort((a, b) => b.timeUnselected - a.timeUnselected);
		tabs = tabs.slice(MAX_LOADED_TABS);
		for (let tab of tabs) {
			this.unload(tab.id);
		}
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
			const nextTab = this._tabs[tabIndexToFocus];
			// There may be duplicate tabs - in normal tab array and in pinned tabs
			// Go through all candidates and try to focus the visible one
			let candidates = document.querySelectorAll(`#tab-bar-container .tab[data-id="${nextTab.id}"]`);
			for (let node of candidates) {
				node.focus();
				// Visible tab was found and focused
				if (document.activeElement == node) return;
			}
		}
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
		if (id !== 'zotero-pane') {
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
			// Move tab
			let menu = document.createXULElement('menu');
			menu.setAttribute('label', Zotero.getString('tabs.move'));
			let menupopup = document.createXULElement('menupopup');
			menu.append(menupopup);
			popup.appendChild(menu);
			// Move to start
			menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('tabs.moveToStart'));
			menuitem.setAttribute('disabled', tabIndex == 1);
			menuitem.addEventListener('command', () => {
				this.move(id, 1);
			});
			menupopup.appendChild(menuitem);
			// Move to end
			menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('tabs.moveToEnd'));
			menuitem.setAttribute('disabled', tabIndex == this._tabs.length - 1);
			menuitem.addEventListener('command', () => {
				this.move(id, this._tabs.length);
			});
			menupopup.appendChild(menuitem);
			// Move to new window
			if (this._hasHook(tabContentType, 'moveToNewWindow')) {
				menuitem = document.createXULElement('menuitem');
				menuitem.setAttribute('label', Zotero.getString('tabs.moveToWindow'));
				menuitem.setAttribute('disabled', false);
				menuitem.addEventListener('command', () => {
					let { tabContentType } = this.parseTabType(tab.type);
					let moveHook = this._getHook(tabContentType, 'moveToNewWindow');
					moveHook(tab, tabIndex);
				});
				menupopup.appendChild(menuitem);
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
			popup.appendChild(document.createXULElement('menuseparator'));
		}
		// Close
		if (id != 'zotero-pane') {
			menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('general.close'));
			menuitem.addEventListener('command', () => {
				this.close(id);
			});
			popup.appendChild(menuitem);
		}
		// Close other tabs
		if (!(this._tabs.length == 2 && id != 'zotero-pane')) {
			menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', Zotero.getString('tabs.closeOther'));
			menuitem.addEventListener('command', () => {
				this.close(this._tabs.slice(1).filter(x => x.id != id).map(x => x.id));
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
			menuitem.setAttribute('disabled', !this._history.length);
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
					let item = Zotero.Items.get(tab.data.itemID);
					let ret = {
						items: [item],
						tabType: tab.type,
						tabID: id,
						tabSubType: item.attachmentReaderType,
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
		if (Zotero_Tabs.selectedIndex > 0) {
			Services.focus.moveFocus(window, document.getElementById("zotero-context-pane-sidenav"),
				Services.focus.MOVEFOCUS_FORWARD, 0);
			return;
		}
		let itemSideNav = document.getElementById("zotero-view-item-sidenav");
		if (itemSideNav.hidden) {
			// If sidenav is hidden, focus the last focusable element of item pane
			Services.focus.moveFocus(window, document.getElementById("zotero-context-splitter"),
				Services.focus.MOVEFOCUS_BACKWARD, 0);
		}
		else {
			// Focus the first focusable button of item pane sidenav
			Services.focus.moveFocus(window, document.getElementById("zotero-view-item-sidenav"),
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
		if (info.type !== 'library') {
			let item = Zotero.Items.get(info.data?.itemID);
			if (item && item.isAttachment()) {
				info.subType = item.attachmentReaderType;
			}
		}
		return info;
	};
};
