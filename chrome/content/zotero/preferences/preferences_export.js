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

Zotero_Preferences.Export = {
	init: function () {
		this.populateQuickCopyList();
		this.updateQuickCopyInstructions();
		
		var charsetMenu = document.getElementById("zotero-import-charsetMenu");
		var charsetMap = Zotero_Charset_Menu.populate(charsetMenu, false);
		charsetMenu.selectedItem =
			charsetMap[Zotero.Prefs.get("import.charset")] ?
				charsetMap[Zotero.Prefs.get("import.charset")] : charsetMap["auto"];
	},
	
	
	/*
	 * Builds the main Quick Copy drop-down from the current global pref
	 */
	populateQuickCopyList: function () {
		// Initialize default format drop-down
		var format = Zotero.Prefs.get("export.quickCopy.setting");
		var menulist = document.getElementById("zotero-quickCopy-menu");
		this.buildQuickCopyFormatDropDown(menulist, Zotero.QuickCopy.getContentType(format), format);
		menulist.setAttribute('preference', "pref-quickCopy-setting");
		this.updateQuickCopyHTMLCheckbox();
		
		if (!Zotero.isStandalone) {
			this.refreshQuickCopySiteList();
		}
	},
	
	
	/*
	 * Builds a Quick Copy drop-down 
	 */
	buildQuickCopyFormatDropDown: function (menulist, contentType, currentFormat) {
		if (!currentFormat) {
			currentFormat = menulist.value;
		}
		// Strip contentType from mode
		currentFormat = Zotero.QuickCopy.stripContentType(currentFormat);
		
		menulist.selectedItem = null;
		menulist.removeAllItems();
		
		// Prevent Cmd-w from setting "Wikipedia"
		menulist.onkeydown = function (event) {
			if ((Zotero.isMac && event.metaKey) || event.ctrlKey) {
				event.preventDefault();
			}
		}
		
		var popup = document.createElement('menupopup');
		menulist.appendChild(popup);
		
		var itemNode = document.createElement("menuitem");
		itemNode.setAttribute("label", Zotero.getString('zotero.preferences.export.quickCopy.bibStyles'));
		itemNode.setAttribute("disabled", true);
		popup.appendChild(itemNode);
		
		// add styles to list
		var styles = Zotero.Styles.getVisible();
		for each(var style in styles) {
			var baseVal = 'bibliography=' + style.styleID;
			var val = 'bibliography' + (contentType == 'html' ? '/html' : '') + '=' + style.styleID;
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("value", val);
			itemNode.setAttribute("label", style.title);
			itemNode.setAttribute("oncommand", 'Zotero_Preferences.Export.updateQuickCopyHTMLCheckbox()');
			popup.appendChild(itemNode);
			
			if (baseVal == currentFormat) {
				menulist.selectedItem = itemNode;
			}
		}
		
		var itemNode = document.createElement("menuitem");
		itemNode.setAttribute("label", Zotero.getString('zotero.preferences.export.quickCopy.exportFormats'));
		itemNode.setAttribute("disabled", true);
		popup.appendChild(itemNode);
		
		// add export formats to list
		var translation = new Zotero.Translate("export");
		var translators = translation.getTranslators();
		
		for (var i=0; i<translators.length; i++) {
			// Skip RDF formats
			switch (translators[i].translatorID) {
				case '6e372642-ed9d-4934-b5d1-c11ac758ebb7':
				case '14763d24-8ba0-45df-8f52-b8d1108e7ac9':
					continue;
			}
			var val  = 'export=' + translators[i].translatorID;
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("value", val);
			itemNode.setAttribute("label", translators[i].label);
			itemNode.setAttribute("oncommand", 'Zotero_Preferences.Export.updateQuickCopyHTMLCheckbox()');
			popup.appendChild(itemNode);
			
			if (val == currentFormat) {
				menulist.selectedItem = itemNode;
			}
		}
		
		menulist.click();
		
		return popup;
	},
	
	
	updateQuickCopyHTMLCheckbox: function () {
		var format = document.getElementById('zotero-quickCopy-menu').value;
		var mode, contentType;
		
		var checkbox = document.getElementById('zotero-quickCopy-copyAsHTML');
		[mode, format] = format.split('=');
		[mode, contentType] = mode.split('/');
		
		checkbox.checked = contentType == 'html';
		checkbox.disabled = mode != 'bibliography';
	},
	
	
	showQuickCopySiteEditor: function (index) {
		var treechildren = document.getElementById('quickCopy-siteSettings-rows');
		
		if (index != undefined && index > -1 && index < treechildren.childNodes.length) {
			var treerow = treechildren.childNodes[index].firstChild;
			var domain = treerow.childNodes[0].getAttribute('label');
			var format = treerow.childNodes[1].getAttribute('label');
			var asHTML = treerow.childNodes[2].getAttribute('label') != '';
		}
		
		var format = Zotero.QuickCopy.getSettingFromFormattedName(format);
		if (asHTML) {
			format = format.replace('bibliography=', 'bibliography/html=');
		}
		
		var io = {domain: domain, format: format, ok: false};
		window.openDialog('chrome://zotero/content/preferences/quickCopySiteEditor.xul', "zotero-preferences-quickCopySiteEditor", "chrome, modal", io);
		
		if (!io.ok) {
			return;
		}
		
		if (domain && domain != io.domain) {
			Zotero.DB.query("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domain]);
		}
		
		Zotero.DB.query("REPLACE INTO settings VALUES ('quickCopySite', ?, ?)", [io.domain, io.format]);
		
		this.refreshQuickCopySiteList();
	},
	
	
	refreshQuickCopySiteList: function () {
		var treechildren = document.getElementById('quickCopy-siteSettings-rows');
		while (treechildren.hasChildNodes()) {
			treechildren.removeChild(treechildren.firstChild);
		}
		
		var sql = "SELECT key AS domainPath, value AS format FROM settings "
			+ "WHERE setting='quickCopySite' ORDER BY domainPath COLLATE NOCASE";
		var siteData = Zotero.DB.query(sql);
		
		if (!siteData) {
			return;
		}
		
		for (var i=0; i<siteData.length; i++) {
			var treeitem = document.createElement('treeitem');
			var treerow = document.createElement('treerow');
			var domainCell = document.createElement('treecell');
			var formatCell = document.createElement('treecell');
			var HTMLCell = document.createElement('treecell');
			
			domainCell.setAttribute('label', siteData[i].domainPath);
			
			var formatted = Zotero.QuickCopy.getFormattedNameFromSetting(siteData[i].format);
			formatCell.setAttribute('label', formatted);
			var copyAsHTML = Zotero.QuickCopy.getContentType(siteData[i].format) == 'html';
			HTMLCell.setAttribute('label', copyAsHTML ? '   ✓   ' : '');
			
			treerow.appendChild(domainCell);
			treerow.appendChild(formatCell);
			treerow.appendChild(HTMLCell);
			treeitem.appendChild(treerow);
			treechildren.appendChild(treeitem);
		}
	},
	
	
	deleteSelectedQuickCopySite: function () {
		var tree = document.getElementById('quickCopy-siteSettings');
		var treeitem = tree.lastChild.childNodes[tree.currentIndex];
		var domainPath = treeitem.firstChild.firstChild.getAttribute('label');
		Zotero.DB.query("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domainPath]);
		this.refreshQuickCopySiteList();
	},
	
	
	updateQuickCopyInstructions: function () {
		var prefix = Zotero.isMac ? Zotero.getString('general.keys.cmdShift') : Zotero.getString('general.keys.ctrlShift');
		
		var key = Zotero.Prefs.get('keys.copySelectedItemsToClipboard');
		var str = Zotero.getString('zotero.preferences.export.quickCopy.instructions', prefix + key);
		var instr = document.getElementById('quickCopy-instructions');
		while (instr.hasChildNodes()) {
			instr.removeChild(instr.firstChild);
		}
		instr.appendChild(document.createTextNode(str));
		
		var key = Zotero.Prefs.get('keys.copySelectedItemCitationsToClipboard');
		var str = Zotero.getString('zotero.preferences.export.quickCopy.citationInstructions', prefix + key);
		var instr = document.getElementById('quickCopy-citationInstructions');
		while (instr.hasChildNodes()) {
			instr.removeChild(instr.firstChild);
		}
		instr.appendChild(document.createTextNode(str));
	}
};
