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

//////////////////////////////////////////////////////////////////////////////
//
// Zotero_File_Interface_Bibliography
//
//////////////////////////////////////////////////////////////////////////////

// Class to provide options for bibliography
// Used by integrationDocPrefs.xhtml and bibliography.xhtml

window.Zotero_File_Interface_Bibliography = new function () {
	var _io;
	
	// Only changes when explicitly selected
	var lastSelectedStyle,
		lastSelectedLocale;
	
	var styleConfigurator;

	/**
	 * @type {"bibliography" | "docPrefs"}
	 */
	var windowType;
	
	/**
	 * Initialize some variables and prepare event listeners for when chrome is done
	 * loading
	 *
	 * @param {Object} [args] - Explicit arguments in place of window arguments
	 */
	this.init = async function (args = {}) {
		window.addEventListener('dialogaccept', () => this.acceptSelection());
		window.addEventListener('dialoghelp', () => this.openHelpLink());

		// Set font size from pref
		// Affects bibliography.xhtml and integrationDocPrefs.xhtml
		var bibContainer = document.getElementById("zotero-bibliography-container");
		if (bibContainer) {
			Zotero.UIProperties.registerRoot(bibContainer);
		}
		
		if (window.arguments && window.arguments.length) {
			_io = window.arguments[0];
			if (_io.wrappedJSObject) _io = _io.wrappedJSObject;
		}
		else if (args) {
			_io = args;
		}
		else {
			_io = {};
		}

		windowType = {
			"integration-doc-prefs": "docPrefs",
			"bibliography-window": "bibliography"
		}[document.querySelector("window").id];
		
		styleConfigurator = document.querySelector("#style-configurator");
		
		// if no style is requested, get the last style used
		if (!_io.style) {
			_io.style = Zotero.Prefs.get("export.lastStyle");
		}
		
		// See note in style.js
		if (!Zotero.Styles.initialized()) {
			// Initialize styles
			await Zotero.Styles.init();
		}
		
		// Wait for CE initialization
		let i = 0;
		while (!styleConfigurator.initialized && i < 300) {
			await Zotero.Promise.delay(10);
			i++;
		}

		// Select supplied style and locale
		if (_io.style) {
			styleConfigurator.style = _io.style;
			if (styleConfigurator.style !== _io.style) {
				styleConfigurator.style = styleConfigurator.styles[0];
			}
			else if (_io.locale) {
				styleConfigurator.locale = _io.locale;
			}
		}

		if (_io.supportedNotes?.length < 1) {
			styleConfigurator.toggleAttribute("no-multi-notes", true);
		}

		styleConfigurator.addEventListener("select", event => this.styleChanged(event));

		styleConfigurator.toggleAttribute("show-manage-styles", true);
		styleConfigurator.addEventListener("manage-styles", this.manageStyles.bind(this));
		
		this.initBibWindow();

		this.initDocPrefsWindow();

		setTimeout(() => this.updateWindowSize(), 0);
		
		// set style to false, in case this is cancelled
		_io.style = false;
	};

	this.initBibWindow = function () {
		if (windowType !== "bibliography") return;
		var settings = Zotero.Prefs.get("export.bibliographySettings");
		try {
			settings = JSON.parse(settings);
			var mode = settings.mode;
			var method = settings.method;
		}
		// If not JSON, assume it's the previous format-as-a-string
		catch (e) {
			method = settings;
		}
		if (!mode) mode = "bibliography";
		if (!method) method = "save-as-rtf";
		
		// restore saved bibliographic settings
		document.getElementById('output-mode-radio').selectedItem
			= document.getElementById(mode);
		document.getElementById('output-method-radio').selectedItem
			= document.getElementById(method);
		
		this.onBibWindowStyleChange();
	};

	this.initDocPrefsWindow = function () {
		if (windowType !== "docPrefs") return;
		this.toggleAdvancedOptions(true);
		document.querySelector(".advanced-header").addEventListener("click", () => this.toggleAdvancedOptions());

		if (_io.useEndnotes == 1) {
			styleConfigurator.displayAs = "endnotes";
		}
		
		if (document.getElementById("formatUsing-container")) {
			if (["Field", "ReferenceMark"].includes(_io.primaryFieldType)) {
				if (_io.fieldType == "Bookmark") document.getElementById("formatUsingBookmarks").checked = true;
				document.getElementById("bookmarks-file-format-notice").dataset.l10nArgs = '{"show": "true"}';
			}
			else {
				let formatUsing = document.getElementById("formatUsing-container");
				formatUsing.hidden = true;
				formatUsing.toggleAttribute("always-hidden", true);
				_io.fieldType = _io.primaryFieldType;
			}
		}
		if (document.getElementById("automaticJournalAbbreviations")) {
			if (_io.automaticJournalAbbreviations === undefined) {
				_io.automaticJournalAbbreviations = Zotero.Prefs.get("cite.automaticJournalAbbreviations");
			}
			if (_io.automaticJournalAbbreviations) {
				document.getElementById("automaticJournalAbbreviations").checked = true;
			}
			
			document.getElementById("automaticCitationUpdates-checkbox").checked = !_io.delayCitationUpdates;
		}
		
		if (_io.showImportExport) {
			document.querySelector('#exportImport').hidden = false;
		}

		document.querySelector("#exportDocument")?.addEventListener("command", this.exportDocument.bind(this));

		this.onDocPrefsWindowStyleChange(Zotero.Styles.get(styleConfigurator.style));

		// If any advanced options are checked, expand the advanced options section
		let hasCheckedAdvancedOption
			= !!Array.from(document.querySelectorAll(".advanced-checkbox"))
				.find(elem => elem.checked);
		if (hasCheckedAdvancedOption) {
			this.toggleAdvancedOptions(false);
		}
	};
	
	this.openHelpLink = function () {
		Zotero.launchURL("https://www.zotero.org/support/word_processor_integration");
	};

	/*
	 * Called when style is changed
	 */
	this.styleChanged = function (event) {
		lastSelectedStyle = styleConfigurator.style;
		lastSelectedLocale = styleConfigurator.locale;
		let selectedStyleObj = Zotero.Styles.get(lastSelectedStyle);
		if (event.detail?.type === "style") {
			this.onBibWindowStyleChange(selectedStyleObj);
			this.onDocPrefsWindowStyleChange(selectedStyleObj);
		}
		this.updateWindowSize();
	};

	this.onBibWindowStyleChange = function (style = undefined) {
		if (windowType !== "bibliography") return;
		if (!style) {
			style = Zotero.Styles.get(styleConfigurator.style);
		}
		if (!style) return;
		let citations = document.getElementById("citations");
		// Change label to "Citation" or "Note" depending on style class
		citations.dataset.l10nArgs = `{"type": "${style.class}"}`;
	};

	this.onDocPrefsWindowStyleChange = function (style) {
		if (windowType !== "docPrefs") return;

		let isNote = style.class == "note";
		// update status of formatUsing box based on style class
		if (isNote) document.querySelector("#formatUsingBookmarks").checked = false;
		let formatUsing = document.querySelector("#formatUsing-container");
		if (!formatUsing.hasAttribute("always-hidden")) {
			formatUsing.hidden = isNote;
		}
		
		let usesAbbreviation = style.usesAbbreviation;
		document.querySelector("#automaticJournalAbbreviations-container").hidden = !usesAbbreviation;

		let advancedOptions = document.querySelector(".advanced-options");
		let hasEnabledOption
			= !!Array.from(advancedOptions.querySelector(".advanced-body").childNodes)
				.find(elem => !elem.hidden);
		advancedOptions.hidden = !hasEnabledOption;
	};

	this.acceptSelection = function () {
		// collect code
		_io.style = styleConfigurator.style;
		
		_io.locale = styleConfigurator.locale;
		
		this.onBibWindowAccept();
		
		this.onDocPrefsWindowAccept();
		
		// remember style and locale if user selected these explicitly
		if (lastSelectedStyle) {
			Zotero.Prefs.set("export.lastStyle", _io.style);
		}
		
		if (lastSelectedLocale) {
			Zotero.Prefs.set("export.lastLocale", lastSelectedLocale);
		}
	};

	this.onBibWindowAccept = function () {
		if (windowType !== "bibliography") return;
		// collect settings
		_io.mode = document.getElementById("output-mode-radio").selectedItem.id;
		_io.method = document.getElementById("output-method-radio").selectedItem.id;
		// save settings
		Zotero.Prefs.set("export.bibliographySettings",
			JSON.stringify({ mode: _io.mode, method: _io.method }));
	};

	this.onDocPrefsWindowAccept = function () {
		if (windowType !== "docPrefs") return;
		var automaticJournalAbbreviationsEl = document.getElementById("automaticJournalAbbreviations");
		_io.automaticJournalAbbreviations = automaticJournalAbbreviationsEl.checked;
		if (!automaticJournalAbbreviationsEl.hidden && lastSelectedStyle) {
			Zotero.Prefs.set("cite.automaticJournalAbbreviations", _io.automaticJournalAbbreviations);
		}
		_io.useEndnotes = styleConfigurator.displayAs == "endnotes" ? 1 : 0;
		_io.fieldType = (document.getElementById("formatUsingBookmarks").checked ? _io.secondaryFieldType : _io.primaryFieldType);
		_io.delayCitationUpdates = !document.getElementById("automaticCitationUpdates-checkbox").checked;
	};
	
	
	this.manageStyles = function () {
		_io.dontActivateDocument = true;
		document.querySelector('dialog').cancelDialog();
		var win = Zotero.Utilities.Internal.openPreferences('zotero-prefpane-cite', {
			scrollTo: '#styles'
		});
		if (window.isDocPrefs) {
			Zotero.Utilities.Internal.activate(win);
		}
	};

	this.updateWindowSize = function () {
		this.resizeWindow();
		// Keep in sync with _styleConfigurator.scss
		const defaultListMaxHeight = 260;
		const listMaxHeightProp = "--style-configurator-richlistitem-max-height";
		let currentListMaxHeight = parseFloat(document.documentElement.style.getPropertyValue(listMaxHeightProp));
		let overflow = window.outerHeight - window.screen.availHeight;
		if (overflow > 0) {
			let styleList = document.querySelector("#style-list");
			let currentHeight = styleList.clientHeight;
			let newHeight = Math.max(currentHeight - overflow, 100);
			document.documentElement.style.setProperty(listMaxHeightProp, `${newHeight}px`);
			this.resizeWindow();
		}
		else if (!isNaN(currentListMaxHeight) && currentListMaxHeight < defaultListMaxHeight) {
			let newHeight = Math.min(defaultListMaxHeight, currentListMaxHeight + Math.abs(overflow));
			document.documentElement.style.setProperty(listMaxHeightProp, `${newHeight}px`);
			this.resizeWindow();
		}
	};

	this.resizeWindow = function () {
		document.documentElement.style.removeProperty("min-height");
		window.sizeToContent();
		document.documentElement.style.minHeight = document.documentElement.clientHeight + "px";
	};

	/**
	 * Toggle advanced options
	 * only called from docPrefs
	 */
	this.toggleAdvancedOptions = function (collapsed = undefined) {
		let header = document.querySelector(".advanced-header");
		if (typeof collapsed === "undefined") {
			collapsed = !header.classList.contains("collapsed");
		}
		document.querySelector(".advanced-body").hidden = collapsed;
		header.classList.toggle("collapsed", collapsed);
		this.updateWindowSize();
	};

	/**
	 * Export the document
	 * only called from docPrefs
	 */
	this.exportDocument = function () {
		if (Zotero.Integration.confirmExportDocument()) {
			_io.exportDocument = true;
			document.querySelector('dialog').acceptDialog();
		}
	};
};
