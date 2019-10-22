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

Components.utils.import("resource://gre/modules/Services.jsm");
import FilePicker from 'zotero/filePicker';

var Zotero = Components.classes["@zotero.org/Zotero;1"]
				// Currently uses only nsISupports
				//.getService(Components.interfaces.chnmIZoteroService).
				.getService(Components.interfaces.nsISupports)
				.wrappedJSObject;

// Fix JSON stringify 2028/2029 "bug"
// Borrowed from http://stackoverflow.com/questions/16686687/json-stringify-and-u2028-u2029-check
if (JSON.stringify(["\u2028\u2029"]) !== '["\\u2028\\u2029"]') {
	JSON.stringify = function (stringify) {
		return function () {
			var str = stringify.apply(this, arguments);
			if (str && str.indexOf('\u2028') != -1) str = str.replace(/\u2028/g, '\\u2028');
			if (str && str.indexOf('\u2029') != -1) str = str.replace(/\u2029/g, '\\u2029');
			return str;
		};
	}(JSON.stringify);
}

// To be used elsewhere (e.g. varDump)
function fix2028(str) {
	if (str.indexOf('\u2028') != -1) str = str.replace(/\u2028/g, '\\u2028');
	if (str.indexOf('\u2029') != -1) str = str.replace(/\u2029/g, '\\u2029');
	return str;
}

