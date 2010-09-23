/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
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
		if (Zotero.Utilities.HTTP.browserIsOffline()) {
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
	 * @param	{String}	postData	application/x-www-form-urlencoded data, as sent in a POST request
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
		this._requestFinished(this._processEndpoint(method[3]));
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
 * checks to see if Content-Length bytes of body have been read and, if they
 * have, processes the body
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
		this._processEndpoint(this.body);
	}
}

/**
 * Generates a response based on calling the function associated with the endpoint
 */
Zotero.Connector.DataListener.prototype._processEndpoint = function(postData) {
	try {
		var endpoint = new this.endpoint;
		var me = this;
		endpoint.return = function(code, contentType, arg) {
			me._requestFinished(Zotero.Connector.generateResponse(code, contentType, arg));
		}
		endpoint.init(postData ? postData : undefined);
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

Zotero.Connector.Data = {};

Zotero.Connector.Translate = function() {};
Zotero.Connector.Translate._waitingForSelection = {};
Zotero.Connector.Translate.constructTranslateInstance = function(postData, browser, translate) {
	Zotero.Connector.Data[postData["uri"]] = "<html>"+postData["html"]+"</html>";
	
	var ioService = Components.classes["@mozilla.org/network/io-service;1"]  
							  .getService(Components.interfaces.nsIIOService);  
	var uri = ioService.newURI(postData["uri"], "UTF-8", null); 
	
	var pageShowCalled = false;
	browser.addEventListener("DOMContentLoaded", function() {
		try {
			if(browser.contentDocument.location.href == "about:blank") return;
			if(pageShowCalled) return;
			pageShowCalled = true;
			delete Zotero.Connector.Data[postData["uri"]];
			browser.contentDocument.cookie = postData["cookie"];
			
			// get translators
			translate.setDocument(browser.contentDocument);
			translate.getTranslators();
		} catch(e) {
			Zotero.debug(e);
			throw e;
		}
	}, false);
	
	browser.loadURI("zotero://connector/"+encodeURIComponent(postData["uri"]));
}

/**
 * Lists all available translators, including code for translators that should be run on every page
 */
Zotero.Connector.Translate.List = function() {};
Zotero.Connector.Translate.List.prototype = {
	"init":function(postData) {
		var translators = Zotero.Translators.getAllForType("web");
		var jsons = [];
		for each(var translator in translators) {
			let json = {};
			for each(var key in ["translatorID", "label", "creator", "target", "priority", "detectXPath"]) {
				json[key] = translator[key];
			}
			json["localExecution"] = translator.browserSupport.indexOf(postData["browser"]) !== -1;
			
			// Do not pass targetless translators that do not support this browser (since that
			// would mean passing each page back to Zotero)
			if(json["target"] || json["detectXPath"] || json["localExecution"]) {
				jsons.push(json);
			}
		}
		
		this.return(200, "application/json", JSON.stringify(jsons));
	}
}

/**
 * Checks whether there is a translator available to handle the current page
 */
Zotero.Connector.Translate.Detect = function() {};
Zotero.Connector.Translate.Detect.prototype = {
	"init":function(postData) {
		var postData = JSON.parse(postData);
		
		// get data into a browser
		var translate = new Zotero.Translate("web");
		var me = this;
		translate.setHandler("translators", function(obj, item) { me._translatorsAvailable(obj, item) });

		this._browser = Zotero.Browser.createHiddenBrowser();
		Zotero.Connector.Translate.constructTranslateInstance(postData, this._browser, translate);
		
	},
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
		this.return(200, "application/json", JSON.stringify(jsons));
		
		Zotero.Browser.deleteHiddenBrowser(this._browser);
	}
}

/**
 * Perform translation
 */
Zotero.Connector.Translate.Save = function() {};
Zotero.Connector.Translate.Save.prototype = {
	"init":function(postData) {
		var postData = JSON.parse(postData);
		
		// get data into a browser
		this._uri = postData.url;
		this._browser = Zotero.Browser.createHiddenBrowser();
		var translate = new Zotero.Translate("web");
		var me = this;
		
		var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						.getService(Components.interfaces.nsIWindowMediator)
						.getMostRecentWindow("navigator:browser");
		
		var progressWindow = win.Zotero_Browser.progress;
		if(Zotero.locked) {
			progressWindow.changeHeadline(Zotero.getString("ingester.scrapeError"));
			var desc = Zotero.localeJoin([
				Zotero.getString('general.operationInProgress'), Zotero.getString('general.operationInProgress.waitUntilFinishedAndTryAgain')
			]);
			progressWindow.addDescription(desc);
			progressWindow.show();
			progressWindow.startCloseTimer(8000);
			return;
		}
		
		progressWindow.show();
		this._libraryID = null;
		var collection = null;
		try {
			this._libraryID = win.ZoteroPane.getSelectedLibraryID();
			collection = win.ZoteroPane.getSelectedCollection();
		} catch(e) {}
		translate.setHandler("select", function(obj, item) { return me._selectItems(obj, item, progressWindow) });
		translate.setHandler("itemDone", function(obj, item) { win.Zotero_Browser.itemDone(obj, item, collection) });
		translate.setHandler("done", function(obj, item) { win.Zotero_Browser.finishScraping(obj, item, collection); me.return(201); })
		translate.setHandler("translators", function(obj, item) { me._translatorsAvailable(obj, item, postData.translatorID) });
		
		Zotero.Connector.Translate.constructTranslateInstance(postData, this._browser, translate);
	},
	"_selectItems":function(translate, itemList, progressWindow) {
		var instanceID = Zotero.randomString();
		Zotero.Connector.Translate._waitingForSelection[instanceID] = this;
		
		// Send "Multiple Choices" HTTP response
		this.return(300, "application/json", JSON.stringify({"items":itemList, "instanceID":instanceID, "uri":this._uri}));
		
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
		if(!this.selectedItems) progressWindow.close();
		return this.selectedItems;
	},
	"_translatorsAvailable":function(translate, translators, translatorID) {
		if(translators.length) {
			translate.setTranslator(translatorID);
			translate.translate(this._libraryID);
		} else {
			Zotero.Browser.deleteHiddenBrowser(this._browser);
			this.return(500);
		}
	}
}

/**
 * Handle item selection
 */
Zotero.Connector.Translate.Select = function() {};
Zotero.Connector.Translate.Select.prototype = {
	"init":function(postData) {
		Zotero.debug(postData);
		var postData = JSON.parse(postData);
		var saveInstance = Zotero.Connector.Translate._waitingForSelection[postData.instanceID];
		saveInstance.return = this.return;
		
		saveInstance.selectedItems = false;
		for(var i in postData.items) {
			saveInstance.selectedItems = postData.items;
			break;
		}
	}
}

/**
 * Endpoints for the Connector HTTP server
 */
Zotero.Connector.Endpoints = {
	"/translate/list":Zotero.Connector.Translate.List,
	"/translate/detect":Zotero.Connector.Translate.Detect,
	"/translate/save":Zotero.Connector.Translate.Save,
	"/translate/select":Zotero.Connector.Translate.Select
}