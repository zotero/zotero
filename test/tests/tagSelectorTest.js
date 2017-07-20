"use strict";

describe("Tag Selector", function () {
	var win, doc, collectionsView, tagSelector;
	
	var clearTagColors = Zotero.Promise.coroutine(function* (libraryID) {
		var tagColors = Zotero.Tags.getColors(libraryID);
		for (let name of tagColors.keys()) {
			yield Zotero.Tags.setColor(libraryID, name, false);
		}
	});
	
	function getColoredTags() {
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
		tagSelector = doc.getElementById('zotero-tag-selector');
		
		// Wait for things to settle
		yield Zotero.Promise.delay(100);
	});
	
	beforeEach(function* () {
		var libraryID = Zotero.Libraries.userLibraryID;
		yield clearTagColors(libraryID);
		// Default "Display All Tags in This Library" off
		tagSelector.filterToScope = true;
		tagSelector.setSearch('');
		yield tagSelector.refresh(true);
	})
	
	after(function () {
		win.close();
	});
	
	describe("#setSearch()", function () {
		it("should filter to tags matching the search", function* () {
			var collection = yield createDataObject('collection');
			var item = createUnsavedDataObject('item', { collections: [collection.id] });
			item.setTags(['a', 'b', 'c']);
			var promise = waitForTagSelector(win);
			yield item.saveTx();
			yield promise;
			
			var tagsSearch = doc.getElementById('tags-search');
			tagsSearch.value = 'a';
			tagsSearch.doCommand();
			
			var tags = getRegularTags();
			assert.sameMembers(tags, ['a']);
			
			tagsSearch.value = '';
			tagsSearch.doCommand();
			yield item.eraseTx();
		});
	});
	
	describe("#refresh()", function () {
		it("should remove tags not on matching items on tag click", function* () {
			var collection = yield createDataObject('collection');
			var item1 = createUnsavedDataObject('item', { collections: [collection.id] });
			item1.setTags([
				{
					tag: "A"
				}
			]);
			var item2 = createUnsavedDataObject('item', { collections: [collection.id] });
			item2.setTags([
				{
					tag: "A"
				},
				{
					tag: "B"
				}
			]);
			var item3 = createUnsavedDataObject('item', { collections: [collection.id] });
			item3.setTags([
				{
					tag: "C"
				}
			]);
			var promise = waitForTagSelector(win);
			yield Zotero.DB.executeTransaction(function* () {
				yield item1.save();
				yield item2.save();
				yield item3.save();
			});
			yield promise;
			
			var buttons = tagSelector.id('tags-box').getElementsByTagName('button');
			var spy = sinon.spy(win.ZoteroPane, "updateTagFilter");
			buttons[0].click();
			
			yield spy.returnValues[0];
			
			spy.restore();
			
			var tags = getRegularTags();
			assert.sameMembers(tags, ['A', 'B']);
		});
	});
	
	
	describe("#filterToScope", function () {
		it("should show all tags in library when false", function* () {
			tagSelector.filterToScope = false;
			
			var collection = yield createDataObject('collection');
			var item1 = createUnsavedDataObject('item');
			item1.setTags([
				{
					tag: "A"
				}
			]);
			var item2 = createUnsavedDataObject('item', { collections: [collection.id] });
			item2.setTags([
				{
					tag: "B"
				}
			]);
			var item3 = createUnsavedDataObject('item', { collections: [collection.id] });
			item3.setTags([
				{
					tag: "C"
				}
			]);
			var promise = waitForTagSelector(win);
			yield Zotero.DB.executeTransaction(function* () {
				yield item1.save();
				yield item2.save();
				yield item3.save();
			});
			yield promise;
			
			var tags = getRegularTags();
			assert.sameMembers(tags, ['A', 'B', 'C']);
		});
	});
	
	
	describe("#notify()", function () {
		it("should add a tag when added to an item in the library root", function* () {
			var promise, tagSelector;
			
			if (collectionsView.selection.currentIndex != 0) {
				promise = waitForTagSelector(win);
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
			promise = waitForTagSelector(win);
			yield item.saveTx();
			yield promise;
			
			// Tag selector should have at least one tag
			assert.isAbove(getRegularTags().length, 1);
		});
		
		it("should add a tag when an item is added in a collection", function* () {
			var promise, tagSelector;
			
			// Add collection
			promise = waitForTagSelector(win);
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
			promise = waitForTagSelector(win)
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			assert.equal(getRegularTags().length, 1);
		})
		
		it("should add a tag when an item is added to a collection", function* () {
			var promise, tagSelector;
			
			// Add collection
			promise = waitForTagSelector(win);
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
			promise = waitForTagSelector(win)
			yield item.saveTx();
			yield promise;
			
			// Tag selector should still be empty in collection
			assert.equal(getRegularTags().length, 0);
			
			item.setCollections([collection.id]);
			promise = waitForTagSelector(win);
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			assert.equal(getRegularTags().length, 1);
		})
		
		it("should show a colored tag at the top of the list even when linked to no items", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var tagElems = tagSelector.id('tags-box').getElementsByTagName('button');
			var count = tagElems.length;
			
			yield Zotero.Tags.setColor(libraryID, "Top", '#AAAAAA');
			
			assert.equal(tagElems.length, count + 1);
		});
		
		it("shouldn't re-insert a new tag that matches an existing color", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			/*// Remove all tags in library
			var tags = yield Zotero.Tags.getAll(libraryID);
			tags.forEach(function (tag) {
				var tagID = Zotero.Tags.getID(tag);
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
			var promise = waitForTagSelector(win);
			yield item.saveTx();
			yield promise;
			
			var tagElems = tagSelector.id('tags-box').getElementsByTagName('button');
			
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
			var promise = waitForTagSelector(win);
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
			promise = waitForTagSelector(win);
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			assert.equal(getRegularTags().length, 1);
			
			item.setCollections();
			promise = waitForTagSelector(win);
			yield item.saveTx();
			yield promise;
			
			// Tag selector shouldn't show the removed item's tag
			assert.equal(getRegularTags().length, 0);
		})
		
		it("should remove a tag when an item in a collection is moved to the trash", function* () {
			// Add collection
			var promise = waitForTagSelector(win);
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
			promise = waitForTagSelector(win)
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			assert.equal(getRegularTags().length, 1);
			
			// Move item to trash
			item.deleted = true;
			promise = waitForTagSelector(win);
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
			var promise = waitForTagSelector(win);
			yield item.saveTx();
			yield promise;
			
			// Tag selector should show the new item's tag
			assert.include(getRegularTags(), "A");
			
			// Remove tag from library
			promise = waitForTagSelector(win);
			var dialogPromise = waitForDialog();
			yield tagSelector.deleteTag("A");
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
			var promise = waitForTagSelector(win);
			yield item.saveTx();
			yield promise;
			
			promise = waitForTagSelector(win);
			var promptPromise = waitForWindow("chrome://global/content/commonDialog.xul", function (dialog) {
				dialog.document.getElementById('loginTextbox').value = newTag;
				dialog.document.documentElement.acceptDialog();
			})
			yield tagSelector.rename(tag);
			yield promise;
			
			var tags = getRegularTags();
			assert.include(tags, newTag);
		});
		
		it("should rename a non-matching colored tag and update the tag selector", function* () {
			yield selectLibrary(win);
			
			var oldTag = Zotero.Utilities.randomString();
			var newTag = Zotero.Utilities.randomString();
			
			var libraryID = Zotero.Libraries.userLibraryID;
			var promise = waitForTagSelector(win);
			yield Zotero.Tags.setColor(libraryID, oldTag, "#F3F3F3");
			yield promise;
			
			promise = waitForTagSelector(win);
			var promptPromise = waitForWindow("chrome://global/content/commonDialog.xul", function (dialog) {
				dialog.document.getElementById('loginTextbox').value = newTag;
				dialog.document.documentElement.acceptDialog();
			})
			yield tagSelector.rename(oldTag);
			yield promise;
			
			var tags = getColoredTags();
			assert.notInclude(tags, oldTag);
			assert.include(tags, newTag);
		});
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
			var promise = waitForTagSelector(win);
			yield item.saveTx();
			yield promise;
			
			
			assert.include(getRegularTags(), "a");
			
			var dialogPromise = waitForDialog(false, undefined, 'chrome://zotero/content/tagColorChooser.xul');
			var tagSelectorPromise = waitForTagSelector(win);
			yield tagSelector._openColorPickerWindow(tag);
			yield dialogPromise;
			yield tagSelectorPromise;
			
			assert.include(getColoredTags(), tag);
			assert.notInclude(getRegularTags(), tag);
		})
	});
})
