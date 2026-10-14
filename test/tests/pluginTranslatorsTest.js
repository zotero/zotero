describe("Plugin Zotero.Translators", function () {
	var plugin = usePluginSandbox();

	beforeEach(function () {
		plugin.load(["default", "dataRead", "dataWrite"]);
	});

	it("should expose Zotero.Translators.getAll()", async function () {
		assert.isTrue(plugin.eval("typeof Zotero.Translators.getAll === 'function'"));
		let translators = await plugin.eval("Zotero.Translators.getAll()");
		assert.isArray(translators);
	});

	it("should construct Translate.Import/Search/Web with the right type", function () {
		assert.equal(plugin.eval("new Zotero.Translate.Import().type"), 'import');
		assert.equal(plugin.eval("new Zotero.Translate.Search().type"), 'search');
		assert.equal(plugin.eval("new Zotero.Translate.Web().type"), 'web');
	});

	it("should import an item via Translate.Import facade", async function () {
		let translator = buildDummyTranslator("import",
			'function doImport() {'
			+ '  var item = new Zotero.Item("book");'
			+ '  item.title = "Sandbox Import Test";'
			+ '  item.complete();'
			+ '}');
		plugin.expose("getTestTranslator", () => translator);

		let count = await plugin.eval(`
				var translate = new Zotero.Translate.Import();
				translate.setString("");
				translate.setTranslator(getTestTranslator());
				translate.translate().then(items => items.length);
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
		plugin.expose("getTestTranslator", () => translator);

		let handlerCount = await plugin.eval(`
				var count = 0;
				var translate = new Zotero.Translate.Import();
				translate.setString("");
				translate.setTranslator(getTestTranslator());
				translate.setHandler('itemDone', function() { count++; });
				translate.translate().then(function() { return count; });
			`);
		assert.equal(handlerCount, 1);
	});

	it("should retrieve translators on Translate.Search via setSearch and setIdentifier", async function () {
		// Both entry points should return a translator array
		let viaSearch = await plugin.eval(`
				var search = new Zotero.Translate.Search();
				search.setSearch({ itemType: 'journalArticle', DOI: '10.1234/test' });
				search.getTranslators().then(t => t.length);
			`);
		assert.isNumber(viaSearch);

		let viaIdentifier = await plugin.eval(`
				var search = new Zotero.Translate.Search();
				search.setIdentifier({ DOI: '10.1234/test' });
				search.getTranslators().then(t => t.length);
			`);
		assert.isNumber(viaIdentifier);
	});

	it("should clear handlers so they do not fire", async function () {
		let translator = buildDummyTranslator("import",
			'function doImport() {'
			+ '  var item = new Zotero.Item("book");'
			+ '  item.title = "Clear Handler Test";'
			+ '  item.complete();'
			+ '}');
		plugin.expose("getTestTranslator", () => translator);

		let handlerCount = await plugin.eval(`
				var count = 0;
				var translate = new Zotero.Translate.Import();
				translate.setString("");
				translate.setTranslator(getTestTranslator());
				translate.setHandler('itemDone', function() { count++; });
				translate.clearHandlers('itemDone');
				translate.translate().then(function() { return count; });
			`);
		assert.equal(handlerCount, 0);
	});

	it("should not expose Translators without data permission", function () {
		plugin.load(["default"]);
		assert.isTrue(plugin.eval("typeof Zotero.Translators === 'undefined'"),
			"Translators should not be exposed without data permission");
	});

	it("should not expose Translate constructors with only dataRead", function () {
		plugin.load(["default", "dataRead"]);
		assert.isTrue(plugin.eval("typeof Zotero.Translators.getAll === 'function'"),
			"Translators.getAll should be exposed with dataRead");
		assert.isTrue(plugin.eval("typeof Zotero.Translate === 'undefined'"),
			"Translate constructors should not be exposed with only dataRead");
	});
});
