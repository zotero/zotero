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
	var _io;
	
	this.init = init;
	this.acceptSelection = acceptSelection;
	
	/*
	 * Initialize some variables and prepare event listeners for when chrome is done
	 * loading
	 */
	function init() {
		_io = window.arguments[0];
		if(_io.wrappedJSObject){
			_io = _io.wrappedJSObject;
		}
		
		var listbox = document.getElementById("style-popup");
		var styleMenu = document.getElementById("style-menu");
		var styles = Zotero.Cite.getStyles();
		
		// add styles to list
		for(i in styles) {
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("value", i);
			itemNode.setAttribute("label", styles[i]);
			listbox.appendChild(itemNode);
			
			if(i == _io.style) {
				styleMenu.selectedItem = itemNode;
			}
		}
		
		// select first item by default
		if(styleMenu.selectedIndex == -1) {
			styleMenu.selectedIndex = 0;
		}
		
		// disable clipboard on the Mac, because it can't support formatted
		// output
		if(Zotero.isMac && document.getElementById("copy-to-clipboard") &&
		   !Zotero.Prefs.get("enableMacClipboard")) {
			document.getElementById("copy-to-clipboard").hidden = "true";
		}
		
		// move to center of screen
		window.sizeToContent();
		window.moveTo(
			(self.screen.width-window.innerWidth)/2,
			(self.screen.height-window.innerHeight)/2
		);
	}

	function acceptSelection() {
		// collect code
		_io.style = document.getElementById("style-menu").selectedItem.value;
		if(document.getElementById("output-radio")) {
			_io.output = document.getElementById("output-radio").selectedItem.id;
		}
	}
}