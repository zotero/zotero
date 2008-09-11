{
	"translatorID":"84799379-7bc5-4e55-9817-baf297d129fe",
	"translatorType":4,
	"label":"CanLII",
	"creator":"Bill McKinney",
	"target":"http:\\/\\/www\\.canlii\\.org\\/en\\/[^\\/]+\\/[^\\/]+\\/doc\\/.+",
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
	
	var canLiiRegexp = /http:\/\/www\.canlii\.org\/en\/[^\/]+\/[^\/]+\/doc\/.+/
	if(canLiiRegexp .test(url)) {
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


function associateMeta(newItem, metaTags, field, zoteroField) {
	var field = metaTags.namedItem(field);
	if(field) {
		newItem[zoteroField] = field.getAttribute("content");
	}
}

function scrape(doc) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var newItem = new Zotero.Item("case");
	
	var metaTags = doc.getElementsByTagName("meta");
	associateMeta(newItem, metaTags, "DC.Title", "title");
	associateMeta(newItem, metaTags, "DC.Date", "dateDecided");
	associateMeta(newItem, metaTags, "DC.Language", "language");
	newItem.url = doc.location.href;
	
	var field = metaTags.namedItem("DC.Title");
	var tmpText = "";
	if(field) {
		tmpText = field.getAttribute("content");
		var capRe = /^(.+),\s+(\d{4})\s+(\w+)\s+(\d+)\s+\(([^\)]+)\)/;
			var m = capRe.exec(tmpText);
			if(m) {
				
				newItem.caseName = m[1]+", "+m[2]+" "+m[3]+" "+m[4];
				if (m[3] == 'CanLII') {
					newItem.court = m[5];
				} else {
					newItem.court = m[3];
				}
				
			} else {
				newItem.caseName = tmpText;
				newItem.court = "not found";
			}
	}
	
	
	
	// attach link to pdf version
	// NOTE: not working - don't know why
	var pdfRe = /^(.+)\.html$/;
	var pdfMatch = pdfRe.exec(doc.location.href);
	if (pdfMatch) {
		var pdfUrl = pdfMatch[1]+".pdf";
		newItem.attachments = [{url:pdfUrl, title:"PDF version", mimeType:"application/pdf"}];
	}
	
	newItem.complete();
}

function doWeb(doc, url) {
	var canLiiRegexp= /http:\/\/www\.canlii\.org\/en\/[^\/]+\/[^\/]+\/doc\/.+/
	if(canLiiRegexp.test(url)) {
		scrape(doc);
	} else {
		
		var items = Zotero.Utilities.getItemArray(doc, doc, canLiiRegexp);
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