/*
	***** BEGIN LICENSE BLOCK *****
    
	Copyright © 2022 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://www.zotero.org
    
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

import FilePicker from 'zotero/filePicker';
import React from 'react';
import ReactDOM from 'react-dom';
import ProgressQueueTable from 'components/progressQueueTable';

/* eslint camelcase: ["error", {allow: ["Zotero_File_Interface", "Zotero_Import_Wizard"]} ] */
/* global Zotero_File_Interface: false */


const Zotero_Import_Wizard = { // eslint-disable-line no-unused-vars
	wizard: null,
	folder: null,
	file: null,
	mendeleyCode: null,
	libraryID: null,
	translation: null,

	async getShouldCreateCollection() {
		const sql = "SELECT ROWID FROM collections WHERE libraryID=?1 "
			+ "UNION "
			+ "SELECT ROWID FROM items WHERE libraryID=?1 "
			// Not in trash
			+ "AND itemID NOT IN (SELECT itemID FROM deletedItems) "
			// And not a child item (which doesn't necessarily show up in the trash)
			+ "AND itemID NOT IN (SELECT itemID FROM itemNotes WHERE parentItemID IS NOT NULL) "
			+ "AND itemID NOT IN (SELECT itemID FROM itemAttachments WHERE parentItemID IS NOT NULL) "
			+ "LIMIT 1";
		return Zotero.DB.valueQueryAsync(sql, this.libraryID);
	},

	async init() {
		const { mendeleyCode, libraryID } = window.arguments[0].wrappedJSObject ?? {};

		this.libraryID = libraryID;
		this.mendeleyCode = mendeleyCode;

		this.wizard = document.getElementById('import-wizard');
		this.wizard.getPageById('page-start')
			.addEventListener('pageadvanced', this.onImportSourceAdvance.bind(this));
		this.wizard.getPageById('page-mendeley-online-intro')
			.addEventListener('pagerewound', this.goToStart.bind(this));
		this.wizard.getPageById('page-mendeley-online-intro')
			.addEventListener('pageadvanced', this.openMendeleyAuthWindow.bind(this));
		this.wizard.getPageById('page-options')
			.addEventListener('pageshow', this.onOptionsPageShow.bind(this));
		this.wizard.getPageById('page-options')
			.addEventListener('pageadvanced', this.startImport.bind(this));
		this.wizard.getPageById('page-progress')
			.addEventListener('pageshow', this.onProgressPageShow.bind(this));

		document
			.getElementById('other-files')
			.addEventListener('keyup', (ev) => {
				document.getElementById('import-other').checked = ev.currentTarget.value.length > 0;
			});
		document
			.querySelector('#page-done-error-mendeley > a')
			.addEventListener('click', this.onURLInteract.bind(this));
		document
			.querySelector('#page-done-error-mendeley > a')
			.addEventListener('keydown', this.onURLInteract.bind(this));
		document
			.querySelector('#page-done-error > button')
			.addEventListener('click', this.onReportErrorInteract.bind(this));
		document
			.querySelector('#page-done-error > button')
			.addEventListener('keydown', this.onReportErrorInteract.bind(this));

		this.wizard.addEventListener('pageshow', this.updateFocus.bind(this));
		this.wizard.addEventListener('wizardcancel', this.onCancel.bind(this));

		const shouldCreateCollection = await this.getShouldCreateCollection();
		document.getElementById('create-collection').checked = shouldCreateCollection;

		// wizard.shadowRoot content isn't exposed to our css
		this.wizard.shadowRoot
			.querySelector('.wizard-header-label').style.fontSize = '16px';

		if (mendeleyCode) {
			this.wizard.goTo('page-options');
		}
	},

	skipToDonePage(label, description, showReportErrorButton = false, isMendeleyError = false) {
		this.wizard.getPageById('page-done').dataset.headerLabelId = label;

		if (!isMendeleyError) {
			if (Array.isArray(description)) {
				document.getElementById('page-done-description').dataset.l10nId = description[0];
				document.getElementById('page-done-description').dataset.l10nArgs = JSON.stringify(description[1]);
			}
			else {
				document.getElementById('page-done-description').dataset.l10nId = description;
			}
		}

		document.getElementById('page-done-error-mendeley').style.display = isMendeleyError ? 'block' : 'none';
		document.getElementById('page-done-error').style.display = showReportErrorButton ? 'block' : 'none';

		const doneQueueContainer = document.getElementById('done-queue-container');
		const doneQueue = document.getElementById('done-queue');
		
		if (this.folder && !showReportErrorButton) {
			doneQueueContainer.style.display = 'flex';
			ReactDOM.render(
				<ProgressQueueTable progressQueue={ Zotero.ProgressQueues.get('recognize') } />,
				doneQueue
			);
		}
		else {
			doneQueueContainer.style.display = 'none';
		}

		this.wizard.goTo('page-done');
		this.wizard.canRewind = false;
	},

	goToStart() {
		this.wizard.goTo('page-start');
		this.wizard.canAdvance = true;
	},

	async chooseFile() {
		const translation = new Zotero.Translate.Import();
		const translators = await translation.getTranslators();
		const fp = new FilePicker();
		fp.init(window, Zotero.getString("fileInterface.import"), fp.modeOpen);
		fp.appendFilters(fp.filterAll);
		var collation = Zotero.getLocaleCollation();

		// Add Mendeley DB, which isn't a translator
		const mendeleyFilter = {
			label: "Mendeley Database", // TODO: Localize
			target: "*.sqlite"
		};
		const filters = [...translators];
		filters.push(mendeleyFilter);

		filters.sort((a, b) => collation.compareString(1, a.label, b.label));
		for (let filter of filters) {
			fp.appendFilter(filter.label, "*." + filter.target);
		}

		const rv = await fp.show();
		if (rv !== fp.returnOK && rv !== fp.returnReplace) {
			return;
		}

		Zotero.debug(`File is ${fp.file}`);
		this.file = fp.file;
		this.wizard.canAdvance = true;
		this.wizard.goTo('page-options');
	},

	async chooseFolder() {
		const fp = new FilePicker();
		fp.init(window, Zotero.getString('attachmentBasePath.selectDir'), fp.modeGetFolder);
		fp.appendFilters(fp.filterAll);

		const rv = await fp.show();
		if (rv !== fp.returnOK && rv !== fp.returnReplace) {
			return;
		}

		Zotero.debug(`Folder is ${fp.file}`);

		this.folder = fp.file;
		this.wizard.canAdvance = true;
		this.wizard.goTo('page-options');
	},

	async onImportSourceAdvance(ev) {
		const selectedMode = document.getElementById('import-source-group').selectedItem.value;
		ev.preventDefault();
		ev.stopPropagation();
		try {
			switch (selectedMode) {
				case 'file':
					this.folder = null;
					await this.chooseFile();
					break;
				case 'folder':
					this.file = null;
					await this.chooseFolder();
					break;
				case 'mendeleyOnline':
					this.file = null;
					this.folder = null;
					this.wizard.goTo('page-mendeley-online-intro');
					this.wizard.canRewind = true;
					break;
				default:
					throw new Error(`Unknown mode ${selectedMode}`);
			}
		}
		catch (e) {
			this.skipToDonePage('general-error', 'file-interface-import-error', true);
			throw e;
		}
	},

	onOptionsPageShow() {
		document.getElementById('page-options-folder-import').style.display = this.folder ? 'block' : 'none';
		document.getElementById('page-options-file-handling').style.display = this.mendeleyCode ? 'none' : 'block';
		this.wizard.canRewind = false;
	},

	openMendeleyAuthWindow(ev) {
		ev.preventDefault();

		const arg = Components.classes["@mozilla.org/supports-string;1"]
			.createInstance(Components.interfaces.nsISupportsString);
		arg.data = 'mendeleyImport';

		window.close();

		Services.ww.openWindow(null, "chrome://zotero/content/standalone/basicViewer.xhtml",
			"basicViewer", "chrome,dialog=yes,centerscreen,width=1000,height=700,modal", arg);
	},

	async onBeforeImport(translation) {
		// Unrecognized translator
		if (!translation) {
			// Allow error dialog to be displayed, and then close window
			setTimeout(function () {
				window.close();
			});
			return;
		}

		this.translation = translation;

		// Switch to progress pane
		this.wizard.goTo('page-progress');
		translation.setHandler('itemDone', () => {
			document.getElementById('import-progress').value = translation.getProgress();
		});
	},

	async onProgressPageShow() {
		this.wizard.canAdvance = false;
		this.wizard.canRewind = false;
		const progressQueueContainer = document.getElementById('progress-queue-container');
		const progressQueue = document.getElementById('progress-queue');
		if (this.folder) {
			progressQueueContainer.style.display = 'flex';
			ReactDOM.render(
				<ProgressQueueTable progressQueue={Zotero.ProgressQueues.get('recognize')} />,
				progressQueue
			);
		}
		else {
			progressQueueContainer.style.display = 'none';
		}
	},

	onURLInteract(ev) {
		if (ev.type === 'click' || (ev.type === 'keydown' && ev.key === ' ')) {
			Zotero.launchURL(ev.currentTarget.getAttribute('href'));
			window.close();
			ev.preventDefault();
		}
	},

	onReportErrorInteract(ev) {
		if (ev.type === 'click' || (ev.type === 'keydown' && ev.key === ' ')) {
			Zotero.getActiveZoteroPane().reportErrors();
			window.close();
		}
	},

	onCancel() {
		if (this.translation && this.translation.interrupt) {
			this.translation.interrupt();
		}
	},

	updateFocus() {
		(this.wizard.currentPage.querySelector('radiogroup:not([disabled]),checkbox:not([disabled])') ?? this.wizard.currentPage).focus();
	},

	async startImport() {
		this.wizard.canAdvance = false;
		this.wizard.canRewind = false;

		const linkFiles = document.getElementById('file-handling').selectedItem.id === 'link';
		const recreateStructure = document.getElementById('recreate-structure').checked;
		const shouldCreateCollection = document.getElementById('create-collection').checked;
		const mimeTypes = document.getElementById('import-pdf').checked
			? ['application/pdf']
			: [];
		const fileTypes = document.getElementById('import-other').checked
			? document.getElementById('other-files').value
			: null;
		
		try {
			const result = await Zotero_File_Interface.importFile({
				addToLibraryRoot: !shouldCreateCollection,
				file: this.file,
				fileTypes,
				folder: this.folder,
				linkFiles,
				mendeleyCode: this.mendeleyCode,
				mimeTypes,
				onBeforeImport: this.onBeforeImport.bind(this),
				recreateStructure
			});

			// Cancelled by user or due to error
			if (!result) {
				window.close();
				return;
			}

			const numItems = this.translation.newItems.length;
			this.skipToDonePage(
				'file-interface-import-complete',
				['file-interface-items-were-imported', { numItems }]
			);
		}
		catch (e) {
			if (e.message == 'Encrypted Mendeley database') {
				this.skipToDonePage('general.error', [], false, true);
			}
			else {
				const translatorLabel = this.translation?.translator?.[0]?.label;
				this.skipToDonePage(
					'general.error',
					translatorLabel
						? ['file-interface-import-error-translator', { translator: translatorLabel }]
						: 'file-interface-import-error',
					true
				);
			}
			throw e;
		}
	},
};
