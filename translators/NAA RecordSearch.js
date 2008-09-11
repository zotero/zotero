{
	"translatorID":"83538f48-906f-40ef-bdb3-e94f63676307",
	"translatorType":4,
	"label":"NAA RecordSearch",
	"creator":"Tim Sherratt",
	"target":"http://naa12.naa.gov.au/scripts/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-30 08:00:00"
}

function detectWeb(doc, url) {
    if (url.match(/Items_listing.asp/i)) {
        return "multiple";
    } else if (url.match(/ItemDetail.asp/i)) {
	return "manuscript";
    }
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
	if (detectWeb(doc, url) == "multiple") {
		var records = new Array();
		var items = new Object();
		var titles = doc.evaluate('//form[2]/table/tbody/tr/td[b="Title"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var links = doc.evaluate('//form[2]/table/tbody/tr/td[b="Control symbol"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		var link;
		while ((title = titles.iterateNext()) && (link = links.iterateNext())) {
			items[link.href] = Zotero.Utilities.trimInternal(title.lastChild.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			records.push(i);
		}
	} else {
		records = [url]; 
	}
	Zotero.Utilities.processDocuments(records, function(doc) {
		var title = Zotero.Utilities.cleanString(doc.evaluate('//table/tbody/tr/td[b="Title"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().lastChild.textContent);
		var series = Zotero.Utilities.cleanString(doc.evaluate('//table/tbody/tr/td[b="Series number"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().lastChild.textContent);
		var control = Zotero.Utilities.cleanString(doc.evaluate('//table/tbody/tr/td[b="Control symbol"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().lastChild.textContent);
		var date = Zotero.Utilities.cleanString(doc.evaluate('//table/tbody/tr/td[b="Contents date range"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().lastChild.textContent);
		var access = Zotero.Utilities.cleanString(doc.evaluate('//table/tbody/tr/td[b="Access status"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().lastChild.textContent);
		var location = Zotero.Utilities.cleanString(doc.evaluate('//table/tbody/tr/td[b="Location"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().lastChild.textContent);
		var barcode = Zotero.Utilities.cleanString(doc.evaluate('//table/tbody/tr/td[b="Barcode"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().lastChild.textContent);
		if (doc.body.innerHTML.match("View digital copy")) {
			var digitised = "yes";
		} else {
			var digitised = "no";
		}
		var repository ="National Archives of Australia, " + location;
		var url = "http://www.aa.gov.au/cgi-bin/Search?O=I&Number=" + barcode;
		var ref_number = series + ", " + control;
		var type = "file";
		var item = new Zotero.Item("manuscript");
		item.title = title;
		item.archiveLocation = ref_number;
		item.url = url;
		item.date = date;
		item.manuscriptType = type;
		item.extra = "Access: " + access + "\nDigitised: " + digitised;
		item.repository = repository;
		item.complete();
		
	}, function() {Zotero.done;});
}