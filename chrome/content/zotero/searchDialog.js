/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

"use strict";

var itemsView;
var collectionsView;
var io;

function doLoad()
{
	// Set font size from pref
	var sbc = document.getElementById('zotero-search-box-container');
	Zotero.setFontSize(sbc);
	
	io = window.arguments[0];
	
	var searchBox = document.getElementById('search-box');
	searchBox.groups = io.dataIn.groups;
	searchBox.search = io.dataIn.search;
	document.getElementById('search-name').value = io.dataIn.name;
}

function doUnload()
{

}

function doAccept()
{
	document.getElementById('search-box').search.name = document.getElementById('search-name').value;
	try {
		let searchBox = document.getElementById('search-box');
		searchBox.updateSearch();
		io.dataOut = {
			json: searchBox.search.toJSON()
		};
	}
	catch (e) {
		Zotero.debug(e, 1);
		Components.utils.reportError(e);
		throw (e);
	}
}