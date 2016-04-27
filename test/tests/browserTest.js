"use strict";

describe("Zotero_Browser", function () {
	var win, collection;
	
	before(function* () {
		win = yield loadBrowserWindow();
		collection = yield createDataObject('collection');
	});
	
	after(function* () {
		win.close();
	});
	
	afterEach(function () {
		Zotero.ProgressWindowSet.closeAll();
	})
	
	var waitForTranslateIcon = Zotero.Promise.coroutine(function* () {
		var button = win.document.getElementById('zotero-toolbar-save-button');
		if (button.classList.contains('translate')) {
			return;
		}
		Zotero.debug("Waiting for translator icon");
		do {
			yield Zotero.Promise.delay(50);
		}
		while (!button.classList.contains('translate'));
	});
	
	
	it("should save webpage to My Library if the Zotero pane hasn't been opened yet in a Firefox window", function* () {
		var win = yield loadBrowserWindow();
		
		var uri = OS.Path.join(getTestDataDirectory().path, "snapshot", "index.html");
		var deferred = Zotero.Promise.defer();
		win.Zotero_Browser.addDetectCallback(() => deferred.resolve());
		win.loadURI(uri);
		yield deferred.promise;
		
		var promise = waitForWindow('chrome://zotero/content/progressWindow.xul', function (progressWin) {
			assert.include(
				progressWin.document.documentElement.textContent,
				"Test"
			);
		});
		yield win.Zotero_Browser.scrapeThisPage();
		yield promise;
		
		win.close();
	});
	
	it("should save journal article to My Library if the Zotero pane hasn't been opened yet in a Firefox window", function* () {
		Zotero.Prefs.set('lastViewedFolder', collection.collectionTreeViewID);
		
		var win = yield loadBrowserWindow();
		
		var deferred = Zotero.Promise.defer();
		win.Zotero_Browser.addDetectCallback(() => deferred.resolve());
		var uri = OS.Path.join(
			getTestDataDirectory().path, "metadata", "journalArticle-single.html"
		);
		win.loadURI(uri);
		yield deferred.promise;
		
		var promise1 = waitForWindow('chrome://zotero/content/progressWindow.xul', function (progressWin) {});
		var promise2 = waitForItemEvent('add');
		yield win.Zotero_Browser.scrapeThisPage();
		yield promise1;
		var ids = yield promise2;
		var items = Zotero.Items.get(ids);
		assert.lengthOf(items, 1);
		assert.equal(items[0].libraryID, Zotero.Libraries.userLibraryID);
		assert.equal(Zotero.ItemTypes.getName(items[0].itemTypeID), 'journalArticle');
		assert.lengthOf(items[0].getCollections(), 0);
		
		win.close();
	});
	
	it("should save webpage to current collection", function* () {
		var uri = OS.Path.join(getTestDataDirectory().path, "snapshot", "index.html");
		var deferred = Zotero.Promise.defer();
		win.Zotero_Browser.addDetectCallback(() => deferred.resolve());
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
		win.Zotero_Browser.addDetectCallback(() => deferred.resolve());
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
	
	it("should save book with child note to current collection", function* () {
		var uri = OS.Path.join(
			getTestDataDirectory().path, "book_and_child_note.ris"
		);
		var deferred = Zotero.Promise.defer();
		win.Zotero_Browser.addDetectCallback(() => deferred.resolve());
		win.loadURI(uri);
		yield deferred.promise;
		
		// Detection runs twice for local files, so wait for the icon to actually appear
		yield waitForTranslateIcon();
		
		yield loadZoteroPane(win);
		var collection = yield createDataObject('collection');
		
		var promise = waitForItemEvent('add');
		yield win.Zotero_Browser.scrapeThisPage();
		
		var ids = yield promise;
		var items = Zotero.Items.get(ids);
		assert.lengthOf(items, 2);
		assert.equal(Zotero.ItemTypes.getName(items[0].itemTypeID), 'book');
		assert.isTrue(collection.hasItem(items[0].id));
		assert.equal(Zotero.ItemTypes.getName(items[1].itemTypeID), 'note');
	});
	
	it("should save PDF to library root", function* () {
		var uri = OS.Path.join(getTestDataDirectory().path, "test.pdf");
		var deferred = Zotero.Promise.defer();
		win.Zotero_Browser.addDetectCallback(() => deferred.resolve());
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
		win.Zotero_Browser.addDetectCallback(() => deferred.resolve());
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
		win.Zotero_Browser.addDetectCallback(() => deferred.resolve());
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
		win.Zotero_Browser.addDetectCallback(() => deferred.resolve());
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
