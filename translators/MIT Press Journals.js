{
	"translatorID":"2e43f4a9-d2e2-4112-a6ef-b3528b39b4d2",
	"translatorType":4,
	"label":"MIT Press Journals",
	"creator":"Michael Berkowitz",
	"target":"http://www.mitpressjournals.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match(/action\/doSearch/) || url.match(/toc\//)) {
		return "multiple";
	} else if (url.match(/doi\/abs\//)) {
		return "journalArticle";
	}
}

function getDOI(str) {
	return str.match(/doi\/abs\/([^?]+)/)[1];
}
	
function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var links = doc.evaluate('//table[@class="articleEntry"]/tbody/tr//a[text() = "First Page" or text() = "Citation" or text() = "Abstract"]', doc, null, XPathResult.ANY_TYPE, null);
		var titles = doc.evaluate('//table[@class="articleEntry"]/tbody/tr//div[@class="arttitle"]', doc, null, XPathResult.ANY_TYPE, null);
		var link, title;
		while ((link = links.iterateNext()) && (title = titles.iterateNext())) {
			items[link.href] = Zotero.Utilities.trimInternal(title.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push('http://www.mitpressjournals.org/doi/abs/' + getDOI(i));
		}
	} else {
		articles = ['http://www.mitpressjournals.org/doi/abs/' + getDOI(url)];
	}
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		if (newDoc.evaluate('//div[@class="abstractSection"]/p[contains(@class, "last") or contains(@class, "first")]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var abs = Zotero.Utilities.trimInternal(newDoc.evaluate('//div[@class="abstractSection"]/p[contains(@class, "last") or contains(@class, "first")]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		}
		var doi = getDOI(newDoc.location.href);
		var risurl = 'http://www.mitpressjournals.org/action/downloadCitation?doi=' + doi + '&include=cit&format=refman&direct=on&submit=Download+article+metadata';		
		var pdfurl = newDoc.location.href.replace("/doi/abs/", "/doi/pdf/");
		Zotero.Utilities.HTTP.doGet(risurl, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if (item.notes[0]['note'].match(/doi:/)) {
					item.DOI = item.notes[0]['note'].substr(5);
					item.notes = new Array();
				}
				item.attachments[0].title= item.publicationTitle + " Snapshot";
				item.attachments[0].mimeType = "text/html";
				item.attachments.push({url:pdfurl, title:item.publicationTitle + " Full Text PDF", mimeType:"application/pdf"});
				if (abs) item.abstractNote = abs;
				item.complete();	
			});
			translator.translate();
		});
	}, function() {Zotero.done();});
	Zotero.wait();
}