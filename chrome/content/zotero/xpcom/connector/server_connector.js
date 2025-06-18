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
	
	getSaveTarget: function (allowReadOnly) {
		var zp = Zotero.getActiveZoteroPane();
		var library = null;
		var collection = null;
		var editable = null;
		
		if (zp && zp.collectionsView) {
			if (zp.collectionsView.editable || allowReadOnly) {
				library = Zotero.Libraries.get(zp.getSelectedLibraryID());
				collection = zp.getSelectedCollection();
				editable = zp.collectionsView.editable;
			}
			// If not editable, switch to My Library if it exists and is editable
			else {
				let userLibrary = Zotero.Libraries.userLibrary;
				if (userLibrary && userLibrary.editable) {
					Zotero.debug("Save target isn't editable -- switching to My Library");
					
					// Don't wait for this, because we don't want to slow down all conenctor
					// requests by making this function async
					zp.collectionsView.selectByID(userLibrary.treeViewID);
					
					library = userLibrary;
					collection = null;
					editable = true;
				}
			}
		}
		else {
			let id = Zotero.Prefs.get('lastViewedFolder');
			if (id) {
				({ library, collection, editable } = this.resolveTarget(id));
				if (!editable && !allowReadOnly) {
					let userLibrary = Zotero.Libraries.userLibrary;
					if (userLibrary && userLibrary.editable) {
						Zotero.debug("Save target isn't editable -- switching lastViewedFolder to My Library");
						let treeViewID = userLibrary.treeViewID;
						Zotero.Prefs.set('lastViewedFolder', treeViewID);
						({ library, collection, editable } = this.resolveTarget(treeViewID));
					}
				}
			}
		}
		
		// Default to My Library if present if pane not yet opened
		// (which should never be the case anymore)
		if (!library) {
			let userLibrary = Zotero.Libraries.userLibrary;
			if (userLibrary && userLibrary.editable) {
				library = userLibrary;
			}
		}
		
		return { library, collection, editable };
	},
	
	resolveTarget: function (targetID) {
		var library;
		var collection;
		var editable;
		
		var type = targetID[0];
		var id = parseInt(('' + targetID).substr(1));
		
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
		
		default:
			throw new Error(`Unsupported target type '${type}'`);
		}
		
		return { library, collection, editable };
	}
};

