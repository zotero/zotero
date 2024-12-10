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

var doc, io, isCitingNotes, accepted;

var currentLayout, libraryLayout, listLayout;

var Helpers, SearchHandler, PopupsHandler, KeyboardHandler;

const ITEM_LIST_MAX_ITEMS = 50;

var { CitationDialogHelpers } = ChromeUtils.importESModule('chrome://zotero/content/integration/citationDialog/helpers.mjs');
var { CitationDialogSearchHandler } = ChromeUtils.importESModule('chrome://zotero/content/integration/citationDialog/searchHandler.mjs');
var { CitationDialogPopupsHandler } = ChromeUtils.importESModule('chrome://zotero/content/integration/citationDialog/popupHandler.mjs');
var { CitationDialogKeyboardHandler } = ChromeUtils.importESModule('chrome://zotero/content/integration/citationDialog/keyboardHandler.mjs');

//
// Initialization of all handlers and top-level functions
//
function onLoad() {
	doc = document;
	io = window.arguments[0].wrappedJSObject;
	isCitingNotes = !!io.isCitingNotes;

	Helpers = new CitationDialogHelpers({ doc, io });
	SearchHandler = new CitationDialogSearchHandler({ isCitingNotes, io });
	PopupsHandler = new CitationDialogPopupsHandler({ doc });
	KeyboardHandler = new CitationDialogKeyboardHandler({ doc });

	_id("keepSorted").disabled = !io.sortable;
	_id("keepSorted").checked = io.sortable && !io.citation.properties.unsorted;
	let enabledSettings = !!_id("settings-popup").querySelector("input:not([disabled])");
	_id("settings-button").disabled = !enabledSettings;

	libraryLayout = new LibraryLayout();
	listLayout = new ListLayout();

	// top-level keypress handling and focus navigation across the dialog
	// keypresses for lower-level bubble-specific behavior are handled in bubbleInput.js
	doc.addEventListener("keypress", event => KeyboardHandler.handleKeypress(event));

	// handling of user's IO
	IOManager.init();

	// build the citation items based on io, and then create bubbles and focus an input
	CitationDataManager.buildCitation().then(() => {
		IOManager.updateBubbleInput();
		_id("bubble-input").refocusInput();
	});
}


function accept() {
	if (accepted || SearchHandler.searching) return;
	accepted = true;
	CitationDataManager.updateCitationObject(true);
	io.accept((percent) => console.log("Percent ", percent));
}

function cancel() {
	if (accepted) return;
	accepted = true;
	io.citation.citationItems = [];
	io.accept();
	window.close();
}

// shortcut used for brevity
function _id(id) {
	return doc.getElementById(id);
}


// Template for layout classes.
class Layout {
	constructor(type) {
		this.type = type;
	}

	// Re-render the items based on search rersults
	async refreshItemsList() {
		let canAddNodes = ITEM_LIST_MAX_ITEMS;
		let sections = [];
		let firstItem = true;

		// Clear the current pre-selected item, it is update later
		IOManager.markPreSelectedItem();
		// Tell SearchHandler which currently cited items are so they are not included in results
		let citedItems = CitationDataManager.getCitationItems();
		for (let { key, group, isLibrary } of SearchHandler.getOrderedSearchResultGroups(citedItems)) {
			if (canAddNodes <= 0) break;
			if (isLibrary && this.type == "library") break;
			let isGroupCollapsible = key == "selected" && group.length > 1;
			
			// Construct each section and items
			let sectionHeader = "";
			if (isLibrary) {
				sectionHeader = Zotero.Libraries.get(key).name;
			}
			else {
				sectionHeader = await doc.l10n.formatValue(`integration-citationDialog-section-${key}`, { count: group.length });
			}
			let section = Helpers.buildItemsSection(`${this.type}-${key}-items`, sectionHeader, isGroupCollapsible, group);
			let itemContainer = section.querySelector(".itemsContainer");
	
			let items = [];
			let index = 0;
			for (let item of group) {
				// createItemNode implemented by layouts
				let itemNode = await this.createItemNode(item, isGroupCollapsible ? index : null);
				itemNode.addEventListener("click", IOManager.handleItemClick);
				items.push(itemNode);
				canAddNodes -= 1;

				// Pre-select the item to be added on Enter of an input
				if (firstItem) {
					IOManager.markPreSelectedItem(itemNode, item);
					firstItem = false;
				}
				if (canAddNodes <= 0) break;
				index++;
			}
			itemContainer.replaceChildren(...items);
			sections.push(section);
			if (isGroupCollapsible) {
				IOManager.toggleSectionCollapse(section, this.type == "list" ? "expanded" : "collapsed");
			}
		}
		_id(`${this.type}-layout`).querySelector(".search-items").replaceChildren(...sections);
	}

