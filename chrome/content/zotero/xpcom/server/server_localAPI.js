/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2026 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
					 https://digitalscholar.org
	
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

- Only API version 3 (https://www.zotero.org/support/dev/web_api/v3/basics) is supported, and only
  one API version will ever be supported at a time. If a new API version is released and your
  client needs to maintain support for older versions, first query /api/ and read the
  Zotero-API-Version response header, then make requests conditionally.
- No access to user data for users other than the local logged-in user. Use user ID 0 or the user's
  actual API user ID (https://www.zotero.org/settings/keys).
- Authentication works differently:
    - Read requests (GET) require no authentication.
    - Write requests (POST, PUT, PATCH, DELETE) must include a local API key, either using the
      Zotero-API-Key header (recommended) or the ?key= query parameter. A 401 is returned if
      the key is missing or unrecognized.

      Local API keys are unrelated to zotero.org API keys. They are obtained by POSTing to
      /api/authorize-local (a local-only endpoint with no web API analog) with a JSON body
      of the form { "appName": "<caller's display name>" }. This shows a modal with three
      buttons: "Allow" (one-time access), "Always Allow" (persistent access), and "Deny".
      On allow, the response is of the form:
        { "key": "<key>", "remember": <bool> }
      When the user picks "Allow" rather than "Always Allow", the key is single-use: the first
      write that successfully validates it consumes it. Local API consumers should always be
      prepared to handle a 401 response by reauthenticating.
- Minimal access to metadata about groups.
- Atom is not supported.
- Item type/field endpoints (https://www.zotero.org/support/dev/web_api/v3/types_and_fields) will
  return localized names in the user's locale. The locale query parameter is not supported. The
  single exception is /api/creatorFields, which follows the web API's behavior in always returning
  results in English, *not* the user's locale.
- If your code relies on any undefined behavior or especially unusual corner cases in the web API,
  it'll probably work differently when using the local API. This implementation is primarily
  concerned with matching the web API's spec and secondarily with matching its observed behavior,
  but it does not make any attempt to replicate implementation details that your code might rely on.
  Sort orders might differ, quicksearch results will probably differ, and JSON you get from the
  local API is never going to be exactly identical to what you would get from the web API.
- PATCH-style partial (binary diff) uploads are not implemented; clients should fall back to a
  full upload.

That said, there are benefits:

- Pagination is often unnecessary because the API doesn't mind sending you many megabytes of data
  at a time - nothing ever touches the network. For that reason, returned results are not limited
  by default (unlike in the web API, which has a default limit of 25 and will not return more than
  100 results at a time).
- For the same reason, no rate limits, and it's really fast.
- <userOrGroupPrefix>/searches/:searchKey/items returns the set of items matching a saved search
  (unlike in the web API, which doesn't support actually executing searches).

*/

const LOCAL_API_VERSION = 3;

// Maximum number of objects in a single write batch (mirrors dataserver $maxWriteItems, etc.)
const MAX_WRITE_OBJECTS = 50;

// Maximum number of keys in a multi-delete query parameter
const MAX_DELETE_OBJECTS = 50;

/**
 * @type {Map<string, number>} token -> expiryEpochMs
 */
const WRITE_TOKEN_CACHE = new Map();
const WRITE_TOKEN_CACHE_SECONDS = 12 * 60 * 60;

/**
 * In-progress file uploads.
 * @type {Map<any, {
 *     libraryID: number;
 *     itemKey: string;
 *     md5: string;
 *     filename: string;
 *     filesize: string;
 *     mtime: number;
 *     contentType: string;
 *     charset: string | null;
 *     uploaded: boolean;
 *     expires: number;
 * }>}
 */
const PENDING_UPLOADS = new Map();
const UPLOAD_KEY_TTL_SECONDS = 60 * 60;

// Rate-limiting state for /api/authorize-local. Each entry is a timestamp (ms)
// for a request that resulted in (or would result in) a confirmation prompt.
// When the window holds AUTHORIZE_RATE_LIMIT_MAX entries that are all less
// than AUTHORIZE_RATE_LIMIT_WINDOW_MS old, further requests are rejected with
// 429 + Retry-After until the oldest entry ages out.
const AUTHORIZE_RATE_LIMIT_MAX = 5;
const AUTHORIZE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

let _localAPIKeysCache = null;

function _localAPIKeysPath() {
	return PathUtils.join(Zotero.Profile.dir, 'localAPIKeys.json');
}

async function _loadLocalAPIKeys() {
	if (_localAPIKeysCache) return _localAPIKeysCache;
	let path = _localAPIKeysPath();
	try {
		if (!(await IOUtils.exists(path))) {
			_localAPIKeysCache = [];
			return _localAPIKeysCache;
		}
		let text = await IOUtils.readUTF8(path);
		let data = JSON.parse(text);
		_localAPIKeysCache = Array.isArray(data.keys) ? data.keys : [];
	}
	catch (e) {
		Zotero.logError(e);
		_localAPIKeysCache = [];
	}
	return _localAPIKeysCache;
}

async function _saveLocalAPIKeys() {
	if (!_localAPIKeysCache) return;
	let path = _localAPIKeysPath();
	let json = JSON.stringify({ keys: _localAPIKeysCache }, null, 4);
	await IOUtils.writeUTF8(path, json);
}

/**
 * Register a new local API key. If remember is true, the key persists and can
 * be reused indefinitely; otherwise the next successful use will consume it.
 *
 * @returns {Promise<string>} The newly generated key
 */
async function addLocalAPIKey(appName, remember) {
	let keys = await _loadLocalAPIKeys();
	let key = Zotero.Utilities.randomString(32);
	keys.push({
		key,
		appName: typeof appName === 'string' ? appName : '',
		remember: !!remember,
		createdAt: new Date().toISOString(),
	});
	await _saveLocalAPIKeys();
	return key;
}

/**
 * Look up a candidate API key. If valid, single-use keys (non-"remember") are deleted
 * before being returned.
 * Returns null if the key isn't registered.
 */
async function consumeLocalAPIKey(key) {
	if (!key) return null;
	let keys = await _loadLocalAPIKeys();
	let idx = keys.findIndex(k => k.key === key);
	if (idx === -1) return null;
	let entry = keys[idx];
	if (entry.remember) {
		return entry;
	}
	// Mark used immediately to prevent race conditions
	keys.splice(idx, 1);
	await _saveLocalAPIKeys();
	return entry;
}

let _authorizeTimestamps = [];

/**
 * Record a confirmation-requiring request and check whether the rate limit has
 * been exceeded. Returns the number of seconds until the next slot is available
 * when the caller should be rejected with 429, or 0 when the request may proceed.
 */
function checkAuthorizeRateLimit() {
	let now = Date.now();
	_authorizeTimestamps = _authorizeTimestamps.filter(t => now - t < AUTHORIZE_RATE_LIMIT_WINDOW_MS);
	if (_authorizeTimestamps.length >= AUTHORIZE_RATE_LIMIT_MAX) {
		let oldest = _authorizeTimestamps[0];
		let waitMS = AUTHORIZE_RATE_LIMIT_WINDOW_MS - (now - oldest);
		return Math.max(1, Math.ceil(waitMS / 1000));
	}
	_authorizeTimestamps.push(now);
	return 0;
}

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
		if (!Zotero.Prefs.get('httpServer.localAPI.enabled')) {
			return this.makeResponse(403, 'text/plain', 'Local API is not enabled');
		}
		requestData.headers = new Headers(requestData.headers);
		try {
			return await this._initInternal(requestData);
		}
		catch (e) {
			if (e instanceof HTTPError) {
				return this.makeResponse(e.status, 'text/plain', e.message);
			}
			throw e;
		}
	}

	async _initInternal(requestData) {
		let apiVersion = parseInt(
			requestData.headers.get('Zotero-API-Version')
				|| requestData.searchParams.get('v')
				|| LOCAL_API_VERSION
		);
		// Only allow mismatched version on /api/ no-op endpoint
		if (apiVersion !== LOCAL_API_VERSION && requestData.pathname != '/api/') {
			return this.makeResponse(501, 'text/plain', `API version not implemented: ${apiVersion}`);
		}
		
		let userID = requestData.pathParams.userID && parseInt(requestData.pathParams.userID);
		if (userID !== undefined
				&& userID != 0
				&& userID != Zotero.Users.getCurrentUserID()) {
			let suffix = "";
			let currentUserID = Zotero.Users.getCurrentUserID();
			if (currentUserID) {
				suffix += " or " + currentUserID;
			}
			return this.makeResponse(400, 'text/plain', 'Only data for the logged-in user is available locally -- use userID 0' + suffix);
		}
		
		if (requestData.pathParams.groupID) {
			let groupID = requestData.pathParams.groupID;
			let libraryID = Zotero.Groups.getLibraryIDFromGroupID(parseInt(groupID));
			if (!libraryID) {
				return this.makeResponse(404, 'text/plain', 'Not found');
			}
			requestData.libraryID = libraryID;
		}
		else {
			requestData.libraryID = Zotero.Libraries.userLibraryID;
		}
		
		let library = Zotero.Libraries.get(requestData.libraryID);
		if (!library.getDataLoaded('item')) {
			Zotero.debug("Waiting for items to load for library " + library.libraryID);
			await library.waitForDataLoad('item');
		}
		
		let isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(requestData.method);
		if (isWriteMethod) {
			let authResponse = await this._authenticateWriteRequest(requestData);
			if (authResponse) return authResponse;

			if (!library.editable) {
				return this.makeResponse(403, 'text/plain', 'Write access denied');
			}

			let response = await this.run(requestData);
			if (Array.isArray(response)) {
				return this.makeResponse(...response);
			}
			throw new Error("Write endpoint did not return an HTTP response array");
		}

		let response = await this.run(requestData);
		if (response.data) {
			let dataIsArray = Array.isArray(response.data);
			if (dataIsArray && requestData.searchParams.has('since')) {
				let since = parseInt(requestData.searchParams.get('since'));
				if (Number.isNaN(since)) {
					return this.makeResponse(400, 'text/plain', `Invalid 'since' value '${requestData.searchParams.get('since')}'`);
				}
				if (since !== 0) {
					response.data = response.data.filter(dataObject => dataObject.clientVersion > since);
				}
			}
			
			if (dataIsArray && response.data.length > 1) {
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
			
			let totalResults = 1;
			let links;
			if (dataIsArray) {
				totalResults = response.data.length;
				let start = parseInt(requestData.searchParams.get('start')) || 0;
				if (start < 0) start = 0;
				if (start >= response.data.length) start = response.data.length;
				let limit = parseInt(requestData.searchParams.get('limit')) || response.data.length - start;
				if (limit < 0) limit = 0;
				response.data = response.data.slice(start, start + limit);
				
				links = this.buildLinks(requestData, start, limit, totalResults);
			}
			else {
				links = this.buildLinks(requestData, 0, 0, 1);
			}
			
			let headers = {
				'Total-Results': totalResults,
				Link: Object.entries(links).map(([rel, url]) => `<${url}>; rel="${rel}"`).join(', ')
			};
			let lastModifiedVersion = dataIsArray
				? Zotero.Libraries.get(requestData.libraryID).clientVersion
				: response.data.clientVersion;
			if (lastModifiedVersion !== undefined) {
				headers['Last-Modified-Version'] = lastModifiedVersion;
			}
			let ifModifiedSinceVersion = requestData.headers.get('If-Modified-Since-Version');
			if (ifModifiedSinceVersion) {
				ifModifiedSinceVersion = parseInt(ifModifiedSinceVersion);
				if (ifModifiedSinceVersion !== 0 && lastModifiedVersion <= ifModifiedSinceVersion) {
					return this.makeResponse(304, headers, '');
				}
			}
			return this.makeDataObjectResponse(requestData, response.data, headers);
		}
		else {
			return this.makeResponse(...response);
		}
	}

	/**
	 * Build an object mapping link 'rel' attributes to URLs for the given request data and response info.
	 *
	 * @param {Object} requestData
	 * @param {Number} start
	 * @param {Number} limit
	 * @param {Number} totalResults
	 * @returns {Object}
	 */
	buildLinks(requestData, start, limit, totalResults) {
		let links = {};
		
		let buildURL = (searchParams) => {
			let url = new URL(requestData.pathname, 'http://' + requestData.headers.get('Host'));
			url.search = searchParams.toString();
			return url.toString();
		};

		// Logic adapted from https://github.com/zotero/dataserver/blob/18443360/model/API.inc.php#L588-L642
		// first
		if (start) {
			let p = new URLSearchParams(requestData.searchParams);
			p.delete('start');
			links.first = buildURL(p);
		}
		// prev
		if (start) {
			let p = new URLSearchParams(requestData.searchParams);
			let prevStart = start - limit;
			if (prevStart <= 0) {
				p.delete('start');
			}
			else {
				p.set('start', prevStart.toString());
			}
			links.prev = buildURL(p);
		}
		// last
		if (!start && limit >= totalResults) {
			let p = new URLSearchParams(requestData.searchParams);
			links.last = buildURL(p);
		}
		else if (limit) {
			let lastStart;
			if (start >= totalResults) {
				lastStart = totalResults - limit;
			}
			else {
				lastStart = totalResults - totalResults % limit;
				if (lastStart == totalResults) {
					lastStart = totalResults - limit;
				}
			}
			let p = new URLSearchParams(requestData.searchParams);
			if (lastStart > 0) {
				p.set('start', lastStart.toString());
			}
			else {
				p.delete('start');
			}
			links.last = buildURL(p);

			// next
			let nextStart = start + limit;
			if (nextStart < totalResults) {
				p.set('start', nextStart.toString());
				links.next = buildURL(p);
			}
		}

		// alternate: only include if logged in, cut off '/api/', replace userID 0 with current userID
		if (Zotero.Users.getCurrentUserID()) {
			links.alternate = ZOTERO_CONFIG.WWW_BASE_URL + requestData.pathname.substring(5)
				.replace('users/0/', `users/${Zotero.Users.getCurrentUserID()}/`);
		}
		
		return links;
	}

	/**
	 * @param {Object} requestData Passed to {@link init}
	 * @param {Zotero.DataObject | Zotero.DataObject[]} dataObjectOrObjects
	 * @param {Object} headers
	 * @returns {Promise} A response to be returned from {@link init}
	 */
	async makeDataObjectResponse(requestData, dataObjectOrObjects, headers) {
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
				body = dataObjectOrObjects.map(o => o.key).join('\n');
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
		return this.makeResponse(200, { ...headers, 'Content-Type': contentType }, body);
	}

	/**
	 * Make an HTTP response array with API headers.
	 *
	 * @param {Number} status
	 * @param {string | Object} contentTypeOrHeaders
	 * @param {string} body
	 * @returns {number | string | object}
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

	/**
	 * Validate the caller's local API key. The key may be provided either via
	 * the Zotero-API-Key header or the ?key= query parameter.
	 *
	 * Returns null when the request is authorized to proceed, or an HTTP
	 * response array when it should be rejected. Keys are obtained by callers
	 * via POST /api/authorize-local; single-use keys are consumed (deleted
	 * from the persistent store) here.
	 *
	 * @param {Object} requestData
	 * @returns {Promise<null | [Number, (String | Object), String]>}
	 */
	async _authenticateWriteRequest(requestData) {
		let key = requestData.headers.get('Zotero-API-Key')
			|| requestData.searchParams.get('key')
			|| '';
		if (!key) {
			return [
				401,
				{
					'Content-Type': 'text/plain',
					'WWW-Authenticate': 'Zotero-API-Key realm="Zotero Local API"',
				},
				'API key required -- POST /api/authorize-local to obtain one'
			];
		}
		let entry = await consumeLocalAPIKey(key);
		if (!entry) {
			return [401, 'text/plain', 'Invalid or expired API key'];
		}
		requestData.apiKey = entry;
		return null;
	}

	/**
	 * Validate the Zotero-Write-Token header (5-32 chars). If present, check that it
	 * hasn't been used for a successful write within the last 12 hours; otherwise,
	 * return a 412 response. The caller must invoke {@link _recordWriteToken()}
	 * after the write succeeds.
	 *
	 * @param {object} requestData
	 * @returns {string | null} The validated token, or null if not provided
	 * @throws HTTPError on invalid or duplicate token
	 */
	_checkWriteToken(requestData) {
		let token = requestData.headers.get('Zotero-Write-Token');
		if (!token) return null;
		if (token.length < 5 || token.length > 32) {
			throw new HTTPError(400, "Write token must be 5-32 characters in length");
		}
		pruneExpired(WRITE_TOKEN_CACHE);
		if (WRITE_TOKEN_CACHE.has(token)) {
			throw new HTTPError(412, "Write token already used");
		}
		return token;
	}

	_recordWriteToken(token) {
		if (!token) return;
		WRITE_TOKEN_CACHE.set(token, Date.now() + WRITE_TOKEN_CACHE_SECONDS * 1000);
	}

	/**
	 * Parse and validate If-Unmodified-Since-Version against the library's clientVersion.
	 *
	 * @param {Object} requestData
	 * @param {Object} options
	 * @param {Boolean} [options.required] If true and the header is missing, throw 428
	 * @throws HTTPError on missing/invalid/out-of-date version
	 */
	_checkLibraryIfUnmodifiedSinceVersion(requestData, { required = false } = {}) {
		let header = requestData.headers.get('If-Unmodified-Since-Version');
		if (header === null) {
			if (required) {
				throw new HTTPError(428, "If-Unmodified-Since-Version not provided");
			}
			return;
		}
		let value = parseInt(header);
		if (Number.isNaN(value) || value < 0) {
			throw new HTTPError(400, "Invalid If-Unmodified-Since-Version value");
		}
		let library = Zotero.Libraries.get(requestData.libraryID);
		if (library.clientVersion > value) {
			throw new HTTPError(412, `Library has been modified since specified version (expected ${value}, found ${library.clientVersion})`);
		}
	}

	/**
	 * Parse a JSON body. Accepts either an already-parsed object (when content-type
	 * was application/json) or a string. Throws HTTPError(400) on parse failure.
	 */
	_parseJSONBody(data) {
		if (data === null || data === undefined || data === '') {
			throw new HTTPError(400, "Empty request body");
		}
		// Reject binary bodies on JSON endpoints
		if (data instanceof Ci.nsIInputStream) {
			throw new HTTPError(400, "Content-Type must be application/json");
		}
		if (typeof data === 'object') {
			return data;
		}
		try {
			return JSON.parse(data);
		}
		catch (e) {
			throw new HTTPError(400, "Invalid JSON: " + e.message);
		}
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

/**
 * Local-only authorization endpoint. Has no analog in the web API. Callers
 * that receive a 401 from a write endpoint should POST here with their app
 * name; the user is shown a dialog and can grant or deny access. On grant,
 * the response includes a 32-character key the caller must pass on subsequent
 * write requests via the Zotero-API-Key header (or ?key= query parameter).
 *
 * If the user picked "Allow" rather than "Always Allow", the returned key
 * will be invalidated after its first successful use.
 */
Zotero.Server.LocalAPI.AuthorizeLocal = class extends LocalAPIEndpoint {
	supportedMethods = ['POST'];
	
	supportedDataTypes = ['application/json'];

	async _initInternal(requestData) {
		let body = requestData.data;
		if (!body
				|| typeof body !== 'object'
				|| Array.isArray(body)
				|| typeof body.appName !== 'string'
				|| !body.appName.trim()) {
			return this.makeResponse(400, 'text/plain', 'appName is required');
		}
		let appName = body.appName.trim();

		let retryAfter = checkAuthorizeRateLimit();
		if (retryAfter > 0) {
			return this.makeResponse(
				429,
				{
					'Content-Type': 'text/plain',
					'Retry-After': String(retryAfter),
				},
				'Too many authorization requests'
			);
		}

		let { allow, remember } = await Zotero.Server.LocalAPI._promptForAuthorization(appName);
		if (!allow) {
			return this.makeResponse(
				403,
				'application/json',
				JSON.stringify({ denied: true })
			);
		}

		let key = await addLocalAPIKey(appName, remember);
		return this.makeResponse(
			200,
			'application/json',
			JSON.stringify({ key, remember: !!remember })
		);
	}
};
Zotero.Server.Endpoints["/api/authorize-local"] = Zotero.Server.LocalAPI.AuthorizeLocal;

Zotero.Server.LocalAPI.Schema = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	async run(_) {
		return [200, 'application/json', await Zotero.File.getContentsFromURLAsync('resource://zotero/schema/global/schema.json')];
	}
};
Zotero.Server.Endpoints["/api/schema"] = Zotero.Server.LocalAPI.Schema;

Zotero.Server.LocalAPI.ItemTypes = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	run(_) {
		let itemTypes = Zotero.ItemTypes.getAll().map((type) => {
			return {
				itemType: type.name,
				localized: Zotero.ItemTypes.getLocalizedString(type.name)
			};
		});
		return [200, 'application/json', JSON.stringify(itemTypes, null, 4)];
	}
};
Zotero.Server.Endpoints["/api/itemTypes"] = Zotero.Server.LocalAPI.ItemTypes;

Zotero.Server.LocalAPI.ItemFields = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	run(_) {
		let itemFields = Zotero.ItemFields.getAll().map((field) => {
			return {
				field: field.name,
				localized: Zotero.ItemFields.getLocalizedString(field.name)
			};
		});
		return [200, 'application/json', JSON.stringify(itemFields, null, 4)];
	}
};
Zotero.Server.Endpoints["/api/itemFields"] = Zotero.Server.LocalAPI.ItemFields;

Zotero.Server.LocalAPI.ItemTypeFields = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	run({ searchParams }) {
		let itemType = searchParams.get('itemType');
		if (!itemType || !Zotero.ItemTypes.getID(itemType)) {
			return [400, 'text/plain', "Invalid or missing 'itemType' value"];
		}
		let itemFields = Zotero.ItemFields.getItemTypeFields(Zotero.ItemTypes.getID(itemType))
			.map((fieldID) => {
				return {
					field: Zotero.ItemFields.getName(fieldID),
					localized: Zotero.ItemFields.getLocalizedString(fieldID)
				};
			});
		return [200, 'application/json', JSON.stringify(itemFields, null, 4)];
	}
};
Zotero.Server.Endpoints["/api/itemTypeFields"] = Zotero.Server.LocalAPI.ItemTypeFields;

Zotero.Server.LocalAPI.ItemTypeCreatorTypes = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	run({ searchParams }) {
		let itemType = searchParams.get('itemType');
		if (!itemType || !Zotero.ItemTypes.getID(itemType)) {
			return [400, 'text/plain', "Invalid or missing 'itemType' value"];
		}
		let creatorTypes = Zotero.CreatorTypes.getTypesForItemType(Zotero.ItemTypes.getID(itemType))
			.map((creatorType) => {
				return {
					creatorType: creatorType.name,
					localized: creatorType.localizedName
				};
			});
		return [200, 'application/json', JSON.stringify(creatorTypes, null, 4)];
	}
};
Zotero.Server.Endpoints["/api/itemTypeCreatorTypes"] = Zotero.Server.LocalAPI.ItemTypeCreatorTypes;

