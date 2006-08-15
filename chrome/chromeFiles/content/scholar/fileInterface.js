var Scholar_File_Interface = new function() {
	var _unresponsiveScriptPreference, _importCollection;
	
	this.exportFile = exportFile;
	this.exportProject = exportProject;
	this.exportItems = exportItems;
	this.importFile = importFile;
	this.bibliographyFromProject = bibliographyFromProject;
	this.bibliographyFromItems = bibliographyFromItems;
	
	/*
	 * Creates Scholar.Translate instance and shows file picker for file export
	 */
	function exportFile(items) {
		var translation = new Scholar.Translate("export");
		var translators = translation.getTranslators();
		
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
				.createInstance(nsIFilePicker);
		fp.init(window, "Export", nsIFilePicker.modeSave);
		for(var i in translators) {
			fp.appendFilter(translators[i].label, translators[i].target);
		}
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
			if(items) {
				translation.setItems(items);
			}
			translation.setLocation(fp.file);
			translation.setTranslator(translators[fp.filterIndex]);
			translation.setHandler("options", _exportOptions);
			translation.setHandler("done", _exportDone);
			_disableUnresponsive();
			Scholar_File_Interface.Progress.show(
				Scholar.getString("fileInterface.itemsExported"),
				function() {
					translation.translate();
			});
		}
	}
	
	/*
	 * exports a collection
	 */
	function exportProject() {
		var collection = ScholarPane.getSelectedCollection();
		if(!collection) throw("no collection currently selected");
		
		exportFile(Scholar.getItems(collection.getID()));
	}
	
	/*
	 * exports items
	 */
	function exportItems() {
		var items = ScholarPane.getSelectedItems();
		if(!items || !items.length) throw("no items currently selected");
		
		exportFile(items);
	}
	
	/*
	 * closes items exported indicator
	 */
	function _exportOptions(obj, options) {
		var io = {options:options}
		window.openDialog("chrome://scholar/content/exportOptions.xul",
			"_blank","chrome,modal,centerscreen", io);
		if(io.options) {
			// refocus dialog
			Scholar_File_Interface.Progress.show();
			return options;
		} else {
			return false;
		}
	}
	
	/*
	 * closes items exported indicator
	 */
	function _exportDone(obj) {
		Scholar_File_Interface.Progress.close();
		_restoreUnresponsive();
	}
	
	/*
	 * Creates Scholar.Translate instance and shows file picker for file import
	 */
	function importFile() {
		var translation = new Scholar.Translate("import");
		var translators = translation.getTranslators();
		
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
				.createInstance(nsIFilePicker);
		fp.init(window, "Import", nsIFilePicker.modeOpen);
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
				_importCollection = Scholar.Collections.add("Imported "+date.toLocaleString());
				
				// import items
				translation.setTranslator(translators[0]);
				translation.setHandler("itemDone", _importItemDone);
				translation.setHandler("collectionDone", _importCollectionDone);
				translation.setHandler("done", _importDone);
				_disableUnresponsive();
				// show progress indicator
				Scholar_File_Interface.Progress.show(
					Scholar.getString("fileInterface.itemsImported"),
					function() {
						translation.translate();
				});
			}
		}
	}
	
	/*
	 * Saves items after they've been imported. We could have a nice little
	 * "items imported" indicator, too.
	 */
	function _importItemDone(obj, item) {
		_importCollection.addItem(item.getID());
	}
	
	/*
	 * Saves collections after they've been imported. Input item is of the type
	 * outputted by Scholar.Collection.toArray(); only receives top-level
	 * collections
	 */
	function _importCollectionDone(obj, collection) {
		collection.changeParent(_importCollection.getID());
	}
	
	/*
	 * closes items imported indicator
	 */
	function _importDone(obj) {
		Scholar_File_Interface.Progress.close();
		_restoreUnresponsive();
	}
	
	/*
	 * disables the "unresponsive script" warning; necessary for import and
	 * export, which can take quite a while to execute
	 */
	function _disableUnresponsive() {
		var prefService = Components.classes["@mozilla.org/preferences-service;1"].
		                  getService(Components.interfaces.nsIPrefBranch);
		_unresponsiveScriptPreference = prefService.getIntPref("dom.max_script_run_time");
		prefService.setIntPref("dom.max_script_run_time", 0);
	}
	 
	/*
	 * restores the "unresponsive script" warning
	 */
	function _restoreUnresponsive() {
		var prefService = Components.classes["@mozilla.org/preferences-service;1"].
		                  getService(Components.interfaces.nsIPrefBranch);
		prefService.setIntPref("dom.max_script_run_time", _unresponsiveScriptPreference);
	}
	
	/*
	 * Creates a bibliography from a project
	 */
	function bibliographyFromProject() {
		var collection = ScholarPane.getSelectedCollection();
		if(!collection) throw("no collection currently selected");
		
		_doBibliographyOptions(Scholar.getItems(collection.getID()));
	}
	
	/*
	 * Creates a bibliography from a items
	 */
	function bibliographyFromItems() {
		var items = ScholarPane.getSelectedItems();
		if(!items || !items.length) throw("no items currently selected");
		
		_doBibliographyOptions(items);
	}
	
	/*
	 * Shows bibliography options and creates a bibliography
	 */
	function _doBibliographyOptions(items) {
		var io = new Object();
		var newDialog = window.openDialog("chrome://scholar/content/bibliography.xul",
			"_blank","chrome,modal,centerscreen", io);
		
		// determine output format
		var format = "HTML";
		if(io.output == "save-as-rtf") {
			format = "RTF";
		}
		
		// generate bibliography
		var bibliography = Scholar.Cite.getBibliography(io.style, items, format);
		
		if(io.output == "print") {
			// printable bibliography, using a hidden browser
			var browser = Scholar.Browser.createHiddenBrowser(window);
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
			
			Scholar.Browser.deleteHiddenBrowser(browser);
			bibliographyStream.close();
		} else if(io.output == "save-as-html") {
			var fStream = _saveBibliography("HTML");
			
			if(fStream !== false) {			
				var html = "";
				html +='<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">\n';
				html +='<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">\n';
				html +='<head>\n';
				html +='<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>\n';
				html +='<title>Bibliography</title>\n';
				html +='</head>\n';
				html +='<body>\n';
				html += bibliography;
				html +='</body>\n';
				html +='</html>\n';
				
				// create UTF-8 output stream
				var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"].
						 createInstance(Components.interfaces.nsIConverterOutputStream);
				os.init(fStream, "UTF-8", 0, "?");

				os.writeString(html);
				
				os.close();
				fStream.close();
			}
		} else if(io.output == "save-as-rtf") {
			var fStream = _saveBibliography("RTF");
			if(fStream !== false) {
				fStream.write(bibliography, bibliography.length);
				fStream.close();
			}
		} else if(io.output == "copy-to-clipboard") {
			// copy to clipboard
			var transferable = Components.classes["@mozilla.org/widget/transferable;1"].
			                   createInstance(Components.interfaces.nsITransferable);
			
			var str = Components.classes["@mozilla.org/supports-string;1"].
			          createInstance(Components.interfaces.nsISupportsString);
			str.data = bibliography;
			
			// add data
			transferable.addDataFlavor("text/html");
			transferable.setTransferData("text/html", str, bibliography.length*2);
			
			var clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"].
			                       getService(Components.interfaces.nsIClipboard);
			clipboardService.setData(transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
		}
	}
	
	function _saveBibliography(format) {	
		// savable bibliography, using a file stream
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
				.createInstance(nsIFilePicker);
		fp.init(window, "Save Bibliography", nsIFilePicker.modeSave);
		
		if(format == "RTF") {
			fp.appendFilter("RTF", "*.rtf");
		} else {
			fp.appendFilters(nsIFilePicker.filterHTML);
		}
		
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
Scholar_File_Interface.Progress = new function() {
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
		
		_progressWindow = window.openDialog("chrome://scholar/chrome/fileProgress.xul", "", "chrome,resizable=no,close=no,dependent,dialog,centerscreen");
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
