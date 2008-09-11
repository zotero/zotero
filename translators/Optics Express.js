{
	"translatorID":"8a07dd43-2bce-47bf-b4bf-c0fc441b79a9",
	"translatorType":4,
	"label":"Optics Express",
	"creator":"Michael Berkowitz",
	"target":"http://(www.)?opticsexpress\\.org",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-15 19:40:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var searchpath = '//div[@id="col2"]/p/strong/a';
	if (doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("abstract.cfm") != -1) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var  articles = new Array();
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = '//div[@id="col2"]/p/strong/a';
		var art = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_art;
		while (next_art = art.iterateNext()) {
			items[next_art.href] = Zotero.Utilities.trimInternal(next_art.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles = [url];
	}
	for (var a in articles) {
		var link = articles[a];
		Zotero.Utilities.HTTP.doGet(link, function(text) {
			if (text.match(/doi:.*\"/)) var doi = text.match(/doi:(.*)\"/)[1];
			var id = text.match(/name=\"articles\"\s+value=\"([^"]+)\"/)[1];
			var action = text.match(/select\s+name=\"([^"]+)\"/)[1];
			var get = 'http://www.opticsinfobase.org/custom_tags/IB_Download_Citations.cfm';
			var post = 'articles=' + id + '&ArticleAction=save_endnote2&' + action + '=save_endnote2';
			Zotero.Utilities.HTTP.doPost(get, post, function(text) {
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					var pubName;
					if (item.journalAbbreviation) {
						pubName = item.journalAbbreviation;
					} else {
						pubName = item.publicationTitle;
					}
					if (doi) item.DOI = doi;
					item.attachments = [{url:articles[a], title:pubName + " Snapshot", mimeType:"text/html"}];
					item.complete();
				});
				translator.translate();
			});
		});
	}
}