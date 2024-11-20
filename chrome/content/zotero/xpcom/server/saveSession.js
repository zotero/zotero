/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
					Vienna, Virginia, USA
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

Zotero.Server.Connector.SessionManager = {
	_sessions: new Map(),

	get: function (id) {
		return this._sessions.get(id);
	},

	create: function (id, action, requestData) {
		if (typeof id === 'undefined') {
			id = Zotero.Utilities.randomString();
		}
		if (this._sessions.has(id)) {
			throw new Error(`Session ID ${id} exists`);
		}
		Zotero.debug(`Creating connector save session ${id}`);
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



Zotero.Server.Connector.SaveSession = class {
	constructor(id, action, requestData) {
		this.id = id;
		this.created = new Date();
		this._action = action;
		this._requestData = requestData;
		this._items = {};
		
		this._progressItems = {};
		this._orderedProgressItems = [];
	}

	async saveItems(target) {
		var { library, collection } = Zotero.Server.Connector.resolveTarget(target);
		var data = this._requestData.data;
		var headers = this._requestData.headers;
		var cookieSandbox = data.uri
			? new Zotero.CookieSandbox(
				null,
				data.uri,
				data.detailedCookies ? "" : data.cookie || "",
				headers["User-Agent"]
			)
			: null;
		if (cookieSandbox && data.detailedCookies) {
			cookieSandbox.addCookiesFromHeader(data.detailedCookies);
		}
		
		var proxy = data.proxy && new Zotero.Proxy(data.proxy);
		
		this.itemSaver = new Zotero.Translate.ItemSaver({
			libraryID: library.libraryID,
			collections: collection ? [collection.id] : undefined,
			// All attachments come from the Connector
			attachmentMode: Zotero.Translate.ItemSaver.ATTACHMENT_MODE_IGNORE,
			forceTagType: 1,
			referrer: data.uri,
			cookieSandbox,
			proxy
		});
		let items = await this.itemSaver.saveItems(data.items, () => 0, () => 0);
		// If more itemSaver calls are made, it means we are saving attachments explicitly (like
		// a snapshot) and we don't want to ignore those.
		this.itemSaver.attachmentMode = Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD;
		items.forEach((item, index) => {
			this.addItem(data.items[index].id, item);
		});
		
		return items;
	}

	async saveSnapshot(target) {
		var { library, collection } = Zotero.Server.Connector.resolveTarget(target);
		var libraryID = library.libraryID;
		var data = this._requestData.data;
		
		let title = data.title || data.url;
		
		// Create new webpage item
		let item = new Zotero.Item("webpage");
		item.libraryID = libraryID;
		item.setField("title", title);
		item.setField("url", data.url);
		item.setField("accessDate", "CURRENT_TIMESTAMP");
		if (collection) {
			item.setCollections([collection.id]);
		}
		await item.saveTx();

		// SingleFile snapshot may be coming later
		this.addItem(data.url, item);
		
		return item;
	}

	async addItem(key, item) {
		return this.addItems({ [key]: item });
	}

	async addItems(items) {
		this._items = Object.assign(this._items, items);
		
		// Update the items with the current target data, in case it changed since the save began
		await this._updateItems(items);
	}
	
	getItemByConnectorKey(key) {
		return this._items[key];
	}

	// documentRecognizer doesn't return recognized items and it's complicated to make it
	// do it, so we just retrieve the parent item which is a little hacky but does the job
	getRecognizedItem() {
		try {
			return Object.values(this._items)[0].parentItem;
		}
		catch (_) {}
	}

	remove() {
		delete Zotero.Server.Connector.SessionManager._sessions[this.id];
	}

	/**
	 * Change the target data for this session and update any items that have already been saved
	 */
	async update(targetID, tags) {
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
				// TODO
				throw new Error("Changing from non-filesEditables to editable libraries not supported")
				Zotero.debug("Resaving items to filesEditable library");
				if (this._action == 'saveItems' || this._action == 'saveSnapshot') {
					// Delete old items
					for (let item of Object.values(this._items)) {
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
		if (zp && zp.collectionsView && Object.values(this._items).length == 1) {
			let item = Object.values(this._items)[0];
			item = item.isTopLevelItem() ? item : item.parentItem;
			// Don't select if in trash
			if (!item.deleted) {
				await zp.selectItem(item.id);
			}
		}
	}

	/**
	 * Update the passed items with the current target and tags
	 */
	_updateItems = Zotero.serial(async function (items) {
		if (Object.values(items).length == 0) {
			return;
		}
		
		var { library, collection } = Zotero.Server.Connector.resolveTarget(this._currentTargetID);
		var libraryID = library.libraryID;
		
		var tags = this._currentTags.trim();
		tags = tags ? tags.split(/\s*,\s*/).filter(x => x) : [];
		
		Zotero.debug("Updating items for connector save session " + this.id);
		
		for (let key in items) {
			let item = items[key];
			if (item.libraryID != libraryID) {
				let newItem = await item.moveToLibrary(libraryID);
				this._items[key] = newItem;
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


	_updateRecents() {
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
	}
};