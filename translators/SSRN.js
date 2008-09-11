{
	"translatorID":"b61c224b-34b6-4bfd-8a76-a476e7092d43",
	"translatorType":4,
	"label":"SSRN",
	"creator":"Michael Berkowitz",
	"target":"http://papers\\.ssrn\\.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-07 17:00:00"
}

function detectWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	if (doc.evaluate('//font/strong/a[substring(@class, 1, 4) = "text"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("abstract_id") != -1) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	
	var uris = new Array();
	
	if (doc.evaluate('//font/strong/a[substring(@class, 1, 4) = "text"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		var items = new Object();
		var xpath = '//font/strong/a[substring(@class, 1, 4) = "text"]';
		var titles = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_title = titles.iterateNext();
		while (next_title) {
			items[next_title.href] = next_title.textContent;
			next_title = titles.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			uris.push(i);
		}
	} else {
		uris.push(url);
	}
	
	Zotero.Utilities.processDocuments(uris, function(doc) {
		if (doc.evaluate('//span[@id="knownuser"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var id = doc.location.href.match(/abstract_id=(\d+)/)[1];
			if (doc.evaluate('//a[@title="Download from Social Science Research Network"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				var pdfurl = doc.evaluate('//a[@title="Download from Social Science Research Network"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			}
			var newURL = 'http://papers.ssrn.com/sol3/RefExport.cfm?abstract_id=' + id + '&format=3';
			Zotero.Utilities.HTTP.doGet(newURL, function(text) {
				var ris=text.match(/<input type=\"Hidden\"\s+name=\"hdnContent\"\s+value=\"([^"]*)\">/)[1];
				var trans=Zotero.loadTranslator("import");
				trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				trans.setString(ris);
				trans.setHandler("itemDone", function(obj, item) {
					item.itemType = "journalArticle";
					var tags = new Array();
					for each (var tag in item.tags) {
						var newtags = tag.split(",");
						for each (var newtag in newtags) tags.push(newtag);
					}
					item.tags = tags;
					item.attachments = [{url:item.url, title:"SSRN Snapshot", mimeType:"text/html"}];
					if (pdfurl) item.attachments.push({url:pdfurl, title:"SSRN Full Text PDF", mimeType:"application/pdf"});
					item.complete();
				});
				trans.translate();
			});
		} else {
			var item = new Zotero.Item("journalArticle");
			item.title = Zotero.Utilities.capitalizeTitle(Zotero.Utilities.trimInternal(doc.evaluate('//tbody/tr/td[2]/font/strong', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent));
			var authors = doc.evaluate('//tr/td/center/font/a[@class="textlink"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var author;
			while (author = authors.iterateNext()) {
				var aut = Zotero.Utilities.capitalizeTitle(Zotero.Utilities.trimInternal(author.textContent));
				item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
			}
			item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//td[strong/font]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent).substr(10);
			item.tags = Zotero.Utilities.trimInternal(doc.evaluate('//font[contains(text(), "Key")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent).substr(10).split(/,\s+/);
			item.publicationTitle = "SSRN eLibrary";
			
			var bits = doc.evaluate('//tr/td/center/font', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var bit;
			while (bit = bits.iterateNext()) {
				if (bit.textContent.match(/\d{4}/)) item.date = Zotero.Utilities.trimInternal(bit.textContent);
			}
			item.url = doc.location.href;
			if (doc.evaluate('//a[@title="Download from Social Science Research Network"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				var pdfurl = doc.evaluate('//a[@title="Download from Social Science Research Network"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			}
			item.attachments = [{url:item.url, title:"SSRN Snapshot", mimeType:"text/html"}];
			if (pdfurl) item.attachments.push({url:pdfurl, title:"SSRN Full Text PDF", mimeType:"application/pdf"});
			item.complete();
		}
	}, function() {Zotero.done;});
	Zotero.wait();
}