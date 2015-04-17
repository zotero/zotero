describe("Zotero.Search", function() {
	describe("#save()", function () {
		it("should fail without a libraryID", function* () {
			var s = new Zotero.Search;
			s.name = "Test";
			s.addCondition('title', 'is', 'test');
			var e = yield getPromiseError(s.save());
			assert.ok(e);
			assert.equal(e.constructor.name, Error.prototype.constructor.name); // TEMP: Error mismatch
			assert.equal(e.message, "libraryID must be set before saving search");
		});
		
		it("should fail without a name", function* () {
			var s = new Zotero.Search;
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.addCondition('title', 'is', 'test');
			var e = yield getPromiseError(s.save());
			assert.ok(e);
			assert.equal(e.constructor.name, Error.prototype.constructor.name); // TEMP: Error mismatch
			assert.equal(e.message, "Name not provided for saved search");
		});
		
		it("should save a new search", function* () {
			// Save search
			var s = new Zotero.Search;
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.name = "Test";
			s.addCondition('title', 'is', 'test');
			var id = yield s.save();
			assert.typeOf(id, 'number');
			
			// Check saved search
			s = yield Zotero.Searches.getAsync(id);
			assert.ok(s);
			assert.instanceOf(s, Zotero.Search);
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
			var id = yield s.save();
			assert.typeOf(id, 'number');
			
			// Add condition
			s = yield Zotero.Searches.getAsync(id);
			yield s.loadConditions();
			s.addCondition('title', 'contains', 'foo');
			var saved = yield s.save();
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
			var id = yield s.save();
			assert.typeOf(id, 'number');
			
			// Remove condition
			s = yield Zotero.Searches.getAsync(id);
			yield s.loadConditions();
			s.removeCondition(0);
			var saved = yield s.save();
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
});
