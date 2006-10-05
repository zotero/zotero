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

var Zotero_File_Interface = new function() {
	var _unresponsiveScriptPreference, _importCollection, _notifyItem, _notifyCollection;
	
	this.exportFile = exportFile;
	this.exportCollection = exportCollection;
	this.exportItems = exportItems;
	this.importFile = importFile;
	this.bibliographyFromCollection = bibliographyFromCollection;
	this.bibliographyFromItems = bibliographyFromItems;
	
	/*
	 * Creates Zotero.Translate instance and shows file picker for file export
	 */
	function exportFile(name, items) {
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
		name = (name ? name : Zotero.getString("pane.collections.library"));
		fp.defaultString = name+"."+io.selectedTranslator.target;
		fp.appendFilter(io.selectedTranslator.label, "*."+io.selectedTranslator.target);
		
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
			if(items) {
				translation.setItems(items);
			}
			translation.setLocation(fp.file);
			translation.setTranslator(io.selectedTranslator);
			translation.setHandler("done", _exportDone);
			_disableUnresponsive();
			Zotero_File_Interface.Progress.show(
				Zotero.getString("fileInterface.itemsExported"),
				function() {
					translation.translate();
			});
		}
	}
	
	/*
	 * exports a collection or saved search
	 */
	function exportCollection() {
		var collection = ZoteroPane.getSelectedCollection();
		if (collection)
		{
			exportFile(collection.getName(), Zotero.getItems(collection.getID()));
			return;
		}
		
		var searchRef = ZoteroPane.getSelectedSavedSearch();
		if (searchRef)
		{
			var search = new Zotero.Search();
			search.load(searchRef['id']);
			exportFile(search.getName(), Zotero.Items.get(search.search()));
			return;
		}
		
		throw ("No collection or saved search currently selected");
	}
	
	
	/*
	 * exports items
	 */
	function exportItems() {
		var items = ZoteroPane.getSelectedItems();
		if(!items || !items.length) throw("no items currently selected");
		
		exportFile(Zotero.getString("fileInterface.exportedItems"), items);
	}
	
	/*
	 * closes items exported indicator
	 */
	function _exportDone(obj, worked) {
		Zotero_File_Interface.Progress.close();
		_restoreUnresponsive();
		
		if(!worked) {
			window.alert(Zotero.getString("fileInterface.exportError"));
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
				_disableUnresponsive();
				
				// disable notifier
				Zotero.Notifier.disable();
				
				// show progress indicator
				Zotero_File_Interface.Progress.show(
					Zotero.getString("fileInterface.itemsImported"),
					function() {
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
		Zotero.Notifier.enable();
		Zotero.Notifier.trigger("add", "collection", collection.getID());
		collection.changeParent(_importCollection.getID());
		Zotero.Notifier.disable();
	}
	
	/*
	 * closes items imported indicator
	 */
	function _importDone(obj, worked) {
		// add items to import collection
		for each(var itemID in obj.newItems) {
			_importCollection.addItem(itemID);
		}
		
		// run notify
		Zotero.Notifier.enable();
		if(obj.newItems.length) {
			Zotero.Notifier.trigger("add", "item", obj.newItems);
			Zotero.Notifier.trigger("modify", "collection", _importCollection.getID());
		}
		
		Zotero_File_Interface.Progress.close();
		_restoreUnresponsive();
		
		if(!worked) {
			window.alert(Zotero.getString("fileInterface.importError"));
		}
	}
	
	/*
	 * disables the "unresponsive script" warning; necessary for import and
	 * export, which can take quite a while to execute
	 */
	function _disableUnresponsive() {
		var prefService = Components.classes["@mozilla.org/preferences-service;1"].
		                  getService(Components.interfaces.nsIPrefBranch);
		_unresponsiveScriptPreference = prefService.getIntPref("dom.max_chrome_script_run_time");
		prefService.setIntPref("dom.max_chrome_script_run_time", 0);
	}
	 
	/*
	 * restores the "unresponsive script" warning
	 */
	function _restoreUnresponsive() {
		var prefService = Components.classes["@mozilla.org/preferences-service;1"].
		                  getService(Components.interfaces.nsIPrefBranch);
		prefService.setIntPref("dom.max_chrome_script_run_time", _unresponsiveScriptPreference);
	}
	
	/*
	 * Creates a bibliography from a collection or saved search
	 */
	function bibliographyFromCollection() {
		var collection = ZoteroPane.getSelectedCollection();
		if (collection)
		{
			_doBibliographyOptions(collection.getName(), Zotero.getItems(collection.getID()));
			return;
		}
		
		var searchRef = ZoteroPane.getSelectedSavedSearch();
		if (searchRef)
		{
			var search = new Zotero.Search();
			search.load(searchRef['id']);
			_doBibliographyOptions(search.getName(), Zotero.Items.get(search.search()));
			return;
		}
		
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
	 * Shows bibliography options and creates a bibliography
	 */
	function _doBibliographyOptions(name, items) {
		// make sure at least one item is not a standalone note or attachment
		var haveNonNote = false;
		for(var i in items) {
			var type = Zotero.ItemTypes.getName(items[i].getType());
			if(type != "note" && type != "attachment") {
				haveNonNote = true;
				break;
			}
		}
		if(!haveNonNote) {
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
			var csl = Zotero.Cite.getStyle(io.style);
			csl.preprocessItems(items);
			var bibliography = csl.createBibliography(items, format);
		} catch(e) {
			window.alert(Zotero.getString("fileInterface.bibliographyGenerationError"));
			throw(e);
			return;
		}
		
		if(io.output == "print") {
			// printable bibliography, using a hidden browser
			var browser = Zotero.Browser.createHiddenBrowser(window);
			browser.contentDocument.write(bibliography);
			
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
		} else if(io.output == "copy-to-clipboard") {
			// copy to clipboard
			var transferable = Components.classes["@mozilla.org/widget/transferable;1"].
			                   createInstance(Components.interfaces.nsITransferable);
			var clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"].
			                       getService(Components.interfaces.nsIClipboard);
			
			// add HTML
			var str = Components.classes["@mozilla.org/supports-string;1"].
			          createInstance(Components.interfaces.nsISupportsString);
			str.data = bibliography;
			transferable.addDataFlavor("text/html");
			transferable.setTransferData("text/html", str, bibliography.length*2);
			// add text
			var bibliography = csl.createBibliography(items, "Text");
			var str = Components.classes["@mozilla.org/supports-string;1"].
			          createInstance(Components.interfaces.nsISupportsString);
			str.data = bibliography;
			transferable.addDataFlavor("text/unicode");
			transferable.setTransferData("text/unicode", str, bibliography.length*2);
			
			clipboardService.setData(transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
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
		
		_progressWindow = window.openDialog("chrome://zotero/chrome/fileProgress.xul", "", "chrome,resizable=no,close=no,dependent,dialog,centerscreen");
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
