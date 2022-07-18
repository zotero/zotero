/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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
    
	
	Utilities based in part on code taken from Piggy Bank 2.1.1 (BSD-licensed)
	
    ***** END LICENSE BLOCK *****
*/

/**
 * @class Utility functions not made available to translators
 */
Zotero.Utilities.Internal = {
	SNAPSHOT_SAVE_TIMEOUT: 30000,

	/**
	 * Run a function on chunks of a given size of an array's elements.
	 *
	 * @param {Array} arr
	 * @param {Integer} chunkSize
	 * @param {Function} func - A promise-returning function
	 * @return {Array} The return values from the successive runs
	 */
	"forEachChunkAsync": async function (arr, chunkSize, func) {
		var retValues = [];
		var tmpArray = arr.concat();
		var num = arr.length;
		var done = 0;
		
		do {
			var chunk = tmpArray.splice(0, chunkSize);
			done += chunk.length;
			retValues.push(await func(chunk));
		}
		while (done < num);
		
		return retValues;
	},
	
	
	/**
	 * Copy a text string to the clipboard
	 */
	"copyTextToClipboard":function(str) {
		Components.classes["@mozilla.org/widget/clipboardhelper;1"]
			.getService(Components.interfaces.nsIClipboardHelper)
			.copyString(str);
	},
	
	
	 /*
	 * Adapted from http://developer.mozilla.org/en/docs/nsICryptoHash
	 *
	 * @param	{String|nsIFile}	strOrFile
	 * @param	{Boolean}			[base64=false]	Return as base-64-encoded string rather than hex string
	 * @return	{String}
	 */
	"md5":function(strOrFile, base64) {
		if (typeof strOrFile == 'string') {
			var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
				createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
			converter.charset = "UTF-8";
			var result = {};
			var data = converter.convertToByteArray(strOrFile, result);
			var ch = Components.classes["@mozilla.org/security/hash;1"]
				.createInstance(Components.interfaces.nsICryptoHash);
			ch.init(ch.MD5);
			ch.update(data, data.length);
		}
		else if (strOrFile instanceof Components.interfaces.nsIFile) {
			if (!strOrFile.exists()) {
				return false;
			}
			
			// Otherwise throws (NS_ERROR_NOT_AVAILABLE) [nsICryptoHash.updateFromStream]
			if (!strOrFile.fileSize) {
				// MD5 for empty string
				return "d41d8cd98f00b204e9800998ecf8427e";
			}
			
			var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
							.createInstance(Components.interfaces.nsIFileInputStream);
			// open for reading
			istream.init(strOrFile, 0x01, 0o444, 0);
			var ch = Components.classes["@mozilla.org/security/hash;1"]
						   .createInstance(Components.interfaces.nsICryptoHash);
			// we want to use the MD5 algorithm
			ch.init(ch.MD5);
			// this tells updateFromStream to read the entire file
			const PR_UINT32_MAX = 0xffffffff;
			ch.updateFromStream(istream, PR_UINT32_MAX);
		}
		
		// pass false here to get binary data back
		var hash = ch.finish(base64);
		
		if (istream) {
			istream.close();
		}
		
		if (base64) {
			return hash;
		}
		
		// return the two-digit hexadecimal code for a byte
		function toHexString(charCode) {
			return ("0" + charCode.toString(16)).slice(-2);
		}
		
		// convert the binary hash data to a hex string.
		var hexStr = "";
		for (let i = 0; i < hash.length; i++) {
			hexStr += toHexString(hash.charCodeAt(i));
		}
		return hexStr;
	},
	
	
	/**
	 * @param {OS.File|nsIFile|String} file  File or file path
	 * @param {Boolean} [base64=FALSE]  Return as base-64-encoded string
	 *                                  rather than hex string
	 */
	md5Async: async function (file, base64) {
		const CHUNK_SIZE = 16384;
		
		function toHexString(charCode) {
			return ("0" + charCode.toString(16)).slice(-2);
		}
		
		var ch = Components.classes["@mozilla.org/security/hash;1"]
				   .createInstance(Components.interfaces.nsICryptoHash);
		ch.init(ch.MD5);
		
		// Recursively read chunks of the file and return a promise for the hash
		let readChunk = async function (file) {
			try {
				let data = await file.read(CHUNK_SIZE);
				ch.update(data, data.length);
				if (data.length == CHUNK_SIZE) {
					return readChunk(file);
				}
				
				let hash = ch.finish(base64);
				// Base64
				if (base64) {
					return hash;
				}
				// Hex string
				let hexStr = "";
				for (let i = 0; i < hash.length; i++) {
					hexStr += toHexString(hash.charCodeAt(i));
				}
				return hexStr;
			}
			catch (e) {
				try {
					ch.finish(false);
				}
				catch (e) {
					Zotero.logError(e);
				}
				throw e;
			}
		};
		
		if (file instanceof OS.File) {
			return readChunk(file);
		}
		
		var path = (file instanceof Components.interfaces.nsIFile) ? file.path : file;
		var hash;
		try {
			var osFile = await OS.File.open(path);
			hash = await readChunk(osFile);
		}
		finally {
			if (osFile) {
				await osFile.close();
			}
		}
		return hash;
	},
	
	
	 /*
	  * Adapted from http://developer.mozilla.org/en/docs/nsICryptoHash
	  *
	  * @param {String} str
	  * @return	{String}
	  */
	sha1: function (str) {
		var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		converter.charset = "UTF-8";
		var result = {};
		var data = converter.convertToByteArray(str, result);
		var ch = Components.classes["@mozilla.org/security/hash;1"]
			.createInstance(Components.interfaces.nsICryptoHash);
		ch.init(ch.SHA1);
		ch.update(data, data.length);
		var hash = ch.finish(false);
		
		// Return the two-digit hexadecimal code for a byte
		function toHexString(charCode) {
			return ("0" + charCode.toString(16)).slice(-2);
		}
		
		// Convert the binary hash data to a hex string.
		var s = Array.from(hash, (c, i) => toHexString(hash.charCodeAt(i))).join("");
		return s;
	},
	
	
	gzip: async function (data) {
		var deferred = Zotero.Promise.defer();
		
		// Get input stream from POST data
		var unicodeConverter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"]
			.createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
		unicodeConverter.charset = "UTF-8";
		var is = unicodeConverter.convertToInputStream(data);
		
		// Initialize stream converter
		var converter = Components.classes["@mozilla.org/streamconv;1?from=uncompressed&to=gzip"]
			.createInstance(Components.interfaces.nsIStreamConverter);
		converter.asyncConvertData(
			"uncompressed",
			"gzip",
			{
				binaryInputStream: null,
				size: 0,
				data: '',
				
				onStartRequest: function (request, context) {},
				
				onStopRequest: function (request, context, status) {
					this.binaryInputStream.close();
					delete this.binaryInputStream;
					
					deferred.resolve(this.data);
				},
				
				onDataAvailable: function (request, context, inputStream, offset, count) {
					this.size += count;
					
					this.binaryInputStream = Components.classes["@mozilla.org/binaryinputstream;1"]
						.createInstance(Components.interfaces.nsIBinaryInputStream)
					this.binaryInputStream.setInputStream(inputStream);
					this.data += this.binaryInputStream.readBytes(this.binaryInputStream.available());
				},
				
				QueryInterface: function (iid) {
					if (iid.equals(Components.interfaces.nsISupports)
						   || iid.equals(Components.interfaces.nsIStreamListener)) {
						return this;
					}
					throw Components.results.NS_ERROR_NO_INTERFACE;
				}
			},
			null
		);
		
		// Send input stream to stream converter
		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"]
			.createInstance(Components.interfaces.nsIInputStreamPump);
		try {
			pump.init(is, 0, 0, true);
		}
		catch (e) {
			pump.init(is, -1, -1, 0, 0, true);
		}
		pump.asyncRead(converter, null);
		
		return deferred.promise;
	},
	
	
	gunzip: async function (data) {
		var deferred = Zotero.Promise.defer();
		
		Components.utils.import("resource://gre/modules/NetUtil.jsm");
		
		var is = Components.classes["@mozilla.org/io/string-input-stream;1"]
			.createInstance(Ci.nsIStringInputStream);
		is.setData(data, data.length);
		
		var bis = Components.classes["@mozilla.org/binaryinputstream;1"]
			.createInstance(Components.interfaces.nsIBinaryInputStream);
		bis.setInputStream(is);
		
		// Initialize stream converter
		var converter = Components.classes["@mozilla.org/streamconv;1?from=gzip&to=uncompressed"]
			.createInstance(Components.interfaces.nsIStreamConverter);
		converter.asyncConvertData(
			"gzip",
			"uncompressed",
			{
				data: '',
				
				onStartRequest: function (request, context) {},
				
				onStopRequest: function (request, context, status) {
					deferred.resolve(this.data);
				},
				
				onDataAvailable: function (request, context, inputStream, offset, count) {
					this.data += NetUtil.readInputStreamToString(
						inputStream,
						inputStream.available(),
						{
							charset: 'UTF-8',
							replacement: 65533
						}
					)
				},
				
				QueryInterface: function (iid) {
					if (iid.equals(Components.interfaces.nsISupports)
						   || iid.equals(Components.interfaces.nsIStreamListener)) {
						return this;
					}
					throw Components.results.NS_ERROR_NO_INTERFACE;
				}
			},
			null
		);
		
		// Send input stream to stream converter
		var pump = Components.classes["@mozilla.org/network/input-stream-pump;1"]
			.createInstance(Components.interfaces.nsIInputStreamPump);
		try {
			pump.init(bis, 0, 0, true);
		}
		catch (e) {
			pump.init(bis, -1, -1, 0, 0, true);
		}
		pump.asyncRead(converter, null);
		
		return deferred.promise;
	},
	
	
	/**
	 * Decode a binary string into a typed Uint8Array
	 *
	 * @param {String} data - Binary string to decode
	 * @return {Uint8Array} Typed array holding data
	 */
	_decodeToUint8Array: function (data) {
		var buf = new ArrayBuffer(data.length);
		var bufView = new Uint8Array(buf);
		for (let i = 0; i < data.length; i++) {
			bufView[i] = data.charCodeAt(i);
		}
		return bufView;
	},
	
	
	/**
	 * Decode a binary string to UTF-8 string
	 *
	 * @param {String} data - Binary string to decode
	 * @return {String} UTF-8 encoded string
	 */
	decodeUTF8: function (data) {
		var bufView = Zotero.Utilities.Internal._decodeToUint8Array(data);
		var decoder = new TextDecoder();
		return decoder.decode(bufView);
	},
	
	
	/**
	 * Return the byte length of a UTF-8 string
	 *
	 * http://stackoverflow.com/a/23329386
	 */
	byteLength: function (str) {
		var s = str.length;
		for (var i=str.length-1; i>=0; i--) {
			var code = str.charCodeAt(i);
			if (code > 0x7f && code <= 0x7ff) s++;
			else if (code > 0x7ff && code <= 0xffff) s+=2;
			if (code >= 0xDC00 && code <= 0xDFFF) i--; //trail surrogate
		}
		return s;
	},
	
	isOnlyEmoji: function (str) {
		// Remove emoji, Zero Width Joiner, and Variation Selector-16 and see if anything's left
		const re = /\p{Extended_Pictographic}|\u200D|\uFE0F/gu;
		return !str.replace(re, '');
	},
	
	/**
	 * Display a prompt from an error with custom buttons and a callback
	 */
	"errorPrompt":function(title, e) {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
		var message, buttonText, buttonCallback;
		
		if (e.dialogButtonText !== undefined) {
			buttonText = e.dialogButtonText;
			buttonCallback = e.dialogButtonCallback;
		}
		if (e.message) {
			message = e.message;
		}
		else {
			message = e;
		}
		
		if (typeof buttonText == 'undefined') {
			buttonText = Zotero.getString('errorReport.reportError');
			buttonCallback = function () {
				var zp = Zotero.getActiveZoteroPane();
				// TODO: Open main window if closed
				if (zp) zp.reportErrors();
			}
		}
		// If secondary button is explicitly null, just use an alert
		else if (buttonText === null) {
			ps.alert(null, title, message);
			return;
		}
		
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK
							+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
		var index = ps.confirmEx(
			null,
			title,
			message,
			buttonFlags,
			"",
			buttonText,
			"", null, {}
		);
		
		if (index == 1) {
			setTimeout(function () { buttonCallback(); }, 1);
		}
	},
	
	
	/**
	 * saveURI wrapper function
	 * @param {nsIWebBrowserPersist} nsIWebBrowserPersist
	 * @param {nsIURI} uri URL
	 * @param {nsIFile|string path} target file
	 * @param {Object} [headers]
	 * @param {Zotero.CookieSandbox} [cookieSandbox]
	 */
	saveURI: function (wbp, uri, target, headers, cookieSandbox) {
		// Handle gzip encoding
		wbp.persistFlags |= wbp.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;
		// If not explicitly using cache, skip it
		if (!(wbp.persistFlags & wbp.PERSIST_FLAGS_FROM_CACHE)) {
			wbp.persistFlags |= wbp.PERSIST_FLAGS_BYPASS_CACHE;
		}
		
		if (typeof uri == 'string') {
			uri = Services.io.newURI(uri, null, null);
		}
		
		target = Zotero.File.pathToFile(target);
		
		if (headers) {
			headers = Object.keys(headers).map(x => x + ": " + headers[x]).join("\r\n") + "\r\n";
		}
		
		// Untested
		if (cookieSandbox) {
			cookieSandbox.attachToInterfaceRequestor(wbp.progressListener);
		}
		
		wbp.saveURI(uri, null, null, null, null, headers, target, null);
	},
	
	
	saveDocument: function (document, destFile) {
		const nsIWBP = Components.interfaces.nsIWebBrowserPersist;
		let wbp = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
			.createInstance(nsIWBP);
		wbp.persistFlags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES
			| nsIWBP.PERSIST_FLAGS_FORCE_ALLOW_COOKIES
			| nsIWBP.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION
			| nsIWBP.PERSIST_FLAGS_FROM_CACHE
			| nsIWBP.PERSIST_FLAGS_CLEANUP_ON_FAILURE
			// Mostly ads
			| nsIWBP.PERSIST_FLAGS_IGNORE_IFRAMES
			| nsIWBP.PERSIST_FLAGS_IGNORE_REDIRECTED_DATA;
		
		let encodingFlags = 0;
		let filesFolder = null;
		if (document.contentType == "text/plain") {
			encodingFlags |= nsIWBP.ENCODE_FLAGS_FORMATTED;
			encodingFlags |= nsIWBP.ENCODE_FLAGS_ABSOLUTE_LINKS;
			encodingFlags |= nsIWBP.ENCODE_FLAGS_NOFRAMES_CONTENT;
		}
		else {
			encodingFlags |= nsIWBP.ENCODE_FLAGS_ENCODE_BASIC_ENTITIES;
			
			// Save auxiliary files to the same folder
			filesFolder = OS.Path.dirname(destFile);
		}
		const wrapColumn = 80;
		
		var deferred = Zotero.Promise.defer();
		var listener = new Zotero.WebProgressFinishListener(function () {
			deferred.resolve();
		});
		wbp.progressListener = listener;
		
		wbp.saveDocument(
			Zotero.Translate.DOMWrapper.unwrap(document),
			Zotero.File.pathToFile(destFile),
			Zotero.File.pathToFile(filesFolder),
			null,
			encodingFlags,
			wrapColumn
		);
		
		// Cancel save after timeout has passed, so we return an error to the connector and don't stay
		// saving forever
		var timeoutID = setTimeout(function () {
			if (deferred.promise.isPending()) {
				Zotero.debug("Stopping save for " + document.location.href, 2);
				//Zotero.debug(listener.getRequest());
				deferred.reject("Snapshot save timeout on " + document.location.href);
				wbp.cancelSave();
			}
		}, this.SNAPSHOT_SAVE_TIMEOUT);
		deferred.promise.then(() => clearTimeout(timeoutID));
		
		return deferred.promise;
	},


	/**
	 * Takes in a document, creates a JS Sandbox and executes the SingleFile
	 * extension to save the page as one single file without JavaScript.
	 *
	 * @param {Object} document
	 * @return {String} Snapshot of the page as a single file
	 */
	snapshotDocument: async function (document) {
		// Create sandbox for SingleFile
		var view = document.defaultView;
		let sandbox = Zotero.Utilities.Internal.createSnapshotSandbox(view);

		const SCRIPTS = [
			// This first script replace in the INDEX_SCRIPTS from the single file cli loader
			"dist/single-file.js",

			// Web SCRIPTS
			"dist/web/hooks/hooks-frames-web.js",
			"dist/web/hooks/hooks-web.js",
		];

		const { loadSubScript } = Components.classes['@mozilla.org/moz/jssubscript-loader;1']
			.getService(Ci.mozIJSSubScriptLoader);

		Zotero.debug('Injecting single file scripts');
		// Run all the scripts of SingleFile scripts in Sandbox
		SCRIPTS.forEach(
			script => loadSubScript('resource://zotero/SingleFile/' + script, sandbox)
		);
		// Import config
		loadSubScript('chrome://zotero/content/xpcom/singlefile.js', sandbox);

		// In the client we turn off this auto-zooming feature because it does not work
		// since the hidden browser does not have a clientHeight.
		Components.utils.evalInSandbox(
			'Zotero.SingleFile.CONFIG.loadDeferredImagesKeepZoomLevel = true;',
			sandbox
		);

		Zotero.debug('Injecting single file scripts into frames');

		// List of scripts from:
		// resource/SingleFile/extension/lib/single-file/core/bg/scripts.js
		const frameScripts = [
			"dist/web/hooks/hooks-frames-web.js",
			"dist/single-file-frames.js",
		];

		// Create sandboxes for all the frames we find
		const frameSandboxes = [];
		for (let i = 0; i < sandbox.window.frames.length; ++i) {
			let frameSandbox = Zotero.Utilities.Internal.createSnapshotSandbox(sandbox.window.frames[i]);

			// Run all the scripts of SingleFile scripts in Sandbox
			frameScripts.forEach(
				script => loadSubScript('resource://zotero/SingleFile/' + script, frameSandbox)
			);

			frameSandboxes.push(frameSandbox);
		}

		// Use SingleFile to retrieve the html
		const pageData = await Components.utils.evalInSandbox(
			`this.singlefile.getPageData(
				Zotero.SingleFile.CONFIG,
				{ fetch: ZoteroFetch }
			);`,
			sandbox
		);

		// Clone so we can nuke the sandbox
		let content = pageData.content;

		// Nuke frames and then main sandbox
		frameSandboxes.forEach(frameSandbox => Components.utils.nukeSandbox(frameSandbox));
		Components.utils.nukeSandbox(sandbox);

		return content;
	},


	createSnapshotSandbox: function (view) {
		let sandbox = new Components.utils.Sandbox(view, {
			wantGlobalProperties: ["XMLHttpRequest", "fetch"],
			sandboxPrototype: view
		});
		sandbox.window = view.window;
		sandbox.document = sandbox.window.document;
		sandbox.browser = false;
		// See comment in babel-worker.js
		sandbox.globalThis = view.window;

		sandbox.Zotero = Components.utils.cloneInto({ HTTP: {} }, sandbox);
		sandbox.Zotero.debug = Components.utils.exportFunction(Zotero.debug, sandbox);
		// Mostly copied from:
		// resources/SingleFile/extension/lib/single-file/fetch/bg/fetch.js::fetchResource
		sandbox.coFetch = Components.utils.exportFunction(
			function (url, onDone) {
				const xhrRequest = new XMLHttpRequest();
				xhrRequest.withCredentials = true;
				xhrRequest.responseType = "arraybuffer";
				xhrRequest.onerror = () => {
					let error = { error: `Request failed for ${url}` };
					onDone(Components.utils.cloneInto(error, sandbox));
				};
				xhrRequest.onreadystatechange = () => {
					if (xhrRequest.readyState == XMLHttpRequest.DONE) {
						if (xhrRequest.status || xhrRequest.response.byteLength) {
							let res = {
								array: new Uint8Array(xhrRequest.response),
								headers: { "content-type": xhrRequest.getResponseHeader("Content-Type") },
								status: xhrRequest.status
							};
							// Ensure sandbox will have access to response by cloning
							onDone(Components.utils.cloneInto(res, sandbox));
						}
						else {
							let error = { error: 'Bad Status or Length' };
							onDone(Components.utils.cloneInto(error, sandbox));
						}
					}
				};
				xhrRequest.open("GET", url, true);
				xhrRequest.send();
			},
			sandbox
		);

		// First we try regular fetch, then proceed with fetch outside sandbox to evade CORS
		// restrictions, partly from:
		// resources/SingleFile/extension/lib/single-file/fetch/content/content-fetch.js::fetch
		Components.utils.evalInSandbox(
			`
			ZoteroFetch = async function (url) {
				try {
					let response = await fetch(url, { cache: "force-cache" });
					return response;
				}
				catch (error) {
					let response = await new Promise((resolve, reject) => {
						coFetch(url, (response) => {
							if (response.error) {
								Zotero.debug("Error retrieving url: " + url);
								Zotero.debug(response);
								reject(new Error(response.error));
							}
							else {
								resolve(response);
							}
						});
					});

					return {
						status: response.status,
						headers: { get: headerName => response.headers[headerName] },
						arrayBuffer: async () => response.array.buffer
					};
				}
			};`,
			sandbox
		);

		return sandbox;
	},
	
	
	/**
	 * Launch a process
	 * @param {nsIFile|String} cmd Path to command to launch
	 * @param {String[]} args Arguments given
	 * @return {Promise} Promise resolved to true if command succeeds, or an error otherwise
	 */
	"exec": Zotero.Promise.method(function (cmd, args) {
		if (typeof cmd == 'string') {
			Components.utils.import("resource://gre/modules/FileUtils.jsm");
			cmd = new FileUtils.File(cmd);
		}
		
		if(!cmd.isExecutable()) {
			throw new Error(cmd.path + " is not an executable");
		}
		
		var proc = Components.classes["@mozilla.org/process/util;1"].
				createInstance(Components.interfaces.nsIProcess);
		proc.init(cmd);
		
		Zotero.debug("Running " + cmd.path + " " + args.map(arg => "'" + arg + "'").join(" "));
		
		var deferred = Zotero.Promise.defer();
		proc.runwAsync(args, args.length, {"observe":function(subject, topic) {
			if(topic !== "process-finished") {
				deferred.reject(new Error(cmd.path+" failed"));
			} else if(proc.exitValue != 0) {
				deferred.reject(new Error(cmd.path+" returned exit status "+proc.exitValue));
			} else {
				deferred.resolve(true);
			}
		}});
		
		return deferred.promise;
	}),

	/**
	 * Get string data from the clipboard
	 * @param {String[]} mimeType MIME type of data to get
	 * @return {String|null} Clipboard data, or null if none was available
	 */
	"getClipboard":function(mimeType) {
		var clip = Services.clipboard;
		if (!clip.hasDataMatchingFlavors([mimeType], 1, clip.kGlobalClipboard)) {
			return null;
		}
		var trans = Components.classes["@mozilla.org/widget/transferable;1"]
						.createInstance(Components.interfaces.nsITransferable);
		trans.addDataFlavor(mimeType);
		clip.getData(trans, clip.kGlobalClipboard);
		var str = {};
		try {
			trans.getTransferData(mimeType, str, {});
			str = str.value.QueryInterface(Components.interfaces.nsISupportsString).data;
		}
		catch (e) {
			return null;
		}
		return str;
	},
	
	/**
	 * Determine if one Window is a descendant of another Window
	 * @param {DOMWindow} suspected child window
	 * @param {DOMWindow} suspected parent window
	 * @return {boolean}
	 */
	"isIframeOf":function isIframeOf(childWindow, parentWindow) {
		while(childWindow.parent !== childWindow) {
			childWindow = childWindow.parent;
			if(childWindow === parentWindow) return true;
		}
	},
	
	
	/**
	 * Returns a DOMDocument object not attached to any window
	 */
	"getDOMDocument": function() {
		return Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser)
			.parseFromString("<!DOCTYPE html><html></html>", "text/html");
	},
	
	
	/**
	 * Update HTML links within XUL
	 *
	 * @param {HTMLElement} elem - HTML element to modify
	 * @param {Object} [options] - Properties:
	 *                                 .linkEvent - An object to pass to ZoteroPane.loadURI() to
	 *                                 simulate modifier keys for link clicks. For example, to
	 *                                 force links to open in new windows, pass with
	 *                                 .shiftKey = true. If not provided, the actual event will
	 *                                 be used instead.
	 *                                 .callback - Function to call after launching URL
	 */
	updateHTMLInXUL: function (elem, options) {
		options = options || {};
		var links = elem.getElementsByTagName('a');
		for (let i = 0; i < links.length; i++) {
			let a = links[i];
			let href = a.getAttribute('href');
			a.setAttribute('tooltiptext', href);
			a.onclick = function (event) {
				Zotero.launchURL(href);
				if (options.callback) {
					options.callback();
				}
				return false;
			};
		}
	},
	
	
	/**
	 * A generator that yields promises that delay for the given intervals
	 *
	 * @param {Array<Integer>} intervals - An array of intervals in milliseconds
	 * @param {Integer} [maxTime] - Total time to wait in milliseconds, after which the delaying
	 *                              promise will return false. Before maxTime has elapsed, or if
	 *                              maxTime isn't specified, the promises will yield true.
	 */
	"delayGenerator": function* (intervals, maxTime) {
		var delay;
		var totalTime = 0;
		var last = false;
		while (true) {
			let interval = intervals.shift();
			if (interval) {
				delay = interval;
			}
			
			if (maxTime && (totalTime + delay) > maxTime) {
				yield Zotero.Promise.resolve(false);
			}
			
			totalTime += delay;
			
			Zotero.debug("Delaying " + delay + " ms");
			yield Zotero.Promise.delay(delay).return(true);
		}
	},
	
	
	/**
	 * Return an input stream that will be filled asynchronously with strings yielded from a
	 * generator. If the generator yields a promise, the promise is waited for, but its value
	 * is not added to the input stream.
	 *
	 * @param {GeneratorFunction|Generator} gen - Promise-returning generator function or
	 *                                            generator
	 * @return {nsIAsyncInputStream}
	 */
	getAsyncInputStream: function (gen, onError) {
		// Initialize generator if necessary
		var g = gen.next ? gen : gen();
		var seq = 0;
		
		const PR_UINT32_MAX = Math.pow(2, 32) - 1;
		var pipe = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
		pipe.init(true, true, 0, PR_UINT32_MAX, null);
		
		var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
			.createInstance(Components.interfaces.nsIConverterOutputStream);
		os.init(pipe.outputStream, 'utf-8', 0, 0x0000);
		
		
		function onOutputStreamReady(aos) {
			let currentSeq = seq++;
			
			var maybePromise = processNextValue();
			// If generator returns a promise, wait for it
			if (maybePromise.then) {
				maybePromise.then(() => onOutputStreamReady(aos));
			}
			// If more data, tell stream we're ready
			else if (maybePromise) {
				aos.asyncWait({ onOutputStreamReady }, 0, 0, Zotero.mainThread);
			}
			// Otherwise close the stream
			else {
				aos.close();
			}
		};
		
		function processNextValue(lastVal) {
			try {
				var result = g.next(lastVal);
				if (result.done) {
					Zotero.debug("No more data to write");
					return false;
				}
				if (result.value.then) {
					return result.value.then(val => processNextValue(val));
				}
				if (typeof result.value != 'string') {
					throw new Error("Data is not a string or promise (" + result.value + ")");
				}
				os.writeString(result.value);
				return true;
			}
			catch (e) {
				Zotero.logError(e);
				if (onError) {
					try {
						os.writeString(onError(e));
					}
					catch (e) {
						Zotero.logError(e);
					}
				}
				os.close();
				return false;
			}
		}
		
		pipe.outputStream.asyncWait({ onOutputStreamReady }, 0, 0, Zotero.mainThread);
		return pipe.inputStream;
	},
	
	
	/**
	 * Parse a Blob (e.g., as received from Zotero.HTTP.request()) into an HTML Document
	 */
	blobToHTMLDocument: async function (blob, url) {
		var responseText = await Zotero.Utilities.Internal.blobToText(blob);
		var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
			.createInstance(Components.interfaces.nsIDOMParser);
		var doc = parser.parseFromString(responseText, 'text/html');
		return Zotero.HTTP.wrapDocument(doc, url);
	},
	
	blobToText: async function (blob, charset=null) {
		if (!charset) {
			var matches = blob.type && blob.type.match(/charset=([a-z0-9\-_+])/i);
			if (matches) {
				charset = matches[1];
			}
		}
		return new Promise(function (resolve) {
			let fr = new FileReader();
			fr.addEventListener("loadend", function() {
				resolve(fr.result);
			});
			fr.readAsText(blob, charset);
		});
	},


	/**
	 * Converts Zotero.Item to a format expected by translators
	 * This is mostly the Zotero web API item JSON format, but with an attachments
	 * and notes arrays and optional compatibility mappings for older translators.
	 *
	 * @param {Zotero.Item} zoteroItem
	 * @param {Boolean} legacy Add mappings for legacy (pre-4.0.27) translators
	 * @return {Object}
	 */
	itemToExportFormat: function (zoteroItem, legacy, skipChildItems) {
		function addCompatibilityMappings(item, zoteroItem) {
			item.uniqueFields = {};

			// Meaningless local item ID, but some older export translators depend on it
			item.itemID = zoteroItem.id;
			item.key = zoteroItem.key; // CSV translator exports this

			// "version" is expected to be a field for "computerProgram", which is now
			// called "versionNumber"
			delete item.version;
			if (item.versionNumber) {
				item.version = item.uniqueFields.version = item.versionNumber;
				delete item.versionNumber;
			}

			// SQL instead of ISO-8601
			item.dateAdded = zoteroItem.dateAdded;
			item.dateModified = zoteroItem.dateModified;
			if (item.accessDate) {
				item.accessDate = zoteroItem.getField('accessDate');
			}

			// Map base fields
			for (let field in item) {
				let id = Zotero.ItemFields.getID(field);
				if (!id || !Zotero.ItemFields.isValidForType(id, zoteroItem.itemTypeID)) {
					continue;
				}

				let baseField = Zotero.ItemFields.getName(
					Zotero.ItemFields.getBaseIDFromTypeAndField(item.itemType, field)
				);

				if (!baseField || baseField == field) {
					item.uniqueFields[field] = item[field];
				} else {
					item[baseField] = item[field];
					item.uniqueFields[baseField] = item[field];
				}
			}

			// Add various fields for compatibility with translators pre-4.0.27
			item.itemID = zoteroItem.id;
			item.libraryID = zoteroItem.libraryID == 1 ? null : zoteroItem.libraryID;

			// Creators
			if (item.creators) {
				for (let i=0; i<item.creators.length; i++) {
					let creator = item.creators[i];

					if (creator.name) {
						creator.fieldMode = 1;
						creator.lastName = creator.name;
						delete creator.name;
					}

					// Old format used to supply creatorID (the database ID), but no
					// translator ever used it
				}
			}

			if (!zoteroItem.isRegularItem()) {
				item.sourceItemKey = item.parentItem;
			}

			// Tags
			for (let i=0; i<item.tags.length; i++) {
				if (!item.tags[i].type) {
					item.tags[i].type = 0;
				}
				// No translator ever used "primary", "fields", or "linkedItems" objects
			}

			// "related" was never used (array of itemIDs)

			// seeAlso was always present, but it was always an empty array.
			// Zotero RDF translator pretended to use it
			item.seeAlso = [];

			if (zoteroItem.isAttachment()) {
				item.linkMode = item.uniqueFields.linkMode = zoteroItem.attachmentLinkMode;
				item.mimeType = item.uniqueFields.mimeType = item.contentType;
			}

			if (item.note) {
				item.uniqueFields.note = item.note;
			}

			return item;
		}

		var item = zoteroItem.toJSON();

		item.uri = Zotero.URI.getItemURI(zoteroItem);
		delete item.key;

		if (!skipChildItems && !zoteroItem.isAttachment() && !zoteroItem.isNote()) {
			// Include attachments
			item.attachments = [];
			let attachments = zoteroItem.getAttachments();
			for (let i=0; i<attachments.length; i++) {
				let zoteroAttachment = Zotero.Items.get(attachments[i]);
				let attachment = zoteroAttachment.toJSON();
				attachment.uri = Zotero.URI.getItemURI(zoteroAttachment);
				if (legacy) addCompatibilityMappings(attachment, zoteroAttachment);

				item.attachments.push(attachment);
			}

			// Include notes
			item.notes = [];
			let notes = zoteroItem.getNotes();
			for (let i=0; i<notes.length; i++) {
				let zoteroNote = Zotero.Items.get(notes[i]);
				let note = zoteroNote.toJSON();
				note.uri = Zotero.URI.getItemURI(zoteroNote);
				if (legacy) addCompatibilityMappings(note, zoteroNote);

				item.notes.push(note);
			}
		}

		if (legacy) addCompatibilityMappings(item, zoteroItem);

		return item;
	},
	
	
	/**
	 * Given API JSON for an item, return the best single first creator, regardless of creator order
	 *
	 * Note that this is just a single creator, not the firstCreator field return from the
	 * Zotero.Item::firstCreator property or Zotero.Items.getFirstCreatorFromData()
	 *
	 * @return {Object|false} - Creator in API JSON format, or false
	 */
	getFirstCreatorFromItemJSON: function (json) {
		var primaryCreatorType = Zotero.CreatorTypes.getName(
			Zotero.CreatorTypes.getPrimaryIDForType(
				Zotero.ItemTypes.getID(json.itemType)
			)
		);
		let firstCreator = json.creators.find(creator => {
			return creator.creatorType == primaryCreatorType || creator.creatorType == 'author';
		});
		if (!firstCreator) {
			firstCreator = json.creators.find(creator => creator.creatorType == 'editor');
		}
		if (!firstCreator) {
			return false;
		}
		return firstCreator;
	},
	
	
	/**
	 * Find valid item fields in Extra field text
	 *
	 * There are a couple differences from citeproc-js behavior:
	 *
	 * 1) Key-value pairs can appear at the beginning of any line in Extra, not just the first two.
	 * 2) For fields, the first occurrence of a valid field is used, not the last.
	 *
	 * @param {String} extra
	 * @param {Zotero.Item} [item = null]
	 * @param {String[]} [additionalFields] - Additional fields to skip other than those already
	 *     on the provided item
	 * @return {Object} - An object with 1) 'itemType', which may be null, 2) 'fields', a Map of
	 *     field name to value, 3) 'creators', in API JSON syntax, and 4) 'extra', the remaining
	 *     Extra string after removing the extracted values
	 */
	extractExtraFields: function (extra, item = null, additionalFields = []) {
		var itemTypeID = item ? item.itemTypeID : null;
		
		var itemType = null;
		var fields = new Map();
		var creators = [];
		additionalFields = new Set(additionalFields);
		
		//
		// Build `Map`s of normalized types/fields, including CSL variables, to built-in types/fields
		//
		
		// For fields we use arrays, because there can be multiple possibilities
		//
		// Built-in fields
		var fieldNames = new Map(Zotero.ItemFields.getAll().map(x => [this._normalizeExtraKey(x.name), [x.name]]));
		// CSL fields
		for (let map of [Zotero.Schema.CSL_TEXT_MAPPINGS, Zotero.Schema.CSL_DATE_MAPPINGS]) {
			for (let cslVar in map) {
				let normalized = this._normalizeExtraKey(cslVar);
				let existing = fieldNames.get(normalized) || [];
				// Text fields are one-to-many; date fields are one-to-one
				let additional = Array.isArray(map[cslVar]) ? map[cslVar] : [map[cslVar]];
				fieldNames.set(normalized, new Set([...existing, ...additional]));
			}
		}
		
		// Built-in creator types
		var creatorTypes = new Map(Zotero.CreatorTypes.getAll().map(x => [this._normalizeExtraKey(x.name), x.name]));
		// CSL types
		for (let i in Zotero.Schema.CSL_NAME_MAPPINGS) {
			let cslType = Zotero.Schema.CSL_NAME_MAPPINGS[i];
			creatorTypes.set(cslType.toLowerCase(), i);
		}
		
		// Process Extra lines
		var keepLines = [];
		var skipKeys = new Set();
		var lines = extra.split(/\n/g);
		
		// Extract item type from 'type:' lines
		lines = lines.filter((line) => {
			let [key, value] = this.splitExtraLine(line);
			
			if (!key
					|| key != 'type'
					|| skipKeys.has(key)
					// 1) Ignore 'type: note' and 'type: attachment'
					// 2) Ignore 'article' until we have a Preprint item type
					//    (https://github.com/zotero/translators/pull/2248#discussion_r546428184)
					|| ['note', 'attachment', 'article'].includes(value)) {
				return true;
			}
			
			// See if it's a Zotero type
			let possibleType = Zotero.ItemTypes.getName(value);
			
			// If not, see if it's a CSL type
			if (!possibleType && Zotero.Schema.CSL_TYPE_MAPPINGS_REVERSE[value]) {
				if (item) {
					let currentType = Zotero.ItemTypes.getName(itemTypeID);
					// If the current item type is valid for the given CSL type, remove the line
					if (Zotero.Schema.CSL_TYPE_MAPPINGS_REVERSE[value].includes(currentType)) {
						return false;
					}
				}
				// Use first mapped Zotero type for CSL type
				possibleType = Zotero.Schema.CSL_TYPE_MAPPINGS_REVERSE[value][0];
			}
			
			if (possibleType) {
				itemType = possibleType;
				itemTypeID = Zotero.ItemTypes.getID(itemType);
				skipKeys.add(key);
				return false;
			}
			
			return true;
		});
		
		lines = lines.filter((line) => {
			let [key, value] = this.splitExtraLine(line);
			
			if (!key || skipKeys.has(key) || key == 'type') {
				return true;
			}
			
			// Skip for now, since the mappings to Place will be changed
			// https://github.com/citation-style-language/zotero-bits/issues/6
			if (key == 'event-place' || key == 'publisher-place') {
				return true;
			}
			
			// Fields
			let possibleFields = fieldNames.get(key);
			// No valid fields
			if (possibleFields) {
				let added = false;
				for (let possibleField of possibleFields) {
					// If we have an item, skip fields that aren't valid for the type or that already
					// have values
					if (item) {
						let fieldID = Zotero.ItemFields.getID(possibleField);
						if (!Zotero.ItemFields.isValidForType(fieldID, itemTypeID)
								|| item.getField(fieldID)
								|| additionalFields.has(possibleField)) {
							return true;
						}
					}
					fields.set(possibleField, value);
					added = true;
					// If we found a valid field, don't try the other possibilities for that
					// normalized key
					if (item) {
						break;
					}
				}
				if (added) {
					skipKeys.add(key);
					return false;
				}
			}
			
			let possibleCreatorType = creatorTypes.get(key);
			if (possibleCreatorType && !additionalFields.has('creators')) {
				let c = {
					creatorType: possibleCreatorType
				};
				if (value.includes('||')) {
					let [last, first] = value.split(/\s*\|\|\s*/);
					c.firstName = first;
					c.lastName = last;
				}
				else {
					c.name = value;
				}
				if (item) {
					let creatorTypeID = Zotero.CreatorTypes.getID(possibleCreatorType);
					if (Zotero.CreatorTypes.isValidForItemType(creatorTypeID, itemTypeID)
							// Ignore if there are any creators of this type on the item already,
							// to follow citeproc-js behavior
							&& !item.getCreators().some(x => x.creatorType == possibleCreatorType)) {
						creators.push(c);
						return false;
					}
				}
				else {
					creators.push(c);
					return false;
				}
			}
			
			// We didn't find anything, so keep the line in Extra
			return true;
		});
		
		return {
			itemType,
			fields,
			creators,
			extra: lines.join('\n')
		};
	},


	/**
	 * Split a line possibly representing a field in Extra text.
	 *
	 * @param {String} line The line to split
	 * @param {Boolean} normalize Whether to normalize to snake-case
	 * @return {String[]}
	 */
	splitExtraLine: function (line, normalize = true) {
		let parts = line.match(/^([a-z][a-z -_]+):(.+)/i);
		// Old citeproc.js cheater syntax;
		if (!parts) {
			parts = line.match(/^{:([a-z -_]+):(.+)}/i);
		}
		if (!parts) {
			return [null, null];
		}
		let [_, originalField, value] = parts;
		let key = normalize ? this._normalizeExtraKey(originalField) : originalField;
		value = value.trim();
		// Skip empty values
		if (value === "") {
			return [null, null];
		}
		return [key, value];
	},
	
	
	/**
	 * @param {String} extra
	 * @param {Map} fieldMap
	 * @return {String}
	 */
	combineExtraFields: function (extra, fields) {
		var normalizedKeyMap = new Map();
		var normalizedFields = new Map();
		for (let [key, value] of fields) {
			let normalizedKey = this._normalizeExtraKey(key);
			normalizedFields.set(normalizedKey, value);
			normalizedKeyMap.set(normalizedKey, key);
		}
		var keepLines = [];
		var lines = extra !== '' ? extra.split(/\n/g) : [];
		for (let line of lines) {
			let parts = line.match(/^([a-z -_]+):(.+)/i);
			// Old citeproc.js cheater syntax;
			if (!parts) {
				parts = line.match(/^{:([a-z -_]+):(.+)}/i);
			}
			if (!parts) {
				keepLines.push(line);
				continue;
			}
			let [_, originalField, value] = parts;
			
			let key = this._normalizeExtraKey(originalField);
			
			// If we have a new value for the field, update it
			if (normalizedFields.has(key)) {
				keepLines.push(originalField + ": " + normalizedFields.get(key));
				// Don't include with the other fields
				fields.delete(normalizedKeyMap.get(key));
			}
			else {
				keepLines.push(line);
			}
		}
		var fieldPairs = Array.from(fields.entries())
			.map(x => this.camelToTitleCase(x[0]) + ': ' + x[1]);
		fieldPairs.sort();
		return fieldPairs.join('\n')
			+ ((fieldPairs.length && keepLines.length) ? "\n" : "")
			+ keepLines.join("\n");
	},
	
	
	_normalizeExtraKey: function (key) {
		return key
			.trim()
			// Convert fooBar to foo-bar
			.replace(/([a-z])([A-Z])/g, '$1-$2')
			.toLowerCase()
			// Normalize to hyphens for spaces
			.replace(/[\s-_]/g, '-');
	},
	
	
	extractIdentifiers: function (text) {
		Zotero.debug(`Zotero.Utilities.Internal.extractIdentifiers() is deprecated -- use Zotero.Utilities.extractIdentifiers() instead`);
		return Zotero.Utilities.extractIdentifiers.apply(Zotero.Utilities, arguments);
	},
	
	
	/**
	 * Look for open-access PDFs for a given DOI using Zotero's Unpaywall mirror
	 *
	 * Note: This uses a private API. Please use Unpaywall directly for non-Zotero projects.
	 *
	 * @param {String} doi
	 * @param {Object} [options]
	 * @param {Number} [options.timeout] - Request timeout in milliseconds
	 * @return {Object[]} - An array of objects with 'url' and/or 'pageURL' and 'version'
	 *     ('submittedVersion', 'acceptedVersion', 'publishedVersion')
	 */
	getOpenAccessPDFURLs: async function (doi, options = {}) {
		doi = Zotero.Utilities.cleanDOI(doi);
		if (!doi) {
			throw new Error(`Invalid DOI '${doi}'`);
		}
		Zotero.debug(`Looking for open-access PDFs for ${doi}`);
		
		var url = ZOTERO_CONFIG.SERVICES_URL + 'oa/search';
		var req = await Zotero.HTTP.request(
			'POST',
			url,
			Object.assign(
				{
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ doi }),
					responseType: 'json'
				},
				options.timeout && {
					timeout: options.timeout
				}
			)
		);
		var urls = req.response;
		Zotero.debug(`Found ${urls.length} open-access PDF `
			+ `${Zotero.Utilities.pluralize(urls.length, ['URL', 'URLs'])}`);
		return urls;
	},
	
	
	/**
	 * Run translation on a Document and return translated items
	 *
	 * @param {doc} Document
	 * @return {Promise<Object[]|null>} Item metadata in translator format or null on failure
	 */
	translateDocument: async function(doc) {
		let translate = new Zotero.Translate.Web();
		translate.setDocument(doc);
		let translators = await translate.getTranslators();
		// TEMP: Until there's a generic webpage translator
		if (!translators.length) {
			return [];
		}
		translate.setTranslator(translators[0]);
		let options = {
			libraryID: false,
			saveAttachments: true
		};
		try {
			return await translate.translate(options);
		} catch(err) {
			Zotero.logError(err);
		}
		return [];
	},
	
	
	/**
	 * Run translation on a Document to try to find a PDF URL
	 *
	 * @param {doc} Document
	 * @return {String|false} - PDF URL, or false if none found
	 */
	getPDFFromDocument: async function (doc) {
		let newItems = await this.translateDocument(doc);
		if (!newItems.length) {
			return false;
		}
		for (let attachment of newItems[0].attachments) {
			if (attachment.mimeType == 'application/pdf') {
				return attachment.url;
			}
		}
		return false;
	},


	/**
	 * Get an identifier from the item whether it's in 'extra' or a separate field
	 *
	 * @param {Zotero.Item} item
	 * @return {Object[]} Identifiers
	 */
	getItemIdentifiers: function (item) {
		// extractExtraFields() only extracts known valid Zotero item fields,
		// but we need to extract identifiers that don't map to a real field.
		// So we split lines in extra ourselves here
		let parsedExtra = new Map();
		for (let line of item.getField('extra').split(/\n/g)) {
			let [key, value] = this.splitExtraLine(line, false);
			if (!key || !value) {
				if (line.startsWith('arXiv:')) {
					parsedExtra.set('arXiv', line);
				}
				continue;
			}
			parsedExtra.set(key, value);
		}

		let identifiers = [];

		let arXiv = parsedExtra.get('arXiv') || parsedExtra.get('arXiv ID')
				|| (item.getField('repository').toLowerCase() == 'arxiv' && item.getField('archiveID'));
		// Use extractIdentifiers() to clean
		if (arXiv) arXiv = Zotero.Utilities.extractIdentifiers(arXiv).find(x => x.arXiv);
		if (arXiv) {
			identifiers.push(arXiv);
		}

		let DOI = item.getField('DOI') || parsedExtra.get('DOI');
		if (DOI) {
			identifiers.push({ DOI });
		}

		let ISBN = item.getField('ISBN') || parsedExtra.get('ISBN');
		if (ISBN) {
			identifiers.push({ ISBN });
		}

		let PMID = parsedExtra.get('PMID')
				|| (item.getField('repository').toLowerCase() == 'pubmed' && item.getField('archiveID'));
		if (PMID) {
			identifiers.push({ PMID });
		}

		let adsBibcode = parsedExtra.get('ADS Bibcode');
		if (adsBibcode) {
			identifiers.push({ adsBibcode });
		}

		return identifiers;
	},


	/**
	 * Resolve an identifier by using fields like title, authors, years, etc.
	 *
	 * @param {Zotero.Item} item
	 * @return {Promise<Object>} Object containing resolved identifiers
	 */
	resolveItemIdentifiers: async function (item) {
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
	},


	/**
	 * Translate URL
	 *
	 * @param {String} url
	 * @return {Promise<Object|null>} Item metadata in translator format
	 */
	translateURL: async function (url) {
		let doc = (await Zotero.HTTP.processDocuments(url, doc => doc))[0];
		let newItems = await this.translateDocument(doc);
		if (!newItems.length) {
			return null;
		}
		return newItems[0];
	},


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
	translateIdentifier: function (identifier) {
		if (Object.keys(identifier).length != 1) {
			throw new Error('Identifier object must contain one identifier field');
		}

		let caller = this._getSearchCaller(Object.keys(identifier)[0]);
		return caller.start(() => this._translateIdentifierNow(identifier));
	},


	_searchCallers: new Map(),


	/**
	 * Return a rate-limiting search caller for the given identifier type.
	 */
	_getSearchCaller: function (identifier) {
		if (this._searchCallers.has(identifier)) {
			return this._searchCallers.get(identifier);
		}

		Components.utils.import("resource://zotero/concurrentCaller.js");
		let caller = new ConcurrentCaller({
			numConcurrent: 1,
			// Crossref tolerates 50 queries per second [https://github.com/CrossRef/rest-api-doc/issues/196#issuecomment-297260099]
			// For all other identifier types, be cautious and limit to two per second.
			interval: identifier == 'DOI' ? 30 : 500,
			onError: e => Zotero.logError(e)
		});
		this._searchCallers.set(identifier, caller);
		return caller;
	},


	/**
	 * Helper function for translateIdentifier. Runs translation without
	 * any rate limiting.
	 */
	_translateIdentifierNow: async function (identifier) {
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
				item2 = await this.translateURL('https://doi.org/' + encodeURIComponent(identifier.DOI));
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
	},


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
	getUpdatedItemMetadata: async function (item) {
		let newItem;
		// Get identifiers from the existing item
		let itemIdentifiers = this.getItemIdentifiers(item);
		// Try all identifiers until one is successfully translated
		for (let itemIdentifier of itemIdentifiers) {
			// Ignore ISBN identifiers
			if (itemIdentifier.ISBN) {
				continue;
			}
			newItem = await this.translateIdentifier(itemIdentifier);
			if (newItem) {
				return newItem;
			}
		}

		// Try to update item metadata by re-translating its URL
		if (item.getField('url')) {
			// TODO: Avoid querying the same URL if it was already queried through doi.org redirect
			try {
				newItem = await this.translateURL(item.getField('url'));
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
					let doiItem = await this.translateIdentifier({ DOI: newItem.DOI });
					if (doiItem) {
						return doiItem;
					}
				}
				return newItem;
			}
		}

		// Try to resolve identifiers by using item fields
		let resolvedIdentifiers = await this.resolveItemIdentifiers(item);
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
			newItem = await this.translateIdentifier(resolvedIdentifier);
			if (newItem) {
				return newItem;
			}
		}

		return null;
	},
	
	
	/**
	 * Hyphenate an ISBN based on the registrant table available from
	 * https://www.isbn-international.org/range_file_generation
	 * See isbn.js
	 *
	 * @param {String} isbn ISBN-10 or ISBN-13
	 * @param {Boolean} dontValidate Do not attempt to validate check digit
	 * @return {String} Hyphenated ISBN or empty string if invalid ISBN is supplied
	 */
	"hyphenateISBN": function(isbn, dontValidate) {
		isbn = Zotero.Utilities.cleanISBN(isbn, dontValidate);
		if (!isbn) return '';
		
		var ranges = Zotero.ISBN.ranges,
			parts = [],
			uccPref,
			i = 0;
		if (isbn.length == 10) {
			uccPref = '978';
		} else {
			uccPref = isbn.substr(0,3);
			if (!ranges[uccPref]) return ''; // Probably invalid ISBN, but the checksum is OK
			parts.push(uccPref);
			i = 3; // Skip ahead
		}
		
		var group = '',
			found = false;
		while (i < isbn.length-3 /* check digit, publication, registrant */) {
			group += isbn.charAt(i);
			if (ranges[uccPref][group]) {
				parts.push(group);
				found = true;
				break;
			}
			i++;
		}
		
		if (!found) return ''; // Did not find a valid group
		
		// Array of registrant ranges that are valid for a group
		// Array always contains an even number of values (as string)
		// From left to right, the values are paired so that the first indicates a
		// lower bound of the range and the right indicates an upper bound
		// The ranges are sorted by increasing number of characters
		var regRanges = ranges[uccPref][group];
		
		var registrant = '';
		found = false;
		i++; // Previous loop 'break'ed early
		while (!found && i < isbn.length-2 /* check digit, publication */) {
			registrant += isbn.charAt(i);
			
			for(let j=0; j < regRanges.length && registrant.length >= regRanges[j].length; j+=2) {
				if(registrant.length == regRanges[j].length
					&& registrant >= regRanges[j] && registrant <= regRanges[j+1] // Falls within the range
				) {
					parts.push(registrant);
					found = true;
					break;
				}
			}
			
			i++;
		}
		
		if (!found) return ''; // Outside of valid range, but maybe we need to update our data
		
		parts.push(isbn.substring(i,isbn.length-1)); // Publication is the remainder up to last digit
		parts.push(isbn.charAt(isbn.length-1)); // Check digit
		
		return parts.join('-');
	},
	
	
	camelToTitleCase: function (str) {
		str = str.replace(/([a-z])([A-Z])/g, "$1 $2");
		return str.charAt(0).toUpperCase() + str.slice(1);
	},
	
	
	resolveLocale: function (locale, locales) {
		// If the locale exists as-is, use it
		if (locales.includes(locale)) {
			return locale;
		}
		
		// If there's a locale with just the language, use that
		var langCode = locale.substr(0, 2);
		if (locales.includes(langCode)) {
			return langCode;
		}
		
		// Find locales matching language
		var possibleLocales = locales.filter(x => x.substr(0, 2) == langCode);
		
		// If none, use en-US
		if (!possibleLocales.length) {
			if (!locales.includes('en-US')) {
				throw new Error("Locales not available");
			}
			Zotero.logError(`Locale ${locale} not found`);
			return 'en-US';
		}
		
		possibleLocales.sort(function (a, b) {
			if (a == 'en-US') return -1;
			if (b == 'en-US') return 1;
			
			// Prefer canonical country (e.g., pt-PT over pt-BR)
			if (a.substr(0, 2) == a.substr(3, 2).toLowerCase()) {
				return -1;
			}
			if (b.substr(0, 2) == b.substr(3, 2).toLowerCase()) {
				return 1;
			}
			
			return a.substr(3, 2).localeCompare(b.substr(3, 2));
		});
		return possibleLocales[0];
	},
	
	
	/**
	 * Get the next available numbered name that matches a base name, for use when duplicating
	 *
	 * - Given 'Foo' and ['Foo'], returns 'Foo 1'.
	 * - Given 'Foo' and ['Foo', 'Foo 1'], returns 'Foo 2'.
	 * - Given 'Foo' and ['Foo', 'Foo 1'], returns 'Foo 2'.
	 * - Given 'Foo 1', ['Foo', 'Foo 1'], and trim=true, returns 'Foo 2'
	 * - Given 'Foo' and ['Foo', 'Foo 2'], returns 'Foo 1'
	 */
	getNextName: function (name, existingNames, trim = false) {
		// Trim numbers at end of given name
		if (trim) {
			let matches = name.match(/^(.+) \d+$/);
			if (matches) {
				name = matches[1].trim();
			}
		}
		
		if (!existingNames.includes(name)) {
			return name;
		}
		
		var suffixes = existingNames
			// Get suffix
			.map(x => x.substr(name.length))
			// Get "2", "5", etc.
			.filter(x => x.match(/^ (\d+)$/));
		
		suffixes.sort(function (a, b) {
			return parseInt(a) - parseInt(b);
		});
		
		// If no existing numbered names found, use 1
		if (!suffixes.length) {
			return name + ' ' + 1;
		}
		
		// Find first available number
		var i = 0;
		var num = 1;
		while (suffixes[i] == num) {
			while (suffixes[i + 1] && suffixes[i] == suffixes[i + 1]) {
				i++;
			}
			i++;
			num++;
		}
		return name + ' ' + num;
	},
	
	
	buildLibraryMenu: function (menulist, libraries, selectedLibraryID) {
		var menupopup = menulist.firstChild;
		while (menupopup.hasChildNodes()) {
			menupopup.removeChild(menupopup.firstChild);
		}
		var selectedIndex = 0;
		var i = 0;
		for (let library of libraries) {
			let menuitem = menulist.ownerDocument.createElement('menuitem');
			menuitem.value = library.libraryID;
			menuitem.setAttribute('label', library.name);
			menupopup.appendChild(menuitem);
			if (library.libraryID == selectedLibraryID) {
				selectedIndex = i;
			}
			i++;
		}
		
		menulist.appendChild(menupopup);
		menulist.selectedIndex = selectedIndex;
	},
	
	
	buildLibraryMenuHTML: function (select, libraries, selectedLibraryID) {
		var namespaceURI = 'http://www.w3.org/1999/xhtml';
		while (select.hasChildNodes()) {
			select.removeChild(select.firstChild);
		}
		var selectedIndex = 0;
		var i = 0;
		for (let library of libraries) {
			let option = select.ownerDocument.createElementNS(namespaceURI, 'option');
			option.setAttribute('value', library.libraryID);
			option.setAttribute('data-editable', library.editable ? 'true' : 'false');
			option.setAttribute('data-filesEditable', library.filesEditable ? 'true' : 'false');
			option.textContent = library.name;
			select.appendChild(option);
			if (library.libraryID == selectedLibraryID) {
				option.setAttribute('selected', 'selected');
			}
			i++;
		}
	},
	
	
	/**
	 * Create a libraryOrCollection DOM tree to place in <menupopup> element.
	 * If has no children, returns a <menuitem> element, otherwise <menu>.
	 * 
	 * @param {Library|Collection} libraryOrCollection
	 * @param {Node<menupopup>} elem Parent element
	 * @param {Zotero.Library|Zotero.Collection} currentTarget Currently selected item (displays as checked)
	 * @param {Function} clickAction function to execute on clicking the menuitem.
	 * 		Receives the event and libraryOrCollection for given item.
	 * @param {Function} disabledPred If provided, called on each library/collection
	 * 		to determine whether disabled
	 * 
	 * @return {Node<menuitem>|Node<menu>} appended node
	 */
	createMenuForTarget: function(libraryOrCollection, elem, currentTarget, clickAction, disabledPred) {
		var doc = elem.ownerDocument;
		function _createMenuitem(label, value, icon, command, disabled) {
			let menuitem = doc.createElement('menuitem');
			menuitem.setAttribute("label", label);
			menuitem.setAttribute("type", "checkbox");
			if (value == currentTarget) {
				menuitem.setAttribute("checked", "true");
			}
			menuitem.setAttribute("value", value);
			menuitem.setAttribute("image", icon);
			menuitem.setAttribute("disabled", disabled);
			menuitem.addEventListener('command', command);
			menuitem.classList.add('menuitem-iconic');
			return menuitem
		}	
		
		function _createMenu(label, value, icon, command) {
			let menu = doc.createElement('menu');
			menu.setAttribute("label", label);
			menu.setAttribute("value", value);
			menu.setAttribute("image", icon);
			// Allow click on menu itself to select a target
			menu.addEventListener('click', (event) => {
				if (event.target == menu) {
					command(event);
				}
			});
			menu.classList.add('menu-iconic');
			let menupopup = doc.createElement('menupopup');
			menu.appendChild(menupopup);
			return menu;
		}
		
		var imageSrc = libraryOrCollection.treeViewImage;
		
		// Create menuitem for library or collection itself, to be placed either directly in the
		// containing menu or as the top item in a submenu
		var menuitem = _createMenuitem(
			libraryOrCollection.name, 
			libraryOrCollection.treeViewID,
			imageSrc,
			function (event) {
				clickAction(event, libraryOrCollection);
			},
			disabledPred && disabledPred(libraryOrCollection)
		);
		
		var collections;
		if (libraryOrCollection.objectType == 'collection') {
			collections = Zotero.Collections.getByParent(libraryOrCollection.id);
		} else {
			collections = Zotero.Collections.getByLibrary(libraryOrCollection.id);
		}
		
		// If no subcollections, place menuitem for target directly in containing men
		if (collections.length == 0) {
			elem.appendChild(menuitem);
			return menuitem
		}
		
		// Otherwise create a submenu for the target's subcollections
		var menu = _createMenu(
			libraryOrCollection.name,
			libraryOrCollection.treeViewID,
			imageSrc,
			function (event) {
				clickAction(event, libraryOrCollection);
			}
		);
		var menupopup = menu.firstChild;
		menupopup.appendChild(menuitem);
		menupopup.appendChild(doc.createElement('menuseparator'));
		for (let collection of collections) {
			let collectionMenu = this.createMenuForTarget(
				collection, elem, currentTarget, clickAction, disabledPred
			);
			menupopup.appendChild(collectionMenu);
		}
		elem.appendChild(menu);
		return menu;
	},
	
	openPreferences: function (paneID, options = {}) {
		if (typeof options == 'string') {
			Zotero.debug("ZoteroPane.openPreferences() now takes an 'options' object -- update your code", 2);
			options = {
				action: options
			};
		}
		
		var io = {
			pane: paneID,
			tab: options.tab,
			tabIndex: options.tabIndex,
			action: options.action
		};
		
		var win = null;
		// If window is already open and no special action, just focus it
		if (!options.action) {
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				.getService(Components.interfaces.nsIWindowMediator);
			var enumerator = wm.getEnumerator("zotero:pref");
			if (enumerator.hasMoreElements()) {
				var win = enumerator.getNext();
				win.focus();
				if (paneID) {
					var pane = win.document.getElementsByAttribute('id', paneID)[0];
					pane.parentElement.showPane(pane);
					
					// TODO: tab/action
				}
			}
		}
		if (!win) {
			let args = [
				'chrome://zotero/content/preferences/preferences.xul',
				'zotero-prefs',
				'chrome,titlebar,toolbar,centerscreen',
				io
			];
			
			let win = Services.wm.getMostRecentWindow("navigator:browser");
			if (win) {
				win.openDialog(...args);
			}
			else {
				// nsIWindowWatcher needs a wrappedJSObject
				args[args.length - 1].wrappedJSObject = args[args.length - 1];
				Services.ww.openWindow(null, ...args);
			}
		}
		
		return win;
	},
	
	
	filterStack: function (stack) {
		return stack.split(/\n/)
			.filter(line => !line.includes('resource://zotero/bluebird'))
			.filter(line => !line.includes('XPCOMUtils.jsm'))
			.join('\n');
	},
	
	/**
	 * Generate a function that produces a static output
	 *
	 * Zotero.lazy(fn) returns a function. The first time this function
	 * is called, it calls fn() and returns its output. Subsequent
	 * calls return the same output as the first without calling fn()
	 * again.
	 */
	lazy: function (fn) {
		var x, called = false;
		return function() {
			if(!called) {
				x = fn.apply(this);
				called = true;
			}
			return x;
		};
	},
	
	serial: function (fn) {
		Components.utils.import("resource://zotero/concurrentCaller.js");
		var caller = new ConcurrentCaller({
			numConcurrent: 1,
			onError: e => Zotero.logError(e)
		});
		return function () {
			var args = arguments;
			return caller.start(function () {
				return fn.apply(this, args);
			}.bind(this));
		};
	},
	
	spawn: function (generator, thisObject) {
		if (thisObject) {
			return Zotero.Promise.coroutine(generator.bind(thisObject))();
		}
		return Zotero.Promise.coroutine(generator)();
	},

	/**
	 * Defines property on the object
	 * More compact way to do Object.defineProperty
	 *
	 * @param {Object} obj Target object
	 * @param {String} prop Property to be defined
	 * @param {Object} desc Property descriptor. If not overridden, "enumerable" is true
	 * @param {Object} opts Options:
	 *   lazy {Boolean} If true, the _getter_ is intended for late
	 *     initialization of the property. The getter is replaced with a simple
	 *     property once initialized.
	 */
	defineProperty: function(obj, prop, desc, opts) {
		if (typeof prop != 'string') throw new Error("Property must be a string");
		var d = { __proto__: null, enumerable: true, configurable: true }; // Enumerable by default
		for (let p in desc) {
			if (!desc.hasOwnProperty(p)) continue;
			d[p] = desc[p];
		}
		
		if (opts) {
			if (opts.lazy && d.get) {
				let getter = d.get;
				d.configurable = true; // Make sure we can change the property later
				d.get = function() {
					let val = getter.call(this);
					
					// Redefine getter on this object as non-writable value
					delete d.set;
					delete d.get;
					d.writable = false;
					d.value = val;
					Object.defineProperty(this, prop, d);
					
					return val;
				}
			}
		}
		
		Object.defineProperty(obj, prop, d);
	},
	
	extendClass: function(superClass, newClass) {
		newClass._super = superClass;
		newClass.prototype = Object.create(superClass.prototype);
		newClass.prototype.constructor = newClass;
	},

	/*
	 * Flattens mixed arrays/values in a passed _arguments_ object and returns
	 * an array of values -- allows for functions to accept both arrays of
	 * values and/or an arbitrary number of individual values
	 */
	flattenArguments: function (args){
		// Put passed scalar values into an array
		if (args === null || typeof args == 'string' || typeof args.length == 'undefined') {
			args = [args];
		}
			
		var returns = [];
		for (var i=0; i<args.length; i++){
			var arg = args[i];
			if (!arg && arg !== 0) {
				continue;
			}
			if (Array.isArray(arg)) {
				returns.push(...arg);
			}
			else {
				returns.push(arg);
			}
		}
		return returns;
	},

	/*
	 * Sets font size based on prefs -- intended for use on root element
	 *  (zotero-pane, note window, etc.)
	 */
	setFontSize: function (rootElement) {
		var size = Zotero.Prefs.get('fontSize');
		rootElement.style.fontSize = size + 'em';
		if (size <= 1) {
			size = 'small';
		}
		else if (size <= 1.15) {
			size = 'medium';
		}
		else if (size <= 1.3) {
			size = 'large';
		}
		else {
			size = 'x-large';
		}
		// Custom attribute -- allows for additional customizations in zotero.css
		rootElement.setAttribute('zoteroFontSize', size);
		if (Zotero.rtl) {
			rootElement.setAttribute('dir', 'rtl');
		}
	},

	getAncestorByTagName: function (elem, tagName){
		while (elem.parentNode){
			elem = elem.parentNode;
			if (elem.localName == tagName) {
				return elem;
			}
		}
		return false;
	},
	
	quitZotero: function(restart=false) {
		Zotero.debug("Zotero.Utilities.Internal.quitZotero() is deprecated -- use quit()");
		this.quit(restart);
	},
	
	
	/**
	 * Quits the program, optionally restarting.
	 * @param {Boolean} [restart=false]
	 */
	quit: function(restart=false) {
		var startup = Services.startup;
		if (restart) {
			Zotero.restarting = true;
		}
		startup.quit(startup.eAttemptQuit | (restart ? startup.eRestart : 0) );
	},

	/**
	 * Assign properties to an object
	 *
	 * @param {Object} target
	 * @param {Object} source
	 * @param {String[]} [props] Properties to assign. Assign all otherwise
	 */
	assignProps: function(target, source, props) {
		if (!props) props = Object.keys(source);

		for (var i=0; i<props.length; i++) {
			if (source[props[i]] === undefined) continue;
			target[props[i]] = source[props[i]];
		}
	},

	parseURL: function (url) {
		var parts = require('url').parse(url);
		// fileName
		parts.fileName = parts.pathname.split('/').pop();
		// fileExtension
		var pos = parts.fileName.lastIndexOf('.');
		parts.fileExtension = pos == -1 ? '' : parts.fileName.substr(pos + 1);
		// fileBaseName
		parts.fileBaseName = parts.fileName
			// filename up to the period before the file extension, if there is one
			.substr(0, parts.fileName.length - (parts.fileExtension ? parts.fileExtension.length + 1 : 0));
		return parts;
	},
	
	/**
	 * Get the real target URL from an intermediate URL
	 */
	resolveIntermediateURL: function(url) {
		var patterns = [
			// Google search results
			{
				regexp: /^https?:\/\/(www.)?google\.(com|(com?\.)?[a-z]{2})\/url\?/,
				variable: "url"
			}
		];

		for (var i=0, len=patterns.length; i<len; i++) {
			if (!url.match(patterns[i].regexp)) {
				continue;
			}
			var matches = url.match(new RegExp("&" + patterns[i].variable + "=(.+?)(&|$)"));
			if (!matches) {
				continue;
			}
			return decodeURIComponent(matches[1]);
		}

		return url;
	},

	/**
	 * Gets the icon for a JSON-style attachment
	 */
	determineAttachmentIcon: function(attachment) {
		if(attachment.linkMode === "linked_url") {
			return Zotero.ItemTypes.getImageSrc("attachment-web-link");
		}
		return Zotero.ItemTypes.getImageSrc(attachment.mimeType === "application/pdf"
			? "attachment-pdf" : "attachment-snapshot");
	},
	
	/**
	 * Pass a class into this to add generic methods for creating event listeners
	 * (and running those events).
	 *
	 * ```
	 * var MyClass = Zotero.Utilities.Internal.makeClassEventDispatcher(class {
	 * 		constructor: () => {
	 * 			this.onFoo = this.createEventBinding('foo');
	 * 		}
	 * 		foo: () => this.runListeners('foo');
	 * });
	 * let object = new MyClass();
	 * object.onFoo.addListener(() => console.log('foo ran in object of MyClass'));
	 * object.foo();
	 * ```
	 * @param cls
	 */
	makeClassEventDispatcher: function (cls) {
		cls.prototype._events = null;
		cls.prototype.runListeners = async function (event) {
			// Zotero.debug(`Running ${event} listeners on ${cls.toString()}`);
			if (!this._events) this._events = {};
			if (!this._events[event]) {
				this._events[event] = {
					listeners: new Map(),
				};
			}
			this._events[event].triggered = true;
			// Array.from(entries) since entries() returns an iterator and we want a snapshot of the entries
			// at the time of runListeners() call to prevent triggering listeners that are added right
			// runListeners() invocation
			for (let [listener, once] of Array.from(this._events[event].listeners.entries())) {
				await Zotero.Promise.resolve(listener.call(this));
				if (once) {
					this._events[event].listeners.delete(listener);
				}
			}
		};

		/**
		 * @param event {String} name of the event
		 * @param alwaysOnce {Boolean} whether all event listeners on this event will only be triggered once
		 * @param immediateAfterTrigger {Boolean} whether the event listeners should be triggered immediately
		 * 								upon being added if the event had been triggered at least once
		 * @returns {Object} A listener object with an addListener(listener, once) method
		 * @private
		 */
		cls.prototype.createEventBinding = function (event, alwaysOnce, immediateAfterTrigger) {
			if (!this._events) this._events = {};
			this._events[event] = {
				listeners: new Map(),
				immediateAfterTrigger
			};
			return {
				addListener: (listener, once) => {
					this._addListener(event, listener, alwaysOnce || once, immediateAfterTrigger);
				},
				removeListener: (listener) => {
					this._removeListener(event, listener);
				},
			}
		};

		cls.prototype._addListener = function (event, listener, once, immediateAfterTrigger) {
			if (!this._events) this._events = {};
			let ev = this._events[event];
			if (!ev) {
				this._events[event] = {
					listeners: new Map(),
					immediateAfterTrigger
				};
			}
			if ((immediateAfterTrigger || ev.immediateAfterTrigger) && ev.triggered) {
				return listener.call(this);
			}
			this._events[event].listeners.set(listener, once);
		};
		
		cls.prototype._removeListener = function(event, listener) {
			let ev = this._events[event];
			if (!ev || !ev.listeners) {
				Zotero.debug(`EventListener.removeListener(): attempting to remove an invalid event ${event} listener`);
				return;
			}
			ev.listeners.delete(listener);
		};

		cls.prototype._waitForEvent = async function (event) {
			return new Zotero.Promise((resolve, reject) => {
				this._addListener(event, () => resolve(), true);
			});
		};
	},

	/**
	 * A basic templating engine
	 *
	 * - 'if' statement does case-insensitive string comparison
	 * - Spaces around '==' are necessary in 'if' statement
	 *
	 * Vars example:
	 *  {
	 * 	  color: '#ff6666',
	 * 	  highlight: '<span class="highlight">This is a highlight</span>,
	 *    comment: 'This is a comment',
	 *    citation: '<span class="citation">(Author, 1900)</citation>',
	 *    image: '<img src="…"/>',
	 *    tags: (attrs) => ['tag1', 'tag2'].map(tag => tag.name).join(attrs.join || ' ')
	 *  }
	 *
	 * Template example:
	 *  {{if color == '#ff6666'}}
	 *    <h2>{{highlight}}</h2>
	 *  {{elseif color == '#2ea8e5'}}
	 *    {{if comment}}<p>{{comment}}:</p>{{endif}}<blockquote>{{highlight}}</blockquote><p>{{citation}}</p>
	 *  {{else}}
	 *    <p>{{highlight}} {{citation}} {{comment}} {{if tags}} #{{tags join=' #'}}{{endif}}</p>
	 *  {{endif}}
	 *
	 * @param {String} template
	 * @param {Object} vars
	 * @returns {String} HTML
	 */
	generateHTMLFromTemplate: function (template, vars) {
		let levels = [{ condition: true }];
		let html = '';
		let parts = template.split(/{{|}}/);
		for (let i = 0; i < parts.length; i++) {
			let part = parts[i];
			let level = levels[levels.length - 1];
			if (i % 2 === 1) {
				let operator = part.split(' ').filter(x => x)[0];
				// Get arguments that are used for 'if'
				let args = [];
				let match = part.match(/(["'][^"|^']+["']|[^\s"']+)/g);
				if (match) {
					args = match.map(x => x.replace(/['"](.*)['"]/, '$1')).slice(1);
				}
				if (operator === 'if') {
					level = { condition: false, executed: false, parentCondition: levels[levels.length-1].condition };
					levels.push(level);
				}
				if (['if', 'elseif'].includes(operator)) {
					if (!level.executed) {
						level.condition = level.parentCondition && (
							args[2]
								// If string variable is equal to the provided string
								? vars[args[0]].toLowerCase() == args[2].toLowerCase()
								: (
									Array.isArray(vars[args[0]])
										// Is array non empty
										? !!vars[args[0]].length
										: (
											typeof vars[args[0]] === 'function'
												// If function returns a value (only string is supported)
												// Note: To keep things simple, this doesn't support function attributes
												? !!vars[args[0]]({})
												// If string variable exists
												: !!vars[args[0]]
										)
								)
						);
						level.executed = level.condition;
					}
					else {
						level.condition = false;
					}
					continue;
				}
				else if (operator === 'else') {
					level.condition = level.parentCondition && !level.executed;
					level.executed = level.condition;
					continue;
				}
				else if (operator === 'endif') {
					levels.pop();
					continue;
				}
				if (level.condition) {
					// Get attributes i.e. join=" #"
					let attrsRegexp = new RegExp(/((\w*) *=+ *(['"])((\\\3|[^\3])*?)\3)|((\w*) *=+ *(\w*))/g);
					let attrs = {};
					while ((match = attrsRegexp.exec(part))) {
						if (match[4]) {
							attrs[match[2]] = match[4];
						}
						else {
							attrs[match[7]] = match[8];
						}
					}
					html += (typeof vars[operator] === 'function' ? vars[operator](attrs) : vars[operator]) || '';
				}
			}
			else if (level.condition) {
				html += part;
			}
		}
		return html;
	}
}

/**
 * Runs an AppleScript on OS X
 *
 * @param script {String}
 * @param block {Boolean} Whether the script should block until the process is finished.
 */
Zotero.Utilities.Internal.executeAppleScript = new function() {
	var _osascriptFile;
	
	return function(script, block) {
		if(_osascriptFile === undefined) {
			_osascriptFile = Zotero.File.pathToFile('/usr/bin/osascript');
			if(!_osascriptFile.exists()) _osascriptFile = false;
		}
		if(_osascriptFile) {
			var proc = Components.classes["@mozilla.org/process/util;1"].
			createInstance(Components.interfaces.nsIProcess);
			proc.init(_osascriptFile);
			try {
				proc.run(!!block, ['-e', script], 2);
			} catch(e) {}
		}
	}
}
	

/**
 * Activates Firefox
 */
Zotero.Utilities.Internal.activate = new function() {
	// For Carbon and X11
	var _carbon, ProcessSerialNumber, SetFrontProcessWithOptions;
	var _x11, _x11Display, _x11RootWindow, XClientMessageEvent, XFetchName, XFree, XQueryTree,
		XOpenDisplay, XCloseDisplay, XFlush, XDefaultRootWindow, XInternAtom, XSendEvent,
		XMapRaised, XGetWindowProperty, X11Atom, X11Bool, X11Display, X11Window, X11Status;
					
	/** 
	 * Bring a window to the foreground by interfacing directly with X11
	 */
	function _X11BringToForeground(win, intervalID) {
		var windowTitle = win.QueryInterface(Ci.nsIInterfaceRequestor)
			.getInterface(Ci.nsIWebNavigation).QueryInterface(Ci.nsIBaseWindow).title;
		
		var x11Window = _X11FindWindow(_x11RootWindow, windowTitle);
		if(!x11Window) return;
		win.clearInterval(intervalID);
			
		var event = new XClientMessageEvent();
		event.type = 33; /* ClientMessage*/
		event.serial = 0;
		event.send_event = 1;
		event.message_type = XInternAtom(_x11Display, "_NET_ACTIVE_WINDOW", 0);
		event.display = _x11Display;
		event.window = x11Window;
		event.format = 32;
		event.l0 = 2;
		var mask = 1<<20 /* SubstructureRedirectMask */ | 1<<19 /* SubstructureNotifyMask */;
		
		if(XSendEvent(_x11Display, _x11RootWindow, 0, mask, event.address())) {
			XMapRaised(_x11Display, x11Window);
			XFlush(_x11Display);
			Zotero.debug("Integration: Activated successfully");
		} else {
			Zotero.debug("Integration: An error occurred activating the window");
		}
	}
	
	/**
	 * Find an X11 window given a name
	 */
	function _X11FindWindow(w, searchName) {
		Components.utils.import("resource://gre/modules/ctypes.jsm");
		
		var res = _X11GetProperty(w, "_NET_CLIENT_LIST", 33 /** XA_WINDOW **/)
			|| _X11GetProperty(w, "_WIN_CLIENT_LIST", 6 /** XA_CARDINAL **/);
		if(!res) return false;
		
		var nClients = res[1],
			clientList = ctypes.cast(res[0], X11Window.array(nClients).ptr).contents,
			foundName = new ctypes.char.ptr();
		for(var i=0; i<nClients; i++) {			
			if(XFetchName(_x11Display, clientList.addressOfElement(i).contents,
					foundName.address())) {
				var foundNameString = undefined;
				try {
					foundNameString = foundName.readString();
				} catch(e) {}
				XFree(foundName);
				if(foundNameString === searchName) return clientList.addressOfElement(i).contents;
			}
		}
		XFree(res[0]);
		
		return false;
	}
	
	/**
	 * Get a property from an X11 window
	 */
	function _X11GetProperty(win, propertyName, propertyType) {
		Components.utils.import("resource://gre/modules/ctypes.jsm");
		
		var returnType = new X11Atom(),
			returnFormat = new ctypes.int(),
			nItemsReturned = new ctypes.unsigned_long(),
			nBytesAfterReturn = new ctypes.unsigned_long(),
			data = new ctypes.char.ptr();
		if(!XGetWindowProperty(_x11Display, win, XInternAtom(_x11Display, propertyName, 0), 0, 1024,
				0, propertyType, returnType.address(), returnFormat.address(),
				nItemsReturned.address(), nBytesAfterReturn.address(), data.address())) {
			var nElements = ctypes.cast(nItemsReturned, ctypes.unsigned_int).value;
			if(nElements) return [data, nElements];
		}
		return null;
	}
	
	return function(win) {
		if (Zotero.isMac) {
			if (win) {
				Components.utils.import("resource://gre/modules/ctypes.jsm");
				win.focus();
				
				if(!_carbon) {
					_carbon = ctypes.open("/System/Library/Frameworks/Carbon.framework/Carbon");
					/*
					 * struct ProcessSerialNumber {
					 *    unsigned long highLongOfPSN;
					 *    unsigned long lowLongOfPSN;
					 * };
					 */
					ProcessSerialNumber = new ctypes.StructType("ProcessSerialNumber", 
						[{"highLongOfPSN":ctypes.uint32_t}, {"lowLongOfPSN":ctypes.uint32_t}]);
						
					/*
					 * OSStatus SetFrontProcessWithOptions (
					 *    const ProcessSerialNumber *inProcess,
					 *    OptionBits inOptions
					 * );
					 */
					SetFrontProcessWithOptions = _carbon.declare("SetFrontProcessWithOptions",
						ctypes.default_abi, ctypes.int32_t, ProcessSerialNumber.ptr,
						ctypes.uint32_t);
				}
				
				var psn = new ProcessSerialNumber();
				psn.highLongOfPSN = 0;
				psn.lowLongOfPSN = 2 // kCurrentProcess
				
				win.addEventListener("load", function() {
					var res = SetFrontProcessWithOptions(
						psn.address(),
						1 // kSetFrontProcessFrontWindowOnly = (1 << 0)
					);
				}, false);
			} else {
				let pid = Zotero.Utilities.Internal.getProcessID();
				let script = `
					tell application "System Events"
						set frontmost of the first process whose unix id is ${pid} to true
					end tell
				`;
				Zotero.Utilities.Internal.executeAppleScript(script);
			}
		} else if(!Zotero.isWin && win) {
			Components.utils.import("resource://gre/modules/ctypes.jsm");

			if(_x11 === false) return;
			if(!_x11) {
				try {
					_x11 = ctypes.open("libX11.so.6");
				} catch(e) {
					try {
						var libName = ctypes.libraryName("X11");
					} catch(e) {
						_x11 = false;
						Zotero.debug("Integration: Could not get libX11 name; not activating");
						Zotero.logError(e);
						return;
					}
					
					try {
						_x11 = ctypes.open(libName);
					} catch(e) {
						_x11 = false;
						Zotero.debug("Integration: Could not open "+libName+"; not activating");
						Zotero.logError(e);
						return;
					}
				}
				
				X11Atom = ctypes.unsigned_long;
				X11Bool = ctypes.int;
				X11Display = new ctypes.StructType("Display");
				X11Window = ctypes.unsigned_long;
				X11Status = ctypes.int;
					
				/*
				 * typedef struct {
				 *     int type;
				 *     unsigned long serial;	/ * # of last request processed by server * /
				 *     Bool send_event;			/ * true if this came from a SendEvent request * /
				 *     Display *display;		/ * Display the event was read from * /
				 *     Window window;
				 *     Atom message_type;
				 *     int format;
				 *     union {
				 *         char b[20];
				 *         short s[10];
				 *         long l[5];
				 *     } data;
				 * } XClientMessageEvent;
				 */
				XClientMessageEvent = new ctypes.StructType("XClientMessageEvent",
					[
						{"type":ctypes.int},
						{"serial":ctypes.unsigned_long},
						{"send_event":X11Bool},
						{"display":X11Display.ptr},
						{"window":X11Window},
						{"message_type":X11Atom},
						{"format":ctypes.int},
						{"l0":ctypes.long},
						{"l1":ctypes.long},
						{"l2":ctypes.long},
						{"l3":ctypes.long},
						{"l4":ctypes.long}
					]
				);
				
				/*
				 * Status XFetchName(
				 *    Display*		display,
				 *    Window		w,
				 *    char**		window_name_return
				 * );
				 */
				XFetchName = _x11.declare("XFetchName", ctypes.default_abi, X11Status,
					X11Display.ptr, X11Window, ctypes.char.ptr.ptr);
					
				/*
				 * Status XQueryTree(
				 *    Display*		display,
				 *    Window		w,
				 *    Window*		root_return,
				 *    Window*		parent_return,
				 *    Window**		children_return,
				 *    unsigned int*	nchildren_return
				 * );
				 */
				XQueryTree = _x11.declare("XQueryTree", ctypes.default_abi, X11Status,
					X11Display.ptr, X11Window, X11Window.ptr, X11Window.ptr, X11Window.ptr.ptr,
					ctypes.unsigned_int.ptr);
				
				/*
				 * int XFree(
				 *    void*		data
				 * );
				 */
				XFree = _x11.declare("XFree", ctypes.default_abi, ctypes.int, ctypes.voidptr_t);
				
				/*
				 * Display *XOpenDisplay(
				 *     _Xconst char*	display_name
				 * );
				 */
				XOpenDisplay = _x11.declare("XOpenDisplay", ctypes.default_abi, X11Display.ptr,
					ctypes.char.ptr);
				 
				/*
				 * int XCloseDisplay(
				 *     Display*		display
				 * );
				 */
				XCloseDisplay = _x11.declare("XCloseDisplay", ctypes.default_abi, ctypes.int,
					X11Display.ptr);
				
				/*
				 * int XFlush(
				 *     Display*		display
				 * );
				 */
				XFlush = _x11.declare("XFlush", ctypes.default_abi, ctypes.int, X11Display.ptr);
				
				/*
				 * Window XDefaultRootWindow(
				 *     Display*		display
				 * );
				 */
				XDefaultRootWindow = _x11.declare("XDefaultRootWindow", ctypes.default_abi,
					X11Window, X11Display.ptr);
					
				/*
				 * Atom XInternAtom(
				 *     Display*			display,
				 *     _Xconst char*	atom_name,
				 *     Bool				only_if_exists
				 * );
				 */
				XInternAtom = _x11.declare("XInternAtom", ctypes.default_abi, X11Atom,
					X11Display.ptr, ctypes.char.ptr, X11Bool);
				 
				/*
				 * Status XSendEvent(
				 *     Display*		display,
				 *     Window		w,
				 *     Bool			propagate,
				 *     long			event_mask,
				 *     XEvent*		event_send
				 * );
				 */
				XSendEvent = _x11.declare("XSendEvent", ctypes.default_abi, X11Status,
					X11Display.ptr, X11Window, X11Bool, ctypes.long, XClientMessageEvent.ptr);
				
				/*
				 * int XMapRaised(
				 *     Display*		display,
				 *     Window		w
				 * );
				 */
				XMapRaised = _x11.declare("XMapRaised", ctypes.default_abi, ctypes.int,
					X11Display.ptr, X11Window);
				
				/*
				 * extern int XGetWindowProperty(
				 *     Display*		 display,
				 *     Window		 w,
				 *     Atom		 property,
				 *     long		 long_offset,
				 *     long		 long_length,
				 *     Bool		 delete,
				 *     Atom		 req_type,
				 *     Atom*		 actual_type_return,
				 *     int*		 actual_format_return,
				 *     unsigned long*	 nitems_return,
				 *     unsigned long*	 bytes_after_return,
				 *     unsigned char**	 prop_return 
				 * );
				 */
				XGetWindowProperty = _x11.declare("XGetWindowProperty", ctypes.default_abi,
					ctypes.int, X11Display.ptr, X11Window, X11Atom, ctypes.long, ctypes.long,
					X11Bool, X11Atom, X11Atom.ptr, ctypes.int.ptr, ctypes.unsigned_long.ptr,
					ctypes.unsigned_long.ptr, ctypes.char.ptr.ptr);
				
					
				_x11Display = XOpenDisplay(null);
				if(!_x11Display) {
					Zotero.debug("Integration: Could not open display; not activating");
					_x11 = false;
					return;
				}
				
				Zotero.addShutdownListener(function() {
					XCloseDisplay(_x11Display);
				});
				
				_x11RootWindow = XDefaultRootWindow(_x11Display);
				if(!_x11RootWindow) {
					Zotero.debug("Integration: Could not get root window; not activating");
					_x11 = false;
					return;
				}
			}

			win.addEventListener("load", function() {
				var intervalID;
				intervalID = win.setInterval(function() {
					_X11BringToForeground(win, intervalID);
				}, 50);
			}, false);
		}
	}
};

Zotero.Utilities.Internal.sendToBack = function() {
	if (Zotero.isMac) {
		let pid = Zotero.Utilities.Internal.getProcessID();
		Zotero.Utilities.Internal.executeAppleScript(`
			tell application "System Events"
				set myProcess to first process whose unix id is ${pid}
				if frontmost of myProcess then
					set visible of myProcess to false
				end if
			end tell
		`);
	}
}


Zotero.Utilities.Internal.getProcessID = function () {
	return Components.classes["@mozilla.org/xre/app-info;1"]
		.getService(Components.interfaces.nsIXULRuntime)
		.processID;
};


/**
 *  Base64 encode / decode
 *  From http://www.webtoolkit.info/
 */
Zotero.Utilities.Internal.Base64 = {
	 // private property
	 _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
	 
	 // public method for encoding
	 encode : function (input) {
		 var output = "";
		 var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
		 var i = 0;
		 
		 input = this._utf8_encode(input);
		 
		 while (i < input.length) {
			 
			 chr1 = input.charCodeAt(i++);
			 chr2 = input.charCodeAt(i++);
			 chr3 = input.charCodeAt(i++);
			 
			 enc1 = chr1 >> 2;
			 enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
			 enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
			 enc4 = chr3 & 63;
			 
			 if (isNaN(chr2)) {
				 enc3 = enc4 = 64;
			 } else if (isNaN(chr3)) {
				 enc4 = 64;
			 }
			 
			 output = output +
			 this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
			 this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
			 
		 }
		 
		 return output;
	 },
	 
	 // public method for decoding
	 decode : function (input) {
		 var output = "";
		 var chr1, chr2, chr3;
		 var enc1, enc2, enc3, enc4;
		 var i = 0;
		 
		 input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
		 
		 while (i < input.length) {
			 
			 enc1 = this._keyStr.indexOf(input.charAt(i++));
			 enc2 = this._keyStr.indexOf(input.charAt(i++));
			 enc3 = this._keyStr.indexOf(input.charAt(i++));
			 enc4 = this._keyStr.indexOf(input.charAt(i++));
			 
			 chr1 = (enc1 << 2) | (enc2 >> 4);
			 chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			 chr3 = ((enc3 & 3) << 6) | enc4;
			 
			 output = output + String.fromCharCode(chr1);
			 
			 if (enc3 != 64) {
				 output = output + String.fromCharCode(chr2);
			 }
			 if (enc4 != 64) {
				 output = output + String.fromCharCode(chr3);
			 }
			 
		 }
		 
		 output = this._utf8_decode(output);
		 
		 return output;
		 
	 },
	 
	 // private method for UTF-8 encoding
	 _utf8_encode : function (string) {
		 string = string.replace(/\r\n/g,"\n");
		 var utftext = "";
		 
		 for (var n = 0; n < string.length; n++) {
			 
			 var c = string.charCodeAt(n);
			 
			 if (c < 128) {
				 utftext += String.fromCharCode(c);
			 }
			 else if((c > 127) && (c < 2048)) {
				 utftext += String.fromCharCode((c >> 6) | 192);
				 utftext += String.fromCharCode((c & 63) | 128);
			 }
			 else {
				 utftext += String.fromCharCode((c >> 12) | 224);
				 utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				 utftext += String.fromCharCode((c & 63) | 128);
			 }
			 
		 }
		 
		 return utftext;
	 },
	 
	 // private method for UTF-8 decoding
	 _utf8_decode : function (utftext) {
		 var string = "";
		 var i = 0;
		 var c = c1 = c2 = 0;
		 
		 while ( i < utftext.length ) {
			 
			 c = utftext.charCodeAt(i);
			 
			 if (c < 128) {
				 string += String.fromCharCode(c);
				 i++;
			 }
			 else if((c > 191) && (c < 224)) {
				 c2 = utftext.charCodeAt(i+1);
				 string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				 i += 2;
			 }
			 else {
				 c2 = utftext.charCodeAt(i+1);
				 c3 = utftext.charCodeAt(i+2);
				 string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				 i += 3;
			 }
			 
		 }
		 
		 return string;
	 }
 }

Zotero.Utilities.Internal.OpenURL = {
	/**
	 * Returns a URL to look up an item in the OpenURL resolver
	 */
	resolve: function (item) {
		var co = Zotero.OpenURL.createContextObject(
			item.toJSON(),
			Zotero.Prefs.get("openURL.version")
		);
		if (co) {
			let base = Zotero.Prefs.get("openURL.resolver");
			// Add & if there's already a ?
			let splice = base.indexOf("?") == -1 ? "?" : "&";
			return base + splice + co;
		}
		return false;
	},
	
	/**
	 * Fetch list of resolvers from the Zotero wiki
	 *
	 * https://www.zotero.org/support/locate/openurl_resolvers
	 */
	getResolvers: async function () {
		var req = await Zotero.HTTP.request(
			"GET",
			"https://www.zotero.org/support/locate/openurl_resolvers?do=export_raw"
		);
		var text = req.response;
		var lines = text.split(/\n/);
		var urls = [];
		var continent;
		var country = null;
		for (let line of lines) {
			// Continent
			let matches = line.match(/^\s*=====\s*([^=]+)=====\s*$/);
			if (matches) {
				continent = matches[1].trim();
				country = null;
				continue;
			}
			// Country
			matches = line.match(/^\s*====\s*([^=]+)====\s*$/);
			if (matches) {
				country = matches[1].trim();
				continue;
			}
			matches = line.match(/^\s*\|\s*([^|]+)\s*\|\s*%%([^%]+)%%\s*\|\s*$/);
			if (matches) {
				urls.push({
					continent,
					country,
					name: matches[1].trim(),
					url: matches[2],
					version: "1.0"
				});
			}
		}
		// Skip global resolver, which is hard-coded locally
		urls = urls.filter(x => x.continent != 'Global');
		urls.sort((a, b) => {
			var cmp = Zotero.localeCompare(a.continent, b.continent);
			if (cmp) return cmp;
			cmp = Zotero.localeCompare(a.country, b.country);
			if (cmp) return cmp;
			return Zotero.localeCompare(a.name, b.name);
		});
		return urls;
	},
};

if (typeof process === 'object' && process + '' === '[object process]'){
    module.exports = Zotero.Utilities.Internal;
}
