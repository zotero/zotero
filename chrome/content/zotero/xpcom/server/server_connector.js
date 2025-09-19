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
const CONNECTOR_API_VERSION = 3;

Zotero.Server.Connector = {
	_waitingForSelection: {},
	
	getSaveTarget: function (allowReadOnly, allowFilesReadOnly=true) {
		var zp = Zotero.getActiveZoteroPane();
		var library = null;
		var collection = null;
		var editable = null;
		
		if (zp && zp.collectionsView) {
			if (allowReadOnly || zp.collectionsView.editable && allowFilesReadOnly || zp.collectionsView.filesEditable) {
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
	},

	/**
	 * Warn on outdated connector version
	 */
	versionWarning: function (req, force=false) {
		try {
			if (!force) {
				if (!Zotero.Prefs.get('showConnectorVersionWarning')) return;
				if (Zotero.Server.Connector.skipVersionWarning) return;
			}
			if (!req.headers || !req.headers['X-Zotero-Connector-API-Version']) return;
			
			const appName = ZOTERO_CONFIG.CLIENT_NAME;
			const domain = ZOTERO_CONFIG.DOMAIN_NAME;
			
			const apiVersion = req.headers['X-Zotero-Connector-API-Version'];
			// We are up to date
			if (apiVersion >= CONNECTOR_API_VERSION) return;
			
			var message = Zotero.getString("connector-version-warning");
			
			if (!force) {
				var showNext = Zotero.Prefs.get('nextConnectorVersionWarning');
				if (showNext && new Date() < new Date(showNext * 1000)) return;
			}
			
			// Don't show again for this browser until restart (unless forced)
			Zotero.Server.Connector.skipVersionWarning = true;
			setTimeout(function () {
				if (this.versionWarningShowing) return;
				
				var remindLater = {};
				let options = {
					title: Zotero.getString('general.updateAvailable'),
					text: message,
					button0: Zotero.getString('general.upgrade'),
					button1: Zotero.getString('general.notNow'),
				}
				if (!force) {
					const SHOW_AGAIN_DAYS = 7;
					options.checkLabel = Zotero.getString(
						'general.dontShowAgainFor',
						SHOW_AGAIN_DAYS,
						SHOW_AGAIN_DAYS
					);
					options.checkbox = remindLater;
				}
				this.versionWarningShowing = true;
				const index = Zotero.Prompt.confirm(options)
				this.versionWarningShowing = false;
				
				var nextShowDays;
				// Remind in a week if checked remind me later
				if (remindLater.value) {
					nextShowDays = 7;
				}
				// Don't show again for at least a day, even after a restart
				else {
					nextShowDays = 1;
				}
				Zotero.Prefs.set('nextConnectorVersionWarning', Math.round(Date.now() / 1000) + 24*60*60 * nextShowDays);
				
				if (index == 0) {
					Zotero.launchURL(ZOTERO_CONFIG.CONNECTORS_URL);
				}
			}.bind(this), 0);

			return [400, "application/json", JSON.stringify({ error: "CONNECTOR_VERSION_OUTDATED" })];
		}
		catch (e) {
			Zotero.debug(e, 2);
		}
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
Zotero.Server.Connector.GetTranslators = function () {};
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
	init: function (data, sendResponseCallback) {
		// Translator data
		var me = this;
		if(data.url) {
			Zotero.Translators.getWebTranslatorsForLocation(data.url, data.url).then(function (data) {
				sendResponseCallback(200, "application/json",
						JSON.stringify(me._serializeTranslators(data[0])));
			});
		} else {
			Zotero.Translators.getAll().then(function (translators) {
				var responseData = me._serializeTranslators(translators);
				sendResponseCallback(200, "application/json", JSON.stringify(responseData));
			}).catch(function (e) {
				sendResponseCallback(500);
				throw e;
			});
		}
	},
	
	_serializeTranslators: function (translators) {
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
Zotero.Server.Connector.Detect = function () {};
Zotero.Server.Endpoints["/connector/detect"] = Zotero.Server.Connector.Detect;
Zotero.Server.Connector.Detect.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Loads HTML into a hidden browser and initiates translator detection
	 */
	init: async function (requestData) {
		try {
			var translators = await this.getTranslators(requestData);
		} catch (e) {
			Zotero.logError(e);
			return 500;
		}
		
		translators = translators.map(function (translator) {
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
 * Saves items to DB
 *
 * Accepts:
 *		items - an array of JSON format items
 * Returns:
 *		201 response code with item in body.
 */
Zotero.Server.Connector.SaveItems = function () {};
Zotero.Server.Endpoints["/connector/saveItems"] = Zotero.Server.Connector.SaveItems;
Zotero.Server.Connector.SaveItems.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Either loads HTML into a hidden browser and initiates translation, or saves items directly
	 * to the database
	 */
	init: async function (requestData) {
		const response = Zotero.Server.Connector.versionWarning(requestData, true);
		if (response) {
			return response;
		}
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
			let session = Zotero.Server.Connector.SessionManager.get(data.sessionID);
			Zotero.debug(e);
			return [409, "application/json", JSON.stringify({ error: session?.cancelled ? "SESSION_CANCELLED" : "SESSION_EXISTS" })];
		}
		await session.update(targetID);
		
		// Shouldn't happen as long as My Library exists
		if (!library.editable) {
			Zotero.logError("Can't add item to read-only library " + library.name);
			return [500, "application/json", JSON.stringify({ libraryEditable: false })];
		}
		
		try {
			await session.saveItems(targetID);
			return [201, "application/json"];
		}
		catch (e) {
			Zotero.logError(e);
			session.remove();
			return 500;
		}
	},
}

/**
 * Gets the top-level item created for a standalone attachment
 *
 * Accepts:
 *		sessionID - A session ID previously passed to /saveItems
 * Returns:
 * 		200
 */
Zotero.Server.Connector.GetRecognizedItem = function () {};
Zotero.Server.Endpoints["/connector/getRecognizedItem"] = Zotero.Server.Connector.GetRecognizedItem;
Zotero.Server.Connector.GetRecognizedItem.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["*"],
	permitBookmarklet: true,

	init: async function (requestData) {
		const sessionID = requestData.data.sessionID;
		if (!sessionID) {
			return [400, "application/json", JSON.stringify({ error: "SESSION_ID_NOT_PROVIDED" })];
		}
		
		const session = Zotero.Server.Connector.SessionManager.get(sessionID);
		if (!session) {
			Zotero.debug("Can't find session " + sessionID, 1);
			return [400, "application/json", JSON.stringify({ error: "SESSION_NOT_FOUND" })];
		}
		
		await session.autoRecognizePromise;
		let item = session.getRecognizedItem();
		if (!item) {
			return 204;
		}
		let jsonItem = {
			title: item.getDisplayTitle(),
			itemType: item.itemType,
		};
		return [200, "application/json", JSON.stringify({ ...jsonItem })];
	}
};


/**
 * Saves a standalone attachment
 *
 * URI params:
 *		sessionID
 * Expected headers:
 * 		X-Metadata:
 * 			- parentItemID
 * 			- title
 * 			- url
 * Returns:
 * 		400 - Bad params
 * 		200 - Non-writable library
 * 		201 - Created
 */
Zotero.Server.Connector.SaveStandaloneAttachment = function () {};
Zotero.Server.Endpoints["/connector/saveStandaloneAttachment"] = Zotero.Server.Connector.SaveStandaloneAttachment;
Zotero.Server.Connector.SaveStandaloneAttachment.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["*"],
	permitBookmarklet: true,

	init: async function (requestData) {
		// Retrieve payload
		if (!requestData.headers['X-Metadata']) {
			return [400, "application/json", JSON.stringify({ error: "METADATA_NOT_PROVIDED" })];
		}
		const metadata = JSON.parse(requestData.headers['X-Metadata']);

		const sessionID = metadata.sessionID || requestData.searchParams.get('sessionID');
		if (!sessionID) {
			return [400, "application/json", JSON.stringify({ error: "SESSION_ID_NOT_PROVIDED" })];
		}
		var { library, collection } = Zotero.Server.Connector.getSaveTarget(false, false);
		var libraryID = library.libraryID;
		var targetID = collection ? collection.treeViewID : library.treeViewID;

		try {
			var session = Zotero.Server.Connector.SessionManager.create(
				sessionID,
				'saveStandaloneAttachment',
				requestData
			);
		}
		catch (e) {
			return [409, "application/json", JSON.stringify({ error: "SESSION_EXISTS" })];
		}
		await session.update(targetID);

		// Save standalone attachment from stream
		let item = await Zotero.Attachments.importFromNetworkStream({
			url: metadata.url,
			libraryID,
			collections: collection ? [collection.id] : undefined,
			title: metadata.title,
			contentType: requestData.headers['Content-Type'],
			stream: requestData.data,
			byteCount: requestData.headers['Content-Length'],
		});
		session.addItem(metadata.url, item);
		
		let canRecognize = Zotero.RecognizeDocument.canRecognize(item);
		if (canRecognize) {
			// Automatically recognize PDF/EPUB
			session.autoRecognizePromise = Zotero.RecognizeDocument.autoRecognizeItems([item]);
		}
		return [201, "application/json", JSON.stringify({ canRecognize })];
	}
};

/**
 * Attaches an PDF/EPUB attachment to an item saved with /saveItems or /saveSnapshot
 *
 * URI params:
 *		sessionID
 * Expected headers:
 * 		X-Metadata:
 * 			- parentItemID
 * 			- title
 * 			- url
 * Returns:
 * 		400 - Bad params
 * 		200 - Non-writable library
 * 		201 - Created
 */
Zotero.Server.Connector.SaveAttachment = function () {};
Zotero.Server.Endpoints["/connector/saveAttachment"] = Zotero.Server.Connector.SaveAttachment;
Zotero.Server.Connector.SaveAttachment.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["*"],
	permitBookmarklet: true,

	init: async function (requestData) {
		// Retrieve payload
		if (!requestData.headers['X-Metadata']) {
			return [400, "application/json", JSON.stringify({ error: "METADATA_NOT_PROVIDED" })];
		}
		const metadata = JSON.parse(requestData.headers['X-Metadata']);
		
		const sessionID = metadata.sessionID || requestData.searchParams.get('sessionID');
		if (!sessionID) {
			return [400, "application/json", JSON.stringify({ error: "SESSION_ID_NOT_PROVIDED" })];
		}

		let session = Zotero.Server.Connector.SessionManager.get(sessionID);
		if (!session) {
			Zotero.debug("Can't find session " + sessionID, 1);
			return [400, "application/json", JSON.stringify({ error: "SESSION_NOT_FOUND" })];
		}
		
		let { library } = Zotero.Server.Connector.getSaveTarget();
		if (!library.filesEditable) {
			return [200, 'text/plain', 'Library files are not editable.'];
		}

		if (session.cancelled) {
			Zotero.debug("Session is cancelled: " + session.sessionID, 1);
			return [409, "application/json", JSON.stringify({ error: "SESSION_CANCELLED" })];
		}
		// Save attachment based on provided parent id from stream
		let parentItem = session.getItemByConnectorKey(metadata.parentItemID);
		await Zotero.Attachments.importFromNetworkStream({
			url: metadata.url,
			parentItemID: parentItem.id,
			title: metadata.title,
			contentType: requestData.headers['Content-Type'],
			stream: requestData.data,
			byteCount: requestData.headers['Content-Length'],
		});

		return 201;
	}
};


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
		if (session.cancelled) {
			Zotero.debug("Session is cancelled: " + data.sessionID, 1);
			return [409, "application/json", JSON.stringify({ error: "SESSION_CANCELLED" })];
		}

		let { library } = Zotero.Server.Connector.getSaveTarget();
		if (!library.filesEditable) {
			return [200, 'text/plain', 'Library files are not editable.'];
		}

		// We only save the snapshot in single-item cases
		if (session._action === 'saveSnapshot') {
			const parentItemID = session.getItemByConnectorKey(data.url).id;
			// Just saves the snapshot straight up
			await Zotero.Attachments.importFromSnapshotContent({
				title: data.title,
				url: data.url,
				parentItemID,
				snapshotContent: data.snapshotContent
			});
		}
		else if (session._action === 'saveItems') {
			const parentItemID = session.getItemByConnectorKey(data.items[0].id).id;
			// Deproxifies and does some other attachment preprocessing
			await session.itemSaver.saveSnapshotAttachments({
				title: data.title,
				url: data.url,
				parentItemID,
				snapshotContent: data.snapshotContent
			});
		}

		return 201;
	}
};

/**
 * Creates a webpage item top-level item in Zotero
 * Called by the Connector when no translators are detected on the page
 *
 * Accepts:
 *		uri - The URI of the page to be saved
 *		html - document.innerHTML or equivalent
 *		cookie - document.cookie or equivalent
 * Returns:
 *		Nothing (200 OK response)
 */
Zotero.Server.Connector.SaveSnapshot = function () {};
Zotero.Server.Endpoints["/connector/saveSnapshot"] = Zotero.Server.Connector.SaveSnapshot;
Zotero.Server.Connector.SaveSnapshot.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	/**
	 * Save snapshot
	 */
	init: async function (requestData) {
		const response = Zotero.Server.Connector.versionWarning(requestData, true);
		if (response) {
			return response;
		}

		var data = requestData.data;
		
		var { library, collection } = Zotero.Server.Connector.getSaveTarget();
		var targetID = collection ? collection.treeViewID : library.treeViewID;
		
		try {
			var session = Zotero.Server.Connector.SessionManager.create(
				data.sessionID,
				'saveSnapshot',
				requestData
			);
		}
		catch (e) {
			let session = Zotero.Server.Connector.SessionManager.get(data.sessionID);
			Zotero.debug(e);
			return [409, "application/json", JSON.stringify({ error: session?.cancelled ? "SESSION_CANCELLED" : "SESSION_EXISTS" })];
		}
		await session.update(collection ? collection.treeViewID : library.treeViewID);
		
		// Shouldn't happen as long as My Library exists
		if (!library.editable) {
			Zotero.logError("Can't add item to read-only library " + library.name);
			return [500, "application/json", JSON.stringify({ libraryEditable: false })];
		}
		
		try {
			await session.saveSnapshot(targetID);
		}
		catch (e) {
			Zotero.logError(e);
			return 500;
		}
		
		return [201, "application/json"];
	}
};


