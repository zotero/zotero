describe("Hyphenation", function () {
	it("should not cause a segfault", async function () {
		// Files in test/tests/data/ (resources://) can't be parsed as XUL/XHTML, so the data for this test is in
		// test/content/ (chrome://), which can
		window.openDialog('chrome://zotero-unit/content/hyphenationTest.xhtml', 'test', 'chrome');
		await Zotero.Promise.delay(200);
	});
});
