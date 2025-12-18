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
			var promise = dialog.libraryLayout.itemsView.waitForSelect();
			dialog.libraryLayout.itemsView.selectItem(itemOne.id);
			await promise;
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

			// Present these items are selected/open/cited
			SearchHandler.selectedItems = [selectedOne, selectedTwo, selectedAndOpenOne];
			SearchHandler.openItems = [openOne, openTwo, selectedAndOpenOne, citedAndOpenOne];
			SearchHandler.citedItems = [citedOne, citedAndOpenOne];
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

describe("Add annotations dialog", function () {
	let dialog, annotationIOManager, annotationSearchHandler, annotationIO, win, doc;
	let parentItem, attachment, highlightAnnotation, underlineAnnotation;

	before(async function () {
		// one of helper functions of searchHandler uses zotero pane
		win = await loadZoteroPane();
		// Create IO for annotation adding dialog
		annotationIO = {
			accept: () => {},
			cancel() {},
			sort() {},
			sortable: false,
			isAddingAnnotations: true,
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

		// Open annotation adding dialog
		let dialogPromise = waitForWindow("chrome://zotero/content/integration/citationDialog.xhtml");
		Services.ww.openWindow(null, "chrome://zotero/content/integration/citationDialog.xhtml", "", "", annotationIO);
		dialog = await dialogPromise;
		annotationIOManager = dialog.IOManager;
		annotationSearchHandler = dialog.SearchHandler;

		// Wait for dialog to load
		while (!dialog.loaded) {
			await Zotero.Promise.delay(10);
		}
		doc = dialog.doc;

		// Create items and annotations
		parentItem = await createDataObject('item', { title: "parent_item_with_annotations" });
		parentItem.setCreators([
			{
				firstName: "First_One",
				lastName: "Last_One",
				creatorType: "author"
			}
		]);
		await parentItem.saveTx();
		attachment = await importFileAttachment('test.pdf', { parentID: parentItem.id });

		highlightAnnotation = await createAnnotation('highlight', attachment);
		highlightAnnotation.annotationText = 'highlighted text';
		highlightAnnotation.annotationComment = 'highlight comment';
		await highlightAnnotation.saveTx();

		underlineAnnotation = await createAnnotation('underline', attachment);
		underlineAnnotation.annotationText = 'underlined text';
		underlineAnnotation.annotationComment = 'underline';
		await underlineAnnotation.saveTx();
	});

	beforeEach(async function () {
		dialog.CitationDataManager.items = [];
		dialog.IOManager.updateBubbleInput();
		// Reset search
		await dialog.currentLayout.search("", { skipDebounce: true });
		
		// Wait for any ongoing search to complete
		while (annotationSearchHandler.searching) {
			await Zotero.Promise.delay(10);
		}
		dialog.IOManager._lastClickTime = null;
	});

	after(function () {
		dialog.close();
		win.close();
	});

	it("should bubbleize selected annotations", async function () {
		// Pretend that highlight annotation is selected
		annotationSearchHandler.results.selectedAnnotations = [highlightAnnotation];
		await dialog.currentLayout.refreshItemsList();

		// Click on selected annotation
		doc.querySelector(`.item[id="${highlightAnnotation.id}"]`).click();
		await Zotero.Promise.delay();
		// Expect that it becomes a bubble
		let bubbles = doc.querySelector("bubble-input").getAllBubbles();
		assert.equal(bubbles.length, 1);
		assert.equal(bubbles[0].textContent, `Last_One “highlighted text”`);
	});

	it("should select itemTree row on click of selected non-annotation item", async function () {
		// Pretend that highlight annotation is selected
		annotationSearchHandler.results.selectedItems = [parentItem];
		await dialog.currentLayout.refreshItemsList();

		// Due to some kind of race condition with itemTree loading in tests,
		// sometimes _itemTreeLoadingDeferred won't be resolved.
		// This ensures collectionTree.selectItems doesn't get stuck.
		dialog.libraryLayout.itemsView._itemTreeLoadingDeferred.resolve();
		// Click on selected item
		doc.querySelector(`.item[id="${parentItem.id}"]`).click();
		await Zotero.Promise.delay();
		// Expect that itemTree row is selected and itemTree is focused
		assert.equal(dialog.libraryLayout.itemsView.getSelectedItems(true)[0], parentItem.id);
		assert.equal(doc.activeElement.id, "item-tree-citationDialog");
	});

	it("should display selected items and selected annotations in separate decks", async function () {
		annotationSearchHandler.results.selectedAnnotations = [highlightAnnotation];
		annotationSearchHandler.results.selectedItems = [parentItem];

		await dialog.currentLayout.refreshItemsList();

		let selectedAnnotationsDeck = doc.getElementById("library-selectedAnnotations-items");
		let selectedItemsDeck = doc.getElementById("library-selectedItems-items");
		assert.equal(selectedAnnotationsDeck.querySelectorAll(".item").length, 1);
		assert.equal(selectedAnnotationsDeck.querySelector(".item").id, highlightAnnotation.id);
		assert.equal(selectedItemsDeck.querySelectorAll(".item").length, 1);
		assert.equal(selectedItemsDeck.querySelector(".item").id, parentItem.id);
	});

	it("should only include selected/open items that have annotations", async function () {
		// 2 top-level items, one attachment per each item, no annotations
		let itemNoAnnotations1 = await createDataObject('item', { title: "item_no_annotations_1" });
		let itemNoAnnotations2 = await createDataObject('item', { title: "item_no_annotations_2" });
		
		await importFileAttachment('test.pdf', { parentID: itemNoAnnotations1.id });
		await importFileAttachment('test.pdf', { parentID: itemNoAnnotations2.id });

		// 2 more top-level items, one attachment per each item, one annotation per attachment
		let itemWithAnnotations1 = await createDataObject('item', { title: "item_with_annotations_1" });
		let itemWithAnnotations2 = await createDataObject('item', { title: "item_with_annotations_2" });

		let attachmentWithAnnotations1 = await importFileAttachment('test.pdf', { parentID: itemWithAnnotations1.id });
		let attachmentWithAnnotations2 = await importFileAttachment('test.pdf', { parentID: itemWithAnnotations2.id });

		await createAnnotation('highlight', attachmentWithAnnotations1);
		await createAnnotation('highlight', attachmentWithAnnotations2);

		// Pretend that these are selected/opened items
		let selectedStub = sinon.stub(annotationSearchHandler, "_getSelectedLibraryItems");
		let selectedWithAnnotations = annotationSearchHandler.keepItemsWithAnnotations([itemNoAnnotations1, itemWithAnnotations1]);
		selectedStub.returns(selectedWithAnnotations);
		let openStub = sinon.stub(annotationSearchHandler, "_getReaderOpenItems");
		let openWithAnnotations = annotationSearchHandler.keepItemsWithAnnotations([itemNoAnnotations2, itemWithAnnotations2]);
		openStub.resolves(openWithAnnotations);

		// Clear the cache so that selected/open items are re-freshed
		// using the stubs below
		annotationSearchHandler.selectedItems = null;
		annotationSearchHandler.openItems = null;
		
		// Refresh all items
		await annotationSearchHandler.refreshSelectedAndOpenItems();

		// Restore all stubs
		selectedStub.restore();
		openStub.restore();

		// Only 2 items with annotations should be included in the results
		assert.sameMembers(annotationSearchHandler.results.selected, [itemWithAnnotations1]);
		assert.sameMembers(annotationSearchHandler.results.open, [itemWithAnnotations2]);
	});

	it("should display all selected annotations in side pane", async function () {
		// Actual annotations are selected
		await dialog.currentLayout.itemsView.selectItems([highlightAnnotation.id, underlineAnnotation.id]);
		let annotationPreviews = doc.querySelectorAll("#annotations-list annotation-row");
		assert.equal(annotationPreviews.length, 2);
		let annotationRowIDs = [annotationPreviews[0]._annotation.id, annotationPreviews[1]._annotation.id];
		assert.sameMembers(annotationRowIDs, [highlightAnnotation.id, underlineAnnotation.id]);

		// A top-level item is selected
		await dialog.currentLayout.itemsView.selectItems([parentItem.id]);
		annotationPreviews = doc.querySelectorAll("#annotations-list annotation-row");
		assert.equal(annotationPreviews.length, 2);
		annotationRowIDs = [annotationPreviews[0]._annotation.id, annotationPreviews[1]._annotation.id];
		assert.sameMembers(annotationRowIDs, [highlightAnnotation.id, underlineAnnotation.id]);
	});

	it("should display preview popup on bubble click", async function () {
		await dialog.IOManager.addItemsToCitation([highlightAnnotation]);
		let bubble = doc.querySelector("bubble-input .bubble");
		let popup = dialog.document.getElementById("itemDetails");

		bubble.click();
		// give the popup time to open
		await Zotero.Promise.delay(50);
		assert.equal(popup.state, "open");

		// make sure the annotation-row preview is visible in the popup
		let annotationPreview = popup.querySelector("annotation-row");
		assert.isOk(annotationPreview);
		assert.notOk(annotationPreview.closest("[hidden]"));
	});
});
