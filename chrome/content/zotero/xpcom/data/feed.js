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
 * - cleanupAfter - number of days after which read items should be removed
 * - refreshInterval - in terms of hours
 * 
 * @param params
 * @returns Zotero.Feed
 * @constructor
 */
Zotero.Feed = function(params = {}) {
	params.libraryType = 'feed';
	Zotero.Feed._super.call(this, params);
	
	this._feedCleanupAfter = null;
	this._feedRefreshInterval = null;

	// Feeds are not editable by the user. Remove the setter
	this.editable = false;
	Zotero.defineProperty(this, 'editable', {
		get: function() this._get('_libraryEditable')
	});

	// Feeds are not filesEditable by the user. Remove the setter
	this.filesEditable = false;
	Zotero.defineProperty(this, 'filesEditable', {
		get: function() this._get('_libraryFilesEditable')
	});
	
	Zotero.Utilities.assignProps(this, params, 
		['name', 'url', 'refreshInterval', 'cleanupAfter']);
	
	// Return a proxy so that we can disable the object once it's deleted
	return new Proxy(this, {
		get: function(obj, prop) {
			if (obj._disabled && !(prop == 'libraryID' || prop == 'id')) {
				throw new Error("Feed (" + obj.libraryID + ") has been disabled");
			}
			return obj[prop];
		}
	});
	this._feedUnreadCount = null;
	
	this._updating = false;
}

Zotero.Feed._colToProp = function(c) {
	return "_feed" + Zotero.Utilities.capitalize(c);
}

Zotero.extendClass(Zotero.Library, Zotero.Feed);

Zotero.defineProperty(Zotero.Feed, '_unreadCountSQL', {
	value: "(SELECT COUNT(*) FROM items I JOIN feedItems FeI USING (itemID)"
			+ " WHERE I.libraryID=F.libraryID AND FeI.readTime IS NULL) AS _feedUnreadCount"
});

