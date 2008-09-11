{
	"translatorID":"cdf8269c-86b9-4039-9bc4-9d998c67740e",
	"translatorType":4,
	"label":"Verniana-Jules Verne Studies",
	"creator":"Michael Berkowitz",
	"target":"http://jv.gilead.org.il/studies/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-21 19:15:00"
}

function detectWeb(doc, url) {
	if (url.match(/article\/view/)) {
		return "journalArticle";
	} else  if (url.match(/(issue|advancedResults)/)) {
		return "multiple";
	}
}

function prepNos(link) {
	if (link.match(/\d+\/\d+$/)) {
		var nos = link.match(/\d+\/\d+$/)[0];
	} else {
		var nos = link.match(/\d+$/)[0] + '/0';
	}
	return 'http://jv.gilead.org.il/studies/index.php/studies/rt/captureCite/' + nos + '/RefManCitationPlugin';
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var xpath = '//tr[td/a[2]]';
		if (url.match(/issue/)) {
			var titlex = './td[1]';
			var linkx = './td[2]/a[contains(text(), "HTML")]';
		} else if (url.match(/advanced/)) {
			var titlex = './td[2]';
			var linkx = './td[3]/a[contains(text(), "HTML")]';
		}
		var results = doc.evaluate(xpath, doc, ns, XPathResult.ANY_TYPE, null);
		var result;
		while (result = results.iterateNext()) {
			var title = Zotero.Utilities.trimInternal(doc.evaluate(titlex, result, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var link = doc.evaluate(linkx, result, ns, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(prepNos(i));
		}
	} else {
		arts = [prepNos(url)];
	}
	Zotero.Utilities.HTTP.doGet(arts, function(text) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			var auts = new Array();
			for each (var aut in item.creators) {
				auts.push(Zotero.Utilities.cleanAuthor(aut.lastName, "author"));
			}
			item.creators = auts;
			item.attachments = [{url:item.url, title:"Verniana Snapshot", mimeType:"text/html"}];
			var bits = item.publicationTitle.split(/;/);
			item.publicationTitle = bits[0];
			var voliss = bits[1].match(/Vol\s+(\d+)\s+\((\d+)\)/);
			item.volume = voliss[1];
			item.date = voliss[2];
			item.complete();	
		});
		translator.translate();
	});
	Zotero.wait();
}