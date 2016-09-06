"use strict";

describe("Create Bibliography Dialog", function () {
	var win, zp;
	
	before(function* () {
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
	});
	
	after(function () {
		win.close();
	});
	
	it("should perform a search", function* () {
		yield Zotero.Styles.init();
		var item = yield createDataObject('item');
		
		var deferred = Zotero.Promise.defer();
		var called = false;
		waitForWindow("chrome://zotero/content/bibliography.xul", function (dialog) {
			waitForWindow("chrome://zotero/content/preferences/preferences.xul", function (window) {
				// Wait for pane switch
				Zotero.Promise.coroutine(function* () {
					do {
						Zotero.debug("Checking for pane");
						yield Zotero.Promise.delay(5);
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
		win.Zotero_File_Interface.bibliographyFromItems();
		yield deferred.promise;
		
		assert.ok(called);
	});
});
