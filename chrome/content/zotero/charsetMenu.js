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
	 * @param {Boolean} [exportMenu] Whether the menu is to be used for export
	 **/
	function populate(charsetMenu, exportMenu) {
		var charsetMap = {};
		
		// get charset popup and charset RDF
		var charsetPopup = document.createElement("menupopup");
		charsetMenu.appendChild(charsetPopup);
		var charsetSeparator = document.createElement("menuseparator");
		charsetPopup.appendChild(charsetSeparator);
		
		var charsets = [], pinnedCharsets = [];
		if (Zotero.platformMajorVersion >= 32) {
			Components.utils.import("resource://gre/modules/CharsetMenu.jsm");
			var cmData = CharsetMenu.getData();
			for each(var charsetList in [cmData.pinnedCharsets, cmData.otherCharsets]) {
				let pinned = charsetList === cmData.pinnedCharsets;
				
				for each(var charsetInfo in charsetList) {
					if (charsetInfo.value == "UTF-8") {
						charsets.push({
							"label":Zotero.getString("charset.unicode", [charsetInfo.value]),
							"value":"UTF-8"
						});
					} else {
						charsets.push({
							"label":charsetInfo.label,
							"value":charsetInfo.value
						});
					}
					
					if (pinned) pinnedCharsets.push(charsetInfo.value.toUpperCase());
				}
			}
			charsets = charsets.concat([
				{"label":Zotero.getString("charset.unicode", ["UTF-16LE"]), "value":"UTF-16LE"},
				{"label":Zotero.getString("charset.unicode", ["UTF-16BE"]), "value":"UTF-16BE"},
				{"label":Zotero.getString("charset.western", ["IBM-850"]), "value":"IBM850"},
				{"label":Zotero.getString("charset.western", ["MacRoman"]), "value":"macintosh"}
			]);
		} else {
			var charsetConverter = Components.classes["@mozilla.org/charset-converter-manager;1"].
				getService(Components.interfaces.nsICharsetConverterManager);
			var ccCharsets = charsetConverter.getEncoderList();
			// add charsets to popup in order
			while (ccCharsets.hasMore()) {
				var charset = ccCharsets.getNext();
				try {
					var label = charsetConverter.getCharsetTitle(charset);
				} catch(e) {
					continue;
				}
				
				if (charset == "UTF-16") {
					// Don't add plain UTF-16. Be specific about endianness
					continue;
				} else if (charset == "x-mac-roman") {
					// use the IANA name
					charset = "macintosh";
				}
				
				charsets.push({
					"label":label,
					"value":charset
				});
			}
			
			pinnedCharsets = ['UTF-8', 'WINDOWS-1252'];
		}
		
		// Add BOM option for UTF-8 in export menu only
		if (exportMenu) {
			charsets.push({
				label: Zotero.getString("charset.unicode", [Zotero.getString("charset.withBOM", ["UTF-8"])]),
				value: "UTF-8xBOM"
			});
		}
		
		// Sort in alphabetical order. Pinned items will get special treatment later
		charsets.sort(function(a, b) {
			return a.label.localeCompare(b.label);
		});
		
		for (var i=0; i<charsets.length; i++) {
			var charset = charsets[i].value,
				label = charsets[i].label;

			// add element
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("label", label);
			itemNode.setAttribute("value", charset);
			
			charsetMap[charset] = itemNode;
			let pinnedIndex = pinnedCharsets.indexOf(charset.toUpperCase());
			if (pinnedIndex != -1) {
				// Insert at the top according to the order in pinnedCharsets
				let pinnedNode = charsetPopup.firstChild;
				while (pinnedNode && pinnedNode != charsetSeparator
					&& pinnedCharsets.indexOf(pinnedNode.getAttribute("value").toUpperCase()) < pinnedIndex
				) {
					pinnedNode = pinnedNode.nextSibling;
				}
				charsetPopup.insertBefore(itemNode, pinnedNode);
			} else {
				charsetPopup.appendChild(itemNode);
			}
		}
		
		if (!exportMenu) {
			var itemNode = document.createElement("menuitem");
			itemNode.setAttribute("label", Zotero.getString("charset.autoDetect"));
			itemNode.setAttribute("value", "auto");
			charsetMap["auto"] = itemNode;
			charsetPopup.insertBefore(itemNode, charsetPopup.firstChild);
		}
		
		return charsetMap;
	}
}