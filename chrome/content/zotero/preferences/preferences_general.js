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

Zotero_Preferences.General = {
	init: function () {
		// JS-based strings
		var checkbox = document.getElementById('launchNonNativeFiles-checkbox');
		if (checkbox) {
			checkbox.label = Zotero.getString(
				'zotero.preferences.launchNonNativeFiles', Zotero.appName
			);
		}
	},
	
	/**
	 * Sets "Status bar icon" to "None" if Zotero is set to load in separate tab
	 */
	handleShowInPreferenceChange: function () {
		var statusBarIcon = document.getElementById('zotero-prefpane-general-statusBarIcon');
		
		if(document.getElementById("zotero-prefpane-general-showIn").value == 3) {
			statusBarIcon.value = 0;
			Zotero.Prefs.set("statusBarIcon", 0);
			//disable other options
			var options = statusBarIcon.getElementsByTagName("menuitem");
			for each(var menuitem in options) {
				if(menuitem.value != 0) {
					menuitem.hidden = true;
				}
			}
		} else {
			statusBarIcon.value = statusBarIcon._lastValue;
			Zotero.Prefs.set("statusBarIcon", statusBarIcon._lastValue);
			//make sure all options are enabled
			var options = statusBarIcon.getElementsByTagName("menuitem");
			for each(var menuitem in options) {
				menuitem.hidden = false;
			}
		}
	},
	
	
	updateTranslators: function () {
		Zotero.Schema.updateFromRepository(true, function (xmlhttp, updated) {
			var button = document.getElementById('updateButton');
			if (button) {
				if (updated===-1) {
					var label = Zotero.getString('zotero.preferences.update.upToDate');
				}
				else if (updated) {
					var label = Zotero.getString('zotero.preferences.update.updated');
				}
				else {
					var label = Zotero.getString('zotero.preferences.update.error');
				}
				button.setAttribute('label', label);
				
				if (updated && Zotero_Preferences.Cite) {
					Zotero_Preferences.Cite.refreshStylesList();
				}
			}
		});
	}
}
