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
		// Main window tab context menus - NOT IMPLEMENTED YET
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
				this._log(`Invalid menu: ${option} - 'menus' property must not be empty`, "warn");
				return false;
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

			// Only check for submenu type here, as submenus can have nested menus
			if (menuData?.menuType !== "submenu") {
				return {
					obj: menuData,
					valid: true,
				};
			}
			// Submenu must have a 'menus' property
			if (!menuData.menus) {
				this._log(`Invalid submenu: ${menuData} - missing 'menus' property`, "warn");
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
		_getCustomMenuOptions(targetType) {
			return this.options
				.filter(option => option.target === targetType)
				// Sort to ensure consistent ordering
				.sort((a, b) => this._getOptionMainKey(a).localeCompare(this._getOptionMainKey(b)));
		}

		/**
		 * Update the popup element with the custom menu items for the target type
		 * @param {XULPopupElement} popupElem - The popup element to update
		 * @param {string} targetType - The target type of the menu
		 * @param {object} [args] - Additional options
		 * @param {Event} [args.event] - The event that triggered the menu creation
		 * Since when the menus are updated, the popupshowing event is already fired,
		 * we manually pass the event to the hooks to allow the plugins to access it
		 * @param {function} [args.getContext] - The function to get the context object for the menu
		 * @param {string} [args.tabType] - The type of the tab, only for main window menubar menus
		 * @param {string} [args.tabSubType] - The subtype of the tab/reader type, only for main window menubar menus and reader window menubar menus
		 */
		updateMenuPopup(popupElem, targetType, args = {}) {
			let { event, getContext, tabType, tabSubType } = args;
			let options = this._getCustomMenuOptions(targetType);
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

			// Remove all existing custom menu items
			let customMenuItems = Array.from(popupElem.querySelectorAll(`.${CUSTOM_MENU_CLASS}`));
			for (let item of customMenuItems) {
				item.remove();
			}

			// Add custom menu items
			for (let option of options) {
				// TODO: maybe we want to add a separator before and after the menu group
				for (let menuData of option.menus) {
					this._createMenu(menuData, popupElem, this._getOptionMainKey(option), targetType, event, getContext, tabType, tabSubType);
				}
			}
		}

		/**
		 * Initialize the menu element
		 * @param {MenuData} menuData - The menu data to create the element
		 * @param {XULPopupElement} popupElem - The popup element to which the menu item should be added
		 * @param {string} menuID - The unique ID of the menu
		 * @param {string} targetType - The target type of the menu
		 * @param {Event & null} event - The event that triggered the menu creation
		 * @param {function} getContext - The function to get the context object for the menu
		 * @param {string} [tabType] - The type of the tab
		 * @param {string} [tabSubType] - The subtype of the tab/reader type
		 * @returns {XULElement} - The created menu element
		 */
		_createMenu(menuData, popupElem, menuID, targetType, event, getContext, tabType, tabSubType) {
			let doc = popupElem.ownerDocument;
			let menuElem;
			let subPopupElem;
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
			menuElem.classList.add(CUSTOM_MENU_CLASS, menuID);

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

			// Init the menu based on the content type for main window tabs and reader window
			if ((targetType.startsWith("main/menubar") || targetType.startsWith("reader/menubar"))
					&& menuData.enableForTabTypes) {
				// argument tabType and tabSubType are not empty
				let shouldHide = true;
				for (let type of menuData.enableForTabTypes) {
					let [_tabType, _tabSubType] = type.split("/");
					// Only show the menu item if the tab type matches
					menuElem.classList.add(`menu-type-${_tabType}`);
					if (_tabSubType) {
						if (_tabType === "reader" && _tabSubType === "*") {
							// Show the menu item for all reader types
							menuElem.classList.add("pdf", "epub", "snapshot");
						}
						else {
							// Only show the menu item if the tab subtype (reader type) matches
							menuElem.classList.add(_tabSubType);
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

			// Keep a reference to the menu element to avoid memory leaks
			let menuElemRef = new WeakRef(menuElem);

			// Wrap getContext to include the default context variables
			let defaultContext = {
				menuID,
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
				return Object.assign({}, defaultContext, getContext());
			};

			// Add hooks
			for (let [eventName, hookName] of Object.entries(HOOK_MAP)) {
				this._addMenuHook(popupElem, eventName, menuData, hookName, wrappedGetContext);
			}

			if (menuData.onCommand) {
				menuElem.addEventListener("command", (ev) => {
					if (ev.target !== menuElem) {
						return;
					}
					menuData.onCommand(ev, wrappedGetContext());
				});
			}

			// Init submenus
			if (menuData.menuType === "submenu" && menuData.menus) {
				for (let submenuData of menuData.menus) {
					this._createMenu(submenuData, subPopupElem, menuID, targetType, null, wrappedGetContext, tabType, tabSubType);
				}
			}

			popupElem.appendChild(menuElem);

			// Run the onShowing hook after the menu item is added to the popup if needed
			if (event && menuData.onShowing) {
				menuData.onShowing(event, wrappedGetContext());
			}

			return menuElem;
		}

		_addMenuHook(popupElem, eventName, menuData, hookName, getContext) {
			if (!menuData[hookName]) {
				return;
			}
			popupElem.addEventListener(eventName, (ev) => {
				if (ev.target !== popupElem) {
					return;
				}
				menuData[hookName](ev, getContext());
			}, {
				once: true,
			});
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
			this._menuManager.updateMenuPopup(popupElem, targetType, args);
		}
	}


	Zotero.MenuManager = new MenuManager();
}
