{
	"translatorID":"0eeb2ac0-fbaf-4994-b98f-203d273eb9fa",
	"translatorType":4,
	"label":"Inter-Research Science Center",
	"creator":"Michael Berkowitz",
	"target":"http://www.int-res.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div[@class="journal-index"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext() ||
		doc.evaluate('//div[@class="tx-indexedsearch-res"]//tr[1]/td[2]//a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//a[@class="citeexport"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	}
}

var journals = {
	meps:["Marine Ecology Progress Series", "Mar Ecol Prog Ser"],
	ab:["Aquatic Biology", "Aquat Biol"],
	ame:["Aquatic Microbial Ecology", "Aquat Microb Ecol"],
	dao:["Diseases of Aquatic Organisms", "Dis Aquat Org"],
	cr:["Climate Research", "Clim Res"],
	esr:["Endangered Species Research", "Endang Species Res"]
};

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.evaluate('//div[@class="tx-indexedsearch-res"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var titlesx = doc.evaluate('//div[@class="tx-indexedsearch-res"]//tr[2]/td[2]', doc, null, XPathResult.ANY_TYPE, null);
			var linksx = doc.evaluate('//div[@class="tx-indexedsearch-res"]//tr[1]/td[2]//a', doc, null, XPathResult.ANY_TYPE, null);
			var title;
			var link;
			while ((title = titlesx.iterateNext()) && (link = linksx.iterateNext())) {
				items[link.href] = Zotero.Utilities.trimInternal(title.textContent).match(/doi:\s+[^\s]+\s+(.*)$/)[1];
			}
		} else {
			var stuff = doc.evaluate('//div[@class="journal-index"]/*[a[contains(text(), "pdf format")]]', doc, null, XPathResult.ANY_TYPE, null);
			var thing;
			var titles = "";
			while (thing = stuff.iterateNext()) {
				titles += thing.textContent;
			}
			titles = titles.split(/\n/);
			Zotero.debug(titles);
			var names = new Array();
			for (var i = 0; i < titles.length; i++) {
				if (((i-1)%2 == 0) && (titles[i].match(/\w+/))) {
					names.push(titles[i]);
				}
			}
			Zotero.debug(names);
			var links = doc.evaluate('//div[@class="journal-index"]/*[a[contains(text(), "pdf format")]]/a[1]', doc, null, XPathResult.ANY_TYPE, null);
			var link;
			while (link = links.iterateNext()) {
				items[link.href] = names.shift();
			}
		}
		
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var item = new Zotero.Item("journalArticle");
		item.title = Zotero.Utilities.trimInternal(doc.evaluate('//div[@class="bb"]/h2', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		item.url = doc.location.href;
		var voliss = item.url.match(/v(\d+)\/(n(\d+)\/)?p([^/]+)\//);
		item.volume = voliss[1];
		item.pages = voliss[4];
		if (voliss[2]) item.issue = voliss[3];
		var jour = item.url.match(/abstracts\/([^/]+)\//)[1];
		item.publicationTitle = journals[jour][0];
		item.journalAbbreviation = journals[jour][1];
		item.abstractNote = Zotero.Utilities.trimInternal(doc.evaluate('//p[@class="abstract_block"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent);
		var authors = Zotero.Utilities.trimInternal(doc.evaluate('//div[@class="bb"]/h3', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent).split(/,\s+/);
		for each (var aut in authors) {
			aut = aut.replace(/[^\w^\s^\.]/g, "").replace(/\d/g, "");
			item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
		}
		item.date = doc.evaluate('//div[@class="abs-footer"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.match(/date:\s+(.*)P/)[1];
		item.DOI = Zotero.Utilities.trimInternal(doc.evaluate('//h1[@class="csc-firstHeader"]/span', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent).match(/doi:\s+(.*)/)[1];
		var tags = doc.evaluate('//div[@class="box"]/p/a', doc, null, XPathResult.ANY_TYPE, null);
		var tag;
		while (tag = tags.iterateNext()) {
			item.tags.push(tag.textContent);
		}		
		var pdfurl = doc.evaluate('//a[contains(@href, ".pdf")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		item.attachments = [
			{url:item.url, title:item.publicationTitle + " Snapshot", mimeType:"text/html"},
			{url:pdfurl, title:item.publicationTitle + " Full Text PDF", mimeType:"application/pdf"}
		];
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}