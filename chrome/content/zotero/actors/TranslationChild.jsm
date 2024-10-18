var EXPORTED_SYMBOLS = ["TranslationChild"];

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const TRANSLATE_SCRIPT_PATHS = [
	'src/zotero.js',
	'src/promise.js',
	'../utilities/openurl.js',
	'../utilities/date.js',
	'../utilities/xregexp-all.js',
	'../utilities/xregexp-unicode-zotero.js',
	'../utilities/jsonld.js',
	'../utilities/utilities.js',
	'../utilities/utilities_item.js',
	'../utilities/schema.js',
	'../utilities/resource/zoteroTypeSchemaData.js',
	'../utilities/cachedTypes.js',
	'src/utilities_translate.js',
	'src/debug.js',
	'src/http.js',
	'src/translator.js',
	'src/translators.js',
	'src/repo.js',
	'src/translation/translate.js',
	'src/translation/sandboxManager.js',
	'src/translation/translate_item.js',
	'src/tlds.js',
	'src/proxy.js',
	'src/rdf/init.js',
	'src/rdf/uri.js',
	'src/rdf/term.js',
	'src/rdf/identity.js',
	'src/rdf/n3parser.js',
	'src/rdf/rdfparser.js',
	'src/rdf/serialize.js',
	'testTranslators/translatorTester.js',
];

const OTHER_SCRIPT_URIS = [
	'chrome://zotero/content/actors/translation/http.js',
	'chrome://zotero/content/actors/translation/translate_item.js',
];

class TranslationChild extends JSWindowActorChild {
	_sandbox = null;
	
	async receiveMessage(message) {
		await this.documentIsReady();
		
		let { name, data } = message;
		switch (name) {
			case 'initTranslation': {
				let { schemaJSON, dateFormatsJSON, prefs } = data;
				this._sandbox = this._loadTranslationFramework(schemaJSON, dateFormatsJSON, prefs);
				break;
			}
			case 'detect': {
				let { translator, id } = data;
				let { Zotero } = this._sandbox;
				try {
					let translate = new Zotero.Translate.Web();
					translate.setTranslatorProvider(this._makeTranslatorProvider(id));
					translate.setDocument(this.document);
					this._initHandlers(id, translate);
					if (translator) {
						translate.setTranslator(Cu.cloneInto(translator, this._sandbox));
					}
					return await translate.getTranslators(false, !!translator);
				}
				catch (e) {
					this._error(id, e);
					return null;
				}
			}
			case 'translate': {
				let { translator, id } = data;
				let { Zotero } = this._sandbox;
				try {
					let translate = new Zotero.Translate.Web();
					translate.setTranslatorProvider(this._makeTranslatorProvider(id));
					translate.setDocument(this.document);
					this._initHandlers(id, translate);
					if (translator) {
						translate.setTranslator(Cu.cloneInto(translator, this._sandbox));
					}
					return await translate.translate();
				}
				catch (e) {
					this._error(id, e);
					return null;
				}
			}
			case 'runTest': {
				let { translator, test, id } = data;
				let { Zotero_TranslatorTester } = this._sandbox;
				try {
					let tester = new Zotero_TranslatorTester(
						Cu.cloneInto(translator, this._sandbox),
						test.type,
						(_tester, obj) => this._debug(id, obj),
						this._makeTranslatorProvider(id),
					);
					return await new Promise((resolve) => {
						tester.runTest(
							Cu.cloneInto(test, this._sandbox),
							this.contentWindow.document,
							Cu.exportFunction(
								(_, test, status, message) => resolve({ test, status, message }),
								this._sandbox
							)
						);
					});
				}
				catch (e) {
					this._error(id, e);
					return null;
				}
			}
			case 'newTest': {
				let { translator, id } = data;
				let { Zotero_TranslatorTester } = this._sandbox;
				try {
					let tester = new Zotero_TranslatorTester(
						Cu.cloneInto(translator, this._sandbox),
						'web',
						(_tester, obj) => this._debug(id, obj),
						this._makeTranslatorProvider(id),
					);
					return await new Promise((resolve) => {
						tester.newTest(
							this.contentWindow.document,
							Cu.exportFunction(
								(_, test) => resolve(test),
								this._sandbox
							),
							Cu.exportFunction(
								() => this._sendQuerySafe('Translate:runHandler', {
									id,
									name: 'newTestDetectionFailed'
								}),
								this._sandbox
							)
						);
					});
				}
				catch (e) {
					this._error(id, e);
					return null;
				}
			}
		}
	}
	
	_makeTranslatorProvider(id) {
		let { Zotero } = this._sandbox;
		let makeProxy = method => (
			(...args) => this._sandbox.Promise.resolve(
				this.sendQuery('Translators:call', { id, method, args })
			).then(result => Cu.cloneInto(result, this._sandbox))
		);
		return Cu.cloneInto({
			...Zotero.Translators,
			get: makeProxy('get'),
			getCodeForTranslator: makeProxy('getCodeForTranslator'),
			getAllForType: makeProxy('getAllForType'),
			getWebTranslatorsForLocation: makeProxy('getWebTranslatorsForLocation'),
		}, this._sandbox, { cloneFunctions: true });
	}

