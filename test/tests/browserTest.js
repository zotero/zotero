"use strict";

describe("Zotero_Browser", function () {
	var win;
	before(function* () {
		win = yield loadBrowserWindow();
	});
	after(function* () {
		win.close();
	});
	
	it("should save webpage item to current collection", function* () {
		var uri = OS.Path.join(getTestDataDirectory().path, "snapshot", "index.html");
		var deferred = Zotero.Promise.defer();
		win.addEventListener('pageshow', () => deferred.resolve());
		win.loadURI(uri);
		yield deferred.promise;
		
		yield loadZoteroPane(win);
		var collection = yield createDataObject('collection');
		
		var promise = waitForItemEvent('add');
		yield win.Zotero_Browser.scrapeThisPage();
		var ids = yield promise;
		var items = Zotero.Items.get(ids);
		assert.lengthOf(items, 1);
		assert.equal(Zotero.ItemTypes.getName(items[0].itemTypeID), 'webpage');
		assert.isTrue(collection.hasItem(items[0].id));
	})
	
	it("should save journalArticle to current collection", function* () {
		var uri = OS.Path.join(
			getTestDataDirectory().path, "metadata", "journalArticle-single.html"
		);
		var deferred = Zotero.Promise.defer();
		win.addEventListener('pageshow', () => deferred.resolve());
		win.loadURI(uri);
		yield deferred.promise;
		
		yield loadZoteroPane(win);
		var collection = yield createDataObject('collection');
		
		var promise = waitForItemEvent('add');
		yield win.Zotero_Browser.scrapeThisPage();
		var ids = yield promise;
		var items = Zotero.Items.get(ids);
		assert.lengthOf(items, 1);
		assert.equal(Zotero.ItemTypes.getName(items[0].itemTypeID), 'journalArticle');
		assert.isTrue(collection.hasItem(items[0].id));
	})
})
