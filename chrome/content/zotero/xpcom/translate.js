/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

// Enumeration of types of translators
const TRANSLATOR_TYPES = {"import":1, "export":2, "web":4, "search":8};

// Byte order marks for various character sets
const BOMs = {
	"UTF-8":"\xEF\xBB\xBF",
	"UTF-16BE":"\xFE\xFF",
	"UTF-16LE":"\xFF\xFE",
	"UTF-32BE":"\x00\x00\xFE\xFF",
	"UTF-32LE":"\xFF\xFE\x00\x00"
}

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
	this.init = function() {
		_initialized = true;
		
		var start = (new Date()).getTime()
		
		_cache = {"import":[], "export":[], "web":[], "search":[]};
		_translators = {};
		
		var i = 0;
		var contents = Zotero.getTranslatorsDirectory().directoryEntries;
		while(contents.hasMoreElements()) {
			var file = contents.getNext().QueryInterface(Components.interfaces.nsIFile);
			if(!file.leafName || file.leafName[0] == ".") continue;
			
			var translator = new Zotero.Translator(file);
			
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
				}
			}
			i++;
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
		for (var type in _cache) {
			_cache[type].sort(cmp);
		}
		
		Zotero.debug("Cached "+i+" translators in "+((new Date()).getTime() - start)+" ms");
	}
	
	/**
	 * Gets the translator that corresponds to a given ID
	 */
	this.get = function(id) {
		if(!_initialized) this.init();
		return _translators[id] ? _translators[id] : false;
	}
	
	/**
	 * Gets all translators for a specific type of translation
	 */
	this.getAllForType = function(type) {
		if(!_initialized) this.init();
		return _cache[type].slice(0);
	}
	
	
	/**
	 * @param	{String}		label
	 * @return	{String}
	 */
	this.getFileNameFromLabel = function(label) {
		return Zotero.File.getValidFileName(label) + ".js";
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
	 * @param	{Integer}		metadata.priority
	 * @param	{Boolean}		metadata.inRepository
	 * @param	{String}		metadata.lastUpdated		SQL date
	 * @param	{String}		code
	 * @return	{nsIFile}
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
		
		var fileName = Zotero.Translators.getFileNameFromLabel(metadata.label);
		var destFile = Zotero.getTranslatorsDirectory();
		destFile.append(fileName);
		
		var nsIJSON = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
		var metadataJSON = nsIJSON.encode(metadata);
		
		var str = metadataJSON + "\n\n" + code;
		
		var translator = Zotero.Translators.get(metadata.translatorID);
		if (translator && destFile.equals(translator.file)) {
			var sameFile = true;
		}
		
		if (!sameFile && destFile.exists()) {
			var msg = "Overwriting translator with same filename '"
				+ fileName + "'";
			Zotero.debug(msg, 1);
			Zotero.debug(metadata, 1);
			Components.utils.reportError(msg + " in Zotero.Translators.save()");
		}
		
		if (translator && translator.file.exists()) {
			translator.file.remove(false);
		}
		
		Zotero.debug("Saving translator '" + metadata.label + "'");
		Zotero.debug(str);
		Zotero.File.putContents(destFile, str);
		
		return destFile;
	}
}

/**
 * @class Represents an individual translator
 * @constructor
 * @param {nsIFile} file File from which to generate a translator object
 * @property {String} translatorID Unique GUID of the translator
 * @property {Integer} translatorType Type of the translator (use bitwise & with TRANSLATOR_TYPES to read)
 * @property {String} label Human-readable name of the translator
 * @property {String} creator Author(s) of the translator
 * @property {String} target Location that the translator processes
 * @property {String} minVersion Minimum Zotero version
 * @property {String} maxVersion Minimum Zotero version
 * @property {Integer} priority Lower-priority translators will be selected first
 * @property {Boolean} inRepository Whether the translator may be found in the repository
 * @property {String} lastUpdated SQL-style date and time of translator's last update
 * @property {String} code The executable JavaScript for the translator
 */
