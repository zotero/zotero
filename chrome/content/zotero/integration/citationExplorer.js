/*
	***** BEGIN LICENSE BLOCK *****
	
    Copyright © 2023 Corporation for Digital Scholarship
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
const diff = require('diff');
const VirtualizedTable = require('components/virtualized-table');
const { getCSSIcon, CSSIcon } = require('components/icons');
const ItemTree = require('zotero/itemTree');
const { ItemTreeRowProvider } = ItemTree;
const { ItemTreeRow, ZoteroItemTreeRow } = require('zotero/itemTreeRow');
const { COLUMNS } = require('zotero/itemTreeColumns');
const { makeRowRenderer } = VirtualizedTable;

// ////////////////////////////////////////////////////////////////////////////
//
//  Citation Explorer Row Classes
//
// ////////////////////////////////////////////////////////////////////////////

const UNLINKED_ITEMS_ID = 'UNLINKED_ITEMS';

/**
 * Container row wrapping a Zotero.Library.
 */
class LibraryItemTreeRow extends ItemTreeRow {
	constructor(library, items, isOpen = true) {
		super(library, 0, isOpen); // library has treeViewID = "L<id>"
		this._items = items;
	}

	get type() {
		return 'library';
	}

	get sortChildren() {
		return true;
	}

	isContainer() {
		return true;
	}

	isContainerEmpty() {
		return this._items.length === 0;
	}

	getChildItems() {
		return this._items;
	}

	getField(field) {
		if (field === 'title') return this.ref.name;
		return '';
	}

	getDisplayTitle() {
		return this.ref.name;
	}

	getIcon() {
		let library = this.ref;
		let iconKey = 'library';
		if (library.libraryType === 'group') iconKey = 'library-group';
		else if (library.libraryType === 'publications') iconKey = 'publications';
		let icon = getCSSIcon(iconKey);
		icon.classList.add('icon-item-type');
		return icon;
	}

	renderRow(div, index, columns, rowData, renderCtx) {
		let titleColumn = columns.find(c => c.dataKey === 'title') || columns[0];
		let cell = renderCtx.renderCell(index, this.ref.name, titleColumn, true);
		div.appendChild(cell);
	}
}

/**
 * Pseudo-library container for unlinked CSL-only items.
 */
class UnlinkedItemsTreeRow extends LibraryItemTreeRow {
	constructor(items, isOpen = true) {
		super({ id: UNLINKED_ITEMS_ID, treeViewID: UNLINKED_ITEMS_ID }, items, isOpen);
	}

	get type() {
		return 'unlinked-items';
	}

	getDisplayTitle() {
		return Zotero.getString('integration.citationExplorer.unlinkedItems');
	}

	getField(field) {
		if (field === 'title') return this.getDisplayTitle();
		return '';
	}

	getIcon() {
		let icon = getCSSIcon('cross');
		icon.classList.add('icon-item-type');
		return icon;
	}
}

/**
 * Item row with citation-tracking metadata and "Uncited" badge.
 */
class CitationExplorerItemTreeRow extends ZoteroItemTreeRow {
	constructor(ref, level, isOpen, { citedIn = [], cslItemID = null } = {}) {
		let id = ref.treeViewID ?? cslItemID ?? 'csl-' + Zotero.Utilities.randomString(8);
		super(ref, level, isOpen, id);
		this.citedIn = citedIn;
		this.cslItemID = cslItemID;
	}

	get isLinked() {
		return !this.cslItemID;
	}

	isContainer() {
		return false;
	}

	isContainerEmpty() {
		return true;
	}

	renderPrimaryCell(index, data, column) {
		let cell = super.renderPrimaryCell(index, data, column);
		if (this.citedIn.length === 0) {
			let badge = document.createElement('span');
			badge.classList.add('badge', 'badge-uncited');
			badge.textContent = 'Uncited';
			let textSpan = cell.querySelector('.cell-text');
			if (textSpan) textSpan.after(badge);
			else cell.appendChild(badge);
		}
		return cell;
	}
}

// ////////////////////////////////////////////////////////////////////////////
//
//  Citation Explorer Row Provider
//
// ////////////////////////////////////////////////////////////////////////////

/**
 * Row provider that groups items by library with expandable containers.
 * Maintains lookup maps so row metadata survives collapse/re-expand.
 */
