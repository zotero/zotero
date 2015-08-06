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
var notifierUnregisterID;

function onLoad() {
	noteEditor = document.getElementById('zotero-note-editor');
	noteEditor.mode = 'edit';
	noteEditor.focus();
	
	// Set font size from pref
	Zotero.setFontSize(noteEditor);
	
	if (window.arguments) {
		var io = window.arguments[0];
	}
	var itemID = io.itemID;
	var collectionID = io.collectionID;
	var parentItemKey = io.parentItemKey;
	
	return Zotero.spawn(function* () {
		if (itemID) {
			var ref = yield Zotero.Items.getAsync(itemID);
			
			var clearUndo = noteEditor.item ? noteEditor.item.id != ref.id : false;
			
			noteEditor.item = ref;
			
			// If loading new or different note, disable undo while we repopulate the text field
			// so Undo doesn't end up clearing the field. This also ensures that Undo doesn't
			// undo content from another note into the current one.
			if (clearUndo) {
				noteEditor.clearUndo();
			}
			
			document.title = ref.getNoteTitle();
		}
		else {
			if (parentItemKey) {
				var ref = Zotero.Items.getByLibraryAndKey(parentItemKey);
				noteEditor.parentItem = ref;
			}
			else {
				if (collectionID && collectionID != '' && collectionID != 'undefined') {
					noteEditor.collection = Zotero.Collections.get(collectionID);
				}
			}
			noteEditor.refresh();
		}
		
		notifierUnregisterID = Zotero.Notifier.registerObserver(NotifyCallback, 'item');
	});
}

function onUnload()
{
	if(noteEditor && noteEditor.value)
		noteEditor.save();
	
	Zotero.Notifier.unregisterObserver(notifierUnregisterID);
}

var NotifyCallback = {
	notify: function(action, type, ids){
		if (noteEditor.item && ids.indexOf(noteEditor.item.id) != -1) {
			noteEditor.item = noteEditor.item;
			
			// If the document title hasn't yet been set, reset undo so
			// undoing to empty isn't possible
			var noteTitle = noteEditor.note.getNoteTitle();
			if (!document.title && noteTitle != '') {
				noteEditor.clearUndo();
				document.title = noteTitle;
			}
			
			// Update the window name (used for focusing) in case this is a new note
			window.name = 'zotero-note-' + noteEditor.item.id;
		}
	}
}

addEventListener("load", function(e) { onLoad(e); }, false);
addEventListener("unload", function(e) { onUnload(e); }, false);