Zotero.Server.LocalAPI.CreatorFields = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	run(_) {
		let creatorFields = [
			{ field: 'firstName', localized: 'First' },
			{ field: 'lastName', localized: 'Last' },
			{ field: 'name', localized: 'Name' }
		];
		return [200, 'application/json', JSON.stringify(creatorFields, null, 4)];
	}
};
Zotero.Server.Endpoints["/api/creatorFields"] = Zotero.Server.LocalAPI.CreatorFields;


Zotero.Server.LocalAPI.Settings = class extends LocalAPIEndpoint {
	supportedMethods = ['GET'];

	run(_) {
		return [200, 'application/json', '{}'];
	}
};
Zotero.Server.Endpoints["/api/users/:userID/settings"] = Zotero.Server.LocalAPI.Settings;


Zotero.Server.LocalAPI.Collections = class extends LocalAPIEndpoint {
	supportedMethods = ['GET', 'POST', 'DELETE'];

	async run(requestData) {
		const WRITE_PATH_RE = /^\/api\/(?:users|groups)\/[^/]+\/collections\/?$/;
		if (requestData.method === 'POST') {
			if (!WRITE_PATH_RE.test(requestData.pathname)) {
				return [405, 'text/plain', 'Method not allowed for this path'];
			}
			return writeMultipleObjects(this, requestData, 'collection');
		}
		if (requestData.method === 'DELETE') {
			if (!WRITE_PATH_RE.test(requestData.pathname)) {
				return [405, 'text/plain', 'Method not allowed for this path'];
			}
			return deleteMultipleObjects(this, requestData, 'collection', 'collectionKey');
		}
		let { pathname, pathParams, libraryID } = requestData;
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
	supportedMethods = ['GET', 'PUT', 'PATCH', 'DELETE'];

	async run(requestData) {
		if (requestData.method === 'PUT' || requestData.method === 'PATCH') {
			return writeSingleObject(this, requestData, 'collection', requestData.method === 'PATCH');
		}
		if (requestData.method === 'DELETE') {
			return deleteSingleObject(this, requestData, 'collection');
		}
		let { pathParams, libraryID } = requestData;
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
	supportedMethods = ['GET', 'POST', 'DELETE'];

	async run(requestData) {
		const WRITE_PATH_RE = /^\/api\/(?:users|groups)\/[^/]+\/items\/?$/;
		if (requestData.method === 'POST') {
			if (!WRITE_PATH_RE.test(requestData.pathname)) {
				return [405, 'text/plain', 'Method not allowed for this path'];
			}
			return writeMultipleObjects(this, requestData, 'item');
		}
		if (requestData.method === 'DELETE') {
			if (!WRITE_PATH_RE.test(requestData.pathname)) {
				return [405, 'text/plain', 'Method not allowed for this path'];
			}
			return deleteMultipleObjects(this, requestData, 'item', 'itemKey');
		}
		return this._runGet(requestData);
	}

	async _runGet({ pathname, pathParams, searchParams, libraryID }) {
		let isTags = pathname.endsWith('/tags');
		if (isTags) {
			// Cut it off so other .endsWith() checks work
			pathname = pathname.slice(0, -5);
		}
		let isTop = pathname.endsWith('/top');
		if (isTop) {
			pathname = pathname.slice(0, -4);
		}

		let search = new Zotero.Search();
		search.libraryID = libraryID;
		
		if (isTop) {
			search.addCondition('noChildren', 'true');
		}
		else {
			search.addCondition('includeChildren', 'true');
		}
		
		if (pathParams.collectionKey) {
			search.addCondition('itemType', 'isNot', 'annotation');
			search.addCondition('collectionID', 'is',
				Zotero.Collections.getIDFromLibraryAndKey(libraryID, pathParams.collectionKey));
		}
		else if (pathParams.itemKey) {
			// We'll filter out the parent later
			search.addCondition('key', 'is', pathParams.itemKey);
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
			search.setScope(savedSearch, true);
		}
		
		if (searchParams.has('itemKey')) {
			let scope = new Zotero.Search();
			if (savedSearch) {
				scope.setScope(savedSearch, true);
			}
			scope.libraryID = libraryID;
			scope.addCondition('joinMode', 'any');
			let keys = new Set(searchParams.get('itemKey').split(','));
			for (let key of keys) {
				scope.addCondition('key', 'is', key);
			}
			search.setScope(scope, true);
		}

		let q = searchParams.get(isTags ? 'itemQ' : 'q');
		let qMode = searchParams.get(isTags ? 'itemQMode' : 'qmode');
		if (q) {
			search.addCondition('libraryID', 'is', libraryID);
			search.addCondition('quicksearch-' + (qMode || 'titleCreatorYear'), 'contains', q);
		}

		// Add conditions that use the API search syntax
		search = buildSearchFromSearchSyntax(
			search,
			searchParams.getAll('itemType'),
			'itemType'
		);
		search = buildSearchFromSearchSyntax(
			search,
			searchParams.getAll(isTags ? 'itemTag' : 'tag'),
			'tag'
		);

		Zotero.debug('Executing local API search');
		Zotero.debug(searchToDebugJSON(search));
		// Searches sometimes return duplicate IDs; de-duplicate first
		// TODO: Fix in search.js
		let uniqueResultIDs = [...new Set(await search.search())];
		let items = await Zotero.Items.getAsync(uniqueResultIDs);
		
		if (pathParams.itemKey) {
			// Filter out the parent, as promised
			items = items.filter(item => item.key != pathParams.itemKey);
		}

		if (isTags) {
			let tmpTable = await Zotero.Search.idsToTempTable(items.map(item => item.id));
			try {
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
				return { data: json };
			}
			finally {
				await Zotero.DB.queryAsync("DROP TABLE IF EXISTS " + tmpTable, [], { noCache: true });
			}
		}
		
		return { data: items };
	}
};

// Add basic library-wide item endpoints
for (let trashPart of ['', '/trash']) {
	for (let topPart of ['', '/top']) {
		for (let tagsPart of ['', '/tags']) {
			for (let userGroupPart of ['/api/users/:userID', '/api/groups/:groupID']) {
				let path = userGroupPart + '/items' + trashPart + topPart + tagsPart;
				Zotero.Server.Endpoints[path] = Zotero.Server.LocalAPI.Items;
			}
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
Zotero.Server.Endpoints["/api/users/:userID/publications/items/top"] = Zotero.Server.LocalAPI.Items;
Zotero.Server.Endpoints["/api/users/:userID/publications/items/tags"] = Zotero.Server.LocalAPI.Items;
Zotero.Server.Endpoints["/api/users/:userID/searches/:searchKey/items"] = Zotero.Server.LocalAPI.Items;
Zotero.Server.Endpoints["/api/groups/:groupID/searches/:searchKey/items"] = Zotero.Server.LocalAPI.Items;

Zotero.Server.LocalAPI.Item = class extends LocalAPIEndpoint {
	supportedMethods = ['GET', 'PUT', 'PATCH', 'DELETE'];

	async run(requestData) {
		if (requestData.method === 'PUT' || requestData.method === 'PATCH') {
			return writeSingleObject(this, requestData, 'item', requestData.method === 'PATCH');
		}
		if (requestData.method === 'DELETE') {
			return deleteSingleObject(this, requestData, 'item');
		}
		let { pathParams, libraryID } = requestData;
		let item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, pathParams.itemKey);
		if (!item) return _404;
		return { data: item };
	}
};
Zotero.Server.Endpoints["/api/users/:userID/items/:itemKey"] = Zotero.Server.LocalAPI.Item;
Zotero.Server.Endpoints["/api/groups/:groupID/items/:itemKey"] = Zotero.Server.LocalAPI.Item;


Zotero.Server.LocalAPI.ItemFile = class extends LocalAPIEndpoint {
	supportedMethods = ['GET', 'POST', 'PATCH'];

	async run(requestData) {
		let { method, pathname, pathParams, libraryID } = requestData;
		if (method === 'POST') {
			if (pathname.endsWith('/view') || pathname.endsWith('/url')) {
				return [405, 'text/plain', 'Method not allowed for this path'];
			}
			return handleFileWrite(this, requestData);
		}
		if (method === 'PATCH') {
			if (pathname.endsWith('/view') || pathname.endsWith('/url')) {
				return [405, 'text/plain', 'Method not allowed for this path'];
			}
			// Partial uploads (binary diffs) aren't supported locally; the
			// client should fall back to a full upload (per dataserver docs).
			return [405, 'text/plain', 'Partial uploads are not supported by the local API'];
		}
		let item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, pathParams.itemKey);
		if (!item) return _404;
		if (!item.isFileAttachment()) {
			return [400, 'text/plain', `Not a file attachment: ${item.key}`];
		}
		if (pathname.endsWith('/url')) {
			return [200, 'text/plain', item.getLocalFileURL()];
		}
		return [302, { Location: item.getLocalFileURL() }, ''];
	}
};
Zotero.Server.Endpoints["/api/users/:userID/items/:itemKey/file"] = Zotero.Server.LocalAPI.ItemFile;
Zotero.Server.Endpoints["/api/groups/:groupID/items/:itemKey/file"] = Zotero.Server.LocalAPI.ItemFile;
Zotero.Server.Endpoints["/api/users/:userID/items/:itemKey/file/view"] = Zotero.Server.LocalAPI.ItemFile;
Zotero.Server.Endpoints["/api/groups/:groupID/items/:itemKey/file/view"] = Zotero.Server.LocalAPI.ItemFile;
Zotero.Server.Endpoints["/api/users/:userID/items/:itemKey/file/view/url"] = Zotero.Server.LocalAPI.ItemFile;
Zotero.Server.Endpoints["/api/groups/:groupID/items/:itemKey/file/view/url"] = Zotero.Server.LocalAPI.ItemFile;

/**
 * Local-only endpoint that receives the raw bytes for a previously authorized
 * upload (the URL returned in the authorize phase). Writes the file directly
 * into the attachment's storage directory.
 */
Zotero.Server.LocalAPI.UploadReceiver = class extends LocalAPIEndpoint {
	supportedMethods = ['POST'];

	// Required so the post-write block doesn't insist on a library write check
	async _initInternal(requestData) {
		try {
			if (!Zotero.Prefs.get('httpServer.localAPI.enabled')) {
				return this.makeResponse(403, 'text/plain', 'Local API is not enabled');
			}
			requestData.headers = new Headers(requestData.headers);

			let uploadKey = requestData.pathParams.uploadKey;
			pruneExpired(PENDING_UPLOADS);
			let upload = PENDING_UPLOADS.get(uploadKey);
			if (!upload) {
				return this.makeResponse(404, 'text/plain', 'Unknown or expired upload key');
			}

			let data = requestData.data;
			let bytes;
			if (data instanceof Ci.nsIInputStream) {
				let binaryStream = Cc["@mozilla.org/binaryinputstream;1"]
					.createInstance(Ci.nsIBinaryInputStream);
				binaryStream.setInputStream(data);
				let available = binaryStream.available();
				bytes = new Uint8Array(binaryStream.readByteArray(available));
			}
			else if (typeof data === 'string') {
				// Best effort: text-decoded body. Will produce a corrupted file
				// for true binary content -- the client should send a binary
				// content-type so the server hands us the raw stream.
				let encoder = new TextEncoder();
				bytes = encoder.encode(data);
			}
			else {
				return this.makeResponse(400, 'text/plain', 'No file content provided');
			}

			let item = await Zotero.Items.getByLibraryAndKeyAsync(upload.libraryID, upload.itemKey);
			if (!item || !item.isFileAttachment()) {
				PENDING_UPLOADS.delete(uploadKey);
				return this.makeResponse(404, 'text/plain', 'Attachment item no longer exists');
			}

			let dir = Zotero.Attachments.getStorageDirectory(item);
			await IOUtils.makeDirectory(dir.path, { ignoreExisting: true });
			let destPath = PathUtils.join(dir.path, upload.filename);
			await IOUtils.write(destPath, bytes);

			// Verify the actual md5 matches what was claimed in the authorize phase.
			let actualMD5 = await Zotero.Utilities.Internal.md5Async(destPath);
			if (actualMD5 !== upload.md5) {
				await IOUtils.remove(destPath, { ignoreAbsent: true });
				PENDING_UPLOADS.delete(uploadKey);
				return this.makeResponse(400, 'text/plain',
					`File MD5 does not match expected (got ${actualMD5}, expected ${upload.md5})`);
			}

			upload.uploaded = true;
			return this.makeResponse(201, 'text/plain', '');
		}
		catch (e) {
			Zotero.logError(e);
			return this.makeResponse(500, 'text/plain', 'Upload failed: ' + e.message);
		}
	}
};
Zotero.Server.Endpoints["/api/local/uploads/:uploadKey"] = Zotero.Server.LocalAPI.UploadReceiver;


// Mirrors dataserver's Zotero_API::$maxWriteFullText
const MAX_WRITE_FULLTEXT = 10;

/**
 * Validate a single fulltext write payload. Throws HTTPError(400) on failure.
 */
function validateFullTextItemBody(body) {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		throw new HTTPError(400, 'Body must be a JSON object');
	}
	if (typeof body.content !== 'string') {
		throw new HTTPError(400, "'content' must be a string");
	}
	for (let stat of ['indexedChars', 'totalChars', 'indexedPages', 'totalPages']) {
		if (body[stat] !== undefined && body[stat] !== null && !Number.isInteger(body[stat])) {
			throw new HTTPError(400, `'${stat}' must be an integer`);
		}
	}
}

Zotero.Server.LocalAPI.ItemFullText = class extends LocalAPIEndpoint {
	supportedMethods = ['GET', 'PUT'];

	supportedDataTypes = ['application/json'];

	async run(requestData) {
		let { pathParams, libraryID, data } = requestData;
		if (requestData.method === 'PUT') {
			let body;
			try {
				body = this._parseJSONBody(data);
				validateFullTextItemBody(body);
			}
			catch (e) {
				if (e instanceof HTTPError) return [e.status, 'text/plain', e.message];
				throw e;
			}

			let newVersion;
			try {
				newVersion = await storeItemFullText(libraryID, pathParams.itemKey, body);
			}
			catch (e) {
				if (e instanceof HTTPError) return [e.status, 'text/plain', e.message];
				throw e;
			}

			return [
				204,
				{ 'Last-Modified-Version': newVersion },
				''
			];
		}

		let item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, pathParams.itemKey);
		if (!item || !item.isFileAttachment() || !Zotero.Fulltext.isCachedMIMEType(item.attachmentContentType)) {
			return _404;
		}
		let file = Zotero.Fulltext.getItemCacheFile(item);
		if (!file.exists()) {
			return _404;
		}
		let { indexedPages, totalPages, indexedChars, totalChars, version } = await Zotero.DB.rowQueryAsync(
			"SELECT indexedPages, totalPages, indexedChars, totalChars, version FROM fulltextItems WHERE itemID=?",
			item.id
		);
		return [
			200,
			{
				'Content-Type': 'application/json',
				'Last-Modified-Version': version,
			},
			JSON.stringify(
				{
					content: await Zotero.File.getContentsAsync(file),
					indexedPages: indexedPages ?? undefined,
					totalPages: totalPages ?? undefined,
					indexedChars: indexedChars ?? undefined,
					totalChars: totalChars ?? undefined,
				},
				null,
				4
			)
		];
	}
};
Zotero.Server.Endpoints["/api/users/:userID/items/:itemKey/fulltext"] = Zotero.Server.LocalAPI.ItemFullText;
Zotero.Server.Endpoints["/api/groups/:groupID/items/:itemKey/fulltext"] = Zotero.Server.LocalAPI.ItemFullText;


Zotero.Server.LocalAPI.FullText = class extends LocalAPIEndpoint {
	supportedMethods = ['GET', 'POST'];

	supportedDataTypes = ['application/json'];

	async run(requestData) {
		if (requestData.method === 'POST') {
			return writeBulkFullText(this, requestData);
		}
		let { searchParams, libraryID } = requestData;
		let since = parseInt(searchParams.get('since'));
		if (Number.isNaN(since)) {
			return [400, 'text/plain', `Invalid 'since' value '${searchParams.get('since')}'`];
		}
		let rows = await Zotero.DB.queryAsync(
			"SELECT I.key, FI.version "
				+ "FROM fulltextItems FI JOIN items I USING (itemID) "
				+ "WHERE libraryID=?1 AND (?2=0 OR FI.version>?2)",
			[libraryID, since]
		);
		let obj = {};
		for (let row of rows) {
			obj[row.key] = row.version;
		}
		return [200, 'application/json', JSON.stringify(obj, null, 4)];
	}
};
Zotero.Server.Endpoints["/api/users/:userID/fulltext"] = Zotero.Server.LocalAPI.FullText;
Zotero.Server.Endpoints["/api/groups/:groupID/fulltext"] = Zotero.Server.LocalAPI.FullText;


async function writeBulkFullText(endpoint, requestData) {
	let { libraryID, data } = requestData;

	let body;
	try {
		endpoint._checkLibraryIfUnmodifiedSinceVersion(requestData, { required: true });
		body = endpoint._parseJSONBody(data);
	}
	catch (e) {
		if (e instanceof HTTPError) return [e.status, 'text/plain', e.message];
		throw e;
	}

	if (!Array.isArray(body)) {
		return [400, 'text/plain', 'Uploaded data must be a JSON array'];
	}
	if (body.length === 0) {
		return [400, 'text/plain', 'No full-text entries provided'];
	}
	if (body.length > MAX_WRITE_FULLTEXT) {
		return [
			413,
			'text/plain',
			`Cannot write more than ${MAX_WRITE_FULLTEXT} full-text entries at a time`
		];
	}

	let results = new MultiWriteResults();
	for (let i = 0; i < body.length; i++) {
		let entry = body[i];
		let providedKey = '';
		try {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
				throw new HTTPError(400, `Invalid value for index ${i}; expected JSON object`);
			}
			if (typeof entry.key !== 'string' || !entry.key) {
				throw new HTTPError(400, "'key' is required");
			}
			providedKey = entry.key;
			validateObjectKey(providedKey);
			validateFullTextItemBody(entry);

			await storeItemFullText(libraryID, providedKey, entry);
			// Mirrors dataserver: successful fulltext entries return only the key, no full JSON
			results.addSuccess(i, { key: providedKey });
		}
		catch (e) {
			Zotero.debug(`Local API: fulltext write index ${i} failed: ${e.message || e}`, 2);
			if (!(e instanceof HTTPError)) {
				Zotero.logError(e);
			}
			results.addFailure(i, providedKey, e);
		}
	}

	return [
		200,
		{
			'Content-Type': 'application/json',
			'Last-Modified-Version': Zotero.Libraries.get(libraryID).clientVersion,
		},
		JSON.stringify(results.toJSON(), null, 4)
	];
}


