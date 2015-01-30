/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2006–2013 Center for History and New Media
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

"use strict";

Zotero_Preferences.Cite = {
	init: function () {
		this.updateWordProcessorInstructions();
		this.refreshStylesList();
	},
	
	
	/**
	 * Determines if there are word processors, and if not, enables no word processor message
	 */
	updateWordProcessorInstructions: function () {
		if(document.getElementById("wordProcessors").childNodes.length == 2) {
			document.getElementById("wordProcessors-noWordProcessorPluginsInstalled").hidden = undefined;
		}
		if(Zotero.isStandalone) {
			document.getElementById("wordProcessors-getWordProcessorPlugins").hidden = true;
		}
	},
	
	
	/**
	 * Refreshes the list of styles in the styles pane
	 * @param {String} cslID Style to select
	 */
	refreshStylesList: function (cslID) {
		Zotero.debug("Refreshing styles list");
		
		var treechildren = document.getElementById('styleManager-rows');
		while (treechildren.hasChildNodes()) {
			treechildren.removeChild(treechildren.firstChild);
		}
		
		var styles = Zotero.Styles.getVisible();
		
		var selectIndex = false;
		var i = 0;
		for each(var style in styles) {
			var treeitem = document.createElement('treeitem');
			var treerow = document.createElement('treerow');
			var titleCell = document.createElement('treecell');
			var updatedCell = document.createElement('treecell');
			
			if (style.updated) {
				var updatedDate = Zotero.Date.formatDate(Zotero.Date.strToDate(style.updated), true);
			}
			else {
				var updatedDate = '';
			}
			
			treeitem.setAttribute('id', 'zotero-csl-' + style.styleID);
			titleCell.setAttribute('label', style.title);
			updatedCell.setAttribute('label', updatedDate);
			
			treerow.appendChild(titleCell);
			treerow.appendChild(updatedCell);
			treeitem.appendChild(treerow);
			treechildren.appendChild(treeitem);
			
			if (cslID == style.styleID) {
				document.getElementById('styleManager').view.selection.select(i);
			}
			i++;
		}
	},
	
	
	/**
	 * Adds a new style to the style pane
	 **/
	addStyle: function () {	
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
				.createInstance(nsIFilePicker);
		fp.init(window, Zotero.getString("zotero.preferences.styles.addStyle"), nsIFilePicker.modeOpen);
		
		fp.appendFilter("CSL Style", "*.csl");
		
		var rv = fp.show();
		if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
			Zotero.Styles.install(fp.file);
		}
	},
	
	
	/**
	 * Deletes selected styles from the styles pane
	 **/
	deleteStyle: function () {
		// get selected cslIDs
		var tree = document.getElementById('styleManager');
		var treeItems = tree.lastChild.childNodes;
		var cslIDs = [];
		var start = {};
		var end = {};
		var nRanges = tree.view.selection.getRangeCount();
		for(var i=0; i<nRanges; i++) {
			tree.view.selection.getRangeAt(i, start, end);
			for(var j=start.value; j<=end.value; j++) {
				cslIDs.push(treeItems[j].getAttribute('id').substr(11));
			}
		}
		
		if(cslIDs.length == 0) {
			return;
		} else if(cslIDs.length == 1) {
			var selectedStyle = Zotero.Styles.get(cslIDs[0])
			var text = Zotero.getString('styles.deleteStyle', selectedStyle.title);
		} else {
			var text = Zotero.getString('styles.deleteStyles');
		}
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
		if(ps.confirm(null, '', text)) {
			// delete if requested
			if(cslIDs.length == 1) {
				selectedStyle.remove();
			} else {
				for(var i=0; i<cslIDs.length; i++) {
					Zotero.Styles.get(cslIDs[i]).remove();
				}
			}
			
			this.refreshStylesList();
			document.getElementById('styleManager-delete').disabled = true;
		}
	},
	
	
	/**
	 * Shows an error if import fails
	 **/
	styleImportError: function () {
		alert(Zotero.getString('styles.installError', "This"));
	}
}
