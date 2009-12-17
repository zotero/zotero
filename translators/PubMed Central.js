{
	"translatorID":"27ee5b2c-2a5a-4afc-a0aa-d386642d4eed",
	"translatorType":4,
	"label":"PubMed Central",
	"creator":"Michael Berkowitz and Rintze Zelle",
	"target":"http://[^/]*.nih.gov/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-12-17 08:10:00"
}

function detectWeb(doc, url) {
    var namespace = doc.documentElement.namespaceURI;
    var nsResolver = namespace ? function(prefix) {
        if (prefix == 'x') return namespace; else return null;
    } : null;
    
    try {var pmid = url.match(/ncbi\.nlm\.nih\.gov\/pmc\/articles\/PMC([\d]+)/)[1];} catch (e) {}
    if (pmid) {
        return "journalArticle";
    }
    
    var uids = doc.evaluate('//div[@class="toc-pmcid"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
    if(uids.iterateNext()) {
        if (uids.iterateNext()){
            return "multiple";
        }
        return "journalArticle";
    }
}

function lookupPMCIDs(ids, doc) {
    Zotero.wait();
    var newUri = "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&retmode=xml&id=" + ids.join(",");
    Zotero.debug(newUri);
    Zotero.Utilities.HTTP.doGet(newUri, function (text) {
        text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, ""); // Remove xml parse instruction and doctype
        text = text.replace(/(<[^!>][^>]*>)/g, function replacer(str, p1, p2, offset, s) {
            return str.replace(/-/gm, "");
        }); //Strip hyphens from element names, attribute names and attribute values
        text = text.replace(/(<[^!>][^>]*>)/g, function replacer(str, p1, p2, offset, s) {
            return str.replace(/:/gm, "");
        }); //Strip colons from element names, attribute names and attribute values
        text = Zotero.Utilities.trim(text);
        XML.prettyPrinting = false;
        XML.ignoreWhitespace = false;
        var xml = new XML(text);

        for (var i = 0; i < xml.article.length(); i++) {
            var newItem = new Zotero.Item("journalArticle");

            var journal = xml.article[i].front.journalmeta;

            if (journal.journalid.(@journalidtype == "nlmta").length()) {
                newItem.journalAbbreviation = Zotero.Utilities.superCleanString(journal.journalid.(@journalidtype == "nlmta").text().toString());
            }
            newItem.publicationTitle = Zotero.Utilities.superCleanString(journal.journaltitle.text().toString());

            var issn = journal.issn.(@pubtype == "epub").text().toString();
            var issn = journal.issn.(@pubtype == "ppub").text().toString();
            if (issn) {
                newItem.ISSN = issn;
            }

            var article = xml.article[i].front.articlemeta;

            if (article.abstract.p.length()) {
                newItem.abstractNote = Zotero.Utilities.unescapeHTML(article.abstract.p.toXMLString());
            }

            if (article.articleid.(@pubidtype == "doi").length()) {
                newItem.DOI = article.articleid.(@pubidtype == "doi").text().toString();
            }
            var PMID = article.articleid.(@pubidtype == "pmid").text().toString();
            if (PMID) {
                newItem.extra = "PMID: " + PMID + "\n";
            }
            newItem.extra = newItem.extra + "PMCID: " + ids[i];
            newItem.title = Zotero.Utilities.unescapeHTML(article.titlegroup.articletitle.toXMLString().split("<xref")[0]);
            if (article.volume.length()) {
                newItem.volume = article.volume.text().toString();
            }
            if (article.issue.length()) {
                newItem.issue = article.issue.text().toString();
            }
            if (article.lpage.length()) {
                newItem.pages = article.fpage.text().toString() + "-" + article.lpage.text().toString();
            } else if (article.fpage.length()) {
                newItem.pages = article.fpage.text().toString()
            }

            var pubdate = article.pubdate. (@pubtype == "ppub");
            if (!pubdate) {
                var pubdate = article.pubdate. (@pubtype == "epub");
            }
            if (pubdate) {
                if (pubdate.day.text().toString() != "") {
                    newItem.date = pubdate.year.text().toString() + "-" + pubdate.month.text().toString() + "-" + pubdate.day.text().toString();
                } else if (pubdate.month.text().toString() != "") {
                    newItem.date = pubdate.year.text().toString() + "-" + pubdate.month.text().toString();
                } else if (pubdate.year.text().toString() != "") {
                    newItem.date = pubdate.year.text().toString();
                }
            }

            if (article.contribgroup.contrib.length()) {
                var authors = article.contribgroup.contrib. (@contribtype == "author");
                for (var j = 0; j < authors.length(); j++) {
                    var lastName = authors[j].name.surname.text().toString();
                    var firstName = authors[j].name.givennames.text().toString();
                    if (firstName || lastName) {
                        newItem.creators.push({
                            lastName: lastName,
                            firstName: firstName
                        });
                    }
                }
            }

            var linkurl = "http://www.ncbi.nlm.nih.gov/pmc/articles/PMC" + ids[i] + "/";
            newItem.attachments = [{
                url: linkurl,
                title: "PubMed Central Link",
                mimeType: "text/html",
                snapshot: false
            }];
            
            if (article.selfuri.@xlinkhref.length()) {
                var pdfFileName = article.selfuri.@xlinkhref.toXMLString();
                var pdfurl = "http://www.ncbi.nlm.nih.gov/pmc/articles/PMC" + ids[i] + "/pdf/" + pdfFileName;
                newItem.attachments.push({
                title:"PubMed Central Full Text PDF",
                mimeType:"application/pdf",
                url:pdfurl
            }); 
            }

            newItem.complete();
        }

        Zotero.done();
    });
}



function doWeb(doc, url) {
    var namespace = doc.documentElement.namespaceURI;
    var nsResolver = namespace ?
    function (prefix) {
        if (prefix == 'x') return namespace;
        else return null;
    } : null;

    var ids = new Array();
    var pmcid;
    var resultsCount = 0;
    try {
        pmcid = url.match(/ncbi\.nlm\.nih\.gov\/pmc\/articles\/PMC([\d]+)/)[1];
    } catch(e) {}
    if (pmcid) {
        ids.push(pmcid);
        lookupPMCIDs(ids, doc);
    } else {
        var pmcids = doc.evaluate('//div[@class="toc-pmcid"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
        var titles = doc.evaluate('//div[@class="toc-title"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
        var title;
        while (pmcid = pmcids.iterateNext()) {
            title = titles.iterateNext();
            ids[pmcid.textContent.match(/PMC([\d]+)/)[1]] = title.textContent;
            resultsCount = resultsCount + 1;
        }
        if (resultsCount > 1) {
            ids = Zotero.selectItems(ids);
        }
        if (!ids) {
            return true;
        }

        var pmcids = new Array();
        for (var i in ids) {
            pmcids.push(i);
        }
        lookupPMCIDs(pmcids, doc);
    }
}