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
		
		this._translate.cookieSandbox.destroy();
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
			me._translate.cookieSandbox.destroy();
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
			me._translate.cookieSandbox.destroy();
			Zotero.Browser.deleteHiddenBrowser(me._browser);
			if(jsonItems.length) {
				me._sendResponse(201, "application/json", JSON.stringify({"items":jsonItems}));
			} else {
				me._sendResponse(500);
			}
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
		itemSaver.saveItems(data.items, function(returnValue, data) {
			if(returnValue) {
				try {
					for each(var item in data) {
						if(collection) collection.addItem(savedItem.id);
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
				["Standalone "+Zotero.version, "Connector", "2.1.999"]));
		Zotero.Server.Connector.IncompatibleVersion._errorShown = true;
	}
};