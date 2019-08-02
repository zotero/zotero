/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
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

var editor, JavaScriptMode, TextMode, EditSession;
window.addEventListener("DOMContentLoaded", function(e) {
	var div = document.createElement("div");
	div.style.position = "absolute";
	div.style.top = "0px";
	div.style.left = "0px";
	div.style.right = "0px";
	div.style.bottom = "0px";
	div.id = "ace-div";
	document.getElementById("body").appendChild(div);
	
	JavaScriptMode = require("ace/mode/javascript").Mode;
	TextMode = require("ace/mode/text").Mode;
	EditSession = require("ace/edit_session").EditSession;
	editor = ace.edit('ace-div');
	editor.setTheme("ace/theme/monokai");
}, false);