Zotero.defineProperty(Zotero.Feed, '_dbColumns', {
	value: Object.freeze(['name', 'url', 'lastUpdate', 'lastCheck',
		'lastCheckError', 'cleanupAfter', 'refreshInterval'])
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

Zotero.defineProperty(Zotero.Feed.prototype, 'libraryTypes', {
	value: Object.freeze(Zotero.Feed._super.prototype.libraryTypes.concat(['feed']))
});
Zotero.defineProperty(Zotero.Feed.prototype, 'unreadCount', {
	get: function() this._feedUnreadCount
});
Zotero.defineProperty(Zotero.Feed.prototype, 'updating', {
	get: function() !!this._updating,
});

(function() {
// Create accessors
let accessors = ['name', 'url', 'refreshInterval', 'cleanupAfter'];
for (let i=0; i<accessors.length; i++) {
	let name = accessors[i];
	let prop = Zotero.Feed._colToProp(name);
	Zotero.defineProperty(Zotero.Feed.prototype, name, {
		get: function() this._get(prop),
		set: function(v) this._set(prop, v)
	})
}
let getters = ['lastCheck', 'lastUpdate', 'lastCheckError'];
for (let i=0; i<getters.length; i++) {
	let name = getters[i];
	let prop = Zotero.Feed._colToProp(name);
	Zotero.defineProperty(Zotero.Feed.prototype, name, {
		get: function() this._get(prop),
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
			break;
		case '_feedRefreshInterval':
		case '_feedCleanupAfter':
			if (val === null) break;
			
			let newVal = Number.parseInt(val, 10);
			if (newVal != val || !newVal || newVal <= 0) {
				throw new Error(prop + " must be null or a positive integer");
			}
			break;
		case '_feedLastCheckError':
			if (!val) {
				val = null;
				break;
			}
			
			if (typeof val !== 'string') {
				throw new Error(prop + " must be null or a string");
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
	this._feedCleanupAfter = parseInt(row._feedCleanupAfter) || null;
	this._feedRefreshInterval = parseInt(row._feedRefreshInterval) || null;
	this._feedUnreadCount = parseInt(row._feedUnreadCount);
}

Zotero.Feed.prototype._reloadFromDB = Zotero.Promise.coroutine(function* () {
	let sql = Zotero.Feed._rowSQL + " WHERE F.libraryID=?";
	let row = yield Zotero.DB.rowQueryAsync(sql, [this.libraryID]);
	this._loadDataFromRow(row);
});

Zotero.defineProperty(Zotero.Feed.prototype, '_childObjectTypes', {
	value: Object.freeze(['feedItem'])
});

Zotero.Feed.prototype._initSave = Zotero.Promise.coroutine(function* (env) {
	let proceed = yield Zotero.Feed._super.prototype._initSave.call(this, env);
	if (!proceed) return false;
	
	if (!this._feedName) throw new Error("Feed name not set");
	if (!this._feedUrl) throw new Error("Feed URL not set");
	
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
		
		Zotero.Notifier.queue('add', 'feed', this.libraryID);
	}
	else if (changedCols.length) {
		let sql = "UPDATE feeds SET " + changedCols.map(v => v + '=?').join(', ')
			+ " WHERE libraryID=?";
		params.push(this.libraryID);
		yield Zotero.DB.queryAsync(sql, params);
		
		Zotero.Notifier.queue('modify', 'feed', this.libraryID);
	}
	else {
		Zotero.debug("Feed data did not change for feed " + this.libraryID, 5);
	}
});

Zotero.Feed.prototype._finalizeSave = Zotero.Promise.coroutine(function* (env) {
	let changedURL = this._changed._feedUrl;
	
	yield Zotero.Feed._super.prototype._finalizeSave.apply(this, arguments);
	
	if (env.isNew) {
		Zotero.Feeds.register(this);
	} else if (changedURL) {
		// Re-register library if URL changed
		Zotero.Feeds.unregister(this.libraryID);
		Zotero.Feeds.register(this);
	}
});

Zotero.Feed.prototype.getExpiredFeedItemIDs = Zotero.Promise.coroutine(function* () {
	let sql = "SELECT itemID AS id FROM feedItems "
		+ "LEFT JOIN items I USING (itemID) "
		+ "WHERE I.libraryID=? "
		+ "AND readTime IS NOT NULL "
		+ "AND julianday('now', 'utc') - (julianday(readTime, 'utc') + ?) > 0";
	let expiredIDs = yield Zotero.DB.queryAsync(sql, [this.id, {int: this.cleanupAfter}]);
	return expiredIDs.map(row => row.id);
});

Zotero.Feed.prototype.clearExpiredItems = Zotero.Promise.coroutine(function* () {
	try {
		// Clear expired items
		if (this.cleanupAfter) {
			let expiredItems = yield this.getExpiredFeedItemIDs();
			Zotero.debug("Cleaning up read feed items...");
			if (expiredItems.length) {
				Zotero.debug(expiredItems.join(', '));
				yield Zotero.FeedItems.forceErase(expiredItems);
			} else {
				Zotero.debug("No expired feed items");
			}
		}
	} catch(e) {
		Zotero.debug("Error clearing expired feed items.");
		Zotero.debug(e);
	}
});

Zotero.Feed.prototype._updateFeed = Zotero.Promise.coroutine(function* () {
	var toAdd = [];
	if (this._updating) {
		return this._updating;
	}
	let deferred = Zotero.Promise.defer();
	this._updating = deferred.promise;
	Zotero.Notifier.trigger('statusChanged', 'feed', this.id);
	this._set('_feedLastCheckError', null);
	
	yield this.clearExpiredItems();
	try {
		let fr = new Zotero.FeedReader(this.url);
		yield fr.process();
		let itemIterator = new fr.ItemIterator();
		let item, processedGUIDs = [];
		while (item = yield itemIterator.next().value) {
			// TODO: add a database column to feed for lastGUID so we have a good way to decide
			// when to terminate item retrieval.
			if (false) {
				Zotero.debug("Item modification date before last update date (" + this.lastCheck + ")");
				Zotero.debug(item);
				// We can stop now
				fr.terminate();
				break;
			}
			
			// Append id at the end to prevent same item collisions from different feeds
			item.guid += ":" + this.id;
			if (processedGUIDs.indexOf(item.guid) != -1) {
				Zotero.debug("Feed item " + item.guid + " already processed from feed.");
				continue;
			}
			processedGUIDs.push(item.guid);
			
			Zotero.debug("New feed item retrieved:", 5);
			Zotero.debug(item, 5);
			
			let feedItem = yield Zotero.FeedItems.getAsyncByGUID(item.guid);
			if (!feedItem) {
				feedItem = new Zotero.FeedItem();
				feedItem.guid = item.guid;
				feedItem.libraryID = this.id;
			} else {
				Zotero.debug("Feed item " + item.guid + " already in library.");
				Zotero.debug("Updating metadata");
				yield feedItem.loadItemData();
				yield feedItem.loadCreators();
				feedItem.isRead = false;
			}
			
			// Delete invalid data
			delete item.guid;
			
			feedItem.fromJSON(item);
			toAdd.push(feedItem);
		}
	}
	catch (e) {
		if (e.message) {
			Zotero.debug("Error processing feed from " + this.url);
			Zotero.debug(e);
		}
		this._set('_feedLastCheckError', e.message || 'Error processing feed');
	}
	if (toAdd.length) {
		yield Zotero.DB.executeTransaction(function* () {
			// Save in reverse order
			for (let i=toAdd.length-1; i>=0; i--) {
				// Saving currently has to happen sequentially so as not to violate the
				// unique constraints in itemDataValues (FIXME)
				yield toAdd[i].save({skipEditCheck: true});
			}
		});
		this._set('_feedLastUpdate', Zotero.Date.dateToSQL(new Date(), true));
	}
	this._set('_feedLastCheck', Zotero.Date.dateToSQL(new Date(), true));
	yield this.saveTx();
	yield this.updateUnreadCount();
	deferred.resolve();
	this._updating = false;
	Zotero.Notifier.trigger('statusChanged', 'feed', this.id);
});

Zotero.Feed.prototype.updateFeed = Zotero.Promise.coroutine(function* () {
	try {
		let result = yield this._updateFeed();
		return result;
	} finally {
		Zotero.Feeds.scheduleNextFeedCheck();
	}
});

Zotero.Feed.prototype._finalizeErase = Zotero.Promise.coroutine(function* (){
	let notifierData = {};
	notifierData[this.libraryID] = {
		libraryID: this.libraryID
	};
	Zotero.Notifier.trigger('delete', 'feed', this.id, notifierData);
	Zotero.Feeds.unregister(this.libraryID);
	return Zotero.Feed._super.prototype._finalizeErase.apply(this, arguments);
});

Zotero.Feed.prototype.erase = Zotero.Promise.coroutine(function* (options = {}) {
	let childItemIDs = yield Zotero.FeedItems.getAll(this.id, false, false, true);
	yield Zotero.FeedItems.forceErase(childItemIDs);
	
	yield Zotero.Feed._super.prototype.erase.call(this, options);
});

Zotero.Feed.prototype.updateUnreadCount = Zotero.Promise.coroutine(function* () {
	let sql = "SELECT " + Zotero.Feed._unreadCountSQL
		+ " FROM feeds F JOIN libraries L USING (libraryID)"
		+ " WHERE L.libraryID=?";
	let newCount = yield Zotero.DB.valueQueryAsync(sql, [this.id]);
	
	if (newCount != this._feedUnreadCount) {
		this._feedUnreadCount = newCount;
		Zotero.Notifier.trigger('unreadCountUpdated', 'feed', this.id);
	}
});
