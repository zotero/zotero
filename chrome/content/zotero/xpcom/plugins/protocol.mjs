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


var policies = new Map(); // addonID -> WebExtensionPolicy

/**
 * Register a plugin with the moz-extension:// protocol.
 * Creates a WebExtensionPolicy that maps moz-extension://{hostname}/
 * to the plugin's root directory.
 *
 * Requires the pref `extensions.webextensions.remote` to be `false`
 * (set in defaults/preferences/zotero.js) so the parent process is
 * treated as the extension process and moz-extension:// content can
 * load in non-remote browser elements.
 *
 * @param {string} addonID -- The addon's ID
 * @param {nsIURI} rootURI -- The addon's root directory URI
 * @param {string} syncGUID -- The addon's syncGUID (stable UUID from AddonManager)
 * @returns {string} The moz-extension:// base URI for this plugin
 */
function register(addonID, rootURI, syncGUID, origins = []) {
	// Always recreate with fresh origins and re-activate,
	// since origins may have changed or the policy may have
	// been deactivated externally (e.g. by AddonManager on disable)
	unregister(addonID);

	// Firefox's extension startup registers a temporary WebExtensionPolicy
	// before the manifest is parsed, with no webAccessibleResources:
	// https://searchfox.org/firefox-esr140/source/toolkit/components/extensions/Extension.sys.mjs#4080-4090
	// Since Zotero plugins skip the full WebExtension lifecycle, this
	// temporary policy is never replaced. Deactivate it so we can register
	// our own with webAccessibleResources (needed for URI_LOADABLE_BY_ANYONE).
	let existing = WebExtensionPolicy.getByID(addonID);
	let hostname;
	if (existing) {
		hostname = existing.mozExtensionHostname;
		existing.active = false;
	}
	else {
		// Strip curly braces from syncGUID (format: "{uuid}")
		hostname = syncGUID.replace(/[{}]/g, "");
	}

	let baseURL = rootURI.spec;

	let policy = new WebExtensionPolicy({
		id: addonID,
		mozExtensionHostname: hostname,
		baseURL,
		localizeCallback: str => str,
		allowedOrigins: new MatchPatternSet(origins, { restrictSchemes: false }),
		// Mark all resources as web-accessible so GetFlagsForURI returns
		// URI_LOADABLE_BY_ANYONE instead of URI_DANGEROUS_TO_LOAD.
		webAccessibleResources: [
			{ resources: ["*"], matches: ["<all_urls>"] },
		],
	});
	policy.active = true;

	policies.set(addonID, policy);
	return `moz-extension://${hostname}/`;
}

/**
 * Unregister a plugin from the moz-extension:// protocol.
 */
function unregister(addonID) {
	let policy = policies.get(addonID);
	if (!policy) return;
	policy.active = false;
	policies.delete(addonID);
}

/**
 * Get the moz-extension:// base URI for a registered plugin.
 *
 * @param {string} addonID
 * @returns {string|null} The base URI, or null if not registered
 */
function getBaseURI(addonID) {
	let policy = policies.get(addonID);
	if (!policy) return null;
	return `moz-extension://${policy.mozExtensionHostname}/`;
}

const PluginProtocol = { register, unregister, getBaseURI };

export { PluginProtocol };
