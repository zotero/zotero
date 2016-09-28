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

const NUM_CONCURRENT_TESTS = 6;
const TABLE_COLUMNS = ["Translator", "Supported", "Status", "Pending", "Succeeded", "Failed", "Mismatch", "Issues"];
// Not using const to prevent const collisions in connectors
var TRANSLATOR_TYPES = ["Web", "Import", "Export", "Search"];
var translatorTables = {},
	translatorTestViews = {},
	translatorTestViewsToRun = {},
	translatorTestStats = {},
	translatorBox,
	outputBox,
	allOutputView,
	currentOutputView,
	viewerMode = true;

/**
 * Fetches issue information from GitHub
 */
var Issues = new function() {
	var _executeWhenRetrieved = [];
	var githubInfo;
	
	/**
	 * Gets issues for a specific translator
	 * @param {String} translatorLabel Gets issues starting with translatorLabel
	 * @param {Function} callback Function to call when issue information is available
	 */
	this.getFor = function(translatorLabel, callback) {
		translatorLabel = translatorLabel.toLowerCase();
		
		var whenRetrieved = function() {
			var issues = [];
			for(var i=0; i<githubInfo.length; i++) {
				var issue = githubInfo[i];
				if(issue.title.substr(0, translatorLabel.length).toLowerCase() === translatorLabel) {
					issues.push(issue);
				}
			}
			callback(issues);
		};
		
		if(githubInfo) {
			whenRetrieved();
		} else {
			_executeWhenRetrieved.push(whenRetrieved);
		}
	};
	
	var req = new XMLHttpRequest();
	req.open("GET", "https://api.github.com/repos/zotero/translators/issues?per_page=100", true);
	req.onreadystatechange = function(e) {
		if(req.readyState != 4) return;
		
		githubInfo = JSON.parse(req.responseText);
		for(var i=0; i<_executeWhenRetrieved.length; i++) {
			_executeWhenRetrieved[i]();
		}
		_executeWhenRetrieved = [];
	};
	req.send();
}

/**
 * Handles adding debug output to the output box
 * @param {HTMLElement} el An element to add class="selected" to when this outputView is displayed
 */
var OutputView = function(el) {
	this._output = [];
	this._el = el;
}

/**
 * Sets whether this output is currently displayed in the output box
 * @param {Boolean} isDisplayed
 */
OutputView.prototype.setDisplayed = function(isDisplayed) {
	this.isDisplayed = isDisplayed;
	if(this.isDisplayed) outputBox.textContent = this._output.join("\n");
	if(this._el) this._el.className = (isDisplayed ? "output-displayed" : "output-hidden");
	currentOutputView = this;
}

/**
 * Adds output to the output view
 */
OutputView.prototype.addOutput = function(msg, level) {
	this._output.push(msg);
	if(this.isDisplayed) outputBox.textContent = this._output.join("\n");
}

/**
 * Gets output to the output view
 */
OutputView.prototype.getOutput = function() {
	return this._output.join("\n");
}

/**
 * Encapsulates a set of tests for a specific translator and type
 * @constructor
 */
var TranslatorTestView = function(translator, type) {
	var row = this._row = document.createElement("tr");
	
	// Translator
	this._label = document.createElement("td");
	row.appendChild(this._label);
	
	// Supported
	this._supported = document.createElement("td");
	row.appendChild(this._supported);
	
	// Status
	this._status = document.createElement("td");
	row.appendChild(this._status);
	
	// Pending
	this._pending = document.createElement("td");
	row.appendChild(this._pending);
	
	// Succeeded
	this._succeeded = document.createElement("td");
	row.appendChild(this._succeeded);
	
	// Failed
	this._failed = document.createElement("td");
	row.appendChild(this._failed);
	
	// Mismatch
	this._unknown = document.createElement("td");
	row.appendChild(this._unknown);
	
	// Issues
	this._issues = document.createElement("td");
	row.appendChild(this._issues);
	
	// create output view and debug function
	var outputView = this._outputView = new OutputView(row);
	this._debug = function(obj, msg, level) {
		outputView.addOutput(msg, level);
		allOutputView.addOutput(msg, level);
	}
	
	// put click handler on row to allow display of debug output
	row.addEventListener("click", function(e) {
		// don't run deselect click event handler
		e.stopPropagation();
		
		currentOutputView.setDisplayed(false);
		outputView.setDisplayed(true);
	}, false);
	
	// create translator tester and update status based on what it knows
	this.isRunning = false;
}

