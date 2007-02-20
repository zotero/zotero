/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

Zotero.Fulltext = new function(){
	const FULLTEXT_VERSION = 1;
	const CACHE_FILE = '.zotero-ft-cache';
	
	this.init = init;
	this.registerPDFToText = registerPDFToText;
	this.cacheIsOutdated = cacheIsOutdated;
	this.rebuildCache = rebuildCache;
	this.isCachedMIMEType = isCachedMIMEType;
	this.indexWord = indexWord;
	this.indexWords = indexWords;
	this.indexDocument = indexDocument;
	this.indexString = indexString;
	this.indexFile = indexFile;
	this.indexPDF = indexPDF;
	this.indexItems = indexItems;
	this.findTextInFile = findTextInFile;
	this.findTextInItems = findTextInItems;
	this.clearItemWords = clearItemWords;
	//this.clearItemContent = clearItemContent;
	this.purgeUnusedWords = purgeUnusedWords;
	this.HTMLToText = HTMLToText;
	this.semanticSplitter = semanticSplitter;
	
	var _pdftotext = null;
	
	
	function init() {
		this.registerPDFToText();
	}
	
	
	/*
	 * Looks for pdftotext-{platform}[.exe] in the Zotero data directory
	 *
	 * {platform} is navigator.platform, with spaces replaced by hyphens
	 *   e.g. "Win32", "Linux-i686", "MacPPC", "MacIntel", etc.
	 */
	function registerPDFToText() {
		var exec = Zotero.getZoteroDirectory();
		var fileName = 'pdftotext-' + Zotero.platform.replace(' ', '-');
		if (Zotero.isWin) {
			fileName += '.exe';
		}
		
		var errMsg = false;
		
		exec.append(fileName);
		if (exec.exists()) {
			if (exec.isSymlink()) {
				exec = exec.target;
				if (!exec.target) {
					errMsg = fileName + ' symlink target not found';
				}
				else {
					_pdftotext = exec;
				}
			}
			else {
				_pdftotext = exec;
			}
		}
		else {
			errMsg = fileName + ' not found';
		}
		
		if (_pdftotext) {
			Zotero.debug('pdftotext registered at ' + _pdftotext.path);
		}
		else {
			_pdftotext = null;
			Zotero.debug(errMsg + ' -- PDF indexing disabled');
		}
	}
	
	
	function cacheIsOutdated(){
		var sql = "SELECT version FROM version WHERE schema='fulltext'";
		return Zotero.DB.valueQuery(sql) < FULLTEXT_VERSION;
	}
	
	
	function rebuildCache(){
		Zotero.DB.beginTransaction();
		Zotero.DB.query("DELETE FROM fulltextWords");
		Zotero.DB.query("DELETE FROM fulltextItems");
		//Zotero.DB.query("DELETE FROM fulltextContent");
		
		var sql = "SELECT itemID FROM itemAttachments";
		var items = Zotero.DB.columnQuery(sql);
		this.indexItems(items);
		
		Zotero.DB.commitTransaction();
	}
	
	
	function isCachedMIMEType(mimeType) {
		switch (mimeType) {
			case 'application/pdf':
				return true;
		}
		return false;
	}
	
	
	/*
	 * Index a single word
	 *
	 * Note: not used
	 */
	function indexWord(itemID, word){
		Zotero.DB.beginTransaction();
		
		var sql = "SELECT wordID FROM fulltextWords WHERE word=?";
		var wordID = Zotero.DB.valueQuery(sql, {string:word});
		
		if (!wordID){
			var sql = "INSERT INTO fulltextWords (word) VALUES (?)";
			var wordID = Zotero.DB.query(sql, {string:word});
		}
		
		var sql = "INSERT OR IGNORE INTO fulltextItems VALUES (?,?)";
		Zotero.DB.query(sql, [wordID, itemID]);
		
		Zotero.DB.commitTransaction();
	}
	
	
	/*
	 * Index multiple words at once
	 */
	function indexWords(itemID, words){
		if (!words || !words.length || !itemID){
			return false;
		}
		
		var sqlQues = [];
		var sqlParams = [];
		
		for each(var word in words){
			sqlQues.push('?');
			sqlParams.push({string:word});
		}
		
		Zotero.DB.beginTransaction();
		
		var sql = "SELECT word, wordID from fulltextWords WHERE word IN ("
		sql += sqlQues.join() + ")";
		var wordIDs = Zotero.DB.query(sql, sqlParams);
		
		var existing = [];
		for (var i in wordIDs){
			// Underscore avoids problems with JS reserved words
			existing['_' + wordIDs[i]['word']] = wordIDs[i]['wordID'];
		}
		
		// Handle bound parameters manually for optimal speed
		var statement1 = Zotero.DB.getStatement("INSERT INTO fulltextWords (word) VALUES (?)");
		var statement2 = Zotero.DB.getStatement("INSERT OR IGNORE INTO fulltextItems VALUES (?,?)");
		
		for each(var word in words){
			if (existing['_' + word]){
				var wordID = existing['_' + word];
			}
			else {
				statement1.bindUTF8StringParameter(0, word);
				statement1.execute()
				var wordID = Zotero.DB.getLastInsertID();
			}
			
			statement2.bindInt32Parameter(0, wordID);
			statement2.bindInt32Parameter(1, itemID);
			statement2.execute();
		}
		
		statement1.reset();
		statement2.reset();
		
		Zotero.DB.commitTransaction();
	}
	
	
	function indexString(text, charset, itemID){
		var words = semanticSplitter(text, charset);
		
		Zotero.DB.beginTransaction();
		
		this.clearItemWords(itemID);
		this.indexWords(itemID, words);
		
		/*
		var sql = "REPLACE INTO fulltextContent (itemID, textContent) VALUES (?,?)";
		Zotero.DB.query(sql, [itemID, {string:text}]);
		*/
		
		Zotero.DB.commitTransaction();
	}
	
	
	function indexDocument(document, itemID){
		if (!itemID){
			throw ('Item ID not provided to indexDocument()');
		}
		
		Zotero.debug("Indexing document '" + document.title + "'");
		
		if (document.contentType.indexOf('text/') !== 0) {
			Zotero.debug('File is not text in indexDocument()', 2);
			return false;
		}
		
		if (!document.characterSet){
			Zotero.debug("Text file didn't have charset in indexFile()", 1);
			return false;
		}
		
		var text = document.body.innerHTML;
		
		var max = Zotero.Prefs.get('fulltext.textMaxLength');
		if (text.length > max) {
			Zotero.debug('Only indexing first ' + max + ' characters of item '
				+ itemID + ' in indexDocument()');
			text = text.substr(0, max);
		}
		
		text = text.replace(/(>)/g, '$1 ');
		text = this.HTMLToText(text);
		this.indexString(text, document.characterSet, itemID);
	}
	
	
	function indexFile(file, mimeType, charset, itemID){
		if (!file.exists()){
			Zotero.debug('File not found in indexFile()', 2);
			return false;
		}
		
		if (!itemID){ throw ('Item ID not provided to indexFile()'); }
		
		if (!mimeType) {
			Zotero.debug("MIME type not provided in indexFile()", 1);
			return false;
		}
		
		if (mimeType == 'application/pdf') {
			return this.indexPDF(file, itemID);
		}
		
		if (mimeType.substr(0, 5)!='text/'){
			Zotero.debug('File is not text in indexFile()', 2);
			return false;
		}
		
		if (!charset){
			Zotero.debug("Text file didn't have charset in indexFile()", 1);
			return false;
		}
		
		Zotero.debug('Indexing file ' + file.path);
		
		var maxLength = Zotero.Prefs.get('fulltext.textMaxLength');
		var text = Zotero.File.getContents(file, charset, maxLength);
		// Split elements to avoid word concatentation
		text = text.replace(/(>)/g, '$1 ');
		text = this.HTMLToText(text);
		this.indexString(text, charset, itemID);
		
		return true;
	}
	
	
	/*
	 * Run PDF through pdftotext to generate .zotero-ft-cache and pass the
	 * text file back to indexFile()
	 */
	function indexPDF(file, itemID) {
		if (!_pdftotext) {
			return false;
		}
		
		var item = Zotero.Items.get(itemID);
		var linkMode = item.getAttachmentLinkMode();
		// If file is stored outside of Zotero, create a directory for the item
		// in the storage directory and save the cache file there
		if (linkMode == Zotero.Attachments.LINK_MODE_LINKED_FILE) {
			var cacheFile = Zotero.Attachments.createDirectoryForItem(itemID);
		}
		else {
			var cacheFile = file.parent;
		}
		cacheFile.append(CACHE_FILE);
		
		var proc = Components.classes["@mozilla.org/process/util;1"].
				createInstance(Components.interfaces.nsIProcess);
		proc.init(_pdftotext);
		var maxPages = Zotero.Prefs.get('fulltext.pdfMaxPages');
		Zotero.debug('Running pdftotext -nopgbrk -l ' + maxPages +
			' "' + file.path + '" "' + cacheFile.path + '"');
		var args = ['-nopgbrk', '-l', maxPages, file.path, cacheFile.path];
		Zotero.debug(args);
		proc.run(true, args, args.length);
		
		if (cacheFile.exists()) {
			return this.indexFile(cacheFile, 'text/plain', 'utf-8', itemID);
		}
		return false;
	}
	
	
	function indexItems(items){
		if (items.constructor.name != 'Array') {
			items = [items];
		}
		
		var items = Zotero.Items.get(items);
		var found = [];
		
		Zotero.DB.beginTransaction();
		
		for each(var i in items){
			if (!i.isAttachment()){
				continue;
			}
			
			var file = i.getFile();
			if (!file){
				continue;
			}
			
			this.indexFile(file, i.getAttachmentMimeType(),
				i.getAttachmentCharset(), i.getID());
		}
		
		var sql = "REPLACE INTO version (schema,version) VALUES (?,?)";
		Zotero.DB.query(sql, ['fulltext', FULLTEXT_VERSION]);
		
		Zotero.DB.commitTransaction();
	}
	
	
	/*
	 * Scan a file for a text string
	 *
	 * _items_ -- one or more attachment items to search
	 * _searchText_ -- text pattern to search for
	 * _mode_:
	 *    'regexp' -- regular expression (case-insensitive)
	 *    'regexpCS' -- regular expression (case-sensitive)
	 *
	 * - Slashes in regex are optional
	 */
	function findTextInFile(file, charset, searchText, mode){
		Zotero.debug("Searching for text '" + searchText + "' in " + file.path);
		
		var maxLength = Zotero.Prefs.get('fulltext.textMaxLength');
		var str = Zotero.File.getContents(file, charset, maxLength);
		
		// If not binary mode, convert HTML to text
		if (!mode || mode.indexOf('Binary')==-1){
			// Split elements to avoid word concatentation
			str = str.replace(/(>)/g, '$1 ');
			
			// Parse to avoid searching on HTML
			str = this.HTMLToText(str);
		}
		
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
				
				var re = new RegExp(searchText, flags);
				var matches = re(str);
				if (matches){
					Zotero.debug("Text found");
					return str.substr(matches.index, 50);
				}
				
				break;
			
			default:
				// Case-insensitive
				searchText = searchText.toLowerCase();
				str = str.toLowerCase();
				
				var pos = str.indexOf(searchText);
				if (pos!=-1){
					Zotero.debug('Text found');
					return str.substr(pos, 50);
				}
		}
		
		return -1;
	}
	
	/*
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
	 */
	function findTextInItems(items, searchText, mode){
		if (!searchText){
			return [];
		}
		
		var items = Zotero.Items.get(items);
		var found = [];
		
		for each(var i in items){
			if (!i.isAttachment()){
				continue;
			}
			
			var file = i.getFile();
			if (!file){
				continue;
			}
			
			var mimeType = i.getAttachmentMimeType();
			
			if (isCachedMIMEType(mimeType)) {
				var file = _getItemCacheFile(i.getID());
				if (!file.exists()) {
					continue;
				}
				
				mimeType = 'text/plain';
				var charset = 'utf-8';
			}
			else {
				// If not binary mode, only scan plaintext files
				if (!mode || mode.indexOf('Binary') == -1) {
					if (!Zotero.MIME.isTextType(mimeType)) {
						Zotero.debug('Not scanning MIME type ' + mimeType, 4);
						continue;
					}
				}
				
				var charset = i.getAttachmentCharset();
			}
			
			var match = this.findTextInFile(file, charset, searchText, mode);
			
			if (match != -1){
				found.push({id:i.getID(), match:match});
			}
		}
		
		return found;
	}
	
	
	function clearItemWords(itemID){
		Zotero.DB.query("DELETE FROM fulltextItems WHERE itemID=" + itemID);
		
		// Delete fulltext cache file if there is one
		var item = Zotero.Items.get(itemID);
		switch (item.getAttachmentMimeType()) {
			case 'application/pdf':
				var cacheFile = _getItemCacheFile();
				if (cacheFile.exists()) {
					cacheFile.remove(null);
				}
				break;
		}
	}
	
	
	/*
	function clearItemContent(itemID){
		Zotero.DB.query("DELETE FROM fulltextContent WHERE itemID=" + itemID);
	}
	*/
	
	
	function purgeUnusedWords(){
		var sql = "DELETE FROM fulltextWords WHERE wordID NOT IN "
			+ "(SELECT wordID FROM fulltextItems)";
		Zotero.DB.query(sql);
	}
	
	
	function HTMLToText(text){
		var	nsIFC =
			Components.classes['@mozilla.org/widget/htmlformatconverter;1'].
				createInstance(Components.interfaces.nsIFormatConverter);
		var from = Components.classes['@mozilla.org/supports-string;1'].
			createInstance(Components.interfaces.nsISupportsString);
		from.data = text;
		var to = {value:null};
		try {
			nsIFC.convert('text/html', from, from.toString().length,
				'text/unicode', to, {});
			to = to.value.QueryInterface(Components.interfaces.nsISupportsString);
			return to.toString();
		}
		catch(e){
			Zotero.debug(e, 1);
			return text;
		}
	}
	
	
	function semanticSplitter(text, charset){
		if (!text){
			Zotero.debug('No text to index');
			return;
		}
		
		text = _markTroubleChars(text);
		
		var serv = Components.classes["@mozilla.org/intl/semanticunitscanner;1"]
				.createInstance(Components.interfaces.nsISemanticUnitScanner);
		
		var words = [], unique = {}, begin = {}, end = {}, nextPos = 0;
		serv.start(charset ? charset : null);
		do {
			var next = serv.next(text, text.length, nextPos, true, begin, end);
			var str = text.substring(begin.value, end.value);
			
			// Skip non-breaking spaces
			if (!str || str.charCodeAt(0)==32 || str.charCodeAt(0)==160){
				nextPos = end.value;
				begin = {}, end = {};
				continue;
			}
			
			// Create alphanum hash keys out of the character codes
			var lc = str.toLowerCase();
			
			// And store the unique ones
			if (!unique[lc]){
				unique[lc] = true;
			}
			
			nextPos = end.value;
			begin = {}, end = {};
		}
		while (next);
		
		for (var i in unique){
			words.push(_restoreTroubleChars(i));
		}
		
		return words;
	}
	
	
	/*
	 * Add spaces between elements, since HTMLToText doesn't
	 *
	 * NOTE: SLOW AND NOT USED!
	 */
	function _separateElements(node){
		var next = node;
		do {
			if (next.hasChildNodes()){
				_separateElements(next.firstChild);
			}
			
			var space = node.ownerDocument.createTextNode(' ');
			next.parentNode.insertBefore(space, next);
		}
		while (next = next.nextSibling);
	}
	
	
	function _markTroubleChars(text){
		text = text.replace("'", "zoteroapostrophe");
		return text;
	}
	
	
	function _restoreTroubleChars(text){
		text = text.replace("zoteroapostrophe", "'");
		return text;
	}
	
	
	function _getItemCacheFile(itemID) {
		var cacheFile = Zotero.getStorageDirectory();
		cacheFile.append(itemID);
		cacheFile.append(CACHE_FILE);
		return cacheFile;
	}
}
