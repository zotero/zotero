/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2022 Corporation for Digital Scholarship
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

/*

This file provides a reasonably complete local implementation of the Zotero API (api.zotero.org).
Endpoints are accessible on the local server (localhost:23119 by default) under /api/.

Limitations compared to api.zotero.org:

- Only API version 3 (https://www.zotero.org/support/dev/web_api/v3/basics) is supported,
  and only one API version will ever be supported at a time. If a new API version is released
  and your client needs to maintain support for older versions, first query /api/ and read the
  Zotero-API-Version response header, then make requests conditionally.
- Write access is not yet supported.
- No authentication.
- No access to user data for users other than the local logged-in user. Use user ID 0
  or the user's actual API user ID (https://www.zotero.org/settings/keys).
- Minimal access to metadata about groups.
- Atom is not supported.
- Pagination and limits are not supported.
- If your code relies on any undefined behavior or especially unusual corner cases in the
  web API, it'll probably work differently when using the local API. This implementation is
  primarily concerned with matching the web API's spec and secondarily with matching its
  observed behavior, but it does not make any attempt to replicate implementation details
  that your code might rely on. Sort orders might differ, quicksearch results will probably
  differ, and JSON you get from the local API is never going to be exactly identical to what
  you would get from the web API.

That said, there are benefits:

- No pagination is needed because the API doesn't mind sending you many megabytes of data
  at a time - nothing ever touches the network.
- For the same reason, no rate limits, and it's really fast.
- <userOrGroupPrefix>/searches/:searchKey/items returns the set of items matching a saved
  search. The web API doesn't support actually executing searches.

*/

const LOCAL_API_VERSION = 3;

const exportFormats = new Map([
	['bibtex', '9cb70025-a888-4a29-a210-93ec52da40d4'],
	['biblatex', 'b6e39b57-8942-4d11-8259-342c46ce395f'],
	['bookmarks', '4e7119e0-02be-4848-86ef-79a64185aad8'],
	['coins', '05d07af9-105a-4572-99f6-a8e231c0daef'],
	['csljson', 'bc03b4fe-436d-4a1f-ba59-de4d2d7a63f7'],
	['csv', '25f4c5e2-d790-4daa-a667-797619c7e2f2'],
	['mods', '0e2235e7-babf-413c-9acf-f27cce5f059c'],
	['refer', '881f60f2-0802-411a-9228-ce5f47b64c7d'],
	['rdf_bibliontology', '14763d25-8ba0-45df-8f52-b8d1108e7ac9'],
	['rdf_dc', '6e372642-ed9d-4934-b5d1-c11ac758ebb7'],
	['rdf_zotero', '14763d24-8ba0-45df-8f52-b8d1108e7ac9'],
	['ris', '32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7'],
	['tei', '032ae9b7-ab90-9205-a479-baf81f49184a'],
	['wikipedia', '3f50aaac-7acc-4350-acd0-59cb77faf620'],
]);

/**
 * Base class for all local API endpoints. Implements pre- and post-processing steps.
 */
