/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2023 Corporation for Digital Scholarship
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
 * @typedef {"*" | "library" | "reader"} PaneMode
 * @typedef {"load" | "activated" | "update" | "deactivated" | "unload"} PaneEventType
 * @typedef {{
 *     type: PaneEventType,
 *     mode: PaneMode,
 *     item: Zotero.Item,
 *     target: HTMLElement | null,
 * }} PaneEvent
 * @typedef {(event: PaneEvent) => void | Promise<void>} PaneCallback - Callback for a pane event
 * @typedef ItemPaneCustomPaneOptions - Options for the item pane manager
 * @property {string} id - The ID of the pane
 * @property {string} pluginID - The plugin's ID
 * @property {string} label - The label to display
 * @property {PaneMode[]} [mode] - The pane mode(s) for which the pane should be used
 * @property {PaneCallback} [onLoad] - Called when the pane is loaded
 * @property {PaneCallback} [onActivated] - Called when the pane is activated
 * @property {PaneCallback} [onUpdate] - Called when the pane data has update
 * @property {PaneCallback} [onDeactivated] - Called when the pane is deactivated
 * @property {PaneCallback} [onUnload] - Called when the pane is removed.
 * The `target` property of the event is `null`.
 */

class ItemPaneManager {
	//
	/**
	 * @type {Record<string, ItemPaneCustomPaneOptions>}
	 */
	_customPanes = {};

	/**
	 * Register a custom item pane.
	 * @param {ItemPaneCustomPaneOptions | ItemPaneCustomPaneOptions[]} options - Options for the item pane manager
	 * @returns {string | string[] | false} - The id(s) of the added pane(s) or false if no panes were added
	 * @example
	 * ```js
	 * // You can unregister the column later with Zotero.ItemPaneManager.unregisterPanes(registeredID);
	 * let registeredID = Zotero.ItemPaneManager.registerPanes({
	 *     id: "my-pane", // ID of the pane. Must be unique for each plugin. Will be namespaced with the plugin ID.
	 *     pluginID: "make-it-red@zotero.org", // Plugin ID
	 *     label: "My Pane", // Label to display
	 *     mode: ["*"], // Pane mode(s) for which the pane should be used. "*" means all modes. You can also use "library" or "reader".
	 *     onLoad: (event) => {
	 *         let { type, mode, item, target } = event;
	 *         // type: PaneEvent type. It's "ready" here.
	 *         // mode: Pane mode currently in. "library" or "reader".
	 *         // item: The corresponding item of the pane. In the reader, it's the attachment item.
	 *         // target: The target element to append the pane to. The <tabpanel> element of the pane.
	 *         Zotero.log("Pane load!");
	 *         console.log(event);
	 *         const doc = target.ownerDocument;
	 *         let header = doc.createElement("h1");
	 *         header.textContent = "Hello World!";
	 *         let info = doc.createElement("p");
	 *         info.textContent = `This is a custom pane in ${mode}.`;
	 *         let title = doc.createElement("p");
	 *         title.classList.add("custom-pane-title");
	 *         title.textContent = `Item: ${item.getField("title").substr(0, 50)}`;
	 *         let button = doc.createElement("button");
	 *         button.textContent = "Unregister me!";
	 *         button.addEventListener("click", () => {
	 *             Zotero.ItemPaneManager.unregisterPanes(registeredID);
	 *         });
	 *         target.setAttribute("orient", "vertical");
	 *         target.append(header, info, title, button);
	 *     },
	 *     onActivated: (event) => {
	 *         Zotero.log("Pane activated!");
	 *         console.log(event);
	 *     },
	 *     onUpdate: (event) => {
	 *         let { type, mode, item, target } = event;
	 *         Zotero.log("Pane update!");
	 *         console.log(event);
	 *         let title = target.querySelector(".custom-pane-title");
	 *         title.textContent = `Title: ${item.getField("title").substr(0, 50)}`;
	 *     },
	 *     onDeactivated: (event) => {
	 *         Zotero.log("Pane deactivated!");
	 *         console.log(event);
	 *     },
	 *     onUnload: (event) => {
	 *         Zotero.log("Pane unload!");
	 *         console.log(event);
	 *     },
	 * });
	 * ```
	 */
	registerPanes(options) {
		const registeredIDs = this._addPanes(options);
		if (!registeredIDs) {
			return false;
		}
		this._addPluginShutdownObserver();
		this._notifyItemPanes();
		return registeredIDs;
	}

