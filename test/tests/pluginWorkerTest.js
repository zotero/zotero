describe("Plugin Worker", function () {
	var plugin = usePluginSandbox();
	var { PluginWorkers } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/workers.mjs");
	var dir, root;

	before(async function () {
		dir = await getTempDirectory();
		root = PathUtils.toFileURI(dir);
		if (!root.endsWith("/")) {
			root += "/";
		}
		await IOUtils.writeUTF8(PathUtils.join(dir, "echo.js"),
			"onmessage = e => postMessage({ echo: e.data, name: self.name, origin: self.location.origin });\n");
		await IOUtils.writeUTF8(PathUtils.join(dir, "clone.js"), `
onmessage = (e) => {
	let { map, date, bytes, buffer } = e.data;
	postMessage({ map: [...map.entries()], date: date.getTime(), bytes: Array.from(bytes), bufferLength: buffer.byteLength, back: new Map([["k", 1]]), bytesBack: new Uint8Array([9]) });
};
`);
		await IOUtils.writeUTF8(PathUtils.join(dir, "reach.js"), `
let out = { origin: self.location.origin, chromeUtils: typeof ChromeUtils };
try { eval("1"); out.eval = "allowed"; } catch (e) { out.eval = "blocked"; }
try { importScripts("https://example.com/x.js"); out.importRemote = "allowed"; } catch (e) { out.importRemote = "blocked"; }
(async () => {
	try { await fetch("file:///etc/hosts"); out.fetchFile = "allowed"; } catch (e) { out.fetchFile = "blocked"; }
	postMessage(out);
})();
`);
		await IOUtils.writeUTF8(PathUtils.join(dir, "mod.mjs"), "postMessage({ moduleURL: import.meta.url });\n");
		await IOUtils.writeUTF8(PathUtils.join(dir, "throws.js"), "throw new Error(\"boom\");\n");
	});

	after(async function () {
		await IOUtils.remove(dir, { recursive: true });
	});

	beforeEach(function () {
		plugin.load(["default"], { resourceURI: root });
	});

	it("should be the DOM Worker, running under the plugin's origin", async function () {
		let result = await plugin.run(() => new Promise((resolve, reject) => {
			let worker = new Worker("echo.js", { name: "echoer" });
			worker.onmessage = (event) => {
				worker.terminate();
				// Posting after terminate is a no-op
				worker.postMessage("late");
				resolve({
					data: event.data,
					type: event.type,
					eventTag: Object.prototype.toString.call(event),
					isTrusted: event.isTrusted,
					targetIsWorker: event.target === worker,
					instance: worker instanceof Worker,
					tag: Object.prototype.toString.call(worker),
					handlers: [typeof worker.onmessage, typeof worker.onerror, worker.onmessageerror],
				});
			};
			worker.onerror = event => reject(new Error(event.message));
			worker.postMessage({ n: 1, list: [1, 2] });
		}));
		assert.deepEqual(result, {
			data: { echo: { n: 1, list: [1, 2] }, name: "echoer", origin: "moz-extension://" + plugin.uuid },
			type: "message",
			eventTag: "[object MessageEvent]",
			isTrusted: true,
			targetIsWorker: true,
			instance: true,
			tag: "[object Worker]",
			handlers: ["function", "function", null],
		});
	});

	it("should structured-clone both ways and transfer a buffer", async function () {
		let result = await plugin.run(() => new Promise((resolve, reject) => {
			let worker = new Worker("clone.js");
			let buffer = new ArrayBuffer(4);
			worker.addEventListener("message", (event) => {
				// What arrives is the host document's, usable as is
				let { back, bytesBack, ...rest } = event.data;
				resolve({
					...rest,
					back: [...back.entries()],
					bytesBack: Array.from(bytesBack),
					usable: [Array.isArray(rest.map), back.get("k"), bytesBack[0], new Uint8Array(bytesBack.buffer).length],
					sourceLengthAfterTransfer: buffer.byteLength,
				});
			});
			worker.onerror = event => reject(new Error(event.message));
			worker.postMessage({ map: new Map([["a", 1]]), date: new Date(0), bytes: new Uint8Array([7, 8]), buffer }, [buffer]);
		}));
		assert.deepEqual(result, {
			map: [["a", 1]],
			date: 0,
			bytes: [7, 8],
			bufferLength: 4,
			back: [["k", 1]],
			bytesBack: [9],
			usable: [true, 1, 9, 1],
			sourceLengthAfterTransfer: 0,
		});
	});

	it("should deliver messages posted before the worker runs, in order", async function () {
		let result = await plugin.run(() => new Promise((resolve) => {
			let worker = new Worker("echo.js");
			let seen = [];
			worker.onmessage = (event) => {
				seen.push(event.data.echo);
				if (seen.length === 3) {
					resolve(seen);
				}
			};
			worker.postMessage(1);
			worker.postMessage(2);
			worker.postMessage(3);
		}));
		assert.deepEqual(result, [1, 2, 3]);
	});

	it("should support once listeners, removal, handleEvent objects and dispatchEvent", async function () {
		let result = await plugin.run(() => new Promise((resolve) => {
			let worker = new Worker("echo.js");
			let seen = [];
			let removed = () => seen.push("removed");
			worker.addEventListener("message", event => seen.push("once:" + event.data.echo), { once: true });
			worker.addEventListener("message", removed);
			worker.removeEventListener("message", removed);
			worker.addEventListener("message", { handleEvent: event => seen.push("object:" + event.data.echo) });
			worker.addEventListener("ping", event => seen.push("ping:" + event.detail));
			worker.addEventListener("message", (event) => {
				if (event.data.echo === 2) {
					let ping = new Event("ping");
					ping.detail = "x";
					let dispatched = worker.dispatchEvent(ping);
					resolve({ seen, dispatched });
				}
			});
			worker.postMessage(1);
			worker.postMessage(2);
		}));
		assert.deepEqual(result, { seen: ["once:1", "object:1", "object:2", "ping:x"], dispatched: true });
	});

	it("should report a script error as an ErrorEvent that preventDefault marks handled", async function () {
		let result = await plugin.run(() => new Promise((resolve) => {
			let worker = new Worker("throws.js");
			worker.onerror = (event) => {
				event.preventDefault();
				resolve({ tag: Object.prototype.toString.call(event), message: event.message, filename: event.filename, lineno: event.lineno, prevented: event.defaultPrevented });
			};
		}));
		assert.equal(result.tag, "[object ErrorEvent]");
		assert.include(result.message, "boom");
		assert.equal(result.filename, "moz-extension://" + plugin.uuid + "/throws.js");
		assert.equal(result.lineno, 1);
		assert.isTrue(result.prevented);
	});

	it("should fire an error event for a script it cannot load, inside or outside the plugin", async function () {
		let result = await plugin.run(() => Promise.all(["missing.js", "file:///etc/x.js"].map(src => new Promise((resolve) => {
			let worker = new Worker(src);
			worker.addEventListener("error", (event) => {
				event.preventDefault();
				resolve(event.type);
			});
			worker.onmessage = () => resolve("ran");
		}))));
		assert.deepEqual(result, ["error", "error"]);
	});

	it("should throw for a bad worker type", async function () {
		let result = await plugin.run(() => {
			try {
				new Worker("echo.js", { type: "shared" });
				return "created";
			}
			catch (e) {
				return e.name;
			}
		});
		assert.equal(result, "TypeError");
	});

	it("should run a module worker", async function () {
		let result = await plugin.run(() => new Promise((resolve, reject) => {
			let worker = new Worker("mod.mjs", { type: "module" });
			worker.onmessage = event => resolve(event.data);
			worker.onerror = event => reject(new Error(event.message));
		}));
		assert.deepEqual(result, { moduleURL: "moz-extension://" + plugin.uuid + "/mod.mjs" });
	});

	it("should give the worker the plugin's CSP and nothing of chrome", async function () {
		let result = await plugin.run(() => new Promise((resolve, reject) => {
			let worker = new Worker("reach.js");
			worker.onmessage = event => resolve(event.data);
			worker.onerror = event => reject(new Error(event.message));
		}));
		assert.deepEqual(result, {
			origin: "moz-extension://" + plugin.uuid,
			chromeUtils: "undefined",
			eval: "blocked",
			importRemote: "blocked",
			fetchFile: "blocked",
		});
	});

	it("should conjure the host document under the plugin's origin, CSP and root", async function () {
		await plugin.run(() => new Promise((resolve) => {
			let worker = new Worker("echo.js");
			worker.onmessage = resolve;
			worker.postMessage(1);
		}));
		let doc = PluginWorkers._hosts.get(plugin.id).browser.docShell.domWindow.document;
		assert.equal(doc.nodePrincipal.origin, "moz-extension://" + plugin.uuid);
		assert.equal(doc.baseURI, "moz-extension://" + plugin.uuid + "/");
		assert.equal(doc.policyContainer.csp.policyCount, 2);
		// An inline script, which the plugin's CSP forbids, does not run there
		let script = doc.createElement("script");
		script.textContent = "window.__inline = 1";
		doc.documentElement.append(script);
		assert.isUndefined(doc.defaultView.wrappedJSObject.__inline);
	});

	it("should end the plugin's workers with its host document at unload", async function () {
		// Held from chrome, so it outlives the sandbox and shows whether the close reached it
		let worker = await plugin.run(() => new Promise((resolve) => {
			let worker = new Worker("echo.js");
			worker.onmessage = () => resolve();
			worker.postMessage(1);
		})).then(() => {
			let { Worker } = PluginWorkers._hosts.get(plugin.id);
			return new Worker("echo.js");
		});
		let replies = 0;
		worker.addEventListener("message", () => replies++);
		worker.postMessage(1);
		await waitForCallback(() => replies === 1, 20, 2);
		plugin.unload();
		assert.isFalse(PluginWorkers._hosts.has(plugin.id));
		worker.postMessage(2);
		await Zotero.Promise.delay(200);
		assert.equal(replies, 1);
	});
});
