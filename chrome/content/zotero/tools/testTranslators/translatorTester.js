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

// Timeout for test to complete
var TEST_RUN_TIMEOUT = 60000;
var EXPORTED_SYMBOLS = ["Zotero_TranslatorTesters"];

// For debugging specific translators by label
var includeTranslators = [];

if (typeof window != "undefined") {
	window.Zotero = window.Zotero;
} else if (typeof global != 'undefined') {
	global.Zotero = global.Zotero;
} else if (typeof this != 'undefined') {
	this.Zotero = this.Zotero;
}

var Zotero_TranslatorTesters = new function() {
	const TEST_TYPES = ["web", "import", "export", "search"];
	var collectedResults = {};
	
	/**
	 * Runs all tests
	 */
	this.runAllTests = function (numConcurrentTests, skipTranslators, writeDataCallback) {
		var id = Math.random() * (100000000 - 1) + 1;
		
		if (!(typeof process === 'object' && process + '' === '[object process]')){
			waitForDialog();
		
			if(!Zotero) {
				Zotero = Components.classes["@zotero.org/Zotero;1"]
					.getService(Components.interfaces.nsISupports).wrappedJSObject;
			}
		}
		
		var testers = [];
		var waitingForTranslators = TEST_TYPES.length;
		for(var i=0; i<TEST_TYPES.length; i++) {
			Zotero.Translators.getAllForType(TEST_TYPES[i], true).
			then(new function() {
				var type = TEST_TYPES[i];
				return function(translators) {
					try {
						for(var i=0; i<translators.length; i++) {
							if (includeTranslators.length
									&& !includeTranslators.some(x => translators[i].label.includes(x))) continue;
							if (skipTranslators && skipTranslators[translators[i].translatorID]) continue;
							testers.push(new Zotero_TranslatorTester(translators[i], type));
						};
						
						if(!(--waitingForTranslators)) {
							runTesters(testers, numConcurrentTests, id, writeDataCallback);
						}
					} catch(e) {
						Zotero.debug(e);
						Zotero.logError(e);
					}
				};
			});
		};
	};
	
	/**
	 * Runs a specific set of tests
	 */
	function runTesters(testers, numConcurrentTests, id, writeDataCallback) {
		var testersRunning = 0;
		var results = []
		
		var testerDoneCallback = function(tester) {
			try {
				if(tester.pending.length) return;
				
				Zotero.debug("Done testing "+tester.translator.label);
				
				// Done translating, so serialize test results
				testersRunning--;
				let results = tester.serialize();
				let last = !testers.length && !testersRunning;
				collectData(id, results, last, writeDataCallback);
				
				if(testers.length) {
					// Run next tester if one is available
					runNextTester();
				}
			} catch(e) {
				Zotero.debug(e);
				Zotero.logError(e);
			}
		};
		
		var runNextTester = function() {
			if (!testers.length) {
				return;
			}
			testersRunning++;
			Zotero.debug("Testing "+testers[0].translator.label);
			testers.shift().runTests(testerDoneCallback);
		};
		
		for(var i=0; i<numConcurrentTests; i++) {
			runNextTester();
		};
	}
	
	function waitForDialog() {
		Components.utils.import("resource://gre/modules/Services.jsm");
		var loadobserver = function (ev) {
			ev.originalTarget.removeEventListener("load", loadobserver, false);
			if (ev.target.location == "chrome://global/content/commonDialog.xul") {
				let win = ev.target.docShell.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
					.getInterface(Components.interfaces.nsIDOMWindow);
				Zotero.debug("Closing rogue dialog box!\n\n" + win.document.documentElement.textContent, 2);
				win.document.documentElement.getButton('accept').click();
			}
		};
		var winobserver = {
			observe: function (subject, topic, data) {
				if (topic != "domwindowopened") return;
				var win = subject.QueryInterface(Components.interfaces.nsIDOMWindow);
				win.addEventListener("load", loadobserver, false);
			}
		};
		Services.ww.registerNotification(winobserver);
	}
	
	function collectData(id, results, last, writeDataCallback) {
		if (!collectedResults[id]) {
			collectedResults[id] = [];
		}
		collectedResults[id].push(results);
		
		//
		// TODO: Only do the below every x collections, or if last == true
		//
		// Sort results
		if ("getLocaleCollation" in Zotero) {
			let collation = Zotero.getLocaleCollation();
			var strcmp = function (a, b) {
				return collation.compareString(1, a, b);
			};
		}
		else {
			var strcmp = function (a, b) {
				return a.toLowerCase().localeCompare(b.toLowerCase());
			};
		}
		collectedResults[id].sort(function (a, b) {
			if (a.type !== b.type) {
				return TEST_TYPES.indexOf(a.type) - TEST_TYPES.indexOf(b.type);
			}
			return strcmp(a.label, b.label);
		});
		
		writeDataCallback(collectedResults[id], last);
	}
}

