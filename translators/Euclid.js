{
	"translatorID":"2e1c09a0-3006-11de-8c30-0800200c9a66",
	"label":"Project Euclid",
	"creator":"Guy Freeman and Avram Lyon",
	"target":"^https?://[^/]*projecteuclid\\.org[^/]*/",
	"minVersion":"1.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":"1",
	"translatorType":4,
	"lastUpdated":"2010-11-10 10:15:00"
}

function detectWeb(doc, url){
    var namespace = doc.documentElement.namespaceURI;
    var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
    } : null;
    
    var xpath = '//div[@class="abstract-text"]';
    Zotero.debug(xpath);
    if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
	return "journalArticle";
    }
}

function doWeb(doc, url){
    var namespace = doc.documentElement.namespaceURI;
    var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
    } : null;

    var host = doc.location.host;
    var newItem = new Zotero.Item("journalArticle");
    newItem.url = doc.location.href; 
    Zotero.debug(doc.location.href);
	
    var items = Object();
    var header;
    var contents;
	
    var titleXPath = '//div[@id="main-text"]/h3';
    var titleitem = doc.evaluate(titleXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent; 
    Zotero.debug(titleitem);
    newItem.title = titleitem;

    var authorXPath = '//div[@class="abs-page-text-bold"]/span';
    var authoritem = doc.evaluate(authorXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/^\s*|\s*$/g, '');
    if (authoritem.search(/\sand\s/) == -1) {
	var authoritem2 = "";
	for (var authornamescount in authoritem.split(/\s/)) {
	    authoritem2 = authoritem2 + " " + authoritem.split(/\s/)[authornamescount][0] + authoritem.split(/\s/)[authornamescount].substring(1).toLowerCase();
	}
	newItem.creators.push(Zotero.Utilities.cleanAuthor(authoritem2, 'author'));
    } else {
	var authors = authoritem.split(/\sand\s/i);
	for (var authorcount in authors) {
	    var author = "";
	    for (var authornames in authors[authorcount].split(/\s/)) {
		author = author + " " + authors[authorcount].split(/\s/)[authornames][0] + authors[authorcount].split(/\s/)[authornames].substring(1).toLowerCase();
	    }
	    newItem.creators.push(Zotero.Utilities.cleanAuthor(author, 'author'));
	}
    }
    
    var abstractXPath = '//div[@class="abstract-text"]/p';
    var abstractitem = doc.evaluate(abstractXPath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext().textContent;
    newItem.abstractNote = abstractitem;

    var journalXPath = '//div[@id="main-image"]/img';
    var journalitem = doc.evaluate(journalXPath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext()["alt"];
    newItem.publicationTitle = journalitem;

    var journalabbXPath = '//div[@class="abs-page-text"]/a';
    var journalabbitem = doc.evaluate(journalabbXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
    newItem.journalAbbreviation = journalabbitem;

    var idXPath = '//div[@id="identifier"]/p';
    var idresult = doc.evaluate(idXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().innerHTML;
    var idrows = idresult.split('<br>');
    var idrow, pieces;
    var identifiers = [];
    newItem.extra="";
    for each (idrow in idrows) {
	    pieces = idrow.match(/\s*([^:]+)\s*:\s*(.+)/);
	    if (pieces && pieces[1] && pieces[2]) {
	    	switch (pieces[1]) {
		    	case "Digital Object Identifier":
		    		newItem.DOI = pieces[2].match(/^\s*doi:(.*)/)[1];
		    		break;
		    	case "Mathematical Reviews number (MathSciNet)":
		    	case "Zentralblatt MATH identifier":
		    		identifiers.push(pieces[1] + ": " + pieces[2].match(/>(.*?)</)[1]);
		    		break;
		    	case "Permanent link to this document":
		    		newItem.url = pieces[2];
		    		break;
		    	default:
		    		Zotero.debug("Discarding identifier: " + pieces[1] + ": " + pieces[2] );
		    		break;
	    	}
	    	pieces = null;
	    }
	    newItem.extra = identifiers.join("; ");
    }

    var volumeetcXPath = '//div[@class="abs-page-text"]/text()';
    //var volumeetcitem = doc.evaluate(volumeetcXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().childNodes[2].textContent;
    var volumeetcitem = doc.evaluate(volumeetcXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	Zotero.debug("volumeetcitem="+volumeetcitem);
    var volumeetcitemarray = volumeetcitem.replace(/\s+/g," ").split(/\s/);
    if (volumeetcitemarray[3].search(/Number/) == -1) {
	var volumeitem = volumeetcitemarray[2].match(/\d+/)[0];
	var yearitem = volumeetcitemarray[3].match(/\d+/)[0];
	var pagesitem = volumeetcitemarray[4].match(/[^\.]+/)[0];
	newItem.volume = volumeitem;
	newItem.pages = pagesitem;
	newItem.date = yearitem;
    } else {
	var volumeitem = volumeetcitemarray[2].match(/\d+/)[0];
	var issueitem = volumeetcitemarray[4].match(/\d+/)[0];
	var yearitem = volumeetcitemarray[5].match(/\d+/)[0];
	var pagesitem = volumeetcitemarray[6].match(/[^\.]+/)[0];
	newItem.volume = volumeitem;
	newItem.pages = pagesitem;
	newItem.issue = issueitem;
	newItem.date = yearitem;
    }

   // From META tags
   newItem.publisher = doc.evaluate('//meta[@name="citation_publisher"]',doc,nsResolver,XPathResult.ANY_TYPE,null).iterateNext().content;
   newItem.date = doc.evaluate('//meta[@name="citation_date"]',doc,nsResolver,XPathResult.ANY_TYPE,null).iterateNext().content;
   newItem.ISSN = doc.evaluate('//meta[@name="citation_issn"]',doc,nsResolver,XPathResult.ANY_TYPE,null).iterateNext().content;
   newItem.language = doc.evaluate('//meta[@name="citation_language"]',doc,nsResolver,XPathResult.ANY_TYPE,null).iterateNext().content;
   
    var pdfurlxpath = '//meta[@name="citation_pdf_url"]';
    if (doc.evaluate(pdfurlxpath,doc,nsResolver,XPathResult.ANY_TYPE,null).iterateNext()) {
	var pdfurl = doc.evaluate(pdfurlxpath,doc,nsResolver,XPathResult.ANY_TYPE,null).iterateNext().content;
	newItem.attachments.push({url:pdfurl, title:"Euclid Project PDF", mimeType:"application/pdf"});
    }

    newItem.complete();
}
