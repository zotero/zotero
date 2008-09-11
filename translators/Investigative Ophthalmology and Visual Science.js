{
	"translatorID":"4654c76f-451c-4ae6-9a36-575e982b3cdb",
	"translatorType":4,
	"label":"Investigative Ophthalmology and Visual Science",
	"creator":"Michael Berkowitz",
	"target":"http://www.iovs.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-03-14 19:10:00"
}

function detectWeb(doc, url) {
	if (doc.title.indexOf("Table of Contents") != -1 || doc.title.indexOf("Search Result") != -1) {
		return "multiple"
	} else if (url.indexOf("abstract") != -1 || url.indexOf("full") != -1) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var host = doc.location.host;
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title.indexOf("Search Result") != -1) {
			var boxes = doc.evaluate('//table/tbody/tr/td/font/table/tbody/tr[1]', doc, null, XPathResult.ANY_TYPE, null);
			var box;
			while (box = boxes.iterateNext()) {
				var id = doc.evaluate('.//input', box, null, XPathResult.ANY_TYPE, null).iterateNext().value;
				var titles = doc.evaluate('./td/font/strong', box, null, XPathResult.ANY_TYPE, null);
				var titletext = '';
				var title;
				while (title = titles.iterateNext()) {
					titletext += title.textContent;
				}
				items[id] = titletext;
			}
		} else if (doc.title.indexOf("Table of Content") != -1) {
			var ids = doc.evaluate('/html/body/form/dl/dt/input', doc, null, XPathResult.ANY_TYPE, null);
			var titles = doc.evaluate('/html/body/form/dl/dd/strong', doc, null, XPathResult.ANY_TYPE, null);
			var id;
			var title;
			while ((title = titles.iterateNext()) && (id = ids.iterateNext())) {
				items['iovs;' + id.value] = title.textContent;
			}
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [doc.evaluate('//a[contains(@href, "citmgr")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href.match(/=(.*)$/)[1]]
	}
	Zotero.debug(arts);
	for each (var id in arts) {
		var post = 'type=refman&gca=' + id;
		Zotero.debug(post);
		post = 'http://www.iovs.org/cgi/citmgr?' + post;
		Zotero.debug(post);
		Zotero.Utilities.HTTP.doGet(post, function(text) {
			Zotero.debug(text);
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var pdfurl = item.url.replace(/content\/[^/]+/, "reprint") + ".pdf";
				item.attachments = [
					{url:item.url, title:"IOVS Snapshot", mimeType:"text/html"},
					{url:pdfurl, tite:"IOVS Full Text PDF", mimeType:"application/pdf"}
				];
				if (item.notes[0]['note'].match(/\d/)) {
					item.DOI = item.notes[0]['note'];
					item.notes = new Array();
				}
				item.complete();
			});
			translator.translate();
			
			Zotero.done();		
		});
	}
}