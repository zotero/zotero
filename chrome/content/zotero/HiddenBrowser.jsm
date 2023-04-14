/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2022 Corporation for Digital Scholarship
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


var EXPORTED_SYMBOLS = ["HiddenBrowser"];

const { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

/* global HiddenFrame, E10SUtils, this */
XPCOMUtils.defineLazyModuleGetters(this, {
	E10SUtils: "resource://gre/modules/E10SUtils.jsm",
	HiddenFrame: "resource://gre/modules/HiddenFrame.jsm",
	Services: "resource://gre/modules/Services.jsm",
	setTimeout: "resource://gre/modules/Timer.jsm",
	Zotero: "chrome://zotero/content/include.jsm"
});

ChromeUtils.registerWindowActor("PageData", {
	child: {
		moduleURI: "chrome://zotero/content/actors/PageDataChild.jsm"
	}
});

const progressListeners = new Set();
const browserFrameMap = new WeakMap();

/**
 * Functions for creating and destroying hidden browser objects
 **/
const HiddenBrowser = {
	/**
	 * @param {String} source - HTTP URL, file: URL, or file path
	 * @param {Object} options
	 * @param {Boolean} [options.allowJavaScript]
	 * @param {Object} [options.docShell] Fields to set on Browser.docShell
	 * @param {Boolean} [options.requireSuccessfulStatus]
	 * @param {Zotero.CookieSandbox} [options.cookieSandbox]
	 */
	async create(source, options = {}) {
		let url;
		if (/^(file|https?):/.test(source)) {
			url = source;
		}
		// Convert string path to file: URL
		else {
			url = Zotero.File.pathToFileURI(source);
		}
		
		Zotero.debug(`Loading ${url} in hidden browser`);
		
		var frame = new HiddenFrame();
		var windowlessBrowser = await frame.get();
		windowlessBrowser.browsingContext.allowJavascript = options.allowJavaScript !== false;
		windowlessBrowser.docShell.allowImages = false;
		if (options.docShell) {
			Object.assign(windowlessBrowser.docShell, options.docShell);
		}
		var doc = windowlessBrowser.document;
		var browser = doc.createXULElement("browser");
		browser.setAttribute("type", "content");
		browser.setAttribute("remote", "true");
		browser.setAttribute('maychangeremoteness', 'true');
		browser.setAttribute("disableglobalhistory", "true");
		doc.documentElement.appendChild(browser);
		
		if (options.cookieSandbox) {
			options.cookieSandbox.attachToBrowser(browser);
		}
		
		browserFrameMap.set(browser, frame);
		
		if (Zotero.Debug.enabled) {
			let weakBrowser = new WeakRef(browser);
			setTimeout(() => {
				let browser = weakBrowser.deref();
				if (browser && browserFrameMap.has(browser)) {
					Zotero.debug('Browser object still alive after 60 seconds - memory leak?');
					Zotero.debug('Viewing URI ' + browser.currentURI?.spec)
				}
			}, 1000 * 60);
		}
		
		// Next bit adapted from Mozilla's HeadlessShell.jsm
		const principal = Services.scriptSecurityManager.getSystemPrincipal();
		try {
			await new Promise((resolve, reject) => {
				// Avoid a hang if page is never loaded for some reason
				setTimeout(function () {
					reject(new Error("Page never loaded in hidden browser"));
				}, 5000);
				
				let oa = E10SUtils.predictOriginAttributes({ browser });
				let loadURIOptions = {
					triggeringPrincipal: principal,
					remoteType: E10SUtils.getRemoteTypeForURI(
						url,
						true,
						false,
						E10SUtils.DEFAULT_REMOTE_TYPE,
						null,
						oa
					)
				};
				browser.loadURI(url, loadURIOptions);
				let { webProgress } = browser;
				
				let progressListener = {
					onLocationChange(progress, request, location, flags) {
						// Ignore inner-frame events
						if (!progress.isTopLevel) {
							return;
						}
						// Ignore events that don't change the document
						if (flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT) {
							return;
						}
						// Ignore the initial about:blank, unless about:blank is requested
						if (location.spec == "about:blank" && url != "about:blank") {
							return;
						}
						progressListeners.delete(progressListener);
						webProgress.removeProgressListener(progressListener);
						resolve();
					},
					QueryInterface: ChromeUtils.generateQI([
						"nsIWebProgressListener",
						"nsISupportsWeakReference"
					])
				};
				
				progressListeners.add(progressListener);
				webProgress.addProgressListener(
					progressListener,
					Ci.nsIWebProgress.NOTIFY_LOCATION
				);
			});
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
		
		if (options.requireSuccessfulStatus) {
			let { channelInfo } = await this.getPageData(browser, ['channelInfo']);
			if (channelInfo && (channelInfo.responseStatus < 200 || channelInfo.responseStatus >= 400)) {
				let response = `${channelInfo.responseStatus} ${channelInfo.responseStatusText}`;
				Zotero.debug(`HiddenBrowser.create: ${url} failed with ${response}`, 2);
				throw new Zotero.HTTP.UnexpectedStatusException(
					{
						status: channelInfo.responseStatus
					},
					url,
					`Invalid response ${response} for ${url}`
				);
			}
		}
		
		return browser;
	},
	
	/**
	 * @param {Browser} browser
	 * @param {String[]} props - 'characterSet', 'title', 'bodyText'
	 */
	async getPageData(browser, props) {
		var actor = browser.browsingContext.currentWindowGlobal.getActor("PageData");
		var data = {};
		for (let prop of props) {
			data[prop] = await actor.sendQuery(prop);
		}
		return data;
	},
	
	destroy(browser) {
		var frame = browserFrameMap.get(browser);
		if (frame) {
			frame.destroy();
			Zotero.debug("Deleted hidden browser");
			browserFrameMap.delete(frame);
		}
	}
};
