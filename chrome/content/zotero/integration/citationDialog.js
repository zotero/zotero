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


const ItemTree = require('zotero/itemTree');
const { getCSSIcon } = require('components/icons');
const { COLUMNS } = require('zotero/itemTreeColumns');

var doc, io, isCitingNotes, accepted;

// used for tests
var loaded = false;

var currentLayout, libraryLayout, listLayout;

var Helpers, SearchHandler, PopupsHandler, KeyboardHandler;

const ITEM_LIST_MAX_ITEMS = 50;
const SEARCH_TIMEOUT = 250;

var { CitationDialogHelpers } = ChromeUtils.importESModule('chrome://zotero/content/integration/citationDialog/helpers.mjs');
var { CitationDialogSearchHandler } = ChromeUtils.importESModule('chrome://zotero/content/integration/citationDialog/searchHandler.mjs');
var { CitationDialogPopupsHandler } = ChromeUtils.importESModule('chrome://zotero/content/integration/citationDialog/popupHandler.mjs');
var { CitationDialogKeyboardHandler } = ChromeUtils.importESModule('chrome://zotero/content/integration/citationDialog/keyboardHandler.mjs');

//
// Initialization of all handlers and top-level functions
//
async function onLoad() {
	doc = document;
	io = window.arguments[0].wrappedJSObject;
	isCitingNotes = !!io.isCitingNotes;
	window.isPristine = true;

	Helpers = new CitationDialogHelpers({ doc, io });
	SearchHandler = new CitationDialogSearchHandler({ isCitingNotes, io });
	PopupsHandler = new CitationDialogPopupsHandler({ doc });
	KeyboardHandler = new CitationDialogKeyboardHandler({ doc });

	// Initial height for the dialog (search row with no bubbles)
	window.resizeTo(window.innerWidth, Helpers.getSearchRowHeight());

	_id("keepSorted").disabled = !io.sortable || isCitingNotes;
	_id("keepSorted").checked = io.sortable && !io.citation.properties.unsorted;
	let visibleSettings = !!_id("settings-popup").querySelector("input:not([disabled])");
	_id("settings-button").hidden = !visibleSettings;

	libraryLayout = new LibraryLayout();
	listLayout = new ListLayout();

	// initialize most essential IO functionality (e.g. accept/cancel)
	// remaining listeners that rely on layouts being loaded are added later in IOManager.init
	IOManager.preInit();
	// top-level keypress handling and focus navigation across the dialog
	// keypresses for lower-level bubble-specific behavior are handled in bubbleInput.js
	doc.addEventListener("keydown", event => KeyboardHandler.handleKeydown(event));
	// capturing keypress listener for a few special cases, such as handling arrowUp
	// keypress from the top-most row in the items table
	doc.addEventListener("keydown", event => KeyboardHandler.captureKeydown(event), true);

	// citation has to be built before libraryLayout.init to so itemTree knows which items to highlight
	await CitationDataManager.buildCitation();
	IOManager.updateBubbleInput();
	// init library layout after bubble input is built since bubble-input's height is a factor
	// determining initial library layout height
	await libraryLayout.init();
	// fetch selected items so they are known
	// before refreshing items list after dialog mode setting
	await SearchHandler.refreshSelectedAndOpenItems();
	// some nodes (e.g. item-tree-menu-bar) are expected to be present to switch modes
	// so this has to go after all layouts are loaded
	IOManager.setInitialDialogMode();
	// most of IO handling relies on currentLayout being defined so it must follow setInitialDialogMode
	IOManager.init();
	// explicitly focus bubble input so one can begin typing right away
	_id("bubble-input").refocusInput();
	// loading cited items can take a long time - start loading them now
	// and add new nodes when cited items are ready
	SearchHandler.loadCitedItemsPromise.then(() => {
		SearchHandler.refreshCitedItems();
		currentLayout.refreshItemsList({ retainItemsState: true });
	});

	// Disabled all multiselect when citing notes
	if (isCitingNotes) {
		for (let multiselectable of [...doc.querySelectorAll("[data-multiselectable]")]) {
			delete multiselectable.dataset.multiselectable;
		}
	}
	loaded = true;
}


function accept() {
	if (accepted || SearchHandler.searching || !CitationDataManager.items.length) return;
	accepted = true;
	CitationDataManager.updateCitationObject(true);
	_id("library-layout").hidden = true;
	_id("list-layout").hidden = true;
	_id("bubble-input").hidden = true;
	_id("bottom-area").hidden = true;
	_id("progress").hidden = false;
	let progressHeight = Helpers.getSearchRowHeight();
	// The minHeight is not just removed so that windows doesn't make the window too small
	document.documentElement.style.minHeight = progressHeight + "px";
	setTimeout(() => {
		window.resizeTo(window.innerWidth, progressHeight);
	});
	cleanupBeforeDialogClosing();
	io.accept((percent) => {
		_id("progress").value = Math.round(percent);
	});
}

function cancel() {
	if (accepted) return;
	accepted = true;
	cleanupBeforeDialogClosing();
	io.cancel();
	window.close();
}
// handle dialog being cancelled via window.close() (e.g. clicking X icon on windows)
function onUnload() {
	if (this.accepted) return;
	cancel();
}

function cleanupBeforeDialogClosing() {
	if (!currentLayout || !libraryLayout) return;
	Zotero.Prefs.set("integration.citationDialogLastUsedMode", currentLayout.type);
	if (currentLayout.type == "library") {
		Zotero.Prefs.set("integration.citationDialogCollectionLastSelected", libraryLayout.collectionsView.selectedTreeRow.id);
	}
	libraryLayout.collectionsView.unregister();
	libraryLayout.itemsView.unregister();
}

// register that something changed in the dialog
function dialogNotPristine() {
	window.isPristine = false;
}

// shortcut used for brevity
function _id(id) {
	return doc.getElementById(id);
}


// Template for layout classes.
class Layout {
	constructor(type) {
		this.type = type;
		this._searchDebouncePromise = null;
	}

