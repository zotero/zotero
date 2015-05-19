"use strict";

describe("Zotero.DataObjectUtilities", function() {
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
			
			var changes = Zotero.DataObjectUtilities.diff(json1, json2);
			assert.lengthOf(changes, 0);
			
			yield Zotero.Items.erase(id1, id2);
		})
		
		it("should not show empty strings as different", function* () {
			var json1 = {
				title: ""
			};
			var json2 = {
				title: ""
			};
			var changes = Zotero.DataObjectUtilities.diff(json1, json2);
			assert.lengthOf(changes, 0);
		})
		
		it("should not show empty string and undefined as different", function* () {
			var json1 = {
				title: ""
			};
			var json2 = {
				place: ""
			};
			var changes = Zotero.DataObjectUtilities.diff(json1, json2);
			assert.lengthOf(changes, 0);
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
			var changes = Zotero.DataObjectUtilities.diff(json1, json2);
			assert.lengthOf(changes, 0);
		})
		
		it("should not show manual tags with or without 'type' property as different", function* () {
			var json1 = {
				tags: [
					{
						tag: "Foo"
					}
				]
			};
			var json2 = {
				tags: [
					{
						tag: "Foo",
						type: 0
					}
				]
			};
			var changes = Zotero.DataObjectUtilities.diff(json1, json2);
			assert.lengthOf(changes, 0);
		})
		
		it("should show tags of different types as different", function* () {
			var json1 = {
				tags: [
					{
						tag: "Foo"
					}
				]
			};
			var json2 = {
				tags: [
					{
						tag: "Foo",
						type: 1
					}
				]
			};
			var changes = Zotero.DataObjectUtilities.diff(json1, json2);
			assert.sameDeepMembers(
				changes,
				[
					{
						field: "tags",
						op: "member-remove",
						value: {
							tag: "Foo"
						}
					},
					{
						field: "tags",
						op: "member-add",
						value: {
							tag: "Foo",
							type: 1
						}
					}
				]
			);
		})
	})
	
	describe("#applyChanges()", function () {
		it("should set added/modified field values", function* () {
			var json = {
				title: "A"
			};
			var changes = [
				{
					field: "title",
					op: "add",
					value: "B"
				},
				{
					field: "date",
					op: "modify",
					value: "2015-05-19"
				}
			];
			Zotero.DataObjectUtilities.applyChanges(json, changes);
			assert.equal(json.title, "B");
			assert.equal(json.date, "2015-05-19");
		})
		
		it("should add a collection", function* () {
			var json = {
				collections: ["AAAAAAAA"]
			};
			var changes = [
				{
					field: "collections",
					op: "member-add",
					value: "BBBBBBBB"
				}
			];
			Zotero.DataObjectUtilities.applyChanges(json, changes);
			assert.sameMembers(json.collections, ["AAAAAAAA", "BBBBBBBB"]);
		})
		
		it("should not duplicate an existing collection", function* () {
			var json = {
				collections: ["AAAAAAAA"]
			};
			var changes = [
				{
					field: "collections",
					op: "member-add",
					value: "AAAAAAAA"
				}
			];
			Zotero.DataObjectUtilities.applyChanges(json, changes);
			assert.sameMembers(json.collections, ["AAAAAAAA"]);
			assert.lengthOf(json.collections, 1);
		})
		
		it("should remove a collection", function* () {
			var json = {
				collections: ["AAAAAAAA"]
			};
			var changes = [
				{
					field: "collections",
					op: "member-remove",
					value: "AAAAAAAA"
				}
			];
			Zotero.DataObjectUtilities.applyChanges(json, changes);
			assert.lengthOf(json.collections, 0);
		})
		
		it("should add a tag", function* () {
			var json = {
				tags: [
					{
						tag: "A"
					}
				]
			};
			var changes = [
				{
					field: "tags",
					op: "member-add",
					value: {
						tag: "B"
					}
				}
			];
			Zotero.DataObjectUtilities.applyChanges(json, changes);
			assert.sameDeepMembers(
				json.tags,
				[
					{
						tag: "A"
					},
					{
						tag: "B"
					}
				]
			);
		})
		
		it("should not duplicate an existing tag", function* () {
			var json = {
				tags: [
					{
						tag: "A"
					}
				]
			};
			var changes = [
				{
					field: "tags",
					op: "member-add",
					value: {
						tag: "A"
					}
				}
			];
			Zotero.DataObjectUtilities.applyChanges(json, changes);
			assert.sameDeepMembers(
				json.tags,
				[
					{
						tag: "A"
					}
				]
			);
			assert.lengthOf(json.tags, 1);
		})
		
		it("should remove a tag", function* () {
			var json = {
				tags: [
					{
						tag: "A"
					}
				]
			};
			var changes = [
				{
					field: "tags",
					op: "member-remove",
					value: {
						tag: "A"
					}
				}
			];
			Zotero.DataObjectUtilities.applyChanges(json, changes);
			assert.lengthOf(json.tags, 0);
		})
	})
})