Zotero.Translator = function(file) {
	// Maximum length for the info JSON in a translator
	const MAX_INFO_LENGTH = 4096;
	const infoRe = /{(?:(?:"(?:[^"\r\n]*(?:\\")?)*")*[^}"]*)*}/;
	
	this.file = file;
	
	var fStream = Components.classes["@mozilla.org/network/file-input-stream;1"].
		createInstance(Components.interfaces.nsIFileInputStream);
	var cStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].
		createInstance(Components.interfaces.nsIConverterInputStream);
	fStream.init(file, -1, -1, 0);
	cStream.init(fStream, "UTF-8", 8192,
		Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
	
	var str = {};
	cStream.readString(MAX_INFO_LENGTH, str);
	
	// We assume lastUpdated is at the end to avoid running the regexp on more than necessary
	var lastUpdatedIndex = str.value.indexOf('"lastUpdated"');
	if (lastUpdatedIndex == -1) {
		this.logError("Invalid or missing translator metadata JSON object");
		fStream.close();
		return;
	}
	
	// Add 50 characters to clear lastUpdated timestamp and final "}"
	var header = str.value.substr(0, lastUpdatedIndex + 50);
	var m = infoRe.exec(header);
	if (!m) {
		this.logError("Invalid or missing translator metadata JSON object");
		fStream.close();
		return;
	}
	
	try {
		var info = Zotero.JSON.unserialize(m[0]);
	} catch(e) {
		this.logError("Invalid or missing translator metadata JSON object");
		fStream.close();
		return;
	}
	
	var haveMetadata = true;
	// make sure we have all the properties
	for each(var property in ["translatorID", "translatorType", "label", "creator", "target", "minVersion", "maxVersion", "priority", "lastUpdated", "inRepository"]) {
		if(info[property] === undefined) {
			this.logError('Missing property "'+property+'" in translator metadata JSON object');
			haveMetadata = false;
			break;
		} else {
			this[property] = info[property];
		}
	}
	if(!haveMetadata) {
		fStream.close();
		return;
	}
	
	if(this.translatorType & TRANSLATOR_TYPES["import"]) {
		// compile import regexp to match only file extension
		this.importRegexp = this.target ? new RegExp("\\."+this.target+"$", "i") : null;
	}
	if(this.translatorType & TRANSLATOR_TYPES["web"]) {
		// compile web regexp
		this.webRegexp = this.target ? new RegExp(this.target, "i") : null;
		
		if(!this.target) {
			// for translators used on every page, cache code in memory
			var strs = [str.value];
			var amountRead;
			while(amountRead = cStream.readString(8192, str)) strs.push(str.value);
			this._code = strs.join("");

		}
	}
	
	fStream.close();
}


Zotero.Translator.prototype.__defineGetter__("code",
/**
 * Getter for "code" property
 * @return {String} Code of translator
 * @inner
 */
function() {
	if(this._code) return this._code;
	return Zotero.File.getContents(this.file);
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
	var ios = Components.classes["@mozilla.org/network/io-service;1"].
		getService(Components.interfaces.nsIIOService);
	Zotero.log(message, type ? type : "error", ios.newFileURI(this.file).spec);
}


/*
 * Zotero.Translate: a class for translation of Zotero metadata from and to
 * other formats
 *
 * type can be: 
 * export
 * import
 * web
 * search
 *
 * a typical export process:
 * var translatorObj = new Zotero.Translate();
 * var possibleTranslators = translatorObj.getTranslators();
 * // do something involving nsIFilePicker; remember, each possibleTranslator
 * // object has properties translatorID, label, and targetID
 * translatorObj.setLocation(myNsILocalFile);
 * translatorObj.setTranslator(possibleTranslators[x]); // also accepts only an ID
 * translatorObj.setHandler("done", _translationDone);
 * translatorObj.translate();
 *
 *
 * PUBLIC PROPERTIES:
 *
 * type - the text type of translator (set by constructor, should be read only)
 * document - the document object to be used for web scraping (read-only; set
 *           with setDocument)
 * translator - the translator currently in use (read-only; set with
 *               setTranslator)
 * location - the location of the target (read-only; set with setLocation)
 *            for import/export - this is an instance of nsILocalFile
 *            for web - this is a URL
 * search - item (in toArray() format) to extrapolate data for (read-only; set
 *          with setSearch).
 * items - items (in Zotero.Item format) to be exported. if this is empty,
 *         Zotero will export all items in the library (read-only; set with
 *         setItems). setting items disables export of collections.
 * path - the path to the target; for web, this is the same as location
 * string - the string content to be used as a file.
 * libraryID - libraryID (e.g., of a group) of saved database items. null for local items,
 *           or false not to save. defaults to null; set using second argument of constructor.
 * newItems - items created when translate() was called
 * newCollections - collections created when translate() was called
 *
 * PSEUDO-PRIVATE PROPERTIES (used only by other objects in this file):
 *
 * waitForCompletion - whether to wait for asynchronous completion, or return
 *                     immediately when script has finished executing
 * configOptions - options set by translator modifying behavior of
 *                  Zotero.Translate
 * displayOptions - options available to user for this specific translator
 *
 * PRIVATE PROPERTIES:
 * 
 * _charset - character set
 * _numericTypes - possible numeric types as a comma-delimited string
 * _handlers - handlers for various events (see setHandler)
 * _sandbox - sandbox in which translators will be executed
 * _streams - streams that need to be closed when execution is complete
 * _IDMap - a map from IDs as specified in Zotero.Item() to IDs of actual items
 * _parentTranslator - set when a translator is called from another translator. 
 *                     among other things, disables passing of the translate
 *                     object to handlers and modifies complete() function on 
 *                     returned items
 * _storage - the stored string to be treated as input
 * _storageLength - the length of the stored string
 * _exportFileDirectory - the directory to which files will be exported
 *
 * WEB-ONLY PROPERTIES:
 *
 * locationIsProxied - whether the URL being scraped is going through
 *                      an EZProxy
 * _downloadAssociatedFiles - whether to download content, according to
 *                            preferences
 *
 * EXPORT-ONLY PROPERTIES:
 *
 * output - export output (if no location has been specified)
 */
Zotero.Translate = function(type) {
	if (arguments.length > 1) {
		throw ("Zotero.Translate only takes one parameter");
	}
	
	this.type = type;
	
	// import = 0001 = 1
	// export = 0010 = 2
	// web    = 0100 = 4
	// search = 1000 = 8
	
	// combination types determined by addition or bitwise AND
	// i.e., import+export = 1+2 = 3
	this._numericTypes = "";
	for(var i=0; i<=1; i++) {
		for(var j=0; j<=1; j++) {
			for(var k=0; k<=1; k++) {
				if(type == "import") {
					this._numericTypes += ","+parseInt(i.toString()+j.toString()+k.toString()+"1", 2);
				} else if(type == "export") {
					this._numericTypes += ","+parseInt(i.toString()+j.toString()+"1"+k.toString(), 2);
				} else if(type == "web") {
					this._numericTypes += ","+parseInt(i.toString()+"1"+j.toString()+k.toString(), 2);
				} else if(type == "search") {
					this._numericTypes += ","+parseInt("1"+i.toString()+j.toString()+k.toString(), 2);
				} else {
					throw("invalid import type");
				}
			}
		}
	}
	this._numericTypes = this._numericTypes.substr(1);
	
	this._handlers = new Array();
	this._streams = new Array();
}

/*
 * sets the browser to be used for web translation; also sets the location
 */
Zotero.Translate.prototype.setDocument = function(doc) {
	this.document = doc;
	this.setLocation(doc.location.href);
}

/*
 * sets the item to be used for searching
 */
Zotero.Translate.prototype.setSearch = function(search) {
	this.search = search;
}

/*
 * sets the items to be used for export
 */
Zotero.Translate.prototype.setItems = function(items) {
	this.items = items;
}

/*
 * sets the collection to be used for export (overrides setItems)
 */
Zotero.Translate.prototype.setCollection = function(collection) {
	this.collection = collection;
}

/*
 * sets the location to operate upon (file should be an nsILocalFile object or
 * web address)
 */
Zotero.Translate.prototype.setLocation = function(location) {
	if(this.type == "web") {
		// account for proxies
		this.location = Zotero.Proxies.proxyToProper(location);
		if(this.location != location) {
			// figure out if this URL is being proxies
			this.locationIsProxied = true;
		}
		this.path = this.location;
	} else {
		this.location = location;
		if(this.location instanceof Components.interfaces.nsIFile) {	// if a file
			this.path = location.path;
		} else {														// if a url
			this.path = location;
		}
	}
}

/*
 * sets the string to be used as a file
 */
Zotero.Translate.prototype.setString = function(string) {
	this._storage = string;
	this._storageLength = string.length;
	this._storagePointer = 0;
}

/*
 * sets translator display options. you can also pass a translator (not ID) to
 * setTranslator that includes a displayOptions argument
 */
Zotero.Translate.prototype.setDisplayOptions = function(displayOptions) {
	this._setDisplayOptions = displayOptions;
}

/*
 * sets the translator to be used for import/export
 *
 * accepts either the object from getTranslators() or an ID
 */
Zotero.Translate.prototype.setTranslator = function(translator) {
	if(!translator) {
		throw("cannot set translator: invalid value");
	}
	
	this.translator = null;
	this._setDisplayOptions = null;
	
	if(typeof(translator) == "object") {	// passed an object and not an ID
		if(translator.translatorID) {
			if(translator.displayOptions) {
				this._setDisplayOptions = translator.displayOptions;
			}
			
			this.translator = [translator];
		} else {
			// we have an array of translators
			if(this.type != "search") {
				throw("cannot set translator: a single translator must be specified when doing "+this.type+" translation");
			}
			
			// accept a list of objects
			this.translator = [];
			for(var i in translator) {
				if(typeof(translator[i]) == "object") {
					this.translator.push(translator[i]);
				} else {
					this.translator.push(Zotero.Translators.get(translator[i]));
				}
			}
		}
	} else {
		this.translator = [Zotero.Translators.get(translator)];
	}
	
	return !!this.translator;
}

/*
 * registers a handler function to be called when translation is complete
 * 
 * as the first argument, all handlers will be passed the current function. the
 * second argument is dependent on the handler.
 *
 * select
 *   valid: web
 *   called: when the user needs to select from a list of available items
 *   passed: an associative array in the form id => text
 *   returns: a numerically indexed array of ids, as extracted from the passed
 *            string
 *
 * itemDone
 *   valid: import, web, search
 *   called: when an item has been processed; may be called asynchronously
 *   passed: an item object (see Zotero.Item)
 *   returns: N/A
 *
 * collectionDone
 *   valid: import
 *   called: when a collection has been processed, after all items have been
 *           added; may be called asynchronously
 *   passed: a collection object (see Zotero.Collection)
 *   returns: N/A
 * 
 * done
 *   valid: all
 *   called: when all processing is finished
 *   passed: true if successful, false if an error occurred
 *   returns: N/A
 *
 * debug
 *   valid: all
 *   called: when Zotero.debug() is called
 *   passed: string debug message
 *   returns: true if message should be logged to the console, false if not
 *
 * error
 *   valid: all
 *   called: when a fatal error occurs
 *   passed: error object (or string)
 *   returns: N/A
 *
 * translators
 *   valid: all
 *   called: when a translator search initiated with Zotero.getTranslators() is
 *           complete
 *   passed: an array of appropriate translators
 *   returns: N/A
 */
Zotero.Translate.prototype.setHandler = function(type, handler) {
	if(!this._handlers[type]) {
		this._handlers[type] = new Array();
	}
	this._handlers[type].push(handler);
}

/*
 * clears all handlers for a given function
 */
Zotero.Translate.prototype.clearHandlers = function(type) {
	this._handlers[type] = new Array();
}

/*
 * calls a handler (see setHandler above)
 */
Zotero.Translate.prototype.runHandler = function(type, argument) {
	var returnValue = undefined;
	if(this._handlers[type]) {
		for(var i in this._handlers[type]) {
			Zotero.debug("Translate: running handler "+i+" for "+type, 5);
			try {
				if(this._parentTranslator) {
					returnValue = this._handlers[type][i](null, argument);
				} else {
					returnValue = this._handlers[type][i](this, argument);
				}
			} catch(e) {
				if(this._parentTranslator) {
					// throw handler errors if they occur when a translator is
					// called from another translator, so that the
					// "Could Not Translate" dialog will appear if necessary
					throw(e);
				} else {
					// otherwise, fail silently, so as not to interfere with
					// interface cleanup
					Zotero.debug("Translate: "+e+' in handler '+i+' for '+type, 5);
				}
			}
		}
	}
	return returnValue;
}

/*
 * gets all applicable translators
 *
 * for import, you should call this after setLocation; otherwise, you'll just get
 * a list of all import filters, not filters equipped to handle a specific file
 *
 * this returns a list of translator objects, of which the following fields
 * are useful:
 *
 * translatorID - the GUID of the translator
 * label - the name of the translator
 * itemType - the type of item this scraper says it will scrape
 */
Zotero.Translate.prototype.getTranslators = function() {
	// do not allow simultaneous instances of getTranslators
	if(this._translatorSearch) this._translatorSearch.running = false;
	
	var translators = Zotero.Translators.getAllForType(this.type);
	
	// create a new sandbox
	this._generateSandbox();
	this._setSandboxMode("detect");
	
	var possibleTranslators = new Array();
	Zotero.debug("Translate: Searching for translators for "+(this.path ? this.path : "an undisclosed location"), 3);
	
	// see which translators can translate
	this._translatorSearch = new Zotero.Translate.TranslatorSearch(this, translators);
	
	// erroring should call complete
	this.error = function(value, error) { this._translatorSearch.complete(value, error) };
	
	// return translators if asynchronous
	if(!this._translatorSearch.asyncMode) return this._translatorSearch.foundTranslators;
}

/*
 * loads a translator into a sandbox
 */
Zotero.Translate.prototype._loadTranslator = function() {
	if(!this._sandbox || this.type == "search") {
		// create a new sandbox if none exists, or for searching (so that it's
		// bound to the correct url)
		this._generateSandbox();
	}
	this._setSandboxMode("translate");
	
	// parse detect code for the translator
	if(!this._parseCode(this.translator[0])) {
		this._translationComplete(false, "parse error");
		return false;
	}
	
	return true;
}

/**
 * does the actual translation
 *
 * @param 	{NULL|Integer|FALSE}	[libraryID=null]		Library in which to save items,
 *																or NULL for default library;
 *																if FALSE, don't save items
 * @param 	{Boolean}				[saveAttachments=true]	Exclude attachments (e.g., snapshots) on import
 */
Zotero.Translate.prototype.translate = function(libraryID, saveAttachments) {
	/*
	 * initialize properties
	 */
	this.newItems = new Array();
	this.newCollections = new Array();
	this._IDMap = new Array();
	this._complete = false;
	this._itemsDone = false;
	
	if(!this.translator || !this.translator.length) {
		throw("cannot translate: no translator specified");
	}
	
	if(!this.location && this.type != "search" && this.type != "export" && !this._storage) {
		// searches operate differently, because we could have an array of
		// translators and have to go through each
		throw("cannot translate: no location specified");
	}
	
	if(libraryID === false) {
		this.libraryID = false;
	}
	else if(libraryID === true || libraryID == undefined) {
		this.libraryID = null;
	}
	else {
		this.libraryID = libraryID;
	}
	this.saveAttachments = !(saveAttachments === false);
	this.saveFiles = this.saveAttachments;
	
	// If group filesEditable==false, don't save attachments
	if (typeof this.libraryID == 'number') {
		var type = Zotero.Libraries.getType(this.libraryID);
		switch (type) {
			case 'group':
				var groupID = Zotero.Groups.getGroupIDFromLibraryID(this.libraryID);
				var group = Zotero.Groups.get(groupID);
				if (!group.filesEditable) {
					this.saveFiles = false;
				}
				break;
		}
	}
	
	// erroring should end
	this.error = this._translationComplete;
	
	if(!this._loadTranslator()) {
		return;
	}
	
	if(this._setDisplayOptions) {
		this.displayOptions = this._setDisplayOptions;
	}
	
	if(this._storage) {
		// enable reading from storage, which we can't do until the translator
		// is loaded
		this._storageFunctions(true);
	}
	
	var returnValue;
	if(this.type == "web") {
		returnValue = this._web();
	} else if(this.type == "import") {
		returnValue = this._import();
	} else if(this.type == "export") {
		returnValue = this._export();
	} else if(this.type == "search") {
		returnValue = this._search();
	}
	
	if(returnValue && !this.waitForCompletion) {
		// if synchronous, call _translationComplete();
		this._translationComplete(true);
	}
}

/*
 * parses translator detect code
 */
Zotero.Translate.prototype._parseCode = function(translator) {
	this.configOptions = {};
	this.displayOptions = {};
	
	Zotero.debug("Translate: Parsing code for "+translator.label, 4);
	
	try {
		Components.utils.evalInSandbox("var translatorInfo = "+translator.code, this._sandbox);
		return true;
	} catch(e) {
		translator.logError(e.toString());
		this._debug(e+' in parsing code for '+translator.label, 3);
		return false;
	}
}

/*
 * generates a sandbox for scraping/scraper detection
 */
Zotero.Translate.prototype._generateSandbox = function() {
	var me = this;
	
	// get sandbox URL
	var sandboxLocation = "http://www.example.com/";
	if(this.type == "web") {
		// use real URL, not proxied version, to create sandbox
		sandboxLocation = this.document.defaultView;
		Zotero.debug("Translate: Binding sandbox to "+this.document.location.href, 4);
	} else {
		if (this.type == "search") {
			// generate sandbox for search by extracting domain from translator target
			if(this.translator && this.translator[0] && this.translator[0].target) {
				// so that web translators work too
				const searchSandboxRe = /^http:\/\/[\w.]+\//;
				var tempURL = this.translator[0].target.replace(/\\/g, "").replace(/\^/g, "");
				var m = searchSandboxRe.exec(tempURL);
				if(m) sandboxLocation = m[0];
			}
		}
		Zotero.debug("Translate: Binding sandbox to "+sandboxLocation, 4);
	}
	
	// set up sandbox
	this._sandbox = new Components.utils.Sandbox(sandboxLocation);
	this._sandbox.Zotero = new Object();
	
	// add utilities
	this._sandbox.Zotero.Utilities = new Zotero.Utilities.Translate(this);
	this._sandbox.Zotero.Utilities.HTTP = this._sandbox.Zotero.Utilities;
	
	if(this.type == "export") {
		// add routines to retrieve items and collections
		this._sandbox.Zotero.nextItem = function() { return me._exportGetItem() };
		this._sandbox.Zotero.nextCollection = function() { return me._exportGetCollection() }
	} else {
		// copy routines to add new items
		this._sandbox.Zotero.Item = Zotero.Translate.GenerateZoteroItemClass();
		this._sandbox.Zotero.Item.prototype.complete = function() {me._itemDone(this)};
		
		if(this.type == "import") {
			// add routines to add new collections
			this._sandbox.Zotero.Collection = Zotero.Translate.GenerateZoteroCollectionClass();
			// attach the function to be run when a collection is done
			this._sandbox.Zotero.Collection.prototype.complete = function() {me._collectionDone(this)};
		} else if(this.type == "web" || this.type == "search") {	
			// set up selectItems handler
			this._sandbox.Zotero.selectItems = function(options) { return me._selectItems(options) };
		}
	}
	
	this._sandbox.XPathResult = Components.interfaces.nsIDOMXPathResult;
	
	// for debug messages
	this._sandbox.Zotero.debug = function(string) {me._debug(string, 4)};
	
	// for adding configuration options
	this._sandbox.Zotero.configure = function(option, value) {me._configure(option, value) };
	// for adding displayed options
	this._sandbox.Zotero.addOption = function(option, value) {me._addOption(option, value) };
	// for getting the value of displayed options
	this._sandbox.Zotero.getOption = function(option) { return me._getOption(option) };

	// for loading other translators and accessing their methods
	this._sandbox.Zotero.loadTranslator = function(type) {
		var translation = new Zotero.Translate(type);
		translation._parentTranslator = me;
		
		if(type == "export" && (this.type == "web" || this.type == "search")) {
			throw("for security reasons, web and search translators may not call export translators");
		}
		
		// for security reasons, safeTranslator wraps the translator object.
		// note that setLocation() is not allowed
		var safeTranslator = new Object();
		safeTranslator.setSearch = function(arg) { return translation.setSearch(arg) };
		safeTranslator.setDocument = function(arg) { return translation.setDocument(arg) };
		safeTranslator.setHandler = function(arg1, arg2) {
			translation.setHandler(arg1, 
				function(obj, item) {
					try {
						arg2(obj, item);
					} catch(e) {
						me.error(false, e);
					}
				}
			);
		};
		safeTranslator.setString = function(arg) { translation.setString(arg) };
		safeTranslator.setTranslator = function(arg) { return translation.setTranslator(arg) };
		safeTranslator.getTranslators = function() { return translation.getTranslators() };
		safeTranslator.translate = function() {
			var noHandlers = true;
			for(var i in translation._handlers) {
				noHandlers = false;
				break;
			}
			if(noHandlers) {
				if(type != "export") {
					translation.setHandler("itemDone", function(obj, item) { item.complete() });
				}
				if(type == "web") {
					translation.setHandler("selectItems", me._handlers["selectItems"]);
				}
			}
			return translation.translate(false);
		};
		safeTranslator.getTranslatorObject = function() {
			// load the translator into our sandbox
			translation._loadTranslator();
			// initialize internal IO
			translation._initializeInternalIO();
			
			var noHandlers = true;
			for(var i in translation._handlers) {
				noHandlers = false;
				break;
			}
			if(noHandlers) {
				if(type != "export") {
					translation.setHandler("itemDone", function(obj, item) { item.complete() });
				}
				if(type == "web") {
					translation.setHandler("selectItems", me._handlers["selectItems"]);
				}
			}
			
			// return sandbox
			return translation._sandbox;
		};
		
		return safeTranslator;
	}
}

/*
 * Adds appropriate methods for detect/translate modes
 */
Zotero.Translate.prototype._setSandboxMode = function(mode) {
	var me = this;
	
	// erase waitForCompletion status and done function
	this.waitForCompletion = false;
	this._sandbox.Zotero.done = undefined;
	
	if(mode == "detect") {
		// for asynchronous operation, use wait()
		// done() is implemented after wait() is called
		this._sandbox.Zotero.wait = function() { me._enableAsynchronousDetect() };
	} else {
		// for asynchronous operation, use wait()
		// done() is implemented after wait() is called
		this._sandbox.Zotero.wait = function() { me._enableAsynchronousTranslate() };
	}
}

/*
 * sets an option that modifies the way the translator is executed
 * 
 * called as configure() in translator detectCode
 *
 * current options:
 *
 * dataMode
 *   valid: import, export
 *   options: rdf, block, line
 *   purpose: selects whether write/read behave as standard text functions or
 *            use an RDF data source
 *
 * getCollections
 *   valid: export
 *   options: true, false
 *   purpose: selects whether export translator will receive an array of
 *            collections and children in addition to the array of items and
 *            children
 */
Zotero.Translate.prototype._configure = function(option, value) {
	this.configOptions[option] = value;
	Zotero.debug("Translate: Setting configure option "+option+" to "+value, 4);
}

/*
 * adds translator options to be displayed in a dialog
 *
 * called as addOption() in detect code
 *
 * current options are exportNotes and exportFileData
 */
Zotero.Translate.prototype._addOption = function(option, value) {
	this.displayOptions[option] = value;
	Zotero.debug("Translate: Setting display option "+option+" to "+value, 4);
}

/*
 * gets translator options that were displayed in a dialog
 *
 * called as getOption() in detect code
 *
 */
Zotero.Translate.prototype._getOption = function(option) {
	return this.displayOptions[option];
}

/*
 * makes translation API wait until done() has been called from the translator
 * before executing _translationComplete
 * 
 * called as wait() in translator code
 */
Zotero.Translate.prototype._enableAsynchronousDetect = function() {
	var me = this;
	this.waitForCompletion = true;
	this._sandbox.Zotero.done = function(arg) { me._translatorSearch.complete(arg) };
}

Zotero.Translate.prototype._enableAsynchronousTranslate = function() {
	var me = this;
	this.waitForCompletion = true;
	this._sandbox.Zotero.done = function(val, error) {
		me._translationComplete(val == undefined ? true : val, (error ? error : ""))
	};
}

/*
 * lets user pick which items s/he wants to put in his/her library
 * 
 * called as selectItems() in translator code
 */
Zotero.Translate.prototype._selectItems = function(options) {
	// hack to see if there are options
	var haveOptions = false;
	for(var i in options) {
		haveOptions = true;
		break;
	}
	
	if(!haveOptions) {
		throw "translator called select items with no items";
	}
	
	if(this._handlers.select) {
		return this.runHandler("select", options);
	} else {	// no handler defined; assume they want all of them
		return options;
	}
}

/*
 * executed on translator completion, either automatically from a synchronous
 * scraper or as done() from an asynchronous scraper
 *
 * finishes things up and calls callback function(s)
 */
Zotero.Translate.prototype._translationComplete = function(returnValue, error) {
	// to make sure this isn't called twice
	if(returnValue === undefined) {
		returnValue = this._itemsDone;
	}
	
	if(!this._complete) {
		this._complete = true;
		
		if(this.type == "search" && !this._itemsDone) {
			// if we're performing a search and didn't get any results, go on
			// to the next translator
			Zotero.debug("Translate: Could not find a result using "+this.translator[0].label+": \n"
			              +this._generateErrorString(error), 3);
			if(this.translator.length > 1) {
				this.translator.shift();
				this.translate();
				return;
			}
			
			returnValue = false;
		} else {
			// close open streams
			this._closeStreams();
			
			if(!returnValue) {
				// report error to console
				if(this.translator[0]) {
					this.translator[0].logError(error.toString(), "exception");
				} else {
					Components.utils.reportError(error);
				}
				
				// report error to debug log
				var errorString = this._generateErrorString(error);
				this._debug("Translation using "+(this.translator && this.translator[0] && this.translator[0].label ? this.translator[0].label : "no translator")+" failed: \n"+errorString, 2);
				
				// report translation error for webpages to mothership
				if(this.type == "web") this._reportTranslationFailure(errorString);
				
				this.runHandler("error", error);
			} else {
				this._debug("Translation successful");
			}
		}		
		
		// call handlers
		this.runHandler("done", returnValue);
	}
}

/*
 * generates a useful error string, for submitting and debugging purposes
 */
Zotero.Translate.prototype._generateErrorString = function(error) {
	var errorString = "";
	if(typeof(error) == "string") {
		errorString = "\nthrown exception => "+error;
	} else {
		for(var i in error) {
			if(typeof(error[i]) != "object") {
				errorString += "\n"+i+' => '+error[i];
			}
		}
	}
	
	errorString += "\nurl => "+this.path
		+ "\ndownloadAssociatedFiles => "+Zotero.Prefs.get("downloadAssociatedFiles")
		+ "\nautomaticSnapshots => "+Zotero.Prefs.get("automaticSnapshots");
	return errorString.substr(1);
}

/*
 * runs an HTTP request to report a translation error
 */
Zotero.Translate.prototype._reportTranslationFailure = function(errorData) {
	if(this.translator[0].inRepository && Zotero.Prefs.get("reportTranslationFailure")) {
		var postBody = "id=" + encodeURIComponent(this.translator[0].translatorID) +
					   "&lastUpdated=" + encodeURIComponent(this.translator[0].lastUpdated) +
					   "&diagnostic=" + encodeURIComponent(Zotero.getSystemInfo()) +
					   "&errorData=" + encodeURIComponent(errorData);
		Zotero.Utilities.HTTP.doPost("http://www.zotero.org/repo/report", postBody);
	}
}

/*
 * closes open file streams, if any exist
 */
Zotero.Translate.prototype._closeStreams = function() {
	// serialize RDF and unregister dataSource
	if(this._rdf) {
		if(this.type == "export") {
			// initialize serializer and add prefixes
			var serializer = Serializer();
			for(var prefix in this._rdf.namespaces) {
				serializer.suggestPrefix(prefix, this._rdf.namespaces[prefix]);
			}
			
			// serialize in appropriate format
			if(this.configOptions.dataMode == "rdf/n3") {
				var output = serializer.statementsToN3(this._rdf.statements);
			} else {
				var output = serializer.statementsToXML(this._rdf.statements);
			}
			
			if(this._streams.length) {
				Zotero.debug("writing to stream");
				// write serialized data to file
				var intlStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
									   .createInstance(Components.interfaces.nsIConverterOutputStream);
				intlStream.init(this._streams[0], "UTF-8", 4096, "?".charCodeAt(0));
				this._streams.push(intlStream);
				intlStream.writeString(output);
			} else {
				this.output = output;
			}
		}
		
		delete this._rdf;
	}
	
	if(this._streams.length) {
		for(var i in this._streams) {
			var stream = this._streams[i];
			
			// stream could be either an input stream or an output stream
			try {
				stream.QueryInterface(Components.interfaces.nsIFileInputStream);
			} catch(e) {
				try {
					stream.QueryInterface(Components.interfaces.nsIFileOutputStream);
				} catch(e) {
				}
			}
			
			// encase close in try block, because it's possible it's already
			// closed
			try {
				stream.close();
			} catch(e) {
			}
		}
	}
	
	delete this._streams;
	this._streams = new Array();
	this._inputStream = null;
}

/*
 * handles tags and see also data for notes and attachments
 */
Zotero.Translate.prototype._itemTagsAndSeeAlso = function(item, newItem) {
	// add to ID map
	if(item.itemID) {
		this._IDMap[item.itemID] = newItem.id;
	}
	// add see alsos
	if(item.seeAlso) {
		for each(var seeAlso in item.seeAlso) {
			if(this._IDMap[seeAlso]) {
				newItem.addRelatedItem(this._IDMap[seeAlso]);
			}
		}
		newItem.save();
	}
	if(item.tags) {
		var tagsToAdd = {};
		tagsToAdd[0] = []; // user tags
		tagsToAdd[1] = []; // automatic tags
		
		for each(var tag in item.tags) {
			if(typeof(tag) == "string") {
				// accept strings in tag array as automatic tags, or, if
				// importing, as non-automatic tags
				if (this.type == 'import') {
					tagsToAdd[0].push(tag);
				}
				else {
					tagsToAdd[1].push(tag);
				}
			} else if(typeof(tag) == "object") {
				// also accept objects
				if(tag.tag) {
					if (!tagsToAdd[tag.type]) {
						tagsToAdd[tag.type] = [];
					}
					tagsToAdd[tag.type].push(tag.tag);
				}
			}
		}
		
		for (var type in tagsToAdd) {
			if (tagsToAdd[type].length) {
				newItem.addTags(tagsToAdd[type], type);
			}
		}
	}
}

/*
 * executed when an item is done and ready to be loaded into the database
 */
Zotero.Translate._urlRe = /(([A-Za-z]+):\/\/[^\s]*)/i;
Zotero.Translate.prototype._itemDone = function(item, attachedTo) {
	// warn if itemDone called after translation completed
	if(this._complete) {
		Zotero.debug("Translate: WARNING: Zotero.Item.complete() called after Zotero.done(); please fix your code", 2);
	}
	
	if(this.type == "web") {
		// store library catalog if this item was captured from a website, and
		// libraryCatalog is truly undefined (not false or "")
		if(typeof item.repository != 'undefined') {
			Zotero.debug("Translate: 'repository' field is now 'libraryCatalog'; please fix your code", 2);
			item.libraryCatalog = item.repository;
			delete item.repository;
		}
		
		if(typeof item.libraryCatalog == 'undefined') {
			item.libraryCatalog = this.translator[0].label;
		}
	}
	
	this._itemsDone = true;
	
	// if we're not supposed to save the item or we're in a child translator,
	// just return the item array
	if(this.libraryID === false || this._parentTranslator) {
		
		// if a parent sandbox exists, use complete() function from that sandbox
		if(this._parentTranslator) {
			var pt = this._parentTranslator;
			item.complete = function() { pt._itemDone(this) };
			Zotero.debug("Translate: Calling done from parent sandbox", 4);
		}
		this.runHandler("itemDone", item);
		return;
	}
	
	// Get typeID, defaulting to "webpage"
	var type = (item.itemType ? item.itemType : "webpage");
	
	if(type == "note") {	// handle notes differently
		var newItem = new Zotero.Item('note');
		newItem.libraryID = this.libraryID ? this.libraryID : null;
		newItem.setNote(item.note);
		var myID = newItem.save();
		// re-retrieve the item
		var newItem = Zotero.Items.get(myID);
	} else {
		if(!item.title && this.type == "web") {
			throw("item has no title");
		}
		
		// if item was accessed through a proxy, ensure that the proxy
		// address remains in the accessed version
		if(this.locationIsProxied && item.url) {
			item.url = Zotero.Proxies.properToProxy(item.url);
		}
		
		// create new item
		if(type == "attachment") {
			if(this.type != "import") {
				Zotero.debug("Translate: Discarding standalone attachment", 2);
				return;
			}
			
			Zotero.debug("Translate: Adding attachment", 4);
			
			if(!item.url && !item.path) {
				Zotero.debug("Translate: Ignoring attachment: no path or URL specified", 2);
				return;
			}
			
			if(!item.path) {
				// see if this is actually a file URL
				var m = Zotero.Translate._urlRe.exec(item.url);
				var protocol = m ? m[2].toLowerCase() : "";
				if(protocol == "file") {
					item.path = item.url;
					item.url = false;
				} else if(protocol != "http" && protocol != "https") {
					Zotero.debug("Translate: Unrecognized protocol "+protocol, 2);
					return;
				}
			}
			
			if(!item.path) {
				// create from URL
				try {
					var myID = Zotero.Attachments.linkFromURL(item.url, attachedTo,
							(item.mimeType ? item.mimeType : undefined),
							(item.title ? item.title : undefined));
				} catch(e) {
					Zotero.debug("Translate: Error adding attachment "+item.url, 2);
					return;
				}
				Zotero.debug("Translate: Created attachment; id is "+myID, 4);
				var newItem = Zotero.Items.get(myID);
			} else {
				// generate nsIFile
				var IOService = Components.classes["@mozilla.org/network/io-service;1"].
								getService(Components.interfaces.nsIIOService);
				var uri = IOService.newURI(item.path, "", null);
				var file = uri.QueryInterface(Components.interfaces.nsIFileURL).file;
				
				if (file.path == '/') {
					Zotero.debug("Translate: Ignoring attachment '" + item.path + "': error parsing path", 2);
					return;
				}
				
				if (!file.exists()) {
					// use item title if possible, or else file leaf name
					var title = item.title;
					if(!title) title = file.leafName;
					
					var myID = Zotero.Attachments.createMissingAttachment(
						item.url ? Zotero.Attachments.LINK_MODE_IMPORTED_URL
							: Zotero.Attachments.LINK_MODE_IMPORTED_FILE,
						file, item.url ? item.url : null, title,
						item.mimeType, item.charset, attachedTo);
				}
				else if (item.url) {
					var myID = Zotero.Attachments.importSnapshotFromFile(file,
						item.url, item.title, item.mimeType, item.charset,
						attachedTo);
				}
				else {
					var myID = Zotero.Attachments.importFromFile(file, attachedTo);
				}
			}
			
			var typeID = Zotero.ItemTypes.getID("attachment");
			var newItem = Zotero.Items.get(myID);
			
			// add note if necessary
			if(item.note) {
				newItem.setNote(item.note);
			}
		} else {
			var typeID = Zotero.ItemTypes.getID(type);
			var newItem = new Zotero.Item(typeID);
			newItem.libraryID = this.libraryID ? this.libraryID : null;
		}
		
		// makes looping through easier
		item.itemType = item.complete = undefined;
		
		// automatically set access date if URL is set
		if(item.url && !item.accessDate && this.type == "web") {
			item.accessDate = "CURRENT_TIMESTAMP";
		}
		
		var fieldID, data;
		for(var field in item) {
			// loop through item fields
			data = item[field];
			
			if(data) {						// if field has content
				if(field == "creators") {		// creators are a special case
					for(var j in data) {
						// try to assign correct creator type
						if(data[j].creatorType) {
							try {
								var creatorTypeID = Zotero.CreatorTypes.getID(data[j].creatorType);
							} catch(e) {
								Zotero.debug("Translate: Invalid creator type "+data[j].creatorType+" for creator index "+j, 2);
							}
						}
						if(!creatorTypeID) {
							var creatorTypeID = 1;
						}
						
						// Single-field mode
						if (data[j].fieldMode && data[j].fieldMode == 1) {
							var fields = {
								lastName: data[j].lastName,
								fieldMode: 1
							};
						}
						// Two-field mode
						else {
							var fields = {
								firstName: data[j].firstName,
								lastName: data[j].lastName
							};
						}
						
						var creator = null;
						var creatorDataID = Zotero.Creators.getDataID(fields);
						if(creatorDataID) {
							var linkedCreators = Zotero.Creators.getCreatorsWithData(creatorDataID, this.libraryID);
							if (linkedCreators) {
								// TODO: support identical creators via popup? ugh...
								var creatorID = linkedCreators[0];
								creator = Zotero.Creators.get(creatorID);
							}
						}
						if(!creator) {
							creator = new Zotero.Creator;
							creator.libraryID = this.libraryID ? this.libraryID : null;
							creator.setFields(fields);
							var creatorID = creator.save();
						}
						
						newItem.setCreator(j, creator, creatorTypeID);
					}
				} else if(field == "seeAlso") {
					newItem.translateSeeAlso = data;
				} else if(field != "note" && field != "notes" && field != "itemID" &&
						  field != "attachments" && field != "tags" &&
						  (fieldID = Zotero.ItemFields.getID(field))) {
											// if field is in db
					
					// try to map from base field
					Zotero.debug(Zotero.ItemFields.getFieldIDFromTypeAndBase(19, 7));
					if(Zotero.ItemFields.isBaseField(fieldID)) {
						var fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(typeID, fieldID);
						if(fieldID) {
							Zotero.debug("Translate: Mapping "+field+" to "+Zotero.ItemFields.getName(fieldID), 5);
						} else {
						}
					}
					Zotero.debug(fieldID);
					
					// if field is valid for this type, set field
					Zotero.debug(Zotero.ItemFields.getName(Zotero.ItemFields.getID(field)));
					Zotero.debug("Translate: testing "+fieldID+" "+typeID);
					if(fieldID && Zotero.ItemFields.isValidForType(fieldID, typeID)) {
						newItem.setField(fieldID, data);
					} else {
						Zotero.debug("Translate: Discarded field "+field+" for item: field not valid for type "+type, 3);
					}
				}
			}
		}
	
		// create short title
		if(this.type == "web" && 
		   item.shortTitle === undefined &&
		   Zotero.ItemFields.isValidForType("shortTitle", typeID)) {
			// get field id
			var fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(typeID, "title");
			// get title
			var title = newItem.getField(fieldID);
			
			if(title) {
				// only set if changes have been made
				var set = false;
				
				// shorten to before first colon
				var index = title.indexOf(":");
				if(index !== -1) {
					title = title.substr(0, index);
					set = true;
				}
				// shorten to after first question mark
				index = title.indexOf("?");
				if(index !== -1) {
					index++;
					if(index != title.length) {
						title = title.substr(0, index);
						set = true;
					}
				}
				
				if(set) newItem.setField("shortTitle", title);
			}
		}
		
		// save item
		if(myID) {
			newItem.save();
		} else {
			var myID = newItem.save();
			newItem = Zotero.Items.get(myID);
		}
		
		// handle notes
		if(item.notes) {
			for each(var note in item.notes) {
				var myNote = new Zotero.Item('note');
				myNote.libraryID = this.libraryID ? this.libraryID : null;
				myNote.setNote(note.note);
				if (myID) {
					myNote.setSource(myID);
				}
				var noteID = myNote.save();
				
				// handle see also
				myNote = Zotero.Items.get(noteID);
				this._itemTagsAndSeeAlso(note, myNote);
			}
		}
		
		var automaticSnapshots = Zotero.Prefs.get("automaticSnapshots");
		var downloadAssociatedFiles = Zotero.Prefs.get("downloadAssociatedFiles");
		
		// handle attachments
		if(item.attachments && this.saveAttachments &&
				// DEBUG: is "this.type == 'import'" still necessary with this.saveAttachments?
				(this.type == 'import' || automaticSnapshots || downloadAssociatedFiles)) {
			for each(var attachment in item.attachments) {
				if(this.type == "web") {
					if(!attachment.url && !attachment.document) {
						Zotero.debug("Translate: Not adding attachment: no URL specified", 2);
					} else {
						if(attachment.snapshot === false) {
							if(!automaticSnapshots) {
								continue;
							}
							
							// if snapshot is explicitly set to false, attach as link
							if(attachment.document) {
								Zotero.Attachments.linkFromURL(attachment.document.location.href, myID,
										(attachment.mimeType ? attachment.mimeType : attachment.document.contentType),
										(attachment.title ? attachment.title : attachment.document.title));
							} else {
								if(!attachment.mimeType || !attachment.title) {
									Zotero.debug("Translate: Either mimeType or title is missing; attaching file will be slower", 3);
								}
								
								try {
									Zotero.Attachments.linkFromURL(attachment.url, myID,
											(attachment.mimeType ? attachment.mimeType : undefined),
											(attachment.title ? attachment.title : undefined));
								} catch(e) {
									Zotero.debug("Translate: Error adding attachment "+attachment.url, 2);
								}
							}
						} else if(this.saveFiles && (attachment.document
						|| (attachment.mimeType && attachment.mimeType == "text/html")
						|| downloadAssociatedFiles)) {
						
							// if snapshot is not explicitly set to false, retrieve snapshot
							if(attachment.document) {
								if(automaticSnapshots) {
									try {
										Zotero.Attachments.importFromDocument(attachment.document, myID, attachment.title);
									} catch(e) {
										Zotero.debug("Translate: Error attaching document", 2);
									}
								}
							// Save attachment if snapshot pref enabled or not HTML
							// (in which case downloadAssociatedFiles applies)
							} else if(this.saveFiles && (automaticSnapshots || !attachment.mimeType
									|| attachment.mimeType != "text/html")) {
								var mimeType = null;
								var title = null;

								if(attachment.mimeType) {
									// first, try to extract mime type from mimeType attribute
									mimeType = attachment.mimeType;
								} else if(attachment.document && attachment.document.contentType) {
									// if that fails, use document if possible
									mimeType = attachment.document.contentType
								}

								// same procedure for title as mime type
								if(attachment.title) {
									title = attachment.title;
								} else if(attachment.document && attachment.document.title) {
									title = attachment.document.title;
								}

								if(this.locationIsProxied) {
									attachment.url = Zotero.Proxies.properToProxy(attachment.url);
								}

								var fileBaseName = Zotero.Attachments.getFileBaseNameFromItem(myID);
								try {
									Zotero.Attachments.importFromURL(attachment.url, myID, title, fileBaseName);
								} catch(e) {
									Zotero.debug("Translate: Error adding attachment "+attachment.url, 2);
								}
							}
						}
					}
				} else if(this.type == "import") {
					// create new attachments attached here
					attachment.itemType = 'attachment';
					this._itemDone(attachment, myID);
				}
			}
		}
	}
	
	if(item.itemID) {
		this._IDMap[item.itemID] = myID;
	}
	if(!attachedTo) {
		this.newItems.push(myID);
	}
	
	// handle see also
	if(item.seeAlso) {
		for each(var seeAlso in item.seeAlso) {
			if(this._IDMap[seeAlso]) {
				newItem.addRelatedItem(this._IDMap[seeAlso]);
			}
		}
		newItem.save();
	}
	
	// handle tags, if this is an import translation or automatic tagging is
	// enabled in the preferences (as it is by default)
	if(item.tags &&
	  (this.type == "import" || Zotero.Prefs.get("automaticTags"))) {
		var tagsToAdd = {};
		tagsToAdd[0] = []; // user tags
		tagsToAdd[1] = []; // automatic tags
		
		for each(var tag in item.tags) {
			if(typeof(tag) == "string") {
				// accept strings in tag array as automatic tags, or, if
				// importing, as non-automatic tags
				if (this.type == 'import') {
					tagsToAdd[0].push(tag);
				}
				else {
					tagsToAdd[1].push(tag);
				}
			} else if(typeof(tag) == "object") {
				// also accept objects
				if(tag.tag) {
					if (this.type == "import") {
						if (!tagsToAdd[tag.type]) {
							tagsToAdd[tag.type] = [];
						}
						tagsToAdd[tag.type].push(tag.tag);
					}
					// force web imports to automatic
					else {
						tagsToAdd[1].push(tag.tag);
					}
				}
			}
		}
		
		for (var type in tagsToAdd) {
			if (tagsToAdd[type].length) {
				newItem.addTags(tagsToAdd[type], type);
			}
		}
	}
	
	if(!attachedTo) {
		// Re-retrieve item before passing to handler
		newItem = Zotero.Items.get(newItem.id);
		this.runHandler("itemDone", newItem);
	}
	
	delete item;
	
	// Allow progress meter to update
	//
	// This can probably be re-enabled for web translators once badly asynced ones are fixed
	if (this.type == 'import' || this.type == 'export') {
		Zotero.wait();
	}
}

/*
 * executed when a collection is done and ready to be loaded into the database
 */
Zotero.Translate.prototype._collectionDone = function(collection) {
	var newCollection = this._processCollection(collection, null);
	
	this.runHandler("collectionDone", newCollection);
}

/*
 * recursively processes collections
 */
Zotero.Translate.prototype._processCollection = function(collection, parentID) {
	var newCollection = Zotero.Collections.add(collection.name, parentID);
	var myID = newCollection.id;
	
	this.newCollections.push(myID);
	
	var toAdd = [];
	
	for each(child in collection.children) {
		if(child.type == "collection") {
			// do recursive processing of collections
			this._processCollection(child, myID);
		} else {
			// add mapped items to collection
			if(this._IDMap[child.id]) {
				toAdd.push(this._IDMap[child.id]);
			} else {
				Zotero.debug("Translate: Could not map "+child.id+" to an imported item", 2);
			}
		}
	}
	
	if (toAdd.length) {
		Zotero.debug("Translate: Adding " + toAdd, 5);
		newCollection.addItems(toAdd);
	}
	
	return newCollection;
}

/*
 * logs a debugging message
 */
Zotero.Translate.prototype._debug = function(string, level) {
	// if handler does not return anything explicitly false, show debug
	// message in console
	if(this.runHandler("debug", string) !== false) {
		if(typeof string == "string") string = "Translate: "+string;
		Zotero.debug(string, level);
	}
}

/*
 * does the actual web translation
 */
Zotero.Translate.prototype._web = function() {
	try {
		this._sandbox.doWeb(this.document, this.location);
	} catch(e) {
		if(this._parentTranslator) {
			throw(e);
		} else {
			this._translationComplete(false, e);
			return false;
		}
	}
	
	return true;
}

/**
 * Does the actual search translation
 **/
Zotero.Translate.prototype._search = function() {
	try {
		this._sandbox.doSearch(this.search);
	} catch(e) {
		this._translationComplete(false, e);
		return false;
	}
	
	return true;
}

/**
 * Does the actual import translation
 **/
Zotero.Translate.prototype._import = function() {
	this.waitForCompletion = true;
	this._importSniffCharacterSet();
}

/**
 * Sniff file for its character set, then proceed with the rest of translation
 */
Zotero.Translate.prototype._importSniffCharacterSet = function(callback) {
	if(!this._storage) {
		if(this._charset) {
			// have charset already; just go on
			this._importDoneSniffing(this._charset);
		} else {
			// need to check charset
			importCharset = Zotero.Prefs.get("import.charset");
			if(importCharset == "auto") {
				// look for charset
				var me = this;
				Zotero.File.getCharsetFromFile(this.location, "text/plain",
					function(charset) {
						// Default to UTF-8 if no charset available
						me._charset = charset ? charset : "UTF-8";
						me._importDoneSniffing(charset);
					});
			} else {
				this._importDoneSniffing(importCharset);
			}
		}
	} else {
		this._importDoneSniffing();
	}
}

/**
 * Complete import (used as callback after sniffing)
 **/
Zotero.Translate.prototype._importDoneSniffing = function(charset) {
	this._importConfigureIO(charset);
	
	try {
		this._sandbox.doImport();
	} catch(e) {
		if(this._parentTranslator) {
			throw(e);
		} else {
			this._translationComplete(false, e);
			return false;
		}
	}
	this._translationComplete(true);
}

/*
 * set up import for IO
 */
Zotero.Translate.prototype._importConfigureIO = function(charset) {
	if(this._storage) {
		// import from string
		this._storagePointer = 0;
		
		if(this.configOptions.dataMode && this.configOptions.dataMode == "xml/dom" || this.configOptions.dataMode == "rdf") {
			// for DOM XML, handle with parseFromString
			if(this.configOptions.dataMode == "xml/dom" || !this._rdf) {
				var xmlNodes = Components.classes["@mozilla.org/xmlextras/domparser;1"]
									   .createInstance(Components.interfaces.nsIDOMParser)
									   .parseFromString(this._storage, "text/xml");
			}
		} else if(this.configOptions.dataMode && this.configOptions.dataMode == "xml/e4x") {
			var xmlNodes = new XML(this._storage.replace(/<\?xml[^>]+\?>/, ""));
		} else {
			this._storageFunctions(true);
		}
	} else {
		// import from file
		
		var me = this;
		// open file and set read methods
		if(this._inputStream) {
			this._inputStream.QueryInterface(Components.interfaces.nsISeekableStream)
						 .seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, 0);
			this._inputStream.QueryInterface(Components.interfaces.nsIFileInputStream);
		} else {
			this._inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
									  .createInstance(Components.interfaces.nsIFileInputStream);
			this._inputStream.init(this.location, 0x01, 0664, 0);
			this._streams.push(this._inputStream);
		}
		
		var sStream = null;
		var bomLength = 0;
		if(!charset && this._charset) charset = this._charset;
		if(!charset || (charset && charset.length > 3 && charset.substr(0, 3).toUpperCase() == "UTF")) {
			// seek past BOM
			var bomCharset = this._importGetBOM();
			var bomLength = (bomCharset ? BOMs[bomCharset].length : 0);
			this._inputStream.QueryInterface(Components.interfaces.nsISeekableStream)
				.seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, bomLength);
			if(bomCharset) charset = this._charset = bomCharset;
		}
		
		// look for/seek past XML charset declaration
		if(this.configOptions.dataMode && (this.configOptions.dataMode == "xml/e4x"
				|| this.configOptions.dataMode == "xml/dom"
				|| this.configOptions.dataMode == "rdf")) {
				
			sStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
						 .createInstance(Components.interfaces.nsIScriptableInputStream);
			sStream.init(this._inputStream);
			this._streams.push(sStream);
			
			// read until we see if the file begins with a parse instruction
			const whitespaceRe = /\s/g;
			var read;
			do {
				read = sStream.read(1);
			} while(whitespaceRe.test(read))
			
			if(read != "<") throw "XML load error: text does not start with <";
			
			var firstPart = read + sStream.read(4);
			if(firstPart == "<?xml") {
				// got a parse instruction, read until it ends
				read = true;
				while((read !== false) && (read !== ">")) {
					read = sStream.read(1);
					firstPart += read;
				}
				
				var encodingRe = /encoding=['"]([^'"]+)['"]/;
				var m = encodingRe.exec(firstPart);
				if(m) {
					try {
						var charconv = Components.classes["@mozilla.org/charset-converter-manager;1"]
											   .getService(Components.interfaces.nsICharsetConverterManager)
											   .getCharsetTitle(m[1]);
						if(charconv) charset = this._charset = m[1];
					} catch(e) {}
				}
			} else {
				this._inputStream.QueryInterface(Components.interfaces.nsISeekableStream)
							 .seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, bomLength);
			}
			
			if(!charset) charset = "UTF-8";
		}
		
		if(this.configOptions.dataMode && this.configOptions.dataMode == "xml/dom" || this.configOptions.dataMode == "rdf") {
			// for DOM XML, pass charset to parseFromStream
			if(this.configOptions.dataMode == "xml/dom" || !this._rdf) {
				var xmlNodes = Components.classes["@mozilla.org/xmlextras/domparser;1"]
									   .createInstance(Components.interfaces.nsIDOMParser)
									   .parseFromStream(this._inputStream, charset, this.location.fileSize, "text/xml");
			}
		} else {
			var intlStream = null;
			if(charset) {
				// if have detected charset
				Zotero.debug("Translate: Using detected character set "+charset, 3);
				// convert from detected charset
				intlStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
									   .createInstance(Components.interfaces.nsIConverterInputStream);
				intlStream.init(this._inputStream, charset, 65535,
					Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
				me._streams.push(intlStream);
			}
			
			if(this.configOptions.dataMode && this.configOptions.dataMode == "xml/e4x") {	
				// read in 16384 byte increments
				var xmlNodes = "";
				var str = {};
				while(intlStream.readString(16384, str)) {
					xmlNodes += str.value;
				}
				
				// create xml
				xmlNodes = new XML(xmlNodes);
			} else {
				// standard text reading tools
				
				// allow translator to set charset
				this._sandbox.Zotero.setCharacterSet = function(charset) {
					// seek back to the beginning
					me._inputStream.QueryInterface(Components.interfaces.nsISeekableStream)
								 .seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, bomLength);
					
					intlStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
										   .createInstance(Components.interfaces.nsIConverterInputStream);
					try {
						intlStream.init(me._inputStream, charset, 65535,
							Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
					} catch(e) {
						throw "Text encoding not supported";
					}
					me._streams.push(intlStream);
				}
				
				var str = new Object();
				if(this.configOptions.dataMode && this.configOptions.dataMode == "line") {	// line by line reading	
					this._inputStream.QueryInterface(Components.interfaces.nsILineInputStream);
					
					this._sandbox.Zotero.read = function() {
						if(intlStream && intlStream instanceof Components.interfaces.nsIUnicharLineInputStream) {
							var amountRead = intlStream.readLine(str);
						} else {
							var amountRead = me._inputStream.readLine(str);
						}
						if(amountRead) {
							return str.value;
						} else {
							return false;
						}
					}
				} else {										// block reading
					this._sandbox.Zotero.read = function(amount) {
						if(intlStream) {
							// read from international stream, if one is available
							var amountRead = intlStream.readString(amount, str);
							
							if(amountRead) {
								return str.value;
							} else {
								return false;
							}
						} else {
							// allocate sStream on the fly
							if(!sStream) {
								sStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
											 .createInstance(Components.interfaces.nsIScriptableInputStream);
								sStream.init(me._inputStream);
								me._streams.push(sStream);
							}
							
							// read from the scriptable input stream
							var string = sStream.read(amount);
							return string;
						}
					}
				}
			}
		}
	}
	
	if(this.configOptions.dataMode) {
		// make sure DOM XML actually got parsed
		if(xmlNodes && (this.configOptions.dataMode == "rdf" || this.configOptions.dataMode == "xml/dom")
				&& xmlNodes.getElementsByTagName("parsererror").length) {
			this._rdf = undefined;
			throw("XML parser error: loading data into data store failed");
		}
		
		if(this.configOptions.dataMode == "rdf") {
			// set up RDF
			if(!this._rdf) {
				// get URI
				var IOService = Components.classes['@mozilla.org/network/io-service;1']
								.getService(Components.interfaces.nsIIOService);
				if(this._storage) {
					var baseURI = this.location ? this.location : "";
				} else {
					var fileHandler = IOService.getProtocolHandler("file")
									  .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
					var baseURI = fileHandler.getURLSpecFromFile(this.location);
				}
				
				Zotero.debug("Translate: initializing data store");
				this._rdf = new Zotero.RDF.AJAW.RDFIndexedFormula();
				
				Zotero.debug("Translate: loading data");
				var parser = new Zotero.RDF.AJAW.RDFParser(this._rdf);
				parser.parse(xmlNodes, baseURI);
			}
			
			// add RDF features to sandbox
			this._sandbox.Zotero.RDF = new Zotero.Translate.RDF(this._rdf);
		} else if(this.configOptions.dataMode == "xml/e4x" || this.configOptions.dataMode == "xml/dom") {
			// add getXML function
			this._sandbox.Zotero.getXML = function() {
				return xmlNodes;
			}
		}
	}
}

/**
 * Searches for a UTF BOM at the beginning of the input stream.
 *
 * @return The length of the UTF BOM.
 */
Zotero.Translate.prototype._importGetBOM = function() {
	// if not checked for a BOM, open a binary input stream and read
	var binStream = Components.classes["@mozilla.org/binaryinputstream;1"].
							   createInstance(Components.interfaces.nsIBinaryInputStream);
	binStream.setInputStream(this._inputStream);
	
	var possibleBOMs = BOMs;
	var couldHaveBOM = true;
	var newBOMs, readByte;
	
	while(couldHaveBOM) {
		newBOMs = {};
		couldHaveBOM = false;
		
		readByte = binStream.read8();
		readChar = String.fromCharCode(readByte)
		
		for(var charset in possibleBOMs) {
			if(possibleBOMs[charset][0] == readChar) {
				if(possibleBOMs[charset].length == 1) {
					// have checked entire BOM
					return charset;
				} else {
					// keep checking
					newBOMs[charset] = possibleBOMs[charset].substr(1);
					couldHaveBOM = true;
				}
			}
		}
		
		possibleBOMs = newBOMs;
	}
	
	return null;
}

/**
 * Does the actual export, after code has been loaded and parsed
 */
Zotero.Translate.prototype._export = function() {
	
	if(this.items) {
		// if just items, get them and don't worry about collection logic
		this._itemsLeft = this.items;
	} else if(this.collection) {
		// get items in this collection
		this._itemsLeft = this.collection.getChildItems();
		if(!this._itemsLeft) {
			this._itemsLeft = [];
		}
		
		if(this.configOptions.getCollections) {
			// get child collections
			this._collectionsLeft = Zotero.getCollections(this.collection.id, true);
			
			if(this._collectionsLeft.length) {
				// only include parent collection if there are actually children
				this._collectionsLeft.unshift(this.collection);
			}
			
			// get items in child collections
			for each(var collection in this._collectionsLeft) {
				var childItems = collection.getChildItems();
				if(childItems) {
					this._itemsLeft = this._itemsLeft.concat(childItems);
				}
			}
		}
	} else {
		// get all top-level items
		this._itemsLeft = Zotero.Items.getAll(true);
		
		if(this.configOptions.getCollections) {
			// get all collections
			this._collectionsLeft = Zotero.getCollections();
		}
	}
	
	// export file data, if requested
	if(this.displayOptions["exportFileData"]) {
		// generate directory
		var directory = Components.classes["@mozilla.org/file/local;1"].
		                createInstance(Components.interfaces.nsILocalFile);
		directory.initWithFile(this.location.parent);
		
		// delete this file if it exists
		if(this.location.exists()) {
			this.location.remove(true);
		}
		
		// get name
		var name = this.location.leafName;
		directory.append(name);
		
		// create directory
		directory.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0700);
		
		// generate a new location for the exported file, with the appropriate
		// extension
		this.location = Components.classes["@mozilla.org/file/local;1"].
		                createInstance(Components.interfaces.nsILocalFile);
		this.location.initWithFile(directory);
		this.location.append(name+"."+this.translator[0].target);
		
		// create files directory
		this._exportFileDirectory = Components.classes["@mozilla.org/file/local;1"].
		                            createInstance(Components.interfaces.nsILocalFile);
		this._exportFileDirectory.initWithFile(directory);
		this._exportFileDirectory.append("files");
		this._exportFileDirectory.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0700);
	}
	
	// configure IO
	this._exportConfigureIO();
	
	try {
		this._sandbox.doExport();
	} catch(e) {
		this._translationComplete(false, e);
		return false;
	}
	
	return true;
}

