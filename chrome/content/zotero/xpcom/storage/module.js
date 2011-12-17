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


Zotero.Sync.Storage.Module = function (moduleName) {
	switch (moduleName) {
		case 'ZFS':
			this._module = Zotero.Sync.Storage.Module.ZFS;
			break;
		
		case 'WebDAV':
			this._module = Zotero.Sync.Storage.Module.WebDAV;
			break;
			
		default:
			throw ("Invalid storage session module '" + moduleName + "'");
	}
};

Zotero.Sync.Storage.Module.prototype.__defineGetter__('name', function () this._module.name);
Zotero.Sync.Storage.Module.prototype.__defineGetter__('includeUserFiles', function () this._module.includeUserFiles);
Zotero.Sync.Storage.Module.prototype.__defineGetter__('includeGroupFiles', function () this._module.includeGroupFiles);

Zotero.Sync.Storage.Module.prototype.__defineGetter__('enabled', function () {
	try {
		return this._module.enabled;
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});

Zotero.Sync.Storage.Module.prototype.__defineGetter__('verified', function () {
	try {
		return this._module.verified;
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});

Zotero.Sync.Storage.Module.prototype.__defineGetter__('active', function () {
	try {
		return this._module.enabled && this._module.initFromPrefs() && this._module.verified;
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});

Zotero.Sync.Storage.Module.prototype.__defineGetter__('username', function () {
	try {
		return this._module.username;
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});

Zotero.Sync.Storage.Module.prototype.__defineGetter__('password', function () {
	try {
		return this._module.password;
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});

Zotero.Sync.Storage.Module.prototype.__defineSetter__('password', function (val) {
	try {
		this._module.password = val;
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
});


Zotero.Sync.Storage.Module.prototype.init = function () {
	try {
		return this._module.init();
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Module.prototype.initFromPrefs = function () {
	try {
		return this._module.initFromPrefs();
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Module.prototype.downloadFile = function (request) {
	try {
		this._module.downloadFile(request);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Module.prototype.uploadFile = function (request) {
	try {
		this._module.uploadFile(request);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Module.prototype.getLastSyncTime = function (callback) {
	try {
		this._module.getLastSyncTime(callback);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Module.prototype.setLastSyncTime = function (callback, useLastSyncTime) {
	try {
		this._module.setLastSyncTime(callback, useLastSyncTime);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Module.prototype.checkServer = function (callback) {
	try {
		return this._module.checkServer(callback);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Module.prototype.checkServerCallback = function (uri, status, window, skipSuccessMessage) {
	try {
		return this._module.checkServerCallback(uri, status, window, skipSuccessMessage);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Module.prototype.cacheCredentials = function (callback) {
	try {
		return this._module.cacheCredentials(callback);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Module.prototype.purgeDeletedStorageFiles = function (callback) {
	try {
		this._module.purgeDeletedStorageFiles(callback);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}

Zotero.Sync.Storage.Module.prototype.purgeOrphanedStorageFiles = function (callback) {
	try {
		this._module.purgeOrphanedStorageFiles(callback);
	}
	catch (e) {
		Zotero.Sync.Storage.EventManager.error(e);
	}
}
