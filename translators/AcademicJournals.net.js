{
	"translatorID":"252c6a50-0900-41c5-a66b-ec456137c43c",
	"translatorType":4,
	"label":"AcademicJournals.net",
	"creator":"Michael Berkowitz",
	"target":"http://www.academicjournals.net/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-05 07:45:00"
}

function detectWeb(doc, url) {
	if (url.match('articleno=')) {
		return "journalArticle";
	} else if (url.match('issueno=') || url.match('current.php')) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return prefix; else return null;
	} : namespace;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var titles = doc.evaluate('//tr[2]/td//table/tbody/tr[1]/td[2]/font', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		var links = doc.evaluate('//tr[4]/td[2]/div/a[@class="links"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var link;
		while ((title = titles.iterateNext()) && (link = links.iterateNext())) {
			items[link.href] = Zotero.Utilities.trimInternal(title.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var item = new Zotero.Item("journalArticle");
		item.url = doc.location.href;
		//title
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//td[2]/table/tbody/tr/td/div/font', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		
		//voliss, etc.
		var voliss = doc.evaluate('//table/tbody/tr/td[2]/font/font', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		voliss = voliss.match(/^([^\d]+)(\d+)\s+\((\d+)\):\s+([\d\-]+),\s+(\d+)/);
		Zotero.debug(voliss);
		item.publicationTitle = voliss[1];
		item.volume = voliss[2];
		item.issue = voliss[3];
		item.pages = voliss[4];
		item.date = voliss[5];
		
		//authors
		var authorsx = doc.evaluate('//td[2]/font/a[@class="links"]/font', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var author;
		var authors = new Array();
		while (author = authorsx.iterateNext()) {
			authors.push(author.textContent);
		}
		for each (var aut in authors) {
			item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
		}
		
		item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//table/tbody/tr/td/div/table/tbody/tr/td[2]/div/font', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		
		//attachments
		var pdfurl = doc.evaluate('//a[contains(@href, ".pdf")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		item.attachments = [
			{url:item.url, title:"AcademicJournals.net Snapshot", mimeType:"text/html"},
			{url:pdfurl, title:"AcademicJournals.net PDF", mimeType:"application/pdf"}
		];
		
		//tags
		var tagspath = doc.evaluate('//tbody/tr/td/table/tbody/tr[2]/td/font/a[@class="links"]/font', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tag;
		var tags = new Array();
		while (tag = tagspath.iterateNext()) {
			tags.push(tag.textContent);
		}
		item.tags = tags;
		item.complete();
	}, function() {Zotero.done;});
}