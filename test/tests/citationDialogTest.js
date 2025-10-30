describe("Citation Dialog", function () {
	let io = {
		accept() {},
		cancel() {},
		sort() {},
		sortable: false,
		citation: {
			citationItems: [],
			properties: {
				unsorted: false,
			}
		},
		getItems() {
			return [];
		},
		allCitedDataLoadedPromise: Promise.resolve(),
	};
	let dialog, win, IOManager, CitationDataManager, SearchHandler;

	before(async function () {
		// one of helper functions of searchHandler uses zotero pane
		win = await loadZoteroPane();
		let dialogPromise = waitForWindow("chrome://zotero/content/integration/citationDialog.xhtml");
		Services.ww.openWindow(null, "chrome://zotero/content/integration/citationDialog.xhtml", "", "", io);
		dialog = await dialogPromise;
		IOManager = dialog.IOManager;
		CitationDataManager = dialog.CitationDataManager;
		SearchHandler = dialog.SearchHandler;
		// wait for everything (e.g. itemTree/collectionTree) inside of the dialog to be loaded.
		while (!dialog.loaded) {
			await Zotero.Promise.delay(10);
		}
	});

	beforeEach(async function () {
		// Many operations (e.g. IOManager.addItemsToCitation) are disabled
		// when search runs. Search can be triggered by a variety of events
		// so before each test, we make sure that search has finished running
		while (SearchHandler.searching) {
			await Zotero.Promise.delay(10);
		}
	});

	after(function () {
		dialog.close();
		win.close();
	});

	describe("Manage entries in the citation", function () {
		let citedItemNotInLibrary = {
			id: "o7HzMbH6/6iMXHx6s",
			itemData: {
				id: "o7HzMbH6/6iMXHx6s",
				type: "book",
				title: "cited_not_in_library_test_title",
				author: [
					{
						family: "Last",
						given: "First"
					}
				]
			},
			uris: [
				"http://zotero.org/users/11573780/items/K22KNVZL"
			],
			item: {
				id: "o7HzMbH6/6iMXHx6s",
				type: "book",
				title: "cited_not_in_library_test_title",
				author: [
					{
						family: "Last",
						given: "First"
					}
				],
				"title-main": "cited_not_in_library_test_title",
				"title-sub": "",
				"title-subjoin": ""
			},
			label: undefined,
			locator: undefined,
			prefix: undefined,
			suffix: undefined,
			"suppress-author": undefined
		};
		let citedItemOne = {
			id: null,
			item: {
				id: null,
				type: "book",
				title: "cited_in_library_test_title",
				author: [
					{
						family: "Last",
						given: "First"
					}
				],
				"title-main": "cited_in_library_test_title",
				"title-sub": "",
				"title-subjoin": ""
			},
			label: undefined,
			locator: undefined,
			prefix: undefined,
			suffix: undefined,
			"suppress-author": undefined
		};
		let itemOne, itemTwo, bubbleInput, ZoteroCiteGetItemStub, surrogateCitedItem;

		before(async function () {
			bubbleInput = dialog.document.querySelector("bubble-input");
	
			// Virtual Zotero.Item for a cited item that does not exist in the library.
			// Same logic as in Zotero.Integration.Citation.loadItemData.
			surrogateCitedItem = new Zotero.Item();
			Zotero.Utilities.itemFromCSLJSON(surrogateCitedItem, citedItemNotInLibrary.itemData);
			surrogateCitedItem.cslItemID = citedItemNotInLibrary.id;
			surrogateCitedItem.cslURIs = citedItemNotInLibrary.uris;
			surrogateCitedItem.cslItemData = citedItemNotInLibrary.itemData;
			// Zotero.Cite.getItem called with citedItemNotInLibrary returns virtual Zotero.Item from above
			ZoteroCiteGetItemStub = sinon.stub(Zotero.Cite, 'getItem').callsFake(function (id) {
				if (id === citedItemNotInLibrary.id) {
					return surrogateCitedItem;
				}
				return Zotero.Items.get(id);
			});
	
			itemOne = await createDataObject('item', { title: "one" });
			itemOne.setCreators([
				{
					firstName: "First_One",
					lastName: "Last_One",
					creatorType: "author"
				}
			]);
			await itemOne.saveTx();
			// citedItemOne is an earlier cited itemOne
			citedItemOne.id = itemOne.id;
			citedItemOne.item.id = itemOne.id;
	
			itemTwo = await createDataObject('item', { title: "two" });
			itemTwo.setCreators([
				{
					firstName: "First_Two",
					lastName: "Last_Two",
					creatorType: "author"
				}
			]);
			await itemTwo.saveTx();
		});

		after(function () {
			ZoteroCiteGetItemStub.restore();
		});

		beforeEach(function () {
			io.citation.citationItems = [];
			io.citation.sortable = false;
			dialog.document.getElementById("keepSorted").checked = false;
			io.sort = () => {};
			CitationDataManager.items = [];
			IOManager.updateBubbleInput();
		});

		it("should add an item to citation", async function () {
			await IOManager.addItemsToCitation([itemOne]);
			
			let bubbles = bubbleInput.getAllBubbles();
			assert.equal(CitationDataManager.items.length, 1);
			assert.equal(bubbles.length, 1);
			assert.equal(bubbles[0].textContent, itemOne.getCreator(0).lastName);
		});
	
		it("should remove an item from citation", async function () {
			await IOManager.addItemsToCitation([itemOne, itemTwo]);
			let bubbles = bubbleInput.getAllBubbles();
			assert.equal(bubbles.length, 2);
	
			let firstBubbleItem = CitationDataManager.items[0];
			IOManager._deleteItem(firstBubbleItem.dialogReferenceID);
	
			bubbles = bubbleInput.getAllBubbles();
			assert.equal(CitationDataManager.items.length, 1);
			assert.equal(CitationDataManager.items[0].id, itemTwo.id);
			assert.equal(bubbles.length, 1);
			assert.equal(bubbles[0].textContent, itemTwo.getCreator(0).lastName);
		});
	
		it("should build citation with a cited item in library", async function () {
			io.citation.citationItems = [citedItemOne];
	
			await CitationDataManager.buildCitation();
			IOManager.updateBubbleInput();
			
			let bubbles = bubbleInput.getAllBubbles();
			assert.equal(CitationDataManager.items.length, 1);
			assert.equal(bubbles.length, 1);
			assert.equal(bubbles[0].textContent, itemOne.getCreator(0).lastName);
		});
	
		it("should build citation with a cited item not in library", async function () {
			io.citation.citationItems = [citedItemNotInLibrary];
	
			await CitationDataManager.buildCitation();
			IOManager.updateBubbleInput();
	
			let bubbles = bubbleInput.getAllBubbles();
			assert.equal(CitationDataManager.items.length, 1);
			assert.equal(bubbles.length, 1);
			assert.equal(bubbles[0].textContent, surrogateCitedItem.getCreator(0).lastName);
		});
	
		it("should add a locator/suffix/prefix to a bubble", async function () {
			// add two bubbles for the same item
			await IOManager.addItemsToCitation([itemOne, itemOne]);
			assert.equal(CitationDataManager.items.length, 2);
	
			// open popup
			let firstBubble = CitationDataManager.items[0];
			IOManager._openItemDetailsPopup(firstBubble.dialogReferenceID);
			let popup = dialog.document.getElementById("itemDetails");
			
			// give the popup time to open
			await Zotero.Promise.delay(50);
			assert.equal(popup.state, "open");
	
			// set locator/suffix/prefix values
			popup.querySelector("#locator").value = "10";
			popup.querySelector("#suffix").value = "suffix";
			popup.querySelector("#prefix").value = "prefix";
			popup.querySelector("#prefix").dispatchEvent(new Event('input', { bubbles: true }));
	
			// make sure they are set on the bubbleItem
			assert.equal(firstBubble.locator, "10");
			assert.equal(firstBubble.suffix, "suffix");
			assert.equal(firstBubble.prefix, "prefix");
			let bubble = dialog.document.querySelector(`.bubble[dialogReferenceID="${firstBubble.dialogReferenceID}"]`);
			assert.equal(bubble.textContent, "prefix Last_One, p. 10 suffix");
	
			// make sure the other bubbleItem is not affected
			let secondBubble = CitationDataManager.items[1];
			assert.notOk(secondBubble.locator);
			assert.notOk(secondBubble.suffix);
			assert.notOk(secondBubble.prefix);
		});
	
		it("should change the order of bubbles", async function () {
			// add two items
			await IOManager.addItemsToCitation([itemOne, itemTwo]);
			let bubbleItemOne = CitationDataManager.items[0];
			let bubbleItemTwo = CitationDataManager.items[1];
	
			// check initial order
			let bubbles = bubbleInput.getAllBubbles();
			assert.equal(bubbles[0].getAttribute("dialogReferenceID"), bubbleItemOne.dialogReferenceID);
			assert.equal(bubbles[1].getAttribute("dialogReferenceID"), bubbleItemTwo.dialogReferenceID);
	
			// move the second item to the first position
			IOManager._moveItem(bubbleItemTwo.dialogReferenceID, 0);
	
			// ensure the order is correct
			assert.equal(CitationDataManager.items[0].dialogReferenceID, bubbleItemTwo.dialogReferenceID);
			assert.equal(CitationDataManager.items[1].dialogReferenceID, bubbleItemOne.dialogReferenceID);
			bubbles = dialog.document.querySelector("bubble-input").getAllBubbles();
			assert.equal(bubbles[0].getAttribute("dialogReferenceID"), bubbleItemTwo.dialogReferenceID);
			assert.equal(bubbles[1].getAttribute("dialogReferenceID"), bubbleItemOne.dialogReferenceID);
		});
	
		it("should sort the citation", async function () {
			// Make dialog sortable
			io.citation.sortable = true;
			dialog.document.getElementById("keepSorted").checked = true;
			// Mock sort.io implementation that sorts itemOne to the first position
			io.sort = () => {
				let items = io.citation.citationItems;
				items.sort((a, b) => {
					if (a.id === itemOne.id) return -1;
					if (b.id === itemOne.id) return 1;
					return 0;
				});
				io.citation.sortedItems = [
					[null, items[0]],
					[null, items[1]]
				];
			};
	
			// Add items to citation in wrong order
			await IOManager.addItemsToCitation([itemTwo, itemOne]);
	
			// Make sure the bubbleItems are sorted with itemOne being first
			let firstBubbleItem = CitationDataManager.items[0];
			let secondBubbleItem = CitationDataManager.items[1];
			assert.equal(firstBubbleItem.id, itemOne.id);
			assert.equal(secondBubbleItem.id, itemTwo.id);
			let bubbles = bubbleInput.getAllBubbles();
			assert.equal(bubbles[0].getAttribute("dialogReferenceID"), firstBubbleItem.dialogReferenceID);
			assert.equal(bubbles[1].getAttribute("dialogReferenceID"), secondBubbleItem.dialogReferenceID);
		});
	
		it("should update io.citation.items from bubbles", async function () {
			let bubbleItems = CitationDataManager.items;
			// Build citation with several cited items
			io.citation.citationItems = [citedItemOne, citedItemNotInLibrary];
			await CitationDataManager.buildCitation();
	
			// Add another item
			await IOManager.addItemsToCitation([itemTwo], { index: 2 });
	
			// Add modifications
			bubbleItems[0].label = "page";
			bubbleItems[0].locator = "10";
	
			bubbleItems[1].prefix = "prefix";
			bubbleItems[1].suffix = "suffix";
	
			bubbleItems[2].suppressAuthor = true;
	
			// Update io.citation.items and make sure it looks right
			CitationDataManager.updateCitationObject(true);
			let expected = [
				{
					id: itemOne.id,
					locator: "10",
					label: "page"
				},
				{
					id: citedItemNotInLibrary.id,
					suffix: "suffix",
					prefix: "prefix",
					itemData: citedItemNotInLibrary.itemData,
					uris: citedItemNotInLibrary.uris,
				},
				{
					id: itemTwo.id,
					"suppress-author": true
				}
			];
			assert.deepEqual(io.citation.citationItems, expected);
		});
	});

	describe("UI", function () {
		beforeEach(function () {
			CitationDataManager.items = [];
			IOManager.updateBubbleInput();
		});

		it("should switch dialog mode", async function () {
			IOManager.toggleDialogMode("list");
			assert.isFalse(dialog.document.getElementById("list-layout").hidden);
			assert.isTrue(dialog.document.getElementById("library-layout").hidden);
			IOManager.toggleDialogMode("library");
			assert.isFalse(dialog.document.getElementById("library-layout").hidden);
			assert.isTrue(dialog.document.getElementById("list-layout").hidden);
		});

		it("should highlight bubbles whose items are selected", async function () {
			let itemOne = await createDataObject('item');
			let itemTwo = await createDataObject('item');

			IOManager.toggleDialogMode("library");
			await IOManager.addItemsToCitation([itemOne, itemTwo]);

			// Select row of the first bubble
			await dialog.libraryLayout.itemsView.selectItem(itemOne.id);
			// Check that the bubble is highlighted
			let bubbleOne = dialog.document.querySelector(`.bubble[dialogReferenceID="${CitationDataManager.items[0].dialogReferenceID}"]`);
			assert.isTrue(bubbleOne.classList.contains("has-item-selected"));
			// Check the other bubble is unaffected
			let bubbleTwo = dialog.document.querySelector(`.bubble[dialogReferenceID="${CitationDataManager.items[1].dialogReferenceID}"]`);
			assert.isFalse(bubbleTwo.classList.contains("has-item-selected"));
		});

		it("should highlight rows of items in the citation", async function () {
			let itemOne = await createDataObject('item');
			IOManager.toggleDialogMode("library");

			// Add the item to citation
			await IOManager.addItemsToCitation([itemOne]);
			// Select the row in itemTree, so it is visible
			await dialog.libraryLayout.itemsView.selectItem(itemOne.id);
			// Make sure the row node is highlighted
			let rowIndex = dialog.libraryLayout.itemsView.getRowIndexByID(itemOne.id);
			let rowID = "item-tree-citationDialog-row-" + rowIndex;
			let rowNode = dialog.document.getElementById(rowID);
			assert.isTrue(rowNode.classList.contains("highlighted"));
		});
	});

	describe("Search", function () {
		let selectedOne, selectedTwo, openOne, openTwo, selectedAndOpenOne, citedOne, citedAndOpenOne, libraryOne, libraryTwo;

		before(async function () {
			selectedOne = await createDataObject('item', { title: "one_selected" });
			selectedTwo = await createDataObject('item', { title: "two_selected" });
			openOne = await createDataObject('item', { title: "one_open" });
			openTwo = await createDataObject('item', { title: "two_open" });
			selectedAndOpenOne = await createDataObject('item', { title: "one_selected_open" });
			libraryOne = await createDataObject('item', { title: "one_library" });
			libraryTwo = await createDataObject('item', { title: "two_library" });
			citedOne = await createDataObject('item', { title: "one_cited" });
			citedAndOpenOne = await createDataObject('item', { title: "one_open_cited" });
		});

		after(function () {
			SearchHandler.openItems = [];
			SearchHandler.selectedItems = [];
		});

		it("should perform search in list mode", async function () {
			IOManager.toggleDialogMode("list");

			// Wait for search triggered after switching dialog modes to finish
			while (SearchHandler.searching) {
				await Zotero.Promise.delay(10);
			}
			// Pretend these items are selected/open/cited
			SearchHandler.selectedItems = [selectedOne, selectedTwo, selectedAndOpenOne];
			SearchHandler.openItems = [openOne, openTwo, selectedAndOpenOne, citedAndOpenOne];
			SearchHandler.citedItems = [citedOne, citedAndOpenOne];
			// Search for "one"
			await dialog.currentLayout.search("one", { skipDebounce: true });
			// Selected items should have both "one_selected" and "one_selected_open"
			let selectedIDs = SearchHandler.results.selected.map(item => item.id);
			assert.sameMembers(selectedIDs, [selectedOne.id, selectedAndOpenOne.id]);
			// Open items should have "one_open" and "one_open_cited" but not "one_selected_open", since it is selected
			let openIDs = SearchHandler.results.open.map(item => item.id);
			assert.sameMembers(openIDs, [openOne.id, citedAndOpenOne.id]);
			// Cited items should have "one_cited"
			let citedIDs = SearchHandler.results.cited.map(item => item.id);
			assert.sameMembers(citedIDs, [citedOne.id]);
			// Library items should have "one_library" but not "two_library", "one_cited", or "one_open_cited"
			let libraryIDs = SearchHandler.results.found.map(item => item.id);
			assert.include(libraryIDs, libraryOne.id);
			assert.notInclude(libraryIDs, libraryTwo.id);
			assert.notInclude(libraryIDs, citedOne.id);
			// Make sure actual nodes for search matches are rendered
			let expectedItemCardIDs = [...selectedIDs, ...openIDs, ...citedIDs, ...libraryIDs];
			for (let itemID of expectedItemCardIDs) {
				let node = dialog.document.querySelector(`.item[id="${itemID}"]`);
				assert.isOk(node);
			}
		});

		it("should perform search in library mode", async function () {
			IOManager.toggleDialogMode("library");

			// Wait for search triggered after switching dialog modes to finish
			while (SearchHandler.searching) {
				await Zotero.Promise.delay(10);
			}

			// Pretend these items are selected/open/cited
			SearchHandler.selectedItems = [selectedOne, selectedTwo, selectedAndOpenOne];
			SearchHandler.openItems = [openOne, openTwo, selectedAndOpenOne, citedAndOpenOne];
			SearchHandler.citedItems = [citedOne, citedAndOpenOne];

			// Search for "one"
			await dialog.currentLayout.search("one", { skipDebounce: true });
			// Selected items should have both "one_selected" and "one_selected_open"
			let selectedIDs = SearchHandler.results.selected.map(item => item.id);
			assert.sameMembers(selectedIDs, [selectedOne.id, selectedAndOpenOne.id]);
			// Open items should have "one_open" and "one_open_cited" but not "one_selected_open", since it is selected
			let openIDs = SearchHandler.results.open.map(item => item.id);
			assert.sameMembers(openIDs, [openOne.id, citedAndOpenOne.id]);
			// Cited items should have "one_cited"
			let citedIDs = SearchHandler.results.cited.map(item => item.id);
			assert.sameMembers(citedIDs, [citedOne.id]);
			// In library mode, library is searched via itemTree, so this should be empty
			assert.equal(SearchHandler.results.found.length, 0);
			// Make sure actual nodes for search matches are rendered
			let expectedItemCardIDs = [...selectedIDs, ...openIDs, ...citedIDs];
			for (let itemID of expectedItemCardIDs) {
				let node = dialog.document.querySelector(`.item[id="${itemID}"]`);
				assert.isOk(node);
			}
		});
	});

	describe("Dialog loading", function () {
		let newDialog;

		after(() => {
			newDialog.close();
		});

		it("the dialog should be interactable even if io functions are not loaded", async function () {
			let io = {
				accept() {},
				cancel() {},
				sortable: true,
				citation: {
					citationItems: [],
					properties: {
						unsorted: false,
					}
				},
				// allCitedDataLoadedPromise is what citation dialog checks
				// but make all functions unresolved promises just to be sure
				sort() {
					return new Zotero.Promise(() => {});
				},
				getItems() {
					return new Zotero.Promise(() => {});
				},
				allCitedDataLoadedPromise: new Zotero.Promise(() => {}),
			};

			let newDialogPromise = waitForWindow("chrome://zotero/content/integration/citationDialog.xhtml");
			Services.ww.openWindow(null, "chrome://zotero/content/integration/citationDialog.xhtml", "", "", io);
			newDialog = await newDialogPromise;

			while (!newDialog.loaded || newDialog.SearchHandler.searching) {
				await Zotero.Promise.delay(10);
			}
			let item = await createDataObject('item', { title: "test" });
			await newDialog.IOManager.addItemsToCitation([item]);
			// verify that the new bubbles was added
			let addedBubble = newDialog.document.querySelector(".bubble");
			assert.isOk(addedBubble);
		});
	});

	describe("Helpers.extractLocator", function () {
		let locator;
		describe("Invalid locators", function () {
			it("has no locator label with numeric locator value", function () {
				locator = dialog.Helpers.extractLocator('history of the US 10-15');
				assert.isNull(locator);
				locator = dialog.Helpers.extractLocator('10-15');
				assert.isNull(locator);
			});

			it("has no locator label with textual locator value", function () {
				locator = dialog.Helpers.extractLocator('history of the US "test"');
				assert.isNull(locator);
				locator = dialog.Helpers.extractLocator('"test"');
				assert.isNull(locator);
			});
			
			it("has no quotes around textual locator value", function () {
				locator = dialog.Helpers.extractLocator('history of the US chapter something');
				assert.isNull(locator);
				locator = dialog.Helpers.extractLocator('chapter search query');
				assert.isNull(locator);
			});
			
			it("has no locator value", function () {
				locator = dialog.Helpers.extractLocator('history of the US p');
				assert.isNull(locator);
				locator = dialog.Helpers.extractLocator('page');
				assert.isNull(locator);
			});
			
			it("has textual locator value that does not follow locator label", function () {
				locator = dialog.Helpers.extractLocator('history of the US note blank "testing"');
				assert.isNull(locator);
			});
			
			it("has numeric locator value that does not follow locator label", function () {
				locator = dialog.Helpers.extractLocator('history of the US p blank 11-12');
				assert.isNull(locator);
			});
			
			it("has textual locator value not in the end of the string", function () {
				locator = dialog.Helpers.extractLocator('history of the US chapter "some quotations" some more text');
				assert.isNull(locator);
			});
			
			it("has numeric locator value not in the end of the string", function () {
				locator = dialog.Helpers.extractLocator('history of the US page 10-15 some more text');
				assert.isNull(locator);
			});
		});

		describe("Valid locator labels", function () {
			it("is a valid numeric locator by itself", function () {
				let locators = [
					'line 10-15',
					'line10-15',
					'l. 10-15',
					'l.10-15',
					'l    10-15',
					' l10-15'
				];
				for (let locatorString of locators) {
					let locator = dialog.Helpers.extractLocator(locatorString);
					assert.isOk(locator);
					assert.equal(locator.label, 'line');
					assert.equal(locator.locator, '10-15');
					assert.equal(locator.onlyLocator, true);
					assert.equal(locator.fullLocatorString, locatorString.trim());
				}
			});

			it("is a valid textual locator by itself", function () {
				let locators = [
					'note "this is a note"',
					'note"this is a note"',
					'n. "this is a note"',
					'n."this is a note"',
					'n    "this is a note"',
					' n"this is a note"'
				];
				
				for (let locatorString of locators) {
					let locator = dialog.Helpers.extractLocator(locatorString);
					assert.isOk(locator);
					assert.equal(locator.label, 'note');
					assert.equal(locator.locator, 'this is a note');
					assert.equal(locator.onlyLocator, true);
					assert.equal(locator.fullLocatorString, locatorString.trim());
				}
			});

			it("is a valid numeric locator with other text", function () {
				let locators = [
					{ str: 'history of the US page 10-15', locatorStr: 'page 10-15' },
					{ str: 'history of the US page10-15', locatorStr: 'page10-15' },
					{ str: 'history of the US p. 10-15', locatorStr: 'p. 10-15' },
					{ str: 'history of the US p.10-15', locatorStr: 'p.10-15' },
					{ str: 'history of the US p    10-15', locatorStr: 'p    10-15' },
					{ str: 'history of the US  p10-15', locatorStr: 'p10-15' }
				];
				
				for (let locatorObj of locators) {
					let locator = dialog.Helpers.extractLocator(locatorObj.str);
					assert.isOk(locator);
					assert.equal(locator.label, 'page');
					assert.equal(locator.locator, '10-15');
					assert.equal(locator.onlyLocator, false);
					assert.equal(locator.fullLocatorString, locatorObj.locatorStr);
				}
			});

			it("is a valid textual locator with other text", function () {
				let locators = [
					{ str: 'history of the US chapter  "one and two"', locatorStr: 'chapter  "one and two"' },
					{ str: 'history of the US chapter"one and two"', locatorStr: 'chapter"one and two"' },
					{ str: 'history of the US chap. "one and two"', locatorStr: 'chap. "one and two"' },
					{ str: 'history of the US chap."one and two"', locatorStr: 'chap."one and two"' },
					{ str: 'history of the US chap    "one and two"', locatorStr: 'chap    "one and two"' },
					{ str: 'history of the US chap"one and two"', locatorStr: 'chap"one and two"' }
				];
				
				for (let locatorObj of locators) {
					let locator = dialog.Helpers.extractLocator(locatorObj.str);
					assert.isOk(locator);
					assert.equal(locator.label, 'chapter');
					assert.equal(locator.locator, 'one and two');
					assert.equal(locator.onlyLocator, false);
					assert.equal(locator.fullLocatorString, locatorObj.locatorStr);
				}
			});
		});
	});
});

