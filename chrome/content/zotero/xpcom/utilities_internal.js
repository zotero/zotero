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
	"forEachChunkAsync": Zotero.Promise.coroutine(function* (arr, chunkSize, func) {
		var retValues = [];
		var tmpArray = arr.concat();
		var num = arr.length;
		var done = 0;
		
		do {
			var chunk = tmpArray.splice(0, chunkSize);
			done += chunk.length;
			retValues.push(yield func(chunk));
		}
		while (done < num);
		
		return retValues;
	}),
	
	
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
			file = await OS.File.open(path);
			hash = await readChunk(file);
		}
		finally {
			await file.close();
		}
		return hash;
	},
	
	
	gzip: Zotero.Promise.coroutine(function* (data) {
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
		pump.init(is, -1, -1, 0, 0, true);
		pump.asyncRead(converter, null);
		
		return deferred.promise;
	}),
	
	
	gunzip: Zotero.Promise.coroutine(function* (data) {
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
		pump.init(bis, -1, -1, 0, 0, true);
		pump.asyncRead(converter, null);
		
		return deferred.promise;
	}),
	
	
	/**
	 * Unicode normalization
	 */
	"normalize":function(str) {
		var normalizer = Components.classes["@mozilla.org/intl/unicodenormalizer;1"]
							.getService(Components.interfaces.nsIUnicodeNormalizer);
		var obj = {};
		str = normalizer.NormalizeUnicodeNFC(str, obj);
		return obj.value;
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
				win.ZoteroPane.reportErrors();
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
	 */
	saveURI: function (wbp, uri, target, headers) {
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
			document,
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
	 */
	updateHTMLInXUL: function (elem, options) {
		options = options || {};
		var links = elem.getElementsByTagName('a');
		for (let i = 0; i < links.length; i++) {
			let a = links[i];
			let href = a.getAttribute('href');
			a.setAttribute('tooltiptext', href);
			a.onclick = function (event) {
				try {
					let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					   .getService(Components.interfaces.nsIWindowMediator);
					let win = wm.getMostRecentWindow("navigator:browser");
					win.ZoteroPane_Local.loadURI(href, options.linkEvent || event)
				}
				catch (e) {
					Zotero.logError(e);
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
				let zoteroAttachment = Zotero.Items.get(attachments[i]),
					attachment = zoteroAttachment.toJSON();
				if (legacy) addCompatibilityMappings(attachment, zoteroAttachment);
				
				item.attachments.push(attachment);
			}
			
			// Include notes
			item.notes = [];
			let notes = zoteroItem.getNotes();
			for (let i=0; i<notes.length; i++) {
				let zoteroNote = Zotero.Items.get(notes[i]),
					note = zoteroNote.toJSON();
				if (legacy) addCompatibilityMappings(note, zoteroNote);
				
				item.notes.push(note);
			}
		}
		
		if (legacy) addCompatibilityMappings(item, zoteroItem);
		
		return item;
	},
	
	
	extractIdentifiers: function (text) {
		var identifiers = [];
		var foundIDs = new Set(); // keep track of identifiers to avoid duplicates
		
		// First look for DOIs
		var ids = text.split(/[\s\u00A0]+/); // whitespace + non-breaking space
		var doi;
		for (let id of ids) {
			if ((doi = Zotero.Utilities.cleanDOI(id)) && !foundIDs.has(doi)) {
				identifiers.push({
					DOI: doi
				});
				foundIDs.add(doi);
			}
		}
		
		// Then try ISBNs
		if (!identifiers.length) {
			// First try replacing dashes
			let ids = text.replace(/[\u002D\u00AD\u2010-\u2015\u2212]+/g, "") // hyphens and dashes
				.toUpperCase();
			let ISBN_RE = /(?:\D|^)(97[89]\d{10}|\d{9}[\dX])(?!\d)/g;
			let isbn;
			while (isbn = ISBN_RE.exec(ids)) {
				isbn = Zotero.Utilities.cleanISBN(isbn[1]);
				if (isbn && !foundIDs.has(isbn)) {
					identifiers.push({
						ISBN: isbn
					});
					foundIDs.add(isbn);
				}
			}
			
			// Next try spaces
			if (!identifiers.length) {
				ids = ids.replace(/[ \u00A0]+/g, ""); // space + non-breaking space
				while (isbn = ISBN_RE.exec(ids)) {
					isbn = Zotero.Utilities.cleanISBN(isbn[1]);
					if(isbn && !foundIDs.has(isbn)) {
						identifiers.push({
							ISBN: isbn
						});
						foundIDs.add(isbn);
					}
				}
			}
		}
		
		// Finally try for PMID
		if (!identifiers.length) {
			// PMID; right now, the longest PMIDs are 8 digits, so it doesn't seem like we'll
			// need to discriminate for a fairly long time
			let PMID_RE = /(?:\D|^)(\d{1,9})(?!\d)/g;
			let pmid;
			while ((pmid = PMID_RE.exec(text)) && !foundIDs.has(pmid)) {
				identifiers.push({
					PMID: pmid[1]
				});
				foundIDs.add(pmid);
			}
		}
		
		return identifiers;
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
	 * @param {Library/Collection} libraryOrCollection
	 * @param {Node<menupopup>} elem parent element
	 * @param {function} clickAction function to execute on clicking the menuitem.
	 * 		Receives the event and libraryOrCollection for given item.
	 * 
	 * @return {Node<menuitem>/Node<menu>} appended node
	 */
	createMenuForTarget: function(libraryOrCollection, elem, currentTarget, clickAction) {
		var doc = elem.ownerDocument;
		function _createMenuitem(label, value, icon, command) {
			let menuitem = doc.createElement('menuitem');
			menuitem.setAttribute("label", label);
			menuitem.setAttribute("type", "checkbox");
			if (value == currentTarget) {
				menuitem.setAttribute("checked", "true");
			}
			menuitem.setAttribute("value", value);
			menuitem.setAttribute("image", icon);
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
			menu.addEventListener('click', command);
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
			}
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
				collection, elem, currentTarget, clickAction
			);
			menupopup.appendChild(collectionMenu);
		}
		elem.appendChild(menu);
		return menu;
	},
	
	
	// TODO: Move somewhere better
	getVirtualCollectionState: function (type) {
		switch (type) {
			case 'duplicates':
				var prefKey = 'duplicateLibraries';
				break;
			
			case 'unfiled':
				var prefKey = 'unfiledLibraries';
				break;
			
			default:
				throw new Error("Invalid virtual collection type '" + type + "'");
		}
		var libraries;
		try {
			libraries = JSON.parse(Zotero.Prefs.get(prefKey) || '{}');
			if (typeof libraries != 'object') {
				throw true;
			}
		}
		// Ignore old/incorrect formats
		catch (e) {
			Zotero.Prefs.clear(prefKey);
			libraries = {};
		}
		
		return libraries;
	},
	
	
	getVirtualCollectionStateForLibrary: function (libraryID, type) {
		return this.getVirtualCollectionState(type)[libraryID] !== false;
	},
	
	
	setVirtualCollectionStateForLibrary: function (libraryID, type, show) {
		switch (type) {
			case 'duplicates':
				var prefKey = 'duplicateLibraries';
				break;
			
			case 'unfiled':
				var prefKey = 'unfiledLibraries';
				break;
			
			default:
				throw new Error("Invalid virtual collection type '" + type + "'");
		}
		
		var libraries = this.getVirtualCollectionState(type);
		
		// Update current library
		libraries[libraryID] = !!show;
		// Remove libraries that don't exist or that are set to true
		for (let id of Object.keys(libraries).filter(id => libraries[id] || !Zotero.Libraries.exists(id))) {
			delete libraries[id];
		}
		Zotero.Prefs.set(prefKey, JSON.stringify(libraries));
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
				'chrome,titlebar,toolbar,centerscreen,'
					+ Zotero.Prefs.get('browser.preferences.instantApply', true) ? 'dialog=no' : 'modal',
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
			_osascriptFile = Components.classes["@mozilla.org/file/local;1"].
			createInstance(Components.interfaces.nsILocalFile);
			_osascriptFile.initWithPath("/usr/bin/osascript");
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
		
		return foundWindow;
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
			const BUNDLE_IDS = {
				"Zotero":"org.zotero.zotero",
				"Firefox":"org.mozilla.firefox",
				"Aurora":"org.mozilla.aurora",
				"Nightly":"org.mozilla.nightly"
			};
			
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
				Zotero.Utilities.Internal.executeAppleScript('tell application id "'+BUNDLE_IDS[Zotero.appName]+'" to activate');
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