/**
 * Configures the output stream for export and adds writing functions to the
 * sandbox
 */
Zotero.Translate.prototype._exportConfigureIO = function() {
	if(this.location) {
		// open file
		var fStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
								 .createInstance(Components.interfaces.nsIFileOutputStream);
		fStream.init(this.location, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate
		// attach to stack of streams to close at the end
		this._streams.push(fStream);
	}
	
	if(this.configOptions.dataMode && (this.configOptions.dataMode == "rdf" || this.configOptions.dataMode == "rdf/n3")) {	// rdf io
		// initialize data store
		this._rdf = new Zotero.RDF.AJAW.RDFIndexedFormula();
		
		// add RDF features to sandbox
		this._sandbox.Zotero.RDF = new Zotero.Translate.RDF(this._rdf);
	} else {
		// regular io; write just writes to file or string
		if(this.location) {
			var intlStream = null;
			var writtenToStream = false;
			var streamCharset = null;
			
			// allow setting of character sets
			this._sandbox.Zotero.setCharacterSet = function(charset) {
				streamCharset = charset.toUpperCase();
				intlStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
									   .createInstance(Components.interfaces.nsIConverterOutputStream);
				if(charset == "UTF-8xBOM") charset = "UTF-8";
				intlStream.init(fStream, charset, 1024, "?".charCodeAt(0));
			};
			
			// if exportCharset option was presented to user, use the result
			if(this.displayOptions.exportCharset) {
				this._sandbox.Zotero.setCharacterSet(this.displayOptions.exportCharset);
			}
			
			this._sandbox.Zotero.write = function(data) {
				if(streamCharset) {
					if(!writtenToStream && BOMs[streamCharset]) {
						// If stream has not yet been written to, and a UTF type
						// has been selected, write the BOM
						fStream.write(BOMs[streamCharset], BOMs[streamCharset].length);
					}
					
					if(streamCharset == "MACINTOSH") {
						// fix buggy Mozilla MacRoman
						splitData = data.split(/([\r\n]+)/);
						for(var i=0; i<splitData.length; i+=2) {
							// write raw newlines straight to the string
							intlStream.writeString(splitData[i]);
							if(splitData[i+1]) {
								fStream.write(splitData[i+1], splitData[i+1].length);
							}
						}
						return;
					} else {
						intlStream.writeString(data);
					}
				} else {
					fStream.write(data, data.length);
				}
				
				writtenToStream = true;
			};
		} else {
			var me = this;
			this.output = "";
			
			// dummy setCharacterSet function
			this._sandbox.Zotero.setCharacterSet = function() {};
			// write to string
			this._sandbox.Zotero.write = function(data) {
				me.output += data;
			};
		}
	}
}

/*
 * copies attachment and returns data, given an attachment object
 */
Zotero.Translate.prototype._exportGetAttachment = function(attachment) {
	var attachmentArray = this._exportToArray(attachment);
	
	var linkMode = attachment.getAttachmentLinkMode();
	
	// get mime type
	attachmentArray.mimeType = attachmentArray.uniqueFields.mimeType = attachment.getAttachmentMIMEType();
	// get charset
	attachmentArray.charset = attachmentArray.uniqueFields.charset = attachment.getAttachmentCharset();
	
	if(linkMode != Zotero.Attachments.LINK_MODE_LINKED_URL &&
	   this.displayOptions["exportFileData"]) {
		// add path and filename if not an internet link
		var file = attachment.getFile();
		attachmentArray.path = "files/"+attachmentArray.itemID+"/"+file.leafName;
		
		if(linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
			// create a new directory
			var directory = Components.classes["@mozilla.org/file/local;1"].
							createInstance(Components.interfaces.nsILocalFile);
			directory.initWithFile(this._exportFileDirectory);
			directory.append(attachmentArray.itemID);
			// copy file
			try {
				directory.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0700);
				file.copyTo(directory, attachmentArray.filename);
			} catch(e) {
				attachmentArray.path = undefined;
			}
		} else {
			// copy imported files from the Zotero directory
			var directory = file.parent;
			try {
				directory.copyTo(this._exportFileDirectory, attachmentArray.itemID);
			} catch(e) {
				attachmentArray.path = undefined;
			}
		}
	}
	
	attachmentArray.itemType = "attachment";
	
	return attachmentArray;
}

