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

"use strict";

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
	 * Initializes translator cache, loading all translator metadata into memory
	 *
	 * @param {Object} [options.metadataCache] - Translator metadata keyed by filename, if already
	 *     available (e.g., in updateBundledFiles()), to avoid unnecesary file reads
	 */
	this.reinit = Zotero.Promise.coroutine(function* (options = {}) {
		Zotero.debug("Initializing translators");
		var start = new Date;
		
		_cache = {"import":[], "export":[], "web":[], "search":[]};
		_translators = {};
		
		var sql = "SELECT fileName, metadataJSON, lastModifiedTime FROM translatorCache";
		var dbCacheResults = yield Zotero.DB.queryAsync(sql);
		var dbCache = {};
		for (let i = 0; i < dbCacheResults.length; i++) {
			let entry = dbCacheResults[i];
			dbCache[entry.fileName] = entry;
		}
		
		var numCached = 0;
		var filesInCache = {};
		var translatorsDir = Zotero.getTranslatorsDirectory().path;
		var iterator = new OS.File.DirectoryIterator(translatorsDir);
		try {
			while (true) {
				let entries = yield iterator.nextBatch(5); // TODO: adjust as necessary
				if (!entries.length) break;
				for (let i = 0; i < entries.length; i++) {
					let entry = entries[i];
					let path = entry.path;
					let fileName = entry.name;
					
					if (!(/^[^.].*\.js$/.test(fileName))) continue;
					
					let lastModifiedTime;
					if ('winLastWriteDate' in entry) {
						lastModifiedTime = entry.winLastWriteDate.getTime();
					}
					else {
						lastModifiedTime = (yield OS.File.stat(path)).lastModificationDate.getTime();
					}
					
					// Check passed cache for metadata
					let memCacheJSON = false;
					if (options.metadataCache && options.metadataCache[fileName]) {
						memCacheJSON = options.metadataCache[fileName];
					}
					
					// Check DB cache
					let dbCacheEntry = false;
					if (dbCache[fileName]) {
						filesInCache[fileName] = true;
						if (dbCache[fileName].lastModifiedTime == lastModifiedTime) {
							dbCacheEntry = dbCache[fileName];
						}
					}
					
					// Get JSON from cache if possible
					if (memCacheJSON || dbCacheEntry) {
						var translator = Zotero.Translators.load(
							memCacheJSON || dbCacheEntry.metadataJSON, path
						);
					}
					// Otherwise, load from file
					else {
						var translator = yield Zotero.Translators.loadFromFile(path);
					}
					
					// When can this happen?
					if (!translator.translatorID) {
						Zotero.debug("Translator ID for " + path + " not found");
						continue;
					}
					
					// Check if there's already a cached translator with the same id
					if (_translators[translator.translatorID]) {
						let existingTranslator = _translators[translator.translatorID];
						// If cached translator is older, delete it
						if (existingTranslator.lastUpdated < translator.lastUpdated) {
							translator.logError("Deleting older translator "
								+ existingTranslator.fileName + " with same ID as "
								+ translator.fileName);
							yield OS.File.remove(existingTranslator.path);
							delete _translators[translator.translatorID];
						}
						// If cached translator is newer or the same, delete the current one
						else {
							translator.logError("Translator " + existingTranslator.fileName
								+ " with same ID is already loaded -- deleting "
								+ translator.fileName);
							yield OS.File.remove(translator.path);
							continue;
						}
					}
					
					// add to cache
					_translators[translator.translatorID] = translator;
					for (let type in TRANSLATOR_TYPES) {
						if (translator.translatorType & TRANSLATOR_TYPES[type]) {
							_cache[type].push(translator);
						}
					}
					
					if (!dbCacheEntry) {
						yield Zotero.Translators.cacheInDB(
							fileName,
							translator.serialize(TRANSLATOR_REQUIRED_PROPERTIES.
												 concat(TRANSLATOR_OPTIONAL_PROPERTIES)),
							lastModifiedTime
						);
					}
					
					numCached++;
				}
			}
		}
		finally {
			iterator.close();
		}
		
		// Remove translators from DB cache if no file
		for (let fileName in dbCache) {
			if (!filesInCache[fileName]) {
				yield Zotero.DB.queryAsync(
					"DELETE FROM translatorCache WHERE fileName = ?", fileName
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
		
		_initialized = true;
		
		Zotero.debug("Cached " + numCached + " translators in " + ((new Date) - start) + " ms");
	});
	this.init = Zotero.lazy(this.reinit);

	/**
	 * Loads a translator from JSON, with optional code
	 *
	 * @param {String|Object} json - Metadata JSON
	 * @param {String} path
	 * @param {String} [code]
	 */
	this.load = function (json, path, code) {
		var info = typeof json == 'string' ? JSON.parse(json) : json;
		info.path = path;
		info.code = code;
		return new Zotero.Translator(info);
	}

	/**
	 * Loads a translator from the disk
	 *
	 * @param {String} file - Path to translator file
	 */
	this.loadFromFile = function(path) {
		const infoRe = /^\s*{[\S\s]*?}\s*?[\r\n]/;
		return Zotero.File.getContentsAsync(path)
		.then(function(source) {
			return Zotero.Translators.load(infoRe.exec(source)[0], path, source);
		})
		.catch(function() {
			throw "Invalid or missing translator metadata JSON object in " + OS.Path.basename(path);
		});
	}
	
	/**
	 * Gets the translator that corresponds to a given ID
	 *
	 * @param {String} id The ID of the translator
	 */
	this.get = function(id) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Translators not yet loaded", 'translators');
		}
		return  _translators[id] ? _translators[id] : false
	}
	
	/**
	 * Gets all translators for a specific type of translation
	 *
	 * @param {String} type The type of translators to get (import, export, web, or search)
	 */
	this.getAllForType = function(type) {
		return this.init().then(function () {
			return _cache[type].slice();
		});
	}
	
	/**
	 * Gets all translators for a specific type of translation
	 */
	this.getAll = function() {
		return this.init().then(function () {
			return Object.keys(_translators);
		});
	}
	
	/**
	 * Gets web translators for a specific location
	 * @param {String} uri The URI for which to look for translators
	 */
	this.getWebTranslatorsForLocation = function(uri) {
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
								var re = new RegExp('^https?://(?:[^/]+\\.)?'+Zotero.Utilities.quotemeta(properHosts[j-1])+'(?=/)', "gi");
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
	this.save = Zotero.Promise.coroutine(function* (metadata, code) {
		if (!metadata.translatorID) {
			throw ("metadata.translatorID not provided in Zotero.Translators.save()");
		}
		
		if (!metadata.translatorType) {
			var found = false;
			for (let type in TRANSLATOR_TYPES) {
				if (metadata.translatorType & TRANSLATOR_TYPES[type]) {
					found = true;
					break;
				}
			}
			if (!found) {
				throw ("Invalid translatorType '" + metadata.translatorType + "' in Zotero.Translators.save()");
			}
		}
		
		if (!metadata.label) {
			throw new Error("metadata.label not provided");
		}
		
		if (!metadata.priority) {
			throw new Error("metadata.priority not provided");
		}
		
		if (!metadata.lastUpdated) {
			throw new Error("metadata.lastUpdated not provided");
		}
		
		if (!code) {
			throw new Error("code not provided");
		}
		
		var fileName = Zotero.Translators.getFileNameFromLabel(
			metadata.label, metadata.translatorID
		);
		var destFile = OS.Path.join(Zotero.getTranslatorsDirectory().path, fileName);
		
		// JSON.stringify has the benefit of indenting JSON
		var metadataJSON = JSON.stringify(metadata, null, "\t");
		
		var str = metadataJSON + "\n\n" + code,
			translator;
		
		var translator = Zotero.Translators.get(metadata.translatorID);
		var sameFile = translator && destFile == translator.path;
		if (sameFile) return;
		
		var exists = yield OS.File.exists(destFile);
		if (exists) {
			var msg = "Overwriting translator with same filename '"
				+ fileName + "'";
			Zotero.debug(msg, 1);
			Zotero.debug(metadata, 1);
			Components.utils.reportError(msg);
		}
		
		Zotero.debug("Saving translator '" + metadata.label + "'");
		Zotero.debug(metadata);
		return Zotero.File.putContentsAsync(destFile, str).return(destFile);
	});
	
	this.cacheInDB = function(fileName, metadataJSON, lastModifiedTime) {
		return Zotero.DB.queryAsync(
			"REPLACE INTO translatorCache VALUES (?, ?, ?)",
			[fileName, JSON.stringify(metadataJSON), lastModifiedTime]
		);
	}
}
