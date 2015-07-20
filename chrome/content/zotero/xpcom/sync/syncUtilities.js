/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2014 Center for History and New Media
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

if (!Zotero.Sync.Data) {
	Zotero.Sync.Data = {};
}

Zotero.Sync.Data.Utilities = {
	_syncObjectTypeIDs: {},
	
	init: Zotero.Promise.coroutine(function* () {
		// If not found, cache all
		var sql = "SELECT name, syncObjectTypeID AS id FROM syncObjectTypes";
		var rows = yield Zotero.DB.queryAsync(sql);
		for (let i = 0; i < rows.length; i++) {
			row = rows[i];
			this._syncObjectTypeIDs[row.name] = row.id;
		}
	}),
	
	getSyncObjectTypeID: function (objectType) {
		if (!this._syncObjectTypeIDs[objectType]) {
			return false;
		}
		return this._syncObjectTypeIDs[objectType];
	},
};
