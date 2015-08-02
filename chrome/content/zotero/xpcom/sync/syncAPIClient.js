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
	this.baseURL = options.baseURL;
	this.apiKey = options.apiKey;
	this.concurrentCaller = options.concurrentCaller;
	
	if (options.apiVersion == undefined) {
		throw new Error("options.apiVersion not set");
	}
	this.apiVersion = options.apiVersion;
}

Zotero.Sync.APIClient.prototype = {
	MAX_OBJECTS_PER_REQUEST: 100,
	
	
	getKeyInfo: Zotero.Promise.coroutine(function* () {
		var uri = this.baseURL + "keys/" + this.apiKey;
		var xmlhttp = yield this._makeRequest("GET", uri, { successCodes: [200, 404] });
		if (xmlhttp.status == 404) {
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
		var xmlhttp = yield this._makeRequest("GET", uri);
		return this._parseJSON(xmlhttp.responseText);
	}),
	
	
	/**
	 * @param {Integer} groupID
	 * @return {Object|false} - Group metadata response, or false if group not found
	 */
	getGroupInfo: Zotero.Promise.coroutine(function* (groupID) {
		if (!groupID) throw new Error("Group ID not provided");
		
		var uri = this.baseURL + "groups/" + groupID;
		var xmlhttp = yield this._makeRequest("GET", uri, { successCodes: [200, 404] });
		if (xmlhttp.status == 404) {
			return false;
		}
		return this._parseJSON(xmlhttp.responseText);
	}),
	
	
	getSettings: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, since) {
		var params = {
			target: "settings",
			libraryType: libraryType,
			libraryTypeID: libraryTypeID
		};
		if (since) {
			params.since = since;
		}
		var uri = this._buildRequestURI(params);
		var options = {
			successCodes: [200, 304]
		};
		if (since) {
			options.headers = {
				"If-Modified-Since-Version": since
			};
		}
		var xmlhttp = yield this._makeRequest("GET", uri, options);
		if (xmlhttp.status == 304) {
			return false;
		}
		var libraryVersion = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!libraryVersion) {
			throw new Error("Last-Modified-Version not provided");
		}
		return {
			libraryVersion: libraryVersion,
			settings: this._parseJSON(xmlhttp.responseText)
		};
	}),
	
	
	/**
	 * @return {Object|false} - An object with 'libraryVersion' and a 'deleted' array, or
	 *     false if 'since' is earlier than the beginning of the delete log
	 */
	getDeleted: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, since) {
		var params = {
			target: "deleted",
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			since: since || 0
		};
		var uri = this._buildRequestURI(params);
		var xmlhttp = yield this._makeRequest("GET", uri, { successCodes: [200, 409] });
		if (xmlhttp.status == 409) {
			Zotero.debug(`'since' value '${since}' is earlier than the beginning of the delete log`);
			return false;
		}
		var libraryVersion = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!libraryVersion) {
			throw new Error("Last-Modified-Version not provided");
		}
		return {
			libraryVersion: libraryVersion,
			deleted: this._parseJSON(xmlhttp.responseText)
		};
	}),
	
	
	/**
	 * Return a promise for a JS object with object keys as keys and version
	 * numbers as values. By default, returns all objects in the library.
	 * Additional parameters (such as 'since', 'sincetime', 'libraryVersion')
	 * can be passed in 'params'.
	 *
	 * @param {String} libraryType  'user' or 'group'
	 * @param {Integer} libraryTypeID  userID or groupID
	 * @param {String} objectType  'item', 'collection', 'search'
	 * @param {Object} queryParams  Query parameters (see _buildRequestURI())
	 * @return {Promise<Object>|FALSE} Object with 'libraryVersion' and 'results'
	 */
	getVersions: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, objectType, queryParams, libraryVersion) {
		var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		
		var params = {
			target: objectTypePlural,
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			format: 'versions'
		};
		if (queryParams) {
			for (let i in queryParams) {
				params[i] = queryParams[i];
			}
		}
		if (objectType == 'item') {
			params.includeTrashed = 1;
		}
		
		// TODO: Use pagination
		var uri = this._buildRequestURI(params);
		
		var options = {
			successCodes: [200, 304]
		};
		if (libraryVersion) {
			options.headers = {
				"If-Modified-Since-Version": libraryVersion
			};
		}
		var xmlhttp = yield this._makeRequest("GET", uri, options);
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
		var uri = this._buildRequestURI(params);
		
		return [
			this._makeRequest("GET", uri)
			.then(function (xmlhttp) {
				return this._parseJSON(xmlhttp.responseText)
			}.bind(this))
			// Return the error without failing the whole chain
			.catch(function (e) {
				if (e instanceof Zotero.HTTP.UnexpectedStatusException && e.is4xx()) {
					Zotero.logError(e);
					throw e;
				}
				Zotero.logError(e);
				return e;
			})
		];
	},
	
	
	uploadObjects: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, objectType, method, version, objects) {
		if (method != 'POST' && method != 'PATCH') {
			throw new Error("Invalid method '" + method + "'");
		}
		
		var objectTypePlural = Zotero.DataObjectUtilities.getObjectTypePlural(objectType);
		
		Zotero.debug("Uploading " + objects.length + " "
			+ (objects.length == 1 ? objectType : objectTypePlural));
		
		Zotero.debug("Sending If-Unmodified-Since-Version: " + version);
		
		var json = JSON.stringify(objects);
		var params = {
			target: objectTypePlural,
			libraryType: libraryType,
			libraryTypeID: libraryTypeID
		};
		var uri = this._buildRequestURI(params);
		
		var xmlhttp = yield this._makeRequest(method, uri, {
			headers: {
				"If-Unmodified-Since-Version": version
			},
			body: json,
			successCodes: [200, 412]
		});
		// Avoid logging error from Zotero.HTTP.request() in ConcurrentCaller
		if (xmlhttp.status == 412) {
			Zotero.debug("Server returned 412: " + xmlhttp.responseText, 2);
			throw new Zotero.HTTP.UnexpectedStatusException(xmlhttp);
		}
		var libraryVersion = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!libraryVersion) {
			throw new Error("Last-Modified-Version not provided");
		}
		return {
			libraryVersion: libraryVersion,
			results: this._parseJSON(xmlhttp.responseText)
		};
	}),
	
	
	_buildRequestURI: function (params) {
		var uri = this.baseURL;
		
		switch (params.libraryType) {
		case 'publications':
			uri += 'users/' + params.libraryTypeID + '/' + params.libraryType;
			break;
		
		default:
			uri += params.libraryType + 's/' + params.libraryTypeID;
			break;
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
	
	
	_makeRequest: function (method, uri, options) {
		if (!options) {
			options = {};
		}
		if (!options.headers) {
			options.headers = {};
		}
		options.headers["Zotero-API-Version"] = this.apiVersion;
		options.dontCache = true;
		options.foreground = !options.background;
		options.responseType = options.responseType || 'text';
		if (this.apiKey) {
			options.headers.Authorization = "Bearer " + this.apiKey;
		}
		var self = this;
		return this.concurrentCaller.fcall(function () {
			return Zotero.HTTP.request(method, uri, options)
			.catch(function (e) {
				if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
					self._checkResponse(e.xmlhttp);
				}
				throw e;
			});
		});
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
	
	
	_checkResponse: function (xmlhttp) {
		this._checkBackoff(xmlhttp);
		this._checkAuth(xmlhttp);
	},
	
	
	_checkAuth: function (xmlhttp) {
		if (xmlhttp.status == 403) {
			var e = new Zotero.Error(Zotero.getString('sync.error.invalidLogin'), "INVALID_SYNC_LOGIN");
			e.fatal = true;
			throw e;
		}
	},
	
	
	_checkBackoff: function (xmlhttp) {
		var backoff = xmlhttp.getResponseHeader("Backoff");
		if (backoff) {
			// Sanity check -- don't wait longer than an hour
			if (backoff > 3600) {
				// TODO: Update status?
				
				this.concurrentCaller.pause(backoff * 1000);
			}
		}
	}
}
