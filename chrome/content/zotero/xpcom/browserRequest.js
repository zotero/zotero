/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
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

Zotero.BrowserRequest = {
	// Registry of URL patterns that need browser-mediated handling
	CHALLENGE_URLS: [
		{
			match: 'https://zotero-static.s3.amazonaws.com/test-pdf-redirect.html',
			captchaLocator: 'html'
		},
		{
			match: '://www.sciencedirect.com',
			captchaLocator: '#captcha-box'
		},
		{
			match: '://search.worldcat.org',
			// When /api/search returns 403 with turnstile_required, the user-
			// facing /search?q= page runs the matching invisible Turnstile
			// widget, POSTs the token to /api/turnstile-verify, and gets back
			// Set-Cookie: turnstile_passed. Loading that page in a hidden
			// browser reproduces the flow end-to-end with no user interaction.
			getChallengeURL: url => url.replace(/\/api\/search\b/, '/search'),
			// Invisible (managed) Turnstile; no user captcha interaction needed
			captchaLocator: null,
			// Wait for WorldCat's own Turnstile cookie to land
			successCookie: { host: 'search.worldcat.org', name: 'turnstile_passed' },
			// turnstile_passed is signed against (IP, UA), so we must use the
			// same plain-Firefox UA for the translator's follow-up requests as
			// the hidden browser used when earning it.
			plainUAHost: 'search.worldcat.org',
			detectBlock: (status, body) => status === 403 && /turnstile_required/.test(body)
		}
	],

	/**
	 * Look up a challenge entry for a URL, applying proxy unwrapping.
	 * @param {string} url
	 * @returns {object|null}
	 */
	getEntryForURL(url) {
		const unproxiedUrls = Object.keys(Zotero.Proxies.getPotentialProxies(url));
		for (let unproxiedUrl of unproxiedUrls) {
			for (let entry of this.CHALLENGE_URLS) {
				if (unproxiedUrl.includes(entry.match)) {
					return entry;
				}
			}
		}
		return null;
	},

	/**
	 * Navigate to a URL in a hidden browser, running its JS long enough for any
	 * client-side redirects or cookie-setting challenges to settle.
	 *
	 * Cookies acquired by the browser remain in the shared jar keyed on
	 * cookieContextId; a subsequent Zotero.HTTP.request using the same ID will
	 * see them.
	 *
	 * On timeout, if the page contains the entry's captchaLocator and
	 * allowViewer is set, escalates to clearChallengeInViewer().
	 *
	 * @param {string} url
	 * @param {object} [options]
	 * @param {number} [options.cookieContextId]
	 * @param {object} [options.entry] - registry entry controlling escalation
	 * @param {boolean} [options.allowViewer=false]
	 * @returns {Promise<void>}
	 */
	async clearChallenge(url, options = {}) {
		Zotero.debug(`BrowserRequest: Clearing challenge at ${url}`);

		let { cookieContextId, entry, allowViewer = false } = options;
		let successCookie = entry?.successCookie;
		// Capture the cookie's current value (if any) before the attempt so
		// we can tell a freshly-issued cookie from a stale one left over from
		// a previous session.
		let initialCookieValue = successCookie
			? this._readCookieValue({ ...successCookie, cookieContextId })
			: null;
		// Cloudflare Turnstile rejects the "Zotero/[version]" suffix.
		// A plain Firefox UA on just this browsing context lets the widget run.
		let customUserAgent = Zotero.VersionHeader.getPlainFirefoxUA();

		// Try the hidden browser first. _loadAndSettle() polls the cookie jar
		// and resolves as soon as successCookie appears, which may be well
		// before the page fully settles (or redirects somewhere else).
		let hiddenBrowser;
		try {
			hiddenBrowser = new HiddenBrowser({ cookieContextId, customUserAgent });
			await hiddenBrowser._createdPromise;
			await this._loadAndSettle(hiddenBrowser, url, {
				successCookie,
				cookieContextId
			});
		}
		catch (e) {
			Zotero.debug('BrowserRequest: Hidden browser attempt failed');
			Zotero.logError(e);
		}
		finally {
			if (hiddenBrowser) {
				hiddenBrowser.destroy();
			}
		}

		if (successCookie) {
			let currentValue = this._readCookieValue({ ...successCookie, cookieContextId });
			if (currentValue && currentValue !== initialCookieValue) {
				return;
			}
		}

		if (!allowViewer) {
			throw new Error(`BrowserRequest: Challenge not cleared at ${url} and viewer escalation is disabled`);
		}

		// Fall back to the viewer: user may need to click a visible Turnstile
		// widget, after which the cookie lands and we can continue.
		Zotero.debug(`BrowserRequest: Escalating to viewer for ${url}`);
		if (successCookie) {
			await this._loadAndWaitForCookieInViewer(url, {
				cookieContextId,
				customUserAgent,
				successCookie
			});
			return;
		}
		await this.clearChallengeInViewer(url, {
			cookieContextId,
			captchaLocator: entry.captchaLocator
		});
	},

	/**
	 * Open a visible viewer at the URL and wait until successCookie appears
	 * in the jar. Necessary for sites where the success signal is a specific
	 * cookie being set (e.g., WorldCat's turnstile_passed) rather than a
	 * navigation or change in the DOM.
	 */
	async _loadAndWaitForCookieInViewer(url, options) {
		Zotero.debug(`BrowserRequest: Awaiting user challenge clearance (cookie ${options.successCookie.name}) at ${url}`);
		const timeout = Zotero.Prefs.get('browserRequest.timeout');
		const { successCookie, cookieContextId, customUserAgent } = options;

		let win, wmListener, pollInterval;
		let done = false;
		let cookieDeferred = Zotero.Promise.defer();
		let closedDeferred = Zotero.Promise.defer();

		try {
			wmListener = this._makeViewerCloseListener(() => {
				if (!done) closedDeferred.reject(new Error('BrowserRequest: User closed the viewer'));
			});
			Services.wm.addListener(wmListener);
			await new Promise((resolve) => {
				win = Zotero.openInViewer(url, { cookieContextId, customUserAgent });
				win.addEventListener('load', resolve);
			});
			Zotero.Utilities.Internal.activate(win);

			pollInterval = this._pollForCookie({
				successCookie,
				cookieContextId,
				onFound: () => {
					done = true;
					cookieDeferred.resolve();
				}
			});

			await Promise.race([
				cookieDeferred.promise,
				closedDeferred.promise,
				Zotero.Promise.delay(timeout).then(() => {
					if (!done) {
						throw new Error(`BrowserRequest: Viewer cookie wait timed out after ${timeout}ms`);
					}
				})
			]);
		}
		finally {
			if (pollInterval) clearInterval(pollInterval);
			Services.wm.removeListener(wmListener);
			if (win) win.close();
		}
	},

	/**
	 * Read the value of a named cookie on a given host under an optional
	 * userContextId. Returns null if the cookie is absent.
	 */
	_readCookieValue({ host, name, cookieContextId }) {
		try {
			let cookies = Services.cookies.getCookiesFromHost(
				host,
				cookieContextId ? { userContextId: cookieContextId } : {}
			);
			for (let cookie of cookies) {
				if (cookie.name === name) {
					return cookie.value;
				}
			}
		}
		catch (e) {
			Zotero.debug('BrowserRequest: _readCookieValue() failed');
			Zotero.logError(e);
		}
		return null;
	},

	/**
	 * Build a Services.wm listener that tracks the first window opened after
	 * addListener() and invokes onClose when that window closes. Used to
	 * detect user-closed viewer windows.
	 *
	 * @param {Function} onClose
	 */
	_makeViewerCloseListener(onClose) {
		let xulWin;
		return {
			onOpenWindow(xulWindow) {
				xulWin ||= xulWindow;
			},
			onCloseWindow(xulWindow) {
				if (xulWin === xulWindow) {
					onClose();
				}
			}
		};
	},

	/**
	 * Invoke onFound as soon as successCookie appears with a value different
	 * from the one observed at poll start. Captures the initial value to
	 * avoid declaring success on a stale cookie left over from a previous
	 * session (the server-signed HMAC would no longer validate).
	 * Caller is responsible for clearing the returned interval handle.
	 *
	 * @param {object} opts
	 * @param {{host: string, name: string}} opts.successCookie
	 * @param {number} [opts.cookieContextId]
	 * @param {Function} opts.onFound
	 * @param {number} [opts.intervalMs=250]
	 * @returns {number} interval handle
	 */
	_pollForCookie({ successCookie, cookieContextId, onFound, intervalMs = 250 }) {
		let { host, name } = successCookie;
		let initialValue = this._readCookieValue({ host, name, cookieContextId });
		return setInterval(() => {
			let currentValue = this._readCookieValue({ host, name, cookieContextId });
			if (currentValue && currentValue !== initialValue) {
				onFound();
			}
		}, intervalMs);
	},

	/**
	 * Open a visible browser window at the URL and wait for the user to clear a
	 * challenge. Resolves once the captchaLocator element disappears and the
	 * page has been stable for `browserRequest.onLoadTimeout` ms.
	 *
	 * @param {string} url
	 * @param {object} options
	 * @param {number} [options.cookieContextId]
	 * @param {string} options.captchaLocator
	 * @returns {Promise<void>}
	 */
	async clearChallengeInViewer(url, options) {
		Zotero.debug(`BrowserRequest: Awaiting user challenge clearance for ${url}`);
		const onLoadTimeout = Zotero.Prefs.get('browserRequest.onLoadTimeout');
		const timeout = Zotero.Prefs.get('browserRequest.timeout');

		let win, browser, wmListener;
		let cleared = false;
		let cancelled = false;
		let clearedDeferred = Zotero.Promise.defer();

		try {
			wmListener = this._makeViewerCloseListener(() => {
				if (!cleared) clearedDeferred.reject(new Error('BrowserRequest: User closed the viewer'));
			});
			Services.wm.addListener(wmListener);
			await new Promise((resolve) => {
				win = Zotero.openInViewer(url, {
					cookieContextId: options.cookieContextId
				});
				win.addEventListener('load', resolve);
			});
			browser = win.document.querySelector('browser');
			Zotero.Utilities.Internal.activate(win);

			// Poll for the captcha element disappearing, then require the page
			// to stay stable for onLoadTimeout before we consider it cleared
			let lastLocation = browser.currentURI.spec;
			let stableSince = null;
			let pollInterval = 500;
			// Don't allow clearance until we've positively observed the challenge
			// at least once; otherwise a transient empty/about:blank document
			// during the challenge page's own loading would declare success
			// before the user sees anything.
			let sawChallenge = false;
			await Promise.race([
				clearedDeferred.promise,
				Zotero.Promise.delay(timeout).then(() => {
					if (!cleared) {
						cancelled = true;
						throw new Error(`BrowserRequest: Viewer challenge clearance timed out after ${timeout}ms`);
					}
				}),
				(async () => {
					// Set above:
					// eslint-disable-next-line no-unmodified-loop-condition
					while (!cleared && !cancelled) {
						await Zotero.Promise.delay(pollInterval);
						let currentLocation = browser.currentURI.spec;
						if (currentLocation !== lastLocation) {
							lastLocation = currentLocation;
							stableSince = null;
							continue;
						}
						let stillChallenged = await this._browserMatchesSelector(browser, options.captchaLocator);
						if (stillChallenged) {
							sawChallenge = true;
							stableSince = null;
							continue;
						}
						if (!sawChallenge) {
							// Challenge page hasn't rendered yet, or we can't read
							// the DOM. Keep waiting without advancing the timer.
							stableSince = null;
							continue;
						}
						if (stableSince === null) {
							stableSince = Date.now();
						}
						else if (Date.now() - stableSince >= onLoadTimeout) {
							cleared = true;
							clearedDeferred.resolve();
						}
					}
				})()
			]);
		}
		finally {
			Services.wm.removeListener(wmListener);
			if (win) {
				win.close();
			}
		}
	},

	/**
	 * Ask the browser's current document whether it has a match for a CSS selector.
	 * False if the document can't be queried or nothing matches.
	 */
	async _browserMatchesSelector(browser, selector) {
		try {
			let actor = browser.browsingContext?.currentWindowGlobal?.getActor('PageData');
			if (!actor) return false;
			return await actor.sendQuery('querySelectorMatches', { selector });
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
	},

	/**
	 * Load the URL in the given HiddenBrowser and wait for the page to settle.
	 * Each location change restarts a `browserRequest.onLoadTimeout` window;
	 * if the location stays stable for that window, we consider the page
	 * settled. Throws if `browserRequest.timeout` elapses first.
	 *
	 * If `onPDF` is provided, also sets up a PDF MIME type handler on the
	 * browser and resolves early once a PDF is captured; the callback receives
	 * the blob.
	 *
	 * If `successCookie` is provided, polls the cookie jar and resolves as
	 * soon as a cookie with that name exists on the given host.
	 *
	 * @param {HiddenBrowser} hiddenBrowser
	 * @param {string} url
	 * @param {object} [opts]
	 * @param {(blob: Blob) => void} [opts.onPDF]
	 * @param {{ host: string, name: string }} [opts.successCookie]
	 * @param {number} [opts.cookieContextId]
	 * @returns {Promise<void>}
	 */
	async _loadAndSettle(hiddenBrowser, url, opts = {}) {
		const onLoadTimeout = Zotero.Prefs.get('browserRequest.onLoadTimeout');
		const timeout = Zotero.Prefs.get('browserRequest.timeout');

		let settled = false;
		let settleDeferred = Zotero.Promise.defer();
		let pdfDeferred = Zotero.Promise.defer();
		let cookieDeferred = Zotero.Promise.defer();
		let pdfFound = false;
		let pdfHandler;

		if (opts.onPDF) {
			pdfHandler = this._makePDFMIMETypeHandler(hiddenBrowser._browser, (blob) => {
				pdfFound = true;
				opts.onPDF(blob);
				pdfDeferred.resolve();
			});
			Zotero.MIMETypeHandler.addHandlers('application/pdf', pdfHandler, true);
		}

		try {
			let currentUrl = '';
			hiddenBrowser.webProgress.addProgressListener({
				QueryInterface: ChromeUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference]),
				async onLocationChange() {
					let loc = hiddenBrowser.currentURI.spec;
					if (currentUrl) {
						Zotero.debug(`BrowserRequest: A JS redirect occurred to ${loc}`);
					}
					currentUrl = loc;
					Zotero.debug(`BrowserRequest: Page loaded at ${loc}; waiting ${onLoadTimeout}ms for further JS activity`);
					await Zotero.Promise.delay(onLoadTimeout);
					if (currentUrl === loc && !settled && !pdfFound) {
						settled = true;
						settleDeferred.resolve();
					}
				}
			}, Ci.nsIWebProgress.NOTIFY_LOCATION);

			hiddenBrowser.load(url);

			let cookiePollInterval;
			if (opts.successCookie) {
				cookiePollInterval = this._pollForCookie({
					successCookie: opts.successCookie,
					cookieContextId: opts.cookieContextId,
					onFound: () => {
						Zotero.debug(`BrowserRequest: successCookie ${opts.successCookie.name} appeared`);
						cookieDeferred.resolve();
					}
				});
			}

			let races = [
				settleDeferred.promise,
				Zotero.Promise.delay(timeout).then(() => {
					if (!settled && !pdfFound) {
						throw new Error(`BrowserRequest: Browser request timed out after ${timeout}ms`);
					}
				})
			];
			if (opts.onPDF) {
				races.push(pdfDeferred.promise);
			}
			if (opts.successCookie) {
				races.push(cookieDeferred.promise);
			}
			try {
				await Promise.race(races);
			}
			finally {
				if (cookiePollInterval) clearInterval(cookiePollInterval);
			}
		}
		finally {
			if (pdfHandler) {
				Zotero.MIMETypeHandler.removeHandlers('application/pdf', pdfHandler);
			}
		}
	},

	_makePDFMIMETypeHandler(browser, onPDFFound = () => 0) {
		let isOurPDF, channelBrowser;
		let trackedBrowser = browser;
		return {
			onStartRequest: function (name, _, channel) {
				Zotero.debug(`BrowserRequest: Sniffing a PDF loaded at ${name}`);
				try {
					channelBrowser = channel.notificationCallbacks.getInterface(Ci.nsILoadContext).topFrameElement;
				}
				catch {}
				if (channelBrowser) {
					isOurPDF = trackedBrowser === channelBrowser;
				}
				else {
					try {
						channelBrowser = channel.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext)
							.topFrameElement;
					}
					catch {}
					if (channelBrowser) {
						isOurPDF = trackedBrowser === channelBrowser;
					}
				}
			},
			onContent: async (blob, name) => {
				if (isOurPDF) {
					Zotero.debug(`BrowserRequest: Found our PDF at ${name}`);
					onPDFFound(blob);
					return true;
				}
				Zotero.debug(`BrowserRequest: Not our PDF at ${name}`);
				return false;
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
		Zotero.debug(`BrowserRequest: Downloading PDF via hidden browser from ${url}`);

		let hiddenBrowser;
		let blob;
		try {
			hiddenBrowser = new HiddenBrowser();
			await hiddenBrowser._createdPromise;
			await this._loadAndSettle(hiddenBrowser, url, {
				onPDF: (foundBlob) => {
					blob = foundBlob;
				}
			});
			if (!blob) {
				throw new Error('BrowserRequest: Settled without receiving a PDF');
			}
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
				Zotero.debug(`BrowserRequest: Hidden browser PDF download failed: ${e.message}`);
				const entry = this.getEntryForURL(url);
				if (entry?.captchaLocator && hiddenBrowser) {
					let doc;
					try {
						doc = await hiddenBrowser.getDocument();
					}
					catch {}
					if (doc && doc.querySelector(entry.captchaLocator)) {
						return this.downloadPDFViaViewer(url, path, options);
					}
				}
			}
			throw e;
		}
		finally {
			if (hiddenBrowser) {
				hiddenBrowser.destroy();
			}
		}
		return undefined;
	},

	async downloadPDFViaViewer(url, path, _options) {
		Zotero.debug(`BrowserRequest: Downloading PDF via viewer for captcha clearing from ${url}`);

		let win, browser, wmListener;
		let pdfMIMETypeHandler;
		let pdfFound;
		let pdfFoundDeferred = Zotero.Promise.defer();
		const timeout = Zotero.Prefs.get('browserRequest.timeout');

		try {
			wmListener = this._makeViewerCloseListener(() => {
				if (!pdfFound) pdfFoundDeferred.reject(new Error('BrowserRequest: User closed the viewer'));
			});
			Services.wm.addListener(wmListener);
			await new Promise((resolve) => {
				win = Zotero.openInViewer(url);
				win.addEventListener('load', resolve);
			});
			browser = win.document.querySelector('browser');
			Zotero.Utilities.Internal.activate(win);

			pdfMIMETypeHandler = this._makePDFMIMETypeHandler(browser, pdfFoundDeferred.resolve);
			Zotero.MIMETypeHandler.addHandlers('application/pdf', pdfMIMETypeHandler, true);

			Zotero.debug(`BrowserRequest: Awaiting user captcha clearance or timeout after ${timeout}ms`);
			let pdfBlob = await Promise.race([
				Zotero.Promise.delay(timeout).then(() => {
					if (!pdfFound) {
						throw new Error(`BrowserRequest: Viewer PDF download timed out after ${timeout}ms`);
					}
				}),
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

// Register hosts that we intercept Cloudflare Turnstile challenges on,
// so they receive a plain UA everywhere. See comment on
// Zotero.VersionHeader.registerPlainUAHost().
for (let entry of Zotero.BrowserRequest.CHALLENGE_URLS) {
	if (entry.plainUAHost) {
		Zotero.VersionHeader.registerPlainUAHost(entry.plainUAHost);
	}
}
