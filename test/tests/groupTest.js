"use strict";

describe("Zotero.Group", function () {
	describe("#erase()", function () {
		it("should unregister group", function* () {
			var group = yield createGroup();
			var id = group.id;
			yield Zotero.DB.executeTransaction(function* () {
				return group.erase()
			}.bind(this));
			assert.isFalse(Zotero.Groups.exists(id));
		})
	})
	
	describe("#fromJSON()", function () {
		it("should set permissions for owner", function* () {
			var group = new Zotero.Group;
			group.fromJSON({
				owner: 1,
				libraryEditing: 'admins',
				fileEditing: 'admins'
			}, 1);
			assert.isTrue(group.editable);
			assert.isTrue(group.filesEditable);
			
			var group = new Zotero.Group;
			group.fromJSON({
				owner: 1,
				libraryEditing: 'members',
				fileEditing: 'members'
			}, 1);
			assert.isTrue(group.editable);
			assert.isTrue(group.filesEditable);
			
			var group = new Zotero.Group;
			group.fromJSON({
				owner: 1,
				libraryEditing: 'admins',
				fileEditing: 'none'
			}, 1);
			assert.isTrue(group.editable);
			assert.isFalse(group.filesEditable);
		})
		
		it("should set permissions for admin", function* () {
			var group = new Zotero.Group;
			group.fromJSON({
				owner: 1,
				libraryEditing: 'admins',
				fileEditing: 'admins',
				admins: [2]
			}, 2);
			assert.isTrue(group.editable);
			assert.isTrue(group.filesEditable);
			
			var group = new Zotero.Group;
			group.fromJSON({
				owner: 1,
				libraryEditing: 'members',
				fileEditing: 'members',
				admins: [2]
			}, 2);
			assert.isTrue(group.editable);
			assert.isTrue(group.filesEditable);
			
			var group = new Zotero.Group;
			group.fromJSON({
				owner: 1,
				libraryEditing: 'admins',
				fileEditing: 'none',
				admins: [2]
			}, 2);
			assert.isTrue(group.editable);
			assert.isFalse(group.filesEditable);
		})
		
		it("should set permissions for member", function* () {
			var group = new Zotero.Group;
			group.fromJSON({
				owner: 1,
				libraryEditing: 'members',
				fileEditing: 'members',
				admins: [2],
				members: [3]
			}, 3);
			assert.isTrue(group.editable);
			assert.isTrue(group.filesEditable);
			
			var group = new Zotero.Group;
			group.fromJSON({
				owner: 1,
				libraryEditing: 'admins',
				fileEditing: 'admins',
				admins: [2],
				members: [3]
			}, 3);
			assert.isFalse(group.editable);
			assert.isFalse(group.filesEditable);
			
			var group = new Zotero.Group;
			group.fromJSON({
				owner: 1,
				libraryEditing: 'admins',
				fileEditing: 'members', // Shouldn't be possible
				admins: [2],
				members: [3]
			}, 3);
			assert.isFalse(group.editable);
			assert.isFalse(group.filesEditable);
			
			var group = new Zotero.Group;
			group.fromJSON({
				owner: 1,
				libraryEditing: 'members',
				fileEditing: 'none',
				admins: [2],
				members: [3]
			}, 3);
			assert.isTrue(group.editable);
			assert.isFalse(group.filesEditable);
		})
		
		it("should set permissions for non-member", function* () {
			var group = new Zotero.Group;
			group.fromJSON({
				owner: 1,
				libraryEditing: 'members',
				fileEditing: 'members',
				admins: [2],
				members: [3]
			});
			assert.isFalse(group.editable);
			assert.isFalse(group.filesEditable);
		})
	})
})
