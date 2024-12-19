/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
					http://zotero.org
	
	This file is part of Zotero.
	
	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.

	You should have received a copy of the GNU Affero General Public License
	along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
	
	***** END LICENSE BLOCK *****
*/

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");

const SEARCH_TIMEOUT = 500;
const MIN_QUERY_LENGTH = 2;

// Contains all search-related logic. Last search results are stored in SearchHandler.results
// as the following object: { found: [], cited: [], open: [], selected: []}.
// Can be refreshed via SearchHandler.refresh or refreshDebounced.
export class CitationDialogSearchHandler {
	constructor({ isCitingNotes, io }) {
		this.isCitingNotes = isCitingNotes;
		this.io = io;

		this.lastSearchValue = "";
		this.results = {
			found: [],
			open: [],
			cited: [],
			selected: [],
		};
		this.searching = false;
		this.searchResultIDs = [];
	}

	getItem(id) {
		if (id.includes("cited") || id.includes("/")) {
			return this.results.cited.find(item => item.cslItemID === id);
		}
		for (let key of ['selected', 'open', 'found']) {
			let item = this.results[key].find(item => item.id === parseInt(id));
			if (item) return item;
		}
		return null;
	}


	refreshDebounced = Zotero.Utilities.debounce(async (str, callback) => {
		await this.refresh(str);
		callback();
	}, SEARCH_TIMEOUT);

	// how many selected items there are without applying the filter
	allSelectedItemsCount() {
		return this._getSelectedLibraryItems(true).length;
	}

	// Return results in a format that is better for rendering.
	// Results are returned as an array of { key, group, isLibrary } objects,
	// where key is selected/open/cited/{libraryID}, and group is the respective items.
	// Groups are sorted in the order they will be rendered:
	// Selected, Opened, Cited go first, followed by found library item groups ordered
	// by the number of results in each library.
	// Items/notes in the libraries group are sorted by _createItemsSort/_createNotesSort comparators.
	// Takes citedItems as a parameter to filter them out.
	getOrderedSearchResultGroups(citedItems) {
		let removeItemsIncludedInCitation = (items) => {
			let citedItemsIDs = new Set(citedItems.map(item => item.cslItemID || item.id));
			return items.filter(i => !citedItemsIDs.has(i.cslItemID ? i.cslItemID : i.id));
		};
		let result = [];
		// selected/open/cited go first
		for (let groupKey of ["selected", "open", "cited"]) {
			let groupItems = removeItemsIncludedInCitation(this.results[groupKey]);
			if (groupItems.length) {
				result.push({ key: groupKey, group: groupItems });
			}
		}
		// library items go after
		let libraryItems = Object.values(removeItemsIncludedInCitation(this.results.found).reduce((acc, item) => {
			if (!acc[item.libraryID]) {
				acc[item.libraryID] = { key: item.libraryID, group: [], isLibrary: true };
			}
			acc[item.libraryID].group.push(item);
			return acc;
		}, {}));

		// sort actual items or notes
		let itemComparator = this.isCitingNotes ? this._createNotesSort() : this._createItemsSort();
		libraryItems.forEach((library) => {
			library.group.sort(itemComparator);
		});
	
		// sort libraries by the number of items
		libraryItems.sort((a, b) => b.group.length - a.group.length);
		result.push(...libraryItems);

		return result;
	}

	async refresh(str = "") {
		await this._updateSearchResults(str);

		this.results = {
			found: this.isCitingNotes ? (await this._getMatchingNotes()) : (await this._getMatchingLibraryItems()),
			open: this.isCitingNotes ? [] : await this._getMatchingReaderOpenItems(),
			cited: this.isCitingNotes ? [] : await this._getMatchingCitedItems(),
			selected: this.isCitingNotes ? this._getSelectedNotes() : this._getSelectedLibraryItems(),
		};
		this._deduplicate();
	}

