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

import { getCSSIcon } from 'components/icons';
import ItemTree from 'zotero/itemTree';
import CollectionTree from 'zotero/collectionTree';
import { COLUMNS } from 'zotero/itemTreeColumns';
const { OS } = ChromeUtils.importESModule("chrome://zotero/content/osfile.mjs");
Components.utils.import("resource://gre/modules/FileUtils.jsm");

window.isPristine = true;

var referenceItemsView;
var referenceItemIDs = [];
var citedItemIDs = [];
var itemsView;
var collectionsView;
var io;
var bibEditInterface;
var _accepted = false;
var _revertButton, _revertAllButton;
var _editor;


var onLoad = async function () {
	bibEditInterface = window.arguments[0].wrappedJSObject;
	io = window.arguments[0];
	
	_revertAllButton = document.querySelector('dialog').getButton("extra2");
	_revertAllButton.label = Zotero.getString("integration.revertAll.button");
	_revertAllButton.addEventListener('command', () => ReferenceItems.revertAll());

	_revertButton = document.querySelector('dialog').getButton("extra1");
	_revertButton.label = Zotero.getString("integration.revert.button");
	_revertButton.addEventListener('command', () => ReferenceItems.revertSelectedItem());

	document.querySelector('#editor').contentWindow.addEventListener("input", savePreviewEdits);
	_editor = document.querySelector('#editor').contentWindow.editor;

	let quickSearchBox = document.getElementById("zotero-tb-search");
	quickSearchBox.addEventListener("command", handleSearch);
	quickSearchBox.searchTextbox.select();
	Zotero.updateQuickSearchBox(document);

	await ReferenceItems.loadItems();

	await initLibraryTrees();
	await initReferenceItemsTree();

	// if (!io.itemTreeID) {
	// 	io.itemTreeID = "edit-bib-select-item-dialog";
	// }
	
	// load bibliography entries
	while (!itemsView.collectionTreeRow) {
		await Zotero.Promise.delay(10);
	}
	ReferenceItems.refreshItems();
	ReferenceItems.updateRevertButtonStatus();
};

// Special unload handling of itemTrees to be able to save column state of two
// tables at the same time. Otherwise, two itemTrees compete to save to
// treePrefs.json at the same time, and one itemTree overwrites the other.
var onUnload = function () {
	collectionsView.unregister();
	// unregister item trees without saving to the prefs file
	itemsView.unregister({ skipColumnPrefsSave: true });
	referenceItemsView.unregister({ skipColumnPrefsSave: true });
	
	// write to prefs file the state of both itemTrees
	let COLUMN_PREFS_FILEPATH = OS.Path.join(Zotero.Profile.dir, "treePrefs.json");
	let prefsFile = new FileUtils.File(COLUMN_PREFS_FILEPATH);
	try {
		let persistSettingsString = Zotero.File.getContents(prefsFile);
		var persistSettings = JSON.parse(persistSettingsString);
	}
	catch {
		persistSettings = {};
	}
	persistSettings[itemsView.id] = itemsView._columnPrefs;
	persistSettings[referenceItemsView.id] = referenceItemsView._columnPrefs;

	let prefString = JSON.stringify(persistSettings);
	Zotero.File.putContents(prefsFile, prefString);
	io.deferred && io.deferred.resolve();
};