describe("Insert Note Dialog", function () {
	let dialog, insertNoteIO, win;
	let parentItem, childNoteA, childNoteB, topLevelNote;

	before(async function () {
		// one of helper functions of searchHandler uses zotero pane
		win = await loadZoteroPane();
		// Create IO for insert note dialog
		insertNoteIO = {
			accept: () => {},
			cancel() {},
			sort() {},
			sortable: false,
			isCitingNotes: true,
			citation: {
				citationItems: [],
				properties: {
					unsorted: false,
				}
			},
			getItems() {
				return [];
			},
			allCitedDataLoadedPromise: Zotero.Promise.resolve(),
		};

		// Open the dialog
		let dialogPromise = waitForWindow("chrome://zotero/content/integration/citationDialog.xhtml");
		Services.ww.openWindow(null, "chrome://zotero/content/integration/citationDialog.xhtml", "", "", insertNoteIO);
		dialog = await dialogPromise;

		// Wait for dialog to load
		while (!dialog.loaded) {
			await Zotero.Promise.delay(10);
		}
		doc = dialog.doc;

		// Create items
		parentItem = await createDataObject('item', { title: "parent_item_with_notes" });
		childNoteA = await createDataObject('item', { itemType: 'note', parentItemID: parentItem.id });
		childNoteA.setNote("<p>This is a child note A</p><p>First line.</p><p>Second line.</p>");
		await childNoteA.saveTx();

		childNoteB = await createDataObject('item', { itemType: 'note', parentItemID: parentItem.id });
		childNoteB.setNote("<p>This is a child note B</p><p>First line.</p><p>Second line.</p>");
		await childNoteB.saveTx();

		topLevelNote = await createDataObject('item', { itemType: 'note' });
		topLevelNote.setNote("<p>This is a top level note</p><p>First line.</p><p>Second line.</p>");
		await topLevelNote.saveTx();
	});

	beforeEach(async function () {
		dialog.IOManager.updateBubbleInput();
		// Reset search
		await dialog.currentLayout.search("", { skipDebounce: true });
		
		// Wait for any ongoing search to complete
		while (dialog.SearchHandler.searching) {
			await Zotero.Promise.delay(10);
		}
		dialog.IOManager._lastClickTime = null;
	});

	it("should match notes by their content", async function () {
		dialog.IOManager.toggleDialogMode("list");
		// Wait for search triggered after switching dialog modes to finish
		while (dialog.SearchHandler.searching) {
			await Zotero.Promise.delay(10);
		}
		// child A is a match
		await dialog.currentLayout.search("This is a child note A", { skipDebounce: true });
		let noteIDs = dialog.SearchHandler.results.found.map(item => item.id);
		assert.sameMembers(noteIDs, [childNoteA.id]);
		// it appears together with the parent item as the container
		let itemNodes = [...dialog.doc.querySelectorAll(".item")];
		assert.equal(itemNodes[0].id, `${parentItem.id}`);
		assert.isTrue(itemNodes[0].classList.contains("container"));
		assert.equal(itemNodes[1].id, `${childNoteA.id}`);
		assert.isTrue(itemNodes[1].classList.contains("child"));
	});

	it("should match notes by their parent item", async function () {
		dialog.IOManager.toggleDialogMode("list");
		// Wait for search triggered after switching dialog modes to finish
		while (dialog.SearchHandler.searching) {
			await Zotero.Promise.delay(10);
		}
		// child A and child B notes are matches
		await dialog.currentLayout.search("parent_item_with_notes", { skipDebounce: true });
		let noteIDs = dialog.SearchHandler.results.found.map(item => item.id);
		assert.sameMembers(noteIDs, [childNoteA.id, childNoteB.id]);
		// they appear together with the parent item as the container
		let itemNodes = [...dialog.doc.querySelectorAll(".item")];
		assert.equal(itemNodes[0].id, `${parentItem.id}`);
		assert.isTrue(itemNodes[0].classList.contains("container"));
		assert.equal(itemNodes[1].id, `${childNoteA.id}`);
		assert.isTrue(itemNodes[1].classList.contains("child"));
		assert.equal(itemNodes[2].id, `${childNoteB.id}`);
		assert.isTrue(itemNodes[2].classList.contains("child"));
	});

	it("should filter selected notes by their parent item", async function () {
		dialog.IOManager.toggleDialogMode("library");
		// Wait for search triggered after switching dialog modes to finish
		while (dialog.SearchHandler.searching) {
			await Zotero.Promise.delay(10);
		}
		// Present childNoteA and topLevelNote are selected
		dialog.SearchHandler.selectedItems = [childNoteA, topLevelNote];
		// child A is a match
		await dialog.currentLayout.search("parent_item_with_notes", { skipDebounce: true });
		let noteIDs = dialog.SearchHandler.results.selected.map(item => item.id);
		assert.sameMembers(noteIDs, [childNoteA.id]);
		
		let itemNodes = [...dialog.doc.querySelectorAll(".item")];
		assert.equal(itemNodes.length, 1);
		assert.equal(itemNodes[0].id, `${childNoteA.id}`);
	});

	after(function () {
		dialog.close();
		win.close();
	});
});
