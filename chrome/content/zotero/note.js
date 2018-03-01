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

async function onLoad() {
	noteEditor = document.getElementById('zotero-note-editor');
	noteEditor.mode = 'edit';
	
	// Set font size from pref
	Zotero.setFontSize(noteEditor);
	
	if (window.arguments) {
		var io = window.arguments[0];
	}
	
	var itemID = parseInt(io.itemID);
	var collectionID = parseInt(io.collectionID);
	var parentItemKey = io.parentItemKey;
	
	if (itemID) {
		var ref = await Zotero.Items.getAsync(itemID);
		noteEditor.item = ref;
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
	
	noteEditor.focus();
	notifierUnregisterID = Zotero.Notifier.registerObserver(NotifyCallback, 'item', 'noteWindow');
}

// If there's an error saving a note, close the window and crash the app
function onError() {
	try {
		window.opener.ZoteroPane.displayErrorMessage();
	}
	catch (e) {
		Zotero.logError(e);
	}
	window.close();
}


function onUnload() {
	Zotero.Notifier.unregisterObserver(notifierUnregisterID);
	
	if (noteEditor.item) {
		window.opener.ZoteroPane.onNoteWindowClosed(noteEditor.item.id, noteEditor.value);
	}
}

var NotifyCallback = {
	notify: function(action, type, ids){
		if (noteEditor.item && ids.includes(noteEditor.item.id)) {
			var noteTitle = noteEditor.item.getNoteTitle();
			if (!document.title && noteTitle != '') {
				document.title = noteTitle;
			}
			
			// Update the window name (used for focusing) in case this is a new note
			window.name = 'zotero-note-' + noteEditor.item.id;
		}
	}
}

addEventListener("load", function(e) { onLoad(e); }, false);
addEventListener("unload", function(e) { onUnload(e); }, false);