Zotero.Server.LocalAPI.Searches = class extends LocalAPIEndpoint {
	supportedMethods = ['GET', 'POST', 'DELETE'];

	async run(requestData) {
		const WRITE_PATH_RE = /^\/api\/(?:users|groups)\/[^/]+\/searches\/?$/;
		if (requestData.method === 'POST') {
			if (!WRITE_PATH_RE.test(requestData.pathname)) {
				return [405, 'text/plain', 'Method not allowed for this path'];
			}
			return writeMultipleObjects(this, requestData, 'search');
		}
		if (requestData.method === 'DELETE') {
			if (!WRITE_PATH_RE.test(requestData.pathname)) {
				return [405, 'text/plain', 'Method not allowed for this path'];
			}
			return deleteMultipleObjects(this, requestData, 'search', 'searchKey');
		}
		let { libraryID } = requestData;
		let searches = await Zotero.Searches.getAll(libraryID);
		return { data: searches };
	}
};
Zotero.Server.Endpoints["/api/users/:userID/searches"] = Zotero.Server.LocalAPI.Searches;
Zotero.Server.Endpoints["/api/groups/:groupID/searches"] = Zotero.Server.LocalAPI.Searches;

Zotero.Server.LocalAPI.Search = class extends LocalAPIEndpoint {
	supportedMethods = ['GET', 'PUT', 'PATCH', 'DELETE'];

	async run(requestData) {
		if (requestData.method === 'PUT' || requestData.method === 'PATCH') {
			return writeSingleObject(this, requestData, 'search', requestData.method === 'PATCH');
		}
		if (requestData.method === 'DELETE') {
			return deleteSingleObject(this, requestData, 'search');
		}
		let { pathParams, libraryID } = requestData;
		let search = Zotero.Searches.getByLibraryAndKey(libraryID, pathParams.searchKey);
		if (!search) return _404;
		return { data: search };
	}
};
Zotero.Server.Endpoints["/api/users/:userID/searches/:searchKey"] = Zotero.Server.LocalAPI.Search;
Zotero.Server.Endpoints["/api/groups/:groupID/searches/:searchKey"] = Zotero.Server.LocalAPI.Search;


