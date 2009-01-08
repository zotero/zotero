{
	"translatorID":"dedcae51-073c-48fb-85ce-2425e97f128d",
	"translatorType":4,
	"label":"Archive Ouverte en Sciences de l'Information et de la Communication  (AOSIC)",
	"creator":"Michael Berkowitz",
	"target":"http://archivesic.ccsd.cnrs.fr/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.title.toLowerCase().match("fulltext search")) {
		return "multiple";
	} else if (url.match(/sic_\d+/)) {
		return "journalArticle";
	}
}

var metaTags = {
	"DC.relation":"url",
	"DC.date":"date",
	"DC.description":"abstractNote",
	"DC.creator":"creators",
	"DC.title":"title"
}

function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc, /sic_\d+\/fr\//);
		items = Zotero.selectItems(items) 
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	Zotero.Utilities.processDocuments(articles, function(doc) {
		var xpath = '//meta[@name]';
		var data = new Object();
		var metas = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var meta;
		while (meta = metas.iterateNext()) {
			if (data[meta.name]) {
				data[meta.name] = data[meta.name] + ";" + meta.content;
			} else {
				data[meta.name] = meta.content;
			}
		}
		Zotero.debug(data);
		var item = new Zotero.Item("journalArticle");
		for (var tag in metaTags) {
			if (tag == "DC.creator") {
				var authors = data['DC.creator'].split(";");
				for each (var aut in authors) {
					aut = aut.replace(/^([^,]+),\s+(.*)$/, "$2 $1");
					item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
				}
			} else {
				item[metaTags[tag]] = data[tag];
			}
		}
		var pdfurl = doc.evaluate('//a[contains(@href, ".pdf")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href.match(/url=([^&]+)&/)[1];
		Zotero.debug(pdfurl);
		item.attachments = [
			{url:item.url, title:"AOSIC Snapshot", mimeType:"text/html"},
			{url:pdfurl, title:"AOSIC Full Text PDF", mimeType:"application/pdf"}
		];
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}