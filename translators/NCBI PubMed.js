{
	"translatorID":"fcf41bed-0cbc-3704-85c7-8062a0068a7a",
	"translatorType":13,
	"label":"NCBI PubMed",
	"creator":"Simon Kornblith, Michael Berkowitz, Avram Lyon, and Rintze Zelle",
	"target":"https?://[^/]*(www|preview)\\.ncbi\\.nlm\\.nih\\.gov[^/]*/(pubmed|sites/pubmed|sites/entrez|entrez/query\\.fcgi\\?.*db=PubMed)",
	"minVersion":"2.1.9",
	"maxVersion":"",
	"priority":100,
	"browserSupport":"gcs",
	"configOptions":{"dataMode":"block"},
	"inRepository":true,
	"lastUpdated":"2011-07-01 04:22:03"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var items = doc.evaluate('//input[@name="EntrezSystem2.PEntrez.Pubmed.Pubmed_ResultsPanel.Pubmed_ResultsController.ResultCount"]', doc,
			nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (items) {
		Zotero.debug("Have ResultCount " + items.value);
		if (items.value > 1) {
			return "multiple";
		} else if (items.value == 1) {
			return "journalArticle";
		}
	}

	var uids = doc.evaluate('//input[@type="checkbox" and @name="EntrezSystem2.PEntrez.Pubmed.Pubmed_ResultsPanel.Pubmed_RVDocSum.uid"]', doc,
			nsResolver, XPathResult.ANY_TYPE, null);
	if(uids.iterateNext()) {
		if (uids.iterateNext()){
			return "multiple";
		}
		return "journalArticle";
	}
}

function getPMID(co) {
	var coParts = co.split("&");
	for each(part in coParts) {
		if(part.substr(0, 7) == "rft_id=") {
			var value = unescape(part.substr(7));
			if(value.substr(0, 10) == "info:pmid/") {
				return value.substr(10);
			}
		}
	}
}

function detectSearch(item) {
	if(item.contextObject) {
		if(getPMID(item.contextObject)) {
			return "journalArticle";
		}
	}
	return false;
}


function lookupPMIDs(ids, doc) {
	var newUri = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=PubMed&tool=Zotero&retmode=xml&rettype=citation&id="+ids.join(",");
	Zotero.debug(newUri);
	Zotero.Utilities.HTTP.doGet(newUri, doImportFromText, function () {Zotero.done()});
	Zotero.wait();
}

function doImport() {
	var text = "";
	var line;
	while((line = Zotero.read(4096)) !== false) {
		text += line;
	}
	return doImportFromText(text);
}

function detectImport() {
	Zotero.debug("Detecting Pubmed content....");
	var text = "";
	var line;
	while(line = Zotero.read(1000)) {
		text += line;
		// Look for the PubmedArticle tag in the first 1000 characters
		if (text.match(/<PubmedArticle>/)) return "journalArticle";
		else if (text.length > 1000) return false;
	}	
	return false;
}

function doImportFromText(text) {
	if (!text.substr(0,1000).match(/<PubmedArticleSet>/)) {
		// Pubmed data in the wild, perhaps copied from the web site's search results,
		// can be missing the <PubmedArticleSet> root tag. Let's add a pair!
		Zotero.debug("No root <PubmedArticleSet> tag found, wrapping in a new root tag.");
		text = "<PubmedArticleSet>" + text + "</PubmedArticleSet>";
	}

	// parse XML with DOMParser
	var parser = new DOMParser();
	var doc = parser.parseFromString(text, "text/xml");
	
	var articles = ZU.xpath(doc, '/PubmedArticleSet/PubmedArticle');
	for(var i in articles) {
		var newItem = new Zotero.Item("journalArticle");

		var citation = ZU.xpath(articles[i], 'MedlineCitation');
		var PMID = ZU.xpathText(citation, 'PMID');
		newItem.url = "http://www.ncbi.nlm.nih.gov/pubmed/" + PMID;
		newItem.extra = "PMID: "+PMID;

		var article = ZU.xpath(citation, 'Article');
		var title = ZU.xpathText(article, 'ArticleTitle');
		if(title) {
			if(title.substr(-1) == ".") {
				title = title.substring(0, title.length-1);
			}
			newItem.title = title;
		}
		
		var fullPageRange = ZU.xpathText(article, 'Pagination/MedlinePgn');
		if(fullPageRange) {
			var pageRange = fullPageRange.match(/\d+-\d+/g);
			for (var j in pageRange) {
				var pageRangeStart = pageRange[j].match(/^\d+/)[0];
				var pageRangeEnd = pageRange[j].match(/\d+$/)[0];
				if (pageRangeStart.length > pageRangeEnd.length) {
					pageRangeEnd = pageRangeStart.substring(0,pageRangeStart.length-pageRangeEnd.length) + pageRangeEnd;
					fullPageRange = fullPageRange.replace(pageRange[j],pageRangeStart+"-"+pageRangeEnd);
				}
			}
			newItem.pages = fullPageRange;
		}
		
		var journal = ZU.xpath(article, 'Journal');
		if(journal.length) {
			newItem.ISSN = ZU.xpathText(journal, 'ISSN');
			
			var abbreviation;
			if((abbreviation = ZU.xpathText(journal, 'ISOAbbreviation'))) {
				newItem.journalAbbreviation = abbreviation;	
			} else if((abbreviation = ZU.xpathText(journal, 'MedlineTA'))) {
				newItem.journalAbbreviation = abbreviation;
			}
			
			var title = ZU.xpathText(journal, 'Title');
			if(title) {
				newItem.publicationTitle = title;
			} else if(newItem.journalAbbreviation) {
				newItem.publicationTitle = newItem.journalAbbreviation;
			}
			
			var journalIssue = ZU.xpath(journal, 'JournalIssue');
			if(journalIssue.length) {
				newItem.volume = ZU.xpathText(journalIssue, 'Volume');
				newItem.issue = ZU.xpathText(journalIssue, 'Issue');
				var pubDate = ZU.xpath(journalIssue, 'PubDate');
				if(pubDate.length) {	// try to get the date
					var day = ZU.xpathText(pubDate, 'Day');
					var month = ZU.xpathText(pubDate, 'Month');
					var year = ZU.xpathText(pubDate, 'Year');
					
					if(day) {
						newItem.date = month+" "+day+", "+year;
					} else if(month) {
						newItem.date = month+" "+year;
					} else if(year) {
						newItem.date = year;
					} else {
						newItem.date = ZU.xpathText(pubDate, 'MedlineDate');
					}
				}
			}
		}

		var authors = ZU.xpath(article, 'AuthorList/Author');
		for(var j in authors) {
			var author = authors[j];
			
			var lastName = ZU.xpathText(author, 'LastName');
			var firstName = ZU.xpathText(author, 'FirstName');
			if(!firstName) {
				firstName = ZU.xpathText(author, 'ForeName');
			}
			var suffix = ZU.xpathText(author, 'Suffix');
			if(suffix && firstName) {
				firstName += ", " + suffix
			}
			if(firstName || lastName) {
				newItem.creators.push({lastName:lastName, firstName:firstName});
			}
		}
		
		
		var keywords = ZU.xpath(citation, 'MeshHeadingList/MeshHeading');
		for(var k in keywords) {
			newItem.tags.push(ZU.xpathText(keywords[k], 'DescriptorName'));
		}
		
		var abstractSections = ZU.xpath(article, 'Abstract/AbstractText');
		var abstractNote = [];
		for(var j in abstractSections) {
			var abstractSection = abstractSections[j];
			if(abstractSection.hasAttribute("Label")) {
				abstractNote.push(abstractSection.getAttribute("Label"));
			}
			abstractNote.push(abstractSection.textContent+"\n");
		}
		
		newItem.abstractNote = abstractNote.join("\n\n");
		newItem.DOI = ZU.xpathText(articles[i], 'PubmedData/ArticleIdList/ArticleId[@IdType="doi"]');
		// (do we want this?)
		if(newItem.publicationTitle) {
			newItem.publicationTitle = Zotero.Utilities.capitalizeTitle(newItem.publicationTitle);
		}
		newItem.complete();
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;
	var ids = new Array();
	var uids = doc.evaluate('//input[@name="EntrezSystem2.PEntrez.Pubmed.Pubmed_ResultsPanel.Pubmed_RVDocSum.uid"]', doc, //edited for new PubMed
			       nsResolver, XPathResult.ANY_TYPE, null);
	var uid = uids.iterateNext();
	if(uid) {
		if (uids.iterateNext()){
			var items = {};
			var tablex = '//div[@class="rprt"]';
			if (!doc.evaluate(tablex, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				var tablex = '//div[@class="ResultSet"]/dl';
				var other = true;
			}
			var tableRows = doc.evaluate(tablex, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var tableRow;
			// Go through table rows
			while(tableRow = tableRows.iterateNext()) {
				uid = doc.evaluate('.//input[@type="checkbox"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if (other) {
					var article = doc.evaluate('.//h2', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				} else {
					var article = doc.evaluate('.//p[@class="title"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				}
				items[uid.value] = article.textContent;
			}

			Zotero.selectItems(items, function(items) {
				if(!items) {
					return true;
				}
	
				for(var i in items) {
					ids.push(i);
				}
	
				lookupPMIDs(ids);
			});
		} else {
			ids.push(uid.value);
			lookupPMIDs(ids, doc);
		}
	} else {
		// Here, account for some articles and search results using spans for PMID
		var uids= doc.evaluate('//p[@class="pmid"]', doc,
				nsResolver, XPathResult.ANY_TYPE, null);
		var uid = uids.iterateNext();
		if (!uid) {
			// Fall back on span 
			uids = doc.evaluate('//span[@class="pmid"]', doc,
					nsResolver, XPathResult.ANY_TYPE, null);
			uid = uids.iterateNext();
		}
		if (!uid) {
			// Fall back on <dl class="rprtid"> 
			// See http://www.ncbi.nlm.nih.gov/pubmed?term=1173[page]+AND+1995[pdat]+AND+Morton[author]&cmd=detailssearch
			// Discussed http://forums.zotero.org/discussion/17662
			uids = doc.evaluate('//dl[@class="rprtid"]/dd[1]', doc,
					nsResolver, XPathResult.ANY_TYPE, null);
			uid = uids.iterateNext();
		}
		if (uid) {
			ids.push(uid.textContent.match(/\d+/)[0]);
			Zotero.debug("Found PMID: " + ids[ids.length - 1]);
			lookupPMIDs(ids, doc);
		} else {
			var uids= doc.evaluate('//meta[@name="ncbi_uidlist"]', doc,
					nsResolver, XPathResult.ANY_TYPE, null);
			var uid = uids.iterateNext()["content"].split(' ');
			if (uid) {
				ids.push(uid);
				Zotero.debug("Found PMID: " + ids[ids.length - 1]);
				lookupPMIDs(ids, doc);
			}
		}
	}
}

function doSearch(item) {
	// pmid was defined earlier in detectSearch
	lookupPMIDs([getPMID(item.contextObject)]);
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.ncbi.nlm.nih.gov/pubmed/20729678",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Coar",
						"firstName": "Jaekea T"
					},
					{
						"lastName": "Sewell",
						"firstName": "Jeanne P"
					}
				],
				"notes": [],
				"tags": [
					"Bibliography as Topic",
					"Database Management Systems",
					"Humans"
				],
				"seeAlso": [],
				"attachments": [],
				"url": "http://www.ncbi.nlm.nih.gov/pubmed/20729678",
				"extra": "PMID: 20729678",
				"title": "Zotero: harnessing the power of a personal bibliographic manager",
				"pages": "205-207",
				"ISSN": "1538-9855",
				"journalAbbreviation": "Nurse Educ",
				"publicationTitle": "Nurse Educator",
				"volume": "35",
				"issue": "5",
				"date": "2010 Sep-Oct",
				"abstractNote": "Zotero is a powerful free personal bibliographic manager (PBM) for writers. Use of a PBM allows the writer to focus on content, rather than the tedious details of formatting citations and references. Zotero 2.0 (http://www.zotero.org) has new features including the ability to synchronize citations with the off-site Zotero server and the ability to collaborate and share with others. An overview on how to use the software and discussion about the strengths and limitations are included.\u000a",
				"DOI": "10.1097/NNE.0b013e3181ed81e4",
				"libraryCatalog": "NCBI PubMed",
				"shortTitle": "Zotero"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.ncbi.nlm.nih.gov/pubmed?term=zotero",
		"items": "multiple"
	}
]
/** END TEST CASES **/