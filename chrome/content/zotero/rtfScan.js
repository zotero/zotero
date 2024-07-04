import React from 'react';
import ReactDOM from 'react-dom';

var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');
import VirtualizedTable from 'components/virtualized-table';
import { getCSSIcon } from 'components/icons';

var { Services } = ChromeUtils.import('resource://gre/modules/Services.jsm');
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/styleConfigurator.js', this);

function _generateItem(citationString, itemName, action) {
	return {
		rtf: citationString,
		item: itemName,
		action
	};
}

function _matchesItemCreators(creators, item, etAl) {
	var itemCreators = item.getCreators();
	var primaryCreators = [];
	var primaryCreatorTypeID = Zotero.CreatorTypes.getPrimaryIDForType(item.itemTypeID);

	// use only primary creators if primary creators exist
	for (let i = 0; i < itemCreators.length; i++) {
		if (itemCreators[i].creatorTypeID == primaryCreatorTypeID) {
			primaryCreators.push(itemCreators[i]);
		}
	}
	// if primaryCreators matches the creator list length, or if et al is being used, use only
	// primary creators
	if (primaryCreators.length == creators.length || etAl) itemCreators = primaryCreators;

	// for us to have an exact match, either the citation creator list length has to match the
	// item creator list length, or et al has to be used
	if (itemCreators.length == creators.length || (etAl && itemCreators.length > creators.length)) {
		var matched = true;
		for (let i = 0; i < creators.length; i++) {
			// check each item creator to see if it matches
			matched = matched && _matchesItemCreator(creators[i], itemCreators[i]);
			if (!matched) break;
		}
		return matched;
	}

	return false;
}

function _matchesItemCreator(creator, itemCreator) {
	// make sure last name matches
	var lowerLast = itemCreator.lastName.toLowerCase();
	if (lowerLast != creator.substr(-lowerLast.length).toLowerCase()) return false;

	// make sure first name matches, if it exists
	if (creator.length > lowerLast.length) {
		var firstName = Zotero.Utilities.trim(creator.substr(0, creator.length - lowerLast.length));
		if (firstName.length) {
			// check to see whether the first name is all initials
			const initialRe = /^(?:[A-Z]\.? ?)+$/;
			var m = initialRe.exec(firstName);
			if (m) {
				var initials = firstName.replace(/[^A-Z]/g, "");
				var itemInitials = itemCreator.firstName.split(/ +/g)
					.map(name => name[0].toUpperCase())
					.join("");
				if (initials != itemInitials) return false;
			}
			else {
				// not all initials; verify that the first name matches
				var firstWord = firstName.substr(0, itemCreator.firstName).toLowerCase();
				var itemFirstWord = itemCreator.firstName.substr(0, itemCreator.firstName.indexOf(" ")).toLowerCase();
				if (firstWord != itemFirstWord) return false;
			}
		}
	}

	return true;
}


const columns = [
	{ dataKey: 'rtf', label: "zotero.rtfScan.citation.label", primary: true, flex: 4 },
	{ dataKey: 'item', label: "zotero.rtfScan.itemName.label", flex: 5 },
	{ dataKey: 'action', label: "", fixedWidth: true, width: "32px" },
];