/**
 * A tool to run unit tests for a given translator
 *
 * @property {Array} tests All tests for this translator
 * @property {Array} pending All tests for this translator
 * @property {Array} succeeded All tests for this translator
 * @property {Array} failed All tests for this translator
 * @property {Array} unknown All tests for this translator
 * @constructor
 * @param {Zotero.Translator[]} translator The translator for which to run tests
 * @param {String} type The type of tests to run (web, import, export, or search)
 * @param {Function} [debugCallback] A function to call to write debug output. If not present,
 *     Zotero.debug will be used.
 * @param {Object} [translatorProvider] Used by Scaffold to override Zotero.Translators
 */
var Zotero_TranslatorTester = function(translator, type, debugCallback, translatorProvider) {
	this.type = type;
	this.translator = translator;
	this.output = "";
	this.isSupported = this.translator.runMode === Zotero.Translator.RUN_MODE_IN_BROWSER;
	this.translator.runMode = Zotero.Translator.RUN_MODE_IN_BROWSER;
	this.translatorProvider = translatorProvider;
	
	this.tests = [];
	this.pending = [];
	this.succeeded = [];
	this.failed = [];
	this.unknown = [];
	
	var me = this;
	this._debug = function(obj, a, b) {
		me.output += me.output ? "\n"+a : a;
		if(debugCallback) {
			debugCallback(me, a, b);
		} else {
			Zotero.debug(a, b);
		}
	};
	
	var code = translator.code;
	var testStart = code.indexOf("/** BEGIN TEST CASES **/");
	var testEnd   = code.indexOf("/** END TEST CASES **/"); 
	if (testStart !== -1 && testEnd !== -1) {
		var test = code.substring(testStart + 24, testEnd)
			.replace(/^[\s\r\n]*var testCases = /, '')
			.replace(/;[\s\r\n]*$/, '');
		try {
			var testObject = JSON.parse(test);
		} catch (e) {
			Zotero.logError(e+" parsing tests for "+translator.label);
			return;
		}
		
		for(var i=0, n=testObject.length; i<n; i++) {
			if(testObject[i].type === type) {
				this.tests.push(testObject[i]);
				this.pending.push(testObject[i]);
			}
		}
	}
};

Zotero_TranslatorTester.DEFER_DELAY = 20000; // Delay for deferred tests

/**
 * Removes document objects, which contain cyclic references, and other fields to be ignored from items
 * @param {Object} Item, in the format returned by Zotero.Item.serialize()
 */
Zotero_TranslatorTester._sanitizeItem = function(item, testItem, keepValidFields) {
	// remove cyclic references 
	if(item.attachments && item.attachments.length) {
		// don't actually test URI equality
		for (var i=0; i<item.attachments.length; i++) {
			var attachment = item.attachments[i];
			if(attachment.document) {
				delete attachment.document;
			}
			
			if(attachment.url) {
				delete attachment.url;
			}
			
			if(attachment.complete) {
				delete attachment.complete;
			}
		}
	}
	
	// try to convert to JSON and back to get rid of undesirable undeletable elements; this may fail
	try {
		item = JSON.parse(JSON.stringify(item));
	} catch(e) {};
	
	// remove fields that don't exist or aren't valid for this item type, and normalize base fields
	// to fields specific to this item
	var fieldID, itemFieldID,
		typeID = Zotero.ItemTypes.getID(item.itemType);
	const skipFields = ["note", "notes", "itemID", "attachments", "tags", "seeAlso",
						"itemType", "complete", "creators"];
	for(var field in item) {
		if(skipFields.indexOf(field) !== -1) {
			continue;
		}
		
		if((!item[field] && (!testItem || item[field] !== false))
				|| !(fieldID = Zotero.ItemFields.getID(field))) {
			delete item[field];
			continue;
		}
		
		if(itemFieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(typeID, fieldID)) {
			var value = item[field];
			delete item[field];		
			item[Zotero.ItemFields.getName(itemFieldID)] = value;
			continue;
		}
		
		if(!Zotero.ItemFields.isValidForType(fieldID, typeID)) {
			delete item[field];
		}
	}
	
	// remove fields to be ignored
	if(!keepValidFields && "accessDate" in item) delete item.accessDate;
	
	// Sort tags
	if (item.tags && Array.isArray(item.tags)) {
		// Normalize tags -- necessary until tests are updated for 5.0
		if (testItem) {
			item.tags = Zotero.Translate.Base.prototype._cleanTags(item.tags);
		}
		item.tags.sort((a, b) => {
			if (a.tag < b.tag) return -1;
			if (b.tag < a.tag) return 1;
			return 0;
		});
	}
	
	return item;
};
/**
 * Serializes translator tester results to JSON
 */
