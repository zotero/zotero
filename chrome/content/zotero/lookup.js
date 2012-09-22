/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009-2011 Center for History and New Media
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

/**
 * Handles UI for lookup panel
 * @namespace
 */
const Zotero_Lookup = new function () {
	/**
	 * Performs a lookup by DOI, PMID, or ISBN
	 */
	this.accept = function(textBox) {
		var identifier = textBox.value;
		//first look for DOIs
		var ids = identifier.split(/[\s\u00A0]+/);	//whitespace + non-breaking space
		var items = [], doi;
		for(var i=0, n=ids.length; i<n; i++) {
			if(doi = Zotero.Utilities.cleanDOI(ids[i])) {
				items.push({itemType:"journalArticle", DOI:doi});
			}
		}

		//then try ISBNs
		if(!items.length) {
			//first try replacing dashes
			ids = identifier.replace(/[\u002D\u00AD\u2010-\u2015\u2212]+/g, "");	//hyphens and dashes

			var ISBN_RE = /(?:\D|^)(\d{10}|\d{13})(?!\d)/g;
			var isbn;

			while(isbn = ISBN_RE.exec(ids)) {
				items.push({itemType:"book", ISBN:isbn[1]});
			}

			//now try spaces
			if(!items.length) {
				ids = ids.replace(/[ \u00A0]+/g, "");	//space + non-breaking space
				while(isbn = ISBN_RE.exec(ids)) {
					items.push({itemType:"book", ISBN:isbn[1]});
				}
			}
		}

		//finally try for PMID
		if(!items.length) {
			// PMID; right now, PMIDs are 8 digits, so there doesn't seem like we will need to
			// discriminate for a fairly long time
			var PMID_RE = /(?:\D|^)(\d{8})(?!\d)/g;
			var pmid;
			while(pmid = PMID_RE.exec(identifier)) {
				items.push({itemType:"journalArticle", contextObject:"rft_id=info:pmid/"+pmid[1]});
			}
		}

		if(!items.length) {
			var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
											.getService(Components.interfaces.nsIPromptService);
			prompts.alert(window, Zotero.getString("lookup.failure.title"),
				Zotero.getString("lookup.failureToID.description"));
			return false;
		}

		var notDone = items.length;	 //counter for asynchronous fetching
		var successful = 0;					//counter for successful retrievals

		var libraryID = null;
		var collection = false;
		try {
			libraryID = ZoteroPane_Local.getSelectedLibraryID();
			collection = ZoteroPane_Local.getSelectedCollection();
		} catch(e) {}

		textBox.style.opacity = 0.5;
		textBox.disabled = true;
		document.getElementById("zotero-lookup-progress").setAttribute("collapsed", false);

		var item;
		while(item = items.pop()) {
			(function(item) {
				var translate = new Zotero.Translate("search");
				translate.setSearch(item);

				// be lenient about translators
				var translators = translate.getTranslators();
				translate.setTranslator(translators);

				translate.setHandler("done", function(translate, success) {
					notDone--;
					successful += success;

					if(!notDone) {	//i.e. done
						textBox.style.opacity = 1;
						textBox.disabled = false;
						document.getElementById("zotero-lookup-progress").setAttribute("collapsed", true);
						if(successful) {
							document.getElementById("zotero-lookup-panel").hidePopup();
						} else {
							var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
																			.getService(Components.interfaces.nsIPromptService);
							prompts.alert(window, Zotero.getString("lookup.failure.title"),
								Zotero.getString("lookup.failure.description"));
						}
					}
				});

				translate.setHandler("itemDone", function(obj, item) {
					if(collection) collection.addItem(item.id);
				});
				
				translate.translate(libraryID);
			})(item);
		}

		return false;
	}
	
	/**
	 * Handles a key press
	 */
	this.onKeyPress = function(event, textBox) {
		var keyCode = event.keyCode;
		//use enter to start search, shift+enter to insert a new line. Flipped in multiline mode
		var multiline = textBox.getAttribute('multiline');
		var search = multiline ? event.shiftKey : !event.shiftKey;
		if(keyCode === 13 || keyCode === 14) {
			if(search) {
				Zotero_Lookup.accept(textBox);
			} else if(!multiline) {	//switch to multiline
				var mlTextbox = Zotero_Lookup.switchToMultiline(textBox);
				mlTextbox.value = mlTextbox.value + '\n';
			}
		} else if(keyCode == event.DOM_VK_ESCAPE) {
			document.getElementById("zotero-lookup-panel").hidePopup();
		}
		return true;
	}
	
	/**
	 * Focuses the field
	 */
	this.onShowing = function() {
		document.getElementById("zotero-lookup-panel").style.padding = "10px";
		
		document.getElementById("zotero-lookup-progress").hidden = false;
		var identifierElement = document.getElementById("zotero-lookup-textbox");
		identifierElement.style.opacity = 1;
		identifierElement.disabled = false;
		identifierElement.focus();
	}
	
	/**
	 * Cancels the popup and resets fields
	 */
	this.onHidden = function() {
		var txtBox = document.getElementById("zotero-lookup-textbox");
		var mlTextbox = document.getElementById("zotero-lookup-textbox-multiline");
		txtBox.value = "";
		mlTextbox.value = "";
		//switch back to single line textbox
		mlTextbox.setAttribute("collapsed", true);
		document.getElementById("zotero-lookup-buttons").setAttribute("collapsed", true);
		txtBox.setAttribute("collapsed", false);
		txtBox.focus();
	}

	/**
	 * Converts the textbox to multiline if newlines are detected
	 */
	this.adjustTextbox = function(txtBox) {
		if(txtBox.value.trim().match(/[\r\n]/)) {
			Zotero_Lookup.switchToMultiline(txtBox);
		} else {
			//since we ignore trailing and leading newlines, we should also trim them for display
			//can't use trim, because then we cannot add leading/trailing spaces to the single line textbox
			txtBox.value = txtBox.value.replace(/^([ \t]*[\r\n]+[ \t]*)+|([ \t]*[\r\n]+[ \t]*)+$/g,"");
		}
	}

	/**
	 * Performs the switch to multiline textbox and returns that textbox
	 */
	this.switchToMultiline = function(txtBox) {
		//copy over the value
		var mlTextbox = document.getElementById("zotero-lookup-textbox-multiline");
		mlTextbox.value = txtBox.value;
		//switch textboxes
		txtBox.setAttribute("collapsed", true);
		mlTextbox.setAttribute("collapsed", false);
		mlTextbox.focus();
		document.getElementById("zotero-lookup-buttons").setAttribute("collapsed", false);
		return mlTextbox;
	}
}
