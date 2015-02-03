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
	
	this.get = Zotero.Libraries.get;
	
	this.haveFeeds = function() {
		if (!this._cache) throw new Error("Zotero.Feeds cache is not initialized");
		
		return !!Object.keys(this._cache.urlByLibraryID).length
	}

	let globalFeedCheckDelay = Zotero.Promise.resolve();
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
	
	this.updateFeeds = Zotero.Promise.coroutine(function* () {
		let sql = "SELECT libraryID AS id FROM feeds "
			+ "WHERE refreshInterval IS NOT NULL "
			+ "AND ( lastCheck IS NULL "
				+ "OR (julianday(lastCheck, 'utc') + (refreshInterval/1440.0) - julianday('now', 'utc')) <= 0 )";
		let needUpdate = (yield Zotero.DB.queryAsync(sql)).map(row => row.id);
		Zotero.debug("Running update for feeds: " + needUpdate.join(', '));
		let feeds = Zotero.Libraries.get(needUpdate);
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
}
