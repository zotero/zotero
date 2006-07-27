// Scholar for Firefox Ingester
// Utilities based on code taken from Piggy Bank 2.1.1 (BSD-licensed)
// This code is licensed according to the GPL

Scholar.Ingester = new Object();

/////////////////////////////////////////////////////////////////
//
// Scholar.Ingester.ProxyMonitor
//
/////////////////////////////////////////////////////////////////

// A singleton for recognizing EZProxies and converting URLs such that databases
// will work from outside them. Unfortunately, this only works with the ($495)
// EZProxy software. If there are open source alternatives, we should support
// them too.

/*
 * Precompile proxy regexps
 */
Scholar.Ingester.ProxyMonitor = new function() {
	var _ezProxyRe = new RegExp();
	_ezProxyRe.compile("\\?(?:.+&)?(url|qurl)=([^&]+)", "i");
	/*var _hostRe = new RegExp();
	_hostRe.compile("^https?://(([^/:]+)(?:\:([0-9]+))?)");*/
	var ioService = Components.classes["@mozilla.org/network/io-service;1"]
							  .getService(Components.interfaces.nsIIOService);
	var on = false;
	var _mapFromProxy = null;
	var _mapToProxy = null;
	
	this.init = init;
	this.proxyToProper = proxyToProper;
	this.properToProxy = properToProxy;
	this.observe = observe;
	
	function init() {
		if(!on) {
			var observerService = Components.classes["@mozilla.org/observer-service;1"]
										.getService(Components.interfaces.nsIObserverService);
			observerService.addObserver(this, "http-on-examine-response", false);
		}
		on = true;
	}
	
	function observe(channel) {
		channel.QueryInterface(Components.interfaces.nsIHttpChannel);
		try {
			if(channel.getResponseHeader("Server") == "EZproxy") {
				// We're connected to an EZproxy
				if(channel.responseStatus != "302") {
					return;
				}
				
				Scholar.debug(channel.URI.spec);
				// We should be able to scrape the URL out of this
				var m = _ezProxyRe.exec(channel.URI.spec);
				if(!m) {
					return;
				}
				
				// Found URL
				var variable = m[1];
				var properURL = m[2];
				if(variable.toLowerCase() == "qurl") {
					properURL = unescape(properURL);
				}
				var properURI = _parseURL(properURL);
				if(!properURI) {
					return;
				}
				
				// Get the new URL
				var newURL = channel.getResponseHeader("Location");
				if(!newURL) {
					return;
				}
				var newURI = _parseURL(newURL);
				if(!newURI) {
					return;
				}
				
				if(channel.URI.host == newURI.host && channel.URI.port != newURI.port) {
					// Different ports but the same server means EZproxy active
					
					Scholar.debug("EZProxy: host "+newURI.hostPort+" is really "+properURI.hostPort);
					// Initialize variables here so people who never use EZProxies
					// don't get the (very very minor) speed hit
					if(!_mapFromProxy) {
						_mapFromProxy = new Object();
						_mapToProxy = new Object();
					}
					_mapFromProxy[newURI.hostPort] = properURI.hostPort;
					_mapToProxy[properURI.hostPort] = newURI.hostPort;
				}
			}
		} catch(e) {}
	}
	
	/*
	 * Returns a page's proper url, adjusting for proxying
	 */
	function proxyToProper(url) {
		if(_mapFromProxy) {
			// EZProxy detection is active
			
			var uri = _parseURL(url);
			if(uri && _mapFromProxy[uri.hostPort]) {
				url = url.replace(uri.hostPort, _mapFromProxy[uri.hostPort]);
				Scholar.debug("EZProxy: proper url is "+url);
			}
		}
		
		return url;
	}
	
	/*
	 * Returns a page's proxied url from the proper url
	 */
	function properToProxy(url) {
		if(_mapToProxy) {
			// EZProxy detection is active
			
			var uri = _parseURL(url);
			if(uri && _mapToProxy[uri.hostPort]) {
				// Actually need to map
				url = url.replace(uri.hostPort, _mapToProxy[uri.hostPort]);
				Scholar.debug("EZProxy: proxied url is "+url);
			}
		}
		
		return url;
	}
	
	/*
	 * Parses a url into components (hostPort, port, host, and spec)
	 */
	function _parseURL(url) {
		// create an nsIURI (not sure if this is faster than the regular
		// expression, but it's at least more kosher)
		var uri = ioService.newURI(url, null, null);
		return uri;
	}
}