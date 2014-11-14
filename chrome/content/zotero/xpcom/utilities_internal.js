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
	/**
	 * Run a function on chunks of a given size of an array's elements.
	 *
	 * @param {Array} arr
	 * @param {Integer} chunkSize
	 * @param {Function} func
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
			istream.init(strOrFile, 0x01, 0444, 0);
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
		return [toHexString(hash.charCodeAt(i)) for (i in hash)].join("");
	},
	
	
	/**
	 * @param {OS.File|nsIFile|String} file  File or file path
	 * @param {Boolean} [base64=FALSE]  Return as base-64-encoded string
	 *                                  rather than hex string
	 */
	"md5Async": function (file, base64) {
		const CHUNK_SIZE = 16384;
		
		var deferred = Zotero.Promise.defer();
		
		function toHexString(charCode) {
			return ("0" + charCode.toString(16)).slice(-2);
		}
		
		var ch = Components.classes["@mozilla.org/security/hash;1"]
				   .createInstance(Components.interfaces.nsICryptoHash);
		ch.init(ch.MD5);
		
		// Recursively read chunks of the file, and resolve the promise
		// with the hash when done
		let readChunk = function readChunk(file) {
			file.read(CHUNK_SIZE)
			.then(
				function readSuccess(data) {
					ch.update(data, data.length);
					if (data.length == CHUNK_SIZE) {
						readChunk(file);
					}
					else {
						let hash = ch.finish(base64);
						
						// Base64
						if (base64) {
							deferred.resolve(hash);
						}
						// Hex string
						else {
							deferred.resolve(
								[toHexString(hash.charCodeAt(i))
									for (i in hash)].join("")
							);
						}
					}
				},
				function (e) {
					try {
						ch.finish(false);
					}
					catch (e) {}
					
					deferred.reject(e);
				}
			)
			.then(
				null,
				function (e) {
					try {
						ch.finish(false);
					}
					catch (e) {}
					
					deferred.reject(e);
				}
			);
		}
		
		if (file instanceof OS.File) {
			readChunk(file);
		}
		else {
			if (file instanceof Components.interfaces.nsIFile) {
				var path = file.path;
			}
			else {
				var path = file;
			}
			OS.File.open(path)
			.then(
				function opened(file) {
					readChunk(file);
				},
				function (e) {
					deferred.reject(e);
				}
			);
		}
		
		return deferred.promise;
	},
	
	
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
	 * Display a prompt from an error with custom buttons and a callback
	 */
	"errorPrompt":function(title, e) {
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService);
		var message, buttonText, buttonCallback;
		
		if (e.data) {
			if (e.data.dialogText) {
				message = e.data.dialogText;
			}
			if (typeof e.data.dialogButtonText != 'undefined') {
				buttonText = e.data.dialogButtonText;
				buttonCallback = e.data.dialogButtonCallback;
			}
		}
		if (!message) {
			if (e.message) {
				message = e.message;
			}
			else {
				message = e;
			}
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
	 * Launch a process
	 * @param {nsIFile} cmd Path to command to launch
	 * @param {String[]} args Arguments given
	 * @return {Promise} Promise resolved to true if command succeeds, or an error otherwise
	 */
	"exec":function(cmd, args) {
		if(!cmd.isExecutable()) {
			return Zotero.Promise.reject(cmd.path+" is not an executable");
		}
		
		var proc = Components.classes["@mozilla.org/process/util;1"].
				createInstance(Components.interfaces.nsIProcess);
		proc.init(cmd);
		
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
	},

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
	 * A generator that yields promises that delay for the given intervals
	 *
	 * @param {Array<Integer>} intervals An array of intervals in milliseconds
	 * @param {Boolean} [finite=FALSE] If TRUE, repeat the last interval forever
	 */
	"delayGenerator": function (intervals, finite) {
		var lastInterval = intervals[intervals.length - 1];
		while (true) {
			let interval = intervals.shift();
			if (interval) {
				lastInterval = interval;
				yield Zotero.Promise.delay(interval);
			}
			else if (finite) {
				yield Zotero.Promise.delay(lastInterval);
			}
			else {
				break;
			}
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
		const funcName = 'getAsyncInputStream';
		const maxOutOfSequenceSeconds = 10;
		const outOfSequenceDelay = 50;
		
		// Initialize generator if necessary
		var g = gen.next ? gen : gen();
		var seq = 0;
		
		var pipe = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
		pipe.init(true, true, 0, 0, null);
		
		var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
			.createInstance(Components.interfaces.nsIConverterOutputStream);
		os.init(pipe.outputStream, 'utf-8', 0, 0x0000);
		
		pipe.outputStream.asyncWait({
			onOutputStreamReady: function (aos) {
				Zotero.debug("Output stream is ready");
				
				let currentSeq = seq++;
				
				Zotero.spawn(function* () {
					var lastVal;
					var error = false;
					
					while (true) {
						var data;
						
						try {
							let result = g.next(lastVal);
							
							if (result.done) {
								Zotero.debug("No more data to write");
								aos.close();
								return;
							}
							// If a promise is yielded, wait for it and pass on its value
							if (result.value.then) {
								lastVal = yield result.value;
								continue;
							}
							// Otherwise use the return value
							data = result.value;
							break;
						}
						catch (e) {
							Zotero.debug(e, 1);
							
							if (onError) {
								error = e;
								data = onError();
								break;
							}
							
							Zotero.debug("Closing input stream");
							aos.close();
							throw e;
						}
					}
					
					if (typeof data != 'string') {
						throw new Error("Yielded value is not a string or promise in " + funcName
							+ " ('" + data + "')");
					}
					
					// Make sure that we're writing to the stream in order, in case
					// onOutputStreamReady is called again before the last promise completes.
					// If not in order, wait a bit and try again.
					var maxTries = Math.floor(maxOutOfSequenceSeconds * 1000 / outOfSequenceDelay);
					while (currentSeq != seq - 1) {
						if (maxTries <= 0) {
							throw new Error("Next promise took too long to finish in " + funcName);
						}
						Zotero.debug("Promise finished out of sequence in " + funcName
							+ "-- waiting " + outOfSequenceDelay + " ms");
						yield Zotero.Promise.delay(outOfSequenceDelay);
						maxTries--;
					}
					
					// Write to stream
					Zotero.debug("Writing " + data.length + " characters");
					os.writeString(data);
					
					if (error) {
						Zotero.debug("Closing input stream");
						aos.close();
						throw error;
					}
					
					Zotero.debug("Waiting to write more");
					
					// Wait until stream is ready for more
					aos.asyncWait(this, 0, 0, null);
				}, this)
				.catch(function (e) {
					Zotero.debug("Error getting data for async stream", 1);
					Components.utils.reportError(e);
					Zotero.debug(e, 1);
					os.close();
				});
			}
		}, 0, 0, null);
		
		return pipe.inputStream;
	}
}

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