	// Re-render the items based on search results
	// @param {Boolean} options.retainItemsState: try to restore focused and selected status of item nodes.
	async refreshItemsList({ retainItemsState } = {}) {
		let sections = [];

		// Tell SearchHandler which currently cited items are so they are not included in results
		let citedItems = CitationDataManager.getCitationItems();
		let searchResultGroups = SearchHandler.getOrderedSearchResultGroups(citedItems);
		for (let { key, group, isLibrary } of searchResultGroups) {
			// selected items become a collapsible deck/list if there are multiple items
			let isGroupCollapsible = key == "selected" && group.length > 1;
			
			// Construct each section and items
			let sectionHeader = "";
			if (isLibrary) {
				sectionHeader = Zotero.Libraries.get(key).name;
			}
			// special handling for selected items to display how many total selected items there are
			else if (key == "selected") {
				sectionHeader = await doc.l10n.formatValue(`integration-citationDialog-section-${key}`, { count: group.length, total: SearchHandler.allSelectedItemsCount() });
			}
			else {
				sectionHeader = await doc.l10n.formatValue(`integration-citationDialog-section-${key}`, { count: group.length });
			}
			let section = Helpers.buildItemsSection(`${this.type}-${key}-items`, sectionHeader, isGroupCollapsible, group.length, this.type);
			let itemContainer = section.querySelector(".itemsContainer");
	
			let items = [];
			let index = 0;
			for (let item of group) {
				// do not add an unreasonable number of nodes into the DOM
				if (index >= ITEM_LIST_MAX_ITEMS) break;
				// createItemNode implemented by layouts
				let itemNode = await this.createItemNode(item, isGroupCollapsible ? index : null);
				itemNode.addEventListener("click", IOManager.handleItemClick);
				// items can be dragged into bubble-input to add them into the citation
				itemNode.addEventListener("dragstart", IOManager._handleItemDragStart);
				items.push(itemNode);
				index++;
			}
			// if cited group is present but has no items, cited items must be
			// still loading, so show a placeholder item card
			if (group.length === 0 && key == "cited") {
				let placeholder = Helpers.createCitedItemPlaceholder();
				items = [placeholder];
			}
			itemContainer.replaceChildren(...items);
			sections.push(section);
			if (isGroupCollapsible) {
				// handle click on "Add all"
				section.querySelector(".add-all").addEventListener("click", () => IOManager.addItemsToCitation(group));
				// await for "All all" label so it does not appear blank for a moment after render
				let addAllLabel = await doc.l10n.formatValue("integration-citationDialog-add-all");
				section.querySelector(".add-all").textContent = addAllLabel;
				// if the user explicitly expanded or collapsed the section, keep it as such
				if (IOManager.sectionExpandedStatus[section.id]) {
					IOManager.toggleSectionCollapse(section, IOManager.sectionExpandedStatus[section.id]);
				}
				// otherwise, expand the section if something is typed or whenever the list layout is opened
				else {
					let activeSearch = SearchHandler.searchValue.length > 0;
					IOManager.toggleSectionCollapse(section, (activeSearch || this.type == "list") ? "expanded" : "collapsed");
				}
			}
		}
		let previouslyFocused = doc.activeElement;
		let previouslySelected = doc.querySelectorAll(".item.selected");
		_id(`${this.type}-layout`).querySelector(".search-items").replaceChildren(...sections);
		// Update which bubbles need to be highlighted
		this.updateSelectedItems();

		// Keep focus and selection on the same item nodes if specified.
		// This should only be applicable to refresh after SearchHandler.loadCitedItemsPromise.
		if (retainItemsState) {
			doc.getElementById(previouslyFocused.id)?.focus();
			// Try to retain selected status of items, in case if multiselection was in progress
			for (let oldNote of previouslySelected) {
				let itemNode = doc.getElementById(oldNote.id);
				if (!itemNode) continue;
				itemNode.classList.add("selected");
				itemNode.classList.toggle("current", oldNote.classList.contains("current"));
			}
		}
		// Pre-select the item to be added on Enter of an input
		else {
			this.markPreSelected();
		}
		// Ensure focus is never lost
		if (doc.activeElement.tagName == "body") {
			IOManager._restorePreClickFocus();
		}
	}

	// Create the node for selected/cited/opened item groups.
	// It's different for list and library modes, so it is implemented by layouts.
	async createItemNode() {}


	// Run search and refresh items list
	async search(value, { skipDebounce = false } = {}) {
		if (accepted) return;
		_id("loading-spinner").setAttribute("status", "animate");
		_id("accept-button").hidden = true;
		SearchHandler.searching = true;
		// search for selected/opened items
		// only enforce min query length in list mode
		SearchHandler.setSearchValue(value, this.type == "list");
		await SearchHandler.refreshSelectedAndOpenItems();
		// noop if cited items are not yet loaded
		SearchHandler.refreshCitedItems();
		
		// Never resize window of list layout here to avoid flickering
		// The window will always be resized after the second items list update below
		await this.refreshItemsList({ skipWindowResize: true });

		// debounce to not rerun sql search until typing is probably done
		if (this._searchDebouncePromise && this._searchDebouncePromise.isPending()) {
			this._searchDebouncePromise.cancel();
		}
		if (!skipDebounce) {
			this._searchDebouncePromise = Zotero.Promise.delay(SEARCH_TIMEOUT);
			await this._searchDebouncePromise;
		}
		this._searchDebouncePromise = null;

		// in list mode, search for matches across libraries
		// in library mode, set filter on itemTree
		if (this.type == "list") {
			await SearchHandler.refreshLibraryItems();
			await this.refreshItemsList();
		}
		else {
			// Make sure the collectionTreeRow is defined to
			// avoid errors thrown when filter is set on first load
			while (!this.itemsView.collectionTreeRow) {
				await Zotero.Promise.delay(10);
			}
			await this.itemsView.setFilter('citation-search', value);
		}

		SearchHandler.searching = false;
		_id("loading-spinner").removeAttribute("status");
		_id("accept-button").hidden = false;
		if (this.forceUpdateTablesAfterRefresh && this.type == "library") {
			this.forceUpdateTablesAfterRefresh = false;
			setTimeout(() => {
				libraryLayout.itemsView.tree?.invalidate();
				libraryLayout.itemsView.tree?.forceUpdate();
				// Necessary for the collectionTree to be properly rendered after switching to library mode
				if (libraryLayout.collectionsView) {
					let currentCollectionIndex = libraryLayout.collectionsView.tree.selection.focused;
					libraryLayout.collectionsView.ensureRowIsVisible(currentCollectionIndex);
				}
			}, 250);
		}
	}

	// implemented by layouts
	resizeWindow() {}

	updateSelectedItems() {}

	// Mark initially selected item that can be selected on Enter in an input
	// Item is pre-selected when there is an active search OR when there are no
	// items in the citation yet
	markPreSelected() {
		for (let itemNode of [...doc.querySelectorAll(".item.selected")]) {
			itemNode.classList.remove("selected");
			itemNode.classList.remove("current");
		}
		let firstItemNode = _id(`${currentLayout.type}-layout`).querySelector(`.item:not([disabled])`);
		if (!firstItemNode) return;
		let activeSearch = SearchHandler.searchValue.length > 0;
		let noBubbles = !CitationDataManager.items.length;
		if (activeSearch || noBubbles) {
			firstItemNode.classList.add("current");
			IOManager.selectItemNodesRange(firstItemNode);
		}
	}
}

class LibraryLayout extends Layout {
	constructor() {
		super("library");
		this.lastHeight = null;
	}

	async init() {
		// Set initial height of the dialog such that the collection/itemTrees get at least 400px
		this.lastHeight = Math.max(500, Helpers.getSearchRowHeight() + 400);
		await this._initItemTree();
		await this._initCollectionTree();
		// on mouse scrollwheel in suggested items, scroll the list horizontally
		_id("library-other-items").addEventListener('wheel', this._scrollHorizontallyOnWheel);
	}

	// Create item node for an item group and store item ids in itemIDs attribute
	async createItemNode(item, index = null) {
		let itemNode = Helpers.createNode("div", {
			tabindex: "-1",
			"data-l10n-id": "integration-citationDialog-aria-item-library",
			role: "option",
			"data-tabindex": 30,
			"data-arrow-nav-enabled": true,
			draggable: true
		}, "item keyboard-clickable");
		let id = item.cslItemID || item.id;
		itemNode.setAttribute("itemID", id);
		itemNode.setAttribute("role", "option");
		itemNode.id = id;
		let title = Helpers.createNode("div", {}, "title");
		let description = Helpers.buildItemDescription(item);
		Zotero.Utilities.Internal.renderItemTitle(item.getDisplayTitle(), title);

		itemNode.append(title, description);

		if (index !== null) {
			itemNode.style.setProperty('--deck-index', index);
		}

		return itemNode;
	}

