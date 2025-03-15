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
	const PluginAPIBase = ChromeUtils.importESModule("chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs").PluginAPIBase;


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
	 * @property {SectionEventHook} onClick - Button click callback.
	 */

	/**
	 * @typedef {Object} SectionBasicHookArgs
	 * @property {string} paneID - Registered pane id.
	 * @property {Document} doc - Document of section.
	 * @property {HTMLDivElement} body - Section body.
	 */

	/**
	 * @typedef {Object} SectionUIHookArgs
	 * @property {Zotero.Item} item - Current item.
	 * @property {string} tabType - Current tab type.
	 * @property {boolean} editable - Whether the section is in edit mode.
	 * @property {SetSectionL10nArgs} setL10nArgs - Set l10n args for section header.
	 * @property {SetEnabled} setEnabled - Set pane enabled state.
	 * @property {SetSectionSummary} setSectionSummary - Set pane section summary, shown in collapsed header.
	 * @property {SetSectionButtonStatus} setSectionButtonStatus - Set pane section button status.
	 */

	/**
	 * @typedef {Object} SectionHookArgs
	 * @property {string} paneID - Registered pane id.
	 * @property {Document} doc - Document of section.
	 * @property {HTMLDivElement} body - Section body.
	 * @property {Zotero.Item} item - Current item.
	 * @property {string} tabType - Current tab type.
	 * @property {boolean} editable - Whether the section is in edit mode.
	 * @property {SetSectionL10nArgs} setL10nArgs - Set l10n args for section header.
	 * @property {SetEnabled} setEnabled - Set pane enabled state.
	 * @property {SetSectionSummary} setSectionSummary - Set pane section summary, shown in collapsed header.
	 * @property {SetSectionButtonStatus} setSectionButtonStatus - Set pane section button status.
	 */

	/**
	 * @typedef {Object} SectionInitHookArgs
	 * @property {string} paneID - Registered pane id.
	 * @property {Document} doc - Document of section.
	 * @property {HTMLDivElement} body - Section body.
	 * @property {Zotero.Item} item - Current item.
	 * @property {string} tabType - Current tab type.
	 * @property {boolean} editable - Whether the section is in edit mode.
	 * @property {SetSectionL10nArgs} setL10nArgs - Set l10n args for section header.
	 * @property {SetEnabled} setEnabled - Set pane enabled state.
	 * @property {SetSectionSummary} setSectionSummary - Set pane section summary, shown in collapsed header.
	 * @property {SetSectionButtonStatus} setSectionButtonStatus - Set pane section button status.
	 * @property {SectionRefresh} refresh - Refresh the section.
	 * A `refresh` is exposed to plugins to allows plugins to refresh the section when necessary,
	 * e.g. item modify notifier callback. Note that calling `refresh` during initialization
	 * have no effect.
	 */

	/**
	 * @typedef {Object} SectionEventHookArgs
	 * @property {string} paneID - Registered pane id.
	 * @property {Document} doc - Document of section.
	 * @property {HTMLDivElement} body - Section body.
	 * @property {Zotero.Item} item - Current item.
	 * @property {string} tabType - Current tab type.
	 * @property {boolean} editable - Whether the section is in edit mode.
	 * @property {SetSectionL10nArgs} setL10nArgs - Set l10n args for section header.
	 * @property {SetEnabled} setEnabled - Set pane enabled state.
	 * @property {SetSectionSummary} setSectionSummary - Set pane section summary, shown in collapsed header.
	 * @property {SetSectionButtonStatus} setSectionButtonStatus - Set pane section button status.
	 * @property {Event} event - Event object.
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
	 * @param {SectionHookArgs} props - Hook arguments for asynchronous rendering.
	 * @returns {void | Promise<void>}
	 */

	/**
	 * @callback SectionToggleHook
	 * @param {SectionEventHookArgs} props - Event hook arguments.
	 * @returns {void}
	 */

	/**
	 * @callback SectionEventHook
	 * @param {SectionEventHookArgs} props - Event hook arguments.
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


	class ItemPaneSectionManagerInternal extends PluginAPIBase {
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
	 * @typedef {Object} InfoRowGetDataHookArgs
	 * @property {string} rowID - Row ID.
	 * @property {Zotero.Item} item - Current item.
	 * @property {string} tabType - Current tab type.
	 * @property {boolean} editable - Whether the row is in edit mode.
	 */

	/**
	 * @typedef {Object} InfoRowSetDataHookArgs
	 * @property {string} rowID - Row ID.
	 * @property {Zotero.Item} item - Current item.
	 * @property {string} tabType - Current tab type.
	 * @property {string} editable - Whether the row is in edit mode.
	 * @property {string} value - New value.
	 */

	/**
	 * @typedef {Object} InfoRowItemChangeHookArgs
	 * @property {string} rowID - Row ID.
	 * @property {Zotero.Item} item - Current item.
	 * @property {string} tabType - Current tab type.
	 * @property {boolean} editable - Whether the row is in edit mode.
	 * @property {SetInfoRowEnabled} setEnabled - Set row enabled state.
	 * @property {SetInfoRowEditable} setEditable - Set row editable state.
	 */

	/**
	 * @typedef {function} InfoRowGetDataHook
	 * @param {InfoRowGetDataHookArgs} props - Hook arguments for getting data.
	 * @returns {string} - Row data.
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


	class ItemPaneInfoRowManagerInternal extends PluginAPIBase {
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
		unregisterSection(paneID) {
			return this._sectionManager.unregister(paneID);
		},

		get customSectionData() {
			return this._sectionManager.data;
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
		unregisterInfoRow(rowID) {
			return this._infoRowManager.unregister(rowID);
		},

		/**
		 * Refresh a custom item pane info section row.
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
}
