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

import { WindowScopeVariables } from "chrome://zotero/content/xpcom/plugins/variables.mjs";
import { PluginProtocol } from "chrome://zotero/content/xpcom/plugins/protocol.mjs";

// https://searchfox.org/mozilla-central/source/dom/base/nsSandboxFlags.h
const SANDBOXED_AUXILIARY_NAVIGATION = 0x2;

/**
 * Resolve a plugin page URL for use in an embedded browser or plugin window:
 * optionally relative to the plugin's root, and required to be an .html/.htm
 * page within the plugin.
 *
 * @param {string} pluginID
 * @param {string} src - Page URL, optionally relative to the plugin's root
 * @returns {string | null} The absolute URL, or null if src doesn't qualify
 */
export function resolvePluginPage(pluginID, src) {
	let base = PluginProtocol.getBaseURI(pluginID);
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
	if (!pathname.endsWith(".html") && !pathname.endsWith(".htm")) {
		return null;
	}
	return resolved;
}

/**
 * Show a single plugin page in a content browser appended to `container` --
 * the shared implementation behind embedded preference panes and item pane
 * sections for unprivileged plugins.
 *
 * The browser is single-page: links to web pages open in the system browser
 * and all other navigation is blocked. Once loaded, the browser height
 * follows the page root's height, and Fluent is set up from the page's
 * `<link rel="localization">` links (exposed as `document.l10n`).
 *
 * @param {Element} container - Chrome element to append the browser to
 * @param {string} src - Absolute URL of a page within the plugin
 * @param {Object} [options]
 * @param {string} [options.className] - Class name for the browser element
 * @param {Function} [options.onWindowCreated] - Called with the browser when
 * 		the content window is created, before any page script runs
 * @returns {{ browser: XULElement, loadPromise: Promise<void> }}
 */
export function loadEmbeddedPluginPage(container, src, { className, onWindowCreated } = {}) {
	// Must be non-remote so moz-extension: pages can load in the parent
	// process (see plugins/protocol.mjs)
	let browser = container.ownerDocument.createXULElement("browser");
	browser.setAttribute("type", "content");
	browser.setAttribute("disableglobalhistory", "true");
	if (className) {
		browser.classList.add(className);
	}
	container.append(browser);
	// Block popups and new windows from the embedded page
	browser.browsingContext.sandboxFlags |= SANDBOXED_AUXILIARY_NAVIGATION;

	if (onWindowCreated) {
		browser.addEventListener("DOMWindowCreated", (event) => {
			if (event.target === browser.contentDocument) {
				onWindowCreated(browser);
			}
		});
	}

	let deferred = Zotero.Promise.defer();
	// Sync the browser height with the page root's height, so the page
	// scrolls in the surrounding chrome like native content
	let startHeightSync = () => {
		let contentWin = browser.contentWindow;
		let root = browser.contentDocument.documentElement;
		let observer = new contentWin.ResizeObserver(Cu.exportFunction(() => {
			// Ceil so a fractional height can't leave 1px of overflow
			browser.style.height = Math.ceil(root.getBoundingClientRect().height) + "px";
		}, contentWin));
		observer.observe(root);
	};
	let progressListener = {
		onStateChange(webProgress, request, stateFlags, status) {
			if (!webProgress.isTopLevel) {
				return;
			}
			let uri;
			try {
				let channel = request.QueryInterface(Ci.nsIChannel);
				// moz-extension: loads redirect internally to the underlying
				// file: channel, so check the original URI
				uri = channel.originalURI || channel.URI;
			}
			catch {
				return;
			}
			if (stateFlags & Ci.nsIWebProgressListener.STATE_START) {
				if (uri.spec === "about:blank" || uri.spec === src) {
					return;
				}
				request.cancel(Cr.NS_BINDING_ABORTED);
				if (/^https?$/.test(uri.scheme)) {
					Zotero.launchURL(uri.spec);
				}
			}
			else if ((stateFlags & Ci.nsIWebProgressListener.STATE_STOP)
					&& (stateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW)
					&& uri.spec === src) {
				if (Components.isSuccessCode(status)) {
					startHeightSync();
					// Fluent via <link rel="localization"> in the page
					WindowScopeVariables.setupContentL10n(browser)
						.then(() => deferred.resolve());
				}
				else {
					deferred.resolve();
				}
			}
		},
		QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"]),
	};
	// The listener is weakly held -- keep it alive for the browser's lifetime
	browser._zoteroEmbeddedProgressListener = progressListener;
	browser.browsingContext.webProgress.addProgressListener(
		progressListener,
		Ci.nsIWebProgress.NOTIFY_STATE_ALL
	);
	let nsURI = Services.io.newURI(src);
	browser.loadURI(nsURI, {
		triggeringPrincipal: Services.scriptSecurityManager.createContentPrincipal(nsURI, {}),
	});
	return { browser, loadPromise: deferred.promise };
}
