import FilePicker from 'zotero/filePicker';

var Zotero_Import_Wizard = {
	_wizard: null,
	_dbs: null,
	_file: null,
	_translation: null,
	
	
	init: async function () {
		this._wizard = document.getElementById('import-wizard');
		
		var dbs = await Zotero_File_Interface.findMendeleyDatabases();
		if (dbs.length) {
			document.getElementById('radio-import-source-mendeley').hidden = false;
		}
		
		// If no existing collections or non-trash items in the library, don't create a new
		// collection by default
		var args = window.arguments[0].wrappedJSObject;
		if (args && args.libraryID) {
			let sql = "SELECT ROWID FROM collections WHERE libraryID=?1 "
				+ "UNION "
				+ "SELECT ROWID FROM items WHERE libraryID=?1 "
				// Not in trash
				+ "AND itemID NOT IN (SELECT itemID FROM deletedItems) "
				// And not a child item (which doesn't necessarily show up in the trash)
				+ "AND itemID NOT IN (SELECT itemID FROM itemNotes WHERE parentItemID IS NOT NULL) "
				+ "AND itemID NOT IN (SELECT itemID FROM itemAttachments WHERE parentItemID IS NOT NULL) "
				+ "LIMIT 1";
			if (!await Zotero.DB.valueQueryAsync(sql, args.libraryID)) {
				document.getElementById('create-collection-checkbox').removeAttribute('checked');
			}
		}
		
		// Update labels
		document.getElementById('file-handling-store').label = Zotero.getString(
			'import.fileHandling.store',
			Zotero.appName
		);
		document.getElementById('file-handling-link').label = Zotero.getString('import.fileHandling.link');
		document.getElementById('file-handling-description').textContent = Zotero.getString(
			'import.fileHandling.description',
			Zotero.appName
		);
		
		Zotero.Translators.init(); // async
	},
	
	
	onModeChosen: async function () {
		var wizard = this._wizard;
		
		var mode = document.getElementById('import-source').selectedItem.id;
		try {
			switch (mode) {
			case 'radio-import-source-file':
				await this.chooseFile();
				break;
				
			case 'radio-import-source-mendeley':
				this._dbs = await Zotero_File_Interface.findMendeleyDatabases();
				// This shouldn't happen, because we only show the wizard if there are databases
				if (!this._dbs.length) {
					throw new Error("No databases found");
				}
				this._populateFileList(this._dbs);
				document.getElementById('file-options-header').textContent
					= Zotero.getString('fileInterface.chooseAppDatabaseToImport', 'Mendeley')
				wizard.goTo('page-file-list');
				wizard.canRewind = true;
				this._enableCancel();
				break;
			
			default:
				throw new Error(`Unknown mode ${mode}`);
			}
		}
		catch (e) {
			this._onDone(
				Zotero.getString('general.error'),
				Zotero.getString('fileInterface.importError'),
				true
			);
			throw e;
		}
	},
	
	
	goToStart: function () {
		this._wizard.goTo('page-start');
		this._wizard.canAdvance = true;
		return false;
	},
	
	
	chooseFile: async function (translation) {
		var translation = new Zotero.Translate.Import();
		var translators = await translation.getTranslators();
		var fp = new FilePicker();
		fp.init(window, Zotero.getString("fileInterface.import"), fp.modeOpen);
		
		fp.appendFilters(fp.filterAll);
		
		var collation = Zotero.getLocaleCollation();
		
		// Add Mendeley DB, which isn't a translator
		var mendeleyFilter = {
			label: "Mendeley Database", // TODO: Localize
			target: "*.sqlite"
		};
		var filters = [...translators];
		filters.push(mendeleyFilter);
		
		filters.sort((a, b) => collation.compareString(1, a.label, b.label));
		for (let filter of filters) {
			fp.appendFilter(filter.label, "*." + filter.target);
		}
		
		var rv = await fp.show();
		if (rv !== fp.returnOK && rv !== fp.returnReplace) {
			return false;
		}
		
		Zotero.debug(`File is ${fp.file}`);
		
		this._file = fp.file;
		this._wizard.canAdvance = true;
		this._wizard.goTo('page-options');
	},
	
	
	/**
	 * When a file is clicked on in the file list
	 */
	onFileSelected: async function () {
		var index = document.getElementById('file-list').selectedIndex;
		if (index != -1) {
			this._file = this._dbs[index].path;
			this._wizard.canAdvance = true;
		}
		else {
			this._file = null;
			this._wizard.canAdvance = false;
		}
	},
	
	
	/**
	 * When the user clicks "Other…" to choose a file not in the list
	 */
	chooseMendeleyDB: async function () {
		document.getElementById('file-list').selectedIndex = -1;
		var fp = new FilePicker();
		fp.init(window, Zotero.getString('fileInterface.import'), fp.modeOpen);
		fp.appendFilter("Mendeley Database", "*.sqlite"); // TODO: Localize
		var rv = await fp.show();
		if (rv != fp.returnOK) {
			return false;
		}
		this._file = fp.file;
		this._wizard.canAdvance = true;
		this._wizard.advance();
	},
	
	
	onOptionsShown: function () {
		
	},
	
	
	onBeforeImport: async function (translation) {
		// Unrecognized translator
		if (!translation) {
			// Allow error dialog to be displayed, and then close window
			setTimeout(function () {
				window.close();
			});
			return;
		}
		
		this._translation = translation;
		
		// Switch to progress pane
		this._wizard.goTo('page-progress');
		var pm = document.getElementById('import-progressmeter');
		
		translation.setHandler('itemDone', function () {
			pm.value = translation.getProgress();
		});
	},
	
	
	onImportStart: async function () {
		if (!this._file) {
			let index = document.getElementById('file-list').selectedIndex;
			this._file = this._dbs[index].path;
		}
		this._disableCancel();
		this._wizard.canRewind = false;
		this._wizard.canAdvance = false;
		
		try {
			let result = await Zotero_File_Interface.importFile({
				file: this._file,
				onBeforeImport: this.onBeforeImport.bind(this),
				addToLibraryRoot: !document.getElementById('create-collection-checkbox')
					.hasAttribute('checked'),
				linkFiles: document.getElementById('file-handling-radio').selectedIndex == 1
			});
			
			// Cancelled by user or due to error
			if (!result) {
				window.close();
				return;
			}
			
			let numItems = this._translation.newItems.length;
			this._onDone(
				Zotero.getString('fileInterface.importComplete'),
				Zotero.getString(`fileInterface.itemsWereImported`, numItems, numItems)
			);
		}
		catch (e) {
			if (e.message == 'Encrypted Mendeley database') {
				let url = 'https://www.zotero.org/support/kb/mendeley_import';
				this._onDone(
					Zotero.getString('general.error'),
					// TODO: Localize
					`The selected Mendeley database cannot be read, likely because it is encrypted. `
						+ `See <a href="${url}" class="text-link">How do I import a Mendeley library `
						+ `into Zotero?</a> for more information.`
				);
			}
			else {
				this._onDone(
					Zotero.getString('general.error'),
					Zotero.getString('fileInterface.importError'),
					true
				);
			}
			throw e;
		}
	},
	
	
	reportError: function () {
		Zotero.getActiveZoteroPane().reportErrors();
		window.close();
	},
	
	
	_populateFileList: async function (files) {
		var listbox = document.getElementById('file-list');
		
		// Remove existing entries
		var items = listbox.getElementsByTagName('listitem');
		for (let item of items) {
			listbox.removeChild(item);
		}
		
		for (let file of files) {
			let li = document.createElement('listitem');
			
			let name = document.createElement('listcell');
			// Simply filenames
			let nameStr = file.name
				.replace(/\.sqlite$/, '')
				.replace(/@www\.mendeley\.com$/, '');
			if (nameStr == 'online') {
				nameStr = Zotero.getString('dataDir.default', 'online.sqlite');
			}
			name.setAttribute('label', nameStr + ' ');
			li.appendChild(name);
			
			let lastModified = document.createElement('listcell');
			lastModified.setAttribute('label', file.lastModified.toLocaleString() + ' ');
			li.appendChild(lastModified);
			
			let size = document.createElement('listcell');
			size.setAttribute(
				'label',
				Zotero.getString('general.nMegabytes', (file.size / 1024 / 1024).toFixed(1)) + ' '
			);
			li.appendChild(size);
			
			listbox.appendChild(li);
		}
		
		if (files.length == 1) {
			listbox.selectedIndex = 0;
		}
	},
	
	
	_enableCancel: function () {
		this._wizard.getButton('cancel').disabled = false;
	},
	
	
	_disableCancel: function () {
		this._wizard.getButton('cancel').disabled = true;
	},
	
	
	_onDone: function (label, description, showReportErrorButton) {
		var wizard = this._wizard;
		wizard.getPageById('page-done').setAttribute('label', label);
		
		var xulElem = document.getElementById('result-description');
		var htmlElem = document.getElementById('result-description-html');
		
		if (description.includes('href')) {
			htmlElem.innerHTML = description;
			Zotero.Utilities.Internal.updateHTMLInXUL(htmlElem);
			xulElem.hidden = true;
			htmlElem.setAttribute('display', 'block');
		}
		else {
			xulElem.textContent = description;
			xulElem.hidden = false;
			htmlElem.setAttribute('display', 'none');
		}
		document.getElementById('result-description')
		
		if (showReportErrorButton) {
			let button = document.getElementById('result-report-error');
			button.setAttribute('label', Zotero.getString('errorReport.reportError'));
			button.hidden = false;
		}
		
		// When done, move to last page and allow closing
		wizard.canAdvance = true;
		wizard.goTo('page-done');
		wizard.canRewind = false;
	}
};
