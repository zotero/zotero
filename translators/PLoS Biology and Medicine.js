{
	"translatorID":"bdae838b-3a58-461f-9e8a-142ed9de61dc",
	"translatorType":4,
	"label":"PLoS Biology and Medicine",
	"creator":"Michael Berkowitz",
	"target":"http://[^.]+\\.plosjournals\\.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url)	{
	if (doc.evaluate('//div[@class="search"][@id="browseResults"]/ul/li/span/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext() ||
		doc.evaluate('//div[@id="toclist"]/dl/dt/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("get-document") != -1) {
		return "journalArticle";
	}
}

function unescape(text)	{
	var specialreg=new RegExp("&#[^;]+;");
	var specials=specialreg.exec(text);
	while(specials)	{
		text=text.replace(specials[0], String.fromCharCode(parseInt(specials[0].substring(2, specials[0].length-1), 10)));
		specials=specialreg.exec(text);
	}
	return text;
}

function doWeb(doc, url) {
	var URLs = new Array();
	var items = new Object();
	if (detectWeb(doc, url) == "multiple") {
		if (doc.evaluate('//div[@class="search"][@id="browseResults"]/ul/li/span/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@class="search"][@id="browseResults"]/ul/li/span/a';
		} else if (doc.evaluate('//div[@id="toclist"]/dl/dt/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="toclist"]/dl/dt/a';
		}
		var articles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_article = articles.iterateNext();
		while (next_article) {
			items[next_article.href] = Zotero.Utilities.cleanString(next_article.textContent);
			next_article = articles.iterateNext();
		}
		items = Zotero.selectItems(items);
		
		if (!items) {
			return true;
		}
		
		for (var i in items) {
			URLs.push(i);
		}
	} else {
		URLs.push(url);
	}
	
	
	Zotero.Utilities.processDocuments(URLs, function(doc, url) {
		var bits = doc.location.href.match(/(^.*\?request=).*(doi=.*$)/);
		var RISurl = bits[1] + 'download-citation&t=refman&' + bits[2];
		Zotero.Utilities.HTTP.doGet(RISurl, function(text) {
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.setHandler("itemDone", function(obj, newItem)	{
				var urlstring= bits[1]+ 'get-pdf&' +bits[2].replace("doi=", "file=").replace("/", "_").replace("%2F", "_") + '-S.pdf';
				newItem.attachments.push({url:urlstring, title:newItem.title, mimeType:"application/pdf"});
				
				var urlRE = /http:\/\/dx.doi.org\/(.*)$/;
				if (newItem.url) {
					newItem.DOI = newItem.url.match(urlRE)[1].replace("%2F", "/");
				}
				
				newItem.complete();
			});
			trans.translate();
			Zotero.done();
		});
		Zotero.wait();
	}, function() {Zotero.done();});
	
	Zotero.wait();
}