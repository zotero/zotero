{
	"translatorID": "5eacdb93-20b9-4c46-a89b-523f62935ae4",
	"label": "HighWire",
	"creator": "Simon Kornblith",
	"target": "^http://[^/]+/(?:cgi/searchresults|cgi/search|cgi/content/(?:abstract|full|short|summary)|current.dtl$|content/vol[0-9]+/issue[0-9]+/(?:index.dtl)?$)",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2011-07-03 03:57:15"
}

function detectWeb(doc, url) {
	if(doc.title.indexOf(" -- Search Result") !== -1) {
		if(doc.evaluate('//table/tbody/tr[td/input[@type="checkbox"][@name="gca"]]', doc,
			null, XPathResult.ANY_TYPE, null).iterateNext()) return "multiple";
	} else if(doc.title.indexOf(" -- Table of Contents") != -1) {
		if(doc.evaluate('//form/dl', doc, null, XPathResult.ANY_TYPE,null).iterateNext()) return "multiple";
	} else {
		if(doc.evaluate('//a[substring(@href, 1, 16) = "/cgi/citmgr?gca="]', doc, null,
			XPathResult.ANY_TYPE, null).iterateNext()) return "journalArticle";
	}
	
	return false;
}

function handleRequests(requests) {
	if(requests.length == 0) {
		Zotero.done();
		return;
	}
	
	var request = requests.shift();
	var URL = request.baseURL+request.args;
	
	Zotero.Utilities.HTTP.doGet(URL, function(text) {
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			if(item.notes[0]) {
				item.DOI = Zotero.Utilities.unescapeHTML(item.notes[0].note);
				item.notes = new Array();
			}
			
			item.attachments = new Array();
			var snapshot = request.snapshots.shift();
			var pdf = request.pdfs.shift();
			if(snapshot) {
				if(typeof(snapshot) == "string") {
					// string snapshot (from search)
					item.attachments.push({title:"HighWire Snapshot", mimeType:"text/html", url:snapshot});
				} else {
					// document object
					item.attachments.push({title:"HighWire Snapshot", document:snapshot});
				}
			}
			if(pdf) {
				var m = pdf.match(/^[^?]+/);
				item.attachments.push({title:"HighWire Full Text PDF", mimeType:"application/pdf", url:m[0]+".pdf"});
			}
			
			item.complete();
		});
		translator.translate();
		
		handleRequests(requests);
	});
}

