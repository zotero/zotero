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
Components.utils.import("resource://gre/modules/FileUtils.jsm");

window.isPristine = true;

var itemsView;
var collectionsView;
var io;
var bibEditInterface;
var _accepted = false;
var revertAllButton;

var onLoad = async function () {
	bibEditInterface = window.arguments[0].wrappedJSObject;
	io = window.arguments[0];
	
	revertAllButton = document.getElementById("zotero-edit-bibliography-revert-all-btn");
	revertAllButton.label = Zotero.getString("integration.revertAll.button");
	revertAllButton.addEventListener('command', () => ReferenceItems.revert());

	let quickSearchBox = document.getElementById("zotero-tb-search");
	quickSearchBox.addEventListener("command", handleQuickSearch);
	quickSearchBox.searchTextbox.select();
	Zotero.updateQuickSearchBox(document);

	document.getElementById("zotero-edit-bibliography-cancel-btn").addEventListener('command', cancel);
	document.getElementById("zotero-edit-bibliography-accept-btn").addEventListener('command', accept);

	// initialie collection and item tree
	initLibraryTrees();
	// load all reference and cited items
	await ReferenceItems.load();
	// initialize editor buttons
	BibliographyListUI.initEditorsHeader();
	
	// wait for itemTree to be ready and refresh to highlight items
	while (!itemsView.tree) {
		await Zotero.Promise.delay(10);
	}
	await ReferenceItems.refreshItems(true);

	// Load the first 10 editors so that they are visible as soon as possible
	for (let itemID of ReferenceItems.sortedEditorItemIDs.slice(0, 10)) {
		BibliographyListUI.loadEditor(itemID);
	}
	// Load remaining editors whenever the browser is idle
	requestIdleCallback(BibliographyListUI.loadAllEditors, { timeout: 3000 });
};

var onUnload = function () {
	collectionsView.unregister();
	itemsView.unregister();
	if (!_accepted) {
		cancel();
	}
	io.deferred && io.deferred.resolve();
};

