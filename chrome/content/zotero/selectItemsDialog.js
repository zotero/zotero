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
import ItemTree from 'zotero/itemTree';

var itemsView;
var collectionsView;
var loaded;
var io;
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
	
	itemsView = await ItemTree.init(document.getElementById('zotero-items-tree'), {
		onSelectionChange: () => {
			if (isEditBibliographyDialog) {
				Zotero_Bibliography_Dialog.treeItemSelected();
			}
			else if (isAddEditItemsDialog) {
				onItemSelected();
				Zotero_Citation_Dialog.treeItemSelected();
			}
			else {
				onItemSelected();
			}
		},
		onActivate: () => {
			document.querySelector('dialog').acceptDialog();
		},
		id: io.itemTreeID || "select-items-dialog",
		dragAndDrop: false,
		persistColumns: true,
		columnPicker: true,
		emptyMessage: Zotero.getString('pane.items.loading'),
		multiSelect: !io.singleSelection
	});
	itemsView.setItemsPaneMessage(Zotero.getString('pane.items.loading'));

	const filterLibraryIDs = false || io.filterLibraryIDs;
	const hideSources = io.hideCollections || ['duplicates', 'trash', 'feeds'];
	collectionsView = await CollectionTree.init(document.getElementById('zotero-collections-tree'), {
		onSelectionChange: Zotero.Utilities.debounce(() => onCollectionSelected(), 100),
		filterLibraryIDs,
		hideSources
	});

	await collectionsView.makeVisible();

	if (io.select) {
		await collectionsView.selectItem(io.select);
	}
	
	Zotero.updateQuickSearchBox(document);

	document.addEventListener('dialogaccept', doAccept);
	
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

function doUnload()
{
	collectionsView.unregister();
	if(itemsView)
		itemsView.unregister();
	
	io.deferred && io.deferred.resolve();
}

var onCollectionSelected = async function () {
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
	
	collectionsView.runListeners('select');
};

function onSearch()
{
	if (itemsView)
	{
		var searchVal = document.getElementById('zotero-tb-search-textbox').value;
		itemsView.setFilter('search', searchVal);
	}
}

function onItemSelected()
{
	itemsView.runListeners('select');
	if (io.onlyRegularItems) {
		// Disable "accept" button if a top-level item isn't selected
		let selected = itemsView.getSelectedItems();
		let disableAccept = (selected && !selected.every(item => item.isRegularItem()));
		// TEMP: Disable the button directly only as long as we move the button box in doLoad().
		// Then, we should set buttondisabledaccept attribute on the dialog
		if (disableAccept) {
			document.querySelector("dialog button[dlgtype='accept']").setAttribute("disabled", true);
		}
		else {
			// Remove disabled attribute since the stylesheet looks at disabled attribute
			document.querySelector("dialog button[dlgtype='accept']").removeAttribute("disabled");
		}
	}
}

function doAccept() {
	io.dataOut = itemsView.getSelectedItems(true);
}
