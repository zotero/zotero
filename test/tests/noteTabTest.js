describe("Note Tab", function () {
	var win, doc, ZoteroPane, Zotero_Tabs, ZoteroContextPane;

	before(async function () {
		win = await loadZoteroPane();
		doc = win.document;
		ZoteroPane = win.ZoteroPane;
		Zotero_Tabs = win.Zotero_Tabs;
		ZoteroContextPane = win.ZoteroContextPane;
	});
	
	after(function () {
		Zotero_Tabs.closeAll();
		win.close();
	});

	describe("Note Tab Operations", function () {
		beforeEach(function () {
			// Reset the state before each test
			Zotero_Tabs.closeAll();
		});

		it("should open note in tab", async function () {
			let item = new Zotero.Item('note');
			item.setNote('This is a test note.');
			await item.saveTx();

			let noteEditor = await Zotero.Notes.open(item.id);

			assert.isNotNull(noteEditor, "Note editor should be opened");
			assert.equal(noteEditor.item.id, item.id, "Note editor should be associated with the correct item");

			let sameNoteEditor = await Zotero.Notes.open(item.id, undefined, {
				tabID: Zotero_Tabs.selectedID,
			});
			assert.equal(noteEditor, sameNoteEditor, "Opening the same note should return the existing editor");

			let duplicateNoteEditor = await Zotero.Notes.open(item.id, undefined, {
				allowDuplicate: true,
			});

			assert.isNotNull(duplicateNoteEditor, "Duplicate note editor should be opened");
			assert.notEqual(noteEditor, duplicateNoteEditor, "Duplicate note editor should be a new instance");
			assert.equal(duplicateNoteEditor.item.id, item.id, "Duplicate note editor should be associated with the correct item");

			Zotero_Tabs.closeAll();

			await Zotero.Notes.open(item.id, undefined, {
				openInBackground: true,
			});

			assert.equal(Zotero_Tabs.selectedType, 'library', "Tab should be opened in background");
		});
	});
});
