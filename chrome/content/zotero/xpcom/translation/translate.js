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

// Byte order marks for various character sets

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
 * @property {Zotero.Connector.CookieManager} cookieManager
 *		A CookieManager to manage cookies for this Translate instance.
 * @property {String} type The type of translator. This is deprecated; use instanceof instead.
 * translator - the translator currently in use (read-only; set with
 *               setTranslator)
 * location - the location of the target (read-only; set with setLocation)
 *            for import/export - this is an instance of nsILocalFile
 *            for web - this is a URL
 * items - items (in Zotero.Item format) to be exported. if this is empty,
 *         Zotero will export all items in the library (read-only; set with
 *         setItems). setting items disables export of collections.
 * @property {String} path The path or URI of the target
 * @property {String} libraryID libraryID (e.g., of a group) of saved database items. null for local
 *    items or false if items should not be saved at all. defaults to null; set using second
 *    argument of constructor.
 * @property {String} newItems Items created when translate() was called
 * @property {String} newCollections Collections created when translate() was called
 * @property {Boolean} saveAttachments Whether attachments should be saved
 * @property {Boolean} saveFiles Whether files should be saved
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
 * @param _storage - the stored string to be treated as input
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
	Zotero.debug("Translate: WARNING: new Zotero.Translate() is deprecated; please don't use this if you don't have to");
	// hack
	var translate = Zotero.Translate.new(type);
	for(var i in translate) {
		this[i] = translate[i];
	}
	this.constructor = translate.constructor;
	this.__proto__ = translate.__proto__;
}

Zotero.Translate.new = function(type) {
	return new Zotero.Translate[type[0].toUpperCase()+type.substr(1).toLowerCase()];
}

