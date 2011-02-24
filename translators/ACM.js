{
	"translatorID":"f3f092bf-ae09-4be6-8855-a22ddd817925",
	"label":"ACM Digital Library",
	"creator":"Simon Kornblith, Michael Berkowitz and John McCaffery",
	"target":"^https?://[^/]*portal\\.acm\\.org[^/]*/(?:results\\.cfm|citation\\.cfm)",
	"minVersion":"1.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":"1",
	"translatorType":4,
	"lastUpdated":"2011-01-10 21:10:00"
}

/**
 * The XPath for all the search result <a> elements
 */
var searchResultX = '//td[@colspan="3"]/a[@class="medium-text" and @target="_self"]';
/**
 * The XPath for all the journal TOC <a> elements
 */
var tocResultX = '//td[@colspan="1"]/span[@style]/a[contains(@href,"citation.cfm")]';

/**
 * The XPath for the tag elements in a justified format tags list
 */
var justifiedTagX = '//div[@id="divtags"]/p/a';
/**
 * The XPath for the tag elements in an un-justified format tags list
 */
var unjustifiedTagX = '//div[@id="divtags"]/a';
/**
 * the XPath for the "more tags" link element
 */
var moreTagsX = '//a[@href="javascript:ColdFusion.Window.show(' + "'thetags'" + ')"]';
/**
 * the XPath for the tag elements in the "more tags" popup
 */
var moreTagX = '//a/span[@class="small-text"]';
/**
 * the XPath for the title heading element - not strictly necessary, more helpful for debugging
 */
var titleX = '//div[@class="large-text"]/h1[@class="mediumb-text"]/strong';
/**
 * XPath for Table of Contents headline for journal issue
 */
var tocX = "//div[@id='citationdetails']//h5[@class='medium-text' and contains(.,'Table of Contents')]";



/**
 * Scan to see what type of page this is
 * @param doc The XML document describing the page
 * @param url The URL of the page being scanned
 * @return What type of article this page is (multiple, journal or conference proceedings)
 */
function detectWeb(doc, url) {
	var nsResolver = getNsResolver(doc);
	var title = getText(titleX, doc, nsResolver);	
	Zotero.debug("Title: " + title);
	
	if(url.indexOf("/results.cfm") != -1) {
		Zotero.debug("Multiple items detected");		
		return "multiple";
	} else if (url.indexOf("/citation.cfm") != -1) {
		Zotero.debug("Single item detected");
		return getArticleType(doc, url, nsResolver);
		/*
		var type = getArticleType(doc, url, nsResolver);		
		if (type .indexOf("conferencePaper") != -1) {
			return "conferencePaper";
		} else
			return "journalArticle";
		}*/
	}
}

/**
 * Parse the page
 * @param doc The XML document describing the page
 * @param url The URL of the page being scanned
 */
function doWeb(doc, url) {
	Zotero.debug("test do");
	var nsResolver = getNsResolver(doc, url);
	
	//If there are multiple pages
	if (getArticleType(doc, url) == "multiple") {
		//If this is a search results page
		if (url.indexOf("results.cfm") != -1) 
			scrapeMulti(doc, url, nsResolver, "search");
		else if(getText(tocX, doc, nsResolver) =="Table of Contents")
			scrapeMulti(doc, url, nsResolver, "toc");
		Zotero.wait();		
	} //If this is a single page
	else 
		scrape(doc, url, nsResolver);
}

/**
 * Scrape search results and journal tables of contents
 * @param doc The XML document describing the page
 * @param url The URL of the page being scanned
 * @param nsResolver the namespace resolver function
 * @param type Type of result-- "search" or "toc"
 */
function scrapeMulti(doc, url, nsResolver, type) {
	switch(type) {
		case "toc":
			Zotero.debug("Scraping journal TOC");
			var resultPath= doc.evaluate(tocResultX, doc, null, XPathResult.ANY_TYPE, null);
			break;
		case "search":
			Zotero.debug("Scraping search");
		default:
			var resultPath= doc.evaluate(searchResultX, doc, null, XPathResult.ANY_TYPE, null);
	}

	//Count how mange pages have been scraped
	var node;
	var urls = {};
	//Iterate through all the results
	while(node= resultPath.iterateNext()) {
		urls[node.href + '&preflayout=flat'] = node.textContent;
	}
	
	var items = Zotero.selectItems(urls);
	if(!items) return true;
	
	var i;
	urls = [];
	for (i in items) urls.push(i);
	
	Zotero.Utilities.processDocuments(urls, scrape, function(){Zotero.done()});
}

/**
 * Scrape a single page
 * @param doc The XML document describing the page
 */
