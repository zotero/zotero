{
    "translatorID":"2e1c09a0-3006-11de-8c30-0800200c9a66",
	"translatorType":4,
	"label":"Project Euclid",
	"creator":"Guy Freeman",
	"target":"https?://[^/]*projecteuclid\\.org[^/]*/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-04-18 08:55:00"
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

    var authorXPath = '//div[@id="main-text"]/p[@class="bold"]';
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

    var journalXPath = '//div[@id="secondary-content-plain"]/h2';
    var journalitem = doc.evaluate(journalXPath, doc, nsResolver,XPathResult.ANY_TYPE, null).iterateNext().textContent;
    newItem.publicationTitle = journalitem;

    var journalabbXPath = '//div[@id="main-text"]/p[2]/a';
    var journalabbitem = doc.evaluate(journalXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
    newItem.journalAbbr = journalabbitem;

    var volumeetcXPath = '//div[@id="main-text"]/p[2]/text()';
    //var volumeetcitem = doc.evaluate(volumeetcXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().childNodes[2].textContent;
    var volumeetcitem = doc.evaluate(volumeetcXPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	Zotero.debug("volumeetcitem="+volumeetcitem);
    var volumeetcitemarray = volumeetcitem.replace(/\s+/g," ").split(/\s/);
    if (volumeetcitemarray[3].search(/Number/) == -1) {
	var volumeitem = volumeetcitemarray[2].match(/\d+/);
	var yearitem = volumeetcitemarray[3].match(/\d+/);
	var pagesitem = volumeetcitemarray[4].match(/[^\.]+/);
	newItem.volume = volumeitem;
	newItem.pages = pagesitem;
	newItem.date = yearitem;
    } else {
	var volumeitem = volumeetcitemarray[2].match(/\d+/);
	var issueitem = volumeetcitemarray[4].match(/\d+/);
	var yearitem = volumeetcitemarray[5].match(/\d+/);
	var pagesitem = volumeetcitemarray[6].match(/[^\.]+/);
	newItem.volume = volumeitem;
	newItem.pages = pagesitem;
	newItem.issue = issueitem;
	newItem.date = yearitem;
    }

    var doixpath = '//div[@id="identifier"]/p';
	try {
    	var doi = doc.evaluate(doixpath,doc,nsResolver,XPathResult.ANY_TYPE,null).iterateNext().childNodes[2].textContent.match(/\d.*/);
    	newItem.DOI = doi;
	} catch (e) {
		// no doi, do nothing
	}
    var pdfurlxpath = '//div[@id="download-section"]/div/a';
    if (doc.evaluate(pdfurlxpath,doc,nsResolver,XPathResult.ANY_TYPE,null).iterateNext().textContent.search(/pdf/i) != -1) {
	var pdfurl = doc.evaluate(pdfurlxpath,doc,nsResolver,XPathResult.ANY_TYPE,null).iterateNext().href;
	newItem.attachments.push({url:pdfurl, title:"Euclid Project PDF", mimeType:"application/pdf"});
    }

    newItem.complete();
}
