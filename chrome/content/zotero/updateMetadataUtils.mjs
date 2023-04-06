/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2025 Corporation for Digital Scholarship
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

ChromeUtils.defineESModuleGetters(globalThis, {
	Zotero: "chrome://zotero/content/zotero.mjs"
});

let concurrentCallers = new Map();

/**
 * Resolve an identifier by using fields like title, authors, years, etc.
 *
 * @param {Zotero.Item} item
 * @return {Promise<Object>} Object containing resolved identifiers
 */
async function resolveItemIdentifiers(item) {
	let uri = ZOTERO_CONFIG.SERVICES_URL + 'resolve';
	let req = await Zotero.HTTP.request(
		'POST',
		uri,
		{
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(item.toJSON())
		}
	);

	return JSON.parse(req.response);
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function shouldResolveIntermediateURL(url) {
	return new URL(url).host === 'doi.org';
}

/**
 * Make a HEAD request to resolve the URL that url redirects to.
 *
 * @param {string} url
 * @returns {Promise<string>}
 */
async function resolveIntermediateURL(url) {
	return getConcurrentCallerForURL(url).start(async () => {
		let xhr = await Zotero.HTTP.request('HEAD', url, {
			followRedirects: false
		});
		if (xhr.status > 300 && xhr.status < 400) {
			return xhr.getResponseHeader('location');
		}
		return url;
	});
}

/**
 * Translate URL
 *
 * @param {String} url
 * @return {Promise<Object|null>} Item metadata in translator format
 */
async function translateURL(url) {
	if (shouldResolveIntermediateURL(url)) {
		try {
			url = await resolveIntermediateURL(url);
		}
		catch (e) {
			Zotero.logError(e);
		}
	}

	let caller = getConcurrentCallerForURL(url);
	return caller.start(() => translateURLNow(url));
}

/**
 * Gets metadata from identifier APIs and a publisher website.
 * Identifier API metadata is used as a base and the missing fields
 * are added from a publisher website.
 *
 * Passed identifier objects must contain exactly one identifier field.
 * Searches are rate-limited by identifier.
 *
 * @param {Object} identifier
 * @return {Promise<Object|null>} Item metadata in translator format
 */
function translateIdentifier(identifier) {
	if (Object.keys(identifier).length != 1) {
		throw new Error('Identifier object must contain one identifier field');
	}

	let key = Object.keys(identifier)[0];
	return getConcurrentCallerForIdentifier(key)
		.start(() => translateIdentifierNow(identifier));
}

/**
 * Return a rate-limiting ConcurrentCaller for the given key.
 */
function getConcurrentCaller(key, interval) {
	if (concurrentCallers.has(key)) {
		return concurrentCallers.get(key);
	}

	let { ConcurrentCaller } = Cu.import("resource://zotero/concurrentCaller.js");
	let caller = new ConcurrentCaller({
		numConcurrent: 1,
		interval,
		onError: e => Zotero.logError(e)
	});
	concurrentCallers.set(key, caller);
	return caller;
}

/**
 * @param {string} key
 * @returns {ConcurrentCaller}
 */
function getConcurrentCallerForIdentifier(key) {
	// Crossref tolerates 50 queries per second [https://github.com/CrossRef/rest-api-doc/issues/196#issuecomment-297260099]
	// For all other identifier types, be cautious and limit to two per second.
	return getConcurrentCaller('identifier_' + key, key == 'DOI' ? 30 : 500);
}

/**
 * @param {string} url
 * @returns {ConcurrentCaller}
 */
function getConcurrentCallerForURL(url) {
	let key = url;
	let interval = 500;
	try {
		let uri = new URL(url);
		key = uri.host;
		if (uri.host === 'doi.org') {
			interval = 30;
		}
	}
	catch (e) {
		Zotero.logError(e);
	}
	// Limit to two requests per second per host
	return getConcurrentCaller(key, interval);
}

/**
 * Helper function for translateURL. Runs translation without
 * any rate limiting.
 */
async function translateURLNow(url) {
	let doc = (await Zotero.HTTP.processDocuments(url, doc => doc))[0];
	let newItems = await Zotero.Utilities.Internal.translateDocument(doc);
	if (!newItems.length) {
		return null;
	}
	return newItems[0];
}

/**
 * Helper function for translateIdentifier. Runs translation without
 * any rate limiting.
 */
async function translateIdentifierNow(identifier) {
	let translate = new Zotero.Translate.Search();
	translate.setIdentifier(identifier);

	let translators = await translate.getTranslators();
	translate.setTranslator(translators);
	let newItems;
	try {
		newItems = await translate.translate({
			libraryID: false,
			saveAttachments: false
		});
	}
	catch (e) {
		Zotero.logError(e);
		return null;
	}

	if (!newItems.length) {
		return null;
	}

	let newItem;
	let item1 = newItems[0];
	let item2 = null;

	// Try to resolve and translate publisher's URL
	if (identifier.DOI) {
		try {
			item2 = await translateURL('https://doi.org/' + encodeURIComponent(identifier.DOI));
		}
		catch (e) {
			Zotero.logError(e);
		}
	}

	// If both items are translated and item2 is not a random `webpage` item
	// translated with `Embedded Metadata` translator, use
	// item2 (publisher item) to fill the missing fields in item1 (API item)
	if (item1 && item2
		&& item2.itemType !== 'webpage'
		&& item1.DOI === item2.DOI
	) {
		for (let key in item2) {
			if (Zotero.Utilities.fieldIsValidForType(key, item1.itemType)) {
				if (item2[key]
					// item1 doesn't have the field
					&& (!item1[key]
						// item1 field is shorter
						|| item1[key].length < item2[key].length)) {
					item1[key] = item2[key];
				}
			}
		}

		let _clen = (c) => c.map(x => (x.firstName || '') + (x.lastName || '')).length;
		if (item2.creators
			&& (!item1.creators
				|| _clen(item1.creators) < _clen(item2.creators))) {
			item1.creators = item2.creators;
		}

		newItem = item1;
	}
	else {
		newItem = item1 || item2;
	}

	return newItem;
}

/**
 * Get updated metadata.
 * Uses the existing item URL or identifiers to get the
 * new metadata. Resolves identifiers if doesn't exist.
 * Evaluates metadata and picks the best source. Some fields
 * (i.e. `Abstract`) might be combined from different sources.
 * This doesn't affect the existing item
 *
 * @param {Zotero.Item} item
 * @return {Promise<Object|null>} Item metadata in translator format
 */
export async function getUpdatedItemMetadata(item) {
	let newItem;
	// Get identifiers from the existing item
	let itemIdentifiers = Zotero.Utilities.Internal.getItemIdentifiers(item);
	// Try all identifiers until one is successfully translated
	for (let itemIdentifier of itemIdentifiers) {
		// Ignore ISBN identifiers
		if (itemIdentifier.ISBN) {
			continue;
		}
		newItem = await translateIdentifier(itemIdentifier);
		if (newItem) {
			return newItem;
		}
	}

	// Try to update item metadata by re-translating its URL
	if (item.getField('url')) {
		try {
			newItem = await translateURL(item.getField('url'));
		}
		catch (e) {
			Zotero.logError(e);
		}

		if (newItem) {
			// If the new item has a DOI and the original item didn't,
			// it might be a now-published preprint. If so, we don't want
			// to use the preprint server's metadata anymore, so we'll try
			// translating by DOI first.
			// (The arXiv translator tries to do this already, but it only
			// copies certain fields; we're better off using the DOI item
			// directly.)
			if (newItem.DOI && !itemIdentifiers.some(id => id.DOI)) {
				let doiItem = await translateIdentifier({ DOI: newItem.DOI });
				if (doiItem) {
					return doiItem;
				}
			}
			return newItem;
		}
	}

	// Try to resolve identifiers by using item fields
	let resolvedIdentifiers = await resolveItemIdentifiers(item);
	// Try all resolved identifiers until one is successfully translated
	for (let resolvedIdentifier of resolvedIdentifiers) {
		if (
			// Ignore ISBN identifiers
			resolvedIdentifier.ISBN
			// Make sure we don't retry identifiers that already exist in the item
			|| itemIdentifiers.find(x => JSON.stringify(resolvedIdentifier) === JSON.stringify(x))
		) {
			continue;
		}

		// Translate the resolved identifier
		newItem = await translateIdentifier(resolvedIdentifier);
		if (newItem) {
			return newItem;
		}
	}

	return null;
}
