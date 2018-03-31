/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2015 Center for History and New Media
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

/**
 * Zotero.Feed, extends Zotero.Library
 * 
 * Custom parameters:
 * - name - name of the feed displayed in the collection tree
 * - url
 * - cleanupReadAfter - number of days after which read items should be removed
 * - cleanupUnreadAfter - number of days after which unread items should be removed
 * - refreshInterval - in terms of hours
 * 
 * @param params
 * @returns Zotero.Feed
 * @constructor
 */
Zotero.Feed = function(params = {}) {
	params.libraryType = 'feed';
	Zotero.Feed._super.call(this, params);

	this._feedCleanupReadAfter = null;
	this._feedCleanupUnreadAfter = null;
	this._feedRefreshInterval = null;
	this._feedUnreadCount = null;
	this._updating = false;
	this._previousURL = null;

	// Feeds are not editable by the user. Remove the setter
	this.editable = false;
	Zotero.defineProperty(this, 'editable', {
		get: function() { return this._get('_libraryEditable'); }
	});

	// Feeds are not filesEditable by the user. Remove the setter
	this.filesEditable = false;
	Zotero.defineProperty(this, 'filesEditable', {
		get: function() { return this._get('_libraryFilesEditable'); }
	});
	
	Zotero.Utilities.assignProps(this, params, 
		['name', 'url', 'refreshInterval', 'cleanupReadAfter', 'cleanupUnreadAfter']);
	
	// Return a proxy so that we can disable the object once it's deleted
	return new Proxy(this, {
		get: function(obj, prop) {
			if (obj._disabled && !(prop == 'libraryID' || prop == 'id' || prop == 'treeViewID')) {
				throw new Error("Feed " + obj.libraryID + " has been disabled");
			}
			return obj[prop];
		}
	});
}

Zotero.Feed._colToProp = function(c) {
	return "_feed" + Zotero.Utilities.capitalize(c);
}

Zotero.extendClass(Zotero.Library, Zotero.Feed);

Zotero.defineProperty(Zotero.Feed, '_unreadCountSQL', {
	value: "(SELECT COUNT(*) FROM items I JOIN feedItems FI USING (itemID)"
			+ " WHERE I.libraryID=F.libraryID AND FI.readTime IS NULL) AS _feedUnreadCount"
});

Zotero.defineProperty(Zotero.Feed, '_dbColumns', {
	value: Object.freeze(['name', 'url', 'lastUpdate', 'lastCheck',
		'lastCheckError', 'cleanupUnreadAfter', 'cleanupReadAfter', 'refreshInterval'])
});

Zotero.defineProperty(Zotero.Feed, '_primaryDataSQLParts');

Zotero.defineProperty(Zotero.Feed, '_rowSQLSelect', {
	value: Zotero.Library._rowSQLSelect + ", "
		+ Zotero.Feed._dbColumns.map(c => "F." + c + " AS " + Zotero.Feed._colToProp(c)).join(", ")
		+ ", " + Zotero.Feed._unreadCountSQL
});

Zotero.defineProperty(Zotero.Feed, '_rowSQL', {
	value: "SELECT " + Zotero.Feed._rowSQLSelect
		+ " FROM feeds F JOIN libraries L USING (libraryID)"
});

Zotero.defineProperty(Zotero.Feed.prototype, '_objectType', {
	value: 'feed'
});

Zotero.defineProperty(Zotero.Feed.prototype, 'isFeed', {
	value: true
});

Zotero.defineProperty(Zotero.Feed.prototype, 'allowsLinkedFiles', {
	value: false
});

Zotero.defineProperty(Zotero.Feed.prototype, 'libraryTypes', {
	value: Object.freeze(Zotero.Feed._super.prototype.libraryTypes.concat(['feed']))
});

Zotero.defineProperty(Zotero.Feed.prototype, 'libraryTypeID', {
	get: () => undefined
});

Zotero.defineProperty(Zotero.Feed.prototype, 'unreadCount', {
	get: function() { return this._feedUnreadCount; }
});
Zotero.defineProperty(Zotero.Feed.prototype, 'updating', {
	get: function() { return !!this._updating; }
});

