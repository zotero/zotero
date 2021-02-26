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
import FilePicker from 'zotero/filePicker';

Zotero_Preferences.General = {
	init: function () {
		// JS-based strings
		var checkbox = document.getElementById('launchNonNativeFiles-checkbox');
		if (checkbox) {
			checkbox.label = Zotero.getString(
				'zotero.preferences.launchNonNativeFiles', Zotero.appName
			);
		}
		var menuitem = document.getElementById('fileHandler-internal');
		menuitem.setAttribute('label', Zotero.appName);
		
		this.updateAutoRenameFilesUI();
		this._updateFileHandlerUI();
		this._updateZotero6BetaCheckbox();
	},
	
	updateAutoRenameFilesUI: function () {
		setTimeout(() => {
			document.getElementById('rename-linked-files').disabled = !Zotero.Prefs.get('autoRenameFiles');
		});
	},
	
	//
	// File handlers
	//
	chooseFileHandler: async function (type) {
		var pref = this._getFileHandlerPref(type);
		var currentPath = Zotero.Prefs.get(pref);
		
		var fp = new FilePicker();
		if (currentPath) {
			fp.displayDirectory = OS.Path.dirname(currentPath);
		}
		fp.init(
			window,
			Zotero.getString('zotero.preferences.chooseApplication'),
			fp.modeOpen
		);
		fp.appendFilters(fp.filterApps);
		if (await fp.show() != fp.returnOK) {
			this._updateFileHandlerUI();
			return false;
		}
		this.setFileHandler(type, fp.file);
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
		
		// TEMP: Use separate checkbox for now
		/*if (handler == 'zotero') {
			let menuitem = document.getElementById('fileHandler-internal');
			menulist.selectedIndex = 0;
			customMenuItem.hidden = true;
			return;
		}*/
		
		// Custom handler
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
			menulist.selectedIndex = 1;
		}
		// System default
		else {
			customMenuItem.hidden = true;
			menulist.selectedIndex = 2;
		}
	},
	
	_getFileHandlerPref: function (type) {
		if (type != 'pdf') {
			throw new Error(`Unknown file type ${type}`);
		}
		return 'fileHandler.pdf';
	},
	
	
	handleZotero6BetaChange: function (event) {
		var ps = Services.prompt;
		var buttonFlags = ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING
			+ ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL;
		var index = ps.confirmEx(
			window,
			Zotero.getString('general.restartRequired'),
			Zotero.getString('general.restartRequiredForChange', Zotero.appName),
			buttonFlags,
			Zotero.getString('general.restartApp', Zotero.appName),
			null, null, null, {}
		);
		if (index == 0) {
			Zotero.Prefs.set('beta.zotero6', !event.target.checked);
			Zotero.Utilities.Internal.quitZotero(true);
			return;
		}
		// Set to opposite so the click changes it back to what it was before
		event.target.checked = !event.target.checked;
	},
	
	
	_updateZotero6BetaCheckbox: function () {
		var checkbox = document.getElementById('zotero6-checkbox');
		if (Zotero.Prefs.get('beta.zotero6')) {
			checkbox.setAttribute('checked', true);
		}
		else {
			checkbox.removeAttribute('checked');
		}
	}
}
