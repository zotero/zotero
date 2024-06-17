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


var PluginAPIBase;
if (typeof PluginAPIBase === "undefined") {
	PluginAPIBase = ChromeUtils.importESModule("chrome://zotero/content/modules/pluginAPIBase.mjs").PluginAPIBase;
}


/**
 * @typedef SectionIcon
 * @type {object}
 * @property {string} icon - Icon URI
 * @property {string} [darkIcon] - Icon URI in dark mode. If not set, use `icon`
 * @typedef SectionL10n
 * @type {object}
 * @property {string} l10nID - data-l10n-id for localization of section header label
 * @property {string} [l10nArgs] - data-l10n-args for localization
 * @typedef SectionButton
 * @type {object}
 * @property {string} type - Button type, must be valid DOMString and without ","
 * @property {string} icon - Icon URI
 * @property {string} [darkIcon] - Icon URI in dark mode. If not set, use `icon`
 * @property {string} [l10nID] - data-l10n-id for localization of button tooltiptext
 * @property {(props: SectionEventHookArgs) => void} onClick - Button click callback
 * @typedef SectionBasicHookArgs
 * @type {object}
 * @property {string} paneID - Registered pane id
 * @property {Document} doc - Document of section
 * @property {HTMLDivElement} body - Section body
 * @typedef SectionUIHookArgs
 * @type {object}
 * @property {Zotero.Item} item - Current item
 * @property {string} tabType - Current tab type
 * @property {boolean} editable - Whether the section is in edit mode
 * @property {(l10nArgs: string) => void} setL10nArgs - Set l10n args for section header
 * @property {(l10nArgs: string) => void} setEnabled - Set pane enabled state
 * @property {(summary: string) => void} setSectionSummary - Set pane section summary,
 * the text shown in the section header when the section is collapsed.
 *
 * See the Abstract section as an example
 * @property {(buttonType: string, options: {disabled?: boolean; hidden?: boolean}) => void} setSectionButtonStatus - Set pane section button status
 * @typedef SectionHookArgs
 * @type {SectionBasicHookArgs & SectionUIHookArgs}
 * @typedef  {SectionHookArgs & { refresh: () => Promise<void> }} SectionInitHookArgs
 * A `refresh` is exposed to plugins to allows plugins to refresh the section when necessary,
 * e.g. item modify notifier callback. Note that calling `refresh` during initialization
 * have no effect.
 * @typedef  {SectionHookArgs & { event: Event }} SectionEventHookArgs
 * @typedef ItemDetailsSectionOptions
 * @type {object}
 * @property {string} paneID - Unique pane ID
 * @property {string} pluginID - Set plugin ID to auto remove section when plugin is disabled/removed
 * @property {SectionL10n & SectionIcon} header - Header options. Icon should be 16*16 and `label` need to be localized
 * @property {SectionL10n & SectionIcon} sidenav - Sidenav options. Icon should be 20*20 and `tooltiptext` need to be localized
 * @property {string} [bodyXHTML] - Pane body's innerHTML, default to XUL namespace
 * @property {(props: SectionInitHookArgs) => void} [onInit]
 * Lifecycle hook called when section is initialized.
 * You can use destructuring assignment to get the props:
 * ```js
 * onInit({ paneID, doc, body, item, editable, tabType, setL10nArgs, setEnabled,
 *          setSectionSummary, setSectionButtonStatus, refresh }) {
 *   // Your code here
 * }
 * ```
 *
 * Do:
 * 1. Initialize data if necessary
 * 2. Set up hooks, e.g. notifier callback
 *
 * Don't:
 * 1. Render/refresh UI
 * @property {(props: SectionBasicHookArgs) => void} [onDestroy]
 * Lifecycle hook called when section is destroyed
 *
 * Do:
 * 1. Remove data and release resource
 * 2. Remove hooks, e.g. notifier callback
 *
 * Don't:
 * 1. Render/refresh UI
 * @property {(props: SectionHookArgs) => boolean} [onItemChange]
 * Lifecycle hook called when section's item change received
 *
 * Do:
 * 1. Update data (no need to render or refresh);
 * 2. Update the section enabled state with `props.setEnabled`. For example, if the section
 *   is only enabled in the readers, you can use:
 * ```js
 * onItemChange({ setEnabled }) {
 *   setEnabled(newData.value === "reader");
 * }
 * ```
 *
 * Don't:
 * 1. Render/refresh UI
 * @property {(props: SectionHookArgs) => void} onRender
 * Lifecycle hook called when section should do initial render. Cannot be async.
 *
 * Create elements and append them to `props.body`.
 *
 * If the rendering is slow, you should make the bottleneck async and move it to `onAsyncRender`.
 *
 * > Note that the rendering of section is fully controlled by Zotero to minimize resource usage.
 * > Only render UI things when you are told to.
 * @property {(props: SectionHookArgs) => void | Promise<void>} [onAsyncRender]
 * [Optional] Lifecycle hook called when section should do async render
 *
 * The best practice to time-consuming rendering with runtime decided section height is:
 * 1. Compute height and create a box in sync `onRender`;
 * 2. Render actual contents in async `onAsyncRender`.
 * @property {(props: SectionEventHookArgs) => void} [onToggle] - Called when section is toggled
 * @property {SectionButton[]} [sectionButtons] - Section button options
 */


class ItemPaneSectionManagerIntl extends PluginAPIBase {
	constructor() {
		super();
		this.config = {
			APIName: "ItemPaneSectionAPI",
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
		let result = super._validate(option);
		if (!result) {
			return false;
		}

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

		let mainKey = this._getOptionMainKey(option);
		if (builtInPaneIDs.includes(mainKey)) {
			this._log(`'paneID' must not conflict with built-in paneID, got ${mainKey}`, "warn");
			return false;
		}
		return true;
	}
}


class ItemPaneInfoRowManagerIntl extends PluginAPIBase {
	constructor() {
		super();
		this.config = {
			APIName: "ItemPaneInfoRowAPI",
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
				onGetData: "function",
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
}


class ItemPaneManager {
	_sectionManager = new ItemPaneSectionManagerIntl();

	_infoRowManager = new ItemPaneInfoRowManagerIntl();

	registerSection(options) {
		return this._sectionManager.register(options);
	}

	unregisterSection(paneID) {
		return this._sectionManager.unregister(paneID);
	}

	get customSectionData() {
		return this._sectionManager.data;
	}

	registerInfoRow(options) {
		return this._infoRowManager.register(options);
	}

	unregisterInfoRow(rowID) {
		return this._infoRowManager.unregister(rowID);
	}

	get customInfoRowData() {
		return this._infoRowManager.data;
	}

	getInfoRowHook(rowID, type) {
		let option = this._infoRowManager._optionsCache[rowID];
		if (!option) {
			return undefined;
		}
		return option[type];
	}
}


Zotero.ItemPaneManager = new ItemPaneManager();
