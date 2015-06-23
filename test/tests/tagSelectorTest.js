"use strict";

describe("Tag Selector", function () {
	var win, doc, collectionsView;
	
	var clearTagColors = Zotero.Promise.coroutine(function* (libraryID) {
		var tagColors = yield Zotero.Tags.getColors(libraryID);
		for (let name of tagColors.keys()) {
			yield Zotero.Tags.setColor(libraryID, name, false);
		}
	});
	
	function getColoredTags() {
		var tagSelector = doc.getElementById('zotero-tag-selector');
		var tagsBox = tagSelector.id('tags-box');
		var elems = tagsBox.getElementsByTagName('button');
		var names = [];
		for (let i = 0; i < elems.length; i++) {
			if (elems[i].style.order < 0) {
				names.push(elems[i].textContent);
			}
		}
		return names;
	}
	
	function getRegularTags() {
		var tagSelector = doc.getElementById('zotero-tag-selector');
		var tagsBox = tagSelector.id('tags-box');
		var elems = tagsBox.getElementsByTagName('button');
		var names = [];
		for (let i = 0; i < elems.length; i++) {
			if (elems[i].style.order >= 0 && elems[i].style.display != 'none') {
				names.push(elems[i].textContent);
			}
		}
		return names;
	}
	
	
	before(function* () {
		win = yield loadZoteroPane();
		doc = win.document;
		collectionsView = win.ZoteroPane.collectionsView;
		
		// Wait for things to settle
		yield Zotero.Promise.delay(100);
	});
	beforeEach(function* () {
		var libraryID = Zotero.Libraries.userLibraryID;
		yield clearTagColors(libraryID);
	})
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
		it("should add a tag when added to an item in the library root", function* () {
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
				},
				{
					tag: 'B',
					type: 1
				}
			]);
			promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			// Tag selector should have at least one tag
			assert.isAbove(getRegularTags().length, 1);
		});
		
		it("should add a tag when an item is added in a collection", function* () {
			var promise, tagSelector;
			
			// Add collection
			promise = waitForTagSelector();
			var collection = yield createDataObject('collection');
			yield promise;
			
			// Tag selector should be empty in new collection
			assert.equal(getRegularTags().length, 0);
			
			// Add item with tag to collection
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: 'C'
				}
			]);
			item.setCollections([collection.id]);
			promise = waitForTagSelector()
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			assert.equal(getRegularTags().length, 1);
		})
		
		it("should add a tag when an item is added to a collection", function* () {
			var promise, tagSelector;
			
			// Add collection
			promise = waitForTagSelector();
			var collection = yield createDataObject('collection');
			yield promise;
			
			// Tag selector should be empty in new collection
			assert.equal(getRegularTags().length, 0);
			
			// Add item with tag to library root
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: 'C'
				}
			]);
			promise = waitForTagSelector()
			yield item.saveTx();
			yield promise;
			
			// Tag selector should still be empty in collection
			assert.equal(getRegularTags().length, 0);
			
			item.setCollections([collection.id]);
			promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			tagSelector = doc.getElementById('zotero-tag-selector');
			assert.equal(getRegularTags().length, 1);
		})
		
		it("shouldn't re-insert a new tag that matches an existing color", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			/*// Remove all tags in library
			var tags = yield Zotero.Tags.getAll(libraryID);
			tags.forEach(function (tag) {
				var tagID = yield Zotero.Tags.getID(tag);
				yield Zotero.Tags.removeFromLibrary(libraryID, tagID);
			});*/
			
			// Add B and A as colored tags without any items
			yield Zotero.Tags.setColor(libraryID, "B", '#990000');
			yield Zotero.Tags.setColor(libraryID, "A", '#CC9933');
			
			// Add A to an item to make it a real tag
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: "A"
				}
			]);
			var promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			var tagSelector = doc.getElementById('zotero-tag-selector');
			var tagElems = tagSelector.id('tags-box').childNodes;
			
			// Make sure the colored tags are still in the right position
			var tags = new Map();
			for (let i = 0; i < tagElems.length; i++) {
				tags.set(tagElems[i].textContent, tagElems[i].style.order);
			}
			assert.isBelow(parseInt(tags.get("B")), 0);
			assert.isBelow(parseInt(tags.get("B")), parseInt(tags.get("A")));
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
			promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			assert.equal(getRegularTags().length, 1);
			
			item.setCollections();
			promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			// Tag selector shouldn't show the removed item's tag
			assert.equal(getRegularTags().length, 0);
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
			assert.equal(getRegularTags().length, 1);
			
			// Move item to trash
			item.deleted = true;
			promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			// Tag selector shouldn't show the deleted item's tag
			assert.equal(getRegularTags().length, 0);
		})
		
		it("should remove a tag when a tag is deleted for a library", function* () {
			yield selectLibrary(win);
			
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: 'A'
				}
			]);
			var promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			assert.include(getRegularTags(), "A");
			
			// Remove tag from library
			promise = waitForTagSelector();
			var dialogPromise = waitForDialog();
			var tagSelector = doc.getElementById('zotero-tag-selector');
			yield tagSelector.delete("A");
			yield promise;
			
			// Tag selector shouldn't show the deleted item's tag
			assert.notInclude(getRegularTags(), "A");
		})
	})
	
	describe("#rename()", function () {
		it("should rename a tag and update the tag selector", function* () {
			yield selectLibrary(win);
			
			var tag = Zotero.Utilities.randomString();
			var newTag = Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: tag
				}
			]);
			var promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			var tagSelector = doc.getElementById('zotero-tag-selector');
			promise = waitForTagSelector();
			var promptPromise = waitForWindow("chrome://global/content/commonDialog.xul", function (dialog) {
				dialog.document.getElementById('loginTextbox').value = newTag;
				dialog.document.documentElement.acceptDialog();
			})
			yield tagSelector.rename(tag);
			yield promise;
			
			var tags = getRegularTags();
			assert.include(tags, newTag);
		})
	})
	
	describe("#_openColorPickerWindow()", function () {
		it("should assign a color to a tag", function* () {
			yield selectLibrary(win);
			var tag = "b " + Zotero.Utilities.randomString();
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: "a"
				},
				{
					tag: tag
				}
			]);
			var promise = waitForTagSelector();
			yield item.saveTx();
			yield promise;
			
			var tagSelector = doc.getElementById('zotero-tag-selector');
			
			assert.include(getRegularTags(), "a");
			
			var dialogPromise = waitForDialog(false, undefined, 'chrome://zotero/content/tagColorChooser.xul');
			var tagSelectorPromise = waitForTagSelector();
			yield tagSelector._openColorPickerWindow(tag);
			yield dialogPromise;
			yield tagSelectorPromise;
			
			assert.include(getColoredTags(), tag);
			assert.notInclude(getRegularTags(), tag);
		})
	});
})
