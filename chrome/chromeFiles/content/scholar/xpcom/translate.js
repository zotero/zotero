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
 * import (NOT IMPLEMENTED)
 * web (NOT IMPLEMENTED)
 *
 * a typical export process:
 * var translatorObj = new Scholar.Translate();
 * var possibleTranslators = translatorObj.getTranslators();
 * // do something involving nsIFilePicker; remember, each possibleTranslator
 * // object has properties translatorID, label, and targetID
 * translatorObj.setFile(myNsILocalFile);
 * translatorObj.setTranslator(possibleTranslators[x]); // also accepts only an ID
 * translatorObj.setHandler("done", _translationDone);
 * translatorObj.translate();
 *
 *
 * PUBLIC PROPERTIES:
 *
 * type - the text type of translator (set by constructor)
 * numeric type - the numeric type of translator (set by constructor)
 * location - the location of the target (set by setLocation)
 *            for import/export - this is an instance of nsILocalFile
 *            for web - this is a browser object
 * translator - the translator currently in use (set by setTranslator)
 *
 * PRIVATE PROPERTIES:
 * 
 * _handlers - handlers for various events (see setHandler)
 * _configOptions - options set by translator modifying behavior of
 *                  Scholar.Translate
 * _displayOptions - options available to user for this specific translator
 * _waitForCompletion - whether to wait for asynchronous completion, or return
 *                      immediately when script has finished executing
 * _sandbox - sandbox in which translators will be executed
 */

Scholar.Translate = function(type) {
	this.type = type;
	
	if(this.type == "import") {
		this.numericType = 1;
	} else if(this.type == "export") {
		this.numericType = 2;
	} else if(this.type == "web") {
		this.numericType = 3;
	}
	
	this._handlers = new Array();
}

/*
 * gets all applicable translators
 *
 * for import, you should call this after setFile; otherwise, you'll just get
 * a list of all import filters, not filters equipped to handle a specific file
 */
Scholar.Translate.prototype.getTranslators = function() {
	this._generateSandbox();
	
	if(this.type == "export") {
		var sql = 'SELECT translatorID, label, target FROM translators WHERE type = ?';
		var translators = Scholar.DB.query(sql, [this.numericType]);
		return translators;
	}
}

/*
 * sets the location to operate upon (file should be an nsILocalFile object)
 */
Scholar.Translate.prototype.setLocation = function(file) {
	this.location = file;
}

/*
 * sets the translator to be used for import/export
 *
 * accepts either the object from getTranslators() or an ID
 */
