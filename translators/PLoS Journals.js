{
	"translatorID":"9575e804-219e-4cd6-813d-9b690cbfc0fc",
	"translatorType":4,
	"label":"PLoS Journals",
	"creator":"Michael Berkowitz",
	"target":"http://www\\.plos(one|ntds|compbiol|pathogens|genetics)\\.org/(search|article)/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.indexOf("Search.action") != -1 || url.indexOf("browse.action") != -1) {
		return "multiple";
	} else if (url.indexOf("article") != -1) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var items = new Object();
	var texts = new Array();
	if (url.indexOf("Search.action") != -1 || url.indexOf("browse.action") != -1) {
		var articlex = '//span[@class="article"]/a';
		var articles = doc.evaluate(articlex, doc, null, XPathResult.ANY_TYPE, null);
		var next_art = articles.iterateNext();
		while (next_art) {
			items[next_art.href] = next_art.textContent;
			next_art = articles.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			texts.push(i);
		}
	} else {
		texts.push(url);
	}
	Zotero.Utilities.processDocuments(texts, function(newDoc, url) {
		var doi = newDoc.location.href.match(/doi(\/|%2F)(.*)$/)[2];
		var newURL = newDoc.location.href.replace("info", "getRisCitation.action?articleURI=info");
		var pdfURL = newDoc.location.href.replace("info", "fetchObjectAttachment.action?uri=info") + '&representation=PDF';
		Zotero.Utilities.HTTP.doGet(newURL, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.attachments.push({url:pdfURL, title:"PLoS One Full Text PDF", mimeType:"application/pdf"});
				item.DOI = doi;
				item.repository = item.publicationTitle;
				item.complete();
			});
			translator.translate();
		});	
	}, function() {Zotero.done();});
	Zotero.wait();
}