class LocalAPIEndpoint {
	async init(requestData) {
		let apiVersion = parseInt(
			requestData.headers['Zotero-API-Version']
				|| requestData.searchParams.get('v')
				|| LOCAL_API_VERSION
		);
		// Only allow mismatched version on /api/ no-op endpoint
		if (apiVersion !== LOCAL_API_VERSION && requestData.pathname != '/api/') {
			return this.makeResponse(501, 'text/plain', `API version not implemented: ${parseInt(apiVersion)}`);
		}
		
		let userID = requestData.pathParams.userID && parseInt(requestData.pathParams.userID);
		if (userID !== undefined
				&& userID != 0
				&& userID != Zotero.Users.getCurrentUserID()) {
			return this.makeResponse(400, 'text/plain', 'Only data for the logged-in user is available locally - use userID 0');
		}

		requestData.libraryID = requestData.pathParams.groupID
			? Zotero.Groups.getLibraryIDFromGroupID(parseInt(requestData.pathParams.groupID))
			: Zotero.Libraries.userLibraryID;
		
		let response = await this.run(requestData);
		if (response.data) {
			if (requestData.searchParams.has('since')) {
				let since = parseInt(requestData.searchParams.get('since'));
				if (Number.isNaN(since)) {
					return this.makeResponse(400, 'text/plain', `Invalid 'since' value '${requestData.searchParams.get('since')}'`);
				}
				response.data = response.data.filter(dataObject => dataObject.version > since);
			}
			
			if (Array.isArray(response.data) && response.data.length > 1) {
				let sort = requestData.searchParams.get('sort') || 'dateModified';
				if (!['dateAdded', 'dateModified', 'title', 'creator', 'itemType', 'date', 'publisher', 'publicationTitle', 'journalAbbreviation', 'language', 'accessDate', 'libraryCatalog', 'callNumber', 'rights', 'addedBy', 'numItems']
						.includes(sort)) {
					return this.makeResponse(400, 'text/plain', `Invalid 'sort' value '${sort}'`);
				}
				if (sort == 'creator') {
					sort = 'sortCreator';
				}
				let direction;
				if (requestData.searchParams.has('direction')) {
					let directionParam = requestData.searchParams.get('direction');
					if (directionParam == 'asc') {
						direction = 1;
					}
					else if (directionParam == 'desc') {
						direction = -1;
					}
					else {
						return this.makeResponse(400, 'text/plain', `Invalid 'direction' value '${directionParam}'`);
					}
				}
				else {
					direction = sort.startsWith('date') ? -1 : 1;
				}
				response.data.sort((a, b) => {
					let aField = a[sort];
					if (!aField && a instanceof Zotero.Item) {
						aField = a.getField(sort, true, true);
					}
					let bField = b[sort];
					if (!bField && b instanceof Zotero.Item) {
						bField = b.getField(sort, true, true);
					}
					if (sort == 'date') {
						aField = Zotero.Date.multipartToSQL(aField);
						bField = Zotero.Date.multipartToSQL(bField);
					}
					return aField < bField
						? (-direction)
						: (aField > bField
							? direction
							: 0);
				});
			}
			
			return this.makeDataObjectResponse(requestData, response.data);
		}
		else {
			return this.makeResponse(...response);
		}
	}

	/**
	 * @param requestData Passed to {@link init}
	 * @param dataObjectOrObjects
	 * @returns {Promise} A response to be returned from {@link init}
	 */
	async makeDataObjectResponse(requestData, dataObjectOrObjects) {
		let contentType;
		let body;
		switch (requestData.searchParams.get('format')) {
			case 'atom':
				return this.makeResponse(501, 'text/plain', 'Local API does not support Atom output');
			case 'bib':
				contentType = 'text/html';
				body = await citeprocToHTML(dataObjectOrObjects, requestData.searchParams, false);
				break;
			case 'keys':
				if (!Array.isArray(dataObjectOrObjects)) {
					return this.makeResponse(400, 'text/plain', 'Only multi-object requests can output keys');
				}
				contentType = 'text/plain';
				body = dataObjectOrObjects.map(o => o.key)
					.join('\n');
				break;
			case 'versions':
				if (!Array.isArray(dataObjectOrObjects)) {
					return this.makeResponse(400, 'text/plain', 'Only multi-object requests can output versions');
				}
				contentType = 'application/json';
				body = JSON.stringify(Object.fromEntries(dataObjectOrObjects.map(o => [o.key, o.version])), null, 4);
				break;
			case 'json':
			case null:
				contentType = 'application/json';
				body = JSON.stringify(await toResponseJSON(dataObjectOrObjects, requestData.searchParams), null, 4);
				break;
			default:
				if (exportFormats.has(requestData.searchParams.get('format'))) {
					contentType = 'text/plain';
					body = await exportItems(dataObjectOrObjects, exportFormats.get(requestData.searchParams.get('format')));
				}
				else {
					return this.makeResponse(400, 'text/plain', `Invalid 'format' value '${requestData.searchParams.get('format')}'`);
				}
		}
		return this.makeResponse(200, contentType, body);
	}

	/**
	 * Make an HTTP response array with API headers.
	 *
	 * @param {Number} status
	 * @param {String | Object} contentTypeOrHeaders
	 * @param {String} body
	 * @returns {[Number, Object, String]}
	 */
	makeResponse(status, contentTypeOrHeaders, body) {
		if (typeof contentTypeOrHeaders == 'string') {
			contentTypeOrHeaders = {
				'Content-Type': contentTypeOrHeaders
			};
		}
		contentTypeOrHeaders['Zotero-API-Version'] = LOCAL_API_VERSION;
		contentTypeOrHeaders['Zotero-Schema-Version'] = Zotero.Schema.globalSchemaVersion;
		return [status, contentTypeOrHeaders, body];
	}