Zotero.Server.LocalAPI.Tags = class extends LocalAPIEndpoint {
	supportedMethods = ['GET', 'DELETE'];

	async run(requestData) {
		let { libraryID, searchParams } = requestData;
		if (requestData.method === 'DELETE') {
			this._checkLibraryIfUnmodifiedSinceVersion(requestData, { required: true });

			let raw = searchParams.get('tag');
			if (!raw) {
				return [400, 'text/plain', "'tag' not provided"];
			}
			// '||' separates tag names; values are already URL-decoded at this point.
			let names = raw.split('||').map(t => t.trim()).filter(Boolean);
			if (!names.length) {
				return [400, 'text/plain', "'tag' not provided"];
			}
			if (names.length > MAX_DELETE_OBJECTS) {
				return [413, 'text/plain', `Cannot delete more than ${MAX_DELETE_OBJECTS} tags at a time`];
			}

			let tagIDs = names.map(name => Zotero.Tags.getID(name)).filter(id => !!id);
			if (tagIDs.length) {
				await Zotero.Tags.removeFromLibrary(libraryID, tagIDs);
			}

			return [
				204,
				{ 'Last-Modified-Version': Zotero.Libraries.get(libraryID).clientVersion },
				''
			];
		}
		else {
			let tags = await Zotero.Tags.getAll(libraryID);
			let json = await Zotero.Tags.toResponseJSON(libraryID, tags);
			return { data: json };
		}
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
		return { data: json };
	}
};
Zotero.Server.Endpoints["/api/users/:userID/tags/:tag"] = Zotero.Server.LocalAPI.Tag;
Zotero.Server.Endpoints["/api/groups/:groupID/tags/:tag"] = Zotero.Server.LocalAPI.Tag;


