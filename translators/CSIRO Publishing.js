{
	"translatorID":"303c2744-ea37-4806-853d-e1ca67be6818",
	"translatorType":4,
	"label":"CSIRO Publishing",
	"creator":"Michael Berkowitz",
	"target":"http://(www.)?publish.csiro.au/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-04-23 09:45:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//a[@class="searchBoldBlue"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext() || doc.evaluate('//a[@class="linkjournal"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("/view/journals/") != -1 || url.indexOf("paper") != -1) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var links = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.evaluate('//a[@class="searchBoldBlue"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var arts = doc.evaluate('//a[@class="searchBoldBlue"]', doc, null, XPathResult.ANY_TYPE, null);
			var art = arts.iterateNext();
			while (art) {
				items[art.href] = art.textContent;
				art = arts.iterateNext();
			}
		} else if (doc.evaluate('//a[@class="linkjournal"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var arts = doc.evaluate('//a[@class="linkjournal"]', doc, null, XPathResult.ANY_TYPE, null);
			var titles = doc.evaluate('//td[3]//td[1]/table/tbody/tr/td/b', doc, null, XPathResult.ANY_TYPE, null);
			var art;
			var title;
			while ((art = arts.iterateNext()) && (title = titles.iterateNext())) {
				items[art.href] = title.textContent;
			}
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			links.push(i.match(/([^/=.htm]*)(.htm)?$/)[1]);
		}
	} else {
		links.push(url.match(/([^/=.htm]*)(.htm)?$/)[1]);
	}
	for (var i in links) {
		var newURL = 'http://www.publish.csiro.au/view/journals/dsp_journal_retrieve_citation.cfm?ct=' + links[i] + '.ris';
		var pdfURL = 'http://www.publish.csiro.au/?act=view_file&file_id=' + links[i] + '.pdf';
		Zotero.Utilities.HTTP.doGet(newURL, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.itemType = "journalArticle";
				if (item.notes[0]) {
					item.abstractNote = item.notes[0].note;
				}
				item.attachments = [
					{url:pdfURL, title:"CSIRO Publishing PDF", mimeType:"application/pdf"},
					{url:newURL, title:"CSIRO Publishing Snaphost", mimeType:"text/html"}
				];
				item.complete();
			});
			translator.translate();
		});
	}
	Zotero.wait();
}