	/**
	 * Subclasses must implement this method to process requests.
	 *
	 * @param {Object} requestData
	 * @return {Promise<{ data }> | { data } | [Number, (String | Object), String]}
	 * 		An object with a 'data' property containing a {@link Zotero.DataObject} or an array of DataObjects,
	 * 		or an HTTP response array (status code, Content-Type or headers, body).
	 */
	// eslint-disable-next-line no-unused-vars
	run(requestData) {
		throw new Error("run() must be implemented");
	}
}

const _404 = [404, 'text/plain', 'Not found'];

Zotero.Server.LocalAPI = {};

Zotero.Server.LocalAPI.Root = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	run(_) {
		return [200, 'text/plain', 'Nothing to see here.'];
	}
};
Zotero.Server.Endpoints["/api/"] = Zotero.Server.LocalAPI.Root;

Zotero.Server.LocalAPI.Collections = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];
	
	run({ pathname, pathParams, libraryID }) {
		let top = pathname.endsWith('/top');
		let collections = pathParams.collectionKey
			? Zotero.Collections.getByParent(Zotero.Collections.getIDFromLibraryAndKey(libraryID, pathParams.collectionKey))
			: Zotero.Collections.getByLibrary(libraryID, !top);
		return { data: collections };
	}
};
Zotero.Server.Endpoints["/api/users/:userID/collections"] = Zotero.Server.LocalAPI.Collections;
Zotero.Server.Endpoints["/api/groups/:groupID/collections"] = Zotero.Server.LocalAPI.Collections;
Zotero.Server.Endpoints["/api/users/:userID/collections/top"] = Zotero.Server.LocalAPI.Collections;
Zotero.Server.Endpoints["/api/groups/:groupID/collections/top"] = Zotero.Server.LocalAPI.Collections;
Zotero.Server.Endpoints["/api/users/:userID/collections/:collectionKey/collections"] = Zotero.Server.LocalAPI.Collections;
Zotero.Server.Endpoints["/api/groups/:groupID/collections/:collectionKey/collections"] = Zotero.Server.LocalAPI.Collections;

Zotero.Server.LocalAPI.Collection = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	run({ pathParams, libraryID }) {
		let collection = Zotero.Collections.getByLibraryAndKey(libraryID, pathParams.collectionKey);
		if (!collection) return _404;
		return { data: collection };
	}
};
Zotero.Server.Endpoints["/api/users/:userID/collections/:collectionKey"] = Zotero.Server.LocalAPI.Collection;
Zotero.Server.Endpoints["/api/groups/:groupID/collections/:collectionKey"] = Zotero.Server.LocalAPI.Collection;


Zotero.Server.LocalAPI.Groups = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	run(_) {
		let groups = Zotero.Groups.getAll();
		return { data: groups };
	}
};
Zotero.Server.Endpoints["/api/users/:userID/groups"] = Zotero.Server.LocalAPI.Groups;

Zotero.Server.LocalAPI.Group = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	run({ pathParams }) {
		let group = Zotero.Groups.get(pathParams.groupID);
		if (!group) return _404;
		return { data: group };
	}
};
Zotero.Server.Endpoints["/api/groups/:groupID"] = Zotero.Server.LocalAPI.Group;
Zotero.Server.Endpoints["/api/users/:userID/groups/:groupID"] = Zotero.Server.LocalAPI.Group;


