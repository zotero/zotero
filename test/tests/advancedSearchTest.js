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
	
	it("should save a search in an editable group library root but not a collection", async function () {
		var group = await getGroup();
		var groupLibraryID = group.libraryID;
		var collection = await createDataObject('collection', { libraryID: groupLibraryID });
		
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
		
		// Saving should be disabled within a collection, which can't be scoped to
		await selectCollection(win, collection.id);
		await zp.toggleAdvancedSearchState('open');
		assert.isTrue(deck.pane._saveButton.disabled);
		
		await zp.setAdvancedSearchState('closed');
		await Zotero.Searches.erase(searches.map(s => s.id));
		await collection.eraseTx();
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
					
					// Collection condition (which also covers saved searches) shouldn't be offered
					for (let i = 0; i < conditionsMenu.itemCount; i++) {
						assert.notEqual(conditionsMenu.getItemAtIndex(i).value, 'collection');
					}
				}
				finally {
					searchBox.scopeLibraryIDs = null;
				}
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
