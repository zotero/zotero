const Zotero_Lookup = new function () {
	this.accept = function() {
		document.getElementById("progress").setAttribute("status", "animate");
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
		
		translate = new Zotero.Translate("search", true, false);
		translate.setSearch(item);
		// be lenient about translators
		var translators = translate.getTranslators();
		Zotero.debug(translators[0].label);
		translate.setTranslator(translators);
		translate.setHandler("done", function(translate, success) {
			if(success) {
				window.close();
			} else {
				document.getElementById("progress").setAttribute("status", "error");
				var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
				                        .getService(Components.interfaces.nsIPromptService);
				prompts.alert(window, Zotero.getString("lookup.failure.title"),
					Zotero.getString("lookup.failure.description"));
			}
		});
		try {
			var saveLocation = window.opener.ZoteroPane.getSelectedCollection();
		} catch(e) {}
		translate.setHandler("itemDone", function(obj, item) { window.opener.Zotero_Browser.itemDone(obj, item, saveLocation) });
		translate.translate();
		return false;
	}
}
