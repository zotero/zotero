{
	"translatorID":"70295509-4c29-460f-81a3-16d4ddbb93f6",
	"translatorType":4,
	"label":"GSA Journals Online",
	"creator":"Michael Berkowitz",
	"target":"http://www.gsajournals.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.indexOf("request=search") != -1 || url.indexOf("request=get-toc") != -1) {
		return "multiple";
	} else if (url.indexOf("request=get-abstract") != -1 || url.indexOf("request=get-document") != -1) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var results = doc.evaluate('//*[@class="group"]', doc, null, XPathResult.ANY_TYPE, null);
		var next;
		while (next = results.iterateNext()) {
			var title = Zotero.Utilities.trimInternal(doc.evaluate('.//*[@class="title"]', next, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var link = doc.evaluate('.//a[1]', next, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i.replace(/get\-(abstract|document)/, "cite-builder"));
		}
	} else {
		arts = [url.replace(/get\-(abstract|document)/, "cite-builder")];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var newurl = doc.evaluate('//a[contains(@href, "refman")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		var oldurl = doc.location.href;
		Zotero.Utilities.HTTP.doGet(newurl, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.url = oldurl;
				item.DOI = decodeURIComponent(item.url.match(/doi=([^&]+)/)[1]);
				var pdfurl = 'http://www.gsajournals.org/perlserv/?request=res-loc&uri=urn:ap:pdf:doi:' + item.DOI;
				item.attachments = [
					{url:item.url, title:"GSA Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"GSA Full Text PDF", mimeType:"application/pdf"}
				];
				item.complete();
			});
			translator.translate();
		});
	}, function() {Zotero.done();});
}