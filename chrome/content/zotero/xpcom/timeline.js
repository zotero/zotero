/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
	
    ***** END LICENSE BLOCK *****
*/


Zotero.Timeline = new function () {
	this.generateXMLDetails = generateXMLDetails;
	this.generateXMLList = generateXMLList;

	function generateXMLDetails(items, dateType) {
		var ZU = new Zotero.Utilities();
		var escapeXML = ZU.htmlSpecialChars;
	
		var content = '<data>\n';
		for each(var arr in items) {
			if (arr[dateType]) {
				var item = Zotero.Items.get(arr.itemID);
				var theDate =(dateType == 'date') ? Zotero.Date.multipartToSQL(arr[dateType]):arr[dateType];
				content += '<event start="' + Zotero.Date.sqlToDate(theDate) + '" ';
				content += 'title=" ' + (arr.title ? escapeXML(arr.title) : '') + '" ';
				content += 'icon="' + item.getImageSrc() + '" ';			
				content += 'color="black">';
				content += arr.itemID;
				content += '</event>\n';
			}
		}
		content += '</data>';
		return content;
	}
	
	function generateXMLList(items) {
	}
}