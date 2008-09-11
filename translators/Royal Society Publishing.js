{
	"translatorID":"56ea09bc-57ee-4f50-976e-cf7cb1f6c6d8",
	"translatorType":4,
	"label":"Royal Society Publishing",
	"creator":"Michael Berkowitz",
	"target":"http://journals.royalsociety.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-04-23 09:45:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div[@class="listItemName"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//div[contains(@id, "ExportDiv")]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	}
}

function makeURL(str, type) {
	var m = str.match(/content\/([^/]+)/)[1];
	if (type == "ris") {
		return "http://journals.royalsociety.org/export.mpx?code=" + m + "&mode=ris";
	} else if (type == "pdf") {
		return "http://journals.royalsociety.org/content/" + m + "/fulltext.pdf";
	}
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var links = doc.evaluate('//div[@class="listItemName"]/a', doc, null, XPathResult.ANY_TYPE, null);
		var link;
		while (link = links.iterateNext()) {
			items[link.href] = link.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	for each (var link in arts) {
		var newurl = makeURL(link, "ris");
		var pdfurl = makeURL(link, "pdf");
		Zotero.Utilities.HTTP.doGet(newurl, function(text) {
			Zotero.debug(text);
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.attachments = [
					{url:link, title:"Royal Society Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"Royal Society PDF", mimeType:"application/pdf"}
				];
				item.complete();
			});
			translator.translate();
		});
	}
}