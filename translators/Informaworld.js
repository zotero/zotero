{
	"translatorID":"1885b93c-cf37-4b25-aef5-283f42eada9d",
	"translatorType":4,
	"label":"Informaworld",
	"creator":"Michael Berkowitz",
	"target":"http://www.informaworld.com",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.indexOf("quicksearch") != -1) {
		return "multiple";
	} else if (doc.evaluate('//a[substring(text(), 2, 8) = "Download"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		if (doc.evaluate('//div[@id="metahead"]/div/strong[text() = "Published in:"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var pubtype = doc.evaluate('//img[substring(@title, 1, 17) = "Publication type:"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().title;
			if (pubtype.match("journal")) {
				return "journalArticle";
			} else if (pubtype.match("book")) {
				return "bookSection";
			}
		} else {
			return "book";
		}
	} else if (url.indexOf("content=g") != -1 || 
			doc.evaluate('//div[@id="browse"]//tbody/tr/td[2]/a[2]', doc, null, XPathResult.ANY_TYPE, null).iterateNext() ||
			doc.evaluate('//div[@id="title"]//td[2]/div/strong/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else {
		return true;
	}
}


function doWeb(doc, url) {
	var links = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.evaluate('//div[@id="quicksearch"]//tr/td/b/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="quicksearch"]//tr/td/b/a';
		} else if (doc.evaluate('//div[@id="title"]/table/tbody/tr[2]//strong/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="title"]/table/tbody/tr[2]//strong/a';
		} else if (doc.evaluate('//div[@id="browse"]//tbody/tr/td[2]/a[2]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="browse"]//tbody/tr/td[2]/a[2]';
		} else if (doc.evaluate('//div[@id="title"]//td[2]/div/strong/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="title"]//td[2]/div/strong/a';
		}
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var title = titles.iterateNext();
		while (title) {
			items[title.href] = title.textContent;
			title = titles.iterateNext();
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			links.push(i);
		}
	} else {
		links = [url];
	}
	Zotero.debug(links);
	
	Zotero.Utilities.processDocuments(links, function(newDoc) {
		var xpath = '//div[@id="metahead"]/div';
		var stuff = newDoc.evaluate(xpath, newDoc, null, XPathResult.ANY_TYPE, null);
		var thing = stuff.iterateNext() ;
		while (thing) {
			if (thing.textContent.match(/DOI/)) {
				var doi = Zotero.Utilities.trimInternal(thing.textContent).match(/:\s+(.*)/)[1];
			}
			thing = stuff.iterateNext();
		}
		var pdfurl = newDoc.evaluate('//div[@id="content"]/div/a[1]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		var id = newDoc.location.href.match(/content=([\w\d]+)/);
		var post = 'tab=citation&selecteditems=' + id[1].substr(1) + '&content=' + id[1] + '&citstyle=refworks&showabs=false&format=file';
		Zotero.Utilities.HTTP.doPost('http://www.informaworld.com/smpp/content', post, function(text) {
			text = text.replace(/RT/, "TY");
			text = text.replace(/VO/, "VL");
			text = text.replace(/LK/, "UR");
			text = text.replace(/YR/, "PY");
			text = text.replace(/([A-Z][A-Z\d]\s)/g, "$1 - ")
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var type = text.match(/TY\s+\-\s+([^\n]*)/)[1];
				if (type == "Journal") {
					item.itemType = "journalArticle";
				} else if (type == "Book, Whole") {
					item.itemType = "book";
				} else if (type == "Book, Section") {
					item.itemType = "bookSection";
				}
				if (doi) {
					item.DOI = doi;
				}
				item.attachments.push({url:pdfurl, title:item.title, mimeType:'application/pdf'});
				item.complete();
			});
			translator.translate();
			
		});
	}, function() {Zotero.done();});
}