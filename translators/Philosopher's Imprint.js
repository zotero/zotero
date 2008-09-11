{
	"translatorID":"b0abb562-218c-4bf6-af66-c320fdb8ddd3",
	"translatorType":4,
	"label":"Philosopher's Imprint",
	"creator":"Michael Berkowitz",
	"target":"http://quod.lib.umich.edu/cgi/t/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-04-01 04:50:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div/span[text() = "Search Results"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (url.match(/\d+\.\d+\.\d+/)) {
		return "journalArticle";
	}
}

function getID(str) {
	return str.match(/\d+\.\d+\.\d+/)[0];
}
function doWeb(doc, url) {
	var ids = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var titles = doc.evaluate('//div[@class="itemcitation"]//a', doc, null, XPathResult.ANY_TYPE, null);
		var title;
		while (title = titles.iterateNext()) {
			items[title.href] = title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			ids.push('http://quod.lib.umich.edu/cgi/t/text/text-idx?c=phimp;view=text;rgn=main;idno=' + getID(i));
		}
	} else {
		ids = ['http://quod.lib.umich.edu/cgi/t/text/text-idx?c=phimp;view=text;rgn=main;idno=' + getID(url)];
	}
	Zotero.Utilities.processDocuments(ids, function(newDoc) {
		var rows = newDoc.evaluate('//tr[td[@id="labelcell"]]', newDoc, null, XPathResult.ANY_TYPE, null);
		var row;
		var data = new Object();
		while (row = rows.iterateNext()) {
			var heading = newDoc.evaluate('./td[1]', row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var value = newDoc.evaluate('./td[2]', row, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			data[heading.replace(/[\s:]/g, "")] = value;
		}
		var item = new Zotero.Item("journalArticle");
		item.title = Zotero.Utilities.trimInternal(data['Title']);
		if (data['Author']) {
			item.creators.push(Zotero.Utilities.cleanAuthor(data['Author'], "author"));
		} else if (data['Authors']) {
			var authors = data['Authors'].split(",");
			for each (var a in authors) {
				item.creators.push(Zotero.Utilities.cleanAuthor(a, "author"));
			}
		}
		if (data['Keywords']) {
			var kws = data['Keywords'].split(/\n/);
			for each (var kw in kws) {
				if (kw != "") item.tags.push(kw);
			}
		}
		var voliss = data['Source'].replace(item.title, "");
		if (item.creators.length > 1) {
			voliss = voliss.replace(data['Authors'], "");
		} else if (item.creators.length == 1) {
			voliss = voliss.replace(data['Author'], "");
		}
		Zotero.debug(voliss);
		item.volume = voliss.match(/vol\.\s+(\d+)/)[1];
		item.issue = voliss.match(/no\.\s+(\d+)/)[1];
		item.pages = voliss.match(/pp\.\s+([\d\-]+)/)[1];
		item.date = Zotero.Utilities.trimInternal(voliss.match(/[^,]+$/)[0]);
		item.place = "Ann Arbor, MI";
		item.publisher = "University of Michigan";
		item.abstractNote = data['Abstract'];
		item.url = data['URL'];
		item.attachments = [
			{url:item.url, title:item.title + " Snapshot", mimeType:"text/html"},
			{url:'http://quod.lib.umich.edu/p/phimp/images/' + getID(item.url) + '.pdf', title:"Philosopher's Imprint Full Text PDF", mimeType:"application/pdf"}
		];
		item.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}