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
	
	var params = new Array();
	var b = document.location.href.substr(document.location.href.indexOf('?')+1).split('&');
	for(var i = 0; i < b.length; i++)
	{
		var mid = b[i].indexOf('=');
		
		params[b[i].substr(0,mid)] = b[i].substr(mid+1);
	}
	var id = params['id'];
	var collectionID = params['coll'];
	
	if(id && id != '' && id != 'undefined')
	{
		var ref = Zotero.Items.get(id);
		if(ref.isNote())
		{
			noteEditor.note = ref;
			document.title = "Edit Note";
		}
		else
		{
			noteEditor.item = ref;
			document.title = "Add Note";
		}
	}
	else
	{
		document.title = "Add Note";
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
		if (noteEditor.note){
			noteEditor.note = noteEditor.note;
		}
	}
}

addEventListener("load", function(e) { onLoad(e); }, false);
addEventListener("unload", function(e) { onUnload(e); }, false);