/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2021 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://digitalscholar.org
    
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

/**
 * @fileOverview Tools for automatically retrieving a citation for the given PDF
 */

import FilePicker from 'zotero/modules/filePicker';
import React, { useCallback, memo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import VirtualizedTable from 'components/virtualized-table';
import { IntlProvider } from 'react-intl';
import { getDOMElement } from 'components/icons';

import Wizard from './components/wizard';
import WizardPage from './components/wizardPage';
import ProgressBar from './components/progressBar';
import StyleConfigurator from './components/styleConfigurator';
import { nextHTMLID, stopPropagation } from './components/utils';

const getLastFile = (type) => {
	const prefValue = Zotero.Prefs.get(`rtfScan.last${type}File`);
	return prefValue ? Zotero.File.pathToFile(prefValue) : null;
};

function _generateItem(citationString, itemName, action) {
	return {
		rtf: citationString,
		item: itemName,
		action
	};
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

const initialRows = [
	{ id: 'unmapped', rtf: Zotero.Intl.strings['zotero.rtfScan.unmappedCitations.label'], collapsed: false },
	{ id: 'ambiguous', rtf: Zotero.Intl.strings['zotero.rtfScan.ambiguousCitations.label'], collapsed: false },
	{ id: 'mapped', rtf: Zotero.Intl.strings['zotero.rtfScan.mappedCitations.label'], collapsed: false },
];

const initialRowMap = {};
initialRows.forEach((row, index) => initialRowMap[row.id] = index);

Object.freeze(initialRows);
Object.freeze(initialRowMap);

const columns = [
	{ dataKey: 'rtf', label: "zotero.rtfScan.citation.label", primary: true, flex: 4 },
	{ dataKey: 'item', label: "zotero.rtfScan.itemName.label", flex: 5 },
	{ dataKey: 'action', label: "", fixedWidth: true, width: "26px" },
];

const RtfScan = memo(() => {
	const BIBLIOGRAPHY_PLACEHOLDER = "\\{Bibliography\\}";

	const rows = useRef([...initialRows]);
	const rowMap = useRef({ ...initialRowMap });
	
	const ids = useRef(0);
	const citations = useRef(null);
	const citationItemIDs = useRef(null);
	const contents = useRef(null);

	const wizardRef = useRef(null);
	const treeRef = useRef(null);
	const htmlID = useRef(nextHTMLID());

	const [canAdvance, setCanAdvance] = useState(true);
	const [canRewind, setCanRewind] = useState(true);
	const [inputFile, setInputFile] = useState(getLastFile('Input'));
	const [outputFile, setOutputFile] = useState(getLastFile('Output'));
	const [styleConfig, setStyleConfig] = useState({
		style: Zotero.Prefs.get('export.lastStyle'),
		locale: Zotero.Prefs.get('export.lastLocale'),
		displayAs: 'footnotes'
	});

	const insertRows = useCallback((newRows, beforeRow) => {
		if (!Array.isArray(newRows)) {
			newRows = [newRows];
		}
		rows.current.splice(beforeRow, 0, ...newRows);
		newRows.forEach(row => row.id = ids.current++);
		
		// Refresh the row map
		rowMap.current = {};
		rows.current.forEach((row, index) => rowMap.current[row.id] = index);
	}, []);

	const removeRows = useCallback((indices) => {
		if (!Array.isArray(indices)) {
			indices = [indices];
		}
		// Reverse sort so we can safely splice out the entries from the rows array
		indices.sort((a, b) => b - a);
		for (const index of indices) {
			rows.current.splice(index, 1);
		}
		// Refresh the row map
		rowMap.current = {};
		rows.current.forEach((row, index) => rowMap.current[row.id] = index);
	}, []);

	const getRowLevel = useCallback((row, depth = 0) => {
		if (typeof row == 'number') {
			row = rows.current[row];
		}
		if (!row.parent) {
			return depth;
		}
		return getRowLevel(row.parent, depth + 1);
	}, []);

	const refreshCanAdvanceIfCitationsReady = useCallback(() => {
		let newCanAdvance = true;
		for (let i in citationItemIDs.current) {
			let itemList = citationItemIDs.current[i];
			if (itemList.length !== 1) {
				newCanAdvance = false;
				break;
			}
		}
		setCanAdvance(newCanAdvance);
	}, []);

	const handleRowTwistyMouseUp = useCallback((event, index) => {
		const row = rows.current[index];
		if (!row.collapsed) {
			// Store children rows on the parent when collapsing
			row.children = [];
			const depth = getRowLevel(index);
			for (let childIndex = index + 1; childIndex < rows.current.length && getRowLevel(rows.current[childIndex]) > depth; childIndex++) {
				row.children.push(rows.current[childIndex]);
			}
			// And then remove them
			removeRows(row.children.map((_, childIndex) => index + 1 + childIndex));
		}
		else {
			// Insert children rows from the ones stored on the parent
			insertRows(row.children, index + 1);
			delete row.children;
		}
		row.collapsed = !row.collapsed;
		treeRef.current.invalidate();
	}, [insertRows, removeRows, getRowLevel]);

	const handleActionMouseUp = useCallback((event, index) => {
		let row = rows.current[index];
		if (!row.parent) return;
		let level = getRowLevel(row);
		if (level == 2) {		// ambiguous citation item
			let parentIndex = rowMap.current[row.parent.id];
			// Update parent item
			row.parent.item = row.item;
			
			// Remove children
			let children = [];
			for (let childIndex = parentIndex + 1; childIndex < rows.current.length && getRowLevel(rows.current[childIndex]) >= level; childIndex++) {
				children.push(rows.current[childIndex]);
			}
			removeRows(children.map((_, childIndex) => parentIndex + 1 + childIndex));

			// Move citation to mapped rows
			row.parent.parent = rows.current[rowMap.current.mapped];
			removeRows(parentIndex);
			insertRows(row.parent, rows.current.length);

			// update array
			citationItemIDs.current[row.parent.rtf] = [citationItemIDs.current[row.parent.rtf][index - parentIndex - 1]];
		}
		else {				// mapped or unmapped citation, or ambiguous citation parent
			var citation = row.rtf;
			var io = { singleSelection: true };
			if (citationItemIDs.current[citation] && citationItemIDs.current[citation].length == 1) {	// mapped citation
				// specify that item should be selected in window
				io.select = citationItemIDs.current[citation][0];
			}

			window.openDialog('chrome://zotero/content/selectItemsDialog.xul', '', 'chrome,modal', io);

			if (io.dataOut && io.dataOut.length) {
				var selectedItemID = io.dataOut[0];
				var selectedItem = Zotero.Items.get(selectedItemID);
				// update item name
				row.item = selectedItem.getField("title");

				// Remove children
				let children = [];
				for (let childIndex = index + 1; childIndex < rows.current.length && getRowLevel(rows.current[childIndex]) > level; childIndex++) {
					children.push(rows.current[childIndex]);
				}
				removeRows(children.map((_, childIndex) => index + 1 + childIndex));
				
				if (row.parent.id != 'mapped') {
					// Move citation to mapped rows
					row.parent = rows.current[rowMap.current.mapped];
					removeRows(index);
					insertRows(row, rows.current.length);
				}

				// update array
				citationItemIDs.current[citation] = [selectedItemID];
			}
		}
		treeRef.current.invalidate();
		refreshCanAdvanceIfCitationsReady();
	}, [getRowLevel, insertRows, refreshCanAdvanceIfCitationsReady, removeRows]);

	const renderItem = useCallback((index, selection, oldDiv = null, columns) => {
		const row = rows.current[index];
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
				if (row.children || (rows.current[index + 1] && rows.current[index + 1].parent == row)) {
					twisty = getDOMElement("IconTwisty");
					twisty.classList.add('twisty');
					if (!row.collapsed) {
						twisty.classList.add('open');
					}
					twisty.style.pointerEvents = 'auto';
					twisty.addEventListener('mousedown', event => event.stopPropagation());
					twisty.addEventListener('mouseup', event => handleRowTwistyMouseUp(event, index),
						{ passive: true });
				}
				else {
					twisty = document.createElement('span');
					twisty.classList.add("spacer-twisty");
				}
				
				let textSpan = document.createElement('span');
				textSpan.className = "cell-text";
				textSpan.innerText = row[column.dataKey] || "";
				
				let span = document.createElement('span');
				span.className = `cell primary ${column.className}`;
				span.appendChild(twisty);
				span.appendChild(textSpan);
				span.style.paddingLeft = (5 + 20 * getRowLevel(row)) + 'px';
				div.appendChild(span);
			}
			else if (column.dataKey == 'action') {
				let span = document.createElement('span');
				span.className = `cell action ${column.className}`;
				if (row.parent) {
					if (row.action) {
						span.appendChild(getDOMElement('IconRTFScanAccept'));
					}
					else {
						span.appendChild(getDOMElement('IconRTFScanLink'));
					}
					span.addEventListener('mouseup', e => handleActionMouseUp(e, index), { passive: true });
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
	}, [getRowLevel, handleActionMouseUp, handleRowTwistyMouseUp]);

	const scanRTF = useCallback(async () => {
		// set up globals
		citations.current = [];
		citationItemIDs.current = {};
	
		let unmappedRow = rows.current[rowMap.current.unmapped];
		let ambiguousRow = rows.current[rowMap.current.ambiguous];
		let mappedRow = rows.current[rowMap.current.mapped];
		
		// set up regular expressions
		// this assumes that names are >=2 chars or only capital initials and that there are no
		// more than 4 names
		const nameRe = "(?:[^ .,;]{2,} |[A-Z].? ?){0,3}[A-Z][^ .,;]+";
		const creatorRe = '((?:(?:' + nameRe + ', )*' + nameRe + '(?:,? and|,? \\&|,) )?' + nameRe + ')(,? et al\\.?)?';
		// TODO: localize "and" term
		const creatorSplitRe = /(?:,| *(?:and|\&)) +/g;
		var citationRe = new RegExp('(\\\\\\{|; )(' + creatorRe + ',? (?:"([^"]+)(?:,"|",) )?([0-9]{4})[a-z]?)(?:,(?: pp?\.?)? ([^ )]+))?(?=;|\\\\\\})|(([A-Z][^ .,;]+)(,? et al\\.?)? (\\\\\\{([0-9]{4})[a-z]?\\\\\\}))', "gm");
		
		// read through RTF file and display items as they're found
		// we could read the file in chunks, but unless people start having memory issues, it's
		// probably faster and definitely simpler if we don't
		contents.current = Zotero.File.getContents(inputFile)
			.replace(/([^\\\r])\r?\n/, "$1 ")
			.replace("\\'92", "'", "g")
			.replace("\\rquote ", "’");
		var m;
		var lastCitation = false;
		while ((m = citationRe.exec(contents.current))) {
			// determine whether suppressed or standard regular expression was used
			if (m[2]) {	// standard parenthetical
				var citationString = m[2];
				var creators = m[3];
				var etAl = !!m[4];
				var title = m[5];
				var date = m[6];
				var pages = m[7];
				var start = citationRe.lastIndex - m[0].length;
				var end = citationRe.lastIndex + 2;
			}
			else {	// suppressed
				citationString = m[8];
				creators = m[9];
				etAl = !!m[10];
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
				lastCitation = { citationStrings: [citationString], pages: [pages],
					start, end, suppressAuthor };
				citations.current.push(lastCitation);
			}
			
			// only add each citation once
			if (citationItemIDs.current[citationString]) continue;
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
				var lastName = spaceIndex == -1 ? creators[i] : creators[i].substr(spaceIndex+1);
				s.addCondition("lastName", "contains", lastName);
			}
			if (title) s.addCondition("title", "contains", title);
			s.addCondition("date", "is", date);
			var ids = await s.search();
			Zotero.debug("Mapped to " + ids);
			citationItemIDs.current[citationString] = ids;
			
			if (!ids) {	// no mapping found
				let row = _generateItem(citationString, "");
				row.parent = unmappedRow;
				insertRows(row, rowMap.current.ambiguous);
			}
			else {	// some mapping found
				var items = await Zotero.Items.getAsync(ids);
				if (items.length > 1) {
					// check to see how well the author list matches the citation
					var matchedItems = [];
					for (let item of items) {
						await item.loadAllData();
						if (_matchesItemCreators(creators, item)) matchedItems.push(item);
					}
					
					if (matchedItems.length != 0) items = matchedItems;
				}
				
				if (items.length == 1) {	// only one mapping
					await items[0].loadAllData();
					let row = _generateItem(citationString, items[0].getField("title"));
					row.parent = mappedRow;
					insertRows(row, rows.current.length);
					citationItemIDs.current[citationString] = [items[0].id];
				}
				else {				// ambiguous mapping
					let row = _generateItem(citationString, "");
					row.parent = ambiguousRow;
					insertRows(row, rowMap.current.mapped);
					
					// generate child items
					let children = [];
					for (let item of items) {
						let childRow = _generateItem("", item.getField("title"), true);
						childRow.parent = row;
						children.push(childRow);
					}
					insertRows(children, rowMap.current[row.id] + 1);
				}
			}
		}
	}, [inputFile, insertRows, rowMap]);

	const formatRTF = useCallback(() => {
		// load style and create ItemSet with all items

		var zStyle = Zotero.Styles.get(styleConfig.style);
		var cslEngine = zStyle.getCiteProc(styleConfig.locale, 'rtf');
		var isNote = zStyle.class == "note";
		
		// create citations
		// var k = 0;
		var cslCitations = [];
		var itemIDs = {};
		// var shouldBeSubsequent = {};
		for (let i = 0; i < citations.current.length; i++) {
			let citation = citations.current[i];
			var cslCitation = { citationItems: [], properties: {} };
			if (isNote) {
				cslCitation.properties.noteIndex = i;
			}
			
			// create citation items
			for (var j = 0; j < citation.citationStrings.length; j++) {
				var citationItem = {};
				citationItem.id = citationItemIDs.current[citation.citationStrings[j]][0];
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
		for (let i = 0; i < citations.current.length; i++) {
			let citation = citationResults[i][2];
			Zotero.debug("Formatted " + citation);
			
			// if using notes, we might have to move the note after the punctuation
			if (isNote && citations.current[i].start != 0 && contents.current[citations.current[i].start - 1] == " ") {
				contentArray.push(contents.current.substring(lastEnd, citations.current[i].start - 1));
			}
			else {
				contentArray.push(contents.current.substring(lastEnd, citations.current[i].start));
			}
			
			lastEnd = citations.current[i].end;
			if (isNote && citations.current[i].end < contents.current.length && ".,!?".indexOf(contents.current[citations.current[i].end]) !== -1) {
				contentArray.push(contents.current[citations.current[i].end]);
				lastEnd++;
			}
			
			if (isNote) {
				if (styleConfig.displayAs === 'endnotes') {
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
		contentArray.push(contents.current.substring(lastEnd));
		contents.current = contentArray.join("");
		
		// add bibliography
		if (zStyle.hasBibliography) {
			var bibliography = Zotero.Cite.makeFormattedBibliography(cslEngine, "rtf");
			bibliography = bibliography.substring(5, bibliography.length - 1);
			// fix line breaks
			var linebreak = "\r\n";
			if (contents.current.indexOf("\r\n") == -1) {
				bibliography = bibliography.replace("\r\n", "\n", "g");
				linebreak = "\n";
			}
			
			if (contents.current.indexOf(BIBLIOGRAPHY_PLACEHOLDER) !== -1) {
				contents.current = contents.current.replace(BIBLIOGRAPHY_PLACEHOLDER, bibliography);
			}
			else {
				// add two newlines before bibliography
				bibliography = linebreak + "\\" + linebreak + "\\" + linebreak + bibliography;
				
				// add bibliography automatically inside last set of brackets closed
				const bracketRe = /^\{+/;
				var m = bracketRe.exec(contents.current);
				if (m) {
					var closeBracketRe = new RegExp("(\\}{" + m[0].length + "}\\s*)$");
					contents.current = contents.current.replace(closeBracketRe, bibliography + "$1");
				}
				else {
					contents.current += bibliography;
				}
			}
		}

		cslEngine.free();
		
		Zotero.File.putContents(outputFile, contents.current);
		
		// save locale
		if (!zStyle.locale && styleConfig.locale) {
			Zotero.Prefs.set("export.lastLocale", styleConfig.locale);
		}
	}, [outputFile, styleConfig]);

	const getRowCount = useCallback(() => rows.current.length, []);

	const handleChooseInputFile = useCallback(async (ev) => {
		if (ev.type === 'keydown' && ev.key !== 'Enter') {
			return;
		}
		ev.stopPropagation();
		const fp = new FilePicker();
		fp.init(window, Zotero.getString("rtfScan.openTitle"), fp.modeOpen);
		
		fp.appendFilters(fp.filterAll);
		fp.appendFilter(Zotero.getString("rtfScan.rtf"), "*.rtf");
		
		const rv = await fp.show();
		if (rv == fp.returnOK || rv == fp.returnReplace) {
			setInputFile(Zotero.File.pathToFile(fp.file));
			setCanAdvance(!!outputFile); //allow advance if output file also has been configured
		}
	}, [outputFile]);

	const handleChooseOutputFile = useCallback(async (ev) => {
		if (ev.type === 'keydown' && ev.key !== 'Enter') {
			return;
		}
		ev.stopPropagation();
		const fp = new FilePicker();
		fp.init(window, Zotero.getString("rtfScan.saveTitle"), fp.modeSave);
		fp.appendFilter(Zotero.getString("rtfScan.rtf"), "*.rtf");
		if (inputFile) {
			var leafName = inputFile.leafName;
			var dotIndex = leafName.lastIndexOf(".");
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
			setOutputFile(Zotero.File.pathToFile(fp.file));
			setCanAdvance(!!inputFile); //allow advance if input file also has been configured
		}
	}, [inputFile]);

	const handleClose = useCallback(() => {
		window.close();
	}, []);

	const handleIntroShow = useCallback(() => {
		setCanAdvance(true);
	}, []);

	const handleIntroPageAdvance = useCallback(() => {
		Zotero.Prefs.set("rtfScan.lastInputFile", inputFile.path);
		Zotero.Prefs.set("rtfScan.lastOutputFile", outputFile.path);
		return true;
	}, [inputFile, outputFile]);

	const handleScanPageShow = useCallback(async () => {
		setCanAdvance(false);
	
		try {
			await scanRTF();
			setCanAdvance(true);
			wizardRef.current.advance();
			treeRef.current.invalidate();
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug(e);
		}
	}, [scanRTF]);

	const handleCitationsPageRewound = useCallback(() => {
		rows.current = [...initialRows];
		rowMap.current = { ...initialRowMap };
		
		// skip back to intro page
		wizardRef.current.goTo('page-start');
		
		return false;
	}, []);

	const handleStyleConfigChange = useCallback((newStyleData) => {
		setStyleConfig(newStyleData);
	}, []);

	const handleStylePageAdvanced = useCallback(() => {
		Zotero.Prefs.set("export.lastStyle", styleConfig.style);
		return true;
	}, [styleConfig.style]);

	const handleFormatPageShow = useCallback(() => {
		setCanAdvance(false);

		window.setTimeout(() => {
			formatRTF();
			setCanAdvance(true);
			wizardRef.current.advance();
		}, 0);
	}, [formatRTF]);

	const handleCompletePageShow = useCallback(() => {
		setCanRewind(false);
	}, []);
	
	return (
		<Wizard
			canAdvance={ canAdvance }
			canCancel={ true }
			canRewind={ canRewind }
			className="rtfscan-wizard"
			onClose={ handleClose }
			ref={ wizardRef }
		>
			<WizardPage
				label={ Zotero.getString('rtfScan.introPage.label') }
				onPageShow={ handleIntroShow }
				onPageAdvance={ handleIntroPageAdvance }
				pageId="page-start"
			>
				<div>
					<span className="page-start-1">
						{ Zotero.getString('rtfScan.introPage.description') }
					</span>
					<span className="example">{ '{Smith, 2009}' }</span>
					<span className="example">{ 'Smith {2009}' }</span>
					<span className="example">{ '{Smith et al., 2009}' }</span>
					<span className="example">{ '{John Smith, 2009}' }</span>
					<span className="example">{ '{Smith, 2009, 10-14}' }</span>
					<span className="example">{ '{Smith, &quot;Title,&quot; 2009}' }</span>
					<span className="example">{ '{Jones, 2005; Smith, 2009}' }</span>
					<span className="page-start-2">
						{ Zotero.getString('rtfScan.introPage.description2') }
					</span>
				</div>
				<div>
					<label
						htmlFor={ htmlID.current + '-input-file' }
						className="file-input-label"
					>
						{ Zotero.getString('rtfScan.inputFile.label') }
					</label>
					<div className="file-input-container">
						<input
							className="file-path"
							id={ htmlID.current + '-input-file' }
							onKeyDown={ handleChooseInputFile }
							readOnly
							value={ inputFile ? inputFile.path : '' }
						/>
						<button
							id="choose-input-file"
							onClick={ handleChooseInputFile }
							onKeyDown={ stopPropagation }
						>
							{ Zotero.getString('file.choose.label') }
						</button>
					</div>
				</div>
				<div>
					<label
						htmlFor={ htmlID.current + '-output-file' }
						className="file-input-label"
					>
						{ Zotero.getString('rtfScan.outputFile.label') }
					</label>
					<div className="file-input-container">
						<input
							className="file-path"
							id={ htmlID.current + '-output-file' }
							onKeyDown={ handleChooseOutputFile }
							readOnly
							value={ outputFile ? outputFile.path : '' }
						/>
						<button
							id="choose-input-file"
							onClick={ handleChooseOutputFile }
							onKeyDown={ stopPropagation }
						>
							{ Zotero.getString('file.choose.label') }
						</button>
					</div>
				</div>
			</WizardPage>
			<WizardPage
				pageId="scan-page"
				label={ Zotero.getString('rtfScan.scanPage.label') }
				onPageShow={ handleScanPageShow }
			>
				<span>
					{ Zotero.getString('rtfScan.scanPage.description') }
				</span>
				<ProgressBar indeterminate />
			</WizardPage>
			<WizardPage
				className="citations-page"
				pageId="citations-page"
				label={ Zotero.getString('rtfScan.citationsPage.label') }
				onPageRewound={ handleCitationsPageRewound }
				onPageShow={ refreshCanAdvanceIfCitationsReady }
			>
				<span className="citations-page-description">
					{ Zotero.getString('rtfScan.citationsPage.description') }
				</span>
				<div className="table-container"> {/*flex="1" height="500" */}
					<IntlProvider locale={ Zotero.locale } messages={ Zotero.Intl.strings }>
						<VirtualizedTable
							columns={ columns }
							disableFontSizeScaling={ true }
							getRowCount={ getRowCount }
							id="rtfScan-table"
							ref={ treeRef }
							renderItem={ renderItem }
							showHeader={ true }
						/>
					</IntlProvider>
				</div>
			</WizardPage>
			<WizardPage
				pageId="style-page"
				label={ Zotero.getString('rtfScan.stylePage.label') }
				onPageAdvance={ handleStylePageAdvanced }
			>
				<StyleConfigurator onStyleConfigChange={ handleStyleConfigChange } />
			</WizardPage>
			<WizardPage
				pageId="format-page"
				label={ Zotero.getString('rtfScan.formatPage.label') }
				onPageShow={ handleFormatPageShow }
			>
				<span>{ Zotero.getString('rtfScan.formatPage.description') }</span>{/*width="700"*/}
				<ProgressBar indeterminate />
			</WizardPage>
			<WizardPage
				pageId="complete-page"
				onPageShow={ handleCompletePageShow }
				label={ Zotero.getString('rtfScan.completePage.label') }
			>
				<span>{ Zotero.getString('rtfScan.completePage.description') }</span>{/*width="700"*/}
			</WizardPage>
		</Wizard>
	);
});

RtfScan.init = (domEl, props = {}) => {
	ReactDOM.render(<RtfScan { ...props } />, domEl);
};

RtfScan.displayName = 'RtfScan';
Zotero.RtfScan = RtfScan;