/**
 * Show the local API authorization dialog. Stubbable in tests.
 * @returns {Promise<{ allow: boolean, remember: boolean }>}
 */
Zotero.Server.LocalAPI._promptForAuthorization = async function (appName) {
	let title = Zotero.ftl.formatValueSync('local-api-authorize-title');
	let text = Zotero.ftl.formatValueSync('local-api-authorize-text', { appName });
	let allowLabel = Zotero.ftl.formatValueSync('local-api-authorize-allow');
	let alwaysAllowLabel = Zotero.ftl.formatValueSync('local-api-authorize-always-allow');
	let denyLabel = Zotero.ftl.formatValueSync('local-api-authorize-deny');

	let index = Zotero.Prompt.confirm({
		title,
		text,
		button0: allowLabel,
		button1: alwaysAllowLabel,
		button2: denyLabel,
		defaultButton: 2,
	});
	return { allow: index === 0 || index === 1, remember: index === 1 };
};

/**
 * Number of remembered (persistent) local API authorizations.
 */
Zotero.Server.LocalAPI.getAuthorizationCount = async function () {
	let keys = await _loadLocalAPIKeys();
	return keys.filter(k => k.remember).length;
};

/**
 * Discard every stored local API authorization. Subsequent write requests will
 * have to reauthorize.
 */