Zotero.Translate.Sandbox = {
	"_inheritFromBase":function(sandboxToMerge) {
		var newSandbox = {};
		
		for(var method in Zotero.Translate.Sandbox.Base) {
			newSandbox[method] = Zotero.Translate.Sandbox.Base[method];
		}
		
		for(var method in sandboxToMerge) {
			newSandbox[method] = sandboxToMerge[method];
		}
		
		return newSandbox;
	},
	
	"Base": {
		/**
		 * Called as Zotero.Item#complete() from translators to save items to the database.
		 */
		"_itemDone":function(translate, item) {
			Zotero.debug("Translate: Saving item");
			
			// warn if itemDone called after translation completed
			if(translate._complete) {
				Zotero.debug("Translate: WARNING: Zotero.Item#complete() called after Zotero.done(); please fix your code", 2);
			}
			
			// if we're not supposed to save the item or we're in a child translator,
			// just return the item array
			if(translate._libraryID === false || translate._parentTranslator) {
				translate.newItems.push(item);
				
				// if a parent sandbox exists, use complete() function from that sandbox
				if(translate._parentTranslator) {
					if(Zotero.isFx4) {
						// XOWs would break this otherwise
						item.complete = function() { translate._parentTranslator.Sandbox._itemDone(translate._parentTranslator, item) };
					} else {
						// SecurityManager vetos the Fx4 in Fx3.6 code for reasons I don't understand
						item.complete = translate._parentTranslator._sandboxManager.sandbox.Zotero.Item.prototype.complete;
					}
					Zotero.debug("Translate: Calling itemDone from parent sandbox", 4);
				}
				translate._runHandler("itemDone", item);
				return;
			}
			
			var newItem = translate._itemSaver.saveItem(item);
			
			// Allow progress meter to update
			//
			// This can probably be re-enabled for web translators once badly asynced ones are fixed
			if (translate instanceof Zotero.Translate.Import || translate instanceof Zotero.Translate.Export) {
				Zotero.wait();
			}
			
			translate._runHandler("itemDone", newItem);
		},
		
		/**
		 * Gets translator options that were defined in displayOptions in translator header
		 *
		 * @param {String} option Option to be retrieved
		 */
		"getOption":function(translate, option) {
			if(typeof option !== "string") {
				throw("Translate: getOption: option must be a string");
				return;
			}
			
			return translate._displayOptions[option];
		},
		
		/**
		 * For loading other translators and accessing their methods
		 * 
		 * @param {Zotero.Translate} translate
		 * @param {String} type Translator type ("web", "import", "export", or "search")
		 * @returns {Object} A safeTranslator object, which operates mostly like Zotero.Translate
		 */	 
		"loadTranslator":function(translate, type) {
			const setDefaultHandlers = function(translate, translation) {
				if(Zotero.Utilities.isEmpty(translation._handlers)) {
					if(type !== "export") {
						translation.setHandler("itemDone", function(obj, item) { item.complete() });
					}
					translation.setHandler("selectItems", translate._handlers["selectItems"]);
				}
			}
			
			if(typeof type !== "string") {
				throw("Translate: loadTranslator: type must be a string");
				return;
			}
			
			Zotero.debug("Translate: creating translate instance of type "+type+" in sandbox");
			var translation = Zotero.Translate.new(type);
			translation._parentTranslator = translate;
			
			if(translation instanceof Zotero.Translate.Export && !(translation instanceof Zotero.Translate.Export)) {
				throw("Translate: only export translators may call other export translators");
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
							if(Zotero.isFx4 && (this instanceof Zotero.Translate.Web || this instanceof Zotero.Translate.Search)) {
								// item is wrapped in an XPCCrossOriginWrapper that we can't get rid of
								// except by making a deep copy. seems to be due to
								// https://bugzilla.mozilla.org/show_bug.cgi?id=580128
								// hear that? that's the sound of me banging my head against the wall.
								// if there is no better way to do this soon, i am going to need a 
								// brain transplant...
								var unwrappedItem = JSON.parse(JSON.stringify(item));
								unwrappedItem.complete = item.complete;
							} else {
								var unwrappedItem = item;
							}
							
							arg2(obj, unwrappedItem);
						} catch(e) {
							translate.complete(false, e);
						}
					}
				);
			};
			safeTranslator.setString = function(arg) { translation.setString(arg) };
			safeTranslator.setTranslator = function(arg) { return translation.setTranslator(arg) };
			safeTranslator.getTranslators = function() { return translation.getTranslators() };
			safeTranslator.translate = function() {
				setDefaultHandlers(translate, translation);
				return translation.translate(false);
			};
			safeTranslator.getTranslatorObject = function() {
				translation._loadTranslator(translation.translator[0]);
				
				if(this.isFx) {
					// do same origin check
					var secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
						.getService(Components.interfaces.nsIScriptSecurityManager);
					var ioService = Components.classes["@mozilla.org/network/io-service;1"] 
						.getService(Components.interfaces.nsIIOService);
					
					var outerSandboxURI = ioService.newURI(typeof translate._sandboxLocation === "object" ?
						translate._sandboxLocation.location : translate._sandboxLocation, null, null);
					var innerSandboxURI = ioService.newURI(typeof translation._sandboxLocation === "object" ?
						translation._sandboxLocation.location : translation._sandboxLocation, null, null);
					
					if(!secMan.checkSameOriginURI(outerSandboxURI, innerSandboxURI, false)) {
						throw "Translate: getTranslatorObject() may not be called from web or search "+
							"translators to web or search translators from different origins.";
					}
				}
				
				translation._prepareTranslation();
				setDefaultHandlers(translate, translation);
				
				// return sandbox
				return translation._sandboxManager.sandbox;
			};
			
			// TODO security is not super-tight here, as someone could pass something into arg
			// that gets evaluated in the wrong scope in Fx < 4. We should wrap this.
			
			return safeTranslator;
		},
		
		/**
		 * Enables asynchronous detection or translation
		 * @param {Zotero.Translate} translate
		 */
		"wait":function(translate) {
			if(translate._currentState == "translate") {
				translate._waitForCompletion = true;
			} else {
				throw "Translate: cannot call Zotero.wait() in detectCode of non-web translators";
			}
		},
		
		/**
		 * Completes asynchronous detection or translation
		 *
		 * @param {Zotero.Translate} translate
		 * @param {Boolean|String} [val] Whether detection or translation completed successfully.
		 *     For detection, this should be a string or false. For translation, this should be
		 *     boolean.
		 * @param {String} [error] The error string, if an error occurred.
		 */
		"done":function(translate, val, error) {
			translate.complete(typeof val === "undefined" ? true : val, (error ? error : "No error message specified"));
		},
		
		/**
		 * Proxy for translator _debug function
		 * 
		 * @param {Zotero.Translate} translate
		 * @param {String} string String to write to console
		 * @param {String} [level] Level to log as (1 to 5)
		 */
		"debug":function(translate, string, level) {
			translate._debug(string, level);
		}
	},
	
	/**
	 * Web functions exposed to sandbox
	 * @namespace
	 */
	"Web":{
		/**
		 * Lets user pick which items s/he wants to put in his/her library
		 */
		"selectItems":function(translate, options) {
			// hack to see if there are options
			var haveOptions = false;
			for(var i in options) {
				haveOptions = true;
				break;
			}
			
			if(!haveOptions) {
				throw "Translate: translator called select items with no items";
			}
			
			if(translate._handlers.select) {
				return translate._runHandler("select", options);
			} else {	// no handler defined; assume they want all of them
				return options;
			}
		},
		
		/**
		 * Overloads {@link Zotero.Translate.Sandbox.Base._itemDone}
		 */
		 "_itemDone":function(translate, item) {
			if(!item.itemType) {
				item.itemType = "webpage";
				Zotero.debug("Translate: WARNING: No item type specified");
			}
			
			if(item.type == "attachment" || item.type == "note") {
				Zotero.debug("Translate: Discarding standalone "+item.type+" in non-import translator", 2);
				return;
			}
		 	
			// store library catalog if this item was captured from a website, and
			// libraryCatalog is truly undefined (not false or "")
			if(item.repository !== undefined) {
				Zotero.debug("Translate: 'repository' field is now 'libraryCatalog'; please fix your code", 2);
				item.libraryCatalog = item.repository;
				delete item.repository;
			}
			
			// automatically set library catalog
			if(item.libraryCatalog === undefined) {
				item.libraryCatalog = translate.translator[0].label;
			}
						
			// automatically set access date if URL is set
			if(item.url && typeof item.accessDate == 'undefined') {
				item.accessDate = "CURRENT_TIMESTAMP";
			}
			
			// create short title
			if(item.shortTitle === undefined && Zotero.Utilities.fieldIsValidForType("shortTitle", item.itemType)) {		
				// only set if changes have been made
				var setShortTitle = false;
				var title = item.title;
				
				// shorten to before first colon
				var index = title.indexOf(":");
				if(index !== -1) {
					title = title.substr(0, index);
					setShortTitle = true;
				}
				// shorten to after first question mark
				index = title.indexOf("?");
				if(index !== -1) {
					index++;
					if(index != title.length) {
						title = title.substr(0, index);
						setShortTitle = true;
					}
				}
				
				if(setShortTitle) item.shortTitle = title;
			}
			
			// call super
			Zotero.Translate.Sandbox.Base._itemDone(translate, item);
		},
		
		/**
		 * Overloads {@link Zotero.Sandbox.Base.wait} to allow asynchronous detect
		 * @param {Zotero.Translate} translate
		 */
		"wait":function(translate) {
			translate._waitForCompletion = true;
		}
	},

	/**
	 * Import functions exposed to sandbox
	 * @namespace
	 */
	"Import":{
		/**
		 * Saves a collection to the DB
		 * Called as collection.complete() from the sandbox
		 * @param {Object} collection
		 */
		"_collectionDone":function(translate, collection) {
			var newCollection = translate._itemSaver.saveCollection(collection);
			translate._runHandler("collectionDone", newCollection);
		}
	},

	/**
	 * Export functions exposed to sandbox
	 * @namespace
	 */
	"Export":{
		"nextItem":function(translate) {
			var item = translate._itemGetter.nextItem();
			
			if(translate._displayOptions.hasOwnProperty("exportTags") && !translate._displayOptions["exportTags"]) {
				item.tags = [];
			}
			
			translate._runHandler("itemDone", item);
			Zotero.wait();
			return item;
		},
		
		"nextCollection":function(translate) {
			if(!translate.translator[0].configOptions.getCollections) {
				throw("Translate: getCollections configure option not set; cannot retrieve collection");
			}
			
			return translate._itemGetter.nextCollection();
		}
	},
	
	/**
	 * Search functions exposed to sandbox
	 * @namespace
	 */
	"Search":{
		/**
		 * @borrows Zotero.Translate.Sandbox.Web._itemDone as this._itemDone
		 */
		"_itemDone":function(translate, item) {
			Zotero.Translate.Sandbox.Web._itemDone(translate, item);
		}
	}
}

