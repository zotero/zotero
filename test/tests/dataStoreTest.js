"use strict";

describe("Zotero.DataStore", function () {
	var CS;
	var codes;
	var libraryID;

	before(function () {
		CS = Zotero.DataStore.ChangeSet;
		codes = Zotero.DataStore.errorCodes;
		libraryID = Zotero.Libraries.userLibraryID;
	});

	/**
	 * Unwrap a response, failing with the store's own message so a broken call is readable
	 */
	async function ok(promise) {
		let res = await promise;
		assert.isTrue(res.success, res.error && `${res.error.code}: ${res.error.message}`);
		return res.result;
	}

	async function failing(promise, code) {
		let res = await promise;
		assert.isFalse(res.success, "expected the call to fail");
		assert.equal(res.error.code, code);
		return res.error;
	}

	describe("addressing", function () {
		it("should read an item by ID and by libraryID and key", async function () {
			let item = await createDataObject('item', { title: 'Addressing' });
			let byID = await ok(Zotero.DataStore.query("item", { itemID: item.id }));
			let byKey = await ok(Zotero.DataStore.query("item", { libraryID, key: item.key }));
			assert.equal(byID.id, item.id);
			assert.equal(byKey.id, item.id);
			assert.equal(byKey.key, item.key);
		});

		it("should read a collection and a search by libraryID and key", async function () {
			let collection = await createDataObject('collection');
			let search = await createDataObject('search');
			let c = await ok(Zotero.DataStore.query("collection", { libraryID, key: collection.key }));
			let s = await ok(Zotero.DataStore.query("search", { libraryID, key: search.key }));
			assert.equal(c.id, collection.id);
			assert.equal(s.id, search.id);
		});

		it("should report NotFound for an unknown key and InvalidParams for no address", async function () {
			await failing(Zotero.DataStore.query("item", { libraryID, key: "ZZZZ9999" }), codes.NOT_FOUND);
			await failing(Zotero.DataStore.query("item", { libraryID }), codes.INVALID_PARAMS);
		});

		it("should read a library, and reject a key for a type that has none", async function () {
			let library = await ok(Zotero.DataStore.query("library", { libraryID }));
			assert.equal(library.id, libraryID);
			await failing(Zotero.DataStore.query("library", { libraryID, key: "ZZZZ9999" }), codes.INVALID_PARAMS);
		});
	});

	describe("snapshots", function () {
		// A regular item read from the database never marks its note type loaded, unlike a new one, so a
		// snapshot that waited for every type read as null
		it("should read the data of an item loaded from the database", async function () {
			let item = await createDataObject('item', { title: 'From disk' });
			Zotero.Items.unload(item.id);
			let snapshot = await ok(Zotero.DataStore.query("item", { itemID: item.id }));
			assert.equal(snapshot.data.title, 'From disk');
			assert.equal(snapshot.kind, 'regular');
		});

		it("should read several items in one query, in order, and report a missing one", async function () {
			let a = await createDataObject('item', { title: 'A' });
			let b = await createDataObject('item', { title: 'B' });
			Zotero.Items.unload(b.id);
			let { items } = await ok(Zotero.DataStore.query("items", { itemIDs: [b.id, a.id] }));
			assert.deepEqual(items.map(snapshot => snapshot.data.title), ['B', 'A']);
			await failing(Zotero.DataStore.query("items", { itemIDs: [a.id, -1] }), codes.NOT_FOUND);
		});

		// A rename rewrites the tag rows and reloads the items without saving them, so the revision
		// stays and the cached JSON has to be dropped another way
		it("should read fresh tags after a rename, which saves nothing", async function () {
			let tag = 'rename-' + Zotero.Utilities.randomString();
			let item = await createDataObject('item');
			item.addTag(tag);
			await item.saveTx();
			let before = await ok(Zotero.DataStore.query("item", { itemID: item.id }));
			assert.deepEqual(before.data.tags.map(t => t.tag), [tag]);

			await Zotero.Tags.rename(libraryID, tag, tag + '-renamed');
			let after = await ok(Zotero.DataStore.query("item", { itemID: item.id }));
			assert.deepEqual(after.data.tags.map(t => t.tag), [tag + '-renamed']);
			assert.equal(after.revision, before.revision, "a rename does not move the revision");
		});
	});

	describe("commit addressing", function () {
		it("should address an entry by ID", async function () {
			let item = await createDataObject('item', { title: 'By ID' });
			await ok(Zotero.DataStore.commit(CS.item(item.id).setField("title", "By ID, edited")));
			assert.equal(Zotero.Items.get(item.id).getField('title'), "By ID, edited");
		});

		it("should address an entry by a bare key with the set's libraryID", async function () {
			let item = await createDataObject('item', { title: 'By key' });
			await ok(Zotero.DataStore.commit(
				CS.of(CS.item(item.key).setField("title", "By key, edited")).inLibrary(libraryID)
			));
			assert.equal(Zotero.Items.get(item.id).getField('title'), "By key, edited");
		});

		it("should refuse a bare key with no library anywhere", async function () {
			let item = await createDataObject('item');
			let changes = CS.of(CS.item(item.key, { libraryID }).setField("title", "x")).toJSON();
			delete changes.libraryID;
			delete changes.changes[0].libraryID;
			await failing(Zotero.DataStore.commit(changes), codes.INVALID_PARAMS);
		});

		it("should report NotFound for a key that names nothing", async function () {
			await failing(
				Zotero.DataStore.commit(CS.item("ZZZZ9999", { libraryID }).setField("title", "x")),
				codes.NOT_FOUND);
		});

		it("should resolve an operation's reference by ID, by key and by ref", async function () {
			let collection = await createDataObject('collection');
			let byID = await createDataObject('item');
			let byKey = await createDataObject('item');
			let created = CS.item({ libraryID, itemType: "book" }).setField("title", "Created");
			await ok(Zotero.DataStore.commit(
				CS.of(created, CS.collection(collection.id).addItems([byID.id, byKey.key, created]))
					.inLibrary(libraryID)
			));
			let ids = Zotero.Collections.get(collection.id).getChildItems(true);
			assert.include(ids, byID.id);
			assert.include(ids, byKey.id);
			assert.lengthOf(ids, 3);
		});

		it("should refuse a ref no earlier entry created", async function () {
			let collection = await createDataObject('collection');
			await failing(
				Zotero.DataStore.commit(CS.collection(collection.id).addItems([{ ref: "nope" }])),
				codes.INVALID_PARAMS);
		});

		it("should refuse to expect a revision on an object the set creates", async function () {
			assert.throws(() => CS.item({ libraryID, itemType: "book" }).expect(1), /no revision/);
			await failing(Zotero.DataStore.commit({
				type: "item", ref: "a", create: { libraryID, itemType: "book" }, revision: 1, ops: [],
			}), codes.INVALID_PARAMS);
		});

		it("should refuse two editors that create one ref", function () {
			let a = CS.item({ libraryID, itemType: "book" }, { ref: "x" });
			let b = CS.item({ libraryID, itemType: "note" }, { ref: "x" });
			assert.throws(() => CS.of(a, b), /created twice/);
			assert.throws(() => CS.from({ changes: [a.toPlain(), b.toPlain()] }), /created twice/);
		});
	});

	describe("commit semantics", function () {
		it("should create an object and return its ID", async function () {
			let result = await ok(Zotero.DataStore.commit(
				CS.item({ libraryID, itemType: "book" }).setField("title", "Made")));
			assert.lengthOf(result.objects, 1);
			let made = Zotero.Items.get(result.objects[0].id);
			assert.equal(made.getField('title'), "Made");
		});

		it("should fail with Conflict when the revision moved on", async function () {
			let item = await createDataObject('item', { title: 'Revision' });
			let snapshot = await ok(Zotero.DataStore.query("item", { itemID: item.id }));
			item.setField('title', 'Moved on');
			await item.saveTx();
			let error = await failing(
				Zotero.DataStore.commit(CS.item(snapshot).setField("title", "Too late")),
				codes.CONFLICT);
			assert.lengthOf(error.data.conflicts, 1);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Moved on');
		});

		it("should apply nothing when a later entry fails", async function () {
			let item = await createDataObject('item', { title: 'Atomic' });
			await failing(Zotero.DataStore.commit(CS.of(
				CS.item(item.id).setField("title", "Should roll back"),
				CS.item(-1).setField("title", "No such item")
			)), codes.NOT_FOUND);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Atomic');
		});

		// A stale snapshot is what the caller has to fix first, so it outranks a bad operation later on
		it("should report a stale revision before a later entry's bad operation", async function () {
			let stale = await createDataObject('item', { title: 'Stale' });
			let other = await createDataObject('item');
			let snapshot = await ok(Zotero.DataStore.query("item", { itemID: stale.id }));
			stale.setField('title', 'Moved on');
			await stale.saveTx();
			await failing(Zotero.DataStore.commit(CS.of(
				CS.item(snapshot).setField("title", "Too late"),
				CS.item(other.id).setField("nosuchfield", "x")
			)), codes.CONFLICT);
		});

		it("should create a collection under a created parent and return snapshots", async function () {
			let parent = CS.collection({ libraryID, name: "Parent" });
			let child = CS.collection({ libraryID, name: "Child", parent });
			let result = await ok(Zotero.DataStore.commit(CS.of(parent, child), { snapshots: true }));
			let [p, c] = result.objects;
			assert.equal(c.snapshot.parentID, p.id);
			assert.equal(c.snapshot.data.parentCollection, p.key);
			assert.equal(c.snapshot.data.name, "Child");
		});

		// Removing a condition renumbers the ones after it, which a replace-all has to survive
		it("should replace the conditions of a search that has several", async function () {
			let made = await ok(Zotero.DataStore.commit(CS.search({
				libraryID,
				name: "Conditions",
				conditions: [
					{ condition: "title", operator: "contains", value: "a" },
					{ condition: "title", operator: "contains", value: "b" },
					{ condition: "title", operator: "contains", value: "c" },
				],
			})));
			let result = await ok(Zotero.DataStore.commit(
				CS.search(made.objects[0].id).setConditions([{ condition: "title", operator: "is", value: "only" }]),
				{ snapshots: true }));
			let conditions = result.objects[0].snapshot.data.conditions;
			assert.lengthOf(conditions, 1);
			assert.equal(conditions[0].value, "only");
		});

		it("should refuse an operation after a terminal one", async function () {
			let item = await createDataObject('item');
			let changes = CS.of(CS.item(item.id).erase()).toJSON();
			changes.changes[0].ops.push({ op: "setField", field: "title", value: "after erase" });
			await failing(Zotero.DataStore.commit(changes), codes.INVALID_PARAMS);
		});

		// Entries a type runs outside the store transaction can survive a later failure, so the error says
		// which ones did. A store with no transaction at all (a file store) is all of these
		it("should report what a partly applied commit left behind", async function () {
			let tag = 'partial-' + Zotero.Utilities.randomString();
			let item = await createDataObject('item', { title: 'Partial' });
			item.addTag(tag);
			await item.saveTx();
			// The rename passes its check (the tag exists) and then fails while applying
			let rename = sinon.stub(Zotero.Tags, 'rename').rejects(new Error("rename failed"));
			try {
				let error = await failing(Zotero.DataStore.commit(CS.of(
					// Transactional, commits before the deferred entries run
					CS.item(item.id).setField("title", "Applied"),
					// Deferred: the tag helpers open their own transactions
					CS.library(libraryID).renameTag(tag, tag + '-renamed')
				)), codes.INTERNAL_ERROR);

				assert.equal(Zotero.Items.get(item.id).getField('title'), "Applied",
					"the transactional entry stays applied");
				assert.lengthOf(error.data.applied, 1);
				assert.equal(error.data.applied[0].type, "item");
				assert.equal(error.data.applied[0].id, item.id);
				assert.equal(error.data.failed.type, "library");
				assert.lengthOf(error.data.pending, 0);
			}
			finally {
				rename.restore();
			}
		});

		it("should report the core rejecting data in memory as InvalidParams naming the operation", async function () {
			let item = await createDataObject('item', { title: 'Kept' });
			// The params only ask for an array, so the creator type reaches the core, which refuses it
			let error = await failing(Zotero.DataStore.commit(CS.of(
				CS.item(item.id).setField("title", "Applied first")
					.setCreators([{ firstName: "A", lastName: "B", creatorType: "nonsense" }])
			)), codes.INVALID_PARAMS);
			assert.match(error.message, /^changes\[0\]\.ops\[1\] \(item\.setCreators\): .*creator type 'nonsense'/);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Kept');
		});

		it("should report a bug in an operation as InternalError", async function () {
			let { DataItemFields } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/pluginAPI/dataItemFields.mjs");
			let item = await createDataObject('item', { title: 'Kept' });
			let apply = sinon.stub(DataItemFields, 'apply').throws(new TypeError("x is undefined"));
			try {
				let error = await failing(Zotero.DataStore.commit(CS.of(
					CS.item(item.id).setField("title", "Crashed")
				)), codes.INTERNAL_ERROR);
				assert.include(error.message, "x is undefined");
			}
			finally {
				apply.restore();
			}
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Kept');
		});

		it("should report a failure while saving as InternalError and leave the object as it was", async function () {
			let item = await createDataObject('item', { title: 'Kept' });
			let save = sinon.stub(Zotero.Item.prototype, 'save').rejects(new Error("database is locked"));
			try {
				let error = await failing(Zotero.DataStore.commit(CS.of(
					CS.item(item.id).setField("title", "Lost")
				)), codes.INTERNAL_ERROR);
				assert.include(error.message, "database is locked");
			}
			finally {
				save.restore();
			}
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Kept');
		});

		it("should refuse to rename an unknown tag before applying anything", async function () {
			let item = await createDataObject('item', { title: 'Untouched' });
			let error = await failing(Zotero.DataStore.commit(CS.of(
				CS.item(item.id).setField("title", "Applied?"),
				CS.library(libraryID).renameTag('no-such-tag-' + Zotero.Utilities.randomString(), "whatever")
			)), codes.INVALID_PARAMS);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Untouched');
			assert.isUndefined(error.data && error.data.applied);
		});

		it("should not claim progress when a commit rolled everything back", async function () {
			let item = await createDataObject('item', { title: 'Nothing' });
			let error = await failing(Zotero.DataStore.commit(CS.of(
				CS.item(item.id).setField("title", "Rolled back"),
				CS.item(-1).setField("title", "No such item")
			)), codes.NOT_FOUND);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Nothing');
			assert.isUndefined(error.data && error.data.applied,
				"an absent `applied` means the set had no effect");
		});

		it("should return fresh revisions and optional snapshots", async function () {
			let item = await createDataObject('item', { title: 'Described' });
			let before = await ok(Zotero.DataStore.query("item", { itemID: item.id }));
			let result = await ok(Zotero.DataStore.commit(
				CS.item(before).setField("title", "Described again"), { snapshots: true }));
			let described = result.objects[0];
			assert.equal(described.id, item.id);
			assert.notEqual(described.revision, before.revision);
			assert.equal(described.snapshot.data.title, "Described again");
		});
	});

	describe("validate", function () {
		it("should report a bad operation without touching the object", async function () {
			let item = await createDataObject('item', { title: 'Validated' });
			let result = await ok(Zotero.DataStore.query("validate", {
				changes: CS.item(item.id).setField("nosuchfield", "x").toJSON(),
			}));
			assert.lengthOf(result.issues, 1);
			assert.equal(result.issues[0].code, codes.INVALID_PARAMS);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Validated');
		});

		it("should report no issues for a set that would commit", async function () {
			let item = await createDataObject('item');
			let result = await ok(Zotero.DataStore.query("validate", {
				changes: CS.item(item.id).setField("title", "Fine").toJSON(),
			}));
			assert.lengthOf(result.issues, 0);
		});
	});

	describe("finders", function () {
		it("should find items, collections and searches in a library", async function () {
			let collection = await createDataObject('collection');
			let search = await createDataObject('search');
			let item = await createDataObject('item');
			let items = await ok(Zotero.DataStore.query("findItems", { libraryID }));
			let collections = await ok(Zotero.DataStore.query("findCollections", { libraryID }));
			let searches = await ok(Zotero.DataStore.query("findSearches", { libraryID }));
			assert.include(items.itemIDs, item.id);
			assert.include(collections.collectionIDs, collection.id);
			assert.include(searches.searchIDs, search.id);
		});
	});
});
