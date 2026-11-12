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
		Params: "chrome://zotero/content/xpcom/pluginAPI/apiParams.mjs",
	});

	const TAB_TYPES = ["library", "reader", "note"];

	// Row type -> CollectionTreeRow.id prefix; the number is the collection or search ID for
	// those types and the library ID otherwise. Group and feed libraries are "library" rows
	const ROW_TYPE_PREFIXES = Object.freeze({
		library: "L",
		collection: "C",
		search: "S",
		duplicates: "D",
		unfiled: "U",
		trash: "T",
	});
	const ROW_TYPES = Object.freeze(Object.keys(ROW_TYPE_PREFIXES));

	/**
	 * @typedef {"library" | "collection" | "search" | "duplicates" | "unfiled" | "trash"} CollectionTreeRowType
	 */

	/**
	 * @typedef {object} TabInfo
	 * @property {string} tabID
	 * @property {number} windowID
	 * @property {number} index
	 * @property {"library" | "reader" | "note"} type
	 * @property {"loaded" | "unloaded" | "loading"} state
	 * @property {"pdf" | "epub" | "snapshot"} [subType] - Reader tabs only
	 * @property {string} title
	 * @property {boolean} selected
	 * @property {boolean} pinned - Pinned tabs come first, stay in their window, and can't be closed
	 * @property {number[]} itemIDs - The library tab's selected items, or the item a reader or note tab shows
	 * @property {number[]} [libraryIDs] - Library tab only: the selected libraries
	 * @property {number[]} [collectionIDs] - Library tab only: the selected collections
	 */

	// The request catalog as types for callers; keep in sync with the constructor's definitions
	/**
	 * @typedef {object} TabControllerQueryParams
	 * @property {{ windowID: number }} tabs
	 *
	 *
	 * @typedef {object} TabControllerQueryResults
	 * @property {{ windowID: number, selectedTabID: string, tabs: TabInfo[] }} tabs
	 *
	 *
	 * @typedef {object} TabControllerCommandParams
	 * @property {{ windowID: number, tabID: string }} selectTab
	 * @property {{ windowID: number, tabIDs: string[] }} closeTabs
	 * @property {{ windowID: number, tabID: string, index: number, targetWindowID?: number }} moveTab
	 * @property {{ windowID: number, tabID: string, pinned: boolean }} setTabPinned
	 * @property {{ windowID: number, tabID?: string, itemIDs: number[], inLibraryRoot?: boolean, noTabSwitch?: boolean }} selectItems
	 * @property {{ windowID: number, tabID?: string, type: CollectionTreeRowType, ids: number[] }} selectCollectionsOrLibraries
	 * @property {{ windowID?: number, type?: "library" | "reader" | "note", itemID?: number, state?: object, index?: number, background?: boolean, allowDuplicate?: boolean, location?: object }} openTab
	 *
	 *
	 * @typedef {object} TabControllerCommandResults
	 * @property {{}} selectTab
	 * @property {{}} closeTabs
	 * @property {{ windowID: number, tabID: string }} moveTab
	 * @property {{ index: number }} setTabPinned
	 * @property {{ selected: boolean }} selectItems
	 * @property {{ selected: boolean }} selectCollectionsOrLibraries
	 * @property {{ windowID: number, tabID: string }} openTab
	 */

	class TabControllerInternal extends lazy.ControllerAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "TabController",
				queries: {
					tabs: {
						params: { windowID: "number" },
						handler: ({ windowID }) => this._queryTabs(lazy.WindowUtils.getMainWindow(windowID)),
					},
				},
				commands: {
					selectTab: {
						params: {
							windowID: "number",
							tabID: "string",
						},
						handler: ({ windowID, tabID }) => this._selectTab(lazy.WindowUtils.getMainWindow(windowID), tabID),
					},
					closeTabs: {
						params: {
							windowID: "number",
							tabIDs: { type: "array", children: "string" },
						},
						handler: ({ windowID, tabIDs }) => this._closeTabs(lazy.WindowUtils.getMainWindow(windowID), tabIDs),
					},
					moveTab: {
						params: {
							windowID: "number",
							tabID: "string",
							index: "number",
							targetWindowID: { type: "number", optional: true },
						},
						handler: ({ windowID, tabID, index, targetWindowID }) => this._moveTab(lazy.WindowUtils.getMainWindow(windowID), tabID, index, targetWindowID),
					},
					setTabPinned: {
						params: {
							windowID: "number",
							tabID: "string",
							pinned: "boolean",
						},
						handler: ({ windowID, tabID, pinned }) => this._setTabPinned(lazy.WindowUtils.getMainWindow(windowID), tabID, pinned),
					},
					selectItems: {
						params: {
							windowID: "number",
							tabID: { type: "string", optional: true },
							itemIDs: lazy.Params.intList,
							inLibraryRoot: { type: "boolean", optional: true },
							noTabSwitch: { type: "boolean", optional: true },
						},
						handler: ({ windowID, tabID, itemIDs, inLibraryRoot, noTabSwitch }) => this._selectItems(
							lazy.WindowUtils.getMainWindow(windowID), itemIDs, { tabID, inLibraryRoot, noTabSwitch }
						),
					},
					selectCollectionsOrLibraries: {
						params: {
							windowID: "number",
							tabID: { type: "string", optional: true },
							type: lazy.Params.oneOf(ROW_TYPES),
							ids: {
								type: "array",
								checkHook: value => (value.length ? lazy.Params.intList.checkHook(value) : "Param 'ids' must not be empty"),
							},
						},
						handler: ({ windowID, tabID, type, ids }) => this._selectCollectionsOrLibraries(
							lazy.WindowUtils.getMainWindow(windowID), type, ids, tabID
						),
					},
					openTab: {
						params: {
							windowID: { type: "number", optional: true },
							type: { ...lazy.Params.oneOf(TAB_TYPES), optional: true },
							itemID: { type: "number", optional: true },
							state: { type: "object", optional: true },
							index: {
								type: "number", optional: true,
								checkHook: value => (Number.isInteger(value) && value >= 0) || "must be a nonnegative integer",
							},
							background: { type: "boolean", optional: true },
							allowDuplicate: { type: "boolean", optional: true },
							location: { type: "object", optional: true },
						},
						handler: ({ windowID, type = "library", itemID, state, index, background, allowDuplicate, location }) => this._openTab(
							windowID === undefined ? undefined : lazy.WindowUtils.getMainWindow(windowID),
							type, itemID, { state, index, background, allowDuplicate, location }
						),
					},
				},
			};
		}

		/**
		 * @param {Window} win - A main window
		 * @param {string} tabID
		 * @returns {object} The Zotero_Tabs record
		 */
		_getTab(win, tabID) {
			let { tab } = win.Zotero_Tabs._getTab(tabID);
			if (!tab) {
				this._throw(
					lazy.ControllerAPIBase.errorCodes.NOT_FOUND,
					`No tab with ID ${tabID} in window ${win.browsingContext.id}`
				);
			}
			return tab;
		}

		/**
		 * @param {Window} win - A main window
		 * @returns {TabControllerQueryResults["tabs"]}
		 */
		_queryTabs(win) {
			return {
				windowID: win.browsingContext.id,
				selectedTabID: win.Zotero_Tabs.selectedID,
				tabs: win.Zotero_Tabs._tabs.map((tab, index) => this._tabInfo(win, tab.id, index)),
			};
		}

		/**
		 * @param {Window} win - A main window
		 * @param {string} tabID
		 * @param {number} index
		 * @returns {TabInfo}
		 */
		_tabInfo(win, tabID, index) {
			let tab = win.Zotero_Tabs.getTabInfo(tabID);
			let info = {
				tabID: tab.id,
				windowID: win.browsingContext.id,
				index,
				type: tab.type,
				state: tab.state,
				title: tab.title,
				selected: tab.id === win.Zotero_Tabs.selectedID,
				pinned: !!tab.pinned,
			};
			if (tab.type === "library") {
				let view = win.ZoteroPane.getLibraryView(tabID);
				let rows = view?.loaded ? view.getCollectionTreeRows() : null;
				let saved = tab.data?.state || {};
				info.collectionIDs = rows
					? rows.filter(row => row.isCollection()).map(row => row.ref.id)
					: (saved.collections || []).filter(id => /^C\d+$/.test(id)).map(id => Number(id.slice(1)));
				info.libraryIDs = rows
					? [...new Set(rows.map(row => row.ref?.libraryID).filter(Boolean))]
					: [...new Set((saved.collections || []).map((id) => {
						let key = Number(id.slice(1));
						if (id[0] === "C") {
							return Zotero.Collections.getLibraryAndKeyFromID(key)?.libraryID;
						}
						if (id[0] === "S") {
							return Zotero.Searches.getLibraryAndKeyFromID(key)?.libraryID;
						}
						return Zotero.Libraries.get(key)?.libraryID;
					}).filter(Boolean))];
				info.itemIDs = view?.loaded
					? view.itemsView.getSelectedItems(true)
					: (saved.items || []).filter(id => Number.isInteger(id) && Zotero.Items.exists(id));
			}
			else {
				info.itemIDs = tab.data?.itemID ? [tab.data.itemID] : [];
				if (tab.subType) {
					info.subType = tab.subType;
				}
			}
			return info;
		}

		async _selectTab(win, tabID) {
			this._getTab(win, tabID);
			await win.Zotero_Tabs.select(tabID);
			await win.Zotero_Tabs.getLoadPromise(tabID);
		}

		_closeTabs(win, tabIDs) {
			for (let tabID of tabIDs) {
				let tab = this._getTab(win, tabID);
				// Pinned tabs can only be closed once unpinned, as for the user
				if (!tab.closable || tab.pinned) {
					this._throw(lazy.ControllerAPIBase.errorCodes.NOT_ALLOWED, `Tab ${tabID} ${tab.pinned ? "is pinned and " : ""}cannot be closed`);
				}
			}
			win.Zotero_Tabs.close(tabIDs);
		}

		async _moveTab(win, tabID, index, targetWindowID) {
			let tab = this._getTab(win, tabID);
			if (!tab.movable) {
				this._throw(lazy.ControllerAPIBase.errorCodes.NOT_ALLOWED, `Tab ${tabID} cannot be moved`);
			}
			let target = targetWindowID === undefined ? win : lazy.WindowUtils.getMainWindow(targetWindowID);
			if (target === win) {
				this._validateIndex(win, index, tab.pinned);
				win.Zotero_Tabs.move(tabID, index);
				return { windowID: win.browsingContext.id, tabID };
			}
			if (tab.pinned) {
				this._throw(lazy.ControllerAPIBase.errorCodes.NOT_ALLOWED, `Pinned tab ${tabID} cannot be moved to another window`);
			}
			this._validateIndex(target, index);
			let movedID = await win.Zotero_Tabs.moveToWindow(tabID, target, index);
			if (!movedID) {
				throw new Error(`Tab ${tabID} could not be moved to window ${targetWindowID}`);
			}
			return { windowID: target.browsingContext.id, tabID: movedID };
		}

		_setTabPinned(win, tabID, pinned) {
			this._getTab(win, tabID);
			win.Zotero_Tabs.setPinned(tabID, pinned);
			return { index: win.Zotero_Tabs._getTab(tabID).tabIndex };
		}

		// Pinned tabs move among the pinned tabs, and other tabs among the tabs after them
		_validateIndex(win, index, pinned = false) {
			let firstUnpinned = win.Zotero_Tabs._getFirstUnpinnedIndex();
			let valid = pinned ? index >= 0 && index <= firstUnpinned : index >= firstUnpinned;
			if (!Number.isInteger(index) || !valid) {
				let range = pinned ? `from 0 to ${firstUnpinned}` : `>= ${firstUnpinned}`;
				this._throw(lazy.ControllerAPIBase.errorCodes.INVALID_PARAMS, `Param 'index' must be an integer ${range}, got ${index}`);
			}
		}

		async _libraryView(win, tabID, libraryID) {
			if (tabID === undefined) {
				return win.ZoteroPane.openLibraryViewForLibrary(libraryID);
			}
			let tab = this._getTab(win, tabID);
			if (win.Zotero_Tabs.parseTabType(tab.type).tabContentType !== "library") {
				this._throw(lazy.ControllerAPIBase.errorCodes.INVALID_PARAMS, `Tab ${tabID} is not a library tab`);
			}
			let previousID = win.Zotero_Tabs.selectedID;
			if (!win.ZoteroPane.getLibraryView(tabID)?.loaded) {
				await win.Zotero_Tabs.select(tabID);
			}
			let view = await win.ZoteroPane.waitForLibraryView(tabID);
			// Loading a view requires selecting it, but targeting it doesn't change the selection.
			if (previousID !== win.Zotero_Tabs.selectedID && win.Zotero_Tabs._getTab(previousID).tab) {
				await win.Zotero_Tabs.select(previousID);
			}
			return view;
		}

		/**
		 * Open a tab, creating a new main window with only that tab when no window is given.
		 * In an existing window, index, background and allowDuplicate control placement and reuse.
		 * @param {Window} [win] - An existing main window; omitted, always create a new one
		 * @param {"library" | "reader" | "note"} type
		 * @param {number} [itemID] - Required for reader and note
		 * @param {{ state?: object, index?: number, background?: boolean, allowDuplicate?: boolean, location?: object }} options
		 * @returns {Promise<TabControllerCommandResults["openTab"]>}
		 */
		async _openTab(win, type, itemID, { state, index, background, allowDuplicate, location }) {
			if (type !== "library") {
				if (itemID === undefined) {
					this._throw(lazy.ControllerAPIBase.errorCodes.INVALID_PARAMS, `Param 'itemID' is required for ${type}`);
				}
				lazy.WindowUtils.getOpenableItem(itemID, type);
			}
			if (!win) {
				let args = type === "library"
					? { libraryTabState: state || {} }
					: { [`${type}TabState`]: { itemID } };
				win = Zotero.openMainWindow(args);
				await new Promise(resolve => win.addEventListener("load", resolve, { once: true }));
				await win.ZoteroPane.loadedPromise;
				let tabID = win.Zotero_Tabs.selectedID;
				await win.Zotero_Tabs.getLoadPromise(tabID);
				if (type === "reader" && location) {
					Zotero.Reader.getByTabID(tabID).navigate(location);
				}
				return { windowID: win.browsingContext.id, tabID };
			}
			if (index !== undefined) {
				this._validateIndex(win, index);
			}
			if (type === "library") {
				let tabID = win.Zotero_Tabs.addLibraryTab({ state, index, select: !background });
				if (!background) {
					await win.ZoteroPane.waitForLibraryView(tabID);
				}
				return { windowID: win.browsingContext.id, tabID };
			}
			let opener = type === "reader" ? Zotero.Reader : Zotero.Notes;
			let { instance, tabID } = await opener.open(itemID, location, {
				tabIndex: index,
				openInBackground: background,
				allowDuplicate,
				window: win,
			});
			if (!background) {
				// Resolve once the content has loaded; a background tab stays unloaded
				await instance?._initPromise;
			}
			return { windowID: win.browsingContext.id, tabID };
		}

		/**
		 * Select items in the library tab, switching to it unless told not to
		 * @param {Window} win - A main window
		 * @param {number[]} itemIDs
		 * @param {{ tabID?: string, inLibraryRoot?: boolean, noTabSwitch?: boolean }} options
		 * @returns {Promise<TabControllerCommandResults["selectItems"]>}
		 */
		async _selectItems(win, itemIDs, options) {
			for (let itemID of itemIDs) {
				if (!Zotero.Items.get(itemID)) {
					this._throw(lazy.ControllerAPIBase.errorCodes.NOT_FOUND, `No item with ID ${itemID}`);
				}
			}
			if (!itemIDs.length) {
				return { selected: false };
			}
			let { tabID, ...selectionOptions } = options;
			let view = await this._libraryView(win, tabID, Zotero.Items.get(itemIDs[0]).libraryID);
			await win.ZoteroPane.selectItems(itemIDs, { ...selectionOptions, libraryView: view });
			let selectedIDs = new Set(view.itemsView.getSelectedItems(true));
			return { selected: itemIDs.every(itemID => selectedIDs.has(itemID)) };
		}

		/**
		 * Expand the tree so the row exists, the same paths collectionsView.selectByID() takes
		 * @param {object} view - The window's collectionsView
		 * @param {CollectionTreeRowType} type
		 * @param {number} id
		 */
		async _expandToRow(view, type, id) {
			switch (type) {
				case "library":
					break;
				case "collection":
					await view.expandToCollection(id);
					break;
				case "search":
					await view.expandLibrary(Zotero.Searches.get(id).libraryID);
					break;
				default:
					// Library-scoped virtual rows: duplicates, unfiled, trash
					await view.expandLibrary(id);
			}
		}

		/**
		 * @param {Window} win - A main window
		 * @param {CollectionTreeRowType} type
		 * @param {number[]} ids - Collection or search IDs for those types, otherwise library IDs
		 * @param {string} [tabID] - Library tab to change; omitted, resolve a view for the library
		 * @returns {Promise<TabControllerCommandResults["selectCollectionsOrLibraries"]>}
		 */
		async _selectCollectionsOrLibraries(win, type, ids, tabID) {
			let objectType = type === "collection" || type === "search" ? type : "library";
			let objects = { collection: Zotero.Collections, search: Zotero.Searches, library: Zotero.Libraries };
			for (let id of ids) {
				if (!objects[objectType].get(id)) {
					this._throw(lazy.ControllerAPIBase.errorCodes.NOT_FOUND, `No ${objectType} with ID ${id}`);
				}
			}
			let first = objects[objectType].get(ids[0]);
			let libraryView = await this._libraryView(win, tabID, first.libraryID);
			let view = libraryView.collectionsView;
			// Expand everything first: each expansion shifts the indices of the rows below it
			for (let id of ids) {
				await this._expandToRow(view, type, id);
			}
			// A hidden virtual row (e.g. Duplicates turned off) has no row to select
			let indices = ids
				.map(id => view.getRowIndexByID(ROW_TYPE_PREFIXES[type] + id))
				.filter(index => index !== false);
			if (!indices.length) {
				return { selected: false };
			}
			// Build the whole selection silently, then let one selection change through; the
			// pane keeps only the focused (first) row when the rows can't be shown together
			let selection = view.selection;
			let wasSuppressed = selection.selectEventsSuppressed;
			let selectPromise = wasSuppressed ? null : view.waitForSelect();
			selection.selectEventsSuppressed = true;
			try {
				selection.select(indices[0]);
				for (let index of indices.slice(1)) {
					if (!selection.isSelected(index)) {
						selection.toggleSelect(index);
					}
				}
			}
			finally {
				selection.selectEventsSuppressed = wasSuppressed;
			}
			view.ensureRowIsVisible(indices[0]);
			await selectPromise;
			return {
				selected: indices.length === ids.length && indices.every(index => selection.isSelected(index)),
			};
		}
	}

	/**
	 * Query and command access to a main window's tabs and its library tab's selection.
	 * Requests take and return plain objects only
	 *
	 * @memberof Zotero
	 */
	Zotero.TabController = {
		tabTypes: Object.freeze(TAB_TYPES),

		errorCodes: lazy.ControllerAPIBase.errorCodes,

		_tabController: new TabControllerInternal(),

		/**
		 * Read tab state, including the library tab's selection
		 * @template {keyof TabControllerQueryParams} N
		 * @param {N} name
		 * @param {TabControllerQueryParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<APIResponse<TabControllerQueryResults[N]>>}
		 */
		query(name, params, _callerPluginID) {
			return Zotero.TabController._tabController.query(name, params, _callerPluginID);
		},

		/**
		 * Change tab or library-tab state. openTab defaults to a library tab; without windowID,
		 * it creates a new main window containing only that tab and waits for it to load.
		 * index, background and allowDuplicate apply only when windowID is provided.
		 * @template {keyof TabControllerCommandParams} N
		 * @param {N} name
		 * @param {TabControllerCommandParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<APIResponse<TabControllerCommandResults[N]>>}
		 */
		command(name, params, _callerPluginID) {
			return Zotero.TabController._tabController.command(name, params, _callerPluginID);
		},
	};

	let injectCaller = ({ pluginID, args }) => {
		args[2] = pluginID;
	};
	lazy.ScopeVariables.setCustomParser(Zotero.TabController.query, injectCaller);
	lazy.ScopeVariables.setCustomParser(Zotero.TabController.command, injectCaller);
}
