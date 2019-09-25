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

		/**
		 * An event which allows to tap into the sync transaction and update
		 * parts of the client which rely on synced settings.
		 */
		onSyncDownload: {
			listeners: {},
			addListener: function(libraryID, setting, fn, bindTarget=null) {
				if (!this.listeners[libraryID]) {
					this.listeners[libraryID] = {};
				}
				if (!this.listeners[libraryID][setting]) {
					this.listeners[libraryID][setting] = [];
				}
				this.listeners[libraryID][setting].push([fn, bindTarget]);
			},
			/**
			 * @param {Integer} libraryID
			 * @param {String} setting - name of the setting
			 * @param {Object} oldValue
			 * @param {Object} newValue
			 * @param {Boolean} conflict - true if both client and remote values had changed before sync
			 */
			trigger: Zotero.Promise.coroutine(function* (libraryID, setting, oldValue, newValue, conflict) {
				var libListeners = this.listeners[libraryID] || {};
				var settingListeners = libListeners[setting] || [];
				Array.prototype.splice.call(arguments, 0, 2);
				if (settingListeners) {
					for (let listener of settingListeners) {
						yield Zotero.Promise.resolve(listener[0].apply(listener[1], arguments));
					}
				}
			})
		},
		
		loadAll: async function (libraryID) {
			Zotero.debug("Loading synced settings for library " + libraryID);
			
			if (!_cache[libraryID]) {
				_cache[libraryID] = {};
			}
			
			var invalid = [];
			
			var sql = "SELECT setting, value, synced, version FROM syncedSettings "
				+ "WHERE libraryID=?";
			await Zotero.DB.queryAsync(
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
			
			//
			// Delete invalid settings
			//
			if (_cache[libraryID].tagColors) {
				// Sanitize colored tags -- shouldn't be necessary, but just in case a bad value makes it
				// into the setting
				let fixed = false;
				let tagColors = _cache[libraryID].tagColors.value;
				// Not an array
				if (!Array.isArray(tagColors)) {
					tagColors = [];
					fixed = true;
				}
				// Invalid tag
				tagColors = tagColors.filter((color) => {
					if (typeof color != 'object' || typeof color.name != 'string' || typeof color.color != 'string') {
						Zotero.logError("Removing invalid colored tag: " + JSON.stringify(color));
						tagsFixed = true;
						return false;
					}
					return true;
				});
				// Before whitespace was trimmed in Tags.setColor() in 5.0.75
				tagColors.forEach((tag) => {
					let trimmed = tag.name.trim();
					if (trimmed != tag.name) {
						tag.name = trimmed;
						fixed = true;
					}
				});
				if (fixed) {
					await this.set(libraryID, 'tagColors', tagColors);
				}
			}
		},
		
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
			var sql = "UPDATE syncedSettings SET synced=1, version=? WHERE libraryID=? AND setting IN "
				+ "(" + settings.map(x => '?').join(', ') + ")";
			yield Zotero.DB.queryAsync(sql, [version, libraryID].concat(settings));
			for (let key of settings) {
				let setting = _cache[libraryID][key];
				setting.synced = true;
				setting.version = version;
			}
		}),
		
		/**
		 * Used for restore-to-server
		 */
		markAllAsUnsynced: async function (libraryID) {
			var sql = "UPDATE syncedSettings SET synced=0, version=0 WHERE libraryID=?";
			await Zotero.DB.queryAsync(sql, libraryID);
			for (let key in _cache[libraryID]) {
				let setting = _cache[libraryID][key];
				setting.synced = false;
				setting.version = 0;
			}
		},
		
		set: Zotero.Promise.coroutine(function* (libraryID, setting, value, version = 0, synced) {
			if (typeof value == undefined) {
				throw new Error("Value not provided");
			}
			
			// Prevents a whole bunch of headache if you continue modifying the object after calling #set()
			if (value instanceof Array) {
				value = Array.from(value);
			}
			else if (typeof value == 'object') {
				value = Object.assign({}, value);
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
				var sql = "UPDATE syncedSettings SET " + (version > 0 ? "version=?, " : "") + 
					"value=?, synced=? WHERE setting=? AND libraryID=?";
				var args = [JSON.stringify(value), synced, setting, libraryID];
				if (version > 0) {
					args.unshift(version)
				}
				yield Zotero.DB.queryAsync(sql, args);
			}
			else {
				var sql = "INSERT INTO syncedSettings "
					+ "(setting, libraryID, value, version, synced) VALUES (?, ?, ?, ?, ?)";
				yield Zotero.DB.queryAsync(
					sql, [setting, libraryID, JSON.stringify(value), version, synced]
				);
			}

			var metadata = this.getMetadata(libraryID, setting);
			
			_cache[libraryID][setting] = {
				value,
				synced: !!synced,
				version: version > 0 || !hasCurrentValue ? version : metadata.version
			};
			
			var conflict = metadata && !metadata.synced && metadata.version < version;
			if (version > 0) {
				yield this.onSyncDownload.trigger(libraryID, setting, currentValue, value, conflict);
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
