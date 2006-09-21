Scholar.Fulltext = new function(){
	this.indexWord = indexWord;
	this.indexWords = indexWords;
	this.indexDocument = indexDocument;
	this.indexString = indexString;
	this.indexFile = indexFile;
	this.indexItems = indexItems;
	this.findTextInFile = findTextInFile;
	this.findTextInItems = findTextInItems;
	this.cacheIsOutdated = cacheIsOutdated;
	this.rebuildCache = rebuildCache;
	this.clearItemWords = clearItemWords;
	this.clearItemContent = clearItemContent;
	this.purgeUnusedWords = purgeUnusedWords;
	this.HTMLToText = HTMLToText;
	this.semanticSplitter = semanticSplitter;
	
	const FULLTEXT_VERSION = 1;
	
	
	function cacheIsOutdated(){
		var sql = "SELECT version FROM version WHERE schema='fulltext'";
		return Scholar.DB.valueQuery(sql) < FULLTEXT_VERSION;
	}
	
	
	function rebuildCache(){
		Scholar.DB.beginTransaction();
		Scholar.DB.query("DELETE FROM fulltextWords");
		Scholar.DB.query("DELETE FROM fulltextItems");
		//Scholar.DB.query("DELETE FROM fulltextContent");
		
		var sql = "SELECT itemID FROM itemAttachments";
		var items = Scholar.DB.columnQuery(sql);
		this.indexItems(items);
		
		Scholar.DB.commitTransaction();
	}
	
	
	/*
	 * Index a single word
	 */
	function indexWord(itemID, word){
		Scholar.DB.beginTransaction();
		
		var sql = "SELECT wordID FROM fulltextWords WHERE word=?";
		var wordID = Scholar.DB.valueQuery(sql, {string:word});
		
		if (!wordID){
			var sql = "INSERT INTO fulltextWords (word) VALUES (?)";
			var wordID = Scholar.DB.query(sql, {string:word});
		}
		
		var sql = "INSERT OR IGNORE INTO fulltextItems VALUES (?,?)";
		Scholar.DB.query(sql, [wordID, itemID]);
		
		Scholar.DB.commitTransaction();
	}
	
	
	/*
	 * Index multiple words at once
	 */
	function indexWords(itemID, words){
		if (!words.length){
			return false;
		}
		
		var sqlQues = [];
		var sqlParams = [];
		
		for each(var word in words){
			sqlQues.push('?');
			sqlParams.push({string:word});
		}
		
		Scholar.DB.beginTransaction();
		
		var sql = "SELECT word, wordID from fulltextWords WHERE word IN ("
		sql += sqlQues.join() + ")";
		var wordIDs = Scholar.DB.query(sql, sqlParams);
		
		var existing = [];
		for (var i in wordIDs){
			// Underscore avoids problems with JS reserved words
			existing['_' + wordIDs[i]['word']] = wordIDs[i]['wordID'];
		}
		
		// TODO: use repeated bound statements once db.js supports it
		for each(var word in words){
			if (existing['_' + word]){
				var wordID = existing['_' + word];
			}
			else {
				var sql = "INSERT INTO fulltextWords (word) VALUES (?)";
				var wordID = Scholar.DB.query(sql, {string:word});
			}
			
			var sql = "INSERT OR IGNORE INTO fulltextItems VALUES (?,?)";
			Scholar.DB.query(sql, [{int:wordID}, {int:itemID}]);
		}
		
		Scholar.DB.commitTransaction();
	}
	
	
	function indexString(text, charset, itemID){
		var words = this.semanticSplitter(text, charset);
		
		Scholar.DB.beginTransaction();
		
		this.clearItemWords(itemID);
		this.indexWords(itemID, words);
		
		/*
		var sql = "REPLACE INTO fulltextContent (itemID, textContent) VALUES (?,?)";
		Scholar.DB.query(sql, [itemID, {string:text}]);
		*/
		
		Scholar.DB.commitTransaction();
	}
	
	
	function indexDocument(document, itemID){
		if (!itemID){
			throw ('Item ID not provided to indexDocument()');
		}
		
		Scholar.debug("Indexing document '" + document.title + "'");
		
		_separateElements(document.body);
		var text = this.HTMLToText(document.body.innerHTML);
		this.indexString(text, document.characterSet, itemID);
	}
	
	
	function indexFile(file, mimeType, charset, itemID){
		if (!file.exists()){
			Scholar.debug('File not found in indexFile()', 2);
			return false;
		}
		
		if (!itemID){ throw ('Item ID not provided to indexFile()'); }
		if (!mimeType){ throw ('MIME type not provided to indexFile()'); }
		
		if (mimeType.substr(0, 5)!='text/'){
			Scholar.debug('File is not text in indexFile()', 2);
			return false;
		}
		
		if (!charset){ throw ('Charset not provided to indexFile()'); }
		
		var text = Scholar.File.getContents(file, charset);
		// Split elements to avoid word concatentation
		text = text.replace(/(>)/g, '$1 ');
		text = this.HTMLToText(text);
		this.indexString(text, charset, itemID);
	}
	
	
	function indexItems(items){
		var items = Scholar.Items.get(items);
		var found = [];
		
		Scholar.DB.beginTransaction();
		
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
		Scholar.DB.query(sql, ['fulltext', FULLTEXT_VERSION]);
		
		Scholar.DB.commitTransaction();
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
		Scholar.debug("Searching for text '" + searchText + "' in " + file.path);
		
		var str = Scholar.File.getContents(file, charset);
		
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
					Scholar.debug("Text found");
					return str.substr(matches.index, 50);
				}
				
				break;
			
			default:
				// Case-insensitive
				searchText = searchText.toLowerCase();
				str = str.toLowerCase();
				
				var pos = str.indexOf(searchText);
				if (pos!=-1){
					Scholar.debug('Text found');
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
		
		var items = Scholar.Items.get(items);
		var found = [];
		
		for each(var i in items){
			if (!i.isAttachment()){
				continue;
			}
			
			var file = i.getFile();
			if (!file){
				continue;
			}
			
			// If not binary mode, only scan plaintext files
			if (!mode || mode.indexOf('Binary')==-1){
				if (i.getAttachmentMimeType().substr(0,5)!='text/'){
					continue;
				}
			}
			
			var charset = i.getAttachmentCharset();
			
			var match = this.findTextInFile(file, charset, searchText, mode);
			
			if (match != -1){
				found.push({id:i.getID(), match:match});
			}
		}
		
		return found;
	}
	
	
	function clearItemWords(itemID){
		Scholar.DB.query("DELETE FROM fulltextItems WHERE itemID=" + itemID);
	}
	
	
	function clearItemContent(itemID){
		Scholar.DB.query("DELETE FROM fulltextContent WHERE itemID=" + itemID);
	}
	
	
	function purgeUnusedWords(){
		var sql = "DELETE FROM fulltextWords WHERE wordID NOT IN "
			+ "(SELECT wordID FROM fulltextItems)";
		Scholar.DB.query(sql);
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
			Scholar.debug(e, 1);
			return text;
		}
	}
	
	
	function semanticSplitter(text, charset){
		if (!text){
			Scholar.debug('No text to index');
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
	 * Add spaces between elements, since body.textContent doesn't
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
}
