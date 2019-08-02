function scrape(doc, url) {
	var DOI = url.match(/\/(10\.[^#?]+)/)[1];
	// TODO adjust the url here
	var risURL = "http://citation-needed.services.springer.com/v2/references/" + DOI + "?format=refman&flavour=citation";
	// Z.debug(risURL)

	// TODO adjust the url here
	var pdfURL = doc.getElementById("articlePdf");
	// Z.debug("pdfURL: " + pdfURL);
	ZU.doGet(risURL, function (text) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function (obj, item) {
			// TODO tweak some of the output here
			if (pdfURL) {
				item.attachments.push({
					url: pdfURL.href,
					title: "Full Text PDF",
					mimeType: "application/pdf"
				});
			}
			item.attachments.push({
				title: "Snapshot",
				document: doc
			});
			item.complete();
		});
		translator.translate();
	});
}
