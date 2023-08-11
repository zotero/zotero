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

/**
 * Manages preference panes.
 */
Zotero.PreferencePanes = {
	builtInPanes: Object.freeze([
		{
			id: 'zotero-prefpane-general',
			label: 'zotero.preferences.prefpane.general',
			image: 'chrome://zotero/skin/prefs-general.png',
			src: 'chrome://zotero/content/preferences/preferences_general.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_general.js'],
			defaultXUL: true,
			helpURL: 'https://www.zotero.org/support/preferences/general',
		},
		{
			id: 'zotero-prefpane-sync',
			label: 'zotero.preferences.prefpane.sync',
			image: 'chrome://zotero/skin/prefs-sync.png',
			src: 'chrome://zotero/content/preferences/preferences_sync.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_sync.js'],
			defaultXUL: true,
			helpURL: 'https://www.zotero.org/support/preferences/sync',
		},
		{
			id: 'zotero-prefpane-export',
			label: 'zotero.preferences.prefpane.export',
			image: 'chrome://zotero/skin/prefs-export.png',
			src: 'chrome://zotero/content/preferences/preferences_export.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_export.js'],
			defaultXUL: true,
			helpURL: 'https://www.zotero.org/support/preferences/export',
		},
		{
			id: 'zotero-prefpane-cite',
			label: 'zotero.preferences.prefpane.cite',
			image: 'chrome://zotero/skin/prefs-styles.png',
			src: 'chrome://zotero/content/preferences/preferences_cite.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_cite.js'],
			defaultXUL: true,
			helpURL: 'https://www.zotero.org/support/preferences/cite',
		},
		{
			id: 'zotero-prefpane-advanced',
			label: 'zotero.preferences.prefpane.advanced',
			image: 'chrome://zotero/skin/prefs-advanced.png',
			src: 'chrome://zotero/content/preferences/preferences_advanced.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_advanced.js'],
			defaultXUL: true,
			helpURL: 'https://www.zotero.org/support/preferences/advanced',
		},
		{
			id: 'zotero-subpane-reset-sync',
			parent: 'zotero-prefpane-sync',
			label: 'zotero.preferences.subpane.resetSync',
			src: 'chrome://zotero/content/preferences/preferences_sync_reset.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_sync.js'],
			defaultXUL: true,
			helpURL: 'https://www.zotero.org/support/preferences/sync#reset',
		},
		{
			id: 'zotero-subpane-file-renaming',
			parent: 'zotero-prefpane-general',
			label: '',
			src: 'chrome://zotero/content/preferences/preferences_file_renaming.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_file_renaming.js'],
			defaultXUL: true,
			helpURL: null,
		}
	]),

	pluginPanes: [],

	/**
	 * Register a pane to be displayed in the preferences. The pane XHTML (`src`)
	 * is loaded as a fragment, not a full document, with XUL as the default
	 * namespace and (X)HTML tags available under `html:`.
	 *
	 * The pane will be unregistered automatically when the registering plugin
	 * shuts down.
	 *
	 * @param {Object} options
	 * @param {String} options.pluginID ID of the plugin registering the pane
	 * @param {String} options.src URI of an XHTML fragment, optionally relative to the plugin's root
	 * @param {String} [options.id] Represents the pane and must be unique. Automatically generated if not provided
	 * @param {String} [options.parent] ID of parent pane (if provided, pane is hidden from the sidebar)
	 * @param {String} [options.label] Displayed as the pane's label in the sidebar.
	 * 		If not provided, the plugin's name is used
	 * @param {String} [options.image] URI of an icon to be displayed in the navigation sidebar, optionally relative to
	 * 		the plugin's root. If not provided, the plugin's icon (from manifest.json) is used.
	 * @param {String[]} [options.scripts] Array of URIs of scripts to load along with the pane, optionally relative to
	 * 		the plugin's root
	 * @param {String[]} [options.stylesheets] Array of URIs of CSS stylesheets to load along with the pane, optionally
	 * 		relative to the plugin's root
	 * @param {String} [options.helpURL] If provided, a help button will be displayed under the pane
	 * 		and the provided URL will open when it is clicked
	 * @return {Promise<String>} Resolves to the ID of the pane if successfully added
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

		let addPaneOptions = {
			id: options.id || `plugin-pane-${Zotero.Utilities.randomString()}-${options.pluginID}`,
			pluginID: options.pluginID,
			parent: options.parent,
			rawLabel: options.label || await Zotero.Plugins.getName(options.pluginID),
			image: options.image && await Zotero.Plugins.resolveURI(options.pluginID, options.image)
				|| await Zotero.Plugins.getIconURI(options.pluginID, 24),
			src: await Zotero.Plugins.resolveURI(options.pluginID, options.src),
			scripts: await Promise.all(options.scripts.map(uri => Zotero.Plugins.resolveURI(options.pluginID, uri))),
			stylesheets: await Promise.all(options.stylesheets.map(uri => Zotero.Plugins.resolveURI(options.pluginID, uri))),
			helpURL: options.helpURL,
			defaultXUL: true,
		};

		this.pluginPanes.push(addPaneOptions);
		Zotero.debug(`Plugin ${addPaneOptions.pluginID} registered preference pane ${addPaneOptions.id} ("${addPaneOptions.rawLabel}")`);
		this._refreshPreferences();
		this._ensureObserverAdded();
		return addPaneOptions.id;
	},

	/**
	 * Called automatically on plugin shutdown.
	 *
	 * @param {String} id
	 */
	unregister: function (id) {
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
