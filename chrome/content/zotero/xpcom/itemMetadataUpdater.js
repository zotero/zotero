/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright (c) 2026 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     http://digitalscholar.org/

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

Zotero.ItemMetadataUpdater = new function () {
	const SKIP_JSON_FIELDS = new Set([
		'attachments',
		'notes',
		'tags',
		'collections',
		'relations',
		'seeAlso',
		'id',
		'itemID',
		'key',
		'version',
		'dateAdded',
		'dateModified',
		'itemType'
	]);

	function _hasValue(value) {
		if (value === undefined || value === null || value === false) {
			return false;
		}
		return typeof value == 'string' ? value.trim() !== '' : true;
	}

	function _validateDOI(doi) {
		if (typeof doi != 'string') {
			throw new Error('DOI must be a string');
		}

		doi = doi.trim();
		if (!doi) {
			throw new Error('DOI must not be empty');
		}
		return doi;
	}

	function _validateRegularItem(item) {
		if (!item || typeof item.isRegularItem != 'function' || !item.isRegularItem()) {
			throw new Error('Item must be a regular Zotero item');
		}
	}

	function _isValidFieldForItem(field, item) {
		let fieldID = Zotero.ItemFields.getID(field);
		if (!fieldID) {
			return false;
		}

		fieldID = Zotero.ItemFields.getFieldIDFromTypeAndBase(item.itemTypeID, fieldID) || fieldID;
		return Zotero.ItemFields.isValidForType(fieldID, item.itemTypeID);
	}

	function _fieldNames(entries) {
		return [...new Set(entries.map(entry => entry.field))];
	}

	this.lookupItemJSONByDOI = async function (doi, options = {}) {
		doi = _validateDOI(doi);

		let translate = new Zotero.Translate.Search();
		if (options.translatorProvider) {
			translate.setTranslatorProvider(options.translatorProvider);
		}
		translate.setIdentifier({ DOI: doi });

		let translators = await translate.getTranslators();
		if (!translators.length) {
			return null;
		}

		translate.setTranslator(translators);

		let items;
		try {
			items = await translate.translate({
				libraryID: false,
				saveAttachments: false
			});
		}
		catch (e) {
			if (e == translate.ERROR_NO_RESULTS) {
				return null;
			}
			throw e;
		}

		return items.length ? items[0] : null;
	};

	this.getFieldDiff = function (item, jsonItem, options = {}) {
		_validateRegularItem(item);
		if (options.overwrite) {
			throw new Error('Overwriting existing metadata is not supported');
		}
		if (!jsonItem) {
			throw new Error('Metadata item JSON is required');
		}

		let diff = {
			fields: [],
			creators: null,
			skipped: []
		};

		for (let field in jsonItem) {
			if (field == 'creators' || SKIP_JSON_FIELDS.has(field)) {
				continue;
			}
			if (!_hasValue(jsonItem[field]) || !_isValidFieldForItem(field, item)) {
				continue;
			}

			let currentValue = item.getField(field, true, true);
			if (_hasValue(currentValue)) {
				diff.skipped.push({
					field,
					reason: 'nonEmpty',
					currentValue,
					newValue: jsonItem[field]
				});
				continue;
			}

			diff.fields.push({
				field,
				currentValue,
				newValue: jsonItem[field]
			});
		}

		if (Array.isArray(jsonItem.creators) && jsonItem.creators.length) {
			if (item.numCreators()) {
				diff.skipped.push({
					field: 'creators',
					reason: 'nonEmpty',
					newValue: jsonItem.creators
				});
			}
			else {
				diff.creators = {
					field: 'creators',
					currentValue: [],
					newValue: jsonItem.creators
				};
			}
		}

		return diff;
	};

	this.updateItemFromDOI = async function (item, options = {}) {
		let skippedFields = [];
		let updatedFields = [];

		try {
			_validateRegularItem(item);

			let doi = item.getField('DOI');
			if (!_hasValue(doi)) {
				throw new Error('Item does not have a DOI');
			}

			let jsonItem = await this.lookupItemJSONByDOI(doi, options);
			if (!jsonItem) {
				return {
					success: false,
					updatedFields,
					skippedFields,
					error: 'No metadata found for DOI'
				};
			}

			let diff = this.getFieldDiff(item, jsonItem, options);
			skippedFields = _fieldNames(diff.skipped);

			for (let change of diff.fields) {
				if (item.setField(change.field, change.newValue)) {
					updatedFields.push(change.field);
				}
			}

			if (diff.creators) {
				item.setCreators(diff.creators.newValue);
				updatedFields.push('creators');
			}

			if (updatedFields.length) {
				await item.saveTx();
			}

			return {
				success: true,
				updatedFields,
				skippedFields
			};
		}
		catch (e) {
			return {
				success: false,
				updatedFields,
				skippedFields,
				error: e.message || e.toString()
			};
		}
	};
};
