/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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
	var _onlineObserverRegistered;
	var responseCodes = {
		200:"OK",
		201:"Created",
		300:"Multiple Choices",
		400:"Bad Request",
		404:"Not Found",
		500:"Internal Server Error",
		501:"Method Not Implemented"
	};
	
	/**
	 * initializes a very rudimentary web server
	 */
	this.init = function() {
		if (Zotero.HTTP.browserIsOffline()) {
			Zotero.debug('Browser is offline -- not initializing connector HTTP server');
			_registerOnlineObserver();
			return;
		}
		
		// start listening on socket
		var serv = Components.classes["@mozilla.org/network/server-socket;1"]
					.createInstance(Components.interfaces.nsIServerSocket);
		try {
			// bind to a random port on loopback only
			serv.init(Zotero.Prefs.get('connector.port'), true, -1);
			serv.asyncListen(Zotero.Connector.SocketListener);
			
			Zotero.debug("Connector HTTP server listening on 127.0.0.1:"+serv.port);
		} catch(e) {
			Zotero.debug("Not initializing connector HTTP server");
		}
		
		_registerOnlineObserver()
	}
	
	/**
	 * generates the response to an HTTP request
	 */
	this.generateResponse = function (status, contentType, body) {
		var response = "HTTP/1.0 "+status+" "+responseCodes[status]+"\r\n";
		response += "Access-Control-Allow-Origin: org.zotero.zoteroconnectorforsafari-69x6c999f9\r\n";
		response += "Access-Control-Allow-Methods: POST, GET, OPTIONS, HEAD\r\n";
		
		if(body) {
			if(contentType) {
				response += "Content-Type: "+contentType+"\r\n";
			}
			response += "\r\n"+body;
		} else {
			response += "Content-Length: 0\r\n\r\n"
		}
		
		return response;
	}
	
	/**
	 * Decodes application/x-www-form-urlencoded data
	 *
	 * @param	{String}	postData	application/x-www-form-urlencoded data, as sent in a g request
	 * @return	{Object}	data in object form
	 */
	this.decodeURLEncodedData = function(postData) {
		var splitData = postData.split("&");
		var variables = {};
		for each(var variable in splitData) {
			var splitIndex = variable.indexOf("=");
			variables[decodeURIComponent(variable.substr(0, splitIndex))] = decodeURIComponent(variable.substr(splitIndex+1));
		}
		return variables;
	}
	
	function _registerOnlineObserver() {
		if (_onlineObserverRegistered) {
			return;
		}
		
		// Observer to enable the integration when we go online
		var observer = {
			observe: function(subject, topic, data) {
				if (data == 'online') {
					Zotero.Connector.init();
				}
			}
		};
		
		var observerService =
			Components.classes["@mozilla.org/observer-service;1"]
				.getService(Components.interfaces.nsIObserverService);
		observerService.addObserver(observer, "network:offline-status-changed", false);
		
		_onlineObserverRegistered = true;
	}
}

Zotero.Connector.SocketListener = new function() {
	this.onSocketAccepted = onSocketAccepted;
	this.onStopListening = onStopListening;
	
	/*
	 * called when a socket is opened
	 */
	function onSocketAccepted(socket, transport) {
		// get an input stream
		var iStream = transport.openInputStream(0, 0, 0);
		var oStream = transport.openOutputStream(Components.interfaces.nsITransport.OPEN_BLOCKING, 0, 0);
		
		var dataListener = new Zotero.Connector.DataListener(iStream, oStream);
		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"]
							 .createInstance(Components.interfaces.nsIInputStreamPump);
		pump.init(iStream, -1, -1, 0, 0, false);
		pump.asyncRead(dataListener, null);
	}
	
	function onStopListening(serverSocket, status) {
		Zotero.debug("Connector HTTP server going offline");
	}
}

/*
 * handles the actual acquisition of data
 */
Zotero.Connector.DataListener = function(iStream, oStream) {
	this.header = "";
	this.headerFinished = false;
	
	this.body = "";
	this.bodyLength = 0;
	
	this.iStream = iStream;
	this.oStream = oStream;
	this.sStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
	                         .createInstance(Components.interfaces.nsIScriptableInputStream);
	this.sStream.init(iStream);
	
	this.foundReturn = false;
}