Zotero.Server.LocalAPI.Items = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	async run({ pathname, pathParams, searchParams, libraryID }) {
		let isTags = pathname.endsWith('/tags');
		if (isTags) {
			// Cut it off so other .endsWith() checks work
			pathname = pathname.slice(0, -5);
		}

		let search = new Zotero.Search();
		search.libraryID = libraryID;
		search.addCondition('noChildren', pathname.endsWith('/top') ? 'true' : 'false');
		if (pathParams.collectionKey) {
			search.addCondition('collectionID', 'is',
				Zotero.Collections.getIDFromLibraryAndKey(libraryID, pathParams.collectionKey));
		}
		else if (pathParams.itemKey) {
			// We'll filter out the parent later
			search.addCondition('key', 'is', pathParams.itemKey);
			search.addCondition('includeChildren', 'true');
		}
		else if (pathname.endsWith('/trash')) {
			search.addCondition('deleted', 'true');
		}
		else if (pathname.endsWith('/publications/items')) {
			search.addCondition('publications', 'true');
		}

		if (searchParams.get('includeTrashed') == '1' && !pathname.endsWith('/trash')) {
			search.addCondition('includeDeleted', 'true');
		}
		
		let savedSearch;
		if (pathParams.searchKey) {
			savedSearch = Zotero.Searches.getByLibraryAndKey(libraryID, pathParams.searchKey);
			if (!savedSearch) return _404;
			search.setScope(savedSearch);
		}
		
		if (searchParams.has('itemKey')) {
			let scope = new Zotero.Search();
			if (savedSearch) {
				scope.setScope(savedSearch);
			}
			scope.libraryID = libraryID;
			scope.addCondition('joinMode', 'any');
			let keys = new Set(searchParams.get('itemKey').split(','));
			for (let key of keys) {
				scope.addCondition('key', 'is', key);
			}
			search.setScope(scope);
		}

		let q = searchParams.get(isTags ? 'itemQ' : 'q');
		let qMode = searchParams.get(isTags ? 'itemQMode' : 'qmode');
		if (q) {
			search.addCondition('libraryID', 'is', libraryID);
			search.addCondition('quicksearch-' + (qMode || 'titleCreatorYear'), 'contains', q);
		}

		Zotero.debug('Executing local API search');
		Zotero.debug(search.toJSON());
		// Searches sometimes return duplicate IDs; de-duplicate first
		let uniqueResultIDs = [...new Set(await search.search())];
		let items = await Zotero.Items.getAsync(uniqueResultIDs);
		
		if (pathParams.itemKey) {
			// Filter out the parent, as promised
			items = items.filter(item => item.key != pathParams.itemKey);
		}

		// Now evaluate the API's search syntax on the search results
		items = evaluateSearchSyntax(
			searchParams.getAll('itemType'),
			items,
			(item, itemType) => item.itemType == itemType
		);
		items = evaluateSearchSyntax(
			searchParams.getAll(isTags ? 'itemTag' : 'tag'),
			items,
			(item, tag) => item.hasTag(tag)
		);
		
		if (isTags) {
			let unique = new Set();
			for (let item of items) {
				if (unique.has(item.id)) {
					Zotero.debug('NOT UNIQUE:')
					Zotero.debug(item)
				}
				unique.add(item.id)
			}
			let tmpTable = await Zotero.Search.idsToTempTable(items.map(item => item.id));
			let tags = await Zotero.Tags.getAllWithin({ tmpTable });
			
			let tagQ = searchParams.get('q');
			if (tagQ) {
				let pred = searchParams.get('qmode') == 'startsWith'
					? (tag => tag.tag.startsWith(tagQ))
					: (tag => tag.tag.includes(tagQ));
				tags = tags.filter(pred);
			}
			
			// getAllWithin() calls cleanData(), which discards type fields when they are 0
			// But we always want them, so add them back if necessary
			let json = await Zotero.Tags.toResponseJSON(libraryID,
				tags.map(tag => ({ ...tag, type: tag.type || 0 })));
			await Zotero.DB.queryAsync("DROP TABLE IF EXISTS " + tmpTable, [], { noCache: true });
			return [200, 'application/json', JSON.stringify(json, null, 4)];
		}
		
		return { data: items };
	}
};

// Add basic library-wide item endpoints
for (let topTrashPart of ['', '/top', '/trash']) {
	for (let tagsPart of ['', '/tags']) {
		for (let userGroupPart of ['/api/users/:userID', '/api/groups/:groupID']) {
			let path = userGroupPart + '/items' + topTrashPart + tagsPart;
			Zotero.Server.Endpoints[path] = Zotero.Server.LocalAPI.Items;
		}
	}
}

