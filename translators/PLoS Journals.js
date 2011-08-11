{
	"translatorID": "9575e804-219e-4cd6-813d-9b690cbfc0fc",
	"label": "PLoS Journals",
	"creator": "Michael Berkowitz And Rintze Zelle",
	"target": "^http://www\\.plos(one|ntds|compbiol|pathogens|genetics|medicine|biology)\\.org/(search|article)/",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2011-07-03 14:59:21"
}

function detectWeb(doc, url) {
	if (url.indexOf("Search.action") != -1 || url.indexOf("browse.action") != -1 || url.indexOf("browseIssue.action") != -1) {
			return "multiple";
	} else if (url.indexOf("article/info") != -1) {
		return "journalArticle";
	}
}


function getSelectedItems(doc, articleRegEx) {
	var items = {};
	var texts = [];
	var articles = doc.evaluate(articleRegEx, doc, null, XPathResult.ANY_TYPE, null);
	var next_art = articles.iterateNext();
	while (next_art) {
		items[next_art.href] = next_art.textContent;
		next_art = articles.iterateNext();
	}
    Zotero.selectItems(items, function(items) {
    	for (var i in items) {
    		texts.push(i);
    	}
    	processTexts(texts);
    });
}

function doWeb(doc, url) {
	if (url.indexOf("Search.action") != -1 || url.indexOf("browse.action") != -1) {
		var articlex = '//span[@class="article"]/a';
		getSelectedItems(doc, articlex);
	} else if (url.indexOf("browseIssue.action") != -1) {
		var articlex = '//div[@class="article"]/h3/a';
		getSelectedItems(doc, articlex);
	} else {
		processTexts([url]);
	}
    
    Zotero.wait();
}

