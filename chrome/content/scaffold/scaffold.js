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

var { Subprocess } = ChromeUtils.importESModule("resource://gre/modules/Subprocess.sys.mjs");
var { RemoteTranslate } = ChromeUtils.importESModule("chrome://zotero/content/RemoteTranslate.mjs");

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');
var { TranslatorTester } = ChromeUtils.importESModule('chrome://zotero/content/xpcom/translate/testTranslators/translatorTester.mjs');
var { Test } = ChromeUtils.importESModule('chrome://zotero/content/xpcom/translate/testTranslators/test.mjs');
var { ZoteroWebTranslationEnvironment } = ChromeUtils.importESModule('chrome://scaffold/content/zoteroWebTranslationEnvironment.mjs');

var { CompletionCopilot, registerCompletion } = ChromeUtils.importESModule('resource://zotero/monacopilot.mjs');

var lazy = {};
ChromeUtils.defineLazyGetter(lazy, 'shellPathPromise', () => {
	return Zotero.Utilities.Internal.subprocess(Services.env.get('SHELL'), ['-c', 'echo $PATH'])
		.then(s => s.trimEnd());
});

// Text to display in monaco editors when they are empty
const CODE_TAB_INFO = `1. Use Tools > Insert Template menu option or the "+" icon above to insert a template for the translator.
2. Use Run detect* and Run do* buttons in the toolbar to run your translator on the URL loaded in the browser tab.
3. For reference, use Help > List All Item Types to list all available Zotero item types that your translator can create.
4. For reference, use Help > List all Fields for Item Type to log the fields of the Zotero item(s) your translator is creating.`;
const TESTS_TAB_INFO = ` After the translator is implemented in the code tab, use "Create Web Test" to run the translator on the URL loaded in the browser and save the expected output here.`;

