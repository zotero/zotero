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
	
	it("should show results in trash", async function () {
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
		
		assert.isNumber(iv.getRowIndexByID(item.id));
		
		await zp.setAdvancedSearchState('closed');
		
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
	
	describe("Conditions", function () {
		var pane, searchBox, conditions;
		
		before(async function () {
			await zp.toggleAdvancedSearchState('open');
			pane = deck.pane;
			searchBox = pane.querySelector('zoterosearch');
			conditions = searchBox.querySelector('#conditions');
		});
		
		after(async function () {
			await zp.setAdvancedSearchState('closed');
		});
		
		describe("Collection", function () {
			it("should show collections and saved searches", async function () {
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
				assert.equal(valueMenu.itemCount, 6);
				var valueMenuItem = valueMenu.getItemAtIndex(1);
				assert.equal(valueMenuItem.getAttribute('label'), "- " + col2.name);
				assert.equal(valueMenuItem.getAttribute('value'), "C" + col2.key);
				valueMenuItem = valueMenu.getItemAtIndex(2);
				assert.equal(valueMenuItem.getAttribute('label'), "    - " + col3.name);
				assert.equal(valueMenuItem.getAttribute('value'), "C" + col3.key);
				valueMenuItem = valueMenu.getItemAtIndex(4);
				assert.equal(valueMenuItem.getAttribute('label'), search1.name);
				assert.equal(valueMenuItem.getAttribute('value'), "S" + search1.key);
				valueMenuItem = valueMenu.getItemAtIndex(5);
				assert.equal(valueMenuItem.getAttribute('label'), search2.name);
				assert.equal(valueMenuItem.getAttribute('value'), "S" + search2.key);
				
				await Zotero.Collections.erase([col1.id, col2.id, col3.id, col4.id]);
				await Zotero.Searches.erase([search1.id, search2.id]);
			});
			
			it("should be selected for 'savedSearch' condition", async function () {
				var search = await createDataObject('search', { name: "A" });
				
				var s = new Zotero.Search();
				s.libraryID = Zotero.Libraries.userLibraryID;
				s.addCondition('savedSearch', 'is', search.key);
				pane.search = s;
				
				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				var valueMenu = searchCondition.querySelector('#valuemenu');
				
				assert.equal(conditionsMenu.selectedItem.value, 'collection');
				assert.isFalse(valueMenu.hidden);
				assert.equal(valueMenu.selectedItem.value, "S" + search.key);
				
				await search.eraseTx();
			});
			
			it("should set 'savedSearch' condition when a search is selected", async function () {
				var collection = await createDataObject('collection', { name: "A" });
				var search = await createDataObject('search', { name: "B" });
				
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
					if (menuitem.getAttribute('value') == "S" + search.key) {
						menuitem.click();
						break;
					}
				}
				
				searchBox.updateSearch();
				var condition = searchBox.search.getConditions()[0];
				assert.equal(condition.condition, 'savedSearch');
				assert.equal(condition.value, search.key);
				
				await collection.eraseTx();
				await search.eraseTx();
			});
			
			it("should update when the library is changed", async function () {
				var group = await getGroup();
				var groupLibraryID = group.libraryID;
				
				var collection1 = await createDataObject('collection', { name: "A" });
				var search1 = await createDataObject('search', { name: "B" });
				var collection2 = await createDataObject('collection', { name: "C", libraryID: groupLibraryID });
				var search2 = await createDataObject('search', { name: "D", libraryID: groupLibraryID });
				
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
					if (menuitem.getAttribute('value') == "S" + search1.key) {
						menuitem.click();
						break;
					}
				}
				assert.equal(valueMenu.value, "S" + search1.key);
				
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
				assert.notInclude(values, "S" + search1.key);
				assert.include(values, "C" + collection2.key);
				assert.include(values, "S" + search2.key);
				
				await selectLibrary(win);
				
				await Zotero.Collections.erase([collection1.id, collection2.id]);
				await Zotero.Searches.erase([search1.id, search2.id]);
			});
		});
		
		describe("Annotation Author", function () {
			it("should show annotation authors for a group library", async function () {
				var group = await getGroup();
				var groupLibraryID = group.libraryID;

				await Zotero.Users.setName(11111, 'Alice');
				await Zotero.Users.setName(22222, 'Bob');

				var groupAttachment = await importFileAttachment('test.pdf', {
					libraryID: groupLibraryID,
					contentType: 'application/pdf',
				});

				var annotation1 = await createAnnotation('highlight', groupAttachment);
				annotation1.createdByUserID = 11111;
				annotation1.lastModifiedByUserID = 11111;
				await annotation1.saveTx({ skipEditCheck: true });

				var annotation2 = await createAnnotation('highlight', groupAttachment);
				annotation2.createdByUserID = 22222;
				annotation2.lastModifiedByUserID = 22222;
				await annotation2.saveTx({ skipEditCheck: true });

				// Switch to group library
				var libraryMenu = searchWin.document.getElementById('libraryMenu');
				for (let i = 0; i < libraryMenu.itemCount; i++) {
					let menuitem = libraryMenu.getItemAtIndex(i);
					if (menuitem.value == groupLibraryID) {
						menuitem.click();
						break;
					}
				}

				var s = new Zotero.Search();
				s.libraryID = groupLibraryID;
				s.addCondition('title', 'is', '');
				searchBox.search = s;

				var searchCondition = conditions.firstChild;
				var valueMenu = searchCondition.querySelector('#valuemenu');

				// Select 'Annotation Author' condition from the "More" submenu
				var moreMenu = searchCondition.querySelector('#more-conditions-menu menupopup');
				for (let menuitem of moreMenu.children) {
					if (menuitem.value == 'annotationAuthor') {
						menuitem.click();
						break;
					}
				}

				// Wait for async dropdown population
				await Zotero.Promise.delay(9000);

				assert.isFalse(valueMenu.hidden);
				assert.equal(valueMenu.itemCount, 2);

				var values = [];
				var labels = [];
				for (let i = 0; i < valueMenu.itemCount; i++) {
					let menuitem = valueMenu.getItemAtIndex(i);
					values.push(menuitem.getAttribute('value'));
					labels.push(menuitem.getAttribute('label'));
				}

				assert.include(labels, 'Alice');
				assert.include(labels, 'Bob');
				assert.include(values, '11111');
				assert.include(values, '22222');

				await annotation1.eraseTx();
				await annotation2.eraseTx();
				await groupAttachment.eraseTx();
			});
		});

		describe("Saved Search", function () {
			it("shouldn't appear", async function () {
				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				
				// Make sure "Saved Search" isn't present
				for (let i = 0; i < conditionsMenu.itemCount; i++) {
					let menuitem = conditionsMenu.getItemAtIndex(i);
					if (menuitem.value == 'savedSearch') {
						assert.fail();
					}
				}
			});
		});
	});
});
