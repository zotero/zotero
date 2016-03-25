"use strict";

describe("Advanced Search", function () {
	var win, zp;
	
	before(function* () {
		win = yield loadZoteroPane();
		zp = win.ZoteroPane;
	});
	
	after(function () {
		win.close();
	});
	
	it("should perform a search", function* () {
		var item = yield createDataObject('item', { setTitle: true });
		
		var promise = waitForWindow('chrome://zotero/content/advancedSearch.xul');
		zp.openAdvancedSearchWindow();
		var searchWin = yield promise;
		
		// Add condition
		var searchBox = searchWin.document.getElementById('zotero-search-box');
		
		var s = new Zotero.Search();
		s.addCondition('title', 'is', item.getField('title'))
		searchBox.search = s;
		
		// Run search and wait for results
		var o = searchWin.ZoteroAdvancedSearch;
		var deferred = Zotero.Promise.defer();
		o.search();
		var iv = o.itemsView;
		iv.addEventListener('load', () => deferred.resolve());
		yield deferred.promise;
		
		// Check results
		assert.equal(iv.rowCount, 1);
		var index = iv.getRowIndexByID(item.id);
		assert.isNumber(index);
		
		searchWin.close();
	});
});
