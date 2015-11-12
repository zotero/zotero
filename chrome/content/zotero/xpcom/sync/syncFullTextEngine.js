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
	
	this.apiClient = options.apiClient;
	this.libraryID = options.libraryID;
	this.library = Zotero.Libraries.get(options.libraryID);
	this.setStatus = options.setStatus || function () {};
	this.onError = options.onError || function (e) {};
	this.stopOnError = options.stopOnError;
	this.requestPromises = [];
	this.failed = false;
}

Zotero.Sync.Data.FullTextEngine.prototype.start = Zotero.Promise.coroutine(function* () {
	Zotero.debug("Starting full-text sync for " + this.library.name);
	
	// Get last full-text version in settings
	var libraryVersion = yield Zotero.FullText.getLibraryVersion(this.libraryID);
	yield this._download(libraryVersion);
	
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
			Zotero.debug(`Skipping full-text for missing item ${this.libraryID}/${key}`);
			continue;
		}
		
		// Skip full text that's already up-to-date, which could happen due to a full sync or
		// interrupted sync
		let version = yield Zotero.Fulltext.getItemVersion(id);
		if (version == results.versions[key]) {
			Zotero.debug(`Skipping up-to-date full text for ${this.libraryKey}`);
			continue;
		}
		keys.push(key);
	}
	
	this.requestPromises = [];
	for (let key of keys) {
		// https://bugzilla.mozilla.org/show_bug.cgi?id=449811
		let tmpKey = key;
		this.requestPromises.push(
			this.apiClient.getFullTextForItem(
				this.library.libraryType, this.library.libraryTypeID, key
			)
			.then(function (results) {
				return Zotero.Fulltext.setItemContent(
					this.libraryID, tmpKey, results.data, results.version
				)
			}.bind(this))
		);
	}
	yield Zotero.Promise.all(this.requestPromises);
	yield Zotero.FullText.setLibraryVersion(this.libraryID, results.libraryVersion);
});


Zotero.Sync.Data.FullTextEngine.prototype._upload = Zotero.Promise.coroutine(function* () {
	if (!this.library.editable) return;
	
	Zotero.debug("Uploading full-text content for " + this.library.name);
	
	var props = ['content', 'indexedChars', 'totalChars', 'indexedPages', 'totalPages'];
	
	while (true) {
		let numSuccessful = 0;
		let objs = yield Zotero.FullText.getUnsyncedContent(this.libraryID, 10);
		if (!objs.length) {
			break;
		}
		let promises = [];
		for (let obj of objs) {
			let json = {};
			for (let prop of props) {
				json[prop] = obj[prop];
			}
			promises.push(this.apiClient.setFullTextForItem(
				this.library.libraryType, this.library.libraryTypeID, obj.key, json
			));
		}
		var results = yield Zotero.Promise.all(promises);
		yield Zotero.DB.executeTransaction(function* () {
			for (let i = 0; i < results.length; i++) {
				let itemID = yield Zotero.Items.getIDFromLibraryAndKey(
					this.libraryID, objs[i].key
				);
				yield Zotero.FullText.setItemSynced(itemID, results[i]);
			}
		}.bind(this));
	}
});


Zotero.Sync.Data.FullTextEngine.prototype.stop = Zotero.Promise.coroutine(function* () {
	// TODO: Cancel requests
	throw new Error("Unimplemented");
})
