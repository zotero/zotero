{
	"translatorID":"50a4cf3f-92ef-4e9f-ab15-815229159b16",
	"translatorType":4,
	"label":"National Archives of Australia",
	"creator":"Tim Sherratt",
	"target":"^http://[^/]*naa.gov.au/",
	"minVersion":"1.0",
	"maxVersion":"",
	"priority":90,
	"inRepository":false,
	"lastUpdated":"2009-12-17 09:35:00"
}

function detectWeb(doc, url) {
	//RecordSearch - items and series - or Photosearch results
    if (url.match(/Series_listing.asp/i) || url.match(/Items_listing.asp/i) || url.match(/PhotoSearchSearchResults.asp/i)) {
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
	
	// To avoid cross domain errors make sure links match current sub-domain
	if (url.match(/naa12/i)) {
		baseURL = "http://naa12.naa.gov.au/scripts/";
	} else if (url.match(/recordsearch/i)) {
		baseURL = "http://recordsearch.naa.gov.au/scripts/";
	}
	var records = new Array();
	var titles, links, title, link;
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		// Files
		if (url.match(/Items_listing.asp/i)) {
			titles = doc.evaluate('//td[b="Title"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			links = doc.evaluate('//td[b="Control symbol"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
			// Photos
		} else if (url.match(/PhotoSearchSearchResults.asp/i)) {
			titles = doc.evaluate('//td[b="Title :"]/a[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			links = doc.evaluate('//td[b="Title :"]/a[1]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			//Series
		} else if (url.match(/Series_listing.asp/i)) {
			titles = doc.evaluate('//td[b="Title"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			links = doc.evaluate('//td[b="Series number"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		while ((title = titles.iterateNext()) && (link = links.iterateNext())) {
			items[link.href] = Zotero.Utilities.trimInternal(title.lastChild.textContent);
			Zotero.debug(title.lastChild.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			records.push(i);
		}
	} else {
		records = [url];
	}
	var setupCallback = function () {
		if (records.length) {
			var item = new Zotero.Item("manuscript");
			item.repository = "National Archives of Australia";
			var record = records.shift();
			Zotero.debug(record);
			var postString;
			// Scrape digital image - ie a single folio - details
			if (record.match(/Imagine.asp/i)) {
				// You're using my Greasemonkey script to view images
				var b, i, c;
				if (doc.body.innerHTML.match(/Digital copy of NAA:/)) {
					doc.evaluate('//img[@id="fileimage"]/@src', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent.match(/B=(\d+)&S=(\d+)&/);
					b = RegExp.$1;
					i = RegExp.$2;
					c = Zotero.Utilities.trimInternal(doc.evaluate('//input[@id="printto"]/@value', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
					// You're using the original RS interface
				} else {
					b = Zotero.Utilities.trimInternal(doc.evaluate('//input[@id="Hidden1"]/@value', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
					i = Zotero.Utilities.trimInternal(doc.evaluate('//input[@id="Text1"]/@value', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
					c = Zotero.Utilities.trimInternal(doc.evaluate('//input[@id="Hidden3"]/@value', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
				}
				postString = "B=" + b + "&C=" + c + "&F=1&I=" + i + "&L=Y&M=R&MX=Y&S=Y&SE=1&X=N";
				Zotero.Utilities.HTTP.doPost(record, postString, function (text) {
						// This is a digital image -- ie a folio
						var barcode = text.match(/Digital copy of item with barcode\s+(\d+)/)[1];
						Zotero.debug(barcode);
						item.pages = text.match(/NAME="I" VALUE="(\d+)"/)[1];
						item.numPages = text.match(/NAME="C" VALUE="(\d+)"/)[1];
						item.url = "http://naa16.naa.gov.au/rs_images/ShowImage.php?B=" + barcode + "&S=" + item.pages + "&T=P";
						var itemURL = baseURL + "ItemDetail.asp?M=0&B=" + barcode;
						item.manuscriptType = 'folio';
						Zotero.Utilities.processDocuments(itemURL, function(itemDoc) {
								var series = Zotero.Utilities.trimInternal(itemDoc.evaluate('//td[b="Series number"]', itemDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
								var control = Zotero.Utilities.trimInternal(itemDoc.evaluate('//td[b="Control symbol"]', itemDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
								var refNumber = series + ", " + control;
								item.archiveLocation = refNumber;
								item.title = "Page " + item.pages + " of NAA: "+refNumber;
								item.shortTitle = "NAA: " + refNumber;
								item.attachments = 	[{url:item.url, title:"Digital image of NAA: " + refNumber + ", page " + item.pages, mimeType:"image/jpeg" }];
								item.complete();
								setupCallback();
						});
				}); 
				// Scrape photo details
			} else if (record.match(/PhotoSearchItemDetail.asp/)) {
				Zotero.Utilities.HTTP.doGet(record, function (text) {
						// Clean up unpredictable linebreaks and tabs
						text = text.replace(/\n/gm, "");
						text = text.replace(/\r/gm, "");
						text = text.replace(/\t/gm, "");
						item.title = Zotero.Utilities.trimInternal(text.match(/<b>Title :<\/b>(.*?)<br/)[1]);
						item.date = Zotero.Utilities.trimInternal(text.match(/<b>Date :<\/b>(.*?)<br/)[1]);
						item.archiveLocation = Zotero.Utilities.trimInternal(text.match(/<b>Image no. :<\/b>(.*?)<br/)[1]);
						var barcode = Zotero.Utilities.trimInternal(text.match(/<b>Barcode : <\/b>(.*?)<br/)[1]);
						var location = Zotero.Utilities.trimInternal(text.match(/<b>Location : <\/b>(.*?)<br/)[1]);
						if (!text.match(/<b>Primary subject :<\/b>.*?Not Assigned/)) { var tag1 = text.match(/<b>Primary subject :<\/b>.*?<a href.*?>(.*?)<\/a>/)[1]};
						if (!text.match(/<b>Secondary subject :<\/b>.*?Not Assigned/)) { var tag2 = text.match(/<b>Secondary subject :<\/b>.*?<a href.*?>(.*?)<\/a>/)[1]};
						if (tag1) { item.tags.push(Zotero.Utilities.trimInternal(tag1).toLowerCase()) };
						if (tag2) { item.tags.push(Zotero.Utilities.trimInternal(tag2).toLowerCase()) };
						var imgURL = "http://naa16.naa.gov.au/rs_images/ShowImage.php?B=" + barcode + "&T=P&S=1";
						item.url = "http://www.naa.gov.au/cgi-bin/Search?O=PSI&Number=" + barcode;
						item.manuscriptType = "photograph";
						Zotero.debug(item.tags);
						// Save a copy of the photo
						item.attachments = [{url:imgURL, title:"Digital image of NAA: "+ item.archiveLocation, mimeType:"image/jpeg" }];
						item.complete();
						setupCallback();
				});
				// Scrape series details
			} else if (record.match(/SeriesDetail.asp/i)) {
				Zotero.Utilities.processDocuments(record, function (doc) {
						item.title = Zotero.Utilities.trimInternal(doc.evaluate('//td[b="Title"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
						item.archiveLocation = Zotero.Utilities.trimInternal(doc.evaluate('//td[b="Series number"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
						item.date = Zotero.Utilities.trimInternal(doc.evaluate('//td[b="Accumulation dates"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
						var location = doc.evaluate('//td[b="Quantity and location"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
						if (location) {
							location = location.textContent.replace(/Quantity and location/i, "").replace(/\s([\w]+)([\d]+\.*\d*)/gi, " $1; $2");
						}
						Zotero.debug(location);
						var agencies = doc.evaluate('//td[b="Agency / person recording"]/table/tbody/tr/td[2]', doc, nsResolver, XPathResult.ANY_TYPE, null);
						while (agency = agencies.iterateNext()) {
							item.creators.push({lastName: agency.textContent, creatorType: "creator"});
						}
						item.url = "http://www.naa.gov.au/cgi-bin/Search?Number=" + item.archiveLocation;
						item.manuscriptType = "series";
						// Find out how many items from this series have been described on RecordSearch
						var itemsURL = baseURL + "SearchOF.asp?DP=2&Q=SER_SERIES_NO=QT" + item.archiveLocation + "QT";
						Zotero.Utilities.processDocuments(itemsURL, function(itemDoc) {
								var numItems = Zotero.Utilities.trimInternal(itemDoc.evaluate('//tr[2]/td[2]', itemDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
								Zotero.debug(numItems);
								if (numItems == "No records found") {
									numItems = "none";
								}
								item.extra = "Quantity and location: " + location + "\nNumber of items described: " + numItems;
								item.complete();
								setupCallback();
						});
				});
				// Scrape file details
			} else if (record.match(/ItemDetail.asp/i)) {
				Zotero.Utilities.processDocuments(record, function (doc) {
						item.title = Zotero.Utilities.trimInternal(doc.evaluate('//td[b="Title"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
						var series = Zotero.Utilities.trimInternal(doc.evaluate('//td[b="Series number"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
						var control = Zotero.Utilities.trimInternal(doc.evaluate('//td[b="Control symbol"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
						item.date = Zotero.Utilities.trimInternal(doc.evaluate('//td[b="Contents date range"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
						var access = Zotero.Utilities.trimInternal(doc.evaluate('//td[b="Access status"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
						var location = Zotero.Utilities.trimInternal(doc.evaluate('//td[b="Location"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
						var barcode = Zotero.Utilities.trimInternal(doc.evaluate('//td[b="Barcode"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.lastChild.textContent);
						// Has the file been digitised?
						if (doc.body.innerHTML.match("View digital copy")) {
							var digitised = "yes";
						} else {
							var digitised = "no";
						}
						item.url = "http://www.naa.gov.au/cgi-bin/Search?O=I&Number=" + barcode;
						item.archiveLocation = series + ", " + control;
						item.manuscriptType = "file";
						item.extra = "Location: " + location + "\nAccess: " + access + "\nDigitised: " + digitised;
						// If it's digitised find out how many pages in the digitised file
						itemURL = baseURL + "imagine.asp?B=" + barcode + "&I=1&SE=1";
						if (digitised == "yes") {
							Zotero.Utilities.processDocuments(itemURL, function(itemDoc) {
									var pages = Zotero.Utilities.trimInternal(itemDoc.evaluate('//input[@id="Hidden3"]/@value', itemDoc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent);
									item.numPages = "1-" + pages;
									item.pages = "1-" + pages;
									item.complete();
									setupCallback();
							});
						} else {
							item.complete();
							setupCallback();
						}
				});
			}
		} else {
			Zotero.done();
		}
	}
	setupCallback();
	Zotero.wait();
}