// initialize collectionTree and itemTree to navigate library items
var initLibraryTrees = async function () {
	// Add + button to itemTree that will add selected item into the bibliography
	let itemViewColumns = COLUMNS.map((column) => {
		column = Object.assign({}, column);
		column.hidden = !['title', 'firstCreator', 'date', 'addToBibliography'].includes(column.dataKey);
		return column;
	});
	itemViewColumns.push({
		dataKey: 'addToBibliography',
		label: "Add to bibliography",
		htmlLabel: ' ', // space for column label to appear empty
		width: 26,
		staticWidth: true,
		fixedWidth: true,
		showInColumnPicker: true,
		renderer: (index, inCitation, column) => {
			let cell = document.createElement("span");
			cell.className = `cell ${column.className} clickable`;
			let iconWrapper = document.createElement("span");
			iconWrapper.className = "icon-action";
			cell.append(iconWrapper);
			let icon = inCitation ? getCSSIcon('plus-circle') : null;
			if (icon) {
				iconWrapper.append(icon);
			}
			else {
				cell.classList.remove("clickable");
			}
			return cell;
		},
		actionHandler: (item, _) => {
			ReferenceItems.add([item.id]);
		}
	});

	itemsView = await ItemTree.init(document.getElementById('zotero-items-tree'), {
		onSelectionChange: () => {},
		onActivate: (event, items) => {
			let itemIDs = items.map(item => item.id);
			ReferenceItems.add(itemIDs);
			event.preventDefault();
		},
		id: "edit-bibliography-items-tree",
		dragAndDrop: false,
		persistColumns: true,
		regularOnly: true,
		columnPicker: true,
		multiSelect: true,
		emptyMessage: Zotero.getString('pane.items.loading'),
		columns: itemViewColumns,
		getExtraField: (item, key) => {
			if (key == "addToBibliography") {
				let inBibliography = referenceItemIDs.includes(item.id);
				return inBibliography ? "" : " ";
			}
			return undefined;
		}
	});

	let _onCollectionSelected = async function () {
		var collectionTreeRow = collectionsView.getRow(collectionsView.selection.focused);
		if (!collectionsView.selection.count) return;
		// Collection not changed
		if (itemsView && itemsView.collectionTreeRow && itemsView.collectionTreeRow.id == collectionTreeRow.id) {
			return;
		}
		collectionTreeRow.setSearch('');
		Zotero.Prefs.set('lastViewedFolder', collectionTreeRow.id);
		
		itemsView.setItemsPaneMessage(Zotero.getString('pane.items.loading'));
		
		// Load library data if necessary
		var library = Zotero.Libraries.get(collectionTreeRow.ref.libraryID);
		if (!library.getDataLoaded('item')) {
			Zotero.debug("Waiting for items to load for library " + library.libraryID);
			await library.waitForDataLoad('item');
		}
		
		await itemsView.changeCollectionTreeRow(collectionTreeRow);
		
		itemsView.clearItemsPaneMessage();
	};
	collectionsView = await CollectionTree.init(document.getElementById('zotero-collections-tree'), {
		onSelectionChange: () => _onCollectionSelected(),
		filterLibraryIDs: false,
		hideSources: ['duplicates', 'trash', 'feeds']
	});
};

// initialize the itemTree containing items included in the bibliography
var initReferenceItemsTree = async function () {
	let itemColumns = COLUMNS.map((column) => {
		column = Object.assign({}, column);
		column.hidden = !['title', 'firstCreator', 'date'].includes(column.dataKey);
		return column;
	});

	// Add - button to remove the item from the citation. It becomes + button for the
	// cited items that never leave this itemTree to re-add those items into bibliography
	// Also, add Edited column to indicate if the item has been changed
	itemColumns.push({
		dataKey: 'includeIntoBibliography',
		label: "Exclude from bibliography",
		htmlLabel: ' ', // space for column label to appear empty
		width: 26,
		staticWidth: true,
		fixedWidth: true,
		showInColumnPicker: true,
		renderer: (index, inBibliography, column) => {
			let cell = document.createElement("span");
			cell.className = `cell ${column.className} clickable`;
			let iconWrapper = document.createElement("span");
			iconWrapper.className = "icon-action";
			cell.append(iconWrapper);
			let icon = inBibliography ? getCSSIcon('plus-circle') : getCSSIcon('minus-circle');
			iconWrapper.append(icon);
			return cell;
		},
		actionHandler: (item, _) => {
			ReferenceItems.toggleItemInBibliography([item.id]);
		}
	},
	{
		dataKey: 'isEdited',
		label: "Edited",
		showInColumnPicker: true,
		renderer: (index, isEdited, column) => {
			let cell = document.createElement("span");
			cell.className = `cell ${column.className}`;
			let iconWrapper = document.createElement("span");
			iconWrapper.className = "icon";
			cell.append(iconWrapper);
			let icon = isEdited ? "yes" : "no";
			iconWrapper.append(icon);
			return cell;
		},
		actionHandler: (item, _) => {
			ReferenceItems.toggleItemInBibliography([item.id]);
		}
	},
	{
		dataKey: 'isCited',
		label: "Cited",
		showInColumnPicker: true,
		renderer: (index, isCited, column) => {
			let cell = document.createElement("span");
			cell.className = `cell ${column.className}`;
			let iconWrapper = document.createElement("span");
			iconWrapper.className = "icon";
			cell.append(iconWrapper);
			let icon = isCited ? "yes" : "no";
			iconWrapper.append(icon);
			return cell;
		},
		actionHandler: (item, _) => {
			ReferenceItems.toggleItemInBibliography([item.id]);
		}
	});

	referenceItemsView = await ItemTree.init(document.getElementById('zotero-reference-items-tree'), {
		onSelectionChange: (selection) => {
			if (selection.selected.size == 0) return;
			let selectedRow = referenceItemsView.getRow(selection.focused);
			setPreview(selectedRow.ref.id);
		},
		onActivate: (event, items) => {
			let itemIDs = items.map(item => item.id);
			ReferenceItems.toggleItemInBibliography(itemIDs);
			event.preventDefault();
		},
		id: "reference-items-tree",
		dragAndDrop: false,
		persistColumns: true,
		regularOnly: true,
		columnPicker: true,
		multiSelect: false,
		emptyMessage: Zotero.getString('pane.items.loading'),
		columns: itemColumns,
		getExtraField: (item, key) => {
			if (key == "includeIntoBibliography") {
				let inBibliography = referenceItemIDs.includes(item.id);
				return inBibliography ? "" : " ";
			}
			if (key == "isEdited") {
				return bibEditInterface.isEdited(item.id);
			}
			if (key == "isCited") {
				return citedItemIDs.includes(item.id);
			}
			return undefined;
		}
	});

	await referenceItemsView.changeCollectionTreeRow({
		id: "reference-items-list-tree-row",
		getItems: async () => {
			let referencesItems = referenceItemIDs.map(id => Zotero.Items.get(id));
			let citedItems = citedItemIDs.map(id => Zotero.Items.get(id));
			let combinedItems = Array.from(new Set([...referencesItems, ...citedItems]));
			return combinedItems;
		},
		isSearch: () => false,
		isSearchMode: () => false,
		setSearch: () => {}
	});
};


