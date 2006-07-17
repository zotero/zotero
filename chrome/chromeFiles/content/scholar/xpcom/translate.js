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
 * path - the path to the target; for web, this is the same as location
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
 *
 * WEB-ONLY PRIVATE PROPERTIES:
 *
 * _locationIsProxied - whether the URL being scraped is going through
 *                      an EZProxy
 */

Scholar.Translate = function(type) {
	this.type = type;
	
	// import = 001 = 1
	// export = 010 = 2
	// web    = 100 = 4
	
	// combination types determined by addition or bitwise AND
	// i.e., import+export = 1+2 = 3
	if(type == "import") {
		this._numericTypes = "1,3,5,7";
	} else if(type == "export") {
		this._numericTypes = "2,3,6,7";
	} else if(type == "web") {
		this._numericTypes = "4,5,6,7";
	} else {
		throw("invalid import type");
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
		this.path = location.path;
	}
}

/*
 * sets the translator to be used for import/export
 *
 * accepts either the object from getTranslators() or an ID
 */
Scholar.Translate.prototype.setTranslator = function(translator) {
	if(typeof(translator) == "object") {	// passed an object and not an ID
		translator = translator.translatorID;
	}
	
	var sql = "SELECT * FROM translators WHERE translatorID = ? AND type IN ("+this._numericTypes+")";
	this.translator = Scholar.DB.rowQuery(sql, [translator]);
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
 *   valid: web
 *   called: when an item has been processed; may be called asynchronously
 *   passed: an item object (see Scholar.Item)
 *   returns: N/A
 * 
 * done
 *   valid: all
 *   called: when all processing is finished
 *   passed: returns true if successful, false if an error occurred
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
	
	if(!this.location) {
		return translators;		// no need to see which can translate, because
								// we don't have a location yet (for export or
								// import dialog)
	} else {
		// create a new sandbox
		this._generateSandbox();
		
		var possibleTranslators = new Array();
		Scholar.debug("searching for translators for "+this.path);
		
		// see which translators can translate
		for(var i in translators) {
			if(this._canTranslate(translators[i])) {
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
		
		return possibleTranslators;
	}
}

/*
 * gets translator options to be displayed in a dialog
 *
 * NOT IMPLEMENTED
 */
Scholar.Translate.prototype.displayOptions = function() {
}

Scholar.Translate.prototype._loadTranslator = function() {
	if(!this._sandbox) {
		// create a new sandbox if none exists
		this._generateSandbox();
	}
	
	// parse detect code for the translator
	this._parseDetectCode(this.translator);
	
	Scholar.debug("parsing code for "+this.translator.label);
	
	try {
		Components.utils.evalInSandbox(this.translator.code, this._sandbox);
	} catch(e) {
		Scholar.debug(e+' in parsing code for '+this.translator.label);
		this._translationComplete(false);
		return false;
	}
	
	return true;
}

/*
 * does the actual translation
 */
Scholar.Translate.prototype.translate = function() {
	
	if(!this.location) {
		throw("cannot translate: no location specified");
	}
	
	this._complete = false;
	
	if(!this._loadTranslator()) {
		return;
	}
	
	var returnValue;
	if(this.type == "web") {
		returnValue = this._web();
	} else if(this.type == "import") {
		returnValue = this._import();
	} else if(this.type == "export") {
		returnValue = this._export();
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
Scholar.Translate.prototype._generateSandbox = function() {
	var me = this;
	
	if(this.type == "web") {
		// use real URL, not proxied version, to create sandbox
		this._sandbox = new Components.utils.Sandbox(this.browser.contentDocument.location.href);
		this._sandbox.Scholar = new Object();
		
		// add ingester utilities
		this._sandbox.Scholar.Utilities = new Scholar.Utilities.Ingester(this.locationIsProxied);
		this._sandbox.Scholar.Utilities.HTTPUtilities = new Scholar.Utilities.Ingester.HTTPUtilities(this.locationIsProxied);
		
		// set up selectItems handler
		this._sandbox.Scholar.selectItems = function(options) { return me._selectItems(options) };
	} else {
		// use null URL to create sanbox
		this._sandbox = new Components.utils.Sandbox("");
		this._sandbox.Scholar = new Object();
		
		this._sandbox.Scholar.Utilities = new Scholar.Utilities();
	}
	
	if(this.type == "web" || this.type == "import") {
		// add routines to add new items
		this._sandbox.Scholar.Item = Scholar.Translate.ScholarItem;
		// attach the function to be run when an item is 
		this._sandbox.Scholar.Item.prototype.complete = function() {me._itemDone(this)};
	} else if(this.type == "export") {
		// add routines to retrieve items and collections
		this._sandbox.Scholar.nextItem = function() { return me._exportGetItem() };
		this._sandbox.Scholar.nextCollection = function() { return me._exportGetCollection() };
	}
	
	this._sandbox.XPathResult = Components.interfaces.nsIDOMXPathResult;
	
	// for asynchronous operation, use wait()
	// done() is implemented after wait() is called
	this._sandbox.Scholar.wait = function() { me._enableAsynchronous() };
	// for adding configuration options
	this._sandbox.Scholar.configure = function(option, value) {me._configure(option, value) };
	// for adding displayed options
	this._sandbox.Scholar.addOption = function(option, value) {me._addOption(option, value) };
	
	// for loading other translators and accessing their methods
	var me = this;
	this._sandbox.Scholar.loadTranslator = function(type, translatorID) {
		var translation = new Scholar.Translate(type);
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
	}
}

/*
 * Check to see if _scraper_ can scrape this document
 */
Scholar.Translate.prototype._canTranslate = function(translator) {
	var canTranslate = false;
	
	// Test location with regular expression
	// If this is slow, we could preload all scrapers and compile regular
	// expressions, so each check will be faster
	if(translator.target) {
		if(this.type == "web") {
			var regularExpression = new RegExp(translator.target, "i");
		} else {
			var regularExpression = new RegExp("\."+translator.target+"$", "i");
		}
		
		if(regularExpression.test(this.path)) {
			canTranslate = true;
		}
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
		
		if(this._sandbox.detect) {
			var returnValue;
			
			try {
				if(this.type == "web") {
					returnValue = this._sandbox.detect(this.browser.contentDocument, this.location);
				} else if(this.type == "import") {
					returnValue = this._sandbox.detect();
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
 * makes translation API wait until done() has been called from the translator
 * before executing _translationComplete
 * 
 * called as wait() in translator code
 */
Scholar.Translate.prototype._enableAsynchronous = function() {
	me = this;
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
		
		Scholar.debug("translation complete");
		
		// call handler
		this._runHandler("done", returnValue);
		
		// close open streams
		this._closeStreams();
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
				stream.QueryInterface(Components.interfaces.nsIFileOutputStream);
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
	// Get typeID, defaulting to "website"
	var type = (item.itemType ? item.itemType : "website");
	
	// makes looping through easier
	delete item.itemType, item.complete;
	item.itemType = item.complete = undefined;
	
	var typeID = Scholar.ItemTypes.getID(type);
	var newItem = Scholar.Items.getNewItemByType(typeID);
	
	if(item.date && !item.year) {
		// date can serve as a year
		var dateID = Scholar.ItemFields.getID("date");
		var yearID = Scholar.ItemFields.getID("year");
		if(!Scholar.ItemFields.isValidForType(dateID, typeID) && Scholar.ItemFields.isValidForType(yearID, typeID)) {
			// year is valid but date is not
			var yearRe = /[0-9]{4}/;
			var m = yearRe.exec(item.date);
			if(m) {
				item.year = m[0]
				item.date = undefined;
			}
		}
	} else if(!item.date && item.year) {
		// the converse is also true
		var dateID = Scholar.ItemFields.getID("date");
		var yearID = Scholar.ItemFields.getID("year");
		if(Scholar.ItemFields.isValidForType(dateID, typeID) && !Scholar.ItemFields.isValidForType(yearID, typeID)) {
			// date is valid but year is not
			item.date = item.year;
			item.year = undefined;
		}
	}
	
	Scholar.debug(item);
	
	var fieldID, field;
	for(var i in item) {
		// loop through item fields
		data = item[i];
		
		if(data) {						// if field has content
			if(i == "creators") {		// creators are a special case
				for(j in data) {
					newItem.setCreator(j, data[j].firstName, data[j].lastName, 1);
				}
			} else if(i == "title") {	// skip checks for title
				newItem.setField(i, data);
			} else if(i == "tags") {	// add tags
				for(j in data) {
					newItem.addTag(data[j]);
				}
			} else if(fieldID = Scholar.ItemFields.getID(i)) {
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
	
	delete item;
	
	this._runHandler("itemDone", newItem);
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
				returnValue = this._handlers[type][i](this, argument);
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
		Scholar.debug(e+' in executing code for '+this.translator.label);
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
		Scholar.debug(e+' in executing code for '+this.translator.label);
		return false;
	}
	
	return true;
}

/*
 * sets up import for IO
 */
Scholar.Translate.prototype._importConfigureIO = function() {
	if(this._configOptions.dataMode == "rdf") {			 
		var IOService = Components.classes['@mozilla.org/network/io-service;1']
						.getService(Components.interfaces.nsIIOService);
		var fileHandler = IOService.getProtocolHandler("file")
		                  .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
		var URL = fileHandler.getURLSpecFromFile(this.location);
		delete fileHandler, IOService;
		
		var RDFService = Components.classes['@mozilla.org/rdf/rdf-service;1']
						 .getService(Components.interfaces.nsIRDFService);
		var dataSource = RDFService.GetDataSourceBlocking(URL);
		
		// make an instance of the RDF handler
		this._sandbox.Scholar.RDF = new Scholar.Translate.RDF(dataSource);
	} else {	
		// open file
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

/*
 * does the actual export, after code has been loaded and parsed
 */
Scholar.Translate.prototype._export = function() {
	this._exportConfigureIO();
	
	// get items
	this._itemsLeft = Scholar.getItems();
	
	// get collections, if requested
	if(this._configOptions.getCollections) {
		this._collectionsLeft = Scholar.getCollections();
	}
	
	try {
		this._sandbox.doExport();
	} catch(e) {
		Scholar.debug(e+' in executing code for '+this.translator.label);
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
		// create data source
		var dataSource = Components.classes["@mozilla.org/rdf/datasource;1?name=xml-datasource"].
		                 createInstance(Components.interfaces.nsIRDFDataSource);
		// create serializer
		var serializer = Components.classes["@mozilla.org/rdf/xml-serializer;1"].
		                 createInstance(Components.interfaces.nsIRDFXMLSerializer);
		serializer.init(dataSource);
		serializer.QueryInterface(Components.interfaces.nsIRDFXMLSource);
		
		// make an instance of the RDF handler
		this._sandbox.Scholar.RDF = new Scholar.Translate.RDF(dataSource, serializer);
		
		this.setHandler("done", function() { serializer.Serialize(fStream) });
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
		return returnItem.toArray();
	}
	return false;
}

/*
 * gets the next item to collection (called as Scholar.nextCollection() from code)
 */
Scholar.Translate.prototype._exportGetCollection = function() {
	if(!this._collectionsLeft) {
		throw("getCollections configure option not set; cannot retrieve collection");
	}
	
	if(this._collectionsLeft.length != 0) {
		var returnItem = this._collectionsLeft.shift();
		var collection = new Object();
		collection.id = returnItem.getID();
		collection.name = returnItem.getName();
		collection.type = "collection";
		collection.children = returnItem.toArray();
		
		return returnItem;
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
			var dataSource = Components.classes["@mozilla.org/rdf/datasource;1?name=in-memory-datasource"].
							 createInstance(Components.interfaces.nsIRDFDataSource);
			
			// make an instance of the RDF handler
			this._sandbox.Scholar.RDF = new Scholar.Translate.RDF(dataSource);
		} else {
			// create a storage stream
			var storageStream = Components.classes["@mozilla.org/storagestream;1"].
			              createInstance(Components.interfaces.nsIStorageStream);
			storageStream.init(4096, 4294967295, null);	// virtually no size limit
			
			// set up write() method
			var fStream = storageStream.getOutputStream(0);
			this._sandbox.Scholar.write = function(data) { fStream.write(data, data.length) };
			
			// set up read methods
			var sStream;
			var me = this;
			if(this._configOptions.dataMode == "line") {	// line by line reading
				var lastCharacter;
				
				this._sandbox.Scholar.read = function() {
					if(!sStream) {	// allocate an fStream and sStream on the fly
									// otherwise with no data we get an error
						sStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
									 .createInstance(Components.interfaces.nsIScriptableInputStream);
						sStream.init(fStream.newInputStream(0));
				
						// attach sStream to stack of streams to close
						me._streams.push(sStream);
					}
				
					var character = sStream.read(1);
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
						character = sStream.read(1);
					}
					
					lastCharacter = character;
					
					return string;
				}
			} else {									// block reading
				this._sandbox.Scholar.read = function(amount) {
					if(!sStream) {	// allocate an fStream and sStream on the fly
									// otherwise with no data we get an error
						sStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
									 .createInstance(Components.interfaces.nsIScriptableInputStream);
						sStream.init(fStream.newInputStream(0));
				
						// attach sStream to stack of streams to close
						me._streams.push(sStream);
					}
					
					return sStream.read(amount);
				}
			}
			
			// set Scholar.eof() to close the storage stream
			this._sandbox.Scholar.eof = function() {
				storageStream.QueryInterface(Components.interfaces.nsIOutputStream);
				storageStream.close();
			}
		}
	}
}

/* Scholar.Translate.ScholarItem: a class for generating new item from
 * inside scraper code
 *
 * (this must be part of the prototype because it must be able to access
 * methods relating to a specific instance of Scholar.Translate yet be called
 * as a class)
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
}

/* Scholar.Translate.RDF: a class for handling RDF IO
 *
 * If an import/export translator specifies dataMode RDF, this is the interface,
 * accessible from model.x
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
	if(!(about instanceof Components.interfaces.nsIRDFResource)) {
		about = this._RDFService.GetResource(about);
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
Scholar.Translate.RDF.prototype.addContainerElement = function(about, element, index) {
	if(!(about instanceof Components.interfaces.nsIRDFContainer)) {
		about = this._getResource(about);
		var container = Components.classes["@mozilla.org/rdf/container;1"].
						createInstance(Components.interfaces.nsIRDFContainer);
		container.Init(this._dataSource, about);
	}
	if(!(element instanceof Components.interfaces.nsIRDFResource)) {
		element = this._RDFService.GetResource(element);
	}
	
	if(index) {
		about.InsertElementAt(element, index, true);
	} else {
		about.AppendElement(element);
	}
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