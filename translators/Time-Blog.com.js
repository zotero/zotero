{
	"translatorID":"b33bbb49-03d2-4175-91c4-3840501bc953",
	"translatorType":4,
	"label":"Time-Blog.com",
	"creator":"Michael Berkowitz",
	"target":"^http://time-blog.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-07-31 16:45:00"
}

function detectWeb(doc, url) {
	if (url.substr(-4,4) == "html") {
		return "blogPost";
	} else {
		return "multiple";
	}
}

function scrape(doc, url) {
	var newItem = new Zotero.Item("blogPost");
	
	newItem.url = doc.location.href;
	newItem.title = doc.title.substr(0, doc.title.indexOf(" - "));
	
	var titleRE = new RegExp('^http://time-blog.com/([^/]*)/');
	var title = titleRE.exec(doc.location.href)[1].split("_");
	for (var i = 0 ; i < title.length ; i++) {
		title[i] = title[i][0].toUpperCase() + title[i].substr(1).toLowerCase();
	}
	newItem.blogTitle = title.join(" ");
	var metaTags = new Object();
	
	var metaTagHTML = doc.getElementsByTagName("meta");
	for (var i = 0 ; i < metaTagHTML.length ; i++) {
		metaTags[metaTagHTML[i].getAttribute("name")] = metaTagHTML[i].getAttribute("content");
	}
	
	if (metaTags["description"]) {
		newItem.abstractNote = Zotero.Utilities.cleanString(Zotero.Utilities.cleanTags(metaTags["description"]));
	}
	
	if (metaTags["date"]) {
		 var date = metaTags["date"];
		 var months = new Object();
		 	months["jan"] = "January";
		 	months["feb"] = "February";
		 	months["mar"] = "March";
		 	months["apr"] = "April";
		 	months["may"] = "May";
		 	months["jun"] = "June";
		 	months["jul"] = "July";
		 	months["aug"] = "August";
		 	months["sep"] = "September";
		 	months["oct"] = "October";
		 	months["nov"] = "November";
		 	months["dec"] = "December";
		 date = date.split(".").join("").split(", ");
		 date[0] = months[date[0].split(" ")[0].toLowerCase()] + " " + date[0].split(" ")[1];
		 newItem.date = date.join(", ");
	 }
	 
	 if (metaTags["keywords"]) {
		newItem.tags = metaTags["keywords"].split(", ");
		for (var i in newItem.tags) {
			if (newItem.tags[i] == "" || newItem.tags[i] == " ") {
				break;
			} else {
				var words = newItem.tags[i].split(" ");
				for (var j = 0 ; j < words.length ; j++) {
					if (words[j][0] == words[j][0].toLowerCase() && words[j][0]) {
						words[j] = words[j][0].toUpperCase() + words[j].substr(1).toLowerCase();
					}
				}
			} 
			newItem.tags[i] = words.join(" ");
		}
	}
	
	if (doc.evaluate('//span[@class="postedby"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var byline = Zotero.Utilities.cleanString(doc.evaluate('//span[@class="postedby"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		if (byline.substr(0,9).toLowerCase() == "posted by") {
			byline = byline.substr(10).split(" ");
		} else {
			byline.split(" ");
		}
		for (var i = 0; i < byline.length ; i++) {
			byline[i] = byline[i][0].toUpperCase() + byline[i].substr(1).toLowerCase();
		}
		newItem.creators.push(Zotero.Utilities.cleanAuthor(byline.join(" "), "author"));
	} else if (newItem.blogTitle == "Theag") {
		newItem.creators.push(Zotero.Utilities.cleanAuthor("Matthew Yeomans", "author"));
		newItem.blogTitle = "the Aggregator";
	}
	
	Zotero.debug(newItem);
	
	newItem.complete();
	
}

function doWeb(doc, url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x") return namespace; else return null;
	} : null;
	
	var URIS = new Array();
	
	var xpath = '//h1[@class="entryTitle"]/a';
	var articles = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var art = articles.iterateNext();
	var arts = new Array();
	var urls = new Array();
	while (art) {
		 arts.push(art.textContent);
		 urls.push(art.href);
		 art = articles.iterateNext();
	}
	if (arts.length > 1) {
		var items = new Object;
		for (var i  = 0; i < arts.length ; i++ ) {
			items[urls[i]] = arts[i];
		}
		items = Zotero.selectItems(items);
	
		for (i in items) {
			URIS.push(i);
		}
	} else {
		URIS.push(url);
	}
	Zotero.Utilities.processDocuments(URIS, scrape, function() { Zotero.done(); } );
	
	Zotero.wait();
}