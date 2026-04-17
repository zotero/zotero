describe("Zotero.HTTP", function () {
	var server;
	var httpd;
	var port = 16213;
	var baseURL = `http://127.0.0.1:${port}/`
	var testURL = baseURL + 'test.html';
	var redirectLocation = baseURL + 'test2.html';
	
	function setResponse(response) {
		setHTTPResponse(server, baseURL, response, {});
	}
	
	
	before(function* () {
		// Real HTTP server
		var { HttpServer } = ChromeUtils.importESModule("chrome://remote/content/server/httpd.sys.mjs");;
		httpd = new HttpServer();
		httpd.start(port);
		httpd.registerPathHandler(
			'/test.html',
			{
				handle: function (request, response) {
					response.setStatusLine(null, 200, "OK");
					response.write("<html><body><p>Test</p><p>Test 2</p></body></html>");
				}
			}
		);
		httpd.registerPathHandler(
			'/redirect',
			{
				handle: function (request, response) {
					response.setHeader('Location', redirectLocation);
					response.setHeader('X-Custom', 'redirect-value', false);
					response.setStatusLine(null, 301, "Moved Permanently");
					response.write(`<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head>\n<title>301 Moved Permanently</title>\n</head><body>\n<h1>Moved Permanently</h1>\n<p>The document has moved <a href="${redirectLocation}">here</a>.</p>\n</body></html>`);
				}
			}
		);
		httpd.registerPathHandler(
			'/test-redirect.html',
			{
				handle: function (request, response) {
					response.setHeader("Content-Type", 'text/html', false);
					response.setStatusLine(null, 200, "OK");
					response.write("<html><head><meta http-equiv=\"refresh\" content=\"2;url=test.html\"/></head><body></body></html>");
				}
			}
		);
		httpd.registerPathHandler(
			'/requireJSON',
			{
				handle(request, response) {
					if (request.getHeader('Content-Type') == 'application/json') {
						response.setStatusLine(null, 200, "OK");
					}
					else {
						response.setStatusLine(null, 400, "Bad Request");
					}
					response.write('JSON required');
				}
			}
		);
		// Returns 200 if the "authed" cookie is present, 403 otherwise.
		// Always sets the "authed" cookie in the response.
		httpd.registerPathHandler(
			'/cookie-check',
			{
				handle(request, response) {
					let hasCookie = false;
					try {
						let cookies = request.getHeader('Cookie');
						hasCookie = cookies.includes('authed=yes');
					}
					catch {}
					response.setHeader('Set-Cookie', 'authed=yes; Path=/', false);
					if (hasCookie) {
						response.setStatusLine(null, 200, "OK");
						response.write("authenticated");
					}
					else {
						response.setStatusLine(null, 403, "Forbidden");
						response.write("no cookie");
					}
				}
			}
		);
	});
	
	beforeEach(function () {
		// Fake XHR, which can be disabled per test with `Zotero.HTTP.mock = null`
		Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
		server = sinon.fakeServer.create();
		server.autoRespond = true;
	});
	
	afterEach(async function () {
		// Allow requests to settle
		await Zotero.Promise.delay(50);
	});
	
	after(function* () {
		var defer = Zotero.Promise.defer();
		httpd.stop(() => defer.resolve());
		yield defer.promise;
		
		Zotero.HTTP.mock = null;
	});
	
	
	describe("#request()", function () {
		it("should succeed with 3xx status if followRedirects is false", async function () {
			Zotero.HTTP.mock = null;
			var req = await Zotero.HTTP.request(
				'GET',
				baseURL + 'redirect',
				{
					followRedirects: false
				}
			);
			assert.equal(req.status, 301);
			assert.equal(req.getResponseHeader('Location'), redirectLocation);
			assert.equal(req.getResponseHeader('X-Custom'), 'redirect-value');
		});
		
		it("should catch an interrupted connection", async function () {
			setResponse({
				method: "GET",
				url: "empty",
				status: 0,
				text: ""
			})
			var e = await getPromiseError(Zotero.HTTP.request("GET", baseURL + "empty"));
			assert.ok(e);
			assert.equal(e.message, Zotero.getString('sync.error.checkConnection'));
		});
		
		it("should provide cancellerReceiver with a callback to cancel a request", async function () {
			var timeoutID;
			server.autoRespond = false;
			server.respondWith(function (req) {
				if (req.method == "GET" && req.url == baseURL + "slow") {
					req.respond(
						200,
						{},
						"OK"
					);
				}
			});
			
			setTimeout(function () {
				cancel();
			}, 50);
			var e = await getPromiseError(Zotero.HTTP.request(
				"GET",
				baseURL + "slow",
				{
					cancellerReceiver: function (f) {
						cancel = f;
					}
				}
			));
			
			assert.instanceOf(e, Zotero.HTTP.CancelledException);
			server.respond();
		});
		
		it("should process headers case insensitively", async function () {
			Zotero.HTTP.mock = null;
			var req = await Zotero.HTTP.request(
				'GET',
				baseURL + 'requireJSON',
				{
					headers: {
						'content-type': 'application/json'
					}
				}
			);
			assert.equal(req.status, 200);
		});
		
		describe("Retries", function () {
			var spy;
			var delayStub;

			before(async function () {
				// Wait for proxy auth probing to finish so its
				// Zotero.Promise.delay() calls don't pollute the stub
				await Zotero.proxyAuthComplete;
			});

			beforeEach(function () {
				delayStub = sinon.stub(Zotero.Promise, "delay").returns(Promise.resolve());
			});
			
			afterEach(function () {
				if (spy) {
					spy.restore();
				}
				delayStub.restore();
			});
			
			after(function () {
				sinon.restore();
			});
			
			
			it("should retry on 500 error", async function () {
				setResponse({
					method: "GET",
					url: "error",
					status: 500,
					text: ""
				});
				spy = sinon.spy(Zotero.HTTP, "_requestInternal");
				var e = await getPromiseError(
					Zotero.HTTP.request(
						"GET",
						baseURL + "error",
						{
							errorDelayIntervals: [10, 20, 100],
							errorDelayMax: 35
						}
					)
				);
				assert.instanceOf(e, Zotero.HTTP.UnexpectedStatusException);
				assert.isTrue(spy.calledThrice);
				assert.isTrue(delayStub.calledTwice);
				assert.equal(delayStub.args[0][0], 10);
				assert.equal(delayStub.args[1][0], 20);
			});
			
			it("shouldn't retry on 500 error if errorDelayMax=0", async function () {
				setResponse({
					method: "GET",
					url: "error",
					status: 500,
					text: ""
				});
				spy = sinon.spy(Zotero.HTTP, "_requestInternal");
				var e = await getPromiseError(
					Zotero.HTTP.request(
						"GET",
						baseURL + "error",
						{
							errorDelayIntervals: [10, 20, 100],
							errorDelayMax: 0
						}
					)
				);
				assert.instanceOf(e, Zotero.HTTP.UnexpectedStatusException);
				assert.isTrue(spy.calledOnce);
				assert.isTrue(delayStub.notCalled);
			});
			
			it("should provide cancellerReceiver a callback to cancel while waiting to retry a 5xx error", async function () {
				delayStub.restore();
				setResponse({
					method: "GET",
					url: "error",
					status: 500,
					text: ""
				});
				var cancel;
				spy = sinon.spy(Zotero.HTTP, "_requestInternal");
				setTimeout(() => {
					cancel();
				}, 300);
				var e = await getPromiseError(
					Zotero.HTTP.request(
						"GET",
						baseURL + "error",
						{
							errorDelayIntervals: [10, 10, 600],
							cancellerReceiver: function () {
								cancel = arguments[0];
							}
						}
					)
				);
				assert.instanceOf(e, Zotero.HTTP.CancelledException);
				assert.equal(spy.callCount, 3);
			});
			
			it("should obey Retry-After for 503", async function () {
				var called = 0;
				server.respond(function (req) {
					if (req.method == "GET" && req.url == baseURL + "error") {
						if (called < 1) {
							req.respond(
								503,
								{
									"Retry-After": "5"
								},
								""
							);
						}
						else if (called < 2) {
							req.respond(
								503,
								{
									"Retry-After": "10"
								},
								""
							);
						}
						else {
							req.respond(
								200,
								{},
								""
							);
						}
					}
					called++;
				});
				spy = sinon.spy(Zotero.HTTP, "_requestInternal");
				await Zotero.HTTP.request("GET", baseURL + "error");
				assert.equal(3, spy.callCount);
				// DEBUG: Why are these slightly off?
				assert.approximately(delayStub.args[0][0], 5 * 1000, 5);
				assert.approximately(delayStub.args[1][0], 10 * 1000, 5);
			});
			
			it("should start with first interval on new request() call", async function () {
				var called = 0;
				server.respond(function (req) {
					if (req.method == "GET" && req.url.startsWith(baseURL + "error")) {
						if (called < 1) {
							req.respond(500, {}, "");
						}
						else {
							req.respond(200, {}, "");
						}
					}
					called++;
				});
				spy = sinon.spy(Zotero.HTTP, "_requestInternal");
				var errorDelayIntervals = [20];
				await Zotero.HTTP.request("GET", baseURL + "error1", { errorDelayIntervals })
				called = 0;
				await Zotero.HTTP.request("GET", baseURL + "error2", { errorDelayIntervals }),
				assert.equal(4, spy.callCount);
				assert.equal(delayStub.args[0][0], 20);
				assert.equal(delayStub.args[1][0], 20);
			});
		});
	});
	
	
	describe("#download()", function () {
		var tmpDir;

		before(function () {
			httpd.registerPathHandler(
				'/download/small.bin',
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.setHeader("Content-Type", "application/octet-stream", false);
						let data = "abc".repeat(1024);
						response.setHeader("Content-Length", String(data.length), false);
						response.write(data);
					}
				}
			);
			httpd.registerPathHandler(
				'/download/large.bin',
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.setHeader("Content-Type", "application/octet-stream", false);
						// 256 KB -- enough to exercise multiple onDataAvailable calls
						let chunk = "x".repeat(1024);
						for (let i = 0; i < 256; i++) {
							response.write(chunk);
						}
					}
				}
			);
			httpd.registerPathHandler(
				'/download/404',
				{
					handle: function (request, response) {
						response.setStatusLine(null, 404, "Not Found");
						response.write("Not found");
					}
				}
			);
			httpd.registerPathHandler(
				'/download/500',
				{
					handle: function (request, response) {
						response.setStatusLine(null, 500, "Internal Server Error");
						response.write("Server error");
					}
				}
			);
			httpd.registerPathHandler(
				'/download/redirect-to-file',
				{
					handle: function (request, response) {
						response.setStatusLine(null, 302, "Found");
						response.setHeader("Location", baseURL + "download/small.bin", false);
					}
				}
			);
			httpd.registerPathHandler(
				'/download/custom-header',
				{
					handle: function (request, response) {
						let val;
						try {
							val = request.getHeader("X-Custom");
						}
						catch (e) {
							val = "";
						}
						response.setStatusLine(null, 200, "OK");
						response.setHeader("X-Echo", val, false);
						response.write("ok");
					}
				}
			);
		});

		beforeEach(async function () {
			Zotero.HTTP.mock = null;
			tmpDir = await getTempDirectory();
		});

		afterEach(async function () {
			await IOUtils.remove(tmpDir, { recursive: true, ignoreAbsent: true });
		});


		it("should download a file to disk", async function () {
			let dest = PathUtils.join(tmpDir, "small.bin");
			let req = await Zotero.HTTP.download(
				baseURL + "download/small.bin",
				dest
			);
			assert.equal(req.status, 200);
			let stat = await IOUtils.stat(dest);
			assert.equal(stat.size, 3 * 1024);
		});

		it("should download a larger file", async function () {
			let dest = PathUtils.join(tmpDir, "large.bin");
			let req = await Zotero.HTTP.download(
				baseURL + "download/large.bin",
				dest
			);
			assert.equal(req.status, 200);
			let stat = await IOUtils.stat(dest);
			assert.equal(stat.size, 256 * 1024);
		});

		it("should send request headers", async function () {
			let dest = PathUtils.join(tmpDir, "custom.bin");
			let req = await Zotero.HTTP.download(
				baseURL + "download/custom-header",
				dest,
				{
					headers: { "X-Custom": "test-value" }
				}
			);
			assert.equal(req.status, 200);
			assert.equal(req.headers.get("X-Echo"), "test-value");
		});

		it("should throw UnexpectedStatusException for non-success status", async function () {
			let dest = PathUtils.join(tmpDir, "404.bin");
			let e = await getPromiseError(
				Zotero.HTTP.download(baseURL + "download/404", dest)
			);
			assert.instanceOf(e, Zotero.HTTP.UnexpectedStatusException);
			assert.equal(e.status, 404);
			// File should not exist
			assert.isFalse(await IOUtils.exists(dest));
		});

		it("should allow non-success status with successCodes", async function () {
			let dest = PathUtils.join(tmpDir, "404.bin");
			let req = await Zotero.HTTP.download(
				baseURL + "download/404",
				dest,
				{
					successCodes: [200, 404]
				}
			);
			assert.equal(req.status, 404);
		});

		it("should follow redirects", async function () {
			let dest = PathUtils.join(tmpDir, "redirected.bin");
			let req = await Zotero.HTTP.download(
				baseURL + "download/redirect-to-file",
				dest
			);
			assert.equal(req.status, 200);
			let stat = await IOUtils.stat(dest);
			assert.equal(stat.size, 3 * 1024);
		});

		it("should call onProgress during download", async function () {
			let dest = PathUtils.join(tmpDir, "progress.bin");
			let progressCalls = [];
			await Zotero.HTTP.download(
				baseURL + "download/large.bin",
				dest,
				{
					onProgress(progress, progressMax) {
						progressCalls.push({ progress, progressMax });
					}
				}
			);
			assert.isAbove(progressCalls.length, 0);
			// Last call should have accumulated all bytes
			let last = progressCalls[progressCalls.length - 1];
			assert.equal(last.progress, 256 * 1024);
		});

		it("should retry on 5xx errors", async function () {
			let delayStub = sinon.stub(Zotero.Promise, "delay")
				.returns(Promise.resolve());
			try {
				let dest = PathUtils.join(tmpDir, "500.bin");
				let e = await getPromiseError(
					Zotero.HTTP.download(
						baseURL + "download/500",
						dest,
						{
							errorDelayIntervals: [10, 20],
							errorDelayMax: 35
						}
					)
				);
				assert.instanceOf(e, Zotero.HTTP.UnexpectedStatusException);
				assert.equal(e.status, 500);
			}
			finally {
				delayStub.restore();
			}
		});

		it("should accept nsIURI as first argument", async function () {
			let dest = PathUtils.join(tmpDir, "nsuri.bin");
			let nsUri = Services.io.newURI(baseURL + "download/small.bin");
			let req = await Zotero.HTTP.download(nsUri, dest);
			assert.equal(req.status, 200);
			let stat = await IOUtils.stat(dest);
			assert.equal(stat.size, 3 * 1024);
		});
	});


	describe("#processDocuments()", function () {
		beforeEach(function () {
			Zotero.HTTP.mock = null;
		});
		
		it("should provide a document object", async function () {
			var called = false;
			await Zotero.HTTP.processDocuments(
				testURL,
				function (doc) {
					assert.equal(doc.location.href, testURL);
					assert.equal(doc.querySelector('p').textContent, 'Test');
					var p = doc.evaluate('//p', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
					assert.equal(p.textContent, 'Test');
					called = true;
				}
			);
			assert.isTrue(called);
		});
		
		it("should follow meta redirect for a document", async function () {
			let url1 = `http://127.0.0.1:${port}/test-redirect.html`;
			let url2 = `http://127.0.0.1:${port}/test.html`;
			let called = false;
			await Zotero.HTTP.processDocuments(
				url1,
				function (doc) {
					assert.equal(doc.location.href, url2);
					called = true;
				}
			);
			assert.isTrue(called);
		});
	});

	describe("Cookie isolation", function () {
		var cookieURL;

		before(function () {
			cookieURL = baseURL + 'cookie-check';
		});

		beforeEach(function () {
			Zotero.HTTP.mock = null;
			// Clear all cookies for the test server
			Services.cookies.removeAll();
		});

		it("should send cookies by default (mozAnon: false)", async function () {
			// First request sets the cookie but gets 403
			var req = await Zotero.HTTP.request('GET', cookieURL, {
				successCodes: false
			});
			assert.equal(req.status, 403);

			// Second request should send the cookie and get 200
			req = await Zotero.HTTP.request('GET', cookieURL, {
				successCodes: false
			});
			assert.equal(req.status, 200);
		});

		it("should not send cookies with anon: true", async function () {
			// First request sets the cookie
			await Zotero.HTTP.request('GET', cookieURL, {
				successCodes: false
			});

			// Second request with anon: true should not send the cookie
			var req = await Zotero.HTTP.request('GET', cookieURL, {
				anon: true,
				successCodes: false
			});
			assert.equal(req.status, 403);
		});

		describe("#newCookieContext()", function () {
			it("should isolate cookies from the default jar", async function () {
				let ctx = Zotero.HTTP.newCookieContext();
				try {
					// Set cookie in the default jar
					await Zotero.HTTP.request('GET', cookieURL, {
						successCodes: false
					});

					// Request in the isolated context should not see the default cookie
					let req = await Zotero.HTTP.request('GET', cookieURL, {
						cookieContextId: ctx.id,
						successCodes: false
					});
					assert.equal(req.status, 403);
				}
				finally {
					ctx.dispose();
				}
			});

			it("should persist cookies within the same context", async function () {
				let ctx = Zotero.HTTP.newCookieContext();
				try {
					// First request in context -- gets 403, sets cookie
					let req = await Zotero.HTTP.request('GET', cookieURL, {
						cookieContextId: ctx.id,
						successCodes: false
					});
					assert.equal(req.status, 403);

					// Second request in same context -- should have the cookie
					req = await Zotero.HTTP.request('GET', cookieURL, {
						cookieContextId: ctx.id,
						successCodes: false
					});
					assert.equal(req.status, 200);
				}
				finally {
					ctx.dispose();
				}
			});

			it("should not leak cookies between different contexts", async function () {
				let ctx1 = Zotero.HTTP.newCookieContext();
				let ctx2 = Zotero.HTTP.newCookieContext();
				try {
					// Set cookie in ctx1
					await Zotero.HTTP.request('GET', cookieURL, {
						cookieContextId: ctx1.id,
						successCodes: false
					});

					// ctx2 should not see ctx1's cookie
					let req = await Zotero.HTTP.request('GET', cookieURL, {
						cookieContextId: ctx2.id,
						successCodes: false
					});
					assert.equal(req.status, 403);
				}
				finally {
					ctx1.dispose();
					ctx2.dispose();
				}
			});

			it("should remove cookies on dispose()", async function () {
				let ctx = Zotero.HTTP.newCookieContext();

				// Set cookie in context
				await Zotero.HTTP.request('GET', cookieURL, {
					cookieContextId: ctx.id,
					successCodes: false
				});

				// Verify cookie exists
				let cookies = ctx.getCookies('127.0.0.1');
				assert.isTrue(cookies.some(c => c.name === 'authed'));

				// Dispose and verify cookies are gone
				ctx.dispose();
				let ctx2 = Zotero.HTTP.newCookieContext();
				try {
					let req = await Zotero.HTTP.request('GET', cookieURL, {
						cookieContextId: ctx.id,
						successCodes: false
					});
					assert.equal(req.status, 403);
				}
				finally {
					ctx2.dispose();
				}
			});
		});
	});

	describe("CasePreservingHeaders", function () {
		describe("#constructor()", function () {
			it("should initialize from an iterable or object", function () {
				let headers = new Zotero.HTTP.CasePreservingHeaders([['Name', 'value']]);
				assert.equal(headers.get('name'), 'value');
				headers = new Zotero.HTTP.CasePreservingHeaders({ NAME: 'value' });
				assert.equal(headers.get('Name'), 'value');
			});
		});
		
		describe("#entries()", function () {
			it("should iterate through headers with original capitalization", function () {
				let headers = new Zotero.HTTP.CasePreservingHeaders({ 'A-Header': 'a value' });
				headers.set('FuNkY-Header', 'some other value');
				assert.deepEqual(Array.from(headers.entries()), [
					['A-Header', 'a value'],
					['FuNkY-Header', 'some other value']
				]);
			});
		});
	});
});
