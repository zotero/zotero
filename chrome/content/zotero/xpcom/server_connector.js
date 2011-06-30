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

const CONNECTOR_SERVER_API_VERSION = 2;

Zotero.Server.Connector = function() {};
Zotero.Server.Connector._waitingForSelection = {};
Zotero.Server.Connector.Data = {};

/**
 * Manage cookies in a sandboxed fashion
 *
 * @param {browser} browser Hidden browser object
 * @param {String} uri URI of page to manage cookies for (cookies for domains that are not 
 *                     subdomains of this URI are ignored)
 * @param {String} cookieData Cookies with which to initiate the sandbox
 */
Zotero.Server.Connector.CookieManager = function(browser, uri, cookieData) {
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

Zotero.Server.Connector.CookieManager.prototype = {
	"_observerTopics":["http-on-examine-response", "http-on-modify-request", "quit-application"],
	"_watchedXHRs":[],
	
	/**
	 * nsIObserver implementation for adding, clearing, and slurping cookies
	 */
	"observe": function(channel, topic) {
		if(topic == "quit-application") {
			Zotero.debug("WARNING: A Zotero.Server.CookieManager for "+this._uri.spec+" was still open on shutdown");
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
				Zotero.debug("Zotero.Server.CookieManager: not touching channel for "+channel.URI.spec);
				return;
			} else if(isTracked) {
				Zotero.debug("Zotero.Server.CookieManager: managing cookies for "+channel.URI.spec);
			} else {
				Zotero.debug("Zotero.Server.CookieManager: being paranoid about channel for "+channel.URI.spec);
			}
			
			if(topic == "http-on-modify-request") {
				// clear cookies to be sent to other domains
				if(isTracked === null || channel.URI.host != this._uri.host) {
					channel.setRequestHeader("Cookie", "", false);
					channel.setRequestHeader("Cookie2", "", false);
					Zotero.debug("Zotero.Server.CookieManager: cleared cookies to be sent to "+channel.URI.spec);
					return;
				}
				
				// add cookies to be sent to this domain
				var cookies = [key+"="+this._cookies[key]
						for(key in this._cookies)].join("; ");
				channel.setRequestHeader("Cookie", cookies, false);
				Zotero.debug("Zotero.Server.CookieManager: added cookies for request to "+channel.URI.spec);
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
					Zotero.debug("Zotero.Server.CookieManager: rejected cookies from "+channel.URI.spec);
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
							// security.
							// DEBUG: does ignoring the path attribute break any sites?
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
				
				Zotero.debug("Zotero.Server.CookieManager: slurped cookies from "+channel.URI.spec);
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


/**
 * Lists all available translators, including code for translators that should be run on every page
 *
 * Accepts:
 *		Nothing
 * Returns:
 *		Array of Zotero.Translator objects
 */
Zotero.Server.Connector.GetTranslators = function() {};
Zotero.Server.Endpoints["/connector/getTranslators"] = Zotero.Server.Connector.GetTranslators;
Zotero.Server.Connector.GetTranslators.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	
	/**
	 * Gets available translator list and other important data
	 * @param {Object} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(data, sendResponseCallback) {
		// Translator data
		var responseData = [];
		
		var translators = Zotero.Translators.getAll();
		for each(var translator in translators) {
			let serializableTranslator = {};
			for each(var key in ["translatorID", "translatorType", "label", "creator", "target",
					"minVersion", "maxVersion", "configOptions", "displayOptions", "priority", 
					"browserSupport", "inRepository", "lastUpdated"]) {
				serializableTranslator[key] = translator[key];
			}
			responseData.push(serializableTranslator);
		}
		
		sendResponseCallback(200, "application/json", JSON.stringify(responseData));
	}
}

/**
 * Detects whether there is an available translator to handle a given page
 *
 * Accepts:
 *		uri - The URI of the page to be saved
 *		html - document.innerHTML or equivalent
 *		cookie - document.cookie or equivalent
 *
 * Returns a list of available translators as an array
 */
Zotero.Server.Connector.Detect = function() {};
Zotero.Server.Endpoints["/connector/detect"] = Zotero.Server.Connector.Detect;
Zotero.Server.Connector.Data = {};
Zotero.Server.Connector.Detect.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	
	/**
	 * Loads HTML into a hidden browser and initiates translator detection
	 * @param {Object} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(data, sendResponseCallback) {
		this._sendResponse = sendResponseCallback;
		this._parsedPostData = data;
		
		this._translate = new Zotero.Translate("web");
		this._translate.setHandler("translators", function(obj, item) { me._translatorsAvailable(obj, item) });
		
		Zotero.Server.Connector.Data[this._parsedPostData["uri"]] = "<html>"+this._parsedPostData["html"]+"</html>";
		this._browser = Zotero.Browser.createHiddenBrowser();
		
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]  
								  .getService(Components.interfaces.nsIIOService);  
		var uri = ioService.newURI(this._parsedPostData["uri"], "UTF-8", null); 
		
		var pageShowCalled = false;
		var me = this;
		this._translate.setCookieManager(new Zotero.Server.Connector.CookieManager(this._browser,
			this._parsedPostData["uri"], this._parsedPostData["cookie"]));
		this._browser.addEventListener("DOMContentLoaded", function() {
			try {
				if(me._browser.contentDocument.location.href == "about:blank") return;
				if(pageShowCalled) return;
				pageShowCalled = true;
				delete Zotero.Server.Connector.Data[me._parsedPostData["uri"]];
				
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
				"label":translator.label, "priority":translator.priority}
			jsons.push(json);
		}
		this._sendResponse(200, "application/json", JSON.stringify(jsons));
		
		this._translate.cookieManager.destroy();
		Zotero.Browser.deleteHiddenBrowser(this._browser);
	}
}

/**
 * Performs translation of a given page
 *
 * Accepts:
 *		uri - The URI of the page to be saved
 *		html - document.innerHTML or equivalent
 *		cookie - document.cookie or equivalent
 *
 * Returns:
 *		If a single item, sends response code 201 with no body.
 *		If multiple items, sends response code 300 with the following content:
 *			items - list of items in the format typically passed to the selectItems handler
 *			instanceID - an ID that must be maintained for the subsequent Zotero.Connector.Select call
 *			uri - the URI of the page for which multiple items are available
 */
Zotero.Server.Connector.SavePage = function() {};
Zotero.Server.Endpoints["/connector/savePage"] = Zotero.Server.Connector.SavePage;
Zotero.Server.Connector.SavePage.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	
	/**
	 * Either loads HTML into a hidden browser and initiates translation, or saves items directly
	 * to the database
	 * @param {Object} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(data, sendResponseCallback) {
		this._sendResponse = sendResponseCallback;
		Zotero.Server.Connector.Detect.prototype.init.apply(this, [data, sendResponseCallback])
	},

	/**
	 * Callback to be executed when items must be selected
	 * @param {Zotero.Translate} translate
	 * @param {Object} itemList ID=>text pairs representing available items
	 */
	"_selectItems":function(translate, itemList, callback) {
		var instanceID = Zotero.randomString();
		Zotero.Server.Connector._waitingForSelection[instanceID] = this;
		
		// Fix for translators that don't create item lists as objects
		if(itemList.push && typeof itemList.push === "function") {
			var newItemList = {};
			for(var item in itemList) {
				newItemList[item] = itemList[item];
			}
			itemList = newItemList;
		}
		
		// Send "Multiple Choices" HTTP response
		this._sendResponse(300, "application/json", JSON.stringify({"selectItems":itemList, "instanceID":instanceID, "uri":this._parsedPostData.uri}));
		
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
		callback(this.selectedItems);
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
			this._sendResponse(500);
			return;
		}
		
		// figure out where to save
		var libraryID = null;
		var collectionID = null;
		var zp = Zotero.getActiveZoteroPane();
		try {
			var libraryID = zp.getSelectedLibraryID();
			var collection = zp.getSelectedCollection();
		} catch(e) {}
		
		// set handlers for translation
		var me = this;
		var jsonItems = [];
		translate.setHandler("select", function(obj, item, callback) { return me._selectItems(obj, item, callback) });
		translate.setHandler("itemDone", function(obj, item, jsonItem) {
			if(collection) {
				collection.addItem(item.id);
			}
			jsonItems.push(jsonItem);
		});
		translate.setHandler("done", function(obj, item) {	
			me._translate.cookieManager.destroy();
			Zotero.Browser.deleteHiddenBrowser(me._browser);
			me._sendResponse(201, "application/json", JSON.stringify({"items":jsonItems}));
		});
		
		// set translator and translate
		translate.setTranslator(this._parsedPostData.translatorID);
		translate.translate(libraryID);
	}
}

/**
 * Performs translation of a given page, or, alternatively, saves items directly
 *
 * Accepts:
 *		items - an array of JSON format items
 * Returns:
 *		201 response code with empty body
 */
Zotero.Server.Connector.SaveItem = function() {};
Zotero.Server.Endpoints["/connector/saveItems"] = Zotero.Server.Connector.SaveItem;
Zotero.Server.Connector.SaveItem.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	
	/**
	 * Either loads HTML into a hidden browser and initiates translation, or saves items directly
	 * to the database
	 * @param {Object} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(data, sendResponseCallback) {
		// figure out where to save
		var libraryID = null;
		var collectionID = null;
		var zp = Zotero.getActiveZoteroPane();
		try {
			var libraryID = zp.getSelectedLibraryID();
			var collection = zp.getSelectedCollection();
		} catch(e) {}
		
		// save items
		var itemSaver = new Zotero.Translate.ItemSaver(libraryID,
			Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD, 1);
		for each(var item in data.items) {
			var savedItem = itemSaver.saveItem(item);
			if(collection) collection.addItem(savedItem.id);
		}
		sendResponseCallback(201);
	}
}

/**
 * Handle item selection
 *
 * Accepts:
 *		selectedItems - a list of items to translate in ID => text format as returned by a selectItems handler
 *		instanceID - as returned by savePage call
 * Returns:
 *		201 response code with empty body
 */
Zotero.Server.Connector.SelectItems = function() {};
Zotero.Server.Endpoints["/connector/selectItems"] = Zotero.Server.Connector.SelectItems;
Zotero.Server.Connector.SelectItems.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	
	/**
	 * Finishes up translation when item selection is complete
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(data, sendResponseCallback) {
		var saveInstance = Zotero.Server.Connector._waitingForSelection[data.instanceID];
		saveInstance._sendResponse = sendResponseCallback;
		
		saveInstance.selectedItems = false;
		for(var i in data.selectedItems) {
			saveInstance.selectedItems = data.selectedItems;
			break;
		}
	}
}

/**
 * Get code for a translator
 *
 * Accepts:
 *		translatorID
 * Returns:
 *		code - translator code
 */
Zotero.Server.Connector.GetTranslatorCode = function() {};
Zotero.Server.Endpoints["/connector/getTranslatorCode"] = Zotero.Server.Connector.GetTranslatorCode;
Zotero.Server.Connector.GetTranslatorCode.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	
	/**
	 * Finishes up translation when item selection is complete
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(postData, sendResponseCallback) {
		var translator = Zotero.Translators.get(postData.translatorID);
		sendResponseCallback(200, "application/javascript", translator.code);
	}
}


/**
 * Test connection
 *
 * Accepts:
 *		Nothing
 * Returns:
 *		Nothing (200 OK response)
 */
Zotero.Server.Connector.Ping = function() {};
Zotero.Server.Endpoints["/connector/ping"] = Zotero.Server.Connector.Ping;
Zotero.Server.Connector.Ping.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	
	/**
	 * Finishes up translation when item selection is complete
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(postData, sendResponseCallback) {
		sendResponseCallback(200);
	}
}