Zotero.Error = function (message, error, data) {
	this.name = "ZOTERO_ERROR";
	this.message = message;
	this.data = data;
	if (parseInt(error) == error) {
		this.error = error;
	}
	else {
		this.error = Zotero.Error["ERROR_" + error] ? Zotero.Error["ERROR_" + error] : 0;
	}
}

Zotero.Error.ERROR_UNKNOWN = 0;
Zotero.Error.ERROR_MISSING_OBJECT = 1;
Zotero.Error.ERROR_FULL_SYNC_REQUIRED = 2;
Zotero.Error.ERROR_SYNC_USERNAME_NOT_SET = 3;
Zotero.Error.ERROR_INVALID_SYNC_LOGIN = 4;
Zotero.Error.ERROR_ZFS_OVER_QUOTA = 5;
Zotero.Error.ERROR_ZFS_UPLOAD_QUEUE_LIMIT = 6;
Zotero.Error.ERROR_ZFS_FILE_EDITING_DENIED = 7;
//Zotero.Error.ERROR_SYNC_EMPTY_RESPONSE_FROM_SERVER = 6;
//Zotero.Error.ERROR_SYNC_INVALID_RESPONSE_FROM_SERVER = 7;

Zotero.Error.prototype.toString = function () {
	return this.message;
}
