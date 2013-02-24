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
 * @fileOverview Tools for automatically retrieving a citation for the given PDF
 */

/**
 * Front end for recognizing PDFs
 * @namespace
 */
var Zotero_RecognizePDF = new function() {
	Components.utils.import("resource://zotero/q.js");
	var _progressWindow, _progressIndicator;
	
	/**
	 * Checks whether a given PDF could theoretically be recognized
	 * @returns {Boolean} True if the PDF can be recognized, false if it cannot be
	 */
	this.canRecognize = function(/**Zotero.Item*/ item) {
		return (item.attachmentMIMEType &&
			item.attachmentMIMEType == "application/pdf" && !item.getSource());
	}
	
	/**
	 * Retrieves metadata for the PDF(s) selected in the Zotero Pane, placing the PDFs as a children
	 * of the new items
	 */
	this.recognizeSelected = function() {
		var installed = ZoteroPane_Local.checkPDFConverter();
		if (!installed) {
			return;
		}
		
		var items = ZoteroPane_Local.getSelectedItems();
		if (!items) return;
		var itemRecognizer = new Zotero_RecognizePDF.ItemRecognizer();
		itemRecognizer.recognizeItems(items);
	}	
	
	/**
	 * Retrieves metadata for a PDF and saves it as an item
	 *
	 * @param {nsIFile} file The PDF file to retrieve metadata for
	 * @param {Integer|null} libraryID The library in which to save the PDF
	 * @return {Promise} A promise resolved when PDF metadata has been retrieved
	 */
	this.recognize = function(file, libraryID) {
		const MAX_PAGES = 7;
		const GOOGLE_SCHOLAR_QUERY_DELAY = 2000; // in ms
		
		return _extractText(file, MAX_PAGES).then(function(lines) {
			// Look for DOI - Use only first 80 lines to avoid catching article references
			var allText = lines.join("\n"),
				doi = Zotero.Utilities.cleanDOI(lines.slice(0,80).join('\n')),
				promise;
			Zotero.debug(allText);
			
			if(doi) {
				// Look up DOI
				Zotero.debug("RecognizePDF: Found DOI: "+doi);
				
				var translate = new Zotero.Translate.Search();
				translate.setTranslator("11645bd1-0420-45c1-badb-53fb41eeb753");
				translate.setSearch({"itemType":"journalArticle", "DOI":doi});
				promise = _promiseTranslate(translate, libraryID);
			} else {
				// Look for ISBNs if no DOI
				var isbns = _findISBNs(allText);
				if(isbns.length) {
					Zotero.debug("RecognizePDF: Found ISBNs: " + isbns);
					
					var translate = new Zotero.Translate.Search();
					translate.setTranslator("c73a4a8c-3ef1-4ec8-8229-7531ee384cc4"); 
					translate.setSearch({"itemType":"book", "ISBN":isbns[0]});
					promise = _promiseTranslate(translate, libraryID);
				} else {
					promise = Q.reject("No ISBN or DOI found");
				}
			}
			
			// If no DOI or ISBN, query Google Scholar
			return promise.fail(function(error) {
				Zotero.debug("RecognizePDF: "+error);
				
				// Use only first column from multi-column lines
				const lineRe = /^\s*([^\s]+(?: [^\s]+)+)/;
				var cleanedLines = [], cleanedLineLengths = [];
				for(var i=0; i<lines.length && cleanedLines.length<100; i++) {
					var m = lineRe.exec(lines[i]);
					if(m && m[1].split(' ').length > 3) {
						cleanedLines.push(m[1]);
						cleanedLineLengths.push(m[1].length);
					}
				}
				
				// get (not quite) median length
				var lineLengthsLength = cleanedLineLengths.length;
				if(lineLengthsLength < 20
						|| cleanedLines[0] === "This is a digital copy of a book that was preserved for generations on library shelves before it was carefully scanned by Google as part of a project") {
					throw new Zotero.Exception.Alert("recognizePDF.noOCR");
				}
				
				var sortedLengths = cleanedLineLengths.sort(),
					medianLength = sortedLengths[Math.floor(lineLengthsLength/2)];
				
				// pick lines within 6 chars of the median (this is completely arbitrary)
				var goodLines = [],
					uBound = medianLength + 6,
					lBound = medianLength - 6;
				for (var i=0; i<lineLengthsLength; i++) {
					if(cleanedLineLengths[i] > lBound && cleanedLineLengths[i] < uBound) {
						// Strip quotation marks so they don't mess up search query quoting
						var line = cleanedLines[i].replace('"', '');
						goodLines.push(line);
					}
				}
				
				var nextLine = 0,
				limited = false,
				queryGoogle = function() {
					// Once we hit the CAPTCHA once, don't keep trying
					if(limited) throw new Zotero.Exception.Alert("recognizePDF.limit");

					// Take the relevant parts of some lines (exclude hyphenated word)
					var queryString = "", queryStringWords = 0;
					while(queryStringWords < 25) {
						if(!goodLines.length) throw new Zotero.Exception.Alert("recognizePDF.noMatches");
				
						var words = goodLines.splice(nextLine, 1)[0].split(/\s+/);
						// Try to avoid picking adjacent strings so the odds of them appearing in another
						// document quoting our document is low. Every 7th line is a magic value
						nextLine = (nextLine + 7) % goodLines.length;
				
						// get rid of first and last words
						words.shift();
						words.pop();
						// make sure there are no long words (probably OCR mistakes)
						var skipLine = false;
						for(var i=0; i<words.length; i++) {
							if(words[i].length > 20) {
								skipLine = true;
								break;
							}
						}
						// add words to query
						if(!skipLine && words.length) {
							queryStringWords += words.length;
							queryString += '"'+words.join(" ")+'" ';
						}
					}
					
					Zotero.debug("RecognizePDF: Query string "+queryString);
					
					var url = "http://scholar.google.com/scholar?q="+encodeURIComponent(queryString)+"&hl=en&lr=&btnG=Search",
						delay = GOOGLE_SCHOLAR_QUERY_DELAY - (Date.now() - Zotero.HTTP.lastGoogleScholarQueryTime);

					// Delay 
					return (delay > 0 ? Q.delay(delay) : Q.when())
					.then(function() {
						Zotero.HTTP.lastGoogleScholarQueryTime = Date.now();
						return Zotero.HTTP.promise("GET", url, {"responseType":"document"})
					})
					.then(function(xmlhttp) {
						if(Zotero.Utilities.xpath(doc, "//form[@action='Captcha']").length) {
							// Hit CAPTCHA
							limited = true;
							throw new Zotero.Exception.Alert("recognizePDF.limit");
						}

						var doc = xmlhttp.response,
							deferred = Q.defer(),
							translate = new Zotero.Translate.Web();
						translate.setTranslator("57a00950-f0d1-4b41-b6ba-44ff0fc30289");
						translate.setDocument(Zotero.HTTP.wrapDocument(doc, url));
						translate.setHandler("translators", function(translate, detected) {
							if(detected.length) {
								deferred.resolve(_promiseTranslate(translate, libraryID));
							} else {
								deferred.reject(new Zotero.Exception.Alert("recognizePDF.noMatches"));
							}
						});
						translate.getTranslators();
						
						return deferred.promise;
					}, function(e) {
						if(e instanceof Zotero.HTTP.UnexpectedStatusException && e.status == 403) {
							// Hit hard block
							throw new Zotero.Exception.Alert("recognizePDF.limit");
						}
						throw e;
					});
				};

				return queryGoogle().fail(queryGoogle).fail(queryGoogle);
			});
		});
	}
	
	/**
	 * Get text from a PDF
	 * @param {nsIFile} file PDF
	 * @param {Number} pages Number of pages to extract
	 * @return {Promise}
	 */
	function _extractText(file, pages) {
		var cacheFile = Zotero.getZoteroDirectory();
		cacheFile.append("recognizePDFcache.txt");
		if(cacheFile.exists()) {
			cacheFile.remove(false);
		}
		
		var exec = Zotero.getZoteroDirectory();
		exec.append(Zotero.Fulltext.pdfConverterFileName);
		
		var args = ['-enc', 'UTF-8', '-nopgbrk', '-layout', '-l', pages];
		args.push(file.path, cacheFile.path);
		
		Zotero.debug('RecognizePDF: Running pdftotext '+args.join(" "));
		
		return Zotero.Utilities.Internal.exec(exec, args).then(function() {
			if(!cacheFile.exists()) {
				throw new Zotero.Exception.Alert("recognizePDF.couldNotRead");
			}
			
			try {
				var inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
					.createInstance(Components.interfaces.nsIFileInputStream);
				inputStream.init(cacheFile, 0x01, 0664, 0);
				try {
					var intlStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
						.createInstance(Components.interfaces.nsIConverterInputStream);
					intlStream.init(inputStream, "UTF-8", 65535,
						Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
					intlStream.QueryInterface(Components.interfaces.nsIUnicharLineInputStream);
					
					// get the lines in this sample
					var lines = [], str = {};
					while(intlStream.readLine(str)) {
						var line = str.value.trim();
						if(line) lines.push(line);
					}
				} finally {
					inputStream.close();
				}
			} finally {
				cacheFile.remove(false);
			}
			
			return lines;
		}, function() {
			throw new Zotero.Exception.Alert("recognizePDF.couldNotRead");
		});
	}
	
	/**
	 * Attach appropriate handlers to a Zotero.Translate instance and begin translation
	 * @return {Promise}
	 */
	function _promiseTranslate(translate, libraryID) {
		var deferred = Q.defer();
		translate.setHandler("select", function(translate, items, callback) {
			for(var i in items) {
				var obj = {};
				obj[i] = items[i];
				callback(obj);
				return;
			}
		});
		translate.setHandler("done", function(translate, success) {
			if(success && translate.newItems.length) {
				deferred.resolve(translate.newItems[0]);
			} else {
				deferred.reject("Translation with Google Scholar failed");
			}
		});
		translate.translate(libraryID, false);
		return deferred.promise;
	}
	
	/**
	 * Search ISBNs in text
	 * @private
	 * @return {String[]} Array of ISBNs
	 */
	function _findISBNs(x) {
		if(typeof(x) != "string") {
			throw "findISBNs: argument must be a string";
		}
		var isbns = [];
	
		// Match lines saying "isbn: " or "ISBN-10:" or similar, consider m-dashes and n-dashes as well
		var pattern = /(SBN|sbn)[ \u2014\u2013\u2012-]?(10|13)?[: ]*([0-9X][0-9X \u2014\u2013\u2012-]+)/g; 
		var match;
		
		while (match = pattern.exec(x)) {
			var isbn = match[3];
			isbn = isbn.replace(/[ \u2014\u2013\u2012-]/g, '');
			if(isbn.length==20 || isbn.length==26) { 
				// Handle the case of two isbns (e.g. paper+hardback) next to each other
				isbns.push(isbn.slice(0,isbn.length/2), isbn.slice(isbn.length/2));
			} else if(isbn.length==23) { 
				// Handle the case of two isbns (10+13) next to each other
				isbns.push(isbn.slice(0,10), isbn.slice(10));
			} else if(isbn.length==10 || isbn.length==13) {
				isbns.push(isbn);
			}
		}
	
		// Validate ISBNs
		var validIsbns = [];
		for (var i =0; i < isbns.length; i++) {
			if(_isValidISBN(isbns[i])) validIsbns.push(isbns[i]);
		}
		return validIsbns;
	}
	
	/**
	 * Check whether an ISBNs is valid
	 * @private
	 * @return {Boolean}
	 */
	function _isValidISBN(isbn) {
		if(isbn.length == 13) {
			// ISBN-13 should start with 978 or 979 i.e. GS1 for book publishing industry
			var prefix = isbn.slice(0,3);
			if (prefix != "978" && prefix != "979") return false;
			// Verify check digit
			var check = 0;
			for (var i = 0; i < 13; i+=2) check += isbn[i]*1;
			for (i = 1; i < 12; i+=2) check += 3 * isbn[i]*1;
			return (check % 10 == 0);
		} else if(isbn.length == 10) {
			// Verify ISBN-10 check digit
			var check = 0;
			for (var i = 0; i < 9; i++) check += isbn[i]*1 * (10-i);
			// last number might be 'X'
			if (isbn[9] == 'X' || isbn[9] == 'x') check += 10;
			else check += isbn[i]*1;
			return (check % 11 == 0);
		}
		return false;
	}

	/**
	 * @class Handles UI, etc. for recognizing multiple items
	 */
	this.ItemRecognizer = function () {
		this._items = [];
	}

	this.ItemRecognizer.prototype = {
		"_stopped": false,
		"_itemsTotal": 0,
		"_progressWindow": null,
		"_progressIndicator": null,

		/**
		 * Retreives metadata for the PDF items passed, displaying a progress dialog during conversion 
		 * and placing the PDFs as a children of the new items
		 * @param {Zotero.Item[]} items
		 */
		"recognizeItems": function(items) {
			var me = this;
			this._items = items.slice();
			this._itemTotal = items.length;
			
			this._progressWindow = window.openDialog("chrome://zotero/content/pdfProgress.xul", "", "chrome,close=yes,resizable=yes,dependent,dialog,centerscreen");
			this._progressWindow.addEventListener("pageshow", function() { me._onWindowLoaded() }, false);
		},

		/**
		 * Halts recognition of PDFs
		 */
		"stop": function() {
			this._stopped = true;	
		},

		/**
		 * Called when the progress window has been opened; adds items to the tree and begins recognizing
		 * @param
		 */
		"_onWindowLoaded": function() {
			// populate progress window
			var treechildren = this._progressWindow.document.getElementById("treechildren");
			for(var i in this._items) {
				var treeitem = this._progressWindow.document.createElement('treeitem');
				var treerow = this._progressWindow.document.createElement('treerow');
				
				var treecell = this._progressWindow.document.createElement('treecell');
				treecell.setAttribute("id", "item-"+this._items[i].id+"-icon");
				treerow.appendChild(treecell);
				
				treecell = this._progressWindow.document.createElement('treecell');
				treecell.setAttribute("label", this._items[i].getField("title"));
				treerow.appendChild(treecell);
				
				treecell = this._progressWindow.document.createElement('treecell');
				treecell.setAttribute("id", "item-"+this._items[i].id+"-title");
				treerow.appendChild(treecell);
				
				treeitem.appendChild(treerow);
				treechildren.appendChild(treeitem);
			}
			
			var me = this;
			this._progressIndicator = this._progressWindow.document.getElementById("progress-indicator");
			this._progressWindow.document.getElementById("cancel-button").addEventListener("command", function() {
				me.stop();
				me._progressWindow.close();
			}, false);
			this._progressWindow.addEventListener("close", function() { me.stop() }, false);
			this._recognizeItem();
		},

		/**
		 * Shifts an item off of this._items and recognizes it, then calls itself again if there are more
		 * @private
		 */
		"_recognizeItem": function() {
			Components.utils.import("resource://zotero/q.js");
			
			const SUCCESS_IMAGE = "chrome://zotero/skin/tick.png";
			const FAILURE_IMAGE = "chrome://zotero/skin/cross.png";
			const LOADING_IMAGE = "chrome://global/skin/icons/loading_16.png";

			if(!this._items.length) {
				this._done();
				return;
			}
			
			this._progressIndicator.value = (this._itemTotal-this._items.length)/this._itemTotal*100;
			
			var item = this._items.shift(),
				itemIcon = this._progressWindow.document.getElementById("item-"+item.id+"-icon"),
				itemTitle = this._progressWindow.document.getElementById("item-"+item.id+"-title");
			itemIcon.setAttribute("src", LOADING_IMAGE);
			
			var file = item.getFile(), me = this;
			
			(file
			? Zotero_RecognizePDF.recognize(file, item.libraryID)
			: Q.reject(new Zotero.Exception.Alert("recognizePDF.fileNotFound")))
			.then(function(newItem) {
				// If already stopped, delete
				if(me._stopped) {
					Zotero.Items.erase(item.id);
					return;
				}
				
				// put new item in same collections as the old one
				var itemCollections = item.getCollections();
				for(var j=0; j<itemCollections.length; j++) {
					var collection = Zotero.Collections.get(itemCollections[j]);
					collection.addItem(newItem.id);
				}
				
				// put old item as a child of the new item
				item.setSource(newItem.id);
				item.save();
				
				itemTitle.setAttribute("label", newItem.getField("title"));
				itemIcon.setAttribute("src", SUCCESS_IMAGE);
				
				me._recognizeItem();
			}, function(error) {
				Zotero.debug(error);
				Zotero.logError(error);

				itemTitle.setAttribute("label", error instanceof Zotero.Exception.Alert ? error.message : Zotero.getString("recognizePDF.error"));
				itemIcon.setAttribute("src", FAILURE_IMAGE);
				
				if(error instanceof Zotero.Exception.Alert && error.name === "recognizePDF.limit") {
					me._done();
				} else {
					me._recognizeItem();
				}
			}).fin(function() {
				// scroll to this item
				me._progressWindow.document.getElementById("tree").treeBoxObject.scrollToRow(Math.max(0, me._itemTotal-me._items.length-5));
			}).done();
		},

		/**
		 * Cleans up after items are recognized, disabling the cancel button and making the progress window
		 * close on blur
		 */
		"_done": function() {
			this._progressIndicator.value = 100;
			this._progressWindow.document.getElementById("cancel-button").label = Zotero.getString("recognizePDF.close.label");
			var me = this;
			this._progressWindow.addEventListener("blur",
				function() { me._progressWindow.setTimeout(function() { me._progressWindow.close() }, 2000) }, false);
			this._progressWindow.document.getElementById("label").value = Zotero.getString("recognizePDF.complete.label");
		}
	}
}