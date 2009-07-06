Zotero.Error = function (message, error) {
	this.name = "ZOTERO_ERROR";
	this.message = message;
	if (parseInt(error) == error) {
		this.error = error;
	}
	else {
		this.error = Zotero.Error["ERROR_" + error] ? Zotero.Error["ERROR_" + error] : 0;
	}
}

Zotero.Error.ERROR_UNKNOWN = 0;
Zotero.Error.ERROR_MISSING_OBJECT = 1;

Zotero.Error.prototype.toString = function () {
	return this.message;
}
