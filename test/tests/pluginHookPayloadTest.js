// Library data never reaches a manager hook as a live object: hooks get IDs, and the synchronous ones a
// read-only snapshot through getItem when the plugin has dataRead
describe("Plugin hook payloads", function () {
	var plugin = usePluginSandbox();
	var log = createCallbackLog();
	var win, item, otherItem;

	before(async function () {
		win = await loadZoteroPane();
		item = await createDataObject("item", { itemType: "book", title: "Callback Test" });
		otherItem = await createDataObject("item", { itemType: "book", title: "Callback Other" });
		// Registering a row renders it for the selected item, so keep that the item the hooks are called with
		await win.ZoteroPane.selectItem(item.id);
	});

	after(async function () {
		await item.eraseTx();
		await otherItem.eraseTx();
		win.close();
	});

	beforeEach(function () {
		log.reset();
		plugin.load(["default", "dataRead", "itemTree", "itemPane", "menu"]);
		plugin.expose("report", log.report);
	});

	afterEach(async function () {
		await Zotero.ItemTreeManager._columnManager._unregisterByPluginID(plugin.id);
		await Zotero.ItemPaneManager._infoRowManager._unregisterByPluginID(plugin.id);
		await Zotero.MenuManager._menuManager._unregisterByPluginID(plugin.id);
	});

	// How Zotero itself calls an info row's hook
	function callRowHook(rowID, hook, props = {}) {
		return Zotero.ItemPaneManager.getInfoRowHook(rowID, hook)({ itemID: item.id, item, tabType: "library", editable: false, ...props });
	}

	it("should pass a tree column's dataProvider the row's ID and a snapshot through getItem", async function () {
		log.expect("dataProvider");
		let dataKey = plugin.run(otherID => Zotero.ItemTreeManager.registerColumn({
			dataKey: "payload-col",
			label: "Payload Column",
			dataProvider: ({ itemID, getItem }) => {
				let row = getItem();
				report("dataProvider", {
					itemID,
					id: row.id,
					kind: row.kind,
					title: row.data.title,
					itemType: row.data.itemType,
					// A snapshot, not the live item
					hasSave: typeof row.save,
					hasGetField: typeof row.getField,
					// getItem(id) reads any other item already in memory
					otherTitle: getItem(otherID).data.title,
					missing: getItem(-1),
				});
				return "test";
			},
		}), otherItem.id);
		Zotero.ItemTreeManager.getCustomCellData(item, dataKey);
		assert.deepEqual(await log.get("dataProvider"), {
			itemID: item.id,
			id: item.id,
			kind: "regular",
			title: "Callback Test",
			itemType: "book",
			hasSave: "undefined",
			hasGetField: "undefined",
			otherTitle: "Callback Other",
			missing: null,
		});
	});

	it("should pass an info row's onGetData the ID and getItem, and its onSetData the ID alone", async function () {
		log.expect("onGetData");
		log.expect("onSetData");
		let rowID = plugin.run(() => Zotero.ItemPaneManager.registerInfoRow({
			rowID: "payload-row",
			label: { l10nID: "general-print" },
			onGetData: ({ itemID, getItem }) => {
				let snapshot = getItem();
				report("onGetData", { itemID, snapshotID: snapshot.id, title: snapshot.data.title, hasSave: typeof snapshot.save });
				return "test";
			},
			// It only writes, so it commits a change set like any async caller
			onSetData: ({ itemID, getItem, item }) => {
				report("onSetData", { itemID, getItem: typeof getItem, item: typeof item });
			},
		}));
		callRowHook(rowID, "onGetData");
		assert.deepEqual(await log.get("onGetData"), { itemID: item.id, snapshotID: item.id, title: "Callback Test", hasSave: "undefined" });
		callRowHook(rowID, "onSetData", { editable: true, value: "x" });
		assert.deepEqual(await log.get("onSetData"), { itemID: item.id, getItem: "undefined", item: "undefined" });
	});

	it("should pass menu hooks IDs, never live items or collection rows", async function () {
		log.expect("onCommand");
		let collection = await createDataObject("collection");
		let menuID = plugin.run(() => Zotero.MenuManager.registerMenu({
			menuID: "payload-menu",
			target: "main/library/item",
			menus: [{
				menuType: "menuitem",
				l10nID: "general-print",
				onCommand: context => report("onCommand", {
					itemIDs: context.itemIDs,
					libraryIDs: context.libraryIDs,
					collectionIDs: context.collectionIDs,
					items: typeof context.items,
					collectionTreeRows: typeof context.collectionTreeRows,
				}),
			}],
		}));
		// The context the item menu hands every hook, live objects included
		let row = { type: "collection", ref: collection, isCollection: () => true, isSearch: () => false };
		Zotero.MenuManager._menuManager._optionsCache[menuID].menus[0].onCommand(null, {
			itemIDs: [item.id],
			libraryIDs: [collection.libraryID],
			collectionIDs: [collection.id],
			items: [item],
			collectionTreeRows: [row],
		});
		assert.deepEqual(await log.get("onCommand"), {
			itemIDs: [item.id],
			libraryIDs: [collection.libraryID],
			collectionIDs: [collection.id],
			items: "undefined",
			collectionTreeRows: "undefined",
		});
		await collection.eraseTx();
	});

	it("should pass only IDs without dataRead", async function () {
		plugin.load(["default", "itemTree", "itemPane"]);
		plugin.expose("report", log.report);
		log.expect("dataProvider");
		log.expect("onGetData");
		let dataKey = plugin.run(otherID => Zotero.ItemTreeManager.registerColumn({
			dataKey: "noread-col",
			label: "No Read",
			dataProvider: ({ itemID, getItem }) => {
				report("dataProvider", { itemID, item: getItem(), other: getItem(otherID) });
				return "test";
			},
		}), otherItem.id);
		let rowID = plugin.run(() => Zotero.ItemPaneManager.registerInfoRow({
			rowID: "noread-row",
			label: { l10nID: "general-print" },
			onGetData: ({ itemID, getItem, item }) => {
				report("onGetData", { itemID, snapshot: getItem(), item: typeof item });
				return "test";
			},
		}));
		Zotero.ItemTreeManager.getCustomCellData(item, dataKey);
		callRowHook(rowID, "onGetData");
		// Not even the key or libraryID, only the local ID
		assert.deepEqual(await log.get("dataProvider"), { itemID: item.id, item: null, other: null });
		assert.deepEqual(await log.get("onGetData"), { itemID: item.id, snapshot: null, item: "undefined" });
	});

	// Kept past its hook, a getItem would answer for whatever item was selected when it was captured
	it("should expire a getItem stashed past its hook", async function () {
		log.expect("dataProvider");
		let dataKey = plugin.run(() => Zotero.ItemTreeManager.registerColumn({
			dataKey: "stash-col",
			label: "Stash",
			dataProvider: ({ getItem }) => {
				globalThis.stashedGetItem = getItem;
				report("dataProvider", getItem().data.title);
				return "test";
			},
		}));
		Zotero.ItemTreeManager.getCustomCellData(item, dataKey);
		assert.equal(await log.get("dataProvider"), "Callback Test", "it reads normally while the hook runs");
		// The boundary replaces a chrome error's message, so only the throw itself crosses
		assert.isTrue(plugin.run(() => {
			try {
				globalThis.stashedGetItem();
				return false;
			}
			catch {
				return true;
			}
		}), "a stashed getItem throws instead of answering for a stale item");
	});

	// The getter holds the gate, so a manager handing one out cannot forget it
	it("should gate the chrome-side itemGetter on dataRead", function () {
		plugin.load(["default", "itemTree", "itemPane"]);
		assert.isNull(Zotero.DataStore.itemGetter(item.id, plugin.id)(), "without dataRead");
		plugin.load(["default", "dataRead"]);
		assert.isNotNull(Zotero.DataStore.itemGetter(item.id, plugin.id)(), "with dataRead");
		plugin.unload();
		assert.isNull(Zotero.DataStore.itemGetter(item.id, plugin.id)(), "once unloaded");
		assert.equal(Zotero.DataStore.itemGetter(item.id, "zotero@zotero.org")().data.title, "Callback Test",
			"a first-party caller reads");
	});

	// So it can move hook by hook to the new payloads before dropping its privileges
	it("should pass a privileged plugin the new payloads alongside its deprecated live ones", async function () {
		plugin.load(["*"]);
		plugin.expose("report", log.report);
		log.expect("dataProvider");
		log.expect("onGetData");
		log.expect("onCommand");
		let { dataKey, rowID, menuID } = plugin.run(() => ({
			dataKey: Zotero.ItemTreeManager.registerColumn({
				// A privileged plugin gets no injected ID
				pluginID: PLUGIN_ID,
				dataKey: "privileged-col",
				label: "Privileged Column",
				dataProvider: (arg, key, context) => {
					report("dataProvider", { live: arg instanceof Zotero.Item, itemID: context.itemID, title: context.getItem().data.title });
					return "test";
				},
			}),
			rowID: Zotero.ItemPaneManager.registerInfoRow({
				pluginID: PLUGIN_ID,
				rowID: "privileged-row",
				label: { l10nID: "general-print" },
				onGetData: ({ itemID, getItem, item }) => {
					report("onGetData", { live: item instanceof Zotero.Item, itemID, title: getItem().data.title });
					return "test";
				},
			}),
			menuID: Zotero.MenuManager.registerMenu({
				pluginID: PLUGIN_ID,
				menuID: "privileged-menu",
				target: "main/library/item",
				menus: [{
					menuType: "menuitem",
					l10nID: "general-print",
					// Privileged menu hooks keep the legacy (event, context) signature
					onCommand: (event, context) => {
						report("onCommand", { live: context.items?.[0] instanceof Zotero.Item, itemIDs: context.itemIDs });
					},
				}],
			}),
		}));
		let expected = { live: true, itemID: item.id, title: "Callback Test" };

		Zotero.ItemTreeManager.getCustomCellData(item, dataKey);
		assert.deepEqual(await log.get("dataProvider"), expected, "the first argument stays the live item");
		callRowHook(rowID, "onGetData");
		assert.deepEqual(await log.get("onGetData"), expected, "the live item rides along");
		Zotero.MenuManager._menuManager._optionsCache[menuID].menus[0].onCommand(null, { itemIDs: [item.id], items: [item] });
		assert.deepEqual(await log.get("onCommand"), { live: true, itemIDs: [item.id] }, "the live items ride along");
	});
});