const BIBLIOGRAPHY_PLACEHOLDER = "\\{Bibliography\\}";

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
		// set up globals
		this.citations = [];
		this.citationItemIDs = {};

		let unmappedRow = this.rows[this.rowMap.unmapped];
		let ambiguousRow = this.rows[this.rowMap.ambiguous];
		let mappedRow = this.rows[this.rowMap.mapped];

		// set up regular expressions
		// this assumes that names are >=2 chars or only capital initials and that there are no
		// more than 4 names
		const nameRe = "(?:[^ .,;]{2,} |[A-Z].? ?){0,3}[A-Z][^ .,;]+";
		const creatorRe = '((?:(?:' + nameRe + ', )*' + nameRe + '(?:,? and|,? \\&|,) )?' + nameRe + ')(,? et al\\.?)?';
		// TODO: localize "and" term
		const creatorSplitRe = /(?:,| *(?:and|&)) +/g;
		var citationRe = new RegExp('(\\\\\\{|; )(' + creatorRe + ',? (?:"([^"]+)(?:,"|",) )?([0-9]{4})[a-z]?)(?:,(?: pp?.?)? ([^ )]+))?(?=;|\\\\\\})|(([A-Z][^ .,;]+)(,? et al\\.?)? (\\\\\\{([0-9]{4})[a-z]?\\\\\\}))', "gm");

		// read through RTF file and display items as they're found
		// we could read the file in chunks, but unless people start having memory issues, it's
		// probably faster and definitely simpler if we don't
		this.contents = Zotero.File.getContents(this.inputFile)
			.replace(/([^\\\r])\r?\n/, "$1 ")
			.replace("\\'92", "'", "g")
			.replace("\\rquote ", "’");
		var m;
		var lastCitation = false;
		while ((m = citationRe.exec(this.contents))) {
			// determine whether suppressed or standard regular expression was used
			if (m[2]) {	// standard parenthetical
				var citationString = m[2];
				var creators = m[3];
				// var etAl = !!m[4];
				var title = m[5];
				var date = m[6];
				var pages = m[7];
				var start = citationRe.lastIndex - m[0].length;
				var end = citationRe.lastIndex + 2;
			}
			else {	// suppressed
				citationString = m[8];
				creators = m[9];
				// etAl = !!m[10];
				title = false;
				date = m[12];
				pages = false;
				start = citationRe.lastIndex - m[11].length;
				end = citationRe.lastIndex;
			}
			citationString = citationString.replace("\\{", "{", "g").replace("\\}", "}", "g");
			var suppressAuthor = !m[2];

			if (lastCitation && lastCitation.end >= start) {
				// if this citation is just an extension of the last, add items to it
				lastCitation.citationStrings.push(citationString);
				lastCitation.pages.push(pages);
				lastCitation.end = end;
			}
			else {
				// otherwise, add another citation
				lastCitation = {
					citationStrings: [citationString], pages: [pages],
					start, end, suppressAuthor
				};
				this.citations.push(lastCitation);
			}

			// only add each citation once
			if (this.citationItemIDs[citationString]) continue;
			Zotero.debug("Found citation " + citationString);

			// for each individual match, look for an item in the database
			var s = new Zotero.Search;
			creators = creators.replace(".", "");
			// TODO: localize "et al." term
			creators = creators.split(creatorSplitRe);

			for (let i = 0; i < creators.length; i++) {
				if (!creators[i]) {
					if (i == creators.length - 1) {
						break;
					}
					else {
						creators.splice(i, 1);
					}
				}

				var spaceIndex = creators[i].lastIndexOf(" ");
				var lastName = spaceIndex == -1 ? creators[i] : creators[i].substr(spaceIndex + 1);
				s.addCondition("lastName", "contains", lastName);
			}
			if (title) s.addCondition("title", "contains", title);
			s.addCondition("date", "is", date);
			var ids = await s.search(); // eslint-disable-line no-await-in-loop
			Zotero.debug("Mapped to " + ids);
			this.citationItemIDs[citationString] = ids;

			if (!ids.length) {	// no mapping found
				let row = _generateItem(citationString, "");
				row.parent = unmappedRow;
				this.insertRows(row, this.rowMap.ambiguous);
			}
			else {	// some mapping found
				var items = await Zotero.Items.getAsync(ids); // eslint-disable-line no-await-in-loop
				if (items.length > 1) {
					// check to see how well the author list matches the citation
					var matchedItems = [];
					for (let item of items) {
						await item.loadAllData(); // eslint-disable-line no-await-in-loop
						if (_matchesItemCreators(creators, item)) matchedItems.push(item);
					}

					if (matchedItems.length != 0) items = matchedItems;
				}

				if (items.length == 1) {	// only one mapping
					await items[0].loadAllData(); // eslint-disable-line no-await-in-loop
					let row = _generateItem(citationString, items[0].getField("title"));
					row.parent = mappedRow;
					this.insertRows(row, this.rows.length);
					this.citationItemIDs[citationString] = [items[0].id];
				}
				else {				// ambiguous mapping
					let row = _generateItem(citationString, "");
					row.parent = ambiguousRow;
					this.insertRows(row, this.rowMap.mapped);

					// generate child items
					let children = [];
					for (let item of items) {
						let childRow = _generateItem("", item.getField("title"), true);
						childRow.parent = row;
						children.push(childRow);
					}
					this.insertRows(children, this.rowMap[row.id] + 1);
				}
			}
		}
	},

	formatRTF() {
		// load style and create ItemSet with all items
		var zStyle = Zotero.Styles.get(this.styleConfig.style);
		var cslEngine = zStyle.getCiteProc(this.styleConfig.locale, 'rtf');
		var isNote = zStyle.class == "note";

		// create citations
		// var k = 0;
		var cslCitations = [];
		var itemIDs = {};
		// var shouldBeSubsequent = {};
		for (let i = 0; i < this.citations.length; i++) {
			let citation = this.citations[i];
			var cslCitation = { citationItems: [], properties: {} };
			if (isNote) {
				cslCitation.properties.noteIndex = i;
			}

			// create citation items
			for (var j = 0; j < citation.citationStrings.length; j++) {
				var citationItem = {};
				citationItem.id = this.citationItemIDs[citation.citationStrings[j]][0];
				itemIDs[citationItem.id] = true;
				citationItem.locator = citation.pages[j];
				citationItem.label = "page";
				citationItem["suppress-author"] = citation.suppressAuthor && !isNote;
				cslCitation.citationItems.push(citationItem);
			}

			cslCitations.push(cslCitation);
		}
		Zotero.debug(cslCitations);

		itemIDs = Object.keys(itemIDs);
		Zotero.debug(itemIDs);

		// prepare the list of rendered citations
		var citationResults = cslEngine.rebuildProcessorState(cslCitations, "rtf");

		// format citations
		var contentArray = [];
		var lastEnd = 0;
		for (let i = 0; i < this.citations.length; i++) {
			let citation = citationResults[i][2];
			Zotero.debug("Formatted " + citation);

			// if using notes, we might have to move the note after the punctuation
			if (isNote && this.citations[i].start != 0 && this.contents[this.citations[i].start - 1] == " ") {
				contentArray.push(this.contents.substring(lastEnd, this.citations[i].start - 1));
			}
			else {
				contentArray.push(this.contents.substring(lastEnd, this.citations[i].start));
			}

			lastEnd = this.citations[i].end;
			if (isNote && this.citations[i].end < this.contents.length && ".,!?".indexOf(this.contents[this.citations[i].end]) !== -1) {
				contentArray.push(this.contents[this.citations[i].end]);
				lastEnd++;
			}

			if (isNote) {
				if (this.styleConfig.displayAs === 'endnotes') {
					contentArray.push("{\\super\\chftn}\\ftnbj {\\footnote\\ftnalt {\\super\\chftn } " + citation + "}");
				}
				else {	// footnotes
					contentArray.push("{\\super\\chftn}\\ftnbj {\\footnote {\\super\\chftn } " + citation + "}");
				}
			}
			else {
				contentArray.push(citation);
			}
		}
		contentArray.push(this.contents.substring(lastEnd));
		this.contents = contentArray.join("");

		// add bibliography
		if (zStyle.hasBibliography) {
			var bibliography = Zotero.Cite.makeFormattedBibliography(cslEngine, "rtf");
			bibliography = bibliography.substring(5, bibliography.length - 1);
			// fix line breaks
			var linebreak = "\r\n";
			if (this.contents.indexOf("\r\n") == -1) {
				bibliography = bibliography.replace("\r\n", "\n", "g");
				linebreak = "\n";
			}

			if (this.contents.indexOf(BIBLIOGRAPHY_PLACEHOLDER) !== -1) {
				this.contents = this.contents.replace(BIBLIOGRAPHY_PLACEHOLDER, bibliography);
			}
			else {
				// add two newlines before bibliography
				bibliography = linebreak + "\\" + linebreak + "\\" + linebreak + bibliography;

				// add bibliography automatically inside last set of brackets closed
				const bracketRe = /^\{+/;
				var m = bracketRe.exec(this.contents);
				if (m) {
					var closeBracketRe = new RegExp("(\\}{" + m[0].length + "}\\s*)$");
					this.contents = this.contents.replace(closeBracketRe, bibliography + "$1");
				}
				else {
					this.contents += bibliography;
				}
			}
		}

		cslEngine.free();

		Zotero.File.putContents(this.outputFile, this.contents);

		// save locale
		if (!zStyle.locale && this.styleConfig.locale) {
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
