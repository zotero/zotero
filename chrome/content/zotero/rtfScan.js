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

/**
 * Front end for recognizing PDFs
 * @namespace
 */
var Zotero_RTFScan = new function() {
	const ACCEPT_ICON =  "chrome://zotero/skin/rtfscan-accept.png";
	const LINK_ICON = "chrome://zotero/skin/rtfscan-link.png";
	const BIBLIOGRAPHY_PLACEHOLDER = "\\{Bibliography\\}";
	
	var inputFile = null, outputFile = null;
	var unmappedCitationsItem, ambiguousCitationsItem, mappedCitationsItem;
	var unmappedCitationsChildren, ambiguousCitationsChildren, mappedCitationsChildren;
	var citations, citationItemIDs, allCitedItemIDs, contents;
	
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
	this.scanPageShowing = function() {
		// can't advance
		document.documentElement.canAdvance = false;
		
		// wait a ms so that UI thread gets updated
		window.setTimeout(function() { _scanRTF() }, 1);
	}
	
	/**
	 * Scans file for citations, then proceeds to next wizard page.
	 */
	var _scanRTF = Zotero.Promise.coroutine(function* () {
		// set up globals
		citations = [];
		citationItemIDs = {};
	
		unmappedCitationsItem = document.getElementById("unmapped-citations-item");
		ambiguousCitationsItem = document.getElementById("ambiguous-citations-item");
		mappedCitationsItem = document.getElementById("mapped-citations-item");
		unmappedCitationsChildren = document.getElementById("unmapped-citations-children");
		ambiguousCitationsChildren = document.getElementById("ambiguous-citations-children");
		mappedCitationsChildren = document.getElementById("mapped-citations-children");
		
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
		while((m = citationRe.exec(contents))) {
			// determine whether suppressed or standard regular expression was used
			if(m[2]) {	// standard parenthetical
				var citationString = m[2];
				var creators = m[3];
				var etAl = !!m[4];
				var title = m[5];
				var date = m[6];
				var pages = m[7];
				var start = citationRe.lastIndex-m[0].length;
				var end = citationRe.lastIndex+2;
			} else {	// suppressed
				var citationString = m[8];
				var creators = m[9];
				var etAl = !!m[10];
				var title = false;
				var date = m[12];
				var pages = false;
				var start = citationRe.lastIndex-m[11].length;
				var end = citationRe.lastIndex;
			}
			citationString = citationString.replace("\\{", "{", "g").replace("\\}", "}", "g");
			var suppressAuthor = !m[2];
			
			if(lastCitation && lastCitation.end >= start) {
				// if this citation is just an extension of the last, add items to it
				lastCitation.citationStrings.push(citationString);
				lastCitation.pages.push(pages);
				lastCitation.end = end;
			} else {
				// otherwise, add another citation
				var lastCitation = {"citationStrings":[citationString], "pages":[pages], "start":start,
					"end":end, "suppressAuthor":suppressAuthor};
				citations.push(lastCitation);
			}
			
			// only add each citation once
			if(citationItemIDs[citationString]) continue;
			Zotero.debug("Found citation "+citationString);
			
			// for each individual match, look for an item in the database
			var s = new Zotero.Search;
			creators = creators.replace(".", "");			
			// TODO: localize "et al." term
			creators = creators.split(creatorSplitRe);
			
			for(var i=0; i<creators.length; i++) {
				if(!creators[i]) {
					if(i == creators.length-1) {
						break;
					} else {
						creators.splice(i, 1);
					}
				}
				
				var spaceIndex = creators[i].lastIndexOf(" ");
				var lastName = spaceIndex == -1 ? creators[i] : creators[i].substr(spaceIndex+1);
				s.addCondition("lastName", "contains", lastName);
			}
			if(title) s.addCondition("title", "contains", title);
			s.addCondition("date", "is", date);
			var ids = yield s.search();
			Zotero.debug("Mapped to "+ids);
			citationItemIDs[citationString] = ids;
			
			if(!ids) {	// no mapping found
				unmappedCitationsChildren.appendChild(_generateItem(citationString, ""));
				unmappedCitationsItem.hidden = undefined;
			} else {	// some mapping found
				var items = yield Zotero.Items.getAsync(ids);
				if(items.length > 1) {
					// check to see how well the author list matches the citation
					var matchedItems = [];
					for(var i=0; i<items.length; i++) {
						yield items[i].loadDataType('creators');
						if(_matchesItemCreators(creators, items[i])) matchedItems.push(items[i]);
					}
					
					if(matchedItems.length != 0) items = matchedItems;
				}
				
				if(items.length == 1) {	// only one mapping					
					mappedCitationsChildren.appendChild(_generateItem(citationString, items[0].getField("title")));
					citationItemIDs[citationString] = [items[0].id];
					mappedCitationsItem.hidden = undefined;
				} else {				// ambiguous mapping
					var treeitem = _generateItem(citationString, "");
					
					// generate child items
					var treeitemChildren = document.createElement('treechildren');
					treeitem.appendChild(treeitemChildren);
					for(var i=0; i<items.length; i++) {
						treeitemChildren.appendChild(_generateItem("", items[i].getField("title"), true));
					}
					
					treeitem.setAttribute("container", "true");
					treeitem.setAttribute("open", "true");
					ambiguousCitationsChildren.appendChild(treeitem);
					ambiguousCitationsItem.hidden = undefined;
				}
			}
		}
		
		// when scanning is complete, go to citations page
		document.documentElement.canAdvance = true;
		document.documentElement.advance();
	});
	
	function _generateItem(citationString, itemName, accept) {
		var treeitem = document.createElement('treeitem');
		var treerow = document.createElement('treerow');
		
		var treecell = document.createElement('treecell');
		treecell.setAttribute("label", citationString);
		treerow.appendChild(treecell);
		
		var treecell = document.createElement('treecell');
		treecell.setAttribute("label", itemName);
		treerow.appendChild(treecell);
		
		var treecell = document.createElement('treecell');
		treecell.setAttribute("src", accept ? ACCEPT_ICON : LINK_ICON);
		treerow.appendChild(treecell);
		
		treeitem.appendChild(treerow);		
		return treeitem;
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
	this.citationsPageRewound = function() {
		// skip back to intro page
		document.documentElement.currentPage = document.getElementById('intro-page');
		
		// remove children from tree
		while(unmappedCitationsChildren.hasChildNodes()) {
			unmappedCitationsChildren.removeChild(unmappedCitationsChildren.firstChild);
		}
		while(ambiguousCitationsChildren.hasChildNodes()) {
			ambiguousCitationsChildren.removeChild(ambiguousCitationsChildren.firstChild);
		}
		while(mappedCitationsChildren.hasChildNodes()) {
			mappedCitationsChildren.removeChild(mappedCitationsChildren.firstChild);
		}
		// hide headings
		unmappedCitationsItem.hidden = ambiguousCitationsItem.hidden = mappedCitationsItem.hidden = true;
		
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
		if(col.value.index == 2 && level > 0) {
			var iconColumn = col.value;
			var itemNameColumn = iconColumn.getPrevious();
			var citationColumn = itemNameColumn.getPrevious();
			
			if(level == 2) {		// ambiguous citation item
				// get relevant information
				var parentIndex = tree.view.getParentIndex(row);
				var citation = tree.view.getCellText(parentIndex, citationColumn);
				var itemName = tree.view.getCellText(row, itemNameColumn);
				
				// update item name on parent and delete children
				tree.view.setCellText(parentIndex, itemNameColumn, itemName);
				var treeitem = tree.view.getItemAtIndex(row);
				treeitem.parentNode.parentNode.removeChild(treeitem.parentNode);
				
				// update array
				citationItemIDs[citation] = [citationItemIDs[citation][row-parentIndex-1]];
			} else {				// mapped or unmapped citation, or ambiguous citation parent
				var citation = tree.view.getCellText(row, citationColumn);
				var io = {singleSelection:true};
				if(citationItemIDs[citation] && citationItemIDs[citation].length == 1) {	// mapped citation
					// specify that item should be selected in window
					io.select = citationItemIDs[citation][0];
				}
				
				window.openDialog('chrome://zotero/content/selectItemsDialog.xul', '', 'chrome,modal', io);
				
				if(io.dataOut && io.dataOut.length) {
					var selectedItemID = io.dataOut[0];
					var selectedItem = Zotero.Items.get(selectedItemID);
					
					var treeitem = tree.view.getItemAtIndex(row);
					
					// remove any children (if ambiguous)
					var children = treeitem.getElementsByTagName("treechildren");
					if(children.length) treeitem.removeChild(children[0]);
					
					// update item name
					tree.view.setCellText(row, itemNameColumn, selectedItem.getField("title"));
					
					// update array
					citationItemIDs[citation] = [selectedItemID];
				}
			}
		}
		_refreshCanAdvance();
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
	this.stylePageShowing = function() {
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
}
