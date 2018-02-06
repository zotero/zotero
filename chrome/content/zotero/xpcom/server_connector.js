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

Zotero.Server.Connector = {
	_waitingForSelection: {},
	
	getSaveTarget: function () {
		var zp = Zotero.getActiveZoteroPane(),
			library = null,
			collection = null,
			editable = true;
		try {
			library = Zotero.Libraries.get(zp.getSelectedLibraryID());
			collection = zp.getSelectedCollection();
			editable = zp.collectionsView.editable;
		}
		catch (e) {
			let id = Zotero.Prefs.get('lastViewedFolder');
			if (id) {
				let type = id[0];
				Zotero.debug(type);
				id = parseInt(('' + id).substr(1));
				
				switch (type) {
					case 'L':
						library = Zotero.Libraries.get(id);
						editable = library.editable;
						break;
					
					case 'C':
						collection = Zotero.Collections.get(id);
						library = collection.library;
						editable = collection.editable;
						break;
					}
			}
		}
		
		// Default to My Library if present if pane not yet opened
		// (which should never be the case anymore)
		if (!library) {
			let userLibrary = Zotero.Libraries.userLibrary;
			if (userLibrary) {
				library = userLibrary;
			}
		}
		
		return { library, collection, editable };
	}
};
Zotero.Server.Connector.Data = {};

Zotero.Server.Connector.SessionManager = {
	_sessions: new Map(),
	
	get: function (id) {
		return this._sessions.get(id);
	},
	
	create: function (id) {
		// Legacy client
		if (!id) {
			id = Zotero.Utilities.randomString();
		}
		if (this._sessions.has(id)) {
			throw new Error(`Session ID ${id} exists`);
		}
		Zotero.debug("Creating connector save session " + id);
		var session = new Zotero.Server.Connector.SaveSession(id);
		this._sessions.set(id, session);
		this.gc();
		return session;
	},
	
	gc: function () {
		// Delete sessions older than 10 minutes, or older than 1 minute if more than 10 sessions
		var ttl = this._sessions.size >= 10 ? 60 : 600;
		var deleteBefore = new Date() - ttl * 1000;
		
		for (let session of this._sessions) {
			if (session.created < deleteBefore) {
				this._session.delete(session.id);
			}
		}
	}
};


Zotero.Server.Connector.SaveSession = function (id) {
	this.id = id;
	this.created = new Date();
	this._objects = {};
};

Zotero.Server.Connector.SaveSession.prototype.addItem = async function (item) {
	return this._addObjects('item', [item]);
};

Zotero.Server.Connector.SaveSession.prototype.addItems = async function (items) {
	return this._addObjects('item', items);
};

Zotero.Server.Connector.SaveSession.prototype.update = async function (libraryID, collectionID, tags) {
	this._currentLibraryID = libraryID;
	this._currentCollectionID = collectionID;
	this._currentTags = tags || "";
	
	// Select new destination in collections pane
	var win = Zotero.getActiveZoteroPane();
	if (win && win.collectionsView) {
		if (collectionID) {
			var targetID = "C" + collectionID;
		}
		else {
			var targetID = "L" + libraryID;
		}
		await win.collectionsView.selectByID(targetID);
	}
	
	await this._updateObjects(this._objects);
	
	// TODO: Update active item saver
	
	// If a single item was saved, select it
	if (win && win.collectionsView) {
		if (this._objects && this._objects.item) {
			let items = Array.from(this._objects.item).filter(item => item.isTopLevelItem());
			if (items.length == 1) {
				await win.selectItem(items[0].id);
			}
		}
	}
};

Zotero.Server.Connector.SaveSession.prototype._addObjects = async function (objectType, objects) {
	if (!this._objects[objectType]) {
		this._objects[objectType] = new Set();
	}
	
	// If target has changed since the save began, update the objects
	await this._updateObjects({
		[objectType]: objects
	});
	
	for (let object of objects) {
		this._objects[objectType].add(object);
	}
};

