{
	"translatorID":"a69deb08-47d9-46ad-afca-bc3a2499ad34",
	"translatorType":4,
	"label":"Royal Historical Society",
	"creator":"Michael Berkowitz",
	"target":"http://www.rhs.ac.uk/bibl/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div[@class="bib_data"]/a[contains(@title, "view in more detail")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//a[text() = "View records in XML"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "document";
	}
}

function doWeb(doc, url) {
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = '//div[@class="bib_data"]/a[contains(@title, "view in more detail")]';
		var results = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var result;
		while (result = results.iterateNext()) {
			items[result.href] = Zotero.Utilities.trimInternal(result.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			books.push(i.replace(/DATABASE=[^&]+/, "DATABASE=xmlcatalo"));
		}
	} else {
		books = [url.replace(/DATABASE=[^&]+/, "DATABASE=xmlcatalo")];
	}
	for each (var link in books) {
		Zotero.Utilities.HTTP.doGet(link, function(text) {
			text = text.replace(/<\?[^?]+\?>/, "");
			var xml = new XML(text);
			xml = xml..recordList;
			var itemtype = "book";
			if (xml..journal.length() != 0) itemtype = "journalArticle";
			if (xml..in.length() != 0) itemtype = "bookSection";
			
			var item = new Zotero.Item(itemtype);
			item.title = Zotero.Utilities.cleanTags(xml..title.toString());
			item.date = xml..date.toString().match(/\d+/);
			item.pages = xml..length.toString();
			for (var i = 0; i < xml..author.length(); i++) {
				var name = xml..author[i].toString().match(/^[^,]+,[^,]+/)[0].split(/,\s+/);
				item.creators.push({lastName:name[0], firstName:name[1], creatorType:"author"});
			}
			if (item.itemType == "book") {
				item.place = xml..place_of_publication.toString();
				item.publisher = xml..publisher.toString();
				item.ISBN = xml..ISBN.toString();
			} else if (item.itemType == "journalArticle") {
				item.publicationTitle = xml..journal.toString();
				item.volume = xml..journal_volume.toString();
				item.issue = xml..journal_issue.toString();
				item.series = xml..series.toString();
				item.ISSN = xml..ISSN.toString();
			} else if (item.itemType == "bookSection") {
				if (xml..title_interpolation.toString()) {
					item.bookTitle = xml..title_interpolation.toString();
				} else {
					item.bookTitle = xml..in.toString().match(/\),\s(.+)\s\(/)[1];
				}
				
				item.ISBN = xml..ISBN.toString();
				try { // this regex is iffy
					bookInfo = xml..in.toString().match(/\(([A-Za-z;\s]+:[A-Za-z\s']+),\s\d+\)/)[1];
				} catch (e) {
					Zotero.debug("regex didn't work");
				}
				item.place = bookInfo.split(": ")[0]
				item.publisher = bookInfo.split(": ")[1]
			}
			
			item.complete();
		}, function(){Zotero.done();});
		
	}
	Zotero.wait();
}