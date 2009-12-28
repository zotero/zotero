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

var noteEditor;
var notifierUnregisterID;

function onLoad() {
	noteEditor = document.getElementById('zotero-note-editor');
	noteEditor.mode = 'edit';
	noteEditor.focus();
	
	// Set font size from pref
	Zotero.setFontSize(noteEditor);
	
	var params = [];
	var b = document.location.href.substr(document.location.href.indexOf('?')+1).split('&');
	for(var i = 0; i < b.length; i++)
	{
		var mid = b[i].indexOf('=');
		
		params[b[i].substr(0,mid)] = b[i].substr(mid+1);
	}
	var itemID = params.id;
	var collectionID = params.coll;
	var parentItemID = params.p;
	
	if (itemID) {
		var ref = Zotero.Items.get(itemID);
		
		// Make sure Undo doesn't wipe out the note
		if (!noteEditor.item || noteEditor.item.id != ref.id) {
			noteEditor.disableUndo();
		}
		noteEditor.item = ref;
		noteEditor.enableUndo();
		
		document.title = ref.getNoteTitle();
	}
	else {
		if (parentItemID) {
			var ref = Zotero.Items.get(parentItemID);
			noteEditor.parent = ref;
		}
		else {
			if (collectionID && collectionID != '' && collectionID != 'undefined') {
				noteEditor.collection = Zotero.Collections.get(collectionID);
			}
		}
		noteEditor.refresh();
	}
	
	notifierUnregisterID = Zotero.Notifier.registerObserver(NotifyCallback, 'item');
}

function onUnload()
{
	if(noteEditor && noteEditor.value)
		noteEditor.save();
	
	Zotero.Notifier.unregisterObserver(notifierUnregisterID);
}

var NotifyCallback = {
	notify: function(action, type, ids){
		// DEBUG: why does this reset without checking the modified ids?
		if (noteEditor.item) {
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