	async _updateSearchResults(str) {
		str = str.replace(/ (?:&|and) /g, " ", "g").replace(/^,/, '');
		str = this._cleanYear(str);

		// If the query is very short, treat it as empty
		if (str.trim().length < MIN_QUERY_LENGTH) {
			str = "";
		}

		var s = new Zotero.Search();
		Zotero.Feeds.getAll().forEach(feed => s.addCondition("libraryID", "isNot", feed.libraryID));
		if (this.io.filterLibraryIDs) {
			this.io.filterLibraryIDs.forEach(id => s.addCondition("libraryID", "is", id));
		}
		let realInputRegex = /[\w\u007F-\uFFFF]/;
		if (this.isCitingNotes) {
			s.addCondition("quicksearch-titleCreatorYearNote", "contains", str);
		}
		else if (realInputRegex.test(str)) {
			s.addCondition("quicksearch-titleCreatorYear", "contains", str);
			s.addCondition("itemType", "isNot", "attachment");
		}
		this.lastSearchValue = str;
		this.searchResultIDs = await s.search();
	}

	_deduplicate() {
		let selectedIDs = new Set(this.results.selected.map(item => item.id));
		let openIDs = new Set(this.results.open.map(item => item.id));
		let citedIDs = new Set(this.results.cited.filter(item => item.id).map(item => item.id));

		this.results.open = this.results.open.filter(item => !selectedIDs.has(item.id));
		this.results.cited = this.results.cited.filter(item => !selectedIDs.has(item.id) && !openIDs.has(item.id));
		this.results.found = this.results.found.filter(item => !selectedIDs.has(item.id) && !openIDs.has(item.id) && !citedIDs.has(item.id));
	}
	
	async _getMatchingCitedItems() {
		// Fetch all cited items in the document, not just items currently in the dialog
		let citedItems = await this.io.getItems();
		// if "ibid" is typed, return all items
		if (this.lastSearchValue.toLowerCase() === Zotero.getString("integration.ibid").toLowerCase()) {
			return citedItems;
		}
		if (!this.lastSearchValue) return [];
		return this._filterNonMatchingItems(citedItems);
	}

	async _getMatchingReaderOpenItems() {
		if (this.isCitingNotes) return [];
		let win = Zotero.getMainWindow();
		let tabs = win.Zotero_Tabs.getState();
		let itemIDs = tabs.filter(t => t.type === 'reader').sort((a, b) => {
			// Sort selected tab first
			if (a.selected) return -1;
			else if (b.selected) return 1;
			// Then in reverse chronological select order
			else if (a.timeUnselected && b.timeUnselected) return b.timeUnselected - a.timeUnselected;
			// Then in reverse order for tabs that never got loaded in this session
			else if (a.timeUnselected) return -1;
			return 1;
		}).map(t => t.data.itemID);
		if (!itemIDs.length) return [];

		let items = itemIDs.map((itemID) => {
			let item = Zotero.Items.get(itemID);
			if (item && item.parentItemID) {
				itemID = item.parentItemID;
			}
			return Zotero.Cite.getItem(itemID);
		});
		if (!this.lastSearchValue) return items;
		return this._filterNonMatchingItems(items);
	}

	_getSelectedLibraryItems(noFilter) {
		let win = Zotero.getMainWindow();
		if (win.Zotero_Tabs.selectedType !== "library") return [];
		let selectedItems = Zotero.getActiveZoteroPane().getSelectedItems().filter(i => i.isRegularItem());
		if (!this.lastSearchValue || noFilter) return selectedItems;
		return this._filterNonMatchingItems(selectedItems);
	}
	
	async _getMatchingLibraryItems(skipSelected = true) {
		if (this.isCitingNotes) {
			throw new Error("Not available when citing notes");
		}

		if (!this.searchResultIDs.length || !this.lastSearchValue) {
			return [];
		}
			
		// Search results might be in an unloaded library, so get items asynchronously and load
		// necessary data
		var items = await Zotero.Items.getAsync(this.searchResultIDs);
		await Zotero.Items.loadDataTypes(items);
		if (skipSelected) {
			let win = Zotero.getMainWindow();
			let selectedIDs = win.ZoteroPane.getSelectedItems().filter(i => i.isRegularItem()).map(item => item.id);
			items = items.filter(item => !selectedIDs.includes(item.id));
		}

		return items;
	}