	async refreshItemsList(options) {
		await super.refreshItemsList(options);
		_id("library-other-items").querySelector(".search-items").hidden = !_id("library-layout").querySelector(".section:not([hidden])");
		_id("library-no-suggested-items-message").hidden = !_id("library-other-items").querySelector(".search-items").hidden;
		// When there are no matches, show a message
		if (!_id("library-no-suggested-items-message").hidden) {
			doc.l10n.setAttributes(_id("library-no-suggested-items-message"), "integration-citationDialog-lib-no-items", { search: SearchHandler.searchValue.length > 0 });
		}
		this.resizeWindow();
		let collapsibleDecks = [..._id("library-other-items").querySelectorAll(".section.expandable")];
		for (let collapsibleDeck of collapsibleDecks) {
			collapsibleDeck.querySelector(".itemsContainer").addEventListener("click", this._captureItemsContainerClick, true);
			collapsibleDeck.querySelector(".itemsContainer").classList.add("keyboard-clickable");
			collapsibleDeck.querySelector(".collapse-section-btn").addEventListener("click", (event) => {
				IOManager.toggleSectionCollapse(collapsibleDeck, "collapsed", true);
				// on mouse click, move focus from the button that will disappear onto the collapsed deck
				if (!event.clientX && !event.clientY) {
					collapsibleDeck.querySelector(".itemsContainer").focus();
				}
			});
		}
	}

	// Refresh itemTree to properly display +/- icons column
	async refreshItemsView() {
		await this._refreshItemsViewHighlightedRows();
		// Save selected items, clear selection to not scroll after refresh
		let selectedItemIDs = this.itemsView.getSelectedItems(true);
		this.itemsView.selection.clearSelection();
		// Refresh to reset row cache to get latest data of which items are included
		await this.itemsView.refresh();
		// Redraw the itemTree
		this.itemsView.tree.invalidate();
		// Restore selection without scrolling
		this.itemsView.selection.selectEventsSuppressed = true;
		await this.itemsView.selectItems(selectedItemIDs, true, true);
		this.itemsView.selection.selectEventsSuppressed = false;
	}

	updateSelectedItems() {
		if (!libraryLayout.itemsView) return;
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
	}

	resizeWindow() {
		let bubbleInputHeight = Helpers.getSearchRowHeight();
		let suggestedItemsHeight = _id("library-other-items").getBoundingClientRect().height;
		let minTableHeight = 200;
		let bottomHeight = _id("bottom-area-wrapper").getBoundingClientRect().height;
		
		let minHeight = bubbleInputHeight + suggestedItemsHeight + bottomHeight + minTableHeight;
		// set min-height to make sure suggested items and at least 200px of itemsView is always visible
		doc.documentElement.style.minHeight = `${minHeight}px`;

		// if there is lastHeight recorded, resize to that
		if (this.lastHeight) {
			window.resizeTo(window.innerWidth, this.lastHeight);
			this.lastHeight = null;
		}
		// on linux, the sizing of the window may be off upon initial load
		// despite the minHeight on relevant components
		// to handle that, explicitly resize the window to make sure it's not too small
		else if (Zotero.isLinux && window.outerHeight < minHeight) {
			window.resizeTo(window.innerWidth, minHeight);
		}
	}

	// handle click on the items container
	_captureItemsContainerClick(event) {
		let section = event.target.closest(".section");
		// expand the deck of items if it is collapsed
		if (section.classList.contains("expanded")) return;
		event.stopPropagation();
		IOManager.toggleSectionCollapse(section, "expanded", true);
		// if the click is keyboard-initiated, focus the first item
		if (event.layerX == 0 && event.layerY == 0) {
			let firstItem = section.querySelector(".item");
			IOManager.selectItemNodesRange(firstItem);
			section.querySelector(".item").focus();
		}
	}

	async _initItemTree() {
		var itemsTree = _id('zotero-items-tree');
		let itemColumns = COLUMNS.map((column) => {
			column = Object.assign({}, column);
			column.hidden = !['title', 'firstCreator', 'date'].includes(column.dataKey);
			return column;
		});
		let columnLabel = Zotero.getString('integration-citationDialog-add-to-citation');
		// Add + column to add an item to the citation on click
		itemColumns.push({
			dataKey: 'addToCitation',
			label: columnLabel,
			htmlLabel: ' ', // space for column label to appear empty
			width: 26,
			staticWidth: true,
			fixedWidth: true,
			showInColumnPicker: false,
			renderer: (index, inCitation, column) => {
				let cell = Helpers.createNode("span", {}, `cell ${column.className} clickable`);
				let iconWrapper = Helpers.createNode("span", {}, `icon-action`);
				cell.append(iconWrapper);
				let icon = getCSSIcon('plus-circle');
				if (inCitation === null) {
					// no icon should be shown when an item cannot be added
					// (e.g. when citing notes, parent items are displayed but not included)
					icon = getCSSIcon("");
				}
				// add aria-label for screen readers to announce if this item is added
				else if (inCitation) {
					doc.l10n.setAttributes(cell, "integration-citationDialog-items-table-added")
				}
				else {
					doc.l10n.setAttributes(cell, "integration-citationDialog-items-table");
				}
				iconWrapper.append(icon);
				return cell;
			}
		});
		this.itemsView = await ItemTree.init(itemsTree, {
			id: "citationDialog",
			dragAndDrop: !isCitingNotes,
			persistColumns: true,
			columnPicker: true,
			onSelectionChange: () => {
				libraryLayout.updateSelectedItems();
			},
			regularOnly: !isCitingNotes,
			multiSelect: !isCitingNotes,
			onActivate: (event, items) => {
				// Prevent Enter event from reaching KeyboardHandler which would accept the dialog
				event.preventDefault();
				event.stopPropagation();
				let row = event.target;
				let isClick = event.type == "dblclick";
				// on Enter, clear the selection and try to find
				// the last item's row to keep it visible after items are added
				if (!isClick) {
					this.itemsView.selection.clearSelection();
					let lastItemID = items[items.length - 1].id;
					let rowIndex = this.itemsView.getRowIndexByID(lastItemID);
					row = doc.querySelector(`#item-tree-citationDialog-row-${rowIndex}`);
					if (!row) return;
				}
				let rowTopBeforeRefresh = row.getBoundingClientRect().top;
				IOManager.addItemsToCitation(items).then(() => {
					this._scrollItemTreeToRow(row.id, rowTopBeforeRefresh);
				});
			},
			emptyMessage: Zotero.getString('pane.items.loading'),
			columns: itemColumns,
			// getExtraField helps itemTree fetch the data for a column that's
			// not a part of actual item properties
			getExtraField: (item, key) => {
				if (key == "addToCitation") {
					if (!(item instanceof Zotero.Item)) return null;
					if (isCitingNotes && !item.isNote()) return null;
					if (!isCitingNotes && !item.isRegularItem()) return null;
					// The returned value needs to be a string due to a call to .toLowerCase()
					// in _handleTyping of virtualized-table. Otherwise, errors are thrown if you type
					// when the addToCitation column is used for sorting.
					// Strings have to be different to allow for sorting by the addToCitation column.
					// "" indicates the item is not in the citation, " " indicates that it is.
					// " " is picked over other strings to never be picked up by _handleTyping
					//  of virtualized-table, which could change row selection in a way that's irrelevant here.
					return CitationDataManager.itemAddedCache.has(item.id) ? " " : "";
				}
				return undefined;
			}
		});
		doc.querySelector("item-tree-menu-bar").init(this.itemsView);
		// handle icon click to add/remove items
		itemsTree.addEventListener("mousedown", event => this._handleItemsViewRowClick(event), true);
		itemsTree.addEventListener("mouseup", event => this._handleItemsViewRowClick(event), true);
		// manually handle hover effect on +/- icon, since css :hover applies to the entire row
		itemsTree.addEventListener("mousemove", event => this._handleItemsViewMouseMove(event));
		// handle backspace to remove an item from citation
		itemsTree.addEventListener("keypress", event => this._handleItemsViewKeyPress(event));
		// only highlight bubbles of selected rows when the focus is in itemTree
		// when focus leaves the items table, bubbles highlighting is removed
		itemsTree.addEventListener("focusin", this.updateSelectedItems);
		itemsTree.addEventListener("focusout", this._clearSelectedBubbles);
		this._refreshItemsViewHighlightedRows();
	}
	
