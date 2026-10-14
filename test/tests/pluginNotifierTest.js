describe("Plugin Zotero.Notifier", function () {
	var plugin = usePluginSandbox();

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

	afterEach(function () {
		// Clean up any leftover observers
		try {
			let id = plugin.eval("typeof _observerID !== 'undefined' && _observerID");
			if (id) {
				Zotero.Notifier.unregisterObserver(id);
			}
		}
		// eslint-disable-next-line no-unused-vars
		catch (e) {}
	});

	it("should receive notifications when an item is added", async function () {
		plugin.eval(`
				var _notifyEvent = null;
				var _notifyType = null;
				var _notifyFirstID = null;
				var _notifyIDsLength = null;
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids, extraData) {
							_notifyEvent = event;
							_notifyType = type;
							_notifyIDsLength = ids.length;
							_notifyFirstID = ids[0];
						}
					},
					['item'],
					'test-sandbox-add'
				);
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

		plugin.eval("Zotero.Notifier.unregisterObserver(_observerID)");
		await item.eraseTx();
	});

	it("should receive notifications when an item is modified", async function () {
		let item = new Zotero.Item('book');
		item.setField('title', 'Before Modify');
		await item.saveTx();

		plugin.eval(`
				var _modifyFirstID = null;
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids) {
							if (event === 'modify') {
								_modifyFirstID = ids[0];
							}
						}
					},
					['item'],
					'test-sandbox-modify'
				);
			`);

		let promise = waitForNotify(['item']);
		item.setField('title', 'After Modify');
		await item.saveTx();
		await promise;

		assert.equal(plugin.eval("_modifyFirstID"), item.id, "Should have received modify event with item ID");

		plugin.eval("Zotero.Notifier.unregisterObserver(_observerID)");
		await item.eraseTx();
	});

	it("should receive notifications when an item is trashed", async function () {
		let item = new Zotero.Item('book');
		item.setField('title', 'Trash Test');
		await item.saveTx();

		plugin.eval(`
				var _trashFirstID = null;
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids) {
							if (event === 'trash') {
								_trashFirstID = ids[0];
							}
						}
					},
					['item'],
					'test-sandbox-trash'
				);
			`);

		let promise = waitForNotify(['item']);
		item.deleted = true;
		await item.saveTx();
		await promise;

		assert.equal(plugin.eval("_trashFirstID"), item.id, "Should have received trash event with item ID");

		plugin.eval("Zotero.Notifier.unregisterObserver(_observerID)");
		await item.eraseTx();
	});

	it("should only receive notifications for subscribed types", async function () {
		plugin.eval(`
				var _collectionNotified = false;
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids) {
							_collectionNotified = true;
						}
					},
					['collection'],
					'test-sandbox-type-filter'
				);
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

		plugin.eval("Zotero.Notifier.unregisterObserver(_observerID)");
		await item.eraseTx();
		await collection.eraseTx();
	});

	it("should not receive notifications after unregistering", async function () {
		plugin.eval(`
				var _postUnregCount = 0;
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids) {
							_postUnregCount++;
						}
					},
					['item'],
					'test-sandbox-unreg'
				);
			`);

		// Create an item -- should trigger
		let promise1 = waitForNotify(['item']);
		let item1 = new Zotero.Item('book');
		await item1.saveTx();
		await promise1;
		let countBefore = plugin.eval("_postUnregCount");
		assert.isAbove(countBefore, 0);

		plugin.eval("Zotero.Notifier.unregisterObserver(_observerID)");
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
				var _observerID = Zotero.Notifier.registerObserver(
					{
						notify: function(event, type, ids, extraData) {
							if (event === 'delete') {
								_deleteExtra = extraData;
							}
						}
					},
					['item'],
					'test-sandbox-extra'
				);
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

		plugin.eval("Zotero.Notifier.unregisterObserver(_observerID)");
	});
});
