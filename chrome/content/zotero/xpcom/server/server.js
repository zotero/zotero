/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
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

var { HttpServer } = ChromeUtils.importESModule("chrome://remote/content/server/httpd.sys.mjs");
Components.utils.import("resource://gre/modules/NetUtil.jsm");

Zotero.Server = new function() {
	var _onlineObserverRegistered, serv;
	this.responseCodes = {
		200:"OK",
		201:"Created",
		204:"No Content",
		300:"Multiple Choices",
		304:"Not Modified",
		400:"Bad Request",
		403:"Forbidden",
		404:"Not Found",
		409:"Conflict",
		412:"Precondition Failed",
		500:"Internal Server Error",
		501:"Not Implemented",
		503:"Service Unavailable",
		504:"Gateway Timeout"
	};
	
	Object.defineProperty(this, 'port', {
		get() {
			if (!serv) {
				throw new Error('Server not initialized');
			}
			return serv.identity.primaryPort;
		}
	});
	
	/**
	 * initializes a very rudimentary web server
	 */
	this.init = function (port) {
		if (serv) {
			Zotero.debug("Already listening on port " + serv.port);
			return;
		}
		
		port = port || Zotero.Prefs.get('httpServer.port');
		try {
			serv = new HttpServer();
			serv.registerPrefixHandler('/', this.handleRequest)
			serv.start(port);
			
			Zotero.debug(`HTTP server listening on 127.0.0.1:${serv.identity.primaryPort}`);
				
			// Close port on Zotero shutdown (doesn't apply to translation-server)
			if (Zotero.addShutdownListener) {
				Zotero.addShutdownListener(this.close.bind(this));
			}
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug("Not initializing HTTP server");
			serv = undefined;
		}
	};
	
	this.handleRequest = function (request, response) {
		let requestHandler = new Zotero.Server.RequestHandler(request, response);
		return requestHandler.handleRequest();
	}
	
	/**
	 * releases bound port
	 */
	this.close = function () {
		if (!serv) return;
		serv.stop();
		serv = undefined;
	};
	
	/**
	 * Parses a query string into a key => value object
	 * @param {String} queryString Query string
	 */
	this.decodeQueryString = function(queryString) {
		var splitData = queryString.split("&");
		var decodedData = {};
		for (let variable of splitData) {
			var splitIndex = variable.indexOf("=");
			decodedData[decodeURIComponent(variable.substr(0, splitIndex))] = decodeURIComponent(variable.substr(splitIndex+1));
		}
		return decodedData;
	}
}


// A proxy headers class to make header retrieval case-insensitive
Zotero.Server.Headers = class {
	constructor() {
		return new Proxy(this, {
			get(target, name, receiver) {
				if (typeof name !== 'string') {
					return Reflect.get(target, name, receiver);
				}
				return Reflect.get(target, name.toLowerCase(), receiver);
			},
			has(target, name, receiver) {
				if (typeof name !== 'string') {
					return Reflect.has(target, name, receiver);
				}
				return Reflect.has(target, name.toLowerCase(), receiver);
			},
			set(target, name, value, receiver) {
				return Reflect.set(target, name.toLowerCase(), value, receiver);
			}
		});
	}
};


Zotero.Server.networkStreamToString = function (stream, length) {
	let data = NetUtil.readInputStreamToString(stream, length);
	return Zotero.Utilities.Internal.decodeUTF8(data);
};


Zotero.Server.RequestHandler = function (request, response) {
	this.body = "";
	this.bodyLength = 0;
	
	this.foundReturn = false;
	this.request = request;
	this.response = response;
}

/*
 * checks to see if Content-Length bytes of body have been read and, if so, processes the body
 */
Zotero.Server.RequestHandler.prototype._bodyData = function () {
	const PLAIN_TEXT_CONTENT_TYPES = new Set([
		'text/plain',
		'application/json',
		'application/x-www-form-urlencoded'
	]);
	
	let data = null;
	if (this.bodyLength > 0) {
		if (PLAIN_TEXT_CONTENT_TYPES.has(this.contentType)) {
			this.body = data = Zotero.Server.networkStreamToString(this.request.bodyInputStream, this.bodyLength);
		}
		else if (this.contentType === 'multipart/form-data') {
			data = NetUtil.readInputStreamToString(this.request.bodyInputStream, this.bodyLength);
			try {
				data = this._decodeMultipartData(data);
			}
			catch (e) {
				return this._requestFinished(this._generateResponse(400, "text/plain", "Invalid multipart/form-data provided\n"));
			}
		}
	}
	if (this.body.length >= this.bodyLength) {
		let noLogEndpoints = [
			'/connector/saveSingleFile'
		];
		if (this.body != '{}'
				&& PLAIN_TEXT_CONTENT_TYPES.has(this.contentType)
				&& !noLogEndpoints.includes(this.pathname)) {
			Zotero.debug(Zotero.Utilities.ellipsize(this.body, 1000, false, true), 5);
		}
	}
	// handle envelope
	this._processEndpoint("POST", data); // async
}


