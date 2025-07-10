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


const React = require('react');
const ReactDOM = require('react-dom');
const VirtualizedTable = require('components/virtualized-table');
const ItemTree = require('zotero/itemTree');
const { getCSSIcon } = require('components/icons');
const { COLUMNS } = require('zotero/itemTreeColumns');

var doc, io, ioReadyPromise, isCitingItems, isCitingNotes, isAddingAnnotations, accepted;

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
	ioReadyPromise = io.allCitedDataLoadedPromise;
	// if io did not send the promise indiciating when io.sort() and io.getItems() will be ready to run,
	// use an immediately resolved promise
	if (!ioReadyPromise) {
		ioReadyPromise = Zotero.Promise.resolve();
	}
	isCitingNotes = !!io.isCitingNotes;
	isAddingAnnotations = !!io.isAddingAnnotations;
	isCitingItems = !isCitingNotes && !isAddingAnnotations;
	window.isPristine = true;

	Zotero.debug("Citation Dialog: initializing");
	let timer = new Zotero.Integration.Timer();
	timer.start();

	Helpers = new CitationDialogHelpers({ doc, io });
	SearchHandler = new CitationDialogSearchHandler({ doc, io });
	PopupsHandler = new CitationDialogPopupsHandler({ doc });
	KeyboardHandler = new CitationDialogKeyboardHandler({ doc });

	// Initial height for the dialog (search row with no bubbles)
	window.resizeTo(window.innerWidth, Helpers.getSearchRowHeight());

	_id("keepSorted").disabled = !io.sortable || isCitingNotes || isAddingAnnotations;
	_id("keepSorted").checked = !_id("keepSorted").disabled && !io.citation.properties.unsorted;
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
	await listLayout.init();
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
	// wait to call functions that rely on io.getItems() or io.sort() till all cited data is loaded
	ioReadyPromise.then(async () => {
		if (accepted) return;
		Zotero.debug("Citation Dialog: io loaded cited data");
		await SearchHandler.refreshCitedItems();
		currentLayout.refreshItemsList({ retainItemsState: true });
		if (_id("keepSorted").checked) {
			IOManager._resortItems();
		}
	});

	// Disabled all multiselect when citing notes
	if (isCitingNotes) {
		for (let multiselectable of [...doc.querySelectorAll("[data-multiselectable]")]) {
			delete multiselectable.dataset.multiselectable;
		}
	}
	loaded = true;
	let initTime = timer.stop();
	Zotero.debug(`Citation Dialog: initialized in ${initTime} s`);
}