/*
 * gets the next item to process (called as Zotero.nextItem() from code)
 */
Zotero.Translate.prototype._exportGetItem = function() {
	if(this._itemsLeft.length != 0) {
		var returnItem = this._itemsLeft.shift();
		// export file data for single files
		if(returnItem.isAttachment()) {		// an independent attachment
			var returnItemArray = this._exportGetAttachment(returnItem);
			if(returnItemArray) {
				return returnItemArray;
			} else {
				return this._exportGetItem();
			}
		} else {
			returnItemArray = this._exportToArray(returnItem);
			
			// get attachments, although only urls will be passed if exportFileData
			// is off
			returnItemArray.attachments = new Array();
			var attachments = returnItem.getAttachments();
			for each(var attachmentID in attachments) {
				var attachment = Zotero.Items.get(attachmentID);
				var attachmentInfo = this._exportGetAttachment(attachment);
				
				if(attachmentInfo) {
					returnItemArray.attachments.push(attachmentInfo);
				}
			}
		}
		
		this.runHandler("itemDone", returnItem);
		
		return returnItemArray;
	}
	
	return false;
}

Zotero.Translate.prototype._exportToArray = function(returnItem) {
	var returnItemArray = returnItem.toArray();
	
	// Remove SQL date from multipart dates
	if (returnItemArray.date) {
		returnItemArray.date = Zotero.Date.multipartToStr(returnItemArray.date);
	}
	
	returnItemArray.uniqueFields = new Object();
	
	// get base fields, not just the type-specific ones
	var itemTypeID = returnItem.itemTypeID;
	var allFields = Zotero.ItemFields.getItemTypeFields(itemTypeID);
	for each(var field in allFields) {
		var fieldName = Zotero.ItemFields.getName(field);
		
		if(returnItemArray[fieldName] !== undefined) {
			var baseField = Zotero.ItemFields.getBaseIDFromTypeAndField(itemTypeID, field);
			if(baseField && baseField != field) {
				var baseName = Zotero.ItemFields.getName(baseField);
				if(baseName) {
					returnItemArray[baseName] = returnItemArray[fieldName];
					returnItemArray.uniqueFields[baseName] = returnItemArray[fieldName];
				} else {
					returnItemArray.uniqueFields[fieldName] = returnItemArray[fieldName];
				}
			} else {
				returnItemArray.uniqueFields[fieldName] = returnItemArray[fieldName];
			}
		}
	}
	
	// preserve notes
	if(returnItemArray.note) returnItemArray.uniqueFields.note = returnItemArray.note;
	
	// TODO: Change tag.tag references in translators to tag.name
	// once translators are 1.5-only
	// TODO: Preserve tag type?
	if (returnItemArray.tags) {
		for (var i in returnItemArray.tags) {
			returnItemArray.tags[i].tag = returnItemArray.tags[i].fields.name;
		}
	}
	
	return returnItemArray;
}

