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
// Used by rtfScan.xul, integrationDocPrefs.xul, and bibliography.xul

Components.utils.import("resource://gre/modules/Services.jsm");
var Zotero_File_Interface_Bibliography = new function() {
	var _io;
	
	// Only changes when explicitly selected
	var lastSelectedStyle,
		lastSelectedLocale;
	
	var isDocPrefs = false;
	var isRTFScan = false;
	
	/**
	 * Initialize some variables and prepare event listeners for when chrome is done
	 * loading
	 *
	 * @param {Object} [args] - Explicit arguments in place of window arguments
	 */
	this.init = Zotero.Promise.coroutine(function* (args = {}) {
		// Set font size from pref
		// Affects bibliography.xul and integrationDocPrefs.xul
		var bibContainer = document.getElementById("zotero-bibliography-container");
		if(bibContainer) {
			Zotero.setFontSize(document.getElementById("zotero-bibliography-container"));
		}
		
		if(window.arguments && window.arguments.length) {
			_io = window.arguments[0];
			if(_io.wrappedJSObject) _io = _io.wrappedJSObject;
		}
		else if (args) {
			_io = args;
		}
		else {
			_io = {};
		}
		
		var listbox = document.getElementById("style-listbox");
		
		// if no style is requested, get the last style used
		if(!_io.style) {
			_io.style = Zotero.Prefs.get("export.lastStyle");
		}
		
		// See note in style.js
		if (!Zotero.Styles.initialized) {
			// Initialize styles
			yield Zotero.Styles.init();
		}
		
		// add styles to list
		
		var styles = Zotero.Styles.getVisible();
		var selectIndex = null;
		for (let i=0; i < styles.length; i++) {
			var itemNode = document.createElement("listitem");
			itemNode.setAttribute("value", styles[i].styleID);
			itemNode.setAttribute("label", styles[i].title);
			listbox.appendChild(itemNode);
			
			if(styles[i].styleID == _io.style) {
				selectIndex = i;
			}
		}
		
		let requestedLocale;
		if (selectIndex === null) {
			// Requested style not found in list, pre-select first style
			selectIndex = 0;
		} else {
			requestedLocale = _io.locale;
		}
		
		let style = styles[selectIndex];
		lastSelectedLocale = Zotero.Prefs.get("export.lastLocale");
		if (requestedLocale && style && !style.locale) {
			// pre-select supplied locale
			lastSelectedLocale = requestedLocale;
		}
		
		// add locales to list
		Zotero.Styles.populateLocaleList(document.getElementById("locale-menu"));
		
		// Has to be async to work properly
		window.setTimeout(function () {
			listbox.ensureIndexIsVisible(selectIndex);
			listbox.selectedIndex = selectIndex;
			if (listbox.selectedIndex == -1) {
				// This can happen in tests if styles aren't loaded
				Zotero.debug("No styles to select", 2);
				return;
			}
			Zotero_File_Interface_Bibliography.styleChanged();
		}, 0);
		
		// ONLY FOR bibliography.xul: export options
		if(document.getElementById("save-as-rtf")) {
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
			document.getElementById('output-mode-radio').selectedItem =
				document.getElementById(mode);
			document.getElementById('output-method-radio').selectedItem =
				document.getElementById(method);
		}
		
		// ONLY FOR integrationDocPrefs.xul: set selected endnotes/footnotes
		isDocPrefs = !!document.getElementById("displayAs");
		isRTFScan = !document.getElementById("formatUsing");
		if (isDocPrefs && !isRTFScan) {
			if(_io.useEndnotes && _io.useEndnotes == 1) document.getElementById("displayAs").selectedIndex = 1;
			
			let dialog = document.getElementById("zotero-doc-prefs-dialog");
			dialog.setAttribute('title', `${Zotero.clientName} - ${dialog.getAttribute('title')}`);
			
			if (document.getElementById("formatUsing-groupbox")) {
				if (["Field", "ReferenceMark"].includes(_io.primaryFieldType)) {
					if(_io.fieldType == "Bookmark") document.getElementById("formatUsing").selectedIndex = 1;
					var formatOption = (_io.primaryFieldType == "ReferenceMark" ? "referenceMarks" : "fields");
					document.getElementById("fields").label =
						Zotero.getString("integration."+formatOption+".label");
					document.getElementById("fields-caption").textContent =
						Zotero.getString("integration."+formatOption+".caption");
					document.getElementById("fields-file-format-notice").textContent =
						Zotero.getString("integration."+formatOption+".fileFormatNotice");
					document.getElementById("bookmarks-file-format-notice").textContent =
						Zotero.getString("integration.fields.fileFormatNotice");
				} else {
					document.getElementById("formatUsing-groupbox").style.display = "none";
					_io.fieldType = _io.primaryFieldType;
				}
			}
			if(document.getElementById("automaticJournalAbbreviations-checkbox")) {
				if(_io.automaticJournalAbbreviations === undefined) {
					_io.automaticJournalAbbreviations = Zotero.Prefs.get("cite.automaticJournalAbbreviations");
				}
				if(_io.automaticJournalAbbreviations) {
					document.getElementById("automaticJournalAbbreviations-checkbox").checked = true;
				}
				
				document.getElementById("automaticCitationUpdates-checkbox").checked = !_io.delayCitationUpdates;
			}
			
			if (_io.showImportExport) {
				document.querySelector('#exportImport').hidden = false;
			}
		}
		
		// set style to false, in case this is cancelled
		_io.style = false;
	});
	
	this.openHelpLink = function() {
		Zotero.launchURL("https://www.zotero.org/support/word_processor_integration");
	};

	/*
	 * Called when locale is changed
	 */
	this.localeChanged = function (selectedValue) {
		lastSelectedLocale = selectedValue;
	};

	/*
	 * Called when style is changed
	 */
	this.styleChanged = function () {
		var selectedItem = document.getElementById("style-listbox").selectedItem;
		lastSelectedStyle = selectedItem.getAttribute('value');
		var selectedStyleObj = Zotero.Styles.get(lastSelectedStyle);
		
		updateLocaleMenu(selectedStyleObj);
		
		//
		// For integrationDocPrefs.xul and rtfScan.xul
		//
		if (isDocPrefs) {
			// update status of displayAs box based on style class
			var isNote = selectedStyleObj.class == "note";
			var multipleNotesSupported = _io.supportedNotes.length > 1;
			document.getElementById("displayAs-groupbox").hidden = !isNote || !multipleNotesSupported;
			
			// update status of formatUsing box based on style class
			if (document.getElementById("formatUsing")) {
				if(isNote) document.getElementById("formatUsing").selectedIndex = 0;
				document.getElementById("bookmarks").disabled = isNote;
				document.getElementById("bookmarks-caption").disabled = isNote;
			}
			
			// update status of displayAs box based on style class
			if (document.getElementById("automaticJournalAbbreviations-vbox")) {
				document.getElementById("automaticJournalAbbreviations-vbox").hidden =
					!selectedStyleObj.usesAbbreviation;
			}
		}
		
		//
		// For bibliography.xul
		//
		
		// Change label to "Citation" or "Note" depending on style class
		if(document.getElementById("citations")) {
			let label = "";
			if(Zotero.Styles.get(lastSelectedStyle).class == "note") {
				label = Zotero.getString('citation.notes');
			} else {
				label = Zotero.getString('citation.citations');
			}
			document.getElementById("citations").label = label;
		}

		window.sizeToContent();
	};
	
	this.exportDocument = function () {
		if (Zotero.Integration.confirmExportDocument()) {
			_io.exportDocument = true;
			document.documentElement.acceptDialog();
		}
	}
	
	/*
	 * Update locale menulist when style is changed
	 */
	function updateLocaleMenu(selectedStyle) {
		Zotero.Styles.updateLocaleList(
			document.getElementById("locale-menu"),
			selectedStyle,
			lastSelectedLocale
		);
	}

	this.acceptSelection = function () {
		// collect code
		_io.style = document.getElementById("style-listbox").value;
		
		let localeMenu = document.getElementById("locale-menu");
		_io.locale = localeMenu.disabled ? undefined : localeMenu.value;
		
		if(document.getElementById("output-method-radio")) {
			// collect settings
			_io.mode = document.getElementById("output-mode-radio").selectedItem.id;
			_io.method = document.getElementById("output-method-radio").selectedItem.id;
			// save settings
			Zotero.Prefs.set("export.bibliographySettings",
				JSON.stringify({ mode: _io.mode, method: _io.method }));
		}
		
		// ONLY FOR integrationDocPrefs.xul:
		if(isDocPrefs) {
			var automaticJournalAbbreviationsEl = document.getElementById("automaticJournalAbbreviations-checkbox");
			_io.automaticJournalAbbreviations = automaticJournalAbbreviationsEl.checked;
			if(!automaticJournalAbbreviationsEl.hidden && lastSelectedStyle) {
				Zotero.Prefs.set("cite.automaticJournalAbbreviations", _io.automaticJournalAbbreviations);
			}
			_io.useEndnotes = document.getElementById("displayAs").selectedIndex;
			_io.fieldType = (document.getElementById("formatUsing").selectedIndex == 0 ? _io.primaryFieldType : _io.secondaryFieldType);
			_io.delayCitationUpdates = !document.getElementById("automaticCitationUpdates-checkbox").checked;
		}
		
		// remember style and locale if user selected these explicitly
		if(lastSelectedStyle) {
			Zotero.Prefs.set("export.lastStyle", _io.style);
		}
		
		if (lastSelectedLocale) {
			Zotero.Prefs.set("export.lastLocale", lastSelectedLocale);
		}
	};
	
	
	this.manageStyles = function () {
		document.documentElement.getButton('cancel').click();
		var win = Zotero.Utilities.Internal.openPreferences('zotero-prefpane-cite', { tab: 'styles-tab' });
		if (isDocPrefs) {
			Zotero.Utilities.Internal.activate(win);
		}
	};
}
