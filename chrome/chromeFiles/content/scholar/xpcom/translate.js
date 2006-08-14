// Scholar for Firefox Translate
// Utilities based on code taken from Piggy Bank 2.1.1 (BSD-licensed)
// This code is licensed according to the GPL

/*
 * Scholar.Translate: a class for translation of Scholar metadata from and to
 * other formats
 *
 * eventually, Scholar.Ingester may be rolled in here (i.e., after we get rid
 * of RDF)
 *
 * type can be: 
 * export
 * import
 * web
 * search
 *
 * a typical export process:
 * var translatorObj = new Scholar.Translate();
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
 * browser - the browser object to be used for web scraping (read-only; set
 *           with setBrowser)
 * translator - the translator currently in use (read-only; set with
 *               setTranslator)
 * location - the location of the target (read-only; set with setLocation)
 *            for import/export - this is an instance of nsILocalFile
 *            for web - this is a URL
 * search - item (in toArray() format) to extrapolate data for (read-only; set
 *          with setSearch).
 * items - items (in Scholar.Item format) to be exported. if this is empty,
 *         Scholar will export all items in the library (read-only; set with
 *         setItems). setting items disables export of collections.
 * path - the path to the target; for web, this is the same as location
 * string - the string content to be used as a file.
 * saveItem - whether new items should be saved to the database. defaults to
 *            true; set using second argument of constructor.
 *
 * PRIVATE PROPERTIES:
 * 
 * _numericTypes - possible numeric types as a comma-delimited string
 * _handlers - handlers for various events (see setHandler)
 * _configOptions - options set by translator modifying behavior of
 *                  Scholar.Translate
 * _displayOptions - options available to user for this specific translator
 * _waitForCompletion - whether to wait for asynchronous completion, or return
 *                      immediately when script has finished executing
 * _sandbox - sandbox in which translators will be executed
 * _streams - streams that need to be closed when execution is complete
 * _IDMap - a map from IDs as specified in Scholar.Item() to IDs of actual items
 * _parentTranslator - set when a translator is called from another translator. 
 *                     among other things, disables passing of the translate
 *                     object to handlers and modifies complete() function on 
 *                     returned items
 * _storageStream - the storage stream to be used, if one is configured
 * _storageStreamLength - the length of the storage stream
 *
 * WEB-ONLY PRIVATE PROPERTIES:
 *
 * _locationIsProxied - whether the URL being scraped is going through
 *                      an EZProxy
 */