/*
 * called when a request begins (although the request should have begun before
 * the DataListener was generated)
 */
Zotero.Connector.DataListener.prototype.onStartRequest = function(request, context) {}

/*
 * called when a request stops
 */
Zotero.Connector.DataListener.prototype.onStopRequest = function(request, context, status) {
	this.iStream.close();
	this.oStream.close();
}

/*
 * called when new data is available
 */
Zotero.Connector.DataListener.prototype.onDataAvailable = function(request, context,
                                                             inputStream, offset, count) {
	var readData = this.sStream.read(count);
	
	if(this.headerFinished) {	// reading body
		this.body += readData;
		// check to see if data is done
		this._bodyData();
	} else {					// reading header
		// see if there's a magic double return
		var lineBreakIndex = readData.indexOf("\r\n\r\n");
		if(lineBreakIndex != -1) {
			if(lineBreakIndex != 0) {
				this.header += readData.substr(0, lineBreakIndex+4);
				this.body = readData.substr(lineBreakIndex+4);
			}
			
			this._headerFinished();
			return;
		}
		var lineBreakIndex = readData.indexOf("\n\n");
		if(lineBreakIndex != -1) {
			if(lineBreakIndex != 0) {
				this.header += readData.substr(0, lineBreakIndex+2);
				this.body = readData.substr(lineBreakIndex+2);
			}
			
			this._headerFinished();
			return;
		}
		if(this.header && this.header[this.header.length-1] == "\n" &&
		   (readData[0] == "\n" || readData[0] == "\r")) {
			if(readData.length > 1 && readData[1] == "\n") {
				this.header += readData.substr(0, 2);
				this.body = readData.substr(2);
			} else {
				this.header += readData[0];
				this.body = readData.substr(1);
			}
			
			this._headerFinished();
			return;
		}
		this.header += readData;
	}
}

/*
 * processes an HTTP header and decides what to do
 */
Zotero.Connector.DataListener.prototype._headerFinished = function() {
	this.headerFinished = true;
	
	Zotero.debug(this.header);
	
	const methodRe = /^([A-Z]+) ([^ \r\n?]+)(\?[^ \r\n]+)?/;
	
	// get first line of request (all we care about for now)
	var method = methodRe.exec(this.header);
	
	if(!method) {
		this._requestFinished(Zotero.Connector.generateResponse(400));
		return;
	}
	if(!Zotero.Connector.Endpoints[method[2]]) {
		this._requestFinished(Zotero.Connector.generateResponse(404));
		return;
	}
	this.endpoint = Zotero.Connector.Endpoints[method[2]];
	
	if(method[1] == "HEAD" || method[1] == "OPTIONS") {
		this._requestFinished(Zotero.Connector.generateResponse(200));
	} else if(method[1] == "GET") {
		this._requestFinished(this._processEndpoint("GET", method[3]));
	} else if(method[1] == "POST") {
		const contentLengthRe = /[\r\n]Content-Length: *([0-9]+)/i;
		
		// parse content length
		var m = contentLengthRe.exec(this.header);
		if(!m) {
			this._requestFinished(Zotero.Connector.generateResponse(400));
			return;
		}
		
		this.bodyLength = parseInt(m[1]);
		this._bodyData();
	} else {
		this._requestFinished(Zotero.Connector.generateResponse(501));
		return;
	}
}

/*
 * checks to see if Content-Length bytes of body have been read and, if so, processes the body
 */
Zotero.Connector.DataListener.prototype._bodyData = function() {
	if(this.body.length >= this.bodyLength) {
		// convert to UTF-8
		var dataStream = Components.classes["@mozilla.org/io/string-input-stream;1"]
		                           .createInstance(Components.interfaces.nsIStringInputStream);
		dataStream.setData(this.body, this.bodyLength);
		
		var utf8Stream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
		                           .createInstance(Components.interfaces.nsIConverterInputStream);
		utf8Stream.init(dataStream, "UTF-8", 4096, "?");
		
		this.body = "";
		var string = {};
		while(utf8Stream.readString(this.bodyLength, string)) {
			this.body += string.value;
		}		
		
		// handle envelope
		this._processEndpoint("POST", this.body);
	}
}

