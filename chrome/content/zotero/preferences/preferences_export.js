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
	init: Zotero.Promise.coroutine(function* () {
		this.updateQuickCopyInstructions();
		yield this.populateQuickCopyList();
		
		var charsetMenu = document.getElementById("zotero-import-charsetMenu");
		var charsetMap = Zotero_Charset_Menu.populate(charsetMenu, false);
		charsetMenu.selectedItem =
			charsetMap[Zotero.Prefs.get("import.charset")] ?
				charsetMap[Zotero.Prefs.get("import.charset")] : charsetMap["auto"];
	}),
	
	
	getQuickCopyTranslators: async function () {
		var translation = new Zotero.Translate("export");
		var translators = await translation.getTranslators();
		translators.sort((a, b) => {
			var collation = Zotero.getLocaleCollation();
			return collation.compareString(1, a.label, b.label);
		});
		return translators;
	},
	
	
	/*
	 * Builds the main Quick Copy drop-down from the current global pref
	 */
	populateQuickCopyList: Zotero.Promise.coroutine(function* () {
		// Initialize default format drop-down
		var format = Zotero.Prefs.get("export.quickCopy.setting");
		format = Zotero.QuickCopy.unserializeSetting(format);
		var menulist = document.getElementById("zotero-quickCopy-menu");
		yield Zotero.Styles.init();
		var translators = yield this.getQuickCopyTranslators();
		this.buildQuickCopyFormatDropDown(
			menulist, format.contentType, format, translators
		);
		menulist.setAttribute('preference', "pref-quickCopy-setting");
		
		// Initialize locale drop-down
		var localeMenulist = document.getElementById("zotero-quickCopy-locale-menu");
		Zotero.Styles.populateLocaleList(localeMenulist);
		localeMenulist.setAttribute('preference', "pref-quickCopy-locale");
		
		this._lastSelectedLocale = Zotero.Prefs.get("export.quickCopy.locale");
		this.updateQuickCopyUI();
		
		yield this.refreshQuickCopySiteList();
	}),
	
	
	/*
	 * Builds a Quick Copy drop-down 
	 */
	buildQuickCopyFormatDropDown: function (menulist, contentType, format, translators) {
		if (!format) {
			format = menulist.value;
		}
		
		format = Zotero.QuickCopy.unserializeSetting(format);
		
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
		itemNode.setAttribute("label", Zotero.getString('zotero.preferences.export.quickCopy.citationStyles'));
		itemNode.setAttribute("disabled", true);
		popup.appendChild(itemNode);
		
		// add styles to list
		var styles = Zotero.Styles.getVisible();
		styles.forEach(function (style) {
			var val = 'bibliography' + (contentType == 'html' ? '/html' : '') + '=' + style.styleID;
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("value", val);
			itemNode.setAttribute("label", style.title);
			itemNode.setAttribute("oncommand", 'Zotero_Preferences.Export.updateQuickCopyUI()');
			popup.appendChild(itemNode);
			
			if (format.mode == 'bibliography' && format.id == style.styleID) {
				menulist.selectedItem = itemNode;
			}
		});
		
		var itemNode = document.createElement("menuitem");
		itemNode.setAttribute("label", Zotero.getString('zotero.preferences.export.quickCopy.exportFormats'));
		itemNode.setAttribute("disabled", true);
		popup.appendChild(itemNode);
		
		// add export formats to list
		translators.sort((a, b) => a.label.localeCompare(b.label))
		translators.forEach(function (translator) {
			// Skip RDF formats
			switch (translator.translatorID) {
				case '6e372642-ed9d-4934-b5d1-c11ac758ebb7':
				case '14763d24-8ba0-45df-8f52-b8d1108e7ac9':
					return;
			}
			var val = 'export=' + translator.translatorID;
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("value", val);
			itemNode.setAttribute("label", translator.label);
			itemNode.setAttribute("oncommand", 'Zotero_Preferences.Export.updateQuickCopyUI()');
			popup.appendChild(itemNode);
			
			if (format.mode == 'export' && format.id == translator.translatorID) {
				menulist.selectedItem = itemNode;
			}
		});
		
		menulist.click();
	},
	
	
	onCopyAsHTMLChange: async function (checked) {
		var menulist = document.getElementById('zotero-quickCopy-menu');
		var translators = await this.getQuickCopyTranslators();
		this.buildQuickCopyFormatDropDown(menulist, checked ? 'html' : '', null, translators);
	},
	
	
	updateQuickCopyUI: function () {
		var format = document.getElementById('zotero-quickCopy-menu').value;
		
		var mode, contentType;
		
		[mode, format] = format.split('=');
		[mode, contentType] = mode.split('/');
		
		var checkbox = document.getElementById('zotero-quickCopy-copyAsHTML');
		checkbox.checked = contentType == 'html';
		checkbox.disabled = mode != 'bibliography';
		
		Zotero.Styles.updateLocaleList(
			document.getElementById('zotero-quickCopy-locale-menu'),
			mode == 'bibliography' ? Zotero.Styles.get(format) : null,
			this._lastSelectedLocale
		);
	},
	
	/**
	 * Disables UI buttons when no site-specific quick copy entries are selected
	 */
	disableQuickCopySiteButtons: function () {
		document.getElementById('quickCopy-edit').disabled = true;
		document.getElementById('quickCopy-delete').disabled = true;
	},
	
	/**
	 * Enables UI buttons when a site-specific quick copy entry is selected
	 */
	enableQuickCopySiteButtons: function () {
		document.getElementById('quickCopy-edit').disabled = false;
		document.getElementById('quickCopy-delete').disabled = false;
	},
	
	showQuickCopySiteEditor: Zotero.Promise.coroutine(function* (index) {
		var treechildren = document.getElementById('quickCopy-siteSettings-rows');
		
		var formattedName = document.getElementById('zotero-quickCopy-menu').label; 
		var locale = this._lastSelectedLocale;
		var asHTML = document.getElementById('zotero-quickCopy-copyAsHTML').checked;
		
		if (index !== undefined && index > -1 && index < treechildren.childNodes.length) {
			var treerow = treechildren.childNodes[index].firstChild;
			var domain = treerow.childNodes[0].getAttribute('label');
			formattedName = treerow.childNodes[1].getAttribute('label');
			locale = treerow.childNodes[2].getAttribute('label');
			asHTML = treerow.childNodes[3].getAttribute('label') !== '';
		}
		
		var format = yield Zotero.QuickCopy.getSettingFromFormattedName(formattedName);
		if (asHTML) {
			format = format.replace('bibliography=', 'bibliography/html=');
		}
		
		var styles = Zotero.Styles.getVisible();
		var translation = new Zotero.Translate("export");
		var translators = yield translation.getTranslators();
		
		var io = { domain, format, locale, asHTML, ok: false, styles, translators };
		window.openDialog('chrome://zotero/content/preferences/quickCopySiteEditor.xul',
			"zotero-preferences-quickCopySiteEditor", "chrome,modal,centerscreen", io);
		
		if (!io.ok) {
			return;
		}
		
		if (domain && domain != io.domain) {
			yield Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domain]);
		}
		
		var quickCopysetting = Zotero.QuickCopy.unserializeSetting(io.format);
		quickCopysetting.locale = io.locale;
		
		yield Zotero.DB.queryAsync("REPLACE INTO settings VALUES ('quickCopySite', ?, ?)", [io.domain, JSON.stringify(quickCopysetting)]);
		
		yield Zotero.QuickCopy.loadSiteSettings();
		
		yield this.refreshQuickCopySiteList();
	}),
	
	
	refreshQuickCopySiteList: Zotero.Promise.coroutine(function* () {
		var treechildren = document.getElementById('quickCopy-siteSettings-rows');
		while (treechildren.hasChildNodes()) {
			treechildren.removeChild(treechildren.firstChild);
		}
		
		var sql = "SELECT key AS domainPath, value AS format FROM settings "
			+ "WHERE setting='quickCopySite' ORDER BY domainPath COLLATE NOCASE";
		var siteData = yield Zotero.DB.queryAsync(sql);
		
		for (var i=0; i<siteData.length; i++) {
			var treeitem = document.createElement('treeitem');
			var treerow = document.createElement('treerow');
			var domainCell = document.createElement('treecell');
			var formatCell = document.createElement('treecell');
			var localeCell = document.createElement('treecell');
			var htmlCell = document.createElement('treecell');
			
			domainCell.setAttribute('label', siteData[i].domainPath);
			
			var formattedName = yield Zotero.QuickCopy.getFormattedNameFromSetting(siteData[i].format);
			formatCell.setAttribute('label', formattedName);
			
			var format = Zotero.QuickCopy.unserializeSetting(siteData[i].format);
			localeCell.setAttribute('label', format.locale);
			htmlCell.setAttribute('label', format.contentType == 'html' ? '   ✓   ' : '');
			
			treerow.appendChild(domainCell);
			treerow.appendChild(formatCell);
			treerow.appendChild(localeCell);
			treerow.appendChild(htmlCell);
			treeitem.appendChild(treerow);
			treechildren.appendChild(treeitem);
		}
		
		this.disableQuickCopySiteButtons();
	}),
	
	
	deleteSelectedQuickCopySite: Zotero.Promise.coroutine(function* () {
		var tree = document.getElementById('quickCopy-siteSettings');
		var treeitem = tree.lastChild.childNodes[tree.currentIndex];
		var domainPath = treeitem.firstChild.firstChild.getAttribute('label');
		yield Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domainPath]);
		yield Zotero.QuickCopy.loadSiteSettings();
		yield this.refreshQuickCopySiteList();
	}),
	
	
	updateQuickCopyInstructions: function () {
		var prefix = Zotero.isMac ? Zotero.getString('general.keys.cmdShift') : Zotero.getString('general.keys.ctrlShift');
		
		var key = Zotero.Prefs.get('keys.copySelectedItemsToClipboard');
		var str = Zotero.getString('zotero.preferences.export.quickCopy.instructions', prefix + key);
		var instr = document.getElementById('quickCopy-instructions');
		while (instr.hasChildNodes()) {
			instr.removeChild(instr.firstChild);
		}
		instr.appendChild(document.createTextNode(str));
		
		key = Zotero.Prefs.get('keys.copySelectedItemCitationsToClipboard');
		str = Zotero.getString('zotero.preferences.export.quickCopy.citationInstructions', prefix + key);
		instr = document.getElementById('quickCopy-citationInstructions');
		while (instr.hasChildNodes()) {
			instr.removeChild(instr.firstChild);
		}
		instr.appendChild(document.createTextNode(str));
	}
};
