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
	var _progressWindow, _progressIndicator;
	
	/**
	 * Checks whether a given PDF could theoretically be recognized
	 * @returns {Boolean} True if the PDF can be recognized, false if it cannot be
	 */
	this.canRecognize = function(/**Zotero.Item*/ item) {
		return item.attachmentMIMEType
			&& item.attachmentMIMEType == "application/pdf"
			&& item.isTopLevelItem();
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
	 * @param {Integer} libraryID The library in which to save the PDF
	 * @param {Function} stopCheckCallback Function that returns true if the
	 *                   process is to be interrupted
	 * @return {Promise} A promise resolved when PDF metadata has been retrieved
	 */
	this.recognize = function(file, libraryID, stopCheckCallback) {
		const MAX_PAGES = 15;
		var me = this;
		
		return _extractText(file, MAX_PAGES).then(function(lines) {
			// Look for DOI - Use only first 80 lines to avoid catching article references
			var allText = lines.join("\n"),
				firstChunk = lines.slice(0,80).join('\n'),
				doi = Zotero.Utilities.cleanDOI(firstChunk),
				promise;
			Zotero.debug(allText);
			
			if(!doi) {
				// Look for a JSTOR stable URL, which can be converted to a DOI by prepending 10.2307
				doi = firstChunk.match(/www.\jstor\.org\/stable\/(\S+)/i);
				if(doi) {
					doi = Zotero.Utilities.cleanDOI(
						doi[1].indexOf('10.') == 0 ? doi[1] : '10.2307/' + doi[1]
					);
				}
			}
			
			if(doi) {
				// Look up DOI
				Zotero.debug("RecognizePDF: Found DOI: "+doi);
				
				var translateDOI = new Zotero.Translate.Search();
				translateDOI.setTranslator("11645bd1-0420-45c1-badb-53fb41eeb753");
				translateDOI.setSearch({"itemType":"journalArticle", "DOI":doi});
				promise = _promiseTranslate(translateDOI, libraryID);
			} else {
				promise = Zotero.Promise.reject("No DOI found in text");
			}
			
			return promise
				// Look for ISBNs if no DOI
				.catch(function(error) {
					Zotero.debug("RecognizePDF: " + error);
					var isbns = _findISBNs(allText);
					if (isbns.length) {
						Zotero.debug("RecognizePDF: Found ISBNs: " + isbns);
						
						var translate = new Zotero.Translate.Search();
						translate.setSearch({"itemType":"book", "ISBN":isbns[0]});
						return _promiseTranslate(translate, libraryID);
					} else {
						return Zotero.Promise.reject("No ISBN found in text.");
					}
				})
				// If no DOI or ISBN, query Google Scholar
				.catch(function(error) {
					Zotero.debug("RecognizePDF: " + error);
					return me.GSFullTextSearch.findItem(lines, libraryID, stopCheckCallback);
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
		
		var {exec, args} = Zotero.Fulltext.getPDFConverterExecAndArgs();
		args.push('-enc', 'UTF-8', '-nopgbrk', '-layout', '-l', pages, file.path, cacheFile.path);
		
		Zotero.debug("RecognizePDF: Running " + exec.path + " " + args.map(arg => "'" + arg + "'").join(" "));
		
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
		var deferred = Zotero.Promise.defer();
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
				deferred.reject(translate.translator && translate.translator.length
					? "Translation with " + translate.translator.map(t => t.label) + " failed"
					: "Could not find a translator for given search item"
				);
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
		var validIsbns = [], cleanISBN;
		for (var i =0; i < isbns.length; i++) {
			cleanISBN = Zotero.Utilities.cleanISBN(isbns[i]);
			if(cleanISBN) validIsbns.push(cleanISBN);
		}
		return validIsbns;
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
			
			_progressWindow = this._progressWindow = window.openDialog("chrome://zotero/content/pdfProgress.xul", "", "chrome,close=yes,resizable=yes,dependent,dialog,centerscreen");
			this._progressWindow.addEventListener("pageshow", function() { me._onWindowLoaded() }, false);
		},

		/**
		 * Halts recognition of PDFs
		 */
		"stop": function() {
			this._stopped = true;	
		},
		
		/**
		 * Halts recognition and closes window
		 */
		"close": function() {
			this.stop();
			this._progressWindow.close();
		},
		
		/**
		 * Called when the progress window has been opened; adds items to the tree and begins recognizing
		 * @param
		 */
		"_onWindowLoaded": function() {
			// populate progress window
			var treechildren = this._progressWindow.document.getElementById("treechildren");
			this._rowIDs = [];
			for(var i in this._items) {
				var treeitem = this._progressWindow.document.createElement('treeitem');
				var treerow = this._progressWindow.document.createElement('treerow');
				this._rowIDs.push(this._items[i].id);
				
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
			
			this._progressWindow.document.getElementById("tree").addEventListener(
				"dblclick", function(event) { me._onDblClick(event, this); });
			
			this._cancelHandler = function() { me.stop() };
			this._keypressCancelHandler = function(e) {
				if(e.keyCode === KeyEvent.DOM_VK_ESCAPE) me.stop();
			};
			
			_progressIndicator = this._progressIndicator = this._progressWindow.document.getElementById("progress-indicator");
			this._progressWindow.document.getElementById("cancel-button")
				.addEventListener("command", this._cancelHandler, false);
			// Also cancel if the user presses Esc
			this._progressWindow.addEventListener("keypress", this._keypressCancelHandler);
			this._progressWindow.addEventListener("close", this._cancelHandler, false);
			Zotero_RecognizePDF.GSFullTextSearch.resetQueryLimit();
			this._recognizeItem();
		},

		/**
		 * Shifts an item off of this._items and recognizes it, then calls itself again if there are more
		 * @private
		 */
		"_recognizeItem": function() {
			const SUCCESS_IMAGE = "chrome://zotero/skin/tick.png";
			const FAILURE_IMAGE = "chrome://zotero/skin/cross.png";
			const LOADING_IMAGE = "chrome://global/skin/icons/loading_16.png";

			if(!this._items.length) {
				this._done();
				return;
			}
			
			// Order here matters. Otherwise we may show an incorrect label
			if(this._stopped) {
				this._done(true);
				return;
			}
			
			this._progressIndicator.value = (this._itemTotal-this._items.length)/this._itemTotal*100;
			
			var item = this._items.shift(),
				itemIcon = this._progressWindow.document.getElementById("item-"+item.id+"-icon"),
				itemTitle = this._progressWindow.document.getElementById("item-"+item.id+"-title"),
				rowNumber = this._rowIDs.indexOf(item.id);
			itemIcon.setAttribute("src", LOADING_IMAGE);
			itemTitle.setAttribute("label", "");
			
			var file = item.getFile(), me = this;
			
			(file
			? Zotero_RecognizePDF.recognize(file, item.libraryID, function() { return me._stopped; })
			: Q.reject(new Zotero.Exception.Alert("recognizePDF.fileNotFound")))
			.then(function(newItem) {
				// If already stopped, delete
				if(me._stopped) {
					Zotero.Items.erase(newItem.id);
					throw new Zotero.Exception.Alert('recognizePDF.stopped');
				}
				
				// put new item in same collections as the old one
				var itemCollections = item.getCollections();
				for(var j=0; j<itemCollections.length; j++) {
					var collection = Zotero.Collections.get(itemCollections[j]);
					collection.addItem(newItem.id);
				}
				
				// put old item as a child of the new item
				item.parentID = newItem.id;
				item.save();
				
				itemTitle.setAttribute("label", newItem.getField("title"));
				itemIcon.setAttribute("src", SUCCESS_IMAGE);
				me._rowIDs[rowNumber] = newItem.id;
				
				me._recognizeItem();
			})
			.catch(function(error) {
				Zotero.debug(error);
				Zotero.logError(error);

				itemTitle.setAttribute("label", error instanceof Zotero.Exception.Alert ? error.message : Zotero.getString("recognizePDF.error"));
				itemIcon.setAttribute("src", FAILURE_IMAGE);
				
				// Don't show "completed" label if stopped on last item
				if(me._stopped && !me._items.length) {
					me._done(true);
				} else {
					me._recognizeItem();
				}
			}).finally(function() {
				// scroll to this item
				me._progressWindow.document.getElementById("tree").treeBoxObject.scrollToRow(Math.max(0, me._itemTotal-me._items.length-4));
			}).done();
		},

		/**
		 * Cleans up after items are recognized, disabling the cancel button and
		 * making the progress window close on blur.
		 * @param {Boolean} cancelled Whether the process was cancelled
		 */
		"_done": function(cancelled) {
			this._progressIndicator.value = 100;
			// Switch out cancel for close
			var cancelButton = this._progressWindow.document.getElementById("cancel-button"),
				me = this;
			cancelButton.label = Zotero.getString("recognizePDF.close.label");
			cancelButton.removeEventListener("command", this._cancelHandler, false);
			cancelButton.addEventListener("command", function() { me.close() }, false);
			this._progressWindow.removeEventListener("keypress", this._keypressCancelHandler);
			this._progressWindow.addEventListener("keypress", function() { me.close() });
			
			if(Zotero.isMac) {
				// On MacOS X, the windows are not always on top, so we hide them on
				// blur to avoid clutter
				this._setCloseTimer();
			}
			this._progressWindow.document.getElementById("label").value = 
				cancelled ? Zotero.getString("recognizePDF.cancelled.label")
					: Zotero.getString("recognizePDF.complete.label");
		},
		
		/**
		 * Set a timer after which the window will close automatically. If the
		 * window is refocused, clear the timer and do not attempt to auto-close
		 * any more
		 * @private
		 */
		"_setCloseTimer": function() {
			var me = this, win = this._progressWindow;
			var focusListener = function() {
				if(!win.zoteroCloseTimeoutID) return;
				
				win.clearTimeout(win.zoteroCloseTimeoutID);
				delete win.zoteroCloseTimeoutID;
				
				win.removeEventListener('blur', blurListener, false);
				win.removeEventListener('focus', focusListener, false);
			};
			var blurListener = function() {
				// Close window after losing focus for 5 seconds
				win.zoteroCloseTimeoutID = win.setTimeout(function() { win.close() }, 5000);
				// Prevent auto-close if we gain focus again
				win.addEventListener("focus", focusListener, false);
			};
			win.addEventListener("blur", blurListener, false);
		},
		
		/**
		 * Focus items in Zotero library when double-clicking them in the Retrieve
		 * metadata window.
		 * @param {Event} event
		 * @param {tree} tree XUL tree object
		 * @private
		 */
		"_onDblClick": function(event, tree) {
			if (event && tree && event.type == "dblclick") {
				var itemID = this._rowIDs[tree.treeBoxObject.getRowAt(event.clientX, event.clientY)];
				if(!itemID) return;
				
				// Get the right window. In tab mode, it's the container window
				var lastWin = (window.ZoteroTab ? window.ZoteroTab.containerWindow : window);
				
				if (lastWin.ZoteroOverlay) {
					lastWin.ZoteroOverlay.toggleDisplay(true);
				}
				
				lastWin.ZoteroPane.selectItem(itemID, false, true);
				lastWin.focus();
			}
		}
	};
	
	/**
	 * Singleton for querying Google Scholar. Ensures that all queries are
	 * sequential and respect the delay inbetween queries.
	 * @namespace
	 */
	this.GSFullTextSearch = new function() {
		const GOOGLE_SCHOLAR_QUERY_DELAY = 2000; // In ms
		var queryLimitReached = false,
			inProgress = false,
			queue = [],
			stopCheckCallback; // As long as we process one query at a time, this is ok
		// Load nsICookieManager2
		Components.utils.import("resource://gre/modules/Services.jsm");
		var cookieService = Services.cookies;
		
		/**
		 * Reset "Query Limit Reached" flag, so that we attempt to query Google again
		 */
		this.resetQueryLimit = function() {
			queryLimitReached = false;
		};
		
		/**
		 * Queue up item for Google Scholar query
		 * @param {String[]} lines Lines of text to use for full-text query
		 * @param {Integer | null} libraryID Library to save the item to
		 * @param {Function} stopCheckCallback Function that returns true if the
		 *                   process is to be interrupted
		 * @return {Promise} A promise resolved when PDF metadata has been retrieved
		 */
		this.findItem = function(lines, libraryID, stopCheckCallback) {
			if(!inProgress && queryLimitReached) {
				// There's no queue, so we can reject immediately
				return Q.reject(new Zotero.Exception.Alert("recognizePDF.limit"));
			}
			
			var deferred = Q.defer();
			queue.push({
				deferred: deferred,
				lines: lines,
				libraryID: libraryID,
				stopCheckCallback: stopCheckCallback
			});
			_processQueue();
			return deferred.promise;
		};
		
		/**
		 * Process Google Scholar queue
		 * @private
		 * @param {Boolean} proceed Whether we should pop the next item off the queue
		 *                  This should not be true unless being called after processing
		 *                  another item
		 */
		function _processQueue(proceed) {
			if(inProgress && !proceed) return; //only one at a time
			
			if(!queue.length) {
				inProgress = false;
				return;
			}
			
			inProgress = true;
			if(queryLimitReached) {
				// Irreversibly blocked. Reject remaining items in queue
				var item;
				while(item = queue.shift()) {
					item.deferred.reject(new Zotero.Exception.Alert("recognizePDF.limit"));
				}
				_processQueue(true); // Wrap it up
			} else {
				var item = queue.shift();
				
				stopCheckCallback = item.stopCheckCallback;
				if(stopCheckCallback && stopCheckCallback()) {
					item.deferred.reject(new Zotero.Exception.Alert('recognizePDF.stopped'));
					_processQueue(true);
					return;
				}
				
				item.deferred.resolve(
					Q.try(getGoodLines, item.lines)
					.then(function(lines) {
						return queryGoogle(lines, item.libraryID, 3); // Try querying 3 times
					})
					.finally(function() { _processQueue(true); })
				);
			}
		}
		
		/**
		 * Select lines that are good candidates for Google Scholar query
		 * @private
		 * @param {String[]} lines
		 * @return {String[]}
		 */
		function getGoodLines(lines) {
			// Use only first column from multi-column lines
			const lineRe = /^[\s_]*([^\s]+(?: [^\s_]+)+)/;
			var cleanedLines = [], cleanedLineLengths = [];
			for(var i=0; i<lines.length && cleanedLines.length<100; i++) {
				var m = lineRe.exec(
					lines[i]
					// Replace non-breaking spaces
					.replace(/\xA0/g, ' ')
				);
				if(m && m[1].split(' ').length > 3) {
					cleanedLines.push(m[1]);
					cleanedLineLengths.push(m[1].length);
				}
			}
			
			// Get (not quite) median length
			var lineLengthsLength = cleanedLineLengths.length;
			if(lineLengthsLength < 20
					|| cleanedLines[0] === "This is a digital copy of a book that was preserved for generations on library shelves before it was carefully scanned by Google as part of a project") {
				throw new Zotero.Exception.Alert("recognizePDF.noOCR");
			}
			
			var sortedLengths = cleanedLineLengths.sort(),
				medianLength = sortedLengths[Math.floor(lineLengthsLength/2)];
			
			// Pick lines within 6 chars of the median (this is completely arbitrary)
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
			return goodLines;
		}
		
		/**
		 * Query Google Scholar
		 * @private
		 * @param {String[]} goodLines
		 * @param {Integer | null} libraryID
		 * @param {Integer} tries Number of queries to attempt before giving up
		 * @return {Promise} A promise resolved when PDF metadata has been retrieved
		 */
		function queryGoogle(goodLines, libraryID, tries) {
			if(tries <= 0) throw new Zotero.Exception.Alert("recognizePDF.noMatches");
			
			// Take the relevant parts of some lines (exclude hyphenated word)
			var queryString = "", queryStringWords = 0, nextLine = 0;
			while(queryStringWords < 25) {
				if(!goodLines.length) throw new Zotero.Exception.Alert("recognizePDF.noMatches");
		
				var words = goodLines.splice(nextLine, 1)[0].split(/\s+/);
				// Try to avoid picking adjacent strings so the odds of them appearing in another
				// document quoting our document is low. Every 7th line is a magic value
				nextLine = (nextLine + 7) % goodLines.length;
		
				// Get rid of first and last words
				words.shift();
				words.pop();
				// Make sure there are no long words (probably OCR mistakes)
				var skipLine = false;
				for(var i=0; i<words.length; i++) {
					if(words[i].length > 20) {
						skipLine = true;
						break;
					}
				}
				// Add words to query
				if(!skipLine && words.length) {
					queryStringWords += words.length;
					queryString += '"'+words.join(" ")+'" ';
				}
			}
			
			Zotero.debug("RecognizePDF: Query string " + queryString);
			
			var url = "http://scholar.google.com/scholar?q="+encodeURIComponent(queryString)+"&hl=en&lr=&btnG=Search",
				delay = GOOGLE_SCHOLAR_QUERY_DELAY - (Date.now() - Zotero.HTTP.lastGoogleScholarQueryTime);

			// Delay 
			return (delay > 0 ? Q.delay(delay) : Q())
			.then(function() {
				Zotero.HTTP.lastGoogleScholarQueryTime = Date.now();
				return Zotero.HTTP.promise("GET", url, {"responseType":"document"})
			})
			.then(function(xmlhttp) {
				return _checkCaptchaOK(xmlhttp, 3);
			},
			function(e) {
				return _checkCaptchaError(e, 3);
			})
			.then(function(xmlhttp) {
				var doc = xmlhttp.response,
					deferred = Q.defer(),
					translate = new Zotero.Translate.Web();
				
				translate.setTranslator("57a00950-f0d1-4b41-b6ba-44ff0fc30289");
				translate.setDocument(Zotero.HTTP.wrapDocument(doc, url));
				translate.setHandler("translators", function(translate, detected) {
					if(detected.length) {
						deferred.resolve(_promiseTranslate(translate, libraryID));
					} else {
						deferred.resolve(Q.try(function() {
							return queryGoogle(goodLines, libraryID, tries-1);
						}));
					}
				});
				translate.getTranslators();
				
				return deferred.promise;
			})
			.catch(function(e) {
				if(e.name == "recognizePDF.limit") {
					queryLimitReached = true;
				}
				throw e;
			});
		}
		
		/**
		 * Check for CAPTCHA on a page with HTTP 200 status
		 * @private
		 * @param {XMLHttpRequest} xmlhttp
		 * @param {Integer} tries Number of queries to attempt before giving up
		 * @return {Promise} A promise resolved when PDF metadata has been retrieved
		 */
		function _checkCaptchaOK(xmlhttp, tries) {
			if(stopCheckCallback && stopCheckCallback()) {
				throw new Zotero.Exception.Alert('recognizePDF.stopped');
			}
			
			Zotero.debug("RecognizePDF: (" + xmlhttp.status + ") Got page with title " + xmlhttp.response.title);
			
			if(Zotero.Utilities.xpath(xmlhttp.response, "//form[@action='Captcha']").length) {
				Zotero.debug("RecognizePDF: Found CAPTCHA on page.");
				return _solveCaptcha(xmlhttp, tries);
			}
			return xmlhttp;
		}
		
		/**
		 * Check for CAPTCHA on an error page. Handle 403 and 503 pages
		 * @private
		 * @param {Zotero.HTTP.UnexpectedStatusException} e HTTP response error object
		 * @param {Integer} tries Number of queries to attempt before giving up
		 * @param {Boolean} dontClearCookies Whether to attempt to clear cookies in
		 *                  in order to get CAPTCHA to show up
		 * @return {Promise} A promise resolved when PDF metadata has been retrieved
		 */
		function _checkCaptchaError(e, tries, dontClearCookies) {
			if(stopCheckCallback && stopCheckCallback()) {
				throw new Zotero.Exception.Alert('recognizePDF.stopped');
			}
			
			Zotero.debug("RecognizePDF: Checking for CAPTCHA on Google Scholar error page (" + e.status + ")");
			
			// Check for captcha on error page
			if(e instanceof Zotero.HTTP.UnexpectedStatusException
				&& (e.status == 403 || e.status == 503) && e.xmlhttp.response) {
				if(_extractCaptchaFormData(e.xmlhttp.response)) {
					Zotero.debug("RecognizePDF: CAPTCHA found");
					return _solveCaptcha(e.xmlhttp, tries);
				} else if(!dontClearCookies && e.xmlhttp.channel) { // Make sure we can obtain original URL
					// AFAICT, for 403 errors, GS just says "sorry, try later",
					// but if you clear cookies, you get a CAPTCHA
					Zotero.debug("RecognizePDF: No CAPTCHA detected on page. Clearing cookies.");
					if(!_clearGSCookies(e.xmlhttp.channel.originalURI.host)) {
						//user said no or no cookies removed
						throw new Zotero.Exception.Alert('recognizePDF.limit');
					}
					// Redo GET request
					Zotero.debug("RecognizePDF: Reloading page after clearing cookies.");
					return Zotero.HTTP.promise("GET", e.xmlhttp.channel.originalURI.spec, {"responseType":"document"})
						.then(function(xmlhttp) {
							return _checkCaptchaOK(xmlhttp, tries);
						},
						function(e) {
							return _checkCaptchaError(e, tries, true); // Don't try this again
						});
				}
				
				Zotero.debug("RecognizePDF: Google Scholar returned an unexpected page"
					+ " with status " + e.status);
				throw new Zotero.Exception.Alert('recognizePDF.limit');
			}
			throw e;
		}
		
		/**
		 * Prompt user to enter CPATCHA
		 * @private
		 * @param {XMLHttpRequest} xmlhttp
		 * @param {Integer} [tries] Number of queries to attempt before giving up
		 * @return {Promise} A promise resolved when PDF metadata has been retrieved
		 */
		function _solveCaptcha(xmlhttp, tries) {
			var doc = xmlhttp.response;
			
			if(tries === undefined) tries = 3;
			
			if(!tries) {
				Zotero.debug("RecognizePDF: Failed to solve CAPTCHA after multiple attempts.");
				throw new Zotero.Exception.Alert('recognizePDF.limit');
			}
			
			tries--;
			var formData = doc && _extractCaptchaFormData(doc);
			if(!formData) {
				Zotero.debug("RecognizePDF: Could not find CAPTCHA on page.");
				throw new Zotero.Exception.Alert('recognizePDF.limit');
			}
	
			var io = { dataIn: {
				title: Zotero.getString("recognizePDF.captcha.title"),
				description: Zotero.getString("recognizePDF.captcha.description"),
				imgUrl: formData.img
			}};
			
			_progressWindow.openDialog("chrome://zotero/content/captcha.xul", "",
				"chrome,modal,resizable=no,centerscreen", io);
			
			if(!io.dataOut) {
				Zotero.debug("RecognizePDF: No CAPTCHA entered");
				throw new Zotero.Exception.Alert('recognizePDF.limit');
			}
			
			Zotero.debug('RecognizePDF: User entered "' + io.dataOut.captcha + '" for CAPTCHA');
			formData.input.captcha = io.dataOut.captcha;
			var url = '', prop;
			for(prop in formData.input) {
				url += '&' + encodeURIComponent(prop) + '='
					+ encodeURIComponent(formData.input[prop]);
			}
			
			url = formData.action + '?' + url.substr(1);
			
			return Zotero.HTTP.promise("GET", url, {"responseType":"document"})
				.then(function(xmlhttp) {
					return _checkCaptchaOK(xmlhttp, tries);
				},
				function(e) {
					return _checkCaptchaError(e, tries);
				});
		}
		
		/**
		 * Extract CAPTCHA form-related data from the CAPTCHA page
		 * @private
		 * @param {Document} doc DOM document object for the CAPTCHA page
		 * @return {Object} Object containing data describing CAPTCHA form
		 */
		function _extractCaptchaFormData(doc) {
			var formData = {};
			
			var img = doc.getElementsByTagName('img')[0];
			if(!img) return;
			formData.img = img.src;
			
			var form = doc.forms[0];
			if(!form) return;
			
			formData.action = form.action;
			formData.input = {};
			var inputs = form.getElementsByTagName('input');
			for(var i=0, n=inputs.length; i<n; i++) {
				if(!inputs[i].name) continue;
				formData.input[inputs[i].name] = inputs[i].value;
			}
			
			formData.continue = "http://scholar.google.com";
			
			return formData;
		}
		
		/**
		 * Clear Google cookies to get the CAPTCHA page to appear
		 * @private
		 * @param {String} host Host of the Google Scholar page (in case it's proxied)
		 * @return {Boolean} Whether any cookies were cleared
		 */
		function _clearGSCookies(host) {
			/* There don't seem to be any negative effects of deleting GDSESS
			if(!Zotero.isStandalone) {
				//ask user first
				var response = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
					.getService(Components.interfaces.nsIPromptService)
					.confirm(null, "Clear Google Scholar cookies?",
						"Google Scholar is attempting to block further queries. We can "
						+ "clear certain cookies and try again. This may affect some "
						+ "temporary Google preferences or it may log you out. May we clear"
						+ " your Google Scholar cookies?");
				if(!response) return;
			}*/
			
			var removed = false, cookies = cookieService.getCookiesFromHost(host);
			while(cookies.hasMoreElements()) {
				var cookie = cookies.getNext().QueryInterface(Components.interfaces.nsICookie2);
				if(["GDSESS", "PREF"].indexOf(cookie.name) !== -1) { // GDSESS doesn't seem to always be enough
					Zotero.debug("RecognizePDF: Removing cookie " + cookie.name + " for host "
						+ cookie.host + " and path " + cookie.path);
					cookieService.remove(cookie.host, cookie.name, cookie.path, false);
					removed = true;
				}
			}
			
			if(!removed) {
				Zotero.debug("RecognizePDF: No cookies removed");
			}
			
			return removed;
		}
	};
}
