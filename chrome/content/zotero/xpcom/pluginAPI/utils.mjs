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


import { ControllerAPIBase } from "chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs";

const { NOT_FOUND } = ControllerAPIBase.errorCodes;

/**
 * Plugin-facing window type -> chrome windowtype; keep in sync with shortcut and window-resource APIs
 * @typedef {keyof typeof WINDOW_TYPES} WindowType
 */
const WINDOW_TYPES = Object.freeze({
	mainWindow: "navigator:browser",
	readerWindow: "zotero:reader",
	noteWindow: "zotero:note",
	preferencePane: "zotero:pref",
});

/**
 * Stable per-window handle used as the plugin-facing window ID
 * @param {Window} win
 * @returns {number}
 */
function getWindowID(win) {
	return win.browsingContext.id;
}

/**
 * @param {number} windowID
 * @param {WindowType} [type] - Reject a window of another type
 * @returns {Window}
 */
function getWindow(windowID, type) {
	let win = null;
	for (let candidate of Services.wm.getEnumerator(null)) {
		if (!candidate.closed && getWindowID(candidate) === windowID) {
			win = candidate;
			break;
		}
	}
	if (!win) {
		throw ControllerAPIBase.createError(NOT_FOUND, `No window with ID ${windowID}`);
	}
	if (type && win.document.documentElement.getAttribute("windowtype") !== WINDOW_TYPES[type]) {
		throw ControllerAPIBase.createError(NOT_FOUND, `Window ${windowID} is not a ${type}`);
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

export { WINDOW_TYPES, getWindowID, getWindow, getMainWindow, getWindowState };
