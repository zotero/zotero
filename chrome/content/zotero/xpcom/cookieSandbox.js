/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
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

/**
 * Manage cookies in a sandboxed fashion
 *
 * @constructor
 * @param {browser} [browser] Hidden browser object
 * @param {String|nsIURI} uri URI of page to manage cookies for (cookies for domains that are not
 *                     subdomains of this URI are ignored)
 * @param {String} cookieData Cookies with which to initiate the sandbox
 * @param {String} userAgent User agent to use for sandboxed requests
 */
Zotero.CookieSandbox = function (browser, uri, cookieData, userAgent) {
	this._cookies = {};
	if (cookieData) {
		let URI;
		if (uri instanceof Components.interfaces.nsIURI) {
			URI = uri;
		} else {
			URI = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService)
				.newURI(uri, null, null);
		}
		var splitCookies = cookieData.split(/;\s*/);
		for (let cookie of splitCookies) {
			this.setCookie(cookie, URI.host);
		}
	}
	
	if (userAgent) this.userAgent = userAgent;

	this._observerService = Components.classes["@mozilla.org/observer-service;1"].
	getService(Components.interfaces.nsIObserverService);

	Zotero.CookieSandbox.Observer.register();
	if (browser) {
		this.attachToBrowser(browser);
	}
};

/**
 * Normalizes the host string: lower-case, remove leading period, some more cleanup
 * @param {String} host;
 */
Zotero.CookieSandbox.normalizeHost = function(host) {
	return host.trim().toLowerCase().replace(/^\.+|[:\/].*/g, '');
}

/**
 * Normalizes the path string
 * @param {String} path;
 */
