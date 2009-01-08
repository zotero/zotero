{
	"translatorID":"409c520b-0720-4011-8fce-70fcd9806493",
	"translatorType":4,
	"label":"InderScience",
	"creator":"Michael Berkowitz",
	"target":"http://www.inderscience.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.evaluate('/html/body/table/tbody/tr/td[2]/table[tbody/tr/td[3]][2]', doc, null, XPathResult.ANY_TYPE, null).iterateNext() 
		|| doc.evaluate('//td[1][@class="textcontent"]/table/tbody/tr/td[2]/b/u/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.indexOf("rec_id") != -1) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	if (detectWeb(doc, url) == "journalArticle") {
		scrape(url);
	} else if ((detectWeb(doc, url) == "multiple")) {
		if (doc.evaluate('/html/body/table/tbody/tr/td[2]/table[tbody/tr/td[3]]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var items = new Object();
			var results = doc.evaluate('/html/body/table/tbody/tr/td[2]/table[tbody/tr/td[3]]', doc, null, XPathResult.ANY_TYPE, null);
			var result;
			while (result = results.iterateNext()) {
				var title = Zotero.Utilities.trimInternal(doc.evaluate('.//tr[1]/td[3]', result, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
				var id = doc.evaluate('.//tr[8]/td[2]/a[2]', result, null, XPathResult.ANY_TYPE, null).iterateNext().href.match(/rec_id=([^&]+)/)[1];
				items[id] = title;
			}
			items = Zotero.selectItems(items);
			for (var i in items) {
				scrape('http://www.inderscience.com/search/index.php?action=record&rec_id=' + i);
			}
		} else {
			var arts = new Array();
			var items = Zotero.Utilities.getItemArray(doc, doc, "&rec_id");
			items = Zotero.selectItems(items);
			for (var i in items) {
				scrape(i);
			}
		}
	}
	Zotero.wait();
}

function scrape(link) {
	Zotero.Utilities.loadDocument(link, function(newDoc) {
		var data = new Object();
		var rows = newDoc.evaluate('/html/body/table/tbody/tr/td[2]/table[tbody/tr/td[3]]//tr[td[3]]', newDoc, null, XPathResult.ANY_TYPE, null);
		var row;
		while (row = rows.iterateNext()) {
			var tag = Zotero.Utilities.trimInternal(newDoc.evaluate('./td[2]', row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var value = Zotero.Utilities.trimInternal(newDoc.evaluate('./td[3]', row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			data[tag] = value;
		}
		Zotero.debug(data);
		var item = new Zotero.Item("journalArticle");
		item.title = data['Title:'];
		item.abstractNote = data['Abstract:'];
		item.url = newDoc.location.href;
		item.tags = data['Keywords:'].substr(0, data['Keywords:'].length - 1).split(/\s*;\s*/);
		item.DOI = data['DOI:'];
		item.attachments.push({url:item.url, title:item.title + ": InderScience Snapshot", mimeType:"text/html"});
		var authors = data['Author:'].split(/\s*,\s*/);
		for each (var author in authors) {
			item.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
		}
		var voliss = data['Journal:'].match(/^([^\d]+)(\d+)\s*\-\s*Vol\.\s*(\d+)\s*,\s*No\.(.+)pp\.\s*(.*)$/);
		Zotero.debug(voliss);
		item.publicationTitle = voliss[1];
		item.date = voliss[2];
		item.volume = voliss[3];
		item.issue = voliss[4];
		item.pages = voliss[5];
		item.complete();
  	}, function() {Zotero.done();});
}