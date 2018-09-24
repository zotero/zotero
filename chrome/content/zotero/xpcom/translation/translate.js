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
		_itemDone: function (translate, item) {
			// https://github.com/zotero/translators/issues/1353
			var asyncTranslator = !(translate instanceof Zotero.Translate.Web)
				&& translate.translator[0].configOptions
				&& translate.translator[0].configOptions.async;
			
			var run = async function (async) {
				Zotero.debug("Translate: Saving item");
				
				// warn if itemDone called after translation completed
				if(translate._complete) {
					Zotero.debug("Translate: WARNING: Zotero.Item#complete() called after Zotero.done(); please fix your code", 2);
				}
					
				const allowedObjects = [
					"complete",
					"attachments",
					"creators",
					"tags",
					"notes",
					"relations",
					// Is this still needed?
					"seeAlso"
				];
				
				// Create a new object here, so that we strip the "complete" property
				var newItem = {};
				var oldItem = item;
				for(var i in item) {
					var val = item[i];
					if(i === "complete" || (!val && val !== 0)) continue;
					
					var type = typeof val;
					var isObject = type === "object" || type === "xml" || type === "function",
						shouldBeObject = allowedObjects.indexOf(i) !== -1;
					if(isObject && !shouldBeObject) {
						// Convert things that shouldn't be objects to objects
						translate._debug("Translate: WARNING: typeof "+i+" is "+type+"; converting to string");
						newItem[i] = val.toString();
					} else if(shouldBeObject && !isObject) {
						translate._debug("Translate: WARNING: typeof "+i+" is "+type+"; converting to array");
						newItem[i] = [val];
					} else if(type === "string") {
						// trim strings
						newItem[i] = val.trim();
					} else {
						newItem[i] = val;
					}
				}
				item = newItem;
	
				// Clean empty creators
				if (item.creators) {
					for (var i=0; i<item.creators.length; i++) {
						var creator = item.creators[i];
						if (!creator.firstName && !creator.lastName) {
							item.creators.splice(i, 1);
							i--;
						}
					}
				}
	
				// If we're not in a child translator, canonicalize tags
				if (!translate._parentTranslator) {
					if(item.tags) item.tags = translate._cleanTags(item.tags);
				}
				
				if(item.attachments) {
					var attachments = item.attachments;
					for(var j=0; j<attachments.length; j++) {
						var attachment = attachments[j];
	
						// Don't save documents as documents in connector, since we can't pass them around
						if((Zotero.isConnector || Zotero.isServer) && attachment.document) {
							attachment.url = attachment.document.documentURI || attachment.document.URL;
							attachment.mimeType = "text/html";
							delete attachment.document;
						}
	
						// If we're not in a child translator, canonicalize tags
						if (!translate._parentTranslator) {
							if(attachment.tags !== undefined) attachment.tags = translate._cleanTags(attachment.tags);
						}
					}
				}
				
				// if we're not supposed to save the item or we're in a child translator,
				// just return the item array
				if(translate._libraryID === false || translate._parentTranslator) {
					translate.newItems.push(item);
					if(translate._parentTranslator && Zotero.isFx && !Zotero.isBookmarklet) {
						// Copy object so it is accessible to parent translator
						item = translate._sandboxManager.copyObject(item);
						item.complete = oldItem.complete;
					}
					return translate._runHandler("itemDone", item, item);
				}
				
				// We use this within the connector to keep track of items as they are saved
				if(!item.id) item.id = Zotero.Utilities.randomString();
	
				if(item.notes) {
					var notes = item.notes;
					for(var j=0; j<notes.length; j++) {
						var note = notes[j];
						if(!note) {
							notes.splice(j--, 1);
						} else if(typeof(note) != "object") {
							// Convert to object
							notes[j] = {"note":note.toString()}
						}
						// If we're not in a child translator, canonicalize tags
						if (!translate._parentTranslator) {
							if(note.tags !== undefined) note.tags = translate._cleanTags(note.tags);
						}
					}
				}
	
				if (item.version) {
					translate._debug("Translate: item.version is deprecated; set item.versionNumber instead");
					item.versionNumber = item.version;
				}
	
				if (item.accessDate) {
					if (Zotero.Date.isSQLDateTime(item.accessDate)) {
						translate._debug("Translate: Passing accessDate as SQL is deprecated; pass an ISO 8601 date instead");
						item.accessDate = Zotero.Date.sqlToISO8601(item.accessDate);
					}
				}
			
				// Fire itemSaving event
				translate._runHandler("itemSaving", item);
				translate._savingItems++;
				
				// For synchronous import (when Promise isn't available in the sandbox or the do*
				// function doesn't use it) and web translators, queue saves
				if (!async || !asyncTranslator) {
					Zotero.debug("Translate: Saving via queue");
					translate.saveQueue.push(item);
				}
				// For async import, save items immediately
				else {
					Zotero.debug("Translate: Saving now");
					translate.incrementAsyncProcesses("Zotero.Translate#_saveItems()");
					return translate._saveItems([item])
						.then(() => translate.decrementAsyncProcesses("Zotero.Translate#_saveItems()"));
				}
			};
			
			if (!translate._sandboxManager.sandbox.Promise) {
				Zotero.debug("Translate: Promise not available in sandbox in _itemDone()");
				run();
				return;
			}
			
			return new translate._sandboxManager.sandbox.Promise(function (resolve, reject) {
				try {
					run(true).then(
						resolve,
						function (e) {
							// Fix wrapping error from sandbox when error is thrown from _saveItems()
							if (Zotero.isFx) {
								reject(translate._sandboxManager.copyObject(e));
							}
							else {
								reject(e);
							}
						}
					);
				}
				catch (e) {
					reject(e);
				}
			});
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
		 * Gets a hidden preference that can be defined by hiddenPrefs in translator header
		 *
		 * @param {Zotero.Translate} translate
		 * @param {String} pref Prefernce to be retrieved
		 */
		"getHiddenPref":function(translate, pref) {
			if(typeof(pref) != "string") {
				throw(new Error("getPref: preference must be a string"));
			}

			var hp = translate._translatorInfo.hiddenPrefs || {};

			var value;
			try {
				value = Zotero.Prefs.get('translators.' + pref);
			} catch(e) {}

			return (value !== undefined ? value : hp[pref]);
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
				if(type !== "export"
					&& (!translation._handlers['itemDone'] || !translation._handlers['itemDone'].length)) {
					translation.setHandler("itemDone", function(obj, item) {
						translate.Sandbox._itemDone(translate, item);
					});
				}
				if(!translation._handlers['selectItems'] || !translation._handlers['selectItems'].length) {
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
			safeTranslator.setDocument = function(arg) {
				if (Zotero.isFx && !Zotero.isBookmarklet) {
					return translation.setDocument(
						Zotero.Translate.DOMWrapper.wrap(arg, arg.SpecialPowers_wrapperOverrides)
					);
				} else {
					return translation.setDocument(arg);
				}
			};
			var errorHandlerSet = false;
			safeTranslator.setHandler = function(arg1, arg2) {
				if(arg1 === "error") errorHandlerSet = true;
				translation.setHandler(arg1, 
					function(obj, item) {
						try {
							item = item.wrappedJSObject ? item.wrappedJSObject : item;
							if(arg1 == "itemDone") {
								item.complete = translate._sandboxZotero.Item.prototype.complete;
							} else if(arg1 == "translators" && Zotero.isFx && !Zotero.isBookmarklet) {
								var translators = new translate._sandboxManager.sandbox.Array();
								translators = translators.wrappedJSObject || translators;
								for (var i=0; i<item.length; i++) {
									translators.push(item[i]);
								}
								item = translators;
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
					throw new Error('Translator must register a "translators" handler to '+
						'call getTranslators() in this translation environment.');
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
				translation.translate(false);
			};
			
			safeTranslator.getTranslatorObject = function(callback) {
				if(callback) {
					translate.incrementAsyncProcesses("safeTranslator#getTranslatorObject()");
				} else {
					throw new Error("Translator must pass a callback to getTranslatorObject() to "+
						"operate in this translation environment.");
				}
				
				var translator = translation.translator[0];
				translator = typeof translator === "object" ? translator : Zotero.Translators.get(translator);
				// Zotero.Translators.get returns a value in the client and a promise in connectors
				// so we normalize the value to a promise here
				Zotero.Promise.resolve(translator)
				.then(function(translator) {
					return translation._loadTranslator(translator)
				})
				.then(function() {
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
							return;
						}
					}
					
					return translation._prepareTranslation();
				})
				.then(function () {
					setDefaultHandlers(translate, translation);
					var sandbox = translation._sandboxManager.sandbox;
					if(!Zotero.Utilities.isEmpty(sandbox.exports)) {
						sandbox.exports.Zotero = sandbox.Zotero;
						sandbox = sandbox.exports;
					} else {
						translate._debug("COMPAT WARNING: "+translation.translator[0].label+" does "+
							"not export any properties. Only detect"+translation._entryFunctionSuffix+
							" and do"+translation._entryFunctionSuffix+" will be available in "+
							"connectors.");
					}
					
					callback(sandbox);
					translate.decrementAsyncProcesses("safeTranslator#getTranslatorObject()");
				}).catch(function(e) {
					translate.complete(false, e);
					return;
				});
			};

			if (Zotero.isFx) {
				for(var i in safeTranslator) {
					if (typeof(safeTranslator[i]) === "function") {
						safeTranslator[i] = translate._sandboxManager._makeContentForwarder(function(func) {
							return function() {
								func.apply(safeTranslator, this.args.wrappedJSObject || this.args);
							}
						}(safeTranslator[i]));
					}
				}
			}
			
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
				return Zotero.isFx && !Zotero.isBookmarklet ? translate._sandboxManager.copyObject(obj) : obj;
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
								translate.translate({
									libraryID: translate._libraryID,
									saveAttachments: translate._saveAttachments,
									selectedItems
								});
							} else {
								returnedItems = transferObject(selectedItems);
							}
						};
					}
					
					if(Zotero.isFx && !Zotero.isBookmarklet) {
						items = Components.utils.cloneInto(items, {});
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
				if(item.libraryCatalog === undefined && item.itemType != "webpage") {
					item.libraryCatalog = translate.translator[0].label;
				}
							
				// automatically set access date if URL is set
				if(item.url && typeof item.accessDate == 'undefined') {
					item.accessDate = Zotero.Date.dateToISO(new Date());
				}
				
				//consider type-specific "title" alternatives
				var altTitle = Zotero.ItemFields.getName(Zotero.ItemFields.getFieldIDFromTypeAndBase(item.itemType, 'title'));
				if(altTitle && item[altTitle]) item.title = item[altTitle];
				
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
				
				/* Clean up ISBNs
				 * Allow multiple ISBNs, but...
				 * (1) validate all ISBNs
				 * (2) convert all ISBNs to ISBN-13
				 * (3) remove any duplicates
				 * (4) separate them with space
				 */
				if (item.ISBN) {
					// Match ISBNs with groups separated by various dashes or even spaces
					var isbnRe = /\b(?:97[89][\s\x2D\xAD\u2010-\u2015\u2043\u2212]*)?(?:\d[\s\x2D\xAD\u2010-\u2015\u2043\u2212]*){9}[\dx](?![\x2D\xAD\u2010-\u2015\u2043\u2212])\b/gi,
						validISBNs = [],
						isbn;
					while (isbn = isbnRe.exec(item.ISBN)) {
						var validISBN = Zotero.Utilities.cleanISBN(isbn[0]);
						if (!validISBN) {
							// Back up and move up one character
							isbnRe.lastIndex = isbn.index + 1;
							continue;
						}
						
						var isbn13 = Zotero.Utilities.toISBN13(validISBN);
						if (validISBNs.indexOf(isbn13) == -1) validISBNs.push(isbn13);
					}
					item.ISBN = validISBNs.join(' ');
				}
				
				// refuse to save very long tags
				if(item.tags) {
					for(var i=0; i<item.tags.length; i++) {
						var tag = item.tags[i],
							tagString = typeof tag === "string" ? tag :
								typeof tag === "object" ? (tag.tag || tag.name) : null;
						if(tagString && tagString.length > 255) {
							translate._debug("WARNING: Skipping unsynchable tag "+JSON.stringify(tagString));
							item.tags.splice(i--, 1);
						}
					}
				}
				
				for(var i=0; i<item.attachments.length; i++) {
					var attachment = item.attachments[i];
					
					// Web translators are not allowed to use attachment.path
					if (attachment.path) {
						if (!attachment.url) attachment.url = attachment.path;
						delete attachment.path;
					}
					
					if(attachment.url) {
						// Remap attachment (but not link) URLs
						// TODO: provide both proxied and un-proxied URLs (also for documents)
						//   because whether the attachment is attached as link or file
						//   depends on Zotero preferences as well.
						attachment.url = translate.resolveURL(attachment.url, attachment.snapshot === false);
					}
				}
			}
			
			// call super
			Zotero.Translate.Sandbox.Base._itemDone(translate, item);
		},
		
		/**
		 * Tells Zotero to monitor changes to the DOM and re-trigger detectWeb
		 * Can only be set during the detectWeb call
		 * @param {DOMNode} target Document node to monitor for changes
		 * @param {MutationObserverInit} [config] specifies which DOM mutations should be reported
		 */
		"monitorDOMChanges":function(translate, target, config) {
			if(translate._currentState != "detect") {
				Zotero.debug("Translate: monitorDOMChanges can only be called during the 'detect' stage");
				return;
			}

			var window = translate.document.defaultView
			var mutationObserver = window && ( window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver );
			if(!mutationObserver) {
				Zotero.debug("Translate: This browser does not support mutation observers.");
				return;
			}

			var translator = translate._potentialTranslators[0];
			if(!translate._registeredDOMObservers[translator.translatorID])
				translate._registeredDOMObservers[translator.translatorID] = [];
			var obs = translate._registeredDOMObservers[translator.translatorID];

			//do not re-register observer by the same translator for the same node
			if(obs.indexOf(target) != -1) {
				Zotero.debug("Translate: Already monitoring this node");
				return;
			}

			obs.push(target);

			var observer = new mutationObserver(function(mutations, observer) {
				obs.splice(obs.indexOf(target),1);
				observer.disconnect();
				
				Zotero.debug("Translate: Page modified.");
				//we don't really care what got updated
				var doc = mutations[0].target.ownerDocument;
				translate._runHandler("pageModified", doc);
			});

			observer.observe(target, config || {childList: true, subtree: true});
			Zotero.debug("Translate: Mutation observer registered on <" + target.nodeName + "> node");
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
			translate.newCollections.push(collection);
			if(translate._libraryID == false) {
				translate._runHandler("collectionDone", collection);
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
			if(!translate._translatorInfo.configOptions || !translate._translatorInfo.configOptions.getCollections) {
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
		this._translatorInfo = null;
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
	 * @param {Array{Zotero.Translator}|Zotero.Translator|string} Translator object or ID
	 */
	"setTranslator":function(translator) {
		// Accept an array of translators
		if (Array.isArray(translator)) {
			this.translator = translator;
			return true;
		}
		if(!translator) {
			throw new Error("No translator specified");
		}
		
		this.translator = null;
		
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
	 * pageModified
	 *   valid: web
	 *   called: when a web page has been modified
	 *   passed: the document object for the modified page
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
				// if there is a parent translator, make sure we don't pass the Zotero.Translate
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
				if (type != 'debug') {
					Zotero.debug(`Translate: Running handler ${i} for ${type}`, 5);
				}
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
	 * @return {Promise} Promise for an array of {@link Zotero.Translator} objects
	 */
	getTranslators: Zotero.Promise.method(function (getAllTranslators, checkSetTranslator) {
		var potentialTranslators;

		// do not allow simultaneous instances of getTranslators
		if(this._currentState === "detect") throw new Error("getTranslators: detection is already running");
		this._currentState = "detect";
		this._getAllTranslators = getAllTranslators;
		this._potentialTranslators = [];
		this._foundTranslators = [];

		if(checkSetTranslator) {
			// setTranslator must be called beforehand if checkSetTranslator is set
			if( !this.translator || !this.translator[0] ) {
				return Zotero.Promise.reject(new Error("getTranslators: translator must be set via setTranslator before calling" +
										  " getTranslators with the checkSetTranslator flag"));
			}
			var promises = new Array();
			var t;
			for(var i=0, n=this.translator.length; i<n; i++) {
				if(typeof(this.translator[i]) == 'string') {
					t = Zotero.Translators.get(this.translator[i]);
					if(!t) Zotero.debug("getTranslators: could not retrieve translator '" + this.translator[i] + "'");
				} else {
					t = this.translator[i];
				}
				/**TODO: check that the translator is of appropriate type?*/
				if(t) promises.push(t);
			}
			if(!promises.length) return Zotero.Promise.reject(new Error("getTranslators: no valid translators were set"));
			potentialTranslators = Zotero.Promise.all(promises);
		} else {
			potentialTranslators = this._getTranslatorsGetPotentialTranslators();
		}

		// if detection returns immediately, return found translators
		return potentialTranslators.then(function(result) {
			var allPotentialTranslators = result[0];
			var proxies = result[1];
			
			// this gets passed out by Zotero.Translators.getWebTranslatorsForLocation() because it is
			// specific for each translator, but we want to avoid making a copy of a translator whenever
			// possible.
			this._proxies = proxies ? [] : null;
			this._waitingForRPC = false;
			
			for(var i=0, n=allPotentialTranslators.length; i<n; i++) {
				var translator = allPotentialTranslators[i];
				if(translator.runMode === Zotero.Translator.RUN_MODE_IN_BROWSER) {
					this._potentialTranslators.push(translator);
					if (proxies) {
						this._proxies.push(proxies[i]);
					}
				} else if (this instanceof Zotero.Translate.Web && Zotero.Connector) {
					this._waitingForRPC = true;
				}
			}
			
			// Attach handler for translators, so that we can return a
			// promise that provides them.
			// TODO make this._detect() return a promise
			var deferred = Zotero.Promise.defer();
			var translatorsHandler = function(obj, translators) {
				this.removeHandler("translators", translatorsHandler);
				deferred.resolve(translators);
			}.bind(this);
			this.setHandler("translators", translatorsHandler);
			this._detect();

			if(this._waitingForRPC) {
				// Try detect in Zotero Standalone. If this fails, it fails; we shouldn't
				// get hung up about it.
				let html = this.document.documentElement.innerHTML;
				html = html.replace(new RegExp(Zotero.Utilities.quotemeta(ZOTERO_CONFIG.BOOKMARKLET_URL), 'g'), "about:blank");
				Zotero.Connector.callMethod(
					"detect",
					{
						uri: this.location.toString(),
						cookie: this.document.cookie,
						html
					}).catch(() => false).then(function (rpcTranslators) {
						this._waitingForRPC = false;
						
						// if there are translators, add them to the list of found translators
						if (rpcTranslators) {
							for(var i=0, n=rpcTranslators.length; i<n; i++) {
								rpcTranslators[i] = new Zotero.Translator(rpcTranslators[i]);
								rpcTranslators[i].runMode = Zotero.Translator.RUN_MODE_ZOTERO_STANDALONE;
								rpcTranslators[i].proxy = rpcTranslators[i].proxy ? new Zotero.Proxy(rpcTranslators[i].proxy) : null;
							}
							this._foundTranslators = this._foundTranslators.concat(rpcTranslators);
						}
						
						// call _detectTranslatorsCollected to return detected translators
						if (this._currentState === null) {
							this._detectTranslatorsCollected();
						}
					}.bind(this));
			}

			return deferred.promise;
		}.bind(this))
		.catch(function(e) {
			Zotero.logError(e);
			this.complete(false, e);
		}.bind(this));
	}),

	/**
	 * Get all potential translators (without running detect)
	 * @return {Promise} Promise for an array of {@link Zotero.Translator} objects
	 */
	 "_getTranslatorsGetPotentialTranslators":function() {
		return Zotero.Translators.getAllForType(this.type).
		then(function(translators) { return [translators] });
	 },

	/**
	 * Begins the actual translation. At present, this returns immediately for import/export
	 * translators, but new code should use {@link Zotero.Translate.Base#setHandler} to register a 
	 * "done" handler to determine when execution of web/search translators is complete.
	 *
	 * @param 	{Integer|FALSE}	[libraryID]		Library in which to save items,
	 *																or NULL for default library;
	 *																if FALSE, don't save items
	 * @param 	{Boolean}				[saveAttachments=true]	Exclude attachments (e.g., snapshots) on import
	 * @returns {Promise}                                       Promise resolved with saved items
	 *                                                          when translation complete
	 */
	translate: Zotero.Promise.method(function (options = {}, ...args) {		// initialize properties specific to each translation
		if (typeof options == 'number') {
			Zotero.debug("Translate: translate() now takes an object -- update your code", 2);
			options = {
				libraryID: options,
				saveAttachments: args[0],
				selectedItems: args[1]
			};
		}
		
		var me = this;
		var deferred = Zotero.Promise.defer()
		
		if(!this.translator || !this.translator.length) {
			Zotero.debug("Translate: translate called without specifying a translator. Running detection first.");
			this.setHandler('translators', function(me, translators) {
				if(!translators.length) {
					me.complete(false, "Could not find an appropriate translator");
				} else {
					me.setTranslator(translators);
					deferred.resolve(Zotero.Translate.Base.prototype.translate.call(me, options));
				}
			});
			this.getTranslators();
			return deferred.promise;
		}
		
		this._currentState = "translate";
		
		this._sessionID = options.sessionID;
		this._libraryID = options.libraryID;
		if (options.collections && !Array.isArray(options.collections)) {
			throw new Error("'collections' must be an array");
		}
		this._collections = options.collections;
		this._saveAttachments = options.saveAttachments === undefined || options.saveAttachments;
		this._forceTagType = options.forceTagType;
		this._saveOptions = options.saveOptions;
		
		this._savingAttachments = [];
		this._savingItems = 0;
		this._waitingForSave = false;

		// Attach handlers for promise
		var me = this;
		var doneHandler = function (obj, returnValue) {
			if (returnValue) deferred.resolve(me.newItems);
			me.removeHandler("done", doneHandler);
			me.removeHandler("error", errorHandler);
		};
		var errorHandler = function (obj, error) {
			deferred.reject(error);
			me.removeHandler("done", doneHandler);
			me.removeHandler("error", errorHandler);
		};
		this.setHandler("done", doneHandler);
		this.setHandler("error", errorHandler);
		
		// need to get translator first
		if (typeof this.translator[0] !== "object") {
			this.translator[0] = Zotero.Translators.get(this.translator[0]);
		}
		
		// Zotero.Translators.get() returns a promise in the connectors, but we don't expect it to
		// otherwise
		if (!Zotero.isConnector && this.translator[0].then) {
			throw new Error("Translator should not be a promise in non-connector mode");
		}
		
		if (this.noWait) {
			var loadPromise = this._loadTranslator(this.translator[0]);
			if (!loadPromise.isResolved()) {
				return Zotero.Promise.reject(new Error("Load promise is not resolved in noWait mode"));
			}
			this._translateTranslatorLoaded();
		}
		else if (this.translator[0].then) {
			Zotero.Promise.resolve(this.translator[0])
			.then(function (translator) {
				this.translator[0] = translator;
				this._loadTranslator(translator)
					.then(() => this._translateTranslatorLoaded())
					.catch(e => deferred.reject(e));
			}.bind(this));
		}
		else {
			this._loadTranslator(this.translator[0])
				.then(() => this._translateTranslatorLoaded())
				.catch(e => deferred.reject(e));
		}
		
		return deferred.promise;
	}),
	
	/**
	 * Called when translator has been retrieved and loaded
	 */
	"_translateTranslatorLoaded": Zotero.Promise.method(function() {
		// set display options to default if they don't exist
		if(!this._displayOptions) this._displayOptions = this._translatorInfo.displayOptions || {};
		
		var loadPromise = this._prepareTranslation();
		if (this.noWait) {
			if (!loadPromise.isResolved()) {
				throw new Error("Load promise is not resolved in noWait mode");
			}
			rest.apply(this, arguments);
		} else {
			return loadPromise.then(() => rest.apply(this, arguments))
		}
		
		function rest() {
			Zotero.debug("Translate: Beginning translation with " + this.translator[0].label);

			this.incrementAsyncProcesses("Zotero.Translate#translate()");

			// translate
			try {
				let maybePromise = Function.prototype.apply.call(
					this._sandboxManager.sandbox["do" + this._entryFunctionSuffix],
					null,
					this._getParameters()
				);
				// doImport can return a promise to allow for incremental saves (via promise-returning
				// item.complete() calls)
				if (maybePromise) {
					maybePromise
						.then(() => this.decrementAsyncProcesses("Zotero.Translate#translate()"))
					return;
				}
			} catch (e) {
				this.complete(false, e);
				return false;
			}

			this.decrementAsyncProcesses("Zotero.Translate#translate()");
		}
	}),
	
	/**
	 * Return the progress of the import operation, or null if progress cannot be determined
	 */
	"getProgress":function() { return null },

	/**
	 * Translate a URL to a form that goes through the appropriate proxy, or
	 * convert a relative URL to an absolute one
	 *
	 * @param {String} url
	 * @param {Boolean} dontUseProxy If true, don't convert URLs to variants
	 *     that use the proxy
	 * @type String
	 * @private
	 */
	"resolveURL":function(url, dontUseProxy) {
		Zotero.debug("Translate: resolving URL " + url);
		
		const hostPortRe = /^([A-Z][-A-Z0-9+.]*):\/\/[^\/]+/i;
		const allowedSchemes = ['http', 'https', 'ftp'];
		
		var m = url.match(hostPortRe),
			resolved;
		if (!m) {
			// Convert relative URLs to absolute
			if(Zotero.isFx && this.location) {
				resolved = Components.classes["@mozilla.org/network/io-service;1"].
					getService(Components.interfaces.nsIIOService).
					newURI(this.location, "", null).resolve(url);
			} else if(Zotero.isNode && this.location) {
				resolved = require('url').resolve(this.location, url);
			} else if (this.document) {
				var a = this.document.createElement('a');
				a.href = url;
				resolved = a.href;
			} else if (url.indexOf('//') == 0) {
				// Protocol-relative URL with no associated web page
				// Use HTTP by default
				resolved = 'http:' + url;
			} else {
				throw new Error('Cannot resolve relative URL without an associated web page: ' + url);
			}
		} else if (allowedSchemes.indexOf(m[1].toLowerCase()) == -1) {
			Zotero.debug("Translate: unsupported scheme " + m[1]);
			return url;
		} else {
			resolved = url;
		}
		
		Zotero.debug("Translate: resolved to " + resolved);
		
		// convert proxy to proper if applicable
		if(!dontUseProxy && this.translator && this.translator[0]
				&& this._proxy) {
			var proxiedURL = this._proxy.toProxy(resolved);
			if (proxiedURL != resolved) {
				Zotero.debug("Translate: proxified to " + proxiedURL);
			}
			resolved = proxiedURL;
		}
		
		/*var m = hostPortRe.exec(resolved);
		if(!m) {
			throw new Error("Invalid URL supplied for HTTP request: "+url);
		} else if(this._translate.document && this._translate.document.location) {
			var loc = this._translate.document.location;
			if(this._translate._currentState !== "translate" && loc
					&& (m[1].toLowerCase() !== loc.protocol.toLowerCase()
					|| m[2].toLowerCase() !== loc.host.toLowerCase())) {
				throw new Error("Attempt to access "+m[1]+"//"+m[2]+" from "+loc.protocol+"//"+loc.host
					+" blocked: Cross-site requests are only allowed during translation");
			}
		}*/
		
		return resolved;
	},
	
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
		
		// reset async processes and propagate them to parent
		if(this._parentTranslator && this._runningAsyncProcesses) {
			this._parentTranslator.decrementAsyncProcesses("Zotero.Translate#complete", this._runningAsyncProcesses);
		}
		this._runningAsyncProcesses = 0;
		
		if(!returnValue && this._returnValue) returnValue = this._returnValue;
		
		var errorString = null;
		if(!returnValue && error) errorString = this._generateErrorString(error);
		if(this._currentState === "detect") {
			if(this._potentialTranslators.length) {
				var lastTranslator = this._potentialTranslators.shift();
				var lastProxy = this._proxies ? this._proxies.shift() : null;
				
				if (returnValue) {
					var dupeTranslator = {proxy: lastProxy ? new Zotero.Proxy(lastProxy) : null};
					
					for (var i in lastTranslator) dupeTranslator[i] = lastTranslator[i];
					if (Zotero.isBookmarklet && returnValue === "server") {
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
			// unset return value is equivalent to true
			if(returnValue === undefined) returnValue = true;
			
			if(returnValue) {
				if(this.saveQueue.length) {
					this._waitingForSave = true;
					this._saveItems(this.saveQueue)
						.catch(e => this._runHandler("error", e))
						.then(() => this.saveQueue = []);
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
			
			this._currentState = null;
			
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
	 * Canonicalize an array of tags such that they are all objects with the tag stored in the
	 * "tag" property and a type (if specified) is stored in the "type" property
	 * @returns {Object[]} Array of new tag objects
	 */
	"_cleanTags":function(tags) {
		var newTags = [];
		if(!tags) return newTags;
		for(var i=0; i<tags.length; i++) {
			var tag = tags[i];
			if(!tag) continue;
			if(typeof(tag) == "object") {
				var tagString = tag.tag || tag.name;
				if(tagString) {
					var newTag = {"tag":tagString};
					if(tag.type) newTag.type = tag.type;
					newTags.push(newTag);
				}
			} else {
				newTags.push({"tag":tag.toString()});
			}
		}
		return newTags;
	},
	
	/**
	 * Saves items to the database, taking care to defer attachmentProgress notifications
	 * until after save
	 */
	_saveItems: Zotero.Promise.method(function (items) {
		var itemDoneEventsDispatched = false;
		var deferredProgress = [];
		var attachmentsWithProgress = [];
		
		function attachmentCallback(attachment, progress, error) {
			// Find by id if available (used in the connector)
			if (attachment.id) {
				var attachmentIndex = this._savingAttachments.findIndex(x => x.id == attachment.id);
			}
			else {
				var attachmentIndex = this._savingAttachments.indexOf(attachment);
			}
			if(progress === false || progress === 100) {
				if(attachmentIndex !== -1) {
					this._savingAttachments.splice(attachmentIndex, 1);
				}
			} else if(attachmentIndex === -1) {
				this._savingAttachments.push(attachment);
			}
			
			if(itemDoneEventsDispatched) {
				// itemDone event has already fired, so we can fire attachmentProgress
				// notifications
				this._runHandler("attachmentProgress", attachment, progress, error);
				this._checkIfDone();
			} else {
				// Defer until after we fire the itemDone event
				deferredProgress.push([attachment, progress, error]);
				attachmentsWithProgress.push(attachment);
			}
		}
		
		return this._itemSaver.saveItems(items.slice(), attachmentCallback.bind(this),
			function(newItems) {
				this._runHandler("itemsDone", newItems);
				// Remove attachments not being saved from item.attachments
				for(var i=0; i<items.length; i++) {
					var item = items[i];
					for(var j=0; j<item.attachments.length; j++) {
						if(attachmentsWithProgress.indexOf(item.attachments[j]) === -1) {
							item.attachments.splice(j--, 1);
						}
					}
				}
				
				// Trigger itemDone events, waiting for them if they return promises
				var maybePromises = [];
				for(var i=0, nItems = items.length; i<nItems; i++) {
					maybePromises.push(this._runHandler("itemDone", newItems[i], items[i]));
				}
				return Zotero.Promise.all(maybePromises).then(() => newItems);
			}.bind(this))
		.then(function (newItems) {
			// Specify that itemDone event was dispatched, so that we don't defer
			// attachmentProgress notifications anymore
			itemDoneEventsDispatched = true;
			
			// Run deferred attachmentProgress notifications
			for(var i=0; i<deferredProgress.length; i++) {
				this._runHandler("attachmentProgress", deferredProgress[i][0],
					deferredProgress[i][1], deferredProgress[i][2]);
			}
			
			this._savingItems -= items.length;
			this.newItems = this.newItems.concat(newItems);
			this._checkIfDone();
		}.bind(this))
		.catch((e) => {
			this._savingItems -= items.length;
			this.complete(false, e);
			throw e;
		});
	}),
	
	/**
	 * Checks if saving done, and if so, fires done event
	 */
	"_checkIfDone":function() {
		if(!this._savingItems && !this._savingAttachments.length && (!this._currentState || this._waitingForSave)) {
			if (this.newCollections
					&& this._libraryID !== false
					&& this._itemSaver.saveCollections) {
				var me = this;
				this._itemSaver.saveCollections(this.newCollections)
				.then(function (newCollections) {
					me.newCollections = newCollections;
					me._runHandler("done", true);
				})
				.catch(function (err) {
					me._runHandler("error", err);
					me._runHandler("done", false);
				});
			} else {
				this._runHandler("done", true);
			}
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
		
		let lab = this._potentialTranslators[0].label;
		this._loadTranslator(this._potentialTranslators[0])
		.then(function() {
			return this._detectTranslatorLoaded();
		}.bind(this))
		.catch(function (e) {
			this.complete(false, e);
		}.bind(this));
	},
	
	/**
	 * Runs detect code for a translator
	 */
	"_detectTranslatorLoaded":function() {
		this._prepareDetection();
		
		this.incrementAsyncProcesses("Zotero.Translate#getTranslators");
		
		try {
			var returnValue = Function.prototype.apply.call(this._sandboxManager.sandbox["detect"+this._entryFunctionSuffix], null, this._getParameters());
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
		Zotero.debug("Translate: All translator detect calls and RPC calls complete:");
		this._foundTranslators.sort(function(a, b) {
			// If priority is equal, prioritize translators that run in browser over the client
			if (a.priority == b.priority) {
				return a.runMode - b.runMode;
			}
			return a.priority-b.priority;
		});
		if (this._foundTranslators.length) {
			this._foundTranslators.forEach(function(t) {
				Zotero.debug("\t" + t.label + ": " + t.priority);
			});
		} else {
			Zotero.debug("\tNo suitable translators found");
		}
		this._runHandler("translators", this._foundTranslators);
	},
	
	/**
	 * Loads the translator into its sandbox
	 * @param {Zotero.Translator} translator
	 * @return {Promise<Boolean>} Whether the translator could be successfully loaded
	 */
	"_loadTranslator": Zotero.Promise.method(function (translator) {
		var sandboxLocation = this._getSandboxLocation();
		if(!this._sandboxLocation || sandboxLocation !== this._sandboxLocation) {
			this._sandboxLocation = sandboxLocation;
			this._generateSandbox();
		}
		
		this._currentTranslator = translator;
		
		// Pass on the proxy of the parent translate
		if (this._parentTranslator) {
			this._proxy = this._parentTranslator._proxy;
		} else {
			this._proxy = translator.proxy;
		}
		this._runningAsyncProcesses = 0;
		this._returnValue = undefined;
		this._aborted = false;
		this.saveQueue = [];
		
		var parse = function(code) {
			Zotero.debug("Translate: Parsing code for " + translator.label + " "
				+ "(" + translator.translatorID + ", " + translator.lastUpdated + ")", 4);
			this._sandboxManager.eval(
				"var exports = {}, ZOTERO_TRANSLATOR_INFO = " + code,
				[
					"detect" + this._entryFunctionSuffix,
					"do" + this._entryFunctionSuffix,
					"exports",
					"ZOTERO_TRANSLATOR_INFO"
				],
				(translator.file ? translator.file.path : translator.label)
			);
			this._translatorInfo = this._sandboxManager.sandbox.ZOTERO_TRANSLATOR_INFO;
		}.bind(this);
		
		if (this.noWait) {
			try {
				let codePromise = translator.getCode();
				if (!codePromise.isResolved()) {
					throw new Error("Code promise is not resolved in noWait mode");
				}
				parse(codePromise.value());
			}
			catch (e) {
				this.complete(false, e);
			}
		}
		else {
			return translator.getCode()
			.then(parse)
			.catch(function(e) {
				this.complete(false, e);
			}.bind(this));
		}
	}),
	
	/**
	 * Generates a sandbox for scraping/scraper detection
	 */
	"_generateSandbox":function() {
		Zotero.debug("Translate: Binding sandbox to "+(typeof this._sandboxLocation == "object" ? this._sandboxLocation.document.location : this._sandboxLocation), 4);
		if (this._parentTranslator && this._parentTranslator._sandboxManager.newChild) {
			this._sandboxManager = this._parentTranslator._sandboxManager.newChild();
		} else {
			this._sandboxManager = new Zotero.Translate.SandboxManager(this._sandboxLocation);
		}
		const createArrays = "['creators', 'notes', 'tags', 'seeAlso', 'attachments']";
		var src = "";
		if (Zotero.isFx && !Zotero.isBookmarklet) {
			src = "var Zotero = {};";
		}
		src += "Zotero.Item = function (itemType) {"+
				"var createArrays = "+createArrays+";"+
				"this.itemType = itemType;"+
				"for(var i=0, n=createArrays.length; i<n; i++) {"+
					"this[createArrays[i]] = [];"+
				"}"+
		"};";
		
		if(this instanceof Zotero.Translate.Export || this instanceof Zotero.Translate.Import) {
			src += "Zotero.Collection = function () {};"+
			"Zotero.Collection.prototype.complete = function() { return Zotero._collectionDone(this); };";
		}
		
		src += "Zotero.Item.prototype.complete = function() { return Zotero._itemDone(this); }";

		this._sandboxManager.eval(src);
		this._sandboxManager.importObject(this.Sandbox, this);
		this._sandboxManager.importObject({"Utilities":new Zotero.Utilities.Translate(this)});

		this._sandboxZotero = this._sandboxManager.sandbox.Zotero;

		if(Zotero.isFx) {
			if(this._sandboxZotero.wrappedJSObject) this._sandboxZotero = this._sandboxZotero.wrappedJSObject;
		}
		this._sandboxZotero.Utilities.HTTP = this._sandboxZotero.Utilities;
		
		this._sandboxZotero.isBookmarklet = Zotero.isBookmarklet || false;
		this._sandboxZotero.isConnector = Zotero.isConnector || false;
		this._sandboxZotero.isServer = Zotero.isServer || false;
		this._sandboxZotero.parentTranslator = this._parentTranslator
			&& this._parentTranslator._currentTranslator ? 
			this._parentTranslator._currentTranslator.translatorID : null;
		
		// create shortcuts
		this._sandboxManager.sandbox.Z = this._sandboxZotero;
		this._sandboxManager.sandbox.ZU = this._sandboxZotero.Utilities;
		this._transferItem = this._sandboxZotero._transferItem;
		
		// Add web helper functions
		if (this.type == 'web') {
			this._sandboxManager.sandbox.attr = this._attr.bind(this);
			this._sandboxManager.sandbox.text = this._text.bind(this);
		}
	},
	
	/**
	 * Helper function to extract HTML attribute text
	 */
	_attr: function (selector, attr, index) {
		if (typeof arguments[0] == 'string') {
			var docOrElem = this.document;
		}
		// Document or element passed as first argument
		else {
			// TODO: Warn if Document rather than Element is passed once we drop 4.0 translator
			// support
			[docOrElem, selector, attr, index] = arguments;
		}
		var elem = index
			? docOrElem.querySelectorAll(selector).item(index)
			: docOrElem.querySelector(selector);
		return elem ? elem.getAttribute(attr) : null;
	},
	
	/**
	 * Helper function to extract HTML element text
	 */
	_text: function (selector, index) {
		if (typeof arguments[0] == 'string') {
			var docOrElem = this.document;
		}
		// Document or element passed as first argument
		else {
			// TODO: Warn if Document rather than Element is passed once we drop 4.0 translator
			// support
			[docOrElem, selector, index] = arguments;
		}
		var elem = index
			? docOrElem.querySelectorAll(selector).item(index)
			: docOrElem.querySelector(selector);
		return elem ? elem.textContent : null;
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
	_generateErrorString: function (error) {
		var errorString = error;
		if (error.stack && error) {
			errorString += "\n\n" + error.stack;
		}
		if (this.path) {
			errorString += `\nurl => ${this.path}`;
		}
		if (Zotero.Prefs.get("downloadAssociatedFiles")) {
			errorString += "\ndownloadAssociatedFiles => true";
		}
		if (Zotero.Prefs.get("automaticSnapshots")) {
			errorString += "\nautomaticSnapshots => true";
		}
		return errorString;
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
	"_prepareTranslation": function () { return Zotero.Promise.resolve(); }
}

/**
 * @class Web translation
 *
 * @property {Document} document The document object to be used for web scraping (set with setDocument)
 * @property {Zotero.CookieSandbox} cookieSandbox A CookieSandbox to manage cookies for
 *     this Translate instance.
 */
Zotero.Translate.Web = function() {
	this._registeredDOMObservers = {}
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
	try {
		this.rootDocument = doc.defaultView.top.document;
	} catch (e) {
		// Cross-origin frames won't be able to access top.document and will throw an error
	}
	if (!this.rootDocument) {
		this.rootDocument = doc;
	}
	this.setLocation(doc.location.href, this.rootDocument.location.href);
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
 * @param {String} rootLocation The URL of the root page, within which `location` is embedded
 */
Zotero.Translate.Web.prototype.setLocation = function(location, rootLocation) {
	this.location = location;
	this.rootLocation = rootLocation || location;
	this.path = this.location;
}

/**
 * Get potential web translators
 */
Zotero.Translate.Web.prototype._getTranslatorsGetPotentialTranslators = function() {
	return Zotero.Translators.getWebTranslatorsForLocation(this.location, this.rootLocation);
}

/**
 * Bind sandbox to document being translated
 */
Zotero.Translate.Web.prototype._getSandboxLocation = function() {
	if(this._parentTranslator) {
		return this._parentTranslator._sandboxLocation;
	} else if(this.document.defaultView
			&& (this.document.defaultView.toString().indexOf("Window") !== -1
				|| this.document.defaultView.toString().indexOf("XrayWrapper") !== -1)) {
		return this.document.defaultView;
	} else {
		return this.document.location.toString();
	}
}

/**
 * Pass document and location to detect* and do* functions
 */
Zotero.Translate.Web.prototype._getParameters = function() {
	if (Zotero.Translate.DOMWrapper && Zotero.Translate.DOMWrapper.isWrapped(this.document)) {
		return [
			this._sandboxManager.wrap(
				Zotero.Translate.DOMWrapper.unwrap(this.document),
				null,
				this.document.SpecialPowers_wrapperOverrides
			),
			this.location
		];
	} else {
		return [this.document, this.location];
	}
};

/**
 * Prepare translation
 */
Zotero.Translate.Web.prototype._prepareTranslation = Zotero.Promise.method(function () {
	this._itemSaver = new Zotero.Translate.ItemSaver({
		libraryID: this._libraryID,
		collections: this._collections,
		attachmentMode: Zotero.Translate.ItemSaver[(this._saveAttachments ? "ATTACHMENT_MODE_DOWNLOAD" : "ATTACHMENT_MODE_IGNORE")],
		forceTagType: 1,
		sessionID: this._sessionID,
		cookieSandbox: this._cookieSandbox,
		proxy: this._proxy,
		baseURI: this.location
	});
	this.newItems = [];
});

/**
 * Overload translate to set selectedItems
 */
Zotero.Translate.Web.prototype.translate = function (options = {}, ...args) {
	if (typeof options == 'number' || options === false) {
		Zotero.debug("Translate: translate() now takes an object -- update your code", 2);
		options = {
			libraryID: options,
			saveAttachments: args[0],
			selectedItems: args[1]
		};
	}
	this._selectedItems = options.selectedItems;
	return Zotero.Translate.Base.prototype.translate.call(this, options);
}

/**
 * Overload _translateTranslatorLoaded to send an RPC call if necessary
 */
Zotero.Translate.Web.prototype._translateTranslatorLoaded = async function() {
	var runMode = this.translator[0].runMode;
	if(runMode === Zotero.Translator.RUN_MODE_IN_BROWSER || this._parentTranslator) {
		Zotero.Translate.Base.prototype._translateTranslatorLoaded.apply(this);
	} else if(runMode === Zotero.Translator.RUN_MODE_ZOTERO_STANDALONE ||
			(runMode === Zotero.Translator.RUN_MODE_ZOTERO_SERVER && await Zotero.Connector.checkIsOnline())) {
		var me = this;
		let html = this.document.documentElement.innerHTML;
		html = html.replace(new RegExp(Zotero.Utilities.quotemeta(ZOTERO_CONFIG.BOOKMARKLET_URL), 'g'), "about:blank")
		// Higher timeout since translation might take a while if additional HTTP requests are made
		Zotero.Connector.callMethod({method: "savePage", timeout: 60*1000}, {
				sessionID: this._sessionID,
				uri: this.location.toString(),
				translatorID: (typeof this.translator[0] === "object"
				                ? this.translator[0].translatorID : this.translator[0]),
				cookie: this.document.cookie,
				proxy: this._proxy ? this._proxy.toJSON() : null,
				html
			}).then(me._translateRPCComplete.bind(me), me._translateRPCComplete.bind(me, null));
	} else if(runMode === Zotero.Translator.RUN_MODE_ZOTERO_SERVER) {
		var me = this;
		Zotero.API.createItem({"url":this.document.location.href.toString()}).then(function(response) {
				me._translateServerComplete(201, response);
			}, function(error) {
				me._translateServerComplete(error.status, error.responseText);
			});
	}
}
	
/**
 * Called when an call to Zotero Standalone for translation completes
 */
Zotero.Translate.Web.prototype._translateRPCComplete = async function(obj, failureCode) {
	if(!obj) return this.complete(false, failureCode);
	
	if(obj.selectItems) {
		// if we have to select items, call the selectItems handler and do it
		var me = this;
		this._runHandler("select", obj.selectItems,
			function(selectedItems) {
				Zotero.Connector.callMethod("selectItems",
					{"instanceID":obj.instanceID, "selectedItems":selectedItems})
					.then((obj) => me._translateRPCComplete(obj))
			}
		);
	} else {
		// if we don't have to select items, continue
		for(var i=0, n=obj.items.length; i<n; i++) {
			this._runHandler("itemDone", null, obj.items[i]);
		}
		this.newItems = obj.items;
		let itemSaver = new Zotero.Translate.ItemSaver({
			libraryID: this._libraryID,
			collections: this._collections,
			attachmentMode: Zotero.Translate.ItemSaver[(this._saveAttachments ? "ATTACHMENT_MODE_DOWNLOAD" : "ATTACHMENT_MODE_IGNORE")],
			forceTagType: 1,
			sessionID: this._sessionID,
			cookieSandbox: this._cookieSandbox,
			proxy: this._proxy,
			baseURI: this.location
		});
		await itemSaver._pollForProgress(obj.items, this._runHandler.bind(this, 'attachmentProgress'));
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
		this._runHandler("select", response.items,
			function(selectedItems) {
				Zotero.API.createItem({
					url: me.document.location.href.toString(),
					items: selectedItems,
					token: response.token
				}).then(function(response) {
					me._translateServerComplete(201, response);
				}, function(error) {
					me._translateServerComplete(error.status, error.responseText);
				});
			}
		);
	} else if(statusCode === 201) {
		// Created
		try {
			response = JSON.parse(response);
		} catch(e) {
			Zotero.logError(e);
			this.complete(false, "Invalid JSON response received from server");
			return;
		}
		
		let items = [];
		for (let key in response.successful) {
			var item = response.successful[key].data;
			
			if(!("attachments" in item)) item.attachments = [];
			this._runHandler("itemDone", null, item);
			items.push(item);
		}
		this.newItems = items;
		this._runHandler("itemsDone", null, item);
		this.complete(true);
	} else {
		this.complete(false, response);
	}
}

/**
 * Overload complete to report translation failure
 */
Zotero.Translate.Web.prototype.complete = async function(returnValue, error) {
	// call super
	var oldState = this._currentState;
	var errorString = Zotero.Translate.Base.prototype.complete.apply(this, [returnValue, error]);
	
	var promise;
	if (Zotero.Prefs.getAsync) {
		promise = Zotero.Prefs.getAsync('reportTranslationFailure');
	} else {
		promise = Zotero.Promise.resolve(Zotero.Prefs.get("reportTranslationFailure"));
	}
	var reportTranslationFailure = await promise;
	// Report translation failure if we failed
	if(oldState == "translate" && errorString && !this._parentTranslator && this.translator.length
		&& this.translator[0].inRepository && reportTranslationFailure) {
		// Don't report failure if in private browsing mode
		if (Zotero.isConnector && !Zotero.isBookmarklet && await Zotero.Connector_Browser.isIncognito()) {
			return
		}
		
		var translator = this.translator[0];
		var info = await Zotero.getSystemInfo();
		
		var postBody = "id=" + encodeURIComponent(translator.translatorID) +
					   "&lastUpdated=" + encodeURIComponent(translator.lastUpdated) +
					   "&diagnostic=" + encodeURIComponent(info) +
					   "&errorData=" + encodeURIComponent(errorString);
		return Zotero.HTTP.doPost(ZOTERO_CONFIG.REPOSITORY_URL + "report", postBody);
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
	return (this.location ?
	        Zotero.Translators.getImportTranslatorsForLocation(this.location) :
	        Zotero.Translators.getAllForType(this.type)).
	then(function(translators) { return [translators] });;
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
		return Zotero.Translators.getAllForType(this.type).
		then(function(translators) {
			me._potentialTranslators = [];
			me._foundTranslators = translators;
			me.complete(true);
			return me._foundTranslators;
		});
	} else {
		return Zotero.Translate.Base.prototype.getTranslators.call(this);
	}
}
	
/**
 * Overload {@link Zotero.Translate.Base#_loadTranslator} to prepare translator IO
 */
Zotero.Translate.Import.prototype._loadTranslator = function(translator) {
	return Zotero.Translate.Base.prototype._loadTranslator.call(this, translator)
	.then(function() {
		return this._loadTranslatorPrepareIO(translator);
	}.bind(this));
}
	
/**
 * Prepare translator IO
 */
Zotero.Translate.Import.prototype._loadTranslatorPrepareIO = Zotero.Promise.method(function (translator) {
	var configOptions = this._translatorInfo.configOptions;
	var dataMode = configOptions ? configOptions["dataMode"] : "";
	
	if(!this._io) {
		if(Zotero.Translate.IO.Read && this.location && this.location instanceof Components.interfaces.nsIFile) {
			this._io = new Zotero.Translate.IO.Read(this.location, this._sandboxManager);
		} else {
			this._io = new Zotero.Translate.IO.String(this._string, this.path ? this.path : "", this._sandboxManager);
		}
	}
	
	this._io.init(dataMode);
	this._sandboxManager.importObject(this._io);
});

/**
 * Prepare translation
 */
Zotero.Translate.Import.prototype._prepareTranslation = Zotero.Promise.method(function () {
	this._progress = undefined;
	
	var baseURI = null;
	if(this.location) {
		try {
			baseURI = Components.classes["@mozilla.org/network/io-service;1"].
				getService(Components.interfaces.nsIIOService).newFileURI(this.location);
		} catch(e) {}
	}

	this._itemSaver = new Zotero.Translate.ItemSaver({
		libraryID: this._libraryID,
		collections: this._collections,
		forceTagType: this._forceTagType,
		attachmentMode: Zotero.Translate.ItemSaver[(this._saveAttachments ? "ATTACHMENT_MODE_FILE" : "ATTACHMENT_MODE_IGNORE")],
		baseURI,
		saveOptions: Object.assign(
			{
				skipSelect: true
			},
			this._saveOptions || {}
		)
	});
	this.newItems = [];
	this.newCollections = [];
});

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
	this._export = {type: 'items', items: items};
}

/**
 * Sets the group to be exported (overrides setItems/setCollection)
 * @param {Zotero.Group[]} group
 */
Zotero.Translate.Export.prototype.setLibraryID = function(libraryID) {
	this._export = {type: 'library', id: libraryID};
}

/**
 * Sets the collection to be exported (overrides setItems/setGroup)
 * @param {Zotero.Collection[]} collection
 */
Zotero.Translate.Export.prototype.setCollection = function(collection) {
	this._export = {type: 'collection', collection: collection};
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
	if(this._currentState === "detect") {
		return Zotero.Promise.reject(new Error("getTranslators: detection is already running"));
	}
	var me = this;
	return Zotero.Translators.getAllForType(this.type).then(function(translators) {
		me._currentState = "detect";
		me._foundTranslators = translators;
		me._potentialTranslators = [];
		me.complete(true);
		return me._foundTranslators;
	});
}

/**
 * Does the actual export, after code has been loaded and parsed
 */
Zotero.Translate.Export.prototype._prepareTranslation = Zotero.Promise.method(function () {
	this._progress = undefined;
	
	// initialize ItemGetter
	this._itemGetter = new Zotero.Translate.ItemGetter();
	
	// Toggle legacy mode for translators pre-4.0.27
	this._itemGetter.legacy = Services.vc.compare('4.0.27', this._translatorInfo.minVersion) > 0;
	
	var configOptions = this._translatorInfo.configOptions || {},
		getCollections = configOptions.getCollections || false;
	var loadPromise = Zotero.Promise.resolve();
	switch (this._export.type) {
		case 'collection':
			this._itemGetter.setCollection(this._export.collection, getCollections);
			break;
		case 'items':
			this._itemGetter.setItems(this._export.items);
			break;
		case 'library':
			loadPromise = this._itemGetter.setAll(this._export.id, getCollections);
			break;
		default:
			throw new Error('No export set up');
			break;
	}
	delete this._export;
	
	if (this.noWait) {
		if (!loadPromise.isResolved()) {
			throw new Error("Load promise is not resolved in noWait mode");
		}
		rest.apply(this, arguments);
	} else {
		return loadPromise.then(() => rest.apply(this, arguments))
	}
	
	function rest() {
		// export file data, if requested
		if(this._displayOptions["exportFileData"]) {
			this.location = this._itemGetter.exportFiles(this.location, this.translator[0].target);
		}

		// initialize IO
		// this is currently hackish since we pass null callbacks to the init function (they have
		// callbacks to be consistent with import, but they are synchronous, so we ignore them)
		if(!this.location) {
			this._io = new Zotero.Translate.IO.String(null, this.path ? this.path : "", this._sandboxManager);
			this._io.init(configOptions["dataMode"], function() {});
		} else if(!Zotero.Translate.IO.Write) {
			throw new Error("Writing to files is not supported in this build of Zotero.");
		} else {
			this._io = new Zotero.Translate.IO.Write(this.location);
			this._io.init(configOptions["dataMode"],
				this._displayOptions["exportCharset"] ? this._displayOptions["exportCharset"] : null,
				function() {});
		}

		this._sandboxManager.importObject(this._io);
	}
});

/**
 * Overload Zotero.Translate.Base#translate to make sure that
 *   Zotero.Translate.Export#translate is not called without setting a
 *   translator first. Doesn't make sense to run detection for export.
 */
Zotero.Translate.Export.prototype.translate = function() {
	if(!this.translator || !this.translator.length) {
		this.complete(false, new Error("Export translation initiated without setting a translator"));
	} else {
		return Zotero.Translate.Base.prototype.translate.apply(this, arguments);
	}
};

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
Zotero.Translate.Search.prototype.ERROR_NO_RESULTS = "No items returned from any translator";

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
 * Set an identifier to use for searching
 *
 * @param {Object} identifier - An object with 'DOI', 'ISBN', or 'PMID'
 */
Zotero.Translate.Search.prototype.setIdentifier = function (identifier) {
	var search;
	if (identifier.DOI) {
		search = {
			itemType: "journalArticle",
			DOI: identifier.DOI
		};
	}
	else if (identifier.ISBN) {
		search = {
			itemType: "book",
			ISBN: identifier.ISBN
		};
	}
	else if (identifier.PMID) {
		search = {
			itemType: "journalArticle",
			contextObject: "rft_id=info:pmid/" + identifier.PMID
		};
	}
	else if (identifier.arXiv) {
		search = {
			itemType: "journalArticle",
			arXiv: identifier.arXiv
		};
	}
	else {
		throw new Error("Unrecognized identifier");
	}
	this.setSearch(search);
}

/**
 * Overloads {@link Zotero.Translate.Base#getTranslators} to always return all potential translators
 */
Zotero.Translate.Search.prototype.getTranslators = function() {
	return Zotero.Translate.Base.prototype.getTranslators.call(this, true);
}

/**
 * Overload Zotero.Translate.Base#complete to move onto the next translator if
 * translation fails
 */
Zotero.Translate.Search.prototype.complete = function(returnValue, error) {
	if(this._currentState == "translate"
			&& (!this.newItems || !this.newItems.length)
			&& !this._savingItems
			//length is 0 only when translate was called without translators
			&& this.translator.length) {
		Zotero.debug("Translate: Could not find a result using " + this.translator[0].label
			+ (this.translator.length > 1 ? " -- trying next translator" : ""), 3);
		if(error) Zotero.debug(this._generateErrorString(error), 3);
		if(this.translator.length > 1) {
			this.translator.shift();
			this.translate({
				libraryID: this._libraryID,
				saveAttachments: this._saveAttachments,
				collections: this._collections
			});
			return;
		} else {
			Zotero.debug("No more translators to try");
			error = this.ERROR_NO_RESULTS;
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
	if(Zotero.isFx) {
		return [this._sandboxManager.copyObject(this.search)];
	}
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
			throw new Error("DOMParser error: loading data into data store failed");
		}
		
		if("normalize" in nodes) nodes.normalize();
		
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
Zotero.Translate.IO.String = function(string, uri, sandboxManager) {
	if(string && typeof string === "string") {
		this.string = string;
	} else {
		this.string = "";
	}
	this.contentLength = this.string.length;
	this.bytesRead = 0;
	this._uri = uri;
	this._sandboxManager = sandboxManager;
}

Zotero.Translate.IO.String.prototype = {
	"__exposedProps__":{
		"RDF":"r",
		"read":"r",
		"write":"r",
		"setCharacterSet":"r",
		"getXML":"r"
	},
	
	"_initRDF": function () {
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
		return (Zotero.isFx && !Zotero.isBookmarklet ? this._sandboxManager.wrap(xml) : xml);
	},
	
	init: function (newMode) {
		this.bytesRead = 0;
		this._noCR = undefined;
		
		this._mode = newMode;
		if(newMode === "xml/e4x") {
			throw new Error("E4X is not supported");
		} else if(newMode && (Zotero.Translate.IO.rdfDataModes.indexOf(newMode) !== -1
				|| newMode.substr(0, 3) === "xml/dom") && this._xmlInvalid) {
			throw new Error("XML known invalid");
		} else if(Zotero.Translate.IO.rdfDataModes.indexOf(this._mode) !== -1) {
			this._initRDF();
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
		
		const rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
		var values = this.getStatementsMatching(resource, rdf + 'value');
		if (values && values.length) {
			return values[0][2];
		}
		
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

if (typeof process === 'object' && process + '' === '[object process]'){
    module.exports = Zotero.Translate;
}