Zotero.Server.Connector.SaveSession.prototype._updateObjects = async function (objects) {
	if (Object.keys(objects).every(type => objects[type].length == 0)) {
		return;
	}
	
	var libraryID = this._currentLibraryID;
	var collectionID = this._currentCollectionID;
	var tags = this._currentTags.trim();
	tags = tags ? tags.split(/\s*,\s*/) : [];
	
	Zotero.debug("Updating objects for connector save session " + this.id);
	
	return Zotero.DB.executeTransaction(async function () {
		for (let objectType in objects) {
			for (let object of objects[objectType]) {
				Zotero.debug(object.libraryID);
				Zotero.debug(libraryID);
				if (object.libraryID != libraryID) {
					throw new Error("Can't move objects between libraries");
				}
				// Assign tags and collections to top-level items
				if (objectType == 'item' && object.isTopLevelItem()) {
					object.setTags(tags);
					object.setCollections(collectionID ? [collectionID] : []);
					await object.save();
				}
			}
		}
	});
};


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
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Gets available translator list and other important data
	 * @param {Object} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	init: function(data, sendResponseCallback) {
		// Translator data
		var me = this;
		if(data.url) {
			Zotero.Translators.getWebTranslatorsForLocation(data.url, data.rootUrl).then(function(data) {				
				sendResponseCallback(200, "application/json",
						JSON.stringify(me._serializeTranslators(data[0])));
			});
		} else {
			Zotero.Translators.getAll().then(function(translators) {
				var responseData = me._serializeTranslators(translators);
				sendResponseCallback(200, "application/json", JSON.stringify(responseData));
			}).catch(function(e) {
				sendResponseCallback(500);
				throw e;
			}).done();
		}
	},
	
	_serializeTranslators: function(translators) {
		var responseData = [];
		let properties = ["translatorID", "translatorType", "label", "creator", "target", "targetAll",
			"minVersion", "maxVersion", "priority", "browserSupport", "inRepository", "lastUpdated"];
		for (var translator of translators) {
			responseData.push(translator.serialize(properties));
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
Zotero.Server.Connector.Detect.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Loads HTML into a hidden browser and initiates translator detection
	 * @param {Object} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	init: function(url, data, sendResponseCallback) {
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
				me._translate.setLocation(me._parsedPostData["uri"], me._parsedPostData["uri"]);
				me._translate.getTranslators();
			} catch(e) {
				sendResponseCallback(500);
				throw e;
			}
		}, false);
		
		me._browser.loadURI("zotero://connector/"+encodeURIComponent(this._parsedPostData["uri"]));
	},

	/**
	 * Callback to be executed when list of translators becomes available. Sends standard
	 * translator passing properties with proxies where available for translators.
	 * @param {Zotero.Translate} translate
	 * @param {Zotero.Translator[]} translators
	 */
	_translatorsAvailable: function(translate, translators) {
		translators = translators.map(function(translator) {
			translator = translator.serialize(TRANSLATOR_PASSING_PROPERTIES.concat('proxy'));
			translator.proxy = translator.proxy ? translator.proxy.toJSON() : null;
			return translator;
		});
		this.sendResponse(200, "application/json", JSON.stringify(translators));
		
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
 *		translatorID [optional] - a translator ID as returned by /connector/detect
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
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Either loads HTML into a hidden browser and initiates translation, or saves items directly
	 * to the database
	 * @param {Object} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	init: function(url, data, sendResponseCallback) {
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget();
		if (!library.editable) {
			Zotero.logError("Can't add item to read-only library " + library.name);
			return sendResponseCallback(500, "application/json", JSON.stringify({ libraryEditable: false }));
		}
		
		this.sendResponse = sendResponseCallback;
		Zotero.Server.Connector.Detect.prototype.init.apply(this, [url, data, sendResponseCallback])
	},

	/**
	 * Callback to be executed when items must be selected
	 * @param {Zotero.Translate} translate
	 * @param {Object} itemList ID=>text pairs representing available items
	 */
	_selectItems: function(translate, itemList, callback) {
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
		this.sendResponse(300, "application/json", JSON.stringify({selectItems: itemList, instanceID: instanceID, uri: this._parsedPostData.uri}));
		this.selectedItemsCallback = callback;
	},

	/**
	 * Callback to be executed when list of translators becomes available. Opens progress window,
	 * selects specified translator, and initiates translation.
	 * @param {Zotero.Translate} translate
	 * @param {Zotero.Translator[]} translators
	 */
	_translatorsAvailable: function(translate, translators) {
		// make sure translatorsAvailable succeded
		if(!translators.length) {
			Zotero.Browser.deleteHiddenBrowser(this._browser);
			this.sendResponse(500);
			return;
		}
		
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget();
		var libraryID = library.libraryID;
		
		// set handlers for translation
		var me = this;
		var jsonItems = [];
		translate.setHandler("select", function(obj, item, callback) { return me._selectItems(obj, item, callback) });
		translate.setHandler("itemDone", function(obj, item, jsonItem) {
			Zotero.Server.Connector.AttachmentProgressManager.add(jsonItem.attachments);
			jsonItems.push(jsonItem);
		});
		translate.setHandler("attachmentProgress", function(obj, attachment, progress, error) {
			Zotero.Server.Connector.AttachmentProgressManager.onProgress(attachment, progress, error);
		});
		translate.setHandler("done", function(obj, item) {
			Zotero.Browser.deleteHiddenBrowser(me._browser);
			if(jsonItems.length || me.selectedItems === false) {
				me.sendResponse(201, "application/json", JSON.stringify({items: jsonItems}));
			} else {
				me.sendResponse(500);
			}
		});
		
		if (this._parsedPostData.translatorID) {
			translate.setTranslator(this._parsedPostData.translatorID);
		} else {
			translate.setTranslator(translators[0]);
		}
		translate.translate({libraryID, collections: collection ? [collection.id] : false});
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
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Either loads HTML into a hidden browser and initiates translation, or saves items directly
	 * to the database
	 */
	init: Zotero.Promise.coroutine(function* (options) {
		var data = options.data;
		
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget();
		var libraryID = library.libraryID;
		
		try {
			var session = Zotero.Server.Connector.SessionManager.create(data.sessionID);
		}
		catch (e) {
			return [409, "application/json", JSON.stringify({ error: "SESSION_EXISTS" })];
		}
		yield session.update(libraryID, collection ? collection.id : false);
		
		// TODO: Default to My Library root, since it's changeable
		if (!library.editable) {
			Zotero.logError("Can't add item to read-only library " + library.name);
			return [500, "application/json", JSON.stringify({ libraryEditable: false })];
		}
		
		var cookieSandbox = data.uri
			? new Zotero.CookieSandbox(
				null,
				data.uri,
				data.detailedCookies ? "" : data.cookie || "",
				options.headers["User-Agent"]
			)
			: null;
		if(cookieSandbox && data.detailedCookies) {
			cookieSandbox.addCookiesFromHeader(data.detailedCookies);
		}
		
		for(var i=0; i<data.items.length; i++) {
			Zotero.Server.Connector.AttachmentProgressManager.add(data.items[i].attachments);
		}
		
		let proxy = data.proxy && new Zotero.Proxy(data.proxy);
		// save items
		var itemSaver = new Zotero.Translate.ItemSaver({
			libraryID,
			collections: collection ? [collection.id] : undefined,
			attachmentMode: Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD,
			forceTagType: 1,
			cookieSandbox,
			proxy
		});
		try {
			var deferred = Zotero.Promise.defer();
			itemSaver.saveItems(
				data.items,
				Zotero.Server.Connector.AttachmentProgressManager.onProgress,
				function() {
					// Remove attachments not being saved from item.attachments
					for(var i=0; i<data.items.length; i++) {
						var item = data.items[i];
						for(var j=0; j<item.attachments.length; j++) {
							if(!Zotero.Server.Connector.AttachmentProgressManager.has(item.attachments[j])) {
								item.attachments.splice(j--, 1);
							}
						}
					}
					
					deferred.resolve([201, "application/json", JSON.stringify({items: data.items})]);
				}
			)
			.then(function (items) {
				session.addItems(items);
			});
			return deferred.promise;
		}
		catch (e) {
			Zotero.logError(e);
			return 500;
		}
	})
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
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Save snapshot
	 */
	init: Zotero.Promise.coroutine(function* (options) {
		var data = options.data;
		
		Zotero.Server.Connector.Data[data["url"]] = "<html>"+data["html"]+"</html>";
		
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget();
		var libraryID = library.libraryID;
		
		try {
			var session = Zotero.Server.Connector.SessionManager.create(data.sessionID);
		}
		catch (e) {
			return [409, "application/json", JSON.stringify({ error: "SESSION_EXISTS" })];
		}
		yield session.update(libraryID, collection ? collection.id : false);
		
		// TODO: Default to My Library root, since it's changeable
		if (!library.editable) {
			Zotero.logError("Can't add item to read-only library " + library.name);
			return [500, "application/json", JSON.stringify({ libraryEditable: false })];
		}
		
		// determine whether snapshot can be saved
		var filesEditable;
		if (libraryID) {
			let group = Zotero.Groups.getByLibraryID(libraryID);
			filesEditable = group.filesEditable;
		}
		else {
			filesEditable = true;
		}
		
		var cookieSandbox = data.url
			? new Zotero.CookieSandbox(
				null,
				data.url,
				data.detailedCookies ? "" : data.cookie || "",
				options.headers["User-Agent"]
			)
			: null;
		if(cookieSandbox && data.detailedCookies) {
			cookieSandbox.addCookiesFromHeader(data.detailedCookies);
		}
		
		if (data.pdf && filesEditable) {
			delete Zotero.Server.Connector.Data[data.url];
			
			try {
				let item = yield Zotero.Attachments.importFromURL({
					libraryID,
					url: data.url,
					collections: collection ? [collection.id] : undefined,
					contentType: "application/pdf",
					cookieSandbox
				});
				yield session.addItem(item);
				return 201;
			}
			catch (e) {
				Zotero.logError(e);
				return 500;
			}
		}
		else {
			let deferred = Zotero.Promise.defer();
			Zotero.HTTP.loadDocuments(
				["zotero://connector/" + encodeURIComponent(data.url)],
				Zotero.Promise.coroutine(function* (doc) {
					delete Zotero.Server.Connector.Data[data.url];
					
					try {
						// create new webpage item
						var item = new Zotero.Item("webpage");
						item.libraryID = libraryID;
						item.setField("title", doc.title);
						item.setField("url", data.url);
						item.setField("accessDate", "CURRENT_TIMESTAMP");
						if (collection) {
							item.setCollections([collection.id]);
						}
						var itemID = yield item.saveTx();
						yield session.addItem(item);
						
						// save snapshot
						if (filesEditable && !data.skipSnapshot) {
							yield Zotero.Attachments.importFromDocument({
								document: doc,
								parentItemID: itemID
							});
						}
						
						deferred.resolve(201);
					} catch(e) {
						Zotero.debug(e, 1);
						deferred.resolve(500);
						throw e;
					}
				}),
				null, null, false, cookieSandbox
			);
			return deferred.promise;
		}
	})
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
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Finishes up translation when item selection is complete
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	init: function(data, sendResponseCallback) {
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
 * 
 *
 * Accepts:
 *		sessionID - A session ID previously passed to /saveItems
 *		target - A treeViewID (L1, C23, etc.) for the library or collection to save to
 *		tags - A string of tags separated by commas
 *
 * Returns:
 *		200 response on successful change
 *		400 on error with 'error' property in JSON
 */
Zotero.Server.Connector.UpdateSession = function() {};
Zotero.Server.Endpoints["/connector/updateSession"] = Zotero.Server.Connector.UpdateSession;
Zotero.Server.Connector.UpdateSession.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	init: async function (options) {
		var data = options.data
		
		if (!data.sessionID) {
			return [400, "application/json", JSON.stringify({ error: "SESSION_ID_NOT_PROVIDED" })];
		}
		
		var session = Zotero.Server.Connector.SessionManager.get(data.sessionID);
		if (!session) {
			return [400, "application/json", JSON.stringify({ error: "SESSION_NOT_FOUND" })];
		}
		
		// Parse treeViewID
		var [type, id] = [data.target[0], parseInt(data.target.substr(1))];
		var tags = data.tags;
		
		if (type == 'L') {
			let library = Zotero.Libraries.get(id);
			await session.update(library.libraryID, null, tags);
		}
		else if (type == 'C') {
			let collection = await Zotero.Collections.getAsync(id);
			if (!collection) {
				return [400, "application/json", JSON.stringify({ error: "COLLECTION_NOT_FOUND" })];
			}
			await session.update(collection.libraryID, collection.id, tags);
		}
		else {
			throw new Error(`Invalid identifier '${data.target}'`);
		}
		
		return [200, "application/json", JSON.stringify({})];
	}
};

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
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	init: function(data, sendResponseCallback) {
		sendResponseCallback(200, "application/json",
			JSON.stringify(data.map(id => Zotero.Server.Connector.AttachmentProgressManager.getProgressForID(id))));
	}
};

/**
 * Translates resources using import translators
 * 	
 * Returns:
 * 	- Object[Item] an array of imported items
 */
 
Zotero.Server.Connector.Import = function() {};
Zotero.Server.Endpoints["/connector/import"] = Zotero.Server.Connector.Import;
Zotero.Server.Connector.Import.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: '*',
	permitBookmarklet: false,
	
	init: Zotero.Promise.coroutine(function* (options) {
		let translate = new Zotero.Translate.Import();
		translate.setString(options.data);
		let translators = yield translate.getTranslators();
		if (!translators || !translators.length) {
			return 400;
		}
		translate.setTranslator(translators[0]);
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget();
		if (!library.editable) {
			Zotero.logError("Can't import into read-only library " + library.name);
			return [500, "application/json", JSON.stringify({ libraryEditable: false })];
		}
		let items = yield translate.translate({
			libraryID: library.libraryID,
			collections: collection ? [collection.id] : null
		});
		return [201, "application/json", JSON.stringify(items)];
	})
}

