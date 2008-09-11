{
	"translatorID":"5af42734-7cd5-4c69-97fc-bc406999bdba",
	"translatorType":4,
	"label":"ESA Journals",
	"creator":"Michael Berkowitz",
	"target":"http://www.esajournals.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-10 06:15:00"
}

function detectWeb(doc, url) {
	if (url.indexOf("get-toc") != -1 || url.indexOf("searchtype") != -1) {
		return "multiple";
	} else if (url.indexOf("get-document") != -1 || url.indexOf("get-abstract") != -1) {
		return "journalArticle";
	}
}

function senCase(string) {
	var smallwords = Array("AND", "A", "IN", "THE", "BY", "OF");
	var sen = string.split(/\b/);
	for (var i = 0 ; i < sen.length; i++) {
		if (sen[i].match(/\w+/)) {
			if (smallwords.indexOf(sen[i]) != -1 && i != 0) {
				sen[i] = sen[i].toLowerCase();
			} else {
				sen[i] = sen[i][0] + sen[i].substring(1).toLowerCase();
			}
		}
	}
	return sen.join("");
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
       	} : null;
	
	var articles = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var resultItems = doc.evaluate('//div[@class="nocolumn"][@id="content"]/div//*[@class="group"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_item;
		while (next_item = resultItems.iterateNext()) {
			var link = doc.evaluate('.//a[1]', next_item, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			var title = senCase(doc.evaluate('.//*[@class="title"]', next_item, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
	} else {
		articles.push(url);
	}
	Zotero.Utilities.processDocuments(articles, function(newDoc) {
		var newlink = newDoc.evaluate('//a[text() = "Create Reference"]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		var itemurl = newDoc.location.href;
		if (newDoc.evaluate('//a[text() = "Full Text"]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			itemurl = newDoc.evaluate('//a[text() = "Full Text"]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		}
		if (newDoc.evaluate('//div[@class="doc-head"]/p[contains(text(), "DOI")][@class="info"]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var doi = newDoc.evaluate('//div[@class="doc-head"]/p[contains(text(), "DOI")][@class="info"]', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			doi = Zotero.Utilities.trimInternal(doi.substr(4));
		}
		var issn = newDoc.evaluate('//div[@id="pageTitle"]/p/a', newDoc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href.match(/issn=([^&]+)/)[1];
		newlink = newlink.replace('cite-builder', 'download-citation&t=refman&site=esaonline');
		Zotero.Utilities.HTTP.doGet(newlink, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.url = decodeURIComponent(itemurl);
				if (doi) item.DOI = decodeURIComponent(doi);
				var bits = new Array(issn, item.volume, item.issue);
				var pdfurl = 'http://www.esajournals.org/archive/' + bits.join("/") + "/pdf/i" + bits.join("-") + "-" + item.pages.match(/\d+/)[0] + ".pdf";
				item.attachments = [
					{url:item.url, title:"ESA Journals Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"ESA Full Text PDF", mimeType:"application/pdf"}
				];
				item.complete();
			});
			translator.translate();
			
			Zotero.done();
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}