/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
	
	Utilities based in part on code taken from Piggy Bank 2.1.1 (BSD-licensed)
	
	
    ***** END LICENSE BLOCK *****
*/

/**
 * A singleton to handle URL rewriting proxies
 */
Zotero.Proxies = new function() {
	var on = false;
	var proxies = false;
	var hosts;
	var ioService = Components.classes["@mozilla.org/network/io-service;1"]
							  .getService(Components.interfaces.nsIIOService);
	var autoRecognize = false;
	var transparent = false;
	var lastRecognizedURI = false;
	var lastButton = false;
	
	this.init = function() {
		if(!on) {
			var observerService = Components.classes["@mozilla.org/observer-service;1"]
										.getService(Components.interfaces.nsIObserverService);
			observerService.addObserver(this, "http-on-examine-response", false);
			this.get();
		}
		on = true;
		
		autoRecognize = Zotero.Prefs.get("proxies.autoRecognize");
		transparent = Zotero.Prefs.get("proxies.transparent");
	}
	
	/**
	 * Observe method to capture page loads
	 */
	this.observe = function(channel) {
		channel.QueryInterface(Components.interfaces.nsIHttpChannel);
		try {
			// remove content-disposition headers for endnote, etc.
			var contentType = channel.getResponseHeader("Content-Type").toLowerCase();
			for each(var desiredContentType in Zotero.Ingester.MIMEHandler.URIContentListener.desiredContentTypes) {
				if(contentType.length < desiredContentType.length) {
					break;
				} else {
					if(contentType.substr(0, desiredContentType.length) == desiredContentType) {
						channel.setResponseHeader("Content-Disposition", "", false);
						break;
					}
				}
			}
		} catch(e) {}
		
		// try to detect a proxy
		channel.QueryInterface(Components.interfaces.nsIRequest);
		if(channel.loadFlags & Components.interfaces.nsIHttpChannel.LOAD_DOCUMENT_URI) {
			channel.QueryInterface(Components.interfaces.nsIHttpChannel);
			var url = channel.URI.spec;

			// see if there is a proxy we already know
			var m = false;
			var proxy;
			for each(proxy in proxies) {
				if(proxy.regexp && proxy.multiHost) {
					m = proxy.regexp.exec(url);
					if(m) break;
				}
			}
			
			if(m) {
				// add this host if we know a proxy
				if(proxy.autoAssociate) {
					var host = m[proxy.parameters.indexOf("%h")+1];
					if(proxy.hosts.indexOf(host) == -1) {
						proxy.hosts.push(host);
						proxy.save();
					}
				}
			} else if(autoRecognize) {
				// otherwise, try to detect a proxy
				var proxy = false;
				for each(var detector in Zotero.Proxies.Detectors) {
					try {
						proxy = detector(channel);
					} catch(e) {
						Components.utils.reportError(e);
					}
					
					if(proxy) {
						var checkState = {value:false};
						var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
							.getService(Components.interfaces.nsIPromptService);
						var window = Components.classes["@mozilla.org/appshell/window-mediator;1"]
							.getService(Components.interfaces.nsIWindowMediator)
							.getMostRecentWindow("navigator:browser");
						
						if(!lastRecognizedURI || !channel.originalURI || !channel.originalURI.equals(lastRecognizedURI)) {
							lastButton = ps.confirmEx(window,
								Zotero.getString("proxies.recognized"),
								Zotero.getString("proxies.recognized.message"),
								((proxies.length ? 0 : ps.BUTTON_DELAY_ENABLE) + ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK +
								 ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL + ps.BUTTON_POS_1_DEFAULT),
								null, null, null, Zotero.getString("proxies.recognized.disable"), checkState);
							lastRecognizedURI = channel.originalURI ? channel.originalURI : channel.URI;
						}
						
						if(lastButton == 0) proxy.save();
						if(checkState.value) {
							autoRecognize = false;
							Zotero.Prefs.set("proxies.autoRecognize", false);
						}
						
						break;
					}
				}
			}
			
			// try to get an applicable proxy
			if(transparent) {
				var webNav = null;
				try {
					webNav = channel.notificationCallbacks.QueryInterface(Components.interfaces.nsIWebNavigation);
				} catch(e) {}
				
				if(webNav) {
					var proxied = this.properToProxy(url, true);
					if(proxied) webNav.loadURI(proxied, 0, channel.URI, null, null);
				}
			}
		}
		
		delete channel;
	}
	
	/**
	 * Gets all proxy objects
	 */
	this.get = function() {
		if(!proxies) {
			var rows = Zotero.DB.query("SELECT * FROM proxies");
			proxies = [new Zotero.Proxy(row) for each(row in rows)];
			this.refreshHostMap();
		}
		return proxies;
	}
	
	/**
	 * Removes a proxy object from the list of proxy objects
	 */
	this.remove = function(proxy) {
		var index = proxies.indexOf(proxy);
		if(index == -1) return false;
		proxies.splice(index, 1);
		this.refreshHostMap();
		return true;
	}
	
	/**
	 * Saves a proxy object not previously in the proxy list
	 */
	this.save = function(proxy) {
		proxies.push(proxy);
		for each(var host in proxy.hosts) {
			if(!hosts[host]) {
				hosts[host] = proxy;
			}
		}
		return proxy;
	}
	
	/**
	 * Refreshes host map; necessary when proxies are added, changed, or deleted
	 */
	this.refreshHostMap = function() {
		hosts = {};
		for each(var proxy in proxies) {
			for each(var host in proxy.hosts) {
				if(!hosts[host]) {
					hosts[host] = proxy;
				}
			}
		}
	}
	
	/**
	 * Returns a page's proper url, adjusting for proxying
	 */
	this.proxyToProper = function(url, onlyReturnIfProxied) {
		for each(var proxy in proxies) {
			if(proxy.regexp) {
				var m = proxy.regexp.exec(url);
				if(m) {
					var toProper = proxy.toProper(m);
					Zotero.debug("Zotero.Proxies.proxyToProper: "+url+" to "+toProper);
					return toProper;
				}
			}
		}
		return (onlyReturnIfProxied ? false : url);
	}
	
	/**
	 * Returns a page's proxied url from the proper url
	 */
	this.properToProxy = function(url, onlyReturnIfProxied) {
		var uri = ioService.newURI(url, null, null);
		if(hosts[uri.hostPort]) {
			var toProxy = hosts[uri.hostPort].toProxy(uri);
			Zotero.debug("Zotero.Proxies.properToProxy: "+url+" to "+toProxy);
			return toProxy;
		}
		return (onlyReturnIfProxied ? false : url);
	}
}

