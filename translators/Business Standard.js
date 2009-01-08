{
	"translatorID":"e8d40f4b-c4c9-41ca-a59f-cf4deb3d3dc5",
	"translatorType":4,
	"label":"Business Standard",
	"creator":"Prashant Iyengar and Michael Berkowitz",
	"target":"http://www.business-standard.com",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match(/googlesearch/)) {
		return "multiple";
	} else if (url.match(/common/)) {
		return "newspaperArticle";
	}
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var links = doc.evaluate('//a[@class="NewsHead"]', doc, null, XPathResult.ANY_TYPE, null);
		var link;
		var items = new Object();
		while (link = links.iterateNext()) {
			items[link.href] = Zotero.Utilities.cleanTags(link.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var newItem = new Zotero.Item("newspaperArticle");
		newItem.publicationTitle = "The Business Standard";
		newItem.url = doc.location.href;
		newItem.websiteTitle="The Business Standard";
		newItem.edition="Online";
		newItem.title = Zotero.Utilities.cleanTags(doc.title);

                        
		if (doc.evaluate('//td[@class="author"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var bits = doc.evaluate('//td[@class="author"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.split(/\s+\/\s+/);
			newItem.creators.push(Zotero.Utilities.cleanAuthor(bits[0], "author"));
			extras = Zotero.Utilities.trimInternal(bits[1]).match(/^(.*)(\s\w+\s+\d+,\s*\d+)$/);
			newItem.place = extras[1];
			newItem.date = Zotero.Utilities.trimInternal(extras[2]);
			newItem.complete();
		} else if (doc.evaluate('//td[@class="NewsSummary"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var author = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="NewsSummary"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
			var printurl = 'http://www.business-standard.com/general/printpage.php?autono=' + newItem.url.match(/autono=(\d+)/)[1];
			Zotero.debug(printurl);
			Zotero.Utilities.HTTP.doGet(printurl, function(text) {
				var date = text.match(/<td class=author>([^<]+)</)[1];
				newItem.date = Zotero.Utilities.trimInternal(date.split("&nbsp;")[1]);
				newItem.complete();
			});
		}
	}, function() {Zotero.done();});
	Zotero.wait();
}
