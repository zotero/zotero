var item;
var note;
var _notesField;

function onLoad()
{
	_notesField = document.getElementById('notes-box');
	_notesField.focus();
	
	var params = new Array();
	var b = document.location.href.substr(document.location.href.indexOf('?')+1).split('&');
	for(var i = 0; i < b.length; i++)
	{
		var mid = b[i].indexOf('=');
		
		params[b[i].substr(0,mid)] = b[i].substr(mid+1);
	}
	item = Scholar.Items.get(params['item']);
	var noteID = params['note'];
	
	document.getElementById('info-label').appendChild(document.createTextNode(item.getField('title') + " by " + item.getField('firstCreator')));
	if(noteID)
	{
		note = Scholar.Items.get(noteID);
		_notesField.setAttribute('value',note.getNote());
	}
}

function onUnload()
{
	save();
}

function save()
{
	if(note)
	{
		note.updateNote(_notesField.value);
	}
	else
 	{
		var noteID = Scholar.Notes.add(_notesField.value,item.getID());
		note = Scholar.Items.get(noteID);
	}
}

addEventListener("load", function(e) { onLoad(e); }, false);
addEventListener("unload", function(e) { onUnload(e); }, false);