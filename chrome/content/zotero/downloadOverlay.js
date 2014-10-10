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
	this.handleSave = function() {
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
			let itemGroup = win.ZoteroPane.getItemGroup();
			if (itemGroup.filesEditable) {
				libraryID = win.ZoteroPane.getSelectedLibraryID();
				collection = win.ZoteroPane.getSelectedCollection();
			}
			// TODO: Just show an error instead?
			else {
				Zotero.debug("Cannot save files to library " + itemGroup.ref.libraryID
					+ " -- saving to personal library instead", 2);
			}
		} catch(e) {
			Zotero.debug(e, 1);
		};
		
		var recognizePDF = document.getElementById('zotero-recognizePDF').checked
				&& !document.getElementById('zotero-recognizePDF').hidden
				&& !document.getElementById('zotero-recognizePDF').disabled;
		
		// set up callback
		var callback = function(item) {
			if(!win) return;
						
			if(item) {
				progressWin.addLines([item.getDisplayTitle()], [item.getImageSrc()]);
				progressWin.startCloseTimer();
				if(collection) collection.addItem(item.id);
			} else {
				progressWin.addDescription(Zotero.getString("save.link.error"));
				progressWin.startCloseTimer(8000);
			}
			
			if(recognizePDF) {
				var timer = Components.classes["@mozilla.org/timer;1"]
					.createInstance(Components.interfaces.nsITimer);
				timer.init(function() {
					try {
					if(item.getFile()) {
						timer.cancel();
						var recognizer = new win.Zotero_RecognizePDF.ItemRecognizer();
						recognizer.recognizeItems([item]);
					}
					} catch(e) { dump(e.toSource()) };
				}, 1000, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
			}
		};
		
		// show progress dialog
		var progressWin = new Zotero.ProgressWindow();
		progressWin.changeHeadline(Zotero.getString("save.link"));
		progressWin.show();
		
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
		var zoteroSelected = document.getElementById('zotero-radio').selected;
		
		// don't allow user to remember Zotero option for file type; i'm not sure anyone wants this
		// to happen automatically
		if(zoteroSelected) document.getElementById('rememberChoice').selected = false;
		document.getElementById('rememberChoice').disabled = zoteroSelected;
		
		// disable recognizePDF checkbox as necessary
		if(!Zotero.Fulltext.pdfConverterIsRegistered()) {
			document.getElementById('zotero-noPDFTools-description').hidden = !zoteroSelected;
			document.getElementById('zotero-recognizePDF').disabled = true;
			window.sizeToContent();
		} else {
			document.getElementById('zotero-recognizePDF').disabled = !zoteroSelected;
		}
		
		Zotero_DownloadOverlay.updateLibraryNote();
	};
	
	/**
	 * Determines whether the note stating that the item will be saved to "My Library" is shown
	 */
	this.updateLibraryNote = function() {
		var zoteroSelected = document.getElementById('zotero-radio').selected;
		var zp = Zotero.getActiveZoteroPane(), canSave = true;
		try {
			canSave = zp.getItemGroup().filesEditable;
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
		for each(var elem in ALLOW_LIST) {
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
			'if(!Zotero_DownloadOverlay.handleSave()) { '
			+ document.documentElement.getAttribute('ondialogaccept')
			+'}');
		
		// Hook in event listener for mode change
		var radios = document.getElementById('mode').
			addEventListener("command", Zotero_DownloadOverlay.modeChanged, false);
		
		// Set label on retrieve PDF option
		if(mimeType === PDF_MIME_TYPE) {
			var recognizePDF = document.getElementById('zotero-recognizePDF');
			recognizePDF.label = Zotero.getString("pane.items.menu.recognizePDF");
			recognizePDF.hidden = false;
			recognizePDF.disabled = true;
			if(!Zotero.Fulltext.pdfConverterIsRegistered()) {
				recognizePDF.checked = false;
			}
		}
	};
}

window.addEventListener("load", Zotero_DownloadOverlay.init, false);
window.addEventListener("activate", Zotero_DownloadOverlay.updateLibraryNote, false);