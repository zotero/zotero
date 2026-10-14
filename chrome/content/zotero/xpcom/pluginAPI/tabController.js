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
		WindowUtils: "chrome://zotero/content/xpcom/plugins/window.mjs",
	});

	const LIBRARY_TAB_ID = "zotero-pane";

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
	 * @property {{ windowID: number, tabID: string, index: number }} moveTab
	 * @property {{ windowID: number, itemIDs: number[], inLibraryRoot?: boolean, noTabSwitch?: boolean }} selectItems
	 * @property {{ windowID: number, type: CollectionTreeRowType, ids: number[] }} selectCollectionsOrLibraries
	 * @property {{ windowID: number, type: "reader" | "note", itemID: number, index?: number, background?: boolean, allowDuplicate?: boolean, location?: object }} openTab
	 *
	 *
	 * @typedef {object} TabControllerCommandResults
	 * @property {{}} selectTab
	 * @property {{}} closeTabs
	 * @property {{}} moveTab
	 * @property {{ selected: boolean }} selectItems
	 * @property {{ selected: boolean }} selectCollectionsOrLibraries
	 * @property {{ tabID: string }} openTab
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
						},
						handler: ({ windowID, tabID, index }) => this._moveTab(lazy.WindowUtils.getMainWindow(windowID), tabID, index),
					},
					selectItems: {
						params: {
							windowID: "number",
							itemIDs: { type: "array", children: "number" },
							inLibraryRoot: { type: "boolean", optional: true },
							noTabSwitch: { type: "boolean", optional: true },
						},
						handler: ({ windowID, itemIDs, inLibraryRoot, noTabSwitch }) => this._selectItems(
							lazy.WindowUtils.getMainWindow(windowID), itemIDs, { inLibraryRoot, noTabSwitch }
						),
					},
					selectCollectionsOrLibraries: {
						params: {
							windowID: "number",
							type: {
								type: "string",
								checkHook: value => ROW_TYPES.includes(value)
									|| `Param 'type' must be one of ${ROW_TYPES.join(", ")}, got ${value}`,
							},
							ids: {
								type: "array",
								children: "number",
								checkHook: value => value.length > 0 || "Param 'ids' must not be empty",
							},
						},
						handler: ({ windowID, type, ids }) => this._selectCollectionsOrLibraries(
							lazy.WindowUtils.getMainWindow(windowID), type, ids
						),
					},
					openTab: {
						params: {
							windowID: "number",
							type: {
								type: "string",
								checkHook: value => lazy.WindowUtils.OPENABLE_TYPES.includes(value)
									|| `Param 'type' must be one of ${lazy.WindowUtils.OPENABLE_TYPES.join(", ")}, got ${value}`,
							},
							itemID: "number",
							index: { type: "number", optional: true },
							background: { type: "boolean", optional: true },
							allowDuplicate: { type: "boolean", optional: true },
							location: { type: "object", optional: true },
						},
						handler: ({ windowID, type, itemID, index, background, allowDuplicate, location }) => this._openTab(
							lazy.WindowUtils.getMainWindow(windowID), type, itemID, { index, background, allowDuplicate, location }
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
			};
			if (tab.type === "library") {
				let pane = win.ZoteroPane;
				info.libraryIDs = pane.getSelectedLibraryIDs();
				info.collectionIDs = pane.collectionsView ? pane.getSelectedCollections(true) : [];
				info.itemIDs = pane.getSelectedItems(true, { libraryTabOnly: true });
			}
			else {
				info.itemIDs = tab.data?.itemID ? [tab.data.itemID] : [];
				if (tab.subType) {
					info.subType = tab.subType;
				}
			}
			return info;
		}

		_selectTab(win, tabID) {
			this._getTab(win, tabID);
			win.Zotero_Tabs.select(tabID);
		}

		_closeTabs(win, tabIDs) {
			if (tabIDs.includes(LIBRARY_TAB_ID)) {
				this._throw(lazy.ControllerAPIBase.errorCodes.NOT_ALLOWED, "The library tab cannot be closed");
			}
			for (let tabID of tabIDs) {
				this._getTab(win, tabID);
			}
			win.Zotero_Tabs.close(tabIDs);
		}

		/**
		 * @param {number} index - Position in the current tab order; the library tab stays at 0
		 */
		_moveTab(win, tabID, index) {
			if (!Number.isInteger(index) || index < 1) {
				this._throw(lazy.ControllerAPIBase.errorCodes.INVALID_PARAMS, `Param 'index' must be an integer >= 1, got ${index}`);
			}
			// TODO: update once we have multiple library tabs
			if (tabID === LIBRARY_TAB_ID) {
				this._throw(lazy.ControllerAPIBase.errorCodes.NOT_ALLOWED, "The library tab cannot be moved");
			}
			this._getTab(win, tabID);
			win.Zotero_Tabs.move(tabID, index);
		}

		/**
		 * Open an item in a new tab; without allowDuplicate an existing tab is selected instead
		 * @param {Window} win - A main window
		 * @param {"reader" | "note"} type
		 * @param {number} itemID
		 * @param {{ index?: number, background?: boolean, allowDuplicate?: boolean, location?: object }} options
		 * @returns {Promise<TabControllerCommandResults["openTab"]>}
		 */
		async _openTab(win, type, itemID, { index, background, allowDuplicate, location }) {
			if (index !== undefined && (!Number.isInteger(index) || index < 1)) {
				this._throw(lazy.ControllerAPIBase.errorCodes.INVALID_PARAMS, `Param 'index' must be an integer >= 1, got ${index}`);
			}
			lazy.WindowUtils.getOpenableItem(itemID, type);
			let opener = type === "reader" ? Zotero.Reader : Zotero.Notes;
			let { instance, tabID } = await opener.open(itemID, location, {
				tabIndex: index,
				openInBackground: background,
				allowDuplicate,
				mainWindow: win,
			});
			if (!background) {
				// Resolve once the content has loaded; a background tab stays unloaded
				await instance?._initPromise;
			}
			return { tabID };
		}

		/**
		 * Select items in the library tab, switching to it unless told not to
		 * @param {Window} win - A main window
		 * @param {number[]} itemIDs
		 * @param {{ inLibraryRoot?: boolean, noTabSwitch?: boolean }} options
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
			await win.ZoteroPane.selectItems(itemIDs, options);
			let selectedIDs = new Set(win.ZoteroPane.getSelectedItems(true, { libraryTabOnly: true }));
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
		 * @returns {Promise<TabControllerCommandResults["selectCollectionsOrLibraries"]>}
		 */
		async _selectCollectionsOrLibraries(win, type, ids) {
			let objectType = type === "collection" || type === "search" ? type : "library";
			let objects = { collection: Zotero.Collections, search: Zotero.Searches, library: Zotero.Libraries };
			for (let id of ids) {
				if (!objects[objectType].get(id)) {
					this._throw(lazy.ControllerAPIBase.errorCodes.NOT_FOUND, `No ${objectType} with ID ${id}`);
				}
			}
			let view = win.ZoteroPane.collectionsView;
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

		libraryTabID: LIBRARY_TAB_ID,

		errorCodes: lazy.ControllerAPIBase.errorCodes,

		_tabController: new TabControllerInternal(),

		/**
		 * Read tab state, including the library tab's selection
		 * @template {keyof TabControllerQueryParams} N
		 * @param {N} name
		 * @param {TabControllerQueryParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<ControllerResponse<TabControllerQueryResults[N]>>}
		 */
		query(name, params, _callerPluginID) {
			return Zotero.TabController._tabController.query(name, params, _callerPluginID);
		},

		/**
		 * Change tab or library-tab state
		 * @template {keyof TabControllerCommandParams} N
		 * @param {N} name
		 * @param {TabControllerCommandParams[N]} [params]
		 * @param {string} [_callerPluginID]
		 * @returns {Promise<ControllerResponse<TabControllerCommandResults[N]>>}
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
