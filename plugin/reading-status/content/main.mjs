/* global Zotero, Services, ChromeUtils, Cc, Ci */

import * as ReadingStatus from './readingStatus.js';
import { openKanbanTab } from './kanbanTab.js';

const PLUGIN_ID = 'reading-status@placeholder';

let state = {
	rootURI: null,
	infoRowID: null,
	columnID: null,
	menuIDs: [],
	stylesheetURI: null,
	windows: new Set(),
	// window -> Set<tabID> for Kanban tabs we've opened in that window
	openTabs: new WeakMap(),
};

export async function startup({ rootURI }) {
	state.rootURI = rootURI;

	// Expose helpers on the Zotero namespace so anything else in the running
	// session can reach them (e.g. our own kanban tab, future plugin extensions,
	// the Browser Console during development).
	Zotero.ReadingStatus = ReadingStatus;

	_registerStylesheet(rootURI);
	_registerInfoRow();
	_registerColumn();
	_registerMenus();
}

export async function onMainWindowLoad({ window }) {
	state.windows.add(window);
	state.openTabs.set(window, new Set());
}

export async function onMainWindowUnload({ window }) {
	_closeTabsInWindow(window);
	state.windows.delete(window);
}

function _closeTabsInWindow(window) {
	let ids = state.openTabs.get(window);
	if (!ids) return;
	for (let id of [...ids]) {
		try {
			window.Zotero_Tabs.close(id);
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	ids.clear();
}

export async function shutdown() {
	for (let id of state.menuIDs) {
		try {
			Zotero.MenuManager.unregisterMenu(id);
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	state.menuIDs = [];
	if (state.columnID) {
		try {
			Zotero.ItemTreeManager.unregisterColumn(state.columnID);
		}
		catch (e) {
			Zotero.logError(e);
		}
		state.columnID = null;
	}
	if (state.infoRowID) {
		try {
			Zotero.ItemPaneManager.unregisterInfoRow(state.infoRowID);
		}
		catch (e) {
			Zotero.logError(e);
		}
		state.infoRowID = null;
	}
	// Close every open Kanban tab we opened.
	for (let window of state.windows) {
		_closeTabsInWindow(window);
	}
	state.windows.clear();
	_unregisterStylesheet();
	delete Zotero.ReadingStatus;
}


function _registerInfoRow() {
	state.infoRowID = Zotero.ItemPaneManager.registerInfoRow({
		rowID: 'reading-status',
		pluginID: PLUGIN_ID,
		label: { l10nID: 'reading-status-row-label' },
		position: 'end',
		editable: true,
		onGetData: ({ item }) => {
			let v = ReadingStatus.get(item);
			return v ? ReadingStatus.getLocalizedLabel(v) : '';
		},
		onSetData: ({ item, value }) => {
			let parsed = ReadingStatus.parseInput(value);
			// Invalid input — leave the field untouched.
			if (parsed === null) return;
			ReadingStatus.set(item, parsed).catch(e => Zotero.logError(e));
		},
		onItemChange: ({ tabType, setEnabled }) => {
			setEnabled(tabType === 'library' || tabType === 'reader');
		},
	});
}


function _registerColumn() {
	state.columnID = Zotero.ItemTreeManager.registerColumn({
		dataKey: 'readingStatus',
		pluginID: PLUGIN_ID,
		label: 'reading-status-column-label',
		dataProvider: item => ReadingStatus.get(item),
		minWidth: 90,
		showInColumnPicker: true,
		columnPickerSubMenu: true,
		zoteroPersist: ['width', 'hidden', 'sortDirection'],
	});
}


function _registerMenus() {
	// Set Reading Status submenu on item right-click
	let setSubmenu = Zotero.MenuManager.registerMenu({
		menuID: 'reading-status-set',
		pluginID: PLUGIN_ID,
		target: 'main/library/item',
		menus: [{
			menuType: 'submenu',
			l10nID: 'reading-status-set-submenu',
			menus: [
				..._statusMenuItem('', 'reading-status-none'),
				..._statusMenuItem('Unread', 'reading-status-unread'),
				..._statusMenuItem('In Progress', 'reading-status-in-progress'),
				..._statusMenuItem('Done', 'reading-status-done'),
				..._statusMenuItem('Abandoned', 'reading-status-abandoned'),
			],
		}],
	});
	if (setSubmenu) state.menuIDs.push(setSubmenu);

	// View → Open Kanban Board
	let openKanban = Zotero.MenuManager.registerMenu({
		menuID: 'reading-status-open-kanban',
		pluginID: PLUGIN_ID,
		target: 'main/menubar/view',
		menus: [{
			menuType: 'menuitem',
			l10nID: 'reading-status-open-kanban',
			onCommand: (ev) => {
				let win = ev.target.ownerGlobal;
				let ids = state.openTabs.get(win);
				if (!ids) {
					ids = new Set();
					state.openTabs.set(win, ids);
				}
				openKanbanTab(win, {
					onOpen: id => ids.add(id),
					onClose: id => ids.delete(id),
				}).catch(e => Zotero.logError(e));
			},
		}],
	});
	if (openKanban) state.menuIDs.push(openKanban);
}

function _statusMenuItem(value, l10nID) {
	return [{
		menuType: 'menuitem',
		l10nID,
		onCommand: async (ev) => {
			let win = ev.target.ownerGlobal;
			let items = win.ZoteroPane?.getSelectedItems?.() ?? [];
			for (let item of items) {
				try {
					await ReadingStatus.set(item, value);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		},
	}];
}


function _registerStylesheet(rootURI) {
	let uri = Services.io.newURI(rootURI + 'styles/kanban.css');
	let sss = Cc['@mozilla.org/content/style-sheet-service;1']
		.getService(Ci.nsIStyleSheetService);
	if (!sss.sheetRegistered(uri, sss.AUTHOR_SHEET)) {
		sss.loadAndRegisterSheet(uri, sss.AUTHOR_SHEET);
	}
	state.stylesheetURI = uri;
}

function _unregisterStylesheet() {
	if (!state.stylesheetURI) return;
	let sss = Cc['@mozilla.org/content/style-sheet-service;1']
		.getService(Ci.nsIStyleSheetService);
	if (sss.sheetRegistered(state.stylesheetURI, sss.AUTHOR_SHEET)) {
		sss.unregisterSheet(state.stylesheetURI, sss.AUTHOR_SHEET);
	}
	state.stylesheetURI = null;
}
