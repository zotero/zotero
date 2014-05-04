/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2006–2013 Center for History and New Media
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

Zotero_Preferences.Keys = {
	init: function () {
		var rows = document.getElementById('zotero-prefpane-keys').getElementsByTagName('row');
		for (var i=0; i<rows.length; i++) {
			// Display the appropriate modifier keys for the platform
			rows[i].firstChild.nextSibling.value = Zotero.isMac ? Zotero.getString('general.keys.cmdShift') : Zotero.getString('general.keys.ctrlShift');
		}
		
		var textboxes = document.getElementById('zotero-keys-rows').getElementsByTagName('textbox');
		for (let i=0; i<textboxes.length; i++) {
			let textbox = textboxes[i];
			textbox.value = textbox.value.toUpperCase();
			// .value takes care of the initial value, and this takes care of direct pref changes
			// while the window is open
			textbox.setAttribute('onsyncfrompreference', 'return Zotero_Preferences.Keys.capitalizePref(this.id)');
			textbox.setAttribute('oninput', 'this.value = this.value.toUpperCase()');
		}
	},
	
	
	capitalizePref: function (id) {
		var elem = document.getElementById(id);
		var pref = document.getElementById(elem.getAttribute('preference'));
		if (pref.value) {
			return pref.value.toUpperCase();
		}
	}
};
