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

// Properties required for every translator
var TRANSLATOR_REQUIRED_PROPERTIES = ["translatorID", "translatorType", "label", "creator",
                                      "target", "priority", "lastUpdated"];
// Properties that are preserved if present
var TRANSLATOR_OPTIONAL_PROPERTIES = ["browserSupport", "minVersion", "maxVersion",
                                      "inRepository", "configOptions", "displayOptions",
                                      "hiddenPrefs"];
// Properties that are passed from background to inject page in connector
var TRANSLATOR_PASSING_PROPERTIES = TRANSLATOR_REQUIRED_PROPERTIES.
                                    concat(["browserSupport", "code", "runMode"]);
// Properties that are saved in connector if set but not required
var TRANSLATOR_SAVE_PROPERTIES = TRANSLATOR_REQUIRED_PROPERTIES.concat(["browserSupport"]);

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
 * @property {String} code The executable JavaScript for the translator
 * @property {Boolean} cacheCode Whether to cache code for this session (non-connector only)
 * @property {nsIFile} [file] File corresponding to this translator (non-connector only)
 */
Zotero.Translator = function(info) {
	this.init(info);
}

/**
 * Initializes a translator from a set of info, clearing code if it is set
 */
Zotero.Translator.prototype.init = function(info) {
	// make sure we have all the properties
	for(var i=0; i<TRANSLATOR_REQUIRED_PROPERTIES.length; i++) {
		var property = TRANSLATOR_REQUIRED_PROPERTIES[i];
		if(info[property] === undefined) {
			this.logError(new Error('Missing property "'+property+'" in translator metadata JSON object in ' + info.label));
			haveMetadata = false;
			break;
		} else {
			this[property] = info[property];
		}
	}
	for(var i=0; i<TRANSLATOR_OPTIONAL_PROPERTIES.length; i++) {
		var property = TRANSLATOR_OPTIONAL_PROPERTIES[i];
		if(info[property] !== undefined) {
			this[property] = info[property];
		}
	}
	
	this.browserSupport = info["browserSupport"] ? info["browserSupport"] : "g";
	
	var supported = (
		Zotero.isBookmarklet ?
			(this.browserSupport.indexOf(Zotero.browser) !== -1 && this.browserSupport.indexOf("b") !== -1) ||
			/(?:^|; ?)bookmarklet-debug-mode=1(?:$|; ?)/.test(document.cookie) :
		this.browserSupport.indexOf(Zotero.browser) !== -1);

	if(supported) {
		this.runMode = Zotero.Translator.RUN_MODE_IN_BROWSER;
	} else {
		this.runMode = Zotero.Translator.RUN_MODE_ZOTERO_STANDALONE;
	}
	
	if(this.translatorType & TRANSLATOR_TYPES["import"]) {
		// compile import regexp to match only file extension
		this.importRegexp = this.target ? new RegExp("\\."+this.target+"$", "i") : null;
	} else if(this.hasOwnProperty("importRegexp")) {
		delete this.importRegexp;
	}
	
	this.cacheCode = Zotero.isConnector;
	if(this.translatorType & TRANSLATOR_TYPES["web"]) {
		// compile web regexp
		this.cacheCode |= !this.target;
		this.webRegexp = this.target ? new RegExp(this.target, "i") : null;
	} else if(this.hasOwnProperty("webRegexp")) {
		delete this.webRegexp;
	}
	
	if(info.file) this.file = info.file;
	if(info.code && this.cacheCode) {
		this.code = info.code;
	} else if(this.hasOwnProperty("code")) {
		delete this.code;
	}
}

/**
 * Load code for a translator
 */
Zotero.Translator.prototype.getCode = function() {
	if(this.code) return Zotero.Promise.resolve(this.code);

	var me = this;
	if(Zotero.isConnector) {
		// TODO make this a promise
		return Zotero.Repo.getTranslatorCode(this.translatorID).
		spread(function(code, source) {
			if(!code) {
				throw "Code for "+me.label+" could not be retrieved";
			}
			// Cache any translators for session, since retrieving via
			// HTTP may be expensive
			me.code = code;
			me.codeSource = source;
			return code;
		});
	} else {
		var promise = Zotero.File.getContentsAsync(this.file);
		if(this.cacheCode) {
			// Cache target-less web translators for session, since we
			// will use them a lot
			promise.then(function(code) {
				me.code = code;
				return code;
			});
		}
		return promise;
	}
}

/**
 * Get metadata block for a translator
 */
Zotero.Translator.prototype.serialize = function(properties) {
	var info = {};
	for(var i in properties) {
		var property = properties[i];
		info[property] = translator[property];
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
	if(Zotero.isFx && this.file) {
		var ios = Components.classes["@mozilla.org/network/io-service;1"].
			getService(Components.interfaces.nsIIOService);
		Zotero.log(message, type ? type : "error", ios.newFileURI(this.file).spec);
	} else {
		Zotero.logError(message);
	}
}

Zotero.Translator.RUN_MODE_IN_BROWSER = 1;
Zotero.Translator.RUN_MODE_ZOTERO_STANDALONE = 2;
Zotero.Translator.RUN_MODE_ZOTERO_SERVER = 4;