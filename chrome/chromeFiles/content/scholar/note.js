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
	var id = params['id'];
	
	if(id && id != '' && id != 'undefined')
	{
		var ref = Scholar.Items.get(id);
		if(ref.isNote())
		{
			note = ref;
			if(note.getNoteSource())
				item = Scholar.Items.get(note.getNoteSource());

			_notesField.setAttribute('value',note.getNote());
		}
		else
		{
			item = ref;
		}
		
		if(item)
			document.getElementById('info-label').appendChild(document.createTextNode(item.getField('title') + " by " + item.getField('firstCreator')));
	}
}

function onUnload()
{
	save();
}

function save()
{
	if(note)	//Update note
	{
		note.updateNote(_notesField.value);
	}
	else	//Create new note
 	{
		if(item)
			var noteID = Scholar.Notes.add(_notesField.value,item.getID());	//attached to an item
		else
			var noteID = Scholar.Notes.add(_notesField.value);				//independant note
		note = Scholar.Items.get(noteID);
	}
}

addEventListener("load", function(e) { onLoad(e); }, false);
addEventListener("unload", function(e) { onUnload(e); }, false);