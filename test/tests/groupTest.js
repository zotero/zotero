"use strict";

describe("Zotero.Group", function () {
	describe("#constructor()", function () {
		it("should accept required parameters", async function () {
			let group = new Zotero.Group();
			await assert.isRejected(group.saveTx()); // fails without required parameters
			
			let groupID = Zotero.Utilities.rand(10000, 1000000);
			let groupName = "Test " + Zotero.Utilities.randomString();
			let groupVersion = Zotero.Utilities.rand(10000, 1000000);
			group = new Zotero.Group({
				groupID: groupID,
				name: groupName,
				description: "",
				version:groupVersion,
				editable: true,
				filesEditable: true
			});
			await assert.isFulfilled(group.saveTx(), "saves given required parameters");
			
			assert.isTrue(Zotero.Libraries.exists(group.libraryID));
			assert.equal(group, Zotero.Groups.get(group.groupID));
			
			assert.equal(group.name, groupName);
			assert.equal(group.groupID, groupID);
			assert.equal(group.version, groupVersion);
		});
	});
	
	describe("#version", function () {
		it("should be settable to increasing values", function () {
			let library = new Zotero.Group();
			assert.throws(() => library.version = -1);
			assert.throws(() => library.version = "a");
			assert.throws(() => library.version = 1.1);
			assert.doesNotThrow(() => library.version = 0);
			assert.doesNotThrow(() => library.version = 5);
		});
		it("should not be possible to decrement", function () {
			let library = new Zotero.Group();
			library.version = 5;
			assert.throws(() => library.version = 0);
		});
	});
	
	describe("#erase()", function () {
		it("should unregister group", async function () {
			var group = await createGroup();
			var id = group.id;
			await group.eraseTx();
			assert.isFalse(Zotero.Groups.exists(id));
		})
		
		it("should provide libraryID in extraData", async function () {
			var group = await createGroup();
			var libraryID = group.libraryID;
			
			var deferred = Zotero.Promise.defer();
			var observerID = Zotero.Notifier.registerObserver({
				notify: function (event, type, ids, extraData) {
					deferred.resolve(extraData[ids[0]]);
				}
			}, ['group'], "test");
			try {
				await group.eraseTx();
				let extraData = await deferred.promise;
				assert.equal(extraData.libraryID, libraryID);
			}
			finally {
				Zotero.Notifier.unregisterObserver(observerID);
			}
		})
	})
	
	describe("#fromJSON()", function () {
		it("should set permissions for owner", async function () {
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
		
		it("should set permissions for admin", async function () {
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
		
		it("should set permissions for member", async function () {
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
		
		it("should set permissions for non-member", async function () {
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
