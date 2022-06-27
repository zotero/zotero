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


// Pulled from Fx63
const CHARSET_MENU_DATA = {
	"pinnedCharsets": [
		{
			"label": "Unicode",
			"value": "UTF-8"
		},
		{
			"label": "Western",
			"value": "windows-1252"
		}
	],
	"otherCharsets": [
		{
			"label": "Arabic (Windows)",
			"value": "windows-1256"
		},
		{
			"label": "Arabic (ISO)",
			"value": "ISO-8859-6"
		},
		{
			"label": "Baltic (Windows)",
			"value": "windows-1257"
		},
		{
			"label": "Baltic (ISO)",
			"value": "ISO-8859-4"
		},
		{
			"label": "Central European (Windows)",
			"value": "windows-1250"
		},
		{
			"label": "Central European (ISO)",
			"value": "ISO-8859-2"
		},
		{
			"label": "Chinese, Simplified",
			"value": "GBK"
		},
		{
			"label": "Chinese, Traditional",
			"value": "Big5"
		},
		{
			"label": "Cyrillic (Windows)",
			"value": "windows-1251"
		},
		{
			"label": "Cyrillic (KOI8-U)",
			"value": "KOI8-U"
		},
		{
			"label": "Cyrillic (KOI8-R)",
			"value": "KOI8-R"
		},
		{
			"label": "Cyrillic (ISO)",
			"value": "ISO-8859-5"
		},
		{
			"label": "Cyrillic (DOS)",
			"value": "IBM866"
		},
		{
			"label": "Greek (Windows)",
			"value": "windows-1253"
		},
		{
			"label": "Greek (ISO)",
			"value": "ISO-8859-7"
		},
		{
			"label": "Hebrew, Visual",
			"value": "ISO-8859-8"
		},
		{
			"label": "Hebrew",
			"value": "windows-1255"
		},
		{
			"label": "Japanese (Shift_JIS)",
			"value": "Shift_JIS"
		},
		{
			"label": "Japanese (ISO-2022-JP)",
			"value": "ISO-2022-JP"
		},
		{
			"label": "Japanese (EUC-JP)",
			"value": "EUC-JP"
		},
		{
			"label": "Korean",
			"value": "EUC-KR"
		},
		{
			"label": "Thai",
			"value": "windows-874"
		},
		{
			"label": "Turkish",
			"value": "windows-1254"
		},
		{
			"label": "Vietnamese",
			"value": "windows-1258"
		}
	]
};

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
		var charsetPopup = document.createXULElement("menupopup");
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
	
				let itemNode = document.createXULElement("menuitem");
				itemNode.setAttribute("label", label);
				itemNode.setAttribute("value", value);
				
				charsetMap[value] = itemNode;
				charsetPopup.appendChild(itemNode);
			}
		}
		else {
			var charsetSeparator = document.createXULElement("menuseparator");
			charsetPopup.appendChild(charsetSeparator);
			
			var cmData = CHARSET_MENU_DATA;
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
				var itemNode = document.createXULElement("menuitem");
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
			
			var itemNode = document.createXULElement("menuitem");
			itemNode.setAttribute("label", Zotero.getString("charset.autoDetect"));
			itemNode.setAttribute("value", "auto");
			charsetMap["auto"] = itemNode;
			charsetPopup.insertBefore(itemNode, charsetPopup.firstChild);
		}
		
		return charsetMap;
	}
}