/**
 * Sets the label and retrieves corresponding GitHub issues
 */
TranslatorTestView.prototype.setLabel = function(label) {
	this._label.appendChild(document.createTextNode(label));
	var issuesNode = this._issues;
	Issues.getFor(label, function(issues) {
		for(var i=0; i<issues.length; i++) {
			var issue = issues[i];
			var div = document.createElement("div"),
				a = document.createElement("a");
			
			var date = issue.updated_at;
			date = new Date(Date.UTC(date.substr(0, 4), date.substr(5, 2)-1, date.substr(8, 2),
				date.substr(11, 2), date.substr(14, 2), date.substr(17, 2)));
			if("toLocaleFormat" in date) {
				date = date.toLocaleFormat("%x");
			} else {
				date = date.getFullYear()+"-"+date.getMonth()+"-"+date.getDate();
			}
			
			a.textContent = issue.title+" (#"+issue.number+"; "+date+")";
			a.setAttribute("href", issue.html_url);
			a.setAttribute("target", "_blank");
			div.appendChild(a);
			issuesNode.appendChild(div);
		}
	});
}

/**
 * Initializes TranslatorTestView given a translator and its type
 */
TranslatorTestView.prototype.initWithTranslatorAndType = function(translator, type) {
	this.setLabel(translator.label);
	
	this._translatorTester = new Zotero_TranslatorTester(translator, type, this._debug);
	this.canRun = !!this._translatorTester.tests.length;
	this.updateStatus(this._translatorTester);
	
	this._type = type;
	translatorTestViews[type].push(this);
	translatorTables[this._type].appendChild(this._row);
}

/**
 * Initializes TranslatorTestView given a JSON-ified translatorTester
 */
TranslatorTestView.prototype.unserialize = function(serializedData) {
	this._outputView.addOutput(serializedData.output);
	this.setLabel(serializedData.label);
	
	this._type = serializedData.type;
	translatorTestViews[serializedData.type].push(this);
	
	this.canRun = false;
	this.updateStatus(serializedData);
	translatorTables[this._type].appendChild(this._row);
}

/**
 * Initializes TranslatorTestView given a JSON-ified translatorTester
 */
TranslatorTestView.prototype.serialize = function(serializedData) {
	return this._translatorTester.serialize();
}

/**
 * Changes the displayed status of a translator
 */
TranslatorTestView.prototype.updateStatus = function(obj, status) {
	while(this._status.hasChildNodes()) {
		this._status.removeChild(this._status.firstChild);
	}
	
	this._supported.textContent = obj.isSupported ? "Yes" : "No";
	this._supported.className = obj.isSupported ? "supported-yes" : "supported-no";
	
	var pending = typeof obj.pending === "object" ? obj.pending.length : obj.pending;
	var succeeded = typeof obj.succeeded === "object" ? obj.succeeded.length : obj.succeeded;
	var failed = typeof obj.failed === "object" ? obj.failed.length : obj.failed;
	var unknown = typeof obj.unknown === "object" ? obj.unknown.length : obj.unknown;
	
	if(pending || succeeded || failed || unknown) {
		if(pending) {
			if(this.isRunning) {
				this._status.className = "status-running";
				this._status.textContent = "Running";
			} else if(status && status === "pending") {
				this._status.className = "status-pending";
				this._status.textContent = "Pending";
			} else if(this.canRun) {
				// show link to start
				var me = this;
				var a = document.createElement("a");
				a.href = "#";
				a.addEventListener("click", function(e) {
					e.preventDefault();
					me.runTests();
				}, false);
				a.textContent = "Run";
				this._status.appendChild(a);
			} else {
				this._status.textContent = "Not Run";
			}
		} else if((succeeded || unknown) && failed) {
			this._status.className = "status-partial-failure";
			this._status.textContent = "Partial Failure";
		} else if(failed) {
			this._status.className = "status-failed";
			this._status.textContent = "Failure";
		} else if(unknown) {
			this._status.className = "status-mismatch";
			this._status.textContent = "Data Mismatch";
		} else {
			this._status.className = "status-succeeded";
			this._status.textContent = "Success";
		}
	} else {
		this._status.className = "status-untested";
		this._status.textContent = "Untested";
	}
	
	this._pending.textContent = pending;
	this._succeeded.textContent = succeeded;
	this._failed.textContent = failed;
	this._unknown.textContent = unknown;
	
	if(this._type) translatorTestStats[this._type].update();
}

