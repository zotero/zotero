{
	"translatorID": "8c1f42d5-02fa-437b-b2b2-73afc768eb07",
	"label": "Highwire 2.0",
	"creator": "Matt Burton",
	"target": "(content/([0-9]+/[0-9]+|current|firstcite|early)|search\\?submit=|search\\?fulltext=|cgi/collection/.+)",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"lastUpdated": "2011-07-29 01:21:09"
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
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var highwiretest = false;
	
	highwiretest = url.match(/\.pdf+html\?frame=header/);
	
	if (!highwiretest) {
		// lets hope this installations don't tweak this...
		highwiretest = doc.evaluate("//link[@href = '/shared/css/hw-global.css']", doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
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

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
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
	
	var host = 'http://' + doc.location.host + "/";
	
	var arts = new Array();
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
		var searchres = doc.evaluate(searchx, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var next_res;
		while (next_res = searchres.iterateNext()) {
			var title = doc.evaluate(titlex, next_res, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate(linkx, next_res, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			items[link] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		} 
	} else {
		arts = [url];
	}
	var newurls = new Array();
	for each (var i in arts) {
		newurls.push(i);
	}
	if(arts.length == 0) {
		Zotero.debug('no items');
		return false;
	}
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
	Zotero.wait();
}
/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://rer.sagepub.com/content/52/2/201.abstract",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Hofstein",
						"firstName": "Avi",
						"creatorType": "author"
					},
					{
						"lastName": "Lunetta",
						"firstName": "Vincent N.",
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
				"title": "The Role of the Laboratory in Science Teaching: Neglected Aspects of Research",
				"date": "Summer 1982",
				"publicationTitle": "Review of Educational Research",
				"pages": "201 -217",
				"volume": "52",
				"issue": "2",
				"url": "http://rer.sagepub.com/content/52/2/201.abstract",
				"abstractNote": "The laboratory has been given a central and distinctive role in science education, and science educators have suggested that there are rich benefits in learning from using laboratory activities. At this time, however, some educators have begun to question seriously the effectiveness and the role of laboratory work, and the case for laboratory teaching is not as self-evident as it once seemed. This paper provides perspectives on these issues through a review of the history, goals, and research findings regarding the laboratory as a medium of instruction in introductory science teaching. The analysis of research culminates with suggestions for researchers who are working to clarify the role of the laboratory in science education.",
				"DOI": "10.3102/00346543052002201",
				"libraryCatalog": "Highwire 2.0",
				"shortTitle": "The Role of the Laboratory in Science Teaching"
			}
		]
	},
	{
		"type": "web",
		"url": "http://sag.sagepub.com/content/early/2010/04/23/1046878110366277.abstract",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Owens",
						"firstName": "Trevor",
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
				"title": "Modding the History of Science: Values at Play in Modder Discussions of Sid Meier’s CIVILIZATION",
				"date": "May 27 , 2010",
				"publicationTitle": "Simulation & Gaming",
				"url": "http://sag.sagepub.com/content/early/2010/04/23/1046878110366277.abstract",
				"abstractNote": "Sid Meier’s CIVILIZATION has been promoted as an educational tool, used as a platform for building educational simulations, and maligned as promoting Eurocentrism, bioimperialism, and racial superiority. This article explores the complex issues involved in interpreting a game through analysis of the ways modders (gamers who modify the game) have approached the history of science, technology, and knowledge embodied in the game. Through text analysis of modder discussion, this article explores the assumed values and tone of the community’s discourse. The study offers initial findings that CIVILIZATION modders value a variety of positive discursive practices for developing historical models. Community members value a form of historical authenticity, they prize subtlety and nuance in models for science in the game, and they communicate through civil consensus building. Game theorists, players, and scholars, as well as those interested in modeling the history, sociology, and philosophy of science, will be interested to see the ways in which CIVILIZATION III cultivates an audience of modders who spend their time reimagining how science and technology could work in the game.",
				"DOI": "10.1177/1046878110366277",
				"libraryCatalog": "Highwire 2.0",
				"shortTitle": "Modding the History of Science"
			}
		]
	},
	{
		"type": "web",
		"url": "http://scx.sagepub.com/content/30/2/277.abstract",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Mulder",
						"firstName": "Henk A. J.",
						"creatorType": "author"
					},
					{
						"lastName": "Longnecker",
						"firstName": "Nancy",
						"creatorType": "author"
					},
					{
						"lastName": "Davis",
						"firstName": "Lloyd S.",
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
				"title": "The State of Science Communication Programs at Universities Around the World",
				"date": "December 01 , 2008",
				"publicationTitle": "Science Communication",
				"pages": "277 -287",
				"volume": "30",
				"issue": "2",
				"url": "http://scx.sagepub.com/content/30/2/277.abstract",
				"abstractNote": "Building on discussions at two workshops held at the recent 10th International Conference on the Public Communication of Science and Technology during June 2008 in Malmö, Sweden, this article proposes specific steps toward achieving a common understanding of the essential elements for academic programs in science communication. About 40 academics, science communication professionals, and students from at least 16 countries participated in this process.",
				"DOI": "10.1177/1075547008324878",
				"libraryCatalog": "Highwire 2.0"
			}
		]
	}
]
/** END TEST CASES **/