class CitationExplorerRowProvider extends ItemTreeRowProvider {
	constructor(itemTree) {
		super(itemTree);
		this._sourceItems = [];
		this._unlinkedItems = [];
		this._citedInByID = new Map();
		this._cslItemIDByID = new Map();
	}

	/**
	 * Override createRow() — the factory hook.
	 * Called by _toggleOpenState() on collapse/re-expand.
	 * Reconstructs rows with metadata from lookup maps.
	 */
	createRow(ref, level, isOpen) {
		if (ref.treeViewID === UNLINKED_ITEMS_ID) {
			return new UnlinkedItemsTreeRow(this._unlinkedItems, isOpen);
		}
		if (ref instanceof Zotero.Library) {
			let items = this._sourceItems.filter(
				item => (item.libraryID ?? Zotero.Libraries.userLibraryID) === ref.libraryID
			);
			return new LibraryItemTreeRow(ref, items, isOpen);
		}

		let key = ref.treeViewID;
		return new CitationExplorerItemTreeRow(ref, level, isOpen, {
			citedIn: this._citedInByID.get(key) || [],
			cslItemID: this._cslItemIDByID.get(key) || null,
		});
	}

	/**
	 * Replace displayed items. Groups by library, sorts, and updates view.
	 * @param {CitationExplorerItemTreeRow[]} itemRows
	 */
	async setItems(itemRows) {
		this._citedInByID = new Map();
		this._cslItemIDByID = new Map();
		this._sourceItems = [];
		for (let row of itemRows) {
			let key = row.id;
			this._citedInByID.set(key, row.citedIn);
			if (row.cslItemID) this._cslItemIDByID.set(key, row.cslItemID);
			this._sourceItems.push(row.ref);
		}

		this._rebuildRows();
		await this.itemTree._ensureSortContextReady();
		// _sort() builds the comparator, sorts top-level rows, then
		// _restoreOpenState() reopens library containers with children
		// sorted by the same comparator via _toggleOpenState()
		this._sort(null);
		await this.runListeners('update', true, { restoreSelection: false });
	}

	/**
	 * Build _rows from _sourceItems. Use grouped container mode when there are
	 * multiple libraries OR any unlinked items.
	 */
	_rebuildRows() {
		const byLibrary = new Map();
		this._unlinkedItems = [];

		for (const item of this._sourceItems) {
			if (this._cslItemIDByID.has(item.treeViewID)) {
				this._unlinkedItems.push(item);
				continue;
			}
			const libID = item.libraryID ?? Zotero.Libraries.userLibraryID;
			if (!byLibrary.has(libID)) byLibrary.set(libID, []);
			byLibrary.get(libID).push(item);
		}

		const sortedLibIDs = [...byLibrary.keys()].sort((a, b) => a - b);
		const showContainers = this._unlinkedItems.length > 0 || sortedLibIDs.length > 1;

		this._rows = [];
		if (showContainers) {
			if (this._unlinkedItems.length) {
				this._rows.push(this.createRow({ treeViewID: UNLINKED_ITEMS_ID }, 0, true));
			}
			for (const libID of sortedLibIDs) {
				let library = Zotero.Libraries.get(libID);
				this._rows.push(this.createRow(library, 0, true));
				// Children will be added by _sort() → _restoreOpenState() →
				// _toggleOpenState(), which sorts them using the cached comparator
			}
		}
		else {
			for (const item of this._sourceItems) {
				this._rows.push(this.createRow(item, 0, false));
			}
		}
		this.refreshRowMap();
	}
}

// ////////////////////////////////////////////////////////////////////////////
//
//  Citation Explorer Item Tree
//
// ////////////////////////////////////////////////////////////////////////////

/**
 * ItemTree subclass that uses CitationExplorerRowProvider.
 */
class CitationExplorerItemTree extends ItemTree {
	constructor(props) {
		super(props);
		this.rowProvider = new CitationExplorerRowProvider(this);
		this._setRowProviderUpdateHandler();
	}

	async setItems(items) {
		await this.rowProvider.setItems(items);
		return this.waitForLoad();
	}

	isSelectable(index, _selectAll = false) {
		return !!this.getRow(index);
	}

	_renderItem(index, selection, oldDiv = null, columns = []) {
		let div = super._renderItem(index, selection, oldDiv, columns);
		let row = this.getRow(index);
		div.classList.toggle('library-container-row', row instanceof LibraryItemTreeRow);
		return div;
	}
}

