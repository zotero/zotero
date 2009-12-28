/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/


Zotero.Sync.Storage.Session = function (module, callbacks) {
	switch (module) {
		case 'webdav':
			this._session = new Zotero.Sync.Storage.Session.WebDAV(callbacks);
			break;
			
		case 'zfs':
			this._session = new Zotero.Sync.Storage.Session.ZFS(callbacks);
			break;
		
		default:
			throw ("Invalid storage session module '" + module + "'");
	}
	
	this.module = module;
	this.onError = callbacks.onError;
}

Zotero.Sync.Storage.Session.prototype.__defineGetter__('name', function () this._session.name);
Zotero.Sync.Storage.Session.prototype.__defineGetter__('includeUserFiles', function () this._session.includeUserFiles);
Zotero.Sync.Storage.Session.prototype.__defineGetter__('includeGroupFiles', function () this._session.includeGroupFiles);

Zotero.Sync.Storage.Session.prototype.__defineGetter__('enabled', function () {
	try {
		return this._session.enabled;
	}
	catch (e) {
		this.onError(e);
	}
});

Zotero.Sync.Storage.Session.prototype.__defineGetter__('verified', function () {
	try {
		return this._session.verified;
	}
	catch (e) {
		this.onError(e);
	}
});

Zotero.Sync.Storage.Session.prototype.__defineGetter__('active', function () {
	try {
		return this._session.active;
	}
	catch (e) {
		this.onError(e);
	}
});

Zotero.Sync.Storage.Session.prototype.__defineGetter__('username', function () {
	try {
		return this._session.username;
	}
	catch (e) {
		this.onError(e);
	}
});

Zotero.Sync.Storage.Session.prototype.__defineGetter__('password', function () {
	try {
		return this._session.password;
	}
	catch (e) {
		this.onError(e);
	}
});

Zotero.Sync.Storage.Session.prototype.__defineSetter__('password', function (val) {
	try {
		this._session.password = val;
	}
	catch (e) {
		this.onError(e);
	}
});


Zotero.Sync.Storage.Session.prototype.initFromPrefs = function () {
	try {
		return this._session.init();
	}
	catch (e) {
		this.onError(e);
	}
}

Zotero.Sync.Storage.Session.prototype.initFromPrefs = function () {
	try {
		return this._session.initFromPrefs();
	}
	catch (e) {
		this.onError(e);
	}
}

Zotero.Sync.Storage.Session.prototype.downloadFile = function (request) {
	try {
		this._session.downloadFile(request);
	}
	catch (e) {
		this.onError(e);
	}
}

Zotero.Sync.Storage.Session.prototype.uploadFile = function (request) {
	try {
		this._session.uploadFile(request);
	}
	catch (e) {
		this.onError(e);
	}
}

Zotero.Sync.Storage.Session.prototype.getLastSyncTime = function (callback) {
	try {
		this._session.getLastSyncTime(callback);
	}
	catch (e) {
		this.onError(e);
	}
}

Zotero.Sync.Storage.Session.prototype.setLastSyncTime = function (callback, useLastSyncTime) {
	try {
		this._session.setLastSyncTime(callback, useLastSyncTime);
	}
	catch (e) {
		this.onError(e);
	}
}

Zotero.Sync.Storage.Session.prototype.checkServer = function (callback) {
	try {
		this._session.checkServer(callback);
	}
	catch (e) {
		this.onError(e);
	}
}

Zotero.Sync.Storage.Session.prototype.checkServerCallback = function (uri, status, authRequired, window, skipSuccessMessage, error) {
	try {
		return this._session.checkServerCallback(uri, status, authRequired, window, skipSuccessMessage, error);
	}
	catch (e) {
		this.onError(e);
	}
}

Zotero.Sync.Storage.Session.prototype.purgeDeletedStorageFiles = function (callback) {
	try {
		this._session.purgeDeletedStorageFiles(callback);
	}
	catch (e) {
		this.onError(e);
	}
}

Zotero.Sync.Storage.Session.prototype.purgeOrphanedStorageFiles = function (callback) {
	try {
		this._session.purgeOrphanedStorageFiles(callback);
	}
	catch (e) {
		this.onError(e);
	}
}
