{
	"translatorID":"5ae63913-669a-4792-9f45-e089a37de9ab",
	"translatorType":4,
	"label":"BAILII",
	"creator":"Bill McKinney",
	"target":"http:\\/\\/www\\.bailii\\.org(?:\\/cgi\\-bin\\/markup\\.cgi\\?doc\\=)?\\/\\w+\\/cases\\/.+",
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
	
	var liiRegexp= /^http:\/\/www\.bailii\.org(?:\/cgi\-bin\/markup\.cgi\?doc\=)?\/\w+\/cases\/.+/
	if(liiRegexp.test(url)) {
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

	var titleRegexp = /^(.+)\s+\[(\d+)\]\s+(.+)\s+\((\d+)\s+(\w+)\s+(\d+)\)/
	var titleMatch = titleRegexp .exec(doc.title);
	if (titleMatch ) {
		newItem.caseName = titleMatch[1] + " [" + titleMatch[2] + "] " + titleMatch[3];
		newItem.dateDecided = titleMatch[4] + " " + titleMatch[5] + " " + titleMatch[6];
	} else {
		newItem.caseName = doc.title;
		newItem.dateDecided = "not found";
	}

	var courtRegexp = /cases\/([^\/]+)\/([^\/]+)\//
	var courtMatch = courtRegexp.exec(doc.location.href);
	if (courtMatch) {
		var divRegexp = /\w+/
		var divMatch = divRegexp.exec(courtMatch[2]);
		if (divMatch) {
			newItem.court = courtMatch[1] + " (" + courtMatch[2] + ")";
		} else {
			newItem.court = courtMatch[1];
		}
	} else {
		newItem.court = "not found";
	}
	
	// judge
	var panel = doc.getElementsByTagName("PANEL");
	if (panel.length > 0) {
		var tmp = panel[0].innerHTML;
		newItem.creators.push({lastName:tmp, creatorType:"judge", fieldMode:true});
		
	}
	// citation
	var cite = doc.getElementsByTagName("CITATION");
	if (cite.length > 0) {
		var tmpc = cite[0].childNodes[0].innerHTML;
		newItem.notes.push({note:tmpc});
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var liiRegexp= /http:\/\/www\.bailii\.org(?:\/cgi\-bin\/markup\.cgi\?doc\=)?\/\w+\/cases\/.+/
	if(liiRegexp.test(url)) {
		scrape(doc);
	} else {
		
		var items = Zotero.Utilities.getItemArray(doc, doc, liiRegexp);
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