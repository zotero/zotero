/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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

Zotero.Libraries = new function () {
	let _userLibraryID;
	Zotero.defineProperty(this, 'userLibraryID', {
		get: function () { 
			if (_userLibraryID === undefined) {
				throw new Error("Library data not yet loaded");
			}
			return _userLibraryID;
		}
	});
	
	Zotero.defineProperty(this, 'userLibrary', {
		get: function () {
			return Zotero.Libraries.get(_userLibraryID);
		}
	})
	
	/**
	 * Manage cache
	 */
	this._cache = null;
	
	this._makeCache = function () {
		return {};
	}
	
	this.register = function (library) {
		if (!this._cache) throw new Error("Zotero.Libraries cache is not initialized");
		Zotero.debug("Zotero.Libraries: Registering library " + library.libraryID, 5);
		this._addToCache(this._cache, library);
	};
	
	this._addToCache = function (cache, library) {
		if (!library.libraryID) throw new Error("Cannot register an unsaved library");
		cache[library.libraryID] = library;
	}
	
	this.unregister = function (libraryID) {
		if (!this._cache) throw new Error("Zotero.Libraries cache is not initialized");
		Zotero.debug("Zotero.Libraries: Unregistering library " + libraryID, 5);
		delete this._cache[libraryID];
	};
	
	/**
	 * Loads all libraries from DB. Groups, Feeds, etc. should not maintain an
	 * independent cache.
	 */
	this.init = async function () {
		let specialLoading = ['feed', 'group'];
		
		// Invalidate caches until we're done loading everything
		let libTypes = ['library'].concat(specialLoading);
		let newCaches = {};
		for (let i=0; i<libTypes.length; i++) {
			let objs = Zotero.DataObjectUtilities.getObjectsClassForObjectType(libTypes[i]);
			delete objs._cache;
			
			newCaches[libTypes[i]] = objs._makeCache();
		}
		
		let sql = Zotero.Library._rowSQL
			// Exclude libraries that require special loading
			+ " WHERE type NOT IN "
			+ "(" + Array(specialLoading.length).fill('?').join(',') + ")";
		let rows = await Zotero.DB.queryAsync(sql, specialLoading);
		
		for (let i=0; i<rows.length; i++) {
			let row = rows[i];
			
			let library;
			switch (row._libraryType) {
				case 'user':
					library = new Zotero.Library();
					library._loadDataFromRow(row); // Does not call save()
					break;
				default:
					throw new Error('Unhandled library type "' + row._libraryType + '"');
			}
			
			if (library.libraryType == 'user') {
				_userLibraryID = library.libraryID;
			}
			
			this._addToCache(newCaches.library, library);
		}
		
		// Load other libraries
		for (let i=0; i<specialLoading.length; i++) {
			let libType = specialLoading[i];
			let LibType = Zotero.Utilities.capitalize(libType);
			
			let libs = await Zotero.DB.queryAsync(Zotero[LibType]._rowSQL);
			for (let j=0; j<libs.length; j++) {
				let lib = new Zotero[LibType]();
				lib._loadDataFromRow(libs[j]);
				
				this._addToCache(newCaches.library, lib);
				Zotero[lib._ObjectTypePlural]._addToCache(newCaches[libType], lib);
			}
		}
		
		// Set new caches
		for (let libType in newCaches) {
			Zotero.DataObjectUtilities.getObjectsClassForObjectType(libType)
				._cache = newCaches[libType];
		}
	};
	
	/**
	 * @param {Integer} libraryID
	 * @return {Boolean}
	 */
	this.exists = function (libraryID) {
		if (!this._cache) throw new Error("Zotero.Libraries cache is not initialized");
		return this._cache[libraryID] !== undefined;
	}
	
	
	this._ensureExists = function (libraryID) {
		if (!this.exists(libraryID)) {
			throw new Error("Invalid library ID " + libraryID);
		}
	}
	
	
	/**
	 * @return {Zotero.Library[]} - All libraries
	 */
	this.getAll = function () {
		if (!this._cache) throw new Error("Zotero.Libraries cache is not initialized");
		var libraries = Object.keys(this._cache).map(v => Zotero.Libraries.get(parseInt(v)));
		var collation = Zotero.getLocaleCollation();
		// Sort My Library, then others by name
		libraries.sort(function (a, b) {
			if (a.libraryID == _userLibraryID) return -1;
			if (b.libraryID == _userLibraryID) return 1;
			return collation.compareString(1, a.name, b.name);
		}.bind(this))
		return libraries;
	}
	
	
	/**
	 * Get an existing library
	 *
	 * @param {Integer} libraryID
	 * @return {Zotero.Library[] | Zotero.Library}
	 */
	this.get = function (libraryID) {
		return this._cache[libraryID] || false;
	}

	/**
	 * Copy items and collections from one library into another
	 * This is an additive operation - new items and collections are copied over
	 * but nothing is deleted.
	 * @param {Zotero.Library} sourceLibrary - library to copy
	 * @param {Zotero.Library} targetLibrary - library to copy into
	 */
	this.copy = async function (sourceLibrary, targetLibrary) {
		// Load all items in the target library
		await Zotero.Items.getAll(targetLibrary.libraryID);

		// Copy top-level items
		let topLevelItems = await Zotero.Items.getAll(sourceLibrary.libraryID, true);
		await Zotero.Utilities.Internal.forEachChunkAsync(topLevelItems, 100, (chunk) => {
			return Zotero.DB.executeTransaction(async () => {
				for (let item of chunk) {
					await Zotero.Items.copyToLibrary(item, targetLibrary.libraryID);
				}
			});
		});
		// Copy top-level collections. Child collections and items will be copied recursively.
		let collections = Zotero.Collections.getByLibrary(sourceLibrary.libraryID);
		for (let collection of collections) {
			await Zotero.Collections.copy(collection, targetLibrary);
		}
	};

	/**
	 * Replicate items and collections of one library into another.
	 * This is a destructive operation - after items and collections are copied over,
	 * unlinked collections and items in target library are trashed.
	 * @param {Zotero.Library} sourceLibrary - library to replicate
	 * @param {Zotero.Library} targetLibrary - library to replicate into
	 */
	this.replicate = async function (sourceLibrary, targetLibrary) {
		let sourceLibraryID = sourceLibrary.libraryID;
		let targetLibraryID = targetLibrary.libraryID;

		// Load all items in the target library
		await Zotero.Items.getAll(targetLibrary.libraryID);

		// Copy top-level items
		let topLevelItems = await Zotero.Items.getAll(sourceLibraryID, true);
		await Zotero.Utilities.Internal.forEachChunkAsync(topLevelItems, 100, (chunk) => {
			return Zotero.DB.executeTransaction(async () => {
				for (let item of chunk) {
					await Zotero.Items.copyToLibrary(item, targetLibrary.libraryID);
				}
			});
		});
		// Copy top-level collections. Child collections will be copied recursively.
		let collections = Zotero.Collections.getByLibrary(sourceLibraryID);
		for (let collection of collections) {
			await Zotero.Collections.replicate(collection, targetLibrary);
		}
		// Move child collections linked to top-level collections to top level
		let collectionsInTargetLibrary = Zotero.Collections.getByLibrary(targetLibraryID, true);
		await Zotero.Utilities.Internal.forEachChunkAsync(collectionsInTargetLibrary, 50, (chunk) => {
			return Zotero.DB.executeTransaction(async () => {
				for (let col of chunk) {
					let linkedCol = await col.getLinkedCollection(sourceLibraryID, true);
					if (linkedCol && !linkedCol.parentID && col.parentID) {
						col.parentID = null;
						await col.save();
					}
				}
			});
		});

		// Delete top level collections in target library that are not linked to anything in source library
		let topLevelCollectionsInTargetLibrary = Zotero.Collections.getByLibrary(targetLibraryID);
		await Zotero.Utilities.Internal.forEachChunkAsync(topLevelCollectionsInTargetLibrary, 50, (chunk) => {
			return Zotero.DB.executeTransaction(async () => {
				for (let col of chunk) {
					let linkedCol = await col.getLinkedCollection(sourceLibraryID, true);
					if (!linkedCol) {
						col.deleted = true;
						await col.save();
					}
				}
			});
		});
		// Ensure that all items in target match their linked items in source library
		let itemsInTargetLibrary = await Zotero.Items.getAll(targetLibraryID, true);
		await Zotero.Utilities.Internal.forEachChunkAsync(itemsInTargetLibrary, 100, (chunk) => {
			return Zotero.DB.executeTransaction(async () => {
				for (let item of chunk) {
					await Zotero.Items.pullLinkedItemData(item, sourceLibraryID);
				}
			});
		});
	};
	
	
	/**
	 * @deprecated
	 */
	this.getName = function (libraryID) {
		Zotero.debug("Zotero.Libraries.getName() is deprecated. Use Zotero.Library.prototype.name instead");
		this._ensureExists(libraryID);
		return Zotero.Libraries.get(libraryID).name;
	}
	
	
	/**
	 * @deprecated
	 */
	this.getType = function (libraryID) {
		Zotero.debug("Zotero.Libraries.getType() is deprecated. Use Zotero.Library.prototype.libraryType instead");
		this._ensureExists(libraryID);
		return Zotero.Libraries.get(libraryID).libraryType;
	}
	
	
	/**
	 * @deprecated
	 * 
	 * @param {Integer} libraryID
	 * @return {Integer}
	 */
	this.getVersion = function (libraryID) {
		Zotero.debug("Zotero.Libraries.getVersion() is deprecated. Use Zotero.Library.prototype.libraryVersion instead");
		this._ensureExists(libraryID);
		return Zotero.Libraries.get(libraryID).libraryVersion;
	}
	
	
	/**
	 * @deprecated
	 *
	 * @param {Integer} libraryID
	 * @param {Integer} version
	 * @return {Promise}
	 */
	this.setVersion = function (libraryID, version) {
		Zotero.debug("Zotero.Libraries.setVersion() is deprecated. Use Zotero.Library.prototype.libraryVersion instead");
		this._ensureExists(libraryID);
		
		let library = Zotero.Libraries.get(libraryID);
		library.libraryVersion = version;
		return library.saveTx();
	};
	
	/**
	 * @deprecated
	 */
	this.getLastSyncTime = function (libraryID) {
		Zotero.debug("Zotero.Libraries.getLastSyncTime() is deprecated. Use Zotero.Library.prototype.lastSync instead");
		this._ensureExists(libraryID);
		return Zotero.Libraries.get(libraryID).lastSync;
	};
	
	
	/**
	 * @deprecated
	 * 
	 * @param {Integer} libraryID
	 * @param {Date} lastSyncTime
	 * @return {Promise}
	 */
	this.setLastSyncTime = function (libraryID, lastSyncTime) {
		Zotero.debug("Zotero.Libraries.setLastSyncTime() is deprecated. Use Zotero.Library.prototype.lastSync instead");
		this._ensureExists(libraryID);
		
		let library = Zotero.Libraries.get(libraryID);
		library.lastSync = lastSyncTime;
		return library.saveTx();
	};
	
	/**
	 * @deprecated
	 */
	this.isEditable = function (libraryID) {
		Zotero.debug("Zotero.Libraries.isEditable() is deprecated. Use Zotero.Library.prototype.editable instead");
		this._ensureExists(libraryID);
		return Zotero.Libraries.get(libraryID).editable;
	}
	
	/**
	 * @deprecated
	 *
	 * @return {Promise}
	 */
	this.setEditable = async function (libraryID, editable) {
		Zotero.debug("Zotero.Libraries.setEditable() is deprecated. Use Zotero.Library.prototype.editable instead");
		this._ensureExists(libraryID);
		
		let library = Zotero.Libraries.get(libraryID);
		library.editable = editable;
		return library.saveTx();
	};
	
	/**
	 * @deprecated
	 */
	this.isFilesEditable = function (libraryID) {
		Zotero.debug("Zotero.Libraries.isFilesEditable() is deprecated. Use Zotero.Library.prototype.filesEditable instead");
		this._ensureExists(libraryID);
		return Zotero.Libraries.get(libraryID).filesEditable;
	};
	
	/**
	 * @deprecated
	 * 
	 * @return {Promise}
	 */
	this.setFilesEditable = async function (libraryID, filesEditable) {
		Zotero.debug("Zotero.Libraries.setFilesEditable() is deprecated. Use Zotero.Library.prototype.filesEditable instead");
		this._ensureExists(libraryID);
		
		let library = Zotero.Libraries.get(libraryID);
		library.filesEditable = filesEditable;
		return library.saveTx();
	};
	
	/**
	 * @deprecated
	 */
	this.isGroupLibrary = function (libraryID) {
		Zotero.debug("Zotero.Libraries.isGroupLibrary() is deprecated. Use Zotero.Library.prototype.isGroup instead");
		this._ensureExists(libraryID);
		return !!Zotero.Libraries.get(libraryID).isGroup;
	}
	
	/**
	 * @deprecated
	 */
	this.hasTrash = function (libraryID) {
		Zotero.debug("Zotero.Libraries.hasTrash() is deprecated. Use Zotero.Library.prototype.hasTrash instead");
		this._ensureExists(libraryID);
		return Zotero.Libraries.get(libraryID).hasTrash;
	}
	
	/**
	 * @deprecated
	 */
	this.updateLastSyncTime = async function (libraryID) {
		Zotero.debug("Zotero.Libraries.updateLastSyncTime() is deprecated. Use Zotero.Library.prototype.updateLastSyncTime instead");
		this._ensureExists(libraryID);
		
		let library = Zotero.Libraries.get(libraryID);
		library.updateLastSyncTime();
		await library.saveTx();
	}
}