Zotero.Server.LocalAPI.clearAuthorizations = async function () {
	_localAPIKeysCache = [];
	let path = _localAPIKeysPath();
	if (await IOUtils.exists(path)) {
		await IOUtils.remove(path);
	}
};

Zotero.Server.LocalAPI._resetAuthorizeRateLimit = function () {
	_authorizeTimestamps = [];
};

/**
 * Convert a {@link Zotero.DataObject}, or an array of DataObjects, to response JSON
 * with appropriate included data based on the 'include' query parameter.
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
	let responseJSON = dataObject.toResponseJSONAsync
		? await dataObject.toResponseJSONAsync({
			apiURL: `http://localhost:${Zotero.Server.port}/api/`,
			includeGroupDetails: true,
			syncedStorageProperties: false,
			syncedVersionProperty: false,
		})
		: dataObject;
	
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
	let styleIDOrURL = searchParams.get('style') || 'chicago-shortened-notes-bibliography';
	let locale = searchParams.get('locale') || 'en-US';
	let linkWrap = searchParams.get('linkwrap') == '1';
	
	let style = Zotero.Styles.get(styleIDOrURL);
	// If not a URI, try with standard prefix
	if (!style && !styleIDOrURL.includes(':')) {
		style = Zotero.Styles.get('http://www.zotero.org/styles/' + styleIDOrURL);
	}
	if (!style) {
		// The client wants a style we don't have locally, so download it
		// If they didn't pass an absolute URL, resolve relative to the style repo base
		try {
			let styleURL = new URL(styleIDOrURL, 'https://www.zotero.org/styles/');
			if (styleURL.protocol === 'http:' && styleURL.host === 'www.zotero.org') {
				styleURL.protocol = 'https:';
			}
			styleURL = styleURL.toString();
			let { styleID } = await Zotero.Styles.install({ url: styleURL }, styleURL, true);
			style = Zotero.Styles.get(styleID);
		}
		catch (e) {
			throw new HTTPError(400, `Invalid style: ${styleIDOrURL} (${e.message})`);
		}
	}
	if (!style) {
		throw new Error(`Unable to install style: ${styleIDOrURL}`);
	}
	
	let cslEngine = style.getCiteProc(locale, 'html', { cache: true });
	// eslint-disable-next-line camelcase
	cslEngine.opt.development_extensions.wrap_url_and_doi = linkWrap;
	return Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, 'html', asCitationList);
}

/**
 * Export items to a string with the given translator.
 *
 * @param {Zotero.Item|Zotero.Item[]} itemOrItems
 * @param {string} translatorID
 * @returns {Promise<String>}
 */
function exportItems(itemOrItems, translatorID) {
	let items = Array.isArray(itemOrItems)
		? itemOrItems
		: [itemOrItems];
	// Filter out annotations, which we can't export
	items = items.filter(item => !item.isAnnotation());
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
 * @param {Zotero.Search} parentSearch
 * @param {string[]} searchStrings The search strings provided by the client as query parameters
 * @param {string} condition The search condition name
 */
function buildSearchFromSearchSyntax(parentSearch, searchStrings, condition) {
	for (let searchString of searchStrings) {
		let negate = false;
		if (searchString[0] == '-') {
			negate = true;
			searchString = searchString.substring(1);
		}
		if (searchString[0] == '\\' && searchString[1] == '-') {
			searchString = searchString.substring(1);
		}
		
		let childSearch = new Zotero.Search();
		childSearch.libraryID = parentSearch.libraryID;
		childSearch.setScope(parentSearch, true);
		childSearch.addCondition('joinMode', 'any');
		
		let ors = searchString.split('||').map(or => or.trim());
		for (let or of ors) {
			childSearch.addCondition(condition, negate ? 'isNot' : 'is', or);
		}
		
		parentSearch = childSearch;
	}
	return parentSearch;
}

function searchToDebugJSON(search) {
	return {
		conditions: Object.values(search.conditions).map(condition => ({
			condition: condition.condition,
			operator: condition.operator,
			value: condition.value
		})),
		libraryID: search.libraryID,
		scope: search.scope ? searchToDebugJSON(search.scope) : undefined
	};
}

/**
 * Validate an object key from a query parameter or JSON body. Throws HTTPError(400) if invalid.
 */
function validateObjectKey(key) {
	if (typeof key !== 'string' || !Zotero.Utilities.isValidObjectKey(key)) {
		throw new HTTPError(400, `Invalid key: '${key}'`);
	}
	return key;
}

/**
 * Parse a comma-separated list of keys from a query parameter, validating each.
 * Throws HTTPError if missing, malformed, or exceeds the max-delete limit.
 */
function parseKeyList(searchParams, paramName) {
	let raw = searchParams.get(paramName);
	if (!raw) {
		throw new HTTPError(400, `'${paramName}' not provided`);
	}
	let keys = raw.split(',').map(k => k.trim()).filter(Boolean);
	if (!keys.length) {
		throw new HTTPError(400, `'${paramName}' not provided`);
	}
	if (keys.length > MAX_DELETE_OBJECTS) {
		throw new HTTPError(413, `Cannot delete more than ${MAX_DELETE_OBJECTS} objects at a time`);
	}
	for (let key of keys) {
		validateObjectKey(key);
	}
	return keys;
}

/**
 * Return the response JSON for a successfully written data object, using the
 * same options used elsewhere in the local API.
 */
async function dataObjectToResponseJSON(dataObject) {
	return dataObject.toResponseJSONAsync({
		apiURL: `http://localhost:${Zotero.Server.port}/api/`,
		includeGroupDetails: true,
		syncedStorageProperties: false,
		syncedVersionProperty: false,
	});
}

/**
 * Look up an existing object by library + key, returning null if not found.
 * `kind` is one of 'item', 'collection', 'search'.
 */
async function getExistingObjectByKey(libraryID, key, kind) {
	switch (kind) {
		case 'item':
			return Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
		case 'collection':
			return Zotero.Collections.getByLibraryAndKey(libraryID, key);
		case 'search':
			return Zotero.Searches.getByLibraryAndKey(libraryID, key);
		default:
			throw new Error(`Unknown object kind: ${kind}`);
	}
}

/**
 * Construct a new object of the given kind in the given library, ready
 * for fromJSON(). For items, the itemType must be passed.
 */
function makeNewObject(libraryID, kind, itemType) {
	let obj;
	switch (kind) {
		case 'item':
			if (!itemType) {
				throw new HTTPError(400, "itemType property not provided");
			}
			if (!Zotero.ItemTypes.getID(itemType)) {
				throw new HTTPError(400, `Unknown itemType '${itemType}'`);
			}
			obj = new Zotero.Item(itemType);
			break;
		case 'collection':
			obj = new Zotero.Collection();
			break;
		case 'search':
			obj = new Zotero.Search();
			break;
		default:
			throw new Error(`Unknown object kind: ${kind}`);
	}
	obj.libraryID = libraryID;
	return obj;
}

/**
 * Apply JSON to an existing or new data object. Throws HTTPError on validation
 * failure. Caller is responsible for calling saveTx().
 */
function applyJSONToObject(obj, json, kind) {
	try {
		obj.fromJSON(json, { strict: false });
	}
	catch (e) {
		if (e && e.name === 'ZoteroInvalidDataError') {
			throw new HTTPError(400, e.message);
		}
		throw e;
	}
	if (kind === 'item' && obj.isNote() && typeof json.note === 'string') {
		// fromJSON already sets the note for note/attachment items
	}
}

/**
 * Merge a PATCH JSON object onto the current item/collection/search JSON
 * representation. Keys present in `patchJSON` (even if empty) take precedence;
 * keys absent from `patchJSON` keep their existing values.
 */
function mergePatchJSON(existingJSON, patchJSON) {
	let merged = { ...existingJSON };
	for (let k of Object.keys(patchJSON)) {
		merged[k] = patchJSON[k];
	}
	return merged;
}

/**
 * Multi-object write (POST). Handles items, collections, searches uniformly.
 */
async function writeMultipleObjects(endpoint, requestData, kind) {
	let { libraryID, data } = requestData;

	let token;
	let body;
	try {
		token = endpoint._checkWriteToken(requestData);
		endpoint._checkLibraryIfUnmodifiedSinceVersion(requestData);
		body = endpoint._parseJSONBody(data);
	}
	catch (e) {
		if (e instanceof HTTPError) {
			return [e.status, 'text/plain', e.message];
		}
		throw e;
	}

	if (!Array.isArray(body)) {
		return [400, 'text/plain', `Uploaded data must be a JSON array`];
	}
	if (body.length === 0) {
		return [400, 'text/plain', `No ${kind}s provided`];
	}
	if (body.length > MAX_WRITE_OBJECTS) {
		return [
			413,
			'text/plain',
			`Cannot add more than ${MAX_WRITE_OBJECTS} ${kind}s at a time`
		];
	}

	let results = new MultiWriteResults();

	for (let i = 0; i < body.length; i++) {
		let entry = body[i];
		let providedKey = '';
		try {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
				throw new HTTPError(400, `Invalid value for index ${i} in uploaded data; expected JSON ${kind} object`);
			}
			providedKey = typeof entry.key === 'string' ? entry.key : '';

			let obj;
			let isUpdate = false;
			if (providedKey) {
				validateObjectKey(providedKey);
				obj = await getExistingObjectByKey(libraryID, providedKey, kind);
				if (obj) {
					isUpdate = true;
					if (entry.version !== undefined && entry.version !== null) {
						let expectedVersion = parseInt(entry.version);
						if (Number.isNaN(expectedVersion)) {
							throw new HTTPError(400, "Invalid version value");
						}
						if (expectedVersion !== obj.clientVersion) {
							throw new HTTPError(412, `${kind} version mismatch: expected ${expectedVersion}, found ${obj.clientVersion}`);
						}
					}
					// POST follows PATCH semantics: merge patch with existing
					let existingJSON = obj.toJSON();
					entry = mergePatchJSON(existingJSON, entry);
				}
				else {
					obj = makeNewObject(libraryID, kind, entry.itemType);
					obj.key = providedKey;
				}
			}
			else {
				obj = makeNewObject(libraryID, kind, entry.itemType);
			}

			applyJSONToObject(obj, entry, kind);

			if (obj.hasChanged()) {
				await obj.saveTx();
				let json = await dataObjectToResponseJSON(obj);
				results.addSuccess(i, json);
			}
			else if (isUpdate) {
				results.addUnchanged(i, obj.key);
			}
			else {
				// New object with nothing to set -- treat as success
				await obj.saveTx();
				let json = await dataObjectToResponseJSON(obj);
				results.addSuccess(i, json);
			}
		}
		catch (e) {
			Zotero.debug(`Local API: ${kind} write index ${i} failed: ${e.message || e}`, 2);
			if (!(e instanceof HTTPError)) {
				Zotero.logError(e);
			}
			results.addFailure(i, providedKey, e);
		}
	}

	endpoint._recordWriteToken(token);

	let headers = {
		'Content-Type': 'application/json',
		'Last-Modified-Version': Zotero.Libraries.get(libraryID).clientVersion,
	};
	return [200, headers, JSON.stringify(results.toJSON(), null, 4)];
}

