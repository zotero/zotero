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

/* global WebExtensionPolicy */

import { PluginProtocol } from "chrome://zotero/content/xpcom/plugins/protocol.mjs";

// From nsSandboxFlags.h, as plugin pages get them
const SANDBOXED_AUXILIARY_NAVIGATION = 0x2;
const SANDBOXED_TOPLEVEL_NAVIGATION = 0x4;
const SANDBOXED_TOPLEVEL_NAVIGATION_USER_ACTIVATION = 0x20000;

/**
 * Web Workers for unprivileged plugins: the sandbox's `Worker` is that of a document Zotero conjures under
 * the plugin's origin and CSP, so a worker carries the plugin's principal and nothing of chrome
 */
const PluginWorkers = {
	// pluginID -> { browser, Worker }
	_hosts: new Map(),

	/**
	 * Define `Worker` on an unprivileged scope, resolved on first use
	 * @param {object} scope
	 */
	setup(scope) {
		let pluginID = scope.PLUGIN_ID;
		ChromeUtils.defineLazyGetter(scope, "Worker", () => this._host(pluginID).Worker);
	},

	/**
	 * Drop the plugin's host document, which ends its workers
	 * @param {string} pluginID
	 */
	unregister(pluginID) {
		let host = this._hosts.get(pluginID);
		if (!host) {
			return;
		}
		this._hosts.delete(pluginID);
		host.browser.close();
	},

	/**
	 * The plugin's document, made on first use: a windowless browser with the CSP and confinement its pages
	 * get, based at the plugin root so a relative script URL resolves there
	 */
	_host(pluginID) {
		let host = this._hosts.get(pluginID);
		if (host) {
			return host;
		}
		let baseURI = Services.io.newURI(PluginProtocol.getBaseURI(pluginID));
		let principal = Services.scriptSecurityManager.createContentPrincipal(baseURI, {});
		let policy = WebExtensionPolicy.getByID(pluginID);
		let csp = Cc["@mozilla.org/cspcontext;1"].createInstance(Ci.nsIContentSecurityPolicy);
		csp.setRequestContextWithPrincipal(principal, baseURI, "", 0);
		for (let policyString of [policy.baseCSP, policy.extensionPageCSP]) {
			if (policyString) {
				csp.appendPolicy(policyString, false, false);
			}
		}
		let container = Cc["@mozilla.org/policycontainer;1"].createInstance(Ci.nsIPolicyContainer);
		container.initFromCSP(csp);
		let browser = Services.appShell.createWindowlessBrowser(false);
		browser.docShell.browsingContext.sandboxFlags |= SANDBOXED_AUXILIARY_NAVIGATION
			| SANDBOXED_TOPLEVEL_NAVIGATION
			| SANDBOXED_TOPLEVEL_NAVIGATION_USER_ACTIVATION;
		browser.docShell.createAboutBlankDocumentViewer(principal, principal, container);
		let win = browser.docShell.domWindow;
		let base = win.document.createElement("base");
		base.setAttribute("href", baseURI.spec);
		win.document.head.append(base);
		// A worker's error that no handler cancels reaches its document
		win.addEventListener("error", (event) => {
			Zotero.logError(`Plugin ${pluginID} worker: ${event.message} (${event.filename}:${event.lineno})`);
		});
		host = { browser, Worker: win.Worker };
		this._hosts.set(pluginID, host);
		return host;
	},
};

export { PluginWorkers };
