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
		PluginAPIBase: "chrome://zotero/content/xpcom/pluginAPI/pluginAPIBase.mjs",
		ScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		WindowScopeVariables: "chrome://zotero/content/xpcom/plugins/variables.mjs",
		PluginProtocol: "chrome://zotero/content/xpcom/plugins/protocol.mjs",
		PluginSandbox: "chrome://zotero/content/xpcom/plugins/sandbox.mjs",
		VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
		resolvePluginPage: "chrome://zotero/content/xpcom/plugins/utils.mjs",
		loadEmbeddedPluginPage: "chrome://zotero/content/xpcom/plugins/embeddedPage.mjs",
	});

	// Section targets map to the reader's `render*` events; the reader toolbar is
	// excluded (use Zotero.ButtonManager "reader/toolbar").
	const SECTION_EVENTS = {
		textSelectionPopup: "renderTextSelectionPopup",
	};
	const SECTION_EVENT_TO_TARGET = Object.fromEntries(
		Object.entries(SECTION_EVENTS).map(([target, event]) => [event, target])
	);

	// Context-menu targets map to the reader's `create*ContextMenu` events. Each
	// is a menu the plugin contributes data-only items to.
	const CONTEXT_MENU_EVENTS = {
		colorContextMenu: "createColorContextMenu",
		viewContextMenu: "createViewContextMenu",
		annotationContextMenu: "createAnnotationContextMenu",
		thumbnailContextMenu: "createThumbnailContextMenu",
		selectorContextMenu: "createSelectorContextMenu",
	};
	const CONTEXT_MENU_EVENT_TO_TARGET = Object.fromEntries(
		Object.entries(CONTEXT_MENU_EVENTS).map(([target, event]) => [event, target])
	);

	const CUSTOM_SECTION_CLASS = "zotero-reader-custom-section";

	/**
	 * @namespace Zotero
	 */

	/**
	 * @typedef ReaderContext
	 * @type {object}
	 * @property {number} [itemID] - The itemID of the reader's attachment. Load it
	 * with `Zotero.Items.get()`
	 * @property {string} [tabID] - The reader tab ID, or undefined for a reader in
	 * a separate window
	 * @property {string} [type] - The reader type: "pdf", "epub", or "snapshot"
	 * @property {object} [params] - Event parameters, e.g. `{ annotation }` for
	 * annotation-scoped sections and menus
	 */

	/**
	 * @typedef ReaderSectionOptions
	 * @type {object}
	 * @property {string} sectionID - The unique ID of the section
	 * @property {string} pluginID - The ID of the plugin registering the section
	 * @property {string} target - The section location: "textSelectionPopup".
	 * For the reader toolbar, use `Zotero.ButtonManager` with target "reader/toolbar"
	 * @property {string} src - An `.html` page within the plugin, hosted in an
	 * iframe; same-origin with the plugin but unable to reach the reader's DOM.
	 * The iframe follows the page's own height, and its width when the page
	 * styles an explicit root width (e.g. `html { width: 300px }`), capped
	 * relative to the reader view
	 * @property {function} [onRender] - Called with a `ReaderContext` and a `page`
	 * messenger once the page loads; see `PluginPageChannel` (plugins/pageChannel.mjs)
	 */

	/**
	 * @typedef ReaderContextMenuItemOptions
	 * @type {object}
	 * @property {string} menuItemID - The unique ID of the menu item
	 * @property {string} pluginID - The ID of the plugin registering the item
	 * @property {string} target - The menu, one of "colorContextMenu",
	 * "viewContextMenu", "annotationContextMenu", "thumbnailContextMenu", "selectorContextMenu"
	 * @property {string} label - The menu item label
	 * @property {string} [icon] - The icon URL, a data:image/svg+xml URI or a
	 * plugin resource URL
	 * @property {function} onCommand - Called with a `ReaderContext` when the item
	 * is clicked
	 * @property {function} [onShowing] - Called with a `ReaderContext` before the menu
	 * shows; return `false` to hide the item, or `{ label, disabled }` to override them
	 */


	// Shared safety check: an unprivileged plugin's icon must be a declared
	// resource (data:image/svg or its own moz-extension/chrome/resource URL).
	function iconAllowed(pluginID, url) {
		let scope = lazy.PluginSandbox.getScope(pluginID);
		if (!scope || lazy.VarCheck.isPrivilegedScope(scope)) {
			return true;
		}
		let base = lazy.PluginProtocol.getBaseURI(pluginID);
		return !lazy.WindowScopeVariables.isDisallowedResourceURL(url, pluginID, base);
	}


	class ReaderSectionManagerInternal extends lazy.PluginAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "ReaderSectionAPI",
				mainKeyName: "sectionID",
				notifyType: false,
				optionTypeDefinition: {
					sectionID: "string",
					pluginID: "string",
					target: {
						type: "string",
						optional: false,
						checkHook: (value) => {
							if (SECTION_EVENTS[value]) {
								return true;
							}
							return `Option 'target' must be one of ${Object.keys(SECTION_EVENTS).join(", ")}, got ${value}`;
						},
					},
					src: "string",
					onRender: {
						type: "function",
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
			// Resolve the src to the plugin's own .html page; reject anything else
			let url = lazy.resolvePluginPage(option.pluginID, option.src);
			if (!url) {
				this._log(`Invalid section: 'src' must be an .html page within the plugin, got ${option.src}`, "warn");
				return false;
			}
			option._url = url;
			return option;
		}

		_convert(option) {
			option = super._convert(option);
			if (option.onRender) {
				option.onRender = lazy.ScopeVariables.fromScope(option.onRender, option.pluginID);
			}
			return option;
		}

		getByTarget(target) {
			return this.options.filter(option => option.target === target);
		}
	}


	class ReaderContextMenuManagerInternal extends lazy.PluginAPIBase {
		constructor() {
			super();
			this.config = {
				apiName: "ReaderContextMenuAPI",
				mainKeyName: "menuItemID",
				notifyType: false,
				optionTypeDefinition: {
					menuItemID: "string",
					pluginID: "string",
					target: {
						type: "string",
						optional: false,
						checkHook: (value) => {
							if (CONTEXT_MENU_EVENTS[value]) {
								return true;
							}
							return `Option 'target' must be one of ${Object.keys(CONTEXT_MENU_EVENTS).join(", ")}, got ${value}`;
						},
					},
					label: "string",
					icon: {
						type: "string",
						optional: true,
					},
					onCommand: "function",
					onShowing: {
						type: "function",
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
			if (option.icon !== undefined && !iconAllowed(option.pluginID, option.icon)) {
				this._log(`Invalid context menu item: 'icon' is not an allowed resource URL`, "warn");
				return false;
			}
			return option;
		}

		_convert(option) {
			option = super._convert(option);
			option.onCommand = lazy.ScopeVariables.fromScope(option.onCommand, option.pluginID);
			if (option.onShowing) {
				option.onShowing = lazy.ScopeVariables.fromScope(option.onShowing, option.pluginID);
			}
			return option;
		}

		getByTarget(target) {
			return this.options.filter(option => option.target === target);
		}
	}


	/**
	 * Manages reader plugin APIs: sections that host a plugin page in a reader UI
	 * part, and items contributed to reader context menus.
	 *
	 * @memberof Zotero
	 */
	Zotero.ReaderManager = {
		_sectionManager: new ReaderSectionManagerInternal(),

		_contextMenuManager: new ReaderContextMenuManagerInternal(),

		/**
		 * Register a custom reader section. Its body is the plugin's own `src` page in
		 * an iframe that follows the page's own size; `onRender` hands over a `page` messenger.
		 * @param {ReaderSectionOptions} options
		 * @returns {string | false} - The section ID, or false if invalid
		 *
		 * @example
		 * ```javascript
		 * Zotero.ReaderManager.registerSection({
		 * 	sectionID: 'my-popup',
		 * 	target: 'textSelectionPopup',
		 * 	src: 'popup.html',
		 * 	onRender: ({ page, params }) => {
		 * 		page.sendMessage({ text: params.annotation.text });
		 * 		page.addMessageListener((data) => Zotero.debug('from page: ' + data));
		 * 	},
		 * });
		 * ```
		 */
		registerSection(options) {
			return this._sectionManager.register(options);
		},

		/**
		 * Unregister a custom reader section.
		 * @param {string} sectionID - The value returned by `registerSection`
		 * @param {string} [_callerPluginID]
		 * @returns {boolean}
		 */
		unregisterSection(sectionID, _callerPluginID) {
			return this._sectionManager.unregister(sectionID, _callerPluginID);
		},

		/**
		 * Register a custom reader context-menu item.
		 * @param {ReaderContextMenuItemOptions} options
		 * @returns {string | false} - The menu item ID, or false if invalid
		 *
		 * @example
		 * ```javascript
		 * Zotero.ReaderManager.registerContextMenuItem({
		 * 	menuItemID: 'my-item',
		 * 	target: 'annotationContextMenu',
		 * 	label: 'Do something',
		 * 	onCommand: ({ params }) => {
		 * 		Zotero.debug('Annotations: ' + params.ids.join(', '));
		 * 	},
		 * });
		 * ```
		 */
		registerContextMenuItem(options) {
			return this._contextMenuManager.register(options);
		},

		/**
		 * Unregister a custom reader context-menu item.
		 * @param {string} menuItemID - The value returned by `registerContextMenuItem`
		 * @param {string} [_callerPluginID]
		 * @returns {boolean}
		 */
		unregisterContextMenuItem(menuItemID, _callerPluginID) {
			return this._contextMenuManager.unregister(menuItemID, _callerPluginID);
		},

		/**
		 * Handle a reader event dispatched by `Zotero.Reader._dispatchEvent`,
		 * rendering registered sections and appending registered menu items.
		 * @param {object} event - The reader event ({ type, reader, doc, params, append })
		 */
		_handleEvent(event) {
			let sectionTarget = SECTION_EVENT_TO_TARGET[event.type];
			if (sectionTarget) {
				this._renderSections(event, sectionTarget);
				return;
			}
			let menuTarget = CONTEXT_MENU_EVENT_TO_TARGET[event.type];
			if (menuTarget) {
				this._appendMenuItems(event, menuTarget);
			}
		},

		// Safe, primitive-only reader info exposed to plugin hooks
		_readerContext(event, extra = {}) {
			let reader = event.reader;
			let context = Object.assign({}, extra);
			try {
				context.itemID = reader?.itemID;
				context.tabID = reader?.tabID;
				context.type = reader?.type;
			}
			catch (e) {
				Zotero.logError(e);
			}
			if (event.params !== undefined) {
				context.params = event.params;
			}
			return context;
		},

		_renderSections(event, target) {
			let options = this._sectionManager.getByTarget(target);
			if (!options.length) {
				return;
			}
			let doc = event.doc;
			for (let option of options) {
				// Host the plugin's page via the shared helper; it appends synchronously
				// (custom-sections.js wraps each node in a `.section`) and fires onRender post-load.
				let context = option.onRender ? this._readerContext(event) : null;
				lazy.loadEmbeddedPluginPage(doc, option._url, {
					className: `${CUSTOM_SECTION_CLASS} ${option.sectionID}`,
					autoResize: { height: true, width: true },
					channel: !!option.onRender,
					pluginID: option.pluginID,
					append: el => event.append(el),
				})
					.then(({ messenger }) => {
						if (option.onRender) {
							option.onRender(Object.assign({}, context, { page: messenger }));
						}
					})
					.catch(e => Zotero.logError(e));
			}
		},

		_appendMenuItems(event, target) {
			let options = this._contextMenuManager.getByTarget(target);
			if (!options.length) {
				return;
			}
			let items = [];
			for (let option of options) {
				try {
					let label = option.label;
					let disabled = false;
					if (option.onShowing) {
						let overrides = option.onShowing(this._readerContext(event));
						if (overrides === false) {
							continue;
						}
						if (overrides && typeof overrides === "object") {
							if (typeof overrides.label === "string") {
								label = overrides.label;
							}
							disabled = !!overrides.disabled;
						}
					}
					let item = {
						label,
						disabled,
						onCommand: () => {
							try {
								option.onCommand(this._readerContext(event));
							}
							catch (e) {
								Zotero.logError(e);
							}
						},
					};
					if (option.icon) {
						item.icon = option.icon;
					}
					items.push(item);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			if (items.length) {
				let win = event.reader?._iframeWindow;
				event.append(...(win ? Cu.cloneInto(items, win, { cloneFunctions: true }) : items));
			}
		},
	};

	let injectRegister = ({ pluginID, args }) => {
		if (args[0] && typeof args[0] === "object") {
			args[0].pluginID = pluginID;
		}
	};
	let injectUnregister = ({ pluginID, args }) => {
		args[1] = pluginID;
	};
	lazy.ScopeVariables.setCustomParser(Zotero.ReaderManager.registerSection, injectRegister);
	lazy.ScopeVariables.setCustomParser(Zotero.ReaderManager.unregisterSection, injectUnregister);
	lazy.ScopeVariables.setCustomParser(Zotero.ReaderManager.registerContextMenuItem, injectRegister);
	lazy.ScopeVariables.setCustomParser(Zotero.ReaderManager.unregisterContextMenuItem, injectUnregister);
}
