/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2023 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
					http://zotero.org
	
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

const { HiddenBrowser } = ChromeUtils.importESModule("chrome://zotero/content/HiddenBrowser.mjs");

Zotero.BrowserDownload = {
	HANDLED_URLS: {
		'https://zotero-static.s3.amazonaws.com/test-pdf-redirect.html': "html",
		'://www.sciencedirect.com': "#captcha-box"
	},

	/**
	 * Checks whether the url can be handled as a hidden browser download
	 * @param {String} url
	 */
	shouldAttemptDownloadViaBrowser: function (url) {
		const unproxiedUrls = Object.keys(Zotero.Proxies.getPotentialProxies(url));
		for (let unproxiedUrl of unproxiedUrls) {
			for (let checkUrl in this.HANDLED_URLS) {
				if (unproxiedUrl.includes(checkUrl)) {
					return checkUrl;
				}
			}
		}
		return false;
	},
	
	getCaptchaLocator(url) {
		const handlerKey = this.shouldAttemptDownloadViaBrowser(url);
		return this.HANDLED_URLS[handlerKey];
	},
	
	_makePDFMIMETypeHandler(browser, onPDFFound = () => 0) {
		let isOurPDF, channelBrowser;
		let trackedBrowser = browser;
		return {
			onStartRequest: function (name, _, channel) {
				Zotero.debug(`BrowserDownload: Sniffing a PDF loaded at ${name}`);
				// try the browser
				try {
					channelBrowser = channel.notificationCallbacks.getInterface(Ci.nsILoadContext).topFrameElement;
				}
				catch (e) {}
				if (channelBrowser) {
					isOurPDF = trackedBrowser === channelBrowser;
				}
				else {
					// try the document for the load group
					try {
						channelBrowser = channel.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext)
							.topFrameElement;
					}
					catch (e) {}
					if (channelBrowser) {
						isOurPDF = trackedBrowser === channelBrowser;
					}
				}
			},
			onContent: async (blob, name) => {
				if (isOurPDF) {
					Zotero.debug(`BrowserDownload: Found our PDF at ${name}`);
					onPDFFound(blob);
					return true;
				}
				else {
					Zotero.debug(`BrowserDownload: Not our PDF at ${name}`);
					return false;
				}
			}
		};
	},
	
	/**
	 * @param {String} url
	 * @param {String} path
	 * @param {Object} [options]
	 * @param {Boolean} [options.shouldDisplayCaptcha=false]
	 */
	async downloadPDF(url, path, options = {}) {
		Zotero.debug(`BrowserDownload: Downloading file via a hidden browser from ${url}`);

		let hiddenBrowser;
		let pdfMIMETypeHandler;
		let pdfFoundDeferred = Zotero.Promise.defer();

		// Technically this is not a download, but the full operation (load, redirect, etc) timeout
		const downloadTimeout = Zotero.Prefs.get('downloadPDFViaBrowser.downloadTimeout');
		const onLoadTimeout = Zotero.Prefs.get('downloadPDFViaBrowser.onLoadTimeout');

		try {
			hiddenBrowser = new HiddenBrowser();
			await hiddenBrowser._createdPromise;
			
			let pdfLoaded = false;
			pdfMIMETypeHandler = this._makePDFMIMETypeHandler(hiddenBrowser._browser, pdfFoundDeferred.resolve);
			Zotero.MIMETypeHandler.addHandlers("application/pdf", pdfMIMETypeHandler, true);
			
			let onLoadTimeoutDeferred = Zotero.Promise.defer();
			let currentUrl = "";
			hiddenBrowser.webProgress.addProgressListener({
				QueryInterface: ChromeUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference]),
				async onLocationChange() {
					let url = hiddenBrowser.currentURI.spec;
					if (currentUrl) {
						Zotero.debug(`BrowserDownload: A JS redirect occurred to ${url}`);
					}
					currentUrl = url;
					Zotero.debug(`BrowserDownload: Page with potential JS redirect loaded, giving it ${onLoadTimeout}ms to process`);
					await Zotero.Promise.delay(onLoadTimeout);
					// If URL changed that means we got redirected and the onLoadTimeout needs to restart
					if (currentUrl === url && !pdfLoaded) {
						onLoadTimeoutDeferred.reject(new Error(`BrowserDownload: Loading PDF via a hidden browser timed out on the JS challenge page after ${onLoadTimeout}ms`));
					}
				}
			}, Ci.nsIWebProgress.NOTIFY_LOCATION);
			
			hiddenBrowser.load(url);
			let blob = await Promise.race([
				onLoadTimeoutDeferred.promise,
				Zotero.Promise.delay(downloadTimeout).then(() => {
					if (!pdfLoaded) {
						throw new Error(`BrowserDownload: Loading PDF via a hidden browser timed out after ${downloadTimeout}ms`);
					}
				}),
				// Resolves PDF blob
				pdfFoundDeferred.promise
			]);
			
			pdfLoaded = true;
			await Zotero.File.putContentsAsync(path, blob);
		}
		catch (e) {
			try {
				await OS.File.remove(path, { ignoreAbsent: true });
			}
			catch (err) {
				Zotero.logError(err);
			}
			if (options?.shouldDisplayCaptcha) {
				Zotero.debug(`BrowserDownload: Downloading via a hidden browser failed due to ${e.message}`);
				const captchaLocator = this.getCaptchaLocator(url);
				if (captchaLocator) {
					let doc = await hiddenBrowser.getDocument();
					let elem = doc.querySelector(captchaLocator);
					if (elem) {
						return this.downloadPDFViaViewer(url, path, options);
					}
				}
			}
			throw e;
		}
		finally {
			Zotero.MIMETypeHandler.removeHandlers('application/pdf', pdfMIMETypeHandler);
			if (hiddenBrowser) {
				hiddenBrowser.destroy();
			}
		}
	},
	
	async downloadPDFViaViewer(url, path, options) {
		Zotero.debug(`BrowserDownload: Downloading file via the document viewer for captcha clearing from ${url}`);
		
		let win, browser, xulWin, wmListener;
		let pdfMIMETypeHandler;
		let pdfFound;
		let pdfFoundDeferred = Zotero.Promise.defer();
		const downloadTimeout = Zotero.Prefs.get('downloadPDFViaBrowser.downloadTimeout');
		
		try {
			wmListener = {
				onOpenWindow(xulWindow) {
					xulWin = xulWin || xulWindow;
				},
				onCloseWindow(xulWindow) {
					if (xulWin === xulWindow && !pdfFound) {
						pdfFoundDeferred.reject(new Error("BrowserDownload: User closed the document viewer"));
					}
				}
			};
			Services.wm.addListener(wmListener);
			await new Promise((resolve) => {
				win = Zotero.openInViewer(url);
				win.addEventListener('load', resolve);
			});
			browser = win.document.querySelector('browser');
			Zotero.Utilities.Internal.activate(win);
			
			pdfMIMETypeHandler = this._makePDFMIMETypeHandler(browser, pdfFoundDeferred.resolve);
			Zotero.MIMETypeHandler.addHandlers("application/pdf", pdfMIMETypeHandler, true);
			
			Zotero.debug(`BrowserDownload: Awaiting the user to clear the captcha or timeout after ${downloadTimeout}`);
			let pdfBlob = await Promise.race([
				Zotero.Promise.delay(downloadTimeout).then(() => {
					if (!pdfFound) {
						throw new Error(`BrowserDownload: Loading PDF via document viewer timed out after ${downloadTimeout}ms`);
					}
				}),
				// Resolves PDF blob
				pdfFoundDeferred.promise
			]);
			pdfFound = true;
			await Zotero.File.putContentsAsync(path, pdfBlob);
		}
		catch (e) {
			try {
				await OS.File.remove(path, { ignoreAbsent: true });
			}
			catch (err) {
				Zotero.logError(err);
			}
			throw e;
		}
		finally {
			Zotero.MIMETypeHandler.removeHandlers('application/pdf', pdfMIMETypeHandler);
			Services.wm.removeListener(wmListener);
			if (win) {
				win.close();
			}
		}
	},
};
