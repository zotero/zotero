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

Zotero.Library = function(params = {}) {
	let objectType = this._objectType;
	this._ObjectType = Zotero.Utilities.capitalize(objectType);
	this._objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
	this._ObjectTypePlural = Zotero.Utilities.capitalize(this._objectTypePlural);
	
	this._changed = {};
	
	this._dataLoaded = {};
	this._dataLoadedDeferreds = {};
	
	this._hasCollections = null;
	this._hasSearches = null;
	this._storageDownloadNeeded = false;
	
	Zotero.Utilities.assignProps(
		this,
		params,
		[
			'libraryType',
			'editable',
			'filesEditable',
			'libraryVersion',
			'storageVersion',
			'lastSync',
			'archived'
		]
	);
	
	// Return a proxy so that we can disable the object once it's deleted
	return new Proxy(this, {
		get: function(obj, prop) {
			if (obj._disabled && !(prop == 'libraryID' || prop == 'id')) {
				throw new Error("Library (" + obj.libraryID + ") has been disabled");
			}
			return obj[prop];
		}
	});
};

/**
 * Non-prototype properties
 */
// DB columns
Zotero.defineProperty(Zotero.Library, '_dbColumns', {
	value: Object.freeze([
		'type', 'editable', 'filesEditable', 'version', 'storageVersion', 'lastSync', 'archived'
	])
});

// Converts DB column name to (internal) object property
Zotero.Library._colToProp = function(c) {
	return "_library" + Zotero.Utilities.capitalize(c);
}

// Select all columns in a unique manner, so we can JOIN tables with same column names (e.g. version)
Zotero.defineProperty(Zotero.Library, '_rowSQLSelect', {
	value: "L.libraryID, " + Zotero.Library._dbColumns.map(c => "L." + c + " AS " + Zotero.Library._colToProp(c)).join(", ")
		+ ", (SELECT COUNT(*)>0 FROM collections C WHERE C.libraryID=L.libraryID) AS hasCollections"
		+ ", (SELECT COUNT(*)>0 FROM savedSearches S WHERE S.libraryID=L.libraryID) AS hasSearches"
});

// The actual select statement for above columns
Zotero.defineProperty(Zotero.Library, '_rowSQL', {
	value: "SELECT " + Zotero.Library._rowSQLSelect + " FROM libraries L"
});

/**
 * Prototype properties
 */
Zotero.defineProperty(Zotero.Library.prototype, '_objectType', {
	value: 'library'
});

Zotero.defineProperty(Zotero.Library.prototype, '_childObjectTypes', {
	value: Object.freeze(['item', 'collection', 'search'])
});

// Valid library types
Zotero.defineProperty(Zotero.Library.prototype, 'libraryTypes', {
	value: Object.freeze(['user'])
});

// Immutable libraries
Zotero.defineProperty(Zotero.Library.prototype, 'fixedLibraries', {
	value: Object.freeze(['user'])
});

Zotero.defineProperty(Zotero.Library.prototype, 'libraryID', {
	get: function() { return this._libraryID; },
	set: function(id) { throw new Error("Cannot change library ID"); }
});

Zotero.defineProperty(Zotero.Library.prototype, 'id', {
	get: function() { return this.libraryID; },
	set: function(val) { return this.libraryID = val; }
});

Zotero.defineProperty(Zotero.Library.prototype, 'libraryType', {
	get: function() { return this._get('_libraryType'); },
	set: function(v) { return this._set('_libraryType', v); }
});

/**
 * Get the library-type-specific id for the library (e.g., userID for user library,
 * groupID for group library)
 *
 * @property
 */
Zotero.defineProperty(Zotero.Library.prototype, 'libraryTypeID', {
	get: function () {
		switch (this._libraryType) {
		case 'user':
			return Zotero.Users.getCurrentUserID();
		
		case 'group':
			return Zotero.Groups.getGroupIDFromLibraryID(this._libraryID);
		
		default:
			throw new Error(`Tried to get library type id for ${this._libraryType} library`);
		}
	}
});

Zotero.defineProperty(Zotero.Library.prototype, 'libraryVersion', {
	get: function() { return this._get('_libraryVersion'); },
	set: function(v) { return this._set('_libraryVersion', v); }
});


Zotero.defineProperty(Zotero.Library.prototype, 'syncable', {
	get: function () { return this._libraryType != 'feed'; }
});


Zotero.defineProperty(Zotero.Library.prototype, 'lastSync', {
	get: function() { return this._get('_libraryLastSync'); }
});


