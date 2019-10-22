/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2016 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     https://www.zotero.org
    
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

Zotero.ID_Tracker = function () {
	var _tables = [
		'collections',
		'creators',
		'creatorTypes',
		'customFields',
		'customItemTypes',
		'fields',
		'itemDataValues',
		'itemTypes',
		'items',
		'libraries',
		'proxies',
		'savedSearches',
		'tags'
	];
	var _nextIDs = {};
	
	
	this.init = Zotero.Promise.coroutine(function* () {
		for (let table of _tables) {
			_nextIDs[table] = yield _getNext(table);
		}
	});
	
	
	/**
	 * Gets an unused primary key id for a DB table
	 */
	this.get = function (table) {
		if (!_nextIDs[table]) {
			throw new Error("IDs not loaded for table '" + table + "'");
		}
		
		return _nextIDs[table]++;
	};
	
	
	function _getTableColumn(table) {
		switch (table) {
			case 'libraries':
				return 'libraryID';
			
			case 'itemDataValues':
				return 'valueID';
			
			case 'savedSearches':
				return 'savedSearchID';
			
			case 'creatorData':
				return 'creatorDataID';
			
			case 'proxies':
				return 'proxyID';
			
			default:
				return table.substr(0, table.length - 1) + 'ID';
		}
	}
	
	
	/**
	 * Get MAX(id) + 1 from table
	 *
	 * @return {Promise<Integer>}
	 */
	function _getNext(table) {
		var sql = 'SELECT COALESCE(MAX(' + _getTableColumn(table) + ') + 1, 1) FROM ' + table;
		return Zotero.DB.valueQueryAsync(sql);
	};
}

Zotero.ID = new Zotero.ID_Tracker;