// Add collection-scoped item endpoints
for (let topPart of ['', '/top']) {
	for (let tagsPart of ['', '/tags']) {
		for (let userGroupPart of ['/api/users/:userID', '/api/groups/:groupID']) {
			let path = userGroupPart + '/collections/:collectionKey/items' + topPart + tagsPart;
			Zotero.Server.Endpoints[path] = Zotero.Server.LocalAPI.Items;
		}
	}
}

// Add the rest manually
Zotero.Server.Endpoints["/api/users/:userID/items/:itemKey/children"] = Zotero.Server.LocalAPI.Items;
Zotero.Server.Endpoints["/api/groups/:groupID/items/:itemKey/children"] = Zotero.Server.LocalAPI.Items;
Zotero.Server.Endpoints["/api/users/:userID/publications/items"] = Zotero.Server.LocalAPI.Items;
Zotero.Server.Endpoints["/api/users/:userID/publications/items/tags"] = Zotero.Server.LocalAPI.Items;
Zotero.Server.Endpoints["/api/users/:userID/searches/:searchKey/items"] = Zotero.Server.LocalAPI.Items;
Zotero.Server.Endpoints["/api/groups/:groupID/searches/:searchKey/items"] = Zotero.Server.LocalAPI.Items;

Zotero.Server.LocalAPI.Item = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	run({ pathParams, libraryID }) {
		let item = Zotero.Items.getByLibraryAndKey(libraryID, pathParams.itemKey);
		if (!item) return _404;
		return { data: item };
	}
};
Zotero.Server.Endpoints["/api/users/:userID/items/:itemKey"] = Zotero.Server.LocalAPI.Item;
Zotero.Server.Endpoints["/api/groups/:groupID/items/:itemKey"] = Zotero.Server.LocalAPI.Item;


Zotero.Server.LocalAPI.Searches = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	async run({ libraryID }) {
		let searches = await Zotero.Searches.getAll(libraryID);
		return { data: searches };
	}
};
Zotero.Server.Endpoints["/api/users/:userID/searches"] = Zotero.Server.LocalAPI.Searches;
Zotero.Server.Endpoints["/api/groups/:groupID/searches"] = Zotero.Server.LocalAPI.Searches;

Zotero.Server.LocalAPI.Search = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	async run({ pathParams, libraryID }) {
		let search = Zotero.Searches.getByLibraryAndKey(libraryID, pathParams.searchKey);
		if (!search) return _404;
		return { data: search };
	}
};
Zotero.Server.Endpoints["/api/users/:userID/searches/:searchKey"] = Zotero.Server.LocalAPI.Search;
Zotero.Server.Endpoints["/api/groups/:groupID/searches/:searchKey"] = Zotero.Server.LocalAPI.Search;


Zotero.Server.LocalAPI.Tags = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	async run({ libraryID }) {
		let tags = await Zotero.Tags.getAll(libraryID);
		let json = await Zotero.Tags.toResponseJSON(libraryID, tags);
		return [200, 'application/json', JSON.stringify(json, null, 4)];
	}
};
Zotero.Server.Endpoints["/api/users/:userID/tags"] = Zotero.Server.LocalAPI.Tags;
Zotero.Server.Endpoints["/api/groups/:groupID/tags"] = Zotero.Server.LocalAPI.Tags;

Zotero.Server.LocalAPI.Tag = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	async run({ pathParams, libraryID }) {
		let tag = decodeURIComponent(pathParams.tag.replaceAll('+', '%20'));
		let json = await Zotero.Tags.toResponseJSON(libraryID, [{ tag }]);
		if (!json) return _404;
		return [200, 'application/json', JSON.stringify(json, null, 4)];
	}
};
Zotero.Server.Endpoints["/api/users/:userID/tags/:tag"] = Zotero.Server.LocalAPI.Tag;
Zotero.Server.Endpoints["/api/groups/:groupID/tags/:tag"] = Zotero.Server.LocalAPI.Tag;


/**
 * Convert a {@link Zotero.DataObject}, or an array of DataObjects, to response JSON
 * 		with appropriate included data based on the 'include' query parameter.
 *
 * @param {Zotero.DataObject | Zotero.DataObject[]} dataObjectOrObjects
 * @param {URLSearchParams} searchParams
 * @returns {Promise<Object>}
 */
