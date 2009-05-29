{
	"translatorID":"8c1f42d5-02fa-437b-b2b2-73afc768eb07",
	"translatorType":4,
	"label":"Highwire 2.0",
	"creator":"Matt Burton",
	"target":"DISABLED(content/([0-9]+/[0-9]+|current|firstcite)|search|cgi/collection/.+)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-05-26 14:35:00"
}

function detectWeb(doc, url) {
	if (
		url.match("search") || 
		url.match("content/by/section") || 
		doc.title.match("Table of Contents") || 
		doc.title.match("Early Edition") || 
		url.match("cgi/collection/.+") || 
		url.match("content/firstcite") 
	) {
		return "multiple";
	} else if (url.match("content/[0-9]+")) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	
	
	var host = 'http://' + doc.location.host + "/";
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title.match("Table of Contents") || doc.title.match("Early Edition") || url.match("content/firstcite")) {
			var searchx = '//li[contains(@class, "cit toc-cit") and not(ancestor::div/h2/a/text() = "Correction" or ancestor::div/h2/a/text() = "Corrections")]'; 
			var titlex = './/h4';
		} else if (url.match("content/by/section") || url.match("cgi/collection/.+")) {
			var searchx = '//li[contains(@class, "results-cit cit")]'; 
			var titlex = './/span[contains(@class, "cit-title"])';
		}
		else {
			var searchx = '//div[contains(@class,"results-cit cit")]';
			var titlex = './/span[contains(@class,"cit-title")]';
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
	Zotero.debug(arts.length);
	if(arts.length == 0) {
		Zotero.debug('no items');
		return false;
	}
	Zotero.Utilities.HTTP.doGet(arts, function(text) {
		var id = text.match(/=([^=]+)\">\s*Download to citation manager/)[1];
		var newurl = newurls.shift();		
		if (newurl.match("cgi/content")) {
			var pdfurl = newurl.replace(/cgi\/content\/abstract/, "content") + ".full.pdf";
		} else {
			// This is not ideal...todo: brew a regex that grabs the correct URL
			var pdfurl = newurl.slice(0, newurl.lastIndexOf(".")) + ".full.pdf";
		}
		var get = host + 'citmgr?type=refman&gca=' + id;
		Zotero.Utilities.HTTP.doGet(get, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			if (text.match(/N1(.*)\n/)) {
				var doi = text.match(/N1\s+\-\s+(.*)\n/)[1];
			}
			translator.setHandler("itemDone", function(obj, item) {
				item.attachments = [
					{url:newurl, title:"Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"Full Text PDF", mimeType:"application/pdf"}
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