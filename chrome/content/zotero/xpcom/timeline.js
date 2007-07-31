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
	
	
	Based on nsChromeExtensionHandler example code by Ed Anuff at
	http://kb.mozillazine.org/Dev_:_Extending_the_Chrome_Protocol
    
	
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
				content += 'title=" ' + escapeXML(arr.title) + '" ';
				content += 'icon="' + item.getImageSrc() + '" ';			
				content += 'color="black">';
				content += 'zotero://select/item/'+arr.itemID;
				content += '</event>\n';
			}
		}
		content += '</data>';
		return content;
	}
	
	function generateXMLList(items) {
	}
}