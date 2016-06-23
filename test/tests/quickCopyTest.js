describe("Zotero.QuickCopy", function() {
	var quickCopyPref = Zotero.Prefs.get("export.quickCopy.setting");
	quickCopyPref = JSON.stringify(Zotero.QuickCopy.unserializeSetting(quickCopyPref));
	
	// TODO: These should set site-specific prefs and test the actual response against it,
	// but that will need to wait for 5.0. For now, just make sure they don't fail.
	describe("#getFormatFromURL()", function () {
		it("should handle an HTTP URL", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('http://foo.com/'), quickCopyPref);
		})
		
		it("should handle an HTTPS URL", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('https://foo.com/'), quickCopyPref);
		})
		
		it("should handle a domain and path", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('http://foo.com/bar'), quickCopyPref);
		})
		
		it("should handle a local host", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('http://foo/'), quickCopyPref);
		})
		
		it("should handle a domain with a trailing period", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('http://foo.com.'), quickCopyPref);
		})
		
		it("should handle an about: URL", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('about:blank'), quickCopyPref);
		})
		
		it("should handle a chrome URL", function () {
			assert.deepEqual(Zotero.QuickCopy.getFormatFromURL('chrome://zotero/content/tab.xul'), quickCopyPref);
		})
	})
	
	describe("#getContentFromItems()", function () {
		it("should generate BibTeX", function* () {
			var item = yield createDataObject('item');
			var content = "";
			var worked = false;
			
			var format = 'export=9cb70025-a888-4a29-a210-93ec52da40d4'; // BibTeX
			Zotero.Prefs.set('export.quickCopy.setting', format);
			// The translator code is loaded automatically on pref change, but let's not wait for it
			yield Zotero.QuickCopy.init();
			
			Zotero.QuickCopy.getContentFromItems(
				[item],
				format,
				(obj, w) => {
					content = obj.string;
					worked = w;
				}
			);
			assert.isTrue(worked);
			assert.isTrue(content.trim().startsWith('@'));
		});
	});
})