Zotero.defineProperty(Zotero.Library.prototype, 'name', {
	get: function() {
		if (this._libraryType == 'user') {
			return Zotero.getString('pane.collections.library');
		}
		
		// This property is provided by the extending objects (Group, Feed) for other library types
		throw new Error('Unhandled library type "' + this._libraryType + '"');
	}
});

Zotero.defineProperty(Zotero.Library.prototype, 'treeViewID', {
	get: function () {
		return "L" + this._libraryID
	}
});

Zotero.defineProperty(Zotero.Library.prototype, 'treeViewImage', {
	get: function () {
		return "chrome://zotero/skin/treesource-library" + Zotero.hiDPISuffix + ".png";
	}
});

Zotero.defineProperty(Zotero.Library.prototype, 'hasTrash', {
	value: true
});

Zotero.defineProperty(Zotero.Library.prototype, 'allowsLinkedFiles', {
	value: true
});

// Create other accessors
(function() {
	let accessors = ['editable', 'filesEditable', 'storageVersion', 'archived'];
	for (let i=0; i<accessors.length; i++) {
		let prop = Zotero.Library._colToProp(accessors[i]);
		Zotero.defineProperty(Zotero.Library.prototype, accessors[i], {
			get: function() { return this._get(prop); },
			set: function(v) { return this._set(prop, v); }
		})
	}
})()

Zotero.defineProperty(Zotero.Library.prototype, 'storageDownloadNeeded', {
	get: function () { return this._storageDownloadNeeded; },
	set: function (val) { this._storageDownloadNeeded = !!val; },
})

Zotero.Library.prototype._isValidProp = function(prop) {
	let prefix = '_library';
	if (prop.indexOf(prefix) !== 0 || prop.length == prefix.length) {
		return false;
	}
	
	let col = prop.substr(prefix.length);
	col = col.charAt(0).toLowerCase() + col.substr(1);
	
	return Zotero.Library._dbColumns.indexOf(col) != -1;
}

Zotero.Library.prototype._get = function(prop) {
	if (!this._isValidProp(prop)) {
		throw new Error('Unknown property "' + prop + '"');
	}
	
	return this[prop];
}

Zotero.Library.prototype._set = function(prop, val) {
	if (!this._isValidProp(prop)) {
		throw new Error('Unknown property "' + prop + '"');
	}
	
	// Ensure proper format
	switch(prop) {
		case '_libraryType':
			if (this.libraryTypes.indexOf(val) == -1) {
				throw new Error('Invalid library type "' + val + '"');
			}
			
			if (this.libraryID !== undefined) {
				throw new Error("Library type cannot be changed for a saved library");
			}
			
			if (this.fixedLibraries.indexOf(val) != -1) {
				throw new Error('Cannot create library of type "' + val + '"');
			}
			break;
		
		case '_libraryEditable':
		case '_libraryFilesEditable':
			if (['user'].indexOf(this._libraryType) != -1) {
				throw new Error('Cannot change ' + prop + ' for ' + this._libraryType + ' library');
			}
			val = !!val;
			
			// Setting 'editable' to false should also set 'filesEditable' to false
			if (prop == '_libraryEditable' && !val) {
				this._set('_libraryFilesEditable', false);
			}
			break;
		
		case '_libraryVersion':
			var newVal = Number.parseInt(val, 10);
			if (newVal != val) {
				throw new Error(`${prop} must be an integer (${typeof val} '${val}' given)`);
			}
			val = newVal
			
			// Allow -1 to indicate that a full sync is needed
			if (val < -1) throw new Error(prop + ' must not be less than -1');
			
			// Ensure that it is never decreasing, unless it is being set to -1
			if (val != -1 && val < this._libraryVersion) throw new Error(prop + ' cannot decrease');
			
			break;
		
		case '_libraryStorageVersion':
			var newVal = parseInt(val);
			if (newVal != val) {
				throw new Error(`${prop} must be an integer (${typeof val} '${val}' given)`);
			}
			val = newVal;
			
			// Ensure that it is never decreasing
			if (val < this._libraryStorageVersion) throw new Error(prop + ' cannot decrease');
			break;
		
		case '_libraryLastSync':
			if (!val) {
				val = false;
			} else if (!(val instanceof Date)) {
				throw new Error(prop + ' must be a Date object or falsy');
			} else {
				// Storing to DB will drop milliseconds, so, for consistency, we drop it now
				val = new Date(Math.floor(val.getTime()/1000) * 1000);
			}
			break;
		
		case '_libraryArchived':
			if (['user', 'feeds'].indexOf(this._libraryType) != -1) {
				throw new Error('Cannot change ' + prop + ' for ' + this._libraryType + ' library');
			}
			if (val && this._libraryEditable) {
				throw new Error('Cannot set editable library as archived');
			}
			val = !!val;
			break;
	}
	
	if (this[prop] == val) return; // Unchanged
	
	if (this._changed[prop]) {
		// Catch attempts to re-set already set fields before saving
		Zotero.debug('Warning: Attempting to set unsaved ' + this._objectType + ' property "' + prop + '"', 2, true);
	}
	
	this._changed[prop] = true;
	this[prop] = val;
}

