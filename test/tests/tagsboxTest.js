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
			if (!doc.hasFocus()) {
				// editable-text behavior relies on focus, so we first need to bring the window to the front.
				// Not required on all platforms. In some cases (e.g. Linux), the window is at the front from the start.
				let win = Zotero.getMainWindow();
				let activatePromise = new Promise(
					resolve => win.addEventListener('activate', resolve, { once: true })
				);
				Zotero.Utilities.Internal.activate();
				Zotero.Utilities.Internal.activate(win);
				await activatePromise;
			}
			
			var tag = Zotero.Utilities.randomString();
			var newTag = Zotero.Utilities.randomString();
			
			var item = await createDataObject('item', { tags: [{ tag }] });
			
			var tagsbox = doc.querySelector('#zotero-editpane-tags');
			var rows = tagsbox.querySelectorAll('.row editable-text');
			assert.equal(rows.length, 1);
			assert.equal(rows[0].value, tag);
			
			var firstRow = rows[0];
			firstRow.focus();
			firstRow.ref.value = newTag;
			firstRow.ref.dispatchEvent(new Event('input'));
			
			// Press Enter in textbox
			var enterEvent = new KeyboardEvent('keydown', {
				'key': 'Enter',
				'code': 'Enter',
				'keyCode': 13,
				'which': 13
			});
			let promise = waitForItemEvent('modify');
			firstRow.ref.dispatchEvent(enterEvent);
			await promise;
			
			rows = tagsbox.querySelectorAll('.row editable-text');
			assert.equal(rows[0].value, newTag);
			assert.equal(rows.length, 1);
		});
	});
	
	
	describe("#notify()", function () {
		it("should update an existing tag on rename", function* () {
			var tag = Zotero.Utilities.randomString();
			var newTag = Zotero.Utilities.randomString();
			
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: tag
				}
			]);
			yield item.saveTx();
			var tagsbox = doc.querySelector('#zotero-editpane-tags');
			var rows = tagsbox.querySelectorAll('.row');
			assert.equal(rows.length, 1);
			assert.equal(rows[0].querySelector("editable-text").value, tag);
			
			yield Zotero.Tags.rename(Zotero.Libraries.userLibraryID, tag, newTag);
			
			rows = tagsbox.querySelectorAll('.row');
			assert.equal(rows.length, 1);
			assert.equal(rows[0].querySelector("editable-text").value, newTag);
		})
		
		it("should update when a tag's color is removed", function* () {
			var libraryID = Zotero.Libraries.userLibraryID;
			
			var tag = Zotero.Utilities.randomString();
			
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
			
			var tagsbox = doc.querySelector('#zotero-editpane-tags');
			var rows = tagsbox.querySelectorAll('.row');

			// Colored tags are sorted first
			assert.ok(getComputedStyle(rows[0]).getPropertyValue('--tag-color'));
			assert.equal(rows[0].querySelector("editable-text").value, tag);
			
			assert.notOk(getComputedStyle(rows[1]).getPropertyValue('--tag-color'));
			assert.equal(rows[1].querySelector("editable-text").value, "_A");
			
			yield Zotero.Tags.setColor(libraryID, tag, false);
			
			// No color remains on the tag
			rows = tagsbox.querySelectorAll('.row');
			assert.notOk(getComputedStyle(rows[0]).getPropertyValue('--tag-color'));
			assert.notOk(getComputedStyle(rows[1]).getPropertyValue('--tag-color'));
		})
		
		it("should update when a tag is removed from the library", function* () {
			var tag = Zotero.Utilities.randomString();
			
			var item = createUnsavedDataObject('item');
			item.setTags([
				{
					tag: tag
				}
			]);
			yield item.saveTx();
			
			var tagsbox = doc.querySelector('#zotero-editpane-tags');
			var rows = tagsbox.querySelectorAll('.row');
			assert.equal(rows.length, 1);
			assert.equal(rows[0].querySelector("editable-text").value, tag);
			
			yield Zotero.Tags.removeFromLibrary(Zotero.Libraries.userLibraryID, Zotero.Tags.getID(tag));
			
			rows = tagsbox.querySelectorAll('.row');
			assert.equal(rows.length, 0);
		})
	})

	describe("#render", function() {
		it("should render colored tags followed by emoji tags followed by ordinary tags", async function() {
			let item = await createDataObject('item', {
				tags: [
					{ tag: 'A_usual_tag' },
					{ tag: 'B_usual_tag' },
					{ tag: 'C_emoji_tag😀' },
					{ tag: 'D_emoji_tag😀' },
					{ tag: 'E_colored_tag' },
					{ tag: 'F_colored_tag' },
				]
			});

			await Zotero.Tags.setColor(item.libraryID, 'F_colored_tag', '#111111', 0);
			await Zotero.Tags.setColor(item.libraryID, 'E_colored_tag', '#222222', 1);

			var tagsbox = doc.querySelector('#zotero-editpane-tags');
			var tagRows = [...tagsbox.querySelectorAll(".row")];

			// Colored tags sorted first by their position
			assert.equal(tagRows[0].querySelector("editable-text").value, "F_colored_tag");
			assert.equal(tagRows[1].querySelector("editable-text").value, "E_colored_tag");
			// Followed by emoji tags sorted alphabetically
			assert.equal(tagRows[2].querySelector("editable-text").value, "C_emoji_tag😀");
			assert.equal(tagRows[3].querySelector("editable-text").value, "D_emoji_tag😀");
			// Followed by remaining tags sorted alphabetically
			assert.equal(tagRows[4].querySelector("editable-text").value, "A_usual_tag");
			assert.equal(tagRows[5].querySelector("editable-text").value, "B_usual_tag");
		});

		it("should add a new tag at the correct position", async function () {
			// Create a colored tag that the item does not have
			await createDataObject('item', {
				tags: [
					{ tag: 'a_colored_tag' },
				]
			});

			// Create item with a lot of tags - colored, emoji and usual
			let item = await createDataObject('item', {
				tags: [
					{ tag: 'AA_usual_tag' },
					{ tag: 'BB_usual_tag' },
					{ tag: 'CC_emoji_tag😀' },
					{ tag: 'DD_emoji_tag😀' },
					{ tag: 'EE_colored_tag' },
					{ tag: 'FF_colored_tag' },
				]
			});

			await Zotero.Tags.setColor(item.libraryID, 'FF_colored_tag', '#111111', 0);
			await Zotero.Tags.setColor(item.libraryID, 'EE_colored_tag', '#222222', 1);
			await Zotero.Tags.setColor(item.libraryID, 'a_colored_tag', '#222222', 2);

			var tagsbox = doc.querySelector('#zotero-editpane-tags');
			var tagRows;
			
			// should be added above all usual tags but below colored and emoji
			tagsbox.add("a_usual_tag");
			tagRows = [...tagsbox.querySelectorAll(".row")];
			assert.equal(tagRows[4].querySelector("editable-text").value, "a_usual_tag");

			// should be added below colored tags above all other emoji tags
			tagsbox.add("a_emoji_tag😀");
			tagRows = [...tagsbox.querySelectorAll(".row")];
			assert.equal(tagRows[2].querySelector("editable-text").value, "a_emoji_tag😀");

			// should be added at the position of the colored tag
			tagsbox.add("a_colored_tag");
			tagRows = [...tagsbox.querySelectorAll(".row")];
			assert.equal(tagRows[2].querySelector("editable-text").value, "a_colored_tag");
		});
	});
})
