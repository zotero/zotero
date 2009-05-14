const Zotero_Lookup = new function () {
	this.accept = function() {
		document.getElementById("progress").setAttribute("status", "animate");
		document.getElementById("accept-button").disabled = true;
		var identifier = document.getElementById("lookup-textbox").value;
		if(identifier.substr(0, 3) == "10.") {
			// DOI
			var item = {itemType:"journalArticle", DOI:identifier};
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
