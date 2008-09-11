{
	"translatorID":"0c661209-5ec8-402b-8f18-7dec6ae37d95",
	"translatorType":4,
	"label":"The Free Dictionary",
	"creator":"Michael Berkowitz",
	"target":"http://(.*\\.)?thefreedictionary.com/(\\w+)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-15 00:30:00"
}

function detectWeb(doc, url) {
	return "dictionaryEntry";
}

function doWeb(doc, url) {
	var item = new Zotero.Item('dictionaryEntry');
	item.title = Zotero.Utilities.capitalizeTitle(url.replace("+", " ").match(/[^/]+$/)[0]);
	item.dictionaryTitle = "The Free Dictionary";
	var defs = doc.evaluate('//div[@class="pseg"]', doc, null, XPathResult.ANY_TYPE, null);
	var def;
	while (def = defs.iterateNext()) {
		item.notes.push({note:Zotero.Utilities.trimInternal(def.textContent)});
	}
	item.url = 
	item.complete();
}