/**
 * Generates a response based on calling the function associated with the endpoint
 */
Zotero.Connector.DataListener.prototype._processEndpoint = function(method, postData) {
	try {
		var endpoint = new this.endpoint;
		var me = this;
		var sendResponseCallback = function(code, contentType, arg) {
			me._requestFinished(Zotero.Connector.generateResponse(code, contentType, arg));
		}
		endpoint.init(method, postData ? postData : undefined, sendResponseCallback);
	} catch(e) {
		Zotero.debug(e);
		this._requestFinished(Zotero.Connector.generateResponse(500));
		throw e;
	}
}

/*
 * returns HTTP data from a request
 */
Zotero.Connector.DataListener.prototype._requestFinished = function(response) {
	// close input stream
	this.iStream.close();
	
	// open UTF-8 converter for output stream	
	var intlStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
							   .createInstance(Components.interfaces.nsIConverterOutputStream);
	
	// write
	try {
		intlStream.init(this.oStream, "UTF-8", 1024, "?".charCodeAt(0));
		
		// write response
		Zotero.debug(response);
		intlStream.writeString(response);
	} finally {	
		intlStream.close();
	}
}

/**
 * Manage cookies in a sandboxed fashion
 *
 * @param {browser} browser Hidden browser object
 * @param {String} uri URI of page to manage cookies for (cookies for domains that are not 
 *                     subdomains of this URI are ignored)
 * @param {String} cookieData Cookies with which to initiate the sandbox
 */
Zotero.Connector.CookieManager = function(browser, uri, cookieData) {
	this._webNav = browser.webNavigation;
	this._browser = browser;
	this._watchedBrowsers = [browser];
	this._observerService = Components.classes["@mozilla.org/observer-service;1"].
		getService(Components.interfaces.nsIObserverService);
	
	this._uri = Components.classes["@mozilla.org/network/io-service;1"]
		.getService(Components.interfaces.nsIIOService)
		.newURI(uri, null, null);
	
	var splitCookies = cookieData.split(/; ?/);
	this._cookies = {};
	for each(var cookie in splitCookies) {
		var key = cookie.substr(0, cookie.indexOf("="));
		var value = cookie.substr(cookie.indexOf("=")+1);
		this._cookies[key] = value;
	}
	
	[this._observerService.addObserver(this, topic, false) for each(topic in this._observerTopics)];
}

