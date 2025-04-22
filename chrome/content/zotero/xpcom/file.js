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
	Components.utils.import("resource://gre/modules/NetUtil.jsm");
	Components.utils.import("resource://gre/modules/FileUtils.jsm");
	
	this.getExtension = getExtension;
	this.getContentsFromURL = getContentsFromURL;
	this.getContentsFromURLAsync = getContentsFromURLAsync;
	this.putContents = putContents;
	this.getValidFileName = getValidFileName;
	this.truncateFileName = truncateFileName;
	
	this.REPLACEMENT_CHARACTER = "\uFFFD";
	
	this.pathToFile = function (pathOrFile) {
		try {
			if (typeof pathOrFile == 'string') {
				return new FileUtils.File(pathOrFile);
			}
			else if (pathOrFile instanceof Ci.nsIFile) {
				return pathOrFile;
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		throw new Error("Unexpected path value '" + pathOrFile + "'");
	}
	
	
	this.pathToFileURI = function (pathOrFile) {
		var file = this.pathToFile(pathOrFile);
		return Services.io.newFileURI(file).spec;
	}
	
	
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
		file = this.pathToFile(file);
		var pos = file.leafName.lastIndexOf('.');
		return pos==-1 ? '' : file.leafName.substr(pos+1);
	}

	this.isLikeExtension = function (extension) {
		return !!extension.match(/^\w{1,10}$/i);
	}
	
	
	/**
	 * Traverses up the filesystem from a file until it finds an existing
	 *  directory, or false if it hits the root
	 */
	this.getClosestDirectory = async function (file) {
		try {
			let stat = await OS.File.stat(file);
			// If file is an existing directory, return it
			if (stat.isDir) {
				return file;
			}
		}
		catch (e) {
			if (e.becauseNoSuchFile) {}
			else {
				throw e;
			}
		}
		
		var dir = PathUtils.parent(file);
		while (dir && dir != '/' && !await OS.File.exists(dir)) {
			dir = PathUtils.parent(dir);
		}
		
		return (dir && dir != '/') ? dir : false;
	}
	
	
	/**
	 * Get the first 200 bytes of a source as a string (multibyte-safe)
	 *
	 * @param {string path|nsIFile|file URI} source - The source to read
	 * @return {Promise}
	 */
	this.getSample = async function (file) {
		var bytes = 200;
		return this.getBinaryContentsAsync(file, bytes);
	}
	
	
	/**
	 * Get contents of a binary file
	 */
	this.getBinaryContents = function(file) {
		Zotero.debug("Zotero.File.getBinaryContents() is deprecated -- "
			+ "use Zotero.File.getBinaryContentsAsync() when possible", 2);
		var iStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
					 .createInstance(Components.interfaces.nsIFileInputStream);
		iStream.init(file, 0x01, 0o664, 0);
		var bStream = Components.classes["@mozilla.org/binaryinputstream;1"]
					 .createInstance(Components.interfaces.nsIBinaryInputStream);
		bStream.setInputStream(iStream);
		var string = bStream.readBytes(file.fileSize);
		iStream.close();
		return string;
	}
	
	
	/**
	 * Get the contents of a file or input stream
	 * @param {nsIFile|nsIInputStream|string path} file The file to read
	 * @param {String} [charset] The character set; defaults to UTF-8
	 * @param {Integer} [maxLength] The maximum number of bytes to read
	 * @return {String} The contents of the file
	 * @deprecated Use {@link Zotero.File.getContentsAsync} when possible
	 */
	this.getContents = function (file, charset, maxLength){
		var fis;
		
		if (typeof file == 'string') {
			file = new FileUtils.File(file);
		}
		
		if(file instanceof Components.interfaces.nsIInputStream) {
			fis = file;
		} else if(file instanceof Components.interfaces.nsIFile) {
			fis = Components.classes["@mozilla.org/network/file-input-stream;1"].
				createInstance(Components.interfaces.nsIFileInputStream);
			fis.init(file, 0x01, 0o664, 0);
		} else {
			throw new Error("File is not an nsIInputStream or nsIFile");
		}
		
		if (charset) {
			charset = Zotero.CharacterSets.toLabel(charset, true)
		}
		charset = charset || "UTF-8";
		
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
	 * Get the contents of a text source asynchronously
	 *
	 * @param {string path|nsIFile|file URI|nsIChannel|nsIInputStream} source The source to read
	 * @param {String} [charset] The character set; defaults to UTF-8
	 * @param {Integer} [maxLength] Maximum length to fetch, in bytes
	 * @return {Promise} A promise that is resolved with the contents of the file
	 */
	this.getContentsAsync = async function (source, charset, maxLength) {
		Zotero.debug("Getting contents of "
			+ (source instanceof Components.interfaces.nsIFile
				? source.path
				: (source instanceof Components.interfaces.nsIInputStream ? "input stream" : source)));
		
		// Send URIs to Zotero.HTTP.request()
		if (source instanceof Components.interfaces.nsIURI
				|| typeof source == 'string' && !source.startsWith('file:') && source.match(/^[a-z]{3,}:/)) {
			Zotero.logError("Passing a URI to Zotero.File.getContentsAsync() is deprecated "
				+ "-- use Zotero.HTTP.request() instead");
			return Zotero.HTTP.request("GET", source);
		}
		
		// Use NetUtil.asyncFetch() for input streams and channels
		if (source instanceof Components.interfaces.nsIInputStream
				|| source instanceof Components.interfaces.nsIChannel) {
			var deferred = Zotero.Promise.defer();
			try {
				NetUtil.asyncFetch(source, function(inputStream, status) {
					if (!Components.isSuccessCode(status)) {
						deferred.reject(new Components.Exception("File read operation failed", status));
						return;
					}
					
					try {
						try {
							var bytesToFetch = inputStream.available();
						}
						catch (e) {
							// The stream is closed automatically when end-of-file is reached,
							// so this throws for empty files
							if (e.name == "NS_BASE_STREAM_CLOSED") {
								deferred.resolve("");
							}
							deferred.reject(e);
						}
						
						if (maxLength && maxLength < bytesToFetch) {
							bytesToFetch = maxLength;
						}
						
						if (bytesToFetch == 0) {
							deferred.resolve("");
							return;
						}
						
						deferred.resolve(NetUtil.readInputStreamToString(
							inputStream,
							bytesToFetch,
							{
								charset,
								replacement: this.REPLACEMENT_CHARACTER
							}
						));
					}
					catch (e) {
						deferred.reject(e);
					}
				});
			}
			catch(e) {
				// Make sure this get logged correctly
				Zotero.logError(e);
				throw e;
			}
			return deferred.promise;
		}
		
		// Use OS.File for files
		if (source instanceof Components.interfaces.nsIFile) {
			source = source.path;
		}
		else if (typeof source == 'string') {
			if (source.startsWith('file:')) {
				source = OS.Path.fromFileURI(source);
			}
		}
		else {
			throw new Error(`Unsupported type '${typeof source}' for source`);
		}
		var arr = await IOUtils.read(source, { maxBytes: maxLength || undefined });
		return new TextDecoder(charset || 'utf-8').decode(arr)
	};
	
	
	/**
	 * Get the contents of a binary source asynchronously
	 *
	 * This is quite slow and should only be used in tests.
	 *
	 * @param {string path|nsIFile|file URI} source The source to read
	 * @param {Integer} [maxLength] Maximum length to fetch, in bytes
	 * @return {Promise<String>} A promise for the contents of the source as a binary string
	 */
	this.getBinaryContentsAsync = Zotero.Promise.coroutine(function* (source, maxLength) {
		// Use OS.File for files
		if (source instanceof Components.interfaces.nsIFile) {
			source = source.path;
		}
		else if (source.startsWith('file:')) {
			source = OS.Path.fromFileURI(source);
		}
		var options = {};
		if (maxLength) {
			options.bytes = maxLength;
		}
		var buf = yield OS.File.read(source, options);
		return [...buf].map(x => String.fromCharCode(x)).join("");
	});
	
	
	/*
	 * Return the contents of a URL as a string
	 *
	 * Runs synchronously, so should only be run on local (e.g. chrome) URLs
	 */
	function getContentsFromURL(url) {
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.open('GET', url, false);
		xmlhttp.overrideMimeType("text/plain");
		xmlhttp.send(null);
		return xmlhttp.responseText;
	}

	/**
	 * Return the contents of resource. Use this for loading
	 * resource/chrome URLs.
	 *
	 * @param {String} url - the resource url
	 * @return {String} the resource contents as a string
	 */
	this.getResource = function (url) {
		return getContentsFromURL(url);
	}

	/**
	 * Return a promise for the contents of resource.
	 *
	 * @param {String} url - the resource url
	 * @return {Promise<String>} the resource contents as a string
	 */
	this.getResourceAsync = function (url) {
		return getContentsFromURLAsync(url);
	}
	
	
	/*
	 * Return a promise for the contents of a URL as a string
	 */
	function getContentsFromURLAsync (url, options={}) {
		return Zotero.HTTP.request("GET", url, Object.assign(options, { responseType: "text" }))
		.then(function (xmlhttp) {
			return xmlhttp.response;
		});
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
		fos.init(file, 0x02 | 0x08 | 0x20, 0o664, 0);  // write, create, truncate
		
		var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
						   .createInstance(Components.interfaces.nsIConverterOutputStream);
		os.init(fos, "UTF-8", 4096, "?".charCodeAt(0));
		os.writeString(str);
		os.close();
		
		fos.close();
	}
	
	/**
	 * Write data to a file asynchronously
	 *
	 * @param {String|nsIFile} - String path or nsIFile to write to
	 * @param {String|nsIInputStream|ArrayBuffer} data - The data to write to the file
	 * @param {String} [charset] - The character set; defaults to UTF-8
	 * @return {Promise} - A promise that is resolved when the file has been written
	 */
	this.putContentsAsync = async function (path, data, charset) {
		if (path instanceof Ci.nsIFile) {
			path = path.path;
		}
		
		if (typeof data == 'string') {
			return Zotero.Promise.resolve(OS.File.writeAtomic(
				path,
				data,
				{
					tmpPath: path + ".tmp",
					encoding: charset ? charset.toLowerCase() : 'utf-8'
				}
			));
		}
		
		// If Blob, feed that to an input stream
		//
		// data instanceof Blob doesn't work in XPCOM
		if (typeof data.size != 'undefined' && typeof data.slice == 'function') {
			let arrayBuffer = await new Zotero.Promise(function (resolve) {
				let fr = new FileReader();
				fr.addEventListener("loadend", function() {
					resolve(fr.result);
				});
				fr.readAsArrayBuffer(data);
			});
			let is = Components.classes["@mozilla.org/io/arraybuffer-input-stream;1"]
				.createInstance(Components.interfaces.nsIArrayBufferInputStream);
			is.setData(arrayBuffer, 0, arrayBuffer.byteLength);
			data = is;
		}
		
		await new Zotero.Promise(function (resolve, reject) {
			var os = FileUtils.openSafeFileOutputStream(new FileUtils.File(path));
			NetUtil.asyncCopy(data, os, function(inputStream, status) {
				if (!Components.isSuccessCode(status)) {
					reject(new Components.Exception("File write operation failed", status));
					return;
				}
				resolve();
			});
		});
	};

	/**
	 * Asynchronously writes data from an nsIAsyncInputStream to a file.
	 *
	 * Designed to handle input streams where data may not be
	 * immediately or fully available, such as network streams.
	 *
	 * @param {nsIInputStream} inputStream - The input stream to read from. This
	 *        stream should implement nsIAsyncInputStream.
	 * @param {string} path - The file path where the data will be written.
	 * @param {number} byteCount - The expected number of bytes to write.
	 *
	 * @returns {Promise<number>} A promise that resolves with the number of bytes
	 *          written when the operation is complete, or rejects with an error
	 *          if any issues occur during reading or writing.
	 */
	this.putNetworkStream = async function (path, stream, byteCount) {
		return new Promise((resolve, reject) => {
			let bytesRead = 0;
			var os = FileUtils.openSafeFileOutputStream(new FileUtils.File(path));

			let binaryInputStream = Cc["@mozilla.org/binaryinputstream;1"].createInstance(Ci.nsIBinaryInputStream);
			binaryInputStream.setInputStream(stream);

			let readNextChunk = () => {
				stream.asyncWait({
					onInputStreamReady: (input) => {
						try {
							// Check available data in the stream
							let available = input.available();
							if (available > 0) {
								os.write(binaryInputStream.readBytes(available), available);
								bytesRead += available;

								if (bytesRead < byteCount) {
									// Continue reading
									readNextChunk();
								}
								else {
									// Finished writing all expected bytes
									FileUtils.closeSafeFileOutputStream(os);
									resolve(bytesRead);
								}
							}
							else {
								// No more data, finish the stream
								FileUtils.closeSafeFileOutputStream(os);
								resolve(bytesRead);
							}
						}
						catch (e) {
							os.close();
							reject(new Components.Exception("File write operation failed", e));
						}
					}
				}, 0, 0, null);
			};

			// Start reading the first chunk of data
			readNextChunk();
		});
	};

	this.download = async function (uri, path) {
		var uriStr = uri.spec || uri;
		
		const isHTTP = uriStr.startsWith('http');
		if (uriStr.startsWith('http')) {
			Zotero.warn("Zotero.File.download() is deprecated for HTTP(S) URLs -- use Zotero.HTTP.download()");
			return Zotero.HTTP.download(uri, path);
		}
		
		Zotero.debug(`Saving ${uriStr} to ${path.pathQueryRef || path}`);
		
		var deferred = Zotero.Promise.defer();
		const inputChannel = NetUtil.newChannel({
			uri,
			loadUsingSystemPrincipal: true
		});
		const outputChannel = FileUtils.openSafeFileOutputStream(new FileUtils.File(path));
		const pipe = Cc["@mozilla.org/pipe;1"].createInstance(Ci.nsIPipe);
		pipe.init(true, true, 0, 0xffffffff, null);

		let listener = Cc[
			"@mozilla.org/network/simple-stream-listener;1"
		].createInstance(Ci.nsISimpleStreamListener);
		
		listener.init(pipe.outputStream, {
			onStartRequest(request) {
				// NOTE: This noop callback is required, do not remove.
			},
			onStopRequest(request, status) {
				pipe.outputStream.close();

				if (!Components.isSuccessCode(status)) {
					Zotero.logError(status);
					let msg = Zotero.getString('sync.error.checkConnection');
					switch (status) {
						case 2152398878:
							// TODO: Localize
							msg = "Server not found. Check your internet connection."
							break;
					}
					deferred.reject(new Error(msg));
					return;
				}

				if (isHTTP) {
					let statusCode = request.QueryInterface(Ci.nsIHttpChannel).responseStatus;
					if (statusCode != 200) {
						let msg = `Download failed with response code ${responseStatus}`;
						Zotero.logError(msg);
						deferred.reject(new Error(msg));
						return;
					}
				}
			}
		});

		NetUtil.asyncCopy(pipe.inputStream, outputChannel, function(aResult) {
			deferred.resolve();
		});
		inputChannel.asyncOpen(listener, null);

		return deferred.promise;
	};
	
	/**
	 * Rename file within its parent directory
	 *
	 * @param {String} file - File path
	 * @param {String} newName
	 * @param {Object} [options]
	 * @param {Boolean} [options.overwrite=false] - Overwrite file if one exists
	 * @param {Boolean} [options.unique=false] - Add suffix to create unique filename if necessary
	 * @return {String|false} - New filename, or false if destination file exists and `overwrite`
	 *     and `unique` not set
	 */
	this.rename = async function (file, newName, options = {}) {
		var overwrite = options.overwrite || false;
		var unique = options.unique || false;
		
		var origPath = file;
		var origName = PathUtils.filename(origPath);
		newName = Zotero.File.getValidFileName(newName);
		
		// Ignore if no change
		if (origName === newName) {
			Zotero.debug("Filename has not changed");
			return origName;
		}
		
		// If only the case changed, we need to overwrite so move() doesn't think the destination
		// file already exists
		if (origName.toLowerCase() === newName.toLowerCase()) {
			overwrite = true;
		}
		
		var parentDir = PathUtils.parent(origPath);
		var destPath = OS.Path.join(parentDir, newName);
		var destName = PathUtils.filename(destPath);
		// Get root + extension, if there is one
		var pos = destName.lastIndexOf('.');
		if (pos > 0) {
			var root = destName.substr(0, pos);
			var ext = destName.substr(pos + 1);
		}
		else {
			var root = destName;
		}
		
		var incr = 0;
		while (true) {
			// If filename already exists, add a numeric suffix to the end of the root, before
			// the extension if there is one
			if (incr) {
				if (ext) {
					destName = root + ' ' + (incr + 1) + '.' + ext;
				}
				else {
					destName = root + ' ' + (incr + 1);
				}
				destPath = OS.Path.join(parentDir, destName);
			}
			
			try {
				Zotero.debug(`Renaming ${origPath} to ${PathUtils.filename(destPath)}`);
				Zotero.debug(destPath);
				await OS.File.move(origPath, destPath, { noOverwrite: !overwrite })
			}
			catch (e) {
				if (e instanceof OS.File.Error) {
					if (e.becauseExists) {
						// Increment number to create unique suffix
						if (unique) {
							incr++;
							continue;
						}
						// No overwriting or making unique and file exists
						return false;
					}
				}
				throw e;
			}
			break;
		}
		return destName;
	};
	
	
	/**
	 * Delete a file if it exists, asynchronously
	 *
	 * @return {Promise<Boolean>} A promise for TRUE if file was deleted, FALSE if missing
	 */
	this.removeIfExists = function (path) {
		return Zotero.Promise.resolve(OS.File.remove(path))
		.return(true)
		.catch(function (e) {
			if (e instanceof OS.File.Error && e.becauseNoSuchFile) {
				return false;
			}
			Zotero.debug(path, 1);
			throw e;
		});
	}
	
	
	/**
	 * @return {Promise<Boolean>}
	 */
	this.directoryIsEmpty = async function (path) {
		var iterator = new OS.File.DirectoryIterator(path);
		var empty = true;
		try {
			await iterator.forEach(() => {
				iterator.close();
				empty = false;
			});
		}
		finally {
			iterator.close();
		}
		return empty;
	};
	
	
	/**
	 * Run a function on each entry in a directory
	 *
	 * 'entry' is an instance of OS.File.DirectoryIterator.Entry:
	 *
	 * https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/OSFile.jsm/OS.File.DirectoryIterator.Entry
	 *
	 * @return {Promise}
	 */
	this.iterateDirectory = async function (path, onEntry) {
		var iterator = new OS.File.DirectoryIterator(path);
		try {
			await iterator.forEach(onEntry);
		}
		finally {
			iterator.close();
		}
	}
	
	
	/**
	 * If directories can be moved at once, instead of recursively creating directories and moving files
	 *
	 * Currently this means using /bin/mv, which only works on macOS and Linux
	 */
	this.canMoveDirectoryWithCommand = Zotero.lazy(function () {
		var cmd = "/bin/mv";
		return !Zotero.isWin && this.pathToFile(cmd).exists();
	});
	
	/**
	 * For tests
	 */
	this.canMoveDirectoryWithFunction = Zotero.lazy(function () {
		return true;
	});
	
	/**
	 * Move directory (using mv on macOS/Linux, recursively on Windows)
	 *
	 * @param {Boolean} [options.allowExistingTarget=false] - If true, merge files into an existing
	 *     target directory if one exists rather than throwing an error
	 * @param {Function} options.noOverwrite - Function that returns true if the file at the given
	 *     path should throw an error rather than overwrite an existing file in the target
	 */
	this.moveDirectory = Zotero.Promise.coroutine(function* (oldDir, newDir, options = {}) {
		var maxDepth = options.maxDepth || 10;
		var cmd = "/bin/mv";
		var useCmd = this.canMoveDirectoryWithCommand();
		var useFunction = this.canMoveDirectoryWithFunction();
		
		if (!options.allowExistingTarget && (yield OS.File.exists(newDir))) {
			throw new Error(newDir + " exists");
		}
		
		var errors = [];
		
		// Throw certain known errors (no more disk space) to interrupt the operation
		function checkError(e) {
			if (!(DOMException.isInstance(e))) {
				return;
			}
			// DEBUG: Test this
			if (e.name == 'NotReadableError' && e.message.includes('Target device is full')) {
				throw e;
			}
		}
		
		function addError(e) {
			errors.push(e);
			Zotero.logError(e);
		}
		
		var rootDir = oldDir;
		var moveSubdirs = Zotero.Promise.coroutine(function* (oldDir, depth) {
			if (!depth) return;
			
			// Create target directory
			try {
				yield Zotero.File.createDirectoryIfMissingAsync(newDir + oldDir.substr(rootDir.length));
			}
			catch (e) {
				addError(e);
				return;
			}
			
			Zotero.debug("Moving files in " + oldDir);
			
			yield Zotero.File.iterateDirectory(oldDir, async function (entry) {
				var dest = newDir + entry.path.substr(rootDir.length);
				
				// entry.isDir can be false for some reason on Travis, causing spurious test failures
				if (Zotero.automatedTest && !entry.isDir && (await OS.File.stat(entry.path)).isDir) {
					Zotero.debug("Overriding isDir for " + entry.path);
					entry.isDir = true;
				}
				
				// Move files in directory
				if (!entry.isDir) {
					try {
						await OS.File.move(
							entry.path,
							dest,
							{
								noOverwrite: options
									&& options.noOverwrite
									&& options.noOverwrite(entry.path)
							}
						);
					}
					catch (e) {
						checkError(e);
						Zotero.debug("Error moving " + entry.path);
						addError(e);
					}
				}
				else {
					// Move directory with external command if possible and the directory doesn't
					// already exist in target
					let moved = false;
					
					if (useCmd && !(await OS.File.exists(dest))) {
						Zotero.debug(`Moving ${entry.path} with ${cmd}`);
						let args = [entry.path, dest];
						try {
							await Zotero.Utilities.Internal.exec(cmd, args);
							moved = true;
						}
						catch (e) {
							checkError(e);
							Zotero.debug(e, 1);
						}
					}
					
					
					// If can't use command, try moving with IOUtils.move()
					if (!moved && useFunction) {
						Zotero.debug(`Moving ${entry.path} with IOUtils`);
						if (!await IOUtils.exists(dest)) {
							try {
								await IOUtils.move(entry.path, dest);
								moved = true;
							}
							catch (e) {
								checkError(e);
								Zotero.debug(e, 1);
							}
						}
					}
					
					// Otherwise, recurse into subdirectories to copy files individually
					if (!moved) {
						try {
							await moveSubdirs(entry.path, depth - 1);
						}
						catch (e) {
							checkError(e);
							addError(e);
						}
					}
				}
			});
			
			// Remove directory after moving everything within
			//
			// Don't try to remove root directory if there've been errors, since it won't work.
			// (Deeper directories might fail too, but we don't worry about those.)
			if (!errors.length || oldDir != rootDir) {
				Zotero.debug("Removing " + oldDir);
				try {
					yield OS.File.removeEmptyDir(oldDir);
				}
				catch (e) {
					addError(e);
				}
			}
		});
		
		yield moveSubdirs(oldDir, maxDepth);
		return errors;
	});
	
	
	/**
	 * Generate a data: URI from a file path
	 *
	 * @param {String} path
	 * @param {String} contentType
	 */
	this.generateDataURI = async function (file, contentType) {
		if (!contentType) {
			throw new Error("contentType not provided");
		}
		
		var buf = await IOUtils.read(file);
		buf = new Uint8Array(buf).buffer;
		return new Promise((resolve, reject) => {
			let blob = new Blob([buf], { type: contentType });
			let reader = new FileReader();
			reader.onloadend = function () {
				resolve(reader.result);
			}
			reader.onerror = function (e) {
				reject("FileReader error: " + e);
			};
			reader.readAsDataURL(blob);
		});
	};
	
	
	this.setNormalFilePermissions = async function (path) {
		await IOUtils.setPermissions(path, 0o644);
		if (Zotero.isWin) {
			await IOUtils.setWindowsAttributes(
				path,
				{
					readOnly: false,
					hidden: false,
					system: false
				}
			);
		};
	};
	
	
	this.createShortened = function (file, type, mode, maxBytes) {
		file = this.pathToFile(file);
		
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
				//
				// I think this should be >260 but we had a report of an error with exactly
				// 260 chars: https://forums.zotero.org/discussion/41410
				if (e.name == "NS_ERROR_FILE_NOT_FOUND" && pathByteLength >= 260) {
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
					if (e.name == "NS_ERROR_FILE_NAME_TOO_LONG"
							&& Zotero.isLinux
							&& Zotero.Utilities.Internal.byteLength(uniqueFile.leafName) > 143) {
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
		
		return file.leafName;
	}
	
	
	/**
	 * @param {String} file
	 * @param {String} newFile
	 * @return {String} - Path of new file
	 */
	this.moveToUnique = async function (file, newFile) {
		var targetDir = PathUtils.parent(newFile);
		
		var newNSIFile = this.pathToFile(newFile);
		newNSIFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o644);
		var newName = newNSIFile.leafName;
		newNSIFile.remove(null);
		
		newFile = OS.Path.join(targetDir, newName);
		await OS.File.move(file, newFile);
		return newFile;
	}
	
	
	this.copyToUnique = function (file, newFile) {
		file = this.pathToFile(file);
		newFile = this.pathToFile(newFile);
		
		if (file.contains(newFile)) {
			throw new Error("Can't copy file into itself");
		}
		
		newFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0o644);
		var newName = newFile.leafName;
		newFile.remove(null);
		
		// Copy file to unique name
		file.copyToFollowingLinks(newFile.parent, newName);
		return newFile;
	}
	
	
	/**
	 * Copies all files from dir into newDir
	 *
	 * @param {String|nsIFile} source - Source directory
	 * @param {String|nsIFile} target - Target directory
	 */
	this.copyDirectory = Zotero.Promise.coroutine(function* (source, target) {
		if (source instanceof Ci.nsIFile) source = source.path;
		if (target instanceof Ci.nsIFile) target = target.path;
		
		yield OS.File.makeDir(target, {
			ignoreExisting: true,
			unixMode: 0o755
		});
		
		return this.iterateDirectory(source, function (entry) {
			return entry.isDir
				? this.copyDirectory(entry.path, OS.Path.join(target, entry.name))
				: OS.File.copy(entry.path, OS.Path.join(target, entry.name));
		}.bind(this))
	});
	
	
	this.createDirectoryIfMissing = function (dir) {
		dir = this.pathToFile(dir);
		if (!dir.exists() || !dir.isDirectory()) {
			if (dir.exists()) {
				if (!dir.isDirectory()) {
					dir.remove(null);
				}
			}
			else {
				let isSymlink = false;
				// isSymlink() fails if the directory doesn't exist, but is true if it's a broken
				// symlink, in which case exists() returns false
				try {
					isSymlink = dir.isSymlink();
				}
				catch (e) {}
				if (isSymlink) {
					throw new Error(`Broken symlink at ${dir.path}`);
				}
			}
			dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0o755);
		}
	}
	
	
	this.createDirectoryIfMissingAsync = async function (path, options = {}) {
		try {
			await OS.File.makeDir(
				path,
				Object.assign(
					{
						ignoreExisting: false,
						unixMode: 0o755
					},
					options
				)
			)
		}
		catch (e) {
			// If there's a broken symlink at the given path, makeDir() will throw becauseExists,
			// but exists() will return false
			if (e.becauseExists) {
				if (await OS.File.exists(path)) {
					return;
				}
				let isSymlink = false;
				// Confirm with nsIFile that it's a symlink
				try {
					isSymlink = this.pathToFile(path).isSymlink();
				}
				catch (e) {
					Zotero.logError(e);
				}
				if (isSymlink) {
					throw new Error(`Broken symlink at ${path}`);
				}
			}
			throw e;
		}
	};

	// From public-domain Mozilla code
	// https://searchfox.org/mozilla-central/rev/78a2c17cc80680a5a82446e4ce7c45a73b935383/security/sandbox/test/browser_content_sandbox_utils.js#85-115
	//
	// @param {String} sourcePath - The file to create a symlink to
	// @param {String} targetPath - The location of the symlink to create
	// @return {Promise<Boolean>} - True if successfully created, false otherwise
	this.createSymlink = function (sourcePath, targetPath) {
		const { ctypes } = ChromeUtils.importESModule(
			"resource://gre/modules/ctypes.sys.mjs"
		);
		
		try {
			const libc = ctypes.open(
				Services.appinfo.OS === "Darwin" ? "libSystem.B.dylib" : "libc.so"
			);
			
			const symlink = libc.declare(
				"symlink",
				ctypes.default_abi,
				ctypes.int, // return value
				ctypes.char.ptr, // target
				ctypes.char.ptr //linkpath
			);
			
			if (symlink(sourcePath, targetPath)) {
				return false;
			}
		}
		catch (e) {
			Zotero.logError(e);
			return false;
		}
		
		return true;
	}
	
	/**
	 * Normalize to a Unix-style path, replacing backslashes (interpreted as
	 * separators only on Windows) with forward slashes (interpreted as
	 * separators everywhere)
	 *
	 * @param {String} path
	 * @return {String}
	 */
	this.normalizeToUnix = function (path) {
		// If we're on Windows, we need to normalize first and then replace
		// the slashes, because OS.Path.normalize won't handle forward slashes
		// correctly. Otherwise, we replace slashes first and *then* normalize.
		// This should ensure consistent behavior across platforms.
		if (Zotero.isWin) {
			let normalized = OS.Path.normalize(path);
			return normalized.replace(/\\/g, '/');
		}
		else {
			let replaced = path.replace(/\\/g, '/');
			return OS.Path.normalize(replaced);
		}
	};
	
	
	/**
	 * Check whether a directory is an ancestor directory of another directory/file
	 */
	this.directoryContains = function (dir, file) {
		if (typeof dir != 'string') throw new Error("dir must be a string");
		if (typeof file != 'string') throw new Error("file must be a string");
		
		dir = this.normalizeToUnix(dir);
		file = this.normalizeToUnix(file);
		// Normalize D:\ vs. D:\foo
		if (dir != file && !dir.endsWith('/')) {
			dir += '/';
		}
		
		return file.startsWith(dir);
	};
	
	
	/**
	 * @param {String} dirPath - Directory containing files to add to ZIP
	 * @param {String} zipPath - ZIP file to create
	 * @param {nsIRequestObserver} [observer]
	 * @return {Promise}
	 */
	this.zipDirectory = Zotero.Promise.coroutine(function* (dirPath, zipPath, observer) {
		var zw = Components.classes["@mozilla.org/zipwriter;1"]
			.createInstance(Components.interfaces.nsIZipWriter);
		zw.open(this.pathToFile(zipPath), 0x04 | 0x08 | 0x20); // open rw, create, truncate
		var entries = yield _addZipEntries(dirPath, dirPath, zw);
		if (entries.length == 0) {
			Zotero.debug('No files to add -- removing ZIP file');
			zw.close();
			yield OS.File.remove(zipPath);
			return false;
		}
		
		Zotero.debug(`Creating ${PathUtils.filename(zipPath)} with ${entries.length} file(s)`);
		
		var context = {
			zipWriter: zw,
			entries
		};
		
		var deferred = Zotero.Promise.defer();
		zw.processQueue(
			{
				onStartRequest: function (request, ctx) {
					try {
						if (observer && observer.onStartRequest) {
							observer.onStartRequest(request, context);
						}
					}
					catch (e) {
						deferred.reject(e);
					}
				},
				onStopRequest: function (request, ctx, status) {
					try {
						if (observer && observer.onStopRequest) {
							observer.onStopRequest(request, context, status);
						}
					}
					catch (e) {
						deferred.reject(e);
						return;
					}
					finally {
						zw.close();
					}
					deferred.resolve(true);
				}
			},
			{}
		);
		return deferred.promise;
	});
	
	
	var _addZipEntries = Zotero.Promise.coroutine(function* (rootPath, path, zipWriter) {
		var entries = [];
		let iterator;
		try {
			iterator = new OS.File.DirectoryIterator(path);
			yield iterator.forEach(Zotero.Promise.coroutine(function* (entry) {
				// entry.isDir can be false for some reason on Travis, causing spurious test failures
				if (Zotero.automatedTest && !entry.isDir && (yield OS.File.stat(entry.path)).isDir) {
					Zotero.debug("Overriding isDir for " + entry.path);
					entry.isDir = true;
				}
				
				if (entry.isSymLink) {
					Zotero.debug("Skipping symlink " + entry.name);
					return;
				}
				if (entry.isDir) {
					entries.concat(yield _addZipEntries(rootPath, entry.path, zipWriter));
					return;
				}
				if (entry.name.startsWith('.')) {
					Zotero.debug('Skipping file ' + entry.name);
					return;
				}
				
				Zotero.debug("Adding ZIP entry " + entry.path);
				zipWriter.addEntryFile(
					// Add relative path
					entry.path.substr(rootPath.length + 1),
					Components.interfaces.nsIZipWriter.COMPRESSION_DEFAULT,
					Zotero.File.pathToFile(entry.path),
					true
				);
				entries.push({
					name: entry.name,
					path: entry.path
				});
			}));
		}
		finally {
			iterator.close();
		}
		return entries;
	});
	
	
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
		// Replace line and paragraph separators
		fileName = fileName.replace(/[\u2028-\u2029]/g, ' ');
		if (!skipXML) {
			// Strip characters not valid in XML, since they won't sync and they're probably unwanted
			fileName = fileName.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/g, '');
			
			// Normalize to NFC
			fileName = fileName.normalize();
		}
		// Replace bidi isolation control characters
		fileName = fileName.replace(/[\u2068\u2069]/g, '');
		// Don't allow hidden files
		fileName = fileName.replace(/^\./, '');
		// Don't allow blank or illegal filenames
		if (!fileName || fileName == '.' || fileName == '..') {
			fileName = '_';
		}
		return fileName;
	}
	
	/**
	 * Truncate a filename (excluding the extension) to the given byte length
	 *
	 * If the extension is longer than 20 characters, it's treated as part of the file name.
	 *
	 * @param {String} fileName
	 * @param {Number} maxLength - Maximum length in bytes
	 */
	function truncateFileName(fileName, maxLength) {
		if (!fileName || Zotero.Utilities.Internal.byteLength((fileName + '')).length <= maxLength) {
			return fileName;
		}

		var parts = (fileName + '').split(/\.(?=[^.]+$)/);
		var name = parts[0];
		var ext = parts[1];
		//if the file starts with a period , use the whole file
		//the whole file name might also just be a period
		if (!name) {
			name = '.' + (ext || '');
		}

		//treat long extensions as part of the file name
		if (ext && ext.length > 20) {
			name += '.' + ext;
			ext = undefined;
		}
		
		// No period in the whole filename
		if (ext === undefined) {
			ext = '';
		}
		else {
			ext = '.' + ext;
		}

		// Drop extension if it wouldn't fit within the limit
		// E.g., for (lorem.json, 5), return "lorem" instead of ".json"
		if (Zotero.Utilities.Internal.byteLength(ext) >= maxLength) {
			ext = '';
		}
		
		while (Zotero.Utilities.Internal.byteLength(name + ext) > maxLength) {
			// Split into characters, so we don't corrupt emoji characters (though we might
			// change multi-part emoji in unfortunate ways by removing some of the characters)
			let parts = [...name];
			name = name.substring(0, name.length - parts[parts.length - 1].length);
		}
		
		// If removed completely, use underscore
		if (name == '') {
			name = '_';
		}
		
		return name + ext;
	}
	
	
	this.checkFileAccessError = function (e, file, operation) {
		file = this.pathToFile(file);
		
		var str = 'file.accessError.';
		if (file) {
			str += 'theFile'
		}
		else {
			str += 'aFile'
		}
		str += 'CannotBe';
		
		switch (operation) {
			case 'create':
				str += 'Created';
				break;
				
			case 'delete':
				str += 'Deleted';
				break;
				
			default:
				str += 'Updated';
		}
		str = Zotero.getString(str, file.path ? file.path : undefined);
		
		Zotero.debug(file.path);
		Zotero.debug(e, 1);
		Components.utils.reportError(e);
		
		if (e.name == 'NS_ERROR_FILE_ACCESS_DENIED' || e.name == 'NS_ERROR_FILE_IS_LOCKED'
				// These show up on some Windows systems
				|| e.name == 'NS_ERROR_FAILURE' || e.name == 'NS_ERROR_FILE_NOT_FOUND'
				// OS.File.Error
				|| e.becauseAccessDenied || e.becauseNoSuchFile
				// IOUtils
				|| e.name == 'NotAllowedError'
				|| e.name == 'ReadOnlyError'
				|| e.name == 'NotFoundError') {
			let checkFileWindows = Zotero.getString('file.accessError.message.windows');
			let checkFileOther = Zotero.getString('file.accessError.message.other');
			let msg = str + "\n\n"
					+ (Zotero.isWin ? checkFileWindows : checkFileOther)
					+ "\n\n"
					+ Zotero.getString('file.accessError.restart');
			
			e = new Zotero.Error(
				msg,
				0,
				{
					dialogButtonText: Zotero.getString('file.accessError.showParentDir'),
					dialogButtonCallback: function () {
						try {
							file.parent.reveal();
						}
						// Unsupported on some platforms
						catch (e) {
							Zotero.launchFile(file.parent);
						}
					}
				}
			);
		}
		
		throw e;
	}
	
	
	this.getEvictedICloudPath = function (path) {
		return OS.Path.join(PathUtils.parent(path), '.' + PathUtils.filename(path) + '.icloud');
	};
	
	
	this.isCloudStorageFolder = function (path) {
		// Dropbox
		return path.toLowerCase().includes('dropbox')
			// Google Drive
			|| path.includes('Google Drive')
			|| path.includes('GoogleDrive') // https://forums.zotero.org/discussion/109502/
			// OneDrive
			|| path.toLowerCase().includes('onedrive')
			// Baidu
			|| path.toLowerCase().includes('baidunetdisk')
			|| path.toLowerCase().includes('baidusyncdisk')
			// MEGA
			|| path.includes('MEGA')
			// pCloud
			|| path.toLowerCase().includes('pcloud')
			// iCloud Drive (~/Library/Mobile Documents/com~apple~CloudDocs)
			|| path.includes('Mobile Documents')
			// Box
			|| path.includes('Box');
	};
	
	
	this.reveal = Zotero.Promise.coroutine(function* (file) {
		if (!(yield OS.File.exists(file))) {
			throw new Error(file + " does not exist");
		}
		
		Zotero.debug("Revealing " + file);
		
		var nsIFile = this.pathToFile(file);
		try {
			nsIFile.reveal();
		}
		catch (e) {
			Zotero.logError(e);
			// On platforms that don't support nsIFile.reveal() (e.g. Linux),
			// launch the directory
			let zp = Zotero.getActiveZoteroPane();
			if (zp) {
				try {
					let info = yield OS.File.stat(file);
					// Launch parent directory for files
					if (!info.isDir) {
						file = PathUtils.parent(file);
					}
					Zotero.launchFile(file);
				}
				catch (e) {
					Zotero.logError(e);
					return;
				}
			}
			else {
				Zotero.logError(e);
			}
		}
	});
}
