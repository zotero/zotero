{
        "translatorID": "fe728bc9-595a-4f03-98fc-766f1d8d0936",
        "label": "Wiley Online Library",
        "creator": "Sean Takats, Michael Berkowitz and Avram Lyon",
        "target": "https?://onlinelibrary\\.wiley\\.com[^\\/]*/(?:doi|advanced/search)",
        "minVersion": "1.0.0b4.r5",
        "maxVersion": "",
        "priority": 100,
        "inRepository": "1",
        "translatorType": 4,
        "lastUpdated": "2011-03-27 01:29:16"
}

function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if (url.match(/\/issuetoc|\/results/)) {
		return "multiple";
	} else return "journalArticle";
}

function doWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var host = 'http://' + doc.location.host + "/";
	
	var urls = new Array();
	if(detectWeb(doc, url) == "multiple") {  //search
		var title;
		var availableItems = new Array();
		var articles = doc.evaluate('//li//div[@class="citation article" or @class="citation tocArticle"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var article = false;
		while (article = articles.iterateNext()) {
			availableItems[article.href] = article.textContent;
		}
		var items = Zotero.selectItems(availableItems);
		if(!items) {
			return true;
		}
		for (var i in items) {
			urls.push(i);
		}
		Zotero.Utilities.processDocuments(urls, scrape, function () { Zotero.done(); });
	} else { //single article
		scrape(doc, url);
	}
	
	Zotero.wait();
}

function parseIdentifier(identifier) {
	var idPieces = identifier.split(':');
	if (idPieces.length > 1) {
		 var prefix = idPieces.shift();
		 switch (prefix.toLowerCase()) {
			case "doi": return ["doi", idPieces.join(':')];
			case "isbn": return ["isbn", idPieces.join(':')];
			case "issn": return ["issn", idPieces.join(':')];
			case "pmid": return ["pmid", idPieces.join(':')];
			default: // do nothing
		}
		Zotero.debug("Unknown identifier prefix '"+prefix+"'");
		return [prefix, idPieces.join(':')];
	}
	if (identifer.substr(0,3) == '10.') return ["doi", identifier];

	// If we're here, we have a funny number, and we don't know what to do with it.
	var ids = idCheck(identifier);
	if (ids.isbn13) return ["isbn13", isbn13];
	if (ids.isbn10) return ["isbn10", isbn10];
	if (ids.issn) return ["issn", isbn10];
	
	return ["unknown", identifier];
}

function addIdentifier(identifier, item) {
	var parsed = parseIdentifier(identifier);
	switch (parsed[0]) {
		case "doi": item.DOI = parsed[1]; break;
		case "isbn": item.ISBN = parsed[1]; break;
		case "isbn13": item.ISBN = parsed[1]; break;
		case "isbn10": item.ISBN = parsed[1]; break;
		case "issn": item.ISSN = parsed[1]; break;
		default:
	}
}

