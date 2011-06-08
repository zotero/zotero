{
        "translatorID": "92d4ed84-8d0-4d3c-941f-d4b9124cfbb",
        "label": "IEEE Xplore",
        "creator": "Simon Kornblith, Michael Berkowitz, Bastian Koenings, and Avram Lyon",
        "target": "^https?://[^/]*ieeexplore\\.ieee\\.org[^/]*/(?:[^\\?]+\\?(?:|.*&)arnumber=[0-9]+|search/(?:searchresult.jsp|selected.jsp))",
        "minVersion": "2.1",
        "maxVersion": "",
        "priority": 100,
        "inRepository": true,
        "translatorType": 4,
        "lastUpdated": "2011-06-04 12:17:06"
}

function detectWeb(doc, url) {
	var articleRe = /[?&]ar(N|n)umber=([0-9]+)/;
	var m = articleRe.exec(url);
	
	if(m) {
		return "journalArticle";
	} else {
		return "multiple";
	}
	
	return false;
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var hostRe = new RegExp("^(https?://[^/]+)/");
	var hostMatch = hostRe.exec(url);
	
	var articleRe = /[?&]ar(?:N|n)umber=([0-9]+)/;
	var m = articleRe.exec(url);
	
	if(detectWeb(doc, url) == "multiple") {
		// search page
		var items = new Array();
		
		var xPathRows = '//ul[@class="Results"]/li[@class="noAbstract"]/div[@class="header"]';
		var tableRows = doc.evaluate(xPathRows, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		while(tableRow = tableRows.iterateNext()) {
			var linknode = doc.evaluate('.//div[@class="detail"]/h3/a', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();			
			if(!linknode) {
				// There are things like tables of contents that don't have item pages, so we'll just skip them
				continue;
			}
			var link = linknode.href;
			var title = "";
			var strongs = tableRow.getElementsByTagName("h3");
			for each(var strong in strongs) {
				if(strong.textContent) {
					title += strong.textContent+" ";
				}
			}
			
			items[link] = Zotero.Utilities.trimInternal(title);
		}
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var urls = new Array();
		for(var url in items) {
			// Some pages don't show the metadata we need (http://forums.zotero.org/discussion/16283)
			// No data: http://ieeexplore.ieee.org/search/srchabstract.jsp?tp=&arnumber=1397982
			// No data: http://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=1397982
			// Data: http://ieeexplore.ieee.org/xpls/abs_all.jsp?arnumber=1397982
			var arnumber = url.match(/arnumber=(\d+)/)[1];
			url = url.replace(/\/(?:search|stamp)\/.*$/, "/xpls/abs_all.jsp?arnumber="+arnumber);
			urls.push(url);
		}
		Zotero.Utilities.processDocuments(urls, scrape, function () { Zotero.done(); });
		Zotero.wait();
	} else {
		if (url.indexOf("/search/") !== -1 || url.indexOf("/stamp/") !== -1 || url.indexOf("/ielx4/")) {
			// Address the same missing metadata problem as above
			// Also address issue of saving from PDF itself, I hope
			// URL like http://ieeexplore.ieee.org/ielx4/78/2655/00080767.pdf?tp=&arnumber=80767&isnumber=2655
			var arnumber = url.match(/arnumber=(\d+)/)[1];
			url = url.replace(/\/(?:search|stamp|ielx4)\/.*$/, "/xpls/abs_all.jsp?arnumber="+arnumber);
			Zotero.Utilities.processDocuments([url], scrape, function () { Zotero.done(); });
			Zotero.wait();
		} else {
			scrape(doc, url);
		}
	}
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

function scrape(doc,url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
       
       var newItem=new Zotero.Item("journalArticle");
       var temp;
       var xpath;
       var row;
       var rows;

       newItem.attachments = [];
       newItem.tags = [];
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
			case "citation_author":
				// I'm a little concerned we'll see multiple copies of the author names...
				for each(var author in value.split(';'))
					newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author", true));
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
			case "citation_conference":
						 newItem.itemType = "conferencePaper";
						 newItem.conferenceName = value;
						 break;
			case "citation_abstract": newItem.abstractNote = value; break;
			case "citation_abstract_html_url": newItem.attachments.push({url:value, title:"IEEE Xplore Abstract Record", snapshot:false}); break;
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
	
	// Split if we have only one tag
	if (newItem.tags.length == 1) {
		newItem.tags = newItem.tags[0].split(";");
	}
	
	if (html) newItem.attachments.push({url:html, title:"IEEE Xplore Full Text HTML"});
	
	if (pages[0] && pages[1]) newItem.pages = pages.join('-')
	else newItem.pages = pages[0] ? pages[1] : (pages[1] ? pages[1] : "");

	// Re-assign fields if the type changed
	if (newItem.itemType == "conferencePaper") {
		newItem.proceedingsTitle = newItem.publicationTitle = newItem.conferenceName;
	}

	// Abstracts don't seem to come with
	if (!newItem.abstractNote) {
		var abstractNode = doc.evaluate('//a[@name="Abstract"]/following-sibling::p[1]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if (abstractNode) newItem.abstractNote = Zotero.Utilities.trimInternal(abstractNode.textContent);
	}
	
	var res;
	// Rearrange titles, per http://forums.zotero.org/discussion/8056
	// If something has a comma or a period, and the text after comma ends with
	//"of", "IEEE", or the like, then we switch the parts. Prefer periods.
	if (res = (newItem.publicationTitle.indexOf(".") !== -1) ?
				 newItem.publicationTitle.trim().match(/^(.*)\.(.*(?:of|on|IEE|IEEE|IET|IRE))$/) :
				 newItem.publicationTitle.trim().match(/^(.*),(.*(?:of|on|IEE|IEEE|IET|IRE))$/))
		newItem.publicationTitle = res[2]+" "+res[1];
	newItem.proceedingsTitle = newItem.conferenceName = newItem.publicationTitle;
	
	if (pdf) {
		Zotero.Utilities.processDocuments([pdf], function (doc, url) {
				var namespace = doc.documentElement.namespaceURI;
				var nsResolver = namespace ? function(prefix) {
				if (prefix == 'x') return namespace; else return null;
				} : null;

				var pdfFrame = doc.evaluate('//frame[2]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if (pdfFrame) newItem.attachments = [{url:pdfFrame.src, title:"IEEE Xplore Full Text PDF", mimeType:"application/pdf"}];
				newItem.complete();
		}, null);
        } else {
		newItem.complete();
	}
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
