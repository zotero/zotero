/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/
var Zotero_DownloadOverlay = new function() {
	/**
	 * Saves this item, if we are supposed to save it.
	 *
	 * @return {Boolean} True if an item was saved, false if we were not supposed to save
	 */
	this.handleSave = function() {
		if(!document.getElementById('zotero-radio').selected) return false;
		
		var url = dialog.mLauncher.source.spec;
		Zotero.debug("Downloading from "+url);
		
		// set up progress window
		var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						.getService(Components.interfaces.nsIWindowMediator)
						.getMostRecentWindow("navigator:browser");
		var libraryID = (win ? win.ZoteroPane.getSelectedLibraryID() : false);
		var collection = (win ? win.ZoteroPane.getSelectedCollection() : false);
		
		// set up callback
		var callback = function(item) {
			if(!win) return;
			
			if(item) win.Zotero_Browser.itemDone(null, item);
			win.Zotero_Browser.finishScraping(null, !!item);
		};
		
		// show progress dialog
		win.Zotero_Browser.progress.show();
		
		// perform import
		Zotero.Attachments.importFromURL(url, false, false, false,
			collection ? [collection.id] : [], dialog.mLauncher.MIMEInfo.MIMEType,
			libraryID, callback);
		
		// mimic dialog cancellation
		dialog.onCancel();
		
		return true;
	};
	
	/**
	 * Called when mode in dialog has been changed
	 */
	this.modeChanged = function() {
		Zotero.debug("rememberChoice");
		document.getElementById('rememberChoice').disabled = document.getElementById('zotero-radio').selected;
	};
	
	/**
	 * Called when the save dialog is opened
	 */
	this.init = function() {
		// Hook in event listener to ondialogaccept
		document.documentElement.setAttribute('ondialogaccept',
			'if(!Zotero_DownloadOverlay.handleSave()) { '
			+ document.documentElement.getAttribute('ondialogaccept')
			+'}');
		
		// Hook in event listener for mode change
		var radios = document.getElementById('mode').
			addEventListener("command", Zotero_DownloadOverlay.modeChanged, false);
	};
}

window.addEventListener("load", Zotero_DownloadOverlay.init, false);