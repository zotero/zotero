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

/****Zotero_File_Exporter****
 **
 * A class to handle exporting of items, collections, or the entire library
 **/

/**
 * Constructs a new Zotero_File_Exporter with defaults
 **/
var Zotero_File_Exporter = function() {
	this.name = Zotero.getString("fileInterface.exportedItems");
	this.collection = false;
	this.items = false;
}

/**
 * Performs the actual export operation
 **/
Zotero_File_Exporter.prototype.save = function() {
	var translation = new Zotero.Translate("export");
	var translators = translation.getTranslators();
	
	// present options dialog
	var io = {translators:translators}
	window.openDialog("chrome://zotero/content/exportOptions.xul",
		"_blank", "chrome,modal,centerscreen", io);
	if(!io.selectedTranslator) {
		return false;
	}
	
	const nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
	fp.init(window, Zotero.getString("fileInterface.export"), nsIFilePicker.modeSave);
	
	// set file name and extension
	if(io.selectedTranslator.displayOptions.exportFileData) {
		// if the result will be a folder, don't append any extension or use
		// filters
		fp.defaultString = this.name;
		fp.appendFilters(Components.interfaces.nsIFilePicker.filterAll);
	} else {
		// if the result will be a file, append an extension and use filters
		fp.defaultString = this.name+"."+io.selectedTranslator.target;
		fp.defaultExtension = io.selectedTranslator.target;
		fp.appendFilter(io.selectedTranslator.label, "*."+io.selectedTranslator.target);
	}
	
	var rv = fp.show();
	if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
		if(this.collection) {
			translation.setCollection(this.collection);
		} else if(this.items) {
			translation.setItems(this.items);
		}
		
		translation.setLocation(fp.file);
		translation.setTranslator(io.selectedTranslator);
		translation.setHandler("done", this._exportDone);
		Zotero.UnresponsiveScriptIndicator.disable();
		Zotero_File_Interface.Progress.show(
			Zotero.getString("fileInterface.itemsExported"),
			function() {
				translation.translate();
		});
	}
	return false;
}
	
/*
 * Closes the items exported indicator
 */
Zotero_File_Exporter.prototype._exportDone = function(obj, worked) {
	Zotero_File_Interface.Progress.close();
	Zotero.UnresponsiveScriptIndicator.enable();
	
	if(!worked) {
		window.alert(Zotero.getString("fileInterface.exportError"));
	}
}

/****Zotero_File_Interface****
 **
 * A singleton to interface with ZoteroPane to provide export/bibliography
 * capabilities
 **/