Zotero.Connector.CookieManager.prototype = {
	"_observerTopics":["http-on-examine-response", "http-on-modify-request", "quit-application"],
	"_watchedXHRs":[],
	
	/**
	 * nsIObserver implementation for adding, clearing, and slurping cookies
	 */
	"observe": function(channel, topic) {
		if(topic == "quit-application") {
			Zotero.debug("WARNING: A Zotero.Connector.CookieManager for "+this._uri.spec+" was still open on shutdown");
		} else {
			channel.QueryInterface(Components.interfaces.nsIHttpChannel);
			var isTracked = null;
			try {
				var topDoc = channel.notificationCallbacks.getInterface(Components.interfaces.nsIDOMWindow).top.document;
				for each(var browser in this._watchedBrowsers) {
					isTracked = topDoc == browser.contentDocument;
					if(isTracked) break;
				}
			} catch(e) {}
			if(isTracked === null) {
				try {
					isTracked = channel.loadGroup.notificationCallbacks.getInterface(Components.interfaces.nsIDOMWindow).top.document == this._browser.contentDocument;
				} catch(e) {}
			}
			if(isTracked === null) {
				try {
					isTracked = this._watchedXHRs.indexOf(channel.notificationCallbacks.QueryInterface(Components.interfaces.nsIXMLHttpRequest)) !== -1;
				} catch(e) {}
			}
			
			// isTracked is now either true, false, or null
			// true => we should manage cookies for this request
			// false => we should not manage cookies for this request
			// null => this request is of a type we couldn't match to this request. one such type
			//         is a link prefetch (nsPrefetchNode) but there might be others as well. for
			//         now, we are paranoid and reject these.
			
			if(isTracked === false) {
				Zotero.debug("Zotero.Connector.CookieManager: not touching channel for "+channel.URI.spec);
				return;
			} else if(isTracked) {
				Zotero.debug("Zotero.Connector.CookieManager: managing cookies for "+channel.URI.spec);
			} else {
				Zotero.debug("Zotero.Connector.CookieManager: being paranoid about channel for "+channel.URI.spec);
			}
			
			if(topic == "http-on-modify-request") {
				// clear cookies to be sent to other domains
				if(isTracked === null || channel.URI.host != this._uri.host) {
					channel.setRequestHeader("Cookie", "", false);
					channel.setRequestHeader("Cookie2", "", false);
					Zotero.debug("Zotero.Connector.CookieManager: cleared cookies to be sent to "+channel.URI.spec);
					return;
				}
				
				// add cookies to be sent to this domain
				var cookies = [key+"="+this._cookies[key]
						for(key in this._cookies)].join("; ");
				channel.setRequestHeader("Cookie", cookies, false);
				Zotero.debug("Zotero.Connector.CookieManager: added cookies for request to "+channel.URI.spec);
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
				if(isTracked === null || channel.URI.host != this._uri.host) {
					Zotero.debug("Zotero.Connector.CookieManager: rejected cookies from "+channel.URI.spec);
					return;
				}
				
				// put new cookies into our sandbox
				if(cookieHeader) {
					var cookies = cookieHeader.split(/; ?/);
					var newCookies = {};
					for each(var cookie in cookies) {
						var key = cookie.substr(0, cookie.indexOf("="));
						var value = cookie.substr(cookie.indexOf("=")+1);
						var lcCookie = key.toLowerCase();
						
						if(["comment", "domain", "max-age", "path", "version", "expires"].indexOf(lcCookie) != -1) {
							// ignore cookie parameters; we are only holding cookies for a few minutes
							// with a single domain, and the path attribute doesn't allow any additional
							// security anyway
							continue;
						} else if(lcCookie == "secure") {
							// don't accept secure cookies
							newCookies = {};
							break;
						} else {
							newCookies[key] = value;
						}
					}
					[this._cookies[key] = newCookies[key] for(key in newCookies)];
				}
				
				Zotero.debug("Zotero.Connector.CookieManager: slurped cookies from "+channel.URI.spec);
			}
		}
	},
	
	/**
	 * Attach CookieManager to a specific XMLHttpRequest
	 * @param {XMLHttpRequest} xhr
	 */
	"attachToBrowser": function(browser) {
		this._watchedBrowsers.push(browser);
	},
	
	/**
	 * Attach CookieManager to a specific XMLHttpRequest
	 * @param {XMLHttpRequest} xhr
	 */
	"attachToXHR": function(xhr) {
		this._watchedXHRs.push(xhr);
	},
	
	/**
	 * Destroys this CookieManager (intended to be executed when the browser is destroyed)
	 */
	"destroy": function() {
		[this._observerService.removeObserver(this, topic) for each(topic in this._observerTopics)];
	}
}

Zotero.Connector.Data = {};

Zotero.Connector.Translate = function() {};
Zotero.Connector.Translate._waitingForSelection = {};


/**
 * Lists all available translators, including code for translators that should be run on every page
 */
Zotero.Connector.Translate.List = function() {};

