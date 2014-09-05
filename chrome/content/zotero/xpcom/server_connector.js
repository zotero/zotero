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
Zotero.Server.Connector.AttachmentProgressManager = new function() {
	var attachmentsInProgress = new WeakMap(),
		attachmentProgress = {},
		id = 1;
	
	/**
	 * Adds attachments to attachment progress manager
	 */
	this.add = function(attachments) {
		for(var i=0; i<attachments.length; i++) {
			var attachment = attachments[i];
			attachmentsInProgress.set(attachment, (attachment.id = id++));
		}
	};
	
	/**
	 * Called on attachment progress
	 */
	this.onProgress = function(attachment, progress, error) {
		attachmentProgress[attachmentsInProgress.get(attachment)] = progress;
	};
		
	/**
	 * Gets progress for a given progressID
	 */
	this.getProgressForID = function(progressID) {
		return progressID in attachmentProgress ? attachmentProgress[progressID] : 0;
	};

	/**
	 * Check if we have received progress for a given attachment
	 */
	this.has = function(attachment) {
		return attachmentsInProgress.has(attachment)
			&& attachmentsInProgress.get(attachment) in attachmentProgress;
	}
};

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
	"permitBookmarklet":true,
	
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
					"minVersion", "maxVersion", "priority", "browserSupport", "inRepository", "lastUpdated"]) {
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
	"permitBookmarklet":true,
	
	/**
	 * Loads HTML into a hidden browser and initiates translator detection
	 * @param {Object} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(url, data, sendResponseCallback) {
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
			this._parsedPostData["uri"], this._parsedPostData["cookie"], url.userAgent));
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
 *		If a single item, sends response code 201 with item in body.
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
	"permitBookmarklet":true,
	
	/**
	 * Either loads HTML into a hidden browser and initiates translation, or saves items directly
	 * to the database
	 * @param {Object} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(url, data, sendResponseCallback) {
		this.sendResponse = sendResponseCallback;
		Zotero.Server.Connector.Detect.prototype.init.apply(this, [url, data, sendResponseCallback])
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
			Zotero.Server.Connector.AttachmentProgressManager.add(jsonItem.attachments);
			
			jsonItems.push(jsonItem);
		});
		translate.setHandler("attachmentProgress", function(obj, attachment, progress, error) {
			Zotero.Server.Connector.AttachmentProgressManager.onProgress(attachment, progress, error);
		});
		translate.setHandler("itemsDone", function(obj, item) {
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
 *		201 response code with item in body.
 */
Zotero.Server.Connector.SaveItem = function() {};
Zotero.Server.Endpoints["/connector/saveItems"] = Zotero.Server.Connector.SaveItem;
Zotero.Server.Connector.SaveItem.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	"permitBookmarklet":true,
	
	/**
	 * Either loads HTML into a hidden browser and initiates translation, or saves items directly
	 * to the database
	 * @param {Object} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(url, data, sendResponseCallback) {
		// figure out where to save
		var libraryID = null;
		var collectionID = null;
		var zp = Zotero.getActiveZoteroPane();
		try {
			var libraryID = zp.getSelectedLibraryID();
			var collection = zp.getSelectedCollection();
		} catch(e) {}
		
		var cookieSandbox = data["uri"] ? new Zotero.CookieSandbox(null, data["uri"],
			data["cookie"] || "", url.userAgent) : null;
		for(var i=0; i<data.items.length; i++) {
			Zotero.Server.Connector.AttachmentProgressManager.add(data.items[i].attachments);
		}
		
		// save items
		var itemSaver = new Zotero.Translate.ItemSaver(libraryID,
			Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD, 1, undefined, cookieSandbox);
		itemSaver.saveItems(data.items, function(returnValue, items) {
			if(returnValue) {
				try {
					// Remove attachments not being saved from item.attachments
					for(var i=0; i<data.items.length; i++) {
						var item = data.items[i];
						for(var j=0; j<item.attachments.length; j++) {
							if(!Zotero.Server.Connector.AttachmentProgressManager.has(item.attachments[j])) {
								item.attachments.splice(j--, 1);
							}
						}
					}
					
					for(var i=0; i<items.length; i++) {
						if(collection) collection.addItem(items[i].id);
					}
					
					sendResponseCallback(201, "application/json", JSON.stringify({"items":data.items}));
				} catch(e) {
					Zotero.logError(e);
					sendResponseCallback(500);
				}
			} else {
				Zotero.logError(items);
				sendResponseCallback(500);
			}
		}, Zotero.Server.Connector.AttachmentProgressManager.onProgress);
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
	"permitBookmarklet":true,
	
	/**
	 * Save snapshot
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(url, data, sendResponseCallback) {
		Zotero.Server.Connector.Data[data["url"]] = "<html>"+data["html"]+"</html>";
		Zotero.HTTP.processDocuments(["zotero://connector/"+encodeURIComponent(data["url"])],
			function(doc) {
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
					
					sendResponseCallback(201);
				} catch(e) {
					sendResponseCallback(500);
					throw e;
				}
			},
			null, null, false,
			new Zotero.CookieSandbox(null, data["url"], data["cookie"], url.userAgent));
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
	"permitBookmarklet":true,
	
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
 * Gets progress for an attachment that is currently being saved
 *
 * Accepts:
 *      Array of attachment IDs returned by savePage, saveItems, or saveSnapshot
 * Returns:
 *      200 response code with current progress in body. Progress is either a number
 *      between 0 and 100 or "false" to indicate that saving failed.
 */
Zotero.Server.Connector.Progress = function() {};
Zotero.Server.Endpoints["/connector/attachmentProgress"] = Zotero.Server.Connector.Progress;
Zotero.Server.Connector.Progress.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	"permitBookmarklet":true,
	
	/**
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(data, sendResponseCallback) {
		sendResponseCallback(200, "application/json",
			JSON.stringify([Zotero.Server.Connector.AttachmentProgressManager.getProgressForID(id) for each(id in data)]));
	}
};

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
	"permitBookmarklet":true,
	
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
 * Get selected collection
 *
 * Accepts:
 *		Nothing
 * Returns:
 *		libraryID
 *      libraryName
 *      collectionID
 *      collectionName
 */
Zotero.Server.Connector.GetSelectedCollection = function() {};
Zotero.Server.Endpoints["/connector/getSelectedCollection"] = Zotero.Server.Connector.GetSelectedCollection;
Zotero.Server.Connector.GetSelectedCollection.prototype = {
	"supportedMethods":["POST"],
	"supportedDataTypes":["application/json"],
	"permitBookmarklet":true,
	
	/**
	 * Returns a 200 response to say the server is alive
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(postData, sendResponseCallback) {
		var zp = Zotero.getActiveZoteroPane(),
			libraryID = null,
			collection = null,
			editable = true;
		
		try {
			libraryID = zp.getSelectedLibraryID();
			collection = zp.getSelectedCollection();
			editable = zp.collectionsView.editable;
		} catch(e) {}
		
		var response = {
			"editable":editable,
			"libraryID":libraryID
		};
		
		if(libraryID) {
			response.libraryName = Zotero.Libraries.getName(libraryID);
		} else {
			response.libraryName = Zotero.getString("pane.collections.library");
		}
		
		if(collection && collection.id) {
			response.id = collection.id;
			response.name = collection.name;
		} else {
			response.id = null;
			response.name = response.libraryName;
		}
		
		sendResponseCallback(200, "application/json", JSON.stringify(response));
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
	"permitBookmarklet":true,
	
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
	"permitBookmarklet":true,
	
	/**
	 * Sends a fixed webpage
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	"init":function(postData, sendResponseCallback) {
		sendResponseCallback(200, "text/html",
			'<!DOCTYPE html><html><head>'+
			'<script src="'+ZOTERO_CONFIG.BOOKMARKLET_URL+'common_ie.js"></script>'+
			'<script src="'+ZOTERO_CONFIG.BOOKMARKLET_URL+'ie_hack.js"></script>'+
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
	"permitBookmarklet":true,
	
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