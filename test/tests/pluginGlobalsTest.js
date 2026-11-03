describe("Plugin globals", function () {
	var plugin = usePluginSandbox();
	var other = usePluginSandbox({ id: "other-globals-plugin@zotero.org" });
	var dir;

	before(async function () {
		dir = await getTempDirectory();
		await IOUtils.writeUTF8(PathUtils.join(dir, "own.js"), "globalThis.loaded = true;");
		await IOUtils.writeUTF8(PathUtils.join(dir, "private.ftl"), "private-message = Private fixture content\n");
	});

	after(async function () {
		await IOUtils.remove(dir, { recursive: true });
	});

	beforeEach(function () {
		plugin.load(["default"]);
	});

	it("should load only scripts belonging to the plugin", function () {
		plugin.load(["default"], { resourceURI: PathUtils.toFileURI(dir) + "/", origins: ["<all_urls>"] });
		plugin.run(() => loadSubScript("own.js"));
		assert.isTrue(plugin.eval("loaded"));
		assert.throws(() => plugin.run(url => loadSubScript(url), PathUtils.toFileURI(PathUtils.join(dir, "own.js"))));
		assert.throws(() => plugin.run(() => loadSubScript("https://example.com/script.js")));
	});

	it("should schedule and cancel timers with callback arguments", async function () {
		assert.deepEqual(await plugin.run(() => new Promise((resolve) => {
			let calls = [];
			let canceled = setTimeout(() => calls.push("canceled"), 0);
			clearTimeout(canceled);
			let interval = setInterval((value) => {
				calls.push(value);
				clearInterval(interval);
				setTimeout(last => resolve([...calls, last]), 0, "timeout");
			}, 0, "interval");
		})), ["interval", "timeout"]);
	});

	it("should not let a plugin cancel another plugin's timers", async function () {
		other.load(["default"]);
		let id = other.run(() => {
			globalThis.timerRan = false;
			return setTimeout(() => {
				globalThis.timerRan = true;
			}, 0);
		});
		plugin.run(id => clearTimeout(id), id);
		await plugin.run(() => new Promise(resolve => setTimeout(resolve, 0)));
		assert.isTrue(other.eval("timerRan"));
	});

	it("should provide usable idle deadlines and support cancellation", async function () {
		let result = await plugin.run(() => new Promise((resolve) => {
			let canceled = requestIdleCallback(() => {
				globalThis.canceledIdleRan = true;
			});
			cancelIdleCallback(canceled);
			requestIdleCallback(deadline => resolve({
				timeout: typeof deadline.didTimeout,
				remaining: typeof deadline.timeRemaining(),
				canceled: globalThis.canceledIdleRan === true,
			}), { timeout: 100 });
		}));
		assert.deepEqual(result, { timeout: "boolean", remaining: "number", canceled: false });
	});

	it("should not let a plugin cancel another plugin's idle callbacks", async function () {
		other.load(["default"]);
		let result = other.run(() => new Promise((resolve) => {
			globalThis.idleID = requestIdleCallback(() => resolve("ran"), { timeout: 100 });
		}));
		plugin.run(id => cancelIdleCallback(id), other.eval("idleID"));
		assert.equal(await result, "ran");
	});

	it("should cancel callbacks and reject scheduling after scope unload", async function () {
		other.load(["default"]);
		plugin.run(() => {
			globalThis.calls = 0;
			setTimeout(() => globalThis.calls++, 0);
			setInterval(() => globalThis.calls++, 0);
			requestIdleCallback(() => globalThis.calls++, { timeout: 100 });
		});
		plugin.unload();
		await other.run(() => new Promise(resolve => setTimeout(resolve, 0)));
		await other.run(() => new Promise(resolve => requestIdleCallback(() => resolve(), { timeout: 100 })));
		assert.equal(plugin.eval("calls"), 0);
		assert.throws(() => plugin.eval("setTimeout(() => {}, 0)"));
		assert.throws(() => plugin.eval("requestIdleCallback(() => {})"));
	});

	it("should not expose chrome through global function constructors", function () {
		let result = plugin.run(() => {
			let functions = [
				DOMParser,
				Worker,
				Localization,
				setTimeout,
				requestIdleCallback,
				console.log,
			];
			return functions.map((fn) => {
				try {
					return fn.constructor("return [typeof Components, typeof ChromeUtils, typeof Services].join(',')")();
				}
				catch {
					return "blocked";
				}
			});
		});
		assert.isTrue(result.every(value => value === "blocked" || value === "undefined,undefined,undefined"));
	});

	it("should not load arbitrary local files through Localization", async function () {
		let url = PathUtils.toFileURI(PathUtils.join(dir, "private.ftl"));
		let result = await plugin.run(url => new Localization([url]).formatValue("private-message"), url);
		assert.isNull(result);
	});
});
