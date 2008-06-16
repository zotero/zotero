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
	var _creatorsByID = {}; // Zotero.Creator objects indexed by creatorID
	var _creatorDataHash = {}; // creatorDataIDs indexed by md5 hash of data
	
	this.get = get;
	this.getUpdated = getUpdated;
	this.getDataID = getDataID;
	this.getCreatorsWithData = getCreatorsWithData;
	this.countCreatorsWithData = countCreatorsWithData;
	this.updateData = updateData;
	this.deleteData = deleteData;
	this.reload = reload;
	this.reloadAll = reloadAll;
	this.erase = erase;
	this.purge = purge;
	this.unload = unload;
	
	this.fields = ['firstName', 'lastName', 'fieldMode', 'birthYear'];
	
	var self = this;
	
	/*
	 * Returns a Zotero.Creator object for a given creatorID
	 */
	function get(creatorID) {
		if (_creatorsByID[creatorID]) {
			return _creatorsByID[creatorID];
		}
		
		var sql = 'SELECT COUNT(*) FROM creators WHERE creatorID=?';
		var result = Zotero.DB.valueQuery(sql, creatorID);
		
		if (!result) {
			return false;
		}
		
		_creatorsByID[creatorID] = new Zotero.Creator(creatorID);
		return _creatorsByID[creatorID];
	}
	
	
	function getUpdated(date) {
		var sql = "SELECT creatorID FROM creators";
		if (date) {
			sql += " WHERE dateModified>?";
			return Zotero.DB.columnQuery(sql, Zotero.Date.dateToSQL(date, true));
		}
		return Zotero.DB.columnQuery(sql);
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
	
	
	function getCreatorsWithData(creatorDataID) {
		var sql = "SELECT creatorID FROM creators WHERE creatorDataID=?";
		return Zotero.DB.columnQuery(sql, creatorDataID);
	}
	
	
	function countCreatorsWithData(creatorDataID) {
		var sql = "SELECT COUNT(*) FROM creators WHERE creatorDataID=?";
		return Zotero.DB.valueQuery(sql, creatorDataID);
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
	
	
	/*
	 * Reloads data for specified creators into internal array
	 *
	 * Can be passed ids as individual parameters or as an array of ids, or both
	 */
	function reload() {
		if (!arguments[0]) {
			return false;
		}
		
		var ids = Zotero.flattenArguments(arguments);
		Zotero.debug('Reloading creators ' + ids);
		
		for each(var id in ids) {
			if (!_creatorsByID[id]) {
				this.get(id);
			}
			else {
				_creatorsByID[id].load();
			}
		}
		
		return true;
	}
	
	
	function reloadAll() {
		Zotero.debug("Reloading all creators");
		_creatorDataHash = {};
		for (var id in _creatorsByID) {
			_creatorsByID[id].load();
			var realID = _creatorsByID[id].id;
			if (realID != id) {
				Zotero.debug("Clearing cache entry for creator " + id);
				delete _creatorsByID[id];
			}
		}
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
		Zotero.debug("Purging creator tables");
		
		// Purge unused creators
		var sql = 'SELECT creatorID FROM creators WHERE creatorID NOT IN '
			+ '(SELECT creatorID FROM itemCreators)';
		var toDelete = Zotero.DB.columnQuery(sql);
		
		if (toDelete) {
			// Clear creator entries in internal array
			for each(var creatorID in toDelete) {
				delete _creatorsByID[creatorID];
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
	}
	
	
	/**
	 * Clear creator from internal array
	 *
	 * @param	int		id		creatorID
	 */
	function unload(id) {
		delete _creatorsByID[id];
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
				cleanedFields[field] = fields[field];
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
			if (_creatorsByID[creatorID]) {
				_creatorsByID[creatorID].load();
			}
		}
	}
}