Zotero_TranslatorTester.prototype.serialize = function() {
	return {
		"translatorID":this.translator.translatorID,
		"type":this.type,
		"output":this.output,
		"label":this.translator.label,
		"isSupported":this.isSupported,
		"pending":this.pending,
		"failed":this.failed,
		"succeeded":this.succeeded,
		"unknown":this.unknown
	};
};

/**
 * Sets tests for this translatorTester
 */
Zotero_TranslatorTester.prototype.setTests = function(tests) {
	this.tests = tests.slice(0);
	this.pending = tests.slice(0);
	this.succeeded = [];
	this.failed = [];
	this.unknown = [];
};

/**
 * Executes tests for this translator
 * @param {Function} testDoneCallback A callback to be executed each time a test is complete
 */
Zotero_TranslatorTester.prototype.runTests = function(testDoneCallback, recursiveRun) {
	if(!recursiveRun) {
		var w = (this.pending.length === 1) ? "test" : "tests"; 
		this._debug(this, "TranslatorTester: Running "+this.pending.length+" "+w+" for "+this.translator.label);
	}
	
	if(!this.pending.length) {
		// always call testDoneCallback once if there are no tests
		if(!recursiveRun && testDoneCallback) testDoneCallback(this, null, "unknown", "No tests present\n");
		return;
	}
	
	this._runTestsRecursively(testDoneCallback);
};

/**
 * Executes tests for this translator, without checks or a debug message
 * @param {Function} testDoneCallback A callback to be executed each time a test is complete
 */
Zotero_TranslatorTester.prototype._runTestsRecursively = function(testDoneCallback) {
	var test = this.pending.shift();
	var testNumber = this.tests.length-this.pending.length;
	var me = this;
	
	this._debug(this, "TranslatorTester: Running "+this.translator.label+" Test "+testNumber);
	
	var executedCallback = false;
	var callback = function(obj, test, status, message) {
		if(executedCallback) return;
		executedCallback = true;
		
		me._debug(this, "TranslatorTester: "+me.translator.label+" Test "+testNumber+": "+status+" ("+message+")");
		me[status].push(test);
		test.message = message;
		if(testDoneCallback) testDoneCallback(me, test, status, message);
		me.runTests(testDoneCallback, true);
	};
	
	if(this.type === "web") {
		this.fetchPageAndRunTest(test, callback);
	} else {
		(Zotero.setTimeout ? Zotero : window).setTimeout(function() {
			me.runTest(test, null, callback);
		}, 0);
	}
	
	(Zotero.setTimeout ? Zotero : window).setTimeout(function() {
		callback(me, test, "failed", "Test timed out after "+TEST_RUN_TIMEOUT/1000+" seconds");
	}, TEST_RUN_TIMEOUT);
};

/**
 * Fetches the page for a given test and runs it
 *
 * This function is only applicable in Firefox; it is overridden in translator_global.js in Chrome
 * and Safari.
 *
 * @param {Object} test - Test to execute
 * @param {Function} testDoneCallback - A callback to be executed when test is complete
 */
