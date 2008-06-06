/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

//
// Zotero Translate Engine
//

/*
 * Zotero.Translate: a class for translation of Zotero metadata from and to
 * other formats
 *
 * eventually, Zotero.Ingester may be rolled in here (i.e., after we get rid
 * of RDF)
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
 * saveItem - whether new items should be saved to the database. defaults to
 *            true; set using second argument of constructor.
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
 * _hasBOM - whether the given file ready to be imported has a BOM or not
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

Zotero.Translate = function(type, saveItem) {
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
	
	if(saveItem === false) {	// three equals signs means if it's left
								// undefined, this.saveItem will still be true
		this.saveItem = false;
	} else {
		this.saveItem = true;
	}
	
	this._handlers = new Array();
	this._streams = new Array();
}

/*
 * (singleton) initializes scrapers, loading from the database and separating
 * into types
 */
Zotero.Translate.init = function() {
	if(!Zotero.Translate.cache) {
		var cachePref = Zotero.Prefs.get("cacheTranslatorData");
		
		if(cachePref) {
			// fetch translator list
			var translators = Zotero.DB.query("SELECT translatorID, translatorType, label, "+
				"target, detectCode IS NULL as noDetectCode FROM translators "+
				"ORDER BY priority, label");
			var detectCodes = Zotero.DB.query("SELECT translatorID, detectCode FROM translators WHERE target IS NULL");
			
			Zotero.Translate.cache = new Object();
			Zotero.Translate.cache["import"] = new Array();
			Zotero.Translate.cache["export"] = new Array();
			Zotero.Translate.cache["web"] = new Array();
			Zotero.Translate.cache["search"] = new Array();
			
			for each(translator in translators) {
				var type = translator.translatorType;
				
				// not sure why this is necessary
				var wrappedTranslator = {translatorID:translator.translatorID,
				                         label:translator.label,
				                         target:translator.target}
				
				if(translator.noDetectCode) {
					wrappedTranslator.noDetectCode = true;
				}
				
				// import translator
				var mod = type % 2;
				if(mod) {
					var regexp = new RegExp();
					regexp.compile("\."+translator.target+"$", "i");
					wrappedTranslator.importRegexp = regexp;
					Zotero.Translate.cache["import"].push(wrappedTranslator);
					type -= mod;
				}
				// search translator
				var mod = type % 4;
				if(mod) {
					Zotero.Translate.cache["export"].push(wrappedTranslator);
					type -= mod;
				}
				// web translator
				var mod = type % 8;
				if(mod) {
					var regexp = new RegExp();
					regexp.compile(translator.target, "i");
					wrappedTranslator.webRegexp = regexp;
					Zotero.Translate.cache["web"].push(wrappedTranslator);
					
					if(!translator.target) {
						for each(var detectCode in detectCodes) {
							if(detectCode.translatorID == translator.translatorID) {
								wrappedTranslator.detectCode = detectCode.detectCode;
							}
						}
					}
					type -= mod;
				}
				// search translator
				var mod = type % 16;
				if(mod) {
					Zotero.Translate.cache["search"].push(wrappedTranslator);
					type -= mod;
				}
			}
		}
		
	}
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
		this.location = Zotero.Ingester.ProxyMonitor.proxyToProper(location);
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
	
	this._setDisplayOptions = null;
	
	if(typeof(translator) == "object") {	// passed an object and not an ID
		if(translator.translatorID) {
			if(translator.displayOptions) {
				this._setDisplayOptions = translator.displayOptions;
			}
			
			// if we were given the code, don't bother loading from DB
			if(translator.code) {
				this.translator = [translator];
				return true;
			}
			
			translator = [translator.translatorID];
		} else {
			// we have an associative array of translators
			if(this.type != "search") {
				throw("cannot set translator: a single translator must be specified when doing "+this.type+" translation");
			}
			
			// accept a list of objects
			for(var i in translator) {
				if(typeof(translator[i]) == "object") {
					if(translator[i].translatorID) {
						translator[i] = translator[i].translatorID;
					} else {
						throw("cannot set translator: must specify a single translator or a list of translators"); 
					}
				}
			}
		}
	} else {
		translator = [translator];
	}
	
	if(!translator.length) {
		return false;
	}
	
	var where = "";
	for(var i in translator) {
		where += " OR translatorID = ?";
	}
	where = where.substr(4);
	
	var sql = "SELECT * FROM translators WHERE "+where+" AND translatorType IN ("+this._numericTypes+")";
	this.translator = Zotero.DB.query(sql, translator);
	if(!this.translator) {
		return false;
	}
	
	return true;
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
			Zotero.debug("Translate: running handler "+i+" for "+type);
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
					Zotero.debug("Translate: "+e+' in handler '+i+' for '+type);
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
	
	// clear BOM
	this._hasBOM = null;
	
	if(Zotero.Translate.cache) {
		var translators = Zotero.Translate.cache[this.type];
	} else {
		var sql = "SELECT translatorID, label, target, detectCode IS NULL as "+
			"noDetectCode FROM translators WHERE translatorType IN ("+this._numericTypes+") "+
			"ORDER BY priority, label";
		var translators = Zotero.DB.query(sql);
	}
	
	// create a new sandbox
	this._generateSandbox();
	this._setSandboxMode("detect");
	
	var possibleTranslators = new Array();
	Zotero.debug("Translate: searching for translators for "+(this.path ? this.path : "an undisclosed location"));
	
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
	this._parseDetectCode(this.translator[0]);
	
	Zotero.debug("Translate: parsing code for "+this.translator[0].label);
	
	try {
		Components.utils.evalInSandbox(this.translator[0].code, this._sandbox);
	} catch(e) {
		if(this._parentTranslator) {
			throw(e);
		} else {
			this._debug(e+' in parsing code for '+this.translator[0].label);
			this._translationComplete(false, e);
			return false;
		}
	}
	
	return true;
}

