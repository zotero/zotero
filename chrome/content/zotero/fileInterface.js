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
 *
 * @return {Promise}
 **/
Zotero_File_Exporter.prototype.save = Zotero.Promise.coroutine(function* () {
	var translation = new Zotero.Translate.Export();
	var translators = yield translation.getTranslators();
	
	// present options dialog
	var io = {translators:translators}
	window.openDialog("chrome://zotero/content/exportOptions.xul",
		"_blank", "chrome,modal,centerscreen,resizable=no", io);
	if(!io.selectedTranslator) {
		return false;
	}
	
	const nsIFilePicker = Components.interfaces.nsIFilePicker;
	var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
	fp.init(window, Zotero.getString("fileInterface.export"), nsIFilePicker.modeSave);
	
	// set file name and extension
	if(io.displayOptions.exportFileData) {
		// if the result will be a folder, don't append any extension or use
		// filters
		fp.defaultString = this.name;
		fp.appendFilters(Components.interfaces.nsIFilePicker.filterAll);
	} else {
		// if the result will be a file, append an extension and use filters
		fp.defaultString = this.name+(io.selectedTranslator.target ? "."+io.selectedTranslator.target : "");
		fp.defaultExtension = io.selectedTranslator.target;
		fp.appendFilter(io.selectedTranslator.label, "*."+(io.selectedTranslator.target ? io.selectedTranslator.target : "*"));
	}
	
	var rv = fp.show();
	if (rv != nsIFilePicker.returnOK && rv != nsIFilePicker.returnReplace) {
		return;
	}
	
	if(this.collection) {
		translation.setCollection(this.collection);
	} else if(this.items) {
		translation.setItems(this.items);
	} else if(this.libraryID === undefined) {
		throw new Error('No export configured');
	} else {
		translation.setLibraryID(this.libraryID);
	}
	
	translation.setLocation(fp.file);
	translation.setTranslator(io.selectedTranslator);
	translation.setDisplayOptions(io.displayOptions);
	translation.setHandler("itemDone", function () {
		Zotero.updateZoteroPaneProgressMeter(translation.getProgress());
	});
	translation.setHandler("done", this._exportDone);
	Zotero_File_Interface.Progress.show(
		Zotero.getString("fileInterface.itemsExported")
	);
	translation.translate()
});
	
/*
 * Closes the items exported indicator
 */
