describe("CollectionTreeRow", function () {
	var win, zp, cv, userLibraryID;
	
	before(async function () {
		win = await loadZoteroPane();
		zp = win.ZoteroPane;
		cv = zp.collectionsView;
		userLibraryID = Zotero.Libraries.userLibraryID;
	});
	
	beforeEach(function () {
		return selectLibrary(win);
	});
	
	after(function () {
		win.close();
	});
	
	describe("Unfiled Items", function () {
		// https://github.com/zotero/zotero/issues/2771
		it("shouldn't show filed attachments with annotations", async function () {
			var item1 = await createDataObject('item');
			
			var collection = await createDataObject('collection');
			var item2 = await createDataObject('item', { collections: [collection.id] });
			var attachment = await importPDFAttachment(item2);
			var annotation = await createAnnotation('highlight', attachment);
			
			cv.selectByID("U" + userLibraryID);
			await waitForItemsLoad(win);
			var itemsView = zp.itemsView;
			
			assert.isNumber(itemsView.getRowIndexByID(item1.id));
			assert.isFalse(itemsView.getRowIndexByID(item2.id));
		});
	});
	describe("Annotation filters", function () {
		let group, annotationOne, annotationTwo, annotationThree;

		before(async function () {
			let otherUserID = 2;
			await Zotero.Users.setCurrentUserID(1);
			await Zotero.Users.setName(1, 'this-user');
			await Zotero.Users.setName(otherUserID, 'another-user');
			
			// Create a group
			group = await createGroup();


			let item = await createDataObject('item',
				{
					libraryID: group.libraryID,
					title: 'Item 1'
				});
			
			// Create attachments for each item
			let attachment = await importPDFAttachment(item);
			
			// Create 2 annotations with #ffd400 and #ff6666 colors
			annotationOne = await createAnnotation('highlight', attachment, { color: '#ffd400', createdByUserID: 1 });
			annotationTwo = await createAnnotation('highlight', attachment, { color: '#ff6666', createdByUserID: 1 });
			
			// Create another annotation with #5fb236 color by another user
			annotationThree = await createAnnotation('highlight', attachment, { color: '#5fb236', createdByUserID: otherUserID });
		});
		
		after(async function () {
			await group.eraseTx();
		});

		it("should return only relevant annotation authors", async function () {
			await select(win, group);
			let treeRow = zp.getCollectionTreeRow();
			// First, all authors are available
			let authors = await treeRow.getAnnotationAuthors();
			assert.sameMembers([...authors], [1, 2]);

			// Authors that do not match any existing filters is excluded
			treeRow.setAnnotationTagFilters({ annotationColors: ['#ffd400'] });
			authors = await treeRow.getAnnotationAuthors();
			assert.sameMembers([...authors], [1]);
			treeRow.setAnnotationTagFilters({ annotationColors: ['#5fb236'] });
			authors = await treeRow.getAnnotationAuthors();
			assert.sameMembers([...authors], [2]);

			// An exception is a filter by another author.
			// That does not prevent other authors from appearing
			treeRow.setAnnotationTagFilters({ annotationAuthors: [1], annotationColors: [] });
			authors = await treeRow.getAnnotationAuthors();
			assert.sameMembers([...authors], [1, 2]);
		});

		it("should return possible annotation colors", async function () {
			await select(win, group);
			let treeRow = zp.getCollectionTreeRow();
			// First, all colors are available
			let colors = await treeRow.getAnnotationColors();
			assert.sameMembers([...colors], ['#ffd400', '#ff6666', '#5fb236']);

			// Colors that do not match any existing filters are excluded
			treeRow.setAnnotationTagFilters({ annotationAuthors: [1] });
			colors = await treeRow.getAnnotationColors();
			assert.sameMembers([...colors], ['#ffd400', '#ff6666']);
			treeRow.setAnnotationTagFilters({ annotationAuthors: [2] });
			colors = await treeRow.getAnnotationColors();
			assert.sameMembers([...colors], ['#5fb236']);

			// An exception is a filter by another color.
			// That does not prevent other colors from appearing
			treeRow.setAnnotationTagFilters({ annotationColors: ['#ffd400', '#ff6666'], annotationAuthors: [] });
			colors = await treeRow.getAnnotationColors();
			assert.sameMembers([...colors], ['#ffd400', '#ff6666', '#5fb236']);
		});

		it("should return matches for colors and annotations", async function () {
			await select(win, group);
			let treeRow = zp.getCollectionTreeRow();

			// (AuthorOne OR AuthorTwo) AND (ColorOne OR ColorTwo)
			treeRow.setAnnotationTagFilters({ annotationAuthors: [1, 2], annotationColors: ['#ffd400', '#ff6666', '#5fb236'] });
			let results = await treeRow.getSearchResults();
			assert.sameMembers(results, [annotationOne.id, annotationTwo.id, annotationThree.id]);

			treeRow.setAnnotationTagFilters({ annotationAuthors: [1], annotationColors: ['#ffd400'] });
			results = await treeRow.getSearchResults();
			assert.sameMembers(results, [annotationOne.id]);

			treeRow.setAnnotationTagFilters({ annotationAuthors: [2], annotationColors: ['#ffd400'] });
			results = await treeRow.getSearchResults();
			assert.sameMembers(results, []);
		});
	});
});
