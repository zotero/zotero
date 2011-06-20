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

const Zotero_TranslatorTester_IGNORE_FIELDS = ["complete", "accessDate", "checkFields"];

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
	this._type = type;
	this._translator = translator;
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
		var test = code.substring(testStart + 24, testEnd);
		test = test.replace(/var testCases = /,'');
		// The JSON parser doesn't like final semicolons
		if (test.lastIndexOf(';') == (test.length-1)) {
			test = test.slice(0,-1);
		}
		try {
			var testObject = JSON.parse(test);
		} catch (e) {
			Zotero.logError(e);
		}
		
		for(var i in testObject) {
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
Zotero_TranslatorTester._sanitizeItem = function(item) {
	// remove cyclic references
	if(item.attachments && item.attachments.length) {
		for (var i=0; i<item.attachments.length; i++) {
			if(item.attachments[i].document) {
				item.attachments[i].document = {};
			}
		}
	}
	
	// remove fields to be ignored
	for(var j in Zotero_TranslatorTester_IGNORE_FIELDS) {
		delete item[Zotero_TranslatorTester_IGNORE_FIELDS[j]];
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
		this._debug(this, "TranslatorTester: Running "+this.pending.length+" tests for "+this._translator.label);
	}
	if(!this.pending.length) {
		// always call testDoneCallback once if there are no tests
		if(!recursiveRun) testDoneCallback(this, null, "unknown", "No tests present");
		return;
	}
	
	var test = this.pending.shift();
	var testNumber = this.tests.length-this.pending.length;
	var me = this;
	
	var callback = function(obj, test, status, message) {
		me._debug(this, "TranslatorTester: "+me._translator.label+" Test "+testNumber+": "+status+" ("+message+")");
		me[status].push(test);
		if(testDoneCallback) testDoneCallback(me, test, status, message);
		me.runTests(testDoneCallback, true);
	};
	
	this.fetchPageAndRunTest(test, callback);
};

/**
 * Fetches the page for a given test and runs it
 * @param {Object} test Test to execute
 * @param {Document} doc DOM document to test against
 * @param {Function} testDoneCallback A callback to be executed when test is complete
 */
Zotero_TranslatorTester.prototype.fetchPageAndRunTest = function(test, testDoneCallback) {
	var me = this;
	Zotero.HTTP.processDocuments(test.url,
		function(doc) {
			me.runTest(test, doc, testDoneCallback);
		},
		null,
		function(e) {
			testDoneCallback(this, test, "failed", "Translation failed to initialize: "+e);
		}
	);
};

/**
 * Executes a test for a translator, given the document to test upon
 * @param {Object} test Test to execute
 * @param {Document} doc DOM document to test against
 * @param {Function} testDoneCallback A callback to be executed when test is complete
 */
Zotero_TranslatorTester.prototype.runTest = function(test, doc, testDoneCallback) {
	var me = this;
	var translate = Zotero.Translate.newInstance(this._type);
	translate.setDocument(doc);
	
	translate.setHandler("translators", function(obj, translators) {
		me._runTestTranslate(translate, translators, test, testDoneCallback);
	});
	translate.setHandler("debug", this._debug);
	translate.setHandler("done", function(obj, returnValue) {
		me._checkResult(test, obj, returnValue, testDoneCallback);
	});
	
	// internal hack to call detect on this translator
	translate._potentialTranslators = [this._translator];
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
	} else if(translators[0].itemType !== "multiple" && test.items.length > 1 ||
			test.items.length === 1 && translators[0].itemType !== test.items[0].itemType) {
		testDoneCallback(this, test, "failed", "Detection returned wrong item type");
		return;
	}
	
	translate.setTranslator(this._translator);
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
	
	if(translate.newItems.length !== test.items.length) {
		testDoneCallback(this, test, "unknown", "Expected "+test.items.length+" items; got "+translate.newItems.length);
		return;
	}
	
	for(var i in test.items) {
		var testItem = Zotero_TranslatorTester._sanitizeItem(test.items[i]);
		var translatedItem = Zotero_TranslatorTester._sanitizeItem(translate.newItems[i]);
		
		var testItemJSON = JSON.stringify(testItem);
		var translatedItemJSON = JSON.stringify(translatedItem);
		if(testItemJSON != translatedItemJSON) {
			testDoneCallback(this, test, "unknown", "Item "+i+" does not match");
			this._debug(this, "TranslatorTester: Mismatch between "+testItemJSON+" and "+translatedItemJSON);
			return;
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
	var me = this;
	var translate = Zotero.Translate.newInstance(this._type);
	translate.setDocument(doc);
	translate.setTranslator(this._translator);
	translate.setHandler("debug", this._debug);
	translate.setHandler("done", function(obj, returnValue) { me._createTest(obj, returnValue, testReadyCallback) });
	translate.translate(false);
};

/**
 * Creates a new test for a document
 * @param {Zotero.Translate} translate The Zotero.Translate instance
 * @param {Function} testDoneCallback A callback to be passed test (as object) when complete
 */
Zotero_TranslatorTester.prototype._createTest = function(translate, returnValue, testReadyCallback) {
	if(!returnValue) {
		testReadyCallback(returnValue);
		return;
	}
	
	for(var i in translate.newItems) Zotero_TranslatorTester._sanitizeItem(translate.newItems[i]);
	testReadyCallback(this, {"type":this._type,
		"url":translate.document.location.href,
		"items":translate.newItems});
};