Zotero.Library.prototype._loadDataFromRow = function(row) {
	if (this._libraryID !== undefined && this._libraryID !== row.libraryID) {
		Zotero.debug("Warning: library ID changed in Zotero.Library._loadDataFromRow", 2, true);
	}
	
	this._libraryID = row.libraryID;
	this._libraryType = row._libraryType;
	
	this._libraryEditable = !!row._libraryEditable;
	this._libraryFilesEditable = !!row._libraryFilesEditable;
	this._libraryVersion = row._libraryVersion;
	this._libraryStorageVersion = row._libraryStorageVersion;
	this._libraryLastSync =  row._libraryLastSync !== 0 ? new Date(row._libraryLastSync * 1000) : false;
	this._libraryArchived = !!row._libraryArchived;
	
	this._hasCollections = !!row.hasCollections;
	this._hasSearches = !!row.hasSearches;
	
	this._changed = {};
}

Zotero.Library.prototype._reloadFromDB = Zotero.Promise.coroutine(function* () {
	let sql = Zotero.Library._rowSQL + ' WHERE libraryID=?';
	let row = yield Zotero.DB.rowQueryAsync(sql, [this.libraryID]);
	this._loadDataFromRow(row);
});

/**
 * Load object data in this library
 */
Zotero.Library.prototype.loadAllDataTypes = Zotero.Promise.coroutine(function* () {
	yield Zotero.SyncedSettings.loadAll(this.libraryID);
	yield Zotero.Collections.loadAll(this.libraryID);
	yield Zotero.Searches.loadAll(this.libraryID);
	yield Zotero.Items.loadAll(this.libraryID);
});

//
// Methods to handle promises that are resolved when object data is loaded for the library
//
Zotero.Library.prototype.getDataLoaded = function (objectType) {
	return this._dataLoaded[objectType] || null;
};

Zotero.Library.prototype.setDataLoading = function (objectType) {
	if (this._dataLoadedDeferreds[objectType]) {
		throw new Error("Items already loading for library " + this.libraryID);
	}
	this._dataLoadedDeferreds[objectType] = Zotero.Promise.defer();
};

Zotero.Library.prototype.getDataLoadedPromise = function (objectType) {
	return this._dataLoadedDeferreds[objectType]
		? this._dataLoadedDeferreds[objectType].promise : null;
};

Zotero.Library.prototype.setDataLoaded = function (objectType) {
	this._dataLoaded[objectType] = true;
	this._dataLoadedDeferreds[objectType].resolve();
};

/**
 * Wait for a given data type to load, loading it now if necessary
 */
Zotero.Library.prototype.waitForDataLoad = Zotero.Promise.coroutine(function* (objectType) {
	if (this.getDataLoaded(objectType)) return;
	
	let promise = this.getDataLoadedPromise(objectType);
	// If items are already being loaded, wait for them
	if (promise) {
		yield promise;
	}
	// Otherwise load them now
	else {
		let objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		yield objectsClass.loadAll(this.libraryID);
	}
});

Zotero.Library.prototype.isChildObjectAllowed = function(type) {
	return this._childObjectTypes.indexOf(type) != -1;
};

Zotero.Library.prototype.updateLastSyncTime = function() {
	this._set('_libraryLastSync', new Date());
};

Zotero.Library.prototype.saveTx = function(options) {
	options = options || {};
	options.tx = true;
	return this.save(options);
}

