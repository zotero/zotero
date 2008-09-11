{
	"translatorID":"490909d7-7d79-4c7a-a136-77df618d4db2",
	"translatorType":4,
	"label":"Worldcat.org",
	"creator":"Michael Berkowitz",
	"target":"http://(www.)?worldcat.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-20 20:45:00"
}

function detectWeb(doc, url) {
	if (url.match(/search?/) && doc.evaluate('//input[@id="itemid"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else {
		var type = doc.evaluate('//tbody/tr/td[2][img]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.toLowerCase().match(/(\w+);/)[1];
		switch (type) {
			case "book": return "book";
			case "article": return "journalArticle";
			case "recording":
			case "disc": return "audioRecording";
			case "tape": return "videoRecording";
		}
	}
}

function ENify(str) {
	return str.match(/^[^&]+/)[0] + '?page=endnote&client=worldcat.org-detailed_record';
}
function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var titles = doc.evaluate('//div[@class="name"]/a', doc, ns, XPathResult.ANY_TYPE, null);
		var title;
		while (title = titles.iterateNext()) {
			items[title.href] = Zotero.Utilities.trimInternal(title.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			books.push(ENify(i));
		}
	} else {
		var link = doc.evaluate('//a[contains(text(), "EndNote")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		books = [link];
	}
	for each (var book in books) {
		Zotero.Utilities.HTTP.doGet(book, function(text) {
			text = text.replace("MUSIC", "PAMP");
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.translate();
		});
		Zotero.wait();
	}
}