{
	"translatorID":"a8df3cb0-f76c-4e2c-a11e-5fa283f8010c",
	"translatorType":4,
	"label":"Copernicus",
	"creator":"Michael Berkowitz",
	"target":"http://www.(adv-geosci|adv-radio-sci|ann-geophys).net/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//iframe', doc, null, XPathResult.ANY_TYPE, null).iterateNext() || doc.evaluate('//li[a[contains(text(), "Abstract")]]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.title.match(/Abstract/)) {
		return "journalArticle";
	}
}

function scrape(doc) {
	var item = new Zotero.Item("journalArticle");
	item.url = doc.location.href;
	item.title = doc.evaluate('//span[@class="inhaltueber_16f"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	item.publicationTitle = doc.evaluate('//span[@class="ueberschrift"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(/\n/)[0];	
	item.repository = item.publicationTitle;
	var authors = doc.evaluate('//td/span[3]/b', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	authors = authors.replace(/\d/g, "").replace(/,,/, ",").split(/(,|and)/);
	for each (var aut in authors) {
		if (!(aut == "and") && (aut.match(/\w/))) {
			aut = Zotero.Utilities.trimInternal(aut);
			names = aut.match(/(.*)\s([^\s]+)/);
			item.creators.push({firstName:names[1], lastName:names[2], creatorType:"author"});
		}
	}
	var voliss = doc.evaluate('//tr[3]/td/span[@class="lib_small"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	voliss = voliss.match(/^([^,]+),([^,]+),([^,]+),([^w]+)/);
	item.journalAbbreviation = voliss[1];
	item.volume = Zotero.Utilities.trimInternal(voliss[2]);
	item.pages = Zotero.Utilities.trimInternal(voliss[3]);
	item.year = Zotero.Utilities.trimInternal(voliss[4]);
	item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//tr[3]/td/span[4]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.substr(10));
	item.attachments = [
		{url:item.url, title:item.publicationTitle + " Snapshot", mimeType:"text/html"},
		{url:item.url.replace(".html", ".pdf"), title:item.publicationTitle + " PDF", mimeType:"application/pdf"}
	];
	item.complete();
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.evaluate('//iframe', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var link = doc.evaluate('//iframe', doc, null, XPathResult.ANY_TYPE, null).iterateNext().src;
			Zotero.Utilities.HTTP.doGet(link, function(text) {
				var links = text.match(/<a\s+target=\"_top\"\s+href=\"[^"]+\">[^<]+/g);
				for each (var link in links) {
					link = link.match(/href=\"([^"]+)\">(.*)/);
					items[link[1].replace(/\.[^\.]+$/, ".html")] = Zotero.Utilities.trimInternal(link[2]) + "...";
				}
				items = Zotero.selectItems(items);
				for (var i in items) {
					arts.push(i);
				}
				
				Zotero.Utilities.processDocuments(arts, function(doc) {
					scrape(doc);
				}, function() {Zotero.done();});				
			});
		} else {
			var titles = doc.evaluate('//li[a[contains(text(), "Abstract")]]/span[@class="articletitle"]', doc, null, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate('//li[a[contains(text(), "Abstract")]]/a[1]', doc, null, XPathResult.ANY_TYPE, null);
			var title;
			var link;
			while ((title = titles.iterateNext()) && (link = links.iterateNext())) {
				items[link.href] = title.textContent;
			}
			items = Zotero.selectItems(items);
			for (var i in items) {
				arts.push(i);
			}
			Zotero.Utilities.processDocuments(arts, function(doc) { scrape(doc);}, function() {Zotero.done();});
		}
	} else {
		Zotero.Utilities.processDocuments([url], function(doc) {
			scrape(doc);
		}, function() {Zotero.done();});
	}
	Zotero.wait();
}