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
    
    ***** END LICENSE BLOCK *****
*/

/**
 * Functions for reading files
 * @namespace
 */
Zotero.File = new function(){
	Components.utils.import("resource://zotero/q.js");
	Components.utils.import("resource://gre/modules/NetUtil.jsm");
	Components.utils.import("resource://gre/modules/FileUtils.jsm");
	
	this.getExtension = getExtension;
	this.getClosestDirectory = getClosestDirectory;
	this.getSample = getSample;
	this.getContentsFromURL = getContentsFromURL;
	this.putContents = putContents;
	this.getValidFileName = getValidFileName;
	this.truncateFileName = truncateFileName;
	this.getCharsetFromFile = getCharsetFromFile;
	this.addCharsetListener = addCharsetListener;
	
	/**
	 * Encode special characters in file paths that might cause problems,
	 *  like # (but preserve slashes or colons)
	 *
	 * @param {String} path File path
	 * @return {String} Encoded file path
	 */
	this.encodeFilePath = function(path) {
		var parts = path.split(/([\\\/:]+)/);
		// Every other item is the separator
		for (var i=0, n=parts.length; i<n; i+=2) {
			parts[i] = encodeURIComponent(parts[i]);
		}
		return parts.join('');
	}
	
	function getExtension(file){
		var pos = file.leafName.lastIndexOf('.');
		return pos==-1 ? '' : file.leafName.substr(pos+1);
	}
	
	
	/*
	 * Traverses up the filesystem from a file until it finds an existing
	 *  directory, or false if it hits the root
	 */
	function getClosestDirectory(file) {
		var dir = file.parent;
		
		while (dir && !dir.exists()) {
			var dir = dir.parent;
		}
		
		if (dir && dir.exists()) {
			return dir;
		}
		return false;
	}
	
	
	/*
	 * Get the first 200 bytes of the file as a string (multibyte-safe)
	 */
	function getSample(file) {
		return this.getContents(file, null, 200);
	}
	
	
	/**
	 * Get contents of a binary file
	 */
	this.getBinaryContents = function(file) {
		var iStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
					 .createInstance(Components.interfaces.nsIFileInputStream);
		iStream.init(file, 0x01, 0664, 0);
		var bStream = Components.classes["@mozilla.org/binaryinputstream;1"]
					 .createInstance(Components.interfaces.nsIBinaryInputStream);
		bStream.setInputStream(iStream);
		var string = bStream.readBytes(file.fileSize);
		iStream.close();
		return string;
	}
	
	
	/**
	 * Get the contents of a file or input stream
	 * @param {nsIFile|nsIInputStream} file The file to read
	 * @param {String} [charset] The character set; defaults to UTF-8
	 * @param {Integer} [maxLength] The maximum number of bytes to read
	 * @return {String} The contents of the file
	 * @deprecated Use {@link Zotero.File.getContentsAsync} when possible
	 */
	this.getContents = function getContents(file, charset, maxLength){
		var fis;
		if(file instanceof Components.interfaces.nsIInputStream) {
			fis = file;
		} else if(file instanceof Components.interfaces.nsIFile) {
			fis = Components.classes["@mozilla.org/network/file-input-stream;1"].
				createInstance(Components.interfaces.nsIFileInputStream);
			fis.init(file, 0x01, 0664, 0);
		} else {
			throw new Error("File is not an nsIInputStream or nsIFile");
		}
		
		charset = charset ? Zotero.CharacterSets.getName(charset) : "UTF-8";
		
		var blockSize = maxLength ? Math.min(maxLength, 524288) : 524288;
		
		const replacementChar
			= Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER;
		var is = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
			.createInstance(Components.interfaces.nsIConverterInputStream);
		is.init(fis, charset, blockSize, replacementChar);
		var chars = 0;
		
		var contents = "", str = {};
		while (is.readString(blockSize, str) !== 0) {
			if (maxLength) {
				var strLen = str.value.length;
				if ((chars + strLen) > maxLength) {
					var remainder = maxLength - chars;
					contents += str.value.slice(0, remainder);
					break;
				}
				chars += strLen;
			}
			
			contents += str.value;
		}
		
		is.close();
		
		return contents;
	};
	
	
	/**
	 * Get the contents of a file or input stream asynchronously
	 * @param {nsIFile|nsIInputStream} file The file to read
	 * @param {String} [charset] The character set; defaults to UTF-8
	 * @param {Integer} [maxLength] The maximum number of characters to read
	 * @return {Promise} A Q promise that is resolved with the contents of the file
	 */
	this.getContentsAsync = function getContentsAsync(file, charset, maxLength) {
		charset = charset ? Zotero.CharacterSets.getName(charset) : "UTF-8";
		var deferred = Q.defer(),
			channel = NetUtil.newChannel(file, charset);
		NetUtil.asyncFetch(channel, function(inputStream, status) {  
			if (!Components.isSuccessCode(status)) {
				deferred.reject(new Components.Exception("File read operation failed", status));
				return;
			}
			
			deferred.resolve(NetUtil.readInputStreamToString(inputStream, inputStream.available()));
		});
		return deferred.promise;
	};
	
	
	/**
	 * Get the contents of a binary source asynchronously
	 *
	 * @param {nsIURI|nsIFile|string spec|nsIChannel|nsIInputStream} source The source to read
	 * @return {Promise} A Q promise that is resolved with the contents of the source
	 */
	this.getBinaryContentsAsync = function (source) {
		var deferred = Q.defer();
		NetUtil.asyncFetch(source, function(inputStream, status) {
			if (!Components.isSuccessCode(status)) {
				deferred.reject(new Components.Exception("Source read operation failed", status));
				return;
			}
			
			deferred.resolve(NetUtil.readInputStreamToString(inputStream, inputStream.available()));
		});
		return deferred.promise;
	}
	
	
	/*
	 * Return the contents of a URL as a string
	 *
	 * Runs synchronously, so should only be run on local (e.g. chrome) URLs
	 */
	function getContentsFromURL(url) {
		var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
						.createInstance();
		xmlhttp.open('GET', url, false);
		xmlhttp.overrideMimeType("text/plain");
		xmlhttp.send(null);
		return xmlhttp.responseText;
	}
	
	
	/*
	 * Write string to a file, overwriting existing file if necessary
	 */
	function putContents(file, str) {
		if (file.exists()) {
			file.remove(null);
		}
		var fos = Components.classes["@mozilla.org/network/file-output-stream;1"].
				createInstance(Components.interfaces.nsIFileOutputStream);
		fos.init(file, 0x02 | 0x08 | 0x20, 0664, 0);  // write, create, truncate
		
		var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
						   .createInstance(Components.interfaces.nsIConverterOutputStream);
		os.init(fos, "UTF-8", 4096, "?".charCodeAt(0));
		os.writeString(str);
		os.close();
		
		fos.close();
	}
	
	/**
	 * Write data to a file asynchronously
	 * @param {nsIFile} The file to write to
	 * @param {String|nsIInputStream} data The string or nsIInputStream to write to the
	 *     file
	 * @param {String} [charset] The character set; defaults to UTF-8
	 * @return {Promise} A Q promise that is resolved when the file has been written
	 */
	this.putContentsAsync = function putContentsAsync(file, data, charset) {
		if (typeof data == 'string'
				&& Zotero.platformMajorVersion >= 19
				&& (!charset || charset.toLowerCase() == 'utf-8')) {
			let encoder = new TextEncoder();
			let array = encoder.encode(data);
			Components.utils.import("resource://gre/modules/osfile.jsm");
			return Q(OS.File.writeAtomic(
				file.path,
				array,
				{
					tmpPath: OS.Path.join(Zotero.getTempDirectory().path, file.leafName + ".tmp")
				}
			))
			.catch(function (e) {
				Zotero.debug(e); // TEMP
				if (e instanceof OS.File.Error) {
					Zotero.debug(e);
					Zotero.debug(e.toString());
					throw new Error("Error for operation '" + e.operation + "' for " + file.path);
				}
				throw e;
			});
		}
		else {
			// Create a stream for async stream copying
			if(!(data instanceof Components.interfaces.nsIInputStream)) {
				var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
						createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
				converter.charset = charset ? Zotero.CharacterSets.getName(charset) : "UTF-8";
				data = converter.convertToInputStream(data);
			}
			
			var deferred = Q.defer(),
				ostream = FileUtils.openSafeFileOutputStream(file);
			NetUtil.asyncCopy(data, ostream, function(inputStream, status) {
				if (!Components.isSuccessCode(status)) {
					deferred.reject(new Components.Exception("File write operation failed", status));
					return;
				}
				deferred.resolve();
			});
			return deferred.promise;
		}
	};
	
	
	/**
	 * Generate a data: URI from an nsIFile
	 *
	 * From https://developer.mozilla.org/en-US/docs/data_URIs
	 */
	this.generateDataURI = function (file) {
		var contentType = Components.classes["@mozilla.org/mime;1"]
			.getService(Components.interfaces.nsIMIMEService)
			.getTypeFromFile(file);
		var inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
		inputStream.init(file, 0x01, 0600, 0);
		var stream = Components.classes["@mozilla.org/binaryinputstream;1"]
			.createInstance(Components.interfaces.nsIBinaryInputStream);
		stream.setInputStream(inputStream);
		var encoded = btoa(stream.readBytes(stream.available()));
		return "data:" + contentType + ";base64," + encoded;
	}
	
	
	this.createShortened = function (file, type, mode, maxBytes) {
		if (!maxBytes) {
			maxBytes = 255;
		}
		
		// Limit should be 255, but leave room for unique numbering if necessary
		var padding = 3;
		
		while (true) {
			var newLength = maxBytes - padding;
			
			try {
				file.create(type, mode);
			}
			catch (e) {
				let pathError = false;
				
				let pathByteLength = Zotero.Utilities.Internal.byteLength(file.path);
				let fileNameByteLength = Zotero.Utilities.Internal.byteLength(file.leafName);
				
				// Windows API only allows paths of 260 characters
				if (e.name == "NS_ERROR_FILE_NOT_FOUND" && pathByteLength > 260) {
					Zotero.debug("Path is " + file.path);
					pathError = true;
				}
				// ext3/ext4/HFS+ have a filename length limit of ~254 bytes
				else if ((e.name == "NS_ERROR_FAILURE" || e.name == "NS_ERROR_FILE_NAME_TOO_LONG")
						&& (fileNameByteLength >= 254 || (Zotero.isLinux && fileNameByteLength > 143))) {
					Zotero.debug("Filename is '" + file.leafName + "'");
				}
				else {
					Zotero.debug("Path is " + file.path);
					throw e;
				}
				
				// Preserve extension
				var matches = file.leafName.match(/.+(\.[a-z0-9]{0,20})$/i);
				var ext = matches ? matches[1] : "";
				
				if (pathError) {
					let pathLength = pathByteLength - fileNameByteLength;
					newLength -= pathLength;
					
					// Make sure there's a least 1 character of the basename left over
					if (newLength - ext.length < 1) {
						throw new Error("Path is too long");
					}
				}
				
				// Shorten the filename
				//
				// Shortened file could already exist if there was another file with a
				// similar name that was also longer than the limit, so we do this in a
				// loop, adding numbers if necessary
				var uniqueFile = file.clone();
				var step = 0;
				while (step < 100) {
					let newBaseName = uniqueFile.leafName.substr(0, newLength - ext.length);
					if (step == 0) {
						var newName = newBaseName + ext;
					}
					else {
						var newName = newBaseName + "-" + step + ext;
					}
					
					// Check actual byte length, and shorten more if necessary
					if (Zotero.Utilities.Internal.byteLength(newName) > maxBytes) {
						step = 0;
						newLength--;
						continue;
					}
					
					uniqueFile.leafName = newName;
					if (!uniqueFile.exists()) {
						break;
					}
					
					step++;
				}
				
				var msg = "Shortening filename to '" + newName + "'";
				Zotero.debug(msg, 2);
				Zotero.log(msg, 'warning');
				
				try {
					uniqueFile.create(Components.interfaces.nsIFile.type, mode);
				}
				catch (e) {
					// On Linux, try 143, which is the max filename length with eCryptfs
					if (e.name == "NS_ERROR_FILE_NAME_TOO_LONG" && Zotero.isLinux && uniqueFile.leafName.length > 143) {
						Zotero.debug("Trying shorter filename in case of filesystem encryption", 2);
						maxBytes = 143;
						continue;
					}
					else {
						throw e;
					}
				}
				
				file.leafName = uniqueFile.leafName;
			}
			break;
		}
	}
	
	
	this.copyToUnique = function (file, newFile) {
		newFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0644);
		var newName = newFile.leafName;
		newFile.remove(null);
		
		// Copy file to unique name
		file.copyTo(newFile.parent, newName);
		return newFile;
	}
	
	
	/**
	 * Copies all files from dir into newDir
	 */
	this.copyDirectory = function (dir, newDir) {
		if (!dir.exists()) {
			throw ("Directory doesn't exist in Zotero.File.copyDirectory()");
		}
		var otherFiles = dir.directoryEntries;
		while (otherFiles.hasMoreElements()) {
			var file = otherFiles.getNext();
			file.QueryInterface(Components.interfaces.nsIFile);
			file.copyTo(newDir, null);
		}
	}
	
	
	this.createDirectoryIfMissing = function (dir) {
		if (!dir.exists() || !dir.isDirectory()) {
			if (dir.exists() && !dir.isDirectory()) {
				dir.remove(null);
			}
			dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);
		}
	}
	
	
	/**
	 * Check whether a directory is an ancestor directory of another directory/file
	 */
	this.directoryContains = function (dir, file) {
		if (!dir.isDirectory()) {
			throw new Error("dir must be a directory");
		}
		
		if (dir.exists()) {
			dir.normalize();
		}
		if (file.exists()) {
			file.normalize();
		}
		
		if (!dir.path) {
			throw new Error("dir.path is empty");
		}
		if (!file.path) {
			throw new Error("file.path is empty");
		}
		
		return file.path.indexOf(dir.path) == 0;
	}
	
	
	/**
	 * Strip potentially invalid characters
	 *
	 * See http://en.wikipedia.org/wiki/Filename#Reserved_characters_and_words
	 *
	 * @param	{String}	fileName
	 * @param	{Boolean}	[skipXML=false]		Don't strip characters invalid in XML
	 */
	function getValidFileName(fileName, skipXML) {
		// TODO: use space instead, and figure out what's doing extra
		// URL encode when saving attachments that trigger this
		fileName = fileName.replace(/[\/\\\?\*:|"<>]/g, '');
		// Replace newlines and tabs (which shouldn't be in the string in the first place) with spaces
		fileName = fileName.replace(/[\r\n\t]+/g, ' ');
		// Replace various thin spaces
		fileName = fileName.replace(/[\u2000-\u200A]/g, ' ');
		// Replace zero-width spaces
		fileName = fileName.replace(/[\u200B-\u200E]/g, '');
		if (!skipXML) {
			// Strip characters not valid in XML, since they won't sync and they're probably unwanted
			fileName = fileName.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/g, '');
		}
		// Don't allow blank or illegal filenames
		if (!fileName || fileName == '.' || fileName == '..') {
			fileName = '_';
		}
		return fileName;
	}
	
	/**
	 * Truncate a filename (excluding the extension) to the given total length
	 * If the "extension" is longer than 20 characters,
	 * it is treated as part of the file name
	 */
	function truncateFileName(fileName, maxLength) {
		if(!fileName || (fileName + '').length <= maxLength) return fileName;

		var parts = (fileName + '').split(/\.(?=[^\.]+$)/);
		var fn = parts[0];
		var ext = parts[1];
		//if the file starts with a period , use the whole file
		//the whole file name might also just be a period
		if(!fn) {
			fn = '.' + (ext || '');
		}

		//treat long extensions as part of the file name
		if(ext && ext.length > 20) {
			fn += '.' + ext;
			ext = undefined;
		}

		if(ext === undefined) {	//there was no period in the whole file name
			ext = '';
		} else {
			ext = '.' + ext;
		}

		return fn.substr(0,maxLength-ext.length) + ext;
	}
	
	/*
	 * Not implemented, but it'd sure be great if it were
	 */
	function getCharsetFromByteArray(arr) {
		
	}
	
	
	/*
	 * An extraordinarily inelegant way of getting the character set of a
	 * text file using a hidden browser
	 *
	 * I'm quite sure there's a better way
	 *
	 * Note: This is for text files -- don't run on other files
	 *
	 * 'callback' is the function to pass the charset (and, if provided, 'args')
	 * to after detection is complete
	 */
	function getCharsetFromFile(file, mimeType, callback, args){
		if (!file || !file.exists()){
			callback(false, args);
			return;
		}
		
		if (mimeType.substr(0, 5) != 'text/' ||
				!Zotero.MIME.hasInternalHandler(mimeType, this.getExtension(file))) {
			callback(false, args);
			return;
		}
		
		var browser = Zotero.Browser.createHiddenBrowser();
		
		var url = Components.classes["@mozilla.org/network/protocol;1?name=file"]
				.getService(Components.interfaces.nsIFileProtocolHandler)
				.getURLSpecFromFile(file);
		
		this.addCharsetListener(browser, function (charset, args) {
			callback(charset, args);
			Zotero.Browser.deleteHiddenBrowser(browser);
		}, args);
		
		browser.loadURI(url);
	}
	
	
	/*
	 * Attach a load listener to a browser object to perform charset detection
	 *
	 * We make sure the universal character set detector is set to the
	 * universal_charset_detector (temporarily changing it if not--shhhh)
	 *
	 * 'callback' is the function to pass the charset (and, if provided, 'args')
	 * to after detection is complete
	 */
	function addCharsetListener(browser, callback, args){
		var prefService = Components.classes["@mozilla.org/preferences-service;1"]
							.getService(Components.interfaces.nsIPrefBranch);
		var oldPref = prefService.getCharPref('intl.charset.detector');
		var newPref = 'universal_charset_detector';
		//Zotero.debug("Default character detector is " + (oldPref ? oldPref : '(none)'));
		
		if (oldPref != newPref){
			//Zotero.debug('Setting character detector to universal_charset_detector');
			prefService.setCharPref('intl.charset.detector', 'universal_charset_detector');
		}
		
		var onpageshow = function(){
			// ignore spurious about:blank loads
			if(browser.contentDocument.location.href == "about:blank") return;

			browser.removeEventListener("pageshow", onpageshow, false);
			
			var charset = browser.contentDocument.characterSet;
			Zotero.debug("Detected character set '" + charset + "'");
			
			//Zotero.debug('Resetting character detector to ' + (oldPref ? oldPref : '(none)'));
			prefService.setCharPref('intl.charset.detector', oldPref);
			
			callback(charset, args);
		};
		
		browser.addEventListener("pageshow", onpageshow, false);
	}
	
	
	this.checkFileAccessError = function (e, file, operation) {
		if (file) {
			var str = Zotero.getString('file.accessError.theFile', file.path);
		}
		else {
			var str = Zotero.getString('file.accessError.aFile');
		}
		
		switch (operation) {
			case 'create':
				var opWord = Zotero.getString('file.accessError.created');
				break;
				
			case 'update':
				var opWord = Zotero.getString('file.accessError.updated');
				break;
				
			case 'delete':
				var opWord = Zotero.getString('file.accessError.deleted');
				break;
				
			default:
				var opWord = Zotero.getString('file.accessError.updated');
		}
		
		Zotero.debug(file.path);
		Zotero.debug(e, 1);
		Components.utils.reportError(e);
		
		if (e.name == 'NS_ERROR_FILE_ACCESS_DENIED' || e.name == 'NS_ERROR_FILE_IS_LOCKED'
				// These show up on some Windows systems
				|| e.name == 'NS_ERROR_FAILURE' || e.name == 'NS_ERROR_FILE_NOT_FOUND') {
			str = str + " " + Zotero.getString('file.accessError.cannotBe') + " " + opWord + ".";
			var checkFileWindows = Zotero.getString('file.accessError.message.windows');
			var checkFileOther = Zotero.getString('file.accessError.message.other');
			var msg = str + "\n\n"
					+ (Zotero.isWin ? checkFileWindows : checkFileOther)
					+ "\n\n"
					+ Zotero.getString('file.accessError.restart');
			
			var e = new Zotero.Error(
				msg,
				0,
				{
					dialogButtonText: Zotero.getString('file.accessError.showParentDir'),
					dialogButtonCallback: function () {
						try {
							file.parent.QueryInterface(Components.interfaces.nsILocalFile);
							file.parent.reveal();
						}
						// Unsupported on some platforms
						catch (e2) {
							Zotero.launchFile(file.parent);
						}
					}
				}
			);
		}
		
		throw (e);
	}
}
