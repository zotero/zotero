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


/**
 * @typedef {object} SectionIcon
 * @property {string} icon - Icon URI
 * @property {string} [darkIcon] - Icon URI in dark mode. If not set, use `icon`
 * @typedef {object} SectionL10n
 * @property {string} l10nID - data-l10n-id for localization of section header label
 * @property {string} [l10nArgs] - data-l10n-args for localization
 * @typedef {object} SectionButton
 * @property {string} type - Button type, must be valid DOMString and without ","
 * @property {string} icon - Icon URI
 * @property {string} [darkIcon] - Icon URI in dark mode. If not set, use `icon`
 * @property {string} [l10nID] - data-l10n-id for localization of button tooltiptext
 * @property {(props: SectionEventHookArgs) => void} onClick - Button click callback
 * @typedef {object} SectionBasicHookArgs
 * @property {string} paneID - Registered pane id
 * @property {Document} doc - Document of section
 * @property {HTMLDivElement} body - Section body
 * @typedef {object} SectionUIHookArgs
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
 * @typedef {SectionBasicHookArgs & SectionUIHookArgs} SectionHookArgs
 * @typedef {SectionHookArgs & { refresh: () => Promise<void> }} SectionInitHookArgs
 * A `refresh` is exposed to plugins to allows plugins to refresh the section when necessary,
 * e.g. item modify notifier callback. Note that calling `refresh` during initialization
 * have no effect.
 * @typedef {SectionHookArgs & { event: Event }} SectionEventHookArgs
 * @typedef {object} ItemDetailsSectionOptions
 * @property {string} paneID - Unique pane ID
 * @property {string} pluginID - Set plugin ID to auto remove section when plugin is disabled/removed
 * @property {SectionL10n & SectionIcon} header - Header options. Icon should be 16*16 and `label` need to be localized
 * @property {SectionL10n & SectionIcon & { showByDefault?: boolean }} sidenav
 * Sidenav options. Icon should be 20*20 and `tooltiptext` need to be localized
 * `showByDefault` determines whether a sidenav button is visible in the sidebar's default state,
 * such as when no items or multiple items are selected.
 * If this property is not set or is false, the button will not appear in the default state.
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


class ItemPaneManager {
	_customSections = {};

	_lastUpdateTime = 0;

	/**
	 * Register a custom section in item pane. All registered sections must be valid, and must have a unique paneID.
	 * @param {ItemDetailsSectionOptions} options - section data
	 * @returns {string | false} - The paneID or false if no section were added
	 */
	registerSection(options) {
		let registeredID = this._addSection(options);
		if (!registeredID) {
			return false;
		}
		this._addPluginShutdownObserver();
		this._notifyItemPane();
		return registeredID;
	}

	/**
	 * Unregister a custom column.
	 * @param {string} paneID - The paneID of the section(s) to unregister
	 * @returns {boolean} true if the column(s) are unregistered
	 */
	unregisterSection(paneID) {
		const success = this._removeSection(paneID);
		if (!success) {
			return false;
		}
		this._notifyItemPane();
		return true;
	}

	getUpdateTime() {
		return this._lastUpdateTime;
	}

	/**
	 * @returns {ItemDetailsSectionOptions[]}
	 */
	getCustomSections() {
		return Object.values(this._customSections).map(opt => Object.assign({}, opt));
	}

	/**
	 * @param {ItemDetailsSectionOptions} options
	 * @returns {string | false}
	 */
	_addSection(options) {
		options = Object.assign({}, options);
		options.paneID = this._namespacedDataKey(options);
		if (!this._validateSectionOptions(options)) {
			return false;
		}
		this._customSections[options.paneID] = options;
		return options.paneID;
	}

	_removeSection(paneID) {
		// If any check fails, return check results and do not remove any section
		if (!this._customSections[paneID]) {
			Zotero.warn(`ItemPaneManager: Can't remove unknown section '${paneID}'`);
			return false;
		}
		delete this._customSections[paneID];
		return true;
	}

	/**
	 * @param {ItemDetailsSectionOptions} options
	 * @returns {boolean}
	 */
	_validateSectionOptions(options) {
		let requiredParamsType = {
			paneID: "string",
			pluginID: "string",
			header: (val) => {
				if (typeof val != "object") {
					return "ItemPaneManager: 'header' must be object";
				}
				if (!val.l10nID || typeof val.l10nID != "string") {
					return "ItemPaneManager: header.l10nID must be a non-empty string";
				}
				if (!val.icon || typeof val.icon != "string") {
					return "ItemPaneManager: header.icon must be a non-empty string";
				}
				return true;
			},
			sidenav: (val) => {
				if (typeof val != "object") {
					return "ItemPaneManager: 'sidenav' must be object";
				}
				if (!val.l10nID || typeof val.l10nID != "string") {
					return "ItemPaneManager: sidenav.l10nID must be a non-empty string";
				}
				if (!val.icon || typeof val.icon != "string") {
					return "ItemPaneManager: sidenav.icon must be a non-empty string";
				}
				return true;
			},
		};
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
		for (let key of Object.keys(requiredParamsType)) {
			let val = options[key];
			if (!val) {
				Zotero.warn(`ItemPaneManager: Section options must have ${key}`);
				return false;
			}
			let requiredType = requiredParamsType[key];
			if (typeof requiredType == "string" && typeof val != requiredType) {
				Zotero.warn(`ItemPaneManager: Section option '${key}' must be ${requiredType}, got ${typeof val}`);
				return false;
			}
			if (typeof requiredType == "function") {
				let result = requiredType(val);
				if (result !== true) {
					Zotero.warn(result);
					return false;
				}
			}
		}
		if (builtInPaneIDs.includes(options.paneID)) {
			Zotero.warn(`ItemPaneManager: 'paneID' must not conflict with built-in paneID, got ${options.paneID}`);
			return false;
		}
		if (this._customSections[options.paneID]) {
			Zotero.warn(`ItemPaneManager: 'paneID' must be unique, got ${options.paneID}`);
			return false;
		}
		
		return true;
	}

	/**
	 * Make sure the dataKey is namespaced with the plugin ID
	 * @param {ItemDetailsSectionOptions} options
	 * @returns {string}
	 */
	_namespacedDataKey(options) {
		if (options.pluginID && options.paneID) {
			// Make sure the return value is valid as class name or element id
			return `${options.pluginID}-${options.paneID}`.replace(/[^a-zA-Z0-9-_]/g, "-");
		}
		return options.paneID;
	}

	async _notifyItemPane() {
		this._lastUpdateTime = new Date().getTime();
		await Zotero.DB.executeTransaction(async function () {
			Zotero.Notifier.queue(
				'refresh',
				'itempane',
				[],
				{},
			);
		});
	}

	/**
	 * Unregister all columns registered by a plugin
	 * @param {string} pluginID - Plugin ID
	 */
	async _unregisterSectionByPluginID(pluginID) {
		let paneIDs = Object.keys(this._customSections).filter(id => this._customSections[id].pluginID == pluginID);
		if (paneIDs.length === 0) {
			return;
		}
		// Remove the columns one by one
		// This is to ensure that the columns are removed and not interrupted by any non-existing columns
		paneIDs.forEach(id => this._removeSection(id));
		Zotero.debug(`ItemPaneManager: Section for plugin ${pluginID} unregistered due to shutdown`);
		await this._notifyItemPane();
	}

	/**
	 * Ensure that the shutdown observer is added
	 * @returns {void}
	 */
	_addPluginShutdownObserver() {
		if (this._observerAdded) {
			return;
		}

		Zotero.Plugins.addObserver({
			shutdown: ({ id: pluginID }) => {
				this._unregisterSectionByPluginID(pluginID);
			}
		});
		this._observerAdded = true;
	}
}

Zotero.ItemPaneManager = new ItemPaneManager();