var savePreviewEdits = async function () {
	let selectedItemID = ReferenceItems.getSelectedItemID();
	let isEdited = bibEditInterface.isEdited(selectedItemID);
	bibEditInterface.setCustomText(selectedItemID, _editor.getContent(true));
	if (!isEdited) {
		let rowIndex = referenceItemsView.getRowIndexByID(selectedItemID);
		await referenceItemsView.refresh();
		referenceItemsView.tree.invalidateRow(rowIndex);
	}
	ReferenceItems.updateRevertButtonStatus();
};

var setPreview = function (itemID) {
	ReferenceItems.updateRevertButtonStatus();
	if (document.activeElement.id == "editor") return;
	let indexInBibliography = bibEditInterface.bib[0].entry_ids.findIndex(id => id == itemID);

	if (!itemID || indexInBibliography == -1) {
		_editor.setContent("");
		_editor.setEnabled(false);
		return;
	}

	_editor.setEnabled(true);
	_editor.setContent(bibEditInterface.bib[1][indexInBibliography], true);
};

var accept = function () {
	if (_accepted) return;
	_accepted = true;
	window.close();
};

var cancel = function () {
	if (_accepted) return;
	bibEditInterface.cancel();
	_accepted = true;
	window.close();
};

var handleSearch = function () {
	if (!itemsView) return;
	var searchVal = document.getElementById('zotero-tb-search-textbox').value;
	itemsView.setFilter('search', searchVal);
};

