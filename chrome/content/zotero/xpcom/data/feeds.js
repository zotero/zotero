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

<<<<<<< HEAD
// Add some feed methods, but otherwise proxy to Zotero.Collections
Zotero.Feeds = new function() {
	this._cache = null;
	
	this._makeCache = function() {
		return {
			libraryIDByURL: {},
			urlByLibraryID: {}
		};
	}
	
	this.register = function (feed) {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		Zotero.debug("Zotero.Feeds: Registering feed " + feed.libraryID, 5);
		this._addToCache(this._cache, feed);
	}
	
	this._addToCache = function (cache, feed) {
		if (!feed.libraryID) throw new Error('Cannot register an unsaved feed');
		
		if (cache.libraryIDByURL[feed.url]) {
			Zotero.debug('Feed with url ' + feed.url + ' is already registered', 2, true);
		}
		if (cache.urlByLibraryID[feed.libraryID]) {
			Zotero.debug('Feed with libraryID ' + feed.libraryID + ' is already registered', 2, true);
		}
		
		cache.libraryIDByURL[feed.url] = feed.libraryID;
		cache.urlByLibraryID[feed.libraryID] = feed.url;
	}
	
	this.unregister = function (libraryID) {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		Zotero.debug("Zotero.Feeds: Unregistering feed " + libraryID, 5);
		
		let url = this._cache.urlByLibraryID[libraryID];
		if (url === undefined) {
			Zotero.debug('Attempting to unregister a feed that is not registered (' + libraryID + ')', 2, true);
			return;
		}
		
		delete this._cache.urlByLibraryID[libraryID];
		delete this._cache.libraryIDByURL[url];
	}
	
	this.getByURL = function(urls) {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		let asArray = true;
		if (!Array.isArray(urls)) {
			urls = [urls];
			asArray = false;
		}
		
		let libraryIDs = Array(urls.length);
		for (let i=0; i<urls.length; i++) {
			let libraryID = this._cache.libraryIDByURL[urls[i]];
			if (!libraryID) {
				throw new Error('Feed with url ' + urls[i] + ' not registered in feed cache');
			}
			
			libraryIDs[i] = libraryID;
		}
		
		let feeds = Zotero.Libraries.get(libraryIDs);
		return asArray ? feeds : feeds[0];
	}
	
	this.existsByURL = function(url) {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		return this._cache.libraryIDByURL[url] !== undefined;
	}
	
	this.getAll = function() {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		return Object.keys(this._cache.urlByLibraryID)
			.map(id => Zotero.Libraries.get(id));
	}
	
	this.haveFeeds = function() {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		return !!Object.keys(this._cache.urlByLibraryID).length
	}

	this.scheduleNextFeedCheck = Zotero.Promise.coroutine(function* () {
		Zotero.debug("Scheduling next feed update.");
		let sql = "SELECT ( CASE "
			+ "WHEN lastCheck IS NULL THEN 0 "
			+ "ELSE julianday(lastCheck, 'utc') + (refreshInterval/1440.0) - julianday('now', 'utc') "
			+ "END ) * 1440 AS nextCheck "
			+ "FROM feeds WHERE refreshInterval IS NOT NULL "
			+ "ORDER BY nextCheck ASC LIMIT 1";
		var nextCheck = yield Zotero.DB.valueQueryAsync(sql);

		if (this._nextFeedCheck) {
			this._nextFeedCheck.cancel();
			this._nextFeedCheck = null;
		}

		if (nextCheck !== false) {
			nextCheck = nextCheck > 0 ? Math.ceil(nextCheck * 60000) : 0;
			Zotero.debug("Next feed check in " + nextCheck/60000 + " minutes");
			this._nextFeedCheck = Zotero.Promise.delay(nextCheck).cancellable();
			Zotero.Promise.all([this._nextFeedCheck, globalFeedCheckDelay])
			.then(() => {
				globalFeedCheckDelay = Zotero.Promise.delay(60000); // Don't perform auto-updates more than once per minute
				return this.updateFeeds()
			})
			.catch(e => {
				if (e instanceof Zotero.Promise.CancellationError) {
					Zotero.debug('Next update check cancelled');
					return;
				}
				throw e;
			});
		} else {
			Zotero.debug("No feeds with auto-update.");
		}
	});
}
=======

/*
 * Primary interface for accessing Zotero collection
 */
