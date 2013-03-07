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
Zotero.CookieSandbox = function(browser, uri, cookieData, userAgent) {
	this._observerService = Components.classes["@mozilla.org/observer-service;1"].
		getService(Components.interfaces.nsIObserverService);
	
	if(uri instanceof Components.interfaces.nsIURI) {
		this.URI = uri;
	} else {
		this.URI = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService)
			.newURI(uri, null, null);
	}
	
	this._cookies = {};
	if(cookieData) {
		var splitCookies = cookieData.split(/; ?/);
		for each(var cookie in splitCookies) {
			var key = cookie.substr(0, cookie.indexOf("="));
			var value = cookie.substr(cookie.indexOf("=")+1);
			this._cookies[key] = value;
		}
	}
	
	if(userAgent) this.userAgent = userAgent;
	
	Zotero.CookieSandbox.Observer.register();
	if(browser) {
		this.attachToBrowser(browser);
	}
}

Zotero.CookieSandbox.prototype = {
	/**
	 * Adds cookies to this CookieSandbox based on a cookie header
	 * @param {String} cookieString;
	 */
	"addCookiesFromHeader":function(cookieString) {
		var cookies = cookieString.split("\n");
		for(var i=0, n=cookies.length; i<n; i++) {
			var cookieInfo = cookies[i].split(/; ?/);
			var secure = false;
			
			for(var j=1, m=cookieInfo.length; j<m; j++) {
				if(cookieInfo[j].substr(0, cookieInfo[j].indexOf("=")).toLowerCase() === "secure") {
					secure = true;
					break;
				}
			}
			
			if(!secure) {
				var key = cookieInfo[0].substr(0, cookieInfo[0].indexOf("="));
				var value = cookieInfo[0].substr(cookieInfo[0].indexOf("=")+1);
				this._cookies[key] = value;
			}
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
		Zotero.CookieSandbox.Observer.trackedInterfaceRequestors.push(Components.utils.getWeakReference(ir.QueryInterface(Components.interfaces.nsIInterfaceRequestor)));
		Zotero.CookieSandbox.Observer.trackedInterfaceRequestorSandboxes.push(this);
	}
}

Zotero.CookieSandbox.prototype.__defineGetter__("cookieString", function() {
	return [key+"="+this._cookies[key] for(key in this._cookies)].join("; ");
});

/**
 * nsIObserver implementation for adding, clearing, and slurping cookies
 */
Zotero.CookieSandbox.Observer = new function() {
	const observeredTopics = ["http-on-examine-response", "http-on-modify-request", "quit-application"];
	
	var observerService = Components.classes["@mozilla.org/observer-service;1"].
			getService(Components.interfaces.nsIObserverService),
		observing = false;
	
	/**
	 * Registers cookie manager and observer, if necessary
	 */
	this.register = function(CookieSandbox) {
		this.trackedBrowsers = new WeakMap();
		this.trackedInterfaceRequestors = [];
		this.trackedInterfaceRequestorSandboxes = [];
		
		if(!observing) {
			Zotero.debug("CookieSandbox: Registering observers");
			for each(var topic in observeredTopics) observerService.addObserver(this, topic, false);
			observing = true;
		}
	};
	
	/**
	 * Implements nsIObserver to watch for new cookies and to add sandboxed cookies
	 */
	this.observe = function(channel, topic) {
		channel.QueryInterface(Components.interfaces.nsIHttpChannel);
		var trackedBy, tested, browser, callbacks,
			channelURI = channel.URI.hostPort,
			notificationCallbacks = channel.notificationCallbacks;
		
		// try the notification callbacks
		if(notificationCallbacks) {
			for(var i=0; i<this.trackedInterfaceRequestors.length; i++) {
				// Interface requestors are stored as weak references, so we have to see
				// if they still point to something
				var ir = this.trackedInterfaceRequestors[i].get();
				if(!ir) {
					// The interface requestor is gone, so remove it from the list
					this.trackedInterfaceRequestors.splice(i, 1);
					this.trackedInterfaceRequestorSandboxes.splice(i, 1);
					i--;
				} else if(ir == notificationCallbacks) {
					// We are tracking this interface requestor
					trackedBy = this.trackedInterfaceRequestorSandboxes[i];
					break;
				}
			}
			
			if(trackedBy) {
				tested = true;
			} else {
				// try the browser
				try {
					browser = notificationCallbacks.getInterface(Ci.nsIWebNavigation)
						.QueryInterface(Ci.nsIDocShell).chromeEventHandler;
				} catch(e) {}
				if(browser) {
					tested = true;
					trackedBy = this.trackedBrowsers.get(browser);
				} else {
					// try the document for the load group
					try {
						browser = channel.loadGroup.notificationCallbacks.getInterface(Ci.nsIWebNavigation)
							.QueryInterface(Ci.nsIDocShell).chromeEventHandler;
					} catch(e) {}
					if(browser) {
						tested = true;
						trackedBy = this.trackedBrowsers.get(browser);
					} else {
						// try getting as an XHR or nsIWBP
						try {
							notificationCallbacks.QueryInterface(Components.interfaces.nsIXMLHttpRequest);
							tested = true;
						} catch(e) {}
						if(!tested) {
							try {
								notificationCallbacks.QueryInterface(Components.interfaces.nsIWebBrowserPersist);
								tested = true;
							} catch(e) {}
						}
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
			// clear cookies to be sent to other domains
			if(!trackedBy || channel.URI.host != trackedBy.URI.host) {
				channel.setRequestHeader("Cookie", "", false);
				channel.setRequestHeader("Cookie2", "", false);
				Zotero.debug("CookieSandbox: Cleared cookies to be sent to "+channelURI, 5);
				return;
			}
			
			if(trackedBy.userAgent) {
				channel.setRequestHeader("User-Agent", trackedBy.userAgent, false);
			}
			
			// add cookies to be sent to this domain
			channel.setRequestHeader("Cookie", trackedBy.cookieString, false);
			Zotero.debug("CookieSandbox: Added cookies for request to "+channelURI, 5);
		} else if(topic == "http-on-examine-response") {
			// clear cookies being received
			try {
				var cookieHeader = channel.getResponseHeader("Set-Cookie");
			} catch(e) {
				return;
			}
			channel.setResponseHeader("Set-Cookie", "", false);
			channel.setResponseHeader("Set-Cookie2", "", false);
			
			// don't process further if these cookies are for another set of domains
			if(!trackedBy || channel.URI.host != trackedBy.URI.host) {
				Zotero.debug("CookieSandbox: Rejected cookies from "+channelURI, 5);
				return;
			}
			
			// put new cookies into our sandbox
			if(cookieHeader) trackedBy.addCookiesFromHeader(cookieHeader);
			
			Zotero.debug("CookieSandbox: Slurped cookies from "+channelURI, 5);
		}
	}
}