/*
 * gets the next item to collection (called as Zotero.nextCollection() from code)
 */
Zotero.Translate.prototype._exportGetCollection = function() {
	if(!this.configOptions.getCollections) {
		throw("getCollections configure option not set; cannot retrieve collection");
	}
	
	if(this._collectionsLeft && this._collectionsLeft.length != 0) {
		var returnItem = this._collectionsLeft.shift();
		var obj = returnItem.serialize(true);
		obj.id = obj.primary.collectionID;
		obj.name = obj.fields.name;
		return obj;
	}
}

/*
 * sets up internal IO in such a way that both reading and writing are possible
 * (for inter-scraper communications)
 */
Zotero.Translate.prototype._initializeInternalIO = function() {
	if(this.type == "import" || this.type == "export") {
		if(this.configOptions.dataMode && (this.configOptions.dataMode == "rdf" || this.configOptions.dataMode == "rdf/n3")) {
			// initialize data store
			this._rdf = new Zotero.RDF.AJAW.RDFIndexedFormula();
			
			// add RDF features to sandbox
			this._sandbox.Zotero.RDF = new Zotero.Translate.RDF(this._rdf);
		} else {
			this._storage = "";
			this._storageLength = 0;
			this._storagePointer = 0;
			this._storageFunctions(true, true);
		}
	}
}

