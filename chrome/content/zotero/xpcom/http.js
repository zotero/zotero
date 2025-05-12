/**
 * Functions for performing HTTP requests, both via XMLHTTPRequest and using a hidden browser
 * @namespace
 */
Zotero.HTTP = new function() {
	this.disableErrorRetry = false;
	var _errorDelayIntervals = [2500, 5000, 10000, 20000, 40000, 60000, 120000, 240000, 300000];
	var _errorDelayMax = 60 * 60 * 1000; // 1 hour

	var { SecurityInfo } = ChromeUtils.importESModule("resource://gre/modules/SecurityInfo.sys.mjs");
	
	/**
	 * Exception returned for unexpected status when promise* is used
	 * @constructor
	 */
	this.UnexpectedStatusException = function (xmlhttp, url, msg, options = {}) {
		this.xmlhttp = xmlhttp;
		this.url = url;
		this.status = xmlhttp.status;
		this.channelStatus = null;
		this.responseStatus = null;
		this.channel = xmlhttp.channel;
		this.message = msg;
		this.stack = new Error().stack;
		
		if (options) {
			for (let prop in options) {
				this[prop] = options[prop];
			}
		}
		
		// Hide password from debug output
		//
		// Password also shows up in channel.name (nsIRequest.name), but that's
		// read-only and has to be handled in Zotero.varDump()
		try {
			if (xmlhttp.channel) {
				if (xmlhttp.channel.URI.password) {
					xmlhttp.channel.URI.password = "********";
				}
				if (xmlhttp.channel.URI.spec) {
					xmlhttp.channel.URI.spec = xmlhttp.channel.URI.spec.replace(/key=[^&]+&?/, "key=********");
				}
			}
		}
		catch (e) {
			Zotero.debug(e, 1);
		}
		
		// If the connection failed, try to find out what really happened
		if (!this.status) {
			try {
				if (xmlhttp.channel.status) {
					this.channelStatus = xmlhttp.channel.status;
					Zotero.debug("Channel status was " + this.channelStatus, 2);
				}
			}
			catch (e) {}
			try {
				if (xmlhttp.channel.responseStatus) {
					this.responseStatus = xmlhttp.channel.responseStatus;
					Zotero.debug("Response status was " + this.responseStatus, 2);
				}
			}
			catch (e) {}
		}
	};
	this.UnexpectedStatusException.prototype = Object.create(Error.prototype);
	this.UnexpectedStatusException.prototype.is4xx = function () {
		return this.status >= 400 && this.status < 500;
	}
	this.UnexpectedStatusException.prototype.is5xx = function () {
		return this.status >= 500 && this.status < 600;
	}
	
	/**
	 * Exception returned if the browser is offline when promise* is used
	 * @constructor
	 */
	this.BrowserOfflineException = function() {
		this.message = `Request could not be completed because ${Zotero.appName} is offline`;
		this.stack = new Error().stack;
	};
	this.BrowserOfflineException.prototype = Object.create(Error.prototype);

	this.CancelledException = function () {
		this.message = "Request cancelled";
		this.stack = new Error().stack;
	};
	this.CancelledException.prototype = Object.create(Error.prototype);
	
	this.TimeoutException = function(ms) {
		this.message = "Request timed out" + (ms ? ` after ${ms} ms` : "");
		this.stack = new Error().stack;
	};
	this.TimeoutException.prototype = Object.create(Error.prototype);

	this.SecurityException = function (msg, options = {}) {
		this.message = msg;
		this.stack = new Error().stack;
		for (let i in options) {
			this[i] = options[i];
		}
	};
	this.SecurityException.prototype = Object.create(
		// Zotero.Error not available in the connector
		Zotero.Error ? Zotero.Error.prototype : Error.prototype
	);
	
	
	this.promise = function () {
		Zotero.debug("Zotero.HTTP.promise() is deprecated -- use Zotero.HTTP.request()", 2);
		return this.request.apply(this, arguments);
	}
	
	/**
	 * Get a promise for a HTTP request
	 *
	 * @param {String} method - The method of the request ("GET", "POST", etc.)
	 * @param {nsIURI|String} url - URL to request
	 * @param {Object} [options] Options for HTTP request:
	 * @param {String} [options.body] - The body of a POST request
	 * @param {Object | Headers} [options.headers] - HTTP headers to send with the request
	 * @param {Boolean} [options.followRedirects = true] - Object of HTTP headers to send with the
	 *     request
	 * @param {Zotero.CookieSandbox} [options.cookieSandbox] - The sandbox from which cookies should
	 *     be taken
	 * @param {Boolean} [options.debug] - Log response text and status code
	 * @param {Boolean} [options.noCache] - If set, specifies that the request should not be
	 *     fulfilled from the cache
	 * @param {Boolean} [options.dontCache] - Deprecated
	 * @param {Boolean} [options.foreground] - Make a foreground request, showing
	 *     certificate/authentication dialogs if necessary
	 * @param {Number} [options.logBodyLength=1024] - Length of request body to log
	 * @param {Function} [options.requestObserver] - Callback to receive XMLHttpRequest after open()
	 * @param {Function} [options.cancellerReceiver] - Callback to receive a function to cancel
	 *     the operation
	 * @param {String} [options.responseType] - The type of the response. See XHR 2 documentation
	 *     for legal values
	 * @param {String} [options.responseCharset] - The charset the response should be interpreted as
	 * @param {Number[]|false} [options.successCodes] - HTTP status codes that are considered
	 *     successful, or FALSE to allow all
	 * @param {Zotero.CookieSandbox} [options.cookieSandbox] - Cookie sandbox object
	 * @param {Number} [options.timeout = 30000] - Request timeout specified in milliseconds, or 0
	 *     for no timeout
	 * @param {Number[]} [options.errorDelayIntervals] - Array of milliseconds to wait before
	 *     retrying after 5xx error; if unspecified, a default set is used
	 * @param {Number} [options.errorDelayMax = 3600000] - Milliseconds to wait before stopping
	 *     5xx retries; set to 0 to disable retrying
	 * @return {Promise<XMLHttpRequest>} - A promise resolved with the XMLHttpRequest object if the
	 *     request succeeds or rejected if the browser is offline or a non-2XX status response
	 *     code is received (or a code not in options.successCodes if provided).
	 */
	this.request = async function (method, url, options = {}) {
		var errorDelayGenerator;
		
		while (true) {
			try {
				let req = await this._requestInternal(...arguments);
				return req;
			}
			catch (e) {
				if (e instanceof this.UnexpectedStatusException) {
					_checkConnection(e.xmlhttp, url);
					
					if (e.is5xx()) {
						Zotero.logError(e);
						// Check for Retry-After header on 503 and wait the specified amount of time
						if (e.xmlhttp.status == 503 && await _checkRetry(e.xmlhttp)) {
							continue;
						}
						// Don't retry if errorDelayMax is 0
						if (options.errorDelayMax === 0 || Zotero.HTTP.disableErrorRetry) {
							throw e;
						}
						// Automatically retry other 5xx errors by default
						if (!errorDelayGenerator) {
							// Keep trying for up to an hour
							errorDelayGenerator = Zotero.Utilities.Internal.delayGenerator(
								options.errorDelayIntervals || _errorDelayIntervals,
								options.errorDelayMax !== undefined
									? options.errorDelayMax
									: _errorDelayMax
							);
						}
						let delayPromise = errorDelayGenerator.next().value;
						let keepGoing;
						// Provide caller with a callback to cancel while waiting to retry
						if (options.cancellerReceiver) {
							let resolve;
							let reject;
							let cancelPromise = new Zotero.Promise((res, rej) => {
								resolve = res;
								reject = function () {
									rej(new Zotero.HTTP.CancelledException);
								};
							});
							options.cancellerReceiver(reject);
							try {
								keepGoing = await Promise.race([delayPromise, cancelPromise]);
							}
							catch (e) {
								Zotero.debug("Request cancelled");
								throw e;
							}
							resolve();
						}
						else {
							keepGoing = await delayPromise;
						}
						if (!keepGoing) {
							Zotero.logError("Failed too many times");
							throw e;
						}
						continue;
					}
				}
				throw e;
			}
		}
	};
	
	
	/**
	 * Most of the logic for request() is here, with request() handling automatic 5xx retries
	 */
	this._requestInternal = async function (method, url, options = {}) {
		if (url instanceof Components.interfaces.nsIURI) {
			// Extract username and password from URI and undo Mozilla's excessive percent-encoding
			options.username = url.username || null;
			if (options.username) {
				options.username = options.username.replace(/%2E/, '.');
				options.password = url.password || null;
				url = url.mutate().setUserPass('').finalize();
			}
			
			url = url.spec;
		}
		
		var dispURL = url;
		
		// Add username:******** to display URL
		if (options.username) {
			dispURL = dispURL.replace(/^(https?:\/\/)/, `$1${options.username}:********@`);
		}
		
		// Don't display API key in console
		dispURL = dispURL.replace(/key=[^&]+&?/, "").replace(/\?$/, "");
		
		if (options.body && typeof options.body == 'string') {
			let len = options.logBodyLength !== undefined ? options.logBodyLength : 1024;
			var bodyStart = options.body.substr(0, len);
			// Don't display sync password or session id in console
			bodyStart = bodyStart.replace(/password":"[^"]+/, 'password":"********');
			bodyStart = bodyStart.replace(/password=[^&]+/, 'password=********');
			bodyStart = bodyStart.replace(/sessionid=[^&]+/, 'sessionid=********');
			
			Zotero.debug("HTTP " + method + ' "'
				+ (options.body.length > len
					? bodyStart + '\u2026" (' + options.body.length + ' chars)' : bodyStart + '"')
				+ " to " + dispURL);
		} else {
			Zotero.debug("HTTP " + method + " " + dispURL);
		}
		
		if (url.startsWith('http') && this.browserIsOffline()) {
			Zotero.debug(`HTTP ${method} ${dispURL} failed: ${Zotero.appName} is offline`);
			throw new this.BrowserOfflineException();
		}
		
		var deferred = Zotero.Promise.defer();
		
		if (!this.mock
				|| options.noMock
				|| url.startsWith('resource://')
				|| url.startsWith('chrome://')) {
			var xmlhttp = new XMLHttpRequest();
		}
		else {
			var xmlhttp = new this.mock;
			// Add a dummy overrideMimeType() if it's not mocked
			// https://github.com/cjohansen/Sinon.JS/issues/559
			if (!xmlhttp.overrideMimeType) {
				xmlhttp.overrideMimeType = function () {};
			}
		}
		// Prevent certificate/authentication dialogs from popping up
		if (!options.foreground) {
			xmlhttp.mozBackgroundRequest = true;
		}
		xmlhttp.open(method, url, true, options.username, options.password);
		
		// Pass the request to a callback
		if (options.requestObserver) {
			options.requestObserver(xmlhttp);
		}
		
		if (method == 'PUT') {
			// Some servers (e.g., Jungle Disk DAV) return a 200 response code
			// with Content-Length: 0, which triggers a "no element found" error
			// in Firefox, so we override to text
			xmlhttp.overrideMimeType("text/plain");
		}
		
		// Send cookie even if "Allow third-party cookies" is disabled (>=Fx3.6 only)
		var channel = xmlhttp.channel,
			isFile = channel instanceof Components.interfaces.nsIFileChannel;
		var redirectStatus;
		var redirectLocation;
		if(channel instanceof Components.interfaces.nsIHttpChannelInternal) {
			channel.forceAllowThirdPartyCookie = true;
			
			// Set charset
			//
			// This is the method used in the connector, but as noted there, this parameter is a
			// legacy of XPCOM functionality (where it could be set on the nsIChannel, which
			// doesn't seem to work anymore), and we should probably allow responseContentType to
			// be set instead
			if (options.responseCharset) {
				xmlhttp.overrideMimeType(`text/plain; charset=${responseCharset}`);
			}
			
			// Disable caching if requested
			if (options.noCache || options.dontCache) {
				if (options.dontCache) {
					Zotero.warn("HTTP.request() 'dontCache' option is deprecated -- use noCache instead");
				}
				channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
			}
			
			let notificationCallbacks = options.notificationCallbacks || {};
			if (options.followRedirects === false) {
				if (notificationCallbacks.asyncOnChannelRedirect) {
					throw new Error("Can't set asyncOnChannelRedirect and followRedirects = false");
				}
				notificationCallbacks = {
					...notificationCallbacks,
					asyncOnChannelRedirect: function (oldChannel, newChannel, flags, callback) {
						redirectStatus = (flags & Ci.nsIChannelEventSink.REDIRECT_PERMANENT) ? 301 : 302;
						redirectLocation = newChannel.URI.spec;
						oldChannel.cancel(Cr.NS_BINDING_ABORTED);
						callback.onRedirectVerifyCallback(Cr.NS_BINDING_ABORTED);
					}
				};
			}
			if (notificationCallbacks) {
				channel.notificationCallbacks = wrapNotificationCallbacks(notificationCallbacks);
			}
		}
		
		// Set responseType
		if (options.responseType) {
			xmlhttp.responseType = options.responseType;
		}
		
		// Send headers
		var headers = new Zotero.HTTP.CasePreservingHeaders(options?.headers || {});
		var compressedBody = false;
		if (options.body) {
			if (!headers.get("Content-Type")) {
				headers.set("Content-Type", "application/x-www-form-urlencoded");
			}
			else if (headers.get("Content-Type") == 'multipart/form-data') {
				// Allow XHR to set Content-Type with boundary for multipart/form-data
				headers.delete("Content-Type");
			}
			
			if (options.compressBody && this.isWriteMethod(method)) {
				headers.set('Content-Encoding', 'gzip');
				compressedBody = await Zotero.Utilities.Internal.gzip(options.body);
				
				let oldLen = options.body.length;
				let newLen = compressedBody.length;
				Zotero.debug(`${method} body gzipped from ${oldLen} to ${newLen}; `
					+ Math.round(((oldLen - newLen) / oldLen) * 100) + "% savings");
			}
		}
		if (options.debug) {
			if (headers.has("Zotero-API-Key")) {
				let dispHeaders = new Zotero.HTTP.CasePreservingHeaders(headers);
				dispHeaders.set("Zotero-API-Key", "[Not shown]");
				Zotero.debug(Object.fromEntries(dispHeaders.entries()));
			}
			else {
				Zotero.debug(Object.fromEntries(headers.entries()));
			}
		}
		for (var [header, value] of headers) {
			// Convert numbers to string to make Sinon happy
			xmlhttp.setRequestHeader(header, value);
		}
		
		const defaultTimeout = 30000;
		let requestTimeout;
		let connectTimeout;
		let inactivityTimeout;
		if (options.timeout !== 0) {
			// For downloads, manually implement connect and inactivity timeouts, since the XHR
			// `timeout` property applies to the whole request, even if data is being downloaded
			if (options.isDownload) {
				// TODO: Try a lower default connect timeout and take a separate option?
				connectTimeout = options.timeout || defaultTimeout;
				inactivityTimeout = options.timeout || defaultTimeout;
			}
			else {
				requestTimeout = options.timeout || defaultTimeout;
			}
		}
		let connectTimerID = null;
		let inactivityTimerID = null;
		let timedOutAfter;
		
		function clearConnectTimer() {
			if (connectTimerID) {
				clearTimeout(connectTimerID);
				connectTimerID = null;
			}
		}
		
		function resetInactivityTimer() {
			clearTimeout(inactivityTimerID);
			inactivityTimerID = setTimeout(() => {
				Zotero.warn(`Inactivity timeout for ${method} ${dispURL} -- aborting request`);
				timedOutAfter = inactivityTimeout;
				xmlhttp.abort();
			}, inactivityTimeout);
		}
		
		if (requestTimeout) {
			xmlhttp.timeout = requestTimeout;
			xmlhttp.ontimeout = function() {
				deferred.reject(new Zotero.HTTP.TimeoutException(requestTimeout));
			};
		}
		else if (inactivityTimeout) {
			xmlhttp.onprogress = function () {
				resetInactivityTimer();
			};
		}
		
		// Provide caller with a callback to cancel a request in progress
		if (options.cancellerReceiver) {
			options.cancellerReceiver(() => {
				if (xmlhttp.readyState == 4) {
					Zotero.debug("Request already finished -- not cancelling");
					return;
				}
				deferred.reject(new Zotero.HTTP.CancelledException);
				xmlhttp.abort();
			});
		}
		
		if (connectTimeout || inactivityTimeout) {
			xmlhttp.onloadstart = () => {
				clearConnectTimer();
				resetInactivityTimer();
			};
		}
		
		xmlhttp.onloadend = async function() {
			clearConnectTimer();
			clearTimeout(inactivityTimerID);
			
			var status = redirectStatus || xmlhttp.status;
			
			try {
				if (!status) {
					let responseStatus = xmlhttp.channel.responseStatus;
					// If we cancelled a redirect, get the 3xx status from the channel
					if (responseStatus >= 300 && responseStatus < 400) {
						status = responseStatus;
					}
					// If an invalid HTTP response includes a 4xx or 5xx HTTP response code, swap it
					// in, since it might be enough info to do what we need (e.g., verify a 404 from
					// a WebDAV server)
					else if (responseStatus >= 400) {
						let statuses = [
							2152398875, // NS_ERROR_INVALID_CONTENT_ENCODING
						];
						if (statuses.includes(xmlhttp.channel.status)) {
							Zotero.warn(`Overriding status for invalid response for ${dispURL} `
								+ `(${xmlhttp.channel.status})`);
							status = responseStatus;
						}
					}
				}
			}
			catch (e) {}
			
			if (options.successCodes) {
				var success = options.successCodes.indexOf(status) != -1;
			}
			// Explicit FALSE means allow any status code
			else if (options.successCodes === false) {
				var success = true;
			}
			else if(isFile) {
				var success = status == 200 || status == 0;
			}
			else if (redirectStatus) {
				var success = true;
				let channel = xmlhttp.channel;
				xmlhttp = {
					status,
					getResponseHeader: function (header) {
						if (header.toLowerCase() == 'location') {
							return redirectLocation;
						}
						Zotero.debug("Warning: Attempt to get response header other than Location "
							+ "for redirect", 2);
						return null;
					}
				};
			}
			else {
				var success = status >= 200 && status < 300;
			}
			
			if(success) {
				Zotero.debug("HTTP " + method + " " + dispURL
					+ " succeeded with " + status);
				if (options.debug) {
					Zotero.debug(xmlhttp.responseText);
				}
				
				// Follow meta redirects
				if (options.responseType === 'document' &&
					(!options.numRedirects || options.numRedirects < 3)) {
					let contentType = xmlhttp.getResponseHeader('Content-Type');
					if (contentType && contentType.startsWith('text/html')) {
						let doc = xmlhttp.response;
						let url = xmlhttp.responseURL;
						let resolvedURL;
						try {
							resolvedURL = this.getHTMLMetaRefreshURL(doc, url);
						}
						catch (e) {
							deferred.reject(e);
							return;
						}
						if (resolvedURL) {
							if (options.numRedirects) {
								options.numRedirects++;
							}
							else {
								options.numRedirects = 1;
							}
							
							// Meta redirect is always GET
							return Zotero.HTTP.request("GET", resolvedURL, options)
								.then(xmlhttp => deferred.resolve(xmlhttp))
								.catch(e => deferred.reject(e));
						}
					}
				}
				
				deferred.resolve(xmlhttp);
			} else {
				let msg = "HTTP " + method + " " + dispURL + " failed with status code " + status;
				if ((!xmlhttp.responseType || xmlhttp.responseType == 'text') && xmlhttp.responseText) {
					msg += ":\n\n" + xmlhttp.responseText;
				}
				Zotero.debug(msg, 1);
				
				if (timedOutAfter) {
					deferred.reject(new Zotero.HTTP.TimeoutException(timedOutAfter));
					return;
				}
				
				if (xmlhttp.status == 0) {
					try {
						this.checkSecurity(channel, { isProxyAuthRequest: options.isProxyAuthRequest });
					}
					catch (e) {
						deferred.reject(e);
						return;
					}
				}
				
				deferred.reject(new Zotero.HTTP.UnexpectedStatusException(xmlhttp, url, msg));
			}
		}.bind(this);
		
		if (options.cookieSandbox) {
			if (xmlhttp instanceof XMLHttpRequest) {
				options.cookieSandbox.attachToInterfaceRequestor(xmlhttp);
			}
			// Mocked XHR in tests
			else {
				Zotero.debug("Not a real XMLHttpRequest -- not attaching cookie sandbox", 2);
			}
		}
		
		// Send binary data
		let body;
		if (compressedBody) {
			let numBytes = compressedBody.length;
			let ui8Data = new Uint8Array(numBytes);
			for (let i = 0; i < numBytes; i++) {
				ui8Data[i] = compressedBody.charCodeAt(i) & 0xff;
			}
			body = ui8Data;
		}
		// Send regular request
		else {
			body = options.body || null;
		}
		
		if (connectTimeout) {
			connectTimerID = setTimeout(() => {
				Zotero.warn(`Connect timeout for ${method} ${dispURL} -- aborting request`);
				timedOutAfter = connectTimeout;
				xmlhttp.abort();
			}, connectTimeout);
		}
		
		xmlhttp.send(body);
		
		return deferred.promise;
	};
	
	
	/**
	 * Create an nsIInterfaceRequestor object based on the callbacks provided
	 */
	function wrapNotificationCallbacks(callbacks) {
		return {
			QueryInterface: ChromeUtils.generateQI(["nsIInterfaceRequestor"]),
			
			getInterface(aIID) {
				// Handle nsIProgressEventSink (for onProgress, onStatus)
				if (aIID.equals(Ci.nsIProgressEventSink) && (callbacks.onProgress || callbacks.onStatus)) {
					return {
						onProgress: callbacks.onProgress || function () {},
						onStatus: callbacks.onStatus || function () {},
					};
				}
				
				// Handle nsIChannelEventSink (for asyncOnChannelRedirect)
				if (aIID.equals(Ci.nsIChannelEventSink) && callbacks.asyncOnChannelRedirect) {
					return {
						asyncOnChannelRedirect: callbacks.asyncOnChannelRedirect,
					};
				}
				
				throw Components.Exception("No interface available", Cr.NS_ERROR_NO_INTERFACE);
			}
		};
	}
	
	
	/**
	 * Download a file
	 *
	 * @param {nsIURI|String} url - URL to request
	 * @param {String} path - Path to save file to
	 * @param {Object} [options] - See `Zotero.HTTP.request()`
	 */
	this.download = async function(uri, path, options = {}) {
		// TODO: Convert request() to fetch() and use ReadableStream
		var req = await this.request(
			'GET',
			uri,
			{
				...options,
				isDownload: true,
				responseType: 'blob',
				// Downloads can have channel notification callbacks, etc., so always do them for real
				noMock: true
			}
		);
		var bytes = await IOUtils.write(path, await req.response.bytes());
		Zotero.debug(`Saved file to ${path} (${bytes} byte${bytes != 1 ? 's' : ''})`);
		return req;
	};
	
	
	/**
	 * Send an HTTP GET request via XMLHTTPRequest
	 * 
	 * @param {nsIURI|String}	url				URL to request
	 * @param {Function} 		onDone			Callback to be executed upon request completion
	 * @param {String} 		responseCharset	Character set to force on the response
	 * @param {Zotero.CookieSandbox} [cookieSandbox] Cookie sandbox object
	 * @param {Object} requestHeaders HTTP headers to include with request
	 * @return {XMLHttpRequest} The XMLHttpRequest object if the request was sent, or
	 *     false if the browser is offline
	 * @deprecated Use {@link Zotero.HTTP.request}
	 */
	this.doGet = function(url, onDone, responseCharset, cookieSandbox, requestHeaders) {
		if (url instanceof Components.interfaces.nsIURI) {
			// Don't display password in console
			var disp = this.getDisplayURI(url);
			Zotero.debug("HTTP GET " + disp.spec);
			url = url.spec;
		}
		else {
			Zotero.debug("HTTP GET " + url);
		}
		if (this.browserIsOffline()){
			return false;
		}
		
		var xmlhttp = new XMLHttpRequest();
		
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open('GET', url, true);
		
		// Send cookie even if "Allow third-party cookies" is disabled (>=Fx3.6 only)
		var channel = xmlhttp.channel;
		channel.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
		channel.forceAllowThirdPartyCookie = true;
		
		// Set charset -- see note in request() above
		if (responseCharset) {
			xmlhttp.overrideMimeType(`text/plain; charset=${responseCharset}`);
		}
		
		// Set request headers
		if (requestHeaders) {
			for (var header in requestHeaders) {
				xmlhttp.setRequestHeader(header, requestHeaders[header]);
			}
		}
	
		// Don't cache GET requests
		xmlhttp.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
		
		var useMethodjit = Components.utils.methodjit;
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			_stateChange(xmlhttp, onDone);
		};
		
		if(cookieSandbox) cookieSandbox.attachToInterfaceRequestor(xmlhttp.getInterface(Components.interfaces.nsIInterfaceRequestor));
		xmlhttp.send(null);
		
		return xmlhttp;
	}
	
	/**
	 * Send an HTTP POST request via XMLHTTPRequest
	 *
	 * @param {String} url URL to request
	 * @param {String} body Request body
	 * @param {Function} onDone Callback to be executed upon request completion
	 * @param {String} headers Request HTTP headers
	 * @param {String} responseCharset Character set to force on the response
	 * @param {Zotero.CookieSandbox} [cookieSandbox] Cookie sandbox object
	 * @return {XMLHttpRequest} The XMLHttpRequest object if the request was sent, or
	 *     false if the browser is offline
	 * @deprecated Use {@link Zotero.HTTP.request}
	 */
	this.doPost = function(url, body, onDone, headers, responseCharset, cookieSandbox) {
		if (url instanceof Components.interfaces.nsIURI) {
			// Don't display password in console
			var disp = this.getDisplayURI(url);
			url = url.spec;
		}
		
		var bodyStart = body.substr(0, 1024);
		// Don't display sync password or session id in console
		bodyStart = bodyStart.replace(/password=[^&]+/, 'password=********');
		bodyStart = bodyStart.replace(/sessionid=[^&]+/, 'sessionid=********');
		
		Zotero.debug("HTTP POST "
			+ (body.length > 1024 ?
				bodyStart + '... (' + body.length + ' chars)' : bodyStart)
			+ " to " + (disp ? disp.spec : url));
		
		
		if (this.browserIsOffline()){
			return false;
		}
		
		var xmlhttp = new XMLHttpRequest();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open('POST', url, true);
		// Send cookie even if "Allow third-party cookies" is disabled (>=Fx3.6 only)
		var channel = xmlhttp.channel;
		channel.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
		channel.forceAllowThirdPartyCookie = true;
		
		// Set charset -- see note in request() above
		if (responseCharset) {
			xmlhttp.overrideMimeType(`text/plain; charset=${responseCharset}`);
		}
		
		if (headers) {
			if (typeof headers == 'string') {
				var msg = "doPost() now takes a headers object rather than a requestContentType -- update your code";
				Zotero.debug(msg, 2);
				Components.utils.reportError(msg);
				headers = {
					"Content-Type": headers
				};
			}
		}
		else {
			headers = {};
		}
		
		if (!headers["Content-Type"]) {
			headers["Content-Type"] = "application/x-www-form-urlencoded";
		}
		
		for (var header in headers) {
			xmlhttp.setRequestHeader(header, headers[header]);
		}
		
		var useMethodjit = Components.utils.methodjit;
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			_stateChange(xmlhttp, onDone);
		};
		
		if(cookieSandbox) cookieSandbox.attachToInterfaceRequestor(xmlhttp.getInterface(Components.interfaces.nsIInterfaceRequestor));
		xmlhttp.send(body);
		
		return xmlhttp;
	}
	
	/**
	 * Send an HTTP HEAD request via XMLHTTPRequest
	 *
	 * @param {String} url URL to request
	 * @param {Function} onDone Callback to be executed upon request completion
	 * @param {Object} requestHeaders HTTP headers to include with request
	 * @param {Zotero.CookieSandbox} [cookieSandbox] Cookie sandbox object
	 * @return {XMLHttpRequest} The XMLHttpRequest object if the request was sent, or
	 *     false if the browser is offline
	 * @deprecated Use {@link Zotero.HTTP.request}
	 */
	this.doHead = function(url, onDone, requestHeaders, cookieSandbox) {
		if (url instanceof Components.interfaces.nsIURI) {
			// Don't display password in console
			var disp = this.getDisplayURI(url);
			Zotero.debug("HTTP HEAD " + disp.spec);
			url = url.spec;
		}
		else {
			Zotero.debug("HTTP HEAD " + url);
		
		}
		
		if (this.browserIsOffline()){
			return false;
		}
		
		// Workaround for "Accept third-party cookies" being off in Firefox 3.0.1
		// https://www.zotero.org/trac/ticket/1070
		var xmlhttp = new XMLHttpRequest();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open('HEAD', url, true);
		// Send cookie even if "Allow third-party cookies" is disabled (>=Fx3.6 only)
		var channel = xmlhttp.channel;
		channel.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
		channel.forceAllowThirdPartyCookie = true;
		
		if (requestHeaders) {
			for (var header in requestHeaders) {
				xmlhttp.setRequestHeader(header, requestHeaders[header]);
			}
		}
		
		// Don't cache HEAD requests
		xmlhttp.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
		
		var useMethodjit = Components.utils.methodjit;
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			_stateChange(xmlhttp, onDone);
		};
		
		if(cookieSandbox) cookieSandbox.attachToInterfaceRequestor(xmlhttp.getInterface(Components.interfaces.nsIInterfaceRequestor));
		xmlhttp.send(null);
		
		return xmlhttp;
	}
	
	/**
	 * Send an HTTP OPTIONS request via XMLHTTPRequest
	 *
	 * @param	{nsIURI}		url
	 * @param	{Function}	onDone
	 * @return	{XMLHTTPRequest}
	 * @deprecated Use {@link Zotero.HTTP.request}
	 */
	this.doOptions = function (uri, callback) {
		// Don't display password in console
		var disp = this.getDisplayURI(uri);
		Zotero.debug("HTTP OPTIONS for " + disp.spec);
		
		if (Zotero.HTTP.browserIsOffline()){
			return false;
		}
		
		var xmlhttp = new XMLHttpRequest();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open('OPTIONS', uri.spec, true);
		
		var useMethodjit = Components.utils.methodjit;
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			_stateChange(xmlhttp, callback);
		};
		xmlhttp.send(null);
		return xmlhttp;
	}
	
	
	this.getHTMLMetaRefreshURL = function (doc, url) {
		var meta = doc.querySelector('meta[http-equiv="refresh" i]');
		if (!meta) {
			return false;
		}
		var content = meta.getAttribute('content');
		if (!content) {
			return false;
		}
		var parts = content.split(/;\s*url=/);
		// If there's a redirect to another URL in less than 15 seconds,
		// follow it
		if (parts.length === 2 && parseInt(parts[0]) <= 15) {
			let refreshURL = parts[1].trim().replace(/^'(.+)'/, '$1');
			let resolvedURL;
			try {
				resolvedURL = Services.io.newURI(url, null, null).resolve(refreshURL);
			}
			catch (e) {
				Zotero.logError(e);
			}
			// Make sure the URL is actually resolved
			if (resolvedURL && /^https?:\/\//.test(resolvedURL)) {
				return resolvedURL;
			}
		}
		return false;
	};
	
	
	/**
	 * General mechanism for modifying requests based on predefined rules
	 *
	 * The observer is only active if any rules are enabled.
	 */
	this.RequestModifier = {
		rules: new Set([
			'remove-nature-feed-origin'
		]),
		enabledRules: new Set(),
		
		observe: function (channel, topic) {
			channel.QueryInterface(Components.interfaces.nsIHttpChannel);
			if (topic == "http-on-modify-request") {
				// https://github.com/zotero/zotero/issues/2249
				if (this.enabledRules.has('remove-nature-feed-origin')
						&& channel.URI.spec.match(/^https?:\/\/idp\.nature\.com\/.+\.rss/)) {
					let dispURL = Zotero.HTTP.getDisplayURI(channel.URI).spec;
					Zotero.debug("RequestModifier: Removing Origin header for " + dispURL);
					channel.setRequestHeader("Origin", "", false);
				}
			}
		},
		
		enableRule: function (rule) {
			if (!this.rules.has(rule)) {
				throw new Error(`RequestModifier: Can't enable invalid rule '${rule}'`);
			}
			if (this.enabledRules.has(rule)) {
				Zotero.debug(`RequestModifier: Rule '${rule}' is already enabled`);
				return;
			}
			this.enabledRules.add(rule);
			// Register the observer if any rules are enabled
			if (this.enabledRules.size == 1) {
				this.register();
			}
		},
		
		disableRule: function (rule) {
			if (!this.rules.has(rule)) {
				throw new Error(`RequestModifier: Can't disable invalid rule '${rule}'`);
			}
			if (!this.enabledRules.has(rule)) {
				Zotero.debug(`RequestModifier: Rule '${rule}' isn't enabled`);
				return;
			}
			this.enabledRules.delete(rule);
			// Disable the observer if no rules are enabled
			if (!this.enabledRules.size) {
				this.unregister();
			}
		},
		
		register: function () {
			Services.obs.addObserver(this, "http-on-modify-request", false);
		},
		
		unregister: function () {
			Services.obs.removeObserver(this, "http-on-modify-request");
		}
	};
	
	
	this.CookieBlocker = {
		registered: false,
		observeredTopics: [
			"http-on-examine-response",
			"http-on-modify-request",
			//"quit-application"
		],
		urls: [],
		
		observe: function (channel, topic) {
			channel.QueryInterface(Components.interfaces.nsIHttpChannel);
			if (topic == "http-on-modify-request") {
				for (let url of this.urls) {
					if (channel.URI.spec.startsWith(url)) {
						let dispURL = Zotero.HTTP.getDisplayURI(channel.URI).spec;
						Zotero.debug("CookieBlocker: Ignoring cookies for " + dispURL);
						channel.setRequestHeader("Cookie", "", false);
					}
				}
			}
			else if (topic == "http-on-examine-response") {
				for (let url of this.urls) {
					if (channel.URI.spec.startsWith(url)) {
						let dispURL = Zotero.HTTP.getDisplayURI(channel.URI).spec;
						channel.setResponseHeader("Set-Cookie", "", false);
					}
				}
			}
		},
		
		addURL: function (url) {
			if (!this.registered) {
				Zotero.debug("CookieBlocker: Registering observers");
				for (let topic of this.observeredTopics) {
					Services.obs.addObserver(this, topic, false);
				}
				this.registered = true;
			}
			if (!this.urls.includes(url)) {
				let dispURL = Zotero.HTTP.getDisplayURI(NetUtil.newURI(url)).spec;
				Zotero.debug("CookieBlocker: Adding " + dispURL + " to blocklist");
				this.urls.push(url);
			}
		},
		
		
		removeURL: function (url) {
			let pos = this.urls.indexOf(url);
			if (pos != -1) {
				let dispURL = Zotero.HTTP.getDisplayURI(NetUtil.newURI(url)).spec;
				Zotero.debug("CookieBlocker: Removing " + dispURL + " from blocklist");
				this.urls.splice(pos, 1);
			}
			if (!this.urls.length) {
				Zotero.debug("CookieBlocker: Removing observers");
				for (let topic of this.observeredTopics) {
					Services.obs.removeObserver(this, topic, false);
				}
				this.registered = false;
			}
		}
	};
	
	
	/**
	 * Make a foreground HTTP request in order to trigger a proxy authentication dialog
	 *
	 * Other Zotero.HTTP requests are background requests by default, and
	 * background requests don't trigger a proxy auth prompt, so we make a
	 * foreground request on startup and resolve the promise
	 * Zotero.proxyAuthComplete when we're done. Any network requests that want
	 * to wait for proxy authentication can wait for that promise.
	 */
	this.triggerProxyAuth = function () {
		if (!Zotero.Prefs.get("triggerProxyAuthentication")
				|| Zotero.HTTP.browserIsOffline()) {
			Zotero.proxyAuthComplete = Zotero.Promise.resolve();
			return false;
		}
		
		var deferred = Zotero.Promise.defer();
		Zotero.proxyAuthComplete = deferred.promise;
		
		Zotero.Promise.try(function () {
			var uris = Zotero.Prefs.get('proxyAuthenticationURLs').split(',');
			uris = Zotero.Utilities.arrayShuffle(uris);
			uris.unshift(ZOTERO_CONFIG.PROXY_AUTH_URL);
			
			return Zotero.spawn(function* () {
				for (let i = 0; i <= uris.length; i++) {
					let uri = uris.shift();
					if (!uri) {
						break;
					}
					
					// For non-Zotero URLs, wait for PAC initialization,
					// in a rather ugly and inefficient manner
					if (i == 1) {
						let installed = yield Zotero.Promise.try(_pacInstalled)
						.then(function (installed) {
							if (installed) throw true;
						})
						.delay(500)
						.then(_pacInstalled)
						.then(function (installed) {
							if (installed) throw true;
						})
						.delay(1000)
						.then(_pacInstalled)
						.then(function (installed) {
							if (installed) throw true;
						})
						.delay(2000)
						.then(_pacInstalled)
						.catch(function () {
							return true;
						});
						if (!installed) {
							Zotero.debug("No general proxy or PAC file found -- assuming direct connection");
							break;
						}
					}
					
					let proxyInfo = yield _proxyAsyncResolve(uri);
					if (proxyInfo) {
						Zotero.debug("Proxy required for " + uri + " -- making HEAD request to trigger auth prompt");
						yield Zotero.HTTP.request("HEAD", uri, {
							foreground: true,
							noCache: true,
							isProxyAuthRequest: true
						})
						.catch(function (e) {
							Zotero.logError("Error connecting to proxy -- proxied requests may not work");
							Zotero.logError(e);
							
							// Show error icon at startup
							e.dialogHeader = Zotero.getString('networkError.errorViaProxy');
							if (!e.dialogButtonText) {
								e.dialogButtonText = Zotero.getString('general.moreInformation');
								e.dialogButtonCallback = () => {
									Zotero.launchURL('https://www.zotero.org/support/kb/connection_error');
								};
							}
							Zotero.proxyFailure = e;
						});
						break;
					}
					else {
						Zotero.debug("Proxy not required for " + uri);
					}
				}
				deferred.resolve();
			});
		})
		.catch(function (e) {
			Components.utils.reportError(e);
			Zotero.debug(e, 1);
			deferred.resolve();
		});
	}
	
	
	/**
	 * Test if a PAC file is installed
	 *
	 * There might be a better way to do this that doesn't require stepping
	 * through the error log and doing a fragile string comparison.
	 */
	_pacInstalled = function () {
		return Zotero.getErrors(true).some(val => val.indexOf("PAC file installed") == 0)
	}
	
	
	_proxyAsyncResolve = function (uri) {
		Components.utils.import("resource://gre/modules/NetUtil.jsm");
		var pps = Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
			.getService(Components.interfaces.nsIProtocolProxyService);
		var deferred = Zotero.Promise.defer();
		pps.asyncResolve(
			NetUtil.newURI(uri),
			0,
			{
				onProxyAvailable: function (req, uri, proxyInfo, status) {
					//Zotero.debug("onProxyAvailable");
					//Zotero.debug(status);
					deferred.resolve(proxyInfo);
				},
				
				QueryInterface: function (iid) {
					const interfaces = [
						Components.interfaces.nsIProtocolProxyCallback,
						Components.interfaces.nsISupports
					];
					if (!interfaces.some(function(v) { return iid.equals(v) })) {
						throw Components.results.NS_ERROR_NO_INTERFACE;
					}
					return this;
				},
			}
		);
		return deferred.promise;
	}
	
	
	this.isWriteMethod = function (method) {
		return method == 'POST' || method == 'PUT' || method == 'PATCH' || method == 'DELETE';
	};
	
	
	this.getDisplayURI = function (uri, noCredentials) {
		if (typeof uri == 'string') {
			uri = NetUtil.newURI(uri);
		}
		if (!uri.password) return uri;
		uri = uri.mutate();
		if (noCredentials) {
			uri.setUserPass('');
		}
		else {
			uri.setPassword('********');
		}
		return uri.finalize();
	}
	
	
	/**
	 * Get the Authorization header used by a channel
	 *
	 * As of Firefox 3.0.1 subsequent requests to higher-level directories
	 * seem not to authenticate properly and just return 401s, so this
	 * can be used to manually include the Authorization header in a request
	 *
	 * It can also be used to check whether a request was forced to
	 * use authentication
	 *
	 * @param	{nsIChannel}		channel
	 * @return	{String|FALSE}				Authorization header, or FALSE if none
	 */
	this.getChannelAuthorization = function (channel) {
		try {
			channel.QueryInterface(Components.interfaces.nsIHttpChannel);
			var authHeader = channel.getRequestHeader("Authorization");
			return authHeader;
		}
		catch (e) {
			Zotero.debug(e);
			return false;
		}
	}
	
	
	/**
	 * Checks if the browser is currently in "Offline" mode
	 *
	 * @type Boolean
	 */
	this.browserIsOffline = function() { 
		return Services.io.offline;
	}
	
	
	/**
	 * Load one or more documents using XMLHttpRequest
	 *
	 * This should stay in sync with the equivalent function in the connector
	 *
	 * @param {String|String[]} urls URL(s) of documents to load
	 * @param {Function} processor - Callback to be executed for each document loaded; if function returns
	 *     a promise, it's waited for before continuing
	 * @param {Object} [options]
	 * @param {Zotero.CookieSandbox} [options.cookieSandbox] - Cookie sandbox object
	 * @param {Object} [options.headers] - Headers to include in the request
	 * @return {Promise<Array>} - A promise for an array of results from the processor runs
	 */
	this.processDocuments = async function (urls, processor, options = {}) {
		// Handle old signature: urls, processor, onDone, onError, dontDelete, cookieSandbox
		if (arguments.length > 3) {
			Zotero.debug("Zotero.HTTP.processDocuments() now takes only 3 arguments -- update your code");
			var onDone = arguments[2];
			var onError = arguments[3];
			var cookieSandbox = arguments[5];
		}
		else if (options instanceof Zotero.CookieSandbox) {
			Zotero.debug("Zotero.HTTP.processDocuments() now takes an 'options' object for its third parameter -- update your code");
			var cookieSandbox = options;
		}
		else {
			var cookieSandbox = options.cookieSandbox;
			var headers = options.headers;
		}
		
		if (typeof urls == "string") urls = [urls];
		var funcs = urls.map(url => () => {
			return Zotero.HTTP.request(
				"GET",
				url,
				{
					responseType: 'document',
					cookieSandbox,
					headers
				}
			)
			.then((xhr) => {
				var doc = this.wrapDocument(xhr.response, xhr.responseURL);
				return processor(doc, xhr.responseURL);
			});
		});
		
		// Run processes serially
		// TODO: Add some concurrency?
		var f;
		var results = [];
		while (f = funcs.shift()) {
			try {
				results.push(await f());
			}
			catch (e) {
				if (onError) {
					onError(e);
				}
				throw e;
			}
		}
		
		// Deprecated
		if (onDone) {
			onDone();
		}
		
		return results;
	};
	
	/**
	 * Handler for XMLHttpRequest state change
	 *
	 * @param {nsIXMLHttpRequest} xmlhttp XMLHttpRequest whose state just changed
	 * @param {Function} [callback] Callback for request completion
	 * @param {*} [data] Data to be passed back to callback as the second argument
	 * @private
	 */
	function _stateChange(xmlhttp, callback, data) {
		switch (xmlhttp.readyState){
			// Request not yet made
			case 1:
				break;
			
			case 2:
				break;
			
			// Called multiple times while downloading in progress
			case 3:
				break;
			
			// Download complete
			case 4:
				if (callback) {
					callback(xmlhttp, data);
				}
			break;
		}
	}
	
	/**
	 * Check connection for interruption and throw an appropriate error
	 */
	function _checkConnection(xmlhttp, url) {
		if (xmlhttp.status != 0) return;
		
		var msg = null;
		var dialogButtonText = null;
		var dialogButtonCallback = null;
		
		if (xmlhttp.status === 0) {
			msg = Zotero.getString('sync.error.checkConnection');
			dialogButtonText = Zotero.getString('general.moreInformation');
			let supportURL = 'https://www.zotero.org/support/kb/connection_error';
			dialogButtonCallback = () => Zotero.launchURL(supportURL);
		}
		throw new Zotero.HTTP.UnexpectedStatusException(
			xmlhttp,
			url,
			msg,
			{
				dialogButtonText,
				dialogButtonCallback
			}
		);
	}
	
	
	this.checkSecurity = function (channel, { isProxyAuthRequest } = {}) {
		if (!channel) {
			return;
		}
		
		let { state, errorMessage } = SecurityInfo.getSecurityInfo(channel);
		if (state != 'broken') {
			return;
		}
		
		let dialogButtonText;
		let dialogButtonCallback;
		let domain = channel.originalURI?.host ?? '';
		let msg = Zotero.getString('networkError.insecureConnectionTo', [Zotero.appName, domain])
			 + "\n\n";
		if (channel.originalURI?.spec.includes(ZOTERO_CONFIG.DOMAIN_NAME)
				|| channel.originalURI?.spec.includes(ZOTERO_CONFIG.PROXY_AUTH_URL.match(/^https:\/\/([^\/]+)\//)[1])) {
			msg += Zotero.getString('networkError.connectionMonitored', Zotero.appName)
				+ "\n\n"
				+ (isProxyAuthRequest
					? Zotero.getString('startupError.internetFunctionalityMayNotWork') + "\n\n"
					: "");
		}
		msg += errorMessage ?? channel.securityInfo?.errorCodeString ?? '';
		msg = msg.trim();
		dialogButtonText = Zotero.getString('general.moreInformation');
		dialogButtonCallback = function () {
			Zotero.launchURL('https://www.zotero.org/support/kb/ssl_certificate_error');
		};
		throw new Zotero.HTTP.SecurityException(
			msg,
			{
				dialogHeader: Zotero.getString('networkError.connectionNotSecure'),
				dialogButtonText,
				dialogButtonCallback
			}
		);
	};
	
	async function _checkRetry(req) {
		var retryAfter = req.getResponseHeader("Retry-After");
		if (!retryAfter) {
			return false;
		}
		if (parseInt(retryAfter) != retryAfter) {
			Zotero.logError(`Invalid Retry-After delay ${retryAfter}`);
			return false;
		}
		Zotero.debug(`Delaying ${retryAfter} seconds for Retry-After`);
		await Zotero.Promise.delay(retryAfter * 1000);
		return true;
	}
	
	
	/**
	 * Mimics the window.location/document.location interface, given an nsIURL
	 * @param {nsIURL} url
	 */
	this.Location = function(url) {
		this._url = url;
		this.hash = url.ref ? "#"+url.ref : "";
		this.host = url.hostPort;
		this.hostname = url.host;
		this.href = url.spec;
		this.pathname = url.filePath;
		this.port = (url.schemeIs("https") ? 443 : 80);
		this.protocol = url.scheme+":";
		this.search = url.query ? "?"+url.query : "";
	};
	this.Location.prototype = {
		"toString":function() {
			return this.href;
		},
		"__exposedProps__":{
			"hash":"r",
			"host":"r",
			"hostname":"r",
			"href":"r",
			"pathname":"r",
			"port":"r",
			"protocol":"r",
			"search":"r",
			"toString":"r"
		}
	};

	/**
	 * Mimics an HTMLWindow given an nsIURL
	 * @param {nsIURL} url
	 */
	this.Window = function(url) {
		this._url = url;
		this.top = this;
		this.location = Zotero.HTTP.Location(url);
	};
	this.Window.prototype.__exposedProps__ = {
		"top":"r",
		"location":"r"
	};

	/**
	 * Wraps an HTMLDocument object returned by XMLHttpRequest DOMParser to make it look more like it belongs
	 * to a browser. This is necessary if the document is to be passed to Zotero.Translate.
	 * @param {HTMLDocument} doc Document returned by 
	 * @param {nsIURL|String} url
	 */
	this.wrapDocument = function(doc, url) {
		if(typeof url !== "object") {
			url = Services.io.newURI(url, null, null).QueryInterface(Components.interfaces.nsIURL);
		}
		return Zotero.Translate.DOMWrapper.wrap(doc, {
			"documentURI":url.spec,
			"URL":url.spec,
			"location":new Zotero.HTTP.Location(url),
			"defaultView":new Zotero.HTTP.Window(url)
		});
	};

	/**
	 * Extends Headers to preserve the original capitalization in header names. Header names are still compared
	 * case-insensitively, but iterating through the keys or entries will return keys with original capitalization.
	 *
	 * @example
	 * let headers = new Headers({ 'Header-Name': 'Header value' });
	 * Array.from(headers)  // -> [['header-name', 'Header value']]
	 *
	 * headers = new Zotero.HTTP.CasePreservingHeaders({ 'Header-Name': 'Header value' });
	 * Array.from(headers)  // -> [['Header-Name', 'Header value']]
	 */
	this.CasePreservingHeaders = class extends Headers {
		_originalNames = new Map();
		
		constructor(init) {
			super();
			if (init) {
				let iter;
				if (Symbol.iterator in init) {
					iter = init;
				}
				else {
					iter = Object.entries(init);
				}
				for (let [name, value] of iter) {
					this.append(name, value);
				}
			}
		}
		
		append(name, value) {
			super.append(name, value);
			this._originalNames.set(name.toLowerCase(), name);
		}

		set(name, value) {
			super.set(name, value);
			this._originalNames.set(name.toLowerCase(), name);
		}

		[Symbol.iterator]() {
			return this.entries();
		}

		entries() {
			return Array.from(super.entries())
				.map(([name, value]) => [this._originalNames.get(name) || name, value])
				.values();
		}

		keys() {
			return Array.from(super.keys())
				.map(name => this._originalNames.get(name) || name)
				.values();
		}

		forEach(callbackfn, thisArg) {
			for (let [name, value] of this.entries()) {
				callbackfn.call(thisArg, value, name, this);
			}
		}
	};
}