/**
 * Install CSL styles
 * 	
 * Returns:
 * 	- {name: styleName}
 */
 
Zotero.Server.Connector.InstallStyle = function() {};
Zotero.Server.Endpoints["/connector/installStyle"] = Zotero.Server.Connector.InstallStyle;
Zotero.Server.Connector.InstallStyle.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: '*',
	permitBookmarklet: false,
	
	init: Zotero.Promise.coroutine(function* (options) {
		try {
			var styleName = yield Zotero.Styles.install(options.data, options.query.origin || null, true);
		} catch (e) {
			return [400, "text/plain", e.message];
		}
		return [201, "application/json", JSON.stringify({name: styleName})];
	})
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
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Returns a 200 response to say the server is alive
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	init: function(postData, sendResponseCallback) {
		var translator = Zotero.Translators.get(postData.translatorID);
		translator.getCode().then(function(code) {
			sendResponseCallback(200, "application/javascript", code);
		});
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
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Returns a 200 response to say the server is alive
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	init: function(postData, sendResponseCallback) {
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget();
		var response = {
			libraryID: library.libraryID,
			libraryName: library.name,
			libraryEditable: library.editable,
			editable
		};
		
		if(collection && collection.id) {
			response.id = collection.id;
			response.name = collection.name;
		} else {
			response.id = null;
			response.name = response.libraryName;
		}
		
		// Get list of editable libraries and collections
		var collections = [];
		var originalLibraryID = library.libraryID;
		for (let library of Zotero.Libraries.getAll()) {
			if (!library.editable) continue;
			// TEMP: For now, don't allow library changing
			if (library.libraryID != originalLibraryID) continue;
			
			// Add recent: true for recent targets
			
			collections.push(
				{
					id: library.treeViewID,
					name: library.name
				},
				...Zotero.Collections.getByLibrary(library.libraryID, true).map(c => ({
					id: c.treeViewID,
					name: c.name,
					level: c.level + 1 || 1 // Added by Zotero.Collections._getByContainer()
				}))
			);
		}
		response.targets = collections;
		
		// TODO: Limit debug size
		sendResponseCallback(200, "application/json", JSON.stringify(response));
	}
}

