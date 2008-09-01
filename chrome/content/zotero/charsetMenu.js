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

Zotero_Charset_Menu = new function() {
	this.populate = populate;
	
	/**
	 * Populate a character set menu, placing more commonly used character sets
	 * closer to the top
	 *
	 * @param {DOMElement} charsetMenu The menu to populate
	 * @param {Boolean} exportMenu Whether the menu is to be used for export
	 **/
	function populate(charsetMenu, exportMenu) {
		var charsetMap = {};
		
		// get charset popup and charset RDF
		var charsetPopup = document.createElement("menupopup");
		charsetMenu.appendChild(charsetPopup);
		var charsetSeparator = document.createElement("menuseparator");
		charsetPopup.appendChild(charsetSeparator);
		
		var rdfService = Components.classes["@mozilla.org/rdf/rdf-service;1"].
			getService(Components.interfaces.nsIRDFService);
		var RDFCU = Components.classes["@mozilla.org/rdf/container-utils;1"].
			getService(Components.interfaces.nsIRDFContainerUtils);
		var rdfDataSource = rdfService.GetDataSource("rdf:charset-menu");
		var rdfName = rdfService.GetResource("http://home.netscape.com/NC-rdf#Name");
		var rdfContainer = Components.classes["@mozilla.org/rdf/container;1"].
			createInstance(Components.interfaces.nsIRDFContainer);
		rdfContainer.Init(rdfDataSource, rdfService.GetResource("NC:EncodersRoot"));
		var charsets = rdfContainer.GetElements();
		
		// add charsets to popup in order
		while(charsets.hasMoreElements()) {
			var charset = charsets.getNext().QueryInterface(Components.interfaces.nsIRDFResource);
			var label = rdfDataSource.GetTarget(charset, rdfName, true).
				QueryInterface(Components.interfaces.nsIRDFLiteral);
			charset = charset.Value;
			label = label.Value;
			
			var isUTF16 = charset.length >= 6 && charset.substr(0, 6) == "UTF-16";
			
			// Show UTF-16 element appropriately depending on exportMenu
			if(isUTF16 && exportMenu == (charset == "UTF-16") ||
					(!exportMenu && charset == "UTF-32LE")) {
				continue;
			} else if(charset == "x-mac-roman") {
				// use the IANA name
				charset = "macintosh";
			} else if(!exportMenu && charset == "UTF-32BE") {
				label = "Unicode (UTF-32)";
				charset = "UTF-32";
			}
			
			// add element
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("label", label);
			itemNode.setAttribute("value", charset);
			
			charsetMap[charset] = itemNode;
			if(isUTF16 || (label.length > 7 &&
					label.substr(0, 7) == "Western")) {
				charsetPopup.insertBefore(itemNode, charsetSeparator);
			} else if(charset == "UTF-8") {
				var oldFirst = (charsetPopup.firstChild ? charsetPopup.firstChild : null);
				charsetPopup.insertBefore(itemNode, oldFirst);
				// also add (without BOM) if requested
				if(exportMenu) {
					var itemNode = document.createElement("menuitem");
					itemNode.setAttribute("label", Zotero.getString("charset.UTF8withoutBOM"));
					itemNode.setAttribute("value", charset+"xBOM");
					charsetMap[charset+"xBOM"] = itemNode;
					charsetPopup.insertBefore(itemNode, oldFirst);
				}
			} else {
				charsetPopup.appendChild(itemNode);
			}
		}
		
		if(!exportMenu) {
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("label", Zotero.getString("charset.autoDetect"));
			itemNode.setAttribute("value", "auto");
			charsetMap["auto"] = itemNode;
			charsetPopup.insertBefore(itemNode, charsetPopup.firstChild);
		}
		
		return charsetMap;
	}
}