var Zotero_File_Interface = new function() {
	var _importCollection, _unlock;
	
	this.exportFile = exportFile;
	this.exportCollection = exportCollection;
	this.exportItemsToClipboard = exportItemsToClipboard;
	this.exportItems = exportItems;
	this.importFile = importFile;
	this.bibliographyFromCollection = bibliographyFromCollection;
	this.bibliographyFromItems = bibliographyFromItems;
	this.copyItemsToClipboard = copyItemsToClipboard;
	this.copyCitationToClipboard = copyCitationToClipboard;
	
	/*
	 * Creates Zotero.Translate instance and shows file picker for file export
	 */
	function exportFile() {
		var exporter = new Zotero_File_Exporter();
		exporter.name = Zotero.getString("pane.collections.library");
		exporter.save();
	}
	
	/*
	 * exports a collection or saved search
	 */
	function exportCollection() {
		var exporter = new Zotero_File_Exporter();
	
		var collection = ZoteroPane.getSelectedCollection();
		if(collection) {
			exporter.name = collection.getName();
			exporter.collection = collection;
		} else {
			// find sorted items
			exporter.items = ZoteroPane.getSortedItems();
			if(!exporter.items) throw ("No items to save");
			
			// find name
			var search = ZoteroPane.getSelectedSavedSearch();
			if(search) {
				exporter.name = search.name;
			}
		}
		exporter.save();
	}
	
	
	/*
	 * exports items
	 */
	function exportItems() {
		var exporter = new Zotero_File_Exporter();
		
		exporter.items = ZoteroPane.getSelectedItems();
		if(!exporter.items || !exporter.items.length) throw("no items currently selected");
		
		exporter.save();
	}
	
	/*
	 * exports items to clipboard
	 */
	function exportItemsToClipboard(items, translatorID) {
		var translation = new Zotero.Translate("export");
		translation.setItems(items);
		translation.setTranslator(translatorID);
		translation.setHandler("done", _copyToClipboard);
		translation.translate();
	}
	
	/*
	 * handler when done exporting items to clipboard
	 */
	function _copyToClipboard(obj, worked) {
		if(!worked) {
			window.alert(Zotero.getString("fileInterface.exportError"));
		} else {
			Components.classes["@mozilla.org/widget/clipboardhelper;1"]
                      .getService(Components.interfaces.nsIClipboardHelper)
                      .copyString(obj.output.replace(/\r\n/g, "\n"));
		}
	}
	
	/*
	 * Creates Zotero.Translate instance and shows file picker for file import
	 */
	function importFile() {
		var translation = new Zotero.Translate("import");
		var translators = translation.getTranslators();
		
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
				.createInstance(nsIFilePicker);
		fp.init(window, Zotero.getString("fileInterface.import"), nsIFilePicker.modeOpen);
		
		fp.appendFilters(nsIFilePicker.filterAll);
		for(var i in translators) {
			fp.appendFilter(translators[i].label, "*."+translators[i].target);
		}
		
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
			translation.setLocation(fp.file);
			// get translators again, bc now we can check against the file
			translators = translation.getTranslators();
			if(translators.length) {
				// create a new collection to take in imported items
				var date = new Date();
				_importCollection = Zotero.Collections.add(Zotero.getString("fileInterface.imported")+" "+date.toLocaleString());
				
				// import items
				translation.setTranslator(translators[0]);
				translation.setHandler("collectionDone", _importCollectionDone);
				translation.setHandler("done", _importDone);
				Zotero.UnresponsiveScriptIndicator.disable();
				
				// show progress indicator
				Zotero_File_Interface.Progress.show(
					Zotero.getString("fileInterface.itemsImported"),
					function() {
						Zotero.DB.beginTransaction();
						
						// translate
						translation.translate();
				});
			} else {
				window.alert(Zotero.getString("fileInterface.fileFormatUnsupported"));
			}
		}
	}
	
	/*
	 * Saves collections after they've been imported. Input item is of the type
	 * outputted by Zotero.Collection.toArray(); only receives top-level
	 * collections
	 */
	function _importCollectionDone(obj, collection) {
		collection.parent = _importCollection.id;
		collection.save();
	}
	
	/*
	 * closes items imported indicator
	 */
	function _importDone(obj, worked) {
		// add items to import collection
		for each(var itemID in obj.newItems) {
			_importCollection.addItem(itemID);
		}
		
		Zotero.DB.commitTransaction();
		
		Zotero_File_Interface.Progress.close();
		Zotero.UnresponsiveScriptIndicator.enable();
		
		if(!worked) {
			_importCollection.erase();
			window.alert(Zotero.getString("fileInterface.importError"));
		}
	}
	
	/*
	 * Creates a bibliography from a collection or saved search
	 */
	function bibliographyFromCollection() {
		// find sorted items
		var items = Zotero.Items.get(ZoteroPane.getSortedItems(true));
		if(!items) return;
		
		// find name
		var name = false;
		
		var collection = ZoteroPane.getSelectedCollection();
		if(collection) {
			name = collection.getName();
		} else {
			var searchRef = ZoteroPane.getSelectedSavedSearch();
			if(searchRef) {
				var search = new Zotero.Search(searchRef.id);
				name = search.name;
			}
		}
		
		_doBibliographyOptions(name, items);
		return;
		
		throw ("No collection or saved search currently selected");
	}
	
	/*
	 * Creates a bibliography from a items
	 */
	function bibliographyFromItems() {
		var items = ZoteroPane.getSelectedItems();
		if(!items || !items.length) throw("no items currently selected");
		
		_doBibliographyOptions(Zotero.getString("fileInterface.untitledBibliography"), items);
	}
	
	
	/*
	 * Copies HTML and text bibliography entries for passed items in given style
	 *
	 * Does not check that items are actual references (and not notes or attachments)
	 */
	function copyItemsToClipboard(items, style, asHTML) {
		// copy to clipboard
		var transferable = Components.classes["@mozilla.org/widget/transferable;1"].
						   createInstance(Components.interfaces.nsITransferable);
		var clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"].
							   getService(Components.interfaces.nsIClipboard);
		var csl = Zotero.Cite.getStyle(style);
		var itemSet = csl.createItemSet(items); 
		
		// add HTML
		var bibliography = csl.formatBibliography(itemSet, "HTML");
		var str = Components.classes["@mozilla.org/supports-string;1"].
				  createInstance(Components.interfaces.nsISupportsString);
		str.data = bibliography;
		transferable.addDataFlavor("text/html");
		transferable.setTransferData("text/html", str, bibliography.length*2);
		
		// add text (or HTML source)
		var bibliography = csl.formatBibliography(itemSet, asHTML ? 'HTML' : 'Text');
		var str = Components.classes["@mozilla.org/supports-string;1"].
				  createInstance(Components.interfaces.nsISupportsString);
		str.data = bibliography;
		transferable.addDataFlavor("text/unicode");
		transferable.setTransferData("text/unicode", str, bibliography.length*2);
		
		clipboardService.setData(transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
	}
	
	
	/*
	 * Copies HTML and text citations for passed items in given style
	 *
	 * Does not check that items are actual references (and not notes or attachments)
	 *
	 * if |asHTML| is true, copy HTML source as text
	 */
	function copyCitationToClipboard(items, style, asHTML) {
		// copy to clipboard
		var transferable = Components.classes["@mozilla.org/widget/transferable;1"].
						   createInstance(Components.interfaces.nsITransferable);
		var clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"].
							   getService(Components.interfaces.nsIClipboard);
		
		var csl = Zotero.Cite.getStyle(style);
		var itemSet = csl.createItemSet(items);
		var itemIDs = [];
		for (var i=0; i<items.length; i++) {
			itemIDs.push(items[i].getID());
		}
		var citation = csl.createCitation(itemSet.getItemsByIds(itemIDs));
		
		// add HTML
		var bibliography = csl.formatCitation(citation, "HTML");
		var str = Components.classes["@mozilla.org/supports-string;1"].
				  createInstance(Components.interfaces.nsISupportsString);
		str.data = bibliography;
		transferable.addDataFlavor("text/html");
		transferable.setTransferData("text/html", str, bibliography.length*2);
		
		// add text (or HTML source)
		var bibliography = csl.formatCitation(citation, asHTML ? 'HTML' : 'Text');
		var str = Components.classes["@mozilla.org/supports-string;1"].
				  createInstance(Components.interfaces.nsISupportsString);
		str.data = bibliography;
		transferable.addDataFlavor("text/unicode");
		transferable.setTransferData("text/unicode", str, bibliography.length*2);
		
		clipboardService.setData(transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
	}
	
	/*
	 * Shows bibliography options and creates a bibliography
	 */
	function _doBibliographyOptions(name, items) {
		// make sure at least one item is not a standalone note or attachment
		var haveRegularItem = false;
		for each(var item in items) {
			if (item.isRegularItem()) {
				haveRegularItem = true;
				break;
			}
		}
		if (!haveRegularItem) {
			window.alert(Zotero.getString("fileInterface.noReferencesError"));
			return;
		}
		
		var io = new Object();
		var newDialog = window.openDialog("chrome://zotero/content/bibliography.xul",
			"_blank","chrome,modal,centerscreen", io);
		
		if(!io.output) return;
		
		// determine output format
		var format = "HTML";
		if(io.output == "save-as-rtf") {
			format = "RTF";
		}
		
		// generate bibliography
		try {
			if(io.output == 'copy-to-clipboard') {
				copyItemsToClipboard(items, io.style);
				return;
			}
			else {
				var csl = Zotero.Cite.getStyle(io.style);
				var itemSet = csl.createItemSet(items); 
				var bibliography = csl.formatBibliography(itemSet, format);
			}
		} catch(e) {
			window.alert(Zotero.getString("fileInterface.bibliographyGenerationError"));
			throw(e);
		}
		
		if(io.output == "print") {
			// printable bibliography, using a hidden browser
			var browser = Zotero.Browser.createHiddenBrowser(window);
			browser.contentDocument.write(bibliography);
			browser.contentDocument.close();
			
			// this is kinda nasty, but we have to temporarily modify the user's
			// settings to eliminate the header and footer. the other way to do
			// this would be to attempt to print with an embedded browser, but
			// it's not even clear how to attempt to create one
			var prefService = Components.classes["@mozilla.org/preferences-service;1"].
			                  getService(Components.interfaces.nsIPrefBranch);
			var prefsToClear = ["print.print_headerleft", "print.print_headercenter", 
			                    "print.print_headerright", "print.print_footerleft", 
			                    "print.print_footercenter", "print.print_footerright"];
			var oldPrefs = new Array();
			for(var i in prefsToClear) {
				oldPrefs[i] = prefService.getCharPref(prefsToClear[i]);
				prefService.setCharPref(prefsToClear[i], "");
			}
			
			// print
			browser.contentWindow.print();
			
			// set the prefs back
			for(var i in prefsToClear) {
				prefService.setCharPref(prefsToClear[i], oldPrefs[i]);
			}
			
			Zotero.Browser.deleteHiddenBrowser(browser);
		} else if(io.output == "save-as-html") {
			var fStream = _saveBibliography(name, "HTML");
			
			if(fStream !== false) {			
				var html = "";
				html +='<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">\n';
				html +='<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">\n';
				html +='<head>\n';
				html +='<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>\n';
				html +='<title>'+Zotero.getString("fileInterface.bibliographyHTMLTitle")+'</title>\n';
				html +='</head>\n';
				html +='<body>\n';
				html += bibliography;
				html +='</body>\n';
				html +='</html>\n';
				
				// create UTF-8 output stream
				var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
						 createInstance(Components.interfaces.nsIConverterOutputStream);
				os.init(fStream, "UTF-8", 0, "?".charCodeAt(0));

				os.writeString(html);
				
				os.close();
				fStream.close();
			}
		} else if(io.output == "save-as-rtf") {
			var fStream = _saveBibliography(name, "RTF");
			if(fStream !== false) {
				fStream.write(bibliography, bibliography.length);
				fStream.close();
			}
		}
	}
	
	
	function _saveBibliography(name, format) {	
		// savable bibliography, using a file stream
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
				.createInstance(nsIFilePicker);
		fp.init(window, "Save Bibliography", nsIFilePicker.modeSave);
		
		if(format == "RTF") {
			var extension = "rtf";
			fp.appendFilter("RTF", "*.rtf");
		} else {
			var extension = "html";
			fp.appendFilters(nsIFilePicker.filterHTML);
		}
		
		fp.defaultString = name+"."+extension;
		
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {				
			// open file
			var fStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
						  createInstance(Components.interfaces.nsIFileOutputStream);
			fStream.init(fp.file, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate
			return fStream;
		} else {
			return false;
		}
	}
}

// Handles the display of a progress indicator
Zotero_File_Interface.Progress = new function() {
	var _windowLoaded = false;
	var _windowLoading = false;
	var _progressWindow;
	// keep track of all of these things in case they're called before we're
	// done loading the progress window
	var _loadHeadline, _loadNumber, _outOf, _callback;
	
	this.show = show;
	this.close = close;
	
	function show(headline, callback) {
		if(_windowLoading || _windowLoaded) {	// already loading or loaded
			_progressWindow.focus();
			return false;
		}
		_windowLoading = true;
		
		_loadHeadline = headline;
		_loadNumber = 0;
		_outOf = 0;
		_callback = callback;
		
		_progressWindow = window.openDialog("chrome://zotero/content/fileProgress.xul", "", "chrome,resizable=no,close=no,dependent,dialog,centerscreen");
		_progressWindow.addEventListener("pageshow", _onWindowLoaded, false);
		
		return true;
	}
	
	function close() {
		_windowLoaded = false;
		try {
			_progressWindow.close();
		} catch(ex) {}
	}
	
	function _onWindowLoaded() {
		_windowLoading = false;
		_windowLoaded = true;
		
		// do things we delayed because the winodw was loading
		_progressWindow.document.getElementById("progress-label").value = _loadHeadline;
		
		if(_callback) {
			window.setTimeout(_callback, 1500);
		}
	}
}