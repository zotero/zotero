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

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/osfile.jsm");

Zotero_Preferences.General = {
	init: function () {
		// JS-based strings
		var checkbox = document.getElementById('launchNonNativeFiles-checkbox');
		if (checkbox) {
			checkbox.label = Zotero.getString(
				'zotero.preferences.launchNonNativeFiles', Zotero.appName
			);
		}
		
		document.getElementById('noteFontSize').value = Zotero.Prefs.get('note.fontSize');
		
		this._updateFileHandlerUI();
	},
	
	//
	// File handlers
	//
	chooseFileHandler: function (type) {
		var pref = this._getFileHandlerPref(type);
		var currentPath = Zotero.Prefs.get(pref);
		
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"]
			.createInstance(nsIFilePicker);
		if (currentPath) {
			fp.displayDirectory = Zotero.File.pathToFile(OS.Path.dirname(currentPath));
		}
		fp.init(
			window,
			Zotero.getString('zotero.preferences.chooseApplication'),
			nsIFilePicker.modeOpen
		);
		fp.appendFilters(nsIFilePicker.filterApps);
		if (fp.show() != nsIFilePicker.returnOK) {
			this._updateFileHandlerUI();
			return false;
		}
		var newPath = OS.Path.normalize(fp.file.path);
		this.setFileHandler(type, newPath);
	},
	
	setFileHandler: function (type, handler) {
		var pref = this._getFileHandlerPref(type);
		if (handler) {
			Zotero.Prefs.set(pref, handler);
		}
		else {
			Zotero.Prefs.clear(pref);
		}
		this._updateFileHandlerUI();
	},
	
	_updateFileHandlerUI: function () {
		var handler = Zotero.Prefs.get('fileHandler.pdf');
		var menulist = document.getElementById('fileHandler-pdf');
		var customMenuItem = document.getElementById('fileHandler-custom');
		if (handler) {
			let icon;
			try {
				let fph = Services.io.getProtocolHandler("file")
					.QueryInterface(Components.interfaces.nsIFileProtocolHandler);
				let urlspec = fph.getURLSpecFromFile(Zotero.File.pathToFile(handler));
				icon = "moz-icon://" + urlspec + "?size=16";
			}
			catch (e) {
				Zotero.logError(e);
			}
			
			let handlerFilename = OS.Path.basename(handler);
			if (Zotero.isMac) {
				handlerFilename = handlerFilename.replace(/\.app$/, '');
			}
			customMenuItem.setAttribute('label', handlerFilename);
			if (icon) {
				customMenuItem.className = 'menuitem-iconic';
				customMenuItem.setAttribute('image', icon);
			}
			else {
				customMenuItem.className = '';
			}
			customMenuItem.hidden = false;
			menulist.selectedIndex = 0;
		}
		else {
			customMenuItem.hidden = true;
			menulist.selectedIndex = 1;
		}
	},
	
	_getFileHandlerPref: function (type) {
		if (type != 'pdf') {
			throw new Error(`Unknown file type ${type}`);
		}
		return 'fileHandler.pdf';
	}
}
