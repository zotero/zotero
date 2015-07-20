/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2013 Center for History and New Media
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

/**
 * @namespace
 */
Zotero.SyncedSettings = (function () {
	//
	// Public methods
	//
	var module = {
		idColumn: "setting",
		table: "syncedSettings",
		
		get: Zotero.Promise.coroutine(function* (libraryID, setting) {
			var sql = "SELECT value FROM syncedSettings WHERE setting=? AND libraryID=?";
			var json = yield Zotero.DB.valueQueryAsync(sql, [setting, libraryID]);
			if (!json) {
				return false;
			}
			return JSON.parse(json);
		}),
		
		/**
		 * Used by sync and tests
		 *
		 * @return {Object} - Object with 'synced' and 'version' properties
		 */
		getMetadata: Zotero.Promise.coroutine(function* (libraryID, setting) {
			var sql = "SELECT * FROM syncedSettings WHERE setting=? AND libraryID=?";
			var row = yield Zotero.DB.rowQueryAsync(sql, [setting, libraryID]);
			if (!row) {
				return false;
			}
			return {
				synced: !!row.synced,
				version: row.version
			};
		}),
		
		set: Zotero.Promise.coroutine(function* (libraryID, setting, value, version = 0, synced) {
			if (typeof value == undefined) {
				throw new Error("Value not provided");
			}
			
			// TODO: get rid of this once we have proper affected rows handling
			var sql = "SELECT value FROM syncedSettings WHERE setting=? AND libraryID=?";
			var currentValue = yield Zotero.DB.valueQueryAsync(sql, [setting, libraryID]);
			
			// Make sure we can tell the difference between a
			// missing setting (FALSE as returned by valueQuery())
			// and a FALSE setting (FALSE as returned by JSON.parse())
			var hasCurrentValue = currentValue !== false;
			
			currentValue = JSON.parse(currentValue);
			
			// Value hasn't changed
			if (value === currentValue) {
				return false;
			}
			
			var id = libraryID + '/' + setting;
			
			if (hasCurrentValue) {
				var extraData = {};
				extraData[id] = {
					changed: {}
				};
				extraData[id].changed = {
					value: currentValue
				};
			}
			
			if (currentValue === false) {
				var event = 'add';
				var extraData = {};
			}
			else {
				var event = 'modify';
			}
			
			synced = synced ? 1 : 0;
			
			if (hasCurrentValue) {
				var sql = "UPDATE syncedSettings SET value=?, version=?, synced=? "
					+ "WHERE setting=? AND libraryID=?";
				yield Zotero.DB.queryAsync(
					sql, [JSON.stringify(value), version, synced, setting, libraryID]
				);
			}
			else {
				var sql = "INSERT INTO syncedSettings "
					+ "(setting, libraryID, value, version, synced) VALUES (?, ?, ?, ?, ?)";
				yield Zotero.DB.queryAsync(
					sql, [setting, libraryID, JSON.stringify(value), version, synced]
				);
			}
			yield Zotero.Notifier.trigger(event, 'setting', [id], extraData);
			return true;
		}),
		
		clear: Zotero.Promise.coroutine(function* (libraryID, setting, options) {
			options = options || {};
			
			// TODO: get rid of this once we have proper affected rows handling
			var sql = "SELECT value FROM syncedSettings WHERE setting=? AND libraryID=?";
			var currentValue = yield Zotero.DB.valueQueryAsync(sql, [setting, libraryID]);
			if (currentValue === false) {
				return false;
			}
			currentValue = JSON.parse(currentValue);
			
			var id = libraryID + '/' + setting;
			
			var extraData = {};
			extraData[id] = {
				changed: {}
			};
			extraData[id].changed = {
				value: currentValue
			};
			if (options.skipDeleteLog) {
				extraData[id].skipDeleteLog = true;
			}
			
			var sql = "DELETE FROM syncedSettings WHERE setting=? AND libraryID=?";
			yield Zotero.DB.queryAsync(sql, [setting, libraryID]);
			
			yield Zotero.Notifier.trigger('delete', 'setting', [id], extraData);
			return true;
		})
	};
	
	return module;
}());