/**
 * Checks if the item has OA attachments (in case PDF saving in connector failed).
 * Also checks custom resolvers.
 * 
 * Accepts:
 *		sessionID - A session ID previously passed to /saveItems
 *		itemID - The ID of the item to save alternative attachment for
 */
Zotero.Server.Connector.HasAttachmentResolvers = function () {};
Zotero.Server.Endpoints["/connector/hasAttachmentResolvers"] = Zotero.Server.Connector.HasAttachmentResolvers;
Zotero.Server.Connector.HasAttachmentResolvers.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	init: async function (requestData) {
		let data = requestData.data;
		let session = Zotero.Server.Connector.SessionManager.get(data.sessionID);
		if (!session) {
			Zotero.debug("Can't find session " + data.sessionID, 1);
			return [400, "application/json", JSON.stringify({ error: "SESSION_NOT_FOUND" })];
		}
		let item = session.getItemByConnectorKey(data.itemID);
		let resolvers = Zotero.Attachments.getFileResolvers(item, ['oa', 'custom'], true);
		return [200, "application/json", JSON.stringify(resolvers.length > 0)];
	}
}


/**
 * Accepts:
 *		sessionID - A session ID previously passed to /saveItems
 *		itemID - The ID of the item to save alternative attachment for
 *
 * Returns:
 * 		400 - Bad params
 * 		201 - Created and attachment title
 * 		500 - Failed to save
 */
