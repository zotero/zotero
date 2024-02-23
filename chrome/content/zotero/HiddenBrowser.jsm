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
const { BlockingObserver } = ChromeUtils.import("chrome://zotero/content/BlockingObserver.jsm");

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

ChromeUtils.registerWindowActor("SingleFile", {
	child: {
		moduleURI: "chrome://zotero/content/actors/SingleFileChild.jsm"
	}
});

const progressListeners = new Set();

/**
 * Functions for creating and destroying hidden browser objects
 **/
class HiddenBrowser {
	/**
	 * @param {Object} options
	 * @param {Boolean} [options.allowJavaScript]
	 * @param {Object} [options.docShell] Fields to set on Browser.docShell
	 * @param {Boolean} [options.blockRemoteResources] Block all remote (non-file:) resources
	 * @param {Zotero.CookieSandbox} [options.cookieSandbox]
	 */
	constructor(options = {}) {
		var frame = new HiddenFrame();
		this._createdPromise = (async () => {
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
			
			if (Zotero.Debug.enabled) {
				let weakBrowser = new WeakRef(browser);
				setTimeout(() => {
					let browser = weakBrowser.deref();
					if (browser && this._frame) {
						Zotero.debug('Browser object still alive after 60 seconds - memory leak?');
						Zotero.debug('Viewing URI ' + browser.currentURI?.spec)
					}
				}, 1000 * 60);
			}
			
			if (options.blockRemoteResources) {
				this._blockingObserver = new BlockingObserver({
					shouldBlock(uri) {
						return uri.scheme !== 'file';
					}
				});
				this._blockingObserver.register(browser);
			}
			
			this._browser = browser;
		})();

		this._frame = frame;
		return new Proxy(this, {
			get(target, prop) {
				if (prop in target) {
					return target[prop];
				}
				if (!target._browser) throw new Error(`Attempting to use the HiddenBrowser before it is fully initialized. Await browser._createdPromise.`);
				return Reflect.get(target._browser, prop);
			},
			set(target, prop, val) {
				if (prop in target) {
					target[prop] = val;
				}
				Reflect.set(target._browser, prop, val)
				return true;
			}
		});
	}

	/**
	 * 
	 * @param {String} source - HTTP URL, file: URL, or file path
	 * @param {Object} options
	 * @param {Boolean} [options.requireSuccessfulStatus]
	 * @returns {Promise<boolean>}
	 */
	async load(source, options) {
		await this._createdPromise;
		let url;
		if (/^(file|https?|chrome|resource|blob):/.test(source)) {
			url = source;
		}
		// Convert string path to file: URL
		else {
			url = Zotero.File.pathToFileURI(source);
		}
			
		Zotero.debug(`Loading ${url} in hidden browser`);
		// Next bit adapted from Mozilla's HeadlessShell.jsm
		const principal = Services.scriptSecurityManager.getSystemPrincipal();
		try {
			await new Promise((resolve, reject) => {
				// Avoid a hang if page is never loaded for some reason
				setTimeout(function () {
					reject(new Error("Page never loaded in hidden browser"));
				}, 5000);
				
				let oa = E10SUtils.predictOriginAttributes({ browser: this });
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
				this.loadURI(url, loadURIOptions);
				let { webProgress } = this;
				
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
		
		if (options?.requireSuccessfulStatus) {
			let { channelInfo } = await this.getPageData(['channelInfo']);
			if (channelInfo && (channelInfo.responseStatus < 200 || channelInfo.responseStatus >= 400)) {
				let response = `${channelInfo.responseStatus} ${channelInfo.responseStatusText}`;
				Zotero.debug(`HiddenBrowser.load: ${url} failed with ${response}`, 2);
				// HiddenBrowser will never get returned so we need to clean it up here
				this.destroy()
				throw new Zotero.HTTP.UnexpectedStatusException(
					{
						status: channelInfo.responseStatus
					},
					url,
					`Invalid response ${response} for ${url}`
				);
			}
		}
	}
	
	/**
	 * @param {String[]} props - 'characterSet', 'title', 'bodyText', 'documentHTML', 'cookie', 'channelInfo'
	 */
	async getPageData(props) {
		var actor = this.browsingContext.currentWindowGlobal.getActor("PageData");
		var data = {};
		for (let prop of props) {
			data[prop] = await actor.sendQuery(prop);
		}
		return data;
	}

	/**
	 * @returns {Promise<Document>}
	 */
	async getDocument() {
		let { documentHTML, cookie } = await this.getPageData(['documentHTML', 'cookie']);
		let doc = new DOMParser().parseFromString(documentHTML, 'text/html');
		let docWithLocation = Zotero.HTTP.wrapDocument(doc, this.currentURI);
		return new Proxy(docWithLocation, {
			get(obj, prop) {
				if (prop === 'cookie') {
					return cookie;
				}
				return obj[prop];
			}
		});
	}

	/**
	 * @returns {Promise<String>}
	 */
	snapshot() {
		let actor = this.browsingContext.currentWindowGlobal.getActor("SingleFile");
		return actor.sendQuery('snapshot');
	}

	destroy() {
		if (this._frame) {
			(async () => {
				await this._createdPromise;
				this._blockingObserver?.unregister(this._browser);
				this._frame.destroy();
				this._frame = null;
				Zotero.debug("Deleted hidden browser");
			})();
		}
	}
};
