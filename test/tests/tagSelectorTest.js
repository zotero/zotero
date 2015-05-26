"use strict";

describe("Tag Selector", function () {
	var win, doc, collectionsView;
	
	before(function* () {
		win = yield loadZoteroPane();
		doc = win.document;
		collectionsView = win.ZoteroPane.collectionsView;
		
		// Wait for things to settle
		yield Zotero.Promise.delay(100);
	});
	after(function () {
		win.close();
	});
	
	function waitForTagSelector() {
		var deferred = Zotero.Promise.defer();
		var tagSelector = doc.getElementById('zotero-tag-selector');
		var onRefresh = function (event) {
			tagSelector.removeEventListener('refresh', onRefresh);
			deferred.resolve();
		}
		tagSelector.addEventListener('refresh', onRefresh);
		return deferred.promise;
	}
	
	describe("#notify()", function () {
		it("should add a tag when added to an item in the current view", function* () {
			var promise, tagSelector;
			
			if (collectionsView.selection.currentIndex != 0) {
				promise = waitForTagSelector();
				yield collectionsView.selectLibrary();
				yield promise;
			}
			
			// Add item with tag to library root
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: 'A'
				}
			]);
			promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			// Tag selector should have at least one tag
			tagSelector = doc.getElementById('zotero-tag-selector');
			assert.isAbove(tagSelector.getVisible().length, 0);
			
			// Add collection
			promise = waitForTagSelector();
			var collection = yield createDataObject('collection');
			yield promise;
			
			// Tag selector should be empty in new collection
			tagSelector = doc.getElementById('zotero-tag-selector');
			assert.equal(tagSelector.getVisible().length, 0);
			
			// Add item with tag to collection
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: 'B'
				}
			]);
			item.setCollections([collection.id]);
			promise = waitForTagSelector()
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			tagSelector = doc.getElementById('zotero-tag-selector');
			assert.equal(tagSelector.getVisible().length, 1);
		})
		
		it("should remove a tag when an item is removed from a collection", function* () {
			// Add collection
			var promise = waitForTagSelector();
			var collection = yield createDataObject('collection');
			yield promise;
			
			// Add item with tag to collection
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: 'A'
				}
			]);
			item.setCollections([collection.id]);
			promise = waitForTagSelector()
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			var tagSelector = doc.getElementById('zotero-tag-selector');
			assert.equal(tagSelector.getVisible().length, 1);
			
			item.setCollections();
			promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			// Tag selector shouldn't show the removed item's tag
			tagSelector = doc.getElementById('zotero-tag-selector');
			assert.equal(tagSelector.getVisible().length, 0);
		})
		
		it("should remove a tag when an item in a collection is moved to the trash", function* () {
			// Add collection
			var promise = waitForTagSelector();
			var collection = yield createDataObject('collection');
			yield promise;
			
			// Add item with tag to collection
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: 'A'
				}
			]);
			item.setCollections([collection.id]);
			promise = waitForTagSelector()
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			var tagSelector = doc.getElementById('zotero-tag-selector');
			assert.equal(tagSelector.getVisible().length, 1);
			
			// Move item to trash
			item.deleted = true;
			promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			// Tag selector shouldn't show the deleted item's tag
			tagSelector = doc.getElementById('zotero-tag-selector');
			assert.equal(tagSelector.getVisible().length, 0);
		})
	})
})
