{
	"translatorID":"1e1e35be-6264-45a0-ad2e-7212040eb984",
	"translatorType":4,
	"label":"APA PsycNET",
	"creator":"Michael Berkowitz",
	"target":"http://psycnet\\.apa\\.org/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match(/search\.searchResults/)) {
		return "multiple";
	} else if (url.match(/search\.displayRecord/)) {
		return "journalArticle";
	}
}

function associateXPath(xpath, doc, ns) {
	return Zotero.Utilities.trimInternal(doc.evaluate(xpath, doc, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var titles = doc.evaluate('//div[@class="srhcTitle"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var title;
		while (title = titles.iterateNext()) {
			items[title.href] = title.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(doc) {
		var newurl = doc.location.href;
		if (doc.evaluate('//input[@name="id"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var id = doc.evaluate('//input[@name="id"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
			var lstSelectedUIDs = doc.evaluate('//input[@name="lstUIDs"][@id="srhLstUIDs"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().value;
			var get = 'http://psycnet.apa.org/index.cfm?fa=search.export&id=' + id + '&lstSelectedUIDs=' + lstSelectedUIDs + '&lstUIDs=&records=selected&displayFormat=&exportFormat=referenceSoftware&printDoc=0';
			Zotero.Utilities.HTTP.doGet(get, function(text) {
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					item.url = newurl;
					item.attachments = [{url:newurl, title:"APA PsycNET Snapshot", mimeType:"text/html"}];
					item.complete();
				});
				translator.translate();
			});
		} else {
			var item = new Zotero.Item("journalArticle");
			item.title = associateXPath('//div[@id="rdcTitle"]', doc, nsResolver);
			var authors = associateXPath('//div[@id="rdcAuthors"]', doc, nsResolver).split(/;\s+/);
			for each (var aut in authors) {
				item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author", true));
			}
			var voliss = associateXPath('//div[@id="rdcSource"]', doc, nsResolver).match(/^([^\.]+)\.\s+(\d+\s+\w+)\s+Vol\s+(\d+)\((\d+)\)\s+(.*)$/);
			item.publicationTitle = voliss[1];
			item.date = voliss[2];
			item.volume = voliss[3];
			item.issue = voliss[4];
			item.pages = voliss[5];
			item.abstractNote = associateXPath('//div[@id="rdRecord"]/div[@class="rdRecordSection"][2]', doc, nsResolver);
			item.complete();			
		}
	}, function() {Zotero.done();});
	Zotero.wait();
}