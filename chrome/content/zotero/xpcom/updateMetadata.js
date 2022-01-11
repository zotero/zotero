/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
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

Zotero.UpdateMetadata = new function () {
	const OFFLINE_RECHECK_DELAY = 60 * 1000;

	let _rows = [];
	let _processing = false;
	let _notifierID = Zotero.Notifier.registerObserver(this, ['item'], 'update-metadata');
	let _listeners = [];
	let _dialog = new Zotero.UpdateMetadataDialog({
		onInit() {
			_update();
		},
		onToggle(itemID, fieldName) {
			let row = _rows.find(row => row.itemID === itemID);
			if (row) {
				// Toggle all if no field is passed or item type is changed
				if (!fieldName || _isItemTypeChanged(row)) {
					let hasAcceptedFields = row.fields.find(field => field.isAccepted);
					row.fields.forEach(field => field.isAccepted = !hasAcceptedFields);
				}
				else {
					let field = row.fields.find(x => x.fieldName === fieldName);
					field.isAccepted = !field.isAccepted;
				}
			}
			_update();
		},
		onDoubleClick(itemID) {
			let win = Services.wm.getMostRecentWindow('navigator:browser');
			if (win) {
				win.ZoteroPane.selectItem(itemID, false, true);
				win.focus();
			}
		},
		onApply(itemID) {
			_apply(itemID);
		},
		onCancel() {
			_rows = [];
			_update();
		},
		onClose() {
			_rows = [];
			_update();
		},
		onPressEscape() {
			// Clear and close if all rows are processed and no conflicts,
			// otherwise just close
			if (_rows.find(row => row.fields.length ||
				![Zotero.UpdateMetadata.ROW_SUCCEEDED,
					Zotero.UpdateMetadata.ROW_FAILED
				].includes(row.status)
			)) {
				_dialog.close();
				return;
			}

			_dialog.close();
			_rows = [];
			_update();
		}
	});

	/**
	 * Add listener
	 * @param {String} name Event name
	 * @param callback
	 */
	this.addListener = function (name, callback) {
		_listeners[name] = callback;
	};

	/**
	 * Remove listener
	 * @param {String} name Event name
	 */
	this.removeListener = function (name) {
		delete _listeners[name];
	};

	/**
	 * Accept observer notifications
	 * @param event
	 * @param type
	 * @param ids
	 */
	this.notify = function (event, type, ids) {
		let updated = false;
		for (let id of ids) {
			let row = _rows.find(row => row.itemID === id);
			if (row) {
				let item = Zotero.Items.get(row.itemID);
				row.title = item.getField('title', false, true);
				if (row.newItem) {
					_setRowFields(row, item, row.newItem);
					// If item type changes it's safer to un-accept all fields,
					// when the current item is modified (i.e. in the item pane)
					if (_isItemTypeChanged(row)) {
						row.fields.forEach(field => field.isAccepted = false);
					}
				}
				updated = true;
			}
		}

		if (updated) {
			_update();
		}
	}

	/**
	 * Return rows count
	 * @returns {number}
	 */
	this.getRowsCount = function () {
		return _rows.length;
	}

	/**
	 * Open dialog
	 */
	this.openDialog = function () {
		_dialog.open();
	}

	/**
	 * Check whether a given item could theoretically be updated
	 * @param {Zotero.Item} item
	 * @return {Boolean}
	 */
	this.canUpdate = function (item) {
		return item.isRegularItem();
	};

	/**
	 * Add items to the queue, trigger processing and open dialog
	 * @param {Zotero.Item[]} items
	 */
	this.updateItems = async function (items) {
		for (let item of items) {
			let existingRowIdx = _rows.findIndex(row => row.itemID === item.id);
			if (!this.canUpdate(item)
				|| existingRowIdx >= 0
				&& _rows[existingRowIdx].status === Zotero.UpdateMetadata.ROW_PROCESSING) {
				continue;
			}

			let row = {
				itemID: item.id,
				status: Zotero.UpdateMetadata.ROW_QUEUED,
				message: '',
				title: item.getField('title', false, true),
				fields: [],
				accepted: {}
			};

			if (existingRowIdx >= 0) {
				_rows.splice(existingRowIdx, 1);
			}
			_rows.push(row);
			_update();
		}

		_dialog.open();
		await _processQueue();
	};

	/**
	 * Trigger dialog and toolbar icon update
	 * @private
	 */
	function _update() {
		_dialog.setRows([..._rows]);
		_listeners.rowscount(_rows.length);
	}

	/**
	 * Triggers queue processing and returns when all items in the queue are processed
	 * @return {Promise}
	 * @private
	 */
	async function _processQueue() {
		await Zotero.Schema.schemaUpdatePromise;

		if (_processing) return;
		_processing = true;

		while (1) {
			if (Zotero.HTTP.browserIsOffline()) {
				await Zotero.Promise.delay(OFFLINE_RECHECK_DELAY);
				continue;
			}

			let row = _rows.find(row => row.status === Zotero.UpdateMetadata.ROW_QUEUED);
			if (!row) break;
			row.status = Zotero.UpdateMetadata.ROW_PROCESSING;
			row.message = Zotero.getString('general.processing');
			_update();

			try {
				let item = await Zotero.Items.getAsync(row.itemID);
				if (!item) {
					throw new Error();
				}

				let newItem = await Zotero.Utilities.Internal.getUpdatedMetadata(item);
				if (newItem) {
					_setRowFields(row, item, newItem);
				}

				row.newItem = newItem || oldItem;
				row.status = Zotero.UpdateMetadata.ROW_SUCCEEDED;
				row.message = '';
			}
			catch (e) {
				Zotero.logError(e);
				row.status = Zotero.UpdateMetadata.ROW_FAILED;
				row.message = e instanceof Zotero.Exception.Alert
					? e.message
					: Zotero.getString('general.error');
			}
			_update();
		}

		_processing = false;
	}

	/**
	 * Check if item type changed
	 * @param row
	 * @returns {boolean}
	 * @private
	 */
	function _isItemTypeChanged(row) {
		return !!row.fields.find(x => x.fieldName === 'itemType');
	}

	/**
	 * Format creators
	 * @param creators
	 * @param insertType
	 * @returns {String}
	 * @private
	 */
	function _formatCreators(creators, insertType) {
		return creators.map(c => {
			let name = c.lastName && c.firstName && (c.firstName + ' ' + c.lastName)
				|| c.lastName || c.firstName || '';

			let type = insertType ? ` (${Zotero.CreatorTypes.getLocalizedString(c.creatorType)})` : '';

			// Use a non-breaking space to differentiate between
			// single creator names (and type) and other creators
			return (name + type).replace(/\s/g, '\u00A0');
		}).join(', ');
	}

	/**
	 * Check if field is accepted
	 * @param row
	 * @param fieldName
	 * @returns {Boolean}
	 * @private
	 */
	function _isFieldAccepted(row, fieldName, isRisky) {
		// If field already exists use its `accept` state
		let field = row.fields.find(field => field.fieldName === fieldName);
		if (field) {
			return field.isAccepted;
		}

		// If the field change is risky or the row is already processed and succeeded,
		// all new field differences (i.e. when the existing item was modified in
		// the item pane) are unaccepted by default
		return !isRisky && row.status !== Zotero.UpdateMetadata.ROW_SUCCEEDED;
	}

	function _fieldsEqual(fieldName, oldField, newField) {
		// Return true if the new field is only upper-cased or title-cased
		if (oldField.toLowerCase() === newField.toLowerCase()
			&& (Zotero.Utilities.capitalizeTitle(oldField, true) === oldField
				|| oldField.toUpperCase() === newField)) {
			return true;
		}
		return oldField === newField;
	}

	/**
	 * Compare old and new item and set row fields that are different
	 * @param row
	 * @param oldItem
	 * @param newItem
	 * @private
	 */
	function _setRowFields(row, oldItem, newItem) {
		let combinedFields = [];
		let isMetadataRisky = false;

		let item = new Zotero.Item;
		item.fromJSON(newItem);
		newItem = item;
		let oldItemTypeID = oldItem.itemTypeID;
		oldItem = oldItem.clone();
		oldItem.setType(newItem.itemTypeID);

		// Append extra
		let oldExtra = oldItem.getField('extra');
		let newExtra = newItem.getField('extra');
		if (oldExtra && newExtra && oldExtra !== newExtra &&
			!oldExtra.includes(newExtra)) {
			newItem.setField('extra', oldExtra + '\n' + newExtra);
		}

		// When item type changes some fields disappear as well
		if (oldItemTypeID !== newItem.itemTypeID) {
			let oldItemType = Zotero.ItemTypes.getName(oldItemTypeID);
			let newItemType = Zotero.ItemTypes.getName(newItem.itemTypeID);
			let oldItemTypeLocalized = Zotero.ItemTypes.getLocalizedString(oldItemTypeID);
			let newItemTypeLocalized = Zotero.ItemTypes.getLocalizedString(newItem.itemTypeID);

			if (newItemType === 'webpage') {
				isMetadataRisky = true;
			}

			combinedFields.push({
				fieldName: 'itemType',
				fieldLabel: Zotero.ItemFields.getLocalizedString('itemType'),
				oldValue: oldItemType,
				oldLabel: oldItemTypeLocalized,
				newValue: newItemType,
				newLabel: newItemTypeLocalized,
				isAccepted: _isFieldAccepted(row, 'itemType', isMetadataRisky)
			});
		}

		let allFields = Zotero.ItemFields.getItemTypeFields(oldItemTypeID);
		allFields = allFields.concat(Zotero.ItemFields.getItemTypeFields(newItem.itemTypeID));
		allFields = allFields.map(x => Zotero.ItemFields.getName(x));
		for (let fieldName of allFields) {
			let oldValue = oldItem.getField(fieldName) || '';
			let newValue = newItem.getField(fieldName) || '';
			if (['accessDate'].includes(fieldName)
				|| _fieldsEqual(fieldName, oldValue, newValue)
				|| combinedFields.find(x => x.fieldName === fieldName)) {
				continue;
			}

			let isNewLonger = newValue.length > oldValue.length;
			let isNewEmpty = !newValue;
			let isFieldRisky = isMetadataRisky || isNewEmpty || !isNewLonger;

			combinedFields.push({
				fieldName: fieldName,
				fieldLabel: Zotero.ItemFields.getLocalizedString(fieldName),
				oldValue,
				oldLabel: oldValue,
				newValue,
				newLabel: newValue,
				isAccepted: _isFieldAccepted(row, fieldName, isFieldRisky)
			});
		}

		let includeCreatorType = false;
		let oldCreators = oldItem.getCreators();
		let newCreators = newItem.getCreators();
		for (let i = 0; i < Math.min(oldCreators.length, newCreators.length); i++) {
			if (oldCreators[i].creatorType !== newCreators[i].creatorType) {
				includeCreatorType = true;
				break;
			}
		}

		let oldCreatorsFormatted = _formatCreators(oldCreators, includeCreatorType);
		let newCreatorsFormatted = _formatCreators(newCreators, includeCreatorType);
		if (oldCreatorsFormatted !== newCreatorsFormatted) {
			let creators = {
				fieldName: 'creators',
				fieldLabel: Zotero.getString('general.creators'),
				oldValue: oldCreators,
				oldLabel: oldCreatorsFormatted,
				newValue: newCreators,
				newLabel: newCreatorsFormatted,
				isAccepted: _isFieldAccepted(row, 'creators', isMetadataRisky)
			};

			let index = combinedFields.findIndex(field =>
				Zotero.ItemFields.getBaseIDFromTypeAndField(newItem.itemType, field.fieldName) === 110
			);

			index = index >= 0 && index + 1 || 0;
			combinedFields.splice(index, 0, creators);
		}

		row.fields = combinedFields;
	}

	/**
	 * Apply accepted fields to existing items
	 * @returns {Promise}
	 * @private
	 */
	async function _apply(itemID) {
		for (let row of _rows) {
			if (itemID && row.itemID !== itemID) {
				continue;
			}
			let item = await Zotero.Items.getAsync(row.itemID);
			let itemTypeField = row.fields.find(field => field.fieldName === 'itemType');
			if (itemTypeField && itemTypeField.isAccepted) {
				item.setType(Zotero.ItemTypes.getID(itemTypeField.newValue));
			}

			let creatorsField = row.fields.find(field => field.fieldName === 'creators');
			if (creatorsField && creatorsField.isAccepted) {
				// Clear creators, since `setCreators` doesn't do that by itself, TODO: Fix
				item.setCreators([]);
				item.setCreators(creatorsField.newValue);
			}

			let supportedFieldNames = Zotero.ItemFields.getItemTypeFields(item.itemTypeID);
			supportedFieldNames = supportedFieldNames.map(x => Zotero.ItemFields.getName(x));

			for (let field of row.fields) {
				if (field.isAccepted && supportedFieldNames.includes(field.fieldName)) {
					item.setField(field.fieldName, field.newValue);
				}
			}
			await item.saveTx();
		}
	}
}

Zotero.UpdateMetadata.ROW_QUEUED = 1;
Zotero.UpdateMetadata.ROW_SCHEDULED = 2;
Zotero.UpdateMetadata.ROW_PROCESSING = 3;
Zotero.UpdateMetadata.ROW_FAILED = 4;
Zotero.UpdateMetadata.ROW_SUCCEEDED = 5;
