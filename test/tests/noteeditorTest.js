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
	
	var waitForNoteEditor = async function (item) {
		var noteEditor = win.document.getElementById('zotero-note-editor');
		while (noteEditor.item != item) {
			Zotero.debug("Waiting for note editor");
			await Zotero.Promise.delay(50);
			noteEditor = win.document.getElementById('zotero-note-editor');
		}
		return new Zotero.Promise((resolve, reject) => {
			noteEditor.onInit(() => resolve(noteEditor));
		});
	};
});
