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
			Zotero.debug("BEFORE SAVING");
			Zotero.debug(s._conditions);
			var id = yield s.saveTx();
			Zotero.debug("DONE SAVING");
			Zotero.debug(s._conditions);
			assert.typeOf(id, 'number');
			
			// Check saved search
			s = Zotero.Searches.get(id);
			assert.ok(s);
			assert.instanceOf(s, Zotero.Search);
			assert.equal(s.libraryID, Zotero.Libraries.userLibraryID);
			assert.equal(s.name, "Test");
			Zotero.debug("GETTING CONDITIONS");
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
			s.addCondition('title', 'contains', 'foo');
			var saved = yield s.saveTx();
			assert.isTrue(saved);
			
			// Check saved search
			s = yield Zotero.Searches.getAsync(id);
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
			s.removeCondition(0);
			var saved = yield s.saveTx();
			assert.isTrue(saved);
			
			// Check saved search
			s = yield Zotero.Searches.getAsync(id);
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
	
	describe("#toJSON()", function () {
		it("should output all data", function* () {
			let s = new Zotero.Search();
			s.name = "Test";
			s.addCondition('joinMode', 'any');
			s.addCondition('fulltextWord', 'contains', 'afsgagsdg');
			let json = s.toJSON();
			assert.equal(json.name, "Test");
			assert.lengthOf(json.conditions, 2);
			assert.equal(json.conditions[0].condition, 'joinMode');
			assert.equal(json.conditions[0].operator, 'any');
			assert.equal(json.conditions[1].condition, 'fulltextWord');
			assert.equal(json.conditions[1].operator, 'contains');
			assert.equal(json.conditions[1].value, 'afsgagsdg');
		});
	});
	
	describe("#fromJSON()", function () {
		it("should update all data", function* () {
			let s = new Zotero.Search();
			s.name = "Test";
			s.addCondition('joinMode', 'any');
			let json = s.toJSON();
			json.name = "Test 2";
			json.conditions = [
				{
					condition: 'title',
					operator: 'contains',
					value: 'foo'
				},
				{
					condition: 'year',
					operator: 'is',
					value: '2016'
				}
			];
			s.fromJSON(json);
			assert.equal(s.name, "Test 2");
			var conditions = s.getConditions();
			assert.lengthOf(Object.keys(conditions), 2);
			assert.equal(conditions["0"].condition, 'title');
			assert.equal(conditions["0"].operator, 'contains');
			assert.equal(conditions["0"].value, 'foo');
			assert.equal(conditions["1"].condition, 'year');
			assert.equal(conditions["1"].operator, 'is');
			assert.equal(conditions["1"].value, '2016');
		});
	});
});
