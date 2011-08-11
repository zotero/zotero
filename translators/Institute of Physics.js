{
	"translatorID": "9346ddef-126b-47ec-afef-8809ed1972ab",
	"label": "Institute of Physics",
	"creator": "Michael Berkowitz and Avram Lyon",
	"target": "^http://iopscience\\.iop\\.org/[0-9-]+/.+",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 99,
	"inRepository": true,
	"translatorType": 4,
	"lastUpdated": "2011-07-30 12:25:40"
}

function detectWeb(doc, url) {
	if (url.indexOf("search") == -1) {
		return "journalArticle";
	} else {
		return "multiple";
	}
}

function fetchDOIs(DOIs) {
	var DOI = DOIs.shift();
	if (!DOI) {
		Zotero.done();
		return true;
	}
	var articleID = DOI.slice(DOI.indexOf('/')+1);
	var pdfURL = "http://iopscience.iop.org/"+articleID+"/pdf/"+articleID.replace("/","_","g")+".pdf";
	var doitranslate = Zotero.loadTranslator("search");
	doitranslate.setTranslator("11645bd1-0420-45c1-badb-53fb41eeb753");
	var item = {"itemType":"journalArticle", "DOI":DOI};
	doitranslate.setSearch(item);
	doitranslate.setHandler("itemDone", function(obj, item) {
		item.url = "http://iopscience.iop.org/"+articleID;
		item.attachments.push({url:pdfURL, title:"IOP Full Text PDF", mimeType:"application/pdf"});
		item.libraryCatalog = "Intitute of Physics";
		item.complete();
		fetchDOIs(DOIs); 
	});

	var fallback = function() {
		Zotero.debug("Error saving using DOI and CrossRef; trying RIS");
		// If there is something wrong with the item
		var postVars = "exportFormat=iopexport_ris&exportType=abs&articleId="+articleID;
		Zotero.Utilities.HTTP.doPost("http://iopscience.iop.org/export", postVars, function(text){
			// load translator for RIS
			var ristranslator = Zotero.loadTranslator ("import");
			ristranslator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			ristranslator.setString(text);
			ristranslator.setHandler("itemDone", function(obj, item) { 
				item.url = "http://iopscience.iop.org/"+articleID;
				item.libraryCatalog = "Intitute of Physics";
				item.attachments.push({url:pdfURL, title:"IOP Full Text PDF", mimeType:"application/pdf"});
				item.complete();
				fetchDOIs(DOIs); 
			});
			ristranslator.translate();
		}, function() {}); 
	}

	doitranslate.setHandler("error", fallback);
	try { doitranslate.translate() } catch (e) {
		Zotero.debug("Caught exception");
		fallback();
	};
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x") return namespace; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var results = doc.evaluate('//div[@class="searchResCol1"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var result;
		while (result = results.iterateNext()) {
			var title = doc.evaluate('.//h4/a', result, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var doi = doc.evaluate('.//span[@class="doi"]/strong/a', result, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			items[doi] = title.trim();
		}
		Zotero.selectItems(items, function(items) {
			if(!items) return true;
			for (var i in items) {
				arts.push(i);
			}
			fetchDOIs(arts);
			Zotero.wait();
		});
	} else {
		var doi = doc.evaluate('//meta[@name="citation_doi"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().content;
		fetchDOIs([doi]);
		Zotero.wait();
	}
}
/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://iopscience.iop.org/0022-3727/34/10/311",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"creatorType": "author",
						"firstName": "J",
						"lastName": "Batina"
					},
					{
						"creatorType": "author",
						"firstName": "F",
						"lastName": "Noël"
					},
					{
						"creatorType": "author",
						"firstName": "S",
						"lastName": "Lachaud"
					},
					{
						"creatorType": "author",
						"firstName": "R",
						"lastName": "Peyrous"
					},
					{
						"creatorType": "author",
						"firstName": "J F",
						"lastName": "Loiseau"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "IOP Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"publicationTitle": "Journal of Physics D: Applied Physics",
				"volume": "34",
				"ISSN": "0022-3727, 1361-6463",
				"date": "2001-05-21",
				"pages": "1510-1524",
				"DOI": "10.1088/0022-3727/34/10/311",
				"url": "http://iopscience.iop.org/0022-3727/34/10/311",
				"title": "Hydrodynamical simulation of the electric wind in a cylindrical vessel with positive point-to-plane device",
				"libraryCatalog": "CrossRef"
			}
		]
	},
	{
		"type": "web",
		"url": "http://iopscience.iop.org/search?searchType=fullText&fieldedquery=fun&f=titleabs&time=all&submit=Search&navsubmit=Search",
		"items": "multiple"
	}
]
/** END TEST CASES **/
