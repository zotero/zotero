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

import { Zotero } from "chrome://zotero/content/zotero.mjs";

const MIN_QUERY_LENGTH = 2;

// Contains all search-related logic. Last search results are stored in SearchHandler.results
// as the following object: { found: [], cited: [], open: [], selected: []}.
// Can be refreshed via SearchHandler.refresh or refreshDebounced.
export class CitationDialogSearchHandler {
	constructor({ isCitingNotes, io, doc }) {
		this.isCitingNotes = isCitingNotes;
		this.io = io;
		this.doc = doc;

		this.searchValue = "";
		this.dialogMode = ""; // "library" or "list"
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
		return Zotero.Items.get(id);
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
	async getOrderedSearchResultGroups(citedItemIDs = new Set()) {
		let removeItemsIncludedInCitation = (items) => {
			return items.filter(i => !citedItemIDs.has(i.cslItemID ? i.cslItemID : i.id));
		};
		let result = [];
		let groupKeys = ["selected", "open", "cited"];
		if (this.isCitingNotes && this.dialogMode == "library") {
			groupKeys = ["selectedNotes", "selectedItems", "open", "cited"];
		}
		// selected/open/cited go first
		for (let groupKey of groupKeys) {
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
				acc[item.libraryID] = { key: item.libraryID, group: [], label: Zotero.Libraries.get(item.libraryID).name };
			}
			acc[item.libraryID].group.push(item);
			return acc;
		}, {}));

	
		// sort libraries by the number of items
		libraryItems.sort((a, b) => b.group.length - a.group.length);
		result.push(...libraryItems);

		// post processing of groups
		for (let section of result) {
			// in list mode of insertNote, include parent items of child notes
			if (this.isCitingNotes && this.dialogMode === "list") {
				section.group = this._groupNotesWithParents(section.group);
			}
			// otherwise, just sort the items in each library
			else {
				section.group.sort(this._createItemsSort());
			}
			// fetch the label for open/selected/cited items
			if (!section.label) {
				section.label = await this._getSectionLabel(section.key, section.group);
			}
		}

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
		// when notes are being cited, in lib mode selected items are separated into top-level items and notes
		if (this.isCitingNotes) {
			this.results.selectedItems = this.results.selected.filter(item => !item.isNote());
			this.results.selectedNotes = this.results.selected.filter(item => item.isNote());
		}
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
			this.citedItems = await this._getCitedItems();
		}
		if (!this.citedItems) return;
		// if "ibid" is typed, return all cited items
		if (this.searchValue.toLowerCase() === Zotero.getString("integration.ibid").toLowerCase()) {
			this.results.cited = this.citedItems;
		}
		else {
			this.results.cited = this.searchValue ? this._filterNonMatchingItems(this.citedItems) : [];
		}
		this._deduplicate();
	}

	// clear selected/open items cache to re-fetch those items
	// after they may have changed
	clearNonLibraryItemsCache() {
		this.selectedItems = null;
		this.openItems = null;
	}

	cleanSearchQuery(str) {
		// if the string looks like an identifier, just return it without further cleanup
		let isbn = Zotero.Utilities.cleanISBN(str);
		let doi = Zotero.Utilities.cleanDOI(str);
		if (isbn || doi) {
			return str.trim();
		}
		// Remove brackets, some punctuation, "et al", and localized "and" from the search string.
		// This allows one to paste an existing citation like "(Smith et al., 2020)" and
		// still get appropriate search results.
		str = str.replace(/[()]/g, '').replace(/[&,.:;]/g, '');
		str = str.replace(" " + Zotero.getString("general.and") + " ", " ");
		let etAl = Zotero.getString("general.etAl").replace(/\./g, "");
		str = str.replace(new RegExp(" " + etAl + "(?:.\\s*|\\s+|$)", "g"), " ");

		str = str.trim();

		// If the query is very short, treat it as empty
		if (this.minQueryLengthEnforced && str.trim().length < MIN_QUERY_LENGTH) {
			str = "";
		}
		return str;
	}

	keepItemsWithNotes(items) {
		return items.filter((item) => {
			if (item.isNote()) return true;
			if (item.isRegularItem()) return item.getNotes().length > 0;
			return false;
		});
	}

	// make sure that each item appears only in one group.
	// Items that are selected are removed from opened.
	// Items that are selected or opened are removed from cited.
	// Items that are selected or opened or cited are removed from library results.
	_deduplicate() {
		let selectedIDs = new Set(this.results.selected.map(item => item.id));
		let openIDs = new Set(this.results.open.map(item => item.id));
		let citedIDs = new Set(this.results.cited.map(item => item.id));

		this.results.open = this.results.open.filter(item => !selectedIDs.has(item.id));
		this.results.cited = this.results.cited.filter(item => !selectedIDs.has(item.id) && !openIDs.has(item.id));
		this.results.found = this.results.found.filter(item => !selectedIDs.has(item.id) && !openIDs.has(item.id) && !citedIDs.has(item.id));
	}
		
	// Run the actual search query and find all items matching query across all libraries
	async _getMatchingLibraryItems() {
		let realInputRegex = /[\w\u007F-\uFFFF]/;
		if (!realInputRegex.test(this.searchValue)) return [];

		var s = new Zotero.Search();
		Zotero.Feeds.getAll().forEach(feed => s.addCondition("libraryID", "isNot", feed.libraryID));
		if (this.io.filterLibraryIDs) {
			this.io.filterLibraryIDs.forEach(id => s.addCondition("libraryID", "is", id));
		}
		if (this.isCitingNotes) {
			let scope = new Zotero.Search;
			// Allow to search by ISBN/DOI for the top-level item
			let addedIdentifierCondition = this._addIdentifierConditions(scope, this.searchValue);
			if (!addedIdentifierCondition) {
				// If identifier is not provided, search by conditions equivalent to quicksearch-titleCreatorYear
				this._addQuickSearchEquivalentConditions(scope);
				scope.addCondition("note", "contains", this.searchValue);
			}
			scope.addCondition("includeChildren", "true");
			s.setScope(scope);
			s.addCondition("itemType", "is", "note");
		}
		else {
			// search items by the identifier if provided, or by title/creator/year otherwise
			let addedIdentifierCondition = this._addIdentifierConditions(s, this.searchValue);
			if (!addedIdentifierCondition) {
				s.addCondition("quicksearch-titleCreatorYear", "contains", this.searchValue);
			}
			s.addCondition("itemType", "isNot", "attachment");
		}
		let searchResultIDs = await s.search();
		// Search results might be in an unloaded library, so get items asynchronously and load necessary data
		var items = await Zotero.Items.getAsync(searchResultIDs);
		await Zotero.Items.loadDataTypes(items);
		return items;
	}

	async _getCitedItems() {
		if (this.isCitingNotes) return [];
		// Noop until io loads all cited data
		if (this.io.allCitedDataLoadedPromise && !this.io.isAllCitedDataLoaded) return null;
		// Fetch all cited items in the document, not just items currently in the dialog
		let citedItems = await this.io.getItems();
		return citedItems;
	}

	async _getReaderOpenItems() {
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
		if (this.isCitingNotes) {
			items = this.keepItemsWithNotes(items);
			// include notes of the opened items so that filtering
			// within open items section applies to them as well
			if (this.dialogMode === "list") {
				items = this._groupNotesWithParents(items);
			}
			return items;
		}
		// Return deduplicated items since there may be multiple tabs opened for the same
		// top-level item (duplicate tabs or a multiple attachments belonging to the same item)
		return [...new Set(items)];
	}

	_getSelectedLibraryItems() {
		let selectedItems = Zotero.getActiveZoteroPane()?.getSelectedItems() || [];
		if (this.isCitingNotes) {
			let itemsWithNotes = this.keepItemsWithNotes(selectedItems);
			// include notes of the selected items so that filtering
			// within selected items section applies to them as well
			if (this.dialogMode === "list") {
				itemsWithNotes = this._groupNotesWithParents(itemsWithNotes);
			}
			return itemsWithNotes;
		}
		return selectedItems.filter(i => i.isRegularItem()) || [];
	}
	

	_filterNonMatchingItems(items) {
		let matchedItems = new Set();
		let splits = Zotero.Fulltext.semanticSplitter(this.searchValue);
		let makeSearchString = (item) => {
			return item.getCreators()
				.map(creator => creator.firstName + " " + creator.lastName)
				.concat([item.getField("title"), item.getField("date", true, true).substr(0, 4)])
				.join(" ")
				.toLowerCase();
		};
		
		for (let item of items) {
			// Generate a string to search for each item
			let itemStr = makeSearchString(item);
			
			// Handle searching through selected notes
			if (this.isCitingNotes) {
				if (item.isNote()) {
					itemStr += ` ${item.getNote().toLowerCase()}`;
					if (item.parentItemID) {
						let parentStr = makeSearchString(item.topLevelItem);
						itemStr += ` ${parentStr}`;
					}
				}
			}
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
			// When displaying notes, top level notes may appear among top-level
			// container items.
			if (this.isCitingNotes) {
				if (a.isNote() || b.isNote()) {
					return collation.compareString(1, a.getDisplayTitle(), b.getDisplayTitle());
				}
			}
			// Sort by left-bound name matches first
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

	_addIdentifierConditions(search, searchValue) {
		let cleanDOI = Zotero.Utilities.cleanDOI(searchValue);
		let cleanISBN = Zotero.Utilities.cleanISBN(searchValue);
		
		if (cleanDOI) {
			search.addCondition("DOI", "contains", cleanDOI);
			return true;
		}
		else if (cleanISBN) {
			search.addCondition("ISBN", "contains", cleanISBN);
			return true;
		}
		return false;
	}

	_addQuickSearchEquivalentConditions(search) {
		search.addCondition("title", "contains", this.searchValue);
		search.addCondition("publicationTitle", "contains", this.searchValue);
		search.addCondition("shortTitle", "contains", this.searchValue);
		search.addCondition("court", "contains", this.searchValue);
		search.addCondition("year", "contains", this.searchValue);
		search.addCondition("creator", "contains", this.searchValue);
		search.addCondition("joinMode", "any");
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

	async _getSectionLabel(key, items) {
		let count = items.length || 0;
		// in list mode of insertNote, only count top-level items since
		// child items are nested under their parents
		if (this.isCitingNotes && this.dialogMode === "list") {
			count = items.filter(item => !item.parentItemID).length;
		}
		if (key == "selected") {
			// when citing notes, we don't want to use the label
			// that includes the total count because it is confusing
			// in list mode when parents on selected notes also appear
			if (this.isCitingNotes) {
				return this.doc.l10n.formatValue(`integration-citationDialog-section-selectedItems`, { count });
			}
			// when not citing notes, add the total count param
			else {
				return this.doc.l10n.formatValue(`integration-citationDialog-section-selected`, { count, total: this.allSelectedItemsCount() });
			}
		}
		return this.doc.l10n.formatValue(`integration-citationDialog-section-${key}`, { count });
	}

	// Given an array of note items, construct a new array with the notes'
	// sorted parent items and all child notes following their respective parents.
	// For example, given [noteA, noteB, noteC], returned array is
	// [parentOfNoteA, noteA, parentOfNoteB, noteB, parentOfNoteC, noteC]
	_groupNotesWithParents(items) {
		let topLevelItems = {};
		for (let item of items) {
			let topLevel = item.topLevelItem;
			if (!topLevelItems[topLevel.id]) {
				topLevelItems[topLevel.id] = [];
			}
			if (item.parentItemID) {
				topLevelItems[topLevel.id].push(item);
			}
		}
		let topLevelArray = Object.keys(topLevelItems).map(id => Zotero.Items.get(id));
		topLevelArray.sort(this._createItemsSort());
		let result = [];
		for (let topLevelItem of topLevelArray) {
			result.push(topLevelItem);
			let childNotes = topLevelItems[topLevelItem.id];
			// if there is a parent item with no notes, add all of its child notes
			// (e.g. for an opened item)
			if (childNotes.length === 0 && topLevelItem.isRegularItem()) {
				let noteIDs = topLevelItem.getNotes();
				childNotes = Zotero.Items.get(noteIDs);
			}
			childNotes.sort(this._createNotesSort());
			result.push(...childNotes);
		}
		return result;
	}
}
