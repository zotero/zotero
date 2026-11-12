describe("Plugin Zotero.NotifierManager", function () {
	var plugin = usePluginSandbox();
	var other = usePluginSandbox({ id: "other-notifier-plugin@zotero.org" });

	// A chrome observer at a lower priority (higher number) than the plugin's, so once it resolves the
	// plugin's observer has run
	function waitForNotify(types) {
		return new Promise((resolve) => {
			let id = Zotero.Notifier.registerObserver(
				{
					notify: function () {
						// Unregister immediately so it only fires once
						Zotero.Notifier.unregisterObserver(id);
						resolve();
					}
				},
				types,
				'test-sentinel',
				200 // lower priority than default 100, runs after sandbox observer
			);
		});
	}

	beforeEach(function () {
		plugin.load(["default", "dataRead", "dataWrite"]);
	});

	afterEach(async function () {
		await Zotero.NotifierManager._manager._unregisterByPluginID(plugin.id);
		await Zotero.NotifierManager._manager._unregisterByPluginID(other.id);
	});

	it("should remove only the shutting-down plugin's observers", async function () {
		other.load(["default", "dataRead"]);
		function register(sandbox) {
			return sandbox.run(() => {
				globalThis.calls = 0;
				return Zotero.NotifierManager.registerObserver({
					observerID: "shutdown-test",
					types: ["item"],
					onNotify() {
						globalThis.calls++;
					},
				});
			});
		}
		let ownID = register(plugin);
		let otherID = register(other);
		assert.isString(ownID);
		assert.isString(otherID);
		assert.notEqual(ownID, otherID);
		let calls = 0;
		let coreID = Zotero.Notifier.registerObserver({
			notify() {
				calls++;
			},
		}, ["item"]);
		try {
			// The same cleanup the shared manager invokes on plugin shutdown.
			assert.deepEqual(await Zotero.NotifierManager._manager._unregisterByPluginID(plugin.id), [ownID]);
			// This checks observer ownership, independently of any pending notifier transaction.
			await Zotero.Notifier.trigger("modify", "item", [], {}, true);
			assert.equal(plugin.eval("calls"), 0);
			assert.equal(other.eval("calls"), 1);
			assert.equal(calls, 1);
		}
		finally {
			Zotero.Notifier.unregisterObserver(coreID);
		}
	});

	it("should reject invalid and duplicate registrations", function () {
		assert.isFalse(plugin.run(() => Zotero.NotifierManager.registerObserver({ observerID: "missing-notify" })));
		assert.isFalse(plugin.run(() => Zotero.NotifierManager.registerObserver({
			observerID: "invalid-types", types: [1], onNotify() {},
		})));
		let register = () => Zotero.NotifierManager.registerObserver({ observerID: "duplicate", onNotify() {} });
		assert.isString(plugin.run(register));
		assert.isFalse(plugin.run(register));
	});

	it("should discard the cache entry if notifier registration fails", function () {
		assert.throws(() => plugin.run(() => Zotero.NotifierManager.registerObserver({
			observerID: "retry-registration", types: ["invalid-type"], onNotify() {},
		})));
		let id = plugin.run(() => Zotero.NotifierManager.registerObserver({
			observerID: "retry-registration", types: ["item"], onNotify() {},
		}));
		assert.isString(id);
		assert.isTrue(plugin.run(id => Zotero.NotifierManager.unregisterObserver(id), id));
	});

	it("should receive notifications when an item is added", async function () {
		plugin.eval(`
				var _notifyEvent = null;
				var _notifyType = null;
				var _notifyFirstID = null;
				var _notifyIDsLength = null;
				var _observerID = Zotero.NotifierManager.registerObserver({
						onNotify: function({ event, type, ids, extraData }) {
							_notifyEvent = event;
							_notifyType = type;
							_notifyIDsLength = ids.length;
							_notifyFirstID = ids[0];
						},
						types: ['item'],
						observerID: "test-sandbox-add",
				});
			`);

		let promise = waitForNotify(['item']);
		let item = new Zotero.Item('book');
		item.setField('title', 'Notifier Test Book');
		await item.saveTx();
		await promise;

		assert.equal(plugin.eval("_notifyEvent"), 'add');
		assert.equal(plugin.eval("_notifyType"), 'item');
		assert.isAbove(plugin.eval("_notifyIDsLength"), 0, "ids should have length");
		assert.equal(plugin.eval("_notifyFirstID"), item.id, "ids should contain the item ID");

		plugin.eval("Zotero.NotifierManager.unregisterObserver(_observerID)");
		await item.eraseTx();
	});

	it("should not unregister an observer owned by chrome", async function () {
		let calls = 0;
		let id = Zotero.Notifier.registerObserver({
			notify() {
				calls++;
			},
		}, ["item"], "ownership-victim");
		try {
			plugin.run(id => Zotero.NotifierManager.unregisterObserver(id), id);
			await Zotero.Notifier.trigger("modify", "item", []);
			assert.equal(calls, 1);
		}
		finally {
			Zotero.Notifier.unregisterObserver(id);
		}
	});

	it("should not let a plugin spoof ownership when registering or unregistering", async function () {
		other.load(["default", "dataRead"]);
		let id = other.run((pluginID) => {
			globalThis.calls = 0;
			return Zotero.NotifierManager.registerObserver({
				observerID: "other-plugin",
				pluginID,
				types: ["item"],
				priority: 100,
				onNotify() {
					globalThis.calls++;
				},
			});
		}, plugin.id);
		try {
			plugin.run((id, otherID) => Zotero.NotifierManager.unregisterObserver(id, otherID), id, other.id);
			await Zotero.Notifier.trigger("modify", "item", []);
			assert.equal(other.eval("calls"), 1);
			other.run(id => Zotero.NotifierManager.unregisterObserver(id), id);
			await Zotero.Notifier.trigger("modify", "item", []);
			assert.equal(other.eval("calls"), 1);
		}
		finally {
			Zotero.NotifierManager.unregisterObserver(id);
		}
	});

	it("should receive notifications when an item is modified", async function () {
		let item = new Zotero.Item('book');
		item.setField('title', 'Before Modify');
		await item.saveTx();

		plugin.eval(`
				var _modifyFirstID = null;
				var _observerID = Zotero.NotifierManager.registerObserver({
						onNotify: function({ event, type, ids }) {
							if (event === 'modify') {
								_modifyFirstID = ids[0];
							}
						},
						types: ['item'],
						observerID: "test-sandbox-modify",
				});
			`);

		let promise = waitForNotify(['item']);
		item.setField('title', 'After Modify');
		await item.saveTx();
		await promise;

		assert.equal(plugin.eval("_modifyFirstID"), item.id, "Should have received modify event with item ID");

		plugin.eval("Zotero.NotifierManager.unregisterObserver(_observerID)");
		await item.eraseTx();
	});

	it("should receive notifications when an item is trashed", async function () {
		let item = new Zotero.Item('book');
		item.setField('title', 'Trash Test');
		await item.saveTx();

		plugin.eval(`
				var _trashFirstID = null;
				var _observerID = Zotero.NotifierManager.registerObserver({
						onNotify: function({ event, type, ids }) {
							if (event === 'trash') {
								_trashFirstID = ids[0];
							}
						},
						types: ['item'],
						observerID: "test-sandbox-trash",
				});
			`);

		let promise = waitForNotify(['item']);
		item.deleted = true;
		await item.saveTx();
		await promise;

		assert.equal(plugin.eval("_trashFirstID"), item.id, "Should have received trash event with item ID");

		plugin.eval("Zotero.NotifierManager.unregisterObserver(_observerID)");
		await item.eraseTx();
	});

	it("should only receive notifications for subscribed types", async function () {
		plugin.eval(`
				var _collectionNotified = false;
				var _observerID = Zotero.NotifierManager.registerObserver({
						onNotify: function({ event, type, ids }) {
							_collectionNotified = true;
						},
						types: ['collection'],
						observerID: "test-sandbox-type-filter",
				});
			`);

		// Create an item -- should NOT trigger the collection observer
		// Use a sentinel on 'item' to know when item notifications are done
		let itemPromise = waitForNotify(['item']);
		let item = new Zotero.Item('book');
		await item.saveTx();
		await itemPromise;

		assert.isFalse(plugin.eval("_collectionNotified"), "Item add should not trigger collection observer");

		// Create a collection -- should trigger it
		let collectionPromise = waitForNotify(['collection']);
		let collection = new Zotero.Collection();
		collection.name = "Notifier Type Filter Test";
		await collection.saveTx();
		await collectionPromise;

		assert.isTrue(plugin.eval("_collectionNotified"), "Collection add should trigger collection observer");

		plugin.eval("Zotero.NotifierManager.unregisterObserver(_observerID)");
		await item.eraseTx();
		await collection.eraseTx();
	});

	it("should not receive notifications after unregistering", async function () {
		plugin.eval(`
				var _postUnregCount = 0;
				var _observerID = Zotero.NotifierManager.registerObserver({
						onNotify: function({ event, type, ids }) {
							_postUnregCount++;
						},
						types: ['item'],
						observerID: "test-sandbox-unreg",
				});
			`);

		// Create an item -- should trigger
		let promise1 = waitForNotify(['item']);
		let item1 = new Zotero.Item('book');
		await item1.saveTx();
		await promise1;
		let countBefore = plugin.eval("_postUnregCount");
		assert.isAbove(countBefore, 0);

		plugin.eval("Zotero.NotifierManager.unregisterObserver(_observerID)");
		plugin.eval("_postUnregCount = 0");

		// Create another item -- should NOT trigger
		// Use sentinel to ensure notifications have been fully dispatched
		let promise2 = waitForNotify(['item']);
		let item2 = new Zotero.Item('book');
		await item2.saveTx();
		await promise2;

		assert.equal(plugin.eval("_postUnregCount"), 0, "Should not receive notifications after unregistering");

		await item1.eraseTx();
		await item2.eraseTx();
	});

	it("should receive extraData in notifications", async function () {
		plugin.eval(`
				var _deleteExtra = null;
				var _observerID = Zotero.NotifierManager.registerObserver({
						onNotify: function({ event, type, ids, extraData }) {
							if (event === 'delete') {
								_deleteExtra = extraData;
							}
						},
						types: ['item'],
						observerID: "test-sandbox-extra",
				});
			`);

		let item = new Zotero.Item('book');
		item.setField('title', 'ExtraData Test');
		await item.saveTx();
		let itemID = item.id;

		let promise = waitForNotify(['item']);
		await item.eraseTx();
		await promise;

		let hasExtra = plugin.eval("!!_deleteExtra");
		assert.ok(hasExtra, "extraData should be provided on delete");
		// extraData is keyed by item ID -- read inside sandbox since
		// the wrapped object uses getters not visible through Xrays
		let hasItemID = plugin.eval(`!!_deleteExtra[${itemID}]`);
		assert.ok(hasItemID, "extraData should contain deleted item ID");

		plugin.eval("Zotero.NotifierManager.unregisterObserver(_observerID)");
	});

	it("should identify each tab notification's window with a usable controller ID", async function () {
		plugin.load(["default", "dataRead", "tab"]);
		let notifications = [];
		plugin.expose("record", data => notifications.push(data));
		assert.isString(plugin.run(() => Zotero.NotifierManager.registerObserver({
			observerID: "tab-windows", types: ["tab"], onNotify: data => record(data),
		})));
		let windows = [];
		try {
			for (let i = 0; i < 2; i++) {
				let win = await loadZoteroPane();
				windows.push(win);
				let windowID = win.browsingContext.id;
				let { tabID } = await requestResult(plugin.run(windowID => Zotero.TabController.command("openTab", {
					windowID, type: "library", background: true,
				}), windowID));
				await waitForCallback(() => notifications.some(data => data.event === "add" && data.ids.includes(tabID)), 20, 5);
				let event = notifications.find(data => data.event === "add" && data.ids.includes(tabID));
				let data = event.extraData[tabID];
				assert.equal(data.windowID, windowID);
				assert.notProperty(data, "browsingContextID");
				let result = await requestResult(plugin.run(windowID => Zotero.TabController.query("tabs", { windowID }), data.windowID));
				assert.include(result.tabs.map(tab => tab.tabID), tabID);
			}
		}
		finally {
			for (let win of windows) {
				win.close();
			}
			await Zotero.DB.waitForTransaction();
		}
	});
});
