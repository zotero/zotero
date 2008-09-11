{
	"translatorID":"6614a99-479a-4524-8e30-686e4d66663e",
	"translatorType":4,
	"label":"Nature",
	"creator":"Simon Kornblith",
	"target":"https?://www\\.nature\\.com[^/]*/(?:[^/]+/journal/v[^/]+/n[^/]+/(?:(?:full|abs)/.+\\.html|index.html)|search/executeSearch)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-03-26 03:00:00"
}

function detectWeb(doc, url) {
	var articleRe = /(https?:\/\/[^\/]+\/[^\/]+\/journal\/v[^\/]+\/n[^\/]+\/)(full|abs)(\/.+\.)html/;
	
	if (articleRe.test(url)) {
		if (doc.evaluate('//a[contains(@href, ".ris")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			return "journalArticle";
		} else { return false; }
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		
		var tableRows = doc.evaluate('//*[@class="atl"] | //*[@class="articletitle"] | //h4[@class="norm"]',
			doc, nsResolver, XPathResult.ANY_TYPE, null);
		var fulltextLinks = doc.evaluate('//a[text() = "Full Text"] | //a[text() = "Full text"] | //a[text() = "Full Text "]',
			doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		if(tableRows.iterateNext() && fulltextLinks.iterateNext()) {
			return "multiple";
		}
	}
	
	return false;
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var articleRe = /(https?:\/\/[^\/]+\/[^\/]+\/journal\/v[^\/]+\/n[^\/]+\/)(full|abs)(\/.+)\.html/;
	var m = articleRe.exec(url);
	
	if(!m) {
		// search page
		var items = new Array();
		
		var tableRows = doc.evaluate('//*[@class="atl"] | //*[@class="articletitle"] | //h4[@class="norm"]',
			doc, nsResolver, XPathResult.ANY_TYPE, null);
		var fulltextLinks = doc.evaluate('//a[text() = "Full Text"] | //a[text() = "Full text"] | //a[text() = "Full Text "]',
			doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow, fulltextLink;
		while((tableRow = tableRows.iterateNext()) && (fulltextLink = fulltextLinks.iterateNext())) {
			items[fulltextLink.href] = Zotero.Utilities.cleanString(tableRow.textContent);
		}
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var urls = new Array();
		for(var url in items) {
			urls.push(url);
		}
	} else {
		var urls = [url];
	}
	
	var RIS = new Array();
	var regexps = new Array();
	
	for each(var item in urls) {
		var m = articleRe.exec(item);
		if(m[3][m[3].length-2] == "_") {
			m[3] = m[3].substr(0, m[3].length-2);
		}
		RIS.push(m[1]+"ris"+m[3]+".ris");
		regexps.push(m);
	}
	
	Zotero.Utilities.HTTP.doGet(RIS, function(text) {
		var url = urls.shift();
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			var m = regexps.shift();
			item.attachments = [
				{url:m[0], title:"Nature Snapshot", mimeType:"text/html"},
				{url:m[1]+"pdf"+m[3]+".pdf", title:"Nature Full Text PDF", mimeType:"application/pdf"}
			]
			
			item.notes = new Array();
			if (item.date) item.date = item.date.replace("print ", "");
			
			item.complete();
		});
		translator.translate();
	}, function() { Zotero.done(); });
		
	Zotero.wait();
}