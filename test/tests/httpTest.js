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
		Components.utils.import("resource://zotero-unit/httpd.js");
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
		var defer = new Zotero.Promise.defer();
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
			
			beforeEach(function () {
				delayStub = sinon.stub(Zotero.Promise, "delay").returns(Zotero.Promise.resolve());
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
			
			it("should obey Retry-After for 503", function* () {
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
				yield Zotero.HTTP.request("GET", baseURL + "error");
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
	
	
	describe("#processDocuments()", function () {
		beforeEach(function () {
			Zotero.HTTP.mock = null;
		});
		
		it("should provide a document object", function* () {
			var called = false;
			yield Zotero.HTTP.processDocuments(
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