	async _initCollectionTree() {
		const CollectionTree = require('zotero/collectionTree');
		this.collectionsView = await CollectionTree.init(_id('zotero-collections-tree'), {
			onSelectionChange: this._onCollectionSelection.bind(this),
			hideSources: ['duplicates', 'trash', 'feeds'],
			initialFolder: Zotero.Prefs.get("integration.citationDialogCollectionLastSelected"),
			onActivate: () => {},
			filterLibraryIDs: io.filterLibraryIDs
		});
		// Add aria-description with instructions on what this collection tree is for
		// Voiceover announces the description placed on the actual tree when focus enters it
		if (Zotero.isMac) {
			doc.l10n.setAttributes(_id("collection-tree"), "integration-citationDialog-collections-table");
		}
		// JAWS does not. It will announce the description and label of the parent with role=group
		// on JAWS+Tab keypress. So on windows, place aria-label and description on the rows' container.
		else {
			let rowsContainer = doc.querySelector("#collection-tree .windowed-list");
			doc.l10n.setAttributes(rowsContainer, "integration-citationDialog-collections-table");
			rowsContainer.setAttribute("role", "group");
		}
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
			id: collectionTreeRow.id,
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
			setSearch: (searchText, mode) => collectionTreeRow.setSearch(searchText, mode),
			ref: collectionTreeRow.ref
		});
		await this.itemsView.setFilter('search', SearchHandler.searchValue);
		
		this.itemsView.clearItemsPaneMessage();
	}

	// Handle mouseup and mousedown events on a row in itemTree to enable clicking on +/- button
	// On mousedown, add .active effect to the +/- button
	// On mouseup, add/remove the clicked item from the citation
	// This specific handling is required, since :active effect fires on the row and not the child button
	_handleItemsViewRowClick(event) {
		// only trigger on left mouse click
		if (event.button !== 0) return;
		let row = event.target;
		// find which icon we hovered over
		let hoveredOverIcon = row.querySelector(".icon-action.hover");
		if (!hoveredOverIcon) return;
		if (event.type == "mouseup") {
			let rowIndex = row.id.split("-")[4];
			let clickedItem = this.itemsView.getRow(rowIndex).ref;
			hoveredOverIcon.classList.remove("active");
			let rowTopBeforeRefresh = row.getBoundingClientRect().top;
			this.itemsView.selection.clearSelection();
			IOManager.addItemsToCitation([clickedItem]).then(() => {
				this._scrollItemTreeToRow(row.id, rowTopBeforeRefresh);
			});
		}
		else if (event.type == "mousedown") {
			hoveredOverIcon.classList.add("active");
		}
		// stop propagation to not select the row
		event.stopPropagation();
		// do not move focus into the table
		event.preventDefault();
	}

	// Add .hover effect to +/- button when the mouse is above it
	// This  handling is required, since :hover effect fires on the row and not the actual button
	_handleItemsViewMouseMove(event) {
		let { clientY, clientX, target } = event;
		let actionIcons = [...event.target.querySelectorAll(".icon-action")];
		if (!actionIcons.length) return;
		// find which icon we hovered over
		let hoveredOverIcon = actionIcons.find((icon) => {
			let iconRect = icon.getBoundingClientRect();
			// event.target is the actual row, so check if the click happened
			// within the bounding box of the +/- icon and handle it same as a double click
			let overIcon = clientX > iconRect.left && clientX < iconRect.right
				&& clientY > iconRect.top && clientY < iconRect.bottom;
			return overIcon;
		});
		if (!target.classList.contains("row") || !hoveredOverIcon) {
			_id('zotero-items-tree').querySelector(".icon-action.hover")?.classList.remove("hover");
			_id('zotero-items-tree').querySelector(".icon-action.active")?.classList.remove("active");
			return;
		}
		hoveredOverIcon.classList.add("hover");
	}

	// backspace in itemsView deletes items from the citation
	_handleItemsViewKeyPress(event) {
		if (event.key == "Backspace") {
			let itemsToRemove = this.itemsView.getSelectedItems();
			for (let item of itemsToRemove) {
				let citationItems = CitationDataManager.getItems({ zoteroItemID: item.id });
				for (let citationItem of citationItems) {
					let { dialogReferenceID } = citationItem;
					IOManager._deleteItem(dialogReferenceID);
				}
			}
		}
	}

	// Highlight/de-highlight selected rows
	async _refreshItemsViewHighlightedRows() {
		let selectedIDs = CitationDataManager.items.map(({ zoteroItem }) => zoteroItem.id).filter(id => !!id);
		// Wait for the tree to fully load to avoid a logged error that the tree is undefined
		while (!this.itemsView.tree) {
			await Zotero.Promise.delay(10);
		}
		this.itemsView.setHighlightedRows(selectedIDs);
	}

	_scrollHorizontallyOnWheel(event) {
		if (event.deltaY !== 0 && event.deltaX === 0) {
			_id("library-other-items").scrollLeft += event.deltaY;
			event.preventDefault();
		}
	}

	// after an item is added, bubble-input's height may increase and push the itemTree down
	// scroll it back up so that the mouse remains over the same row as before click
	// do not do it on click of the first row, since then the mouse will be on a header
	_scrollItemTreeToRow(rowID, rowTopBeforeRefresh) {
		let rowIndex = rowID.split("-")[4];
		if (rowIndex === 0) return;
		this.itemsView.ensureRowIsVisible(rowIndex);
		let rowAfterRefresh = doc.querySelector(`#zotero-items-tree #${rowID}`);
		let rowTopAfterRefresh = rowAfterRefresh.getBoundingClientRect().top;
		let delta = rowTopAfterRefresh - rowTopBeforeRefresh;
		if (delta > 0.1) {
			rowAfterRefresh.closest(".virtualized-table-body").scrollTop += delta;
		}
	}

	// remove selected highlight from all bubbles
	_clearSelectedBubbles() {
		for (let itemObj of CitationDataManager.items) {
			itemObj.selected = false;
		}
		IOManager.updateBubbleInput();
	}
}

class ListLayout extends Layout {
	constructor() {
		super("list");
	}

