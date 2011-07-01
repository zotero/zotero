{
        "translatorID": "1e6d1529-246f-4429-84e2-1f1b180b250d",
        "label": "The Chronicle of Higher Education",
        "creator": "Simon Kornblith, Avram Lyon",
        "target": "^http://chronicle\\.com/",
        "minVersion": "2.1",
        "maxVersion": "",
        "priority": 100,
        "inRepository": true,
        "translatorType": 4,
        "lastUpdated": "2011-07-01 22:53:28"
}

/*
 This translator works on articles posted in The Chronicle of Higher Education.

 It is based on the earlier translator by Simon Kornblith, but the Chronicle has
 significantly restructured the site since 2006, breaking the old translator.
*/

function detectWeb(doc, url) {
	/* The /daily/ and /weekly/ sections are leftover from the previous version
	   of the translator; they don't appear to still be on the Chronicle site, but
	   they might persist in older URLs. */
	var articleRegexp = /^http:\/\/chronicle\.com\/(daily|weekly|article|blogPost|blogs\/\w+)\/[^/]+\// ;
	if(articleRegexp.test(url)) {
		var section = url.match(articleRegexp);
		switch (section[1]) {
			case "weekly":
			case "daily":
			case "article":
				return "newspaperArticle";
			case "blogPost":    
				return "blogPost";
			default:
				if (section[1].indexOf("blogs") !== -1)
					return "blogPost";
				return false;
		}
	} else {
		// This approach, used again below, is pretty crude.
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}

function doWeb (doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = {};
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			var articleRegexp = /^http:\/\/chronicle\.com\/(daily|weekly|article|blogPost|blogs\/\w+)\/[^/]+\//;
			if(articleRegexp.test(aTags[i].href)) {
				items[aTags[i].href] = aTags[i].textContent;
			}
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	
	Zotero.Utilities.processDocuments(articles, function(doc) {
		var type = detectWeb(doc, doc.location.href);
		item = new Zotero.Item(type);

		item.url = doc.location.href;
		item.publicationTitle = "The Chronicle of Higher Education";
		// Does the ISSN apply to online-only blog posts?
		item.ISSN = "0009-5982";
		
		var byline = doc.evaluate('//p[@class="byline"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
		if (byline !== null) {
			var authors = parseAuthors(byline.textContent);
			for (var i = 0; i < authors.length; i++) {
				item.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
			}
		}
		
		// Behavior for some items is different:
		if(type === "blogPost") {
			var dateline = doc.evaluate('//p[@class="time"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
			if (dateline !== null) {
				item.date = Zotero.Utilities.trimInternal(dateline.textContent);
			}
			item.title = doc.evaluate('//div[@class="blog-mod"]//h1[@class="entry-title" or @class="title"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
            
			// We keep the Chronicle as the Website Type, for lack of a better place
			item.websiteType = item.publicationTitle;
			item.publicationTitle = doc.evaluate('//div[@class="header-breadcrumb-wrap"]/ul/li[last()]/a', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		} else {
			var dateline = doc.evaluate('//p[@class="dateline"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext();
			if (dateline !== null) {
				item.date = dateline.textContent;
			}
			item.title = Zotero.Utilities.trimInternal(doc.evaluate('//div[@class="article"]/h1', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			item.section = Zotero.Utilities.trimInternal(doc.evaluate('//div[@class="header-breadcrumb-wrap"]/h1', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			
			// Some items have publication details at the end of the article; one
			// example is: http://chronicle.com/article/Grinnells-Green-Secrets/2653/
			var articleParagraphs = doc.evaluate('//div[@class="article-body"]/p', doc, ns, XPathResult.ANY_TYPE, null);
			var par;
			while ((par = articleParagraphs.iterateNext()) !== null) {
				var data = par.textContent.match(/Section: ([a-zA-Z -&]+)[\n\t ]+Volume ([0-9]+), Issue ([0-9]+), Page ([0-9A-Za-z]+)/);
				if (data !== null && data.length > 0) {
					item.pages = data[4];
					// If the section here and in the page proper are different, concatenate
					if (item.section !== data[1])
						item.section = item.section + " : " + Zotero.Utilities.trimInternal(data[1]);
					// Since newspaperArticle doesn't have Volume / Issue, put as Edition
					item.edition = "Volume " + data[2] + ", Issue " + data[3];
				}
			}
		}
		
		item.attachments.push({url:doc.location.href, title: ("Chronicle of Higher Education Snapshot"), mimeType:"text/html"});
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}

function parseAuthors(author) {
		// Sometimes we have "By Author and Author"
		if(author.substr(0, 3).toLowerCase() == "by ") {
			author = author.substr(3);
		}
		
		// Sometimes the author is in all caps
		var pieces = author.split(" ");
		for (var i = 0; i < pieces.length; i++) {
			// TODO Make the all-caps character class more inclusive
			if (pieces[i].match(/[A-Z-]+/) !== null)
				pieces[i] = Zotero.Utilities.capitalizeTitle(pieces[i].toLowerCase(), true);
		}
		author = pieces.join(" ");
		
		// Somtimes we have multiple authors
		var authors = author.split(" and ");
		return authors;
}


/** BEGIN TEST CASES **/
var testCases = [
    {
        "type": "web",
        "url": "http://chronicle.com/blogs/profhacker/the-second-day-of-thatcamp/23068",
        "items": [
            {
                "itemType": "blogPost",
                "creators": [
                    {
                        "firstName": "Amy",
                        "lastName": "Cavender",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": false,
                        "title": "Chronicle of Higher Education Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "url": "http://chronicle.com/blogs/profhacker/the-second-day-of-thatcamp/23068",
                "publicationTitle": "ProfHacker",
                "ISSN": "0009-5982",
                "date": "March 26, 2010, 2:07 pm",
                "title": "The Second Day of THATCamp",
                "websiteType": "The Chronicle of Higher Education",
                "libraryCatalog": "The Chronicle of Higher Education"
            }
        ]
    },
    {
        "type": "web",
        "url": "http://chronicle.com/article/A-Little-Advice-From-32000/46210/",
        "items": [
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "Adam",
                        "lastName": "Fagen",
                        "creatorType": "author"
                    },
                    {
                        "firstName": "Kimberly Suedkamp",
                        "lastName": "Wells",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": false,
                        "title": "Chronicle of Higher Education Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "url": "http://chronicle.com/article/A-Little-Advice-From-32000/46210/",
                "publicationTitle": "The Chronicle of Higher Education",
                "ISSN": "0009-5982",
                "date": "January 14, 2002",
                "title": "A Little Advice From 32,000 Graduate Students",
                "section": "Advice",
                "libraryCatalog": "The Chronicle of Higher Education"
            }
        ]
    },
    {
        "type": "web",
        "url": "http://chronicle.com/article/Grinnells-Green-Secrets/2653/",
        "items": [
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "Xiao-Bo",
                        "lastName": "Yuan",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": false,
                        "title": "Chronicle of Higher Education Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "url": "http://chronicle.com/article/Grinnells-Green-Secrets/2653/",
                "publicationTitle": "The Chronicle of Higher Education",
                "ISSN": "0009-5982",
                "date": "June 16, 2006",
                "title": "Grinnell's Green Secrets",
                "section": "News",
                "libraryCatalog": "The Chronicle of Higher Education"
            }
        ]
    },
    {
        "type": "web",
        "url": "http://chronicle.com/blogPost/humanities-cyberinfrastructure-project-bamboo/6138",
        "items": [
            {
                "itemType": "blogPost",
                "creators": [
                    {
                        "firstName": "Stan",
                        "lastName": "Katz",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": false,
                        "title": "Chronicle of Higher Education Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "url": "http://chronicle.com/blogPost/humanities-cyberinfrastructure-project-bamboo/6138",
                "publicationTitle": "Brainstorm",
                "ISSN": "0009-5982",
                "date": "July 17, 2008, 01:29 PM ET",
                "title": "Humanities Cyberinfrastructure: Project Bamboo",
                "websiteType": "The Chronicle of Higher Education",
                "libraryCatalog": "The Chronicle of Higher Education",
                "shortTitle": "Humanities Cyberinfrastructure"
            }
        ]
    }
]
/** END TEST CASES **/