/**
 * @class Base class for all translators
 */
Zotero.Translate.Base = function() {}
Zotero.Translate.Base.prototype = {
	"init":function() {
		this._handlers = [];
		this._currentState = null;
		this.document = null;
		this.location = null;
	},
	
	/**
	 * Sets the location to operate upon
	 *
	 * @param {String|nsIFile} location The URL to which the sandbox should be bound or path to local file
	 */
	"setLocation":function(location) {
		this.location = location;
		if(typeof this.location == "object") {	// if a file
			this.path = location.path;
		} else {								// if a url
			this.path = location;
		}
	},
	
	/**
	 * Sets the translator to be used for import/export
	 *
	 * @param {Zotero.Translator|string} Translator object or ID
	 */
	"setTranslator":function(translator) {
		if(!translator) {
			throw("cannot set translator: invalid value");
		}
		
		this.translator = null;
		this._setDisplayOptions = null;
		
		if(typeof(translator) == "object") {	// passed an object and not an ID
			if(translator.translatorID) {
				this.translator = [translator];
			} else {
				throw("No translatorID specified");
			}
		} else {
			this.translator = [Zotero.Translators.get(translator)];
		}
		
		return !!this.translator;
	},
	
	/**
	 * Registers a handler function to be called when translation is complete
	 *
	 * @param {String} type Type of handler to register. Legal values are:
	 * select
	 *   valid: web
	 *   called: when the user needs to select from a list of available items
	 *   passed: an associative array in the form id => text
	 *   returns: a numerically indexed array of ids, as extracted from the passed
	 *            string
	 * itemDone
	 *   valid: import, web, search
	 *   called: when an item has been processed; may be called asynchronously
	 *   passed: an item object (see Zotero.Item)
	 *   returns: N/A
	 * collectionDone
	 *   valid: import
	 *   called: when a collection has been processed, after all items have been
	 *           added; may be called asynchronously
	 *   passed: a collection object (see Zotero.Collection)
	 *   returns: N/A
	 * done
	 *   valid: all
	 *   called: when all processing is finished
	 *   passed: true if successful, false if an error occurred
	 *   returns: N/A
	 * debug
	 *   valid: all
	 *   called: when Zotero.debug() is called
	 *   passed: string debug message
	 *   returns: true if message should be logged to the console, false if not
	 * error
	 *   valid: all
	 *   called: when a fatal error occurs
	 *   passed: error object (or string)
	 *   returns: N/A
	 * translators
	 *   valid: all
	 *   called: when a translator search initiated with Zotero.Translate.getTranslators() is
	 *           complete
	 *   passed: an array of appropriate translators
	 *   returns: N/A
	 * @param {Function} handler Callback function. All handlers will be passed the current
	 * translate instance as the first argument. The second argument is dependent on the handler.
	 */
	"setHandler":function(type, handler) {
		if(!this._handlers[type]) {
			this._handlers[type] = new Array();
		}
		this._handlers[type].push(handler);
	},

	/*
	 * Clears all handlers for a given function
	 * @param {String} type See {@link Zotero.Translate.Base#setHandler} for valid values
	 */
	"clearHandlers":function(type) {
		this._handlers[type] = new Array();
	},

	/**
	 * Clears all handlers for a given function
	 * @param {String} type See {@link Zotero.Translate.Base#setHandler} for valid values
	 * @param {Any} argument Argument to be passed to handler
	 */
	"_runHandler":function(type, argument) {
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
	},

	/**
	 * Gets all applicable translators of a given type
	 *
	 * For import, you should call this after setLocation; otherwise, you'll just get a list of all
	 * import filters, not filters equipped to handle a specific file
	 *
	 * @return {Zotero.Translator[]} An array of {@link Zotero.Translator} objects
	 */
	"getTranslators":function(getAllTranslators) {
		// do not allow simultaneous instances of getTranslators
		if(this._currentState == "detect") throw "Translate: getTranslators: detection is already running";
		this._currentState = "detect";
		this._getAllTranslators = getAllTranslators;
		this._potentialTranslators = this._getPotentialTranslators();
		this._foundTranslators = [];
		
		Zotero.debug("Translate: Searching for translators for "+(this.path ? this.path : "an undisclosed location"), 3);
		
		this._detect();
		
		// if detection returns immediately, return found translators
		if(!this._currentState) return this._foundTranslators;
	},

	/**
	 * does the actual translation
	 *
	 * @param 	{NULL|Integer|FALSE}	[libraryID=null]		Library in which to save items,
	 *																or NULL for default library;
	 *																if FALSE, don't save items
	 * @param 	{Boolean}				[saveAttachments=true]	Exclude attachments (e.g., snapshots) on import
	 */
	"translate":function(libraryID, saveAttachments) {
		// initialize properties specific to each translation
		this._currentState = "translate";
		
		if(!this.translator || !this.translator.length) {
			throw("Translate: Failed: no translator specified");
		}
		
		// load translators
		if(!this._loadTranslator(this.translator[0])) return;
		
		// set display options to default if they don't exist
		if(!this._displayOptions) this._displayOptions = this.translator[0].displayOptions;
		
		// prepare translation
		this._prepareTranslation(libraryID, typeof saveAttachments === "undefined" ? true : saveAttachments);
		
		Zotero.debug("Translate: Beginning translation with "+this.translator[0].label);
		
		// translate
		try {
			this._sandboxManager.sandbox["do"+this._entryFunctionSuffix].apply(this.null, this._getParameters());
		} catch(e) {
			if(this._parentTranslator) {
				throw(e);
			} else {
				this.complete(false, e);
				return false;
			}
		}
		
		if(!this._waitForCompletion) this.complete(true);
	},
	
	/**
	 * Executed on translator completion, either automatically from a synchronous scraper or as
	 * done() from an asynchronous scraper
	 *
	 * Finishes things up and calls callback function(s)
	 */
	"complete":function(returnValue, error) {
		// Make sure this isn't called twice
		if(this._currentState === null) {
			Zotero.debug("Translate: WARNING: Zotero.done() called after translation completion; please fix your code");
			return;
		}
		
		var errorString = null;
		if(!returnValue) errorString = this._generateErrorString(error);
		
		if(this._currentState === "detect") {
			if(this._potentialTranslators.length) {
				var lastTranslator = this._potentialTranslators.shift();
				
				if(returnValue) {
					var dupeTranslator = {"itemType":returnValue};
					for(var i in lastTranslator) dupeTranslator[i] = lastTranslator[i];
					this._foundTranslators.push(dupeTranslator);
				} else if(error) {
					this._debug("Detect using "+lastTranslator.label+" failed: \n"+errorString, 2);
				}
			}
				
			if(this._potentialTranslators.length && (this._getAllTranslators || !returnValue)) {
				// more translators to try; proceed to next translator
				this._detect();
			} else {
				this._runHandler("translators", this._foundTranslators ? this._foundTranslators : false);
			}
		} else {		
			if(returnValue) {
				this._debug("Translation successful");
			} else {
				// report error to console
				if(this.translator[0] && this.translator[0].logError) {
					this.translator[0].logError(error.toString(), "exception");
				} else {
					Zotero.logError(error);
				}
				
				// report error to debug log
				this._debug("Translation using "+(this.translator && this.translator[0] && this.translator[0].label ? this.translator[0].label : "no translator")+" failed: \n"+errorString, 2);
				
				this._runHandler("error", error);
			}
			
			// call handlers
			this._runHandler("done", returnValue);
		}
		
		this._waitForCompletion = false;
		this._currentState = null;
		return errorString;
	},
	
	/**
	 * Runs detect code for a translator
	 */
	"_detect":function() {
		if(!this._loadTranslator(this._potentialTranslators[0])) {
			this.complete(false, "Error loading translator into sandbox");
			return;
		}
		this._prepareDetection();
		
		try {
			var returnValue = this._sandboxManager.sandbox["detect"+this._entryFunctionSuffix].apply(null, this._getParameters());
		} catch(e) {
			this.complete(false, e);
			return;
		}
		
		if(!this._waitForCompletion) this.complete(returnValue);
	},
	
	/**
	 * Loads the translator into its sandbox
	 */
	"_loadTranslator":function(translator) {
		var sandboxLocation = this._getSandboxLocation();
		if(!this._sandboxLocation || sandboxLocation != this._sandboxLocation) {
			this._sandboxLocation = sandboxLocation;
			this._generateSandbox();
		}
		this._waitForCompletion = false;
		
		Zotero.debug("Translate: Parsing code for "+translator.label, 4);
		
		try {
			this._sandboxManager.eval("var translatorInfo = "+translator.code, this._sandbox);
			return true;
		} catch(e) {
			if(translator.logError) {
				translator.logError(e.toString());
			} else {
				Zotero.logError(e);
			}
			
			this.complete(false, "parse error");
			return false;
		}
		
		return true;
	},
	
	/**
	 * Generates a sandbox for scraping/scraper detection
	 */
	"_generateSandbox":function() {
		Zotero.debug("Translate: Binding sandbox to "+(typeof this._sandboxLocation == "object" ? this._sandboxLocation.document.location : this._sandboxLocation), 4);
		this._sandboxManager = new Zotero.Translate.SandboxManager(this, this._sandboxLocation);
		this._sandboxManager.eval("var Zotero = {};"+
		"Zotero.Item = function (itemType) {"+
				"this.itemType = itemType;"+
				"this.creators = [];"+
				"this.notes = [];"+
				"this.tags = [];"+
				"this.seeAlso = [];"+
				"this.attachments = [];"+
		"};"+
		"Zotero.Item.prototype.complete = function() { Zotero._itemDone(this); };"+
		"Zotero.Collection = function () {};"+
		"Zotero.Collection.prototype.complete = function() { Zotero._collectionDone(this); };"+
		// https://bugzilla.mozilla.org/show_bug.cgi?id=609143 - can't pass E4X to sandbox in Fx4
		"Zotero.getXML = function() {"+
			"var xml = Zotero._getXML();"+
			"if(typeof xml == 'string') return new XML(xml);"+
		"}"
		);
		
		this._sandboxManager.importObject(this.Sandbox, this);
		this._sandboxManager.importObject({"Utilities":new Zotero.Utilities.Translate(this)});
		this._sandboxManager.sandbox.Zotero.Utilities.HTTP = this._sandboxManager.sandbox.Zotero.Utilities;
	},
	
	/**
	 * Logs a debugging message
	 */
	"_debug":function(string, level) {
		if(typeof string === "object") string = new XPCSafeJSObjectWrapper(string);
		if(level !== undefined && typeof level !== "number") {
			Zotero.debug("debug: level must be an integer");
			return;
		}
		
		// if handler does not return anything explicitly false, show debug
		// message in console
		if(this._runHandler("debug", string) !== false) {
			if(typeof string == "string") string = "Translate: "+string;
			Zotero.debug(string, level);
		}
	},
	
	"_generateErrorString":function(error) {
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
	},
	
	/**
	 * Determines the location where the sandbox should be bound
	 */
	"_getSandboxLocation":function() {
		return (this._parentTranslator ? this._parentTranslator._sandboxLocation : "http://www.example.com/");
	},
	
	/**
	 * Gets parameters to be passed to detect* and do* functions
	 */
	"_getParameters":function() { return []; },
	
	/**
	 * No-op for preparing detection
	 */
	"_prepareDetection":function() {},
	
	/**
	 * No-op for preparing translation
	 */
	"_prepareTranslation":function() {},
	
	/**
	 * Get all potential translators
	 */
	"_getPotentialTranslators":function() {
		return Zotero.Translators.getAllForType(this.type);
	}
}