async function accept() {
	if (accepted || SearchHandler.searching || !CitationDataManager.items.length) return;
	accepted = true;
	Zotero.debug("Citation Dialog: accepted");
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
	// If items were added before sorting was ready, we must wait to sort them here.
	// Otherwise, if the dialog is opened again, bubbles will not be in the correct
	// order, even though the citation itself will look right.
	if (_id("keepSorted").checked) {
		await ioReadyPromise;
		await CitationDataManager.sort();
	}
	CitationDataManager.updateCitationObject(true);
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
	async refreshItemsList() {}

	// Run search and refresh items list
	async search(value, { skipDebounce = false } = {}) {
		if (accepted) return;
		let timer = new Zotero.Integration.Timer();
		timer.start();
		Zotero.debug("Citation Dialog: searching");
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
			await this.itemsView.setFilter('citation-search', SearchHandler.searchValue);
		}

		SearchHandler.searching = false;
		_id("loading-spinner").removeAttribute("status");
		_id("accept-button").hidden = false;
		let searchTime = timer.stop();
		Zotero.debug(`Citation Dialog: searching done in ${searchTime}`);
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
		if (isAddingAnnotations) {
			// No suggested items in annotations mode
			_id("library-other-items").hidden = true;
			// But the sidebar apepars
			_id("annotations-sidebar").hidden = false;
		}
	}

	// Re-render the items based on search results
	// @param {Boolean} options.retainItemsState: try to restore focused and selected status of item nodes.
	async refreshItemsList({ retainItemsState } = {}) {
		Zotero.debug("Citation Dialog: refreshing items list");
		let sections = [];

		// Tell SearchHandler which currently cited items are so they are not included in results
		let citedIDs = CitationDataManager.getCitedLibraryItemIDs();
		let searchResultGroups = await SearchHandler.getOrderedSearchResultGroups(citedIDs);
		for (let { ref, group } of searchResultGroups) {
			if (isAddingAnnotations) {
				// For now, only keep actual annotation items
				if (["open", "cited"].includes(ref.id)) continue;
				group = group.filter(item => item.isAnnotation());
				if (!group.length) continue;
				// Since some selected items are excluded, re-fetch the title
				let total = SearchHandler.selectedItems.filter(item => item.isAnnotation()).length;
				let count = group.length;
				ref.name = await doc.l10n.formatValue(`integration-citationDialog-section-${ref.id}`, { count, total });
			}
			// selected items become a collapsible deck/list if there are multiple items
			let isGroupCollapsible = ref.id == "selected" && group.length > 1;
			
			let section = Helpers.buildLibraryItemsSection(`${this.type}-${ref.id}-items`, ref.name, isGroupCollapsible, group.length, !isCitingNotes);
			let itemContainer = section.querySelector(".itemsContainer");
	
			let items = [];
			let index = 0;
			for (let item of group) {
				// do not add an unreasonable number of nodes into the DOM
				if (index >= ITEM_LIST_MAX_ITEMS) break;
				let itemNode = await Helpers.buildLibraryItemNode(item, isAddingAnnotations, index);
				itemNode.addEventListener("click", event => this._handleItemClick(event));
				// items can be dragged into bubble-input to add them into the citation
				itemNode.addEventListener("dragstart", IOManager._handleItemDragStart);
				items.push(itemNode);
				index++;
			}
			// if cited group is present but has no items, cited items must be
			// still loading, so show a placeholder item card
			if (group.length === 0 && ref.id == "cited") {
				let placeholder = Helpers.createCitedItemPlaceholder();
				items = [placeholder];
			}
			itemContainer.replaceChildren(...items);
			sections.push(section);
			if (isGroupCollapsible) {
				// handle click on "Add all", if it exists
				section.querySelector(".add-all")?.addEventListener("click", () => IOManager.addItemsToCitation(group));
				// if the user explicitly expanded or collapsed the section, keep it as such
				if (IOManager.sectionExpandedStatus[section.id]) {
					this._toggleSectionCollapse(section, IOManager.sectionExpandedStatus[section.id]);
				}
				// otherwise, expand the section if something is typed or whenever the list layout is opened
				else {
					let activeSearch = SearchHandler.searchValue.length > 0;
					this._toggleSectionCollapse(section, (activeSearch || this.type == "list") ? "expanded" : "collapsed");
				}
			}
		}
		let previouslyFocused = doc.activeElement;
		let previouslySelected = doc.querySelectorAll(".item.selected");
		_id(`${this.type}-layout`).querySelector(".search-items").replaceChildren(...sections);
		// Update which bubbles need to be highlighted
		this.updateSelectedItems();

		// Keep focus and selection on the same item nodes if specified.
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
			this._markPreSelected();
		}
		// Ensure focus is never lost
		if (doc.activeElement.tagName == "body") {
			IOManager._restorePreClickFocus();
		}

		_id("library-other-items").querySelector(".search-items").hidden = !_id("library-layout").querySelector(".section:not([hidden])");
		_id("library-no-suggested-items-message").hidden = !_id("library-other-items").querySelector(".search-items").hidden;
		// When there are no matches, show a message
		if (!_id("library-no-suggested-items-message").hidden) {
			doc.l10n.setAttributes(_id("library-no-suggested-items-message"), "integration-citationDialog-lib-no-items", { search: SearchHandler.searchValue.length > 0 });
		}
		this.resizeWindow();
		let collapsibleDecks = [..._id("library-other-items").querySelectorAll(".section.expandable")];
		for (let collapsibleDeck of collapsibleDecks) {
			collapsibleDeck.querySelector(".itemsContainer").addEventListener("click", event => this._captureItemsContainerClick(event), true);
			collapsibleDeck.querySelector(".itemsContainer").classList.add("keyboard-clickable");
			collapsibleDeck.querySelector(".collapse-section-btn").addEventListener("click", (event) => {
				this._toggleSectionCollapse(collapsibleDeck, "collapsed", true);
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
		for (let bubbleItem of CitationDataManager.items) {
			bubbleItem.selected = selectedItemIDs.has(bubbleItem.id);
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

	// Mark initially selected item that can be selected on Enter in an input
	// Item is pre-selected when there is an active search OR when there are no
	// items in the citation yet
	_markPreSelected() {
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
			this._selectItemNodesRange(firstItemNode);
		}
	}

	// select all items between startNode and endNode
	_selectItemNodesRange(startNode, endNode = null) {
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
			this._toggleItemNodeSelect(itemNodes[i], true);
		}
		currentLayout.updateSelectedItems();
	}

	_toggleItemNodeSelect(itemNode, isSelected = null) {
		if (isSelected === true) {
			itemNode.classList.add("selected");
		}
		else if (isSelected === false) {
			itemNode.classList.remove("selected");
		}
		else {
			itemNode.classList.toggle("selected");
		}
		this.updateSelectedItems();
	}

	_handleItemClick(event) {
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
			this._toggleItemNodeSelect(targetItem);
			return;
		}
		// Shift + click selects a range
		if (multiselectable && event.shiftKey) {
			let itemNodes = [..._id(`${currentLayout.type}-layout`).querySelectorAll(".item")];
			let firstNode = _id(`${currentLayout.type}-layout`).querySelector(".item.selected") || itemNodes[0];
			this._selectItemNodesRange(firstNode, targetItem);
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
	}

	// Expand/collapse an expandable section.
	// state - "expanded", "collapsed", or null to toggle
	// userInitiated - Boolean, true if called by a user action
	_toggleSectionCollapse(section, status, userInitiated) {
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
		// Record if the user explicitly expanded or collapsed the container to not undo it during next refresh
		if (userInitiated) {
			IOManager.sectionExpandedStatus[section.id] = section.classList.contains("expanded") ? "expanded" : "collapsed";
		}
		let isCollapsed = !section.classList.contains("expanded");
		let itemsContainer = section.querySelector(".itemsContainer");
		// mark collapsed items as unfocusable
		if (isCollapsed) {
			for (let item of [...section.querySelectorAll(".item")]) {
				item.removeAttribute("tabindex");
				item.setAttribute("draggable", false);
				item.classList.remove("current");
				item.classList.remove("selected");
			}
			// when the deck is collapsed, the itemsContainer itself becomes focusable
			itemsContainer.setAttribute("tabindex", -1);
			itemsContainer.dataset.arrowNavEnabled = true;
			// if an item if focused, focus the collapsed container for smoother transition
			if (doc.activeElement.classList.contains("item")) {
				itemsContainer.focus();
			}
		}
		// when expanded, make items focusable again
		else {
			for (let item of [...section.querySelectorAll(".item")]) {
				item.setAttribute("tabindex", -1);
				item.setAttribute("draggable", true);
			}
			// collapsed deck is no longer focusable
			itemsContainer.removeAttribute("tabindex");
			itemsContainer.dataset.arrowNavEnabled = false;
			itemsContainer.classList.remove("selected", "current");
		}
		section.querySelector("[aria-expanded]").setAttribute("aria-expanded", !isCollapsed);
	}

	// handle click on the items container
	_captureItemsContainerClick(event) {
		let section = event.target.closest(".section");
		// expand the deck of items if it is collapsed
		if (section.classList.contains("expanded")) return;
		event.stopPropagation();
		this._toggleSectionCollapse(section, "expanded", true);
		// if the click is keyboard-initiated, focus the first item
		if (event.layerX == 0 && event.layerY == 0) {
			let firstItem = section.querySelector(".item");
			this._selectItemNodesRange(firstItem);
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
				// no icon should be shown when an item cannot be added
				// (e.g. when citing notes, parent items are displayed but not included)
				if (inCitation === null) return cell;
				let iconWrapper = Helpers.createNode("span", {}, `icon-action`);
				cell.append(iconWrapper);
				let icon = getCSSIcon('plus-circle');
				// add aria-label for screen readers to announce if this item is added
				if (inCitation) {
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
			dragAndDrop: isCitingItems,
			persistColumns: true,
			columnPicker: true,
			onSelectionChange: () => {
				libraryLayout.updateSelectedItems();
				if (isAddingAnnotations) {
					let selectedItems = this.itemsView.getSelectedItems().filter(item => item.isAnnotation());
					_id("annotations-list").items = selectedItems;
					_id("annotations-list").render();
				}
			},
			regularOnly: isCitingItems,
			multiSelect: !isCitingNotes,
			onActivate: (event, items) => {
				// Prevent Enter event from reaching KeyboardHandler which would accept the dialog
				event.preventDefault();
				event.stopPropagation();
				let row = event.target;
				let isClick = event.type == "dblclick";
				if (isAddingAnnotations && items.some(item => !item.isAnnotation())) {
					return;
				}
				if (isCitingNotes && items.some(item => !item.isNote())) {
					return;
				}
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
					if (isCitingItems && !item.isRegularItem()) return null;
					if (isAddingAnnotations && !item.isAnnotation()) return null;
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
			filterLibraryIDs: io.filterLibraryIDs,
			extraPseudoCollections: [{ index: 0, collection: {
				id: "selected-open-cited",
				name: "Selected/Open/Cited",
				getItems: async () => {
					let { selected, open, cited } = SearchHandler.results;
					return [...selected, ...open, ...cited];
				}
			} }]
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
		if (library && !library.getDataLoaded('item')) {
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
				// when adding annotations, only keep annotations, their attachments, and their top-level items
				if (isAddingAnnotations) {
					return SearchHandler.keepItemsWithAnnotations(items);
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
				let items = CitationDataManager.getItems({ itemID: item.id });
				for (let item of items) {
					IOManager._deleteItem(item.dialogReferenceID);
				}
			}
		}
	}

	// Highlight/de-highlight selected rows
	async _refreshItemsViewHighlightedRows() {
		let selectedIDs = CitationDataManager.getCitedLibraryItemIDs();
		// Wait for the tree to fully load to avoid a logged error that the tree is undefined
		while (!this.itemsView.tree) {
			await Zotero.Promise.delay(10);
		}
		this.itemsView.setHighlightedRows([...selectedIDs]);
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

// Data representation of a row to be rendered in the list layout virtualized table
class ListRow {
	constructor({ ref, level, children, isOpen, isHidden }) {
		this.ref = ref;
		this.children = children || [];
		this.isOpen = isOpen || false;
		this.isHidden = isHidden || false;
		this.level = level || 0;
	}

	static createHeaderRow({ ref, children = [], isOpen = false }) {
		return new ListRow({ ref, children, level: 0, isOpen });
	}

	static createItemRow({ item, level = 1, children, isOpen = null, isHidden = false }) {
		return new ListRow({ ref: item, children, level, isOpen, isHidden });
	}

	static createMoreChildrenRow({ itemID, level = 2, children }) {
		let id = "more-children-" + itemID;
		let name = Zotero.getString('general.numMore', children.length);
		return new ListRow({ ref: { id, name, itemID }, children, level });
	}

	get isHeader() {
		return this.level === 0;
	}

	get isMoreChildrenRow() {
		return `${this.ref.id}`.startsWith("more-children-");
	}

	get height() {
		if (this.isHeader) return 26;
		if (this.isMoreChildrenRow) return 26;
		return 42;
	}

	get isCollapsible() {
		if (this.isHeader) return this.ref.id == "selected" && this.children.length > 1;
		if (this.isMoreChildrenRow) return false;
		return this.children.length > 0;
	}
}

class ListLayout extends Layout {
	constructor() {
		super("list");
		this._itemsListRef = null;
		this._listRows = [];
		this._shouldExpandAllChildren = new Set();
		this._collasedItems = new Set();
	}

	async init() {
		await new Promise((resolve) => {
			ReactDOM.createRoot(doc.querySelector('#list-layout-wrapper')).render(
				<VirtualizedTable
					getRowCount={() => this.getVisibleRows().length}
					id="items-list"
					ref={(ref) => {
						this._itemsListRef = ref;
						resolve();
					}}
					renderItem={this.renderItem.bind(this)}
					isContainer={this.isContainer.bind(this)}
					isContainerEmpty={this.isContainerEmpty.bind(this)}
					isContainerOpen={this.isContainerOpen.bind(this)}
					isSelectable={this.isSelectable.bind(this)}
					multiSelect={!isCitingNotes}
					onActivate={this.handleActivate.bind(this)}
					toggleOpenState={this.toggleOpenState.bind(this)}
					onSelectionChange={this.updateSelectedItems.bind(this)}
				/>
			);
		});
		// Override some default keydown handling of virtualied-table
		doc.querySelector('#list-layout-wrapper').addEventListener("keydown", e => this._handleRowKeyDown(e), true);
		// Handle arrow keypress events from bubble-input - passed from KeyboardHandler
		doc.addEventListener("list-arrow-keypress", event => this._handleBubbleInputArrow(event));
	}

	// get rows that are currently visible, since _listRows has both visible items
	// and their hidden children (if the parent is collapsed)
	getVisibleRows() {
		return this._listRows.filter(row => !row.isHidden);
	};

	renderItem(index, selection, oldDiv = null, columns) {
		let row = this.getVisibleRows()[index];
		let div;
		if (oldDiv) {
			div = oldDiv;
			div.innerHTML = "";
			if (!row) return div;
		}
		else {
			div = document.createElement('div');
			div.className = "row";
			// Handle clicks on rows, overriding default click handling of virtualized-table
			div.addEventListener("mouseup", event => this._handleRowMouseUp(event, index), true);
			if (!isAddingAnnotations && !isCitingNotes) {
				div.addEventListener("dragstart", event => this._handleDragStart(event, index));
			}
			// Intercept mousedown event to prevent having the row selected on mousedown.
			// All our event handling occurs on mouseup, and having no mousedown event
			// means the row does not re-render when drag starts, which means there is no
			// need for pointer-events: none workaround as in virtualized-table.css
			div.addEventListener("mousedown", e => e.stopPropagation(), true);
		}
		div.removeAttribute("draggable");
		let node = null;
		let { ref, isCollapsible, level } = row;
		if (row.isHeader) {
			node = Helpers.buildListSectionHeader({ ref, isCollapsible, createAddAllBtn: !isCitingNotes });
			node.classList.toggle("has-top-divider", index !== 0);
		}
		else if (row.isMoreChildrenRow) {
			node = Helpers.buildListMoreChildrenRow(row.ref.itemID, row.ref.name);
		}
		else {
			let section = this.getRowParent(index, 0);
			let annotationsCount = null;
			// Add annotations icon button to item nodes in selected and open sections
			if (isAddingAnnotations && ["selected", "open"].includes(section.ref.id)) {
				annotationsCount = SearchHandler.getAllAnnotations(row.ref).length;
			}
			node = Helpers.buildListItemNode(ref, isCollapsible, level, annotationsCount);
			div.setAttribute("draggable", !isAddingAnnotations && !isCitingNotes);
		}
		node.classList.toggle("expanded", row.isOpen);
		node.classList.toggle('selected', selection.isSelected(index));
		node.classList.toggle('selected-first', selection.isFirstRowOfSelectionBlock(index));
		node.classList.toggle('selected-last', selection.isLastRowOfSelectionBlock(index));
		div.appendChild(node);
		return div;
	};

	toggleOpenState = (index, skipRender) => {
		let row = this.getVisibleRows()[index];
		if (!row || !row.isCollapsible) return;
		let rowIndexInAllRows = this._listRows.findIndex(r => r.ref.id == row.ref.id);
		let allRows = this._listRows;
		let nextIndex = rowIndexInAllRows + 1;
		row.isOpen = !row.isOpen;
		// Record the item was collapsed to keep it collapsed on next refresh
		if (row.isOpen) {
			this._collasedItems.delete(row.ref.id);
		}
		else {
			this._collasedItems.add(row.ref.id);
		}
		while (nextIndex < allRows.length) {
			let nextRow = allRows[nextIndex];
			// Stop when we reach another header (same level) or a row with lower level
			if (nextRow.level <= row.level) {
				break;
			}
			nextRow.isOpen = row.isOpen;
			nextRow.isHidden = !row.isOpen;
			// un-select selected children of a collapsed item
			if (nextRow.isHidden && this._itemsListRef.selection.isSelected(nextIndex)) {
				this._itemsListRef.selection.selected.delete(nextIndex);
			}
			// if a child row is focused when parent is collapsed, move focus to the parent
			if (nextRow.isHidden && this._itemsListRef.selection.focused == nextIndex) {
				this._itemsListRef.selection.focused = index;
			}
			nextIndex++;
		}
		if (skipRender) return;
		this.updateRowHeights();
		this._itemsListRef.invalidate();
		setTimeout(() => {
			this.resizeWindow();
		});
	};

	isContainer(index) {
		return this.getVisibleRows()[index].isCollapsible;
	}

	isContainerEmpty(index) {
		return this.getVisibleRows()[index].children.length === 0;
	}

	isContainerOpen(index) {
		return this.getVisibleRows()[index].isOpen;
	}

	isSelectable(index) {
		let row = this.getVisibleRows()[index];
		if (!row) return false;
		if (row.isHeader) return row.isCollapsible;
		if (row.isMoreChildrenRow) return true;
		return true;
	}

	getRowParent(rowIndex, parentLevel) {
		let rows = this.getVisibleRows();
		let row = rows[rowIndex];
		if (parentLevel === undefined) {
			parentLevel = row.level - 1;
		}
		while (row && row.level > parentLevel) {
			rowIndex--;
			row = rows[rowIndex];
		}
		return row;
	}

	getSelectedItems(asIDs) {
		let selectedIndexes = [...this._itemsListRef.selection.selected];
		let rows = this.getVisibleRows();
		let selectedItems = [];
		for (let index of selectedIndexes) {
			if (index < 0 || index >= rows.length) continue;
			let item = rows[index].ref;
			if (!(item instanceof Zotero.Item)) continue;
			selectedItems.push(item);
		}
		if (asIDs) return selectedItems.map(item => item.id);
		return selectedItems;
	}

	// Rows have varying heights, so we need to tell virtualized-table
	// about the custom heights of each row.
	updateRowHeights() {
		let customRowHeights = [];
		for (let [index, row] of this.getVisibleRows().entries()) {
			customRowHeights.push([index, row.height]);
		}
		this._itemsListRef.updateCustomRowHeights(customRowHeights);
	}

	// Refresh the _listRows to reflect the state of search results and
	// trigger a re-render of the virtualized table.
	async refreshItemsList(options = {}) {
		let rows = [];
		let citedIDs = CitationDataManager.getCitedLibraryItemIDs();
		let searchResultGroups = await SearchHandler.getOrderedSearchResultGroups(citedIDs);
		for (let { ref, group } of searchResultGroups) {
			let headerRow = ListRow.createHeaderRow({ ref, children: group, isOpen: true });
			rows.push(headerRow);
			let items = group;
			if (isAddingAnnotations || isCitingNotes) {
				// all child items have to be groupped by their top-level item
				items = Helpers.groupByTopLevelItems(items);
			}
			else {
				// if not citing notes or adding annotations, items are already top-level
				items = items.map(item => ({ item, children: [] }));
			}

			for (let { item, children } of items) {
				let topLevelItemRow = ListRow.createItemRow({ item, children, isOpen: true });
				rows.push(topLevelItemRow);
				// while adding annotations, if one annotation is selected, its siblings are
				// initially hidden behind "X More..." row. _shouldExpandAllChildren records if we
				// should show all children, even if they were not selected initially.
				if (this._shouldExpandAllChildren.has(item.id)) {
					children = SearchHandler.getAllAnnotations(item);
					topLevelItemRow.children = children;
				}
				for (let child of children) {
					let childRowData = ListRow.createItemRow({ item: child, level: 2, isOpen: true });
					rows.push(childRowData);
				}
				// Special handling for "Selected" and "Opened" section when adding annotations
				if (isAddingAnnotations && ["selected", "open"].includes(ref.id)) {
					let allAnnotations = SearchHandler.getAllAnnotations(item);
					// If some annotations are selected and some are not, hide not-selected annotations
					// behind the "X More..." row. Clicking on it will show all annotations.
					if (children.length && allAnnotations.length > children.length) {
						let remainingAnnotations = allAnnotations.filter(annotation => !children.some(child => child.id == annotation.id));
						rows.push(ListRow.createMoreChildrenRow({ itemID: item.id, children: remainingAnnotations }));
					}
					// If a top-level item is selected and none of its children are, add all child
					// rows but collapse the item.
					else if (!children.length) {
						topLevelItemRow.isOpen = false;
						topLevelItemRow.children = allAnnotations;
						for (let annotation of allAnnotations) {
							rows.push(ListRow.createItemRow({ item: annotation, level: 2, isOpen: false, isHidden: true }));
						}
					}
				}
			}
		}
		this._listRows = rows;
		// Keep rows that were collapsed before refreshed still collapsed
		for (let [index, row] of rows.entries()) {
			if (this._collasedItems.has(row.ref.id) && row.isOpen) {
				this.toggleOpenState(index, true);
			}
		}
		this.updateRowHeights();
		this._itemsListRef.invalidate();
		// Hide padding of list layout if there is not a single item to show
		let isEmpty = !_id("list-layout").querySelector(".item");
		_id("list-layout").classList.toggle("empty", isEmpty);

		// Select the first item row when no other items are added, unless specified otherwise.
		// If there is no row to select, just set the first row as focused.
		if (!options.retainItemsState) {
			let firstRow = this.getVisibleRows().findIndex(row => !row.isHidden && !row.isHeader && !row.isCollapsible);
			if (!isEmpty && !CitationDataManager.items.length && firstRow >= 0) {
				this._itemsListRef.selection.select(firstRow);
				this._itemsListRef.selection.focused = firstRow;
				setTimeout(() => {
					_id("list-layout").querySelector(".virtualized-table-body").scrollTop = 0;
				});
			}
			else {
				this._itemsListRef.selection.clearSelection();
				this._itemsListRef.selection.focused = 0;
			}
		}

		if (!options.skipWindowResize) {
			this.resizeWindow();
		}
		// Ensure focus is never lost
		if (doc.activeElement.tagName == "body") {
			IOManager._restorePreClickFocus();
		}
	}

	// Highlight bubbles of selected items
	updateSelectedItems() {
		let selectedItemIDs = this.getSelectedItems(true);
		for (let bubbleItem of CitationDataManager.items) {
			bubbleItem.selected = selectedItemIDs.includes(bubbleItem.id);
		}
		IOManager.updateBubbleInput();
	}

	handleActivate() {
		let itemIDs = new Set();
		let rows = this.getVisibleRows();
		let selectedIndexes = [...this._itemsListRef.selection.selected];
		// Handle activation of "Selected Items" section via space/enter on it
		if (selectedIndexes.length == 1 && rows[selectedIndexes[0]].ref.id == "selected") {
			let selectedRow = rows[selectedIndexes[0]];
			IOManager.addItemsToCitation(selectedRow.children);
			return;
		}
		// Handle Enter on "X More..." row (for children of a top-level item)
		if (selectedIndexes.length == 1 && rows[selectedIndexes[0]].isMoreChildrenRow) {
			this._showAllChildrenOfItem(rows[selectedIndexes[0]].ref.itemID);
			return;
		}
		for (let index of selectedIndexes) {
			itemIDs.add(rows[index].ref.id);
		}
		let itemsToAdd = Array.from(itemIDs).map(itemID => SearchHandler.getItem(itemID));
		IOManager.addItemsToCitation(itemsToAdd);
	}

	_handleRowMouseUp(event, index) {
		if (event.ctrlKey || event.metaKey || event.shiftKey) {
			// allow multiselection to be handled by virtualized-table
			// but return focus to where it was before the click
			setTimeout(IOManager._restorePreClickFocus, 10);
			return;
		}
		let rows = this.getVisibleRows();
		let clickedRow = rows[index];
		// handle clicks on header rows to expand/collapse the section
		// or add all items when "Add all" button is clicked
		if (clickedRow.isHeader) {
			if (clickedRow.isCollapsible && event.target.classList.contains("header-label")) {
				this.toggleOpenState(index);
			}
			else if (event.target.classList.contains("add-all")) {
				IOManager.addItemsToCitation(clickedRow.children);
			}
			setTimeout(IOManager._restorePreClickFocus, 10);
			event.stopPropagation();
			return;
		}
		// handle click on the annotations icon to select all annotations
		if (event.target.closest(".annotations-icon-button")) {
			this._showAllChildrenOfItem(clickedRow.ref.itemID, true);
		}
		// handle collapse/expand of container items that cannot be selected
		else if (clickedRow.isCollapsible) {
			this.toggleOpenState(index);
		}
		// handle clicks on "X more" row to show all remaining annotations of an item
		else if (clickedRow.isMoreChildrenRow && event.target.closest(".more-chidlren-row")) {
			this._showAllChildrenOfItem(clickedRow.ref.itemID);
		}
		// handle click on regular item rows
		else {
			// if click item is not selected, set selection to just that item
			if (!this._itemsListRef.selection.isSelected(index)) {
				this._itemsListRef.selection.select(index);
			}
			// add items that are currently selected
			this.handleActivate();
		}
		// do not let event to propagate because virtualized-table will focus itself
		// if focus does leave (e.g. due to mousedown event), try to restore it after a small delay
		setTimeout(IOManager._restorePreClickFocus, 10);
		event.stopPropagation();
	}

	_handleDragStart(event, index) {
		let rows = this.getVisibleRows();
		let itemIDs = [rows[index].ref.id];
		if (this._itemsListRef.selection.isSelected(index)) {
			itemIDs = [...this._itemsListRef.selection.selected].map(i => rows[i].ref.id);
		}
		IOManager._handleItemDragStart(event, itemIDs);
	}

	resizeWindow() {
		let bubbleInputHeight = Helpers.getSearchRowHeight();

		// height of all sections
		let sectionsHeight = _id("list-layout").querySelector(".windowed-list").getBoundingClientRect().height;
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

	_handleRowKeyDown(event) {
		// arrow right/left on collapsible rows will expand/collapse them but never
		// move selection to the parent row (as in virtualized-table)
		if ([Zotero.arrowPreviousKey, Zotero.arrowNextKey].includes(event.key)) {
			let targetRow = this.getVisibleRows()[this._itemsListRef.selection.focused];
			if (targetRow.isCollapsible) {
				let isNextKey = event.key == Zotero.arrowNextKey;
				if ((!isNextKey && targetRow.isOpen) || (isNextKey && !targetRow.isOpen)) {
					this.toggleOpenState(this._itemsListRef.selection.focused);
				}
			}
			event.stopPropagation();
			event.preventDefault();
		}
		// allow up from the top-most selectable row will focus bubble-input
		else if (event.key == "ArrowUp") {
			let nextSelectable = this._itemsListRef.selection.focused - 1;
			while (nextSelectable >= 0 && !this.isSelectable(nextSelectable)) {
				nextSelectable--;
			}
			if (!this.isSelectable(nextSelectable)) {
				this._itemsListRef.selection.focused = 0;
				this._itemsListRef.selection.clearSelection();
				_id("bubble-input").focus();
			}
		}
		// Enter/space on a row is equivalent to clicking on it
		else if (["Enter", " "].includes(event.key)) {
			this.handleActivate();
			event.stopPropagation();
			event.preventDefault();
		}
	}

	// Handle arrow keypress events from bubble-input
	_handleBubbleInputArrow(event) {
		// Arrow up from the very top will clear the selection
		if (event.detail.key == "ArrowUp" && this._itemsListRef.selection.focused <= 1) {
			this._itemsListRef.selection.focused = 0;
			this._itemsListRef.selection.clearSelection();
			return;
		}
		// forward arrowUp/arrowDown keypress to the virtualized-table for it to handle navigation
		var arrowKeyPress = new KeyboardEvent('keydown', {
			key: event.detail.key,
			bubbles: true
		});
		_id("list-layout").querySelector(".virtualized-table-body").dispatchEvent(arrowKeyPress);
	}

	async _showAllChildrenOfItem(itemID, selectChildren = false) {
		this._shouldExpandAllChildren.add(itemID);
		this._collasedItems.delete(itemID);
		let rowIndex = this.getVisibleRows().findIndex(row => row.ref.id == itemID);
		await this.refreshItemsList({ retainItemsState: true });
		if (selectChildren) {
			let row = this.getVisibleRows()[rowIndex];
			this._itemsListRef.selection.rangedSelect(rowIndex + 1, rowIndex + 1 + row.children.length, true);
		}
		else {
			this._itemsListRef.selection.select(rowIndex);
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
		doc.addEventListener("select-items", ({ detail: { startNode, endNode } }) => libraryLayout._selectItemNodesRange(startNode, endNode));
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
		// Do nothing if switching to a mode that is already active
		let currentMode = _id("mode-button").getAttribute("mode");
		if (currentMode == newMode) return;
		
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
			item.updateBubbleString();
		}
		_id("bubble-input").refresh(CitationDataManager.items.map((item) => {
			return {
				dialogReferenceID: item.dialogReferenceID,
				bubbleString: item.bubbleString,
				selected: item.selected,
			};
		}));
		_id("accept-button").disabled = !CitationDataManager.items.length;
	},

	async addItemsToCitation(items, { noInputRefocus, index } = { index: null }) {
		Zotero.debug(`Citation Dialog: adding ${items.length} items to the citation`);
		if (accepted || SearchHandler.searching) return;
		if (!Array.isArray(items)) {
			items = [items];
		}
		// When adding annotations, only annotation items are allowed
		if (isAddingAnnotations) {
			items = items.filter(item => item.isAnnotation());
		}
		// if selecting a note, add it and immediately accept the dialog
		if (isCitingNotes) {
			if (!items[0].isNote()) return;
			CitationDataManager.items = [];
			let bubbleItem = BubbleItem.fromItem(items[0]);
			await CitationDataManager.addItems({ bubbleItems: [bubbleItem] });
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
			items = items.filter(item => !(item.id && CitationDataManager.getItems({ itemID: item.id }).length));
		}

		// If the last input has a locator, add it into the item
		let input = _id("bubble-input").getCurrentInput();
		let inputValue = SearchHandler.cleanSearchQuery(input?.value || "");
		let locator = isCitingItems ? Helpers.extractLocator(inputValue) : null;
		// Add the item at a position based on current input if it is not explicitly specified
		if (index === null && input) {
			index = _id("bubble-input").getFutureBubbleIndex();
		}
		// If there was an input used to run the search, clear it
		if (input) {
			input.remove();
		}

		// Add entries into the citation with the current locator if specified
		let bubbleItems = items.map(item => BubbleItem.fromItem(item));
		if (locator) {
			for (let bubbleItem of bubbleItems) {
				bubbleItem.locator = locator.locator;
				bubbleItem.label = locator.label;
			}
		}
		await CitationDataManager.addItems({ bubbleItems, index });
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

	// when focus leaves the input or suggested items area in library mode, un-select all items
	// so they do not apear highlighted, since Enter would not add them anymore
	// it does not apply to list mode
	resetSelectedAfterFocus(event) {
		if (currentLayout.type == "list") return;
		let focused = event.target;
		let itemsShouldRemainSelected = focused.classList.contains("input") || _id("library-other-items").contains(focused);
		if (itemsShouldRemainSelected) {
			if (!doc.querySelector(".item.selected")) {
				libraryLayout._markPreSelected();
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
		// For now, only library mode for annotations
		if (isAddingAnnotations) {
			this.toggleDialogMode("library");
			_id("mode-button").hidden = true;
			return;
		}
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
	_handleItemDragStart(event, itemIDs) {
		let itemNode = event.target;
		if (!itemNode.classList.contains("item")) {
			itemNode = itemNode.querySelector(".item");
		}
		let selectedItems = itemNode.classList.contains("selected") ? [...doc.querySelectorAll(".item.selected")] : [itemNode];
		let wrapper = Helpers.createNode("div", {}, "drag-image-wrapper");
		wrapper.append(...selectedItems.map(node => node.cloneNode(true)));
		itemNode.parentNode.append(wrapper);
		let rect = itemNode.getBoundingClientRect();
		let offsetX = event.clientX - rect.left;
		let offsetY = event.clientY - rect.top;
		event.dataTransfer.setDragImage(wrapper, offsetX, offsetY);
		// Same format as with drag-drop of items in itemTree via Zotero.Utilities.Internal.onDragItems
		if (!itemIDs) {
			itemIDs = selectedItems.map(node => node.getAttribute("itemID"));
		}
		let draggedItemIDs = itemIDs.join(",");
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
		let locator = isCitingItems ? Helpers.extractLocator(input.value) : null;
		let bubble = input.previousElementSibling;
		let item = CitationDataManager.getItem({ dialogReferenceID: bubble?.getAttribute("dialogReferenceID") });
		if (item && locator && locator.onlyLocator && bubble) {
			item.locator = locator.locator;
			item.label = locator.label;
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
		if (!isCitingItems) return;
		let bubbleItem = CitationDataManager.getItem({ dialogReferenceID });
		PopupsHandler.openItemDetails(bubbleItem, Helpers.buildItemDescription(bubbleItem.item));
	},

	_handleInput({ query, eventType }) {
		query = SearchHandler.cleanSearchQuery(query);
		// If there is a locator typed, exclude it from the query
		let locator = Helpers.extractLocator(query);
		if (locator) {
			query = query.replace(locator.fullLocatorString, "");
		}
		// Do not rerun search if the search value is the same
		// (e.g. focus returns into the last input)
		if (query == SearchHandler.searchValue) {
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

// Representation of a single entry in the citation.
class BubbleItem {
	// Can be created from either Zotero.Item or citation item from io.citation.citationItems
	static fromItem(item) {
		let citationItem = {};
		return new BubbleItem({ item, citationItem });
	}

	static fromCitationItem(citationItem) {
		let item;
		if (io.customGetItem) {
			item = io.customGetItem(citationItem);
		}
		if (!item) {
			item = Zotero.Cite.getItem(citationItem.id);
		}
		return new BubbleItem({ item, citationItem });
	}

	constructor({ item, citationItem }) {
		if (!item || !citationItem) {
			throw new Error("Both Zotero.Item and citation item must be provided");
		}
		this.item = item;
		this.cslItemID = item.cslItemID;
		this.cslItemData = item.cslItemData;
		this.cslURIs = item.cslURIs;

		this.locator = citationItem.locator;
		this.label = citationItem.label;
		this.suffix = citationItem.suffix;
		this.prefix = citationItem.prefix;
		this.suppressAuthor = citationItem["suppress-author"];
		
		this.bubbleString = "";
		this.selected = false;
		// Add a new ID to our citation item and set the same ID on the bubble
		// so we have a reliable way to identify which bubble refers to which citationItem.
		this.dialogReferenceID = Zotero.Utilities.randomString(5);
		this.updateBubbleString();
	}

	get id() {
		return this.cslItemID || this.item.id;
	}

	updateBubbleString() {
		this.bubbleString = Helpers.buildBubbleString(this);
	}

	// Return an object with relevant fields that cipeproc can consume.
	// Can optionally include dialogReferenceID for sorting in CitationDataManager.sort()
	getCitationItem({ includeDialogReferenceID } = {}) {
		let citationItem = {
			id: this.id,
		};
		if (this.locator) {
			citationItem.locator = this.locator;
			citationItem.label = this.label;
		}
		if (this.suffix) {
			citationItem.suffix = this.suffix;
		}

		if (this.prefix) {
			citationItem.prefix = this.prefix;
		}
		if (this.suppressAuthor) {
			citationItem["suppress-author"] = this.suppressAuthor;
		}
		if (this.cslItemData) {
			citationItem.itemData = this.cslItemData;
		}
		if (this.cslURIs) {
			citationItem.uris = this.cslURIs;
		}
		if (includeDialogReferenceID) {
			citationItem.dialogReferenceID = this.dialogReferenceID;
		}
		return citationItem;
	}
}

//
// Singleton to store and handle items in this citation.
// CitationDataManager.items is an array of BubbleItem objects, which maps
// directly to the bubbles in the citation.
//
const CitationDataManager = {
	items: [],
	itemAddedCache: new Set(),

	getCitedLibraryItemIDs() {
		return new Set(this.items.map(item => item.item.id).filter(id => id));
	},

	getSelectedIDs() {
		return this.items.filter(item => item.selected).map(item => item.id);
	},

	getItem({ dialogReferenceID }) {
		return this.items.find(bubbleItem => bubbleItem.dialogReferenceID === dialogReferenceID);
	},

	getItems({ itemID }) {
		return this.items.filter(bubbleItem => bubbleItem.item.id === itemID);
	},

	getItemIndex({ dialogReferenceID }) {
		return this.items.findIndex(item => item.dialogReferenceID === dialogReferenceID);
	},

	updateItemAddedCache() {
		this.itemAddedCache = new Set();
		for (let bubbleItem of this.items) {
			if (!bubbleItem.item.id) continue;
			this.itemAddedCache.add(bubbleItem.item.id);
		}
	},
 	
	/**
	 * Include specified items into the citation.

	 */
	async addItems({ bubbleItems = [], index = null }) {
		for (let bubbleItem of bubbleItems) {
			if (index !== null) {
				this.items.splice(index, 0, bubbleItem);
				index += 1;
			}
			else {
				this.items.push(bubbleItem);
			}
		}
		// No sorting happens when citing notes, since the dialog is accepted right after
		if (isCitingNotes) return;
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
		io.citation.citationItems = this.items.map(item => item.getCitationItem({ includeDialogReferenceID: !final }));
		if (io.sortable) {
			io.citation.properties.unsorted = !_id("keepSorted").checked;
		}
	},

	// Resorts the items in the citation
	async sort() {
		if (!_id("keepSorted").checked) return;
		if (this.isAddingAnnotations) {
			// Sort annotations but only within the same attachment
			this.items.sort((a, b) => {
				if (a.item.parentItemID !== b.item.parentItemID) return 0;
				return (a.item.annotationSortIndex > b.item.annotationSortIndex) - (a.item.annotationSortIndex < b.item.annotationSortIndex);
			});
			return;
		}
		// It can take arbitrarily long time for documents with many cited items to load
		// all data necessary to run io.sort().
		// Do nothing if io.sort() is not yet ready to run.
		if (!ioReadyPromise.isResolved()) return;
		Zotero.debug("Citation Dialog: sorting items");
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
		let bubbleItems = io.citation.citationItems.map(item => BubbleItem.fromCitationItem(item));
		await this.addItems({ bubbleItems });
	},
};

// Explicitly expose singletons to global window for tests
window.CitationDataManager = CitationDataManager;
window.IOManager = IOManager;

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
	return;
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
