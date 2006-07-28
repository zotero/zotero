Scholar_File_Interface = new function() {
	this.exportFile = exportFile;
	this.importFile = importFile;
	this.bibliographyFromProject = bibliographyFromProject;
	
	/*
	 * Creates Scholar.Translate instance and shows file picker for file export
	 */
	function exportFile() {
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
			translation.setLocation(fp.file);
			translation.setTranslator(translators[fp.filterIndex]);
			//translation.setHandler("done", _exportDone);
			translation.translate();
		}
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
				// TODO: display a list of available translators
				translation.setTranslator(translators[0]);
				translation.setHandler("itemDone", _importItemDone);
				translation.translate();
			}
		}
	}
	
	/*
	 * Creates a bibliography
	 */
	function bibliographyFromProject() {
		var collection = ScholarPane.getSelectedCollection();
		if(!collection) throw("error in bibliographyFromProject: no collection currently selected");
		
		_doBibliographyOptions(Scholar.getItems(collection.getID()));
	}
	
	/*
	 * Saves items after they've been imported. We could have a nice little
	 * "items imported" indicator, too.
	 */
	function _importItemDone(obj, item) {
		item.save();
	}
	
	/*
	 * Shows bibliography options and creates a bibliography
	 */
	function _doBibliographyOptions(items) {
		var io = new Object();
		var newDialog = window.openDialog("chrome://scholar/content/bibliography.xul",
			"_blank","chrome,modal,centerscreen", io);
		
		// generate bibliography
		var bibliography = Scholar.Cite.getBibliography(io.style, items);
		
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
			// savable bibliography, using a file stream
			const nsIFilePicker = Components.interfaces.nsIFilePicker;
			var fp = Components.classes["@mozilla.org/filepicker;1"]
					.createInstance(nsIFilePicker);
			fp.init(window, "Save Bibliography", nsIFilePicker.modeSave);
			fp.appendFilters(nsIFilePicker.filterHTML);
			var rv = fp.show();
			if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {				
				// open file
				var fStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
				              createInstance(Components.interfaces.nsIFileOutputStream);
				fStream.init(fp.file, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate
				
				var html = "";
				html +='<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">\n';
				html +='<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">\n';
				html +='<head>\n';
				html +='<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\n';
				html +='<title>Bibliography</title>\n';
				html +='</head>\n';
				html +='<body>\n';
				html += bibliography;
				html +='</body>\n';
				html +='</html>\n';
				fStream.write(html, html.length);
				
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
}