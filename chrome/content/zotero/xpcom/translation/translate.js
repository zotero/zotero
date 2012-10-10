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

/**
 * @class
 * Deprecated class for creating new Zotero.Translate instances<br/>
 * <br/>
 * New code should use Zotero.Translate.Web, Zotero.Translate.Import, Zotero.Translate.Export, or
 * Zotero.Translate.Search
 */
Zotero.Translate = function(type) {
	Zotero.debug("Translate: WARNING: new Zotero.Translate() is deprecated; please don't use this if you don't have to");
	// hack
	var translate = Zotero.Translate.newInstance(type);
	for(var i in translate) {
		this[i] = translate[i];
	}
	this.constructor = translate.constructor;
	this.__proto__ = translate.__proto__;
}

/**
 * Create a new translator by a string type
 */
Zotero.Translate.newInstance = function(type) {
	return new Zotero.Translate[type.substr(0, 1).toUpperCase()+type.substr(1).toLowerCase()];
}

/**
 * Namespace for Zotero sandboxes
 * @namespace
 */
Zotero.Translate.Sandbox = {
	/**
	 * Combines a sandbox with the base sandbox
	 */
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
	
	/**
	 * Base sandbox. These methods are available to all translators.
	 * @namespace
	 */
	"Base": {
		/**
		 * Called as {@link Zotero.Item#complete} from translators to save items to the database.
		 * @param {Zotero.Translate} translate
		 * @param {SandboxItem} An item created using the Zotero.Item class from the sandbox
		 */
		"_itemDone":function(translate, item) {
			//Zotero.debug("Translate: Saving item");
			
			// warn if itemDone called after translation completed
			if(translate._complete) {
				Zotero.debug("Translate: WARNING: Zotero.Item#complete() called after Zotero.done(); please fix your code", 2);
			}
				
			const allowedObjects = ["complete", "attachments", "seeAlso", "creators", "tags", "notes"];
			
			delete item.complete;
			for(var i in item) {
				var val = item[i];
				var type = typeof val;
				if(!val && val !== 0) {
					// remove null, undefined, and false properties, and convert objects to strings
					delete item[i];
				} else if(type === "string") {
					// trim strings
					item[i] = val.trim();
				} else if((type === "object" || type === "xml" || type === "function") && allowedObjects.indexOf(i) === -1) {
					// convert things that shouldn't be objecst to objects
					translate._debug("Translate: WARNING: typeof "+i+" is "+type+"; converting to string");
					item[i] = val.toString();
				}
			}
			
			// if we're not supposed to save the item or we're in a child translator,
			// just return the item array
			if(translate._libraryID === false || translate._parentTranslator) {
				translate.newItems.push(item);
				translate._runHandler("itemDone", item, item);
				return;
			}
			
			// We use this within the connector to keep track of items as they are saved
			if(!item.id) item.id = Zotero.Utilities.randomString();
			
			// don't save documents as documents in connector, since we can't pass them around
			if(Zotero.isConnector) {
				var attachments = item.attachments;
				var nAttachments = attachments.length;
				for(var j=0; j<nAttachments; j++) {
					if(attachments[j].document) {
						attachments[j].url = attachments[j].document.location.href;
						attachments[j].mimeType = "text/html";
						delete attachments[j].document;
					}
				}
			}
		
			// Fire itemSaving event
			translate._runHandler("itemSaving", item);
			
			if(translate instanceof Zotero.Translate.Web) {
				// For web translators, we queue saves
				translate.saveQueue.push(item);
			} else {
				// Save items
				translate._saveItems([item]);
			}
		},
		
		/**
		 * Gets translator options that were defined in displayOptions in translator header
		 *
		 * @param {Zotero.Translate} translate
		 * @param {String} option Option to be retrieved
		 */
		"getOption":function(translate, option) {
			if(typeof option !== "string") {
				throw(new Error("getOption: option must be a string"));
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
						translation.setHandler("itemDone", function(obj, item) {
							translate.Sandbox._itemDone(translate, item);
						});
					}
					translation.setHandler("selectItems", translate._handlers["selectItems"]);
				}
			}
			
			if(typeof type !== "string") {
				throw(new Error("loadTranslator: type must be a string"));
				return;
			}
			
			Zotero.debug("Translate: Creating translate instance of type "+type+" in sandbox");
			var translation = Zotero.Translate.newInstance(type);
			translation._parentTranslator = translate;
			
			if(translation instanceof Zotero.Translate.Export && !(translation instanceof Zotero.Translate.Export)) {
				throw(new Error("Only export translators may call other export translators"));
			}
			
			/**
			 * @class Wrapper for {@link Zotero.Translate} for safely calling another translator 
			 * from inside an existing translator
			 * @inner
			 */
			var safeTranslator = {};
			safeTranslator.__exposedProps__ = {
				"setSearch":"r",
				"setDocument":"r",
				"setHandler":"r",
				"setString":"r",
				"setTranslator":"r",
				"getTranslators":"r",
				"translate":"r",
				"getTranslatorObject":"r"
			};
			safeTranslator.setSearch = function(arg) {
				if(!Zotero.isBookmarklet) arg = JSON.parse(JSON.stringify(arg));
				return translation.setSearch(arg);
			};
			safeTranslator.setDocument = function(arg) { return translation.setDocument(arg) };
			var errorHandlerSet = false;
			safeTranslator.setHandler = function(arg1, arg2) {
				if(arg1 === "error") errorHandlerSet = true;
				translation.setHandler(arg1, 
					function(obj, item) {
						try {
							if(arg1 == "itemDone") {
								if(Zotero.isFx && !Zotero.isBookmarklet
										&& (translate instanceof Zotero.Translate.Web
										|| translate instanceof Zotero.Translate.Search)) {
									// Necessary to get around object wrappers in Firefox
									var attachments = item.attachments;
									
									item.attachments = [];
									item = translate._sandboxManager.sandbox.Zotero._transferItem(JSON.stringify(item));
									
									// Manually copy attachments in case there are documents, which
									// can't be serialized and don't need to be
									if(attachments) {
										for(var i=0; i<attachments.length; i++) {
											var attachment = attachments[i];
											var doc = (attachment.document ? attachment.document : undefined);
											delete attachment.document;
											
											attachment = translate._sandboxManager.sandbox.Zotero._transferItem(JSON.stringify(attachment));
											
											if(doc) attachment.document = doc;
											
											item.attachments.push(attachment);
										}
									}
								} else {
									// otherwise, just use parent translator's complete function
									item.complete = translate._sandboxManager.sandbox.Zotero.Item.prototype.complete;
								}
							}
							arg2(obj, item);
						} catch(e) {
							translate.complete(false, e);
						}
					}
				);
			};
			safeTranslator.setString = function(arg) { translation.setString(arg) };
			safeTranslator.setTranslator = function(arg) {
				var success = translation.setTranslator(arg);
				if(!success) {
					throw new Error("Translator "+translate.translator[0].translatorID+" attempted to call invalid translatorID "+arg);
				}
			};
			
			var translatorsHandlerSet = false;
			safeTranslator.getTranslators = function() {
				if(!translation._handlers["translators"] || !translation._handlers["translators"].length) {
					if(Zotero.isConnector) {
						throw new Error('Translator must register a "translators" handler to '+
							'call getTranslators() in this translation environment.');
					} else {
						translate._debug('COMPAT WARNING: Translator must register a "translators" handler to '+
							'call getTranslators() in connector');
					}
				}
				if(!translatorsHandlerSet) {
					translation.setHandler("translators", function() {
						translate.decrementAsyncProcesses("safeTranslator#getTranslators()");
					});
				}
				translate.incrementAsyncProcesses("safeTranslator#getTranslators()");
				return translation.getTranslators();
			};
			
			var doneHandlerSet = false;
			safeTranslator.translate = function() {
				translate.incrementAsyncProcesses("safeTranslator#translate()");
				setDefaultHandlers(translate, translation);
				if(!doneHandlerSet) {
					doneHandlerSet = true;
					translation.setHandler("done", function() { translate.decrementAsyncProcesses("safeTranslator#translate()") });
				}
				if(!errorHandlerSet) {
					errorHandlerSet = true;
					translation.setHandler("error", function(obj, error) { translate.complete(false, error) });
				}
				return translation.translate(false);
			};
			
			safeTranslator.getTranslatorObject = function(callback) {
				if(callback) {
					translate.incrementAsyncProcesses("safeTranslator#getTranslatorObject()");
				} else {
					translate._debug("COMPAT WARNING: Translator must pass a callback to getTranslatorObject() to operate in connector");
				}
				
				var sandbox;
				var haveTranslatorFunction = function(translator) {
					translation.translator[0] = translator;
					translation._loadTranslator(translator, function() {
						if(Zotero.isFx && !Zotero.isBookmarklet) {
							// do same origin check
							var secMan = Components.classes["@mozilla.org/scriptsecuritymanager;1"]
								.getService(Components.interfaces.nsIScriptSecurityManager);
							var ioService = Components.classes["@mozilla.org/network/io-service;1"] 
								.getService(Components.interfaces.nsIIOService);
							
							var outerSandboxURI = ioService.newURI(typeof translate._sandboxLocation === "object" ?
								translate._sandboxLocation.location : translate._sandboxLocation, null, null);
							var innerSandboxURI = ioService.newURI(typeof translation._sandboxLocation === "object" ?
								translation._sandboxLocation.location : translation._sandboxLocation, null, null);
							
							try {
								secMan.checkSameOriginURI(outerSandboxURI, innerSandboxURI, false);
							} catch(e) {
								throw new Error("getTranslatorObject() may not be called from web or search "+
									"translators to web or search translators from different origins.");
							}
						}
						
						translation._prepareTranslation();
						setDefaultHandlers(translate, translation);
						sandbox = translation._sandboxManager.sandbox;
						if(!Zotero.Utilities.isEmpty(sandbox.exports)) {
							sandbox.exports.Zotero = sandbox.Zotero;
							sandbox = sandbox.exports;
						} else {
							translate._debug("COMPAT WARNING: "+translation.translator[0].label+" does "+
								"not export any properties. Only detect"+translation._entryFunctionSuffix+
								" and do"+translation._entryFunctionSuffix+" will be available in "+
								"connectors.");
						}
						
						if(callback) {
							try {
								callback(sandbox);
							} catch(e) {
								translate.complete(false, e);
								return;
							}
							translate.decrementAsyncProcesses("safeTranslator#getTranslatorObject()");
						}
					});
				};
				
				if(typeof translation.translator[0] === "object") {
					haveTranslatorFunction(translation.translator[0]);
					return translation._sandboxManager.sandbox;
				} else {
					if(Zotero.isConnector && (!Zotero.isFx || Zotero.isBookmarklet) && !callback) {
						throw new Error("Translator must pass a callback to getTranslatorObject() to "+
							"operate in this translation environment.");
					}
					
					Zotero.Translators.get(translation.translator[0], haveTranslatorFunction);
					if(Zotero.isConnector && Zotero.isFx && !callback) {
						while(!sandbox && translate._currentState) {
							// This processNextEvent call is used to handle a deprecated case
							Zotero.mainThread.processNextEvent(true);
						}
					}
					if(sandbox) return sandbox;
				}
			};
			
			// TODO security is not super-tight here, as someone could pass something into arg
			// that gets evaluated in the wrong scope in Fx < 4. We should wrap this.
			
			return safeTranslator;
		},
		
		/**
		 * Enables asynchronous detection or translation
		 * @param {Zotero.Translate} translate
		 * @deprecated
		 */
		"wait":function(translate) {},
		
		/**
		 * Sets the return value for detection
		 *
		 * @param {Zotero.Translate} translate
		 */
		"done":function(translate, returnValue) {
			if(translate._currentState === "detect") {
				translate._returnValue = returnValue;
			}
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
		 * @param {Zotero.Translate} translate
		 * @param {Object} items An set of id => name pairs in object format
		 */
		"selectItems":function(translate, items, callback) {
			function transferObject(obj) {
				return Zotero.isFx ? translate._sandboxManager.sandbox.JSON.parse(JSON.stringify(obj)) : obj;
			}
			
			if(Zotero.Utilities.isEmpty(items)) {
				throw new Error("Translator called select items with no items");
			}
			
			// Some translators pass an array rather than an object to Zotero.selectItems.
			// This will break messaging outside of Firefox, so we need to fix it.
			if(Object.prototype.toString.call(items) === "[object Array]") {
				translate._debug("WARNING: Zotero.selectItems should be called with an object, not an array");
				var itemsObj = {};
				for(var i in items) itemsObj[i] = items[i];
				items = itemsObj;
			}
			
			if(translate._selectedItems) {
				// if we have a set of selected items for this translation, use them
				return transferObject(translate._selectedItems);
			} else if(translate._handlers.select) {
					// whether the translator supports asynchronous selectItems
					var haveAsyncCallback = !!callback;
					// whether the handler operates asynchronously
					var haveAsyncHandler = false;
					var returnedItems = null;
					
					var callbackExecuted = false;
					if(haveAsyncCallback) {
						// if this translator provides an async callback for selectItems, rig things
						// up to pop off the async process
						var newCallback = function(selectedItems) {
							callbackExecuted = true;
							callback(transferObject(selectedItems));
							if(haveAsyncHandler) translate.decrementAsyncProcesses("Zotero.selectItems()");
						};
					} else {
						// if this translator doesn't provide an async callback for selectItems, set things
						// up so that we can wait to see if the select handler returns synchronously. If it
						// doesn't, we will need to restart translation.
						var newCallback = function(selectedItems) {
							callbackExecuted = true;
							if(haveAsyncHandler) {
								translate.translate(translate._libraryID, translate._saveAttachments, selectedItems);
							} else {
								returnedItems = transferObject(selectedItems);
							}
						};
					}
					
					var returnValue = translate._runHandler("select", items, newCallback);
					if(returnValue !== undefined) {
						// handler may have returned a value, which makes callback unnecessary
						Zotero.debug("WARNING: Returning items from a select handler is deprecated. "+
							"Please pass items as to the callback provided as the third argument to "+
							"the handler.");
						
						returnedItems = transferObject(returnValue);
						haveAsyncHandler = false;
					} else {
						// if we don't have returnedItems set already, the handler is asynchronous
						haveAsyncHandler = !callbackExecuted;
					}
					
					if(haveAsyncCallback) {
						if(haveAsyncHandler) {
							// we are running asynchronously, so increment async processes
							translate.incrementAsyncProcesses("Zotero.selectItems()");
						} else if(!callbackExecuted) {
							// callback didn't get called from handler, so call it here
							callback(returnedItems);
						}
						return false;
					} else {
						translate._debug("COMPAT WARNING: No callback was provided for "+
							"Zotero.selectItems(). When executed outside of Firefox, a selectItems() call "+
							"will require this translator to be called multiple times.", 1);
						
						if(haveAsyncHandler) {
							// The select handler is asynchronous, but this translator doesn't support
							// asynchronous select. We return false to abort translation in this
							// instance, and we will restart it later when the selectItems call is
							// complete.
							translate._aborted = true;
							return false;
						} else {
							return returnedItems;
						}
					}
			} else { // no handler defined; assume they want all of them
				if(callback) callback(items);
				return items;
			}
		},
		
		/**
		 * Overloads {@link Zotero.Translate.Sandbox.Base._itemDone} to ensure that no standalone
		 * items are saved, that an item type is specified, and to add a libraryCatalog and 
		 * shortTitle if relevant.
		 * @param {Zotero.Translate} translate
		 * @param {SandboxItem} An item created using the Zotero.Item class from the sandbox
		 */
		 "_itemDone":function(translate, item) {
		 	// Only apply checks if there is no parent translator
		 	if(!translate._parentTranslator) {
				if(!item.itemType) {
					item.itemType = "webpage";
					translate._debug("WARNING: No item type specified");
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
				
				if(!item.title) {
					translate.complete(false, new Error("No title specified for item"));
					return;
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
				
				// refuse to save very long tags
				if(item.tags) {
					for(var i=0; i<item.tags.length; i++) {
						var tag = item.tags[i];
							tagString = typeof tag === "string" ? tag :
								typeof tag === "object" ? (tag.tag || tag.name) : null;
						if(tagString && tagString.length > 255) {
							translate._debug("WARNING: Skipping unsynchable tag "+JSON.stringify(tagString));
							item.tags.splice(i--, 1);
						}
					}
				}
			}
			
			// call super
			Zotero.Translate.Sandbox.Base._itemDone(translate, item);
		}
	},

	/**
	 * Import functions exposed to sandbox
	 * @namespace
	 */
	"Import":{
		/**
		 * Saves a collection to the DB
		 * Called as {@link Zotero.Collection#complete} from the sandbox
		 * @param {Zotero.Translate} translate
		 * @param {SandboxCollection} collection
		 */
		"_collectionDone":function(translate, collection) {
			if(translate._libraryID == false) {
				translate.newCollections.push(collection);
				translate._runHandler("collectionDone", collection);
			} else {
				var newCollection = translate._itemSaver.saveCollection(collection);
				translate.newCollections.push(newCollection);
				translate._runHandler("collectionDone", newCollection);
			}
		},
		
		/**
		 * Sets the value of the progress indicator associated with export as a percentage
		 * @param {Zotero.Translate} translate
		 * @param {Number} value
		 */
		"setProgress":function(translate, value) {
			if(typeof value !== "number") {
				translate._progress = null;
			} else {
				translate._progress = value;
			}
		}
	},

	/**
	 * Export functions exposed to sandbox
	 * @namespace
	 */
	"Export":{
		/**
		 * Retrieves the next item to be exported
		 * @param {Zotero.Translate} translate
		 * @return {SandboxItem}
		 */
		"nextItem":function(translate) {
			var item = translate._itemGetter.nextItem();
			
			if(translate._displayOptions.hasOwnProperty("exportTags") && !translate._displayOptions["exportTags"]) {
				item.tags = [];
			}
			
			translate._runHandler("itemDone", item);
			
			return item;
		},
		
		/**
		 * Retrieves the next collection to be exported
		 * @param {Zotero.Translate} translate
		 * @return {SandboxCollection}
		 */
		"nextCollection":function(translate) {
			if(!translate.translator[0].configOptions.getCollections) {
				throw(new Error("getCollections configure option not set; cannot retrieve collection"));
			}
			
			return translate._itemGetter.nextCollection();
		},
		
		/**
		 * @borrows Zotero.Translate.Sandbox.Import.setProgress as this.setProgress
		 */
		"setProgress":function(translate, value) {
			Zotero.Translate.Sandbox.Import.setProgress(translate, value);
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
			// Always set library catalog, even if we have a parent translator
			if(item.libraryCatalog === undefined) {
				item.libraryCatalog = translate.translator[0].label;
			}
			
			Zotero.Translate.Sandbox.Web._itemDone(translate, item);
		}
	}
}

/**
 * @class Base class for all translation types
 *
 * @property {String} type The type of translator. This is deprecated; use instanceof instead.
 * @property {Zotero.Translator[]} translator The translator currently in use. Usually, only the
 *     first entry of the Zotero.Translator array is populated; subsequent entries represent
 *     translators to be used if the first fails.
 * @property {String} path The path or URI string of the target
 * @property {String} newItems Items created when translate() was called
 * @property {String} newCollections Collections created when translate() was called
 * @property {Number} runningAsyncProcesses The number of async processes that are running. These
 *                                          need to terminate before Zotero.done() is called.
 */
Zotero.Translate.Base = function() {}
Zotero.Translate.Base.prototype = {
	/**
	 * Initializes a Zotero.Translate instance
	 */
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
			throw new Error("No translator specified");
		}
		
		this.translator = null;
		this._setDisplayOptions = null;
		
		if(typeof(translator) == "object") {	// passed an object and not an ID
			if(translator.translatorID) {
				this.translator = [translator];
			} else {
				throw(new Error("No translatorID specified"));
			}
		} else {
			this.translator = [translator];
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

	/**
	 * Clears all handlers for a given function
	 * @param {String} type See {@link Zotero.Translate.Base#setHandler} for valid values
	 */
	"clearHandlers":function(type) {
		this._handlers[type] = new Array();
	},

	/**
	 * Clears a single handler for a given function
	 * @param {String} type See {@link Zotero.Translate.Base#setHandler} for valid values
	 * @param {Function} handler Callback function to remove
	 */
	"removeHandler":function(type, handler) {
		var handlerIndex = this._handlers[type].indexOf(handler);
		if(handlerIndex !== -1) this._handlers[type].splice(handlerIndex, 1);
	},
	
	/**
	 * Indicates that a new async process is running
	 */
	"incrementAsyncProcesses":function(f) {
		this._runningAsyncProcesses++;
		if(this._parentTranslator) {
			this._parentTranslator.incrementAsyncProcesses(f+" from child translator");
		} else {
			//Zotero.debug("Translate: Incremented asynchronous processes to "+this._runningAsyncProcesses+" for "+f, 4);
			//Zotero.debug((new Error()).stack);
		}
	},
	
	/**
	 * Indicates that a new async process is finished
	 */
	"decrementAsyncProcesses":function(f, by) {
		this._runningAsyncProcesses -= (by ? by : 1);
		if(!this._parentTranslator) {
			//Zotero.debug("Translate: Decremented asynchronous processes to "+this._runningAsyncProcesses+" for "+f, 4);
			//Zotero.debug((new Error()).stack);
		}
		if(this._runningAsyncProcesses === 0) {
			this.complete();
		}
		if(this._parentTranslator) this._parentTranslator.decrementAsyncProcesses(f+" from child translator", by);
	},

	/**
	 * Clears all handlers for a given function
	 * @param {String} type See {@link Zotero.Translate.Base#setHandler} for valid values
	 * @param {Any} argument Argument to be passed to handler
	 */
	"_runHandler":function(type) {
		var returnValue = undefined;
		if(this._handlers[type]) {
			// compile list of arguments
			if(this._parentTranslator) {
				// if there is a parent translator, make sure we don't the Zotero.Translate
				// object, since it could open a security hole
				var args = [null];
			} else {
				var args = [this];
			}
			for(var i=1; i<arguments.length; i++) {
				args.push(arguments[i]);
			}
			
			var handlers = this._handlers[type].slice();
			for(var i=0, n=handlers.length; i<n; i++) {
				Zotero.debug("Translate: Running handler "+i+" for "+type, 5);
				try {
					returnValue = handlers[i].apply(null, args);
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
						Zotero.logError(e);
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
	 * @param {Boolean} [getAllTranslators] Whether all applicable translators should be returned,
	 *     rather than just the first available.
	 * @param {Boolean} [checkSetTranslator] If true, the appropriate detect function is run on the
	 *     set document/text/etc. using the translator set by setTranslator.
	 *     getAllTranslators parameter is meaningless in this context.
	 * @return {Zotero.Translator[]} An array of {@link Zotero.Translator} objects
	 */
	"getTranslators":function(getAllTranslators, checkSetTranslator) {
		// do not allow simultaneous instances of getTranslators
		if(this._currentState === "detect") throw new Error("getTranslators: detection is already running");
		this._currentState = "detect";
		this._getAllTranslators = getAllTranslators;

		if(checkSetTranslator) {
			// setTranslator must be called beforehand if checkSetTranslator is set
			if( !this.translator || !this.translator[0] ) {
				throw new Error("getTranslators: translator must be set via setTranslator before calling" +
													" getTranslators with the checkSetTranslator flag");
			}
			var translators = new Array();
			var t;
			for(var i=0, n=this.translator.length; i<n; i++) {
				if(typeof(this.translator[i]) == 'string') {
					t = Zotero.Translators.get(this.translator[i]);
					if(!t) Zotero.debug("getTranslators: could not retrieve translator '" + this.translator[i] + "'");
				} else {
					t = this.translator[i];
				}
				/**TODO: check that the translator is of appropriate type?*/
				if(t) translators.push(t);
			}
			if(!translators.length) throw new Error("getTranslators: no valid translators were set.");
			this._getTranslatorsTranslatorsReceived(translators);
		} else {
			this._getTranslatorsGetPotentialTranslators();
		}

		// if detection returns immediately, return found translators
		if(!this._currentState) return this._foundTranslators;
	},
	
	/**
	 * Get all potential translators
	 * @return {Zotero.Translator[]}
	 */
	"_getTranslatorsGetPotentialTranslators":function() {
		var me = this;
		Zotero.Translators.getAllForType(this.type,
			function(translators) { me._getTranslatorsTranslatorsReceived(translators) });
	},
	
	/**
	 * Called on completion of {@link #_getTranslatorsGetPotentialTranslators} call
	 */
	"_getTranslatorsTranslatorsReceived":function(allPotentialTranslators, properToProxyFunctions) {
		this._potentialTranslators = [];
		this._foundTranslators = [];
		
		// this gets passed out by Zotero.Translators.getWebTranslatorsForLocation() because it is
		// specific for each translator, but we want to avoid making a copy of a translator whenever
		// possible.
		this._properToProxyFunctions = properToProxyFunctions ? properToProxyFunctions : null;
		this._waitingForRPC = false;
		
		for(var i=0, n=allPotentialTranslators.length; i<n; i++) {
			var translator = allPotentialTranslators[i];
			if(translator.runMode === Zotero.Translator.RUN_MODE_IN_BROWSER) {
				this._potentialTranslators.push(translator);
			} else if(this instanceof Zotero.Translate.Web && Zotero.Connector) {
				this._waitingForRPC = true;
			}
		}
		
		if(this._waitingForRPC) {
			var me = this;
			Zotero.Connector.callMethod("detect", {"uri":this.location.toString(),
				"cookie":this.document.cookie,
				"html":this.document.documentElement.innerHTML},
				function(returnValue) { me._getTranslatorsRPCComplete(returnValue) });
		}
		
		this._detect();
	},
	
	/**
	 * Called on completion of detect RPC for
	 * {@link Zotero.Translate.Base#_getTranslatorsTranslatorsReceived}
	 */
	 "_getTranslatorsRPCComplete":function(rpcTranslators) {
		this._waitingForRPC = false;
		
		// if there are translators, add them to the list of found translators
		if(rpcTranslators) {
			for(var i=0, n=rpcTranslators.length; i<n; i++) {
				rpcTranslators[i].runMode = Zotero.Translator.RUN_MODE_ZOTERO_STANDALONE;
			}
			this._foundTranslators = this._foundTranslators.concat(rpcTranslators);
		}
		
		// call _detectTranslatorsCollected to return detected translators
		if(this._currentState === null) {
			this._detectTranslatorsCollected();
		}
	 },

	/**
	 * Begins the actual translation. At present, this returns immediately for import/export
	 * translators, but new code should use {@link Zotero.Translate.Base#setHandler} to register a 
	 * "done" handler to determine when execution of web/search translators is complete.
	 *
	 * @param 	{NULL|Integer|FALSE}	[libraryID=null]		Library in which to save items,
	 *																or NULL for default library;
	 *																if FALSE, don't save items
	 * @param 	{Boolean}				[saveAttachments=true]	Exclude attachments (e.g., snapshots) on import
	 */
	"translate":function(libraryID, saveAttachments) {		// initialize properties specific to each translation
		this._currentState = "translate";
		
		if(!this.translator || !this.translator.length) {
			throw new Error("Failed: no translator specified");
		}
		
		this._libraryID = libraryID;
		this._saveAttachments = saveAttachments === undefined || saveAttachments;
		this._savingAttachments = [];
		this._savingItems = 0;
		
		var me = this;
		if(typeof this.translator[0] === "object") {
			// already have a translator object, so use it
			this._loadTranslator(this.translator[0], function() { me._translateTranslatorLoaded() });
		} else {
			// need to get translator first
			Zotero.Translators.get(this.translator[0],
					function(translator) {
						me.translator[0] = translator;
						me._loadTranslator(translator, function() { me._translateTranslatorLoaded() });
					});
		}
	},
	
	/**
	 * Called when translator has been retrieved and loaded
	 */
	"_translateTranslatorLoaded":function() {
		if(!this.translator[0].code) {
			this.complete(false,
				new Error("Translator "+this.translator[0].label+" is unsupported within this environment"));
			return;
		}
		
		// set display options to default if they don't exist
		if(!this._displayOptions) this._displayOptions = this.translator[0].displayOptions;
		
		// prepare translation
		this._prepareTranslation();
		
		Zotero.debug("Translate: Beginning translation with "+this.translator[0].label);
		
		this.incrementAsyncProcesses("Zotero.Translate#translate()");
		
		// translate
		try {
			this._sandboxManager.sandbox["do"+this._entryFunctionSuffix].apply(null, this._getParameters());
		} catch(e) {
			this.complete(false, e);
			return false;
		}
		
		this.decrementAsyncProcesses("Zotero.Translate#translate()");
	},
	
	/**
	 * Return the progress of the import operation, or null if progress cannot be determined
	 */
	"getProgress":function() { return null },
	
	/**
	 * Executed on translator completion, either automatically from a synchronous scraper or as
	 * done() from an asynchronous scraper. Finishes things up and calls callback function(s).
	 * @param {Boolean|String} returnValue An item type or a boolean true or false
	 * @param {String|Exception} [error] An error that occurred during translation.
	 * @returm {String|NULL} The exception serialized to a string, or null if translation
	 *     completed successfully.
	 */
	"complete":function(returnValue, error) {
		// allow translation to be aborted for re-running after selecting items
		if(this._aborted) return;
		
		// Make sure this isn't called twice
		if(this._currentState === null) {
			if(!returnValue) {
				Zotero.debug("Translate: WARNING: Zotero.done() called after translator completion with error");
				Zotero.debug(error);
			} else {
				var e = new Error();
				Zotero.debug("Translate: WARNING: Zotero.done() called after translation completion. This should never happen. Please examine the stack below.");
				Zotero.debug(e.stack);
			}
			return;
		}
		var oldState = this._currentState;
		
		// reset async processes and propagate them to parent
		if(this._parentTranslator && this._runningAsyncProcesses) {
			this._parentTranslator.decrementAsyncProcesses("Zotero.Translate#complete", this._runningAsyncProcesses);
		}
		this._runningAsyncProcesses = 0;
		
		if(!returnValue && this._returnValue) returnValue = this._returnValue;
		
		var errorString = null;
		if(!returnValue && error) errorString = this._generateErrorString(error);
		
		if(oldState === "detect") {
			if(this._potentialTranslators.length) {
				var lastTranslator = this._potentialTranslators.shift();
				var lastProperToProxyFunction = this._properToProxyFunctions ? this._properToProxyFunctions.shift() : null;
				
				if(returnValue) {
					var dupeTranslator = {"properToProxy":lastProperToProxyFunction};
					
					for(var i in lastTranslator) dupeTranslator[i] = lastTranslator[i];
					if(Zotero.isBookmarklet && returnValue === "server") {
						// In the bookmarklet, the return value from detectWeb can be "server" to
						// indicate the translator should be run on the Zotero server
						dupeTranslator.runMode = Zotero.Translator.RUN_MODE_ZOTERO_SERVER;
					} else {
						// Usually the return value from detectWeb will be either an item type or
						// the string "multiple"
						dupeTranslator.itemType = returnValue;
					}
					
					this._foundTranslators.push(dupeTranslator);
				} else if(error) {
					this._debug("Detect using "+lastTranslator.label+" failed: \n"+errorString, 2);
				}
			}
				
			if(this._potentialTranslators.length && (this._getAllTranslators || !returnValue)) {
				// more translators to try; proceed to next translator
				this._detect();
			} else {
				this._currentState = null;
				if(!this._waitingForRPC) this._detectTranslatorsCollected();
			}
		} else {
			this._currentState = null;
			
			// unset return value is equivalent to true
			if(returnValue === undefined) returnValue = true;
			
			if(returnValue) {
				if(this.saveQueue.length) {
					this._saveItems(this.saveQueue);
					this.saveQueue = [];
					return;
				}
				this._debug("Translation successful");
			} else {
				if(error) {
					// report error to console
					Zotero.logError(error);
					
					// report error to debug log
					this._debug("Translation using "+(this.translator && this.translator[0] && this.translator[0].label ? this.translator[0].label : "no translator")+" failed: \n"+errorString, 2);
				}
				
				this._runHandler("error", error);
			}
			
			// call handlers
			this._runHandler("itemsDone", returnValue);
			if(returnValue) {
				this._checkIfDone();
			} else {
				this._runHandler("done", returnValue);
			}
		}
		
		return errorString;
	},
	
	/**
	 * Saves items to the database, taking care to defer attachmentProgress notifications
	 * until after save
	 */
	"_saveItems":function(items) {
		var me = this,
			itemDoneEventsDispatched = false,
			deferredProgress = [],
			attachmentsWithProgress = [];
		
		this._savingItems++;
		this._itemSaver.saveItems(items.slice(), function(returnValue, newItems) {	
			if(returnValue) {
				// Remove attachments not being saved from item.attachments
				for(var i=0; i<items.length; i++) {
					var item = items[i];
					for(var j=0; j<item.attachments.length; j++) {
						if(attachmentsWithProgress.indexOf(item.attachments[j]) === -1) {
							item.attachments.splice(j--, 1);
						}
					}
				}
				
				// Trigger itemDone events
				for(var i=0, nItems = items.length; i<nItems; i++) {
					me._runHandler("itemDone", newItems[i], items[i]);
				}
				
				// Specify that itemDone event was dispatched, so that we don't defer
				// attachmentProgress notifications anymore
				itemDoneEventsDispatched = true;
				
				// Run deferred attachmentProgress notifications
				for(var i=0; i<deferredProgress.length; i++) {
					me._runHandler("attachmentProgress", deferredProgress[i][0],
						deferredProgress[i][1], deferredProgress[i][2]);
				}
				
				me.newItems = me.newItems.concat(newItems);
				me._savingItems--;
				me._checkIfDone();
			} else {
				Zotero.logError(newItems);
				me.complete(returnValue, newItems);
			}
		},
		function(attachment, progress, error) {
			var attachmentIndex = me._savingAttachments.indexOf(attachment);
			if(progress === false || progress === 100) {
				if(attachmentIndex !== -1) {
					me._savingAttachments.splice(attachmentIndex, 1);
				}
			} else if(attachmentIndex === -1) {
				me._savingAttachments.push(attachment);
			}
			
			if(itemDoneEventsDispatched) {
				// itemDone event has already fired, so we can fire attachmentProgress
				// notifications
				me._runHandler("attachmentProgress", attachment, progress, error);
				me._checkIfDone();
			} else {
				// Defer until after we fire the itemDone event
				deferredProgress.push([attachment, progress, error]);
				attachmentsWithProgress.push(attachment);
			}
		});
	},
	
	/**
	 * Checks if saving done, and if so, fires done event
	 */
	"_checkIfDone":function() {
		if(!this._savingItems && !this._savingAttachments.length && !this._currentState) {
			this._runHandler("done", true);
		}
	},
	
	/**
	 * Begins running detect code for a translator, first loading it
	 */
	"_detect":function() {
		// there won't be any translators if we need an RPC call
		if(!this._potentialTranslators.length) {
			this.complete(true);
			return;
		}
		
		var me = this;
		this._loadTranslator(this._potentialTranslators[0],
			function() { me._detectTranslatorLoaded() });
	},
	
	/**
	 * Runs detect code for a translator
	 */
	"_detectTranslatorLoaded":function() {
		this._prepareDetection();
		
		this.incrementAsyncProcesses("Zotero.Translate#getTranslators");
		
		try {
			var returnValue = this._sandboxManager.sandbox["detect"+this._entryFunctionSuffix].apply(null, this._getParameters());
		} catch(e) {
			this.complete(false, e);
			return;
		}
		
		if(returnValue !== undefined) this._returnValue = returnValue;
		this.decrementAsyncProcesses("Zotero.Translate#getTranslators");
	},
	
	/**
	 * Called when all translators have been collected for detection
	 */
	"_detectTranslatorsCollected":function() {
		Zotero.debug("Translate: All translator detect calls and RPC calls complete");
		this._foundTranslators.sort(function(a, b) { return a.priority-b.priority });
		this._runHandler("translators", this._foundTranslators);
	},
	
	/**
	 * Loads the translator into its sandbox
	 * @param {Zotero.Translator} translator
	 * @return {Boolean} Whether the translator could be successfully loaded
	 */
	"_loadTranslator":function(translator, callback) {
		var sandboxLocation = this._getSandboxLocation();
		if(!this._sandboxLocation || sandboxLocation !== this._sandboxLocation) {
			this._sandboxLocation = sandboxLocation;
			this._generateSandbox();
		}
		
		this._runningAsyncProcesses = 0;
		this._returnValue = undefined;
		this._aborted = false;
		this.saveQueue = [];
		
		Zotero.debug("Translate: Parsing code for "+translator.label, 4);
		
		try {
			this._sandboxManager.eval("var exports = {}, ZOTERO_TRANSLATOR_INFO = "+translator.code,
				["detect"+this._entryFunctionSuffix, "do"+this._entryFunctionSuffix, "exports",
					"ZOTERO_TRANSLATOR_INFO"],
				(translator.file ? translator.file.path : translator.label));
		} catch(e) {
			this.complete(false, e);
			return;
		}
		
		if(callback) callback();
	},
	
	/**
	 * Generates a sandbox for scraping/scraper detection
	 */
	"_generateSandbox":function() {
		Zotero.debug("Translate: Binding sandbox to "+(typeof this._sandboxLocation == "object" ? this._sandboxLocation.document.location : this._sandboxLocation), 4);
		this._sandboxManager = new Zotero.Translate.SandboxManager(this._sandboxLocation);
		const createArrays = "['creators', 'notes', 'tags', 'seeAlso', 'attachments']";
		var src = "var Zotero = {};"+
		"Zotero.Item = function (itemType) {"+
				"const createArrays = "+createArrays+";"+
				"this.itemType = itemType;"+
				"for(var i=0, n=createArrays.length; i<n; i++) {"+
					"this[createArrays[i]] = [];"+
				"}"+
		"};";
		
		if(this instanceof Zotero.Translate.Export || this instanceof Zotero.Translate.Import) {
			src += "Zotero.Collection = function () {};"+
			"Zotero.Collection.prototype.complete = function() { Zotero._collectionDone(this); };";
		}
		
		if(Zotero.isFx && !Zotero.isBookmarklet) {
			// workaround for inadvertant attempts to pass E4X back from sandbox
			src += "Zotero._transferItem = function(itemString) {"+
					"var item = JSON.parse(itemString);"+
					"item.complete = Zotero.Item.prototype.complete;"+
					"return item;"+
				"};"+
				"Zotero.Item.prototype.complete = function() { "+
					"for(var key in this) {"+
					"if("+createArrays+".indexOf(key) !== -1) {"+
						"for each(var item in this[key]) {"+
							"for(var key2 in item) {"+
								"if(typeof item[key2] === 'xml') {"+
									"item[key2] = item[key2].toString();"+
								"}"+
							"}"+
						"}"+
					"} else if(typeof this[key] === 'xml') {"+
						"this[key] = this[key].toString();"+
					"}"+
				"}";
		} else {
			src += "Zotero.Item.prototype.complete = function() { ";
		}
		
		src += "Zotero._itemDone(this);"+
		"}";
		
		this._sandboxManager.eval(src);
		this._sandboxManager.importObject(this.Sandbox, this);
		this._sandboxManager.importObject({"Utilities":new Zotero.Utilities.Translate(this)});
		this._sandboxManager.sandbox.Zotero.Utilities.HTTP = this._sandboxManager.sandbox.Zotero.Utilities;
		
		this._sandboxManager.sandbox.Zotero.isBookmarklet = Zotero.isBookmarklet || false;
		this._sandboxManager.sandbox.Zotero.isConnector = Zotero.isConnector || false;
		this._sandboxManager.sandbox.Zotero.isServer = Zotero.isServer || false;
		this._sandboxManager.sandbox.Zotero.parentTranslator = this._parentTranslator
			&& this._parentTranslator.translator && this._parentTranslator.translator[0] ? 
			this._parentTranslator.translator[0].translatorID : null;
		
		// create shortcuts
		this._sandboxManager.sandbox.Z = this._sandboxManager.sandbox.Zotero;
		this._sandboxManager.sandbox.ZU = this._sandboxManager.sandbox.Zotero.Utilities;
	},
	
	/**
	 * Logs a debugging message
	 * @param {String} string Debug string to log
	 * @param {Integer} level Log level (1-5, higher numbers are higher priority)
	 */
	"_debug":function(string, level) {
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
	/**
	 * Generates a string from an exception
	 * @param {String|Exception} error
	 */
	"_generateErrorString":function(error) {
		var errorString = "";
		if(typeof(error) == "string") {
			errorString = "\nthrown exception => "+error;
		} else {
			var haveStack = false;
			for(var i in error) {
				if(typeof(error[i]) != "object") {
					if(i === "stack") haveStack = true;
					errorString += "\n"+i+' => '+error[i];
				}
			}
			errorString += "\nstring => "+error.toString();
			if(!haveStack && error.stack) {
				// In case the stack is not enumerable
				errorString += "\nstack => "+error.stack.toString();
			}
		}
		
		errorString += "\nurl => "+this.path
			+ "\ndownloadAssociatedFiles => "+Zotero.Prefs.get("downloadAssociatedFiles")
			+ "\nautomaticSnapshots => "+Zotero.Prefs.get("automaticSnapshots");
		return errorString.substr(1);
	},
	
	/**
	 * Determines the location where the sandbox should be bound
	 * @return {String|document} The location to which to bind the sandbox
	 */
	"_getSandboxLocation":function() {
		return (this._parentTranslator ? this._parentTranslator._sandboxLocation : "http://www.example.com/");
	},
	
	/**
	 * Gets parameters to be passed to detect* and do* functions
	 * @return {Array} A list of parameters
	 */
	"_getParameters":function() { return []; },
	
	/**
	 * No-op for preparing detection
	 */
	"_prepareDetection":function() {},
	
	/**
	 * No-op for preparing translation
	 */
	"_prepareTranslation":function() {}
}

/**
 * @class Web translation
 *
 * @property {Document} document The document object to be used for web scraping (set with setDocument)
 * @property {Zotero.CookieSandbox} cookieSandbox A CookieSandbox to manage cookies for
 *     this Translate instance.
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
 * Sets a Zotero.CookieSandbox to handle cookie management for XHRs initiated from this
 * translate instance
 *
 * @param {Zotero.CookieSandbox} cookieSandbox
 */
Zotero.Translate.Web.prototype.setCookieSandbox = function(cookieSandbox) {
	this.cookieSandbox = cookieSandbox;
}

/**
 * Sets the location to operate upon
 *
 * @param {String} location The URL of the page to translate
 */
Zotero.Translate.Web.prototype.setLocation = function(location) {
	this.location = location;
	this.path = this.location;
}

/**
 * Get potential web translators
 */
Zotero.Translate.Web.prototype._getTranslatorsGetPotentialTranslators = function() {
	var me = this;
	Zotero.Translators.getWebTranslatorsForLocation(this.location,
			function(data) {
				// data[0] = list of translators
				// data[1] = list of functions to convert proper URIs to proxied URIs
				me._getTranslatorsTranslatorsReceived(data[0], data[1]);
			});
}

/**
 * Bind sandbox to document being translated
 */
Zotero.Translate.Web.prototype._getSandboxLocation = function() {
	if(this._parentTranslator) {
		return this._parentTranslator._sandboxLocation;
	} else if(this.document.defaultView) {
		return this.document.defaultView;
	} else {
		return this.document.location.toString();
	}
}

/**
 * Pass document and location to detect* and do* functions
 */
Zotero.Translate.Web.prototype._getParameters = function() { return [this.document, this.location]; }

/**
 * Prepare translation
 */
Zotero.Translate.Web.prototype._prepareTranslation = function() {
	this._itemSaver = new Zotero.Translate.ItemSaver(this._libraryID,
		Zotero.Translate.ItemSaver[(this._saveAttachments ? "ATTACHMENT_MODE_DOWNLOAD" : "ATTACHMENT_MODE_IGNORE")], 1,
		this.document, this._cookieSandbox, this.location);
	this.newItems = [];
}

/**
 * Overload translate to set selectedItems
 */
Zotero.Translate.Web.prototype.translate = function(libraryID, saveAttachments, selectedItems) {
	this._selectedItems = selectedItems;
	Zotero.Translate.Base.prototype.translate.apply(this, [libraryID, saveAttachments]);
}

/**
 * Overload _translateTranslatorLoaded to send an RPC call if necessary
 */
Zotero.Translate.Web.prototype._translateTranslatorLoaded = function() {
	var runMode = this.translator[0].runMode;
	if(runMode === Zotero.Translator.RUN_MODE_IN_BROWSER || this._parentTranslator) {
		Zotero.Translate.Base.prototype._translateTranslatorLoaded.apply(this);
	} else if(runMode === Zotero.Translator.RUN_MODE_ZOTERO_STANDALONE ||
			(runMode === Zotero.Translator.RUN_MODE_ZOTERO_SERVER && Zotero.Connector.isOnline)) {
		var me = this;
		Zotero.Connector.callMethod("savePage", {
				"uri":this.location.toString(),
				"translatorID":(typeof this.translator[0] === "object"
				                ? this.translator[0].translatorID : this.translator[0]),
				"cookie":this.document.cookie,
				"html":this.document.documentElement.innerHTML
			}, function(obj) { me._translateRPCComplete(obj) });
	} else if(runMode === Zotero.Translator.RUN_MODE_ZOTERO_SERVER) {
		var me = this;
		Zotero.API.createItem({"url":this.document.location.href.toString()}, null,
			function(statusCode, response) {
				me._translateServerComplete(statusCode, response);
			});
	}
}
	
/**
 * Called when an call to Zotero Standalone for translation completes
 */
Zotero.Translate.Web.prototype._translateRPCComplete = function(obj, failureCode) {
	if(!obj) this.complete(false, failureCode);
	
	if(obj.selectItems) {
		// if we have to select items, call the selectItems handler and do it
		var me = this;
		this._runHandler("select", obj.selectItems,
			function(selectedItems) {
				Zotero.Connector.callMethod("selectItems",
					{"instanceID":obj.instanceID, "selectedItems":selectedItems},
					function(obj) { me._translateRPCComplete(obj) })
			}
		);
	} else {
		// if we don't have to select items, continue
		for(var i=0, n=obj.items.length; i<n; i++) {
			this._runHandler("itemDone", null, obj.items[i]);
		}
		this.newItems = obj.items;
		this.complete(true);
	}
}
	
/**
 * Called when an call to the Zotero Translator Server for translation completes
 */
Zotero.Translate.Web.prototype._translateServerComplete = function(statusCode, response) {
	if(statusCode === 300) {
		// Multiple Choices
		try {
			response = JSON.parse(response);
		} catch(e) {
			Zotero.logError(e);
			this.complete(false, "Invalid JSON response received from server");
			return;
		}
		var me = this;
		this._runHandler("select", response,
			function(selectedItems) {
				Zotero.API.createItem({
						"url":me.document.location.href.toString(),
						"items":selectedItems
					}, null,
					function(statusCode, response) {
							me._translateServerComplete(statusCode, response);
					});
			}
		);
	} else if(statusCode === 201) {
		// Created
		try {
			response = (new DOMParser()).parseFromString(response, "application/xml");
		} catch(e) {
			Zotero.logError(e);
			this.complete(false, "Invalid XML response received from server");
			return;
		}
		
		// Extract items from ATOM/JSON response
		var items = [], contents;
		if("getElementsByTagNameNS" in response) {
			contents = response.getElementsByTagNameNS("http://www.w3.org/2005/Atom", "content");
		} else { // IE...
			contents = response.getElementsByTagName("content");
		}
		for(var i=0, n=contents.length; i<n; i++) {
			var content = contents[i];
			if("getAttributeNS" in content) {
				if(content.getAttributeNS("http://zotero.org/ns/api", "type") != "json") continue;
			} else if(content.getAttribute("zapi:type") != "json") { // IE...
				continue;
			}
			
			try {
				var item = JSON.parse("textContent" in content ?
					content.textContent : content.text);
			} catch(e) {
				Zotero.logError(e);
				this.complete(false, "Invalid JSON response received from server");
				return;
			}
			
			if(!("attachments" in item)) item.attachments = [];
			this._runHandler("itemDone", null, item);
			items.push(item);
		}
		this.newItems = items;
		this.complete(true);
	} else {
		this.complete(false, response);
	}
}

/**
 * Overload complete to report translation failure
 */
Zotero.Translate.Web.prototype.complete = function(returnValue, error) {
	// call super
	var oldState = this._currentState;
	var errorString = Zotero.Translate.Base.prototype.complete.apply(this, [returnValue, error]);
	
	// Report translation failure if we failed
	if(oldState == "translate" && errorString && this.translator[0].inRepository && Zotero.Prefs.get("reportTranslationFailure")) {
		// Don't report failure if in private browsing mode
		if(Zotero.isFx && !Zotero.isBookmarklet && !Zotero.isStandalone) {
			var pbs = Components.classes["@mozilla.org/privatebrowsing;1"]
						.getService(Components.interfaces.nsIPrivateBrowsingService);
			if (pbs.privateBrowsingEnabled) {
				return;
			}
		}
		
		var translator = this.translator[0];
		Zotero.getSystemInfo(function(info) {
			var postBody = "id=" + encodeURIComponent(translator.translatorID) +
						   "&lastUpdated=" + encodeURIComponent(translator.lastUpdated) +
						   "&diagnostic=" + encodeURIComponent(info) +
						   "&errorData=" + encodeURIComponent(errorString);
			Zotero.HTTP.doPost("http://www.zotero.org/repo/report", postBody);
		});
	}
}

/**
 * @class Import translation
 */
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
	this._io = false;
}

/**
 * Overload {@link Zotero.Translate.Base#complete} to close file
 */
Zotero.Translate.Import.prototype.complete = function(returnValue, error) {
	if(this._io) {
		this._progress = null;
		this._io.close(false);
	}
	
	// call super
	Zotero.Translate.Base.prototype.complete.apply(this, [returnValue, error]);
}

/**
 * Get all potential import translators, ordering translators with the right file extension first
 */
Zotero.Translate.Import.prototype._getTranslatorsGetPotentialTranslators = function() {
	if(this.location) {
		var me = this;
		Zotero.Translators.getImportTranslatorsForLocation(this.location,
			function(translators) { me._getTranslatorsTranslatorsReceived(translators) });
	} else {
		Zotero.Translate.Base.prototype._getTranslatorsGetPotentialTranslators.call(this);
	}
}

/**
 * Overload {@link Zotero.Translate.Base#getTranslators} to return all translators immediately only
 * if no string or location is set
 */
Zotero.Translate.Import.prototype.getTranslators = function() {
	if(!this._string && !this.location) {
		if(this._currentState === "detect") throw new Error("getTranslators: detection is already running");
		this._currentState = "detect";
		var me = this;
		Zotero.Translators.getAllForType(this.type, function(translators) {
			me._potentialTranslators = [];
			me._foundTranslators = translators;
			me.complete(true);
		});
		if(this._currentState === null) return this._foundTranslators;
	} else {
		return Zotero.Translate.Base.prototype.getTranslators.call(this);
	}
}
	
/**
 * Overload {@link Zotero.Translate.Base#_loadTranslator} to prepare translator IO
 */
Zotero.Translate.Import.prototype._loadTranslator = function(translator, callback) {
	// call super
	var me = this;
	Zotero.Translate.Base.prototype._loadTranslator.call(this, translator, function() {
		me._loadTranslatorPrepareIO(translator, callback);
	});
}
	
/**
 * Prepare translator IO
 */
Zotero.Translate.Import.prototype._loadTranslatorPrepareIO = function(translator, callback) {
	var configOptions = this._sandboxManager.sandbox.ZOTERO_TRANSLATOR_INFO.configOptions;
	var dataMode = configOptions ? configOptions["dataMode"] : "";
	
	var me = this;
	var initCallback = function(status, err) {
		if(!status) {
			me.complete(false, err);
		} else {
			me._sandboxManager.importObject(me._io);
			if(callback) callback();
		}
	};
	
	var err = false;
	if(!this._io) {
		if(Zotero.Translate.IO.Read && this.location && this.location instanceof Components.interfaces.nsIFile) {
			try {
				this._io = new Zotero.Translate.IO.Read(this.location);
			} catch(e) {
				err = e;
			}
		} else {
			try {
				this._io = new Zotero.Translate.IO.String(this._string, this.path ? this.path : "");
			} catch(e) {
				err = e;
			}
		}
	
		if(err) {
			this.complete(false, err);
			return;
		}
	}
	
	try {
		this._io.init(dataMode, initCallback);
	} catch(e) {
		err = e;
	}
	if(err) {
		this.complete(false, err);
		return;
	}
}

/**
 * Prepare translation
 */
Zotero.Translate.Import.prototype._prepareTranslation = function() {
	this._progress = undefined;
	
	var baseURI = null;
	if(this.location) {
		try {
			baseURI = Components.classes["@mozilla.org/network/io-service;1"].
				getService(Components.interfaces.nsIIOService).newFileURI(this.location);
		} catch(e) {}
	}
	
	this._itemSaver = new Zotero.Translate.ItemSaver(this._libraryID,
		Zotero.Translate.ItemSaver[(this._saveAttachments ? "ATTACHMENT_MODE_FILE" : "ATTACHMENT_MODE_IGNORE")],
		undefined, undefined, undefined, baseURI);
	this.newItems = [];
	this.newCollections = [];
}

/**
 * Return the progress of the import operation, or null if progress cannot be determined
 */
Zotero.Translate.Import.prototype.getProgress = function() {
	if(this._progress !== undefined) return this._progress;
	if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1 || this._mode === "xml/e4x" || this._mode == "xml/dom" || !this._io) {
		return null;
	}
	return this._io.bytesRead/this._io.contentLength*100;
};
	

/**
 * @class Export translation
 */
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
 * Overload {@link Zotero.Translate.Base#complete} to close file and set complete
 */
Zotero.Translate.Export.prototype.complete = function(returnValue, error) {
	if(this._io) {
		this._progress = null;
		this._io.close(true);
		if(this._io instanceof Zotero.Translate.IO.String) {
			this.string = this._io.string;
		}
	}
	
	// call super
	Zotero.Translate.Base.prototype.complete.apply(this, [returnValue, error]);
}

/**
 * Overload {@link Zotero.Translate.Base#getTranslators} to return all translators immediately
 */
Zotero.Translate.Export.prototype.getTranslators = function() {
	if(this._currentState === "detect") throw new Error("getTranslators: detection is already running");
	this._currentState = "detect";
	this._foundTranslators = Zotero.Translators.getAllForType(this.type);
	this._potentialTranslators = [];
	this.complete(true);
	return this._foundTranslators;
}

/**
 * Does the actual export, after code has been loaded and parsed
 */
Zotero.Translate.Export.prototype._prepareTranslation = function() {
	this._progress = undefined;
	
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
	// this is currently hackish since we pass null callbacks to the init function (they have
	// callbacks to be consistent with import, but they are synchronous, so we ignore them)
	if(!this.location) {
		this._io = new Zotero.Translate.IO.String(null, this.path ? this.path : "");
		this._io.init(this.translator[0].configOptions["dataMode"], function() {});
	} else if(!Zotero.Translate.IO.Write) {
		throw new Error("Writing to files is not supported in this build of Zotero.");
	} else {
		this._io = new Zotero.Translate.IO.Write(this.location);
		this._io.init(this.translator[0].configOptions["dataMode"],
			this._displayOptions["exportCharset"] ? this._displayOptions["exportCharset"] : null,
			function() {});
	}
	
	this._sandboxManager.importObject(this._io);
}

/**
 * Return the progress of the import operation, or null if progress cannot be determined
 */
Zotero.Translate.Export.prototype.getProgress = function() {
	if(this._progress !== undefined) return this._progress;
	if(!this._itemGetter) {
		return null;
	}
	return (1-this._itemGetter.numItemsRemaining/this._itemGetter.numItems)*100;
};

/**
 * @class Search translation
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
 * @borrows Zotero.Translate.Web#setCookieSandbox
 */
Zotero.Translate.Search.prototype.setCookieSandbox = Zotero.Translate.Web.prototype.setCookieSandbox;

/**
 * Sets the item to be used for searching
 * @param {Object} item An item, with as many fields as desired, in the format returned by
 *     {@link Zotero.Item#serialize}
 */
Zotero.Translate.Search.prototype.setSearch = function(search) {
	this.search = search;
}

/**
 * Overloads {@link Zotero.Translate.Base#getTranslators} to always return all potential translators
 */
Zotero.Translate.Search.prototype.getTranslators = function() {
	return Zotero.Translate.Base.prototype.getTranslators.call(this, true);
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
		for(var i=0, n=translator.length; i<n; i++) {
			this.translator.push(translator[i]);
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
	if(this._currentState == "translate" && (!this.newItems || !this.newItems.length)) {
		Zotero.debug("Translate: Could not find a result using "+this.translator[0].label+": \n"
					  +this._generateErrorString(error), 3);
		if(this.translator.length > 1) {
			this.translator.shift();
			this.translate(this._libraryID, this._saveAttachments);
			return;
		} else {
			error = "No items returned from any translator";
			returnValue = false;
		}
	}
	
	// call super
	Zotero.Translate.Base.prototype.complete.apply(this, [returnValue, error]);
}

/**
 * Pass search item to detect* and do* functions
 */
Zotero.Translate.Search.prototype._getParameters = function() {
	if(Zotero.isFx) return [this._sandboxManager.sandbox.Zotero._transferItem(JSON.stringify(this.search))];
	return [this.search];
};

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
				throw new Error("DOMParser not supported");
			}
		}
		
		if(typeof input == "string") {
			var nodes = dp.parseFromString(input, "text/xml");
		} else {
			var nodes = dp.parseFromStream(input, charset, size, "text/xml");
		}
		
		if(nodes.getElementsByTagName("parsererror").length) {
			throw "DOMParser error: loading data into data store failed";
		}
		
		return nodes;
	},
	
	/**
	 * Names of RDF data modes
	 */
	"rdfDataModes":["rdf", "rdf/xml", "rdf/n3"]
};

/******* String support *******/

/**
 * @class Translate backend for translating from a string
 */
Zotero.Translate.IO.String = function(string, uri) {
	if(string && typeof string === "string") {
		this.string = string;
	} else {
		this.string = "";
	}
	this.contentLength = this.string.length;
	this.bytesRead = 0;
	this._uri = uri;
}

Zotero.Translate.IO.String.prototype = {
	"__exposedProps__":{
		"RDF":"r",
		"read":"r",
		"write":"r",
		"setCharacterSet":"r",
		"getXML":"r"
	},
	
	"_initRDF":function(callback) {
		Zotero.debug("Translate: Initializing RDF data store");
		this._dataStore = new Zotero.RDF.AJAW.IndexedFormula();
		this.RDF = new Zotero.Translate.IO._RDFSandbox(this._dataStore);
		
		if(this.contentLength) {
			try {
				var xml = Zotero.Translate.IO.parseDOMXML(this.string);
			} catch(e) {
				this._xmlInvalid = true;
				throw e;
			}
			var parser = new Zotero.RDF.AJAW.RDFParser(this._dataStore);
			parser.parse(xml, this._uri);
		}
		callback(true);
	},
	
	"setCharacterSet":function(charset) {},
	
	"read":function(bytes) {
		// if we are reading in RDF data mode and no string is set, serialize current RDF to the
		// string
		if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1 && this.string === "") {
			this.string = this.RDF.serialize();
		}
		
		// return false if string has been read
		if(this.bytesRead >= this.contentLength) {
			return false;
		}
		
		if(bytes !== undefined) {
			if(this.bytesRead >= this.contentLength) return false;
			var oldPointer = this.bytesRead;
			this.bytesRead += bytes;
			return this.string.substr(oldPointer, bytes);
		} else {
			// bytes not specified; read a line
			var oldPointer = this.bytesRead;
			var lfIndex = this.string.indexOf("\n", this.bytesRead);
			
			if(lfIndex !== -1) {
				// in case we have a CRLF
				this.bytesRead = lfIndex+1;
				if(this.contentLength > lfIndex && this.string.substr(lfIndex-1, 1) === "\r") {
					lfIndex--;
				}
				return this.string.substr(oldPointer, lfIndex-oldPointer);					
			}
			
			if(!this._noCR) {
				var crIndex = this.string.indexOf("\r", this.bytesRead);
				if(crIndex === -1) {
					this._noCR = true;
				} else {
					this.bytesRead = crIndex+1;
					return this.string.substr(oldPointer, crIndex-oldPointer-1);
				}
			}
			
			this.bytesRead = this.contentLength;
			return this.string.substr(oldPointer);
		}
	},
	
	"write":function(data) {
		this.string += data;
		this.contentLength = this.string.length;
	},
	
	"getXML":function() {
		try {
			var xml = Zotero.Translate.IO.parseDOMXML(this.string);
		} catch(e) {
			this._xmlInvalid = true;
			throw e;
		}
		return (Zotero.isFx ? Zotero.Translate.DOMWrapper.wrap(xml) : xml);
	},
	
	"init":function(newMode, callback) {
		this.bytesRead = 0;
		this._noCR = undefined;
		
		this._mode = newMode;
		if(newMode === "xml/e4x") {
			throw "E4X is not supported";
		} else if(newMode && (Zotero.Translate.IO.rdfDataModes.indexOf(newMode) !== -1
				|| newMode.substr(0, 3) === "xml/dom") && this._xmlInvalid) {
			throw "XML known invalid";
		} else if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1) {
			this._initRDF(callback);
		} else {
			callback(true);
		}
	},
	
	"close":function(serialize) {
		// if we are writing in RDF data mode and no string is set, serialize current RDF to the
		// string
		if(serialize && Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1 && this.string === "") {
			this.string = this.RDF.serialize();
		}
	}
}

