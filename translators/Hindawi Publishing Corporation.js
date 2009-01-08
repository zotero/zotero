{
	"translatorID":"bc39e05b-141a-4322-85f0-a5b86edf896b",
	"translatorType":4,
	"label":"Hindawi Publishing Corporation",
	"creator":"Michael Berkowitz",
	"target":"http://www.hindawi.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match('GetArticle.aspx')) {
		return "journalArticle";
	} else if (Zotero.Utilities.getItemArray(doc, doc, 'GetArticle.aspx').length != 0) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc, 'GetArticle.aspx');
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var item = new Zotero.Item("journalArticle");
		item.title = doc.title;
		item.url = doc.location.href;
		
		var authorsx = doc.evaluate('//span/h1/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var aut;
		var authors = new Array();
		while (aut = authorsx.iterateNext()) {
			var author = aut.textContent;
			item.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
		item.doi = item.url.match(/doi=(.*)/)[1];
		
		var voliss = doc.evaluate('//span/pre', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.toLowerCase();
		if (voliss.match(/volume/)) item.volume = voliss.match(/volume\s+(\d+)/)[1];
		if (voliss.match(/\(\d+\)/)) item.date = voliss.match(/\((\d+)\)/)[1];
		if (voliss.match(/issue/)) item.issue = voliss.match(/issue\s+(\d+)/)[1];
		if (voliss.match(/pages\s+\d+/)) item.pages = voliss.match(/pages\s+([\d\-]+)/)[1];
		if (voliss.match(/article id/)) item.extra = 'Article ID ' + voliss.match(/article id\s+(\d+)/)[1];
		
		var abss = doc.evaluate('//span/p', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var absbit;
		var abs = "";
		while (absbit = abss.iterateNext()) {
			abs += absbit.textContent;
		}
		abs = Zotero.Utilities.trimInternal(abs);
		item.abstractNote = abs;
		item.publicationTitle = doc.evaluate('//img[@id="ctl00_ImgTitle"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().alt;
		item.attachments = [
			{url:item.url, title:item.publicationTitle + " Snapshot", mimeType:"text/html"},
			{url:item.url.replace('GetArticle', 'Getpdf'), title:item.publicationTitle + " PDF", mimeType:"application/pdf"}
		];
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}