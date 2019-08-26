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

import FilePicker from 'zotero/filePicker';

Zotero_Preferences.Cite = {
	wordPluginIDs: new Set([
		'zoteroOpenOfficeIntegration@zotero.org',
		'zoteroMacWordIntegration@zotero.org',
		'zoteroWinWordIntegration@zotero.org'
	]),

	init: Zotero.Promise.coroutine(function* () {
		Components.utils.import("resource://gre/modules/AddonManager.jsm");
		this.updateWordProcessorInstructions();
		yield this.refreshStylesList();
	}),
	
	
	/**
	 * Determines if any word processors are disabled and if so, shows a message in the pref pane
	 */
	updateWordProcessorInstructions: async function () {
		var someDisabled = false;
		await new Promise(function(resolve) {
			AddonManager.getAllAddons(function(addons) {
				for (let addon of addons) {
					if (Zotero_Preferences.Cite.wordPluginIDs.has(addon.id) && addon.userDisabled) {
						someDisabled = true;
					}
				}
				resolve();
			});
		});
		if (someDisabled) {
			document.getElementById("wordProcessors-somePluginsDisabled").hidden = undefined;
		}
	},
	
	enableWordPlugins: function () {
		AddonManager.getAllAddons(function(addons) {
			for (let addon of addons) {
				if (Zotero_Preferences.Cite.wordPluginIDs.has(addon.id) && addon.userDisabled) {
					addon.userDisabled = false;
				}
			}
			return Zotero.Utilities.Internal.quit(true);
		});
	},
	
	
	/**
	 * Refreshes the list of styles in the styles pane
	 * @param {String} cslID Style to select
	 * @return {Promise}
	 */
	refreshStylesList: Zotero.Promise.coroutine(function* (cslID) {
		Zotero.debug("Refreshing styles list");
		
		var treechildren = document.getElementById('styleManager-rows');
		while (treechildren.hasChildNodes()) {
			treechildren.removeChild(treechildren.firstChild);
		}
		
		yield Zotero.Styles.init();
		var styles = Zotero.Styles.getVisible();
		var selectIndex = false;
		styles.forEach(function (style, i) {
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
		});
	}),
	
	
	openStylesPage: function () {
		Zotero.openInViewer("https://www.zotero.org/styles/", function (doc) {
			// Hide header, intro paragraph, Link, and Source
			//
			// (The first two aren't sent to the client normally, but hide anyway in case they are.)
			var style = doc.createElement('style');
			style.type = 'text/css';
			style.innerHTML = 'h1, #intro, .style-individual-link, .style-view-source { display: none !important; }'
				// TEMP: Default UA styles that aren't being included in Firefox 60 for some reason
				+ 'html { background: #fff; }'
				+ 'a { color: rgb(0, 0, 238) !important; text-decoration: underline; }'
				+ 'a:active { color: rgb(238, 0, 0) !important; }';
			doc.getElementsByTagName('head')[0].appendChild(style);
		});
	},
	
	
	/**
	 * Adds a new style to the style pane
	 **/
	addStyle: async function () {
		var fp = new FilePicker();
		fp.init(window, Zotero.getString("zotero.preferences.styles.addStyle"), fp.modeOpen);
		
		fp.appendFilter("CSL Style", "*.csl");
		
		var rv = await fp.show();
		if (rv == fp.returnOK || rv == fp.returnReplace) {
			try {
				await Zotero.Styles.install(
					{
						file: Zotero.File.pathToFile(fp.file)
					},
					fp.file,
					true
				);
			}
			catch (e) {
				(new Zotero.Exception.Alert("styles.install.unexpectedError",
					fp.file, "styles.install.title", e)).present()
			}
		}
	},
	
	
	/**
	 * Deletes selected styles from the styles pane
	 **/
	deleteStyle: Zotero.Promise.coroutine(function* () {
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
				yield selectedStyle.remove();
			} else {
				for(var i=0; i<cslIDs.length; i++) {
					yield Zotero.Styles.get(cslIDs[i]).remove();
				}
			}
			
			yield this.refreshStylesList();
			document.getElementById('styleManager-delete').disabled = true;
		}
	}),
	
	
	/**
	 * Shows an error if import fails
	 **/
	styleImportError: function () {
		alert(Zotero.getString('styles.installError', "This"));
	}
}