Zotero.Server.Connector.SaveAttachmentFromResolver = function () {};
Zotero.Server.Endpoints["/connector/saveAttachmentFromResolver"] = Zotero.Server.Connector.SaveAttachmentFromResolver;
Zotero.Server.Connector.SaveAttachmentFromResolver.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	init: async function (requestData) {
		let data = requestData.data;
		let session = Zotero.Server.Connector.SessionManager.get(data.sessionID);
		if (!session) {
			Zotero.debug("Can't find session " + data.sessionID, 1);
			return [400, "application/json", JSON.stringify({ error: "SESSION_NOT_FOUND" })];
		}
		let item = session.getItemByConnectorKey(data.itemID);
		let resolvers = Zotero.Attachments.getFileResolvers(item, ['oa', 'custom'], true);

		let attachment = await Zotero.Attachments.addFileFromURLs(item, resolvers);

		if (attachment) {
			return [201, "text/plain", attachment.getDisplayTitle()];
		}
		else {
			return [500, "text/plain", "Failed to save an attachment"];
		}
	}
}

/**
 *
 *
 * Accepts:
 *		sessionID - A session ID previously passed to /saveItems
 *		target - A treeViewID (L1, C23, etc.) for the library or collection to save to
 *		tags - A string of tags separated by commas
 *		note - A string to turn into a child note
 *
 * Returns:
 *		200 response on successful change
 *		400 on error with 'error' property in JSON
 */
