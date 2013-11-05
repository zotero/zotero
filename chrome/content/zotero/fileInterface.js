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
 **/
Zotero_File_Exporter.prototype.save = function() {
	var translation = new Zotero.Translate.Export();
	var translators = translation.getTranslators();
	
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
	if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
		if(this.collection) {
			translation.setCollection(this.collection);
		} else if(this.items) {
			translation.setItems(this.items);
		}
		
		translation.setLocation(fp.file);
		translation.setTranslator(io.selectedTranslator);
		translation.setDisplayOptions(io.displayOptions);
		translation.setHandler("itemDone", function () {
			Zotero_File_Interface.updateProgress(translation, false);
		});
		translation.setHandler("done", this._exportDone);
		Zotero.UnresponsiveScriptIndicator.disable();
		Zotero_File_Interface.Progress.show(
			Zotero.getString("fileInterface.itemsExported")
		);
		translation.translate()
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
	var _unlock;
	
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
	function importFile(file, createNewCollection) {
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
		if(!file) {
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
			if (rv !== nsIFilePicker.returnOK && rv !== nsIFilePicker.returnReplace) {
				return false;
			}
			
			file = fp.file;
		}
		
		translation.setLocation(file);
		// get translators again, bc now we can check against the file
		translation.setHandler("translators", function(obj, item) {
			_importTranslatorsAvailable(obj, item, createNewCollection);
		});
		translators = translation.getTranslators();
	}
	
	
	/**
	 * Imports from clipboard
	 */
	this.importFromClipboard = function () {
		var str = Zotero.Utilities.Internal.getClipboard("text/unicode");
		if(!str) {
			var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
									.getService(Components.interfaces.nsIPromptService);
			ps.alert(null, "", Zotero.getString('fileInterface.importClipboardNoDataError'));
		}
		
		var translate = new Zotero.Translate.Import();
		translate.setString(str);
	
		try {
			if (!ZoteroPane.collectionsView.editable) {
				ZoteroPane.collectionsView.selectLibrary(null);
			}
		} catch(e) {}
		translate.setHandler("translators", function(obj, item) {
			_importTranslatorsAvailable(obj, item, false); 
		});
		translators = translate.getTranslators();
	}
	
	
	function _importTranslatorsAvailable(translation, translators, createNewCollection) {
		if(translators.length) {
			var importCollection = null, libraryID = null;
			
			if(translation.location instanceof Components.interfaces.nsIFile) {
				var leafName = translation.location.leafName;
				var collectionName = (translation.location.isDirectory() || leafName.indexOf(".") === -1 ? leafName
					: leafName.substr(0, leafName.lastIndexOf(".")));
				var allCollections = Zotero.getCollections();
				for(var i=0; i<allCollections.length; i++) {
					if(allCollections[i].name == collectionName) {
						collectionName += " "+(new Date()).toLocaleString();
						break;
					}
				}
			} else {
				var collectionName = Zotero.getString("fileInterface.imported")+" "+(new Date()).toLocaleString();
			}
			
			if(createNewCollection) {
				// Create a new collection to take imported items
				importCollection = Zotero.Collections.add(collectionName);
			} else {
				// Import into currently selected collection
				try {
					libraryID = ZoteroPane.getSelectedLibraryID();
					importCollection = ZoteroPane.getSelectedCollection();
				} catch(e) {}
			}
			
			// import items
			translation.setTranslator(translators[0]);
			
			if(importCollection) {
				/*
				 * Saves collections after they've been imported. Input item is of the 
				 * type outputted by Zotero.Collection.toArray(); only receives top-level
				 * collections
				 */
				translation.setHandler("collectionDone", function(obj, collection) {
					collection.parent = importCollection.id;
					collection.save();
				});
			}
			
			translation.setHandler("itemDone",  function () {
				Zotero_File_Interface.updateProgress(translation, true);
			});
			
			/*
			 * closes items imported indicator
			 */
			translation.setHandler("done", function(obj, worked) {
				// add items to import collection
				if(importCollection) {
					importCollection.addItems([item.id for each(item in obj.newItems)]);
				}
				
				Zotero.DB.commitTransaction();
				
				Zotero_File_Interface.Progress.close();
				Zotero.UnresponsiveScriptIndicator.enable();
				
				if(importCollection) {
					Zotero.Notifier.trigger('refresh', 'collection', importCollection.id);
				}
				if (!worked) {
					window.alert(Zotero.getString("fileInterface.importError"));
				}
			});
			Zotero.UnresponsiveScriptIndicator.disable();
			
			// show progress indicator
			Zotero_File_Interface.Progress.show(
				Zotero.getString("fileInterface.itemsImported")
			);
			
			window.setTimeout(function() {
				Zotero.DB.beginTransaction();
				translation.translate(libraryID);
			}, 0);
		} else {
			
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
		}
	}
	
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
	
	
	/*
	 * Copies HTML and text bibliography entries for passed items in given style
	 *
	 * Does not check that items are actual references (and not notes or attachments)
	 */
	function copyItemsToClipboard(items, style, asHTML, asCitations) {
		// copy to clipboard
		var transferable = Components.classes["@mozilla.org/widget/transferable;1"].
						   createInstance(Components.interfaces.nsITransferable);
		var clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"].
							   getService(Components.interfaces.nsIClipboard);
		var style = Zotero.Styles.get(style);
		
		// add HTML
		var bibliography = Zotero.Cite.makeFormattedBibliographyOrCitationList(style, items, "html", asCitations);
		var str = Components.classes["@mozilla.org/supports-string;1"].
				  createInstance(Components.interfaces.nsISupportsString);
		str.data = bibliography;
		transferable.addDataFlavor("text/html");
		transferable.setTransferData("text/html", str, bibliography.length*2);
		
		// add text (or HTML source)
		if(!asHTML) {
			var bibliography = Zotero.Cite.makeFormattedBibliographyOrCitationList(style, items, "text", asCitations);
		}
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
		
		var style = Zotero.Styles.get(style).getCiteProc();
		var citation = {"citationItems":[{id:item.id} for each(item in items)], properties:{}};
		
		// add HTML
		var bibliography = style.previewCitationCluster(citation, [], [], "html");
		var str = Components.classes["@mozilla.org/supports-string;1"].
				  createInstance(Components.interfaces.nsISupportsString);
		str.data = bibliography;
		transferable.addDataFlavor("text/html");
		transferable.setTransferData("text/html", str, bibliography.length*2);
		
		// add text (or HTML source)
		if(!asHTML) {
			var bibliography = style.previewCitationCluster(citation, [], [], "text");
		}
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
		
		if(!io.method) return;
		
		// determine output format
		var format = "html";
		if(io.method == "save-as-rtf") {
			format = "rtf";
		}
		
		// generate bibliography
		try {
			if(io.method == 'copy-to-clipboard') {
				copyItemsToClipboard(items, io.style, false, io.mode === "citations");
			}
			else {
				var style = Zotero.Styles.get(io.style);
				var bibliography = Zotero.Cite.makeFormattedBibliographyOrCitationList(style,
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
			fStream.init(fp.file, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate
			return fStream;
		} else {
			return false;
		}
	}
	
	/**
	 * Updates progress indicators based on current progress of translation
	 */
	this.updateProgress = function(translate, closeTransaction) {
		Zotero.updateZoteroPaneProgressMeter(translate.getProgress());
		
		var now = Date.now();
		
		// Don't repaint more than once per second unless forced.
		if(window.zoteroLastRepaint && (now - window.zoteroLastRepaint) < 1000) return
		
		// Add the redraw event onto event queue
		window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIDOMWindowUtils)
			.redraw();
		
		// Process redraw event
		if(closeTransaction) Zotero.DB.commitTransaction();
		Zotero.wait();
		if(closeTransaction) Zotero.DB.beginTransaction();
		
		window.zoteroLastRepaint = now;
	}
}

// Handles the display of a progress indicator
Zotero_File_Interface.Progress = new function() {
	this.show = show;
	this.close = close;
	
	function show(headline) {
		Zotero.showZoteroPaneProgressMeter(headline)
	}
	
	function close() {
		Zotero.hideZoteroPaneOverlay();
	}
}