// ////////////////////////////////////////////////////////////////////////////
//
//  Citation Explorer UI
//
// ////////////////////////////////////////////////////////////////////////////

let io, citations, items, uncitedItems, citationList, itemList;
let citationRows = [];
let itemRows = [];
let _addToTarget;
let disableCitationActivate;

const citationColumns = [
	{
		dataKey: 'title',
		label: "Citation",
		type: 'html'
	},
	{
		dataKey: 'isLinked',
		label: 'Is Linked',
		iconLabel: <CSSIcon name="link" className="icon-16"/>,
		width: 26,
		staticWidth: true,
		fixedWidth: true,
		renderCell: (index, data, column) => {
			let icon = getCSSIcon('cross');
			if (data) {
				icon = getCSSIcon('tick');
			}

			icon.className += ` cell icon-16 ${column.className}`;
			return icon;
		}
	},
];

// All standard Zotero columns, with only title/firstCreator/year visible by default.
const defaultVisibleColumns = new Set(['title', 'firstCreator', 'year']);
let itemColumns = COLUMNS
	.filter(col => col.dataKey !== 'feed')
	.map(col => Object.assign({}, col, {
		hidden: !defaultVisibleColumns.has(col.dataKey),
	}));
// Default sort by creator ascending
let creatorCol = itemColumns.find(c => c.dataKey === 'firstCreator');
if (creatorCol) creatorCol.sortDirection = 1;

