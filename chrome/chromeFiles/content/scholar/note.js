/*
	Scholar
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
	
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

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
}

function onUnload()
{
	if(noteEditor && noteEditor.value)
		noteEditor.save();
}

addEventListener("load", function(e) { onLoad(e); }, false);
addEventListener("unload", function(e) { onUnload(e); }, false);