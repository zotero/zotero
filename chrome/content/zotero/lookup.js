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
	this.accept = function() {
		var identifierElement = document.getElementById("zotero-lookup-textbox");
		var identifier = identifierElement.value;
		
		var doi = Zotero.Utilities.cleanDOI(identifier);
		if(doi) {
			var item = {itemType:"journalArticle", DOI:doi};
		} else {
			identifier = identifier.trim().replace("-", "", "g");
			if(identifier.length == 10 || identifier.length == 13) {
				// ISBN
				var item = {itemType:"book", ISBN:identifier};
			} else {
				// PMID; right now, PMIDs are 8 digits, so there doesn't seem like we will need to
				// discriminate for a fairly long time
				var item = {itemType:"journalArticle", contextObject:"rft_id=info:pmid/"+identifier};
			}
		}
		
		var translate = new Zotero.Translate("search");
		translate.setSearch(item);
		
		// be lenient about translators
		var translators = translate.getTranslators();
		translate.setTranslator(translators);
		
		translate.setHandler("done", function(translate, success) {
			identifierElement.style.opacity = 1;
			identifierElement.disabled = false;
			document.getElementById("zotero-lookup-progress").hidden = true;
			if(success) {
				document.getElementById("zotero-lookup-panel").hidePopup();
			} else {
				var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				                        .getService(Components.interfaces.nsIPromptService);
				prompts.alert(window, Zotero.getString("lookup.failure.title"),
					Zotero.getString("lookup.failure.description"));
			}
		});
		
		var libraryID = null;
		var collection = false;
		try {
			libraryID = ZoteroPane_Local.getSelectedLibraryID();
			collection = ZoteroPane_Local.getSelectedCollection();
		} catch(e) {}
		translate.setHandler("itemDone", function(obj, item) {
			if(collection) collection.addItem(item.id);
		});
		
		identifierElement.style.opacity = 0.5;
		identifierElement.disabled = true;
		document.getElementById("zotero-lookup-progress").hidden = false;
		
		translate.translate(libraryID);
		return false;
	}
	
	/**
	 * Handles a key press
	 */
	this.onKeyPress = function(event) {
		var keyCode = event.keyCode;
		if(keyCode === 13 || keyCode === 14) {
			Zotero_Lookup.accept();
		} else if(keyCode == event.DOM_VK_ESCAPE) {
			document.getElementById("zotero-lookup-panel").hidePopup();
		}
		return true;
	}
	
	/**
	 * Focuses the field
	 */
	this.onShowing = function() {
		if(!Zotero.isFx4) {
			document.getElementById("zotero-lookup-panel").style.padding = "10px";
		}
		
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
		document.getElementById("zotero-lookup-textbox").value = "";
	}
}
