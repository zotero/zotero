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

			let editorInstance = await Zotero.Notes.open(item.id);

			assert.isNotNull(editorInstance, "Note editor should be opened");
			assert.equal(editorInstance.itemID, item.id, "Note editor should be associated with the correct item");

			let sameNoteEditor = await Zotero.Notes.open(item.id, undefined, {
				tabID: Zotero_Tabs.selectedID,
			});
			assert.equal(editorInstance, sameNoteEditor, "Opening the same note should return the existing editor");

			let duplicateEditorInstance = await Zotero.Notes.open(item.id, undefined, {
				allowDuplicate: true,
			});

			assert.isNotNull(duplicateEditorInstance, "Duplicate note editor should be opened");
			assert.notEqual(editorInstance, duplicateEditorInstance, "Duplicate note editor should be a new instance");
			assert.equal(duplicateEditorInstance.itemID, item.id, "Duplicate note editor should be associated with the correct item");

			Zotero_Tabs.closeAll();

			await waitForCallback(
				() => !Zotero.Notes._editorInstances.find(e => e.tabID),
				100, 10);

			await Zotero.Notes.open(item.id, undefined, {
				openInBackground: true,
			});

			assert.equal(Zotero_Tabs.selectedType, 'library', "Tab should be opened in background");
		});

		it("should open unloaded note tab", async function () {
			// https://forums.zotero.org/discussion/128954/
			let item = new Zotero.Item("note");
			item.setNote("This is a test note.");
			await item.saveTx();

			let editorInstance = await Zotero.Notes.open(item.id);
			let tabID = editorInstance.tabID;
			Zotero_Tabs.unload(tabID);

			let editor2 = await ZoteroPane.openNote(item.id);

			assert.equal(editorInstance, editor2, "Unloaded note tab should be reloaded");
		});

		it("should select opened note tab", async function () {
			// https://forums.zotero.org/discussion/128917/
			let item = new Zotero.Item("note");
			item.setNote("This is a test note.");
			await item.saveTx();

			let editorInstance = await Zotero.Notes.open(item.id);
			let tabID = editorInstance.tabID;

			let promise = waitForNotifierEvent("select", "tab");
			
			Zotero_Tabs.select("zotero-pane");
			await promise;

			promise = waitForNotifierEvent("select", "tab");

			let editor2 = await ZoteroPane.openNote(item.id);
			await promise;

			assert.equal(Zotero_Tabs.selectedID, tabID, "Should select the opened note tab");
			assert.equal(editor2, editorInstance, "Should return the same editor instance");
		});
	});
});