	// Create the node for selected/cited/opened item groups.
	// It's different for list and library modes, so it is implemented by layouts.
	async createItemNode() {}

	// Regardless of which layout we are in, we need to run the search and
	// update itemsList.
	async searchDebounced(value) {
		_id("loading-spinner").setAttribute("status", "animate");
		SearchHandler.searching = true;
		// This is called on each typed character, so refresh item list when typing stopped
		SearchHandler.refreshDebounced(value, () => {
			this.refreshItemsList();
			SearchHandler.searching = false;
			_id("loading-spinner").removeAttribute("status");
		});
	}

	// Run search and refresh items list immediately
	async search(value) {
		_id("loading-spinner").setAttribute("status", "animate");
		SearchHandler.searching = true;
		await SearchHandler.refresh(value);
		this.refreshItemsList();
		SearchHandler.searching = false;
		_id("loading-spinner").removeAttribute("status");
	}

	// implemented by layouts
	updateWindowMinSize() {}
}

class LibraryLayout extends Layout {
	constructor() {
		super("library");
		this._initItemTree();
		this._initCollectionTree();
	}

	// After the search is run, library layout updates the itemsView filter
	async search(value) {
		super.search(value);
		// Make sure itemTree is fully loaded
		if (!this.itemsView?.collectionTreeRow) return;
		this.itemsView.setFilter('search', value);
	}

	async searchDebounced(value) {
		super.searchDebounced(value);
		this.itemsView?.setFilter('search', value);
	}

	// Create item node for an item group and store item ids in itemIDs attribute
	async createItemNode(item, index = null) {
		let itemNode = Helpers.createNode("div", { tabindex: "-1", "aria-describedby": "item-description", role: "option", "data-tabindex": 40 }, "item");
		let id = item.cslItemID || item.id;
		itemNode.setAttribute("itemIDs", id);
		let title = Helpers.createNode("div", {}, "title");
		let description = Helpers.buildItemDescription(item);
		title.textContent = item.getDisplayTitle();

		itemNode.append(title, description);

		if (index !== null) {
			itemNode.style.setProperty('--deck-index', index);
		}

		return itemNode;
	}

	async refreshItemsList() {
		await super.refreshItemsList();
		_id("library-other-items").hidden = !_id("library-layout").querySelector(".section:not([hidden])");
		window.resizeTo(window.innerWidth, Math.max(window.innerHeight, 400));
	}

	// Refresh itemTree to properly display +/- icons column
	async refreshItemsView() {
		this._refreshItemsViewHighlightedRows();
		// Refresh to reset row cache to get latest data of which items are included
		await this.itemsView.refresh();
		// Redraw the itemTree
		this.itemsView.tree.invalidate();
	}

	// Min height of the dialog is bubbleInput + a constant for the library
	updateWindowMinSize() {
		const minLibraryHeight = 200;
		let { height } = _id("bubble-input").getBoundingClientRect();
		doc.documentElement.style.minHeight = `${minLibraryHeight + height}px`;
	}