/**
 * Generates the response to an HTTP request
 */
Zotero.Server.RequestHandler.prototype._generateResponse = function (status, contentTypeOrHeaders, body) {
	var response = "HTTP/1.0 "+status+" "+Zotero.Server.responseCodes[status]+"\r\n";
	response += "X-Zotero-Version: "+Zotero.version+"\r\n";
	response += "X-Zotero-Connector-API-Version: "+CONNECTOR_API_VERSION+"\r\n";
		
	if (this.origin === ZOTERO_CONFIG.BOOKMARKLET_ORIGIN) {
		response += "Access-Control-Allow-Origin: " + this.origin + "\r\n";
		response += "Access-Control-Allow-Methods: POST, GET, OPTIONS\r\n";
		response += "Access-Control-Allow-Headers: Content-Type,X-Zotero-Connector-API-Version,X-Zotero-Version\r\n";
	}
	
	if (contentTypeOrHeaders) {
		if (typeof contentTypeOrHeaders == 'string') {
			contentTypeOrHeaders = {
				'Content-Type': contentTypeOrHeaders
			};
		}
		for (let header in contentTypeOrHeaders) {
			response += `${header}: ${contentTypeOrHeaders[header]}\r\n`;
		}
	}
	
	if (body) {
		response += "\r\n"+body;
	} else {
		response += "Content-Length: 0\r\n\r\n";
	}
	
	return response;
}

Zotero.Server.RequestHandler.prototype.handleRequest = async function () {
	const request = this.request;
	const response = this.response;
	// Tell httpd that we will be constructing our own response
	// without its custom methods, asynchronously
	response.seizePower();

	let requestDebug = `${request.method} ${request.path} HTTP/${request.httpVersion}\n`
	// Parse headers into this.headers with lowercase names
	this.headers = new Zotero.Server.Headers();
	for (let { data: name } of request.headers) {
		requestDebug += `${name}: ${request.getHeader(name)}\n`;
		this.headers[name.toLowerCase()] = request.getHeader(name);
	}
	
	Zotero.debug(requestDebug, 5);
	
	if (this.headers.origin) {
		this.origin = this.headers.origin;
	}
	
	this.pathname = request.path;
	this.query = request.queryString;
	
	// get content-type
	var contentType = this.headers['content-type'];
	if (contentType) {
		let splitContentType = contentType.split(/\s*;/);
		this.contentType = splitContentType[0];
	}
	
	this.pathParams = {};
	if (Zotero.Server.Endpoints[this.pathname]) {
		this.endpoint = Zotero.Server.Endpoints[this.pathname];
	}
	else {
		let router = new Zotero.Router(this.pathParams);
		for (let [potentialTemplate, endpoint] of Object.entries(Zotero.Server.Endpoints)) {
			if (!potentialTemplate.includes(':')) continue;
			router.add(potentialTemplate, () => {
				this.pathParams._endpoint = endpoint;
			}, true, /* Do not allow missing params */ false);
		}
		if (router.run(this.pathname)) {
			this.endpoint = this.pathParams._endpoint;
			delete this.pathParams._endpoint;
			delete this.pathParams.url;
		}
		else {
			this._requestFinished(this._generateResponse(404, "text/plain", "No endpoint found\n"));
			return;
		}
	}
	
	if (request.method == "HEAD" || request.method == "OPTIONS") {
		this._requestFinished(this._generateResponse(200));
	}
	else if (request.method == "GET") {
		this._processEndpoint("GET", null); // async
	}
	else if (request.method == "POST") {
		const contentLengthRe = /^([0-9]+)$/;
		
		// parse content length
		var m = contentLengthRe.exec(this.headers['content-length']);
		if(!m) {
			this._requestFinished(this._generateResponse(400, "text/plain", "Content-length not provided\n"));
			return;
		}
		
		this.bodyLength = parseInt(m[1]);
		this._bodyData();
	} else {
		this._requestFinished(this._generateResponse(501, "text/plain", "Method not implemented\n"));
	}
}

/**
 * Generates a response based on calling the function associated with the endpoint
 *
 * Note: postData contains raw bytes and should be decoded before use
 */