	/**
	 * Unregister a custom item pane pane.
	 * @param {string | string[]} ids - The id(s) of the pane(s) to unregister
	 * @returns {boolean} Whether the pane(s) were unregistered
	 * @example
	 * ```js
	 * Zotero.ItemPaneManager.unregisterPanes(registeredID);
	 * ```
	 */
	unregisterPanes(ids) {
		const success = this._removePanes(ids);
		if (!success) {
			return false;
		}
		this._notifyItemPanes();
		return success;
	}

	/**
	 * Trigger an event for a pane
	 * @param {string} id - The id of the pane
	 * @param {PaneEvent} event - The event to trigger
	 */
	async triggerEvent(id, event) {
		try {
			switch (event.type) {
				case "load":
					await this._customPanes[id]?.onLoad?.(event);
					break;
				case "activated":
					await this._customPanes[id]?.onActivated?.(event);
					break;
				case "update":
					await this._customPanes[id]?.onUpdate?.(event);
					break;
				case "deactivated":
					await this._customPanes[id]?.onDeactivated?.(event);
					break;
				case "unload":
					await this._customPanes[id]?.onUnload?.(event);
					break;
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
	}

	/**
	 * Init item pane
	 * @param {HTMLElement} tabbox - tabbox element
	 * @param {PaneMode} mode - pane mode
	 * @param {string} tabID - Zotero tab ID
	 */
	initPane(tabbox, mode, tabID) {
		const win = tabbox.ownerDocument.defaultView;
		const MutationObserver = win.MutationObserver;
		// Listen to attribute `selected` changes in tab's childList
		const triggerActivationEvent = async (tab) => {
			let paneID = this.getPaneIDFromElement(tab);
			if (!paneID) {
				return;
			}
			let panel = tabbox.tabpanels.querySelector(`tabpanel[custom-pane-id="${paneID}"]`);
			if (!panel) {
				return;
			}
			let selected = tab.getAttribute("selected") === "true";
			let loaded = this.getPaneLoadedFromElement(panel);
			let item = this.getItemFromElement(panel);
			if (selected) {
				if (!loaded) {
					await this.triggerEvent(paneID, {
						type: "load",
						mode,
						item,
						target: this.getPaneContainerFromElement(panel),
					});
					this.setPaneLoadedToElement(panel, true);
				}
				await this.triggerEvent(paneID, {
					type: "activated",
					mode,
					item,
					target: this.getPaneContainerFromElement(panel),
				});
			}
			else {
				if (!loaded) {
					return;
				}
				await this.triggerEvent(paneID, {
					type: "deactivated",
					mode,
					item,
					target: this.getPaneContainerFromElement(panel),
				});
			}
		};

		let activationObserver = new MutationObserver(async (mutations) => {
			for (const mutation of mutations) {
				let target = mutation.target;
				if (target.tagName !== "tab") {
					continue;
				}
				triggerActivationEvent(target);
			}
		});
		activationObserver.observe(tabbox.tabs, {
			childList: true,
			attributes: true,
			attributeFilter: ["selected"],
			subtree: true,
		});

		const triggerUnloadEvent = async (tabpanel) => {
			let paneID = this.getPaneIDFromElement(tabpanel);
			if (!paneID) {
				return;
			}
			let item = this.getItemFromElement(tabpanel);
			await this.triggerEvent(paneID, {
				type: "unload",
				mode,
				item,
				target: null,
			});
		};

		// Listen to tabbox or tab removal and trigger unload event
		let unloadObserver = new MutationObserver(async (mutations) => {
			for (const mutation of mutations) {
				mutation.removedNodes.forEach((target) => {
					if (target.tagName === "tabbox" && Node.isEqualNode(target, tabbox)) {
						// Check each child tabpanel
						Array.from(target.querySelectorAll("tabpanels")).forEach(
							triggerUnloadEvent
						);
						// Remove observers when the tabbox is removed
						unloadObserver.disconnect();
						activationObserver.disconnect();
					}
					else if (target.tagName === "tabpanel" && tabbox.contains(target)) {
						triggerUnloadEvent(target);
					}
				});
			}
		});
		unloadObserver.observe(tabbox.parentElement, {
			childList: true,
			subtree: true,
		});

		this._removedUnregisteredPanes(tabbox);
		this._ensureRegisteredPanes(tabbox, mode, tabID);
	}

	/**
	 * Get pane ID from tab or tabpanel. The ID is stored in the `custom-pane-id` attribute of the element.
	 * @param {HTMLElement} elem - tab or tabpanel
	 * @returns {string}
	 */
	getPaneIDFromElement(elem) {
		return elem?.getAttribute("custom-pane-id");
	}

	/**
	 * Get pane container from tabpanel. The container is the <box> element with class `zotero-editpane-custom-content`.
	 * @param {HTMLElement} elem - tabpanel
	 * @returns {HTMLElement}
	 */
	getPaneContainerFromElement(elem) {
		return elem?.querySelector(".zotero-editpane-custom-content");
	}

	/**
	 * Get bind item from tab or tabpanel. The item id is stored in the top <tabbox>.
	 * @param {HTMLElement} elem - tab or tabpanel
	 * @returns {Zotero.Item}
	 */
	getItemFromElement(elem) {
		let tabbox = elem.tagName === "tabbox" ? elem : elem?.parentElement?.parentElement;
		return Zotero.Items.get(tabbox?.getAttribute("custom-pane-item-id"));
	}

	/**
	 * Set bind item to tab or tabpanel. The item id is stored in the top <tabbox>.
	 * @param {HTMLElement} elem - tabbox, tab, or tabpanel
	 * @param {Zotero.Item} item - The item to bind
	 * @returns {void}
	 */
	setItemToElement(elem, item) {
		let tabbox = elem.tagName === "tabbox" ? elem : elem?.parentElement?.parentElement;
		tabbox?.setAttribute("custom-pane-item-id", item?.id);
	}

	/**
	 * Get pane loaded status from tabpanel. The status is stored in the `custom-pane-loaded` attribute of the element.
	 * @param {HTMLElement} elem - tabpanel element
	 * @returns {boolean}
	 */
	getPaneLoadedFromElement(elem) {
		return elem?.getAttribute("custom-pane-loaded") === "true";
	}

	/**
	 * Set pane loaded status to tabpanel. The status is stored in the `custom-pane-loaded` attribute of the element.
	 * @param {HTMLElement} elem - tabpanel element
	 * @param {boolean} loaded - The loaded status
	 * @returns {void}
	 */
	setPaneLoadedToElement(elem, loaded) {
		elem?.setAttribute("custom-pane-loaded", loaded ? "true" : "false");
	}

	/**
	 * Get the tabbox by tab ID
	 * @param {Window} win - Zotero main window
	 * @param {string} tabID - Tab ID
	 * @returns {HTMLElement | undefined} - The pane container (tabbox) or undefined if not found
	 */
	getPaneTabBoxByTabID(win, tabID) {
		let tab = win.Zotero_Tabs._getTab(tabID).tab;
		if (!tab) {
			return undefined;
		}
		if (tab.type === "library") {
			return win.document.querySelector("#zotero-view-tabbox");
		}
		else if (tab.type === "reader") {
			return win.document
				.querySelector(`#${tabID}-context`)
				?.querySelector(".zotero-view-tabbox");
		}
		return undefined;
	}

	/**
	 * Get all panes
	 * @returns {ItemPaneCustomPaneOptions[]}
	 */
	getCustomPaneOptions() {
		return Object.values(this._customPanes).map(opt => Object.assign({}, opt));
	}

	/**
	 * Get panes that matches the pluginID
	 * @param {string} pluginID - The pluginID to match
	 * @returns {ItemPaneCustomPaneOptions[]}
	 */
	_getCustomPaneOptionsByPluginID(pluginID) {
		return this.getCustomPaneOptions().filter(opt => opt.pluginID === pluginID);
	}

	/**
	 * Get panes that matches the mode
	 * @param {PaneMode | PaneMode[]} modes - The pane mode(s) to match
	 * @returns {ItemPaneCustomPaneOptions[]}
	 */
	_getCustomPaneOptionsByMode(modes) {
		if (!Array.isArray(modes)) {
			modes = [modes];
		}
		const allOptions = this.getCustomPaneOptions();
		if (modes.includes("*")) {
			return allOptions;
		}
		let matchedOptions = [];
		for (const opt of allOptions) {
			if (opt.mode.includes("*") || opt.mode.some(m => modes.includes(m))) {
				matchedOptions.push(opt);
			}
		}
		return matchedOptions;
	}

	/**
	 * Check if options is valid.
	 * All its children must be valid. Otherwise, the validation fails.
	 * @param {ItemPaneCustomPaneOptions[]} options - An array of options to validate
	 * @returns {boolean} true if the options are valid
	 */
	_validatePaneOption(options) {
		// Check if the input option has duplicate ids
		const noInputDuplicates = !options.find(
			(opt, i, arr) => arr.findIndex(o => o.id === opt.id) !== i
		);
		if (!noInputDuplicates) {
			Zotero.warn(`ItemPane options have duplicate id.`);
		}
		const requiredProperties = options.every((option) => {
			const valid = option.id && option.label && option.pluginID;
			if (!valid) {
				Zotero.warn(
					`ItemPane option ${JSON.stringify(option)} must have id, label, and pluginID.`
				);
			}
			return valid;
		});
		const noRegisteredDuplicates = options.every((option) => {
			const valid = !this._customPanes[option.id];
			if (!valid) {
				Zotero.warn(
					`ItemPane option ${JSON.stringify(option)} with id ${option.id} already exists.`
				);
			}
			return valid;
		});
		return noInputDuplicates && requiredProperties && noRegisteredDuplicates;
	}

	/**
	 * Add new pane(s).
	 * If the options is an array, all its children must be valid.
	 * Otherwise, no panes are added.
	 * @param {ItemPaneCustomPaneOptions | ItemPaneCustomPaneOptions[]} options - An option or array of options to add
	 * @returns {string | string[] | false} - The id(s) of the added pane(s) or false if no panes were added
	 */
	_addPanes(options) {
		const isSingle = !Array.isArray(options);
		if (isSingle) {
			options = [options];
		}
		options.forEach((o) => {
			o.id = this._namespacedID(o);
			if (o.mode?.includes("*")) {
				o.mode = ["*"];
			}
			o.mode = o.mode || ["*"];
		});
		// If any check fails, return check results
		if (!this._validatePaneOption(options)) {
			return false;
		}
		for (const opt of options) {
			this._customPanes[opt.id] = Object.assign({}, opt);
		}
		return isSingle ? options[0].id : options.map(opt => opt.id);
	}

	/**
	 * Remove panes
	 * @param {string | string[]} ids - The ids to remove
	 * @returns {boolean} - True if pane(s) were removed, false if not
	 */
	_removePanes(ids) {
		if (!Array.isArray(ids)) {
			ids = [ids];
		}
		// If any check fails, return check results and do not remove any panes
		for (const id of ids) {
			if (!this._customPanes[id]) {
				Zotero.warn(`ItemPane with id ${id} does not exist.`);
				return false;
			}
		}
		for (const key of ids) {
			delete this._customPanes[key];
		}
		return true;
	}

	/**
	 * Make sure the id is namespaced with the plugin ID
	 * @param {ItemPaneCustomPaneOptions} options
	 * @returns {string}
	 */
	_namespacedID(options) {
		if (options.pluginID && options.id) {
			// Make sure the return value is valid as class name or element id
			return `${options.pluginID}-${options.id}`.replace(/[^a-zA-Z0-9-_]/g, "-");
		}
		return options.id;
	}

	/**
	 * Remove panes that are not registered
	 * @param {HTMLElement} tabbox - The tabbox to check
	 */
	_removedUnregisteredPanes(tabbox) {
		const _checkTabsOrTabPanels = (elems) => {
			for (const elem of elems) {
				const paneID = this.getPaneIDFromElement(elem);
				// Skip built-in panes and other elements
				if (!paneID) {
					continue;
				}
				if (!this._customPanes[paneID]) {
					elem.remove();
				}
			}
		};
		_checkTabsOrTabPanels(Array.from(tabbox.tabs.children));
		_checkTabsOrTabPanels(Array.from(tabbox.tabpanels.children));
		if (!tabbox.selectedTab) {
			// If the selected tab is removed, select the first tab
			tabbox.selectedIndex = 0;
		}
	}

	/**
	 * Ensure that all registered panes are added to the tabbox
	 * @param {HTMLElement} tabbox - The tabbox to check
	 * @param {PaneMode} mode - The pane mode
	 * @param {string} tabID - The Zotero tab ID
	 */
	_ensureRegisteredPanes(tabbox, mode, tabID) {
		const optionsList = this._getCustomPaneOptionsByMode(mode);
		for (const options of optionsList) {
			const paneID = options.id;
			let tab = tabbox.querySelector(`tab[custom-pane-id="${paneID}"]`);
			let tabpanel = tabbox.querySelector(`tabpanel[custom-pane-id="${paneID}"]`);
			// If exist, skip
			if (tab && tabpanel) {
				continue;
			}
			// If either tab or tabpanel is missing, remove both and add them again
			tab?.remove();
			tabpanel?.remove();
			const doc = tabbox.ownerDocument;

			tab = tabbox.tabs.appendItem(options.label);
			tab.setAttribute("custom-pane-id", paneID);
			tab.setAttribute("id", `${tabID}-${paneID}-custom-tab`);
			tab.setAttribute("class", "zotero-editpane-custom-tab");

			tabpanel = doc.createXULElement("tabpanel");
			tabpanel.setAttribute("custom-pane-id", paneID);
			tabpanel.setAttribute("id", `${tabID}-${paneID}-custom-tabpanel`);
			tabpanel.setAttribute("class", "zotero-editpane-custom-tabpanel");
			tabpanel.setAttribute("flex", "1");

			let panelContent = doc.createXULElement("box");
			panelContent.setAttribute("class", "zotero-editpane-custom-content");
			tabpanel.append(panelContent);

			tabbox.tabpanels.append(tabpanel);
		}
	}

	_notifyItemPanes() {
		for (const win of Zotero.getMainWindows()) {
			for (const tab of win.Zotero_Tabs._tabs) {
				const tabbox = this.getPaneTabBoxByTabID(win, tab.id);
				if (!tabbox) {
					return;
				}
				this._removedUnregisteredPanes(tabbox);
				this._ensureRegisteredPanes(tabbox, tab.type, tab.id);
			}
		}
	}

	/**
	 * Unregister all panes registered by a plugin
	 * @param {string} pluginID - Plugin ID
	 */
	async _unregisterPaneByPluginID(pluginID) {
		const panes = this._getCustomPaneOptionsByPluginID(pluginID);
		if (panes.length === 0) {
			return;
		}
		// Remove the panes one by one
		// This is to ensure that the panes are removed and not interrupted by any non-existing panes
		panes.forEach(pane => this._removePanes(pane.id));
		Zotero.debug(
			`ItemPane panes registered by plugin ${pluginID} unregistered due to shutdown`
		);
		this._notifyItemPanes();
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
				this._unregisterPaneByPluginID(pluginID);
			},
		});
		this._observerAdded = true;
	}
}

Zotero.ItemPaneManager = new ItemPaneManager();