Zotero.Server.Connector.UpdateSession = function () {};
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
		if (session.cancelled) {
			Zotero.debug("Session is cancelled: " + session.sessionID, 1);
			return [409, "application/json", JSON.stringify({ error: "SESSION_CANCELLED" })];
		}
		
		// Parse treeViewID
		var [type, id] = [data.target[0], parseInt(data.target.substr(1))];
		var tags = data.tags;
		// Older connector versions send tags as one string with comma as delimiter
		// To account for tags that contain commas, later versions send an array of strings
		if (typeof tags === 'string') {
			tags = tags.split(",");
		}
		var note = data.note;
		
		if (type == 'C') {
			let collection = await Zotero.Collections.getAsync(id);
			if (!collection) {
				return [400, "application/json", JSON.stringify({ error: "COLLECTION_NOT_FOUND" })];
			}
		}
		
		await session.update(data.target, tags, note);
		
		return [200, "application/json", JSON.stringify({})];
	}
};

/**
 *
 *
 * Accepts:
 *		sessionID - A session ID
 *
 * Returns:
 *		200 response if the session is cancelled
 *		400 if the session ID is not provided
 */
Zotero.Server.Connector.CancelSession = function() {};
Zotero.Server.Endpoints["/connector/cancelSession"] = Zotero.Server.Connector.CancelSession;
Zotero.Server.Connector.CancelSession.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	
	init: async function (requestData) {
		var data = requestData.data;
		
		if (!data.sessionID) {
			return [400, "application/json", JSON.stringify({ error: "SESSION_ID_NOT_PROVIDED" })];
		}
		
		var session = Zotero.Server.Connector.SessionManager.get(data.sessionID);
		// If the session with the specified ID does not exist, create it here so
		// we can record it as cancelled.
		if (!session) {
			session = Zotero.Server.Connector.SessionManager.create(data.sessionID);
		}
		// After a session is cancelled, all items added are removed and
		// subsequent child attachments/notes should no longer be added.
		// To handle any possible race conditions (e.g. if an item is being added at the same time as
		// the session is being cancelled), wait a second and try to clear any remaining items again.
		await session.cancel();
		setTimeout(() => {
			session.cancel();
		}, 1000);
		
		return [200, "application/json", JSON.stringify({})];
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
 
Zotero.Server.Connector.Import = function () {};
Zotero.Server.Endpoints["/connector/import"] = Zotero.Server.Connector.Import;
Zotero.Server.Connector.Import.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: '*',
	permitBookmarklet: false,
	
	init: async function (requestData) {
		let dataString = requestData.data;
		if (requestData.data instanceof Ci.nsIInputStream) {
			dataString = Zotero.Server.networkStreamToString(dataString, requestData.headers['content-length']);
		}
		let translate = new Zotero.Translate.Import();
		translate.setString(dataString);
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
			Zotero.debug(e);
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
		items.forEach((item, index) => {
			session.addItem(items[index].id, item);
		});
		
		return [201, "application/json", JSON.stringify(items)];
	}
}

