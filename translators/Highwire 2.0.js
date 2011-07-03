{
	"translatorID": "8c1f42d5-02fa-437b-b2b2-73afc768eb07",
	"label": "Highwire 2.0",
	"creator": "Matt Burton",
	"target": "(content/([0-9]+/[0-9]+|current|firstcite|early)|search\\?submit=|search\\?fulltext=|cgi/collection/.+)",
	"minVersion": "2,1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2011-07-03 03:57:24"
}

/*
 Translator for several Highwire journals. Example URLs:

1. Ajay Agrawal, Iain Cockburn, and John McHale, “Gone but not forgotten: knowledge flows, labor mobility, and enduring social relationships,” Journal of Economic Geography 6, no. 5 (November 2006): 571-591.
	http://joeg.oxfordjournals.org/content/6/5/571 :
2. Gordon L. Clark, Roberto Durán-Fernández, and Kendra Strauss, “‘Being in the market’: the UK house-price bubble and the intended structure of individual pension investment portfolios,” Journal of Economic Geography 10, no. 3 (May 2010): 331-359.
	http://joeg.oxfordjournals.org/content/10/3/331.abstract
3. Hans Maes, “Intention, Interpretation, and Contemporary Visual Art,” Brit J Aesthetics 50, no. 2 (April 1, 2010): 121-138.
	http://bjaesthetics.oxfordjournals.org/cgi/content/abstract/50/2/121
4. M L Giger et al., “Pulmonary nodules: computer-aided detection in digital chest images.,” Radiographics 10, no. 1 (January 1990): 41-51.
	http://radiographics.rsna.org/content/10/1/41.abstract
5. Mitch Leslie, "CLIP catches enzymes in the act," The Journal of Cell Biology 191, no. 1 (October 4, 2010): 2.
       http://jcb.rupress.org/content/191/1/2.2.short
*/

