/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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
 * Small cache for language preferences.
 * Run taint(<prefName>) method on this object after update to DB.
 */
Zotero.CachedLanguagePreferences = function () {
	this._zoteroSort = false;
	this._zoteroDisplay = false;
	this._tainted = {};
	this._tainted.zoteroSort = true;
	this._tainted.zoteroDisplay = true;
};

Zotero.CachedLanguagePreferences.prototype.__defineGetter__('zoteroSort', function () { return this.get('zoteroSort'); });
Zotero.CachedLanguagePreferences.prototype.__defineGetter__('zoteroDisplay', function () { return this.get('zoteroDisplay'); });

Zotero.CachedLanguagePreferences.prototype.get = function (prefName) {
	if (this._tainted[prefName]) {
		var sql = "SELECT tag FROM zlsPreferences WHERE profile=? AND param=?";
		this["_" + prefName] = Zotero.DB.columnQuery(sql,['default',prefName]);
		this._tainted[prefName] = false;
	}
	return this["_" + prefName];
};

Zotero.CachedLanguagePreferences.prototype.taint = function () {
	this._tainted.zoteroSort = true;
	this._tainted.zoteroDisplay = true;
};
Zotero.CachedLanguagePreferences = new Zotero.CachedLanguagePreferences();


/*
 * Simple cache for language nicknames.
 */
Zotero.CachedLanguages = new function() {
	var _languages = {};
		
	this.menuHasChanged = menuHasChanged;
		
	this._languagesLoaded = false;
	this.getNickname = getNickname;
	this.taint = taint;
	this.hasTag = hasTag;

	function hasTag(langTag) {
		if (_languages[langTag]) {
			return true;
		} else {
			return false;
		}
	};

	function taint () {
		this._languagesLoaded = false;
	}
	
	function menuHasChanged () {
		if (this._languagesLoaded) {
			return false;
		} else {
			return true;
		}
	};

	function load () {
		for (var key in _languages) {
			delete _languages[key];
		}
		var sql = 'SELECT tag,nickname FROM zlsTags';
		var tags = Zotero.DB.query(sql);
		for (var i = 0, ilen = tags.length; i < ilen; i += 1) {
			var tag = tags[i].tag;
			var nickname = tags[i].nickname;
			_languages[tag] = nickname;
			this._languagesLoaded = true;
		}
	}

	function getNickname(tag) {
		// Add language(s) for tag on cache failure.
		// Returns undefined if tag is invalid.
		if (!this._languagesLoaded) {
			load();
		}
		if ("undefined" === typeof _languages[tag]) {
			var validator = Zotero.zlsValidator;
			var res = validator.validate(tag);
			if (res) {
				tag = [validator.tagdata[i].subtag for (i in validator.tagdata)].join("-");
				var sql = 'INSERT INTO zlsTags VALUES(?,?,NULL)';
				Zotero.DB.query(sql,[tag,tag]);
				_languages[tag] = tag;
				this._languagesLoaded = false;
			}
		}
		return _languages[tag];
	}
};
