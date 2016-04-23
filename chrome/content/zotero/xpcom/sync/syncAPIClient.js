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
	
	this.failureDelayIntervals = [2500, 5000, 10000, 20000, 40000, 60000, 120000, 240000, 300000];
	this.failureDelayMax = 60 * 60 * 1000; // 1 hour
}

Zotero.Sync.APIClient.prototype = {
	MAX_OBJECTS_PER_REQUEST: 100,
	MIN_GZIP_SIZE: 1000,
	
	
	getKeyInfo: Zotero.Promise.coroutine(function* (options={}) {
		var uri = this.baseURL + "keys/" + this.apiKey;
		let opts = {};
		Object.assign(opts, options);
		opts.successCodes = [200, 404];
		var xmlhttp = yield this.makeRequest("GET", uri, opts);
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
		var xmlhttp = yield this.makeRequest("GET", uri);
		return this._parseJSON(xmlhttp.responseText);
	}),
	
	
	/**
	 * @param {Integer} groupID
	 * @return {Object|false} - Group metadata response, or false if group not found
	 */
	getGroupInfo: Zotero.Promise.coroutine(function* (groupID) {
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
		// Avoid logging error from Zotero.HTTP.request() in ConcurrentCaller
		if (xmlhttp.status == 412) {
			Zotero.debug("Server returned 412: " + xmlhttp.responseText, 2);
			throw new Zotero.HTTP.UnexpectedStatusException(xmlhttp);
		}
		libraryVersion = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!libraryVersion) {
			throw new Error("Last-Modified-Version not provided");
		}
		return libraryVersion;
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
			successCodes: [200, 412]
		});
		// Avoid logging error from Zotero.HTTP.request() in ConcurrentCaller
		if (xmlhttp.status == 412) {
			Zotero.debug("Server returned 412: " + xmlhttp.responseText, 2);
			throw new Zotero.HTTP.UnexpectedStatusException(xmlhttp);
		}
		libraryVersion = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!libraryVersion) {
			throw new Error("Last-Modified-Version not provided");
		}
		return {
			libraryVersion,
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
			successCodes: [204, 412]
		});
		// Avoid logging error from Zotero.HTTP.request() in ConcurrentCaller
		if (xmlhttp.status == 412) {
			Zotero.debug("Server returned 412: " + xmlhttp.responseText, 2);
			throw new Zotero.HTTP.UnexpectedStatusException(xmlhttp);
		}
		libraryVersion = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!libraryVersion) {
			throw new Error("Last-Modified-Version not provided");
		}
		return libraryVersion;
	}),
	
	
	getFullTextVersions: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, since) {
		var params = {
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			target: "fulltext"
		};
		if (since) {
			params.since = since;
		}
		
		// TODO: Use pagination
		var uri = this.buildRequestURI(params);
		
		var xmlhttp = yield this.makeRequest("GET", uri);
		var libraryVersion = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!libraryVersion) {
			throw new Error("Last-Modified-Version not provided");
		}
		return {
			libraryVersion: libraryVersion,
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
		var xmlhttp = yield this.makeRequest("GET", uri);
		var version = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!version) {
			throw new Error("Last-Modified-Version not provided");
		}
		return {
			version,
			data: this._parseJSON(xmlhttp.responseText)
		};
	}),
	
	
	setFullTextForItem: Zotero.Promise.coroutine(function* (libraryType, libraryTypeID, itemKey, data) {
		var params = {
			libraryType: libraryType,
			libraryTypeID: libraryTypeID,
			target: `items/${itemKey}/fulltext`
		};
		var uri = this.buildRequestURI(params);
		var xmlhttp = yield this.makeRequest(
			"PUT",
			uri,
			{
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(data),
				successCodes: [204],
				debug: true
			}
		);
		var libraryVersion = xmlhttp.getResponseHeader('Last-Modified-Version');
		if (!libraryVersion) {
			throw new Error("Last-Modified-Version not provided");
		}
		return libraryVersion;
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
		yield this.makeRequest("DELETE", this.baseURL + "keys/" + this.apiKey);
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
		newHeaders["Zotero-API-Version"] = this.apiVersion;
		if (this.apiKey) {
			newHeaders["Zotero-API-Key"] = this.apiKey;
		}
		return newHeaders;
	},
	
	
	makeRequest: Zotero.Promise.coroutine(function* (method, uri, options = {}) {
		if (!this.apiKey && !options.noAPIKey) {
			throw new Error('API key not set');
		}
		let opts = {}
		Object.assign(opts, options);
		opts.headers = this.getHeaders(options.headers);
		opts.dontCache = true;
		opts.foreground = !options.background;
		opts.responseType = options.responseType || 'text';
		if (options.body && options.body.length >= this.MIN_GZIP_SIZE
				&& Zotero.Prefs.get('sync.server.compressData')) {
			opts.compressBody = true;
		}
		
		var tries = 0;
		var failureDelayGenerator = null;
		while (true) {
			var result = yield this.caller.start(Zotero.Promise.coroutine(function* () {
				try {
					var xmlhttp = yield Zotero.HTTP.request(method, uri, opts);
					this._checkBackoff(xmlhttp);
					return xmlhttp;
				}
				catch (e) {
					tries++;
					if (e instanceof Zotero.HTTP.UnexpectedStatusException) {
						this._checkConnection(e.xmlhttp, e.channel);
						//this._checkRetry(e.xmlhttp);
						
						if (e.is5xx()) {
							Zotero.logError(e);
							if (!failureDelayGenerator) {
								// Keep trying for up to an hour
								failureDelayGenerator = Zotero.Utilities.Internal.delayGenerator(
									this.failureDelayIntervals, this.failureDelayMax
								);
							}
							let keepGoing = yield failureDelayGenerator.next().value;
							if (!keepGoing) {
								Zotero.logError("Failed too many times");
								throw e;
							}
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
	
	
	/**
	 * Check connection for certificate errors, interruptions, and empty responses and
	 * throw an appropriate error
	 */
	_checkConnection: function (xmlhttp, channel) {
		const Ci = Components.interfaces;
		
		if (!xmlhttp.responseText && (xmlhttp.status == 0 || xmlhttp.status == 200)) {
			let msg = null;
			let dialogButtonText = null;
			let dialogButtonCallback = null;
			
			// Check SSL cert
			if (channel) {
				let secInfo = channel.securityInfo;
				if (secInfo instanceof Ci.nsITransportSecurityInfo) {
					secInfo.QueryInterface(Ci.nsITransportSecurityInfo);
					if ((secInfo.securityState & Ci.nsIWebProgressListener.STATE_IS_INSECURE)
							== Ci.nsIWebProgressListener.STATE_IS_INSECURE) {
						let url = channel.name;
						let ios = Components.classes["@mozilla.org/network/io-service;1"]
							.getService(Components.interfaces.nsIIOService);
						try {
							var uri = ios.newURI(url, null, null);
							var host = uri.host;
						}
						catch (e) {
							Zotero.debug(e);
						}
						let kbURL = 'https://www.zotero.org/support/kb/ssl_certificate_error';
						msg = Zotero.getString('sync.storage.error.webdav.sslCertificateError', host);
						dialogButtonText = Zotero.getString('general.moreInformation');
						dialogButtonCallback = function () {
							let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								.getService(Components.interfaces.nsIWindowMediator);
							let win = wm.getMostRecentWindow("navigator:browser");
							win.ZoteroPane.loadURI(kbURL, { metaKey: true, shiftKey: true });
						};
					}
					else if ((secInfo.securityState & Ci.nsIWebProgressListener.STATE_IS_BROKEN)
							== Ci.nsIWebProgressListener.STATE_IS_BROKEN) {
						msg = Zotero.getString('sync.error.sslConnectionError');
					}
				}
			}
			if (!msg && xmlhttp.status === 0) {
				msg = Zotero.getString('sync.error.checkConnection');
			}
			if (!msg) {
				msg = Zotero.getString('sync.error.emptyResponseServer')
					+ Zotero.getString('general.tryAgainLater');
			}
			throw new Zotero.Error(
				msg,
				0,
				{
					dialogButtonText,
					dialogButtonCallback
				}
			);
		}
	},
	
	
	_checkBackoff: function (xmlhttp) {
		var backoff = xmlhttp.getResponseHeader("Backoff");
		if (backoff) {
			// Sanity check -- don't wait longer than an hour
			if (backoff > 3600) {
				// TODO: Update status?
				
				this.caller.pause(backoff * 1000);
			}
		}
	}
}