/**
 * Runs test for this translator
 */
TranslatorTestView.prototype.runTests = function(doneCallback) {
	if(this.isRunning) return;
	this.isRunning = true;
	
	// show as running
	this.updateStatus(this._translatorTester);
	
	// set up callback
	var me = this;
	var newCallback = function(obj, test, status, message) {
		me.updateStatus(obj);
		if(obj.pending.length === 0 && doneCallback) {
			doneCallback();
		}
	};
	
	this._translatorTester.runTests(newCallback);
}

/**
 * Gets overall stats for translators
 */
var TranslatorTestStats = function(translatorType) {
	this.translatorType = translatorType
	this.node = document.createElement("p");
};

TranslatorTestStats.prototype.update = function() {
	var types = {
		"Success":0,
		"Data Mismatch":0,
		"Partial Failure":0,
		"Failure":0,
		"Untested":0,
		"Running":0,
		"Pending":0,
		"Not Run":0
	};
	
	var testViews = translatorTestViews[this.translatorType];
	for(var i in testViews) {
		var status = testViews[i]._status ? testViews[i]._status.textContent : "Not Run";
		if(status in types) {
			types[status] += 1;
		}
	}
	
	var typeInfo = [];
	for(var i in types) {
		if(types[i]) {
			typeInfo.push(i+": "+types[i]);
		}
	}
	
	this.node.textContent = typeInfo.join(" | ");
};

/**
 * Called when loaded
 */
function load(event) {
	try {
		viewerMode = !Zotero;
	} catch(e) {};
	
	if(!viewerMode && (window.chrome || window.safari)) {
		// initialize injection
		Zotero.initInject();
		// make sure that connector is online
		Zotero.Connector.checkIsOnline(function(status) {
			if(status) {
				init();
			} else {
				document.body.textContent = "To avoid excessive repo requests, the translator tester may only be used when Zotero Standalone is running.";
			}
		});
	} else {
		init();
	}
}

/**
 * Builds translator display and retrieves translators
 */
function init() {
	// create translator box
	translatorBox = document.createElement("div");
	translatorBox.id = "translator-box";
	document.body.appendChild(translatorBox);
	
	// create output box
	outputBox = document.createElement("div");
	outputBox.id = "output-box";
	document.body.appendChild(outputBox);
	
	// set click handler for translator box to display all output, so that when the user clicks
	// outside of a translator, it will revert to this state
	translatorBox.addEventListener("click", function(e) {
		currentOutputView.setDisplayed(false);
		allOutputView.setDisplayed(true);
	}, false);
	
	// create output view for all output and display
	allOutputView = new OutputView();
	allOutputView.setDisplayed(true);

	for(var i in TRANSLATOR_TYPES) {
		var displayType = TRANSLATOR_TYPES[i];
		var translatorType = displayType.toLowerCase();
		
		translatorTestViews[translatorType] = [];
		
		// create header
		var h1 = document.createElement("h1");
		h1.appendChild(document.createTextNode(displayType+" Translators "));
		
		if(!viewerMode) {
			// create "run all"
			var runAll = document.createElement("a");
			runAll.href = "#";
			runAll.appendChild(document.createTextNode("(Run)"));
			runAll.addEventListener("click", new function() {
				var type = translatorType;
				return function(e) {
					e.preventDefault();
					runTranslatorTests(type);
				}
			}, false);
			h1.appendChild(runAll);
		}
		
		translatorBox.appendChild(h1);
		
		// create table
		var translatorTable = document.createElement("table");
		translatorTables[translatorType] = translatorTable;
		
		translatorTestStats[translatorType] = new TranslatorTestStats(translatorType);
		translatorBox.appendChild(translatorTestStats[translatorType].node);
		
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
		translatorBox.appendChild(translatorTable);
		
		// get translators, with code for unsupported translators
		if(!viewerMode) {
			Zotero.Translators.getAllForType(translatorType, true).
			then(new function() {
				var type = translatorType;
				return function(translators) {
					haveTranslators(translators, type);
				}
			});
		}
	}
	
	if(viewerMode) {
		// if no Zotero object, try to unserialize data
		var req = new XMLHttpRequest();
		var loc = "testResults.json";
		if(window.location.hash) {
			var hashVars = {};
			var hashVarsSplit = window.location.hash.substr(1).split("&");
			for(var i=0; i<hashVarsSplit.length; i++) {
				var myVar = hashVarsSplit[i];
				var index = myVar.indexOf("=");
				hashVars[myVar.substr(0, index)] = myVar.substr(index+1);
			}
			
			if(hashVars["browser"] && /^[a-z]+$/.test(hashVars["browser"])
					&& hashVars["version"] && /^[0-9a-zA-Z\-._]/.test(hashVars["version"])) {
				loc = "testResults-"+hashVars["browser"]+"-"+hashVars["version"]+".json";
			}
			if(hashVars["date"] && /^[0-9\-]+$/.test(hashVars["date"])) {
				loc = hashVars["date"]+"/"+loc;
			}
		}
		req.open("GET", loc, true);
		req.overrideMimeType("text/plain");
		req.onreadystatechange = function(e) {
			if(req.readyState != 4) return;

			if(req.status === 200 && req.responseText) {	// success; unserialize
				var data = JSON.parse(req.responseText);
				for(var i=0, n=data.results.length; i<n; i++) {
					var translatorTestView = new TranslatorTestView();
					translatorTestView.unserialize(data.results[i]);
				}
			} else {
				jsonNotFound("XMLHttpRequest returned "+req.status);
			}
		};
		
		try {
			req.send();
		} catch(e) {
			jsonNotFound(e.toString());
		}
	} else {
		// create "serialize" link at bottom
		var lastP = document.createElement("p");
		var serialize = document.createElement("a");
		serialize.href = "#";
		serialize.appendChild(document.createTextNode("Serialize Results"));
		serialize.addEventListener("click", serializeToDownload, false);
		lastP.appendChild(serialize);
		translatorBox.appendChild(lastP);
	}
}

