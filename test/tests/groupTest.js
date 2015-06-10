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
		
		it("should provide libraryID in extraData", function* () {
			var group = yield createGroup();
			var libraryID = group.libraryID;
			
			var deferred = Zotero.Promise.defer();
			var observerID = Zotero.Notifier.registerObserver({
				notify: function (event, type, ids, extraData) {
					deferred.resolve(extraData[ids[0]]);
				}
			}, ['group'], "test");
			try {
				yield group.eraseTx();
				let extraData = yield deferred.promise;
				assert.equal(extraData.libraryID, libraryID);
			}
			finally {
				Zotero.Notifier.unregisterObserver(observerID);
			}
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
				// No admins
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