	_getSelectedNotes() {
		return Zotero.getActiveZoteroPane().getSelectedItems().filter(i => i.isNote());
	}

	// Return notes matching the search query. If the query is empty, return all notes
	// sorted by last date modified.
	async _getMatchingNotes(skipSelected = true) {
		if (!this.isCitingNotes) {
			throw new Error("_getMatchingNotes should only be used while citing a note");
		}

		if (!this.searchResultIDs.length) return [];

		// Search results might be in an unloaded library, so get items asynchronously and load
		// necessary data
		var items = await Zotero.Items.getAsync(this.searchResultIDs);
		await Zotero.Items.loadDataTypes(items);
		if (skipSelected) {
			let selectedIDs = this._getSelectedNotes().map(note => note.id);
			items = items.filter(item => !selectedIDs.includes(item.id));
		}
		return items;
	}

	_filterNonMatchingItems(items) {
		let matchedItems = new Set();
		let splits = Zotero.Fulltext.semanticSplitter(this.lastSearchValue);
		for (let item of items) {
			// Generate a string to search for each item
			let itemStr = item.getCreators()
				.map(creator => creator.firstName + " " + creator.lastName)
				.concat([item.getField("title"), item.getField("date", true, true).substr(0, 4)])
				.join(" ");
			
			// See if words match
			for (let split of splits) {
				if (itemStr.toLowerCase().includes(split)) matchedItems.add(item);
			}
		}
		return Array.from(matchedItems);
	}

	// Generate sort function for items
	_createItemsSort() {
		let searchString = this.lastSearchValue.toLowerCase();
		let searchParts = Zotero.SearchConditions.parseSearchString(searchString);
		var collation = Zotero.getLocaleCollation();
		return ((a, b) => {
			var firstCreatorA = a.firstCreator, firstCreatorB = b.firstCreator;
			
			// Favor left-bound name matches (e.g., "Baum" < "Appelbaum"),
			// using last name of first author
			if (firstCreatorA && firstCreatorB) {
				for (let part of searchParts) {
					let caStartsWith = firstCreatorA.toLowerCase().startsWith(part.text);
					let cbStartsWith = firstCreatorB.toLowerCase().startsWith(part.text);
					if (caStartsWith && !cbStartsWith) {
						return -1;
					}
					else if (!caStartsWith && cbStartsWith) {
						return 1;
					}
				}
			}
		
			// Sort by last name of first author
			if (firstCreatorA !== "" && firstCreatorB === "") {
				return -1;
			}
			else if (firstCreatorA === "" && firstCreatorB !== "") {
				return 1;
			}
			else if (firstCreatorA) {
				return collation.compareString(1, firstCreatorA, firstCreatorB);
			}
			
			// Sort by date
			var yearA = a.getField("date", true, true).substr(0, 4),
				yearB = b.getField("date", true, true).substr(0, 4);
			return yearA - yearB;
		});
	}

	// Generate sort function for notes
	_createNotesSort() {
		var collation = Zotero.getLocaleCollation();
		return (a, b) => {
			return collation.compareString(
				1, b.getField('dateModified'), a.getField('dateModified')
			);
		};
	}

	_cleanYear(string) {
		let yearRegex = /,? *([0-9]+(?: *[-–] *[0-9]+)?) *(B[. ]*C[. ]*(?:E[. ]*)?|A[. ]*D[. ]*|C[. ]*E[. ]*)?$/i;
		let maybeYear = yearRegex.exec(string);
		if (!maybeYear) return string;

		let year = parseInt(maybeYear[1]);
		let stringNoYear = string.substr(0, maybeYear.index) + string.substring(maybeYear.index + maybeYear[0].length);
		if (!year) return stringNoYear;
		return stringNoYear + " " + year;
	}
}
