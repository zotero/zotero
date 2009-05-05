{
	"translatorID":"e78d20f7-488-4023-831-dfe39679f3f",
	"translatorType":4,
	"label":"ACM",
	"creator":"Simon Kornblith and Michael Berkowitz",
	"target":"https?://[^/]*portal\\.acm\\.org[^/]*/(?:results\\.cfm|citation\\.cfm)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-05-05 07:15:00"
}

function detectWeb(doc, url) {
	if(url.indexOf("/results.cfm") != -1) {
		var items = Zotero.Utilities.getItemArray(doc, doc, '^https?://[^/]+/citation.cfm\\?[^#]+$');
		// hack to return multiple if there are items
		for(var i in items) {
			return "multiple";
		}
	} else {
		var onClick = doc.evaluate('//a[substring(text(), 5, 7) = "EndNote"]', doc, null, XPathResult.ANY_TYPE,
			null).iterateNext().getAttribute("onClick");
		if(onClick.match("proceeding.article")) {
			return "conferencePaper";
		} else {
			return "journalArticle";
		}
	}
}

var urls = new Array();

// this handles sequential loading, since first we need to process a document (to get the abstract), then
// get the Refer metadata, then process the next document, etc.
function getNext() {
	if(urls.length) {
		var url = urls.shift();
		Zotero.Utilities.processDocuments([url], function(doc) { scrape(doc); });
	} else {
		Zotero.done();
	}
}

function scrape(doc) {
	var onClick = doc.evaluate('//a[substring(text(), 5, 7) = "EndNote"]', doc, null, XPathResult.ANY_TYPE,
		null).iterateNext().getAttribute("onClick");
	var m = onClick.match(/'([^']+)'/);
	
	if (doc.evaluate('//div[@class="abstract"]/p[@class="abstract"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var abstract = doc.evaluate('//div[@class="abstract"]/p[@class="abstract"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
		if (!abstract.textContent.match(/\w+/)) {
			var abstract = doc.evaluate('//div[@class="abstract"]/p[2]', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
		}
		if(abstract) abstract = Zotero.Utilities.trimInternal(abstract.textContent);
	}
	var snapshot = doc.location.href;
	var attachments = new Array();
	var url;
	var typeLinks = doc.evaluate('//td[@class="smaller-text"]/a[img]', doc, null,
		XPathResult.ANY_TYPE, null);
	var typeLink;
	while(typeLink = typeLinks.iterateNext()) {
		var linkText = typeLink.textContent.toLowerCase();
		linkText = linkText.replace(/(\t|\n| )/g, "");
		if(linkText == "pdf") {
			attachments.push({title:"ACM Full Text PDF", mimeType:"application/pdf", url:typeLink.href});
			url = typeLink.href;
		} else if(linkText == "html") {
			url = snapshot = typeLink.href;
		}
	}
	
	attachments.push({title:"ACM Snapshot", mimeType:"text/html", url:snapshot});

	var keywords = new Array();
	var keywordLinks = doc.evaluate('//p[@class="keywords"]/a', doc, null,
		XPathResult.ANY_TYPE, null);
	var keywordLink;
	while(keywordLink = keywordLinks.iterateNext()) {
		keywords.push(Zotero.Utilities.trimInternal(keywordLink.textContent.toLowerCase()));
	}
	var doi = "";
	var doiElmt = doc.evaluate('/html/body/div/table/tbody/tr[4]/td/table/tbody/tr/td/table/tbody/tr[3]/td[2][@class="small-text"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()
	if (doiElmt){
		var match = doiElmt.textContent.match(/org\/(.*)/);
		if (match){
			doi = match[1];
		}
	}
	
	Zotero.Utilities.HTTP.doGet("http://portal.acm.org/"+m[1], function(text) {
		// split() may no longer be necessary
		var m = text.split(/<\/?pre[^>]*>/ig);
		if (m[1]) {
			var text = m[1];
		}
   		// unescape HTML for extended characters
		function unescapeHTML(str, p1){
			return Zotero.Utilities.unescapeHTML("&#"+p1);
		}
   		text = text.replace(/\\&\\#([^;]+;)/g, unescapeHTML);  
		// load Refer translator
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("881f60f2-0802-411a-9228-ce5f47b64c7d");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			if(abstract) item.abstractNote = abstract;
			item.attachments = attachments;
			item.tags = keywords;
			item.DOI = doi;
			item.url = snapshot;
			item.complete();
		});
		translator.translate();
		
		getNext();
	});
}

function doWeb(doc, url) {
	if(url.indexOf("/results.cfm") != -1) {
		var items = Zotero.Utilities.getItemArray(doc, doc, '^https?://[^/]+/citation.cfm\\?[^#]+$');
		
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		for(var url in items) {
			urls.push(url);
		}
		
		getNext();
	} else {
		scrape(doc);
	}
	
	Zotero.wait();
}