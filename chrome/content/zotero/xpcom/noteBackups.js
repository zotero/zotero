/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     http://digitalscholar.org/
    
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

Zotero.NoteBackups = {
	init: async function () {
		await Zotero.DB.queryAsync("CREATE TABLE IF NOT EXISTS noteBackups (\n	itemID INTEGER PRIMARY KEY,\n	note TEXT,\n	FOREIGN KEY (itemID) REFERENCES items(itemID) ON DELETE CASCADE\n);");
	},
	
	getNote: async function(itemID) {
		return Zotero.DB.valueQueryAsync("SELECT note FROM noteBackups WHERE itemID=?", [itemID]);
	},
	
	ensureBackup: async function(item) {
		let note = item.note;
		if (note && !Zotero.Notes.hasSchemaVersion(note)) {
			await Zotero.DB.queryAsync("INSERT OR IGNORE INTO noteBackups VALUES (?, ?)", [item.id, item.note]);
		}
	},
};