var Scaffold = new function () {
	var _browser;
	var _translatorsLoadedPromise;
	var _translatorProvider = null;
	var _loadedTranslatorPath = null;
	var _lastModifiedTime = 0;
	var _needRebuildTranslatorSuggestions = true;
	var _invalidateCodeLenses = null;
	var _copilot;
	var _prefsObserverID;
	
	var _editors = {};

	var _browserProgressListener = null;
	var _browserLoadedURL = false;

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

	/** @type {{
	 * 		test: Test;
	 * 		testString: string;
	 * 		updatedTestString?: string;
	 * 		status?: string;
	 * 		previews: ScaffoldItemPreview[];
	 * }[]} */
	var _testData = [];
	var _linesOfMetadata = 15;

	this.handleLoad = async function () {
		_browser = document.getElementById('browser');

		window.messageManager.addMessageListener('Scaffold:Load', ({ data }) => {
			document.getElementById("browser-url").value = data.url;
		});

		window.messageManager.loadFrameScript('chrome://scaffold/content/content.js', true);
		
		let browserUrl = document.getElementById("browser-url");
		browserUrl.addEventListener('keydown', (e) => {
			if (e.key == 'Enter') {
				this.loadURLInBrowser();
			}
		});
		// Progress listener to record when the webpage is loaded
		_browserProgressListener = {
			QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"]),
			onStateChange(webProgress, request, stateFlags, status) {
				let done = stateFlags & Ci.nsIWebProgressListener.STATE_STOP;
				let failed = status && status !== Cr.NS_OK;
				// Hide the spinner when done
				if (done) {
					_setBrowserLoadingIndicator(false);
				}
				// Record if the page has been successfully loaded
				_browserLoadedURL = done && !failed;
			},
		};
		_browser.addProgressListener(_browserProgressListener, Ci.nsIWebProgress.NOTIFY_STATE_ALL);

		document.getElementById('tabpanels').addEventListener('select', event => this.handleTabSelect(event));
		document.getElementById('tabs').addEventListener('mousedown', (event) => {
			// Record if tab selection will happen due to a mouse click vs keyboard nav.
			if (event.clientX === 0 && event.clientY === 0) return;
			document.getElementById('tabs').setAttribute("clicked", true);
		}, true);
		// Record that click has happened for better focus-ring handling in the stylesheet
		document.addEventListener("mouseup", (_) => {
			document.getElementById('tabs').removeAttribute("clicked");
		});
		
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
			codeWin.loadMonaco({ language: 'javascript', emptyOverlayMessage: CODE_TAB_INFO }).then(({ monaco, editor }) => {
				_editors.codeGlobal = monaco;
				_editors.code = editor;
			}),
			testsWin.loadMonaco({
				language: 'json',
				// Tests might contain \u2028/\u2029 - don't pop up a warning
				unusualLineTerminators: 'off',
				emptyOverlayMessage: TESTS_TAB_INFO
			}).then(({ monaco, editor }) => {
				_editors.testsGlobal = monaco;
				_editors.tests = editor;
			}),
		]);

		this.initImportEditor();
		this.initCodeEditor();
		this.initTestsEditor();

		this.addEditorKeydownHandlers(_editors.import);
		this.addEditorKeydownHandlers(_editors.code);
		this.addEditorKeydownHandlers(_editors.tests);

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
		
		_prefsObserverID = Zotero.Prefs.registerObserver('scaffold.completions.mistralAPIKey', _handleAPIKeyChange);
		_handleAPIKeyChange();
	};
	
	this.handleUnload = function () {
		Zotero.Prefs.unregisterObserver(_prefsObserverID);
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
		model.onDidChangeContent(() => this.updateModelMarkers());

		let tsLib = await Zotero.File.getContentsAsync(
			PathUtils.join(Scaffold_Translators.getDirectory(), 'index.d.ts'));
		let tsLibPath = 'ts:filename/index.d.ts';
		monaco.languages.typescript.javascriptDefaults.addExtraLib(tsLib, tsLibPath);
		// this would allow peeking:
		//   monaco.editor.createModel(tsLib, 'typescript', monaco.Uri.parse(tsLibPath));
		// but it doesn't currently seem to work

		registerCompletion(monaco, editor, {
			language: 'javascript',
			endpoint: 'dummy',
			async requestHandler({ body }) {
				if (!_copilot) {
					return { completion: null };
				}
				
				let metadata = _getMetadataObject();
				Object.assign(body.completionMetadata, {
					filename: `${metadata.label}.js [body]`,
					technologies: ['zotero/translators'],
					relatedFiles: [
						{
							path: 'index.d.ts',
							content: tsLib
						},
						{
							path: `${metadata.label}.js [metadata]`,
							content: JSON.stringify(metadata, null, '\t')
						},
						metadata.translatorType & Zotero.Translator.TRANSLATOR_TYPES.import && {
							path: `example_import.${metadata.target || 'dat'}`,
							content: _getImport()
						},
						metadata.translatorType & Zotero.Translator.TRANSLATOR_TYPES.search && {
							path: `example_search.json`,
							content: _getImport()
						},
						{
							path: _browser.currentURI.spec,
							content: await _browser.browsingContext.currentWindowGlobal.getActor('PageData')
								.sendQuery('documentHTML')
						}
					].filter(Boolean)
				});
				return _copilot.complete({ body });
			},
		});
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
		let runCommand = editor.addCommand(
			0,
			async (_ctx, testIndices) => {
				testIndices = testIndices || [..._loadTestsFromPane().keys()];
				await this.runTests(testIndices);
			},
			'');

		let applyUpdatesCommand = editor.addCommand(
			0,
			(_ctx, testIndices) => {
				testIndices = testIndices || [..._loadTestsFromPane().keys()];
				this.updateTests(testIndices);
			},
			'');

		return {
			onDidChange: (callback) => {
				_invalidateCodeLenses = callback;
				return { dispose() {} };
			},
			
			provideCodeLenses: (model, _token) => {
				let testsWithUpdates = new Set();
				for (let [testIndex, { updatedTestString }] of _testData.entries()) {
					if (updatedTestString) {
						testsWithUpdates.add(testIndex);
					}
				}
				
				let lenses = [];

				let firstChar = {
					startLineNumber: 1,
					startColumn: 1,
					endLineNumber: 1,
					endColumn: 1
				};
				if (testsWithUpdates.size) {
					lenses.push({
						range: firstChar,
						command: {
							id: runCommand,
							title: 'Run All'
						}
					});
				}
				
				if (testsWithUpdates.size) {
					lenses.push({
						range: firstChar,
						command: {
							id: applyUpdatesCommand,
							title: 'Apply All Updates'
						}
					});
				}

				for (let [testIndex, range] of _findTestObjectTops(monaco, model).entries()) {
					lenses.push({
						range: range,
						command: {
							id: runCommand,
							title: 'Run',
							arguments: [[testIndex]]
						}
					});

					if (testsWithUpdates.has(testIndex)) {
						lenses.push({
							range: range,
							command: {
								id: applyUpdatesCommand,
								title: 'Apply Updates',
								arguments: [[testIndex]]
							}
						});
					}
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

	this.updateModelMarkers = Zotero.Utilities.debounce(async function () {
		let modelVersionId = _editors.code.getModel().getVersionId();
		let output = await runESLint();
		let markers = eslintOutputToModelMarkers(output, modelVersionId);
		_editors.codeGlobal.editor.setModelMarkers(_editors.code.getModel(), 'eslint', markers);
	}, 200);

	this.setFontSize = function (size) {
		var sizeWithPX = size + 'px';
		_editors.import.updateOptions({ fontSize: size + 1 }); // editor font needs to be a little bigger
		_editors.code.updateOptions({ fontSize: size + 1 });
		_editors.tests.updateOptions({ fontSize: size + 1 });
		document.getElementById("scaffold-pane").style.fontSize = sizeWithPX;
		if (size == 13) {
			// for the default value 13, clear the prefs
			Zotero.Prefs.clear('scaffold.fontSize');
		}
		else {
			Zotero.Prefs.set("scaffold.fontSize", size);
		}
	};

	this.increaseFontSize = function () {
		var currentSize = Zotero.Prefs.get("scaffold.fontSize") || 13;
		this.setFontSize(currentSize + 2);
	};
	this.decreaseFontSize = function () {
		var currentSize = Zotero.Prefs.get("scaffold.fontSize") || 13;
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
		// Use a sample regex as a default target
		document.getElementById("textbox-target").value = "^https?://www\\.example\\.org/";

		_editors.code.setValue('');
		_editors.tests.setValue('');

		this.populateTests();

		document.getElementById('textbox-label').focus();
		_showTab('metadata');
		
		_lastModifiedTime = new Date().getTime();
		_loadedTranslatorPath = null;
		
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

		for (let id in _propertyMap) {
			document.getElementById(id).value = translator[_propertyMap[id]] || "";
		}

		let rawCode = await _translatorProvider.getCodeForTranslator(translator);
		let { metadata, code, testCases } = _splitTranslator(rawCode);
		// Adjust the first line number
		_linesOfMetadata = metadata.split('\n').length;
		
		// Convert whitespace to tabs
		_editors.code.setValue(code);
		// Then go to line 1
		_editors.code.setPosition({ lineNumber: 1, column: 1 });
		
		// We don't use _writeTestsToPane here because we want to avoid _stringifyTests,
		// which assumes valid test data and will choke on/incorrectly "fix"
		// weird inputs that the user might want to fix manually.
		_writeToEditor(_editors.tests, testCases);
		// Clear selection
		_editors.tests.setSelection({
			startLineNumber: 1,
			endLineNumber: 1,
			startColumn: 1,
			endColumn: 1
		});
		// Set up the test running pane
		this.populateTests();

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

		_loadedTranslatorPath = translator.path;
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
	
	function _getCode() {
		var code = _editors.code.getValue();
		var tests = _editors.tests.getValue().trim();
		if (!tests || tests == '[]') tests = '[\n]'; // eslint wants a line break between the brackets

		code = code.trimEnd() + '\n\n/** BEGIN TEST CASES **/\nvar testCases = ' + tests + '\n/** END TEST CASES **/';
		return code;
	}

	/*
	 * save translator to database
	 */
	this.save = async function (updateZotero) {
		var metadata = _getMetadataObject();
		var code = _getCode();
		if (metadata.label === "Untitled") {
			_logOutput("Can't save an untitled translator.");
			return;
		}
		
		let newPath = _translatorProvider.getSavePath(metadata);
		if (_loadedTranslatorPath && newPath !== _loadedTranslatorPath) {
			try {
				await Zotero.File.removeIfExists(_loadedTranslatorPath);
			}
			catch (e) {
				Zotero.logError(e);
			}
			_loadedTranslatorPath = newPath;
			
			_logOutput(`Renamed to ${PathUtils.filename(newPath)}.`);
		}
		
		await _translatorProvider.save(metadata, code);
		
		if (updateZotero) {
			await Zotero.Translators.save(metadata, code);
			await Zotero.Translators.reinit();
		}

		_lastModifiedTime = new Date().getTime();

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

		var tabs = document.getElementById('tabs');
		var tab = tabs.selectedItem.id.match(/^tab-(.+)$/)[1];
		let tabPanel = tabs.tabbox.selectedPanel;
		// The select event's default behavior is to focus the selected tab.
		// we don't want to prevent *all* of the event's default behavior,
		// but we do want to focus an element inside of tabpanel instead of the tab
		// (unless tabs are being navigated via keyboard)
		// so this stupid hack focuses the desired element after skipping a tick
		if (tabs.hasAttribute('clicked')) {
			setTimeout(() => {
				let toFocus = tabPanel.querySelector('[focus-on-tab-select]');
				if (toFocus) {
					toFocus.focus();
					// Activate editor that is being focused, if any
					if (toFocus.id.startsWith('editor-')) {
						_editors[tab].focus();
					}
				}
				else {
					// If no specific element set, just tab into the panel
					setTimeout(() => {
						Services.focus.moveFocus(window, tabs.selectedItem, Services.focus.MOVEFOCUS_FORWARD, 0);
					});
				}
			});
		}
		let codeTabBroadcaster = document.getElementById('code-tab-only');
		if (tab == 'code') {
			codeTabBroadcaster.removeAttribute('disabled');
		}
		else {
			codeTabBroadcaster.setAttribute('disabled', true);
		}
		
		if (tab == 'tests') {
			this.handleTestingListboxSelect();
		}
	};

	this.handleTestingContextMenuShowing = function () {
		let listbox = document.getElementById('testing-listbox');
		let selectedItems = Array.from(listbox.selectedItems);
		if (!selectedItems.length) return;
		let selectedIndices = selectedItems.map(item => listbox.getIndexOfItem(item));

		let editImport = document.getElementById('testing-editImport');
		let openURL = document.getElementById('testing-openURL');
		let applyUpdates = document.getElementById('testing-applyUpdates');
		if (selectedItems.length > 1) {
			editImport.disabled = true;
			openURL.disabled = true;
		}
		else {
			let { test } = _testData[selectedIndices[0]];
			editImport.disabled = test.type === 'web';
			openURL.disabled = test.type !== 'web';
		}
		applyUpdates.disabled = selectedIndices.some(idx => !_testData[idx].updatedTestString);
	};
	
	this.handleTestingListboxSelect = function () {
		let listbox = document.querySelector('#testing-listbox');
		let itemPreviews = document.querySelector('#item-previews');
		let previews = [];
		for (let item of listbox.selectedItems) {
			let index = listbox.getIndexOfItem(item);
			let testData = _testData[index];
			previews.push(...testData.previews);
		}
		itemPreviews.setPreviews(previews);
	};
	
	this.handleTestingListboxDblClick = function () {
		this.runSelectedTests();
	};

	// Add special keydown handling for the editors
	this.addEditorKeydownHandlers = function (editor) {
		let doc = editor.getDomNode().ownerDocument;
		// On shift-tab from the start of the first line, tab out of the editor.
		// Use capturing listener, since Shift-Tab keydown events do not propagate to the document.
		doc.addEventListener("keydown", (event) => {
			if (event.key == "Tab" && event.shiftKey) {
				let position = editor.getPosition();
				if (position.column == 1 && position.lineNumber == 1) {
					Services.focus.moveFocus(window, event.target, Services.focus.MOVEFOCUS_BACKWARD, 0);
					event.preventDefault();
				}
			}
		}, true);
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
			creators.push({ firstName: "", lastName: "", creatorType: creatorType.name, fieldMode: 1 });
		}
		outputObject.creators = creators;
		outputObject.attachments = [{ url: "", document: {}, title: "", mimeType: "", snapshot: false }];
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

	/**
	 * Load the typed URL in the browser tab.
	 */
	this.loadURLInBrowser = async function () {
		let url = document.getElementById("browser-url").value;
		if (!url) return;
		Zotero.debug('Scaffold: Loading URL in browser: ' + url);

		_setBrowserLoadingIndicator(true);

		_browser.fixupAndLoadURIString(url, {
			triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal()
		});
	};

	/**
	 * Check if there is a webpage loaded in the browser tab when translator type is 'web'.
	 * If not, alert the user and navigate to the browser tab.
	 * @returns {boolean} True if a webpage is loaded for web translators, false otherwise.
	 */
	this.ensureWebpageLoadedIfNeeded = function () {
		if (!_browserLoadedURL && document.getElementById('checkbox-web').checked) {
			Services.prompt.alert(null, "Webpage Not Loaded", "You need to load a webpage in the Browser tab first.");
			_showTab('browser');
			document.getElementById('browser-url').focus();
			return false;
		}
		return true;
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
			if (document.getElementById('checkbox-web').checked) {
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

		if (['detectWeb', 'doWeb'].includes(functionToRun)) {
			if (!this.ensureWebpageLoadedIfNeeded()) return;
		}

		_logOutput(`Running ${functionToRun}`);
		
		let input = await _getInput(functionToRun);

		if (functionToRun.endsWith('Export')) {
			let numItems = Zotero.getActiveZoteroPane().getSelectedItems().length;
			_logOutput(`Exporting ${numItems} item${numItems == 1 ? '' : 's'} selected in library`);
			await _run(functionToRun, input, _selectItems, () => {}, _getTranslatorsHandler(functionToRun), _myExportDone);
		}
		else {
			await _run(functionToRun, input, _selectItems, _myItemDone, _getTranslatorsHandler(functionToRun));
		}
		
		_logOutput('Done');
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
		if (!this.ensureWebpageLoadedIfNeeded()) return;
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
	function _selectItems(obj, itemList, callback) {
		var io = { dataIn: itemList, dataOut: null };
		window.openDialog("chrome://scaffold/content/select.xhtml",
			"_blank", "chrome,modal,centerscreen,resizable=yes", io);
		callback(io.dataOut);
	}

	/*
	 * called if an error occurs
	 */
	function _error(obj, error) {
		_logOutput(String(error));
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
	function _myItemDone(obj, jsonItem) {
		let itemPreviews = document.querySelector('#item-previews');
		itemPreviews.addItemPair(jsonItem, null);
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
			string = Zotero.Utilities.varDump(string);
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

		translator.code = metadata + "\n" + _getCode();

		// make sure translator gets run in browser in Zotero >2.1
		if (Zotero.Translator.RUN_MODE_IN_BROWSER) {
			translator.runMode = Zotero.Translator.RUN_MODE_IN_BROWSER;
		}

		return translator;
	}

	/*
	 * loads the translator's tests from the translator code
	 */
	function _splitTranslator(code) {
		let metadata = code.substr(0, code.indexOf('"lastUpdated"') + 50)
			.match(/^\s*\{[\S\s]*?}\s*?[\r\n]+/)[0];
		code = code.substring(metadata.length);

		var testStart = code.indexOf("/** BEGIN TEST CASES **/");
		var testEnd = code.indexOf("/** END TEST CASES **/");

		let testCases;
		if (testStart !== -1 && testEnd !== -1) {
			testCases = code.substring(testStart + 24, testEnd);
			code = code.substring(0, testStart).trimEnd();
		}
		else {
			testCases = 'var testCases = [];';
		}

		testCases = testCases.replace(/^\s*var testCases = /, '').trim();
		// The JSON parser doesn't like final semicolons
		if (testCases.endsWith(';')) {
			testCases = testCases.slice(0, -1);
		}

		try {
			testCases = JSON.stringify(JSON.parse(testCases), null, '\t');
		}
		catch (e) {
			Zotero.logError(e);
		}
		
		code = normalizeWhitespace(code);
		
		return { metadata, code, testCases };
	}

	/*
	 * loads the translator's tests from the pane
	 */
	function _loadTestsFromPane() {
		try {
			return JSON.parse(_editors.tests.getValue().trim() || '[]')
				.map(test => new Test(test));
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
		if (value instanceof Test) {
			value = value.toJSON();
		}
		
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

		if (type === 'web') {
			if (!this.ensureWebpageLoadedIfNeeded()) return;
		}

		try {
			let test = await this.constructTestFromCurrent(type);
			_writeTestsToPane([..._loadTestsFromPane(), test]);
		}
		catch (e) {
			Zotero.logError(e);
			_logOutput('Creation failed');
			return;
		}

		let listbox = document.getElementById('testing-listbox');
		listbox.selectedIndex = listbox.getRowCount() - 1;
		listbox.focus();
	};

	this.constructTestFromCurrent = async function (type) {
		_clearOutput();
		if ((type === "web" && !document.getElementById('checkbox-web').checked)
			|| (type === "import" && !document.getElementById('checkbox-import').checked)
			|| (type === "search" && !document.getElementById('checkbox-search').checked)) {
			_logOutput(`Translator does not support ${type} tests`);
			throw new Error();
		}

		if (type == 'export') {
			throw new Error(`Test of type export cannot be created`);
		}

		let input = await _getInput(type);
		if (input === _browser) {
			input = _getCurrentURI(_browser);
		}
		
		let testDraft = new Test({ type, input, items: [] });
		let [{ updatedTest: test }] = await Array.fromAsync(
			this.runTestsInternal([testDraft])
		);
		
		// If we didn't get an item the first time, try again with defer: true
		if (!test) {
			testDraft.defer = true;
			let [{ updatedTest }] = await Array.fromAsync(
				this.runTestsInternal([testDraft])
			);
			test = updatedTest;
		}
		
		// But give up after that
		if (!test) {
			if (Services.prompt.confirm(
				null,
				'Detection Failed',
				`Add test ensuring that detection always fails on this ${type === 'web' ? 'page' : 'input'}?`
			)) {
				testDraft.detectedItemType = false;
				testDraft.defer = false;
				return testDraft.toJSON();
			}
			else {
				throw new Error('Not creating expected-fail test');
			}
		}
		
		return test.toJSON();
	};

	/*
	 * populate tests pane and url options in browser pane
	 */
	this.populateTests = function () {
		let tests = _loadTestsFromPane();
		let validateTestsBroadcaster = document.getElementById('validate-tests');
		if (tests === null) {
			validateTestsBroadcaster.setAttribute('disabled', true);
			return;
		}
		else {
			validateTestsBroadcaster.removeAttribute('disabled');
		}

		let listbox = document.getElementById("testing-listbox");

		for (let [testIndex, test] of tests.entries()) {
			let testString = _stringifyTests(test, 1);
			let testData = _testData[testIndex];
			if (!testData || testData.testString !== testString) {
				_testData[testIndex] = testData = {
					test,
					testString,
					previews: [],
				};
			}
			testData.test = test;
			testData.testString = testString;
			// Remove updatedTestString if updates have been applied
			if (testData.updatedTestString === testString) {
				delete testData.updatedTestString;
			}
			let needsUpdate = !!testData.updatedTestString;

			let item = testIndex < listbox.getRowCount()
				? listbox.getItemAtIndex(testIndex)
				: document.createXULElement('richlistitem');
			item.replaceChildren();

			let inputCell = document.createXULElement('hbox');
			inputCell.classList.add('cell', 'col-input');

			let input = document.createXULElement('label');
			input.append(getTestLabel(test));
			inputCell.append(input);
			item.append(inputCell);

			let statusCell = document.createXULElement('hbox');
			statusCell.classList.add('cell', 'col-status');
			statusCell.classList.toggle('needs-update', needsUpdate);
			let statusLabel = document.createXULElement('label');
			statusLabel.classList.add('status');

			let statusText = _testData.find(test => test.testString === testString)?.status ?? '';
			if (needsUpdate) {
				let totalStats = { added: 0, removed: 0 };
				for (let preview of testData.previews) {
					let statsHere = preview.diffStats;
					totalStats.added += statsHere.added;
					totalStats.removed += statsHere.removed;
				}
	
				let textElem = document.createElement('span');
				textElem.classList.add('text');
				textElem.textContent = statusText;
				let addedElem = document.createElement('span');
				addedElem.classList.add('added');
				addedElem.textContent = `+${totalStats.added}`;
				let removedElem = document.createElement('span');
				removedElem.classList.add('removed');
				removedElem.textContent = `-${totalStats.removed}`;
	
				statusLabel.replaceChildren(textElem, addedElem, removedElem);
			}
			else {
				statusLabel.textContent = statusText;
			}

			statusCell.append(statusLabel);
			let updateButton = document.createXULElement('toolbarbutton');
			updateButton.classList.add('update');
			updateButton.setAttribute('tooltiptext', 'Update Test');
			updateButton.addEventListener('command', () => this.updateTests([testIndex]));
			statusCell.append(updateButton);
			item.append(statusCell);

			let deferCell = document.createXULElement('hbox');
			deferCell.classList.add('cell', 'col-defer');
			let defer = document.createXULElement('checkbox');
			if (typeof test.defer === 'number' && test.defer) {
				defer.setAttribute('indeterminate', 'true');
			}
			else {
				defer.checked = test.defer;
			}
			defer.setAttribute('native', 'true');
			defer.addEventListener('command', () => {
				test.defer = defer.checked;
				_writeTestsToPane(tests);
			});
			deferCell.append(defer);
			item.append(deferCell);

			if (!item.parentElement) {
				listbox.append(item);
			}
		}
		
		// Remove unused _testData entries and listbox rows
		_testData = _testData.slice(0, tests.length);
		while (listbox.getRowCount() > tests.length) {
			listbox.getItemAtIndex(listbox.getRowCount() - 1).remove();
		}
		
		// Update UI that depends on the selection
		this.handleTestingListboxSelect();
	};

	/*
	 * Delete selected test(s)
	 */
	this.deleteSelectedTests = function () {
		var listbox = document.getElementById("testing-listbox");
		var indicesToRemove = [...listbox.selectedItems].map(item => listbox.getIndexOfItem(item));

		let tests = _loadTestsFromPane();
		tests = tests.filter((_, i) => !indicesToRemove.includes(i));
		_writeTestsToPane(tests);

		this.populateTests();
	};

	/*
	 * Load the import input for the first selected test in the import pane,
	 * from the UI.
	 */
	this.editImportFromTest = function () {
		var listbox = document.getElementById("testing-listbox");
		var { test } = _testData[listbox.selectedIndex];
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
		var { test } = _testData[listbox.selectedIndex];
		var input = test.input; // URL or input object
		if (typeof input !== 'string') {
			input = JSON.stringify(input, null, '\t');
		}
		Zotero.Utilities.Internal.copyTextToClipboard(input);
	};
	
	/**
	 * Open the url of the first selected test in the browser (Browser tab or
	 * the system's default browser).
	 * @param {boolean} openExternally whether to open in the default browser
	**/
	this.openURL = function (openExternally) {
		var listbox = document.getElementById("testing-listbox");
		var { test } = _testData[listbox.selectedIndex];
		var url = test.url;
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
	
	this.runTests = async function (testIndices) {
		let itemPreviews = document.querySelector('#item-previews');
		let testDatas = testIndices.map(index => _testData[index]);

		for (let testData of testDatas) {
			testData.status = 'Running';
			delete testData.updatedTestString;
		}
		this.populateTests();

		let numTests = testDatas.length;
		let testIndex = 0;
		_logOutput(`Running ${numTests} ${Zotero.Utilities.pluralize(numTests, 'test')}`);
		for await (let { test, status, reason, updatedTest } of this.runTestsInternal(testDatas.map(d => d.test))) {
			let statusText;
			let needsUpdate = false;
			
			let logPrefix = `Test ${testIndex + 1}/${numTests}: `;
			if (status === 'success') {
				statusText = 'Succeeded';
				_logOutput(logPrefix + statusText);
			}
			else {
				statusText = reason;
				needsUpdate = !!updatedTest;
				_logOutput(logPrefix + statusText);
			}

			// Create previews as long as we got new item data,
			// even if there weren't substantive changes
			let previews = [];
			if (Array.isArray(test.items) && Array.isArray(updatedTest?.items)) {
				for (let i = 0; i < test.items.length || i < updatedTest.items.length; i++) {
					let preItem = i < test.items.length ? test.items[i] : {};
					let postItem = i < updatedTest.items.length ? updatedTest.items[i] : {};
					previews.push(itemPreviews.createPreviewForItemPair(preItem, postItem));
				}
			}

			let testData = testDatas[testIndex];
			testData.status = statusText;
			testData.previews = previews;
			if (needsUpdate) {
				testData.updatedTestString = _stringifyTests(updatedTest.toJSON(), 1);
			}
			else {
				delete testData.updatedTestString;
			}
			this.populateTests();

			testIndex++;
		}
		
		_invalidateCodeLenses?.();
	};

	this.runSelectedTests = async function () {
		let listbox = document.getElementById('testing-listbox');
		let selectedItems = [...listbox.selectedItems];
		await this.runTests(
			[...selectedItems].map(item => listbox.getIndexOfItem(item))
		);
	};

	this.runTestsInternal = async function* (tests) {
		_clearOutput();

		let rememberCookies = document.getElementById('checkbox-remember-cookies').checked;
		let tester = new TranslatorTester(_getTranslatorFromPane(), {
			translatorProvider: _translatorProvider,
			cookieSandbox: rememberCookies ? null : new Zotero.CookieSandbox(),
			debug: _logOutput,
			webTranslationEnvironment: new ZoteroWebTranslationEnvironment(),
		});

		for (let test of tests) {
			yield { test, ...await tester.run(test) };
		}
	};

	this.updateTests = function (testIndices) {
		let tests = _loadTestsFromPane();
		for (let testIndex of testIndices) {
			let testData = _testData[testIndex];
			let updatedTestString = testData.updatedTestString;
			if (!updatedTestString) {
				continue;
			}
			
			let updatedTest = JSON.parse(updatedTestString);
			tests[testIndex] = updatedTest;
			testData.test = new Test(updatedTest);
			testData.testString = _stringifyTests(updatedTest, 1);
			delete testData.updatedTestString;
			testData.status = 'Updated';
		}
		_writeTestsToPane(tests);
		_logOutput('Tests updated.');
	};
	
	this.updateSelectedTests = async function () {
		let listbox = document.getElementById('testing-listbox');
		let selectedItems = [...listbox.selectedItems];
		this.updateTests(
			[...selectedItems].map(item => listbox.getIndexOfItem(item))
		);
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
		let itemPreviews = document.querySelector('#item-previews');
		itemPreviews.clearPreviews();
	}

	/**
	 * Toggle the indicator of browser loading by hiding the load button
	 * and displaying the spinner, or vice versa.
	 */
	function _setBrowserLoadingIndicator(isLoading) {
		if (isLoading) {
			document.getElementById("load-url-button").hidden = true;
			document.getElementById("browser-loading").setAttribute("status", "animate");
		}
		else {
			document.getElementById("load-url-button").hidden = false;
			document.getElementById("browser-loading").removeAttribute("status");
		}
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
		return PathUtils.join(Scaffold_Translators.getDirectory(), 'node_modules', '.bin', 'eslint');
	}

	async function getESLintPath() {
		if (!Zotero.Prefs.get('scaffold.eslint.enabled')) {
			return null;
		}

		let eslintPath = getDefaultESLintPath();

		while (!(await IOUtils.exists(eslintPath))) {
			let ps = Services.prompt;
			let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
				+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING
				+ ps.BUTTON_POS_2 * ps.BUTTON_TITLE_CANCEL;

			let index = ps.confirmEx(null,
				"Scaffold",
				"Zotero uses ESLint to enable code suggestions and error checking, "
					+ "but it wasn't found in the selected translators directory.\n\n"
					+ "You can install it from the command line:\n\n"
					+ `  cd '${Scaffold_Translators.getDirectory()}'\n`
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

	let eslintSubprocess = null;
	async function runESLint() {
		let eslintPath = await getESLintPath();
		if (!eslintPath) return [];

		try {
			let metadata = _getMetadataObject();
			let code = _getCode();
			let translatorString = _translatorProvider.stringify(metadata, code);
			
			let subprocessOptions = {
				command: eslintPath,
				arguments: [
					'--format',
					'json',
					'--stdin',
					'--stdin-filename',
					_translatorProvider.getSavePath(metadata)
				],
			};
			
			// ESLint needs to find node on the PATH, but macOS doesn't forward
			// the login shell's PATH to GUI processes by default. There's a
			// launchctl command that fixes it, but we can't expect people
			// to do that. Pass the login shell's PATH as a workaround.
			if (Zotero.isMac) {
				subprocessOptions.environment = { PATH: await lazy.shellPathPromise };
				subprocessOptions.environmentAppend = true;
			}
			
			let proc = await Subprocess.call(subprocessOptions);
			if (eslintSubprocess) {
				eslintSubprocess.kill(0);
			}
			eslintSubprocess = proc;
			
			await proc.stdin.write(translatorString);
			await proc.stdin.close();
			let lintOutput = '';
			let chunk;
			while ((chunk = await proc.stdout.readString())) {
				lintOutput += chunk;
			}
			proc.kill(); // Shouldn't be necessary, but make sure we don't leak
			return JSON.parse(lintOutput);
		}
		catch (e) {
			if (!(e instanceof SyntaxError)) {
				Zotero.logError(e);
			}
		}
		return [];
	}

	function eslintOutputToModelMarkers(output, modelVersionId) {
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
			code: message.ruleId,
			modelVersionId,
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
	
	function _handleAPIKeyChange() {
		let apiKey = Zotero.Prefs.get('scaffold.completions.mistralAPIKey');
		if (apiKey) {
			_copilot = new CompletionCopilot(apiKey, {
				provider: 'mistral',
				model: 'codestral'
			});
		}
		else {
			_copilot = null;
		}
	}
};

window.addEventListener('load', e => e.target === document && Scaffold.handleLoad(e));
window.addEventListener('unload', e => e.target === document && Scaffold.handleUnload(e));
