"use strict";

describe("Advanced Search", function () {
	let win, zp, searchWin, conditions;

	// React overrides the `.value` setter so in order to progromatically change that value we
	// need this little trick.
	// https://stackoverflow.com/a/46012210
	function changeValue(element, value) {
		// Get prototype
		let type = Object.prototype.toString.call(element).slice(8, -1);

		// Set value
		let nativeInputValueSetter = Object.getOwnPropertyDescriptor(window[type].prototype, "value").set;
		nativeInputValueSetter.call(element, value);

		// Fire change event
		element.dispatchEvent(new Event('change', { bubbles: true }));
	}
	
	before(async function () {
		await resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		win = await loadZoteroPane();
		zp = win.ZoteroPane;

		let promise = waitForWindow('chrome://zotero/content/advancedSearch.xul');
		zp.openAdvancedSearchWindow();
		searchWin = await promise;

		conditions = searchWin.document.getElementById('conditions');
	});
	
	after(function () {
		searchWin.close();
		win.close();
	});
	
	it("should perform a search", async function () {
		let item = await createDataObject('item', { setTitle: true });

		// Add condition
		let s = new Zotero.Search();
		s.addCondition('title', 'is', item.getField('title'));
		s.libraryID = '1';
		searchWin.ZoteroAdvancedSearch.updateSearchObject(s);
		
		// Run search and wait for results
		var o = searchWin.ZoteroAdvancedSearch;
		var deferred = Zotero.Promise.defer();
		o.search();
		var iv = o.itemsView;
		await iv.waitForLoad();
		
		// Check results
		assert.equal(iv.rowCount, 1);
		var index = iv.getRowIndexByID(item.id);
		assert.isNumber(index);
		
		item.eraseTx();
	});
	
	describe("Conditions", function () {
		describe("Access Date", function () {
			it("should correctly show date in textbox", async function () {
				let date = '2020-01-01 00:00:00';

				let s = new Zotero.Search();
				s.addCondition('accessDate', 'is', date);
				searchWin.ZoteroAdvancedSearch.updateSearchObject(s);

				let searchCondition = conditions.firstChild;
				// Check condition menu
				let conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				assert.equal(conditionsMenu.value, 'accessDate');

				// Check value menu is hidden
				assert.isNull(searchCondition.querySelector('#valuemenu'));

				// Check value of textbox
				let input = searchCondition.querySelector('input[type="text"]');
				let localDate = Zotero.Date.dateToSQL(Zotero.Date.sqlToDate(date, true));
				assert.equal(input.value, localDate);
			});

			it("should correctly convert date from textbox", async function () {
				let date = '2020-01-01 00:00:00';

				let searchCondition = conditions.firstChild;
				// Set condition menu
				let conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				changeValue(conditionsMenu, 'accessDate');

				// Check value menu is hidden
				assert.isNull(searchCondition.querySelector('#valuemenu'));

				// Set value of textbox
				let input = searchCondition.querySelector('input[type="text"]');
				changeValue(input, date);

				// Check the search object
				let condition = searchWin.ZoteroAdvancedSearch.getSearchObject().getConditions()[0];
				assert.equal(condition.condition, 'accessDate');
				let utcDate = Zotero.Date.dateToSQL(Zotero.Date.sqlToDate(date), true);
				assert.equal(condition.value, utcDate);
			});
		});
		
		describe("Collection", function () {
			it("should show collections and saved searches", function* () {
				var col1 = yield createDataObject('collection', { name: "A" });
				var col2 = yield createDataObject('collection', { name: "C", parentID: col1.id });
				var col3 = yield createDataObject('collection', { name: "D", parentID: col2.id });
				var col4 = yield createDataObject('collection', { name: "B" });
				var search1 = yield createDataObject('search', { name: "A" });
				var search2 = yield createDataObject('search', { name: "B" });
				
				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				var valueMenu = searchCondition.querySelector('#valuemenu');
				
				assert.isNull(valueMenu);

				// Select 'Collection' condition
				changeValue(conditionsMenu, 'collection');

				valueMenu = searchCondition.querySelector('#valuemenu');
				assert.isNotNull(valueMenu);
				assert.isFalse(valueMenu.hidden);
				assert.equal(valueMenu.childNodes.length, 6);
				var valueMenuItem = valueMenu.childNodes[1];
				assert.equal(valueMenuItem.textContent, "- " + col2.name);
				assert.equal(valueMenuItem.getAttribute('value'), "C" + col2.key);
				valueMenuItem = valueMenu.childNodes[2];
				assert.equal(valueMenuItem.textContent, "    - " + col3.name);
				assert.equal(valueMenuItem.getAttribute('value'), "C" + col3.key);
				valueMenuItem = valueMenu.childNodes[4];
				assert.equal(valueMenuItem.textContent, search1.name);
				assert.equal(valueMenuItem.getAttribute('value'), "S" + search1.key);
				valueMenuItem = valueMenu.childNodes[5];
				assert.equal(valueMenuItem.textContent, search2.name);
				assert.equal(valueMenuItem.getAttribute('value'), "S" + search2.key);

				yield Zotero.Collections.erase([col1.id, col2.id, col3.id, col4.id]);
				yield Zotero.Searches.erase([search1.id, search2.id]);
			});
			
			it("should be selected for 'savedSearch' condition", function* () {
				var search = yield createDataObject('search', { name: "A" });
				
				var s = new Zotero.Search();
				s.addCondition('savedSearch', 'is', search.key);
				searchWin.ZoteroAdvancedSearch.updateSearchObject(s);
				
				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				var valueMenu = searchCondition.querySelector('#valuemenu');
				
				assert.equal(conditionsMenu.value, 'collection');
				assert.isFalse(valueMenu.hidden);
				assert.equal(valueMenu.value, "S" + search.key);
				
				yield search.eraseTx();
			});
			
			it("should set 'savedSearch' condition when a search is selected", function* () {
				var collection = yield createDataObject('collection', { name: "A" });
				var search = yield createDataObject('search', { name: "B" });
				
				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				changeValue(conditionsMenu, 'collection');
				var valueMenu = searchCondition.querySelector('#valuemenu');
				changeValue(valueMenu, 'S' + search.key);
				
				var condition = searchWin.ZoteroAdvancedSearch.getSearchObject().getConditions()[0];
				assert.equal(condition.condition, 'savedSearch');
				assert.equal(condition.value, search.key);
				
				yield collection.eraseTx();
				yield search.eraseTx();
			});
			
			it("should update when the library is changed", function* () {
				var group = yield getGroup();
				var groupLibraryID = group.libraryID;
				
				var collection1 = yield createDataObject('collection', { name: "A" });
				var search1 = yield createDataObject('search', { name: "B" });
				var collection2 = yield createDataObject('collection', { name: "C", libraryID: groupLibraryID });
				var search2 = yield createDataObject('search', { name: "D", libraryID: groupLibraryID });
				
				var searchCondition = conditions.firstChild;
				// Select 'Collection' condition
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				changeValue(conditionsMenu, 'collection');

				var valueMenu = searchCondition.querySelector('#valuemenu');
				changeValue(valueMenu, 'S' + search1.key);

				// Switch to group library
				var libraryMenu = searchWin.document.getElementById('libraryMenu');
				changeValue(libraryMenu, groupLibraryID);

				var values = [];
				assert.equal(valueMenu.value, "C" + collection2.key);
				for (let child of valueMenu.childNodes) {
					values.push(child.getAttribute('value'));
				}
				assert.notInclude(values, "C" + collection1.key);
				assert.notInclude(values, "S" + search1.key);
				assert.include(values, "C" + collection2.key);
				assert.include(values, "S" + search2.key);
				
				yield Zotero.Collections.erase([collection1.id, collection2.id]);
				yield Zotero.Searches.erase([search1.id, search2.id]);
			});
		});

		describe("File Type ID", function () {
			it("should correctly show localized menus", async function () {
				let s = new Zotero.Search();
				s.addCondition('fileTypeID', 'is', '3');
				searchWin.ZoteroAdvancedSearch.updateSearchObject(s);

				let searchCondition = conditions.firstChild;
				// Check condition menu
				let conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				assert.equal(conditionsMenu.value, 'fileTypeID');

				// Ensure value menu is visible
				let valueMenu = searchCondition.querySelector('#valuemenu');
				assert.isNotNull(valueMenu);
				assert.equal(valueMenu.value, '3');
			});

			it("should correctly save changes to menu", async function () {
				let searchCondition = conditions.firstChild;
				// Set condition menu
				let conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				changeValue(conditionsMenu, 'fileTypeID');

				// Ensure value menu is visible
				let valueMenu = searchCondition.querySelector('#valuemenu');
				assert.isNotNull(valueMenu);
				changeValue(valueMenu, '3');

				// Check the search object
				let condition = searchWin.ZoteroAdvancedSearch.getSearchObject().getConditions()[0];
				assert.equal(condition.condition, 'fileTypeID');
				assert.equal(condition.operator, 'is');
				assert.equal(condition.value, '3');
			});
		});

		describe("Fulltext Content", function () {
			it("should correctly select mode", async function () {
				let s = new Zotero.Search();
				s.addCondition('fulltextContent/regexp', 'contains', 'zotero');
				searchWin.ZoteroAdvancedSearch.updateSearchObject(s);

				let searchCondition = conditions.firstChild;
				// Check condition menu
				let conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				assert.equal(conditionsMenu.value, 'fulltextContent');

				// Ensure mode menu is visible
				let modeMenu = searchCondition.querySelector('#modemenu');
				assert.isNotNull(modeMenu);
				assert.equal(modeMenu.value, 'regexp');

				// Check value of textbox
				let input = searchCondition.querySelector('input[type="text"]');
				assert.equal(input.value, 'zotero');
			});

			it("should correctly append mode to condition", async function () {
				let searchCondition = conditions.firstChild;
				// Set condition menu
				let conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				changeValue(conditionsMenu, 'fulltextContent');

				// Ensure mode menu is visible
				let modeMenu = searchCondition.querySelector('#modemenu');
				assert.isNotNull(modeMenu);
				changeValue(modeMenu, 'regexp');

				// Set value of textbox
				let input = searchCondition.querySelector('input[type="text"]');
				changeValue(input, 'zotero');

				// Check the search object
				let condition = searchWin.ZoteroAdvancedSearch.getSearchObject().getConditions()[0];
				assert.equal(condition.condition, 'fulltextContent');
				assert.equal(condition.mode, 'regexp');
				assert.equal(condition.value, 'zotero');
			});
		});

		describe("Item Type", function () {
			it("should correctly show localized menus", async function () {
				let s = new Zotero.Search();
				s.addCondition('itemType', 'is', 'interview');
				searchWin.ZoteroAdvancedSearch.updateSearchObject(s);

				let searchCondition = conditions.firstChild;
				// Check condition menu
				let conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				assert.equal(conditionsMenu.value, 'itemType');

				// Ensure value menu is visible
				let valueMenu = searchCondition.querySelector('#valuemenu');
				assert.isNotNull(valueMenu);
				assert.equal(valueMenu.value, 'interview');
			});

			it("should correctly save changes to menu", async function () {
				let searchCondition = conditions.firstChild;
				// Set condition menu
				let conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				changeValue(conditionsMenu, 'itemType');

				// Ensure value menu is visible
				let valueMenu = searchCondition.querySelector('#valuemenu');
				assert.isNotNull(valueMenu);
				changeValue(valueMenu, 'interview');

				// Check the search object
				let condition = searchWin.ZoteroAdvancedSearch.getSearchObject().getConditions()[0];
				assert.equal(condition.condition, 'itemType');
				assert.equal(condition.operator, 'is');
				assert.equal(condition.value, 'interview');
			});
		});

		describe("Saved Search", function () {
			it("shouldn't appear", function* () {
				var searchCondition = conditions.firstChild;
				var conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				
				// Ensure we have some options present
				assert.isAtLeast(conditionsMenu.childNodes.length, 5);

				// Make sure "Saved Search" isn't present
				for (let option of conditionsMenu.childNodes) {
					if (option.value == 'savedSearch') {
						assert.fail();
					}
				}
			});
		});
	});

	describe("Operators", function () {
		describe("Is In The Last", function () {
			it("should correctly show number and units", async function () {
				let s = new Zotero.Search();
				s.addCondition('date', 'isInTheLast', '2 years');
				searchWin.ZoteroAdvancedSearch.updateSearchObject(s);

				let searchCondition = conditions.firstChild;
				// Check condition menu
				let conditionsMenu = searchCondition.querySelector('#conditionsmenu');
				assert.equal(conditionsMenu.value, 'date');

				// Check units menu
				let unitsMenu = searchCondition.querySelector('#search-in-the-last');
				assert.isNotNull(unitsMenu);
				assert.equal(unitsMenu.value, 'years');

				// Check textbox value
				let input = searchCondition.querySelector('input');
				assert.isNotNull(input);
				assert.equal(input.value, '2');
			});

			it("should correctly convert number and units to value", async function () {
				let searchCondition = conditions.firstChild;
				// Set condition menu
				changeValue(searchCondition.querySelector('#conditionsmenu'), 'date');

				// Set operator menu
				changeValue(searchCondition.querySelector('#operatorsmenu'), 'isInTheLast');

				// Set units menu value
				changeValue(searchCondition.querySelector('#search-in-the-last'), 'years');

				// Set textbox value
				changeValue(searchCondition.querySelector('input'), '2');

				// Check the search object
				let condition = searchWin.ZoteroAdvancedSearch.getSearchObject().getConditions()[0];
				assert.equal(condition.condition, 'date');
				assert.equal(condition.operator, 'isInTheLast');
				assert.equal(condition.value, '2 years');
			});
		});
	});
});
