{
	"translatorID":"df966c80-c199-4329-ab02-fa410c8eb6dc",
	"translatorType":4,
	"label":"University of Chicago",
	"creator":"Sean Takats",
	"target":"https?://[^/]*journals\\.uchicago\\.edu[^/]*/(?:doi/abs|doi/full|toc)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-12-18 09:26:31"
}

function detectWeb(doc, url) {
	if(url.indexOf("toc") != -1) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var proxyURL ="";
	var proxyRe = /http:\/\/([^\/]*)/;
	var m = proxyRe.exec(doc.location.href);
	if(m) {
		proxyURL = m[1];
	}

	var post = "";
	
	var fulltext = new Object();
	
	if(url.indexOf("toc") != -1) {
		var items = new Array();
		var links = new Array();
		
		var tableRows = doc.evaluate('//li[div[@class="articleListing_col3"]/label][//input[@name="doi"]]', doc,
			nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		// Go through table rows
		while(tableRow = tableRows.iterateNext()) {
			var id = doc.evaluate('.//input[@name="doi"]', tableRow, nsResolver, XPathResult.ANY_TYPE,
				null).iterateNext().value;
			items[id] = Zotero.Utilities.trimInternal(doc.evaluate('.//label', tableRow,
				nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		}
		
		var items = Zotero.selectItems(items);
		if(!items) return true;
		
		// find all fulltext links so we can determine where we can scrape the fulltext article
		var fulltextLinks = doc.evaluate('//a[starts-with(text(), "Full Text")]', doc,
			nsResolver, XPathResult.ANY_TYPE, null);
		var fulltextLink;
		while(fulltextLink = fulltextLinks.iterateNext()) {
			links.push(fulltextLink.href.toString());
		}
		
		for(var i in items) {
			post += "doi="+encodeURIComponent(i)+"&";
			
			// check for fulltext links
			for each(var link in links) {
				if(link.indexOf(i) != -1) {
					fulltext[i] = true;
					break;
				}
			}
		}
	} else {
		var m = url.match(/https?:\/\/[^\/]+\/doi\/[^\/]+\/([^\?]+)(\?|$)/);
		if (m) {
			var doi = m[1];
		} else {
			m = url.match(/https?:\/\/[^\/]+\/links\/doi\/([^\?]+)(\?|$)/);
			var doi = m[1];
		}
		post += "doi="+encodeURIComponent(doi)+"&";
			
		if(url.indexOf("doi/full") != -1 ||
		  doc.evaluate('//img[@alt="Full Text Article"]', doc, nsResolver, XPathResult.ANY_TYPE,
		  null).iterateNext()) {
			fulltext[doi] = true;
		}
	}
	
	post += "include=cit&downloadFileName=deadbeef&format=refman&direct=on&submit=Download+article+citation+data";
	Zotero.Utilities.HTTP.doPost("http://www.journals.uchicago.edu/action/downloadCitation", post, function(text) {
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			item.attachments = [
				{url:item.url.replace("www.journals.uchicago.edu", proxyURL), title:"University of Chicago Journals Snapshot", mimeType:"text/html"},
				{url:item.url.replace("www.journals.uchicago.edu", proxyURL).replace("/doi/abs", "/doi/pdf"), title:"University of Chicago Full Text PDF", mimeType:"application/pdf"}
			];
			if (item.notes[0]['note']) item.DOI = Zotero.Utilities.trimInternal(item.notes[0]['note'].substr(4));
			item.notes = new Array();
			// use fulltext if possible
			if(fulltext[item.DOI]) {
				item.attachments[0].url = item.attachments[0].url.replace("/doi/abs", "/doi/full");
			}
			
			item.complete();
		});
		translator.translate();
		
		Zotero.done();
	});
		
	Zotero.wait();
}