/**
 * Install CSL styles
 * 	
 * Returns:
 * 	- {name: styleName}
 */
 
Zotero.Server.Connector.InstallStyle = function () {};
Zotero.Server.Endpoints["/connector/installStyle"] = Zotero.Server.Connector.InstallStyle;
Zotero.Server.Connector.InstallStyle.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: '*',
	permitBookmarklet: false,
	
	init: async function (requestData) {
		let dataString = requestData.data;
		if (requestData.data instanceof Ci.nsIInputStream) {
			dataString = Zotero.Server.networkStreamToString(dataString, requestData.headers['content-length']);
		}
		try {
			var { styleTitle } = await Zotero.Styles.install(
				dataString, requestData.searchParams.get('origin') || null, true
			);
		} catch (e) {
			return [400, "text/plain", e.message];
		}
		return [201, "application/json", JSON.stringify({name: styleTitle})];
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
Zotero.Server.Connector.GetTranslatorCode = function () {};
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
	init: function (postData, sendResponseCallback) {
		var translator = Zotero.Translators.get(postData.translatorID);
		Zotero.Translators.getCodeForTranslator(translator).then(function (code) {
			sendResponseCallback(200, "application/javascript", code);
		});
	}
}

/**
 * Returns the full serialized collection tree (excluding non-editable libraries)
 * and the selected collection tree item.
 *
 * Accepts:
 *		Nothing
 * Returns:
 *		libraryID
 *      libraryName
 *      collectionID
 *      collectionName
 */
