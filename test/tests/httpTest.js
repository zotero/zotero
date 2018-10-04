describe("Zotero.HTTP", function () {
	var httpd;
	var port = 16213;
	var baseURL = `http://127.0.0.1:${port}/`
	var testURL = baseURL + 'test.html';
	var redirectLocation = baseURL + 'test2.html';
	
	before(function* () {
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
	});
	
	after(function* () {
		var defer = new Zotero.Promise.defer();
		httpd.stop(() => defer.resolve());
		yield defer.promise;
	});
	
	
	describe("#request()", function () {
		it("should succeed with 3xx status if followRedirects is false", async function () {
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
	});
	
	
	describe("#processDocuments()", function () {
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
	
	describe("#loadDocuments()", function () {
		var win;
		
		before(function* () {
			// TEMP: createHiddenBrowser currently needs a parent window
			win = yield loadBrowserWindow();
		});
		
		after(function* () {
			win.close();
		});
		
		it("should provide a document object", function* () {
			var called = false;
			yield new Zotero.Promise((resolve) => {
				Zotero.HTTP.loadDocuments(
					testURL,
					function (doc) {
						assert.equal(doc.location.href, testURL);
						assert.equal(doc.querySelector('p').textContent, 'Test');
						var p = doc.evaluate('//p', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
						assert.equal(p.textContent, 'Test');
						called = true;
					},
					resolve
				);
			});
			assert.isTrue(called);
		});
	});
});
