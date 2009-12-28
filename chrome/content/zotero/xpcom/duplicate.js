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
