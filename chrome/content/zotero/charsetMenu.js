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
		var charsetSeparator = document.createElement("menuseparator");
		charsetPopup.appendChild(charsetSeparator);
		
		var charsets = [];

		if(Zotero.platformMajorVersion >= 32) {
			Components.utils.import("resource://gre/modules/CharsetMenu.jsm");
			var cmData = CharsetMenu.getData();
			for each(var charsetList in [cmData.pinnedCharsets, cmData.otherCharsets]) {
				for each(var charsetInfo in charsetList) {
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
		} else {
			var charsetConverter = Components.classes["@mozilla.org/charset-converter-manager;1"].
				getService(Components.interfaces.nsICharsetConverterManager);
			var ccCharsets = charsetConverter.getEncoderList();
			// add charsets to popup in order
			while(ccCharsets.hasMore()) {
				var charset = ccCharsets.getNext();
				try {
					var label = charsetConverter.getCharsetTitle(charset);
				} catch(e) {
					continue;
				}

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
				charsets.push({
					"label":label,
					"value":charset
				});
			}
		}

		for(var i=0; i<charsets.length; i++) {
			var charset = charsets[i].value,
			    label = charsets[i].label;

			// add element
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("label", label);
			itemNode.setAttribute("value", charset);
			
			charsetMap[charset] = itemNode;
			if(isUTF16 || (label.length >= 7 &&
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