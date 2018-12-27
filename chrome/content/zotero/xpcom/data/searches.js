/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2006-2016 Center for History and New Media
                          George Mason University, Fairfax, Virginia, USA
                          https://zotero.org
    
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

Zotero.Searches = function() {
	this.constructor = null;
	
	this._ZDO_object = 'search';
	this._ZDO_id = 'savedSearchID';
	this._ZDO_table = 'savedSearches';
	
	this._primaryDataSQLParts = {
		savedSearchID: "O.savedSearchID",
		name: "O.savedSearchName AS name",
		libraryID: "O.libraryID",
		key: "O.key",
		version: "O.version",
		synced: "O.synced"
	}
	
	this._primaryDataSQLFrom = "FROM savedSearches O";
	
	this.init = Zotero.Promise.coroutine(function* () {
		yield Zotero.DataObjects.prototype.init.apply(this);
		yield Zotero.SearchConditions.init();
	});
	
	
	this.getByLibrary = function (libraryID) {
		var searches = [];
		for (let id in this._objectCache) {
			let s = this._objectCache[id];
			if (s.libraryID == libraryID) {
				searches.push(s);
			}
		}
		
		// Do proper collation sort
		var collation = Zotero.getLocaleCollation();
		searches.sort(function (a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		return searches;
	};
	
	
	/**
	 * Returns an array of Zotero.Search objects, ordered by name
	 *
	 * @param	{Integer}	[libraryID]
	 */
	this.getAll = Zotero.Promise.coroutine(function* (libraryID) {
		var sql = "SELECT savedSearchID FROM savedSearches WHERE libraryID=?";
		var ids = yield Zotero.DB.columnQueryAsync(sql, libraryID);
		if (!ids.length) {
			return []
		}
		
		var searches = this.get(ids);
		// Do proper collation sort
		var collation = Zotero.getLocaleCollation();
		searches.sort(function (a, b) {
			return collation.compareString(1, a.name, b.name);
		});
		return searches;
	});
	
	
	this.getPrimaryDataSQL = function () {
		// This should be the same as the query in Zotero.Search.loadPrimaryData(),
		// just without a specific savedSearchID
		return "SELECT "
			+ Object.keys(this._primaryDataSQLParts).map(key => this._primaryDataSQLParts[key]).join(", ") + " "
			+ "FROM savedSearches O WHERE 1";
	}
	
	
	this.conditionEquals = function (data1, data2) {
		return data1.condition === data2.condition
			&& data1.operator === data2.operator
			&& data1.value === data2.value;
	},
	
	
	this.getNextName = async function (libraryID, name) {
		// Trim '1', etc.
		var matches = name.match(/^(.+) \d+$/);
		if (matches) {
			name = matches[1].trim();
		}
		var sql = "SELECT savedSearchName FROM savedSearches "
			+ "WHERE libraryID=? AND savedSearchName LIKE ? ESCAPE '\\'";
		var names = await Zotero.DB.columnQueryAsync(
			sql,
			[libraryID, Zotero.DB.escapeSQLExpression(name) + '%']
		);
		return Zotero.Utilities.Internal.getNextName(name, names, true);
	};
	
	
	this._loadConditions = Zotero.Promise.coroutine(function* (libraryID, ids, idSQL) {
		var sql = "SELECT savedSearchID, searchConditionID, condition, operator, value, required "
			+ "FROM savedSearches LEFT JOIN savedSearchConditions USING (savedSearchID) "
			+ "WHERE libraryID=?" + idSQL
			+ "ORDER BY savedSearchID, searchConditionID";
		var params = [libraryID];
		var lastID = null;
		var rows = [];
		var setRows = function (searchID, rows) {
			var search = this._objectCache[searchID];
			if (!search) {
				throw new Error("Search " + searchID + " not found");
			}
			
			search._conditions = {};
			
			if (rows.length) {
				search._maxSearchConditionID = rows[rows.length - 1].searchConditionID;
			}
			
			// Reindex conditions, in case they're not contiguous in the DB
			for (let i = 0; i < rows.length; i++) {
				let condition = rows[i];
				
				// Parse "condition[/mode]"
				let [conditionName, mode] = Zotero.SearchConditions.parseCondition(condition.condition);
				
				// Not sure how this can happen, but prevent an error if it does
				if (condition.value === null) {
					condition.value = '';
				}
				
				let cond = Zotero.SearchConditions.get(conditionName);
				if (!cond || cond.noLoad) {
					Zotero.debug("Invalid saved search condition '" + conditionName + "' -- skipping", 2);
					continue;
				}
				
				// Convert itemTypeID to itemType
				//
				// TEMP: This can be removed at some point
				if (conditionName == 'itemTypeID') {
					conditionName = 'itemType';
					condition.value = Zotero.ItemTypes.getName(condition.value);
				}
				// Parse old-style collection/savedSearch conditions ('0_ABCD2345' -> 'ABCD2345')
				else if (conditionName == 'collection' || conditionName == 'savedSearch') {
					if (condition.value.includes('_')) {
						let [_, objKey] = condition.value.split('_');
						condition.value = objKey;
					}
				}
				
				search._conditions[i] = {
					id: i,
					condition: conditionName,
					mode: mode,
					operator: condition.operator,
					value: condition.value,
					required: !!condition.required
				};
			}
			search._loaded.conditions = true;
			search._clearChanged('conditions');
		}.bind(this);
		
		yield Zotero.DB.queryAsync(
			sql,
			params,
			{
				noCache: ids.length != 1,
				onRow: function (row) {
					let searchID = row.getResultByIndex(0);
					
					if (lastID && searchID != lastID) {
						setRows(lastID, rows);
						rows = [];
					}
					
					lastID = searchID;
					let searchConditionID = row.getResultByIndex(1);
					// No conditions
					if (searchConditionID === null) {
						return;
					}
					rows.push({
						searchConditionID,
						condition: row.getResultByIndex(2),
						operator: row.getResultByIndex(3),
						value: row.getResultByIndex(4),
						required: row.getResultByIndex(5)
					});
				}.bind(this)
			}
		);
		if (lastID) {
			setRows(lastID, rows);
		}
	});
	
	Zotero.DataObjects.call(this);
	
	return this;
}.bind(Object.create(Zotero.DataObjects.prototype))();