function detectWeb(doc, url) {
	var highwiretest = false;
	
	highwiretest = url.match(/\.pdf+html\?frame=header/);
	
	if (!highwiretest) {
		// lets hope this installations don't tweak this...
		highwiretest = doc.evaluate("//link[@href = '/shared/css/hw-global.css']", doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	}
	
	if(highwiretest) {
		
		if (
			url.match("search\\?submit=") ||
			url.match("search\\?fulltext=") ||
			url.match("content/by/section") || 
			doc.title.match("Table of Contents") || 
			doc.title.match("Early Edition") || 
			url.match("cgi/collection/.+") || 
			url.match("content/firstcite") 
		) {
			return "multiple";
		} else if (url.match("content/(early/)?[0-9]+")) {
			return "journalArticle";
		} 
	}
}

var host;
function doWeb(doc, url) {
	if (!url) url = doc.documentElement.location;
	else if (url.match(/\?frame=header/)) {
		// recall all this using new url
		url = url.replace(/\?.*/,"?frame=sidebar");
		Zotero.Utilities.processDocuments(url,
				function(newdoc) {
					doWeb(newdoc, url);
				}, function() {Zotero.done()});
		Zotero.wait();
		return true;
	}
	
	host = 'http://' + doc.location.host + "/";
	
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title.match("Table of Contents")
			|| doc.title.match("Early Edition")
			|| url.match("content/firstcite")) {
			var searchx = '//li[contains(@class, "toc-cit") and not(ancestor::div/h2/a/text() = "Correction" or ancestor::div/h2/a/text() = "Corrections")]'; 
			var titlex = './/h4';
		} else if (url.match("content/by/section") || url.match("cgi/collection/.+")) {
			var searchx = '//li[contains(@class, "results-cit cit")]'; 
			var titlex = './/span[contains(@class, "cit-title")]';
		}
		else {
			var searchx = '//div[contains(@class,"results-cit cit")]';
			var titlex = './/span[contains(@class,"cit-title")]';
		}	
		var linkx = './/a[1]';
		var searchres = doc.evaluate(searchx, doc, null, XPathResult.ANY_TYPE, null);
		var next_res;
		while (next_res = searchres.iterateNext()) {
			var title = doc.evaluate(titlex, next_res, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate(linkx, next_res, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		Zotero.selectItems(items, function(items) {
            if(!items) return;
            
            var arts = [];
    		for (var i in items) {
    			arts.push(i);
    		}
            processArticles(arts);
		});
	} else {
		processArticles([url]);
	}
	
	Zotero.wait();
}

function processArticles(arts) {
    if(arts.length == 0) {
		Zotero.debug('no items');
		return false;
	}
    var newurls = arts.slice();
	Zotero.Utilities.HTTP.doGet(arts, function(text) {
		var id, match, newurl, pdfurl, get;
		/* Here, we have to use three phrasings because they all occur, depending on
		   the journal.
                TODO We should rewrite this to not use regex! */
		match = text.match(/=([^=]+)\">\s*Download (C|c)itation/);
		if (!match || match.length < 1) {
			match = text.match(/=([^=]+)\">\s*Download to citation manager/);
			if (!match || match.length < 1) {
				// Journal of Cell Biology
          			match = text.match(/=([^=]+)\">\s*Add to Citation Manager/);
        		}
		}
		id = match[1];
		newurl = newurls.shift();		
		if (newurl.match("cgi/content")) {
			pdfurl = newurl.replace(/cgi\/content\/abstract/, "content") + ".full.pdf";
		// This is here to catch those pdf+html pages
		} else if (newurl.match("\.full\.pdf")) {
			pdfurl = newurl.slice(0, newurl.lastIndexOf(".full.pdf")) + ".full.pdf";
		} else {
			// This is not ideal...todo: brew a regex that grabs the correct URL
			pdfurl = newurl.slice(0, newurl.lastIndexOf(".")) + ".full.pdf";
		}
		get = host + 'citmgr?type=refman&gca=' + id;
		Zotero.Utilities.HTTP.doGet(get, function(text) {
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			// Sometimes Highwire 2.0 has blank entries for N1
			if (text.match(/N1\s+\-\s+(10\..*)\n/)) {
				var doi = text.match(/N1\s+\-\s+(.*)\n/)[1];
			}
			translator.setHandler("itemDone", function(obj, item) {
				item.attachments = [
					{url:newurl, title:"Snapshot", mimeType:"text/html"},
					{url:pdfurl, title:"Full Text PDF", mimeType:"application/pdf"}
				];
				if (doi) item.DOI = doi;
				if (item.notes) item.notes = [];
				item.complete();
			});
			translator.translate();
		});
	});
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://jcb.rupress.org/content/191/1/2.2.short",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Leslie",
						"firstName": "Mitch",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"url": false,
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "CLIP catches enzymes in the act ",
				"date": "October 04 , 2010",
				"publicationTitle": "The Journal of Cell Biology ",
				"pages": "2 ",
				"volume": "191 ",
				"issue": "1 ",
				"url": "http://jcb.rupress.org/content/191/1/2.2.short ",
				"DOI": "10.1083/jcb.1911iti2 ",
				"libraryCatalog": "Highwire 2.0"
			}
		]
	},
	{
		"type": "web",
		"url": "http://radiographics.rsna.org/content/10/1/41.abstract",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Giger",
						"firstName": "M L",
						"creatorType": "author"
					},
					{
						"lastName": "Doi",
						"firstName": "K",
						"creatorType": "author"
					},
					{
						"lastName": "MacMahon",
						"firstName": "H",
						"creatorType": "author"
					},
					{
						"lastName": "Metz",
						"firstName": "C E",
						"creatorType": "author"
					},
					{
						"lastName": "Yin",
						"firstName": "F F",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"url": false,
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "Pulmonary nodules: computer-aided detection in digital chest images. ",
				"date": "January 01 , 1990",
				"publicationTitle": "Radiographics ",
				"pages": "41 -51 ",
				"volume": "10 ",
				"issue": "1 ",
				"url": "http://radiographics.rsna.org/content/10/1/41.abstract ",
				"abstractNote": "Currently, radiologists fail to detect pulmonary nodules in up to 30% of cases with actually positive findings. Diagnoses may be missed due to camouflaging effects of anatomic background, subjective and varying decision criteria, or distractions in clinical situations. We developed a computerized method to detect locations of lung nodules in digital chest images. The method is based on a difference-image approach and feature-extraction techniques, including growth, slope, and profile tests. Computer results were used to alert 12 radiologists to possible nodule locations in 60 clinical cases. Preliminary results suggest that computer aid can improve the detection performance of radiologists. ",
				"libraryCatalog": "Highwire 2.0",
				"shortTitle": "Pulmonary nodules"
			}
		]
	},
	{
		"type": "web",
		"url": "http://bjaesthetics.oxfordjournals.org/content/50/2/121.abstract",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Maes",
						"firstName": "Hans",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"url": false,
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "Intention, Interpretation, and Contemporary Visual Art ",
				"date": "April 01 , 2010",
				"publicationTitle": "The British Journal of Aesthetics ",
				"pages": "121 -138 ",
				"volume": "50 ",
				"issue": "2 ",
				"url": "http://bjaesthetics.oxfordjournals.org/content/50/2/121.abstract ",
				"abstractNote": "The role of the artist's intention in the interpretation of art has been the topic of a lively and ongoing discussion in analytic aesthetics. First, I sketch the current state of this debate, focusing especially on two competing views: actual and hypothetical intentionalism. Secondly, I discuss the search for a suitable test case, that is, a work of art that is interpreted differently by actual and hypothetical intentionalists, with only one of these interpretations being plausible. Many examples from many different art forms have been considered in this respect, but none of these test cases has proved convincing. Thirdly, I introduce two new test cases taken from contemporary visual art. I explain why these examples are better suited as test cases and how they lend support to the actual intentionalist position. ",
				"DOI": "10.1093/aesthj/ayp051 ",
				"libraryCatalog": "Highwire 2.0"
			}
		]
	},
	{
		"type": "web",
		"url": "http://joeg.oxfordjournals.org/content/10/3/331.abstract",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Clark",
						"firstName": "Gordon L.",
						"creatorType": "author"
					},
					{
						"lastName": "Durán-Fernández",
						"firstName": "Roberto",
						"creatorType": "author"
					},
					{
						"lastName": "Strauss",
						"firstName": "Kendra",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"url": false,
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "‘Being in the market’: the UK house-price bubble and the intended structure of individual pension investment portfolios ",
				"date": "May 01 , 2010",
				"publicationTitle": "Journal of Economic Geography ",
				"pages": "331 -359 ",
				"volume": "10 ",
				"issue": "3 ",
				"url": "http://joeg.oxfordjournals.org/content/10/3/331.abstract ",
				"abstractNote": "It is widely observed that being in the market gives financial traders access to knowledge and information not available to remote traders. A truism of the geography of finance, it is also a perspective that can shed light on the interaction between market location, global financial movements and personal welfare. In this article, we develop an explanation of the premium attached to being in the market, drawing upon previous contributions on the relevance of tacit knowledge and the insights provided by behavioural finance with respect to time–space myopia. To illustrate our model of four types of behaviour, mixing together various combinations of time and space conceptions of market performance, we analyse the intended retirement investment portfolios of nearly 2400 participants in a defined contribution pension plan sponsored by a London-based investment bank. Having demonstrated the empirical significance of the UK house-price bubble, respondents’ retirement investment portfolios are analysed focusing upon the relative significance of property in relation to a range of other investment instruments. It is shown that, amongst similarly located respondents, there was a range of investment strategies dependent, in part, upon respondents’ age, household status, job classification and income. These results allow us to distinguish between different types of behaviour even amongst well-placed respondents, providing evidence of the co-existence of sophisticated, naive and opportunistic investors against the base-case of time–space myopic behaviour. Implications are drawn for conceptualising a rapprochement between the insights of the behavioural revolution for economic geography (and in particular, the geography of finance) relevant for public policy. ",
				"DOI": "10.1093/jeg/lbp034 ",
				"libraryCatalog": "Highwire 2.0",
				"shortTitle": "‘Being in the market’"
			}
		]
	},
	{
		"type": "web",
		"url": "http://joeg.oxfordjournals.org/content/6/5/571",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Agrawal",
						"firstName": "Ajay",
						"creatorType": "author"
					},
					{
						"lastName": "Cockburn",
						"firstName": "Iain",
						"creatorType": "author"
					},
					{
						"lastName": "McHale",
						"firstName": "John",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"url": false,
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "Gone but not forgotten: knowledge flows, labor mobility, and enduring social relationships ",
				"date": "November 2006 ",
				"publicationTitle": "Journal of Economic Geography ",
				"pages": "571 -591 ",
				"volume": "6 ",
				"issue": "5 ",
				"url": "http://joeg.oxfordjournals.org/content/6/5/571.abstract ",
				"abstractNote": "We examine the role of social relationships in facilitating knowledge flows by estimating the flow premium captured by a mobile inventor's previous location. Once an inventor has moved, they are gone—but are they forgotten? We find that knowledge flows to an inventor's prior location are approximately 50% greater than if they had never lived there, suggesting that social relationships, not just physical proximity, are important for determining flow patterns. Furthermore, we find that a large portion of this social effect is mediated by institutional links; however, this is not the result of corporate knowledge management systems but rather of personal relationships formed through co-location within an institutional context that endure over time, space, and organizational boundaries. Moreover, we find the effect is nearly twice as large for knowledge flows across as compared to within fields, suggesting that co-location may substitute for communities of practice in determining flow patterns. ",
				"DOI": "10.1093/jeg/lbl016 ",
				"libraryCatalog": "Highwire 2.0",
				"shortTitle": "Gone but not forgotten"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.sciencemag.org/content/332/6034/1149.11.full?rss=1",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Balmford",
						"firstName": "Andrew",
						"creatorType": "author"
					},
					{
						"lastName": "Kroshko",
						"firstName": "Jeanette",
						"creatorType": "author"
					},
					{
						"lastName": "Leader-Williams",
						"firstName": "Nigel",
						"creatorType": "author"
					},
					{
						"lastName": "Mason",
						"firstName": "Georgia",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "Snapshot",
						"mimeType": "text/html"
					},
					{
						"url": false,
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"title": "Zoos and Captive Breeding ",
				"date": "June 03 , 2011",
				"publicationTitle": "Science ",
				"pages": "1149 -1150 ",
				"volume": "332 ",
				"issue": "6034 ",
				"url": "http://www.sciencemag.org/content/332/6034/1149.11.short ",
				"DOI": "10.1126/science.332.6034.1149-k ",
				"libraryCatalog": "Highwire 2.0"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.journalofvision.org/search?fulltext=tooth&submit=yes&x=0&y=0",
		"items": "multiple"
	}
]
/** END TEST CASES **/