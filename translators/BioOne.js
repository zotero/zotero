{
	"translatorID":"7cb0089b-9551-44b2-abca-eb03cbf586d9",
	"translatorType":4,
	"label":"BioOne",
	"creator":"Michael Berkowitz",
	"target":"http://[^/]*www.bioone.org[^/]*/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.indexOf("searchtype") != -1) {
		return "multiple";
	} else if (url.indexOf("get-document") != -1 || url.indexOf("get-abstract") != -1) {
		return "journalArticle";
	}
}

function createCitationURL(str) {
	str = str.match(/doi=([^&]+)/)[1];
	return "http://www.bioone.org/perlserv/?request=cite-builder&doi=" + str;
}

function doWeb(doc, url) {
	var host = doc.location.host;
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var results = doc.evaluate('//div[@class="content"]/table/tbody/tr/td[3][@class="group"]', doc, null, XPathResult.ANY_TYPE, null);
		var next_result;
		while (next_result = results.iterateNext()) {
			var title = doc.evaluate('.//span[@class="title"]', next_result, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate('.//tr[4]/td/a[1]', next_result, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(createCitationURL(i));
		}
	} else {
		articles = [createCitationURL(url)];
	}
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var newlink = newDoc.evaluate('//a[contains(@href, "refman")]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		Zotero.Utilities.HTTP.doGet(newlink, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.url = decodeURIComponent(item.url);
				item.DOI = item.url.match(/http:\/\/dx\.doi\.org\/(.*)$/)[1];
				var pdfurl = 'http://' + host + '/perlserv/?request=get-pdf&doi=' + item.DOI;
				item.attachments = [
					{url:item.url, title:item.title, mimeType:"text/html"},
					{url:pdfurl, title:"BioOne Full Text PDF", mimeType:"application/pdf"}
				];
				item.complete();
			});
			translator.translate();
		});
	}, function() {Zotero.done();});
	Zotero.wait();
}