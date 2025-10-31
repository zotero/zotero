"use strict";

describe("Advanced Search", function () {
	var win, zp;
	
	before(function* () {
		yield resetDB({
			thisArg: this,
			skipBundledFiles: true
		});
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
	});
	
	after(function () {
		win.close();
	});
	
	it("should perform a search", function* () {
		var item = yield createDataObject('item', { setTitle: true });
		
		var promise = waitForWindow('chrome://zotero/content/advancedSearch.xhtml');
		zp.openAdvancedSearchWindow();
		var searchWin = yield promise;
		yield searchWin.ZoteroAdvancedSearch._loadedDeferred.promise;
		// Add condition
		var searchBox = searchWin.document.getElementById('zotero-search-box');
		
		var s = new Zotero.Search();
		s.addCondition('title', 'is', item.getField('title'))
		searchBox.search = s;
		
		// Run search and wait for results
		var o = searchWin.ZoteroAdvancedSearch;
		var iv = o.itemsView;
		yield iv.waitForLoad();
		yield o.search();
		yield iv.waitForLoad();
		
		// Check results
		assert.equal(iv.rowCount, 1);
		var index = iv.getRowIndexByID(item.id);
		assert.isNumber(index);
		
		searchWin.close();
		
		yield item.eraseTx();
	});
	
	describe("Conditions", function () {
		var searchWin, searchBox, conditions;
		
		before(function* () {
			var promise = waitForWindow('chrome://zotero/content/advancedSearch.xhtml');
			zp.openAdvancedSearchWindow();
			searchWin = yield promise;
			searchBox = searchWin.document.getElementById('zotero-search-box');
			conditions = searchBox.querySelector('#conditions');
		});
		
		after(function () {
			searchWin.close();
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
				s.addCondition('title', 'is', '');
				searchBox.search = s;
				
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
				s.addCondition('savedSearch', 'is', search.key);
				searchBox.search = s;
				
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
				s.addCondition('title', 'is', '');
				searchBox.search = s;
				
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
				s.addCondition('title', 'is', '');
				searchBox.search = s;
				
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
				
				var libraryMenu = searchWin.document.getElementById('libraryMenu');
				for (let i = 0; i < libraryMenu.itemCount; i++) {
					let menuitem = libraryMenu.getItemAtIndex(i);
					// Switch to group library
					if (menuitem.value == groupLibraryID) {
						menuitem.click();
						break;
					}
				}
				
				var values = [];
				valueMenu = searchCondition.querySelector('#valuemenu')
				assert.equal(valueMenu.value, "C" + collection2.key);
				for (let i = 0; i < valueMenu.itemCount; i++) {
					let menuitem = valueMenu.getItemAtIndex(i);
					values.push(menuitem.getAttribute('value'));
				}
				assert.notInclude(values, "C" + collection1.key);
				assert.notInclude(values, "S" + search1.key);
				assert.include(values, "C" + collection2.key);
				assert.include(values, "S" + search2.key);
				
				await Zotero.Collections.erase([collection1.id, collection2.id]);
				await Zotero.Searches.erase([search1.id, search2.id]);
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
