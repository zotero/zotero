"use strict";

describe("Zotero_Browser", function () {
	var win;
	
	before(function* () {
		win = yield loadBrowserWindow();
	});
	
	after(function* () {
		win.close();
	});
	
	afterEach(function () {
		Zotero.ProgressWindowSet.closeAll();
	})
	
	it("should save webpage to current collection", function* () {
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
	
	it("should save journal article to current collection", function* () {
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
	
	it("should save PDF to library root", function* () {
		var uri = OS.Path.join(getTestDataDirectory().path, "test.pdf");
		var deferred = Zotero.Promise.defer();
		win.addEventListener('pageshow', () => deferred.resolve());
		win.loadURI(uri);
		yield deferred.promise;
		
		yield loadZoteroPane(win);
		
		var promise = waitForItemEvent('add');
		yield win.Zotero_Browser.scrapeThisPage();
		var ids = yield promise;
		var items = Zotero.Items.get(ids);
		assert.lengthOf(items, 1);
		assert.equal(Zotero.ItemTypes.getName(items[0].itemTypeID), 'attachment');
		assert.equal(items[0].getField('title'), 'test.pdf');
		assert.equal(items[0].attachmentContentType, 'application/pdf');
		assert.equal(Zotero.Attachments.linkModeToName(items[0].attachmentLinkMode), 'imported_url');
	});
	
	it("should save PDF to current collection", function* () {
		var uri = OS.Path.join(getTestDataDirectory().path, "test.pdf");
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
		assert.equal(Zotero.ItemTypes.getName(items[0].itemTypeID), 'attachment');
		assert.isTrue(collection.hasItem(items[0].id));
	});
	
	it("shouldn't save webpage to My Publications", function* () {
		var uri = OS.Path.join(getTestDataDirectory().path, "snapshot", "index.html");
		var deferred = Zotero.Promise.defer();
		win.addEventListener('pageshow', () => deferred.resolve());
		win.loadURI(uri);
		yield deferred.promise;
		
		yield loadZoteroPane(win);
		yield selectLibrary(win, Zotero.Libraries.publicationsLibraryID);
		
		var promise = waitForDialog(function (dialog) {
			assert.include(
				dialog.document.documentElement.textContent,
				Zotero.getString('save.error.cannotAddToMyPublications')
			);
		});
		yield win.Zotero_Browser.scrapeThisPage();
		yield promise;
	})
	
	it("shouldn't save journal article to My Publications", function* () {
		var uri = OS.Path.join(
			getTestDataDirectory().path, "metadata", "journalArticle-single.html"
		);
		var deferred = Zotero.Promise.defer();
		win.addEventListener('pageshow', () => deferred.resolve());
		win.loadURI(uri);
		yield deferred.promise;
		
		yield loadZoteroPane(win);
		yield selectLibrary(win, Zotero.Libraries.publicationsLibraryID);
		
		var promise = waitForDialog(function (dialog) {
			assert.include(
				dialog.document.documentElement.textContent,
				Zotero.getString('save.error.cannotAddToMyPublications')
			);
		}, false, 'chrome://zotero/content/progressWindow.xul');
		yield win.Zotero_Browser.scrapeThisPage();
		yield promise;
	})
})