/*
 * sets up functions for reading/writing to a storage stream
 */
Zotero.Translate.prototype._storageFunctions =  function(read, write) {
	var me = this;
	
	// add setCharacterSet method that does nothing
	this._sandbox.Zotero.setCharacterSet = function() {}
	
	if(write) {
		// set up write() method
		this._sandbox.Zotero.write = function(data) {
			me._storage += data;
			me._storageLength += data.length;
		};		
	}
	
	if(read) {
		// set up read methods
		if(this.configOptions.dataMode && this.configOptions.dataMode == "line") {	// line by line reading
			var lastCharacter;
			
			this._sandbox.Zotero.read = function() {
				if(me._storagePointer >= me._storageLength) {
					return false;
				}
				
				var oldPointer = me._storagePointer;
				var lfIndex = me._storage.indexOf("\n", me._storagePointer);
				
				if(lfIndex != -1) {
					// in case we have a CRLF
					me._storagePointer = lfIndex+1;
					if(me._storageLength > lfIndex && me._storage[lfIndex-1] == "\r") {
						lfIndex--;
					}
					return me._storage.substr(oldPointer, lfIndex-oldPointer);					
				}
				
				var crIndex = me._storage.indexOf("\r", me._storagePointer);
				if(crIndex != -1) {
					me._storagePointer = crIndex+1;
					return me._storage.substr(oldPointer, crIndex-oldPointer-1);
				}
				
				me._storagePointer = me._storageLength;
				return me._storage.substr(oldPointer);
			}
		} else {									// block reading
			this._sandbox.Zotero.read = function(amount) {
				if(me._storagePointer >= me._storageLength) {
					return false;
				}
				
				if((me._storagePointer+amount) > me._storageLength) {
					var oldPointer = me._storagePointer;
					me._storagePointer = me._storageLength+1;
					return me._storage.substr(oldPointer);
				}
				
				var oldPointer = me._storagePointer;
				me._storagePointer += amount;
				return me._storage.substr(oldPointer, amount);
			}
		}
	}
}

