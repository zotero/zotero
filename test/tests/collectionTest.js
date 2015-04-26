describe("Zotero.Collection", function() {
	describe("#save()", function () {
		it("should save a new collection", function* () {
			var name = "Test";
			
			var collection = new Zotero.Collection;
			collection.name = name;
			var id = yield collection.save();
			collection = yield Zotero.Collections.getAsync(id);
			assert.equal(collection.name, name);
		});
	})
})
