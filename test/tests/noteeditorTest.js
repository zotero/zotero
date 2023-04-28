"use strict";

describe("Note Editor", function () {
	var win, zp;
	
	before(function* () {
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
	});
	
	after(function () {
		win.close();
	});
	
	var waitForNoteEditor = Zotero.Promise.coroutine(function* (item) {
		var noteEditor = win.document.getElementById('zotero-note-editor');
		while (noteEditor.item != item) {
			Zotero.debug("Waiting for note editor");
			yield Zotero.Promise.delay(50);
			noteEditor = win.document.getElementById('zotero-note-editor');
		}
		return new Zotero.Promise((resolve, reject) => {
			noteEditor.onInit(() => resolve(noteEditor));
		});
	});
	
	
	describe("Tags box", function () {
		it("should open new row for editing if no tags", async function () {
			var note = await createDataObject('item', { itemType: 'note', note: "A" });
			var noteEditor = await waitForNoteEditor(note);
			var linksBox = noteEditor._id('links-box');
			linksBox._tagsClickHandler();
			await Zotero.Promise.delay(100);
			var tagsBox = linksBox._id('tags-popup').firstChild;
			var tagRows = tagsBox._id('rows');
			
			assert.equal(tagRows.childNodes.length, 1);
			
			linksBox._id('tags-popup').hidePopup();
		});
		
		it("should only open one new row for editing", async function () {
			var note = await createDataObject('item', { itemType: 'note', note: "B" });
			var noteEditor = await waitForNoteEditor(note);
			var linksBox = noteEditor._id('links-box');
			linksBox._tagsClickHandler();
			await Zotero.Promise.delay(100);
			// Close and reopen
			linksBox._id('tags-popup').hidePopup();
			linksBox._tagsClickHandler();
			await Zotero.Promise.delay(100);
			
			// Should still be only one empty row
			var tagsBox = linksBox._id('tags-popup').firstChild;
			var tagRows = tagsBox._id('rows');
			
			assert.equal(tagRows.childNodes.length, 1);
			
			linksBox._id('tags-popup').hidePopup();
		});
		
		it("should show tags in alphabetical order", function* () {
			var note = new Zotero.Item('note');
			note.setNote('C');
			note.addTag('B');
			yield note.saveTx();
			note.addTag('A');
			note.addTag('C');
			yield note.saveTx();
			
			var noteEditor = yield waitForNoteEditor(note);
			var linksBox = noteEditor._id('links-box');
			assert.equal(linksBox._id('tags-value').textContent, "A, B, C");
		});
	});
});
