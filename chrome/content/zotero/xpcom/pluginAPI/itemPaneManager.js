/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://digitalscholar.org

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
		ManagerAPIBase: "chrome://zotero/content/xpcom/pluginAPI/managerAPIBase.mjs",
		PluginSandbox: "chrome://zotero/content/xpcom/plugins/sandbox.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
		PluginProtocol: "chrome://zotero/content/xpcom/plugins/protocol.mjs",
	});


	/**
	 * @namespace Zotero
	 */


	/**
	 * @typedef {Object} SectionIcon
	 * @property {string} icon - Icon URI.
	 * @property {string} [darkIcon] - Icon URI in dark mode. If not set, use `icon`.
	 */

	/**
	 * @typedef {Object} SectionL10n
	 * @property {string} l10nID - data-l10n-id for localization of section header label.
	 * @property {string} [l10nArgs] - data-l10n-args for localization.
	 */

	/**
	 * @typedef {Object} SectionButton
	 * @property {string} type - Button type, must be valid DOMString and without ",".
	 * @property {string} icon - Icon URI.
	 * @property {string} [darkIcon] - Icon URI in dark mode. If not set, use `icon`.
	 * @property {string} [l10nID] - data-l10n-id for localization of button tooltiptext.
	 * @property {SectionButtonHook} onClick - Button click callback.
	 */

	/**
	 * @typedef {Object} SectionBasicHookArgs
	 * @property {string} paneID - Registered pane id.
	 * @property {object} page - Messenger to the section's embedded page; see `PluginPageChannel` (plugins/pageChannel.mjs).
	 */

	/**
	 * What every hook on a rendered section gets, on top of SectionBasicHookArgs
	 * @typedef {Object} SectionUIHookArgs
	 * @property {number} [itemID] - Current item's ID.
	 * @property {Zotero.Item} [item] - @deprecated Privileged plugins only; use `itemID` instead.
	 * @property {string} tabType - Current tab type.
	 * @property {boolean} editable - Whether the section is in edit mode.
	 * @property {SetSectionL10nArgs} setL10nArgs - Set l10n args for section header.
	 * @property {SetEnabled} setEnabled - Set pane enabled state.
	 * @property {SetFullHeight} setFullHeight - Set whether the section fills the full available height of the item pane.
	 * @property {SetSectionSummary} setSectionSummary - Set pane section summary, shown in collapsed header.
	 * @property {SetSectionButtonStatus} setSectionButtonStatus - Set pane section button status.
	 */

	/**
	 * @typedef {SectionBasicHookArgs & SectionUIHookArgs} SectionAsyncHookArgs
	 */

	/**
	 * `getItem` rides along because the pane reads these hooks back before it returns
	 * @typedef {SectionAsyncHookArgs & { getItem?: SyncItemGetter }} SectionHookArgs
	 */

	/**
	 * `refresh` has no effect during initialization
	 * @typedef {SectionAsyncHookArgs & { refresh: SectionRefresh }} SectionInitHookArgs
	 */

	/**
	 * `event` is @deprecated: privileged plugins only, use `open`
	 * @typedef {SectionAsyncHookArgs & { open: boolean, event?: Event }} SectionToggleHookArgs
	 */

	/**
	 * `event` is @deprecated: privileged plugins only, use `buttonType`
	 * @typedef {SectionAsyncHookArgs & { buttonType: string, event?: Event }} SectionButtonHookArgs
	 */

	/**
	 * @callback SectionInitHook
	 * @param {SectionInitHookArgs} props - Props provided during section initialization.
	 * @returns {void}
	 */

	/**
	 * @callback SectionBasicHook
	 * @param {SectionBasicHookArgs} props - Basic hook arguments.
	 */

	/**
	 * @callback SectionItemChangeHook
	 * @param {SectionHookArgs} props - Hook arguments for item changes.
	 * @returns {boolean}
	 */

	/**
	 * @callback SectionRenderHook
	 * @param {SectionHookArgs} props - Hook arguments for rendering.
	 * @returns {void}
	 */

	/**
	 * @callback SectionAsyncRenderHook
	 * @param {SectionAsyncHookArgs} props - Hook arguments for asynchronous rendering.
	 * @returns {void | Promise<void>}
	 */

	/**
	 * @callback SectionToggleHook
	 * @param {SectionToggleHookArgs} props - Toggle hook arguments.
	 * @returns {void}
	 */

	/**
	 * @callback SectionButtonHook
	 * @param {SectionButtonHookArgs} props - Button hook arguments.
	 * @returns {void}
	 */

	/**
	 * @callback SetSectionL10nArgs
	 * @param {string} l10nArgs - Localization arguments.
	 * @returns {void}
	 */

	/**
	 * @callback SetEnabled
	 * @param {boolean} enabled - Enabled state.
	 * @returns {void}
	 */

	/**
	 * @callback SetFullHeight
	 * @param {boolean} fullHeight - Whether the section should fill the full available height of the item pane.
	 * @returns {void}
	 */

	/**
	 * @callback SetSectionSummary
	 * @param {string} summary - The summary for the section header.
	 * @returns {void}
	 */

	/**
	 * @callback SetSectionButtonStatus
	 * @param {string} buttonType - The button type.
	 * @param {Object} options - Options for the button status.
	 * @param {boolean} [options.disabled] - Whether the button is disabled.
	 * @param {boolean} [options.hidden] - Whether the button is hidden.
	 * @returns {void}
	 */

	/**
	 * @callback SectionRefresh
	 * @returns {Promise<void>}
	 */


	class ItemPaneSectionManagerInternal extends lazy.ManagerAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "ItemPaneSectionAPI",
				mainKeyName: "paneID",
				notifyType: "itempane",
				optionTypeDefinition: {
					paneID: "string",
					pluginID: "string",
					bodyXHTML: {
						type: "string",
						optional: true,
					},
					src: {
						type: "string",
						optional: true,
					},
					onInit: {
						type: "function",
						optional: true,
					},
					onDestroy: {
						type: "function",
						optional: true,
					},
					onItemChange: {
						type: "function",
						optional: true,
					},
					onRender: "function",
					onAsyncRender: {
						type: "function",
						optional: true,
					},
					onToggle: {
						type: "function",
						optional: true,
					},
					header: {
						type: "object",
						children: {
							l10nID: "string",
							l10nArgs: {
								type: "string",
								optional: true,
							},
							icon: "string",
							darkIcon: {
								type: "string",
								optional: true,
							},
						}
					},
					sidenav: {
						type: "object",
						children: {
							l10nID: "string",
							l10nArgs: {
								type: "string",
								optional: true,
							},
							icon: "string",
							darkIcon: {
								type: "string",
								optional: true,
							},
							orderable: {
								type: "boolean",
								optional: true,
							},
						}
					},
					sectionButtons: {
						type: "array",
						optional: true,
						children: {
							type: "string",
							icon: "string",
							darkIcon: {
								type: "string",
								optional: true,
							},
							l10nID: {
								type: "string",
								optional: true,
							},
							onClick: "function",
						}
					},
				},
			};
		}

		_hookNames = ['onInit', 'onDestroy', 'onItemChange', 'onRender', 'onAsyncRender', 'onToggle'];

		// The pane reads these back before it returns, so they cannot await a query
		_syncHookNames = ['onItemChange', 'onRender'];

		// Sync hooks also get `getItem`; privileged plugins keep the deprecated live `item` and `event`
		_wrapHook(hook, pluginID, { sync = false } = {}) {
			let wrapped = lazy.ScopeVariables.fromScope(hook, pluginID);
			let scope = lazy.PluginSandbox.getScope(pluginID);
			let privileged = lazy.PluginSandbox.isPrivileged(pluginID);
			// hasPermissions() is false without a scope, so privileged is checked separately
			let canReadData = privileged || lazy.VarCheck.hasPermissions(scope, "dataRead");
			return (props) => {
				if (props) {
					let { event, item, ...rest } = props;
					if (sync && "itemID" in props) {
						rest.getItem = canReadData
							? Zotero.DataStore.itemGetter(props.itemID, pluginID)
							: () => null;
					}
					if (privileged) {
						if ("item" in props) rest.item = item;
						if ("event" in props) rest.event = event;
					}
					props = rest;
				}
				try {
					return wrapped(props);
				}
				finally {
					props?.getItem?.expire?.();
				}
			};
		}

		_convert(option) {
			option = super._convert(option);

			for (let hookName of this._hookNames) {
				if (option[hookName]) {
					option[hookName] = this._wrapHook(option[hookName], option.pluginID,
						{ sync: this._syncHookNames.includes(hookName) });
				}
			}

			if (option.sectionButtons) {
				option.sectionButtons = option.sectionButtons.map((button) => {
					if (button.onClick) {
						return {
							...button,
							onClick: this._wrapHook(button.onClick, option.pluginID)
						};
					}
					return button;
				});
			}

			return option;
		}

		_validate(option) {
			// Keep in sync with itemDetails.js
			let builtInPaneIDs = [
				"info",
				"abstract",
				"attachments",
				"notes",
				"attachment-info",
				"attachment-annotations",
				"libraries-collections",
				"tags",
				"related"
			];

			let mainKey = this._namespacedMainKey(option);
			if (builtInPaneIDs.includes(mainKey)) {
				this._log(`'paneID' must not conflict with built-in paneID, got ${mainKey}`, "warn");
				return false;
			}

			// Unprivileged plugins can't insert markup into the pane document, so
			// their section body must be a page in an embedded content browser.
			if (!lazy.PluginSandbox.isPrivileged(option.pluginID)) {
				if (option.bodyXHTML) {
					this._log("'bodyXHTML' only available for privileged plugins. Provide a page at 'src' instead", "warn");
					delete option.bodyXHTML;
				}
				if (!option.src) {
					this._log("'src' must be provided", "warn");
					return false;
				}
			}
			if (option.src) {
				let src = lazy.PluginProtocol.resolvePage(option.pluginID, option.src);
				if (!src) {
					this._log(`'src' must be an .html page within the plugin, got ${option.src}`, "warn");
					return false;
				}
				option.src = src;
			}

			return super._validate(option);
		}
	}


	/**
	 * @typedef {Object} InfoRowL10n
	 * @property {string} l10nID - data-l10n-id for localization of row label.
	 */

	/**
	 * @typedef {"start" | "afterCreators" | "end"} InfoRowPosition - Position of the row.
	 */

	/**
	 * What every info row hook gets
	 * @typedef {Object} InfoRowHookArgs
	 * @property {string} rowID - Row ID.
	 * @property {number} [itemID] - Current item's ID.
	 * @property {Zotero.Item} [item] - @deprecated Privileged plugins only; use `itemID` instead.
	 * @property {string} tabType - Current tab type.
	 * @property {boolean} editable - Whether the row is in edit mode.
	 */

	/**
	 * `getItem` rides along because the pane reads these hooks back before it renders
	 * @typedef {InfoRowHookArgs & { getItem?: SyncItemGetter }} InfoRowSyncHookArgs
	 */

	/**
	 * @typedef {InfoRowSyncHookArgs} InfoRowGetDataHookArgs
	 */

	/**
	 * @typedef {InfoRowHookArgs & { value: string }} InfoRowSetDataHookArgs
	 */

	/**
	 * @typedef {InfoRowSyncHookArgs & { setEnabled: SetInfoRowEnabled, setEditable: SetInfoRowEditable }} InfoRowItemChangeHookArgs
	 */

	/**
	 * @typedef {function} InfoRowGetDataHook
	 * @param {InfoRowGetDataHookArgs} props - Hook arguments for getting data.
	 * @returns {string} - Row data. For a value `getItem` cannot answer, return a cached one, start the
	 * 		async work, and call `Zotero.ItemPaneManager.refreshInfoRow(rowID)` when it resolves
	 */

	/**
	 * @typedef {function} InfoRowSetDataHook
	 * @param {InfoRowSetDataHookArgs} props - Hook arguments for setting data.
	 * @returns {void}
	 */

	/**
	 * @typedef {function} InfoRowItemChangeHook
	 * @param {InfoRowItemChangeHookArgs} props - Hook arguments for item changes.
	 * @returns {void}
	 */

	/**
	 * @typedef {function} SetInfoRowEnabled
	 * @param {boolean} enabled - Enabled state.
	 * @returns {void}
	 */

	/**
	 * @typedef {function} SetInfoRowEditable
	 * @param {boolean} editable - Editable state.
	 * @returns {void}
	 */


	class ItemPaneInfoRowManagerInternal extends lazy.ManagerAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "ItemPaneInfoRowAPI",
				mainKeyName: "rowID",
				notifyType: "infobox",
				optionTypeDefinition: {
					rowID: "string",
					pluginID: "string",
					label: {
						type: "object",
						children: {
							l10nID: "string",
						}
					},
					position: {
						type: "string",
						optional: true,
						checkHook: (val) => {
							if (typeof val !== "undefined"
								&& !["start", "afterCreators", "end"].includes(val)) {
								return `"position" must be "start", "afterCreators", or "end", got ${val}`;
							}
							return true;
						}
					},
					multiline: {
						type: "boolean",
						optional: true,
					},
					nowrap: {
						type: "boolean",
						optional: true,
					},
					editable: {
						type: "boolean",
						optional: true,
					},
					onGetData: {
						type: "function",
						optional: false,
						fallbackReturn: "",
					},
					onSetData: {
						type: "function",
						optional: true,
					},
					onItemChange: {
						type: "function",
						optional: true,
					},
				},
			};
		}

		_convert(option) {
			option = super._convert(option);

			for (let hookName of ["onGetData", "onSetData", "onItemChange"]) {
				if (option[hookName]) {
					// onSetData only writes, so it commits a change set like any async caller
					option[hookName] = this._wrapHook(option[hookName], option.pluginID,
						{ sync: hookName !== "onSetData" });
				}
			}

			return option;
		}

		// Sync hooks also get `getItem`, since the row answers before it renders; privileged plugins keep `item`
		_wrapHook(hook, pluginID, { sync = false } = {}) {
			let wrapped = lazy.ScopeVariables.fromScope(hook, pluginID);
			let scope = lazy.PluginSandbox.getScope(pluginID);
			let privileged = lazy.PluginSandbox.isPrivileged(pluginID);
			// hasPermissions() is false without a scope, so privileged is checked separately
			let canReadData = privileged || lazy.VarCheck.hasPermissions(scope, "dataRead");
			return (props) => {
				if (props && "itemID" in props) {
					let { item, ...rest } = props;
					if (sync) {
						rest.getItem = canReadData
							? Zotero.DataStore.itemGetter(props.itemID, pluginID)
							: () => null;
					}
					if (privileged) {
						rest.item = item;
					}
					props = rest;
				}
				try {
					return wrapped(props);
				}
				finally {
					props?.getItem?.expire?.();
				}
			};
		}

		refresh(rowID) {
			if (!this._optionsCache[rowID]) {
				return;
			}
			this._refresh([rowID]);
		}
	}


	/**
	 * Manages item pane APIs.
	 *
	 * @memberof Zotero
	 */
	Zotero.ItemPaneManager = {
		_sectionManager: new ItemPaneSectionManagerInternal(),

		_infoRowManager: new ItemPaneInfoRowManagerInternal(),

		/**
		 * Register a custom item pane section.
		 * @param {Object} options - Section options.
		 * @param {string} options.paneID - Unique pane ID.
		 * @param {string} options.pluginID - Set plugin ID to auto-remove section when the plugin is disabled or removed.
		 * @param {SectionL10n | SectionIcon} options.header - Header options. Icon should be 16*16 and `label` need to be localized.
		 * @param {SectionL10n | SectionIcon} options.sidenav - Sidenav options.  Icon should be 20*20 and `tooltiptext` need to be localized.
		 * @param {string} [options.bodyXHTML] - Pane body's innerHTML, defaults to XUL namespace.
		 * 		@deprecated Privileged plugins only; provide a page at `src` instead.
		 * @param {string} [options.src] - URI of a full HTML page within the plugin, optionally relative
		 * 		to the plugin's root, shown in an embedded content browser as the section body.
		 * 		Required for unprivileged plugins, which can't use `bodyXHTML`; optional for
		 * 		privileged plugins, where it takes precedence over `bodyXHTML`. Lifecycle hooks
		 * 		receive the page's document as `doc`/`body` and only fire after the page loads.
		 * @param {SectionInitHook} [options.onInit] - Lifecycle hook called when section is initialized.
		 *
		 * Do:
		 * 1. Initialize data if necessary
		 * 2. Set up hooks, e.g. notifier callback
		 *
		 * Don't:
		 * 1. Render/refresh UI
		 * @param {SectionBasicHook} [options.onDestroy] - Lifecycle hook called when section is destroyed.
		 *
		 * Do:
		 * 1. Remove data and release resource
		 * 2. Remove hooks, e.g. notifier callback
		 *
		 * Don't:
		 * 1. Render/refresh UI
		 * @param {SectionItemChangeHook} [options.onItemChange] - Lifecycle hook called when the section's target item is changed.
		 *
		 * Do:
		 * 1. Update data (no need to render or refresh);
		 * 2. Update the section enabled state with `props.setEnabled`.
		 *
		 * Don't:
		 * 1. Render/refresh UI
		 * @param {SectionRenderHook} options.onRender - Lifecycle hook called for initial render.
		 *
		 * Cannot be async.
		 *
		 * Create elements and append them to `props.body`.
		 *
		 * If the rendering is slow, you should make the bottleneck async and move it to `onAsyncRender`.
		 * @param {SectionAsyncRenderHook} [options.onAsyncRender] - Lifecycle hook for asynchronous rendering.
		 *
		 * The best practice to time-consuming rendering with runtime decided section height is:
		 * 1. Compute height and create a box in sync `onRender`;
		 * 2. Render actual contents in async `onAsyncRender`.
		 * @param {SectionToggleHook} [options.onToggle] - Called when section is toggled.
		 * @param {SectionButton[]} [options.sectionButtons] - Section button options.
		 * @returns {string | false} - The registered pane ID or false if failed.
		 *
		 * @example
		 * ```javascript
		 * Zotero.ItemPaneManager.registerSection({
		 * 	paneID: 'my-plugin-pane',
		 * 	pluginID: 'my-plugin@my-namespace.com',
		 * 	header: {
		 * 		l10nID: 'my-plugin-pane-header', // Must inject the corresponding `ftl` file
		 * 		icon: 'chrome://my-plugin/content/icon16.svg',
		 * 	},
		 * 	sidenav: {
		 * 		l10nID: 'my-plugin-pane-sidenav', // Must inject the corresponding `ftl` file
		 * 		icon: 'chrome://my-plugin/content/icon20.svg',
		 * 	},
		 * 	onInit: ({paneID, doc, body}) => {
		 * 		// Initialize data
		 * 		Zotero.debug('Section initialized');
		 * 	},
		 * 	onDestroy: ({paneID, doc, body}) => {
		 * 		// Release resource
		 * 		Zotero.debug('Section destroyed');
		 * 	},
		 * 	onItemChange: ({paneID, doc, body, item, tabType, editable, setEnabled}) => {
		 * 		// In this example, the section is enabled only for regular items
		 * 		setEnabled(item.isRegularItem());
		 * 	},
		 * 	onRender: ({doc, body, item}) => {
		 * 		// Create elements and append them to `body`
		 * 		const div = doc.createElement('div');
		 * 		div.classList.add('my-plugin-section');
		 * 		div.textContent = item.getField('title');
		 * 		body.appendChild(div);
		 * 	},
		 * 	onAsyncRender: async ({body}) => {
		 * 		// Put time-consuming rendering here
		 * 		await new Promise(resolve => setTimeout(resolve, 1000));
		 * 		body.querySelector('.my-plugin-section')?.style.setProperty('color', 'red');
		 * 	},
		 * 	onToggle: ({paneID, doc, body, item, tabType, editable, setEnabled}) => {
		 * 		// Handle section toggle
		 * 		Zotero.debug('Section toggled');
		 * 	},
		 * 	sectionButtons: [
		 * 		// Section button will appear in the header
		 * 	],
		 * });
		 * ```
		 */
		registerSection(options) {
			return this._sectionManager.register(options);
		},

		/**
		 * Unregister a custom item pane section.
		 * @param {string} paneID - Pane ID to unregister. This is the value returned by `registerSection`.
		 * @returns {boolean} - True if the section is successfully unregistered, false if the paneID is not found.
		 */
		unregisterSection(paneID, _callerPluginID) {
			return this._sectionManager.unregister(paneID, _callerPluginID);
		},

		get customSectionData() {
			return this._sectionManager.data;
		},

		isSectionOrderable(paneID) {
			let option = this._sectionManager._optionsCache[paneID];
			if (!option) {
				return false;
			}
			return option.sidenav.orderable ?? true;
		},

		/**
		 * Register a custom item pane info section row.
		 * @param {Object} options - Row options.
		 * @param {string} options.rowID - Unique row ID.
		 * @param {string} options.pluginID - Set plugin ID to auto-remove row when the plugin is disabled or removed.
		 * @param {InfoRowL10n} options.label - Label options. `label` need to be localized.
		 * @param {InfoRowPosition} [options.position] - Position of the row.
		 * @param {boolean} [options.multiline] - Whether the row is multiline.
		 * @param {boolean} [options.nowrap] - Whether the row is nowrap.
		 * @param {boolean} [options.editable] - Whether the row is editable.
		 * @param {InfoRowGetDataHook} options.onGetData - Lifecycle hook for getting row data for rendering.
		 *
		 * This is called when the row is rendered or refreshed.
		 * @param {InfoRowSetDataHook} [options.onSetData] - Lifecycle hook for saving row data changes after editing.
		 *
		 * Do:
		 * 1. Save the new value of the row
		 *
		 * Don't:
		 * 1. Render/refresh UI
		 * 2. Change the value in this hook
		 * @param {InfoRowItemChangeHook} [options.onItemChange] - Lifecycle hook for target item changes.
		 *
		 * Do:
		 * 1. Update the row attribute, e.g. enabled, editable
		 *
		 * Don't:
		 * 1. Render/refresh UI
		 * @returns {string | false} - The registered row ID or false if failed.
		 *
		 * @example
		 * ```javascript
		 * Zotero.ItemPaneManager.registerInfoRow({
		 * 	rowID: 'my-plugin-row',
		 * 	pluginID: 'my-plugin@my-namespace.com',
		 * 	label: {
		 * 		l10nID: 'my-plugin-row-label', // Must inject the corresponding `ftl` file
		 * 	},
		 * 	position: 'afterCreators',
		 * 	multiline: true,
		 * 	nowrap: false,
		 * 	editable: true,
		 * 	onGetData: ({rowID, item, tabType, editable}) => {
		 * 		return item.getField('title').toUpperCase();
		 * 	},
		 * 	onSetData: ({rowID, item, tabType, editable, value}) => {
		 * 		Zotero.debug('Info row data changed:', value);
		 * 	},
		 * 	onItemChange: ({rowID, item, tabType, editable, setEnabled, setEditable}) => {
		 * 		// In this example, the row is enabled only for library tab
		 * 		setEnabled(tabType === 'library');
		 * 	},
		 * });
		 * ```
		 */
		registerInfoRow(options) {
			return this._infoRowManager.register(options);
		},

		/**
		 * Unregister a custom item pane info section row.
		 * @param {string} rowID - Row ID to unregister. This is the value returned by `registerInfoRow`.
		 * @returns {boolean} - True if the row is successfully unregistered, false if the rowID is not found.
		 */
		unregisterInfoRow(rowID, _callerPluginID) {
			return this._infoRowManager.unregister(rowID, _callerPluginID);
		},

		/**
		 * Refresh a custom item pane info section row, re-running its hooks. A row shows a value
		 * `onGetData` can't compute synchronously by caching the async result and then refreshing
		 * @param {string} rowID - Row ID to refresh. This is the value returned by `registerInfoRow`.
		 * @returns {void}
		 */
		refreshInfoRow(rowID) {
			return this._infoRowManager.refresh(rowID);
		},

		get customInfoRowData() {
			return this._infoRowManager.data;
		},

		getInfoRowHook(rowID, type) {
			let option = this._infoRowManager._optionsCache[rowID];
			if (!option) {
				return undefined;
			}
			return option[type];
		},
	};

	let injectRegister = ({ pluginID, args }) => {
		lazy.ScopeVariables.assignTrustedArg(args, 0, "pluginID", pluginID);
	};
	let injectUnregister = ({ pluginID, args }) => {
		args[1] = pluginID;
	};
	lazy.ScopeVariables.setCustomParser(Zotero.ItemPaneManager.registerSection, injectRegister);
	lazy.ScopeVariables.setCustomParser(Zotero.ItemPaneManager.unregisterSection, injectUnregister);
	lazy.ScopeVariables.setCustomParser(Zotero.ItemPaneManager.registerInfoRow, injectRegister);
	lazy.ScopeVariables.setCustomParser(Zotero.ItemPaneManager.unregisterInfoRow, injectUnregister);
}
