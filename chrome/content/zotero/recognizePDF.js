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

/**
 * @fileOverview Tools for automatically retrieving a citation for the given PDF
 */
const MAX_PAGES = 2;

/**
 * Front end for recognizing PDFs
 * @namespace
 */
var Zotero_RecognizePDF = new function() {
	/**
	 * Checks whether a given PDF could theoretically be recognized
	 * @returns {Boolean} True if the PDF can be recognized, false if it cannot be
	 */
	this.canRecognize = function(/**Zotero.Item*/ item) {
		return (item.attachmentMIMEType && item.attachmentMIMEType == "application/pdf" && !item.getSource());
	}
	
	/**
	 * Retrieves metadata for the PDF(s) selected in the Zotero Pane, placing the PDFs as a children
	 * of the new items
	 */
	this.recognizeSelected = function() {
		var items = ZoteroPane.getSelectedItems();
		if (!items) {
			return;
		}
		this.recognizeItems(items);
	}
	
	/**
	 * Retreives metadata for the PDF items passed, placing the PDFs as a children of the new items
	 */
	this.recognizeItems = function(/**Zotero.Item[]*/ items) {
		var itemsCopy = items.slice();
		var item = itemsCopy.shift();
		var file = item.getFile();
		if(file) {
			var recognizer = new Zotero_RecognizePDF.Recognizer();
			recognizer.recognize(file, item.getField("title"),
				function(translate, newItem) {
					// put new item in same collections as the old one
					var itemCollections = item.getCollections();
					for(var j=0; j<itemCollections.length; j++) {
						var collection = Zotero.Collections.get(itemCollections[j]);
						collection.addItem(newItem.id);
					}
					
					// put old item as a child of the new item
					item.setSource(newItem.id);
					item.save();
					
					// continue recognizing
					if(itemsCopy.length) Zotero_RecognizePDF.recognizeItems(itemsCopy);
				});
		} else {
			if(itemsCopy.length) Zotero_RecognizePDF.recognizeItems(itemsCopy);
		}
	}
}

/**
 * @class PDF recognizer backend
 */
Zotero_RecognizePDF.Recognizer = function () {}

/**
 * Retrieves metadata for a PDF and saves it as an item
 *
 * @param {nsIFile} file The PDF file to retrieve metadata for
 * @param {String} pdfTitle The title of the PDF
 * @param {Function} callback The function to be executed when recognition is complete
 */
Zotero_RecognizePDF.Recognizer.prototype.recognize = function(file, pdfTitle, callback) {
	this._pdfTitle = pdfTitle;
	this._callback = callback;
	
	const whitespaceRe = /^\s*$/;
	
	var cacheFile = Zotero.getZoteroDirectory();
	cacheFile.append("recognizePDFcache.txt");
	
	Zotero.debug('Running pdftotext -enc UTF-8 -nopgbrk '
				+ '-l ' + MAX_PAGES + ' "' + file.path + '" "'
				+ cacheFile.path + '"');
	
	var proc = Components.classes["@mozilla.org/process/util;1"].
			createInstance(Components.interfaces.nsIProcess);
	var exec = Zotero.getZoteroDirectory();
	exec.append(Zotero.Fulltext.pdfConverterFileName);
	proc.init(exec);
	
	var args = ['-enc', 'UTF-8', '-nopgbrk', '-raw', '-l', MAX_PAGES];
	args.push(file.path, cacheFile.path);
	proc.run(true, args, args.length);
	
	var inputStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
		.createInstance(Components.interfaces.nsIFileInputStream);
	inputStream.init(cacheFile, 0x01, 0664, 0);
	var intlStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
		.createInstance(Components.interfaces.nsIConverterInputStream);
	intlStream.init(inputStream, "UTF-8", 65535,
		Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
	intlStream.QueryInterface(Components.interfaces.nsIUnicharLineInputStream);
	
	// get the lines in this sample
	var lines = [];
	var lineLengths = [];
	var str = {};
	while(intlStream.readLine(str)) {
		if(!whitespaceRe.test(str.value)) {
			lines.push(str.value);
			lineLengths.push(str.value.length);
		}
	}
	
	// get (not quite) median length
	var lineLengthsLength = lineLengths.length;
	if(lineLengthsLength < 20) {
		this._error();
		return;
	}
	
	var sortedLengths = lineLengths.sort();
	var medianLength = sortedLengths[Math.floor(lineLengthsLength/2)];
	
	// pick lines within 4 chars of the median
	this._goodLines = [];
	var uBound = medianLength + 4;
	var lBound = medianLength - 4;
	for (var i=0; i<lineLengthsLength; i++) {
		if(lineLengths[i] >= lBound && lineLengths[i] <= uBound) this._goodLines.push(lines[i]);
	}
	
	this._startLine = this._iteration = 0;
	this._queryGoogle();
}

/**
 * Queries Google Scholar for metadata for this PDF
 * @private
 */
Zotero_RecognizePDF.Recognizer.prototype._queryGoogle = function() {
	if(this._iteration > 3 || this._startLine >= this._goodLines.length) {
		this._error();
		return;
	}
	
	// take the relevant parts of some lines (exclude hyphenated word)
	var queryStringWords = 0;
	var queryString = "";
	while(queryStringWords < 25 && this._startLine < this._goodLines.length) {
		var words = this._goodLines[this._startLine].split(/\s+/);
		words.shift();
		words.pop();
		if(words.length) {
			queryStringWords += words.length;
			queryString += '"'+words.join(" ")+'" ';
		}
		this._startLine++;
	}
	Zotero.debug("RecognizePDF: Query string "+queryString);
	
	// pass query string to Google Scholar and translate
	var url = "http://scholar.google.com/scholar?q="+encodeURIComponent(queryString);
	this.hiddenBrowser = Zotero.Browser.createHiddenBrowser();
	
	var me = this;
	var translate = new Zotero.Translate("web", true, false);
	translate.setTranslator("57a00950-f0d1-4b41-b6ba-44ff0fc30289");
	translate.setHandler("itemDone", this._callback);
	translate.setHandler("select", function(translate, items) { return me._selectItems(translate, items) });
	translate.setHandler("done", function(translate, success) { if(!success) me._queryGoogle() });
	
	this.hiddenBrowser.addEventListener("pageshow", function() { me._scrape(translate) }, true);
	this.hiddenBrowser.loadURI(url);
}

/**
 * Callback to be executed when Google Scholar is loaded
 * @private
 */
Zotero_RecognizePDF.Recognizer.prototype._scrape = function(/**Zotero.Translate*/ translate) {
	this.hiddenBrowser.removeEventListener("pageshow", this._scrape.caller, true);
	translate.setDocument(this.hiddenBrowser.contentDocument);
	translate.translate();
}

/**
 * Callback to pick first item in the Google Scholar item list
 * @private
 * @type Object
 */
Zotero_RecognizePDF.Recognizer.prototype._selectItems = function(/**Zotero.Translate*/ translate, /**Object*/ items) {
	for(var i in items) {
		var obj = {};
		obj[i] = items;
		return obj;
	}
}

/**
 * Displays an error when a PDF cannot be recognized
 * @private
 */
Zotero_RecognizePDF.Recognizer.prototype._error = function() {
	var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
	promptService.alert(window,
		Zotero.getString('recognizePDF.couldNotRecognize.title'),
		Zotero.getString('recognizePDF.couldNotRecognize.message', this._pdfTitle));
}