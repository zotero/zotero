{
	"translatorID":"291934d5-36ec-4b81-ac9c-c5ad5313dba4",
	"translatorType":4,
	"label":"Pion Journals",
	"creator":"Michael Berkowitz",
	"target":"http://(www.)?(hthpweb|envplan|perceptionweb).com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match(/search\.cgi/) || url.match(/ranking/) || url.match(/volume=/)) {
		return "multiple";
	} else if (url.match(/abstract\.cgi/)) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc, "abstract.cgi\\?id=");
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.debug(arts);
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var item = new Zotero.Item("journalArticle");
		item.publicationTitle = Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="footer"]/div[@class="left"]/i', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="total"]/p[2]/font/b', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var authors = Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="total"]/p[3]/b', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent).split(/,\s*/);
		for each (var aut in authors) {
			item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
		}
		if (doc.evaluate('//div[@id="title"]/div[@class="left"]/font', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/\d+/)) {
			var voliss = doc.evaluate('//div[@id="title"]/div[@class="left"]/font', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/(\d+)\s+volume\s+(\d+)\s*\((\d+)\)\s+(pages\s+(.*))?$/);
			Zotero.debug(voliss);
			item.date = voliss[1];
			item.volume = voliss[2];
			item.issue = voliss[3];
			if (voliss[5]) item.pages = voliss[5];
		} else {
			item.date = Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="total"]/p[4]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent).match(/(\d+)$/)[1];
		}
		item.DOI = Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="title"]/div[@class="right"]/font', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent).substr(4);
		
		if (doc.evaluate('//a[contains(@href, ".pdf")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) var pdfurl = doc.evaluate('//a[contains(@href, ".pdf")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		item.url = doc.location.href;
		var pub = item.publicationTitle;
		item.attachments = [{url:item.url, title:pub + " Snapshot", mimeType:"text/html"}];
		if (pdfurl) item.attachments.push({url:pdfurl, title:pub + " Full Text PDF", mimeType:"application/pdf"});
		item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="total"]/p[5]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent).substr(10);
		item.complete();
	}, function() {Zotero.done();});
}