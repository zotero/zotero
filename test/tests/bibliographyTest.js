"use strict";

describe("Create Bibliography Dialog", function () {
	var win, zp;
	
	before(async function () {
		win = await loadZoteroPane();
		await Zotero.Styles.init();
		zp = win.ZoteroPane;
	});
	
	after(function () {
		win.close();
	});
	
	it("should remap renamed style IDs to their current IDs", async function () {
		await createDataObject('item');
		
		let styleID;
		
		var deferred = Zotero.Promise.defer();
		waitForWindow("chrome://zotero/content/bibliography.xhtml", function (dialog) {
			(async function () {
				await dialog.isLoadedPromise;
				let styleSelector = dialog.document.getElementById('style-selector');
				// Set the value to an old/renamed style ID
				styleSelector.value = "chicago-fullnote-bibliography";
				// Should be remapped to the current style ID
				styleID = styleSelector.value;
				dialog.close();
				deferred.resolve();
			})();
		});
		await win.Zotero_File_Interface.bibliographyFromItems();
		await deferred.promise;

		assert.equal(styleID, "http://www.zotero.org/styles/chicago-notes-bibliography");
	});
	
	it("should open the Cite prefpane when Manage Styles… is clicked", async function () {
		var item = await createDataObject('item');
		
		var deferred = Zotero.Promise.defer();
		var called = false;
		waitForWindow("chrome://zotero/content/bibliography.xhtml", function (dialog) {
			waitForWindow("chrome://zotero/content/preferences/preferences.xhtml", function (window) {
				// Wait for switch to Cite pane
				(async function () {
					do {
						Zotero.debug("Checking for pane");
						await Zotero.Promise.delay(5);
					}
					while (!window.document.querySelector('[value=zotero-prefpane-cite]').selected);
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
