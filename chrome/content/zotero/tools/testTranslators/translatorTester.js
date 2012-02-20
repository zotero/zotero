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
const TEST_RUN_TIMEOUT = 600000;

var Zotero_TranslatorTester_IGNORE_FIELDS = ["complete", "accessDate", "checkFields"];

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
 * @param {Function} [debug] A function to call to write debug output. If not present, Zotero.debug
 *                           will be used.
 */
Zotero_TranslatorTester = function(translator, type, debug) {
	this.type = type;
	this.translator = translator;
	this._debug = debug ? debug : function(obj, a, b) { Zotero.debug(a, b) };
	
	this.tests = [];
	this.pending = [];
	this.succeeded = [];
	this.failed = [];
	this.unknown = [];
	
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

/**
 * Removes document objects, which contain cyclic references, and other fields to be ignored from items
 * @param {Object} Item, in the format returned by Zotero.Item.serialize()
 */
Zotero_TranslatorTester._sanitizeItem = function(item, forSave) {
	// remove cyclic references 
	if(item.attachments && item.attachments.length) {
		// don't actually test URI equality
		for (var i=0; i<item.attachments.length; i++) {
			if(item.attachments[i].document) {
				item.attachments[i].document = false;
			} else if(item.attachments[i].url) {
				item.attachments[i].url = false;
			}
		}
	}
	
	// remove fields to be ignored
	for(var j=0, n=Zotero_TranslatorTester_IGNORE_FIELDS.length; j<n; j++) {
		if(forSave) {
			delete item[Zotero_TranslatorTester_IGNORE_FIELDS[j]]
		} else {
			item[Zotero_TranslatorTester_IGNORE_FIELDS[j]] = false;
		}
	}
	
	return item;
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
	
	this._debug(this, "\nTranslatorTester: Running "+this.translator.label+" Test "+testNumber);
	
	var executedCallback = false;
	var callback = function(obj, test, status, message) {
		if(executedCallback) return;
		executedCallback = true;
		
		me._debug(this, "TranslatorTester: "+me.translator.label+" Test "+testNumber+": "+status+" ("+message+")");
		me[status].push(test);
		if(testDoneCallback) testDoneCallback(me, test, status, message);
		me.runTests(testDoneCallback, true);
	};
	
	if(this.type === "web") {
		this.fetchPageAndRunTest(test, callback);
	} else {
		this.runTest(test, null, callback);
	}
	
	(Zotero.setTimeout ? Zotero : window).setTimeout(function() {
		callback(me, test, "failed", "Test timed out after "+TEST_RUN_TIMEOUT+" seconds");
	}, TEST_RUN_TIMEOUT);
};

/**
 * Fetches the page for a given test and runs it
 * This function is only applicable in Firefox; it is overridden in translator_global.js in Chrome
 * and Safari
 * @param {Object} test Test to execute
 * @param {Document} doc DOM document to test against
 * @param {Function} testDoneCallback A callback to be executed when test is complete
 */
Zotero_TranslatorTester.prototype.fetchPageAndRunTest = function(test, testDoneCallback) {
	var me = this;
	var hiddenBrowser = Zotero.HTTP.processDocuments(test.url,
		function(doc) {
			me.runTest(test, doc, function(obj, test, status, message) {
				if(hiddenBrowser) Zotero.Browser.deleteHiddenBrowser(hiddenBrowser);
				testDoneCallback(obj, test, status, message);
			});
		},
		null,
		function(e) {
			testDoneCallback(this, test, "failed", "Translation failed to initialize: "+e);
		},
		true
	);
};

/**
 * Executes a test for a translator, given the document to test upon
 * @param {Object} test Test to execute
 * @param {Document} data DOM document to test against
 * @param {Function} testDoneCallback A callback to be executed when test is complete
 */
Zotero_TranslatorTester.prototype.runTest = function(test, doc, testDoneCallback) {
	this._debug(this, "TranslatorTester: Translating "+test.url);
	
	var me = this;
	var translate = Zotero.Translate.newInstance(this.type);
	
	if(this.type === "web") {
		translate.setDocument(doc);
	} else if(this.type === "import") {
		translate.setString(test.input);
	} else if(this.type === "search") {
		translate.setSearch(test.input);
	}
	
	translate.setHandler("translators", function(obj, translators) {
		me._runTestTranslate(translate, translators, test, testDoneCallback);
	});
	translate.setHandler("debug", this._debug);
	translate.setHandler("done", function(obj, returnValue) {
		me._checkResult(test, obj, returnValue, testDoneCallback);
	});
	translate.setHandler("select", function(obj, items, callback) {
		if(test.items !== "multiple" && test.items.length <= 1) {
			testDoneCallback(me, test, "failed", "Zotero.selectItems() called, but only one item defined in test");
			callback({});
		}
		
		var newItems = {};
		var haveItems = false;
		for(var i in items) {
			newItems[i] = items[i];
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
	} else if(this.type === "web" && (translators[0].itemType !== "multiple" && test.items.length > 1 ||
			test.items.length === 1 && translators[0].itemType !== test.items[0].itemType)) {
				// this handles "items":"multiple" too, since the string has length 8
		testDoneCallback(this, test, "failed", "Detection returned wrong item type");
		return;
	}
	
	translate.setTranslator(this.translator);
	translate.translate(false);
};

/**
 * Checks whether the results of translation match what is expected by the test
 * @param {Object} test Test that was executed
 * @param {Zotero.Translate} translate The Zotero.Translate instance
 * @param {Boolean} returnValue Whether translation completed successfully
 * @param {Function} testDoneCallback A callback to be executed when test is complete
 */
Zotero_TranslatorTester.prototype._checkResult = function(test, translate, returnValue, testDoneCallback) {
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
			var testItem = Zotero_TranslatorTester._sanitizeItem(test.items[i]);
			var translatedItem = Zotero_TranslatorTester._sanitizeItem(translate.newItems[i]);
			
			if(!this._compare(testItem, translatedItem)) {
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
	translate.setDocument(doc);
	translate.setTranslator(this.translator);
	translate.setHandler("debug", this._debug);
	translate.setHandler("select", function(obj, items, callback) {
		multipleMode = true;
		
		var newItems = {};
		for(var i in items) {
			newItems[i] = items[i];
			break;
		}
		
		callback(newItems);
	});
	translate.setHandler("done", function(obj, returnValue) { me._createTest(obj, multipleMode, returnValue, testReadyCallback) });
	translate.capitalizeTitles = false;
	translate.translate(false);
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
		for(var i=0, n=translate.newItems; i<n; i++) {
			Zotero_TranslatorTester._sanitizeItem(translate.newItems[i], true);
		}
		var items = translate.newItems;
	}
	
	testReadyCallback(this, {"type":this.type, "url":translate.document.location.href,
		"items":items});
};


/**
 * Compare items or sets thereof
 */
Zotero_TranslatorTester.prototype._compare = function(i, j) {
	var match = false;
	if (Object.prototype.toString.apply(i) === '[object Array]') {
		if (Object.prototype.toString.apply(j) === '[object Array]') {
			do {
				match = this._compare(i.pop(), j.pop());
			} while (match && i.length && j.length);
			if (match)
				return true;
			else
				return false;
		} else {
			this._debug(this, "TranslatorTester: i is array, j is not");
			return false;
		}
	} else if (Object.prototype.toString.apply(j) === '[object Array]') {
		this._debug(this, "TranslatorTester: j is array, i is not");
		return false;
	}

	// Neither is an array
	if(this._objectCompare(i, j)) {
		return true;
	} else {
		this._debug(this, JSON.stringify({i:i, j:j}));
		this._debug(this, "TranslatorTester: Items don't match");
		return false;
	}
};

Zotero_TranslatorTester.prototype._objectCompare = function(x, y) {
	// Special handlers
	var _debug = this._debug;
	
	var returner = function(param) {
			if (special[param]) return special[param](x[param], y[param]);
			else return false;
	}

	if ((y === undefined && x !== undefined)
		|| (x === undefined && y !== undefined)) {
		return false;
	}

	for(p in y) {
		if(y[p] || y[p] === 0) {
			switch(typeof(y[p])) {
				case 'object':
					if (!this._objectCompare(y[p],x[p])) { 
						return false;
					};
					break;
				case 'function':
					if (typeof(x[p])=='undefined' 
						|| (y[p].toString() != x[p].toString())) {
						this._debug(this, "TranslatorTester: Function "+p+" defined in y, not in x, or definitions differ");
						return false;
					}
					break;
				default:
					if (y[p] != x[p] && x[p] !== false) {	// special exemption: x (test item)
															// can have a property set to false
															// and we will ignore it here
						this._debug(this, "TranslatorTester: Param "+p+" differs: " + JSON.stringify({x:x[p], y:y[p]}));
						return false;
					}
			}
		} else if(x[p] || x[p] === 0) { 
			this._debug(this, "TranslatorTester: Param "+p+" true in x, not in y");
			return false;
		}
	}

	for(p in x) {
		if((x[p] || x[p] === 0) && typeof(y[p])=='undefined') {
			this._debug(this, "TranslatorTester: Param "+p+" in x not defined in y");
			return false;
		}
	}
	return true;
};
