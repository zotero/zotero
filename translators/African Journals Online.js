{
	"translatorID":"9d822257-2eec-4674-b6d0-2504f54c8890",
	"translatorType":4,
	"label":"African Journals Online",
	"creator":"Michael Berkowitz",
	"target":"http://www.ajol.info",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-04-18 08:55:00"
}

function detectWeb(doc, url) {
	if (url.match(/viewarticle.php/)) {
		return "journalArticle";
	} else if (url.match(/search.php/) || url.match(/viewissue.php/)) {
		return "multiple";
	}
}

function getID(str) {
	return str.match(/(&|\?)id=(\d+)&?/)[2];
}

function doWeb(doc, url) {
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		if (url.match(/search.php/)) {
			var items = Zotero.Utilities.getItemArray(doc, doc, "viewarticle.php?");
		} else if (url.match("viewissue.php")) {
			var items = new Object();
			var titles = doc.evaluate('//span[@class="toctitle"]', doc, null, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate('//a[text() = "Abstract"]', doc, null, XPathResult.ANY_TYPE, null);
			var title;
			var link;
			while ((title = titles.iterateNext()) && (link = links.iterateNext())) {
				items[link.href] = Zotero.Utilities.trimInternal(title.textContent);
			}
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(getID(i));
		}
	} else {
		articles = [getID(url)];
	}
	Zotero.debug(articles);
	for each (var id in articles) {
		var getstr = 'http://www.ajol.info/rst/rst.php?op=capture_cite&id=' + id + '&cite=refman';
		Zotero.Utilities.HTTP.doGet(getstr, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var pubinfo = item.publicationTitle.match(/(.*);([^;]+)$/);
				item.publicationTitle = pubinfo[1];
				var voliss = pubinfo[2].toLowerCase();
				if (voliss.match(/v/)) item.volume = voliss.match(/v(ol\.)?\s+(\d+)/)[2];
				if (voliss.match(/n/)) item.issue = voliss.match(/n(o\.)?\s+(\d+)/)[2];
				if (voliss.match(/p(age)?/)) item.pages = voliss.match(/\d+\-\d+/)[0];
				item.date = voliss.match(/\(([^)]+)\)/)[1];
				item.attachments[0].title = "African Journals Online Snapshot";
				item.attachments[0].mimeType = "text/html";
				item.complete();
			});
			translator.translate();
		});
	}
}