/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://zotero.org

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

const { COLUMNS } = require('zotero/itemTreeColumns');
const {
	CitationExplorerItemTree,
	CitationExplorerItemTreeRow,
	LibraryItemTreeRow,
} = require('zotero/integration/citationExplorerItemTree');

const ACTION_ADD_TO_COLLECTION = 'addToCollection';
const ACTION_RELINK_TO_EXISTING = 'relinkToExisting';
const ACTION_COPY_FROM_OTHER_LIBRARY = 'copyFromOtherLibrary';
const ACTION_ADD_FROM_DOCUMENT = 'addFromDocument';
const ACTION_CHOOSE = 'choose';
const ACTION_SKIP = 'skip';

/**
 * An action offered for a document item.
 *
 * @typedef {Object} ItemAction
 * @property {String} type - One of the ACTION_* constants above.
 * @property {Zotero.Item} [item] - Existing item to relink to or copy from. Actions that
 * create or skip an item do not need one.
 */

/**
 * State used to determine and apply the action for a document item.
 *
 * @typedef {Object} CitationExplorerWizardItemData
 * @property {Zotero.Item} item
 * @property {Boolean} isCited - Used for Uncited badge
 * @property {ItemAction[]} availableActions
 * @property {Number} selectedActionIndex
 * @property {Number[]} candidateItemIDs - IDs of matching library items suggested by duplicate
 * detection. Used to seed actions and item picker.
 */

const ITEM_TREE_COLUMNS = ['title', 'firstCreator', 'year'].map((dataKey) => {
	let column = COLUMNS.find(col => col.dataKey === dataKey);
	return Object.assign({}, column, {
		hidden: false,
		sortDirection: dataKey === 'title' ? 1 : 0,
	});
});
ITEM_TREE_COLUMNS.find(column => column.dataKey === 'title').flex = 1;
ITEM_TREE_COLUMNS.find(column => column.dataKey === 'firstCreator').width = 90;
ITEM_TREE_COLUMNS.find(column => column.dataKey === 'year').width = 70;

let io;
let wizard;
let itemTree;
let targetCollection;

/** @type {Map<Number|String, CitationExplorerWizardItemData>} */
let itemData = new Map();
let actionDisplay = new WeakMap();
let isApplying = false;
let isChoosingItem = false;