/**
 * @property {Document} document The document object to be used for web scraping (set with setDocument)
 */
Zotero.Translate.Web = function() {
	this.init();
}
Zotero.Translate.Web.prototype = new Zotero.Translate.Base();
Zotero.Translate.Web.prototype.type = "web";
Zotero.Translate.Web.prototype._entryFunctionSuffix = "Web";
Zotero.Translate.Web.prototype.Sandbox = Zotero.Translate.Sandbox._inheritFromBase(Zotero.Translate.Sandbox.Web);

/**
 * Sets the browser to be used for web translation
 * @param {Document} doc An HTML document
 */
Zotero.Translate.Web.prototype.setDocument = function(doc) {
	this.document = doc;
	this.setLocation(doc.location.href);
}

/**
 * Sets a Zotero.Connector.CookieManager to handle cookie management for XHRs initiated from this
 * translate instance
 *
 * @param {Zotero.Connector.CookieManager} cookieManager
 */
Zotero.Translate.Web.prototype.setCookieManager = function(cookieManager) {
	this.cookieManager = cookieManager;
}

/**
 * Sets the location to operate upon
 *
 * @param {String} location The URL of the page to translate
 */
Zotero.Translate.Web.prototype.setLocation = function(location) {
	// account for proxies
	this.location = Zotero.Proxies.proxyToProper(location);
	if(this.location != location) {
		// figure out if this URL is being proxies
		this.locationIsProxied = true;
	}
	this.path = this.location;
}

