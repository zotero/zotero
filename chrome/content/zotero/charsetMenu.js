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

var Zotero_Charset_Menu = new function() {
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
		
		var charsets = [];
		
		// Only list UTF-8 and Western for export
		if (exportMenu) {
			charsets.push(
				{ label: "Unicode (UTF-8)", value: "UTF-8" },
				{ label: Zotero.getString("charset.UTF8withoutBOM"), value: "UTF-8xBOM" },
				{ label: "Western", value: "windows-1252" }
			);
			
			for (let charset of charsets) {
				let { label, value } = charset;
	
				let itemNode = document.createElement("menuitem");
				itemNode.setAttribute("label", label);
				itemNode.setAttribute("value", value);
				
				charsetMap[value] = itemNode;
				charsetPopup.appendChild(itemNode);
			}
		}
		else {
			var charsetSeparator = document.createElement("menuseparator");
			charsetPopup.appendChild(charsetSeparator);
			
			Components.utils.import("resource://gre/modules/CharsetMenu.jsm");
			var cmData = CharsetMenu.getData();
			for (let charsetList of [cmData.pinnedCharsets, cmData.otherCharsets]) {
				for (let charsetInfo of charsetList) {
					if(charsetInfo.value == "UTF-8") {
						charsets.push({
							"label":"Unicode (UTF-8)",
							"value":"UTF-8"
						});
					} else {
						charsets.push({
							"label":charsetInfo.label,
							"value":charsetInfo.value
						});
					}
				}
			}
			charsets = charsets.concat([
				{"label":"UTF-16LE", "value":"UTF-16LE"},
				{"label":"UTF-16BE", "value":"UTF-16BE"},
				{"label":"Western (IBM-850)", "value":"IBM850"},
				{"label":"Western (MacRoman)", "value":"macintosh"}
			]);
		
			for(var i=0; i<charsets.length; i++) {
				var charset = charsets[i].value,
					label = charsets[i].label;
	
				// add element
				var itemNode = document.createElement("menuitem");
				itemNode.setAttribute("label", label);
				itemNode.setAttribute("value", charset);
				
				charsetMap[charset] = itemNode;
				if (label.length >= 7 && label.substr(0, 7) == "Western") {
					charsetPopup.insertBefore(itemNode, charsetSeparator);
				} else if(charset == "UTF-8") {
					var oldFirst = (charsetPopup.firstChild ? charsetPopup.firstChild : null);
					charsetPopup.insertBefore(itemNode, oldFirst);
				} else {
					charsetPopup.appendChild(itemNode);
				}
			}
			
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("label", Zotero.getString("charset.autoDetect"));
			itemNode.setAttribute("value", "auto");
			charsetMap["auto"] = itemNode;
			charsetPopup.insertBefore(itemNode, charsetPopup.firstChild);
		}
		
		return charsetMap;
	}
}