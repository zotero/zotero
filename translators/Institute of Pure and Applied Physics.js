{
	"translatorID":"0863b8ec-e717-4b6d-9e35-0b2db2ac6b0f",
	"translatorType":4,
	"label":"Institute of Pure and Applied Physics",
	"creator":"Michael Berkowitz",
	"target":"http://(jjap|apex|jpsj)\\.ipap\\.jp/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.title.indexOf("Table of Contents") != -1 || doc.title.indexOf("Search Result") != -1) {
		return "multiple";
	} else if (url.indexOf("link?") != -1) {
		return "journalArticle";
	}
}

var journalNames = {
	jpsj:["Journal of the Physical Society of Japan", "0031-9015"],
	jjap:["Japanese Journal of Applied Physics", "0021-4922"],
	apex:["Applied Physics Express", "1882-0778"]
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title.toLowerCase().indexOf("table of contents") != -1) {
			if (url.match(/apex/)) {
				var titlesx = '//div[@id="contents"]/dl/dt';
				var linksx = '//div[@id="contents"]/dl/dd/a[1]';
			} else if (url.match(/jjap/)) {
				//var xpath = '/html/body/dt/a';
				var titlesx = '//div[@id="contents"]//dl/dt/b';
				var linksx = '//div[@id="contents"]//dl/dd/a[1]';
			} else if (url.match(/jpsj/)) {
				var xpath = '/html/body/dl/dt/a[contains(@href, "link")]';
			}
		} else if (doc.title.toLowerCase().indexOf("search result") != -1) {
			var linksx = '/html/body//li/a';
			var titlesx = '/html/body//li//dt/b';
		}
		if (xpath) {
			var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
			var title;
			while (title = titles.iterateNext()) {
				items[title.href] = Zotero.Utilities.trimInternal(title.textContent);
			}
		} else {
			var titles = doc.evaluate(titlesx, doc, null, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate(linksx, doc, null, XPathResult.ANY_TYPE, null);
			var title;
			var link;
			while ((title = titles.iterateNext()) && (link = links.iterateNext())) {
				items[link.href] = Zotero.Utilities.trimInternal(title.textContent);
			}
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var item = new Zotero.Item("journalArticle");
		item.url = doc.location.href;
		var jour = item.url.match(/http:\/\/([^.]+)\./)[1];
		item.publicationTitle = journalNames[jour][0];
		item.ISSN = journalNames[jour][1];
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//h2[@class="title"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var authors = Zotero.Utilities.trimInternal(doc.evaluate('//p[@class="author"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		authors = authors.replace(/\d+/g, "");
		authors = authors.split(/,\s+(and)?\s*/);
		for each (var aut in authors) {
			if ((aut != "") && (aut != "and")) {
				item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
			}
		}

		//get info
		var infos = doc.evaluate('//p[@class="info"]', doc, null, XPathResult.ANY_TYPE, null);
		var voliss = infos.iterateNext().textContent;
		var keys = infos.iterateNext().textContent;
		if (voliss.match(/([^\d]+)(\d+)\s+\((\d+)\)\s+([\d\-]+)/)) {
			voliss = voliss.match(/([^\d]+)(\d+)\s+\((\d+)\)\s+([\d\-]+)/);
			var x = 4
		} else {
			voliss = voliss.match(/([^\d]+)(\d+)\s+\((\d+)\)\s+(pp\.)?\s+(\S+)/);
			var x = 5
		}
		item.journalAbbreviation = Zotero.Utilities.trimInternal(voliss[1]);
		item.volume = voliss[2];
		item.date = voliss[3];
		item.pages = voliss[x];		
		
		keys = Zotero.Utilities.trimInternal(keys);

		if (keys.match(/KEYWORDS/)) {
			keys = keys.match(/KEYWORDS:\s+(.*)URL:\s+(.*)DOI:\s+(.*)$/);
			var a = 1;
			var c = 3;
		} else {
			keys = keys.match(/URL:\s+(.*)DOI:\s+(.*)$/);
			var c = 2;
		}
		if (a) {
			item.tags = keys[a].split(/,\s+/);
		}
		item.DOI = keys[c];
		item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//p[@class="abstract"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		item.complete();
		var pdfurl = doc.evaluate('//a[contains(text(), "PDF")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		item.attachments = [
			{url:item.url, title:"IPAP Snapshot", mimeType:"text/html"}
		];
	}, function() {Zotero.done();});
	Zotero.wait();
}
