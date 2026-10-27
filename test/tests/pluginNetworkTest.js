describe("Plugin network access", function () {
	var plugin = usePluginSandbox();
	var endpoints = useTestEndpoints();
	var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");
	var dir;

	const LOCAL_ORIGINS = ["*://127.0.0.1/*"];

	before(async function () {
		dir = await getTempDirectory();
		await FileIO.writeUTF8(PathUtils.join(dir, "fetch.js"),
			"onmessage = e => fetch(e.data, { mode: 'no-cors' }).then(() => postMessage('sent'), () => postMessage('blocked'));\n");
	});

	after(async function () {
		await IOUtils.remove(dir, { recursive: true });
	});

	// A local endpoint that counts the requests reaching it
	function countingEndpoint() {
		let endpoint = { hits: 0 };
		endpoint.url = endpoints.register("GET", function () {
			endpoint.hits++;
			return [200, "text/plain", "ok"];
		});
		return endpoint;
	}

	function load(origins = [], permissions = ["default"], contentSecurityPolicy = "script-src 'self'") {
		plugin.load(permissions, { origins, resourceURI: PathUtils.toFileURI(dir) + "/", contentSecurityPolicy });
	}

	// A no-cors fetch resolves with an opaque response from any host, so only the gate can reject it
	function fetchStatus(url) {
		return plugin.run(url => fetch(url, { mode: "no-cors" }).then(() => "sent", () => "blocked"), url);
	}

	it("should not send a request to a host outside host_permissions", async function () {
		load();
		let endpoint = countingEndpoint();
		assert.equal(await fetchStatus(endpoint.url), "blocked");
		assert.equal(endpoint.hits, 0);
	});

	it("should send a request to a host in host_permissions", async function () {
		load(LOCAL_ORIGINS);
		let endpoint = countingEndpoint();
		assert.equal(await fetchStatus(endpoint.url), "sent");
		assert.equal(endpoint.hits, 1);
	});

	it("should follow a redirect only to a host in host_permissions", async function () {
		let target = countingEndpoint();
		// The same server under another host
		let targetURL = target.url.replace("127.0.0.1", "localhost");
		let redirectURL = endpoints.register("GET", () => [302, { Location: targetURL }]);

		load(LOCAL_ORIGINS);
		assert.equal(await fetchStatus(redirectURL), "blocked");
		assert.equal(target.hits, 0);

		load([...LOCAL_ORIGINS, "*://localhost/*"]);
		assert.equal(await fetchStatus(redirectURL), "sent");
		assert.equal(target.hits, 1);
	});

	it("should bound Zotero.HTTP to host_permissions", async function () {
		// It requests through the sandbox's own XMLHttpRequest
		let httpStatus = url => Zotero.HTTP.request("GET", url).then(() => "sent", () => "blocked");
		let endpoint = countingEndpoint();

		load();
		assert.equal(await plugin.run(httpStatus, endpoint.url), "blocked");
		assert.equal(endpoint.hits, 0);

		load(LOCAL_ORIGINS);
		assert.equal(await plugin.run(httpStatus, endpoint.url), "sent");
		assert.equal(endpoint.hits, 1);
	});

	it("should bound the plugin's workers to host_permissions", async function () {
		let workerFetch = url => new Promise((resolve) => {
			let worker = new Worker("fetch.js");
			worker.onmessage = (event) => {
				worker.terminate();
				resolve(event.data);
			};
			worker.postMessage(url);
		});
		let endpoint = countingEndpoint();

		load();
		assert.equal(await plugin.run(workerFetch, endpoint.url), "blocked");
		assert.equal(endpoint.hits, 0);

		load(LOCAL_ORIGINS);
		assert.equal(await plugin.run(workerFetch, endpoint.url), "sent");
		assert.equal(endpoint.hits, 1);
	});

	it("should not send requests the plugin left running after it unloads", async function () {
		load(LOCAL_ORIGINS);
		let endpoint = countingEndpoint();
		// The sandbox lives on for a while after the unload, and the harness still evaluates in it
		plugin.unload();
		assert.equal(await fetchStatus(endpoint.url), "blocked");
		assert.equal(endpoint.hits, 0);
	});

	describe("plugin pages", function () {
		const OPEN_PAGE = "Zotero.WindowController.command('openPluginWindow', { url: 'page.html' })"
			+ ".then(r => { if (!r.success) throw new Error(r.error.code + ': ' + r.error.message); _win = r.result; })";

		afterEach(async function () {
			await plugin.eval("typeof _win == 'object' && Zotero.WindowController.command('closeWindow', { windowID: _win.windowID })");
		});

		// The page browser of the newest plugin window
		function getPageBrowser() {
			let wins = [...Services.wm.getEnumerator(null)]
				.filter(win => win.location.href === "chrome://zotero/content/pluginWindow.xhtml");
			return wins.at(-1).document.getElementById("plugin-browser");
		}

		async function openPage(origins, body, script, contentSecurityPolicy) {
			await FileIO.writeUTF8(PathUtils.join(dir, "page.html"),
				`<!DOCTYPE html><html><body>${body}<script src="page.js"></script></body></html>`);
			await FileIO.writeUTF8(PathUtils.join(dir, "page.js"), script);
			load(origins, ["default", "window"], contentSecurityPolicy);
			// Resolves once the page has loaded, its images and frames included
			await plugin.eval(OPEN_PAGE);
			return getPageBrowser().contentWindow.wrappedJSObject;
		}

		it("should bound the page's subresources, opaque frames and fetches to host_permissions", async function () {
			for (let [origins, status, hits] of [[[], "blocked", 0], [LOCAL_ORIGINS, "sent", 1]]) {
				let image = countingEndpoint();
				let frameImage = countingEndpoint();
				let fetched = countingEndpoint();
				// A sandboxed frame has an opaque origin, which remembers the page's
				await FileIO.writeUTF8(PathUtils.join(dir, "frame.html"), `<img src="${frameImage.url}">`);
				let win = await openPage(origins, `<img src="${image.url}"><iframe sandbox src="frame.html"></iframe>`,
					`window._status = "pending";\n`
					+ `fetch(${JSON.stringify(fetched.url)}, { mode: "no-cors" }).then(() => { window._status = "sent"; }, () => { window._status = "blocked"; });\n`);
				for (let i = 0; i < 100 && win._status === "pending"; i++) {
					await Zotero.Promise.delay(20);
				}
				assert.equal(win._status, status);
				assert.deepEqual([image.hits, frameImage.hits, fetched.hits], [hits, hits, hits]);
				await plugin.eval("Zotero.WindowController.command('closeWindow', { windowID: _win.windowID })");
			}
		});

		it("should not open a page's navigation to a host outside host_permissions in the browser", async function () {
			let stub = sinon.stub(Zotero, "launchURL");
			try {
				for (let [origins, opened] of [[[], false], [LOCAL_ORIGINS, true]]) {
					stub.resetHistory();
					let endpoint = countingEndpoint();
					// A blocked navigation throws
					let win = await openPage(origins, "", `window.navigateAway = () => { try { location.href = ${JSON.stringify(endpoint.url)}; } catch {} };\n`);
					// From the page's own script, as a link or a redirecting script would
					win.navigateAway();
					for (let i = 0; i < 25 && !stub.called; i++) {
						await Zotero.Promise.delay(20);
					}
					assert.equal(stub.calledWith(endpoint.url), opened);
					assert.equal(endpoint.hits, 0);
					await plugin.eval("Zotero.WindowController.command('closeWindow', { windowID: _win.windowID })");
				}
			}
			finally {
				stub.restore();
			}
		});

		it("should not send the page's CSP violation reports to a host outside host_permissions", async function () {
			for (let [origins, hits] of [[[], 0], [LOCAL_ORIGINS, 1]]) {
				let report = { hits: 0 };
				report.url = endpoints.register("POST", function () {
					report.hits++;
					return 204;
				});
				// A declared CSP can only restrict, but its report-uri is a request of its own
				await openPage(origins, `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`, "",
					`script-src 'self'; img-src 'self'; report-uri ${report.url}`);
				for (let i = 0; i < 50 && !report.hits; i++) {
					await Zotero.Promise.delay(20);
				}
				assert.equal(report.hits, hits);
				await plugin.eval("Zotero.WindowController.command('closeWindow', { windowID: _win.windowID })");
			}
		});

		it("should give the page no WebRTC, whose connections no content policy sees", async function () {
			let win = await openPage(LOCAL_ORIGINS, "", "window._rtc = typeof RTCPeerConnection;\n");
			assert.equal(win._rtc, "undefined");
		});

		it("should not hand the page's mailto: links to another application", async function () {
			// Records what Gecko would hand to the OS handler
			let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
			let contractID = "@mozilla.org/content-dispatch-chooser;1";
			let originalCID = registrar.contractIDToCID(contractID);
			let mockCID = Services.uuid.generateUUID();
			let handled = [];
			let chooser = {
				QueryInterface: ChromeUtils.generateQI(["nsIFactory", "nsIContentDispatchChooser"]),
				createInstance(iid) {
					return this.QueryInterface(iid);
				},
				async handleURI(handler, uri) {
					handled.push(uri.spec);
				},
			};
			registrar.registerFactory(mockCID, "", contractID, chooser);
			try {
				let win = await openPage([], "", `window.mailTo = () => { try { location.href = "mailto:a@example.com?body=b"; } catch {} };\n`);
				win.mailTo();
				// Zotero's own navigation still goes through
				getPageBrowser().loadURI(Services.io.newURI("mailto:c@example.com"), {
					triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
				});
				for (let i = 0; i < 50 && !handled.length; i++) {
					await Zotero.Promise.delay(20);
				}
				assert.deepEqual(handled, ["mailto:c@example.com"]);
			}
			finally {
				registrar.unregisterFactory(mockCID, chooser);
				registrar.registerFactory(originalCID, "", contractID, null);
			}
		});
	});
});
