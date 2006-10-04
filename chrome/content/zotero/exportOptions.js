/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright (c) 2006  Center for History and New Media
                        George Mason University, Fairfax, Virginia, USA
                        http://chnm.gmu.edu
    
    Licensed under the Educational Community License, Version 1.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    
    http://www.opensource.org/licenses/ecl1.php
    
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
    
    ***** END LICENSE BLOCK *****
*/

//////////////////////////////////////////////////////////////////////////////
//
// Zotero_File_Interface_Export
//
//////////////////////////////////////////////////////////////////////////////

// Class to provide options for export

var Zotero_File_Interface_Export = new function() {
	this.init = init;
	this.updateOptions = updateOptions;
	this.accept = accept;
	this.cancel = cancel;
	
	/*
	 * add options to export
	 */
	function init() {
		var addedOptions = new Object();
		
		var translators = window.arguments[0].translators;
		
		var listbox = document.getElementById("format-popup");
		var formatMenu = document.getElementById("format-menu");
		var optionsBox = document.getElementById("translator-options");
		
		// add styles to list
		for(i in translators) {
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("label", translators[i].label);
			listbox.appendChild(itemNode);
			
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
						checkbox.setAttribute("id", "export-option-"+option);
						checkbox.setAttribute("label", optionLabel);
						optionsBox.appendChild(checkbox);
					}
					
					addedOptions[option] = true;
				}
			}
		}
		
		// select first item by default
		if(formatMenu.selectedIndex == -1) {
			formatMenu.selectedIndex = 0;
		}
		
		updateOptions();
	}
	
	/*
	 * update translator-specific options
	 */
	function updateOptions() {
		// get selected translator
		var index = document.getElementById("format-menu").selectedIndex;
		var translatorOptions = window.arguments[0].translators[index].displayOptions;
		
		var optionsBox = document.getElementById("translator-options");
		for(var i=0; i<optionsBox.childNodes.length; i++) {
			// loop through options to see which should be enabled
			var node = optionsBox.childNodes[i];
			var optionName = node.getAttribute("id").toString().substr(14);
			
			if(translatorOptions[optionName] != undefined) {
				// option should be enabled
				node.disabled = undefined;
				
				var defValue = translatorOptions[optionName];
				if(typeof(defValue) == "boolean") {
					// if option exists, enable it and set to default value
					node.setAttribute("checked", (defValue ? "true" : "false"));
				}
			} else {
				// option should be disabled and unchecked to prevent confusion
				node.disabled = true;
				node.setAttribute("checked", "false");
			}
		}
	}
	
	/*
	 * make option array reflect status
	 */
	function accept() {
		// set selected translator
		var index = document.getElementById("format-menu").selectedIndex;
		window.arguments[0].selectedTranslator = window.arguments[0].translators[index];
		
		// set options on selected translator
		var optionsAvailable = window.arguments[0].selectedTranslator.displayOptions;
		for(var option in optionsAvailable) {
			var defValue = optionsAvailable[option];
			var element = document.getElementById("export-option-"+option);
			
			if(typeof(defValue) == "boolean") {
				if(element.checked == true) {
					optionsAvailable[option] = true;
				} else {
					optionsAvailable[option] = false;
				}
			}
		}
	}
	
	/*
	 * make option array reflect status
	 */
	function cancel() {
		window.arguments[0].selectedTranslator = false;
	}
}