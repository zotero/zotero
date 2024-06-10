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

ChromeUtils.import("chrome://zotero/content/actors/ActorManager.jsm");

/* global HiddenFrame, E10SUtils, this */
XPCOMUtils.defineLazyModuleGetters(this, {
	E10SUtils: "resource://gre/modules/E10SUtils.jsm",
	HiddenFrame: "resource://gre/modules/HiddenFrame.jsm",
	setTimeout: "resource://gre/modules/Timer.jsm",
});
ChromeUtils.defineESModuleGetters(this, {
	Zotero: "chrome://zotero/content/zotero.mjs"
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
	 * @param {Boolean} [options.useHiddenFrame=true] Use a hidden frame to create the browser.
	 * 		Must be set to false if intending to call print().
	 * @param {Zotero.CookieSandbox} [options.cookieSandbox]
	 */
	constructor(options = {}) {
		this._destroyed = false;
		this._createdPromise = (async () => {
			let doc;
			if (options.useHiddenFrame !== false) {
				var frame = new HiddenFrame();
				this._frame = frame;

				var windowlessBrowser = await frame.get();
				windowlessBrowser.browsingContext.allowJavascript = options.allowJavaScript !== false;
				windowlessBrowser.docShell.allowImages = false;
				if (options.docShell) {
					Object.assign(windowlessBrowser.docShell, options.docShell);
				}
				doc = windowlessBrowser.document;
			}
			else {
				doc = Zotero.getMainWindow()?.document;
				if (!doc) {
					throw new Error("HiddenBrowser with useHiddenFrame: false requires the main window to be open");
				}
				if ('allowJavaScript' in options || 'docShell' in options) {
					throw new Error("allowJavaScript and docShell options are only supported with useHiddenFrame: true");
				}
			}
			var browser = doc.createXULElement("browser");
			browser.setAttribute("type", "content");
			browser.setAttribute("remote", "true");
			browser.setAttribute('maychangeremoteness', 'true');
			browser.setAttribute("disableglobalhistory", "true");
			browser.style.display = "none";
			doc.documentElement.appendChild(browser);
			
			if (options.cookieSandbox) {
				options.cookieSandbox.attachToBrowser(browser);
			}
			
			if (Zotero.Debug.enabled) {
				startLeakWarningTimer(browser);
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
	 * @param {Object} [options]
	 * @param {Boolean} [options.requireSuccessfulStatus]
	 * @returns {Promise<boolean>}
	 */
	async load(source, options) {
		await this._createdPromise;
		let uri;
		if (/^(file|https?|chrome|resource|blob|data):/.test(source)) {
			uri = source;
		}
		// Convert string path to file: URL
		else {
			uri = Zotero.File.pathToFileURI(source);
		}
			
		Zotero.debug(`Loading ${uri} in hidden browser`);
		// Next bit adapted from Mozilla's HeadlessShell.jsm
		try {
			// Figure out whether the browser should be remote. We actually
			// perform the load in PageDataChild, but remoteness changes
			// need to happen here.
			let oa = E10SUtils.predictOriginAttributes({ browser: this });
			let remoteType = E10SUtils.getRemoteTypeForURI(
				uri,
				true,
				false,
				E10SUtils.DEFAULT_REMOTE_TYPE,
				null,
				oa
			);
			if (this.remoteType !== remoteType) {
				// The following functions need to be called on the <browser> directly,
				// not through our proxy (aka 'this')
				if (remoteType === E10SUtils.NOT_REMOTE) {
					this._browser.removeAttribute("remote");
					this._browser.removeAttribute("remoteType");
				}
				else {
					this._browser.setAttribute("remote", "true");
					this._browser.setAttribute("remoteType", remoteType);
				}
				this._browser.changeRemoteness({ remoteType });
				this._browser.construct();
			}

			let loadCompletePromise = new Promise((resolve, reject) => {
				// Avoid a hang if page is never loaded for some reason
				setTimeout(function () {
					reject(new Error("Page never loaded in hidden browser"));
				}, 5000);
				
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
						if (location.spec == "about:blank" && uri != "about:blank") {
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

			let loadURISuccess = await this.browsingContext.currentWindowGlobal.getActor("PageData")
				.sendQuery("loadURI", { uri });
			if (!loadURISuccess) {
				Zotero.logError(new Error("Load failed"));
				return false;
			}
			await loadCompletePromise;
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
		
		if (options?.requireSuccessfulStatus) {
			let { channelInfo } = await this.getPageData(['channelInfo']);
			if (channelInfo && (channelInfo.responseStatus < 200 || channelInfo.responseStatus >= 400)) {
				let response = `${channelInfo.responseStatus} ${channelInfo.responseStatusText}`;
				Zotero.debug(`HiddenBrowser.load: ${uri} failed with ${response}`, 2);
				// HiddenBrowser will never get returned so we need to clean it up here
				this.destroy()
				throw new Zotero.HTTP.UnexpectedStatusException(
					{
						status: channelInfo.responseStatus
					},
					uri,
					`Invalid response ${response} for ${uri}`
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

	/**
	 * @param {Object} [options]
	 * @returns {Promise<void>}
	 */
	print(options) {
		if (this._frame) {
			throw new Error("Printing is not supported with useHiddenFrame: true");
		}
		let actor = this.browsingContext.currentWindowGlobal.getActor("ZoteroPrint");
		return actor.zoteroPrint(options);
	}

	destroy() {
		if (!this._destroyed) {
			this._destroyed = true;
			(async () => {
				await this._createdPromise;
				this._blockingObserver?.unregister(this._browser);
				if (this._frame) {
					this._frame.destroy();
					this._frame = null;
				}
				else {
					this._browser.remove();
				}
				Zotero.debug("Deleted hidden browser");
			})();
		}
	}
}

function startLeakWarningTimer(browser) {
	const CHECK_AFTER_SECONDS = 60;
	
	// We need to use Cu.getWeakReference() to get an xpcIJSWeakReference here -
	// DOM WeakRefs, paradoxically, keep the browser alive
	let weakBrowser = Cu.getWeakReference(browser);
	browser = null;
	arguments.length = 0;
	
	setTimeout(() => {
		let browser = weakBrowser.get();
		if (browser) {
			Zotero.debug(`Browser object still alive after ${CHECK_AFTER_SECONDS} seconds - memory leak?`);
			Zotero.debug('Viewing URI ' + browser.currentURI?.spec)
		}
	}, 1000 * CHECK_AFTER_SECONDS);
}