Zotero_TranslatorTester.prototype.fetchPageAndRunTest = function (test, testDoneCallback) {
	if (typeof process === 'object' && process + '' === '[object process]'){
		this._cookieSandbox = require('request').jar();
	}
	Zotero.HTTP.processDocuments(
		test.url,
		(doc) => {
			this.runTest(test, doc, function (obj, test, status, message) {
				testDoneCallback(obj, test, status, message);
			});
		},
		{
			cookieSandbox: this._cookieSandbox
		}
	)
	.catch(function (e) {
		testDoneCallback(this, test, "failed", "Translation failed to initialize: " + e);
	}.bind(this))
};

/**
 * Executes a test for a translator, given the document to test upon
 * @param {Object} test Test to execute
 * @param {Document} data DOM document to test against
 * @param {Function} testDoneCallback A callback to be executed when test is complete
 */
Zotero_TranslatorTester.prototype.runTest = function(test, doc, testDoneCallback) {
	this._debug(this, "TranslatorTester: Translating"+(test.url ? " "+test.url : ""));
	
	var me = this;
	var translate = Zotero.Translate.newInstance(this.type);
	if (this.translatorProvider) {
		translate.setTranslatorProvider(this.translatorProvider);
	}
	if(this.type === "web") {
		translate.setDocument(doc);
	} else if(this.type === "import") {
		translate.setString(test.input);
	} else if(this.type === "search") {
		translate.setSearch(test.input);
	}
	if (translate.setCookieSandbox && this._cookieSandbox) {
		translate.setCookieSandbox(this._cookieSandbox);
	}
	
	translate.setHandler("translators", function(obj, translators) {
		me._runTestTranslate(translate, translators, test, testDoneCallback);
	});
	translate.setHandler("debug", this._debug);
	var errorReturned;
	translate.setHandler("error", function(obj, err) {
		errorReturned = err;
	});
	translate.setHandler("done", function(obj, returnValue) {
		me._checkResult(test, obj, returnValue, errorReturned, testDoneCallback);
	});
	var selectCalled = false;
	translate.setHandler("select", function(obj, items, callback) {
		if(test.items !== "multiple" && test.items.length <= 1) {
			testDoneCallback(me, test, "failed", "Zotero.selectItems() called, but only one item defined in test");
			callback({});
			return;
		} else if(selectCalled) {
			testDoneCallback(me, test, "failed", "Zotero.selectItems() called multiple times");
			callback({});
			return;
		}
		
		selectCalled = true;
		var newItems = {};
		var haveItems = false;
		for(var i in items) {
			if(items[i] && typeof(items[i]) == "object" && items[i].title !== undefined) {
				newItems[i] = items[i].title;
			} else {
				newItems[i] = items[i];
			}
			haveItems = true;
			
			// only save one item if "items":"multiple" (as opposed to an array of items)
			if(test.items === "multiple") break;
		}
		
		if(!haveItems) {
			testDoneCallback(me, test, "failed", "No items defined");
			callback({});
		}
		
		callback(newItems);
	});
	translate.capitalizeTitles = false;
	
	// internal hack to call detect on this translator
	translate._potentialTranslators = [this.translator];
	translate._foundTranslators = [];
	translate._currentState = "detect";
	translate._detect();
}

/**
 * Runs translation for a translator, given a document to test against
 */
Zotero_TranslatorTester.prototype._runTestTranslate = function(translate, translators, test, testDoneCallback) {
	if(!translators.length) {
		testDoneCallback(this, test, "failed", "Detection failed");
		return;
	} else if(this.type === "web" && translators[0].itemType !== Zotero.Translator.RUN_MODE_ZOTERO_SERVER
			&& (translators[0].itemType !== "multiple" && test.items.length > 1 ||
			test.items.length === 1 && translators[0].itemType !== test.items[0].itemType)) {
				// this handles "items":"multiple" too, since the string has length 8
		testDoneCallback(this, test, "failed", "Detection returned wrong item type");
		return;
	}
	
	translate.setTranslator(this.translator);
	translate.translate({
		libraryID: false
	});
};

/**
 * Checks whether the results of translation match what is expected by the test
 * @param {Object} test Test that was executed
 * @param {Zotero.Translate} translate The Zotero.Translate instance
 * @param {Boolean} returnValue Whether translation completed successfully
 * @param {Error} error Error code, if one was specified
 * @param {Function} testDoneCallback A callback to be executed when test is complete
 */
