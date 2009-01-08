{
	"translatorID":"60d97c99-47f0-4323-98b6-5699faf827b1",
	"translatorType":4,
	"label":"Blackwell Compass",
	"creator":"Michael Berkowitz",
	"target":"http://www.blackwell-compass.com/subject/[^/]+/.+",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.indexOf("search_results") != -1 || url.indexOf("section_home") != -1) {
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
	
	var URIs = new Array();
	var items = new Object();
	if (detectWeb(doc, url) == "multiple") {
		
		var xpath = '//div[@class="article-holder"]//h4[@class="article"]/a';
		var articles = doc.evaluate(xpath, doc, namespace, XPathResult.ANY_TYPE, null);
		var next_art = articles.iterateNext();
		while (next_art) {
			items[next_art.href] = next_art.textContent;
			next_art = articles.iterateNext();
		}
		items = Zotero.selectItems(items);
		
		for (var i in items) {
			URIs.push(i);
		}
	} else {
		URIs.push(url);
	}
	
	Zotero.Utilities.processDocuments(URIs, function(doc, urll) {
		var doi = doc.evaluate('//div[@id="content"]/p/span[@class="guide"]/a[substring(@href, 1, 4) = "http"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href.match(/doi\/[^/]*\/([^&]*)/)[1];
		Zotero.Utilities.HTTP.doGet('http://www.blackwell-synergy.com/action/downloadCitation?doi=' + doi + '&include=cit&format=refman&direct=on&submit=Download+references', function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.attachments = [
					{url:item.url, title:"Blackwell Compass Snapshot", mimeType:"text/html"},
					{url:item.url.replace("/doi/abs", "/doi/pdf"), title:"Blackwell Compass Full Text PDF", mimeType:"application/pdf"}
				];
				
				item.complete();
		
			});
			
			translator.translate();
		});
	}, function() {Zotero.done();});
	Zotero.wait();
}