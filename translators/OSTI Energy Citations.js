{
	"translatorID":"0cdc6a07-38cf-4ec1-b9d5-7a3c0cc89b15",
	"translatorType":4,
	"label":"OSTI Energy Citations",
	"creator":"Michael Berkowitz",
	"target":"http://www.osti.gov/energycitations",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-20 15:20:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//table[@class="searchresults"]//a[@class="citation"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("product.biblio.jsp") != -1) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var urls = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = '//table[@class="searchresults"]//a[@class="citation"]';
		var links = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var next_link;
		while (next_link = links.iterateNext()) {
			items[next_link.href] = next_link.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			urls.push(i.match(/osti_id=\d+/)[0]);
		}
	} else {
		urls = [url.match(/osti_id=\d+/)[0]];
	}
	for (var i = 0 ; i < urls.length ; i++) {
		var getstr = 'http://www.osti.gov/energycitations/endnote?' + urls[i];
		Zotero.Utilities.HTTP.doGet(getstr, function(text) {
			Zotero.debug(text);
			text = text.replace(/(%.)/g, "$1 ");
			var trans = Zotero.loadTranslator("import");
			trans.setTranslator("881f60f2-0802-411a-9228-ce5f47b64c7d");
			trans.setString(text);
			trans.translate();
		});
	}
}