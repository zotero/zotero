{
	"translatorID":"966a7612-900c-42d9-8780-2a3247548588",
	"translatorType":4,
	"label":"eMJA",
	"creator":"Michael Berkowitz",
	"target":"http://www.mja.com.au/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//p[@class="Pfoot"]/b/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext() || doc.evaluate('/html/body/table/tbody/tr[1]/td[2]/a/b', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.title.indexOf("eMJA:") != -1) {
		return "journalArticle";
	}
}

function senCase(string) {
	var smallwords = Array("and", "a", "in", "the", "by", "of", "s", "on");
	var sen = string.split(/\b/);
	for (var i = 0 ; i < sen.length; i++) {
		if (sen[i].match(/\w+/)) {
			if (smallwords.indexOf(sen[i]) != -1 && i != 0) {
				sen[i] = sen[i].toLowerCase();
			} else {
				sen[i] = sen[i][0].toUpperCase() + sen[i].substring(1).toLowerCase();
			}
		}
	}
	return sen.join("");
}

function doWeb(doc, url) {
	var URIs = new Array();
	
	if (doc.evaluate('//p[@class="Pfoot"]/b/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var xpath = '//p[@class="Pfoot"]/b/a';
	} else if (doc.evaluate('//tr[1]/td[2]/a/b', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var xpath = '//tr[1]/td[2]/a/b';
		var linkpath = '//tr[2]/td[2]/small[@class="gr"]';
	}
	
	if (xpath) {
		if (linkpath) {
			var items = new Object();
			var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
			var links = doc.evaluate(linkpath, doc, null, XPathResult.ANY_TYPE, null);
			var title = titles.iterateNext();
			var link = links.iterateNext();
			while (title) {
				//Zotero.debug(Zotero.Utilities.cleanString(title.textContent));
				//Zotero.debug(Zotero.Utilities.cleanString(link.textContent));
				items[Zotero.Utilities.cleanString(link.textContent)] = Zotero.Utilities.cleanString(title.textContent).substring(6);
				title = titles.iterateNext();
				link = links.iterateNext();
			}
		} else {
			var items = new Object();
			var things = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
			var next_thing = things.iterateNext();
			while (next_thing) {
				items[next_thing.href] = senCase(Zotero.Utilities.cleanString(next_thing.textContent));
				next_thing = things.iterateNext();
			}
		}
		items = Zotero.selectItems(items);
		Zotero.debug(items);
		for (var i in items) {
			URIs.push(i);
		}
	} else {
		URIs.push(url);
	}
	Zotero.debug(URIs);
	Zotero.Utilities.processDocuments(URIs, function(newDoc) {
		var newItem = new Zotero.Item("journalArticle");
		newItem.title = senCase(newDoc.title.substring(6));
		
		newItem.publicationTitle = "The Medical Journal of Australia";
		newItem.ISSN = "0025-729X";
		newItem.url = newDoc.location.href;
		
		//date
		newItem.date = newDoc.evaluate('//meta[@name="date"]/@content', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent.substring(0,10);
		
		//voliss
		var voliss = newDoc.evaluate('//meta[@name="citation"]/@content', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		//voliss = voliss.match(/[^\d]+(\d+)\s+\((\d+)\)/);
		voliss = voliss.match(/;\s+(\d+)\s+\((\d+)[^:]+:\s+(.*)\.$/);
		newItem.volume = voliss[1];
		newItem.issue = voliss[2];
		newItem.pages = voliss[3];
		
		//authors
		var authors = new Array();
		var apath = '//div[@class="By"]/span[@class="Pn"]';
		var author = newDoc.evaluate(apath, newDoc, null, XPathResult.ANY_TYPE, null);
		var next_a = author.iterateNext();
		while (next_a) {
			var name = next_a.textContent;
			if (name.substring(0,1) == ",") {
				name = name.substring(2);
			} else if (name.substring(0,4) == " and") {
				name = name.substring(5);
			}
			authors.push(name);
			next_a = author.iterateNext();
		}
		
		for (var i in authors) {
			newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
		}
		
		//attachments
		newItem.attachments = [
			{url:newDoc.location.href, title:"eMJA Snapshot", mimeType:"text/html"},
			{url:newDoc.location.href.replace(".html", ".pdf") , title:"eMJA PDF", mimeType:"application/pdf"}
		];
		newItem.complete();
	}, function() {Zotero.done();});
}