"use strict";

describe("Zotero.Creators", function() {
	describe("#getIDFromData()", function () {
		it("should create creator and cache data", function* () {
			var data1 = {
				firstName: "First",
				lastName: "Last"
			};
			var creatorID;
			yield Zotero.DB.executeTransaction(function* () {
				creatorID = yield Zotero.Creators.getIDFromData(data1, true);
			});
			assert.typeOf(creatorID, 'number');
			var data2 = Zotero.Creators.get(creatorID);
			assert.isObject(data2);
			assert.propertyVal(data2, "firstName", data1.firstName);
			assert.propertyVal(data2, "lastName", data1.lastName);
		});
	});
	
	describe("#cleanData()", function () {
		it("should allow firstName to be null for fieldMode 1", function* () {
			var data = Zotero.Creators.cleanData({
				firstName: null,
				lastName: "Test",
				fieldMode: 1
			});
			assert.propertyVal(data, 'fieldMode', 1);
			assert.propertyVal(data, 'firstName', '');
			assert.propertyVal(data, 'lastName', 'Test');
		});
	});
});
