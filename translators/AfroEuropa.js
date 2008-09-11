{
	"translatorID":"4f62425a-c99f-4ce1-b7c1-5a3ac0d636a3",
	"translatorType":4,
	"label":"AfroEuropa",
	"creator":"Michael Berkowitz",
	"target":"http://journal.afroeuropa.eu/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-20 19:10:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//tr[td/a[2]]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.match(/article\/view\//)) {
		return "journalArticle";
	}
}

function makeExport(site, str) {
	var nums = str.match(/\d+(\/\d+)?/)[0];
	if (!nums.match(/\//)) nums += "/0";
	return site + 'rt/captureCite/' + nums + '/referenceManager';
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var site = url.match(/^http:\/\/([^/]*\/)+index\.php\/[^/]*\//)[0];
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var xpath = '//tr[td/a]';
		if (url.match(/search/)) {
			var titlex = './td[2]';
			var linkx = './td[3]/a[1]';
		} else if (url.match(/issue/)) {
			var titlex = './td[1]';
			var linkx = './td[2]/a[1]';
		}
		var items = new Object();
		var results = doc.evaluate(xpath, doc, ns, XPathResult.ANY_TYPE, null);
		var result;
		while (result = results.iterateNext()) {
			var title = Zotero.Utilities.trimInternal(doc.evaluate(titlex, result, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var link = doc.evaluate(linkx, result, ns, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[makeExport(site, link)] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [makeExport(cite, url)];
	}
	Zotero.Utilities.HTTP.doGet(arts, function(text) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			item.title = Zotero.Utilities.capitalizeTitle(item.title);
			var voliss = item.publicationTitle.split(/;\s+/);
			item.publicationTitle = Zotero.Utilities.trimInternal(voliss[0]);
			voliss = voliss[1].match(/(\d+),\s+No\s+(\d+)\s+\((\d+)\)/);
			item.volume = voliss[1];
			item.issue = voliss[2];
			item.date = voliss[3];
			var auts = new Array();
			for each (var aut in item.creators) {
				auts.push(aut.lastName);
			}
			item.creators = new Array();
			for each (var aut in auts) {
				item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
			}
			item.attachments[0].mimeType = "text/html";
			item.attachments[0].title = "AfroEuropa Snapshot";
			item.complete();
		});
		translator.translate();
	});
	Zotero.wait();
}