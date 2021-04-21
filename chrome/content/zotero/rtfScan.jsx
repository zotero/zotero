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

/**
 * @fileOverview Tools for automatically retrieving a citation for the given PDF
 */

import FilePicker from 'zotero/filePicker';
import React from 'react';
import ReactDOM from 'react-dom';
import VirtualizedTable from 'components/virtualized-table';
import { IntlProvider } from 'react-intl';
import { getDOMElement } from 'components/icons';

/**
 * Front end for recognizing PDFs
 * @namespace
 */
var Zotero_RTFScan = new function() {
	const ACCEPT_ICON =  "chrome://zotero/skin/rtfscan-accept.png";
	const LINK_ICON = "chrome://zotero/skin/rtfscan-link.png";
	const BIBLIOGRAPHY_PLACEHOLDER = "\\{Bibliography\\}";

	const columns = [
		{ dataKey: 'rtf', label: "zotero.rtfScan.citation.label", primary: true, flex: 4 },
		{ dataKey: 'item', label: "zotero.rtfScan.itemName.label", flex: 5 },
		{ dataKey: 'action', label: "", fixedWidth: true, width: "26px" },
	];
	var ids = 0;
	var tree;
	this._rows = [
		{ id: 'unmapped', rtf: Zotero.Intl.strings['zotero.rtfScan.unmappedCitations.label'], collapsed: false },
		{ id: 'ambiguous', rtf: Zotero.Intl.strings['zotero.rtfScan.ambiguousCitations.label'], collapsed: false },
		{ id: 'mapped', rtf: Zotero.Intl.strings['zotero.rtfScan.mappedCitations.label'], collapsed: false },
	];
	this._rowMap = {};
	this._rows.forEach((row, index) => this._rowMap[row.id] = index);

	var inputFile = null, outputFile = null;
	var citations, citationItemIDs, contents;
	
	/** INTRO PAGE UI **/
	
	/**
	 * Called when the first page is shown; loads target file from preference, if one is set
	 */
	this.introPageShowing = function() {
		var path = Zotero.Prefs.get("rtfScan.lastInputFile");
		if(path) {
			inputFile = Zotero.File.pathToFile(path);
		}
		var path = Zotero.Prefs.get("rtfScan.lastOutputFile");
		if(path) {
			outputFile = Zotero.File.pathToFile(path);
		}
		_updatePath();
		document.getElementById("choose-input-file").focus();
	}
	
	/**
	 * Called when the first page is hidden
	 */
	this.introPageAdvanced = function() {
		Zotero.Prefs.set("rtfScan.lastInputFile", inputFile.path);
		Zotero.Prefs.set("rtfScan.lastOutputFile", outputFile.path);
	}
	
	/**
	 * Called to select the file to be processed
	 */
	this.chooseInputFile = async function () {
		// display file picker
		var fp = new FilePicker();
		fp.init(window, Zotero.getString("rtfScan.openTitle"), fp.modeOpen);
		
		fp.appendFilters(fp.filterAll);
		fp.appendFilter(Zotero.getString("rtfScan.rtf"), "*.rtf");
		
		var rv = await fp.show();
		if (rv == fp.returnOK || rv == fp.returnReplace) {
			inputFile = Zotero.File.pathToFile(fp.file);
			_updatePath();
		}
	}
	
	/**
	 * Called to select the output file
	 */
	this.chooseOutputFile = async function () {
		var fp = new FilePicker();
		fp.init(window, Zotero.getString("rtfScan.saveTitle"), fp.modeSave);
		fp.appendFilter(Zotero.getString("rtfScan.rtf"), "*.rtf");
		if(inputFile) {
			var leafName = inputFile.leafName;
			var dotIndex = leafName.lastIndexOf(".");
			if(dotIndex != -1) {
				leafName = leafName.substr(0, dotIndex);
			}
			fp.defaultString = leafName+" "+Zotero.getString("rtfScan.scannedFileSuffix")+".rtf";
		} else {
			fp.defaultString = "Untitled.rtf";
		}
		
		var rv = await fp.show();
		if (rv == fp.returnOK || rv == fp.returnReplace) {
			outputFile = Zotero.File.pathToFile(fp.file);
			_updatePath();
		}
	}
	
	/**
	 * Called to update the path label in the dialog box
	 * @private
	 */
	function _updatePath() {
		document.documentElement.canAdvance = inputFile && outputFile;
		if(inputFile) document.getElementById("input-path").value = inputFile.path;
		if(outputFile) document.getElementById("output-path").value = outputFile.path;
	}
	
	/** SCAN PAGE UI **/
	
	/**
	 * Called when second page is shown.
	 */
	this.scanPageShowing = async function () {
		// can't advance
		document.documentElement.canAdvance = false;
		
		// wait a ms so that UI thread gets updated
		try {
			await this._scanRTF();
		}
		catch (e) {
			Zotero.logError(e);
			Zotero.debug(e);
		}
	};
	
	/**
	 * Scans file for citations, then proceeds to next wizard page.
	 */
	this._scanRTF = async () => {
		// set up globals
		citations = [];
		citationItemIDs = {};
	
		let unmappedRow = this._rows[this._rowMap['unmapped']];
		let ambiguousRow = this._rows[this._rowMap['ambiguous']];
		let mappedRow = this._rows[this._rowMap['mapped']];
		
		// set up regular expressions
		// this assumes that names are >=2 chars or only capital initials and that there are no
		// more than 4 names
		const nameRe = "(?:[^ .,;]{2,} |[A-Z].? ?){0,3}[A-Z][^ .,;]+";
		const creatorRe = '((?:(?:'+nameRe+', )*'+nameRe+'(?:,? and|,? \\&|,) )?'+nameRe+')(,? et al\\.?)?';
		// TODO: localize "and" term
		const creatorSplitRe = /(?:,| *(?:and|\&)) +/g;
		var citationRe = new RegExp('(\\\\\\{|; )('+creatorRe+',? (?:"([^"]+)(?:,"|",) )?([0-9]{4})[a-z]?)(?:,(?: pp?\.?)? ([^ )]+))?(?=;|\\\\\\})|(([A-Z][^ .,;]+)(,? et al\\.?)? (\\\\\\{([0-9]{4})[a-z]?\\\\\\}))', "gm");
		
		// read through RTF file and display items as they're found
		// we could read the file in chunks, but unless people start having memory issues, it's
		// probably faster and definitely simpler if we don't
		contents = Zotero.File.getContents(inputFile).replace(/([^\\\r])\r?\n/, "$1 ").replace("\\'92", "'", "g").replace("\\rquote ", "’");
		var m;
		var lastCitation = false;
		while ((m = citationRe.exec(contents))) {
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
				citations.push(lastCitation);
			}
			
			// only add each citation once
			if (citationItemIDs[citationString]) continue;
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
			citationItemIDs[citationString] = ids;
			
			if (!ids) {	// no mapping found
				let row = _generateItem(citationString, "");
				row.parent = unmappedRow;
				this._insertRows(row, this._rowMap.ambiguous);
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
					this._insertRows(row, this._rows.length);
					citationItemIDs[citationString] = [items[0].id];
				}
				else {				// ambiguous mapping
					let row = _generateItem(citationString, "");
					row.parent = ambiguousRow;
					this._insertRows(row, this._rowMap.mapped);
					
					// generate child items
					let children = [];
					for (let item of items) {
						let childRow = _generateItem("", item.getField("title"), true);
						childRow.parent = row;
						children.push(childRow);
					}
					this._insertRows(children, this._rowMap[row.id] + 1);
				}
			}
		}
		tree.invalidate();
		
		// when scanning is complete, go to citations page
		document.documentElement.canAdvance = true;
		document.documentElement.advance();
	};
	
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
		for(var i=0; i<itemCreators.length; i++) {
			if(itemCreators[i].creatorTypeID == primaryCreatorTypeID) {
				primaryCreators.push(itemCreators[i]);
			}
		}
		// if primaryCreators matches the creator list length, or if et al is being used, use only
		// primary creators
		if(primaryCreators.length == creators.length || etAl) itemCreators = primaryCreators;
		
		// for us to have an exact match, either the citation creator list length has to match the
		// item creator list length, or et al has to be used
		if(itemCreators.length == creators.length || (etAl && itemCreators.length > creators.length)) {
			var matched = true;
			for(var i=0; i<creators.length; i++) {
				// check each item creator to see if it matches
				matched = matched && _matchesItemCreator(creators[i], itemCreators[i]);
				if(!matched) break;
			}
			return matched;
		}
		
		return false;
	}
	
	function _matchesItemCreator(creator, itemCreator) {
		// make sure last name matches
		var lowerLast = itemCreator.lastName.toLowerCase();
		if(lowerLast != creator.substr(-lowerLast.length).toLowerCase()) return false;
		
		// make sure first name matches, if it exists
		if(creator.length > lowerLast.length) {
			var firstName = Zotero.Utilities.trim(creator.substr(0, creator.length-lowerLast.length));
			if(firstName.length) {
				// check to see whether the first name is all initials
				const initialRe = /^(?:[A-Z]\.? ?)+$/;
				var m = initialRe.exec(firstName);
				if(m) {
					var initials = firstName.replace(/[^A-Z]/g, "");
					var itemInitials = itemCreator.firstName.split(/ +/g)
						.map(name => name[0].toUpperCase())
						.join("");
					if(initials != itemInitials) return false;
				} else {
					// not all initials; verify that the first name matches
					var firstWord = firstName.substr(0, itemCreator.firstName).toLowerCase();
					var itemFirstWord = itemCreator.firstName.substr(0, itemCreator.firstName.indexOf(" ")).toLowerCase();
					if(firstWord != itemFirstWord) return false;
				}
			}
		}
		
		return true;
	}
	
	/** CITATIONS PAGE UI **/
	
	/**
	 * Called when citations page is shown to determine whether user can immediately advance.
	 */
	this.citationsPageShowing = function() {
		_refreshCanAdvance();
	}
	
	/** 
	 * Called when the citations page is rewound. Removes all citations from the list, clears
	 * globals, and returns to intro page.
	 */
	this.citationsPageRewound = function () {
		// skip back to intro page
		document.documentElement.currentPage = document.getElementById('intro-page');
		
		this._rows = [
			{ id: 'unmapped', rtf: Zotero.Intl.strings['zotero.rtfScan.unmappedCitations.label'], collapsed: false },
			{ id: 'ambiguous', rtf: Zotero.Intl.strings['zotero.rtfScan.ambiguousCitations.label'], collapsed: false },
			{ id: 'mapped', rtf: Zotero.Intl.strings['zotero.rtfScan.mappedCitations.label'], collapsed: false },
		];
		this._rowMap = {};
		this._rows.forEach((row, index) => this._rowMap[row.id] = index);
		
		return false;
	}
	
	/**
	 * Called when a tree item is clicked to remap a citation, or accept a suggestion for an
	 * ambiguous citation
	 */
	this.treeClick = function(event) {
		var tree = document.getElementById("tree");
		
		// get clicked cell
		var row = { }, col = { }, child = { };
		tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, child);
		
		// figure out which item this corresponds to
		row = row.value;
		var level = tree.view.getLevel(row);
		
	}
	
	/**
	 * Determines whether the button to advance the wizard should be enabled or not based on whether
	 * unmapped citations exist, and sets the status appropriately
	 */
	function _refreshCanAdvance() {
		var canAdvance = true;
		for (let i in citationItemIDs) {
			let itemList = citationItemIDs[i];
			if(itemList.length != 1) {
				canAdvance = false;
				break;
			}
		}
		
		document.documentElement.canAdvance = canAdvance;
	}
	
	/** STYLE PAGE UI **/
	
	/**
	 * Called when style page is shown to add styles to listbox.
	 */
	this.stylePageShowing = async function() {
		await Zotero.Styles.init();
		Zotero_File_Interface_Bibliography.init({
			supportedNotes: ['footnotes', 'endnotes']
		});
	}
	
	/**
	 * Called when style page is hidden to save preferences.
	 */
	this.stylePageAdvanced = function() {
		Zotero.Prefs.set("export.lastStyle", document.getElementById("style-listbox").selectedItem.value);
	}
	
	/** FORMAT PAGE UI **/
	
	this.formatPageShowing = function() {
		// can't advance
		document.documentElement.canAdvance = false;
		
		// wait a ms so that UI thread gets updated
		window.setTimeout(function() { _formatRTF() }, 1);
	}
	
	function _formatRTF() {
		// load style and create ItemSet with all items
		var zStyle = Zotero.Styles.get(document.getElementById("style-listbox").value)
		var locale = document.getElementById("locale-menu").value;
		var style = zStyle.getCiteProc(locale);
		style.setOutputFormat("rtf");
		var isNote = zStyle.class == "note";
		
		// create citations
		var k = 0;
		var cslCitations = [];
		var itemIDs = {};
		var shouldBeSubsequent = {};
		for(var i=0; i<citations.length; i++) {
			var citation = citations[i];
			var cslCitation = {"citationItems":[], "properties":{}};
			if(isNote) {
				cslCitation.properties.noteIndex = i;
			}
			
			// create citation items
			for(var j=0; j<citation.citationStrings.length; j++) {
				var citationItem = {};
				citationItem.id = citationItemIDs[citation.citationStrings[j]][0];
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
		var citationResults = style.rebuildProcessorState(cslCitations, "rtf");
		
		// format citations
		var contentArray = [];
		var lastEnd = 0;
		for(var i=0; i<citations.length; i++) {
			var citation = citationResults[i][2];
			Zotero.debug("Formatted "+citation);
			
			// if using notes, we might have to move the note after the punctuation
			if(isNote && citations[i].start != 0 && contents[citations[i].start-1] == " ") {
				contentArray.push(contents.substring(lastEnd, citations[i].start-1));
			} else {
				contentArray.push(contents.substring(lastEnd, citations[i].start));
			}
			
			lastEnd = citations[i].end;
			if(isNote && citations[i].end < contents.length && ".,!?".indexOf(contents[citations[i].end]) !== -1) {
				contentArray.push(contents[citations[i].end]);
				lastEnd++;
			}
			
			if(isNote) {
				if(document.getElementById("displayAs").selectedIndex) {	// endnotes
					contentArray.push("{\\super\\chftn}\\ftnbj {\\footnote\\ftnalt {\\super\\chftn } "+citation+"}");
				} else {													// footnotes
					contentArray.push("{\\super\\chftn}\\ftnbj {\\footnote {\\super\\chftn } "+citation+"}");
				}
			} else {
				contentArray.push(citation);
			}
		}
		contentArray.push(contents.substring(lastEnd));
		contents = contentArray.join("");
		
		// add bibliography
		if(zStyle.hasBibliography) {
			var bibliography = Zotero.Cite.makeFormattedBibliography(style, "rtf");
			bibliography = bibliography.substring(5, bibliography.length-1);
			// fix line breaks
			var linebreak = "\r\n";
			if(contents.indexOf("\r\n") == -1) {
				bibliography = bibliography.replace("\r\n", "\n", "g");
				linebreak = "\n";
			}
			
			if(contents.indexOf(BIBLIOGRAPHY_PLACEHOLDER) !== -1) {
				contents = contents.replace(BIBLIOGRAPHY_PLACEHOLDER, bibliography);
			} else {
				// add two newlines before bibliography
				bibliography = linebreak+"\\"+linebreak+"\\"+linebreak+bibliography;
				
				// add bibliography automatically inside last set of brackets closed
				const bracketRe = /^\{+/;
				var m = bracketRe.exec(contents);
				if(m) {
					var closeBracketRe = new RegExp("(\\}{"+m[0].length+"}\\s*)$");
					contents = contents.replace(closeBracketRe, bibliography+"$1");
				} else {
					contents += bibliography;
				}
			}
		}
		
		Zotero.File.putContents(outputFile, contents);
		
		// save locale
		if (!document.getElementById("locale-menu").disabled) {
			Zotero.Prefs.set("export.lastLocale", locale);
		}
		
		document.documentElement.canAdvance = true;
		document.documentElement.advance();
	}
	
	this._onTwistyMouseUp = (event, index) => {
		const row = this._rows[index];
		if (!row.collapsed) {
			// Store children rows on the parent when collapsing
			row.children = [];
			const depth = this._getRowLevel(index);
			for (let childIndex = index + 1; childIndex < this._rows.length && this._getRowLevel(this._rows[childIndex]) > depth; childIndex++) {
				row.children.push(this._rows[childIndex]);
			}
			// And then remove them
			this._removeRows(row.children.map((_, childIndex) => index + 1 + childIndex));
		}
		else {
			// Insert children rows from the ones stored on the parent
			this._insertRows(row.children, index + 1);
			delete row.children;
		}
		row.collapsed = !row.collapsed;
		tree.invalidate();
	};
	
	this._onActionMouseUp = (event, index) => {
		let row = this._rows[index];
		if (!row.parent) return;
		let level = this._getRowLevel(row);
		if (level == 2) {		// ambiguous citation item
			let parentIndex = this._rowMap[row.parent.id];
			// Update parent item
			row.parent.item = row.item;
			
			// Remove children
			let children = [];
			for (let childIndex = parentIndex + 1; childIndex < this._rows.length && this._getRowLevel(this._rows[childIndex]) >= level; childIndex++) {
				children.push(this._rows[childIndex]);
			}
			this._removeRows(children.map((_, childIndex) => parentIndex + 1 + childIndex));

			// Move citation to mapped rows
			row.parent.parent = this._rows[this._rowMap.mapped];
			this._removeRows(parentIndex);
			this._insertRows(row.parent, this._rows.length);

			// update array
			citationItemIDs[row.parent.rtf] = [citationItemIDs[row.parent.rtf][index-parentIndex-1]];
		}
		else {				// mapped or unmapped citation, or ambiguous citation parent
			var citation = row.rtf;
			var io = { singleSelection: true };
			if (citationItemIDs[citation] && citationItemIDs[citation].length == 1) {	// mapped citation
				// specify that item should be selected in window
				io.select = citationItemIDs[citation][0];
			}

			window.openDialog('chrome://zotero/content/selectItemsDialog.xul', '', 'chrome,modal', io);

			if (io.dataOut && io.dataOut.length) {
				var selectedItemID = io.dataOut[0];
				var selectedItem = Zotero.Items.get(selectedItemID);
				// update item name
				row.item = selectedItem.getField("title");

				// Remove children
				let children = [];
				for (let childIndex = index + 1; childIndex < this._rows.length && this._getRowLevel(this._rows[childIndex]) > level; childIndex++) {
					children.push(this._rows[childIndex]);
				}
				this._removeRows(children.map((_, childIndex) => index + 1 + childIndex));
				
				if (row.parent.id != 'mapped') {
					// Move citation to mapped rows
					row.parent = this._rows[this._rowMap.mapped];
					this._removeRows(index);
					this._insertRows(row, this._rows.length);
				}

				// update array
				citationItemIDs[citation] = [selectedItemID];
			}
		}
		tree.invalidate();
		_refreshCanAdvance();
	};
	
	this._insertRows = (rows, beforeRow) => {
		if (!Array.isArray(rows)) {
			rows = [rows];
		}
		this._rows.splice(beforeRow, 0, ...rows);
		rows.forEach(row => row.id = ids++);
		for (let row of rows) {
			row.id = ids++;
		}
		// Refresh the row map
		this._rowMap = {};
		this._rows.forEach((row, index) => this._rowMap[row.id] = index);
	};
	
	this._removeRows = (indices) => {
		if (!Array.isArray(indices)) {
			indices = [indices];
		}
		// Reverse sort so we can safely splice out the entries from the rows array
		indices.sort((a, b) => b - a);
		for (const index of indices) {
			this._rows.splice(index, 1);
		}
		// Refresh the row map
		this._rowMap = {};
		this._rows.forEach((row, index) => this._rowMap[row.id] = index);
	};
	
	this._getRowLevel = (row, depth=0) => {
		if (typeof row == 'number') {
			row = this._rows[row];
		}
		if (!row.parent) {
			return depth;
		}
		return this._getRowLevel(row.parent, depth+1);
	}
	
	this._renderItem = (index, selection, oldDiv=null, columns) => {
		const row = this._rows[index];
		let div;
		if (oldDiv) {
			div = oldDiv;
			div.innerHTML = "";
		}
		else {
			div = document.createElementNS("http://www.w3.org/1999/xhtml", 'div');
			div.className = "row";
		}

		for (const column of columns) {
			if (column.primary) {
				let twisty;
				if (row.children || (this._rows[index + 1] && this._rows[index + 1].parent == row)) {
					twisty = getDOMElement("IconTwisty");
					twisty.classList.add('twisty');
					if (!row.collapsed) {
						twisty.classList.add('open');
					}
					twisty.style.pointerEvents = 'auto';
					twisty.addEventListener('mousedown', event => event.stopPropagation());
					twisty.addEventListener('mouseup', event => this._onTwistyMouseUp(event, index),
						{ passive: true });
				}
				else {
					twisty = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
					twisty.classList.add("spacer-twisty");
				}
				
				let textSpan = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
				textSpan.className = "cell-text";
				textSpan.innerText = row[column.dataKey] || "";
				
				let span = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
				span.className = `cell primary ${column.className}`;
				span.appendChild(twisty);
				span.appendChild(textSpan);
				span.style.paddingLeft = (5 + 20 * this._getRowLevel(row)) + 'px';
				div.appendChild(span);
			}
			else if (column.dataKey == 'action') {
				let span = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
				span.className = `cell action ${column.className}`;
				if (row.parent) {
					if (row.action) {
						span.appendChild(getDOMElement('IconRTFScanAccept'));
					}
					else {
						span.appendChild(getDOMElement('IconRTFScanLink'));
					}
					span.addEventListener('mouseup', e => this._onActionMouseUp(e, index), { passive: true });
					span.style.pointerEvents = 'auto';
				}
				
				div.appendChild(span);
			}
			else {
				let span = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
				span.className = `cell ${column.className}`;
				span.innerText = row[column.dataKey] || "";
				div.appendChild(span);
			}
		}
		return div;
	};
	
	this._initCitationTree = function () {
		const domEl = document.querySelector('#tree');
		const elem = (
			<IntlProvider locale={Zotero.locale} messages={Zotero.Intl.strings}>
				<VirtualizedTable
					getRowCount={() => this._rows.length}
					id="rtfScan-table"
					ref={ref => tree = ref}
					renderItem={this._renderItem}
					showHeader={true}
					columns={columns}
				/>
			</IntlProvider>
		);
		return new Promise(resolve => ReactDOM.render(elem, domEl, resolve));
	};
}
