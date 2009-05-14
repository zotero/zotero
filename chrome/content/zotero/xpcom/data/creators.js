/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/


Zotero.Creators = new function() {
	Zotero.DataObjects.apply(this, ['creator']);
	this.constructor.prototype = new Zotero.DataObjects();
	
	this.get = get;
	this.getDataID = getDataID;
	this.getCreatorsWithData = getCreatorsWithData;
	this.countCreatorsWithData = countCreatorsWithData;
	this.updateData = updateData;
	this.deleteData = deleteData;
	this.erase = erase;
	this.purge = purge;
	
	this.fields = ['firstName', 'lastName', 'fieldMode', 'birthYear'];
	
	var _creatorDataHash = {}; // creatorDataIDs indexed by md5 hash of data
	
	/*
	 * Returns a Zotero.Creator object for a given creatorID
	 */
	function get(creatorID) {
		if (!creatorID) {
			throw ("creatorID not provided in Zotero.Creators.get()");
		}
		
		if (this._objectCache[creatorID]) {
			return this._objectCache[creatorID];
		}
		
		var sql = 'SELECT COUNT(*) FROM creators WHERE creatorID=?';
		var result = Zotero.DB.valueQuery(sql, creatorID);
		
		if (!result) {
			return false;
		}
		
		var creator = new Zotero.Creator;
		creator.id = creatorID;
		this._objectCache[creatorID] = creator;
		return this._objectCache[creatorID];
	}
	
	
	/**
	 * Returns the creatorDataID matching given fields
	 *
	 * @param	array	fields
	 * @param	bool	create		If no matching creatorDataID, create one
	 */
	function getDataID(fields, create) {
		fields = _cleanFields(fields);
		
		if (!fields.firstName && !fields.lastName) {
			throw ("First or last name must be provided in Zotero.Creators.getDataID()");
		}
		
		var hash = _getHash(fields);
		if (_creatorDataHash[hash]) {
			return _creatorDataHash[hash];
		}
		
		Zotero.DB.beginTransaction();
		
		var params = [
			fields.firstName,
			fields.lastName,
			'',
			fields.fieldMode,
			fields.birthYear
		];
		
		var sql = "SELECT creatorDataID FROM creatorData WHERE "
			+ "firstName=? AND lastName=? AND shortName=? "
			+ "AND fieldMode=? AND birthYear=?";
		var id = Zotero.DB.valueQuery(sql, params);
		
		if (!id && create) {
			id = Zotero.ID.get('creatorData');
			params.unshift(id);
			
			sql = "INSERT INTO creatorData (creatorDataID, "
				+ "firstName, lastName, shortName, fieldMode, birthYear) "
				+ "VALUES (?, ?, ?, ?, ?, ?)";
			var insertID = Zotero.DB.query(sql, params);
			if (!id) {
				id = insertID;
			}
		}
		
		Zotero.DB.commitTransaction();
		
		if (id) {
			_creatorDataHash[hash] = id;
		}
		
		return id;
	}
	
	
	function getCreatorsWithData(creatorDataID, libraryID) {
		var sql = "SELECT creatorID FROM creators WHERE creatorDataID=?";
		var params = [creatorDataID];
		if (libraryID) {
			sql += " AND libraryID=?";
			params.push(libraryID);
		}
		else {
			sql += " AND libraryID IS NULL";
		}
		return Zotero.DB.columnQuery(sql, params);
	}
	
	
	function countCreatorsWithData(creatorDataID, libraryID) {
		var sql = "SELECT COUNT(*) FROM creators WHERE creatorDataID=?";
		var params = [creatorDataID];
		if (libraryID) {
			sql += " AND libraryID=?";
			params.push(libraryID);
		}
		return Zotero.DB.valueQuery(sql, params);
	}
	
	
	function updateData(creatorDataID, fields) {
		fields = _cleanFields(fields);
		
		var sqlFields = [];
		var sqlParams = [];
		for (var field in fields) {
			// Skip fields not specified as changeable creator fields
			if (this.fields.indexOf(field) == -1) {
				continue;
			}
			sqlFields.push(field + '=?');
			sqlParams.push(fields[field]);
		}
		
		var sql = "UPDATE creatorData SET " + sqlFields.join(', ')
			+ " WHERE creatorDataID=?";
		
		sqlParams.push(creatorDataID);
		Zotero.DB.query(sql, sqlParams);
		
		_updateCachedData(creatorDataID);
	}
	
	
	function deleteData(creatorDataID) {
		var sql = "DELETE FROM creatorData WHERE creatorDataID=?";
		Zotero.DB.query(sql, creatorDataID);
		_updateCachedData(creatorDataID);
	}
	
	
	/**
	 * Remove creator(s) from all linked items and call this.purge()
	 * to delete creator rows
	 */
	function erase(ids) {
		ids = Zotero.flattenArguments(ids);
		
		var unlock = Zotero.Notifier.begin(true);
		Zotero.UnresponsiveScriptIndicator.disable();
		try {
			Zotero.DB.beginTransaction();
			for each(var id in ids) {
				var creator = this.get(id);
				if (!creator) {
					Zotero.debug('Creator ' + id + ' does not exist in Creators.erase()!', 1);
					Zotero.Notifier.trigger('delete', 'creator', id);
					continue;
				}
				creator.erase();
				creator = undefined;
			}
			this.purge();
			Zotero.DB.commitTransaction();
		}
		catch (e) {
			Zotero.DB.rollbackTransaction();
			throw (e);
		}
		finally {
			Zotero.Notifier.commit(unlock);
			Zotero.UnresponsiveScriptIndicator.enable();
		}
	}
	
	
	/*
	 * Delete obsolete creator/creatorData rows from database
	 * and clear internal array entries
	 */
	function purge() {
		if (!Zotero.Prefs.get('purge.creators')) {
			return;
		}
		
		Zotero.debug("Purging creator tables");
		
		// Purge unused creators
		var sql = 'SELECT creatorID FROM creators WHERE creatorID NOT IN '
			+ '(SELECT creatorID FROM itemCreators)';
		var toDelete = Zotero.DB.columnQuery(sql);
		
		if (toDelete) {
			// Clear creator entries in internal array
			for each(var creatorID in toDelete) {
				delete this._objectCache[creatorID];
			}
			
			var sql = "DELETE FROM creators WHERE creatorID NOT IN "
				+ "(SELECT creatorID FROM itemCreators)";
			Zotero.DB.query(sql);
		}
		
		// Purge unused creatorData rows
		var sql = 'SELECT creatorDataID FROM creatorData WHERE creatorDataID NOT IN '
			+ '(SELECT creatorDataID FROM creators)';
		var toDelete = Zotero.DB.columnQuery(sql);
		
		if (toDelete) {
			// Clear creator entries in internal array
			for each(var creatorDataID in toDelete) {
				_updateCachedData(creatorDataID);
			}
			
			var sql = "DELETE FROM creatorData WHERE creatorDataID NOT IN "
				+ "(SELECT creatorDataID FROM creators)";
			Zotero.DB.query(sql);
		}
		
		Zotero.Prefs.set('purge.creators', false);
	}
	
	
	this._load = function () {
		if (!arguments[0] && !this._reloadCache) {
			return;
		}
		
		if (this._reloadCache) {
			Zotero.debug("Clearing creator data hash");
			_creatorDataHash = {};
		}
		
		var sql = "SELECT C.*, CD.* FROM creators C NATURAL JOIN creatorData CD "
					+ "WHERE 1";
		if (arguments[0]) {
			sql += " AND creatorID IN (" + Zotero.join(arguments[0], ",") + ")";
		}
		var rows = Zotero.DB.query(sql);
		var ids = [];
		for each(var row in rows) {
			var id = row.creatorID;
			ids.push(id);
			
			// Creator doesn't exist -- create new object and stuff in array
			if (!this._objectCache[id]) {
				this.get(id);
			}
			// Existing creator -- reload in place
			else {
				this._objectCache[id].loadFromRow(row);
			}
		}
		
		// If loading all creators, remove old creators that no longer exist
		if (!arguments[0]) {
			for each(var c in this._objectCache) {
				if (ids.indexOf(c.id) == -1) {
					this.unload(c.id);
				}
			}
			
			this._reloadCache = false;
		}
	}
	
	
	function _cleanFields(fields) {
		var cleanedFields = {
			firstName: '',
			lastName: '',
			fieldMode: 0,
			birthYear: ''
		};
		for (var field in fields) {
			if (fields[field]) {
				switch (field) {
					// Strings
					case 'firstName':
					case 'lastName':
					case 'shortName':
						cleanedFields[field] = fields[field] + '';
						break;
					
					// Integer
					case 'fieldMode':
						cleanedFields[field] = fields[field] ? fields[field] : 0;
						break;
					
					// Null if empty
					default:
						cleanedFields[field] = fields[field] ? fields[field] : null;
				}
			}
		}
		return cleanedFields;
	}
	
	
	function _getHash(fields) {
		var hashFields = [];
		for each(var field in Zotero.Creators.fields) {
			hashFields.push(fields[field]);
		}
		var ZU = new Zotero.Utilities;
		return ZU.md5(hashFields.join('_'));
	}
	
	
	function _getDataFromID(creatorDataID) {
		var sql = "SELECT * FROM creatorData WHERE creatorDataID=?";
		return Zotero.DB.rowQuery(sql, creatorDataID);
	}
	
	
	function _updateCachedData(creatorDataID) {
		for (var hash in _creatorDataHash) {
			if (_creatorDataHash[hash] == creatorDataID) {
				delete _creatorDataHash[hash];
			}
		}
		
		var creators = getCreatorsWithData(creatorDataID);
		for each(var creatorID in creators) {
			if (Zotero.Creators._objectCache[creatorID]) {
				Zotero.Creators._objectCache[creatorID].load();
			}
		}
	}
}
