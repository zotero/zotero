{
	"translatorID":"fcf41bed-0cbc-3704-85c7-8062a0068a7a",
	"translatorType":13,
	"label":"NCBI PubMed",
	"creator":"Simon Kornblith, Michael Berkowitz, Avram Lyon, and Rintze Zelle",
	"target":"https?://[^/]*(www|preview)\\.ncbi\\.nlm\\.nih\\.gov[^/]*/(pubmed|sites/pubmed|sites/entrez|entrez/query\\.fcgi\\?.*db=PubMed)",
	"minVersion":"2.1b1",
	"maxVersion":"",
	"priority":100,
	"configOptions":{"dataMode":"block"},
	"inRepository":true,
	"lastUpdated":"2011-04-21 10:15:00"
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
	// Remove xml parse instruction and doctype
	text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");

	if (!text.substr(0,1000).match(/<PubmedArticleSet>/)) {
		// Pubmed data in the wild, perhaps copied from the web site's search results,
		// can be missing the <PubmedArticleSet> root tag. Let's add a pair!
		Zotero.debug("No root <PubmedArticleSet> tag found, wrapping in a new root tag.");
		text = "<PubmedArticleSet>" + text + "</PubmedArticleSet>";
	}

	var xml = new XML(text);
	
	for(var i=0; i<xml.PubmedArticle.length(); i++) {
		var newItem = new Zotero.Item("journalArticle");

		var citation = xml.PubmedArticle[i].MedlineCitation;

		var PMID = citation.PMID.text().toString();
		newItem.url = "http://www.ncbi.nlm.nih.gov/pubmed/" + PMID;
		newItem.extra = "PMID: "+PMID;

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
					firstName = authors[j].ForeName.text().toString();
				}
				var suffix = authors[j].Suffix.text().toString();
				if(suffix && firstName != "") {
					firstName += ", " + authors[j].Suffix.text().toString();
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
		// We use a regex to remove the section labels
		// also, we have entities to clear up
		newItem.abstractNote = Zotero.Utilities.unescapeHTML(
						article.Abstract.AbstractText.toString()
							.replace(/<\/?AbstractText\s*(?:Label=")?([^">]+)?[^>]*>/g, "$1\n")
						);

			newItem.DOI = xml.PubmedArticle[i].PubmedData.ArticleIdList.ArticleId.(@IdType == "doi" ).text().toString();
		newItem.publicationTitle = Zotero.Utilities.capitalizeTitle(newItem.publicationTitle);
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