window.ZoteroCitationExplorer = {
	init: async function () {
		this._highlightedCitations = new Set();
		this._filteredCitations = new Set();
		this._filteredItems = new Set();
		
		document.querySelector('#button-show-in-document').addEventListener('click', this.onCitationActivate.bind(this));
		document.querySelector('#button-edit-citation').addEventListener('click', this.onCitationEdit.bind(this));

		document.querySelector('#button-show-in-zotero').addEventListener('click', this.onItemActivate.bind(this));
		document.querySelector('#button-relink-item').addEventListener('click', this.onItemRelink.bind(this));
		
		let lastTranslationTarget = Zotero.Prefs.get('documentCitations.lastAddToTarget');
		if (lastTranslationTarget) {
			let id = parseInt(lastTranslationTarget.substr(1));
			if (lastTranslationTarget[0] == "L") {
				_addToTarget = Zotero.Libraries.get(id);
			}
			else if (lastTranslationTarget[0] == "C") {
				_addToTarget = Zotero.Collections.get(id);
			}
		}
		if (!_addToTarget) {
			_addToTarget = Zotero.Libraries.userLibrary;
		}
		this.setAddToButton();
		
		io = window.arguments[0].wrappedJSObject;
		citations = Object.values(io.citations);
		items = io.items;
		uncitedItems = io.uncitedItems;
		
		// Load library data for all items
		let librariesNeeded = new Set();
		for (let item of [...items, ...uncitedItems]) {
			if (item.libraryID) {
				librariesNeeded.add(item.libraryID);
			}
		}
		for (let libraryID of librariesNeeded) {
			let library = Zotero.Libraries.get(libraryID);
			if (!library.getDataLoaded('item')) {
				Zotero.debug("Waiting for items to load for library " + library.libraryID);
				await library.waitForDataLoad('item');
			}
		}
		
		await this._initMappings();
		await this.refreshCitationList();
		await this.refreshItemList();
	},
	
	refreshCitationList: async function () {
		this._renderedCitationRows = citationRows.filter(row => !this._filteredCitations.has(row.ref.citationID));
		this._renderedCitationRows.forEach((row) => {
			row.highlighted = this._highlightedCitations.has(row.ref.citationID);
		});
		
		// init VirtualizedTable
		if (!citationList) {
			await new Promise((resolve) => {
				const domElem = document.querySelector('#citation-list-container');
				ReactDOM.createRoot(domElem).render(<VirtualizedTable
					id="citation-explorer-citations"
					ref={(ref) => {
						citationList = ref;
						resolve();
					}}
					multiSelect={true}
					getRowCount={() => this._renderedCitationRows.length}
					showHeader={true}
					staticColumns={true}
					columns={citationColumns}
					renderItem={makeRowRenderer(index => this._renderedCitationRows[index])}
					onActivate={this.onCitationActivate.bind(this)}
					onSelectionChange={this.onCitationSelectionChange.bind(this)}
					getRowString={index => this._renderedCitationRows[index].title}
				/>);
				// Remove focus from itemList if focus is on citationList
				// to prevent highlighting in both lists
				domElem.addEventListener("focusin", (event) => {
					itemList?.selection.clearSelection()
				});
			});
		}
		citationList.invalidate();
	},
	
	refreshItemList: async function () {
		let filteredRows = itemRows.filter(row => !this._filteredItems.has(row.id));

		if (!itemList) {
			let domElem = document.querySelector('#zotero-items-tree');
			itemList = await CitationExplorerItemTree.init(domElem, {
				id: "citation-explorer-items",
				regularOnly: false,
				columns: itemColumns,
				columnPicker: true,
				shouldListenForNotifications: false,
				onSelectionChange: this.onItemSelectionChange.bind(this),
				onActivate: this.onItemActivate.bind(this),
				emptyMessage: Zotero.getString('pane.items.loading'),
				compareItems: (a, b) => {
					let getGroupOrder = (row) => {
						if (row.ref?.treeViewID === UNLINKED_ITEMS_ID
							|| (row.ref?.cslItemID && !row.ref?.id)) {
							return -1;
						}
						if (row.ref instanceof Zotero.Library) {
							return row.ref.libraryID ?? Zotero.Libraries.userLibraryID;
						}
						return row.ref?.libraryID ?? Zotero.Libraries.userLibraryID;
					};
					return getGroupOrder(a) - getGroupOrder(b);
				},
			});
			await itemList.waitForLoad();
			// Remove focus from citationList if focus is on itemList
			// to prevent highlighting in both lists
			domElem.addEventListener("focusin", () => {
				citationList?.selection.clearSelection();
			});
			document.querySelector("item-tree-menu-bar").init(itemList);
		}

		await itemList.setItems(filteredRows);
	},
	
	onCitationFilter: async function () {
		let searchString = this._normalizeSearch(document.querySelector('#citation-search').value);
		let citationStrings = await Promise.all(citations.map(citation => citation.field.getText()));
		this._filteredCitations = new Set();
		citationStrings.forEach((str, index) => {
			if (!this._normalizeSearch(str).includes(searchString)) {
				this._filteredCitations.add(citations[index].citationID);
			}
		});
		await this.refreshCitationList();
	},
	
	onItemFilter: async function () {
		let searchString = this._normalizeSearch(document.querySelector('#item-search').value);
		let itemStrings = itemRows.map((row) => {
			return [row.ref.getField('title'), row.ref.getField('firstCreator'), row.ref.getField('date')].join(' ');
		});
		this._filteredItems = new Set();
		itemStrings.forEach((str, index) => {
			if (!this._normalizeSearch(str).includes(searchString)) {
				this._filteredItems.add(itemRows[index].id);
			}
		});
		await this.refreshItemList();
	},
	
	_initMappings: async function () {
		const itemMap = {};
		itemRows = items.map((item) => {
			let cslItemID = item.id ? null : item.cslItemID;
			let row = new CitationExplorerItemTreeRow(item, 0, false, { cslItemID });
			itemMap[item.id || item.cslItemID] = row;
			return row;
		});
		// Add uncited items
		for (let item of uncitedItems) {
			let cslItemID = item.id ? null : item.cslItemID;
			let row = new CitationExplorerItemTreeRow(item, 0, false, { citedIn: [], cslItemID });
			itemRows.push(row);
		}
		// Build citation rows and populate citedIn
		citationRows = await Promise.all(citations
			.map(async (citation, citationIndex) => {
				let isLinked = true;
				let citedItems = [];
				for (let citationItem of citation.citationItems) {
					let key = citationItem.id || citationItem.cslItemID;
					let row = itemMap[key];
					if (row) {
						row.citedIn.push(citationIndex);
					}
					isLinked = isLinked && typeof citationItem.id == 'number';
				}
				let title = await citation.field.getText();
				if (citation.properties.plainCitation != title) {
					let d = diff(citation.properties.plainCitation, title);
					title = d.map(([type, text]) => {
						if (type == 0) return text;
						if (type == -1) return `<span class="diff-deleted">${text}</span>`;
						if (type == 1) return `<span class="diff-added">${text}</span>`;
					}).join('');
				}
				return {
					title: title,
					isLinked: isLinked,
					citedItems,
					highlighted: this._highlightedCitations.has(citation.citationID),
					ref: citation
				};
			}));
	},

	/**
	 * Select citation in text
	 * @returns {Promise<void>}
	 * @private
	 */
	onCitationActivate: async function () {
		if (disableCitationActivate) return;
		const citation = citations[citationList.selection.focused];
		try {
			await io.selectCitation(citation);
			const isCitationActivated = await io.cursorInCitation(citation);
			if (isCitationActivated) {
				await io.activateDocument();
				return;
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		// An error got thrown or wrong citation got activated, which means that some citations got deleted
		// and now the citation explorer dialog is not showing correct citations and citation
		// activation is not going to work right.
		
		var ps = Services.prompt;
		var title = Zotero.getString('general.warning');
		var message = Zotero.getString('integration.citationExplorer.citationsModified', [Zotero.appName]);
		ps.alert(window, title, message);
		disableCitationActivate = true;
		document.querySelector('#button-show-in-document').disabled = true;
		document.querySelector('#button-edit-citation').disabled = true;
	},

	/**
	 * Highlight items that are cited in citation
	 * @returns {Promise<void>}
	 * @private
	 */
	onCitationSelectionChange: async function () {
		let highlightedItems = [];
		for (let index of citationList.selection.selected) {
			for (let item of citations[index].citationItems) {
				if (item.cslItemID) {
					highlightedItems.push(item.cslItemID);
				}
				else {
					highlightedItems.push(item.id);
				}
			}
		}
		itemList.setHighlightedRows(highlightedItems);
		const noneSelected = citationList.selection.selected.size === 0;
		document.querySelector('#button-show-in-document').disabled = noneSelected;
		document.querySelector('#button-edit-citation').disabled = noneSelected;
	},
	
	onCitationEdit: async function () {
		let citation = citations[citationList.selection.focused];
		io.openCitationDialog = citation._field;
		window.close();
	},

	/**
	 * Highlight citations that contain item
	 * @returns {Promise<void>}
	 * @private
	 */
	onItemSelectionChange: async function () {
		let selectedRows = [...itemList.selection.selected]
			.map(index => itemList.getRow(index))
			.filter(row => row instanceof CitationExplorerItemTreeRow);

		this._highlightedCitations = new Set();
		for (let row of selectedRows) {
			for (let citationIndex of row.citedIn) {
				this._highlightedCitations.add(citations[citationIndex].citationID);
			}
		}

		let focusedRow = itemList.getRow(itemList.selection.focused);
		let isItemRow = focusedRow instanceof CitationExplorerItemTreeRow;
		let isUnlinked = isItemRow && !focusedRow.isLinked;
		let noneSelected = selectedRows.length === 0;

		document.querySelector('#button-show-in-zotero').disabled = noneSelected || !isItemRow || isUnlinked;
		document.querySelector('#button-relink-item').disabled = noneSelected || !isUnlinked;
		document.querySelector('#button-addTo-library').disabled = noneSelected || !isUnlinked;
		
		await this.refreshCitationList();
	},
		
	onItemActivate: async function () {
		let focusedRow = itemList.getRow(itemList.selection.focused);
		if (focusedRow instanceof LibraryItemTreeRow) return;

		if (!focusedRow.isLinked) {
			this.onItemRelink();
		}
		else {
			let selectedItems = [...itemList.selection.selected]
				.map(index => itemList.getRow(index))
				.filter(row => row instanceof CitationExplorerItemTreeRow)
				.map(row => row.ref);
			await Zotero.Utilities.Internal.showInLibrary(selectedItems);
		}
	},

	onItemRelink: async function () {
		let io = { dataIn: null, dataOut: null, multiSelect: false, deferred: Zotero.Promise.defer() };
		window.openDialog('chrome://zotero/content/selectItemsDialog.xhtml', '',
			'chrome,dialog=no,centerscreen,resizable=yes', io);

		await io.deferred.promise;
		if (!io.dataOut || !io.dataOut.length) {
			return;
		}

		let items = await Zotero.Items.getAsync(io.dataOut);
		if (!items.length) {
			return;
		}
		let treeRow = itemList.getRow(itemList.selection.focused);
		if (treeRow instanceof LibraryItemTreeRow) return;
		const oldItemID = treeRow.id;
		const itemIdx = itemRows.findIndex(row => row.id === oldItemID);
		this._linkItem(items[0], oldItemID, itemIdx);

		await this._initMappings();
		await this.refreshCitationList();
		await this.refreshItemList();
	},

	async addToLibraryAndLink() {
		var collectionID = _addToTarget.objectType == 'collection' ? _addToTarget.id : undefined;
		
		// Load library data
		let targetLibraryID = _addToTarget.libraryID || _addToTarget.library.libraryID;
		let library = Zotero.Libraries.get(targetLibraryID);
		if (!library.getDataLoaded('item')) {
			Zotero.debug("Waiting for items to load for library " + library.libraryID);
			await library.waitForDataLoad('item');
		}
		
		for (let index of itemList.selection.selected) {
			let treeRow = itemList.getRow(index);
			if (treeRow instanceof LibraryItemTreeRow) continue;
			const oldItemID = treeRow.id;
			const itemIdx = itemRows.findIndex(row => row.id === oldItemID);
			
			// Save item
			let item = treeRow.ref.clone(_addToTarget.libraryID);
			if (collectionID) {
				item.addToCollection(collectionID);
			}
			await item.saveTx();
			this._linkItem(item, oldItemID, itemIdx);
		}
		await this._initMappings();
		await this.refreshCitationList();
		await this.refreshItemList();
	},
	
	_linkItem(item, oldItemID, itemIdx) {
		// For all citations where the item is cited
		for (let citationIndex of itemRows[itemIdx].citedIn) {
			let citation = citations[citationIndex];
			let citationItemIdx = citation.citationItems.findIndex(i => i.id == oldItemID);
			let citationItem = citation.citationItems[citationItemIdx];
			// Update the citation with the new item
			citationItem.id = item.id;
			citationItem.uris = Zotero.Integration.currentSession.uriMap.getURIsForItemID(citationItem.id);
			// Mark citation for an update with citeproc and write changes to doc
			io.updateIndex(citationIndex);
		}
		items[itemIdx] = item;
	},
			
	buildAddToLibraryContextMenu(event) {
		var menu = document.querySelector('#item-addTo-menu');
		// Don't trigger rebuilding on nested popupmenu open/close
		if (event.target != menu) {
			return;
		}
		// Clear previous items
		while (menu.firstChild) {
			menu.removeChild(menu.firstChild);
		}
		
		let target = Zotero.Prefs.get('documentCitations.lastAddToTarget');
		if (!target) {
			target = "L" + Zotero.Libraries.userLibraryID;
		}
		
		var libraries = Zotero.Libraries.getAll();
		for (let library of libraries) {
			if (!library.editable || library.libraryType == 'publications') {
				continue;
			}
			Zotero.Utilities.Internal.createMenuForTarget(
				library,
				menu,
				target,
				function(event, libraryOrCollection) {
					if (event.target.tagName == 'menu') {
						Zotero.Promise.coroutine(function* () {
							// Simulate menuitem flash on OS X
							if (Zotero.isMac) {
								event.target.setAttribute('_moz-menuactive', false);
								yield Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', true);
								yield Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', false);
								yield Zotero.Promise.delay(50);
								event.target.setAttribute('_moz-menuactive', true);
							}
							menu.hidePopup();
							
							ZoteroCitationExplorer.setAddToTarget(libraryOrCollection);
							event.stopPropagation();
						})();
					}
					else {
						ZoteroCitationExplorer.setAddToTarget(libraryOrCollection);
						event.stopPropagation();
					}
				}
			);
		}
	},
	
	setAddToTarget(translationTarget) {
		_addToTarget = translationTarget;
		Zotero.Prefs.set('documentCitations.lastAddToTarget', translationTarget.treeViewID);
		this.setAddToButton();
	},
	
	setAddToButton() {
		var label = Zotero.getString('pane.item.addTo', _addToTarget.name);
		var elem = document.querySelector('#button-addTo-library');
		elem.label = label;
		elem.title = label;
		elem.image = _addToTarget.treeViewImage;
	},
	
	
	/**
	 * @param {String} s
	 * @return {String}
	 */
	_normalizeSearch(s) {
		return Zotero.Utilities.removeDiacritics(
			Zotero.Utilities.trimInternal(s).toLowerCase(),
			true);
	},

};

window.addEventListener('DOMContentLoaded', function () {
	ZoteroCitationExplorer.init();
});