/*
 * does the actual translation
 */
Zotero.Translate.prototype.translate = function() {
	/*
	 * initialize properties
	 */
	this.newItems = new Array();
	this.newCollections = new Array();
	this._IDMap = new Array();
	this._complete = false;
	this._itemsDone = false;
	this._hasBOM = null;
	
	if(!this.translator || !this.translator.length) {
		throw("cannot translate: no translator specified");
	}
	
	if(!this.location && this.type != "search" && this.type != "export" && !this._storage) {
		// searches operate differently, because we could have an array of
		// translators and have to go through each
		throw("cannot translate: no location specified");
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
Zotero.Translate.prototype._parseDetectCode = function(translator) {
	this.configOptions = new Array();
	this.displayOptions = new Array();
	
	if(translator.detectCode) {
		var detectCode = translator.detectCode;
	} else if(!translator.noDetectCode) {
		// get detect code from database
		var detectCode = Zotero.DB.valueQuery("SELECT detectCode FROM translators WHERE translatorID = ?",
		                                       [translator.translatorID]);
	}
	
	if(detectCode) {
		try {
			Components.utils.evalInSandbox(detectCode, this._sandbox);
		} catch(e) {
			this._debug(e+' in parsing detectCode for '+translator.label);
			return;
		}
	}
}

/*
 * generates a sandbox for scraping/scraper detection
 */
Zotero.Translate._searchSandboxRegexp = new RegExp();
Zotero.Translate._searchSandboxRegexp.compile("^http://[\\w.]+/");
Zotero.Translate.prototype._generateSandbox = function() {
	var me = this;
	
	if(this.type == "web" || this.type == "search") {
		// get sandbox URL
		var sandboxLocation = "http://www.example.com/";
		if(this.type == "web") {
			// use real URL, not proxied version, to create sandbox
			sandboxLocation = this.document.defaultView;
			Zotero.debug("Translate: binding sandbox to "+this.document.location.href);
		} else {
			// generate sandbox for search by extracting domain from translator
			// target, if one exists
			if(this.translator && this.translator[0] && this.translator[0].target) {
				// so that web translators work too
				var tempURL = this.translator[0].target.replace(/\\/g, "").replace(/\^/g, "");
				var m = Zotero.Translate._searchSandboxRegexp.exec(tempURL);
				if(m) {
					sandboxLocation = m[0];
				}
			}
			Zotero.debug("Translate: binding sandbox to "+sandboxLocation);
		}
		this._sandbox = new Components.utils.Sandbox(sandboxLocation);
		
		this._sandbox.Zotero = new Object();
		
		// add ingester utilities
		this._sandbox.Zotero.Utilities = new Zotero.Utilities.Ingester(this);
		this._sandbox.Zotero.Utilities.HTTP = new Zotero.Utilities.Ingester.HTTP(this);
		
		// set up selectItems handler
		this._sandbox.Zotero.selectItems = function(options) { return me._selectItems(options) };
	} else {
		// use null URL to create sandbox. no idea why a blank string doesn't
		// work on all installations, but this should fix things.
		this._sandbox = new Components.utils.Sandbox("http://www.example.com/");
		this._sandbox.Zotero = new Object();
		
		this._sandbox.Zotero.Utilities = new Zotero.Utilities();
	}
	
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
			this._sandbox.Zotero.Collection = Zotero.Translate.GenerateZoteroItemClass();
			// attach the function to be run when a collection is done
			this._sandbox.Zotero.Collection.prototype.complete = function() {me._collectionDone(this)};
		}
	}
	
	this._sandbox.XPathResult = Components.interfaces.nsIDOMXPathResult;
	
	// for debug messages
	this._sandbox.Zotero.debug = function(string) {me._debug(string)};
	
	// for adding configuration options
	this._sandbox.Zotero.configure = function(option, value) {me._configure(option, value) };
	// for adding displayed options
	this._sandbox.Zotero.addOption = function(option, value) {me._addOption(option, value) };
	// for getting the value of displayed options
	this._sandbox.Zotero.getOption = function(option) { return me._getOption(option) };

	// for loading other translators and accessing their methods
	this._sandbox.Zotero.loadTranslator = function(type) {
		var translation = new Zotero.Translate(type, false);
		translation._parentTranslator = me;
		
		if(type == "export" && (this.type == "web" || this.type == "search")) {
			throw("for security reasons, web and search translators may not call export translators");
		}
		
		// for security reasons, safeTranslator wraps the translator object.
		// note that setLocation() is not allowed
		var safeTranslator = new Object();
		safeTranslator.setSearch = function(arg) { return translation.setSearch(arg) };
		safeTranslator.setBrowser = function(arg) { return translation.setBrowser(arg) };
		safeTranslator.setHandler = function(arg1, arg2) { translation.setHandler(arg1, arg2) };
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
			
			return translation.translate()
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
 *            using Mozilla's built-in support for RDF data sources
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
	Zotero.debug("Translate: setting configure option "+option+" to "+value);
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
	Zotero.debug("Translate: setting display option "+option+" to "+value);
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
	this._sandbox.Zotero.done = function(val) { me._translationComplete(val) };
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
			Zotero.debug("Translate: could not find a result using "+this.translator[0].label+": \n"
			              +this._generateErrorString(error));
			if(this.translator.length > 1) {
				this.translator.shift();
				this.translate();
			} else {
				// call handlers
				this.runHandler("done", returnValue);
			}
		} else {
			// close open streams
			this._closeStreams();
			
			if(!returnValue) {
				// report error to console
				Components.utils.reportError(error);
				
				// report error to debug log
				var errorString = this._generateErrorString(error);
				this._debug("Translation using "+(this.translator && this.translator[0] && this.translator[0].label ? this.translator[0].label : "no translator")+" failed: \n"+errorString);
				
				if(this.type == "web") {
					// report translation error for webpages
					this._reportTranslationFailure(errorString);
				}
				
				this.runHandler("error", error);
			} else {
				this._debug("Translation successful");
			}
			
			// call handlers
			this.runHandler("done", returnValue);
		}
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
		+ "\nextensions.zotero.cacheTranslatorData => "+Zotero.Prefs.get("cacheTranslatorData")
		// TODO: Currently using automaticSnapshots pref for everything
		// Eventually downloadAssociatedFiles may be a separate pref
		// for PDFs and other large files
		+ "\nextensions.zotero.downloadAssociatedFiles => "+Zotero.Prefs.get("downloadAssociatedFiles");
		+ "\nextensions.zotero.automaticSnapshots => "+Zotero.Prefs.get("automaticSnapshots");
	return errorString.substr(1);
}

