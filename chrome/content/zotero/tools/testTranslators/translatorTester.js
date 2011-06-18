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
	this._debug = (debug ? debug : function(a, b) { Zotero.debug(a, b) });
	
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
}

/**
 * Executes tests for this translator
 * @param {Function} testDoneCallback A callback to be executed each time a test is complete
 */
Zotero_TranslatorTester.prototype.runTests = function(testDoneCallback, recursiveRun) {
	if(!recursiveRun) {
		this._debug("TranslatorTester: Running "+this.pending.length+" tests for "+this._translator.label);
	}
	if(!this.pending.length) {
		// always call testDoneCallback once if there are no tests
		if(!recursiveRun) testDoneCallback(this, "unknown", "No tests present");
		return;
	}
	
	var test = this.pending.shift();
	var testNumber = this.tests.length-this.pending.length;
	var me = this;
	
	var callback = function(obj, status, message) {
		me._debug("TranslatorTester: "+me._translator.label+" Test "+testNumber+": "+status+" ("+message+")");
		me[status].push(test);
		if(testDoneCallback) testDoneCallback(me, status, message);
		me.runTests(testDoneCallback, true);
	};
	
	this.fetchPageAndRunTest(test, callback);
}

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
			testDoneCallback(this, "failed", "Translation failed to initialize: "+e);
		}
	);
}

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
	translate.setTranslator(this._translator);
	translate.setHandler("done", function(obj, returnValue) { me._checkResult(test, obj, returnValue, testDoneCallback) });
	translate.translate(false);
}

/**
 * Checks whether the results of translation match what is expected by the test
 * @param {Object} test Test that was executed
 * @param {Zotero.Translate} translate The Zotero.Translate instance
 * @param {Boolean} returnValue Whether translation completed successfully
 * @param {Function} testDoneCallback A callback to be executed when test is complete
 */
Zotero_TranslatorTester.prototype._checkResult = function(test, translate, returnValue, testDoneCallback) {
	if(!returnValue) {
		testDoneCallback(this, "failed", "Translation failed; examine debug output for errors");
		return;
	}
	
	if(!translate.newItems.length) {
		testDoneCallback(this, "failed", "Translation failed; no items returned");
		return;
	}
	
	if(translate.newItems.length !== test.items.length) {
		testDoneCallback(this, "unknown", "Expected "+test.items.length+" items; got "+translate.newItems.length);
		return;
	}
	
	for(var i in test.items) {
		var testItem = test.items[i];
		var translatedItem = translate.newItems[i];
		
		// Clear attachment document objects
		if (translatedItem && translatedItem.attachments && translatedItem.attachments.length) {
			for (var i=0; i<translatedItem.attachments.length; i++) {
				if (translatedItem.attachments[i].document)
					translatedItem.attachments[i].document = "[object]";
			}
		}
		
		for(var j in Zotero_TranslatorTester_IGNORE_FIELDS) {
			delete testItem[Zotero_TranslatorTester_IGNORE_FIELDS[j]];
			delete translatedItem[Zotero_TranslatorTester_IGNORE_FIELDS[j]];
		}
		
		var testItemJSON = JSON.stringify(testItem);
		var translatedItemJSON = JSON.stringify(translatedItem);
		if(testItemJSON != translatedItemJSON) {
			testDoneCallback(this, "unknown", "Item "+i+" does not match");
			this._debug("TranslatorTester: Mismatch between "+testItemJSON+" and "+translatedItemJSON);
			return;
		}
	}
	
	testDoneCallback(this, "succeeded", "Test succeeded");
}