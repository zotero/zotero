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
					let hasDisabledFields = row.fields.find(field => field.isDisabled);
					row.fields.forEach(field => field.isDisabled = !hasDisabledFields);
				}
				else {
					let field = row.fields.find(x => x.fieldName === fieldName);
					field.isDisabled = !field.isDisabled;
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
			if (_rows.find(row => row.fields.length
				|| ![Zotero.UpdateMetadata.ROW_SUCCEEDED,
					Zotero.UpdateMetadata.ROW_FAILED].includes(row.status)
			)) {
				_dialog.close();
				return;
			}

			_dialog.close();
			_rows = [];
			_update();
		}
	});

	// Expose for tests
	this.isMetadataDisabled = _isMetadataDisabled;
	this.isFieldDisabled = _isFieldDisabled;
	this.isFieldIgnored = _isFieldIgnored;

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
						row.fields.forEach(field => field.isDisabled = true);
					}
				}
				updated = true;
			}
		}

		if (updated) {
			_update();
		}
	};

	/**
	 * Return rows count
	 * @returns {number}
	 */
	this.getRowsCount = function () {
		return _rows.length;
	};

	/**
	 * Open dialog
	 */
	this.openDialog = function () {
		_dialog.open();
	};

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
	 * @returns {Promise}
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
	 * Triggers rows processing and returns when all rows are processed
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
				let oldItem = await Zotero.Items.getAsync(row.itemID);
				if (!oldItem) {
					throw new Error();
				}

				let newItem = await Zotero.Utilities.Internal.getUpdatedItemMetadata(oldItem);
				if (newItem) {
					_setRowFields(row, oldItem, newItem);
					row.newItem = newItem;
				}

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
	 * Check if item type is changed
	 * @param {Object} row
	 * @returns {Boolean}
	 * @private
	 */
	function _isItemTypeChanged(row) {
		return !!row.fields.find(x => x.fieldName === 'itemType');
	}

	/**
	 * Format creators array to string
	 * @param {Zotero.Creators[]} creators
	 * @param {Boolean} insertType - Append creator type after each creator
	 * @returns {String}
	 * @private
	 */
	function _formatCreators(creators, insertType) {
		return creators.map((c) => {
			let name = c.lastName && c.firstName && (c.firstName + ' ' + c.lastName)
				|| c.lastName || c.firstName || '';

			let type = insertType ? ` (${Zotero.CreatorTypes.getLocalizedString(c.creatorType)})` : '';

			// Use a non-breaking space to differentiate between
			// single creator names (and type) and other creators
			return (name + type).replace(/\s/g, '\u00A0');
		}).join(', ');
	}

	/**
	 * Check if field is currently disabled
	 * @param {Object} row
	 * @param {String} fieldName
	 * @param {Boolean} isDisabledByDefault
	 * @returns {Boolean}
	 * @private
	 */
	function _isFieldCurrentlyDisabled(row, fieldName, isDisabledByDefault) {
		// If field already exists use its `accept` state
		let field = row.fields.find(field => field.fieldName === fieldName);
		if (field) {
			return field.isDisabled;
		}

		// If the field change is risky or the row is already processed and succeeded,
		// all new field differences (i.e. when the existing item was modified in
		// the item pane) are unaccepted by default
		return isDisabledByDefault || row.status === Zotero.UpdateMetadata.ROW_SUCCEEDED;
	}

	/**
	 * Compare Levenshtein distance to make sure the titles are similar enough.
	 * Basically half of the longer title should be the same.
	 *
	 * Notice: It's common for some metadata sources to concatenate
	 * subtitle into title
	 *
	 * @param {String} oldValue
	 * @param {String} newValue
	 * @returns {Boolean}
	 * @private
	 */
	function _isTitleSimilar(oldValue, newValue) {
		let distance = Zotero.Utilities.levenshtein(oldValue, newValue);
		let threshold = Math.max(oldValue.length, newValue.length) / 2;
		return distance < threshold;
	}

	/**
	 * A set of rules to check whether there is something
	 * potentially bad with the whole metadata
	 * @param {Zotero.Item} oldItem
	 * @param {Zotero.Item} newItem
	 * @returns {Boolean}
	 * @private
	 */
	function _isMetadataDisabled(oldItem, newItem) {
		return (
			// Title is not similar
			!_isTitleSimilar(oldItem.getField('title', true, true), newItem.getField('title', true, true))

			// Item type changes to `webpage`, since it might be a redirected page
			|| oldItem.itemTypeID !== newItem.itemTypeID && newItem.itemTypeID === 13
		);
	}

	/**
	 * A set of rules to check whether a field should be disabled by default
	 * @param {String} fieldName
	 * @param {String} oldValue
	 * @param {String} newValue
	 * @returns {Boolean}
	 * @private
	 */
	function _isFieldDisabled(fieldName, oldValue, newValue) {
		return (
			// Field disappears (is emptied or disappears because of the item type change)
			!newValue

			// Call Number
			|| fieldName === 'callNumber'
		);
	}

	/**
	 * A set of rules to check whether a field should be ignored when
	 * generating `DiffTable` view
	 * @param {String} fieldName
	 * @param {String} oldValue
	 * @param {String} newValue
	 * @returns {Boolean}
	 * @private
	 */
	function _isFieldIgnored(fieldName, oldValue, newValue) {
		return (
			// Field is not changed
			oldValue === newValue

			// `abstract` disappears (typical for Crossref)
			|| fieldName === 'abstract' && !newValue

			// It's an `accessDate`
			|| fieldName === 'accessDate'

			// Field was just title-cased
			|| Zotero.Utilities.capitalizeTitle(oldValue, true) === newValue

			// Field was just upper-cased
			|| oldValue.toUpperCase() === newValue
		);
	}

	/**
	 * Combine extra fields
	 * @param {String} oldValue
	 * @param {String} newValue
	 * @returns {String}
	 * @private
	 */
	function _combineExtra(oldValue, newValue) {
		if (newValue.includes(oldValue)) {
			return newValue;
		}

		if (oldValue.includes(newValue)) {
			return oldValue;
		}

		return oldValue.length ? oldValue + '\n' + newValue : newValue;
	}

	/**
	 * Compare old and new item and set row fields that are different
	 * @param {Object} row
	 * @param {Zotero.Item} oldItem - The existing item
	 * @param {Object} newItem - Item metadata in translator format
	 * @private
	 */
	function _setRowFields(row, oldItem, newItem) {
		let oldItemTypeID = oldItem.itemTypeID;
		let combinedFields = [];

		// Convert `newItem` to Zotero.Item
		let tmpItem = new Zotero.Item;
		tmpItem.fromJSON(newItem);
		newItem = tmpItem;

		// Check if metadata is not potentially bad
		let isMetadataDisabled = _isMetadataDisabled(oldItem, newItem);

		// Combine `extra` fields and set for `newItem`
		let oldExtra = oldItem.getField('extra');
		let newExtra = newItem.getField('extra');
		if (oldExtra && newExtra && oldExtra !== newExtra) {
			newItem.setField('extra', _combineExtra(oldExtra, newExtra));
		}

		// If item type changes
		if (oldItem.itemTypeID !== newItem.itemTypeID) {
			let oldItemType = Zotero.ItemTypes.getName(oldItem.itemTypeID);
			let newItemType = Zotero.ItemTypes.getName(newItem.itemTypeID);
			let oldItemTypeLocalized = Zotero.ItemTypes.getLocalizedString(oldItem.itemTypeID);
			let newItemTypeLocalized = Zotero.ItemTypes.getLocalizedString(newItem.itemTypeID);

			combinedFields.push({
				fieldName: 'itemType',
				fieldLabel: Zotero.ItemFields.getLocalizedString('itemType'),
				oldValue: oldItemType,
				oldLabel: oldItemTypeLocalized,
				newValue: newItemType,
				newLabel: newItemTypeLocalized,
				isDisabled: _isFieldCurrentlyDisabled(row, 'itemType', isMetadataDisabled)
			});

			// Clone the old item and change its type to simplify field comparision later
			oldItem = oldItem.clone();
			oldItem.setType(newItem.itemTypeID);
		}

		// Compare fields that exist in `newItem` item type, and also
		// include the fields that disappeared on item type change
		// and can't be base-converted
		let allFields = Zotero.ItemFields.getItemTypeFields(newItem.itemTypeID);
		allFields = allFields.concat(newItem.getFieldsNotInType(oldItemTypeID, true));
		allFields = allFields.map(x => Zotero.ItemFields.getName(x));
		for (let fieldName of allFields) {
			let oldValue = oldItem.getField(fieldName) || '';
			let newValue = newItem.getField(fieldName) || '';
			if (_isFieldIgnored(fieldName, oldValue, newValue)) {
				continue;
			}

			let isFieldDisabled = isMetadataDisabled || _isFieldDisabled(fieldName, oldValue, newValue);
			combinedFields.push({
				fieldName: fieldName,
				fieldLabel: Zotero.ItemFields.getLocalizedString(fieldName),
				oldValue,
				oldLabel: oldValue,
				newValue,
				newLabel: newValue,
				isDisabled: _isFieldCurrentlyDisabled(row, fieldName, isFieldDisabled)
			});
		}

		// Compare creators
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
				isDisabled: _isFieldCurrentlyDisabled(row, 'creators', isMetadataDisabled)
			};

			// Find title index to insert creators after
			let titleIndex = combinedFields.findIndex(
				field => Zotero.ItemFields.getBaseIDFromTypeAndField(newItem.itemType, field.fieldName) === 110
			);
			titleIndex = titleIndex >= 0 && titleIndex + 1 || 0;
			combinedFields.splice(titleIndex, 0, creators);
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
			if (itemTypeField && !itemTypeField.isDisabled) {
				item.setType(Zotero.ItemTypes.getID(itemTypeField.newValue));
			}

			let creatorsField = row.fields.find(field => field.fieldName === 'creators');
			if (creatorsField && !creatorsField.isDisabled) {
				// Clear creators, since `setCreators` doesn't do that by itself, TODO: Fix
				item.setCreators([]);
				item.setCreators(creatorsField.newValue);
			}

			let supportedFieldNames = Zotero.ItemFields.getItemTypeFields(item.itemTypeID);
			supportedFieldNames = supportedFieldNames.map(x => Zotero.ItemFields.getName(x));

			for (let field of row.fields) {
				if (!field.isDisabled && supportedFieldNames.includes(field.fieldName)) {
					item.setField(field.fieldName, field.newValue);
				}
			}
			await item.saveTx();
		}
	}
};

Zotero.UpdateMetadata.ROW_QUEUED = 1;
Zotero.UpdateMetadata.ROW_SCHEDULED = 2;
Zotero.UpdateMetadata.ROW_PROCESSING = 3;
Zotero.UpdateMetadata.ROW_FAILED = 4;
Zotero.UpdateMetadata.ROW_SUCCEEDED = 5;
