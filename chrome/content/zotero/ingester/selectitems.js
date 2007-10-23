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
// Zotero_Ingester_Interface_SelectItems
//
//////////////////////////////////////////////////////////////////////////////

// Class to interface with the browser when ingesting data

var Zotero_Ingester_Interface_SelectItems = function() {}

//////////////////////////////////////////////////////////////////////////////
//
// Public Zotero_Ingester_Interface_SelectItems methods
//
//////////////////////////////////////////////////////////////////////////////

/*
 * Initialize some variables and prepare event listeners for when chrome is done
 * loading
 */
Zotero_Ingester_Interface_SelectItems.init = function() {
	// Set font size from pref
	var sbc = document.getElementById('zotero-select-items-container');
	Zotero.setFontSize(sbc);
	
	this.io = window.arguments[0];
	var listbox = document.getElementById("zotero-selectitems-links");
	
	for(i in this.io.dataIn) {	// we could use a tree for this if we wanted to
		var itemNode = document.createElement("listitem");
		itemNode.setAttribute("type", "checkbox");
		itemNode.setAttribute("value", i);
		itemNode.setAttribute("label", this.io.dataIn[i]);
		itemNode.setAttribute("checked", false);
		listbox.appendChild(itemNode);
	}
}

Zotero_Ingester_Interface_SelectItems.selectAll = function(deselect) {
	var listbox = document.getElementById("zotero-selectitems-links");
	for (var i=0; i<listbox.childNodes.length; i++){
		listbox.childNodes[i].setAttribute('checked', !deselect);
	}
}

Zotero_Ingester_Interface_SelectItems.acceptSelection = function() {
	var listbox = document.getElementById("zotero-selectitems-links");
	
	var returnObject = false;
	this.io.dataOut = new Object();
	
	// collect scrapeURLList from listbox
	for(var i=0; i<listbox.childNodes.length; i++) {
		var itemNode = listbox.childNodes[i];
		if(itemNode.getAttribute("checked") == "true") {
			this.io.dataOut[itemNode.getAttribute("value")] = itemNode.getAttribute("label");
			returnObject = true;
		}
	}
	
	// What a hack! this makes code down the road much easier because otherwise
	// an empty array is true but empty and we can't figure that out, because
	// there's no length
	if(!returnObject) {
		this.io.dataOut = null;
	}
}