/**
 * Single-object write (PUT or PATCH).
 */
async function writeSingleObject(endpoint, requestData, kind, isPatch) {
	let { libraryID, pathParams, data } = requestData;
	let key;
	switch (kind) {
		case 'item':
			key = pathParams.itemKey;
			break;
		case 'collection':
			key = pathParams.collectionKey;
			break;
		case 'search':
			key = pathParams.searchKey;
			break;
		default:
			throw new Error(`Unknown kind: ${kind}`);
	}

	let body;
	try {
		validateObjectKey(key);
		endpoint._checkLibraryIfUnmodifiedSinceVersion(requestData);
		body = endpoint._parseJSONBody(data);
	}
	catch (e) {
		if (e instanceof HTTPError) {
			return [e.status, 'text/plain', e.message];
		}
		throw e;
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return [400, 'text/plain', 'Uploaded data must be a JSON object'];
	}

	let obj = await getExistingObjectByKey(libraryID, key, kind);
	let isUpdate = !!obj;

	if (isUpdate) {
		// Per-object version check
		if (body.version !== undefined && body.version !== null) {
			let expectedVersion = parseInt(body.version);
			if (Number.isNaN(expectedVersion)) {
				return [400, 'text/plain', 'Invalid version value'];
			}
			if (expectedVersion !== obj.clientVersion) {
				return [
					412,
					'text/plain',
					`${kind} version mismatch: expected ${expectedVersion}, found ${obj.clientVersion}`
				];
			}
		}
		else if (!requestData.headers.get('If-Unmodified-Since-Version')) {
			return [428, 'text/plain', 'If-Unmodified-Since-Version not provided'];
		}

		if (isPatch) {
			let existingJSON = obj.toJSON();
			body = mergePatchJSON(existingJSON, body);
		}
	}
	else {
		if (!body.itemType && kind === 'item') {
			return [400, 'text/plain', 'itemType property not provided'];
		}
		try {
			obj = makeNewObject(libraryID, kind, body.itemType);
			obj.key = key;
		}
		catch (e) {
			if (e instanceof HTTPError) {
				return [e.status, 'text/plain', e.message];
			}
			throw e;
		}
	}

	try {
		applyJSONToObject(obj, body, kind);
	}
	catch (e) {
		if (e instanceof HTTPError) {
			return [e.status, 'text/plain', e.message];
		}
		throw e;
	}

	if (obj.hasChanged()) {
		await obj.saveTx();
	}

	return [
		204,
		{ 'Last-Modified-Version': Zotero.Libraries.get(libraryID).clientVersion },
		''
	];
}

/**
 * Multi-object DELETE (e.g. ?itemKey=KEY1,KEY2,...).
 *
 * `paramName` is the query parameter name ('itemKey', 'collectionKey', 'searchKey').
 */
async function deleteMultipleObjects(endpoint, requestData, kind, paramName) {
	let { libraryID, searchParams } = requestData;

	try {
		endpoint._checkLibraryIfUnmodifiedSinceVersion(requestData, { required: true });
	}
	catch (e) {
		if (e instanceof HTTPError) {
			return [e.status, 'text/plain', e.message];
		}
		throw e;
	}

	let keys;
	try {
		keys = parseKeyList(searchParams, paramName);
	}
	catch (e) {
		if (e instanceof HTTPError) {
			return [e.status, 'text/plain', e.message];
		}
		throw e;
	}

	for (let key of keys) {
		let obj = await getExistingObjectByKey(libraryID, key, kind);
		if (obj) {
			await obj.eraseTx();
		}
	}

	return [
		204,
		{ 'Last-Modified-Version': Zotero.Libraries.get(libraryID).clientVersion },
		''
	];
}

/**
 * Single-object DELETE.
 */
async function deleteSingleObject(endpoint, requestData, kind) {
	let { libraryID, pathParams } = requestData;
	let key;
	switch (kind) {
		case 'item':
			key = pathParams.itemKey;
			break;
		case 'collection':
			key = pathParams.collectionKey;
			break;
		case 'search':
			key = pathParams.searchKey;
			break;
		default:
			throw new Error(`Unknown kind: ${kind}`);
	}

	try {
		validateObjectKey(key);
	}
	catch (e) {
		if (e instanceof HTTPError) {
			return [e.status, 'text/plain', e.message];
		}
		throw e;
	}

	let obj = await getExistingObjectByKey(libraryID, key, kind);
	if (!obj) {
		return _404;
	}

	// Per-object version check: prefer If-Unmodified-Since-Version against the
	// object's own clientVersion, falling back to library-level when checking
	// the bare header against library version (which the base helper does).
	let header = requestData.headers.get('If-Unmodified-Since-Version');
	if (header === null) {
		return [428, 'text/plain', 'If-Unmodified-Since-Version not provided'];
	}
	let expectedVersion = parseInt(header);
	if (Number.isNaN(expectedVersion) || expectedVersion < 0) {
		return [400, 'text/plain', 'Invalid If-Unmodified-Since-Version value'];
	}
	if (obj.clientVersion > expectedVersion) {
		return [
			412,
			'text/plain',
			`${kind} has been modified since specified version `
			+ `(expected ${expectedVersion}, found ${obj.clientVersion})`
		];
	}

	await obj.eraseTx();

	return [
		204,
		{ 'Last-Modified-Version': Zotero.Libraries.get(libraryID).clientVersion },
		''
	];
}

/**
 * Handle POST /items/:itemKey/file: either an authorize call (no `upload=`)
 * or a register call (`upload=<uploadKey>`).
 *
 * Content-Type must be application/x-www-form-urlencoded per the web API spec.
 */
async function handleFileWrite(endpoint, requestData) {
	let { libraryID, pathParams, data, headers } = requestData;

	if (!data || typeof data !== 'object') {
		return [400, 'text/plain', 'Content-Type must be application/x-www-form-urlencoded'];
	}

	let item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, pathParams.itemKey);
	if (!item) return _404;
	if (!item.isFileAttachment()) {
		return [400, 'text/plain', `Not a file attachment: ${item.key}`];
	}
	let linkMode = item.attachmentLinkMode;
	if (linkMode !== Zotero.Attachments.LINK_MODE_IMPORTED_FILE
			&& linkMode !== Zotero.Attachments.LINK_MODE_IMPORTED_URL) {
		return [400, 'text/plain', 'Cannot upload files for non-imported attachments'];
	}
	if (!Zotero.Libraries.get(libraryID).filesEditable) {
		return [403, 'text/plain', 'File editing denied'];
	}

	// Register phase
	if (data.upload !== undefined) {
		return registerUpload(item, data, headers);
	}

	// Authorize phase
	return authorizeUpload(item, data, headers, requestData);
}

/**
 * Authorize a new file upload. Validates the request, then returns either
 * {exists: 1} if the file already matches locally, or upload details with an
 * uploadKey that the client uses to actually transmit the file bytes.
 */
