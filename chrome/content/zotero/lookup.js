/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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


const Zotero_Lookup = new function () {
	this.accept = function() {
		document.getElementById("progress").setAttribute("status", "animate");
		document.getElementById("accept-button").disabled = true;
		var identifier = document.getElementById("lookup-textbox").value;
		
		var doi = Zotero.Utilities.prototype.cleanDOI(identifier);
		if(doi) {
			var item = {itemType:"journalArticle", DOI:doi};
		} else {
			identifier = identifier.replace("-", "", "g");
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
			if(success) {
				window.close();
			} else {
				document.getElementById("accept-button").disabled = undefined;
				document.getElementById("progress").setAttribute("status", "error");
				var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				                        .getService(Components.interfaces.nsIPromptService);
				prompts.alert(window, Zotero.getString("lookup.failure.title"),
					Zotero.getString("lookup.failure.description"));
			}
		});
		
		var libraryID = null;
		var collection = false;
		try {
			libraryID = window.opener.ZoteroPane.getSelectedLibraryID();
			collection = window.opener.ZoteroPane.getSelectedCollection();
		} catch(e) {}
		translate.setHandler("itemDone", function(obj, item) {
			if(collection) collection.addItem(item.id);
		});
		
		translate.translate(libraryID);
		return false;
	}
}
