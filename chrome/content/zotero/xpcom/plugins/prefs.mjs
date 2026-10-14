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


import { PluginUUID } from "chrome://zotero/content/xpcom/plugins/uuid.mjs";

// Never declarable, as a prefix or as a pref
const FORBIDDEN_PREF_PREFIXES = [
	"extensions.zotero.pluginFileAccess.",
	"extensions.zotero.pluginNames.",
	"extensions.zotero.dataDir",
	"extensions.update.",
	"extensions.blocklist.",
	"security.",
	"network.",
	"services.",
	"signon.",
	"app.update.",
	"datareporting.",
	"toolkit.telemetry.",
	"privacy.",
	"devtools.",
];

// Declarable pref by pref, never as a prefix, and never reset as a branch
const EXACT_MATCH_ONLY_PREF_PREFIXES = [
	"extensions.zotero.sync.",
];

function isAllowedPrefPrefix(prefix) {
	for (let p of FORBIDDEN_PREF_PREFIXES) {
		if (prefix.startsWith(p) || p.startsWith(prefix)) {
			return false;
		}
	}
	if (prefix.endsWith(".")) {
		for (let p of EXACT_MATCH_ONLY_PREF_PREFIXES) {
			if (prefix.startsWith(p) || p.startsWith(prefix)) {
				return false;
			}
		}
	}
	return true;
}

// A prefix covers a subtree only with a trailing ".", so "extensions.zo" cannot silently cover "extensions.zotero.*"
function prefixMatches(prefix, pref) {
	return pref === prefix || (prefix.endsWith(".") && pref.startsWith(prefix));
}

/**
 * The prefs a plugin may touch: its own branch, where it names them relative, and the manifest's
 * pref_permissions, named in full. Zotero.Prefs in the sandbox and the plugin's prefs.js share this
 */
const PluginPrefs = {
	// The branch a plugin owns; keyed by UUID so it outlives an uninstall
	getBranch(uuid) {
		return `extensions.${uuid}.`;
	},

	/**
	 * @param {string} pluginID
	 * @param {Iterable<string>} [prefPermissions] - As declared; reserved entries are dropped with a warning
	 * @returns {{ resolve: function(string, boolean): string, checkReset: function(string) }}
	 */
	access(pluginID, prefPermissions) {
		let branch = this.getBranch(PluginUUID.getByID(pluginID));
		let declared = Array.from(prefPermissions || []).filter(p => typeof p === "string" && p.length > 0);
		declared = declared.filter((p) => {
			if (!isAllowedPrefPrefix(p)) {
				Zotero.warn(`Plugin ${pluginID}: ignoring reserved pref in pref_permission "${p}"`);
				return false;
			}
			return true;
		});
		let allowed = [branch, ...declared];

		let check = (key) => {
			if (!allowed.some(prefix => prefixMatches(prefix, key))) {
				throw new Error(`Permission denied: cannot access preference "${key}". Declare it in "pref_permissions".`);
			}
		};

		return {
			// The full name: relative to the branch, or as given once allowed when global
			resolve(key, global) {
				if (!global) {
					return branch + key;
				}
				check(key);
				return key;
			},
			// A branch to reset must be given, allowed and clear of reserved subtrees
			checkReset(resetBranch) {
				if (!resetBranch) {
					throw new Error('Permission denied: cannot reset entire preference branch.');
				}
				check(resetBranch);
				if (EXACT_MATCH_ONLY_PREF_PREFIXES.some(p => p.startsWith(resetBranch) || resetBranch.startsWith(p))) {
					throw new Error(`Permission denied: cannot reset reserved branch "${resetBranch}".`);
				}
			},
		};
	},
};

export { PluginPrefs };
