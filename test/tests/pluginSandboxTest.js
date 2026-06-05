describe("Plugin Sandbox", function () {
	var { PluginSandbox } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/sandbox.mjs");

	var ADDON_ID = "test-sandbox@zotero.org";

	var mockAddon;
	var scope;

	function createMockAddon(permissions = ["default"]) {
		return {
			id: ADDON_ID,
			name: "Test Sandbox Plugin",
			version: "1.0.0",
			syncGUID: "{00000000-0000-0000-0000-000000000001}",
			installPermissions: { permissions },
			getResourceURI() {
				return Services.io.newURI("file:///nonexistent/");
			}
		};
	}

	function evalInScope(code) {
		return Cu.evalInSandbox(code, scope);
	}

	/**
	 * Assert that an expression evaluated in the sandbox returns an item
	 * matching the given Zotero.Item. Handles both sync and async expressions.
	 * @param {string} expr - Expression to evaluate in the sandbox that returns an item (or a Promise of one)
	 * @param {Zotero.Item} item - The expected item to compare against
	 */
	async function assertItemEqual(expr, item) {
		// Resolve to the item first -- works for both sync values and promises
		let id = await evalInScope(`Promise.resolve(${expr}).then(i => i.id)`);
		let key = await evalInScope(`Promise.resolve(${expr}).then(i => i.key)`);
		let libraryID = await evalInScope(`Promise.resolve(${expr}).then(i => i.libraryID)`);
		let itemType = await evalInScope(`Promise.resolve(${expr}).then(i => i.itemType)`);
		let title = await evalInScope(`Promise.resolve(${expr}).then(i => i.getField('title'))`);
		assert.equal(id, item.id);
		assert.equal(key, item.key);
		assert.equal(libraryID, item.libraryID);
		assert.equal(itemType, item.itemType);
		assert.equal(title, item.getField('title'));
	}

	before(async function () {
		await Zotero.initializationPromise;
	});

	afterEach(function () {
		try {
			PluginSandbox.unloadScope(ADDON_ID);
		}
		catch (e) {}
	});

	function loadTestScope(permissions) {
		mockAddon = createMockAddon(permissions);
		PluginSandbox.loadScope(mockAddon);
		scope = PluginSandbox.getScope(ADDON_ID);
	}

	describe("Scope creation", function () {
		it("should create an unprivileged scope with default permissions", function () {
			loadTestScope(["default"]);
			assert.ok(scope);
			assert.isTrue(evalInScope("typeof Zotero === 'object'"));
		});

		it("should expose PERMISSIONS in the scope", function () {
			loadTestScope(["default"]);
			let perms = evalInScope("PERMISSIONS");
			assert.include(Array.from(perms), "default");
		});

		it("should expose timer functions", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof setTimeout === 'function'"));
			assert.isTrue(evalInScope("typeof clearTimeout === 'function'"));
			assert.isTrue(evalInScope("typeof setInterval === 'function'"));
			assert.isTrue(evalInScope("typeof clearInterval === 'function'"));
			assert.isTrue(evalInScope("typeof requestIdleCallback === 'function'"));
			assert.isTrue(evalInScope("typeof cancelIdleCallback === 'function'"));
		});

		it("should expose console", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof console === 'object'"));
			assert.isTrue(evalInScope("typeof console.log === 'function'"));
			assert.isTrue(evalInScope("typeof console.warn === 'function'"));
			assert.isTrue(evalInScope("typeof console.error === 'function'"));
		});

		it("should expose global properties from sandbox options", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof atob === 'function'"));
			assert.isTrue(evalInScope("typeof btoa === 'function'"));
			assert.isTrue(evalInScope("typeof Blob === 'function'"));
			assert.isTrue(evalInScope("typeof DOMParser === 'function'"));
			assert.isTrue(evalInScope("typeof fetch === 'function'"));
			assert.isTrue(evalInScope("typeof TextDecoder === 'function'"));
			assert.isTrue(evalInScope("typeof TextEncoder === 'function'"));
			assert.isTrue(evalInScope("typeof URL === 'function'"));
			assert.isTrue(evalInScope("typeof URLSearchParams === 'function'"));
			assert.isTrue(evalInScope("typeof XMLHttpRequest === 'function'"));
		});
	});

	describe("Zotero Logging APIs", function () {
		beforeEach(function () {
			loadTestScope(["default"]);
		});

		it("should expose Zotero.debug()", function () {
			assert.isTrue(evalInScope("typeof Zotero.debug === 'function'"));
			// Should not throw
			evalInScope("Zotero.debug('test message from sandbox')");
		});

		it("should expose Zotero.warn()", function () {
			assert.isTrue(evalInScope("typeof Zotero.warn === 'function'"));
			evalInScope("Zotero.warn('test warning from sandbox')");
		});

		it("should expose Zotero.logError()", function () {
			assert.isTrue(evalInScope("typeof Zotero.logError === 'function'"));
		});
	});

	describe("Zotero General attributes", function () {
		beforeEach(function () {
			loadTestScope(["default"]);
		});

		it("should expose Zotero.version", function () {
			let version = evalInScope("Zotero.version");
			assert.isString(version);
			assert.equal(version, Zotero.version);
		});

		it("should expose Zotero.isBetaBuild", function () {
			let val = evalInScope("Zotero.isBetaBuild");
			assert.isBoolean(val);
			assert.equal(val, Zotero.isBetaBuild);
		});

		it("should expose Zotero.isDevBuild", function () {
			let val = evalInScope("Zotero.isDevBuild");
			assert.isBoolean(val);
			assert.equal(val, Zotero.isDevBuild);
		});

		it("should expose Zotero.isSourceBuild", function () {
			let val = evalInScope("Zotero.isSourceBuild");
			assert.isBoolean(val);
			assert.equal(val, Zotero.isSourceBuild);
		});

		it("should expose Zotero.platformVersion", function () {
			let val = evalInScope("Zotero.platformVersion");
			assert.isString(val);
			assert.equal(val, Zotero.platformVersion);
		});

		it("should expose Zotero.platformMajorVersion", function () {
			let val = evalInScope("Zotero.platformMajorVersion");
			assert.isNumber(val);
			assert.equal(val, Zotero.platformMajorVersion);
		});

		it("should expose Zotero.arch", function () {
			let val = evalInScope("Zotero.arch");
			assert.isString(val);
			assert.equal(val, Zotero.arch);
		});

		it("should expose platform detection booleans", function () {
			assert.equal(evalInScope("Zotero.isMac"), Zotero.isMac);
			assert.equal(evalInScope("Zotero.isWin"), Zotero.isWin);
			assert.equal(evalInScope("Zotero.isLinux"), Zotero.isLinux);
		});

		it("should not allow setting attributes on Zotero", function () {
			let threw = false;
			try {
				evalInScope("Zotero.version = 'hacked'");
			}
			catch {
				threw = true;
			}
			assert.isTrue(threw, "Setting Zotero.version should throw");
			// Value should be unchanged
			assert.equal(evalInScope("Zotero.version"), Zotero.version);
		});
	});

	describe("Zotero Locks", function () {
		beforeEach(function () {
			loadTestScope(["default"]);
		});

		it("should expose Zotero.initializationPromise", async function () {
			let promise = evalInScope("Zotero.initializationPromise");
			assert.ok(promise);
			assert.isTrue(evalInScope("typeof Zotero.initializationPromise.then === 'function'"));
			await promise;
		});

		it("should expose Zotero.uiReadyPromise", function () {
			let promise = evalInScope("Zotero.uiReadyPromise");
			assert.ok(promise);
			assert.isTrue(evalInScope("typeof Zotero.uiReadyPromise.then === 'function'"));
		});

		it("should expose Zotero.unlockPromise", function () {
			let promise = evalInScope("Zotero.unlockPromise");
			assert.ok(promise);
			assert.isTrue(evalInScope("typeof Zotero.unlockPromise.then === 'function'"));
		});
	});

	describe("Zotero.Utilities", function () {
		beforeEach(function () {
			loadTestScope(["default"]);
		});

		it("should expose Zotero.Utilities.cleanDOI()", function () {
			assert.isTrue(evalInScope("typeof Zotero.Utilities.cleanDOI === 'function'"));
			let doi = evalInScope("Zotero.Utilities.cleanDOI('https://doi.org/10.1234/test')");
			assert.equal(doi, '10.1234/test');
		});

		it("should return falsy for invalid DOI from cleanDOI()", function () {
			let result = evalInScope("Zotero.Utilities.cleanDOI('not a doi')");
			assert.isNotOk(result);
		});

		it("should expose Zotero.Utilities.sentenceCase()", function () {
			assert.isTrue(evalInScope("typeof Zotero.Utilities.sentenceCase === 'function'"));
			let result = evalInScope("Zotero.Utilities.sentenceCase('A Title in Title Case')");
			assert.isString(result);
			assert.equal(result, Zotero.Utilities.sentenceCase('A Title in Title Case'));
		});

		it("should expose Zotero.Utilities.capitalizeName()", function () {
			assert.isTrue(evalInScope("typeof Zotero.Utilities.capitalizeName === 'function'"));
			let result = evalInScope("Zotero.Utilities.capitalizeName('john smith')");
			assert.isString(result);
			assert.equal(result, Zotero.Utilities.capitalizeName('john smith'));
		});

		it("should not expose unlisted Utilities methods", function () {
			assert.isTrue(evalInScope("typeof Zotero.Utilities.randomString === 'undefined'"),
				"randomString should not be exposed");
		});
	});

	describe("Zotero.Date", function () {
		beforeEach(function () {
			loadTestScope(["default"]);
		});

		it("should expose Zotero.Date.strToISO()", function () {
			assert.isTrue(evalInScope("typeof Zotero.Date.strToISO === 'function'"));
			let result = evalInScope("Zotero.Date.strToISO('January 1, 2020')");
			assert.equal(result, '2020-01-01');
		});

		it("should return false for empty string from strToISO()", function () {
			let result = evalInScope("Zotero.Date.strToISO('')");
			assert.isFalse(result);
		});

		it("should not expose unlisted Date methods", function () {
			assert.isTrue(evalInScope("typeof Zotero.Date.sqlToDate === 'undefined'"),
				"sqlToDate should not be exposed");
		});
	});

	describe("Zotero.Items", function () {
		beforeEach(function () {
			loadTestScope(["default", "data"]);
		});

		it("should expose Zotero.Items.get()", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Sandbox Get Test');
			await item.saveTx();

			await assertItemEqual(`Zotero.Items.get(${item.id})`, item);

			await item.eraseTx();
		});

		it("should return an array of items from Zotero.Items.get() with array of IDs", async function () {
			let item1 = new Zotero.Item('book');
			item1.setField('title', 'Sandbox Array Test 1');
			await item1.saveTx();
			let item2 = new Zotero.Item('book');
			item2.setField('title', 'Sandbox Array Test 2');
			await item2.saveTx();

			evalInScope(`
				var _items = Zotero.Items.get([${item1.id}, ${item2.id}]);
				var itemCount = _items.length;
				var itemIDs = _items.map(i => i.id);
				var itemTitles = _items.map(i => i.getField('title'));
			`);
			assert.equal(evalInScope("itemCount"), 2);
			assert.equal(evalInScope("itemIDs[0]"), item1.id);
			assert.equal(evalInScope("itemIDs[1]"), item2.id);
			assert.equal(evalInScope("itemTitles[0]"), 'Sandbox Array Test 1');
			assert.equal(evalInScope("itemTitles[1]"), 'Sandbox Array Test 2');

			await item1.eraseTx();
			await item2.eraseTx();
		});

		it("should expose Zotero.Items.getAsync()", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Sandbox GetAsync Test');
			await item.saveTx();

			await assertItemEqual(`Zotero.Items.getAsync(${item.id})`, item);

			await item.eraseTx();
		});

		it("should expose Zotero.Items.getByLibraryAndKey()", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Sandbox GetByKey Test');
			await item.saveTx();

			await assertItemEqual(`Zotero.Items.getByLibraryAndKey(${item.libraryID}, "${item.key}")`, item);

			await item.eraseTx();
		});

		it("should expose Zotero.Items.getTopLevel()", async function () {
			let parent = new Zotero.Item('book');
			await parent.saveTx();
			let note = new Zotero.Item('note');
			note.parentItemID = parent.id;
			await note.saveTx();

			evalInScope(`
				var _topLevel = Zotero.Items.getTopLevel([Zotero.Items.get(${parent.id}), Zotero.Items.get(${note.id})]);
				var topLevelCount = _topLevel.length;
				var topLevelIDs = _topLevel.map(i => i.id);
			`);
			assert.equal(evalInScope("topLevelCount"), 1);
			assert.equal(evalInScope("topLevelIDs[0]"), parent.id);

			await note.eraseTx();
			await parent.eraseTx();
		});

		it("should expose Zotero.Items.keepTopLevel()", async function () {
			let parent = new Zotero.Item('book');
			await parent.saveTx();
			let note = new Zotero.Item('note');
			note.parentItemID = parent.id;
			await note.saveTx();
			let standalone = new Zotero.Item('note');
			await standalone.saveTx();

			// When parent and its child are both selected, keepTopLevel removes the child
			evalInScope(`
				var _kept = Zotero.Items.keepTopLevel([Zotero.Items.get(${parent.id}), Zotero.Items.get(${note.id}), Zotero.Items.get(${standalone.id})]);
				var keptCount = _kept.length;
				var keptIDs = _kept.map(i => i.id);
			`);
			assert.equal(evalInScope("keptCount"), 2);
			// Parent and standalone kept, child note removed
			let keptIDs = [evalInScope("keptIDs[0]"), evalInScope("keptIDs[1]")];
			assert.include(keptIDs, parent.id);
			assert.include(keptIDs, standalone.id);
			assert.notInclude(keptIDs, note.id);

			await standalone.eraseTx();
			await note.eraseTx();
			await parent.eraseTx();
		});

		it("should expose Zotero.Items.trashTx()", async function () {
			let item = new Zotero.Item('book');
			await item.saveTx();
			let itemID = item.id;

			await evalInScope(`Zotero.Items.trashTx(${itemID})`);

			item = Zotero.Items.get(itemID);
			assert.isTrue(item.deleted);

			await item.eraseTx();
		});

		it("should expose item attributes and return facades for related items", async function () {
			let parent = new Zotero.Item('book');
			parent.setField('title', 'Parent Book');
			await parent.saveTx();
			let note = new Zotero.Item('note');
			note.parentItemID = parent.id;
			await note.saveTx();

			// Get the child note through the sandbox
			evalInScope(`
				var _note = Zotero.Items.get(${note.id});
				var _noteID = _note.id;
				var _noteKey = _note.key;
				var _noteLibraryID = _note.libraryID;
				var _noteItemType = _note.itemType;
				var _noteParentItemID = _note.parentItemID;
				var _noteParentKey = _note.parentKey;
			`);

			// Basic attributes
			assert.equal(evalInScope("_noteID"), note.id);
			assert.equal(evalInScope("_noteKey"), note.key);
			assert.equal(evalInScope("_noteLibraryID"), note.libraryID);
			assert.equal(evalInScope("_noteItemType"), 'note');
			assert.equal(evalInScope("_noteParentItemID"), parent.id);
			assert.equal(evalInScope("_noteParentKey"), parent.key);

			// topLevelItem should return a facade for the parent
			evalInScope(`
				var _topLevel = _note.topLevelItem;
				var _topLevelID = _topLevel.id;
				var _topLevelKey = _topLevel.key;
				var _topLevelTitle = _topLevel.getField('title');
				var _topLevelItemType = _topLevel.itemType;
			`);
			assert.equal(evalInScope("_topLevelID"), parent.id);
			assert.equal(evalInScope("_topLevelKey"), parent.key);
			assert.equal(evalInScope("_topLevelTitle"), 'Parent Book');
			assert.equal(evalInScope("_topLevelItemType"), 'book');

			// topLevelItem of a top-level item should return itself
			evalInScope(`
				var _parent = Zotero.Items.get(${parent.id});
				var _parentTopLevel = _parent.topLevelItem;
				var _parentTopLevelID = _parentTopLevel.id;
			`);
			assert.equal(evalInScope("_parentTopLevelID"), parent.id);

			await note.eraseTx();
			await parent.eraseTx();
		});

		it("should construct a new Zotero.Item", async function () {
			evalInScope(`
				var _item = new Zotero.Item('book');
				_item.setField('title', 'Constructor Test Book');
			`);
			let itemType = evalInScope("_item.itemType");
			let title = evalInScope("_item.getField('title')");
			assert.equal(itemType, 'book');
			assert.equal(title, 'Constructor Test Book');

			// Save and verify
			let id = await evalInScope("_item.saveTx()");
			assert.isNumber(id);
			let realItem = Zotero.Items.get(id);
			assert.ok(realItem);
			assert.equal(realItem.getField('title'), 'Constructor Test Book');
			assert.equal(realItem.itemType, 'book');

			await realItem.eraseTx();
		});

		it("should not expose unlisted methods", function () {
			assert.isTrue(evalInScope("typeof Zotero.Items.erase === 'undefined'"));
			assert.isTrue(evalInScope("typeof Zotero.Items.emptyTrash === 'undefined'"));
		});
	});

	describe("Zotero.Libraries", function () {
		beforeEach(function () {
			loadTestScope(["default", "data"]);
		});

		it("should return a library from Zotero.Libraries.get()", function () {
			evalInScope(`
				var _lib = Zotero.Libraries.get(1);
				var _libName = _lib.name;
				var _libType = _lib.libraryType;
				var _libEditable = _lib.editable;
			`);
			let realLib = Zotero.Libraries.get(1);
			assert.equal(evalInScope("_libName"), realLib.name);
			assert.equal(evalInScope("_libType"), realLib.libraryType);
			assert.equal(evalInScope("_libEditable"), realLib.editable);
		});

		it("should return libraries from Zotero.Libraries.getAll()", function () {
			let realLibs = Zotero.Libraries.getAll();
			evalInScope(`
				var _libs = Zotero.Libraries.getAll();
				var _libCount = _libs.length;
			`);
			assert.equal(evalInScope("_libCount"), realLibs.length);
		});

		it("should return library name from Zotero.Libraries.getName()", function () {
			let realName = Zotero.Libraries.getName(1);
			let sandboxName = evalInScope("Zotero.Libraries.getName(1)");
			assert.equal(sandboxName, realName);
		});

		it("should return library type from Zotero.Libraries.getType()", function () {
			let realType = Zotero.Libraries.getType(1);
			let sandboxType = evalInScope("Zotero.Libraries.getType(1)");
			assert.equal(sandboxType, realType);
		});

		it("should return version from Zotero.Libraries.getVersion()", function () {
			let realVersion = Zotero.Libraries.getVersion(1);
			let sandboxVersion = evalInScope("Zotero.Libraries.getVersion(1)");
			assert.equal(sandboxVersion, realVersion);
		});

		it("should return hasTrash from Zotero.Libraries.hasTrash()", function () {
			let realHasTrash = Zotero.Libraries.hasTrash(1);
			let sandboxHasTrash = evalInScope("Zotero.Libraries.hasTrash(1)");
			assert.equal(sandboxHasTrash, realHasTrash);
		});

		it("should return editable from Zotero.Libraries.isEditable()", function () {
			let realEditable = Zotero.Libraries.isEditable(1);
			let sandboxEditable = evalInScope("Zotero.Libraries.isEditable(1)");
			assert.equal(sandboxEditable, realEditable);
		});

		it("should return filesEditable from Zotero.Libraries.isFilesEditable()", function () {
			let realFilesEditable = Zotero.Libraries.isFilesEditable(1);
			let sandboxFilesEditable = evalInScope("Zotero.Libraries.isFilesEditable(1)");
			assert.equal(sandboxFilesEditable, realFilesEditable);
		});

		it("should return isGroupLibrary from Zotero.Libraries.isGroupLibrary()", function () {
			let realIsGroup = Zotero.Libraries.isGroupLibrary(1);
			let sandboxIsGroup = evalInScope("Zotero.Libraries.isGroupLibrary(1)");
			assert.equal(sandboxIsGroup, realIsGroup);
		});

		it("should return exists from Zotero.Libraries.exists()", function () {
			assert.isTrue(evalInScope("Zotero.Libraries.exists(1)"));
			assert.isFalse(evalInScope("Zotero.Libraries.exists(999999)"));
		});

		it("should expose library instance attributes via facade", function () {
			let realLib = Zotero.Libraries.get(1);
			evalInScope(`
				var _lib = Zotero.Libraries.get(1);
				var _libID = _lib.libraryID;
				var _libId = _lib.id;
				var _libName = _lib.name;
				var _libType = _lib.libraryType;
				var _libVersion = _lib.libraryVersion;
				var _libEditable = _lib.editable;
				var _libFilesEditable = _lib.filesEditable;
				var _libHasTrash = _lib.hasTrash;
				var _libIsGroup = _lib.isGroup;
				var _libSyncable = _lib.syncable;
				var _libTreeViewID = _lib.treeViewID;
			`);
			assert.equal(evalInScope("_libID"), realLib.libraryID);
			assert.equal(evalInScope("_libId"), realLib.id);
			assert.equal(evalInScope("_libName"), realLib.name);
			assert.equal(evalInScope("_libType"), realLib.libraryType);
			assert.equal(evalInScope("_libVersion"), realLib.libraryVersion);
			assert.equal(evalInScope("_libEditable"), realLib.editable);
			assert.equal(evalInScope("_libFilesEditable"), realLib.filesEditable);
			assert.equal(evalInScope("_libHasTrash"), realLib.hasTrash);
			assert.equal(evalInScope("_libIsGroup"), realLib.isGroup);
			assert.equal(evalInScope("_libSyncable"), realLib.syncable);
			assert.equal(evalInScope("_libTreeViewID"), realLib.treeViewID);
		});

		it("should expose library instance methods via facade", async function () {
			evalInScope(`
				var _lib = Zotero.Libraries.get(1);
				var _hasCollections = _lib.hasCollections();
				var _hasSearches = _lib.hasSearches();
			`);
			let realLib = Zotero.Libraries.get(1);
			assert.equal(evalInScope("_hasCollections"), realLib.hasCollections());
			assert.equal(evalInScope("_hasSearches"), realLib.hasSearches());

			let hasItems = await evalInScope("Zotero.Libraries.get(1).hasItems()");
			let realHasItems = await realLib.hasItems();
			assert.equal(hasItems, realHasItems);
		});

		it("should return library facades from Zotero.Libraries.getAll()", function () {
			let realLibs = Zotero.Libraries.getAll();
			evalInScope(`
				var _libs = Zotero.Libraries.getAll();
				var _libCount = _libs.length;
				var _firstLibID = _libs[0].libraryID;
				var _firstLibName = _libs[0].name;
				var _firstLibType = _libs[0].libraryType;
			`);
			assert.equal(evalInScope("_libCount"), realLibs.length);
			assert.equal(evalInScope("_firstLibID"), realLibs[0].libraryID);
			assert.equal(evalInScope("_firstLibName"), realLibs[0].name);
			assert.equal(evalInScope("_firstLibType"), realLibs[0].libraryType);
		});
	});

	describe("Zotero.Collections", function () {
		beforeEach(function () {
			loadTestScope(["default", "data"]);
		});

		it("should return collection facades from getByLibrary()", async function () {
			let collection = new Zotero.Collection();
			collection.name = "Test Collection Sandbox";
			await collection.saveTx();

			evalInScope(`
				var _cols = Zotero.Collections.getByLibrary(1);
				var _colCount = _cols.length;
				var _colNames = _cols.map(c => c.name);
			`);
			let count = evalInScope("_colCount");
			assert.isAbove(count, 0);
			let names = [];
			for (let i = 0; i < count; i++) {
				names.push(evalInScope(`_colNames[${i}]`));
			}
			assert.include(names, "Test Collection Sandbox");

			await collection.eraseTx();
		});

		it("should return child collections from getByParent()", async function () {
			let parent = new Zotero.Collection();
			parent.name = "Parent Collection";
			await parent.saveTx();
			let child = new Zotero.Collection();
			child.name = "Child Collection";
			child.parentID = parent.id;
			await child.saveTx();

			evalInScope(`
				var _children = Zotero.Collections.getByParent(${parent.id});
				var _childCount = _children.length;
				var _childName = _children[0].name;
				var _childID = _children[0].id;
			`);
			assert.equal(evalInScope("_childCount"), 1);
			assert.equal(evalInScope("_childName"), "Child Collection");
			assert.equal(evalInScope("_childID"), child.id);

			await child.eraseTx();
			await parent.eraseTx();
		});

		it("should return collections containing items from getCollectionsContainingItems()", async function () {
			let collection = new Zotero.Collection();
			collection.name = "Container Collection";
			await collection.saveTx();
			let item = new Zotero.Item('book');
			item.setField('title', 'Contained Item');
			item.addToCollection(collection.id);
			await item.saveTx();

			let count = await evalInScope(`
				Zotero.Collections.getCollectionsContainingItems([${item.id}], true)
					.then(ids => ids.length)
			`);
			assert.equal(count, 1);

			await item.eraseTx();
			await collection.eraseTx();
		});

		it("should expose collection instance attributes via facade", async function () {
			let parent = new Zotero.Collection();
			parent.name = "Facade Parent";
			await parent.saveTx();
			let child = new Zotero.Collection();
			child.name = "Facade Child";
			child.parentID = parent.id;
			await child.saveTx();

			evalInScope(`
				var _cols = Zotero.Collections.getByParent(${parent.id});
				var _col = _cols[0];
				var _colID = _col.id;
				var _colName = _col.name;
				var _colKey = _col.key;
				var _colLibraryID = _col.libraryID;
				var _colParent = _col.parent;
			`);
			assert.equal(evalInScope("_colID"), child.id);
			assert.equal(evalInScope("_colName"), "Facade Child");
			assert.equal(evalInScope("_colKey"), child.key);
			assert.equal(evalInScope("_colLibraryID"), child.libraryID);
			assert.equal(evalInScope("_colParent"), parent.id);

			await child.eraseTx();
			await parent.eraseTx();
		});

		it("should expose collection instance methods via facade", async function () {
			let collection = new Zotero.Collection();
			collection.name = "Methods Collection";
			await collection.saveTx();
			let item = new Zotero.Item('book');
			item.setField('title', 'Collection Item');
			item.addToCollection(collection.id);
			await item.saveTx();

			evalInScope(`
				var _cols = Zotero.Collections.getByLibrary(1);
				var _col = _cols.find(c => c.id === ${collection.id});
				var _hasItems = _col.hasChildItems();
				var _hasCollections = _col.hasChildCollections();
				var _hasItem = _col.hasItem(${item.id});
			`);
			assert.isTrue(evalInScope("_hasItems"));
			assert.isFalse(evalInScope("_hasCollections"));
			assert.isTrue(evalInScope("_hasItem"));

			await item.eraseTx();
			await collection.eraseTx();
		});

		it("should construct a new Zotero.Collection", async function () {
			evalInScope(`
				var _col = new Zotero.Collection();
				_col.name = 'Constructor Test Collection';
			`);
			let name = evalInScope("_col.name");
			assert.equal(name, 'Constructor Test Collection');

			let id = await evalInScope("_col.saveTx()");
			assert.isNumber(id);
			let realCol = Zotero.Collections.get(id);
			assert.ok(realCol);
			assert.equal(realCol.name, 'Constructor Test Collection');

			await realCol.eraseTx();
		});
	});

	describe("Zotero.Groups", function () {
		beforeEach(function () {
			loadTestScope(["default", "data"]);
		});

		it("should return a group from Zotero.Groups.get()", async function () {
			let group = await createGroup({ name: "Sandbox Group Test" });
			evalInScope(`
				var _group = Zotero.Groups.get(${group.id});
				var _groupName = _group.name;
				var _groupLibID = _group.libraryID;
				var _groupEditable = _group.editable;
			`);
			assert.equal(evalInScope("_groupName"), "Sandbox Group Test");
			assert.equal(evalInScope("_groupLibID"), group.libraryID);
			assert.equal(evalInScope("_groupEditable"), group.editable);

			await group.eraseTx();
		});

		it("should return all groups from Zotero.Groups.getAll()", async function () {
			let group = await createGroup({ name: "Sandbox GetAll Group" });

			evalInScope(`
				var _groups = Zotero.Groups.getAll();
				var _groupCount = _groups.length;
				var _groupNames = _groups.map(g => g.name);
			`);
			let count = evalInScope("_groupCount");
			assert.isAbove(count, 0);
			let names = [];
			for (let i = 0; i < count; i++) {
				names.push(evalInScope(`_groupNames[${i}]`));
			}
			assert.include(names, "Sandbox GetAll Group");

			await group.eraseTx();
		});

		it("should return a group from Zotero.Groups.getByLibraryID()", async function () {
			let group = await createGroup({ name: "Sandbox ByLibID Group" });
			evalInScope(`
				var _group = Zotero.Groups.getByLibraryID(${group.libraryID});
				var _groupName = _group.name;
			`);
			assert.equal(evalInScope("_groupName"), "Sandbox ByLibID Group");

			await group.eraseTx();
		});

		it("should convert between group ID and library ID", async function () {
			let group = await createGroup({ name: "Sandbox ID Convert" });

			let sandboxLibID = evalInScope(`Zotero.Groups.getLibraryIDFromGroupID(${group.id})`);
			assert.equal(sandboxLibID, group.libraryID);

			let sandboxGroupID = evalInScope(`Zotero.Groups.getGroupIDFromLibraryID(${group.libraryID})`);
			assert.equal(sandboxGroupID, group.id);

			await group.eraseTx();
		});

		it("should check group existence from Zotero.Groups.exists()", async function () {
			let group = await createGroup({ name: "Sandbox Exists Group" });
			assert.isTrue(evalInScope(`Zotero.Groups.exists(${group.id})`));
			assert.isFalse(evalInScope("Zotero.Groups.exists(999999)"));

			await group.eraseTx();
		});
	});

	describe("Zotero.Tags", function () {
		beforeEach(function () {
			loadTestScope(["default", "data"]);
		});

		it("should get tag ID and name", async function () {
			let item = new Zotero.Item('book');
			item.addTag('sandbox-id-name-tag');
			await item.saveTx();

			let tagID = evalInScope("Zotero.Tags.getID('sandbox-id-name-tag')");
			assert.ok(tagID);
			assert.equal(tagID, Zotero.Tags.getID('sandbox-id-name-tag'));

			let tagName = evalInScope(`Zotero.Tags.getName(${tagID})`);
			assert.equal(tagName, 'sandbox-id-name-tag');

			await item.eraseTx();
		});

		it("should return all tags from getAll()", async function () {
			let item = new Zotero.Item('book');
			item.addTag('sandbox-getall-tag');
			await item.saveTx();

			let tags = await evalInScope("Zotero.Tags.getAll(1)");
			assert.ok(tags);
			// tags is an array of {tag, type} objects
			let realTags = await Zotero.Tags.getAll(1);
			assert.equal(tags.length, realTags.length);

			await item.eraseTx();
		});

		it("should get and set tag color", async function () {
			let item = new Zotero.Item('book');
			item.addTag('sandbox-color-tag');
			await item.saveTx();

			await evalInScope("Zotero.Tags.setColor(1, 'sandbox-color-tag', '#FF0000', 0)");

			let color = evalInScope("Zotero.Tags.getColor(1, 'sandbox-color-tag')");
			assert.ok(color);
			assert.equal(color.color, '#FF0000');

			let byPos = evalInScope("Zotero.Tags.getColorByPosition(1, 0)");
			assert.ok(byPos);
			assert.equal(byPos.name, 'sandbox-color-tag');

			// Clean up
			await evalInScope("Zotero.Tags.setColor(1, 'sandbox-color-tag', false)");
			await item.eraseTx();
		});

		it("should return colors map from getColors()", function () {
			let colors = evalInScope("Zotero.Tags.getColors(1)");
			assert.ok(colors);
		});

		it("should rename a tag", async function () {
			let item = new Zotero.Item('book');
			item.addTag('sandbox-rename-old');
			await item.saveTx();

			await evalInScope("Zotero.Tags.rename(1, 'sandbox-rename-old', 'sandbox-rename-new')");

			let oldID = Zotero.Tags.getID('sandbox-rename-old');
			assert.isFalse(oldID);
			let newID = Zotero.Tags.getID('sandbox-rename-new');
			assert.ok(newID);

			await item.eraseTx();
		});

		it("should remove a tag from library", async function () {
			let item = new Zotero.Item('book');
			item.addTag('sandbox-remove-tag');
			await item.saveTx();

			let tagID = Zotero.Tags.getID('sandbox-remove-tag');
			assert.ok(tagID);

			await evalInScope(`Zotero.Tags.removeFromLibrary(1, ${tagID})`);

			// Tag should no longer be on the item
			item = Zotero.Items.get(item.id);
			assert.isFalse(item.hasTag('sandbox-remove-tag'));

			await item.eraseTx();
		});
	});

	describe("Zotero.Search", function () {
		beforeEach(function () {
			loadTestScope(["default", "data"]);
		});

		it("should construct a new Zotero.Search", async function () {
			evalInScope(`
				var _search = new Zotero.Search();
				_search.name = 'Constructor Test Search';
				_search.addCondition('title', 'contains', 'test');
			`);
			let name = evalInScope("_search.name");
			assert.equal(name, 'Constructor Test Search');

			let id = await evalInScope("_search.saveTx()");
			assert.isNumber(id);
			let realSearch = Zotero.Searches.get(id);
			assert.ok(realSearch);
			assert.equal(realSearch.name, 'Constructor Test Search');

			await realSearch.eraseTx();
		});
	});

	describe("Zotero.Duplicates", function () {
		beforeEach(function () {
			loadTestScope(["default", "data"]);
		});

		it("should construct a new Zotero.Duplicates", async function () {
			let userLibraryID = Zotero.Libraries.userLibraryID;
			evalInScope(`
				var _dup = new Zotero.Duplicates(${userLibraryID});
				var _dupLibraryID = _dup.libraryID;
			`);
			let libraryID = evalInScope("_dupLibraryID");
			assert.equal(libraryID, userLibraryID);
		});
	});

	describe("Zotero.ItemFields", function () {
		beforeEach(function () {
			loadTestScope(["default", "data"]);
		});

		it("should expose Zotero.ItemFields.getAll()", function () {
			assert.isTrue(evalInScope("typeof Zotero.ItemFields.getAll === 'function'"));
			let fields = evalInScope("Zotero.ItemFields.getAll()");
			assert.isArray(fields);
			assert.isAbove(fields.length, 0);
			// Each field should have id and name
			let first = fields[0];
			assert.property(first, 'id');
			assert.property(first, 'name');
		});

		it("should expose Zotero.ItemFields.getID()", function () {
			assert.isTrue(evalInScope("typeof Zotero.ItemFields.getID === 'function'"));
			let id = evalInScope("Zotero.ItemFields.getID('title')");
			assert.equal(id, Zotero.ItemFields.getID('title'));
		});

		it("should return false for invalid field name from getID()", function () {
			let result = evalInScope("Zotero.ItemFields.getID('nonexistentField123')");
			assert.isFalse(result);
		});

		it("should expose Zotero.ItemFields.getName()", function () {
			assert.isTrue(evalInScope("typeof Zotero.ItemFields.getName === 'function'"));
			let titleID = Zotero.ItemFields.getID('title');
			let name = evalInScope(`Zotero.ItemFields.getName(${titleID})`);
			assert.equal(name, 'title');
		});

		it("should expose Zotero.ItemFields.isValidForType()", function () {
			assert.isTrue(evalInScope("typeof Zotero.ItemFields.isValidForType === 'function'"));
			let titleID = Zotero.ItemFields.getID('title');
			let bookID = Zotero.ItemTypes.getID('book');
			let result = evalInScope(`Zotero.ItemFields.isValidForType(${titleID}, ${bookID})`);
			assert.isTrue(result);
		});

		it("should expose Zotero.ItemFields.getLocalizedString()", function () {
			assert.isTrue(evalInScope("typeof Zotero.ItemFields.getLocalizedString === 'function'"));
			let label = evalInScope("Zotero.ItemFields.getLocalizedString('title')");
			assert.isString(label);
			assert.equal(label, Zotero.ItemFields.getLocalizedString('title'));
		});
	});

	describe("Zotero.ItemTypes", function () {
		beforeEach(function () {
			loadTestScope(["default", "data"]);
		});

		it("should expose Zotero.ItemTypes.getID()", function () {
			assert.isTrue(evalInScope("typeof Zotero.ItemTypes.getID === 'function'"));
			let id = evalInScope("Zotero.ItemTypes.getID('book')");
			assert.equal(id, Zotero.ItemTypes.getID('book'));
		});

		it("should return false for invalid type name from getID()", function () {
			let result = evalInScope("Zotero.ItemTypes.getID('nonexistentType123')");
			assert.isFalse(result);
		});

		it("should expose Zotero.ItemTypes.getLocalizedString()", function () {
			assert.isTrue(evalInScope("typeof Zotero.ItemTypes.getLocalizedString === 'function'"));
			let label = evalInScope("Zotero.ItemTypes.getLocalizedString('book')");
			assert.isString(label);
			assert.equal(label, Zotero.ItemTypes.getLocalizedString('book'));
		});
	});

	describe("Zotero.CreatorTypes", function () {
		beforeEach(function () {
			loadTestScope(["default", "data"]);
		});

		it("should expose Zotero.CreatorTypes.getLocalizedString()", function () {
			assert.isTrue(evalInScope("typeof Zotero.CreatorTypes.getLocalizedString === 'function'"));
			let label = evalInScope("Zotero.CreatorTypes.getLocalizedString('author')");
			assert.isString(label);
			assert.equal(label, Zotero.CreatorTypes.getLocalizedString('author'));
		});
	});

	describe("Zotero.Fulltext", function () {
		beforeEach(function () {
			loadTestScope(["default", "data"]);
		});

		it("should expose Zotero.Fulltext.getPages()", async function () {
			assert.isTrue(evalInScope("typeof Zotero.Fulltext.getPages === 'function'"));
			let item = new Zotero.Item('attachment');
			item.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
			item.attachmentContentType = 'application/pdf';
			await item.saveTx();

			// Un-indexed items return false; just verify the call completes without error
			// and matches the host result
			let result = await evalInScope(`Zotero.Fulltext.getPages(${item.id})`);
			let expected = await Zotero.Fulltext.getPages(item.id);
			assert.equal(result, expected);

			await item.eraseTx();
		});
	});

	describe("Zotero.File", function () {
		var tmpDir;

		before(async function () {
			tmpDir = PathUtils.join(Zotero.getTempDirectory().path, 'pluginSandboxFileTest');
			await IOUtils.makeDirectory(tmpDir, { ignoreExisting: true });
		});

		after(async function () {
			await IOUtils.remove(tmpDir, { recursive: true, ignoreAbsent: true });
		});

		beforeEach(function () {
			loadTestScope(["default", "fileSystem"]);
		});

		let fileMethods = [
			"getExtension",
			"getBinaryContentsAsync",
			"getContentsAsync",
			"getContentsFromURLAsync",
			"directoryIsEmpty",
			"generateDataURI",
			"normalizeToUnix",
			"directoryContains",
			"truncateFileName",
			"reveal",
			"putContentsAsync",
			"download",
			"rename",
			"removeIfExists",
			"iterateDirectory",
			"moveDirectory",
			"setNormalFilePermissions",
			"moveToUnique",
			"copyToUnique",
			"copyDirectory",
			"createDirectoryIfMissingAsync",
			"zipDirectory",
		];

		for (let method of fileMethods) {
			it(`should expose Zotero.File.${method}()`, function () {
				assert.isTrue(evalInScope(`typeof Zotero.File.${method} === 'function'`));
			});
		}

		it("should normalize paths with normalizeToUnix()", function () {
			assert.equal(evalInScope("Zotero.File.normalizeToUnix('a\\\\b\\\\c')"), 'a/b/c');
			assert.equal(evalInScope("Zotero.File.normalizeToUnix('a/b/c')"), 'a/b/c');
			assert.equal(evalInScope("Zotero.File.normalizeToUnix('')"), '');
		});

		it("should check directory containment with directoryContains()", function () {
			assert.isTrue(evalInScope("Zotero.File.directoryContains('/a/b', '/a/b/c')"));
			assert.isTrue(evalInScope("Zotero.File.directoryContains('/a/b', '/a/b/c/d')"));
			assert.isFalse(evalInScope("Zotero.File.directoryContains('/a/b', '/a/c')"));
			assert.isFalse(evalInScope("Zotero.File.directoryContains('/a/b', '/a/bc')"));
		});

		it("should truncate file names with truncateFileName()", function () {
			let result = evalInScope("Zotero.File.truncateFileName('a_very_long_filename_that_exceeds.pdf', 20)");
			assert.ok(result);
			assert.isTrue(result.endsWith('.pdf'));
			assert.isAtMost(new TextEncoder().encode(result).length, 20);
		});

		it("should not truncate short file names with truncateFileName()", function () {
			let result = evalInScope("Zotero.File.truncateFileName('short.txt', 255)");
			assert.equal(result, 'short.txt');
		});

		it("should get file extension with getExtension()", function () {
			let filePath = PathUtils.join(tmpDir, 'testfile.pdf');
			evalInScope(`var _ext = Zotero.File.getExtension(${JSON.stringify(filePath)})`);
			assert.equal(evalInScope("_ext"), 'pdf');
		});

		it("should return empty string for file with no extension from getExtension()", function () {
			let filePath = PathUtils.join(tmpDir, 'noext');
			evalInScope(`var _ext = Zotero.File.getExtension(${JSON.stringify(filePath)})`);
			assert.equal(evalInScope("_ext"), '');
		});

		it("should write and read text file with putContentsAsync/getContentsAsync()", async function () {
			let filePath = PathUtils.join(tmpDir, 'test-rw.txt');
			await evalInScope(`Zotero.File.putContentsAsync(${JSON.stringify(filePath)}, "hello sandbox")`);

			let contents = await evalInScope(`Zotero.File.getContentsAsync(${JSON.stringify(filePath)})`);
			assert.equal(contents, "hello sandbox");
		});

		it("should write and read unicode text with putContentsAsync/getContentsAsync()", async function () {
			let filePath = PathUtils.join(tmpDir, 'test-unicode.txt');
			let unicodeText = "Unicode: \u00e9\u00e8\u00ea \u4f60\u597d \ud83d\ude00";
			await evalInScope(`Zotero.File.putContentsAsync(${JSON.stringify(filePath)}, ${JSON.stringify(unicodeText)})`);

			let contents = await evalInScope(`Zotero.File.getContentsAsync(${JSON.stringify(filePath)})`);
			assert.equal(contents, unicodeText);
		});

		it("should read binary contents with getBinaryContentsAsync()", async function () {
			let filePath = PathUtils.join(tmpDir, 'test-binary.bin');
			await IOUtils.write(filePath, new Uint8Array([0x00, 0x01, 0x02, 0xFF]));

			let contents = await evalInScope(`Zotero.File.getBinaryContentsAsync(${JSON.stringify(filePath)})`);
			assert.equal(contents.length, 4);
			assert.equal(contents.charCodeAt(0), 0x00);
			assert.equal(contents.charCodeAt(1), 0x01);
			assert.equal(contents.charCodeAt(2), 0x02);
			assert.equal(contents.charCodeAt(3), 0xFF);
		});

		it("should read binary contents with maxLength using getBinaryContentsAsync()", async function () {
			let filePath = PathUtils.join(tmpDir, 'test-binary-max.bin');
			await IOUtils.write(filePath, new Uint8Array([0x10, 0x20, 0x30, 0x40, 0x50]));

			let contents = await evalInScope(`Zotero.File.getBinaryContentsAsync(${JSON.stringify(filePath)}, 3)`);
			assert.equal(contents.length, 3);
			assert.equal(contents.charCodeAt(0), 0x10);
			assert.equal(contents.charCodeAt(1), 0x20);
			assert.equal(contents.charCodeAt(2), 0x30);
		});

		it("should create directory with createDirectoryIfMissingAsync()", async function () {
			let dirPath = PathUtils.join(tmpDir, 'new-subdir');
			await evalInScope(`Zotero.File.createDirectoryIfMissingAsync(${JSON.stringify(dirPath)})`);

			assert.isTrue(await IOUtils.exists(dirPath));
			let info = await IOUtils.stat(dirPath);
			assert.equal(info.type, 'directory');
		});

		it("should check if directory is empty with directoryIsEmpty()", async function () {
			let emptyDir = PathUtils.join(tmpDir, 'empty-dir');
			await IOUtils.makeDirectory(emptyDir, { ignoreExisting: true });

			let isEmpty = await evalInScope(`Zotero.File.directoryIsEmpty(${JSON.stringify(emptyDir)})`);
			assert.isTrue(isEmpty);

			// Add a file
			await IOUtils.writeUTF8(PathUtils.join(emptyDir, 'file.txt'), 'content');

			let isEmptyAfter = await evalInScope(`Zotero.File.directoryIsEmpty(${JSON.stringify(emptyDir)})`);
			assert.isFalse(isEmptyAfter);
		});

		it("should remove file with removeIfExists()", async function () {
			let filePath = PathUtils.join(tmpDir, 'to-remove.txt');
			await IOUtils.writeUTF8(filePath, 'delete me');

			let removed = await evalInScope(`Zotero.File.removeIfExists(${JSON.stringify(filePath)})`);
			assert.isTrue(removed);
			assert.isFalse(await IOUtils.exists(filePath));
		});

		it("should not throw for removeIfExists() on nonexistent file", async function () {
			let filePath = PathUtils.join(tmpDir, 'does-not-exist.txt');
			// Should not throw
			await evalInScope(`Zotero.File.removeIfExists(${JSON.stringify(filePath)})`);
		});

		it("should rename a file with rename()", async function () {
			let filePath = PathUtils.join(tmpDir, 'rename-original.txt');
			await IOUtils.writeUTF8(filePath, 'rename me');

			let newName = await evalInScope(`Zotero.File.rename(${JSON.stringify(filePath)}, "rename-result.txt")`);
			assert.ok(newName);
			assert.isFalse(await IOUtils.exists(filePath));
			assert.isTrue(await IOUtils.exists(PathUtils.join(tmpDir, newName)));
		});

		it("should iterate directory entries with iterateDirectory()", async function () {
			let iterDir = PathUtils.join(tmpDir, 'iter-dir');
			await IOUtils.makeDirectory(iterDir, { ignoreExisting: true });
			await IOUtils.writeUTF8(PathUtils.join(iterDir, 'a.txt'), 'aaa');
			await IOUtils.writeUTF8(PathUtils.join(iterDir, 'b.txt'), 'bbb');

			evalInScope("var _iterCount = 0");
			await evalInScope(`Zotero.File.iterateDirectory(${JSON.stringify(iterDir)}, function(entry) { _iterCount++; })`);

			assert.equal(evalInScope("_iterCount"), 2);
		});

		it("should copy directory with copyDirectory()", async function () {
			let srcDir = PathUtils.join(tmpDir, 'copy-src');
			let destDir = PathUtils.join(tmpDir, 'copy-dest');
			await IOUtils.makeDirectory(srcDir, { ignoreExisting: true });
			await IOUtils.writeUTF8(PathUtils.join(srcDir, 'file1.txt'), 'content1');
			await IOUtils.writeUTF8(PathUtils.join(srcDir, 'file2.txt'), 'content2');

			await evalInScope(`Zotero.File.copyDirectory(${JSON.stringify(srcDir)}, ${JSON.stringify(destDir)})`);

			assert.isTrue(await IOUtils.exists(PathUtils.join(destDir, 'file1.txt')));
			assert.isTrue(await IOUtils.exists(PathUtils.join(destDir, 'file2.txt')));
			let content = await IOUtils.readUTF8(PathUtils.join(destDir, 'file1.txt'));
			assert.equal(content, 'content1');
			// Source should still exist
			assert.isTrue(await IOUtils.exists(PathUtils.join(srcDir, 'file1.txt')));
		});

		it("should move file to unique name with moveToUnique()", async function () {
			let srcPath = PathUtils.join(tmpDir, 'move-unique-src.txt');
			let destPath = PathUtils.join(tmpDir, 'move-unique-dest.txt');
			await IOUtils.writeUTF8(srcPath, 'move me');
			// Create destination so unique name is generated
			await IOUtils.writeUTF8(destPath, 'existing');

			let newPath = await evalInScope(`Zotero.File.moveToUnique(${JSON.stringify(srcPath)}, ${JSON.stringify(destPath)})`);
			assert.ok(newPath);
			assert.notEqual(newPath, destPath);
			assert.isFalse(await IOUtils.exists(srcPath));
			assert.isTrue(await IOUtils.exists(newPath));
			let content = await IOUtils.readUTF8(newPath);
			assert.equal(content, 'move me');
		});

		it("should set normal file permissions with setNormalFilePermissions()", async function () {
			let filePath = PathUtils.join(tmpDir, 'perms-test.txt');
			await IOUtils.writeUTF8(filePath, 'permissions test');
			// Make it read-only first
			await IOUtils.setPermissions(filePath, 0o444);

			await evalInScope(`Zotero.File.setNormalFilePermissions(${JSON.stringify(filePath)})`);

			let info = await IOUtils.stat(filePath);
			assert.equal(info.permissions, 0o644);
		});

		it("should generate data URI with generateDataURI()", async function () {
			let filePath = PathUtils.join(tmpDir, 'datauri-test.txt');
			await IOUtils.writeUTF8(filePath, 'hello data uri');

			let dataURI = await evalInScope(`Zotero.File.generateDataURI(${JSON.stringify(filePath)}, "text/plain")`);
			assert.ok(dataURI);
			assert.isTrue(dataURI.startsWith('data:text/plain;base64,'));
		});

		it("should zip a directory with zipDirectory()", async function () {
			let zipSrcDir = PathUtils.join(tmpDir, 'zip-src');
			let zipPath = PathUtils.join(tmpDir, 'test-output.zip');
			await IOUtils.makeDirectory(zipSrcDir, { ignoreExisting: true });
			await IOUtils.writeUTF8(PathUtils.join(zipSrcDir, 'zipped.txt'), 'zip content');

			let result = await evalInScope(`Zotero.File.zipDirectory(${JSON.stringify(zipSrcDir)}, ${JSON.stringify(zipPath)})`);
			assert.isTrue(result);
			assert.isTrue(await IOUtils.exists(zipPath));
			// ZIP file should have non-zero size
			let info = await IOUtils.stat(zipPath);
			assert.isAbove(info.size, 0);
		});

		it("should return false from zipDirectory() for empty directory", async function () {
			let zipSrcDir = PathUtils.join(tmpDir, 'zip-empty-src');
			let zipPath = PathUtils.join(tmpDir, 'test-empty.zip');
			await IOUtils.makeDirectory(zipSrcDir, { ignoreExisting: true });

			let result = await evalInScope(`Zotero.File.zipDirectory(${JSON.stringify(zipSrcDir)}, ${JSON.stringify(zipPath)})`);
			assert.isFalse(result);
		});

		it("should move a directory with moveDirectory()", async function () {
			let srcDir = PathUtils.join(tmpDir, 'move-dir-src');
			let destDir = PathUtils.join(tmpDir, 'move-dir-dest');
			await IOUtils.makeDirectory(srcDir, { ignoreExisting: true });
			await IOUtils.writeUTF8(PathUtils.join(srcDir, 'moved.txt'), 'moved content');

			let errors = await evalInScope(`Zotero.File.moveDirectory(${JSON.stringify(srcDir)}, ${JSON.stringify(destDir)})`);
			assert.equal(errors.length, 0);
			assert.isTrue(await IOUtils.exists(PathUtils.join(destDir, 'moved.txt')));
			let content = await IOUtils.readUTF8(PathUtils.join(destDir, 'moved.txt'));
			assert.equal(content, 'moved content');
		});
	});

	describe("Zotero.HTTP", function () {
		var serverPath;
		var endpoints = [];

		function registerEndpoint(method, initFn) {
			let endpoint = "/test/sandbox-http/" + Zotero.Utilities.randomString();
			let handler = function () {};
			handler.prototype = {
				supportedMethods: [method],
				supportedDataTypes: "*",
				// Server dispatches based on init.length; must be 1 for single-param endpoint
				init(options) {
					return initFn(options);
				}
			};
			Zotero.Server.Endpoints[endpoint] = handler;
			endpoints.push(endpoint);
			return serverPath + endpoint;
		}

		before(function () {
			serverPath = 'http://127.0.0.1:' + Zotero.Server.port;
		});

		afterEach(function () {
			for (let ep of endpoints) {
				delete Zotero.Server.Endpoints[ep];
			}
			endpoints = [];
		});

		beforeEach(function () {
			loadTestScope(["default", "network"]);
		});

		it("should make a GET request and return status and response text", async function () {
			let url = registerEndpoint("GET", function () {
				return [200, "text/plain", "sandbox GET response"];
			});

			let result = await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text'
				}).then(req => ({ status: req.status, text: req.responseText }))
			`);
			assert.equal(result.status, 200);
			assert.equal(result.text, "sandbox GET response");
		});

		it("should make a POST request with a JSON body", async function () {
			let receivedData;
			let url = registerEndpoint("POST", function (options) {
				// Server auto-parses JSON bodies
				receivedData = options.data;
				return [201, "text/plain", "created"];
			});

			let status = await evalInScope(`
				Zotero.HTTP.request('POST', ${JSON.stringify(url)}, {
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ message: 'from sandbox' }),
					responseType: 'text'
				}).then(req => req.status)
			`);
			assert.equal(status, 201);
			assert.equal(receivedData.message, 'from sandbox');
		});

		it("should send custom headers with the request", async function () {
			let receivedHeaders;
			let url = registerEndpoint("GET", function (options) {
				receivedHeaders = options.headers;
				return [200, "text/plain", "ok"];
			});

			await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					headers: { 'X-Custom-Header': 'sandbox-test-value' },
					responseType: 'text'
				})
			`);
			assert.equal(receivedHeaders['X-Custom-Header'], 'sandbox-test-value');
		});

		it("should handle JSON response type", async function () {
			let url = registerEndpoint("GET", function () {
				return [200, "application/json", JSON.stringify({ key: "value", num: 42 })];
			});

			let response = await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'json'
				}).then(req => req.response)
			`);
			assert.equal(response.key, "value");
			assert.equal(response.num, 42);
		});

		it("should handle non-200 success status codes", async function () {
			let url = registerEndpoint("GET", function () {
				return 204;
			});

			let status = await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text'
				}).then(req => req.status)
			`);
			assert.equal(status, 204);
		});

		it("should reject on error status codes", async function () {
			let url = registerEndpoint("GET", function () {
				return [400, "text/plain", "bad request"];
			});

			let rejected = await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text'
				}).then(() => false, () => true)
			`);
			assert.isTrue(rejected, "Request with 400 status should reject");
		});

		it("should accept successCodes option to treat non-2xx as success", async function () {
			let url = registerEndpoint("GET", function () {
				return [404, "text/plain", "not found"];
			});

			let result = await evalInScope(`
				Zotero.HTTP.request('GET', ${JSON.stringify(url)}, {
					responseType: 'text',
					successCodes: [404]
				}).then(req => ({ status: req.status, text: req.responseText }))
			`);
			assert.equal(result.status, 404);
			assert.equal(result.text, "not found");
		});

		it("should POST JSON body and receive JSON response", async function () {
			let receivedData;
			let url = registerEndpoint("POST", function (options) {
				receivedData = options.data;
				return [200, "application/json", JSON.stringify({ received: true })];
			});

			let response = await evalInScope(`
				Zotero.HTTP.request('POST', ${JSON.stringify(url)}, {
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: 'Test', count: 3 }),
					responseType: 'json'
				}).then(req => req.response)
			`);
			assert.isTrue(response.received);
			assert.equal(receivedData.title, 'Test');
			assert.equal(receivedData.count, 3);
		});

		it("should expose Zotero.HTTP.processDocuments()", function () {
			assert.isTrue(evalInScope("typeof Zotero.HTTP.processDocuments === 'function'"));
		});

		it("should fetch and process an HTML document with processDocuments()", async function () {
			let url = registerEndpoint("GET", function () {
				return [200, "text/html", "<html><head><title>Sandbox Doc</title></head><body><p>Hello</p></body></html>"];
			});

			let result = await evalInScope(`
				Zotero.HTTP.processDocuments(${JSON.stringify(url)}, function (doc, responseURL) {
					return responseURL;
				}).then(results => results[0])
			`);
			assert.include(result, "/test/sandbox-http/");
		});
	});

	describe("Zotero.Notifier", function () {
		// Register a sentinel observer on the chrome side with lower priority (higher number)
		// so it runs AFTER the sandbox observer. Awaiting the returned promise guarantees
		// all higher-priority observers (including the sandbox one) have finished.
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
			loadTestScope(["default", "data"]);
		});

		afterEach(function () {
			// Clean up any leftover observers
			try {
				let id = evalInScope("typeof _observerID !== 'undefined' && _observerID");
				if (id) {
					Zotero.Notifier.unregisterObserver(id);
				}
			}
			// eslint-disable-next-line no-unused-vars
			catch (e) {}
		});

		it("should register and unregister an observer", function () {
			evalInScope(`
				var _observerID = Zotero.Notifier.registerObserver(
					{ notify: function(event, type, ids) {} },
					['item'],
					'test-sandbox'
				);
			`);

			let observerID = evalInScope("_observerID");
			assert.ok(observerID);
			assert.isString(observerID);

			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
		});

		it("should receive notifications when an item is added", async function () {
			evalInScope(`
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

			assert.equal(evalInScope("_notifyEvent"), 'add');
			assert.equal(evalInScope("_notifyType"), 'item');
			assert.isAbove(evalInScope("_notifyIDsLength"), 0, "ids should have length");
			assert.equal(evalInScope("_notifyFirstID"), item.id, "ids should contain the item ID");

			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
			await item.eraseTx();
		});

		it("should receive notifications when an item is modified", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Before Modify');
			await item.saveTx();

			evalInScope(`
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

			assert.equal(evalInScope("_modifyFirstID"), item.id, "Should have received modify event with item ID");

			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
			await item.eraseTx();
		});

		it("should receive notifications when an item is trashed", async function () {
			let item = new Zotero.Item('book');
			item.setField('title', 'Trash Test');
			await item.saveTx();

			evalInScope(`
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

			assert.equal(evalInScope("_trashFirstID"), item.id, "Should have received trash event with item ID");

			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
			await item.eraseTx();
		});

		it("should only receive notifications for subscribed types", async function () {
			evalInScope(`
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

			assert.isFalse(evalInScope("_collectionNotified"), "Item add should not trigger collection observer");

			// Create a collection -- should trigger it
			let collectionPromise = waitForNotify(['collection']);
			let collection = new Zotero.Collection();
			collection.name = "Notifier Type Filter Test";
			await collection.saveTx();
			await collectionPromise;

			assert.isTrue(evalInScope("_collectionNotified"), "Collection add should trigger collection observer");

			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
			await item.eraseTx();
			await collection.eraseTx();
		});

		it("should not receive notifications after unregistering", async function () {
			evalInScope(`
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
			let countBefore = evalInScope("_postUnregCount");
			assert.isAbove(countBefore, 0);

			// Unregister
			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
			evalInScope("_postUnregCount = 0");

			// Create another item -- should NOT trigger
			// Use sentinel to ensure notifications have been fully dispatched
			let promise2 = waitForNotify(['item']);
			let item2 = new Zotero.Item('book');
			await item2.saveTx();
			await promise2;

			assert.equal(evalInScope("_postUnregCount"), 0, "Should not receive notifications after unregistering");

			await item1.eraseTx();
			await item2.eraseTx();
		});

		it("should receive extraData in notifications", async function () {
			evalInScope(`
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

			let extra = evalInScope("_deleteExtra");
			assert.ok(extra, "extraData should be provided on delete");
			// extraData is keyed by item ID
			assert.ok(extra[itemID], "extraData should contain deleted item ID");

			evalInScope("Zotero.Notifier.unregisterObserver(_observerID)");
		});
	});

	describe("Zotero.Translators", function () {
		beforeEach(function () {
			loadTestScope(["default", "translator"]);
		});

		it("should expose Zotero.Translators.getAll()", async function () {
			assert.isTrue(evalInScope("typeof Zotero.Translators.getAll === 'function'"));
			let translators = await evalInScope("Zotero.Translators.getAll()");
			assert.isArray(translators);
		});

		it("should construct a new Zotero.Translate.Import", function () {
			evalInScope(`
				var _ti = new Zotero.Translate.Import();
				var _tiType = _ti.type;
			`);
			let type = evalInScope("_tiType");
			assert.equal(type, 'import');
		});

		it("should construct a new Zotero.Translate.Search", function () {
			evalInScope(`
				var _ts = new Zotero.Translate.Search();
				var _tsType = _ts.type;
			`);
			let type = evalInScope("_tsType");
			assert.equal(type, 'search');
		});

		it("should construct a new Zotero.Translate.Web", function () {
			evalInScope(`
				var _tw = new Zotero.Translate.Web();
				var _twType = _tw.type;
			`);
			let type = evalInScope("_twType");
			assert.equal(type, 'web');
		});

		it("should import an item via Translate.Import facade", async function () {
			let translator = buildDummyTranslator("import",
				'function doImport() {'
				+ '  var item = new Zotero.Item("book");'
				+ '  item.title = "Sandbox Import Test";'
				+ '  item.complete();'
				+ '}');
			Cu.exportFunction(() => translator, scope, { defineAs: "_getTestTranslator" });

			let count = await evalInScope(`
				var _ti2 = new Zotero.Translate.Import();
				_ti2.setString("");
				_ti2.setTranslator(_getTestTranslator());
				_ti2.translate().then(items => items.length);
			`);
			assert.equal(count, 1);
		});

		it("should call itemDone handler during Translate.Import", async function () {
			let translator = buildDummyTranslator("import",
				'function doImport() {'
				+ '  var item = new Zotero.Item("journalArticle");'
				+ '  item.title = "Handler Test Article";'
				+ '  item.complete();'
				+ '}');
			Cu.exportFunction(() => translator, scope, { defineAs: "_getHandlerTranslator" });

			let handlerCount = await evalInScope(`
				var _handlerCount = 0;
				var _ti3 = new Zotero.Translate.Import();
				_ti3.setString("");
				_ti3.setTranslator(_getHandlerTranslator());
				_ti3.setHandler('itemDone', function() { _handlerCount++; });
				_ti3.translate().then(function() { return _handlerCount; });
			`);
			assert.equal(handlerCount, 1);
		});

		it("should set search and retrieve translators on Translate.Search", async function () {
			let len = await evalInScope(`
				var _ts2 = new Zotero.Translate.Search();
				_ts2.setSearch({ itemType: 'journalArticle', DOI: '10.1234/test' });
				_ts2.getTranslators().then(function(t) {
					return t.length;
				});
			`);
			assert.isNumber(len);
			if (len > 0) {
				let label = await evalInScope(`
					_ts2.getTranslators().then(function(t) {
						return t[0].label;
					});
				`);
				assert.isString(label);
			}
		});

		it("should set identifier and retrieve translators on Translate.Search", async function () {
			let len = await evalInScope(`
				var _ts3 = new Zotero.Translate.Search();
				_ts3.setIdentifier({ DOI: '10.1234/test' });
				_ts3.getTranslators().then(function(t) {
					return t.length;
				});
			`);
			assert.isNumber(len);
			if (len > 0) {
				let label = await evalInScope(`
					_ts3.getTranslators().then(function(t) {
						return t[0].label;
					});
				`);
				assert.isString(label);
			}
		});

		it("should clear handlers so they do not fire", async function () {
			let translator = buildDummyTranslator("import",
				'function doImport() {'
				+ '  var item = new Zotero.Item("book");'
				+ '  item.title = "Clear Handler Test";'
				+ '  item.complete();'
				+ '}');
			Cu.exportFunction(() => translator, scope, { defineAs: "_getClearTranslator" });

			let handlerCount = await evalInScope(`
				var _clearCount = 0;
				var _ti4 = new Zotero.Translate.Import();
				_ti4.setString("");
				_ti4.setTranslator(_getClearTranslator());
				_ti4.setHandler('itemDone', function() { _clearCount++; });
				_ti4.clearHandlers('itemDone');
				_ti4.translate().then(function() { return _clearCount; });
			`);
			assert.equal(handlerCount, 0);
		});

		it("should not expose Translators without translator permission", function () {
			PluginSandbox.unloadScope(ADDON_ID);
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.Translators === 'undefined'"),
				"Translators should not be exposed without translator permission");
		});
	});

	describe("Zotero.Prefs", function () {
		let testPrefKeys = [];

		beforeEach(function () {
			loadTestScope(["default", "preferences"]);
		});

		afterEach(function () {
			// Clean up test prefs
			for (let key of testPrefKeys) {
				try {
					Zotero.Prefs.clear(key);
				}
				// eslint-disable-next-line no-unused-vars
				catch (e) {}
			}
			testPrefKeys = [];
			// Clean up sandbox pref observer if registered
			try {
				let id = evalInScope("typeof _prefObsID !== 'undefined' && _prefObsID");
				if (id) {
					Zotero.Prefs.unregisterObserver(id);
				}
			}
			// eslint-disable-next-line no-unused-vars
			catch (e) {}
		});

		it("should set and get a string pref", function () {
			let key = 'test.sandbox.stringPref';
			testPrefKeys.push(key);
			evalInScope(`Zotero.Prefs.set('${key}', 'hello world')`);
			let val = evalInScope(`Zotero.Prefs.get('${key}')`);
			assert.equal(val, 'hello world');
		});

		it("should set and get an integer pref", function () {
			let key = 'test.sandbox.intPref';
			testPrefKeys.push(key);
			evalInScope(`Zotero.Prefs.set('${key}', 42)`);
			let val = evalInScope(`Zotero.Prefs.get('${key}')`);
			assert.strictEqual(val, 42);
		});

		it("should set and get a boolean pref", function () {
			let key = 'test.sandbox.boolPref';
			testPrefKeys.push(key);
			evalInScope(`Zotero.Prefs.set('${key}', true)`);
			assert.strictEqual(evalInScope(`Zotero.Prefs.get('${key}')`), true);

			evalInScope(`Zotero.Prefs.set('${key}', false)`);
			assert.strictEqual(evalInScope(`Zotero.Prefs.get('${key}')`), false);
		});

		it("should overwrite a pref with a new value", function () {
			let key = 'test.sandbox.overwrite';
			testPrefKeys.push(key);
			evalInScope(`Zotero.Prefs.set('${key}', 'first')`);
			assert.equal(evalInScope(`Zotero.Prefs.get('${key}')`), 'first');

			evalInScope(`Zotero.Prefs.set('${key}', 'second')`);
			assert.equal(evalInScope(`Zotero.Prefs.get('${key}')`), 'second');
		});

		it("should clear a pref", function () {
			let key = 'test.sandbox.clearPref';
			testPrefKeys.push(key);
			evalInScope(`Zotero.Prefs.set('${key}', 'toBeCleared')`);
			assert.equal(evalInScope(`Zotero.Prefs.get('${key}')`), 'toBeCleared');

			evalInScope(`Zotero.Prefs.clear('${key}')`);
			// After clearing, get should return undefined (no default exists)
			let val = evalInScope(`Zotero.Prefs.get('${key}')`);
			assert.isUndefined(val);
		});

		it("should reflect prefs set from sandbox in chrome and vice versa", function () {
			let key = 'test.sandbox.crossScope';
			testPrefKeys.push(key);

			// Set from sandbox, read from chrome
			evalInScope(`Zotero.Prefs.set('${key}', 'fromSandbox')`);
			assert.equal(Zotero.Prefs.get(key), 'fromSandbox');

			// Set from chrome, read from sandbox
			Zotero.Prefs.set(key, 'fromChrome');
			assert.equal(evalInScope(`Zotero.Prefs.get('${key}')`), 'fromChrome');
		});

		it("should register and unregister a pref observer", function () {
			let key = 'test.sandbox.obsReg';
			testPrefKeys.push(key);

			evalInScope(`
				var _prefObsID = Zotero.Prefs.registerObserver(
					'${key}',
					function(newValue) {}
				);
			`);

			let obsID = evalInScope("_prefObsID");
			assert.ok(obsID, "registerObserver should return a truthy value");

			// Should not throw
			evalInScope("Zotero.Prefs.unregisterObserver(_prefObsID)");
		});

		it("should receive observer callback on pref change", function () {
			let key = 'test.sandbox.obsChange';
			testPrefKeys.push(key);

			evalInScope(`
				var _prefNewValue = undefined;
				var _prefObsID = Zotero.Prefs.registerObserver(
					'${key}',
					function(newValue) { _prefNewValue = newValue; }
				);
			`);

			// Change from chrome side -- callback should fire in sandbox
			Zotero.Prefs.set(key, 'observed');

			assert.equal(evalInScope("_prefNewValue"), 'observed');

			evalInScope("Zotero.Prefs.unregisterObserver(_prefObsID)");
		});

		it("should receive updated value on each pref change", function () {
			let key = 'test.sandbox.obsMulti';
			testPrefKeys.push(key);

			evalInScope(`
				var _prefChangeCount = 0;
				var _prefLatestValue = undefined;
				var _prefObsID = Zotero.Prefs.registerObserver(
					'${key}',
					function(newValue) {
						_prefChangeCount++;
						_prefLatestValue = newValue;
					}
				);
			`);

			Zotero.Prefs.set(key, 'first');
			assert.equal(evalInScope("_prefLatestValue"), 'first');

			Zotero.Prefs.set(key, 'second');
			assert.equal(evalInScope("_prefLatestValue"), 'second');

			assert.isAtLeast(evalInScope("_prefChangeCount"), 2);

			evalInScope("Zotero.Prefs.unregisterObserver(_prefObsID)");
		});

		it("should not receive observer callback after unregistering", function () {
			let key = 'test.sandbox.obsUnreg';
			testPrefKeys.push(key);

			evalInScope(`
				var _prefObsCount = 0;
				var _prefObsID = Zotero.Prefs.registerObserver(
					'${key}',
					function(newValue) { _prefObsCount++; }
				);
			`);

			Zotero.Prefs.set(key, 'before');
			let countBefore = evalInScope("_prefObsCount");
			assert.isAbove(countBefore, 0);

			evalInScope("Zotero.Prefs.unregisterObserver(_prefObsID)");
			evalInScope("_prefObsCount = 0");

			Zotero.Prefs.set(key, 'after');
			assert.equal(evalInScope("_prefObsCount"), 0, "Should not receive callback after unregistering");
		});

		it("should observe integer pref changes", function () {
			let key = 'test.sandbox.obsInt';
			testPrefKeys.push(key);
			Zotero.Prefs.set(key, 0);

			evalInScope(`
				var _prefIntValue = undefined;
				var _prefObsID = Zotero.Prefs.registerObserver(
					'${key}',
					function(newValue) { _prefIntValue = newValue; }
				);
			`);

			Zotero.Prefs.set(key, 99);
			assert.strictEqual(evalInScope("_prefIntValue"), 99);

			evalInScope("Zotero.Prefs.unregisterObserver(_prefObsID)");
		});

		it("should observe boolean pref changes", function () {
			let key = 'test.sandbox.obsBool';
			testPrefKeys.push(key);
			Zotero.Prefs.set(key, false);

			evalInScope(`
				var _prefBoolValue = undefined;
				var _prefObsID = Zotero.Prefs.registerObserver(
					'${key}',
					function(newValue) { _prefBoolValue = newValue; }
				);
			`);

			Zotero.Prefs.set(key, true);
			assert.strictEqual(evalInScope("_prefBoolValue"), true);

			evalInScope("Zotero.Prefs.unregisterObserver(_prefObsID)");
		});

		it("should resetBranch clearing test prefs", function () {
			let key1 = 'test.sandbox.reset1';
			let key2 = 'test.sandbox.reset2';
			testPrefKeys.push(key1, key2);

			evalInScope(`Zotero.Prefs.set('${key1}', 'val1')`);
			evalInScope(`Zotero.Prefs.set('${key2}', 'val2')`);
			assert.equal(evalInScope(`Zotero.Prefs.get('${key1}')`), 'val1');
			assert.equal(evalInScope(`Zotero.Prefs.get('${key2}')`), 'val2');

			evalInScope("Zotero.Prefs.resetBranch([], 'extensions.zotero.test.sandbox.reset')");

			assert.isUndefined(evalInScope(`Zotero.Prefs.get('${key1}')`));
			assert.isUndefined(evalInScope(`Zotero.Prefs.get('${key2}')`));
		});
	});

	describe("Zotero Plugin APIs", function () {
		var pluginWin;

		before(async function () {
			pluginWin = await loadZoteroPane();
		});

		after(function () {
			pluginWin.close();
		});

		beforeEach(function () {
			loadTestScope(["default", "itemTree", "itemPane", "menu", "reader"]);
		});

		describe("ItemTreeManager", function () {
			it("should register a column with dataProvider from sandbox", async function () {
				// Store return value in sandbox variable to avoid CSS.escape backslash issues
				evalInScope(`
					var _colDataKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-col',
						label: 'Sandbox Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function(item, dataKey) {
							return 'sandbox-data-' + item.id;
						}
					});
				`);
				let dataKey = evalInScope("_colDataKey");

				assert.isString(dataKey, "registerColumn should return a string dataKey");

				// Verify the column appears in getCustomColumns
				let columns = Zotero.ItemTreeManager.getCustomColumns();
				let found = columns.find(c => c.dataKey === dataKey);
				assert.ok(found, "Column should appear in getCustomColumns");
				assert.equal(found.label, 'Sandbox Column');

				// Verify dataProvider callback works across compartments
				let item = new Zotero.Item('book');
				item.setField('title', 'Column Test');
				await item.saveTx();

				let cellData = Zotero.ItemTreeManager.getCustomCellData(item, dataKey);
				assert.equal(cellData, 'sandbox-data-' + item.id,
					"dataProvider should return correct data when called from chrome");

				// Unregister using sandbox-side variable
				let success = evalInScope("Zotero.ItemTreeManager.unregisterColumn(_colDataKey)");
				assert.isTrue(success, "unregisterColumn should return true");

				// Verify it's gone
				columns = Zotero.ItemTreeManager.getCustomColumns();
				found = columns.find(c => c.dataKey === dataKey);
				assert.notOk(found, "Column should be gone after unregister");

				await item.eraseTx();
			});

			it("should handle dataProvider errors gracefully", async function () {
				evalInScope(`
					var _errColDataKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-err-col',
						label: 'Error Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function(item, dataKey) {
							throw new Error("Sandbox dataProvider error");
						}
					});
				`);
				let dataKey = evalInScope("_errColDataKey");
				assert.isString(dataKey);

				let item = new Zotero.Item('book');
				await item.saveTx();

				// Should return fallback instead of throwing
				// (fallbackReturn is "" but "" || null → null in pluginAPIBase)
				let cellData = Zotero.ItemTreeManager.getCustomCellData(item, dataKey);
				assert.isNull(cellData, "Should return null fallback on error");

				evalInScope("Zotero.ItemTreeManager.unregisterColumn(_errColDataKey)");
				await item.eraseTx();
			});

			it("should reject duplicate dataKey registration", function () {
				evalInScope(`
					var _dupColDataKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-dup-col',
						label: 'First Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function(item) { return '1'; }
					});
				`);
				assert.isString(evalInScope("_dupColDataKey"));

				// Second registration with same dataKey should fail
				let dataKey2 = evalInScope(`
					Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-dup-col',
						label: 'Duplicate Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function(item) { return '2'; }
					});
				`);
				assert.isFalse(dataKey2, "Duplicate registration should return false");

				evalInScope("Zotero.ItemTreeManager.unregisterColumn(_dupColDataKey)");
			});

			it("should pass a safe document to renderCell", function () {
				// Register a column with renderCell that probes doc restrictions
				evalInScope(`
					var _renderResults = {};
					var _renderColKey = Zotero.ItemTreeManager.registerColumn({
						dataKey: 'sandbox-render-col',
						label: 'Render Column',
						pluginID: '${ADDON_ID}',
						dataProvider: function(item, dataKey) { return 'test'; },
						renderCell: function(index, data, column, isFirstColumn, doc) {
							_renderResults.hasDoc = !!doc;
							_renderResults.typeofDoc = typeof doc;
							// Safe document should expose createElement
							_renderResults.hasCreateElement = typeof doc.createElement === 'function';
							_renderResults.hasCreateXULElement = typeof doc.createXULElement === 'function';
							// Safe document should not expose querySelector, getElementById, etc.
							_renderResults.hasQuerySelector = typeof doc.querySelector === 'function';
							_renderResults.hasGetElementById = typeof doc.getElementById === 'function';
							_renderResults.hasDocumentElement = typeof doc.documentElement !== 'undefined';
							// Create an element and return it
							var span = doc.createElement('span');
							_renderResults.createdTag = span.tagName;
							return span;
						}
					});
				`);
				let dataKey = evalInScope("_renderColKey");
				assert.isString(dataKey);
				let option = Zotero.ItemTreeManager._columnManager._optionsCache[dataKey];
				let renderCell = option.renderCell;

				try {
					// Invoke renderCell with a real document
					renderCell(0, 'test', { className: 'test-col' }, false, pluginWin.document);

					assert.isTrue(evalInScope("_renderResults.hasDoc"),
						"doc should be accessible");
					assert.isTrue(evalInScope("_renderResults.hasCreateElement"),
						"createElement should be exposed on safe document");
					assert.isTrue(evalInScope("_renderResults.hasCreateXULElement"),
						"createXULElement should be exposed on safe document");
					assert.isFalse(evalInScope("_renderResults.hasQuerySelector"),
						"querySelector should not be exposed on safe document");
					assert.isFalse(evalInScope("_renderResults.hasGetElementById"),
						"getElementById should not be exposed on safe document");
					assert.isFalse(evalInScope("_renderResults.hasDocumentElement"),
						"documentElement should not be exposed on safe document");
					assert.equal(evalInScope("_renderResults.createdTag"), "span",
						"createElement should return elements");
				}
				finally {
					evalInScope("Zotero.ItemTreeManager.unregisterColumn(_renderColKey)");
				}
			});
		});

		describe("ItemPaneManager", function () {
			it("should register an info row with onGetData from sandbox", async function () {
				evalInScope(`
					var _rowID = Zotero.ItemPaneManager.registerInfoRow({
						rowID: 'sandbox-row',
						pluginID: '${ADDON_ID}',
						label: { l10nID: 'general-print' },
						onGetData: function({ item }) {
							return 'row-data-' + item.id;
						}
					});
				`);
				let rowID = evalInScope("_rowID");

				assert.isString(rowID, "registerInfoRow should return a string rowID");

				// Verify the onGetData callback works across compartments
				let onGetData = Zotero.ItemPaneManager.getInfoRowHook(rowID, 'onGetData');
				assert.isFunction(onGetData, "onGetData hook should be accessible");

				let item = new Zotero.Item('book');
				item.setField('title', 'InfoRow Test');
				await item.saveTx();

				let result = onGetData({ item });
				assert.equal(result, 'row-data-' + item.id,
					"onGetData should return correct data when called from chrome");

				// Unregister using sandbox-side variable
				let success = evalInScope("Zotero.ItemPaneManager.unregisterInfoRow(_rowID)");
				assert.isTrue(success, "unregisterInfoRow should return true");

				// Verify it's gone
				let hook = Zotero.ItemPaneManager.getInfoRowHook(rowID, 'onGetData');
				assert.isUndefined(hook, "Hook should be gone after unregister");

				await item.eraseTx();
			});

			it("should handle onGetData errors gracefully", async function () {
				evalInScope(`
					var _errRowID = Zotero.ItemPaneManager.registerInfoRow({
						rowID: 'sandbox-err-row',
						pluginID: '${ADDON_ID}',
						label: { l10nID: 'general-print' },
						onGetData: function({ item }) {
							throw new Error("Sandbox onGetData error");
						}
					});
				`);
				let rowID = evalInScope("_errRowID");
				assert.isString(rowID);

				let onGetData = Zotero.ItemPaneManager.getInfoRowHook(rowID, 'onGetData');
				let item = new Zotero.Item('book');
				await item.saveTx();

				// Should return fallback instead of throwing
				let result = onGetData({ item });
				assert.isNull(result, "Should return null fallback on error");

				evalInScope("Zotero.ItemPaneManager.unregisterInfoRow(_errRowID)");
				await item.eraseTx();
			});

			it("should restrict section body to its own subtree via rootNode", function () {
				// Register a section with onRender that probes body restrictions
				evalInScope(`
					var _sectionResults = {};
					var _sectionID = Zotero.ItemPaneManager.registerSection({
						paneID: 'sandbox-restrict-section',
						pluginID: '${ADDON_ID}',
						header: { l10nID: 'general-print', icon: 'chrome://zotero/skin/16/universal/empty.png' },
						sidenav: { l10nID: 'general-print', icon: 'chrome://zotero/skin/20/universal/empty.png' },
						onRender: function({ body, doc }) {
							_sectionResults.hasBody = !!body;
							_sectionResults.bodyTag = body.tagName;
							// parentNode is outside rootNode subtree -- should be null
							_sectionResults.parentNode = body.parentNode;
							// ownerGlobal is blocked
							try {
								body.ownerGlobal;
								_sectionResults.ownerGlobal = 'accessible';
							} catch(e) {
								_sectionResults.ownerGlobal = 'blocked';
							}
							// ownerDocument returns a safe document
							_sectionResults.hasDocument = typeof body.ownerDocument === 'object';
							// child within subtree should be accessible
							var child = doc.createElement('span');
							body.appendChild(child);
							_sectionResults.childCount = body.childElementCount;
							_sectionResults.childTag = body.firstElementChild
								? body.firstElementChild.tagName : null;
						}
					});
				`);
				let paneID = evalInScope("_sectionID");
				assert.isString(paneID);
				let option = Zotero.ItemPaneManager._sectionManager._optionsCache[paneID];
				let onRender = option.onRender;

				// Build DOM: container > body (body is the rootNode)
				let container = pluginWin.document.createElement('div');
				let body = pluginWin.document.createElement('div');
				container.appendChild(body);
				pluginWin.document.documentElement.appendChild(container);

				let item = new Zotero.Item('book');

				try {
					// Invoke the wrapped onRender with mock section args
					onRender({
						paneID,
						doc: pluginWin.document,
						body,
						item,
						tabType: 'library',
						editable: false,
						setL10nArgs: () => {},
						setEnabled: () => {},
						setSectionSummary: () => {},
						setSectionButtonStatus: () => {},
					});

					assert.isTrue(evalInScope("_sectionResults.hasBody"),
						"body should be accessible");
					assert.equal(evalInScope("_sectionResults.bodyTag"), "div");
					assert.isNull(evalInScope("_sectionResults.parentNode"),
						"parentNode should be null (outside rootNode subtree)");
					assert.equal(evalInScope("_sectionResults.ownerGlobal"), "blocked",
						"ownerGlobal should be blocked");
					assert.isTrue(evalInScope("_sectionResults.hasDocument"),
						"ownerDocument should be a safe document");
					assert.equal(evalInScope("_sectionResults.childCount"), 1,
						"children within subtree should be accessible");
					assert.equal(evalInScope("_sectionResults.childTag"), "span",
						"child element tag should be correct");
				}
				finally {
					container.remove();
					evalInScope("Zotero.ItemPaneManager.unregisterSection(_sectionID)");
				}
			});
		});

		describe("MenuManager", function () {
			it("should register a menu with callbacks from sandbox", function () {
				evalInScope(`
					var _menuID = Zotero.MenuManager.registerMenu({
						menuID: 'sandbox-menu',
						pluginID: '${ADDON_ID}',
						target: 'main/library/item',
						menus: [{
							menuType: 'menuitem',
							l10nID: 'general-print',
							onCommand: function(event, context) {
								return 'sandbox-command';
							},
							onShowing: function(event, context) {
								return 'sandbox-showing';
							}
						}]
					});
				`);
				let menuID = evalInScope("_menuID");

				assert.isString(menuID, "registerMenu should return a string menuID");

				// Verify the menu is stored with wrapped callbacks
				let option = Zotero.MenuManager._menuManager._optionsCache[menuID];
				assert.ok(option, "Menu option should be in cache");
				assert.isFunction(option.menus[0].onCommand, "onCommand should be a function");
				assert.isFunction(option.menus[0].onShowing, "onShowing should be a function");

				// Unregister using sandbox-side variable
				let success = evalInScope("Zotero.MenuManager.unregisterMenu(_menuID)");
				assert.isTrue(success, "unregisterMenu should return true");

				// Verify it's gone
				option = Zotero.MenuManager._menuManager._optionsCache[menuID];
				assert.notOk(option, "Menu option should be gone after unregister");
			});

			it("should restrict context.menuElem to its own subtree via rootNode", function () {
				// Register a menu with onCommand that probes menuElem restrictions
				evalInScope(`
					var _restrictResults = {};
					var _restrictMenuID = Zotero.MenuManager.registerMenu({
						menuID: 'sandbox-restrict-menu',
						pluginID: '${ADDON_ID}',
						target: 'main/library/item',
						menus: [{
							menuType: 'menuitem',
							l10nID: 'general-print',
							onCommand: function(event, context) {
								var elem = context.menuElem;
								_restrictResults.hasElem = !!elem;
								_restrictResults.tagName = elem.tagName;
								// parentNode is outside rootNode subtree -- should be null
								_restrictResults.parentNode = elem.parentNode;
								// ownerGlobal is blocked
								try {
									elem.ownerGlobal;
									_restrictResults.ownerGlobal = 'accessible';
								} catch(e) {
									_restrictResults.ownerGlobal = 'blocked';
								}
								// ownerDocument returns a safe document
								_restrictResults.hasDocument = typeof elem.ownerDocument === 'object';
								// child within subtree should be accessible
								_restrictResults.childCount = elem.childElementCount;
								var firstChild = elem.firstElementChild;
								_restrictResults.childTag = firstChild
									? firstChild.tagName : null;
							}
						}]
					});
				`);
				let menuID = evalInScope("_restrictMenuID");
				let option = Zotero.MenuManager._menuManager._optionsCache[menuID];
				let onCommand = option.menus[0].onCommand;

				// Build a DOM tree: parent > menuElem > child
				let parent = pluginWin.document.createElement('div');
				let menuElem = pluginWin.document.createElement('menuitem');
				let child = pluginWin.document.createElement('label');
				menuElem.appendChild(child);
				parent.appendChild(menuElem);
				pluginWin.document.documentElement.appendChild(parent);

				try {
					// Invoke the wrapped callback with a mock context
					onCommand(null, { menuElem });

					assert.isTrue(evalInScope("_restrictResults.hasElem"),
						"menuElem should be accessible");
					assert.equal(evalInScope("_restrictResults.tagName"), "menuitem");
					assert.isNull(evalInScope("_restrictResults.parentNode"),
						"parentNode should be null (outside rootNode subtree)");
					assert.equal(evalInScope("_restrictResults.ownerGlobal"), "blocked",
						"ownerGlobal should be blocked");
					assert.isTrue(evalInScope("_restrictResults.hasDocument"),
						"ownerDocument should be a safe document");
					assert.equal(evalInScope("_restrictResults.childCount"), 1,
						"children within subtree should be accessible");
					assert.equal(evalInScope("_restrictResults.childTag"), "label",
						"child element tag should be correct");
				}
				finally {
					parent.remove();
					evalInScope("Zotero.MenuManager.unregisterMenu(_restrictMenuID)");
				}
			});
		});

		describe("Reader", function () {
			it("should expose Reader.registerEventListener as a function", function () {
				assert.isTrue(evalInScope("typeof Zotero.Reader.registerEventListener === 'function'"));
			});

			it("should expose Reader.unregisterEventListener as a function", function () {
				assert.isTrue(evalInScope("typeof Zotero.Reader.unregisterEventListener === 'function'"));
			});

			it("should register and unregister an event listener", function () {
				evalInScope(`
					var _readerHandler = function(event) {};
					Zotero.Reader.registerEventListener('renderToolbar', _readerHandler, '${ADDON_ID}');
				`);

				// Verify listener was added
				let listeners = Zotero.Reader._registeredListeners.filter(
					l => l.pluginID === ADDON_ID && l.type === 'renderToolbar'
				);
				assert.equal(listeners.length, 1, "Should have one registered listener");

				// Unregister from sandbox
				evalInScope("Zotero.Reader.unregisterEventListener('renderToolbar', _readerHandler)");

				listeners = Zotero.Reader._registeredListeners.filter(
					l => l.pluginID === ADDON_ID && l.type === 'renderToolbar'
				);
				assert.equal(listeners.length, 0, "Listener should be removed after unregister");
			});

			it("should not expose unlisted Reader methods", function () {
				assert.isTrue(evalInScope("typeof Zotero.Reader.open === 'undefined'"),
					"open should not be exposed");
				assert.isTrue(evalInScope("typeof Zotero.Reader._registeredListeners === 'undefined'"),
					"_registeredListeners should not be exposed");
				assert.isTrue(evalInScope("typeof Zotero.Reader._dispatchEvent === 'undefined'"),
					"_dispatchEvent should not be exposed");
			});
		});
	});

	describe("Zotero Main Window", function () {
		var win;

		before(async function () {
			win = await loadZoteroPane();
		});

		after(function () {
			win.close();
		});

		beforeEach(function () {
			loadTestScope(["default", "mainWindow"]);
			// Store the window in a sandbox variable -- returning wrapper objects
			// across compartments via evalInScope doesn't work, so all assertions
			// must evaluate entirely inside the sandbox and return primitives.
			evalInScope("var _win = Zotero.getMainWindow()");
		});

		describe("getMainWindow / getMainWindows", function () {
			it("should expose getMainWindow as a function", function () {
				assert.isTrue(evalInScope("typeof Zotero.getMainWindow === 'function'"));
			});

			it("should expose getMainWindows as a function", function () {
				assert.isTrue(evalInScope("typeof Zotero.getMainWindows === 'function'"));
			});

			it("should return a wrapped window from getMainWindow()", function () {
				assert.isTrue(evalInScope("_win !== null && _win !== undefined"),
					"getMainWindow() should return a window");
				assert.isTrue(evalInScope("typeof _win.alert === 'function'"));
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs === 'object'"));
			});

			it("should return a wrapped window with document", function () {
				assert.isTrue(evalInScope("typeof _win.document === 'object'"));
				assert.isTrue(evalInScope("typeof _win.document.createElement === 'function'"));
				assert.isTrue(evalInScope("typeof _win.document.createXULElement === 'function'"));
				assert.isTrue(evalInScope("typeof _win.document.createElementNS === 'function'"));
			});
		});

		describe("Window APIs (WINDOW_SCHEMAS)", function () {
			it("should expose allowed WINDOW_SCHEMAS APIs", function () {
				assert.isTrue(evalInScope("typeof _win.alert === 'function'"));
				assert.isTrue(evalInScope("typeof _win.confirm === 'function'"));
				assert.isTrue(evalInScope("typeof _win.prompt === 'function'"));
				assert.isTrue(evalInScope("typeof _win.getComputedStyle === 'function'"));
				assert.isTrue(evalInScope("typeof _win.matchMedia === 'function'"));
			});

			it("should expose MozXULElement.insertFTLIfNeeded", function () {
				// MozXULElement is a class with static methods; the schema exposes
				// sub-properties, so it is wrapped as a namespace object.
				assert.isTrue(evalInScope("typeof _win.MozXULElement === 'object'"));
				assert.isTrue(evalInScope("typeof _win.MozXULElement.insertFTLIfNeeded === 'function'"));
			});

			it("matchMedia should return a usable MediaQueryList", function () {
				let expected = win.matchMedia('(prefers-color-scheme: dark)').matches;
				let matches = evalInScope("_win.matchMedia('(prefers-color-scheme: dark)').matches");
				assert.isBoolean(matches);
				assert.equal(matches, expected);
				let media = evalInScope("_win.matchMedia('(prefers-color-scheme: dark)').media");
				assert.equal(media, '(prefers-color-scheme: dark)');
			});

			it("should receive events via addEventListener on safe window", function () {
				evalInScope(`
					var _winEvtType = null;
					function _winHandler(e) { _winEvtType = e.type; }
					_win.addEventListener("test-sandbox-evt", _winHandler);
				`);
				win.dispatchEvent(new CustomEvent("test-sandbox-evt"));
				assert.equal(evalInScope("_winEvtType"), "test-sandbox-evt",
					"handler should have received the dispatched event");
			});

			it("should pass a usable Event to addEventListener callback on safe window", function () {
				evalInScope(`
					var _winEvt = {};
					_win.addEventListener("test-sandbox-evt2", function (e) {
						_winEvt.type = e.type;
						_winEvt.bubbles = e.bubbles;
						_winEvt.cancelable = e.cancelable;
						_winEvt.defaultPrevented = e.defaultPrevented;
						_winEvt.hasPreventDefault = typeof e.preventDefault === "function";
						_winEvt.hasStopPropagation = typeof e.stopPropagation === "function";
						_winEvt.detail = e.detail;
						e.preventDefault();
						_winEvt.defaultPreventedAfter = e.defaultPrevented;
					});
				`);
				win.dispatchEvent(new CustomEvent("test-sandbox-evt2", {
					bubbles: true, cancelable: true, detail: 42,
				}));
				assert.equal(evalInScope("_winEvt.type"), "test-sandbox-evt2", "type");
				assert.isTrue(evalInScope("_winEvt.bubbles"), "bubbles");
				assert.isTrue(evalInScope("_winEvt.cancelable"), "cancelable");
				assert.isFalse(evalInScope("_winEvt.defaultPrevented"), "defaultPrevented before");
				assert.isTrue(evalInScope("_winEvt.hasPreventDefault"), "preventDefault is function");
				assert.isTrue(evalInScope("_winEvt.hasStopPropagation"), "stopPropagation is function");
				assert.equal(evalInScope("_winEvt.detail"), 42, "detail from CustomEvent");
				assert.isTrue(evalInScope("_winEvt.defaultPreventedAfter"), "defaultPrevented after preventDefault()");
			});

			it("should remove listener via removeEventListener on safe window", function () {
				evalInScope(`
					var _winEvtCount = 0;
					function _winCountHandler(e) { _winEvtCount++; }
					_win.addEventListener("test-sandbox-rm", _winCountHandler);
				`);
				win.dispatchEvent(new CustomEvent("test-sandbox-rm"));
				assert.equal(evalInScope("_winEvtCount"), 1, "handler should fire once");

				evalInScope("_win.removeEventListener('test-sandbox-rm', _winCountHandler)");
				win.dispatchEvent(new CustomEvent("test-sandbox-rm"));
				assert.equal(evalInScope("_winEvtCount"), 1,
					"handler should not fire after removal");
			});

			it("should not expose dangerous window globals", function () {
				assert.isTrue(evalInScope("typeof _win.eval === 'undefined'"),
					"eval should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Function === 'undefined'"),
					"Function should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Components === 'undefined'"),
					"Components should not be exposed");
				assert.isTrue(evalInScope("typeof _win.ChromeUtils === 'undefined'"),
					"ChromeUtils should not be exposed");
			});

			it("should not expose privileged window properties", function () {
				assert.isTrue(evalInScope("typeof _win.Zotero === 'undefined'"),
					"Zotero should not be exposed via window");
			});
		});

		describe("Zotero_Tabs API", function () {
			it("should expose Zotero_Tabs as an object", function () {
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs === 'object'"));
			});

			it("should return the current tab ID via selectedID", function () {
				let selectedID = evalInScope("_win.Zotero_Tabs.selectedID");
				assert.isString(selectedID);
				assert.equal(selectedID, 'zotero-pane');
			});

			it("should return the current tab type via selectedType", function () {
				let selectedType = evalInScope("_win.Zotero_Tabs.selectedType");
				assert.isString(selectedType);
				assert.equal(selectedType, 'library');
			});

			it("should return selectedIndex as a number", function () {
				let selectedIndex = evalInScope("_win.Zotero_Tabs.selectedIndex");
				assert.isNumber(selectedIndex);
				assert.equal(selectedIndex, 0);
			});

			it("should return numTabs as at least 1", function () {
				let numTabs = evalInScope("_win.Zotero_Tabs.numTabs");
				assert.isNumber(numTabs);
				assert.isAtLeast(numTabs, 1);
			});

			it("should return tab info via getTabInfo()", function () {
				let tabType = evalInScope(`
					var _info = _win.Zotero_Tabs.getTabInfo('zotero-pane');
					_info.type;
				`);
				assert.equal(tabType, 'library');
			});

			it("should return correct result from hasContextPane()", function () {
				assert.isFalse(evalInScope("_win.Zotero_Tabs.hasContextPane('library')"),
					"library tab should not have context pane");
				assert.isTrue(evalInScope("_win.Zotero_Tabs.hasContextPane('reader')"),
					"reader tab should have context pane");
			});

			it("should parse tab type via parseTabType()", function () {
				let tabContentType = evalInScope(`
					var _parsed = _win.Zotero_Tabs.parseTabType('library');
					_parsed.tabContentType;
				`);
				assert.equal(tabContentType, 'library');
			});

			it("should select a tab without throwing", function () {
				evalInScope("_win.Zotero_Tabs.select('zotero-pane')");
				assert.equal(evalInScope("_win.Zotero_Tabs.selectedID"), 'zotero-pane');
			});

			it("should expose selectPrev, selectNext, selectLast as functions", function () {
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.selectPrev === 'function'"));
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.selectNext === 'function'"));
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.selectLast === 'function'"));
			});

			it("should expose close and rename as functions", function () {
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.close === 'function'"));
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.rename === 'function'"));
			});

			it("should not expose DOM accessor properties", function () {
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.deck === 'undefined'"),
					"deck should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.tabsMenuPanel === 'undefined'"),
					"tabsMenuPanel should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.getTabContent === 'undefined'"),
					"getTabContent should not be exposed");
			});

			it("should not expose lifecycle and session methods", function () {
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.init === 'undefined'"),
					"init should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.destroy === 'undefined'"),
					"destroy should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.notify === 'undefined'"),
					"notify should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.getState === 'undefined'"),
					"getState should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.restoreState === 'undefined'"),
					"restoreState should not be exposed");
			});

			it("should not expose internal state and hooks", function () {
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs._tabs === 'undefined'"),
					"_tabs should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.tabHooks === 'undefined'"),
					"tabHooks should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.focusOptions === 'undefined'"),
					"focusOptions should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs._update === 'undefined'"),
					"_update should not be exposed");
			});

			it("should not expose focus management methods", function () {
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.refocus === 'undefined'"),
					"refocus should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.focusFirst === 'undefined'"),
					"focusFirst should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.moveFocus === 'undefined'"),
					"moveFocus should not be exposed");
			});

			it("should not expose tab loading internals", function () {
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.add === 'undefined'"),
					"add should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.unload === 'undefined'"),
					"unload should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.markAsLoaded === 'undefined'"),
					"markAsLoaded should not be exposed");
				assert.isTrue(evalInScope("typeof _win.Zotero_Tabs.closeAll === 'undefined'"),
					"closeAll should not be exposed");
			});
		});

		describe("ZoteroPane API", function () {
			it("should expose ZoteroPane as an object", function () {
				assert.isTrue(evalInScope("typeof _win.ZoteroPane === 'object'"));
			});

			it("should return loaded as true", function () {
				assert.isTrue(evalInScope("_win.ZoteroPane.loaded"));
			});

			it("should return the selected library ID matching host", function () {
				let expected = win.ZoteroPane.getSelectedLibraryID();
				let actual = evalInScope("_win.ZoteroPane.getSelectedLibraryID()");
				assert.isNumber(actual);
				assert.equal(actual, expected);
			});

			it("should return selected items as IDs and wrapped facades", async function () {
				let item = new Zotero.Item('book');
				item.setField('title', 'ZoteroPane Selection Test');
				await item.saveTx();

				await win.ZoteroPane.selectItem(item.id);

				// As IDs
				evalInScope("var _selIDs = _win.ZoteroPane.getSelectedItems(true)");
				assert.equal(evalInScope("_selIDs.length"), 1);
				assert.equal(evalInScope("_selIDs[0]"), item.id);

				// As wrapped facades
				evalInScope(`
					var _selItems = _win.ZoteroPane.getSelectedItems();
					var _selFirstID = _selItems[0].id;
					var _selFirstTitle = _selItems[0].getField('title');
				`);
				assert.equal(evalInScope("_selFirstID"), item.id);
				assert.equal(evalInScope("_selFirstTitle"), 'ZoteroPane Selection Test');

				await item.eraseTx();
			});

			it("should return sort field and direction matching host", function () {
				let field = evalInScope("_win.ZoteroPane.getSortField()");
				let direction = evalInScope("_win.ZoteroPane.getSortDirection()");
				assert.equal(field, win.ZoteroPane.getSortField());
				assert.equal(direction, win.ZoteroPane.getSortDirection());
			});

			it("should return sorted items as IDs", function () {
				let expected = win.ZoteroPane.getSortedItems(true);
				evalInScope("var _sortedIDs = _win.ZoteroPane.getSortedItems(true)");
				assert.equal(evalInScope("_sortedIDs.length"), expected.length);
			});

			it("should return permission checks matching host", function () {
				assert.equal(
					evalInScope("_win.ZoteroPane.canEdit()"),
					win.ZoteroPane.canEdit()
				);
				assert.equal(
					evalInScope("_win.ZoteroPane.canEditLibrary()"),
					win.ZoteroPane.canEditLibrary()
				);
				assert.equal(
					evalInScope("_win.ZoteroPane.canEditFiles()"),
					win.ZoteroPane.canEditFiles()
				);
			});

			it("should select an item by ID", async function () {
				let item = new Zotero.Item('book');
				item.setField('title', 'ZoteroPane SelectItem Test');
				await item.saveTx();

				let result = await evalInScope(`_win.ZoteroPane.selectItem(${item.id})`);
				assert.isTrue(result);

				let selectedIDs = win.ZoteroPane.getSelectedItems(true);
				assert.include(selectedIDs, item.id);

				await item.eraseTx();
			});

			it("should select multiple items by IDs", async function () {
				let item1 = new Zotero.Item('book');
				await item1.saveTx();
				let item2 = new Zotero.Item('book');
				await item2.saveTx();

				let result = await evalInScope(
					`_win.ZoteroPane.selectItems([${item1.id}, ${item2.id}])`
				);
				assert.isTrue(result);

				let selectedIDs = win.ZoteroPane.getSelectedItems(true);
				assert.include(selectedIDs, item1.id);
				assert.include(selectedIDs, item2.id);

				await item1.eraseTx();
				await item2.eraseTx();
			});

			it("should expose setVirtual as a function", function () {
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.setVirtual === 'function'"));
			});

			it("should toggle item pane without throwing", function () {
				evalInScope("_win.ZoteroPane.toggleItemPane()");
				// Toggle back
				evalInScope("_win.ZoteroPane.toggleItemPane()");
			});

			it("should create a new collection and return its ID", async function () {
				let dialogPromise = waitForDialog(
					null,
					'accept',
					'chrome://zotero/content/newCollectionDialog.xhtml'
				);
				let collID = await evalInScope("_win.ZoteroPane.newCollection()");
				await dialogPromise;
				assert.isNumber(collID);

				let collection = Zotero.Collections.get(collID);
				assert.ok(collection);

				await collection.eraseTx();
			});

			it("should create a new note and return its item ID", async function () {
				let noteID = await evalInScope("_win.ZoteroPane.newNote(false, null, 'Test note')");
				assert.isNumber(noteID);

				let note = Zotero.Items.get(noteID);
				assert.ok(note);
				assert.equal(note.itemType, 'note');

				await note.eraseTx();
			});

			it("should not expose internal properties", function () {
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.itemsView === 'undefined'"),
					"itemsView should not be exposed");
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.collectionsView === 'undefined'"),
					"collectionsView should not be exposed");
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.document === 'undefined'"),
					"document should not be exposed");
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.init === 'undefined'"),
					"init should not be exposed");
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.destroy === 'undefined'"),
					"destroy should not be exposed");
			});

			it("should not expose destructive operations", function () {
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.deleteSelectedItems === 'undefined'"),
					"deleteSelectedItems should not be exposed");
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.deleteSelectedCollection === 'undefined'"),
					"deleteSelectedCollection should not be exposed");
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.emptyTrash === 'undefined'"),
					"emptyTrash should not be exposed");
			});

			it("should not expose event handlers and DOM methods", function () {
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.handleKeyDown === 'undefined'"),
					"handleKeyDown should not be exposed");
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.handleKeyPress === 'undefined'"),
					"handleKeyPress should not be exposed");
				assert.isTrue(evalInScope("typeof _win.ZoteroPane.buildItemContextMenu === 'undefined'"),
					"buildItemContextMenu should not be exposed");
			});
		});

		describe("Document safety", function () {
			it("should block creating script elements", function () {
				let threw = false;
				try {
					evalInScope("_win.document.createElement('script')");
				}
				catch {
					threw = true;
				}
				assert.isTrue(threw, "Creating script element should throw");
			});

			it("should block creating iframe elements", function () {
				let threw = false;
				try {
					evalInScope("_win.document.createElement('iframe')");
				}
				catch {
					threw = true;
				}
				assert.isTrue(threw, "Creating iframe element should throw");
			});

			it("should block creating browser elements", function () {
				let threw = false;
				try {
					evalInScope("_win.document.createElement('browser')");
				}
				catch {
					threw = true;
				}
				assert.isTrue(threw, "Creating browser element should throw");
			});

			it("should allow creating safe elements", function () {
				assert.isTrue(evalInScope("!!_win.document.createElement('div')"),
					"createElement('div') should return an element");
			});
		});
	});

	describe("Access control", function () {
		it("should not expose unlisted Zotero properties", function () {
			loadTestScope(["default"]);
			// These are internal properties not in the schema
			assert.isTrue(evalInScope("typeof Zotero.DB === 'undefined'"));
			assert.isTrue(evalInScope("typeof Zotero.Schema === 'undefined'"));
			assert.isTrue(evalInScope("typeof Zotero.Sync === 'undefined'"));
		});

		it("should not expose privileged globals", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof ChromeUtils === 'undefined'"));
			assert.isTrue(evalInScope("typeof Services === 'undefined'"));
			assert.isTrue(evalInScope("typeof IOUtils === 'undefined'"));
			assert.isTrue(evalInScope("typeof PathUtils === 'undefined'"));
		});

		it("should not allow setting listed properties on Zotero sub-objects", function () {
			loadTestScope(["default", "data"]);
			// The mirror is created with mutable: false, so setting listed props should throw
			let threw = false;
			try {
				evalInScope("Zotero.Items.get = function() {}");
			}
			catch {
				threw = true;
			}
			assert.isTrue(threw, "Setting Zotero.Items.get should throw");
			// The function should still work
			assert.isTrue(evalInScope("typeof Zotero.Items.get === 'function'"));
		});
	});

	describe("Permission isolation", function () {
		it("should not expose data APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.Items === 'undefined'"),
				"Items should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Libraries === 'undefined'"),
				"Libraries should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Collections === 'undefined'"),
				"Collections should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Groups === 'undefined'"),
				"Groups should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Tags === 'undefined'"),
				"Tags should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.ItemFields === 'undefined'"),
				"ItemFields should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.ItemTypes === 'undefined'"),
				"ItemTypes should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.CreatorTypes === 'undefined'"),
				"CreatorTypes should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Fulltext === 'undefined'"),
				"Fulltext should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Notifier === 'undefined'"),
				"Notifier should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Item === 'undefined'"),
				"Item should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Collection === 'undefined'"),
				"Collection should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Search === 'undefined'"),
				"Search should not be exposed without data permission");
			assert.isTrue(evalInScope("typeof Zotero.Duplicates === 'undefined'"),
				"Duplicates should not be exposed without data permission");
		});

		it("should not expose fileSystem APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.File === 'undefined'"),
				"File should not be exposed without fileSystem permission");
		});

		it("should not expose network APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.HTTP === 'undefined'"),
				"HTTP should not be exposed without network permission");
		});

		it("should not expose preferences APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.Prefs === 'undefined'"),
				"Prefs should not be exposed without preferences permission");
		});

		it("should not expose translator APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.Translators === 'undefined'"),
				"Translators should not be exposed without translator permission");
			assert.isTrue(evalInScope("typeof Zotero.Translate === 'undefined'"),
				"Translate should not be exposed without translator permission");
		});

		it("should not expose UI APIs with only default permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.ItemTreeManager === 'undefined'"),
				"ItemTreeManager should not be exposed without itemTree permission");
			assert.isTrue(evalInScope("typeof Zotero.ItemPaneManager === 'undefined'"),
				"ItemPaneManager should not be exposed without itemPane permission");
			assert.isTrue(evalInScope("typeof Zotero.MenuManager === 'undefined'"),
				"MenuManager should not be exposed without menu permission");
			assert.isTrue(evalInScope("typeof Zotero.Reader === 'undefined'"),
				"Reader should not be exposed without reader permission");
			assert.isTrue(evalInScope("typeof Zotero.PreferencePanes === 'undefined'"),
				"PreferencePanes should not be exposed without preferencePane permission");
		});

		it("should expose data APIs but not fileSystem with data permission", function () {
			loadTestScope(["default", "data"]);
			assert.isTrue(evalInScope("typeof Zotero.Items === 'object'"),
				"Items should be exposed with data permission");
			assert.isTrue(evalInScope("typeof Zotero.Libraries === 'object'"),
				"Libraries should be exposed with data permission");
			assert.isTrue(evalInScope("typeof Zotero.File === 'undefined'"),
				"File should not be exposed with only data permission");
			assert.isTrue(evalInScope("typeof Zotero.HTTP === 'undefined'"),
				"HTTP should not be exposed with only data permission");
		});

		it("should expose fileSystem APIs but not data with fileSystem permission", function () {
			loadTestScope(["default", "fileSystem"]);
			assert.isTrue(evalInScope("typeof Zotero.File === 'object'"),
				"File should be exposed with fileSystem permission");
			assert.isTrue(evalInScope("typeof Zotero.Items === 'undefined'"),
				"Items should not be exposed with only fileSystem permission");
		});

		it("should merge multiple permissions correctly", function () {
			loadTestScope(["default", "data", "network", "preferences", "translator"]);
			assert.isTrue(evalInScope("typeof Zotero.Items === 'object'"),
				"Items should be exposed with data permission");
			assert.isTrue(evalInScope("typeof Zotero.ItemFields === 'object'"),
				"ItemFields should be exposed with data permission");
			assert.isTrue(evalInScope("typeof Zotero.HTTP === 'object'"),
				"HTTP should be exposed with network permission");
			assert.isTrue(evalInScope("typeof Zotero.Prefs === 'object'"),
				"Prefs should be exposed with preferences permission");
			assert.isTrue(evalInScope("typeof Zotero.Translators === 'object'"),
				"Translators should be exposed with translator permission");
			assert.isTrue(evalInScope("typeof Zotero.File === 'undefined'"),
				"File should not be exposed without fileSystem permission");
			assert.isTrue(evalInScope("typeof Zotero.ItemTreeManager === 'undefined'"),
				"ItemTreeManager should not be exposed without itemTree permission");
		});

		it("should still expose default APIs (logging, platform info, window access, utilities) regardless of permissions", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof Zotero.debug === 'function'"),
				"debug should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.warn === 'function'"),
				"warn should always be exposed");
			assert.isString(evalInScope("Zotero.version"),
				"version should always be exposed");
			assert.isBoolean(evalInScope("Zotero.isMac"),
				"isMac should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.getMainWindow === 'function'"),
				"getMainWindow should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.getMainWindows === 'function'"),
				"getMainWindows should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.Utilities === 'object'"),
				"Utilities should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.Utilities.cleanDOI === 'function'"),
				"Utilities.cleanDOI should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.Date === 'object'"),
				"Date should always be exposed");
			assert.isTrue(evalInScope("typeof Zotero.Date.strToISO === 'function'"),
				"Date.strToISO should always be exposed");
		});
	});

	describe("openWindow API", function () {
		it("should not be available without 'window' permission", function () {
			loadTestScope(["default"]);
			assert.isTrue(evalInScope("typeof openWindow === 'undefined'"));
		});

		it("should be available with 'window' permission", function () {
			loadTestScope(["default", "window"]);
			assert.isTrue(evalInScope("typeof openWindow === 'function'"));
		});

		it("should reject URLs outside plugin root", function () {
			loadTestScope(["default", "window"]);
			let threw = false;
			try {
				evalInScope("openWindow('https://example.com/page.html')");
			}
			catch {
				threw = true;
			}
			assert.isTrue(threw, "Opening external URL should throw");
		});

		it("should reject absolute file:// URLs outside plugin root", function () {
			loadTestScope(["default", "window"]);
			let threw = false;
			try {
				evalInScope("openWindow('file:///etc/page.html')");
			}
			catch {
				threw = true;
			}
			assert.isTrue(threw, "Opening file:// URL should throw");
		});

		it("should reject .xhtml files", function () {
			loadTestScope(["default", "window"]);
			let threw = false;
			try {
				evalInScope("openWindow('settings.xhtml')");
			}
			catch {
				threw = true;
			}
			assert.isTrue(threw, "Opening .xhtml file should throw");
		});

		it("should reject .xul files", function () {
			loadTestScope(["default", "window"]);
			let threw = false;
			try {
				evalInScope("openWindow('dialog.xul')");
			}
			catch {
				threw = true;
			}
			assert.isTrue(threw, "Opening .xul file should throw");
		});

		it("should reject .js files", function () {
			loadTestScope(["default", "window"]);
			let threw = false;
			try {
				evalInScope("openWindow('script.js')");
			}
			catch {
				threw = true;
			}
			assert.isTrue(threw, "Opening .js file should throw");
		});

		describe("should work with real HTML file", function () {
			var tmpDir;
			var mainWin;

			function loadTestScopeWithURI(permissions) {
				let fileURI = Services.io.newURI(PathUtils.toFileURI(tmpDir) + "/");
				mockAddon = {
					id: ADDON_ID,
					name: "Test Sandbox Plugin",
					version: "1.0.0",
					syncGUID: "{00000000-0000-0000-0000-000000000002}",
					installPermissions: { permissions },
					getResourceURI() {
						return fileURI;
					}
				};
				PluginSandbox.loadScope(mockAddon);
				scope = PluginSandbox.getScope(ADDON_ID);
			}

			before(async function () {
				mainWin = await loadZoteroPane();
				tmpDir = await getTempDirectory();
				// Create a simple HTML file in the temp directory
				let htmlContent = "<!DOCTYPE html><html><head><title>Test</title></head>"
					+ "<body><div id='test-div'>Hello</div></body></html>";
				await IOUtils.writeUTF8(PathUtils.join(tmpDir, "test.html"), htmlContent);
				// Also create an XHTML file to test rejection
				await IOUtils.writeUTF8(PathUtils.join(tmpDir, "test.xhtml"), "<html></html>");
				// Create CSS and JS files for resource loading test
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "style.css"),
					"#test-div { color: rgb(255, 0, 0); }"
				);
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "script.js"),
					"document.getElementById('test-div').setAttribute('data-script-loaded', 'true');\n"
					+ "window._pluginScriptLoaded = true;"
				);
				let resourceHtml = "<!DOCTYPE html><html><head><title>Resources</title>"
					+ '<link rel="stylesheet" href="style.css">'
					+ "</head><body><div id='test-div'>Styled</div>"
					+ '<script src="script.js"></script></body></html>';
				await IOUtils.writeUTF8(PathUtils.join(tmpDir, "resources.html"), resourceHtml);
				// Create an HTML + external JS that probes privileged APIs
				await IOUtils.writeUTF8(
					PathUtils.join(tmpDir, "probe.js"),
					"var apis = ['ChromeUtils', 'Services', 'IOUtils', 'PathUtils', 'Cu', 'Cc', 'Ci', 'Zotero'];\n"
					+ "var r = document.getElementById('results');\n"
					+ "apis.forEach(function(name) {\n"
					+ "  r.setAttribute('data-' + name.toLowerCase(), typeof window[name]);\n"
					+ "});\n"
					+ "try {\n"
					+ "  Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsIFile);\n"
					+ "  r.setAttribute('data-xpcom-blocked', 'false');\n"
					+ "} catch(e) {\n"
					+ "  r.setAttribute('data-xpcom-blocked', 'true');\n"
					+ "}\n"
				);
				let privilegedProbeHtml = "<!DOCTYPE html><html><head><title>Privilege Probe</title></head>"
					+ "<body><div id='results'></div>"
					+ '<script src="probe.js"></script></body></html>';
				await IOUtils.writeUTF8(PathUtils.join(tmpDir, "privileged.html"), privilegedProbeHtml);
			});

			after(async function () {
				mainWin.close();
				await IOUtils.remove(tmpDir, { recursive: true });
			});

			it("should open an .html window and resolve with a window object", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let win = await evalInScope("openWindow('test.html')");
				try {
					assert.ok(win, "openWindow should resolve with a window");
					assert.equal(win.document.title, "Test");
				}
				finally {
					win.close();
				}
			});

			it("should call onLoad callback with the content window", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let cbkLoadPromise = new Promise((resolve) => {
					scope._resolveOnLoad = resolve;
				});
				let win = await evalInScope(`
					openWindow('test.html', '', function(w) {
						_resolveOnLoad(w);
					});
				`);
				try {
					let cbkWin = await cbkLoadPromise;
					assert.ok(cbkWin, "onLoad callback should receive a window");
					assert.equal(cbkWin.document.title, "Test");
					assert.equal(cbkWin, win, "onLoad window should be the same as the resolved window");
				}
				finally {
					win.close();
				}
			});

			it("should load relative CSS and JS resources", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let win = await evalInScope("openWindow('resources.html')");
				try {
					assert.equal(win.document.title, "Resources");
					// JS resource should have executed (check DOM attribute, not expando -- Xrays hide expandos)
					let div = win.document.getElementById("test-div");
					assert.equal(div.getAttribute("data-script-loaded"), "true", "script.js should have executed");
					// CSS resource should have been applied
					let color = win.getComputedStyle(div).color;
					assert.equal(color, "rgb(255, 0, 0)", "style.css should set color to red");
				}
				finally {
					win.close();
				}
			});

			it("should reveal content expandos via wrappedJSObject", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let win = await evalInScope("openWindow('resources.html')");
				try {
					// Xray wrappers hide expandos set by content scripts
					assert.isUndefined(win._pluginScriptLoaded, "Xray should hide expando properties");
					// wrappedJSObject waives Xrays and reveals content-set expandos
					assert.isTrue(win.wrappedJSObject._pluginScriptLoaded, "wrappedJSObject should reveal expando properties");
				}
				finally {
					win.close();
				}
			});

			it("should allow plugin scope to manipulate the DOM of the opened window", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let win = await evalInScope("openWindow('test.html')");
				try {
					// Store the window on the scope so sandbox code can reference it
					scope._testWin = win;

					// Modify existing element from plugin scope
					evalInScope("_testWin.document.getElementById('test-div').textContent = 'Modified'");
					assert.equal(
						win.document.getElementById("test-div").textContent,
						"Modified",
						"Plugin scope should be able to modify element text"
					);

					// Create and append a new element from plugin scope
					evalInScope(
						`let el = _testWin.document.createElement('p');
						el.id = 'new-el';
						el.textContent = 'Added by plugin';
						_testWin.document.body.appendChild(el);`
					);
					let newEl = win.document.getElementById("new-el");
					assert.ok(newEl, "Plugin scope should be able to append new elements");
					assert.equal(newEl.textContent, "Added by plugin");
				}
				finally {
					win.close();
				}
			});
			it("should open separate windows for each call", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let win1 = await evalInScope("openWindow('test.html')");
				let win2 = await evalInScope("openWindow('test.html')");
				try {
					assert.notEqual(win1, win2, "Each openWindow call should return a different window");
					// Mutating one should not affect the other
					win1.document.getElementById("test-div").textContent = "Window 1";
					win2.document.getElementById("test-div").textContent = "Window 2";
					assert.equal(win1.document.getElementById("test-div").textContent, "Window 1");
					assert.equal(win2.document.getElementById("test-div").textContent, "Window 2");
				}
				finally {
					win1.close();
					win2.close();
				}
			});

			it("should not expose privileged APIs in the content window", async function () {
				loadTestScopeWithURI(["default", "window"]);
				let win = await evalInScope("openWindow('privileged.html')");
				try {
					let results = win.document.getElementById("results");
					// Components is excluded -- it exists in content as a neutered object (accessing properties throws)
					let privilegedAPIs = ["chromeutils", "services", "ioutils", "pathutils", "cu", "cc", "ci", "zotero"];
					for (let api of privilegedAPIs) {
						assert.equal(
							results.getAttribute("data-" + api),
							"undefined",
							`${api} should not be accessible in plugin content window`
						);
					}
					// Components exists but is neutered -- XPCOM instantiation should be blocked
					assert.equal(
						results.getAttribute("data-xpcom-blocked"),
						"true",
						"Components.classes XPCOM instantiation should be blocked"
					);
				}
				finally {
					win.close();
				}
			});

			describe("createFrame", function () {
				var { WindowScopeVariables } = ChromeUtils.importESModule(
					"chrome://zotero/content/xpcom/plugins/variables.mjs"
				);

				function setupSafeScope() {
					scope._safeDoc = WindowScopeVariables.createSafeDocument(
						mainWin.document, ADDON_ID, {}
					);
					// Wrap container as a safe element so sandbox can call appendChild
					scope._container = WindowScopeVariables.createSafeHTMLElement(
						mainWin.document.documentElement, ADDON_ID, {}
					);
				}

				afterEach(function () {
					// Clean up any appended browser elements
					let browsers = mainWin.document.querySelectorAll('browser[type="content"][disableglobalhistory="true"]');
					for (let b of browsers) {
						b.remove();
					}
				});

				it("should load plugin content and call onLoad with contentWindow", async function () {
					loadTestScopeWithURI(["default"]);
					setupSafeScope();

					let contentWin = await evalInScope(`
						new Promise((resolve) => {
							let frame = _safeDoc.createFrame("test.html", function(win) {
								resolve(win);
							});
							_container.appendChild(frame);
						});
					`);
					assert.ok(contentWin, "createFrame should call onLoad with content window");
					assert.equal(contentWin.document.title, "Test");
					assert.equal(
						contentWin.document.getElementById("test-div").textContent,
						"Hello"
					);
				});

				it("should reject URLs outside plugin root", function () {
					loadTestScopeWithURI(["default"]);
					setupSafeScope();
					let threw = false;
					try {
						evalInScope('_safeDoc.createFrame("https://evil.com/page.html", function() {})');
					}
					catch {
						threw = true;
					}
					assert.isTrue(threw, "Should reject URLs outside plugin root");
				});

				it("should reject non-.html files", function () {
					loadTestScopeWithURI(["default"]);
					setupSafeScope();
					let threw = false;
					try {
						evalInScope('_safeDoc.createFrame("script.js", function() {})');
					}
					catch {
						threw = true;
					}
					assert.isTrue(threw, "Should reject non-.html files");
				});

				it("should not expose privileged APIs in frame content", async function () {
					loadTestScopeWithURI(["default"]);
					setupSafeScope();

					let contentWin = await evalInScope(`
						new Promise((resolve) => {
							let frame = _safeDoc.createFrame("privileged.html", function(win) {
								resolve(win);
							});
							_container.appendChild(frame);
						});
					`);
					let results = contentWin.document.getElementById("results");
					let privilegedAPIs = ["chromeutils", "services", "ioutils", "pathutils", "cu", "cc", "ci", "zotero"];
					for (let api of privilegedAPIs) {
						assert.equal(
							results.getAttribute("data-" + api),
							"undefined",
							`${api} should not be accessible in frame content`
						);
					}
				});
			});

			describe("createFrame with ItemPaneManager", function () {
				var registeredID;

				afterEach(async function () {
					if (registeredID) {
						Zotero.ItemPaneManager.unregisterSection(registeredID);
						registeredID = null;
					}
				});

				it("should embed a frame in a custom item pane section via createFrame", async function () {
					loadTestScopeWithURI(["default", "itemPane"]);

					// Set up a promise on the scope that the onLoad callback will resolve
					let frameLoadPromise = new Promise((resolve) => {
						scope._resolveFrameLoad = resolve;
					});

					// Register a custom section from the plugin scope.
					// The onRender hook uses doc.createFrame() to embed plugin HTML.
					// The onLoad callback resolves a promise with the contentWindow.
					registeredID = evalInScope(`
						Zotero.ItemPaneManager.registerSection({
							paneID: "test-createframe-section",
							pluginID: "${ADDON_ID}",
							header: {
								l10nID: "zotero-item-pane-header-title",
								icon: "chrome://zotero/skin/16/universal/note.svg",
							},
							sidenav: {
								l10nID: "zotero-item-pane-header-title",
								icon: "chrome://zotero/skin/20/universal/note.svg",
							},
							onRender: function({ doc, body }) {
								if (body.querySelector && body.querySelector('browser')) return;
								let frame = doc.createFrame("test.html", function(win) {
									_resolveFrameLoad(win);
								});
								body.appendChild(frame);
							},
						});
					`);

					assert.ok(registeredID, "Section should be registered");

					// Create an item to trigger the item pane render
					let item = await createDataObject('item');

					// Wait for the frame's onLoad callback to fire
					let contentWin = await frameLoadPromise;
					assert.ok(contentWin, "onLoad should receive a contentWindow");
					assert.equal(contentWin.document.title, "Test");
					assert.equal(
						contentWin.document.getElementById("test-div").textContent,
						"Hello"
					);

					await Zotero.Items.erase(item.id);
				});
			});
		});
	});

	describe("XHTML sanitization", function () {
		var { WindowScopeVariables } = ChromeUtils.importESModule("chrome://zotero/content/xpcom/plugins/variables.mjs");

		it("should remove unsafe elements from a fragment", function () {
			let frag = MozXULElement.parseXULToFragment(
				'<html:div id="safe">Safe</html:div>'
				+ '<html:script>alert("xss")</html:script>'
				+ '<browser src="chrome://zotero/content/zoteroPane.xhtml"/>'
				+ '<html:iframe src="about:config"></html:iframe>'
				+ '<html:p>Text</html:p>'
			);
			WindowScopeVariables.sanitizeFragment(frag);
			assert.isNull(frag.querySelector("script"), "<script> should be removed");
			assert.isNull(frag.querySelector("browser"), "<browser> should be removed");
			assert.isNull(frag.querySelector("iframe"), "<iframe> should be removed");
			assert.ok(frag.querySelector('[id="safe"]'), "<div> should remain");
			assert.ok(frag.querySelector("p"), "<p> should remain");
		});

		it("should strip on* attributes when no pluginID is provided", function () {
			let frag = MozXULElement.parseXULToFragment(
				'<html:p onclick="alert(1)" onmouseover="alert(2)">Click</html:p>'
				+ '<html:div onload="alert(3)">Div</html:div>'
			);
			WindowScopeVariables.sanitizeFragment(frag);
			let p = frag.querySelector("p");
			assert.ok(p, "<p> should remain");
			assert.isFalse(p.hasAttribute("onclick"), "onclick should be stripped");
			assert.isFalse(p.hasAttribute("onmouseover"), "onmouseover should be stripped");
			let div = frag.querySelector("div");
			assert.isFalse(div.hasAttribute("onload"), "onload should be stripped");
		});

		it("should preserve safe attributes", function () {
			let frag = MozXULElement.parseXULToFragment(
				'<html:div id="test" class="my-class" data-value="42">Content</html:div>'
			);
			WindowScopeVariables.sanitizeFragment(frag);
			let div = frag.querySelector("div");
			assert.equal(div.getAttribute("id"), "test");
			assert.equal(div.getAttribute("class"), "my-class");
			assert.equal(div.getAttribute("data-value"), "42");
		});

		it("should skip sanitization for privileged plugins", function () {
			loadTestScope(["*"]);
			let frag = MozXULElement.parseXULToFragment(
				'<html:script>alert("xss")</html:script>'
				+ '<html:p onclick="alert(1)">Click</html:p>'
			);
			WindowScopeVariables.sanitizeFragment(frag, ADDON_ID);
			assert.ok(frag.querySelector("script"), "<script> should remain for privileged plugins");
			let p = frag.querySelector("p");
			assert.isTrue(p.hasAttribute("onclick"), "onclick should remain for privileged plugins");
		});

		it("should sanitize for unprivileged plugins when pluginID is provided", function () {
			loadTestScope(["default"]);
			let frag = MozXULElement.parseXULToFragment(
				'<html:script>alert("xss")</html:script>'
				+ '<html:p onclick="alert(1)">Click</html:p>'
			);
			WindowScopeVariables.sanitizeFragment(frag, ADDON_ID);
			assert.isNull(frag.querySelector("script"), "<script> should be removed for unprivileged plugins");
			let p = frag.querySelector("p");
			assert.isFalse(p.hasAttribute("onclick"), "onclick should be removed for unprivileged plugins");
			assert.isTrue(p.hasAttribute("data-sandbox-on-click"), "handler should be stored as data attr");
		});

		it("should rewire on* handlers to execute in sandbox scope", function () {
			loadTestScope(["default"]);
			Cu.evalInSandbox("var handlerCalled = false;", scope);

			let frag = MozXULElement.parseXULToFragment(
				'<html:button onclick="handlerCalled = true;">Click</html:button>'
			);
			WindowScopeVariables.sanitizeFragment(frag, ADDON_ID);

			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			container.appendChild(document.importNode(frag, true));
			WindowScopeVariables.activateInlineHandlers(container, ADDON_ID);

			try {
				let button = container.querySelector("button");
				assert.isFalse(button.hasAttribute("onclick"), "onclick attr should be removed");
				assert.isFalse(button.hasAttribute("data-sandbox-on-click"), "data attr should be removed after activation");
				button.click();
				assert.isTrue(Cu.evalInSandbox("handlerCalled", scope), "handler should have set variable in sandbox");
			}
			finally {
				container.remove();
			}
		});

		it("should provide wrapped this and event to rewired handlers", function () {
			loadTestScope(["default"]);
			Cu.evalInSandbox("var capturedTagName = null; var capturedEventType = null;", scope);

			let frag = MozXULElement.parseXULToFragment(
				'<html:button onclick="capturedTagName = this.tagName; capturedEventType = event.type;">Click</html:button>'
			);
			WindowScopeVariables.sanitizeFragment(frag, ADDON_ID);

			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			container.appendChild(document.importNode(frag, true));
			WindowScopeVariables.activateInlineHandlers(container, ADDON_ID);

			try {
				container.querySelector("button").click();
				let tagName = Cu.evalInSandbox("capturedTagName", scope);
				assert.ok(tagName, "this.tagName should be accessible");
				assert.isTrue(
					tagName.toUpperCase().includes("BUTTON"),
					"this.tagName should contain BUTTON"
				);
				assert.equal(
					Cu.evalInSandbox("capturedEventType", scope),
					"click",
					"event.type should be accessible"
				);
			}
			finally {
				container.remove();
			}
		});

		it("should block setting on* properties on wrapped elements", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let button = document.createElement("button");
			container.appendChild(button);

			try {
				let wrappedButton = WindowScopeVariables.createSafeHTMLElement(
					button, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				scope._btn = wrappedButton;
				let warnStub = sinon.stub(Zotero, "warn");
				evalInScope("_btn.onclick = function() {}");
				assert.isTrue(warnStub.calledOnce, "should warn about on* property");
				assert.include(warnStub.firstCall.args[0], "addEventListener");
				assert.isNull(button.onclick, "onclick should not be set on real element");
				warnStub.restore();
			}
			finally {
				container.remove();
			}
		});

		it("should block setAttribute for on* attributes on wrapped elements", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let button = document.createElement("button");
			container.appendChild(button);

			try {
				let wrappedButton = WindowScopeVariables.createSafeHTMLElement(
					button, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				scope._btn = wrappedButton;
				let warnStub = sinon.stub(Zotero, "warn");
				evalInScope('_btn.setAttribute("onclick", "alert(1)")');
				assert.isTrue(warnStub.calledOnce, "should warn about on* attribute");
				assert.include(warnStub.firstCall.args[0], "addEventListener");
				assert.isFalse(button.hasAttribute("onclick"), "onclick attribute should not be set");
				warnStub.restore();

				// Verify non-on* attributes still work
				evalInScope('_btn.setAttribute("class", "test-class")');
				assert.equal(button.getAttribute("class"), "test-class");
			}
			finally {
				container.remove();
			}
		});

		it("should receive events via addEventListener on wrapped elements", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let button = document.createElement("button");
			container.appendChild(button);

			try {
				let wrappedButton = WindowScopeVariables.createSafeHTMLElement(
					button, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				scope._btn = wrappedButton;
				evalInScope(`
					var _elemEvtType = null;
					var _elemEvtTarget = null;
					_btn.addEventListener("click", function (e) {
						_elemEvtType = e.type;
						_elemEvtTarget = e.target;
					});
				`);
				button.click();
				assert.equal(evalInScope("_elemEvtType"), "click",
					"handler should receive the click event");
				assert.isTrue(evalInScope("_elemEvtTarget !== null"),
					"event target should be wrapped, not null");
			}
			finally {
				container.remove();
			}
		});

		it("should pass a usable Event to addEventListener callback on wrapped elements", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let button = document.createElement("button");
			container.appendChild(button);

			try {
				let wrappedButton = WindowScopeVariables.createSafeHTMLElement(
					button, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				scope._btn = wrappedButton;
				evalInScope(`
					var _elemEvt = {};
					_btn.addEventListener("click", function (e) {
						_elemEvt.type = e.type;
						_elemEvt.bubbles = e.bubbles;
						_elemEvt.cancelable = e.cancelable;
						_elemEvt.hasPreventDefault = typeof e.preventDefault === "function";
						_elemEvt.hasStopPropagation = typeof e.stopPropagation === "function";
						_elemEvt.targetTagName = e.target ? e.target.tagName : null;
						_elemEvt.currentTargetTagName = e.currentTarget ? e.currentTarget.tagName : null;
					});
				`);
				button.click();
				assert.equal(evalInScope("_elemEvt.type"), "click", "type");
				assert.isTrue(evalInScope("_elemEvt.bubbles"), "bubbles");
				assert.isTrue(evalInScope("_elemEvt.hasPreventDefault"), "preventDefault is function");
				assert.isTrue(evalInScope("_elemEvt.hasStopPropagation"), "stopPropagation is function");
				assert.equal(
					evalInScope("_elemEvt.targetTagName").toUpperCase(), "BUTTON",
					"target should be the button"
				);
				assert.equal(
					evalInScope("_elemEvt.currentTargetTagName").toUpperCase(), "BUTTON",
					"currentTarget should be the button"
				);
			}
			finally {
				container.remove();
			}
		});

		it("should remove listener via removeEventListener on wrapped elements", function () {
			loadTestScope(["default"]);
			let container = document.createElement("div");
			document.documentElement.appendChild(container);
			let button = document.createElement("button");
			container.appendChild(button);

			try {
				let wrappedButton = WindowScopeVariables.createSafeHTMLElement(
					button, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				scope._btn = wrappedButton;
				evalInScope(`
					var _elemClickCount = 0;
					function _elemClickHandler(e) { _elemClickCount++; }
					_btn.addEventListener("click", _elemClickHandler);
				`);
				button.click();
				assert.equal(evalInScope("_elemClickCount"), 1,
					"handler should fire once");

				evalInScope("_btn.removeEventListener('click', _elemClickHandler)");
				button.click();
				assert.equal(evalInScope("_elemClickCount"), 1,
					"handler should not fire after removal");
			}
			finally {
				container.remove();
			}
		});

		describe("innerHTML sanitization via wrapped element", function () {
			function setupSafeDiv() {
				let container = document.createElement("div");
				document.documentElement.appendChild(container);
				let target = document.createElement("div");
				container.appendChild(target);
				let wrappedTarget = WindowScopeVariables.createSafeHTMLElement(
					target, ADDON_ID, { rootNode: new WeakRef(container) }
				);
				scope._target = wrappedTarget;
				return { container, target };
			}

			it("should parse and set plain HTML content", function () {
				loadTestScope(["default"]);
				let { container, target } = setupSafeDiv();
				try {
					evalInScope('_target.innerHTML = "<b>bold</b> and <em>italic</em>"');
					assert.equal(target.querySelector("b").textContent, "bold");
					assert.equal(target.querySelector("em").textContent, "italic");
				}
				finally {
					container.remove();
				}
			});

			it("should preserve xul: and html: namespaces in innerHTML", function () {
				loadTestScope(["default"]);
				let { container, target } = setupSafeDiv();
				try {
					// XML parse path preserves namespace metadata -- nodes are inserted
					// directly into the DOM rather than re-serialized through the HTML parser.
					evalInScope(
						'_target.innerHTML = \''
						+ '<xul:label value="xul-label"/>'
						+ '<html:span class="ns-test">ns-content</html:span>\''
					);
					let xulNS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
					let htmlNS = "http://www.w3.org/1999/xhtml";
					let label = target.querySelector("label");
					assert.ok(label, "xul:label element should exist");
					assert.equal(label.namespaceURI, xulNS, "label should be in XUL namespace");
					assert.equal(label.getAttribute("value"), "xul-label", "value attribute should be preserved");
					let span = target.querySelector("span");
					assert.ok(span, "html:span element should exist");
					assert.equal(span.namespaceURI, htmlNS, "span should be in HTML namespace");
					assert.equal(span.textContent, "ns-content", "text content should be preserved");
				}
				finally {
					container.remove();
				}
			});

			it("should strip on* event handlers from innerHTML", function () {
				loadTestScope(["default"]);
				let { container, target } = setupSafeDiv();
				try {
					evalInScope('_target.innerHTML = \'<span onclick="evil()">click</span>\'');
					let span = target.querySelector("span");
					assert.ok(span, "span should be created");
					assert.isFalse(span.hasAttribute("onclick"), "onclick should be stripped");
				}
				finally {
					container.remove();
				}
			});

			it("should strip unsafe tags from innerHTML", function () {
				loadTestScope(["default"]);
				let { container, target } = setupSafeDiv();
				try {
					evalInScope('_target.innerHTML = \'<script>evil()</script><b>safe</b>\'');
					assert.isNull(target.querySelector("script"), "script should be stripped");
					assert.ok(target.querySelector("b"), "safe content should remain");
				}
				finally {
					container.remove();
				}
			});
		});
	});

	describe("resolveURI", function () {
		it("should resolve relative URIs for privileged plugins against file:// root", async function () {
			loadTestScope(["*"]);
			let rootURI = "file:///tmp/test-plugin/";
			let stub = sinon.stub(Zotero.Plugins, "getRootURI").resolves(rootURI);
			try {
				let resolved = await Zotero.Plugins.resolveURI(ADDON_ID, "content/overlay.html");
				assert.equal(resolved, rootURI + "content/overlay.html");
				assert.isTrue(resolved.startsWith("file:///"), "Privileged plugin URI should be file://");
			}
			finally {
				stub.restore();
			}
		});

		it("should resolve relative URIs for unprivileged plugins against moz-extension:// root", async function () {
			var tmpDir = await getTempDirectory();
			let fileURI = Services.io.newURI(PathUtils.toFileURI(tmpDir) + "/");
			let addon = {
				id: ADDON_ID,
				name: "Test Sandbox Plugin",
				version: "1.0.0",
				syncGUID: "{00000000-0000-0000-0000-000000000003}",
				installPermissions: { permissions: ["default"] },
				getResourceURI() {
					return fileURI;
				}
			};
			PluginSandbox.loadScope(addon);
			try {
				let resolved = await Zotero.Plugins.resolveURI(ADDON_ID, "content/overlay.html");
				assert.isTrue(
					resolved.startsWith("moz-extension://"),
					"Unprivileged plugin URI should be moz-extension://"
				);
				assert.isTrue(
					resolved.endsWith("/content/overlay.html"),
					"Should resolve the relative path"
				);
			}
			finally {
				PluginSandbox.unloadScope(ADDON_ID);
				await IOUtils.remove(tmpDir, { recursive: true });
			}
		});

		it("should return absolute URIs unchanged", async function () {
			loadTestScope(["*"]);
			let stub = sinon.stub(Zotero.Plugins, "getRootURI").resolves("file:///tmp/test-plugin/");
			try {
				let absoluteURI = "https://example.com/resource.html";
				let resolved = await Zotero.Plugins.resolveURI(ADDON_ID, absoluteURI);
				assert.equal(resolved, absoluteURI);
			}
			finally {
				stub.restore();
			}
		});
	});
});