/****** RDF DATA MODE ******/

/**
 * @class An API for handling RDF from the sandbox. This is exposed to translators as Zotero.RDF.
 *
 * @property {Zotero.RDF.AJAW.IndexedFormula} _dataStore
 * @property {Integer[]} _containerCounts
 * @param {Zotero.RDF.AJAW.IndexedFormula} dataStore
 */
Zotero.Translate.IO._RDFSandbox = function(dataStore) {
	this._dataStore = dataStore;
}

Zotero.Translate.IO._RDFSandbox.prototype = {
	"_containerCounts":[],
	"__exposedProps__":{
		"addStatement":"r",
		"newResource":"r",
		"newContainer":"r",
		"addContainerElement":"r",
		"getContainerElements":"r",
		"addNamespace":"r",
		"getAllResources":"r",
		"getResourceURI":"r",
		"getArcsIn":"r",
		"getArcsOut":"r",
		"getSources":"r",
		"getTargets":"r",
		"getStatementsMatching":"r",
		"serialize":"r"
	},
	
	/**
	 * Gets a resource as a Zotero.RDF.AJAW.Symbol, rather than a string
	 * @param {String|Zotero.RDF.AJAW.Symbol} about
	 * @return {Zotero.RDF.AJAW.Symbol}
	 */
	"_getResource":function(about) {
		return (typeof about == "object" ? about : new Zotero.RDF.AJAW.Symbol(about));
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
		var serializer = Zotero.RDF.AJAW.Serializer(this._dataStore);
		
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
	 * @param {String|Zotero.RDF.AJAW.Symbol} about
	 * @param {String|Zotero.RDF.AJAW.Symbol} relation
	 * @param {String|Zotero.RDF.AJAW.Symbol} value
	 * @param {Boolean} literal Whether value should be treated as a literal (true) or a resource
	 *     (false)
	 */
	"addStatement":function(about, relation, value, literal) {
		if(about === null || about === undefined) {
			throw new Error("about must be defined in Zotero.RDF.addStatement");
		}
		if(relation === null || relation === undefined) {
			throw new Error("relation must be defined in Zotero.RDF.addStatement");
		}
		if(value === null || value === undefined) {
			throw new Error("value must be defined in Zotero.RDF.addStatement");
		}
		
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
	 * @return {Zotero.RDF.AJAW.Symbol}
	 */
	"newResource":function() {
		return new Zotero.RDF.AJAW.BlankNode();
	},
	
	/**
	 * Creates a new container resource
	 * @param {String} type The type of the container ("bag", "seq", or "alt")
	 * @param {String|Zotero.RDF.AJAW.Symbol} about The URI of the resource
	 * @return {Zotero.Translate.RDF.prototype.newContainer
	 */
	"newContainer":function(type, about) {
		const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
		const containerTypes = {"bag":"Bag", "seq":"Seq", "alt":"Alt"};
		
		type = type.toLowerCase();
		if(!containerTypes[type]) {
			throw new Error("Invalid container type in Zotero.RDF.newContainer");
		}
		
		var about = this._getResource(about);
		this.addStatement(about, rdf+"type", rdf+containerTypes[type], false);
		this._containerCounts[about.toNT()] = 1;
		
		return about;
	},
	
	/**
	 * Adds a new element to a container
	 * @param {String|Zotero.RDF.AJAW.Symbol} about The container
	 * @param {String|Zotero.RDF.AJAW.Symbol} element The element to add to the container
	 * @param {Boolean} literal Whether element should be treated as a literal (true) or a resource
	 *     (false)
	 */
	"addContainerElement":function(about, element, literal) {
		const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
	
		var about = this._getResource(about);
		this._dataStore.add(about, new Zotero.RDF.AJAW.Symbol(rdf+"_"+(this._containerCounts[about.toNT()]++)), element, literal);
	},
	
	/**
	 * Gets all elements within a container
	 * @param {String|Zotero.RDF.AJAW.Symbol} about The container
	 * @return {Zotero.RDF.AJAW.Symbol[]}
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
	 * @param {String|Zotero.RDF.AJAW.Symbol} resource
	 * @return {String}
	 */
	"getResourceURI":function(resource) {
		if(typeof(resource) == "string") return resource;
		if(resource.uri) return resource.uri;
		if(resource.toNT == undefined) throw new Error("Zotero.RDF: getResourceURI called on invalid resource");
		return resource.toNT();
	},
	
	/**
	 * Gets all resources in the RDF data store
	 * @return {Zotero.RDF.AJAW.Symbol[]}
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
	 * @return {Zotero.RDF.AJAW.Symbol[]}
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
	 * @return {Zotero.RDF.AJAW.Symbol[]}
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
	 * @param {String|Zotero.RDF.AJAW.Symbol} resource Subject that predicates should point to
	 * @param {String|Zotero.RDF.AJAW.Symbol} property Predicate
	 * @return {Zotero.RDF.AJAW.Symbol[]}
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
	 * @param {String|Zotero.RDF.AJAW.Symbol} resource Subject
	 * @param {String|Zotero.RDF.AJAW.Symbol} property Predicate
	 * @return {Zotero.RDF.AJAW.Symbol[]}
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
	 * @param	{String|Zotero.RDF.AJAW.Symbol}	subj 		Subject
	 * @param	{String|Zotero.RDF.AJAW.Symbol}	predicate	Predicate
	 * @param	{String|Zotero.RDF.AJAW.Symbol}	obj			Object
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