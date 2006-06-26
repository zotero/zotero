var item;
var noteID;
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
	noteID = params['note'];
	
	document.getElementById('info-label').setAttribute('value',item.getField('title'));
	if(noteID)
		_notesField.setAttribute('value',item.getNote(noteID));
}

function onUnload()
{
	save();
}

function save()
{
	if(noteID)
		item.updateNote(noteID,_notesField.value);
	else
		noteID = item.addNote(_notesField.value);
}

addEventListener("load", function(e) { onLoad(e); }, false);
addEventListener("unload", function(e) { onUnload(e); }, false);