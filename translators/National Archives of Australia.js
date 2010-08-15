{
        "translatorID":"50a4cf3f-92ef-4e9f-ab15-815229159b16",
        "label":"National Archives of Australia",
        "creator":"Tim Sherratt",
        "target":"^http://[^/]*naa\\.gov\\.au/",
        "minVersion":"1.0",
        "maxVersion":"",
        "priority":100,
        "inRepository":yes,
        "translatorType":4,
        "lastUpdated":"2010-08-12 15:38:20"
}

function detectWeb(doc, url) {
	//RecordSearch - items and series - or Photosearch results
    if (url.match(/SeriesListing.asp/i) || url.match(/ItemsListing.asp/i) || url.match(/PhotoSearchSearchResults.asp/i)) {
        return "multiple";
    } else if (url.match(/SeriesDetail.asp/i) || url.match(/ItemDetail.asp/i) || url.match(/PhotoSearchItemDetail.asp/i) || url.match(/imagine.asp/i)) {
    	return "manuscript";
    }
}
function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	// If it's a single page of a digitised file, then send it to be processed directly.
	// This is because digitised pages, after the first, are retrieved via POST, thus if you feed the url to processDocuments
	// you'll only ever get the first page.
	if (url.match(/imagine.asp/i)) {
		processFolio(doc);
		Zotero.done();
	// Everything else can be handled normally.
	} else {
		// To avoid cross domain errors find baseurl
		var baseURL = doc.location.href.match(/(http:\/\/[a-z0-9]+\.naa\.gov\.au)/)[1];
		var records = new Array();
		var titles, links, title, link;
		if (detectWeb(doc, url) == "multiple") {
			var items = new Object();
			// Files
			if (url.match(/ItemsListing.asp/i)) {
				titles = doc.evaluate('//td[4][@title="Go to Item details"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
				links = doc.evaluate('//td[4][@title="Go to Item details"]/@onclick', doc, nsResolver, XPathResult.ANY_TYPE, null);
				// Photos
			} else if (url.match(/PhotoSearchSearchResults.asp/i)) {
				titles = doc.evaluate('//td[b="Title :"]/a[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
				links = doc.evaluate('//td[b="Title :"]/a[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
				//Series
			} else if (url.match(/SeriesListing.asp/i)) {
				titles = doc.evaluate('//td[3][@title="Go to Series details"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
				links = doc.evaluate('//td[3][@title="Go to Series details"]/@onclick', doc, nsResolver, XPathResult.ANY_TYPE, null);
			}
			while ((title = titles.iterateNext()) && (link = links.iterateNext())) {
				if (url.match(/PhotoSearchSearchResults.asp/i)) {
					items[link.href] = Zotero.Utilities.trimInternal(title.lastChild.textContent);
				} else {
					items[baseURL + '/SearchNRetrieve/Interface' + link.textContent.match(/window\.location = '\.\.(.+?)'/)[1]] = Zotero.Utilities.trimInternal(title.firstChild.textContent);
				}
			}
			items = Zotero.selectItems(items);
			for (var i in items) {
				records.push(i);
			}
		} else {
			records = [url];
		}
		Zotero.Utilities.processDocuments(records, scrape, function(){Zotero.done();});
		Zotero.wait();
	}
}
function processFolio(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	// To avoid cross-domain problems, find the base url
	var baseURL = doc.location.href.match(/(http:\/\/[a-z0-9]+\.naa\.gov\.au)/)[1];
	var item = new Zotero.Item("manuscript");
	item.archive = "National Archives of Australia";
	item.libraryCatalog = "RecordSearch";
	var barcode, page, numPages;
	// Using my Greasemonkey interface
	if (doc.body.innerHTML.match(/Digital copy of NAA:/)) {
		doc.evaluate('//img[@id="fileimage"]/@src', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent.match(/B=(\d+)&S=(\d+)&/);
		barcode = RegExp.$1;
		page = RegExp.$2;
		numPages = Zotero.Utilities.trimInternal(doc.evaluate('//input[@id="printto"]/@value', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
	// Using the original RS interface
	} else {
		barcode = Zotero.Utilities.trimInternal(doc.evaluate('//input[@id="Hidden1"]/@value', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
		page = Zotero.Utilities.trimInternal(doc.evaluate('//input[@id="Text1"]/@value', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
		numPages = Zotero.Utilities.trimInternal(doc.evaluate('//input[@id="Hidden3"]/@value', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
	}
	item.manuscriptType = 'folio';
	item.pages = page;
	item.numPages = numPages;
	// The link to the image file - there's no way to link to the image in the context of the file
	item.url = 'http://recordsearch.naa.gov.au/NaaMedia/ShowImage.asp?B=' + barcode + '&S=' + item.pages + '&T=P';
	// Retrieve file details and extract reference details
	var itemURL = baseURL + '/SearchNRetrieve/Interface/DetailsReports/ItemDetail.aspx?Barcode=' + barcode;
	var itemDoc = Zotero.Utilities.retrieveDocument(itemURL);
	var series = Zotero.Utilities.trimInternal(itemDoc.evaluate('//td[@class="field"][. ="Series number"]/following-sibling::td/a', itemDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
	var control = Zotero.Utilities.trimInternal(itemDoc.evaluate('//td[@class="field"][. ="Control symbol"]/following-sibling::td', itemDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
	var refNumber = series + ", " + control;
	item.title = 'Page ' + page + ' of NAA: ' + refNumber;
	item.archiveLocation = refNumber;
	// Save a copy of the image
	item.attachments = [{url:item.url, title:'Digital copy of NAA: ' + refNumber + ', p. ' + page, mimeType:"image/jpeg" }];
	// MACHINE TAGS
	// The file of which this page is a part.
	item.tags.push('dcterms:isPartOf="http://www.naa.gov.au/cgi-bin/Search?O=I&Number=' + barcode + '"');
	// Citation
	item.tags.push('dcterms:bibliographicCitation="NAA: ' + refNumber + ', p. ' + page + '"');
	item.tags.push('xmlns:dcterms="http://purl.org/dc/terms/"');
	item.complete();
	Zotero.wait();
}
function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	// To avoid cross-domain problems, find the base url
	var baseURL = doc.location.href.match(/(http:\/\/[a-z0-9]+\.naa\.gov\.au)/)[1];
	var item = new Zotero.Item("manuscript");
	item.archive = "National Archives of Australia";
	// Photosearch item
	if (doc.location.href.match(/PhotoSearchItemDetail.asp/i)) {
		var tags = new Array();
		item.libraryCatalog = "PhotoSearch";
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//b[. ="Title :"]/following-sibling::text()[1]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
		item.manuscriptType = "photograph";
		var barcode = Zotero.Utilities.trimInternal(doc.evaluate('//b[. ="Barcode : "]/following-sibling::text()[1]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
		var series = Zotero.Utilities.trimInternal(doc.evaluate('//b[. ="Find other items in this series :"]/following-sibling::a/text()[1]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
		var refNumber = Zotero.Utilities.trimInternal(doc.evaluate('//b[. ="Image no. :"]/following-sibling::text()[1]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
		item.archiveLocation = refNumber;
		item.url = "http://www.naa.gov.au/cgi-bin/Search?O=PSI&Number=" + barcode;
		if (doc.evaluate('//b[. ="Date :"]/following-sibling::text()[1]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null) {
			item.date = Zotero.Utilities.trimInternal(doc.evaluate('//b[. ="Date :"]/following-sibling::text()[1]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
		}
		if (doc.evaluate('//b[. ="Location : "]/following-sibling::text()[1]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null) {
			item.place = Zotero.Utilities.trimInternal(doc.evaluate('//b[. ="Location : "]/following-sibling::text()[1]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
		}
		// Save subjects as tags
		subjects = new Array();
		subjects.push(Zotero.Utilities.trimInternal(doc.evaluate('//b[. ="Primary subject :"]/following-sibling::*[1]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent).toLowerCase());
		subjects.push(Zotero.Utilities.trimInternal(doc.evaluate('//b[. ="Secondary subject :"]/following-sibling::*[1]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent).toLowerCase());
		for (var i in subjects) {
			if (subjects[i] != '') {
				item.tags.push(subjects[i]);
			}
		}
		// Citation
		item.tags.push('dcterms:bibliographicCitation="NAA: ' + refNumber + '"');
		// Save barcode as identifier
		item.tags.push('dcterms:identifier="' + barcode + '"');
		// Series of which this is a member
		item.tags.push('dcterms:isPartOf="http://www.naa.gov.au/cgi-bin/Search?Number=' + series + '"');
		// Same file in RecordSearch
		item.tags.push('owl:sameAs="http://www.naa.gov.au/cgi-bin/Search?O=I&Number=' + barcode + '"');
		// Namespace declarations
		item.tags.push('xmlns:dcterms="http://purl.org/dc/terms/"');
		item.tags.push('xmlns:owl="http://www.w3.org/2002/07/owl#"');
		// Attach copy of photo as attachment
		var imgURL = "http://recordsearch.naa.gov.au/NaaMedia/ShowImage.asp?B=" + barcode + "&S=1&T=P";
		item.attachments = [{url:imgURL, title:"Digital image of NAA: "+ item.archiveLocation, mimeType:"image/jpeg" }];
	} else if (doc.location.href.match(/SeriesDetail.asp/i)) {
		item.libraryCatalog = "RecordSearch";
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][. ="Title"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
		var refNumber = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][. ="Series number"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
		item.archiveLocation = refNumber;
		item.manuscriptType = "series";
		// Link into RecordSearch
		item.url = "http://www.naa.gov.au/cgi-bin/Search?Number=" + refNumber;
		// Contents dates
		item.date = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][. ="Contents dates "]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
		// Agencies recording into this series
		var agencies = doc.evaluate('//div[@id="provenanceRecording"]/ul/li/div[@class="linkagesInfo"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		while (agency = agencies.iterateNext()) {
			item.creators.push({lastName: agency.textContent, creatorType: "creator"});
		}
		// Save series note as abstract
		if (doc.evaluate('//div[@id="notes"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null) {
			item.abstractNote = Zotero.Utilities.cleanTags(Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="notes"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent));
		}
		// MACHINE TAGS
		// Format
		if (doc.evaluate('//td[@class="field"][div="Predominant physical format"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ANY_TYPE, null) != null) {
			item.tags.push('dcterms:format="' + Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][div="Predominant physical format"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent) + '"');
		}
		// Number of items described on RecordSearch
		if (doc.evaluate('//td[@class="field"][. ="Items in this series on RecordSearch"]/following-sibling::td/a', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent != '') {
			item.tags.push('dcterms:extent="' + Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][. ="Items in this series on RecordSearch"]/following-sibling::td/a', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent) + ' items described"');
		}
		// Quantities and locations
		var quantities = doc.evaluate('//td[@class="field"][. ="Quantity and location"]/following-sibling::td/ul/li', doc, nsResolver, XPathResult.ANY_TYPE, null);
		while (quantity = quantities.iterateNext()) {
			item.tags.push('dcterms:extent="' +quantity.textContent + '"');
		}
		// Citation
		item.tags.push('dcterms:bibliographicCitation="NAA: ' + refNumber + '"');
		// Declare dcterms namespace
		item.tags.push('xmlns:dcterms="http://purl.org/dc/terms/"');
	} else if (doc.location.href.match(/ItemDetail.asp/i)) {
		item.manuscriptType = 'file';
		item.libraryCatalog = "RecordSearch";
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][. ="Title"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
		var series = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][. ="Series number"]/following-sibling::td/a', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
		var control = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][. ="Control symbol"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
		var refNumber = series + ', ' + control;
		item.archiveLocation = refNumber;
		var barcode = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][. ="Item barcode"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
		// Link into RecordSearch
		item.url = "http://www.naa.gov.au/cgi-bin/Search?O=I&Number=" + barcode;
		// Contents dates
		item.date = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][. ="Contents date range"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
		// Location
		if (doc.evaluate('//td[@class="field"][. ="Location"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null) {
			item.place = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][. ="Location"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
		}
		// Save item note as abstract
		if (doc.evaluate('//div[@id="notes"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null) {
			item.abstractNote = Zotero.Utilities.cleanTags(Zotero.Utilities.trimInternal(doc.evaluate('//div[@id="notes"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent));
		}
		// MACHINE TAGS
		// The series this item belongs to
		item.tags.push('dcterms:isPartOf="http://www.naa.gov.au/cgi-bin/Search?Number=' + series + '"');
		// Citation
		item.tags.push('dcterms:bibliographicCitation="NAA: ' + refNumber + '"');
		// Save the barcode as an identifier
		item.tags.push('dcterms:identifier="' + barcode + '"');
		// Access status
		item.tags.push('dcterms:accessRights="' + Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][. ="Access status"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent) + '"');
		// Format
		if (doc.evaluate('//td[@class="field"][div="Physical format"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null) {
			item.tags.push('dcterms:format="' + Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="field"][div="Physical format"]/following-sibling::td', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent) + '"');
		}
		// Is there a digital copy? - if so find the number of pages in the digitised file
		if (doc.evaluate('//a[. ="View digital copy "]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue != null) {
			itemURL = baseURL + "/scripts/Imagine.asp?B=" + barcode;
			// Retrieve the digitised file
			itemDoc = Zotero.Utilities.retrieveDocument(itemURL);
			item.numPages =Zotero.Utilities.trimInternal(itemDoc.evaluate('//input[@id="Hidden3"]/@value', itemDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
		}
		// Declare dcterms namespace
		item.tags.push('xmlns:dcterms="http://purl.org/dc/terms/"');
	}
	item.complete();
}