Zotero.Server.Connector.SessionManager = {
	_sessions: new Map(),
	
	get: function (id) {
		return this._sessions.get(id);
	},
	
	create: function (id, action, requestData) {
		// Legacy connector
		if (!id) {
			Zotero.debug("No session id provided by client", 2);
			id = Zotero.Utilities.randomString();
		}
		if (this._sessions.has(id)) {
			throw new Error(`Session ID ${id} exists`);
		}
		Zotero.debug("Creating connector save session " + id);
		var session = new Zotero.Server.Connector.SaveSession(id, action, requestData);
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


Zotero.Server.Connector.SaveSession = function (id, action, requestData) {
	this.id = id;
	this.created = new Date();
	this.savingDone = false;
	this.pendingAttachments = [];
	this._action = action;
	this._requestData = requestData;
	this._items = new Set();
	
	this._progressItems = {};
	this._orderedProgressItems = [];
};


Zotero.Server.Connector.SaveSession.prototype.addSnapshotContent = function (snapshotContent) {
	this._requestData.data.snapshotContent = snapshotContent;
};


Zotero.Server.Connector.SaveSession.prototype.onProgress = function (item, progress, error) {
	if (item.id === null || item.id === undefined) {
		throw new Error("ID not provided");
	}
	
	// Child item
	if (item.parent) {
		let progressItem = this._progressItems[item.parent];
		if (!progressItem) {
			throw new Error(`Parent progress item ${item.parent} not found `
				+ `for attachment ${item.id}`);
		}
		let a = progressItem.attachments.find(a => a.id == item.id);
		if (!a) {
			a = {
				id: item.id
			};
			progressItem.attachments.push(a);
		}
		a.title = item.title;
		a.contentType = item.mimeType;
		a.progress = progress;
		return;
	}
	
	// Top-level item
	var o = this._progressItems[item.id];
	if (!o) {
		o = {
			id: item.id
		};
		this._progressItems[item.id] = o;
		this._orderedProgressItems.push(item.id);
	}
	o.title = item.title;
	// PDF being converted to a top-level item after recognition
	if (o.itemType == 'attachment' && item.itemType != 'attachment') {
		delete o.progress;
		delete o.contentType;
	}
	if (o.itemType === item.itemType) {
		o.progress = progress;
		return;
	}
	o.itemType = item.itemType;
	o.attachments = item.attachments;
};

Zotero.Server.Connector.SaveSession.prototype.isSavingDone = function () {
	return this.savingDone
		|| Object.values(this._progressItems).every(i => i.progress === 100 || typeof i.progress !== "number")
		&& Object.values(this._progressItems).every((i) => {
			return !i.attachments || i.attachments.every(a => a.progress === 100 || typeof i.progress !== "number");
		});
};

Zotero.Server.Connector.SaveSession.prototype.getProgressItem = function (id) {
	return this._progressItems[id];
};

Zotero.Server.Connector.SaveSession.prototype.getAllProgress = function () {
	return this._orderedProgressItems.map(id => this._progressItems[id]);
};

Zotero.Server.Connector.SaveSession.prototype.addItem = async function (item) {
	return this.addItems([item]);
};

Zotero.Server.Connector.SaveSession.prototype.addItems = async function (items) {
	for (let item of items) {
		this._items.add(item);
	}
	
	// Update the items with the current target data, in case it changed since the save began
	await this._updateItems(items);
};

Zotero.Server.Connector.SaveSession.prototype.remove = function () {
	delete Zotero.Server.Connector.SessionManager._sessions[this.id];
}

/**
 * Change the target data for this session and update any items that have already been saved
 */
Zotero.Server.Connector.SaveSession.prototype.update = async function (targetID, tags) {
	var previousTargetID = this._currentTargetID;
	this._currentTargetID = targetID;
	this._currentTags = tags || "";
	
	// Select new destination in collections pane
	var zp = Zotero.getActiveZoteroPane();
	if (zp && zp.collectionsView) {
		await zp.collectionsView.selectByID(targetID);
	}
	// If window is closed, select target collection re-open
	else {
		Zotero.Prefs.set('lastViewedFolder', targetID);
	}
	
	// If moving from a non-filesEditable library to a filesEditable library, resave from
	// original data, since there might be files that weren't saved or were removed
	if (previousTargetID && previousTargetID != targetID) {
		let { library: oldLibrary } = Zotero.Server.Connector.resolveTarget(previousTargetID);
		let { library: newLibrary } = Zotero.Server.Connector.resolveTarget(targetID);
		if (oldLibrary != newLibrary && !oldLibrary.filesEditable && newLibrary.filesEditable) {
			Zotero.debug("Resaving items to filesEditable library");
			if (this._action == 'saveItems' || this._action == 'saveSnapshot') {
				// Delete old items
				for (let item of this._items) {
					await item.eraseTx();
				}
				let actionUC = Zotero.Utilities.capitalize(this._action);
				// saveItems has a different signature with the session as the first argument
				let params = [targetID, this._requestData];
				if (this._action == 'saveItems') {
					params.unshift(this);
				}
				let newItems = await Zotero.Server.Connector[actionUC].prototype[this._action].apply(
					Zotero.Server.Connector[actionUC], params
				);
				// saveSnapshot only returns a single item
				if (this._action == 'saveSnapshot') {
					newItems = [newItems];
				}
				this._items = new Set(newItems);
			}
		}
	}
	
	await this._updateItems(this._items);
	
	// If a single item was saved, select it (or its parent, if it now has one)
	if (zp && zp.collectionsView && this._items.size == 1) {
		let item = Array.from(this._items)[0];
		item = item.isTopLevelItem() ? item : item.parentItem;
		// Don't select if in trash
		if (!item.deleted) {
			await zp.selectItem(item.id);
		}
	}
};

/**
 * Update the passed items with the current target and tags
 */
Zotero.Server.Connector.SaveSession.prototype._updateItems = Zotero.serial(async function (items) {
	if (items.length == 0) {
		return;
	}
	
	var { library, collection, editable } = Zotero.Server.Connector.resolveTarget(this._currentTargetID);
	var libraryID = library.libraryID;
	
	var tags = this._currentTags.trim();
	tags = tags ? tags.split(/\s*,\s*/).filter(x => x) : [];
	
	Zotero.debug("Updating items for connector save session " + this.id);
	
	for (let item of items) {
		let newLibrary = Zotero.Libraries.get(library.libraryID);
		
		if (item.libraryID != libraryID) {
			let newItem = await item.moveToLibrary(libraryID);
			// Check pending attachments and switch parent ID
			for (let i = 0; i < this.pendingAttachments.length; ++i) {
				if (this.pendingAttachments[i][0] === item.id) {
					this.pendingAttachments[i][0] = newItem.id;
				}
			}
			// Replace item in session
			this._items.delete(item);
			this._items.add(newItem);
		}
		
		// If the item is now a child item (e.g., from Retrieve Metadata), update the
		// parent item instead
		if (!item.isTopLevelItem()) {
			item = item.parentItem;
		}
		// Skip deleted items
		if (!Zotero.Items.exists(item.id)) {
			Zotero.debug(`Item ${item.id} in save session no longer exists`);
			continue;
		}
		// Keep automatic tags
		let originalTags = item.getTags().filter(tag => tag.type == 1);
		item.setTags(originalTags.concat(tags));
		item.setCollections(collection ? [collection.id] : []);
		await item.saveTx();
	}
	
	this._updateRecents();
});


Zotero.Server.Connector.SaveSession.prototype._updateRecents = function () {
	var targetID = this._currentTargetID;
	try {
		let numRecents = 7;
		let recents = Zotero.Prefs.get('recentSaveTargets') || '[]';
		recents = JSON.parse(recents);
		// If there's already a target from this session in the list, update it
		for (let recent of recents) {
			if (recent.sessionID == this.id) {
				recent.id = targetID;
				break;
			}
		}
		// If a session is found with the same target, move it to the end without changing
		// the sessionID. This could be the current session that we updated above or a different
		// one. (We need to leave the old sessionID for the same target or we'll end up removing
		// the previous target from the history if it's changed in the current one.)
		let pos = recents.findIndex(r => r.id == targetID);
		if (pos != -1) {
			recents = [
				...recents.slice(0, pos),
				...recents.slice(pos + 1),
				recents[pos]
			];
		}
		// Otherwise just add this one to the end
		else {
			recents = recents.concat([{
				id: targetID,
				sessionID: this.id
			}]);
		}
		recents = recents.slice(-1 * numRecents);
		Zotero.Prefs.set('recentSaveTargets', JSON.stringify(recents));
	}
	catch (e) {
		Zotero.logError(e);
		Zotero.Prefs.clear('recentSaveTargets');
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
			Zotero.Translators.getWebTranslatorsForLocation(data.url, data.url).then(function(data) {
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
			});
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
	 */
	init: async function(requestData) {
		try {
			var translators = await this.getTranslators(requestData);
		} catch (e) {
			Zotero.logError(e);
			return 500;
		}
		
		translators = translators.map(function(translator) {
			return translator.serialize(TRANSLATOR_PASSING_PROPERTIES);
		});
		return [200, "application/json", JSON.stringify(translators)];
	},
	
	async getTranslators(requestData) {
		var data = requestData.data;
		var cookieSandbox = data.uri
			? new Zotero.CookieSandbox(
				null,
				data.uri,
				data.cookie || "",
				requestData.headers["User-Agent"]
			)
			: null;
		
		var parser = new DOMParser();
		var doc = parser.parseFromString(`<html>${data.html}</html>`, 'text/html');
		doc = Zotero.HTTP.wrapDocument(doc, data.uri);
		
		let translate = this._translate = new Zotero.Translate.Web();
		translate.setDocument(doc);
		cookieSandbox && translate.setCookieSandbox(cookieSandbox);
		
		return await translate.getTranslators();
	},
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
	 */
	init: function(requestData) {
		return new Zotero.Promise(async function(resolve) {
			function sendResponseCallback() {
				if (arguments.length > 1) {
					return resolve(arguments);
				}
				return resolve(arguments[0]);
			}
			var data = requestData.data;
			var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget();
			var libraryID = library.libraryID;
			var targetID = collection ? collection.treeViewID : library.treeViewID;
			
			if (Zotero.Server.Connector.SessionManager.get(data.sessionID)) {
				return sendResponseCallback(409, "application/json", JSON.stringify({ error: "SESSION_EXISTS" }));
			}
			
			// Shouldn't happen as long as My Library exists
			if (!library.editable) {
				Zotero.logError("Can't add item to read-only library " + library.name);
				return sendResponseCallback(500, "application/json", JSON.stringify({ libraryEditable: false }));
			}

			var session = Zotero.Server.Connector.SessionManager.create(data.sessionID);
			await session.update(targetID);
			
			this.sendResponse = sendResponseCallback;
			this._parsedPostData = data;
			
			try {
				var translators = await Zotero.Server.Connector.Detect.prototype.getTranslators.call(this, requestData);
			} catch(e) {
				Zotero.logError(e);
				session.remove();
				return sendResponseCallback(500);
			}
			
			if(!translators.length) {
				Zotero.debug(`No translators available for /connector/savePage ${data.uri}`);
				session.remove();
				return this.sendResponse(500);
			}
			
			// set handlers for translation
			var me = this;
			var translate = this._translate;
			translate.setHandler("select", function(obj, item, callback) { return me._selectItems(obj, item, callback) });
			let attachmentTitleData = {};
			translate.setHandler("itemsDone", function(obj, items) {
				if(items.length || me.selectedItems === false) {
					items = items.map((item) => {
						let o = {
							id: item.id,
							title: item.title,
							itemType: item.itemType,
							contentType: item.mimeType,
							mimeType: item.mimeType, // TODO: Remove
						};
						if (item.attachments) {
							let id = 0;
							for (let attachment of item.attachments) {
								attachment.parent = item.id;
								attachment.id = id++;
							}
							o.attachments = item.attachments.map((attachment) => {
								// Retaining id and parent info for session progress management
								attachmentTitleData[attachment.title] = {id: attachment.id, parent: item.id};
								return {
									id: session.id + '_' + attachment.id, // TODO: Remove prefix
									title: attachment.title,
									contentType: attachment.contentType,
									mimeType: attachment.mimeType,  // TODO: Remove
								};
							});
						};
						session.onProgress(item, 100);
						return o;
					});
					me.sendResponse(201, "application/json", JSON.stringify({items}));
				} else {
					me.sendResponse(500);
					session.remove();
				}
			});
			
			translate.setHandler("attachmentProgress", function(obj, attachment, progress, error) {
				if (attachmentTitleData[attachment.title]) {
					session.onProgress(Object.assign(
							{},
							attachment,
							attachmentTitleData[attachment.title],
						), progress, error);
				}
			});
			
			translate.setHandler("error", function(obj, err) {
				Zotero.logError(err);
				sendResponseCallback(500);
				session.remove();
			});
			
			if (this._parsedPostData.translatorID) {
				translate.setTranslator(this._parsedPostData.translatorID);
			} else {
				translate.setTranslator(translators[0]);
			}
			let items = await translate.translate({libraryID, collections: collection ? [collection.id] : false});
			session.addItems(items);
		}.bind(this));
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
 * Saves items to DB
 *
 * Accepts:
 *		items - an array of JSON format items
 * Returns:
 *		201 response code with item in body.
 */
Zotero.Server.Connector.SaveItems = function() {};
Zotero.Server.Endpoints["/connector/saveItems"] = Zotero.Server.Connector.SaveItems;
Zotero.Server.Connector.SaveItems.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Either loads HTML into a hidden browser and initiates translation, or saves items directly
	 * to the database
	 */
	init: Zotero.Promise.coroutine(function* (requestData) {
		var data = requestData.data;
		
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget();
		var libraryID = library.libraryID;
		var targetID = collection ? collection.treeViewID : library.treeViewID;
		
		try {
			var session = Zotero.Server.Connector.SessionManager.create(
				data.sessionID,
				'saveItems',
				requestData
			);
		}
		catch (e) {
			return [409, "application/json", JSON.stringify({ error: "SESSION_EXISTS" })];
		}
		yield session.update(targetID);
		
		// Shouldn't happen as long as My Library exists
		if (!library.editable) {
			Zotero.logError("Can't add item to read-only library " + library.name);
			return [500, "application/json", JSON.stringify({ libraryEditable: false })];
		}
		
		return new Zotero.Promise((resolve) => {
			try {
				this.saveItems(
					session,
					targetID,
					requestData,
					function (jsonItems, items) {
						session.addItems(items);
						// Only return the properties the connector needs
						jsonItems = jsonItems.map((item) => {
							let o = {
								id: item.id,
								title: item.title,
								itemType: item.itemType,
								contentType: item.mimeType,
								mimeType: item.mimeType, // TODO: Remove
							};
							if (item.attachments) {
								o.attachments = item.attachments.map((attachment) => {
									return {
										id: session.id + '_' + attachment.id, // TODO: Remove prefix
										title: attachment.title,
										contentType: attachment.contentType,
										mimeType: attachment.mimeType,  // TODO: Remove
									};
								});
							};
							return o;
						});
						resolve([201, "application/json", JSON.stringify({ items: jsonItems })]);
					}
				)
				// Add items to session once all attachments have been saved
				.then(function (items) {
					session.addItems(items);
				});
			}
			catch (e) {
				Zotero.logError(e);
				session.remove();
				resolve(500);
			}
		});
	}),
	
	saveItems: async function (session, target, requestData, onTopLevelItemsDone) {
		var { library, collection, editable } = Zotero.Server.Connector.resolveTarget(target);
		var data = requestData.data;
		var cookieSandbox = data.uri
			? new Zotero.CookieSandbox(
				null,
				data.uri,
				data.detailedCookies ? "" : data.cookie || "",
				requestData.headers["User-Agent"]
			)
			: null;
		if (cookieSandbox && data.detailedCookies) {
			cookieSandbox.addCookiesFromHeader(data.detailedCookies);
		}
		
		var id = 1;
		for (let item of data.items) {
			if (!item.id) {
				item.id = id++;
			}
			
			if (item.attachments) {
				for (let attachment of item.attachments) {
					attachment.id = id++;
					attachment.parent = item.id;
				}
			}
			
			// Add parent item to session progress without attachments, which are added later if
			// they're saved.
			let progressItem = Object.assign(
				{},
				item,
				{
					attachments: []
				}
			);
			session.onProgress(progressItem, 0);
		}
		
		var proxy = data.proxy && new Zotero.Proxy(data.proxy);
		
		// Save items
		var itemSaver = new Zotero.Translate.ItemSaver({
			libraryID: library.libraryID,
			collections: collection ? [collection.id] : undefined,
			attachmentMode: Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD,
			forceTagType: 1,
			referrer: data.uri,
			cookieSandbox,
			proxy
		});
		// This is a bit tricky. When saving items, the callback `onTopLevelItemsDone` will
		// return the HTTP request to the connector. Then it may spend some time fetching
		// PDFs. In the meantime, the connector will create a snapshot and send it along to
		// the `saveSingleFile` endpoint, which quickly adds the data to the session and
		// then saves the pending attachments, without removing them (we need them in case
		// the session switches libraries and we need to save again). So the pending
		// attachments exist and have already been saved by the time this `saveItems`
		// promise resolves and we continue executing. So we save the number of existing
		// attachments before that to prevent double saving.
		let hadPendingAttachments = session.pendingAttachments.length > 0;
		if (hadPendingAttachments) {
			// If we have pending attachments then we are saving again by switching to
			// a `filesEditable` library. So we clear the pendingAttachments since they
			// get added again right below here in `saveItems`
			session.pendingAttachments = [];
		}
		let items = await itemSaver.saveItems(
			data.items,
			function (attachment, progress, error) {
				session.onProgress(attachment, progress, error);
			},
			(itemsJSON, items) => {
				itemsJSON.forEach(item => session.onProgress(item, 100));
				if (onTopLevelItemsDone) onTopLevelItemsDone(itemsJSON, items);
			},
			function (parentItemID, attachment) {
				session.pendingAttachments.push([parentItemID, attachment]);
			}
		);
		if (hadPendingAttachments) {
			// If the session has snapshotContent already (from switching to a `filesEditable` library
			// then we can save `pendingAttachments` now
			if (data.snapshotContent) {
				await itemSaver.saveSnapshotAttachments(
					session.pendingAttachments,
					data.snapshotContent,
					function (attachment, progress, error) {
						session.onProgress(attachment, progress, error);
					},
				);
			}
			// This means SingleFile in the Connector failed and we need to just go
			// ahead and do our fallback save
			else if (data.singleFile === false) {
				itemSaver.saveSnapshotAttachments(
					session.pendingAttachments,
					false,
					function (attachment, progress, error) {
						session.onProgress(attachment, progress, error);
					},
				);
			}
			// Otherwise we are still waiting for SingleFile in Connector to finish
		}
		return items;
	}
}

/**
 * Attaches a singlefile attachment to an item saved with /saveItems or /saveSnapshot
 * If data.snapshotContent is empty, it means the save failed in the Connector
 * And we fallback to saving in Zotero
 *
 * Accepts:
 * 		sessionID
 * 		snapshotContent
 *		url - The URI of the page to be saved
 * 		title
 *		cookie - document.cookie or equivalent
 *		detailedCookies
 * 		proxy
 * Returns:
 *		Nothing (200 OK response)
 */
Zotero.Server.Connector.SaveSingleFile = function () {};
Zotero.Server.Endpoints["/connector/saveSingleFile"] = Zotero.Server.Connector.SaveSingleFile;
Zotero.Server.Connector.SaveSingleFile.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json", "multipart/form-data"],
	permitBookmarklet: true,

	/**
	 * Save SingleFile snapshot to pending attachments
	 */
	init: async function (requestData) {
		const { HiddenBrowser } = ChromeUtils.import('chrome://zotero/content/HiddenBrowser.jsm');

		// Retrieve payload
		let data = requestData.data;

		if (!data.sessionID) {
			return [400, "application/json", JSON.stringify({ error: "SESSION_ID_NOT_PROVIDED" })];
		}

		let session = Zotero.Server.Connector.SessionManager.get(data.sessionID);
		if (!session) {
			Zotero.debug("Can't find session " + data.sessionID, 1);
			return [400, "application/json", JSON.stringify({ error: "SESSION_NOT_FOUND" })];
		}

		let snapshotContent = data.snapshotContent;

		if (!snapshotContent) {
			// Connector SingleFile has failed so if we re-save attachments (via
			// updateSession) then we want to inform saveItems and saveSnapshot that they
			// do not need to use pendingAttachments because those have failed.
			session._requestData.data.singleFile = false;

			for (let [_parentItemID, attachment] of session.pendingAttachments) {
				session.onProgress(attachment, false);
			}

			return [200, 'text/plain', 'No snapshot content attached.'];
		}

		// Add to session data, in case `saveSnapshot` is called again by the session
		session.addSnapshotContent(snapshotContent);

		// We do this after adding to session because if we switch to a `filesEditable`
		// library we need to have access to the snapshotContent.
		let { library, collection } = Zotero.Server.Connector.getSaveTarget();
		if (!library.filesEditable) {
			session.savingDone = true;

			return [200, 'text/plain', 'Library is not editable.'];
		}

		// Retrieve all items in the session that need a snapshot
		if (session._action === 'saveSnapshot') {
			await Zotero.Promise.all(
				session.pendingAttachments.map((pendingAttachment) => {
					return Zotero.Attachments.importFromSnapshotContent({
						title: data.title,
						url: data.url,
						parentItemID: pendingAttachment[0],
						snapshotContent
					});
				})
			);
		}
		else if (session._action === 'saveItems') {
			var cookieSandbox = data.uri
				? new Zotero.CookieSandbox(
					null,
					data.uri,
					data.detailedCookies ? "" : data.cookie || "",
					requestData.headers["User-Agent"]
				)
				: null;
			if (cookieSandbox && data.detailedCookies) {
				cookieSandbox.addCookiesFromHeader(data.detailedCookies);
			}

			let proxy = data.proxy && new Zotero.Proxy(data.proxy);

			let itemSaver = new Zotero.Translate.ItemSaver({
				libraryID: library.libraryID,
				collections: collection ? [collection.id] : undefined,
				attachmentMode: Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD,
				forceTagType: 1,
				referrer: data.uri,
				cookieSandbox,
				proxy
			});

			await itemSaver.saveSnapshotAttachments(
				session.pendingAttachments,
				snapshotContent,
				function (attachment, progress, error) {
					session.onProgress(attachment, progress, error);
				},
			);
		}

		return 201;
	}
};

/**
 * Either creates a webpage item or a PDF/EPUB top-level item in Zotero
 * Called by the Connector when no translators are detected on the page
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
	init: async function (requestData) {
		var data = requestData.data;
		
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget();
		var targetID = collection ? collection.treeViewID : library.treeViewID;
		
		try {
			var session = Zotero.Server.Connector.SessionManager.create(
				data.sessionID,
				'saveSnapshot',
				requestData
			);
		}
		catch (e) {
			return [409, "application/json", JSON.stringify({ error: "SESSION_EXISTS" })];
		}
		await session.update(collection ? collection.treeViewID : library.treeViewID);
		
		// Shouldn't happen as long as My Library exists
		if (!library.editable) {
			Zotero.logError("Can't add item to read-only library " + library.name);
			return [500, "application/json", JSON.stringify({ libraryEditable: false })];
		}
		
		try {
			var item = await this.saveSnapshot(targetID, requestData);
			await session.addItem(item);
		}
		catch (e) {
			Zotero.logError(e);
			return 500;
		}
		
		let attachments = [];
		let hasAttachments = !item.isAttachment() && item.getAttachments().length;
		if (hasAttachments) {
			attachments = [{mimeType: "text/html", title: data.title, url: data.url}];
		}
		
		return [201,
			"application/json",
			JSON.stringify({ saveSingleFile: !data.skipSnapshot && !data.pdf && data.singleFile, attachments })];
	},
	
	/*
	 * Perform saving the snapshot
	 *
	 * Note: this function signature cannot change because it can also be called by
	 * updateSession (`Zotero.Server.Connector.SaveSession.prototype.update`).
	 */
	saveSnapshot: async function (target, requestData) {
		var { library, collection, editable } = Zotero.Server.Connector.resolveTarget(target);
		var libraryID = library.libraryID;
		var data = requestData.data;
		
		var cookieSandbox = data.url
			? new Zotero.CookieSandbox(
				null,
				data.url,
				data.detailedCookies ? "" : data.cookie || "",
				requestData.headers["User-Agent"]
			)
			: null;
		if (cookieSandbox && data.detailedCookies) {
			cookieSandbox.addCookiesFromHeader(data.detailedCookies);
		}
		
		if (data.pdf && library.filesEditable) {
			let item = await Zotero.Attachments.importFromURL({
				libraryID,
				url: data.url,
				referrer: data.referrer,
				collections: collection ? [collection.id] : undefined,
				contentType: "application/pdf",
				cookieSandbox
			});
			
			// Automatically recognize PDF/EPUB
			Zotero.RecognizeDocument.autoRecognizeItems([item]);
			
			return item;
		}
		
		if (data.html) {
			var parser = new DOMParser();
			var doc = parser.parseFromString(`<html>${data.html}</html>`, 'text/html');
			doc = Zotero.HTTP.wrapDocument(doc, data.url);
			var title = doc.title;
		} else {
			title = data.title || data.url;
		}
		
		// Create new webpage item
		let item = new Zotero.Item("webpage");
		item.libraryID = libraryID;
		item.setField("title", title);
		item.setField("url", data.url);
		item.setField("accessDate", "CURRENT_TIMESTAMP");
		if (collection) {
			item.setCollections([collection.id]);
		}
		var itemID = await item.saveTx();
		
		// Save snapshot
		if (!data.skipSnapshot) {
			// If called from session update, requestData may already have SingleFile data
			if (library.filesEditable && data.snapshotContent) {
				await Zotero.Attachments.importFromSnapshotContent({
					title: data.title,
					url: data.url,
					parentItemID: itemID,
					snapshotContent: data.snapshotContent
				});
			}
			// Otherwise, connector will POST SingleFile data at later time
			// We want this data regardless of `library.filesEditable` because if we
			// start on a non-filesEditable library and switch to one, we won't have a
			// pending attachment
			else if (data.hasOwnProperty('singleFile')) {
				let session = Zotero.Server.Connector.SessionManager.get(data.sessionID);
				session.pendingAttachments = [
					[itemID, { title: data.title, url: data.url }]
				];
			}
			else if (library.filesEditable) {
				// Old connector will not use SingleFile so importFromURL now
				await Zotero.Attachments.importFromURL({
					libraryID,
					url: data.url,
					referrer: data.referrer,
					title,
					parentItemID: itemID,
					contentType: "text/html",
					cookieSandbox
				});
			}
		}
		
		return item;
	}
};

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
	
	init: async function (requestData) {
		var data = requestData.data
		
		if (!data.sessionID) {
			return [400, "application/json", JSON.stringify({ error: "SESSION_ID_NOT_PROVIDED" })];
		}
		
		var session = Zotero.Server.Connector.SessionManager.get(data.sessionID);
		if (!session) {
			Zotero.debug("Can't find session " + data.sessionID, 1);
			return [400, "application/json", JSON.stringify({ error: "SESSION_NOT_FOUND" })];
		}
		
		// Parse treeViewID
		var [type, id] = [data.target[0], parseInt(data.target.substr(1))];
		var tags = data.tags;
		
		if (type == 'C') {
			let collection = await Zotero.Collections.getAsync(id);
			if (!collection) {
				return [400, "application/json", JSON.stringify({ error: "COLLECTION_NOT_FOUND" })];
			}
		}
		
		await session.update(data.target, tags);
		
		return [200, "application/json", JSON.stringify({})];
	}
};

Zotero.Server.Connector.SessionProgress = function() {};
Zotero.Server.Endpoints["/connector/sessionProgress"] = Zotero.Server.Connector.SessionProgress;
Zotero.Server.Connector.SessionProgress.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	init: async function (requestData) {
		var data = requestData.data
		
		if (!data.sessionID) {
			return [400, "application/json", JSON.stringify({ error: "SESSION_ID_NOT_PROVIDED" })];
		}
		
		var session = Zotero.Server.Connector.SessionManager.get(data.sessionID);
		if (!session) {
			Zotero.debug("Can't find session " + data.sessionID, 1);
			return [400, "application/json", JSON.stringify({ error: "SESSION_NOT_FOUND" })];
		}
		
		return [
			200,
			"application/json",
			JSON.stringify({
				items: session.getAllProgress()
					.map((item) => {
						var newItem = Object.assign({}, item);
						if (item.attachments) {
							newItem.attachments = item.attachments.map((attachment) => {
								return Object.assign(
									{},
									attachment,
									// Prefix id with 'sessionID_'
									// TODO: Remove this once support for /attachmentProgress is
									// removed and we stop prefixing the ids in the /saveItems
									// response
									{
										id: session.id + '_' + attachment.id
									}
								);
							});
						}
						return newItem;
					}),
				done: session.isSavingDone()
			})
		];
	}
};

