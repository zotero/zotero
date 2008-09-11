{
	"translatorID":"ca6e95d1-46b9-4535-885c-df0c2d4b7f7a",
	"translatorType":4,
	"label":"Innovate Online",
	"creator":"Michael Berkowitz",
	"target":"^http://(www.)?innovateonline.info/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-01-07 19:00:00"
}

function detectWeb(doc, url) {
	if (url.indexOf("view=article") != -1) {
		return "journalArticle";
	} else if (url.indexOf("view=search") != -1) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var newURIs = new Array();
	
	if (url.indexOf("view=search") != -1) {
		var titles = new Array();
		var hrefs = new Array();
		var items = new Object();
		var xpath = '//ul[@class="articles"]/li[@class="result"]/div[@class="header"]';
		var names = doc.evaluate(xpath, doc, namespace, XPathResult.ANY_TYPE, null);
		var next_item = names.iterateNext();
		while (next_item) {
			titles.push(next_item.textContent.split(/\n/)[3]);
			next_item = names.iterateNext();
		}
		
		var nextpath = '//ul[@class="articles"]/li/@onclick';
		var links = doc.evaluate(nextpath, doc, namespace, XPathResult.ANY_TYPE, null);
		var next_link = links.iterateNext();
		while (next_link) {
			hrefs.push(next_link.textContent);
			next_link = links.iterateNext();
		}
	
		for (var i = 0 ; i < titles.length ; i++) {
			items[hrefs[i].match(/\d+/)] = titles[i];
		}
		items = Zotero.selectItems(items);
		
		for (var i in items) {
			newURIs.push('http://innovateonline.info/index.php?view=article&id=' + i);
		}
	} else {
		var newURL = url;
		if (newURL.indexOf("highlight") != -1) {
			newURL = newURL.substring(0, newURL.indexOf("highlight") -1);
		}
		if (newURL.indexOf("action=synopsis") != -1) {
			newURL = newURL.replace("action=synopsis", "action=article");
		}
		newURIs.push(newURL);
	}
	Zotero.debug(newURIs);
	
	Zotero.Utilities.processDocuments(newURIs, function(newDoc) {
		var newItem = new Zotero.Item("journalArticle");
		newItem.repository = "Innovate Online";
		newItem.publicationTitle = "Innovate";
		newItem.title = newDoc.title.substring(10);
		
		var authors = newDoc.evaluate('//div[@id="title"]/div[@class="author"]/a', newDoc, namespace, XPathResult.ANY_TYPE, null);
		var author = authors.iterateNext();
		while (author) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author.textContent, "author"));
			author = authors.iterateNext();
		}
		
		newItem.date = newDoc.evaluate('//div[@id="page"]/a/div[@class="title"]', newDoc, namespace, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		
		var voliss = newDoc.evaluate('//div[@id="page"]/a/div[@class="subtitle"]', newDoc, namespace, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/Volume\s+(\d+).*Issue\s+(\d+)/);
		newItem.volume = voliss[1];
		newItem.issue = voliss[2];
		
		var id = newDoc.location.href.match(/\d+/)[0];
		var PDFurl = "http://innovateonline.info/print.php?view=pdf&id=" + id;
		newItem.attachments = [
			{url:newDoc.location.href, title:"Innovate Online Snapshot", mimeType:"text/html"},
			{url:PDFurl, title:"Innovate Online PDF", mimeType:"application/pdf"}
		]
		
		Zotero.Utilities.HTTP.doGet(newDoc.location.href.replace("action=article", "action=synopsis"), function(text) {
			var abs = text.match(/<div id=\"synopsis\">\n<p>(.*)<\/p>/)[1];
			newItem.abstractNote = Zotero.Utilities.unescapeHTML(Zotero.Utilities.cleanTags(abs));
			newItem.complete();
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}