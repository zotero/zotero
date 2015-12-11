/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2014 Center for History and New Media
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

Zotero.Users = new function () {
	var _userID;
	var _libraryID;
	var _username;
	var _localUserKey;
	
	this.init = Zotero.Promise.coroutine(function* () {
		let sql = "SELECT key, value FROM settings WHERE setting='account'";
		let rows = yield Zotero.DB.queryAsync(sql);
		
		let settings = {};
		for (let i=0; i<rows.length; i++) {
			settings[rows[i].key] = rows[i].value;
		}
		
		if (settings.userID) {
			_userID = settings.userID;
			_libraryID = settings.libraryID;
			_username = settings.username;
		}
		// Clear old values when reinitializing for tests
		else {
			_userID = undefined;
			_libraryID = undefined;
			_username = undefined;
		}
		
		if (settings.localUserKey) {
			_localUserKey = settings.localUserKey;
		} else {
			let key = Zotero.randomString(8);
			
			sql = "INSERT INTO settings VALUES ('account', 'localUserKey', ?)";
			yield Zotero.DB.queryAsync(sql, key);
			
			_localUserKey = key;
		}
	});
	
	
	this.getCurrentUserID = function() { return _userID };
	this.setCurrentUserID = Zotero.Promise.coroutine(function* (val) {
		val = parseInt(val);
		if (!(val > 0)) throw new Error("userID must be a positive integer");
		
		var sql = "REPLACE INTO settings VALUES ('account', 'userID', ?)";
		yield Zotero.DB.queryAsync(sql, val);
		_userID = val;
	});
	
	
	this.getCurrentUsername = () => _username;
	this.setCurrentUsername = Zotero.Promise.coroutine(function* (val) {
		if (!val || typeof val != 'string') throw new Error('username must be a non-empty string');
		
		var sql = "REPLACE INTO settings VALUES ('account', 'username', ?)";
		yield Zotero.DB.queryAsync(sql, val);
		_username = val;
	});
	
	
	this.getLocalUserKey = function () {
		return _localUserKey;
	};
};
