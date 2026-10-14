"use strict";

describe("Zotero.DataStore", function () {
	var plugin = usePluginSandbox();
	var codes;
	var libraryID;

	before(function () {
		codes = Zotero.DataStore.errorCodes;
		libraryID = Zotero.Libraries.userLibraryID;
	});

	beforeEach(function () {
		plugin.load(["default", "dataRead", "dataWrite"]);
		// The plugin's shorthands: its own builder and the library it works in
		plugin.eval(`var CS = Zotero.DataStore.ChangeSet, libraryID = ${libraryID};`);
	});

	function query(name, params) {
		return plugin.run((name, params) => Zotero.DataStore.query(name, params), name, params);
	}

	// Commit the change set `build` makes in the plugin, called there with these args
	function commit(build, ...args) {
		return plugin.run(`(...args) => Zotero.DataStore.commit((${build})(...args))`, ...args);
	}

	describe("builder", function () {
		// The builder runs apart from the store's config, in each sandbox, so only this keeps them in step
		it("should cover every object type and operation the store defines", function () {
			let built = plugin.run(() => {
				let built = {};
				for (let [type, operations] of Object.entries(Zotero.DataStore.operationNames)) {
					let editor = CS[type](1);
					built[type] = {
						missing: operations.filter(op => typeof editor[op] !== "function"),
						terminal: [...editor.constructor.TERMINAL_OPS],
					};
				}
				return built;
			});
			let types = Zotero.DataStore._dataStore._objectTypes;
			for (let [type, operations] of Object.entries(Zotero.DataStore.operationNames)) {
				assert.isEmpty(built[type].missing, `${type} operations`);
				let terminal = operations.filter(op => types.get(type).operations[op].terminal);
				assert.sameMembers(built[type].terminal, terminal, `${type} terminal operations`);
			}
		});

		it("should refuse two editors that create one ref", function () {
			let created = plugin.run(() => {
				let a = CS.item({ libraryID, itemType: "book" }, { ref: "x" });
				let b = CS.item({ libraryID, itemType: "note" }, { ref: "x" });
				return [() => CS.of(a, b), () => CS.from({ changes: [a.toPlain(), b.toPlain()] })].map((build) => {
					try {
						build();
						return "built";
					}
					catch (e) {
						return e.message;
					}
				});
			});
			for (let message of created) {
				assert.match(message, /created twice/);
			}
		});

		it("should refuse to expect a revision on an object it creates", function () {
			assert.throws(() => plugin.run(() => CS.item({ libraryID, itemType: "book" }).expect(1)), /no revision/);
		});
	});

	describe("addressing", function () {
		it("should read an item by ID and by libraryID and key", async function () {
			let item = await createDataObject('item', { title: 'Addressing' });
			let byID = await requestResult(query("item", { itemID: item.id }));
			let byKey = await requestResult(query("item", { libraryID, key: item.key }));
			assert.equal(byID.id, item.id);
			assert.equal(byKey.id, item.id);
			assert.equal(byKey.key, item.key);
		});

		it("should read a collection and a search by libraryID and key", async function () {
			let collection = await createDataObject('collection');
			let search = await createDataObject('search');
			let c = await requestResult(query("collection", { libraryID, key: collection.key }));
			let s = await requestResult(query("search", { libraryID, key: search.key }));
			assert.equal(c.id, collection.id);
			assert.equal(s.id, search.id);
		});

		it("should report NotFound for an unknown key and InvalidParams for no address", async function () {
			await requestError(query("item", { libraryID, key: "ZZZZ9999" }), codes.NOT_FOUND);
			await requestError(query("item", { libraryID }), codes.INVALID_PARAMS);
		});

		it("should read a library, and reject a key for a type that has none", async function () {
			let library = await requestResult(query("library", { libraryID }));
			assert.equal(library.id, libraryID);
			await requestError(query("library", { libraryID, key: "ZZZZ9999" }), codes.INVALID_PARAMS);
		});

		// The base's own query: any type, addressed as a change set entry addresses it
		it("should read any type through the snapshot query by its entry address", async function () {
			let item = await createDataObject('item', { title: 'Snapshot query' });
			let collection = await createDataObject('collection');
			let byID = await requestResult(query("snapshot", { type: "item", id: item.id }));
			let byKey = await requestResult(query("snapshot", { type: "collection", key: collection.key, libraryID }));
			let library = await requestResult(query("snapshot", { type: "library", id: libraryID }));
			assert.equal(byID.data.title, 'Snapshot query');
			assert.equal(byKey.id, collection.id);
			assert.equal(library.id, libraryID);
			await requestError(query("snapshot", { type: "nothing", id: 1 }), codes.INVALID_PARAMS);
			await requestError(query("snapshot", { type: "item", path: "/x" }), codes.INVALID_PARAMS);
			await requestError(query("snapshot", { type: "item", key: item.key }), codes.INVALID_PARAMS);
			await requestError(query("snapshot", { type: "item", id: -1 }), codes.NOT_FOUND);
		});
	});

	describe("snapshots", function () {
		// A regular item read from the database never marks its note type loaded, unlike a new one, so a
		// snapshot that waited for every type read as null
		it("should read the data of an item loaded from the database", async function () {
			let item = await createDataObject('item', { title: 'From disk' });
			Zotero.Items.unload(item.id);
			let snapshot = await requestResult(query("item", { itemID: item.id }));
			assert.equal(snapshot.data.title, 'From disk');
			assert.equal(snapshot.kind, 'regular');
		});

		it("should read several items in one query, in order, and report a missing one", async function () {
			let a = await createDataObject('item', { title: 'A' });
			let b = await createDataObject('item', { title: 'B' });
			Zotero.Items.unload(b.id);
			let { items } = await requestResult(query("items", { itemIDs: [b.id, a.id] }));
			assert.deepEqual(items.map(snapshot => snapshot.data.title), ['B', 'A']);
			await requestError(query("items", { itemIDs: [a.id, -1] }), codes.NOT_FOUND);
		});

		// A rename rewrites the tag rows and reloads the items without saving them, so the revision
		// stays and the cached JSON has to be dropped another way
		it("should read fresh tags after a rename, which saves nothing", async function () {
			let tag = 'rename-' + Zotero.Utilities.randomString();
			let item = await createDataObject('item');
			item.addTag(tag);
			await item.saveTx();
			let before = await requestResult(query("item", { itemID: item.id }));
			assert.deepEqual(before.data.tags.map(t => t.tag), [tag]);

			await Zotero.Tags.rename(libraryID, tag, tag + '-renamed');
			let after = await requestResult(query("item", { itemID: item.id }));
			assert.deepEqual(after.data.tags.map(t => t.tag), [tag + '-renamed']);
			assert.equal(after.revision, before.revision, "a rename does not move the revision");
		});
	});

	describe("commit addressing", function () {
		it("should address an entry by ID", async function () {
			let item = await createDataObject('item', { title: 'By ID' });
			await requestResult(commit(itemID => CS.item(itemID).setField("title", "By ID, edited"), item.id));
			assert.equal(Zotero.Items.get(item.id).getField('title'), "By ID, edited");
		});

		it("should address an entry by a bare key with the set's libraryID", async function () {
			let item = await createDataObject('item', { title: 'By key' });
			await requestResult(commit(key => CS.of(CS.item(key).setField("title", "By key, edited")).inLibrary(libraryID), item.key));
			assert.equal(Zotero.Items.get(item.id).getField('title'), "By key, edited");
		});

		it("should refuse a bare key with no library anywhere", async function () {
			let item = await createDataObject('item');
			await requestError(plugin.run((key) => {
				let changes = CS.of(CS.item(key, { libraryID }).setField("title", "x")).toJSON();
				delete changes.libraryID;
				delete changes.changes[0].libraryID;
				return Zotero.DataStore.commit(changes);
			}, item.key), codes.INVALID_PARAMS);
		});

		it("should report NotFound for a key that names nothing", async function () {
			await requestError(commit(() => CS.item("ZZZZ9999", { libraryID }).setField("title", "x")), codes.NOT_FOUND);
		});

		it("should resolve an operation's reference by ID, by key and by ref", async function () {
			let collection = await createDataObject('collection');
			let byID = await createDataObject('item');
			let byKey = await createDataObject('item');
			await requestResult(commit((collectionID, itemID, itemKey) => {
				let created = CS.item({ libraryID, itemType: "book" }).setField("title", "Created");
				return CS.of(created, CS.collection(collectionID).addItems([itemID, itemKey, created])).inLibrary(libraryID);
			}, collection.id, byID.id, byKey.key));
			let ids = Zotero.Collections.get(collection.id).getChildItems(true);
			assert.include(ids, byID.id);
			assert.include(ids, byKey.id);
			assert.lengthOf(ids, 3);
		});

		it("should create an object before an edit that names it, wherever the set lists it", async function () {
			let item = await createDataObject('item');
			let { objects } = await requestResult(commit((itemID) => {
				let collection = CS.collection({ libraryID, name: "Created after" });
				return CS.of(CS.item(itemID).setField("title", "Filed").addToCollection(collection), collection);
			}, item.id));
			assert.deepEqual(objects.map(object => object.type), ["item", "collection"]);
			assert.include(Zotero.Collections.get(objects[1].id).getChildItems(true), item.id);
		});

		// Merging the third editor into the first would leave the item out of the collection
		it("should keep an object edited again after another in its place", async function () {
			let collection = await createDataObject('collection');
			let item = await createDataObject('item');
			let { size, response } = await plugin.run(async (collectionID, itemID) => {
				let set = CS.of(
					CS.item(itemID).addToCollection(collectionID),
					CS.collection(collectionID).removeItems([itemID]),
					CS.item(itemID).addToCollection(collectionID)
				);
				return { size: set.size, response: await Zotero.DataStore.commit(set) };
			}, collection.id, item.id);
			assert.equal(size, 3);
			assert.lengthOf((await requestResult(response)).objects, 3);
			assert.include(Zotero.Collections.get(collection.id).getChildItems(true), item.id);
		});

		it("should refuse an entry on an object an earlier entry erases", async function () {
			let item = await createDataObject('item', { title: 'Erased first' });
			let other = await createDataObject('item');
			let error = await requestError(commit((itemID, otherID) => CS.of(
				CS.item(itemID).erase(),
				CS.item(otherID).setField("title", "x"),
				CS.item(itemID).setField("title", "Too late")
			), item.id, other.id), codes.INVALID_PARAMS);
			assert.include(error.message, `changes[2]: item ${item.id} no longer exists after changes[0] (erase)`);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Erased first');
		});

		it("should create a parent before a child the set lists ahead of it", async function () {
			let { objects } = await requestResult(commit(() => {
				let parent = CS.item({ libraryID, itemType: "book" }).setField("title", "Parent");
				let child = CS.item({ libraryID, itemType: "note", parent }).setNote("<p>Child</p>");
				return CS.of(child, parent);
			}));
			assert.equal(Zotero.Items.get(objects[0].id).parentID, objects[1].id);
		});

		it("should refuse created objects that each need the other created first", async function () {
			let [committed, validated] = await plugin.run(async () => {
				let item = CS.item({ libraryID, itemType: "book" }, { ref: "i" });
				let collection = CS.collection({ libraryID, name: "Cycle" }, { ref: "c" }).addItems([item]);
				let set = CS.of(item.addToCollection(collection), collection);
				return [await Zotero.DataStore.commit(set), await Zotero.DataStore.query("validate", { changes: set })];
			});
			let error = await requestError(committed, codes.INVALID_PARAMS);
			assert.include(error.message, "changes[0] (ref 'i'), changes[1] (ref 'c')");
			let { issues } = await requestResult(validated);
			assert.equal(issues[0].code, codes.INVALID_PARAMS);
		});

		// Refs are linked before anything loads, so validate names the param as a commit does
		it("should refuse a ref nothing creates, of another type or to its own object", async function () {
			let collection = await createDataObject('collection');
			let existing = await createDataObject('item');
			let responses = await plugin.run(async (collectionID, existingID) => {
				let created = CS.item({ libraryID, itemType: "book" });
				let self = CS.collection({ libraryID, name: "Self" });
				let responses = [];
				for (let set of [
					CS.collection(collectionID).addItems([existingID, { ref: "nope" }]),
					CS.of(created, CS.item(existingID).addToCollection(created)),
					self.setParent(self),
				]) {
					responses.push([await Zotero.DataStore.commit(set), await Zotero.DataStore.query("validate", { changes: set })]);
				}
				return responses;
			}, collection.id, existing.id);
			let at = ["changes[0].ops[0].items[1]", "changes[1].ops[0].collection", "changes[0].ops[0].parent"];
			for (let [i, [committed, validated]] of responses.entries()) {
				let error = await requestError(committed, codes.INVALID_PARAMS);
				assert.include(error.message, at[i]);
				let { issues } = await requestResult(validated);
				assert.include(issues[0].message, at[i]);
			}
			assert.notInclude(Zotero.Collections.get(collection.id).getChildItems(true), existing.id);
		});

		it("should refuse a plain entry expecting a revision on an object it creates", async function () {
			await requestError(plugin.run(() => Zotero.DataStore.commit({
				type: "item", ref: "a", create: { libraryID, itemType: "book" }, revision: 1, ops: [],
			})), codes.INVALID_PARAMS);
		});

		it("should place a created object in its parent's library when libraryID is omitted", async function () {
			let parent = await createDataObject('item');
			let folder = await createDataObject('collection');
			let { objects } = await requestResult(commit((parentID, folderID) => {
				let article = CS.item({ libraryID, itemType: "journalArticle" });
				return CS.of(
					CS.item({ itemType: "note", parent: parentID }).setNote("<p>Placed</p>"),
					CS.collection({ name: "Placed", parent: folderID }),
					article,
					CS.item({ itemType: "attachment", linkMode: "linked_url", parent: article }).setField("url", "https://example.org/")
				);
			}, parent.id, folder.id));
			for (let object of objects) {
				assert.equal(object.libraryID, libraryID);
			}
			assert.equal(Zotero.Items.get(objects[0].id).parentID, parent.id);
			assert.equal(Zotero.Collections.get(objects[1].id).parentID, folder.id);
			assert.equal(Zotero.Items.get(objects[3].id).parentID, objects[2].id);
		});

		it("should place a created object in the set's library, and refuse one with no library anywhere", async function () {
			let { objects } = await requestResult(commit(() => CS.of(CS.item({ itemType: "book" }).setField("title", "In set")).inLibrary(libraryID)));
			assert.equal(Zotero.Items.get(objects[0].id).libraryID, libraryID);
			let error = await requestError(commit(() => CS.item({ itemType: "book" })), codes.INVALID_PARAMS);
			assert.include(error.message, "needs a libraryID, a parent or the change set's libraryID");
			await requestError(commit(() => CS.item({ itemType: "note", parent: -1 })), codes.NOT_FOUND);
		});
	});

	describe("commit semantics", function () {
		// The schema hides commit from a plugin without dataWrite, so no sandbox reaches this: the store's own gate
		// is what stops a call made on such a plugin's behalf
		it("should refuse a commit on behalf of a plugin without dataWrite", async function () {
			plugin.load(["default", "dataRead"]);
			let item = await createDataObject('item', { title: 'Read only' });
			let error = await requestError(Zotero.DataStore.commit(
				Zotero.DataStore.ChangeSet.item(item.id).setField("title", "Written"), {}, plugin.id), codes.PERMISSION_DENIED);
			assert.equal(item.getField('title'), 'Read only');
		});

		it("should create an object and return its ID", async function () {
			let result = await requestResult(commit(() => CS.item({ libraryID, itemType: "book" }).setField("title", "Made")));
			assert.lengthOf(result.objects, 1);
			let made = Zotero.Items.get(result.objects[0].id);
			assert.equal(made.getField('title'), "Made");
		});

		it("should fail with Conflict when the revision moved on", async function () {
			let item = await createDataObject('item', { title: 'Revision' });
			let snapshot = await requestResult(query("item", { itemID: item.id }));
			item.setField('title', 'Moved on');
			await item.saveTx();
			let error = await requestError(commit(snapshot => CS.item(snapshot).setField("title", "Too late"), snapshot),
				codes.CONFLICT);
			assert.lengthOf(error.data.conflicts, 1);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Moved on');
		});

		it("should apply nothing when a later entry fails", async function () {
			let item = await createDataObject('item', { title: 'Atomic' });
			let error = await requestError(commit(itemID => CS.of(
				CS.item(itemID).setField("title", "Should roll back"),
				CS.item(-1).setField("title", "No such item")
			), item.id), codes.NOT_FOUND);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Atomic');
			assert.isUndefined(error.data && error.data.applied, "an absent `applied` means the set had no effect");
		});

		it("should refuse editing and creating in a read-only library, naming the entry", async function () {
			let group = await createGroup({ editable: true });
			let item = await createDataObject('item', { libraryID: group.libraryID });
			group.editable = false;
			await group.saveTx();
			let edit = await requestError(commit(itemID => CS.item(itemID).setField("title", "x"), item.id), codes.NOT_ALLOWED);
			assert.include(edit.message, `changes[0]: item ${item.id} is not editable`);
			let create = await requestError(commit(groupLibraryID => CS.item({ libraryID: groupLibraryID, itemType: "book" }),
				group.libraryID), codes.NOT_ALLOWED);
			assert.include(create.message, `changes[0].create (item): Library ${group.libraryID} is not editable`);
		});

		// A stale snapshot is what the caller has to fix first, so it outranks a bad operation later on
		it("should report a stale revision before a later entry's bad operation", async function () {
			let stale = await createDataObject('item', { title: 'Stale' });
			let other = await createDataObject('item');
			let snapshot = await requestResult(query("item", { itemID: stale.id }));
			stale.setField('title', 'Moved on');
			await stale.saveTx();
			await requestError(commit((snapshot, otherID) => CS.of(
				CS.item(snapshot).setField("title", "Too late"),
				CS.item(otherID).setField("nosuchfield", "x")
			), snapshot, other.id), codes.CONFLICT);
		});

		it("should create a collection under a created parent and return snapshots", async function () {
			let result = await requestResult(plugin.run(() => {
				let parent = CS.collection({ libraryID, name: "Parent" });
				let child = CS.collection({ libraryID, name: "Child", parent });
				return Zotero.DataStore.commit(CS.of(parent, child), { snapshots: true });
			}));
			let [p, c] = result.objects;
			assert.equal(c.snapshot.parentID, p.id);
			assert.equal(c.snapshot.data.parentCollection, p.key);
			assert.equal(c.snapshot.data.name, "Child");
		});

		// Removing a condition renumbers the ones after it, which a replace-all has to survive
		it("should replace the conditions of a search that has several", async function () {
			let made = await requestResult(commit(() => CS.search({
				libraryID,
				name: "Conditions",
				conditions: [
					{ condition: "title", operator: "contains", value: "a" },
					{ condition: "title", operator: "contains", value: "b" },
					{ condition: "title", operator: "contains", value: "c" },
				],
			})));
			let result = await requestResult(plugin.run(searchID => Zotero.DataStore.commit(
				CS.search(searchID).setConditions([{ condition: "title", operator: "is", value: "only" }]),
				{ snapshots: true }
			), made.objects[0].id));
			let conditions = result.objects[0].snapshot.data.conditions;
			assert.lengthOf(conditions, 1);
			assert.equal(conditions[0].value, "only");
		});

		// Core's Search.fromJSON resets deleted to what the JSON says
		it("should keep a trashed search in the trash when its conditions change", async function () {
			let search = await createDataObject('search');
			search.deleted = true;
			await search.saveTx();
			await requestResult(commit(
				searchID => CS.search(searchID).setConditions([{ condition: "title", operator: "contains", value: "kept" }]),
				search.id));
			assert.isTrue(Zotero.Searches.get(search.id).deleted);
		});

		it("should refuse an operation after a terminal one", async function () {
			let item = await createDataObject('item');
			await requestError(plugin.run((itemID) => {
				let changes = CS.of(CS.item(itemID).erase()).toJSON();
				changes.changes[0].ops.push({ op: "setField", field: "title", value: "after erase" });
				return Zotero.DataStore.commit(changes);
			}, item.id), codes.INVALID_PARAMS);
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
				let error = await requestError(commit((itemID, tag) => CS.of(
					// Transactional, commits before the deferred entries run
					CS.item(itemID).setField("title", "Applied"),
					// Deferred: the tag helpers open their own transactions
					CS.library(libraryID).renameTag(tag, tag + '-renamed')
				), item.id, tag), codes.INTERNAL_ERROR);

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
			let error = await requestError(commit(itemID => CS.of(
				CS.item(itemID).setField("title", "Applied first")
					.setCreators([{ firstName: "A", lastName: "B", creatorType: "nonsense" }])
			), item.id), codes.INVALID_PARAMS);
			assert.match(error.message, /^changes\[0\]\.ops\[1\] \(item\.setCreators\): .*creator type 'nonsense'/);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Kept');
		});

		// Older core setters refuse by throwing a string, which counts as a refusal too
		it("should report core refusing another kind's data as InvalidParams in core's words", async function () {
			let book = await createDataObject('item', { itemType: 'book' });
			for (let [build, words] of [
				[bookID => CS.item(bookID).setNote("<p>x</p>"), "(item.setNote): updateNote() can only be called on notes and attachments"],
				[bookID => CS.item(bookID).setField("contentType", "text/plain"), "(item.setField): .attachmentContentType can only be set for attachment items"],
				[() => CS.item({ libraryID, itemType: "book", linkMode: "linked_url" }), ".create (item): .attachmentLinkMode can only be set for attachment items"],
				[() => CS.search({ libraryID, name: "" }), ".create (search): Saved search name cannot be empty"],
			]) {
				let error = await requestError(commit(build, book.id), codes.INVALID_PARAMS);
				assert.include(error.message, words);
			}
		});

		it("should report a bug in an operation as InternalError", async function () {
			let { DataItemFields } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/pluginAPI/dataItemFields.mjs");
			let item = await createDataObject('item', { title: 'Kept' });
			let apply = sinon.stub(DataItemFields, 'apply').throws(new TypeError("x is undefined"));
			try {
				let error = await requestError(commit(itemID => CS.item(itemID).setField("title", "Crashed"), item.id),
					codes.INTERNAL_ERROR);
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
				let error = await requestError(commit(itemID => CS.item(itemID).setField("title", "Lost"), item.id),
					codes.INTERNAL_ERROR);
				assert.include(error.message, "database is locked");
			}
			finally {
				save.restore();
			}
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Kept');
		});

		it("should refuse to rename an unknown tag before applying anything", async function () {
			let item = await createDataObject('item', { title: 'Untouched' });
			let error = await requestError(commit((itemID, unknown) => CS.of(
				CS.item(itemID).setField("title", "Applied?"),
				CS.library(libraryID).renameTag(unknown, "whatever")
			), item.id, 'no-such-tag-' + Zotero.Utilities.randomString()), codes.INVALID_PARAMS);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Untouched');
			assert.isUndefined(error.data && error.data.applied);
		});

		// A note far past any 32K chunk boundary survives both directions of the boundary; an item pane showing
		// the note would rewrite it, so it is not selected
		it("should carry a long note intact", async function () {
			let item = await createDataObject('item', { itemType: 'note' }, { skipSelect: true });
			let { length, intact } = await plugin.run(async (itemID) => {
				let note = "<p>" + "段落 paragraph 🚀 ".repeat(15000) + "</p>";
				await Zotero.DataStore.commit(CS.item(itemID).setNote(note));
				let back = await Zotero.DataStore.query("item", { itemID });
				return { length: note.length, intact: back.result.data.note === note };
			}, item.id);
			assert.equal(item.getNote().length, length);
			assert.isTrue(intact);
		});

		it("should return fresh revisions and optional snapshots", async function () {
			let item = await createDataObject('item', { title: 'Described' });
			let before = await requestResult(query("item", { itemID: item.id }));
			let result = await requestResult(plugin.run(before => Zotero.DataStore.commit(
				CS.item(before).setField("title", "Described again"), { snapshots: true }
			), before));
			let described = result.objects[0];
			assert.equal(described.id, item.id);
			assert.notEqual(described.revision, before.revision);
			assert.equal(described.snapshot.data.title, "Described again");
		});
	});

	describe("annotations", function () {
		var attachment;
		var fields = {
			annotationType: "highlight",
			annotationSortIndex: "00000|000000|00000",
			annotationPosition: { pageIndex: 0, rects: [[0, 0, 10, 10]] },
		};

		before(async function () {
			attachment = await importPDFAttachment();
		});

		it("should create an annotation with its row and its parent", async function () {
			let { objects } = await requestResult(commit((parent, fields) => CS.item({ libraryID, itemType: "annotation", parent, ...fields })
				.setField("annotationText", "Quoted")
				.setField("annotationColor", "#ffd400"), attachment.id, fields));
			let annotation = Zotero.Items.get(objects[0].id);
			assert.equal(annotation.parentID, attachment.id);
			assert.equal(annotation.annotationType, "highlight");
			assert.equal(annotation.annotationText, "Quoted");
			assert.deepEqual(JSON.parse(annotation.annotationPosition), fields.annotationPosition);
		});

		// Core checks the parent only with annotation data, so without it the annotation saved with no row
		it("should refuse an annotation without an annotatable parent or the fields its row needs", async function () {
			let book = await createDataObject('item');
			let annotation = create => CS.item({ libraryID, itemType: "annotation", ...create });
			for (let [create, reason] of [
				[{ parent: book.id, ...fields }, "needs a PDF, EPUB or snapshot attachment as parent"],
				[{ ...fields }, "needs a PDF, EPUB or snapshot attachment as parent"],
				[{ parent: attachment.id, annotationType: "highlight" }, "needs annotationSortIndex, annotationPosition"],
				[{ parent: attachment.id, ...fields, annotationType: "bogus" }, "Unknown annotation type 'bogus'"],
				[{ parent: attachment.id, ...fields, annotationSortIndex: "1" }, "Invalid sortIndex '1'"],
			]) {
				let error = await requestError(commit(annotation, create), codes.INVALID_PARAMS);
				assert.include(error.message, `changes[0].create (item): `);
				assert.include(error.message, reason);
			}
			let error = await requestError(commit(() => CS.item({ libraryID, itemType: "book", annotationType: "highlight" })),
				codes.INVALID_PARAMS);
			assert.include(error.message, "'annotationType' applies to annotations only");
		});
	});

	describe("attachment files", function () {
		var { PluginFileAccess } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileAccess.mjs");
		var { FileIO } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/fileIO.mjs");
		var PREF_PREFIX = "extensions.zotero.pluginFileAccess.";

		beforeEach(function () {
			load(["default", "dataRead", "dataWrite", "fileSystemRead", "fileSystemWrite"]);
		});

		afterEach(function () {
			Zotero.Prefs.clear(PREF_PREFIX + plugin.uuid, true);
		});

		function load(permissions) {
			plugin.load(permissions);
			plugin.eval(`var CS = Zotero.DataStore.ChangeSet, FS = Zotero.FileStore?.ChangeSet, libraryID = ${libraryID};`);
		}

		// As a plugin does before it imports
		function writeTemp(text) {
			return plugin.run(async (text) => {
				let { temp } = (await Zotero.FileStore.query("dirs")).result;
				let path = Zotero.FileStore.path.join(temp, `file-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
				let { success, error } = await Zotero.FileStore.commit(FS.file(path).writeFile(text));
				if (!success) {
					throw new Error(error.message);
				}
				return path;
			}, text);
		}

		async function titled(title) {
			let search = new Zotero.Search();
			search.libraryID = libraryID;
			search.addCondition("title", "is", title);
			return search.search();
		}

		it("should import a file the plugin wrote as a stored copy, indexed and readable through the file store", async function () {
			let parent = await createDataObject('item');
			let source = await writeTemp("Imported through the stores");
			let { objects } = await requestResult(commit((file, parent) => CS.item({ itemType: "attachment", linkMode: "imported_file", file, parent }),
				source, parent.id));
			let attachment = Zotero.Items.get(objects[0].id);
			assert.equal(attachment.attachmentLinkMode, Zotero.Attachments.LINK_MODE_IMPORTED_FILE);
			assert.equal(attachment.parentID, parent.id);
			assert.equal(attachment.attachmentContentType, "text/plain");
			let path = await attachment.getFilePathAsync();
			assert.equal(PathUtils.parent(path), Zotero.Attachments.getStorageDirectory(attachment).path);
			assert.isTrue(await FileIO.exists(source), "core copies the file");
			assert.equal((await requestResult(query("fulltext", { itemID: attachment.id }))).state, "indexed");

			let read = await plugin.run(async (itemID) => {
				let { path } = (await Zotero.DataStore.query("file", { itemID })).result;
				return (await Zotero.FileStore.query("readFile", { path, encoding: "utf8" })).result.data;
			}, attachment.id);
			assert.equal(read, "Imported through the stores");
		});

		it("should import a PDF as core does, with its content type and reader", async function () {
			let source = Zotero.FileStore.path.join(await PluginFileAccess.getTempDir(plugin.id), "paper.pdf");
			await FileIO.copy(PluginFileAccess.canonicalize(PathUtils.join(getTestDataDirectory().path, "test.pdf")), source);
			let { objects } = await requestResult(commit(file => CS.item({ libraryID, itemType: "attachment", linkMode: "imported_file", file }),
				source));
			let attachment = Zotero.Items.get(objects[0].id);
			assert.equal(attachment.attachmentContentType, "application/pdf");
			assert.equal(attachment.attachmentReaderType, "pdf");
			assert.equal(attachment.attachmentFilename, "paper.pdf");
		});

		it("should import under a parent the set creates, after the store transaction", async function () {
			let source = await writeTemp("Child");
			let { objects } = await requestResult(commit((file) => {
				let parent = CS.item({ libraryID, itemType: "book" }).setField("title", "Parent");
				let child = CS.item({ itemType: "attachment", linkMode: "imported_file", file, parent }).setField("title", "Child file");
				return CS.of(child, parent);
			}, source));
			let attachment = Zotero.Items.get(objects[0].id);
			assert.equal(attachment.parentID, objects[1].id);
			assert.equal(attachment.getField("title"), "Child file");

			// The other way round no order satisfies
			let error = await requestError(commit((file) => {
				let pdf = CS.item({ libraryID, itemType: "attachment", linkMode: "imported_file", file });
				return CS.of(pdf, CS.collection({ libraryID, name: "Holds it" }).addItems([pdf]));
			}, source), codes.INVALID_PARAMS);
			assert.include(error.message, "is created after the store transaction this entry applies in");
		});

		it("should link a file the plugin may write, in the user library only", async function () {
			let source = await writeTemp("Linked");
			let { objects } = await requestResult(commit(file => CS.item({ libraryID, itemType: "attachment", linkMode: "linked_file", file }),
				source));
			let attachment = Zotero.Items.get(objects[0].id);
			assert.equal(attachment.attachmentLinkMode, Zotero.Attachments.LINK_MODE_LINKED_FILE);
			assert.equal(PluginFileAccess.canonicalize(await attachment.getFilePathAsync()), source);

			let group = await createGroup();
			try {
				let error = await requestError(commit((file, groupLibraryID) => CS.item({
					libraryID: groupLibraryID, itemType: "attachment", linkMode: "linked_file", file,
				}), source, group.libraryID), codes.INVALID_PARAMS);
				assert.include(error.message, "changes[0].create (item): Linked files can only be added to the user library");
			}
			finally {
				await group.eraseTx();
			}
		});

		it("should refuse a file the plugin may not read or write before applying anything", async function () {
			let outside = await getTempDirectory();
			let file = PathUtils.join(outside, "outside.txt");
			await IOUtils.writeUTF8(file, "Outside");
			let title = "Not created " + Zotero.Utilities.randomString();
			let build = (file, title, linkMode) => CS.of(
				CS.item({ libraryID, itemType: "book" }).setField("title", title),
				CS.item({ libraryID, itemType: "attachment", linkMode, file })
			);

			let validate = (...args) => requestResult(plugin.run(
				`(...args) => Zotero.DataStore.query("validate", { changes: (${build})(...args).toJSON() })`, ...args));

			// A persisted deny answers the gate without a prompt
			Zotero.Prefs.set(PREF_PREFIX + plugin.uuid, JSON.stringify([[PluginFileAccess.canonicalize(outside), { mode: "deny" }]]), true);
			let error = await requestError(commit(build, file, title, "imported_file"), codes.PERMISSION_DENIED);
			assert.include(error.message, "changes[1].create (item): ");
			let { issues } = await validate(file, title, "imported_file");
			assert.equal(issues[0].code, codes.PERMISSION_DENIED);

			// Read lets the plugin import the file, while linking it needs write
			Zotero.Prefs.set(PREF_PREFIX + plugin.uuid, JSON.stringify([[PluginFileAccess.canonicalize(file), { mode: "read" }]]), true);
			load(["default", "dataRead", "dataWrite", "fileSystemRead"]);
			assert.isEmpty((await validate(file, title, "imported_file")).issues);
			error = await requestError(commit(build, file, title, "linked_file"), codes.PERMISSION_DENIED);
			assert.include(error.message, "Permission fileSystemWrite is required");
			load(["default", "dataRead", "dataWrite"]);
			error = await requestError(commit(build, file, title, "imported_file"), codes.PERMISSION_DENIED);
			assert.include(error.message, "Permission fileSystemRead is required");
			assert.isEmpty(await titled(title));
		});

		it("should refuse a file with another link mode or item type, a file link mode without one, and a missing file", async function () {
			let source = await writeTemp("Refused");
			let build = create => CS.item({ libraryID, ...create });
			for (let [create, reason] of [
				[{ itemType: "attachment", linkMode: "imported_file" }, "linkMode 'imported_file' needs a file"],
				[{ itemType: "attachment", linkMode: "linked_url", file: source }, "A file makes an attachment with linkMode imported_file or linked_file"],
				[{ itemType: "book", linkMode: "imported_file", file: source }, "A file makes an attachment with linkMode imported_file or linked_file"],
				[{ itemType: "attachment", linkMode: "imported_url" }, "linkMode 'imported_url' cannot be created"],
				[{ itemType: "attachment", linkMode: "imported_file", file: "relative.txt" }, "Param 'file': "],
				[{ itemType: "attachment", linkMode: "imported_file", file: source, annotationType: "highlight" }, "'annotationType' applies to annotations only"],
			]) {
				let error = await requestError(commit(build, create), codes.INVALID_PARAMS);
				assert.include(error.message, "changes[0].create (item): ", reason);
				assert.include(error.message, reason);
			}
			let missing = Zotero.FileStore.path.join(Zotero.FileStore.path.dirname(source), "missing.txt");
			let error = await requestError(commit(file => CS.item({ libraryID, itemType: "attachment", linkMode: "imported_file", file }), missing),
				codes.NOT_FOUND);
			assert.include(error.message, "is not a file");
		});

		it("should refuse a file in a library that keeps its files", async function () {
			let group = await createGroup({ filesEditable: false });
			try {
				let source = await writeTemp("Kept out");
				let error = await requestError(commit((file, groupLibraryID) => CS.item({
					libraryID: groupLibraryID, itemType: "attachment", linkMode: "imported_file", file,
				}), source, group.libraryID), codes.NOT_ALLOWED);
				assert.include(error.message, "does not allow file changes");
			}
			finally {
				await group.eraseTx();
			}
		});

		it("should apply a file attachment's operations after the store transaction", async function () {
			let source = await writeTemp("Trashed");
			let { objects } = await requestResult(commit(file => CS.item({ libraryID, itemType: "attachment", linkMode: "imported_file", file })
				.setField("title", "Straight to the trash")
				.trash(), source));
			let attachment = Zotero.Items.get(objects[0].id);
			assert.equal(attachment.getField("title"), "Straight to the trash");
			assert.isTrue(attachment.deleted);
		});

		it("should relink a stored attachment to a copy of a file the plugin wrote", async function () {
			let attachment = await importFileAttachment("test.txt");
			let source = await writeTemp("Relinked copy");
			await requestResult(commit((itemID, file) => CS.item(itemID).relinkAttachmentFile(file), attachment.id, source));
			let path = await attachment.getFilePathAsync();
			assert.equal(PathUtils.parent(path), Zotero.Attachments.getStorageDirectory(attachment).path);
			assert.equal(PathUtils.filename(path), Zotero.FileStore.path.basename(source));
			assert.equal(await IOUtils.readUTF8(path), "Relinked copy");
			assert.isTrue(await FileIO.exists(source), "core copies a stored attachment's file");
		});

		it("should point a linked attachment at another file the plugin may write", async function () {
			let first = await writeTemp("First");
			let second = await writeTemp("Second");
			let { objects } = await requestResult(commit(file => CS.item({ libraryID, itemType: "attachment", linkMode: "linked_file", file }),
				first));
			await requestResult(commit((itemID, file) => CS.item(itemID).relinkAttachmentFile(file), objects[0].id, second));
			let attachment = Zotero.Items.get(objects[0].id);
			assert.equal(PluginFileAccess.canonicalize(await attachment.getFilePathAsync()), second);
		});

		it("should refuse a relink the target or the plugin's access does not allow, before applying anything", async function () {
			let stored = await importFileAttachment("test.txt");
			let book = await createDataObject('item', { title: 'Kept' });
			let outside = await getTempDirectory();
			let file = PathUtils.join(outside, "outside.txt");
			await IOUtils.writeUTF8(file, "Outside");
			let relink = (itemID, file) => commit((bookID, itemID, file) => CS.of(
				CS.item(bookID).setField("title", "Applied"),
				CS.item(itemID).relinkAttachmentFile(file)
			), book.id, itemID, file);

			// The target's link mode decides what the gate asks, before the transaction
			Zotero.Prefs.set(PREF_PREFIX + plugin.uuid, JSON.stringify([[PluginFileAccess.canonicalize(outside), { mode: "deny" }]]), true);
			let error = await requestError(relink(stored.id, file), codes.PERMISSION_DENIED);
			assert.include(error.message, "changes[1].ops[0] (item.relinkAttachmentFile): ");
			let { issues } = await requestResult(plugin.run((itemID, file) => Zotero.DataStore.query("validate", {
				changes: CS.item(itemID).relinkAttachmentFile(file).toJSON(),
			}), stored.id, file));
			assert.equal(issues[0].code, codes.PERMISSION_DENIED);

			let linked = await requestResult(commit(file => CS.item({ libraryID, itemType: "attachment", linkMode: "linked_file", file }),
				await writeTemp("Linked")));
			load(["default", "dataRead", "dataWrite", "fileSystemRead"]);
			error = await requestError(relink(linked.objects[0].id, await PluginFileAccess.getTempDir(plugin.id) + "/x.txt"),
				codes.PERMISSION_DENIED);
			assert.include(error.message, "Permission fileSystemWrite is required");

			let note = await createDataObject('item', { itemType: 'note' });
			error = await requestError(relink(note.id, file), codes.INVALID_PARAMS);
			assert.include(error.message, "Only a file attachment has a file to relink");
			error = await requestError(commit(file => CS.item({ libraryID, itemType: "note" }).relinkAttachmentFile(file), file),
				codes.INVALID_PARAMS);
			assert.include(error.message, "Only an existing attachment can be relinked");

			let group = await createGroup();
			let inGroup = await importFileAttachment("test.txt", { libraryID: group.libraryID });
			group.filesEditable = false;
			await group.saveTx();
			try {
				await requestError(relink(inGroup.id, file), codes.NOT_ALLOWED);
			}
			finally {
				await group.eraseTx();
			}
			assert.equal(book.getField('title'), 'Kept');
		});

		it("should drop what a failed relink's entry changed only in memory", async function () {
			let attachment = await importFileAttachment("test.txt");
			let missing = Zotero.FileStore.path.join(await PluginFileAccess.getTempDir(plugin.id), "missing.txt");
			let error = await requestError(commit((itemID, file) => CS.item(itemID)
				.setField("title", "Only in memory")
				.relinkAttachmentFile(file), attachment.id, missing), codes.NOT_FOUND);
			assert.include(error.message, "is not a file");
			assert.equal(attachment.getField("title"), "test");
			assert.equal(attachment.attachmentFilename, "test.txt");
		});
	});

	describe("validate", function () {
		it("should report a bad operation without touching the object", async function () {
			let item = await createDataObject('item', { title: 'Validated' });
			let result = await requestResult(plugin.run(itemID => Zotero.DataStore.query("validate", {
				changes: CS.item(itemID).setField("nosuchfield", "x").toJSON(),
			}), item.id));
			assert.lengthOf(result.issues, 1);
			assert.equal(result.issues[0].code, codes.INVALID_PARAMS);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Validated');
		});

		it("should report no issues for a set that would commit", async function () {
			let item = await createDataObject('item');
			let result = await requestResult(plugin.run(itemID => Zotero.DataStore.query("validate", {
				changes: CS.item(itemID).setField("title", "Fine").toJSON(),
			}), item.id));
			assert.lengthOf(result.issues, 0);
		});
	});

	describe("handles", function () {
		// The traditional form: Zotero.DataStore.Handle.item(target) is CS.item(target) held in place
		it("should offer a Handle class with a factory per object type and every operation", function () {
			let built = plugin.run(() => {
				let built = {};
				for (let [type, operations] of Object.entries(Zotero.DataStore.operationNames)) {
					// Destructurable, as the parallel to CS.item
					let { [type]: factory } = Zotero.DataStore.Handle;
					let handle = factory(1);
					built[type] = {
						missing: operations.filter(op => typeof handle[op] !== "function"),
						id: handle.id,
						type: handle.type,
						isHandle: handle instanceof Zotero.DataStore.Handle,
						isEditor: handle.editor instanceof CS[type](1).constructor,
					};
				}
				return built;
			});
			for (let type of Zotero.DataStore.objectTypes) {
				assert.isEmpty(built[type].missing, `${type} operations`);
				assert.equal(built[type].id, 1);
				assert.equal(built[type].type, type);
				assert.isTrue(built[type].isHandle);
				assert.isTrue(built[type].isEditor);
			}
		});

		it("should change an object in place and save it, then apply only what was added since", async function () {
			let item = await createDataObject('item', { title: 'Handled' });
			let saved = await plugin.run(async (itemID) => {
				let handle = Zotero.DataStore.Handle.item(itemID);
				handle.setField("title", "Handled, edited");
				if (itemID) {
					handle.addTag("first");
				}
				let first = await handle.save();
				handle.addTag("second");
				let second = await handle.save();
				return { first, second, pending: handle.ops.length };
			}, item.id);
			assert.equal(saved.first.id, item.id);
			assert.notEqual(saved.second.revision, saved.first.revision);
			assert.equal(saved.pending, 0);
			let live = Zotero.Items.get(item.id);
			assert.equal(live.getField('title'), 'Handled, edited');
			assert.sameMembers(live.getTags().map(t => t.tag), ['first', 'second']);
		});

		it("should turn a created object's handle into the saved object's", async function () {
			let parent = await createDataObject('item');
			let { first, second } = await plugin.run(async (parentID) => {
				let note = Zotero.DataStore.Handle.item({ itemType: "note", parent: parentID }).setNote("<p>one</p>");
				let first = await note.save();
				note.setNote("<p>two</p>");
				let second = await note.save({ snapshots: true });
				return { first, second };
			}, parent.id);
			assert.isString(first.ref);
			assert.equal(second.id, first.id);
			assert.notProperty(second, "ref");
			assert.equal(second.snapshot.data.note, "<p>two</p>");
			assert.equal(Zotero.Items.get(first.id).parentID, parent.id);
		});

		it("should read a snapshot, then fail to save with Conflict once the object moved on", async function () {
			let item = await createDataObject('item', { title: 'Before' });
			let snapshot = await plugin.run(async (itemID) => {
				globalThis.handle = Zotero.DataStore.Handle.item(itemID);
				return globalThis.handle.snapshot();
			}, item.id);
			assert.equal(snapshot.data.title, 'Before');
			assert.equal(plugin.eval("handle.revision"), snapshot.revision);
			item.setField('title', 'Moved on');
			await item.saveTx();
			let failed = await plugin.run(() => globalThis.handle.setField("title", "Stale").save()
				.then(() => "saved", e => ({ code: e.code, conflicts: e.data.conflicts.length, isError: e instanceof Error })));
			assert.equal(failed.code, codes.CONFLICT);
			assert.equal(failed.conflicts, 1);
			assert.isTrue(failed.isError);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Moved on');
			// A fresh read takes the new revision, and the pending operation saves
			let saved = await plugin.run(async () => {
				await globalThis.handle.snapshot();
				return globalThis.handle.save();
			});
			assert.isNumber(saved.revision);
			assert.equal(Zotero.Items.get(item.id).getField('title'), 'Stale');
		});

		it("should stand for its editor in a change set and as a reference", async function () {
			let collection = await createDataObject('collection');
			let { objects } = await requestResult(plugin.run((collectionID) => {
				let item = Zotero.DataStore.Handle.item({ libraryID, itemType: "book" });
				item.setField("title", "Via handle");
				let folder = Zotero.DataStore.Handle.collection(collectionID);
				folder.addItems([item]);
				return Zotero.DataStore.commit(CS.of(item, folder));
			}, collection.id));
			assert.lengthOf(objects, 2);
			assert.include(Zotero.Collections.get(collection.id).getChildItems(true), objects[0].id);
			assert.equal(Zotero.Items.get(objects[0].id).getField('title'), 'Via handle');
		});

		it("should throw the store's error from snapshot and save, and refuse save without dataWrite", async function () {
			let errors = await plugin.run(async () => ({
				missing: await Zotero.DataStore.Handle.item(-1).snapshot().catch(e => e.code),
				saveMissing: await Zotero.DataStore.Handle.item(-1).setField("title", "x").save()
					.catch(e => e.code),
				created: await Zotero.DataStore.Handle.item({ libraryID, itemType: "book" }).snapshot().catch(e => e.message),
			}));
			assert.equal(errors.missing, codes.NOT_FOUND);
			assert.equal(errors.saveMissing, codes.NOT_FOUND);
			assert.match(errors.created, /not saved yet/);

			plugin.load(["default", "dataRead"]);
			let item = await createDataObject('item', { title: 'Read only' });
			let denied = await plugin.run(async (itemID) => {
				let handle = Zotero.DataStore.Handle.item(itemID);
				let snapshot = await handle.snapshot();
				return { title: snapshot.data.title, code: await handle.setField("title", "x").save().catch(e => e.code) };
			}, item.id);
			assert.equal(denied.title, 'Read only');
			assert.equal(denied.code, codes.PERMISSION_DENIED);
			assert.equal(item.getField('title'), 'Read only');
		});
	});

	describe("finders", function () {
		it("should find items, collections and searches in a library", async function () {
			let collection = await createDataObject('collection');
			let search = await createDataObject('search');
			let item = await createDataObject('item');
			let items = await requestResult(query("findItems", { libraryID }));
			let collections = await requestResult(query("findCollections", { libraryID }));
			let searches = await requestResult(query("findSearches", { libraryID }));
			assert.include(items.itemIDs, item.id);
			assert.include(collections.collectionIDs, collection.id);
			assert.include(searches.searchIDs, search.id);
		});
	});
});
