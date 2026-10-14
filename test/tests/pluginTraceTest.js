describe("PluginTrace", function () {
	var plugin = usePluginSandbox();

	// Ensure the trace module is loaded
	ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/trace.mjs");
	var traceLines;
	var listener;

	function startCapture() {
		traceLines = [];
		listener = (line) => {
			if (line.includes("[PluginTrace]")) {
				traceLines.push(line);
			}
		};
		Zotero.Debug.addListener(listener);
	}

	function stopCapture() {
		Zotero.Debug.removeListener(listener);
	}

	function findTrace(type, pathSubstring) {
		return traceLines.find(l => l.includes(`[${type}]`) && l.includes(pathSubstring));
	}

	afterEach(function () {
		stopCapture();
	});

	describe("property access tracing", function () {
		beforeEach(function () {
			plugin.load(["default"]);
			startCapture();
		});

		it("should trace get of a leaf property", function () {
			plugin.eval("Zotero.version");
			let line = findTrace("get", "Zotero.version");
			assert.ok(line, "Should have a [get] trace for Zotero.version");
			assert.include(line, plugin.id);
		});
	});

	describe("function call tracing", function () {
		beforeEach(function () {
			plugin.load(["default"]);
			startCapture();
		});

		it("should trace a function call with timing", function () {
			plugin.eval("Zotero.debug('trace test')");
			let line = findTrace("call", "Zotero.debug");
			assert.ok(line, "Should have a [call] trace for Zotero.debug");
			assert.include(line, plugin.id);
			assert.match(line, /\(\d+(\.\d+)?ms\)/, "Should include timing");
		});

		it("should trace nested namespace function calls", function () {
			plugin.eval("Zotero.Utilities.randomString()");
			let line = findTrace("call", "Zotero.Utilities.randomString");
			assert.ok(line, "Should have a [call] trace for Zotero.Utilities.randomString");
		});
	});

	describe("constructor tracing", function () {
		beforeEach(function () {
			plugin.load(["default"]);
			startCapture();
		});

		it("should trace Localization constructor", function () {
			plugin.eval("new Localization(['zotero.ftl'])");
			let line = findTrace("construct", "Localization");
			assert.ok(line, "Should have a [construct] trace for Localization");
			assert.include(line, plugin.id);
			assert.match(line, /\(\d+(\.\d+)?ms\)/, "Should include timing");
		});
	});

	describe("hook tracing", function () {
		beforeEach(function () {
			plugin.load(["default", "dataRead"]);
			startCapture();
		});

		it("should trace hooks passed via fromScope (Notifier)", async function () {
			let observerID = plugin.eval(`
					var _observerID = Zotero.Notifier.registerObserver(
						{ notify: function testHook() {} },
						['item']
					);
					_observerID;
				`);
			// Trigger the observer -- trigger is async
			await Zotero.Notifier.trigger('modify', 'item', []);
			let line = traceLines.find(l => l.includes("[hook]"));
			assert.ok(line, "Should have a [hook] trace. All traces: " + JSON.stringify(traceLines));
			assert.include(line, plugin.id);

			Zotero.Notifier.unregisterObserver(observerID);
		});
	});

	describe("instance method tracing", function () {
		beforeEach(function () {
			plugin.load(["default", "userPrompt"]);
			startCapture();
		});

		it("should trace method calls on returned instances", function () {
			// The window is never shown, so the line's DOM work stays queued and nothing opens
			plugin.eval(`(() => {
				let progressWindow = new Zotero.ProgressWindow();
				new progressWindow.ItemProgress("book", "Title").setText("Other");
			})()`);
			let constructLine = findTrace("construct", "Zotero.ProgressWindow");
			assert.ok(constructLine, "Should have a [construct] trace for Zotero.ProgressWindow");

			let methodLine = traceLines.find(l => l.includes("[call]") && l.includes("setText"));
			assert.ok(methodLine, "Should have a [call] trace for setText. All call traces: "
				+ JSON.stringify(traceLines.filter(l => l.includes("[call]"))));
			assert.include(methodLine, plugin.id);
		});

		it("should trace getter access on returned instances", function () {
			plugin.eval("new Zotero.ProgressWindow().changeHeadline");
			let getLine = traceLines.find(l => l.includes("[get]") && /\.changeHeadline\b/.test(l));
			assert.ok(getLine, "Should have a [get] trace for changeHeadline");
		});
	});

	describe("console tracing", function () {
		beforeEach(function () {
			plugin.load(["default"]);
			startCapture();
		});

		it("should trace console method calls", function () {
			plugin.eval("console.log('trace test')");
			let line = findTrace("call", "console.log");
			assert.ok(line, "Should have a [call] trace for console.log");
		});
	});

	describe("request tracing", function () {
		it("should trace a controller request by name, with its outcome", async function () {
			plugin.load(["default", "window"]);
			startCapture();
			await plugin.eval('Zotero.WindowController.query("windows", { type: "mainWindow" })');
			let line = findTrace("call", "Zotero.WindowController.query:windows");
			assert.ok(line, "Should have a [call] trace naming the request. All traces: " + JSON.stringify(traceLines));
			assert.include(line, plugin.id);
			assert.notInclude(line, "failed");
			await plugin.eval('Zotero.WindowController.query("nope")');
			line = findTrace("call", "Zotero.WindowController.query:nope");
			assert.ok(line, "Should trace a failed request too");
			assert.include(line, "failed: UnknownRequest");
		});

		it("should trace a call that throws", function () {
			plugin.load(["default", "preferences"]);
			startCapture();
			// The boundary replaces a chrome error's message, so only the throw itself is asserted
			assert.throws(() => plugin.eval("Zotero.Prefs.resetBranch()"));
			let line = findTrace("call", "Zotero.Prefs.resetBranch");
			assert.ok(line, "Should have a [call] trace for the failed call. All traces: " + JSON.stringify(traceLines));
			assert.include(line, "failed: Error");
		});
	});
});