Zotero.Connector.Translate.List.prototype = {
	/**
	 * Gets available translator list
	 * @param {String} method "GET" or "POST"
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(method, data, sendResponseCallback) {
		if(method != "POST") {
			sendResponseCallback(400);
			return;
		}
		
		var translators = Zotero.Translators.getAllForType("web");
		var jsons = [];
		for each(var translator in translators) {
			let json = {};
			for each(var key in ["translatorID", "label", "creator", "target", "priority", "detectXPath"]) {
				json[key] = translator[key];
			}
			json["localExecution"] = translator.browserSupport.indexOf(data["browser"]) !== -1;
			
			// Do not pass targetless translators that do not support this browser (since that
			// would mean passing each page back to Zotero)
			if(json["target"] || json["detectXPath"] || json["localExecution"]) {
				jsons.push(json);
			}
		}
		
		sendResponseCallback(200, "application/json", JSON.stringify(jsons));
	}
}

/**
 * Detects whether there is an available translator to handle a given page
 */
Zotero.Connector.Translate.Detect = function() {};

Zotero.Connector.Translate.Detect.prototype = {
	/**
	 * Loads HTML into a hidden browser and initiates translator detection
	 * @param {String} method "GET" or "POST"
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(method, data, sendResponseCallback) {
		if(method != "POST") {
			sendResponseCallback(400);
			return;
		}
		
		this.sendResponse = sendResponseCallback;
		this._parsedPostData = JSON.parse(data);
		
		this._translate = new Zotero.Translate("web");
		this._translate.setHandler("translators", function(obj, item) { me._translatorsAvailable(obj, item) });
		
		Zotero.Connector.Data[this._parsedPostData["uri"]] = "<html>"+this._parsedPostData["html"]+"</html>";
		this._browser = Zotero.Browser.createHiddenBrowser();
		
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]  
								  .getService(Components.interfaces.nsIIOService);  
		var uri = ioService.newURI(this._parsedPostData["uri"], "UTF-8", null); 
		
		var pageShowCalled = false;
		var me = this;
		this._translate.setCookieManager(new Zotero.Connector.CookieManager(this._browser,
			this._parsedPostData["uri"], this._parsedPostData["cookie"]));
		this._browser.addEventListener("DOMContentLoaded", function() {
			try {
				if(me._browser.contentDocument.location.href == "about:blank") return;
				if(pageShowCalled) return;
				pageShowCalled = true;
				delete Zotero.Connector.Data[me._parsedPostData["uri"]];
				
				// get translators
				me._translate.setDocument(me._browser.contentDocument);
				me._translate.getTranslators();
			} catch(e) {
				Zotero.debug(e);
				throw e;
			}
		}, false);
		
		me._browser.loadURI("zotero://connector/"+encodeURIComponent(this._parsedPostData["uri"]));
	},

	/**
	 * Callback to be executed when list of translators becomes available. Sends response with
	 * item types, translator IDs, labels, and icons for available translators.
	 * @param {Zotero.Translate} translate
	 * @param {Zotero.Translator[]} translators
	 */
	"_translatorsAvailable":function(obj, translators) {
		var jsons = [];
		for each(var translator in translators) {
			if(translator.itemType == "multiple") {
				var icon = "treesource-collection.png"
			} else {
				var icon = Zotero.ItemTypes.getImageSrc(translator.itemType);
				icon = icon.substr(icon.lastIndexOf("/")+1);
			}
			var json = {"itemType":translator.itemType, "translatorID":translator.translatorID,
				"label":translator.label, "icon":icon}
			jsons.push(json);
		}
		this.sendResponse(200, "application/json", JSON.stringify(jsons));
		
		this._translate.cookieManager.destroy();
		Zotero.Browser.deleteHiddenBrowser(this._browser);
	}
}

/**
 * Performs translation of a given page
 */
Zotero.Connector.Translate.Save = function() {};
Zotero.Connector.Translate.Save.prototype = {
	/**
	 * Init method inherited from Zotero.Connector.Translate.Detect
	 * @borrows Zotero.Connector.Translate.Detect as this.init
	 */
	"init":Zotero.Connector.Translate.Detect.prototype.init,

	/**
	 * Callback to be executed when items must be selected
	 * @param {Zotero.Translate} translate
	 * @param {Object} itemList ID=>text pairs representing available items
	 */
	"_selectItems":function(translate, itemList) {
		var instanceID = Zotero.randomString();
		Zotero.Connector.Translate._waitingForSelection[instanceID] = this;
		
		// Fix for translators that don't create item lists as objects
		if(itemList.push && typeof itemList.push === "function") {
			var newItemList = {};
			for(var item in itemList) {
				Zotero.debug(item);
				newItemList[item] = itemList[item];
			}
			itemList = newItemList;
		}
		
		// Send "Multiple Choices" HTTP response
		this.sendResponse(300, "application/json", JSON.stringify({"items":itemList, "instanceID":instanceID, "uri":this._parsedPostData.uri}));
		
		// We need this to make sure that we won't stop Firefox from quitting, even if the user
		// didn't close the selectItems window
		var observerService = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
		var me = this;
		var quitObserver = {observe:function() { me.selectedItems = false; }};
		observerService.addObserver(quitObserver, "quit-application", false);
		
		this.selectedItems = null;
		var endTime = Date.now() + 60*60*1000;	// after an hour, timeout, so that we don't
												// permanently slow Firefox with this loop
		while(this.selectedItems === null && Date.now() < endTime) {
			Zotero.mainThread.processNextEvent(true);
		}
		
		observerService.removeObserver(quitObserver, "quit-application");
		if(!this.selectedItems) this._progressWindow.close();
		return this.selectedItems;
	},

	/**
	 * Callback to be executed when list of translators becomes available. Opens progress window,
	 * selects specified translator, and initiates translation.
	 * @param {Zotero.Translate} translate
	 * @param {Zotero.Translator[]} translators
	 */
	"_translatorsAvailable":function(translate, translators) {
		// make sure translatorsAvailable succeded
		if(!translators.length) {
			Zotero.Browser.deleteHiddenBrowser(this._browser);
			this.sendResponse(500);
			return;
		}
		
		// set up progress window
		var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						.getService(Components.interfaces.nsIWindowMediator)
						.getMostRecentWindow("navigator:browser");
		
		this._progressWindow = win.Zotero_Browser.progress;
		if(Zotero.locked) {
			this._progressWindow.changeHeadline(Zotero.getString("ingester.scrapeError"));
			var desc = Zotero.localeJoin([
				Zotero.getString('general.operationInProgress'), Zotero.getString('general.operationInProgress.waitUntilFinishedAndTryAgain')
			]);
			this._progressWindow.addDescription(desc);
			this._progressWindow.show();
			this._progressWindow.startCloseTimer(8000);
			return;
		}
		
		this._progressWindow.show();
		
		// set save callbacks
		this._libraryID = null;
		var collection = null;
		try {
			this._libraryID = win.ZoteroPane.getSelectedLibraryID();
			collection = win.ZoteroPane.getSelectedCollection();
		} catch(e) {}
		var me = this;
		translate.setHandler("select", function(obj, item) { return me._selectItems(obj, item) });
		translate.setHandler("itemDone", function(obj, item) { win.Zotero_Browser.itemDone(obj, item, collection) });
		translate.setHandler("done", function(obj, item) {
			win.Zotero_Browser.finishScraping(obj, item, collection);			
			me._translate.cookieManager.destroy();
			Zotero.Browser.deleteHiddenBrowser(me._browser);
			me.sendResponse(201);
		});
		
		// set translator and translate
		translate.setTranslator(this._parsedPostData.translatorID);
		translate.translate(this._libraryID);
	}
}

/**
 * Handle item selection
 */
Zotero.Connector.Translate.Select = function() {};
Zotero.Connector.Translate.Select.prototype = {
	/**
	 * Finishes up translation when item selection is complete
	 * @param {String} method "GET" or "POST"
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(method, postData, sendResponseCallback) {
		if(method != "POST") {
			sendResponseCallback(400);
			return;
		}
		
		var postData = JSON.parse(postData);
		var saveInstance = Zotero.Connector.Translate._waitingForSelection[postData.instanceID];
		saveInstance.sendResponse = sendResponseCallback;
		
		saveInstance.selectedItems = false;
		for(var i in postData.items) {
			saveInstance.selectedItems = postData.items;
			break;
		}
	}
}

/**
 * Endpoints for the Connector HTTP server
 *
 * Each endpoint should take the form of an object. The init() method of this object will be passed:
 *     method - the method of the request ("GET" or "POST")
 *     data - the query string (for a "GET" request) or POST data (for a "POST" request)
 *     sendResponseCallback - a function to send a response to the HTTP request. This can be passed
 *                            a response code alone (e.g., sendResponseCallback(404)) or a response
 *                            code, MIME type, and response body
 *                            (e.g., sendResponseCallback(200, "text/plain", "Hello World!"))
 */
Zotero.Connector.Endpoints = {
	"/translate/list":Zotero.Connector.Translate.List,
	"/translate/detect":Zotero.Connector.Translate.Detect,
	"/translate/save":Zotero.Connector.Translate.Save,
	"/translate/select":Zotero.Connector.Translate.Select
}