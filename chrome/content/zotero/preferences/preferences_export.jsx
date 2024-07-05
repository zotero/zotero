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

var React = require('react');
var ReactDOM = require('react-dom');
var VirtualizedTable = require('components/virtualized-table');
var { makeRowRenderer } = VirtualizedTable;

Zotero_Preferences.Export = {
	init: async function () {
		this.updateQuickCopyInstructions();
		await this.populateQuickCopyList();
		await this.populateNoteQuickCopyList();
	},
	
	
	getQuickCopyTranslators: async function () {
		var translation = new Zotero.Translate("export");
		var translators = await translation.getTranslators();
		translators.sort((a, b) => {
			var collation = Zotero.getLocaleCollation();
			return collation.compareString(1, a.label, b.label);
		});
		// Exclude note export translators
		translators = translators.filter(x => !x.configOptions || !x.configOptions.noteTranslator);
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
		menulist.setAttribute('preference', "extensions.zotero.export.quickCopy.setting");
		
		// Initialize locale drop-down
		var localeMenulist = document.getElementById("zotero-quickCopy-locale-menu");
		Zotero.Styles.populateLocaleList(localeMenulist);
		localeMenulist.addEventListener('syncfrompreference', () => {
			this._lastSelectedLocale = Zotero.Prefs.get("export.quickCopy.locale");
			this.updateQuickCopyUI();
		});
		localeMenulist.setAttribute('preference', "extensions.zotero.export.quickCopy.locale");
		
		yield this.refreshQuickCopySiteList();
	}),
	
	
	/*
	 * Builds the note Quick Copy drop-down from the current global pref
	 */
	populateNoteQuickCopyList: async function () {
		document.getElementById('noteQuickCopy-format-options').removeAttribute('hidden');
		
		// Initialize default format drop-down
		var format = Zotero.Prefs.get("export.noteQuickCopy.setting");
		format = Zotero.QuickCopy.unserializeSetting(format);
		var menulist = document.getElementById("zotero-noteQuickCopy-menu");
		menulist.setAttribute('preference', "extensions.zotero.export.noteQuickCopy.setting");
		menulist.removeEventListener('command', this.updateNoteQuickCopyUI);
		menulist.addEventListener('command', this.updateNoteQuickCopyUI);

		if (!format) {
			format = menulist.value;
		}
		
		format = Zotero.QuickCopy.unserializeSetting(format);
		
		menulist.selectedItem = null;
		menulist.removeAllItems();
		
		var popup = document.createXULElement('menupopup');
		menulist.appendChild(popup);

		// add export formats to list
		var translation = new Zotero.Translate("export");
		var translators = await translation.getTranslators();
		
		translators.sort((a, b) => a.label.localeCompare(b.label));
		
		// Remove "Note" prefix from Note HTML translator
		let htmlTranslator = translators.find(
			x => x.translatorID == Zotero.Translators.TRANSLATOR_ID_NOTE_HTML
		);
		if (htmlTranslator) {
			htmlTranslator.label = 'HTML';
		}
		
		// Make sure virtual "Markdown + Rich Text" translator doesn't actually exist
		translators = translators.filter(
			x => x.translatorID != Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT
		);

		let markdownTranslatorIdx = translators.findIndex(
			x => x.translatorID == Zotero.Translators.TRANSLATOR_ID_NOTE_MARKDOWN
		);
		// Make sure we actually have both translators
		if (markdownTranslatorIdx != -1 && htmlTranslator) {
			// Exclude standalone Note Markdown translator
			translators.splice(markdownTranslatorIdx, 1);
			// Add virtual "Markdown + Rich Text" translator to the top
			translators.unshift({
				translatorID: Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT,
				label: 'Markdown + ' + Zotero.getString('general.richText'),
				configOptions: {
					noteTranslator: true
				}
			});
		}
		
		translators.forEach(function (translator) {
			// Allow only note export translators
			if (!translator.configOptions || !translator.configOptions.noteTranslator) {
				return;
			}

			var value = { mode: 'export', id: translator.translatorID };
			if (translator.translatorID == format.id) {
				value = format;
			}
			else if (translator.translatorID == Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT) {
				value = {
					mode: 'export',
					id: translator.translatorID,
					markdownOptions: {
						includeAppLinks: true
					},
					htmlOptions: {
						includeAppLinks: false
					}
				};
				if (format.id == Zotero.Translators.TRANSLATOR_ID_NOTE_HTML && format.options) {
					value.htmlOptions = format.options;
				}
			}
			else if (translator.translatorID == Zotero.Translators.TRANSLATOR_ID_NOTE_HTML) {
				value = {
					mode: 'export',
					id: translator.translatorID,
					options: {
						includeAppLinks: false
					}
				};
				if (format.id == Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT && format.htmlOptions) {
					value.options = format.htmlOptions;
				}
			}

			value = JSON.stringify(value);
			var itemNode = document.createXULElement('menuitem');
			itemNode.setAttribute('value', value);
			itemNode.setAttribute('label', translator.label);
			popup.appendChild(itemNode);

			if (format.mode == 'export' && format.id == translator.translatorID) {
				menulist.selectedItem = itemNode;
			}
		});

		menulist.click();
		this.updateNoteQuickCopyUI();
	},

	updateNoteQuickCopyUI: () => {
		var format = document.getElementById('zotero-noteQuickCopy-menu').value;
		format = JSON.parse(format);

		var markdownOptions = document.getElementById('noteQuickCopy-markdown-options');
		var htmlOptions = document.getElementById('noteQuickCopy-html-options');
		var markdownOptionsLabel = document.querySelector('#noteQuickCopy-markdown-options label');
		var htmlOptionsLabel = document.querySelector('#noteQuickCopy-html-options label');
		var markdownIncludeAppLinks = document.getElementById("noteQuickCopy-markdown-includeAppLinks");
		var htmlIncludeAppLinks = document.getElementById("noteQuickCopy-html-includeAppLinks");
		
		markdownOptionsLabel.value = Zotero.Utilities.Internal.stringWithColon("Markdown");
		htmlOptionsLabel.value = Zotero.Utilities.Internal.stringWithColon(
			Zotero.getString('zotero.preferences.export.quickCopy.note.htmlOptions.label')
		);
		markdownIncludeAppLinks.label = Zotero.getString('exportOptions.includeAppLinks', Zotero.appName);
		htmlIncludeAppLinks.label = Zotero.getString('exportOptions.includeAppLinks', Zotero.appName);
		
		if (format.id == Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT) {
			markdownOptions.hidden = false;
			htmlOptions.hidden = false;
			markdownIncludeAppLinks.checked = format.markdownOptions && format.markdownOptions.includeAppLinks;
			htmlIncludeAppLinks.checked = format.htmlOptions && format.htmlOptions.includeAppLinks;
		}
		else if (format.id == Zotero.Translators.TRANSLATOR_ID_NOTE_HTML) {
			markdownOptions.hidden = true;
			htmlOptions.hidden = false;
			htmlIncludeAppLinks.checked = format.options && format.options.includeAppLinks;
		}
		else {
			markdownOptions.hidden = true;
			htmlOptions.hidden = true;
		}
	},

	onUpdateNoteExportOptions() {
		var menulist = document.getElementById("zotero-noteQuickCopy-menu");
		var markdownIncludeAppLinks = document.getElementById("noteQuickCopy-markdown-includeAppLinks");
		var htmlIncludeAppLinks = document.getElementById("noteQuickCopy-html-includeAppLinks");

		for (let i = 0; i < menulist.itemCount; i++) {
			let item = menulist.getItemAtIndex(i);
			let format = JSON.parse(item.getAttribute('value'));
			if (format.id == Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT) {
				if (!format.markdownOptions) {
					format.markdownOptions = {};
				}
				if (!format.htmlOptions) {
					format.htmlOptions = {};
				}
				format.markdownOptions.includeAppLinks = markdownIncludeAppLinks.checked;
				format.htmlOptions.includeAppLinks = htmlIncludeAppLinks.checked;
			}
			else if (format.id == Zotero.Translators.TRANSLATOR_ID_NOTE_HTML) {
				if (!format.options) {
					format.options = {};
				}
				format.options.includeAppLinks = htmlIncludeAppLinks.checked;
			}
			else {
				continue;
			}
			item.value = JSON.stringify(format);
		}
		// After updating item's value we have to wait before dispatching event.
		// menulist.value does not reflect changes immediately item.value is updated.
		setTimeout(() => menulist.dispatchEvent(new Event("change", { bubbles: true })), 50);
	},
	
	
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
		
		var popup = document.createXULElement('menupopup');
		menulist.appendChild(popup);
		
		var itemNode = document.createXULElement("menuitem");
		itemNode.setAttribute("label", Zotero.getString('zotero.preferences.export.quickCopy.citationStyles'));
		itemNode.setAttribute("disabled", true);
		popup.appendChild(itemNode);
		
		// add styles to list
		var styles = Zotero.Styles.getVisible();
		styles.forEach(function (style) {
			var val = 'bibliography' + (contentType == 'html' ? '/html' : '') + '=' + style.styleID;
			var itemNode = document.createXULElement("menuitem");
			itemNode.setAttribute("value", val);
			itemNode.setAttribute("label", style.title);
			itemNode.setAttribute("oncommand", 'Zotero_Preferences.Export.updateQuickCopyUI()');
			popup.appendChild(itemNode);
			
			if (format.mode == 'bibliography' && format.id == style.styleID) {
				menulist.selectedItem = itemNode;
			}
		});
		
		var itemNode = document.createXULElement("menuitem");
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
			var itemNode = document.createXULElement("menuitem");
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

	/**
	 * Enable or disable depending on whether rows are selected
	 */
	updateQuickCopySiteButtons: function () {
		if (this._tree?.selection.count) {
			this.enableQuickCopySiteButtons();
		}
		else {
			this.disableQuickCopySiteButtons();
		}
	},
	
	showQuickCopySiteEditor: async function (editExisting) {
		var index;
		if (editExisting) {
			index = this._tree.selection.focused;
		}
		var formattedName = document.getElementById('zotero-quickCopy-menu').label;
		var locale = this._lastSelectedLocale;
		var asHTML = document.getElementById('zotero-quickCopy-copyAsHTML').checked;
		
		if (index !== undefined && index > -1 && index < this._rows.length) {
			var row = this._rows[index];
			var domain = row.domain;
			formattedName = row.format;
			locale = row.locale;
			asHTML = row.copyAsHTML;
		}
		
		var format = await Zotero.QuickCopy.getSettingFromFormattedName(formattedName);
		if (asHTML) {
			format = format.replace('bibliography=', 'bibliography/html=');
		}
		
		var styles = Zotero.Styles.getVisible();
		var translation = new Zotero.Translate("export");
		var translators = await translation.getTranslators();
		
		var io = { domain, format, locale, asHTML, ok: false, styles, translators };
		window.openDialog('chrome://zotero/content/preferences/quickCopySiteEditor.xhtml',
			"zotero-preferences-quickCopySiteEditor", "chrome,modal,centerscreen", io);
		
		if (!io.ok || !io.domain) {
			return;
		}
		
		if (domain && domain != io.domain) {
			await Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domain]);
		}
		
		var quickCopysetting = Zotero.QuickCopy.unserializeSetting(io.format);
		quickCopysetting.locale = io.locale;
		
		await Zotero.DB.queryAsync("REPLACE INTO settings VALUES ('quickCopySite', ?, ?)", [io.domain, JSON.stringify(quickCopysetting)]);
		
		await Zotero.QuickCopy.loadSiteSettings();
		
		await this.refreshQuickCopySiteList();
	},
	
	
	refreshQuickCopySiteList: async function () {
		var sql = "SELECT key AS domainPath, value AS format FROM settings "
			+ "WHERE setting='quickCopySite' ORDER BY domainPath COLLATE NOCASE";
		var siteData = await Zotero.DB.queryAsync(sql);
		
		this._rows = [];

		for (let row of siteData) {
			var formattedName = await Zotero.QuickCopy.getFormattedNameFromSetting(row.format);
			var format = Zotero.QuickCopy.unserializeSetting(row.format);
			this._rows.push({
				domain: row.domainPath,
				format: formattedName,
				locale: format.locale,
				copyAsHTML: format.contentType == 'html',
			});
		}

		if (!this._tree) {
			const columns = [
				{
					dataKey: "domain",
					label: "zotero.preferences.quickCopy.siteEditor.domainPath",
					flex: 2
				},
				{
					dataKey: "format",
					label: "zotero.preferences.quickCopy.siteEditor.format",
					flex: 4
				},
				{
					dataKey: "locale",
					label: "zotero.preferences.quickCopy.siteEditor.locale",
					flex: 1
				},
				{
					dataKey: "copyAsHTML",
					label: "HTML",
					type: 'checkbox',
					fixedWidth: true,
					width: 55,
				}
			];
			var handleKeyDown = (event) => {
				if (event.key == 'Delete' || Zotero.isMac && event.key == 'Backspace') {
					Zotero_Preferences.Export.deleteSelectedQuickCopySite();
				}
			};
			var handleSelectionChange = () => {
				this.updateQuickCopySiteButtons();
			};
			
			await new Promise((resolve) => {
				ReactDOM.createRoot(document.getElementById("quickCopy-siteSettings")).render(
					<VirtualizedTable
						getRowCount={() => this._rows.length}
						id="quickCopy-siteSettings-table"
						ref={(ref) => {
							this._tree = ref;
							resolve();
						}}
						renderItem={makeRowRenderer(index => this._rows[index])}
						showHeader={true}
						columns={columns}
						staticColumns={true}
						disableFontSizeScaling={true}
						onSelectionChange={handleSelectionChange}
						onKeyDown={handleKeyDown}
						getRowString={index => this._rows[index].domain}
						onActivate={(event, indices) => Zotero_Preferences.Export.showQuickCopySiteEditor(true)}
					/>
				);
			});
		} else {
			this._tree.invalidate();
		}

		if ([...this._tree.selection.selected].some(i => i >= this._rows.length)) {
			this._tree.selection.clearSelection();
		}
		this.updateQuickCopySiteButtons();
	},
	
	
	deleteSelectedQuickCopySite: Zotero.Promise.coroutine(function* () {
		var domainPath = this._rows[this._tree.selection.focused].domain;
		yield Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domainPath]);
		yield Zotero.QuickCopy.loadSiteSettings();
		yield this.refreshQuickCopySiteList();
		this.updateQuickCopySiteButtons();
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