	// Create item node for an item group and store item ids in itemIDs attribute
	async createItemNode(item) {
		let itemNode = Helpers.createNode("div", {
			tabindex: "-1",
			"data-l10n-id": "integration-citationDialog-aria-item-list",
			role: "option",
			"data-tabindex": 30,
			"data-arrow-nav-enabled": true,
			draggable: true
		}, "item keyboard-clickable");
		let id = item.cslItemID || item.id;
		itemNode.setAttribute("itemID", id);
		itemNode.setAttribute("role", "option");
		itemNode.id = id;
		let icon = Helpers.createNode("span", {}, "icon icon-css icon-item-type");
		let dataTypeLabel = item.getItemTypeIconName(true);
		icon.setAttribute("data-item-type", dataTypeLabel);

		let title = Helpers.createNode("div", {}, "title");
		let titleContent = Helpers.createNode("span", {}, "");
		let description = Helpers.buildItemDescription(item);
		Zotero.Utilities.Internal.renderItemTitle(item.getDisplayTitle(), titleContent);
		title.append(icon, titleContent);
		itemNode.append(title, description);
		if (Zotero.Retractions.isRetracted(item)) {
			let retractedIcon = getCSSIcon("cross");
			retractedIcon.classList.add("retracted");
			icon.after(retractedIcon);
		}
		return itemNode;
	}

	async refreshItemsList(options = {}) {
		await super.refreshItemsList(options);

		// Hide padding of list layout if there is not a single item to show
		let isEmpty = !_id("list-layout").querySelector(".section:not([hidden])");
		_id("list-layout").classList.toggle("empty", isEmpty);
		// Explicitly set the height of the container so the transition works when container is collapssed
		for (let container of [..._id("list-layout").querySelectorAll(".itemsContainer")]) {
			container.style.height = `${container.scrollHeight}px`;
		}
		// collapse/expand collapsible section when header is clicked
		let collapsibleSection = doc.querySelector(".section.expandable");
		if (collapsibleSection) {
			collapsibleSection.querySelector(".header-label").addEventListener("click", () => IOManager.toggleSectionCollapse(collapsibleSection, null, true));
		}
		if (!options.skipWindowResize) {
			this.resizeWindow();
		}
	}

	updateSelectedItems() {
		let selectedIDs = new Set([...doc.querySelectorAll(".item.selected")].map(node => parseInt(node.getAttribute("itemID"))));
		for (let itemObj of CitationDataManager.items) {
			if (selectedIDs.has(itemObj.zoteroItem.id)) {
				itemObj.selected = true;
			}
			else {
				itemObj.selected = false;
			}
		}
		IOManager.updateBubbleInput();
	}

	resizeWindow() {
		let bubbleInputHeight = Helpers.getSearchRowHeight();

		// height of all sections
		let sectionsHeight = 0;
		for (let section of [..._id("list-layout").querySelectorAll(".section:not([hidden])")]) {
			sectionsHeight += section.getBoundingClientRect().height;
		}
		// cap at 400px
		sectionsHeight = Math.min(sectionsHeight, 400);

		// account for padding of the items list
		let sectionsWrapperStyle = getComputedStyle(_id("list-layout-wrapper"));
		let sectionsWrapperPadding = 0;
		let marginOfError = 0;
		if (sectionsHeight > 0) {
			sectionsWrapperPadding = parseInt(sectionsWrapperStyle.paddingTop) + parseInt(sectionsWrapperStyle.paddingBottom);
			// margin of error to ensure that the scrollbar does not appear unless really necessary
			marginOfError = Zotero.isWin ? 6 : 2;
		}

		// height of the bottom section
		let bottomHeight = _id("bottom-area-wrapper").getBoundingClientRect().height;
		
		// set min height and resize the window
		let autoHeight = bubbleInputHeight + sectionsHeight + sectionsWrapperPadding + bottomHeight + marginOfError;
		let minHeight = bubbleInputHeight + bottomHeight;
		doc.documentElement.style.minHeight = `${minHeight}px`;
		
		// Timeout is required likely to allow minHeight update to settle
		setTimeout(() => {
			window.resizeTo(window.innerWidth, parseInt(autoHeight));
		}, 10);
	}

	_markRoundedCorners() {
		let selectedGroupStarted = false;
		let previousRow;
		let items = [...doc.querySelectorAll(".item")];
		for (let rowIndex = 0; rowIndex < items.length; rowIndex++) {
			let row = items[rowIndex];
			row.classList.remove("selected-first", "selected-last");
			// stop if we reached the end of the container
			if (previousRow && selectedGroupStarted && row.parentNode !== previousRow.parentNode) {
				selectedGroupStarted = false;
				previousRow.classList.add("selected-last");
			}
			// mark the first item in a group of consecutively selected
			if (row.classList.contains("selected") && !selectedGroupStarted) {
				row.classList.add("selected-first");
				selectedGroupStarted = true;
			}
			// mark the last item in a group of consecutively selected
			if (!row.classList.contains("selected") && selectedGroupStarted && previousRow) {
				previousRow.classList.add("selected-last");
				selectedGroupStarted = false;
			}
			// if this is the last selected item, mark it as the last selected too
			if (row.classList.contains("selected") && rowIndex == items.length - 1) {
				row.classList.add("selected-last");
			}
			previousRow = row;
		}
	}
}

