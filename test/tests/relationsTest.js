"use strict";

describe("Zotero.Relations", function () {
	describe("#getByPredicateAndObject()", function () {
		it("should return items matching predicate and object", async function () {
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
			await item.saveTx();
			var objects = await Zotero.Relations.getByPredicateAndObject(
				'item', 'owl:sameAs', 'http://zotero.org/groups/1/items/SRRMGSRM'
			);
			assert.lengthOf(objects, 1);
			assert.equal(objects[0], item);
		})
	})
	
	describe("#updateUser", function () {
		beforeEach(function* () {
			yield Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='account'");
			yield Zotero.Users.init();
		})
		
		it("should update relations using local user key to use userID", function* () {
			var item1 = yield createDataObject('item');
			var item2 = createUnsavedDataObject('item');
			item2.addRelatedItem(item1);
			yield item2.save();
			
			var rels = item2.getRelationsByPredicate(Zotero.Relations.relatedItemPredicate);
			assert.include(rels[0], "/users/local");
			
			yield Zotero.DB.executeTransaction(async function () {
				await Zotero.Relations.updateUser(null, 1);
			})
			
			var rels = item2.getRelationsByPredicate(Zotero.Relations.relatedItemPredicate);
			assert.include(rels[0], "/users/1");
		})
		
		it("should update relations from one userID to another", function* () {
			yield Zotero.Users.setCurrentUserID(1);
			
			var item1 = yield createDataObject('item');
			var item2 = createUnsavedDataObject('item');
			item2.addRelatedItem(item1);
			yield item2.save();
			
			var rels = item2.getRelationsByPredicate(Zotero.Relations.relatedItemPredicate);
			assert.include(rels[0], "/users/1");
			
			yield Zotero.DB.executeTransaction(async function () {
				await Zotero.Relations.updateUser(1, 2);
			});
			
			var rels = item2.getRelationsByPredicate(Zotero.Relations.relatedItemPredicate);
			assert.include(rels[0], "/users/2");
		})
	})

	describe("Mark as primary attachment", function() {
		var win, zp, item, attachmentOne, attachmentTwo;

		before(async function () {
			win = await loadZoteroPane();
			zp = win.ZoteroPane;
			item = await createDataObject('item');
			
			attachmentOne = await Zotero.Attachments.linkFromFileWithRelativePath({
				path: 'a/b/test.pdf',
				title: 'one.pdf',
				parentItemID: item.id,
				contentType: 'application/pdf'
			});
	
			attachmentTwo = await Zotero.Attachments.linkFromFileWithRelativePath({
				path: 'a/b/test.pdf',
				title: 'two.pdf',
				parentItemID: item.id,
				contentType: 'application/pdf'
			});
		});
		after(function () {
			win.close();
		});

		it("should mark attachment as primary", async function () {
			let defaultBestAttachment = await item.getBestAttachment();
			assert.equal(defaultBestAttachment.id, attachmentOne.id);

			// Make second attachment primary one
			await zp.selectItem(attachmentTwo.id);
			await zp.toggleSelectedItemAsPrimaryAttachment();

			// Make sure now the best attachment is now the primary one
			defaultBestAttachment = await item.getBestAttachment();
			assert.equal(defaultBestAttachment.id, attachmentTwo.id);
		});

		it("should toggle only primaryAttachment relation", async function () {
			const dcRelation = "http://zotero.org/users/1/items/SHREREMS";
			const sameAs = "http://zotero.org/groups/1/items/SRRMGSRM";
			// Parent has some relations
			item.setRelations({
				"dc:relation": [
					dcRelation
				],
				"owl:sameAs": [
					sameAs,
				]
			});
			await item.saveTx();

			// Make attachment one the primary one
			await zp.selectItem(attachmentOne.id);
			await zp.toggleSelectedItemAsPrimaryAttachment();

			// Make sure old relations are there with the new one
			let relations = item.getRelations();
			console.log(relations);
			assert.equal(relations["dc:relation"][0], dcRelation);
			assert.equal(relations["owl:sameAs"][0], sameAs);
			assert.equal(relations[Zotero.Relations.primaryAttachmentPredicate], attachmentOne.key);


			// Toggle again
			await zp.selectItem(attachmentOne.id);
			await zp.toggleSelectedItemAsPrimaryAttachment();

			// Make sure old relations are there
			relations = item.getRelations();
			assert.equal(relations["dc:relation"][0], dcRelation);
			assert.equal(relations["owl:sameAs"][0], sameAs);
			// Primary attachment relation removed
			assert.notProperty(relations, Zotero.Relations.primaryAttachmentPredicate);
		});

		it("should ignore primary attachment relations to trashed items", async function () {
			let defaultBestAttachment = await item.getBestAttachment();
			assert.equal(defaultBestAttachment.id, attachmentOne.id);
	
			// Make second attachment the primary one
			await zp.selectItem(attachmentTwo.id);
			await zp.toggleSelectedItemAsPrimaryAttachment();

			// And delete it
			attachmentTwo.deleted = true;
			await attachmentTwo.saveTx();

			// Make sure the best attachment is still the first one
			var newBestAttachment = await item.getBestAttachment();
			assert.equal(newBestAttachment.id, attachmentOne.id);

			// Un-delete it
			attachmentTwo.deleted = false;
			await attachmentTwo.saveTx();

			// Make sure the best attachment is now the second one
			newBestAttachment = await item.getBestAttachment();
			assert.equal(newBestAttachment.id, attachmentTwo.id);
		});

		it("should delete primary attachment relations when attachment is moved to another parent or deleted", async function () {
			let itemTwo = await createDataObject('item');
			// Move attachment two to itemTwo
			attachmentTwo.parentKey = itemTwo.key;
			await attachmentTwo.saveTx();

			// Assert the relations was removed from itemOne
			let relations = item.getRelations();
			assert.notProperty(relations, Zotero.Relations.primaryAttachmentPredicate);

			// Make second attachment the primary one for itemTwo
			await zp.selectItem(attachmentTwo.id);
			await zp.toggleSelectedItemAsPrimaryAttachment();

			// Make sure itemTwo has primary attachment relation
			let itemTwoRelations = itemTwo.getRelations();
			assert.equal(itemTwoRelations[Zotero.Relations.primaryAttachmentPredicate], attachmentTwo.key);

			await attachmentTwo.eraseTx();

			// Make sure the relation is now gone
			itemTwoRelations = itemTwo.getRelations();
			assert.notProperty(itemTwoRelations, Zotero.Relations.primaryAttachmentPredicate);
		});
	});
})
