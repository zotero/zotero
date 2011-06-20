{
        "translatorID": "ce7a3727-d184-407f-ac12-52837f3361ff",
        "label": "NYTimes.com",
        "creator": "Simon Kornblith",
        "target": "^https?://(?:query\\.nytimes\\.com/search/(?:alternate/)?|(?:select\\.|www\\.)?nytimes\\.com/.)",
        "minVersion": "1.0.0b3.r1",
        "maxVersion": "",
        "priority": 100,
        "browserSupport":"gcs",
        "inRepository": true,
        "translatorType": 4,
        "lastUpdated": "2011-06-19 21:21:19"
}

function detectWeb(doc, url) {
	// Check for search results
	var searchResults = doc.evaluate('//div[@id="search_results"] | //div[@id="srchContent"]', doc, null,
				 XPathResult.ANY_TYPE, null).iterateNext();
	if(searchResults) return "multiple";
	
	// Check for article meta tags
	var metaTags = doc.getElementsByTagName("meta");
	var haveHdl = false;
	var haveByl = false;
	for(var i in metaTags) {
		if(metaTags[i].name === "hdl") {
			haveHdl = true;
		} else if(metaTags[i].name == "byl") {
			haveByl = true;
		}
		if(haveHdl && haveByl) return "newspaperArticle";
	}
	return false;
}

function associateMeta(newItem, metaTags, field, zoteroField) {
	if(metaTags[field]) {
		newItem[zoteroField] = metaTags[field];
	}
}

function scrape(doc, url) {
	var namespace = null;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("newspaperArticle");
	newItem.publicationTitle = "The New York Times";
	newItem.ISSN = "0362-4331";
	
	var metaTags = new Object();
	if(url != undefined) {
		newItem.url = url;
		var metaTagRe = /<meta[^>]*>/gi;
		var nameRe = /name="([^"]+)"/i;
		var contentRe = /content="([^"]+)"/i;
		var m = doc.match(metaTagRe);
		
		if(!m) {
			return;
		}
		
		for(var i=0; i<m.length; i++) {
			var name = nameRe.exec(m[i]);
			var content = contentRe.exec(m[i]);
			if(name && content) {
				metaTags[name[1]] = content[1];
			}
		}
		
		if(!metaTags["hdl"]) {
			return;
		}
		// We want to get everything on one page
		newItem.attachments.push({url:url.replace(/\.html\??([^/]*)(pagewanted=[^&]*)?([^/]*)$/,".html?pagewanted=all&$1$2"), title:"New York Times Snapshot",
	 	                          mimeType:"text/html"});
	} else {
		newItem.url = doc.location.href;
		var metaTagHTML = doc.getElementsByTagName("meta");
		for(var i=0; i<metaTagHTML.length; i++) {
			var key = metaTagHTML[i].getAttribute("name");
			var value = metaTagHTML[i].getAttribute("content");
			if(key && value) {
				metaTags[key] = value;
			}
		}
		// Get everything on one page is possible
		var singlePage = false;
		if (!newItem.url.match(/\?pagewanted=all/)
				&& (singlePage = doc.evaluate('//ul[@id="toolsList"]/li[@class="singlePage"]/a', doc, nsResolver,
		             XPathResult.ANY_TYPE, null).iterateNext())) {
			newItem.attachments.push({url:singlePage.href, title:"New York Times Snapshot",
	 		                          mimeType:"text/html"});
		} else {
			newItem.attachments.push({document:doc, title:"New York Times Snapshot"});
		}
	}
	
	associateMeta(newItem, metaTags, "dat", "date");
	associateMeta(newItem, metaTags, "hdl", "title");
	associateMeta(newItem, metaTags, "dsk", "section");
	associateMeta(newItem, metaTags, "articleid", "accessionNumber");
	
	if (metaTags["pdate"]) {
		newItem.date = metaTags["pdate"].replace(/(\d{4})(\d{2})(\d{2})/,"$1-$2-$3");
	}
	
	if(metaTags["byl"]) {
		var author = Zotero.Utilities.trimInternal(metaTags["byl"]);
		if(author.substr(0, 3).toLowerCase() == "by ") {
			author = author.substr(3);
		}
		
		var authors = author.split(" and ");
		for each(var author in authors) {
			// fix capitalization
			var words = author.split(" ");
			for(var i in words) {
				words[i] = words[i][0].toUpperCase()+words[i].substr(1).toLowerCase();
			}
			author = words.join(" ");
			
			if(words[0] == "The") {
				newItem.creators.push({lastName:author, creatorType:"author", fieldMode:true});
			} else {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
			}
		}
	}
	
	if(metaTags["keywords"]) {
		var keywords = metaTags["keywords"];
		newItem.tags = keywords.split(",");
		for(var i in newItem.tags) {
			newItem.tags[i] = newItem.tags[i].replace("  ", ", ");
		}
	}
	
	// Remove pagewanted from URL in item (keeping other pieces, in case they might matter)
	newItem.url = newItem.url.replace(/\?([^/]*)pagewanted=[^&]*/,'');
	
	newItem.complete();
}

