{
	"translatorID":"393afc28-212d-47dd-be87-ec51bc7a58a4",
	"translatorType":4,
	"label":"The Australian",
	"creator":"Michael Berkowitz",
	"target":"^http://(searchresults|www.theaustralian).news.com.au/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-08-14 22:20:00"
}

function detectWeb(doc, url) {
	if (url == "http://searchresults.news.com.au/servlet/Search" || url.indexOf("siteSearch") != -1) {
		return "multiple";
	} else if (url.indexOf("story") != -1) {
		return "newspaperArticle";
	}
}

function scrape(url) {
	Zotero.Utilities.HTTP.doGet(url, function(text) {
		var newItem = new Zotero.Item("newspaperArticle");
		newItem.url = url;
		newItem.publicationTitle = "The Australian";
		
		//title
		var t = /<title>(.*)<\/title>/;
		newItem.title = Zotero.Utilities.capitalizeTitle(text.match(t)[1].split(" | ")[0]);
		
		//abstract
		var abs = /meta name=\"description\"\s+content=\"(.*)\"/;
		var abstract = Zotero.Utilities.unescapeHTML(text.match(abs)[1]).split(" ");
		abstract[0] = abstract[0][0] + abstract[0].substr(1).toLowerCase();
		newItem.abstractNote = abstract.join(" ");
		
		//tags
		var t = /meta name=\"keywords\"\s+content=\"(.*)\"/;
		var tags = text.match(t)[1].split(/,\s+/);
		for (var i = 0 ; i < tags.length ; i++) {
			newItem.tags.push(Zotero.Utilities.unescapeHTML(tags[i]));
		}

		//section
		var sec = /active\"><a[^>]*>(.*)<\/a>/;
		if (text.match(sec)) {
			newItem.section = text.match(sec)[1];
		}
		
		//timestamp
		var t = /<em class=\"timestamp\">(.*)<\/em>/;
		newItem.date = text.match(t)[1];
		
		//byline
		var by = /<div\s+class=\"module-subheader\"><p>(.*)/;
		if (text.match(by)[1]) {
			var byline = text.match(by)[1];
			var authors = new Array();
			if (byline.indexOf(",") != -1) {
				byline = byline.split(",")[0];
			}
			if (byline.indexOf(" and ") != -1) {
				var authors = byline.split(" and ");
			} else {
				authors.push(byline);
			}
			for (var i = 0 ; i < authors.length ; i++) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
			}
		}
		
		newItem.complete();
		Zotero.debug(newItem);
		
		Zotero.done();
	}, function() {});
}

function doWeb(doc, url) {
	var URLS = new Array();
	var newItems = new Object();
	if (url == "http://searchresults.news.com.au/servlet/Search") {
		var articles = new Array();
		var xpath = '//ol/li/h4[@class="heading"]/a';
		//var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		
		newItems = Zotero.Utilities.getItemArray(doc, doc.getElementsByTagName("h4"), /^http:\/\//);
		newItems = Zotero.selectItems(newItems);
	} else {
		newItems[url] = doc.title.split(" | ")[0]; 
	}

	for (var i in newItems) {
		URLS.push(i);
	}
	
	Zotero.debug(URLS);
	Zotero.Utilities.HTTP.doPost(URLS, "", function(text) {
		for (var i = 0 ; i < URLS.length ; i++) {
			scrape(URLS[i]);
		}
	});
}