/**
 * Indicates no JSON file could be found.
 */
function jsonNotFound(str) {
	var body = document.body;
	while(body.hasChildNodes()) body.removeChild(body.firstChild);
	body.textContent = "testResults.json could not be loaded ("+str+").";
}

/**
 * Called after translators are returned from main script
 */
function haveTranslators(translators, type) {
	translatorTestViewsToRun[type] = [];
	
	translators = translators.sort(function(a, b) {
		return a.label.localeCompare(b.label);
	});
	
	var promises = [];
	for(var i in translators) {
		promises.push(translators[i].getCode());
	}
	
	return Promise.all(promises).then(function(codes) {
		for(var i in translators) {
			// Make sure translator code is cached on the object
			translators[i].code = codes[i];
			var translatorTestView = new TranslatorTestView();
			translatorTestView.initWithTranslatorAndType(translators[i], type);
			if(translatorTestView.canRun) {
				translatorTestViewsToRun[type].push(translatorTestView);
			}
		}
		
		translatorTestStats[type].update();
		var ev = document.createEvent('HTMLEvents');
		ev.initEvent('ZoteroHaveTranslators-'+type, true, true);
		document.dispatchEvent(ev);	
	});
}

/**
 * Begin running all translator tests of a given type
 */
function runTranslatorTests(type, callback) {
	for(var i in translatorTestViewsToRun[type]) {
		var testView = translatorTestViewsToRun[type][i];
		testView.updateStatus(testView._translatorTester, "pending");
	}
	for(var i=0; i<NUM_CONCURRENT_TESTS; i++) {
		initTests(type, callback);
	}
}

/**
 * Run translator tests recursively, after translatorTestViews has been populated
 */
function initTests(type, callback, runCallbackIfComplete) {
	if(translatorTestViewsToRun[type].length) {
		if(translatorTestViewsToRun[type].length === 1) runCallbackIfComplete = true;
		var translatorTestView = translatorTestViewsToRun[type].shift();
		translatorTestView.runTests(function() { initTests(type, callback, runCallbackIfComplete) });
	} else if(callback && runCallbackIfComplete) {
		callback();
	}
}

/**
 * Serializes translator tests to JSON
 */
function serializeToJSON() {
	var serializedData = {"browser":Zotero.browser, "version":Zotero.version, "results":[]};
	for(var i in translatorTestViews) {
		var n = translatorTestViews[i].length;
		for(var j=0; j<n; j++) {
			serializedData.results.push(translatorTestViews[i][j].serialize());
		}
	}
	return serializedData;
}

/**
 * Serializes all run translator tests
 */
function serializeToDownload(e) {
	var serializedData = serializeToJSON();
	document.location.href = "data:application/octet-stream,"+encodeURIComponent(JSON.stringify(serializedData, null, "\t"));
	e.preventDefault();
}

window.addEventListener("load", load, false);