Zotero.Library.prototype.save = Zotero.Promise.coroutine(function* (options) {
	options = options || {};
	var env = {
		options: options,
		transactionOptions: options.transactionOptions || {}
	};
	
	if (!env.options.tx && !Zotero.DB.inTransaction()) {
		Zotero.logError("save() called on Zotero.Library without a wrapping "
			+ "transaction -- use saveTx() instead", 2, true);
		env.options.tx = true;
	}
	
	var proceed = yield this._initSave(env)
		.catch(Zotero.Promise.coroutine(function* (e) {
			if (!env.isNew && Zotero.Libraries.exists(this.libraryID)) {
				// Reload from DB and reset this._changed, so this is not a permanent failure
				yield this._reloadFromDB();
			}
			throw e;
		}).bind(this));
	
	if (!proceed) return false;
	
	if (env.isNew) {
		Zotero.debug('Saving data for new ' + this._objectType + ' to database', 4);
	}
	else {
		Zotero.debug('Updating database with new ' + this._objectType + ' data', 4);
	}
	
	try {
		env.notifierData = {};
		if (env.options.skipSelect) {
			env.notifierData.skipSelect = true;
		}
		
		// Create transaction
		if (env.options.tx) {
			return Zotero.DB.executeTransaction(function* () {
				yield this._saveData(env);
				yield this._finalizeSave(env);
			}.bind(this), env.transactionOptions);
		}
		// Use existing transaction
		else {
			Zotero.DB.requireTransaction();
			yield this._saveData(env);
			yield this._finalizeSave(env);
		}
	} catch(e) {
		Zotero.debug(e, 1);
		throw e;
	}
});

Zotero.Library.prototype._initSave = Zotero.Promise.method(function(env) {
	if (this._libraryID === undefined) {
		env.isNew = true;
		
		if (!this._libraryType) {
			throw new Error("libraryType must be set before saving");
		}
		
		if (typeof this._libraryEditable != 'boolean') {
			throw new Error("editable must be set before saving");
		}
		
		if (typeof this._libraryFilesEditable != 'boolean') {
			throw new Error("filesEditable must be set before saving");
		}
	} else {
		Zotero.Libraries._ensureExists(this._libraryID);
		
		if (!Object.keys(this._changed).length) {
			Zotero.debug(`No data changed in ${this._objectType} ${this.id} -- not saving`, 4);
			return false;
		}
	}
	
	return true;
});

Zotero.Library.prototype._saveData = Zotero.Promise.coroutine(function* (env) {
	// Collect changed columns
	let changedCols = [],
		params = [];
	for (let i=0; i<Zotero.Library._dbColumns.length; i++) {
		let col = Zotero.Library._dbColumns[i];
		let prop = Zotero.Library._colToProp(col);
		
		if (this._changed[prop]) {
			changedCols.push(col);
			
			let val = this[prop];
			if (col == 'lastSync') {
				// convert to integer
				val = val ? Math.floor(val.getTime() / 1000) : 0;
			}
			else if (typeof val == 'boolean') {
				val = val ? 1 : 0;
			}
			
			params.push(val);
		}
	}
	
	if (env.isNew) {
		let id = Zotero.ID.get('libraries');
		changedCols.unshift('libraryID');
		params.unshift(id);
		
		let sql = "INSERT INTO libraries (" + changedCols.join(", ") + ") "
			+ "VALUES (" + Array(params.length).fill("?").join(", ") + ")";
		yield Zotero.DB.queryAsync(sql, params);
		
		this._libraryID = id;
	} else if (changedCols.length) {
		params.push(this.libraryID);
		let sql = "UPDATE libraries SET " + changedCols.map(v => v + "=?").join(", ")
			+ " WHERE libraryID=?";
		yield Zotero.DB.queryAsync(sql, params);
		
		// Since these are Zotero.Library properties, the 'modify' for the inheriting object may not
		// get triggered, so call it here too
		if (!env.options.skipNotifier && this.libraryType != 'user') {
			Zotero.Notifier.queue('modify', this.libraryType, this.libraryTypeID);
		}
	} else {
		Zotero.debug("Library data did not change for " + this._objectType + " " + this.id, 5);
	}
});

Zotero.Library.prototype._finalizeSave = Zotero.Promise.coroutine(function* (env) {
	this._changed = {};
	
	if (env.isNew) {
		// Re-fetch from DB to get auto-filled defaults
		yield this._reloadFromDB();
		
		Zotero.Libraries.register(this);
		
		yield this.loadAllDataTypes();
	}
});

Zotero.Library.prototype.eraseTx = function(options) {
	options = options || {};
	options.tx = true;
	return this.erase(options);
};

