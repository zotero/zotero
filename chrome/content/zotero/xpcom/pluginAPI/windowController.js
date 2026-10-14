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
		ControllerAPIBase: "chrome://zotero/content/xpcom/pluginAPI/controllerAPIBase.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		WindowUtils: "chrome://zotero/content/xpcom/plugins/window.mjs",
		loadPluginPageInBrowser: "chrome://zotero/content/xpcom/plugins/embeddedPage.mjs",
		sanitizeWindowFeatures: "chrome://zotero/content/xpcom/plugins/embeddedPage.mjs",
		stopAutoResize: "chrome://zotero/content/xpcom/plugins/embeddedPage.mjs",
		PluginProtocol: "chrome://zotero/content/xpcom/plugins/protocol.mjs",
	});

	// start: the collections pane in a library tab, the tab's own sidebar otherwise
	// end: the item pane in a library tab, the context pane otherwise
	const MAINWINDOW_PANES = ["start", "end"];

	/**
	 * @typedef {object} WindowInfo
	 * @property {number} windowID - The window's browsing context ID, stable for its lifetime
	 * @property {WindowType} type
	 * @property {string} title
	 * @property {boolean} focused
	 * @property {number} [itemID] - The reader or note item for readerWindow and noteWindow
	 * @property {string} [pluginID] - The owning plugin for pluginWindow
	 */

	/**
	 * The window.open-style features of a plugin window by name, such as width or centerscreen
	 * @typedef {Object<string, boolean | number>} PluginWindowFeatures
	 */

	/**
	 * A plugin's own window, opened by openPluginWindow; the chrome wrapper itself never crosses
	 * @typedef {object} PluginWindowHandle
	 * @property {object} page - The page messenger
	 * @property {number} windowID - For focusWindow, getWindowState and closeWindow
	 */

	/**
	 * A window's panes by name, carrying only the ones that window type has
	 * @typedef {object} LayoutState
	 * @property {object} panes
	 * @property {{ open: boolean }} [panes.start]
	 * @property {{ open: boolean }} [panes.end]
	 */


	// The request catalog as types for callers; keep in sync with the constructor's definitions
	/**
	 * @typedef {object} WindowControllerQueryParams
	 * @property {{ type?: WindowType }} windows
	 * @property {{ windowID: number }} getWindowState
	 * @property {{ windowID: number }} getLayoutState
	 *
	 *
	 * @typedef {object} WindowControllerQueryResults
	 * @property {{ windows: WindowInfo[] }} windows
	 * @property {WindowState} getWindowState
	 * @property {LayoutState} getLayoutState
	 *
	 *
	 * @typedef {object} WindowControllerCommandParams
	 * @property {{ windowID: number }} focusWindow
	 * @property {{ windowID: number }} closeWindow
	 * @property {{ windowID: number, pane: "start" | "end", open?: boolean }} togglePane
	 * @property {{ type: "reader" | "note" | "preferencePane", itemID?: number, location?: object }} openWindow
	 * @property {{ url: string, features?: PluginWindowFeatures, name?: string, notitle?: boolean, fitContent?: boolean, parentWindowID?: number }} openPluginWindow
	 *
	 *
	 * @typedef {object} WindowControllerCommandResults
	 * @property {{}} focusWindow
	 * @property {{}} closeWindow
	 * @property {{ open: boolean }} togglePane
	 * @property {{ windowID: number }} openWindow
	 * @property {PluginWindowHandle} openPluginWindow
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
								checkHook: value => value === undefined || value in lazy.WindowUtils.WINDOW_TYPES
									|| `Param 'type' must be one of ${Object.keys(lazy.WindowUtils.WINDOW_TYPES).join(", ")}, got ${value}`,
							},
						},
						handler: ({ type, pluginID }) => this._queryWindows(type, pluginID),
					},
					getWindowState: {
						params: { windowID: "number" },
						handler: ({ windowID, pluginID }) => lazy.WindowUtils.getWindowState(
							lazy.WindowUtils.getWindow(windowID, undefined, pluginID)
						),
					},
					getLayoutState: {
						params: { windowID: "number" },
						handler: ({ windowID, pluginID }) => this._getLayoutState(
							lazy.WindowUtils.getWindow(windowID, "mainWindow", pluginID)
						),
					},
				},
				commands: {
					focusWindow: {
						params: { windowID: "number" },
						handler: ({ windowID, pluginID }) => this._focusWindow(windowID, pluginID),
					},
					closeWindow: {
						params: { windowID: "number" },
						handler: ({ windowID, pluginID }) => this._closeWindow(windowID, pluginID),
					},
					togglePane: {
						params: {
							windowID: "number",
							pane: {
								type: "string",
								checkHook: value => MAINWINDOW_PANES.includes(value)
									|| `Param 'pane' must be one of ${MAINWINDOW_PANES.join(", ")}, got ${value}`,
							},
							open: { type: "boolean", optional: true },
						},
						handler: ({ windowID, pane, open, pluginID }) => this._togglePane(windowID, pane, open, pluginID),
					},
					openWindow: {
						params: {
							type: {
								type: "string",
								checkHook: value => lazy.WindowUtils.OPENABLE_WINDOW_TYPES.includes(value)
									|| `Param 'type' must be one of ${lazy.WindowUtils.OPENABLE_WINDOW_TYPES.join(", ")}, got ${value}`,
							},
							itemID: { type: "number", optional: true },
							location: { type: "object", optional: true },
						},
						handler: ({ type, itemID, location }) => this._openWindow(type, itemID, location),
					},
					openPluginWindow: {
						params: {
							url: "string",
							features: {
								type: "object",
								optional: true,
								checkHook: value => value === undefined
									|| (value !== null && !Array.isArray(value)
										&& Object.values(value).every(v => ["boolean", "number"].includes(typeof v)))
									|| "every feature must be a boolean or a number",
							},
							name: { type: "string", optional: true },
							notitle: { type: "boolean", optional: true },
							fitContent: { type: "boolean", optional: true },
							parentWindowID: { type: "number", optional: true },
						},
						scopedResult: true,
						handler: params => this._openPluginWindow(params),
					},
				},
			};
		}

		/**
		 * @param {WindowType} [type]
		 * @param {string} [pluginID] - The calling plugin, which sees only its own plugin windows
		 * @returns {WindowControllerQueryResults["windows"]}
		 */
		_queryWindows(type, pluginID) {
			let types = type ? [type] : Object.keys(lazy.WindowUtils.WINDOW_TYPES);
			let windows = [];
			for (let windowType of types) {
				for (let win of Services.wm.getEnumerator(lazy.WindowUtils.WINDOW_TYPES[windowType])) {
					if (Cu.isDeadWrapper(win) || win.closed
							|| (pluginID && !lazy.WindowUtils.canAccessWindow(win, pluginID))) {
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
				windowID: lazy.WindowUtils.getWindowID(win),
				type,
				title: win.document.title,
				focused: Services.focus.activeWindow === win,
			};
			if (type === "readerWindow") {
				info.itemID = win.reader?.itemID;
			}
			else if (type === "noteWindow") {
				// note.xhtml gets its item through the window's io argument
				let io = win.arguments?.[0];
				info.itemID = parseInt((io?.wrappedJSObject || io)?.itemID) || undefined;
			}
			else if (type === "pluginWindow") {
				info.pluginID = lazy.WindowUtils.getPluginWindowOwner(win);
			}
			return info;
		}

		/**
		 * Raise the window within Zotero and give it focus
		 * @param {number} windowID
		 * @param {string} [pluginID] - The calling plugin, which reaches only its own plugin windows
		 */
		_focusWindow(windowID, pluginID) {
			lazy.WindowUtils.getWindow(windowID, undefined, pluginID).focus();
		}

		/**
		 * Close a window of any type
		 * @param {number} windowID
		 * @param {string} [pluginID] - The calling plugin, which reaches only its own plugin windows
		 */
		_closeWindow(windowID, pluginID) {
			lazy.WindowUtils.getWindow(windowID, undefined, pluginID).close();
		}

		/**
		 * Toggle a pane of a main window; the same paths the View menu and toolbar use
		 * @param {number} windowID
		 * @param {"start" | "end"} pane
		 * @param {boolean} [open] - The state to put the pane in; omitted, it flips
		 * @param {string} [pluginID] - The calling plugin
		 * @returns {Promise<WindowControllerCommandResults["togglePane"]>}
		 */
		async _togglePane(windowID, pane, open, pluginID) {
			let win = lazy.WindowUtils.getWindow(windowID, "mainWindow", pluginID);
			let { tabContentType } = win.Zotero_Tabs.parseTabType();
			let state = this._getPaneState(win, pane);
			if (open === state.open) {
				return state;
			}
			switch (pane) {
				case "start":
					if (tabContentType === "library") {
						let collectionsPane = win.document.getElementById("zotero-collections-pane");
						let collapsed = collectionsPane.hasAttribute("collapsed");
						win.document.getElementById("zotero-collections-splitter")
							.setAttribute("state", collapsed ? "open" : "collapsed");
						collectionsPane.toggleAttribute("collapsed", !collapsed);
						win.ZoteroPane.updateLayoutConstraints();
					}
					else {
						let nextOpen = !win.Zotero_Tabs.getSidebarState(tabContentType).open;
						win.Zotero_Tabs.updateSidebarLayout({ width: nextOpen });
						let instance = tabContentType === "reader"
							? Zotero.Reader.getByTabID(win.Zotero_Tabs.selectedID)
							: Zotero.Notes;
						instance?.toggleSidebar(nextOpen);
					}
					break;
				case "end":
					if (tabContentType === "library") {
						win.ZoteroPane.toggleItemPane();
					}
					else {
						win.ZoteroContextPane.togglePane();
					}
					break;
			}
			return this._getPaneState(win, pane);
		}

		/**
		 * Open an item, or the preferences window
		 * @param {"reader" | "note" | "preferencePane"} type
		 * @param {number} [itemID] - Required for reader and note, ignored for preferencePane
		 * @param {object} [location] - The opener's location, or { pane } for preferencePane
		 * @returns {Promise<WindowControllerCommandResults["openWindow"]>}
		 */
		async _openWindow(type, itemID, location) {
			let { INVALID_PARAMS } = lazy.ControllerAPIBase.errorCodes;
			if (type === "preferencePane") {
				return this._openPreferences(location?.pane);
			}
			if (itemID === undefined) {
				this._throw(INVALID_PARAMS, `Param 'itemID' is required for ${type}`);
			}
			lazy.WindowUtils.getOpenableItem(itemID, type);
			let opener = type === "reader" ? Zotero.Reader : Zotero.Notes;
			let { instance, win } = await opener.open(itemID, location, { openInWindow: true });
			// Resolve once the content has loaded; a new window is listed under its type only then
			await instance._initPromise;
			if (!win || win.closed) {
				throw new Error(`No window opened for item ${itemID}`);
			}
			return { windowID: lazy.WindowUtils.getWindowID(win) };
		}

		/**
		 * Open the preferences, or focus the open window, on any registered pane, which may still be loading
		 * @param {string} [pane] - A pane ID
		 * @returns {Promise<WindowControllerCommandResults["openWindow"]>}
		 */
		async _openPreferences(pane) {
			let { INVALID_PARAMS, NOT_FOUND } = lazy.ControllerAPIBase.errorCodes;
			if (pane !== undefined) {
				if (typeof pane !== "string") {
					this._throw(INVALID_PARAMS, "Param 'location.pane' must be a string");
				}
				let known = [...Zotero.PreferencePanes.builtInPanes, ...Zotero.PreferencePanes.pluginPanes]
					.some(p => p.id === pane);
				if (!known) {
					this._throw(NOT_FOUND, `No preference pane with ID ${pane}`);
				}
			}
			let win = Zotero.Utilities.Internal.openPreferences(pane);
			// A new window holds a blank document until it loads, and is listed as a preferencePane only then
			if (!win.Zotero_Preferences) {
				await new Promise(resolve => win.addEventListener("load", resolve, { once: true }));
			}
			return { windowID: lazy.WindowUtils.getWindowID(win) };
		}

		/**
		 * Open one of the calling plugin's .html pages in a chrome wrapper window
		 * @param {WindowControllerCommandParams["openPluginWindow"] & { pluginID?: string }} params
		 * @returns {Promise<PluginWindowHandle>} Wrapped for the plugin's scope
		 */
		async _openPluginWindow({ url, features, name, notitle, fitContent, parentWindowID, pluginID }) {
			// Only a sandbox caller has a plugin whose pages this can open
			if (!pluginID) {
				this._throw(lazy.ControllerAPIBase.errorCodes.NOT_ALLOWED, "Only a plugin can open its own window");
			}
			let resolved = lazy.PluginProtocol.resolvePage(pluginID, url);
			if (!resolved) {
				this._throw(lazy.ControllerAPIBase.errorCodes.INVALID_PARAMS, `Param 'url' must be an .html page within the plugin: ${url}`);
			}
			let { str: safeFeatures, values: featureValues } = lazy.sanitizeWindowFeatures(features);
			let resizable = featureValues.resizable !== false;
			// A parent window is the opener, the screen and scale the position features resolve
			// against, and the owner of a dependent window
			let parent = parentWindowID === undefined ? null : lazy.WindowUtils.getWindow(parentWindowID, undefined, pluginID);
			// The wrapper draws its own title bar when notitle is set; titlebar=no looks worse
			let win = Services.ww.openWindow(
				parent,
				"chrome://zotero/content/pluginWindow.xhtml",
				null,
				"chrome,dialog=no," + (safeFeatures || "resizable"),
				{ notitle: !!notitle }
			);
			await new Promise(resolve => win.addEventListener("load", resolve, { once: true }));
			try {
				let browser = win.document.getElementById("plugin-browser");
				win.PluginWindow.init(name, pluginID);
				let { messenger, dispose } = await lazy.loadPluginPageInBrowser(browser, resolved, {
					channel: true,
					pluginID,
					// The page actor keeps the browser at the document scroll size
					autoResize: fitContent ? { height: true, width: true, content: true } : {},
					// The page controls its own window as zoteroHost.api.<name>(params)
					hostAPI: {
						close: () => win.close(),
						moveTo: ({ x, y }) => win.moveTo(x, y),
						getState: () => lazy.WindowUtils.getWindowState(win),
					},
				});
				if (!messenger) {
					this._throw(lazy.ControllerAPIBase.errorCodes.NOT_FOUND, `Failed to load ${url}`);
				}
				win.addEventListener("unload", dispose, { once: true });
				browser.addEventListener("contextmenu", (event) => {
					if (event.target?.closest?.("input, textarea, [contenteditable]")) {
						return;
					}
					event.preventDefault();
				});
				browser.focus();
				if (fitContent) {
					this._fitPluginWindow(win, browser, resizable);
				}
				return lazy.ScopeVariables.toScope({
					page: messenger,
					windowID: lazy.WindowUtils.getWindowID(win),
				}, pluginID);
			}
			// The wrapper is already open; drop it and let the failure reach the caller's response
			catch (e) {
				if (win && !Cu.isDeadWrapper(win)) {
					win.close();
				}
				throw e;
			}
		}

		/**
		 * Size the wrapper to the page once the actor applies the first content size; a resizable
		 * window is then left to the user, a fixed one keeps following the content
		 * @param {Window} win
		 * @param {XULElement} browser
		 * @param {boolean} resizable
		 */
		_fitPluginWindow(win, browser, resizable) {
			let mo = new win.MutationObserver(() => {
				mo.disconnect();
				browser.removeAttribute("flex");
				win.sizeToContent();
				if (resizable) {
					lazy.stopAutoResize(browser);
				}
				else {
					let ro = new win.ResizeObserver(Zotero.Utilities.debounce(() => win.sizeToContent(), 100));
					ro.observe(browser);
					win.addEventListener("unload", () => ro.disconnect(), { once: true });
				}
			});
			mo.observe(browser, { attributes: true, attributeFilter: ["style"] });
			win.addEventListener("unload", () => mo.disconnect(), { once: true });
		}

		/**
		 * @param {Window} win - A main window
		 * @returns {LayoutState}
		 */
		_getLayoutState(win) {
			let panes = {};
			for (let pane of MAINWINDOW_PANES) {
				panes[pane] = this._getPaneState(win, pane);
			}
			return { panes };
		}

		/**
		 * The state of one pane of the selected tab
		 * @param {Window} win - A main window
		 * @param {"start" | "end"} pane
		 * @returns {{ open: boolean }}
		 */
		_getPaneState(win, pane) {
			let { tabContentType } = win.Zotero_Tabs.parseTabType();
			let state = {};
			switch (pane) {
				case "start":
				{
					state.open = tabContentType === "library"
						? !win.document.getElementById("zotero-collections-pane").hasAttribute("collapsed")
						: win.Zotero_Tabs.getSidebarState(tabContentType).open;
					break;
				}
				case "end":
				{
					state.open = tabContentType === "library"
						? !win.ZoteroPane.itemPane.collapsed
						: !win.ZoteroContextPane.collapsed;
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
		windowTypes: Object.freeze(Object.keys(lazy.WindowUtils.WINDOW_TYPES)),

		errorCodes: lazy.ControllerAPIBase.errorCodes,

		_windowController: new WindowControllerInternal(),

		/**
		 * Read window state
		 * @template {keyof WindowControllerQueryParams} N
		 * @param {N} name
		 * @param {WindowControllerQueryParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<ControllerResponse<WindowControllerQueryResults[N]>>}
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
		 * @returns {Promise<ControllerResponse<WindowControllerCommandResults[N]>>}
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
