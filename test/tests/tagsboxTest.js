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
	
	
	describe("Tag Editing", function () {
		it("should update tag when pressing Enter in textbox", async function () {
			var tag = Zotero.Utilities.randomString();
			var newTag = Zotero.Utilities.randomString();
			
			var tabbox = doc.getElementById('zotero-view-tabbox');
			tabbox.selectedIndex = 0;
			
			var item = await createDataObject('item', { tags: [{ tag }] });
			
			tabbox = doc.getElementById('zotero-view-tabbox');
			tabbox.selectedIndex = 2;
			var tagsbox = doc.querySelector('tags-box');
			var rows = tagsbox.querySelectorAll('li');
			assert.equal(rows.length, 1);
			assert.equal(rows[0].textContent, tag);
			
			var label = rows[0].querySelector('label[fieldname="tag"]');
			label.click();
			var input = rows[0].querySelector('input[fieldname="tag"]');
			input.value = newTag;
			
			// Press Enter in textbox
			var enterEvent = new KeyboardEvent('keydown', {
				'key': 'Enter',
				'code': 'Enter',
				'keyCode': 13,
				'which': 13
			});
			input.dispatchEvent(enterEvent);
			await waitForItemEvent('modify');
			
			rows = tagsbox.querySelectorAll('li');
			assert.equal(rows[0].textContent, newTag);
			// Should open new empty textbox
			assert.equal(rows.length, 2);
		});
	});
	
	
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
			var tagsbox = doc.querySelector('tags-box');
			var rows = tagsbox.querySelectorAll('li');
			assert.equal(rows.length, 1);
			assert.equal(rows[0].textContent, tag);
			
			yield Zotero.Tags.rename(Zotero.Libraries.userLibraryID, tag, newTag);
			
			rows = tagsbox.querySelectorAll('li');
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
			var tagsbox = doc.querySelector('tags-box');
			var rows = tagsbox.querySelectorAll('li');
			
			// Colored tags aren't sorted first, for now
			assert.notOk(rows[0].querySelector('label').style.color);
			assert.ok(rows[1].querySelector('label').style.color);
			assert.equal(rows[0].textContent, "_A");
			assert.equal(rows[1].textContent, tag);
			
			yield Zotero.Tags.setColor(libraryID, tag, false);
			
			rows = tagsbox.querySelectorAll('li');
			assert.notOk(rows[1].querySelector('label').style.color);
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
			var tagsbox = doc.querySelector('tags-box');
			var rows = tagsbox.querySelectorAll('li');
			assert.equal(rows.length, 1);
			assert.equal(rows[0].textContent, tag);
			
			yield Zotero.Tags.removeFromLibrary(Zotero.Libraries.userLibraryID, Zotero.Tags.getID(tag));
			
			rows = tagsbox.querySelectorAll('li');
			assert.equal(rows.length, 0);
		})
	})
})
