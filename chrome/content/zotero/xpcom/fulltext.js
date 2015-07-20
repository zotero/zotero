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

Zotero.Fulltext = new function(){
	const CACHE_FILE = '.zotero-ft-cache';
	
	this.pdfConverterIsRegistered = pdfConverterIsRegistered;
	this.pdfInfoIsRegistered = pdfInfoIsRegistered;
	this.isCachedMIMEType = isCachedMIMEType;
	
	this.pdfToolsDownloadBaseURL = ZOTERO_CONFIG.PDF_TOOLS_URL;
	this.__defineGetter__("pdfToolsName", function() { return 'Xpdf'; });
	this.__defineGetter__("pdfToolsURL", function() { return 'http://www.foolabs.com/xpdf/'; });
	this.__defineGetter__("pdfConverterName", function() { return 'pdftotext'; });
	this.__defineGetter__("pdfInfoName", function() { return 'pdfinfo'; });
	this.__defineGetter__("pdfConverterCacheFile", function () { return '.zotero-ft-cache'; });
	this.__defineGetter__("pdfInfoCacheFile", function () { return '.zotero-ft-info'; });
	
	this.__defineGetter__("INDEX_STATE_UNAVAILABLE", function () { return 0; });
	this.__defineGetter__("INDEX_STATE_UNINDEXED", function () { return 1; });
	this.__defineGetter__("INDEX_STATE_PARTIAL", function () { return 2; });
	this.__defineGetter__("INDEX_STATE_INDEXED", function () { return 3; });
	
	const _processorCacheFile = '.zotero-ft-unprocessed';
	
	const kWbClassSpace =            0;
	const kWbClassAlphaLetter =      1;
	const kWbClassPunct =            2;
	const kWbClassHanLetter =        3;
	const kWbClassKatakanaLetter =   4;
	const kWbClassHiraganaLetter =   5;
	const kWbClassHWKatakanaLetter = 6;
	const kWbClassThaiLetter =       7;

	var _pdfConverterVersion = null;
	var _pdfConverterFileName = null;
	var _pdfConverterScript = null; // nsIFile of hidden window script on Windows
	var _pdfConverter = null; // nsIFile to executable
	var _pdfInfoVersion = null;
	var _pdfInfoFileName = null;
	var _pdfInfoScript = null; // nsIFile of redirection script
	var _pdfInfo = null; // nsIFile to executable
	
	var _idleObserverIsRegistered = false;
	var _idleObserverDelay = 5;
	var _processorTimer = null;
	var _processorBlacklist = {};
	var _upgradeCheck = true;
	
	const SYNC_STATE_UNSYNCED = 0;
	const SYNC_STATE_IN_SYNC = 1;
	const SYNC_STATE_TO_PROCESS = 2;
	const SYNC_STATE_TO_DOWNLOAD = 3;
	
	this.init = Zotero.Promise.coroutine(function* () {
		yield Zotero.DB.queryAsync("ATTACH ':memory:' AS 'indexing'");
		yield Zotero.DB.queryAsync('CREATE TABLE indexing.fulltextWords (word NOT NULL)');

		this.decoder = Components.classes["@mozilla.org/intl/utf8converterservice;1"].
			getService(Components.interfaces.nsIUTF8ConverterService);

		var platform = Zotero.platform.replace(/ /g, '-');
		_pdfConverterFileName = this.pdfConverterName + '-' + platform;
		_pdfInfoFileName = this.pdfInfoName + '-' + platform;
		if (Zotero.isWin) {
			_pdfConverterFileName += '.exe';
			_pdfInfoFileName += '.exe';
		}
		
		this.__defineGetter__("pdfConverterFileName", function() { return _pdfConverterFileName; });
		this.__defineGetter__("pdfConverterVersion", function() { return _pdfConverterVersion; });
		this.__defineGetter__("pdfInfoFileName", function() { return _pdfInfoFileName; });
		this.__defineGetter__("pdfInfoVersion", function() { return _pdfInfoVersion; });
		
		yield this.registerPDFTool('converter');
		yield this.registerPDFTool('info');
		
		this.startContentProcessor();
		Zotero.addShutdownListener(this.stopContentProcessor.bind(this));
	});
	
	
	// this is a port from http://mxr.mozilla.org/mozilla-central/source/intl/lwbrk/src/nsSampleWordBreaker.cpp to
	// Javascript to avoid the overhead of xpcom calls. The port keeps to the mozilla naming of interfaces/constants as
	// closely as possible.
	function getClass(c, cc) {
		if (cc < 0x2E80) { //alphabetical script
			if ((cc & 0xFF80) == 0) { // ascii
				if (c == ' '  || c == "\t" || c == "\r" || c == "\n") { return kWbClassSpace; }
				if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')) { return kWbClassAlphaLetter; }
				return kWbClassPunct;
			}
			if ((0xFF80 & cc) == 0x0E00) { return kWbClassThaiLetter; }
			if (cc == 0x00A0/*NBSP*/) { return kWbClassSpace; }
			
			// General and Supplemental Unicode punctuation
			if ((cc >= 0x2000 && cc <= 0x206f) || (cc >= 0x2e00 && cc <= 0x2e7f)) { return kWbClassPunct; }
			
			return kWbClassAlphaLetter;
		}

		if ((cc >= 0x3400 && cc <= 0x9fff) || (cc>= 0xf900 && cc <= 0xfaff)) /*han*/ { return kWbClassHanLetter; }
		if (cc >= 0x30A0 && cc <= 0x30FF) { return kWbClassKatakanaLetter; }
		if (cc >= 0x3040 && cc <= 0x309F) { return kWbClassHiraganaLetter; }
		if (cc>= 0xFF60 && cc <= 0xFF9F) { return kWbClassHWKatakanaLetter; }
		return kWbClassAlphaLetter;
	}
	
	
	this.getLatestPDFToolsVersion = Zotero.Promise.coroutine(function* () {
		if (Zotero.isWin) {
			return "3.02a";
		}
		
		// Find latest version for this platform
		var url = Zotero.Fulltext.pdfToolsDownloadBaseURL + 'latest.json';
		var xmlhttp = yield Zotero.HTTP.request("GET", url, { responseType: "json" });
		var json = xmlhttp.response;
		
		var platform = Zotero.platform.replace(/\s/g, '-');
		var version = json[platform] || json['default'];
		
		Zotero.debug("Latest PDF tools version for " + platform + " is " + version);
		
		return version;
	});
	
	
	/*
	 * Download and install latest PDF tool
	 */
	this.downloadPDFTool = Zotero.Promise.coroutine(function* (tool, version) {
		var ioService = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
		
		if (tool == 'converter') {
			var fileName = this.pdfConverterFileName;
		}
		else {
			var fileName = this.pdfInfoFileName;
		}
		
		var spec = this.pdfToolsDownloadBaseURL + version + "/" + fileName;
		var uri = ioService.newURI(spec, null, null);
		var tmpFile = OS.Path.join(Zotero.getTempDirectory().path, fileName);
		
		yield Zotero.File.download(uri, tmpFile);
		
		var fileInfo = yield OS.File.stat(tmpFile);
		
		// Delete if too small, since a 404 might not be detected above
		if (fileInfo.size < 50000) {
			let msg = tmpFile + " is too small -- deleting";
			Zotero.logError(msg);
			try {
				yield OS.File.remove(tmpFile);
			}
			catch (e) {
				Zotero.logError(e);
			}
			throw new Error(msg);
		}
		
		var scriptExt = _getScriptExtension();
		// On Windows, write out script to hide pdftotext console window
		// TEMP: disabled
		if (false && tool == 'converter') {
			if (Zotero.isWin) {
				let content = yield Zotero.File.getContentsFromURLAsync(
					'resource://zotero/hide.' + scriptExt
				);
				var tmpScriptFile = OS.Path.join(
					Zotero.getTempDirectory().path,
					'pdftotext.' + scriptExt
				);
				yield Zotero.File.putContentsAsync(tmpScriptFile, content);
			}
		}
		// Write out output redirection script for pdfinfo
		// TEMP: disabled on Windows
		else if (!Zotero.isWin && tool == 'info') {
			let content = yield Zotero.File.getContentsFromURLAsync(
				'resource://zotero/redirect.' + scriptExt
			);
			var tmpScriptFile = OS.Path.join(
				Zotero.getTempDirectory().path,
				'pdfinfo.' + scriptExt
			);
			yield Zotero.File.putContentsAsync(tmpScriptFile, content);
		}
		
		// Set permissions to 755
		if (Zotero.isMac || Zotero.isLinux) {
			yield OS.File.setPermissions(tmpFile, {
				unixMode: 0o755
			});
			if (tmpScriptFile) {
				yield OS.File.setPermissions(tmpScriptFile, {
					unixMode: 0o755
				});
			}
		}
		
		var destDir = Zotero.getZoteroDirectory()
		// Move redirect script and executable into data dir
		if (tmpScriptFile) {
			yield OS.File.move(
				tmpScriptFile,
				OS.Path.join(destDir.path, OS.Path.basename(tmpScriptFile))
			);
		}
		yield OS.File.move(tmpFile, OS.Path.join(destDir.path, fileName));
		
		// Write the version number to a file
		var versionFile = destDir.clone();
		versionFile.append(fileName + '.version');
		// TEMP
		if (Zotero.isWin) {
			version = '3.02a';
		}
		yield Zotero.File.putContentsAsync(versionFile, version + '');
		
		yield Zotero.Fulltext.registerPDFTool(tool);
	});
	
	
	/*
	 * Looks for pdftotext-{platform}[.exe] in the Zotero data directory
	 *
	 * {platform} is navigator.platform, with spaces replaced by hyphens
	 *   e.g. "Win32", "Linux-i686", "MacPPC", "MacIntel", etc.
	 */
	this.registerPDFTool = Zotero.Promise.coroutine(function* (tool) {
		var errMsg = false;
		var exec = Zotero.getZoteroDirectory();
		
		switch (tool) {
			case 'converter':
				var toolName = this.pdfConverterName;
				var fileName = _pdfConverterFileName;
				break;
				
			case 'info':
				var toolName = this.pdfInfoName;
				var fileName = _pdfInfoFileName;
				break;
			
			default:
				throw ("Invalid PDF tool type '" + tool + "' in Zotero.Fulltext.registerPDFTool()");
		}
		
		exec.append(fileName);
		if (!exec.exists()) {
			exec = null;
			errMsg = fileName + ' not found';
		}
		
		if (!exec) {
			if (tool == 'converter') {
				Zotero.debug(errMsg + ' -- PDF indexing disabled');
			}
			return false;
		}
		
		var versionFile = exec.parent;
		versionFile.append(fileName + '.version');
		if (versionFile.exists()) {
			try {
				var version = (yield Zotero.File.getSample(versionFile)).split(/[\r\n\s]/)[0];
			}
			catch (e) {
				Zotero.debug(e, 1);
				Components.utils.reportError(e);
			}
		}
		if (!version) {
			var version = 'UNKNOWN';
		}
		
		// If scripts exist, use those instead
		switch (tool) {
		case 'converter':
			// TEMP: disabled
			if (false && Zotero.isWin) {
				var script = Zotero.getZoteroDirectory();
				script.append('pdftotext.' + _getScriptExtension())
				if (script.exists()) {
					Zotero.debug(script.leafName + " registered");
					_pdfConverterScript = script;
				}
			}
			break;
		
		case 'info':
			// Modified 3.02 version doesn't use redirection script
			if (version.startsWith('3.02')) break;
			
			var script = Zotero.getZoteroDirectory();
			script.append('pdfinfo.' + _getScriptExtension())
			// The redirection script is necessary to run pdfinfo
			if (!script.exists()) {
				Zotero.debug(script.leafName + " not found -- PDF statistics disabled");
				return false;
			}
			Zotero.debug(toolName + " redirection script registered");
			_pdfInfoScript = script;
			break;
		}
		
		switch (tool) {
			case 'converter':
				_pdfConverter = exec;
				_pdfConverterVersion = version;
				break;
				
			case 'info':
				_pdfInfo = exec;
				_pdfInfoVersion = version;
				break;
		}
		
		Zotero.debug(toolName + ' version ' + version + ' registered');
		
		return true;
	});
	
	
	/**
	 * Unregister and delete PDF tools
	 *
	 * Used only for tests
	 */
	this.uninstallPDFTools = Zotero.Promise.coroutine(function* () {
		Zotero.debug("Uninstalling PDF tools");
		
		var dataDir = Zotero.getZoteroDirectory().path;
		yield Zotero.File.removeIfExists(OS.Path.join(dataDir, _pdfConverterFileName));
		yield Zotero.File.removeIfExists(OS.Path.join(dataDir, _pdfInfoFileName));
		if (_pdfConverter) {
			yield Zotero.File.removeIfExists(_pdfConverter.path);
			yield Zotero.File.removeIfExists(_pdfConverter.path + ".version");
		}
		if (_pdfInfo) {
			yield Zotero.File.removeIfExists(_pdfInfo.path);
			yield Zotero.File.removeIfExists(_pdfInfo.path + ".version");
		}
		if (_pdfConverterScript) yield Zotero.File.removeIfExists(_pdfConverterScript.path);
		if (_pdfInfoScript) yield Zotero.File.removeIfExists(_pdfInfoScript.path);
		
		_pdfConverter = null;
		_pdfInfo = null;
		_pdfInfoScript = null;
		_pdfInfoScript = null;
	});
	
	
	function pdfConverterIsRegistered() {
		return !!_pdfConverter;
	}
	
	
	function pdfInfoIsRegistered() {
		return !!_pdfInfo;
	}
	
	
	this.getPDFConverterExecAndArgs = function () {
		if (!this.pdfConverterIsRegistered()) {
			throw new Error("PDF converter is not registered");
		}
		
		if (_pdfConverterScript) {
			return {
				exec: _pdfConverterScript,
				args: [_pdfConverter.path]
			}
		}
		
		return {
			exec: _pdfConverter,
			args: []
		}
	}
	
	
	/*
	 * Returns true if MIME type is converted to text and cached before indexing
	 *   (e.g. application/pdf is run through pdftotext)
	 */
	function isCachedMIMEType(mimeType) {
		switch (mimeType) {
			case 'application/pdf':
				return true;
		}
		return false;
	}
	
	
	/**
	 * Index multiple words at once
	 *
	 * @requireTransaction
	 * @param {Number} itemID
	 * @param {Array<string>} words
	 * @return {Promise}
	 */
	var indexWords = Zotero.Promise.coroutine(function* (itemID, words) {
		Zotero.DB.requireTransaction();
		let chunk;
		yield Zotero.DB.queryAsync("DELETE FROM indexing.fulltextWords");
		while (words.length > 0) {
			chunk = words.splice(0, 100);
			Zotero.DB.queryAsync('INSERT INTO indexing.fulltextWords (word) ' + ['SELECT ?' for (word of chunk)].join(' UNION '), chunk);
		}
		yield Zotero.DB.queryAsync('INSERT OR IGNORE INTO fulltextWords (word) SELECT word FROM indexing.fulltextWords');
		yield Zotero.DB.queryAsync('DELETE FROM fulltextItemWords WHERE itemID = ?', [itemID]);
		yield Zotero.DB.queryAsync('INSERT OR IGNORE INTO fulltextItemWords (wordID, itemID) SELECT wordID, ? FROM fulltextWords JOIN indexing.fulltextWords USING(word)', [itemID]);
		yield Zotero.DB.queryAsync("REPLACE INTO fulltextItems (itemID, version) VALUES (?,?)", [itemID, 0]);
		yield Zotero.DB.queryAsync("DELETE FROM indexing.fulltextWords");
	});
	
	
	/**
	 * @return {Promise}
	 */
	var indexString = Zotero.Promise.coroutine(function* (text, charset, itemID, stats, version, synced) {
		var words = this.semanticSplitter(text, charset);
		
		yield Zotero.DB.executeTransaction(function* () {
			this.clearItemWords(itemID, true);
			yield indexWords(itemID, words, stats, version, synced);
			
			var sql = "UPDATE fulltextItems SET synced=?";
			var params = [synced ? parseInt(synced) : SYNC_STATE_UNSYNCED];
			if (stats) {
				for (let stat in stats) {
					sql += ", " + stat + "=?";
					params.push(stats[stat] ? parseInt(stats[stat]) : null);
				}
			}
			if (version) {
				sql += ", version=?";
				params.push(parseInt(version));
			}
			sql += " WHERE itemID=?";
			params.push(itemID);
			yield Zotero.DB.queryAsync(sql, params);
			
			/*
			var sql = "REPLACE INTO fulltextContent (itemID, textContent) VALUES (?,?)";
			Zotero.DB.query(sql, [itemID, {string:text}]);
			*/
			
			Zotero.Notifier.queue('refresh', 'item', itemID);
		}.bind(this));
		
		// If there's a processor cache file, delete it (whether or not we just used it)
		var item = yield Zotero.Items.getAsync(itemID);
		var cacheFile = this.getItemProcessorCacheFile(item);
		if (cacheFile.exists()) {
			cacheFile.remove(false);
		}
	}.bind(this));
	
	
	/**
	 * @param {Document} document
	 * @param {Number} itemID
	 * @return {Promise}
	 */
	this.indexDocument = Zotero.Promise.coroutine(function* (document, itemID) {
		if (!itemID){
			throw ('Item ID not provided to indexDocument()');
		}
		
		Zotero.debug("Indexing document '" + document.title + "'");
		
		if (!Zotero.MIME.isTextType(document.contentType)) {
			Zotero.debug(document.contentType + " document is not text", 2);
			return false;
		}
		
		if (!document.body) {
			Zotero.debug("Cannot index " + document.contentType + " file", 2);
			return false;
		}
		
		if (!document.characterSet){
			Zotero.debug("Text file didn't have charset", 2);
			return false;
		}
		
		var maxLength = Zotero.Prefs.get('fulltext.textMaxLength');
		var obj = yield convertItemHTMLToText(itemID, document.body.innerHTML, maxLength);
		var text = obj.text;
		var totalChars = obj.totalChars;
		
		if (totalChars > maxLength) {
			Zotero.debug('Only indexing first ' + maxLength + ' characters of item '
				+ itemID + ' in indexDocument()');
		}
		
		yield indexString(text, document.characterSet, itemID);
		yield setChars(itemID, { indexed: text.length, total: totalChars });
	});
	
	
	/**
	 * @param {String} path
	 * @param {Boolean} [complete=FALSE]  Index the file in its entirety, ignoring maxLength
	 */
	var indexFile = Zotero.Promise.coroutine(function* (path, contentType, charset, itemID, complete, isCacheFile) {
		if (!(yield OS.File.exists(path))) {
			Zotero.debug('File not found in indexFile()', 2);
			return false;
		}
		
		if (!contentType) {
			Zotero.debug("Content type not provided in indexFile()", 1);
			return false;
		}
		
		if (!itemID) {
			throw new Error('Item ID not provided');
		}
		
		if (contentType == 'application/pdf') {
			return this.indexPDF(path, itemID, complete);
		}
		
		if (!Zotero.MIME.isTextType(contentType)) {
			Zotero.debug('File is not text in indexFile()', 2);
			return false;
		}
		
		if (!charset){
			Zotero.debug("Text file didn't have charset in indexFile()", 1);
			return false;
		}
		
		Zotero.debug('Indexing file ' + path);
		
		var text = yield Zotero.File.getContentsAsync(path, charset);
		var totalChars = text.length;
		var maxLength = complete ? false : Zotero.Prefs.get('fulltext.textMaxLength');
		
		if (contentType == 'text/html') {
			let obj = yield convertItemHTMLToText(itemID, text, maxLength);
			text = obj.text;
			totalChars = obj.totalChars;
		}
		else {
			if (maxLength && text.length > maxLength) {
				text = text.substr(0, maxLength);
			}
		}
		
		yield indexString(text, charset, itemID);
		
		// Record the number of characters indexed (unless we're indexing a (PDF) cache file,
		// in which case the stats are coming from elsewhere)
		if (!isCacheFile) {
			yield setChars(itemID, { indexed: text.length, total: totalChars });
		}
		
		return true;
	}.bind(this));
	
	
	/**
	 * Run PDF through pdfinfo and pdftotext to generate .zotero-ft-info
	 * and .zotero-ft-cache, and pass the text file back to indexFile()
	 *
	 * @param {nsIFile} file
	 * @param {Number} itemID
	 * @param {Boolean} [allPages] - If true, index all pages rather than pdfMaxPages
	 * @return {Promise}
	 */
	this.indexPDF = Zotero.Promise.coroutine(function* (filePath, itemID, allPages) {
		if (!_pdfConverter) {
			Zotero.debug("PDF tools are not installed -- skipping indexing");
			return false;
		}
		
		var maxPages = Zotero.Prefs.get('fulltext.pdfMaxPages');
		if (maxPages == 0) {
			return false;
		}
		
		var item = yield Zotero.Items.getAsync(itemID);
		var linkMode = item.attachmentLinkMode;
		// If file is stored outside of Zotero, create a directory for the item
		// in the storage directory and save the cache file there
		if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
			var parentDirPath = (yield Zotero.Attachments.createDirectoryForItem(item)).path;
		}
		else {
			var parentDirPath = OS.Path.dirname(filePath);
		}
		var infoFilePath = OS.Path.join(parentDirPath, this.pdfInfoCacheFile);
		var cacheFilePath = OS.Path.join(parentDirPath, this.pdfConverterCacheFile);
		
		// Modified 3.02 version that can output a text file directly
		if (_pdfInfo && _pdfInfoVersion.startsWith('3.02')) {
			let args = [filePath, infoFilePath];
			
			try {
				yield Zotero.Utilities.Internal.exec(_pdfInfo, args);
				var totalPages = yield getTotalPagesFromFile(itemID);
			}
			catch (e) {
				Zotero.debug("Error running pdfinfo");
			}
		}
		// Use redirection script
		else if (_pdfInfoScript) {
			let args = [_pdfInfo.path, filePath, infoFilePath];
			
			try {
				yield Zotero.Utilities.Internal.exec(_pdfInfoScript, args);
				var totalPages = yield getTotalPagesFromFile(itemID);
			}
			catch (e) {
				Components.utils.reportError(e);
				Zotero.debug("Error running pdfinfo", 1);
				Zotero.debug(e, 1);
			}
		}
		else {
			Zotero.debug(this.pdfInfoName + " is not available");
		}
		
		var {exec, args} = this.getPDFConverterExecAndArgs();
		args.push('-enc', 'UTF-8', '-nopgbrk');
		
		if (allPages) {
			if (totalPages) {
				var pagesIndexed = totalPages;
			}
		}
		else {
			args.push('-l', maxPages);
			var pagesIndexed = Math.min(maxPages, totalPages);
		}
		args.push(filePath, cacheFilePath);
		
		try {
			yield Zotero.Utilities.Internal.exec(exec, args);
		}
		catch (e) {
			Components.utils.reportError(e);
			Zotero.debug("Error running pdftotext", 1);
			Zotero.debug(e, 1);
			return false;
		}
		
		if (!(yield OS.File.exists(cacheFilePath))) {
			let fileName = OS.Path.basename(filePath);
			let msg = fileName + " was not indexed";
			if (!fileName.match(/^[\u0000-\u007F]+$/)) {
				msg += " -- PDFs with filenames containing extended characters cannot currently be indexed due to a Mozilla limitation";
			}
			Zotero.debug(msg, 2);
			Components.utils.reportError(msg);
			return false;
		}
		
		yield indexFile(cacheFilePath, 'text/plain', 'utf-8', itemID, true, true);
		yield setPages(itemID, { indexed: pagesIndexed, total: totalPages });
		
		return true;
	});
	
	
	this.indexItems = Zotero.Promise.coroutine(function* (items, complete, ignoreErrors) {
		if (!Array.isArray(items)) {
			items = [items];
		}
		var items = yield Zotero.Items.getAsync(items);
		var found = [];
		
		for (let i=0; i<items.length; i++) {
			let item = items[i];
			if (!item.isAttachment()) {
				continue;
			}
			
			let itemID = item.id;
			
			var path = yield item.getFilePathAsync();
			if (!path) {
				Zotero.debug("No file to index for item " + itemID + " in Fulltext.indexItems()");
				continue;
			}
			
			if (ignoreErrors) {
				try {
					yield indexFile(path, item.attachmentContentType, item.attachmentCharset, itemID, complete);
				}
				catch (e) {
					Zotero.debug(e, 1);
					Components.utils.reportError("Error indexing " + path);
					Components.utils.reportError(e);
				}
			}
			else {
				yield indexFile(path, item.attachmentContentType, item.attachmentCharset, itemID, complete);
			}
		}
	});
	
	
	//
	// Full-text content syncing
	//
	/**
	 * Get content and stats that haven't yet been synced
	 *
	 * @param {Integer} maxChars  Maximum total characters to include.
	 *                            The total can go over this if there's a
	 *                            single large item.
	 * @return {Promise<Array<Object>>}
	 */
	this.getUnsyncedContent = Zotero.Promise.coroutine(function* (maxChars) {
		var maxLength = Zotero.Prefs.get('fulltext.textMaxLength');
		var first = true;
		var chars = 0;
		var contentItems = [];
		var sql = "SELECT itemID, indexedChars, totalChars, indexedPages, totalPages "
			+ "FROM fulltextItems JOIN items USING (itemID) WHERE synced=" + SYNC_STATE_UNSYNCED
			+ " ORDER BY clientDateModified DESC";
		var rows = yield Zotero.DB.queryAsync(sql) || [];
		var libraryIsEditable = {};
		var skips = 0;
		var maxSkips = 5;
		for each (let row in rows) {
			let text;
			let itemID = row.itemID;
			let item = yield Zotero.Items.getAsync(itemID);
			let libraryID = item.libraryID;
			// Don't send full-text in read-only libraries
			if (libraryID && libraryIsEditable[libraryID] === undefined) {
				libraryIsEditable[libraryID] = Zotero.Libraries.isEditable(libraryID);
				if (!libraryIsEditable[libraryID]) {
					continue;
				}
			}
			let libraryKey = libraryID + "/" + item.key;
			let mimeType = item.attachmentMIMEType;
			if (isCachedMIMEType(mimeType) || Zotero.MIME.isTextType(mimeType)) {
				try {
					let cacheFile = this.getItemCacheFile(item);
					if (cacheFile.exists()) {
						Zotero.debug("Adding full-text content from cache "
							+ "file for item " + libraryKey);
						text = yield Zotero.File.getContentsAsync(cacheFile);
					}
					else {
						if (!Zotero.MIME.isTextType(mimeType)) {
							Zotero.debug("Full-text content cache file doesn't exist for item "
								+ libraryKey, 2);
							continue;
						}
						
						let file = item.getFile();
						if (!file) {
							Zotero.debug("File doesn't exist getting full-text content for item "
								+ libraryKey, 2);
							continue;
						}
						
						Zotero.debug("Adding full-text content from file for item " + libraryKey);
						text = yield Zotero.File.getContentsAsync(file, item.attachmentCharset);
						
						// If HTML, convert to plain text first, and cache the result
						if (item.attachmentMIMEType == 'text/html') {
							let obj = yield convertItemHTMLToText(
								itemID,
								text,
								// Include in the cache file only as many characters as we
								// indexed previously
								row.indexedChars
							);
							text = obj.text;
						}
						else {
							// Include only as many characters as we've indexed
							text = text.substr(0, row.indexedChars);
						}
					}
				}
				catch (e) {
					Zotero.debug(e, 1);
					Components.utils.reportError(e);
					continue;
				}
			}
			else {
				Zotero.debug("Skipping non-text file getting full-text content for item "
					+ libraryKey, 2);
				
				// Delete rows for items that weren't supposed to be indexed
				yield Zotero.DB.executeTransaction(function* () {
					yield this.clearItemWords(itemID);
				}.bind(this));
				continue;
			}
			
			// If this isn't the first item and it would put us over the limit,
			// skip it
			if (!first && maxChars && ((chars + text.length) > maxChars)) {
				// Don't try more than maxSkips times to fill up to the limit
				skips++;
				if (skips == maxSkips) {
					break;
				}
				continue;
			}
			chars += text.length;
			first = false;
			
			contentItems.push({
				libraryID: item.libraryID,
				key: item.key,
				text: text,
				indexedChars: row.indexedChars ? row.indexedChars : 0,
				totalChars: row.totalChars ? row.totalChars : 0,
				indexedPages: row.indexedPages ? row.indexedPages : 0,
				totalPages: row.totalPages ? row.totalPages : 0
			});
			
			if (maxChars && chars > maxChars) {
				break;
			}
		}
		return contentItems;
	});
	
	
	/**
	 * @return {String}  PHP-formatted POST data for items not yet downloaded
	 */
	this.getUndownloadedPostData = Zotero.Promise.coroutine(function* () {
		// TODO: Redo for API syncing
		
		// On upgrade, get all content
		var sql = "SELECT value FROM settings WHERE setting='fulltext' AND key='downloadAll'";
		if (yield Zotero.DB.valueQueryAsync(sql)) {
			return "&ftkeys=all";
		}
		
		var sql = "SELECT itemID FROM fulltextItems WHERE synced="
			+ SYNC_STATE_TO_DOWNLOAD;
		var itemIDs = yield Zotero.DB.columnQueryAsync(sql);
		if (!itemIDs) {
			return "";
		}
		var undownloaded = {};
		for (let i=0; i<itemIDs.length; i++) {
			let itemID = itemIDs[i];
			let item = yield Zotero.Items.getAsync(itemID);
			let libraryID = item.libraryID
			if (!undownloaded[libraryID]) {
				undownloaded[libraryID] = [];
			}
			undownloaded[libraryID].push(item.key);
		}
		var data = "";
		for (let libraryID in undownloaded) {
			for (let i = 0; i < undownloaded[libraryID].length; i++) {
				data += "&" + encodeURIComponent("ftkeys[" + libraryID + "][" + i + "]")
					+ "=" + undownloaded[libraryID][i];
			}
		}
		return data;
	});
	
	
	/**
	 * Save full-text content and stats to a cache file
	 *
	 * @return {Promise}
	 */
	this.setItemContent = Zotero.Promise.coroutine(function* (libraryID, key, text, stats, version) {
		var libraryKey = libraryID + "/" + key;
		var item = Zotero.Items.getByLibraryAndKey(libraryID, key);
		if (!item) {
			let msg = "Item " + libraryKey + " not found setting full-text content";
			Zotero.debug(msg, 1);
			Components.utils.reportError(msg);
			return;
		}
		var itemID = item.id;
		
		var currentVersion = yield Zotero.DB.valueQueryAsync(
			"SELECT version FROM fulltextItems WHERE itemID=?", itemID
		);
		
		if (text !== '') {
			var processorCacheFile = this.getItemProcessorCacheFile(item);
			var itemCacheFile = this.getItemCacheFile(item);
			
			// If a storage directory doesn't exist, create it
			if (!processorCacheFile.parent.exists()) {
				yield Zotero.Attachments.createDirectoryForItem(item);
			}
			
			// If the local version of the content is already up to date and cached, skip
			if (currentVersion && currentVersion == version && itemCacheFile.exists()) {
				Zotero.debug("Current full-text content version matches remote for item "
					+ libraryKey + " -- skipping");
				var synced = SYNC_STATE_IN_SYNC;
			}
			// If the local version is 0 but the text matches, just update the version
			else if (currentVersion == 0 && itemCacheFile.exists()
					&& (yield Zotero.File.getContentsAsync(itemCacheFile)) == text) {
				Zotero.debug("Current full-text content matches remote for item "
					+ libraryKey + " -- updating version");
				var synced = SYNC_STATE_IN_SYNC;
				yield Zotero.DB.queryAsync("UPDATE fulltextItems SET version=? WHERE itemID=?", [version, itemID]);
			}
			else {
				Zotero.debug("Writing full-text content and data for item " + libraryKey
					+ " to " + processorCacheFile.path);
				yield Zotero.File.putContentsAsync(processorCacheFile, JSON.stringify({
					indexedChars: stats.indexedChars,
					totalChars: stats.totalChars,
					indexedPages: stats.indexedPages,
					totalPages: stats.totalPages,
					version: version,
					text: text
				}));
				var synced = SYNC_STATE_TO_PROCESS;
			}
		}
		else {
			Zotero.debug("Marking full-text content for download for item " + libraryKey);
			var synced = SYNC_STATE_TO_DOWNLOAD;
		}
		
		// If indexed previously, update the sync state
		if (currentVersion !== false) {
			yield Zotero.DB.queryAsync("UPDATE fulltextItems SET synced=? WHERE itemID=?", [synced, itemID]);
		}
		// If not yet indexed, add an empty row
		else {
			yield Zotero.DB.queryAsync(
				"REPLACE INTO fulltextItems (itemID, version, synced) VALUES (?, 0, ?)",
				[itemID, synced]
			);
		}
		
		if (_upgradeCheck) {
			yield Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='fulltext' AND key='downloadAll'");
			_upgradeCheck = false;
		}
		
		this.startContentProcessor();
	});
	
	
	/**
	 * Start the idle observer for the background content processor
	 */
	this.startContentProcessor = function () {
		if (!_idleObserverIsRegistered) {
			Zotero.debug("Initializing full-text content ingester idle observer");
			var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
					.getService(Components.interfaces.nsIIdleService);
			idleService.addIdleObserver(this.idleObserver, _idleObserverDelay);
			_idleObserverIsRegistered = true;
		}
	}
	
	/**
	 * Stop the idle observer and a running timer, if there is one
	 */
	this.stopContentProcessor = function () {
		if (_idleObserverIsRegistered) {
			var idleService = Components.classes["@mozilla.org/widget/idleservice;1"]
				.getService(Components.interfaces.nsIIdleService);
			idleService.removeIdleObserver(this.idleObserver, _idleObserverDelay);
			_idleObserverIsRegistered = false;
		}
		
		if (_processorTimer) {
			_processorTimer.cancel();
			_processorTimer = null;
		}
	}
	
	/**
	 *
	 * @param {Array<Integer>} itemIDs  An array of itemIDs to process; if this
	 *                                  is omitted, a database query is made
	 *                                  to find unprocessed content
	 * @return {Boolean}  TRUE if there's more content to process; FALSE otherwise
	 */
	this.processUnprocessedContent = Zotero.Promise.coroutine(function* (itemIDs) {
		if (!itemIDs) {
			Zotero.debug("Checking for unprocessed full-text content");
			let sql = "SELECT itemID FROM fulltextItems WHERE synced="
				+ SYNC_STATE_TO_PROCESS;
			itemIDs = yield Zotero.DB.columnQueryAsync(sql);
		}
		
		var origLen = itemIDs.length;
		itemIDs = itemIDs.filter(function (id) {
			return !(id in _processorBlacklist);
		});
		if (itemIDs.length < origLen) {
			let skipped = (origLen - itemIDs.length);
			Zotero.debug("Skipping large full-text content for " + skipped
				+ " item" + (skipped == 1 ? '' : 's'));
		}
		
		// If there's no more unprocessed content, stop the idle observer
		if (!itemIDs.length) {
			Zotero.debug("No unprocessed full-text content found");
			this.stopContentProcessor();
			return;
		}
		
		let itemID = itemIDs.shift();
		let item = yield Zotero.Items.getAsync(itemID);
		
		Zotero.debug("Processing full-text content for item " + item.libraryKey);
		
		yield Zotero.Fulltext.indexFromProcessorCache(itemID);
		
		if (itemIDs.length) {
			if (!_processorTimer) {
				_processorTimer = Components.classes["@mozilla.org/timer;1"]
					.createInstance(Components.interfaces.nsITimer);
			}
			_processorTimer.initWithCallback(
				function () {
					Zotero.Fulltext.processUnprocessedContent(itemIDs);
				},
				100,
				Components.interfaces.nsITimer.TYPE_ONE_SHOT
			);
		}
	});
	
	this.idleObserver = {
		observe: function (subject, topic, data) {
			// On idle, start the background processor
			if (topic == 'idle') {
				Zotero.Fulltext.processUnprocessedContent();
			}
			// When back from idle, stop the processor (but keep the idle
			// observer registered)
			else if (topic == 'active') {
				if (_processorTimer) {
					Zotero.debug("Stopping full-text content processor");
					_processorTimer.cancel();
				}
			}
		}
	};
	
	
	/**
	 * @param {Number} itemID
	 * @return {Promise<Boolean>}
	 */
	this.indexFromProcessorCache = Zotero.Promise.coroutine(function* (itemID) {
		try {
			var item = yield Zotero.Items.getAsync(itemID);
			var cacheFile = this.getItemProcessorCacheFile(item);
			if (!cacheFile.exists())  {
				Zotero.debug("Full-text content processor cache file doesn't exist for item " + itemID);
				return false;
			}
			
			var json = yield Zotero.File.getContentsAsync(cacheFile);
			var data = JSON.parse(json);
			
			// Write the text content to the regular cache file
			var item = yield Zotero.Items.getAsync(itemID);
			cacheFile = this.getItemCacheFile(item);
			Zotero.debug("Writing full-text content to " + cacheFile.path);
			yield Zotero.File.putContentsAsync(cacheFile, data.text);
			
			yield indexString(
				data.text,
				"UTF-8",
				itemID,
				{
					indexedChars: data.indexedChars,
					totalChars: data.totalChars,
					indexedPages: data.indexedPages,
					totalPages: data.totalPages
				},
				data.version,
				1
			);
			
			return true;
		}
		catch (e) {
			Components.utils.reportError(e);
			Zotero.debug(e, 1);
			return false;
		};
	});
	
	//
	// End full-text content syncing
	//
	
	
	/*
	 * Scan a string for another string
	 *
	 * _items_ -- one or more attachment items to search
	 * _searchText_ -- text pattern to search for
	 * _mode_:
	 *    'regexp' -- regular expression (case-insensitive)
	 *    'regexpCS' -- regular expression (case-sensitive)
	 *
	 * - Slashes in regex are optional
	 */
	function findTextInString(content, searchText, mode) {
		switch (mode){
			case 'regexp':
			case 'regexpCS':
			case 'regexpBinary':
			case 'regexpCSBinary':
				// Do a multiline search by default
				var flags = 'm';
				var parts = searchText.match(/^\/(.*)\/([^\/]*)/);
				if (parts){
					searchText = parts[1];
					// Ignore user-supplied flags
					//flags = parts[2];
				}
				
				if (mode.indexOf('regexpCS')==-1){
					flags += 'i';
				}
				
				try {
					var re = new RegExp(searchText, flags);
					var matches = re.exec(content);
				}
				catch (e) {
					Zotero.debug(e, 1);
					Components.utils.reportError(e);
				}
				if (matches){
					Zotero.debug("Text found");
					return content.substr(matches.index, 50);
				}
				
				break;
			
			default:
				// Case-insensitive
				searchText = searchText.toLowerCase();
				content = content.toLowerCase();
				
				var pos = content.indexOf(searchText);
				if (pos!=-1){
					Zotero.debug('Text found');
					return content.substr(pos, 50);
				}
		}
		
		return -1;
	}
	
	/**
	 * Scan item files for a text string
	 *
	 * _items_ -- one or more attachment items to search
	 * _searchText_ -- text pattern to search for
	 * _mode_:
	 *    'phrase'
	 *    'regexp'
	 *    'regexpCS' -- case-sensitive regular expression
	 *
	 * Note:
	 *  - Slashes in regex are optional
	 *  - Add 'Binary' to the mode to search all files, not just text files
	 *
	 * @return {Promise<Array<Object>>} A promise for an array of match objects, with 'id' containing
	 *                                  an itemID and 'match' containing a string snippet
	 */
	this.findTextInItems = Zotero.Promise.coroutine(function* (items, searchText, mode){
		if (!searchText){
			return [];
		}
		
		var items = yield Zotero.Items.getAsync(items);
		var found = [];
		
		for (let i=0; i<items.length; i++) {
			let item = items[i];
			if (!item.isAttachment()) {
				continue;
			}
			
			let itemID = item.id;
			let content;
			let mimeType = item.attachmentMIMEType;
			let maxLength = Zotero.Prefs.get('fulltext.textMaxLength');
			let binaryMode = mode && mode.indexOf('Binary') != -1;
			
			if (isCachedMIMEType(mimeType)) {
				let file = this.getItemCacheFile(item);
				if (!file.exists()) {
					continue;
				}
				
				Zotero.debug("Searching for text '" + searchText + "' in " + file.path);
				content = yield Zotero.File.getContentsAsync(file, 'utf-8', maxLength);
			}
			else {
				// If not binary mode, only scan plaintext files
				if (!binaryMode) {
					if (!Zotero.MIME.isTextType(mimeType)) {
						Zotero.debug('Not scanning MIME type ' + mimeType, 4);
						continue;
					}
				}
				
				// Check for a cache file
				let cacheFile = this.getItemCacheFile(item);
				if (cacheFile.exists()) {
					Zotero.debug("Searching for text '" + searchText + "' in " + cacheFile.path);
					content = yield Zotero.File.getContentsAsync(cacheFile, 'utf-8', maxLength);
				}
				else {
					// If that doesn't exist, check for the actual file
					let file = item.getFile();
					if (!file) {
						continue;
					}
					
					Zotero.debug("Searching for text '" + searchText + "' in " + file.path);
					content = yield Zotero.File.getContentsAsync(file, item.attachmentCharset);
					
					// If HTML and not binary mode, convert to text
					if (mimeType == 'text/html' && !binaryMode) {
						// Include in the cache file only as many characters as we've indexed
						let chars = yield getChars(itemID);
						
						let obj = yield convertItemHTMLToText(
							itemID, content, chars ? chars.indexedChars : null
						);
						content = obj.text;
					}
				}
			}
			
			let match = findTextInString(content, searchText, mode);
			if (match != -1) {
				found.push({
					id: itemID,
					match: match
				});
			}
		}
		
		return found;
	});
	
	
	/**
	 * @requireTransaction
	 */
	this.clearItemWords = Zotero.Promise.coroutine(function* (itemID, skipCacheClear) {
		Zotero.DB.requireTransaction();
		
		var sql = "SELECT rowid FROM fulltextItems WHERE itemID=? LIMIT 1";
		var indexed = yield Zotero.DB.valueQueryAsync(sql, itemID);
		if (indexed) {
			yield Zotero.DB.queryAsync("DELETE FROM fulltextItemWords WHERE itemID=?", itemID);
			yield Zotero.DB.queryAsync("DELETE FROM fulltextItems WHERE itemID=?", itemID);
		}
		
		if (indexed) {
			Zotero.Prefs.set('purge.fulltext', true);
		}
		
		if (!skipCacheClear) {
			// Delete fulltext cache file if there is one
			yield clearCacheFile(itemID);
		}
	});
	
	
	/**
	 * @return {Promise}
	 */
	this.getPages = function (itemID, force) {
		var sql = "SELECT indexedPages, totalPages AS total "
			+ "FROM fulltextItems WHERE itemID=?";
		return Zotero.DB.rowQueryAsync(sql, itemID);
	}
	
	
	/**
	 * Gets the number of pages from the PDF info cache file
	 *
	 * @private
	 * @return {Promise}
	 */
	var getTotalPagesFromFile = Zotero.Promise.coroutine(function* (itemID) {
		var file = Zotero.Attachments.getStorageDirectoryByID(itemID);
		file.append(Zotero.Fulltext.pdfInfoCacheFile);
		if (!file.exists()) {
			return false;
		}
		var contents = yield Zotero.File.getContentsAsync(file);
		try {
			// Parse pdfinfo output
			var pages = contents.match('Pages:[^0-9]+([0-9]+)')[1];
		}
		catch (e) {
			Zotero.debug(e);
			return false;
		}
		return pages;
	});
	
	
	/**
	 * @return {Promise}
	 */
	function getChars(itemID) {
		var sql = "SELECT indexedChars, totalChars AS total "
			+ "FROM fulltextItems WHERE itemID=?";
		return Zotero.DB.rowQueryAsync(sql, itemID);
	}
	
	
	/**
	 * Gets the number of characters from the PDF converter cache file
	 *
	 * @return {Promise}
	 */
	var getTotalCharsFromFile = Zotero.Promise.coroutine(function* (itemID) {
		var item = yield Zotero.Items.getAsync(itemID);
		switch (item.attachmentMIMEType) {
			case 'application/pdf':
				var file = Zotero.Attachments.getStorageDirectory(item);
				file.append(this.pdfConverterCacheFile);
				if (!file.exists()) {
					return false;
				}
				break;
				
			default:
				var file = item.getFile();
				if (!file) {
					return false;
				}
		}
		
		var contents = yield Zotero.File.getContentsAsync(file);
		return contents.length;
	});
	
	
	/**
	 * @return {Promise}
	 */
	function setPages(itemID, obj) {
		var sql = "UPDATE fulltextItems SET indexedPages=?, totalPages=? WHERE itemID=?";
		return Zotero.DB.queryAsync(
			sql,
			[
				obj.indexed ? parseInt(obj.indexed) : null,
				obj.total ? parseInt(obj.total) : null,
				itemID
			]
		);
	}
	
	
	/**
	 * @param {Number} itemID
	 * @param {Object} obj
	 * @return {Promise}
	 */
	function setChars(itemID, obj) {
		var sql = "UPDATE fulltextItems SET indexedChars=?, totalChars=? WHERE itemID=?";
		return Zotero.DB.queryAsync(
			sql,
			[
				obj.indexed ? parseInt(obj.indexed) : null,
				obj.total ? parseInt(obj.total) : null,
				itemID
			]
		);
	}
	
	
	/*
	 * Gets the indexed state of an item, 
	 */
	this.getIndexedState = Zotero.Promise.coroutine(function* (item) {
		if (!item.isAttachment()) {
			throw new Error('Item is not an attachment');
		}
		
		var itemID = item.id;
		switch (item.attachmentMIMEType) {
			// Use pages for PDFs
			case 'application/pdf':
				var pages = yield this.getPages(itemID);
				if (pages) {
					var indexedPages = pages.indexedPages;
					var totalPages = pages.total;
					
					if (!totalPages && !indexedPages) {
						var status = this.INDEX_STATE_UNAVAILABLE;
					}
					else if (!indexedPages) {
						var status = this.INDEX_STATE_UNINDEXED;
					}
					else if (indexedPages < totalPages) {
						var status = this.INDEX_STATE_PARTIAL;
					}
					else {
						var status = this.INDEX_STATE_INDEXED;
					}
				}
				else {
					var status = this.INDEX_STATE_UNINDEXED;
				}
				break;
			
			// Use chars
			default:
				var chars = yield getChars(itemID);
				if (chars) {
					var indexedChars = chars.indexedChars;
					var totalChars = chars.total;
					
					if (!totalChars && !indexedChars) {
						var status = this.INDEX_STATE_UNAVAILABLE;
					}
					else if (!indexedChars) {
						var status = this.INDEX_STATE_UNINDEXED;
					}
					else if (indexedChars < totalChars) {
						var status = this.INDEX_STATE_PARTIAL;
					}
					else {
						var status = this.INDEX_STATE_INDEXED;
					}
				}
				else {
					var status = this.INDEX_STATE_UNINDEXED;
				}
		}
		return status;
	});
	
	
	this.isFullyIndexed = Zotero.Promise.coroutine(function* (item) {
		return (yield this.getIndexedState(item)) == this.INDEX_STATE_INDEXED;
	});
	
	
	/**
	 * @return {Promise}
	 */
	this.getIndexStats = Zotero.Promise.coroutine(function* () {
		var sql = "SELECT COUNT(*) FROM fulltextItems WHERE "
			+ "(indexedPages IS NOT NULL AND indexedPages=totalPages) OR "
			+ "(indexedChars IS NOT NULL AND indexedChars=totalChars)"
		var indexed = yield Zotero.DB.valueQueryAsync(sql);
		
		var sql = "SELECT COUNT(*) FROM fulltextItems WHERE "
			+ "(indexedPages IS NOT NULL AND indexedPages<totalPages) OR "
			+ "(indexedChars IS NOT NULL AND indexedChars<totalChars)"
		var partial = yield Zotero.DB.valueQueryAsync(sql);
		
		var sql = "SELECT COUNT(*) FROM itemAttachments WHERE itemID NOT IN "
			+ "(SELECT itemID FROM fulltextItems WHERE "
			+ "indexedPages IS NOT NULL OR indexedChars IS NOT NULL)";
		var unindexed = yield Zotero.DB.valueQueryAsync(sql);
		
		var sql = "SELECT COUNT(*) FROM fulltextWords";
		var words = yield Zotero.DB.valueQueryAsync(sql);
		
		return {
			indexed: indexed,
			partial: partial,
			unindexed: unindexed,
			words: words
		};
	});
	
	
	this.getItemCacheFile = function (item) {
		var cacheFile = Zotero.Attachments.getStorageDirectory(item);
		cacheFile.append(this.pdfConverterCacheFile);
		return cacheFile;
	}
	
	
	this.getItemProcessorCacheFile = function (item) {
		var cacheFile = Zotero.Attachments.getStorageDirectory(item);
		cacheFile.append(_processorCacheFile);
		return cacheFile;
	}
	
	
	/*
	 * Returns true if an item can be reindexed
	 *
	 * Item must be a non-web-link attachment that isn't already fully indexed
	 */
	this.canReindex = Zotero.Promise.coroutine(function* (item) {
		if (item.isAttachment() && item.attachmentLinkMode != Zotero.Attachments.LINK_MODE_LINKED_URL) {
			switch (yield this.getIndexedState(item)) {
				case this.INDEX_STATE_UNAVAILABLE:
				case this.INDEX_STATE_UNINDEXED:
				case this.INDEX_STATE_PARTIAL:
				
				// TODO: automatically reindex already-indexed attachments?
				case this.INDEX_STATE_INDEXED:
					return true;
			}
		}
		return false;
	});
	
	
	/**
	 * @return {Promise}
	 */
	this.rebuildIndex = Zotero.Promise.coroutine(function* (unindexedOnly) {
		// Get all attachments other than web links
		var sql = "SELECT itemID FROM itemAttachments WHERE linkMode!="
			+ Zotero.Attachments.LINK_MODE_LINKED_URL;
		if (unindexedOnly) {
			sql += " AND itemID NOT IN (SELECT itemID FROM fulltextItems "
				+ "WHERE indexedChars IS NOT NULL OR indexedPages IS NOT NULL)";
		}
		var items = yield Zotero.DB.columnQueryAsync(sql);
		if (items) {
			yield Zotero.DB.executeTransaction(function* () {
				yield Zotero.DB.queryAsync("DELETE FROM fulltextItemWords WHERE itemID IN (" + sql + ")");
				yield Zotero.DB.queryAsync("DELETE FROM fulltextItems WHERE itemID IN (" + sql + ")");
			});
			
			yield this.indexItems(items, false, true);
		}
	});
	
	
	/**
	 * Clears full-text word index and all full-text cache files
	 *
	 * @return {Promise}
	 */
	this.clearIndex = function (skipLinkedURLs) {
		return Zotero.DB.executeTransaction(function* () {
			var sql = "DELETE FROM fulltextItems";
			if (skipLinkedURLs) {
				var linkSQL = "SELECT itemID FROM itemAttachments WHERE linkMode ="
					+ Zotero.Attachments.LINK_MODE_LINKED_URL;
				
				sql += " WHERE itemID NOT IN (" + linkSQL + ")";
			}
			yield Zotero.DB.queryAsync(sql);
			
			sql = "DELETE FROM fulltextItemWords";
			if (skipLinkedURLs) {
				sql += " WHERE itemID NOT IN (" + linkSQL + ")";
			}
			yield Zotero.DB.queryAsync(sql);
			
			if (skipLinkedURLs) {
				yield this.purgeUnusedWords();
			}
			else {
				yield Zotero.DB.queryAsync("DELETE FROM fulltextWords");
			}
			
			yield clearCacheFiles();
		}.bind(this));
	}
	
	
	/*
	 * Clears cache file for an item
	 */
	var clearCacheFile = Zotero.Promise.coroutine(function* (itemID) {
		var item = yield Zotero.Items.getAsync(itemID);
		if (!item) {
			return;
		}
		
		if (!item.isAttachment()) {
			Zotero.debug("Item " + itemID + " is not an attachment in Zotero.Fulltext.clearCacheFile()");
			return;
		}
		
		Zotero.debug('Clearing full-text cache file for item ' + itemID);
		var cacheFile = Zotero.Fulltext.getItemCacheFile(item);
		if (cacheFile.exists()) {
			try {
				cacheFile.remove(false);
			}
			catch (e) {
				Zotero.File.checkFileAccessError(e, cacheFile, 'delete');
			}
		}
	});
	
	
	/*
	 * Clear cache files for all attachments
	 */
	var clearCacheFiles = Zotero.Promise.coroutine(function* (skipLinkedURLs) {
		var sql = "SELECT itemID FROM itemAttachments";
		if (skipLinkedURLs) {
			sql += " WHERE linkMode != " + Zotero.Attachments.LINK_MODE_LINKED_URL;
		}
		var items = yield Zotero.DB.columnQueryAsync(sql);
		for (var i=0; i<items.length; i++) {
			yield clearCacheFile(items[i]);
		}
	});
	
	
	/*
	function clearItemContent(itemID){
		Zotero.DB.query("DELETE FROM fulltextContent WHERE itemID=" + itemID);
	}
	*/
	
	
	/**
	 * @return {Promise}
	 */
	this.purgeUnusedWords = Zotero.Promise.coroutine(function* () {
		if (!Zotero.Prefs.get('purge.fulltext')) {
			return;
		}
		
		var sql = "DELETE FROM fulltextWords WHERE wordID NOT IN "
					+ "(SELECT wordID FROM fulltextItemWords)";
		yield Zotero.DB.queryAsync(sql);
		
		Zotero.Prefs.set('purge.fulltext', false)
	});
	
	
	/**
	 * Convert HTML to text for an item and cache the result
	 *
	 * @return {Promise}
	 */
	var convertItemHTMLToText = Zotero.Promise.coroutine(function* (itemID, html, maxLength) {
		// Split elements to avoid word concatentation
		html = html.replace(/>/g, '> ');
		
		var text = HTMLToText(html);
		var totalChars = text.length;
		
		if (maxLength) {
			text = text.substr(0, maxLength);
		}
		
		// Write the converted text to a cache file
		var item = yield Zotero.Items.getAsync(itemID);
		var cacheFile = Zotero.Fulltext.getItemCacheFile(item);
		Zotero.debug("Writing converted full-text HTML content to " + cacheFile.path);
		if (!cacheFile.parent.exists()) {
			yield Zotero.Attachments.createDirectoryForItem(item);
		}
		yield Zotero.File.putContentsAsync(cacheFile, text)
		.catch(function (e) {
			Zotero.debug(e, 1);
			Components.utils.reportError(e);
		});
		
		return {
			text: text,
			totalChars: totalChars
		};
	});
	
	function HTMLToText(html) {
		var	nsIFC = Components.classes['@mozilla.org/widget/htmlformatconverter;1']
			.createInstance(Components.interfaces.nsIFormatConverter);
		var from = Components.classes['@mozilla.org/supports-string;1']
			.createInstance(Components.interfaces.nsISupportsString);
		from.data = html;
		var to = { value: null };
		try {
			nsIFC.convert('text/html', from, from.toString().length, 'text/unicode', to, {});
			to = to.value.QueryInterface(Components.interfaces.nsISupportsString);
			return to.toString();
		}
		catch(e) {
			Zotero.debug(e, 1);
			return html;
		}
	}
	
	
	/**
	 * @param {String} text
	 * @param {String} [charset]
	 * @return {Array<String>}
	 */
	this.semanticSplitter = function (text, charset) {
		if (!text){
			Zotero.debug('No text to index');
			return [];
		}
		
		try {
			if (charset && charset != 'utf-8') {
				text = this.decoder.convertStringToUTF8(text, charset, true);
			}
		} catch (err) {
			Zotero.debug("Error converting from charset " + charset, 1);
			Zotero.debug(err, 1);
		}
		
		var words = {};
		var word = '';
		var cclass = null;
		var strlen = text.length;
		for (var i = 0; i < strlen; i++) {
			var charCode = text.charCodeAt(i);
			var cc = null;
			
			// Adjustments
			if (charCode == 8216 || charCode == 8217) {
				// Curly quotes to straight
				var c = "'";
			}
			else {
				var c = text.charAt(i);
			}
			
			// Consider single quote in the middle of a word a letter
			if (c == "'" && word !== '') {
				cc = kWbClassAlphaLetter;
			}
			
			if (!cc) {
				cc = getClass(c, charCode);
			}
			
			// When we reach space or punctuation, store the previous word if there is one
			if (cc == kWbClassSpace || cc == kWbClassPunct) {
				if (word != '') {
					words[word] = true;
					word = '';
				}
			// When we reach Han character, store previous word and add Han character
			} else if (cc == kWbClassHanLetter) {
				if (word !== '') {
					words[word] = true;
					word = '';
				}
				words[c] = true;
			// Otherwise, if character class hasn't changed, keep adding characters to previous word
			} else if (cc == cclass) {
				word += c.toLowerCase();
			// If character class is different, store previous word and start new word
			} else {
				if (word !== '') {
					words[word] = true;
				}
				word = c.toLowerCase();
			}
			cclass = cc;
		}
		if (word !== '') {
			words[word] = true;
		}
		
		return Object.keys(words).map(function (w) {
			// Trim trailing single quotes
			if (w.slice(-1) == "'") {
				w = w.substr(0, w.length - 1);
			}
			return w;
		});
	}
	
	function _getScriptExtension() {
		return Zotero.isWin ? 'vbs' : 'sh';
	}

}
