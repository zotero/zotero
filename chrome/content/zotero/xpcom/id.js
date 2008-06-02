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

Zotero.ID = new function () {
	this.get = get;
	this.getKey = getKey;
	this.getBigInt = getBigInt;
	
	_available = {};
	_min = {};
	
	/*
	 * Gets an unused primary key id for a DB table
	 */
	function get(table, notNull, skip) {
		// Used in sync.js
		if (table == 'searches') {
			table = 'savedSearches';
		}
		
		switch (table) {
			// Autoincrement tables
			//
			// Callers need to handle a potential NULL for these unless they
			// pass |notNull|
			case 'items':
			case 'creators':
			case 'creatorData':
			case 'collections':
			case 'savedSearches':
				var id = _getNextAvailable(table, skip);
				if (!id && notNull) {
					return _getNext(table, skip);
				}
				return id;
			
			// Non-autoincrement tables
			//
			// TODO: use autoincrement instead where available in 1.5
			case 'itemDataValues':
			case 'tags':
				var id = _getNextAvailable(table, skip);
				if (!id) {
					// If we can't find an empty id quickly, just use MAX() + 1
					return _getNext(table, skip);
				}
				return id;
			
			default:
				throw ("Unsupported table '" + table + "' in Zotero.ID.get()");
		}
	}
	
	
	function getKey() {
		var baseString = "23456789ABCDEFGHIJKMNPQRSTUVWXTZ";
		return Zotero.randomString(8, baseString);
	}
	
	
	function getBigInt() {
		return Math.floor(Math.random() * (9007199254740991)) + 1;
	}
	
	
	/*
	 * Returns the lowest available unused primary key id for table
	 */
	function _getNextAvailable(table, skip) {
		if (!_available[table]) {
			_loadAvailable(table);
		}
		
		var arr = _available[table];
		
		for (var i in arr) {
			var id = arr[i][0];
			
			if (skip && skip.indexOf(id) != -1) {
				continue;
			}
			
			// End of range -- remove range
			if (id == arr[i][1]) {
				arr.shift();
			}
			// Within range -- increment
			else {
				arr[i][0]++;
			}
			
			// Prepare table for refresh if all rows used
			if (arr.length == 0) {
				delete _available[table];
			}
			
			_min[table] = id;
			return id;
		}
		return null;
	}
	
	
	/*
	 * Get MAX(id) + 1 from table
	 */
	function _getNext(table, skip) {
		var column = _getTableColumn(table);
		
		var sql = 'SELECT MAX(';
		if (skip && skip.length) {
			var max = Math.max.apply(this, skip);
			sql += 'MAX(' + column + ', ' + max + ')';
		}
		else {
			sql += column;
		}
		sql += ')+1 FROM ' + table;
		return Zotero.DB.valueQuery(sql);
	}
	
	
	/*
	 * Loads available ids for table into memory
	 */
	function _loadAvailable(table) {
		Zotero.debug("Loading available ids for table '" + table + "'");
		
		var minID = _min[table] ? _min[table] + 1 : 1;
		var numIDs = 3; // Number of ids to compare against at a time
		var maxTries = 3; // Number of times to try increasing the maxID
		var maxToFind = 1000;
		
		var column = _getTableColumn(table);
		
		switch (table) {
			case 'creators':
			case 'creatorData':
			case 'items':
			case 'itemDataValues':
			case 'tags':
				break;
			
			case 'collections':
			case 'savedSearches':
				var maxToFind = 100;
				break;
			
			default:
				throw ("Unsupported table '" + table + "' in Zotero.ID._loadAvailable()");
		}
		
		var maxID = minID + numIDs - 1;
		var sql = "SELECT " + column + " FROM " + table
			+ " WHERE " + column + " BETWEEN ? AND ? ORDER BY " + column;
		var ids = Zotero.DB.columnQuery(sql, [minID, maxID]);
		// If no ids found, we have maxID unused ids
		if (!ids) {
			maxID = Math.min(maxID, maxToFind);
			Zotero.debug("Found " + (maxID - minID + 1) + " available ids in table '" + table + "'");
			_available[table] = [[minID, maxID]];
			return;
		}
			
		// If we didn't find any unused ids, try increasing maxID a few times
		while (ids.length == numIDs && maxTries>0) {
			Zotero.debug('No available ids found between ' + minID + ' and ' + maxID + '; trying next ' + numIDs);
			minID = maxID + 1;
			maxID = minID + numIDs - 1;
			ids = Zotero.DB.columnQuery(sql, [minID, maxID]);
			maxTries--;
		}
		
		// Didn't find any unused ids
		if (ids.length == numIDs) {
			Zotero.debug("Found 0 available ids in table '" + table + "'");
			_available[table] = [];
			return;
		}
		
		var available = [], found = 0, j = 0, availableStart = null;
		
		for (var i=minID; i<=maxID && found<maxToFind; i++) {
			// We've gone past the found ids, so all remaining ids up to maxID
			// are available
			if (!ids[j]) {
				available.push([i, maxID]);
				found += (maxID - i) + 1;
				break;
			}
			
			// Skip ahead while ids are occupied
			if (ids[j] == i) {
				j++;
				continue;
			}
			
			// Advance counter while it's below the next used id
			while (ids[j] > i && i<=maxID) {
				if (!availableStart) {
					availableStart = i;
				}
				i++;
				
				if ((found + (i - availableStart) + 1) > maxToFind) {
					break;
				}
			}
			if (availableStart) {
				available.push([availableStart, i-1]);
				// Keep track of how many empties we've found
				found += ((i-1) - availableStart) + 1;
				availableStart = null;
			}
			j++;
		}
		
		Zotero.debug("Found " + found + " available ids in table '" + table + "'");
		
		_available[table] = available;
	}
	
	
	/**
	* Find a unique random id for use in a DB table
	*
	* (No longer used)
	**/
	function _getRandomID(table, max){
		var column = _getTableColumn(table);
		
		var sql = 'SELECT COUNT(*) FROM ' + table + ' WHERE ' + column + '= ?';
		
		if (!max){
			max = 16383;
		}
		
		max--; // since we use ceil(), decrement max by 1
		var tries = 3; // # of tries to find a unique id
		for (var i=0; i<tries; i++) {
			var rnd = Math.ceil(Math.random() * max);
			var exists = Zotero.DB.valueQuery(sql, { int: rnd });
			if (!exists) {
				return rnd;
			}
		}
		
		// If no luck after number of tries, try a larger range
		var sql = 'SELECT MAX(' + column + ') + 1 FROM ' + table;
		return Zotero.valueQuery(sql);
	}
	
	
	function _getTableColumn(table) {
		switch (table) {
			case 'itemDataValues':
				return 'valueID';
			
			case 'savedSearches':
				return 'savedSearchID';
			
			case 'creatorData':
				return 'creatorDataID';
			
			default:
				return table.substr(0, table.length - 1) + 'ID';
		}
	}
}

