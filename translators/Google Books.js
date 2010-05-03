{
	"translatorID":"3e684d82-73a3-9a34-095f-19b112d88bbf",
	"label":"Google Books",
	"creator":"Simon Kornblith, Michael Berkowitz and Rintze Zelle",
	"target":"^http://(books|www)\\.google\\.[a-z]+(\\.[a-z]+)?/books\\?(.*id=.*|.*q=.*)",
	"minVersion":"2.0b7",
	"maxVersion":"",
	"priority":100,
	"inRepository":"1",
	"translatorType":4,
	"lastUpdated":"2010-05-03 04:20:00"
}

/*
The various types of Google Books URLs are:

Search results - List view
http://books.google.com/books?q=asimov&btnG=Search+Books

Search results - Cover view
http://books.google.com/books?q=asimov&btnG=Search%20Books&rview=1

Single item - URL with "id"
http://books.google.com/books?id=skf3LSyV_kEC&source=gbs_navlinks_s
http://books.google.com/books?hl=en&lr=&id=Ct6FKwHhBSQC&oi=fnd&pg=PP9&dq=%22Peggy+Eaton%22&ots=KN-Z0-HAcv&sig=snBNf7bilHi9GFH4-6-3s1ySI9Q#v=onepage&q=%22Peggy%20Eaton%22&f=false

Single item - URL with "vid" (see http://code.google.com/apis/books/docs/static-links.html)
http://books.google.com/books?printsec=frontcover&vid=ISBN0684181355&vid=ISBN0684183951&vid=LCCN84026715#v=onepage&q&f=false

*/

function detectWeb(doc, url) {
	var re = new RegExp('^http://(books|www)\\.google\\.[a-z]+(\.[a-z]+)?/books\\?(.*&)?(id|vid)=([^&]+)', 'i');
	if(re.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}
function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;
	
	// get local domain suffix
	var psRe = new RegExp("https?://(books|www)\.google\.([^/]+)/");
	var psMatch = psRe.exec(url);
	var suffix = psMatch[2];
	var prefix = psMatch[1];
	var uri = doc.location.href;
	var newUris = new Array();
	
	var re = new RegExp('^http://(?:books|www)\\.google\\.[a-z]+(?:\.[a-z]+)?/books\\?(?:.*&)?(id|vid)=([^&]+)', 'i');
	var m = re.exec(uri);
	if(m && m[1] == "id") {
		newUris.push("http://books.google.com/books/feeds/volumes/"+m[2]);
	} else if (m && m[1] == "vid") {
		var itemLinkWithID = doc.evaluate("/html/head/link", doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		var m = re.exec(itemLinkWithID);
		newUris.push("http://books.google.com/books/feeds/volumes/"+m[2]);
	} else {
		var items = getItemArrayGB(doc, doc, 'google\\.' + suffix + '/books\\?id=([^&]+)', '^(?:All matching pages|About this Book|Table of Contents|Index)');
		// Drop " - Page" thing
		//Zotero.debug(items);
		for(var i in items) {
			items[i] = items[i].replace(/- Page [0-9]+\s*$/, "");
		}
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			var m = re.exec(i);
			newUris.push("http://books.google.com/books/feeds/volumes/"+m[2]);
		}
	}
	
	var itemUrlBase = "http://"+prefix+".google."+suffix+"/books?id=";
	
	for (var i in newUris) {
		var d = Zotero.Utilities.retrieveSource(newUris[i]);
		//Zotero.debug(d);
		parseXML(d, itemUrlBase);
	}
}
	