/**
 * Get all potential translators
 */
Zotero.Translate.Web.prototype._getPotentialTranslators = function() {
	var allTranslators = Zotero.Translators.getAllForType("web");
	var potentialTranslators = [];
	
	for(var i=0; i<allTranslators.length; i++) {
		if(!allTranslators[i].webRegexp || allTranslators[i].webRegexp.test(this.location)) {
			potentialTranslators.push(allTranslators[i]);
		}
	}
	
	return potentialTranslators;
}

/**
 * Bind sandbox to document being translated
 */
Zotero.Translate.Web.prototype._getSandboxLocation = function() {
	return this.document.defaultView;
}

/**
 * Pass document and location to detect* and do* functions
 */
Zotero.Translate.Web.prototype._getParameters = function() { return [this.document, this.location]; }

/**
 * Prepare translation
 */
Zotero.Translate.Web.prototype._prepareTranslation = function(libraryID, saveAttachments) {
	this._itemSaver = new Zotero.Translate.ItemSaver(libraryID,
		Zotero.Translate.ItemSaver[(saveAttachments ? "ATTACHMENT_MODE_DOWNLOAD" : "ATTACHMENT_MODE_IGNORE")], 1);
	this.newItems = this._itemSaver.newItems;
}

/**
 * Overload detect to test regexp first
 */
Zotero.Translate.Web.prototype.complete = function(returnValue, error) {
	// call super
	var oldState = this._currentState;
	var errorString = Zotero.Translate.Base.prototype.complete.apply(this, [returnValue, error]);
	
	// Report translaton failure if we failed
	if(oldState == "translate" && errorString && this.translator[0].inRepository && Zotero.Prefs.get("reportTranslationFailure")) {
		// Don't report failure if in private browsing mode
		var pbs = Components.classes["@mozilla.org/privatebrowsing;1"]
					.getService(Components.interfaces.nsIPrivateBrowsingService);
		if (pbs.privateBrowsingEnabled) {
			return;
		}
		
		var postBody = "id=" + encodeURIComponent(this.translator[0].translatorID) +
					   "&lastUpdated=" + encodeURIComponent(this.translator[0].lastUpdated) +
					   "&diagnostic=" + encodeURIComponent(Zotero.getSystemInfo()) +
					   "&errorData=" + encodeURIComponent(errorData);
		Zotero.HTTP.doPost("http://www.zotero.org/repo/report", postBody);
	}
}

Zotero.Translate.Import = function() {
	this.init();
}
Zotero.Translate.Import.prototype = new Zotero.Translate.Base();
Zotero.Translate.Import.prototype.type = "import";
Zotero.Translate.Import.prototype._entryFunctionSuffix = "Import";
Zotero.Translate.Import.prototype._io = false;

Zotero.Translate.Import.prototype.Sandbox = Zotero.Translate.Sandbox._inheritFromBase(Zotero.Translate.Sandbox.Import);

/**
 * Sets string for translation and initializes string IO
 */
Zotero.Translate.Import.prototype.setString = function(string) {
	this._string = string;
}

/**
 * Overload {@link Zotero.Translate.Base#complete} to close file
 */
Zotero.Translate.Import.prototype.complete = function(returnValue, error) {
	if(this._currentState == "translate" && this._io) this._io.close();
	
	// call super
	Zotero.Translate.Base.prototype.complete.apply(this, [returnValue, error]);
}

/**
 * Get all potential translators, ordering translators with the right file extension first
 */
Zotero.Translate.Import.prototype._getPotentialTranslators = function() {
	var allTranslators = Zotero.Translators.getAllForType("import");
	var tier1Translators = [];
	var tier2Translators = [];
	
	for(var i=0; i<allTranslators.length; i++) {
		if(allTranslators[i].importRegexp.test(this.location)) {
			tier1Translators.push(allTranslators[i]);
		} else {
			tier2Translators.push(allTranslators[i]);
		}
	}
	
	return tier1Translators.concat(tier2Translators);
}

/**
 * Overload Zotero.Translate.Base#_detect to return all translators immediately only if no string
 * or location is set
 */
Zotero.Translate.Import.prototype._detect = function() {
	if(!this._string && !this.location) {
		this._foundTranslators = this._potentialTranslators;
		this._potentialTranslators = [];
		this.complete(true);
	} else {
		Zotero.Translate.Base.prototype._detect.call(this);
	}
}
	
/**
 * Overload {@link Zotero.Translate.Base#_loadTranslator} to prepare translator IO
 */
Zotero.Translate.Import.prototype._loadTranslator = function(translator) {
	// call super
	var returnVal = Zotero.Translate.Base.prototype._loadTranslator.call(this, translator);
	if(!returnVal) return returnVal;
	
	this._waitForCompletion = false;
	var dataMode = (translator ? translator : this._potentialTranslators[0]).configOptions["dataMode"];
	
	var err = false;
	if(this._io) {
		try {
			this._io.reset(dataMode);
		} catch(e) {
			err = e;
		}
	} else {
		if(this._string) {
			try {
				this._io = new Zotero.Translate.IO.String(this._string, this.path ? this.path : "", dataMode);
			} catch(e) {
				err = e;
			}
		} else if(this.location && !Zotero.Translate.IO.Read) {
			throw "Translate: reading from files is not supported in this build of Zotero. Use setString() to perform import.";
		} else {
			try {
				this._io = new Zotero.Translate.IO.Read(this.location, dataMode);
			} catch(e) {
				err = e;
			}
		}
	}
	
	if(err) {
		Zotero.debug("Translate: Preparing IO for "+translator.label+" failed: "+err);
		return false;
	}
	
	this._sandboxManager.importObject(this._io);
	
	return true;
},

/**
 * Prepare translation
 */
