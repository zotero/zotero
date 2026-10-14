/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2022 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
					http://zotero.org
	
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
		PluginSandbox: "chrome://zotero/content/xpcom/plugins/sandbox.mjs",
		VarCheck: "chrome://zotero/content/xpcom/plugins/utils.mjs",
		resolvePluginPage: "chrome://zotero/content/xpcom/plugins/utils.mjs",
	});

	/**
	 * @namespace Zotero
	 */


	/**
	 * Manages preference panes.
	 *
	 * @memberof Zotero
	 */
	Zotero.PreferencePanes = {
		builtInPanes: Object.freeze([
			{
				id: 'zotero-prefpane-general',
				label: 'zotero.preferences.prefpane.general',
				image: 'chrome://zotero/skin/20/universal/cog.svg',
				src: 'chrome://zotero/content/preferences/preferences_general.xhtml',
				scripts: ['chrome://zotero/content/preferences/preferences_general.js'],
				defaultXUL: true,
				helpURL: 'https://www.zotero.org/support/preferences/general',
			},
			{
				id: 'zotero-prefpane-account',
				label: 'preferences-pane-account',
				image: 'chrome://zotero/skin/20/universal/account.svg',
				src: 'chrome://zotero/content/preferences/preferences_account.xhtml',
				scripts: ['chrome://zotero/content/preferences/preferences_account.js'],
				defaultXUL: true,
				helpURL: 'https://www.zotero.org/support/preferences/sync',
			},
			{
				id: 'zotero-prefpane-export',
				label: 'zotero.preferences.prefpane.export',
				image: 'chrome://zotero/skin/20/universal/export.svg',
				src: 'chrome://zotero/content/preferences/preferences_export.xhtml',
				scripts: ['chrome://zotero/content/preferences/preferences_export.js'],
				defaultXUL: true,
				helpURL: 'https://www.zotero.org/support/preferences/export',
			},
			{
				id: 'zotero-prefpane-cite',
				label: 'zotero.preferences.prefpane.cite',
				image: 'chrome://zotero/skin/20/universal/cite.svg',
				src: 'chrome://zotero/content/preferences/preferences_cite.xhtml',
				scripts: ['chrome://zotero/content/preferences/preferences_cite.js'],
				defaultXUL: true,
				helpURL: 'https://www.zotero.org/support/preferences/cite',
			},
			{
				id: 'zotero-prefpane-plugin-permissions',
				label: 'preferences-pane-plugin-permissions',
				image: 'chrome://zotero/skin/20/universal/magic-wand.svg',
				src: 'chrome://zotero/content/preferences/preferences_pluginPermissions.xhtml',
				scripts: ['chrome://zotero/content/preferences/preferences_pluginPermissions.js'],
				defaultXUL: true,
			},
			{
				id: 'zotero-prefpane-advanced',
				label: 'zotero.preferences.prefpane.advanced',
				image: 'chrome://zotero/skin/20/universal/wrench-screwdriver.svg',
				src: 'chrome://zotero/content/preferences/preferences_advanced.xhtml',
				scripts: ['chrome://zotero/content/preferences/preferences_advanced.js'],
				defaultXUL: true,
				helpURL: 'https://www.zotero.org/support/preferences/advanced',
			},
			{
				id: 'zotero-subpane-reset-sync',
				parent: 'zotero-prefpane-account',
				label: 'zotero.preferences.subpane.resetSync',
				src: 'chrome://zotero/content/preferences/preferences_sync_reset.xhtml',
				scripts: ['chrome://zotero/content/preferences/preferences_account.js'],
				defaultXUL: true,
				helpURL: 'https://www.zotero.org/support/preferences/sync#reset',
			},
			{
				id: 'zotero-subpane-plugin-permissions-edit',
				parent: 'zotero-prefpane-plugin-permissions',
				label: 'preferences-plugin-permissions-edit-subpane',
				src: 'chrome://zotero/content/preferences/preferences_pluginPermissions_edit.xhtml',
				defaultXUL: true,
			}
		]),

		pluginPanes: [],

		/**
		 * Register a pane to be displayed in the preferences.
		 *
		 * For privileged plugins, the pane XHTML (`src`) is loaded as a fragment,
		 * not a full document, with XUL as the default namespace and (X)HTML tags
		 * available under `html:`.
		 *
		 * For unprivileged plugins, `src` must be a full HTML page within the
		 * plugin, and it's shown in an embedded content browser isolated from the
		 * preferences window. The page loads its own scripts, styles, and
		 * localization, and `scripts`/`stylesheets`/`l10nFiles`/`onLoad` are
		 * ignored. The browser is single-page: links to web pages open in the
		 * system browser, and all other navigation is blocked. For multi-page
		 * settings, register additional panes (e.g. subpanes via `parent`) and
		 * call `Zotero_Preferences.navigateToPane(paneID)` from the page, which
		 * can only target panes registered by the same plugin.
		 *
		 * The pane will be unregistered automatically when the registering plugin
		 * shuts down.
		 *
		 * @param {Object} options
		 * @param {string} options.pluginID ID of the plugin registering the pane
		 * @param {string} options.src URI of an XHTML fragment (privileged plugins) or a full HTML page
		 * 		(unprivileged plugins), optionally relative to the plugin's root
		 * @param {string} [options.id] Represents the pane and must be unique. Automatically generated if not provided
		 * @param {string} [options.parent] ID of parent pane (if provided, pane is hidden from the sidebar)
		 * @param {string} [options.label] Displayed as the pane's label in the sidebar.
		 * 		If not provided, the plugin's name is used
		 * @param {string} [options.image] URI of an icon to be displayed in the navigation sidebar, optionally relative to
		 * 		the plugin's root. If not provided, the plugin's icon (from manifest.json) is used.
		 * @param {string[]} [options.scripts] Array of URIs of scripts to load along with the pane, optionally relative to
		 * 		the plugin's root. @deprecated Privileged plugins only; load scripts from the page at `src` instead.
		 * @param {string[]} [options.stylesheets] Array of URIs of CSS stylesheets to load along with the pane, optionally
		 * 		relative to the plugin's root. @deprecated Privileged plugins only; load stylesheets from the page at `src` instead.
		 * @param {string[]} [options.l10nFiles] Array of Fluent (.ftl) file paths to load for localization.
		 * 		Registered once via `Zotero.WindowResourceManager` and applied to every preferences window.
		 * 		@deprecated Privileged plugins only; use `<link rel="localization">` in the page at `src` instead.
		 * @param {Function} [options.onLoad] Called after the pane content is loaded and inserted into the document.
		 * 		Receives `{ doc, body }` where `doc` is the preferences document and `body` is the pane container element.
		 * 		@deprecated Privileged plugins only; run scripts from the page at `src` instead.
		 * @param {string} [options.helpURL] If provided, a help button will be displayed under the pane
		 * 		and the provided URL will open when it is clicked
		 * @return {Promise<string>} Resolves to the ID of the pane if successfully added
		 *
		 * @example
		 * ```javascript
		 * Zotero.PreferencePanes.register({
		 * 	pluginID: 'my-plugin@my-namespace.com',
		 * 	id: 'my-plugin-pane',
		 * 	src: 'my-pane.xhtml',
		 * 	stylesheets: ['my-pane.css'],
		 * 	l10nFiles: ['my-pane.ftl'],
		 * 	onLoad: ({ doc, body }) => {
		 * 		// Initialize pane
		 * 	}
		 * });
		 * ```
		 */
		register: async function (options) {
			if (!options.pluginID || !options.src) {
				throw new Error('pluginID and src must be provided');
			}
			if (options.id && (this.builtInPanes.some(p => p.id === options.id)
					|| this.pluginPanes.some(p => p.id === options.id))) {
				throw new Error(`Pane with ID ${options.id} already registered`);
			}

			options.scripts ||= [];
			options.stylesheets ||= [];
			options.l10nFiles ||= [];

			// Unprivileged plugins can't insert content into the preferences document.
			// Their pane is a full HTML page shown in an embedded content browser.
			let scope = lazy.PluginSandbox.getScope(options.pluginID);
			let embedded = !!scope && !lazy.VarCheck.isPrivilegedScope(scope);
			if (embedded) {
				let dropped = ['scripts', 'stylesheets', 'l10nFiles'].filter(key => options[key].length);
				if (typeof options.onLoad === 'function') {
					dropped.push('onLoad');
				}
				if (dropped.length) {
					Zotero.warn(
						`Plugin ${options.pluginID}: ${dropped.map(o => `'${o}'`).join(', ')} only available for privileged plugins. `
						+ 'Load scripts, stylesheets, and localization from the page at src instead.'
					);
					options.scripts = [];
					options.stylesheets = [];
					options.l10nFiles = [];
					delete options.onLoad;
				}
			}

			let src;
			if (embedded) {
				src = lazy.resolvePluginPage(options.pluginID, options.src);
				if (!src) {
					throw new Error(`Plugin ${options.pluginID}: pane src must be an .html page within the plugin`);
				}
			}
			else {
				src = await Zotero.Plugins.resolveURI(options.pluginID, options.src);
			}

			// onLoad is dropped above for unprivileged plugins, so no sandbox wrapping is needed
			let onLoad = typeof options.onLoad === 'function' ? options.onLoad : null;

			let addPaneOptions = {
				id: options.id || `plugin-pane-${Zotero.Utilities.randomString()}-${options.pluginID}`,
				pluginID: options.pluginID,
				parent: options.parent,
				rawLabel: options.label || (await Zotero.Plugins.getName(options.pluginID)),
				image: options.image && (await Zotero.Plugins.resolveURI(options.pluginID, options.image))
					|| (await Zotero.Plugins.getIconURI(options.pluginID, 24)),
				src,
				scripts: await Promise.all(options.scripts.map(uri => Zotero.Plugins.resolveURI(options.pluginID, uri))),
				stylesheets: await Promise.all(options.stylesheets.map(uri => Zotero.Plugins.resolveURI(options.pluginID, uri))),
				onLoad,
				helpURL: options.helpURL,
				embedded,
				defaultXUL: true,
			};

			addPaneOptions.l10nResourceIDs = options.l10nFiles.map((url, index) => {
				return Zotero.WindowResourceManager.registerResource({
					resourceID: `${addPaneOptions.id}-l10n-${index}`,
					pluginID: options.pluginID,
					target: "preferencePane",
					type: "ftl",
					url,
				});
			}).filter(Boolean);

			this.pluginPanes.push(addPaneOptions);
			Zotero.debug(`Plugin ${addPaneOptions.pluginID} registered preference pane ${addPaneOptions.id} ("${addPaneOptions.rawLabel}")`);
			this._refreshPreferences();
			this._ensureObserverAdded();
			return addPaneOptions.id;
		},

		/**
		 * Called automatically on plugin shutdown.
		 *
		 * @param {string} id - ID of the pane to unregister, as returned by `Zotero.PreferencePanes.register()`
		 */
		unregister: function (id) {
			let pane = this.pluginPanes.find(p => p.id === id);
			if (pane) {
				for (let resourceID of pane.l10nResourceIDs || []) {
					Zotero.WindowResourceManager.unregisterResource(resourceID);
				}
			}
			this.pluginPanes = this.pluginPanes.filter(p => p.id !== id);
			this._refreshPreferences();
		},

		_refreshPreferences() {
			for (let win of Services.wm.getEnumerator("zotero:pref")) {
				win.location.reload();
			}
		},

		_ensureObserverAdded() {
			if (this._observerAdded) {
				return;
			}

			Zotero.Plugins.addObserver({
				shutdown: ({ id: pluginID }) => {
					let beforeLength = this.pluginPanes.length;
					this.pluginPanes = this.pluginPanes.filter(pane => pane.pluginID !== pluginID);
					if (this.pluginPanes.length !== beforeLength) {
						Zotero.debug(`Preference panes registered by plugin ${pluginID} unregistered due to shutdown`);
						this._refreshPreferences();
					}
				}
			});
			this._observerAdded = true;
		}
	};
}
