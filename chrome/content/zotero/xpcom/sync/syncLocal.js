/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2014 Center for History and New Media
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

Zotero.Sync.Data.Local = {
	_lastSyncTime: null,
	_lastClassicSyncTime: null,
	
	init: Zotero.Promise.coroutine(function* () {
		yield this._loadLastSyncTime();
		if (!_lastSyncTime) {
			yield this._loadLastClassicSyncTime();
		}
	}),
	
	
	getLastSyncTime: function () {
		if (_lastSyncTime === null) {
			throw new Error("Last sync time not yet loaded");
		}
		return _lastSyncTime;
	},
	
	
	/**
	 * @return {Promise}
	 */
	updateLastSyncTime: function () {
		_lastSyncTime = new Date();
		return Zotero.DB.queryAsync(
			"REPLACE INTO version (schema, version) VALUES ('lastsync', ?)",
			Math.round(_lastSyncTime.getTime() / 1000)
		);
	},
	
	
	_loadLastSyncTime: Zotero.Promise.coroutine(function* () {
		var sql = "SELECT version FROM version WHERE schema='lastsync'";
		var lastsync = yield Zotero.DB.valueQueryAsync(sql);
		_lastSyncTime = (lastsync ? new Date(lastsync * 1000) : false);
	}),
	
	
	/**
	 * @param {Integer} libraryID
	 * @return {Promise<String[]>} - A promise for an array of object keys
	 */
	getSynced: function (libraryID, objectType) {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		var sql = "SELECT key FROM " + objectsClass.table + " WHERE libraryID=? AND synced=1";
		return Zotero.DB.columnQueryAsync(sql, [libraryID]);
	},
	
	
	/**
	 * @param {Integer} libraryID
	 * @return {Promise<Integer[]>} - A promise for an array of object ids
	 */
	getUnsynced: Zotero.Promise.coroutine(function* (libraryID, objectType) {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		var sql = "SELECT " + objectsClass.idColumn + " FROM " + objectsClass.table
			+ " WHERE libraryID=? AND synced=0";
		
		// RETRIEVE PARENT DOWN? EVEN POSSIBLE?
		// items via parent
		// collections via getDescendents?
		
		return Zotero.DB.columnQueryAsync(sql, [libraryID]);
	}),
	
	
	//
	// Cache management
	//
	/**
	 * Gets the latest version for each object of a given type in the given library
	 *
	 * @return {Promise<Object>} - A promise for an object with object keys as keys and versions
	 *                             as properties
	 */
	getLatestCacheObjectVersions: Zotero.Promise.coroutine(function* (libraryID, objectType) {
		var sql = "SELECT key, version FROM syncCache WHERE libraryID=? AND "
			+ "syncObjectTypeID IN (SELECT syncObjectTypeID FROM "
			+ "syncObjectTypes WHERE name=?) ORDER BY version";
		var rows = yield Zotero.DB.queryAsync(sql, [libraryID, objectType]);
		var versions = {};
		for (let i = 0; i < rows.length; i++) {
			let row = rows[i];
			versions[row.key] = row.version;
		}
		return versions;
	}),
	
	
	/**
	 * @return {Promise<Integer[]>} - A promise for an array of object versions
	 */
	getCacheObjectVersions: function (objectType, libraryID, key) {
		var sql = "SELECT version FROM syncCache WHERE libraryID=? AND key=? "
			+ "AND syncObjectTypeID IN (SELECT syncObjectTypeID FROM "
			+ "syncObjectTypes WHERE name=?) ORDER BY version";
		return Zotero.DB.columnQueryAsync(sql, [libraryID, key, objectType]);
	},
	
	
	/**
	 * @return {Promise<Number>} - A promise for an object version
	 */
	getLatestCacheObjectVersion: function (objectType, libraryID, key) {
		var sql = "SELECT version FROM syncCache WHERE libraryID=? AND key=? "
			+ "AND syncObjectTypeID IN (SELECT syncObjectTypeID FROM "
			+ "syncObjectTypes WHERE name=?) ORDER BY VERSION DESC LIMIT 1";
		return Zotero.DB.valueQueryAsync(sql, [libraryID, key, objectType]);
	},
	
	
	/**
	 * @return {Promise}
	 */
	getCacheObject: Zotero.Promise.coroutine(function* (objectType, libraryID, key, version) {
		var sql = "SELECT data FROM syncCache WHERE libraryID=? AND key=? AND version=? "
			+ "AND syncObjectTypeID IN (SELECT syncObjectTypeID FROM "
			+ "syncObjectTypes WHERE name=?)";
		var data = yield Zotero.DB.valueQueryAsync(sql, [libraryID, key, version, objectType]);
		if (data) {
			return JSON.parse(data);
		}
		return false;
	}),
	
	
	saveCacheObjects: Zotero.Promise.coroutine(function* (objectType, libraryID, jsonArray) {
		if (!Array.isArray(jsonArray)) {
			throw new Error("'json' must be an array");
		}
		
		if (!jsonArray.length) {
			Zotero.debug("No " + Zotero.DataObjectUtilities.getObjectTypePlural(objectType)
				+ " to save to sync cache");
			return;
		}
		
		jsonArray = jsonArray.map(o => {
			if (o.key === undefined) {
				throw new Error("Missing 'key' property in JSON");
			}
			if (o.version === undefined) {
				throw new Error("Missing 'version' property in JSON");
			}
			// If direct data object passed, wrap in fake response object
			return o.data === undefined ? {
				key: o.key,
				version: o.version,
				data: o
			} : o;
		});
		
		Zotero.debug("Saving to sync cache:");
		Zotero.debug(jsonArray);
		
		var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
		var sql = "INSERT OR REPLACE INTO syncCache "
			+ "(libraryID, key, syncObjectTypeID, version, data) VALUES ";
		var chunkSize = Math.floor(Zotero.DB.MAX_BOUND_PARAMETERS / 5);
		return Zotero.DB.executeTransaction(function* () {
			return Zotero.Utilities.Internal.forEachChunkAsync(
				jsonArray,
				chunkSize,
				Zotero.Promise.coroutine(function* (chunk) {
					var params = [];
					for (let i = 0; i < chunk.length; i++) {
						let o = chunk[i];
						params.push(libraryID, o.key, syncObjectTypeID, o.version, JSON.stringify(o));
					}
					return Zotero.DB.queryAsync(
						sql + chunk.map(() => "(?, ?, ?, ?, ?)").join(", "), params
					);
				})
			);
		}.bind(this));
	}),
	
	
	processSyncCache: Zotero.Promise.coroutine(function* (libraryID, options) {
		for (let objectType of Zotero.DataObjectUtilities.getTypesForLibrary(libraryID)) {
			yield this.processSyncCacheForObjectType(libraryID, objectType, options);
		}
	}),
	
	
	processSyncCacheForObjectType: Zotero.Promise.coroutine(function* (libraryID, objectType, options) {
		options = options || {};
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		var ObjectType = Zotero.Utilities.capitalize(objectType);
		var libraryName = Zotero.Libraries.getName(libraryID);
		
		Zotero.debug("Processing " + objectTypePlural + " in sync cache for " + libraryName);
		
		var conflicts = [];
		var numSaved = 0;
		var numSkipped = 0;
		
		var data = yield this._getUnwrittenData(libraryID, objectType);
		
		if (!data.length) {
			Zotero.debug("No unwritten " + objectTypePlural + " in sync cache");
			return;
		}
		
		Zotero.debug("Processing " + data.length + " "
			+ (data.length == 1 ? objectType : objectTypePlural)
			+ " in sync cache");
		
		if (options.setStatus) {
			options.setStatus("Processing " + objectTypePlural); // TODO: localize
		}
		
		// Sort parent objects first, to avoid retries due to unmet dependencies
		if (objectType == 'item' || objectType == 'collection') {
			let parentProp = 'parent' + objectType[0].toUpperCase() + objectType.substr(1);
			data.sort(function (a, b) {
				if (a[parentProp] && !b[parentProp]) return 1;
				if (b[parentProp] && !a[parentProp]) return -1;
				return 0;
			});
		}
		
		var concurrentObjects = 5;
		yield Zotero.Utilities.Internal.forEachChunkAsync(
			data,
			concurrentObjects,
			function (chunk) {
				return Zotero.DB.executeTransaction(function* () {
					for (let i = 0; i < chunk.length; i++) {
						let json = chunk[i];
						let jsonData = json.data;
						let isNewObject;
						let objectKey = json.key;
						
						Zotero.debug(json);
						
						if (!jsonData) {
							Zotero.logError(new Error("Missing 'data' object in JSON in sync cache for "
								+ objectType + " " + libraryID + "/" + objectKey));
							continue;
						}
						
						// Skip objects with unmet dependencies
						if (objectType == 'item' || objectType == 'collection') {
							let parentProp = 'parent' + objectType[0].toUpperCase() + objectType.substr(1);
							let parentKey = jsonData[parentProp];
							if (parentKey) {
								let parentObj = yield objectsClass.getByLibraryAndKeyAsync(
									libraryID, parentKey, { noCache: true }
								);
								if (!parentObj) {
									Zotero.debug("Parent of " + objectType + " "
										+ libraryID + "/" + jsonData.key + " not found -- skipping");
									// TEMP: Add parent to a queue, in case it's somehow missing
									// after retrieving all objects?
									numSkipped++;
									continue;
								}
							}
							
							/*if (objectType == 'item') {
								for (let j = 0; j < jsonData.collections.length; i++) {
									let parentKey = jsonData.collections[j];
									let parentCollection = Zotero.Collections.getByLibraryAndKey(
										libraryID, parentKey, { noCache: true }
									);
									if (!parentCollection) {
										// ???
									}
								}
							}*/
						}
						
						let obj = yield objectsClass.getByLibraryAndKeyAsync(
							libraryID, objectKey, { noCache: true }
						);
						if (obj) {
							Zotero.debug("Matching local " + objectType + " exists", 4);
							isNewObject = false;
							
							// Local object has not been modified since last sync
							if (obj.synced) {
								// Overwrite local below
							}
							else {
								Zotero.debug("Local " + objectType + " " + obj.libraryKey
										+ " has been modified since last sync", 4);
								
								let cachedJSON = yield this.getCacheObject(
									objectType, obj.libraryID, obj.key, obj.version
								);
								Zotero.debug("GOT CACHED");
								Zotero.debug(cachedJSON);
								
								let jsonDataLocal = yield obj.toJSON();
								
								let result = this._reconcileChanges(
									objectType,
									cachedJSON.data,
									jsonDataLocal,
									jsonData,
									['dateAdded', 'dateModified']
								);
								
								// If no changes, update local version and keep as unsynced
								if (!result.changes.length && !result.conflicts.length) {
									Zotero.debug("No remote changes to apply to local " + objectType
										+ " " + obj.libraryKey);
									yield obj.updateVersion(json.version);
									continue;
								}
								
								// If no conflicts, apply remote changes automatically
								if (!result.conflicts.length) {
									Zotero.DataObjectUtilities.applyChanges(
										jsonData, result.changes
									);
									let saved = yield this._saveObjectFromJSON(obj, jsonData, options);
									if (saved) numSaved++;
									continue;
								}
								
								if (objectType != 'item') {
									throw new Error(`Unexpected conflict on ${objectType} object`);
								}
								
								conflicts.push({
									left: jsonDataLocal,
									right: jsonData,
									changes: result.changes,
									conflicts: result.conflicts
								});
								continue;
							}
							
							let saved = yield this._saveObjectFromJSON(obj, jsonData, options);
							if (saved) numSaved++;
						}
						// Object doesn't exist locally
						else {
							isNewObject = true;
							
							// Check if object has been deleted locally
							let dateDeleted = yield this.getDateDeleted(
								objectType, libraryID, objectKey
							);
							if (dateDeleted) {
								switch (objectType) {
								case 'item':
									conflicts.push({
										left: {
											deleted: true,
											dateDeleted: Zotero.Date.dateToSQL(dateDeleted, true)
										},
										right: jsonData
									});
									continue;
								
								// Auto-restore some locally deleted objects that have changed remotely
								case 'collection':
								case 'search':
									yield this._removeObjectFromDeleteLog(
										objectType,
										libraryID,
										objectKey
									);
									
									throw new Error("Unimplemented");
									break;
								
								default:
									throw new Error("Unknown object type '" + objectType + "'");
								}
							}
							
							// Create new object
							obj = new Zotero[ObjectType];
							obj.libraryID = libraryID;
							obj.key = objectKey;
							yield obj.loadPrimaryData();
							
							let saved = yield this._saveObjectFromJSON(obj, jsonData, options, {
								// Don't cache new items immediately, which skips reloading after save
								skipCache: true
							});
							if (saved) numSaved++;
						}
					}
				}.bind(this));
			}.bind(this)
		);
		
		// Keep retrying if we skipped any, as long as we're still making progress
		if (numSkipped && numSaved != 0) {
			Zotero.debug("More " + objectTypePlural + " in cache -- continuing");
			yield this.processSyncCacheForObjectType(libraryID, objectType, options);
		}
		
		if (conflicts.length) {
			conflicts.sort(function (a, b) {
				var d1 = a.left.dateDeleted || a.left.dateModified;
				var d2 = b.left.dateDeleted || b.left.dateModified;
				if (d1 > d2) {
					return 1
				}
				if (d1 < d2) {
					return -1;
				}
				return 0;
			})
			
			var mergeData = this.resolveConflicts(conflicts);
			if (mergeData) {
				let mergeOptions = {};
				Object.assign(mergeOptions, options);
				// Tell _saveObjectFromJSON not to save with 'synced' set to true
				mergeOptions.saveAsChanged = true;
				let concurrentObjects = 50;
				yield Zotero.Utilities.Internal.forEachChunkAsync(
					mergeData,
					concurrentObjects,
					function (chunk) {
						return Zotero.DB.executeTransaction(function* () {
							for (let json of chunk) {
								let obj = yield objectsClass.getByLibraryAndKeyAsync(
									libraryID, json.key, { noCache: true }
								);
								// Update object with merge data
								if (obj) {
									if (json.deleted) {
										yield obj.erase();
									}
									else {
										yield this._saveObjectFromJSON(obj, json, mergeOptions);
									}
								}
								// Recreate deleted object
								else if (!json.deleted) {
									obj = new Zotero[ObjectType];
									obj.libraryID = libraryID;
									obj.key = json.key;
									yield obj.loadPrimaryData();
									
									let saved = yield this._saveObjectFromJSON(obj, json, options, {
										// Don't cache new items immediately, which skips reloading after save
										skipCache: true
									});
								}
							}
						}.bind(this));
					}.bind(this)
				);
			}
		}
		
		data = yield this._getUnwrittenData(libraryID, objectType);
		Zotero.debug("Skipping " + data.length + " "
			+ (data.length == 1 ? objectType : objectTypePlural)
			+ " in sync cache");
		return data;
	}),
	
	
	deleteCacheObject: function (objectType, libraryID, key) {
		var sql = "DELETE FROM syncCache WHERE libraryID=? AND key=? "
			+ "AND syncObjectTypeID IN (SELECT syncObjectTypeID FROM "
			+ "syncObjectTypes WHERE name=?)";;
		return Zotero.DB.queryAsync(sql, [libraryID, key, objectType]);
	},
	
	
	resolveConflicts: function (conflicts) {
		var io = {
			dataIn: {
				captions: [
					Zotero.getString('sync.conflict.localItem'),
					Zotero.getString('sync.conflict.remoteItem'),
					Zotero.getString('sync.conflict.mergedItem')
				],
				conflicts
			}
		};
		
		var url = 'chrome://zotero/content/merge.xul';
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		   .getService(Components.interfaces.nsIWindowMediator);
		var lastWin = wm.getMostRecentWindow("navigator:browser");
		if (lastWin) {
			lastWin.openDialog(url, '', 'chrome,modal,centerscreen', io);
		}
		else {
			// When using nsIWindowWatcher, the object has to be wrapped here
			// https://developer.mozilla.org/en-US/docs/Working_with_windows_in_chrome_code#Example_5_Using_nsIWindowWatcher_for_passing_an_arbritrary_JavaScript_object
			io.wrappedJSObject = io;
			let ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
				.getService(Components.interfaces.nsIWindowWatcher);
			ww.openWindow(null, url, '', 'chrome,modal,centerscreen,dialog', io);
		}
		if (io.error) {
			throw io.error;
		}
		return io.dataOut;
	},
	
	
	//
	// Classic sync
	//
	getLastClassicSyncTime: function () {
		if (_lastClassicSyncTime === null) {
			throw new Error("Last classic sync time not yet loaded");
		}
		return _lastClassicSyncTime;
	},
	
	_loadLastClassicSyncTime: Zotero.Promise.coroutine(function* () {
		var sql = "SELECT version FROM version WHERE schema='lastlocalsync'";
		var lastsync = yield Zotero.DB.valueQueryAsync(sql);
		_lastClassicSyncTime = (lastsync ? new Date(lastsync * 1000) : false);
	}),
	
	_saveObjectFromJSON: Zotero.Promise.coroutine(function* (obj, json, options) {
		try {
			yield obj.fromJSON(json);
			if (!options.saveAsChanged) {
				obj.version = json.version;
				obj.synced = true;
			}
			Zotero.debug("SAVING " + json.key + " WITH SYNCED");
			Zotero.debug(obj.version);
			yield obj.save({
				skipDateModifiedUpdate: true,
				skipSelect: true,
				errorHandler: function (e) {
					// Don't log expected errors
					if (e.name == 'ZoteroUnknownTypeError'
							&& e.name == 'ZoteroUnknownFieldError'
							&& e.name == 'ZoteroMissingObjectError') {
						return;
					}
					Zotero.debug(e, 1);
				}
			});
		}
		catch (e) {
			if (e.name == 'ZoteroUnknownTypeError'
					|| e.name == 'ZoteroUnknownFieldError'
					|| e.name == 'ZoteroMissingObjectError') {
				let desc = e.name
					.replace(/^Zotero/, "")
					// Convert "MissingObjectError" to "missing object error"
					.split(/([a-z]+)/).join(' ').trim()
					.replace(/([A-Z]) ([a-z]+)/g, "$1$2").toLowerCase();
				Zotero.logError("Ignoring " + desc + " for "
					+ obj.objectType + " " + obj.libraryKey, 2);
			}
			else if (options.stopOnError) {
				throw e;
			}
			else {
				Zotero.logError(e);
				options.onError(e);
			}
			return false;
		}
		return true;
	}),
	
	
	/**
	 * Calculate a changeset to apply locally to resolve an object conflict, plus a list of
	 * conflicts where not possible
	 */
	_reconcileChanges: function (objectType, originalJSON, currentJSON, newJSON, ignoreFields) {
		if (!originalJSON) {
			return this._reconcileChangesWithoutCache(objectType, currentJSON, newJSON, ignoreFields);
		}
		
		var changeset1 = Zotero.DataObjectUtilities.diff(originalJSON, currentJSON, ignoreFields);
		var changeset2 = Zotero.DataObjectUtilities.diff(originalJSON, newJSON, ignoreFields);
		
		var conflicts = [];
		
		for (let i = 0; i < changeset1.length; i++) {
			for (let j = 0; j < changeset2.length; j++) {
				let c1 = changeset1[i];
				let c2 = changeset2[j];
				if (c1.field != c2.field) {
					continue;
				}
				
				// Disregard member additions/deletions for different values
				if (c1.op.startsWith('member-') && c2.op.startsWith('member-')) {
					switch (c1.field) {
					case 'collections':
						if (c1.value !== c2.value) {
							continue;
						}
						break;
					
					case 'creators':
						if (!Zotero.Creators.equals(c1.value, c2.value)) {
							continue;
						}
						break;
					
					case 'tags':
						if (!Zotero.Tags.equals(c1.value, c2.value)) {
							// If just a type difference, treat as modify with type 0 if
							// not type 0 in changeset1
							if (c1.op == 'member-add' && c2.op == 'member-add'
									&& c1.value.tag === c2.value.tag) {
								changeset1.splice(i--, 1);
								changeset2.splice(j--, 1);
								if (c1.value.type > 0) {
									changeset2.push({
										field: "tags",
										op: "member-remove",
										value: c1.value
									});
									changeset2.push({
										field: "tags",
										op: "member-add",
										value: c2.value
									});
								}
							}
							continue;
						}
						break;
					}
				}
				
				// Disregard member additions/deletions for different properties and values
				if (c1.op.startsWith('property-member-') && c2.op.startsWith('property-member-')) {
					if (c1.value.key !== c2.value.key || c1.value.value !== c2.value.value) {
						continue;
					}
				}
				
				// Changes are equal or in conflict
				
				// Removed on both sides
				if (c1.op == 'delete' && c2.op == 'delete') {
					changeset2.splice(j--, 1);
					continue;
				}
				
				// Added or removed members on both sides
				if ((c1.op == 'member-add' && c2.op == 'member-add')
						|| (c1.op == 'member-remove' && c2.op == 'member-remove')
						|| (c1.op == 'property-member-add' && c2.op == 'property-member-add')
						|| (c1.op == 'property-member-remove' && c2.op == 'property-member-remove')) {
					changeset2.splice(j--, 1);
					continue;
				}
				
				// If both sides have values, see if they're the same, and if so remove the
				// second one
				if (c1.op != 'delete' && c2.op != 'delete' && c1.value === c2.value) {
					changeset2.splice(j--, 1);
					continue;
				}
				
				// Automatically apply remote changes for non-items, even if in conflict
				if (objectType != 'item') {
					continue;
				}
				
				// Conflict
				changeset2.splice(j--, 1);
				conflicts.push([c1, c2]);
			}
		}
		
		return {
			changes: changeset2,
			conflicts: conflicts
		};
	},
	
	
	/**
	 * Calculate a changeset to apply locally to resolve an object conflict in absence of a
	 * cached version. Members and property members (e.g., collections, tags, relations)
	 * are combined, so any removals will be automatically undone. Field changes result in
	 * conflicts.
	 */
	_reconcileChangesWithoutCache: function (objectType, currentJSON, newJSON, ignoreFields) {
		var changeset = Zotero.DataObjectUtilities.diff(currentJSON, newJSON, ignoreFields);
		
		var changes = [];
		var conflicts = [];
		
		for (let i = 0; i < changeset.length; i++) {
			let c = changeset[i];
			
			// Member changes are additive only, so ignore removals
			if (c.op.endsWith('-remove')) {
				continue;
			}
			
			// Record member changes
			if (c.op.startsWith('member-') || c.op.startsWith('property-member-')) {
				changes.push(c);
				continue;
			}
			
			// Automatically apply remote changes for non-items, even if in conflict
			if (objectType != 'item') {
				changes.push(c);
				continue;
			}
			
			// Field changes are conflicts
			conflicts.push(c);
		}
		
		return { changes, conflicts };
	},
	
	
	/**
	 * @return {Promise<Object[]>} A promise for an array of JSON objects
	 */
	_getUnwrittenData: function (libraryID, objectType, max) {
		var objectsClass = Zotero.DataObjectUtilities.getObjectsClassForObjectType(objectType);
		// The MAX(version) ensures we get the data from the most recent version of the object,
		// thanks to SQLite 3.7.11 (http://www.sqlite.org/releaselog/3_7_11.html)
		var sql = "SELECT data, MAX(SC.version) AS version FROM syncCache SC "
			+ "LEFT JOIN " + objectsClass.table + " O "
			+ "USING (libraryID, key) "
			+ "WHERE SC.libraryID=? AND "
			+ "syncObjectTypeID IN (SELECT syncObjectTypeID FROM "
			+ "syncObjectTypes WHERE name='" + objectType + "') "
			// If saved version doesn't have a version or is less than the cache version
			+ "AND IFNULL(O.version, 0) < SC.version "
			+ "GROUP BY SC.libraryID, SC.key";
		return Zotero.DB.queryAsync(sql, [libraryID]).map(row => JSON.parse(row.data));
	},
	
	
	markObjectAsSynced: Zotero.Promise.method(function (obj) {
		obj.synced = true;
		return obj.saveTx({
			skipSyncedUpdate: true,
			skipDateModifiedUpdate: true,
			skipClientDateModifiedUpdate: true,
			skipNotifier: true
		});
	}),
	
	
	markObjectAsUnsynced: Zotero.Promise.method(function (obj) {
		obj.synced = false;
		return obj.saveTx({
			skipSyncedUpdate: true,
			skipDateModifiedUpdate: true,
			skipClientDateModifiedUpdate: true,
			skipNotifier: true
		});
	}),
	
	
	/**
	 * @return {Promise<Date|false>}
	 */
	getDateDeleted: Zotero.Promise.coroutine(function* (objectType, libraryID, key) {
		var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
		var sql = "SELECT dateDeleted FROM syncDeleteLog WHERE libraryID=? AND key=? "
			+ "AND syncObjectTypeID=?";
		var date = yield Zotero.DB.valueQueryAsync(sql, [libraryID, key, syncObjectTypeID]);
		return date ? Zotero.Date.sqlToDate(date, true) : false;
	}),
	
	
	/**
	 * @return {Promise}
	 */
	_removeObjectFromDeleteLog: function (objectType, libraryID, key) {
		var syncObjectTypeID = Zotero.Sync.Data.Utilities.getSyncObjectTypeID(objectType);
		var sql = "DELETE FROM syncDeleteLog WHERE libraryID=? AND key=? AND syncObjectTypeID=?";
		return Zotero.DB.queryAsync(sql, [libraryID, key, syncObjectTypeID]);
	}
}