/* Zotero.Translate.ZoteroItem: a class to perform recursive translator searches
 * by waiting for completion of each translator
 */
 
Zotero.Translate.TranslatorSearch = function(translate, translators) {
	// generate a copy of the translator search array
	this.translate = translate;
	this.allTranslators = translators;
	this.translators = this.allTranslators.slice(0);
	this.foundTranslators = new Array();
	this.ignoreExtensions = false;
	this.asyncMode = false;
	
	this.running = true;
	this.execute();
}

/*
 * Check to see if a list of translators can scrape the page passed to the
 * translate() instance
 */
Zotero.Translate.TranslatorSearch.prototype.execute = function() {
	if(!this.running) return;
	if(this.checkDone()) return;
	
	// get next translator
	var translator = this.translators.shift();
	
	if((this.translate.type == "import" || this.translate.type == "web") && !this.translate.location && !this.translate._storage) {
		// if no location yet (e.g., getting list of possible web translators),
		// just return true
		this.addTranslator(translator);
		this.execute();
		return;
	}
	
	// Test location with regular expression
	var checkDetectCode = true;
	if(translator.target && (this.translate.type == "import" || this.translate.type == "web")) {
		var checkDetectCode = false;
		
		if(this.translate.type == "web") {
			var regularExpression = translator.webRegexp;
		} else {
			var regularExpression = translator.importRegexp;
		}
		
		if(regularExpression.test(this.translate.path)) {
			checkDetectCode = true;
		}
		
		if(this.ignoreExtensions) {
			// if we're ignoring extensions, that means we already tried
			// everything without ignoring extensions and it didn't work
			checkDetectCode = !checkDetectCode;
		}
	}
	
	// Test with JavaScript if available and didn't have a regular expression or
	// passed regular expression test
	if(checkDetectCode) {
	  	// parse the detect code and execute
		this.translate._parseCode(translator);
		
		if(this.translate.type == "import") {
			var me = this;
			
			try {
				this.translate._importConfigureIO();	// so it can read
			} catch(e) {
				Zotero.debug("Translate: "+e+' in opening IO for '+translator.label);
				this.execute();
				return;
			}
		}
		this.runDetectCode(translator);
	} else {
		this.execute();
	}
}