	/**
	 * Wraps a call to sendQuery() so that any returned value or error is safe to access from the content window,
	 * and the returned promise can be `then`ed from the content window.
	 *
	 * @param {String} message
	 * @param {Object} value
	 * @return {Promise<Object>}
	 */
	_sendQuerySafe(message, value) {
		return new this._sandbox.Promise((resolve, reject) => {
			this.sendQuery(message, value)
				.then(rv => Cu.cloneInto(rv, this._sandbox))
				.catch(e => this._sandbox.Promise.reject(new this._sandbox.Error(e.message)))
				.then(resolve, reject);
		});
	}

	/**
	 * Run the debug handler on the Zotero.Translate instance with the given ID
	 * @return {Promise<void>}
	 */
	_debug(id, arg) {
		let { Zotero } = this._sandbox;
		if (typeof arg !== 'string') {
			arg = Zotero.Utilities.varDump(arg);
		}
		// 8096K ought to be enough for anybody
		// (And Firefox will throw an error when serializing very large values in fx102.
		// Limit seems to have been removed in later versions.)
		if (arg.length > 1024 * 8096) {
			arg = arg.substring(0, 1024 * 1024);
		}
		return this._sendQuerySafe('Translate:runHandler', {
			id,
			name: 'debug',
			arg
		});
	}

	/**
	 * Run the error handler on the Zotero.Translate instance with the given ID
	 * @return {Promise<void>}
	 */
	_error(id, arg) {
		return this._sendQuerySafe('Translate:runHandler', {
			id,
			name: 'error',
			arg: String(arg)
		});
	}

	/**
	 * Initialize proxied handlers on the provided Zotero.Translate instance.
	 */
	_initHandlers(id, translate) {
		let names = [
			"select",
			"itemDone",
			"collectionDone",
			"done",
			"debug",
			"error",
			"translators",
			"pageModified",
		];
		for (let name of names) {
			let handler;
			if (name == 'debug') {
				handler = (_, arg) => this._debug(id, arg);
			}
			else if (name == 'error') {
				handler = (_, arg) => this._error(id, arg);
			}
			else if (name == 'select') {
				handler = (_, items, callback) => {
					this.sendQuery('Translate:runHandler', { id, name, arg: items }).then(items => {
						callback(Cu.cloneInto(items, this._sandbox));
					});
				};
			}
			else {
				handler = (_, arg) => this._sendQuerySafe('Translate:runHandler', { id, name, arg });
			}
			translate.setHandler(name, Cu.exportFunction(handler, this._sandbox));
		}
	}

	/**
	 * Load the translation framework into the current page.
	 * @param {Object | String} schemaJSON
	 * @param {Object | String} dateFormatsJSON
	 * @param {Object} prefs
	 * @return {Sandbox}
	 */
	_loadTranslationFramework(schemaJSON, dateFormatsJSON, prefs) {
		// Modeled after:
		// https://searchfox.org/mozilla-esr102/source/toolkit/components/extensions/ExtensionContent.jsm#809-845
		let systemPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
		let sandbox = new Cu.Sandbox(systemPrincipal, {
			sandboxPrototype: this.contentWindow,
			sameZoneAs: this.contentWindow,
			wantXrays: true,
			wantGlobalProperties: ["XMLHttpRequest", "fetch", "WebSocket"],
		});
		
		let scriptURIs = [
			...TRANSLATE_SCRIPT_PATHS.map(path => 'chrome://zotero/content/xpcom/translate/' + path),
			...OTHER_SCRIPT_URIS,
		];
		for (let scriptURI of scriptURIs) {
			Services.scriptloader.loadSubScript(scriptURI, sandbox);
		}

		let { Zotero } = sandbox;

		Zotero.Debug.init(1);
		Zotero.Debug.setStore(true);
		
		Zotero.Translators._initialized = true;
		Zotero.Schema.init(schemaJSON);
		Zotero.Date.init(dateFormatsJSON);
		
		for (let [key, value] of Object.entries(prefs)) {
			Zotero.Prefs.set(key, value);
		}

		return sandbox;
	}

	// From Mozilla's ScreenshotsComponentChild.jsm
	documentIsReady() {
		const contentWindow = this.contentWindow;
		const document = this.document;

		function readyEnough() {
			return document.readyState === "complete" || document.readyState === "interactive";
		}

		if (readyEnough()) {
			return Promise.resolve();
		}
		return new Promise((resolve, reject) => {
			function onChange(event) {
				if (event.type === "pagehide") {
					document.removeEventListener("readystatechange", onChange);
					contentWindow.removeEventListener("pagehide", onChange);
					reject(new Error("document unloaded before it was ready"));
				}
				else if (readyEnough()) {
					document.removeEventListener("readystatechange", onChange);
					contentWindow.removeEventListener("pagehide", onChange);
					resolve();
				}
			}
			document.addEventListener("readystatechange", onChange);
			contentWindow.addEventListener("pagehide", onChange, { once: true });
		});
	}

	didDestroy() {
		if (this._sandbox) {
			Cu.nukeSandbox(this._sandbox);
		}
	}
}
