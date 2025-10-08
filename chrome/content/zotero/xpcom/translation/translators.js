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

/**
 * Singleton to handle loading and caching of translators
 * @namespace
 */
Zotero.Translators = new function () {
	var _cache, _translators;
	var _initialized = false;
	var _initializationDeferred = false;
	
	this.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT = 'a45eca67-1ee8-45e5-b4c6-23fb8a852873';
	this.TRANSLATOR_ID_NOTE_MARKDOWN = '1412e9e2-51e1-42ec-aa35-e036a895534b';
	this.TRANSLATOR_ID_NOTE_HTML = '897a81c2-9f60-4bec-ae6b-85a5030b8be5';
	this.TRANSLATOR_ID_RDF = '5e3ad958-ac79-463d-812b-a86a9235c28f';
	
	this._translatorsHash = null;
	this._sortedTranslatorHash = null;
	
	/**
	 * Initializes translator cache, loading all translator metadata into memory
	 *
	 * @param {Object} [options.metadataCache] - Translator metadata keyed by filename, if already
	 *     available (e.g., in updateBundledFiles()), to avoid unnecessary file reads
	 */
	this.init = async function (options = {}) {
		// Wait until bundled files have been updated, except when this is called by the schema update
		// code itself
		if (!options.fromSchemaUpdate) {
			await Zotero.Schema.schemaUpdatePromise;
		}
		
		// If an initialization has already started, a regular init() call should return the promise
		// for that (which may already be resolved). A reinit should yield on that but then continue
		// with reinitialization.
		if (_initializationDeferred) {
			let promise = _initializationDeferred.promise;
			if (options.reinit) {
				await promise;
			}
			else {
				return promise;
			}
		}
		
		_initializationDeferred = Zotero.Promise.defer();
		
		Zotero.debug("Initializing translators");
		var start = new Date;
		
		_cache = {"import":[], "export":[], "web":[], "webWithTargetAll":[], "search":[]};
		_translators = {};
		
		var sql = "SELECT rowid, fileName, metadataJSON, lastModifiedTime FROM translatorCache";
		var dbCacheResults = await Zotero.DB.queryAsync(sql);
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
				let entries = await iterator.nextBatch(5); // TODO: adjust as necessary
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
						lastModifiedTime = ((await OS.File.stat(path))).lastModificationDate.getTime();
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
						try {
							var translator = this.load(
								memCacheJSON || dbCacheEntry.metadataJSON, path
							);
						}
						catch (e) {
							Zotero.logError(e);
							Zotero.debug(memCacheJSON || dbCacheEntry.metadataJSON, 1);
							
							// If JSON is invalid, clear from cache
							await Zotero.DB.queryAsync(
								"DELETE FROM translatorCache WHERE fileName=?",
								fileName
							);
							continue;
						}
					}
					// Otherwise, load from file
					else {
						try {
							var translator = await this.loadFromFile(path);
						}
						catch (e) {
							Zotero.logError(e);
							
							// If translator file is invalid, delete it and clear the cache entry
							// so that the translator is reinstalled the next time it's updated.
							//
							// TODO: Reinstall the correct translator immediately
							await OS.File.remove(path);
							let sql = "DELETE FROM translatorCache WHERE fileName=?";
							await Zotero.DB.queryAsync(sql, fileName);
							continue;
						}
					}
					
					// When can this happen?
					if (!translator.translatorID) {
						Zotero.debug("Translator ID for " + path + " not found");
						continue;
					}
					
					// Check if there's already a cached translator with the same id
					if (_translators[translator.translatorID]) {
						let existingTranslator = _translators[translator.translatorID];
						// If cached translator is older, delete it and install this one
						if (existingTranslator.lastUpdated < translator.lastUpdated) {
							translator.logError("Deleting older translator "
								+ existingTranslator.fileName + " with same ID as "
								+ translator.fileName);
							await OS.File.remove(existingTranslator.path);
							await removeFromCaches(existingTranslator);
						}
						// If cached translator is newer, keep it and discard this one
						else if (existingTranslator.lastUpdated > translator.lastUpdated) {
							translator.logError("Deleting older translator "
								+ translator.fileName + " with same ID as "
								+ existingTranslator.fileName);
							await OS.File.remove(translator.path);
							await removeFromDBCache(translator.fileName);
							continue;
						}
						// If cached translator has the same timestamp and matches the label, keep
						// it and discard this one
						else if (this.getFileNameFromLabel(existingTranslator.label) == existingTranslator.fileName) {
							translator.logError("Translator " + existingTranslator.fileName
								+ " with same ID is already loaded and matches label -- deleting "
								+ translator.fileName);
							await OS.File.remove(translator.path);
							await removeFromDBCache(translator.fileName);
							continue;
						}
						// Otherwise delete the cached one and install this one
						else {
							translator.logError("Deleting translator " + translator.fileName
								+ " with same ID as " + existingTranslator.fileName + " but with "
								+ "mismatched filename");
							await OS.File.remove(existingTranslator.path);
							await removeFromCaches(existingTranslator);
						}
					}
					
					// add to cache
					_translators[translator.translatorID] = translator;
					for (let type in Zotero.Translator.TRANSLATOR_TYPES) {
						if (translator.translatorType & Zotero.Translator.TRANSLATOR_TYPES[type]) {
							_cache[type].push(translator);
						}
					}
					if ((translator.translatorType & Zotero.Translator.TRANSLATOR_TYPES.web)
							&& translator.targetAll) {
						_cache.webWithTargetAll.push(translator);
					}
					
					if (!dbCacheEntry) {
						await this.cacheInDB(
							fileName,
							translator.serialize(Zotero.Translator.TRANSLATOR_REQUIRED_PROPERTIES.
												 concat(Zotero.Translator.TRANSLATOR_OPTIONAL_PROPERTIES)),
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
				await Zotero.DB.queryAsync(
					"DELETE FROM translatorCache WHERE rowid=?",
					dbCache[fileName].rowid
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
		
		_initializationDeferred.resolve();
		_initialized = true;
		
		Zotero.debug("Cached " + numCached + " translators in " + ((new Date) - start) + " ms");
	};
	
	
	this.reinit = async function (options = {}) {
		await this.init(Object.assign({}, options, { reinit: true }));
		this._translatorsHash = null;
		this._sortedTranslatorHash = null;
		Zotero.QuickCopy.init();
	};
	
	
	async function removeFromCaches({ translatorID, translatorType, targetAll, fileName }) {
		await removeFromDBCache(fileName);
		
		delete _translators[translatorID];
		
		for (let typeName in Zotero.Translator.TRANSLATOR_TYPES) {
			if (translatorType & Zotero.Translator.TRANSLATOR_TYPES[typeName]) {
				let pos = _cache[typeName].findIndex(x => x.translatorID == translatorID);
				if (pos != -1) {
					_cache[typeName].splice(pos, 1);
				}
			}
		}
		if ((translatorType & Zotero.Translator.TRANSLATOR_TYPES.web) && targetAll) {
			let pos = _cache.webWithTargetAll.findIndex(x => x.translatorID == translatorID);
			if (pos != -1) {
				_cache.webWithTargetAll.splice(pos, 1);
			}
		}
	}
	
	
	async function removeFromDBCache(fileName) {
		await Zotero.DB.queryAsync("DELETE FROM translatorCache WHERE fileName=?", fileName);
	}
	
	
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
	this.loadFromFile = async function (path) {
		const infoRe = /^\s*{[\S\s]*?}\s*?[\r\n]/;
		try {
			let source = await Zotero.File.getContentsAsync(path);
			return this.load(infoRe.exec(source)[0], path, source);
		}
		catch (e) {
			throw new Error("Invalid or missing translator metadata JSON object in " + PathUtils.filename(path));
		}
	}

	/**
	 * Gets a hash of all translators (to check whether Connector needs an update)
	 */
	this.getTranslatorsHash = async function (sorted) {
		let prop = sorted ? "_sortedTranslatorHash" : "_translatorsHash";
		if (this[prop]) return this[prop];
		await this.init();
		let translators = await this.getAll();
		if (sorted) {
			translators.sort((a, b) => a.translatorID.localeCompare(b.translatorID));
		}
		let hashString = "";
		for (let translator of translators) {
			hashString += `${translator.translatorID}:${translator.lastUpdated},`;
		}
		this[prop] = Zotero.Utilities.Internal.md5(hashString);
		return this[prop];
	};
	
	/**
	 * Gets the translator that corresponds to a given ID
	 *
	 * @param {String} id The ID of the translator
	 */
	this.get = function (id) {
		if (!_initialized) {
			throw new Zotero.Exception.UnloadedDataException("Translators not yet loaded", 'translators');
		}
		return _translators[id] ? _translators[id] : false;
	}
	
	this.getCodeForTranslator = Zotero.Promise.method(function (translator) {
		if (translator.code) return translator.code;
		return Zotero.File.getContentsAsync(translator.path).then(function (code) {
			if (translator.cacheCode) {
				// See Translator.init() for cache rules
				translator.code = code;
			}
			return code;
		});
	});
	
	/**
	 * Gets all translators for a specific type of translation
	 *
	 * @param {String} type The type of translators to get (import, export, web, or search)
	 */
	this.getAllForType = async function (type) {
		await this.init();
		return _cache[type].slice();
	}
	
	/**
	 * Gets all translators for a specific type of translation
	 */
	this.getAll = async function () {
		await this.init();
		return Object.keys(_translators).map(id => _translators[id]);
	}
	
	/**
	 * Gets web translators for a specific location
	 * @param {String} uri The URI for which to look for translators
	 * @param {String} rootUri The root URI of the page, different from `uri` if running in an iframe
	 */
	this.getWebTranslatorsForLocation = function (URI, rootURI) {
		var isFrame = URI !== rootURI;
		var type = isFrame ? "webWithTargetAll" : "web";
		
		return this.getAllForType(type).then(function (allTranslators) {
			var potentialTranslators = [];
			var proxies = [];
			
			var rootSearchURIs = Zotero.Proxies.getPotentialProxies(rootURI);
			var frameSearchURIs = isFrame ? Zotero.Proxies.getPotentialProxies(URI) : rootSearchURIs;
			
			Zotero.debug("Translators: Looking for translators for "+Object.keys(frameSearchURIs).join(', '));
			
			for (let translator of allTranslators) {
				rootURIsLoop:
				for (let rootSearchURI in rootSearchURIs) {
					let isGeneric = !translator.webRegexp.root;
					
					let rootURIMatches = isGeneric || rootSearchURI.length < 8192 && translator.webRegexp.root.test(rootSearchURI);
					if (translator.webRegexp.all && rootURIMatches) {
						for (let frameSearchURI in frameSearchURIs) {
							let frameURIMatches = frameSearchURI.length < 8192 && translator.webRegexp.all.test(frameSearchURI);
								
							if (frameURIMatches) {
								potentialTranslators.push(translator);
								proxies.push(frameSearchURIs[frameSearchURI]);
								// prevent adding the translator multiple times
								break rootURIsLoop;
							}
						}
					}
					else if(!isFrame && (isGeneric || rootURIMatches)) {
						potentialTranslators.push(translator);
						proxies.push(rootSearchURIs[rootSearchURI]);
						break;
					}
				}
			}
			
			return [potentialTranslators, proxies];
		}.bind(this));
	},

	/**
	 * Get the array of searchURIs and related proxy converter functions
	 * 
	 * @param {String} URI to get searchURIs and converterFunctions for
	 */
	this.getSearchURIs = function (URI) {
		var properURI = Zotero.Proxies.proxyToProper(URI);
		if (properURI !== URI) {
			// if we know this proxy, just use the proper URI for detection
			let obj = {};
			obj[properURI] = Zotero.Proxies.properToProxy;
			return obj;
		}
			
		var searchURIs = {};
		searchURIs[URI] = null;
		
		// if there is a subdomain that is also a TLD, also test against URI with the domain
		// dropped after the TLD
		// (i.e., www.nature.com.mutex.gmu.edu => www.nature.com)
		var m = /^(https?:\/\/)([^\/]+)/i.exec(URI);
		if (m) {
			// First, drop the 0- if it exists (this is an III invention)
			var host = m[2];
			if(host.substr(0, 2) === "0-") host = host.substr(2);
			var hostnames = host.split(".");
			for (var i=1; i<hostnames.length-2; i++) {
				if (TLDS[hostnames[i].toLowerCase()]) {
					var properHost = hostnames.slice(0, i+1).join(".");
					searchURIs[m[1]+properHost+URI.substr(m[0].length)] = new function () {
						var re = new RegExp('^https?://(?:[^/]+\\.)?'+Zotero.Utilities.quotemeta(properHost)+'(?=/)', "gi");
						var proxyHost = hostnames.slice(i+1).join(".").replace(/\$/g, "$$$$");
						return function (uri) { return uri.replace(re, "$&."+proxyHost) };
					};
				}
			}
		}
		return searchURIs;
	},
	
	/**
	 * Gets import translators for a specific location
	 * @param {String} location The location for which to look for translators
	 * @param {Function} [callback] An optional callback to be executed when translators have been
	 *                              retrieved
	 * @return {Promise<Zotero.Translator[]|true>} - An array of translators if no callback is specified;
	 *     otherwise true
	 */
	this.getImportTranslatorsForLocation = function (location, callback) {	
		return this.getAllForType("import").then(function (allTranslators) {
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
	this.getFileNameFromLabel = function (label, alternative) {
		var fileName = Zotero.Utilities.removeDiacritics(
			Zotero.File.getValidFileName(label)) + ".js";
		// Use translatorID if name still isn't ASCII (e.g., Cyrillic)
		if (alternative && !fileName.match(/^[\x00-\x7f]+$/)) {
			fileName = alternative + ".js";
		}
		return fileName;
	};

	/**
	 * @param {Object} metadata
	 * @return {String}
	 */
	this.getSavePath = function (metadata) {
		return PathUtils.join(
			this.getTranslatorsDirectory(),
			this.getFileNameFromLabel(metadata.label, metadata.translatorID)
		);
	};
	
	this.getTranslatorsDirectory = function () {
		return Zotero.getTranslatorsDirectory().path;
	};
	
	/**
	 * @param	{Object}		metadata
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
	 * @return	{String}
	 */
	this.stringify = function (metadata, code) {
		if (!metadata.translatorID) {
			throw new Error("metadata.translatorID not provided in Zotero.Translators.save()");
		}
		
		if (!metadata.translatorType) {
			var found = false;
			// FIXME: This seems to be a no-op
			for (let type in TRANSLATOR_TYPES) {
				if (metadata.translatorType & TRANSLATOR_TYPES[type]) {
					found = true;
					break;
				}
			}
			if (!found) {
				throw new Error("Invalid translatorType '" + metadata.translatorType + "' in Zotero.Translators.save()");
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
		
		// JSON.stringify has the benefit of indenting JSON
		var metadataJSON = JSON.stringify(metadata, null, "\t");
		
		var str = metadataJSON + "\n\n" + code;
		
		// Make sure file ends with newline
		if (!str.endsWith('\n')) {
			str += '\n';
		}
		
		return str;
	};
	
	/**
	 * @param	{Object}		metadata
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
	 * @return	{Promise<String>}
	 */
	this.save = async function (metadata, code) {
		var str = this.stringify(metadata, code);
		var destFile = this.getSavePath(metadata);
		
		var existingTranslator = this.get(metadata.translatorID);
		var sameFile = existingTranslator && destFile == existingTranslator.path;
		
		var exists = await OS.File.exists(destFile);
		if (!sameFile && exists) {
			var msg = `Overwriting translator with same filename '${PathUtils.filename(destFile)}'`;
			Zotero.debug(msg, 1);
			Zotero.debug(metadata, 1);
			Components.utils.reportError(msg);
		}
		
		Zotero.debug("Saving translator '" + metadata.label + "'");
		Zotero.debug(metadata);
		return Zotero.File.putContentsAsync(destFile, str).then(() => destFile);
	};
	
	this.cacheInDB = function (fileName, metadataJSON, lastModifiedTime) {
		return Zotero.DB.queryAsync(
			"REPLACE INTO translatorCache VALUES (?, ?, ?)",
			[fileName, JSON.stringify(metadataJSON), lastModifiedTime]
		);
	};
	
	this.makeTranslatorProvider = function (methods) {
		var requiredMethods = [
			'get',
			'getAllForType'
		];
		for (let method of requiredMethods) {
			if (!(method in methods)) {
				throw new Error(`Translator provider method ${method} not provided`);
			}
		}
		return Object.assign(
			{},
			this,
			methods
		);
	}
}
