describe("HiddenBrowser", function() {
	const { HiddenBrowser } = ChromeUtils.import(
		"chrome://zotero/content/HiddenBrowser.jsm"
	);
	
	describe("#create()", function () {
		var httpd;
		var port = 16213;
		var baseURL = `http://127.0.0.1:${port}/`;
		
		var pngRequested = false;

		before(function () {
			Cu.import("resource://zotero-unit/httpd.js");
			httpd = new HttpServer();
			httpd.start(port);
		});
		
		beforeEach(async function () {
			pngRequested = false;
			httpd.registerPathHandler(
				'/remote.png',
				{
					handle: function (request, response) {
						Zotero.debug('Something loaded the image')
						response.setHeader('Content-Type', 'image/png', false);
						response.setStatusLine(null, 200, 'OK');
						response.write('');
						pngRequested = true;
					}
				}
			);
		});

		after(async function () {
			await new Promise(resolve => httpd.stop(resolve));
		});

		it("should fail on non-2xx response with requireSuccessfulStatus", async function () {
			let browser = new HiddenBrowser();
			let e = await getPromiseError(browser.load(baseURL + 'nonexistent', { requireSuccessfulStatus: true }));
			assert.instanceOf(e, Zotero.HTTP.UnexpectedStatusException);
		});
		
		it("should prevent a remote request with blockRemoteResources", async function () {
			let path = OS.Path.join(getTestDataDirectory().path, 'test-hidden.html');
			let browser = new HiddenBrowser({ blockRemoteResources: true });
			await browser.load(path);
			await browser.getPageData(['characterSet', 'bodyText']);
			browser.destroy();
			assert.isFalse(pngRequested);
		});

		it("should allow a remote request without blockRemoteResources", async function () {
			let path = OS.Path.join(getTestDataDirectory().path, 'test-hidden.html');
			let browser = new HiddenBrowser({ blockRemoteResources: false });
			await browser.load(path);
			await browser.getPageData(['characterSet', 'bodyText']);
			browser.destroy();
			assert.isTrue(pngRequested);
		});
	});

	describe("#load()", function () {
		var httpd;
		var port = 16213;
		var baseURL = `http://127.0.0.1:${port}/`;
		
		async function testNoDownload(path) {
			let browser = new HiddenBrowser({ blockRemoteResources: false });
			await browser._createdPromise;

			let listener;
			let didDownloadPromise = new Promise((resolve) => {
				listener = {
					QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"]),
					onStateChange(webProgress, req, flags, status) {
						req.QueryInterface(Ci.nsIChannel);
						// https://searchfox.org/mozilla-central/rev/729361e481cf63c8d2b5617a6ff589f53e302520/docshell/test/chrome/test_allowContentRetargeting.html#58-65
						if (flags & Ci.nsIWebProgressListener.STATE_STOP && req.URI.filePath === '/' + path) {
							resolve(Components.isSuccessCode(status));
						}
					}
				};
				browser.webProgress.addProgressListener(listener, Ci.nsIWebProgress.NOTIFY_STATE_ALL);
			});

			// Don't await load - it'll just time out
			browser.load(baseURL + path);
			assert.isFalse(await didDownloadPromise);
			assert.isNotNull(listener);
			browser.destroy();
		}

		before(function () {
			Cu.import("resource://zotero-unit/httpd.js");
			httpd = new HttpServer();
			httpd.start(port);

			httpd.registerPathHandler(
				'/download.dat',
				{
					handle: function (request, response) {
						response.setHeader('Content-Type', 'application/octet-stream', false);
						response.setStatusLine(null, 200, 'OK');
						response.write('');
					}
				}
			);

			// Don't show file picker on download - prevents tests from hanging on failure
			Zotero.Prefs.set('browser.download.useDownloadDir', true, true);
		});

		after(async function () {
			await new Promise(resolve => httpd.stop(resolve));
			Zotero.Prefs.clear('browser.download.useDownloadDir', true);
		});

		it("should not download a binary file", async function () {
			await testNoDownload('download.dat');
		});
	});
	
	describe("#getPageData()", function () {
		it("should handle local UTF-8 HTML file", async function () {
			var path = OS.Path.join(getTestDataDirectory().path, 'test-hidden.html');
			var browser = new HiddenBrowser();
			await browser.load(path);
			var { characterSet, bodyText } = await browser.getPageData(['characterSet', 'bodyText']);
			browser.destroy();
			assert.equal(characterSet, 'UTF-8');
			// Should ignore hidden text
			assert.equal(bodyText, 'This is a test.');
		});
		
		it("should handle local GBK HTML file", async function () {
			var path = OS.Path.join(getTestDataDirectory().path, 'charsets', 'gbk.html');
			var browser = new HiddenBrowser();
			await browser.load(path);
			var { characterSet, bodyText } = await browser.getPageData(['characterSet', 'bodyText']);
			browser.destroy();
			assert.equal(characterSet, 'GBK');
			assert.equal(bodyText, '主体');
		});
		
		it("should handle local GBK text file", async function () {
			var path = OS.Path.join(getTestDataDirectory().path, 'charsets', 'gbk.txt');
			var browser = new HiddenBrowser();
			await browser.load(path);
			var { characterSet, bodyText } = await browser.getPageData(['characterSet', 'bodyText']);
			browser.destroy();
			assert.equal(characterSet, 'GBK');
			assert.equal(bodyText, '这是一个测试文件。');
		});
	});

	describe("#getDocument()", function () {
		it("should provide a Document object", async function () {
			let path = OS.Path.join(getTestDataDirectory().path, 'test-hidden.html');
			var browser = new HiddenBrowser();
			await browser.load(path);
			let document = await browser.getDocument();
			assert.include(document.documentElement.innerHTML, 'test');
			assert.ok(document.location);
			assert.strictEqual(document.cookie, '');
		});
	});

	describe("#snapshot()", function () {
		var httpd1;
		var httpd2;
		var port1 = 16213;
		var port2 = 16214;
		var baseURL1 = `http://127.0.0.1:${port1}/`;
		var baseURL2 = `http://127.0.0.1:${port2}/`;

		before(function () {
			Cu.import("resource://zotero-unit/httpd.js");
			// Create two servers with two separate origins
			httpd1 = new HttpServer();
			httpd1.start(port1);
			httpd2 = new HttpServer();
			httpd2.start(port2);
		});

		beforeEach(async function () {
			httpd1.registerPathHandler(
				'/parent',
				{
					handle: function (request, response) {
						response.setHeader('Content-Type', 'text/html', false);
						response.setStatusLine(null, 200, 'OK');
						response.write(`
							<p>This is text in the parent.</p>
							<iframe src="${baseURL2}child">
						`);
					}
				}
			);
			httpd2.registerPathHandler(
				'/child',
				{
					handle: function (request, response) {
						response.setHeader('Content-Type', 'text/html', false);
						response.setStatusLine(null, 200, 'OK');
						response.write('<p>This is text in the child.</p>');
					}
				}
			);
		});

		after(async function () {
			await new Promise(resolve => httpd1.stop(resolve));
			await new Promise(resolve => httpd2.stop(resolve));
		});
		
		it("should return a SingleFile snapshot", async function () {
			let path = OS.Path.join(getTestDataDirectory().path, 'test-hidden.html');
			var browser = new HiddenBrowser();
			await browser.load(path);
			let snapshot = await browser.snapshot();
			assert.include(snapshot, 'Page saved with SingleFile');
			assert.include(snapshot, 'This is hidden text.');
		});
		
		it("should successfully import a snapshot, skipping a cross-origin iframe", async function () {
			let url = baseURL1 + 'parent';
			let browser = new HiddenBrowser();
			await browser.load(url);
			let snapshot = await browser.snapshot();
			assert.include(snapshot, 'This is text in the parent.');
			// Child frame will be skipped
			assert.notInclude(snapshot, 'This is text in the child.');
		});
	});
});
