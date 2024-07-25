"use strict";

describe("Create Bibliography Dialog", function () {
	var win, zp;
	
	before(async function () {
		win = await loadZoteroPane();
		zp = win.ZoteroPane;
	});
	
	after(function () {
		win.close();
	});
	
	it("should open the Cite prefpane when Manage Styles… is clicked", async function () {
		await Zotero.Styles.init();
		var item = await createDataObject('item');
		
		var deferred = Zotero.Promise.defer();
		var called = false;
		waitForWindow("chrome://zotero/content/bibliography.xhtml", function (dialog) {
			waitForWindow("chrome://zotero/content/browser_wrapper.xhtml", function (window) {
				let browser = window.document.querySelector("browser");
				// Wait for switch to Cite pane
				(async function () {
					do {
						Zotero.debug("Checking for pane");
						await Zotero.Promise.delay(5);
					}
					while (!browser.getAttribute("src") && !browser.contentDocument.querySelector('[value=zotero-prefpane-cite]')?.selected);
					called = true;
					window.close();
					deferred.resolve();
				})();
			});
			dialog.document.getElementById('manage-styles').click();
		});
		await win.Zotero_File_Interface.bibliographyFromItems();
		await deferred.promise;
		
		assert.ok(called);
	});
});
