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
			if(!Zotero.isFx && localStorage["translatorMetadata"]) {
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
		for(var i in translators) {
			var translator = new Zotero.Translator(translators[i]);
			_translators[translator.translatorID] = translator;
			
			for(var type in TRANSLATOR_TYPES) {
				if(translator.translatorType & TRANSLATOR_TYPES[type]) {
					_cache[type].push(translator);
				}
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
		if(translator.runMode === Zotero.Translator.RUN_MODE_IN_BROWSER) {
			translator.getCode(function() { callback(translator) });
		} else {
			callback(translator);
		}
	}
	
	/**
	 * Gets all translators for a specific type of translation
	 * @param {String} type The type of translators to get (import, export, web, or search)
	 * @param {Function} [callback] An optional callback to be executed when translators have been
	 *                              retrieved. If no callback is specified, translators are
	 *                              returned.
	 */
	this.getAllForType = function(type, callback, includeUnsupported) {
		if(!_initialized) Zotero.Translators.init()
		var translators = _cache[type].slice(0);
		new Zotero.Translators.CodeGetter(translators, callback, translators, includeUnsupported);
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
			var hostnames = m[2].split(".");
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
					} else if(Zotero.isFx) {
						// in Firefox, push the converterFunction
						converterFunctions.push(new function() {
							var re = new RegExp('^https?://(?:[^/]\\.)?'+Zotero.Utilities.quotemeta(properHosts[j-1]), "gi");
							var proxyHost = proxyHosts[j-1].replace(/\$/g, "$$$$");
							return function(uri) { return uri.replace(re, "$&."+proxyHost) };
						});
					} else {
						// in Chrome/Safari, the converterFunction needs to be passed as JSON, so
						// just push an array with the proper and proxyHosts
						converterFunctions.push([properHosts[j-1], proxyHosts[j-1]]);
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
	 * Saves all translator data to localStorage
	 */
	this.update = function(newMetadata, reset) {
		if(!_initialized) Zotero.Translators.init();
		if(!newMetadata.length) return;
		
		if(reset) {
			var serializedTranslators = newMetadata;
			if(!Zotero.isFx) {
				// clear cached translatorCode
				Zotero.debug("Translators: Resetting translators");
				for(var i in localStorage) {
					if(i.substr(0, TRANSLATOR_CODE_PREFIX.length) === TRANSLATOR_CODE_PREFIX) {
						delete localStorage[i];
					}
				}
			}
		} else {
			var serializedTranslators = [];
			var hasChanged = false;
			
			// Update translators with new metadata
			for(var i in newMetadata) {
				var newTranslator = new Zotero.Translator(newMetadata[i]);
				
				if(_translators.hasOwnProperty(newTranslator.translatorID)) {
					if(_translators[newTranslator.translatorID].lastUpdated !== newTranslator.lastUpdated) {
						if(!Zotero.isFx) {
							// if lastUpdated does not match between old and new translator
							// invalidate translator code cache
							delete localStorage["translatorCode-"+newTranslator.translatorID];
						}
						
						Zotero.debug("Translators: Updating "+newTranslator.label);
						hasChanged = true;
					}
				} else {
					Zotero.debug("Translators: Adding "+newTranslator.label);
					hasChanged = true;
				}
				
				_translators[newTranslator.translatorID] = newTranslator;
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
		if(!Zotero.isFx) {
			localStorage["translatorMetadata"] = JSON.stringify(serializedTranslators);
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
 * @param {Boolean} [includeUnsupported] If true, include code for unsupported translators
 */
Zotero.Translators.CodeGetter = function(translators, callback, callbackArgs, includeUnsupported) {
	this._translators = translators;
	this._callbackArgs = callbackArgs;
	this._callback = callback;
	this._includeUnsupported = includeUnsupported;
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
		
		if(this._translators[i].runMode === Zotero.Translator.RUN_MODE_IN_BROWSER || this._includeUnsupported) {
			// get next translator
			this._translators[i].getCode(function() { me.getCodeFor(i+1) });
			return;
		}
		
		// if we are not at end of list and there is no reason to retrieve the code, keep going
		// through the list of potential translators
		i++;
	}
}

const TRANSLATOR_REQUIRED_PROPERTIES = ["translatorID", "translatorType", "label", "creator", "target",
		"priority"];
var TRANSLATOR_PASSING_PROPERTIES = TRANSLATOR_REQUIRED_PROPERTIES.concat(["displayOptions", "configOptions",
		"browserSupport", "code", "runMode"]);
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
 * @property {Object} configOptions Configuration options for import/export
 * @property {Object} displayOptions Display options for export
 * @property {Boolean} inRepository Whether the translator may be found in the repository
 * @property {String} lastUpdated SQL-style date and time of translator's last update
 * @property {String} code The executable JavaScript for the translator
 */
Zotero.Translator = function(info) {
	// make sure we have all the properties
	for(var i in TRANSLATOR_REQUIRED_PROPERTIES) {
		var property = TRANSLATOR_REQUIRED_PROPERTIES[i];
		if(info[property] === undefined) {
			this.logError('Missing property "'+property+'" in translator metadata JSON object in ' + info.label);
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
	
	this._configOptions = info["configOptions"] ? info["configOptions"] : {};
	this._displayOptions = info["displayOptions"] ? info["displayOptions"] : {};
	
	if(this.translatorType & TRANSLATOR_TYPES["import"]) {
		// compile import regexp to match only file extension
		this.importRegexp = this.target ? new RegExp("\\."+this.target+"$", "i") : null;
	}
	 
	if(this.translatorType & TRANSLATOR_TYPES["web"]) {
		// compile web regexp
		this.webRegexp = this.target ? new RegExp(this.target, "i") : null;
	}
	
	if(info.code) {
		this.code = preprocessCode(info.code);
	}
}

/**
 * Retrieves code for this translator
 */
Zotero.Translator.prototype.getCode = function(callback) {
	if(this.code) {
		callback(true);
	} else {
		var me = this;
		Zotero.Repo.getTranslatorCode(this.translatorID,
			function(code) {
				if(!code) {
					callback(false);
				} else {
					// cache code for session only (we have standalone anyway)
					me.code = code;
					callback(true);
				}
			}
		);
	}
}

Zotero.Translator.prototype.__defineGetter__("displayOptions", function() {
	return Zotero.Utilities.deepCopy(this._displayOptions);
});
Zotero.Translator.prototype.__defineGetter__("configOptions", function() {
	return Zotero.Utilities.deepCopy(this._configOptions);
});

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