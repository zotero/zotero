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

var noteEditor;

async function onLoad() {
	noteEditor = document.getElementById('zotero-note-editor');
	noteEditor.mode = 'view';
	
	// Set font size from pref
	Zotero.setFontSize(noteEditor);
	
	if (window.arguments) {
		var io = window.arguments[0];
	}
	
	var itemID = parseInt(io.itemID);
	
	var item = await Zotero.Items.getAsync(itemID);
	
	let note = await Zotero.NoteBackups.getNote(item.id);
	if (!note) {
		note = item.getNote();
	}
	
	var tmpItem = new Zotero.Item('note');
	tmpItem.libraryID = item.libraryID;
	tmpItem.setNote(note);
	noteEditor.item = tmpItem;
	document.title = 'BACKUP OF: ' + item.getNoteTitle();
	
	noteEditor.focus();
}

addEventListener("load", function(e) { onLoad(e); }, false);
