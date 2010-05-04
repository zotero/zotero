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
	"lastUpdated":"2010-05-02 15:55:00"
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
	
	var titles = doc.evaluate('//div[@class="gs_r"]//h3', doc, nsResolver, XPathResult.ANY_TYPE, null);
	
	// changing .enw to .bib
	var elmts = doc.evaluate('//a[contains(@href, "scholar.bib")]',
				doc, nsResolver, XPathResult.ANY_TYPE, null);
	var title;
	var i = 0;
	while(title = titles.iterateNext()) {		
		itemGrabLinks[i] = elmts.iterateNext().href;
		items[i] = title.textContent;
		var link = doc.evaluate('.//a',
				title, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if (link){
			links[i] = link.href;
		}
		i++;
	}
	
	items = Zotero.selectItems(items);
	
	if(!items) {
		Zotero.done(true);
		return true;
	}
	
	var urls = new Array();
	for(var i in items) {
		// get url
		urls.push(itemGrabLinks[i]);
		if(links[i]) {
			attachments.push([{title:"Google Scholar Linked Page", type:"text/html",
			                  url:links[i]}]);
		} else {
			attachments.push([]);
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	// changing this to bibtex per note below
	translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
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
	// changing to BibTeX since Google is dropping characters in enw and ris output
	
	haveEndNoteLinks = doc.evaluate('//a[contains(@href, "scholar.bib")]', 
			doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(!haveEndNoteLinks) {
			// SR:Commenting out this bit as code for retrieving citations from "Related" links is unreliable and unnecessary
			//// next check if there are docs with no related articles
			//if(doc.evaluate(''//p[@class="g"][not(descendant-or-self::text() = "Related Articles")]'',
			//	doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			
		// SR:Set preferences to show import links in English and do page reload
		// (bit of a hack as it overwrites user prefs for language and import link type)
		url = url.replace (/hl\=[^&]*&?/, "");
		// changing scisf from 3 to 4 to move from .enw to .bib
		url = url.replace("scholar?", "scholar_setprefs?hl=en&scis=yes&scisf=4&submit=Save+Preferences&");
		haveEndNoteLinks = true;
		Zotero.Utilities.loadDocument(url, scrape);
		Zotero.wait();
		return;
			//}
	}
	
	Zotero.wait();
	scrape(doc, url);
}
