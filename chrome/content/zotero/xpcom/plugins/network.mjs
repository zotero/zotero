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


import { PluginProtocol } from "chrome://zotero/content/xpcom/plugins/protocol.mjs";
import { PluginSandbox } from "chrome://zotero/content/xpcom/plugins/sandbox.mjs";

// uuidv5(ZOTERO_PLUGIN_NS_UUID, "@zotero.org/plugin-network-gate;1")
const CLASS_ID = Components.ID("{b9c9aacf-6e5a-597d-af86-31bd03342d06}");
const CONTRACT_ID = "@zotero.org/plugin-network-gate;1";
const NETWORK_SCHEMES = new Set(["http", "https", "ws", "wss"]);

/**
 * @param {nsIURI} uri
 * @param {nsIPrincipal} principal - The principal that triggered the load
 * @returns {boolean} False for a load a plugin triggered to a host outside its host_permissions, or to another
 *     application (mailto: and other schemes Gecko hands to an external handler)
 */
function isAllowed(uri, principal) {
	// A sandboxed frame in a plugin page has an opaque origin that keeps the page's as its precursor
	if (principal?.isNullPrincipal) {
		principal = principal.precursorPrincipal;
	}
	if (!principal?.schemeIs("moz-extension")) {
		return true;
	}
	let network = NETWORK_SCHEMES.has(uri.scheme);
	if (!network && !(Services.io.getProtocolHandler(uri.scheme) instanceof Ci.nsIExternalProtocolHandler)) {
		return true;
	}
	// Once a plugin is unloaded its origin is unregistered, so code it left running reaches nothing
	let pluginID = PluginProtocol.getIDByHost(principal.host);
	if (pluginID && (PluginSandbox.isPrivileged(pluginID) || (network && canAccess(uri, pluginID)))) {
		return true;
	}
	Zotero.warn(`Plugin ${pluginID ?? principal.origin} blocked from `
		+ (network ? `${uri.prePath}: not in host_permissions` : `opening a ${uri.scheme}: link in another application`));
	return false;
}

function canAccess(uri, pluginID) {
	if (PluginProtocol.canAccessURI(uri.spec, pluginID)) {
		return true;
	}
	// A WebSocket opens with an HTTP request to its host
	return (uri.schemeIs("ws") || uri.schemeIs("wss"))
		&& PluginProtocol.canAccessURI(uri.spec.replace(/^ws/, "http"), pluginID);
}

/**
 * Keeps plugin requests within host_permissions. A plugin's principal only hides the response from it (CORS),
 * while the request itself, e.g. a no-cors fetch, still reaches the host. Nor may a plugin hand a URL to another application
 */
var gate = {
	classID: CLASS_ID,
	QueryInterface: ChromeUtils.generateQI(["nsIFactory", "nsIContentPolicy", "nsIChannelEventSink"]),

	createInstance(iid) {
		return this.QueryInterface(iid);
	},

	// Runs before the channel opens, so not even a DNS lookup reaches the host
	shouldLoad(uri, loadInfo) {
		return isAllowed(uri, loadInfo.triggeringPrincipal)
			? Ci.nsIContentPolicy.ACCEPT
			: Ci.nsIContentPolicy.REJECT_REQUEST;
	},

	shouldProcess() {
		return Ci.nsIContentPolicy.ACCEPT;
	},

	// Content policies only see the first URL of a load
	asyncOnChannelRedirect(oldChannel, newChannel, flags, callback) {
		if (isAllowed(newChannel.URI, newChannel.loadInfo.triggeringPrincipal)) {
			callback.onRedirectVerifyCallback(Cr.NS_OK);
			return;
		}
		// A vetoed redirect alone would hand the redirect response to the caller
		oldChannel.cancel(Cr.NS_ERROR_CONTENT_BLOCKED);
		callback.onRedirectVerifyCallback(Cr.NS_ERROR_CONTENT_BLOCKED);
	},
};

var ready;

/**
 * Register the gate, once
 * @returns {Promise} Resolves when the gate is live, before which no plugin may load
 */
function init() {
	if (!ready) {
		let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
		registrar.registerFactory(CLASS_ID, "", CONTRACT_ID, gate);
		for (let category of ["content-policy", "net-channel-event-sinks"]) {
			Services.catMan.addCategoryEntry(category, CONTRACT_ID, CONTRACT_ID, false, true);
		}
		// Gecko's category caches take a new entry from a notification it queues on the main thread
		ready = new Promise(resolve => Services.tm.dispatchToMainThread(resolve));
	}
	return ready;
}

const PluginNetwork = { init };

export { PluginNetwork };
