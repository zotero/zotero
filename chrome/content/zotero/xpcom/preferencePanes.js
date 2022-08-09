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
			scripts: ['chrome://zotero/content/preferences/preferences_general.js']
		},
		{
			id: 'zotero-prefpane-sync',
			label: 'zotero.preferences.prefpane.sync',
			image: 'chrome://zotero/skin/prefs-sync.png',
			src: 'chrome://zotero/content/preferences/preferences_sync.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_sync.js']
		},
		{
			id: 'zotero-prefpane-export',
			label: 'zotero.preferences.prefpane.export',
			image: 'chrome://zotero/skin/prefs-export.png',
			src: 'chrome://zotero/content/preferences/preferences_export.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_export.js']
		},
		{
			id: 'zotero-prefpane-cite',
			label: 'zotero.preferences.prefpane.cite',
			image: 'chrome://zotero/skin/prefs-styles.png',
			src: 'chrome://zotero/content/preferences/preferences_cite.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_cite.js']
		},
		{
			id: 'zotero-prefpane-advanced',
			label: 'zotero.preferences.prefpane.advanced',
			image: 'chrome://zotero/skin/prefs-advanced.png',
			src: 'chrome://zotero/content/preferences/preferences_advanced.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_advanced.js']
		},
		{
			id: 'zotero-subpane-reset-sync',
			parent: 'zotero-prefpane-sync',
			label: 'zotero.preferences.subpane.resetSync',
			src: 'chrome://zotero/content/preferences/preferences_sync_reset.xhtml',
			scripts: ['chrome://zotero/content/preferences/preferences_sync.js']
		}
	]),

	pluginPanes: [],

	/**
	 * Register a pane to be displayed in the preferences. The pane XHTML (`src`)
	 * is loaded as a fragment, not a full document, with XUL as the default
	 * namespace and (X)HTML tags available under `html:`.
	 *
	 * @param {Object} options
	 * @param {String} options.id Represents the pane and must be unique
	 * @param {String} options.pluginID ID of the plugin registering the pane
	 * @param {String} [options.parent] ID of parent pane (if provided, pane is hidden from the sidebar)
	 * @param {String} [options.label] Displayed as the pane's label in the sidebar.
	 * 		If not provided, the plugin's name is used
	 * @param {String} [options.image] URI of an icon to be displayed in the navigation sidebar.
	 * 		If not provided, the plugin's icon (from manifest.json) is used
	 * @param {String} options.src URI of an XHTML fragment
	 * @param {String[]} [options.extraDTD] Array of URIs of DTD files to use for parsing the XHTML fragment
	 * @param {String[]} [options.scripts] Array of URIs of scripts to load along with the pane
	 * @return {Promise<void>}
	 */
	register: async function (options) {
		if (this.builtInPanes.some(p => p.id === options.id)
			|| this.pluginPanes.some(p => p.id === options.id)) {
			throw new Error(`Pane with ID ${options.id} already registered`);
		}

		let addPaneOptions = {
			id: options.id,
			parent: options.parent,
			rawLabel: options.label || await Zotero.Plugins.getName(options.pluginID),
			image: options.image || await Zotero.Plugins.getIconURI(options.pluginID, 24),
			src: options.src,
			extraDTD: options.extraDTD,
			scripts: options.scripts
		};

		this.pluginPanes.push(addPaneOptions);
	},
};
