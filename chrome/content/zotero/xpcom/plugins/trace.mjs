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
 * Emits one Zotero.debug line (level 5) per API access; a controller or store request adds one
 * naming the request, timed to its response.
 * Logs can be filtered by "[PluginTrace]". Callers build a per-access path only once tracing is
 * known to be on (a nonzero start() or `enabled`), so tracing off costs nothing.
 *
 * Trace types: "get", "set", "call", "construct", "hook"
 */

const PluginTrace = {

	get enabled() {
		return Zotero.Debug.enabled;
	},

	/**
	 * Begin a timed trace. Returns a timestamp when debug logging
	 * is enabled, 0 otherwise.
	 *
	 * @returns {number}
	 */
	start() {
		return PluginTrace.enabled ? ChromeUtils.now() : 0;
	},

	/**
	 * Finish a timed trace begun by start(). No-op if startTime is 0.
	 *
	 * @param {number} startTime - Value returned by start()
	 * @param {string} pluginID
	 * @param {"call"|"construct"|"hook"} type
	 * @param {string} path - Dotted API path
	 * @param {*} [failure] - What the access threw, or the code its response failed with
	 */
	end(startTime, pluginID, type, path, failure = undefined) {
		if (!startTime) return;
		let duration = Math.round((ChromeUtils.now() - startTime) * 100) / 100;
		let outcome = failure === undefined ? "" : ` failed: ${PluginTrace._describeFailure(failure)}`;
		Zotero.debug(`[PluginTrace] [${type}] ${path} (${duration}ms) [${pluginID}]${outcome}`, 5);
	},

	// A code or name locates the failure; its message has a log line of its own
	_describeFailure(failure) {
		if (failure !== null && typeof failure === "object") {
			return (typeof failure.code === "string" && failure.code) || failure.name || "Error";
		}
		return String(failure);
	},

	/**
	 * Record an untimed API access (get/set). Guards on `enabled` internally.
	 *
	 * @param {string} pluginID
	 * @param {"get"|"set"} type
	 * @param {string} path - Dotted API path
	 */
	record(pluginID, type, path) {
		if (!PluginTrace.enabled) return;
		Zotero.debug(`[PluginTrace] [${type}] ${path} [${pluginID}]`, 5);
	},
};

export { PluginTrace };