Zotero_TranslatorTester.prototype._checkResult = function(test, translate, returnValue, error, testDoneCallback) {
	if(error) {
		var errorString = "Translation failed: "+error.toString();
		if(typeof error === "object") {
			for(var i in error) {
				if(typeof(error[i]) != "object") {
					errorString += "\n"+i+' => '+error[i];
				}
			}
		}
		testDoneCallback(this, test, "failed", errorString);
		return;
	}
	
	if(!returnValue) {
		testDoneCallback(this, test, "failed", "Translation failed; examine debug output for errors");
		return;
	}
	
	if(!translate.newItems.length) {
		testDoneCallback(this, test, "failed", "Translation failed: no items returned");
		return;
	}
	
	if(test.items !== "multiple") {
		if(translate.newItems.length !== test.items.length) {
			testDoneCallback(this, test, "unknown", "Expected "+test.items.length+" items; got "+translate.newItems.length);
			return;
		}
		
		for(var i=0, n=test.items.length; i<n; i++) {
			var testItem = Zotero_TranslatorTester._sanitizeItem(test.items[i], true);
			var translatedItem = Zotero_TranslatorTester._sanitizeItem(translate.newItems[i]);
			
			if(!Zotero_TranslatorTester._compare(testItem, translatedItem)) {
				// Show diff
				this._debug(this, "TranslatorTester: Data mismatch detected:");
				this._debug(this, Zotero_TranslatorTester._generateDiff(testItem, translatedItem));
				
				// Save items. This makes it easier to correct tests automatically.
				var m = translate.newItems.length;
				test.itemsReturned = new Array(m);
				for(var j=0; j<m; j++) {
					test.itemsReturned[j] = Zotero_TranslatorTester._sanitizeItem(translate.newItems[i]);
				}
				
				testDoneCallback(this, test, "unknown", "Item "+i+" does not match");
				return;
			}
		}
	}
	
	testDoneCallback(this, test, "succeeded", "Test succeeded");
};

/**
 * Creates a new test for a document
 * @param {Document} doc DOM document to test against
 * @param {Function} testReadyCallback A callback to be passed test (as object) when complete
 */
Zotero_TranslatorTester.prototype.newTest = function(doc, testReadyCallback) {
	// keeps track of whether select was called
	var multipleMode = false;
	
	var me = this;
	var translate = Zotero.Translate.newInstance(this.type);
	if (this.translatorProvider) {
		translate.setTranslatorProvider(this.translatorProvider);
	}
	translate.setDocument(doc);
	translate.setTranslator(this.translator);
	translate.setHandler("debug", this._debug);
	translate.setHandler("select", function(obj, items, callback) {
		multipleMode = true;
		
		var newItems = {};
		for(var i in items) {
			if(items[i] && typeof(items[i]) == "object" && items[i].title !== undefined) {
				newItems[i] = items[i].title;
			} else {
				newItems[i] = items[i];
			}
			break;
		}
		
		callback(newItems);
	});
	translate.setHandler("done", function(obj, returnValue) { me._createTest(obj, multipleMode, returnValue, testReadyCallback) });
	translate.capitalizeTitles = false;
	translate.translate({
		libraryID: false
	});
};

/**
 * Creates a new test for a document
 * @param {Zotero.Translate} translate The Zotero.Translate instance
 * @param {Function} testDoneCallback A callback to be passed test (as object) when complete
 */
Zotero_TranslatorTester.prototype._createTest = function(translate, multipleMode, returnValue, testReadyCallback) {
	if(!returnValue) {
		testReadyCallback(returnValue);
		return;
	}
	
	if(!translate.newItems.length) {
		testReadyCallback(false);
		return;
	}
	
	if(multipleMode) {
		var items = "multiple";
	} else {
		for(var i=0, n=translate.newItems.length; i<n; i++) {
			Zotero_TranslatorTester._sanitizeItem(translate.newItems[i]);
		}
		var items = translate.newItems;
	}
	
	testReadyCallback(this, {"type":this.type, "url":translate.document.location.href,
		"items":items});
};


/**
 * Compare items or sets thereof
 */
