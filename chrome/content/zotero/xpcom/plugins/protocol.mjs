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


var policies = new Map(); // pluginID -> WebExtensionPolicy

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
 * @param {string} pluginID -- The addon's ID
 * @param {nsIURI} rootURI -- The addon's root directory URI
 * @param {string} pluginUUID -- The addon's UUID (no curly braces; the
 *   caller is responsible for stripping them from `syncUUID`)
 * @returns {string} The moz-extension:// base URI for this plugin
 */
function register(pluginID, rootURI, pluginUUID, origins = []) {
	// Always recreate with fresh origins and re-activate,
	// since origins may have changed or the policy may have
	// been deactivated externally (e.g. by AddonManager on disable)
	unregister(pluginID);

	// Firefox's extension startup registers a temporary WebExtensionPolicy
	// before the manifest is parsed, with no webAccessibleResources:
	// https://searchfox.org/firefox-esr140/source/toolkit/components/extensions/Extension.sys.mjs#4080-4090
	// Since Zotero plugins skip the full WebExtension lifecycle, this
	// temporary policy is never replaced. Deactivate it so we can register
	// our own with webAccessibleResources (needed for URI_LOADABLE_BY_ANYONE).
	let existing = WebExtensionPolicy.getByID(pluginID);
	let hostname;
	if (existing) {
		hostname = existing.mozExtensionHostname;
		existing.active = false;
	}
	else {
		hostname = pluginUUID;
	}

	let baseURL = rootURI.spec;

	let policy = new WebExtensionPolicy({
		id: pluginID,
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

	policies.set(pluginID, policy);
	return `moz-extension://${hostname}/`;
}

/**
 * Unregister a plugin from the moz-extension:// protocol.
 */
function unregister(pluginID) {
	let policy = policies.get(pluginID);
	if (!policy) return;
	policy.active = false;
	policies.delete(pluginID);
}

/**
 * Get the moz-extension:// base URI for a registered plugin.
 *
 * @param {string} pluginID
 * @returns {string|null} The base URI, or null if not registered
 */
function getBaseURI(pluginID) {
	let policy = policies.get(pluginID);
	if (!policy) return null;
	return `moz-extension://${policy.mozExtensionHostname}/`;
}

/**
 * Check whether a plugin's host_permissions cover the given URI string.
 * Wraps the plugin's WebExtensionPolicy.canAccessURI() so callers that
 * want to validate an outbound URL upfront (instead of letting the
 * sandbox principal block it at request time) have a single entry point.
 *
 * @param {string} pluginID
 * @param {string} uriStr -- URI to test; must be a parseable URI string
 * @returns {boolean} true if the plugin is registered and its
 *   host_permissions allow the URI; false otherwise
 */
function canAccessURI(pluginID, uriStr) {
	let policy = policies.get(pluginID);
	if (!policy) return false;
	let nsURI;
	try {
		nsURI = Services.io.newURI(uriStr);
	}
	catch {
		return false;
	}
	return policy.canAccessURI(nsURI);
}

const PluginProtocol = { register, unregister, getBaseURI, canAccessURI };

export { PluginProtocol };
