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

Zotero.Sync.Storage.Mode.prototype.__defineGetter__('verified', function () {
	return this._verified;
});

Zotero.Sync.Storage.Mode.prototype.__defineGetter__('username', function () {
	return this._username;
});

Zotero.Sync.Storage.Mode.prototype.__defineGetter__('password', function () {
	return this._password;
});

Zotero.Sync.Storage.Mode.prototype.__defineSetter__('password', function (val) {
	this._password = val;
});

Zotero.Sync.Storage.Mode.prototype.init = function () {
	return this._init();
}

Zotero.Sync.Storage.Mode.prototype.sync = function (observer) {
	return Zotero.Sync.Storage.sync(this.name, observer);
}

Zotero.Sync.Storage.Mode.prototype.downloadFile = function (request) {
	return this._downloadFile(request);
}

Zotero.Sync.Storage.Mode.prototype.uploadFile = function (request) {
	return this._uploadFile(request);
}

Zotero.Sync.Storage.Mode.prototype.getLastSyncTime = function (libraryID) {
	return this._getLastSyncTime(libraryID);
}

Zotero.Sync.Storage.Mode.prototype.setLastSyncTime = function (callback, useLastSyncTime) {
	return this._setLastSyncTime(callback, useLastSyncTime);
}

Zotero.Sync.Storage.Mode.prototype.checkServer = function (callback) {
	return this._checkServer(callback);
}

Zotero.Sync.Storage.Mode.prototype.checkServerCallback = function (uri, status, window, skipSuccessMessage) {
	return this._checkServerCallback(uri, status, window, skipSuccessMessage);
}

Zotero.Sync.Storage.Mode.prototype.cacheCredentials = function () {
	return this._cacheCredentials();
}

Zotero.Sync.Storage.Mode.prototype.purgeDeletedStorageFiles = function (callback) {
	return this._purgeDeletedStorageFiles(callback);
}

Zotero.Sync.Storage.Mode.prototype.purgeOrphanedStorageFiles = function (callback) {
	return this._purgeOrphanedStorageFiles(callback);
}
