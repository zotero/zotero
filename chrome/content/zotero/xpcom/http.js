/**
 * Functions for performing HTTP requests, both via XMLHTTPRequest and using a hidden browser
 * @namespace
 */
Zotero.HTTP = new function() {
	this.lastGoogleScholarQueryTime = 0;

	/**
	 * Exception returned for unexpected status when promise* is used
	 * @constructor
	 */
	this.UnexpectedStatusException = function(xmlhttp, msg) {
		this.xmlhttp = xmlhttp;
		this.status = xmlhttp.status;
		this.message = msg;
		
		// Hide password from debug output
		//
		// Password also shows up in channel.name (nsIRequest.name), but that's
		// read-only and has to be handled in Zotero.varDump()
		try {
			if (xmlhttp.channel.URI.password) {
				xmlhttp.channel.URI.password = "********";
			}
		}
		catch (e) {
			Zotero.debug(e, 1);
		}
	};
	
	this.UnexpectedStatusException.prototype.toString = function() {
		return this.message;
	};
	
	/**
	 * Exception returned if the browser is offline when promise* is used
	 * @constructor
	 */
	this.BrowserOfflineException = function() {
		this.message = "XMLHttpRequest could not complete because the browser is offline";
	};
	this.BrowserOfflineException.prototype.toString = function() {
		return this.message;
	};
	
	/**
	 * Get a promise for a HTTP request
	 * 
	 * @param {String} method The method of the request ("GET", "POST", "HEAD", or "OPTIONS")
	 * @param {nsIURI|String}	url				URL to request
	 * @param {Object} [options] Options for HTTP request:<ul>
	 *         <li>body - The body of a POST request</li>
	 *         <li>cookieSandbox - The sandbox from which cookies should be taken</li>
	 *         <li>debug - Log response text and status code</li>
	 *         <li>dontCache - If set, specifies that the request should not be fulfilled from the cache</li>
	 *         <li>foreground - Make a foreground request, showing certificate/authentication dialogs if necessary</li>
	 *         <li>headers - HTTP headers to include in the request</li>
	 *         <li>requestObserver - Callback to receive XMLHttpRequest after open()</li>
	 *         <li>responseType - The type of the response. See XHR 2 documentation for legal values</li>
	 *         <li>responseCharset - The charset the response should be interpreted as</li>
	 *         <li>successCodes - HTTP status codes that are considered successful, or FALSE to allow all</li>
	 *     </ul>
	 * @param {Zotero.CookieSandbox} [cookieSandbox] Cookie sandbox object
	 * @return {Promise} A promise resolved with the XMLHttpRequest object if the request
	 *     succeeds, or rejected if the browser is offline or a non-2XX status response
	 *     code is received (or a code not in options.successCodes if provided).
	 */
	this.promise = function promise(method, url, options) {
		if (url instanceof Components.interfaces.nsIURI) {
			// Don't display password in console
			var dispURL = this.getDisplayURI(url).spec;
			url = url.spec;
		}
		else {
			var dispURL = url;
		}
		
		if(options && options.body) {
			var bodyStart = options.body.substr(0, 1024);
			// Don't display sync password or session id in console
			bodyStart = bodyStart.replace(/password=[^&]+/, 'password=********');
			bodyStart = bodyStart.replace(/sessionid=[^&]+/, 'sessionid=********');
			
			Zotero.debug("HTTP "+method+" "
				+ (options.body.length > 1024 ?
					bodyStart + '... (' + options.body.length + ' chars)' : bodyStart)
				+ " to " + dispURL);
		} else {
			Zotero.debug("HTTP " + method + " " + dispURL);
		}
		
		if (this.browserIsOffline()) {
			return Q.fcall(function() {
				Zotero.debug("HTTP " + method + " " + dispURL + " failed: "
					+ "Browser is offline");
				throw new this.BrowserOfflineException();
			});
		}
		
		var deferred = Q.defer();
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		if (!options || !options.foreground) {
			xmlhttp.mozBackgroundRequest = true;
		}
		xmlhttp.open(method, url, true);
		
		// Pass the request to a callback
		if (options && options.requestObserver) {
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
		if(channel instanceof Components.interfaces.nsIHttpChannelInternal) {
			channel.forceAllowThirdPartyCookie = true;
			
			// Set charset
			if (options && options.responseCharset) {
				channel.contentCharset = responseCharset;
			}
			
			// Disable caching if requested
			if(options && options.dontCache) {
				channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
			}
		}

		// Set responseType
		if(options && options.responseType) {
			xmlhttp.responseType = options.responseType;
		}
		
		// Send headers
		var headers = (options && options.headers) || {};
		if (options && options.body && !headers["Content-Type"]) {
			headers["Content-Type"] = "application/x-www-form-urlencoded";
		}
		for (var header in headers) {
			xmlhttp.setRequestHeader(header, headers[header]);
		}
		
		xmlhttp.onloadend = function() {
			var status = xmlhttp.status;
			
			if (options && options.successCodes) {
				var success = options.successCodes.indexOf(status) != -1;
			}
			// Explicit FALSE means allow any status code
			else if (options && options.successCodes === false) {
				var success = true;
			}
			else if(isFile) {
				var success = status == 200 || status == 0;
			}
			else {
				var success = status >= 200 && status < 300;
			}
			
			if(success) {
				if (options && options.debug) {
					Zotero.debug("HTTP " + method + " " + dispURL
						+ " succeeded with " + xmlhttp.status);
					Zotero.debug(xmlhttp.responseText);
				}
				deferred.resolve(xmlhttp);
			} else {
				var msg = "HTTP " + method + " " + dispURL + " failed: "
					+ "Unexpected status code " + xmlhttp.status;
				Zotero.debug(msg, 1);
				if (options && options.debug) {
					Zotero.debug(xmlhttp.responseText);
				}
				deferred.reject(new Zotero.HTTP.UnexpectedStatusException(xmlhttp, msg));
			}
		};
		
		if(options && options.cookieSandbox) {
			options.cookieSandbox.attachToInterfaceRequestor(xmlhttp);
		}
		
		xmlhttp.send((options && options.body) || null);
		
		return deferred.promise;
	};
	
	/**
	 * Send an HTTP GET request via XMLHTTPRequest
	 * 
	 * @param {nsIURI|String}	url				URL to request
	 * @param {Function} 		onDone			Callback to be executed upon request completion
	 * @param {String} 		responseCharset	Character set to force on the response
	 * @param {Zotero.CookieSandbox} [cookieSandbox] Cookie sandbox object
	 * @return {XMLHttpRequest} The XMLHttpRequest object if the request was sent, or
	 *     false if the browser is offline
	 * @deprecated Use {@link Zotero.HTTP.promise}
	 */
	this.doGet = function(url, onDone, responseCharset, cookieSandbox) {
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
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
		
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open('GET', url, true);
		
		// Send cookie even if "Allow third-party cookies" is disabled (>=Fx3.6 only)
		var channel = xmlhttp.channel;
		channel.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
		channel.forceAllowThirdPartyCookie = true;
		
		// Set charset
		if (responseCharset) {
			channel.contentCharset = responseCharset;
		}
	
		// Don't cache GET requests
		xmlhttp.channel.loadFlags |= Components.interfaces.nsIRequest.LOAD_BYPASS_CACHE;
		
		var useMethodjit = Components.utils.methodjit;
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			// XXX Remove when we drop support for Fx <24
			if(useMethodjit !== undefined) Components.utils.methodjit = useMethodjit;
			_stateChange(xmlhttp, onDone, responseCharset);
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
	 * @deprecated Use {@link Zotero.HTTP.promise}
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
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open('POST', url, true);
		// Send cookie even if "Allow third-party cookies" is disabled (>=Fx3.6 only)
		var channel = xmlhttp.channel;
		channel.QueryInterface(Components.interfaces.nsIHttpChannelInternal);
		channel.forceAllowThirdPartyCookie = true;
		
		// Set charset
		if (responseCharset) {
			channel.contentCharset = responseCharset;
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
			// XXX Remove when we drop support for Fx <24
			if(useMethodjit !== undefined) Components.utils.methodjit = useMethodjit;
			_stateChange(xmlhttp, onDone, responseCharset);
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
	 * @deprecated Use {@link Zotero.HTTP.promise}
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
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
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
			// XXX Remove when we drop support for Fx <24
			if(useMethodjit !== undefined) Components.utils.methodjit = useMethodjit;
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
	 * @deprecated Use {@link Zotero.HTTP.promise}
	 */
	this.doOptions = function (uri, callback) {
		// Don't display password in console
		var disp = this.getDisplayURI(uri);
		Zotero.debug("HTTP OPTIONS for " + disp.spec);
		
		if (Zotero.HTTP.browserIsOffline()){
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open('OPTIONS', uri.spec, true);
		
		var useMethodjit = Components.utils.methodjit;
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			// XXX Remove when we drop support for Fx <24
			if(useMethodjit !== undefined) Components.utils.methodjit = useMethodjit;
			_stateChange(xmlhttp, callback);
		};
		xmlhttp.send(null);
		return xmlhttp;
	}
	
	
	/**
	 * Make a foreground HTTP request in order to trigger a proxy authentication
	 * dialog in Standalone
	 *
	 * Other Zotero.HTTP requests are background requests by default, and
	 * background requests don't trigger a proxy auth prompt, so we make a
	 * foreground request on startup and resolve the promise
	 * Zotero.proxyAuthComplete when we're done. Any network requests that want
	 * to wait for proxy authentication can wait for that promise.
	 */
	this.triggerProxyAuth = function () {
		if (!Zotero.isStandalone
				|| !Zotero.Prefs.get("triggerProxyAuthentication")
				|| Zotero.HTTP.browserIsOffline()) {
			Zotero.proxyAuthComplete = Q();
			return false;
		}
		
		var deferred = Q.defer();
		Zotero.proxyAuthComplete = deferred.promise;
		
		Q.fcall(function () {
			var uris = Zotero.Prefs.get('proxyAuthenticationURLs').split(',');
			uris = Zotero.Utilities.arrayShuffle(uris);
			uris.unshift(ZOTERO_CONFIG.PROXY_AUTH_URL);
			
			return Q.async(function () {
				let max = 3; // how many URIs to try after the general Zotero one
				for (let i = 0; i <= max; i++) {
					let uri = uris.shift();
					if (!uri) {
						break;
					}
					
					// For non-Zotero URLs, wait for PAC initialization,
					// in a rather ugly and inefficient manner
					if (i == 1) {
						let installed = yield Q.fcall(_pacInstalled)
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
						yield Zotero.HTTP.promise("HEAD", uri, {
							foreground: true,
							dontCache: true
						})
						.catch(function (e) {
							Components.utils.reportError(e);
							var msg = "Error connecting to proxy -- proxied requests may not work";
							Zotero.log(msg, 'error');
							Zotero.debug(msg, 1);
						});
						break;
					}
					else {
						Zotero.debug("Proxy not required for " + uri);
					}
				}
				deferred.resolve();
			})();
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
		return Zotero.getErrors(true).some(function (val) val.indexOf("PAC file installed") == 0)
	}
	
	
	_proxyAsyncResolve = function (uri) {
		Components.utils.import("resource://gre/modules/NetUtil.jsm");
		var pps = Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
			.getService(Components.interfaces.nsIProtocolProxyService);
		var deferred = Q.defer();
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
	
	
	//
	// WebDAV methods
	//
	
	this.WebDAV = {};
	
	/**
	* Send a WebDAV PROP* request via XMLHTTPRequest
	*
	* Returns false if browser is offline
	*
	* @param		{String}		method			PROPFIND or PROPPATCH
	* @param		{nsIURI}		uri
	* @param		{String}		body				XML string
	* @param		{Function}	callback
	* @param		{Object}		requestHeaders	e.g. { Depth: 0 }
	*/
	this.WebDAV.doProp = function (method, uri, body, callback, requestHeaders) {
		switch (method) {
			case 'PROPFIND':
			case 'PROPPATCH':
				break;
			
			default:
				throw ("Invalid method '" + method
					+ "' in Zotero.HTTP.doProp");
		}
		
		if (requestHeaders && requestHeaders.depth != undefined) {
			var depth = requestHeaders.depth;
		}
		
		// Don't display password in console
		var disp = Zotero.HTTP.getDisplayURI(uri);
		
		var bodyStart = body.substr(0, 1024);
		Zotero.debug("HTTP " + method + " "
			+ (depth != undefined ? "(depth " + depth + ") " : "")
			+ (body.length > 1024 ?
				bodyStart + "... (" + body.length + " chars)" : bodyStart)
			+ " to " + disp.spec);
		
		if (Zotero.HTTP.browserIsOffline()) {
			Zotero.debug("Browser is offline", 2);
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open(method, uri.spec, true);
		
		if (requestHeaders) {
			for (var header in requestHeaders) {
				xmlhttp.setRequestHeader(header, requestHeaders[header]);
			}
		}
		
		xmlhttp.setRequestHeader("Content-Type", 'text/xml; charset="utf-8"');
		
		var useMethodjit = Components.utils.methodjit;
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			// XXX Remove when we drop support for Fx <24
			if(useMethodjit !== undefined) Components.utils.methodjit = useMethodjit;
			_stateChange(xmlhttp, callback);
		};
		
		xmlhttp.send(body);
		return xmlhttp;
	}
	
	
	/**
	 * Send a WebDAV MKCOL request via XMLHTTPRequest
	 *
	 * @param	{nsIURI}		url
	 * @param	{Function}	onDone
	 * @return	{XMLHTTPRequest}
	 */
	this.WebDAV.doMkCol = function (uri, callback) {
		// Don't display password in console
		var disp = Zotero.HTTP.getDisplayURI(uri);
		Zotero.debug("HTTP MKCOL " + disp.spec);
		
		if (Zotero.HTTP.browserIsOffline()) {
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open('MKCOL', uri.spec, true);
		var useMethodjit = Components.utils.methodjit;
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			// XXX Remove when we drop support for Fx <24
			if(useMethodjit !== undefined) Components.utils.methodjit = useMethodjit;
			_stateChange(xmlhttp, callback);
		};
		xmlhttp.send(null);
		return xmlhttp;
	}
	
	
	/**
	 * Send a WebDAV PUT request via XMLHTTPRequest
	 *
	 * @param	{nsIURI}		url
	 * @param	{String}		body			String body to PUT
	 * @param	{Function}	onDone
	 * @return	{XMLHTTPRequest}
	 */
	this.WebDAV.doPut = function (uri, body, callback) {
		// Don't display password in console
		var disp = Zotero.HTTP.getDisplayURI(uri);
		
		var bodyStart = "'" + body.substr(0, 1024) + "'";
		Zotero.debug("HTTP PUT "
			+ (body.length > 1024 ?
				bodyStart + "... (" + body.length + " chars)" : bodyStart)
			+ " to " + disp.spec);
		
		if (Zotero.HTTP.browserIsOffline()) {
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open("PUT", uri.spec, true);
		// Some servers (e.g., Jungle Disk DAV) return a 200 response code
		// with Content-Length: 0, which triggers a "no element found" error
		// in Firefox, so we override to text
		xmlhttp.overrideMimeType("text/plain");
		var useMethodjit = Components.utils.methodjit;
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			// XXX Remove when we drop support for Fx <24
			if(useMethodjit !== undefined) Components.utils.methodjit = useMethodjit;
			_stateChange(xmlhttp, callback);
		};
		xmlhttp.send(body);
		return xmlhttp;
	}
	
	
	/**
	 * Send a WebDAV PUT request via XMLHTTPRequest
	 *
	 * @param	{nsIURI}		url
	 * @param	{Function}	onDone
	 * @return	{XMLHTTPRequest}
	 */
	this.WebDAV.doDelete = function (uri, callback) {
		// Don't display password in console
		var disp = Zotero.HTTP.getDisplayURI(uri);
		
		Zotero.debug("WebDAV DELETE to " + disp.spec);
		
		if (Zotero.HTTP.browserIsOffline()) {
			return false;
		}
		
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
		// Prevent certificate/authentication dialogs from popping up
		xmlhttp.mozBackgroundRequest = true;
		xmlhttp.open("DELETE", uri.spec, true);
		// Firefox 3 throws a "no element found" error even with a
		// 204 ("No Content") response, so we override to text
		xmlhttp.overrideMimeType("text/plain");
		var useMethodjit = Components.utils.methodjit;
		/** @ignore */
		xmlhttp.onreadystatechange = function() {
			// XXX Remove when we drop support for Fx <24
			if(useMethodjit !== undefined) Components.utils.methodjit = useMethodjit;
			_stateChange(xmlhttp, callback);
		};
		xmlhttp.send(null);
		return xmlhttp;
	}
	
	
	this.getDisplayURI = function (uri) {
		var disp = uri.clone();
		if (disp.password) {
			disp.password = "********";
		}
		return disp;
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
		return Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService).offline;
	}
	
	/**
	 * Load one or more documents in a hidden browser
	 *
	 * @param {String|String[]} urls URL(s) of documents to load
	 * @param {Function} processor Callback to be executed for each document loaded
	 * @param {Function} done Callback to be executed after all documents have been loaded
	 * @param {Function} exception Callback to be executed if an exception occurs
	 * @param {Boolean} dontDelete Don't delete the hidden browser upon completion; calling function
	 *                             must call deleteHiddenBrowser itself.
	 * @param {Zotero.CookieSandbox} [cookieSandbox] Cookie sandbox object
	 * @return {browser} Hidden browser used for loading
	 */
	this.processDocuments = function(urls, processor, done, exception, dontDelete, cookieSandbox) {
		// (Approximately) how many seconds to wait if the document is left in the loading state and
		// pageshow is called before we call pageshow with an incomplete document
		const LOADING_STATE_TIMEOUT = 120;
		var firedLoadEvent = 0;
		
		/**
		 * Loads the next page
		 * @inner
		 */
		var doLoad = function() {
			if(currentURL < urls.length) {
				var url = urls[currentURL],
					hiddenBrowser = hiddenBrowsers[currentURL];
				firedLoadEvent = 0;
				currentURL++;
				try {
					Zotero.debug("Zotero.HTTP.processDocuments: Loading "+url);
					hiddenBrowser.loadURI(url);
				} catch(e) {
					if(exception) {
						exception(e);
						return;
					} else {
						if(!dontDelete) Zotero.Browser.deleteHiddenBrowser(hiddenBrowsers);
						throw(e);
					}
				}
			} else {
				if(!dontDelete) Zotero.Browser.deleteHiddenBrowser(hiddenBrowsers);
				if(done) done();
			}
		};
		
		/**
		 * Callback to be executed when a page load completes
		 * @inner
		 */
		var onLoad = function(e) {
			var hiddenBrowser = e.currentTarget,
				doc = hiddenBrowser.contentDocument;
			if(hiddenBrowser.zotero_loaded) return;
			if(!doc) return;
			var url = doc.documentURI;
			if(url === "about:blank") return;
			if(doc.readyState === "loading" && (firedLoadEvent++) < 120) {
				// Try again in a second
				Zotero.setTimeout(onLoad.bind(this, {"currentTarget":hiddenBrowser}), 1000);
				return;
			}
			
			Zotero.debug("Zotero.HTTP.processDocuments: "+url+" loaded");
			hiddenBrowser.removeEventListener("pageshow", onLoad, true);
			hiddenBrowser.zotero_loaded = true;
			
			try {
				processor(doc);
			} catch(e) {
				if(exception) {
					exception(e);
					return;
				} else {
					throw(e);
				}
			} finally {
				doLoad();
			}
		};
		
		if(typeof(urls) == "string") urls = [urls];
		
		var hiddenBrowsers = [],
			currentURL = 0;
		for(var i=0; i<urls.length; i++) {
			var hiddenBrowser = Zotero.Browser.createHiddenBrowser();
			if(cookieSandbox) cookieSandbox.attachToBrowser(hiddenBrowser);
			hiddenBrowser.addEventListener("pageshow", onLoad, true);
			hiddenBrowsers[i] = hiddenBrowser;
		}
		
		doLoad();
		
		return hiddenBrowsers.length === 1 ? hiddenBrowsers[0] : hiddenBrowsers.slice();
	}
	
	/**
	 * Handler for XMLHttpRequest state change
	 *
	 * @param {nsIXMLHttpRequest} xmlhttp XMLHttpRequest whose state just changed
	 * @param {Function} [callback] Callback for request completion
	 * @param {String} [responseCharset] Character set to force on the response
	 * @param {*} [data] Data to be passed back to callback as the second argument
	 * @private
	 */
	function _stateChange(xmlhttp, callback, responseCharset, data) {
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
					// Override the content charset
					if (responseCharset) {
						xmlhttp.channel.contentCharset = responseCharset;
					}
					callback(xmlhttp, data);
				}
			break;
		}
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
	 }
}