Zotero.Library.prototype.erase = Zotero.Promise.coroutine(function* (options) {
	options = options || {};
	var env = {
		options: options,
		transactionOptions: options.transactionOptions || {}
	};
	
	if (!env.options.tx && !Zotero.DB.inTransaction()) {
		Zotero.logError("erase() called on Zotero." + this._ObjectType + " without a wrapping "
			+ "transaction -- use eraseTx() instead");
		Zotero.debug((new Error).stack, 2);
		env.options.tx = true;
	}
	
	var proceed = yield this._initErase(env);
	if (!proceed) return false;
	
	Zotero.debug('Deleting ' + this._objectType + ' ' + this.id);
	
	try {
		env.notifierData = {};
		
		if (env.options.tx) {
			yield Zotero.DB.executeTransaction(function* () {
				yield this._eraseData(env);
				yield this._finalizeErase(env);
			}.bind(this), env.transactionOptions);
		} else {
			Zotero.DB.requireTransaction();
			yield this._eraseData(env);
			yield this._finalizeErase(env);
		}
	} catch(e) {
		Zotero.debug(e, 1);
		throw e;
	}
});

Zotero.Library.prototype._initErase = Zotero.Promise.method(function(env) {
	if (this.libraryID === undefined) {
		throw new Error("Attempting to erase an unsaved library");
	}
	
	Zotero.Libraries._ensureExists(this.libraryID);
	
	if (this.fixedLibraries.indexOf(this._libraryType) != -1) {
		throw new Error("Cannot erase library of type '" + this._libraryType + "'");
	}
	
	return true;
});

Zotero.Library.prototype._eraseData = async function (env) {
	// Delete attachment files
	var attachmentKeys = await Zotero.DB.columnQueryAsync(
		"SELECT key FROM items WHERE libraryID=? AND itemID IN "
			+ "(SELECT itemID FROM itemAttachments WHERE linkMode IN (?, ?))",
		[
			this.libraryID,
			Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
			Zotero.Attachments.LINK_MODE_IMPORTED_URL
		]
	);
	if (attachmentKeys.length) {
		Zotero.DB.addCurrentCallback('commit', async function () {
			for (let key of attachmentKeys) {
				try {
					let dir = Zotero.Attachments.getStorageDirectoryByLibraryAndKey(
						this.libraryID, key
					).path;
					await OS.File.removeDir(
						dir,
						{
							ignoreAbsent: true,
							ignorePermissions: true
						}
					);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		}.bind(this));
	}
	
	await Zotero.DB.queryAsync("DELETE FROM libraries WHERE libraryID=?", this.libraryID);
	// TODO: Emit event so this doesn't have to be here
	await Zotero.Fulltext.clearLibraryVersion(this.libraryID);
};

Zotero.Library.prototype._finalizeErase = Zotero.Promise.coroutine(function* (env) {
	Zotero.Libraries.unregister(this.libraryID);
	
	// Clear cached child objects
	for (let i=0; i<this._childObjectTypes.length; i++) {
		let type = this._childObjectTypes[i];
		Zotero.DataObjectUtilities.getObjectsClassForObjectType(type)
			.dropDeadObjectsFromCache();
	}
	
	this._disabled = true;
});

Zotero.Library.prototype.hasCollections = function () {
	if (this._hasCollections === null) {
		throw new Error("Collection data has not been loaded");
	}
	
	return this._hasCollections;
}

Zotero.Library.prototype.updateCollections = Zotero.Promise.coroutine(function* () {
	let sql = 'SELECT COUNT(*)>0 FROM collections WHERE libraryID=?';
	this._hasCollections = !!(yield Zotero.DB.valueQueryAsync(sql, this.libraryID));
});

Zotero.Library.prototype.hasSearches = function () {
	if (this._hasSearches === null) {
		throw new Error("Saved search data has not been loaded");
	}
	
	return this._hasSearches;
}

Zotero.Library.prototype.updateSearches = Zotero.Promise.coroutine(function* () {
	let sql = 'SELECT COUNT(*)>0 FROM savedSearches WHERE libraryID=?';
	this._hasSearches = !!(yield Zotero.DB.valueQueryAsync(sql, this.libraryID));
});

Zotero.Library.prototype.hasItems = Zotero.Promise.coroutine(function* () {
	if (!this.id) {
		throw new Error("Library is not saved yet");
	}
	let sql = 'SELECT COUNT(*)>0 FROM items WHERE libraryID=?';
	// Don't count old <=4.0 Quick Start Guide items
	if (this.libraryID == Zotero.Libraries.userLibraryID) {
		sql += "AND key NOT IN ('ABCD2345', 'ABCD3456')";
	}
	return !!(yield Zotero.DB.valueQueryAsync(sql, this.libraryID));
});

Zotero.Library.prototype.hasItem = function (item) {
	if (!(item instanceof Zotero.Item)) {
		throw new Error("item must be a Zotero.Item");
	}
	return item.libraryID == this.libraryID;
}