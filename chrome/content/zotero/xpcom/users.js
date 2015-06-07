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
		var sql = "SELECT value FROM settings WHERE setting='account' AND key='userID'";
		_userID = yield Zotero.DB.valueQueryAsync(sql);
		
		if (_userID) {
			sql = "SELECT value FROM settings WHERE setting='account' AND key='libraryID'";
			_libraryID = yield Zotero.DB.valueQueryAsync(sql);
			
			sql = "SELECT value FROM settings WHERE setting='account' AND key='username'";
			_username = yield Zotero.DB.valueQueryAsync(sql);
		}
		// If we don't have a global user id, generate a local user key
		else {
			sql = "SELECT value FROM settings WHERE setting='account' AND key='localUserKey'";
			let key = yield Zotero.DB.valueQueryAsync(sql);
			// Generate a local user key if we don't have one
			if (!key) {
				key = Zotero.randomString(8);
				sql = "INSERT INTO settings VALUES ('account', 'localUserKey', ?)";
				yield Zotero.DB.queryAsync(sql, key);
			}
			_localUserKey = key;
		}
	});
	
	
	this.getCurrentUserID = () => _userID;
	this.setCurrentUserID = function (val) {
		val = parseInt(val);
		_userID = val;
		var sql = "REPLACE INTO settings VALUES ('account', 'userID', ?)";
		return Zotero.DB.queryAsync(sql, val);
	};
	
	
	this.getCurrentUsername = () => _username;
	this.setCurrentUsername = function (val) {
		_username = val;
		var sql = "REPLACE INTO settings VALUES ('account', 'username', ?)";
		return Zotero.DB.queryAsync(sql, val);
	};
	
	
	this.getLocalUserKey = function () {
		if (!_localUserKey) {
			throw new Error("Local user key not available");
		}
		return _localUserKey;
	};
};
