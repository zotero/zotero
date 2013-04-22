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

var Zotero_File_Interface_Bibliography = new function() {
	var _io, _saveStyle;
	
	this.init = init;
	this.styleChanged = styleChanged;
	this.acceptSelection = acceptSelection;
	
	/*
	 * Initialize some variables and prepare event listeners for when chrome is done
	 * loading
	 */
	function init() {
		// Set font size from pref
		// Affects bibliography.xul and integrationDocPrefs.xul
		var bibContainer = document.getElementById("zotero-bibliography-container");
		if(bibContainer) {
			Zotero.setFontSize(document.getElementById("zotero-bibliography-container"));
		}
		
		if(window.arguments && window.arguments.length) {
			_io = window.arguments[0];
			if(_io.wrappedJSObject) _io = _io.wrappedJSObject;
		} else {
			_io = {};
		}
		
		var listbox = document.getElementById("style-listbox");
		var styles = Zotero.Styles.getVisible();
		
		// if no style is set, get the last style used
		if(!_io.style) {
			_io.style = Zotero.Prefs.get("export.lastStyle");
			_saveStyle = true;
		}
		
		// add styles to list
		var index = 0;
		var nStyles = styles.length;
		var selectIndex = -1;
		for(var i=0; i<nStyles; i++) {
			var itemNode = document.createElement("listitem");
			itemNode.setAttribute("value", styles[i].styleID);
			itemNode.setAttribute("label", styles[i].title);
			listbox.appendChild(itemNode);
			
			if(styles[i].styleID == _io.style) {
				selectIndex = index;
			}
			index++;
		}
		
		if (selectIndex < 1) {
			selectIndex = 0;
		}
		
		// Has to be async to work properly
		window.setTimeout(function () {
			listbox.ensureIndexIsVisible(selectIndex);
			listbox.selectedIndex = selectIndex;
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
		
		// ONLY FOR integrationDocPrefs.xul: update status of displayAs, set
		// bookmarks text
		if(document.getElementById("displayAs")) {
			if(_io.useEndnotes && _io.useEndnotes == 1) document.getElementById("displayAs").selectedIndex = 1;
		}
		if(document.getElementById("formatUsing")) {
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
		}
		if(document.getElementById("automaticJournalAbbreviations-checkbox")) {
			if(_io.automaticJournalAbbreviations === undefined) {
				_io.automaticJournalAbbreviations = Zotero.Prefs.get("cite.automaticJournalAbbreviations");
			}
			if(_io.automaticJournalAbbreviations) {
				document.getElementById("automaticJournalAbbreviations-checkbox").checked = true;
			}
		}
		if(document.getElementById("storeReferences")) {
			if(_io.storeReferences || _io.storeReferences === undefined) {
				document.getElementById("storeReferences").checked = true;
				if(_io.requireStoreReferences) document.getElementById("storeReferences").disabled = true;
			}
		}
		
		// set style to false, in case this is cancelled
		_io.style = false;
	}
	
	/*
	 * Called when style is changed
	 */
	function styleChanged(index) {
		// When called from init(), selectedItem isn't yet set
		if (index != undefined) {
			var selectedItem = document.getElementById("style-listbox").getItemAtIndex(index);
		}
		else {
			var selectedItem = document.getElementById("style-listbox").selectedItem;
		}
		
		var selectedStyle = selectedItem.getAttribute('value'),
			selectedStyleObj = Zotero.Styles.get(selectedStyle);
		
		//
		// For integrationDocPrefs.xul
		//
		
		// update status of displayAs box based on style class
		if(document.getElementById("displayAs-groupbox")) {
			var isNote = selectedStyleObj.class == "note";
			document.getElementById("displayAs-groupbox").hidden = !isNote;
			
			// update status of formatUsing box based on style class
			if(document.getElementById("formatUsing")) {
				if(isNote) document.getElementById("formatUsing").selectedIndex = 0;
				document.getElementById("bookmarks").disabled = isNote;
				document.getElementById("bookmarks-caption").disabled = isNote;
			}
		}

		// update status of displayAs box based on style class
		if(document.getElementById("automaticJournalAbbreviations-vbox")) {
			document.getElementById("automaticJournalAbbreviations-vbox").hidden =
				!selectedStyleObj.usesAbbreviation;
		}
		
		//
		// For bibliography.xul
		//
		
		// Change label to "Citation" or "Note" depending on style class
		if(document.getElementById("citations")) {
			if(Zotero.Styles.get(selectedStyle).class == "note") {
				var label = Zotero.getString('citation.notes');
			} else {
				var label = Zotero.getString('citation.citations');
			}
			document.getElementById("citations").label = label;
		}

		window.sizeToContent();
	}

	function acceptSelection() {
		// collect code
		_io.style = document.getElementById("style-listbox").selectedItem.value;
		if(document.getElementById("output-method-radio")) {
			// collect settings
			_io.mode = document.getElementById("output-mode-radio").selectedItem.id;
			_io.method = document.getElementById("output-method-radio").selectedItem.id;
			// save settings
			Zotero.Prefs.set("export.bibliographySettings",
				JSON.stringify({ mode: _io.mode, method: _io.method }));
		}
		
		// ONLY FOR integrationDocPrefs.xul:
		if(document.getElementById("displayAs")) {
			var automaticJournalAbbreviationsEl = document.getElementById("automaticJournalAbbreviations-checkbox");
			_io.automaticJournalAbbreviations = automaticJournalAbbreviationsEl.checked;
			if(!automaticJournalAbbreviationsEl.hidden && _saveStyle) {
				Zotero.Prefs.set("cite.automaticJournalAbbreviations", _io.automaticJournalAbbreviations);
			}
			_io.useEndnotes = document.getElementById("displayAs").selectedIndex;
			_io.fieldType = (document.getElementById("formatUsing").selectedIndex == 0 ? _io.primaryFieldType : _io.secondaryFieldType);
			_io.storeReferences = document.getElementById("storeReferences").checked;
		}
		
		// save style (this happens only for "Export Bibliography," or Word
		// integration when no bibliography style was previously selected)
		if(_saveStyle) {
			Zotero.Prefs.set("export.lastStyle", _io.style);
		}
	}
}