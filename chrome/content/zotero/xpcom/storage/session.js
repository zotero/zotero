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

Zotero.Sync.Storage.Session.prototype.checkServerCallback = function (uri, status, authRequired, window, skipSuccessMessage) {
	try {
		return this._session.checkServerCallback(uri, status, authRequired, window, skipSuccessMessage);
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