async function toResponseJSON(dataObjectOrObjects, searchParams) {
	if (Array.isArray(dataObjectOrObjects)) {
		return Promise.all(dataObjectOrObjects.map(o => toResponseJSON(o, searchParams)));
	}
	
	// Ask the data object for its response JSON representation, updating URLs to point to localhost
	let dataObject = dataObjectOrObjects;
	let responseJSON = dataObject.toResponseJSON({
		apiURL: `http://localhost:${Zotero.Prefs.get('httpServer.port')}/api/`,
		includeGroupDetails: true
	});
	
	// Add includes and remove 'data' if not requested
	let include = searchParams.has('include') ? searchParams.get('include') : 'data';
	let dataIncluded = false;
	for (let includeFormat of include.split(',')) {
		switch (includeFormat) {
			case 'bib':
				responseJSON.bib = await citeprocToHTML(dataObject, searchParams, false);
				break;
			case 'citation':
				responseJSON.citation = await citeprocToHTML(dataObject, searchParams, true);
				break;
			case 'data':
				dataIncluded = true;
				break;
			default:
				if (exportFormats.has(includeFormat)) {
					responseJSON[includeFormat] = await exportItems([dataObject], exportFormats.get(includeFormat));
				}
				else {
					// Ignore since we don't have a great way to propagate the error up
				}
		}
	}
	if (!dataIncluded) {
		delete responseJSON.data;
	}
	return responseJSON;
}

/**
 * Use citeproc to output HTML for an item or items.
 *
 * @param {Zotero.Item | Zotero.Item[]} itemOrItems
 * @param {URLSearchParams} searchParams
 * @param {Boolean} asCitationList
 * @returns {Promise<String>}
 */
async function citeprocToHTML(itemOrItems, searchParams, asCitationList) {
	let items = Array.isArray(itemOrItems)
		? itemOrItems
		: [itemOrItems];
	
	// Filter out attachments, annotations, and notes, which we can't generate citations for
	items = items.filter(item => item.isRegularItem());
	let styleID = searchParams.get('style') || 'chicago-note-bibliography';
	let locale = searchParams.get('locale') || 'en-US';
	let linkWrap = searchParams.get('linkwrap') == '1';
	
	if (!styleID.startsWith('http://www.zotero.org/styles/')) {
		styleID = 'http://www.zotero.org/styles/' + styleID;
	}
	let style = Zotero.Styles.get(styleID);
	if (!style) {
		// The client wants a style we don't have locally, so download it
		let url = styleID.replace('http', 'https');
		await Zotero.Styles.install({ url }, url, true);
		style = Zotero.Styles.get(styleID);
	}
	
	let cslEngine = style.getCiteProc(locale, 'html');
	cslEngine.opt.development_extensions.wrap_url_and_doi = linkWrap;
	return Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, 'html', asCitationList);
}

/**
 * Export items to a string with the given translator.
 *
 * @param {Zotero.Item[]} items
 * @param {String} translatorID
 * @returns {Promise<String>}
 */
function exportItems(items, translatorID) {
	return new Promise((resolve, reject) => {
		let translation = new Zotero.Translate.Export();
		translation.setItems(items.slice());
		translation.setTranslator(translatorID);
		translation.setHandler('done', () => {
			resolve(translation.string);
		});
		translation.setHandler('error', (_, error) => {
			reject(error);
		});
		translation.translate();
	});
}

/**
 * Evaluate the API's search syntax: https://www.zotero.org/support/dev/web_api/v3/basics#search_syntax
 *
 * @param {String[]} searchStrings The search strings provided by the client as query parameters
 * @param {Object[]} items The items to search on. Can be of any type.
 * @param {(item: Object, attribute: String) => Boolean} predicate Returns whether an item has an attribute.
 * 		For a call evaluating the 'tag' query parameter, for example, the predicate should return whether the item
 * 		has the attribute as one of its tags.
 * @returns {Object[]} A filtered array of items
 */
function evaluateSearchSyntax(searchStrings, items, predicate) {
	for (let searchString of searchStrings) {
		let negate = false;
		if (searchString[0] == '-') {
			negate = true;
			searchString = searchString.substring(1);
		}
		if (searchString[0] == '\\' && searchString[1] == '-') {
			searchString = searchString.substring(1);
		}
		let ors = searchString.split('||').map(or => or.trim());
		items = items.filter(item => ors.some(or => predicate(item, or) == !negate));
	}
	return items;
}
