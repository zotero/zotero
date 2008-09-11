{
	"translatorID":"5ed5ab01-899f-4a3b-a74c-290fb2a1c9a4",
	"translatorType":4,
	"label":"AustLII and NZLII",
	"creator":"Bill McKinney",
	"target":"http:\\/\\/www\\.(?:austlii\\.edu\\.au|nzlii\\.org)\\/(?:\\/cgi-bin\\/disp\\.pl\\/)?(?:au|nz)\\/cases\\/.+",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-06-18 18:15:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var austliiRegexp = /^http:\/\/www\.(?:austlii\.edu\.au|nzlii\.org)\/(?:\/cgi-bin\/disp\.pl\/)?(?:au|nz)\/cases\/.+/
	if(austliiRegexp.test(url)) {
		return "book";
	} else {
		var aTags = doc.getElementsByTagName("a");
		for(var i=0; i<aTags.length; i++) {
			if(articleRegexp.test(aTags[i].href)) {
				return "multiple";
			}
		}
	}
}


function scrape(doc) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("case");
	newItem.title = doc.title;
	newItem.url = doc.location.href;

	var titleRegexp = /^(.+)\s+\[(\d+)\]\s+(\w+)\s(\d+)\s+\((\d+)\s+(\w+)\s+(\d+)\)/
	var titleMatch = titleRegexp .exec(doc.title);
	if (titleMatch ) {
		newItem.caseName = titleMatch[1] + " [" + titleMatch[2] + "] " + titleMatch[3] + " " + titleMatch[4];
		newItem.dateDecided = titleMatch[7] + " " + titleMatch[6] + " " + titleMatch[5];
		newItem.court = titleMatch[3];	
	} else {
		newItem.caseName = doc.title;
		newItem.dateDecided = "not found";
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var austliiRegexp = /^http:\/\/www\.(?:austlii\.edu\.au|nzlii\.org)\/(?:\/cgi-bin\/disp\.pl\/)?(?:au|nz)\/cases\/.+/
	if(austliiRegexp.test(url)) {
		scrape(doc);
	} else {
		
		var items = Zotero.Utilities.getItemArray(doc, doc, austliiRegexp);
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var urls = new Array();
		for(var i in items) {
			urls.push(i);
		}
		
		Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); });
		Zotero.wait();
	}
}