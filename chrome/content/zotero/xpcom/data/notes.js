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


Zotero.Notes = new function() {
	this.noteToTitle = noteToTitle;
	
	this.__defineGetter__("MAX_TITLE_LENGTH", function() { return 120; });
	this.__defineGetter__("defaultNote", function () { return '<div class="zotero-note znv1"></div>'; });
	this.__defineGetter__("notePrefix", function () { return '<div class="zotero-note znv1">'; });
	this.__defineGetter__("noteSuffix", function () { return '</div>'; });
	
	/**
	* Return first line (or first MAX_LENGTH characters) of note content
	**/
	function noteToTitle(text) {
		var origText = text;
		text = text.trim();
		text = Zotero.Utilities.unescapeHTML(text);
		
		// If first line is just an opening HTML tag, remove it
		//
		// Example:
		//
		// <blockquote>
		// <p>Foo</p>
		// </blockquote>
		if (/^<[^>\n]+[^\/]>\n/.test(origText)) {
			text = text.trim();
		}
		
		var max = this.MAX_TITLE_LENGTH;
		
		var t = text.substring(0, max);
		var ln = t.indexOf("\n");
		if (ln>-1 && ln<max) {
			t = t.substring(0, ln);
		}
		return t;
	}
}

if (typeof process === 'object' && process + '' === '[object process]'){
    module.exports = Zotero.Notes;
}
