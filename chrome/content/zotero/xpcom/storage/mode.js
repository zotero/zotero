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


Zotero.Sync.Storage.Mode = function () {};

Zotero.Sync.Storage.Mode.prototype.__defineGetter__('enabled', function () {
	try {
		return this._enabled;
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});

Zotero.Sync.Storage.Mode.prototype.__defineGetter__('verified', function () {
	try {
		return this._verified;
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});

Zotero.Sync.Storage.Mode.prototype.__defineGetter__('active', function () {
	try {
		return this._enabled && this._verified && this._initFromPrefs();
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});

Zotero.Sync.Storage.Mode.prototype.__defineGetter__('username', function () {
	try {
		return this._username;
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});

Zotero.Sync.Storage.Mode.prototype.__defineGetter__('password', function () {
	try {
		return this._password;
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});

Zotero.Sync.Storage.Mode.prototype.__defineSetter__('password', function (val) {
	try {
		this._password = val;
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});

Zotero.Sync.Storage.Mode.prototype.init = function () {
	try {
		return this._init();
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Mode.prototype.initFromPrefs = function () {
	try {
		return this._initFromPrefs();
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Mode.prototype.sync = function (observer) {
	Zotero.Sync.Storage.sync(this.name, observer);
}

Zotero.Sync.Storage.Mode.prototype.downloadFile = function (request) {
	try {
		this._downloadFile(request);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Mode.prototype.uploadFile = function (request) {
	try {
		this._uploadFile(request);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Mode.prototype.getLastSyncTime = function (callback) {
	try {
		this._getLastSyncTime(callback);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Mode.prototype.setLastSyncTime = function (callback, useLastSyncTime) {
	try {
		this._setLastSyncTime(callback, useLastSyncTime);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Mode.prototype.checkServer = function (callback) {
	try {
		return this._checkServer(callback);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Mode.prototype.checkServerCallback = function (uri, status, window, skipSuccessMessage) {
	try {
		return this._checkServerCallback(uri, status, window, skipSuccessMessage);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Mode.prototype.cacheCredentials = function (callback) {
	try {
		return this._cacheCredentials(callback);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Mode.prototype.purgeDeletedStorageFiles = function (callback) {
	try {
		this._purgeDeletedStorageFiles(callback);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Mode.prototype.purgeOrphanedStorageFiles = function (callback) {
	try {
		this._purgeOrphanedStorageFiles(callback);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}
