/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2013 Center for History and New Media
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

// Enumeration of types of translators
var TRANSLATOR_TYPES = {"import":1, "export":2, "web":4, "search":8};

// Properties required for every translator
var TRANSLATOR_REQUIRED_PROPERTIES = ["translatorID", "translatorType", "label", "creator",
                                      "target", "priority", "lastUpdated"];
// Properties that are preserved if present
var TRANSLATOR_OPTIONAL_PROPERTIES = ["targetAll", "browserSupport", "minVersion", "maxVersion",
                                      "inRepository", "configOptions", "displayOptions",
                                      "hiddenPrefs", "itemType"];
// Properties that are passed from background to inject page in connector
var TRANSLATOR_PASSING_PROPERTIES = TRANSLATOR_REQUIRED_PROPERTIES.
                                    concat(["targetAll", "browserSupport", "code", "runMode", "itemType", "inRepository"]);

/**
 * @class Represents an individual translator
 * @constructor
 * @property {String} translatorID Unique GUID of the translator
 * @property {Integer} translatorType Type of the translator (use bitwise & with TRANSLATOR_TYPES to read)
 * @property {String} label Human-readable name of the translator
 * @property {String} creator Author(s) of the translator
 * @property {String} target Location that the translator processes
 * @property {String} minVersion Minimum Zotero version
 * @property {String} maxVersion Minimum Zotero version
 * @property {Integer} priority Lower-priority translators will be selected first
 * @property {String} browserSupport String indicating browser supported by the translator
 *     g = Gecko (Firefox)
 *     c = Google Chrome (WebKit & V8)
 *     s = Safari (WebKit & Nitro/Squirrelfish Extreme)
 *     i = Internet Explorer
 *     b = Bookmarklet
 *     v = Server
 * @property {Object} configOptions Configuration options for import/export
 * @property {Object} displayOptions Display options for export
 * @property {Object} hiddenPrefs Hidden preferences configurable through about:config
 * @property {Boolean} inRepository Whether the translator may be found in the repository
 * @property {String} lastUpdated SQL-style date and time of translator's last update
 * @property {Object} metadata - Metadata block as object
 * @property {String} code The executable JavaScript for the translator
 * @property {Boolean} cacheCode Whether to cache code for this session (non-connector only)
 * @property {String} [path] File path corresponding to this translator (non-connector only)
 * @property {String} [fileName] File name corresponding to this translator (non-connector only)
 */
Zotero.Translator = function(info) {
	this.init(info);
}

/**
 * Initializes a translator from a set of info, clearing code if it is set
 */
Zotero.Translator.prototype.init = function(info) {
	// make sure we have all the properties
	for (let property of TRANSLATOR_REQUIRED_PROPERTIES) {
		if (info[property] === undefined) {
			this.logError(new Error('Missing property "'+property+'" in translator metadata JSON object in ' + info.label));
			break;
		} else {
			this[property] = info[property];
		}
	}
	for (let property of TRANSLATOR_OPTIONAL_PROPERTIES) {
		if(info[property] !== undefined) {
			this[property] = info[property];
		}
	}
	
	this.browserSupport = info["browserSupport"] ? info["browserSupport"] : "g";
	
	var supported = !Zotero.isBookmarklet || this.browserSupport.includes("b") ||
			/(?:^|; ?)bookmarklet-debug-mode=1(?:$|; ?)/.test(document.cookie);

	if (supported) {
		this.runMode = Zotero.Translator.RUN_MODE_IN_BROWSER;
	} else {
		this.runMode = Zotero.Translator.RUN_MODE_ZOTERO_STANDALONE;
	}
	
	if (this.translatorType & TRANSLATOR_TYPES["import"]) {
		// compile import regexp to match only file extension
		this.importRegexp = this.target ? new RegExp("\\."+this.target+"$", "i") : null;
	} else if (this.hasOwnProperty("importRegexp")) {
		delete this.importRegexp;
	}
	
	this.cacheCode = Zotero.isConnector || info.cacheCode;
	if (this.translatorType & TRANSLATOR_TYPES["web"]) {
		// compile web regexp
		this.cacheCode |= !this.target;
		this.webRegexp = {
			root: this.target ? new RegExp(this.target, "i") : null,
			all: this.targetAll ? new RegExp(this.targetAll, "i") : null
		};
	} else if (this.hasOwnProperty("webRegexp")) {
		delete this.webRegexp;
	}
	
	if (info.path) {
		this.path = info.path;
		this.fileName = OS.Path.basename(info.path);
	}
	if (info.code && this.cacheCode) {
		this.code = Zotero.Translator.replaceDeprecatedStatements(info.code);
	} else if (this.hasOwnProperty("code")) {
		delete this.code;
	}
	// Save a copy of the metadata block
	delete info.path;
	delete info.code;
	this.metadata = info;

}

