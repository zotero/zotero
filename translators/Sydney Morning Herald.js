{
	"translatorID":"19120a71-17a8-4629-936a-ccdf899b9861",
	"translatorType":4,
	"label":"Sydney Morning Herald",
	"creator":"Michael Berkowitz",
	"target":"^http://(www|search).smh.com.au/(news|siteSearch|articles)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":99,
	"inRepository":true,
	"lastUpdated":"2007-08-14 22:15:00"
}

function detectWeb(doc, url) {
	if (doc.location.href.indexOf("news") != -1 || doc.location.href.indexOf("articles") != -1) {
		return "newspaperArticle";
	} else if (doc.location.href.indexOf("siteSearch") != -1) {
		return "multiple";
	}
}

function regexMeta(str, item) {
	var re = /name=\"(.*)\"\s+content=\"(.*)\"\s+\/>/;
	var stuff = str.match(re);
	if (stuff[1] == "byline") {
		authors = stuff[2].split(" and ");
		for (var i = 0 ; i < authors.length ; i++) {
			item.creators.push(Zotero.Utilities.cleanAuthor(authors[i].split(" in ")[0], "author"));
		}
	} else if (stuff[1] == "sitecategories") {
		item.section = stuff[2];
	} else if (stuff[1] == "publishdate") {
		item.date = stuff[2].split(/\s+/)[0];
	}
}

function doWeb(doc, url) {
	var articles = new Array();
	if (doc.location.href.indexOf("siteSearch") != -1) {
		var items = new Array();
		var xpath = '//div[@class="searchresults"]/dl/dt/a';
		var stuff = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var thing = stuff.iterateNext();
		while (thing) {
			items[thing.href] = thing.textContent;
			thing = stuff.iterateNext();
		}
		
		items = Zotero.selectItems(items);
		
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles.push(url);
	}
	for (var i = 0 ; i < articles.length ; i++) {
		var url = articles[i]
		Zotero.Utilities.HTTP.doGet(url, function(text) {
			var newItem = new Zotero.Item("newspaperArticle");
			newItem.publicationTitle = "Sydney Morning Herald";
			newItem.url = url;
			newItem.ISSN = "0312-6315";
			//title
			var t = /<HEADLINE>(.*)<\/HEADLINE>/;
			newItem.title = Zotero.Utilities.unescapeHTML(Zotero.Utilities.capitalizeTitle(text.match(t)[1]));
			//hooray for real meta tags!
			var meta = /<meta\s+name=(.*)\/>/g;
			var metaTags = text.match(meta);
			for (var i = 0 ; i <metaTags.length ; i++) {
				regexMeta(metaTags[i], newItem);
			}
			//abstract
			var abs = /meta name=\"Description\" content=\"([^\"]*)\"/;
			var abstract = text.match(abs)[1].split(/\s+/);
			abstract[0] = abstract[0][0] + abstract[0].substr(1).toLowerCase();
			abstract = abstract.join(" ");
			newItem.abstractNote = Zotero.Utilities.unescapeHTML(abstract.substr(0, abstract.length - 3));
			newItem.complete();
			Zotero.done();
		}, function() {});
	}
	Zotero.wait();
}