Zotero.Translate.Import.prototype._prepareTranslation = function(libraryID, saveAttachments) {
	this._itemSaver = new Zotero.Translate.ItemSaver(libraryID,
		Zotero.Translate.ItemSaver[(saveAttachments ? "ATTACHMENT_MODE_FILE" : "ATTACHMENT_MODE_IGNORE")]);
	this.newItems = this._itemSaver.newItems;
	this.newCollections = this._itemSaver.newCollections;
}
	

Zotero.Translate.Export = function() {
	this.init();
}
Zotero.Translate.Export.prototype = new Zotero.Translate.Base();
Zotero.Translate.Export.prototype.type = "export";
Zotero.Translate.Export.prototype._entryFunctionSuffix = "Export";
Zotero.Translate.Export.prototype.Sandbox = Zotero.Translate.Sandbox._inheritFromBase(Zotero.Translate.Sandbox.Export);

/**
 * Sets the items to be exported
 * @param {Zotero.Item[]} items
 */
Zotero.Translate.Export.prototype.setItems = function(items) {
	this._items = items;
	delete this._collection;
}

/**
 * Sets the collection to be exported (overrides setItems)
 * @param {Zotero.Collection[]} collection
 */
Zotero.Translate.Export.prototype.setCollection = function(collection) {
	this._collection = collection;
	delete this._items;
}

/**
 * Sets the translator to be used for export
 *
 * @param {Zotero.Translator|string} Translator object or ID. If this contains a displayOptions
 *    attribute, setDisplayOptions is automatically called with the specified value.
 */
Zotero.Translate.Export.prototype.setTranslator = function(translator) {
	if(typeof translator == "object" && translator.displayOptions) {
		this._displayOptions = translator.displayOptions;
	}
	return Zotero.Translate.Base.prototype.setTranslator.apply(this, [translator]);
}

/**
 * Sets translator display options. you can also pass a translator (not ID) to
 * setTranslator that includes a displayOptions argument
 */
Zotero.Translate.Export.prototype.setDisplayOptions = function(displayOptions) {
	this._displayOptions = displayOptions;
}

/**
 * @borrows Zotero.Translate.Import#complete
 */
Zotero.Translate.Export.prototype.complete = Zotero.Translate.Import.prototype.complete;

/**
 * Overload Zotero.Translate.Base#_detect to return all translators immediately
 */
Zotero.Translate.Export.prototype._detect = function() {
	this._foundTranslators = this._potentialTranslators;
	this._potentialTranslators = [];
	this.complete(true);
}

/**
 * Does the actual export, after code has been loaded and parsed
 */
Zotero.Translate.Export.prototype._prepareTranslation = function(libraryID, saveAttachments) {
	// initialize ItemGetter
	this._itemGetter = new Zotero.Translate.ItemGetter();
	var getCollections = this.translator[0].configOptions.getCollections ? this.translator[0].configOptions.getCollections : false;
	if(this._collection) {
		this._itemGetter.setCollection(this._collection, getCollections);
		delete this._collection;
	} else if(this._items) {
		this._itemGetter.setItems(this._items);
		delete this._items;
	} else {
		this._itemGetter.setAll(getCollections);
	}
	
	// export file data, if requested
	if(this._displayOptions["exportFileData"]) {
		this.location = this._itemGetter.exportFiles(this.location, this.translator[0].target);
	}
	
	// initialize IO
	if(!this.location) {
		var io = this._io = new Zotero.Translate.IO.String(null, this.path ? this.path : "", this.translator[0].configOptions["dataMode"]);
		this.__defineGetter__("string", function() { return io.string; });
	} else if(!Zotero.Translate.IO.Write) {
		throw "Translate: Writing to files is not supported in this build of Zotero.";
	} else {
		this._io = new Zotero.Translate.IO.Write(this.location,
			this.translator[0].configOptions["dataMode"],
			this.translator[0].displayOptions["exportCharset"] ? this.translator[0].displayOptions["exportCharset"] : null);
	}
	
	this._sandboxManager.importObject(this._io);
}

/**
 * @property {Array[]} search Item (in {@link Zotero.Item#serialize} format) to extrapolate data
 *    (set with setSearch)
 */
Zotero.Translate.Search = function() {
	this.init();
};
Zotero.Translate.Search.prototype = new Zotero.Translate.Base();
Zotero.Translate.Search.prototype.type = "search";
Zotero.Translate.Search.prototype._entryFunctionSuffix = "Search";
Zotero.Translate.Search.prototype.Sandbox = Zotero.Translate.Sandbox._inheritFromBase(Zotero.Translate.Sandbox.Search);

/**
 * @borrows Zotero.Translate.Web#setCookieManager as Zotero.Translate.Search#setCookieManager
 */
Zotero.Translate.Search.prototype.setCookieManager = Zotero.Translate.Web.prototype.setCookieManager;

/**
 * Sets the item to be used for searching
 * @param {Object} item An item, with as many fields as desired, in the format returned by
 *     {@link Zotero.Item#serialize}
 */
Zotero.Translate.Search.prototype.setSearch = function(search) {
	this.search = search;
}

/**
 * Sets the translator or translators to be used for search
 *
 * @param {Zotero.Translator|string} Translator object or ID
 */
Zotero.Translate.Search.prototype.setTranslator = function(translator) {
	if(typeof translator == "object" && !translator.translatorID) {
		// we have an array of translators
		
		// accept a list of objects
		this.translator = [];
		for(var i in translator) {
			if(typeof(translator[i]) == "object") {
				this.translator.push(translator[i]);
			} else {
				this.translator.push(Zotero.Translators.get(translator[i]));
			}
		}
		return true;
	} else {
		return Zotero.Translate.Base.prototype.setTranslator.apply(this, [translator]);
	}
}

/**
 * Overload Zotero.Translate.Base#complete to move onto the next translator if
 * translation fails
 */
Zotero.Translate.Search.prototype.complete = function(returnValue, error) {
	if(this._currentState == "translate" && !returnValue) {
		Zotero.debug("Translate: Could not find a result using "+this.translator[0].label+": \n"
					  +this._generateErrorString(error), 3);
		if(this.translator.length > 1) {
			this.translator.shift();
			this.translate(this._libraryID, this.saveAttachments);
			return;
		}
	}
	
	// call super
	Zotero.Translate.Base.prototype.complete.apply(this, [returnValue, error]);
}

/**
 * Pass search item to detect* and do* functions
 */
Zotero.Translate.Search.prototype._getParameters = function() { return [this.search]; };

