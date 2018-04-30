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
// Zotero_File_Interface_Export
//
//////////////////////////////////////////////////////////////////////////////

const OPTION_PREFIX = "export-option-";

// Class to provide options for export

var Zotero_File_Interface_Export = new function() {
	this.init = init;
	this.updateOptions = updateOptions;
	this.accept = accept;
	this.cancel = cancel;
	
	var _charsets = false;
	
	/*
	 * add options to export
	 */
	function init() {
		// Set font size from pref
		var sbc = document.getElementById('zotero-export-options-container');
		Zotero.setFontSize(sbc);
		
		var addedOptions = new Object();
		
		var translators = window.arguments[0].translators;
		translators.sort(function(a, b) { return a.label.localeCompare(b.label) });
		
		// get format popup
		var formatPopup = document.getElementById("format-popup");
		var formatMenu = document.getElementById("format-menu");
		var optionsBox = document.getElementById("translator-options");
		var charsetBox = document.getElementById("charset-box");
		
		var selectedTranslator = Zotero.Prefs.get("export.lastTranslator");
		
		// add styles to format popup
		for(var i in translators) {
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("label", translators[i].label);
			formatPopup.appendChild(itemNode);
			
			// add options
			for(var option in translators[i].displayOptions) {
				if(!addedOptions[option]) {		// if this option is not already
												// presented to the user
					// get readable name for option
					try {
						var optionLabel = Zotero.getString("exportOptions."+option);
					} catch(e) {
						var optionLabel = option;
					}
					
					// right now, option interface supports only boolean values, which
					// it interprets as checkboxes
					if(typeof(translators[i].displayOptions[option]) == "boolean") {
						var checkbox = document.createElement("checkbox");
						checkbox.setAttribute("id", OPTION_PREFIX+option);
						checkbox.setAttribute("label", optionLabel);
						optionsBox.insertBefore(checkbox, charsetBox);
					}
					
					addedOptions[option] = true;
				}
			}
			
			// select last selected translator
			if(translators[i].translatorID == selectedTranslator) {
				formatMenu.selectedIndex = i;
			}
		}
		
		// select first item by default
		if(formatMenu.selectedIndex == -1) {
			formatMenu.selectedIndex = 0;
		}
		
		// from charsetMenu.js
		if(Zotero.Prefs.get("export.displayCharsetOption")) {
			_charsets = Zotero_Charset_Menu.populate(document.getElementById(OPTION_PREFIX+"exportCharset"), true);
		}
		
		updateOptions(Zotero.Prefs.get("export.translatorSettings"));
	}
	
	/*
	 * update translator-specific options
	 */
	function updateOptions(optionString) {
		// get selected translator
		var index = document.getElementById("format-menu").selectedIndex;
		var translatorOptions = window.arguments[0].translators[index].displayOptions;
		
		if(optionString) {
			try {
				var options = JSON.parse(optionString);
			} catch(e) {}
		}
		
		var optionsBox = document.getElementById("translator-options");
		optionsBox.hidden = true;
		var haveOption = false;
		for(var i=0; i<optionsBox.childNodes.length; i++) {
			// loop through options to see which should be enabled
			var node = optionsBox.childNodes[i];
			// skip non-options
			if(node.id.length <= OPTION_PREFIX.length
					|| node.id.substr(0, OPTION_PREFIX.length) != OPTION_PREFIX) {
				continue;
			}
			
			var optionName = node.id.substr(OPTION_PREFIX.length);
			if (translatorOptions && translatorOptions[optionName] != undefined) {
				// option should be enabled
				optionsBox.hidden = undefined;
				node.hidden = undefined;
				
				var defValue = translatorOptions[optionName];
				if(typeof(defValue) == "boolean") {
					if(options && options[optionName] !== undefined) {
						// if there's a saved prefs string, use it
						var isChecked = options[optionName];
					} else {
						// use defaults
						var isChecked = (defValue ? "true" : "false");
					}
					node.setAttribute("checked", isChecked);
				}
			} else {
				// option should be disabled and unchecked to prevent confusion
				node.hidden = true;
				node.checked = false;
			}
		}
		
		// handle charset popup
		if(_charsets && translatorOptions && translatorOptions.exportCharset) {
			optionsBox.hidden = undefined;
			document.getElementById("charset-box").hidden = undefined;
			var charsetMenu = document.getElementById(OPTION_PREFIX+"exportCharset");
			var charset = "UTF-8";
			if(options && options.exportCharset && _charsets[options.exportCharset]) {
				charset = options.exportCharset;
			} else if(translatorOptions.exportCharset && _charsets[translatorOptions.exportCharset]) {
				charset = translatorOptions.exportCharset;
			}
			
			charsetMenu.selectedItem = _charsets[charset];
		} else {
			document.getElementById("charset-box").hidden = true;
		}
		
		window.sizeToContent();
	}
	
	/*
	 * make option array reflect status
	 */
	function accept() {
		// set selected translator
		var index = document.getElementById("format-menu").selectedIndex;
		window.arguments[0].selectedTranslator = window.arguments[0].translators[index];
		
		// save selected translator
		Zotero.Prefs.set("export.lastTranslator", window.arguments[0].translators[index].translatorID);
		
		// set options on selected translator and generate optionString
		var optionsAvailable = window.arguments[0].selectedTranslator.displayOptions;
		var displayOptions = window.arguments[0].displayOptions = {};
		for(var option in optionsAvailable) {
			var defValue = optionsAvailable[option];
			var element = document.getElementById(OPTION_PREFIX+option);
			
			if(option == "exportCharset") {
				if(_charsets) {
					displayOptions[option] = element.selectedItem.value;
				} else {
					displayOptions[option] = optionsAvailable[option];
				}
			} else if(typeof(defValue) == "boolean") {
				displayOptions[option] = !!element.checked;
			}
		}
		
		// save options
		var optionString = JSON.stringify(displayOptions);
		Zotero.Prefs.set("export.translatorSettings", optionString);
	}
	
	/*
	 * make option array reflect status
	 */
	function cancel() {
		window.arguments[0].selectedTranslator = false;
	}
}