Zotero_TranslatorTester._compare = function(a, b) {
	// If a is false, comparisons always succeed. This allows us to explicitly set that
	// certain properties are allowed.
	if(a === false) return true;
	
	if(((typeof a === "object" && a !== null) || typeof a === "function")
			&& ((typeof a === "object" && b !== null) || typeof b === "function")) {
		if((Object.prototype.toString.apply(a) === "[object Array]")
				!== (Object.prototype.toString.apply(b) === "[object Array]")) {
			return false;
		}
		for(var key in a) {
			if(!a.hasOwnProperty(key)) continue;
			if(a[key] !== false && !b.hasOwnProperty(key)) return false;
			if(!Zotero_TranslatorTester._compare(a[key], b[key])) return false;
		}
		for(var key in b) {
			if(!b.hasOwnProperty(key)) continue;
			if(!a.hasOwnProperty(key)) return false;
		}
		return true;
	} else if(typeof a === "string" && typeof b === "string") {
		// Ignore whitespace mismatches on strings
		return a === b || Zotero.Utilities.trimInternal(a) === Zotero.Utilities.trimInternal(b);
	}
	return a === b;
};

/**
 * Generate a diff of items
 */
Zotero_TranslatorTester._generateDiff = new function() {
	function show(a, action, prefix, indent) {
		if((typeof a === "object" && a !== null) || typeof a === "function") {
			var isArray = Object.prototype.toString.apply(a) === "[object Array]",
				startBrace = (isArray ? "[" : "{"),
				endBrace = (isArray ? "]" : "}"),
				changes = "",
				haveKeys = false;
			
			for(var key in a) {
				if(!a.hasOwnProperty(key)) continue;
				
				haveKeys = true;
				changes += show(a[key], action,
					isArray ? "" : JSON.stringify(key)+": ", indent+"  ");
			}
			
			if(haveKeys) {
				return action+" "+indent+prefix+startBrace+"\n"+
					changes+action+" "+indent+endBrace+"\n";
			}
			return action+" "+indent+prefix+startBrace+endBrace+"\n";
		}
		
		return action+" "+indent+prefix+JSON.stringify(a)+"\n";
	}
	
	function compare(a, b, prefix, indent) {
		if(!prefix) prefix = "";
		if(!indent) indent = "";
		
		if(((typeof a === "object" && a !== null) || typeof a === "function")
				&& ((typeof b === "object" && b !== null) || typeof b === "function")) {
			var aIsArray = Object.prototype.toString.apply(a) === "[object Array]",
				bIsArray = Object.prototype.toString.apply(b) === "[object Array]";
			if(aIsArray === bIsArray) {
				var startBrace = (aIsArray ? "[" : "{"),
					endBrace = (aIsArray ? "]" : "}"),
					changes = "",
					haveKeys = false;
				
				for(var key in a) {
					if(!a.hasOwnProperty(key)) continue;
					
					haveKeys = true;
					var keyPrefix = aIsArray ? "" : JSON.stringify(key)+": ";
					if(b.hasOwnProperty(key)) {
						changes += compare(a[key], b[key], keyPrefix, indent+"  ");
					} else {
						changes += show(a[key], "-", keyPrefix, indent+"  ");
					}
				}
				for(var key in b) {
					if(!b.hasOwnProperty(key)) continue;
					
					haveKeys = true;
					if(!a.hasOwnProperty(key)) {
						var keyPrefix = aIsArray ? "" : JSON.stringify(key)+": ";
						changes += show(b[key], "+", keyPrefix, indent+"  ");
					}
				}
				
				if(haveKeys) {
					return "  "+indent+prefix+startBrace+"\n"+
						changes+"  "+indent+(aIsArray ? "]" : "}")+"\n";
				}
				return "  "+indent+prefix+startBrace+endBrace+"\n";
			}
		}
		
		if(a === b) {
			return show(a, " ", prefix, indent);
		}
		return show(a, "-", prefix, indent)+show(b, "+", prefix, indent);
	}
	
	return function(a, b) {
		// Remove last newline
		var txt = compare(a, b);
		return txt.substr(0, txt.length-1);
	};
};

if (typeof process === 'object' && process + '' === '[object process]'){
	module.exports = {
		Tester: Zotero_TranslatorTesters, 
		TranslatorTester: Zotero_TranslatorTester
	};
}
