{
	"translatorID":"5eacdb93-20b9-4c46-a89b-523f62935ae4",
	"translatorType":4,
	"label":"HighWire",
	"creator":"Simon Kornblith",
	"target":"^http://[^/]+/(?:cgi/searchresults|cgi/search|cgi/content/(?:abstract|full|short|summary)|current.dtl$|content/vol[0-9]+/issue[0-9]+/(?:index.dtl)?$)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-04-04 20:00:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if(doc.title.indexOf(" -- Search Result") != -1 ||
	  doc.title == "Science/AAAS | Search Results") {
		if(doc.evaluate('//table/tbody/tr[td/input[@type="checkbox"][@name="gca"]]', doc,
			nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) return "multiple";
	} else if(doc.title.indexOf(" -- Table of Contents") != -1||
	  doc.title == "Science/AAAS | Science Magazine Search Results") {
		if(doc.evaluate('//form/dl', doc, nsResolver, XPathResult.ANY_TYPE,null).iterateNext()) return "multiple";
	} else {
		if(doc.evaluate('//a[substring(@href, 1, 16) = "/cgi/citmgr?gca="]', doc, nsResolver,
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
				item.DOI = item.notes[0].note;
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
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
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
			var tableRows = doc.evaluate('//form/dl', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else if(isScience) {
			var tableRows = doc.evaluate('//form/dl/dd', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var tableDTs = doc.evaluate('//form/dl/dt', doc, nsResolver, XPathResult.ANY_TYPE, null);
		} else {
			var tableRows = doc.evaluate('//table/tbody/tr[td/input[@type="checkbox"]][td/font/strong]', doc,
				nsResolver, XPathResult.ANY_TYPE, null);
		}
		
		var tableRow, link;
		while(tableRow = tableRows.iterateNext()) {
			var snapshot = undefined;
			var pdf = undefined;
			
			if(isTOC) {
				var title = doc.evaluate('.//strong', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				
				var links = doc.evaluate('.//a', tableRow, nsResolver, XPathResult.ANY_TYPE, null);
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
					var gca = doc.evaluate('./input[@type="checkbox"]', tableDT, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
					var title = doc.evaluate('./label', tableDT, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				} else {
					var gca = doc.evaluate('./td/input[@type="checkbox"]', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
					var title = doc.evaluate('./td/font/strong', tableRow, nsResolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
					if(title.snapshotItem(0).textContent.toUpperCase() == title.snapshotItem(0).textContent) {
						title = title.snapshotItem(1).textContent;
					} else {
						title = title.snapshotItem(0).textContent;
					}
				}
				
				var links = doc.evaluate('.//a', tableRow, nsResolver, XPathResult.ANY_TYPE, null);
				while(link = links.iterateNext()) {
					// prefer Full Text snapshots, but take abstracts
					var textContent = Zotero.Utilities.cleanString(link.textContent);
					if((textContent.substr(0, 8) == "Abstract" && !snapshot) || textContent.substr(0, 9) == "Full Text") {
						snapshot = link.href;
					} else if(textContent.substr(0, 3) == "PDF") {
						pdf = link.href;
					}
				}
			}
			
			snapshots[gca] = snapshot;
			pdfs[gca] = pdf;
			
			items[gca] = Zotero.Utilities.cleanString(title);
		}
		
		items = Zotero.selectItems(items);
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
	} else {
		var baseURL = doc.evaluate('//a[substring(@href, 1, 16) = "/cgi/citmgr?gca="]', doc, nsResolver,
			XPathResult.ANY_TYPE, null).iterateNext().href;
		var pdf = doc.location.href.replace(/\/content\/[^\/]+\//, "/reprint/");
		Zotero.debug(pdf);
		var requests = [{baseURL:baseURL, args:"&type=refman", snapshots:[doc], pdfs:[pdf]}];
	}
	
	handleRequests(requests);
		
	Zotero.wait();
}