Zotero.Server.RequestHandler.prototype._processEndpoint = async function (method, postData) {
	try {
		var endpoint = new this.endpoint;
		
		// Check that endpoint supports method
		if (endpoint.supportedMethods && endpoint.supportedMethods.indexOf(method) === -1) {
			this._requestFinished(this._generateResponse(400, "text/plain", "Endpoint does not support method\n"));
			return;
		}
		
		var isBrowser = (this.headers['user-agent'] && this.headers['user-agent'].startsWith('Mozilla/'))
			// Origin isn't sent via fetch() for HEAD/GET, but for crazy UA strings, protecting
			// POST requests is better than nothing
			|| 'origin' in this.headers;
		if (isBrowser
				// Allow endpoints to explicitly opt into allowing browser requests
				// if they really want to
				&& !endpoint.allowRequestsFromUnsafeWebContent
				&& !this.headers['x-zotero-connector-api-version']
				&& !this.headers['zotero-allowed-request']
				// Allow browser requests test endpoints
				&& !this.pathname.startsWith('/test/')
				// Allow browser requests to /connector/ping as long as they come
				// from navigation, not XHR/fetch()/resource loading
				&& !(this.pathname === '/connector/ping' && this.headers['sec-fetch-mode'] === 'navigate')) {
			Zotero.debug('Preventing request from browser');
			this._cancelResponse();
			return;
		}
		
		var data = null;
		if (method === 'POST' && this.contentType) {
			// check that endpoint supports contentType
			var supportedDataTypes = endpoint.supportedDataTypes;
			if (supportedDataTypes && supportedDataTypes != '*'
				&& supportedDataTypes.indexOf(this.contentType) === -1) {
				this._requestFinished(this._generateResponse(400, "text/plain", "Endpoint does not support content-type\n"));
				return;
			}
			
			// decode content-type post data
			if (this.contentType === "application/json") {
				try {
					data = JSON.parse(postData);
				}
				catch(e) {
					this._requestFinished(this._generateResponse(400, "text/plain", "Invalid JSON provided\n"));
					return;
				}
			}
			else if (this.contentType === "application/x-www-form-urlencoded") {
				data = Zotero.Server.decodeQueryString(postData);
			}
			else if (postData) {
				data = postData;
			}
			else {
				data = this.request.bodyInputStream;
			}
		}
		
		// set up response callback
		var sendResponseCallback = (code, contentTypeOrHeaders, arg, options) => {
			this._requestFinished(
				this._generateResponse(code, contentTypeOrHeaders, arg),
				options
			);
		};
		
		// Pass to endpoint
		//
		// Single-parameter endpoint
		//   - Takes an object with 'method', 'pathname', 'pathParams', 'searchParams', 'headers', and 'data'
		//   - Returns a status code, an array containing [statusCode, contentType, body],
		//     or a promise for either
		if (endpoint.init.length === 1
				// Return value from Zotero.Promise.coroutine()
				|| endpoint.init.length === 0) {
			
			let maybePromise = endpoint.init({
				method,
				pathname: this.pathname,
				pathParams: this.pathParams,
				searchParams: new URLSearchParams(this.query || ''),
				headers: this.headers,
				data
			});
			let result;
			if (maybePromise.then) {
				result = await maybePromise;
			}
			else {
				result = maybePromise;
			}
			if (Number.isInteger(result)) {
				sendResponseCallback(result);
			}
			else {
				sendResponseCallback(...result);
			}
		}
		// Two-parameter endpoint takes data and a callback
		else if (endpoint.init.length === 2) {
			endpoint.init(data, sendResponseCallback);
		}
		// Three-parameter endpoint takes a URL, data, and a callback
		else {
			var url = {
				pathname: this.pathname,
				searchParams: new URLSearchParams(this.query || ''),
				userAgent: this.headers['user-agent']
			};
			endpoint.init(url, data, sendResponseCallback);
		}
	} catch(e) {
		Zotero.debug(e);
		this._requestFinished(this._generateResponse(500), "text/plain", "An error occurred\n");
		throw e;
	}
};

/*
 * returns HTTP data from a request
 */
