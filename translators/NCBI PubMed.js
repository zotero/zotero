{
	"translatorID":"fcf41bed-0cbc-3704-85c7-8062a0068a7a",
	"translatorType":4,
	"label":"NCBI PubMed",
	"creator":"Simon Kornblith and Michael Berkowitz",
	"target":"http://[^/]*www\\.ncbi\\.nlm\\.nih\\.gov[^/]*/(pubmed|sites/entrez|entrez/query\\.fcgi\\?.*db=PubMed)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-12-15 00:25:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var uids = doc.evaluate('//input[@id="UidCheckBox" or @name="uid"]', doc,
			       nsResolver, XPathResult.ANY_TYPE, null);
	if(uids.iterateNext() && doc.title.indexOf("PMC Results") == -1) {
		if (uids.iterateNext() && doc.title.indexOf("PMC Results") == -1){
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
	Zotero.wait();
	var newUri = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=PubMed&retmode=xml&rettype=citation&id="+ids.join(",");
	Zotero.Utilities.HTTP.doGet(newUri, function(text) {
		// Remove xml parse instruction and doctype
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");

		var xml = new XML(text);

		for(var i=0; i<xml.PubmedArticle.length(); i++) {
			var newItem = new Zotero.Item("journalArticle");

			var citation = xml.PubmedArticle[i].MedlineCitation;

			var PMID = citation.PMID.text().toString();
			newItem.url = "http://www.ncbi.nlm.nih.gov/pubmed/" + PMID;
			newItem.extra = "PMID: "+PMID;
			// add attachments
			if(doc) {
				newItem.attachments.push({document:doc, title:"PubMed Snapshot"});
			} else {
				var url = "http://www.ncbi.nlm.nih.gov/entrez/query.fcgi?db=pubmed&cmd=Retrieve&dopt=AbstractPlus&list_uids="+PMID;
				newItem.attachments.push({url:url, title:"PubMed Snapshot",
							 mimeType:"text/html"});
			}

			var article = citation.Article;
			if(article.ArticleTitle.length()) {
				var title = article.ArticleTitle.text().toString();
				if(title.substr(-1) == ".") {
					title = title.substring(0, title.length-1);
				}
				newItem.title = title;
			}

			if (article.Pagination.MedlinePgn.length()){
				var fullPageRange = article.Pagination.MedlinePgn.text().toString();
				var pageRange = fullPageRange.match(/\d+-\d+/g);
				for (i in pageRange) {
					var pageRangeStart = pageRange[i].match(/^\d+/).join("");
					var pageRangeEnd = pageRange[i].match(/\d+$/).join("");
					if (pageRangeStart.length > pageRangeEnd.length) {
						pageRangeEnd = pageRangeStart.substring(0,pageRangeStart.length-pageRangeEnd.length) + pageRangeEnd;
						fullPageRange = fullPageRange.replace(pageRange[i],pageRangeStart+"-"+pageRangeEnd);
					}	
				}
				newItem.pages = fullPageRange;
			}

			if(article.Journal.length()) {
				var issn = article.Journal.ISSN.text().toString();
				if(issn) {
					newItem.ISSN = issn;
				}
				
				if(citation.Article.Journal.ISOAbbreviation.length()) {
					newItem.journalAbbreviation = Zotero.Utilities.superCleanString(citation.Article.Journal.ISOAbbreviation.text().toString());				
				} else if(citation.MedlineJournalInfo.MedlineTA.length()) {
					newItem.journalAbbreviation = Zotero.Utilities.superCleanString(citation.MedlineJournalInfo.MedlineTA.text().toString());
				}

				if(article.Journal.Title.length()) {
					newItem.publicationTitle = Zotero.Utilities.superCleanString(article.Journal.Title.text().toString());
				} else if(newItem.journalAbbreviation.length()) {
					newItem.publicationTitle = newItem.journalAbbreviation;
				}

				if(article.Journal.JournalIssue.length()) {
					newItem.volume = article.Journal.JournalIssue.Volume.text().toString();
					newItem.issue = article.Journal.JournalIssue.Issue.text().toString();
					if(article.Journal.JournalIssue.PubDate.length()) {	// try to get the date
						if(article.Journal.JournalIssue.PubDate.Day.text().toString() != "") {
							newItem.date = article.Journal.JournalIssue.PubDate.Month.text().toString()+" "+article.Journal.JournalIssue.PubDate.Day.text().toString()+", "+article.Journal.JournalIssue.PubDate.Year.text().toString();
						} else if(article.Journal.JournalIssue.PubDate.Month.text().toString() != "") {
							newItem.date = article.Journal.JournalIssue.PubDate.Month.text().toString()+" "+article.Journal.JournalIssue.PubDate.Year.text().toString();
						} else if(article.Journal.JournalIssue.PubDate.Year.text().toString() != "") {
							newItem.date = article.Journal.JournalIssue.PubDate.Year.text().toString();
						} else if(article.Journal.JournalIssue.PubDate.MedlineDate.text().toString() != "") {
							newItem.date = article.Journal.JournalIssue.PubDate.MedlineDate.text().toString();
						}
					}
				}
			}

			if(article.AuthorList.length() && article.AuthorList.Author.length()) {
				var authors = article.AuthorList.Author;
				for(var j=0; j<authors.length(); j++) {
					var lastName = authors[j].LastName.text().toString();
					var firstName = authors[j].FirstName.text().toString();
					if(firstName == "") {
						var firstName = authors[j].ForeName.text().toString();
					}
					if(firstName || lastName) {
						newItem.creators.push({lastName:lastName, firstName:firstName});
					}
				}
			}
			
			
			if (citation.MeshHeadingList && citation.MeshHeadingList.MeshHeading) {
				var keywords = citation.MeshHeadingList.MeshHeading;
				for (var k = 0 ; k < keywords.length() ; k++) {
					newItem.tags.push(keywords[k].DescriptorName.text().toString());
				}
			}
			newItem.abstractNote = article.Abstract.AbstractText.toString()
			
			newItem.DOI = xml.PubmedArticle[i].PubmedData.ArticleIdList.ArticleId.(@IdType == "doi" ).text().toString();
			newItem.publicationTitle = Zotero.Utilities.capitalizeTitle(newItem.publicationTitle);
			newItem.complete();
		}

		Zotero.done();
	});
}

function doWeb(doc, url) {
	Zotero.debug("HIHIHI");
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;
	var ids = new Array();
	var uids = doc.evaluate('//input[@id="UidCheckBox" or @name="uid"]', doc, //edited for new PubMed
			       nsResolver, XPathResult.ANY_TYPE, null);
	var uid = uids.iterateNext();
	if(uid) {
		if (uids.iterateNext()){
			var items = new Array();
			var tablex = '//div[@class="rprt"]';
			if (!doc.evaluate(tablex, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
				var tablex = '//div[@class="ResultSet"]/dl';
				var other = true;
			}
			var tableRows = doc.evaluate(tablex, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var tableRow;
			// Go through table rows
			while(tableRow = tableRows.iterateNext()) {
				uid = doc.evaluate('.//input[@id="UidCheckBox"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if (other) {
					var article = doc.evaluate('.//h2', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				} else {
					var article = doc.evaluate('.//p[@class="title"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				}
				items[uid.value] = article.textContent;
			}

			items = Zotero.selectItems(items);

			if(!items) {
				return true;
			}

			for(var i in items) {
				ids.push(i);
			}

			lookupPMIDs(ids);
		} else {
			ids.push(uid.value);
			lookupPMIDs(ids, doc);
		}
	}
}

function doSearch(item) {
	// pmid was defined earlier in detectSearch
	lookupPMIDs([getPMID(item.contextObject)]);
}