var Scaffold = new function() {
	var _browser, _frames, _document;
	var _translatorsLoadedPromise;
	var _translatorProvider = null
	
	var _editors = {};

	var _propertyMap = {
		'textbox-translatorID':'translatorID',
		'textbox-label':'label',
		'textbox-creator':'creator',
		'textbox-target':'target',
		'textbox-minVersion':'minVersion',
		'textbox-maxVersion':'maxVersion',
		'textbox-priority':'priority',
		'textbox-target-all':'targetAll',
		'textbox-hidden-prefs':'hiddenPrefs'
	};

	this.onLoad = async function (e) {
		if(e.target !== document) return;
		_document = document;
		
		_browser = document.getElementsByTagName('browser')[0];

		_browser.addEventListener("pageshow",
			_updateFrames, true);
		_updateFrames();
		
		let browserUrl = document.getElementById("browser-url");
		browserUrl.addEventListener('keypress', function(e) {
			if (e.keyCode == e.DOM_VK_RETURN) {
				_browser.loadURIWithFlags(
					browserUrl.value,
					Components.interfaces.nsIWebNavigation.LOAD_FLAGS_BYPASS_CACHE
				);
			}
		});
		
		var importWin = document.getElementById("editor-import").contentWindow;
		var codeWin = document.getElementById("editor-code").contentWindow;
		var testsWin = document.getElementById("editor-tests").contentWindow;
		
		_editors.import = importWin.editor;
		_editors.code = codeWin.editor;
		_editors.tests = testsWin.editor;

		_editors.code.getSession().setMode(new codeWin.JavaScriptMode);
		_editors.code.getSession().setUseSoftTabs(false);
		// The first code line is preceeded by some metadata lines, such that
		// the code lines start (usually) at line 15.
		_editors.code.getSession().setOption("firstLineNumber", 15);

		_editors.tests.getSession().setUseWorker(false);
		_editors.tests.getSession().setMode(new testsWin.JavaScriptMode);
		_editors.tests.getSession().setUseSoftTabs(false);
		
		_editors.import.getSession().setMode(new importWin.TextMode);
		
		// Set font size from general pref
		Zotero.setFontSize(document.getElementById('scaffold-pane'));
		
		// Set font size of code editor
		var size = Zotero.Prefs.get("scaffold.fontSize");
		if (size) {
			this.setFontSize(size);
		}

		// Set resize handler
		_document.addEventListener("resize", this.onResize, false);
		
		// Disable editing if external editor is enabled, enable when it is disabled
		document.getElementById('checkbox-editor-external').addEventListener("command",
			function() {
				var external = document.getElementById('checkbox-editor-external').checked;
				_editors.code.setReadOnly(external);
				_editors.tests.setReadOnly(external);
			}, true);

		this.generateTranslatorID();
		
		// Add List fields help menu entries for all other item types
		var types = Zotero.ItemTypes.getAll().map(t => t.name).sort();
		var morePopup = document.getElementById('mb-help-fields-more-popup');
		var primaryTypes = ['book', 'bookSection', 'conferencePaper', 'journalArticle', 'magazineArticle', 'newspaperArticle'];
		for (let type of types) {
			if (primaryTypes.includes(type)) continue;
			var menuitem = document.createElement('menuitem');
			menuitem.setAttribute('label', type);
			menuitem.addEventListener('command', () => { Scaffold.addTemplate('templateNewItem', type) });
			morePopup.appendChild(menuitem);
		}
		
		if (!Scaffold_Translators.getDirectory()) {
			if (!await this.promptForTranslatorsDirectory()) {
				window.close();
				return;
			}
		}
		
		_translatorsLoadedPromise = Scaffold_Translators.load();
		_translatorProvider = Scaffold_Translators.getProvider();
	};
	
	this.promptForTranslatorsDirectory = async function () {
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_IS_STRING;
		var index = ps.confirmEx(null,
			"Scaffold",
			"To set up Scaffold, select your development directory for Zotero translators.\n\n"
				+ "In most cases, this should be a git clone of the zotero/translators GitHub repository.",
			buttonFlags,
			"Choose Directory…",
			Zotero.getString('general.cancel'),
			"Open GitHub Repo", null, {}
		);
		// Revert to home directory
		if (index == 0) {
			let dir = await this.setTranslatorsDirectory();
			if (dir) {
				return true;
			}
		}
		else if (index == 2) {
			Zotero.launchURL('https://github.com/zotero/translators');
		}
		return false;
	};
	
	this.setTranslatorsDirectory = async function () {
		var fp = new FilePicker();
		var oldPath = Zotero.Prefs.get('scaffold.translatorsDir');
		if (oldPath) {
			fp.displayDirectory = oldPath;
		}
		fp.init(
			window,
			"Select Translators Directory",
			fp.modeGetFolder
		);
		fp.appendFilters(fp.filterAll);
		if (await fp.show() != fp.returnOK) {
			return false;
		}
		var path = OS.Path.normalize(fp.file);
		if (oldPath == path) {
			return false;
		}
		Zotero.Prefs.set('scaffold.translatorsDir', path);
		Scaffold_Translators.load(true); // async
		return path;
	};
	
	this.onResize = function() {
		// We try to let ACE resize itself
		_editors.import.resize();
		_editors.code.resize();
		_editors.tests.resize();

		return true;
	}

	this.setFontSize = function(size) {
		var sizeWithPX = size + 'px';
		_editors.import.setOptions({fontSize: sizeWithPX});
		_editors.code.setOptions({fontSize: sizeWithPX});
		_editors.tests.setOptions({fontSize: sizeWithPX});
		document.getElementById("scaffold-pane").style.fontSize = sizeWithPX;
		if (size==11) {
			// for the default value 11, clear the prefs
			Zotero.Prefs.clear('scaffold.fontSize');
		} else {
			Zotero.Prefs.set("scaffold.fontSize", size);
		}
	}

	this.increaseFontSize = function() {
		var currentSize = Zotero.Prefs.get("scaffold.fontSize") || 11;
		this.setFontSize(currentSize+2);
	}
	this.decreaseFontSize = function() {
		var currentSize = Zotero.Prefs.get("scaffold.fontSize") || 11;
		this.setFontSize(currentSize-2);
	}

	/*
	 * load translator
	 */
	this.load = Zotero.Promise.coroutine(function* (translatorID) {
		var translator = false;
		if (translatorID === undefined) {
			var io = {};
			io.translatorProvider = _translatorProvider;
			io.url = _getDocument().location.href;
			io.rootUrl = _browser.contentDocument.location.href;
			window.openDialog("chrome://scaffold/content/load.xul",
				"_blank","chrome,modal", io);
			translator = io.dataOut;
		} else {
			yield _translatorsLoadedPromise;
			translator = _translatorProvider.get(translatorID);
		}

		// No translator was selected in the dialog.
		if (!translator) return false;

		for(var id in _propertyMap) {
			document.getElementById(id).value = translator[_propertyMap[id]] || "";
		}

		//Strip JSON metadata
		var code = yield translator.getCode();
		var lastUpdatedIndex = code.indexOf('"lastUpdated"');
		var header = code.substr(0, lastUpdatedIndex + 50);
		var m = /^\s*{[\S\s]*?}\s*?[\r\n]+/.exec(header);
		var fixedCode = code.substr(m[0].length); 
		// adjust the first line number when there are an unusual number of metadata lines
		var linesOfMetadata = m[0].split('\n').length;
		_editors.code.getSession().setOption("firstLineNumber", linesOfMetadata);
		// load tests into test editing pane, but clear it first
		_editors["tests"].getSession().setValue('');
		_loadTests(fixedCode);
		// and remove them from the translator code
		var testStart = fixedCode.indexOf("/** BEGIN TEST CASES **/");
		var testEnd   = fixedCode.indexOf("/** END TEST CASES **/");
		if (testStart !== -1 && testEnd !== -1)
			fixedCode = fixedCode.substr(0,testStart) + fixedCode.substr(testEnd+23);
		
		// Set up the test running pane
		this.populateTests();

		// Convert whitespace to tabs
		_editors.code.getSession().setValue(normalizeWhitespace(fixedCode));
		// Then go to line 1
		_editors.code.gotoLine(1);
		
		// Reset configOptions and displayOptions before loading
		document.getElementById('textbox-configOptions').value = '';
		document.getElementById('textbox-displayOptions').value = '';

		if (translator.configOptions) {
			let configOptions = JSON.stringify(translator.configOptions);
			if (configOptions != '{}') {
				document.getElementById('textbox-configOptions').value = configOptions;
			}
		} 
		if (translator.displayOptions) {
			let displayOptions = JSON.stringify(translator.displayOptions);
			if (displayOptions != '{}') {
				document.getElementById('textbox-displayOptions').value = displayOptions;
			}
		}

		// get translator type; might as well have some fun here
		var type = translator.translatorType;
		var types = ["import", "export", "web", "search"];
		for(var i=2; i<=16; i*=2) {
			var mod = type % i;
			document.getElementById('checkbox-'+types.shift()).checked = !!mod;
			if(mod) type -= mod;
		}
		
		// get browser support
		var browserSupport = translator.browserSupport;
		if(!browserSupport) browserSupport = "g";
		const browsers = {gecko:"g", chrome:"c", safari:"s", ie:"i", bookmarklet:"b", server:"v"};
		for (var browser in browsers) {
			document.getElementById('checkbox-'+browser).checked = browserSupport.indexOf(browsers[browser]) !== -1;
		}

	});

	function _getMetadataObject() {
		var metadata = {
			translatorID: document.getElementById('textbox-translatorID').value,
			label: document.getElementById('textbox-label').value,
			creator: document.getElementById('textbox-creator').value,
			target: document.getElementById('textbox-target').value,
			minVersion: document.getElementById('textbox-minVersion').value,
			maxVersion: document.getElementById('textbox-maxVersion').value,
			priority: parseInt(document.getElementById('textbox-priority').value)
		};
		
		// optional (hidden) metadata
		if (document.getElementById('textbox-target-all').value) {
			metadata.targetAll = document.getElementById('textbox-target-all').value;
		}
		if (document.getElementById('textbox-hidden-prefs').value) {
			metadata.hiddenPrefs = document.getElementById('textbox-hidden-prefs').value;
		}

		if (document.getElementById('textbox-configOptions').value) {
		    metadata.configOptions = JSON.parse(document.getElementById('textbox-configOptions').value);
		}
		if (document.getElementById('textbox-displayOptions').value) {
		    metadata.displayOptions = JSON.parse(document.getElementById('textbox-displayOptions').value);
		}

		// no option for this
		metadata.inRepository = true;

		metadata.translatorType = 0;
		if(document.getElementById('checkbox-import').checked) {
			metadata.translatorType += 1;
		}
		if(document.getElementById('checkbox-export').checked) {
			metadata.translatorType += 2;
		}
		if(document.getElementById('checkbox-web').checked) {
			metadata.translatorType += 4;
		}
		if(document.getElementById('checkbox-search').checked) {
			metadata.translatorType += 8;
		}
		
    if (document.getElementById('checkbox-web').checked) {
      // save browserSupport only for web tranlsators
  		metadata.browserSupport = "";
  		if(document.getElementById('checkbox-gecko').checked) {
  			metadata.browserSupport += "g";
  		}
  		if(document.getElementById('checkbox-chrome').checked) {
  			metadata.browserSupport += "c";
  		}
  		if(document.getElementById('checkbox-safari').checked) {
  			metadata.browserSupport += "s";
  		}
  		if(document.getElementById('checkbox-ie').checked) {
  			metadata.browserSupport += "i";
  		}
  		if(document.getElementById('checkbox-bookmarklet').checked) {
  			metadata.browserSupport += "b";
  		}
  		if(document.getElementById('checkbox-server').checked) {
  			metadata.browserSupport += "v";
  		}
    }

		var date = new Date();
		metadata.lastUpdated = date.getUTCFullYear()
			+"-"+Zotero.Utilities.lpad(date.getUTCMonth()+1, '0', 2)
			+"-"+Zotero.Utilities.lpad(date.getUTCDate(), '0', 2)
			+" "+Zotero.Utilities.lpad(date.getUTCHours(), '0', 2)
			+":"+Zotero.Utilities.lpad(date.getUTCMinutes(), '0', 2)
			+":"+Zotero.Utilities.lpad(date.getUTCSeconds(), '0', 2);

		return metadata;
	}

	/*
	 * save translator to database
	 */
	this.save = Zotero.Promise.coroutine(function* (updateZotero) {
		var code = _editors.code.getSession().getValue();
		var tests = _editors.tests.getSession().getValue();
		code += tests;

		var metadata = _getMetadataObject();
		if (metadata.label === "Untitled") {
			_logOutput("Can't save an untitled translator.");
			return;
		}
		
		yield _translatorProvider.save(metadata, code);
		
		if (updateZotero) {
			yield Zotero.Translators.save(metadata, code);
			yield Zotero.Translators.reinit();
		}
	});

	/*
	 * add template code
	 */
	this.addTemplate = Zotero.Promise.coroutine(function* (template, second) {
		switch(template) {
			case "templateNewItem":
				var outputObject = {};
				outputObject.itemType = Zotero.ItemTypes.getName(second);
				var typeID = Zotero.ItemTypes.getID(second);
				var fieldList = Zotero.ItemFields.getItemTypeFields(typeID);
				for (var i=0; i<fieldList.length; i++) {
					var key = Zotero.ItemFields.getName(fieldList[i]);
					outputObject[key] = "";
				}
				var creatorList = Zotero.CreatorTypes.getTypesForItemType(typeID);
				var creators = [];
				for (var i=0; i<creatorList.length; i++) {
					creators.push({"firstName": "", "lastName": "", "creatorType": creatorList[i].name, "fieldMode": true});
				}
				outputObject.creators = creators;
				outputObject.attachments = [{"url": "", "document": "", "title": "", "mimeType": ""}];
				outputObject.tags = [{"tag": ""}];
				outputObject.notes = [{"note": ""}];
				outputObject.seeAlso = [];
				document.getElementById('output').value = JSON.stringify(outputObject, null, '\t');
				break;
			case "templateAllTypes":
				var typeNames = Zotero.ItemTypes.getTypes().map(t => t.name);
				document.getElementById('output').value = JSON.stringify(typeNames, null, '\t');
				break;
			case "shortcuts":
				var value = Zotero.File.getContentsFromURL(`chrome://scaffold/content/templates/shortcuts.txt`);
				document.getElementById('output').value = value;
				break
			default:
				//newWeb, scrapeEM, scrapeRIS, scrapeBibTeX, scrapeMARC
				//These names in the XUL file have to match the file names in template folder.
				var cursorPos = _editors.code.getSession().selection.getCursor();
				var value = Zotero.File.getContentsFromURL(`chrome://scaffold/content/templates/${template}.js`);
				_editors.code.getSession().insert(cursorPos, value);
				break
		}
	});

	/*
	 * run translator
	 */
	this.run = Zotero.Promise.coroutine(function* (functionToRun) {
		if (document.getElementById('textbox-label').value == 'Untitled') {
			alert("Translator title not set");
			return;
		}

		_clearOutput();

		if(document.getElementById('checkbox-editor-external').checked) {
			// We don't save the translator-- we reload it instead
			var translatorID = document.getElementById('textbox-translatorID').value;
			yield this.load(translatorID);
		}
		
		// Handle generic call run('detect'), run('do')
		if (functionToRun == "detect" || functionToRun == "do") {
			var isWeb = document.getElementById('checkbox-web').checked;
			functionToRun += isWeb ? "Web" : "Import";
		}
		
		if (functionToRun == "detectWeb" || functionToRun == "doWeb") {
			_run(functionToRun, _getDocument(), _selectItems, _myItemDone, _translators);
		} else if (functionToRun == "detectImport" || functionToRun == "doImport") {
			_run(functionToRun, _getImport(), _selectItems, _myItemDone, _translatorsImport);
		}
	});

	/*
	 * run translator in given mode with given input
	 */
	async function _run(functionToRun, input, selectItems, itemDone, detectHandler, done) {
		if (functionToRun == "detectWeb" || functionToRun == "doWeb") {
			var translate = new Zotero.Translate.Web();
			var utilities = new Zotero.Utilities.Translate(translate);
			if (!_testTargetRegex(input)) {
				_logOutput("Target did not match " + _getDocumentURL(input));
				if (done) {
					done();
				}
				return;
			}
			translate.setDocument(input);
		} else if (functionToRun == "detectImport" || functionToRun == "doImport") {
			var translate = new Zotero.Translate.Import();
			translate.setString(input);
		}
		translate.setTranslatorProvider(_translatorProvider);
		translate.setHandler("error", _error);
		translate.setHandler("debug", _debug);
		if (done) {
			translate.setHandler("done", done);
		}
		
		if (functionToRun == "detectWeb") {
			// get translator
			var translator = _getTranslatorFromPane();
			// don't let target prevent translator from operating
			translator.target = null;
			// generate sandbox
			translate.setHandler("translators", detectHandler);
			// internal hack to call detect on this translator
			translate._potentialTranslators = [translator];
			translate._foundTranslators = [];
			translate._currentState = "detect";
			translate._detect();
		} else if (functionToRun == "doWeb") {
			// get translator
			var translator = _getTranslatorFromPane();
			// don't let the detectCode prevent the translator from operating
			translator.detectCode = null;
			translate.setTranslator(translator);
			translate.setHandler("select", selectItems);
			translate.clearHandlers("itemDone");
			translate.setHandler("itemDone", itemDone);
			translate.translate({
				// disable saving to database
				libraryID: false
			});
		} else if (functionToRun == "detectImport") {
			// get translator
			var translator = _getTranslatorFromPane();
			// don't let target prevent translator from operating
			translator.target = null;
			// generate sandbox
			translate.setHandler("translators", detectHandler);
			// internal hack to call detect on this translator
			translate._potentialTranslators = [translator];
			translate._foundTranslators = [];
			translate._currentState = "detect";
			translate._detect();
		} else if (functionToRun == "doImport") {
			// get translator
			var translator = _getTranslatorFromPane();
			// don't let the detectCode prevent the translator from operating
			translator.detectCode = null;
			translate.setTranslator(translator);
			translate.clearHandlers("itemDone");
			translate.clearHandlers("collectionDone");
			translate.setHandler("itemDone", itemDone);
			translate.setHandler("collectionDone", function(obj, collection) {
				_logOutput("Collection: "+ collection.name + ", "+collection.children.length+" items");
			});
			translate.translate({
				// disable saving to database
				libraryID: false
			});
		}
	}

	/*
	 * generate translator GUID
	 */
	this.generateTranslatorID = function() {
		document.getElementById("textbox-translatorID").value = _generateGUID();
	}
	
	/**
	 * Test target regular expression against document URL and log the result
	 */
	this.logTargetRegex = function () {
		_logOutput(_testTargetRegex(_getDocument()));
	};
	
	/**
	 * Test target regular expression against document URL and return the result
	 */
	function _testTargetRegex(doc) {
		var url = _getDocumentURL(doc);
		
		try {
			var targetRe = new RegExp(document.getElementById('textbox-target').value, "i");
		}
		catch (e) {
			_logOutput("Regex parse error:\n" + JSON.stringify(e, null, "\t"));
		}
		
		return targetRe.test(url);
	}
	
	/*
	 * called to select items
	 */
	function _selectItems(obj, itemList) {
		var io = { dataIn:itemList, dataOut:null }
		var newDialog = window.openDialog("chrome://zotero/content/ingester/selectitems.xul",
			"_blank","chrome,modal,centerscreen,resizable=yes", io);

		return io.dataOut;
	}

	/*
	 * called if an error occurs
	 */
	function _error(obj, error) {
		if(error && error.lineNumber &&
				error.fileName == obj.translator[0].label ) {
			var lines = _editors.code.getSession().getOption("firstLineNumber");
			_editors.code.gotoLine(error.lineNumber-lines+1);	// subtract the metadata lines
		}
	}

	/*
	 * logs translator output (instead of logging in the console)
	 */
	function _debug(obj, string) {
		_logOutput(string);
	}

	/*
	 * logs item output
	 */
	function _myItemDone(obj, item) {
		Zotero.debug("Item returned");
		
		item = _sanitizeItem(item);

		_logOutput("Returned item:\n"+Zotero_TranslatorTester._generateDiff(item, Zotero_TranslatorTester._sanitizeItem(item, true)));
	}

	/*
	 * prints information from detectCode to window
	 */
	 function _translators(obj, translators) {
	 	if(translators && translators.length != 0) {
			_logOutput('detectWeb returned type "'+translators[0].itemType+'"');
	 	} else {
			_logOutput('detectWeb did not match');
		}
			
	 }

	/*
	 * prints information from detectCode to window, for import
	 */
	 function _translatorsImport(obj, translators) {
	 	if(translators && translators.length != 0 && translators[0].itemType) {
			_logOutput('detectImport matched');
	 	} else {
			_logOutput('detectImport did not match');
		}
	 }

	/*
	 * logs debug info (instead of console)
	 */
	function _logOutput(string) {
		var date = new Date();
		var output = document.getElementById('output');

		if(typeof string != "string") {
			string = fix2028(Zotero.Utilities.varDump(string));
		}

		if(output.value) output.value += "\n";
		output.value += Zotero.Utilities.lpad(date.getHours(), '0', 2)
				+":"+Zotero.Utilities.lpad(date.getMinutes(), '0', 2)
				+":"+Zotero.Utilities.lpad(date.getSeconds(), '0', 2)
				+" "+string.replace(/\n/g, "\n         ");
		// move to end
		output.inputField.scrollTop = output.inputField.scrollHeight;
	}

	/*
	 * gets import text for import translator
	 */
	function _getImport() {
		var text = _editors.import.getSession().getValue();
		return text;
	}

	/*
	 * transfers metadata to the translator object
	 * Replicated from translator.js
	 */
	function _metaToTranslator(translator, metadata) {
		var props = ["translatorID", "translatorType", "label", "creator", "target",
			"minVersion", "maxVersion", "priority", "lastUpdated", "inRepository", "configOptions",
			"displayOptions", "browserSupport", "targetAll", "hiddenPrefs"];
		for (var i=0; i<props.length; i++) {
			translator[props[i]] = metadata[props[i]];
		}
		
		translator.getCode = function () {
			return Zotero.Promise.resolve(this.code);
		};

		if(!translator.configOptions) translator.configOptions = {};
		if(!translator.displayOptions) translator.displayOptions = {};
		if(!translator.browserSupport) translator.browserSupport = "g";
	}

	/*
	 * gets translator data from the metadata pane
	 */
	function _getTranslatorFromPane() {
		//create a barebones translator
		var translator = new Object();
		var metadata = _getMetadataObject(true);

		//copy metadata into the translator object
		_metaToTranslator(translator, metadata);

		metadata = JSON.stringify(metadata, null, "\t") + ";\n";

		translator.code = metadata + "\n" + _editors.code.getSession().getValue();

		// make sure translator gets run in browser in Zotero >2.1
		if(Zotero.Translator.RUN_MODE_IN_BROWSER) {
			translator.runMode = Zotero.Translator.RUN_MODE_IN_BROWSER;
		}

		return translator;
	}

	/*
	 * loads the translator's tests from the pane
	 */
	function _loadTests(code) {
		var testStart = code.indexOf("/** BEGIN TEST CASES **/");
		var testEnd   = code.indexOf("/** END TEST CASES **/"); 
		if (testStart !== -1 && testEnd !== -1) {
			test = code.substring(testStart + 24, testEnd);
			test = test.replace(/var testCases = /,'').trim();
			// The JSON parser doesn't like final semicolons
			if (test.lastIndexOf(';') == (test.length-1))
				test = test.slice(0,-1);
			try {
				var testObject = JSON.parse(test);
				_writeTests(JSON.stringify(testObject, null, "\t")); // Don't modify current tests
				return testObject;
			} catch (e) {
				_logOutput("Exception parsing JSON");
				return false;
			}
		} else {
			return false;
		}
	}

	/*
	 * writes tests back into the translator
	 */
	function _writeTests(testString) {
		var code = "/** BEGIN TEST CASES **/\nvar testCases = "
				+ testString + "\n/** END TEST CASES **/";
		_editors["tests"].getSession().setValue(code);
	}
	
	/* clear tests pane */
	function _clearTests() {
		var listbox = document.getElementById("testing-listbox");
		var count = listbox.itemCount;
		while(count-- > 0){
			listbox.removeItemAt(0);
		}
	}

	/* turns an item into a test-safe item
	 * does not check if all fields are valid
	 */
	function _sanitizeItem(item) {
		// Clear attachment document objects
		if (item && item.attachments && item.attachments.length) {
			for (var i=0; i<item.attachments.length; i++) {
				if (item.attachments[i].document)
					item.attachments[i].document = "[object]";
			}
		}
		
		if (item && item.tags) {
			item.tags = Zotero.Utilities.arrayUnique(item.tags).sort();
		}
		return item;
	}
	
	/* sanitizes all items in a test
	 */
	function _sanitizeItemsInTest(test) {
		if(test.items && typeof test.items != 'string' && test.items.length) {
			for(var i=0, n=test.items.length; i<n; i++) {
				test.items[i] = Zotero_TranslatorTester._sanitizeItem(test.items[i]);
			}
		}
		return test;
	}
	
	/* stringifies an array of tests
	 * Output is the same as JSON.stringify (with pretty print), except that
	 * Zotero.Item objects are stringified in a deterministic manner (mostly):
	 *   * Certain important fields are placed at the top of the object
	 *   * Certain less-frequently used fields are placed at the bottom
	 *   * Remaining fields are sorted alphabetically
	 *   * tags are always sorted alphabetically
	 *   * Some fields, like those inside creator objects, notes, etc. are not sorted
	 */
	function _stringifyTests(value, level) {
		if(!level) level = 0;
		
		if(typeof(value) == 'function' || typeof(value) == 'undefined' || value === null) {
			return level ? undefined : '';
		}
		
		if(typeof(value) !== 'object') return JSON.stringify(value, null, "\t");
		
		if(value instanceof Array) {
			let str = '[';
			for(let i=0; i<value.length; i++) {
				let val = _stringifyTests(value[i], level+1);
				
				if(val === undefined) val = 'undefined';
				else val = val.replace(/\n/g, "\n\t"); // Indent
				
				str += (i?',':'') + "\n\t" + val;
			}
			return str + (str.length > 1 ? "\n]" : ']');
		}
		
		if(!value.itemType) {
			// Not a Zotero.Item object
			let str = '{';
			
			function processRow(key, value) {
				let val = _stringifyTests(value, level+1);
				if(val === undefined) return;
				
				val = val.replace(/\n/g, "\n\t");
				return JSON.stringify(''+key) + ': ' + val;
			}
			
			if (level < 2 && value.items) {
				// Test object. Arrange properties in set order
				let order = ['type', 'url', 'input', 'defer', 'items'];
				for (let i=0; i<order.length; i++) {
					let val = processRow(order[i], value[order[i]]);
					if (val === undefined) continue;
					str += (str.length > 1 ? ',' : '') + '\n\t' + val;
				}
			} else {
				for (let i in value) {
					let val = processRow(i, value[i]);
					if (val === undefined) continue;
					str += (str.length > 1 ? ',' : '') + '\n\t' + val;
				}
			}
			
			return str + (str.length > 1 ? "\n}" : '}');
		}
		
		// Zotero.Item object
		const topFields = ['itemType', 'title', 'caseName', 'nameOfAct', 'subject',
			'creators', 'date', 'dateDecided', 'issueDate', 'dateEnacted'];
		const bottomFields = ['attachments', 'tags', 'notes', 'seeAlso'];
		let otherFields = Object.keys(value);
		let presetFields = topFields.concat(bottomFields);
		for(let i=0; i<presetFields.length; i++) {
			let j = otherFields.indexOf(presetFields[i]);
			if(j == -1) continue;
			
			otherFields.splice(j, 1);
		}
		let fields = topFields.concat(otherFields.sort()).concat(bottomFields);
		
		let str = '{';
		for(let i=0; i<fields.length; i++) {
			let rawVal = value[fields[i]];
			if(!rawVal) continue;
			
			let val;
			if(fields[i] == 'tags') {
				val = _stringifyTests(rawVal.sort(), level+1);
			} else {
				val = _stringifyTests(rawVal, level+1);
			}
			
			if(val === undefined) continue;
			
			val = val.replace(/\n/g, "\n\t");
			str += (str.length > 1 ? ',':'') + "\n\t" + JSON.stringify(fields[i]) + ': ' + val;
		}
		
		return str + "\n}";
	}
	
	/*
	 * adds a new test from the current input/translator
	 * web or import only for now
	 */
	this.newTestFromCurrent = function(type) {
		_clearOutput();
		var input, label;
		if (type == "web" && !document.getElementById('checkbox-web').checked) {
			_logOutput("Current translator isn't a web translator");
			return false;
		} else if (type == "import" && !document.getElementById('checkbox-import').checked) {
			_logOutput("Current translator isn't an import translator");
			return false;
		}

		if (type == "web") {
			input = _getDocument();
			label = Zotero.Proxies.proxyToProper(input.location.href);
		} else if (type == "import") {
			input = _getImport();
			label = input;
		} else {
			return false;
		}

		var listbox = document.getElementById("testing-listbox");
		var listitem = document.createElement("listitem");
		var listcell = document.createElement("listcell");
		listcell.setAttribute("label", label);
		listitem.appendChild(listcell);
		listcell = document.createElement("listcell");
		listcell.setAttribute("label", "Creating...");
		listitem.appendChild(listcell);
		listbox.appendChild(listitem);

		if (type == "web") {
			// Creates the test. The test isn't saved yet!
			let tester = new Zotero_TranslatorTester(
				_getTranslatorFromPane(),
				type,
				_debug,
				_translatorProvider
			);
			tester.newTest(input, function (obj, newTest) { // "done" handler for do
				if(newTest) {
					listcell.setAttribute("label", "New unsaved test");
					listitem.setUserData("test-string", JSON.stringify(_sanitizeItemsInTest(newTest)), null);
				} else {
					listcell.setAttribute("label", "Creation failed");
				}
			});
		}

		if (type == "import") {
			var test = {"type" : "import", "input" : input, "items" : []};

			// Creates the test. The test isn't saved yet!
			// TranslatorTester doesn't handle these correctly, so we do it manually
			_run("doImport", input, null, function(obj, item) {
				if(item) {
					test.items.push(Zotero_TranslatorTester._sanitizeItem(item));
				} 
			}, null, function(){
					listcell.setAttribute("label", "New unsaved test");
					listitem.setUserData("test-string", JSON.stringify(test), null);
			});
		}
	}

	/*
	 * populate tests pane and url options in browser pane
	 */
	this.populateTests = function() {
		_clearTests();
		// Clear entries (but not value) in the url dropdown in the browser tab 
		var browserURL = document.getElementById("browser-url");
		var currentURL = browserURL.value;
		browserURL.removeAllItems();
		browserURL.value = currentURL;
		
		var tests = _loadTests(_editors["tests"].getSession().getValue());
		// We've got tests, let's display them
		var listbox = document.getElementById("testing-listbox");
		for (var i=0; i<tests.length; i++) {
			var test = tests[i];
			var listitem = document.createElement("listitem");
			var listcell = document.createElement("listcell");
			if (test.type == "web") {
				listcell.setAttribute("label", test.url);
				browserURL.appendItem(test.url);
			} else if (test.type == "import")
				// trim label to improve performance
				listcell.setAttribute("label", test.input.substr(0,80));
			else continue; // unknown test type
			listitem.appendChild(listcell);
			listcell = document.createElement("listcell");
			listcell.setAttribute("label", "Not run");
			listitem.appendChild(listcell);
			// Put the serialized JSON in user data
			listitem.setUserData("test-string", JSON.stringify(test), null);
			listbox.appendChild(listitem);
		}
		
		// Re-position URL drop-down
		if (browserURL.firstChild) {
			browserURL.firstChild.position = 'after_start';
		}
	}

	
	/*
	 * Save tests back to translator, and save the translator
	 */
	this.saveTests = Zotero.Promise.method(function () {
		var tests = [];
		var item;
		var i = 0;
		var listbox = document.getElementById("testing-listbox");
		var count = listbox.itemCount;
		while(i < count){
			item = listbox.getItemAtIndex(i);
			if(item.getElementsByTagName("listcell")[1].getAttribute("label") === "New unsaved test") {
				item.getElementsByTagName("listcell")[1].setAttribute("label", "New test");
			}
			var test = item.getUserData("test-string");
			if(test) tests.push(JSON.parse(test));
			i++;
		}
		_writeTests(_stringifyTests(tests));
	});

	/*
	 * Delete selected test(s), from UI
	 */
	this.deleteSelectedTests = function() {
		var listbox = document.getElementById("testing-listbox");
		var count = listbox.selectedCount;
		while (count--) {
			var item = listbox.selectedItems[0];
			listbox.removeItemAt(listbox.getIndexOfItem(item));
		}
	}

	/*
	 * Load the import input for the first selected test in the import pane,
	 * from the UI.
	 */	
	this.editImportFromTest = function() {
		var listbox = document.getElementById("testing-listbox");
		var item = listbox.selectedItems[0];
		var test = JSON.parse(item.getUserData("test-string"));
		if (test.input === undefined) {
			_logOutput("Can't edit import data for a non-import test.");
		}
		_editors.import.getSession().setValue(test.input);
	}
	
	/*
	 * Copy the url or data of the first selected test to the clipboard.
	 */	
	this.copyToClipboard = function() {
		var listbox = document.getElementById("testing-listbox");
		var item = listbox.selectedItems[0];
		var url = item.getElementsByTagName("listcell")[0].getAttribute("label");
		var test = JSON.parse(item.getUserData("test-string"));
		var urlOrData = (test.input !== undefined) ? test.input : url;
		Zotero.Utilities.Internal.copyTextToClipboard(urlOrData);
	}
	
	/*
	 * Open the url of the first selected test in the browser.
	 */	
	this.openURL = function() {
		var listbox = document.getElementById("testing-listbox");
		var item = listbox.selectedItems[0];
		var url = item.getElementsByTagName("listcell")[0].getAttribute("label");
		Zotero.launchURL(url);
	}
	
	/*
	 * Run selected test(s)
	 */
	this.runSelectedTests = function() {
		_clearOutput();
		
		var listbox = document.getElementById("testing-listbox");
		var items = listbox.selectedItems;
		if(!items || items.length == 0) return false; // No action if nothing selected
		var webtests = [];
		var importtests = [];
		for (var i=0; i<items.length; i++) {
			items[i].getElementsByTagName("listcell")[1].setAttribute("label", "Running");
			var test = JSON.parse(items[i].getUserData("test-string"));
			test["ui-item"] = items[i];
			if (test.type == "web") webtests.push(test);
			if (test.type == "import") importtests.push(test);
		}
		
		if (webtests.length > 0) {
			let webtester = new Zotero_TranslatorTester(
				_getTranslatorFromPane(),
				"web",
				_debug,
				_translatorProvider
			);
			webtester.setTests(webtests);
			webtester.runTests(function(obj, test, status, message) {
				test["ui-item"].getElementsByTagName("listcell")[1].setAttribute("label", message);
			});
		}
		
		if (importtests.length > 0 ) {
			let importtester = new Zotero_TranslatorTester(
				_getTranslatorFromPane(),
				"import",
				_debug,
				_translatorProvider
			);
			importtester.setTests(importtests);
			importtester.runTests(function(obj, test, status, message) {
				test["ui-item"].getElementsByTagName("listcell")[1].setAttribute("label", message);
			});
		}
	}
	
	/*
	 * Update selected test(s)
	 */
	this.updateSelectedTests = function () {
		_clearOutput();
		var listbox = document.getElementById("testing-listbox");
		var items = [...listbox.selectedItems];
		if(!items || items.length == 0) return false; // No action if nothing selected
		var tests = [];
		for (var i=0; i<items.length; i++) {
			items[i].getElementsByTagName("listcell")[1].setAttribute("label", "Updating");
			var test = JSON.parse(items[i].getUserData("test-string"));
			tests.push(test);
		}
		
		var updater = new TestUpdater(tests);
		var testsDone = 0;
		updater.updateTests(
			(newTest) => {
				// Assume sequential. TODO: handle this properly via test ID of some sort
				if(newTest) {
					message = "Test updated";
					//Zotero.debug(newTest[testsDone]);
					items[testsDone].setUserData("test-string", JSON.stringify(newTest), null);
				} else {
					message = "Update failed"
				}
				items[testsDone].getElementsByTagName("listcell")[1].setAttribute("label", message);
				testsDone++;
			},
			() => {
				_logOutput("Tests updated.");
				// Save tests
				_logOutput("Saving tests and translator.");
				this.saveTests();
			}
		);
	}
	
	var TestUpdater = function(tests) {
		this.testsToUpdate = tests.slice();
		this.numTestsTotal = this.testsToUpdate.length;
		this.newTests = [];
		this.tester = new Zotero_TranslatorTester(
			_getTranslatorFromPane(),
			"web",
			_debug,
			_translatorProvider
		);
	}
	
	TestUpdater.prototype.updateTests = function(testDoneCallback, doneCallback) {
		this.testDoneCallback = testDoneCallback || function() { /* no-op */};
		this.doneCallback = doneCallback || function() { /* no-op */};
		
		this._updateTests();
	}
	
	TestUpdater.prototype._updateTests = function() {
		if(!this.testsToUpdate.length) {
			this.doneCallback(this.newTests);
			return;
		}
		
		var test = this.testsToUpdate.shift();
		_logOutput("Updating test " + (this.numTestsTotal - this.testsToUpdate.length));
		
		var me = this;
		
		if (test.type == "import") {
			test.items = [];

			// Re-runs the test.
			// TranslatorTester doesn't handle these correctly, so we do it manually
			_run("doImport", test.input, null, function(obj, item) {
				if(item) {
					test.items.push(Zotero_TranslatorTester._sanitizeItem(item));
				} 
			}, null, function() {
				if (!test.items.length) test = false;
				me.newTests.push(test);
				me.testDoneCallback(test);
				me._updateTests();
			});
			// Don't want to run the web portion
			return true;
		}
		
		_logOutput("Loading web page from " + test.url);
		var hiddenBrowser = Zotero.HTTP.loadDocuments(
			test.url,
			function (doc) {
				_logOutput("Page loaded");
				if (test.defer) {
					_logOutput("Waiting " + (Zotero_TranslatorTester.DEFER_DELAY/1000)
						+ " second(s) for page content to settle"
					);
				}
				Zotero.setTimeout(
					function() {
						doc = hiddenBrowser.contentDocument;
						if (doc.location.href != test.url) {
							_logOutput("Page URL differs from test. Will be updated. "+ doc.location.href);
						}
						me.tester.newTest(doc, function(obj, newTest) {
							Zotero.Browser.deleteHiddenBrowser(hiddenBrowser);
							if (test.defer) {
								newTest.defer = true;
							}
							newTest = _sanitizeItemsInTest(newTest);
							me.newTests.push(newTest);
							me.testDoneCallback(newTest);
							me._updateTests();
						});
					},
					test.defer ? Zotero_TranslatorTester.DEFER_DELAY : 0,
					true
				)
			},
			null,
			function(e) {
				Zotero.logError(e);
				me.newTests.push(false);
				me.testDoneCallback(false);
				me._updateTests();
			},
			true
		);
		
		hiddenBrowser.docShell.allowMetaRedirects = true;
	}

	/*
	 * Normalize whitespace to the Zotero norm of tabs
	 */
	function normalizeWhitespace(text) {
		return text.replace(/^[ \t]+/gm, function(str) {
			return str.replace(/ {4}/g, "\t");
		});
	}

	/*
	 * Clear output pane
	 */
	function _clearOutput() {
		document.getElementById('output').value = '';
	}

	/*
	 * generates an RFC 4122 compliant random GUID
	 */
	function _generateGUID() {
		var guid = "";
		for(var i=0; i<16; i++) {
			var bite = Math.floor(Math.random() * 255);

			if(i == 4 || i == 6 || i == 8 || i == 10) {
				guid += "-";

				// version
				if(i == 6) bite = bite & 0x0f | 0x40;
				// variant
				if(i == 8) bite = bite & 0x3f | 0x80;
			}
			var str = bite.toString(16);
			guid += str.length == 1 ? '0' + str : str;
		}
		return guid;
	}

	/*
	 * updates list of available frames and show URL of active tab 
	 */
	function _updateFrames() {
		var doc = _browser.contentDocument;
		
		// Show URL of active tab
		document.getElementById("browser-url").value = doc.location.href;
		
		// No need to run if Scaffold isn't open
		var menulist = _document.getElementById("menulist-testFrame");
		if (!_document || !menulist) return true;

		menulist.removeAllItems();
		var popup = _document.createElement("menupopup");
		menulist.appendChild(popup);

		_frames = new Array();

		var frames = doc.getElementsByTagName("frame");
		if(frames.length) {
			_getFrames(frames, popup);
		} else {
			var item = _document.createElement("menuitem");
			item.setAttribute("label", "Default");
			popup.appendChild(item);

			_frames = [doc];
		}

		menulist.selectedIndex = 0;
	}

	/*
	 * recursively searches for frames
	 */
	function _getFrames(frames, popup) {
		for (var i=0; i<frames.length; i++) {
			var frame = frames[i];
			if(frame.contentDocument) {
				// get a good name
				var frameName;
				if(frame.title) {
					frameName = frame.title;
				} else if(frame.name) {
					frameName = frame.name;
				} else {
					frameName = frame.contentDocument.location.href;
				}

				// add frame
				var item = _document.createElement("menuitem");
				item.setAttribute("label", frameName);
				popup.appendChild(item);
				_frames.push(frame.contentDocument);

				// see if frame has its own frames
				var subframes = frame.contentDocument.getElementsByTagName("frame");
				if(subframes.length) _getFrames(subframes, popup);
			}
		}
	}

	/*
	 * gets selected frame/document
	 */
	function _getDocument() {
		return _frames[_document.getElementById("menulist-testFrame").selectedIndex];
	}
	
	function _getDocumentURL(doc) {
		return Zotero.Proxies.proxyToProper(doc.location.href);
	}
}

window.addEventListener("load", function(e) { Scaffold.onLoad(e); }, false);
