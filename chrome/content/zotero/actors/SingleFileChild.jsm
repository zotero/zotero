var EXPORTED_SYMBOLS = ["SingleFileChild"];

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

class SingleFileChild extends JSWindowActorChild {
	async receiveMessage(message) {
		let window = this.contentWindow;

		await this.documentIsReady();

		if (message.name !== 'snapshot') {
			return null;
		}

		// Create sandbox for SingleFile
		let sandbox = this.createSnapshotSandbox(window);

		const SCRIPTS = [
			// This first script replace in the INDEX_SCRIPTS from the single file cli loader
			"lib/single-file.js",

			// Web SCRIPTS
			"lib/single-file-hooks-frames.js",
		];

		console.log('Injecting single file scripts');
		// Run all the scripts of SingleFile scripts in Sandbox
		SCRIPTS.forEach(
			script => Services.scriptloader.loadSubScript('resource://zotero/SingleFile/' + script, sandbox)
		);
		// Import config
		Services.scriptloader.loadSubScript('chrome://zotero/content/xpcom/singlefile.js', sandbox);

		// In the client we turn off this auto-zooming feature because it does not work
		// since the hidden browser does not have a clientHeight.
		Cu.evalInSandbox(
			'Zotero.SingleFile.CONFIG.loadDeferredImagesKeepZoomLevel = true;',
			sandbox
		);

		console.log('Injecting single file scripts into frames');

		// List of scripts from:
		// resource/SingleFile/extension/lib/single-file/core/bg/scripts.js
		const frameScripts = [
			"lib/single-file-hooks-frames.js",
			"lib/single-file-frames.js",
		];

		// Create sandboxes for all the frames we find
		const frameSandboxes = [];
		for (let i = 0; i < sandbox.window.frames.length; ++i) {
			let frameSandbox = this.createSnapshotSandbox(sandbox.window.frames[i]);

			// Run all the scripts of SingleFile scripts in Sandbox
			frameScripts.forEach(
				script => Services.scriptloader.loadSubScript('resource://zotero/SingleFile/' + script, frameSandbox)
			);

			frameSandboxes.push(frameSandbox);
		}

		// Use SingleFile to retrieve the html
		const pageData = await Cu.evalInSandbox(
			`this.singlefile.getPageData(
				Zotero.SingleFile.CONFIG,
				{ fetch: ZoteroFetch }
			);`,
			sandbox
		);

		// Clone so we can nuke the sandbox
		let content = pageData.content;

		// Nuke frames and then main sandbox
		frameSandboxes.forEach(frameSandbox => Cu.nukeSandbox(frameSandbox));
		Cu.nukeSandbox(sandbox);

		return content;
	}

	createSnapshotSandbox(view) {
		let sandbox = new Cu.Sandbox(view, {
			wantGlobalProperties: ["XMLHttpRequest", "fetch"],
			sandboxPrototype: view
		});
		sandbox.browser = false;

		sandbox.Zotero = Cu.cloneInto({ HTTP: {} }, sandbox);
		sandbox.Zotero.debug = Cu.exportFunction(obj => console.log(obj), sandbox);
		// Mostly copied from:
		// resources/SingleFile/extension/lib/single-file/fetch/bg/fetch.js::fetchResource
		sandbox.coFetch = Cu.exportFunction(
			function (url, options, onDone) {
				const xhrRequest = new XMLHttpRequest();
				xhrRequest.withCredentials = true;
				xhrRequest.responseType = "arraybuffer";
				xhrRequest.onerror = () => {
					let error = { error: `Request failed for ${url}` };
					onDone(Cu.cloneInto(error, sandbox));
				};
				xhrRequest.onreadystatechange = () => {
					if (xhrRequest.readyState == XMLHttpRequest.DONE) {
						if (xhrRequest.status || xhrRequest.response.byteLength) {
							let res = {
								array: new Uint8Array(xhrRequest.response),
								headers: { "content-type": xhrRequest.getResponseHeader("Content-Type") },
								status: xhrRequest.status
							};
							// Ensure sandbox will have access to response by cloning
							onDone(Cu.cloneInto(res, sandbox));
						}
						else {
							let error = { error: 'Bad Status or Length' };
							onDone(Cu.cloneInto(error, sandbox));
						}
					}
				};
				xhrRequest.open("GET", url, true);
				if (options && options.headers) {
					for (const entry of Object.entries(options.headers)) {
						xhrRequest.setRequestHeader(entry[0], entry[1]);
					}
				}
				xhrRequest.send();
			},
			sandbox
		);

		// First we try regular fetch, then proceed with fetch outside sandbox to evade CORS
		// restrictions, partly from:
		// resources/SingleFile/extension/lib/single-file/fetch/content/content-fetch.js::fetch
		Cu.evalInSandbox(
			`
			ZoteroFetch = async function (url, options) {
				try {
					let response = await fetch(url, { cache: "force-cache", headers: options.headers });
					return response;
				}
				catch (error) {
					let response = await new Promise((resolve, reject) => {
						coFetch(url, { headers: options.headers }, (response) => {
							if (response.error) {
								Zotero.debug("Error retrieving url: " + url);
								Zotero.debug(response);
								reject(new Error(response.error));
							}
							else {
								resolve(response);
							}
						});
					});

					return {
						status: response.status,
						headers: { get: headerName => response.headers[headerName] },
						arrayBuffer: async () => response.array.buffer
					};
				}
			};`,
			sandbox
		);

		return sandbox;
	}

	// From Mozilla's ScreenshotsComponentChild.jsm
	documentIsReady() {
		const contentWindow = this.contentWindow;
		const document = this.document;

		function readyEnough() {
			return document.readyState === "complete";
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
}
