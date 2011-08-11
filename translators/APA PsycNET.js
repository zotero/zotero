{
	"translatorID": "1e1e35be-6264-45a0-ad2e-7212040eb984",
	"label": "APA PsycNET",
	"creator": "Michael Berkowitz",
	"target": "^http://psycnet\\.apa\\.org/",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"lastUpdated": "2011-07-29 01:03:06"
}

function detectWeb(doc, url) {
	if (url.match(/search\.searchResults/)) {
		return false;
		//return "multiple";
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
		Zotero.Utilities.processDocuments(arts, scrape, function() {Zotero.done();});
	} else {
		scrape(doc);
	}
	Zotero.wait();
}

function scrape (doc) {
		var namespace = null;
		var newurl = doc.location.href;
		if (doc.evaluate('//input[@name="id"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var id = doc.evaluate('//input[@name="id"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
			var lstSelectedUIDs = doc.evaluate('//input[@name="lstUIDs"][@id="srhLstUIDs"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
			var get = 'http://psycnet.apa.org/index.cfm?fa=search.export'
			var post = 'id=' + id + '&lstUIDs=' + lstSelectedUIDs + '&lstSelectedUIDs=&records=records&displayFormat=&exportFormat=referenceSoftware&printDoc=0';
			// http://psycnet.apa.org/index.cfm?fa=search.exportFormat&singlerecord=1
			// id=&lstSelectedUIDs=&lstUIDs=2004-16644-010&records=records&displayFormat=&exportFormat=referenceSoftware&printDoc=0
			Zotero.Utilities.HTTP.doPost(get, post, function(text) {
				// http://psycnet.apa.org/index.cfm?fa=search.export
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				//Z.debug(text);
				translator.setHandler("itemDone", function(obj, item) {
					//item.url = newurl;
					//item.attachments = [{url:newurl, title:"APA PsycNET Snapshot", mimeType:"text/html"}];
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
	}/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://psycnet.apa.org/index.cfm?fa=search.displayRecord&uid=2004-16644-010",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Hervey",
						"firstName": "Aaron S.",
						"creatorType": "author"
					},
					{
						"lastName": "Epstein",
						"firstName": "Jeffery N.",
						"creatorType": "author"
					},
					{
						"lastName": "Curry",
						"firstName": "John F.",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"attention-deficit/hyperactivity disorder",
					"adults",
					"behavioral inhibition",
					"neuropsychological performance",
					"developmental considerations",
					"neuropsychological deficits",
					"empirical methods"
				],
				"seeAlso": [],
				"attachments": [],
				"itemID": "2004-16644-010",
				"title": "Neuropsychology of Adults With Attention-Deficit/Hyperactivity Disorder: A Meta-Analytic Review.",
				"publicationTitle": "Neuropsychology",
				"volume": "18",
				"issue": "3",
				"pages": "485-503",
				"date": "2004",
				"publisher": "US: American Psychological Association",
				"ISBN": "1931-1559 (Electronic); 0894-4105 (Print)",
				"ISSN": "1931-1559 (Electronic); 0894-4105 (Print)",
				"abstractNote": "A comprehensive, empirically based review of the published studies addressing neuropsychological performance in adults diagnosed with attention-deficit/hyperactivity disorder (ADHD) was conducted to identify patterns of performance deficits. Findings from 33 published studies were submitted to a meta-analytic procedure producing sample-size-weighted mean effect sizes across test measures. Results suggest that neuropsychological deficits are expressed in adults with ADHD across multiple domains of functioning, with notable impairments in attention, behavioral inhibition, and memory, whereas normal performance is noted in simple reaction time. Theoretical and developmental considerations are discussed, including the role of behavioral inhibition and working memory impairment. Future directions for research based on these findings are highlighted, including further exploration of specific impairments and an emphasis on particular tests and testing conditions. (PsycINFO Database Record (c) 2010 APA, all rights reserved)",
				"DOI": "10.1037/0894-4105.18.3.485",
				"libraryCatalog": "APA PsycNET",
				"shortTitle": "Neuropsychology of Adults With Attention-Deficit/Hyperactivity Disorder"
			}
		]
	}
]
/** END TEST CASES **/