Zotero.CookieSandbox.normalizePath = function(path) {
	return '/' + path.trim().replace(/^\/+|[?#].*/g, '');
}

/**
 * Generates a semicolon-separated string of cookie values from a list of cookies
 * @param {Object} cookies Object containing key: value cookie pairs
 */
Zotero.CookieSandbox.generateCookieString = function(cookies) {
	var str = '';
	for(var key in cookies) {
		str += '; ' + key + '=' + cookies[key];
	}
	
	return str ? str.substr(2) : '';
}

Zotero.CookieSandbox.prototype = {
	clone() {
		let clone = new Zotero.CookieSandbox();
		clone._cookies = Zotero.Utilities.deepCopy(this._cookies);
		clone.userAgent = this.userAgent;
		return clone;
	},
	/**
	 * Adds cookies to this CookieSandbox based on a cookie header
	 * @param {String} cookieString;
	 * @param {nsIURI} [uri] URI of the header origin.
	                   Used to verify same origin. If omitted validation is not performed
	 */
	"addCookiesFromHeader":function(cookieString, uri) {
		var cookies = cookieString.split("\n");
		if(uri) {
			var validDomain = '.' + Zotero.CookieSandbox.normalizeHost(uri.host);
		}
		
		for(var i=0, n=cookies.length; i<n; i++) {
			var cookieInfo = cookies[i].split(/;\s*/);
			var secure = false, path = '', domain = '', hostOnly = false;
			
			for(var j=1, m=cookieInfo.length; j<m; j++) {
				var pair = cookieInfo[j].split(/\s*=\s*/);
				switch(pair[0].trim().toLowerCase()) {
					case 'secure':
						secure = true;
						break;
					case 'domain':
						domain = pair[1];
						break;
					case 'path':
						path = pair[1];
						break;
					case 'hostonly':
						hostOnly = true;
						break;
				}
				
				if(secure && domain && path && hostOnly) break;
			}
			
			// Domain must be a suffix of the host setting the cookie
			if(validDomain && domain) {
				var normalizedDomain = Zotero.CookieSandbox.normalizeHost(domain);
				var substrMatch = validDomain.lastIndexOf(normalizedDomain);
				var publicSuffix;
				try { publicSuffix = Services.eTLD.getPublicSuffix(uri) }  catch(e) {}
				if(substrMatch == -1 || !publicSuffix || publicSuffix == normalizedDomain
					|| (substrMatch + normalizedDomain.length != validDomain.length)
					|| (validDomain.charAt(substrMatch-1) != '.')) {
					Zotero.debug("CookieSandbox: Ignoring attempt to set a cookie for different host");
					continue;
				}
			}
			
			// When no domain is set, use requestor's host (hostOnly cookie)
			if(validDomain && !domain) {
				domain = validDomain.substr(1);
				hostOnly = true;
			}
			
			this.setCookie(cookieInfo[0], domain, path, secure, hostOnly);
		}
	},
	
	/**
	 * Attach CookieSandbox to a specific browser
	 * @param {Browser} browser
	 */
	"attachToBrowser":function(browser) {
		Zotero.CookieSandbox.Observer.trackedBrowsers.set(browser, this);
	},
	
	/**
	 * Attach CookieSandbox to a specific XMLHttpRequest
	 * @param {nsIInterfaceRequestor} ir
	 */
	"attachToInterfaceRequestor": function(ir) {
		if (typeof ir.QueryInterface === 'function') {
			ir = ir.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
		}
		Zotero.CookieSandbox.Observer.trackedInterfaceRequestors.set(ir, this);
	},
	
	/**
	 * Set a cookie for a specified host
	 * @param {String} cookiePair A single cookie pair in the form key=value
	 * @param {String} [host] Host to bind the cookie to.
	 *                        Defaults to the host set on this.URI
	 * @param {String} [path]
	 * @param {Boolean} [secure] Whether the cookie has the secure attribute set
	 * @param {Boolean} [hostOnly] Whether the cookie is a host-only cookie
	 */
	"setCookie": function(cookiePair, host, path, secure, hostOnly) {
		var splitAt = cookiePair.indexOf('=');
		if(splitAt === -1) {
			Zotero.debug("CookieSandbox: Not setting invalid cookie.");
			return;
		}
		var pair = [cookiePair.substring(0,splitAt), cookiePair.substring(splitAt+1)];
		var name = pair[0].trim();
		var value = pair[1].trim();
		if(!name) {
			Zotero.debug("CookieSandbox: Ignoring attempt to set cookie with no name");
			return;
		}
		
		host = '.' + Zotero.CookieSandbox.normalizeHost(host);
		
		if(!path) path = '/';
		path = Zotero.CookieSandbox.normalizePath(path);
		
		if(!this._cookies[host]) {
			this._cookies[host] = {};
		}
		
		if(!this._cookies[host][path]) {
			this._cookies[host][path] = {};
		}
		
		/*Zotero.debug("CookieSandbox: adding cookie " + name + '='
			+ value + ' for host ' + host + ' and path ' + path 
			+ '[' + (hostOnly?'hostOnly,':'') + (secure?'secure':'') + ']');*/
		
		this._cookies[host][path][name] = {
			value: value,
			secure: !!secure,
			hostOnly: !!hostOnly
		};
	},
	
	/**
	 * Returns a list of cookies that should be sent to the given URI
	 * @param {nsIURI} uri
	 */
	"getCookiesForURI": function(uri) {
		var hostParts = Zotero.CookieSandbox.normalizeHost(uri.host).split('.'),
			pathParts = Zotero.CookieSandbox.normalizePath(uri.filePath || uri.pathQueryRef).split('/'),
			cookies = {}, found = false, secure = uri.scheme.toUpperCase() == 'HTTPS';
		
		// Fetch cookies starting from the highest level domain
		var cookieHost = '.' + hostParts[hostParts.length-1];
		for(var i=hostParts.length-2; i>=0; i--) {
			cookieHost = '.' + hostParts[i] + cookieHost;
			if(this._cookies[cookieHost]) {
				found = this._getCookiesForPath(cookies, this._cookies[cookieHost], pathParts, secure, i==0) || found;
			}
		}
		
		//Zotero.debug("CookieSandbox: returning cookies:");
		//Zotero.debug(cookies);
		
		return found ? cookies : null;
	},
	
	"_getCookiesForPath": function(cookies, cookiePaths, pathParts, secure, isHost) {
		var found = false;
		var path = '';
		for(var i=0, n=pathParts.length; i<n; i++) {
			path += pathParts[i];
			var cookiesForPath = cookiePaths[path];
			if(cookiesForPath) {
				for(var key in cookiesForPath) {
					if(cookiesForPath[key].secure && !secure) continue;
					if(cookiesForPath[key].hostOnly && !isHost) continue;
					
					found = true;
					cookies[key] = cookiesForPath[key].value;
				}
			}
			
			// Also check paths with trailing / (but not for last part)
			path += '/';
			cookiesForPath = cookiePaths[path];
			if(cookiesForPath && i != n-1) {
				for(var key in cookiesForPath) {
					if(cookiesForPath[key].secure && !secure) continue;
					if(cookiesForPath[key].hostOnly && !isHost) continue;
					
					found = true;
					cookies[key] = cookiesForPath[key].value;
				}
			}
		}
		return found;
	}
}

/**
 * nsIObserver implementation for adding, clearing, and slurping cookies
 */
Zotero.CookieSandbox.Observer = new function() {
	const observeredTopics = ["http-on-examine-response", "http-on-modify-request"];
	
	var observerService = Components.classes["@mozilla.org/observer-service;1"].
			getService(Components.interfaces.nsIObserverService),
		observing = false;
	this.trackedBrowsers = new WeakMap();
	this.trackedInterfaceRequestors = new WeakMap();
	
	/**
	 * Registers cookie manager and observer, if necessary
	 */
	this.register = function () {
		if (!observing) {
			Zotero.debug("CookieSandbox: Registering observers");
			for (let topic of observeredTopics) observerService.addObserver(this, topic, false);
			observing = true;
		}
	};
	
	/**
	 * Implements nsIObserver to watch for new cookies and to add sandboxed cookies
	 */
	this.observe = function (channel, topic) {
		channel.QueryInterface(Components.interfaces.nsIHttpChannel);
		var trackedBy, tested, browser,
			channelURI = channel.URI.hostPort,
			notificationCallbacks = channel.notificationCallbacks;
		
		// Zotero.debug(`CookieSandbox: Observing ${topic} at ${channelURI}`, 5);
		
		// try the notification callbacks
		if (notificationCallbacks) {
			trackedBy = this.trackedInterfaceRequestors.get(notificationCallbacks);
			if (trackedBy) {
				tested = true;
			}
			else {
				// try the browser
				try {
					browser = notificationCallbacks.getInterface(Ci.nsILoadContext).topFrameElement;
				}
				catch (e) {}
				if (browser) {
					tested = true;
					// Zotero.debug(`CookieSandbox: Directly found the browser ${browser.browserId} for ${channelURI}`, 5);
					trackedBy = this.trackedBrowsers.get(browser);
				}
				else {
					// try the document for the load group
					try {
						browser = channel.loadGroup.notificationCallbacks.getInterface(Ci.nsIWebNavigation)
							.QueryInterface(Ci.nsIDocShell).chromeEventHandler;
					}
					catch (e) {}
					if (browser) {
						tested = true;
						// Zotero.debug(`CookieSandbox: Found the browser via doc of load group for ${channelURI}`, 5);
						trackedBy = this.trackedBrowsers.get(browser);
					}
					else if (notificationCallbacks instanceof XMLHttpRequest) {
						// Zotero.debug(`CookieSandbox: Found the browser via XHR for ${channelURI}`, 5);
						tested = true;
					}
					else {
						// try getting as an nsIWBP
						try {
							notificationCallbacks.QueryInterface(Components.interfaces.nsIWebBrowserPersist);
							// Zotero.debug(`CookieSandbox: Found the browser via nsIWBP for ${channelURI}`, 5);
							tested = true;
						}
						catch (e) {}
					}
				}
			}
		}
		
		// trackedBy => we should manage cookies for this request
		// tested && !trackedBy => we should not manage cookies for this request
		// !tested && !trackedBy => this request is of a type we couldn't match to this request.
		//         one such type is a link prefetch (nsPrefetchNode) but there might be others as
		//         well. for now, we are paranoid and reject these.
		
		if(tested) {
			if(trackedBy) {
				Zotero.debug("CookieSandbox: Managing cookies for "+channelURI, 5);
			} else {
				Zotero.debug("CookieSandbox: Not touching channel for "+channelURI, 5);
				return;
			}
		} else {
			Zotero.debug("CookieSandbox: Being paranoid about channel for "+channelURI, 5);
		}
		
		if(topic == "http-on-modify-request") {
			// Clear cookies to be sent to other domains if we're not explicitly managing them
			if(trackedBy) {
				var cookiesForURI = trackedBy.getCookiesForURI(channel.URI);
			}

			if (trackedBy && trackedBy.userAgent) {
				channel.setRequestHeader("User-Agent", trackedBy.userAgent, false);
			}
			
			if(!trackedBy || !cookiesForURI) {
				channel.setRequestHeader("Cookie", "", false);
				channel.setRequestHeader("Cookie2", "", false);
				Zotero.debug("CookieSandbox: Cleared cookies to be sent to "+channelURI, 5);
				return;
			}
		
			// add cookies to be sent to this domain
			channel.setRequestHeader("Cookie", Zotero.CookieSandbox.generateCookieString(cookiesForURI), false);
			Zotero.debug("CookieSandbox: Added cookies for request to "+channelURI, 5);
		} else if(topic == "http-on-examine-response") {
			// clear cookies being received
			try {
				var cookieHeader = channel.getResponseHeader("Set-Cookie");
			} catch(e) {
				Zotero.debug("CookieSandbox: No Set-Cookie header received for "+channelURI, 5);
				return;
			}
			
			channel.setResponseHeader("Set-Cookie", "", false);
			channel.setResponseHeader("Set-Cookie2", "", false);
			
			if(!cookieHeader || !trackedBy) {
				Zotero.debug("CookieSandbox: Not tracking received cookies for "+channelURI, 5);
				return;
			}
			
			// Put new cookies into our sandbox
			trackedBy.addCookiesFromHeader(cookieHeader, channel.URI);
			
			Zotero.debug("CookieSandbox: Slurped cookies from "+channelURI, 5);
		}
	}
}
