{
	"translatorID":"c73a4a8c-3ef1-4ec8-8229-7531ee384cc4",
	"translatorType":4,
	"label":"Open WorldCat (Web)",
	"creator":"Sean Takats",
	"target":"^http://(?:www\\.)?worldcat\\.org/(?:search\\?|profiles/[^/]+/lists/)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-11-05 18:00:00"
}

function detectWeb(doc, url){
	var nsResolver = doc.createNSResolver(doc.documentElement);

	var xpath = '//table[@class="tableResults" or @class="table-results"]/tbody/tr/td[3][@class="result"]/div[@class="name"]/a/strong';
	var results = doc.evaluate(xpath, doc,
			       nsResolver, XPathResult.ANY_TYPE, null);
	if(results.iterateNext()) {
		return "multiple";
	}
}

function processOWC(doc) {
	var spanTags = doc.getElementsByTagName("span");
	for(var i=0; i<spanTags.length; i++) {
		var spanClass = spanTags[i].getAttribute("class");
		if(spanClass) {
			var spanClasses = spanClass.split(" ");
			if(Zotero.Utilities.inArray("Z3988", spanClasses)) {
				var spanTitle = spanTags[i].getAttribute("title");
				var item = new Zotero.Item();
				if(Zotero.Utilities.parseContextObject(spanTitle, item)) {
					if(item.title) {
						item.title = Zotero.Utilities.capitalizeTitle(item.title);
					} else {
						item.title = "[Untitled]";
					}
					
					item.complete();
					return true;
				} else {
					return false;
				}
			}
		}
	}
	
	return false;
}

function doWeb(doc, url){
	var nsResolver = doc.createNSResolver(doc.documentElement);

	var urls = new Array();
	var items = new Array();
	var xpath = '//table[@class="tableResults" or @class="table-results"]/tbody/tr/td[3][@class="result"]/div[@class="name"]/a';
	var titles = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var title;
	// Go through titles
	while(title = titles.iterateNext()) {
		items[title.href] = title.textContent;
	}

	items = Zotero.selectItems(items);

	if(!items) {
		return true;
	}

	for(var i in items) {
		urls.push(i);
	}

	Zotero.Utilities.processDocuments(urls, function(doc) {
		processOWC(doc);}, function() {Zotero.done();});
	Zotero.wait();
}