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

const MIN_QUERY_LENGTH = 2;

// Contains all search-related logic. Last search results are stored in SearchHandler.results
// as the following object: { found: [], cited: [], open: [], selected: []}.
// Can be refreshed via SearchHandler.refresh or refreshDebounced.
export class CitationDialogSearchHandler {
	constructor({ isCitingNotes, io }) {
		this.isCitingNotes = isCitingNotes;
		this.io = io;

		this.searchValue = "";
		this.results = {
			found: [],
			open: [],
			cited: [],
			selected: [],
		};
		this.minQueryLengthEnforced = false;
		this.searching = false;
		this.searchResultIDs = [];

		// cache selected/open/cited items
		this.selectedItems = null;
		this.openItems = null;
		this.citedItems = null;

		this.loadCitedItemsPromise = this._getCitedItems().then((citedItems) => {
			this.citedItems = citedItems;
		});
	}

	setSearchValue(str, enforceMinQueryLength) {
		this.minQueryLengthEnforced = !!enforceMinQueryLength;
		this.searchValue = this.cleanSearchQuery(str);
	}

	// get item by a given id from the list of search results
	getItem(id) {
		// if id is in form "cited:" or ".../...", it must be a cited item with cslItemID
		if (typeof id == "string" && (id.includes("cited") || id.includes("/"))) {
			return this.results.cited.find(item => item.cslItemID === id);
		}
		// otherwise, it will be a item with an ordinary id from the database (still potentially cited)
		for (let key of ['selected', 'open', 'found', 'cited']) {
			let item = this.results[key].find(item => item.id === parseInt(id));
			if (item) return item;
		}
		return null;
	}

	// how many selected items there are without applying the filter
	allSelectedItemsCount() {
		if (this.selectedItems === null) {
			this.selectedItems = this._getSelectedLibraryItems();
		}
		return this.selectedItems.length;
	}

