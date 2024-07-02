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

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { E10SUtils } = ChromeUtils.import("resource://gre/modules/E10SUtils.jsm");
var { Subprocess } = ChromeUtils.import("resource://gre/modules/Subprocess.jsm");
var { RemoteTranslate } = ChromeUtils.import("chrome://zotero/content/RemoteTranslate.jsm");
var { ContentDOMReference } = ChromeUtils.import("resource://gre/modules/ContentDOMReference.jsm");

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');

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

var Scaffold = new function () {
	var _browser;
	var _translatorsLoadedPromise;
	var _translatorProvider = null;
	var _lastModifiedTime = 0;
	var _needRebuildTranslatorSuggestions = true;
	var _tabClicked = false;

	this.browser = () => _browser;
	
	var _editors = {};

	var _propertyMap = {
		'textbox-translatorID': 'translatorID',
		'textbox-label': 'label',
		'textbox-creator': 'creator',
		'textbox-target': 'target',
		'textbox-minVersion': 'minVersion',
		'textbox-priority': 'priority',
		'textbox-target-all': 'targetAll',
		'textbox-hidden-prefs': 'hiddenPrefs'
	};

	var _linesOfMetadata = 15;

	this.onLoad = async function (e) {
		if (e.target !== document) return;
		_browser = document.getElementById('browser');

		window.messageManager.addMessageListener('Scaffold:Load', ({ data }) => {
			document.getElementById("browser-url").value = data.url;
		});

		window.messageManager.loadFrameScript('chrome://scaffold/content/content.js', true);
		
		let browserUrl = document.getElementById("browser-url");
		browserUrl.addEventListener('keydown', function (e) {
			if (e.key == 'Enter') {
				Zotero.debug('Scaffold: Loading URL in browser: ' + browserUrl.value);
				_browser.loadURI(Services.io.newURI(browserUrl.value), {
					triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
				});
			}
		});

		document.getElementById('tabpanels').addEventListener('select', event => Scaffold.handleTabSelect(event));
		document.getElementById('tabs').addEventListener('mousedown', (event) => {
			// Record if tab selection will happen due to a mouse click vs keyboard nav.
			if (event.clientX === 0 && event.clientY === 0) return;
			_tabClicked = true;
		}, true);
		
		let lastTranslatorID = Zotero.Prefs.get('scaffold.lastTranslatorID');
		if (lastTranslatorID) {
			document.getElementById("textbox-translatorID").value = lastTranslatorID;
			document.getElementById("textbox-label").value = 'Loading…';
		}
		else {
			this.generateTranslatorID();
		}
		
		// Add List fields help menu entries for all other item types
		var types = Zotero.ItemTypes.getAll().map(t => t.name).sort();
		var morePopup = document.getElementById('mb-help-fields-more-popup');
		var primaryTypes = ['book', 'bookSection', 'conferencePaper', 'journalArticle', 'magazineArticle', 'newspaperArticle'];
		for (let type of types) {
			if (primaryTypes.includes(type)) continue;
			var menuitem = document.createXULElement('menuitem');
			menuitem.setAttribute('label', type);
			menuitem.addEventListener('command', () => {
				Scaffold.addTemplate('templateNewItem', type);
			});
			morePopup.appendChild(menuitem);
		}
		
		if (!Scaffold_Translators.getDirectory()) {
			if (!await this.promptForTranslatorsDirectory()) {
				window.close();
				return;
			}
		}

		var importWin = document.getElementById("editor-import").contentWindow;
		var codeWin = document.getElementById("editor-code").contentWindow;
		var testsWin = document.getElementById("editor-tests").contentWindow;

		await Promise.all([
			importWin.loadMonaco({ language: 'plaintext' }).then(({ monaco, editor }) => {
				_editors.importGlobal = monaco;
				_editors.import = editor;
			}),
			codeWin.loadMonaco({ language: 'javascript' }).then(({ monaco, editor }) => {
				_editors.codeGlobal = monaco;
				_editors.code = editor;
			}),
			testsWin.loadMonaco({ language: 'json' }).then(({ monaco, editor }) => {
				_editors.testsGlobal = monaco;
				_editors.tests = editor;
			}),
		]);

		this.initImportEditor();
		this.initCodeEditor();
		this.initTestsEditor();

		// Set font size from general pref
		Zotero.UIProperties.registerRoot(document.getElementById('scaffold-pane'));

		// Set font size of code editor
		var size = Zotero.Prefs.get("scaffold.fontSize");
		if (size) {
			this.setFontSize(size);
		}

		// Listen for Scaffold coming to the foreground and reload translators
		window.addEventListener('activate', () => this.reloadTranslators());

		Scaffold_Translators.setLoadListener({
			onLoadBegin: () => {
				document.getElementById('cmd_load').setAttribute('disabled', true);
			},

			onLoadComplete: () => {
				document.getElementById('cmd_load').removeAttribute('disabled');
				_needRebuildTranslatorSuggestions = true;
			}
		});
		
		_translatorsLoadedPromise = Scaffold_Translators.load();
		_translatorProvider = Scaffold_Translators.getProvider();
		
		if (lastTranslatorID) {
			this.load(lastTranslatorID).then((success) => {
				if (!success) {
					Zotero.Prefs.clear('scaffold.lastTranslatorID');
					this.newTranslator(true);
				}
			});
		}
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
		var path = PathUtils.normalize(fp.file);
		if (oldPath == path) {
			return false;
		}
		Zotero.Prefs.set('scaffold.translatorsDir', path);
		Scaffold_Translators.load(true); // async
		return path;
	};

	this.reloadTranslators = async function () {
		Zotero.debug('Reloading translators quietly');
		let { numLoaded, numDeleted } = await Scaffold_Translators.load(true);
		if (numLoaded) {
			_logOutput(`${numLoaded} ${Zotero.Utilities.pluralize(numLoaded, 'translator')} updated.`);
		}
		if (numDeleted) {
			_logOutput(`${numDeleted} ${Zotero.Utilities.pluralize(numDeleted, 'translator')} deleted.`);
		}

		let translatorID = document.getElementById('textbox-translatorID').value;
		let modifiedTime = Scaffold_Translators.getModifiedTime(translatorID);
		if (modifiedTime && modifiedTime > _lastModifiedTime) {
			let ps = Services.prompt;
			let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
				+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
			var index = ps.confirmEx(null,
				"Scaffold",
				"Translator code changed externally. Discard unsaved changes and reload?",
				buttonFlags,
				Zotero.getString('general.no'),
				Zotero.getString('general.yes'),
				null, null, {}
			);
			if (index == 1) {
				await this.load(translatorID);
			}
			else {
				_lastModifiedTime = modifiedTime;
			}
		}
		
		_updateTitle();
	};

	this.initImportEditor = function () {
		let monaco = _editors.importGlobal, editor = _editors.import;
		// Nothing to do here
	};

	this.initCodeEditor = async function () {
		let monaco = _editors.codeGlobal, editor = _editors.code;
		
		// For some reason, even if we explicitly re-set the default model's language to JavaScript,
		// Monaco still treats it as TypeScript. Recreating the model manually fixes the issue.
		let model = monaco.editor.createModel('', 'javascript', monaco.Uri.parse('inmemory:///translator.js'));
		editor.setModel(model);

		editor.updateOptions({
			lineNumbers: num => num + _linesOfMetadata - 1,
		});

		monaco.languages.registerCodeLensProvider('javascript', this.createRunCodeLensProvider(monaco, editor));
		monaco.languages.registerHoverProvider('javascript', this.createHoverProvider(monaco, editor));
		monaco.languages.registerCompletionItemProvider('javascript', this.createCompletionProvider(monaco, editor));

		let tsLib = await Zotero.File.getContentsAsync(
			PathUtils.join(Scaffold_Translators.getDirectory(), 'index.d.ts'));
		let tsLibPath = 'ts:filename/index.d.ts';
		monaco.languages.typescript.javascriptDefaults.addExtraLib(tsLib, tsLibPath);
		// this would allow peeking:
		//   monaco.editor.createModel(tsLib, 'typescript', monaco.Uri.parse(tsLibPath));
		// but it doesn't currently seem to work
	};

	this.initTestsEditor = function () {
		let monaco = _editors.testsGlobal, editor = _editors.tests;

		monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
			validate: true,
			allowComments: false,
			trailingCommas: false,
			schemaValidation: 'error'
		});

		editor.getModel().updateOptions({
			insertSpaces: false
		});

		editor.getModel().onDidChangeContent((_) => {
			this.populateTests();
		});

		editor.updateOptions({
			links: false,
			stickyScroll: { enabled: false }
		});

		monaco.languages.registerCodeLensProvider('json', this.createTestCodeLensProvider(monaco, editor));
	};

	this.createRunCodeLensProvider = function (monaco, editor) {
		let runMethod = editor.addCommand(0, (_ctx, method) => this.run(method), '');

		return {
			provideCodeLenses: (model, _token) => {
				let methodRe = '(async\\s+)?\\bfunction\\s+(detect|do)(Web|Import|Export|Search)\\s*\\(';
				let lenses = [];

				let matches = model.findMatches(
					methodRe,
					/* searchOnlyEditableRange: */ false,
					/* isRegex: */ true,
					/* matchCase: */ true,
					/* wordSeparators: */ null,
					/* captureMatches: */ true
				);

				for (let match of matches) {
					let line = match.matches[0];
					let methodName = line.match(/function\s+(\w*)/)[1];
					lenses.push({
						range: match.range,
						command: {
							id: runMethod,
							title: `Run ${methodName}`,
							arguments: [methodName]
						}
					});
				}

				return { lenses, dispose() {} };
			},
			resolveCodeLens: (_model, codeLens, _token) => codeLens
		};
	};

	this.createHoverProvider = function (monaco, _editor) {
		let uuidRe = `(["'])([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\1`;
		let types = Zotero.ItemTypes.getTypes().map(t => t.name);
		let itemTypeRe = `(["'])(${types.join('|')})\\1`;

		return {
			provideHover: (model, position) => {
				let lineRange = new monaco.Range(
					position.lineNumber,
					model.getLineMinColumn(position.lineNumber),
					position.lineNumber,
					model.getLineMaxColumn(position.lineNumber)
				);

				let matches = model.findMatches(
					uuidRe,
					/* searchScope: */ lineRange,
					/* isRegex: */ true,
					/* matchCase: */ true,
					/* wordSeparators: */ null,
					/* captureMatches: */ true
				);

				for (let uuidMatch of matches) {
					if (!uuidMatch.range.containsPosition(position)) continue;
					let translator = _translatorProvider.get(uuidMatch.matches[2]);

					if (translator) {
						let metadataJSON = JSON.stringify(translator.metadata, null, '\t');

						return {
							range: uuidMatch.range,
							contents: [
								{ value: `**${translator.label}**` },
								{ value: '```json\n' + metadataJSON + '\n```' }
							]
						};
					}
				}

				matches = model.findMatches(
					itemTypeRe,
					/* searchScope: */ lineRange,
					/* isRegex: */ true,
					/* matchCase: */ true,
					/* wordSeparators: */ null,
					/* captureMatches: */ true
				);

				for (let itemTypeMatch of matches) {
					if (!itemTypeMatch.range.containsPosition(position)) continue;

					let fieldsJSON = this.listFieldsForItemType(itemTypeMatch.matches[2]);
					return {
						range: itemTypeMatch.range,
						contents: [
							{ value: '```json\n' + fieldsJSON + '\n```' }
						]
					};
				}

				return null;
			}
		};
	};

	this.createTestCodeLensProvider = function (monaco, editor) {
		let runTestsCommand = editor.addCommand(
			0,
			(_ctx, testIndices) => {
				let tests;
				try {
					tests = JSON.parse(editor.getValue());
				}
				catch (e) {
					_logOutput('Error parsing tests:\n' + e);
				}

				if (testIndices) {
					tests = testIndices.map(index => tests[index]);
				}

				this.runTests(tests);
			},
			'');

		let updateTestsCommand = editor.addCommand(
			0,
			async (_ctx, testIndices) => {
				testIndices = testIndices || Object.keys(allTests);

				try {
					var allTests = JSON.parse(editor.getValue());
				}
				catch (e) {
					_logOutput('Error parsing tests:\n' + e);
					return;
				}

				let tests = testIndices.map(index => allTests[index]);

				await this.updateTests(tests,
					(newTest) => {
						allTests[testIndices.shift()] = newTest;
					});

				_writeTestsToPane(allTests);
			},
			'');

		return {
			provideCodeLenses: (model, _token) => {
				let lenses = [];

				let firstChar = {
					startLineNumber: 1,
					startColumn: 1,
					endLineNumber: 1,
					endColumn: 1
				};
				lenses.push({
					range: firstChar,
					command: {
						id: runTestsCommand,
						title: 'Run All'
					}
				});
				lenses.push({
					range: firstChar,
					command: {
						id: updateTestsCommand,
						title: 'Run and Update All'
					}
				});

				for (let [testIndex, range] of _findTestObjectTops(monaco, model).entries()) {
					lenses.push({
						range: range,
						command: {
							id: runTestsCommand,
							title: 'Run',
							arguments: [[testIndex]]
						}
					});

					lenses.push({
						range: range,
						command: {
							id: updateTestsCommand,
							title: 'Run and Update',
							arguments: [[testIndex]]
						}
					});
				}

				return { lenses, dispose() {} };
			},
			resolveCodeLens: (_model, codeLens, _token) => codeLens
		};
	};
	
	this.createCompletionProvider = function (monaco, editor) {
		let suggestions = null;
		return {
			provideCompletionItems(model, position) {
				let prefixText = model.getValueInRange({
					startLineNumber: position.lineNumber,
					startColumn: 1,
					endLineNumber: position.lineNumber,
					endColumn: position.column
				});
				if (/setTranslator\([^)]*$/.test(prefixText)) {
					let word = model.getWordUntilPosition(position);
					let range = {
						startLineNumber: position.lineNumber,
						endLineNumber: position.lineNumber,
						startColumn: word.startColumn,
						endColumn: word.endColumn
					};
					if (!suggestions || _needRebuildTranslatorSuggestions) {
						// Cache the suggestions minus the range field
						suggestions = [...Scaffold_Translators._translators.entries()].map(([id, meta]) => {
							return {
								label: `${meta.translator.label}: '${id}'`,
								kind: monaco.languages.CompletionItemKind.Constant,
								insertText: `'${id}'`
							};
						});
						_needRebuildTranslatorSuggestions = false;
					}
					// Add the range to each suggestion before returning
					return { suggestions: suggestions.map(s => ({ ...s, range })) };
				}
				return { suggestions: [] };
			}
		};
	};

	this.updateModelMarkers = function (translatorPath) {
		runESLint(translatorPath)
			.then(eslintOutputToModelMarkers)
			.then(markers => _editors.codeGlobal.editor.setModelMarkers(_editors.code.getModel(), 'eslint', markers));
	};

	this.setFontSize = function (size) {
		var sizeWithPX = size + 'px';
		_editors.import.updateOptions({ fontSize: size + 1 }); // editor font needs to be a little bigger
		_editors.code.updateOptions({ fontSize: size + 1 });
		_editors.tests.updateOptions({ fontSize: size + 1 });
		document.getElementById("scaffold-pane").style.fontSize = sizeWithPX;
		if (size == 11) {
			// for the default value 11, clear the prefs
			Zotero.Prefs.clear('scaffold.fontSize');
		}
		else {
			Zotero.Prefs.set("scaffold.fontSize", size);
		}
	};

	this.increaseFontSize = function () {
		var currentSize = Zotero.Prefs.get("scaffold.fontSize") || 11;
		this.setFontSize(currentSize + 2);
	};
	this.decreaseFontSize = function () {
		var currentSize = Zotero.Prefs.get("scaffold.fontSize") || 11;
		this.setFontSize(currentSize - 2);
	};

	this.newTranslator = async function (skipSavePrompt) {
		if (!skipSavePrompt && _editors.code.getValue()) {
			let ps = Services.prompt;
			let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
				+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
			let label = document.getElementById('textbox-label').value;
			let index = ps.confirmEx(null,
				"Scaffold",
				`Do you want to save the changes you made to ${label}?`,
				buttonFlags,
				Zotero.getString('general.no'),
				Zotero.getString('general.yes'),
				null, null, {}
			);
			if (index == 1 && !await this.save()) {
				return;
			}
		}

		this.generateTranslatorID();
		document.getElementById('textbox-label').value = 'Untitled';
		document.getElementById('textbox-creator').value
			= document.getElementById('textbox-target').value
			= document.getElementById('textbox-target-all').value
			= document.getElementById('textbox-configOptions').value
			= document.getElementById('textbox-displayOptions').value
			= document.getElementById('textbox-hidden-prefs').value
			= '';
		document.getElementById('textbox-minVersion').value = '5.0';
		document.getElementById('textbox-priority').value = '100';
		document.getElementById('checkbox-import').checked = false;
		document.getElementById('checkbox-export').checked = false;
		document.getElementById('checkbox-web').checked = true;
		document.getElementById('checkbox-search').checked = false;

		_editors.code.setValue('');
		_editors.tests.setValue('');

		this.populateTests();

		document.getElementById('textbox-label').focus();
		_showTab('metadata');
		_updateTitle();
	};

	/*
	 * load translator
	 */
	this.load = async function (translatorID) {
		await _translatorsLoadedPromise;

		var translator;
		if (translatorID === undefined) {
			var io = {};
			io.translatorProvider = _translatorProvider;
			io.url = io.rootUrl = _browser.currentURI.spec;
			window.openDialog("chrome://scaffold/content/load.xhtml",
				"_blank", "chrome,centerscreen,modal,resizable=no", io);
			translator = io.dataOut;
		}
		else {
			translator = _translatorProvider.get(translatorID);
		}

		// No translator was selected in the dialog.
		if (!translator) return false;

		for (var id in _propertyMap) {
			document.getElementById(id).value = translator[_propertyMap[id]] || "";
		}

		//Strip JSON metadata
		var code = await _translatorProvider.getCodeForTranslator(translator);
		var lastUpdatedIndex = code.indexOf('"lastUpdated"');
		var header = code.substr(0, lastUpdatedIndex + 50);
		var m = /^\s*{[\S\s]*?}\s*?[\r\n]+/.exec(header);
		var fixedCode = code.substr(m[0].length);
		// adjust the first line number when there are an unusual number of metadata lines
		_linesOfMetadata = m[0].split('\n').length;
		// load tests into test editing pane
		_loadTestsFromTranslator(fixedCode);
		// clear selection
		_editors.tests.setSelection({
			startLineNumber: 1,
			endLineNumber: 1,
			startColumn: 1,
			endColumn: 1
		});

		// Set up the test running pane
		this.populateTests();

		// remove tests from the translator code before loading into the code editor
		var testStart = fixedCode.indexOf("/** BEGIN TEST CASES **/");
		var testEnd = fixedCode.indexOf("/** END TEST CASES **/");
		if (testStart !== -1 && testEnd !== -1) fixedCode = fixedCode.substr(0, testStart) + fixedCode.substr(testEnd + 23);
		
		// Convert whitespace to tabs
		_editors.code.setValue(normalizeWhitespace(fixedCode.trimEnd()));
		// Then go to line 1
		_editors.code.setPosition({ lineNumber: 1, column: 1 });
		
		// Set Test Input editor language based on translator metadata
		let language = 'plaintext';
		if (translator.translatorType & Zotero.Translator.TRANSLATOR_TYPES.import) {
			if (translator.target.includes('json')) {
				language = 'json';
			}
			else if (translator.target.includes('xml')) {
				language = 'xml';
			}
		}
		else if (translator.translatorType & Zotero.Translator.TRANSLATOR_TYPES.search) {
			language = 'json';
		}
		_editors.importGlobal.editor.setModelLanguage(_editors.import.getModel(), language);
		_editors.import.setPosition({ lineNumber: 1, column: 1 });
		
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
		for (var i = 2; i <= 16; i *= 2) {
			var mod = type % i;
			document.getElementById('checkbox-' + types.shift()).checked = !!mod;
			if (mod) type -= mod;
		}

		this.updateModelMarkers(translator.path);
		_lastModifiedTime = new Date().getTime();
		
		Zotero.Prefs.set('scaffold.lastTranslatorID', translator.translatorID);
		
		_updateTitle();
		return true;
	};

	function _getMetadataObject() {
		var metadata = {
			translatorID: document.getElementById('textbox-translatorID').value,
			label: document.getElementById('textbox-label').value,
			creator: document.getElementById('textbox-creator').value,
			target: document.getElementById('textbox-target').value,
			minVersion: document.getElementById('textbox-minVersion').value,
			maxVersion: '',
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
		if (document.getElementById('checkbox-import').checked) {
			metadata.translatorType += 1;
		}
		if (document.getElementById('checkbox-export').checked) {
			metadata.translatorType += 2;
		}
		if (document.getElementById('checkbox-web').checked) {
			metadata.translatorType += 4;
		}
		if (document.getElementById('checkbox-search').checked) {
			metadata.translatorType += 8;
		}
		
		if (document.getElementById('checkbox-web').checked) {
			// save browserSupport only for web tranlsators
			metadata.browserSupport = "gcsibv";
		}

		var date = new Date();
		metadata.lastUpdated = date.getUTCFullYear()
			+ "-" + Zotero.Utilities.lpad(date.getUTCMonth() + 1, '0', 2)
			+ "-" + Zotero.Utilities.lpad(date.getUTCDate(), '0', 2)
			+ " " + Zotero.Utilities.lpad(date.getUTCHours(), '0', 2)
			+ ":" + Zotero.Utilities.lpad(date.getUTCMinutes(), '0', 2)
			+ ":" + Zotero.Utilities.lpad(date.getUTCSeconds(), '0', 2);

		return metadata;
	}

	/*
	 * save translator to database
	 */
	this.save = async function (updateZotero) {
		var code = _editors.code.getValue();
		var tests = _editors.tests.getValue().trim();
		if (!tests || tests == '[]') tests = '[\n]'; // eslint wants a line break between the brackets

		code = code.trimEnd() + '\n\n/** BEGIN TEST CASES **/\nvar testCases = ' + tests + '\n/** END TEST CASES **/';

		var metadata = _getMetadataObject();
		if (metadata.label === "Untitled") {
			_logOutput("Can't save an untitled translator.");
			return;
		}
		
		var path = await _translatorProvider.save(metadata, code);
		
		if (updateZotero) {
			await Zotero.Translators.save(metadata, code);
			await Zotero.Translators.reinit();
		}

		_lastModifiedTime = new Date().getTime();

		this.updateModelMarkers(path);
		await this.reloadTranslators();
	};

	/**
	 * If an editor is focused, trigger `editorTrigger` in it.
	 * Otherwise, run `fallbackCommand`.
	 */
	this.trigger = function (editorTrigger, fallbackCommand) {
		let activeEditor = _editors[_getActiveEditorName()];
		if (activeEditor) {
			activeEditor.trigger('Scaffold.trigger', editorTrigger);
		}
		else {
			// editMenuOverlay.js
			goDoCommand(fallbackCommand);
		}
	};

	this.handleTabSelect = function (event) {
		if (event.target.tagName != 'tabpanels') {
			return;
		}

		// Focus editor when switching to tab
		var tab = document.getElementById('tabs').selectedItem.id.match(/^tab-(.+)$/)[1];
		switch (tab) {
			case 'import':
			case 'code':
			case 'tests':
				// Keep focus on tab during keyboard navigation
				if (!_tabClicked) break;
				// the select event's default behavior is to focus the selected tab.
				// we don't want to prevent *all* of the event's default behavior,
				// but we do want to focus the editor instead of the tab.
				// so this stupid hack waits 10 ms for event processing to finish
				// before focusing the editor.
				setTimeout(() => {
					document.getElementById(`editor-${tab}`).focus();
					_editors[tab].focus();
				}, 10);
				break;
			default:
				// With a screen reader active, focus may not shift from selected tab
				// to the first focusable input. Explicitly force it if a tab was clicked.
				if (!_tabClicked) break;
				setTimeout(() => {
					Services.focus.moveFocus(window, document.getElementById('tabs').selectedItem, Services.focus.MOVEFOCUS_FORWARD, 0);
				}, 10);
		}

		_tabClicked = false;
		let codeTabBroadcaster = document.getElementById('code-tab-only');
		if (tab == 'code') {
			codeTabBroadcaster.removeAttribute('disabled');
		}
		else {
			codeTabBroadcaster.setAttribute('disabled', true);
		}
	};

	this.handleTestSelect = function (event) {
		let selected = event.target.selectedItems[0];
		if (!selected) return;

		let editImport = document.getElementById('testing_editImport');
		let openURL = document.getElementById('testing_openURL');
		if (selected.dataset.testType == 'web') {
			editImport.setAttribute('disabled', true);
			openURL.removeAttribute('disabled');
		}
		else {
			editImport.removeAttribute('disabled');
			openURL.setAttribute('disabled', true);
		}
	};

	this.listFieldsForItemType = function (itemType) {
		var outputObject = {};
		outputObject.itemType = Zotero.ItemTypes.getName(itemType);
		var typeID = Zotero.ItemTypes.getID(itemType);
		var fieldList = Zotero.ItemFields.getItemTypeFields(typeID);
		for (let field of fieldList) {
			var key = Zotero.ItemFields.getName(field);
			let fieldLocalizedName = Zotero.ItemFields.getLocalizedString(field);
			outputObject[key] = fieldLocalizedName;
		}
		var creatorList = Zotero.CreatorTypes.getTypesForItemType(typeID);
		var creators = [];
		for (let creatorType of creatorList) {
			creators.push({ firstName: "", lastName: "", creatorType: creatorType.name, fieldMode: true });
		}
		outputObject.creators = creators;
		outputObject.attachments = [{ url: "", document: "", title: "", mimeType: "" }];
		outputObject.tags = [{ tag: "" }];
		outputObject.notes = [{ note: "" }];
		outputObject.seeAlso = [];
		return JSON.stringify(outputObject, null, '\t');
	};
	
	/*
	 * add template code
	 */
	this.addTemplate = async function (template, second) {
		switch (template) {
			case "templateNewItem":
				document.getElementById('output').value = this.listFieldsForItemType(second);
				break;
			case "templateAllTypes":
				var typeNames = Zotero.ItemTypes.getTypes().map(t => t.name);
				document.getElementById('output').value = JSON.stringify(typeNames, null, '\t');
				break;
			default: {
				//newWeb, scrapeEM, scrapeRIS, scrapeBibTeX, scrapeMARC
				//These names in the XUL file have to match the file names in template folder.
				let value = Zotero.File.getContentsFromURL(`chrome://scaffold/content/templates/${template}.js`);
				value = value.replace('$$YEAR$$', new Date().getFullYear());
				let cursorOffset = value.indexOf('$$CURSOR$$');
				value = value.replace('$$CURSOR$$', '');

				var selection = _editors.code.getSelection();
				var id = { major: 1, minor: 1 };
				var op = { identifier: id, range: selection, text: value, forceMoveMarkers: true };
				_editors.code.executeEdits("addTemplate", [op]);

				if (cursorOffset != -1) {
					_editors.code.setPosition(_editors.code.getModel().getPositionAt(cursorOffset));
				}

				break;
			}
		}
	};

	/*
	 * run translator
	 */
	this.run = async function (functionToRun) {
		if (document.getElementById('textbox-label').value == 'Untitled') {
			_logOutput("Translator title not set");
			return;
		}

		_clearOutput();

		// Handle generic call run('detect'), run('do')
		if (functionToRun == "detect" || functionToRun == "do") {
			if (document.getElementById('checkbox-web').checked
				&& _browser.currentURI.spec != 'about:blank') {
				functionToRun += 'Web';
			}
			else if (document.getElementById('checkbox-import').checked
				&& _editors.import.getValue().trim()) {
				functionToRun += 'Import';
			}
			else if (document.getElementById('checkbox-export').checked
				&& functionToRun == 'do') {
				functionToRun += 'Export';
			}
			else if (document.getElementById('checkbox-search').checked
				&& _editors.import.getValue().trim()) {
				functionToRun += 'Search';
			}
			else {
				_logOutput('No appropriate detect/do function to run');
				return;
			}
		}

		_logOutput(`Running ${functionToRun}`);
		
		let input = await _getInput(functionToRun);

		if (functionToRun.endsWith('Export')) {
			let numItems = Zotero.getActiveZoteroPane().getSelectedItems().length;
			_logOutput(`Exporting ${numItems} item${numItems == 1 ? '' : 's'} selected in library`);
			_run(functionToRun, input, _selectItems, () => {}, _getTranslatorsHandler(functionToRun), _myExportDone);
		}
		else {
			_run(functionToRun, input, _selectItems, _myItemDone, _getTranslatorsHandler(functionToRun));
		}
	};

	/*
	 * run translator in given mode with given input
	 */
	async function _run(functionToRun, input, selectItems, itemDone, detectHandler, done) {
		let translate;
		let isRemoteWeb = false;
		if (functionToRun == "detectWeb" || functionToRun == "doWeb") {
			translate = new RemoteTranslate({ disableErrorReporting: true });
			isRemoteWeb = true;
			if (!_testTargetRegex(input)) {
				_logOutput("Target did not match " + _getCurrentURI(input));
				if (done) {
					done();
				}
				return;
			}
			await translate.setBrowser(input);
		}
		else if (functionToRun == "detectImport" || functionToRun == "doImport") {
			translate = new Zotero.Translate.Import();
			translate.setString(input);
		}
		else if (functionToRun == "doExport") {
			translate = new Zotero.Translate.Export();
			translate.setItems(input);
		}
		else if (functionToRun == "detectSearch" || functionToRun == "doSearch") {
			translate = new Zotero.Translate.Search();
			translate.setSearch(input);
		}
		translate.setTranslatorProvider(_translatorProvider);
		translate.setHandler("error", _error);
		translate.setHandler("debug", _debug);
		if (done) {
			translate.setHandler("done", done);
		}

		// get translator
		var translator = _getTranslatorFromPane();
		if (functionToRun.startsWith('detect')) {
			if (isRemoteWeb) {
				try {
					translate.setTranslator(translator);
					detectHandler(translate, await translate.detect());
				}
				finally {
					translate.dispose();
				}
			}
			else {
				// don't let target prevent translator from operating
				translator.target = null;
				// generate sandbox
				translate.setHandler("translators", detectHandler);
				// internal hack to call detect on this translator
				translate._potentialTranslators = [translator];
				translate._foundTranslators = [];
				translate._currentState = "detect";
				translate._detect();
			}
		}
		else if (isRemoteWeb) {
			try {
				translate.setHandler("select", selectItems);
				translate.setTranslator(translator);
				let items = await translate.translate({ libraryID: false });
				if (items) {
					for (let item of items) {
						itemDone(translate, item);
					}
				}
			}
			finally {
				translate.dispose();
			}
		}
		else {
			// don't let the detectCode prevent the translator from operating
			translator.detectCode = null;
			translate.setTranslator(translator);
			translate.setHandler("select", selectItems);
			translate.clearHandlers("itemDone");
			translate.clearHandlers("collectionDone");
			translate.setHandler("itemDone", itemDone);
			translate.setHandler("collectionDone", function (obj, collection) {
				_logOutput("Collection: " + collection.name + ", " + collection.children.length + " items");
			});
			translate.translate({
				// disable saving to database
				libraryID: false
			});
		}
	}

	this.runTranslatorOrTests = async function () {
		if (document.getElementById('tabs').selectedItem.id == 'tab-tests'
			&& document.activeElement.id == 'testing-listbox') {
			this.runSelectedTests();
		}
		else {
			this.run('do');
		}
	};

	/*
	 * generate translator GUID
	 */
	this.generateTranslatorID = function () {
		document.getElementById("textbox-translatorID").value = _generateGUID();
	};
	
	/**
	 * Test target regular expression against document URL and log the result
	 */
	this.logTargetRegex = async function () {
		_logOutput(_testTargetRegex(_browser));
	};
	
	/**
	 * Test target regular expression against document URL and return the result
	 */
	function _testTargetRegex(browser) {
		var url = _getCurrentURI(browser);
		
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
		var io = { dataIn: itemList, dataOut: null };
		window.openDialog("chrome://zotero/content/ingester/selectitems.xhtml",
			"_blank", "chrome,modal,centerscreen,resizable=yes", io);

		return io.dataOut;
	}

	/*
	 * called if an error occurs
	 */
	function _error(_obj, _error) {
		// stub: this handler doesn't actually seem to get called by the current
		// translation architecture when a translator throws
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
		delete item.id;
		if (Array.isArray(item.attachments)) {
			for (let attachment of item.attachments) {
				if (attachment.document) {
					attachment.mimeType = 'text/html';
					attachment.url = attachment.document.location?.href;
					delete attachment.document;
				}
				delete attachment.complete;
			}
		}
		_logOutput("Returned item:\n" + Zotero_TranslatorTester._generateDiff(item, _sanitizeItemForDisplay(item)));
	}

	/*
	 * logs string output
	 */
	function _myExportDone({ string }, worked) {
		if (worked) {
			Zotero.debug("Export successful");
			_logOutput("Returned string:\n" + string);
		}
		else {
			Zotero.debug("Export failed");
		}
	}

	/*
	 * returns a 'translators' handler that prints information from detectCode to window
	 */
	function _getTranslatorsHandler(fnName) {
		return (obj, translators) => {
			if (translators && translators.length != 0) {
				if (translators[0].itemType === true) {
					_logOutput(`${fnName} matched`);
				}
				else {
					_logOutput(`${fnName} returned type "${translators[0].itemType}"`);
				}
			}
			else {
				_logOutput(`${fnName} did not match`);
			}
		};
	}

	/*
	 * logs debug info (instead of console)
	 */
	function _logOutput(string) {
		var date = new Date();
		var output = document.getElementById('output');

		if (typeof string != "string") {
			string = fix2028(Zotero.Utilities.varDump(string));
		}

		// Put off actually building the log message and appending it to the console until the next animation frame
		// so as not to slow down translation with repeated layout recalculations triggered by appending text
		// and accessing scrollHeight
		// requestAnimationFrame() callbacks are guaranteed to be called in the order they were set
		requestAnimationFrame(() => {
			if (output.value) output.value += "\n";
			output.value += Zotero.Utilities.lpad(date.getHours(), '0', 2)
				+ ":" + Zotero.Utilities.lpad(date.getMinutes(), '0', 2)
				+ ":" + Zotero.Utilities.lpad(date.getSeconds(), '0', 2)
				+ " " + string.replace(/\n/g, "\n         ");
			// move to end
			output.scrollTop = output.scrollHeight;
		});
	}

	/*
	 * gets import text for import translator
	 */
	function _getImport() {
		var text = _editors.import.getValue();
		return text;
	}

	/*
	 * gets items to export for export translator
	 */
	function _getExport() {
		return Zotero.getActiveZoteroPane().getSelectedItems();
	}

	/*
	 * gets search JSON object for search translator
	 */
	function _getSearch() {
		return JSON.parse(_getImport());
	}

	/*
	 * gets appropriate input for the given type/method
	 */
	async function _getInput(typeOrMethod) {
		typeOrMethod = typeOrMethod.toLowerCase();
		if (typeOrMethod.endsWith('web')) {
			return _browser;
		}
		else if (typeOrMethod.endsWith('import')) {
			return _getImport();
		}
		else if (typeOrMethod.endsWith('export')) {
			return _getExport();
		}
		else if (typeOrMethod.endsWith('search')) {
			return _getSearch();
		}
		return null;
	}

	/*
	 * transfers metadata to the translator object
	 * Replicated from translator.js
	 */
	function _metaToTranslator(translator, metadata) {
		var props = ["translatorID",
			"translatorType",
			"label",
			"creator",
			"target",
			"minVersion",
			"maxVersion",
			"priority",
			"lastUpdated",
			"inRepository",
			"configOptions",
			"displayOptions",
			"browserSupport",
			"targetAll",
			"hiddenPrefs"];
		for (var i = 0; i < props.length; i++) {
			translator[props[i]] = metadata[props[i]];
		}
		
		if (!translator.configOptions) translator.configOptions = {};
		if (!translator.displayOptions) translator.displayOptions = {};
		if (!translator.browserSupport) translator.browserSupport = "g";
	}

	/*
	 * gets translator data from the metadata pane
	 */
	function _getTranslatorFromPane() {
		//create a barebones translator
		var translator = {};
		var metadata = _getMetadataObject(true);

		//copy metadata into the translator object
		_metaToTranslator(translator, metadata);

		metadata = JSON.stringify(metadata, null, "\t") + ";\n";

		translator.code = metadata + "\n" + _editors.code.getValue();

		// make sure translator gets run in browser in Zotero >2.1
		if (Zotero.Translator.RUN_MODE_IN_BROWSER) {
			translator.runMode = Zotero.Translator.RUN_MODE_IN_BROWSER;
		}

		return translator;
	}

	/*
	 * loads the translator's tests from the translator code
	 */
	function _loadTestsFromTranslator(code) {
		var testStart = code.indexOf("/** BEGIN TEST CASES **/");
		var testEnd = code.indexOf("/** END TEST CASES **/");
		if (testStart !== -1 && testEnd !== -1) {
			code = code.substring(testStart + 24, testEnd);
		}

		code = code.replace(/var testCases = /, '').trim();
		// The JSON parser doesn't like final semicolons
		if (code.lastIndexOf(';') == code.length - 1) {
			code = code.slice(0, -1);
		}

		try {
			var testObject = JSON.parse(code);
		}
		catch (e) {
			testObject = [];
		}

		// We don't use _writeTestsToPane here because we want to avoid _stringifyTests,
		// which assumes valid test data and will choke on/incorrectly "fix"
		// weird inputs that the user might want to fix manually.
		_writeToEditor(_editors.tests, JSON.stringify(testObject, null, "\t"));
	}

	/*
	 * loads the translator's tests from the pane
	 */
	function _loadTestsFromPane() {
		try {
			return JSON.parse(_editors.tests.getValue().trim() || '[]');
		}
		catch (e) {
			return null;
		}
	}

	/**
	 * Write text to an editor, overwriting its current value.
	 * This operation can be undone.
	 */
	function _writeToEditor(editor, text) {
		editor.executeEdits('_writeToEditor', [{
			range: editor.getModel().getFullModelRange(),
			text
		}]);
	}

	/*
	 * writes tests back into the translator
	 */
	function _writeTestsToPane(tests) {
		_writeToEditor(_editors.tests, _stringifyTests(tests));
	}
	
	function _confirmCreateExpectedFailTest() {
		return Services.prompt.confirm(null,
			'Detection Failed',
			'Add test ensuring that detection always fails on this page?');
	}

	/**
	 * Mimics most of the behavior of Zotero.Item#fromJSON. Most importantly,
	 * extracts valid fields from item.extra and inserts invalid fields into
	 * item.extra.
	 *
	 * For example,
	 *   { itemType: 'journalArticle', extra: 'DOI: foo' }
	 * becomes
	 *   { itemType: 'journalArticle', DOI: 'foo' }
	 * and
	 *   { itemType: 'book', DOI: 'foo' }
	 * becomes
	 *   { itemType: 'book', extra: 'DOI: foo' }
	 *
	 * @param {any} item
	 * @return {any}
	 */
	function _sanitizeItemForDisplay(item) {
		// try to convert to JSON and back to get rid of undesirable undeletable elements; this may fail
		try {
			item = JSON.parse(JSON.stringify(item));
		}
		catch (e) {}
		
		let itemTypeID = Zotero.ItemTypes.getID(item.itemType);
		
		var setFields = new Set();
		var { itemType, fields: extraFields, /* creators: extraCreators, */ extra }
			= Zotero.Utilities.Internal.extractExtraFields(
				item.extra || '',
				null,
				Object.keys(item)
					// TEMP until we move creator lines to real creators
					.concat('creators')
			);
		// If a different item type was parsed out of Extra, use that instead
		if (itemType && item.itemType != itemType) {
			item.itemType = itemType;
			itemTypeID = Zotero.ItemTypes.getID(itemType);
		}
		
		for (let [field, value] of extraFields) {
			item[field] = value;
			setFields.add(field);
			extraFields.delete(field);
		}
		
		for (let [field, val] of Object.entries(item)) {
			switch (field) {
				case 'itemType':
				case 'accessDate':
				case 'creators':
				case 'attachments':
				case 'notes':
				case 'seeAlso':
					break;

				case 'extra':
					// We set this later
					delete item[field];
					break;

				case 'tags':
					item[field] = Zotero.Translate.Base.prototype._cleanTags(val);
					break;

				// Item fields
				default: {
					let fieldID = Zotero.ItemFields.getID(field);
					if (!fieldID) {
						if (typeof val == 'string') {
							extraFields.set(field, val);
							break;
						}
						delete item[field];
						continue;
					}
					// Convert to base-mapped field if necessary, so that setFields has the base-mapped field
					// when it's checked for values from getUsedFields() below
					let origFieldID = fieldID;
					let origField = field;
					fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(itemTypeID, fieldID) || fieldID;
					if (origFieldID != fieldID) {
						field = Zotero.ItemFields.getName(fieldID);
					}
					if (!Zotero.ItemFields.isValidForType(fieldID, itemTypeID)) {
						extraFields.set(field, val);
						delete item[field];
						continue;
					}
					if (origFieldID != fieldID) {
						item[field] = item[origField];
						delete item[origField];
					}
					setFields.add(field);
				}
			}
		}
		
		if (extraFields.size) {
			for (let field of setFields.keys()) {
				let baseField;
				if (Zotero.ItemFields.isBaseField(field)) {
					baseField = field;
				}
				else if (Zotero.ItemFields.isValidForType(Zotero.ItemFields.getID(field), itemTypeID)) {
					let baseFieldID = Zotero.ItemFields.getBaseIDFromTypeAndField(itemTypeID, field);
					if (baseFieldID) {
						baseField = baseFieldID;
					}
				}

				if (baseField) {
					let mappedFieldNames = Zotero.ItemFields.getTypeFieldsFromBase(baseField, true);
					for (let mappedField of mappedFieldNames) {
						if (extraFields.has(mappedField)) {
							extraFields.delete(mappedField);
						}
					}
				}
			}
			
			//
			// Deduplicate remaining Extra fields
			//
			// For each invalid-for-type base field, remove any mapped fields with the same value
			let baseFields = [];
			for (let field of extraFields.keys()) {
				if (Zotero.ItemFields.getID(field) && Zotero.ItemFields.isBaseField(field)) {
					baseFields.push(field);
				}
			}
			for (let baseField of baseFields) {
				let value = extraFields.get(baseField);
				let mappedFieldNames = Zotero.ItemFields.getTypeFieldsFromBase(baseField, true);
				for (let mappedField of mappedFieldNames) {
					if (extraFields.has(mappedField) && extraFields.get(mappedField) === value) {
						extraFields.delete(mappedField);
					}
				}
			}
			
			// Remove Type-mapped fields from Extra, since 'Type' is mapped to Item Type by citeproc-js
			// and Type values mostly aren't going to be useful for item types without a Type-mapped field.
			let typeFieldNames = Zotero.ItemFields.getTypeFieldsFromBase('type', true)
				.concat('audioFileType');
			for (let typeFieldName of typeFieldNames) {
				if (extraFields.has(typeFieldName)) {
					extraFields.delete(typeFieldName);
				}
			}
		}
		
		if (extra || extraFields.size) {
			item.extra = Zotero.Utilities.Internal.combineExtraFields(extra, extraFields);
		}
		
		return item;
	}
	
	/* sanitizes all items in a test
	 */
	function _sanitizeItemsInTest(test) {
		if (test.items && typeof test.items != 'string' && test.items.length) {
			for (var i = 0, n = test.items.length; i < n; i++) {
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
		function processRow(key, value) {
			let val = _stringifyTests(value, level + 1);
			if (val === undefined) return undefined;
			
			val = val.replace(/\n/g, "\n\t");
			return JSON.stringify('' + key) + ': ' + val;
		}

		if (!level) level = 0;
		
		if (typeof (value) == 'function' || typeof (value) == 'undefined' || value === null) {
			return level ? undefined : '';
		}
		
		if (typeof (value) !== 'object') return JSON.stringify(value, null, "\t");
		
		if (Array.isArray(value)) {
			let str = '[';
			for (let i = 0; i < value.length; i++) {
				let val = _stringifyTests(value[i], level + 1);
				
				if (val === undefined) val = 'undefined';
				else val = val.replace(/\n/g, "\n\t"); // Indent
				
				str += (i ? ',' : '') + "\n\t" + val;
			}
			return str + (str.length > 1 ? "\n]" : ']');
		}
		
		if (!value.itemType) {
			// Not a Zotero.Item object
			let str = '{';
						
			if (level < 2 && value.items) {
				// Test object. Arrange properties in set order
				let order = ['type', 'url', 'input', 'defer', 'detectedItemType', 'items'];
				for (let i = 0; i < order.length; i++) {
					let val = processRow(order[i], value[order[i]]);
					if (val === undefined) continue;
					str += (str.length > 1 ? ',' : '') + '\n\t' + val;
				}
			}
			else {
				for (let i in value) {
					let val = processRow(i, value[i]);
					if (val === undefined) continue;
					str += (str.length > 1 ? ',' : '') + '\n\t' + val;
				}
			}
			
			return str + (str.length > 1 ? "\n}" : '}');
		}
		
		// Zotero.Item object
		const topFields = ['itemType',
			'title',
			'caseName',
			'nameOfAct',
			'subject',
			'creators',
			'date',
			'dateDecided',
			'issueDate',
			'dateEnacted'];
		const bottomFields = ['attachments', 'tags', 'notes', 'seeAlso'];
		let otherFields = Object.keys(value);
		let presetFields = topFields.concat(bottomFields);
		for (let i = 0; i < presetFields.length; i++) {
			let j = otherFields.indexOf(presetFields[i]);
			if (j == -1) continue;
			
			otherFields.splice(j, 1);
		}
		let fields = topFields.concat(otherFields.sort()).concat(bottomFields);
		
		let str = '{';
		for (let i = 0; i < fields.length; i++) {
			let rawVal = value[fields[i]];
			if (!rawVal) continue;
			
			let val;
			if (fields[i] == 'tags') {
				val = _stringifyTests(rawVal.sort(), level + 1);
			}
			else {
				val = _stringifyTests(rawVal, level + 1);
			}
			
			if (val === undefined) continue;
			
			val = val.replace(/\n/g, "\n\t");
			str += (str.length > 1 ? ',' : '') + "\n\t" + JSON.stringify(fields[i]) + ': ' + val;
		}
		
		return str + "\n}";
	}
	
	/*
	 * adds a new test from the current input/translator
	 * web or import only for now
	 */
	this.saveTestFromCurrent = async function (type) {
		_logOutput(`Creating ${type} test...`);

		try {
			let test = await this.constructTestFromCurrent(type);
			_writeTestsToPane([..._loadTestsFromPane(), test]);
		}
		catch (e) {
			_logOutput('Creation failed');
			return;
		}

		_showTab('tests');
		let listBox = document.getElementById('testing-listbox');
		listBox.selectedIndex = listBox.getRowCount() - 1;
		listBox.focus();
	};

	this.constructTestFromCurrent = async function (type) {
		_clearOutput();
		if ((type === "web" && !document.getElementById('checkbox-web').checked)
			|| (type === "import" && !document.getElementById('checkbox-import').checked)
			|| (type === "search" && !document.getElementById('checkbox-search').checked)) {
			_logOutput(`Translator does not support ${type} tests`);
			return Promise.reject(new Error());
		}

		if (type == 'export') {
			return Promise.reject(new Error(`Test of type export cannot be created`));
		}

		let input = await _getInput(type);

		if (type == "web") {
			let translate = new RemoteTranslate({ disableErrorReporting: true });
			try {
				await translate.setBrowser(_browser);
				await translate.setTranslatorProvider(_translatorProvider);
				translate.setTranslator(_getTranslatorFromPane());
				translate.setHandler("debug", _debug);
				translate.setHandler("error", _error);
				translate.setHandler("newTestDetectionFailed", _confirmCreateExpectedFailTest);
				let newTest = await translate.newTest();
				if (!newTest) {
					throw new Error('Creation failed');
				}
				newTest = _sanitizeItemsInTest(newTest);
				return newTest;
			}
			finally {
				translate.dispose();
			}
		}
		else if (type == "import" || type == "search") {
			let test = { type, input: input, items: [] };

			// TranslatorTester doesn't handle these correctly, so we do it manually
			return new Promise(
				resolve => _run(`do${type == 'import' ? 'Import' : 'Search'}`, input, null, function (obj, item) {
					if (item) {
						test.items.push(Zotero_TranslatorTester._sanitizeItem(item));
					}
				}, null, function () {
					resolve(test);
				})
			);
		}

		return Promise.reject(new Error('Invalid type: ' + type));
	};

	/*
	 * populate tests pane and url options in browser pane
	 */
	this.populateTests = function () {
		function wrapWithHBox(elem, { flex = undefined, width = undefined } = {}) {
			let hbox = document.createXULElement('hbox');
			hbox.append(elem);
			if (flex !== undefined) hbox.setAttribute('flex', flex);
			if (width !== undefined) hbox.style.width = width + 'px';
			return hbox;
		}

		let tests = _loadTestsFromPane();
		let validateTestsBroadcaster = document.getElementById('validate-tests');
		if (tests === null) {
			validateTestsBroadcaster.setAttribute('disabled', true);
			return;
		}
		else {
			validateTestsBroadcaster.removeAttribute('disabled');
		}

		let browserURL = document.getElementById("browser-url");
		let currentURL = browserURL.value;
		// browserURL.removeAllItems();
		browserURL.value = currentURL;

		let listBox = document.getElementById("testing-listbox");
		let count = listBox.getRowCount();
		let oldStatuses = {};
		for (let i = 0; i < count; i++) {
			let item = listBox.getItemAtIndex(i);
			let [, statusCell] = item.children;
			oldStatuses[item.dataset.testString] = statusCell.getAttribute('value');
		}

		let testIndex = 0;
		for (let test of tests) {
			let testString = _stringifyTests(test, 1);

			// try to reuse old rows
			let item = testIndex < count
				? listBox.getItemAtIndex(testIndex)
				: document.createXULElement('richlistitem');

			item.innerHTML = ''; // clear children/content if reusing

			let input = document.createXULElement('label');
			input.append(getTestLabel(test));
			item.appendChild(wrapWithHBox(input, { flex: 1 }));

			let status = document.createXULElement('label');
			status.append(oldStatuses[testString] || 'Not run');
			item.appendChild(wrapWithHBox(status, { width: 150 }));

			let defer = document.createXULElement('checkbox');
			defer.checked = test.defer;
			defer.disabled = true;
			item.appendChild(wrapWithHBox(defer, { width: 30 }));

			item.dataset.testString = testString;
			item.dataset.testType = test.type;

			if (testIndex >= count) {
				listBox.appendChild(item);
			}

			// if (test.type == 'web') {
			// 	browserURL.appendItem(test.url);
			// }

			testIndex++;
		}

		// remove old rows that we didn't reuse
		while (listBox.getItemAtIndex(testIndex)) {
			listBox.getItemAtIndex(testIndex).remove();
		}
	};

	/*
	 * Delete selected test(s)
	 */
	this.deleteSelectedTests = function () {
		var listbox = document.getElementById("testing-listbox");
		var indicesToRemove = [...listbox.selectedItems].map(item => listbox.getIndexOfItem(item));

		let tests = _loadTestsFromPane();
		indicesToRemove.forEach(i => tests.splice(i, 1));
		_writeTestsToPane(tests);

		this.populateTests();
	};

	/*
	 * Load the import input for the first selected test in the import pane,
	 * from the UI.
	 */
	this.editImportFromTest = function () {
		var listbox = document.getElementById("testing-listbox");
		var item = listbox.selectedItems[0];
		var test = JSON.parse(item.dataset.testString);
		if (test.input === undefined) {
			_logOutput("Can't edit input of a non-import/search test.");
		}
		_writeToEditor(_editors.import,
			test.type == 'import'
				? test.input
				: JSON.stringify(test.input, null, '\t'));
		_editors.import.setSelection({
			startLineNumber: 1,
			endLineNumber: 1,
			startColumn: 1,
			endColumn: 1
		});
		_showTab('import');
	};
	
	/*
	 * Copy the url or data of the first selected test to the clipboard.
	 */
	this.copyToClipboard = function () {
		var listbox = document.getElementById("testing-listbox");
		var item = listbox.selectedItems[0];
		var url = item.getElementsByTagName("label")[0].getAttribute("value");
		var test = JSON.parse(item.dataset.testString);
		var urlOrData = (test.input !== undefined) ? test.input : url;
		if (typeof urlOrData !== 'string') {
			urlOrData = JSON.stringify(urlOrData, null, '\t');
		}
		Zotero.Utilities.Internal.copyTextToClipboard(urlOrData);
	};
	
	/**
	 * Open the url of the first selected test in the browser (Browser tab or
	 * the system's default browser).
	 * @param {boolean} openExternally whether to open in the default browser
	**/
	this.openURL = function (openExternally) {
		var listbox = document.getElementById("testing-listbox");
		var item = listbox.selectedItems[0];
		var url = item.getElementsByTagName("label")[0].textContent;
		if (openExternally) {
			Zotero.launchURL(url);
		}
		else {
			_browser.loadURI(Services.io.newURI(url), {
				triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
			});
			_showTab('browser');
		}
	};

	this.runTests = function (tests, callback) {
		callback = callback || (() => {});

		_clearOutput();

		let testsByType = {
			import: [],
			export: [],
			web: [],
			search: []
		};

		for (let test of tests) {
			testsByType[test.type].push(test);
		}

		let rememberCookies = document.getElementById('checkbox-remember-cookies').checked;

		for (let [type, testsOfType] of Object.entries(testsByType)) {
			if (testsOfType.length) {
				let tester = new Zotero_TranslatorTester(
					_getTranslatorFromPane(),
					type,
					_debug,
					_translatorProvider
				);
				if (!rememberCookies) {
					tester.setCookieSandbox(new Zotero.CookieSandbox());
				}
				tester.setTests(testsOfType);
				tester.runTests(callback);
			}
		}
	};
	
	/*
	 * Run selected test(s)
	 */
	this.runSelectedTests = function () {
		var listbox = document.getElementById("testing-listbox");
		var items = listbox.selectedItems;
		if (!items || items.length == 0) return; // No action if nothing selected
		var tests = [];
		for (let item of items) {
			item.getElementsByTagName("label")[1].textContent = "Running";
			var test = JSON.parse(item.dataset.testString);
			test["ui-item"] = ContentDOMReference.get(item);
			tests.push(test);
		}

		this.runTests(tests, (obj, test, status, message) => {
			ContentDOMReference.resolve(test["ui-item"]).getElementsByTagName("label")[1].textContent = message;
		});
	};

	this.updateTests = function (tests, testUpdatedCallback) {
		_clearOutput();

		var updater = new TestUpdater(tests);
		return new Promise(resolve => updater.updateTests(
			testUpdatedCallback,
			resolve
		));
	};
	
	/*
	 * Update selected test(s)
	 */
	this.updateSelectedTests = async function () {
		var listbox = document.getElementById("testing-listbox");
		var items = [...listbox.selectedItems];
		if (!items || items.length == 0) return; // No action if nothing selected
		var itemIndices = items.map(item => listbox.getIndexOfItem(item));
		var tests = [];
		for (let item of items) {
			item.getElementsByTagName("label")[1].textContent = "Updating";
			var test = JSON.parse(item.dataset.testString);
			tests.push(test);
		}

		var testsDone = 0;
		await this.updateTests(tests,
			(newTest) => {
				let message;
				// Assume sequential. TODO: handle this properly via test ID of some sort
				if (newTest) {
					message = "Test updated";
					items[testsDone].dataset.testString = _stringifyTests(newTest, 1);
					tests[testsDone] = newTest;
				}
				else {
					message = "Update failed";
				}
				items[testsDone].getElementsByTagName("label")[1].textContent = message;
				testsDone++;
			});

		let allTests = _loadTestsFromPane();
		for (let [i, test] of Object.entries(tests)) {
			allTests[itemIndices[i]] = test;
		}
		_writeTestsToPane(allTests);
		_logOutput("Tests updated.");
	};

	this.populateLinterMenu = function () {
		let status = 'Path: ' + getDefaultESLintPath();
		let toggle = Zotero.Prefs.get('scaffold.eslint.enabled') ? 'Disable' : 'Enable';
		document.getElementById('menu_eslintStatus').label = status;
		document.getElementById('menu_toggleESLint').label = toggle;
	};

	this.toggleESLint = async function () {
		Zotero.Prefs.set('scaffold.eslint.enabled', !Zotero.Prefs.get('scaffold.eslint.enabled'));
		await getESLintPath();
	};

	this.showTabNumbered = function (tabNumber) {
		let tabBox = document.getElementById('left-tabbox');
		let numTabs = tabBox.querySelectorAll('tabs > tab').length;
		if (tabNumber > numTabs) {
			tabNumber = numTabs;
		}

		tabBox.selectedIndex = tabNumber - 1;
	};
	
	var TestUpdater = function (tests) {
		this.testsToUpdate = tests.slice();
		this.numTestsTotal = this.testsToUpdate.length;
		this.newTests = [];
	};
	
	TestUpdater.prototype.updateTests = function (testDoneCallback, doneCallback) {
		this.testDoneCallback = testDoneCallback || function () { /* no-op */ };
		this.doneCallback = doneCallback || function () { /* no-op */ };
		
		this._updateTests();
	};
	
	TestUpdater.prototype._updateTests = async function () {
		if (!this.testsToUpdate.length) {
			this.doneCallback(this.newTests);
			return;
		}
		
		var test = this.testsToUpdate.shift();
		_logOutput("Updating test " + (this.numTestsTotal - this.testsToUpdate.length));
		
		if (test.type == 'web') {
			_logOutput("Loading web page from " + test.url);
			
			const { HiddenBrowser } = ChromeUtils.import("chrome://zotero/content/HiddenBrowser.jsm");
			let browser = new HiddenBrowser({
				docShell: { allowMetaRedirects: true }
			});
			try {
				await browser.load(test.url, {
					requireSuccessfulStatus: true
				});

				if (test.defer) {
					_logOutput("Waiting " + (Zotero_TranslatorTester.DEFER_DELAY / 1000)
						+ " second(s) for page content to settle");
					await Zotero.Promise.delay(Zotero_TranslatorTester.DEFER_DELAY);
				}
				else {
					// Wait just a bit for things to settle
					await Zotero.Promise.delay(1000);
				}

				if (browser.currentURI.spec != test.url) {
					_logOutput("Page URL differs from test. Will be updated. " + browser.currentURI.spec);
				}

				let translate = new RemoteTranslate({ disableErrorReporting: true });
				try {
					await translate.setBrowser(browser);
					await translate.setTranslatorProvider(_translatorProvider);
					translate.setTranslator(_getTranslatorFromPane());
					translate.setHandler("debug", _debug);
					translate.setHandler("error", _error);
					translate.setHandler("newTestDetectionFailed", _confirmCreateExpectedFailTest);
					
					let newTest = await translate.newTest();
					newTest = _sanitizeItemsInTest(newTest);
					if (test.defer) {
						newTest.defer = true;
					}
					
					this.newTests.push(newTest);
					this.testDoneCallback(newTest);
					this._updateTests();
				}
				finally {
					translate.dispose();
				}
			}
			catch (e) {
				Zotero.logError(e);
				this.newTests.push(false);
				this.testDoneCallback(false);
				this._updateTests();
			}
			finally {
				if (browser) browser.destroy();
			}
		}
		else {
			test.items = [];

			const methods = {
				import: 'doImport',
				export: 'doExport', // not supported, will error
				search: 'doSearch'
			};

			// Re-runs the test.
			// TranslatorTester doesn't handle these correctly, so we do it manually
			_run(methods[test.type], test.input, null, (obj, item) => {
				if (item) {
					test.items.push(Zotero_TranslatorTester._sanitizeItem(item));
				}
			}, null, () => {
				if (!test.items.length) test = false;
				this.newTests.push(test);
				this.testDoneCallback(test);
				this._updateTests();
			});
		}
	};

	/*
	 * Normalize whitespace to the Zotero norm of tabs
	 */
	function normalizeWhitespace(text) {
		return text.replace(/^[ \t]+/gm, function (str) {
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
		for (var i = 0; i < 16; i++) {
			var bite = Math.floor(Math.random() * 255);

			if (i == 4 || i == 6 || i == 8 || i == 10) {
				guid += "-";

				// version
				if (i == 6) bite = bite & 0x0f | 0x40;
				// variant
				if (i == 8) bite = bite & 0x3f | 0x80;
			}
			var str = bite.toString(16);
			guid += str.length == 1 ? '0' + str : str;
		}
		return guid;
	}

	function _getCurrentURI(browser) {
		return Zotero.Proxies.proxyToProper(browser.currentURI.spec);
	}

	function _findTestObjectTops(monaco, model) {
		let tokenization = monaco.editor.tokenize(model.getValue(), 'json');

		let arrayLevel = 0;
		let objectLevel = 0;

		let ranges = [];

		for (let line in tokenization) {
			line = +line; // string keys
			for (let token of tokenization[line]) {
				if (token.type == 'delimiter.array.json' || token.type == 'delimiter.bracket.json') {
					let range = {
						startLineNumber: line + 1,
						startColumn: token.offset + 1,
						endLineNumber: line + 1,
						endColumn: token.offset + 2
					};
					let bracket = model.getValueInRange(range);

					if (bracket == '[') {
						arrayLevel++;
					}
					else if (bracket == ']') {
						arrayLevel--;
						continue; // we only want to record opening brackets
					}
					else if (bracket == '{') {
						objectLevel++;
					}
					else if (bracket == '}') {
						objectLevel--;
						continue;
					}

					if (arrayLevel == 1 && objectLevel == 1) {
						ranges.push(range);
					}
				}
			}
		}

		return ranges;
	}

	function getDefaultESLintPath() {
		return PathUtils.join(Scaffold_Translators.getDirectory(), 'node_modules', '.bin', 'teslint');
	}

	async function getESLintPath() {
		if (!Zotero.Prefs.get('scaffold.eslint.enabled')) {
			return null;
		}

		let eslintPath = getDefaultESLintPath();

		while (!await IOUtils.exists(eslintPath)) {
			let ps = Services.prompt;
			let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
				+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING
				+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_CANCEL;

			let index = ps.confirmEx(null,
				"Scaffold",
				"Zotero uses ESLint to enable code suggestions and error checking, "
					+ "but it wasn't found in the selected translators directory.\n\n"
					+ "You can install it from the command line:\n\n"
					+ `  cd ${Scaffold_Translators.getDirectory()}\n`
					+ "  npm install\n\n",
				buttonFlags,
				"Try Again",
				"Disable Error Checking",
				null, null, {}
			);
			if (index == 1) {
				Zotero.Prefs.set('scaffold.eslint.enabled', false);
				return null;
			}
			else if (index == 2) {
				return null;
			}
		}
		return eslintPath;
	}

	async function runESLint(translatorPath) {
		if (!translatorPath) return [];

		let eslintPath = await getESLintPath();
		if (!eslintPath) return [];

		Zotero.debug('Running ESLint');
		try {
			let proc = await Subprocess.call({
				command: eslintPath,
				arguments: ['--format', 'json', '--', translatorPath],
			});
			let lintOutput = '';
			let chunk;
			while ((chunk = await proc.stdout.readString())) {
				lintOutput += chunk;
			}
			return JSON.parse(lintOutput);
		}
		catch (e) {
			Zotero.logError(e);
		}
		return [];
	}

	function eslintOutputToModelMarkers(output) {
		let result = output[0];
		if (!result) return [];

		return result.messages.map(message => ({
			startLineNumber: message.line - _linesOfMetadata + 1,
			startColumn: message.column,
			endLineNumber: message.endLine - _linesOfMetadata + 1,
			endColumn: message.endColumn,
			message: message.message,
			severity: message.severity * 4,
			source: 'ESLint',
			tags: [
				message.ruleId || '-'
			]
		}));
	}

	function getTestLabel(test) {
		switch (test.type) {
			case 'import':
				return test.input.substr(0, 80);
			case 'web':
				return test.url;
			case 'search':
				return JSON.stringify(test.input).substr(0, 80);
			default:
				return `Unknown type: ${test.type}`;
		}
	}

	function _showTab(tab) {
		document.getElementById('tabs').selectedItem = document.getElementById(`tab-${tab}`);
	}

	function _getActiveEditorName() {
		let activeElement = document.activeElement;
		if (activeElement && activeElement.id && activeElement.id.startsWith('editor-')) {
			return activeElement.id.substring(7);
		}
		return null;
	}
	
	async function _getGitBranchName() {
		let gitPath = await Subprocess.pathSearch('git');
		if (!gitPath) return null;
		
		let dir = Scaffold_Translators.getDirectory();
		if (!dir) return null;
		
		let proc = await Subprocess.call({
			command: gitPath,
			arguments: ['rev-parse', '--abbrev-ref', 'HEAD'],
			workdir: dir,
		});
		let output = '';
		let chunk;
		while ((chunk = await proc.stdout.readString())) {
			output += chunk;
		}
		return output.trim();
	}
	
	async function _updateTitle() {
		let title = 'Scaffold';

		let label = document.getElementById('textbox-label').value;
		if (label) {
			title += ' - ' + label;
		}
		
		try {
			let branch = await _getGitBranchName();
			if (branch) {
				title += ' (' + branch + ')';
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		
		document.title = title;
	}
};

window.addEventListener("load", function (e) {
	Scaffold.onLoad(e);
}, false);
