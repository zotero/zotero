{
        "translatorID": "1f245496-4c1b-406a-8641-d286b3888231",
        "label": "The Boston Globe",
        "creator": "Adam Crymble and Frank Bennett",
        "target": "^http://(www|search|articles)\\.boston\\.com/",
        "minVersion": "1.0.0b4.r5",
        "maxVersion": "",
        "priority": 100,
        "inRepository": false,
        "translatorType": 4,
        "lastUpdated": "2011-05-06 20:57:16"
}

/*
 * Sample URLs
 *
 * [Original request -- uncommon page format, no embedded metadata of any kind]
 * http://articles.boston.com/2011-05-03/news/29500032_1_bouncer-assault-local-restaurant
 *
 * [More common page formats, marginally reliable metadata in a comment block]
 * http://www.boston.com/yourtown/news/charlestown/2011/04/meet_charlestowns_youth_of_the.html
 * http://www.boston.com/business/articles/2011/05/05/oil_drops_below_100_per_barrel/
 * http://www.boston.com/lifestyle/articles/2011/04/28/anticipation_grows_for_mfas_art_in_bloom_festival/

 * Support for search results will require rewriting scrape(..) to use only regular expressions
 */

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	}: null;
	
	if (url.match("search.boston.com")) {
		// Search disabled until cross-domain can be dealt with
		return false;
		var results =  doc.evaluate('//div[@class="resultsMain"]//div[@class="regTZ"]/a[@class="titleLink"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		if (results.iterateNext()) {
			return "multiple";
		} else {
			return false;
		}
	} else if (url.match(/(\/[0-9]{4}\/[0-9]{2}\/|[0-9]{4}-[0-9]{2}-[0-9]{2})/)) {
		return "newspaperArticle";
	} 
}

//Boston Globe and Boston.com Translator. Original code by Adam Crymble
// Rewritten by Frank Bennett, 2011

function sniffComment (elem) {
	if (!elem) {
		return elem;
	}
	for (var i = 0, ilen = elem.childNodes.length; i < ilen; i += 1) {
		if (elem.childNodes[i].nodeName === "#comment") {
			return elem.childNodes[i].nodeValue;
		}
	}
	return false;
}

function findMagicComment (doc) {
	var hideMeElems = doc.getElementsByClassName("hideMe");
	for (var i = 0, ilen = hideMeElems.length; i < ilen; i += 1) {
		var elem = hideMeElems.item(i);
		var sniff = sniffComment(elem);
		if (sniff) {
			return sniff;
		}
	}
	var contentElem = doc.getElementById("content");
	return sniffComment(contentElem);
}

function findAuthorString (doc, newItem) {
	var authors = "";
	var bylineElem = false;
	var bylineElems = doc.getElementsByClassName("byline");
	if (bylineElems.length) {
		bylineElem = bylineElems.item(0);
	}
	if (!bylineElem) {
		var bylineElem = doc.getElementById('byline');
	}
	if (bylineElem) {
		authors = bylineElem.textContent;
		authors = authors.replace("\n", " ", "g");
		if (authors.match(/[Pp]osted\s+by\s+/)) {
			newItem.itemType = "blogPost";
		}
		authors = authors.replace(/^\s*(?:[Bb]y|[Pp]osted\s+by)\s+(.*)/, "$1");
	}
	return authors;
}

function scrape (doc, url) {
	// The site content is pretty chaotic, we do our best.

	// There are two independent blocks set-and-save blocks
	// below.

	// Many pages seem to have metadata embedded in a comment
	// The date and headline info look reliable, but
	// the byline is a disaster, to be used only
	// if absolutely necessary.
	var magicComment = findMagicComment(doc);
	if (magicComment) {
		// Blind acceptance
		var newItem =new Zotero.Item("newspaperArticle");
		newItem.publicationTitle = "Boston.com";
		// URL	
		newItem.url = doc.location.href;
		// Attachment
		newItem.attachments.push({url:doc.location.href,mimetype:"text/html",snapshot:true,title:"Boston.com page"});
		// Now try to get some citation details (go ahead, try)
		var info = magicComment.replace('\n','','g');
		newItem.title = Zotero.Utilities.unescapeHTML(info.replace(/.*<headline>(.*)<\/headline>.*/,"$1"));
		newItem.date = info.replace(/.*<date>(.*)<\/date>.*/,"$1");
		var authors = findAuthorString(doc, newItem);
		if (!authors) {
			var authors = info.replace(/.*<byline>(.*)<\/byline>.*/,"$1");
			if (authors.toLowerCase() === authors) {
				authors = info.replace(/.*<teasetext>(.*)<\/teasetext>.*/, "$1");
				var m = authors.match(/^(?:[Bb]y\s+)*([^ ,]+).*/);
				if (m) {
					authors = m[1];
				} else {
					authors = "";
				}
			}
		}
		authors = authors.split(/,*\s+and\s+/);
		authors[authors.length - 1] = authors[authors.length - 1].split(/,\s+/)[0];
		authors = authors.join(", ");
		authors = authors.split(/,\s+/);
		for (var j = 0, jlen = authors.length; j < jlen; j += 1) {
			var author = Zotero.Utilities.cleanAuthor(authors[j], 'author');
			if (author.lastName) {
				newItem.creators.push(author);
			}
		}
		newItem.complete();
	}


	// Information block
	var infoElem = doc.getElementById("mod-article-byline");
	if (infoElem) {
		var newItem = new Zotero.Item("newspaperArticle");
		newItem.publicationTitle = "Boston.com";
		// URL	
		newItem.url = doc.location.href;
		newItem.attachments.push({url:doc.location.href,mimetype:"text/html",snapshot:true,title:"Boston.com page"});

		// Date
		var dateElem = infoElem.getElementsByClassName('pubdate');
		if (dateElem.length) {
			newItem.date = dateElem.textContent;
		}

		// Authors
		for (var i = 0, ilen = infoElem.childNodes.length; i < ilen; i += 1) {
			var node = infoElem.childNodes.item(i);
			if (node.nodeName === 'SPAN') {
				if ('By' === node.textContent.slice(0,2)) {
					
					var authors = node.textContent.slice(3);
					authors = authors.split(/(?:, |,*\s+and\s+)/);
					for (var j = 0, jlen = authors.length; j < jlen; j += 1) {
						var author = Zotero.Utilities.cleanAuthor(authors[j], 'author');
						newItem.creators.push(author);
					}
				}
			}
		}
		
		// Title	
		var headerElem = doc.getElementById('mod-article-header');
		if (headerElem) {
			var h = headerElem.getElementsByTagName('h1');
			if (h.length) {
				newItem.title = h[0].textContent;
			}
		}
		newItem.complete();
	}
}


function doWeb (doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	}: null;
	
	var uris= new Array();

	if (detectWeb(doc, url) == "multiple") {
		var items = {};
		var result =  doc.evaluate('//div[@class="regTZ"]/a[@class="titleLink"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt = result.iterateNext();
		while (elmt) {
			//items.push(elmt.href);
			items[elmt.href] = elmt.textContent;
			elmt = result.iterateNext();
		}
		
		items = Zotero.selectItems(items);
		
		if (!items) {
			return true;
		}
		
		for (var i in items) {
			uris.push(i);
		}
		Zotero.Utilities.processDocuments(uris, scrape, Zotero.done);
		Zotero.wait();
	} else {
		scrape(doc, url);
	}
}
