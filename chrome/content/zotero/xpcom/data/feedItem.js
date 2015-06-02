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
 * Constructor for FeedItem object
 */
Zotero.FeedItem = function(itemTypeOrID, params = {}) {
	Zotero.FeedItem._super.call(this, itemTypeOrID);
	
	this._feedItemReadTime = null;
	
	Zotero.Utilities.assignProps(this, params, ['guid']);
}

Zotero.extendClass(Zotero.Item, Zotero.FeedItem)

Zotero.FeedItem.prototype._objectType = 'feedItem';
Zotero.FeedItem.prototype._containerObject = 'feed';

Zotero.defineProperty(Zotero.FeedItem.prototype, 'isFeedItem', {
	value: true
});

Zotero.defineProperty(Zotero.FeedItem.prototype, 'guid', {
	get: function() this._feedItemGUID,
	set: function(val) {
		if (this.id) throw new Error('Cannot set GUID after item ID is already set');
		if (typeof val != 'string') throw new Error('GUID must be a non-empty string');
		this._feedItemGUID = val;
	}
});

Zotero.defineProperty(Zotero.FeedItem.prototype, 'isRead', {
	get: function() {
		return !!this._feedItemReadTime;
	},
	set: function(read) {
		if (!read != !this._feedItemReadTime) {
			// changed
			if (read) {
				this._feedItemReadTime = Zotero.Date.dateToSQL(new Date(), true);
			} else {
				this._feedItemReadTime = null;
			}
			this._changed.feedItemData = true;
		}
	}
});

Zotero.FeedItem.prototype.loadPrimaryData = Zotero.Promise.coroutine(function* (reload, failOnMissing) {
	if (this.guid && !this.id) {
		// fill in item ID
		this.id = yield this.ObjectsClass.getIDFromGUID(this.guid);
	}
	yield Zotero.FeedItem._super.prototype.loadPrimaryData.apply(this, arguments);
});

Zotero.FeedItem.prototype.setField = function(field, value) {
	if (field == 'libraryID') {
		// Ensure that it references a feed
		if (!Zotero.Libraries.get(value).isFeed) {
			throw new Error('libraryID must reference a feed');
		}
	}
	
	return Zotero.FeedItem._super.prototype.setField.apply(this, arguments);
}


Zotero.FeedItem.prototype._initSave = Zotero.Promise.coroutine(function* (env) {
	if (!this.guid) {
		throw new Error('GUID must be set before saving ' + this._ObjectType);
	}
	
	let proceed = yield Zotero.FeedItem._super.prototype._initSave.apply(this, arguments);
	if (!proceed) return proceed;
	
	if (env.isNew) {
		// verify that GUID doesn't already exist for a new item
		var item = yield this.ObjectsClass.getIDFromGUID(this.guid);
		if (item) {
			throw new Error('Cannot create new item with GUID ' + this.guid + '. Item already exists.');
		}
		
		// Register GUID => itemID mapping in cache on commit
		if (!env.transactionOptions) env.transactionOptions = {};
		var superOnCommit = env.transactionOptions.onCommit;
		env.transactionOptions.onCommit = () => {
			if (superOnCommit) superOnCommit();
			this.ObjectsClass._setGUIDMapping(this.guid, env.id);
		};
	}
	
	return proceed;
});

Zotero.FeedItem.prototype.forceSaveTx = function(options) {
	let newOptions = {};
	Object.assign(newOptions, options || {});
	newOptions.skipEditCheck = true;
	return this.saveTx(newOptions);
}

Zotero.FeedItem.prototype._saveData = Zotero.Promise.coroutine(function* (env) {
	yield Zotero.FeedItem._super.prototype._saveData.apply(this, arguments);
	
	if (this._changed.feedItemData || env.isNew) {
		var sql = "REPLACE INTO feedItems VALUES (?,?,?)";
		yield Zotero.DB.queryAsync(sql, [env.id, this.guid, this._feedItemReadTime]);
		
		this._clearChanged('feedItemData');
	}
});

Zotero.FeedItem.prototype.forceEraseTx = function(options) {
	let newOptions = {};
	Object.assign(newOptions, options || {});
	newOptions.skipEditCheck = true;
	return this.eraseTx(newOptions);
}
