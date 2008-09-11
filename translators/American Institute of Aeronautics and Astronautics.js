{
	"translatorID":"75edc5a1-6470-465a-a928-ccb77d95eb72",
	"translatorType":4,
	"label":"American Institute of Aeronautics and Astronautics",
	"creator":"Michael Berkowitz",
	"target":"http://www.aiaa.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-05-12 19:00:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//td/div[@class="title"]/b/div[@class="centerHeadlines"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var items = new Object();
	var oldItems = doc.evaluate('//table/tbody/tr/td[div[@class="title"]]', doc, ns, XPathResult.ANY_TYPE, null);
	var nextItem;
	while (nextItem = oldItems.iterateNext()) {
		var data = new Object();
		data['title'] = Zotero.Utilities.trimInternal(doc.evaluate('./div[@class="title"]//div[@class="centerHeadlines"]', nextItem, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		data['pages'] = Zotero.Utilities.trimInternal(doc.evaluate('./div[@class="title"]//div[@class="centerHeadlinesSub2"]', nextItem, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/[\d\w]+\-[\d\w]+/)[0]);
		data['authors'] = Zotero.Utilities.trimInternal(doc.evaluate('./ul/i', nextItem, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var extra = Zotero.Utilities.trimInternal(doc.evaluate('./ul', nextItem, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var extra = extra.replace(data['authors'], "");
		data['extra'] = Zotero.Utilities.trimInternal(extra);
		var pdf = doc.evaluate('.//a', nextItem, ns, XPathResult.ANY_TYPE, null).iterateNext().href;
		Zotero.debug(pdf);
		data['pdfurl'] = pdf;
		items[data['title']] = data;
	}
	var volume;
	var issue;
	var date;
	if (doc.evaluate('//td[2]/table/tbody/tr/td[1]/strong', doc, ns, XPathResult.ANY_TYPE, null).iterateNext()) {
		var voliss = Zotero.Utilities.trimInternal(doc.evaluate('//td[2]/table/tbody/tr/td[1]/strong', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		voliss = voliss.match(/(\d+)\s+vol\.\s*(\d+)\s+no\.\s*(\d+)/);
		volume = voliss[2];
		issue = voliss[3];
		date = voliss[1];
	} else if (doc.evaluate('//select', doc, ns, XPathResult.ANY_TYPE, null).iterateNext()) {
		var voliss = Zotero.Utilities.trimInternal(doc.evaluate('//select[@name="volume"]/option[@selected]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var issue = Zotero.Utilities.trimInternal(doc.evaluate('//select[@name="issue"]/option[@selected]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		voliss = voliss.match(/vol\.\s*(\d+)\s*\-\s*(\d+)/);
		volume = voliss[1];
		date = voliss[2];
	}
	if (doc.evaluate('//tr[1]/td/b/div[@class="centerHeadlines"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext()) {
		var journal = Zotero.Utilities.trimInternal(doc.evaluate('//tr[1]/td/b/div[@class="centerHeadlines"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var ISSN = Zotero.Utilities.trimInternal(doc.evaluate('//tr[1]/td/font[@class="centerHeadlinesSub2"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(/(\(|\))/g, ""));
	} else if (doc.evaluate('//div[@class="centerHeadlinesTitle"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext()) {
		var journal = Zotero.Utilities.trimInternal(doc.evaluate('//div[@class="centerHeadlinesTitle"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var ISSN = Zotero.Utilities.trimInternal(doc.evaluate('//tr/td[1]/table/tbody/tr[2]/td/div', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/ISSN\s*([\d\-]+)/)[1]);
	}
	var searchItems = new Array();
	for (var i in items) {
		searchItems.push(i);
	}

	searchItems = Zotero.selectItems(searchItems);
	for (var i in items) {
		for each (var title in searchItems) {
			if (i == title) {
				var data = items[i];
				var item = new Zotero.Item("journalArticle");
				item.volume = volume;
				item.issue = issue;
				item.date = date;
				item.title = data['title'];
				item.pages = data['pages'];
				item.publicationTitle = Zotero.Utilities.capitalizeTitle(journal);
				item.ISSN = ISSN;
				if (data['authors'].match(/\w+/)) {
					var authors = data['authors'].split(/(\band\b|,|;)/);
					for each (var aut in authors) {
						if (aut.match(/\w+/) && aut != "and") {
							item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
						}
					}
				}
				item.attachments = [{url:data['pdfurl'], title:"AIAA PDF (first page)", mimeType:"application/pdf"}];
				item.complete();
			}
		}
	}
}