{
	"translatorID":"87766765-919e-4d3b-9071-3dd7efe984c8",
	"translatorType":4,
	"label":"Revues.org",
	"creator":"Michael Berkowitz",
	"target":"http://.*\\.revues\\.org",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-16 20:10:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div[@id="inside"]/div[@class="sommaire"]/dl[@class="documents"]/dd[@class="titre"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()
		|| doc.evaluate('//ul[@class="summary"]//div[@class="title"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//h1[@id="docTitle"]/span[@class="text"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext() || url.match(/document\d+/)) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		if (doc.evaluate('//ul[@class="summary"]//div[@class="title"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//ul[@class="summary"]//div[@class="title"]/a';
		} else if (doc.evaluate('//div[@id="inside"]/div[@class="sommaire"]/dl[@class="documents"]/dd[@class="titre"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="inside"]/div[@class="sommaire"]/dl[@class="documents"]/dd[@class="titre"]/a';
		}
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var title;
		var items = new Object();
		while (title = titles.iterateNext()) {
			items[title.href] = title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
  	Zotero.Utilities.processDocuments(arts, function(doc) {
		var metas = doc.evaluate('//meta', doc, null, XPathResult.ANY_TYPE, null);
		var meta;
		var data = new Object();
		while (meta = metas.iterateNext()) {
			if (data[meta.name]) {
				data[meta.name.toLowerCase()] = data[meta.name.toLowerCase()] + ";" + meta.content;
			} else {
				data[meta.name.toLowerCase()] = meta.content
			}
		}
		var item = new Zotero.Item("journalArticle");
		item.url = data['url'];
		var authors = data['author'].split(';');
		for each (var aut in authors) {
			if (aut.match(/\w+/)) item.creators.push(Zotero.Utilities.cleanAuthor(aut.replace(/(.*)\s([^\s]+)$/, "$2 $1"), "author"));
		}
		item.tags = data['dc.subject'].split(/,\s+/);
		item.date = data['dc.date'];
		item.title = data['dc.title'];
		if (data['dc.relation.ispartof']) item.publicationTitle = data['dc.relation.ispartof'].match(/^[^,]+/)[0];
		item.abstractNote = data['description'];
		if (!item.abstractNote && data['dc.description']) item.abstractNote = data['dc.description'];
		
		item.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}