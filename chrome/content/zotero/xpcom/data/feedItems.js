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


/*
 * Primary interface for accessing Zotero feed items
 */
Zotero.FeedItems = new Proxy(function() {
	let _idCache = {},
		_guidCache = {};
	
	// Teach Zotero.Items about Zotero.FeedItem
	
	// This one is a lazy getter, so we don't patch it up until first access
	let zi_primaryDataSQLParts = Object.getOwnPropertyDescriptor(Zotero.Items, '_primaryDataSQLParts').get;
	Zotero.defineProperty(Zotero.Items, '_primaryDataSQLParts', {
		get: function() {
			let obj = zi_primaryDataSQLParts.call(this);
			obj.feedItemGUID = "FeI.guid AS feedItemGUID";
			obj.feedItemReadTime = "FeI.readTime AS feedItemReadTime";
			return obj;
		}
	}, {lazy: true});
	Zotero.Items._primaryDataSQLFrom += " LEFT JOIN feedItems FeI ON (FeI.itemID=O.itemID)";
	
	let zi_getObjectForRow = Zotero.Items._getObjectForRow;
	Zotero.Items._getObjectForRow = function(row) {
		if (row.feedItemGUID) {
			return new Zotero.FeedItem();
		}
		
		return zi_getObjectForRow.apply(Zotero.Items, arguments);
	}
	
	this.getIDFromGUID = Zotero.Promise.coroutine(function* (guid) {
		if (_idCache[guid] !== undefined) return _idCache[guid];
		
		id = yield Zotero.DB.valueQueryAsync('SELECT itemID FROM feedItems WHERE guid=?', [guid]);
		if (!id) return false;
		
		this._setGUIDMapping(guid, id);
		return id;
	});
	
	this._setGUIDMapping = function(guid, id) {
		_idCache[guid] = id;
		_guidCache[id] = guid;
	};
	
	this._deleteGUIDMapping = function(guid, id) {
		if (!id) id = _idCache[guid];
		if (!guid) guid = _guidCache[id];
		
		if (!guid || !id) return;
		
		delete _idCache[guid];
		delete _guidCache[id];
	};
	
	this.unload = function() {
		Zotero.Items.unload.apply(Zotero.Items, arguments);
		let ids = Zotero.flattenArguments(arguments);
		for (let i=0; i<ids.length; i++) {
			this._deleteGUIDMapping(null, ids[i]);
		}
	};
	
	this.getAsyncByGUID = Zotero.Promise.coroutine(function* (guid) {
		let id = yield this.getIDFromGUID(guid);
		if (id === false) return false;
		
		return this.getAsync(id);
	});
	
	return this;
}.call({}),

// Proxy handler
{
	get: function(target, name) {
		return name in target
			? target[name]
			: Zotero.Items[name];
	},
	has: function(target, name) {
		return name in target || name in Zotero.Items;
	}
});