function doWeb(doc, url) {
	var searchResults = doc.evaluate('//div[@id="search_results"] | //div[@id="srchContent"]', doc, null,
				 XPathResult.ANY_TYPE, null).iterateNext();
	if(searchResults) {
		var items = Zotero.Utilities.getItemArray(doc, searchResults, '^http://(?:select\.|www\.)nytimes.com/.*\.html(\\?|$)');
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var urls = [];
		for(var i in items) urls.push(i);
		
		Zotero.Utilities.HTTP.doGet(urls, function(text, response, url) { scrape(text, url) }, function() { Zotero.done(); }, null);
		Zotero.wait();
	} else {
		scrape(doc);
	}
}

/** BEGIN TEST CASES **/
var testCases = [
    {
        "type": "web",
        "url": "https://www.nytimes.com/2010/08/21/education/21harvard.html?scp=1&sq=marc%20hauser&st=cse&gwh=4B8CBC2383B24F22FED81E754DFA960B",
        "items": [
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "Nicholas",
                        "lastName": "Wade",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [
                    "Science and Technology",
                    "Research",
                    "Ethics",
                    "Hauser, Marc D",
                    "Harvard University"
                ],
                "seeAlso": [],
                "attachments": [
                    {
                        "document": "[object]",
                        "title": "New York Times Snapshot"
                    }
                ],
                "publicationTitle": "The New York Times",
                "ISSN": "0362-4331",
                "url": "https://www.nytimes.com/2010/08/21/education/21harvard.html?scp=1&sq=marc%20hauser&st=cse&gwh=4B8CBC2383B24F22FED81E754DFA960B",
                "date": "2010-08-20",
                "title": "Harvard Finds Marc Hauser Guilty of Scientific Misconduct",
                "section": "Education",
                "accessionNumber": "1248068890906",
                "libraryCatalog": "NYTimes.com",
                "accessDate": "CURRENT_TIMESTAMP"
            }
        ]
    },
    {
        "type": "web",
        "url": "http://query.nytimes.com/search/query?frow=0&n=10&srcht=a&query=marc+hauser&srchst=nyt&submit.x=18&submit.y=12&hdlquery=&bylquery=&daterange=period&mon1=01&day1=01&year1=2010&mon2=01&day2=18&year2=2011",
        "items": [
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "Nicholas",
                        "lastName": "Wade",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [
                    "Science and Technology",
                    "Research",
                    "Ethics",
                    "Hauser, Marc D",
                    "Harvard University"
                ],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.nytimes.com/2010/08/21/education/21harvard.html?pagewanted=all&scp=1&sq=marc+hauser&st=nyt",
                        "title": "New York Times Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "publicationTitle": "The New York Times",
                "ISSN": "0362-4331",
                "url": "http://www.nytimes.com/2010/08/21/education/21harvard.html?scp=1&sq=marc+hauser&st=nyt",
                "date": "2010-08-20",
                "title": "Harvard Finds Marc Hauser Guilty of Scientific Misconduct",
                "section": "Education",
                "accessionNumber": "1248068890906",
                "libraryCatalog": "NYTimes.com"
            },
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "Nicholas",
                        "lastName": "Wade",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [
                    "Laboratories and Scientific Equipment",
                    "Research",
                    "Ethics",
                    "Hauser, Marc D",
                    "Harvard University"
                ],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.nytimes.com/2010/08/14/education/14harvard.html?pagewanted=all&scp=3&sq=marc+hauser&st=nyt",
                        "title": "New York Times Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "publicationTitle": "The New York Times",
                "ISSN": "0362-4331",
                "url": "http://www.nytimes.com/2010/08/14/education/14harvard.html?scp=3&sq=marc+hauser&st=nyt",
                "date": "2010-08-13",
                "title": "In Inquiry at Marc Hauser’s Harvard Lab, a Raid and Then a 3-Year Wait",
                "section": "Education",
                "accessionNumber": "1247468623821",
                "libraryCatalog": "NYTimes.com"
            },
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "Nicholas",
                        "lastName": "Wade",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [
                    "Hauser, Marc D",
                    "Harvard University",
                    "Office of Research Integrity"
                ],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.nytimes.com/2010/08/13/education/13harvard.html?pagewanted=all&scp=4&sq=marc+hauser&st=nyt",
                        "title": "New York Times Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "publicationTitle": "The New York Times",
                "ISSN": "0362-4331",
                "url": "http://www.nytimes.com/2010/08/13/education/13harvard.html?scp=4&sq=marc+hauser&st=nyt",
                "date": "2010-08-12",
                "title": "Inquiry on Harvard Lab Threatens Ripple Effect",
                "section": "Education",
                "accessionNumber": "1247468617115",
                "libraryCatalog": "NYTimes.com"
            },
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "Nicholas",
                        "lastName": "Wade",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [
                    "Monkeys and Apes",
                    "Science and Technology",
                    "Ethics",
                    "Hauser, Marc D",
                    "University of Virginia"
                ],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.nytimes.com/2010/08/28/science/28harvard.html?pagewanted=all&scp=5&sq=marc+hauser&st=nyt",
                        "title": "New York Times Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "publicationTitle": "The New York Times",
                "ISSN": "0362-4331",
                "url": "http://www.nytimes.com/2010/08/28/science/28harvard.html?scp=5&sq=marc+hauser&st=nyt",
                "date": "2010-08-27",
                "title": "Marc Hauser May Have Fabricated Data at Harvard Lab",
                "section": "Science",
                "accessionNumber": "1248068931442",
                "libraryCatalog": "NYTimes.com"
            },
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "Nicholas",
                        "lastName": "Wade",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [
                    "Psychology and Psychologists",
                    "Monkeys and Apes",
                    "Science and Technology",
                    "Hauser, Marc D",
                    "Harvard University"
                ],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.nytimes.com/2010/10/26/science/26hauser.html?pagewanted=all&scp=7&sq=marc+hauser&st=nyt",
                        "title": "New York Times Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "publicationTitle": "The New York Times",
                "ISSN": "0362-4331",
                "url": "http://www.nytimes.com/2010/10/26/science/26hauser.html?scp=7&sq=marc+hauser&st=nyt",
                "date": "2010-10-25",
                "title": "Harvard Case Against Marc Hauser Is Hard to Define",
                "section": "Science",
                "accessionNumber": "1248069238889",
                "libraryCatalog": "NYTimes.com"
            },
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "Nicholas",
                        "lastName": "Wade",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [
                    "Research",
                    "Colleges and Universities",
                    "Ethics",
                    "Hauser, Marc",
                    "Harvard University"
                ],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.nytimes.com/2010/08/12/education/12harvard.html?pagewanted=all&scp=8&sq=marc+hauser&st=nyt",
                        "title": "New York Times Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "publicationTitle": "The New York Times",
                "ISSN": "0362-4331",
                "url": "http://www.nytimes.com/2010/08/12/education/12harvard.html?scp=8&sq=marc+hauser&st=nyt",
                "date": "2010-08-11",
                "title": "Marc Hauser, Harvard Academic, Faces Inquiry",
                "section": "Education",
                "accessionNumber": "1247468609178",
                "libraryCatalog": "NYTimes.com"
            },
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "David",
                        "lastName": "Brooks",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [
                    "Ethics",
                    "Bloom, Paul",
                    "Haidt, Jonathan",
                    "Phelps, Elizabeth",
                    "Greene, Joshua",
                    "Edge Foundation"
                ],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.nytimes.com/2010/07/23/opinion/23brooks.html?pagewanted=all&scp=9&sq=marc+hauser&st=nyt",
                        "title": "New York Times Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "publicationTitle": "The New York Times",
                "ISSN": "0362-4331",
                "url": "http://www.nytimes.com/2010/07/23/opinion/23brooks.html?scp=9&sq=marc+hauser&st=nyt",
                "date": "2010-07-22",
                "title": "The Moral Naturalists",
                "section": "Opinion",
                "accessionNumber": "1247468494988",
                "libraryCatalog": "NYTimes.com"
            },
            {
                "itemType": "newspaperArticle",
                "creators": [
                    {
                        "firstName": "Claudia",
                        "lastName": "Dreifus",
                        "creatorType": "author"
                    }
                ],
                "notes": [],
                "tags": [
                    "Dolphins and Porpoises",
                    "Brain",
                    "Psychology and Psychologists",
                    "Whales and Whaling",
                    "Science and Technology",
                    "Reiss, Diana"
                ],
                "seeAlso": [],
                "attachments": [
                    {
                        "url": "http://www.nytimes.com/2010/09/21/science/21conversation.html?pagewanted=all&scp=10&sq=marc+hauser&st=nyt",
                        "title": "New York Times Snapshot",
                        "mimeType": "text/html"
                    }
                ],
                "publicationTitle": "The New York Times",
                "ISSN": "0362-4331",
                "url": "http://www.nytimes.com/2010/09/21/science/21conversation.html?scp=10&sq=marc+hauser&st=nyt",
                "date": "2010-09-20",
                "title": "Studying the Big-Brained Dolphin",
                "section": "Science",
                "accessionNumber": "1248069061708",
                "libraryCatalog": "NYTimes.com"
            }
        ]
    }
]
/** END TEST CASES **/