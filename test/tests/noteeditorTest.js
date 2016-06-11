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
	
	describe("Tags box", function () {
		it("should open new row for editing if no tags", function* () {
			var note = yield createDataObject('item', { itemType: 'note' });
			var noteEditor = win.document.getElementById('zotero-note-editor');
			var linksBox = noteEditor._id('links-box');
			linksBox.tagsClick();
			var tagsBox = linksBox.id('tagsPopup').firstChild;
			var tagRows = tagsBox.id('tagRows');
			assert.equal(tagRows.childNodes.length, 1);
		});
		
		it("should only open one new row for editing", function* () {
			var note = yield createDataObject('item', { itemType: 'note' });
			var noteEditor = win.document.getElementById('zotero-note-editor');
			var linksBox = noteEditor._id('links-box');
			linksBox.tagsClick();
			// Close and reopen
			linksBox.id('tagsPopup').hidePopup();
			linksBox.tagsClick();
			
			// Should still be only one empty row
			var tagsBox = linksBox.id('tagsPopup').firstChild;
			var tagRows = tagsBox.id('tagRows');
			assert.equal(tagRows.childNodes.length, 1);
		});
		
		it("should show tags in alphabetical order", function* () {
			var note = new Zotero.Item('note');
			note.addTag('B');
			yield note.saveTx();
			note.addTag('A');
			note.addTag('C');
			yield note.saveTx();
			
			var noteEditor = win.document.getElementById('zotero-note-editor');
			var linksBox = noteEditor._id('links-box');
			assert.equal(linksBox.id('tags').summary, "A, B, C");
		});
	});
});
