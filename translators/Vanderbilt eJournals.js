{
	"translatorID":"882f70a8-b8ad-403e-bd76-cb160224999d",
	"translatorType":4,
	"label":"Vanderbilt eJournals",
	"creator":"Michael Berkowitz",
	"target":"http://ejournals.library.vanderbilt.edu/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-19 17:20:00"
}

function detectWeb(doc, url) {
	if (url.match(/viewarticle.php/)) {
		return "journalArticle";
	} else if (url.match(/viewissue.php/) || url.match(/search.php/)) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function (prefix) {
	    if (prefix == 'x') return n; else return null;
	} : null;
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.evaluate('/html/body/table/tbody/tr/td[2]/ul/li', doc, ns, XPathResult.ANY_TYPE, null).iterateNext()) {
			var results = doc.evaluate('/html/body/table/tbody/tr/td[2]/ul/li', doc, ns, XPathResult.ANY_TYPE, null);
			var titleX = './span[@class="toctitle"]';
			var linkX = './/a[contains(text(), "Abstract")]';
			/*var res;
			while (res = results.iterateNext()) {
				var title = doc.evaluate('./span[@class="toctitle"]', res, ns, XPathResult.ANY_TYPE, null).iterateNext.textContent;
				var link = doc.evaluate('.//a[contains(text(), "Abstract")]', res, ns, XPathResult.ANY_TYPE, null).iterateNext.href;
				items[link] = title;
			}*/
		} else {
			var results = doc.evaluate('//tr[td[3]//a[contains(text(), "Abstract")]]', doc, ns, XPathResult.ANY_TYPE, null);
			var titleX = './td[2]';
			var linkX = './td[3]//a';
		}
		var res;
		while (res = results.iterateNext()) {
			var title = doc.evaluate(titleX, res, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate(linkX, res, ns, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = Zotero.Utilities.trimInternal(title);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var pdfurl = doc.evaluate('//a[contains(text(), "PDF")]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().href;
		var gets = doc.location.href.match(/^(http:\/\/[^/]+\/[^/]+\/).*id=(\d+)/);
		var risurl = gets[1] + 'rst/rst.php?op=capture_cite&id=' + gets[2] + '&cite=refman';
		Zotero.Utilities.HTTP.doGet(risurl, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var voliss = item.publicationTitle.split(/;/);
				item.publicationTitle = voliss[0];
				voliss = voliss[1].match(/Vol\.\s+(\d+)(,\s+No\.\s+(\d+))?\s+\((\d+)\)/);
				item.volume = voliss[1];
				if (voliss[3]) item.issue = voliss[3];
				item.date = voliss[4];				
				item.attachments = [
					{url:item.url, title:item.publicationTitle + " Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:item.publicationTitle + " PDF", mimeType:"application/pdf"}
				];
				item.complete();	
			});
			translator.translate();
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}