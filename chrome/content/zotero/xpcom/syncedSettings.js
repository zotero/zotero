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
	var _cache = {};
	
	//
	// Public methods
	//
	var module = {
		idColumn: "setting",
		table: "syncedSettings",
		
		loadAll: Zotero.Promise.coroutine(function* (libraryID) {
			Zotero.debug("Loading synced settings for library " + libraryID);
			
			if (!_cache[libraryID]) {
				_cache[libraryID] = {};
			}
			
			var invalid = [];
			
			var sql = "SELECT setting, value, synced, version FROM syncedSettings "
				+ "WHERE libraryID=?";
			yield Zotero.DB.queryAsync(
				sql,
				libraryID,
				{
					onRow: function (row) {
						var setting = row.getResultByIndex(0);
						
						var value = row.getResultByIndex(1);
						try {
							value = JSON.parse(value);
						}
						catch (e) {
							invalid.push([libraryID, setting]);
							return;
						}
						
						_cache[libraryID][setting] = {
							value,
							synced: !!row.getResultByIndex(2),
							version: row.getResultByIndex(3)
						};
					}
				}
			);
			
			// TODO: Delete invalid settings
		}),
		
		/**
		 * Return settings object
		 *
		 * @return {Object|null}
		 */
		get: function (libraryID, setting) {
			if (!_cache[libraryID]) {
				throw new Zotero.Exception.UnloadedDataException(
					"Synced settings not loaded for library " + libraryID,
					"syncedSettings"
				);
			}
			
			if (!_cache[libraryID][setting]) {
				return null;
			}
			
			return JSON.parse(JSON.stringify(_cache[libraryID][setting].value));
		},
		
		/**
		 * Used by sync and tests
		 *
		 * @return {Object} - Object with 'synced' and 'version' properties
		 */
		getMetadata: function (libraryID, setting) {
			if (!_cache[libraryID]) {
				throw new Zotero.Exception.UnloadedDataException(
					"Synced settings not loaded for library " + libraryID,
					"syncedSettings"
				);
			}
			
			var o = _cache[libraryID][setting];
			if (!o) {
				return null;
			}
			return {
				synced: o.synced,
				version: o.version
			};
		},
		
		getUnsynced: Zotero.Promise.coroutine(function* (libraryID) {
			var sql = "SELECT setting, value FROM syncedSettings WHERE synced=0 AND libraryID=?";
			var rows = yield Zotero.DB.queryAsync(sql, libraryID);
			var obj = {};
			rows.forEach(row => obj[row.setting] = JSON.parse(row.value));
			return obj;
		}),
		
		markAsSynced: Zotero.Promise.coroutine(function* (libraryID, settings, version) {
				Zotero.debug(settings);
			var sql = "UPDATE syncedSettings SET synced=1, version=? WHERE libraryID=? AND setting IN "
				+ "(" + settings.map(x => '?').join(', ') + ")";
			yield Zotero.DB.queryAsync(sql, [version, libraryID].concat(settings));
			for (let key of settings) {
				let setting = _cache[libraryID][key];
				setting.synced = true;
				setting.version = version;
			}
		}),
		
		set: Zotero.Promise.coroutine(function* (libraryID, setting, value, version = 0, synced) {
			if (typeof value == undefined) {
				throw new Error("Value not provided");
			}
			
			var currentValue = this.get(libraryID, setting);
			var hasCurrentValue = currentValue !== null;
			
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
			
			if (!hasCurrentValue) {
				var event = 'add';
				var extraData = {};
			}
			else {
				var event = 'modify';
			}
			
			synced = synced ? 1 : 0;
			version = parseInt(version);
			
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
			
			_cache[libraryID][setting] = {
				value,
				synced: !!synced,
				version
			}
			
			yield Zotero.Notifier.trigger(event, 'setting', [id], extraData);
			return true;
		}),
		
		clear: Zotero.Promise.coroutine(function* (libraryID, setting, options) {
			options = options || {};
			
			var currentValue = this.get(libraryID, setting);
			var hasCurrentValue = currentValue !== null;
			
			var id = libraryID + '/' + setting;
			
			var extraData = {};
			extraData[id] = {
				changed: {
					value: currentValue
				}
			};
			if (options.skipDeleteLog) {
				extraData[id].skipDeleteLog = true;
			}
			
			var sql = "DELETE FROM syncedSettings WHERE setting=? AND libraryID=?";
			yield Zotero.DB.queryAsync(sql, [setting, libraryID]);
			
			delete _cache[libraryID][setting];
			
			yield Zotero.Notifier.trigger('delete', 'setting', [id], extraData);
			return true;
		})
	};
	
	return module;
}());
