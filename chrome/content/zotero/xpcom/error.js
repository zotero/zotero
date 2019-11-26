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


Zotero.Error = function (message, error, data) {
	this.message = message;
	if (data) {
		for (let prop in data) {
			this[prop] = data[prop];
		}
	}
	if (parseInt(error) == error) {
		this.error = error;
	}
	else {
		this.error = Zotero.Error["ERROR_" + error] ? Zotero.Error["ERROR_" + error] : 0;
	}
}
Zotero.Error.prototype = Object.create(Error.prototype);
Zotero.Error.prototype.name = "Zotero Error";

Zotero.Error.ERROR_UNKNOWN = 0;
Zotero.Error.ERROR_MISSING_OBJECT = 1;
Zotero.Error.ERROR_FULL_SYNC_REQUIRED = 2;
Zotero.Error.ERROR_API_KEY_NOT_SET = 3;
Zotero.Error.ERROR_API_KEY_INVALID = 4;
Zotero.Error.ERROR_ZFS_OVER_QUOTA = 5;
Zotero.Error.ERROR_ZFS_UPLOAD_QUEUE_LIMIT = 6;
Zotero.Error.ERROR_ZFS_FILE_EDITING_DENIED = 7;
Zotero.Error.ERROR_INVALID_ITEM_TYPE = 8;
Zotero.Error.ERROR_USER_NOT_AVAILABLE = 9;
Zotero.Error.ERROR_INVALID_COLLECTION_NESTING = 10;
//Zotero.Error.ERROR_SYNC_EMPTY_RESPONSE_FROM_SERVER = 6;
//Zotero.Error.ERROR_SYNC_INVALID_RESPONSE_FROM_SERVER = 7;

/**
 * Namespace for runtime exceptions
 * @namespace
 */
Zotero.Exception = {};

/**
 * Encapsulate exceptions with facilities for reporting the underlying cause and
 * displaying a dialog with information about the error.
 *
 * @param {String} name
 * @param {String[]} [params]
 * @param {String} [title]
 * @param {Error|String} [cause]
 * @property {String} name The name of the exception. This should correspond to a string 
 *     defined in zotero.properties. If it doesn't, it will be displayed as plain text.
 * @property {String[]} params Parameters to pass to Zotero.getString() to format the
 *     exception, or empty if no parameters.
 * @property {String} title The title of the window in which the error will appear. If
 *     not specified, the title is "Error."
 * @property {Error|String} cause If specified, the report and rethrow methods will
 *     operate on this error instead of the displayed error.
 */
Zotero.Exception.Alert = function(name, params, title, cause) {
	this.name = name;
	this.params = params || [];
	this._title = title || "general.error";
	this.cause = cause;
};

Zotero.Exception.Alert.prototype = {
	get title() {
		if(this._title) {
			try {
				return Zotero.getString(this._title);
			} catch(e) {}
		}
		try {
			return Zotero.getString("general.error");
		} catch(e) {
			// Something must be really wrong...
			return "Error";
		}
	},
	
	get message() {
		try {
			return Zotero.getString(this.name, this.params);
		} catch(e) {
			return this.name;
		}
	},
	
	/**
	 * Gets the error string
	 */
	"toString":function() {
		return this.cause ? this.cause.toString() : this.message;
	},
	
	/**
	 * Presents the error in a dialog
	 * @param {DOMWindow} window The window to which the error should be attached
	 */
	"present":function(window) {
		Components.utils.import("resource://gre/modules/Services.jsm");
		try {
			Services.prompt.alert(window || null, this.title, this.message);
		} catch(e) {
			Zotero.debug(e);
		}
	},
	
	/**
	 * Logs the error to the error console
	 */
	"log":function() {
		Zotero.logError(this.cause || this.toString());
	}
};

/**
 * Used to encapsulated cases where the user cancelled an action. This allows us to use
 * syntax like "catch (e if e instanceof Zotero.UserCancelledException) {}" to avoid
 * doing what we would do with normal exceptions.
 */
Zotero.Exception.UserCancelled = function(whatCancelled) {
	this.whatCancelled = whatCancelled || "current operation";
};
Zotero.Exception.UserCancelled.prototype = {
	"name":"UserCancelledException",
	"toString":function() { return "User cancelled "+this.whatCancelled+"."; }
};


Zotero.Exception.UnloadedDataException = function (msg, dataType) {
	this.message = msg;
	this.dataType = dataType;
	this.stack = (new Error).stack;
}
Zotero.Exception.UnloadedDataException.prototype = Object.create(Error.prototype);
Zotero.Exception.UnloadedDataException.prototype.name = "UnloadedDataException"