	async _initItemTree() {
		const ItemTree = require('zotero/itemTree');
		const { getCSSIcon } = require('components/icons');
		const { COLUMNS } = require('zotero/itemTreeColumns');

		var itemsTree = _id('zotero-items-tree');
		let itemColumns = COLUMNS.map((column) => {
			column = Object.assign({}, column);
			column.hidden = !['title', 'firstCreator', 'date'].includes(column.dataKey);
			return column;
		});
		// Add +/- column to indicate if an item is included in a citation
		// and add/exclude them on click
		itemColumns.push({
			dataKey: 'isAddedToCitation',
			label: 'In citation',
			htmlLabel: ' ', // space for column label to appear empty
			width: 26,
			staticWidth: true,
			fixedWidth: true,
			showInColumnPicker: false,
			renderer: (index, data, column) => {
				let icon;
				if (data === true) {
					icon = getCSSIcon('minus-circle');
				}
				else if (data == false) {
					icon = getCSSIcon('plus-circle');
				}
				else if (data === null) {
					// no icon should be shown when an item cannot be added
					// (e.g. when citing notes, parent items are displayed but not included)
					icon = getCSSIcon("");
				}
				icon.className += ` cell icon-action ${column.className}`;
				return icon;
			}
		});
		this.itemsView = await ItemTree.init(itemsTree, {
			id: "citationDialog",
			dragAndDrop: false,
			persistColumns: true,
			columnPicker: true,
			onSelectionChange: () => {
				IOManager.updateSelectedItems();
			},
			regularOnly: !isCitingNotes,
			onActivate: (event, items) => {
				IOManager.toggleAddedItem(items);
			},
			emptyMessage: Zotero.getString('pane.items.loading'),
			columns: itemColumns,
			// getExtraField helps itemTree fetch the data for a column that's
			// not a part of actual item properties
			getExtraField: (item, key) => {
				if (key == "isAddedToCitation") {
					if (!(item instanceof Zotero.Item)) return null;
					if (isCitingNotes && !item.isNote()) return null;
					if (!isCitingNotes && !item.isRegularItem()) return null;
					return CitationDataManager.itemAddedCache.has(item.id);
				}
				return undefined;
			}
		});
		// handle icon click to add/remove items
		itemsTree.addEventListener("mousedown", event => this._handleItemsViewIconClick(event));
		this._refreshItemsViewHighlightedRows();
	}
	
	async _initCollectionTree() {
		const CollectionTree = require('zotero/collectionTree');
		this.collectionsView = await CollectionTree.init(_id('zotero-collections-tree'), {
			onSelectionChange: this._onCollectionSelection.bind(this),
			hideSources: ['duplicates', 'trash', 'feeds']
		});
	}
	
	async _onCollectionSelection() {
		var collectionTreeRow = this.collectionsView.getRow(this.collectionsView.selection.focused);
		if (!this.collectionsView.selection.count) return;
		// Collection not changed
		if (this.itemsView && this.itemsView.collectionTreeRow && this.itemsView.collectionTreeRow.id == collectionTreeRow.id) {
			return;
		}

		this.itemsView.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
		
		// Load library data if necessary
		var library = Zotero.Libraries.get(collectionTreeRow.ref.libraryID);
		if (!library.getDataLoaded('item')) {
			Zotero.debug("Waiting for items to load for library " + library.libraryID);
			await library.waitForDataLoad('item');
		}
		
		await this.itemsView.changeCollectionTreeRow({
			getItems: async () => {
				let items = await collectionTreeRow.getItems();
				// when citing notes, only keep notes or note parents
				if (isCitingNotes) {
					items = items.filter(item => item.isNote() || item.getNotes().length);
				}
				return items;
			},
			isSearch: () => true,
			isSearchMode: () => true,
			setSearch: str => collectionTreeRow.setSearch(str)
		});
		await this.itemsView.setFilter('search', SearchHandler.lastSearchValue);
		
		this.itemsView.clearItemsPaneMessage();
	}

	// Handle click on +/- icon in itemTree
	_handleItemsViewIconClick(event) {
		let row = event.target;
		let { clientX } = event;
		let plusMinusIcon = row.querySelector(".icon-action");
		if (!plusMinusIcon) return;
		let iconRect = plusMinusIcon.getBoundingClientRect();
		// event.target is the actual row, so check if the click happened
		// within the bounding box of the icon
		if (clientX > iconRect.left && clientX < iconRect.right) {
			let selectedItem = this.itemsView.getSelectedItems()[0];
			IOManager.toggleAddedItem([selectedItem]);
		}
	}

