{
	"translatorID":"4c9dbe33-e64f-4536-a02f-f347fa1f187d",
	"translatorType":4,
	"label":"BioInfoBank",
	"creator":"Michael Berkowitz",
	"target":"http://lib.bioinfo.pl/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-04-03 19:45:00"
}

function detectWeb(doc, url) {
	return "multiple";
}

function doWeb(doc, url) {
	var pmids = new Array();
	var items = new Object();
	var titles = doc.evaluate('//div[@class="css_pmid"]/div[@class="css_pmid_title"]/a', doc, null, XPathResult.ANY_TYPE, null);
	var title;
	while (title = titles.iterateNext()) {
		items[title.href] = Zotero.Utilities.trimInternal(title.textContent);
	}
	items = Zotero.selectItems(items);
	for (var i in items) {
		pmids.push(i.match(/pmid:(\d+)/)[1]);
	}
	var newUri = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=PubMed&retmode=xml&rettype=citation&id="+pmids.join(",");
	Zotero.Utilities.HTTP.doGet(newUri, function(text) {
		// Remove xml parse instruction and doctype
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");

		var xml = new XML(text);
		for(var i=0; i<xml.PubmedArticle.length(); i++) {
			var newItem = new Zotero.Item("journalArticle");

			var citation = xml.PubmedArticle[i].MedlineCitation;

			var PMID = citation.PMID.text().toString();
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
				newItem.pages = article.Pagination.MedlinePgn.text().toString();
			}

			if(article.Journal.length()) {
				var issn = article.Journal.ISSN.text().toString();
				if(issn) {
					newItem.ISSN = issn.replace(/[^0-9]/g, "");
				}

				newItem.journalAbbreviation = Zotero.Utilities.superCleanString(citation.MedlineJournalInfo.MedlineTA.text().toString());
				if(article.Journal.Title.length()) {
					newItem.publicationTitle = Zotero.Utilities.superCleanString(article.Journal.Title.text().toString());
				} else if(citation.MedlineJournalInfo.MedlineTA.length()) {
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
			
			newItem.complete();
		}

		Zotero.done();
	});
}