// initialize collectionTree and itemTree to navigate library items
var initLibraryTrees = async function () {
	// +/- buttons will add/remove selected item to/from bibliography
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
		renderer: (index, inBibliography, column) => {
			let cell = document.createElement("span");
			cell.className = `cell ${column.className} clickable`;
			let iconWrapper = document.createElement("span");
			iconWrapper.className = "icon-action";
			cell.append(iconWrapper);
			let icon = inBibliography ? getCSSIcon('minus-circle') : getCSSIcon('plus-circle');
			iconWrapper.append(icon);
			return cell;
		},
		actionHandler: (item, _) => {
			ReferenceItems.toggleItemInBibliography([item.id]);
		}
	});

	itemsView = await ItemTree.init(document.getElementById('zotero-items-tree'), {
		onSelectionChange: () => {
			BibliographyListUI.scrollToRow(itemsView.getSelectedItems(true)[0]);
		},
		onActivate: (event, items) => {
			let itemIDs = items.map(item => item.id);
			ReferenceItems.toggleItemInBibliography(itemIDs);
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
				return ReferenceItems.isInBibliography(item.id) ? " " : "";
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
	// manually initialie menu-bar, otherwise it may not load in time
	document.querySelector("item-tree-menu-bar").init(itemsView);
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

var handleQuickSearch = function () {
	if (!itemsView) return;
	var searchVal = document.getElementById('zotero-tb-search-textbox').value;
	itemsView.setFilter('search', searchVal);
};

// Handling of the list of bibliography items
const BibliographyListUI = {
	editorMap: new Map(), // itemID -> simpleEditor
	selectedEditorAction: new Set(), // bold/underline/italic mode for simpleEditors

	// initialize bold/italic/underline buttons
	initEditorsHeader: function () {
		let styleButtosHeader = document.getElementById("zotero-reference-items-list-header");
		styleButtosHeader.addEventListener("click", (event) => {
			let button = event.target;
			button.classList.toggle("selected");
			if (button.classList.contains("selected")) {
				this.selectedEditorAction.add(button.getAttribute("data-action"));
			}
			else {
				this.selectedEditorAction.delete(button.getAttribute("data-action"));
			}
			if (document.activeElement.classList.contains("reference-editor")) {
				let editor = document.activeElement.contentWindow.editor;
				this.enforceActionsInEditor(editor);
			}
		});
	},

	// save the content of the editor and update its height to match the content
	// it is called on every input event and without debounce, it gets slow with many items
	savePreviewEdits: Zotero.Utilities.debounce(async function (editorFrame) {
		let itemID = parseInt(editorFrame.closest(".list-item").getAttribute("data-item-id"));
		let editor = this.editorMap.get(itemID);
		bibEditInterface.setCustomText(itemID, editor.getContent(true));
		this.updateRevertButtonStatus(itemID);
		let height = editor.getContentHeight();
		editorFrame.style.height = `${height}px`;
		this.enforceActionsInEditor(editor);
	}),

	// set the proper state of a bibliography row's editor and buttons
	setBibRow: function (itemID) {
		let listItem = document.querySelector(`.list-item[data-item-id="${itemID}"]`);
		let itemCitedNotInBibliography = ReferenceItems.isCited(itemID) && !ReferenceItems.isInBibliography(itemID);
		listItem.classList.toggle('excluded', itemCitedNotInBibliography);
		listItem.querySelector(".toggle-status-button").setAttribute("action", itemCitedNotInBibliography ? "add" : "remove");
		this.updateRevertButtonStatus(itemID);

		let itemNotCited = !ReferenceItems.isCited(itemID) && ReferenceItems.isInBibliography(itemID);
		listItem.classList.toggle('uncited', itemNotCited);

		let editor = this.editorMap.get(itemID);
		let content = ReferenceItems.getEditorContent(itemID);
		if (!editor) return;
		let isEnabled = true;
		if (itemCitedNotInBibliography) {
			isEnabled = false;
		}
		editor.setEnabled(isEnabled);
		editor.setContent(content, true);
	},

	// refresh the recorded items in the bibliography and the itemTrees
	async refreshBibRows(skipEditorLoad) {
		let referenceItemsList = document.getElementById('zotero-reference-items-list');
		let listEntries = [...referenceItemsList.querySelectorAll('.list-item')];

		// Remove entries that are no longer needed
		for (let entry of listEntries) {
			let itemID = parseInt(entry.getAttribute('data-item-id'));
			if (!ReferenceItems.sortedEditorItemIDs.includes(itemID)) {
				referenceItemsList.removeChild(entry);
				this.editorMap.delete(itemID);
			}
		}

		// Create a bibliogrqaphy row for each item in the bibliography
		// Initially it has a placeholder for the editor, which are replaced with
		// actual iframes after for better performance
		for (let itemID of ReferenceItems.sortedEditorItemIDs) {
			// if the row for that item already exists, do not create a new one
			if (referenceItemsList.querySelector(`.list-item[data-item-id="${itemID}"]`)) {
				this.setBibRow(itemID);
				continue;
			}
			let listItem = document.querySelector("template").content.querySelector(".list-item").cloneNode(true);
			listItem.setAttribute('data-item-id', itemID);
			referenceItemsList.appendChild(listItem);
			
			let toggleStatusBtn = listItem.querySelector(".toggle-status-button");
			toggleStatusBtn.addEventListener('click', () => {
				ReferenceItems.toggleItemInBibliography([itemID]);
			});

			let revertBtn = listItem.querySelector(".item-revert-button");
			revertBtn.addEventListener('click', () => {
				ReferenceItems.revert(itemID);
			});
			this.updateRevertButtonStatus(itemID);
			this.setBibRow(itemID);
		}
		
		// Ensure list items are in the correct order
		for (let i = 0; i < ReferenceItems.sortedEditorItemIDs.length; i++) {
			let itemID = ReferenceItems.sortedEditorItemIDs[i];
			let listItem = referenceItemsList.querySelector(`.list-item[data-item-id="${itemID}"]`);
			let currentIndex = Array.from(referenceItemsList.children).indexOf(listItem);
			
			// If the item isn't at the correct position, move it
			if (currentIndex !== i) {
				// If it needs to be the first item
				if (i === 0) {
					referenceItemsList.prepend(listItem);
				}
				// If it needs to be in any other position
				else {
					let beforeItem = referenceItemsList.querySelector(
						`.list-item[data-item-id="${ReferenceItems.sortedEditorItemIDs[i-1]}"]`
					);
					beforeItem.after(listItem);
				}
			}
		}

		// Create actual iframe editors for the bibliography rows
		// This step is skipped on initial load to not create potentially hundreds
		// of iframes at once
		if (!skipEditorLoad) {
			this.loadAllEditors();
		}
	},

	loadAllEditors: function () {
		for (let itemID of ReferenceItems.sortedEditorItemIDs) {
			BibliographyListUI.loadEditor(itemID);
		}
	},

	// create iframe editor for the bibliography row and replace a placeholder with it
	loadEditor: function (itemID) {
		if (this.editorMap.has(itemID)) return;
		let listItem = document.querySelector(`.list-item[data-item-id="${itemID}"]`);
		let placeholder = listItem.querySelector(".reference-editor.placeholder");
		// Wait for the editor to load and then set its content
		let editorFrame = document.createElement("iframe");
		editorFrame.src = "simpleEditor.html";
		editorFrame.className = "reference-editor";
		editorFrame.setAttribute("type", "content");
		placeholder.replaceWith(editorFrame);
		editorFrame.addEventListener('DOMContentLoaded', async () => {
			while (!editorFrame.contentWindow.editor) {
				await Zotero.Promise.delay(10);
			}
			let editor = editorFrame.contentWindow.editor;
			// Store the editor in the map and hide action bar
			this.editorMap.set(itemID, editor);
			editor.hideActionBar();
			// After the action bar is gone, set the height of the editor
			setTimeout(() => {
				let height = editor.getContentHeight();
				editorFrame.style.height = `${height}px`;
			});
			this.setBibRow(itemID);
			// save the edits after something is typed
			editorFrame.contentDocument.addEventListener("input", () => {
				this.savePreviewEdits(editorFrame);
			});
			// make sure that the editor's bold/italic/underline config is in sync with the main buttons
			editorFrame.contentDocument.addEventListener("selectionchange", () => {
				this.enforceActionsInEditor(editor);
			});
		});
	},

	updateRevertButtonStatus: function (itemID) {
		let revertBtn = document.querySelector(`.list-item[data-item-id="${itemID}"] .item-revert-button`);
		let citedNotInBibliography = ReferenceItems.isCited(itemID) && !ReferenceItems.isInBibliography(itemID);
		revertBtn.hidden = !bibEditInterface.isEdited(itemID) || citedNotInBibliography;
		revertAllButton.disabled = !bibEditInterface.isAnyEdited();
	},

	enforceActionsInEditor: async function (editor) {
		await Zotero.Promise.delay(10);
		for (let action of [...this.selectedEditorAction]) {
			editor.toggleAction(action, true);
		}
	},

	scrollToRow: function (itemID) {
		document.querySelector(".list-item.highlighted")?.classList.remove("highlighted");
		let listItem = document.querySelector(`.list-item[data-item-id="${itemID}"]`);
		if (listItem) {
			listItem.scrollIntoView({ behavior: "smooth", block: "center" });
			listItem.classList.add("highlighted");
		}
	},

	onSplitterDrag: function () {
		collectionsView.tree.invalidate();
		itemsView.tree.invalidate();
	}
};

// Management of items included in the bibliography
const ReferenceItems = {
	referenceItemIDs: new Set(),
	citedItemIDs: new Set(),
	sortedEditorItemIDs: [],
	cslEngine: null,
	mockBibWithCited: null,

	isInBibliography: function (itemID) {
		return this.referenceItemIDs.has(itemID);
	},

	isCited: function (itemID) {
		return this.citedItemIDs.has(itemID);
	},

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
		let inBibliography = itemIDs.some(itemID => this.isInBibliography(itemID));
		if (inBibliography) {
			this.remove(itemIDs);
		}
		else {
			this.add(itemIDs);
		}
	},

	revert: function (itemID) {
		let revertingItem = !!itemID;
		var promptService = Services.prompt;
		
		var out = {};
		var regenerate = promptService.confirmEx(
			window,
			Zotero.getString(revertingItem ? 'integration.revert.title' : 'integration.revertAll.title'),
			Zotero.getString(revertingItem ? 'integration.revert.body' : 'integration.revertAll.body'),
			promptService.STD_OK_CANCEL_BUTTONS + promptService.BUTTON_POS_1_DEFAULT,
			null, null, null, null, out
		);
		
		if (regenerate != 0) return;
		window.isPristine = false;

		if (revertingItem) {
			bibEditInterface.revert(itemID);
		}
		else {
			bibEditInterface.revertAll();
		}
		this.refreshItems();
	},

	// load all relevant items and prepare temp cslEngine
	load: async function () {
		// create a temp cslEngine to generate bibliography with all cited items
		// even if they are not in the bibliography
		let styleID = bibEditInterface.citeproc.opt.styleID;
		let locale = bibEditInterface.citeproc.opt["default-locale"][0];
		let style = Zotero.Styles.get(styleID);
		this.cslEngine = style.getCiteProc(locale, 'html');
		this.cslEngine.setOutputFormat("html");

		this.citedItemIDs = new Set(Object.keys(bibEditInterface._citationsByItemID).map(itemID => parseInt(itemID)));
		await this.refreshItems(true);
		// load all items included in the bibliography, as well as all cited items
		let allItems = await Zotero.Items.getAsync([...this.referenceItemIDs, ...this.citedItemIDs]);
		await Zotero.Items.loadDataTypes(allItems);
	},

	// refresh list of items in the bibliography and create a sorted list
	// of items in the bibliography + cited but excluded items
	refreshItems: async function (skipEditorLoad) {
		this.referenceItemIDs = new Set(bibEditInterface.bib[0].entry_ids.map((itemID) => {
			let id = itemID[0];
			let parsedInt = parseInt(id);
			return parsedInt || id;
		}));

		let combinedItemIDs = [...this.referenceItemIDs, ...this.citedItemIDs];
		this.cslEngine.updateItems(combinedItemIDs);
		this.mockBibWithCited = this.cslEngine.makeBibliography();
		this.sortedEditorItemIDs = this.mockBibWithCited[0].entry_ids.map((itemID) => {
			let id = itemID[0];
			let parsedInt = parseInt(id);
			return parsedInt || id;
		});
		BibliographyListUI.refreshBibRows(skipEditorLoad);
		if (itemsView?.tree) {
			await itemsView.refresh();
			let highlightRowObj = {};
			for (let itemID of this.sortedEditorItemIDs) {
				let inBibliography = ReferenceItems.isInBibliography(itemID);
				let excluded = ReferenceItems.isCited(itemID) && !inBibliography;
				let uncited = !ReferenceItems.isCited(itemID) && inBibliography;
				if (excluded) {
					highlightRowObj[itemID] = "excluded";
				}
				else if (uncited) {
					highlightRowObj[itemID] = "uncited";
				}
				else if (inBibliography) {
					highlightRowObj[itemID] = "bib";
				}
			}
			let itemIDs = Object.keys(highlightRowObj).map(id => parseInt(id));
			await itemsView.setHighlightedRows(itemIDs, highlightRowObj);
		}
	},

	getEditorContent: function (itemID) {
		let existingCustomText = bibEditInterface.bibliography.customEntryText[itemID];
		if (existingCustomText) {
			return existingCustomText;
		}
		let bib = bibEditInterface.bib;
		if (ReferenceItems.isCited(itemID) && !ReferenceItems.isInBibliography(itemID)) {
			bib = ReferenceItems.mockBibWithCited;
		}
		let indexInBibliography = bib[0].entry_ids.findIndex(id => id == itemID);
		return bib[1][indexInBibliography];
	}
};

window.addEventListener('load', onLoad);
window.addEventListener('unload', onUnload);
