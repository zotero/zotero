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

Zotero.Duplicate = function(duplicateID) {
	this._id = duplicateID ? duplicateID : null;
	this._itemIDs = [];
}

Zotero.Duplicate.prototype.__defineGetter__('id', function () { return this._id; });

Zotero.Duplicate.prototype.getIDs = function(idsTable) {
	if (!idsTable)  {
		return;
	}
	
	var minLen = 5, percentLen = 1./3, checkLen, i, j;
	
	var sql = "SELECT itemID, value AS val "
				+ "FROM " + idsTable + " NATURAL JOIN itemData "
				+ "NATURAL JOIN itemDataValues "
				+ "WHERE fieldID BETWEEN 110 AND 113 AND "
				+ "itemID NOT IN (SELECT itemID FROM itemAttachments) "
				+ "ORDER BY val";
	
	var results = Zotero.DB.query(sql);
	
	var resultsLen = results.length;
	this._itemIDs = [];
	
	for (i = 0; i < resultsLen; i++) {
		results[i].len = results[i].val.length;
	}
	
	for (i = 0; i < resultsLen; i++) {
		// title must be at least minLen long to be a duplicate
		if (results[i].len < minLen) {
			continue;
		}
		
		for (j = i + 1; j < resultsLen; j++) {
			// duplicates must match the first checkLen characters
			// checkLen = percentLen * the length of the longer title
			checkLen = (results[i].len >= results[j].len) ? 
				parseInt(percentLen * results[i].len) : parseInt(percentLen * results[j].len);
			checkLen = (checkLen > results[i].len) ? results[i].len : checkLen;
			checkLen = (checkLen > results[j].len) ? results[j].len : checkLen;
			checkLen = (checkLen < minLen) ? minLen : checkLen;

			if (results[i].val.substr(0, checkLen) == results[j].val.substr(0, checkLen)) {
				// include results[i] when a duplicate is first found
				if (j == i + 1) {
					this._itemIDs.push(results[i].itemID);
				}
				this._itemIDs.push(results[j].itemID);
			}
			else {
				break;
			}
		}
		i = j - 1;
	}
	
	return this._itemIDs;
}
