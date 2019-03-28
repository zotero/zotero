"use strict";

describe("Tag Selector", function () {
	var libraryID, win, doc, collectionsView, tagSelectorElem, tagSelector;
	
	var clearTagColors = Zotero.Promise.coroutine(function* (libraryID) {
		var tagColors = Zotero.Tags.getColors(libraryID);
		for (let name of tagColors.keys()) {
			yield Zotero.Tags.setColor(libraryID, name, false);
		}
	});
	
	function getColoredTags() {
		return [...getColoredTagElements()].map(elem => elem.textContent);
	}
	
	function getColoredTagElements() {
		return tagSelectorElem.querySelectorAll('.tag-selector-item.colored');
	}
	
	function getRegularTags() {
		return [...getRegularTagElements()].map(elem => elem.textContent);
	}
	
	function getRegularTagElements() {
		return tagSelectorElem.querySelectorAll('.tag-selector-item:not(.colored)');
	}
	
	
	before(function* () {
		libraryID = Zotero.Libraries.userLibraryID;
		
		win = yield loadZoteroPane();
		doc = win.document;
		collectionsView = win.ZoteroPane.collectionsView;
		tagSelectorElem = doc.getElementById('zotero-tag-selector');
		tagSelector = win.ZoteroPane.tagSelector;
		
		// Wait for things to settle
		yield Zotero.Promise.delay(100);
	});
	
	beforeEach(async function () {
		await selectLibrary(win);
		await clearTagColors(libraryID);
		// Default "Display All Tags in This Library" off
		tagSelector.displayAllTags = false;
		tagSelector.selectedTags = new Set();
		tagSelector.handleSearch('');
		tagSelector.onItemViewChanged({
			collectionTreeRow: win.ZoteroPane.getCollectionTreeRow(),
			libraryID
		});
		await waitForTagSelector(win);
	});
	
	after(function () {
		win.close();
	});
	
	it("should sort colored tags by assigned number key", async function () {
		var collection = await createDataObject('collection');
		
		await Zotero.Tags.setColor(libraryID, "B", '#AAAAAA', 1);
		await Zotero.Tags.setColor(libraryID, "A", '#BBBBBB', 2);
		await Zotero.Tags.setColor(libraryID, "C", '#CCCCCC', 3);
		
		var item = createUnsavedDataObject('item', { collections: [collection.id] });
		var item = createUnsavedDataObject('item');
		await item.setTags(["A", "B"]);
		var promise = waitForTagSelector(win);
		await item.saveTx();
		await promise;
		
		var tags = getColoredTags();
		assert.sameOrderedMembers(tags, ['B', 'A', 'C']);
	});
	
	it('should not display duplicate tags when automatic and manual tag with same name exists', async function () {
		var collection = await createDataObject('collection');
		var item1 = createUnsavedDataObject('item', { collections: [collection.id] });
		item1.setTags([{
			tag: "A",
			type: 1
		}]);
		var item2 = createUnsavedDataObject('item', { collections: [collection.id] });
		item2.setTags(["A", "B"]);	
		var promise = waitForTagSelector(win);
		await Zotero.DB.executeTransaction(async function () {
			await item1.save();
			await item2.save();
		});
		await promise;
		
		var tags = getRegularTags();
		assert.sameMembers(tags, ['A', 'B']);
	});
	
	describe("#handleSearch()", function () {
		it("should filter to tags matching the search", function* () {
			var collection = yield createDataObject('collection');
			var item = createUnsavedDataObject('item', { collections: [collection.id] });
			item.setTags(['a', 'b', 'c']);
			var promise = waitForTagSelector(win);
			yield item.saveTx();
			yield promise;
			
			promise = waitForTagSelector(win);
			tagSelector.handleSearch('a');
			yield Zotero.Promise.delay(500);
			
			yield promise;
			
			var tags = getRegularTags();
			assert.sameMembers(tags, ['a']);

			tagSelector.handleSearch('');
			yield Zotero.Promise.delay(500);
			
			yield item.eraseTx();
		});
	});
	
	describe("#handleTagSelected()", function () {
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
			
			tagSelector.handleTagSelected('A');
			yield waitForTagSelector(win);
			
			var tags = getRegularTags();
			assert.sameMembers(tags, ['A', 'B']);
		});
	});
	
	
	describe("#displayAllTags", function () {
		it("should show all tags in library when true", function* () {
			tagSelector.displayAllTags = true;
			
			var tag1 = 'A ' + Zotero.Utilities.randomString();
			var tag2 = 'B ' + Zotero.Utilities.randomString();
			var tag3 = 'C ' + Zotero.Utilities.randomString();
			
			var collection = yield createDataObject('collection');
			var item1 = createUnsavedDataObject('item');
			item1.setTags([tag1]);
			var item2 = createUnsavedDataObject('item', { collections: [collection.id] });
			item2.setTags([tag2]);
			var item3 = createUnsavedDataObject('item', { collections: [collection.id] });
			item3.setTags([tag3]);
			var promise = waitForTagSelector(win);
			yield Zotero.DB.executeTransaction(function* () {
				yield item1.save();
				yield item2.save();
				yield item3.save();
			});
			yield promise;
			
			var tags = getRegularTags();
			assert.includeMembers(tags, [tag1, tag2, tag3]);
			assert.isBelow(tags.indexOf(tag1), tags.indexOf(tag2));
			assert.isBelow(tags.indexOf(tag2), tags.indexOf(tag3));
			
			var elems = getRegularTagElements();
			// Tag not associated with any items in this collection should be disabled
			assert.isTrue(elems[tags.indexOf(tag1)].classList.contains('disabled'));
			assert.isFalse(elems[tags.indexOf(tag2)].classList.contains('disabled'));
			assert.isFalse(elems[tags.indexOf(tag3)].classList.contains('disabled'));
		});
	});
	
	
	describe("#notify()", function () {
		it("should add a tag when added to an item in the library root", async function () {
			var promise;
			
			if (collectionsView.selection.currentIndex != 0) {
				promise = waitForTagSelector(win);
				await collectionsView.selectLibrary();
				await promise;
			}
			
			// Add item with tags to library root
			var tag1 = 'A ' + Zotero.Utilities.randomString();
			var tag2 = 'M ' + Zotero.Utilities.randomString();
			var tag3 = 'Z ' + Zotero.Utilities.randomString();
			
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: tag3
				},
				{
					tag: tag1,
					type: 1
				}
			]);
			promise = waitForTagSelector(win);
			await item.saveTx();
			await promise;
			
			var tags = getRegularTags();
			assert.includeMembers(tags, [tag1, tag3]);
			assert.isBelow(tags.indexOf(tag1), tags.indexOf(tag3));
			
			// Add another tag to the item, sorted between the two other tags
			promise = waitForTagSelector(win);
			item.addTag(tag2);
			await item.saveTx();
			await promise;
			
			var tags = getRegularTags();
			assert.includeMembers(tags, [tag1, tag2, tag3]);
			assert.isBelow(tags.indexOf(tag1), tags.indexOf(tag2));
			assert.isBelow(tags.indexOf(tag2), tags.indexOf(tag3));
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
		});
		
		it("should update colored tag disabled state when items are added to and removed from collection", async function () {
			var tag1 = 'A ' + Zotero.Utilities.randomString();
			var tag2 = 'B ' + Zotero.Utilities.randomString();
			var tag3 = 'C ' + Zotero.Utilities.randomString();
			
			// Add collection
			var promise = waitForTagSelector(win);
			var collection = await createDataObject('collection');
			await promise;
			
			var elems = getColoredTagElements();
			assert.lengthOf(elems, 0);
			
			await Zotero.Tags.setColor(libraryID, tag1, '#AAAAAA', 1);
			await Zotero.Tags.setColor(libraryID, tag2, '#BBBBBB', 2);
			await Zotero.Tags.setColor(libraryID, tag3, '#CCCCCC', 3);
			
			// Colored tags should appear initially as disabled
			elems = getColoredTagElements();
			assert.lengthOf(elems, 3);
			assert.isTrue(elems[0].classList.contains('disabled'));
			assert.isTrue(elems[1].classList.contains('disabled'));
			assert.isTrue(elems[2].classList.contains('disabled'));
			
			// Add items with tags to collection
			promise = waitForTagSelector(win)
			var item1;
			var item2;
			await Zotero.DB.executeTransaction(async function () {
				item1 = createUnsavedDataObject('item', { collections: [collection.id], tags: [tag1, tag2] });
				item2 = createUnsavedDataObject('item', { collections: [collection.id], tags: [tag2] });
				await item1.save();
				await item2.save();
			});
			await promise;
			
			elems = getColoredTagElements();
			assert.lengthOf(elems, 3);
			// Assigned tags should be enabled
			assert.isFalse(elems[0].classList.contains('disabled'));
			assert.isFalse(elems[1].classList.contains('disabled'));
			// Unassigned tag should still be disabled
			assert.isTrue(elems[2].classList.contains('disabled'));
			
			// Remove item from collection
			promise = waitForTagSelector(win)
			item1.removeFromCollection(collection.id);
			await item1.saveTx();
			await promise;
			
			// A and C should be disabled
			elems = getColoredTagElements();
			assert.lengthOf(elems, 3);
			assert.isTrue(elems[0].classList.contains('disabled'));
			assert.isFalse(elems[1].classList.contains('disabled'));
			assert.isTrue(elems[2].classList.contains('disabled'));
		});
		
		it("should update colored tag disabled state when tags are added to and removed from items", async function () {
			var tag1 = 'A ' + Zotero.Utilities.randomString();
			var tag2 = 'B ' + Zotero.Utilities.randomString();
			var tag3 = 'C ' + Zotero.Utilities.randomString();
			
			var elems = getColoredTagElements();
			assert.lengthOf(elems, 0);
			
			await Zotero.Tags.setColor(libraryID, tag1, '#AAAAAA', 1);
			await Zotero.Tags.setColor(libraryID, tag2, '#BBBBBB', 2);
			await Zotero.Tags.setColor(libraryID, tag3, '#CCCCCC', 3);
			
			// Add items to collection
			var item1 = await createDataObject('item');
			var item2 = await createDataObject('item');
			
			var promise = waitForTagSelector(win)
			await Zotero.DB.executeTransaction(async function () {
				item1.setTags([tag1, tag2]);
				item2.setTags([tag1]);
				await item1.save();
				await item2.save();
			});
			await promise;
			
			elems = getColoredTagElements();
			assert.lengthOf(elems, 3);
			// Assigned tags should be enabled
			assert.isFalse(elems[0].classList.contains('disabled'));
			assert.isFalse(elems[1].classList.contains('disabled'));
			// Unassigned tag should still be disabled
			assert.isTrue(elems[2].classList.contains('disabled'));
			
			// Remove tags from one item
			promise = waitForTagSelector(win)
			item1.setTags([]);
			await item1.saveTx();
			await promise;
			
			// B and C should be disabled
			elems = getColoredTagElements();
			assert.lengthOf(elems, 3);
			assert.isFalse(elems[0].classList.contains('disabled'));
			assert.isTrue(elems[1].classList.contains('disabled'));
			assert.isTrue(elems[2].classList.contains('disabled'));
		});
		
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
			yield item.saveTx();
			
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
			var tagElems = tagSelectorElem.querySelectorAll('.tag-selector-item');
			var count = tagElems.length;

			var promise = waitForTagSelector(win);
			yield Zotero.Tags.setColor(libraryID, "Top", '#AAAAAA');
			yield promise;

			tagElems = tagSelectorElem.querySelectorAll('.tag-selector-item');
			assert.equal(tagElems.length, count + 1);
		});
		
		it("shouldn't re-insert a new tag that matches an existing color", function* () {
			// Add A and B as colored tags without any items
			yield Zotero.Tags.setColor(libraryID, "A", '#CC9933', 1);
			yield Zotero.Tags.setColor(libraryID, "B", '#990000', 2);
			
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

			var tagElems = tagSelectorElem.querySelectorAll('.tag-selector-item');
			
			// Make sure the colored tags are still in the right position
			var tags = new Map();
			for (let i = 0; i < tagElems.length; i++) {
				tags.set(tagElems[i].textContent, i);
			}
			assert.isAbove(tags.get("B"), tags.get("A"));
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
		
		it("shouldn't remove a tag when a tag is removed from an item in a collection in displayAllTags mode", async function () {
			tagSelector.displayAllTags = true;
			
			var tag = Zotero.Utilities.randomString();
			
			// Add item with tag not in collection
			var promise = waitForTagSelector(win);
			var item1 = await createDataObject('item', { tags: [tag] });
			await promise;
			
			promise = waitForTagSelector(win);
			var collection = await createDataObject('collection');
			await promise;
			
			// Add item with tag to collection
			promise = waitForTagSelector(win);
			var item2 = await createDataObject('item', { collections: [collection.id], tags: [tag] });
			await promise;
			
			// Tag selector should show the new item's tag
			var tags = getRegularTags();
			assert.include(tags, tag);
			var elems = getRegularTagElements();
			assert.isFalse(elems[tags.indexOf(tag)].classList.contains('disabled'));
			
			item2.removeTag(tag);
			promise = waitForTagSelector(win);
			await item2.saveTx();
			await promise;
			
			// Tag selector should still show the removed item's tag
			tags = getRegularTags();
			assert.include(tags, tag);
			elems = getRegularTagElements();
			assert.isTrue(elems[tags.indexOf(tag)].classList.contains('disabled'));
		});
		
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
			
			// Tag selector should show the new tag
			assert.include(getRegularTags(), "A");
			
			// Remove tag from library
			promise = waitForTagSelector(win);
			waitForDialog();
			tagSelector.contextTag = {name: "A"};
			yield tagSelector.openDeletePrompt();
			yield promise;
			
			// Tag selector shouldn't show the deleted tag
			assert.notInclude(getRegularTags(), "A");
		});
		
		it("should deselect a tag when removed from the last item in this view", async function () {
			await selectLibrary(win);
			
			var tag1 = Zotero.Utilities.randomString();
			var tag2 = Zotero.Utilities.randomString();
			var item1 = createUnsavedDataObject('item', { tags: [{ tag: tag1 }] });
			var item2 = createUnsavedDataObject('item', { tags: [{ tag: tag2 }] });
			var promise = waitForTagSelector(win);
			await Zotero.DB.executeTransaction(async function () {
				await item1.save();
				await item2.save();
			});
			await promise;
			
			tagSelector.handleTagSelected(tag1);
			await waitForTagSelector(win);
			
			// Tag selector should show the selected tag
			assert.include(getRegularTags(), tag1);
			// And not the unselected one
			assert.notInclude(getRegularTags(), tag2);
			
			// Remove tag from item
			promise = waitForTagSelector(win, 2);
			item1.removeTag(tag1);
			await item1.saveTx();
			await promise;
			
			// Removed tag should no longer be shown or selected
			assert.notInclude(getRegularTags(), tag1);
			assert.notInclude(Array.from(tagSelector.getTagSelection()), tag1);
			// Other tags should be shown again
			assert.include(getRegularTags(), tag2);
		});
		
		it("should deselect a tag when deleted from a library", async function () {
			await selectLibrary(win);
			
			var promise = waitForTagSelector(win, 2);
			var tag1 = Zotero.Utilities.randomString();
			var tag2 = Zotero.Utilities.randomString();
			var item1 = await createDataObject('item', { tags: [{ tag: tag1 }] });
			var item2 = await createDataObject('item', { tags: [{ tag: tag2 }] });
			await Zotero.DB.executeTransaction(async function () {
				await item1.save();
				await item2.save();
			});
			await promise;
			
			tagSelector.handleTagSelected(tag1);
			await waitForTagSelector(win);
			
			// Tag selector should show the selected tag
			assert.include(getRegularTags(), tag1);
			// And not the unselected one
			assert.notInclude(getRegularTags(), tag2);
			
			// Remove tag from library
			promise = waitForTagSelector(win, 2);
			await Zotero.Tags.removeFromLibrary(libraryID, Zotero.Tags.getID(tag1));
			await promise;
			
			// Deleted tag should no longer be shown or selected
			assert.notInclude(getRegularTags(), tag1);
			assert.notInclude(Array.from(tagSelector.getTagSelection()), tag1);
			// Other tags should be shown again
			assert.include(getRegularTags(), tag2);
		});
	});
	
	describe("#openRenamePrompt", function () {
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
			tagSelector.contextTag = {name: tag};
			yield tagSelector.openRenamePrompt();
			yield promise;
			
			var tags = getRegularTags();
			assert.include(tags, newTag);
		});
		
		it("should rename a non-matching colored tag and update the tag selector", function* () {
			yield selectLibrary(win);
			
			var oldTag = Zotero.Utilities.randomString();
			var newTag = Zotero.Utilities.randomString();
			
			var promise = waitForTagSelector(win);
			yield Zotero.Tags.setColor(libraryID, oldTag, "#F3F3F3");
			yield promise;
			
			promise = waitForTagSelector(win);
			waitForWindow("chrome://global/content/commonDialog.xul", function (dialog) {
				dialog.document.getElementById('loginTextbox').value = newTag;
				dialog.document.documentElement.acceptDialog();
			});
			tagSelector.contextTag = {name: oldTag};
			yield tagSelector.openRenamePrompt();
			yield promise;
			
			var tags = getColoredTags();
			assert.notInclude(tags, oldTag);
			assert.include(tags, newTag);
		});
	})
	
	describe("#openColorPickerWindow()", function () {
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
			tagSelector.contextTag = {name: tag};
			yield tagSelector.openColorPickerWindow();
			yield dialogPromise;
			yield tagSelectorPromise;
			
			assert.include(getColoredTags(), tag);
			assert.notInclude(getRegularTags(), tag);
		})
	});
	
	describe("#deleteAutomatic()", function() {
		it('should delete automatic tags', async function() {
			await selectLibrary(win);
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: "automatic",
					type: 1
				},
				{
					tag: 'manual'
				}
			]);
			var promise = waitForTagSelector(win);
			await item.saveTx();
			await promise;
			
			assert.include(getRegularTags(), "automatic");
			assert.include(getRegularTags(), "manual");
			
			var dialogPromise = waitForDialog();
			var tagSelectorPromise = waitForTagSelector(win);
			await tagSelector.deleteAutomatic();
			await dialogPromise;
			await tagSelectorPromise;
			
			assert.include(getRegularTags(), 'manual');
			assert.notInclude(getRegularTags(), 'automatic');
		});
	});
})
