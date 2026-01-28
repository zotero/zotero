import React from 'react'; // eslint-disable-line no-unused-vars
import ReactDOM from 'react-dom';
var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');

import VirtualizedTable from 'zotero/components/virtualized-table';
import { getCSSIcon } from 'zotero/components/icons';
import { removeKeys } from 'zotero/modules/immutable';
import { decodeRTF, encodeRTF, parseCitations, processCitations, replaceCitations, UNMAPPED, AMBIGUOUS, MAPPED } from 'zotero/modules/rtf.mjs';

Services.scriptloader.loadSubScript('chrome://zotero/content/elements/styleConfigurator.js', this);


const columns = [
	{ dataKey: 'rtf', label: "zotero.rtfScan.citation.label", primary: true, flex: 4 },
	{ dataKey: 'item', label: "zotero.rtfScan.itemName.label", flex: 5 },
	{ dataKey: 'action', label: "", fixedWidth: true, width: "32px" },
];

const initialRows = [
	{ id: 'unmapped', rtf: Zotero.Intl.strings['zotero.rtfScan.unmappedCitations.label'], collapsed: false },
	{ id: 'ambiguous', rtf: Zotero.Intl.strings['zotero.rtfScan.ambiguousCitations.label'], collapsed: false },
	{ id: 'mapped', rtf: Zotero.Intl.strings['zotero.rtfScan.mappedCitations.label'], collapsed: false },
];
Object.freeze(initialRows);

// const initialRowMap = {};
// initialRows.forEach((row, index) => initialRowMap[row.id] = index);
const initialRowMap = initialRows.reduce((aggr, row, index) => {
	aggr[row.id] = index;
	return aggr;
}, {});
Object.freeze(initialRowMap);


