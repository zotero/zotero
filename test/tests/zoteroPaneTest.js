"use strict";

describe("ZoteroPane", function() {
	var win, doc, zp, userLibraryID;
	
	// Load Zotero pane and select library
	before(function* () {
		win = yield loadZoteroPane();
		doc = win.document;
		zp = win.ZoteroPane;
		userLibraryID = Zotero.Libraries.userLibraryID;
	});
	
	after(function () {
		win.close();
	});
	
	describe("#newItem", function () {
		it("should create an item and focus the title field", function* () {
			yield zp.newItem(Zotero.ItemTypes.getID('book'), {}, null, true);
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var textboxes = doc.getAnonymousNodes(itemBox)[0].getElementsByTagName('textbox');
			assert.lengthOf(textboxes, 1);
			assert.equal(textboxes[0].getAttribute('fieldname'), 'title');
			textboxes[0].blur();
			yield Zotero.Promise.delay(1);
		})
		
		it("should save an entered value when New Item is used", function* () {
			var value = "Test";
			var item = yield zp.newItem(Zotero.ItemTypes.getID('book'), {}, null, true);
			var itemBox = doc.getElementById('zotero-editpane-item-box');
			var textbox = doc.getAnonymousNodes(itemBox)[0].getElementsByTagName('textbox')[0];
			textbox.value = value;
			yield itemBox.blurOpenField();
			item = yield Zotero.Items.getAsync(item.id);
			assert.equal(item.getField('title'), value);
		})
	});
	
	describe("#newNote()", function () {
		it("should create a child note and select it", function* () {
			var item = yield createDataObject('item');
			var noteID = yield zp.newNote(false, item.key, "Test");
			var selected = zp.itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected, noteID);
		})
		
		it("should create a standalone note within a collection and select it", function* () {
			var collection = yield createDataObject('collection');
			var noteID = yield zp.newNote(false, false, "Test");
			assert.equal(zp.collectionsView.getSelectedCollection(), collection);
			var selected = zp.itemsView.getSelectedItems(true);
			assert.lengthOf(selected, 1);
			assert.equal(selected, noteID);
		})
	})
	
	describe("#newCollection()", function () {
		it("should create a collection", function* () {
			var promise = waitForDialog();
			var id = yield zp.newCollection();
			yield promise;
			var collection = Zotero.Collections.get(id);
			assert.isTrue(collection.name.startsWith(Zotero.getString('pane.collections.untitled')));
		});
	});
	
	describe("#itemSelected()", function () {
		it.skip("should update the item count", function* () {
			var collection = new Zotero.Collection;
			collection.name = "Count Test";
			var id = yield collection.saveTx();
			yield waitForItemsLoad(win);
			
			// Unselected, with no items in view
			assert.equal(
				doc.getElementById('zotero-item-pane-message-box').textContent,
				Zotero.getString('pane.item.unselected.zero', 0)
			);
			
			// Unselected, with one item in view
			var item = new Zotero.Item('newspaperArticle');
			item.setCollections([id]);
			var itemID1 = yield item.saveTx({
				skipSelect: true
			});
			assert.equal(
				doc.getElementById('zotero-item-pane-message-box').textContent,
				Zotero.getString('pane.item.unselected.singular', 1)
			);
			
			// Unselected, with multiple items in view
			var item = new Zotero.Item('audioRecording');
			item.setCollections([id]);
			var itemID2 = yield item.saveTx({
				skipSelect: true
			});
			assert.equal(
				doc.getElementById('zotero-item-pane-message-box').textContent,
				Zotero.getString('pane.item.unselected.plural', 2)
			);
			
			// Multiple items selected
			var promise = zp.itemsView._getItemSelectedPromise();
			zp.itemsView.rememberSelection([itemID1, itemID2]);
			yield promise;
			assert.equal(
				doc.getElementById('zotero-item-pane-message-box').textContent,
				Zotero.getString('pane.item.selected.multiple', 2)
			);
		})
	})
	
	describe("#viewAttachment", function () {
		Components.utils.import("resource://zotero-unit/httpd.js");
		var apiKey = Zotero.Utilities.randomString(24);
		var port = 16213;
		var baseURL = `http://localhost:${port}/`;
		var server;
		var responses = {};
		
		var setup = Zotero.Promise.coroutine(function* (options = {}) {
			server = sinon.fakeServer.create();
			server.autoRespond = true;
		});
		
		function setResponse(response) {
			setHTTPResponse(server, baseURL, response, responses);
		}
		
		before(function () {
			Zotero.HTTP.mock = sinon.FakeXMLHttpRequest;
			
			Zotero.Sync.Runner.apiKey = apiKey;
			Zotero.Sync.Runner.baseURL = baseURL;
		})
		beforeEach(function* () {
			this.httpd = new HttpServer();
			this.httpd.start(port);
			
			yield Zotero.Users.setCurrentUserID(1);
			yield Zotero.Users.setCurrentUsername("testuser");
		})
		afterEach(function* () {
			var defer = new Zotero.Promise.defer();
			this.httpd.stop(() => defer.resolve());
			yield defer.promise;
		})
		
		it("should download an attachment on-demand", function* () {
			yield setup();
			Zotero.Sync.Storage.Local.downloadAsNeeded(Zotero.Libraries.userLibraryID, true);
			
			var item = new Zotero.Item("attachment");
			item.attachmentLinkMode = 'imported_file';
			item.attachmentPath = 'storage:test.txt';
			// TODO: Test binary data
			var text = Zotero.Utilities.randomString();
			item.attachmentSyncState = "to_download";
			yield item.saveTx();
			
			var mtime = "1441252524000";
			var md5 = Zotero.Utilities.Internal.md5(text)
			
			var newStorageSyncTime = Math.round(new Date().getTime() / 1000);
			setResponse({
				method: "GET",
				url: "users/1/laststoragesync",
				status: 200,
				text: "" + newStorageSyncTime
			});
			var s3Path = `pretend-s3/${item.key}`;
			this.httpd.registerPathHandler(
				`/users/1/items/${item.key}/file`,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 302, "Found");
						response.setHeader("Zotero-File-Modification-Time", mtime, false);
						response.setHeader("Zotero-File-MD5", md5, false);
						response.setHeader("Zotero-File-Compressed", "No", false);
						response.setHeader("Location", baseURL + s3Path, false);
					}
				}
			);
			this.httpd.registerPathHandler(
				"/" + s3Path,
				{
					handle: function (request, response) {
						response.setStatusLine(null, 200, "OK");
						response.write(text);
					}
				}
			);
			
			yield zp.viewAttachment(item.id);
			
			assert.equal((yield item.attachmentHash), md5);
			assert.equal((yield item.attachmentModificationTime), mtime);
			var path = yield item.getFilePathAsync();
			assert.equal((yield Zotero.File.getContentsAsync(path)), text);
		})
	})
	
	
	describe("#setVirtual()", function () {
		var cv;
		
		before(function* () {
			cv = zp.collectionsView;
		});
		beforeEach(function () {
			Zotero.Prefs.clear('duplicateLibraries');
			Zotero.Prefs.clear('unfiledLibraries');
			return selectLibrary(win);
		})
		
		it("should show a hidden virtual folder", function* () {
			// Create unfiled, duplicate items
			var title = Zotero.Utilities.randomString();
			var item1 = yield createDataObject('item', { title });
			var item2 = yield createDataObject('item', { title });
			
			// Start hidden
			Zotero.Prefs.set('duplicateLibraries', "");
			Zotero.Prefs.set('unfiledLibraries', "");
			yield cv.refresh();
			
			// Show Duplicate Items
			var id = "D" + userLibraryID;
			assert.isFalse(cv.getRowIndexByID(id));
			yield zp.setVirtual(userLibraryID, 'duplicates', true);
			
			// Clicking should select both items
			var row = cv.getRowIndexByID(id);
			assert.ok(row);
			assert.equal(cv.selection.currentIndex, row);
			yield waitForItemsLoad(win);
			var iv = zp.itemsView;
			row = iv.getRowIndexByID(item1.id);
			assert.isNumber(row);
			clickOnItemsRow(iv, row);
			assert.equal(iv.selection.count, 2);
			
			// Show Unfiled Items
			id = "U" + userLibraryID;
			assert.isFalse(cv.getRowIndexByID(id));
			yield zp.setVirtual(userLibraryID, 'unfiled', true);
			assert.ok(cv.getRowIndexByID(id));
		});
		
		it("should hide a virtual folder shown by default", function* () {
			yield cv.refresh();
			
			// Hide Duplicate Items
			var id = "D" + userLibraryID;
			assert.ok(yield cv.selectByID(id));
			yield zp.setVirtual(userLibraryID, 'duplicates', false);
			assert.isFalse(cv.getRowIndexByID(id));
			
			// Hide Unfiled Items
			id = "U" + userLibraryID;
			assert.ok(yield cv.selectByID(id));
			yield zp.setVirtual(userLibraryID, 'unfiled', false);
			assert.isFalse(cv.getRowIndexByID(id));
		});
		
		it("should hide an explicitly shown virtual folder", function* () {
			// Start shown
			Zotero.Prefs.set('duplicateLibraries', "" + userLibraryID);
			Zotero.Prefs.set('unfiledLibraries', "" + userLibraryID);
			yield cv.refresh();
			
			// Hide Duplicate Items
			var id = "D" + userLibraryID;
			assert.ok(yield cv.selectByID(id));
			yield waitForItemsLoad(win);
			yield zp.setVirtual(userLibraryID, 'duplicates', false);
			assert.isFalse(cv.getRowIndexByID(id));
			assert.equal(cv.getSelectedLibraryID(), userLibraryID);
			
			
			// Hide Unfiled Items
			id = "U" + userLibraryID;
			assert.ok(yield cv.selectByID(id));
			yield waitForItemsLoad(win);
			yield zp.setVirtual(userLibraryID, 'unfiled', false);
			assert.isFalse(cv.getRowIndexByID(id));
			assert.equal(cv.getSelectedLibraryID(), userLibraryID);
		});
	});
	
	describe("#editSelectedCollection()", function () {
		it("should edit a saved search", function* () {
			var search = yield createDataObject('search');
			var promise = waitForWindow('chrome://zotero/content/searchDialog.xul', function (win) {
				let searchBox = win.document.getElementById('search-box');
				var c = searchBox.search.getCondition(
					searchBox.search.addCondition("title", "contains", "foo")
				);
				searchBox.addCondition(c);
				Zotero.debug("ACCEPTING");
				win.document.documentElement.acceptDialog();
			});
			yield zp.editSelectedCollection();
			yield promise;
			var conditions = search.getConditions();
			Zotero.debug(conditions);
			assert.lengthOf(Object.keys(conditions), 2);
		});
	});
	
	describe("#onCollectionSelected()", function() {
		var cv;
		
		beforeEach(function* () {
			cv = zp.collectionsView;
			yield cv.selectLibrary(Zotero.Libraries.userLibraryID);
			Zotero.Prefs.clear('itemsView.columnVisibility');
			yield clearFeeds();
		});
		
		it("should store column visibility settings when switching from default to feeds", function* () {
			doc.getElementById('zotero-items-column-dateAdded').setAttribute('hidden', false);
			var feed = yield createFeed();
			yield cv.selectLibrary(feed.libraryID);
			var settings = JSON.parse(Zotero.Prefs.get('itemsView.columnVisibility'));
			assert.isOk(settings.default.dateAdded);
		});
		
		it("should restore column visiblity when switching between default and feeds", function* () {
			doc.getElementById('zotero-items-column-dateAdded').setAttribute('hidden', false);
			var feed = yield createFeed();
			yield cv.selectLibrary(feed.libraryID);
			assert.equal(doc.getElementById('zotero-items-column-dateAdded').getAttribute('hidden'), 'true');
			doc.getElementById('zotero-items-column-firstCreator').setAttribute('hidden', true);
			yield cv.selectLibrary(Zotero.Libraries.userLibraryID);
			assert.equal(doc.getElementById('zotero-items-column-dateAdded').getAttribute('hidden'), 'false');
			yield cv.selectLibrary(feed.libraryID);
			assert.equal(doc.getElementById('zotero-items-column-firstCreator').getAttribute('hidden'), 'true');
		});
		
		it("should restore column visibility settings on restart", function* () {
			doc.getElementById('zotero-items-column-dateAdded').setAttribute('hidden', false);
			assert.equal(doc.getElementById('zotero-items-column-dateAdded').getAttribute('hidden'), 'false');
			
			win.close();
			win = yield loadZoteroPane();
			doc = win.document;
			zp = win.ZoteroPane;
			
			assert.equal(doc.getElementById('zotero-items-column-dateAdded').getAttribute('hidden'), 'false');
		});
	});
})