	// Highlight/de-highlight selected rows
	_refreshItemsViewHighlightedRows() {
		let selectedIDs = CitationDataManager.items.map(({ zoteroItem }) => zoteroItem.id).filter(id => !!id);
		this.itemsView.setHighlightedRows(selectedIDs);
	}
}

class ListLayout extends Layout {
	constructor() {
		super("list");
	}

	// Create item node for an item group and store item ids in itemIDs attribute
	async createItemNode(item) {
		let itemNode = Helpers.createNode("div", { tabindex: "-1", "aria-describedby": "item-description", role: "option", "data-tabindex": 40 }, "item hbox");
		let id = item.cslItemID || item.id;
		itemNode.setAttribute("itemIDs", id);
		let itemInfo = Helpers.createNode("div", {}, "info");
		let icon = Helpers.createNode("span", {}, "icon icon-css icon-item-type");
		let dataTypeLabel = item.getItemTypeIconName(true);
		icon.setAttribute("data-item-type", dataTypeLabel);

		let title = Helpers.createNode("div", {}, "title");
		let description = Helpers.buildItemDescription(item);
		title.textContent = item.getDisplayTitle();

		itemInfo.append(title, description);
		itemNode.append(icon, itemInfo);
		return itemNode;
	}

	async refreshItemsList() {
		await super.refreshItemsList();

		// Hide the entire list layout if there is not a single item to show
		_id("list-layout").hidden = !_id("list-layout").querySelector(".section:not([hidden])");
		// Explicitly set the height of the container so the transition works when container is collapssed
		for (let container of [..._id("list-layout").querySelectorAll(".itemsContainer")]) {
			container.style.height = `${container.scrollHeight}px`;
		}
		// Set document width to avoid window being stretched horizontally
		doc.documentElement.style.maxWidth = window.innerWidth + "px";
		doc.documentElement.style.minWidth = window.innerWidth + "px";
		// Set max height so the window does not end up being too tall
		doc.documentElement.style.maxHeight = Math.max(window.innerHeight, 500) + "px";
		window.sizeToContent();
		// Clear all these styles after resizing is done
		doc.documentElement.style = "";
		this.updateWindowMinSize();
	}

	// window min height is the height of bubble-input
	updateWindowMinSize() {
		let { height } = _id("bubble-input").getBoundingClientRect();
		doc.documentElement.style.minHeight = `${height}px`;
	}
}

