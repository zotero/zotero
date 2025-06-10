/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2025 Corporation for Digital Scholarship
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

	const VALID_TARGETS = [
		// Main window menubar menus
		"main/menubar/file",
		"main/menubar/edit",
		"main/menubar/view",
		"main/menubar/go",
		"main/menubar/tools",
		"main/menubar/help",
		// Main window library context menus
		"main/library/item",
		"main/library/collection",
		// Main window toolbar & file menu submenu: "Add attachment"
		"main/library/addAttachment",
		// Main window toolbar & file menu submenu: "New note"
		"main/library/addNote",
		// Main window tab context menus
		"main/tab",
		// Reader window menubar menus
		"reader/menubar/file",
		"reader/menubar/edit",
		"reader/menubar/view",
		"reader/menubar/go",
		"reader/menubar/window",
		// item pane context menus
		"itemPane/info/row",
		// notes pane add note buttons
		"notesPane/addItemNote",
		"notesPane/addStandaloneNote",
		// sidenav buttons
		"sidenav/locate",
	];

	const GROUPED_TARGETS = [
		"main/library/collection",
		"main/library/item",
	];

	const VALID_MENU_TYPES = [
		"menuitem",
		"separator",
		"submenu",
	];

	const CUSTOM_MENU_CLASS = "zotero-custom-menu-item";


	/**
	 * @typedef MenuData
	 * @type {object}
	 * @property {string} menuType - The type of the menu item
	 * @property {string} [l10nID] - The l10n ID for the menu item
	 * @property {object} [l10nArgs] - Arguments for the l10n ID
	 * @property {string} [icon] - The icon for the menu item
	 * - For menu icons, it is recommended to use an SVG icon with a size of 16x16.
	 * Use `fill="context-fill"` in the SVG to use the default icon color
	 * for automatic hover and dark mode support.
	 * @property {string} [darkIcon] - The dark icon for the menu item
	 * - If not provided, the light icon will be used for both light and dark mode.
	 * @property {string[]} [enableForTabTypes] - The type of tab for which the menu item should be enabled.
	 * Available types are "library", "reader/*", "reader/pdf", "reader/epub", "reader/snapshot",
	 * but other types are allowed as well for custom tab types.
	 * By default, the menu item is always enabled.
	 * Only for main window menubar menus and reader window menubar menus
	 * @property {function} [onShowing] - Function to run when the menu is about to be shown
	 * @property {function} [onShown] - Function to run when the menu is shown
	 * @property {function} [onHiding] - Function to run when the menu is about to be hidden
	 * @property {function} [onHidden] - Function to run when the menu is hidden
	 * @property {function} [onCommand] - Function to run when the menu is clicked
	 * @property {MenuData[]} [menus] - The menu items to add to the menu
	 *
	 * @typedef MenuOptions
	 * @type {object}
	 * @property {string} menuID - The unique ID of the menu
	 * @property {string} pluginID - The ID of the plugin registering the menu
	 * @property {string} target - The target for the menu
	 * @property {string[]} [l10nFiles] - The l10n files to load for the menu
	 * @property {MenuData[]} [menus] - The menu items to add to the menu
	 */


	class MenuManagerInternal extends PluginAPIBase {
		_menusTypeDefinition = {
			menuType: {
				type: "string",
				optional: false,
				checkHook: (value) => {
					if (!VALID_MENU_TYPES.includes(value)) {
						return `Option 'type' must be one of ${VALID_MENU_TYPES.join(", ")}, got ${value}`;
					}
					return true;
				}
			},
			l10nID: {
				type: "string",
				optional: true,
			},
			l10nArgs: {
				type: "object",
				optional: true,
			},
			icon: {
				type: "string",
				optional: true,
			},
			darkIcon: {
				type: "string",
				optional: true,
			},
			// Only for main window menubar menus
			enableForTabTypes: {
				type: "array",
				children: "string",
				optional: true,
			},
			onShowing: {
				type: "function",
				optional: true,
			},
			onShown: {
				type: "function",
				optional: true,
			},
			onHiding: {
				type: "function",
				optional: true,
			},
			onHidden: {
				type: "function",
				optional: true,
			},
			onCommand: {
				type: "function",
				optional: true,
			},
			// Only required for submenus. Type check will be done in the _validate function
			menus: {
				type: "array",
				optional: true,
			},
		};

		constructor() {
			super();
			this.config = {
				apiName: "MenuAPI",
				mainKeyName: "menuID",
				// Disable refresh, as updates should be applied the next time the menu is shown
				notifyType: false,
				optionTypeDefinition: {
					menuID: "string",
					pluginID: "string",
					target: {
						type: "string",
						optional: false,
						checkHook: (value) => {
							if (!VALID_TARGETS.includes(value)) {
								return `Option 'target' must be one of ${VALID_TARGETS.join(", ")}, got ${value}`;
							}
							return true;
						}
					},
					// l10nFiles: {
					// 	type: "array",
					// 	optional: true,
					// 	children: "string",
					// },
					// Type check will be done in the _validate function for nested menus
					menus: {
						type: "array",
						optional: false,
					}
				},
			};
		}

		/**
		 * Validate the menu options, overriding the base method to validate `menus` recursively
		 * @param {MenuOptions} option - The menu options to validate
		 */
		_validate(option) {
			option = super._validate(option);

			if (!option) {
				return false;
			}

			if (option.menus?.length === 0) {
				this._log("Invalid menu: 'menus' property must not be empty", "warn");
				return false;
			}

			// For automatic grouping, top-level separators are not allowed
			if (GROUPED_TARGETS.includes(option.target)) {
				if (option.menus.find(menu => menu.menuType === "separator")) {
					this._log(`Invalid menu: top-level separators are not allowed for target ${option.target}`, "warn");
					return false;
				}
			}

			// Validate nested menus recursively
			for (let i = 0; i < option.menus.length; i++) {
				let result = this._validateMenuData(option.menus[i], `menus[${i}]`);
				if (!result.valid) {
					return false;
				}
				option.menus[i] = result.obj;
			}
			return option;
		}

		/**
		 * Validate the menu data recursively
		 * @param {MenuData} menuData - The menu data to validate
		 * @param {string} [path] - The path to the menu data
		 * @returns {{obj?: MenuData, valid: boolean}} - The validated menu data and whether it is valid
		 */
		_validateMenuData(menuData, path = "") {
			// Validate the menu data itself
			let selfResult = this._validateObject(menuData, this._menusTypeDefinition, path);
			if (!selfResult.valid) {
				return {
					valid: false,
				};
			}
			menuData = selfResult.obj;

			// Add unique key to the menu data
			menuData._key = `zotero-custom-menu-${this._generateRandomKey()}`;

			// Only check for submenu type here, as submenus can have nested menus
			if (menuData?.menuType !== "submenu") {
				return {
					obj: menuData,
					valid: true,
				};
			}
			// Submenu must have a 'menus' property
			if (!menuData.menus) {
				this._log(`Invalid submenu: ${path} missing 'menus' property`, "warn");
				return {
					valid: false,
				};
			}
			for (let i = 0; i < menuData.menus.length; i++) {
				let menuResult = this._validateMenuData(menuData.menus[i], `${path}.menus[${i}]`);
				if (!menuResult.valid) {
					return {
						valid: false,
					};
				}
				menuData.menus[i] = menuResult.obj;
			}
			return {
				obj: menuData,
				valid: true,
			};
		}

		_unregisterByPluginID(pluginID) {
			let removedKeys = super._unregisterByPluginID(pluginID);
			if (!removedKeys) {
				return [];
			}
			// Remove all custom menu items from the main window and reader window
			let enumerator = Services.wm.getEnumerator("zotero:reader");
			let windows = [];
			while (enumerator.hasMoreElements()) {
				windows.push(enumerator.getNext());
			}
			windows.push(...Zotero.getMainWindows());
			for (let window of windows) {
				// Remove all custom menu items that match the removed keys
				// The query selector is like ".CUSTOM_MENU_CLASS:is(.key1, .key2, .key3)"
				window.document.querySelectorAll(`.${CUSTOM_MENU_CLASS}:is(.${removedKeys.join(", .")})`)
					.forEach(elem => elem.remove());
			}
			return removedKeys;
		}

		/**
		 * Get the custom menu data for a target type
		 * @param {string} targetType - The target type of the menu
		 * @returns {MenuOptions[]} - The custom menu data for the target type
		 */
		getCustomMenuOptions(targetType) {
			return this.options
				.filter(option => option.target === targetType)
				// Sort to ensure consistent ordering
				.sort((a, b) => this._getOptionMainKey(a).localeCompare(this._getOptionMainKey(b)));
		}

		/**
		 * Update the popup element with the custom menu items for the target type
		 * @param {XULPopupElement} popupElem - The popup element to update
		 * @param {MenuData[]} menus - An array of menu data
		 * @param {string} targetType - The target type of the menu
		 * @param {object} [args] - Additional options
		 * @param {Event} [args.event] - The event that triggered the menu creation
		 * Since when the menus are updated, the popupshowing event is already fired,
		 * we manually pass the event to the hooks to allow the plugins to access it
		 * @param {function} [args.getContext] - The function to get the context object for the menu
		 * @param {string} [args.tabType] - The type of the tab, only for main window menubar menus
		 * @param {string} [args.tabSubType] - The subtype of the tab/reader type, only for main window menubar menus and reader window menubar menus
		 * @param {boolean} [args.skipGrouping] - Whether to skip grouping the menus
		 */
		updateMenuPopup(popupElem, menus, targetType, args = {}) {
			let { event, getContext, tabType, tabSubType, skipGrouping } = args;

			if (!menus || menus.length === 0) {
				// If no menus are provided, clear the popup and return
				let toRemove = Array.from(popupElem.querySelectorAll(
					`& > .${CUSTOM_MENU_CLASS}`
				));
				for (let elem of toRemove) {
					elem.remove();
				}
				return;
			}
			
			// let win = popupElem.ownerGlobal;
			// let doc = popupElem.ownerDocument;

			// TODO: maybe we can let plugins to load their own l10n files in onShowing,
			// because otherwise we'll have to manage the l10n files unload when unregistering
			// if (menuData.l10nFiles?.length > 0) {
			// 	// Load l10n files
			// 	for (let l10nFile of menuData.l10nFiles) {
			// 		win.MozXULElement.insertFTLIfNeeded(l10nFile);
			// 	}
			// }

			if (!skipGrouping) {
				// Group menus if needed
				menus = this._groupMenus(popupElem, targetType, menus);
			}

			// Remove no longer existing menu items
			let toRemove = Array.from(popupElem.querySelectorAll(
				// Construct the query selector like ".CUSTOM_MENU_CLASS:not(.key1):not(.key2):not(.key3)"
				`& > .${CUSTOM_MENU_CLASS}${menus.map(menu => `:not(.${menu._key})`).join("")}`
			));
			for (let elem of toRemove) {
				elem.remove();
			}

			// Add custom menu items
			for (let menuData of menus) {
				this._initMenu(menuData, popupElem, targetType, {
					event,
					getContext,
					tabType,
					tabSubType,
				});
			}
		}

		/**
		 * Initialize the menu element
		 * @param {MenuData} menuData - The menu data to create the element
		 * @param {XULPopupElement} popupElem - The popup element to which the menu item should be added
		 * @param {string} targetType - The target type of the menu
		 * @param {object} args - Additional options
		 * @param {Event} [args.event] - The event that triggered the menu creation
		 * @param {function} [args.getContext] - The function to get the context object for the menu
		 * @param {string} [args.tabType] - The type of the tab, only for main window menubar menus
		 * @param {string} [args.tabSubType] - The subtype of the tab/reader type,
		 * only for main window menubar menus and reader window menubar menus
		 * @returns {XULElement} - The created menu element
		 */
		_initMenu(menuData, popupElem, targetType, args) {
			let { event, getContext, tabType, tabSubType } = args;
			let doc = popupElem.ownerDocument;
			let menuElem = popupElem.querySelector(`& > .${CUSTOM_MENU_CLASS}.${menuData._key}`);
			let subPopupElem;

			// Initialize submenu popup element if it exists
			if (menuElem) {
				subPopupElem = menuElem.querySelector("& > menupopup");
				if (menuData.menuType === "submenu" && !subPopupElem) {
					// If the menu doesn't have a popup, it's not usable
					menuElem.remove();
					menuElem = null;
				}
			}

			// Create the menu element if it doesn't exist
			if (!menuElem) {
				switch (menuData.menuType) {
					case "menuitem": {
						menuElem = doc.createXULElement("menuitem");
						break;
					}
					case "separator": {
						menuElem = doc.createXULElement("menuseparator");
						break;
					}
					case "submenu": {
						menuElem = doc.createXULElement("menu");
						subPopupElem = doc.createXULElement("menupopup");
						menuElem.appendChild(subPopupElem);
						break;
					}
				}
				menuElem.classList.add(CUSTOM_MENU_CLASS, menuData._key);

				// Init label and icon for non-separator menu items
				if (menuData.menuType !== "separator") {
					if (menuData.l10nID) {
						menuElem.dataset.l10nId = menuData.l10nID;
					}
					if (menuData.l10nArgs) {
						menuElem.dataset.l10nArgs = JSON.stringify(menuData.l10nArgs);
					}
					if (menuData.icon || menuData.darkIcon) {
						if (menuData.menuType === "menuitem") {
							menuElem.classList.add("menuitem-iconic");
						}
						else if (menuData.menuType === "submenu") {
							menuElem.classList.add("menu-iconic");
						}
						menuElem.style.setProperty("--custom-menu-icon-light", `url(${menuData.icon})`);
						// Use the dark icon if available, otherwise use the light icon
						menuElem.style.setProperty("--custom-menu-icon-dark", `url(${menuData.darkIcon || menuData.icon})`);
					}
				}
			}

			this._updateMenuClasses(menuElem, menuData, targetType, { tabType, tabSubType });

			this._updateMenuEvents(menuElem, popupElem, menuData, targetType, {
				event,
				getContext,
				subPopupElem,
				tabType,
				tabSubType,
			});
		}

		/**
		 * Update the menu element classes
		 * @param {XULElement} menuElem - The menu element to update
		 * @param {MenuData} menuData - The menu data to update the element
		 * @param {string} targetType - The target type of the menu
		 * @param {object} args - Additional options
		 * @param {string} [args.tabType] - The type of the tab, only for main window menubar menus
		 * @param {string} [args.tabSubType] - The subtype of the tab/reader type, only
		 * for main window menubar menus and reader window menubar menus
		 * @returns {void}
		 */
		_updateMenuClasses(menuElem, menuData, targetType, args) {
			let { tabType, tabSubType } = args;
			// Update dynamic classes of the menu item
			let cachedDynamicClasses = new Set();

			// Init the menu based on the content type for main window tabs and reader window
			if ((targetType.startsWith("main/menubar") || targetType.startsWith("reader/menubar"))
					&& menuData.enableForTabTypes) {
				// argument tabType and tabSubType are not empty
				let shouldHide = true;
				for (let type of menuData.enableForTabTypes) {
					let [_tabType, _tabSubType] = type.split("/");

					// Only show the menu item if the tab type matches
					cachedDynamicClasses.add(`menu-type-${_tabType}`);

					if (_tabSubType) {
						if (_tabType === "reader" && _tabSubType === "*") {
							// Show the menu item for all reader types
							cachedDynamicClasses.add("pdf");
							cachedDynamicClasses.add("epub");
							cachedDynamicClasses.add("snapshot");
						}
						else {
							// Only show the menu item if the tab subtype (reader type) matches
							cachedDynamicClasses.add(_tabSubType);
						}
					}

					if (shouldHide
							&& tabType === _tabType
							&& (_tabSubType === "*" || tabSubType === _tabSubType)) {
						shouldHide = false;
					}
				}
				if (shouldHide) {
					menuElem.hidden = true;
				}
			}

			// Remove previous dynamic classes
			if (menuElem.dataset.dynamicClasses) {
				let previousDynamicClasses = menuElem.dataset.dynamicClasses.split(",");
				for (let dynamicClass of previousDynamicClasses) {
					if (dynamicClass && !cachedDynamicClasses.has(dynamicClass)) {
						menuElem.classList.remove(dynamicClass);
					}
				}
			}
			// Add new dynamic classes
			for (let dynamicClass of cachedDynamicClasses) {
				menuElem.classList.add(dynamicClass);
			}
			menuElem.dataset.dynamicClasses = Array.from(cachedDynamicClasses).join(",");
		}

		/**
		 * Update the menu events and submenus
		 * @param {XULElement} menuElem - The menu element to update
		 * @param {XULPopupElement} popupElem - The popup element to which the menu item should be added
		 * @param {MenuData} menuData - The menu data to update the element
		 * @param {string} targetType - The target type of the menu
		 * @param {object} args - Additional options
		 * @param {XULPopupElement} [args.subPopupElem] - The submenu popup element
		 * @param {Event} [args.event] - The event that triggered the menu creation
		 * @param {function} [args.getContext] - The function to get the context object for the menu
		 * @param {string} [args.tabType] - The type of the tab, only for main window menubar menus
		 * @param {string} [args.tabSubType] - The subtype of the tab/reader type, only
		 * for main window menubar menus and reader window menubar menus
		 * @returns {void}
		 */
		_updateMenuEvents(menuElem, popupElem, menuData, targetType, args) {
			let { tabType, tabSubType, event, getContext, subPopupElem } = args;
			// Init hooks
			const HOOK_MAP = {
				// Since this is triggered by the popupshowing event, it's too late to add listener for it
				// instead, we run the onShowing hook after the menu item is added to the popup
				// popupshowing: "onShowing",
				popupshown: "onShown",
				popuphiding: "onHiding",
				popuphidden: "onHidden",
			};
			if (!event) {
				// If there's no event passed (e.g. submenus), add the popupshowing hook
				HOOK_MAP.popupshowing = "onShowing";
			}

			// Keep a weak reference to the menu element to avoid memory leaks
			let menuElemRef = new WeakRef(menuElem);

			// Wrap getContext to include the default context variables
			let defaultContext = {
				get menuElem() {
					return menuElemRef.deref();
				},
				setL10nArgs: (l10nArgs) => {
					let _menuElem = menuElemRef.deref();
					if (!_menuElem) {
						return;
					}
					_menuElem.dataset.l10nArgs = l10nArgs;
				},
				setEnabled: (enabled) => {
					let _menuElem = menuElemRef.deref();
					if (!_menuElem) {
						return;
					}
					_menuElem.disabled = !enabled;
				},
				setVisible: (visible) => {
					let _menuElem = menuElemRef.deref();
					if (!_menuElem) {
						return;
					}
					_menuElem.hidden = !visible;
				},
				setIcon: (icon, darkIcon) => {
					let _menuElem = menuElemRef.deref();
					if (!_menuElem) {
						return;
					}
					_menuElem.style.setProperty("--custom-menu-icon-light", `url(${icon})`);
					// Use the dark icon if available, otherwise use the light icon
					_menuElem.style.setProperty("--custom-menu-icon-dark", `url(${darkIcon || icon})`);
				},
			};
			let wrappedGetContext = () => {
				return Object.assign({}, defaultContext, getContext ? getContext() : {});
			};

			// Add hooks
			for (let [eventName, hookName] of Object.entries(HOOK_MAP)) {
				this._addMenuHook(popupElem, eventName, menuData, hookName, wrappedGetContext);
			}

			if (menuData.onCommand) {
				let menuCommandListener = (ev) => {
					if (ev.target !== ev.currentTarget) {
						return;
					}
					menuData.onCommand(ev, wrappedGetContext());
				};
				menuElem.addEventListener("command", menuCommandListener, {
					once: true,
				});
				let removeMenuCommandListener = (ev) => {
					if (ev.target !== ev.currentTarget) {
						return;
					}
					menuElem.removeEventListener("command", menuCommandListener);
					ev.target.removeEventListener("popuphidden", removeMenuCommandListener);
				};
				popupElem.addEventListener("popuphidden", removeMenuCommandListener);
			}

			// Init submenus
			if (menuData.menuType === "submenu" && menuData.menus) {
				let subMenuInitListener = (ev) => {
					if (ev.target !== ev.currentTarget) {
						return;
					}
					this.updateMenuPopup(ev.target, menuData.menus, targetType, {
						event: ev,
						getContext: wrappedGetContext,
						tabType,
						tabSubType,
						// Skip grouping for submenus
						skipGrouping: true,
					});
				};
				subPopupElem.addEventListener("popupshowing", subMenuInitListener);
				let removeSubMenuInitListener = (ev) => {
					if (ev.target !== ev.currentTarget) {
						return;
					}
					subPopupElem.removeEventListener("popupshowing", subMenuInitListener);
					ev.target.removeEventListener("popuphidden", removeSubMenuInitListener);
				};
				popupElem.addEventListener("popuphidden", removeSubMenuInitListener);
			}

			popupElem.appendChild(menuElem);

			// Run the onShowing hook after the menu item is created to the popup if needed
			if (event && menuData.onShowing) {
				menuData.onShowing(event, wrappedGetContext());
			}
		}

		_addMenuHook(popupElem, eventName, menuData, hookName, getContext) {
			if (!menuData[hookName]) {
				return;
			}
			popupElem.addEventListener(eventName, (ev) => {
				if (ev.target !== ev.currentTarget) {
					return;
				}
				menuData[hookName](ev, getContext());
			}, {
				// The lifecycle hooks are always recreated when the menu is updated, only run once
				once: true,
			});
		}

		/**
		 * Group the menus if needed
		 * @param {XULPopupElement} popupElem - The popup element to which the menu items should be added
		 * @param {string} targetType - The target type of the menu
		 * @param {MenuData[]} menus - The menu data for the target type
		 * @returns {MenuData[]} - The grouped menu data
		 */
		_groupMenus(popupElem, targetType, menus) {
			if (!GROUPED_TARGETS.includes(targetType)) {
				return menus;
			}

			if (menus.length === 0) {
				return [];
			}

			let groupedMenus = [];
			// Add separator
			groupedMenus.push({
				menuType: "separator",
				_key: "zotero-custom-menu-group-separator",
			});
			
			let ungroupedCount = this._computeAvailableMenuNum(popupElem);

			if (ungroupedCount >= menus.length) {
				// If all menus can be shown, show them without grouping
				groupedMenus.push(...menus);
				return groupedMenus;
			}

			// Show the first ungroupedCount menus
			groupedMenus.push(...menus.slice(0, ungroupedCount));

			// Group the remaining menus
			groupedMenus.push({
				menuType: "submenu",
				l10nID: "menu-custom-group-submenu",
				_key: "zotero-custom-menu-group-submenu",
				menus: [...menus.slice(ungroupedCount)],
			});
			return groupedMenus;
		}

		/**
		 * Compute the number of available menus that can be shown in the popup
		 * @param {XULPopupElement} popupElem - The popup element to compute the available menu count
		 * @returns {number} - The number of available menus
		 */
		_computeAvailableMenuNum(popupElem) {
			// Compute the height of current screen
			let screenHeight = popupElem.ownerGlobal.screen.availHeight;
			let maxMenuHeight = screenHeight * 0.8;

			let menuCount = popupElem.querySelectorAll(`& > :is(menuitem, menu):not(.${CUSTOM_MENU_CLASS}):not([hidden=true])`).length;
			// An additional separator is added before the group
			let separatorCount = popupElem.querySelectorAll(`& > menuseparator:not(.${CUSTOM_MENU_CLASS}):not([hidden=true])`).length + 1;

			let menuHeight, separatorHeight, popupPadding;

			if (Zotero.isMac) {
				menuHeight = 22;
				separatorHeight = 11;
				popupPadding = 5 * 2;
			}

			if (Zotero.isWin) {
				menuHeight = 26;
				separatorHeight = 9;
				popupPadding = 4 * 2;
			}

			// For Linux, we only roughly estimate the height, as it varies a lot
			if (Zotero.isLinux) {
				menuHeight = 24;
				separatorHeight = 9;
				popupPadding = 4 * 2;
			}

			let availableHeight = maxMenuHeight - popupPadding
				- separatorHeight * separatorCount
				- menuHeight * menuCount;

			// The grouped menus do not have top-level separators
			let availableMenuCount = Math.floor(availableHeight / menuHeight);
			return availableMenuCount;
		}
	}


	class MenuManager {
		_menuManager = new MenuManagerInternal();

		registerMenu(options) {
			return this._menuManager.register(options);
		}

		unregisterMenu(paneID) {
			return this._menuManager.unregister(paneID);
		}

		updateMenuPopup(popupElem, targetType, args) {
			let options = this._menuManager.getCustomMenuOptions(targetType);
			// Flatten the menus array
			let menus = [];
			for (let option of options) {
				menus.push(...option.menus);
			}
			this._menuManager.updateMenuPopup(popupElem, menus, targetType, args);
		}
	}


	Zotero.MenuManager = new MenuManager();
}
