{
	"translatorID": "6614a99-479a-4524-8e30-686e4d66663e",
	"label": "Nature",
	"creator": "Simon Kornblith",
	"target": "https?://www\\.nature\\.com[^/]*/(?:[^/]+/journal/v[^/]+/n[^/]+/(?:(?:full|abs)/.+\\.html|index.html)|search/executeSearch)",
	"minVersion": "1.0.0b3.r1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2011-07-03 04:19:18"
}

var articleRe = /(https?:\/\/[^\/]+\/[^\/]+\/journal\/v[^\/]+\/n[^\/]+\/)(full|abs)(\/.+)\.html/;

function detectWeb(doc, url) {
	if (articleRe.test(url)) {
		if (doc.evaluate('//a[contains(@href, ".ris")]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			return "journalArticle";
		} else {
            return false;
        }
	} else {
    	var links = doc.evaluate('//ol[@class="results-list"]//h2[@class="atl"]/a', doc, null, XPathResult.ANY_TYPE, null);
		
		if(links.iterateNext()) {
			return "multiple";
		}
	}
	
	return false;
}

function doWeb(doc, url) {
	var m = articleRe.exec(url);
	
	if(!m) {
		// search page
		var items = new Array();
		
		var links = doc.evaluate('//ol[@class="results-list"]//h2[@class="atl"]/a', doc, null, XPathResult.ANY_TYPE, null);
		var link;
		while((link = links.iterateNext())) {
			items[link.href] = Zotero.Utilities.trimInternal(link.textContent);
		}
		
		Zotero.selectItems(items, function(items) {
    		if(!items) return true;
    		
    		var urls = new Array();
    		for(var url in items) {
    			urls.push(url);
    		}
            processArticles(urls);
		});
	} else {
        processArticles([url]);
	}
    	
	Zotero.wait();
}

function processArticles(urls) {
    var RIS = new Array();
    var regexps = new Array();
	
	for each(var item in urls) {
		var m = articleRe.exec(item);
		if(m[3][m[3].length-2] == "_") {
			m[3] = m[3].substr(0, m[3].length-2);
		}
		RIS.push(m[1]+"ris"+m[3]+".ris");
		regexps.push(m);
	}
	
	Zotero.Utilities.HTTP.doGet(RIS, function(text) {
		var url = urls.shift();
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			var m = regexps.shift();
			item.attachments = [
				{url:m[0], title:"Nature Snapshot", mimeType:"text/html"},
				{url:m[1]+"pdf"+m[3]+".pdf", title:"Nature Full Text PDF", mimeType:"application/pdf"}
			]
			
			item.notes = new Array();
			if (item.date) item.date = item.date.replace("print ", "");
			
			item.complete();
		});
		translator.translate();
	}, function() { Zotero.done(); });
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.nature.com/emboj/journal/vaop/ncurrent/full/emboj2011212a.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Huang",
						"firstName": "Jian",
						"creatorType": "author"
					},
					{
						"lastName": "Yao",
						"firstName": "Ling",
						"creatorType": "author"
					},
					{
						"lastName": "Xu",
						"firstName": "Rongting",
						"creatorType": "author"
					},
					{
						"lastName": "Wu",
						"firstName": "Huacheng",
						"creatorType": "author"
					},
					{
						"lastName": "Wang",
						"firstName": "Min",
						"creatorType": "author"
					},
					{
						"lastName": "White",
						"firstName": "Brian S",
						"creatorType": "author"
					},
					{
						"lastName": "Shalloway",
						"firstName": "David",
						"creatorType": "author"
					},
					{
						"lastName": "Zheng",
						"firstName": "Xinmin",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "Nature Snapshot",
						"mimeType": "text/html"
					},
					{
						"url": false,
						"title": "Nature Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "Activation of Src and transformation by an RPTP[alpha] splice mutant found in human tumours",
				"journalAbbreviation": "EMBO J",
				"date": "online July 01, 2011",
				"volume": "advance online publication",
				"publisher": "European Molecular Biology Organization",
				"ISBN": "1460-2075",
				"ISSN": "1460-2075",
				"url": "http://dx.doi.org/10.1038/emboj.2011.212",
				"DOI": "10.1038/emboj.2011.212",
				"publicationTitle": "EMBO J",
				"libraryCatalog": "Nature"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.nature.com/nrn/journal/v12/n7/abs/nrn3042.html",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Heinz",
						"firstName": "Adrienne J.",
						"creatorType": "author"
					},
					{
						"lastName": "Beck",
						"firstName": "Anne",
						"creatorType": "author"
					},
					{
						"lastName": "Meyer-Lindenberg",
						"firstName": "Andreas",
						"creatorType": "author"
					},
					{
						"lastName": "Sterzer",
						"firstName": "Philipp",
						"creatorType": "author"
					},
					{
						"lastName": "Heinz",
						"firstName": "Andreas",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "Nature Snapshot",
						"mimeType": "text/html"
					},
					{
						"url": false,
						"title": "Nature Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "Cognitive and neurobiological mechanisms of alcohol-related aggression",
				"journalAbbreviation": "Nat Rev Neurosci",
				"date": "July 2011",
				"volume": "12",
				"issue": "7",
				"pages": "400-413",
				"publisher": "Nature Publishing Group, a division of Macmillan Publishers Limited. All Rights Reserved.",
				"ISBN": "1471-003X",
				"ISSN": "1471-003X",
				"url": "http://dx.doi.org/10.1038/nrn3042",
				"DOI": "10.1038/nrn3042",
				"publicationTitle": "Nat Rev Neurosci",
				"libraryCatalog": "Nature"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.nature.com/search/executeSearch?sp-q-1=&sp-q=nature&sp-p=all&sp-c=25&sp-m=0&sp-s=date_descending&include-collections=journals_nature%2Ccrawled_content&exclude-collections=journals_palgrave%2Clab_animal&sp-a=sp1001702d&sp-sfvl-field=subject%7Cujournal&sp-x-1=ujournal&sp-p-1=phrase&submit=go",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.nature.com/search/executeSearch?sp-q-1=NRN&sp-q=visual+search&sp-c=25&sp-m=0&sp-s=date_descending&include-collections=journals_nature%2Ccrawled_content&exclude-collections=journals_palgrave%2Clab_animal&sp-a=sp1001702d&sp-sfvl-field=subject%7Cujournal&sp-x-1=ujournal&sp-p-1=phrase&sp-p=all&submit=go",
		"items": "multiple"
	}
]
/** END TEST CASES **/