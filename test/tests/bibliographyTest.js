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
	
	it("should perform a search", async function () {
		await Zotero.Styles.init();
		var item = await createDataObject('item');
		
		var deferred = Zotero.Promise.defer();
		var called = false;
		waitForWindow("chrome://zotero/content/bibliography.xul", function (dialog) {
			waitForWindow("chrome://zotero/content/preferences/preferences.xul", function (window) {
				// Wait for pane switch
				(async function () {
					do {
						Zotero.debug("Checking for pane");
						await Zotero.Promise.delay(5);
					}
					while (window.document.documentElement.currentPane.id != 'zotero-prefpane-cite');
					let pane = window.document.documentElement.currentPane;
					assert.equal(pane.getElementsByTagName('tabbox')[0].selectedTab.id, 'styles-tab');
					assert.equal(pane.getElementsByTagName('tabbox')[0].selectedPanel.id, 'styles');
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
