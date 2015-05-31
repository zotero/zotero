describe("Zotero.Search", function() {
	describe("#save()", function () {
		it("should fail without a name", function* () {
			var s = new Zotero.Search;
			s.addCondition('title', 'is', 'test');
			var e = yield getPromiseError(s.saveTx());
			assert.ok(e);
			assert.equal(e.constructor.name, Error.prototype.constructor.name); // TEMP: Error mismatch
			assert.equal(e.message, "Name not provided for saved search");
		});
		
		it("should save a new search", function* () {
			// Save search
			var s = new Zotero.Search;
			s.name = "Test";
			s.addCondition('title', 'is', 'test');
			var id = yield s.saveTx();
			assert.typeOf(id, 'number');
			
			// Check saved search
			s = yield Zotero.Searches.getAsync(id);
			assert.ok(s);
			assert.instanceOf(s, Zotero.Search);
			assert.equal(s.libraryID, Zotero.Libraries.userLibraryID);
			assert.equal(s.name, "Test");
			yield s.loadConditions();
			var conditions = s.getConditions();
			assert.lengthOf(Object.keys(conditions), 1);
			assert.property(conditions, "0");
			var condition = conditions[0];
			assert.propertyVal(condition, 'condition', 'title')
			assert.propertyVal(condition, 'operator', 'is')
			assert.propertyVal(condition, 'value', 'test')
			assert.propertyVal(condition, 'required', false)
		});
		
		it("should add a condition to an existing search", function* () {
			// Save search
			var s = new Zotero.Search;
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.name = "Test";
			s.addCondition('title', 'is', 'test');
			var id = yield s.saveTx();
			assert.typeOf(id, 'number');
			
			// Add condition
			s = yield Zotero.Searches.getAsync(id);
			yield s.loadConditions();
			s.addCondition('title', 'contains', 'foo');
			var saved = yield s.saveTx();
			assert.isTrue(saved);
			
			// Check saved search
			s = yield Zotero.Searches.getAsync(id);
			yield s.loadConditions();
			var conditions = s.getConditions();
			assert.lengthOf(Object.keys(conditions), 2);
		});
		
		it("should remove a condition from an existing search", function* () {
			// Save search
			var s = new Zotero.Search;
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.name = "Test";
			s.addCondition('title', 'is', 'test');
			s.addCondition('title', 'contains', 'foo');
			var id = yield s.saveTx();
			assert.typeOf(id, 'number');
			
			// Remove condition
			s = yield Zotero.Searches.getAsync(id);
			yield s.loadConditions();
			s.removeCondition(0);
			var saved = yield s.saveTx();
			assert.isTrue(saved);
			
			// Check saved search
			s = yield Zotero.Searches.getAsync(id);
			yield s.loadConditions();
			var conditions = s.getConditions();
			assert.lengthOf(Object.keys(conditions), 1);
			assert.property(conditions, "0");
			assert.propertyVal(conditions[0], 'value', 'foo')
		});
	});

	describe("#search()", function () {
		let win;
		let fooItem;
		let foobarItem;

		before(function* () {
			// Hidden browser, which requires a browser window, needed for charset detection
			// (until we figure out a better way)
			win = yield loadBrowserWindow();
			fooItem = yield importFileAttachment("search/foo.html");
			foobarItem = yield importFileAttachment("search/foobar.html");
		});

		after(function* () {
			if (win) {
				win.close();
			}
			yield fooItem.erase();
			yield foobarItem.erase();
		});

		it("should return matches with full-text conditions", function* () {
			let s = new Zotero.Search();
			s.addCondition('fulltextWord', 'contains', 'foo');
			let matches = yield s.search();
			assert.lengthOf(matches, 2);
			assert.sameMembers(matches, [fooItem.id, foobarItem.id]);
		});

		it("should not return non-matches with full-text conditions", function* () {
			let s = new Zotero.Search();
			s.addCondition('fulltextWord', 'contains', 'baz');
			let matches = yield s.search();
			assert.lengthOf(matches, 0);
		});

		it("should return matches for full-text conditions in ALL mode", function* () {
			let s = new Zotero.Search();
			s.addCondition('joinMode', 'all');
			s.addCondition('fulltextWord', 'contains', 'foo');
			s.addCondition('fulltextWord', 'contains', 'bar');
			let matches = yield s.search();
			assert.deepEqual(matches, [foobarItem.id]);
		});

		it("should not return non-matches for full-text conditions in ALL mode", function* () {
			let s = new Zotero.Search();
			s.addCondition('joinMode', 'all');
			s.addCondition('fulltextWord', 'contains', 'mjktkiuewf');
			s.addCondition('fulltextWord', 'contains', 'zijajkvudk');
			let matches = yield s.search();
			assert.lengthOf(matches, 0);
		});

		it("should return a match that satisfies only one of two full-text condition in ANY mode", function* () {
			let s = new Zotero.Search();
			s.addCondition('joinMode', 'any');
			s.addCondition('fulltextWord', 'contains', 'bar');
			s.addCondition('fulltextWord', 'contains', 'baz');
			let matches = yield s.search();
			assert.deepEqual(matches, [foobarItem.id]);
		});
	});
});
