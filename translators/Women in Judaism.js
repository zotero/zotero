{
	"translatorID":"d2416f31-4f24-4e18-8c66-06122af5bc2c",
	"translatorType":4,
	"label":"Women in Judaism",
	"creator":"Michael Berkowitz",
	"target":"http://jps.library.utoronto.ca/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//tr[td/a[2]]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.match(/article\/view/)) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var xpath = '//tr[td/a[2]]';
		if (url.match(/search/)) {
			var titlex = './td[2]';
			var linkx = './td[3]/a[1]';
		} else if (url.match(/issue/)) {
			var titlex = './td[1]';
			var linkx = './td[2]/a[1]';
		}
		var items = new Object();
		var results = doc.evaluate(xpath, doc, ns, XPathResult.ANY_TYPE, null);
		var result;
		while (result = results.iterateNext()) {
			var title = Zotero.Utilities.trimInternal(doc.evaluate(titlex, result, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var link = doc.evaluate(linkx, result, ns, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i.replace("view", "viewArticle"));
		}
	} else {
		arts = [url];
	}
	Zotero.debug(arts);
	Zotero.Utilities.processDocuments(arts,function(doc) {
		var newDoc = doc;
		//var newDoc = doc.defaultView.window.frames[0].document;
		Zotero.debug(newDoc.location.href);
		
		var item = new Zotero.Item("journalArticle");
		if (newDoc.evaluate('//div[@class="Section1"]/div/p/b/span', newDoc, ns, XPathResult.ANY_TYPE, null).iterateNext()) {
			item.title = Zotero.Utilities.trimInternal(newDoc.evaluate('//div[@class="Section1"]/div/p/b/span', newDoc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		} else {
			item.title = Zotero.Utilities.trimInternal(newDoc.evaluate('//div[@id="content"]/h3', newDoc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		}
		var absX = '//div[@id="content"]/div[2]';
		if (newDoc.evaluate(absX, newDoc, ns, XPathResult.ANY_TYPE, null).iterateNext()) item.abstractNote = Zotero.Utilities.trimInternal(newDoc.evaluate(absX, newDoc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		if (newDoc.evaluate('//div[@id="content"]/div/i', newDoc, ns, XPathResult.ANY_TYPE, null).iterateNext()) {
			var authors = newDoc.evaluate('//div[@id="content"]/div/i', newDoc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(/,\s+/);
			for each (var aut in authors) {
				item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
			}
			var voliss = newDoc.evaluate('//div[@id="breadcrumb"]/a[2]', newDoc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/(\d+)/g);
			item.volume = voliss[0];
			item.issue = voliss[1];
			item.date = voliss[2];
		}
		var pdfurl = doc.evaluate('//a[contains(text(), "PDF")]', newDoc, ns, XPathResult.ANY_TYPE, null).iterateNext().href.replace("view", "download");
		item.attachments = [
			{url:doc.location.href, title:"Women In Judaism Snapshot", mimeType:"text/html"},
			{url:pdfurl, title:"Women In Judaism PDF", mimeType:"application/pdf"}
		];
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}