/**
 * Get a list of client hostnames (reverse local IP DNS)
 *
 * Accepts:
 *		Nothing
 * Returns:
 * 		{Array} hostnames
 */
Zotero.Server.Connector.GetClientHostnames = {};
Zotero.Server.Connector.GetClientHostnames = function() {};
Zotero.Server.Endpoints["/connector/getClientHostnames"] = Zotero.Server.Connector.GetClientHostnames;
Zotero.Server.Connector.GetClientHostnames.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: false,
	
	/**
	 * Returns a 200 response to say the server is alive
	 */
	init: Zotero.Promise.coroutine(function* (options) {
		try {
			var hostnames = yield Zotero.Proxies.DNS.getHostnames();
		} catch(e) {
			return 500;
		}
		return [200, "application/json", JSON.stringify(hostnames)];
	})
};

/**
 * Get a list of stored proxies
 *
 * Accepts:
 *		Nothing
 * Returns:
 * 		{Array} hostnames
 */
Zotero.Server.Connector.Proxies = {};
Zotero.Server.Connector.Proxies = function() {};
Zotero.Server.Endpoints["/connector/proxies"] = Zotero.Server.Connector.Proxies;
Zotero.Server.Connector.Proxies.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: false,
	
	/**
	 * Returns a 200 response to say the server is alive
	 */
	init: Zotero.Promise.coroutine(function* () {
		let proxies = Zotero.Proxies.proxies.map((p) => Object.assign(p.toJSON(), {hosts: p.hosts}));
		return [200, "application/json", JSON.stringify(proxies)];
	})
};


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
	supportedMethods: ["GET", "POST"],
	supportedDataTypes: ["application/json", "text/plain"],
	permitBookmarklet: true,
	
	/**
	 * Sends 200 and HTML status on GET requests
	 * @param data {Object} request information defined in connector.js
	 */
	init: function (req) {
		if (req.method == 'GET') {
			return [200, "text/html", '<!DOCTYPE html><html><head>' +
				'<title>Zotero Connector Server is Available</title></head>' +
				'<body>Zotero Connector Server is Available</body></html>'];
		} else {
			// Store the active URL so it can be used for site-specific Quick Copy
			if (req.data.activeURL) {
				//Zotero.debug("Setting active URL to " + req.data.activeURL);
				Zotero.QuickCopy.lastActiveURL = req.data.activeURL;
			}
			
			let response = {
				prefs: {
					automaticSnapshots: Zotero.Prefs.get('automaticSnapshots')
				}
			};
			if (Zotero.QuickCopy.hasSiteSettings()) {
				response.prefs.reportActiveURL = true;
			}
			
			return [200, 'application/json', JSON.stringify(response)];
		}
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
	supportedMethods: ["GET"],
	permitBookmarklet: true,
	
	/**
	 * Sends a fixed webpage
	 * @param {String} data POST data or GET query string
	 * @param {Function} sendResponseCallback function to send HTTP response
	 */
	init: function(postData, sendResponseCallback) {
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
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	init: function(postData, sendResponseCallback) {
		sendResponseCallback(404);
		if(Zotero.Server.Connector.IncompatibleVersion._errorShown) return;
		
		Zotero.Utilities.Internal.activate();
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].
				createInstance(Components.interfaces.nsIPromptService);
		ps.alert(null,
			Zotero.getString("connector.error.title"),
			Zotero.getString("integration.error.incompatibleVersion2",
				["Standalone "+Zotero.version, "Connector", "2.999.1"]));
		Zotero.Server.Connector.IncompatibleVersion._errorShown = true;
	}
};