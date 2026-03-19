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

	describe("Search cache", function () {
		var collectionTreeRow;

		// Stub getSearchObject on a collectionTreeRow so that the search's .search() throws,
		// simulating a broken saved search (e.g., "too many SQL variables").
		function stubBrokenSearch(ctr) {
			return sinon.stub(ctr, 'getSearchObject').resolves({
				search: () => { throw new Error('simulated search failure'); }
			});
		}

		beforeEach(function () {
			collectionTreeRow = zp.getCollectionTreeRow();
			collectionTreeRow.clearCache();
		});

		afterEach(function () {
			collectionTreeRow.setSearch('');
			collectionTreeRow.setTags([]);
		});

		it("should memoize getSearchResults() within a refresh cycle", async function () {
			var results1 = await collectionTreeRow.getSearchResults();
			var results2 = await collectionTreeRow.getSearchResults();
			assert.strictEqual(results1, results2, 'should return same cached array');
		});

		it("should memoize getSearchObject() within a refresh cycle", async function () {
			var search1 = await collectionTreeRow.getSearchObject();
			var search2 = await collectionTreeRow.getSearchObject();
			assert.strictEqual(search1, search2, 'should return same cached search');
		});

		it("should invalidate cache on clearCache()", async function () {
			var results1 = await collectionTreeRow.getSearchResults();
			collectionTreeRow.clearCache();
			var results2 = await collectionTreeRow.getSearchResults();
			assert.notStrictEqual(results1, results2, 'should return new array after clearCache()');
		});

		it("should invalidate cache when setSearch() changes filters", async function () {
			await collectionTreeRow.getSearchResults();
			assert.isNotNull(collectionTreeRow._cachedResults);

			collectionTreeRow.setSearch('test-query');
			assert.isNull(collectionTreeRow._cachedResults);
			assert.isNull(collectionTreeRow._cachedSearch);
		});

		it("should not invalidate cache when setSearch() is called with same value", async function () {
			collectionTreeRow.setSearch('same');

			await collectionTreeRow.getSearchResults();
			var cached = collectionTreeRow._cachedResults;
			assert.isNotNull(cached);

			collectionTreeRow.setSearch('same');
			assert.strictEqual(collectionTreeRow._cachedResults, cached,
				'cache should survive idempotent setSearch()');
		});

		it("should throw SearchError on search failure", async function () {
			var stub = stubBrokenSearch(collectionTreeRow);
			try {
				var err;
				try {
					await collectionTreeRow.getSearchResults();
				}
				catch (e) {
					err = e;
				}
				assert.ok(err, 'getSearchResults() should throw');
				assert.instanceOf(err, Zotero.CollectionTreeRow.SearchError);
			}
			finally {
				stub.restore();
			}
		});

		it("should propagate SearchError through getItems()", async function () {
			var stub = stubBrokenSearch(collectionTreeRow);
			try {
				var err;
				try {
					await collectionTreeRow.getItems();
				}
				catch (e) {
					err = e;
				}
				assert.ok(err, 'getItems() should throw');
				assert.instanceOf(err, Zotero.CollectionTreeRow.SearchError);
			}
			finally {
				stub.restore();
			}
		});

		it("should propagate SearchError through getTags()", async function () {
			var stub = stubBrokenSearch(collectionTreeRow);
			try {
				var err;
				try {
					await collectionTreeRow.getTags();
				}
				catch (e) {
					err = e;
				}
				assert.ok(err, 'getTags() should throw');
				assert.instanceOf(err, Zotero.CollectionTreeRow.SearchError);
			}
			finally {
				stub.restore();
			}
		});
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
});