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
	//this.clearItemContent = clearItemContent;
	this.purgeUnusedWords = purgeUnusedWords;
	this.HTMLToText = HTMLToText;
	this.semanticSplitter = semanticSplitter;
	
	const FULLTEXT_VERSION = 1;
	
	
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
		indexItems(items);
		
		Zotero.DB.commitTransaction();
	}
	
	
	/*
	 * Index a single word
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
		
		clearItemWords(itemID);
		indexWords(itemID, words);
		
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
		
		var text = document.body.innerHTML.replace(/(>)/g, '$1 ');
		text = HTMLToText(text);
		indexString(text, document.characterSet, itemID);
	}
	
	
	function indexFile(file, mimeType, charset, itemID){
		if (!file.exists()){
			Zotero.debug('File not found in indexFile()', 2);
			return false;
		}
		
		if (!itemID){ throw ('Item ID not provided to indexFile()'); }
		if (!mimeType){ throw ('MIME type not provided to indexFile()'); }
		
		if (mimeType.substr(0, 5)!='text/'){
			Zotero.debug('File is not text in indexFile()', 2);
			return false;
		}
		
		if (!charset){ throw ('Charset not provided to indexFile()'); }
		
		var text = Zotero.File.getContents(file, charset);
		// Split elements to avoid word concatentation
		text = text.replace(/(>)/g, '$1 ');
		text = HTMLToText(text);
		indexString(text, charset, itemID);
	}
	
	
	function indexItems(items){
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
			
			indexFile(file, i.getAttachmentMimeType(),
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
		
		var str = Zotero.File.getContents(file, charset);
		
		// If not binary mode, convert HTML to text
		if (!mode || mode.indexOf('Binary')==-1){
			// Split elements to avoid word concatentation
			str = str.replace(/(>)/g, '$1 ');
			
			// Parse to avoid searching on HTML
			str = HTMLToText(str);
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
			
			// If not binary mode, only scan plaintext files
			if (!mode || mode.indexOf('Binary')==-1){
				if (i.getAttachmentMimeType().substr(0,5)!='text/'){
					continue;
				}
			}
			
			var charset = i.getAttachmentCharset();
			
			var match = findTextInFile(file, charset, searchText, mode);
			
			if (match != -1){
				found.push({id:i.getID(), match:match});
			}
		}
		
		return found;
	}
	
	
	function clearItemWords(itemID){
		Zotero.DB.query("DELETE FROM fulltextItems WHERE itemID=" + itemID);
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
}
