describe("HiddenBrowser", function() {
	const { HiddenBrowser } = ChromeUtils.import(
		"chrome://zotero/content/HiddenBrowser.jsm"
	);
	
	describe("#create()", function () {
		var httpd;
		var port = 16213;
		var baseURL = `http://127.0.0.1:${port}/`;

		before(function () {
			Cu.import("resource://zotero-unit/httpd.js");
			httpd = new HttpServer();
			httpd.start(port);
		});

		after(async function () {
			await new Promise(resolve => httpd.stop(resolve));
		});

		it("should fail on non-2xx response with requireSuccessfulStatus", async function () {
			let e = await getPromiseError(HiddenBrowser.create(baseURL + 'nonexistent', { requireSuccessfulStatus: true }));
			assert.instanceOf(e, Zotero.HTTP.UnexpectedStatusException);
		});
	});
	
	describe("#getPageData()", function () {
		it("should handle local UTF-8 HTML file", async function () {
			var path = OS.Path.join(getTestDataDirectory().path, 'test-hidden.html');
			var browser = await HiddenBrowser.create(path);
			var { characterSet, bodyText } = await HiddenBrowser.getPageData(
				browser, ['characterSet', 'bodyText']
			);
			assert.equal(characterSet, 'UTF-8');
			// Should ignore hidden text
			assert.equal(bodyText, 'This is a test.');
		});
		
		it("should handle local GBK HTML file", async function () {
			var path = OS.Path.join(getTestDataDirectory().path, 'charsets', 'gbk.html');
			var browser = await HiddenBrowser.create(path);
			var { characterSet, bodyText } = await HiddenBrowser.getPageData(
				browser, ['characterSet', 'bodyText']
			);
			assert.equal(characterSet, 'GBK');
			assert.equal(bodyText, '主体');
		});
		
		it("should handle local GBK text file", async function () {
			var path = OS.Path.join(getTestDataDirectory().path, 'charsets', 'gbk.txt');
			var browser = await HiddenBrowser.create(path);
			var { characterSet, bodyText } = await HiddenBrowser.getPageData(
				browser, ['characterSet', 'bodyText']
			);
			HiddenBrowser.destroy(browser);
			assert.equal(characterSet, 'GBK');
			assert.equal(bodyText, '这是一个测试文件。');
		});
	});
});