//
// Handling of user IO
//
var IOManager = {
	preSelectedItem: null,

	init() {
		// handle input receiving focus or something being typed
		doc.addEventListener("handle-input", ({ detail: { query, debounce } }) => this._handleInput({ query, debounce }));
		// handle input keypress on an input of bubbleInput. It's handled here and not in bubbleInput
		// because we may need to set a locator or add a pre-selected item to the citation
		doc.addEventListener("input-enter", ({ detail: { input } }) => this._handleInputEnter(input));
		// handle a bubble being moved or deleted
		doc.addEventListener("delete-item", ({ detail: { dialogReferenceID } }) => this._deleteItem(dialogReferenceID));
		doc.addEventListener("move-item", ({ detail: { dialogReferenceID, index } }) => this._moveItem(dialogReferenceID, index));
		// display details popup for the bubble
		doc.addEventListener("show-details-popup", ({ detail: { dialogReferenceID } }) => this._openItemDetailsPopup(dialogReferenceID));
		// handle click on "Add all" button above collapsible sections
		doc.addEventListener("add-all-items", ({ detail: { items } }) => this.addItemsToCitation(items));
		// expand/collapse item sections
		doc.addEventListener("toggle-expand-section", ({ detail: { section } }) => this.toggleSectionCollapse(section));
		// handle "Show in library" btn click
		doc.addEventListener("show-in-library", ({ detail: { itemID } }) => this._showInLibrary(itemID));
		
		// accept/cancel events emitted by keyboardHandler
		doc.addEventListener("dialog-accepted", accept);
		doc.addEventListener("dialog-cancelled", cancel);

		// after item details popup closes, item may have been updated, so refresh bubble input
		_id("itemDetails").addEventListener("popuphidden", () => this.updateBubbleInput());
		// if keep sorted was unchecked and then checked, resort items and update bubbles
		_id("keepSorted").addEventListener("change", () => this._resortItems());

		// set initial dialog mode and attach listener to button
		this.toggleDialogMode();
		_id("mode-button").addEventListener("click", this.toggleDialogMode);

		// open settings popup on btn click
		_id("settings-button").addEventListener("click", event => _id("settings-popup").openPopup(event.target, "before_end"));
		// handle accept/cancel buttons
		_id("accept-button").addEventListener("click", accept);
		_id("cancel-button").addEventListener("click", cancel);
	},

	// switch between list and library modes
	toggleDialogMode() {
		let mode = _id("mode-button").getAttribute("mode");
		let newMode = mode == "library" ? "list" : "library";

		_id("list-layout").hidden = newMode == "library";
		_id("library-layout").hidden = newMode == "list";

		_id("mode-button").setAttribute("mode", newMode);

		currentLayout = newMode === "library" ? libraryLayout : listLayout;
		// do not show View menubar with itemTree-specific options in list mode
		doc.querySelector("item-tree-menu-bar").suppressed = currentLayout.type == "list";
		// when switching from library to list, make sure all selected items are de-selected
		if (currentLayout.type == "list") {
			libraryLayout.itemsView.selection.clearSelection();
			IOManager.updateSelectedItems();
		}
		currentLayout.refreshItemsList();
	},

	// pass current items in the citation to bubble-input to have it update the bubbles
	updateBubbleInput() {
		_id("bubble-input").refresh(CitationDataManager.items);
		currentLayout.updateWindowMinSize();
	},

	async addItemsToCitation(items, { noInputRefocus } = {}) {
		if (accepted) return;
		if (!Array.isArray(items)) {
			items = [items];
		}
		// if selecting a note, add it and immediately accept the dialog
		if (isCitingNotes) {
			if (!items[0].isNote()) return;
			CitationDataManager.items = [];
			await CitationDataManager.addItems({ citationItems: items });
			accept();
			return;
		}
		// If the last input has a locator, add it into the item
		let input = _id("bubble-input").getCurrentInput();
		let locator = Helpers.extractLocator(input.value || "");
		if (locator) {
			for (let item of items) {
				item.label = locator.label;
				item.locator = locator.locator;
			}
		}
		// Add the item at a position based on current input
		let bubblePosition = null;
		if (input) {
			bubblePosition = _id("bubble-input").getFutureBubbleIndex();
			input.remove();
		}
		await CitationDataManager.addItems({ citationItems: items, index: bubblePosition });
		// Refresh the itemTree if in library mode
		if (currentLayout.type == "library") {
			libraryLayout.refreshItemsView();
		}

		this.updateBubbleInput();
		if (!noInputRefocus) {
			_id("bubble-input").refocusInput();
		}
	},

	// Every item in the given array is added to the citation if it is not included
	// and removed if it is.
	toggleAddedItem(items) {
		let needBubbleInputRefresh = true;
		let itemsToAdd = [];
		for (let item of items) {
			let inCitation = CitationDataManager.getItem({ zoteroItemID: item.id });
			if (inCitation) {
				CitationDataManager.deleteItem({ zoteroItemID: item.id });
				needBubbleInputRefresh = true;
			}
			else {
				itemsToAdd.push(item);
			}
		}
		if (itemsToAdd.length) {
			IOManager.addItemsToCitation(itemsToAdd, { noInputRefocus: true });
			needBubbleInputRefresh = false;
		}
		if (needBubbleInputRefresh) {
			IOManager.updateBubbleInput();
			currentLayout.refreshItemsView();
		}
	},

	// Mark which item can be selected on Enter in an input
	markPreSelectedItem(node, itemGroup) {
		doc.querySelector(".pre-selected-item")?.classList.remove("pre-selected-item");
		if (!node) {
			this.preSelectedItem = null;
			return;
		}
		if (SearchHandler.lastSearchValue.length) {
			node.classList.add("pre-selected-item");
			this.preSelectedItem = itemGroup;
		}
	},

	handleItemClick(event) {
		let targetItem = event.target.closest(".item");
		// on click of a collapsed deck in library mode, just expand the deck
		let section = targetItem.closest(".section");
		if (section.classList.contains("expandable") && !section.classList.contains("expanded")) {
			IOManager.toggleSectionCollapse(section);
			return;
		}
		let isMultiselectable = !!targetItem.closest("[data-multiselectable]");
		// Cmd/Ctrl + mouseclick toggles selected item node
		if (isMultiselectable && (Zotero.isMac && event.metaKey) || (!Zotero.isMac && event.ctrlKey)) {
			targetItem.focus();
			targetItem.classList.toggle("selected");
			return;
		}
		// Shift + click selects a range
		if (isMultiselectable && event.shiftKey) {
			let itemNodes = [..._id(`${currentLayout.type}-layout`).querySelectorAll(".item")];
			let firstNode = _id(`${currentLayout.type}-layout`).querySelector(".item.selected") || itemNodes[0];
			KeyboardHandler.rangeSelect(itemNodes, firstNode, targetItem);
			return;
		}
		// get itemIDs associated with the node. For selected items, there can be multiple.
		let itemIDs = new Set(targetItem.getAttribute("itemIDs").split(","));
		// if target item is selected, add all other selected itemIDs
		if (targetItem.classList.contains("selected")) {
			let selectedItemNodes = _id(`${currentLayout.type}-layout`).querySelectorAll(".item.selected");
			for (let itemNode of selectedItemNodes) {
				let ids = itemNode.getAttribute("itemIDs").split(",");
				for (let id of ids) {
					itemIDs.add(id);
				}
			}
		}
		let itemsToAdd = [];
		// collect all items in an array and add them
		for (let itemID of Array.from(itemIDs)) {
			if (itemID.includes("cited:")) {
				let item = SearchHandler.getItem({ cslItemID: itemID });
				itemsToAdd.push(item);
			}
			else {
				let item = SearchHandler.getItem({ zoteroItemID: parseInt(itemID) });
				itemsToAdd.push(item);
			}
		}
		IOManager.addItemsToCitation(itemsToAdd);
	},

	// record which items in the library itemTree are currently selected to highlight them
	updateSelectedItems() {
		let selectedItemIDs = new Set(libraryLayout.itemsView.getSelectedItems().map(item => item.id));
		for (let itemObj of CitationDataManager.items) {
			if (selectedItemIDs.has(itemObj.zoteroItem.id)) {
				itemObj.selected = true;
			}
			else {
				itemObj.selected = false;
			}
		}
		IOManager.updateBubbleInput();
	},

	toggleSectionCollapse(section, status) {
		// set desired class
		if (status == "expanded" && !section.classList.contains("expanded")) {
			section.classList.add("expanded");
		}
		else if (status == "collapsed" && section.classList.contains("expanded")) {
			section.classList.remove("expanded");
		}
		else if (!status) {
			section.classList.toggle("expanded");
		}
		// mark collapsed items as unfocusable
		if (section.classList.contains("expandable") && !section.classList.contains("expanded")) {
			for (let item of [...section.querySelectorAll(".item")]) {
				item.removeAttribute("tabindex");
			}
		}
		// when expanded, make them focusable again
		else {
			for (let item of [...section.querySelectorAll(".item")]) {
				item.setAttribute("tabindex", -1);
			}
		}
	},
	
	async _showInLibrary(itemID) {
		await Zotero.Promise.delay();
		if (currentLayout.type == "list") {
			this.toggleDialogMode();
		}
		let item = await Zotero.Items.getAsync(itemID);
		await libraryLayout.collectionsView.selectLibrary(item.libraryID);
		await libraryLayout.itemsView.selectItem(item.id);
		libraryLayout.itemsView.focus();
	},

	// Handle Enter keypress on an input. If a locator has been typed, add it to previous bubble.
	// Otherwise, add pre-selected item if any. Otherwise, accept the dialog.
	_handleInputEnter(input) {
		let locator = Helpers.extractLocator(input.value);
		let bubble = input.previousElementSibling;
		let item = CitationDataManager.getItem({ dialogReferenceID: bubble?.getAttribute("dialogReferenceID") });
		if (item && locator && locator.onlyLocator && bubble) {
			item.citationItem.locator = locator.locator;
			item.citationItem.label = locator.label;
			input.value = "";
			this.updateBubbleInput();
			return;
		}
		if (IOManager.preSelectedItem) {
			IOManager.addItemsToCitation(IOManager.preSelectedItem);
		}
		else {
			accept();
		}
	},

	_deleteItem(dialogReferenceID) {
		CitationDataManager.deleteItem({ dialogReferenceID });
		if (currentLayout.type == "library") {
			libraryLayout.refreshItemsView();
		}
		this.updateBubbleInput();
	},

	_moveItem(dialogReferenceID, newIndex) {
		let moved = CitationDataManager.moveItem(dialogReferenceID, newIndex);
		if (moved) {
			_id("keepSorted").checked = false;
		}
		this.updateBubbleInput();
	},

	_openItemDetailsPopup(dialogReferenceID) {
		let { zoteroItem, citationItem } = CitationDataManager.getItem({ dialogReferenceID });
		PopupsHandler.openItemDetails(dialogReferenceID, zoteroItem, citationItem, Helpers.buildItemDescription(zoteroItem));
	},

	_handleInput({ query, debounce }) {
		// If there is a locator typed, exclude it from the query
		let locator = Helpers.extractLocator(query);
		if (locator) {
			query = query.replace(locator.fullLocatorString, "");
		}
		// Run search within the current layout
		if (debounce) {
			currentLayout.searchDebounced(query);
		}
		else {
			currentLayout.search(query);
		}
	},

	// Resort items and update the bubbles
	_resortItems() {
		if (!_id("keepSorted").checked) return;
		CitationDataManager.sort().then(() => {
			this.updateBubbleInput();
		});
	}
};

