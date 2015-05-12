"use strict";

describe("Zotero.DataObjects", function() {
	var types = ['collection', 'item', 'search'];
	
	describe("#diff()", function () {
		it("should not show empty items as different", function* () {
			var id1, id2, json1, json2;
			yield Zotero.DB.executeTransaction(function* () {
				var item = new Zotero.Item('book');
				id1 = yield item.save();
				item = yield Zotero.Items.getAsync(id1);
				json1 = yield item.toJSON();
				
				var item = new Zotero.Item('book');
				id2 = yield item.save();
				item = yield Zotero.Items.getAsync(id2);
				json2 = yield item.toJSON();
			});
			
			var diff = Zotero.Items.diff(json1, json2);
			assert.isFalse(diff);
			
			yield Zotero.Items.erase(id1, id2);
		})
		
		it("should not show empty strings as different", function* () {
			var json1 = {
				title: ""
			};
			var json2 = {
				title: ""
			};
			var diff = Zotero.Items.diff(json1, json2);
			assert.isFalse(diff);
		})
		
		it("should not show empty string and undefined as different", function* () {
			var json1 = {
				title: ""
			};
			var json2 = {
				place: ""
			};
			var diff = Zotero.Items.diff(json1, json2);
			assert.isFalse(diff);
		})
		
		it("should not show identical creators as different", function* () {
			var json1 = {
				creators: [
					{
						name: "Center for History and New Media",
						creatorType: "author"
					}
				]
			};
			var json2 = {
				creators: [
					{
						creatorType: "author",
						name: "Center for History and New Media"
					}
				]
			};
			var diff = Zotero.Items.diff(json1, json2);
			assert.isFalse(diff);
		})
	})
})
