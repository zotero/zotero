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
import { PluginPageChannel } from "chrome://zotero/content/xpcom/plugins/pageChannel.mjs";

// https://searchfox.org/mozilla-central/source/dom/base/nsSandboxFlags.h
const SANDBOXED_AUXILIARY_NAVIGATION = 0x2;
const SANDBOXED_TOPLEVEL_NAVIGATION = 0x4;
const SANDBOXED_TOPLEVEL_NAVIGATION_USER_ACTIVATION = 0x20000;

// webProgress holds progress listeners weakly, so anchor each browser's
// navigation guard here; the entry is GC'd with the browser
const navigationGuards = new WeakMap();

// Drive auto-resize through the ZoteroEmbeddedPluginPage actor: a child in the
// page's process observes the content and messages chrome, which sizes the host.
function startAutoResize(element, axes = {}) {
	let height = !!axes.height;
	let width = !!axes.width;
	if (!height && !width) {
		return;
	}
	let global = element.browsingContext?.currentWindowGlobal;
	if (!global) {
		return;
	}
	try {
		global.getActor("ZoteroEmbeddedPluginPage").sendAsyncMessage("startAutoResize", { height, width });
	}
	catch (e) {
		Zotero.debug("Embedded plugin page: resize actor unavailable. " + e);
	}
}

/**
 * Shared host for every embedded plugin page: a non-remote chrome `<browser>` for
 * a system-principal document or a content `<iframe>` otherwise, chosen automatically.
 *
 * @param {Element|Document} container - Element to append the host to (also its
 * 		owner document); pass a document with `options.append` when the caller
 * 		inserts the host itself rather than into a single container element
 * @param {string} src - Absolute URL of a page within the plugin
 * @param {Object} [options]
 * @param {string} [options.className] - Class name for the host element
 * @param {number} [options.width] - Explicit width in px (iframe host)
 * @param {number} [options.height] - Explicit height in px (iframe host)
 * @param {Function} [options.append] - Inserts the host element; defaults to
 * 		`container.append(el)`
 * @param {{height?: boolean, width?: boolean}} [options.autoResize] - Axes on
 * 		which the host follows the page's own root size (each axis defaults false)
 * @param {boolean} [options.channel=false] - Create a `PluginPageChannel` for
 * 		the page; leave false for a static page that needs no messaging
 * @param {string} [options.pluginID] - Owning plugin ID (for the channel)
 * @param {Function} [options.onHostMessage] - Chrome-side raw message handler
 * 		for the channel, for pages the plugin sandbox doesn't hook
 * @param {Function} [options.onWindowCreated] - Called with the browser when
 * 		the content window is created, before any page script runs (browser host)
 * @returns {Promise<{ element: Element, messenger: object, dispose: function }>}
 * 		Resolves once the page loads; the host is inserted synchronously (before the
 * 		first await) so a non-awaiting caller still gets `element`
 */
export async function loadEmbeddedPluginPage(container, src, { className, onWindowCreated, width, height, append, autoResize = {}, channel = false, pluginID, onHostMessage } = {}) {
	let ownerDoc = Cu.unwaiveXrays(container.ownerDocument || container);
	let insert = append || (el => container.append(el));
	let deferred = Zotero.Promise.defer();

	// Channel is built once the page loads (the actor binds to the loaded doc)
	let makeChannel = () => (channel
		? PluginPageChannel.create({ element, pluginID, onHostMessage })
		: PluginPageChannel.empty());
	let element;

	// Content-principal document: host it in a content <iframe>
	if (!ownerDoc.nodePrincipal?.isSystemPrincipal) {
		let iframe = ownerDoc.createElement("iframe");
		element = iframe;
		if (className) {
			iframe.className = className;
		}
		if (width) {
			iframe.style.width = width + "px";
		}
		if (height) {
			iframe.style.height = height + "px";
		}
		iframe.setAttribute("src", src);
		let onLoad = () => {
			iframe.removeEventListener("load", onLoad);
			deferred.resolve();
		};
		iframe.addEventListener("load", onLoad);
		insert(iframe);
		await deferred.promise;
		let { messenger, dispose } = makeChannel();
		startAutoResize(iframe, autoResize);
		return { element: iframe, messenger, dispose };
	}

	// Chrome-hosted browser, non-remote so moz-extension: pages load in the
	// parent process (see plugins/protocol.mjs)
	let browser = ownerDoc.createXULElement("browser");
	element = browser;
	browser.setAttribute("type", "content");
	browser.setAttribute("disableglobalhistory", "true");
	if (className) {
		browser.classList.add(className);
	}
	insert(browser);
	// Block popups from the embedded page and top navigation from frames nested
	// inside it; self-navigation is unaffected and handled by the guard below
	browser.browsingContext.sandboxFlags |= SANDBOXED_AUXILIARY_NAVIGATION
		| SANDBOXED_TOPLEVEL_NAVIGATION
		| SANDBOXED_TOPLEVEL_NAVIGATION_USER_ACTIVATION;

	if (onWindowCreated) {
		browser.addEventListener("DOMWindowCreated", (event) => {
			if (event.target === browser.contentDocument) {
				onWindowCreated(browser);
			}
		});
	}

	// Compare load URIs ignoring the ref so a fragment in `src` still counts
	let srcNoRef = Services.io.newURI(src).specIgnoringRef;
	let progressListener = {
		onStateChange(webProgress, request, stateFlags, status) {
			if (!webProgress.isTopLevel) {
				return;
			}
			let uri;
			try {
				let requestChannel = request.QueryInterface(Ci.nsIChannel);
				// moz-extension: loads redirect internally to the underlying
				// file: channel, so check the original URI
				uri = requestChannel.originalURI || requestChannel.URI;
			}
			catch {
				return;
			}
			if (stateFlags & Ci.nsIWebProgressListener.STATE_START) {
				if (uri.spec === "about:blank" || uri.specIgnoringRef === srcNoRef) {
					return;
				}
				request.cancel(Cr.NS_BINDING_ABORTED);
				if (/^https?$/.test(uri.scheme)) {
					Zotero.launchURL(uri.spec);
				}
			}
			else if ((stateFlags & Ci.nsIWebProgressListener.STATE_STOP)
					&& (stateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW)
					&& uri.specIgnoringRef === srcNoRef) {
				if (Components.isSuccessCode(status)) {
					// Fluent via <link rel="localization"> in the page
					WindowScopeVariables.setupContentL10n(browser)
						.then(() => deferred.resolve(true));
				}
				else {
					deferred.resolve(false);
				}
			}
		},
		QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"]),
	};
	navigationGuards.set(browser, progressListener);
	browser.browsingContext.webProgress.addProgressListener(
		progressListener,
		Ci.nsIWebProgress.NOTIFY_STATE_ALL
	);
	let nsURI = Services.io.newURI(src);
	browser.loadURI(nsURI, {
		triggeringPrincipal: Services.scriptSecurityManager.createContentPrincipal(nsURI, {}),
	});
	let ok = await deferred.promise;
	let { messenger, dispose } = ok ? makeChannel() : PluginPageChannel.empty();
	if (ok) {
		startAutoResize(browser, autoResize);
	}
	return { element: browser, messenger, dispose };
}
