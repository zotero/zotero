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
 * translatorObj.translate()
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
 * sets the file to be used file should be an nsILocalFile object
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
	if(this.translator) {
		Scholar.debug("got translator "+translator);
		return true;
	}
	return false;
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
	this._handlers[type] = handler;
}

/*
 * gets translator options to be displayed in a dialog
 *
 * NOT IMPLEMENTED
 */
Scholar.Translate.prototype.getOptions = function() {
}

/*
 * sets translator options to be displayed in a dialog
 *
 * NOT IMPLEMENTED
 */
Scholar.Translate.prototype.setOptions = function() {
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
	if(!this._waitForCompletion && returnValue) {
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
	if(this.type == "export") {
		this._sandbox.write = function(data) { me._exportWrite(data); };
	}
}

/*
 * makes translation API wait until done() has been called from the translator
 * before executing _translationComplete; called as wait()
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
		
		if(this.type == "export" || this.type == "import") {
			this.foStream.close();
		}
		
		// call handler
		if(this._handlers.done) {
			this._handlers.done(this, returnValue);
		}
	}
}

/*
 * does the actual export, after code has been loaded and parsed
 */
Scholar.Translate.prototype._export = function() {
	// get items
	var itemObjects = Scholar.getItems();
	var itemArrays = new Array();
	for(var i in itemObjects) {
		itemArrays.push(itemObjects[i].toArray());
	}
	delete itemObjects;	// free memory
	
	// get collections
	var collectionObjects = Scholar.getCollections();
	var collectionArrays = new Array();
	for(var i in collectionObjects) {
		var collection = new Object();
		collection.id = collectionObjects[i].getID();
		collection.name = collectionObjects[i].getName();
		collection.type = "collection";
		collection.children = collectionObjects[i].toArray();
		
		collectionArrays.push(collection);
	}
	delete collectionObjects;	// free memory
	
	// open file
	this.foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
	                         .createInstance(Components.interfaces.nsIFileOutputStream);
	this.foStream.init(this.location, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate
	
	
	try {
		return this._sandbox.doExport(itemArrays, collectionArrays);
	} catch(e) {
		Scholar.debug(e+' in executing code for '+this.translator.label);
		this._translationComplete(false);
	}
}

// TODO - allow writing in different character sets
Scholar.Translate.prototype._exportWrite = function(data) {
	this.foStream.write(data, data.length);
}