Zotero.Server.Connector.DelaySync = function () {};
Zotero.Server.Endpoints["/connector/delaySync"] = Zotero.Server.Connector.DelaySync;
Zotero.Server.Connector.DelaySync.prototype = {
	supportedMethods: ["POST"],
	permitBookmarklet: true,
	
	init: function (requestData) {
		Zotero.Sync.Runner.delaySync(10000);
		return 204;
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
	
	init: async function (requestData) {
		let translate = new Zotero.Translate.Import();
		translate.setString(requestData.data);
		let translators = await translate.getTranslators();
		if (!translators || !translators.length) {
			return 400;
		}
		translate.setTranslator(translators[0]);
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget();
		var libraryID = library.libraryID;
		
		// Shouldn't happen as long as My Library exists
		if (!library.editable) {
			Zotero.logError("Can't import into read-only library " + library.name);
			return [500, "application/json", JSON.stringify({ libraryEditable: false })];
		}
		
		try {
			var session = Zotero.Server.Connector.SessionManager.create(requestData.searchParams.get('session'));
		}
		catch (e) {
			return [409, "application/json", JSON.stringify({ error: "SESSION_EXISTS" })];
		}
		await session.update(collection ? collection.treeViewID : library.treeViewID);
		
		let items = await translate.translate({
			libraryID,
			collections: collection ? [collection.id] : null,
			forceTagType: 1,
			// Import translation skips selection by default, so force it to occur
			saveOptions: {
				skipSelect: false
			}
		});
		session.addItems(items);
		
		return [201, "application/json", JSON.stringify(items)];
	}
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
	
	init: Zotero.Promise.coroutine(function* (requestData) {
		try {
			var { styleTitle, styleID } = yield Zotero.Styles.install(
				requestData.data, requestData.searchParams.get('origin') || null, true
			);
		} catch (e) {
			return [400, "text/plain", e.message];
		}
		return [201, "application/json", JSON.stringify({name: styleTitle})];
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
		Zotero.Translators.getCodeForTranslator(translator).then(function(code) {
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
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget(true);
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
			
			// Add recent: true for recent targets
			
			collections.push(
				{
					id: library.treeViewID,
					name: library.name,
					level: 0
				},
				...Zotero.Collections.getByLibrary(library.libraryID, true).map(c => ({
					id: c.treeViewID,
					name: c.name,
					level: c.level + 1 || 1 // Added by Zotero.Collections._getByContainer()
				}))
			);
		}
		response.targets = collections;
		
		// Mark recent targets
		try {
			let recents = Zotero.Prefs.get('recentSaveTargets');
			if (recents) {
				recents = new Set(JSON.parse(recents).map(o => o.id));
				for (let target of response.targets) {
					if (recents.has(target.id)) {
						target.recent = true;
					}
				}
			}
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.Prefs.clear('recentSaveTargets');
		}
		
		sendResponseCallback(
			200,
			"application/json",
			JSON.stringify(response),
			{
				// Filter out collection names in debug output
				logFilter: function (str) {
					try {
						let json = JSON.parse(str.match(/^{"libraryID"[^]+/m)[0]);
						json.targets.forEach(t => t.name = "\u2026");
						return JSON.stringify(json);
					}
					catch (e) {
						return str;
					}
				}
			}
		);
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
	init: Zotero.Promise.coroutine(function* (requestData) {
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
	init: async function (req) {
		if (req.method == 'GET') {
			return [200, "text/html", '<!DOCTYPE html><html>'
				+ '<body>Zotero is running</body></html>'];
		} else {
			// Store the active URL so it can be used for site-specific Quick Copy
			if (req.data.activeURL) {
				//Zotero.debug("Setting active URL to " + req.data.activeURL);
				Zotero.QuickCopy.lastActiveURL = req.data.activeURL;
			}
			let translatorsHash = await Zotero.Translators.getTranslatorsHash(false);
			let sortedTranslatorHash = await Zotero.Translators.getTranslatorsHash(true);
			
			let response = {
				prefs: {
					automaticSnapshots: Zotero.Prefs.get('automaticSnapshots'),
					googleDocsAddNoteEnabled: true,
					translatorsHash,
					sortedTranslatorHash
				}
			};
			if (Zotero.QuickCopy.hasSiteSettings()) {
				response.prefs.reportActiveURL = true;
			}
			
			this.versionWarning(req);
			
			return [200, 'application/json', JSON.stringify(response)];
		}
	},
	
	
	/**
	 * Warn on outdated connector version
	 *
	 * We can remove this once the connector checks and warns on its own and most people are on
	 * a version that does that.
	 */
	versionWarning: function (req) {
		try {
			if (!Zotero.Prefs.get('showConnectorVersionWarning')) return;
			if (!req.headers) return;
			
			var minVersion = ZOTERO_CONFIG.CONNECTOR_MIN_VERSION;
			var appName = ZOTERO_CONFIG.CLIENT_NAME;
			var domain = ZOTERO_CONFIG.DOMAIN_NAME;
			var origin = req.headers.Origin;
			
			var browser;
			var message;
			var showDownloadButton = false;
			// Legacy Safari extension
			if (origin && origin.startsWith('safari-extension')) {
				browser = 'safari';
				message = `An update is available for the ${appName} Connector for Safari.\n\n`
					+ 'You can upgrade from the Extensions pane of the Safari preferences.';
			}
			else if (origin && origin.startsWith('chrome-extension')) {
				browser = 'chrome';
				message = `An update is available for the ${appName} Connector for Chrome.\n\n`
					+ `You can upgrade to the latest version from ${domain}.`;
				showDownloadButton = true;
			}
			else if (req.headers['User-Agent'] && req.headers['User-Agent'].includes('Firefox/')) {
				browser = 'firefox';
				message = `An update is available for the ${appName} Connector for Firefox.\n\n`
					+ `You can upgrade to the latest version from ${domain}.`;
				showDownloadButton = true;
			}
			// Safari App Extension is always up to date
			else if (req.headers['User-Agent'] && req.headers['User-Agent'].includes('Safari/')) {
				return;
			}
			else {
				Zotero.debug("Unknown browser");
				return;
			}
			
			if (Zotero.Server.Connector['skipVersionWarning-' + browser]) return;
			
			var version = req.headers['X-Zotero-Version'];
			if (!version || version == '4.999.0') return;
			
			// If connector is up to date, bail
			if (Services.vc.compare(version, minVersion) >= 0) return;
			
			var showNextPref = `nextConnectorVersionWarning.${browser}`;
			var showNext = Zotero.Prefs.get(showNextPref);
			if (showNext && new Date() < new Date(showNext * 1000)) return;
			
			// Don't show again for this browser until restart
			Zotero.Server.Connector['skipVersionWarning-' + browser] = true;
			var ps = Services.prompt;
			var buttonFlags;
			if (showDownloadButton) {
				buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
					+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
			}
			else {
				buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK;
			}
			setTimeout(function () {
				var dontShow = {};
				var index = ps.confirmEx(null,
					Zotero.getString('general.updateAvailable'),
					message,
					buttonFlags,
					showDownloadButton ? Zotero.getString('general.upgrade') : null,
					showDownloadButton ? Zotero.getString('general.notNow') : null,
					null,
					"Don\u0027t show again for a month",
					dontShow
				);
				
				var nextShowDays;
				if (dontShow.value) {
					nextShowDays = 30;
				}
				// Don't show again for at least a day, even after a restart
				else {
					nextShowDays = 1;
				}
				Zotero.Prefs.set(showNextPref, Math.round(Date.now() / 1000) + 86400 * nextShowDays);
				
				if (showDownloadButton && index == 0) {
					Zotero.launchURL(ZOTERO_CONFIG.CONNECTORS_URL);
				}
			}, 500);
		}
		catch (e) {
			Zotero.debug(e, 2);
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

/**
 * Make an HTTP request from the client. Accepts {@link Zotero.HTTP.request} options and returns a minimal response
 * object with the same form as the one returned from {@link Zotero.Utilities.Translate#request}.
 *
 * Accepts:
 *		method - The request method ('GET', 'POST', etc.)
 *		url - The URL to make the request to. Must be an absolute HTTP(S) URL.
 *		options - See Zotero.HTTP.request() documentation. Differences:
 *			- responseType is always set to 'text'
 *			- successCodes is always set to false (non-2xx status codes will not trigger an error)
 * Returns:
 *		Response code is always 200. Body contains:
 *			status - The response status code, as a number
 *			headers - An object mapping header names to values
 *			body - The response body, as a string
 */
Zotero.Server.Connector.Request = function () {};

/**
 * The list of allowed hosts. Intentionally hardcoded.
 */
Zotero.Server.Connector.Request.allowedHosts = ['www.worldcat.org'];

/**
 * For testing: allow disabling validation so we can make requests to the server.
 */
Zotero.Server.Connector.Request.enableValidation = false;

Zotero.Server.Endpoints["/connector/request"] = Zotero.Server.Connector.Request;
Zotero.Server.Connector.Request.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],

	init: async function (req) {
		let { method, url, options } = req.data;
		
		if (typeof method !== 'string' || typeof url !== 'string') {
			return [400, 'text/plain', 'method and url are required and must be strings'];
		}
		
		let uri;
		try {
			uri = Services.io.newURI(url);
		}
		catch (e) {
			return [400, 'text/plain', 'Invalid URL'];
		}
		
		if (uri.scheme != 'http' && uri.scheme != 'https') {
			return [400, 'text/plain', 'Unsupported scheme'];
		}

		if (Zotero.Server.Connector.Request.enableValidation) {
			if (!Zotero.Server.Connector.Request.allowedHosts.includes(uri.host)) {
				return [
					400,
					'text/plain',
					'Unsupported URL'
				];
			}

			if (!req.headers['User-Agent'] || !req.headers['User-Agent'].startsWith('Mozilla/')) {
				return [400, 'text/plain', 'Unsupported User-Agent'];
			}
		}
		
		options = options || {};
		options.responseType = 'text';
		options.successCodes = false;
		
		let xhr;
		try {
			xhr = await Zotero.HTTP.request(req.data.method, req.data.url, options);
		}
		catch (e) {
			if (e instanceof Zotero.HTTP.BrowserOfflineException) {
				return [503, 'text/plain', 'Client is offline'];
			}
			else {
				throw e;
			}
		}

		let status = xhr.status;
		let headers = {};
		xhr.getAllResponseHeaders()
			.trim()
			.split(/[\r\n]+/)
			.map(line => line.split(': '))
			.forEach(parts => headers[parts.shift()] = parts.join(': '));
		let body = xhr.response;

		return [200, 'application/json', JSON.stringify({
			status,
			headers,
			body
		})];
	}
};