Zotero_File_Exporter.prototype._exportDone = function(obj, worked) {
	Zotero_File_Interface.Progress.close();
	
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
	var _unlock;
	
	this.exportCollection = exportCollection;
	this.exportItemsToClipboard = exportItemsToClipboard;
	this.exportItems = exportItems;
	this.bibliographyFromCollection = bibliographyFromCollection;
	this.bibliographyFromItems = bibliographyFromItems;
	
	/**
	 * Creates Zotero.Translate instance and shows file picker for file export
	 *
	 * @return {Promise}
	 */
	this.exportFile = Zotero.Promise.method(function () {
		var exporter = new Zotero_File_Exporter();
		exporter.libraryID = ZoteroPane_Local.getSelectedLibraryID();
		if (exporter.libraryID === false) {
			throw new Error('No library selected');
		}
		exporter.name = Zotero.Libraries.getName(exporter.libraryID);
		return exporter.save();
	});
	
	/*
	 * exports a collection or saved search
	 */
	function exportCollection() {
		var exporter = new Zotero_File_Exporter();
	
		var collection = ZoteroPane_Local.getSelectedCollection();
		if(collection) {
			exporter.name = collection.getName();
			exporter.collection = collection;
		} else {
			// find sorted items
			exporter.items = ZoteroPane_Local.getSortedItems();
			if(!exporter.items) throw ("No items to save");
			
			// find name
			var search = ZoteroPane_Local.getSelectedSavedSearch();
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
		
		exporter.items = ZoteroPane_Local.getSelectedItems();
		if(!exporter.items || !exporter.items.length) throw("no items currently selected");
		
		exporter.save();
	}
	
	/*
	 * exports items to clipboard
	 */
	function exportItemsToClipboard(items, translatorID) {
		var translation = new Zotero.Translate.Export();
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
                      .copyString(obj.string.replace(/\r\n/g, "\n"));
		}
	}
	
	/**
	 * Creates Zotero.Translate instance and shows file picker for file import
	 */
	this.importFile = Zotero.Promise.coroutine(function* (file, createNewCollection) {
		if(createNewCollection === undefined) {
			createNewCollection = true;
		} else if(!createNewCollection) {
			try {
				if (!ZoteroPane.collectionsView.editable) {
					ZoteroPane.collectionsView.selectLibrary(null);
				}
			} catch(e) {}
		}
		
		var translation = new Zotero.Translate.Import();
		if (!file) {
			let translators = yield translation.getTranslators();
			const nsIFilePicker = Components.interfaces.nsIFilePicker;
			var fp = Components.classes["@mozilla.org/filepicker;1"]
					.createInstance(nsIFilePicker);
			fp.init(window, Zotero.getString("fileInterface.import"), nsIFilePicker.modeOpen);
			
			fp.appendFilters(nsIFilePicker.filterAll);
			
			var collation = Zotero.getLocaleCollation();
			translators.sort((a, b) => collation.compareString(1, a.label, b.label))
			for (let translator of translators) {
				fp.appendFilter(translator.label, "*." + translator.target);
			}
			
			var rv = fp.show();
			if (rv !== nsIFilePicker.returnOK && rv !== nsIFilePicker.returnReplace) {
				return false;
			}
			
			file = fp.file;
		}

		translation.setLocation(file);
		yield _finishImport(translation, createNewCollection);
	});
	
	
	/**
	 * Imports from clipboard
	 */
	this.importFromClipboard = Zotero.Promise.coroutine(function* () {
		var str = Zotero.Utilities.Internal.getClipboard("text/unicode");
		if(!str) {
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			ps.alert(null, "", Zotero.getString('fileInterface.importClipboardNoDataError'));
		}
		
		var translation = new Zotero.Translate.Import();
		translation.setString(str);
	
		try {
			if (!ZoteroPane.collectionsView.editable) {
				yield ZoteroPane.collectionsView.selectLibrary();
			}
		} catch(e) {}
		
		yield _finishImport(translation, false);
		
		// Select imported items
		try {
			if (translation.newItems) {
				ZoteroPane.itemsView.selectItems(translation.newItems.map(item => item.id));
			}
		}
		catch (e) {
			Zotero.logError(e, 2);
		}
	});
	
	
	var _finishImport = Zotero.Promise.coroutine(function* (translation, createNewCollection) {
		let translators = yield translation.getTranslators();

		if(!translators.length) {
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			var buttonFlags = (ps.BUTTON_POS_0) * (ps.BUTTON_TITLE_OK)
								+ (ps.BUTTON_POS_1) * (ps.BUTTON_TITLE_IS_STRING);
			var index = ps.confirmEx(
				null,
				"",
				Zotero.getString("fileInterface.unsupportedFormat"),
				buttonFlags,
				null,
				Zotero.getString("fileInterface.viewSupportedFormats"),
				null, null, {}
			);
			if (index == 1) {
				ZoteroPane_Local.loadURI("http://zotero.org/support/kb/importing");
			}
			return;
		}

		let importCollection = null, libraryID = Zotero.Libraries.userLibraryID;
		try {
			libraryID = ZoteroPane.getSelectedLibraryID();
			importCollection = ZoteroPane.getSelectedCollection();
		} catch(e) {}

		if(createNewCollection) {
			// Create a new collection to take imported items
			let collectionName;
			if(translation.location instanceof Components.interfaces.nsIFile) {
				let leafName = translation.location.leafName;
				collectionName = (translation.location.isDirectory() || leafName.indexOf(".") === -1 ? leafName
					: leafName.substr(0, leafName.lastIndexOf(".")));
				let allCollections = Zotero.Collections.getByLibrary(libraryID);
				for(var i=0; i<allCollections.length; i++) {
					if(allCollections[i].name == collectionName) {
						collectionName += " "+(new Date()).toLocaleString();
						break;
					}
				}
			} else {
				collectionName = Zotero.getString("fileInterface.imported")+" "+(new Date()).toLocaleString();
			}
			importCollection = new Zotero.Collection;
			importCollection.libraryID = libraryID;
			importCollection.name = collectionName;
			yield importCollection.saveTx();
		}
		
		translation.setTranslator(translators[0]);
		
		// Show progress popup
		var progressWin = new Zotero.ProgressWindow({
			closeOnClick: false
		});
		progressWin.changeHeadline(Zotero.getString('fileInterface.importing'));
		var icon = 'chrome://zotero/skin/treesource-unfiled' + (Zotero.hiDPI ? "@2x" : "") + '.png';
		let progress = new progressWin.ItemProgress(icon, OS.Path.basename(translation.path));
		progressWin.show();
		
		translation.setHandler("itemDone",  function () {
			progress.setProgress(translation.getProgress());
		});

		yield Zotero.Promise.delay(0);

		let failed = false;
		try {
			yield translation.translate({
				libraryID,
				collections: importCollection ? [importCollection.id] : null
			});
		} catch(e) {
			Zotero.logError(e);
			window.alert(Zotero.getString("fileInterface.importError"));
			return;
		}
		
		// Show popup on completion
		var numItems = translation.newItems.length;
		progressWin.changeHeadline(Zotero.getString('fileInterface.importComplete'));
		if (numItems == 1) {
			var icon = translation.newItems[0].getImageSrc();
		}
		else {
			var icon = 'chrome://zotero/skin/treesource-unfiled' + (Zotero.hiDPI ? "@2x" : "") + '.png';
		}
		var text = Zotero.getString(`fileInterface.itemsWereImported`, numItems, numItems);
		progress.setIcon(icon);
		progress.setText(text);
		// For synchronous translators, which don't update progress
		progress.setProgress(100);
		progressWin.startCloseTimer(5000);
	});
	
	/*
	 * Creates a bibliography from a collection or saved search
	 */
	function bibliographyFromCollection() {
		// find sorted items
		var items = Zotero.Items.get(ZoteroPane_Local.getSortedItems(true));
		if(!items) return;
		
		// find name
		var name = false;
		
		var collection = ZoteroPane_Local.getSelectedCollection();
		if(collection) {
			name = collection.getName();
		} else {
			var searchRef = ZoteroPane_Local.getSelectedSavedSearch();
			if(searchRef) {
				var search = new Zotero.Search();
				search.id = searchRef.id;
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
		var items = ZoteroPane_Local.getSelectedItems();
		if(!items || !items.length) throw("no items currently selected");
		
		_doBibliographyOptions(Zotero.getString("fileInterface.untitledBibliography"), items);
	}
	
	
	/**
	 * Copies HTML and text citations or bibliography entries for passed items in given style
	 *
	 * Does not check that items are actual references (and not notes or attachments)
	 *
	 * @param {Zotero.Item[]} items
	 * @param {String} style - Style id string (e.g., 'http://www.zotero.org/styles/apa')
	 * @param {String} locale - Locale (e.g., 'en-US')
	 * @param {Boolean} [asHTML=false] - Use HTML source for plain-text data
	 * @param {Boolean} [asCitations=false] - Copy citation cluster instead of bibliography
	 */
	this.copyItemsToClipboard = function (items, style, locale, asHTML, asCitations) {
		// copy to clipboard
		var transferable = Components.classes["@mozilla.org/widget/transferable;1"].
						   createInstance(Components.interfaces.nsITransferable);
		var clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"].
							   getService(Components.interfaces.nsIClipboard);
		style = Zotero.Styles.get(style);
		var cslEngine = style.getCiteProc(locale);
		
		if (asCitations) {
			cslEngine.updateItems(items.map(item => item.id));
			var citation = {
				citationItems: items.map(item => ({ id: item.id })),
				properties: {}
			};
			var output = cslEngine.previewCitationCluster(citation, [], [], "html");
		}
		else {
			var output = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, "html");
		}
		
		// add HTML
		var str = Components.classes["@mozilla.org/supports-string;1"].
				  createInstance(Components.interfaces.nsISupportsString);
		str.data = output;
		transferable.addDataFlavor("text/html");
		transferable.setTransferData("text/html", str, output.length * 2);
		
		// If not "Copy as HTML", add plaintext; otherwise use HTML from above and just mark as text
		if(!asHTML) {
			if (asCitations) {
				output = cslEngine.previewCitationCluster(citation, [], [], "text");
			}
			else {
				// Generate engine again to work around citeproc-js problem:
				// https://github.com/zotero/zotero/commit/4a475ff3
				cslEngine = style.getCiteProc(locale);
				output = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, "text");
			}
		}
		
		var str = Components.classes["@mozilla.org/supports-string;1"].
				  createInstance(Components.interfaces.nsISupportsString);
		str.data = output;
		transferable.addDataFlavor("text/unicode");
		transferable.setTransferData("text/unicode", str, output.length * 2);
		
		clipboardService.setData(transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
	}
	
	
	/*
	 * Shows bibliography options and creates a bibliography
	 */
	function _doBibliographyOptions(name, items) {
		// make sure at least one item is not a standalone note or attachment
		var haveRegularItem = false;
		for (let item of items) {
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
		
		if(!io.method) return;
		
		// determine output format
		var format = "html";
		if(io.method == "save-as-rtf") {
			format = "rtf";
		}
		
		// determine locale preference
		var locale = io.locale;
		
		// generate bibliography
		try {
			if(io.method == 'copy-to-clipboard') {
				Zotero_File_Interface.copyItemsToClipboard(items, io.style, locale, false, io.mode === "citations");
			}
			else {
				var style = Zotero.Styles.get(io.style);
				var cslEngine = style.getCiteProc(locale);
				var bibliography = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine,
					items, format, io.mode === "citations");
			}
		} catch(e) {
			window.alert(Zotero.getString("fileInterface.bibliographyGenerationError"));
			throw(e);
		}
		
		if(io.method == "print") {
			// printable bibliography, using a hidden browser
			var browser = Zotero.Browser.createHiddenBrowser(window);
			
			var listener = function() {
				if(browser.contentDocument.location.href == "about:blank") return;
				browser.removeEventListener("pageshow", listener, false);
				
				// this is kinda nasty, but we have to temporarily modify the user's
				// settings to eliminate the header and footer. the other way to do
				// this would be to attempt to print with an embedded browser, but
				// it's not even clear how to attempt to create one
				var prefService = Components.classes["@mozilla.org/preferences-service;1"].
								  getService(Components.interfaces.nsIPrefBranch);
				var prefsToClear = ["print.print_headerleft", "print.print_headercenter", 
									"print.print_headerright", "print.print_footerleft", 
									"print.print_footercenter", "print.print_footerright"];
				var oldPrefs = [];
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
				
				// TODO can't delete hidden browser object here or else print will fail...
			}
			
			browser.addEventListener("pageshow", listener, false);
			browser.loadURIWithFlags("data:text/html;charset=utf-8,"+encodeURI(bibliography),
				Components.interfaces.nsIWebNavigation.LOAD_FLAGS_BYPASS_HISTORY, null, "utf-8", null);
		} else if(io.method == "save-as-html") {
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
		} else if(io.method == "save-as-rtf") {
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
			fStream.init(fp.file, 0x02 | 0x08 | 0x20, 0o664, 0); // write, create, truncate
			return fStream;
		} else {
			return false;
		}
	}
}

// Handles the display of a progress indicator
Zotero_File_Interface.Progress = new function() {
	this.show = show;
	this.close = close;
	
	function show(headline) {
		Zotero.showZoteroPaneProgressMeter(headline);
	}
	
	function close() {
		Zotero.hideZoteroPaneOverlays();
	}
}