function scrape(doc,url)
{
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
       
	var newItem=new Zotero.Item("journalArticle");
       var temp;
       var xpath;
       var row;
       var rows;

       newItem.url = doc.location.href;
       var metaTags = doc.getElementsByTagName("meta");

       var pages = [false, false];
       var doi = false;
       var pdf = false;
       var html = false;
	for (var i = 0; i< metaTags.length; i++) {
		var tag = metaTags[i].getAttribute("name");
		var value = metaTags[i].getAttribute("content");
		//Zotero.debug(pages + pdf + html);
       		//Zotero.debug("Have meta tag: " + tag + " => " + value);
		switch (tag) {
			// PRISM
			case "prism.publicationName": newItem.publicationTitle = value; break;
			case "prism.issn": if (!newItem.ISSN && value != "NaN" && value != "") newItem.ISSN = value; break;
			case "prism.eIssn": if (!newItem.ISSN && value != "NaN" && value != "") newItem.ISSN = value; break;
			// This is often NaN for some reason
			case "prism.publicationDate": if (!newItem.date && value != "NaN" && value !== "") newItem.date = value; break;
			case "prism.volume": if (!newItem.volume && value != "NaN" && value != "") newItem.volume = value; break;
			case "prism.number": if (!newItem.issue && value != "NaN" && value != "") newItem.issue = value; break;
			// These also seem bad
			case "prism.startingPage": if(!pages[0] && value != "null" && value != "") pages[0] = value; break;
			case "prism.endingPage": if(!pages[1] && value != "null" && value != "") pages[1] = value; break;
			case "prism.number": newItem.issue = value; break;
			// Google.
			case "citation_journal_title": if (!newItem.publicationTitle) newItem.publicationTitle = value; break;
			case "citation_authors":
				if (newItem.creators.length == 0) {
					for each(var author in value.split(';')) newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author", true));
				}
				break;
			case "citation_title": if (!newItem.title) newItem.title = value; break;
			case "citation_publisher": if (!newItem.publisher) newItem.publisher = value; break;
			case "citation_date": if (!newItem.date && value != "NaN" && value != "") newItem.date = value; break;
			case "citation_year": if (!newItem.date && value != "NaN" && value != "") newItem.date = value; break;
			case "citation_volume": if (!newItem.volume && value != "NaN" && value != "") newItem.volume = value; break;
			case "citation_issue": if (!newItem.issue && value != "NaN" && value != "") newItem.issue = value; break;
			case "citation_firstpage": if (!pages[0] && value != "NaN" && value != "") pages[0] = value; break;
			case "citation_lastpage": if (!pages[1] && value != "NaN" && value != "") pages[1] = value; break;
			case "citation_issn": if (!newItem.ISSN && value != "NaN" && value != "") newItem.ISSN = value; break;
			case "citation_isbn": if (!newItem.ISBN && value != "NaN" && value != "") newItem.ISBN = value; break;
			// Prefer long language names
			case "citation_language": if ((!newItem.language || newItem.language.length < 4)
								&& value != "null" && value != "") newItem.language = value; break;
			case "citation_doi": if (!newItem.DOI) newItem.DOI = value; break;
			case "citation_abstract": newItem.abstractNote = value; break;
			case "citation_abstract_html_url": newItem.url = value; break;
			case "citation_pdf_url": if(!pdf) pdf = value; break;
			case "citation_keywords": newItem.tags.push(value); break;
			case "citation_fulltext_html_url": if(!pdf) pdf = value; break;
			case "fulltext_pdf": if(!pdf) pdf = value; break;
			// Dublin Core
			case "dc.publisher": if(!newItem.publisher) newItem.publisher = value; break;
			case "dc.language": if(!newItem.language) newItem.language = value; break;
			case "dc.rights": if(!newItem.rights) newItem.rights = value; break;
			case "dc.title": if(!newItem.title) newItem.title = value; break;
			case "dc.creator": if(!newItem.creators.length == 0) newItem.creators.push(Zotero.Utilities.cleanAuthor(value)); break;
			// This is often NaN for some reason
			case "dc.date": if (!newItem.date && value != "NaN" && value !== "") newItem.date = value; break;
			case "dc.identifier": addIdentifier(value, newItem); break; 
			default:
				Zotero.debug("Ignoring meta tag: " + tag + " => " + value);
		}
	}
	
	if (pdf) newItem.attachments = [{url:pdf, title:"Wiley Full Text PDF", mimeType:"application/pdf"}];
	if (html) newItem.attachments = [{url:html, title:"Wiley Full Text HTML"}];
	
	if (pages[0] && pages[1]) newItem.pages = pages.join('-')
	else newItem.pages = pages[0] ? pages[1] : (pages[1] ? pages[1] : "");

	// Abstracts don't seem to come with
	if (!newItem.abstractNote) {
		var abstractNode = doc.evaluate('//div[@id="abstract"]/div[@class="para"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if (abstractNode) newItem.abstractNote = abstractNode.textContent;
	}
       newItem.complete();
}

// Implementation of ISBN and ISSN check-digit verification
// Based on ISBN Users' Manual (http://www.isbn.org/standards/home/isbn/international/html/usm4.htm)
// and the Wikipedia treatment of ISBN (http://en.wikipedia.org/wiki/International_Standard_Book_Number)
// and the Wikipedia treatment of ISSN (http://en.wikipedia.org/wiki/International_Standard_Serial_Number)

// This will also check ISMN validity, although it does not distinguish from their
// neighbors in namespace, ISBN-13. It does not handle pre-2008 M-prefixed ISMNs; see
// http://en.wikipedia.org/wiki/International_Standard_Music_Number

// This does not validate multiple identifiers in one field,
// but it will gracefully ignore all non-number detritus,
// such as extraneous hyphens, spaces, and comments.

// It currently maintains hyphens in non-initial and non-final position,
// discarding consecutive ones beyond the first as well.

// It also adds the customary hyphen to valid ISSNs.

// Takes the first 8 valid digits and tries to read an ISSN,
// takes the first 10 valid digits and tries to read an ISBN 10,
// and takes the first 13 valid digits to try to read an ISBN 13
// Returns an object with four attributes:
// 	"issn" 
// 	"isbn10"
// 	"isbn13"
// Each will be set to a valid identifier if found, and otherwise be a
// boolean false.

// There could conceivably be a valid ISBN-13 with an ISBN-10
// substring; this should probably be interpreted as the latter, but it is a
idCheck = function(isbn) {
	// For ISBN 10, multiple by these coefficients, take the sum mod 11
	// and subtract from 11
	var isbn10 = [10, 9, 8, 7, 6, 5, 4, 3, 2];

	// For ISBN 13, multiple by these coefficients, take the sum mod 10
	// and subtract from 10
	var isbn13 = [1, 3, 1, 3, 1, 3, 1, 3, 1, 3, 1, 3];

	// For ISSN, multiply by these coefficients, take the sum mod 11
	// and subtract from 11
	var issn = [8, 7, 6, 5, 4, 3, 2];

	// We make a single pass through the provided string, interpreting the
	// first 10 valid characters as an ISBN-10, and the first 13 as an
	// ISBN-13. We then return an array of booleans and valid detected
	// ISBNs.

	var j = 0;
	var sum8 = 0;
	var num8 = "";
	var sum10 = 0;
	var num10 = "";
	var sum13 = 0;
	var num13 = "";
	var chars = [];

	for (var i=0; i < isbn.length; i++) {
		if (isbn.charAt(i) == " ") {
			// Since the space character evaluates as a number,
			// it is a special case.
		} else if (j > 0 && isbn.charAt(i) == "-" && isbn.charAt(i-1) != "-") {
			// Preserve hyphens, except in initial and final position
			// Also discard consecutive hyphens
			if(j < 7) num8 += "-";
			if(j < 10) num10 += "-";
			if(j < 13) num13 += "-";
		} else if (j < 7 && ((isbn.charAt(i) - 0) == isbn.charAt(i))) {
			sum8 += isbn.charAt(i) * issn[j];
			sum10 += isbn.charAt(i) * isbn10[j];
			sum13 += isbn.charAt(i) * isbn13[j];
			num8 += isbn.charAt(i);
			num10 += isbn.charAt(i);
			num13 += isbn.charAt(i);
			j++;
		} else if (j == 7 &&
			(isbn.charAt(i) == "X" || isbn.charAt(i) == "x" ||
				((isbn.charAt(i) - 0) == isbn.charAt(i)))) {
			// In ISSN, an X represents the check digit "10".
			if(isbn.charAt(i) == "X" || isbn.charAt(i) == "x") {
				var check8 = 10;
				num8 += "X";
			} else {
				var check8 = isbn.charAt(i);
				sum10 += isbn.charAt(i) * isbn10[j];
				sum13 += isbn.charAt(i) * isbn13[j];
				num8 += isbn.charAt(i);
				num10 += isbn.charAt(i);
				num13 += isbn.charAt(i);
				j++;
			}
		} else if (j < 9 && ((isbn.charAt(i) - 0) == isbn.charAt(i))) {
			sum10 += isbn.charAt(i) * isbn10[j];
			sum13 += isbn.charAt(i) * isbn13[j];
			num10 += isbn.charAt(i);
			num13 += isbn.charAt(i);
			j++;
		} else if (j == 9 &&
			(isbn.charAt(i) == "X" || isbn.charAt(i) == "x" ||
				((isbn.charAt(i) - 0) == isbn.charAt(i)))) {
			// In ISBN-10, an X represents the check digit "10".
			if(isbn.charAt(i) == "X" || isbn.charAt(i) == "x") {
				var check10 = 10;
				num10 += "X";
			} else {
				var check10 = isbn.charAt(i);
				sum13 += isbn.charAt(i) * isbn13[j];
				num10 += isbn.charAt(i);
				num13 += isbn.charAt(i);
				j++;
			}
		} else if(j < 12 && ((isbn.charAt(i) - 0) == isbn.charAt(i))) {
			sum13 += isbn.charAt(i) * isbn13[j];
			num13 += isbn.charAt(i);
			j++;
		} else if (j == 12 && ((isbn.charAt(i) - 0) == isbn.charAt(i))) {
			var check13 = isbn.charAt(i);
			num13 += isbn.charAt(i);
		}
	}
	var valid8  = ((11 - sum8 % 11) % 11) == check8;
	var valid10 = ((11 - sum10 % 11) % 11) == check10;
	var valid13 = (10 - sum13 % 10 == check13);
	var matches = false;
	
	// Since ISSNs have a standard hyphen placement, we can add a hyphen
	if (valid8 && (matches = num8.match(/([0-9]{4})([0-9]{3}[0-9Xx])/))) {
		num8 = matches[1] + '-' + matches[2];
	} 

	if(!valid8) {num8 = false};
	if(!valid10) {num10 = false};
	if(!valid13) {num13 = false};
	return {"isbn10" : num10, "isbn13" : num13, "issn" : num8};
}
