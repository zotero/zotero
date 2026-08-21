/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
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

import CollectionTree from 'zotero/collectionTree';
import CollectionViewItemTree from 'zotero/collectionViewItemTree';
const { getCSSIcon } = require('components/icons');
const { COLUMNS } = require('zotero/itemTreeColumns');

var itemsView;
var collectionsView;
var loaded;
var io;
var suggestedItemsTempTable;
const isSelectItemsDialog = !!document.querySelector('#zotero-select-items-dialog');
const isEditBibliographyDialog = !!document.querySelector('#zotero-edit-bibliography-dialog');
const isAddEditItemsDialog = !!document.querySelector('#zotero-add-citation-dialog');

/*
 * window takes two arguments:
 * io - used for input/output (dataOut is list of item IDs)
 */
var doLoad = async function () {
	// Move the dialog button box into the items pane
	let itemsContainer = document.getElementById('zotero-items-tree-container');
	// TEMP: Only if we're in the redesigned Select Items dialog, not the
	// classic Add Citation dialog, or the Edit Bibliography dialog
	// (until we redesign that too)
	if (isSelectItemsDialog) {
		let buttonBox = document.querySelector('dialog')
			.shadowRoot
			.querySelector('.dialog-button-box');
		itemsContainer.append(buttonBox);
	}
	
	let searchBar = document.getElementById('zotero-tb-search');
	searchBar.searchTextbox.select();

	// Set font size from pref
	var sbc = document.getElementById('zotero-select-items-container');
	Zotero.UIProperties.registerRoot(sbc);
	
	io = window.arguments[0];
	if(io.wrappedJSObject) io = io.wrappedJSObject;
	if(io.addBorder) document.getElementsByTagName("dialog")[0].style.border = "1px solid black";
	if(io.singleSelection) document.getElementById("zotero-items-tree").setAttribute("seltype", "single");

	let columns = COLUMNS;
	let customRows = [];
	if (io.itemIDs) {
		let items = await Zotero.Items.getAsync(io.itemIDs);
		let itemIDs = items.map(item => item.id);
		let libraryIDs = new Set(items.map(item => item.libraryID));
		suggestedItemsTempTable = await Zotero.Search.idsToTempTable(itemIDs, { idColumn: 'id' });
		let search = new Zotero.Search();
		search.name = Zotero.getString('select-items-suggested-items');
		// Called by CollectionViewItemTree when the custom row is loaded or filtered
		let getSuggestedItems = async function () {
			let ids = [];
			for (let libraryID of libraryIDs) {
				let filteredSearch = new Zotero.Search();
				filteredSearch.libraryID = libraryID;
				filteredSearch.addCondition('tempTable', 'is', suggestedItemsTempTable);
				if (this.searchText) {
					let condition = 'quicksearch-'
						+ (this.searchMode || Zotero.Prefs.get('search.quicksearch-mode'));
					filteredSearch.addCondition(condition, 'contains', this.searchText);
				}
				for (let tag of this.tags) {
					filteredSearch.addCondition('tag', 'is', tag);
				}
				ids.push(...await filteredSearch.search());
			}
			return Zotero.Items.getAsync(ids);
		};
		customRows.push({
			id: 'suggested-items',
			type: 'suggestedItems',
			ref: search,
			properties: {
				iconName: 'duplicates',
				// This cross-library row has no libraryID
				isWithinGroup: () => false,
				getItems: getSuggestedItems
			}
		});
		if ([...libraryIDs].some(id => id != Zotero.Libraries.userLibraryID)) {
			let libraryColumn = {
				dataKey: 'library',
				label: 'select-items-library-column',
				showInColumnPicker: true,
				defaultIn: ['suggestedItems'],
				enabledIn: ['suggestedItems'],
				width: '180',
				minWidth: 120,
				zoteroPersist: ['width', 'hidden', 'sortDirection'],
				renderCell(index, libraryName, column, _isFirstColumn, doc) {
					let item = this.getRow(index).ref;
					let library = Zotero.Libraries.get(item.libraryID);
					let cell = doc.createElement('span');
					cell.className = `cell ${column.className}`;
					let icon = getCSSIcon(library.libraryType === 'group' ? 'library-group' : 'library');
					icon.classList.add('cell-icon', 'item-icon', 'icon-item-type');
					let text = doc.createElement('span');
					text.className = 'cell-text';
					text.textContent = libraryName;
					cell.append(icon, text);
					return cell;
				}
			};
			let attachmentColumnIndex = COLUMNS.findIndex(column => column.dataKey === 'hasAttachment');
			columns = [
				...COLUMNS.slice(0, attachmentColumnIndex),
				libraryColumn,
				...COLUMNS.slice(attachmentColumnIndex)
			];
		}
	}
	
	itemsView = await CollectionViewItemTree.init(document.getElementById('zotero-items-tree'), {
		onSelectionChange: () => {
			updateShowInZoteroButton();
			if (isEditBibliographyDialog) {
				Zotero_Bibliography_Dialog.treeItemSelected();
			}
			else if (isAddEditItemsDialog) {
				Zotero_Citation_Dialog.treeItemSelected();
			}
		},
		onActivate: () => {
			document.querySelector('dialog').acceptDialog();
		},
		id: io.itemTreeID || "select-items-dialog",
		dragAndDrop: false,
		regularOnly: io.onlyRegularItems,
		columns,
		columnPicker: true,
		multiSelect: io.multiSelect,
		getExtraField: (item, field) => {
			if (field === 'library' && item.libraryID) {
				return Zotero.Libraries.get(item.libraryID).name;
			}
			return undefined;
		},
		emptyMessage: Zotero.getString('pane.items.loading')
	});
	itemsView.setItemsPaneMessage(Zotero.getString('pane.items.loading'));

	const filterLibraryIDs = false || io.filterLibraryIDs;
	const hideSources = io.hideCollections || ['duplicates', 'trash', 'feeds'];
	collectionsView = await CollectionTree.init(document.getElementById('zotero-collections-tree'), {
		onSelectionChange: () => onCollectionSelected(),
		customRows,
		filterLibraryIDs,
		hideSources
	});

	await collectionsView.makeVisible();

	if (io.itemIDs) {
		await collectionsView.selectWait(collectionsView.getRowIndexByID('suggested-items'));
	}
	else if (io.select) {
		await collectionsView.selectItem(io.select);
	}
	
	Zotero.updateQuickSearchBox(document);

	document.addEventListener('dialogaccept', doAccept);
	if (io.itemIDs) {
		let showInZoteroButton = document.querySelector("dialog button[dlgtype='extra1']");
		document.l10n.setAttributes(showInZoteroButton, 'select-items-show-in-zotero');
		showInZoteroButton.addEventListener('click', async () => {
			await Zotero.Utilities.Internal.showInLibrary(itemsView.getSelectedItems());
		});
		updateShowInZoteroButton();
	}
	else if (!io.extraButtons?.some(button => button.type === 'extra1')) {
		document.querySelector("dialog button[dlgtype='extra1']")?.setAttribute('hidden', true);
	}
	
	if (isSelectItemsDialog) {
		// Set proper tab order. It is only needed in selectItemsDialog -- other dialogs' focus order is correct
		document.querySelector("#zotero-tb-search").searchModePopup.parentNode.setAttribute("tabindex", 1);
		document.querySelector("#zotero-tb-search").searchTextbox.inputField.setAttribute("tabindex", 2);
		document.querySelector("#collection-tree").setAttribute("tabindex", 3);
		document.querySelector("#zotero-items-tree .virtualized-table").setAttribute("tabindex", 4);
		// On Windows, buttons are in a different order than on macOS, so set tabindex accordingly
		let nextButtonTabindex = 5;
		for (let button of [...document.querySelectorAll("button[dlgtype]:not([hidden])")]) {
			button.setAttribute("tabindex", nextButtonTabindex++);
		}
	}
	// Handle any custom button config that can be passed
	for (let buttonConfig of io.extraButtons || []) {
		let button = document.querySelector(`dialog button[dlgtype='${buttonConfig.type}']`);
		button.hidden = buttonConfig.isHidden(document);
		document.l10n.setAttributes(button, buttonConfig.l10nLabel, buttonConfig.l10nArgs || {});
		button.addEventListener("click", event => buttonConfig.onclick(event));
	}
	
	// Used in tests
	loaded = true;
};

