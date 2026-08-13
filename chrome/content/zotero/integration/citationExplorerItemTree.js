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

const { getCSSIcon } = require('components/icons');
const ItemTree = require('zotero/itemTree');
const { ItemTreeRowProvider } = ItemTree;
const { ItemTreeRow, ZoteroItemTreeRow } = require('zotero/itemTreeRow');

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
		let cell = renderCtx.renderCell(index, this.getDisplayTitle(), titleColumn, true);
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
		this._containerOpenState = new Map();
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
			let items = this._sourceItems.filter((item) => {
				let key = item.treeViewID ?? item.cslItemID;
				return (item.libraryID ?? Zotero.Libraries.userLibraryID) === ref.libraryID
					&& !this._cslItemIDByID.has(key);
			});
			return new LibraryItemTreeRow(ref, items, isOpen);
		}

		let key = ref.treeViewID ?? ref.cslItemID;
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
		for (let row of this._rows) {
			if (row instanceof LibraryItemTreeRow) {
				this._containerOpenState.set(row.id, row.isContainerOpen());
			}
		}

		const byLibrary = new Map();
		this._unlinkedItems = [];

		for (const item of this._sourceItems) {
			let key = item.treeViewID ?? item.cslItemID;
			if (this._cslItemIDByID.has(key)) {
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
				let isOpen = this._containerOpenState.get(UNLINKED_ITEMS_ID) ?? true;
				this._rows.push(this.createRow({ treeViewID: UNLINKED_ITEMS_ID }, 0, isOpen));
			}
			for (const libID of sortedLibIDs) {
				let library = Zotero.Libraries.get(libID);
				let isOpen = this._containerOpenState.get(library.treeViewID) ?? true;
				this._rows.push(this.createRow(library, 0, isOpen));
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

module.exports = {
	CitationExplorerItemTree,
	CitationExplorerItemTreeRow,
	LibraryItemTreeRow,
	UnlinkedItemsTreeRow,
	UNLINKED_ITEMS_ID,
};