/**
 * A class to handle individual proxy servers
 * 
 * @constructor
 */
Zotero.Proxy = function(row) {
	if(row) {
		this._loadFromRow(row);
	} else {
		this.hosts = [];
		this.multiHost = false;
	}
}

const Zotero_Proxy_schemeParameters = {
	"%p":"(.*?)",	// path
	"%d":"(.*?)",	// directory
	"%f":"(.*?)",	// filename
	"%a":"(.*?)"	// filename
};
const Zotero_Proxy_schemeParameterRegexps = {
	"%p":/([^%])%p/,
	"%d":/([^%])%d/,
	"%f":/([^%])%f/,
	"%h":/([^%])%h/,
	"%a":/([^%])%a/
}
/**
 * Compiles the regular expression against which we match URLs for this proxy
 */
Zotero.Proxy.prototype.compileRegexp = function() {
	const metaRe = /[-[\]{}()*+?.\\^$|,#\s]/g;
	
	// take host only if flagged as multiHost
	var parametersToCheck = Zotero_Proxy_schemeParameters;
	if(this.multiHost) parametersToCheck["%h"] = "([a-zA-Z0-9]+\\.[a-zA-Z0-9\.]+)";
	
	var indices = this.indices = {};
	this.parameters = [];
	for(var param in parametersToCheck) {
		var index = this.scheme.indexOf(param);
		
		// avoid escaped matches
		while(this.scheme[index-1] && (this.scheme[index-1] == "%")) {
			this.scheme = this.scheme.substr(0, index-1)+this.scheme.substr(index);
			index = this.scheme.indexOf(param, index+1);
		}
		
		if(index != -1) {
			this.indices[param] = index;
			this.parameters.push(param);
		}
	}
	
	// sort params by index
	this.parameters = this.parameters.sort(function(a, b) {
		return indices[a]-indices[b];
	})
	
	// now replace with regexp fragment in reverse order
	var re = "^"+this.scheme.replace(metaRe, "\\$&")+"$";
	for(var i=this.parameters.length-1; i>=0; i--) {
		var param = this.parameters[i];
		re = re.replace(Zotero_Proxy_schemeParameterRegexps[param], "$1"+parametersToCheck[param]);
	}
	
	this.regexp = new RegExp(re);
}

/**
 * Ensures that the proxy scheme and host settings are valid for this proxy type
 */
Zotero.Proxy.prototype.validate = function() {
	if(this.scheme.length < 8 || (this.scheme.substr(0, 7) != "http://" && this.scheme.substr(0, 8) != "https://")) {
		return "scheme.noHTTP";
	}
	
	if(!this.multiSite && (!this.hosts.length || !this.hosts[0])) {
		return "host.invalid";
	} else if(this.multiSite && !Zotero_Proxy_schemeParameterRegexps["%h"].test(this.scheme)) {
		return "scheme.noHost";
	}
	
	if(!Zotero_Proxy_schemeParameterRegexps["%p"].test(this.scheme) && 
			(!Zotero_Proxy_schemeParameterRegexps["%d"].test(this.scheme) ||
			!Zotero_Proxy_schemeParameterRegexps["%f"].test(this.scheme))) {
		return "scheme.noPath";
	}
	
	return false;
}

/**
 * Saves any changes to this proxy
 */
Zotero.Proxy.prototype.save = function() {
	// ensure this proxy is valid
	Zotero.debug(this);
	var hasErrors = this.validate();
	if(hasErrors) throw "Proxy could not be saved because it is invalid: error "+hasErrors;
	
	this.autoAssociate = this.multiHost && this.autoAssociate;
	this.compileRegexp();
	if(this.proxyID) {
		Zotero.Proxies.refreshHostMap();
	} else {
		Zotero.Proxies.save(this);
	}
	
	try {
		Zotero.DB.beginTransaction();
		
		if(this.proxyID) {
			Zotero.DB.query("UPDATE proxies SET multiHost = ?, autoAssociate = ?, scheme = ? WHERE proxyID = ?",
				[this.multiHost ? 1 : 0, this.autoAssociate ? 1 : 0, this.scheme, this.proxyID]);
			Zotero.DB.query("DELETE FROM proxyHosts WHERE proxyID = ?", [this.proxyID]);
		} else {
			this.proxyID = Zotero.DB.query("INSERT INTO proxies (multiHost, autoAssociate, scheme) VALUES (?, ?, ?)",
				[this.multiHost ? 1 : 0, this.autoAssociate ? 1 : 0, this.scheme])
		}
		
		this.hosts = this.hosts.sort();
		var host;
		for(var i in this.hosts) {
			host = this.hosts[i] = this.hosts[i].toLowerCase();
			Zotero.DB.query("INSERT INTO proxyHosts (proxyID, hostname) VALUES (?, ?)",
				[this.proxyID, host]);
		}
		
		Zotero.DB.commitTransaction();
	} catch(e) {
		Zotero.DB.rollbackTransaction();
		throw(e);
	}
}

/**
 * Reverts to the previously saved version of this proxy
 */
Zotero.Proxy.prototype.revert = function() {
	if(!this.proxyID) throw "Cannot revert an unsaved proxy";
	this._loadFromRow(Zotero.DB.rowQuery("SELECT * FROM proxies WHERE proxyID = ?", [this.proxyID]));
}

/**
 * Deletes this proxy
 */
Zotero.Proxy.prototype.erase = function() {
	if(!this.proxyID) throw "Tried to erase an unsaved proxy";
	Zotero.Proxies.remove(this);
	
	try {
		Zotero.DB.beginTransaction();
		Zotero.DB.query("DELETE FROM proxyHosts WHERE proxyID = ?", [this.proxyID]);
		Zotero.DB.query("DELETE FROM proxies WHERE proxyID = ?", [this.proxyID]);
		Zotero.DB.commitTransaction();
	} catch(e) {
		Zotero.DB.rollbackTransaction();
		throw(e);
	}
}

/**
 * Converts a proxied URL to an unproxied URL using this proxy
 *
 * @param m {Array} The match from running this proxy's regexp against a URL spec
 */
Zotero.Proxy.prototype.toProper = function(m) {
	if(this.multiHost) {
		var properURL = "http://"+m[this.parameters.indexOf("%h")+1]+"/";
	} else {
		var properURL = "http://"+this.hosts[0]+"/";
	}
	
	if(this.indices["%p"]) {
		properURL += m[this.parameters.indexOf("%p")+1];
	} else {
		var dir = m[this.parameters.indexOf("%d")+1];
		var file = m[this.parameters.indexOf("%f")+1];
		if(dir !== "") properURL += dir+"/";
		properURL += file;
	}
	
	return properURL;
}

/**
 * Converts an unproxied URL to a proxied URL using this proxy
 *
 * @param {nsIURI} uri The nsIURI corresponding to the unproxied URL
 */
Zotero.Proxy.prototype.toProxy = function(uri) {
	proxyURL = this.scheme;
	
	for(var i=this.parameters.length-1; i>=0; i--) {
		var param = this.parameters[i];
		var value = "";
		if(param == "%h") {
			value = uri.hostPort;
		} else if(param == "%p") {
			value = uri.path.substr(1);
		} else if(param == "%d") {
			value = uri.path.substr(0, uri.path.lastIndexOf("/"));
		} else if(param == "%f") {
			value = uri.path.substr(uri.path.lastIndexOf("/")+1)
		}
		
		proxyURL = proxyURL.substr(0, this.indices[param])+value+proxyURL.substr(this.indices[param]+2);
	}
	
	return proxyURL;
}

/**
 * Loads a proxy object from a DB row
 */
Zotero.Proxy.prototype._loadFromRow = function(row) {
	this.proxyID = row.proxyID;
	this.multiHost = !!row.multiHost;
	this.autoAssociate = !!row.autoAssociate;
	this.scheme = row.scheme;
	this.hosts = Zotero.DB.columnQuery("SELECT hostname FROM proxyHosts WHERE proxyID = ? ORDER BY hostname", row.proxyID);
	this.compileRegexp();
}

Zotero.Proxies.Detectors = new Object();

/**
 * Detector for OCLC EZProxy
 */
Zotero.Proxies.Detectors.EZProxy = function(channel) {
	const ezProxyRe = /\?(?:.+&)?(url|qurl)=([^&]+)/i;
	
	// Try to catch links from one proxy-by-port site to another
	if([80, 443, -1].indexOf(channel.URI.port) == -1) {
		// Two options here: we could have a redirect from an EZProxy site to another, or a link
		// If it's a redirect, we'll have to catch the Location: header
		var toProxy = false;
		var fromProxy = false;
		if([301, 302, 303].indexOf(channel.responseStatus) !== -1) {
			try {
				toProxy = Zotero.Proxies.Detectors.EZProxy.ios.newURI(
					channel.getResponseHeader("Location"), null, null);
				fromProxy = channel.URI;
			} catch(e) {}
		} else {
			toProxy = channel.URI;
			fromProxy = channel.referrer;
		}
		
		if(fromProxy && toProxy && fromProxy.host == toProxy.host && fromProxy.port != toProxy.port
				&& [80, 443, -1].indexOf(toProxy.port) == -1) {
			var proxy;
			for each(proxy in Zotero.Proxies.get()) {
				if(proxy.regexp) {
					var m = proxy.regexp.exec(fromProxy.spec);
					if(m) break;
				}
			}
			if(m) {
				// Make sure caught proxy is not multi-host and that we don't have this new proxy already
				if(proxy.multiHost || Zotero.Proxies.proxyToProper(toProxy.spec, true)) return false;
				
				// Create a new nsIObserver and nsIChannel to figure out real URL (by failing to 
				// send cookies, so we get back to the login page)
				var newChannel = Zotero.Proxies.Detectors.EZProxy.ios.newChannelFromURI(toProxy);
				newChannel.originalURI = channel.originalURI ? channel.originalURI : channel.URI;
				newChannel.QueryInterface(Components.interfaces.nsIRequest).loadFlags = newChannel.loadFlags |
					Components.interfaces.nsIHttpChannel.LOAD_DOCUMENT_URI;
				
				Zotero.Proxies.Detectors.EZProxy.obs.addObserver(
					new Zotero.Proxies.Detectors.EZProxy.Observer(newChannel),
					"http-on-modify-request", false);
				newChannel.asyncOpen(new Zotero.Proxies.Detectors.EZProxy.DummyStreamListener(), null);
				return false;
			}
		}
	}
	
	// Now try to catch redirects
	try {
		if(channel.getResponseHeader("Server") != "EZproxy") return false;
	} catch(e) {
		return false
	}
	
	// Get the new URL
	if(channel.responseStatus != 302) return false;
	var proxiedURL = channel.getResponseHeader("Location");
	if(!proxiedURL) return false;
	var proxiedURI = Zotero.Proxies.Detectors.EZProxy.ios.newURI(proxiedURL, null, null);
	// look for query
	var m = ezProxyRe.exec(channel.URI.spec);
	if(!m) return false;
	
	// Ignore if we already know about it
	if(Zotero.Proxies.proxyToProper(proxiedURI.spec, true)) return false;
	
	// Found URL
	var properURL = (m[1].toLowerCase() == "qurl" ? unescape(m[2]) : m[2]);
	var properURI = Zotero.Proxies.Detectors.EZProxy.ios.newURI(properURL, null, null);
	
	if(channel.URI.host == proxiedURI.host && [channel.URI.port, 80, 443, -1].indexOf(proxiedURI.port) == -1) {
		// Proxy by port
		var proxy = new Zotero.Proxy();
		proxy.multiHost = false;
		proxy.scheme = proxiedURI.scheme+"://"+proxiedURI.hostPort+"/%p";
		proxy.hosts = [properURI.hostPort];
	} else if(proxiedURI.host != channel.URI.host) {
		// Proxy by host
		var proxy = new Zotero.Proxy();
		proxy.multiHost = proxy.autoAssociate = true;
		proxy.scheme = proxiedURI.scheme+"://"+proxiedURI.hostPort.replace(properURI.host, "%h")+"/%p";
		proxy.hosts = [properURI.hostPort];
	}
	return proxy;
}
Zotero.Proxies.Detectors.EZProxy.ios = Components.classes["@mozilla.org/network/io-service;1"]
												 .getService(Components.interfaces.nsIIOService);
Zotero.Proxies.Detectors.EZProxy.obs = Components.classes["@mozilla.org/observer-service;1"]
												 .getService(Components.interfaces.nsIObserverService);

/**
 * Do-nothing stream listener
 */
Zotero.Proxies.Detectors.EZProxy.DummyStreamListener = function() {}
Zotero.Proxies.Detectors.EZProxy.DummyStreamListener.prototype.onDataAvailable = function(request, 
                                                             context, inputStream, offset, count) {}
Zotero.Proxies.Detectors.EZProxy.DummyStreamListener.prototype.onStartRequest = function(request, context) {}
Zotero.Proxies.Detectors.EZProxy.DummyStreamListener.prototype.onStopRequest = function(request, context, status) {}

/**
 * Observer to clear cookies on an HTTP request, then remove itself
 */
Zotero.Proxies.Detectors.EZProxy.Observer = function(newChannel) {
	this.channel = newChannel;
}
Zotero.Proxies.Detectors.EZProxy.Observer.prototype.observe = function(aSubject, aTopic, aData) {
	if (aSubject == this.channel) {
		aSubject.QueryInterface(Components.interfaces.nsIHttpChannel).setRequestHeader("Cookie", "", false);
		Zotero.Proxies.Detectors.EZProxy.obs.removeObserver(this, "http-on-modify-request");
	}
}
Zotero.Proxies.Detectors.EZProxy.Observer.prototype.QueryInterface = function(aIID) {
	if (aIID.equals(Components.interfaces.nsISupports) ||
		aIID.equals(Components.interfaces.nsIObserver)) return this;
	throw Components.results.NS_NOINTERFACE;
}

/**
 * Detector for Juniper Networks WebVPN
 */
Zotero.Proxies.Detectors.Juniper = function(channel) {
	const juniperRe = /^(https?:\/\/[^\/:]+(?:\:[0-9]+)?)\/(.*),DanaInfo=([^+,]*)([^+]*)(?:\+(.*))?$/;
	try {
		var url = channel.URI.spec;
		var m = juniperRe.exec(url);
	} catch(e) {
		return false;
	}
	if(!m) return false;
	
	var proxy = new Zotero.Proxy();
	proxy.multiHost =  proxy.autoAssociate = true;
	proxy.scheme = m[1]+"/%d"+",DanaInfo=%h%a+%f";
	proxy.hosts = [m[3]];
	return proxy;
}