/**
 * Extract sandbox location from translator target
 */
Zotero.Translate.Search.prototype._getSandboxLocation = function() {
	// generate sandbox for search by extracting domain from translator target
	if(this.translator && this.translator[0] && this.translator[0].target) {
		// so that web translators work too
		const searchSandboxRe = /^http:\/\/[\w.]+\//;
		var tempURL = this.translator[0].target.replace(/\\/g, "").replace(/\^/g, "");
		var m = searchSandboxRe.exec(tempURL);
		if(m) return m[0];
	}
	return Zotero.Translate.Base.prototype._getSandboxLocation.call(this);
}

Zotero.Translate.Search.prototype._prepareTranslation = Zotero.Translate.Web.prototype._prepareTranslation;

/**
 * IO-related functions
 * @namespace
 */
Zotero.Translate.IO = {
	/**
	 * Parses XML using DOMParser
	 */
	"parseDOMXML":function(input, charset, size) {
		try {
			var dp = new DOMParser();
		} catch(e) {
			try {
				var dp = Components.classes["@mozilla.org/xmlextras/domparser;1"]
				   .createInstance(Components.interfaces.nsIDOMParser);
			} catch(e) {
				throw "DOMParser not supported";
			}
		}
		
		if(typeof input == "string") {
			var nodes = dp.parseFromString(input, "text/xml");
		} else {
			var nodes = dp.parseFromStream(input, charset, size, "text/xml");
		}
		
		if(nodes.getElementsByTagName("parsererror").length) {
			throw("DOMParser error: loading data into data store failed");
		}
		
		return nodes;
	},
	
	/**
	 * Names of RDF data modes
	 */
	"rdfDataModes":["rdf", "rdf/xml", "rdf/n3"]
};

/******* String support *******/

Zotero.Translate.IO.String = function(string, uri, mode) {
	if(string && typeof string === "string") {
		this._string = string;
	} else {
		this._string = "";
	}
	this._stringPointer = 0;
	this._uri = uri;
	
	if(mode) {
		this.reset(mode);
	}
}

Zotero.Translate.IO.String.prototype = {
	"__exposedProps__":["RDF", "read", "write", "setCharacterSet", "_getXML"],
	
	"_initRDF":function() {
		Zotero.debug("Translate: Initializing RDF data store");
		this._dataStore = new Zotero.RDF.AJAW.RDFIndexedFormula();
		
		if(this._string.length) {
			var parser = new Zotero.RDF.AJAW.RDFParser(this._dataStore);
			parser.parse(Zotero.Translate.IO.parseDOMXML(this._string), this._uri);
		}
		
		this.RDF = new Zotero.Translate.IO._RDFSandbox(this._dataStore);
	},
	
	"setCharacterSet":function(charset) {},
	
	"read":function(bytes) {
		// if we are reading in RDF data mode and no string is set, serialize current RDF to the
		// string
		if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1 && this._string === "") {
			this._string = this.RDF.serialize();
		}
		
		// return false if string has been read
		if(this._stringPointer >= this._string.length) {
			return false;
		}
		
		if(bytes !== undefined) {
			if(this._stringPointer >= this._string.length) return false;
			var oldPointer = this._stringPointer;
			this._stringPointer += bytes;
			return this._string.substr(oldPointer, bytes);
		} else {
			// bytes not specified; read a line
			var oldPointer = this._stringPointer;
			var lfIndex = this._string.indexOf("\n", this._stringPointer);
			
			if(lfIndex != -1) {
				// in case we have a CRLF
				this._stringPointer = lfIndex+1;
				if(this._string.length > lfIndex && this._string[lfIndex-1] == "\r") {
					lfIndex--;
				}
				return this._string.substr(oldPointer, lfIndex-oldPointer);					
			}
			
			var crIndex = this._string.indexOf("\r", this._stringPointer);
			if(crIndex != -1) {
				this._stringPointer = crIndex+1;
				return this._string.substr(oldPointer, crIndex-oldPointer-1);
			}
			
			this._stringPointer = this._string.length;
			return this._string.substr(oldPointer);
		}
	},
	
	"write":function(data) {
		this._string += data;
	},
	
	"_getXML":function() {
		if(this._mode == "xml/dom") {
			return Zotero.Translate.IO.parseDOMXML(this._string);
		} else {
			return this._string.replace(/<\?xml[^>]+\?>/, "");
		}
	},
	
	"reset":function(newMode) {
		this._stringPointer = 0;
		
		this._mode = newMode;
		if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1) {
			this._initRDF();
		}
	},
	
	"close":function() {}
}
Zotero.Translate.IO.String.prototype.__defineGetter__("string",
function() {
	if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1) {
		return this.RDF.serialize();
	} else {
		return this._string;
	}
});
Zotero.Translate.IO.String.prototype.__defineSetter__("string",
function(string) {
	this._string = string;
});

/****** RDF DATA MODE ******/

/**
 * @class An API for handling RDF from the sandbox. This is exposed to translators as Zotero.RDF.
 *
 * @property {Zotero.RDF.AJAW.RDFIndexedFormula} _dataStore
 * @property {Integer[]} _containerCounts
 * @param {Zotero.RDF.AJAW.RDFIndexedFormula} dataStore
 */
Zotero.Translate.IO._RDFSandbox = function(dataStore) {
	this._dataStore = dataStore;
}