/*
 * runs an HTTP request to report a translation error
 */
Zotero.Translate.prototype._reportTranslationFailure = function(errorData) {
	if(this.translator[0].inRepository && Zotero.Prefs.get("reportTranslationFailure")) {
		var postBody = "ids[]="+escape(this.translator[0].translatorID)+
					   "&lastUpdated="+escape(this.translator[0].lastUpdated)+
					   "&extVersion="+escape(Zotero.version)+
					   "&errorData="+escape(errorData);
		Zotero.Utilities.HTTP.doPost("http://www.zotero.org/repo/report", postBody);
	}
}

/*
 * closes open file streams, if any exist
 */
Zotero.Translate.prototype._closeStreams = function() {
	// serialize RDF and unregister dataSource
	if(this._rdf) {
		if(this._rdf.serializer) {
			this._rdf.serializer.Serialize(this._streams[0]);
		}
		
		try {
			if(this._rdf.dataSource) {
				var rdfService = Components.classes["@mozilla.org/rdf/rdf-service;1"].
								 getService(Components.interfaces.nsIRDFService);
				rdfService.UnregisterDataSource(this._rdf.dataSource);
			}
		} catch(e) {}
		
		delete this._rdf.dataSource;
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
		this._IDMap[item.itemID] = newItem.getID();
	}
	// add see alsos
	if(item.seeAlso) {
		for each(var seeAlso in item.seeAlso) {
			if(this._IDMap[seeAlso]) {
				newItem.addSeeAlso(this._IDMap[seeAlso]);
			}
		}
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
	if(this.type == "web") {
		// store repository if this item was captured from a website, and
		// repository is truly undefined (not false or "")
		if(!item.repository && item.repository !== false && item.repository !== "") {
			item.repository = this.translator[0].label;
		}
	}
	
	this._itemsDone = true;
	
	if(!this.saveItem) {	// if we're not supposed to save the item, just
							// return the item array
		
		// if a parent sandbox exists, use complete() function from that sandbox
		if(this._parentTranslator) {
			var pt = this._parentTranslator;
			item.complete = function() { pt._itemDone(this) };
			Zotero.debug("Translate: calling done from parent sandbox");
		}
		this.runHandler("itemDone", item);
		return;
	}
	
	// Get typeID, defaulting to "webpage"
	var type = (item.itemType ? item.itemType : "webpage");
	
	if(type == "note") {	// handle notes differently
		var myID = Zotero.Notes.add(item.note);
		// re-retrieve the item
		var newItem = Zotero.Items.get(myID);
	} else {
		if(!item.title && this.type == "web") {
			throw("item has no title");
		}
		
		// if item was accessed through a proxy, ensure that the proxy
		// address remains in the accessed version
		if(this.locationIsProxied && item.url) {
			item.url = Zotero.Ingester.ProxyMonitor.properToProxy(item.url);
		}
		
		// create new item
		if(type == "attachment") {
			if(this.type != "import") {
				Zotero.debug("Translate: discarding standalone attachment");
				return;
			}
			
			Zotero.debug("Translate: adding attachment");
			
			if(!item.url && !item.path) {
				Zotero.debug("Translate: ignoring attachment: no path or URL specified");
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
					Zotero.debug("Translate: unrecognized protocol "+protocol);
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
					Zotero.debug("Translate: error adding attachment "+item.url);
					return;
				}
				Zotero.debug("Translate: created attachment; id is "+myID);
				var newItem = Zotero.Items.get(myID);
			} else {
				// generate nsIFile
				var IOService = Components.classes["@mozilla.org/network/io-service;1"].
								getService(Components.interfaces.nsIIOService);
				var uri = IOService.newURI(item.path, "", null);
				var file = uri.QueryInterface(Components.interfaces.nsIFileURL).file;
				
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
				newItem.updateNote(item.note);
			}
		} else {
			var typeID = Zotero.ItemTypes.getID(type);
			var newItem = new Zotero.Item(typeID);
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
						var creatorType = 1;
						// try to assign correct creator type
						if(data[j].creatorType) {
							try {
								var creatorType = Zotero.CreatorTypes.getID(data[j].creatorType);
							} catch(e) {
								Zotero.debug("Translate: invalid creator type "+data[j].creatorType+" for creator index "+j);
							}
						}
						
						newItem.setCreator(j, data[j].firstName, data[j].lastName, creatorType);
					}
				} else if(field == "seeAlso") {
					newItem.translateSeeAlso = data;
				} else if(field != "note" && field != "notes" && field != "itemID" &&
						  field != "attachments" && field != "tags" &&
						  (fieldID = Zotero.ItemFields.getID(field))) {
											// if field is in db
					
					// try to map from base field
					if(Zotero.ItemFields.isBaseField(fieldID)) {
						var fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(typeID, fieldID);
						if(fieldID) Zotero.debug("Translate: mapping "+field+" to "+Zotero.ItemFields.getName(fieldID));
					}
					
					// if field is valid for this type, set field
					if(fieldID && Zotero.ItemFields.isValidForType(fieldID, typeID)) {
						newItem.setField(fieldID, data);
					} else {
						Zotero.debug("Translate: discarded field "+field+" for item: field not valid for type "+type);
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
			if(myID == true || !myID) {
				myID = newItem.getID();
			}
		}
		
		// handle notes
		if(item.notes) {
			for each(var note in item.notes) {
				var noteID = Zotero.Notes.add(note.note, myID);
				
				// handle see also
				var myNote = Zotero.Items.get(noteID);
				this._itemTagsAndSeeAlso(note, myNote);
			}
		}
		
		var automaticSnapshots = Zotero.Prefs.get("automaticSnapshots");
		var downloadAssociatedFiles = Zotero.Prefs.get("downloadAssociatedFiles");
		
		// handle attachments
		if(item.attachments && (automaticSnapshots || downloadAssociatedFiles)) {
			for each(var attachment in item.attachments) {
				if(this.type == "web") {
					if(!attachment.url && !attachment.document) {
						Zotero.debug("Translate: not adding attachment: no URL specified");
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
									Zotero.debug("Translate: NOTICE: either mimeType or title is missing; attaching file will be slower");
								}
								
								try {
									Zotero.Attachments.linkFromURL(attachment.url, myID,
											(attachment.mimeType ? attachment.mimeType : undefined),
											(attachment.title ? attachment.title : undefined));
								} catch(e) {
									Zotero.debug("Translate: error adding attachment "+attachment.url);
								}
							}
						} else if(attachment.document
						|| (attachment.mimeType && attachment.mimeType == "text/html")
						|| downloadAssociatedFiles) {
						
							// if snapshot is not explicitly set to false, retrieve snapshot
							if(attachment.document) {
								try {
									Zotero.Attachments.importFromDocument(attachment.document, myID, attachment.title);
								} catch(e) {
									Zotero.debug("Translate: error attaching document");
								}
							// Save attachment if snapshot pref enabled or not HTML
							// (in which case downloadAssociatedFiles applies)
							} else if(automaticSnapshots || !attachment.mimeType
									|| attachment.mimeType != "text/html") {
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
									attachment.url = Zotero.Ingester.ProxyMonitor.properToProxy(attachment.url);
								}

								var fileBaseName = Zotero.Attachments.getFileBaseNameFromItem(myID);
								try {
									Zotero.Attachments.importFromURL(attachment.url, myID, title, fileBaseName);
								} catch(e) {
									Zotero.debug("Zotero.Translate: error adding attachment "+attachment.url);
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
				newItem.addSeeAlso(this._IDMap[seeAlso]);
			}
		}
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
	
	if(!attachedTo) this.runHandler("itemDone", newItem);
	
	delete item;
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
	var myID = newCollection.getID();
	
	this.newCollections.push(myID);
	
	for each(child in collection.children) {
		if(child.type == "collection") {
			// do recursive processing of collections
			this._processCollection(child, myID);
		} else {
			// add mapped items to collection
			if(this._IDMap[child.id]) {
				Zotero.debug("Translate: adding "+this._IDMap[child.id]);
				newCollection.addItem(this._IDMap[child.id]);
			} else {
				Zotero.debug("Translate: could not map "+child.id+" to an imported item");
			}
		}
	}
	
	return newCollection;
}

/*
 * logs a debugging message
 */
Zotero.Translate.prototype._debug = function(string) {
	// if handler does not return anything explicitly false, show debug
	// message in console
	if(this.runHandler("debug", string) !== false) Zotero.debug(string, 4);
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

/*
 * does the actual search translation
 */
Zotero.Translate.prototype._search = function() {
	try {
		this._sandbox.doSearch(this.search);
	} catch(e) {
		this._translationComplete(false, e);
		return false;
	}
	
	return true;
}

/*
 * does the actual import translation
 */
Zotero.Translate.prototype._import = function() {
	this._importConfigureIO();
	
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
	
	return true;
}

/*
 * sets up import for IO
 */
Zotero.Translate.prototype._importConfigureIO = function() {
	if(this._storage) {
		if(this.configOptions.dataMode && this.configOptions.dataMode == "rdf") {
			this._rdf = new Object();
			
			// read string out of storage stream
			var IOService = Components.classes['@mozilla.org/network/io-service;1']
							.getService(Components.interfaces.nsIIOService);
			this._rdf.dataSource = Components.classes["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"].
							createInstance(Components.interfaces.nsIRDFDataSource);
			var parser = Components.classes["@mozilla.org/rdf/xml-parser;1"].
						 createInstance(Components.interfaces.nsIRDFXMLParser);
			
			// get URI and parse
			var baseURI = (this.location ? IOService.newURI(this.location, "utf-8", null) : null);
			parser.parseString(this._rdf.dataSource, baseURI, this._storage);
			
			// make an instance of the RDF handler
			this._sandbox.Zotero.RDF = new Zotero.Translate.RDF(this._rdf.dataSource);
		} else {
			this._storageFunctions(true);
			this._storagePointer = 0;
		}
	} else {
		var me = this;
		
		if(this.configOptions.dataMode && this.configOptions.dataMode == "rdf") {
			if(!this._rdf) {
				this._rdf = new Object()
				
				var IOService = Components.classes['@mozilla.org/network/io-service;1']
								.getService(Components.interfaces.nsIIOService);
				var fileHandler = IOService.getProtocolHandler("file")
								  .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
				var URL = fileHandler.getURLSpecFromFile(this.location);
				
				var RDFService = Components.classes['@mozilla.org/rdf/rdf-service;1']
								 .getService(Components.interfaces.nsIRDFService);
				this._rdf.dataSource = RDFService.GetDataSourceBlocking(URL);
				
				// make an instance of the RDF handler
				this._sandbox.Zotero.RDF = new Zotero.Translate.RDF(this._rdf.dataSource);
			}
		} else {
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
			
			var filePosition = 0;
			var intlStream = this._importDefuseBOM();
			if(intlStream) {
				// found a UTF BOM at the beginning of the file; don't allow
				// translator to set the character set
				this._sandbox.Zotero.setCharacterSet = function() {}
				this._streams.push(intlStream);
			} else {
				// allow translator to set charset
				this._sandbox.Zotero.setCharacterSet = function(charset) {
					// seek
					if(filePosition != 0) {
						me._inputStream.QueryInterface(Components.interfaces.nsISeekableStream)
									 .seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, filePosition);
						me._inputStream.QueryInterface(Components.interfaces.nsIFileInputStream);
					}
					
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
						filePosition += amountRead;
						return str.value;
					} else {
						return false;
					}
				}
			} else {										// block reading
				var sStream;
				
				this._sandbox.Zotero.read = function(amount) {
					if(intlStream) {
						// read from international stream, if one is available
						var amountRead = intlStream.readString(amount, str);
						
						if(amountRead) {
							filePosition += amountRead;
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
						}
						
						// read from the scriptable input stream
						var string = sStream.read(amount);
						filePosition += string.length;
						return string;
					}
				}
				
				// attach sStream to stack of streams to close
				this._streams.push(sStream);
			}
		}
	}
}

/*
 * searches for a UTF BOM at the beginning of the input stream. if one is found,
 * returns an appropriate converter-input-stream for the UTF type, and sets
 * _hasBOM to the UTF type.  if one is not found, returns false, and sets
 * _hasBOM to false to prevent further checking.
 */
Zotero.Translate.prototype._importDefuseBOM = function() {
	// if already found not to have a BOM, skip
	if(this._hasBOM === false) {
		return;
	}
	
	if(!this._hasBOM) {
		// if not checked for a BOM, open a binary input stream and read
		var binStream = Components.classes["@mozilla.org/binaryinputstream;1"].
		                           createInstance(Components.interfaces.nsIBinaryInputStream);
		binStream.setInputStream(this._inputStream);
		
		// read the first byte
		var byte1 = binStream.read8();
		
		// at the moment, we don't support UTF-32 or UTF-7. while mozilla
		// supports these encodings, they add slight additional complexity to
		// the function and anyone using them for storing bibliographic metadata
		// is insane.
		if(byte1 == 0xEF) {			// UTF-8: EF BB BF
			var byte2 = binStream.read8();
			if(byte2 == 0xBB) {
				var byte3 = binStream.read8();
				if(byte3 == 0xBF) {
					this._hasBOM = "UTF-8";
				}
			}
		} else if(byte1 == 0xFE) {	// UTF-16BE: FE FF
			var byte2 = binStream.read8();
			if(byte2 == 0xFF) {
				this._hasBOM = "UTF-16BE";
			}
		} else if(byte1 == 0xFF) {	// UTF-16LE: FF FE
			var byte2 = binStream.read8();
			if(byte2 == 0xFE) {
				this._hasBOM = "UTF16-LE";
			}
		}
		
		if(!this._hasBOM) {
			// seek back to begining of file
			this._inputStream.QueryInterface(Components.interfaces.nsISeekableStream)
						     .seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, 0);
			this._inputStream.QueryInterface(Components.interfaces.nsIFileInputStream);
			
			// say there's no BOM
			this._hasBOM = false;
			
			return false;
		}
	} else {
		// if it had a BOM the last time, it has one this time, too. seek to the
		// correct position.
		
		if(this._hasBOM == "UTF-8") {
			var seekPosition = 3;
		} else {
			var seekPosition = 2;
		}
		
		this._inputStream.QueryInterface(Components.interfaces.nsISeekableStream)
					     .seek(Components.interfaces.nsISeekableStream.NS_SEEK_SET, seekPosition);
		this._inputStream.QueryInterface(Components.interfaces.nsIFileInputStream);
	}
	
	// if we know what kind of BOM it has, generate an input stream	
	var intlStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
						   .createInstance(Components.interfaces.nsIConverterInputStream);
	intlStream.init(this._inputStream, this._hasBOM, 65535,
		Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
	return intlStream;
}

/*
 * does the actual export, after code has been loaded and parsed
 */
Zotero.Translate.prototype._export = function() {
	
	if(this.items) {
		// if just items, get them and don't worry about collection logic
		this._itemsLeft = this.items;
	} else if(this.collection) {
		// get items in this collection
		this._itemsLeft = this.collection.getChildItems();
		
		if(this.configOptions.getCollections) {
			// get child collections
			this._collectionsLeft = Zotero.getCollections(this.collection.getID(), true);
			// get items in child collections
			for each(var collection in this._collectionsLeft) {
				this._itemsLeft = this._itemsLeft.concat(collection.getChildItems());
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
			this.location.remove(false);
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

/*
 * configures IO for export
 */
Zotero.Translate.prototype._exportConfigureIO = function() {
	if(this.location) {
		// open file
		var fStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
								 .createInstance(Components.interfaces.nsIFileOutputStream);
		fStream.init(this.location, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate
		// attach to stack of streams to close at the end
		this._streams.push(fStream);
		
		if(this.configOptions.dataMode && this.configOptions.dataMode == "rdf") {	// rdf io
			this._rdf = new Object();
			
			// create data source
			this._rdf.dataSource = Components.classes["@mozilla.org/rdf/datasource;1?name=xml-datasource"].
							 createInstance(Components.interfaces.nsIRDFDataSource);
			// create serializer
			this._rdf.serializer = Components.classes["@mozilla.org/rdf/xml-serializer;1"].
							 createInstance(Components.interfaces.nsIRDFXMLSerializer);
			this._rdf.serializer.init(this._rdf.dataSource);
			this._rdf.serializer.QueryInterface(Components.interfaces.nsIRDFXMLSource);
			
			// make an instance of the RDF handler
			this._sandbox.Zotero.RDF = new Zotero.Translate.RDF(this._rdf.dataSource, this._rdf.serializer);
		} else {
			// regular io; write just writes to file
			var intlStream = null;
			
			// allow setting of character sets
			this._sandbox.Zotero.setCharacterSet = function(charset) {
				intlStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
									   .createInstance(Components.interfaces.nsIConverterOutputStream);
				intlStream.init(fStream, charset, 1024, "?".charCodeAt(0));
			};
			
			this._sandbox.Zotero.write = function(data) {
				if(intlStream) {
					intlStream.writeString(data);
				} else {
					fStream.write(data, data.length);
				}
			};
		}
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
			directory.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0700);
			// copy file
			try {
				file.copyTo(directory, attachmentArray.filename);
			} catch(e) {
				attachmentArray.path = undefined;
			}
		} else {
			// copy imported files from the Zotero directory
			var directory = Zotero.getStorageDirectory();
			directory.append(attachmentArray.itemID);
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
	var itemTypeID = returnItem.getType();
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
		return returnItem.toArray();
	}
}

/*
 * sets up internal IO in such a way that both reading and writing are possible
 * (for inter-scraper communications)
 */
Zotero.Translate.prototype._initializeInternalIO = function() {
	if(this.type == "import" || this.type == "export") {
		if(this.configOptions.dataMode && this.configOptions.dataMode == "rdf") {
			this._rdf = new Object();
			// use an in-memory data source for internal IO
			this._rdf.dataSource = Components.classes["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"].
							 createInstance(Components.interfaces.nsIRDFDataSource);
			
			// make an instance of the RDF handler
			this._sandbox.Zotero.RDF = new Zotero.Translate.RDF(this._rdf.dataSource);
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
			if(translator.webRegexp) {
				var regularExpression = translator.webRegexp;
			} else {
				var regularExpression = new RegExp(translator.target, "i");
			}
		} else {
			if(translator.importRegexp) {
				var regularExpression = translator.importRegexp;
			} else {
				var regularExpression = new RegExp("\\."+translator.target+"$", "i");
			}
		}
		
		if(regularExpression.test(this.translate.path)) {
			checkDetectCode = true;
		}
		
		if(this.ignoreExtensions) {
			// if we're ignoring extensions, that means we already tried
			// everything without ignoring extensions and it didn't work
			checkDetectCode = !checkDetectCode;
			
			// if a translator has no detectCode, don't offer it as an option
			if(translator.noDetectCode) {
				this.execute();
				return;
			}
		}
	}
	
	// Test with JavaScript if available and didn't have a regular expression or
	// passed regular expression test
	if(checkDetectCode) {
	  	// parse the detect code and execute
		this.translate._parseDetectCode(translator);
		
		if(this.translate.type == "import") {
			try {
				this.translate._importConfigureIO();	// so it can read
			} catch(e) {
				Zotero.debug("Translate: "+e+' in opening IO for '+translator.label);
				this.execute();
				return;
			}
		}
		
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
			
			Zotero.debug("Translate: executed detectCode for "+translator.label);
					
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
	Zotero.debug("Translate: found translator "+translator.label);
	
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
		this.translate._debug("detectCode for "+(this.currentTranslator ? this.currentTranslator.label : "no translator")+" failed: \n"+errorString);
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
	var ZoteroCollection = Zotero.Translate.ZoteroCollection = function() {};
	
	return ZoteroCollection;
}

/* Zotero.Translate.RDF: a class for handling RDF IO
 *
 * If an import/export translator specifies dataMode RDF, this is the interface,
 * accessible from model.
 * 
 * In order to simplify things, all classes take in their resource/container
 * as either the Mozilla native type or a string, but all
 * return resource/containers as Mozilla native types (use model.toString to
 * convert)
 */

Zotero.Translate.RDF = function(dataSource, serializer) {
	this._RDFService = Components.classes['@mozilla.org/rdf/rdf-service;1']
					 .getService(Components.interfaces.nsIRDFService);
	this._AtomService = Components.classes["@mozilla.org/atom-service;1"]
					 .getService(Components.interfaces.nsIAtomService);
	this._RDFContainerUtils = Components.classes["@mozilla.org/rdf/container-utils;1"]
							.getService(Components.interfaces.nsIRDFContainerUtils);
	
	this._dataSource = dataSource;
	this._serializer = serializer;
}

// turn an nsISimpleEnumerator into an array
Zotero.Translate.RDF.prototype._deEnumerate = function(enumerator) {
	if(!(enumerator instanceof Components.interfaces.nsISimpleEnumerator)) {
		return false;
	}
	
	var resources = new Array();
	
	while(enumerator.hasMoreElements()) {
		var resource = enumerator.getNext();
		try {
			resource.QueryInterface(Components.interfaces.nsIRDFLiteral);
			resources.push(resource.Value);
		 } catch(e) {
			resource.QueryInterface(Components.interfaces.nsIRDFResource);
			resources.push(resource);
		 }
	}
	
	if(resources.length) {
		return resources;
	} else {
		return false;
	}
}

// get a resource as an nsIRDFResource, instead of a string
Zotero.Translate.RDF.prototype._getResource = function(about) {
	try {
		if(!(about instanceof Components.interfaces.nsIRDFResource)) {
			about = this._RDFService.GetResource(about);
		}
	} catch(e) {
		throw("Zotero.Translate.RDF: Invalid RDF resource: "+about);
	}
	return about;
}

// USED FOR OUTPUT

// writes an RDF triple
Zotero.Translate.RDF.prototype.addStatement = function(about, relation, value, literal) {
	about = this._getResource(about);
	
	if(!(value instanceof Components.interfaces.nsIRDFResource)) {
		if(literal) {
			// zap chars that Mozilla will mangle
			if(typeof(value) == "string") {
				value = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
			}
			
			try {
				value = this._RDFService.GetLiteral(value);
			} catch(e) {
				throw "Zotero.Translate.RDF.addStatement: Could not convert to literal";
			}
		} else {
			try {
				value = this._RDFService.GetResource(value);
			} catch(e) {
				throw "Zotero.Translate.RDF.addStatement: Could not convert to resource";
			}
		}
	}
	
	this._dataSource.Assert(about, this._RDFService.GetResource(relation), value, true);
}
		
// creates an anonymous resource
Zotero.Translate.RDF.prototype.newResource = function() {
	return this._RDFService.GetAnonymousResource()
};
		
// creates a new container
Zotero.Translate.RDF.prototype.newContainer = function(type, about) {
	about = this._getResource(about);
	
	type = type.toLowerCase();
	if(type == "bag") {
		return this._RDFContainerUtils.MakeBag(this._dataSource, about);
	} else if(type == "seq") {
		return this._RDFContainerUtils.MakeSeq(this._dataSource, about);
	} else if(type == "alt") {
		return this._RDFContainerUtils.MakeAlt(this._dataSource, about);
	} else {
		throw "Invalid container type in model.newContainer";
	}
}

// adds a new container element (index optional)
Zotero.Translate.RDF.prototype.addContainerElement = function(about, element, literal, index) {
	if(!(about instanceof Components.interfaces.nsIRDFContainer)) {
		about = this._getResource(about);
		var container = Components.classes["@mozilla.org/rdf/container;1"].
						createInstance(Components.interfaces.nsIRDFContainer);
		container.Init(this._dataSource, about);
		about = container;
	}
	if(!(element instanceof Components.interfaces.nsIRDFResource)) {
		if(literal) {
			element = this._RDFService.GetLiteral(element);
		} else {
			element = this._RDFService.GetResource(element);
		}
	}
	
	if(index) {
		about.InsertElementAt(element, index, true);
	} else {
		about.AppendElement(element);
	}
}

// gets container elements as an array
Zotero.Translate.RDF.prototype.getContainerElements = function(about) {
	if(!(about instanceof Components.interfaces.nsIRDFContainer)) {
		about = this._getResource(about);
		var container = Components.classes["@mozilla.org/rdf/container;1"].
						createInstance(Components.interfaces.nsIRDFContainer);
		container.Init(this._dataSource, about);
		about = container;
	}
	
	return this._deEnumerate(about.GetElements());
}

// sets a namespace
Zotero.Translate.RDF.prototype.addNamespace = function(prefix, uri) {
	if(this._serializer) {	// silently fail, in case the reason the scraper
							// is failing is that we're using internal IO
		this._serializer.addNameSpace(this._AtomService.getAtom(prefix), uri);
	}
}

// gets a resource's URI
Zotero.Translate.RDF.prototype.getResourceURI = function(resource) {
	if(typeof(resource) == "string") {
		return resource;
	}
	
	resource.QueryInterface(Components.interfaces.nsIRDFResource);
	return resource.ValueUTF8;
}

// USED FOR INPUT

// gets all RDF resources
Zotero.Translate.RDF.prototype.getAllResources = function() {
	var resourceEnumerator = this._dataSource.GetAllResources();
	return this._deEnumerate(resourceEnumerator);
}

// gets arcs going in
Zotero.Translate.RDF.prototype.getArcsIn = function(resource) {
	resource = this._getResource(resource);
	
	var arcEnumerator = this._dataSource.ArcLabelsIn(resource);
	return this._deEnumerate(arcEnumerator);
}

// gets arcs going out
Zotero.Translate.RDF.prototype.getArcsOut = function(resource) {
	resource = this._getResource(resource);
	
	var arcEnumerator = this._dataSource.ArcLabelsOut(resource);
	return this._deEnumerate(arcEnumerator);
}

// gets source resources
Zotero.Translate.RDF.prototype.getSources = function(resource, property) {
	property = this._getResource(property);
	resource = this._getResource(resource);
	
	var enumerator = this._dataSource.GetSources(property, resource, true);
	return this._deEnumerate(enumerator);
}

// gets target resources
Zotero.Translate.RDF.prototype.getTargets = function(resource, property) {
	property = this._getResource(property);
	resource = this._getResource(resource);
	
	var enumerator = this._dataSource.GetTargets(resource, property, true);
	return this._deEnumerate(enumerator);
}