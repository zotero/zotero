/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
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

const TRANSLATOR_TYPES = ["Web", "Import", "Export", "Search"];
const TABLE_COLUMNS = ["Translator", "Supported", "Status", "Pending", "Succeeded", "Failed", "Unknown"];
var translatorTables = {};
var translatorTestViewsToRun = {};

/**
 * Encapsulates a set of tests for a specific translator and type
 * @constructor
 */
var TranslatorTestView = function(translator, type) {
	this._translator = translator;
	this._type = type;
	
	var row = document.createElement("tr");
	
	// Translator
	this._label = document.createElement("td");
	this._label.appendChild(document.createTextNode(translator.label));
	row.appendChild(this._label);
	
	// Supported
	this._supported = document.createElement("td");
	var isSupported = translator.runMode === Zotero.Translator.RUN_MODE_IN_BROWSER;
	this._supported.appendChild(document.createTextNode(isSupported ? "Yes" : "No"));
	this._supported.className = isSupported ? "supported-yes" : "supported-no";
	row.appendChild(this._supported);
	
	// Status
	this._status = document.createElement("td");
	row.appendChild(this._status);
	
	// Unknown
	this._pending = document.createElement("td");
	row.appendChild(this._pending);
	
	// Succeeded
	this._succeeded = document.createElement("td");
	row.appendChild(this._succeeded);
	
	// Failed
	this._failed = document.createElement("td");
	row.appendChild(this._failed);
	
	// Unknown
	this._unknown = document.createElement("td");
	row.appendChild(this._unknown);
	
	// append to table
	translatorTables[type].appendChild(row);
	
	// create translator tester and update status based on what it knows
	this._translatorTester = new Zotero.TranslatorTester(translator, type);
	this.updateStatus(this._translatorTester);
	this.hasTests = !!this._translatorTester.tests.length;
}

/**
 * Changes the displayed status of a translator
 */
TranslatorTestView.prototype.updateStatus = function(obj) {
	if(obj.tests.length) {
		if(obj.pending.length) {
			this._status.className = "status-pending";
			this._status.textContent = "Pending";
		} else if(obj.failed.length) {
			this._status.className = "status-failed";
			this._status.textContent = "Failed";
		} else if(obj.unknown.length) {
			this._status.className = "status-unknown";
			this._status.textContent = "Unknown";
		} else {
			this._status.className = "status-succeeded";
			this._status.textContent = "Succeeded";
		}
	} else {
		this._status.className = "status-untested";
		this._status.textContent = "Untested";
	}
	
	this._pending.textContent = obj.pending.length;
	this._succeeded.textContent = obj.succeeded.length;
	this._failed.textContent = obj.failed.length;
	this._unknown.textContent = obj.unknown.length;
}

/**
 * Runs test for this translator
 */
TranslatorTestView.prototype.runTests = function(doneCallback) {
	var me = this;
	var newCallback = function(obj, status, message) {
		me.updateStatus(obj);
		if(obj.pending.length === 0) {
			doneCallback();
		}
	};
	
	if(Zotero.isFx) {
		this._translatorTester.runTests(newCallback);
	} else {
		Zotero.TranslatorTester.runTests(this._translator, this._type, newCallback);
	}
}

/**
 * Called when loaded
 */
function load(event) {	
	if(window.chrome || window.safari) {
		// initialize
		Zotero.initInject();
	}

	for(var i in TRANSLATOR_TYPES) {
		var displayType = TRANSLATOR_TYPES[i];
		var translatorType = displayType.toLowerCase();
		
		// create header
		var h1 = document.createElement("h1");
		h1.appendChild(document.createTextNode(displayType+" Translators"));
		document.body.appendChild(h1);
		
		// create table
		var translatorTable = document.createElement("table");
		translatorTables[translatorType] = translatorTable;
		
		// add headings to table
		var headings = document.createElement("tr");
		for(var j in TABLE_COLUMNS) {
			var th = document.createElement("th");
			th.className = "th-"+TABLE_COLUMNS[j].toLowerCase();
			th.appendChild(document.createTextNode(TABLE_COLUMNS[j]));
			headings.appendChild(th);
		}
		
		// append to document
		translatorTable.appendChild(headings);
		document.body.appendChild(translatorTable);
		
		// get translators, with code for unsupported translators
		Zotero.Translators.getAllForType(translatorType, new function() {
			var type = translatorType;
			return function(translators) {
				haveTranslators(translators, type);
			}
		}, true);
	}
}

/**
 * Called after translators are returned from main script
 */
function haveTranslators(translators, type) {
	translatorTestViewsToRun[type] = [];
	
	for(var i in translators) {
		var translatorTestView = new TranslatorTestView(translators[i], type);
		if(translatorTestView.hasTests) {
			translatorTestViewsToRun[type].push(translatorTestView);
		}
	}
	
	runTranslatorTests(type);
}

/**
 * Runs translator tests recursively, after translatorTestViews has been populated
 */
function runTranslatorTests(type) {
	if(translatorTestViewsToRun[type].length) {
		var translatorTestView = translatorTestViewsToRun[type].shift();
		translatorTestView.runTests(function() { runTranslatorTests(type) });
	}
}

window.addEventListener("load", load, false);