const Zotero_RTFScan = { // eslint-disable-line no-unused-vars, camelcase
	wizard: null,
	inputFile: null,
	outputFile: null,
	contents: null,
	tree: null,
	styleConfig: null,
	citations: null,
	citationItemIDs: null,
	ids: 0,
	rows: [...initialRows],
	rowMap: { ...initialRowMap },


	async init() {
		this.citationItemIDs = {};
		this.wizard = document.getElementById('rtfscan-wizard');
		
		this.wizard.getPageById('page-start')
			.addEventListener('pageshow', this.onIntroShow.bind(this));
		this.wizard.getPageById('page-start')
			.addEventListener('pageadvanced', this.onIntroAdvanced.bind(this));
		this.wizard.getPageById('scan-page')
			.addEventListener('pageshow', this.onScanPageShow.bind(this));
		this.wizard.getPageById('style-page')
			.addEventListener('pageadvanced', this.onStylePageAdvanced.bind(this));
		this.wizard.getPageById('style-page')
			.addEventListener('pagerewound', this.onStylePageRewound.bind(this));
		this.wizard.getPageById('format-page')
			.addEventListener('pageshow', this.onFormatPageShow.bind(this));
		this.wizard.getPageById('citations-page')
			.addEventListener('pageshow', this.onCitationsPageShow.bind(this));
		this.wizard.getPageById('citations-page')
			.addEventListener('pagerewound', this.onCitationsPageRewound.bind(this));
		this.wizard.getPageById('complete-page')
			.addEventListener('pageshow', this.onCompletePageShow.bind(this));

		document
			.getElementById('choose-input-file')
			.addEventListener('click', this.onChooseInputFile.bind(this));
		document
			.getElementById('choose-output-file')
			.addEventListener('click', this.onChooseOutputFile.bind(this));

		ReactDOM.createRoot(document.getElementById('tree')).render((
			<VirtualizedTable
				getRowCount={() => this.rows.length}
				id="rtfScan-table"
				ref={ref => this.tree = ref}
				renderItem={this.renderItem.bind(this)}
				showHeader={true}
				columns={columns}
				containerWidth={document.getElementById('tree').clientWidth}
				disableFontSizeScaling={true}
			/>
		));

		const lastInputFile = Zotero.Prefs.get("rtfScan.lastInputFile");
		if (lastInputFile) {
			document.getElementById('input-path').value = lastInputFile;
			this.inputFile = Zotero.File.pathToFile(lastInputFile);
		}
		const lastOutputFile = Zotero.Prefs.get("rtfScan.lastOutputFile");
		if (lastOutputFile) {
			document.getElementById('output-path').value = lastOutputFile;
			this.outputFile = Zotero.File.pathToFile(lastOutputFile);
		}
		
		// wizard.shadowRoot content isn't exposed to our css
		this.wizard.shadowRoot
			.querySelector('.wizard-header-label').style.fontSize = '16px';

		this.updatePath();
		document.getElementById("choose-input-file").focus();
	},

	async onChooseInputFile(ev) {
		if (ev.type === 'keydown' && ev.key !== ' ') {
			return;
		}
		ev.stopPropagation();
		const fp = new FilePicker();
		fp.init(window, Zotero.getString("rtfScan.openTitle"), fp.modeOpen);
		fp.appendFilters(fp.filterAll);
		fp.appendFilter(Zotero.getString("rtfScan.rtf"), "*.rtf");
		const rv = await fp.show();
		
		if (rv == fp.returnOK || rv == fp.returnReplace) {
			this.inputFile = Zotero.File.pathToFile(fp.file);
			this.updatePath();
		}
	},

	async onChooseOutputFile(ev) {
		if (ev.type === 'keydown' && ev.key !== ' ') {
			return;
		}
		ev.stopPropagation();
		const fp = new FilePicker();
		fp.init(window, Zotero.getString("rtfScan.saveTitle"), fp.modeSave);
		fp.appendFilter(Zotero.getString("rtfScan.rtf"), "*.rtf");
		if (this.inputFile) {
			let leafName = this.inputFile.leafName;
			let dotIndex = leafName.lastIndexOf(".");
			if (dotIndex !== -1) {
				leafName = leafName.substr(0, dotIndex);
			}
			fp.defaultString = leafName + " " + Zotero.getString("rtfScan.scannedFileSuffix") + ".rtf";
		}
		else {
			fp.defaultString = "Untitled.rtf";
		}

		var rv = await fp.show();

		if (rv == fp.returnOK || rv == fp.returnReplace) {
			this.outputFile = Zotero.File.pathToFile(fp.file);
			this.updatePath();
		}
	},

	onIntroShow() {
		this.wizard.canRewind = false;
		this.updatePath();
	},

	onIntroAdvanced() {
		Zotero.Prefs.set("rtfScan.lastInputFile", this.inputFile.path);
		Zotero.Prefs.set("rtfScan.lastOutputFile", this.outputFile.path);
	},

	async onScanPageShow() {
		this.wizard.canRewind = false;
		this.wizard.canAdvance = false;

		// wait a ms so that UI thread gets updated
		try {
			await this.scanRTF();
			this.tree.invalidate();
			this.wizard.canRewind = true;
			this.wizard.canAdvance = true;
			this.wizard.advance();
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug(e);
		}
	},

	onStylePageRewound(ev) {
		ev.preventDefault();
		this.rows = [...initialRows];
		this.rowMap = { ...initialRowMap };
		this.wizard.goTo('page-start');
	},

	onStylePageAdvanced() {
		const styleConfigurator = document.getElementById('style-configurator');
		this.styleConfig = {
			style: styleConfigurator.style,
			locale: styleConfigurator.locale,
			displayAs: styleConfigurator.displayAs
		};
		Zotero.Prefs.set("export.lastStyle", this.styleConfig.style);
	},

	onCitationsPageShow() {
		this.refreshCanAdvanceIfCitationsReady();
	},

	onCitationsPageRewound(ev) {
		ev.preventDefault();
		this.rows = [...initialRows];
		this.rowMap = { ...initialRowMap };
		this.wizard.goTo('page-start');
	},

	onFormatPageShow() {
		this.wizard.canAdvance = false;
		this.wizard.canRewind = false;

		window.setTimeout(() => {
			this.formatRTF();
			this.wizard.canRewind = true;
			this.wizard.canAdvance = true;
			this.wizard.advance();
		}, 0);
	},

	onCompletePageShow() {
		this.wizard.canRewind = false;
	},

	onRowTwistyMouseUp(event, index) {
		const row = this.rows[index];
		if (!row.collapsed) {
			// Store children rows on the parent when collapsing
			row.children = [];
			const depth = this.getRowLevel(index);
			for (let childIndex = index + 1; childIndex < this.rows.length && this.getRowLevel(this.rows[childIndex]) > depth; childIndex++) {
				row.children.push(this.rows[childIndex]);
			}
			// And then remove them
			this.removeRows(row.children.map((_, childIndex) => index + 1 + childIndex));
		}
		else {
			// Insert children rows from the ones stored on the parent
			this.insertRows(row.children, index + 1);
			delete row.children;
		}
		row.collapsed = !row.collapsed;
		this.tree.invalidate();
	},

	onAction(ev, index) {
		let row = this.rows[index];
		const isTriggerEvent = ev.type === 'mouseup' || (ev.type === 'keydown' && (ev.key === 'Enter' || ev.key === ' '));
		
		if (!isTriggerEvent || !row.parent) {
			return;
		}
		
		let level = this.getRowLevel(row);
		if (level == 2) {		// ambiguous citation item
			let parentIndex = this.rowMap[row.parent.id];
			// Update parent item
			row.parent.item = row.item;

			// Remove children
			let children = [];
			for (let childIndex = parentIndex + 1; childIndex < this.rows.length && this.getRowLevel(this.rows[childIndex]) >= level; childIndex++) {
				children.push(this.rows[childIndex]);
			}
			this.removeRows(children.map((_, childIndex) => parentIndex + 1 + childIndex));

			// Move citation to mapped rows
			row.parent.parent = this.rows[this.rowMap.mapped];
			this.removeRows(parentIndex);
			this.insertRows(row.parent, this.rows.length);

			// update array
			this.citationItemIDs[row.parent.rtf] = [this.citationItemIDs[row.parent.rtf][index - parentIndex - 1]];
		}
		else {				// mapped or unmapped citation, or ambiguous citation parent
			var citation = row.rtf;
			var io = { singleSelection: true, itemTreeID: 'rtf-scan-select-item-dialog' };
			if (this.citationItemIDs[citation] && this.citationItemIDs[citation].length == 1) {	// mapped citation
				// specify that item should be selected in window
				io.select = this.citationItemIDs[citation][0];
			}

			window.openDialog('chrome://zotero/content/selectItemsDialog.xhtml', '', 'chrome,modal', io);

			if (io.dataOut && io.dataOut.length) {
				var selectedItemID = io.dataOut[0];
				var selectedItem = Zotero.Items.get(selectedItemID);
				// update item name
				row.item = selectedItem.getField("title");

				// Remove children
				let children = [];
				for (let childIndex = index + 1; childIndex < this.rows.length && this.getRowLevel(this.rows[childIndex]) > level; childIndex++) {
					children.push(this.rows[childIndex]);
				}
				this.removeRows(children.map((_, childIndex) => index + 1 + childIndex));

				if (row.parent.id != 'mapped') {
					// Move citation to mapped rows
					row.parent = this.rows[this.rowMap.mapped];
					this.removeRows(index);
					this.insertRows(row, this.rows.length);
				}

				// update array
				this.citationItemIDs[citation] = [selectedItemID];
			}
		}
		this.tree.invalidate();
		this.refreshCanAdvanceIfCitationsReady();
	},
	
	async scanRTF() {
		let unmappedRow = this.rows[this.rowMap.unmapped];
		let ambiguousRow = this.rows[this.rowMap.ambiguous];
		let mappedRow = this.rows[this.rowMap.mapped];

		this.contents = decodeRTF(await Zotero.File.getContentsAsync(this.inputFile));
		this.citations = parseCitations(this.contents);
		let mappings = await processCitations(this.citations);
		for (let mapping of mappings) {
			const mappingType = mapping.type;
			let items = mapping.items;
			let row = removeKeys(mapping, ['type', 'items']);
			removeKeys(mapping, ['type', 'items']);
			
			switch (mappingType) {
				default:
				case UNMAPPED:
					// create a new "unmapped" row and add it just before the "ambiguous" row (which means it appears as the last "unmapped" row, regardless of how many there already are
					this.insertRows({ ...row, item: '', parent: unmappedRow }, this.rowMap.ambiguous);
					this.citationItemIDs[row.rtf] = [];
					break;
				case AMBIGUOUS:
					// create a new "ambiguous" row and position it just before the "mapped" row.
					row = { ...row, parent: ambiguousRow };
					this.insertRows(row, this.rowMap.mapped);
					this.insertRows(
						items.map(item => ({ rtf: '', item: item.getField('title'), parent: row })),
						this.rowMap[row.id] + 1
					);
					this.citationItemIDs[row.rtf] = items.map(item => item.id);
					break;
				case MAPPED:
					this.insertRows({ ...row, item: items[0].getField('title'), parent: mappedRow }, this.rows.length);
					this.citationItemIDs[row.rtf] = [items[0].id];
					break;
			}
		}
	},
	
	async formatRTF() {
		const content = await replaceCitations(this.contents, this.citations, this.citationItemIDs, this.styleConfig.style, this.styleConfig.locale, this.styleConfig.displayAs);
		Zotero.File.putContents(this.outputFile, encodeRTF(content));

		// save locale
		const styleHasFixedLocale = Zotero.Styles.get(this.styleConfig.style).locale;
		if (!styleHasFixedLocale && this.styleConfig.locale) {
			Zotero.Prefs.set("export.lastLocale", this.styleConfig.locale);
		}
	},

	refreshCanAdvanceIfCitationsReady() {
		let newCanAdvance = true;
		for (let i in this.citationItemIDs) {
			let itemList = this.citationItemIDs[i];
			if (itemList.length !== 1) {
				newCanAdvance = false;
				break;
			}
		}
		this.wizard.canAdvance = newCanAdvance;
	},

	async updatePath() {
		this.wizard.canAdvance = this.inputFile && this.outputFile;
		let noFileSelectedLabel = await document.l10n.formatValue("rtfScan-no-file-selected");
		document.getElementById('input-path').value = this.inputFile ? this.inputFile.path : noFileSelectedLabel;
		document.getElementById('output-path').value = this.outputFile ? this.outputFile.path : noFileSelectedLabel;
	},

	insertRows(newRows, beforeRow) {
		if (!Array.isArray(newRows)) {
			newRows = [newRows];
		}
		this.rows.splice(beforeRow, 0, ...newRows);
		newRows.forEach(row => row.id = this.ids++);

		// Refresh the row map
		this.rowMap = {};
		this.rows.forEach((row, index) => this.rowMap[row.id] = index);
	},

	removeRows(indices) {
		if (!Array.isArray(indices)) {
			indices = [indices];
		}
		// Reverse sort so we can safely splice out the entries from the rows array
		indices.sort((a, b) => b - a);
		for (const index of indices) {
			this.rows.splice(index, 1);
		}
		// Refresh the row map
		this.rowMap = {};
		this.rows.forEach((row, index) => this.rowMap[row.id] = index);
	},

	getRowLevel(row, depth = 0) {
		if (typeof row == 'number') {
			row = this.rows[row];
		}
		if (!row.parent) {
			return depth;
		}
		return this.getRowLevel(row.parent, depth + 1);
	},

	renderItem(index, selection, oldDiv = null, columns) {
		const row = this.rows[index];
		let div;
		if (oldDiv) {
			div = oldDiv;
			div.innerHTML = "";
		}
		else {
			div = document.createElement('div');
			div.className = "row";
		}

		for (const column of columns) {
			if (column.primary) {
				let twisty;
				if (row.children || (this.rows[index + 1] && this.rows[index + 1].parent == row)) {
					twisty = getCSSIcon("twisty");
					twisty.classList.add('twisty');
					if (!row.collapsed) {
						twisty.classList.add('open');
					}
					twisty.style.pointerEvents = 'auto';
					twisty.addEventListener('mousedown', event => event.stopPropagation());
					twisty.addEventListener('mouseup', event => this.onRowTwistyMouseUp(event, index),
						{ passive: true });
				}
				else {
					twisty = document.createElement('span');
					twisty.classList.add("spacer-twisty");
				}

				twisty.style.marginLeft = `${20 * this.getRowLevel(row)}px`;

				let textSpan = document.createElement('span');
				textSpan.className = "cell-text";
				textSpan.innerText = row[column.dataKey] || "";
				textSpan.style.paddingLeft = '5px';

				let span = document.createElement('span');
				span.className = `cell primary ${column.className}`;
				span.appendChild(twisty);
				span.appendChild(textSpan);
				div.appendChild(span);
			}
			else if (column.dataKey == 'action') {
				let span = document.createElement('span');
				span.className = `cell action ${column.className}`;
				if (row.parent) {
					let button = document.createElement('button');
					let icon = getCSSIcon(row.action ? 'document-accept' : 'link');
					icon.classList.add('icon-16');
					button.appendChild(icon);
					button.addEventListener('mouseup', e => this.onAction(e, index), { passive: true });
					button.addEventListener('keydown', e => this.onAction(e, index), { passive: true });
					button.dataset.l10nId = row.action ? 'rtfScan-action-accept-match' : 'rtfScan-action-find-match';
					span.appendChild(button);
					span.style.pointerEvents = 'auto';
				}

				div.appendChild(span);
			}
			else {
				let span = document.createElement('span');
				span.className = `cell ${column.className}`;
				span.innerText = row[column.dataKey] || "";
				div.appendChild(span);
			}
		}
		return div;
	},

};
