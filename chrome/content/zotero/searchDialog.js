/*
	Zotero
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
*/

var itemsView;
var collectionsView;
var io;

function doLoad()
{
	io = window.arguments[0];
	
	document.getElementById('search-box').search = io.dataIn.search;
	document.getElementById('search-name').value = io.dataIn.name;
}

function doUnload()
{

}

function doAccept()
{
	document.getElementById('search-box').search.setName(document.getElementById('search-name').value);
	io.dataOut = document.getElementById('search-box').save();
}