(function() {
// Create accessors
let accessors = ['name', 'url', 'refreshInterval', 'cleanupUnreadAfter', 'cleanupReadAfter'];
for (let i=0; i<accessors.length; i++) {
	let name = accessors[i];
	let prop = Zotero.Feed._colToProp(name);
	Zotero.defineProperty(Zotero.Feed.prototype, name, {
		get: function() { return this._get(prop); },
		set: function(v) { return this._set(prop, v); }
	})
}
let getters = ['lastCheck', 'lastUpdate', 'lastCheckError'];
for (let i=0; i<getters.length; i++) {
	let name = getters[i];
	let prop = Zotero.Feed._colToProp(name);
	Zotero.defineProperty(Zotero.Feed.prototype, name, {
		get: function() { return this._get(prop); }
	})
}
})()

Zotero.Feed.prototype._isValidFeedProp = function(prop) {
	let preffix = '_feed';
	if (prop.indexOf(preffix) != 0 || prop.length == preffix.length) {
		return false;
	}
	
	let col = prop.substr(preffix.length);
	col = col.charAt(0).toLowerCase() + col.substr(1);
	
	return Zotero.Feed._dbColumns.indexOf(col) != -1;
}

Zotero.Feed.prototype._isValidProp = function(prop) {
	return this._isValidFeedProp(prop)
		|| Zotero.Feed._super.prototype._isValidProp.call(this, prop);
}

Zotero.Feed.prototype._set = function (prop, val) {
	switch (prop) {
		case '_feedName':
			if (!val || typeof val != 'string') {
				throw new Error(prop + " must be a non-empty string");
			}
			break;
		case '_feedUrl':
			let uri,
				invalidUrlError = "Invalid feed URL " + val;
			try {
				uri = Components.classes["@mozilla.org/network/io-service;1"]
					.getService(Components.interfaces.nsIIOService)
					.newURI(val, null, null);
				val = uri.spec;
			} catch(e) {
				throw new Error(invalidUrlError);
			}
			
			if (uri.scheme !== 'http' && uri.scheme !== 'https') {
				throw new Error(invalidUrlError);
			}
			this._previousURL = this.url;
			break;
		case '_feedRefreshInterval':
		case '_feedCleanupReadAfter':
		case '_feedCleanupUnreadAfter':
			if (val === null) break;
			
			let newVal = Number.parseInt(val, 10);
			if (newVal != val || !newVal || newVal <= 0) {
				throw new Error(`${prop} must be null or a positive integer, but is ${val}`);
			}
			break;
		case '_feedLastCheckError':
			if (!val) {
				val = null;
				break;
			}
			
			if (typeof val !== 'string') {
				throw new Error(`${prop} must be null or a string, but is ${val}`);
			}
			break;
	}
	
	return Zotero.Feed._super.prototype._set.call(this, prop, val);
}

Zotero.Feed.prototype._loadDataFromRow = function(row) {
	Zotero.Feed._super.prototype._loadDataFromRow.call(this, row);
	
	this._feedName = row._feedName;
	this._feedUrl = row._feedUrl;
	this._feedLastCheckError = row._feedLastCheckError || null;
	this._feedLastCheck = row._feedLastCheck || null;
	this._feedLastUpdate = row._feedLastUpdate || null;
	this._feedCleanupReadAfter = parseInt(row._feedCleanupReadAfter) || null;
	this._feedCleanupUnreadAfter = parseInt(row._feedCleanupUnreadAfter) || null;
	this._feedRefreshInterval = parseInt(row._feedRefreshInterval) || null;
	this._feedUnreadCount = parseInt(row._feedUnreadCount);
}

Zotero.Feed.prototype._reloadFromDB = Zotero.Promise.coroutine(function* () {
	let sql = Zotero.Feed._rowSQL + " WHERE F.libraryID=?";
	let row = yield Zotero.DB.rowQueryAsync(sql, [this.libraryID]);
	this._loadDataFromRow(row);
});