function parseXML(text, itemUrlBase) {
	// Remove xml parse instruction and doctype
	text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");

	var xml = new XML(text);
	
	default xml namespace = "http://purl.org/dc/terms"; with ({});
		
	var newItem = new Zotero.Item("book");
	
	var authors = xml.creator;
	for (var i in authors) {
		newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i].toString(), "author"));
	}
	
	newItem.date = xml.date.toString();

	var pages = xml.format.toString();
	var pagesRe = new RegExp(/(\d+)( pages)/);
	var pagesMatch = pagesRe.exec(pages);
	if (pagesMatch!=null) {
		newItem.numPages = pagesMatch[1];
	} else {
		newItem.numPages = pages;
	}
	
	var ISBN;
	var ISBN10Re = new RegExp(/(ISBN:)(\w{10})$/);
	var ISBN13Re = new RegExp(/(ISBN:)(\w{13})$/);
	var identifiers = xml.identifier;
	for (var i in identifiers) {
		var ISBN10Match = ISBN10Re.exec(identifiers[i].toString());
		var ISBN13Match = ISBN13Re.exec(identifiers[i].toString());
		if (ISBN10Match != null) {
			ISBN = ISBN10Match[2];
		}
		if (ISBN13Match != null) {
			ISBN = ISBN13Match[2];
		}
	}
	newItem.ISBN = ISBN;
	
	if (xml.publisher[0]) {
		newItem.publisher = xml.publisher[0].toString();
	}
		
	newItem.title = xml.title[0].toString();

	var url = itemUrlBase + xml.identifier[0];

	newItem.attachments = [{title:"Google Books Link", snapshot:false, mimeType:"text/html", url:url}];
	
	newItem.complete();
}

/**
 * Grabs items based on URLs, modified for Google Books
 *
 * @param {Document} doc DOM document object
 * @param {Element|Element[]} inHere DOM element(s) to process
 * @param {RegExp} [urlRe] Regexp of URLs to add to list
 * @param {RegExp} [urlRe] Regexp of URLs to reject
 * @return {Object} Associative array of link => textContent pairs, suitable for passing to
 *	Zotero.selectItems from within a translator
 */
function getItemArrayGB (doc, inHere, urlRe, rejectRe) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;
	
	var availableItems = new Object();	// Technically, associative arrays are objects
	
	// Require link to match this
	if(urlRe) {
		if(urlRe.exec) {
			var urlRegexp = urlRe;
		} else {
			var urlRegexp = new RegExp();
			urlRegexp.compile(urlRe, "i");
		}
	}
	// Do not allow text to match this
	if(rejectRe) {
		if(rejectRe.exec) {
			var rejectRegexp = rejectRe;
		} else {
			var rejectRegexp = new RegExp();
			rejectRegexp.compile(rejectRe, "i");
		}
	}
	
	if(!inHere.length) {
		inHere = new Array(inHere);
	}
	
	for(var j=0; j<inHere.length; j++) {
		var coverView = doc.evaluate('//div[@class="thumbotron"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();//Detect Cover view
		if(coverView){
			var links = inHere[j].getElementsByTagName("a");
			for(var i=0; i<links.length; i++) {
				if(!urlRe || urlRegexp.test(links[i].href)) {
					var text = links[i].textContent;
					if(!text) {
						var text = links[i].firstChild.alt;
					}
					if(text) {
						text = Zotero.Utilities.trimInternal(text);
						if(!rejectRe || !rejectRegexp.test(text)) {
							if(availableItems[links[i].href]) {
								if(text != availableItems[links[i].href]) {
									availableItems[links[i].href] += " "+text;
								}
							} else {
								availableItems[links[i].href] = text;
							}
						}
					}
				}
			}
		}
		else {
			var links = inHere[j].getElementsByTagName("img");//search for <img>-elements, scrape title from alt-attribute, href-link from parent <a>-element
			for(var i=0; i<links.length; i++) {
				if(!urlRe || urlRegexp.test(links[i].parentNode.href)) {
					var text = links[i].alt;
					if(text) {
						text = Zotero.Utilities.trimInternal(text);
						if(!rejectRe || !rejectRegexp.test(text)) {
							if(availableItems[links[i].href]) {
								if(text != availableItems[links[i].href]) {
									availableItems[links[i].href] += " "+text;
								}
							} else {
								availableItems[links[i].parentNode.href] = text;
							}
						}
					}
				}
			}
		}
	}
	
	return availableItems;
}