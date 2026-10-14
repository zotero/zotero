/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
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


import { ControllerError } from "chrome://zotero/content/xpcom/plugins/apiErrors.mjs";

const { NOT_FOUND, INVALID_PARAMS } = ControllerError.codes;

/**
 * Plugin-facing window type -> chrome windowtype; the shortcut and window-resource targets are names from here
 * @typedef {keyof typeof WINDOW_TYPES} WindowType
 */
const WINDOW_TYPES = Object.freeze({
	mainWindow: "navigator:browser",
	readerWindow: "zotero:reader",
	noteWindow: "zotero:note",
	preferencePane: "zotero:pref",
	pluginWindow: "zotero:pluginWindow",
});

// Set on a plugin window's root element by PluginWindow.init()
const PLUGIN_WINDOW_OWNER_ATTR = "data-plugin-id";

// What a tab or window opens from an item
const OPENABLE_TYPES = Object.freeze(["reader", "note"]);

// What a window opens on top of those: the preferences, on a pane
const OPENABLE_WINDOW_TYPES = Object.freeze([...OPENABLE_TYPES, "preferencePane"]);

/**
 * Stable per-window handle used as the plugin-facing window ID
 * @param {Window} win
 * @returns {number}
 */
function getWindowID(win) {
	return win.browsingContext.id;
}

/**
 * @param {Window} win
 * @returns {string | null} The owning plugin ID of a plugin window; null for any other window
 */
function getPluginWindowOwner(win) {
	return win.document.documentElement.getAttribute(PLUGIN_WINDOW_OWNER_ATTR);
}

/**
 * Whether a plugin may see a window: any Zotero window, but only its own plugin windows
 * @param {Window} win
 * @param {string} callerPluginID
 * @returns {boolean}
 */
function canAccessWindow(win, callerPluginID) {
	let root = win.document.documentElement;
	return root.getAttribute("windowtype") !== WINDOW_TYPES.pluginWindow
		|| root.getAttribute(PLUGIN_WINDOW_OWNER_ATTR) === callerPluginID;
}

/**
 * @param {number} windowID
 * @param {WindowType} [type] - Reject a window of another type
 * @param {string} [callerPluginID] - Reject another plugin's window as not found; omitted by chrome
 * @returns {Window}
 */
function getWindow(windowID, type, callerPluginID) {
	let win = null;
	for (let candidate of Services.wm.getEnumerator(null)) {
		if (!candidate.closed && getWindowID(candidate) === windowID) {
			win = candidate;
			break;
		}
	}
	if (!win || (callerPluginID && !canAccessWindow(win, callerPluginID))) {
		throw new ControllerError(NOT_FOUND, `No window with ID ${windowID}`);
	}
	if (type && win.document.documentElement.getAttribute("windowtype") !== WINDOW_TYPES[type]) {
		throw new ControllerError(NOT_FOUND, `Window ${windowID} is not a ${type}`);
	}
	return win;
}

/**
 * @param {number} windowID
 * @returns {Window} The main window with that ID
 */
function getMainWindow(windowID) {
	return getWindow(windowID, "mainWindow");
}

/**
 * @param {number} itemID
 * @param {"reader" | "note"} type
 * @returns {Zotero.Item} A readable attachment for reader, a note for note; NotFound or InvalidParams otherwise
 */
function getOpenableItem(itemID, type) {
	let item = Zotero.Items.get(itemID);
	if (!item) {
		throw new ControllerError(NOT_FOUND, `No item with ID ${itemID}`);
	}
	let openable = type === "reader"
		? item.isFileAttachment() && !!item.attachmentReaderType
		: item.isNote();
	if (!openable) {
		throw new ControllerError(INVALID_PARAMS, `Item ${itemID} cannot be opened as ${type}`);
	}
	return item;
}

/**
 * @typedef {"normal" | "minimized" | "maximized" | "fullscreen"} SizeMode - The XUL sizemode values
 */

/**
 * @typedef {object} WindowState
 * @property {SizeMode} sizeMode
 * @property {boolean} focused
 * @property {number} x - Screen position of the window's outer top-left corner, in CSS pixels
 * @property {number} y
 * @property {number} width - Outer size, including the title bar and borders
 * @property {number} height
 */

/**
 * @param {Window} win
 * @returns {WindowState}
 */
function getWindowState(win) {
	let sizeMode = "normal";
	// Not win.fullScreen: reading it logs a deprecation warning, and windowState covers it
	if (win.windowState === win.STATE_FULLSCREEN) {
		sizeMode = "fullscreen";
	}
	else if (win.windowState === win.STATE_MINIMIZED) {
		sizeMode = "minimized";
	}
	else if (win.windowState === win.STATE_MAXIMIZED) {
		sizeMode = "maximized";
	}
	return {
		sizeMode,
		focused: Services.focus.activeWindow === win,
		x: win.screenX,
		y: win.screenY,
		width: win.outerWidth,
		height: win.outerHeight,
	};
}

/**
 * Whether a tab matches an `enableForTabTypes` list: "reader" and "reader/*" take every reader type,
 * "reader/pdf" only that one
 * @param {string[]} tabTypes types to match against
 * @param {string} tabType current tab type
 * @param {string} [tabSubType] current tab subtype
 * @returns {boolean}
 */
function matchesTabType(tabTypes, tabType, tabSubType) {
	return tabTypes.some((type) => {
		let [entryType, entrySubType] = type.split("/");
		return entryType === tabType && (!entrySubType || entrySubType === "*" || entrySubType === tabSubType);
	});
}

const WindowUtils = Object.freeze({
	WINDOW_TYPES,
	OPENABLE_TYPES,
	OPENABLE_WINDOW_TYPES,
	getWindowID,
	getWindow,
	getMainWindow,
	getWindowState,
	getPluginWindowOwner,
	canAccessWindow,
	getOpenableItem,
	matchesTabType,
});

export { WindowUtils };
