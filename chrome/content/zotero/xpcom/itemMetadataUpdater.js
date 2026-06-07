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
		'accessDate',
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
		return Zotero.Utilities.cleanDOI(doi) || doi;
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

	function _normalizeMetadataJSON(jsonItem) {
		jsonItem = Object.assign({}, jsonItem);
		if (!_hasValue(jsonItem.abstractNote) && _hasValue(jsonItem.abstract)) {
			jsonItem.abstractNote = jsonItem.abstract;
		}
		return jsonItem;
	}

	function _metadataHasAbstract(jsonItem) {
		return _hasValue(_normalizeMetadataJSON(jsonItem).abstractNote);
	}

	function _getAbstractLength(jsonItem) {
		let value = _normalizeMetadataJSON(jsonItem).abstractNote;
		if (!_hasValue(value)) {
			return 0;
		}
		return value.replace(/\s+/g, ' ').trim().length;
	}

	function _extractAbstractFromDocument(doc) {
		let value = doc.querySelector('meta[name="citation_abstract"]')?.content;
		if (!_hasValue(value)) {
			let paragraphs = doc.querySelectorAll(
				'div.abstract:not(.abstractHighlights) > p, .acl-abstract span'
			);
			value = [...paragraphs]
				.map(paragraph => paragraph.textContent.replace(/\s+/g, ' ').trim())
				.filter(Boolean)
				.join('\n');
		}
		return _hasValue(value) ? value.replace(/[ \t]+/g, ' ').trim() : null;
	}

	function _getScienceDirectURL(url) {
		try {
			let parsedURL = new URL(url);
			let match;
			if (parsedURL.hostname == 'linkinghub.elsevier.com') {
				match = parsedURL.pathname.match(/\/retrieve\/pii\/([^/?#]+)/i);
			}
			else if (/(^|\.)sciencedirect\.com$/i.test(parsedURL.hostname)) {
				match = parsedURL.pathname.match(/\/article\/(?:abs\/)?pii\/([^/?#]+)/i);
			}
			return match
				? `https://www.sciencedirect.com/science/article/pii/${match[1]}`
				: null;
		}
		catch {
			return null;
		}
	}

	function _getAbstractURLs(jsonItem, options) {
		let urls = [];
		for (let url of [options.abstractURL, jsonItem.url, options.itemURL]) {
			if (typeof url != 'string' || !url.trim()) {
				continue;
			}
			url = url.trim();
			let scienceDirectURL = _getScienceDirectURL(url);
			if (scienceDirectURL && !urls.includes(scienceDirectURL)) {
				urls.push(scienceDirectURL);
			}
			if (!urls.includes(url)) {
				urls.push(url);
			}
		}
		return urls;
	}

	async function _translateDocument(doc, options) {
		let abstractNote = _extractAbstractFromDocument(doc);
		if (abstractNote) {
			return { abstractNote };
		}

		let translate = new Zotero.Translate.Web();
		if (options.webTranslatorProvider) {
			translate.setTranslatorProvider(options.webTranslatorProvider);
		}
		translate.setDocument(doc);

		let translators = await translate.getTranslators();
		if (!translators.length) {
			return null;
		}

		translate.setTranslator(translators[0]);
		let items = await translate.translate({
			libraryID: false,
			saveAttachments: false
		});

		return items.length ? items[0] : null;
	}

	async function _lookupItemJSONByRenderedURL(url, options) {
		if (typeof options.renderedWebItemLookup == 'function') {
			return options.renderedWebItemLookup(url);
		}

		const { HiddenBrowser } = ChromeUtils.importESModule(
			"chrome://zotero/content/HiddenBrowser.mjs"
		);
		const { RemoteTranslate } = ChromeUtils.importESModule(
			"chrome://zotero/content/RemoteTranslate.mjs"
		);

		let browser;
		let translate;
		try {
			browser = new HiddenBrowser({
				customUserAgent: Zotero.VersionHeader.getPlainFirefoxUA()
			});
			await browser._createdPromise;
			await Zotero.BrowserRequest._loadAndSettle(browser, url);

			let doc = await browser.getDocument();
			let abstractNote = _extractAbstractFromDocument(doc);
			if (abstractNote) {
				return { abstractNote };
			}

			translate = new RemoteTranslate({ disableErrorReporting: true });
			if (options.webTranslatorProvider) {
				translate.setTranslatorProvider(options.webTranslatorProvider);
			}
			await translate.setBrowser(browser);

			let translators = await translate.detect();
			if (!translators?.length) {
				return null;
			}

			let items = await translate.translate({ libraryID: false });
			return items?.length ? items[0] : null;
		}
		finally {
			translate?.dispose();
			browser?.destroy();
		}
	}

	async function _lookupItemJSONByURL(url, options = {}) {
		if (typeof url != 'string' || !url.trim()) {
			return null;
		}
		if (typeof options.webItemLookup == 'function') {
			return options.webItemLookup(url);
		}

		let entry = Zotero.BrowserRequest?.getEntryForURL(url);
		try {
			let results = await Zotero.HTTP.processDocuments(
				url,
				doc => _translateDocument(doc, options)
			);
			let item = results.length ? results[0] : null;
			if (item || !entry || options.lookupRenderedPage === false) {
				return item;
			}
		}
		catch (e) {
			if (!entry || options.lookupRenderedPage === false) {
				throw e;
			}
			Zotero.debug(`ItemMetadataUpdater: Retrying ${url} in a browser: ${e}`);
		}

		return _lookupItemJSONByRenderedURL(url, options);
	}

	async function _addWebAbstractMetadata(jsonItem, options = {}) {
		if (options.lookupWebAbstract === false) {
			return jsonItem;
		}

		for (let url of _getAbstractURLs(jsonItem, options)) {
			try {
				let webItem = await _lookupItemJSONByURL(url, options);
				if (webItem
						&& _metadataHasAbstract(webItem)
						&& _getAbstractLength(webItem) > _getAbstractLength(jsonItem)) {
					jsonItem = Object.assign({}, jsonItem);
					jsonItem.abstractNote = _normalizeMetadataJSON(webItem).abstractNote;
					break;
				}
			}
			catch (e) {
				Zotero.debug(`ItemMetadataUpdater: Web abstract lookup failed for ${url}: ${e}`);
			}
		}

		return jsonItem;
	}

	function _fieldNames(entries) {
		return [...new Set(entries.map(entry => entry.field))];
	}

	function _sameFieldValue(currentValue, newValue) {
		return String(currentValue) == String(newValue);
	}

	function _normalizeCreatorForCompare(creator) {
		return {
			firstName: creator.firstName || '',
			lastName: creator.lastName || creator.name || '',
			creatorType: creator.creatorType || '',
			fieldMode: creator.fieldMode || (creator.name ? 1 : 0)
		};
	}

	function _sameCreators(currentCreators, newCreators) {
		return JSON.stringify(currentCreators.map(_normalizeCreatorForCompare))
			== JSON.stringify(newCreators.map(_normalizeCreatorForCompare));
	}

	function _getItemTypeChange(item, jsonItem, options) {
		let updateItemType = options.updateItemType === undefined
			? !!options.overwrite
			: !!options.updateItemType;
		if (!updateItemType || !_hasValue(jsonItem.itemType) || jsonItem.itemType == item.itemType) {
			return null;
		}

		let itemTypeID = Zotero.ItemTypes.getID(jsonItem.itemType);
		if (!itemTypeID) {
			throw new Error(`Unknown metadata item type '${jsonItem.itemType}'`);
		}
		if (['attachment', 'note', 'annotation'].includes(jsonItem.itemType)) {
			throw new Error(`Cannot update a regular item to type '${jsonItem.itemType}'`);
		}

		return {
			field: 'itemType',
			currentValue: item.itemType,
			newValue: jsonItem.itemType,
			itemTypeID
		};
	}

	function _itemResultBase(item) {
		let result = {};
		if (item) {
			if (item.id) {
				result.itemID = item.id;
			}
			if (item.key) {
				result.key = item.key;
			}
		}
		return result;
	}

	function _skippedItemResult(item, reason) {
		return Object.assign(_itemResultBase(item), {
			status: 'skipped',
			reason
		});
	}

	function _normalizeItems(items) {
		if (!items || typeof items[Symbol.iterator] != 'function') {
			throw new Error('Items must be iterable');
		}
		return Array.from(items);
	}

	function _shouldCancel(options) {
		return typeof options.shouldCancel == 'function' && options.shouldCancel();
	}

	function _notifyProgress(options, progress) {
		if (typeof options.onProgress == 'function') {
			options.onProgress(progress);
		}
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
		if (!jsonItem) {
			throw new Error('Metadata item JSON is required');
		}
		jsonItem = _normalizeMetadataJSON(jsonItem);

		let diff = {
			itemType: _getItemTypeChange(item, jsonItem, options),
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
				if (!options.overwrite) {
					diff.skipped.push({
						field,
						reason: 'nonEmpty',
						currentValue,
						newValue: jsonItem[field]
					});
					continue;
				}
				if (_sameFieldValue(currentValue, jsonItem[field])) {
					diff.skipped.push({
						field,
						reason: 'same',
						currentValue,
						newValue: jsonItem[field]
					});
					continue;
				}
			}

			diff.fields.push({
				field,
				currentValue,
				newValue: jsonItem[field]
			});
		}

		if (Array.isArray(jsonItem.creators) && jsonItem.creators.length) {
			let currentCreators = item.getCreatorsJSON();
			if (item.numCreators() && !options.overwrite) {
				diff.skipped.push({
					field: 'creators',
					reason: 'nonEmpty',
					newValue: jsonItem.creators
				});
			}
			else if (options.overwrite && _sameCreators(currentCreators, jsonItem.creators)) {
				diff.skipped.push({
					field: 'creators',
					reason: 'same',
					currentValue: currentCreators,
					newValue: jsonItem.creators
				});
			}
			else {
				diff.creators = {
					field: 'creators',
					currentValue: currentCreators,
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
			if (options.overwrite || !_hasValue(item.getField('abstractNote', true, true))) {
				jsonItem = await _addWebAbstractMetadata(
					jsonItem,
					Object.assign({}, options, {
						abstractURL: jsonItem.url,
						itemURL: item.getField('url')
					})
				);
			}

			let diff = this.getFieldDiff(item, jsonItem, options);
			if (diff.itemType) {
				item.setType(diff.itemType.itemTypeID);
				updatedFields.push('itemType');
				diff = this.getFieldDiff(item, jsonItem, options);
			}
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

	this.updateItemsFromDOI = async function (items, options = {}) {
		items = _normalizeItems(items);

		let summary = {
			success: true,
			total: items.length,
			updated: 0,
			unchanged: 0,
			skipped: 0,
			failed: 0,
			results: []
		};

		for (let i = 0; i < items.length; i++) {
			let item = items[i];
			if (_shouldCancel(options)) {
				summary.success = false;
				summary.cancelled = true;
				break;
			}

			_notifyProgress(options, {
				index: i + 1,
				total: items.length,
				item,
				status: 'processing'
			});

			let result;
			try {
				if (!item || typeof item.isRegularItem != 'function' || !item.isRegularItem()) {
					result = _skippedItemResult(item, 'notRegular');
				}
				else if (item.isFeedItem) {
					result = _skippedItemResult(item, 'feedItem');
				}
				else if (!Zotero.Items.isEditable(item)) {
					result = _skippedItemResult(item, 'notEditable');
				}
				else if (!_hasValue(item.getField('DOI'))) {
					result = _skippedItemResult(item, 'noDOI');
				}
				else {
					let updateResult = await this.updateItemFromDOI(item, options);
					if (updateResult.success) {
						result = Object.assign(_itemResultBase(item), {
							status: updateResult.updatedFields.length ? 'updated' : 'unchanged',
							updatedFields: updateResult.updatedFields,
							skippedFields: updateResult.skippedFields
						});
					}
					else {
						result = Object.assign(_itemResultBase(item), {
							status: 'failed',
							updatedFields: updateResult.updatedFields,
							skippedFields: updateResult.skippedFields,
							error: updateResult.error
						});
					}
				}
			}
			catch (e) {
				result = Object.assign(_itemResultBase(item), {
					status: 'failed',
					error: e.message || e.toString()
				});
			}

			summary.results.push(result);
			summary[result.status]++;

			_notifyProgress(options, {
				index: i + 1,
				total: items.length,
				item,
				status: result.status,
				result
			});
		}

		return summary;
	};
};