Zotero.Translate.IO._RDFSandbox.prototype = {
	"_containerCounts":[],
	"__exposedProps__":["addStatement", "newResource", "newContainer", "addContainerElement",
		"getContainerElements", "addNamespace", "getAllResources", "getResourceURI", "getArcsIn",
		"getArcsOut", "getSources", "getTargets", "getStatementsMatching"],
	
	/**
	 * Gets a resource as a Zotero.RDF.AJAW.RDFSymbol, rather than a string
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} about
	 * @return {Zotero.RDF.AJAW.RDFSymbol}
	 */
	"_getResource":function(about) {
		return (typeof about == "object" ? about : new Zotero.RDF.AJAW.RDFSymbol(about));
	},
	
	/**
	 * Runs a callback to initialize this RDF store
	 */
	"_init":function() {
		if(this._prepFunction) {
			this._dataStore = this._prepFunction();
			delete this._prepFunction;
		}
	},
	
	/**
	 * Serializes the current RDF to a string
	 */
	"serialize":function(dataMode) {
		var serializer = Serializer();
		
		for(var prefix in this._dataStore.namespaces) {
			serializer.suggestPrefix(prefix, this._dataStore.namespaces[prefix]);
		}
		
		// serialize in appropriate format
		if(dataMode == "rdf/n3") {
			return serializer.statementsToN3(this._dataStore.statements);
		}
		
		return serializer.statementsToXML(this._dataStore.statements);
	},
	
	/**
	 * Adds an RDF triple
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} about
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} relation
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} value
	 * @param {Boolean} literal Whether value should be treated as a literal (true) or a resource
	 *     (false)
	 */
	"addStatement":function(about, relation, value, literal) {
		if(literal) {
			// zap chars that Mozilla will mangle
			value = value.toString().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
		} else {
			value = this._getResource(value);
		}
		
		this._dataStore.add(this._getResource(about), this._getResource(relation), value);
	},
	
	/**
	 * Creates a new anonymous resource
	 * @return {Zotero.RDF.AJAW.RDFSymbol}
	 */
	"newResource":function() {
		return new Zotero.RDF.AJAW.RDFBlankNode();
	},
	
	/**
	 * Creates a new container resource
	 * @param {String} type The type of the container ("bag", "seq", or "alt")
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} about The URI of the resource
	 * @return {Zotero.Translate.RDF.prototype.newContainer
	 */
	"newContainer":function(type, about) {
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
	},
	
	/**
	 * Adds a new element to a container
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} about The container
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} element The element to add to the container
	 * @param {Boolean} literal Whether element should be treated as a literal (true) or a resource
	 *     (false)
	 */
	"addContainerElement":function(about, element, literal) {
		const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
	
		var about = this._getResource(about);
		this._dataStore.add(about, new Zotero.RDF.AJAW.RDFSymbol(rdf+"_"+(this._containerCounts[about.toNT()]++)), element, literal);
	},
	
	/**
	 * Gets all elements within a container
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} about The container
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 */
	"getContainerElements":function(about) {
		const liPrefix = "http://www.w3.org/1999/02/22-rdf-syntax-ns#_";
		
		var about = this._getResource(about);
		var statements = this._dataStore.statementsMatching(about);
		var containerElements = [];
		
		// loop over arcs out looking for list items
		for(var i=0; i<statements.length; i++) {
			var statement = statements[i];
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
	},
	
	/**
	 * Adds a namespace for a specific URI
	 * @param {String} prefix Namespace prefix
	 * @param {String} uri Namespace URI
	 */
	"addNamespace":function(prefix, uri) {
		this._dataStore.setPrefixForURI(prefix, uri);
	},
	
	/**
	 * Gets the URI a specific resource
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} resource
	 * @return {String}
	 */
	"getResourceURI":function(resource) {
		if(typeof(resource) == "string") return resource;
		if(resource.uri) return resource.uri;
		if(resource.toNT == undefined) throw "Zotero.RDF: getResourceURI called on invalid resource";
		return resource.toNT();
	},
	
	/**
	 * Gets all resources in the RDF data store
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 */
	"getAllResources":function() {
		var returnArray = [];
		for(var i in this._dataStore.subjectIndex) {
			returnArray.push(this._dataStore.subjectIndex[i][0].subject);
		}
		return returnArray;
	},
	
	/**
	 * Gets all arcs (predicates) into a resource
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 * @deprecated Since 2.1. Use {@link Zotero.Translate.IO["rdf"]._RDFBase#getStatementsMatching}
	 */
	"getArcsIn":function(resource) {
		var statements = this._dataStore.objectIndex[this._dataStore.canon(this._getResource(resource))];
		if(!statements) return false;
		
		var returnArray = [];
		for(var i=0; i<statements.length; i++) {
			returnArray.push(statements[i].predicate.uri);
		}
		return returnArray;
	},
	
	/**
	 * Gets all arcs (predicates) out of a resource
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 * @deprecated Since 2.1. Use {@link Zotero.Translate.IO["rdf"]._RDFBase#getStatementsMatching}
	 */
	"getArcsOut":function(resource) {
		var statements = this._dataStore.subjectIndex[this._dataStore.canon(this._getResource(resource))];
		if(!statements) return false;
		
		var returnArray = [];
		for(var i=0; i<statements.length; i++) {
			returnArray.push(statements[i].predicate.uri);
		}
		return returnArray;
	},
	
	/**
	 * Gets all subjects whose predicates point to a resource
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} resource Subject that predicates should point to
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} property Predicate
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 * @deprecated Since 2.1. Use {@link Zotero.Translate.IO["rdf"]._RDFBase#getStatementsMatching}
	 */
	"getSources":function(resource, property) {
		var statements = this._dataStore.statementsMatching(undefined, this._getResource(property), this._getResource(resource));
		if(!statements.length) return false;
		
		var returnArray = [];
		for(var i=0; i<statements.length; i++) {
			returnArray.push(statements[i].subject);
		}
		return returnArray;
	},
	
	/**
	 * Gets all objects of a given subject with a given predicate
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} resource Subject
	 * @param {String|Zotero.RDF.AJAW.RDFSymbol} property Predicate
	 * @return {Zotero.RDF.AJAW.RDFSymbol[]}
	 * @deprecated Since 2.1. Use {@link Zotero.Translate.IO["rdf"]._RDFBase#getStatementsMatching}
	 */
	"getTargets":function(resource, property) {
		var statements = this._dataStore.statementsMatching(this._getResource(resource), this._getResource(property));
		if(!statements.length) return false;
		
		var returnArray = [];
		for(var i=0; i<statements.length; i++) {
			returnArray.push(statements[i].object.termType == "literal" ? statements[i].object.toString() : statements[i].object);
		}
		return returnArray;
	},
	
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
	"getStatementsMatching":function(subj, pred, obj, objLiteral, justOne) {
		var statements = this._dataStore.statementsMatching(
			(subj ? this._getResource(subj) : undefined),
			(pred ? this._getResource(pred) : undefined),
			(obj ? (objLiteral ? objLiteral : this._getResource(obj)) : undefined),
			undefined, justOne);
		if(!statements.length) return false;
		
		
		var returnArray = [];
		for(var i=0; i<statements.length; i++) {
			returnArray.push([statements[i].subject, statements[i].predicate, (statements[i].object.termType == "literal" ? statements[i].object.toString() : statements[i].object)]);
		}
		return returnArray;
	}
};