//
// Handling of user IO
//
const IOManager = {
	sectionExpandedStatus: {},

	// most essential IO functionality that is added immediately on load
	preInit() {
		_id("accept-button").addEventListener("click", accept);
		_id("cancel-button").addEventListener("click", cancel);

		doc.addEventListener("dialog-accepted", accept);
		doc.addEventListener("dialog-cancelled", cancel);
	},

	init() {
		// handle input receiving focus or something being typed
		doc.addEventListener("handle-input", ({ detail: { query, eventType } }) => this._handleInput({ query, eventType }));
		// handle input keypress on an input of bubbleInput. It's handled here and not in bubbleInput
		// because we may need to set a locator or add a pre-selected item to the citation
		doc.addEventListener("input-enter", ({ detail: { input } }) => this._handleInputEnter(input));
		// handle a bubble being moved or deleted
		doc.addEventListener("delete-item", ({ detail: { dialogReferenceID } }) => this._deleteItem(dialogReferenceID));
		doc.addEventListener("move-item", ({ detail: { dialogReferenceID, index } }) => this._moveItem(dialogReferenceID, index));
		doc.addEventListener("add-dragged-item", ({ detail: { itemIDs, index } }) => this._handleItemDrop(itemIDs, index));
		// display details popup for the bubble
		doc.addEventListener("show-details-popup", ({ detail: { dialogReferenceID } }) => this._openItemDetailsPopup(dialogReferenceID));
		// mark item nodes as selected to highlight them and mark relevant bubbles
		doc.addEventListener("select-items", ({ detail: { startNode, endNode } }) => this.selectItemNodesRange(startNode, endNode));
		// update bubbles after citation item is updated by itemDetails popup
		doc.addEventListener("item-details-updated", () => this.updateBubbleInput());

		doc.addEventListener("DOMMenuBarActive", () => this._handleMenuBarAppearance());

		// if keep sorted was unchecked and then checked, resort items and update bubbles
		_id("keepSorted").addEventListener("change", () => this._resortItems());

		_id("mode-button").addEventListener("click", () => this.toggleDialogMode());

		// open settings popup on btn click
		_id("settings-button").addEventListener("click", event => _id("settings-popup").openPopup(event.target, "before_end"));

		// some additional logic to keep focus on relevant nodes during mouse interactions
		this._initFocusRetention();
		doc.addEventListener("focusin", this.resetSelectedAfterFocus);
	},

	// switch between list and library modes
	toggleDialogMode(newMode) {
		if (!newMode) {
			let mode = _id("mode-button").getAttribute("mode");
			newMode = mode == "library" ? "list" : "library";
		}
		_id("list-layout").hidden = newMode == "library";
		_id("library-layout").hidden = newMode == "list";

		// Delete all item nodes from the old layout
		for (let itemNode of [...doc.querySelectorAll(".item")]) {
			itemNode.remove();
		}

		_id("mode-button").setAttribute("mode", newMode);
		doc.l10n.setAttributes(_id("mode-button"), "integration-citationDialog-btn-mode", { mode: newMode });

		let isInitialModeSetting = currentLayout === undefined;
		currentLayout = newMode === "library" ? libraryLayout : listLayout;
		// do not show View menubar with itemTree-specific options in list mode
		doc.querySelector("item-tree-menu-bar").suppressed = currentLayout.type == "list";
		// switching from library to list mode initiated by the user (not via setInitialDialogMode on load)
		if (currentLayout.type == "list" && !isInitialModeSetting) {
			// when switching from library to list, make sure all selected items are de-selected
			libraryLayout.itemsView?.selection.clearSelection();
			currentLayout.updateSelectedItems();
			// save the library layout's height to restore it if we switch back
			libraryLayout.lastHeight = window.innerHeight;
		}
		// After switchingto list mode, the window is often resized, which causes the virtualized table
		// to redraw and remove most of .row nodes. Then, if one switches back to library mode, the rows
		// may or may not get redrawn again. For example, if the window's height does not change - they won't
		// and the tree will look fully or partially empty until the user scrolls.
		// There are other, harder to reproduce, instances when the tree is initially not fullly drawn.
		// In this workaround, the trees will be force refreshed after a delay to make sure
		// the trees get rendered no matter what.
		if (currentLayout.type == "library") {
			currentLayout.forceUpdateTablesAfterRefresh = true;
		}
		currentLayout.search(SearchHandler.searchValue, { skipDebounce: true });
	},

	// pass current items in the citation to bubble-input to have it update the bubbles
	updateBubbleInput() {
		// re-generate the bubble string for each item, in case a locator/prefix/suffix/etc. was changed
		for (let item of CitationDataManager.items) {
			item.bubbleString = Helpers.buildBubbleString({ citationItem: item.citationItem, zoteroItem: item.zoteroItem });
		}
		_id("bubble-input").refresh(CitationDataManager.items);
		_id("accept-button").disabled = !CitationDataManager.items.length;
	},

	async addItemsToCitation(items, { noInputRefocus, index } = { index: null }) {
		if (accepted || SearchHandler.searching) return;
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
		// Warn about retracted items, if any are present
		for (let item of items) {
			if (!Zotero.Retractions.shouldShowCitationWarning(item)) continue;
			let canProceed = PopupsHandler.showRetractedWarning(item);
			// User did not select "Continue", so just stop
			if (!canProceed) return;
		}
		
		// If multiple items are being added, only add ones that are not included in the citation
		if (items.length > 1) {
			items = items.filter(item => !(item.id && CitationDataManager.getItems({ zoteroItemID: item.id }).length));
		}

		// If the last input has a locator, add it into the item
		let input = _id("bubble-input").getCurrentInput();
		let locator = Helpers.extractLocator(input.value || "");
		// If there is no locator, make sure we clear it from the citation item
		for (let item of items) {
			item.label = locator?.label || null;
			item.locator = locator?.locator || null;
		}
		// Add the item at a position based on current input if it is not explicitly specified
		if (index === null && input) {
			index = _id("bubble-input").getFutureBubbleIndex();
		}
		// If there was an input used to run the search, clear it
		if (input) {
			input.remove();
		}

		await CitationDataManager.addItems({ citationItems: items, index });
		// Refresh the itemTree if in library mode
		if (currentLayout.type == "library") {
			libraryLayout.refreshItemsView();
		}

		this.updateBubbleInput();
		// Always refresh items list to make sure the opened and selected items are up to date
		await currentLayout.refreshItemsList();
		if (!noInputRefocus) {
			_id("bubble-input").refocusInput();
		}
		dialogNotPristine();
	},

	// select all items between startNode and endNode
	selectItemNodesRange(startNode, endNode = null) {
		let itemNodes = [...doc.querySelectorAll(".item")];
		for (let node of itemNodes) {
			node.classList.remove("selected", "selected-first", "selected-last");
		}
		if (startNode === null) return;

		// can't select the collapsed deck of items
		if (startNode.classList.contains("itemsContainer")) return;

		let startIndex = itemNodes.indexOf(startNode);
		let endIndex = endNode ? itemNodes.indexOf(endNode) : startIndex;

		// if startIndex is after endIndex, just swap them
		if (startIndex > endIndex) [startIndex, endIndex] = [endIndex, startIndex];

		for (let i = startIndex; i <= endIndex; i++) {
			IOManager.toggleItemNodeSelect(itemNodes[i], true);
		}
		currentLayout.updateSelectedItems();
	},

	toggleItemNodeSelect(itemNode, isSelected = null) {
		if (isSelected === true) {
			itemNode.classList.add("selected");
		}
		else if (isSelected === false) {
			itemNode.classList.remove("selected");
		}
		else {
			itemNode.classList.toggle("selected");
		}
		currentLayout.updateSelectedItems();
		// For library view, this is handled in itemTree.jsx
		if (currentLayout.type == "list") {
			listLayout._markRoundedCorners();
		}
	},

	handleItemClick(event) {
		let targetItem = event.target.closest(".item");
		let multiselectable = targetItem.closest("[data-multiselectable]");
		
		// Debounce double clicks so one does not add multiple items unintentionally
		if (IOManager._lastClickTime && (new Date()).getTime() - IOManager._lastClickTime < 300) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		IOManager._lastClickTime = (new Date()).getTime();

		// Cmd/Ctrl + mouseclick toggles selected item node
		if (multiselectable && (Zotero.isMac && event.metaKey) || (!Zotero.isMac && event.ctrlKey)) {
			IOManager.toggleItemNodeSelect(targetItem);
			return;
		}
		// Shift + click selects a range
		if (multiselectable && event.shiftKey) {
			let itemNodes = [..._id(`${currentLayout.type}-layout`).querySelectorAll(".item")];
			let firstNode = _id(`${currentLayout.type}-layout`).querySelector(".item.selected") || itemNodes[0];
			IOManager.selectItemNodesRange(firstNode, targetItem);
			return;
		}
		// get itemIDs associated with the nodes
		let itemIDs = new Set([targetItem.getAttribute("itemID")]);
		// if target item is selected, add all other selected itemIDs
		if (targetItem.classList.contains("selected")) {
			let selectedItemNodes = _id(`${currentLayout.type}-layout`).querySelectorAll(".item.selected");
			for (let itemNode of selectedItemNodes) {
				itemIDs.add(itemNode.getAttribute("itemID"));
			}
		}
		let itemsToAdd = Array.from(itemIDs).map(itemID => SearchHandler.getItem(itemID));
		IOManager.addItemsToCitation(itemsToAdd);
	},

	toggleSectionCollapse(section, status, userInitiated) {
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
		// Record if the user explicitly expanded or collapsed the section to not undo it during next refresh
		if (userInitiated) {
			IOManager.sectionExpandedStatus[section.id] = section.classList.contains("expanded") ? "expanded" : "collapsed";
		}
		// mark collapsed items as unfocusable
		if (section.classList.contains("expandable") && !section.classList.contains("expanded")) {
			for (let item of [...section.querySelectorAll(".item")]) {
				item.removeAttribute("tabindex");
				item.setAttribute("draggable", false);
				item.classList.remove("current");
				item.classList.remove("selected");
			}
			// in library, the items deck itself becomes focusable
			if (currentLayout.type == "library") {
				section.querySelector(".itemsContainer").setAttribute("tabindex", -1);
				section.querySelector(".itemsContainer").dataset.arrowNavEnabled = true;
				// if an item if focused, focus the collapsed container for smoother transition
				if (doc.activeElement.classList.contains("item")) {
					section.querySelector(".itemsContainer").focus();
				}
			}
		}
		// when expanded, make them focusable again
		else {
			for (let item of [...section.querySelectorAll(".item")]) {
				item.setAttribute("tabindex", -1);
				item.setAttribute("draggable", true);
			}
			if (currentLayout.type == "library") {
				let container = section.querySelector(".itemsContainer");
				container.removeAttribute("tabindex");
				container.classList.remove("selected", "current");
			}
		}
		section.querySelector(".header-label").setAttribute("aria-expanded", section.classList.contains("expanded"));
		// In list mode, there may be some empty space left after section collapse
		if (currentLayout.type == "list") {
			setTimeout(() => {
				currentLayout.resizeWindow();
			}, 300);
		}
	},


	// when focus leaves the input or suggested items area in library mode, un-select all items
	// so they do not apear highlighted, since Enter would not add them anymore
	// it does not apply to list mode
	resetSelectedAfterFocus(event) {
		if (currentLayout.type == "list") return;
		let focused = event.target;
		let itemsShouldRemainSelected = focused.classList.contains("input") || _id("library-other-items").contains(focused);
		if (itemsShouldRemainSelected) {
			if (!doc.querySelector(".item.selected")) {
				currentLayout.markPreSelected();
			}
			return;
		}
		for (let item of doc.querySelectorAll(".item")) {
			item.classList.remove("selected");
			item.classList.remove("current");
		}
	},

	// Set the initial dialog mode per user's preference
	setInitialDialogMode() {
		let desiredMode = Zotero.Prefs.get("integration.citationDialogMode");
		if (desiredMode == "last-used") {
			desiredMode = Zotero.Prefs.get("integration.citationDialogLastUsedMode");
		}
		// When the dialog is opened for the very first time, default to list mode
		if (!desiredMode) {
			desiredMode = "list";
		}
		this.toggleDialogMode(desiredMode);
	},
	
	// handle drag start of item nodes into bubble-input
	_handleItemDragStart(event) {
		let itemNode = event.target;
		if (!itemNode.classList.contains("item")) return;
		let selectedItems = itemNode.classList.contains("selected") ? [...doc.querySelectorAll(".item.selected")] : [itemNode];
		let wrapper = Helpers.createNode("div", {}, "drag-image-wrapper");
		wrapper.append(...selectedItems.map(node => node.cloneNode(true)));
		itemNode.parentNode.append(wrapper);
		let rect = itemNode.getBoundingClientRect();
		let offsetX = event.clientX - rect.left;
		let offsetY = event.clientY - rect.top;
		event.dataTransfer.setDragImage(wrapper, offsetX, offsetY);
		// Same format as with drag-drop of items in itemTree via Zotero.Utilities.Internal.onDragItems
		let draggedItemIDs = selectedItems.map(node => node.getAttribute("itemID")).join(",");
		event.dataTransfer.setData("zotero/item", draggedItemIDs);
		setTimeout(() => {
			itemNode.parentNode.removeChild(wrapper);
		});
	},

	// add into the citation items drag-dropped into the bubble-input
	_handleItemDrop(itemIDs, index) {
		// fetch items based on their IDs. Check SearchHandler for cited items and
		// search results. Items dragged from itemTree would not be in SearchHandler.results,
		// so check Zotero.Items as a fallback
		let items = itemIDs.map(id => SearchHandler.getItem(id) || Zotero.Items.get(id));
		this.addItemsToCitation(items, { index });
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
			input.dispatchEvent(new Event('input', { bubbles: true }));
			this.updateBubbleInput();
			return;
		}
		// add whatever items are selected
		if (doc.querySelector(".item.selected")) {
			let selectedIDs = [...doc.querySelectorAll(".item.selected")].map(node => node.getAttribute("itemID"));
			let items = selectedIDs.map(id => SearchHandler.getItem(id));
			IOManager.addItemsToCitation(items);
		}
		// in library mode, if there are no selected/open/cited items but there is a single match in itemTree, add that one matching item
		else if (currentLayout.type == "library" && libraryLayout.itemsView.rowCount === 1 && input.value.length) {
			let firstRowID = libraryLayout.itemsView.getRow(0).ref.id;
			IOManager.addItemsToCitation(Zotero.Items.get(firstRowID));
		}
		// Enter on an empty input accepts the dialog
		else if (!input.value.length) {
			accept();
		}
	},

	_deleteItem(dialogReferenceID) {
		CitationDataManager.deleteItem({ dialogReferenceID });
		if (currentLayout.type == "library") {
			libraryLayout.refreshItemsView();
		}
		this.updateBubbleInput();
		// Always refresh items list to make sure the opened and selected items are up to date
		currentLayout.refreshItemsList();
		// if the focus was lost (e.g. after clicking on the X icon of a bubble)
		// try to return focus to previously-focused node
		setTimeout(() => {
			// timeout needed to handle deleteing the bubble from itemDetails popup
			if (doc.activeElement.tagName == "body") {
				IOManager._restorePreClickFocus();
			}
		});
		dialogNotPristine();
	},

	_moveItem(dialogReferenceID, newIndex) {
		let moved = CitationDataManager.moveItem(dialogReferenceID, newIndex);
		if (moved) {
			_id("keepSorted").checked = false;
		}
		this.updateBubbleInput();
		dialogNotPristine();
	},

	_openItemDetailsPopup(dialogReferenceID) {
		let { zoteroItem, citationItem } = CitationDataManager.getItem({ dialogReferenceID });
		PopupsHandler.openItemDetails(dialogReferenceID, zoteroItem, citationItem, Helpers.buildItemDescription(zoteroItem));
	},

	_handleInput({ query, eventType }) {
		// If there is a locator typed, exclude it from the query
		let locator = Helpers.extractLocator(query);
		if (locator) {
			query = query.replace(locator.fullLocatorString, "");
		}
		// Do not rerun search if the search value is the same
		// (e.g. focus returns into the last input)
		if (SearchHandler.cleanSearchQuery(query) == SearchHandler.searchValue) {
			return;
		}
		currentLayout.search(query, { skipDebounce: eventType == "focus" });
		dialogNotPristine();
	},

	_handleMenuBarAppearance() {
		if (Zotero.isMac) return;
		let bottomAreaBox = _id("bottom-area-wrapper").getBoundingClientRect();
		// if the bottom-area was pushed outside of the bounds of the window by itemTree's menubar
		// increase the window's width a bit so it is still accessible.
		// + 1 is the margin of safety needed to account for tiny differences in positioning
		// (e.g. on windows, bottomAreaBox.bottom may have a decimal)
		if (bottomAreaBox.bottom > window.innerHeight + 1) {
			window.resizeTo(window.innerWidth, window.innerHeight + 30);
		}
	},

	// Resort items and update the bubbles
	_resortItems() {
		if (!_id("keepSorted").checked) return;
		CitationDataManager.sort().then(() => {
			this.updateBubbleInput();
		});
	},

	// Return focus to where it was before click moved focus.
	// If it's not possible, refocus the last input in bubble-input so that
	// focus is not just lost.
	_restorePreClickFocus() {
		if (doc.contains(IOManager._focusedBeforeClick)) {
			IOManager._focusedBeforeClick.focus();
			// If the focus was moved, stop
			if (doc.activeElement == IOManager._focusedBeforeClick) {
				return;
			}
		}
		// If the focus did not set, or there is no node to focus, refocus bubble-input
		_id("bubble-input").refocusInput();
	},

	// We want to not place focus on some of the focusable nodes on mouse click.
	// These listeners try to keep focus on main components of the interface for
	// a more consistent navigation.
	_initFocusRetention() {
		IOManager._noRefocusing = null;
		IOManager._focusBeforePanelShow = null;
		IOManager._clicked = null;
		IOManager._focusedBeforeClick = null;

		// When focus changes, check if the newly focused node is the node that was last clicked.
		// If so, return focus to whatever  node was focused before the click.
		// That way, one can click a button without moving focus onto it.
		doc.addEventListener("focusout", (_) => {
			setTimeout(() => {
				// bubble-input and itemTree/collectionTree are the main interactable elements,
				// so don't move focus from them
				if (_id("bubble-input").contains(doc.activeElement)) return;
				if (_id("library-trees").contains(doc.activeElement)) return;
				// cmd-click on suggester items in library mode should focus them
				if (currentLayout.type == "library" && doc.activeElement.closest(".itemsContainer")) return;
				if (IOManager._noRefocusing) return;
				let focused = doc.activeElement;
				if (focused.contains(IOManager._clicked) && !focused.closest("panel")) {
					IOManager._restorePreClickFocus();
				}
			});
		});
		// Record which node was last clicked for the focusout handler above
		doc.addEventListener("mousedown", (event) => {
			if (event.target.closest("panel")) return;
			IOManager._clicked = event.target;
			IOManager._focusedBeforeClick = doc.activeElement;
		});
		// Clear record of last clicked node if some other interaction happened (e.g. keydown)
		doc.addEventListener("keydown", (event) => {
			if (event.target.closest("panel")) return;
			IOManager._clicked = null;
		});

		// When a popup is appearing after click, record which node was focused before click happened
		doc.addEventListener("popupshowing", (event) => {
			if (!["xul:panel"].includes(event.target.tagName)) return;
			IOManager._noRefocusing = true;
			IOManager._focusBeforePanelShow = null;
			if (doc.activeElement.contains(IOManager._clicked)) {
				IOManager._focusBeforePanelShow = IOManager._focusedBeforeClick;
			}
		});
		// When the popup is closed, return focus to where it was before the popup was
		// opened by click.
		doc.addEventListener("popuphidden", (event) => {
			let popup = event.target;
			if (!["xul:panel"].includes(popup.tagName)) return;
			IOManager._noRefocusing = false;
			if (IOManager._focusBeforePanelShow) {
				IOManager._focusBeforePanelShow.focus();
			}
			IOManager._focusBeforePanelShow = null;
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
const CitationDataManager = {
	items: [],
	itemAddedCache: new Set(),

	getCitationItems() {
		return this.items.map(item => item.citationItem);
	},

	getItem({ dialogReferenceID }) {
		return this.items.find(item => item.dialogReferenceID === dialogReferenceID);
	},

	getItems({ zoteroItemID }) {
		return this.items.filter(item => item.zoteroItem.id === zoteroItemID);
	},

	getItemIndex({ dialogReferenceID }) {
		return this.items.findIndex(item => item.dialogReferenceID === dialogReferenceID);
	},

	updateItemAddedCache() {
		this.itemAddedCache = new Set();
		for (let { zoteroItem } of this.items) {
			if (!zoteroItem.id) continue;
			this.itemAddedCache.add(zoteroItem.id);
		}
	},
	
	// Include specified items into the citation
	async addItems({ citationItems = [], index = null }) {
		for (let item of citationItems) {
			let zoteroItem = this._citationItemToZoteroItem(item);
			// Add a new ID to our citation item and set the same ID on the bubble
			// so we have a reliable way to identify which bubble refers to which citationItem.
			let dialogReferenceID = Zotero.Utilities.randomString(5);
			let toInsert = { citationItem: item, zoteroItem: zoteroItem, dialogReferenceID };
			if (index !== null) {
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

	deleteItem({ dialogReferenceID }) {
		let index = this.getItemIndex({ dialogReferenceID });
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
				result.push(ioResult);
			}
			else {
				result.push(item);
			}
			if (!final) {
				result[result.length - 1].dialogReferenceID = dialogReferenceID;
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
		let sortedIOItems = io.citation.sortedItems.map(entry => entry[1]);
		let sortedItems = sortedIOItems.map((sortedItem) => {
			return this.items.find(item => item.dialogReferenceID === sortedItem.dialogReferenceID);
		});
		this.items = sortedItems;
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
	potentialDuplicateExists(targetZoteroItem) {
		if (!(targetZoteroItem instanceof Zotero.Item)) {
			targetZoteroItem = this._citationItemToZoteroItem(targetZoteroItem);
		}
		for (let item of this.items) {
			let sameCreator = item.zoteroItem.getField("firstCreator") === targetZoteroItem.getField("firstCreator");
			let sameTitle = item.zoteroItem.getDisplayTitle() === targetZoteroItem.getDisplayTitle();
			if (sameCreator && sameTitle) return true;
		}
		return false;
	},

	// check if items have the same id, comparing .cslItemID for cited items or .id for
	// usual items
	_itemsHaveSameID(itemOne, itemTwo) {
		let itemOneID = itemOne.cslItemID || itemOne.id;
		let itemTwoID = itemTwo.cslItemID || itemTwo.id;
		if (!itemOneID || !itemTwoID) return false;
		return itemOneID == itemTwoID;
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
window.addEventListener("unload", onUnload);
// When the dialog is re-focused, run the search again in case selected or opened items changed
let windowLostFocusOn = 0;
window.addEventListener("blur", () => {
	windowLostFocusOn = (new Date()).getTime();
});
window.addEventListener("focus", async () => {
	let now = (new Date()).getTime();
	// On linux, resizing the dialog causes the window to loose and immediately regain focus.
	// Do not run the search if the window lost focus less than 100 ms ago.
	if (Zotero.isLinux && now - windowLostFocusOn < 100) {
		return;
	}
	// Wait a moment to allow accept button click event to fire.
	// Without this, clicking accept button when the dialog is not focused
	// would refocus the dialog, run the search below,
	// which replaces accept button with the spinner and interrupts the click event.
	await Zotero.Promise.delay(100);
	if (accepted) return;
	SearchHandler.clearNonLibraryItemsCache();
	currentLayout?.search(SearchHandler.searchValue);
});
