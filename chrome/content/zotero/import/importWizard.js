var Zotero_Import_Wizard = {
	_wizard: null,
	_dbs: null,
	_file: null,
	_translation: null,
	
	
	init: function () {
		this._wizard = document.getElementById('import-wizard');
		
		Zotero.Translators.init(); // async
	},
	
	
	onModeChosen: async function () {
		var wizard = this._wizard;
		
		this._disableCancel();
		wizard.canRewind = false;
		wizard.canAdvance = false;
		
		var mode = document.getElementById('import-source').selectedItem.id;
		try {
			switch (mode) {
			case 'radio-import-source-file':
				await this.doImport();
				break;
				
			case 'radio-import-source-mendeley':
				this._dbs = await Zotero_File_Interface.findMendeleyDatabases();
				// This shouldn't happen, because we only show the wizard if there are databases
				if (!this._dbs.length) {
					throw new Error("No databases found");
				}
				if (this._dbs.length > 1 || true) {
					this._populateFileList(this._dbs);
					document.getElementById('file-options-header').textContent
						= Zotero.getString('fileInterface.chooseAppDatabaseToImport', 'Mendeley')
					wizard.goTo('page-file-options');
					wizard.canRewind = true;
					this._enableCancel();
				}
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
	
	
	onFileSelected: async function () {
		this._wizard.canAdvance = true;
	},
	
	
	onFileChosen: async function () {
		var index = document.getElementById('file-list').selectedIndex;
		this._file = this._dbs[index].path;
		this._disableCancel();
		this._wizard.canRewind = false;
		this._wizard.canAdvance = false;
		await this.doImport();
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
	
	
	doImport: async function () {
		try {
			let result = await Zotero_File_Interface.importFile({
				file: this._file,
				onBeforeImport: this.onBeforeImport.bind(this)
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
			this._onDone(
				Zotero.getString('general.error'),
				Zotero.getString('fileInterface.importError'),
				true
			);
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
		document.getElementById('result-description').textContent = description;
		
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
