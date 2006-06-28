var noteEditor;

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
		window.title = "Edit Note";
	}
}

function onUnload()
{
	if(noteEditor && noteEditor.value)
		noteEditor.save();
}

addEventListener("load", function(e) { onLoad(e); }, false);
addEventListener("unload", function(e) { onUnload(e); }, false);