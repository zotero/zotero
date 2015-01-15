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

var Zotero_CSL_Editor = new function() {
	this.init = init;
	this.handleKeyPress = handleKeyPress;
	this.loadCSL = loadCSL;
	this.generateBibliography = generateBibliography;
	this.refresh = refresh;
	function init() {
		var cslList = document.getElementById('zotero-csl-list');
		if (cslList.getAttribute('initialized') == 'true') {
			if (currentStyle) {
				loadCSL(currentStyle);
				refresh();
			}
			return;
		}
		
		var rawDefaultStyle = Zotero.Prefs.get('export.quickCopy.setting');
		var defaultStyle = Zotero.QuickCopy.stripContentType(rawDefaultStyle);
		
		var styles = Zotero.Styles.getAll();
		var currentStyle = null;
		var listPos = 0;
		for each(var style in styles) {
			if (style.source) {
				continue;
			}
			var item = cslList.appendItem(style.title, style.styleID);
			if (!currentStyle || defaultStyle == ('bibliography=' + style.styleID)) {
				currentStyle = style.styleID;
				cslList.selectedIndex = listPos;
			}
			listPos += 1;
		}
		if (currentStyle) {
			loadCSL(currentStyle);
			refresh();
		}
		var pageList = document.getElementById('zotero-csl-page-type');
		var locators = Zotero.Cite.labels;
		for each(var type in locators) {
			var locator = type;
			locator = locator[0].toUpperCase()+locator.substr(1);
			pageList.appendItem(locator, type);
		}
		
		pageList.selectedIndex = 0;
		cslList.setAttribute('initialized', true);
	}
	function refresh() {
		var editor = document.getElementById('zotero-csl-editor');
		generateBibliography(editor.value);

	}
	this.save = function() {
		var editor = document.getElementById('zotero-csl-editor');
		var style = editor.value;
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
		fp.init(window, Zotero.getString('styles.editor.save'), nsIFilePicker.modeSave);
		fp.appendFilter("Citation Style Language", "*.csl");
		//get the filename from the id; we could consider doing even more here like creating the id from filename. 
		var parser = new DOMParser();
		var doc = parser.parseFromString(style, 'text/xml');
		var filename = doc.getElementsByTagName("id");
		if (filename) {
			filename = filename[0].textContent;
			fp.defaultString = filename.replace(/.+\//, "") + ".csl";
		}
		else {
			fp.defaultString = "untitled.csl";
		}
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {				
			var outputFile = fp.file;
			Zotero.File.putContents(outputFile, style);
		}
	};
	
	function handleKeyPress(event) {
		if (event.keyCode == 9 &&
				(!event.shiftKey && !event.metaKey && !event.altKey && !event.ctrlKey)) {
			_insertText("\t");
			event.preventDefault();
		}
	}
	
	
	function loadCSL(cslID) {
		var editor = document.getElementById('zotero-csl-editor');
		var style = Zotero.Styles.get(cslID);
		editor.value = Zotero.File.getContents(style.file);
		editor.cslID = cslID;
		editor.doCommand();
		document.getElementById('zotero-csl-list').value = cslID;
	}
	
	
	function generateBibliography(str) {
		var editor = document.getElementById('zotero-csl-editor')
		var iframe = document.getElementById('zotero-csl-preview-box');
		
		var items = Zotero.getActiveZoteroPane().getSelectedItems();
		if (items.length == 0) {
			iframe.contentDocument.documentElement.innerHTML = '<html><head><title></title></head><body><p style="color: red">' + Zotero.getString('styles.editor.warning.noItems') + '</p></body></html>';
			return;
		}
		var styleObject, styleEngine;
		try {
			styleObject = new Zotero.Style(str);
			styleEngine = styleObject.getCiteProc();
		} catch(e) {
			iframe.contentDocument.documentElement.innerHTML = '<div>' + Zotero.getString('styles.editor.warning.parseError') + '</div><div>'+e+'</div>';
			throw e;
		}
		
		var itemIds = [items[i].id for (i in items)];

		styleEngine.updateItems(itemIds);

		// Generate multiple citations
		var citation = {};
		citation.citationItems = [];
		citation.properties = {};
		citation.properties.noteIndex = 1;
		for (var i = 0, ilen = items.length; i < ilen; i += 1) {
			citation.citationItems.push({id:itemIds[i]});
		}

		// Generate single citations
		var author = document.getElementById("preview-suppress-author").checked;
		var search = document.getElementById('preview-pages');
		var loc = document.getElementById('zotero-csl-page-type');
		var pos = document.getElementById('zotero-ref-position').selectedItem.value;
		var citations = '<h3>' + Zotero.getString('styles.editor.output.individualCitations') + '</h3>';
		for (var i=0; i<citation.citationItems.length; i++) {
			citation.citationItems[i]['suppress-author'] = author;
			if (search.value !== '') {
				citation.citationItems[i].locator = search.value;
				citation.citationItems[i].label = loc.selectedItem.value;
			}
			if (pos == 4) {
				//near note is a subsequent citation with near note set to true;
				citation.citationItems[i].position = 1;
				citation.citationItems[i]["near-note"] = true;
			}
			else {
				citation.citationItems[i].position = parseInt(pos, 10);
			}
			var subcitation = [citation.citationItems[i]];
			citations += styleEngine.makeCitationCluster(subcitation) + '<br />';
		}
		
		try {
			var multCitations = '<hr><h3>' + Zotero.getString('styles.editor.output.singleCitation') + '</h3>' +
				styleEngine.previewCitationCluster(citation, [], [], "html");

			// Generate bibliography
			styleEngine.updateItems(itemIds);
			var bibliography = '<hr/><h3>' + Zotero.getString('styles.bibliography') + '</h3>' + 
				Zotero.Cite.makeFormattedBibliography(styleEngine, "html");

			iframe.contentDocument.documentElement.innerHTML = 
				'<div>' + citations + multCitations + bibliography + '</div>';
		} catch(e) {
				iframe.contentDocument.documentElement.innerHTML = '<div>' + Zotero.getString('styles.editor.warning.renderError') + '</div><div>'+e+'</div>';
				throw e;
		}
	}
	
	
	// From http://kb.mozillazine.org/Inserting_text_at_cursor
	function _insertText(text) {
		var command = "cmd_insertText";
		var controller = document.commandDispatcher.getControllerForCommand(command);
		if (controller && controller.isCommandEnabled(command)) {
			controller = controller.QueryInterface(Components.interfaces.nsICommandController);
			var params = Components.classes["@mozilla.org/embedcomp/command-params;1"];
			params = params.createInstance(Components.interfaces.nsICommandParams);
			params.setStringValue("state_data", "\t");
			controller.doCommandWithParams(command, params);
		}
	}
}();
