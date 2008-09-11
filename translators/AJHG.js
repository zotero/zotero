{
	"translatorID":"0a01d85e-483c-4998-891b-24707728d83e",
	"translatorType":4,
	"label":"AJHG",
	"creator":"Michael Berkowitz",
	"target":"http://(www.)?ajhg.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-02-14 23:15:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div[@class="article_links"]/a[1]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("abstract") != -1 || url.indexOf("fulltext") != -1) {
		return "journalArticle";
	}
}

function getID(str) {
	str =  str.match(/\/([^/]+)$/)[1];
	if (str.indexOf("#") != -1) {
		str = str.substr(0, str.length - 1);
	}
	return str;
}

function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title.indexOf("Search Results") != -1) {
			var xpath = '//table[@id="search_results"]/tbody/tr/td[1]';
			var titlex = './strong';
			var linkx = './div/a[1]';
		} else {
			var xpath = '//div[@id="main_toc"]/dl';
			var titlex = './dt';
			var linkx = './dd/div/a[1]';
		}
		var blocks = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_block;
		while (next_block = blocks.iterateNext()) {
			var title = doc.evaluate(titlex, next_block, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate(linkx, next_block, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(getID(i));
		}
	} else {
		articles = [getID(url)];
	}
	Zotero.debug(articles);
	for (var i in articles) {
		var poststr = 'format=cite-abs&citation-type=RIS&pii=' + articles[i] + '&action=download&Submit=Export';
		var pdfurl = 'http://download.ajhg.org/AJHG/pdf/PII' + articles[i].replace(/(\(|\)|\-)/g, "") + '.pdf';
		var newurl = 'http://www.ajhg.org/AJHG/fulltext/' + articles[i];
		Zotero.Utilities.HTTP.doPost('http://ajhg.org/AJHG/citationexport', poststr, function(text) {
			var trans = Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.setHandler("itemDone", function(obj, item) {
				item.attachments = [
					{url:newurl, title:"AJHG Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"AJHG Full Text PDF", mimeType:"application/pdf"}
				];
				
				if (item.notes[0]["note"]) {
					item.abstractNote = item.notes[0]["note"];
				}
				item.notes = [];
				item.complete();
			});
			trans.translate();
			Zotero.done();
		});
	}
	Zotero.wait();
	
}