//
// Singleton to store and handle items in this citation.
// CitationDataManager.items is an array of { zoteroItem, citationItem } objects,
// where zoteroItem is Zotero.Item and citationItem is a citation item provided by io.
// They are stored as a pair to make it easier to access both item properties (e.g. item.getDisplayTitle())
// and properties of citation item (e.g. locator) across different components.
//
var CitationDataManager = {
	items: [],
	itemAddedCache: new Set(),

	getCitationItems() {
		return this.items.map(item => item.citationItem);
	},

	getItem({ dialogReferenceID, zoteroItemID }) {
		if (dialogReferenceID) {
			return this.items.find(item => item.dialogReferenceID === dialogReferenceID);
		}
		return this.items.find(item => item.zoteroItem.id === zoteroItemID);
	},

	getItemIndex({ dialogReferenceID, zoteroItemID }) {
		if (dialogReferenceID) {
			return this.items.findIndex(item => item.dialogReferenceID === dialogReferenceID);
		}
		return this.items.findIndex(item => item.zoteroItem.id === zoteroItemID);
	},

	updateItemAddedCache() {
		this.itemAddedCache = new Set();
		for (let { zoteroItem } of this.items) {
			if (!zoteroItem.id) continue;
			this.itemAddedCache.add(zoteroItem.id);
		}
	},
	
	// Include specified items into the citation
	async addItems({ citationItems = [], index = -1 }) {
		for (let item of citationItems) {
			let zoteroItem = this._citationItemToZoteroItem(item);
			// Add a new ID to our citation item and set the same ID on the bubble
			// so we have a reliable way to identify which bubble refers to which citationItem.
			let dialogReferenceID = Zotero.Utilities.randomString(5);
			let toInsert = { citationItem: item, zoteroItem: zoteroItem, dialogReferenceID };
			// Cannot add the same item multiple times
			if (this.items.find(existing => this._areItemsTheSame(existing, toInsert))) continue;
			if (index !== -1) {
				this.items.splice(index, 0, toInsert);
				index += 1;
			}
			else {
				this.items.push(toInsert);
			}
		}
		await this.sort();
		this.updateItemAddedCache();
	},

	deleteItem({ dialogReferenceID, zoteroItemID }) {
		let index = this.getItemIndex({ dialogReferenceID, zoteroItemID });
		if (index === -1) {
			throw new Error("Item to delete not found");
		}
		this.items.splice(index, 1);
		this.updateItemAddedCache();
	},

	moveItem(dialogReferenceID, newIndex) {
		let currentIndex = CitationDataManager.getItemIndex({ dialogReferenceID });
		if (currentIndex === newIndex) return false;
		let [obj] = this.items.splice(currentIndex, 1);
		this.items.splice(newIndex, 0, obj);
		return true;
	},

	// Update io citation object based on Citation.items array
	updateCitationObject(final = false) {
		let result = [];
		for (let item of this.items) {
			let dialogReferenceID = item.dialogReferenceID;
			item = item.citationItem;
			if (item instanceof Zotero.Item) {
				let ioResult = { id: item.cslItemID || item.id };
				if (typeof ioResult.id === "string" && ioResult.id.indexOf("/") !== -1) {
					let item = Zotero.Cite.getItem(ioResult.id);
					ioResult.uris = item.cslURIs;
					ioResult.itemData = item.cslItemData;
				}
				ioResult.label = item.label || null;
				ioResult.locator = item.locator || null;
				ioResult.prefix = item.prefix || null;
				ioResult.suffix = item.suffix || null;
				ioResult['suppress-author'] = item["suppress-author"] || null;
				if (!final) {
					ioResult.dialogReferenceID = dialogReferenceID;
				}
				result.push(ioResult);
			}
			else {
				result.push(item);
			}
		}
		io.citation.citationItems = result;

		if (final && io.sortable) {
			io.citation.properties.unsorted = !_id("keepSorted").checked;
		}
	},

	// Resorts the items in the citation
	async sort() {
		if (!_id("keepSorted").checked) return;
		this.updateCitationObject();
		await io.sort();
		// sync the order of this.items with io.citation.sortedItems
		let sortedItems = io.citation.sortedItems.map(entry => entry[1]);
		for (let item of this.items) {
			let currentIndex = this.getItemIndex({ dialogReferenceID: item.dialogReferenceID });
			let expectedIndex = sortedItems.findIndex(ioItem => ioItem.dialogReferenceID == item.dialogReferenceID);
			if (currentIndex !== expectedIndex) {
				this.items.splice(currentIndex, 1);
				this.items.splice(expectedIndex, 0, item);
			}
		}
	},
	
	// Construct citation upon initial load
	async buildCitation() {
		if (!io.citation.properties.unsorted
				&& _id("keepSorted").checked
				&& io.citation.sortedItems?.length) {
			await this.addItems({ citationItems: io.citation.sortedItems.map(entry => entry[1]) });
		}
		else {
			await this.addItems({ citationItems: io.citation.citationItems });
		}
	},

	// Check if two given items are the same to prevent an item being inserted more
	// than once into the citation. Compare firstCreator and title fields, instead of just
	// itemIDs to account for cited items that may not have ids.
	_areItemsTheSame(itemOne, itemTwo) {
		let zoteroItemOne = itemOne.zoteroItem;
		let zoteroItemTwo = itemTwo.zoteroItem;
		if (zoteroItemOne.getField("firstCreator") !== zoteroItemTwo.getField("firstCreator")) return false;
		if (zoteroItemOne.getDisplayTitle() !== zoteroItemTwo.getDisplayTitle()) return false;
		return true;
	},

	// Shortcut to fetch Zotero.Item based on citationItem
	_citationItemToZoteroItem(citationItem) {
		if (citationItem instanceof Zotero.Item) return citationItem;
		if (io.customGetItem) {
			let item = io.customGetItem(citationItem);
			if (item) return item;
		}
		if (citationItem.id) {
			return Zotero.Cite.getItem(citationItem.id);
		}
		return null;
	}
};

// Top level listeners
window.addEventListener("load", onLoad);
window.addEventListener("resize", () => currentLayout.updateWindowMinSize());