function scrape(doc) {
	var url = doc.location.href;
	var nsResolver = getNsResolver(doc, url);
			
	//Get all the details not scraped from the bibtex file
	var tags = scrapeKeywords(doc);
	var attachments = scrapeAttachments(doc, url);
	var abs = scrapeAbstract(doc);
	var type = getArticleType(doc, url, nsResolver);
	var journal = getText("//meta[@name='citation_journal_title']/@content",doc, nsResolver);	
	//Get the bibtex reference for this document as a string
	var bibtex = scrapeBibtex(url, nsResolver);
	
	//Create the new item
	var newItem = new Zotero.Item(type);
	
	//Use the bibtex translator to parse the bibtex string
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
	translator.setString(bibtex );
	//Set the function to run when the bibtex string has been parsed
	translator.setHandler("itemDone", function(obj, newItem) {
		//Store all details not parsed from the bibtex
		if(abs) newItem.abstractNote = abs;
		newItem.tags = tags;
		newItem.attachments = attachments;
		newItem.itemType= type;
		if (journal && journal != newItem.publicationTitle) {
			newItem.journalAbbreviation = newItem.publicationTitle;
			newItem.publicationTitle = journal;
		}
		// If the URL is just a DOI, clear it.
		if (newItem.url.match(/^http:\/\/doi\.acm\.org\//)) newItem.url = "";
		if (newItem.DOI) newItem.DOI = newItem.DOI.replace(/^http:\/\/doi\.acm\.org\//, '');
		var acmid = bibtex.match(/acmid = {(\d+)}/);
		if(acmid) newItem.extra = "ACM ID: "+ acmid[1];
		//Complete the parsing of the page
		newItem.complete();
	});
	
	//Trigger the translation
	translator.translate();
}

/**
 * Scrape all keywords attached to this document
 * @param doc The XML document describing the page
 * @return an array of all keywords attached to this document
 */
function scrapeKeywords(doc) {
	Zotero.debug("Scraping Keywords");
	//Try scraping keywords from the "more keywords" popup
	var keywords = scrapeMoreTagsKeywords(doc);
	
	if (keywords) return keywords;
	
	keywords = new Array();
	
	//Otherwise look for the keywords - check justified format
	var keywordPath = doc.evaluate(justifiedTagX, doc, null, XPathResult.ANY_TYPE, null);
	var keywordNode = keywordPath.iterateNext();
	//If justified format didn't work check unjustified
	if (!keywordNode) {		
		keywordPath = doc.evaluate(unjustifiedTagX, doc, null, XPathResult.ANY_TYPE, null);
		keywordNode = keywordPath.iterateNext();
	}
	//Iterate through all the keywords
	while(keywordNode) {
		keywords.push(Zotero.Utilities.trimInternal(keywordNode .textContent.toLowerCase()));
		Zotero.debug("Keyword: " + keywordNode .textContent.toLowerCase());
		keywordNode = keywordPath.iterateNext();
	}	
		
	return keywords;
}

/**
 * Scrape keywords from a "more tags" popup
 * @param doc The XML document describing the page
 * @return an array of all the keywords attached to the page which will be used as the tags for the document
 */
function scrapeMoreTagsKeywords(doc) {
	var keywords = new Array();
	
	//Look for a link for a javascript code for a "more tags" popup
	var morePath = doc.evaluate(moreTagsX, doc, null, XPathResult.ANY_TYPE, null);	
	var moreNode = morePath ? morePath.iterateNext() : null;
	//If there is no "more tags" popup
	if (!moreNode)
		return null;
	
	var keywordPath = doc.evaluate(moreTagX, doc, null, XPathResult.ANY_TYPE, null);
	
	var keywordNode;
	//Iterate through all the keywords
	while(keywordNode = keywordPath.iterateNext()) {
		keywords.push(Zotero.Utilities.trimInternal(keywordNode .textContent.toLowerCase()));
		Zotero.debug("Keyword: " + keywordNode .textContent.toLowerCase());
	}
	return keywords;
}

/**
 * Scrape all the relevant attachments from the page. 
 * Firstly grabs a snapshot of the ACM page then looks for any links to the full text
 * @param doc The XML document describing the page
 * @param url The URL of the page being scanned
 * @return an array of all the attachments
 */
function scrapeAttachments(doc, url) {
	Zotero.debug("Scraping attachments");
	var attachments = new Array();
	
	//Add the scrapeshot of this page
	attachments.push({title:"ACM Snapshot", mimeType:"text/html", url:url});
	
	//XPath for the full text links
	var textPath = doc.evaluate('//a[@name="FullTextPdf" or @name="FullTextHtml" or @name="FullText Html"]', doc, null, XPathResult.ANY_TYPE, null);
	
	var textNode;
	//Iterate through all the links
	while (textNode= textPath .iterateNext()) {
		var textURL= textNode.href;
		
		//If the full text is a pdf
		if (textNode.name == "FullTextPdf") {
			Zotero.debug("Text PDF: " + textURL);		
			attachments.push({title:"ACM Full Text PDF", mimeType:"application/pdf", url:textURL});
		} else { //Otherwise the text is an HTML link
			Zotero.debug("Text Page: " + textURL);					
			attachments.push({title:"ACM Full Text HTML", mimeType:"text/html", url:textURL});
		}
	}
		
	return attachments;
}

/**
 * Scrape the abstract from the page
 * @param doc The XML document describing the page
 * @param url The URL of the page being scanned
 * @return a string with the text of the abstract
 */
function scrapeAbstract(doc) {
	Zotero.debug("Scraping abstract");
	var text = getText('//div[@class="flatbody" or @class="tabbody"]', doc);
	return text;
}

/**
 * Get the text of the bibtex format reference
 * @param url The URL of the page being scanned
 * @param nsResolver the namespace resolver function
 * @return the bibtex reference as a trimmed string
 */
function scrapeBibtex(url, nsResolver) {
	Zotero.debug("Scraping full details from bibtex");
	//Get the ID of this document
	var id = getId(url);
	//The link of the bibtex popup
	var bibtex = "http://portal.acm.org/exportformats.cfm?id=" + id + "&expformat=bibtex";
	
	Zotero.debug("Bibtex: " + bibtex);
	
	//Get the xml document which will be loaded into the popup box
	var texDoc = Zotero.Utilities.retrieveDocument(bibtex);	
	//Find the node with the bibtex text in it
	var path = texDoc.evaluate('//pre', texDoc, nsResolver, XPathResult.ANY_TYPE, null);	
	var node = path.iterateNext();

	if (node != null && node.textContent != null) {
		var ref =  node.textContent;
		Zotero.debug("\nref : " + (ref == null ? "null":ref));
		ref = Zotero.Utilities.trimInternal(ref);
		ref = Zotero.Utilities.trim(ref);
		
		return ref;
	}
	return null;
}

/**
 * Get the unique identifier of this document
 * @param url The URL of the page being scanned
 * @param journal [optional]whether to get the ID of the journal the document is in or of the document itself
 * @return a string containing the identifier of the document or journal the document is in
 */
function getId(url, journal) {
	if (journal=== undefined) 
		journal= false;

	var cfmIndex = url.indexOf(".cfm");	
	var atIndex = url.indexOf('&');
	
	var id = url.substr(cfmIndex + 8);
	
	if (atIndex != -1)
		id = id.replace(url.substring(atIndex), "");
	
	var dotIndex = id.indexOf('.');	
	if (dotIndex != -1)
		if (!journal) 
			id = id.replace(id .substring(0, (dotIndex+1)), "");
		else 
			id = id.replace(id .substring(dotIndex), "");
	
	return id;
}

/**
 * Find out what kind of document this is
 * @param doc The XML document describing the page
 * @param url The URL of the page being scanned
 * @param nsResolver the namespace resolver function
 * @return a string with either "multiple", "journalArticle" or "conferencePaper" in it, depending on the type of document
 */
function getArticleType(doc, url, nsResolver) {
	var toc = doc.evaluate(tocX, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (url.indexOf("results.cfm") != -1 || toc) {	
		Zotero.debug("Type: multiple");
		return "multiple";
	}

	//XPath for the table cell which has either "Journal" or "Proceeding" in it
	var text = getText('//td[@nowrap="nowrap" and @style="padding-bottom: 0px;"]', doc, nsResolver);
			
	Zotero.debug("Type: " + text);
	if (text.indexOf("Proceeding") != -1) 
		return "conferencePaper";
	else if (text.indexOf("Magazine") != -1)
		return "magazineArticle";
	else
		return "journalArticle";
	
}

/**
 * Get the text from the first node defined by the given xPathString
 * @param pathString the XPath indicating which node to get the text from
 * @param doc The XML document describing the page
 * @param nsResolver the namespace resolver function
 * @return the text in the defined node or "Unable to scrape text" if the node was not found or if there was no text content
 */
function getText(pathString, doc, nsResolver) {
	var path  = doc.evaluate(pathString, doc, nsResolver, XPathResult.ANY_TYPE, null);	
	var node = path.iterateNext();		
	
	if (node == null || node.textContent == undefined || node.textContent == null) {
		Zotero.debug("Unable to retrieve text for XPath: "+pathString);
		return "";
	}
				
	return node.textContent;
}

/**
 * Get a function for returning the namespace of a given document given its prefix
 * @param nsResolver the namespace resolver function
 */
function getNsResolver(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace;
		else return null;	
	} : null;
	
	return nsResolver;
}
