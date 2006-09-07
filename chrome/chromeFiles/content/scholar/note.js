/*
	Zotero
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
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
		var ref = Scholar.Items.get(id);
		if(ref.isNote())
		{
			noteEditor.note = ref;
			window.title = "Edit Note";
		}
		else
		{
			noteEditor.item = ref;
			window.title = "Add Note";
		}
	}
	else
	{
		window.title = "Add Note";
		if(collectionID && collectionID != '' && collectionID != 'undefined')
			noteEditor.collection = Scholar.Collections.get(collectionID);
	}
	
	notifierUnregisterID = Scholar.Notifier.registerItemTree(NotifyCallback);
}

function onUnload()
{
	if(noteEditor && noteEditor.value)
		noteEditor.save();
	
	Scholar.Notifier.unregisterItemTree(notifierUnregisterID);
}

var NotifyCallback = {
	notify: function(){
		noteEditor.id('links').id('tags').reload();
	}
}

addEventListener("load", function(e) { onLoad(e); }, false);
addEventListener("unload", function(e) { onUnload(e); }, false);