Zotero.defineProperty(Zotero.Feed.prototype, '_childObjectTypes', {
	value: Object.freeze(['feedItem', 'item'])
});

Zotero.Feed.prototype._initSave = Zotero.Promise.coroutine(function* (env) {
	let proceed = yield Zotero.Feed._super.prototype._initSave.call(this, env);
	if (!proceed) return false;
	
	if (!this._feedName) throw new Error("Feed name not set");
	if (!this._feedUrl) throw new Error("Feed URL not set");
	if (!this.refreshInterval) this.refreshInterval = Zotero.Prefs.get('feeds.defaultTTL') * 60;
	if (!this.cleanupReadAfter) this.cleanupReadAfter = Zotero.Prefs.get('feeds.defaultCleanupReadAfter');
	if (!this.cleanupUnreadAfter) this.cleanupUnreadAfter = Zotero.Prefs.get('feeds.defaultCleanupUnreadAfter');
	
	if (env.isNew) {
		// Make sure URL is unique
		if (Zotero.Feeds.existsByURL(this._feedUrl)) {
			throw new Error('Feed for URL already exists: ' + this._feedUrl);
		}
	}
	
	return true;
});

Zotero.Feed.prototype._saveData = Zotero.Promise.coroutine(function* (env) {
	yield Zotero.Feed._super.prototype._saveData.apply(this, arguments);
	
	Zotero.debug("Saving feed data for library " + this.id);
	
	let changedCols = [], params = [];
	for (let i=0; i<Zotero.Feed._dbColumns.length; i++) {
		let col = Zotero.Feed._dbColumns[i];
		let prop = Zotero.Feed._colToProp(col);
		
		if (!this._changed[prop]) continue;
		
		changedCols.push(col);
		params.push(this[prop]);
	}
	
	if (env.isNew) {
		changedCols.push('libraryID');
		params.push(this.libraryID);
		
		let sql = "INSERT INTO feeds (" + changedCols.join(', ') + ") "
			+ "VALUES (" + Array(params.length).fill('?').join(', ') + ")";
		yield Zotero.DB.queryAsync(sql, params);
		
		Zotero.Notifier.queue(
			'add', 'feed', this.libraryID, env.notifierData, env.options.notifierQueue
		);
	}
	else if (changedCols.length) {
		let sql = "UPDATE feeds SET " + changedCols.map(v => v + '=?').join(', ')
			+ " WHERE libraryID=?";
		params.push(this.libraryID);
		yield Zotero.DB.queryAsync(sql, params);
		
		if (!env.options.skipNotifier) {
			Zotero.Notifier.queue(
				'modify', 'feed', this.libraryID, env.notifierData, env.options.notifierQueue
			);
		}
	}
	else {
		Zotero.debug("Feed data did not change for feed " + this.libraryID, 5);
	}
});

Zotero.Feed.prototype._finalizeSave = Zotero.Promise.coroutine(function* (env) {
	let syncedDataChanged = 
		['_feedName', '_feedCleanupReadAfter', '_feedCleanupUnreadAfter', '_feedRefreshInterval'].some((val) => this._changed[val]);

	yield Zotero.Feed._super.prototype._finalizeSave.apply(this, arguments);
	
	if (!env.isNew && this._previousURL) {
		// Re-register library if URL changed
		Zotero.Feeds.unregister(this.libraryID);
		
		let syncedFeeds = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds') || {};
		delete syncedFeeds[this._previousURL];
		yield Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'feeds', syncedFeeds);
	}
	if (syncedDataChanged || env.isNew || this._previousURL) {
		yield this.storeSyncedSettings();
		if (env.isNew || this._previousURL) {
			Zotero.Feeds.register(this);
		}
	}
	this._previousURL = null;
	
});