Scholar.Translate = function(type, saveItem) {
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
 * sets the browser to be used for web translation; also sets the location
 */
Scholar.Translate.prototype.setBrowser = function(browser) {
	this.browser = browser;
	this.setLocation(browser.contentDocument.location.href);
}

/*
 * sets the item to be used for searching
 */
Scholar.Translate.prototype.setSearch = function(search) {
	this.search = search;
}

/*
 * sets the item to be used for export
 */
Scholar.Translate.prototype.setItems = function(items) {
	this.items = items;
}

/*
 * sets the location to operate upon (file should be an nsILocalFile object or
 * web address)
 */
Scholar.Translate.prototype.setLocation = function(location) {
	if(this.type == "web") {
		// account for proxies
		this.location = Scholar.Ingester.ProxyMonitor.proxyToProper(location);
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
Scholar.Translate.prototype.setString = function(string) {
	this.string = string;
	this._createStorageStream();
	
	Scholar.debug(string);
	this._storageStreamLength = string.length;
	
	// write string
	var fStream = this._storageStream.getOutputStream(0);
	fStream.write(string, this._storageStreamLength);
	fStream.close();
}

/*
 * sets the translator to be used for import/export
 *
 * accepts either the object from getTranslators() or an ID
 */
Scholar.Translate.prototype.setTranslator = function(translator) {
	if(!translator) {
		throw("cannot set translator: invalid value");
	}
	
	if(typeof(translator) == "object") {	// passed an object and not an ID
		if(translator.translatorID) {
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
	
	var where = "";
	for(var i in translator) {
		where += " OR translatorID = ?";
	}
	where = where.substr(4);
	
	var sql = "SELECT * FROM translators WHERE "+where+" AND type IN ("+this._numericTypes+")";
	this.translator = Scholar.DB.query(sql, translator);
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
 * options
 *   valid: export
 *   called: when options requiring user interaction are available
 *   passed: an associative array of options and default values
 *   returns: an associative array of options
 *
 * select
 *   valid: web
 *   called: when the user needs to select from a list of available items
 *   passed: an associative array in the form id => text
 *   returns: a numerically indexed array of ids, as extracted from the passed
 *            string
 *
 * itemCount
 *   valid: export
 *   called: when the export 
 *   passed: the number of items to be processed
 *   returns: N/A
 *
 * itemDone
 *   valid: import, web, search
 *   called: when an item has been processed; may be called asynchronously
 *   passed: an item object (see Scholar.Item)
 *   returns: N/A
 *
 * collectionDone
 *   valid: import
 *   called: when a collection has been processed, after all items have been
 *           added; may be called asynchronously
 *   passed: a collection object (see Scholar.Collection)
 *   returns: N/A
 * 
 * done
 *   valid: all
 *   called: when all processing is finished
 *   passed: true if successful, false if an error occurred
 *   returns: N/A
 */
Scholar.Translate.prototype.setHandler = function(type, handler) {
	if(!this._handlers[type]) {
		this._handlers[type] = new Array();
	}
	this._handlers[type].push(handler);
}

/*
 * gets all applicable translators
 *
 * for import, you should call this after setFile; otherwise, you'll just get
 * a list of all import filters, not filters equipped to handle a specific file
 *
 * this returns a list of translator objects, of which the following fields
 * are useful:
 *
 * translatorID - the GUID of the translator
 * label - the name of the translator
 * itemType - the type of item this scraper says it will scrape
 */
Scholar.Translate.prototype.getTranslators = function() {
	var sql = "SELECT translatorID, label, target, detectCode FROM translators WHERE type IN ("+this._numericTypes+") ORDER BY target IS NULL";
	var translators = Scholar.DB.query(sql);
	
	if(!this.location && !this.search) {
		return translators;		// no need to see which can translate, because
								// we don't have a location yet (for export or
								// import dialog)
	} else {
		// create a new sandbox
		this._generateSandbox();
		
		var possibleTranslators = new Array();
		Scholar.debug("searching for translators for "+this.path);
		
		// see which translators can translate
		var possibleTranslators = this._findTranslators(translators);
		
		return possibleTranslators;
	}
}

/*
 * finds applicable translators from a list. if the second argument is given,
 * extension-based exclusion is inverted, so that only detectCode is used to
 * determine if a translator can be run.
 */
Scholar.Translate.prototype._findTranslators = function(translators, ignoreExtensions) {
	var possibleTranslators = new Array();
	for(var i in translators) {
		if(this._canTranslate(translators[i], ignoreExtensions)) {
			Scholar.debug("found translator "+translators[i].label);
			
			// for some reason, and i'm not quite sure what this reason is,
			// we HAVE to do this to get things to work right; we can't
			// just push a normal translator object from an SQL statement
			var translator = {translatorID:translators[i].translatorID,
					label:translators[i].label,
					target:translators[i].target,
					itemType:translators[i].itemType}
			
			possibleTranslators.push(translator);
		}
	}
	if(!possibleTranslators.length && this.type == "import" && !ignoreExtensions) {
		Scholar.debug("looking a second time");
		// try search again, ignoring file extensions
		return this._findTranslators(translators, true);
	}
	return possibleTranslators;
}

/*
 * loads a translator into a sandbox
 */
Scholar.Translate.prototype._loadTranslator = function() {
	if(!this._sandbox || this.type == "search") {
		// create a new sandbox if none exists, or for searching (so that it's
		// bound to the correct url)
		this._generateSandbox();
	}
	
	// parse detect code for the translator
	this._parseDetectCode(this.translator[0]);
	
	Scholar.debug("parsing code for "+this.translator[0].label);
	
	try {
		Components.utils.evalInSandbox(this.translator[0].code, this._sandbox);
	} catch(e) {
		Scholar.debug(e+' in parsing code for '+this.translator[0].label);
		this._translationComplete(false);
		return false;
	}
	
	return true;
}

/*
 * does the actual translation
 */
Scholar.Translate.prototype.translate = function() {
	this._IDMap = new Array();
	this._complete = false;
	
	if(!this.translator || !this.translator.length) {
		throw("cannot translate: no translator specified");
	}
	
	if(!this.location && this.type != "search") {
		// searches operate differently, because we could have an array of
		// translators and have to go through each
		throw("cannot translate: no location specified");
	}
	
	if(!this._loadTranslator()) {
		return;
	}
	
	
	// hack to see if there are any options, bc length does not work on objects
	for(var i in this._displayOptions) {
		// run handler for options if there are any
		if(!(this._displayOptions = this._runHandler("options", this._displayOptions))) {
			this._translationComplete(true);
			return false;
		}
		break;
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
	
	if(!returnValue) {
		// failure
		this._translationComplete(false);
	} else if(!this._waitForCompletion) {
		// if synchronous, call _translationComplete();
		this._translationComplete(true);
	}
}

/*
 * generates a sandbox for scraping/scraper detection
 */
Scholar.Translate._searchSandboxRegexp = new RegExp();
Scholar.Translate._searchSandboxRegexp.compile("^http://[\\w.]+/");
Scholar.Translate.prototype._generateSandbox = function() {
	var me = this;
	
	if(this.type == "web" || this.type == "search") {
		// get sandbox URL
		var sandboxURL = "";
		if(this.type == "web") {
			// use real URL, not proxied version, to create sandbox
			sandboxURL = this.browser.contentDocument.location.href;
		} else {
			// generate sandbox for search by extracting domain from translator
			// target, if one exists
			if(this.translator && this.translator[0] && this.translator[0].target) {
				// so that web translators work too
				var tempURL = this.translator[0].target.replace(/\\/g, "").replace(/\^/g, "");
				var m = Scholar.Translate._searchSandboxRegexp.exec(tempURL);
				if(m) {
					sandboxURL = m[0];
				}
			} 
		}
		Scholar.debug("binding sandbox to "+sandboxURL);
		this._sandbox = new Components.utils.Sandbox(sandboxURL);
		this._sandbox.Scholar = new Object();
		
		// add ingester utilities
		this._sandbox.Scholar.Utilities = new Scholar.Utilities.Ingester(this.locationIsProxied);
		this._sandbox.Scholar.Utilities.HTTP = new Scholar.Utilities.Ingester.HTTP(this.locationIsProxied);
		
		// set up selectItems handler
		this._sandbox.Scholar.selectItems = function(options) { return me._selectItems(options) };
	} else {
		// use null URL to create sandbox
		this._sandbox = new Components.utils.Sandbox("");
		this._sandbox.Scholar = new Object();
		
		this._sandbox.Scholar.Utilities = new Scholar.Utilities();
	}
	
	
	if(this.type == "export") {
		// add routines to retrieve items and collections
		this._sandbox.Scholar.nextItem = function() { return me._exportGetItem() };
		this._sandbox.Scholar.nextCollection = function() { return me._exportGetCollection() }
	} else {
		// add routines to add new items
		this._sandbox.Scholar.Item = Scholar.Translate.ScholarItem;
		// attach the function to be run when an item is done
		this._sandbox.Scholar.Item.prototype.complete = function() {me._itemDone(this)};
		
		if(this.type == "import") {
			// add routines to add new collections
			this._sandbox.Scholar.Collection = Scholar.Translate.ScholarCollection;
			// attach the function to be run when a collection is done
			this._sandbox.Scholar.Collection.prototype.complete = function() {me._collectionDone(this)};
		}
	}
	
	this._sandbox.XPathResult = Components.interfaces.nsIDOMXPathResult;
	
	// for asynchronous operation, use wait()
	// done() is implemented after wait() is called
	this._sandbox.Scholar.wait = function() { me._enableAsynchronous() };
	// for adding configuration options
	this._sandbox.Scholar.configure = function(option, value) {me._configure(option, value) };
	// for adding displayed options
	this._sandbox.Scholar.addOption = function(option, value) {me._addOption(option, value) };
	// for getting the value of displayed options
	this._sandbox.Scholar.getOption = function(option) { return me._getOption(option) };
	
	// for loading other translators and accessing their methods
	this._sandbox.Scholar.loadTranslator = function(type, translatorID) {
		var translation = new Scholar.Translate(type, (translatorID ? true : false));
		if(translatorID) {
			// assign same handlers as for parent, because the done handler won't
			// get called anyway, and the itemDone/selectItems handlers should be
			// the same
			translation._handlers = me._handlers;
			// set the translator
			translation.setTranslator(translatorID);
			// load the translator into our sandbox
			translation._loadTranslator();
			// use internal io
			translation._initializeInternalIO();
			return translation._sandbox;
		} else {
			// create a safe translator object, so that scrapers can't get
			// access to potentially harmful methods.
			if(type == "import" || type == "export") {
				throw("you must specify a translatorID for "+type+" translation");
			}
			
			var safeTranslator = new Object();
			safeTranslator.setItem = function(arg) { return translation.setItem(arg) };
			safeTranslator.setBrowser = function(arg) { return translation.setBrowser(arg) };
			safeTranslator.setHandler = function(arg1, arg2) { translation.setHandler(arg1, arg2) };
			safeTranslator.setString = function(arg) { translation.setString(arg) };
			safeTranslator.setTranslator = function(arg) { return translation.setTranslator(arg) };
			safeTranslator.getTranslators = function() { return translation.getTranslators() };
			safeTranslator.translate = function() { return translation.translate() };
			translation._parentTranslator = me;
			
			return safeTranslator;
		}
	}
}

/*
 * Check to see if _scraper_ can scrape this document
 */
Scholar.Translate.prototype._canTranslate = function(translator, ignoreExtensions) {	
	// Test location with regular expression
	// If this is slow, we could preload all scrapers and compile regular
	// expressions, so each check will be faster
	if(translator.target && this.type != "search") {
		var canTranslate = false;
		if(this.type == "web") {
			var regularExpression = new RegExp(translator.target, "i");
		} else {
			var regularExpression = new RegExp("\."+translator.target+"$", "i");
		}
		
		if(regularExpression.test(this.path)) {
			canTranslate = true;
		}
		
		if(ignoreExtensions) {
			// if we're ignoring extensions, that means we already tried
			// everything without ignoring extensions and it didn't work
			canTranslate = !canTranslate;
			
			// if a translator has no detectCode, don't offer it as an option
			if(!translator.detectCode) {
				return false;
			}
		}
	} else {
		var canTranslate = true;
	}
	
	// Test with JavaScript if available and didn't have a regular expression or
	// passed regular expression test
	if((!translator.target || canTranslate)
	  && translator.detectCode) {
	  	// parse the detect code and execute
		this._parseDetectCode(translator);
		
		if(this.type == "import") {
			try {
				this._importConfigureIO();	// so it can read
			} catch(e) {
				Scholar.debug(e+' in opening IO for '+translator.label);
				return false;
			}
		}
		
		if((this.type == "web" && this._sandbox.detectWeb) ||
		   (this.type == "search" && this._sandbox.detectSearch) ||
		   (this.type == "import" && this._sandbox.detectImport) ||
		   (this.type == "export" && this._sandbox.detectExport)) {
			var returnValue;
			
			try {
				if(this.type == "web") {
					returnValue = this._sandbox.detectWeb(this.browser.contentDocument, this.location);
				} else if(this.type == "search") {
					returnValue = this._sandbox.detectSearch(this.search);
				} else if(this.type == "import") {
					returnValue = this._sandbox.detectImport();
				} else if(this.type == "export") {
					returnValue = this._sandbox.detectExport();
				}
			} catch(e) {
				Scholar.debug(e+' in executing detectCode for '+translator.label);
				return false;
			}
			
			Scholar.debug("executed detectCode for "+translator.label);
					
			// detectCode returns text type
			if(returnValue) {
				canTranslate = true;
				
				if(typeof(returnValue) == "string") {
					translator.itemType = returnValue;
				}
			} else {
				canTranslate = false;
			}
		}
	}
	
	return canTranslate;
}
Scholar.Translate.prototype._parseDetectCode = function(translator) {
	this._configOptions = new Array();
	this._displayOptions = new Array();
	
	if(translator.detectCode) {
		try {
			Components.utils.evalInSandbox(translator.detectCode, this._sandbox);
		} catch(e) {
			Scholar.debug(e+' in parsing detectCode for '+translator.label);
			return;
		}
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
 *   options: rdf, text
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
Scholar.Translate.prototype._configure = function(option, value) {
	this._configOptions[option] = value;
	Scholar.debug("setting configure option "+option+" to "+value);
}

/*
 * adds translator options to be displayed in a dialog
 *
 * called as addOption() in detect code
 *
 */
Scholar.Translate.prototype._addOption = function(option, value) {
	this._displayOptions[option] = value;
	Scholar.debug("setting display option "+option+" to "+value);
}

/*
 * gets translator options that were displayed in a dialog
 *
 * called as getOption() in detect code
 *
 */
Scholar.Translate.prototype._getOption = function(option) {
	return this._displayOptions[option];
}

/*
 * makes translation API wait until done() has been called from the translator
 * before executing _translationComplete
 * 
 * called as wait() in translator code
 */
Scholar.Translate.prototype._enableAsynchronous = function() {
	var me = this;
	this._waitForCompletion = true;
	this._sandbox.Scholar.done = function() { me._translationComplete(true) };
}

/*
 * lets user pick which items s/he wants to put in his/her library
 * 
 * called as selectItems() in translator code
 */
Scholar.Translate.prototype._selectItems = function(options) {
	if(this._handlers.select) {
		return this._runHandler("select", options);
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
Scholar.Translate.prototype._translationComplete = function(returnValue) {
	// to make sure this isn't called twice
	if(!this._complete) {
		this._complete = true;
		
		if(this.type == "search" && !this._itemsFound && this.translator.length > 1) {
			// if we're performing a search and didn't get any results, go on
			// to the next translator
			this.translator.shift();
			this.translate();
		} else {
			Scholar.debug("translation complete");
			
			// serialize RDF and unregister dataSource
			if(this._rdf) {
				if(this._rdf.serializer) {
					this._rdf.serializer.Serialize(this._streams[0]);
				}
				
				try {
					var rdfService = Components.classes["@mozilla.org/rdf/rdf-service;1"].
									 getService(Components.interfaces.nsIRDFService);
					rdfService.UnregisterDataSource(this._rdf.dataSource);
				} catch(e) {
					Scholar.debug("could not unregister data source");
				}
				
				delete this._rdf.dataSource;
			}
			
			// close open streams
			this._closeStreams();
			
			// call handlers
			this._runHandler("done", returnValue);
		}
	}
}

/*
 * closes open file streams, if any exist
 */
Scholar.Translate.prototype._closeStreams = function() {
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
}

/*
 * executed when an item is done and ready to be loaded into the database
 */
Scholar.Translate.prototype._itemDone = function(item) {
	Scholar.debug(item);
	if(!this.saveItem) {	// if we're not supposed to save the item, just
							// return the item array
		
		// if a parent sandbox exists, use complete() function from that sandbox
		if(this._parentTranslator) {
			var pt = this._parentTranslator;
			item.complete = function() { pt._itemDone(this) };
			Scholar.debug("done from parent sandbox");
		}
		this._runHandler("itemDone", item);
		return;
	}
	
	// Get typeID, defaulting to "website"
	var type = (item.itemType ? item.itemType : "website");
	
	if(type == "note") {	// handle notes differently
		var myID = Scholar.Notes.add(item.note);
		// re-retrieve the item
		var newItem = Scholar.Items.get(myID);
	} else {
		// create new item
		var typeID = Scholar.ItemTypes.getID(type);
		var newItem = Scholar.Items.getNewItemByType(typeID);
		
		// makes looping through easier
		item.itemType = item.complete = undefined;
		
		var fieldID, field;
		for(var i in item) {
			// loop through item fields
			data = item[i];
			
			if(data) {						// if field has content
				if(i == "creators") {		// creators are a special case
					for(var j in data) {
						var creatorType = 1;
						// try to assign correct creator type
						if(data[j].creatorType) {
							try {
								var creatorType = Scholar.CreatorTypes.getID(data[j].creatorType);
							} catch(e) {
								Scholar.debug("invalid creator type "+data[j].creatorType+" for creator index "+j);
							}
						}
						
						newItem.setCreator(j, data[j].firstName, data[j].lastName, creatorType);
					}
				} else if(i == "title") {	// skip checks for title
					newItem.setField(i, data);
				} else if(i == "tags") {	// add tags
					for(var j in data) {
						newItem.addTag(data[j]);
					}
				} else if(i == "seeAlso") {
					newItem.translateSeeAlso = data;
				} else if(i != "note" && i != "notes" && i != "itemID" && (fieldID = Scholar.ItemFields.getID(i))) {
											// if field is in db
					if(Scholar.ItemFields.isValidForType(fieldID, typeID)) {
											// if field is valid for this type
						// add field
						newItem.setField(i, data);
					} else {
						Scholar.debug("discarded field "+i+" for item: field not valid for type "+type);
					}
				} else {
					Scholar.debug("discarded field "+i+" for item: field does not exist");
				}
			}
		}
		
		// save item
		var myID = newItem.save();
		if(myID == true) {
			myID = newItem.getID();
		}
		
		// handle notes
		if(item.notes) {
			for each(var note in item.notes) {
				var noteID = Scholar.Notes.add(note.note, myID);
				
				// handle see also
				if(note.seeAlso) {
					var myNote = Scholar.Items.get(noteID);
					
					for each(var seeAlso in note.seeAlso) {
						if(this._IDMap[seeAlso]) {
							myNote.addSeeAlso(this._IDMap[seeAlso]);
						}
					}
				}
			}
		}
	}
	
	if(item.itemID) {
		this._IDMap[item.itemID] = myID;
	}
	
	// handle see also
	if(item.seeAlso) {
		for each(var seeAlso in item.seeAlso) {
			if(this._IDMap[seeAlso]) {
				newItem.addSeeAlso(this._IDMap[seeAlso]);
			}
		}
	}
	
	delete item;
	
	this._runHandler("itemDone", newItem);
}

/*
 * executed when a collection is done and ready to be loaded into the database
 */
Scholar.Translate.prototype._collectionDone = function(collection) {
	Scholar.debug(collection);
	var newCollection = this._processCollection(collection, null);
	
	this._runHandler("collectionDone", newCollection);
}

/*
 * recursively processes collections
 */
Scholar.Translate.prototype._processCollection = function(collection, parentID) {
	var newCollection = Scholar.Collections.add(collection.name, parentID);
	
	for each(child in collection.children) {
		if(child.type == "collection") {
			// do recursive processing of collections
			this._processCollection(child, newCollection.getID());
		} else {
			// add mapped items to collection
			if(this._IDMap[child.id]) {
				Scholar.debug("adding "+this._IDMap[child.id]);
				newCollection.addItem(this._IDMap[child.id]);
			} else {
				Scholar.debug("could not map "+child.id+" to an imported item");
			}
		}
	}
	
	return newCollection;
}

/*
 * calls a handler (see setHandler above)
 */
Scholar.Translate.prototype._runHandler = function(type, argument) {
	var returnValue;
	if(this._handlers[type]) {
		for(var i in this._handlers[type]) {
			Scholar.debug("running handler "+i+" for "+type);
			try {
				if(this._parentTranslator) {
					returnValue = this._handlers[type][i](null, argument);
				} else {
					returnValue = this._handlers[type][i](this, argument);
				}
			} catch(e) {
				Scholar.debug(e+' in handler '+i+' for '+type);
			}
		}
	}
	return returnValue;
}

/*
 * does the actual web translation
 */
Scholar.Translate.prototype._web = function() {
	try {
		this._sandbox.doWeb(this.browser.contentDocument, this.location);
	} catch(e) {
		Scholar.debug(e+' in executing code for '+this.translator[0].label);
		return false;
	}
	
	return true;
}

/*
 * does the actual search translation
 */
Scholar.Translate.prototype._search = function() {
	try {
		this._sandbox.doSearch(this.search);
	} catch(e) {
		Scholar.debug(e+' in executing code for '+this.translator[0].label);
		return false;
	}
	
	return true;
}

/*
 * does the actual import translation
 */
Scholar.Translate.prototype._import = function() {
	this._importConfigureIO();
	
	try {
		this._sandbox.doImport();
	} catch(e) {
		Scholar.debug(e+' in executing code for '+this.translator[0].label);
		return false;
	}
	
	return true;
}

/*
 * sets up import for IO
 */
Scholar.Translate.prototype._importConfigureIO = function() {
	if(this._storageStream) {		
		if(this._configOptions.dataMode == "rdf") {
			this._rdf = new Object();
			
			// read string out of storage stream
			var sStream = Components.classes["@mozilla.org/scriptableinputstream;1"].
						  createInstance(Components.interfaces.nsIScriptableInputStream);
			sStream.init(this._storageStream.newInputStream(0));
			var str = sStream.read(this._storageStreamLength);
			sStream.close();
			
			var IOService = Components.classes['@mozilla.org/network/io-service;1']
							.getService(Components.interfaces.nsIIOService);
			this._rdf.dataSource = Components.classes["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"].
							createInstance(Components.interfaces.nsIRDFDataSource);
			var parser = Components.classes["@mozilla.org/rdf/xml-parser;1"].
						 createInstance(Components.interfaces.nsIRDFXMLParser);
			
			// get URI and parse
			var baseURI = (this.location ? IOService.newURI(this.location, "utf-8", null) : null);
			parser.parseString(dataSource, baseURI, str);
			
			// make an instance of the RDF handler
			this._sandbox.Scholar.RDF = new Scholar.Translate.RDF(this._rdf.dataSource);
		} else {
			this._storageStreamFunctions(true);
			
			if(this._scriptableStream) {
				// close scriptable stream so functions will be forced to get a
				// new one
				this._scriptableStream.close();
				this._scriptableStream = undefined;
			}
		}
	} else {
		if(this._configOptions.dataMode == "rdf") {
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
			this._sandbox.Scholar.RDF = new Scholar.Translate.RDF(this._rdf.dataSource);
		} else {
			// open file and set read methods
			var fStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
									 .createInstance(Components.interfaces.nsIFileInputStream);
			fStream.init(this.location, 0x01, 0664, 0);
			this._streams.push(fStream);
			
			if(this._configOptions.dataMode == "line") {	// line by line reading
				var notEof = true;
				var lineData = new Object();
				
				fStream.QueryInterface(Components.interfaces.nsILineInputStream);
				
				this._sandbox.Scholar.read = function() {
					if(notEof) {
						notEof = fStream.readLine(lineData);
						return lineData.value;
					} else {
						return false;
					}
				}
			} else {										// block reading
				var sStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
							 .createInstance(Components.interfaces.nsIScriptableInputStream);
				sStream.init(fStream);
				
				this._sandbox.Scholar.read = function(amount) {
					return sStream.read(amount);
				}
				
				// attach sStream to stack of streams to close
				this._streams.push(sStream);
			}
		}
	}
}

/*
 * does the actual export, after code has been loaded and parsed
 */
Scholar.Translate.prototype._export = function() {
	this._exportConfigureIO();
	
	// get items
	if(this.items) {
		this._itemsLeft = this.items;
	} else {
		this._itemsLeft = Scholar.getItems();
	}
	// run handler for items available
	this._runHandler("itemCount", this._itemsLeft.length);
	
	// get collections, if requested
	if(this._configOptions.getCollections && !this.items) {
		this._collectionsLeft = Scholar.getCollections();
	}
	
	try {
		this._sandbox.doExport();
	} catch(e) {
		Scholar.debug(e+' in executing code for '+this.translator[0].label);
		return false;
	}
	
	return true;
}

/*
 * configures IO for export
 */
Scholar.Translate.prototype._exportConfigureIO = function() {
	// open file
	var fStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
							 .createInstance(Components.interfaces.nsIFileOutputStream);
	fStream.init(this.location, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate
	// attach to stack of streams to close at the end
	this._streams.push(fStream);
	
	if(this._configOptions.dataMode == "rdf") {	// rdf io
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
		this._sandbox.Scholar.RDF = new Scholar.Translate.RDF(this._rdf.dataSource, this._rdf.serializer);
	} else {						// regular io; write just writes to file
		this._sandbox.Scholar.write = function(data) { fStream.write(data, data.length) };
	}
}

/*
 * gets the next item to process (called as Scholar.nextItem() from code)
 */
Scholar.Translate.prototype._exportGetItem = function() {
	if(this._itemsLeft.length != 0) {
		var returnItem = this._itemsLeft.shift();
		this._runHandler("itemDone", returnItem);
		return returnItem.toArray();
	}
	
	return false;
}

/*
 * gets the next item to collection (called as Scholar.nextCollection() from code)
 */
Scholar.Translate.prototype._exportGetCollection = function() {
	if(!this._configOptions.getCollections) {
		throw("getCollections configure option not set; cannot retrieve collection");
	}
	
	if(this._collectionsLeft && this._collectionsLeft.length != 0) {
		var returnItem = this._collectionsLeft.shift();
		var collection = new Object();
		collection.id = returnItem.getID();
		collection.name = returnItem.getName();
		collection.type = "collection";
		collection.children = returnItem.toArray();
		
		return collection;
	}
}

/*
 * sets up internal IO in such a way that both reading and writing are possible
 * (for inter-scraper communications)
 */
Scholar.Translate.prototype._initializeInternalIO = function() {
	if(this.type == "import" || this.type == "export") {
		if(this._configOptions.dataMode == "rdf") {
			// use an in-memory data source for internal IO
			this._rdf.dataSource = Components.classes["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"].
							 createInstance(Components.interfaces.nsIRDFDataSource);
			
			// make an instance of the RDF handler
			this._sandbox.Scholar.RDF = new Scholar.Translate.RDF(this._rdf.dataSource);
		} else {
			this._createStorageStream();
			this._storageStreamFunctions(true, true);
		}
	}
}

/*
 * creates and returns storage stream
 */
Scholar.Translate.prototype._createStorageStream = function() {
	// create a storage stream
	this._storageStream = Components.classes["@mozilla.org/storagestream;1"].
				  createInstance(Components.interfaces.nsIStorageStream);
	this._storageStream.init(4096, 4294967295, null);	// virtually no size limit
}

/*
 * sets up functions for reading/writing to a storage stream
 */
Scholar.Translate.prototype._storageStreamFunctions =  function(read, write) {
	var me = this;
	if(write) {
		// set up write() method
		var fStream = this._storageStream.getOutputStream(0);
		this._sandbox.Scholar.write = function(data) { fStream.write(data, data.length) };		
		
		// set Scholar.eof() to close the storage stream
		this._sandbox.Scholar.eof = function() {
			fStream.QueryInterface(Components.interfaces.nsIOutputStream);
			fStream.close();
		}
	}
	
	if(read) {
		// set up read methods
		if(this._configOptions.dataMode == "line") {	// line by line reading
			var lastCharacter;
			
			this._sandbox.Scholar.read = function() {
				if(!me._scriptableStream) {	// allocate an fStream and sStream on the fly
								                // otherwise with no data we get an error
					me._scriptableStream = Components.classes["@mozilla.org/scriptableinputstream;1"].
								             createInstance(Components.interfaces.nsIScriptableInputStream);
					me._scriptableStream.init(me._storageStream.newInputStream(0));
			
					// attach sStream to stack of streams to close
					me._streams.push(me._scriptableStream);
				}
			
				var character = me._scriptableStream.read(1);
				if(!character) {
					return false;
				}
				var string = "";
				
				if(lastCharacter == "\r" && character == "\n") {
					// if the last read got a cr, and this first char was
					// an lf, ignore the lf
					character = "";
				}
				
				while(character != "\n" && character != "\r" && character) {
					string += character;
					character = me._scriptableStream.read(1);
				}
				
				lastCharacter = character;
				
				return string;
			}
		} else {								// block reading
			this._sandbox.Scholar.read = function(amount) {
				if(!me._scriptableStream) {	// allocate an fStream and
										        // sStream on the fly; otherwise
										        // with no data we get an error
					me._scriptableStream = Components.classes["@mozilla.org/scriptableinputstream;1"].
								             createInstance(Components.interfaces.nsIScriptableInputStream);
					me._scriptableStream.init(me._storageStream.newInputStream(0));
			
					// attach sStream to stack of streams to close
					me._streams.push(me._scriptableStream);
				}
				
				return me._scriptableStream.read(amount);
			}
		}
	}
}

/* Scholar.Translate.ScholarItem: a class for generating a new item from
 * inside scraper code
 */
 
Scholar.Translate.ScholarItem = function(itemType) {
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
}

/* Scholar.Translate.Collection: a class for generating a new top-level
 * collection from inside scraper code
 */
 
Scholar.Translate.ScholarCollection = function() {}

/* Scholar.Translate.RDF: a class for handling RDF IO
 *
 * If an import/export translator specifies dataMode RDF, this is the interface,
 * accessible from model.
 * 
 * In order to simplify things, all classes take in their resource/container
 * as either the Mozilla native type or a string, but all
 * return resource/containers as Mozilla native types (use model.toString to
 * convert)
 */

Scholar.Translate.RDF = function(dataSource, serializer) {
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
Scholar.Translate.RDF.prototype._deEnumerate = function(enumerator) {
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
Scholar.Translate.RDF.prototype._getResource = function(about) {
	try {
		if(!(about instanceof Components.interfaces.nsIRDFResource)) {
			about = this._RDFService.GetResource(about);
		}
	} catch(e) {
		throw("invalid RDF resource: "+about);
	}
	return about;
}

// USED FOR OUTPUT

// writes an RDF triple
Scholar.Translate.RDF.prototype.addStatement = function(about, relation, value, literal) {
	about = this._getResource(about);
	
	if(!(value instanceof Components.interfaces.nsIRDFResource)) {
		if(literal) {
			value = this._RDFService.GetLiteral(value);
		} else {
			value = this._RDFService.GetResource(value);
		}
	}
	
	this._dataSource.Assert(about, this._RDFService.GetResource(relation), value, true);
}
		
// creates an anonymous resource
Scholar.Translate.RDF.prototype.newResource = function() {
	return this._RDFService.GetAnonymousResource()
};
		
// creates a new container
Scholar.Translate.RDF.prototype.newContainer = function(type, about) {
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
Scholar.Translate.RDF.prototype.addContainerElement = function(about, element, literal, index) {
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
Scholar.Translate.RDF.prototype.getContainerElements = function(about) {
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
Scholar.Translate.RDF.prototype.addNamespace = function(prefix, uri) {
	if(this._serializer) {	// silently fail, in case the reason the scraper
							// is failing is that we're using internal IO
		this._serializer.addNameSpace(this._AtomService.getAtom(prefix), uri);
	}
}

// gets a resource's URI
Scholar.Translate.RDF.prototype.getResourceURI = function(resource) {
	resource.QueryInterface(Components.interfaces.nsIRDFResource);
	return resource.ValueUTF8;
}

// USED FOR INPUT

// gets all RDF resources
Scholar.Translate.RDF.prototype.getAllResources = function() {
	var resourceEnumerator = this._dataSource.GetAllResources();
	return this._deEnumerate(resourceEnumerator);
}

// gets arcs going in
Scholar.Translate.RDF.prototype.getArcsIn = function(resource) {
	resource = this._getResource(resource);
	
	var arcEnumerator = this._dataSource.ArcLabelsIn(resource);
	return this._deEnumerate(arcEnumerator);
}

// gets arcs going out
Scholar.Translate.RDF.prototype.getArcsOut = function(resource) {
	resource = this._getResource(resource);
	
	var arcEnumerator = this._dataSource.ArcLabelsOut(resource);
	return this._deEnumerate(arcEnumerator);
}

// gets source resources
Scholar.Translate.RDF.prototype.getSources = function(resource, property) {
	property = this._getResource(property);
	resource = this._getResource(resource);
	
	var enumerator = this._dataSource.GetSources(resource, property, true);
	return this._deEnumerate(enumerator);
}

// gets target resources
Scholar.Translate.RDF.prototype.getTargets = function(resource, property) {
	property = this._getResource(property);
	resource = this._getResource(resource);
	
	var enumerator = this._dataSource.GetTargets(resource, property, true);
	return this._deEnumerate(enumerator);
}