Scholar.Translate.prototype.setTranslator = function(translator) {
	if(typeof(translator) == "object") {
		translator = translator.translatorID;
	}
	
	var sql = 'SELECT * FROM translators WHERE translatorID = ? AND type = ?';
	this.translator = Scholar.DB.rowQuery(sql, [translator, this.numericType]);
	if(!this.translator) {
		return false;
	}
	
	if(this.type == "export") {
		// for export, we need to execute the translator detectCode to get
		// options; for other types, this has already been done
		this._executeDetectCode(this.translator);
	}

	Scholar.debug("got translator "+translator);
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
 *   passed: return value of the processing function
 *   returns: N/A
 */
Scholar.Translate.prototype.setHandler = function(type, handler) {
	if(!this._handlers[type]) {
		this._handlers[type] = new Array();
	}
	this._handlers[type].push(handler);
}

/*
 * gets translator options to be displayed in a dialog
 *
 * NOT IMPLEMENTED
 */
Scholar.Translate.prototype.displayOptions = function() {
}

/*
 * does the actual translation
 */
Scholar.Translate.prototype.translate = function() {
	this._complete = false;
	Scholar.debug("converting using "+this.translator.label);
	
	try {
		Components.utils.evalInSandbox(this.translator.code, this._sandbox);
	} catch(e) {
		Scholar.debug(e+' in parsing code for '+this.translator.label);
		this._translationComplete(false);
		return;
	}
	
	if(this.type == "export") {
		var returnValue = this._export();
	}
	
	// If synchronous, call _translationComplete();
	if(!this._waitForCompletion) {
		this._translationComplete(returnValue);
	}
}

/*
 * generates a sandbox for scraping/scraper detection
 */
Scholar.Translate.prototype._generateSandbox = function() {
	if(this.type == "web") {
		this._sandbox = new Components.utils.Sandbox(url);
		this._sandbox.browser = this.browser;
		this._sandbox.doc = this.browser.contentDocument;
		this._sandbox.url = this.sandboxURL;
		this._sandbox.utilities = new Scholar.Utilities.Ingester(this.window, this.proxiedURL, this.isHidden);
		this._sandbox.utilities.HTTPUtilities = new Scholar.Utilities.Ingester.HTTPUtilities(this.proxiedURL);
		this._sandbox.model = this.model;
	} else {
		this._sandbox = new Components.utils.Sandbox("");
		this._sandbox.utilities = new Scholar.Utilities();
	}
	
	this._sandbox.XPathResult = Components.interfaces.nsIDOMXPathResult;
	this._sandbox.MARC_Record = Scholar.Ingester.MARC_Record;
	this._sandbox.MARC_Record.prototype = new Scholar.Ingester.MARC_Record();
	
	var me = this;
	this._sandbox.wait = function() {me._enableAsynchronous() };
	this._sandbox.configure = function(option, value) {me._configure(option, value) };
	this._sandbox.addOption = function(option, value) {me._addOption(option, value) };
}

/*
 * executes translator detectCode, sandboxed
 */
Scholar.Translate.prototype._executeDetectCode = function(translator) {
	this._configOptions = new Array();
	this._displayOptions = new Array();
	Scholar.debug("executing detect code");
	
	try {
		return Components.utils.evalInSandbox(translator.detectCode, this._sandbox);
	} catch(e) {
		Scholar.debug(e+' in executing detectCode for '+translator.label);
		return;
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
	this._waitForCompletion = true;
	this._sandbox.done = function(returnValue) { me._translationComplete(returnValue); };
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
	}
}

/*
 * calls a handler (see setHandler above)
 */
Scholar.Translate.prototype._runHandler = function(type, argument) {
	if(this._handlers[type]) {
		for(var i in this._handlers[type]) {
			Scholar.debug("running handler "+i+" for "+type);
			this._handlers[type][i](this, argument);
		}
	}
}

/*
 * does the actual export, after code has been loaded and parsed
 */
Scholar.Translate.prototype._export = function() {
	this._exportConfigureIO();
	
	// get items
	var itemObjects = Scholar.getItems();
	var itemArrays = new Array();
	for(var i in itemObjects) {
		itemArrays.push(itemObjects[i].toArray());
	}
	delete itemObjects;	// free memory
	
	// get collections, if requested
	var collectionArrays;
	if(this._configOptions.getCollections) {
		var collectionObjects = Scholar.getCollections();
		collectionArrays = new Array();
		for(var i in collectionObjects) {
			var collection = new Object();
			collection.id = collectionObjects[i].getID();
			collection.name = collectionObjects[i].getName();
			collection.type = "collection";
			collection.children = collectionObjects[i].toArray();
			
			collectionArrays.push(collection);
		}
		delete collectionObjects;	// free memory
	}
	
	try {
		return this._sandbox.translate(itemArrays, collectionArrays);
	} catch(e) {
		Scholar.debug(e+' in executing code for '+this.translator.label);
		this._translationComplete(false);
	}
}

/*
 * configures IO for export
 */
Scholar.Translate.prototype._exportConfigureIO = function() {
	// open file
	var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
							 .createInstance(Components.interfaces.nsIFileOutputStream);
	foStream.init(this.location, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate
	
	if(this._configOptions.dataMode == "rdf") {
		/*** INITIALIZATION ***/
		var RDFService = Components.classes['@mozilla.org/rdf/rdf-service;1'].getService(Components.interfaces.nsIRDFService);
		var IOService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
		var AtomService = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
		var RDFContainerUtils = Components.classes["@mozilla.org/rdf/container-utils;1"].getService(Components.interfaces.nsIRDFContainerUtils);

		// create data source
		var dataSource = Components.classes["@mozilla.org/rdf/datasource;1?name=xml-datasource"].
		                 createInstance(Components.interfaces.nsIRDFDataSource);
		// create serializer
		var serializer = Components.classes["@mozilla.org/rdf/xml-serializer;1"].
		                 createInstance(Components.interfaces.nsIRDFXMLSerializer);
		serializer.init(dataSource);
		
		/*** FUNCTIONS ***/
		this._sandbox.model = new Object();
		
		// writes an RDF triple
		this._sandbox.model.addStatement = function(about, relation, value, literal) {
			Scholar.debug("pre: model.addStatement("+about+", "+relation+", "+value+", "+literal+")");
			
			if(!(about instanceof Components.interfaces.nsIRDFResource)) {
				about = RDFService.GetResource(about);
			}
			if(!(value instanceof Components.interfaces.nsIRDFResource)) {
				if(literal) {
					value = RDFService.GetLiteral(value);
				} else {
					value = RDFService.GetResource(value);
				}
			}
			
			Scholar.debug("post: model.addStatement("+about+", "+relation+", "+value+", "+literal+")");
			
			dataSource.Assert(about, RDFService.GetResource(relation), value, true);
		}
		
		// creates an anonymous resource
		this._sandbox.model.newResource = function() { return RDFService.GetAnonymousResource() };
		
		// creates a new container
		this._sandbox.model.newContainer = function(type, about) {
			if(!(about instanceof Components.interfaces.nsIRDFResource)) {
				about = RDFService.GetResource(about);
			}
			
			type = type.toLowerCase();
			if(type == "bag") {
				return RDFContainerUtils.MakeBag(dataSource, about);
			} else if(type == "seq") {
				return RDFContainerUtils.MakeSeq(dataSource, about);
			} else if(type == "alt") {
				return RDFContainerUtils.MakeAlt(dataSource, about);
			} else {
				throw "Invalid container type in model.newContainer";
			}
		}
		
		// adds a new container (index optional)
		this._sandbox.model.addContainerElement = function(about, element, index) {
			if(!(about instanceof Components.interfaces.nsIRDFContainer)) {
				if(!(about instanceof Components.interfaces.nsIRDFResource)) {
					about = RDFService.GetResource(about);
				}
				var container = Components.classes["@mozilla.org/rdf/container;1"].
				                createInstance(Components.interfaces.nsIRDFContainer);
				container.Init(dataSource, about);
			}
			if(!(element instanceof Components.interfaces.nsIRDFResource)) {
				element = RDFService.GetResource(element);
			}
			
			if(index) {
				about.InsertElementAt(element, index, true);
			} else {
				about.AppendElement(element);
			}
		}
		
		// sets a namespace
		this._sandbox.model.addNamespace = function(prefix, uri) {
			serializer.addNameSpace(AtomService.getAtom(prefix), uri);
		}
		
		this.setHandler("done", function() {
			serializer.QueryInterface(Components.interfaces.nsIRDFXMLSource);
			serializer.Serialize(foStream);
			
			delete dataSource, RDFService, IOService, AtomService, RDFContainerUtils;
		});
	} else {
		/*** FUNCTIONS ***/
		// write just writes to the file
		this._sandbox.write = function(data) { foStream.write(data, data.length) };
	}

	this.setHandler("done", function() {
		foStream.close();
		delete foStream;
	});
}