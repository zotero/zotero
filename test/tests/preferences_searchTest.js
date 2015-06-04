describe("Search Preferences", function () {
	describe("PDF Indexing", function () {
		it("should install PDF tools if not installed", function* () {
			// Begin install procedure
			var win = yield loadWindow("chrome://zotero/content/preferences/preferences.xul", {
				pane: 'zotero-prefpane-search',
				action: 'pdftools-install'
			});
				// Wait for confirmation dialog
			yield waitForDialog();
			
			// Wait for install to finish
			yield waitForCallback(function() {
				return Zotero.Fulltext.pdfConverterIsRegistered()
					&& Zotero.Fulltext.pdfInfoIsRegistered();
			}, 500)
			.finally(() => win.close());
		})
	})
})