/**
 * Load code for a translator
 */
Zotero.Translator.prototype.getCode = Zotero.Promise.method(function () {
	if (this.code) return this.code;

	if (Zotero.isConnector) {
		return Zotero.Repo.getTranslatorCode(this.translatorID)
		.then(function (args) {
			var code = args[0];
			var source = args[1];
			if(!code) {
				throw new Error("Code for " + this.label + " could not be retrieved");
			}
			// Cache any translators for session, since retrieving via
			// HTTP may be expensive
			this.code = code;
			this.codeSource = source;
			return code;
		}.bind(this));
	} else {
		var promise = Zotero.File.getContentsAsync(this.path);
		if(this.cacheCode) {
			// Cache target-less web translators for session, since we
			// will use them a lot
			return promise.then(function(code) {
				this.code = code;
				return code;
			}.bind(this));
		}
		return promise;
	}
});

/**
 * Get metadata block for a translator
 */
Zotero.Translator.prototype.serialize = function(properties) {
	var info = {};
	for(var i in properties) {
		var property = properties[i];
		info[property] = this[property];
	}
	return info;
}

/**
 * Log a translator-related error
 * @param {String} message The error message
 * @param {String} [type] The error type ("error", "warning", "exception", or "strict")
 * @param {String} [line] The text of the line on which the error occurred
 * @param {Integer} lineNumber
 * @param {Integer} colNumber
 */
Zotero.Translator.prototype.logError = function(message, type, line, lineNumber, colNumber) {
	if (Zotero.isFx && this.path) {
		Components.utils.import("resource://gre/modules/FileUtils.jsm");
		var file = new FileUtils.File(this.path);
		var ios = Components.classes["@mozilla.org/network/io-service;1"].
			getService(Components.interfaces.nsIIOService);
		Zotero.log(message, type ? type : "error", ios.newFileURI(file).spec);
		Zotero.debug(message, 1);
	} else {
		Zotero.logError(message);
	}
}

/**
 * Replace deprecated ES5 statements
 */
Zotero.Translator.replaceDeprecatedStatements = function(code) {
	const foreach = /^(\s*)for each\s*\((var )?([^ ]+) in (.*?)\)(\s*){/gm;
	code = code.replace(foreach, "$1var $3_zForEachSubject = $4; "+
		"for(var $3_zForEachIndex in $3_zForEachSubject)$5{ "+
		"$2$3 = $3_zForEachSubject[$3_zForEachIndex];");
	return code;
}

Zotero.Translator.RUN_MODE_IN_BROWSER = 1;
Zotero.Translator.RUN_MODE_ZOTERO_STANDALONE = 2;
Zotero.Translator.RUN_MODE_ZOTERO_SERVER = 4;
Zotero.Translator.TRANSLATOR_TYPES = TRANSLATOR_TYPES;
Zotero.Translator.TRANSLATOR_OPTIONAL_PROPERTIES = TRANSLATOR_OPTIONAL_PROPERTIES;
Zotero.Translator.TRANSLATOR_REQUIRED_PROPERTIES = TRANSLATOR_REQUIRED_PROPERTIES;
