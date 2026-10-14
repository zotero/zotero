/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
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
		Params: "chrome://zotero/content/xpcom/pluginAPI/apiParams.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		PluginProtocol: "chrome://zotero/content/xpcom/plugins/protocol.mjs",
		PluginSandbox: "chrome://zotero/content/xpcom/plugins/sandbox.mjs",
		WindowUtils: "chrome://zotero/content/xpcom/plugins/window.mjs",
	});

	const ICON_KEYS = ["icon", "darkIcon", "menuIcon", "darkMenuIcon"];

	const VALID_TARGETS = [
		// Main window title bar, before the tabs menu button
		"main/titlebar",
		// Main window items toolbar (library tab toolbar)
		"main/library/toolbar",
		// Reader toolbar (reader tab/window toolbar)
		"reader/toolbar",
	];

	const OVERFLOW_ITEM_CLASS = "zotero-custom-button-overflow-item";
	const CUSTOM_MENU_CLASS = "zotero-custom-menu-item";

	/**
	 * @namespace Zotero
	 */

	/**
	 * @typedef ButtonOptions
	 * @type {object}
	 * @property {string} buttonID - The unique ID of the button
	 * @property {string} pluginID - The ID of the plugin registering the button
	 * @property {string} target - The target UI location for the button.
	 * @property {string} l10nID - The l10n ID for the button. The Fluent message should define
	 * a `.tooltiptext` attribute (used as the button tooltip) and a `.label` attribute
	 * (used when the button is collapsed into the overflow menu).
	 * The FTL file should be registered with `Zotero.WindowResourceManager` for the target window
	 * @property {string} [icon] - The icon URL for the button
	 * - It is recommended to use an SVG icon with a size of 20x20.
	 * When the button is collapsed into the overflow menu, the icon is rendered at 16x16.
	 * Use `fill="context-fill"` in the SVG for automatic hover and dark mode support
	 * @property {string} [darkIcon] - The dark-mode icon for the button
	 * - If not provided, the light icon will be used for both light and dark mode.
	 * In the reader toolbar, the light icon is always used and `context-fill` is rendered
	 * as `currentColor`, which follows the reader theme
	 * @property {string} [menuIcon] - A dedicated 16x16 icon used when the button
	 * is collapsed into the overflow menu. If not provided, `icon` is rendered at 16x16
	 * @property {string} [darkMenuIcon] - The dark-mode variant of `menuIcon`
	 * @property {string[]} [enableForTabTypes] - The tab types for which the button
	 * should be shown. Only applies to reader/toolbar, where "reader" or "reader/*"
	 * shows it for every reader type and "reader/pdf", "reader/epub", and "reader/snapshot"
	 * limit it to that type. By default, the button is always shown. Ignored for other targets.
	 * @property {function} [onCommand] - Function to run when the button is clicked.
	 * Called with a `ButtonContext`. Mutually exclusive with `menus`
	 * @property {MenuData[]} [menus] - Menu items for a dropdown button. When provided,
	 * clicking the button opens a dropdown menu with these items. The menu data is managed
	 * by `Zotero.MenuManager` and supports the same options as custom menus.
	 * Mutually exclusive with `onCommand`
	 */

	/**
	 * @typedef ButtonContext
	 * @type {object}
	 * @property {string} tabType - The tab content type, e.g. "library" or "reader"
	 * @property {string} [tabSubType] - The tab subtype, e.g. the reader type ("pdf")
	 * @property {string} [tabID] - The tab ID. Undefined for a reader in a separate window
	 * @property {number[]} itemIDs - The IDs of the items the button acts on: the selected
	 * items for a library tab, or the tab's own item otherwise
	 */


	class ButtonManagerInternal extends lazy.ManagerAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "ButtonAPI",
				mainKeyName: "buttonID",
				notifyType: "custom-button",
				notifyAction: "refresh",
				optionTypeDefinition: {
					buttonID: "string",
					pluginID: "string",
					target: lazy.Params.oneOf(VALID_TARGETS),
					l10nID: "string",
					icon: {
						type: "string",
						optional: true,
					},
					darkIcon: {
						type: "string",
						optional: true,
					},
					menuIcon: {
						type: "string",
						optional: true,
					},
					darkMenuIcon: {
						type: "string",
						optional: true,
					},
					enableForTabTypes: {
						type: "array",
						children: "string",
						optional: true,
					},
					onCommand: {
						type: "function",
						optional: true,
					},
					// The menu data is validated by the menu manager when registering the dropdown menu
					menus: {
						type: "array",
						optional: true,
					},
				},
			};
		}

		_validate(option) {
			option = super._validate(option);

			if (!option) {
				return false;
			}

			if (!option.menus && !option.onCommand) {
				this._log("Invalid button: must have either 'onCommand' or 'menus'", "warn");
				return false;
			}
			if (option.menus && option.onCommand) {
				this._log("Invalid button: 'onCommand' and 'menus' are mutually exclusive", "warn");
				return false;
			}
			if (option.menus && option.menus.length === 0) {
				this._log("Invalid button: 'menus' property must not be empty", "warn");
				return false;
			}

			if (!lazy.PluginSandbox.isPrivileged(option.pluginID)) {
				for (let key of ICON_KEYS) {
					if (!option[key]) continue;
					let resolved = lazy.PluginProtocol.resolveImageURL(option.pluginID, option[key]);
					if (resolved === null) {
						this._log(`Invalid button: '${key}' is not an allowed resource URL`, "warn");
						return false;
					}
					option[key] = resolved;
				}
			}
			return option;
		}

		_convert(option) {
			option = super._convert(option);
			if (option.onCommand) {
				option.onCommand = lazy.ScopeVariables.fromScope(option.onCommand, option.pluginID);
			}
			return option;
		}

		_add(option) {
			let mainKey = super._add(option);
			if (!mainKey) {
				return false;
			}
			let addedOption = this._optionsCache[mainKey];
			// Register the dropdown menu of the button in the menu manager
			if (addedOption.menus) {
				let menuTarget = `button/${mainKey}`;
				let menuKey = Zotero.MenuManager.registerMenu({
					menuID: `${mainKey}-menu`,
					pluginID: addedOption.pluginID,
					target: menuTarget,
					menus: addedOption.menus,
				});
				if (!menuKey) {
					this._log(`Failed to register the dropdown menu for button '${mainKey}'`, "warn");
					delete this._optionsCache[mainKey];
					return false;
				}
				addedOption._menuKey = menuKey;
				addedOption._menuTarget = menuTarget;
			}
			return mainKey;
		}

		_remove(mainKey) {
			let option = this._optionsCache[mainKey];
			if (option?._menuKey
					&& Zotero.MenuManager._menuManager._optionsCache[option._menuKey]) {
				Zotero.MenuManager.unregisterMenu(option._menuKey);
			}
			return super._remove(mainKey);
		}

		/**
		 * Get the custom button data for a target type
		 * @param {string} targetType - The target type of the buttons
		 * @param {object} [options]
		 * @param {string} [options.tabType] - If given, only return buttons enabled
		 * for this tab type (see `enableForTabTypes`), e.g. "reader"
		 * @param {string} [options.tabSubType] - The tab subtype, e.g. the reader type
		 * @returns {ButtonOptions[]} - The custom button data for the target type
		 */
		getButtonOptions(targetType, { tabType, tabSubType } = {}) {
			return this.options
				.filter(option => option.target === targetType
					&& (!tabType || this._matchesTabType(option, tabType, tabSubType)))
				// Sort to ensure consistent ordering
				.sort((a, b) => this._getOptionMainKey(a).localeCompare(this._getOptionMainKey(b)));
		}

		/**
		 * Check whether a button should be shown for a tab type
		 * @param {ButtonOptions} option - The button option
		 * @param {string} tabType - The type of the tab, e.g. "library" or "reader"
		 * @param {string} [tabSubType] - The subtype of the tab, e.g. the reader type
		 * @returns {boolean}
		 */
		_matchesTabType(option, tabType, tabSubType) {
			if (!option.enableForTabTypes) {
				return true;
			}
			return lazy.WindowUtils.matchesTabType(option.enableForTabTypes, tabType, tabSubType);
		}

		/**
		 * Update the overflow popup with menu items for the collapsed buttons.
		 * Buttons with a dropdown menu become submenus, click buttons become menu items.
		 * @param {XULPopupElement} popupElem - The overflow menu popup
		 * @param {ButtonOptions[]} options - The options of the collapsed buttons
		 * @param {object} [args] - Additional options
		 * @param {function} [args.getContext] - The function to get the context object
		 */
		updateOverflowPopup(popupElem, options, args = {}) {
			let { getContext } = args;
			let doc = popupElem.ownerDocument;
			popupElem.querySelectorAll(`& > .${OVERFLOW_ITEM_CLASS}`)
				.forEach(elem => elem.remove());
			for (let option of options) {
				let mainKey = this._getOptionMainKey(option);
				let elem;
				if (option._menuTarget) {
					elem = doc.createXULElement("menu");
					elem.classList.add("menu-iconic");
					let subPopup = doc.createXULElement("menupopup");
					elem.appendChild(subPopup);
					subPopup.addEventListener("popupshowing", (event) => {
						if (event.target !== event.currentTarget) {
							return;
						}
						Zotero.MenuManager.updateMenuPopup(subPopup, option._menuTarget, {
							event,
							getContext,
						});
					});
				}
				else {
					elem = doc.createXULElement("menuitem");
					elem.classList.add("menuitem-iconic");
					elem.addEventListener("command", () => {
						option.onCommand(getContext ? getContext() : {});
					});
				}
				elem.classList.add(OVERFLOW_ITEM_CLASS, CUSTOM_MENU_CLASS, mainKey);
				elem.dataset.l10nId = option.l10nID;
				// Prefer the dedicated menu icons, falling back to the button icons
				let lightIcon = option.menuIcon || option.icon
					|| option.darkMenuIcon || option.darkIcon;
				let darkIcon = option.darkMenuIcon || option.menuIcon
					|| option.darkIcon || option.icon;
				if (lightIcon) {
					elem.style.setProperty("--custom-menu-icon-light", `url(${lightIcon})`);
					elem.style.setProperty("--custom-menu-icon-dark", `url(${darkIcon})`);
				}
				popupElem.appendChild(elem);
			}
		}
	}


	/**
	 * Renders the custom buttons in the reader toolbar, using the low-level
	 * Zotero.Reader.registerEventListener("renderToolbar") API.
	 */
	class ReaderToolbarRenderer {
		static BUTTON_CLASS = "zotero-custom-button";

		static ICON_CLASS = "zotero-custom-button-icon";

		static OVERFLOW_ICON_URL = "chrome://zotero/skin/16/universal/chevron-12-double.svg";

		static DROPMARKER_ICON_URL = "chrome://zotero/skin/8/universal/chevron-6.svg";

		static BUTTON_GAP = 4;

		// Extra space required before expanding a collapsed button, to avoid
		// oscillation (matches the EXPAND_BUFFER in toolbarButtons.js)
		static EXPAND_BUFFER = 24;

		constructor(manager) {
			this._manager = manager;
			this._readerData = new WeakMap();
			this._styledDocs = new WeakSet();
			this._iconDataURIs = new Map();
			this._initialized = false;
		}

		init() {
			if (this._initialized) {
				return;
			}
			Zotero.Reader.registerEventListener(
				"renderToolbar",
				event => this._handleRenderToolbar(event)
			);
			Zotero.Notifier.registerObserver({
				notify: (action, type) => {
					if (type === "custom-button") {
						this.refreshAll();
					}
				}
			}, ["custom-button"], "reader-custom-buttons");
			this._initialized = true;
		}

		refreshAll() {
			for (let reader of Zotero.Reader._readers) {
				this.refresh(reader).catch(e => Zotero.logError(e));
			}
		}

		async refresh(reader) {
			await reader._initPromise;
			let doc = reader._iframeWindow?.document;
			if (!doc) {
				return;
			}
			let data = this._readerData.get(reader);
			let container = data?.container;
			if (!container || !container.isConnected) {
				if (!this._getOptions(reader).length) {
					return;
				}
				let customSections = doc.querySelector(".toolbar .custom-sections");
				if (!customSections) {
					return;
				}
				container = this._createContainer(doc);
				customSections.appendChild(container);
				this._initReaderData(reader, container);
			}
			this._renderButtons(reader, container);
		}

		_getOptions(reader) {
			return this._manager.getButtonOptions("reader/toolbar", {
				tabType: "reader",
				tabSubType: reader.type,
			});
		}

		_handleRenderToolbar(event) {
			let { reader, doc, append } = event;
			if (!this._getOptions(reader).length) {
				return;
			}
			let container = this._createContainer(doc);
			append(container);
			this._initReaderData(reader, container);
			this._renderButtons(reader, container);
		}

		_createContainer(doc) {
			let container = doc.createElement("div");
			container.className = "zotero-custom-buttons";
			container.style.display = "flex";
			container.style.alignItems = "center";
			container.style.gap = `${ReaderToolbarRenderer.BUTTON_GAP}px`;
			container.style.flexShrink = "0";
			return container;
		}

		_initReaderData(reader, container) {
			let data = this._readerData.get(reader);
			if (!data) {
				data = { visibleCount: Infinity };
				this._readerData.set(reader, data);
			}
			data.container = container;
			if (!data.resizeObserver) {
				// A chrome-side observer on the reader iframe. The toolbar spans the full
				// iframe width, so this covers window resizes and pane layout changes.
				// Toolbar-internal width changes (e.g. the page number growing) trigger
				// a React re-render, which re-runs the renderToolbar event instead
				let iframe = reader._iframe;
				let observer = new iframe.documentGlobal.ResizeObserver(() => {
					let currentData = this._readerData.get(reader);
					if (currentData?.container?.isConnected) {
						this._updateOverflow(reader, currentData);
					}
				});
				observer.observe(iframe);
				data.resizeObserver = observer;
			}
		}

		_renderButtons(reader, container) {
			let options = this._getOptions(reader);
			let doc = container.ownerDocument;
			container.replaceChildren();
			if (!options.length) {
				return;
			}
			let data = this._readerData.get(reader);
			data.visibleCount = options.length;
			for (let option of options) {
				let button = doc.createElement("button");
				button.className = `toolbar-button ${ReaderToolbarRenderer.BUTTON_CLASS}`;
				button.classList.add(this._manager._getOptionMainKey(option));
				button.tabIndex = -1;
				if (option._menuTarget) {
					button.classList.add("toolbar-dropdown-button");
					button.addEventListener("click", () => {
						this._openPopup(reader, button, (popup, event) => {
							Zotero.MenuManager.updateMenuPopup(popup, option._menuTarget, {
								event,
								getContext: () => this._getContext(reader),
							});
						});
					});
				}
				else {
					button.addEventListener("click", () => {
						option.onCommand(this._getContext(reader));
					});
				}
				container.append(button);
				this._setButtonIcon(button, option);
			}

			let overflowButton = doc.createElement("button");
			overflowButton.className = `toolbar-button ${ReaderToolbarRenderer.BUTTON_CLASS}-overflow`;
			overflowButton.tabIndex = -1;
			overflowButton.addEventListener("click", () => {
				let visibleCount = this._readerData.get(reader)?.visibleCount ?? 0;
				let hiddenOptions = this._getOptions(reader).slice(visibleCount);
				this._openPopup(reader, overflowButton, (popup) => {
					this._manager.updateOverflowPopup(popup, hiddenOptions, {
						getContext: () => this._getContext(reader),
					});
				});
			});
			container.append(overflowButton);
			this._setOverflowIcon(overflowButton);

			this._setLocalizedTitles(reader, container, options);
			this._updateOverflow(reader, data);
		}

		_getContext(reader) {
			// No reader instance, matching the reader menubar menu context.
			// Tab readers can be resolved with Zotero.Reader.getByTabID(tabID);
			// a reader in a separate window has no tabID
			return {
				tabType: "reader",
				tabSubType: reader.type,
				tabID: reader.tabID,
				itemIDs: reader.itemID ? [reader.itemID] : [],
			};
		}

		/**
		 * Open a transient XUL popup in the outer (chrome) document, anchored
		 * to a toolbar button inside the reader iframe
		 */
		_openPopup(reader, anchorElem, populate) {
			let xulDoc = reader._iframe.ownerDocument;
			let popup = xulDoc.createXULElement("menupopup");
			(xulDoc.querySelector("popupset") || xulDoc.documentElement).appendChild(popup);
			popup.addEventListener("popupshowing", (event) => {
				if (event.target !== event.currentTarget) {
					return;
				}
				populate(popup, event);
			});
			popup.addEventListener("popuphidden", (event) => {
				if (event.target !== event.currentTarget) {
					return;
				}
				popup.remove();
			});
			popup.openPopup(anchorElem, "after_start", 0, 0, false, false);
		}

		/**
		 * Ensure the stylesheet is present in the reader document.
		 */
		_ensureStyle(doc) {
			if (this._styledDocs.has(doc)) {
				return;
			}
			let iconClass = ReaderToolbarRenderer.ICON_CLASS;
			let style = doc.createElement("style");
			style.textContent = `
				.${iconClass} {
					display: inline-block;
					background: var(--custom-button-icon-light) center/contain no-repeat;
					-moz-context-properties: fill;
					fill: currentColor;
				}
				:root[data-color-scheme="dark"] .${iconClass} {
					background-image: var(--custom-button-icon-dark);
				}
				@media (prefers-color-scheme: dark) {
					:root:not([data-color-scheme]) .${iconClass} {
						background-image: var(--custom-button-icon-dark);
					}
				}
			`;
			doc.head.appendChild(style);
			this._styledDocs.add(doc);
		}

		_createIcon(doc, lightURL, darkURL, size) {
			this._ensureStyle(doc);
			let icon = doc.createElement("span");
			icon.className = ReaderToolbarRenderer.ICON_CLASS;
			icon.style.width = `${size}px`;
			icon.style.height = `${size}px`;
			this._setIconURL(icon, "--custom-button-icon-light", lightURL);
			this._setIconURL(icon, "--custom-button-icon-dark", darkURL || lightURL);
			return icon;
		}

		_setIconURL(icon, prop, url) {
			let doc = icon.ownerDocument;
			let canLoad = true;
			try {
				Services.scriptSecurityManager.checkLoadURIStrWithPrincipal(
					doc.nodePrincipal, url, Ci.nsIScriptSecurityManager.ALLOW_CHROME);
			}
			catch {
				canLoad = false;
			}
			if (canLoad) {
				// The URLs are validated at registration (resolveImageURL)
				icon.style.setProperty(prop, `url("${url}")`);
				return;
			}
			this._getIconDataURI(url)
				.then(dataURI => icon.style.setProperty(prop, `url("${dataURI}")`))
				.catch(e => Zotero.logError(e));
		}

		_getIconDataURI(url) {
			let promise = this._iconDataURIs.get(url);
			if (!promise) {
				promise = new Promise((resolve, reject) => {
					let xhr = new XMLHttpRequest();
					xhr.open("GET", url);
					xhr.responseType = "blob";
					xhr.onload = () => {
						let reader = new FileReader();
						reader.onloadend = () => resolve(reader.result);
						reader.onerror = () => reject(new Error(`FileReader error for ${url}`));
						reader.readAsDataURL(xhr.response);
					};
					xhr.onerror = () => reject(new Error(`Failed to load icon ${url}`));
					xhr.send();
				});
				promise.catch(() => this._iconDataURIs.delete(url));
				this._iconDataURIs.set(url, promise);
			}
			return promise;
		}

		_setButtonIcon(button, option) {
			button.replaceChildren();
			if (option.icon || option.darkIcon) {
				button.append(this._createIcon(
					button.ownerDocument, option.icon || option.darkIcon, option.darkIcon, 20));
			}
			if (option._menuTarget) {
				button.append(this._createIcon(
					button.ownerDocument, ReaderToolbarRenderer.DROPMARKER_ICON_URL, null, 8));
			}
		}

		_setOverflowIcon(button) {
			button.replaceChildren(
				this._createIcon(button.ownerDocument, ReaderToolbarRenderer.OVERFLOW_ICON_URL, null, 16));
		}

		/**
		 * Set the button tooltips from the l10n IDs, resolved in the outer (chrome)
		 * document, where plugin FTL files are registered
		 */
		async _setLocalizedTitles(reader, container, options) {
			let xulDoc = reader._iframe.ownerDocument;
			let messages = [];
			try {
				messages = await xulDoc.l10n.formatMessages([
					...options.map(option => ({ id: option.l10nID })),
					{ id: "custom-buttons-overflow" },
				]);
			}
			catch (e) {
				Zotero.logError(e);
				return;
			}
			let buttons = Array.from(container.children);
			for (let i = 0; i < buttons.length; i++) {
				// Use `.tooltiptext` to match the XUL toolbarbutton
				let tooltip = messages[i]?.attributes?.find(attr => attr.name === "tooltiptext");
				if (tooltip?.value) {
					buttons[i].title = tooltip.value;
				}
			}
		}

		/**
		 * Collapse or expand buttons into/from the overflow dropdown.
		 */
		_updateOverflow(reader, data) {
			let { container } = data;
			if (!container?.isConnected) {
				return;
			}
			let doc = container.ownerDocument;
			// A closed reader's document outlives its window
			if (!doc.defaultView) {
				return;
			}
			let toolbarElem = doc.querySelector(".toolbar");
			if (!toolbarElem) {
				return;
			}
			let buttons = Array.from(container.children);
			let overflowButton = buttons.pop();
			if (!buttons.length) {
				return;
			}

			// Measure everything while visible.
			for (let elem of [...buttons, overflowButton]) {
				elem.style.display = "";
			}
			let widths = buttons.map(button => button.getBoundingClientRect().width);
			let chevronWidth = overflowButton.getBoundingClientRect().width;
			let currentWidth = container.getBoundingClientRect().width;

			let win = doc.defaultView;
			let style = win.getComputedStyle(toolbarElem);
			let padding = (parseFloat(style.paddingInlineStart) || 0)
				+ (parseFloat(style.paddingInlineEnd) || 0);
			let sectionsWidth = 0;
			for (let selector of [".start", ".center", ".end"]) {
				let section = toolbarElem.querySelector(`& > ${selector}`);
				if (section) {
					sectionsWidth += section.getBoundingClientRect().width;
				}
			}
			let slack = toolbarElem.clientWidth - padding - sectionsWidth;
			let budget = slack + currentWidth;

			let visibleCount = this._computeVisibleCount(
				widths, chevronWidth, budget, data.visibleCount, ReaderToolbarRenderer.BUTTON_GAP);
			data.visibleCount = visibleCount;

			buttons.forEach((button, i) => {
				button.style.display = i < visibleCount ? "" : "none";
			});
			overflowButton.style.display = visibleCount < buttons.length ? "" : "none";
		}

		/**
		 * Compute how many buttons fit in the available space. Buttons that don't fit
		 * are collapsed into the overflow dropdown button.
		 * @param {number[]} widths - The outer widths of all buttons, in order
		 * @param {number} chevronWidth - The outer width of the overflow button
		 * @param {number} budget - The width available for the whole button group
		 * @param {number} currentCount - The currently visible button count, for hysteresis
		 * @param {number} [gap] - The gap between buttons, if not included in the widths
		 * @returns {number} - The number of buttons to show
		 */
		_computeVisibleCount(widths, chevronWidth, budget, currentCount, gap = 0) {
			let total = widths.length;
			let requiredWidth = (n) => {
				let itemWidths = widths.slice(0, n);
				if (n < total) {
					itemWidths.push(chevronWidth);
				}
				if (!itemWidths.length) {
					return 0;
				}
				return itemWidths.reduce((sum, w) => sum + w, 0) + gap * (itemWidths.length - 1);
			};
			for (let n = total; n > 0; n--) {
				// Only expand if there's comfortably enough space, to avoid oscillation
				let buffer = n > currentCount ? ReaderToolbarRenderer.EXPAND_BUFFER : 0;
				if (requiredWidth(n) + buffer <= budget) {
					return n;
				}
			}
			return 0;
		}
	}


	/**
	 * Manages custom button APIs.
	 *
	 * @memberof Zotero
	 */
	Zotero.ButtonManager = {
		_buttonManager: new ButtonManagerInternal(),

		_readerRenderer: null,

		/**
		 * Register a custom button
		 * @param {ButtonOptions} options
		 * @returns {string | false}
		 */
		registerButton(options) {
			return this._buttonManager.register(options);
		},

		/**
		 * Unregister a custom button
		 * @param {string} buttonID
		 * @param {string} [_callerPluginID]
		 * @returns {boolean}
		 */
		unregisterButton(buttonID, _callerPluginID) {
			return this._buttonManager.unregister(buttonID, _callerPluginID);
		},

		/**
		 * Get the custom button data for a target type, optionally filtered to
		 * those enabled for a given tab type (see `enableForTabTypes`)
		 * @param {string} targetType
		 * @param {object} [options]
		 * @param {string} [options.tabType]
		 * @param {string} [options.tabSubType]
		 * @returns {ButtonOptions[]}
		 */
		getButtonOptions(targetType, options) {
			return this._buttonManager.getButtonOptions(targetType, options);
		},

		/**
		 * Update the dropdown popup of a custom button
		 * @param {XULPopupElement} popupElem
		 * @param {ButtonOptions} option
		 * @param {object} [args] - See Zotero.MenuManager.updateMenuPopup
		 */
		updateButtonPopup(popupElem, option, args) {
			if (!option._menuTarget) {
				return;
			}
			Zotero.MenuManager.updateMenuPopup(popupElem, option._menuTarget, args);
		},

		updateOverflowPopup(popupElem, options, args) {
			this._buttonManager.updateOverflowPopup(popupElem, options, args);
		},
	};

	Zotero.ButtonManager._readerRenderer
		= new ReaderToolbarRenderer(Zotero.ButtonManager._buttonManager);
	Zotero.ButtonManager._readerRenderer.init();

	lazy.ScopeVariables.setCustomParser(
		Zotero.ButtonManager.registerButton,
		({ pluginID, args }) => {
			lazy.ScopeVariables.assignTrustedArg(args, 0, "pluginID", pluginID);
		}
	);
	lazy.ScopeVariables.setCustomParser(
		Zotero.ButtonManager.unregisterButton,
		({ pluginID, args }) => {
			args[1] = pluginID;
		}
	);
}
