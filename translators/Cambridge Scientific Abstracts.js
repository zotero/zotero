{
	"translatorID":"82174f4f-8c13-403b-99b2-affc7bc7769b",
	"translatorType":4,
	"label":"Cambridge Scientific Abstracts",
	"creator":"Simon Kornblith and Michael Berkowitz",
	"target":"https?://[^/]+/ids70/(?:results.php|view_record.php)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2011-06-14 04:31:00"
}

/* Provides support for databases of Cambridge Scientific Abstracts
    Tested with CSA Illumina, http://www.csa.com/
   CSA does not provide stable URLs
 */

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if(url.indexOf("/results.php") != -1) {
		var type = doc.evaluate('//td[@class="rt_tab_on"]', doc, nsResolver, XPathResult.ANY_TYPE,
			null).iterateNext().textContent;
		
		if(type.substr(0, 15) == "Published Works") {
			return "multiple";
		}
	} else {
		// default to journal
		var itemType = "journalArticle";
		
		var type = doc.evaluate('//tr[td[1][@class="data_heading"]/text() = "Publication Type"]/td[3]',
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if(type) {
			type = Zotero.Utilities.trimInternal(type.textContent);
			if(type == "Book Chapter") {
				return "bookSection";
			} else if(type.substr(0, 4) == "Book") {
				return "book";
			} else if(type.substr(0, 12) == "Dissertation") {
				return "thesis";
			} else if(type == "Catalog") {
				return "magazineArticle";
			}
		}
		return "journalArticle";
	}
	
	return false;
}

function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var itemType = "journalArticle";
	
	var type = doc.evaluate('//tr[td[1][@class="data_heading"]/text() = "Publication Type"]/td[3]',
		doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(type) {
		type = Zotero.Utilities.trimInternal(type.textContent);
		if(type == "Book Chapter") {
			itemType = "bookSection";
		} else if(type.substr(0, 4) == "Book") {
			itemType = "book";
		} else if(type.substr(0, 12) == "Dissertation") {
			itemType = "thesis";
		} else if(type == "Catalog") {
			itemType = "magazineArticle";
		}
	}
	
	var newItem = new Zotero.Item(itemType);
	
	newItem.attachments = [{document:doc, title:"Cambridge Scientific Abstracts Snapshot"}];
	newItem.title = Zotero.Utilities.trimInternal(doc.evaluate('//tr/td[3][@class="data_emphasis"]', doc, nsResolver,
		XPathResult.ANY_TYPE, null).iterateNext().textContent);
	
	var dataRows = doc.evaluate('//tr[td[3][@class="data_content"]]', doc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var dataRow;
	while(dataRow = dataRows.iterateNext()) {
		var tds = dataRow.getElementsByTagName("td");
		var heading = Zotero.Utilities.trimInternal(tds[0].textContent).toLowerCase();
		var content = Zotero.Utilities.trimInternal(tds[2].textContent);
		if(heading == "database") {
			newItem.repository = "Cambridge Scientific Abstracts ("+content+")";
		} else if(heading == "author") {
			var authors = content.split("; ");
			for each(var author in authors) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(author.replace(/\d+/g, ""), "author", true));
			}
		} else if(heading == "source") {
			if(itemType == "journalArticle") {
				var parts = content.split(/(,|;)/);
				newItem.publicationTitle = parts.shift();
				for each (var i in parts) {
					if (i.match(/\d+/)) {
						if (i.match(/v(ol)?/)) {
							newItem.volume = i.match(/\d+/)[0];
						} else if (i.match(/pp/)) {
							newItem.pages = i.match(/[\d\-]+/)[0];
						} else if (i.match(/no?/)) {
							newItem.issue = i.match(/\d+/)[0];
						} else if (i.match(/\d{4}/)) {
							newItem.date = Zotero.Utilities.trimInternal(i);
						}
					}
				}
			} else if(itemType == "book") {
				var m = content.match(/^([^:]+): ([^,0-9]+)/);
				if(m) {
					newItem.place = m[1];
					newItem.publisher = m[2];
				}
			} else if(itemType == "bookSection") {
                var untitled = !newItem.publicationTitle;
				if(untitled || (content.length > newItem.publicationTitle.length
				   && content.substr(0, newItem.publicationTitle.length) == newItem.publicationTitle)
				   || content.indexOf(newItem.publicationTitle)) {
					if (content.indexOf(newItem.publicationTitle) > 4) {
						// This means we probably have a book author or editor first
						var m = content.match(/^([^\.]+)\./);
						if (m) newItem.creators.push(
							Zotero.Utilities.cleanAuthor(m[1], "bookAuthor", true));
					}
					var m = content.match(/\)\. ([^:()]+): ([^,0-9]+)/);
					if(m) {
                        if (untitled) {
                            var n = content.match(/\([0-9]{4}\)([^(]*)/);
                            if (n) newItem.publicationTitle = n[1];
                        }
						newItem.place = m[1];
						newItem.publisher = m[2];
					}
					m = content.match(/\(pp. ([\-0-9]+)\)/);
					if(m) newItem.pages = m[1];
				}
			}
		} else if(heading == "monograph title") {
			newItem.publicationTitle = content;
		} else if(heading == "series title") {
			newItem.series = content;
		} else if(heading == "issn") {
			newItem.ISSN = content;
		} else if(heading == "isbn") {
			newItem.ISBN = content;
		} else if(heading == "abstract") {
			newItem.abstractNote = content;
		} else if(heading == "notes") {
			newItem.extra = content;
		} else if(heading == "publication year") {
			if(!newItem.date) newItem.date = content;
		} else if(heading == "information provider") {
			if(content.substr(0, 19) == "http://dx.doi.org/") {
				newItem.DOI = content.substr(19);
			}
		} else if(heading == "journal volume") {
			newItem.volume = content;
		} else if(heading == "journal pages") {
			newItem.pages = content;
		} else if(heading == "journal issue") {
			newItem.issue = content;
		} else if(heading == "affiliation") {
			if(newItem.itemType == "thesis") {
				newItem.publisher = content;
			}
		} else if(heading == "pages") {	// This is for book sections
			newItem.pages = content;
		} else if(heading == "language") {
			newItem.language = content;
		}
	}
	
	var terms = doc.evaluate('//input[substring(@name, 1, 4) = "term"]', doc, nsResolver,
		XPathResult.ANY_TYPE, null);
	var term;
	while(term = terms.iterateNext()) {
		newItem.tags.push(term.value.replace(/ [0-9]{3,}$/, ""));
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	if(url.indexOf("/results.php") != -1) {
		var items = Zotero.Utilities.getItemArray(doc, doc, '/view_record\.php\?', '^(?:View Record|More\.{3})$');
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var urls = new Array();
		for(var url in items) {
			urls.push(url);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done() })
		Zotero.wait();
	} else {
		scrape(doc);
	}
}
