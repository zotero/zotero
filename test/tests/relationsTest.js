"use strict";

describe("Zotero.Relations", function () {
	describe("#getByPredicateAndObject()", function () {
		it("should return items matching predicate and object", function* () {
			var item = createUnsavedDataObject('item');
			item.setRelations({
				"dc:relation": [
					"http://zotero.org/users/1/items/SHREREMS"
				],
				"owl:sameAs": [
					"http://zotero.org/groups/1/items/SRRMGSRM",
					"http://zotero.org/groups/1/items/GSMRRSSM"
				]
			})
			yield item.saveTx();
			var objects = yield Zotero.Relations.getByPredicateAndObject(
				'item', 'owl:sameAs', 'http://zotero.org/groups/1/items/SRRMGSRM'
			);
			assert.lengthOf(objects, 1);
			assert.equal(objects[0], item);
		})
	})
})
