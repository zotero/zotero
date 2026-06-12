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
		this.updateQuickCopyUI();
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
	 * Builds the bibliography, export, and locale dropdowns. Selection state
	 * is applied later by updateQuickCopyUI() reading from prefs.
	 */
	populateQuickCopyList: async function () {
		await Zotero.Styles.init();

		this.buildBibliographyQuickCopyDropDown(
			document.getElementById("zotero-quickCopy-bibliography-menu")
		);

		this.buildExportQuickCopyDropDown(
			document.getElementById("zotero-quickCopy-export-menu"),
			await this.getQuickCopyTranslators()
		);

		// Initial locale options; updateQuickCopyUI re-filters by selected style
		Zotero.Styles.populateLocaleList(document.getElementById("zotero-quickCopy-locale-menu"));

		await this.refreshQuickCopySiteList();
	},
	
	
	/*
	 * Builds the note Quick Copy drop-down. Items carry just the translator ID;
	 * options live in the dedicated checkboxes and are read by updateQuickCopyPrefs.
	 */
	populateNoteQuickCopyList: async function () {
		document.getElementById('noteQuickCopy-format-options').removeAttribute('hidden');

		var menulist = document.getElementById("zotero-noteQuickCopy-menu");
		menulist.removeAllItems();
		var popup = document.createXULElement('menupopup');
		menulist.appendChild(popup);

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
		if (markdownTranslatorIdx != -1 && htmlTranslator) {
			translators.splice(markdownTranslatorIdx, 1);
			translators.unshift({
				translatorID: Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT,
				label: 'Markdown + ' + Zotero.getString('general.richText'),
				configOptions: { noteTranslator: true }
			});
		}

		translators.forEach(function (translator) {
			if (!translator.configOptions || !translator.configOptions.noteTranslator) {
				return;
			}
			var itemNode = document.createXULElement('menuitem');
			itemNode.setAttribute('value', translator.translatorID);
			itemNode.setAttribute('label', translator.label);
			popup.appendChild(itemNode);
		});
	},


	/*
	 * Builds the bibliography Quick Copy drop-down. Items carry the styleID;
	 * selection is applied by updateQuickCopyUI().
	 */
	buildBibliographyQuickCopyDropDown: function (menulist) {
		menulist.removeAllItems();
		var popup = document.createXULElement('menupopup');
		menulist.appendChild(popup);

		Zotero.Styles.getVisible().forEach(function (style) {
			var itemNode = document.createXULElement("menuitem");
			itemNode.setAttribute("value", style.styleID);
			itemNode.setAttribute("label", style.title);
			popup.appendChild(itemNode);
		});
	},


	/*
	 * Builds the export Quick Copy drop-down. Items carry the translatorID;
	 * selection is applied by updateQuickCopyUI().
	 */
	buildExportQuickCopyDropDown: function (menulist, translators) {
		menulist.removeAllItems();
		var popup = document.createXULElement('menupopup');
		menulist.appendChild(popup);

		translators.sort((a, b) => a.label.localeCompare(b.label));
		translators.forEach(function (translator) {
			// Skip RDF formats
			switch (translator.translatorID) {
				case '6e372642-ed9d-4934-b5d1-c11ac758ebb7':
				case '14763d24-8ba0-45df-8f52-b8d1108e7ac9':
					return;
			}
			var itemNode = document.createXULElement("menuitem");
			itemNode.setAttribute("value", translator.translatorID);
			itemNode.setAttribute("label", translator.label);
			popup.appendChild(itemNode);
		});
	},


	/*
	 * Single writer: read the current state of every Quick Copy control and
	 * persist it across the bibliography, export, note-format, drag-preference,
	 * and locale prefs. Then call updateQuickCopyUI to refresh anything that
	 * cascades off the new state (locale list filtered by style, note option
	 * visibility for the new translator, etc).
	 */
	updateQuickCopyPrefs: function () {
		var bibMenu = document.getElementById('zotero-quickCopy-bibliography-menu');
		var asHTML = document.getElementById('zotero-quickCopy-copyAsHTML').checked;
		Zotero.Prefs.set('export.quickCopy.bibliographySetting', JSON.stringify({
			mode: 'bibliography',
			id: bibMenu.value || '',
			contentType: asHTML ? 'html' : '',
			locale: document.getElementById('zotero-quickCopy-locale-menu').value || ''
		}));

		var exportMenu = document.getElementById('zotero-quickCopy-export-menu');
		Zotero.Prefs.set('export.quickCopy.exportSetting', JSON.stringify({
			mode: 'export',
			id: exportMenu.value || ''
		}));

		var noteMenu = document.getElementById('zotero-noteQuickCopy-menu');
		var noteId = noteMenu.value || '';
		var notePref = { mode: 'export', id: noteId };
		var markdownLinks = document.getElementById('noteQuickCopy-markdown-includeAppLinks').checked;
		var htmlLinks = document.getElementById('noteQuickCopy-html-includeAppLinks').checked;
		if (noteId == Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT) {
			notePref.markdownOptions = { includeAppLinks: markdownLinks };
			notePref.htmlOptions = { includeAppLinks: htmlLinks };
		}
		else if (noteId == Zotero.Translators.TRANSLATOR_ID_NOTE_HTML) {
			notePref.options = { includeAppLinks: htmlLinks };
		}
		Zotero.Prefs.set('export.noteQuickCopy.setting', JSON.stringify(notePref));

		Zotero.Prefs.set(
			'export.quickCopy.preferredFormatOnDrag',
			document.getElementById('zotero-quickCopy-preferredFormatOnDrag').value || 'bibliography'
		);

		this.updateQuickCopyUI();
	},


	/*
	 * Single reader: pull every Quick Copy pref and apply it to the matching
	 * control. Programmatic property assignments here do not fire `command`,
	 * so this does not loop back into updateQuickCopyPrefs.
	 */
	updateQuickCopyUI: function () {
		var bibPref = Zotero.QuickCopy.unserializeSetting(
			Zotero.Prefs.get('export.quickCopy.bibliographySetting')
		);
		this._selectMenuItemByValue(
			document.getElementById('zotero-quickCopy-bibliography-menu'),
			bibPref.id
		);

		document.getElementById('zotero-quickCopy-copyAsHTML').checked
			= bibPref.contentType == 'html';

		Zotero.Styles.updateLocaleList(
			document.getElementById('zotero-quickCopy-locale-menu'),
			bibPref.id ? Zotero.Styles.get(bibPref.id) : null,
			bibPref.locale
		);

		var exportPref = Zotero.QuickCopy.unserializeSetting(
			Zotero.Prefs.get('export.quickCopy.exportSetting')
		);
		this._selectMenuItemByValue(
			document.getElementById('zotero-quickCopy-export-menu'),
			exportPref.id
		);

		var notePref = Zotero.QuickCopy.unserializeSetting(
			Zotero.Prefs.get('export.noteQuickCopy.setting')
		);
		this._selectMenuItemByValue(
			document.getElementById('zotero-noteQuickCopy-menu'),
			notePref.id
		);
		this._updateNoteOptionUI(notePref);

		document.getElementById('zotero-quickCopy-preferredFormatOnDrag').value
			= Zotero.Prefs.get('export.quickCopy.preferredFormatOnDrag') || 'bibliography';
	},


	_selectMenuItemByValue: function (menulist, value) {
		for (let i = 0; i < menulist.itemCount; i++) {
			let item = menulist.getItemAtIndex(i);
			if (item.value == value) {
				menulist.selectedItem = item;
				return;
			}
		}
		menulist.selectedItem = null;
	},


	_updateNoteOptionUI: function (notePref) {
		var markdownGroup = document.getElementById('noteQuickCopy-markdown-options');
		var htmlGroup = document.getElementById('noteQuickCopy-html-options');
		var markdownLabel = document.querySelector('#noteQuickCopy-markdown-options label');
		var htmlLabel = document.querySelector('#noteQuickCopy-html-options label');
		var markdownCheckbox = document.getElementById('noteQuickCopy-markdown-includeAppLinks');
		var htmlCheckbox = document.getElementById('noteQuickCopy-html-includeAppLinks');

		markdownLabel.value = Zotero.Utilities.Internal.stringWithColon('Markdown');
		htmlLabel.value = Zotero.Utilities.Internal.stringWithColon(
			Zotero.getString('zotero.preferences.export.quickCopy.note.htmlOptions.label')
		);
		markdownCheckbox.label = Zotero.getString('exportOptions.includeAppLinks', Zotero.appName);
		htmlCheckbox.label = Zotero.getString('exportOptions.includeAppLinks', Zotero.appName);

		if (notePref.id == Zotero.Translators.TRANSLATOR_ID_MARKDOWN_AND_RICH_TEXT) {
			markdownGroup.hidden = false;
			htmlGroup.hidden = false;
			markdownCheckbox.checked = !!(notePref.markdownOptions && notePref.markdownOptions.includeAppLinks);
			htmlCheckbox.checked = !!(notePref.htmlOptions && notePref.htmlOptions.includeAppLinks);
		}
		else if (notePref.id == Zotero.Translators.TRANSLATOR_ID_NOTE_HTML) {
			markdownGroup.hidden = true;
			htmlGroup.hidden = false;
			htmlCheckbox.checked = !!(notePref.options && notePref.options.includeAppLinks);
		}
		else {
			markdownGroup.hidden = true;
			htmlGroup.hidden = true;
		}
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

		var domain = '';
		var existingSiteSetting = null;

		if (index !== undefined && index > -1 && index < this._rows.length) {
			let row = this._rows[index];
			domain = row.domain;
			existingSiteSetting = row.siteSetting;
		}

		var translation = new Zotero.Translate("export");
		var translators = await translation.getTranslators();

		var io = {
			domain,
			siteSetting: existingSiteSetting,
			translators,
			ok: false
		};
		window.openDialog('chrome://zotero/content/preferences/quickCopySiteEditor.xhtml',
			"zotero-preferences-quickCopySiteEditor", "chrome,modal,centerscreen", io);

		if (!io.ok || !io.domain || !io.siteSetting) {
			return;
		}
		// Defensive: at least one of bibliography/export must be present
		if (!io.siteSetting.bibliography && !io.siteSetting.export) {
			return;
		}

		if (domain && domain != io.domain) {
			await Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domain]);
		}

		await Zotero.DB.queryAsync("REPLACE INTO settings VALUES ('quickCopySite', ?, ?)",
			[io.domain, JSON.stringify(io.siteSetting)]);

		await Zotero.QuickCopy.loadSiteSettings();

		await this.refreshQuickCopySiteList();
	},


	refreshQuickCopySiteList: async function () {
		var sql = "SELECT key AS domainPath, value AS format FROM settings "
			+ "WHERE setting='quickCopySite' ORDER BY domainPath COLLATE NOCASE";
		var siteData = await Zotero.DB.queryAsync(sql);

		this._rows = [];

		for (let row of siteData) {
			let site = Zotero.QuickCopy.parseSiteFormat(row.format);
			let bibName = '';
			let exportName = '';
			if (site.bibliography && site.bibliography.id) {
				bibName = await Zotero.QuickCopy.getFormattedNameFromSetting(site.bibliography);
			}
			if (site.export && site.export.id) {
				exportName = await Zotero.QuickCopy.getFormattedNameFromSetting(site.export);
			}
			let dragLabel = '';
			if (site.drag === 'bibliography') {
				dragLabel = Zotero.getString('preferences-quickCopy-preferredFormatOnDrag-bibliography');
			}
			else if (site.drag === 'export') {
				dragLabel = Zotero.getString('preferences-quickCopy-preferredFormatOnDrag-export');
			}
			this._rows.push({
				domain: row.domainPath,
				exportFormat: exportName,
				bibliographyFormat: bibName,
				locale: site.bibliography && site.bibliography.locale || '',
				copyAsHTML: !!(site.bibliography && site.bibliography.contentType === 'html'),
				useOnDrag: dragLabel,
				siteSetting: site,
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
					dataKey: "exportFormat",
					label: "preferences-quickCopy-siteEditor-export-format",
					flex: 3
				},
				{
					dataKey: "bibliographyFormat",
					label: "preferences-quickCopy-siteEditor-bibliography-format",
					flex: 3
				},
				{
					dataKey: "locale",
					label: "zotero.preferences.quickCopy.siteEditor.locale",
					fixedWidth: true,
					width: 85,
				},
				{
					dataKey: "copyAsHTML",
					label: "HTML",
					type: 'checkbox',
					fixedWidth: true,
					width: 55,
				},
				{
					dataKey: "useOnDrag",
					label: "preferences-quickCopy-siteEditor-use-on-drag",
					fixedWidth: true,
					width: 85,
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
	
	
	deleteSelectedQuickCopySite: async function() {
		var domainPath = this._rows[this._tree.selection.focused].domain;
		await Zotero.DB.queryAsync("DELETE FROM settings WHERE setting='quickCopySite' AND key=?", [domainPath]);
		await Zotero.QuickCopy.loadSiteSettings();
		await this.refreshQuickCopySiteList();
		this.updateQuickCopySiteButtons();
	},
	
	
	updateQuickCopyInstructions: function () {
		var shiftPrefix = Zotero.getString("command-or-control") + "+" + Zotero.getString("general-key-shift") + "+";

		document.l10n.setAttributes(
			document.getElementById('quickCopy-instructions'),
			'preferences-quickCopy-instructions',
			{
				bibShortcut: shiftPrefix + Zotero.Prefs.get('keys.copyAsBibliography'),
				exportShortcut: shiftPrefix + Zotero.Prefs.get('keys.copyAsExport')
			}
		);
		document.l10n.setAttributes(
			document.getElementById('quickCopy-citationInstructions'),
			'preferences-quickCopy-citationInstructions',
			{ citationShortcut: Zotero.getString("command-or-control") + "+C" }
		);
	}
};
