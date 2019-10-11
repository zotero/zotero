/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2014 Center for History and New Media
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

if (!Zotero.Sync) {
	Zotero.Sync = {};
}

Zotero.Sync.APIClient = function (options) {
	if (!options.baseURL) throw new Error("baseURL not set");
	if (!options.apiVersion) throw new Error("apiVersion not set");
	if (!options.caller) throw new Error("caller not set");
	
	this.baseURL = options.baseURL;
	this.apiVersion = options.apiVersion;
	this.apiKey = options.apiKey;
	this.caller = options.caller;
	this.debugUploadPolicy = Zotero.Prefs.get('sync.debugUploadPolicy');
	this.cancellerReceiver = options.cancellerReceiver;
	
	this.rateDelayIntervals = [30, 60, 300];
	this.rateDelayPosition = 0;
}

Zotero.Sync.APIClient.prototype = {
	MAX_OBJECTS_PER_REQUEST: 100,
	MIN_GZIP_SIZE: 1000,
	UPLOAD_TIMEOUT: 60000,
	
	
	getKeyInfo: Zotero.Promise.coroutine(function* (options={}) {
		var uri = this.baseURL + "keys/current";
		let opts = {};
		Object.assign(opts, options);
		opts.successCodes = [200, 403, 404];
		var xmlhttp = yield this.makeRequest("GET", uri, opts);
		if (xmlhttp.status == 403) {
			return false;
		}
		var json = this._parseJSON(xmlhttp.responseText);
		delete json.key;
		return json;
	}),
	
	
	/**
	 * Get group metadata versions
	 *
	 * Note: This is the version for group metadata, not library data.
	 */
	getGroupVersions: Zotero.Promise.coroutine(function* (userID) {
		if (!userID) throw new Error("User ID not provided");
		
		var uri = this.baseURL + "users/" + userID + "/groups?format=versions";
		var xmlhttp = yield this.makeRequest("GET", uri);
		return this._parseJSON(xmlhttp.responseText);
	}),
	
	/**
	 * Get group metadata for userID
	 *
	 * @param {Integer} userID
	 * @return {Object} - Group metadata response
	 */	
	getGroups: Zotero.Promise.coroutine(function* (userID) {
		if (!userID) throw new Error("User ID not provided");
		
		var uri = this.baseURL + "users/" + userID + "/groups";
		return yield this.getPaginatedResults(
			uri,
			(previous, xmlhttp, restart) => [...previous, ...this._parseJSON(xmlhttp.responseText)],
			[]
		);
	}),
	
	
	/**
	 * @param {Integer} groupID
	 * @return {Object|false} - Group metadata response, or false if group not found
	 */
	getGroup: Zotero.Promise.coroutine(function* (groupID) {
		if (!groupID) throw new Error("Group ID not provided");
		
		var uri = this.baseURL + "groups/" + groupID;
		var xmlhttp = yield this.makeRequest("GET", uri, { successCodes: [200, 404] });
		if (xmlhttp.status == 404) {
			return false;
		}
		return this._parseJSON(xmlhttp.responseText);
	}),
	
	
	getSettings: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, since) {
		var params = {
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			target: "settings"
		};
		if (since) {
			params.since = since;
		}
		var uri = this.buildRequestURI(params);
		var options = {
			successCodes: [200, 304]
		};
		if (since) {
			options.headers = {
				"If-Modified-Since-Version": since
			};
		}
		var xmlhttp = yield this.makeRequest("GET", uri, options);
		if (xmlhttp.status == 304) {
			return false;
		}
		return {
			libraryVersion: this._getLastModifiedVersion(xmlhttp),
			settings: this._parseJSON(xmlhttp.responseText)
		};
	}),
	
	
	/**
	 * @return {Object|false} - An object with 'libraryVersion' and a 'deleted' object, or
	 *     false if 'since' is earlier than the beginning of the delete log
	 */
	getDeleted: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, since) {
		var params = {
			target: "deleted",
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			since: since || 0
		};
		var uri = this.buildRequestURI(params);
		var xmlhttp = yield this.makeRequest("GET", uri, { successCodes: [200, 409] });
		if (xmlhttp.status == 409) {
			Zotero.debug(`'since' value '${since}' is earlier than the beginning of the delete log`);
			return false;
		}
		return {
			libraryVersion: this._getLastModifiedVersion(xmlhttp),
			deleted: this._parseJSON(xmlhttp.responseText)
		};
	}),
	
	
	getKeys: async function (libraryType, libraryTypeID, queryParams) {
		var params = {
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			format: 'keys'
		};
		if (queryParams) {
			for (let i in queryParams) {
				params[i] = queryParams[i];
			}
		}
		
		// TODO: Use pagination
		var uri = this.buildRequestURI(params);
		
		var options = {
			successCodes: [200, 304]
		};
		var xmlhttp = await this.makeRequest("GET", uri, options);
		if (xmlhttp.status == 304) {
			return false;
		}
		return {
			libraryVersion: this._getLastModifiedVersion(xmlhttp),
			keys: xmlhttp.responseText.trim().split(/\n/).filter(key => key)
		};
	},
	
	
	/**
	 * Return a promise for a JS object with object keys as keys and version
	 * numbers as values. By default, returns all objects in the library.
	 * Additional parameters (such as 'since', 'sincetime', 'libraryVersion')
	 * can be passed in 'params'.
	 *
	 * @param {String} libraryType  'user' or 'group'
	 * @param {Integer} libraryTypeID  userID or groupID
	 * @param {String} objectType  'item', 'collection', 'search'
	 * @param {Object} queryParams  Query parameters (see buildRequestURI())
	 * @return {Promise<Object>|false} - Object with 'libraryVersion' and 'results', or false if
	 *     nothing changed since specified library version
	 */
	getVersions: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, objectType, queryParams) {
		var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		
		var params = {
			target: objectTypePlural,
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			format: 'versions'
		};
		if (queryParams) {
			if (queryParams.top) {
				params.target += "/top";
				delete queryParams.top;
			}
			for (let i in queryParams) {
				params[i] = queryParams[i];
			}
		}
		if (objectType == 'item') {
			params.includeTrashed = 1;
		}
		
		// TODO: Use pagination
		var uri = this.buildRequestURI(params);
		
		var options = {
			successCodes: [200, 304]
		};
		var xmlhttp = yield this.makeRequest("GET", uri, options);
		if (xmlhttp.status == 304) {
			return false;
		}
		var libraryVersion = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!libraryVersion) {
			throw new Error("Last-Modified-Version not provided");
		}
		return {
			libraryVersion: libraryVersion,
			versions: this._parseJSON(xmlhttp.responseText)
		};
	}),
	
	
	/**
	 * Retrieve JSON from API for requested objects
	 *
	 * If necessary, multiple API requests will be made.
	 *
	 * @param {String} libraryType - 'user', 'group'
	 * @param {Integer} libraryTypeID - userID or groupID
	 * @param {String} objectType - 'collection', 'item', 'search'
	 * @param {String[]} objectKeys - Keys of objects to request
	 * @return {Array<Promise<Object[]|Error[]>>} - An array of promises for batches of JSON objects
	 *     or Errors for failures
	 */
	downloadObjects: function (libraryType, libraryTypeID, objectType, objectKeys) {
		if (!objectKeys.length) {
			return [];
		}
		
		// If more than max per request, call in batches
		if (objectKeys.length > this.MAX_OBJECTS_PER_REQUEST) {
			let allKeys = objectKeys.concat();
			let promises = [];
			while (true)  {
				let requestKeys = allKeys.splice(0, this.MAX_OBJECTS_PER_REQUEST)
				if (!requestKeys.length) {
					break;
				}
				let promise = this.downloadObjects(
					libraryType,
					libraryTypeID,
					objectType,
					requestKeys
				)[0];
				if (promise) {
					promises.push(promise);
				}
			}
			return promises;
		}
		
		// Otherwise make request
		var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		
		Zotero.debug("Retrieving " + objectKeys.length + " "
			+ (objectKeys.length == 1 ? objectType : objectTypePlural));
		
		var params = {
			target: objectTypePlural,
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			format: 'json'
		};
		params[objectType + "Key"] = objectKeys.join(",");
		if (objectType == 'item') {
			params.includeTrashed = 1;
		}
		var uri = this.buildRequestURI(params);
		
		return [
			this.makeRequest("GET", uri)
			.then(function (xmlhttp) {
				return this._parseJSON(xmlhttp.responseText)
			}.bind(this))
			// Return the error without failing the whole chain
			.catch(function (e) {
				Zotero.logError(e);
				if (e instanceof Zotero.HTTP.UnexpectedStatusException && e.is4xx()) {
					throw e;
				}
				return e;
			})
		];
	},
	
	
	uploadSettings: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, libraryVersion, settings) {
		var method = "POST";
		var objectType = "setting";
		var objectTypePlural = "settings";
		var numSettings = Object.keys(settings).length;
		
		Zotero.debug(`Uploading ${numSettings} ${numSettings == 1 ? objectType : objectTypePlural}`);
		
		Zotero.debug("Sending If-Unmodified-Since-Version: " + libraryVersion);
		
		var json = JSON.stringify(settings);
		var params = {
			target: objectTypePlural,
			libraryType: libraryType,
			libraryTypeID: libraryTypeID
		};
		var uri = this.buildRequestURI(params);
		
		var xmlhttp = yield this.makeRequest(method, uri, {
			headers: {
				"Content-Type": "application/json",
				"If-Unmodified-Since-Version": libraryVersion
			},
			body: json,
			successCodes: [204, 412]
		});
		this._check412(xmlhttp);
		return this._getLastModifiedVersion(xmlhttp);
	}),
	
	
	uploadObjects: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, method, libraryVersion, objectType, objects) {
		if (method != 'POST' && method != 'PATCH') {
			throw new Error("Invalid method '" + method + "'");
		}
		
		var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		
		Zotero.debug("Uploading " + objects.length + " "
			+ (objects.length == 1 ? objectType : objectTypePlural));
		
		Zotero.debug("Sending If-Unmodified-Since-Version: " + libraryVersion);
		
		var json = JSON.stringify(objects);
		var params = {
			target: objectTypePlural,
			libraryType: libraryType,
			libraryTypeID: libraryTypeID
		};
		var uri = this.buildRequestURI(params);
		
		var xmlhttp = yield this.makeRequest(method, uri, {
			headers: {
				"Content-Type": "application/json",
				"If-Unmodified-Since-Version": libraryVersion
			},
			body: json,
			successCodes: [200, 412],
			timeout: this.UPLOAD_TIMEOUT,
		});
		this._check412(xmlhttp);
		return {
			libraryVersion: this._getLastModifiedVersion(xmlhttp),
			results: this._parseJSON(xmlhttp.responseText)
		};
	}),
	
	
	uploadDeletions: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, libraryVersion, objectType, keys) {
		var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		
		Zotero.debug(`Uploading ${keys.length} ${objectType} deletion`
			+ (keys.length == 1 ? '' : 's'));
		
		Zotero.debug("Sending If-Unmodified-Since-Version: " + libraryVersion);
		
		var params = {
			target: objectTypePlural,
			libraryType: libraryType,
			libraryTypeID: libraryTypeID
		};
		if (objectType == 'tag') {
			params.tags = keys.join("||");
		}
		else {
			params[objectType + "Key"] = keys.join(",");
		}
		var uri = this.buildRequestURI(params);
		var xmlhttp = yield this.makeRequest("DELETE", uri, {
			headers: {
				"If-Unmodified-Since-Version": libraryVersion
			},
			successCodes: [204, 412],
			timeout: this.UPLOAD_TIMEOUT,
		});
		this._check412(xmlhttp);
		return this._getLastModifiedVersion(xmlhttp);
	}),
	
	
	getFullTextVersions: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, since) {
		var params = {
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			target: "fulltext",
			format: "versions"
		};
		if (since) {
			params.since = since;
		}
		
		// TODO: Use pagination
		var uri = this.buildRequestURI(params);
		
		var xmlhttp = yield this.makeRequest("GET", uri);
		return {
			libraryVersion: this._getLastModifiedVersion(xmlhttp),
			versions: this._parseJSON(xmlhttp.responseText)
		};
	}),
	
	
	getFullTextForItem: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, itemKey) {
		var params = {
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			target: `items/${itemKey}/fulltext`
		};
		var uri = this.buildRequestURI(params);
		var xmlhttp = yield this.makeRequest("GET", uri, { successCodes: [200, 404] });
		if (xmlhttp.status == 404) {
			return false;
		}
		var version = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!version) {
			throw new Error("Last-Modified-Version not provided");
		}
		return {
			version: this._getLastModifiedVersion(xmlhttp),
			data: this._parseJSON(xmlhttp.responseText)
		};
	}),
	
	
	setFullTextForItems: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, libraryVersion, data) {
		var params = {
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			target: "fulltext"
		};
		var uri = this.buildRequestURI(params);
		var xmlhttp = yield this.makeRequest(
			"POST",
			uri,
			{
				headers: {
					"Content-Type": "application/json",
					"If-Unmodified-Since-Version": libraryVersion
				},
				body: JSON.stringify(data),
				successCodes: [200, 412],
				timeout: this.UPLOAD_TIMEOUT,
				debug: true
			}
		);
		this._check412(xmlhttp);
		return {
			libraryVersion: this._getLastModifiedVersion(xmlhttp),
			results: this._parseJSON(xmlhttp.responseText)
		};
	}),
	
	
	createAPIKeyFromCredentials: Zotero.Promise.coroutine(function* (username, password) {
		var body = JSON.stringify({
			username,
			password,
			name: "Automatic Zotero Client Key",
			access: {
				user: {
					library: true,
					notes: true,
					write: true,
					files: true
				},
				groups: {
					all: {
						library: true,
						write: true
					}
				}
			}
		});
		var headers = {
			"Content-Type": "application/json"
		};
		var uri = this.baseURL + "keys";
		var response = yield this.makeRequest("POST", uri, {
			body, headers, successCodes: [201, 403], noAPIKey: true
		});
		if (response.status == 403) {
			return false;
		}
		
		var json = this._parseJSON(response.responseText);
		if (!json.key) {
			throw new Error('json.key not present in POST /keys response')
		}

		return json;
	}),


	// Deletes current API key
	deleteAPIKey: Zotero.Promise.coroutine(function* () {
		yield this.makeRequest("DELETE", this.baseURL + "keys/current");
	}),
	
	
	buildRequestURI: function (params) {
		var uri = this.baseURL;
		
		switch (params.libraryType) {
		case 'publications':
			uri += 'users/' + params.libraryTypeID + '/' + params.libraryType;
			break;
		
		default:
			uri += params.libraryType + 's/' + params.libraryTypeID;
			break;
		}
		
		if (params.target === undefined) {
			throw new Error("'target' not provided");
		}
		
		uri += "/" + params.target;
		
		if (params.objectKey) {
			uri += "/" + params.objectKey;
		}
		
		var queryString = '?';
		var queryParamsArray = [];
		var queryParamOptions = [
			'session',
			'format',
			'include',
			'includeTrashed',
			'itemType',
			'itemKey',
			'collectionKey',
			'searchKey',
			'tag',
			'linkMode',
			'start',
			'limit',
			'sort',
			'direction',
			'since',
			'sincetime'
		];
		queryParams = {};
		
		for (let option in params) {
			let value = params[option];
			if (value !== undefined && value !== '' && queryParamOptions.indexOf(option) != -1) {
				queryParams[option] = value;
			}
		}
		
		for (let index in queryParams) {
			let value = queryParams[index];
			if (Array.isArray(value)) {
				value.forEach(function(v, i) {
					queryParamsArray.push(encodeURIComponent(index) + '=' + encodeURIComponent(v));
				});
			}
			else {
				queryParamsArray.push(encodeURIComponent(index) + '=' + encodeURIComponent(value));
			}
		}
		
		return uri + (queryParamsArray.length ? "?" + queryParamsArray.join('&') : "");
	},
	
	
	getHeaders: function (headers = {}) {
		let newHeaders = {};
		newHeaders = Object.assign(newHeaders, headers);
		newHeaders["Zotero-API-Version"] = this.apiVersion.toString();
		if (this.apiKey) {
			newHeaders["Zotero-API-Key"] = this.apiKey;
		}
		return newHeaders;
	},
	
	
	makeRequest: Zotero.Promise.coroutine(function* (method, uri, options = {}) {
		if (!this.apiKey && !options.noAPIKey) {
			throw new Error('API key not set');
		}
		
		if (Zotero.HTTP.isWriteMethod(method) && this.debugUploadPolicy) {
			// Confirm uploads when extensions.zotero.sync.debugUploadPolicy is 1
			if (this.debugUploadPolicy === 1) {
				if (options.body) {
					Zotero.debug(options.body);
				}
				if (!Services.prompt.confirm(null, "Allow Upload?", `Allow ${method} to ${uri}?`)) {
					throw new Error(method + " request denied");
				}
			}
			// Deny uploads when extensions.zotero.sync.debugUploadPolicy is 2
			else if (this.debugUploadPolicy === 2) {
				throw new Error(`Can't make ${method} request in read-only mode`);
			}
		}
		
		let opts = {}
		Object.assign(opts, options);
		opts.headers = this.getHeaders(options.headers);
		opts.noCache = true;
		opts.foreground = !options.background;
		opts.responseType = options.responseType || 'text';
		if (options.body && options.body.length >= this.MIN_GZIP_SIZE
				&& Zotero.Prefs.get('sync.server.compressData')) {
			opts.compressBody = true;
		}
		opts.cancellerReceiver = this.cancellerReceiver;
		
		var tries = 0;
		while (true) {
			var result = yield this.caller.start(Zotero.Promise.coroutine(function* () {
				try {
					var xmlhttp = yield Zotero.HTTP.request(method, uri, opts);
					this._checkBackoff(xmlhttp);
					this.rateDelayPosition = 0;
					return xmlhttp;
				}
				catch (e) {
					tries++;
					if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
						if (this._check429(e.xmlhttp)) {
							// Return false to keep retrying request
							return false;
						}
					}
					else if (e instanceof Zotero.HTTP.BrowserOfflineException) {
						e.fatal = true;
					}
					throw e;
				}
			}.bind(this)));
			
			if (result) {
				return result;
			}
		}
	}),
	
	
	/**
	 * Retrieve paginated requests automatically based on the Link header, passing the results to a
	 * reducer
	 *
	 * @param {String} initialURL
	 * @param {Function} reducer - Reducer function taking (previousValue, xmlhttp, restart)
	 *                                accumulator: Return value from previous invocation, or initialValue
	 *                                xmlhttp: XMLHTTPRequest object from previous request
	 *                                restart: A function to restart from the beginning
	 * @param {mixed} initialValue
	 * @return {mixed} - The reduced value
	 */
	getPaginatedResults: Zotero.Promise.coroutine(function* (initialURL, reducer, initialValue) {
		let url = initialURL;
		let accumulator;
		let restart = false;
		while (true) {
			let xmlhttp = yield this.makeRequest("GET", url);
			accumulator = reducer(
				accumulator === undefined ? initialValue : accumulator,
				xmlhttp,
				function () {
					restart = true;
				}
			);
			if (restart) {
				accumulator = undefined;
				url = initialURL;
				restart = false;
				continue;
			}
			let link = this._parseLinkHeader(xmlhttp.getResponseHeader('Link'));
			if (link && link.next) {
				url = link.next;
			}
			else {
				break;
			}
		}
		return accumulator;
	}),
	
	
	/**
	 * Parse a Link header
	 *
	 * From https://gist.github.com/deiu/9335803
	 * MIT-licensed
	 */
	_parseLinkHeader: function (link) {
		var linkexp = /<[^>]*>\s*(\s*;\s*[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*")))*(,|$)/g;
		var paramexp = /[^\(\)<>@,;:"\/\[\]\?={} \t]+=(([^\(\)<>@,;:"\/\[\]\?={} \t]+)|("[^"]*"))/g;
		var matches = link.match(linkexp);
		var rels = {};
		for (var i = 0; i < matches.length; i++) {
			var split = matches[i].split('>');
			var href = split[0].substring(1);
			var ps = split[1];
			var s = ps.match(paramexp);
			for (var j = 0; j < s.length; j++) {
				var p = s[j];
				var paramsplit = p.split('=');
				var name = paramsplit[0];
				var rel = paramsplit[1].replace(/["']/g, '');
				rels[rel] = href;
			}
		}
		return rels;
	},
	
	
	_parseJSON: function (json) {
		try {
			json = JSON.parse(json);
		}
		catch (e) {
			Zotero.debug(e, 1);
			Zotero.debug(json, 1);
			throw e;
		}
		return json;
	},
	
	
	_checkBackoff: function (xmlhttp) {
		var backoff = xmlhttp.getResponseHeader("Backoff");
		if (backoff && parseInt(backoff) == backoff) {
			// TODO: Update status?
			this.caller.pause(backoff * 1000);
		}
	},
	
	
	_checkRetry: function (xmlhttp) {
		var retryAfter = xmlhttp.getResponseHeader("Retry-After");
		var delay;
		if (!retryAfter) return false;
		if (parseInt(retryAfter) != retryAfter) {
			Zotero.logError(`Invalid Retry-After delay ${retryAfter}`);
			return false;
		}
		// TODO: Update status?
		delay = retryAfter;
		this.caller.pause(delay * 1000);
		return true;
	},
	
	
	_check412: function (xmlhttp) {
		// Avoid logging error from Zotero.HTTP.request() in ConcurrentCaller
		if (xmlhttp.status == 412) {
			Zotero.debug("Server returned 412: " + xmlhttp.responseText, 2);
			throw new Zotero.HTTP.UnexpectedStatusException(xmlhttp);
		}
	},
	
	
	_check429: function (xmlhttp) {
		if (xmlhttp.status != 429) return false;
		
		// If there's a Retry-After header, use that
		if (this._checkRetry(xmlhttp)) {
			return true;
		}
		
		// Otherwise, pause for increasing amounts, or max amount if no more
		var delay = this.rateDelayIntervals[this.rateDelayPosition++]
			|| this.rateDelayIntervals[this.rateDelayIntervals.length - 1];
		this.caller.pause(delay * 1000);
		return true;
	},
	
	
	_getLastModifiedVersion: function (xmlhttp) {
		libraryVersion = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!libraryVersion) {
			throw new Error("Last-Modified-Version not provided");
		}
		return libraryVersion;
	}
}
