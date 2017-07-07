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

if (!Zotero.Sync.Data) {
	Zotero.Sync.Data = {};
}

Zotero.Sync.Data.FullTextEngine = function (options) {
	if (options.apiClient == undefined) {
		throw new Error("options.apiClient not set");
	}
	if (options.libraryID == undefined) {
		throw new Error("options.libraryID not set");
	}
	
	this.MAX_BATCH_SIZE = 500000;
	this.MAX_BATCH_ITEMS = 10;
	
	this.apiClient = options.apiClient;
	this.libraryID = options.libraryID;
	this.library = Zotero.Libraries.get(options.libraryID);
	this.setStatus = options.setStatus || function () {};
	this.onError = options.onError || function (e) {};
	this.stopOnError = options.stopOnError;
	this._stopping = false;
	this.failed = false;
}

Zotero.Sync.Data.FullTextEngine.prototype.start = Zotero.Promise.coroutine(function* () {
	Zotero.debug("Starting full-text sync for " + this.library.name);
	
	// Get last full-text version in settings
	var libraryVersion = yield Zotero.FullText.getLibraryVersion(this.libraryID);
	// If main library version has changed, check to see if there's no full-text content
	if (this.library.libraryVersion > libraryVersion) {
		yield this._download(libraryVersion);
	}
	else {
		Zotero.debug("Library version hasn't changed -- skipping full-text download");
	}
	
	this._stopCheck();
	
	yield this._upload();
})


Zotero.Sync.Data.FullTextEngine.prototype._download = Zotero.Promise.coroutine(function* (libraryVersion) {
	Zotero.debug("Downloading full-text content for " + this.library.name);
	
	// Get changed with ?since
	var results = yield this.apiClient.getFullTextVersions(
		this.library.libraryType,
		this.library.libraryTypeID,
		libraryVersion
	);
	
	// Go through, checking local version against returned version
	var keys = [];
	for (let key in results.versions) {
		let id = Zotero.Items.getIDFromLibraryAndKey(this.libraryID, key);
		if (!id) {
			Zotero.debug(`Skipping full-text for missing item ${this.library.name}`);
			continue;
		}
		
		// Skip full text that's already up-to-date, which could happen due to a full sync or
		// interrupted sync
		let version = yield Zotero.Fulltext.getItemVersion(id);
		if (version == results.versions[key]) {
			Zotero.debug(`Skipping up-to-date full text for ${this.library.name}`);
			continue;
		}
		keys.push(key);
	}
	
	this.requestPromises = [];
	
	yield Zotero.Promise.map(
		keys,
		(key) => {
			this._stopCheck();
			return this.apiClient.getFullTextForItem(
				this.library.libraryType, this.library.libraryTypeID, key
			)
			.then((results) => {
				this._stopCheck();
				if (!results) return;
				return Zotero.Fulltext.setItemContent(
					this.libraryID, key, results.data, results.version
				)
			})
		},
		// Prepare twice the number of concurrent requests
		{ concurrency: 8 }
	);
	
	yield Zotero.FullText.setLibraryVersion(this.libraryID, results.libraryVersion);
});


Zotero.Sync.Data.FullTextEngine.prototype._upload = Zotero.Promise.coroutine(function* () {
	if (!this.library.editable) return;
	
	Zotero.debug("Uploading full-text content for " + this.library.name);
	
	var libraryVersion = this.library.libraryVersion;
	var props = ['key', 'content', 'indexedChars', 'totalChars', 'indexedPages', 'totalPages'];
	
	let lastItemID = 0;
	while (true) {
		this._stopCheck();
		
		let objs = yield Zotero.FullText.getUnsyncedContent(this.libraryID, {
			maxSize: this.MAX_BATCH_SIZE,
			maxItems: this.MAX_BATCH_ITEMS,
			lastItemID
		});
		if (!objs.length) {
			break;
		}
		
		let jsonArray = [];
		let results;
		
		for (let obj of objs) {
			let json = {};
			for (let prop of props) {
				json[prop] = obj[prop];
			}
			jsonArray.push(json);
			lastItemID = obj.itemID;
		}
		({ libraryVersion, results } = yield this.apiClient.setFullTextForItems(
			this.library.libraryType,
			this.library.libraryTypeID,
			libraryVersion,
			jsonArray
		));
		yield Zotero.DB.executeTransaction(function* () {
			for (let state of ['successful', 'unchanged']) {
				for (let index in results[state]) {
					let key = results[state][index].key;
					let itemID = Zotero.Items.getIDFromLibraryAndKey(this.libraryID, key);
					yield Zotero.FullText.setItemSynced(itemID, libraryVersion);
				}
			}
			// Set both the library version and the full-text library version. The latter is necessary
			// because full-text sync can be turned off at any time, so we have to keep track of the
			// last version we've seen for full-text in case the main library version has advanced since.
			yield Zotero.FullText.setLibraryVersion(this.libraryID, libraryVersion);
			this.library.libraryVersion = libraryVersion;
			yield this.library.save();
		}.bind(this));
		
		for (let index in results.failed) {
			let { code, message, data } = results.failed[index];
			let e = new Error(message);
			e.name = "ZoteroObjectUploadError";
			e.code = code;
			if (data) {
				e.data = data;
			}
			Zotero.logError("Error uploading full text for item " + jsonArray[index].key + " in "
				+ this.library.name + ":\n\n" + e);
			
			if (this.onError) {
				this.onError(e);
			}
			if (this.stopOnError) {
				throw new Error(e);
			}
		}
	}
});


Zotero.Sync.Data.FullTextEngine.prototype.stop = Zotero.Promise.coroutine(function* () {
	// TODO: Cancel requests?
	this._stopping = true;
})


Zotero.Sync.Data.FullTextEngine.prototype._stopCheck = function () {
	if (!this._stopping) return;
	Zotero.debug("Full-text sync stopped for " + this.library.name);
	throw new Zotero.Sync.UserCancelledException;
}