Zotero.Server.Connector.GetSelectedCollection = function () {};
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
	init: async function (postData, sendResponseCallback) {
		let allowReadOnly = (postData.hasOwnProperty("switchToReadableLibrary")) ? !postData.switchToReadableLibrary : true;
		var { library, collection, editable } = Zotero.Server.Connector.getSaveTarget(allowReadOnly);
		var response = {
			libraryID: library.libraryID,
			libraryName: library.name,
			libraryEditable: library.editable,
			filesEditable: library.filesEditable,
			editable
		};
		
		if(collection && collection.id) {
			response.id = collection.id;
			response.name = collection.name;
		} else {
			response.id = null;
			response.name = response.libraryName;
		}
		
		// Get list of editable libraries, collections, and tags
		var collections = [];
		let tags = {};
		var originalLibraryID = library.libraryID;
		for (let library of Zotero.Libraries.getAll()) {
			if (!library.editable) continue;
			
			tags[library.treeViewID] = await Zotero.Tags.getAll(library.libraryID);
			// Add recent: true for recent targets
			
			collections.push(
				{
					id: library.treeViewID,
					name: library.name,
					filesEditable: library.filesEditable,
					level: 0,
					isUserLibrary: Zotero.Libraries.userLibraryID == library.libraryID,
				},
				...Zotero.Collections.getByLibrary(library.libraryID, true).map(c => ({
					id: c.treeViewID,
					name: c.name,
					filesEditable: library.filesEditable,
					level: c.level + 1 || 1 // Added by Zotero.Collections._getByContainer()
				}))
			);
		}
		response.targets = collections;
		response.tags = tags;
		
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
Zotero.Server.Connector.GetClientHostnames = function () {};
Zotero.Server.Endpoints["/connector/getClientHostnames"] = Zotero.Server.Connector.GetClientHostnames;
Zotero.Server.Connector.GetClientHostnames.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: false,
	
	/**
	 * Returns a 200 response to say the server is alive
	 */
	init: async function (requestData) {
		try {
			var hostnames = await Zotero.Proxies.DNS.getHostnames();
		} catch(e) {
			return 500;
		}
		return [200, "application/json", JSON.stringify(hostnames)];
	}
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
Zotero.Server.Connector.Proxies = function () {};
Zotero.Server.Endpoints["/connector/proxies"] = Zotero.Server.Connector.Proxies;
Zotero.Server.Connector.Proxies.prototype = {
	supportedMethods: ["POST"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: false,
	
	/**
	 * Returns a 200 response to say the server is alive
	 */
	init: async function () {
		let proxies = Zotero.Proxies.proxies.map((p) => Object.assign(p.toJSON(), {hosts: p.hosts}));
		return [200, "application/json", JSON.stringify(proxies)];
	}
};


/**
 * Test connection
 *
 * Accepts:
 *		Nothing
 * Returns:
 *		Nothing (200 OK response)
 */
Zotero.Server.Connector.Ping = function () {};
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
					downloadAssociatedFiles: Zotero.Prefs.get("downloadAssociatedFiles"),
					supportsAttachmentUpload: true,
					supportsTagsAutocomplete: true,
					googleDocsAddNoteEnabled: true,
					canUserAddNote: true,
					supportsSaveCancelling: true,
					googleDocsCitationExplorerEnabled: false,
					translatorsHash,
					sortedTranslatorHash
				}
			};
			if (Zotero.QuickCopy.hasSiteSettings()) {
				response.prefs.reportActiveURL = true;
			}
			
			Zotero.Server.Connector.versionWarning(req);
			
			return [200, 'application/json', JSON.stringify(response)];
		}
	},
	
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
			Zotero.debug(`${JSON.stringify(req.headers)}`, 1);
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
