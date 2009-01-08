{
	"translatorID":"c0d7d260-d795-4782-9446-f6c403a7922c",
	"translatorType":4,
	"label":"Science Links Japan",
	"creator":"Michael Berkowitz",
	"target":"http://sciencelinks.jp/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match(/result/) || url.match(/journal/)) {
		return "multiple";
	} else if (url.match(/article/)) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var ns = doc.documentElement.namespaceURI;
	nsR = ns ? function(prefix) {
		if (prefix == 'x') return ns; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc, "(article|display\.php)");
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var data = new Array();
		var bits = doc.evaluate('//div[@id="result_detail"]/table/tbody/tr/td', doc, nsR, XPathResult.ANY_TYPE, null);
		var bit;
		while (bit = bits.iterateNext()) {
			data.push(Zotero.Utilities.trimInternal(bit.textContent));
		}
		var item = new Zotero.Item("journalArticle");
		for each (var datum in data) {
			if (datum.match(/^Title;/)) {
				item.title = Zotero.Utilities.capitalizeTitle(datum.match(/Title;(.*)$/)[1]);
			} else if (datum.match(/^Author;/)) {
				var auts = datum.match(/\b[A-Z'\-]+\s+[A-Z'\-]+/g);
				for each (var aut in auts) {
					item.creators.push(Zotero.Utilities.cleanAuthor(Zotero.Utilities.capitalizeTitle(aut, true), "author"));
				}
			} else if (datum.match(/^Journal Title;/)) {
				item.publicationTitle = datum.match(/;(.*)$/)[1];
			} else if (datum.match(/^ISSN/)) {
				item.ISSN = datum.match(/[\d\-]+/)[0];
			} else if (datum.match(/^VOL/)) {
				var voliss = datum.match(/^VOL\.([^;]*);NO\.([^;]*);PAGE\.([^(]*)\((\d+)\)/);
				item.volume = voliss[1];
				item.issue = voliss[2];
				item.pages = voliss[3];
				item.date = voliss[4];
			} else if (datum.match(/^Abstract/)) {
				item.abstractNote = datum.match(/;(.*)/)[1];
			}
		}
		item.url = doc.location.href;
		item.attachments = [{url:item.url, title:"Science Links Japan Snapshot", mimeType:"text/html"}];
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}