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


{
	const lazy = {};
	ChromeUtils.defineESModuleGetters(lazy, {
		ControllerAPIBase: "chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		WINDOW_TYPES: "chrome://zotero/content/xpcom/pluginAPI/utils.mjs",
		getWindow: "chrome://zotero/content/xpcom/pluginAPI/utils.mjs",
		getWindowID: "chrome://zotero/content/xpcom/pluginAPI/utils.mjs",
		getWindowState: "chrome://zotero/content/xpcom/pluginAPI/utils.mjs",
	});

	// Main window panes that can be toggled
	const PANES = ["item", "tagSelector", "context"];

	/**
	 * @typedef {object} WindowInfo
	 * @property {number} windowID - The window's browsing context ID, stable for its lifetime
	 * @property {WindowType} type
	 * @property {string} title
	 * @property {boolean} focused
	 * @property {number} [itemID] - The reader or note item for readerWindow and noteWindow
	 */


	// The request catalog as types for callers; keep in sync with the constructor's definitions
	/**
	 * @typedef {object} WindowControllerQueryParams
	 * @property {{ type?: WindowType }} windows
	 * @property {{ windowID: number }} getWindowState
	 * @property {{ windowID: number, pane: "item" | "tagSelector" | "context" }} getPaneState
	 *
	 *
	 * @typedef {object} WindowControllerQueryResults
	 * @property {{ windows: WindowInfo[] }} windows
	 * @property {WindowState} getWindowState
	 * @property {{ open: boolean }} getPaneState
	 *
	 *
	 * @typedef {object} WindowControllerCommandParams
	 * @property {{ windowID: number }} focusWindow
	 * @property {{ windowID: number, pane: "item" | "tagSelector" | "context" }} togglePane
	 *
	 *
	 * @typedef {object} WindowControllerCommandResults
	 * @property {{}} focusWindow
	 * @property {{ open: boolean }} togglePane
	 */

	class WindowControllerInternal extends lazy.ControllerAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "WindowController",
				queries: {
					windows: {
						params: {
							type: {
								type: "string",
								optional: true,
								checkHook: value => value === undefined || value in lazy.WINDOW_TYPES
									|| `Param 'type' must be one of ${Object.keys(lazy.WINDOW_TYPES).join(", ")}, got ${value}`,
							},
						},
						handler: ({ type }) => this._queryWindows(type),
					},
					getWindowState: {
						params: { windowID: "number" },
						handler: ({ windowID }) => lazy.getWindowState(lazy.getWindow(windowID)),
					},
					getPaneState: {
						params: {
							windowID: "number",
							pane: {
								type: "string",
								checkHook: value => PANES.includes(value)
									|| `Param 'pane' must be one of ${PANES.join(", ")}, got ${value}`,
							},
						},
						handler: ({ windowID, pane }) => this._getPaneState(
							lazy.getWindow(windowID, "mainWindow"), pane
						),
					},
				},
				commands: {
					focusWindow: {
						params: { windowID: "number" },
						handler: ({ windowID }) => this._focusWindow(windowID),
					},
					togglePane: {
						params: {
							windowID: "number",
							pane: {
								type: "string",
								checkHook: value => PANES.includes(value)
									|| `Param 'pane' must be one of ${PANES.join(", ")}, got ${value}`,
							},
						},
						handler: ({ windowID, pane }) => this._togglePane(windowID, pane),
					},
				},
			};
		}

		/**
		 * @param {WindowType} [type]
		 * @returns {WindowControllerQueryResults["windows"]}
		 */
		_queryWindows(type) {
			let types = type ? [type] : Object.keys(lazy.WINDOW_TYPES);
			let windows = [];
			for (let windowType of types) {
				for (let win of Services.wm.getEnumerator(lazy.WINDOW_TYPES[windowType])) {
					if (win.closed) {
						continue;
					}
					windows.push(this._windowInfo(win, windowType));
				}
			}
			return { windows };
		}

		/**
		 * @param {Window} win
		 * @param {WindowType} type
		 * @returns {WindowInfo}
		 */
		_windowInfo(win, type) {
			let info = {
				windowID: lazy.getWindowID(win),
				type,
				title: win.document.title,
				focused: Services.focus.activeWindow === win,
			};
			// TODO: itemID for readerWindow (win.reader.itemID) and noteWindow
			return info;
		}

		/**
		 * Raise the window within Zotero and give it focus
		 * @param {number} windowID
		 */
		_focusWindow(windowID) {
			lazy.getWindow(windowID).focus();
		}

		/**
		 * Toggle a pane of a main window; the same paths the View menu and toolbar use
		 * @param {number} windowID
		 * @param {"item" | "tagSelector" | "context"} pane
		 * @returns {Promise<WindowControllerCommandResults["togglePane"]>}
		 */
		async _togglePane(windowID, pane) {
			let win = lazy.getWindow(windowID, "mainWindow");
			switch (pane) {
				case "item":
					win.ZoteroPane.toggleItemPane();
					break;
				case "tagSelector":
					await win.ZoteroPane.toggleTagSelector();
					break;
				case "context":
					win.ZoteroContextPane.togglePane();
					break;
			}
			return this._getPaneState(win, pane);
		}

		/**
		 * @param {Window} win - A main window
		 * @param {"item" | "tagSelector" | "context"} pane
		 * @returns {{ open: boolean }}
		 */
		_getPaneState(win, pane) {
			let state = {};
			switch (pane) {
				case "item":
				{
					state.open = !win.ZoteroPane.itemPane.collapsed;
					break;
				}
				case "tagSelector":
				{
					state.open = !win.document.getElementById("zotero-tag-selector-container").hasAttribute("collapsed");
					break;
				}
				case "context":
				{
					state.open = !win.ZoteroContextPane.collapsed;
					break;
				}
			}
			return state;
		}
	}

	/**
	 * Query and command access to Zotero's windows. Requests take and return plain objects only
	 *
	 * @memberof Zotero
	 */
	Zotero.WindowController = {
		windowTypes: Object.freeze(Object.keys(lazy.WINDOW_TYPES)),

		errorCodes: lazy.ControllerAPIBase.errorCodes,

		_windowController: new WindowControllerInternal(),

		/**
		 * Read window state
		 * @template {keyof WindowControllerQueryParams} N
		 * @param {N} name
		 * @param {WindowControllerQueryParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<WindowControllerQueryResults[N]>}
		 */
		query(name, params, _callerPluginID) {
			return Zotero.WindowController._windowController.query(name, params, _callerPluginID);
		},

		/**
		 * Change window state
		 * @template {keyof WindowControllerCommandParams} N
		 * @param {N} name
		 * @param {WindowControllerCommandParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<WindowControllerCommandResults[N]>}
		 */
		command(name, params, _callerPluginID) {
			return Zotero.WindowController._windowController.command(name, params, _callerPluginID);
		},
	};

	let injectCaller = ({ pluginID, args }) => {
		args[2] = pluginID;
	};
	lazy.ScopeVariables.setCustomParser(Zotero.WindowController.query, injectCaller);
	lazy.ScopeVariables.setCustomParser(Zotero.WindowController.command, injectCaller);
}