window.ZoteroCitationExplorerWizard = {
	async init() {
		io = window.arguments[0].wrappedJSObject ?? window.arguments[0];
		wizard = document.getElementById('citation-explorer-wizard');
		this._initMappings();

		window.addEventListener('close', (event) => {
			if (isApplying) event.preventDefault();
		});
		wizard.getPageById('choose-operation')
			.addEventListener('pageshow', this.onChoosePageShow.bind(this));
		wizard.getPageById('review-actions')
			.addEventListener('pageshow', this.onReviewPageShow.bind(this));
		wizard.addEventListener('wizardfinish', this.onFinish.bind(this));

		// wizard.shadowRoot content isn't exposed to our CSS
		wizard.shadowRoot
			.querySelector('.wizard-header-label').style.fontSize = '16px';

		// The first page is already shown by the time the window's load handler runs.
		this.onChoosePageShow();
	},

	unload() {
		itemTree?.unregister();
		io?.deferred?.resolve();
	},

	onChoosePageShow() {
		let operation = document.getElementById('item-operation');
		let hasUnlinkedItems = [...itemData.values()].some(data => !data.item.id);
		document.getElementById('item-operation-relink').hidden = !hasUnlinkedItems;
		document.getElementById('item-operation-relink-description').hidden = !hasUnlinkedItems;
		if (!operation.value || (!hasUnlinkedItems && operation.value === 'relink')) {
			operation.value = hasUnlinkedItems ? 'relink' : 'addToTarget';
		}
		targetCollection ??= this._getDefaultLibrary();
		this.buildTargetMenu();
		wizard.canRewind = false;
	},

	async onReviewPageShow() {
		wizard.canRewind = false;
		wizard.canAdvance = false;
		wizard.getButton('finish').disabled = true;
		await this.initItemTree();
		await itemTree.setItemsPaneMessage(
			await document.l10n.formatValue('integration-citationExplorerWizard-status-finding')
		);

		try {
			await this._initActions();
			await this._setItemTreeItems();
			wizard.canRewind = true;
			this._updateCanFinish();
		}
		catch (e) {
			Zotero.logError(e);
			await itemTree.setItemsPaneMessage(
				await document.l10n.formatValue('integration-citationExplorerWizard-status-find-error')
			);
			wizard.canRewind = true;
		}
	},

	_initMappings() {
		itemData = new Map();
		for (let item of [...io.items, ...io.uncitedItems]) {
			let itemID = this._getItemID(item);
			// See CitationExplorerWizardItemData
			itemData.set(itemID, {
				item,
				isCited: false,
				availableActions: [],
				selectedActionIndex: -1,
				candidateItemIDs: [],
			});
		}

		for (let citation of Object.values(io.citations)) {
			for (let citationItem of citation.citationItems) {
				let data = itemData.get(this._getItemID(citationItem));
				data.isCited = true;
			}
		}
	},

	_getItemID(item) {
		return item.id || item.cslItemID;
	},

	_getLibraries() {
		return Zotero.Libraries.getAll().filter(library => library.editable
			&& library.libraryType !== 'publications');
	},

	/**
	 * Default to the eligible library with the highest number of linked citation
	 * occurrences. Uncited linked items count once.
	 */
	_getDefaultLibrary() {
		let libraries = this._getLibraries();
		if (!libraries.length) return null;

		let counts = new Map();
		for (let citation of Object.values(io.citations)) {
			for (let citationItem of citation.citationItems) {
				let item = itemData.get(this._getItemID(citationItem))?.item;
				if (item?.id) {
					counts.set(item.libraryID, (counts.get(item.libraryID) || 0) + 1);
				}
			}
		}
		for (let item of io.uncitedItems) {
			if (item.id) {
				counts.set(item.libraryID, (counts.get(item.libraryID) || 0) + 1);
			}
		}

		return libraries.reduce((defaultLibrary, library) => {
			return (counts.get(library.libraryID) || 0)
					> (counts.get(defaultLibrary.libraryID) || 0)
				? library
				: defaultLibrary;
		}, libraries[0]);
	},

	buildTargetMenu() {
		let targetField = document.getElementById('item-target');
		let menu = document.getElementById('item-target-menu');
		menu.replaceChildren();

		let selectTarget = (event, libraryOrCollection) => {
			targetCollection = libraryOrCollection;
			targetField.open = false;
			event.stopPropagation();
			this.buildTargetMenu();
		};
		for (let library of this._getLibraries()) {
			Zotero.Utilities.Internal.createMenuForTarget(
				library,
				menu,
				targetCollection?.treeViewID,
				selectTarget,
				() => false
			);
		}

		// A collection can be nested in a submenu, so the menulist doesn't derive its
		// displayed value from a direct child menuitem.
		targetField.selectedIndex = -1;
		if (targetCollection) {
			targetField.setAttribute('label', targetCollection.name);
			targetField.setAttribute('image', targetCollection.treeViewImage);
		}
		else {
			targetField.removeAttribute('label');
			targetField.removeAttribute('image');
		}
		wizard.canAdvance = !!targetCollection;
	},

	async initItemTree() {
		if (itemTree) return;

		let actionColumn = {
			dataKey: 'action',
			label: await document.l10n.formatValue(
				'integration-citationExplorerWizard-action-column'
			),
			width: 360,
			minWidth: 280,
			renderCell: (index, _data, column, _isFirstColumn, doc) => {
				return this._renderActionCell(itemTree.getRow(index), column, doc);
			},
		};

		itemTree = await CitationExplorerItemTree.init(
			document.getElementById('zotero-items-tree'),
			{
				id: 'citation-explorer-item-actions',
				regularOnly: false,
				columns: [...ITEM_TREE_COLUMNS, actionColumn],
				columnPicker: false,
				multiSelect: false,
				shouldListenForNotifications: false,
				onActivate: () => this._openActionMenuForFocusedRow(),
				onActionMenuOpen: () => this._openActionMenuForFocusedRow(),
			}
		);
		await itemTree.waitForLoad();
	},

	async _initActions() {
		actionDisplay = new WeakMap();
		let targetLibrary = Zotero.Libraries.get(targetCollection.libraryID);
		if (!targetLibrary.getDataLoaded('item')) {
			await targetLibrary.waitForDataLoad('item');
		}

		let operation = document.getElementById('item-operation').value;
		for (let data of itemData.values()) {
			data.availableActions = [];
			data.selectedActionIndex = -1;
			data.candidateItemIDs = [];

			if (operation === 'relink' && data.item.id) continue;

			let result = await this._getItemActions(data.item);
			data.availableActions = result.availableActions;
			data.candidateItemIDs = result.candidateItemIDs;
			for (let action of data.availableActions) {
				actionDisplay.set(action, await this._getActionDisplay(action));
			}
			if (data.availableActions.length) data.selectedActionIndex = 0;
		}
	},

	async _getItemActions(item) {
		let availableActions = [
			{ type: ACTION_CHOOSE },
			{ type: ACTION_SKIP },
		];
		let candidateItemIDs = [];
		let targetLibraryID = targetCollection.libraryID;
		let collectionID = targetCollection.objectType === 'collection'
			? targetCollection.id
			: null;

		// Item already in target library, add to library.
		if (item.id && item.libraryID === targetLibraryID) {
			if (collectionID && !item.inCollection(collectionID)) {
				availableActions.unshift({ type: ACTION_ADD_TO_COLLECTION });
				return { availableActions, candidateItemIDs };
			}
			return { availableActions: [], candidateItemIDs };
		}

		let linkedItem = item.id
			? await item.getLinkedItem(targetLibraryID, true)
			: null;
		// Exists in the target library, as a linked item, so relink.
		if (linkedItem) {
			candidateItemIDs.push(linkedItem.id);
			availableActions.unshift({ type: ACTION_RELINK_TO_EXISTING, item: linkedItem });
			return { availableActions, candidateItemIDs };
		}

		let libraryIDs = Zotero.Libraries.getAll()
			.filter(library => library.libraryType !== 'feed')
			.map(library => library.libraryID);
		let duplicates = new Zotero.Duplicates(libraryIDs);
		candidateItemIDs = await duplicates.findDuplicatesOf(item);
		let candidateItems = await Zotero.Items.getAsync(candidateItemIDs);
		let targetMatch = candidateItems.find(candidate => candidate.libraryID === targetLibraryID);

		// Exists in the target library as a duplicate item, so offer to relink
		if (targetMatch) {
			availableActions.unshift({
				type: ACTION_RELINK_TO_EXISTING,
				item: targetMatch,
			});
			return { availableActions, candidateItemIDs };
		}

		// If it doesn't exist in the target library, we offer to copy from another library
		// add from the document, or choose a different item in the item selector.

		// Offer at most one copy source per library. The current linked item is the
		// preferred source for its library even if another candidate also exists there.
		let copySources = item.id ? [item] : [];
		let copySourceLibraryIDs = new Set(copySources.map(source => source.libraryID));
		for (let candidate of candidateItems) {
			if (candidate.libraryID !== targetLibraryID
					&& !copySourceLibraryIDs.has(candidate.libraryID)) {
				copySources.push(candidate);
				copySourceLibraryIDs.add(candidate.libraryID);
			}
		}
		availableActions.unshift(...copySources.map(source => ({
			type: ACTION_COPY_FROM_OTHER_LIBRARY,
			item: source,
		})));

		if (!item.id) {
			availableActions.splice(-2, 0, { type: ACTION_ADD_FROM_DOCUMENT });
		}
		else {
			candidateItemIDs.push(item.id);
		}
		return { availableActions, candidateItemIDs };
	},

	async _setItemTreeItems() {
		let rows = [...itemData.entries()]
			.filter(([, data]) => data.availableActions.length)
			.map(([itemID, data]) => new CitationExplorerItemTreeRow(data.item, 0, false, {
				// The wizard only needs citation presence for the Uncited badge, while Citation
				// Explorer rows store actual citation indexes for selection highlighting.
				citedIn: data.isCited ? [0] : [],
				cslItemID: data.item.id ? null : itemID,
			}));

		await itemTree.clearItemsPaneMessage();
		await itemTree.setItems(rows);
		if (!rows.length) {
			await itemTree.setItemsPaneMessage(
				await document.l10n.formatValue('integration-citationExplorerWizard-status-no-changes')
			);
		}
	},

	_openActionMenuForFocusedRow() {
		let index = itemTree.selection.focused;
		let row = itemTree.getRow(index);
		if (!row || row instanceof LibraryItemTreeRow) return false;

		let rowElement = document.getElementById(`${itemTree.id}-row-${index}`);
		let menulist = rowElement?.querySelector('.item-action-select');
		if (!menulist) return false;
		menulist.open = true;
		// Focusing before opening can rerender the virtualized row and discard the control.
		menulist.focus();
		return true;
	},

	async _getActionDisplay(action) {
		let l10nID;
		let l10nArgs;
		let icon;
		switch (action.type) {
			case ACTION_ADD_TO_COLLECTION:
			case ACTION_ADD_FROM_DOCUMENT:
				l10nID = 'integration-citationExplorerWizard-action-add-to-target';
				l10nArgs = { target: targetCollection.name };
				icon = targetCollection.treeViewImage;
				break;

			case ACTION_RELINK_TO_EXISTING:
				l10nID = 'integration-citationExplorerWizard-action-relink';
				l10nArgs = { title: action.item.getDisplayTitle() };
				icon = targetCollection.treeViewImage;
				break;

			case ACTION_COPY_FROM_OTHER_LIBRARY:
				l10nID = 'integration-citationExplorerWizard-action-copy';
				l10nArgs = { library: action.item.library.name };
				icon = action.item.library.treeViewImage;
				break;

			case ACTION_CHOOSE:
				l10nID = 'integration-citationExplorerWizard-action-choose';
				break;

			case ACTION_SKIP:
				l10nID = 'integration-citationExplorerWizard-action-skip';
				icon = 'chrome://zotero/skin/16/universal/cross.svg';
				break;

			default:
				throw new Error(`Unknown item action '${action.type}'`);
		}
		return {
			label: await document.l10n.formatValue(l10nID, l10nArgs),
			icon,
		};
	},

	_renderActionCell(row, column, doc) {
		let cell = doc.createElement('span');
		cell.className = `cell ${column.className}`;
		if (row instanceof LibraryItemTreeRow) return cell;

		let data = itemData.get(row.id);
		let selectedAction = this._getSelectedAction(row.id);
		let select = doc.createXULElement('menulist');
		select.className = 'item-action-select';
		select.setAttribute('native', 'true');
		select.setAttribute('tabindex', '-1');
		select.classList.toggle('skip-selected', selectedAction.type === ACTION_SKIP);
		let popup = doc.createXULElement('menupopup');
		for (let [actionIndex, action] of data.availableActions.entries()) {
			let { label, icon } = actionDisplay.get(action);
			let option = doc.createXULElement('menuitem');
			option.value = String(actionIndex);
			option.setAttribute('label', label);
			if (icon) {
				option.setAttribute('image', icon);
				option.classList.add('menuitem-iconic');
			}
			option.classList.toggle('skip-action', action.type === ACTION_SKIP);
			option.addEventListener('command', async (event) => {
				event.stopPropagation();
				await this._onActionChanged(row.id, actionIndex);
			});
			popup.appendChild(option);
		}
		popup.addEventListener('popuphidden', () => {
			if (!isChoosingItem) itemTree.tree.focus();
		});
		select.appendChild(popup);
		select.value = String(data.selectedActionIndex);
		select.addEventListener('mousedown', event => event.stopPropagation());
		select.addEventListener('mouseup', event => event.stopPropagation());
		select.addEventListener('keydown', event => event.stopPropagation());
		cell.appendChild(select);

		if (selectedAction.type === ACTION_CHOOSE) {
			let chooseButton = doc.createElement('button');
			chooseButton.className = 'choose-item-button';
			chooseButton.tabIndex = -1;
			doc.l10n.setAttributes(
				chooseButton,
				'integration-citationExplorerWizard-choose-button'
			);
			chooseButton.addEventListener('mousedown', event => event.stopPropagation());
			chooseButton.addEventListener('mouseup', event => event.stopPropagation());
			chooseButton.addEventListener('click', async (event) => {
				event.stopPropagation();
				event.preventDefault();
				await this._chooseItem(row.id);
				this._invalidateItemRow(row.id);
				this._updateCanFinish();
				itemTree.tree.focus();
			});
			cell.appendChild(chooseButton);
		}
		return cell;
	},

	async _onActionChanged(itemID, selectedActionIndex) {
		let data = itemData.get(itemID);
		data.selectedActionIndex = selectedActionIndex;
		this._updateCanFinish();
		if (this._getSelectedAction(itemID).type === ACTION_CHOOSE) {
			await this._chooseItem(itemID);
		}
		this._invalidateItemRow(itemID);
		this._updateCanFinish();
		itemTree.tree.focus();
	},

	async _chooseItem(itemID) {
		if (isChoosingItem) return;
		isChoosingItem = true;
		try {
			let data = itemData.get(itemID);
			let chooserIO = {
				dataIn: null,
				dataOut: null,
				itemIDs: data.candidateItemIDs.length ? data.candidateItemIDs : undefined,
				multiSelect: false,
				onlyRegularItems: true,
				deferred: Zotero.Promise.defer(),
			};
			chooserIO.wrappedJSObject = chooserIO;
			let chooserWindow = window.openDialog(
				'chrome://zotero/content/selectItemsDialog.xhtml',
				'',
				'chrome,dialog=yes,centerscreen,resizable=yes',
				chooserIO
			);
			Zotero.Utilities.Internal.activate(chooserWindow);
			await chooserIO.deferred.promise;
			if (!chooserIO.dataOut?.length) return;

			let chosenItem = await Zotero.Items.getAsync(chooserIO.dataOut[0]);
			let actionType = chosenItem.libraryID === targetCollection.libraryID
				? ACTION_RELINK_TO_EXISTING
				: ACTION_COPY_FROM_OTHER_LIBRARY;

			// Keep only one manually chosen action. Candidate actions can be identified
			// by candidateItemIDs and remain available when another item is chosen.
			let extraActionIndex = data.availableActions.findIndex((action) => {
				return [ACTION_RELINK_TO_EXISTING, ACTION_COPY_FROM_OTHER_LIBRARY].includes(action.type)
					&& !data.candidateItemIDs.includes(action.item.id);
			});
			if (extraActionIndex !== -1) {
				data.availableActions.splice(extraActionIndex, 1);
			}

			let selectedActionIndex = data.availableActions.findIndex((action) => {
				return action.type === actionType && action.item?.id === chosenItem.id;
			});
			if (selectedActionIndex === -1) {
				let chooseActionIndex = data.availableActions.findIndex(
					action => action.type === ACTION_CHOOSE
				);
				selectedActionIndex = chooseActionIndex;
				let action = {
					type: actionType,
					item: chosenItem,
				};
				data.availableActions.splice(selectedActionIndex, 0, action);
				actionDisplay.set(action, await this._getActionDisplay(action));
			}
			data.selectedActionIndex = selectedActionIndex;
		}
		finally {
			isChoosingItem = false;
		}
	},

	_invalidateItemRow(itemID) {
		let index = itemTree.getRowIndexByID(itemID);
		if (index !== false) itemTree.tree.invalidateRow(index);
	},

	_getSelectedAction(itemID) {
		let data = itemData.get(itemID);
		return data.availableActions[data.selectedActionIndex] || null;
	},

	_updateCanFinish() {
		let canFinish = [...itemData.entries()]
			.filter(([, data]) => data.availableActions.length)
			.every(([itemID]) => {
				let action = this._getSelectedAction(itemID);
				return action && action.type !== ACTION_CHOOSE;
			});
		wizard.canAdvance = canFinish;
		wizard.getButton('finish').disabled = !canFinish;
	},

	async onFinish(event) {
		event.preventDefault();
		if (!wizard.canAdvance || isApplying) return;

		isApplying = true;
		wizard.canAdvance = false;
		wizard.canRewind = false;
		wizard.getButton('finish').disabled = true;
		wizard.getButton('cancel').disabled = true;
		await itemTree.setItemsPaneMessage(
			await document.l10n.formatValue('integration-citationExplorerWizard-status-applying'),
			true
		);

		try {
			let replacements = [];
			await Zotero.DB.executeTransaction(async () => {
				for (let [itemID, data] of itemData) {
					if (!data.availableActions.length) continue;
					let action = this._getSelectedAction(itemID);
					if (action.type === ACTION_SKIP) continue;

					let destinationItem = await this._applyAction(data.item, action);
					if (action.type !== ACTION_ADD_TO_COLLECTION && destinationItem.id != itemID) {
						replacements.push({ oldItemID: itemID, item: destinationItem });
					}
				}
			});

			if (replacements.length) io.relinkItems(replacements);
			io.completed = true;
			isApplying = false;
			window.close();
		}
		catch (e) {
			Zotero.logError(e);
			isApplying = false;
			itemTree._locked = false;
			await itemTree.setItemsPaneMessage(
				await document.l10n.formatValue('integration-citationExplorerWizard-status-apply-error')
			);
			wizard.getButton('cancel').disabled = false;
			wizard.canRewind = true;
			this._updateCanFinish();
		}
	},

	async _applyAction(documentItem, action) {
		Zotero.DB.requireTransaction();
		let destinationItem;
		switch (action.type) {
			case ACTION_ADD_TO_COLLECTION:
				destinationItem = documentItem;
				break;

			case ACTION_RELINK_TO_EXISTING:
				destinationItem = action.item;
				break;

			case ACTION_COPY_FROM_OTHER_LIBRARY:
				destinationItem = await Zotero.Items.copyToLibrary(
					action.item,
					targetCollection.libraryID
				);
				break;

			case ACTION_ADD_FROM_DOCUMENT:
				destinationItem = documentItem.clone(targetCollection.libraryID);
				await destinationItem.save({ skipSelect: true });
				break;

			default:
				throw new Error(`Cannot apply item action '${action.type}'`);
		}

		if (!destinationItem) {
			throw new Error(`Could not create destination item in library ${targetCollection.libraryID}`);
		}

		// Copy to collection if target is a collection
		if (targetCollection.objectType === 'collection'
				&& !destinationItem.inCollection(targetCollection.id)) {
			destinationItem.addToCollection(targetCollection.id);
			await destinationItem.save({ skipSelect: true });
		}
		return destinationItem;
	},
};
