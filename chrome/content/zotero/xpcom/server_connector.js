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
const CONNECTOR_API_VERSION = 2;

Zotero.Server.Connector = function() {};
Zotero.Server.Connector._waitingForSelection = {};
Zotero.Server.Connector.Data = {};

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
		if(data.url) {
			var me = this;
			Zotero.Translators.getWebTranslatorsForLocation(data.url, function(data) {				
				sendResponseCallback(200, "application/json",
						JSON.stringify(me._serializeTranslators(data[0])));
			});
		} else {
			var responseData = this._serializeTranslators(Zotero.Translators.getAll());
			sendResponseCallback(200, "application/json", JSON.stringify(responseData));
		}
	},
	
	"_serializeTranslators":function(translators) {
		var responseData = [];
		for each(var translator in translators) {
			let serializableTranslator = {};
			for each(var key in ["translatorID", "translatorType", "label", "creator", "target",
					"minVersion", "maxVersion", "configOptions", "displayOptions", "priority", 
					"browserSupport", "inRepository", "lastUpdated"]) {
				serializableTranslator[key] = translator[key];
			}
			responseData.push(serializableTranslator);
		}
		return responseData;
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
		this.sendResponse = sendResponseCallback;
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
		this._translate.setCookieSandbox(new Zotero.CookieSandbox(this._browser,
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
				sendResponseCallback(500);
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
		this.sendResponse(200, "application/json", JSON.stringify(jsons));
		
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
		this.sendResponse = sendResponseCallback;
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
		this.sendResponse(300, "application/json", JSON.stringify({"selectItems":itemList, "instanceID":instanceID, "uri":this._parsedPostData.uri}));
		this.selectedItemsCallback = callback;
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
			Zotero.Browser.deleteHiddenBrowser(me._browser);
			if(jsonItems.length || me.selectedItems === false) {
				me.sendResponse(201, "application/json", JSON.stringify({"items":jsonItems}));
			} else {
				me.sendResponse(500);
			}
		});
		
		// set translator and translate
		translate.setTranslator(this._parsedPostData.translatorID);
		translate.translate(libraryID);
	}
}

/**
 * Saves items to DB
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
		
		var cookieSandbox = data["uri"] && data["cookie"] ? new Zotero.CookieSandbox(null, data["uri"],
			data["cookie"]) : null;
		
		// save items
		var itemSaver = new Zotero.Translate.ItemSaver(libraryID,
			Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD, 1, undefined, cookieSandbox);
		itemSaver.saveItems(data.items, function(returnValue, data) {
			if(returnValue) {
				try {
					for each(var item in data) {
						if(collection) collection.addItem(item.id);
					}
					sendResponseCallback(201);
				} catch(e) {
					Zotero.logError(e);
					sendResponseCallback(500);
				}
			} else {
				sendResponseCallback(500);
				throw data;
			}
		});
	}
}

/**
 * Saves a snapshot to the DB
 *
 * Accepts:
 *		uri - The URI of the page to be saved
 *		html - document.innerHTML or equivalent
 *		cookie - document.cookie or equivalent
 * Returns:
 *		Nothing (200 OK response)
 */
