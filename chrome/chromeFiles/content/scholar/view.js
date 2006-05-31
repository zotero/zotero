var thisItem;

function init()
{
	thisItem = Scholar.Items.get(getArgument("id"));
	
	document.getElementById('view').setAttribute('src','http://www.google.com/search?q='+encodeURIComponent('"'+thisItem.getField("title")+'"')+'&btnI');
}

function toggle(id)
{
	var button = document.getElementById('tb-'+id);
	var elem = document.getElementById(id);
	
	button.checked = !button.checked;
	elem.hidden = !elem.hidden;
}

//thanks to: http://evolt.org/node/14435
function getArgument (name)
{
	var arguments = document.location.search.slice(1).split('&');
	var r = '';
	for (var i = 0; i < arguments.length; i++)
	{
		if (arguments[i].slice(0,arguments[i].indexOf('=')) == name)
		{
			r = arguments[i].slice(arguments[i].indexOf('=')+1);
			return (r.length > 0 ? unescape(r).split(',') : '');
		}
	}
	return '';
}

addEventListener("load", function(e) { init(e); }, false);