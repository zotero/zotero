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
	 */
	this.reinit = Q.async(function() {
		var start = (new Date()).getTime();
		var transactionStarted = false;
		
		_cache = {"import":[], "export":[], "web":[], "search":[]};
		_translators = {};
		
		var dbCacheResults = yield Zotero.DB.queryAsync("SELECT leafName, translatorJSON, "+
			"code, lastModifiedTime FROM translatorCache");
		var dbCache = {};
		for each(var cacheEntry in dbCacheResults) {
			dbCache[cacheEntry.leafName] = cacheEntry;
		}
		
		var i = 0;
		var filesInCache = {};
		var contents = Zotero.getTranslatorsDirectory().directoryEntries;
		while(contents.hasMoreElements()) {
			var file = contents.getNext().QueryInterface(Components.interfaces.nsIFile);
			var leafName = file.leafName;
			if(!(/^[^.].*\.js$/.test(leafName))) continue;
			var lastModifiedTime = file.lastModifiedTime;
			
			var dbCacheEntry = false;
			if(dbCache[leafName]) {
				filesInCache[leafName] = true;
				if(dbCache[leafName].lastModifiedTime == lastModifiedTime) {
					dbCacheEntry = dbCache[file.leafName];
				}
			}
			
			if(dbCacheEntry) {
				// get JSON from cache if possible
				var translator = Zotero.Translators.load(file, dbCacheEntry.translatorJSON, dbCacheEntry.code);
				filesInCache[leafName] = true;
			} else {
				// otherwise, load from file
				var translator = yield Zotero.Translators.loadFromDisk(file);
			}
			
			if(translator.translatorID) {
				if(_translators[translator.translatorID]) {
					// same translator is already cached
					translator.logError('Translator with ID '+
						translator.translatorID+' already loaded from "'+
						_translators[translator.translatorID].file.leafName+'"');
				} else {
					// add to cache
					_translators[translator.translatorID] = translator;
					for(var type in TRANSLATOR_TYPES) {
						if(translator.translatorType & TRANSLATOR_TYPES[type]) {
							_cache[type].push(translator);
						}
					}
					
					if(!dbCacheEntry) {
						var code = yield translator.getCode();
						yield Zotero.Translators.cacheInDB(
							leafName,
							translator.serialize(TRANSLATOR_REQUIRED_PROPERTIES.
								                 concat(TRANSLATOR_OPTIONAL_PROPERTIES)),
							translator.cacheCode ? translator.code : null,
							lastModifiedTime
						);
						delete translator.metadataString;
					}
				}
			}
			
			i++;
		}
		
		// Remove translators from DB as necessary
		for(var leafName in dbCache) {
			if(!filesInCache[leafName]) {
				yield Zotero.DB.queryAsync(
					"DELETE FROM translatorCache WHERE leafName = ?", [leafName]
				);
			}
		}
		
		// Sort by priority
		var collation = Zotero.getLocaleCollation();
		var cmp = function (a, b) {
			if (a.priority > b.priority) {
				return 1;
			}
			else if (a.priority < b.priority) {
				return -1;
			}
			return collation.compareString(1, a.label, b.label);
		}
		for(var type in _cache) {
			_cache[type].sort(cmp);
		}
		
		Zotero.debug("Cached "+i+" translators in "+((new Date()).getTime() - start)+" ms");
	});
	this.init = Zotero.lazy(this.reinit);

	/**
	 * Loads a translator from JSON, with optional code
	 */
	this.load = function(file, json, code) {
		var info = JSON.parse(json);
		info.file = file;
		info.code = code;
		return new Zotero.Translator(info);
	}

	/**
	 * Loads a translator from the disk
	 */
	this.loadFromDisk = function(file) {
		const infoRe = /^\s*{[\S\s]*?}\s*?[\r\n]/;
		return Zotero.File.getContentsAsync(file).then(function(source) {
			return Zotero.Translators.load(file, infoRe.exec(source)[0], source);
		}).fail(function() {
			throw "Invalid or missing translator metadata JSON object in " + file.leafName;
		});
	}
	
	/**
	 * Gets the translator that corresponds to a given ID
	 * @param {String} id The ID of the translator
	 * @param {Function} [callback] An optional callback to be executed when translators have been
	 *                              retrieved. If no callback is specified, translators are
	 *                              returned.
	 */
	this.get = function(id) {
		return this.init().then(function() {
			return  _translators[id] ? _translators[id] : false
		});
	}
	
	/**
	 * Gets all translators for a specific type of translation
	 * @param {String} type The type of translators to get (import, export, web, or search)
	 * @param {Function} [callback] An optional callback to be executed when translators have been
	 *                              retrieved. If no callback is specified, translators are
	 *                              returned.
	 */
	this.getAllForType = function(type) {
		return this.init().then(function() {
			return _cache[type].slice();
		});
	}
	
	/**
	 * Gets all translators for a specific type of translation
	 */
	this.getAll = function() {
		return this.init().then(function() {
			return [translator for each(translator in _translators)];
		});
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
		return this.getAllForType("web").then(function(allTranslators) {
			var potentialTranslators = [];
			
			var properHosts = [];
			var proxyHosts = [];
			
			var properURI = Zotero.Proxies.proxyToProper(uri);
			var knownProxy = properURI !== uri;
			if(knownProxy) {
				// if we know this proxy, just use the proper URI for detection
				var searchURIs = [properURI];
			} else {
				var searchURIs = [uri];
				
				// if there is a subdomain that is also a TLD, also test against URI with the domain
				// dropped after the TLD
				// (i.e., www.nature.com.mutex.gmu.edu => www.nature.com)
				var m = /^(https?:\/\/)([^\/]+)/i.exec(uri);
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
			}
			
			Zotero.debug("Translators: Looking for translators for "+searchURIs.join(", "));
			
			var converterFunctions = [];
			for(var i=0; i<allTranslators.length; i++) {
				for(var j=0; j<searchURIs.length; j++) {
					if((!allTranslators[i].webRegexp
							&& allTranslators[i].runMode === Zotero.Translator.RUN_MODE_IN_BROWSER)
							|| (uri.length < 8192 && allTranslators[i].webRegexp.test(searchURIs[j]))) {
						// add translator to list
						potentialTranslators.push(allTranslators[i]);
						
						if(j === 0) {
							if(knownProxy) {
								converterFunctions.push(Zotero.Proxies.properToProxy);
							} else {
								converterFunctions.push(null);
							}
						} else {
							converterFunctions.push(new function() {
								var re = new RegExp('^https?://(?:[^/]\\.)?'+Zotero.Utilities.quotemeta(properHosts[j-1]), "gi");
								var proxyHost = proxyHosts[j-1].replace(/\$/g, "$$$$");
								return function(uri) { return uri.replace(re, "$&."+proxyHost) };
							});
						}
						
						// don't add translator more than once
						break;
					}
				}
			}
			
			return [potentialTranslators, converterFunctions];
		});
	}
	
	/**
	 * Gets import translators for a specific location
	 * @param {String} location The location for which to look for translators
	 * @param {Function} [callback] An optional callback to be executed when translators have been
	 *                              retrieved. If no callback is specified, translators are
	 *                              returned.
	 */
	this.getImportTranslatorsForLocation = function(location, callback) {	
		return Zotero.Translators.getAllForType("import").then(function(allTranslators) {
			var tier1Translators = [];
			var tier2Translators = [];
			
			for(var i=0; i<allTranslators.length; i++) {
				if(allTranslators[i].importRegexp && allTranslators[i].importRegexp.test(location)) {
					tier1Translators.push(allTranslators[i]);
				} else {
					tier2Translators.push(allTranslators[i]);
				}
			}
			
			var translators = tier1Translators.concat(tier2Translators);
			if(callback) {
				callback(translators);
				return true;
			}
			return translators;
		});
	}
	
	/**
	 * @param	{String}		label
	 * @return	{String}
	 */
	this.getFileNameFromLabel = function(label, alternative) {
		var fileName = Zotero.Utilities.removeDiacritics(
			Zotero.File.getValidFileName(label)) + ".js";
		// Use translatorID if name still isn't ASCII (e.g., Cyrillic)
		if (alternative && !fileName.match(/^[\x00-\x7f]+$/)) {
			fileName = alternative + ".js";
		}
		return fileName;
	}
	
	/**
	 * @param	{String}		metadata
	 * @param	{String}		metadata.translatorID		Translator GUID
	 * @param	{Integer}		metadata.translatorType		See TRANSLATOR_TYPES in translate.js
	 * @param	{String}		metadata.label				Translator title
	 * @param	{String}		metadata.creator			Translator author
	 * @param	{String|Null}	metadata.target				Target regexp
	 * @param	{String|Null}	metadata.minVersion
	 * @param	{String}		metadata.maxVersion
	 * @param	{String|undefined}	metadata.configOptions
	 * @param	{String|undefined}	metadata.displayOptions
	 * @param	{Integer}		metadata.priority
	 * @param	{String}		metadata.browserSupport
	 * @param	{Boolean}		metadata.inRepository
	 * @param	{String}		metadata.lastUpdated		SQL date
	 * @param	{String}		code
	 * @return	{Promise<nsIFile>}
	 */
	this.save = function(metadata, code) {
		if (!metadata.translatorID) {
			throw ("metadata.translatorID not provided in Zotero.Translators.save()");
		}
		
		if (!metadata.translatorType) {
			var found = false;
			for each(var type in TRANSLATOR_TYPES) {
				if (metadata.translatorType & type) {
					found = true;
					break;
				}
			}
			if (!found) {
				throw ("Invalid translatorType '" + metadata.translatorType + "' in Zotero.Translators.save()");
			}
		}
		
		if (!metadata.label) {
			throw ("metadata.label not provided in Zotero.Translators.save()");
		}
		
		if (!metadata.priority) {
			throw ("metadata.priority not provided in Zotero.Translators.save()");
		}
		
		if (!metadata.lastUpdated) {
			throw ("metadata.lastUpdated not provided in Zotero.Translators.save()");
		}
		
		if (!code) {
			throw ("code not provided in Zotero.Translators.save()");
		}
		
		var fileName = Zotero.Translators.getFileNameFromLabel(
			metadata.label, metadata.translatorID
		);
		var destFile = Zotero.getTranslatorsDirectory();
		destFile.append(fileName);
		
		// JSON.stringify has the benefit of indenting JSON
		var metadataJSON = JSON.stringify(metadata, null, "\t");
		
		var str = metadataJSON + "\n\n" + code,
			translator;
		
		return Zotero.Translators.get(metadata.translatorID)
		.then(function(gTranslator) {
			translator = gTranslator;
			var sameFile = translator && destFile.equals(translator.file);
			if (sameFile) return;
			
			return Q(OS.File.exists(destFile.path))
			.then(function (exists) {
				if (exists) {
					var msg = "Overwriting translator with same filename '"
						+ fileName + "'";
					Zotero.debug(msg, 1);
					Zotero.debug(metadata, 1);
					Components.utils.reportError(msg);
				}
			});
		})
		.then(function () {
			if (!translator) return;
			
			return Q(OS.File.exists(translator.file.path))
			.then(function (exists) {
				translator.file.remove(false);
			});
		})
		.then(function () {
			Zotero.debug("Saving translator '" + metadata.label + "'");
			Zotero.debug(str);
			return Zotero.File.putContentsAsync(destFile, str)
			.thenResolve(destFile);
		});
	}
	
	this.cacheInDB = function(fileName, metadataJSON, code, lastModifiedTime) {
		return Zotero.DB.queryAsync(
			"REPLACE INTO translatorCache VALUES (?, ?, ?, ?)",
			[fileName, metadataJSON, code, lastModifiedTime]
		);
	}
}