Zotero.Server.Connector.SaveSnapshot = function() {};
Zotero.Server.Endpoints["/connector/saveSnapshot"] = Zotero.Server.Connector.SaveSnapshot;
Zotero.Server.Connector.SaveSnapshot.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	
	/**
	 * Save snapshot
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(data, sendResponseCallback) {
		Zotero.Server.Connector.Data[data["url"]] = "<html>"+data["html"]+"</html>";
		var browser = Zotero.Browser.createHiddenBrowser();
		
		var pageShowCalled = false;
		var cookieSandbox = new Zotero.CookieSandbox(browser, data["url"], data["cookie"]);
		browser.addEventListener("pageshow", function() {
			if(browser.contentDocument.location.href == "about:blank"
				|| browser.contentDocument.readyState !== "complete") return;
			if(pageShowCalled) return;
			pageShowCalled = true;
			delete Zotero.Server.Connector.Data[data["url"]];
			
			// figure out where to save
			var libraryID = null;
			var collectionID = null;
			var zp = Zotero.getActiveZoteroPane();
			try {
				var libraryID = zp.getSelectedLibraryID();
				var collection = zp.getSelectedCollection();
			} catch(e) {}
			
			try {
				var doc = browser.contentDocument;
				
				// create new webpage item
				var item = new Zotero.Item("webpage");
				item.libraryID = libraryID;
				item.setField("title", doc.title);
				item.setField("url", data.url);
				item.setField("accessDate", "CURRENT_TIMESTAMP");
				var itemID = item.save();
				if(collection) collection.addItem(itemID);
				
				// determine whether snapshot can be saved
				var filesEditable;
				if (libraryID) {
					var group = Zotero.Groups.getByLibraryID(libraryID);
					filesEditable = group.filesEditable;
				} else {
					filesEditable = true;
				}
				
				// save snapshot
				if(filesEditable) {
					Zotero.Attachments.importFromDocument(doc, itemID);
				}
				
				// remove browser
				Zotero.Browser.deleteHiddenBrowser(browser);
				
				sendResponseCallback(201);
			} catch(e) {
				sendResponseCallback(500);
				throw e;
			}
		}, false);
		
		browser.loadURI("zotero://connector/"+encodeURIComponent(data["url"]));
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
		saveInstance.sendResponse = sendResponseCallback;
		
		var selectedItems = false;
		for(var i in data.selectedItems) {
			selectedItems = data.selectedItems;
			break;
		}
		saveInstance.selectedItemsCallback(selectedItems);
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
	 * Returns a 200 response to say the server is alive
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
	"supportedDataTypes":["application/json", "text/plain"],
	
	/**
	 * Sends nothing
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(postData, sendResponseCallback) {
		sendResponseCallback(200);
	}
}

/**
 * IE messaging hack
 *
 * Accepts:
 *		Nothing
 * Returns:
 *		Static Response
 */
Zotero.Server.Connector.IEHack = function() {};
Zotero.Server.Endpoints["/connector/ieHack"] = Zotero.Server.Connector.IEHack;
Zotero.Server.Connector.IEHack.prototype = {
	"supportedMethods":["GET"],
	
	/**
	 * Sends a fixed webpage
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(postData, sendResponseCallback) {
		sendResponseCallback(200, "text/html",
			'<!DOCTYPE html><html><head>'+
			'<script src="https://www.zotero.org/bookmarklet/ie_compat.js"></script>'+
			'<script src="https://www.zotero.org/bookmarklet/ie_hack.js"></script>'+
			'</head><body></body></html>');
	}
}

// XXX For compatibility with older connectors; to be removed
Zotero.Server.Connector.IncompatibleVersion = function() {};
Zotero.Server.Connector.IncompatibleVersion._errorShown = false
Zotero.Server.Endpoints["/translate/list"] = Zotero.Server.Connector.IncompatibleVersion;
Zotero.Server.Endpoints["/translate/detect"] = Zotero.Server.Connector.IncompatibleVersion;
Zotero.Server.Endpoints["/translate/save"] = Zotero.Server.Connector.IncompatibleVersion;
Zotero.Server.Endpoints["/translate/select"] = Zotero.Server.Connector.IncompatibleVersion;
Zotero.Server.Connector.IncompatibleVersion.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	
	"init":function(postData, sendResponseCallback) {
		sendResponseCallback(404);
		if(Zotero.Server.Connector.IncompatibleVersion._errorShown) return;
		
		Zotero.Integration.activate();
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
				createInstance(Components.interfaces.nsIPromptService);
		ps.alert(null,
			Zotero.getString("connector.error.title"),
			Zotero.getString("integration.error.incompatibleVersion2",
				["Standalone "+Zotero.version, "Connector", "2.999.1"]));
		Zotero.Server.Connector.IncompatibleVersion._errorShown = true;
	}
};