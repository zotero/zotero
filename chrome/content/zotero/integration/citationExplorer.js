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
const { getCSSIcon, IconAttachSmall } = require('components/icons');
const ItemTree = require('zotero/itemTree');
const { getColumnDefinitionsByDataKey } = require('zotero/itemTreeColumns');
const { makeRowRenderer } = VirtualizedTable;

let io, citations, items, uncitedItems, citationList, itemList;
let citationRows = [];
let itemRows = [];
let uncitedItemRows = [];
let _addToTarget;
let disableCitationActivate;
let selectedTab = 0;

const citationColumns = [
	{
		dataKey: 'isLinked',
		label: 'Is Linked',
		iconLabel: <IconAttachSmall/>,
		width: 26,
		staticWidth: true,
		fixedWidth: true,
		renderer: (index, data, column) => {
			let icon = getCSSIcon('IconCross');
			if (data) {
				icon = getCSSIcon('IconTick');
			}
			icon.className += ` cell ${column.className}`;
			return icon;
		}
	},
	{
		dataKey: 'title',
		label: "Citation",
		type: 'html'
	},
];

let itemColumns = getColumnDefinitionsByDataKey(['title', 'firstCreator', 'date']);
itemColumns.push({
	dataKey: 'isLinked',
	label: 'Is Linked',
	iconLabel: <IconAttachSmall/>,
	width: 26,
	staticWidth: true,
	fixedWidth: true,
	renderer: (index, data, column) => {
		let icon = getCSSIcon('IconCross');
		if (data) {
			icon = getCSSIcon('IconTick');
		}
		icon.className += ` cell ${column.className}`;
		return icon;
	}
});
itemColumns[1].sortDirection = 1;

window.ZoteroDocumentCitations = {
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
				ReactDOM.createRoot(document.querySelector('#citation-list')).render(<VirtualizedTable
					id="citation-list"
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
			});
		}
		citationList.invalidate();
	},
	
	refreshItemList: async function () {
		let rows = selectedTab === 0 ? itemRows : uncitedItemRows;
		rows.forEach((item) => {
			item.isLinked = !item.cslItemID;
		});

		let filteredItems = rows.filter(item => !this._filteredItems.has(item.id));
		if (!itemList) {
			let domElem = document.querySelector('#item-list');
			itemList = await ItemTree.init(domElem, {
				id: "document-collections",
				regularOnly: true,
				columns: itemColumns,
				shouldListenForNotifications: false,
				onSelectionChange: this.onItemSelectionChange.bind(this),
				onActivate: this.onItemActivate.bind(this),
				emptyMessage: Zotero.getString('pane.items.loading')
			});
			await itemList.waitForLoad();
		}
		await itemList.changeCollectionTreeRow({
			getItems: async () => filteredItems,
			isSearch: () => true,
			isSearchMode: () => true,
		});
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
		let itemStrings = itemRows.map((item) => {
			return [item.getField('title'), item.getField('firstCreator'), item.getField('date')].join(' ');
		});
		this._filteredItems = new Set();
		itemStrings.forEach((str, index) => {
			if (!this._normalizeSearch(str).includes(searchString)) {
				this._filteredItems.add(itemRows[index].id);
			}
		});
		await this.refreshItemList();
	},
	
	onSelectTab: async function (selectedIndex) {
		if (selectedIndex === selectedTab) return;
		selectedTab = selectedIndex;
		if (selectedTab) {
			this._highlightedCitations = new Set();
			document.querySelector('#button-show-in-zotero').hidden = true;
			document.querySelector('#button-relink-item').hidden = false;
			document.querySelector('#button-addTo-library').style.display = 'none';
		}
		await this.refreshCitationList();
		await this.refreshItemList();
	},

	_initMappings: async function () {
		itemRows = items.map((item) => {
			let citedIn = [];
			return new Proxy(item, {
				get(target, prop) {
					if (prop == 'id' && !target.id) {
						return target.cslItemID;
					}
					if (prop == 'citedIn') {
						return citedIn;
					}
					return Reflect.get(...arguments);
				}
			});
		});
		uncitedItemRows = uncitedItems.map((item) => {
			return new Proxy(item, {
				get(target, prop) {
					if (prop == 'citedIn') {
						return [];
					}
					return Reflect.get(...arguments);
				}
			});
		});
		citationRows = await Promise.all(citations
			.map(async (citation, citationIndex) => {
				let isLinked = true;
				let citedItems = [];
				// check if all citation items are linked
				for (let citationItem of citation.citationItems) {
					itemRows.forEach((itemRow, itemIndex) => {
						if ([itemRow.id, itemRow.cslItemID].includes(citationItem.id)) {
							citedItems.push(itemIndex);
							itemRow.citedIn.push(citationIndex);
						}
					});
					if (typeof citationItem.id != 'number') {
						isLinked = false;
						break;
					}
				}
				let title = await citation.field.getText();
				if (citation.properties.plainCitation != title) {
					let d = diff(citation.properties.plainCitation, title);
					title = d.map(([type, text]) => {
						if (type == 0) return text;
						if (type == -1) return `<span style="color: red; text-decoration: line-through">${text}</span>`;
						if (type == 1) return `<span style="color: green">${text}</span>`;
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
		catch (e) { }
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
		if (selectedTab === 1) return;
		this._highlightedCitations = new Set();
		for (let selectedItemIndex of itemList.selection.selected) {
			for (let citationIndex of itemRows[selectedItemIndex].citedIn) {
				this._highlightedCitations.add(citations[citationIndex].citationID);
			}
		}
		const item = itemList.getRow(itemList.selection.focused).ref;
		const isUnlinked = typeof item.id != 'number';
		const isMultiple = itemList.selection.selected.size > 1;
		document.querySelector('#button-show-in-zotero').hidden = isMultiple || isUnlinked;
		document.querySelector('#button-relink-item').hidden = isMultiple || !isUnlinked;
		document.querySelector('#button-addTo-library').style.display = (isMultiple || !isUnlinked) ? 'none' : 'inherit';
		
		await this.refreshCitationList();
	},
		
	onItemActivate: async function () {
		if (itemList.selection.selected.size > 1) return;
		const item = itemList.getRow(itemList.selection.focused).ref;
		if (typeof item.id != 'number') {
			this.onItemRelink();
		}
		else {
			await Zotero.Utilities.Internal.showInLibrary(item);
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
		const oldItemID = treeRow.id;
		const itemIdx = itemRows.findIndex(row => row.id === treeRow.id);
		this._linkItem(items[0], oldItemID, itemIdx);

		await this._initMappings();
		await this.refreshCitationList();
		await this.refreshItemList();
	},
	
	async addToLibraryAndLink() {
		var collectionID = _addToTarget.objectType == 'collection' ? _addToTarget.id : undefined;
		for (let index of itemList.selection.selected) {
			let treeRow = itemList.getRow(index);
			const oldItemID = treeRow.id;
			const itemIdx = itemRows.findIndex(row => row.id === treeRow.id);
			
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
							
							ZoteroDocumentCitations.setAddToTarget(libraryOrCollection);
							event.stopPropagation();
						})();
					}
					else {
						ZoteroDocumentCitations.setAddToTarget(libraryOrCollection);
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
	ZoteroDocumentCitations.init();
});