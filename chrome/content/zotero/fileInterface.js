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

Components.utils.import("resource://gre/modules/Services.jsm");
var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');
import { ImportCitaviAnnotatons } from 'zotero/import/citavi';

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
Zotero_File_Exporter.prototype.save = async function () {
	var translation = new Zotero.Translate.Export();
	var translators = await translation.getTranslators();
	translators.sort((a, b) => a.label.localeCompare(b.label));
	
	// If exporting items, check whether they're only notes to determine which translators to show
	let exportingNotes = false;
	if (this.items) {
		exportingNotes = this.items.every(item => item.isNote() || item.isAttachment());
		// Keep only note export and Zotero RDF translators, if all items are notes or attachments
		if (exportingNotes) {
			translators = translators.filter((translator) => {
				return (
					translator.translatorID === '14763d24-8ba0-45df-8f52-b8d1108e7ac9'
					|| translator.configOptions && translator.configOptions.noteTranslator
				);
			});
			
			// Remove "Note" prefix from Note Markdown and Note HTML translators
			let markdownTranslator = translators.find(
				t => t.translatorID == Zotero.Translators.TRANSLATOR_ID_NOTE_MARKDOWN
			);
			if (markdownTranslator) {
				markdownTranslator.label = 'Markdown';
				// Move Note Markdown translator to the top
				translators.unshift(...translators.splice(translators.indexOf(markdownTranslator), 1));
			}
			let htmlTranslator = translators.find(
				t => t.translatorID == Zotero.Translators.TRANSLATOR_ID_NOTE_HTML
			);
			if (htmlTranslator) {
				htmlTranslator.label = 'HTML';
			}

			if (this.items.length == 1) {
				let noteTitle = Zotero.Utilities.Item.noteToTitle(
					this.items[0].getNote(),
					// Stop at <br/> to exclude date from annotation notes, which won't be a valid
					// filename in many locales
					{ stopAtLineBreak: true }
				);
				if (noteTitle) {
					this.name = Zotero.File.getValidFileName(noteTitle);
				}
			}
		}
	}

	// Exclude note translators if not exporting notes
	if (!exportingNotes) {
		translators = translators.filter(t => !t.configOptions || !t.configOptions.noteTranslator);
	}
	
	// present options dialog
	var io = { translators, exportingNotes };
	window.openDialog("chrome://zotero/content/exportOptions.xhtml",
		"_blank", "chrome,modal,centerscreen,resizable=no", io);
	if(!io.selectedTranslator) {
		return false;
	}
	
	var fp = new FilePicker();
	fp.init(window, Zotero.getString("fileInterface.export"), fp.modeSave);
	
	// set file name and extension
	if(io.displayOptions.exportFileData) {
		// if the result will be a folder, don't append any extension or use
		// filters
		fp.defaultString = this.name;
		fp.appendFilters(fp.filterAll);
	} else {
		// if the result will be a file, append an extension and use filters
		fp.defaultString = this.name+(io.selectedTranslator.target ? "."+io.selectedTranslator.target : "");
		fp.defaultExtension = io.selectedTranslator.target;
		fp.appendFilter(io.selectedTranslator.label, "*."+(io.selectedTranslator.target ? io.selectedTranslator.target : "*"));
	}
	
	var rv = await fp.show();
	if (rv != fp.returnOK && rv != fp.returnReplace) {
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
	
	async function _exportDone(obj, worked) {
		// Close the items exported indicator
		Zotero_File_Interface.Progress.close();
		
		if (!worked) {
			Zotero.alert(
				null,
				Zotero.getString('general.error'),
				Zotero.getString('fileInterface.exportError')
			);
			Zotero_File_Interface.Progress.close();
			return;
		}
	}

	translation.setLocation(Zotero.File.pathToFile(fp.file));
	translation.setTranslator(io.selectedTranslator);
	translation.setDisplayOptions(io.displayOptions);
	translation.setHandler("itemDone", function () {
		Zotero.updateZoteroPaneProgressMeter(translation.getProgress());
	});
	translation.setHandler("done", _exportDone);
	Zotero_File_Interface.Progress.show(
		Zotero.getString("fileInterface.itemsExported")
	);
	translation.translate()
};


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
	this.bibliographyFromItems = bibliographyFromItems;
	
	/**
	 * Creates Zotero.Translate instance and shows file picker for file export
	 *
	 * @return {Promise}
	 */
	this.exportFile = async function () {
		var exporter = new Zotero_File_Exporter();
		exporter.libraryID = ZoteroPane_Local.getSelectedLibraryID();
		if (exporter.libraryID === false) {
			throw new Error('No library selected');
		}
		exporter.name = Zotero.Libraries.getName(exporter.libraryID);
		return exporter.save();
	};
	
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
		let itemIDs = ZoteroPane_Local.getSelectedItems(true);
		// Get selected item IDs in the item tree order
		itemIDs = ZoteroPane_Local.getSortedItems(true).filter(id => itemIDs.includes(id));
		exporter.items = Zotero.Items.get(itemIDs);
		if(!exporter.items || !exporter.items.length) throw("no items currently selected");
		
		exporter.save();
	}
	
	
	/*
	 * exports items to clipboard
	 */
	function exportItemsToClipboard(items, format) {
		function _translate(items, format, callback) {
			let translation = new Zotero.Translate.Export();
			translation.setItems(items.slice());
			translation.setTranslator(format.id);
			if (format.options) {
				translation.setDisplayOptions(format.options);
			}
			translation.setHandler("done", callback);
			translation.translate();
		}
		
		// If translating with virtual "Markdown + Rich Text" translator, use Note Markdown and
		// Note HTML instead
		if (format.id == Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT) {
			let markdownFormat = { mode: 'export', id: Zotero.Translators.TRANSLATOR_ID_NOTE_MARKDOWN, options: format.markdownOptions };
			let htmlFormat = { mode: 'export', id: Zotero.Translators.TRANSLATOR_ID_NOTE_HTML, options: format.htmlOptions };
			_translate(items, markdownFormat, (obj, worked) => {
				if (!worked) {
					Zotero.log(Zotero.getString('fileInterface.exportError'), 'warning');
					return;
				}
				_translate(items, htmlFormat, (obj2, worked) => {
					if (!worked) {
						Zotero.log(Zotero.getString('fileInterface.exportError'), 'warning');
						return;
					}
					
					let text = obj.string.replace(/\r\n/g, '\n');
					let html = obj2.string.replace(/\r\n/g, '\n');

					// copy to clipboard
					let transferable = Components.classes['@mozilla.org/widget/transferable;1']
						.createInstance(Components.interfaces.nsITransferable);
					let clipboardService = Components.classes['@mozilla.org/widget/clipboard;1']
						.getService(Components.interfaces.nsIClipboard);

					// Add Text
					let str = Components.classes['@mozilla.org/supports-string;1']
						.createInstance(Components.interfaces.nsISupportsString);
					str.data = text;
					transferable.addDataFlavor('text/plain');
					transferable.setTransferData('text/plain', str, text.length * 2);

					// Add HTML
					str = Components.classes['@mozilla.org/supports-string;1']
						.createInstance(Components.interfaces.nsISupportsString);
					str.data = html;
					transferable.addDataFlavor('text/html');
					transferable.setTransferData('text/html', str, html.length * 2);

					clipboardService.setData(
						transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard
					);
				});
			});
		}
		else {
			_translate(items, format, (obj, worked) => {
				if (!worked) {
					Zotero.log(Zotero.getString('fileInterface.exportError'), 'warning');
					return;
				}
				let text = obj.string;
				// For Note HTML translator use body content only
				if (format.id == Zotero.Translators.TRANSLATOR_ID_NOTE_HTML) {
					let parser = new DOMParser();
					let doc = parser.parseFromString(text, 'text/html');
					text = doc.body.innerHTML;
				}
				Components.classes['@mozilla.org/widget/clipboardhelper;1']
					.getService(Components.interfaces.nsIClipboardHelper)
					.copyString(text.replace(/\r\n/g, '\n'));
			});
		}
	}
	
	
	this.getMendeleyDirectory = function () {
		Components.classes["@mozilla.org/net/osfileconstantsservice;1"]
			.getService(Components.interfaces.nsIOSFileConstantsService)
			.init();
		var path = FileUtils.getDir('Home', []).path;
		if (Zotero.isMac) {
			path = PathUtils.join(path, ['Library', 'Application Support', 'Mendeley Desktop']);
		}
		else if (Zotero.isWin) {
			path = PathUtils.join(path, ['AppData', 'Local', 'Mendeley Ltd', 'Mendeley Desktop']);
		}
		else if (Zotero.isLinux) {
			path = PathUtils.join(path, ['.local', 'share', 'data', 'Mendeley Ltd.', 'Mendeley Desktop']);
		}
		else {
			throw new Error("Invalid platform");
		}
		return path;
	};
	
	
	this.findMendeleyDatabases = async function () {
		var dbs = [];
		try {
			var dir = this.getMendeleyDirectory();
			if (!await OS.File.exists(dir)) {
				Zotero.debug(`${dir} does not exist`);
				return dbs;
			}
			await Zotero.File.iterateDirectory(dir, function (entry) {
				if (entry.isDir) return;
				// online.sqlite, counterintuitively, is the default database before you sign in
				if (entry.name == 'online.sqlite' || entry.name.endsWith('@www.mendeley.com.sqlite')) {
					dbs.push({
						name: entry.name,
						path: entry.path,
						lastModified: null,
						size: null
					});
				}
			});
			for (let i = 0; i < dbs.length; i++) {
				let dbPath = OS.Path.join(dir, dbs[i].name);
				let info = await OS.File.stat(dbPath);
				dbs[i].size = info.size;
				dbs[i].lastModified = info.lastModificationDate;
			}
			dbs.sort((a, b) => {
				return b.lastModified - a.lastModified;
			});
		}
		catch (e) {
			Zotero.logError(e);
		}
		return dbs;
	};
	
	
	this.showImportWizard = function (extraArgs = {}) {
		var libraryID = Zotero.Libraries.userLibraryID;
		try {
			let zp = Zotero.getActiveZoteroPane();
			libraryID = zp.getSelectedLibraryID();
		}
		catch (e) {
			Zotero.logError(e);
		}
		var args = {
			libraryID,
			...extraArgs
		};
		args.wrappedJSObject = args;
		
		Services.ww.openWindow(null, "chrome://zotero/content/import/importWizard.xhtml",
			"importFile", "chrome,dialog=yes,centerscreen,modal", args);
	};
	
	
	/**
	 * Creates Zotero.Translate instance and shows file picker for file import
	 *
	 * @param {Object} options
	 * @param {nsIFile|string|null} [options.file=null] - File to import, or none to show a filepicker
	 * @param {Boolean} [options.addToLibraryRoot=false] - Use root library instead of a selected collection
	 * @param {Boolean} [options.createNewCollection=true] - Put items in a new collection
	 * @param {Boolean} [options.linkFiles=false] - Link to files instead of storing them
	 * @param {Function} [options.onBeforeImport] - Callback to receive translation object, useful
	 *     for displaying progress in a different way. This also causes an error to be throw
	 *     instead of shown in the main window.
	 */
	this.importFile = Zotero.Promise.coroutine(function* (options = {}) {
		if (!options) {
			options = {};
		}
		if (typeof options == 'string' || options instanceof Components.interfaces.nsIFile) {
			Zotero.debug("WARNING: importFile() now takes a single options object -- update your code");
			options = {
				file: options,
				createNewCollection: arguments[1]
			};
		}
		
		var file = options.file ? Zotero.File.pathToFile(options.file) : null;
		var createNewCollection = options.createNewCollection;
		var addToLibraryRoot = options.addToLibraryRoot;
		var linkFiles = options.linkFiles;
		var onBeforeImport = options.onBeforeImport;
		
		if (createNewCollection === undefined && !addToLibraryRoot) {
			createNewCollection = true;
		}
		else if (!createNewCollection) {
			try {
				let zp = Zotero.getActiveZoteroPane();
				if (!zp.canEdit()) {
					yield zp.collectionsView.selectLibrary(Zotero.Libraries.userLibraryID);
				}
			}
			catch (e) {
				Zotero.logError(e);
			}
		}
		
		var defaultNewCollectionPrefix = Zotero.getString("fileInterface.imported");
		
		var translation;
		
		if (options.mendeleyAuth || options.mendeleyCode) {
			translation = yield _getMendeleyTranslation();
			translation.createNewCollection = createNewCollection;
			translation.mendeleyAuth = options.mendeleyAuth;
			translation.mendeleyCode = options.mendeleyCode;
			translation.newItemsOnly = options.newItemsOnly;
			translation.relinkOnly = options.relinkOnly;
		}
		else if (options.folder) {
			Components.utils.import("chrome://zotero/content/import/folderImport.js");
			translation = new Zotero_Import_Folder({
				folder: options.folder,
				recreateStructure: options.recreateStructure,
				fileTypes: options.fileTypes,
				mimeTypes: options.mimeTypes,
			});
		}
		else {
			// Check if the file is an SQLite database
			var sample = yield Zotero.File.getSample(file.path);
			if (file.path == Zotero.DataDirectory.getDatabase()) {
				// Blacklist the current Zotero database, which would cause a hang
			}
			else if (Zotero.MIME.sniffForMIMEType(sample) == 'application/x-sqlite3') {
				// Mendeley import doesn't use the real translation architecture, but we create a
				// translation object with the same interface
				translation = yield _getMendeleyTranslation();
				translation.createNewCollection = createNewCollection;
				defaultNewCollectionPrefix = Zotero.getString(
					'fileInterface.appImportCollection', 'Mendeley'
				);
			}
			else if (file.path.endsWith('@www.mendeley.com.sqlite')
					|| file.path.endsWith('online.sqlite')) {
				// Keep in sync with importWizard.js
				throw new Error('Encrypted Mendeley database');
			}
			
			if (!translation) {
				translation = new Zotero.Translate.Import();
			}
			translation.setLocation(file);
		}

		return _finishImport({
			translation,
			createNewCollection,
			addToLibraryRoot,
			linkFiles,
			defaultNewCollectionPrefix,
			onBeforeImport
		});
	});
	
	
	/**
	 * Imports from clipboard
	 */
	this.importFromClipboard = Zotero.Promise.coroutine(function* () {
		var str = Zotero.Utilities.Internal.getClipboard("text/plain");
		if(!str) {
			var ps = Services.prompt;
			ps.alert(
				null,
				Zotero.getString('general.error'),
				Zotero.getString('fileInterface.importClipboardNoDataError')
			);
		}
		
		var translation = new Zotero.Translate.Import();
		translation.setString(str);
	
		try {
			if (!ZoteroPane.collectionsView.editable) {
				yield ZoteroPane.collectionsView.selectLibrary();
			}
		} catch(e) {}
		
		yield _finishImport({
			translation,
			createNewCollection: false
		});
		
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
	
	
	var _finishImport = Zotero.Promise.coroutine(function* (options) {
		var t = performance.now();
		
		var translation = options.translation;
		var addToLibraryRoot = options.addToLibraryRoot;
		var createNewCollection = options.createNewCollection;
		var linkFiles = options.linkFiles;
		var defaultNewCollectionPrefix = options.defaultNewCollectionPrefix;
		var onBeforeImport = options.onBeforeImport;
		
		if (addToLibraryRoot && createNewCollection) {
			throw new Error("Can't add to library root and create new collection");
		}
		
		var showProgressWindow = !onBeforeImport;
		
		let translators = yield translation.getTranslators();
		
		// Unrecognized file
		if (!translators.length) {
			if (onBeforeImport) {
				yield onBeforeImport(false);
			}
			
			let ps = Services.prompt;
			let buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_OK
				+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_IS_STRING;
			let index = ps.confirmEx(
				null,
				Zotero.getString('general.error'),
				Zotero.getString("fileInterface.unsupportedFormat"),
				buttonFlags,
				null,
				Zotero.getString("fileInterface.viewSupportedFormats"),
				null, null, {}
			);
			if (index == 1) {
				Zotero.launchURL("https://www.zotero.org/support/kb/importing_standardized_formats");
			}
			return false;
		}
		
		var libraryID = Zotero.Libraries.userLibraryID;
		var importCollection = null;
		try {
			let zp = Zotero.getActiveZoteroPane();
			libraryID = zp.getSelectedLibraryID();
			if (addToLibraryRoot) {
				yield zp.collectionsView.selectLibrary(libraryID);
			}
			else if (!createNewCollection) {
				importCollection = zp.getSelectedCollection();
			}
		}
		catch (e) {
			Zotero.logError(e);
		}
		
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
			}
			else {
				collectionName = defaultNewCollectionPrefix + " " + (new Date()).toLocaleString();
			}
			importCollection = new Zotero.Collection;
			importCollection.libraryID = libraryID;
			importCollection.name = collectionName;
			yield importCollection.saveTx();
		}

		translation.setTranslator(translators[0]);
		
		// Show progress popup
		var progressWin;
		var progress;
		if (showProgressWindow) {
			progressWin = new Zotero.ProgressWindow({
				closeOnClick: false
			});
			progressWin.changeHeadline(Zotero.getString('fileInterface.importing'));
			let icon = 'chrome://zotero/skin/treesource-unfiled' + (Zotero.hiDPI ? "@2x" : "") + '.png';
			progress = new progressWin.ItemProgress(
				icon, translation.path ? PathUtils.filename(translation.path) : translators[0].label
			);
			progressWin.show();
			
			translation.setHandler("itemDone",  function () {
				progress.setProgress(translation.getProgress());
			});
			
			yield Zotero.Promise.delay(0);
		}
		else {
			yield onBeforeImport(translation);
		}
		
		var notifierQueue = new Zotero.Notifier.Queue;
		try {
			yield translation.translate({
				libraryID,
				collections: importCollection ? [importCollection.id] : null,
				linkFiles,
				saveOptions: {
					notifierQueue
				}
			});
		} catch(e) {
			if (!showProgressWindow) {
				throw e;
			}
			
			progressWin.close();
			Zotero.logError(e);
			Zotero.alert(
				null,
				Zotero.getString('general.error'),
				Zotero_File_Interface.makeImportErrorString(translation)
			);
			return false;
		}
		finally {
			yield Zotero.Notifier.commit(notifierQueue);
		}

		if (translators[0].label.match(/^Citavi (?:[56]) XML/i)) {
			yield ImportCitaviAnnotatons(translation);
		}
		
		var numItems = translation.newItems.length;
		
		// Show popup on completion
		if (showProgressWindow) {
			progressWin.changeHeadline(Zotero.getString('fileInterface.importComplete'));
			let icon;
			if (numItems == 1) {
				icon = translation.newItems[0].getImageSrc();
			}
			else {
				icon = 'chrome://zotero/skin/treesource-unfiled' + (Zotero.hiDPI ? "@2x" : "") + '.png';
			}
			let text = Zotero.getString(`fileInterface.itemsWereImported`, numItems, numItems);
			progress.setIcon(icon);
			progress.setText(text);
			// For synchronous translators, which don't update progress
			progress.setProgress(100);
			progressWin.startCloseTimer(5000);
		}
		
		Zotero.debug(`Imported ${numItems} item(s) in ${performance.now() - t} ms`);
		
		return true;
	});
	
	
	var _getMendeleyTranslation = async function () {
		if (true) {
			Components.utils.import("chrome://zotero/content/import/mendeley/mendeleyImport.js");
		}
		// TEMP: Load uncached from ~/zotero-client for development
		else {
			Components.utils.import("resource://gre/modules/FileUtils.jsm");
			let file = FileUtils.getDir("Home", []);
			file = OS.Path.join(
				file.path,
				'zotero-client', 'chrome', 'content', 'zotero', 'import', 'mendeley', 'mendeleyImport.js'
			);
			let fileURI = OS.Path.toFileURI(file);
			let xmlhttp = await Zotero.HTTP.request(
				'GET',
				fileURI,
				{
					noCache: true,
					responseType: 'text'
				}
			);
			eval(xmlhttp.response);
		}
		return new Zotero_Import_Mendeley();
	};
	
	
	/**
	 * Creates a bibliography from a collection or saved search
	 */
	this.bibliographyFromCollection = async function () {
		var items = ZoteroPane.getSortedItems();
		
		// Find collection name
		var name = false;
		var collection = ZoteroPane.getSelectedCollection();
		if (collection) {
			name = collection.name;
		}
		else {
			let search = ZoteroPane.getSelectedSavedSearch();
			if (search) {
				name = search.name;
			}
		}
		
		await _doBibliographyOptions(name, items);
	}
	
	/*
	 * Creates a bibliography from a items
	 */
	async function bibliographyFromItems() {
		var items = ZoteroPane_Local.getSelectedItems();
		if(!items || !items.length) throw("no items currently selected");
		
		await _doBibliographyOptions(Zotero.getString("fileInterface.untitledBibliography"), items);
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
		var d = new Date();
		
		// copy to clipboard
		var transferable = Components.classes["@mozilla.org/widget/transferable;1"].
						   createInstance(Components.interfaces.nsITransferable);
		var clipboardService = Components.classes["@mozilla.org/widget/clipboard;1"].
							   getService(Components.interfaces.nsIClipboard);
		style = Zotero.Styles.get(style);
		var cslEngine = style.getCiteProc(locale, 'html');
		
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
				cslEngine.free();
				cslEngine = style.getCiteProc(locale, 'text');
				output = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine, items, 'text');
			}
		}
		cslEngine.free();

		var str = Components.classes["@mozilla.org/supports-string;1"].
				  createInstance(Components.interfaces.nsISupportsString);
		str.data = output;
		transferable.addDataFlavor("text/plain");
		transferable.setTransferData("text/plain", str, output.length * 2);
		
		clipboardService.setData(transferable, null, Components.interfaces.nsIClipboard.kGlobalClipboard);
		
		Zotero.debug(`Copied bibliography to clipboard in ${new Date() - d} ms}`);
	}
	
	
	/*
	 * Shows bibliography options and creates a bibliography
	 */
	async function _doBibliographyOptions(name, items) {
		// Limit to regular items
		items = items.filter(item => item.isRegularItem());
		if (!items.length) {
			Zotero.alert(
				null,
				Zotero.getString('general.error'),
				Zotero.getString("fileInterface.noReferencesError")
			);
			return;
		}
		
		var io = new Object();
		var newDialog = window.openDialog("chrome://zotero/content/bibliography.xhtml",
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
				var cslEngine = style.getCiteProc(locale, format);
				var bibliography = Zotero.Cite.makeFormattedBibliographyOrCitationList(cslEngine,
					items, format, io.mode === "citations");
			}
		} catch(e) {
			Zotero.alert(
				null,
				Zotero.getString('general.error'),
				Zotero.getString("fileInterface.bibliographyGenerationError")
			);
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
			browser.loadURI(
				Services.io.newURI("data:text/html;charset=utf-8," + encodeURI(bibliography)),
				{
					flags: Components.interfaces.nsIWebNavigation.LOAD_FLAGS_BYPASS_HISTORY
				}
			);
		} else if(io.method == "save-as-html") {
			let fStream = await _saveBibliography(name, "HTML");
			
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
			let fStream = await _saveBibliography(name, "RTF");
			if(fStream !== false) {
				fStream.write(bibliography, bibliography.length);
				fStream.close();
			}
		}
	}
	
	
	async function _saveBibliography(name, format) {
		// saveable bibliography, using a file stream
		var fp = new FilePicker();
		fp.init(window, "Save Bibliography", fp.modeSave);
		
		if(format == "RTF") {
			var extension = "rtf";
			fp.appendFilter("RTF", "*.rtf");
		} else {
			var extension = "html";
			fp.appendFilters(fp.filterHTML);
		}
		
		fp.defaultString = name+"."+extension;
		
		var rv = await fp.show();
		if (rv == fp.returnOK || rv == fp.returnReplace) {
			// open file
			var fStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
						  createInstance(Components.interfaces.nsIFileOutputStream);
			fStream.init(
				Zotero.File.pathToFile(fp.file),
				0x02 | 0x08 | 0x20, 0o664, // write, create, truncate
				0
			);
			return fStream;
		} else {
			return false;
		}
	}

	/**
	 * Generate an error string reporting a translation failure. Includes the
	 * label of the running translator if available.
	 *
	 * @param {Zotero.Translate} [translate]
	 * @return {String}
	 */
	this.makeImportErrorString = function (translate) {
		let translatorLabel = translate?.translator
			&& translate.translator[0]
			&& translate.translator[0].label;
		return translatorLabel
			? Zotero.getString('fileInterface.importError.translator', translatorLabel)
			: Zotero.getString('fileInterface.importError');
	};
};

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