function doUnload() {
	collectionsView?.unregister();
	itemsView?.unregister();
	if (suggestedItemsTempTable) {
		Zotero.DB.queryAsync(
			`DROP TABLE IF EXISTS ${suggestedItemsTempTable}`,
			false,
			{ noCache: true }
		).catch(e => Zotero.logError(e));
	}
	io?.deferred?.resolve();
}

function updateShowInZoteroButton() {
	let button = document.querySelector("dialog button[dlgtype='extra1']");
	if (!button || !io?.itemIDs || !collectionsView) return;
	let row = collectionsView.getRow(collectionsView.selection.focused);
	button.hidden = row?.type !== 'suggestedItems';
	button.disabled = button.hidden || !itemsView?.getSelectedItems().length;
}

var onCollectionSelected = async function () {
	var collectionTreeRow = collectionsView.getRow(collectionsView.selection.focused);
	if (!collectionsView.selection.count) return;
	// Collection not changed
	if (itemsView && itemsView.collectionTreeRows[0]?.id == collectionTreeRow.id) {
		return;
	}
	document.getElementById('zotero-tb-search').onCollectionSelected();
	collectionTreeRow.setSearch('');
	if (collectionTreeRow.type !== 'suggestedItems') {
		Zotero.Prefs.set('lastViewedFolder', collectionTreeRow.id);
	}
	
	itemsView.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
	
	// Load library data if necessary
	if (collectionTreeRow.type !== 'suggestedItems') {
		var library = Zotero.Libraries.get(collectionTreeRow.ref.libraryID);
		if (!library.getDataLoaded('item')) {
			Zotero.debug("Waiting for items to load for library " + library.libraryID);
			await library.waitForDataLoad('item');
		}
	}
	// Prevent a race-condition if rapidly clicking on different libraries without loaded
	// item data
	if (collectionsView.getRow(collectionsView.selection.focused)?.id !== collectionTreeRow.id) {
		return;
	}
	await itemsView.changeCollectionTreeRows([collectionTreeRow]);
	
	itemsView.clearItemsPaneMessage();
	updateShowInZoteroButton();
};

function onSearch()
{
	if (itemsView)
	{
		var searchVal = document.getElementById('zotero-tb-search-textbox').value;
		itemsView.setFilter('search', searchVal);
	}
}

function doAccept() {
	io.dataOut = itemsView.getSelectedItems(true);
}
