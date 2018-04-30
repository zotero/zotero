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
var Zotero_DownloadOverlay = new function() {
	const PDF_MIME_TYPE = "application/pdf";
	const ALLOW_LIST = [
		"application/pdf",
		"application/postscript",
		"application/xhtml+xml",
		"text/html",
		"text/plain",
		/^audio\//,
		/^image\//,
		/^video\//,
		/^application\/vnd\.oasis\.opendocument\./,
		/^application\/vnd\.ms-/,
		/^application\/vnd\.openxmlformats-officedocument/,
		/^application\/vnd\.lotus-/,
		/^application\/vnd\.wolfram\./,
		"application/vnd.wordperfect",
		"application/wordperfect5.1",
		"application/msword",
		"application/x-latex"
	];
	
	/**
	 * Saves this item, if we are supposed to save it.
	 *
	 * @return {Boolean} True if an item was saved, false if we were not supposed to save
	 */
	this.handleSave = Zotero.Promise.coroutine(function* () {
		if(!document.getElementById('zotero-radio').selected) return false;
		
		var retrieveMetadata = document.getElementById('zotero-recognizePDF').selected;
		
		var url = dialog.mLauncher.source.spec;
		Zotero.debug("Zotero_DownloadOverlay: Downloading from "+url);
		
		// set up progress window
		var win = Components.classes["@mozilla.org/appshell/window-mediator;1"]
						.getService(Components.interfaces.nsIWindowMediator)
						.getMostRecentWindow("navigator:browser");
		var libraryID, collection;
		try {
			let itemGroup = win.ZoteroPane.getCollectionTreeRow();
			if (itemGroup.filesEditable && !itemGroup.isPublications()) {
				libraryID = win.ZoteroPane.getSelectedLibraryID();
				collection = win.ZoteroPane.getSelectedCollection();
			}
			// TODO: Just show an error instead?
			else {
				Zotero.debug("Cannot save files to library " + itemGroup.ref.libraryID
					+ " -- saving to My Library instead", 2);
				libraryID = Zotero.Libraries.userLibraryID;
			}
		} catch(e) {
			Zotero.debug(e, 1);
		};
		
		var recognizePDF = document.getElementById('zotero-recognizePDF').checked
				&& !document.getElementById('zotero-recognizePDF').hidden
				&& !document.getElementById('zotero-recognizePDF').disabled;
		var contentType = dialog.mLauncher.MIMEInfo.MIMEType;
		
		// mimic dialog cancellation
		dialog.onCancel();
		
		// show progress dialog
		var progressWin = new Zotero.ProgressWindow();
		progressWin.changeHeadline(Zotero.getString("save.link"));
		progressWin.show();
		
		// perform import
		try {
			var item = yield Zotero.Attachments.importFromURL({
				libraryID,
				url,
				collections: collection ? [collection.id] : [],
				contentType
			});
		}
		catch (e) {
			if (!win) return;
			progressWin.addDescription(Zotero.getString("save.link.error"));
			progressWin.startCloseTimer(8000);
			Zotero.logError(e);
			return false;
		}
		
		if(!win) return;
		
		progressWin.addLines([item.getDisplayTitle()], [item.getImageSrc()]);
		progressWin.startCloseTimer();
		if (collection) {
			yield collection.addItem(item.id);
		}
		
		yield win.ZoteroPane.selectItem(item.id);
		
		if(recognizePDF) {
			var timer = Components.classes["@mozilla.org/timer;1"]
				.createInstance(Components.interfaces.nsITimer);
			timer.init(function() {
				try {
				if (item && item.getFile()) {
					timer.cancel();
					Zotero.RecognizePDF.recognizeItems([item]);
				}
				} catch(e) { dump(e.toSource()) };
			}, 1000, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
		}
		
		return true;
	});
	
	/**
	 * Called when mode in dialog has been changed
	 */
	this.modeChanged = function() {
		var zoteroSelected = document.getElementById('zotero-radio').selected;
		
		// don't allow user to remember Zotero option for file type; i'm not sure anyone wants this
		// to happen automatically
		if(zoteroSelected) document.getElementById('rememberChoice').selected = false;
		document.getElementById('rememberChoice').disabled = zoteroSelected;
		document.getElementById('zotero-recognizePDF').disabled = !zoteroSelected;
		
		Zotero_DownloadOverlay.updateLibraryNote();
	};
	
	/**
	 * Determines whether the note stating that the item will be saved to "My Library" is shown
	 */
	this.updateLibraryNote = function() {
		var zoteroSelected = document.getElementById('zotero-radio').selected;
		var zp = Zotero.getActiveZoteroPane(), canSave = true;
		try {
			canSave = zp.getCollectionTreeRow().filesEditable;
		} catch(e) {
			Zotero.logError(e);
		};
		document.getElementById('zotero-saveToLibrary-description').hidden = !zoteroSelected || canSave;
		window.sizeToContent();
	}
	
	/**
	 * Called when the save dialog is opened
	 */
	this.init = function() {
		if(Zotero.isConnector) return;
		
		// Disable for filetypes people probably don't want to save
		var show = false;
		var mimeType = dialog.mLauncher.MIMEInfo.MIMEType.toLowerCase();
		for (let elem of ALLOW_LIST) {
			if(typeof elem === "string") {
				if(elem === mimeType) {
					document.getElementById('zotero-container').hidden = false;
					document.getElementById('zotero-radio').disabled = false;
					break;
				}
			} else if(elem.test(mimeType)) {
				document.getElementById('zotero-container').hidden = false;
				document.getElementById('zotero-radio').disabled = false;
				break;
			}
		}
		
		// Hook in event listener to ondialogaccept
		document.documentElement.setAttribute('ondialogaccept',
			'Zotero_DownloadOverlay.handleSave().then(function (saved) { if (!saved) {'
			+ document.documentElement.getAttribute('ondialogaccept')
			+'}})');
		
		// Hook in event listener for mode change
		var radios = document.getElementById('mode').
			addEventListener("command", Zotero_DownloadOverlay.modeChanged, false);
		
		// Set label on retrieve PDF option
		if(mimeType === PDF_MIME_TYPE) {
			var recognizePDF = document.getElementById('zotero-recognizePDF');
			recognizePDF.label = Zotero.getString("pane.items.menu.recognizePDF");
			recognizePDF.hidden = false;
			recognizePDF.disabled = true;
		}
	};
}

window.addEventListener("load", Zotero_DownloadOverlay.init, false);
window.addEventListener("activate", Zotero_DownloadOverlay.updateLibraryNote, false);