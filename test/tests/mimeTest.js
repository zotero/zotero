describe("Zotero.MIME", function () {
	describe("#sniffForMIMEType()", function () {
		async function test(filename, expectedType) {
			var path = OS.Path.join(getTestDataDirectory().path, filename);
			var sample = await Zotero.File.getSample(path);
			var type = Zotero.MIME.sniffForMIMEType(sample);
			assert.equal(type, expectedType);
		}
		
		it("should detect PNG", async function () {
			await test('test.png', 'image/png');
		});
		
		it("should detect JPEG", async function () {
			await test('test.jpg', 'image/jpeg');
		});
		
		it("should detect SQLite database", async function () {
			await test('test.sqlite', 'application/x-sqlite3');
		});

		it("should detect EPUB ebook", async function () {
			await test('stub.epub', 'application/epub+zip');
		});
	});
});
