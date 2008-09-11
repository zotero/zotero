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
	"lastUpdated":"2008-05-15 00:30:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//tr/td[3][@class="bib_data"]/a[@class="bibref"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//a[text() = "View records in XML"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
}

function doWeb(doc, url) {
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = '//a[@class="bibref"]';
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
			if (xml..journal_title.length() != 0) itemtype = "journalArticle";
			
			var item = new Zotero.Item(itemtype);
			item.title = Zotero.Utilities.capitalizeTitle(xml..title.toString());
			for (var i = 0; i < xml..author.length(); i++) {
				var name = xml..author[i].toString().match(/^[^,]+,[^,]+/)[0].split(/,\s+/);
				item.creators.push({lastName:name[0], firstName:name[1], creatorType:"author"});
			}
			if (item.itemType == "book") {
				item.place = xml..place_of_publication.toString();
				item.publisher = xml..publisher.toString();
				item.date = xml..publication_year.toString();
			} else if (item.itemType == "journalArticle") {
				item.publicationTitle = xml..journal_title.toString();
				var voliss = xml..journal_number.split(":");
				Zotero.debug(voliss);
				item.volume = voliss[0];
				item.issue = voliss[1];
				item.date = xml..journal_issue_year;
				item.pages = xml..journal_pages;
			}
			
			item.complete();
		});
		Zotero.done;
	}
	Zotero.wait();
}