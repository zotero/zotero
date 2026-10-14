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
		global.getActor("ZoteroEmbeddedPluginPage")
			.sendAsyncMessage("startAutoResize", { height, width, content: !!axes.content });
	}
	catch (e) {
		Zotero.debug("Embedded plugin page: resize actor unavailable. " + e);
	}
}

// Stop the actor-driven auto-resize; the host keeps its last applied size
export function stopAutoResize(element) {
	let global = element.browsingContext?.currentWindowGlobal;
	if (!global) {
		return;
	}
	try {
		global.getActor("ZoteroEmbeddedPluginPage").sendAsyncMessage("stopAutoResize", {});
	}
	catch (e) {
		Zotero.debug("Embedded plugin page: resize actor unavailable. " + e);
	}
}

/**
 * Set up l10n on a content document inside a `<browser>` element: creates a
 * DOMLocalization from the page's `<link rel="localization">` tags.
 *
 * @param {XULElement} browser - The `<browser>` element containing the content
 * @returns {Promise} Resolves when initial translation is complete
 */
function setupContentL10n(browser) {
	let contentDoc = browser.contentDocument;
	let contentWin = browser.contentWindow;
	let l10n = new contentWin.DOMLocalization([], false);
	l10n.connectRoot(contentDoc.documentElement);

	// Collect initial <link rel="localization"> resource IDs
	let links = contentDoc.querySelectorAll('link[rel="localization"]');
	if (links.length) {
		l10n.addResourceIds(
			Array.from(links).map(link => link.getAttribute('href'))
		);
	}

	// Observe <link rel="localization"> additions/removals to mirror
	// the DocumentL10n behavior that chrome documents get natively.
	let observer = new contentWin.MutationObserver((mutations) => {
		let addIds = [];
		let removeIds = [];
		for (let mutation of mutations) {
			for (let node of mutation.addedNodes) {
				if (node.nodeName === "LINK"
					&& node.getAttribute("rel") === "localization"
					&& node.getAttribute("href")) {
					addIds.push(node.getAttribute("href"));
				}
			}
			for (let node of mutation.removedNodes) {
				if (node.nodeName === "LINK"
					&& node.getAttribute("rel") === "localization"
					&& node.getAttribute("href")) {
					removeIds.push(node.getAttribute("href"));
				}
			}
		}
		if (removeIds.length) {
			l10n.removeResourceIds(removeIds);
		}
		if (addIds.length) {
			l10n.addResourceIds(addIds);
		}
		if (addIds.length || removeIds.length) {
			l10n.translateRoots();
		}
	});
	observer.observe(contentDoc.documentElement, {
		childList: true,
		subtree: true,
	});

	// Clean up when the content window is closed
	contentWin.addEventListener("unload", () => {
		observer.disconnect();
		l10n.disconnectRoot(contentDoc.documentElement);
	}, { once: true });

	Cu.waiveXrays(contentDoc).l10n = l10n;
	return l10n.translateRoots();
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
 * @param {{height?: boolean, width?: boolean, content?: boolean}} [options.autoResize] - Axes on
 * 		which the host follows the page's root size (each axis defaults false);
 * 		`content` reports the full document scroll size, for a self-fitting host
 * @param {boolean} [options.channel=false] - Create a `PluginPageChannel` for
 * 		the page; leave false for a static page that needs no messaging
 * @param {string} [options.pluginID] - Owning plugin ID (for the channel)
 * @param {Object} [options.hostAPI] - Name -> handler exposed to the page as
 * 		`zoteroHost.api.<name>(params)`; see `PluginPageChannel.setHostAPI`
 * @param {Function} [options.onWindowCreated] - Called with the browser when
 * 		the content window is created, before any page script runs (browser host)
 * @returns {Promise<{ element: Element, messenger: object, dispose: function }>}
 * 		Resolves once the page loads; the host is inserted synchronously (before the
 * 		first await) so a non-awaiting caller still gets `element`
 */
export async function loadEmbeddedPluginPage(container, src, { className, onWindowCreated, width, height, append, autoResize = {}, channel = false, pluginID, hostAPI } = {}) {
	let ownerDoc = Cu.unwaiveXrays(container.ownerDocument || container);
	let insert = append || (el => container.append(el));

	let useIframe = !ownerDoc.nodePrincipal?.isSystemPrincipal;

	if (useIframe) {
		let iframe = ownerDoc.createElement("iframe");
		if (className) {
			iframe.className = className;
		}
		if (width) {
			iframe.style.width = width + "px";
		}
		if (height) {
			iframe.style.height = height + "px";
		}
		// Wire the load synchronously, then insert -- the load starts on insertion
		let loaded = loadPluginPageInIframe(iframe, src, {
			autoResize, channel, pluginID, hostAPI,
		});
		insert(iframe);
		let { messenger, dispose } = await loaded;
		return { element: iframe, messenger, dispose };
	}
	else {
		let browser = ownerDoc.createXULElement("browser");
		browser.setAttribute("type", "content");
		browser.setAttribute("disableglobalhistory", "true");
		browser.setAttribute("autocompletepopup", "PopupAutoComplete");
		if (className) {
			browser.classList.add(className);
		}
		insert(browser);
		let { messenger, dispose } = await loadPluginPageInBrowser(browser, src, {
			onWindowCreated, autoResize, channel, pluginID, hostAPI,
		});
		return { element: browser, messenger, dispose };
	}
}

/**
 * Load a plugin page into a content `<iframe>` with the `loadEmbeddedPluginPage`
 * messaging; `src` is set synchronously, so a detached iframe loads on insertion.
 *
 * @param {Element} iframe - An `<iframe>` in a content-principal document
 * @param {string} src - Absolute URL of a page within the plugin
 * @param {Object} [options] - `autoResize`, `channel`, `pluginID`,
 * 		`hostAPI`, as in `loadEmbeddedPluginPage`
 * @returns {Promise<{ messenger: object, dispose: function }>} Resolves once
 * 		the page loads; `messenger` is null without a channel
 */
export async function loadPluginPageInIframe(iframe, src, { autoResize = {}, channel = false, pluginID, hostAPI } = {}) {
	let deferred = Zotero.Promise.defer();
	let onLoad = () => {
		iframe.removeEventListener("load", onLoad);
		deferred.resolve();
	};
	iframe.addEventListener("load", onLoad);
	iframe.setAttribute("src", src);
	await deferred.promise;
	// Bound once the page loads, so the actor pair is the loaded doc's
	PluginPageChannel.setHostAPI(iframe, hostAPI);
	let { messenger, dispose } = channel
		? PluginPageChannel.create({ element: iframe, pluginID })
		: PluginPageChannel.empty();
	startAutoResize(iframe, autoResize);
	return { messenger, dispose };
}

/**
 * Load a plugin page into an existing, already-connected content `<browser>`
 * with the same protections and messaging the `loadEmbeddedPluginPage` hosts get.
 *
 * @param {XULElement} browser - A connected, non-remote `<browser type="content">`
 * @param {string} src - Absolute URL of a page within the plugin
 * @param {Object} [options] - `onWindowCreated`, `autoResize`, `channel`,
 * 		`pluginID`, `hostAPI`, as in `loadEmbeddedPluginPage`
 * @returns {Promise<{ messenger: object, dispose: function }>} Resolves once
 * 		the page loads; `messenger` is null without a channel or on load failure
 */
export async function loadPluginPageInBrowser(browser, src, { onWindowCreated, autoResize = {}, channel = false, pluginID, hostAPI } = {}) {
	let deferred = Zotero.Promise.defer();
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
					setupContentL10n(browser)
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
	// Bound once the page loads, so the actor pair is the loaded doc's
	let { messenger, dispose } = (ok && channel)
		? PluginPageChannel.create({ element: browser, pluginID })
		: PluginPageChannel.empty();
	if (ok) {
		PluginPageChannel.setHostAPI(browser, hostAPI);
		startAutoResize(browser, autoResize);
	}
	return { messenger, dispose };
}