async function authorizeUpload(item, params, headers, requestData) {
	// Validate If-Match / If-None-Match
	let ifMatch = headers.get('If-Match');
	let ifNoneMatch = headers.get('If-None-Match');
	if (!ifMatch && !ifNoneMatch) {
		return [428, 'text/plain', 'If-Match/If-None-Match header not provided'];
	}

	// Current synced hash for this attachment, if any
	let currentSyncedMD5 = item.attachmentSyncedHash || null;

	if (ifMatch) {
		let match = /^"?([a-f0-9]{32})"?$/.exec(ifMatch);
		if (!match) {
			return [400, 'text/plain', 'Invalid If-Match header'];
		}
		let expected = match[1];
		if (!currentSyncedMD5) {
			return [412, 'text/plain', 'If-Match set but file does not exist'];
		}
		if (currentSyncedMD5 !== expected) {
			return [412, 'text/plain', 'ETag does not match current version of file'];
		}
	}
	if (ifNoneMatch !== null) {
		if (ifNoneMatch !== '*') {
			return [400, 'text/plain', 'Invalid value for If-None-Match header'];
		}
		if (currentSyncedMD5) {
			return [412, 'text/plain', 'If-None-Match: * set but file exists'];
		}
	}

	// Validate form params
	let md5 = params.md5;
	if (!md5 || !/^[a-f0-9]{32}$/i.test(md5)) {
		return [400, 'text/plain', 'MD5 hash not provided'];
	}
	md5 = md5.toLowerCase();
	let filename = params.filename;
	if (!filename) {
		return [400, 'text/plain', 'File name not provided'];
	}
	let filesize = params.filesize;
	if (filesize === undefined || filesize === null || filesize === '') {
		return [400, 'text/plain', 'File size not provided'];
	}
	filesize = parseInt(filesize);
	if (Number.isNaN(filesize) || filesize < 0) {
		return [400, 'text/plain', 'Invalid file size value'];
	}
	if (filesize > 4 * 1024 * 1024 * 1024) {
		return [400, 'text/plain', 'Files above 4 GB are not currently supported'];
	}
	let mtime = params.mtime;
	if (mtime === undefined || mtime === null || mtime === '') {
		return [400, 'text/plain', 'File modification time not provided'];
	}
	mtime = parseInt(mtime);
	if (Number.isNaN(mtime) || mtime < 0) {
		return [400, 'text/plain', 'Invalid mtime value'];
	}
	// Per the spec, mtime is in milliseconds; reject values that look like seconds.
	if (mtime > 0 && mtime < 10000000000) {
		return [400, 'text/plain', 'mtime must be provided in milliseconds, not seconds'];
	}

	// If the local file already matches the requested MD5, no upload is needed.
	try {
		let existingPath = await item.getFilePathAsync();
		if (existingPath) {
			let existingMD5 = await Zotero.Utilities.Internal.md5Async(existingPath);
			if (existingMD5 === md5) {
				// Persist the requested mtime so subsequent reads agree
				item.attachmentSyncedHash = md5;
				item.attachmentSyncedModificationTime = mtime;
				await item.saveTx();
				return [
					200,
					{ 'Content-Type': 'application/json' },
					JSON.stringify({ exists: 1 })
				];
			}
		}
	}
	catch (e) {
		Zotero.debug(`File exists check failed: ${e.message}`, 2);
	}

	let contentType = params.contentType || item.attachmentContentType || 'application/octet-stream';

	// Generate an uploadKey, remember the pending upload, return URL
	pruneExpired(PENDING_UPLOADS);
	let uploadKey = Zotero.Utilities.randomString(32);
	PENDING_UPLOADS.set(uploadKey, {
		libraryID: item.libraryID,
		itemKey: item.key,
		md5,
		filename,
		filesize,
		mtime,
		contentType,
		charset: params.charset || item.attachmentCharset || null,
		uploaded: false,
		expires: Date.now() + UPLOAD_KEY_TTL_SECONDS * 1000,
	});

	let host = requestData.headers.get('Host') || `localhost:${Zotero.Server.port}`;
	let url = `http://${host}/api/local/uploads/${uploadKey}`;

	if (requestData.searchParams.get('params') === '1') {
		return [
			200,
			{ 'Content-Type': 'application/json' },
			JSON.stringify({
				url,
				uploadKey,
				contentType,
				params: {
					// Local uploads don't need S3-style form fields, but emit
					// the field so clients expecting a 'params' array can
					// iterate. They can be sent and will be ignored.
					key: uploadKey,
				},
			})
		];
	}

	return [
		200,
		{ 'Content-Type': 'application/json' },
		JSON.stringify({
			url,
			uploadKey,
			contentType,
			prefix: '',
			suffix: '',
		})
	];
}

/**
 * Register a previously-uploaded file (phase 3 of the upload flow).
 * Updates the attachment item with the new filename, md5, and mtime, then
 * returns 204 with the new library version.
 */
async function registerUpload(item, params, headers) {
	pruneExpired(PENDING_UPLOADS);
	let uploadKey = params.upload;
	let upload = PENDING_UPLOADS.get(uploadKey);
	if (!upload) {
		return [400, 'text/plain', 'Invalid or expired upload key'];
	}
	if (upload.libraryID !== item.libraryID || upload.itemKey !== item.key) {
		return [400, 'text/plain', 'Upload key does not match item'];
	}
	if (!upload.uploaded) {
		return [400, 'text/plain', 'File contents were not uploaded'];
	}

	// Re-check If-Match / If-None-Match (the client repeats these in register)
	let ifMatch = headers.get('If-Match');
	let ifNoneMatch = headers.get('If-None-Match');
	let currentSyncedMD5 = item.attachmentSyncedHash || null;
	if (ifMatch) {
		let m = /^"?([a-f0-9]{32})"?$/.exec(ifMatch);
		if (!m || !currentSyncedMD5 || currentSyncedMD5 !== m[1]) {
			PENDING_UPLOADS.delete(uploadKey);
			return [412, 'text/plain', 'ETag does not match current version of file'];
		}
	}
	if (ifNoneMatch === '*' && currentSyncedMD5) {
		PENDING_UPLOADS.delete(uploadKey);
		return [412, 'text/plain', 'If-None-Match: * set but file exists'];
	}

	item.attachmentFilename = upload.filename;
	item.attachmentSyncedHash = upload.md5;
	item.attachmentSyncedModificationTime = upload.mtime;
	if (upload.contentType) {
		item.attachmentContentType = upload.contentType;
	}
	if (upload.charset) {
		item.attachmentCharset = upload.charset;
	}
	await item.saveTx();

	PENDING_UPLOADS.delete(uploadKey);

	return [
		204,
		{ 'Last-Modified-Version': Zotero.Libraries.get(item.libraryID).clientVersion },
		''
	];
}

/**
 * Apply a validated fulltext write to a single item. Returns the new library
 * client version. Throws HTTPError(404) if the item is missing or isn't a file
 * attachment, and HTTPError(400) if it isn't an indexable MIME type.
 */
async function storeItemFullText(libraryID, itemKey, body) {
	let item = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, itemKey);
	if (!item || !item.isFileAttachment()) {
		throw new HTTPError(404, 'Not found');
	}
	if (!Zotero.Fulltext.isCachedMIMEType(item.attachmentContentType)) {
		throw new HTTPError(400, 'Full-text content is not supported for this item type');
	}

	let library = Zotero.Libraries.get(libraryID);
	let newVersion = await Zotero.DB.executeTransaction(async () => library.incrementClientVersion());

	await Zotero.Fulltext.setItemContent(libraryID, itemKey, {
		content: body.content,
		indexedChars: body.indexedChars,
		totalChars: body.totalChars,
		indexedPages: body.indexedPages,
		totalPages: body.totalPages,
	}, newVersion);
	// setItemContent() queues the write via the background processor. Flush it now so the
	// content is immediately visible to subsequent GETs.
	await Zotero.Fulltext.indexFromProcessorCache(item.id);

	return newVersion;
}

function pruneExpired(map) {
	let now = Date.now();
	for (let [k, v] of map) {
		let expiry = typeof v === 'number' ? v : v.expires;
		if (expiry && expiry < now) {
			map.delete(k);
		}
	}
}

class HTTPError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

/**
 * Builder for the canonical multi-object write response shape.
 *
 * Implements dataserver's Zotero_Results (model/Results.inc.php):
 *   {
 *     "successful": { "<index>": <full response JSON object> },
 *     "success":    { "<index>": "<objectKey>" },
 *     "unchanged":  { "<index>": "<objectKey>" },
 *     "failed":     { "<index>": { "key": "<objectKey>", "code": <int>, "message": "<str>" } }
 *   }
 */
class MultiWriteResults {
	constructor() {
		this.successful = {};
		this.success = {};
		this.unchanged = {};
		this.failed = {};
	}

	addSuccess(index, responseJSON) {
		let i = String(index);
		this.successful[i] = responseJSON;
		this.success[i] = responseJSON.key;
	}

	addUnchanged(index, key) {
		this.unchanged[String(index)] = key;
	}

	addFailure(index, key, codeOrError, message) {
		let code;
		let msg;
		if (codeOrError instanceof HTTPError) {
			code = codeOrError.status;
			msg = codeOrError.message;
		}
		else if (codeOrError instanceof Error) {
			code = 400;
			msg = codeOrError.message;
		}
		else {
			code = codeOrError;
			msg = message;
		}
		this.failed[String(index)] = {
			key: key || "",
			code,
			message: msg
		};
	}

	toJSON() {
		return {
			successful: this.successful,
			success: this.success,
			unchanged: this.unchanged,
			failed: this.failed,
		};
	}
}
