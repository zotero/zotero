describe("HiddenBrowser", function() {
	const { HiddenBrowser } = ChromeUtils.import(
		"chrome://zotero/content/HiddenBrowser.jsm"
	);
	
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