// Management of items included in the bibliography
const ReferenceItems = {
	add: function (itemIDs) {
		window.isPristine = false;
		for (let itemID of itemIDs) {
			bibEditInterface.add(itemID);
		}
		this.refreshItems();
	},

	remove: function (itemIDs) {
		// if cited in bibliography, warn before removing
		var isCited = itemIDs.some(itemID => bibEditInterface.isCited(itemID));
		if (isCited) {
			var promptService = Services.prompt;
			
			var out = {};
			var regenerate = promptService.confirmEx(
				window,
				Zotero.getString('integration.removeBibEntry.title'),
				Zotero.getString('integration.removeBibEntry.body'),
				promptService.STD_OK_CANCEL_BUTTONS + promptService.BUTTON_POS_1_DEFAULT,
				null, null, null, null, out
			);
			if (regenerate != 0) return;
		}
		window.isPristine = false;
		
		// remove
		for (let itemID of itemIDs) {
			bibEditInterface.remove(itemID);
		}
		this.refreshItems();
	},

	toggleItemInBibliography(itemIDs) {
		let inBibliography = itemIDs.some(itemID => referenceItemIDs.includes(itemID));
		if (inBibliography) {
			ReferenceItems.remove(itemIDs);
		}
		else {
			ReferenceItems.add(itemIDs);
		}
	},

	getSelectedItemID: function () {
		if (referenceItemsView.selection.selected.size == 0) return [];
		let focused = referenceItemsView.selection.focused;
		return referenceItemsView.getRow(focused).ref.id;
	},

	revertSelectedItem: function () {
		var promptService = Services.prompt;
		
		var out = {};
		var regenerate = promptService.confirmEx(
			window,
			Zotero.getString('integration.revert.title'),
			Zotero.getString('integration.revert.body'),
			promptService.STD_OK_CANCEL_BUTTONS + promptService.BUTTON_POS_1_DEFAULT,
			null, null, null, null, out
		);
		
		if (regenerate != 0) return;
		window.isPristine = false;
		
		let selectedItemID = this.getSelectedItemID();
		bibEditInterface.revert(selectedItemID);

		let rowIndex = referenceItemsView.getRowIndexByID(selectedItemID);
		referenceItemsView.refresh().then(() => {
			referenceItemsView.tree.invalidateRow(rowIndex);
		});

		setPreview(selectedItemID);
	},

	revertAll: function () {
		var promptService = Services.prompt;
		
		var out = {};
		var regenerate = promptService.confirmEx(
			window,
			Zotero.getString('integration.revertAll.title'),
			Zotero.getString('integration.revertAll.body'),
			promptService.STD_OK_CANCEL_BUTTONS + promptService.BUTTON_POS_1_DEFAULT,
			null, null, null, null, out
		);
		
		if (regenerate != 0) return;
		window.isPristine = false;
		
		bibEditInterface.revertAll();
		
		this.refreshItems();
		let selectedItemID = this.getSelectedItemID();

		referenceItemsView.refresh().then(() => {
			referenceItemsView.tree.invalidate();
		});

		setPreview(selectedItemID);
	},

	// load all relevant items when dialog opens
	loadItems: async function () {
		var itemIDs = bibEditInterface.bib[0].entry_ids;
		referenceItemIDs = itemIDs.map((itemID) => {
			let id = itemID[0];
			let parsedInt = parseInt(id);
			return parsedInt || id;
		});
		citedItemIDs = Object.keys(bibEditInterface._citationsByItemID).map(itemID => parseInt(itemID));

		// load all items included in the bibliography, as well as all cited items
		let allItems = await Zotero.Items.getAsync([...referenceItemIDs, ...citedItemIDs]);
		await Zotero.Items.getAsync([...referenceItemIDs, ...citedItemIDs]);
		await Zotero.Items.loadDataTypes(allItems);
		// load all potential child items
		let attachments = allItems.map(item => item.getAttachments()).flat();
		let notes = allItems.map(item => item.getNotes()).flat();
		let a = await Zotero.Items.getAsync(attachments);
		await Zotero.Items.loadDataTypes(a);
		let n = await Zotero.Items.getAsync(notes);
		await Zotero.Items.loadDataTypes(n);
	},

	// refresh the recorded items in the bibliography and the itemTrees
	async refreshItems() {
		var itemIDs = bibEditInterface.bib[0].entry_ids;
		referenceItemIDs = itemIDs.map((itemID) => {
			let id = itemID[0];
			let parsedInt = parseInt(id);
			return parsedInt || id;
		});

		let citedNotInBibliography = citedItemIDs.filter(itemID => !referenceItemIDs.includes(itemID));

		// cited items not in bibliography remain in itemTree but are faded
		referenceItemsView.setHighlightedRows(citedNotInBibliography);
		await referenceItemsView.refresh();
		referenceItemsView.tree.invalidate();

		await itemsView.refresh();
		itemsView.tree.invalidate();
	},

	updateRevertButtonStatus: function () {
		_revertAllButton.disabled = !bibEditInterface.isAnyEdited();
		_revertButton.disabled = true;
		var selectedListItemID = this.getSelectedItemID();
		_revertButton.disabled = selectedListItemID === null || !bibEditInterface.isEdited(selectedListItemID);
	}
};

window.addEventListener('load', onLoad);
window.addEventListener('unload', onUnload);
window.addEventListener("dialog-accepted", accept);
window.addEventListener("dialog-cancelled", cancel);
