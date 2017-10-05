describe("Zotero.HTTP", function () {
	var httpd;
	var port = 16213;
	
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
	});
	
	after(function* () {
		var defer = new Zotero.Promise.defer();
		httpd.stop(() => defer.resolve());
		yield defer.promise;
	});
	
	describe("#processDocuments()", function () {
		it("should provide a document object", function* () {
			var called = false;
			var url = `http://127.0.0.1:${port}/test.html`;
			yield Zotero.HTTP.processDocuments(
				url,
				function (doc) {
					assert.equal(doc.location.href, url);
					assert.equal(doc.querySelector('p').textContent, 'Test');
					var p = doc.evaluate('//p', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
					assert.equal(p.textContent, 'Test');
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
			var url = `http://127.0.0.1:${port}/test.html`;
			yield new Zotero.Promise((resolve) => {
				Zotero.HTTP.loadDocuments(
					url,
					function (doc) {
						assert.equal(doc.location.href, url);
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
