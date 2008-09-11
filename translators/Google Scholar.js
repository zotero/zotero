{
	"translatorID":"57a00950-f0d1-4b41-b6ba-44ff0fc30289",
	"translatorType":4,
	"label":"Google Scholar",
	"creator":"Simon Kornblith",
	"target":"http://scholar\\.google\\.(?:com|com?\\.[a-z]{2}|[a-z]{2})/scholar",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-03-28 16:30:00"
}

function detectWeb(doc, url) {
	return "multiple";
}

var haveEndNoteLinks;

function scrape(doc) {
	var nsResolver = doc.createNSResolver(doc.documentElement);
	
	var items = new Array();
	var itemGrabLinks = new Array();
	var itemGrabLink;
	var links = new Array();
	var types = new Array();
	
	var itemTypes = new Array();
	var attachments = new Array();
	
	var elmts = doc.evaluate('//p[@class="g"]', doc, nsResolver,
	                         XPathResult.ANY_TYPE, null);
	var elmt;
	var i=0;
	Zotero.debug("get elmts");
	Zotero.debug(haveEndNoteLinks);
	while(elmt = elmts.iterateNext()) {
		var isCitation = doc.evaluate("./font[1]/b[1]/text()[1]", elmt, nsResolver,
		                              XPathResult.ANY_TYPE, null).iterateNext();
		                              
		// use EndNote links if available
		if(haveEndNoteLinks) {
			itemGrabLink = doc.evaluate('.//a[contains(@href, ".enw")]',
										   elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext(); 
		} else {
			itemGrabLink = doc.evaluate('.//a[text() = "Related Articles"]',
										   elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext(); 
		}
        	
        	var noLinkRe = /^\[[^\]]+\]$/;
		
		if(itemGrabLink) {
			itemGrabLinks[i] = itemGrabLink.href;
			if(isCitation && noLinkRe.test(isCitation.textContent)) {
				// get titles for [BOOK] or [CITATION] entries
				items[i] = Zotero.Utilities.getNodeString(doc, elmt, './text()|./b/text()', nsResolver);
			} else {
				// get titles for articles
				var link = doc.evaluate('.//a', elmt, nsResolver,
										XPathResult.ANY_TYPE, null).iterateNext();
				if(link) {
					items[i] = link.textContent;
					links[i] = link.href;
				}
			}
			
			if(items[i]) {
			i++;
			}
		}
	}
	
	items = Zotero.selectItems(items);
	
	if(!items) {
		if(Zotero.done) Zotero.done(true);
		return true;
	}
	
	var relatedMatch = /[&?]q=related:([^&]+)/;
	
	var urls = new Array();
	for(var i in items) {
		// get url
		if(haveEndNoteLinks) {
			urls.push(itemGrabLinks[i]);
		} else {
			var m = relatedMatch.exec(itemGrabLinks[i]);
			urls.push("http://scholar.google.com/scholar.ris?hl=en&lr=&q=info:"+m[1]+"&oe=UTF-8&output=citation&oi=citation");
		}
		
		if(links[i]) {
			attachments.push([{title:"Google Scholar Linked Page", type:"text/html",
			                  url:links[i]}]);
		} else {
			attachments.push([]);
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("881f60f2-0802-411a-9228-ce5f47b64c7d");
	translator.setHandler("itemDone", function(obj, item) {
		item.attachments = attachments.shift();
		item.complete();
	});
	Zotero.Utilities.HTTP.doGet(urls, function(text) {
		translator.setString(text);
		translator.translate();
	}, function() { Zotero.done() });
}

function doWeb(doc, url) {
	var nsResolver = doc.createNSResolver(doc.documentElement);
	
	//SR:Will use preference setting url instead of cookie to get EndNote links (works with ezproxy, doesn't overwrite other prefs)
	//doc.cookie = "GSP=ID=deadbeefdeadbeef:IN=ebe89f7e83a8fe75+7e6cc990821af63:CF=3; domain=.scholar.google.com";
	
	// determine if we need to reload the page
	
	// first check for EndNote links
	Zotero.debug("get links");
	haveEndNoteLinks = doc.evaluate('//a[contains(@href, ".enw")]', 
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(!haveEndNoteLinks) {
			// SR:Commenting out this bit as code for retrieving citations from "Related" links is unreliable and unnecessary
			//// next check if there are docs with no related articles
			//if(doc.evaluate(''//p[@class="g"][not(descendant-or-self::text() = "Related Articles")]'',
			//	doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			
		// SR:Set preferences to show import links in English and do page reload
		// (bit of a hack as it overwrites user prefs for language and import link type)
		url = url.replace (/hl\=[^&]*&?/, "");
		url = url.replace("scholar?", "scholar_setprefs?hl=en&scis=yes&scisf=3&submit=Save+Preferences&");
		haveEndNoteLinks = true;
		Zotero.Utilities.loadDocument(url, scrape);
		Zotero.wait();
		return;
			//}
	}
	
	scrape(doc, url);
	Zotero.wait();
}