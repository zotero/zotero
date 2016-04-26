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

// Mimics Zotero.Libraries
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

	this.init = function () {
		return this.scheduleNextFeedCheck();
	}
	
	this.restoreFromJSON = Zotero.Promise.coroutine(function* (json, merge=false) {
		Zotero.debug("Restoring feeds from remote JSON");
		Zotero.debug(json);
		if (merge) {
			let syncedFeeds = Zotero.SyncedSettings.get(Zotero.Libraries.userLibraryID, 'feeds');
			for (let url in json) {
				if (syncedFeeds[url]) {
					syncedFeeds[url].name = json[url].name;
					syncedFeeds[url].cleanupAfter = json[url].cleanupAfter;
					syncedFeeds[url].refreshInterval = json[url].refreshInterval;
					for (let guid in json[url].markedAsRead) {
						syncedFeeds[url].markedAsRead[guid] = true;
					}
				} else {
					syncedFeeds[url] = json[url];
				}
			}
			json = syncedFeeds;
		}
		yield Zotero.SyncedSettings.set(Zotero.Libraries.userLibraryID, 'feeds', json);
		let feeds = Zotero.Feeds.getAll();
		for (let feed of feeds) {
			if (json[feed.url]) {
				Zotero.debug("Feed " + feed.url + " exists remotely and locally");
				delete json[feed.url];
			} else {
				Zotero.debug("Feed " + feed.url + " does not exist in remote JSON. Deleting");
				yield feed.eraseTx();
			}
		}
		// Because existing json[feed.url] got deleted, `json` now only contains new feeds
		for (let url in json) {
			Zotero.debug("Feed " + url + " exists remotely but not locally. Creating");
			let feed = new Zotero.Feed(json[url]);
			yield feed.saveTx();
			yield feed.updateFeed();
		}
	});
	
	this.getByURL = function(urls) {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		let asArray = true;
		if (!Array.isArray(urls)) {
			urls = [urls];
			asArray = false;
		}
		
		let feeds = new Array(urls.length);
		for (let i=0; i<urls.length; i++) {
			let libraryID = this._cache.libraryIDByURL[urls[i]];
			if (!libraryID) {
				return
			}
			
			feeds[i] = Zotero.Libraries.get(libraryID);
		}
		
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
	
	this.get = function(libraryID) {
		let library = Zotero.Libraries.get(libraryID);
		return library.isFeed ? library : undefined;
	}
	
	this.haveFeeds = function() {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		return !!Object.keys(this._cache.urlByLibraryID).length
	}

	let globalFeedCheckDelay = Zotero.Promise.resolve();
	this.scheduleNextFeedCheck = Zotero.Promise.coroutine(function* () {
		Zotero.debug("Scheduling next feed update");
		let sql = "SELECT ( CASE "
			+ "WHEN lastCheck IS NULL THEN 0 "
			+ "ELSE strftime('%s', lastCheck) + refreshInterval * 60 - strftime('%s', 'now') "
			+ "END ) AS nextCheck "
			+ "FROM feeds WHERE refreshInterval IS NOT NULL "
			+ "ORDER BY nextCheck ASC LIMIT 1";
		var nextCheck = yield Zotero.DB.valueQueryAsync(sql);

		if (this._nextFeedCheck) {
			this._nextFeedCheck.cancel();
			this._nextFeedCheck = null;
		}

		if (nextCheck !== false) {
			nextCheck = nextCheck > 0 ? nextCheck * 1000 : 0;
			Zotero.debug("Next feed check in " + (nextCheck / 1000) + " seconds");
			this._nextFeedCheck = Zotero.Promise.delay(nextCheck);
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
			Zotero.debug("No feeds with auto-update");
		}
	});
	
	this.updateFeeds = Zotero.Promise.coroutine(function* () {
		let sql = "SELECT libraryID AS id FROM feeds "
			+ "WHERE refreshInterval IS NOT NULL "
			+ "AND ( lastCheck IS NULL "
				+ "OR (julianday(lastCheck, 'utc') + (refreshInterval/1440.0) - julianday('now', 'utc')) <= 0 )";
		let needUpdate = (yield Zotero.DB.queryAsync(sql)).map(row => row.id);
		Zotero.debug("Running update for feeds: " + needUpdate.join(', '));
		for (let i=0; i<needUpdate.length; i++) {
			let feed = Zotero.Feeds.get(needUpdate[i]);
			yield feed.waitForDataLoad('item');
			yield feed._updateFeed();
		}
		
		Zotero.debug("All feed updates done");
		this.scheduleNextFeedCheck();
	});
}
