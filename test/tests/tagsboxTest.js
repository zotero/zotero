"use strict";

describe("Item Tags Box", function () {
	var win, doc, collectionsView;
	
	before(function* () {
		win = yield loadZoteroPane();
		doc = win.document;
		
		// Wait for things to settle
		yield Zotero.Promise.delay(100);
	});
	after(function () {
		win.close();
	});
	
	function waitForTagsBox() {
		var deferred = Zotero.Promise.defer();
		var tagsbox = doc.getElementById('zotero-editpane-tags');
		var onRefresh = function (event) {
			tagsbox.removeEventListener('refresh', onRefresh);
			deferred.resolve();
		}
		tagsbox.addEventListener('refresh', onRefresh);
		return deferred.promise;
	}
	
	describe("#notify()", function () {
		it("should update an existing tag on rename", function* () {
			var tag = Zotero.Utilities.randomString();
			var newTag = Zotero.Utilities.randomString();
			
			var tabbox = doc.getElementById('zotero-view-tabbox');
			tabbox.selectedIndex = 0;
			
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: tag
				}
			]);
			yield item.saveTx();
			
			var tabbox = doc.getElementById('zotero-view-tabbox');
			tabbox.selectedIndex = 2;
			yield waitForTagsBox();
			var tagsbox = doc.getElementById('zotero-editpane-tags');
			var rows = tagsbox.id('tagRows').getElementsByTagName('row');
			assert.equal(rows.length, 1);
			assert.equal(rows[0].textContent, tag);
			
			yield Zotero.Tags.rename(Zotero.Libraries.userLibraryID, tag, newTag);
			
			var rows = tagsbox.id('tagRows').getElementsByTagName('row');
			assert.equal(rows.length, 1);
			assert.equal(rows[0].textContent, newTag);
		})
		
		it("should update when a tag's color is removed", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var tag = Zotero.Utilities.randomString();
			var tabbox = doc.getElementById('zotero-view-tabbox');
			tabbox.selectedIndex = 0;
			
			yield Zotero.Tags.setColor(libraryID, tag, "#990000");
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: tag,
				},
				{
					tag: "_A"
				}
			]);
			yield item.saveTx();
			
			var tabbox = doc.getElementById('zotero-view-tabbox');
			tabbox.selectedIndex = 2;
			yield waitForTagsBox();
			var tagsbox = doc.getElementById('zotero-editpane-tags');
			var rows = tagsbox.id('tagRows').getElementsByTagName('row');
			
			// Colored tags aren't sorted first, for now
			assert.notOk(rows[0].getElementsByTagName('label')[0].style.color);
			assert.ok(rows[1].getElementsByTagName('label')[0].style.color);
			assert.equal(rows[0].textContent, "_A");
			assert.equal(rows[1].textContent, tag);
			
			yield Zotero.Tags.setColor(libraryID, tag, false);
			
			assert.notOk(rows[1].getElementsByTagName('label')[0].style.color);
		})
		
		it("should update when a tag is removed from the library", function* () {
			var tag = Zotero.Utilities.randomString();
			
			var tabbox = doc.getElementById('zotero-view-tabbox');
			tabbox.selectedIndex = 0;
			
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: tag
				}
			]);
			yield item.saveTx();
			
			var tabbox = doc.getElementById('zotero-view-tabbox');
			tabbox.selectedIndex = 2;
			yield waitForTagsBox();
			var tagsbox = doc.getElementById('zotero-editpane-tags');
			var rows = tagsbox.id('tagRows').getElementsByTagName('row');
			assert.equal(rows.length, 1);
			assert.equal(rows[0].textContent, tag);
			
			yield Zotero.Tags.removeFromLibrary(
				Zotero.Libraries.userLibraryID, (yield Zotero.Tags.getID(tag))
			);
			
			var rows = tagsbox.id('tagRows').getElementsByTagName('row');
			assert.equal(rows.length, 0);
		})
	})
})
