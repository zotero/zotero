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
// Zotero_File_Interface_Bibliography
//
//////////////////////////////////////////////////////////////////////////////

// Class to provide options for bibliography

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
		var sbc = document.getElementById('zotero-bibliography-container');
		Zotero.setFontSize(sbc);
		
		_io = window.arguments[0];
		if(_io.wrappedJSObject){
			_io = _io.wrappedJSObject;
		}
		
		var listbox = document.getElementById("style-listbox");
		var styles = Zotero.Cite.getStyles();
		
		// if no style is set, get the last style used
		if(!_io.style) {
			_io.style = Zotero.Prefs.get("export.lastStyle");
			_saveStyle = true;
		}
		
		// add styles to list
		var index = 0;
		for (var i in styles) {
			var itemNode = document.createElement("listitem");
			itemNode.setAttribute("value", i);
			itemNode.setAttribute("label", styles[i]);
			listbox.appendChild(itemNode);
			
			if(i == _io.style) {
				var selectIndex = index;
			}
			index++;
		}
		
		if (selectIndex < 1) {
			selectIndex = 0;
		}
		
		// Can't select below-the-fold listitems inline in Firefox 2, because that would be too easy
		setTimeout(function () {
			listbox.ensureIndexIsVisible(selectIndex);
			listbox.selectedIndex = selectIndex;
		}, 1);
		
		// ONLY FOR bibliography.xul: export options
		if(document.getElementById("save-as-rtf")) {
			// restore saved bibliographic settings
			document.getElementById(Zotero.Prefs.get("export.bibliographySettings")).setAttribute("selected", "true");
			
			// disable clipboard on the Mac, because it can't support formatted
			// output
			if(Zotero.isMac) {
				document.getElementById("mac-clipboard-warning").hidden = false;
			}
		}
		
		// ONLY FOR integrationDocPrefs.xul: update status of displayAs, set
		// bookmarks text
		if(document.getElementById("displayAs")) {
			if(_io.useEndnotes && _io.useEndnotes == 1) document.getElementById("displayAs").selectedIndex = 1;
			styleChanged(selectIndex);
			
			if(_io.useBookmarks && _io.useBookmarks == 1) document.getElementById("formatUsing").selectedIndex = 1;			
			if(_io.openOffice) {
				var formatOption = "referenceMarks";
			} else {
				var formatOption = "fields";
			}
			document.getElementById("fields").label = Zotero.getString("integration."+formatOption+".label");
			document.getElementById("fields-caption").textContent = Zotero.getString("integration."+formatOption+".caption");
			
			// add border on Windows
			if(Zotero.isWin) {
				document.getElementById("zotero-bibliography-container").style.border = "1px solid black";
			}
		}
		window.sizeToContent();
		window.centerWindowOnScreen();
	}
	
	/*
	 * ONLY FOR integrationDocPrefs.xul: called when style is changed
	 */
	function styleChanged(index) {
		// When called from init(), selectedItem isn't yet set
		if (index != undefined) {
			var selectedItem = document.getElementById("style-listbox").getItemAtIndex(index);
		}
		else {
			var selectedItem = document.getElementById("style-listbox").selectedItem;
		}
		
		var selectedStyle = selectedItem.getAttribute('value');
		
		// update status of displayAs box based
		
		var styleClass = Zotero.Cite.getStyleClass(selectedStyle);
		document.getElementById("displayAs").disabled = styleClass != "note";
	}

	function acceptSelection() {
		// collect code
		_io.style = document.getElementById("style-listbox").selectedItem.value;
		if(document.getElementById("output-radio")) {
			// collect settings
			_io.output = document.getElementById("output-radio").selectedItem.id;
			// save settings
			Zotero.Prefs.set("export.bibliographySettings", _io.output);
		}
		
		// ONLY FOR integrationDocPrefs.xul: collect displayAs
		if(document.getElementById("displayAs")) {
			_io.useEndnotes = document.getElementById("displayAs").selectedIndex;
			_io.useBookmarks = document.getElementById("formatUsing").selectedIndex;
		}
		
		// save style (this happens only for "Export Bibliography," or Word
		// integration when no bibliography style was previously selected)
		if(_saveStyle) {
			Zotero.Prefs.set("export.lastStyle", _io.style);
		}
	}
}