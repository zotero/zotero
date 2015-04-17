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
			assert.property(conditions, "1"); // searchConditionIDs start at 1
			var condition = conditions[1];
			assert.propertyVal(condition, 'condition', 'title')
			assert.propertyVal(condition, 'operator', 'is')
			assert.propertyVal(condition, 'value', 'test')
		});
	});
});
