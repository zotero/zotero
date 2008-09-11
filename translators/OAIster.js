{
	"translatorID":"4afb932d-9211-4c0b-a31c-cfa984d62b66",
	"translatorType":4,
	"label":"OAIster",
	"creator":"Michael Berkowitz",
	"target":"http://quod.lib.umich.edu/cgi/b/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-20 19:10:00"
}

function detectWeb(doc, url) {
	if (doc.title.indexOf("OAIster") != -1) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var items = new Array();
	var titlex = '/html/body/table/tbody/tr/td[2]/table/tbody/tr/td/table/tbody/tr[1]/td[4]/font';
	var titles = doc.evaluate(titlex, doc, null, XPathResult.ANY_TYPE, null);
	var title;
	while (title = titles.iterateNext()) {
		items.push(Zotero.Utilities.trimInternal(title.textContent));
	}
	items = Zotero.selectItems(items);
	titles = new Array();
	for each (var title in items) {
		titles.push(title);
	}
	Zotero.debug(titles);
	var xpath = '//table/tbody/tr/td/table/tbody//table/tbody[tr/td[4]]';
	var arts = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
	var art;
	while (art = arts.iterateNext()) {
		var data = new Object();
		var rows = doc.evaluate('./tr[td[4]]', art, null, XPathResult.ANY_TYPE, null);
		var row;
		while (row = rows.iterateNext()) {
			var tag = Zotero.Utilities.trimInternal(doc.evaluate('./td[2]', row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var value = Zotero.Utilities.trimInternal(doc.evaluate('./td[4]', row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			if (tag == "Note") {
				if (!data['Note']) {
					data[tag] = Zotero.Utilities.unescapeHTML(value);
				}
			} else {
				data[tag] = Zotero.Utilities.unescapeHTML(value);
			}
			
		}
		var item = new Zotero.Item();
		if (data['Resource Type']) {
			var itemType = data['Resource Type'];
		} else {
			var itemType = "journalArticle";
		}
		if (itemType == "journalArticle" || itemType.match(/(A|a)rticle/) || itemType.match(/text/)) {
			item.itemType = "journalArticle";
		} else if (itemType.match(/(T|t)hesis/)) {
			item.itemType = "thesis";
		} else if (itemType == "image") {
			item.itemType = "artwork";
		}
		item.title = data['Title'];
		if (data['Author/Creator']) {
			var authors = data['Author/Creator'].split(/;/);
			for each (var aut in authors) {
				if (aut.match(/,/)) {
					aut = aut.split(/,\s+/);
					aut = aut[1] + " " + aut[0];
				}
				item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
			}
		}
		item.date = data['Year']; //.match(/\d{4}\-\d{2}\-\d{2}/)[0];
		item.url = data['URL'];
		if (data['Note']) item.abstractNote = Zotero.Utilities.trimInternal(data['Note']);
		if (data['Subject']) {
			var keys = data['Subject'].split(/;/);
			for each (var kw in keys) {
				if (kw.match(/\w+/)) item.tags.push(kw);
			}
		}
		for (var i in titles) {
			if (item.title == titles[i]) item.complete();
		}
	}
}