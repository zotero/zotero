describe("Zotero.TabController", function () {
	var plugin = usePluginSandbox();
	var codes = Zotero.TabController.errorCodes;
	var win, windowID, libraryTabID;

	before(async function () {
		win = await loadZoteroPane();
		windowID = win.browsingContext.id;
		await win.ZoteroPane.collectionsView.selectLibrary(Zotero.Libraries.userLibraryID);
	});

	after(function () {
		win.close();
	});

	beforeEach(async function () {
		plugin.load(["default", "tab"]);
		// The library tab has no exposed constant; a plugin finds it by type
		let { tabs } = await requestResult(query("tabs", { windowID }));
		libraryTabID = tabs.find(t => t.type === "library").tabID;
	});

	afterEach(function () {
		win.Zotero_Tabs.closeAll();
	});

	// A request from the plugin's sandbox, its response as plain data
	function query(name, params) {
		return plugin.run((name, params) => Zotero.TabController.query(name, params), name, params);
	}

	function command(name, params) {
		return plugin.run((name, params) => Zotero.TabController.command(name, params), name, params);
	}

	// Tabs report "loading" until the tab manager marks them loaded, which can be after the opener resolves
	async function waitForTabState(tabID, state) {
		for (let attempt = 0; attempt < 100; attempt++) {
			let { tabs } = await requestResult(query("tabs", { windowID }));
			if (tabs.find(t => t.tabID === tabID)?.state === state) {
				return tabs;
			}
			await Zotero.Promise.delay(50);
		}
		throw new Error(`Tab ${tabID} did not reach state '${state}'`);
	}

	it("should define the tab and library-selection requests", function () {
		let { queries, commands } = Zotero.TabController._tabController.requestNames;
		assert.sameMembers(queries, ["tabs"]);
		assert.sameMembers(commands, ["selectTab", "closeTabs", "moveTab", "selectItems", "selectCollectionsOrLibraries", "openTab"]);
	});

	it("should find the library tab by type", function () {
		assert.equal(libraryTabID, "zotero-pane");
	});

	it("should require a window ID on every request", async function () {
		await requestError(query("tabs"), codes.INVALID_PARAMS);
		await requestError(command("selectTab", { tabID: libraryTabID }), codes.INVALID_PARAMS);
		await requestError(query("tabs", { windowID: -1 }), codes.NOT_FOUND);
	});

	it("should check every entry of a list param", async function () {
		await requestError(command("closeTabs", { windowID, tabIDs: [1] }), codes.INVALID_PARAMS);
		await requestError(command("selectItems", { windowID, itemIDs: ["1"] }), codes.INVALID_PARAMS);
		await requestError(command("selectCollectionsOrLibraries", { windowID, type: "library", ids: [1.5] }), codes.INVALID_PARAMS);
	});

	it("should describe the library tab with its selection", async function () {
		let result = await requestResult(query("tabs", { windowID }));
		assert.equal(result.windowID, windowID);
		assert.equal(result.selectedTabID, libraryTabID);
		let [library] = result.tabs;
		assert.equal(library.tabID, libraryTabID);
		assert.equal(library.type, "library");
		assert.equal(library.state, "loaded");
		assert.equal(library.index, 0);
		assert.isTrue(library.selected);
		assert.include(library.libraryIDs, Zotero.Libraries.userLibraryID);
		assert.isArray(library.collectionIDs);
		assert.isArray(library.itemIDs);
	});

	it("should list, select, move and close note tabs", async function () {
		let note1 = await createDataObject("item", { itemType: "note" });
		let note2 = await createDataObject("item", { itemType: "note" });
		let { instance: editor } = await Zotero.Notes.open(note1.id);
		let { tabID: tab2ID } = await Zotero.Notes.open(note2.id, null, { openInBackground: true });

		let tabs = await waitForTabState(editor.tabID, "loaded");
		let { selectedTabID } = await requestResult(query("tabs", { windowID }));
		assert.equal(selectedTabID, editor.tabID);
		assert.lengthOf(tabs, 3);
		assert.isFalse(tabs[0].selected);
		let tab1 = tabs.find(t => t.tabID === editor.tabID);
		assert.equal(tab1.type, "note");
		assert.equal(tab1.state, "loaded");
		assert.deepEqual(tab1.itemIDs, [note1.id]);
		assert.equal(tab1.index, 1);
		assert.isTrue(tab1.selected);
		let tab2 = tabs.find(t => t.tabID === tab2ID);
		assert.equal(tab2.state, "unloaded");
		assert.equal(tab2.index, 2);
		assert.isFalse(tab2.selected);

		await requestResult(command("selectTab", { windowID, tabID: libraryTabID }));
		assert.equal(win.Zotero_Tabs.selectedID, libraryTabID);

		await requestResult(command("moveTab", { windowID, tabID: tab2ID, index: 1 }));
		({ tabs } = await requestResult(query("tabs", { windowID })));
		assert.equal(tabs[1].tabID, tab2ID);
		assert.equal(tabs[2].tabID, editor.tabID);

		await requestResult(command("closeTabs", { windowID, tabIDs: [editor.tabID, tab2ID] }));
		({ tabs } = await requestResult(query("tabs", { windowID })));
		assert.lengthOf(tabs, 1);
	});

	it("should report a reader tab's subtype", async function () {
		let attachment = await importFileAttachment("test.pdf");
		let { instance: reader } = await Zotero.Reader.open(attachment.id);
		await reader._initPromise;
		let tab = (await waitForTabState(reader.tabID, "loaded")).find(t => t.tabID === reader.tabID);
		assert.equal(tab.type, "reader");
		assert.equal(tab.subType, "pdf");
		assert.deepEqual(tab.itemIDs, [attachment.id]);
		assert.isTrue(tab.selected);
	});

	it("should select items in the library tab, switching to it unless told not to", async function () {
		let item1 = await createDataObject("item");
		let item2 = await createDataObject("item");
		let note = await createDataObject("item", { itemType: "note" });
		let { instance: editor } = await Zotero.Notes.open(note.id);
		assert.equal(win.Zotero_Tabs.selectedID, editor.tabID);

		assert.deepEqual(await requestResult(command("selectItems", { windowID, itemIDs: [item1.id, item2.id] })), { selected: true });
		assert.equal(win.Zotero_Tabs.selectedID, libraryTabID);
		assert.sameMembers(win.ZoteroPane.getSelectedItems(true), [item1.id, item2.id]);

		win.Zotero_Tabs.select(editor.tabID);
		assert.deepEqual(await requestResult(command("selectItems", { windowID, itemIDs: [item1.id], noTabSwitch: true })), { selected: true });
		assert.equal(win.Zotero_Tabs.selectedID, editor.tabID);
		assert.sameMembers(win.ZoteroPane.getSelectedItems(true, { libraryTabOnly: true }), [item1.id]);

		assert.deepEqual(await requestResult(command("selectItems", { windowID, itemIDs: [] })), { selected: false });
	});

	it("should select collections or libraries by type and IDs", async function () {
		let collection1 = await createDataObject("collection");
		let collection2 = await createDataObject("collection");
		let select = (type, ids) => requestResult(command("selectCollectionsOrLibraries", { windowID, type, ids }));

		assert.deepEqual(await select("collection", [collection1.id]), { selected: true });
		assert.sameMembers(win.ZoteroPane.getSelectedCollections(true), [collection1.id]);

		// Several IDs use the tree's multi-selection
		assert.deepEqual(await select("collection", [collection1.id, collection2.id]), { selected: true });
		assert.sameMembers(win.ZoteroPane.getSelectedCollections(true), [collection1.id, collection2.id]);
		let { tabs } = await requestResult(query("tabs", { windowID }));
		assert.sameMembers(tabs[0].collectionIDs, [collection1.id, collection2.id]);

		let libraryID = Zotero.Libraries.userLibraryID;
		assert.deepEqual(await select("trash", [libraryID]), { selected: true });
		assert.isTrue(win.ZoteroPane.getCollectionTreeRows()[0].isTrash());

		assert.deepEqual(await select("library", [libraryID]), { selected: true });
		let rows = win.ZoteroPane.getCollectionTreeRows();
		assert.lengthOf(rows, 1);
		assert.isTrue(rows[0].isLibrary());
	});

	it("should fail on unknown tabs, items and rows and protect the library tab", async function () {
		await requestError(command("selectTab", { windowID, tabID: "nope" }), codes.NOT_FOUND);
		await requestError(command("closeTabs", { windowID, tabIDs: [libraryTabID] }), codes.NOT_ALLOWED);
		await requestError(command("moveTab", { windowID, tabID: libraryTabID, index: 1 }), codes.NOT_ALLOWED);
		await requestError(command("moveTab", { windowID, tabID: "nope", index: 0 }), codes.INVALID_PARAMS);
		await requestError(command("selectItems", { windowID, itemIDs: [-1] }), codes.NOT_FOUND);
		await requestError(command("selectCollectionsOrLibraries", { windowID, type: "nope", ids: [1] }), codes.INVALID_PARAMS);
		await requestError(command("selectCollectionsOrLibraries", { windowID, type: "collection", ids: [999999] }), codes.NOT_FOUND);
		await requestError(command("selectCollectionsOrLibraries", { windowID, type: "collection", ids: [] }), codes.INVALID_PARAMS);
		// The validator's reason reaches the caller
		let error = await requestError(command("moveTab", { windowID, tabID: "nope", index: "1" }), codes.INVALID_PARAMS);
		assert.include(error.message, '["index"]');
	});

	it("should open notes and readers in tabs, reusing a tab unless duplicates are allowed", async function () {
		let note = await createDataObject("item", { itemType: "note" });
		let { tabID } = await requestResult(command("openTab", { windowID, type: "note", itemID: note.id }));
		assert.equal(win.Zotero_Tabs.selectedID, tabID);
		let tab = (await waitForTabState(tabID, "loaded")).find(t => t.tabID === tabID);
		assert.equal(tab.type, "note");
		assert.deepEqual(tab.itemIDs, [note.id]);

		// The same item selects the existing tab
		await requestResult(command("selectTab", { windowID, tabID: libraryTabID }));
		let again = await requestResult(command("openTab", { windowID, type: "note", itemID: note.id }));
		assert.equal(again.tabID, tabID);
		assert.equal(win.Zotero_Tabs.selectedID, tabID);

		// A background duplicate is a new, unselected tab at the requested index, left unloaded
		let dup = await requestResult(command("openTab", {
			windowID, type: "note", itemID: note.id, background: true, allowDuplicate: true, index: 1,
		}));
		assert.notEqual(dup.tabID, tabID);
		assert.equal(win.Zotero_Tabs.selectedID, tabID);
		let { tabs } = await requestResult(query("tabs", { windowID }));
		let dupTab = tabs.find(t => t.tabID === dup.tabID);
		assert.equal(dupTab.index, 1);
		assert.equal(dupTab.state, "unloaded");

		// An existing unloaded tab for the item is loaded and reused
		let attachment = await importFileAttachment("test.pdf");
		let { id: unloadedID } = win.Zotero_Tabs.add({ type: "reader-unloaded", title: "PDF", data: { itemID: attachment.id } });
		({ tabID } = await requestResult(command("openTab", { windowID, type: "reader", itemID: attachment.id })));
		assert.equal(tabID, unloadedID);
		tab = (await waitForTabState(tabID, "loaded")).find(t => t.tabID === tabID);
		assert.equal(tab.type, "reader");
		assert.equal(tab.subType, "pdf");
		assert.isTrue(tab.selected);
	});

	it("should fail opening a missing item, an item of the wrong kind, or at a bad index", async function () {
		let item = await createDataObject("item");
		let note = await createDataObject("item", { itemType: "note" });
		await requestError(command("openTab", { windowID, type: "note", itemID: -1 }), codes.NOT_FOUND);
		await requestError(command("openTab", { windowID, type: "note", itemID: item.id }), codes.INVALID_PARAMS);
		await requestError(command("openTab", { windowID, type: "reader", itemID: item.id }), codes.INVALID_PARAMS);
		await requestError(command("openTab", { windowID, type: "library", itemID: note.id }), codes.INVALID_PARAMS);
		await requestError(command("openTab", { windowID, type: "note", itemID: note.id, index: 0 }), codes.INVALID_PARAMS);
		await requestError(command("openTab", { windowID: -1, type: "note", itemID: note.id }), codes.NOT_FOUND);
	});
});