function processTexts(texts) {
    var risLinks = [];
    for (var i in texts) {
		texts[i]=texts[i].replace(/;jsessionid[^;]+/, "");//Strip sessionID string
		texts[i]=texts[i].replace(/\?.*/, "");//Strip referrer messes
		var risLink = texts[i].replace("info", "getRisCitation.action?articleURI=info");
		risLinks.push(risLink);
	}

	Zotero.Utilities.HTTP.doGet(risLinks, function(text) {
		var risLink = texts.shift();
		var pdfURL = risLink.replace("info", "fetchObjectAttachment.action?uri=info") + '&representation=PDF';
		var doi = risLink.match(/doi(\/|%2F)(.*)$/)[2];
		text = text.replace(text.match(/(ER[^\n]*)([^\0]*)/)[2],"");//Remove stray M3-tag at the end of the RIS record
		text = text.replace("%2F","/");//Replace %2F characters by forward slashes in url
		doi  = doi.replace("%2F","/");//Replace %2F characters by forward slashes in doi
		
		// grab the UR link for a snapshot then blow it away 
		var snapshot = text.match(/UR\s+\-\s+(.*)/)[1];
		text = text.replace(/UR\s+\-(.*)/, "");
				
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			item.url = snapshot;
			item.attachments.push({url:pdfURL, title:"PLoS Full Text PDF", mimeType:"application/pdf"});
			item.attachments.push({url:snapshot, title:"PLoS Snapshot", mimeType:"text/html", snapshot:true});
			item.DOI = doi;
			item.repository = item.publicationTitle;
			item.complete();
		});
		translator.translate();
	}, function() {Zotero.done();});
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.plosbiology.org/article/info%3Adoi%2F10.1371%2Fjournal.pbio.1001090",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Tauzin",
						"firstName": "Sébastien ",
						"creatorType": "author"
					},
					{
						"lastName": "Chaigne-Delalande",
						"firstName": "Benjamin ",
						"creatorType": "author"
					},
					{
						"lastName": "Selva",
						"firstName": "Eric ",
						"creatorType": "author"
					},
					{
						"lastName": "Khadra",
						"firstName": "Nadine ",
						"creatorType": "author"
					},
					{
						"lastName": "Daburon",
						"firstName": "Sophie ",
						"creatorType": "author"
					},
					{
						"lastName": "Contin-Bordes",
						"firstName": "Cécile ",
						"creatorType": "author"
					},
					{
						"lastName": "Blanco",
						"firstName": "Patrick ",
						"creatorType": "author"
					},
					{
						"lastName": "Le Seyec",
						"firstName": "Jacques ",
						"creatorType": "author"
					},
					{
						"lastName": "Ducret",
						"firstName": "Thomas ",
						"creatorType": "author"
					},
					{
						"lastName": "Counillon",
						"firstName": "Laurent ",
						"creatorType": "author"
					},
					{
						"lastName": "Moreau",
						"firstName": "Jean-François ",
						"creatorType": "author"
					},
					{
						"lastName": "Hofman",
						"firstName": "Paul ",
						"creatorType": "author"
					},
					{
						"lastName": "Vacher",
						"firstName": "Pierre ",
						"creatorType": "author"
					},
					{
						"lastName": "Legembre",
						"firstName": "Patrick ",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "PLoS Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"url": false,
						"title": "PLoS Snapshot",
						"mimeType": "text/html",
						"snapshot": true
					}
				],
				"title": "The Naturally Processed CD95L Elicits a c-Yes/Calcium/PI3K-Driven Cell Migration Pathway",
				"date": "June 21, 2011",
				"abstractNote": "The “death receptor” CD95 (also known as Fas) plays an essential role in ensuring immune tolerance of self antigens as well as in the elimination of the body's cells that have been infected or transformed. This receptor is engaged by the membrane-bound ligand CD95L, which can be released into blood circulation after cleavage by metalloproteases. Hitherto, most of the studies on the CD95 signal have been performed with chimeric CD95Ls that mimic the membrane-bound ligand and exhibit a level of aggregation beyond that described for the metalloprotease-cleaved ligand. Multi-aggregated CD95L elicits a caspase-driven apoptotic signal. In this study, we observe that levels of soluble and naturally processed CD95L in sera of patients suffering from lupus correlate with disease severity. Strikingly, although this soluble CD95L fails to trigger cell death unlike its chimeric version, it induces a “non-canonical” Ca2+/c-yes/PI3K-dependent signaling pathway that promotes the transmigration of T-lymphocytes across the endothelial barrier. These findings shed light on an entirely new role for the soluble CD95L that may contribute to local or systemic tissue damage by enhancing the infiltration of activated T-lymphocytes. Overall, these findings underline the importance of revisiting the role of this “apoptotic cytokine” in the context of chronic inflammatory disorders.",
				"publicationTitle": "PLoS Biol",
				"journalAbbreviation": "PLoS Biol",
				"volume": "9",
				"issue": "6",
				"pages": "e1001090",
				"publisher": "Public Library of Science",
				"url": "http://dx.doi.org/10.1371/journal.pbio.1001090",
				"DOI": "10.1371/journal.pbio.1001090",
				"libraryCatalog": "PLoS Biol"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.plosbiology.org/search/simpleSearch.action?from=globalSimpleSearch&filterJournals=PLoSBiology&query=amygdala&x=0&y=0",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.plosmedicine.org/article/info%3Adoi%2F10.1371%2Fjournal.pmed.1000098",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Chiasson",
						"firstName": "T. Carter ",
						"creatorType": "author"
					},
					{
						"lastName": "Manns",
						"firstName": "Braden J. ",
						"creatorType": "author"
					},
					{
						"lastName": "Stelfox",
						"firstName": "Henry Thomas ",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "PLoS Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"url": false,
						"title": "PLoS Snapshot",
						"mimeType": "text/html",
						"snapshot": true
					}
				],
				"title": "An Economic Evaluation of Venous Thromboembolism Prophylaxis Strategies in Critically Ill Trauma Patients at Risk of Bleeding",
				"date": "June 23, 2009",
				"abstractNote": "Using decision analysis, Henry Stelfox and colleagues estimate the cost-effectiveness of three venous thromboembolism prophylaxis strategies in patients with severe traumatic injuries who were also at risk for bleeding complications.",
				"publicationTitle": "PLoS Med",
				"journalAbbreviation": "PLoS Med",
				"volume": "6",
				"issue": "6",
				"pages": "e1000098",
				"publisher": "Public Library of Science",
				"url": "http://dx.doi.org/10.1371/journal.pmed.1000098",
				"DOI": "10.1371/journal.pmed.1000098",
				"libraryCatalog": "PLoS Med"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.plosmedicine.org/search/simpleSearch.action?from=globalSimpleSearch&filterJournals=PLoSMedicine&query=hematoma&x=0&y=0",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.plosmedicine.org/article/browseIssue.action",
		"items": "multiple"
	}
]
/** END TEST CASES **/