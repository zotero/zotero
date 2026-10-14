describe("Plugin windows", function () {
	var plugin = usePluginSandbox();
	// A second unprivileged plugin with the same permissions
	var other = usePluginSandbox({ id: "test-sandbox-other@zotero.org", name: "Other Sandbox Plugin" });
	var endpoints = useTestEndpoints();
	var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");

	// The plugin's own shorthand for the openPluginWindow command: it resolves with the window handle, and
	// throws a failure as "<code>: <message>" so a test can await it
	const OPEN_PLUGIN_WINDOW = "var openPluginWindow = params => Zotero.WindowController"
		+ ".command('openPluginWindow', params)"
		+ ".then(r => { if (!r.success) throw new Error(r.error.code + ': ' + r.error.message); return r.result; });";

	// Cleanup through the controller; a window that is already gone is fine
	async function closeWin(name = "_win", sandbox = plugin) {
		let { success, error } = await sandbox.eval(
			`Zotero.WindowController.command("closeWindow", { windowID: ${name}.windowID })`
		);
		if (!success && error.code !== "NotFound") {
			throw new Error(`${error.code}: ${error.message}`);
		}
	}

	it("should reject disallowed URLs (external, file://, and non-.html files)", async function () {
		plugin.load(["default", "window"]);
		let badURLs = [
			"https://example.com/page.html",
			"file:///etc/page.html",
			"settings.xhtml",
			"dialog.xul",
			"script.js",
		];
		for (let url of badURLs) {
			let { success, error } = await plugin.eval(
				`Zotero.WindowController.command("openPluginWindow", { url: ${JSON.stringify(url)} })`
			);
			assert.isFalse(success, `${url} should be rejected`);
			assert.equal(error.code, "InvalidParams");
		}
	});

	it("should take features as an object of booleans and numbers", async function () {
		plugin.load(["default", "window"]);
		let bad = ['"width=300,height=200"', '["centerscreen"]', '{ width: "300" }', '{ centerscreen: null }'];
		for (let features of bad) {
			let { success, error } = await plugin.eval(
				`Zotero.WindowController.command("openPluginWindow", { url: "test.html", features: ${features} })`
			);
			assert.isFalse(success, `${features} should be rejected`);
			assert.equal(error.code, "InvalidParams");
		}
	});

	it("should keep only the allowed features and format them for openWindow", function () {
		let { sanitizeWindowFeatures } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/embeddedPage.mjs");
		let { str, values } = sanitizeWindowFeatures({
			centerscreen: true, width: 300, resizable: false, modal: true, chrome: true,
		});
		assert.equal(str, "centerscreen,width=300,resizable=no");
		assert.deepEqual(values, { centerscreen: true, width: 300, resizable: false });
		assert.deepEqual(sanitizeWindowFeatures(), { str: "", values: {} });
	});

	describe("should work with real HTML file", function () {
		var tmpDir;
		var mainWin;

		function loadTestScopeWithURI(permissions, contentSecurityPolicy = null, sandbox = plugin) {
			// Point the plugin root at the temp dir holding our test HTML file.
			sandbox.load(permissions, { contentSecurityPolicy, resourceURI: PathUtils.toFileURI(tmpDir) + "/" });
			sandbox.eval(OPEN_PLUGIN_WINDOW);
		}

		// The wrapper window's content never crosses into the sandbox, so
		// tests reach it chrome-side instead (newest window last)
		function getPluginWindowBrowsers() {
			let browsers = [];
			for (let win of Services.wm.getEnumerator(null)) {
				if (win.location.href === "chrome://zotero/content/pluginWindow.xhtml") {
					browsers.push(win.document.getElementById("plugin-browser"));
				}
			}
			return browsers;
		}

		function getLastPluginWindowContent() {
			let browsers = getPluginWindowBrowsers();
			return browsers.length
				? browsers[browsers.length - 1].contentWindow
				: null;
		}

		before(async function () {
			mainWin = await loadZoteroPane();
			tmpDir = await getTempDirectory();
			let htmlContent = "<!DOCTYPE html><html><head><title>Test</title></head>"
				+ "<body><div id='test-div'>Hello</div></body></html>";
			await FileIO.writeUTF8(PathUtils.join(tmpDir, "test.html"), htmlContent);
			// For the resource loading test
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "style.css"),
				"#test-div { color: rgb(255, 0, 0); }"
			);
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "script.js"),
				"document.getElementById('test-div').setAttribute('data-script-loaded', 'true');\n"
				+ "window._pluginScriptLoaded = true;"
			);
			let resourceHtml = "<!DOCTYPE html><html><head><title>Resources</title>"
				+ '<link rel="stylesheet" href="style.css">'
				+ "</head><body><div id='test-div'>Styled</div>"
				+ '<script src="script.js"></script></body></html>';
			await FileIO.writeUTF8(PathUtils.join(tmpDir, "resources.html"), resourceHtml);
			// Page that echoes plugin messages and relays zoteroHost.api calls,
			// for page-messenger tests (external script to satisfy the page CSP)
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "echo.js"),
				"function reportAPI(promise) {\n"
				+ "  promise.then(\n"
				+ "    function (result) {\n"
				+ "      zoteroHost.sendMessage({ type: 'api-result', result: result === undefined ? null : result });\n"
				+ "    },\n"
				+ "    function (e) {\n"
				+ "      zoteroHost.sendMessage({ type: 'api-error', message: String(e && e.message || e) });\n"
				+ "    }\n"
				+ "  );\n"
				+ "}\n"
				+ "zoteroHost.addMessageListener(function (data) {\n"
				+ "  if (!data) return;\n"
				+ "  if (data.type === 'ping') {\n"
				+ "    zoteroHost.sendMessage({ type: 'pong', value: data.value });\n"
				+ "  }\n"
				+ "  else if (data.type === 'request-close') {\n"
				+ "    zoteroHost.api.close();\n"
				+ "  }\n"
				+ "  else if (data.type === 'call-api') {\n"
				+ "    reportAPI(zoteroHost.api[data.name](data.params));\n"
				+ "  }\n"
				+ "  else if (data.type === 'call-api-bad') {\n"
				+ "    reportAPI(zoteroHost.api.echoBack('not-an-object'));\n"
				+ "  }\n"
				+ "});\n"
			);
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "echo.html"),
				"<!DOCTYPE html><html><head><title>Echo</title></head>"
				+ '<body><script src="echo.js"></script></body></html>'
			);
			// Page asking for a size larger than its window features, for allowResize; it records the outcome
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "fixed-size.js"),
				"zoteroHost.api.resize({ width: 500, height: 400 }).then(\n"
				+ "  function (applied) { document.body.dataset.resize = JSON.stringify(applied); },\n"
				+ "  function (e) { document.body.dataset.resize = e.message; }\n"
				+ ");\n"
			);
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "fixed-size.html"),
				"<!DOCTYPE html><html><head><title>Fixed</title>"
				+ "<style>html, body { margin: 0; padding: 0; }</style></head>"
				+ "<body><div style='width: 500px; height: 400px;'></div>"
				+ '<script src="fixed-size.js"></script></body></html>'
			);
			// The same, asking for both axes and then the height alone
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "fixed-height.js"),
				"function record(name, promise) {\n"
				+ "  return promise.then(\n"
				+ "    function (applied) { document.body.dataset[name] = JSON.stringify(applied); },\n"
				+ "    function (e) { document.body.dataset[name] = e.message; }\n"
				+ "  );\n"
				+ "}\n"
				+ "record('both', zoteroHost.api.resize({ width: 500, height: 400 }))\n"
				+ "  .then(function () { return record('height', zoteroHost.api.resize({ height: 400 })); });\n"
			);
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "fixed-height.html"),
				"<!DOCTYPE html><html><head><title>Fixed height</title>"
				+ "<style>html, body { margin: 0; padding: 0; }</style></head>"
				+ "<body><div style='width: 500px; height: 400px;'></div>"
				+ '<script src="fixed-height.js"></script></body></html>'
			);
			// A page whose external script probes for privileged APIs
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "probe.js"),
				"var apis = ['ChromeUtils', 'Services', 'IOUtils', 'PathUtils', 'Cu', 'Cc', 'Ci', 'Zotero'];\n"
				+ "var r = document.getElementById('results');\n"
				+ "apis.forEach(function(name) {\n"
				+ "  r.setAttribute('data-' + name.toLowerCase(), typeof window[name]);\n"
				+ "});\n"
				+ "try {\n"
				+ "  Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsIFile);\n"
				+ "  r.setAttribute('data-xpcom-blocked', 'false');\n"
				+ "} catch(e) {\n"
				+ "  r.setAttribute('data-xpcom-blocked', 'true');\n"
				+ "}\n"
			);
			let privilegedProbeHtml = "<!DOCTYPE html><html><head><title>Privilege Probe</title></head>"
				+ "<body><div id='results'></div>"
				+ '<script src="probe.js"></script></body></html>';
			await FileIO.writeUTF8(PathUtils.join(tmpDir, "privileged.html"), privilegedProbeHtml);

			// CSP probe: a same-origin external script that records whether
			// eval() is permitted by the page's Content-Security-Policy.
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "csp-probe.js"),
				"window._probeRan = true;\n"
				+ "try {\n"
				+ "  window._evalStatus = (window.eval('21 + 21') === 42) ? 'allowed' : 'blocked-silent';\n"
				+ "} catch (e) {\n"
				+ "  window._evalStatus = 'blocked';\n"
				+ "}\n"
				// Minimal valid empty wasm module ("\\0asm" + version 1). Its
				// compilation is gated by 'wasm-unsafe-eval' in script-src.
				+ "try {\n"
				+ "  new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));\n"
				+ "  window._wasmStatus = 'allowed';\n"
				+ "} catch (e) {\n"
				+ "  window._wasmStatus = 'blocked';\n"
				+ "}\n"
			);
			// Inline script (should be blocked by 'self'-only script-src) plus
			// the external eval probe (external same-origin script is allowed).
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "csp-inline.html"),
				"<!DOCTYPE html><html><head></head><body>"
				+ "<script>window._inlineRan = true;</script>"
				+ '<script src="csp-probe.js"></script></body></html>'
			);
			// A page trying to loosen its own CSP via <meta> to allow eval.
			// meta can only tighten, so eval should still be blocked.
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "csp-meta.html"),
				"<!DOCTYPE html><html><head>"
				+ '<meta http-equiv="Content-Security-Policy" '
				+ "content=\"script-src 'self' 'unsafe-eval'\">"
				+ "</head><body>"
				+ '<script src="csp-probe.js"></script></body></html>'
			);
		});

		after(async function () {
			mainWin.close();
			await FileIO.remove(tmpDir, { recursive: true });
		});

		// The handle's properties are sandbox-side accessors, so the tests
		// drive it from inside the sandbox, the way a plugin would
		it("should open an .html window and resolve with a page handle", async function () {
			loadTestScopeWithURI(["default", "window"]);
			let alive = await plugin.eval(`
					openPluginWindow({ url: 'test.html' }).then(function (win) {
						_win = win;
						return win.page.isAlive();
					});
				`);
			try {
				assert.isTrue(alive, "the page messenger should be alive");
				// The content window stays chrome-side
				let contentWin = getLastPluginWindowContent();
				assert.equal(contentWin.document.title, "Test");
			}
			finally {
				await closeWin();
			}
		});

		it("should fail with NotFound when the page does not load", async function () {
			loadTestScopeWithURI(["default", "window"]);
			let { success, result, error } = await plugin.eval(
				'Zotero.WindowController.command("openPluginWindow", { url: "missing.html" })'
			);
			if (success) {
				await plugin.eval(`Zotero.WindowController.command("closeWindow", { windowID: ${result.windowID} })`);
			}
			assert.isFalse(success, "a missing page should not open a window");
			assert.equal(error.code, "NotFound");
		});

		it("should take its params as one object and resolve with a live handle", async function () {
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval(`
					Zotero.WindowController.command("openPluginWindow", {
						url: "test.html", features: { width: 300, height: 200 }, notitle: true,
					}).then(function (r) { _win = r.result; });
				`);
			try {
				assert.isTrue(plugin.eval("typeof _win.page.isAlive === 'function' && _win.page.isAlive()"));
				assert.isNumber(plugin.eval("_win.windowID"));
			}
			finally {
				await closeWin();
			}
		});

		it("should map window drag attributes via the injected user sheet", async function () {
			// The page can't use -moz-window-dragging itself (chrome-only CSS,
			// dropped from moz-extension author sheets), only the attributes
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "drag.html"),
				"<!DOCTYPE html><html><head><title>Drag</title></head>"
				+ "<body><div id='bar' window-dragging>"
				+ "<button id='btn'>x</button></div>"
				+ "<div id='free' window-no-drag></div></body></html>"
			);
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval("openPluginWindow({ url: 'drag.html' }).then(function (win) { _win = win; })");
			try {
				let browser = getPluginWindowBrowsers().pop();
				assert.isTrue(browser.docShell.windowDraggingAllowed,
					"the plugin window browser should allow window dragging");
				let InspectorUtils = browser.ownerDocument.defaultView.InspectorUtils;
				// The chrome-only property is hidden from CSSOM getPropertyValue
				// in content documents, so read it from the serialized rule text
				let getDrag = (id) => {
					let el = browser.contentWindow.document.getElementById(id);
					let value = "";
					for (let rule of InspectorUtils.getMatchingCSSRules(el)) {
						let m = rule.cssText.match(/-moz-window-dragging: ([\w-]+)/);
						if (m) {
							value = m[1];
						}
					}
					return value;
				};
				assert.equal(getDrag("bar"), "drag",
					"window-dragging should map to -moz-window-dragging: drag");
				assert.equal(getDrag("btn"), "no-drag",
					"interactive elements inside a drag area should opt out");
				assert.equal(getDrag("free"), "no-drag",
					"window-no-drag should map to -moz-window-dragging: no-drag");
			}
			finally {
				await closeWin();
			}
		});

		it("should hand the sandbox a handle with the page messenger and the window ID only", async function () {
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval("openPluginWindow({ url: 'test.html' }).then(function (win) { _win = win; })");
			try {
				assert.equal(
					plugin.eval("Object.keys(_win).sort().join(',')"),
					"page,windowID",
					"the handle should expose the page and its window ID only"
				);
				assert.equal(
					plugin.eval("Object.keys(_win.page).sort().join(',')"),
					"addMessageListener,isAlive,removeMessageListener,sendMessage",
					"the messenger should expose only the messaging methods"
				);
			}
			finally {
				await closeWin();
			}
		});

		it("should report its window's state by ID and refuse it once closed", async function () {
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval("openPluginWindow({ url: 'test.html', features: { width: 300, height: 200 } }).then(function (win) { _win = win; })");
			let browsers = getPluginWindowBrowsers();
			let chromeWin = browsers[browsers.length - 1].ownerDocument.defaultView;
			let windowID = chromeWin.browsingContext.id;
			try {
				assert.equal(plugin.eval("_win.windowID"), windowID, "the handle should carry the controller window ID");
				let { result: state } = await plugin.eval('Zotero.WindowController.query("getWindowState", { windowID: _win.windowID })');
				assert.deepEqual(
					JSON.parse(JSON.stringify(state)),
					(await Zotero.WindowController.query("getWindowState", { windowID })).result,
					"the sandbox and chrome should agree on the state"
				);
				assert.deepEqual([state.width, state.height], [chromeWin.outerWidth, chromeWin.outerHeight]);

				await plugin.eval('Zotero.WindowController.command("closeWindow", { windowID: _win.windowID })');
				// closed flips first; the page channel goes down with the teardown that follows
				for (let attempt = 0; attempt < 100 && plugin.eval("_win.page.isAlive()"); attempt++) {
					await Zotero.Promise.delay(20);
				}
				assert.isTrue(chromeWin.closed, "closeWindow should close the wrapper");
				assert.isFalse(plugin.eval("_win.page.isAlive()"), "the page channel should be down after the close");
				// A closed window is gone for the controller too
				let { error } = await plugin.eval('Zotero.WindowController.query("getWindowState", { windowID: _win.windowID })');
				assert.match(error.message, /No window with ID/);
				({ error } = await plugin.eval('Zotero.WindowController.command("closeWindow", { windowID: _win.windowID })'));
				assert.match(error.message, /No window with ID/);
			}
			finally {
				await closeWin();
			}
		});

		it("should open the window with a parent when given a window ID", async function () {
			loadTestScopeWithURI(["default", "window"]);
			let mainWindow = Zotero.getMainWindow();
			await plugin.eval(`
					openPluginWindow({ url: 'test.html', features: { width: 300, height: 200, dependent: true }, parentWindowID: ${mainWindow.browsingContext.id} })
						.then(function (win) { _win = win; });
				`);
			let browsers = getPluginWindowBrowsers();
			let chromeWin = browsers[browsers.length - 1].ownerDocument.defaultView;
			try {
				assert.strictEqual(chromeWin.opener, mainWindow, "the parent should be the opener");
				let appWindow = chromeWin.docShell.treeOwner
					.QueryInterface(Ci.nsIInterfaceRequestor)
					.getInterface(Ci.nsIAppWindow);
				assert.ok(appWindow.chromeFlags & Ci.nsIWebBrowserChrome.CHROME_DEPENDENT, "dependent should be honored");

				// A handle's windowID parents another plugin window
				await plugin.eval(`
						openPluginWindow({ url: 'test.html', features: { width: 300, height: 200 }, parentWindowID: _win.windowID })
							.then(function (win) { _child = win; });
					`);
				let childBrowsers = getPluginWindowBrowsers();
				let childWin = childBrowsers[childBrowsers.length - 1].ownerDocument.defaultView;
				try {
					assert.strictEqual(childWin.opener, chromeWin, "a plugin window should parent another");
				}
				finally {
					await closeWin("_child");
				}

				let parentError = await getPromiseError(plugin.eval("openPluginWindow({ url: 'test.html', parentWindowID: -1 })"));
				assert.match(String(parentError.message), /No window with ID/);
			}
			finally {
				await closeWin();
			}
		});

		it("should expose its own windows to Zotero.WindowController but not other plugins'", async function () {
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval("openPluginWindow({ url: 'test.html' }).then(function (win) { _win = win; })");
			let windowID = plugin.eval("_win.windowID");
			loadTestScopeWithURI(["default", "window"], null, other);
			try {
				let { result: { windows } } = await plugin.eval(
					'Zotero.WindowController.query("windows", { type: "pluginWindow" })'
				);
				windows = Array.from(windows);
				assert.include(windows.map(w => w.windowID), windowID, "the owner should list its window");
				assert.isTrue(windows.every(w => w.type === "pluginWindow" && w.pluginID === plugin.id),
					"the owner should list only its own windows");
				let { result: state } = await plugin.eval(
					`Zotero.WindowController.query("getWindowState", { windowID: ${windowID} })`
				);
				assert.isNumber(state.width);

				({ result: { windows } } = await other.eval(
					'Zotero.WindowController.query("windows", { type: "pluginWindow" })'));
				assert.notInclude(Array.from(windows).map(w => w.windowID), windowID,
					"another plugin should not list the window");
				let { error } = await other.eval(
					`Zotero.WindowController.query("getWindowState", { windowID: ${windowID} })`);
				assert.match(error.message, /No window with ID/);
				({ error } = await other.eval(
					`Zotero.WindowController.command("focusWindow", { windowID: ${windowID} })`));
				assert.match(error.message, /No window with ID/);
				let e = await getPromiseError(
					other.eval(`openPluginWindow({ url: 'test.html', parentWindowID: ${windowID} })`)
				);
				assert.match(String(e.message), /No window with ID/);
			}
			finally {
				await closeWin();
			}
		});

		it("should parent a FilePicker to its own plugin window by ID and nothing else", async function () {
			loadTestScopeWithURI(["default", "window", "fileSystemRead"]);
			await plugin.eval("openPluginWindow({ url: 'test.html' }).then(function (win) { _win = win; })");
			let { VarCheck } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/utils.mjs");
			// Swap the native picker under each instance for a spy, so init() shows no dialog
			let initSpy = sinon.spy();
			let makePicker = (name) => {
				plugin.eval(`var ${name} = new FilePicker();`);
				VarCheck.getOriginalOrSelf(plugin.scope[name])._fp = { init: initSpy };
			};
			try {
				let browsers = getPluginWindowBrowsers();
				let chromeWin = browsers[browsers.length - 1].ownerDocument.defaultView;
				makePicker("_fp");
				plugin.eval('_fp.init(_win.windowID, "Own window parent", _fp.modeOpen)');
				assert.strictEqual(initSpy.lastCall.args[0], chromeWin.browsingContext,
					"the plugin's own window should be the parent");

				// Anything else -- no parent, an unknown ID, a window that isn't the plugin's -- gets the platform's
				// fallback: the hidden window on macOS, the main window elsewhere
				let fallback = (Zotero.isMac ? Services.appShell.hiddenDOMWindow : Zotero.getMainWindow()).browsingContext;
				for (let [name, parent] of [["_fp2", "null"], ["_fp3", "-1"], ["_fp4", String(mainWin.browsingContext.id)]]) {
					makePicker(name);
					plugin.eval(`${name}.init(${parent}, "Other parent", ${name}.modeOpen)`);
					assert.strictEqual(initSpy.lastCall.args[0], fallback, `${parent} should parent to the fallback window`);
				}
			}
			finally {
				await closeWin();
			}
		});

		it("should message the page over the page messenger", async function () {
			loadTestScopeWithURI(["default", "window"]);
			let pongPromise = new Promise((resolve) => {
				plugin.scope._resolvePong = resolve;
			});
			await plugin.eval(`
					openPluginWindow({ url: 'echo.html' }).then(function (win) {
						_win = win;
						win.page.addMessageListener(function (data) {
							if (data && data.type == 'pong') {
								_resolvePong(data.value);
							}
						});
						win.page.sendMessage({ type: 'ping', value: 42 });
					});
				`);
			try {
				assert.equal(await pongPromise, 42, "the page should echo over zoteroHost");
			}
			finally {
				await closeWin();
			}
		});

		it("should close the window when the page calls the close host API", async function () {
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval("openPluginWindow({ url: 'echo.html' }).then(function (win) { _win = win; })");
			let browsers = getPluginWindowBrowsers();
			let chromeWin = browsers[browsers.length - 1].ownerDocument.defaultView;
			plugin.eval("_win.page.sendMessage({ type: 'request-close' })");
			for (let i = 0; i < 100 && !chromeWin.closed; i++) {
				await Zotero.Promise.delay(20);
			}
			assert.isTrue(chromeWin.closed, "the wrapper window should close");
			assert.isFalse(plugin.eval("_win.page.isAlive()"),
				"the page messenger should be dead");
		});

		it("should let the page control its own window via zoteroHost.api", async function () {
			loadTestScopeWithURI(["default", "window"]);
			let pending = [];
			plugin.scope._reportAPI = (json) => {
				pending.shift()?.(JSON.parse(json));
			};
			await plugin.eval(`
					openPluginWindow({ url: 'echo.html', features: { width: 300, height: 200 } }).then(function (win) {
						_win = win;
						win.page.addMessageListener(function (data) {
							if (data && (data.type == 'api-result' || data.type == 'api-error')) {
								_reportAPI(JSON.stringify(data));
							}
						});
					});
				`);
			let sendToPage = (data) => {
				let report = new Promise(resolve => pending.push(resolve));
				plugin.scope._toPage = JSON.stringify(data);
				plugin.eval("_win.page.sendMessage(JSON.parse(_toPage))");
				return report;
			};
			let browsers = getPluginWindowBrowsers();
			let chromeWin = browsers[browsers.length - 1].ownerDocument.defaultView;
			try {
				let x = chromeWin.screen.availLeft + 60;
				let y = chromeWin.screen.availTop + 60;
				let result = await sendToPage({ type: "call-api", name: "moveTo", params: { x, y } });
				assert.equal(result.type, "api-result", "moveTo should resolve");
				for (let attempt = 0; attempt < 100 && (chromeWin.screenX !== x || chromeWin.screenY !== y); attempt++) {
					await Zotero.Promise.delay(20);
				}
				assert.deepEqual([chromeWin.screenX, chromeWin.screenY], [x, y]);

				result = await sendToPage({ type: "call-api", name: "getState", params: {} });
				assert.equal(result.type, "api-result");
				assert.deepEqual(
					result.result,
					(await Zotero.WindowController.query("getWindowState", { windowID: chromeWin.browsingContext.id })).result
				);
			}
			finally {
				await closeWin();
			}
		});

		it("should dispatch zoteroHost.api calls to host handlers with object params", async function () {
			loadTestScopeWithURI(["default", "window"]);
			let pending = [];
			plugin.scope._reportAPI = (json) => {
				pending.shift()?.(JSON.parse(json));
			};
			await plugin.eval(`
					openPluginWindow({ url: 'echo.html' }).then(function (win) {
						_win = win;
						win.page.addMessageListener(function (data) {
							if (data && (data.type == 'api-result' || data.type == 'api-error')) {
								_reportAPI(JSON.stringify(data));
							}
						});
					});
				`);
			let sendToPage = (data) => {
				let report = new Promise(resolve => pending.push(resolve));
				plugin.scope._toPage = JSON.stringify(data);
				plugin.eval("_win.page.sendMessage(JSON.parse(_toPage))");
				return report;
			};
			let traceLines = [];
			let traceListener = (line) => {
				if (line.includes("[PluginTrace]")) {
					traceLines.push(line);
				}
			};
			Zotero.Debug.addListener(traceListener);
			try {
				// Extend this window's host API chrome-side for a round-trip check
				let browsers = getPluginWindowBrowsers();
				let actor = browsers[browsers.length - 1].browsingContext
					.currentWindowGlobal.getActor("ZoteroEmbeddedPluginPage");
				actor.setHostAPI({
					echoBack: params => ({ doubled: params.value * 2 }),
				});

				let result = await sendToPage({ type: "call-api", name: "echoBack", params: { value: 21 } });
				assert.equal(result.type, "api-result", "declared API should resolve");
				assert.equal(result.result.doubled, 42, "params and result should round-trip");
				// The call is traced under the page it came from
				let traced = traceLines.find(l => l.includes("[call]") && l.includes("/echo.html:zoteroHost.api.echoBack"));
				assert.ok(traced, "Should trace the page's host API call. All traces: " + JSON.stringify(traceLines));
				assert.include(traced, plugin.id);

				let unknown = await sendToPage({ type: "call-api", name: "nope", params: {} });
				assert.equal(unknown.type, "api-error", "undeclared API should reject");
				traced = traceLines.find(l => l.includes("/echo.html:zoteroHost.api.nope"));
				assert.ok(traced, "Should trace the refused call too");
				assert.include(traced, "failed: Error");

				let badParams = await sendToPage({ type: "call-api-bad" });
				assert.equal(badParams.type, "api-error", "non-object params should reject");
				assert.include(badParams.message, "plain object");
			}
			finally {
				Zotero.Debug.removeListener(traceListener);
				await closeWin();
			}
		});

		it("should let the page size its window with allowResize", async function () {
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval(`
					openPluginWindow({ url: 'fixed-size.html', features: { width: 300, height: 200 }, allowResize: { height: true, width: true } })
						.then(function (win) { _win = win; });
				`);
			let browsers = getPluginWindowBrowsers();
			let browser = browsers[browsers.length - 1];
			try {
				// The page sizes its browser and the wrapper window follows
				await waitForCallback(() => browser.contentDocument?.body?.dataset.resize, 20, 2);
				assert.deepEqual(JSON.parse(browser.contentDocument.body.dataset.resize), { width: 500, height: 400 });
				let rect = browser.getBoundingClientRect();
				assert.approximately(rect.width, 500, 2, "browser should take the width asked for");
				assert.approximately(rect.height, 400, 2, "browser should take the height asked for");
				assert.isAtLeast(browser.ownerDocument.defaultView.innerHeight, 400, "window should fit around the browser");
			}
			finally {
				await closeWin();
			}
		});

		it("should let the page size its window on the allowed axes only", async function () {
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval(`
					openPluginWindow({ url: 'fixed-height.html', features: { width: 300, height: 200 }, allowResize: { height: true } })
						.then(function (win) { _win = win; });
				`);
			let browsers = getPluginWindowBrowsers();
			let browser = browsers[browsers.length - 1];
			try {
				await waitForCallback(() => browser.contentDocument?.body?.dataset.height, 20, 2);
				let { dataset } = browser.contentDocument.body;
				assert.include(dataset.both, "The width can't be set here");
				assert.deepEqual(JSON.parse(dataset.height), { height: 400 });
				let rect = browser.getBoundingClientRect();
				assert.approximately(rect.width, 300, 2, "the width the page may not set stays");
				assert.approximately(rect.height, 400, 2);
			}
			finally {
				await closeWin();
			}
		});

		it("should not let the page size a window opened without allowResize", async function () {
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval(`
					openPluginWindow({ url: 'fixed-size.html', features: { width: 300, height: 200 } })
						.then(function (win) { _win = win; });
				`);
			let browsers = getPluginWindowBrowsers();
			let browser = browsers[browsers.length - 1];
			try {
				await waitForCallback(() => browser.contentDocument?.body?.dataset.resize, 20, 2);
				assert.include(browser.contentDocument.body.dataset.resize, "Unknown host API");
				let rect = browser.getBoundingClientRect();
				assert.approximately(rect.width, 300, 2);
				assert.approximately(rect.height, 200, 2);
			}
			finally {
				await closeWin();
			}
		});

		it("should size an iframe host as the page asks", async function () {
			let { loadEmbeddedPluginPage } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/embeddedPage.mjs");
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "sized.js"),
				"zoteroHost.api.resize({ width: 200, height: 120 });\n"
			);
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "sized.html"),
				"<!DOCTYPE html><html><head><title>Sized</title></head>"
				+ '<body><script src="sized.js"></script></body></html>'
			);
			loadTestScopeWithURI(["default", "window"]);
			// A content page hosts plugin pages in iframes, as the reader does
			await plugin.eval("openPluginWindow({ url: 'test.html' }).then(function (win) { _win = win; })");
			let doc = getLastPluginWindowContent().document;
			try {
				let { element } = await loadEmbeddedPluginPage(doc.body, Zotero.Plugins.getBaseURI(plugin.id) + "sized.html", {
					resize: { height: true, width: true },
				});
				await waitForCallback(() => element.contentWindow.innerHeight === 120, 20, 5);
				assert.equal(element.contentWindow.innerWidth, 200);
				assert.equal(element.style.height, "120px");
			}
			finally {
				await closeWin();
			}
		});

		it("blocks a cross-origin (remote) script via the page CSP script-src 'self'", async function () {
			// Same-origin moz-extension resources are CSP-exempt, so only a
			// CROSS-ORIGIN load reveals whether script-src 'self' is enforced.
			let remoteURL = endpoints.register("GET", function () {
				return [200, "application/javascript", "window._remoteRan = true;"];
			});
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "remote-script.html"),
				"<!DOCTYPE html><html><head></head><body>"
				+ `<script src="${remoteURL}"></script>`
				+ "</body></html>"
			);
			loadTestScopeWithURI(["default", "window"]);
			// openWindow resolves once the document has loaded, and a parser-inserted script runs
			// before that, so an allowed script would already have left its mark
			await plugin.eval("openPluginWindow({ url: 'remote-script.html' }).then(function (win) { _win = win; })");
			let contentWin = getLastPluginWindowContent();
			try {
				assert.notOk(contentWin.wrappedJSObject._remoteRan,
					"a cross-origin script must be blocked by the extension-page CSP");
			}
			finally {
				await closeWin();
			}
		});

		// Load the plugin with a declared CSP, open a page whose external (CSP-allowed) probe does a remote
		// fetch, and return the fetch status
		async function remoteFetchStatus(sandbox, csp, remoteURL) {
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "remote-fetch-probe.js"),
				"window._fetchStatus = 'pending';\n"
				// no-cors so a CORS rejection isn't mistaken for a CSP block;
				// 127.0.0.1 is loopback, so no mixed-content block either.
				+ `fetch(${JSON.stringify(remoteURL)}, { mode: 'no-cors' }).then(\n`
				+ "  function () { window._fetchStatus = 'allowed'; },\n"
				+ "  function () { window._fetchStatus = 'blocked'; }\n"
				+ ");\n"
			);
			await FileIO.writeUTF8(
				PathUtils.join(tmpDir, "remote-fetch.html"),
				"<!DOCTYPE html><html><head></head><body>"
				+ '<script src="remote-fetch-probe.js"></script></body></html>'
			);
			loadTestScopeWithURI(["default", "window"], csp, sandbox);
			await sandbox.eval("openPluginWindow({ url: 'remote-fetch.html' }).then(function (win) { _win = win; })");
			let contentWin = getLastPluginWindowContent();
			try {
				for (let i = 0; i < 100 && contentWin.wrappedJSObject._fetchStatus === "pending"; i++) {
					await Zotero.Promise.delay(20);
				}
				return contentWin.wrappedJSObject._fetchStatus;
			}
			finally {
				await closeWin("_win", sandbox);
			}
		}

		it("lets a plugin-declared CSP restrict remote subresources (connect-src)", async function () {
			// Cross-origin fetch target (the local test server is a different
			// origin than moz-extension, so connect-src governs it).
			let remoteURL = endpoints.register("GET", function () {
				return [200, "text/plain", "ok"];
			});
			// Both plugins declare a CSP (avoiding the default's
			// upgrade-insecure-requests); they differ ONLY in connect-src.
			let allowed = await remoteFetchStatus(plugin, "script-src 'self'", remoteURL);
			let blocked = await remoteFetchStatus(other, "script-src 'self'; connect-src 'none';", remoteURL);
			assert.equal(allowed, "allowed",
				"without connect-src, the remote fetch is allowed");
			assert.equal(blocked, "blocked",
				"a plugin-declared connect-src 'none' blocks the remote fetch -- the "
				+ "declared page CSP IS enforced for cross-origin subresources");
		});

		// Load the plugin with a declared CSP, open the probe page, and return whether eval() and WebAssembly
		// compilation are permitted
		async function evalWasmStatus(sandbox, csp) {
			loadTestScopeWithURI(["default", "window"], csp, sandbox);
			await sandbox.eval("openPluginWindow({ url: 'csp-inline.html' }).then(function (win) { _win = win; })");
			try {
				let w = getLastPluginWindowContent().wrappedJSObject;
				return { evalStatus: w._evalStatus, wasmStatus: w._wasmStatus };
			}
			finally {
				await closeWin("_win", sandbox);
			}
		}

		it("cannot loosen the CSP to allow eval() -- the base CSP forbids 'unsafe-eval'", async function () {
			// Even declaring 'unsafe-eval' can't re-enable eval: the fixed base
			// CSP co-applies (AND-semantics) and omits 'unsafe-eval'.
			let r = await evalWasmStatus(plugin, "script-src 'self' 'unsafe-eval'");
			assert.equal(r.evalStatus, "blocked",
				"a plugin cannot re-enable eval() -- the base CSP forbids 'unsafe-eval'");
		});

		it("can enable WebAssembly by declaring 'wasm-unsafe-eval' (default blocks it)", async function () {
			// Default page CSP has no 'wasm-unsafe-eval', so wasm is blocked; the
			// base CSP DOES allow it, so a plugin can opt in via its manifest CSP.
			let def = await evalWasmStatus(plugin, null);
			let optIn = await evalWasmStatus(other, "script-src 'self' 'wasm-unsafe-eval'");
			assert.equal(def.wasmStatus, "blocked",
				"default page CSP (no 'wasm-unsafe-eval') blocks WebAssembly");
			assert.equal(optIn.wasmStatus, "allowed",
				"declaring 'wasm-unsafe-eval' enables WebAssembly (base CSP permits it)");
		});

		it("enforces the extension-page CSP: inline + eval blocked; same-origin scripts exempt", async function () {
			// Inline + eval() are blocked, but the page's own same-origin script
			// runs: moz-extension same-origin resources are CSP-exempt in Gecko.
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval("openPluginWindow({ url: 'csp-inline.html' }).then(function (win) { _win = win; })");
			try {
				let w = getLastPluginWindowContent().wrappedJSObject;
				assert.isTrue(w._probeRan, "same-origin external script runs (CSP-exempt)");
				assert.notOk(w._inlineRan, "inline script should be blocked by the extension-page CSP");
				assert.equal(w._evalStatus, "blocked", "eval() should be blocked by the extension-page CSP");
			}
			finally {
				await closeWin();
			}
		});

		it("does not let a plugin loosen its CSP via a <meta> tag (eval stays blocked)", async function () {
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval("openPluginWindow({ url: 'csp-meta.html' }).then(function (win) { _win = win; })");
			try {
				let w = getLastPluginWindowContent().wrappedJSObject;
				assert.isTrue(w._probeRan, "external script should still run");
				assert.equal(w._evalStatus, "blocked",
					"a meta CSP adding 'unsafe-eval' must not override the stricter policy CSP");
			}
			finally {
				await closeWin();
			}
		});


		it("should load relative CSS and JS resources", async function () {
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval("openPluginWindow({ url: 'resources.html' }).then(function (win) { _win = win; })");
			let contentWin = getLastPluginWindowContent();
			try {
				assert.equal(contentWin.document.title, "Resources");
				// JS resource should have executed (check DOM attribute, not expando -- Xrays hide expandos)
				let div = contentWin.document.getElementById("test-div");
				assert.equal(div.getAttribute("data-script-loaded"), "true", "script.js should have executed");
				// CSS resource should have been applied
				let color = contentWin.getComputedStyle(div).color;
				assert.equal(color, "rgb(255, 0, 0)", "style.css should set color to red");
			}
			finally {
				await closeWin();
			}
		});

		it("should open separate windows for each call", async function () {
			loadTestScopeWithURI(["default", "window"]);
			let countBefore = getPluginWindowBrowsers().length;
			await plugin.eval("openPluginWindow({ url: 'test.html' }).then(function (win) { _win1 = win; })");
			await plugin.eval("openPluginWindow({ url: 'test.html' }).then(function (win) { _win2 = win; })");
			try {
				assert.isTrue(plugin.eval("_win1 !== _win2"),
					"Each openWindow call should resolve to a distinct handle");
				assert.equal(getPluginWindowBrowsers().length, countBefore + 2,
					"each call should open its own wrapper window");
			}
			finally {
				await closeWin("_win1");
				await closeWin("_win2");
			}
		});

		it("should not expose privileged APIs in the content window", async function () {
			loadTestScopeWithURI(["default", "window"]);
			await plugin.eval("openPluginWindow({ url: 'privileged.html' }).then(function (win) { _win = win; })");
			try {
				let results = getLastPluginWindowContent().document.getElementById("results");
				// Components is excluded -- it exists in content as a neutered object (accessing properties throws)
				let privilegedAPIs = ["chromeutils", "services", "ioutils", "pathutils", "cu", "cc", "ci", "zotero"];
				for (let api of privilegedAPIs) {
					assert.equal(
						results.getAttribute("data-" + api),
						"undefined",
						`${api} should not be accessible in plugin content window`
					);
				}
				// Components exists but is neutered -- XPCOM instantiation should be blocked
				assert.equal(
					results.getAttribute("data-xpcom-blocked"),
					"true",
					"Components.classes XPCOM instantiation should be blocked"
				);
			}
			finally {
				await closeWin();
			}
		});
	});
});