Zotero.Feeds = function() {
	// Don't extend, just proxy
	var Zotero_Feeds = function() {
		// Modify Zotero.Collections to deal with Feeds
		
		// Load additional primary data
		let additionalParts = {
			feedUrl: "FeD.url AS feedUrl",
			feedLastUpdate: "FeD.lastUpdate AS feedLastUpdate",
			feedLastCheck: "FeD.lastCheck AS feedLastCheck",
			feedLastCheckError: "FeD.lastCheckError AS feedLastCheckError",
			feedCleanupAfter: "FeD.cleanupAfter AS feedCleanupAfter", // Days
			feedRefreshInterval: "FeD.refreshInterval AS feedRefreshInterval", // Minutes
			feedUnreadCount: "(SELECT COUNT(*) "
				+ "FROM collectionItems CI LEFT JOIN feedItems FeID USING (itemID) "
				+ "WHERE CI.collectionID=O.collectionID AND FeID.readTimestamp IS NULL) "
				+ "AS feedUnreadCount"
		};
		for (let i in additionalParts) {
			Zotero.Collections._primaryDataSQLParts[i] = additionalParts[i];
		}
		
		// Join additional tables
		Zotero.Collections._primaryDataSQLFrom += " LEFT JOIN feeds FeD USING (collectionID)";
		
		// Choose correct item type when loading from DB row
		Zotero.Collections._getObjectForRow = function(row) {
			if (row.feedUrl) {
				return new Zotero.Feed();
			}
			
			return new Zotero.Collection();
		}
	};
	
	Zotero_Feeds.prototype.add = function() {
		throw new Error('Zotero.Feeds.add must not be used. Use new Zotero.Feed instead');
	};
	
	Zotero_Feeds.prototype.haveFeeds = Zotero.Promise.coroutine(function* () {
		let sql = "SELECT COUNT(*) FROM feeds";
		let count = yield Zotero.DB.valueQueryAsync(sql);
		return count ? !!parseInt(count) : count;
	});
	
	Zotero_Feeds.prototype.getFeedsInLibrary = Zotero.Promise.coroutine(function* () {
		let sql = "SELECT collectionID AS id FROM feeds";
		let ids = yield Zotero.DB.queryAsync(sql);
Zotero.debug(ids.map(function(row) row.id));
		let feeds = yield this.getAsync(ids.map(function(row) row.id));
		if (!feeds.length) return feeds;
		
		return feeds.sort(function (a, b) Zotero.localeCompare(a.name, b.name));
	});
	
	let globalFeedCheckDelay = Zotero.Promise.resolve(),
		pendingFeedCheckSchedule;

	
	Zotero_Feeds.prototype.updateFeeds = Zotero.Promise.coroutine(function* () {
		let sql = "SELECT collectionID AS id FROM feeds "
			+ "WHERE refreshInterval IS NOT NULL "
			+ "AND ( lastCheck IS NULL "
				+ "OR (julianday(lastCheck, 'utc') + (refreshInterval/1440) - julianday('now', 'utc')) <= 0 )";
		let needUpdate = (yield Zotero.DB.queryAsync(sql)).map(row => row.id);
		Zotero.debug("Running update for feeds: " + needUpdate.join(', '));
		let feeds = yield this.getAsync(needUpdate);
		let updatePromises = [];
		for (let i=0; i<feeds.length; i++) {
			updatePromises.push(feeds[i]._updateFeed());
		}
		
		return Zotero.Promise.settle(updatePromises)
		.then(() => {
			Zotero.debug("All feed updates done.");
			this.scheduleNextFeedCheck()
		});
	});
	
	Zotero_Feeds.prototype.erase = function(ids) {
		ids = Zotero.flattenArguments(ids);
		
		return Zotero.DB.executeTransaction(function* () {
			for (let i=0; i<ids.length; i++) {
				let id = ids[i];
				let feed = yield this.getAsync(id);
				if (!feed) {
					Zotero.debug('Feed ' + id + ' does not exist in Feeds.erase()!', 1);
					continue;
				}
				yield feed.erase(); // calls unload()
			}
		}.bind(this));
	};
	
	Zotero_Feeds.prototype.refreshChildItems = Zotero.Promise.coroutine(function* () {
		// Also invalidate collection cache
		yield Zotero.Collections.refreshChildItems.apply(Zotero.Collections, arguments);
		yield Zotero_Feeds._super.prototype.refreshChildItems.apply(this, arguments);
	});
	
	var feeds = new Zotero_Feeds();
	// Proxy remaining methods/properties to Zotero.Collections
	for (let i in Zotero.Collections) {
		if (feeds.hasOwnProperty(i)) continue;
		
		let prop = i;
		Zotero.defineProperty(feeds, prop, {
			get: function() {
				let val = Zotero.Collections[prop];
				if (typeof val == 'function') return val.bind(Zotero.Collections);
				return val;
			},
			set: function(val) Zotero.Collections[prop] = val
		});
	}
	
	return feeds;
}()

>>>>>>> 3a49f16... Add Feed data object