/**
 * Sets options and runs detectCode
 **/
Zotero.Translate.TranslatorSearch.prototype.runDetectCode = function(translator) {
	translator.configOptions = this.translate.configOptions;
	translator.displayOptions = this.translate.displayOptions;
	
	if((this.translate.type == "web" && this.translate._sandbox.detectWeb) ||
	   (this.translate.type == "search" && this.translate._sandbox.detectSearch) ||
	   (this.translate.type == "import" && this.translate._sandbox.detectImport)) {
		var returnValue;
		
		this.currentTranslator = translator;
		try {
			if(this.translate.type == "web") {
				returnValue = this.translate._sandbox.detectWeb(this.translate.document, this.translate.location);
			} else if(this.translate.type == "search") {
				returnValue = this.translate._sandbox.detectSearch(this.translate.search);
			} else if(this.translate.type == "import") {
				returnValue = this.translate._sandbox.detectImport();
			}
		} catch(e) {
			this.complete(returnValue, e);
			return;
		}
		
		Zotero.debug("Translate: Executed detectCode for "+translator.label, 4);
				
		if(this.translate.type == "web" && this.translate.waitForCompletion) {
			this.asyncMode = true;
			
			// don't immediately execute next
			return;
		} else if(returnValue) {
			this.processReturnValue(translator, returnValue);
		}
	} else {
		// add translator even though it has no proper detectCode (usually
		// export translators, which have options but do nothing with them)
		this.addTranslator(translator);
	}
	
	this.execute();
}

/*
 * Determines whether all translators have been processed
 */
Zotero.Translate.TranslatorSearch.prototype.checkDone = function() {
	if(this.translators.length == 0) {
		// if we've gone through all of the translators, trigger the handler
		if(this.foundTranslators.length) {
			this.translate.runHandler("translators", this.foundTranslators);
			return true;
		} else if(this.translate.type == "import" && !this.ignoreExtensions) {
			// if we fail the first time finding an import translator, search
			// again, but ignore extensions
			this.ignoreExtensions = true;
			this.translators = this.allTranslators.slice(0);
		} else {
			this.translate.runHandler("translators", false);
			return true;
		}
	}
	
	return false;
}

/*
 * Processes the return value from a translator
 */
Zotero.Translate.TranslatorSearch.prototype.processReturnValue = function(translator, returnValue) {
	Zotero.debug("Translate: Found translator "+translator.label, 3);
	
	if(typeof(returnValue) == "string") {
		translator.itemType = returnValue;
	}
	this.addTranslator(translator);
}

/*
 * Called upon completion of asynchronous translator search
 */
Zotero.Translate.TranslatorSearch.prototype.complete = function(returnValue, error) {
	// reset done function
	this.translate._sandbox.Zotero.done = undefined;
	this.translate.waitForCompletion = false;
	
	if(returnValue) {
		this.processReturnValue(this.currentTranslator, returnValue);
	} else if(error) {
		var errorString = this.translate._generateErrorString(error);
		this.currentTranslator.logError(error, "warning");
		this.translate._debug("detectCode for "+(this.currentTranslator ? this.currentTranslator.label : "no translator")+" failed: \n"+errorString, 4);
	}
	
	this.currentTranslator = undefined;
	this.asyncMode = false;
		
	// resume execution
	this.execute();
}

/*
 * Copies a translator to the foundTranslators list
 */
Zotero.Translate.TranslatorSearch.prototype.addTranslator = function(translator) {
	var newTranslator = new Object();
	for(var i in translator) {
		newTranslator[i] = translator[i];
	}
	this.foundTranslators.push(newTranslator);
}

/* Zotero.Translate.ZoteroItem: a class for generating a new item from
 * inside scraper code
 */
 
Zotero.Translate.GenerateZoteroItemClass = function() {
	var ZoteroItem = function(itemType) {
		// assign item type
		this.itemType = itemType;
		// generate creators array
		this.creators = new Array();
		// generate notes array
		this.notes = new Array();
		// generate tags array
		this.tags = new Array();
		// generate see also array
		this.seeAlso = new Array();
		// generate file array
		this.attachments = new Array();
	};
	
	return ZoteroItem;
}

/* Zotero.Translate.Collection: a class for generating a new top-level
 * collection from inside scraper code
 */

Zotero.Translate.GenerateZoteroCollectionClass = function() {
	var ZoteroCollection = function() {};
	
	return ZoteroCollection;
}

/* Zotero.Translate.RDF: a class for handling RDF IO
 *
 * If an import/export translator specifies dataMode RDF, this is the interface,
 * accessible from model.
 */

Zotero.Translate.RDF = function(dataStore) {
	this._dataStore = dataStore;
	this._containerCounts = {};
}

// get a resource as an nsIRDFResource, instead of a string
Zotero.Translate.RDF.prototype._getResource = function(about) {
	return (typeof about == "object" ? about : new Zotero.RDF.AJAW.RDFSymbol(about));
}


// USED FOR OUTPUT

// writes an RDF triple
Zotero.Translate.RDF.prototype.addStatement = function(about, relation, value, literal) {
	if(literal) {
		// zap chars that Mozilla will mangle
		value = value.toString().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
	} else {
		value = this._getResource(value);
	}
	
	this._dataStore.add(this._getResource(about), this._getResource(relation), value);
}
		
// creates an anonymous resource
Zotero.Translate.RDF.prototype.newResource = function() {
	return new Zotero.RDF.AJAW.RDFBlankNode();
};
		
// creates a new container
Zotero.Translate.RDF.prototype.newContainer = function(type, about) {
	const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
	const containerTypes = {"bag":"Bag", "seq":"Seq", "alt":"Alt"};
	
	type = type.toLowerCase();
	if(!containerTypes[type]) {
		throw "Invalid container type in Zotero.RDF.newContainer";
	}
	
	var about = this._getResource(about);
	this.addStatement(about, rdf+"type", rdf+containerTypes[type], false);
	this._containerCounts[about.toNT()] = 1;
	
	return about;
}

// adds a new container element
Zotero.Translate.RDF.prototype.addContainerElement = function(about, element, literal) {
	const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

	var about = this._getResource(about);
	this._dataStore.add(about, new Zotero.RDF.AJAW.RDFSymbol(rdf+"_"+(this._containerCounts[about.toNT()]++)), element, literal);
}

// gets container elements as an array
Zotero.Translate.RDF.prototype.getContainerElements = function(about) {
	const liPrefix = "http://www.w3.org/1999/02/22-rdf-syntax-ns#_";
	
	var about = this._getResource(about);
	var statements = this._dataStore.statementsMatching(about);
	var containerElements = [];
	
	// loop over arcs out looking for list items
	for each(var statement in statements) {
		if(statement.predicate.uri.substr(0, liPrefix.length) == liPrefix) {
			var number = statement.predicate.uri.substr(liPrefix.length);
			
			// make sure these are actually numeric list items
			var intNumber = parseInt(number);
			if(number == intNumber.toString()) {
				// add to element array
				containerElements[intNumber-1] = (statement.object.termType == "literal" ? statement.object.toString() : statement.object);
			}
		}
	}
	
	return containerElements;
}

// sets a namespace
Zotero.Translate.RDF.prototype.addNamespace = function(prefix, uri) {
	this._dataStore.setPrefixForURI(prefix, uri);
}

// gets a resource's URI
Zotero.Translate.RDF.prototype.getResourceURI = function(resource) {
	if(typeof(resource) == "string") return resource;
	if(resource.uri) return resource.uri;
	if(resource.toNT == undefined) throw "Zotero.RDF: getResourceURI called on invalid resource";
	return resource.toNT();
}

// USED FOR INPUT

// gets all RDF resources
Zotero.Translate.RDF.prototype.getAllResources = function() {
	return [s[0].subject for each(s in this._dataStore.subjectIndex)];
}

// gets arcs going in
Zotero.Translate.RDF.prototype.getArcsIn = function(resource) {
	var statements = this._dataStore.objectIndex[this._dataStore.canon(this._getResource(resource))];
	if(!statements) return false;
	return [s.predicate for each(s in statements)];
}

// gets arcs going out
Zotero.Translate.RDF.prototype.getArcsOut = function(resource) {
	var statements = this._dataStore.subjectIndex[this._dataStore.canon(this._getResource(resource))];
	if(!statements) return false;
	return [s.predicate.uri for each(s in statements)];
}

// gets source resources
Zotero.Translate.RDF.prototype.getSources = function(resource, property) {
	var statements = this._dataStore.statementsMatching(undefined, this._getResource(property), this._getResource(resource));
	if(!statements.length) return false;
	return [s.subject for each(s in statements)];
}

// gets target resources
Zotero.Translate.RDF.prototype.getTargets = function(resource, property) {
	var statements = this._dataStore.statementsMatching(this._getResource(resource), this._getResource(property));
	if(!statements.length) return false;
	return [(s.object.termType == "literal" ? s.object.toString() : s.object) for each(s in statements)];
}

/**
 * Gets statements matching a certain pattern
 *
 * @param	{String|Zotero.RDF.AJAW.RDFSymbol}	subj 		Subject
 * @param	{String|Zotero.RDF.AJAW.RDFSymbol}	predicate	Predicate
 * @param	{String|Zotero.RDF.AJAW.RDFSymbol}	obj			Object
 * @param	{Boolean}							objLiteral	Whether the object is a literal (as
 *															opposed to a URI)
 * @param	{Boolean}							justOne		Whether to stop when a single result is
 *															retrieved
 */
Zotero.Translate.RDF.prototype.getStatementsMatching = function(subj, pred, obj, objLiteral, justOne) {
	var statements = this._dataStore.statementsMatching(
		(subj ? this._getResource(subj) : undefined),
		(pred ? this._getResource(pred) : undefined),
		(obj ? (objLiteral ? objLiteral : this._getResource(obj)) : undefined),
		undefined, justOne);
	if(!statements.length) return false;
	return [[s.subject, s.predicate, (s.object.termType == "literal" ? s.object.toString() : s.object)] for each(s in statements)];
}