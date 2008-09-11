{
	"translatorID":"efb3c424-daa9-40c9-8ee2-983d2802b27a",
	"translatorType":4,
	"label":"The Age",
	"creator":"Michael Berkowitz",
	"target":"^http://(www|search).theage.com.au/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-08-14 22:15:00"
}

function detectWeb(doc, url) {
	if (url.indexOf("siteSearch.ac") != -1) {
		return "multiple";
	} else if (url.indexOf("html") != -1) {
		return "newspaperArticle";
	}
}

function scrape(url) {
	Zotero.Utilities.HTTP.doGet(url, function(text) {
		var newItem = new Zotero.Item("newspaperArticle");
		newItem.ISSN = "0312-6307";
		newItem.url =url;
		newItem.publicationTitle = "The Age";
		Zotero.debug(url);
		
		//title
		var t = /<HEADLINE>(.*)<\/HEADLINE>/;
		newItem.title = Zotero.Utilities.unescapeHTML(Zotero.Utilities.capitalizeTitle(text.match(t)[1]).split(" - ")[0]);
		
		//meta tags? (except abstract, for some reason)
		var m = /name=\"(.*)\"\s+content=\"(.*)\"\s+\/>/g;
		var metaTags = text.match(m);
		var metaInfo = new Object();
		var metaNames = new Array();
		var m2 = /name=\"(.*)\"\s+content=\"(.*)\"\s+\/>/;
		for (var i = 0 ; i < metaTags.length ; i++) {
			var stuff = metaTags[i].match(m2);
			metaInfo[stuff[1]] = stuff[2];
			metaNames.push(stuff[1]);
		}
		
		for (var i = 0 ; i <metaNames.length ; i++) {
			if (metaNames[i] == "sitecategories") {
				newItem.section = metaInfo[metaNames[i]].split(",")[0];
			} else if (metaNames[i] == "publishdate") {
				newItem.date = metaInfo[metaNames[i]].split(/\s+/)[0];
			} else if (metaNames[i] == "byline") {
				var byline = metaInfo[metaNames[i]].split(",")[0];
				if (byline.indexOf(" and ") != -1) {
					byline = byline.split(" and ");
					for (var j = 0 ; j < byline.length ; j++) {
						newItem.creators.push(Zotero.Utilities.cleanAuthor(byline[j], "author"));
					}
				} else {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(byline, "author"));
				}
			} else if (metaNames[i] == "keywords") {
				var keywords = metaInfo[metaNames[i]].split(",");
				for (var k = 0 ; k < keywords.length ; k++) {
					if (keywords[k].length > 1) {
						newItem.tags.push(Zotero.Utilities.unescapeHTML(keywords[k][0].toUpperCase() + keywords[k].substr(1).toLowerCase()));
					}
				}
			}
		}
		
		//abstract
		var a = /\"Description\"\s+content=\"([^\"]*)\"/;
		newItem.abstractNote = Zotero.Utilities.unescapeHTML(text.match(a)[1].substring(0, text.match(a)[1].length - 3));
		
		newItem.complete();
		Zotero.done();
	}, function() {});
}

function doWeb(doc, url) {
	var URLS = new Array();
	if (url.indexOf("siteSearch.ac") != -1) {
		var xpath = '//div[@class="searchresults"]/dl/dt/a';
		var titles = new Object();
		var stuff = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var newest = stuff.iterateNext();
		while (newest) {
			titles[newest.href] = newest.textContent;
			newest = stuff.iterateNext();
		}
		
		var items = Zotero.selectItems(titles);
		
		for (var i in items) {
			URLS.push(i.split("u=")[1].replace(/%3A/g,":").replace(/%2F/g,"/").split("&")[0]);
		}
	} else {
		URLS.push(url);
	}
	
	Zotero.debug(URLS);
	
	Zotero.Utilities.HTTP.doPost(URLS, "", function(text) {
		for (var i = 0 ; i < URLS.length ; i++) {
			scrape(URLS[i]);
		}
	});
	Zotero.wait();
}