{
	"translatorID":"8c1f42d5-02fa-437b-b2b2-73afc768eb07",
	"translatorType":4,
	"label":"PNAS",
	"creator":"Matt Burton",
	"target":"http://[^/]*\\.pnas\\.org[^/]*/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-12-26 12:35:00"
}

function detectWeb(doc, url) {
	if (url.match("search") || doc.title.match("Table of Contents") || doc.title.match("Early Edition")) {
		return "multiple";
	} else if (url.match("content/[0-9]")) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title.match("Table of Contents") || doc.title.match("Early Edition")) {
			var searchx = '//li[@class = "cit toc-cit"]'; 
			var titlex = './/h4';
		} else {
			var searchx = '//div[@class = "results-cit cit"]';
			var titlex = './/span[@class = "cit-title"]';
		}	
		var linkx = './/a[1]';
		var searchres = doc.evaluate(searchx, doc, null, XPathResult.ANY_TYPE, null);
		var next_res;
		while (next_res = searchres.iterateNext()) {
			var title = doc.evaluate(titlex, next_res, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate(linkx, next_res, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		} 
	} else {
		arts = [url];
	}
	var newurls = new Array();
	for each (var i in arts) {
		newurls.push(i);
	}
	Zotero.Utilities.HTTP.doGet(arts, function(text) {
		var id = text.match(/=([^=]+)\">\s*Download to citation manager/)[1];
		var newurl = newurls.shift();
		var pdfurl = newurl.slice(0, newurl.lastIndexOf(".")) + ".full.pdf";
		var get = 'http://www.pnas.org/citmgr?type=refman&gca=' + id;
		Zotero.Utilities.HTTP.doGet(get, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			if (text.match(/N1(.*)\n/)) {
				var doi = text.match(/N1\s+\-\s+(.*)\n/)[1];
			}
			translator.setHandler("itemDone", function(obj, item) {
				item.attachments = [
					{url:newurl, title:"PNAS Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"PNAS Full Text PDF", mimeType:"application/pdf"}
				];
				if (doi) item.DOI = doi;
				if (item.notes) item.notes = [];
				item.complete();
			});
			translator.translate();
		});
	});
	Zotero.wait();
}