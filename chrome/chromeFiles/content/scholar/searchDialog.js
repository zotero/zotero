/*
	Scholar
	Copyright (C) 2006   Center for History and New Media, George Mason University, Fairfax, VA
	http://chnm.gmu.edu/
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
	document.getElementById('search-box').save();
	io.dataOut = true;
}