Zotero.Feed.prototype._finalizeErase = Zotero.Promise.coroutine(function* (env) {
	let notifierData = {};
	notifierData[this.libraryID] = {
		libraryID: this.libraryID
	};
	Zotero.Notifier.queue('delete', 'feed', this.id, notifierData, env.options.notifierQueue);
	Zotero.Feeds.unregister(this.libraryID);

	let syncedFeeds = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds') || {};
	delete syncedFeeds[this.url];
	if (Object.keys(syncedFeeds).length == 0) {
		yield Zotero.SyncedSettings.clear(Zotero.Libraries.userLibraryID, 'feeds');
	} else {
		yield Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'feeds', syncedFeeds);
	}
	
	return Zotero.Feed._super.prototype._finalizeErase.apply(this, arguments);
});

Zotero.Feed.prototype.erase = Zotero.Promise.coroutine(function* (options = {}) {
	let childItemIDs = yield Zotero.FeedItems.getAll(this.id, false, false, true);
	yield Zotero.FeedItems.erase(childItemIDs);
	
	yield Zotero.Feed._super.prototype.erase.call(this, options);
});

Zotero.Feed.prototype.storeSyncedSettings = Zotero.Promise.coroutine(function* () {
	let syncedFeeds = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds') || {};
	syncedFeeds[this.url] = [this.name, this.cleanupReadAfter, this.cleanupUnreadAfter, this.refreshInterval];
	return Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'feeds', syncedFeeds);
});

Zotero.Feed.prototype.getExpiredFeedItemIDs = Zotero.Promise.coroutine(function* () {
	let sql = "SELECT itemID AS id FROM feedItems "
		+ "LEFT JOIN items I USING (itemID) "
		+ "WHERE I.libraryID=? "
		+ "AND ("
			+ "(readTime IS NOT NULL AND julianday('now', 'utc') - (julianday(readTime, 'utc') + ?) > 0) "
			+ "OR (readTime IS NULL AND julianday('now', 'utc') - (julianday(dateModified, 'utc') + ?) > 0)"
		+ ")";
	return Zotero.DB.columnQueryAsync(sql, [this.id, {int: this.cleanupReadAfter}, {int: this.cleanupUnreadAfter}]);
});

/**
 * Clearing conditions for an item:
 * - Has been read at least feed.cleanupReadAfter earlier OR is unread and older than feed.cleanupUnreadAfter
 * - AND Does not exist in the RSS feed anymore
 * 
 * If we clear items once they've been read, we may potentially end up
 * with empty feeds for those that do not update very frequently.
 */
Zotero.Feed.prototype.clearExpiredItems = Zotero.Promise.coroutine(function* (itemsInFeedIDs) {
	itemsInFeedIDs = itemsInFeedIDs || new Set();
	try {
		// Clear expired items
		let expiredItems = yield this.getExpiredFeedItemIDs();
		let toClear = expiredItems;
		if (itemsInFeedIDs.size) {
			toClear = [];
			for (let id of expiredItems) {
				if (!itemsInFeedIDs.has(id)) {
					toClear.push(id);
				}
			}
		}
		Zotero.debug("Clearing up read feed items...");
		if (toClear.length) {
			Zotero.debug(toClear.join(', '));
			yield Zotero.FeedItems.erase(toClear);
		} else {
			Zotero.debug("No expired feed items");
		}
	} catch(e) {
		Zotero.debug("Error clearing expired feed items");
		Zotero.debug(e);
	}
});

