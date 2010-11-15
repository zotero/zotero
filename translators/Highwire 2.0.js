{
        "translatorID":"8c1f42d5-02fa-437b-b2b2-73afc768eb07",
        "label":"Highwire 2.0",
        "creator":"Matt Burton",
        "target":"(content/([0-9]+/[0-9]+|current|firstcite)|search\\?submit=|search\\?fulltext=|cgi/collection/.+)",
        "minVersion":"1.0.0b4.r5",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2010-11-11 21:19:55"
}

/*
 Translator for several Highwire journals. Example URLs:

1. Ajay Agrawal, Iain Cockburn, and John McHale, “Gone but not forgotten: knowledge flows, labor mobility, and enduring social relationships,” Journal of Economic Geography 6, no. 5 (November 2006): 571-591.
	http://joeg.oxfordjournals.org/content/6/5/571 :
2. Gordon L. Clark, Roberto Durán-Fernández, and Kendra Strauss, “‘Being in the market’: the UK house-price bubble and the intended structure of individual pension investment portfolios,” Journal of Economic Geography 10, no. 3 (May 2010): 331-359.
	http://joeg.oxfordjournals.org/content/10/3/331.abstract
3. Hans Maes, “Intention, Interpretation, and Contemporary Visual Art,” Brit J Aesthetics 50, no. 2 (April 1, 2010): 121-138.
	http://bjaesthetics.oxfordjournals.org/cgi/content/abstract/50/2/121
4. M L Giger et al., “Pulmonary nodules: computer-aided detection in digital chest images.,” Radiographics 10, no. 1 (January 1990): 41-51.
	http://radiographics.rsna.org/content/10/1/41.abstract
5. Mitch Leslie, "CLIP catches enzymes in the act," The Journal of Cell Biology 191, no. 1 (October 4, 2010): 2.
       http://jcb.rupress.org/content/191/1/2.2.short
*/

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	// lets hope this installations don't tweak this...
	var highwiretest = doc.evaluate("//link[@href = '/shared/css/hw-global.css']", doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	
	if(highwiretest) {
		
		if (
			url.match("search\\?submit=") ||
			url.match("search\\?fulltext=") ||
			url.match("content/by/section") || 
			doc.title.match("Table of Contents") || 
			doc.title.match("Early Edition") || 
			url.match("cgi/collection/.+") || 
			url.match("content/firstcite") 
		) {
			return "multiple";
		} else if (url.match("content/[0-9]+")) {
			return "journalArticle";
		}
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
		
	var host = 'http://' + doc.location.host + "/";
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title.match("Table of Contents")
			|| doc.title.match("Early Edition")
			|| url.match("content/firstcite")) {
			var searchx = '//li[contains(@class, "toc-cit") and not(ancestor::div/h2/a/text() = "Correction" or ancestor::div/h2/a/text() = "Corrections")]'; 
			var titlex = './/h4';
		} else if (url.match("content/by/section") || url.match("cgi/collection/.+")) {
			var searchx = '//li[contains(@class, "results-cit cit")]'; 
			var titlex = './/span[contains(@class, "cit-title")]';
		}
		else {
			var searchx = '//div[contains(@class,"results-cit cit")]';
			var titlex = './/span[contains(@class,"cit-title")]';
		}	
		var linkx = './/a[1]';
		var searchres = doc.evaluate(searchx, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_res;
		while (next_res = searchres.iterateNext()) {
			var title = doc.evaluate(titlex, next_res, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate(linkx, next_res, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		} 
	} else {
		arts = [url];
	}
	var newurls = new Array();
	for each (var i in arts) {
		newurls.push(i);
	}
	if(arts.length == 0) {
		Zotero.debug('no items');
		return false;
	}
	Zotero.Utilities.HTTP.doGet(arts, function(text) {
		var id, match, newurl, pdfurl, get;
		/* Here, we have to use three phrasings because they all occur, depending on
		   the journal.*/
		match = text.match(/=([^=]+)\">\s*Download citation/);
		if (!match || match.length < 1) {
			match = text.match(/=([^=]+)\">\s*Download to citation manager/);
			if (!match || match.length < 1) {
				// Journal of Cell Biology
          			match = text.match(/=([^=]+)\">\s*Add to Citation Manager/);
        		}
		}
		id = match[1];
		newurl = newurls.shift();		
		if (newurl.match("cgi/content")) {
			pdfurl = newurl.replace(/cgi\/content\/abstract/, "content") + ".full.pdf";
		} else {
			// This is not ideal...todo: brew a regex that grabs the correct URL
			pdfurl = newurl.slice(0, newurl.lastIndexOf(".")) + ".full.pdf";
		}
		get = host + 'citmgr?type=refman&gca=' + id;
		Zotero.Utilities.HTTP.doGet(get, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			// Sometimes Highwire 2.0 has blank entries for N1
			if (text.match(/N1\s+\-\s+(10\..*)\n/)) {
				var doi = text.match(/N1\s+\-\s+(.*)\n/)[1];
			}
			translator.setHandler("itemDone", function(obj, item) {
				item.attachments = [
					{url:newurl, title:"Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"Full Text PDF", mimeType:"application/pdf"}
				];
				if (doi) item.DOI = doi;
				if (item.notes) item.notes = [];
				item.complete();
			});
			translator.translate();
		});
	});
	Zotero.wait();
}
