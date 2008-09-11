{
	"translatorID":"e9632edc-8032-4dc5-b2d4-284d481583e6",
	"translatorType":4,
	"label":"SAE International",
	"creator":"Michael Berkowitz",
	"target":"http://www.sae.org/",
	"minVersion":"1.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-06 17:00:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//td[2][@class="search-results"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.match(/\/books\//)) {return "book";}
	else if (url.match(/\/papers\//)) {return "conferencePaper";}
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var links = doc.evaluate('//td[2][@class="search-results"]/a', doc, null, XPathResult.ANY_TYPE, null);
		var link;
		while (link = links.iterateNext()) {
			items[link.href] = link.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var type = detectWeb(doc, doc.location.href);
		if (type == "paper") {
			var data = new Object();
			var metas = doc.evaluate('//meta', doc, null, XPathResult.ANY_TYPE, null);
			var meta;
			while (meta = metas.iterateNext()) {
				name = meta.name;
				content = meta.content;
				if (data[name]) {
					data[name] = data[name] + ";" + content;
				} else {
					data[name] = content;
				}
			}
			var item = new Zotero.Item("conferencePaper");
			item.title = doc.evaluate('//title', doc, null, XPathResult.ANY_TYPe, null).iterateNext().textContent;
			item.data = data['publ_date'];
			item.url = data['identifier_url'];
			var authors = data['author'].split(/\s+;/);
			for each (var aut in authors) {
				item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
			}
			item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//td[1][@class="spg spg-left"]/p[strong[contains(text(), "Abstract")]]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.substr(9));
		} else if (type = "book") {
			var item = new Zotero.Item("book");
			var data = doc.evaluate('//p[strong[contains(text(), "ISBN")]]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			item.ISBN = data.match(/ISBN Number:\s+([\d\-]+)/)[1];
			item.date = data.match(/Date Published:\s+(.*)\n/)[1];
			item.url = doc.location.href;
			item.title = Zotero.Utilities.trimInternal(doc.evaluate('//title', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//td[1][@class="spg spg-left"]/p[contains(text(), ".")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		}
		item.attachments = [{url:item.url, title:item.title, mimeType:"text/html"}];
		item.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}