Zotero.Feed.prototype._updateFeed = Zotero.Promise.coroutine(function* () {
	var toSave = [], attachmentsToAdd = [], feedItemIDs = new Set();
	if (this._updating) {
		return this._updating;
	}
	let deferred = Zotero.Promise.defer();
	this._updating = deferred.promise;
	yield Zotero.Notifier.trigger('statusChanged', 'feed', this.id);
	this._set('_feedLastCheckError', null);
	
	try {
		let fr = new Zotero.FeedReader(this.url);
		yield fr.process();
		let itemIterator = new fr.ItemIterator();
		let item, processedGUIDs = new Set();
		while (item = yield itemIterator.next().value) {
			if (processedGUIDs.has(item.guid)) {
				Zotero.debug("Feed item " + item.guid + " already processed from feed");
				continue;
			}
			processedGUIDs.add(item.guid);
			
			Zotero.debug("Feed item retrieved:", 5);
			Zotero.debug(item, 5);
			
			let feedItem = yield Zotero.FeedItems.getAsyncByGUID(item.guid);
			if (feedItem) {
				feedItemIDs.add(feedItem.id);
			}
			if (!feedItem) {
				Zotero.debug("Creating new feed item " + item.guid);
				feedItem = new Zotero.FeedItem();
				feedItem.guid = item.guid;
				feedItem.libraryID = this.id;
			} else if (!feedItem.isTranslated) {
				// TODO: maybe handle enclosed items on update better
				item.enclosedItems = [];
				
				// TODO figure out a better GUID collision resolution system
				// that works with sync.
				if (feedItem.libraryID != this.libraryID) {
					let otherFeed = Zotero.Feeds.get(feedItem.libraryID);
					Zotero.debug("Feed item " + feedItem.url + " from " + this.url + 
						" exists in a different feed " + otherFeed.url + ". Skipping");
					continue;
				}
				
				Zotero.debug("Feed item " + item.guid + " already in library");
				Zotero.debug("Updating metadata");
			} else {
				// Not new and has been translated
				Zotero.debug("Feed item " + item.guid + " is not new and has already been translated. Skipping");
				continue;
			}
			
			for (let enclosedItem of item.enclosedItems) {
				enclosedItem.parentItem = feedItem;
				attachmentsToAdd.push(enclosedItem);
			}
			
			// Delete invalid data
			delete item.guid;
			delete item.enclosedItems;
			feedItem.fromJSON(item);
			
			if (!feedItem.hasChanged()) {
				Zotero.debug("Feed item " + feedItem.guid + " has not changed");
				continue
			}
			feedItem.isRead = false;
			toSave.push(feedItem);
		}
	}
	catch (e) {
		if (e.message) {
			Zotero.logError("Error processing feed from " + this.url + ":\n\n" + e);
		}
		this._set('_feedLastCheckError', e.message || 'Error processing feed');
	}
	if (toSave.length) {
		yield Zotero.DB.executeTransaction(function* () {
			// Save in reverse order
			for (let i=toSave.length-1; i>=0; i--) {
				yield toSave[i].save();
			}
			
		});
		this._set('_feedLastUpdate', Zotero.Date.dateToSQL(new Date(), true));
	}
	for (let attachment of attachmentsToAdd) {
		if (attachment.url.indexOf('pdf') != -1 || attachment.contentType.indexOf('pdf') != -1) {
			attachment.parentItemID = attachment.parentItem.id;
			attachment.title = Zotero.getString('fileTypes.pdf');
			yield Zotero.Attachments.linkFromURL(attachment);
		}
	}
	yield this.clearExpiredItems(feedItemIDs);
	this._set('_feedLastCheck', Zotero.Date.dateToSQL(new Date(), true));
	yield this.saveTx();
	yield this.updateUnreadCount();
	deferred.resolve();
	this._updating = false;
	yield Zotero.Notifier.trigger('statusChanged', 'feed', this.id);
});

Zotero.Feed.prototype.updateFeed = Zotero.Promise.coroutine(function* () {
	try {
		let result = yield this._updateFeed();
		return result;
	} finally {
		Zotero.Feeds.scheduleNextFeedCheck();
	}
});

Zotero.Feed.prototype.updateUnreadCount = Zotero.Promise.coroutine(function* () {
	let sql = "SELECT " + Zotero.Feed._unreadCountSQL
		+ " FROM feeds F JOIN libraries L USING (libraryID)"
		+ " WHERE L.libraryID=?";
	let newCount = yield Zotero.DB.valueQueryAsync(sql, [this.id]);
	
	if (newCount != this._feedUnreadCount) {
		this._feedUnreadCount = newCount;
		yield Zotero.Notifier.trigger('unreadCountUpdated', 'feed', this.id);
	}
});
