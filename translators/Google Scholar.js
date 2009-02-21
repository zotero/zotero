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
	"lastUpdated":"2009-02-21 07:30:00"
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
	
	var titles = doc.evaluate('//h3[@class="r"]', doc, nsResolver,
				XPathResult.ANY_TYPE, null);
	var elmts = doc.evaluate('//a[contains(@href, ".enw")]',
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
		if(Zotero.done) Zotero.done(true);
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