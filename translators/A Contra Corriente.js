{
	"translatorID":"bbf1617b-d836-4665-9aae-45f223264460",
	"translatorType":4,
	"label":"A Contra Corriente",
	"creator":"Michael Berkowitz",
	"target":"http://www.ncsu.edu/project/acontracorriente",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-03 19:40:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//tr[td[1]//img][td[3]]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var arts = doc.evaluate('//tr[td[1]//img][td[3]]', doc, null, XPathResult.ANY_TYPE, null);
	var art;
	var selectList = new Object();
	var items = new Object();
	while (art = arts.iterateNext()) {
		var item = new Object();
		var title = doc.evaluate('.//a', art, null, XPathResult.ANY_TYPE, null).iterateNext();
		item['title'] = Zotero.Utilities.trimInternal(title.textContent);
		item['pdfurl'] = title.href;
		item['author'] = doc.evaluate('.//strong', art, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		selectList[item.title] = item.title;
		items[item.title] = item;
	}
	var selected = Zotero.selectItems(selectList);
	var voliss = Zotero.Utilities.trimInternal(doc.evaluate('//td[@class="red01"]/font[2]/strong', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
	voliss = voliss.match(/Vol\.\s+(\d+),\s+No\.\s+(\d+)\.\s+([^|]+)|/);
	Zotero.debug(voliss);
	for each (var title in selected) {
		var item = new Zotero.Item("journalArticle");
		var olditem = items[title];
		item.title = olditem.title;
		item.creators = [Zotero.Utilities.cleanAuthor(olditem.author, "author")];
		item.volume = voliss[1];
		item.issue = voliss[2]
		item.date = Zotero.Utilities.trimInternal(voliss[3]);
		item.complete();
	}
}