	// Return results in a more helpful formatfor rendering.
	// Results are returned as an array of { key, group, isLibrary } objects,
	// where key is selected/open/cited/{libraryID}, and group is the respective list of items.
	// Groups are sorted in the order they will be rendered:
	// Selected, Opened, Cited go first, followed by found library item groups ordered
	// by the number of results in each library.
	// Items/notes in the libraries group are sorted via _createItemsSort/_createNotesSort comparators.
	// Takes citedItems as a parameter to filter them out from Selected, Opened and Cited groups.
	getOrderedSearchResultGroups(citedItems = []) {
		let removeItemsIncludedInCitation = (items) => {
			let citedItemsIDs = new Set(citedItems.map(item => item.cslItemID || item.id));
			return items.filter(i => !citedItemsIDs.has(i.cslItemID ? i.cslItemID : i.id));
		};
		let result = [];
		// selected/open/cited go first
		for (let groupKey of ["selected", "open", "cited"]) {
			let groupItems = this.results[groupKey];
			// in selected and opened items, do not display items already in the citation
			if (groupKey == "selected" || groupKey == "open") {
				groupItems = removeItemsIncludedInCitation(groupItems);
			}
			if (groupItems.length) {
				result.push({ key: groupKey, group: groupItems });
			}
			// if cited items are being loaded, add their group with no items to indicate
			// that a placeholder should be displayed
			let loadingCitedItemsGroup = this.citedItems === null && groupKey === "cited";
			if (loadingCitedItemsGroup && this.searchValue) {
				result.push({ key: "cited", group: [] });
			}
		}
		// library items go after
		let libraryItems = Object.values(this.results.found.reduce((acc, item) => {
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

	// Refresh selected/opened items.
	// These items are searched for separately from actual library matches
	// because it is much faster for large libraries, so we don't have to wait
	// for the library search to complete to show these results.
	async refreshSelectedAndOpenItems() {
		if (this.openItems === null) {
			this.openItems = await this._getReaderOpenItems();
		}
		if (this.selectedItems === null) {
			this.selectedItems = this._getSelectedLibraryItems();
		}
		
		// apply filtering to item groups
		this.results.open = this.searchValue ? this._filterNonMatchingItems(this.openItems) : this.openItems;
		this.results.selected = this.searchValue ? this._filterNonMatchingItems(this.selectedItems) : this.selectedItems;
		// if a specific library ID is specified, only keep items from that library
		if (this.io.filterLibraryIDs) {
			this.results.open = this.results.open.filter(item => this.io.filterLibraryIDs.includes(item.libraryID));
			this.results.selected = this.results.selected.filter(item => this.io.filterLibraryIDs.includes(item.libraryID));
		}
		// clear matching library items to make sure items stale results are not showing
		this.results.found = [];
		// Ensure duplicates across groups before library items are found
		this._deduplicate();
	}

	// Refresh the list of matching library items for the list mode.
	async refreshLibraryItems() {
		if (!this.searchValue && !this.isCitingNotes) {
			this.results.found = [];
			return;
		}
		this.results.found = await this._getMatchingLibraryItems();
		// Ensure duplicates across groups after library items are found
		this._deduplicate();
	}

	async refreshCitedItems() {
		if (this.citedItems === null) {
			return;
		}
		// if "ibid" is typed, return all cited items
		if (this.searchValue.toLowerCase() === Zotero.getString("integration.ibid").toLowerCase()) {
			this.results.cited = this.citedItems;
		}
		else {
			this.results.cited = this.searchValue ? this._filterNonMatchingItems(this.citedItems) : [];
		}
	}

	// clear selected/open items cache to re-fetch those items
	// after they may have changed
	clearNonLibraryItemsCache() {
		this.selectedItems = null;
		this.openItems = null;
	}

	cleanSearchQuery(str) {
		str = str.replace(/ (?:&|and) /g, " ", "g").replace(/^,/, '');
		let isbn = Zotero.Utilities.cleanISBN(str);
		let doi = Zotero.Utilities.cleanDOI(str);
		// if the string looks like an identifier, do not try to extract the year
		if (!(isbn || doi)) {
			str = this._cleanYear(str);
		}
		str = str.trim();

		// If the query is very short, treat it as empty
		if (this.minQueryLengthEnforced && str.trim().length < MIN_QUERY_LENGTH) {
			str = "";
		}
		return str;
	}

	// make sure that each item appears only in one group.
	// Items that are selected are removed from opened.
	// Items that are selected or opened are removed from library results.
	_deduplicate() {
		let selectedIDs = new Set(this.results.selected.map(item => item.id));
		let openIDs = new Set(this.results.open.map(item => item.id));

		this.results.open = this.results.open.filter(item => !selectedIDs.has(item.id));
		this.results.found = this.results.found.filter(item => !selectedIDs.has(item.id) && !openIDs.has(item.id));
	}
		
	// Run the actual search query and find all items matching query across all libraries
	async _getMatchingLibraryItems() {
		var s = new Zotero.Search();
		Zotero.Feeds.getAll().forEach(feed => s.addCondition("libraryID", "isNot", feed.libraryID));
		if (this.io.filterLibraryIDs) {
			this.io.filterLibraryIDs.forEach(id => s.addCondition("libraryID", "is", id));
		}
		let realInputRegex = /[\w\u007F-\uFFFF]/;
		if (this.isCitingNotes) {
			s.addCondition("quicksearch-titleCreatorYearNote", "contains", this.searchValue);
		}
		else if (realInputRegex.test(this.searchValue)) {
			// search for the identifier if it is provided,
			// otherwise look up by title, creator and year
			let isDOI = Zotero.Utilities.cleanDOI(this.searchValue);
			let isISBN = Zotero.Utilities.cleanISBN(this.searchValue);
			if (isDOI) {
				s.addCondition("DOI", "contains", this.searchValue);
			}
			else if (isISBN) {
				s.addCondition("ISBN", "contains", this.searchValue);
			}
			else {
				s.addCondition("quicksearch-titleCreatorYear", "contains", this.searchValue);
				s.addCondition("itemType", "isNot", "attachment");
			}
		}
		let searchResultIDs = await s.search();
		// Search results might be in an unloaded library, so get items asynchronously and load necessary data
		var items = await Zotero.Items.getAsync(searchResultIDs);
		await Zotero.Items.loadDataTypes(items);
		return items;
	}

	async _getCitedItems() {
		if (this.isCitingNotes) return [];
		// Fetch all cited items in the document, not just items currently in the dialog
		let citedItems = await this.io.getItems();
		return citedItems;
	}

	async _getReaderOpenItems() {
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

		// Fetch top-most items and load necessary data, in case tabs belong to an unloaded library
		let items = [];
		for (let itemID of itemIDs) {
			let item = await Zotero.Items.getAsync(itemID);
			if (item && item.parentItemID) {
				item = await Zotero.Items.getAsync(item.parentItemID);
			}
			items.push(item);
		}
		await Zotero.Items.loadDataTypes(items);
		// Return deduplicated items since there may be multiple tabs opened for the same
		// top-level item (duplicate tabs or a multiple attachments belonging to the same item)
		return [...new Set(items)];
	}

	_getSelectedLibraryItems() {
		if (this.isCitingNotes) {
			return Zotero.getActiveZoteroPane()?.getSelectedItems().filter(i => i.isNote()) || [];
		}
		return Zotero.getActiveZoteroPane()?.getSelectedItems().filter(i => i.isRegularItem()) || [];
	}
	

	_filterNonMatchingItems(items) {
		let matchedItems = new Set();
		let splits = Zotero.Fulltext.semanticSplitter(this.searchValue);
		for (let item of items) {
			// Generate a string to search for each item
			let itemStr = item.getCreators()
				.map(creator => creator.firstName + " " + creator.lastName)
				.concat([item.getField("title"), item.getField("date", true, true).substr(0, 4)])
				.join(" ")
				.toLowerCase();
			
			// Include items that match every word that was typed
			let allMatch = splits.every(split => itemStr.includes(split));
			if (allMatch) {
				matchedItems.add(item);
			}
		}
		return Array.from(matchedItems);
	}

	// Generate sort function for items
	_createItemsSort() {
		let searchString = (this.searchValue).toLowerCase();
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
