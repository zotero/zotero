{
	"translatorID":"37445f52-64fa-4a2a-9532-35753520a0f0",
	"translatorType":4,
	"label":"HeinOnline",
	"creator":"Michael Berkowitz",
	"target":"http://heinonline\\.org/HOL/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-01-16 06:30:00"
}

function detectWeb(doc, url) {
	if (url.indexOf("LuceneSearch") != -1) {
		return "multiple";
	} else if (url.indexOf("handle=hein.journals")) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	
	var handle = url.match(/handle=([^&]*)&/)[1];
	if (url.match(/&id=(\d+)/)) {
		var id= url.match(/&id=(\d+)/)[1];
	} else if (url.match(/&div=(\d+)/)) {
		var ids = new Array();
		var id = doc.evaluate('//option[@selected="selected"]/@value', doc, null, XPathResult.ANY_TYPE, null);
		var next_id = id.iterateNext();
		while (next_id) {
			ids.push(next_id.textContent);
			next_id = id.iterateNext();
		}
		id = ids[ids.length - 1];
	}
	
	var citationurl = 'http://heinonline.org/HOL/citation-info?handle=' + handle + '&id=' + id;
	var xpath = '//div[@id="guide"]/ul/li[3]/a';
	var journal = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/([^\d]*)/)[1];
	
	var newItem = new Zotero.Item("journalArticle");
	newItem.publicationTitle = Zotero.Utilities.trimInternal(journal);
	newItem.repository = "HeinOnline";
	newItem.url = url;
	
	Zotero.Utilities.HTTP.doGet(citationurl, function(text) {
		var stuff = text.match(/(\d+)\s+([^\d]+)\s+(\d+)\s+\(([-\d]+)\)\s+<br>\s+([^;]+)(;\s*(.*))?/);
		newItem.volume = stuff[1];
		newItem.journalAbbreviation = stuff[2];
		newItem.pages = stuff[3];
		newItem.date = stuff[4];
		newItem.title = Zotero.Utilities.trimInternal(stuff[5]);
		
		if (stuff[7]) {
			var authors = stuff[7].split(';');
			for (var i in authors) {
				authors[i] = authors[i].split(',');
				newItem.creators.push({lastName:authors[i][0], firstName:authors[i][1], creatorType:"author"});
			}
		}
		
		var pdfurl = 'http://heinonline.org/HOL/Print?handle=' + handle + '&id=' + id;
		Zotero.Utilities.HTTP.doGet(pdfurl, function(text) {
			var newurl = text.match(/<a\s+href=\"(PDF[^"]+)\"/i)[1];
			newItem.attachments = [
				{url:url, title:"HeinOnline Snapshot", mimeType:"text/html"},
				{url:'http://heinonline.org/HOL/' + newurl, title:"HeinOnline PDF", mimeType:"application/pdf"}
			];
			newItem.complete();
		});
	});
	Zotero.wait();
}