"use strict";

describe("Advanced Search", function () {
	var win, zp, deck;
	
	before(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
		deck = win.document.getElementById('zotero-advanced-search-pane-deck');
	});
	
	after(function () {
		win.close();
	});
	
	it("should perform a search", async function () {
		var item = await createDataObject('item', { setTitle: true });
		var otherItem = await createDataObject('item', { setTitle: true });
		
		await zp.toggleAdvancedSearchState('open');
		var pane = deck.pane;
		
		// Opening the pane shouldn't filter the items list
		await zp.itemsView.waitForLoad();
		assert.equal(zp.itemsView.rowCount, 2);
		
		// Add condition
		var s = new Zotero.Search();
		s.libraryID = item.libraryID;
		s.addCondition('title', 'is', item.getField('title'));
		pane.search = s;
		
		// Run search and wait for results
		var iv = zp.itemsView;
		await pane.submit();
		await iv.waitForLoad();
		
		// Check results
		assert.equal(iv.rowCount, 1);
		var index = iv.getRowIndexByID(item.id);
		assert.isNumber(index);
		
		// Closing should restore the unfiltered view
		await zp.setAdvancedSearchState('closed');
		assert.equal(iv.rowCount, 2);
		
		await item.eraseTx();
		await otherItem.eraseTx();
	});
	
	it("shouldn't invalidate the collection tree row when clearing an unset advanced search", async function () {
		// setAdvancedSearch() returns whether the row's filter changed, which
		// setFilter() uses to decide whether to refresh the items list
		let row = zp.getCollectionTreeRow();
		// Nothing to clear
		assert.isFalse(row.setAdvancedSearch(null));
		
		let s = new Zotero.Search();
		s.libraryID = Zotero.Libraries.userLibraryID;
		s.addCondition('title', 'is', 'foo');
		// Applying and clearing a search are changes; clearing again isn't
		assert.isTrue(row.setAdvancedSearch(s));
		assert.isTrue(row.setAdvancedSearch(null));
		assert.isFalse(row.setAdvancedSearch(null));
	});
	
	it("should seed from the quick search text and reset on close", async function () {
		var match = await createDataObject('item', { title: "alpha beta" });
		var partial = await createDataObject('item', { title: "alpha gamma" });
		var neither = await createDataObject('item', { title: "delta" });

		var searchBox = win.document.getElementById('zotero-tb-search');
		searchBox.value = 'alpha beta';
		await zp.itemsView.setFilter('search', 'alpha beta');

		await zp.openAdvancedSearchFromQuickSearch('alpha beta', 'fields');
		var iv = zp.itemsView;
		await iv.waitForLoad();

		// One "Any Field" condition per word, joined with "all"
		var conditions = Object.values(deck.pane.search.getConditions())
			.filter(c => c.condition === 'anyField');
		assert.lengthOf(conditions, 2);
		assert.sameMembers(conditions.map(c => c.value), ['alpha', 'beta']);

		// Only the item matching both words, and the quick search field is cleared
		assert.equal(iv.rowCount, 1);
		assert.isNumber(iv.getRowIndexByID(match.id));
		assert.equal(searchBox.value, '');

		// Closing resets to an unfiltered view (doesn't restore the quick search)
		await zp.setAdvancedSearchState('closed');
		await iv.waitForLoad();
		assert.equal(iv.rowCount, 3);

		await Zotero.Items.erase([match.id, partial.id, neither.id]);
	});
	
	it("should seed an \"Everything\" quick search as full-text groups", async function () {
		await zp.openAdvancedSearchFromQuickSearch('alpha beta', 'everything');
		await zp.itemsView.waitForLoad();

		// Each word -> an "any" group of [Any Field, Full Text Content]
		var conds = Object.values(deck.pane.search.getConditions());
		assert.lengthOf(conds.filter(c => c.condition === 'groupStart'), 2);
		assert.lengthOf(conds.filter(c => c.condition === 'anyField'), 2);
		assert.sameMembers(
			conds.filter(c => c.condition === 'fulltextContent').map(c => c.value),
			['alpha', 'beta']
		);

		await zp.setAdvancedSearchState('closed');
	});
	it("should prefill a Title/Creator/Year quick search, restricted to top-level items", async function () {
		// A top-level item whose title matches both words, and an item whose only match is a
		// child attachment's title (which shouldn't broaden a top-level-only search)
		var topMatch = await createDataObject('item', { title: "alpha beta" });
		var childOnly = await createDataObject('item', { title: "zzznomatch" });
		var attachment = await importPDFAttachment(childOnly);
		attachment.setField('title', 'alpha beta');
		await attachment.saveTx();

		await zp.openAdvancedSearchFromQuickSearch('alpha beta', 'titleCreatorYear');
		var iv = zp.itemsView;
		await iv.waitForLoad();

		// One "Title, Creator, Year" condition per word, plus a result level of item
		var conds = Object.values(deck.pane.search.getConditions());
		var tcy = conds.filter(c => c.condition === 'titleCreatorYear');
		assert.lengthOf(tcy, 2);
		assert.sameMembers(tcy.map(c => c.value), ['alpha', 'beta']);
		assert.isTrue(conds.some(c => c.condition === 'resultLevel' && c.operator === 'item'));

		// The top-level title matches; the child attachment's matching title doesn't broaden it
		assert.equal(iv.rowCount, 1);
		assert.isNumber(iv.getRowIndexByID(topMatch.id));

		await zp.setAdvancedSearchState('closed');
		await topMatch.eraseTx();
		await childOnly.eraseTx();
	});

	it("should run a cross-level search across a multi-collection selection", async function () {
		var word = 'zmc' + Zotero.Utilities.randomString();
		var makeMatch = async function (collection) {
			var item = await createDataObject('item', { collections: [collection.id] });
			var attachment = await importPDFAttachment(item);
			await createAnnotation('highlight', attachment, { comment: 'foo ' + word + ' bar' });
			return item;
		};
		var c1 = await createDataObject('collection');
		var c2 = await createDataObject('collection');
		var c3 = await createDataObject('collection');
		var itemA = await makeMatch(c1);
		var itemB = await makeMatch(c2);
		var itemC = await makeMatch(c3); // in an unselected collection
		
		// Select c1 and c2, leaving c3 out
		var cv = zp.collectionsView;
		await cv.selectByID("C" + c1.id);
		await waitForItemsLoad(win);
		cv.selection.toggleSelect(cv.getRowIndexByID("C" + c2.id));
		await zp.onCollectionSelected();
		await zp.itemsView.waitForLoad();
		
		// Top-level items with a descendant annotation matching the comment
		var s = new Zotero.Search();
		s.libraryID = Zotero.Libraries.userLibraryID;
		s.addCondition('resultLevel', 'item');
		s.addCondition('annotationComment', 'contains', word);
		
		var iv = zp.itemsView;
		await iv.setFilter('advanced-search', s);
		await iv.waitForLoad();
		
		// The view merges getItems() across the selected rows (collectionViewItemTree),
		// so the cross-level search runs scoped to each collection and the results union:
		// both selected collections' matching items, but not the unselected one's
		var rows = zp.getCollectionTreeRows();
		var ids = new Set();
		for (let arr of await Promise.all(rows.map(row => row.getItems()))) {
			for (let item of arr) ids.add(item.id);
		}
		assert.sameMembers([...ids], [itemA.id, itemB.id]);
		
		await iv.setFilter('advanced-search', null);
		await selectLibrary(win);
		await Zotero.Items.erase([itemA.id, itemB.id, itemC.id]);
		await Zotero.Collections.erase([c1.id, c2.id, c3.id]);
	});
	

	it("shouldn't match an image embedded in a note", async function () {
		var item = await createDataObject('item');
		item.addTag('a');
		await item.saveTx();
		var note = new Zotero.Item('note');
		note.setNote('foo');
		note.parentItemID = item.id;
		note.addTag('a');
		await note.saveTx();
		await createEmbeddedImage(note);
		
		await zp.toggleAdvancedSearchState('open');
		var pane = deck.pane;
		
		var s = new Zotero.Search();
		s.libraryID = item.libraryID;
		s.addCondition('numTags', 'is', '0');
		pane.search = s;
		
		var iv = zp.itemsView;
		await pane.submit();
		await iv.waitForLoad();
		
		// The item and its note are tagged, so the only untagged row under the item is
		// the embedded image, which is hidden and shouldn't pull the item into the results
		assert.isFalse(iv.getRowIndexByID(item.id));
		
		await zp.setAdvancedSearchState('closed');
	});
	
	it("shouldn't show trashed items outside the trash", async function () {
		var item = await createDataObject('item', { setTitle: true });
		item.deleted = true;
		await item.saveTx();

		await zp.toggleAdvancedSearchState('open');
		var pane = deck.pane;

		var s = new Zotero.Search();
		s.libraryID = item.libraryID;
		s.addCondition('title', 'is', item.getField('title'));
		pane.search = s;

		var iv = zp.itemsView;
		await pane.submit();
		await iv.waitForLoad();

		assert.isFalse(iv.getRowIndexByID(item.id));

		await zp.setAdvancedSearchState('closed');

		await item.eraseTx();
	});

	it("should remove a trashed result and not show it again on re-run", async function () {
		var item = await createDataObject('item', { setTitle: true });

		await zp.toggleAdvancedSearchState('open');
		var pane = deck.pane;

		var s = new Zotero.Search();
		s.libraryID = item.libraryID;
		s.addCondition('title', 'is', item.getField('title'));
		pane.search = s;

		var iv = zp.itemsView;
		await pane.submit();
		await iv.waitForLoad();
		assert.isNumber(iv.getRowIndexByID(item.id));

		// Trashing the item should remove it from the results
		await Zotero.Items.trashTx(item.id);
		assert.isFalse(iv.getRowIndexByID(item.id));

		// Re-running the search shouldn't bring it back
		await pane.submit();
		await iv.waitForLoad();
		assert.isFalse(iv.getRowIndexByID(item.id));

		await zp.setAdvancedSearchState('closed');

		await item.eraseTx();
	});

	it("should show trashed items when in the trash", async function () {
		var item = await createDataObject('item', { setTitle: true });
		item.deleted = true;
		await item.saveTx();

		await selectTrash(win, item.libraryID);

		await zp.toggleAdvancedSearchState('open');
		var pane = deck.pane;

		var s = new Zotero.Search();
		s.libraryID = item.libraryID;
		s.addCondition('title', 'is', item.getField('title'));
		pane.search = s;

		var iv = zp.itemsView;
		await pane.submit();
		await iv.waitForLoad();

		assert.isNumber(iv.getRowIndexByID(item.id));

		await zp.setAdvancedSearchState('closed');
		await selectLibrary(win, item.libraryID);

		await item.eraseTx();
	});
	
	it("shouldn't reapply previous search when reopened while closing", async function () {
		var item = await createDataObject('item', { setTitle: true });
		
		await zp.toggleAdvancedSearchState('open');
		var s = new Zotero.Search();
		s.libraryID = item.libraryID;
		s.addCondition('title', 'is', 'nomatch');
		deck.pane.search = s;
		await deck.pane.submit();
		await zp.itemsView.waitForLoad();
		assert.equal(zp.itemsView.rowCount, 0);
		
		// Close and immediately reopen, without waiting, as with UI clicks
		zp.toggleAdvancedSearchState('closed');
		await zp.toggleAdvancedSearchState('open');
		await zp.itemsView.waitForLoad();
		
		// The previous search shouldn't have been reapplied
		assert.isNumber(zp.itemsView.getRowIndexByID(item.id));
		
		await zp.setAdvancedSearchState('closed');
		await item.eraseTx();
	});
	
	it("should scope results to the selected saved search", async function () {
		var inBoth = await createDataObject('item', { title: "foo bar" });
		var inSavedOnly = await createDataObject('item', { title: "foo baz" });
		var inAdvancedOnly = await createDataObject('item', { title: "bar qux" });
		
		var saved = new Zotero.Search();
		saved.libraryID = Zotero.Libraries.userLibraryID;
		saved.name = "Scope Test";
		saved.addCondition('title', 'contains', 'foo');
		await saved.saveTx();
		await select(win, saved);
		
		await zp.toggleAdvancedSearchState('open');
		var s = new Zotero.Search();
		s.libraryID = saved.libraryID;
		s.addCondition('title', 'contains', 'bar');
		deck.pane.search = s;
		
		var iv = zp.itemsView;
		await deck.pane.submit();
		await iv.waitForLoad();
		
		// Only the item matching both the saved search and the advanced search
		assert.equal(iv.rowCount, 1);
		assert.isNumber(iv.getRowIndexByID(inBoth.id));
		
		// The saved search itself shouldn't have been modified
		assert.lengthOf(Object.keys(saved.getConditions()), 1);
		
		await zp.setAdvancedSearchState('closed');
		
		await Zotero.Items.erase([inBoth.id, inSavedOnly.id, inAdvancedOnly.id]);
		await saved.eraseTx();
	});
	
	it("should scope results to multiple selected collections", async function () {
		var collection1 = await createDataObject('collection');
		var collection2 = await createDataObject('collection');
		var inFirst = await createDataObject('item', { title: "foo bar", collections: [collection1.id] });
		var inSecond = await createDataObject('item', { title: "foo baz", collections: [collection2.id] });
		var noMatch = await createDataObject('item', { title: "qux", collections: [collection2.id] });
		var notInCollections = await createDataObject('item', { title: "foo qux" });
		
		var cv = zp.collectionsView;
		await cv.selectByID("C" + collection1.id);
		await waitForItemsLoad(win);
		cv.selection.toggleSelect(cv.getRowIndexByID("C" + collection2.id));
		await zp.onCollectionSelected();
		await zp.itemsView.waitForLoad();
		
		await zp.toggleAdvancedSearchState('open');
		var s = new Zotero.Search();
		s.libraryID = Zotero.Libraries.userLibraryID;
		s.addCondition('title', 'contains', 'foo');
		deck.pane.search = s;
		
		var iv = zp.itemsView;
		await deck.pane.submit();
		await iv.waitForLoad();
		
		// Matching items from both collections, but not the non-matching item or the
		// matching item outside the selected collections (the row count also includes the
		// "2 collections selected" section header)
		assert.isNumber(iv.getRowIndexByID(inFirst.id));
		assert.isNumber(iv.getRowIndexByID(inSecond.id));
		assert.isFalse(iv.getRowIndexByID(noMatch.id));
		assert.isFalse(iv.getRowIndexByID(notInCollections.id));
		
		await zp.setAdvancedSearchState('closed');
		await selectLibrary(win);
		
		await Zotero.Items.erase([inFirst.id, inSecond.id, noMatch.id, notInCollections.id]);
		await Zotero.Collections.erase([collection1.id, collection2.id]);
	});
	
	it("should search across feeds in Feeds view", async function () {
		let feed = await createFeed();
		let feedItem = await createDataObject('feedItem', { libraryID: feed.libraryID, setTitle: true }, { skipSelect: true });
		let otherFeedItem = await createDataObject('feedItem', { libraryID: feed.libraryID, setTitle: true }, { skipSelect: true });
		
		await zp.collectionsView.selectFeeds();
		await waitForItemsLoad(win);
		
		await zp.toggleAdvancedSearchState('open');
		var s = new Zotero.Search();
		s.libraryID = Zotero.Libraries.userLibraryID;
		s.addCondition('title', 'is', feedItem.getField('title'));
		deck.pane.search = s;
		
		var iv = zp.itemsView;
		await deck.pane.submit();
		await iv.waitForLoad();
		
		assert.equal(iv.rowCount, 1);
		assert.isNumber(iv.getRowIndexByID(feedItem.id));
		
		await zp.setAdvancedSearchState('closed');
		await selectLibrary(win);

		await feed.eraseTx();
	});

	it("should scope value autocomplete to the given libraries", async function () {
		// Run the 'zotero' autocomplete provider directly with given params
		function autocomplete(searchString, params) {
			return new Promise((resolve) => {
				let search = Cc["@mozilla.org/autocomplete/search;1?name=zotero"]
					.createInstance(Ci.nsIAutoCompleteSearch);
				let listener = {
					onSearchResult(_search, result) {
						// Ignore intermediate (ongoing) updates
						if (result.searchResult == Ci.nsIAutoCompleteResult.RESULT_SUCCESS_ONGOING) {
							return;
						}
						let values = [];
						for (let i = 0; i < result.matchCount; i++) {
							values.push(result.getValueAt(i));
						}
						resolve(values);
					}
				};
				search.startSearch(searchString, JSON.stringify(params), null, listener);
			});
		}
		
		var group = await getGroup();
		var groupLibraryID = group.libraryID;
		// Autocomplete matches a value prefix, so both values start with the token
		var token = Zotero.Utilities.randomString() + ' ';
		var userPublisher = token + 'User';
		var groupPublisher = token + 'Group';
		var userItem = await createDataObject('item', { itemType: 'book' });
		userItem.setField('publisher', userPublisher);
		await userItem.saveTx();
		var groupItem = await createDataObject('item', { itemType: 'book', libraryID: groupLibraryID });
		groupItem.setField('publisher', groupPublisher);
		await groupItem.saveTx();
		
		// Scoped to the user library: only its value
		var userOnly = await autocomplete(token, { fieldName: 'publisher', libraryIDs: [Zotero.Libraries.userLibraryID] });
		assert.deepEqual(userOnly, [userPublisher]);
		
		// Scoped to both libraries: both values
		var both = await autocomplete(token, {
			fieldName: 'publisher',
			libraryIDs: [Zotero.Libraries.userLibraryID, groupLibraryID]
		});
		assert.includeMembers(both, [userPublisher, groupPublisher]);
		
		await Zotero.Items.erase([userItem.id, groupItem.id]);
	});
	
	it("should save a search in an editable group library root but not the trash", async function () {
		var group = await getGroup();
		var groupLibraryID = group.libraryID;
		
		await selectLibrary(win, groupLibraryID);
		await zp.toggleAdvancedSearchState('open');
		var pane = deck.pane;
		
		// Saving should be enabled at an editable group library root
		assert.isFalse(pane._saveButton.disabled);
		
		var s = new Zotero.Search();
		s.libraryID = groupLibraryID;
		s.addCondition('title', 'contains', 'foo');
		pane.search = s;
		// Saving prompts for a name
		var promptService = Services.prompt;
		Services.prompt = {
			prompt: (parent, title, message, nameObj) => {
				nameObj.value = 'Group Search';
				return true;
			}
		};
		try {
			await pane.save();
		}
		finally {
			Services.prompt = promptService;
		}
		
		// The search should have been saved to the group library
		var searches = await Zotero.Searches.getAll(groupLibraryID);
		assert.lengthOf(searches, 1);
		var conditions = Object.values(searches[0].getConditions());
		assert.lengthOf(conditions, 1);
		assert.equal(conditions[0].condition, 'title');
		assert.equal(conditions[0].value, 'foo');
		
		// Saving should be disabled in the trash, which can't be scoped to
		await selectTrash(win, groupLibraryID);
		await zp.toggleAdvancedSearchState('open');
		assert.isTrue(deck.pane._saveButton.disabled);
		
		await zp.setAdvancedSearchState('closed');
		await Zotero.Searches.erase(searches.map(s => s.id));
		await selectLibrary(win);
	});
	
	it("should scope a saved search to the selected collection", async function () {
		var collection = await createDataObject('collection');
		var inCollection = await createDataObject('item', { title: "scoped foo", collections: [collection.id] });
		var noMatch = await createDataObject('item', { title: "bar", collections: [collection.id] });
		var outsideCollection = await createDataObject('item', { title: "scoped foo" });
		
		await selectCollection(win, collection.id);
		await zp.toggleAdvancedSearchState('open');
		var pane = deck.pane;
		assert.isFalse(pane._saveButton.disabled);
		
		var s = new Zotero.Search();
		s.libraryID = Zotero.Libraries.userLibraryID;
		s.addCondition('title', 'contains', 'scoped');
		pane.search = s;
		
		var promptService = Services.prompt;
		Services.prompt = {
			prompt: (parent, title, message, nameObj) => {
				nameObj.value = 'Collection Scoped';
				return true;
			}
		};
		try {
			await pane.save();
		}
		finally {
			Services.prompt = promptService;
		}
		
		var saved = (await Zotero.Searches.getAll(Zotero.Libraries.userLibraryID))
			.find(x => x.name == 'Collection Scoped');
		assert.ok(saved);
		// The collection scope is a top-level condition above the existing one
		var conditions = Object.values(saved.getConditions());
		assert.equal(conditions[0].condition, 'collection');
		assert.equal(conditions[0].value, collection.key);
		// Only the matching item within the collection
		var ids = await saved.search();
		assert.sameMembers(ids, [inCollection.id]);
		
		await saved.eraseTx();
		await Zotero.Items.erase([inCollection.id, noMatch.id, outsideCollection.id]);
		await collection.eraseTx();
		await selectLibrary(win);
	});

	it("should step the best-match cutoff from 'all' to 1 and back", async function () {
		await zp.toggleAdvancedSearchState('open');
		let pane = deck.pane;
		let input = pane.querySelector('.best-match-topk-input');
		assert.equal(input.value, '');

		// The browser floors a step at min=0 in both directions; the direction
		// is inferred from the previous value
		input.value = '0';
		input.dispatchEvent(new win.Event('input', { bubbles: true }));
		assert.equal(input.value, '1');

		input.value = '0';
		input.dispatchEvent(new win.Event('input', { bubbles: true }));
		assert.equal(input.value, '');

		await zp.setAdvancedSearchState('closed');
	});

	it("should keep the bestMatch marker at the root when scoping a 'Match any' search", async function () {
		var collection = await createDataObject('collection');
		await selectCollection(win, collection.id);
		await zp.toggleAdvancedSearchState('open');
		var pane = deck.pane;

		var s = new Zotero.Search();
		s.libraryID = Zotero.Libraries.userLibraryID;
		s.addCondition('resultLevel', 'item');
		s.addCondition('joinMode', 'any');
		s.addCondition('title', 'contains', 'flagfoo');
		s.addCondition('creator', 'contains', 'flagbar');
		s.addCondition('bestMatch', '5', 'some query');
		pane.search = s;

		var promptService = Services.prompt;
		Services.prompt = {
			prompt: (parent, title, message, nameObj) => {
				nameObj.value = 'Scoped Semantic';
				return true;
			}
		};
		try {
			await pane.save();
		}
		finally {
			Services.prompt = promptService;
		}

		var saved = (await Zotero.Searches.getAll(Zotero.Libraries.userLibraryID))
			.find(x => x.name == 'Scoped Semantic');
		assert.ok(saved);
		// The 'any' conditions were wrapped in a group, but the bestMatch marker
		// stayed at the root, where getBestMatchQuery() finds it
		assert.deepEqual(saved.getBestMatchQuery(), { query: 'some query', topK: 5 });

		await saved.eraseTx();
		await collection.eraseTx();
		await selectLibrary(win);
	});

	it("should group the scope and the existing conditions when saving an 'any' search with a collection and a saved search selected", async function () {
		var scopeSearch = new Zotero.Search();
		scopeSearch.libraryID = Zotero.Libraries.userLibraryID;
		scopeSearch.name = "Scope Search";
		scopeSearch.addCondition('title', 'contains', 'blue');
		await scopeSearch.saveTx();
		var collection = await createDataObject('collection');
		// Matches a condition and is in the collection
		var inCollection = await createDataObject('item', { title: "red apple", collections: [collection.id] });
		// Matches a condition and the scope search
		var inScopeSearch = await createDataObject('item', { title: "blue sky" });
		// Matches a condition but is in neither scope
		var outsideScopes = await createDataObject('item', { title: "red car" });
		// In the collection but matches no condition
		var noMatch = await createDataObject('item', { title: "green grass", collections: [collection.id] });
		
		var cv = zp.collectionsView;
		await cv.selectByID("C" + collection.id);
		await waitForItemsLoad(win);
		cv.selection.toggleSelect(cv.getRowIndexByID("S" + scopeSearch.id));
		await zp.onCollectionSelected();
		await zp.itemsView.waitForLoad();
		
		await zp.toggleAdvancedSearchState('open');
		var pane = deck.pane;
		var s = new Zotero.Search();
		s.libraryID = Zotero.Libraries.userLibraryID;
		s.addCondition('joinMode', 'any');
		s.addCondition('title', 'contains', 'red');
		s.addCondition('title', 'contains', 'sky');
		pane.search = s;
		
		var promptService = Services.prompt;
		Services.prompt = {
			prompt: (parent, title, message, nameObj) => {
				nameObj.value = 'Scoped Any Search';
				return true;
			}
		};
		try {
			await pane.save();
		}
		finally {
			Services.prompt = promptService;
		}
		
		var saved = (await Zotero.Searches.getAll(Zotero.Libraries.userLibraryID))
			.find(x => x.name == 'Scoped Any Search');
		assert.ok(saved);
		// An 'any' group of the two scopes ANDed with an 'any' group of the conditions
		var conditions = Object.values(saved.getConditions());
		assert.lengthOf(conditions.filter(c => c.condition == 'groupStart'), 2);
		assert.isTrue(conditions.some(c => c.condition == 'collection' && c.value == collection.key));
		assert.isTrue(conditions.some(c => c.condition == 'savedSearch' && c.value == scopeSearch.key));
		var ids = await saved.search();
		assert.sameMembers(ids, [inCollection.id, inScopeSearch.id]);
		
		await saved.eraseTx();
		await Zotero.Items.erase([inCollection.id, inScopeSearch.id, outsideScopes.id, noMatch.id]);
		await collection.eraseTx();
		await scopeSearch.eraseTx();
		await selectLibrary(win);
	});
	
	it("should close the saved-search editor when the edited search is deleted", async function () {
		var saved = await createDataObject('search', { name: "DeleteWhileEditing" });
		await select(win, saved);
		await zp.setSavedSearchEditorState('open');
		assert.equal(deck.state, 'open');
		assert.equal(deck.selectedSearchType, 'saved');

		// Deleting the search being edited should close the editor without a
		// save-changes prompt (which would otherwise block here)
		await saved.eraseTx();
		for (let i = 0; i < 60 && deck.state !== 'closed'; i++) {
			await Zotero.Promise.delay(50);
		}
		assert.equal(deck.state, 'closed');

		await selectLibrary(win);
	});

	it("should close the saved-search editor without prompting when the edited search is trashed", async function () {
		var saved = await createDataObject('search', { name: "TrashWhileEditing" });
		await select(win, saved);
		await zp.setSavedSearchEditorState('open');
		assert.equal(deck.state, 'open');
		assert.equal(deck.selectedSearchType, 'saved');

		// Trashing the search being edited should close the editor without a
		// save-changes prompt, as when it's deleted outright
		let stub = sinon.stub().returns(1);
		let promptService = win.Services.prompt;
		win.Services.prompt = { confirmEx: stub };
		try {
			saved.deleted = true;
			await saved.saveTx();
			for (let i = 0; i < 60 && deck.state !== 'closed'; i++) {
				await Zotero.Promise.delay(50);
			}
			assert.equal(deck.state, 'closed');
			assert.equal(stub.callCount, 0);
		}
		finally {
			win.Services.prompt = promptService;
		}

		await saved.eraseTx();
		await selectLibrary(win);
	});

	it("should revert to the edited search without re-prompting when canceling", async function () {
		var search1 = await createDataObject('search', { name: "CancelEditing1" });
		var search2 = await createDataObject('search', { name: "CancelEditing2" });
		let cv = zp.collectionsView;

		await select(win, search1);
		await zp.setSavedSearchEditorState('open');
		assert.equal(deck.selectedSearchType, 'saved');

		// zoteroPane.js uses the pane window's Services, so stub there. Set it before
		// touching the selection so no prompt can reach the real (modal) service.
		let stub = sinon.stub().returns(1); // Cancel
		let promptService = win.Services.prompt;
		win.Services.prompt = { confirmEx: stub };
		try {
			// Form a [search1, search2] multi-selection without firing a selection change
			cv.selection.selectEventsSuppressed = true;
			cv.selection.select(cv.getRowIndexByID("S" + search1.id));
			cv.selection.toggleSelect(cv.getRowIndexByID("S" + search2.id));
			cv.selection.selectEventsSuppressed = false;

			await zp.onCollectionSelected();
			// Prompted once (no loop) and reverted to just the edited search
			assert.equal(stub.callCount, 1);
			assert.deepEqual(cv.getSelectedRows().map(r => r.id), ["S" + search1.id]);
		}
		finally {
			win.Services.prompt = promptService;
		}

		await zp.setSavedSearchEditorState('closed');
		await Zotero.Searches.erase([search1.id, search2.id]);
		await selectLibrary(win);
	});

	it("should run a focused button's action on Enter instead of the pane default", async function () {
		var saved = await createDataObject('search', { name: "EnterOnCancel" });
		await select(win, saved);
		await zp.setSavedSearchEditorState('open');
		assert.equal(deck.selectedSearchType, 'saved');
		
		var savedPane = deck.pane;
		var save = sinon.stub(savedPane, 'save');
		var cancel = sinon.stub(savedPane, 'cancel');
		try {
			var cancelButton = savedPane.querySelector('.cancel-button');
			cancelButton.focus();
			cancelButton.dispatchEvent(
				new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
			);
			// Enter on the focused Cancel button cancels -- it mustn't save
			assert.isTrue(save.notCalled);
			assert.isTrue(cancel.called);
		}
		finally {
			save.restore();
			cancel.restore();
		}
		
		await zp.setSavedSearchEditorState('closed');
		await saved.eraseTx();
		await selectLibrary(win);
	});

	it("should prompt before replacing the saved-search editor with a new advanced search", async function () {
		var saved = await createDataObject('search', { name: "ToggleWhileEditing" });
		await select(win, saved);
		await zp.setSavedSearchEditorState('open');
		
		// Edit the editor's working copy
		var searchBox = deck.pane.querySelector('zoterosearch');
		searchBox.querySelector('.conditions').firstChild.querySelector('#valuefield').value = 'edited';
		searchBox.updateSearch();
		
		let stub = sinon.stub().returns(1); // Cancel
		let promptService = win.Services.prompt;
		win.Services.prompt = { confirmEx: stub };
		try {
			// Cmd-Shift-F opens a new temporary search over the editor
			await zp.toggleAdvancedSearchState('open');
			
			// Cancel keeps the editor open with the edits intact
			assert.equal(stub.callCount, 1);
			assert.equal(deck.selectedSearchType, 'saved');
			assert.equal(deck.state, 'open');
			assert.include(
				Object.values(deck.pane.search.getConditions()).map(c => c.value), 'edited');
			
			// Save saves the edits and continues to the temporary pane
			stub.returns(0);
			await zp.toggleAdvancedSearchState('open');
			assert.equal(stub.callCount, 2);
			assert.equal(deck.selectedSearchType, 'temporary');
			assert.equal(deck.state, 'open');
			assert.include(Object.values(saved.getConditions()).map(c => c.value), 'edited');
		}
		finally {
			win.Services.prompt = promptService;
		}
		
		await zp.setAdvancedSearchState('closed');
		await saved.eraseTx();
		await selectLibrary(win);
	});

	it("should prompt for a name when saving a new search", async function () {
		await selectLibrary(win);
		await zp.toggleAdvancedSearchState('open');
		var s = new Zotero.Search();
		s.libraryID = Zotero.Libraries.userLibraryID;
		s.addCondition('title', 'contains', 'foo');
		deck.pane.search = s;

		var promptService = Services.prompt;
		try {
			// Cancelling the name prompt leaves the pane open and saves nothing
			Services.prompt = { prompt: () => false };
			await deck.pane.save();
			assert.equal(deck.state, 'open');

			// Accepting saves with the entered name and closes the pane
			Services.prompt = {
				prompt: (parent, title, message, nameObj) => {
					nameObj.value = 'My Named Search';
					return true;
				}
			};
			await deck.pane.save();
		}
		finally {
			Services.prompt = promptService;
		}

		var searches = await Zotero.Searches.getAll(Zotero.Libraries.userLibraryID);
		var saved = searches.find(x => x.name === 'My Named Search');
		assert.ok(saved);
		assert.equal(deck.state, 'closed');

		await saved.eraseTx();
	});

	describe("Conditions", function () {
		var pane, searchBox, conditions;
		
		before(async function () {
			await zp.toggleAdvancedSearchState('open');
			pane = deck.pane;
			searchBox = pane.querySelector('zoterosearch');
			conditions = searchBox.querySelector('.conditions');
		});
		
		after(async function () {
			await zp.setAdvancedSearchState('closed');
		});

		it("should reset to a single empty condition when the last populated condition is removed", async function () {
			var s = new Zotero.Search();
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.addCondition('title', 'contains', 'foo');
			pane.search = s;

			assert.lengthOf(conditions.childNodes, 1);
			var row = conditions.firstChild;

			// With a value entered, the last condition can be removed
			assert.notEqual(row.querySelector('#remove').getAttribute('disabled'), 'true');

			row.onRemoveClicked();

			// It's replaced by a single empty default condition with the remove button disabled
			assert.lengthOf(conditions.childNodes, 1);
			var newRow = conditions.firstChild;
			assert.equal(newRow.selectedCondition, 'title');
			assert.equal(newRow.querySelector('#valuefield').value, '');
			assert.equal(newRow.querySelector('#remove').getAttribute('disabled'), 'true');

			// Focus moves to the new condition's drop-down
			assert.equal(win.document.activeElement, newRow.querySelector('#conditionsmenu'));
		});
		it("should hide the value textbox for a menu-based condition", async function () {
			var s = new Zotero.Search();
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.addCondition('title', 'is', '');
			pane.search = s;
			
			var row = conditions.firstChild;
			row.onConditionSelected('fileTypeID');
			
			// File Type uses a value menu, so the textbox must actually be hidden, not just
			// sitting alongside the menu
			var valuefield = row.querySelector('#valuefield');
			assert.isTrue(valuefield.hidden);
			assert.equal(win.getComputedStyle(valuefield).display, 'none');
			assert.isFalse(row.querySelector('#valuemenu').hidden);
		});
		
		it("should blank the value field for an isEmpty condition", async function () {
			var s = new Zotero.Search();
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.addCondition('place', 'isEmpty', '');
			pane.search = s;
			
			// The value field keeps its space in the row but must not be visible, and the
			// other value controls are hidden
			var row = conditions.firstChild;
			var valuefield = row.querySelector('#valuefield');
			assert.isFalse(valuefield.hidden);
			assert.equal(win.getComputedStyle(valuefield).visibility, 'hidden');
			assert.isTrue(row.querySelector('#valuemenu').hidden);
			assert.isTrue(row.querySelector('#value-date-age').hidden);
			
			// The row serializes with no value
			var data = row.getConditionData();
			assert.equal(data.condition, 'place');
			assert.equal(data.operator, 'isEmpty');
			assert.equal(data.value, '');
		});
		
		it("should keep a loaded annotationAuthor value while its author menu is populating", async function () {
			var deferred = Zotero.Promise.defer();
			var stub = sinon.stub(Zotero.Annotations, 'getAllAuthors').returns(deferred.promise);
			try {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('annotationAuthor', 'is', '12345');
				pane.search = s;
				
				// Serializing while the author list is still loading shouldn't drop the value
				var row = conditions.firstChild;
				assert.equal(row.getConditionData().value, '12345');
				
				deferred.resolve([{ name: "Some User", userID: 12345 }]);
				// Let onConditionSelected() finish populating the menu
				await Zotero.Promise.delay(0);
				assert.isFalse(row.querySelector('#valuemenu').hidden);
				assert.equal(row.getConditionData().value, '12345');
			}
			finally {
				stub.restore();
			}
		});

		it("should place attachment and annotation conditions in their submenus", function () {
			var s = new Zotero.Search();
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.addCondition('title', 'is', '');
			pane.search = s;

			var row = conditions.firstChild;
			var attachmentMenu = row.querySelector('#attachment-conditions-menu');
			var annotationMenu = row.querySelector('#annotation-conditions-menu');

			// An attachment-level condition is in the Attachment submenu rather than at
			// the top level of the conditions menu
			assert.isFalse(row.isPrimaryCondition('fileTypeID'));
			assert.ok(attachmentMenu.querySelector('menuitem[value="fileTypeID"]'));

			// An annotation-level condition is in the Annotation submenu
			assert.isFalse(row.isPrimaryCondition('annotationColor'));
			assert.ok(annotationMenu.querySelector('menuitem[value="annotationColor"]'));

			// Selecting one shows its full name as the closed-menu label
			row.onConditionSelected('annotationColor');
			assert.equal(row.selectedCondition, 'annotationColor');
			assert.equal(
				row.querySelector('#conditionsmenu').getAttribute('label'),
				Zotero.SearchConditions.getLocalizedName('annotationColor')
			);
		});

		it("should sort the submenus alphabetically among the top-level conditions", function () {
			var s = new Zotero.Search();
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.addCondition('title', 'is', '');
			pane.search = s;

			var row = conditions.firstChild;
			var popup = row.querySelector('#conditionsmenu > menupopup');

			// Top-level entries (including the Attachment/Annotation submenus) are in
			// alphabetical order, with the catch-all "More" submenu kept last
			var labels = [...popup.children]
				.filter(node => node.id != 'more-conditions-menu')
				.map(node => node.getAttribute('label'));
			var collation = Zotero.getLocaleCollation();
			var sorted = [...labels].sort((a, b) => collation.compareString(1, a, b));
			assert.deepEqual(labels, sorted);
			assert.equal(popup.lastElementChild.id, 'more-conditions-menu');
		});

		it("should keep an edited value when switching to another text condition", async function () {
			var s = new Zotero.Search();
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.addCondition('title', 'contains', '');
			pane.search = s;

			var row = conditions.firstChild;
			// Simulate the user typing into the value field after the row was loaded
			row.querySelector('#valuefield').value = 'foo';

			row.onConditionSelected('publicationTitle');

			// The typed value carries over rather than reverting to the stale loaded value
			assert.equal(row.querySelector('#valuefield').value, 'foo');
			assert.equal(row.getConditionData().value, 'foo');
		});


		describe("Find-as-you-type", function () {
			function typeInMenu(menu, str) {
				for (let ch of str) {
					menu.dispatchEvent(new win.KeyboardEvent('keydown', {
						key: ch,
						bubbles: true,
						cancelable: true
					}));
				}
			}

			it("should select a condition from the More submenu by typing its name", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;

				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');

				// "Language" lives in the More submenu, so it's only reachable via type-ahead
				assert.isFalse(searchCondition.isPrimaryCondition('language'));
				typeInMenu(conditionsMenu, 'lang');
				assert.equal(searchCondition.selectedCondition, 'language');
			});

			it("should cycle through matches when the same letter is typed repeatedly", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;

				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');

				typeInMenu(conditionsMenu, 'd');
				var first = searchCondition.selectedCondition;
				typeInMenu(conditionsMenu, 'd');
				var second = searchCondition.selectedCondition;

				assert.notEqual(first, second);
				assert.match(Zotero.SearchConditions.getLocalizedName(first), /^d/i);
				assert.match(Zotero.SearchConditions.getLocalizedName(second), /^d/i);
			});
		});

		describe("Keyboard", function () {
			// Focus is deferred to after the originating key event is handled
			function nextTick() {
				return new Promise(resolve => win.setTimeout(resolve));
			}

			it("should focus the new row's condition drop-down when adding via the + button", async function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;

				var before = conditions.childNodes.length;
				// Native keyboard activation of the button dispatches a click with detail 0
				conditions.firstChild.querySelector('#add').dispatchEvent(
					new win.MouseEvent('click', { detail: 0, bubbles: true, cancelable: true })
				);

				assert.equal(conditions.childNodes.length, before + 1);
				await nextTick();
				assert.equal(
					win.document.activeElement,
					conditions.lastChild.querySelector('#conditionsmenu')
				);
			});

			it("shouldn't move focus when adding via the + button with the mouse", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;

				var before = conditions.childNodes.length;
				var addButton = conditions.firstChild.querySelector('#add');
				addButton.focus();
				// A mouse click has detail >= 1
				addButton.dispatchEvent(
					new win.MouseEvent('click', { detail: 1, bubbles: true, cancelable: true })
				);

				assert.equal(conditions.childNodes.length, before + 1);
				assert.equal(win.document.activeElement, addButton);
			});

			it("should add a condition and focus its drop-down on Shift-Enter", async function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;

				var before = conditions.childNodes.length;
				conditions.firstChild.querySelector('#conditionsmenu').dispatchEvent(
					new win.KeyboardEvent('keypress', {
						key: 'Enter',
						keyCode: 13,
						shiftKey: true,
						bubbles: true,
						cancelable: true
					})
				);

				assert.equal(conditions.childNodes.length, before + 1);
				await nextTick();
				assert.equal(
					win.document.activeElement,
					conditions.lastChild.querySelector('#conditionsmenu')
				);
			});

			it("shouldn't run the search on Shift-Enter", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;

				function pressEnter(shiftKey) {
					conditions.firstChild.querySelector('#conditionsmenu').dispatchEvent(
						new win.KeyboardEvent('keydown', {
							key: 'Enter',
							shiftKey,
							bubbles: true,
							cancelable: true
						})
					);
				}

				var submit = sinon.stub(pane, 'submit');
				try {
					// Plain Enter runs the search
					pressEnter(false);
					assert.isTrue(submit.calledOnce);
					// Shift-Enter does not
					pressEnter(true);
					assert.isTrue(submit.calledOnce);
				}
				finally {
					submit.restore();
				}
			});

			// Native keyboard activation of a button dispatches a click with detail 0
			function clickFromKeyboard(button) {
				button.dispatchEvent(
					new win.MouseEvent('click', { detail: 0, bubbles: true, cancelable: true })
				);
			}

			function threeConditionSearch() {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'contains', 'a');
				s.addCondition('title', 'contains', 'b');
				s.addCondition('title', 'contains', 'c');
				pane.search = s;
			}

			it("should focus the next row's remove button when removing via the keyboard", async function () {
				threeConditionSearch();
				assert.equal(conditions.childNodes.length, 3);

				// Remove the first row
				clickFromKeyboard(conditions.childNodes[0].querySelector('#remove'));

				assert.equal(conditions.childNodes.length, 2);
				await nextTick();
				// Focus moves to the row that took its place
				assert.equal(
					win.document.activeElement,
					conditions.childNodes[0].querySelector('#remove')
				);
			});

			it("should focus the previous row's remove button when removing the last row", async function () {
				threeConditionSearch();

				// Remove the last row
				clickFromKeyboard(conditions.childNodes[2].querySelector('#remove'));

				assert.equal(conditions.childNodes.length, 2);
				await nextTick();
				// Focus moves up to the new last row
				assert.equal(
					win.document.activeElement,
					conditions.childNodes[1].querySelector('#remove')
				);
			});
			
			it("should focus the row that took a pruned group's place when removing via the keyboard", async function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'contains', 'a');
				s.addCondition('groupStart', 'true', '');
				s.addCondition('tag', 'is', 'x');
				s.addCondition('groupEnd', 'true', '');
				s.addCondition('title', 'contains', 'b');
				pane.search = s;
				
				// Removing the group's only condition prunes the group itself
				var group = conditions.querySelector('search-condition-group');
				clickFromKeyboard(group.conditionsContainer.firstChild.querySelector('#remove'));
				
				assert.notOk(conditions.querySelector('search-condition-group'));
				assert.lengthOf(conditions.children, 2);
				await nextTick();
				// Focus lands on the row that took the group's place ('b'), not the first row
				assert.equal(
					win.document.activeElement,
					conditions.children[1].querySelector('#remove')
				);
			});
		});

		it("should insert a condition right after the row whose + is clicked", function () {
			var s = new Zotero.Search();
			s.libraryID = Zotero.Libraries.userLibraryID;
			s.addCondition('title', 'contains', 'a');
			s.addCondition('title', 'contains', 'b');
			pane.search = s;
			assert.lengthOf(conditions.children, 2);

			conditions.children[0].onAddClicked({ preventDefault() {} });

			// New (empty) condition lands between the two, not at the end
			var values = [...conditions.children]
				.map(row => row.querySelector('#valuefield').value);
			assert.deepEqual(values, ['a', '', 'b']);
		});

		describe("Collection", function () {
			it("should show only collections", async function () {
				var col1 = await createDataObject('collection', { name: "A" });
				var col2 = await createDataObject('collection', { name: "C", parentID: col1.id });
				var col3 = await createDataObject('collection', { name: "D", parentID: col2.id });
				var col4 = await createDataObject('collection', { name: "B" });
				var search1 = await createDataObject('search', { name: "A" });
				var search2 = await createDataObject('search', { name: "B" });
				
				// Add condition
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;
				
				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				var valueMenu = searchCondition.querySelector('#valuemenu');
				
				assert.isTrue(valueMenu.hidden);
				// Select 'Collection' condition
				for (let i = 0; i < conditionsMenu.itemCount; i++) {
					let menuitem = conditionsMenu.getItemAtIndex(i);
					if (menuitem.value == 'collection') {
						menuitem.click();
						break;
					}
				}
				
				assert.isFalse(valueMenu.hidden);
				// Only the collections, with the saved searches no longer mixed in
				assert.equal(valueMenu.itemCount, 4);
				// Subcollections are indented via a margin on the icon
				function getIndent(menuitem) {
					return win.getComputedStyle(menuitem.querySelector('.menu-icon'))
						.marginInlineStart;
				}
				var valueMenuItem = valueMenu.getItemAtIndex(1);
				assert.equal(valueMenuItem.getAttribute('label'), col2.name);
				assert.equal(valueMenuItem.getAttribute('value'), "C" + col2.key);
				assert.equal(getIndent(valueMenuItem), '16px');
				valueMenuItem = valueMenu.getItemAtIndex(2);
				assert.equal(valueMenuItem.getAttribute('label'), col3.name);
				assert.equal(valueMenuItem.getAttribute('value'), "C" + col3.key);
				assert.equal(getIndent(valueMenuItem), '32px');
				var values = [];
				for (let i = 0; i < valueMenu.itemCount; i++) {
					values.push(valueMenu.getItemAtIndex(i).getAttribute('value'));
				}
				assert.notInclude(values, "S" + search1.key);
				assert.notInclude(values, "S" + search2.key);
				
				await Zotero.Collections.erase([col1.id, col2.id, col3.id, col4.id]);
				await Zotero.Searches.erase([search1.id, search2.id]);
			});
			
			it("should update when the library is changed", async function () {
				var group = await getGroup();
				var groupLibraryID = group.libraryID;
				
				var collection1 = await createDataObject('collection', { name: "A" });
				var collection2 = await createDataObject('collection', { name: "C", libraryID: groupLibraryID });
				
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;
				
				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				var valueMenu = searchCondition.querySelector('#valuemenu');
				
				// Select 'Collection' condition
				for (let i = 0; i < conditionsMenu.itemCount; i++) {
					let menuitem = conditionsMenu.getItemAtIndex(i);
					if (menuitem.value == 'collection') {
						menuitem.click();
						break;
					}
				}
				for (let i = 0; i < valueMenu.itemCount; i++) {
					let menuitem = valueMenu.getItemAtIndex(i);
					if (menuitem.getAttribute('value') == "C" + collection1.key) {
						menuitem.click();
						break;
					}
				}
				assert.equal(valueMenu.value, "C" + collection1.key);
				
				// Switch to the group library in the collection tree, which changes
				// the search library and re-renders the conditions
				await selectLibrary(win, groupLibraryID);
				
				var values = [];
				searchCondition = conditions.firstChild;
				valueMenu = searchCondition.querySelector('#valuemenu');
				assert.equal(valueMenu.value, "C" + collection2.key);
				for (let i = 0; i < valueMenu.itemCount; i++) {
					let menuitem = valueMenu.getItemAtIndex(i);
					values.push(menuitem.getAttribute('value'));
				}
				assert.notInclude(values, "C" + collection1.key);
				assert.include(values, "C" + collection2.key);
				
				await selectLibrary(win);

				await Zotero.Collections.erase([collection1.id, collection2.id]);
			});
			
			it("shouldn't appear in a cross-library scope", async function () {
				var group = await getGroup();
				var groupLibraryID = group.libraryID;
				
				// Simulate the cross-library scope that advancedSearchPane.refresh() sets
				// from a multi-library collection selection
				searchBox.scopeLibraryIDs = [Zotero.Libraries.userLibraryID, groupLibraryID];
				try {
					var s = new Zotero.Search();
					s.libraryID = Zotero.Libraries.userLibraryID;
					s.addCondition('title', 'is', '');
					pane.search = s;
					
					var searchCondition = conditions.firstChild;
					var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
					
					// Neither Collection nor Saved Search can resolve across libraries
					for (let i = 0; i < conditionsMenu.itemCount; i++) {
						assert.notEqual(conditionsMenu.getItemAtIndex(i).value, 'collection');
						assert.notEqual(conditionsMenu.getItemAtIndex(i).value, 'savedSearch');
					}
				}
				finally {
					searchBox.scopeLibraryIDs = null;
				}
			});
		});
		
		describe("Saved Search", function () {
			it("should appear as a condition", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;

				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');

				var values = [];
				for (let i = 0; i < conditionsMenu.itemCount; i++) {
					values.push(conditionsMenu.getItemAtIndex(i).value);
				}
				assert.include(values, 'savedSearch');
			});
			
			it("should show only saved searches", async function () {
				var collection = await createDataObject('collection', { name: "A" });
				var search1 = await createDataObject('search', { name: "A" });
				var search2 = await createDataObject('search', { name: "B" });
				
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;
				
				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				var valueMenu = searchCondition.querySelector('#valuemenu');
				
				assert.isTrue(valueMenu.hidden);
				// Select 'Saved Search' condition
				for (let i = 0; i < conditionsMenu.itemCount; i++) {
					let menuitem = conditionsMenu.getItemAtIndex(i);
					if (menuitem.value == 'savedSearch') {
						menuitem.click();
						break;
					}
				}
				
				assert.isFalse(valueMenu.hidden);
				var values = [];
				for (let i = 0; i < valueMenu.itemCount; i++) {
					values.push(valueMenu.getItemAtIndex(i).getAttribute('value'));
				}
				assert.sameMembers(values, ["S" + search1.key, "S" + search2.key]);
				assert.notInclude(values, "C" + collection.key);
				
				await collection.eraseTx();
				await Zotero.Searches.erase([search1.id, search2.id]);
			});
			
			it("should be selected for a 'savedSearch' condition", async function () {
				var search = await createDataObject('search', { name: "A" });
				
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('savedSearch', 'is', search.key);
				pane.search = s;
				
				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				var valueMenu = searchCondition.querySelector('#valuemenu');
				
				assert.equal(conditionsMenu.selectedItem.value, 'savedSearch');
				assert.isFalse(valueMenu.hidden);
				assert.equal(valueMenu.selectedItem.value, "S" + search.key);
				
				await search.eraseTx();
			});
			
			it("should set a 'savedSearch' condition when a search is selected", async function () {
				var search = await createDataObject('search', { name: "B" });
				
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;
				
				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				var valueMenu = searchCondition.querySelector('#valuemenu');
				
				// Select 'Saved Search' condition
				for (let i = 0; i < conditionsMenu.itemCount; i++) {
					let menuitem = conditionsMenu.getItemAtIndex(i);
					if (menuitem.value == 'savedSearch') {
						menuitem.click();
						break;
					}
				}
				for (let i = 0; i < valueMenu.itemCount; i++) {
					let menuitem = valueMenu.getItemAtIndex(i);
					if (menuitem.getAttribute('value') == "S" + search.key) {
						menuitem.click();
						break;
					}
				}
				
				searchBox.updateSearch();
				var condition = searchBox.search.getConditions()[0];
				assert.equal(condition.condition, 'savedSearch');
				assert.equal(condition.value, search.key);
				
				await search.eraseTx();
			});
		});
		
		describe("Search subcollections", function () {
			it("should appear only when there's a Collection condition", async function () {
				var collection = await createDataObject('collection');
				
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'is', '');
				pane.search = s;
				
				var options = searchBox.querySelector('#search-option-checkboxes');
				// Hidden while the search has no Collection condition to recurse into
				assert.isTrue(options.hidden);
				
				// Switch the row to a Collection condition
				var conditionsMenu = conditions.firstChild.querySelector('#conditionsmenu');
				for (let i = 0; i < conditionsMenu.itemCount; i++) {
					let menuitem = conditionsMenu.getItemAtIndex(i);
					if (menuitem.value == 'collection') {
						menuitem.click();
						break;
					}
				}
				
				assert.isFalse(options.hidden);
				
				await collection.eraseTx();
			});
		});
		
		describe("Groups", function () {
			function groupedSearch() {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'contains', 'foo');
				s.addCondition('groupStart', 'true', '');
				s.addCondition('joinMode', 'any');
				s.addCondition('tag', 'is', 'x');
				s.addCondition('tag', 'is', 'y');
				s.addCondition('groupEnd', 'true', '');
				return s;
			}

			it("should render a nested group from group markers", function () {
				pane.search = groupedSearch();

				// Root holds the title row plus one nested group
				assert.lengthOf(conditions.children, 2);
				var group = conditions.querySelector('search-condition-group');
				assert.equal(group.joinMode, 'any');
				assert.lengthOf(group.conditionsContainer.children, 2);
				assert.equal(group.conditionsContainer.firstChild.selectedCondition, 'tag');
			});

			it("should serialize a nested group back to markers", function () {
				pane.search = groupedSearch();
				searchBox.updateSearch();

				var sequence = Object.values(searchBox.search.getConditions())
					.map(c => c.condition);
				assert.deepEqual(sequence,
					['title', 'groupStart', 'joinMode', 'tag', 'tag', 'groupEnd']);
			});

			it("should wrap a condition in a new group in its place", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'contains', 'foo');
				pane.search = s;

				conditions.firstChild.onGroupClicked({ preventDefault() {} });

				// The condition is now the sole member of a group in its old place,
				// keeping its value
				assert.lengthOf(conditions.children, 1);
				var group = conditions.querySelector('search-condition-group');
				assert.lengthOf(group.conditionsContainer.children, 1);
				var row = group.conditionsContainer.firstChild;
				assert.equal(row.selectedCondition, 'title');
				assert.equal(row.querySelector('#valuefield').value, 'foo');
			});

			it("should ungroup a group back into its parent", function () {
				pane.search = groupedSearch();

				var group = conditions.querySelector('search-condition-group');
				group.onUngroupClicked();

				// The group is gone and its two tag conditions now sit alongside the title row
				assert.notOk(conditions.querySelector('search-condition-group'));
				searchBox.updateSearch();
				var sequence = Object.values(searchBox.search.getConditions())
					.map(c => c.condition);
				assert.deepEqual(sequence, ['title', 'tag', 'tag']);
			});

			it("should remove a group when its last condition is removed", function () {
				pane.search = groupedSearch();

				var group = conditions.querySelector('search-condition-group');
				group.conditionsContainer.firstChild.onRemoveClicked();
				// Removing the group's first tag leaves it with the second
				assert.ok(conditions.querySelector('search-condition-group'));
				group.conditionsContainer.firstChild.onRemoveClicked();

				// With no conditions left, the group itself is gone
				assert.notOk(conditions.querySelector('search-condition-group'));
				// The root's title condition remains
				assert.lengthOf(conditions.children, 1);
				assert.equal(conditions.firstChild.selectedCondition, 'title');
			});

			it("should reset the root to an empty condition when its last group empties", function () {
				// A search whose only content is a single group with a single condition
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('groupStart', 'true', '');
				s.addCondition('tag', 'is', 'x');
				s.addCondition('groupEnd', 'true', '');
				pane.search = s;

				var group = conditions.querySelector('search-condition-group');
				group.conditionsContainer.firstChild.onRemoveClicked();

				// The emptied group is gone and the root falls back to one empty condition
				assert.notOk(conditions.querySelector('search-condition-group'));
				assert.lengthOf(conditions.children, 1);
				assert.equal(conditions.firstChild.selectedCondition, 'title');
				assert.equal(conditions.firstChild.querySelector('#valuefield').value, '');
			});

			it("should default a fresh search to the top-level item result level", function () {
				// Opening a new (unseeded) advanced search defaults the result level to
				// top-level items, so child conditions map up without grouping
				pane.search = null;
				assert.equal(searchBox.rootGroup.resultLevel, 'item');
			});

			it("should render and serialize the root result level", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'annotation');
				s.addCondition('annotationText', 'contains', 'foo');
				pane.search = s;

				assert.equal(searchBox.rootGroup.resultLevel, 'annotation');

				searchBox.updateSearch();
				var sequence = Object.values(searchBox.search.getConditions())
					.map(c => c.condition);
				assert.deepEqual(sequence, ['resultLevel', 'annotationText']);
				var scopeCond = Object.values(searchBox.search.getConditions())
					.find(c => c.condition == 'resultLevel');
				assert.equal(scopeCond.operator, 'annotation');
			});

			it("should render and serialize a nested group result level", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('creator', 'contains', 'Smith');
				s.addCondition('groupStart', 'true', '');
				s.addCondition('resultLevel', 'annotation');
				s.addCondition('annotationText', 'contains', 'foo');
				s.addCondition('groupEnd', 'true', '');
				pane.search = s;

				var group = conditions.querySelector('search-condition-group');
				assert.equal(group.resultLevel, 'annotation');

				searchBox.updateSearch();
				var sequence = Object.values(searchBox.search.getConditions())
					.map(c => c.condition);
				assert.deepEqual(sequence,
					['creator', 'groupStart', 'resultLevel', 'annotationText', 'groupEnd']);
			});

			it("should show a binding menu for a group of same-level descendant conditions", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item'); // result level
				s.addCondition('groupStart', 'true', '');
				s.addCondition('annotationText', 'contains', 'foo');
				s.addCondition('annotationComment', 'contains', 'bar');
				s.addCondition('groupEnd', 'true', '');
				pane.search = s;

				var group = conditions.querySelector('search-condition-group');
				assert.isFalse(group.bindingMenu.hidden);
				var values = [...group.bindingMenu.querySelectorAll('menuitem')].map(i => i.value);
				assert.includeMembers(values, ['any', 'annotation']);
				// No attachment conditions, so it isn't offered
				assert.notInclude(values, 'attachment');

				// Bind to the same annotation and confirm it serializes
				group.resultLevel = 'annotation';
				searchBox.updateSearch();
				var seq = Object.values(searchBox.search.getConditions()).map(c => c.condition);
				assert.deepEqual(seq,
					['resultLevel', 'groupStart', 'resultLevel', 'annotationText', 'annotationComment', 'groupEnd']);
				var groupScope = Object.values(searchBox.search.getConditions())
					.filter(c => c.condition == 'resultLevel')[1];
				assert.equal(groupScope.operator, 'annotation');
			});

			it("should not show a binding menu for a group of item-level conditions", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('groupStart', 'true', '');
				s.addCondition('title', 'contains', 'a');
				s.addCondition('title', 'contains', 'b');
				s.addCondition('groupEnd', 'true', '');
				pane.search = s;

				var group = conditions.querySelector('search-condition-group');
				assert.isTrue(group.bindingMenu.hidden);
			});

			it("should render a stored group binding into the menu", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('groupStart', 'true', '');
				s.addCondition('resultLevel', 'annotation');
				s.addCondition('annotationText', 'contains', 'foo');
				s.addCondition('annotationComment', 'contains', 'bar');
				s.addCondition('groupEnd', 'true', '');
				pane.search = s;

				var group = conditions.querySelector('search-condition-group');
				assert.isFalse(group.bindingMenu.hidden);
				assert.equal(group.resultLevel, 'annotation');
				assert.equal(group.bindingMenu.value, 'annotation');
			});
			
			it("should keep showing a group binding when a condition switches level", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('groupStart', 'true', '');
				s.addCondition('resultLevel', 'annotation');
				s.addCondition('annotationText', 'contains', 'foo');
				s.addCondition('annotationComment', 'contains', 'bar');
				s.addCondition('groupEnd', 'true', '');
				pane.search = s;
				
				var group = conditions.querySelector('search-condition-group');
				assert.isFalse(group.bindingMenu.hidden);
				
				// The binding stays visible (and clearable) rather than silently
				// constraining the group from a hidden menu
				group.conditionsContainer.firstChild.onConditionSelected('title');
				searchBox.updateSearch();
				
				assert.isFalse(group.bindingMenu.hidden);
				assert.equal(group.bindingMenu.value, 'annotation');
				var seq = Object.values(searchBox.search.getConditions()).map(c => c.condition);
				assert.deepEqual(seq,
					['resultLevel', 'groupStart', 'resultLevel', 'title', 'annotationComment', 'groupEnd']);
			});
			
			it("should keep showing a group binding for a lone condition at the bound level", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('groupStart', 'true', '');
				s.addCondition('resultLevel', 'annotation');
				s.addCondition('annotationText', 'contains', 'foo');
				s.addCondition('groupEnd', 'true', '');
				pane.search = s;
				
				var group = conditions.querySelector('search-condition-group');
				assert.isFalse(group.bindingMenu.hidden);
				assert.equal(group.bindingMenu.value, 'annotation');
				searchBox.updateSearch();
				var seq = Object.values(searchBox.search.getConditions()).map(c => c.condition);
				assert.deepEqual(seq,
					['resultLevel', 'groupStart', 'resultLevel', 'annotationText', 'groupEnd']);
			});
			
			it("should drop a group binding when no condition at its level remains", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('groupStart', 'true', '');
				s.addCondition('resultLevel', 'annotation');
				s.addCondition('annotationText', 'contains', 'foo');
				s.addCondition('annotationComment', 'contains', 'bar');
				s.addCondition('groupEnd', 'true', '');
				pane.search = s;
				
				var group = conditions.querySelector('search-condition-group');
				group.conditionsContainer.firstChild.onConditionSelected('title');
				group.conditionsContainer.lastChild.onConditionSelected('title');
				searchBox.updateSearch();
				
				assert.isTrue(group.bindingMenu.hidden);
				var seq = Object.values(searchBox.search.getConditions()).map(c => c.condition);
				assert.deepEqual(seq,
					['resultLevel', 'groupStart', 'title', 'title', 'groupEnd']);
			});

			it("should offer a binding hint for ungrouped sibling descendant conditions", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('annotationText', 'contains', 'foo');
				s.addCondition('annotationComment', 'contains', 'bar');
				pane.search = s;

				var hint = searchBox.querySelector('#search-binding-hint');
				assert.isFalse(hint.hidden);
				// One bindable level (annotation), so one suggestion line with one button
				assert.lengthOf([...hint.querySelectorAll('button')], 1);
			});

			it("should not offer a binding hint for item-level sibling conditions", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('title', 'contains', 'a');
				s.addCondition('title', 'contains', 'b');
				pane.search = s;

				assert.isTrue(searchBox.querySelector('#search-binding-hint').hidden);
			});

			it("should offer a binding hint for descendant conditions with no values", function () {
				// Two descendant conditions suggest binding as soon as they're selected, with no
				// values needed
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('annotationText', 'contains', '');
				s.addCondition('annotationComment', 'contains', '');
				pane.search = s;

				assert.isFalse(searchBox.querySelector('#search-binding-hint').hidden);
			});

			it("should not offer a binding hint for a freshly added condition until it's changed", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('annotationText', 'contains', 'foo');
				pane.search = s;

				// "+" seeds a second annotation condition, but it shouldn't suggest binding until
				// the user engages with it
				conditions.firstChild.onAddClicked({ preventDefault() {}, detail: 1 });
				assert.isTrue(searchBox.querySelector('#search-binding-hint').hidden);

				// Engaging with the new row (here, typing in it) lets it count
				conditions.lastChild.querySelector('#search-textbox')
					.dispatchEvent(new win.Event('input', { bubbles: true }));
				assert.isFalse(searchBox.querySelector('#search-binding-hint').hidden);
			});

			it("should wrap conditions into a bound group when the hint is taken", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('annotationText', 'contains', 'foo');
				s.addCondition('annotationComment', 'contains', 'bar');
				pane.search = s;

				searchBox.rootGroup.bindSameEntity('annotation');

				// The two conditions are now one group bound to annotation
				var group = conditions.querySelector('search-condition-group');
				assert.ok(group);
				assert.equal(group.resultLevel, 'annotation');
				assert.lengthOf(
					[...group.conditionsContainer.children].filter(c => c.localName == 'zoterosearchcondition'),
					2);

				searchBox.updateSearch();
				var seq = Object.values(searchBox.search.getConditions()).map(c => c.condition);
				assert.deepEqual(seq,
					['resultLevel', 'groupStart', 'resultLevel', 'annotationText', 'annotationComment', 'groupEnd']);

				// Conditions are no longer ungrouped siblings, so the hint is gone
				assert.isTrue(searchBox.querySelector('#search-binding-hint').hidden);
			});

			it("should fold a legacy noChildren into the result level", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('noChildren', 'true');
				s.addCondition('title', 'contains', 'foo');
				pane.search = s;

				// Shown as result level = top-level items, no separate checkbox
				assert.equal(searchBox.rootGroup.resultLevel, 'item');

				searchBox.updateSearch();
				var seq = Object.values(searchBox.search.getConditions()).map(c => c.condition);
				assert.notInclude(seq, 'noChildren');
				assert.deepEqual(seq, ['resultLevel', 'title']);
			});


			it("should warn when ALL conditions can't match the same item at a mixed result level", function () {
				// No result type (mixed), so an item-level and an annotation-level condition
				// can't both be true of one row
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'contains', 'a');
				s.addCondition('annotationText', 'contains', 'b');
				pane.search = s;

				assert.isFalse(searchBox.querySelector('.level-warning').hidden);
			});

			it("should not warn when a result type lets the conditions combine", function () {
				// Result type item: the annotation condition maps up, so it's satisfiable
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('title', 'contains', 'a');
				s.addCondition('annotationText', 'contains', 'b');
				pane.search = s;

				assert.isTrue(searchBox.querySelector('.level-warning').hidden);
			});

			it("should warn when a condition can't reach the result type", function () {
				// A note can never be (or be under) an attachment
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'attachment');
				s.addCondition('note', 'contains', 'a');
				pane.search = s;

				assert.isFalse(searchBox.querySelector('.level-warning').hidden);
			});

			it("should warn on the group when a condition can't reach its binding", function () {
				// A group bound to "same annotation" with a note condition: the conflict is the
				// group's binding, so the warning belongs on the group, not at the root.
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('groupStart', 'true', '');
				s.addCondition('resultLevel', 'annotation');
				s.addCondition('annotationComment', 'contains', 'a');
				s.addCondition('note', 'contains', 'b');
				s.addCondition('groupEnd', 'true', '');
				pane.search = s;

				var group = conditions.querySelector('search-condition-group');
				assert.isFalse(group.levelWarning.hidden);
				assert.isTrue(searchBox.rootGroup.levelWarning.hidden);
			});

			it("should not warn for a \"separately\" group whose conditions roll up", function () {
				// "Separately" inherits the result level (item), so annotations and a note all
				// roll up independently -- satisfiable, no warning (so "match separately" really
				// does clear the bound-group warning)
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('resultLevel', 'item');
				s.addCondition('groupStart', 'true', '');
				s.addCondition('annotationComment', 'contains', 'a');
				s.addCondition('annotationComment', 'contains', 'b');
				s.addCondition('note', 'contains', 'c');
				s.addCondition('groupEnd', 'true', '');
				pane.search = s;

				assert.isTrue(conditions.querySelector('search-condition-group').levelWarning.hidden);
			});

			it("should not warn for an ordinary search", function () {
				pane.search = null;
				assert.isTrue(searchBox.querySelector('.level-warning').hidden);
			});

			it("should keep a legacy includeParentsAndChildren editable and round-tripping", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'contains', 'foo');
				s.addCondition('includeParentsAndChildren', 'true');
				pane.search = s;

				assert.isFalse(searchBox.querySelector('#search-legacy-options').hidden);
				assert.isTrue(searchBox.querySelector('#includeParentsAndChildrenCheckbox').checked);

				searchBox.updateSearch();
				var seq = Object.values(searchBox.search.getConditions()).map(c => c.condition);
				assert.include(seq, 'includeParentsAndChildren');
			});

			it("should drop includeParentsAndChildren when its legacy checkbox is unchecked", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'contains', 'foo');
				s.addCondition('includeParentsAndChildren', 'true');
				pane.search = s;

				searchBox.querySelector('#includeParentsAndChildrenCheckbox').checked = false;
				searchBox.updateSearch();
				var seq = Object.values(searchBox.search.getConditions()).map(c => c.condition);
				assert.notInclude(seq, 'includeParentsAndChildren');
			});

			it("should add a sibling condition outside the group from the group's +", function () {
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('title', 'contains', 'foo');
				pane.search = s;

				// The root has no parent, so its caption "+" stays hidden
				assert.isTrue(searchBox.rootGroup.addConditionButton.hidden);

				// Wrap the only root condition, so the root now holds just the group
				conditions.firstChild.onGroupClicked({ preventDefault() {} });
				assert.lengthOf(conditions.children, 1);
				var group = conditions.querySelector('search-condition-group');

				// The group's "+" adds a sibling in the parent (root), not inside the group
				group.onAddSiblingClicked();

				assert.lengthOf(conditions.children, 2);
				var rows = [...conditions.children]
					.filter(c => c.localName === 'zoterosearchcondition');
				assert.lengthOf(rows, 1);
				assert.equal(rows[0].selectedCondition, 'title');
				// Nothing was added inside the group
				assert.lengthOf(group.conditionsContainer.children, 1);
			});
		});
	});
});
