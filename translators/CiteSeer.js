{
	"translatorID":"fa396dd4-7d04-4f99-95e1-93d6f355441d",
	"translatorType":4,
	"label":"CiteSeer",
	"creator":"Simon Kornblith",
	"target":"^http://(?:citeseer\\.ist\\.psu\\.edu/|citeseer\\.csail\\.mit\\.edu/|citeseer\\.ifi\\.unizh\\.ch/|citeseer\\.comp\\.nus\\.edu\\.sg/)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-02-06 21:00:00"
}

function detectWeb(doc, url) {
	var searchRe = /http:\/\/[^\/]+\/ci?s/;
	if(searchRe.test(url)) {
		return "multiple";
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		
		if(doc.evaluate('/html/body/span[@class="m"]/pre', doc, nsResolver,
		                XPathResult.ANY_TYPE, null).iterateNext()) {
			return "journalArticle";
		}
	}
}

function scrape(doc) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	// figure out what attachments to add
	var attachments = new Array();
	var results = doc.evaluate('/html/body/span[@class="m"]/table[@class="h"]/tbody/tr/td[4]/center/font/a',
	                       doc, nsResolver, XPathResult.ANY_TYPE, null);
	var elmt;
	
	var acceptableTypes = ["PDF", "PS", "PS.gz"];
	var mimeTypes = ["application/pdf", "application/postscript", "application/gzip"];
	var resultsArray = [];
	while (elmt = results.iterateNext()) {
		resultsArray.push(elmt);
	}
	resultsArray = resultsArray.filter(function (element, index, array) {
		return (acceptableTypes.indexOf(element.textContent.toString()) != -1);
	});
	resultsArray = resultsArray.sort(function (a,b) {
		return (acceptableTypes.indexOf(a.textContent.toString()) -
			acceptableTypes.indexOf(b.textContent.toString()));
	});
	if (resultsArray.length > 0) {
		var elmt = resultsArray[0];
		var kind = elmt.textContent.toString();
		var index = acceptableTypes.indexOf(kind);
	       	var attachment = {url:elmt.href, mimeType:mimeTypes[index],
			       	  title:"CiteSeer Full Text "+kind};
		attachments.push(attachment);
	}
	
	var bibtex = doc.evaluate('/html/body/span[@class="m"]/pre/text()', doc, nsResolver,
		                XPathResult.ANY_TYPE, null).iterateNext();
	if(bibtex) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
		translator.setString(bibtex.nodeValue.toString());
		translator.setHandler("itemDone", function(obj, item) {
			if(item.url) {	// add http to url
				item.url = "http://"+item.url;
			}
			item.attachments = attachments;
			
			item.complete();
		});
		translator.translate();
	} else {
		throw "No BibTeX found!";
	}
}

function doWeb(doc, url) {
	var searchRe = /http:\/\/([^\/]+)\/ci?s/;
	var m = searchRe.exec(doc.location.href);
	if(m) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		
		var items = Zotero.Utilities.getItemArray(doc, doc, "^http://"+m[1]+"/[^/]+.html");
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
	} else {
		scrape(doc);
	}
}