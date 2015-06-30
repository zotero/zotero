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

Zotero.Connector = new function() {
	const CONNECTOR_URI = "http://127.0.0.1:23119/";
	const CONNECTOR_API_VERSION = 2;
	
	var _ieStandaloneIframeTarget, _ieConnectorCallbacks;
	// As of Chrome 38 (and corresponding Opera version 24?) pages loaded over
	// https (i.e. the zotero bookmarklet iframe) can not send requests over
	// http, so pinging Standalone at http://127.0.0.1 fails.
	// Disable for all browsers, except IE, which may be used frequently with ZSA
	this.isOnline = Zotero.isBookmarklet && !Zotero.isIE ? false : null;
	
	/**
	 * Checks if Zotero is online and passes current status to callback
	 * @param {Function} callback
	 */
	this.checkIsOnline = function(callback) {
		// Only check once in bookmarklet
		if(Zotero.isBookmarklet && this.isOnline !== null) {
			callback(this.isOnline);
			return;
		}
		
		if(Zotero.isIE) {
			if(window.location.protocol !== "http:") {
				this.isOnline = false;
				callback(false);
				return;
			}
		
			Zotero.debug("Connector: Looking for Zotero Standalone");
			var me = this;
			var fail = function() {
				if(me.isOnline !== null) return;
				Zotero.debug("Connector: Zotero Standalone is not online or cannot be contacted");
				me.isOnline = false;
				callback(false);
			};
			
			window.setTimeout(fail, 1000);
			try {
				var xdr = new XDomainRequest();
				xdr.timeout = 700;
				xdr.open("POST", "http://127.0.0.1:23119/connector/ping", true);
				xdr.onerror = function() {
					Zotero.debug("Connector: XDomainRequest to Zotero Standalone experienced an error");
					fail();
				};
				xdr.ontimeout = function() {
					Zotero.debug("Connector: XDomainRequest to Zotero Standalone timed out");
					fail();
				};
				xdr.onload = function() {
					if(me.isOnline !== null) return;
					me.isOnline = true;
					Zotero.debug("Connector: Standalone found; trying IE hack");
					
					_ieConnectorCallbacks = [];
					var listener = function(event) {
						if(event.origin !== "http://127.0.0.1:23119"
								|| event.source !== iframe.contentWindow) return;
						if(event.stopPropagation) {
							event.stopPropagation();
						} else {
							event.cancelBubble = true;
						}
						
						// If this is the first time the target was loaded, then this is a loaded
						// event
						if(!_ieStandaloneIframeTarget) {
							Zotero.debug("Connector: Standalone loaded");
							_ieStandaloneIframeTarget = iframe.contentWindow;
							callback(true);
							return;
						}
						
						// Otherwise, this is a response event
						try {
							var data = JSON.parse(event.data);
						} catch(e) {
							Zotero.debug("Invalid JSON received: "+event.data);
							return;
						}
						var xhrSurrogate = {
							"status":data[1],
							"responseText":data[2],
							"getResponseHeader":function(x) { return data[3][x.toLowerCase()] }
						};
						_ieConnectorCallbacks[data[0]](xhrSurrogate);
						delete _ieConnectorCallbacks[data[0]];
					};
					
					if(window.addEventListener) {
						window.addEventListener("message", listener, false);
					} else {
						window.attachEvent("onmessage", function() { listener(event); });
					}
					
					var iframe = document.createElement("iframe");
					iframe.src = "http://127.0.0.1:23119/connector/ieHack";
					document.documentElement.appendChild(iframe);
				};
				xdr.send("");
			} catch(e) {
				Zotero.logError(e);
				fail();
			}
		} else {
			Zotero.Connector.callMethod("ping", {}, function(status) {
				callback(status !== false);
			});
		}
	}
	
	/**
	 * Sends the XHR to execute an RPC call.
	 *
	 * @param	{String}		method			RPC method. See documentation above.
	 * @param	{Object}		data			RPC data. See documentation above.
	 * @param	{Function}		callback		Function to be called when requests complete.
	 */
	this.callMethod = function(method, data, callback, tab) {
		// Don't bother trying if not online in bookmarklet
		if(Zotero.isBookmarklet && this.isOnline === false) {
			callback(false, 0);
			return;
		}
		
		var newCallback = function(req) {
			try {
				var isOnline = req.status !== 0 && req.status !== 403 && req.status !== 412;
				
				if(Zotero.Connector.isOnline !== isOnline) {
					Zotero.Connector.isOnline = isOnline;
					if(Zotero.Connector_Browser && Zotero.Connector_Browser.onStateChange) {
						Zotero.Connector_Browser.onStateChange(isOnline);
					}
				}
				
				if(req.status == 0 || req.status >= 400) {
					Zotero.debug("Connector: Method "+method+" failed with status "+req.status);
					if(callback) callback(false, req.status);
					
					// Check for incompatible version
					if(req.status === 412) {
						if(Zotero.Connector_Browser && Zotero.Connector_Browser.onIncompatibleStandaloneVersion) {
							var standaloneVersion = req.getResponseHeader("X-Zotero-Version");
							Zotero.Connector_Browser.onIncompatibleStandaloneVersion(Zotero.version, standaloneVersion);
							throw "Connector: Version mismatch: Connector version "+Zotero.version
								+", Standalone version "+(standaloneVersion ? standaloneVersion : "<unknown>");
						}
					}
				} else {
					Zotero.debug("Connector: Method "+method+" succeeded");
					var val = null;
					if(req.responseText) {
						if(req.getResponseHeader("Content-Type") === "application/json") {
							val = JSON.parse(req.responseText);
						} else {
							val = req.responseText;
						}
					}
					if(callback) callback(val, req.status);
				}
			} catch(e) {
				Zotero.logError(e);
				return;
			}
		};
		
		if(Zotero.isIE) {	// IE requires XDR for CORS
			if(_ieStandaloneIframeTarget) {
				var requestID = Zotero.Utilities.randomString();
				_ieConnectorCallbacks[requestID] = newCallback;
				_ieStandaloneIframeTarget.postMessage(JSON.stringify([null, "connectorRequest",
					[requestID, method, JSON.stringify(data)]]), "http://127.0.0.1:23119/connector/ieHack");
			} else {
				Zotero.debug("Connector: No iframe target; not sending to Standalone");
				callback(false, 0);
			}
		} else {							// Other browsers can use plain doPost
			var uri = CONNECTOR_URI+"connector/"+method;
			Zotero.HTTP.doPost(uri, JSON.stringify(data),
				newCallback, {
					"Content-Type":"application/json",
					"X-Zotero-Version":Zotero.version,
					"X-Zotero-Connector-API-Version":CONNECTOR_API_VERSION
				});
		}
	},
	
	/**
	 * Adds detailed cookies to the data before sending "saveItems" request to
	 *  the server/Standalone
	 *
	 * @param	{Object} data RPC data. See documentation above.
	 * @param	{Function} callback Function to be called when requests complete.
	 */
	this.setCookiesThenSaveItems = function(data, callback, tab) {
		if(Zotero.isFx && !Zotero.isBookmarklet && data.uri) {
			var host = Services.io.newURI(data.uri, null, null).host;
			var cookieEnum = Services.cookies.getCookiesFromHost(host);
			var cookieHeader = '';
			while(cookieEnum.hasMoreElements()) {
				var cookie = cookieEnum.getNext().QueryInterface(Components.interfaces.nsICookie2);
				cookieHeader += '\n' + cookie.name + '=' + cookie.value
					+ ';Domain=' + cookie.host
					+ (cookie.path ? ';Path=' + cookie.path : '')
					+ (!cookie.isDomain ? ';hostOnly' : '') //not a legit flag, but we have to use it internally
					+ (cookie.isSecure ? ';secure' : '');
			}
			
			if(cookieHeader) {
				data.detailedCookies = cookieHeader.substr(1);
			}
			
			this.callMethod("saveItems", data, callback, tab);
			return;
		} else if(Zotero.isChrome && !Zotero.isBookmarklet) {
			var self = this;
			chrome.cookies.getAll({url: tab.url}, function(cookies) {
				var cookieHeader = '';
				for(var i=0, n=cookies.length; i<n; i++) {
					cookieHeader += '\n' + cookies[i].name + '=' + cookies[i].value
						+ ';Domain=' + cookies[i].domain
						+ (cookies[i].path ? ';Path=' + cookies[i].path : '')
						+ (cookies[i].hostOnly ? ';hostOnly' : '') //not a legit flag, but we have to use it internally
						+ (cookies[i].secure ? ';secure' : '');
				}
				
				if(cookieHeader) {
					data.detailedCookies = cookieHeader.substr(1);
				}
				
				self.callMethod("saveItems", data, callback, tab);
			});
			return;
		}
		
		this.callMethod("saveItems", data, callback, tab);
	}
}

Zotero.Connector_Debug = new function() {
	/**
	 * Call a callback depending upon whether debug output is being stored
	 */
	this.storing = function(callback) {
		callback(Zotero.Debug.storing);
	}
	
	/**
	 * Call a callback with the lines themselves
	 */
	this.get = function(callback) {
		callback(Zotero.Debug.get());
	}
		
	/**
	 * Call a callback with the number of lines of output
	 */
	this.count = function(callback) {
		callback(Zotero.Debug.count());
	}
	
	/**
	 * Submit data to the sserver
	 */
	this.submitReport = function(callback) {
		Zotero.HTTP.doPost(ZOTERO_CONFIG.REPOSITORY_URL + "report?debug=1", Zotero.Debug.get(),
			function(xmlhttp) {
				if (!xmlhttp.responseXML) {
					callback(false, 'Invalid response from server');
					return;
				}
				var reported = xmlhttp.responseXML.getElementsByTagName('reported');
				if (reported.length != 1) {
					callback(false, 'The server returned an error. Please try again.');
					return;
				}
				
				var reportID = reported[0].getAttribute('reportID');
				callback(true, reportID);
			}, {"Content-Type":"text/plain"});
	}
}
