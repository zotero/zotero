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
 * Register a plugin with the moz-extension:// protocol (needs pref
 * `extensions.webextensions.remote` = false so content loads non-remote).
 * @param {string} pluginID
 * @param {nsIURI} rootURI - The addon's root directory URI
 * @param {string} pluginUUID - UUID (no braces) used as the moz-extension host
 * @param {string[]} [origins] - Extra allowed origins (host_permissions)
 * @param {string} [contentSecurityPolicy] - Extension-page CSP
 * @returns {string} The moz-extension:// base URI for this plugin
 */
function register(pluginID, rootURI, pluginUUID, origins = [], contentSecurityPolicy = null) {
	// Recreate with fresh origins and re-activate: origins may have changed,
	// or AddonManager may have deactivated the policy on disable
	unregister(pluginID);

	// Firefox pre-registers a temporary policy with no webAccessibleResources that
	// Zotero never replaces; deactivate it first. https://searchfox.org/firefox-esr140/source/toolkit/components/extensions/Extension.sys.mjs#4080-4090
	let existing = WebExtensionPolicy.getByID(pluginID);
	if (existing) {
		existing.active = false;
	}
	let hostname = pluginUUID;

	let baseURL = rootURI.spec;

	let policy = new WebExtensionPolicy({
		id: pluginID,
		mozExtensionHostname: hostname,
		baseURL,
		// MV3 is required for the per-resource `matches` allowlist to be enforced.
		manifestVersion: 3,
		extensionPageCSP: contentSecurityPolicy || undefined,
		localizeCallback: str => str,
		allowedOrigins: new MatchPatternSet([...origins, `moz-extension://${hostname}/*`], { restrictSchemes: false }),
		// Resources are only accessible to chrome/resource and the plugin itself.
		webAccessibleResources: [
			{
				resources: ["*"],
				matches: new MatchPatternSet(
					[
						"chrome://*/*",
						"resource://*/*",
						`moz-extension://${hostname}/*`,
					],
					{ restrictSchemes: false }
				),
			},
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
 *
 * @param {string} value - URI to test; must be a parseable URI string
 * @param {string} pluginID
 * @returns {boolean}
 */
function canAccessURI(value, pluginID) {
	let policy = policies.get(pluginID);
	if (!policy) return false;
	let nsURI;
	try {
		nsURI = Services.io.newURI(value);
	}
	catch {
		return false;
	}
	return policy.canAccessURI(nsURI);
}

const LOCAL_RESOURCE_SCHEMES = new Set(["chrome", "resource", "data", "blob"]);

/**
 * Resolve an image URL a plugin may load: local schemes (chrome/resource/data/blob)
 * plus its declared origins. Relative values resolve against the plugin root.
 * @param {string} pluginID
 * @param {string} value
 * @returns {string | null} The absolute URL ("" for an empty value, which loads nothing), or null if not allowed
 */
function resolveImageURL(pluginID, value) {
	let raw = (value === null || value === undefined) ? "" : String(value);
	if (!raw.trim()) {
		return "";
	}
	let uri;
	try {
		// Relative values resolve against the plugin's own moz-extension root
		let baseSpec = getBaseURI(pluginID);
		let base = baseSpec ? Services.io.newURI(baseSpec) : null;
		uri = Services.io.newURI(raw, null, base);
	}
	catch {
		return null;
	}
	if (LOCAL_RESOURCE_SCHEMES.has(uri.scheme.toLowerCase())
			|| canAccessURI(uri.spec, pluginID)) {
		return uri.spec;
	}
	return null;
}

/**
 * Resolve `src` against the plugin root, staying inside it
 * @param {string} pluginID
 * @param {string} src - File URL, optionally relative to the plugin's root
 * @param {string[]} extensions - Allowed file extensions (with leading dot)
 * @returns {string | null} The absolute URL, or null if src doesn't qualify
 */
function resolveFile(pluginID, src, extensions) {
	let base = getBaseURI(pluginID);
	if (!base) {
		return null;
	}
	let resolved;
	try {
		resolved = new URL(String(src ?? ""), base).href;
	}
	catch {
		return null;
	}
	if (!resolved.startsWith(base)) {
		return null;
	}
	let pathname = new URL(resolved).pathname.toLowerCase();
	if (!extensions.some(ext => pathname.endsWith(ext))) {
		return null;
	}
	return resolved;
}

/**
 * @param {string} pluginID
 * @param {string} src - Page URL, optionally relative to the plugin's root
 * @returns {string | null} The absolute URL of an `.html`/`.htm` file inside the plugin, else null
 */
function resolvePage(pluginID, src) {
	return resolveFile(pluginID, src, [".html", ".htm"]);
}

const PluginProtocol = {
	register,
	unregister,
	getBaseURI,
	canAccessURI,
	resolveImageURL,
	resolveFile,
	resolvePage,
};

export { PluginProtocol };
