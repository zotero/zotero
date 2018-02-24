Components.utils.import("resource://zotero/pathparser.jsm", Zotero);
Zotero.Router = Zotero.PathParser;
delete Zotero.PathParser;

Zotero.Router.Utilities = {
	convertControllerToObjectType: function (params) {
		if (params.controller !== undefined) {
			params.objectType = Zotero.DataObjectUtilities.getObjectTypeSingular(params.controller);
			delete params.controller;
		}
	}
};


Zotero.Router.InvalidPathException = function (path) {
	this.path = path;
}


Zotero.Router.InvalidPathException.prototype = {
	name: "InvalidPathException",
	toString: function () {
		return "Path '" + this.path + "' could not be parsed";
	}
};