Zotero.Server.RequestHandler.prototype._requestFinished = function (responseBody, options) {
	if (this._responseSent) {
		Zotero.debug("Request already finished; not sending another response");
		return;
	}
	this._responseSent = true;
	
	// open UTF-8 converter for output stream	
	var intlStream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
							   .createInstance(Components.interfaces.nsIConverterOutputStream);
	
	// write
	try {
		intlStream.init(this.response.bodyOutputStream, "UTF-8", 1024, "?".charCodeAt(0));
		
		// Filter logged response
		if (Zotero.Debug.enabled) {
			let maxLogLength = 2000;
			let str = responseBody;
			if (options && options.logFilter) {
				str = options.logFilter(str);
			}
			if (str.length > maxLogLength) {
				str = str.substr(0, maxLogLength) + `\u2026 (${responseBody.length} chars)`;
			}
			Zotero.debug(str, 5);
		}
		
		intlStream.writeString(responseBody);
	}
	finally {
		this.response.finish();
	}
};

Zotero.Server.RequestHandler.prototype._cancelResponse = function () {
	// Close the connection without sending anything back, so web content can't
	// get any information about whether Zotero is running.
	//
	// This causes fetch() to throw a TypeError with the message
	// "NetworkError when attempting to fetch resource.", exactly the same as
	// when no server is running on our port.
	if (this._responseSent) {
		Zotero.debug('Request already finished; not cancelling');
		return;
	}
	Zotero.debug('Cancelling without sending a response');
	this._responseSent = true;
	this.response.finish();
};

Zotero.Server.RequestHandler.prototype._decodeMultipartData = function(data) {
	const contentDispositionRe = /^Content-Disposition:\s*(.*)$/i;
	const contentTypeRe = /^Content-Type:\s*(.*)$/i

	let results = [];
	
	let boundary = /boundary=([^\s]*)/i.exec(this.headers['content-type']);
	if (!boundary) {
		Zotero.debug('Invalid boundary: ' + this.headers['content-type'], 1);
		return this._requestFinished(this._generateResponse(400, "text/plain", "Invalid multipart/form-data provided\n"));
	}
	boundary = '--' + boundary[1];
	
	data = data.split(boundary);
	// Ignore pre first boundary and post last boundary
	data = data.slice(1, data.length-1);
	for (let field of data) {
		let fieldData = {};
		// Split header and body
		let unixHeaderBoundary = field.indexOf("\n\n");
		let windowsHeaderBoundary = field.indexOf("\r\n\r\n");
		if (unixHeaderBoundary < windowsHeaderBoundary && unixHeaderBoundary != -1) {
			fieldData.header = field.slice(0, unixHeaderBoundary).trim();
			fieldData.body = field.slice(unixHeaderBoundary+2).trim();
		} else if (windowsHeaderBoundary != -1) {
			fieldData.header = field.slice(0, windowsHeaderBoundary).trim();
			fieldData.body = field.slice(windowsHeaderBoundary+4).trim();
		} else {
			// Only log first 200 characters in case the part is large
			Zotero.debug('Malformed multipart/form-data body: ' + field.substr(0, 200), 1);
			throw new Error('Malformed multipart/form-data body');
		}
		
		fieldData.params = {};
		let headers = [];
		if (fieldData.header.indexOf("\r\n") > -1) {
			headers = fieldData.header.split("\r\n");
		}
		else if (fieldData.header.indexOf("\n\n") > -1) {
			headers = fieldData.header.split("\n\n");
		}
		else {
			headers = [fieldData.header];
		}
		for (const header of headers) {
			if (contentDispositionRe.test(header)) {
				// Example:
				// Content-Disposition: form-data; name="fieldName"; filename="filename.jpg"
				let contentDisposition = header.split(';');
				if (contentDisposition.length > 1) {
					contentDisposition.shift();
					for (let param of contentDisposition) {
						let nameVal = param.trim().split('=');
						fieldData.params[nameVal[0]] = nameVal[1].trim().slice(1, -1);
					}
				}
			}
			else if (contentTypeRe.test(header)) {
				// Example:
				// Content-Type: image/png
				let contentType = header.split(':');
				if (contentType.length > 1) {
					fieldData.params.contentType = contentType[1].trim();
				}
			}
		}
		results.push(fieldData);
	}
	return results;
};


/**
 * Endpoints for the HTTP server
 *
 * Each endpoint should take the form of an object. The init() method of this object will be passed:
 *     method - the method of the request ("GET" or "POST")
 *     data - the query string (for a "GET" request) or POST data (for a "POST" request)
 *     sendResponseCallback - a function to send a response to the HTTP request. This can be passed
 *                            a response code alone (e.g., sendResponseCallback(404)) or a response
 *                            code, MIME type, and response body
 *                            (e.g., sendResponseCallback(200, "text/plain", "Hello World!"))
 *
 * See connector/server_connector.js for examples
 */
Zotero.Server.Endpoints = {}
