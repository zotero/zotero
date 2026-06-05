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


/**
 * Debug tracing for plugin sandbox API access.
 *
 * Automatically active when Zotero debug logging is enabled.
 * Emits one Zotero.debug line (level 5) per API access.
 * Logs can be filtered by "[PluginTrace]".
 *
 * Trace types: "get", "set", "call", "construct", "hook"
 */

const PluginTrace = {

	/**
	 * Begin a timed trace. Returns a timestamp when debug logging
	 * is enabled, 0 otherwise.
	 *
	 * @returns {number}
	 */
	start() {
		return Zotero.Debug.enabled ? Date.now() : 0;
	},

	/**
	 * Finish a timed trace begun by start(). No-op if startTime is 0.
	 *
	 * @param {number} startTime - Value returned by start()
	 * @param {string} pluginID
	 * @param {"call"|"construct"|"hook"} type
	 * @param {string} path - Dotted API path
	 */
	end(startTime, pluginID, type, path) {
		if (!startTime) return;
		let duration = Date.now() - startTime;
		Zotero.debug(`[PluginTrace] [${type}] ${path} (${Math.round(duration * 100) / 100}ms) [${pluginID}]`, 5);
	},

	/**
	 * Record an untimed API access (get/set). Guards on
	 * Zotero.Debug.enabled internally.
	 *
	 * @param {string} pluginID
	 * @param {"get"|"set"} type
	 * @param {string} path - Dotted API path
	 */
	record(pluginID, type, path) {
		if (!Zotero.Debug.enabled) return;
		Zotero.debug(`[PluginTrace] [${type}] ${path} [${pluginID}]`, 5);
	},
};

export { PluginTrace };