function doWeb(doc, url) {
	var requests = new Array();
	var hostRe = /https?:\/\/[^\/]+/;
	
	var isSearch = doc.title.indexOf("Search Result") != -1
	var isTOC = doc.title.indexOf(" -- Table of Contents") != -1;
	var isScience = doc.title.indexOf("Science Magazine Search Results") != -1;
	if(isSearch || isTOC) {
		// search page
		var items = new Object();
		var snapshots = new Object();
		var pdfs = new Object();
		
		if(isTOC) {
			var gcaRe = /^https?:\/\/[^\/]+\/cgi\/reprint\/([0-9]+\/[0-9]+\/[0-9]+)/;
			var tableRows = doc.evaluate('//form/dl', doc, null, XPathResult.ANY_TYPE, null);
		} else if(isScience) {
			var tableRows = doc.evaluate('//form/dl/dd', doc, null, XPathResult.ANY_TYPE, null);
			var tableDTs = doc.evaluate('//form/dl/dt', doc, null, XPathResult.ANY_TYPE, null);
		} else {
			var tableRows = doc.evaluate('//table/tbody/tr[td/input[@type="checkbox"]][td/font/strong]', doc,
				null, XPathResult.ANY_TYPE, null);
		}
		
		var tableRow, link;
		while(tableRow = tableRows.iterateNext()) {
			var snapshot = undefined;
			var pdf = undefined;
			
			if(isTOC) {
				var title = doc.evaluate('.//strong', tableRow, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				
				var links = doc.evaluate('.//a', tableRow, null, XPathResult.ANY_TYPE, null);
				while(link = links.iterateNext()) {
					// prefer Full Text snapshots, but take abstracts
					if(link.textContent == "[Abstract]") {
						if(!snapshot) snapshot = link.href;
					} else if (link.textContent == "[Full Text]") {
						snapshot = link.href;
					} else if(link.textContent == "[PDF]") {
						pdf = link.href;
						var m = gcaRe.exec(link.href);
						var gca = m[1];
					}
				}
			} else {
				if(isScience) {
					var tableDT = tableDTs.iterateNext();
					var gca = doc.evaluate('./input[@type="checkbox"]', tableDT, null, XPathResult.ANY_TYPE, null).iterateNext().value;
					var title = doc.evaluate('./label', tableDT, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				} else {
					var gca = doc.evaluate('./td/input[@type="checkbox"]', tableRow, null, XPathResult.ANY_TYPE, null).iterateNext().value;
					var title = doc.evaluate('./td/font/strong', tableRow, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
					if(title.snapshotItem(0).textContent.toUpperCase() == title.snapshotItem(0).textContent) {
						title = title.snapshotItem(1).textContent;
					} else {
						title = title.snapshotItem(0).textContent;
					}
				}
				
				var links = doc.evaluate('.//a', tableRow, null, XPathResult.ANY_TYPE, null);
				while(link = links.iterateNext()) {
					// prefer Full Text snapshots, but take abstracts
					var textContent = Zotero.Utilities.trimInternal(link.textContent);
					if((textContent.substr(0, 8) == "Abstract" && !snapshot) || textContent.substr(0, 9) == "Full Text") {
						snapshot = link.href;
					} else if(textContent.substr(0, 3) == "PDF") {
						pdf = link.href;
					}
				}
			}
			
			snapshots[gca] = snapshot;
			pdfs[gca] = pdf;
			
			items[gca] = Zotero.Utilities.trimInternal(title);
		}
		
		items = Zotero.selectItems(items, function(items) {
    		if(!items) return true;
    		
    		var requests = new Array();
    		for(var gca in items) {
    			var m = hostRe.exec(pdfs[gca]);
    			var baseURL = 'http://' + doc.location.host + '/cgi/citmgr?type=refman';
    			
    			var thisRequest = null;
    			for each(var request in requests) {
    				if(request.baseURL == baseURL) {
    					thisRequest = request;
    					break;
    				}
    			}
    			
    			if(!thisRequest) {
    				thisRequest = new Object();
    				thisRequest.snapshots = new Array();
    				thisRequest.pdfs = new Array();
    				thisRequest.args = "";
    				thisRequest.baseURL = baseURL;
    				requests.push(thisRequest);
    			}
    			
    			thisRequest.snapshots.push(snapshots[gca]);
    			thisRequest.pdfs.push(pdfs[gca]);
    			thisRequest.args += "&gca="+gca;
    		}
		});
	} else {
		var baseURL = doc.evaluate('//a[substring(@href, 1, 16) = "/cgi/citmgr?gca="]', doc, null,
			XPathResult.ANY_TYPE, null).iterateNext().href;
		var pdf = doc.location.href.replace(/\/content\/[^\/]+\//, "/reprint/");
		Zotero.debug(pdf);
		var requests = [{baseURL:baseURL, args:"&type=refman", snapshots:[doc], pdfs:[pdf]}];
        handleRequests(requests);
	}
		
	Zotero.wait();
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.annfammed.org/cgi/search?fulltext=family+medicine&sendit=Enter&volume=9&issue=2&journalcode=annalsfm",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.annfammed.org/cgi/content/abstract/9/2/165?maxtoshow=&hits=10&RESULTFORMAT=&fulltext=family+medicine&searchid=1&FIRSTINDEX=0&volume=9&issue=2&resourcetype=HWCIT",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Rosser",
						"firstName": "Walter W.",
						"creatorType": "author"
					},
					{
						"lastName": "Colwill",
						"firstName": "Jack M.",
						"creatorType": "author"
					},
					{
						"lastName": "Kasperski",
						"firstName": "Jan",
						"creatorType": "author"
					},
					{
						"lastName": "Wilson",
						"firstName": "Lynn",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "HighWire Snapshot",
						"document": false
					},
					{
						"title": "HighWire Full Text PDF",
						"mimeType": "application/pdf",
						"url": false
					}
				],
				"title": "Progress of Ontario's Family Health Team Model: A Patient-Centered Medical Home",
				"date": "March 1, 2011",
				"publicationTitle": "Ann Fam Med",
				"pages": "165-171",
				"volume": "9",
				"issue": "2",
				"url": "http://www.annfammed.org/cgi/content/abstract/9/2/165",
				"abstractNote": "Ontario's Family Health Team (FHT) model, implemented in 2005, may be North America's largest example of a patient-centered medical home. The model, based on multidisciplinary teams and an innovative incentive-based funding system, has been developed primarily from fee-for-service primary care practices. Nearly 2 million Ontarians are served by 170 FHTs. Preliminary observations suggest high satisfaction among patients, higher income and more gratification for family physicians, and trends for more medical students to select careers in family medicine. Popular demand is resulting in expansion to 200 FHTs. We describe the development, implementation, reimbursement plan, and current status of this multidisciplinary model, relating it to the principles of the patient-centered medical home. We also identify its potential to provide an understanding of many aspects of primary care. ",
				"DOI": "10.1370/afm.1228",
				"libraryCatalog": "HighWire",
				"shortTitle": "Progress of Ontario's Family Health Team Model"
			}
		]
	}
]
/** END TEST CASES **/