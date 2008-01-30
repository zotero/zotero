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

var noteEditor;
var notifierUnregisterID;

function onLoad()
{
	noteEditor = document.getElementById('note-editor');
	noteEditor.focus();
	
	// Set font size from pref
	Zotero.setFontSize(noteEditor);
	
	var params = new Array();
	var b = document.location.href.substr(document.location.href.indexOf('?')+1).split('&');
	for(var i = 0; i < b.length; i++)
	{
		var mid = b[i].indexOf('=');
		
		params[b[i].substr(0,mid)] = b[i].substr(mid+1);
	}
	var itemID = params['id'];
	var collectionID = params['coll'];
	var parentItemID = params['p'];
	
	if (itemID) {
		var ref = Zotero.Items.get(itemID);
		
		// Make sure Undo doesn't wipe out the note
		if (!noteEditor.note || noteEditor.note.getID() != ref.getID()) {
			noteEditor.id('noteField').editor.enableUndo(false);
		}
		noteEditor.note = ref;
		noteEditor.id('noteField').editor.enableUndo(true);
		
		document.title = ref.getNoteTitle();
	}
	else if (parentItemID) {
		var ref = Zotero.Items.get(parentItemID);
		noteEditor.item = ref;
	}
	else
	{
		if(collectionID && collectionID != '' && collectionID != 'undefined')
			noteEditor.collection = Zotero.Collections.get(collectionID);
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
		if (noteEditor.note) {
			noteEditor.note = noteEditor.note;
			
			// If the document title hasn't yet been set, reset undo so
			// undoing to empty isn't possible
			var noteTitle = noteEditor.note.getNoteTitle();
			if (!document.title && noteTitle != '') {
				noteEditor.id('noteField').editor.enableUndo(false);
				noteEditor.id('noteField').editor.enableUndo(true);
				document.title = noteTitle;
			}
			
			// Update the window name (used for focusing) in case this is a new note
			window.name = 'zotero-note-' + noteEditor.note.getID();
		}
	}
}

addEventListener("load", function(e) { onLoad(e); }, false);
addEventListener("unload", function(e) { onUnload(e); }, false);