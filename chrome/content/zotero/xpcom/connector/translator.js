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

// Enumeration of types of translators
const TRANSLATOR_TYPES = {"import":1, "export":2, "web":4, "search":8};

/**
 * Singleton to handle loading and caching of translators
 * @namespace
 */
Zotero.Translators = new function() {
	var _cache, _translators;
	var _initialized = false;
	
	/**
	 * Initializes translator cache, loading all relevant translators into memory
	 * @param {Zotero.Translate[]} [translators] List of translators. If not specified, it will be
	 *                                           retrieved from storage.
	 */
	this.init = function(translators) {
		if(!translators) {
			translators = [];
			if((Zotero.isChrome || Zotero.isSafari) && localStorage["translatorMetadata"]) {
				try {
					translators = JSON.parse(localStorage["translatorMetadata"]);
					if(typeof translators !== "object") {
						translators = [];
					}
				} catch(e) {}
			}
		}
		
		_cache = {"import":[], "export":[], "web":[], "search":[]};
		_translators = {};
		_initialized = true;
		
		// Build caches
		for(var i=0; i<translators.length; i++) {
			try {
				var translator = new Zotero.Translator(translators[i]);
				_translators[translator.translatorID] = translator;
				
				for(var type in TRANSLATOR_TYPES) {
					if(translator.translatorType & TRANSLATOR_TYPES[type]) {
						_cache[type].push(translator);
					}
				}
			} catch(e) {
				Zotero.logError(e);
				try {
					Zotero.logError("Could not load translator "+JSON.stringify(translators[i]));
				} catch(e) {}
			}
		}
		
		// Sort by priority
		var cmp = function (a, b) {
			if (a.priority > b.priority) {
				return 1;
			}
			else if (a.priority < b.priority) {
				return -1;
			}
		}
		for(var type in _cache) {
			_cache[type].sort(cmp);
		}
	}
	
	/**
	 * Gets the translator that corresponds to a given ID, without attempting to retrieve code
	 * @param {String} id The ID of the translator
	 * @param {Function} [callback] An optional callback to be executed when translators have been
	 *                              retrieved. If no callback is specified, translators are
	 *                              returned.
	 */
	this.getWithoutCode = function(id) {
		if(!_initialized) Zotero.Translators.init();
		return _translators[id] ? _translators[id] : false;
	}
	
	/**
	 * Gets the translator that corresponds to a given ID
	 * @param {String} id The ID of the translator
	 * @param {Function} [callback] An optional callback to be executed when translators have been
	 *                              retrieved. If no callback is specified, translators are
	 *                              returned.
	 */
	this.get = function(id, callback) {
		if(!_initialized) Zotero.Translators.init();
		var translator = _translators[id];
		if(!translator) {
			callback(false);
			return false;
		}
		
		// only need to get code if it is of some use
		if(translator.runMode === Zotero.Translator.RUN_MODE_IN_BROWSER
				&& !translator.hasOwnProperty("code")) {
			translator.getCode(function() { callback(translator) });
		} else {
			callback(translator);
		}
	}
	
	/**
	 * Gets all translators for a specific type of translation
	 * @param {String} type The type of translators to get (import, export, web, or search)
	 * @param {Function} callback A required callback to be executed when translators have been
	 *                            retrieved.
	 * @param {Boolean} [debugMode] Whether to assume debugging mode. If true, code is included for 
	 *                              unsupported translators, and code originally retrieved from the
	 *                              repo is re-retrieved from Zotero Standalone.
	 */
	this.getAllForType = function(type, callback, debugMode) {
		if(!_initialized) Zotero.Translators.init()
		var translators = _cache[type].slice(0);
		new Zotero.Translators.CodeGetter(translators, callback, translators, debugMode);
		return true;
	}
	
	/**
	 * Gets web translators for a specific location
	 * @param {String} uri The URI for which to look for translators
	 * @param {Function} [callback] An optional callback to be executed when translators have been
	 *                              retrieved. If no callback is specified, translators are
	 *                              returned. The callback is passed a set of functions for
	 *                              converting URLs from proper to proxied forms as the second
	 *                              argument.
	 */
	this.getWebTranslatorsForLocation = function(uri, callback) {
		if(!_initialized) Zotero.Translators.init();
		var allTranslators = _cache["web"];
		var potentialTranslators = [];
		var searchURIs = [uri];
		
		Zotero.debug("Translators: Looking for translators for "+uri);
		
		// if there is a subdomain that is also a TLD, also test against URI with the domain
		// dropped after the TLD
		// (i.e., www.nature.com.mutex.gmu.edu => www.nature.com)
		var m = /^(https?:\/\/)([^\/]+)/i.exec(uri);
		var properHosts = [];
		var proxyHosts = [];
		if(m) {
			// First, drop the 0- if it exists (this is an III invention)
			var host = m[2];
			if(host.substr(0, 2) === "0-") host = host.substr(2);
			var hostnames = host.split(".");
			for(var i=1; i<hostnames.length-2; i++) {
				if(TLDS[hostnames[i].toLowerCase()]) {
					var properHost = hostnames.slice(0, i+1).join(".");
					searchURIs.push(m[1]+properHost+uri.substr(m[0].length));
					properHosts.push(properHost);
					proxyHosts.push(hostnames.slice(i+1).join("."));
				}
			}
		}
		
		var converterFunctions = [];
		for(var i=0; i<allTranslators.length; i++) {
			for(var j=0; j<searchURIs.length; j++) {
				// don't attempt to use translators with no target that can't be run in this browser
				// since that would require transmitting every page to Zotero host
				if(!allTranslators[i].webRegexp
						&& allTranslators[i].runMode !== Zotero.Translator.RUN_MODE_IN_BROWSER) {
					continue;
				}
				
				if(!allTranslators[i].webRegexp
						|| (uri.length < 8192 && allTranslators[i].webRegexp.test(searchURIs[j]))) {
					// add translator to list
					potentialTranslators.push(allTranslators[i]);
					
					if(j === 0) {
						converterFunctions.push(null);
					} else if(Zotero.isChrome || Zotero.isSafari) {
						// in Chrome/Safari, the converterFunction needs to be passed as JSON, so
						// just push an array with the proper and proxyHosts
						converterFunctions.push([properHosts[j-1], proxyHosts[j-1]]);
					} else {
						// in Firefox, push the converterFunction
						converterFunctions.push(new function() {
							var re = new RegExp('^https?://(?:[^/]\\.)?'+Zotero.Utilities.quotemeta(properHosts[j-1])+'(?=/)', "gi");
							var proxyHost = proxyHosts[j-1].replace(/\$/g, "$$$$");
							return function(uri) { return uri.replace(re, "$&."+proxyHost) };
						});
					}
					
					// don't add translator more than once
					break;
				}
			}
		}
		
		new Zotero.Translators.CodeGetter(potentialTranslators, callback,
				[potentialTranslators, converterFunctions]);
		return true;
	}
	
	/**
	 * Converts translators to JSON-serializable objects
	 */
	this.serialize = function(translator, properties) {
		// handle translator arrays
		if(translator.length !== undefined) {
			var newTranslators = new Array(translator.length);
			for(var i in translator) {
				newTranslators[i] = Zotero.Translators.serialize(translator[i], properties);
			}
			return newTranslators;
		}
		
		// handle individual translator
		var newTranslator = {};
		for(var i in properties) {
			var property = properties[i];
			newTranslator[property] = translator[property];
		}
		return newTranslator;
	}
	
	/**
	 * Saves all translator metadata to localStorage
	 * @param {Object[]} newMetadata Metadata for new translators
	 * @param {Boolean} reset Whether to clear all existing translators and overwrite them with
	 *                        the specified translators.
	 */
	this.update = function(newMetadata, reset) {
		if(!_initialized) Zotero.Translators.init();
		if(!newMetadata.length) return;
		
		if(reset) {
			var serializedTranslators = newMetadata.filter(function(translator) {
				return !translator.deleted;
			});
		} else {
			var serializedTranslators = [];
			var hasChanged = false;
			
			// Update translators with new metadata
			for(var i in newMetadata) {
				var newTranslator = newMetadata[i];
				
				if(newTranslator.deleted) {
					// handle translator deletions
					delete _translators[newTranslator.translatorID];
				} else if(_translators.hasOwnProperty(newTranslator.translatorID)) {
					var oldTranslator = _translators[newTranslator.translatorID];
					
					// check whether translator has changed
					if(oldTranslator.lastUpdated !== newTranslator.lastUpdated) {
						// check whether newTranslator is actually newer than the existing
						// translator, and if not, don't update
						if(Zotero.Date.sqlToDate(newTranslator.lastUpdated) < Zotero.Date.sqlToDate(oldTranslator.lastUpdated)) {
							continue;
						}
						
						Zotero.debug("Translators: Updating "+newTranslator.label);
						oldTranslator.init(newTranslator);
						hasChanged = true;
					}
				} else {
					Zotero.debug("Translators: Adding "+newTranslator.label);
					_translators[newTranslator.translatorID] = new Zotero.Translator(newTranslator);
					hasChanged = true;
				}
			}
			
			if(!hasChanged) return;
			
			// Serialize translators
			for(var i in _translators) {
				var serializedTranslator = this.serialize(_translators[i], TRANSLATOR_SAVE_PROPERTIES);
				
				// don't save run mode
				delete serializedTranslator.runMode;
				
				serializedTranslators.push(serializedTranslator);
			}
		}
		
		// Store
		if(Zotero.isChrome || Zotero.isSafari) {
			var serialized = JSON.stringify(serializedTranslators);
			localStorage["translatorMetadata"] = serialized;
			Zotero.debug("Translators: Saved updated translator list ("+serialized.length+" characters)");
		}
		
		// Reinitialize
		Zotero.Translators.init(serializedTranslators);
	}
	
	/**
	 * Preprocesses code for a translator
	 */
	this.preprocessCode = function(code) {
		if(!Zotero.isFx) {
			const foreach = /^(\s*)for each\s*\((var )?([^ ]+) in (.*?)\)(\s*){/gm;
			code = code.replace(foreach, "$1var $3_zForEachSubject = $4; "+
				"for(var $3_zForEachIndex in $3_zForEachSubject)$5{ "+
				"$2$3 = $3_zForEachSubject[$3_zForEachIndex];", code);
		}
		return code;
	}
}

/**
 * A class to get the code for a set of translators at once
 *
 * @param {Zotero.Translator[]} translators Translators for which to retrieve code
 * @param {Function} callback Callback to call once code has been retrieved
 * @param {Function} callbackArgs All arguments to be passed to callback (including translators)
 * @param {Boolean} [debugMode] If true, include code for unsupported translators
 */
Zotero.Translators.CodeGetter = function(translators, callback, callbackArgs, debugMode) {
	this._translators = translators;
	this._callbackArgs = callbackArgs;
	this._callback = callback;
	this._debugMode = debugMode;
	this.getCodeFor(0);
}

Zotero.Translators.CodeGetter.prototype.getCodeFor = function(i) {
	var me = this;
	while(true) {
		if(i === this._translators.length) {
			// all done; run callback
			this._callback(this._callbackArgs);
			return;
		}
		
		var translator = this._translators[i];
		
		// retrieve code if no code and translator is supported locally
		if((translator.runMode === Zotero.Translator.RUN_MODE_IN_BROWSER && !translator.hasOwnProperty("code"))
				// or if debug mode is enabled (even if unsupported locally)
				|| (this._debugMode && (!translator.hasOwnProperty("code")
				// or if in debug mode and the code we have came from the repo (which doesn't
				// include test cases)
				|| (Zotero.Repo && translator.codeSource === Zotero.Repo.SOURCE_REPO)))) {
				// get next translator
			translator.getCode(function() { me.getCodeFor(i+1) });
			return;
		}
		
		// if we are not at end of list and there is no reason to retrieve the code, keep going
		// through the list of potential translators
		i++;
	}
}

const TRANSLATOR_REQUIRED_PROPERTIES = ["translatorID", "translatorType", "label", "creator", "target",
		"priority", "lastUpdated"];
var TRANSLATOR_PASSING_PROPERTIES = TRANSLATOR_REQUIRED_PROPERTIES.concat(["browserSupport", "code", "runMode"]);
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
 */
Zotero.Translator = function(info) {
	this.init(info);
}

/**
 * Initializes a translator from a set of info, clearing code if it is set
 */
Zotero.Translator.prototype.init = function(info) {
	// make sure we have all the properties
	for(var i in TRANSLATOR_REQUIRED_PROPERTIES) {
		var property = TRANSLATOR_REQUIRED_PROPERTIES[i];
		if(info[property] === undefined) {
			Zotero.logError(new Error('Missing property "'+property+'" in translator metadata JSON object in ' + info.label));
			haveMetadata = false;
			break;
		} else {
			this[property] = info[property];
		}
	}
	
	this.browserSupport = info["browserSupport"] ? info["browserSupport"] : "g";
	
	if(this.browserSupport.indexOf(Zotero.browser) !== -1) {
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
	 
	if(this.translatorType & TRANSLATOR_TYPES["web"]) {
		// compile web regexp
		this.webRegexp = this.target ? new RegExp(this.target, "i") : null;
	} else if(this.hasOwnProperty("webRegexp")) {
		delete this.webRegexp;
	}
	
	if(info.code) {
		this.code = Zotero.Translators.preprocessCode(info.code);
	} else if(this.hasOwnProperty("code")) {
		delete this.code;
	}
}

/**
 * Retrieves code for this translator
 */
Zotero.Translator.prototype.getCode = function(callback) {
	var me = this;
	Zotero.Repo.getTranslatorCode(this.translatorID,
		function(code, source) {
			if(!code) {
				callback(false);
			} else {
				// cache code for session only (we have standalone anyway)
				me.code = code;
				me.codeSource = source;
				callback(true);
			}
		}
	);
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
	Zotero.logError(message);
}

Zotero.Translator.RUN_MODE_IN_BROWSER = 1;
Zotero.Translator.RUN_MODE_ZOTERO_STANDALONE = 2;
Zotero.Translator.RUN_MODE_ZOTERO_SERVER = 4;