{
	"translatorID": "d0b1914a-11f1-4dd7-8557-b32fe8a3dd47",
	"label": "EBSCOhost",
	"creator": "Simon Kornblith, Michael Berkowitz, Josh Geller",
	"target": "^https?://[^/]+/(?:eds|bsi|ehost)/(?:results|detail|folder)",
	"minVersion": "2.1",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"lastUpdated": "2011-08-07 11:11:54"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') { return namespace; } else { return null; }
	} : null;
	
	// See if this is a search results or folder results page
	var searchResult = doc.evaluate('//ul[@class="result-list" or @class="folder-list"]/li/div[@class="result-list-record" or @class="folder-item"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();         
	if(searchResult) {
		return "multiple";
	}

	var xpath = '//a[@class="permalink-link"]';
	var persistentLink = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	if(persistentLink) {
		return "journalArticle";
	}
}

/*
 * given the text of the delivery page, downloads an item
 */
function downloadFunction(text, url) {
		var an = url.match(/_(\d+)_AN/);
		var pdf = false;
		var risDate = false;
		var queryString = {};
		url.replace(
			new RegExp("([^?=&]+)(=([^&]*))?", "g"),
				function($0, $1, $2, $3) { queryString[$1] = $3; }
		);
		pdf = "/ehost/pdfviewer/pdfviewer?sid="+queryString["sid"]+"&vid="+queryString["vid"];

		if (text.match(/^Y1\s+-(.*)$/m)) {
			risDate = text.match(/^Y1\s+-(.*)$/m);
		}

		if (!text.match(/^TY\s\s-/m)) { text = text+"\nTY  - JOUR\n"; }
		// load translator for RIS
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		Zotero.debug(text);
		translator.setHandler("itemDone", function(obj, item) {
			if (text.match(/^L3\s+-\s*(.*)/m)) {
				item.DOI = text.match(/^L3\s+\-\s*(.*)/m)[1];
			}
			if (text.match(/^M3\s+-\s*(.*)/m)) {
				if (item.DOI == text.match(/^M3\s+\-\s*(.*)/m)[1]) { item.DOI = ""; }
			}
			if (text.match(/^DO\s+-\s*(.*)/m)) {
				item.DOI = text.match(/^DO\s+-\s*(.*)/m)[1];
			}
			if (text.match(/^T1\s+-/m)) {
				item.title = text.match(/^T1\s+-\s*(.*)/m)[1];
			}
		
			// Get the accession number from URL or elsewhere	
			if (an) {
				an = an[1];
				item.callNumber = an;
			} else {
				an = item.url.match(/AN=([0-9]+)/);
				if (an) an = an[1];
			}

			if (risDate) {
				var year = risDate[1].match(/\d{4}/);
				var extra = risDate[1].match(/\/([^\/]+)$/);
				// If we have a double year in risDate, use last section
				if (year && extra && extra[1].indexOf(year[0]) !== -1) {
					item.date = extra[1];
				}
			}		
	
			// RIS translator tries to download the link in "UR"
			item.attachments = [];
			
			// But keep the stable link as a link attachment
			if(item.url) {
				// Trim the ⟨=cs suffix -- EBSCO can't find the record with it!
				item.url = item.url.replace(/(AN=[0-9]+)⟨=[a-z]{2}/,"$1");
				item.attachments.push({url: item.url+"&scope=cite",
							title: "EBSCO Record",
							mimeType: "text/html",
							snapshot: false});
				item.url = "";
			}
			// A lot of extra info is jammed into notes by the RIS translator
			item.notes = [];
			// Since order of requests might matter, let's grab the stable link, then the PDF
			Zotero.Utilities.doGet(item.url, function (doc) { Zotero.Utilities.doGet(pdf, function (text) {
				var realpdf = text.match(/<embed id="pdfEmbed"[^>]*>/);
				if(realpdf) {
					realpdf = text.match(/<embed[^>]*src="([^"]+)"/);
					if (realpdf) {
						realpdf = realpdf[1].replace(/&amp;/g, "&").replace(/K=\d+/,"K="+an);
						Zotero.debug("PDF for "+item.title+": "+realpdf);
						item.attachments.push({url:realpdf,
								title: "EBSCO Full Text",
								mimeType:"application/pdf"});
					}
				}
			}, function () { item.complete(); }); }, function () { return true; });
		});
		translator.translate();
}

var host;

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') { return namespace; } else { return null; }
	} : null;

	var hostRe = new RegExp("^(https?://[^/]+)/");
	var hostMatch = hostRe.exec(url);
	host = hostMatch[1];
									
	var searchResult = doc.evaluate('//ul[@class="result-list" or @class="folder-list"]/li/div[@class="result-list-record" or @class="folder-item"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();                              

	if(searchResult) {
		/* Get title links and text */
		var titlex = '//a[@class = "title-link color-p4"]';
		var titles = doc.evaluate(titlex, doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		/* Get folder data for AN, DB, and tag */
		var folderx = '//span[@class = "item add-to-folder"]/input/@value';
		var folderData = doc.evaluate(folderx, doc, nsResolver, XPathResult.ANY_TYPE, null);
		
		var items = {};
		var folderInfos = {};
		var title, folderInfo;
		
		/* load up urls, title text and records keys (DB, AN, tag) */
		while (title = titles.iterateNext()) {
			items[title.href] = title.textContent;
			
			folderInfo = folderData.iterateNext();
			folderInfos[title.href] = folderInfo.textContent;
		}
		
		Zotero.selectItems(items, function (items) {
				if(!items) {
					return true;
				}

				/* Get each citation page and pass in record key (db, tag, an) since data does not exist in an easily digestable way on this page */
				var urls = [];
				var infos = [];
				var i;
				for(i in items) {
					urls.push(i);
					infos.push(folderInfos[i]);
				}

				var run = function(urls, infos) {
					var url, info;
					if (urls.length == 0 || infos.length == 0) {
						Zotero.done();
						return true;
					}
					url = urls.shift();
					info = infos.shift();
					Zotero.Utilities.processDocuments(url, 
						function (newDoc) { doDelivery(doc, nsResolver, info, function () { run(urls, infos) }); },
						function () { return true; });
				};

				run(urls, infos);

				Zotero.wait();
		});
	} else {
		/* Individual record. Record key exists in attribute for add to folder link in DOM */
		doDelivery(doc, nsResolver, null, function () { Zotero.done(); return true; });
		Zotero.wait();
	}
}
function doDelivery(doc, nsResolver, folderData, onDone) {
	if(folderData === null)	{
		/* Get the db, AN, and tag from ep.clientData instead */
		var script;
		var scripts = doc.evaluate('//script[@type="text/javascript"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		while (script = scripts.iterateNext().textContent) {
			var clientData = script.match(/var ep\s*=\s*({[^;]*});/);
			if (clientData) break;
		}
		if (!clientData) {return false;}
			/* We now have the script containing ep.clientData */

		/* The JSON is technically invalid, since it doesn't quote the
		   attribute names-- we pull out the valid bit inside it. */
		var clientData = script.match(/var ep\s*=\s*({[^;]*});/);
		if (!clientData) { return false; }
		clientData = clientData[1].match(/"currentRecord"\s*:\s*({[^}]*})/);
		/* If this starts throwing exceptions, we should probably start try-elsing it */
		folderData = JSON.parse(clientData[1]);
	} else {
		/* Ditto for this. */
		// The attributes are a little different
		folderData = JSON.parse(folderData);
		folderData.Db = folderData.db;
		folderData.Term = folderData.uiTerm;
		folderData.Tag = folderData.uiTag;
	}
	
	var postURL = doc.evaluate('//form[@id="aspnetForm"]/@action', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;

	var queryString = {};
	postURL.replace(
		new RegExp("([^?=&]+)(=([^&]*))?", "g"),
			function($0, $1, $2, $3) { queryString[$1] = $3; }
	);
	
	/* ExportFormat = 1 for RIS file */
	postURL = host+"/ehost/delivery/ExportPanelSave/"+folderData.Db+"_"+folderData.Term+"_"+folderData.Tag+"?sid="+queryString["sid"]+"&vid="+queryString["vid"]+"&bdata="+queryString["bdata"]+"&theExportFormat=1";
	Zotero.Utilities.HTTP.doGet(postURL, function (text) { downloadFunction(text, postURL); }, onDone);
}
/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://search.ebscohost.com/login.aspx?direct=true&db=a9h&AN=4370815&lang=cs&site=ehost-live",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Warren",
						"firstName": "Karen J.",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"RECONCILIATION",
					"WAR -- Moral & ethical aspects",
					"SOCIAL sciences -- Philosophy",
					"STERBA, James",
					"JUSTICE for Here & Now (Book)"
				],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "EBSCO Record",
						"mimeType": "text/html",
						"snapshot": false
					},
					{
						"url": false,
						"title": "EBSCO Full Text",
						"mimeType": "application/pdf"
					}
				],
				"title": "Peacemaking and Philosophy: A Critique of Justice for Hero and Now.",
				"publicationTitle": "Journal of Social Philosophy",
				"date": "Winter 1999",
				"volume": "30",
				"issue": "3",
				"pages": "411-423",
				"publisher": "Wiley-Blackwell",
				"ISBN": "00472786",
				"ISSN": "00472786",
				"abstractNote": "This article presents a critical analysis of James Sterba's book, Justice for Here and Now.  In the book, Sterba undertakes two distinct but interconnected objects--one primarily methodological and the other primarily ethical. The methodological project is to establish the necessity and desirability of adopting a peacemaking model of doing philosophy, that is, one that is committed to fair-mindedness, openness and self-criticalness in seeking to determine which philosophical views are most justified. Sterba contrasts the peacemaking model with a war-making model of doing philosophy. The ethical project involves establishing two related claims: rationality is required for morality, and it is possible and desirable to reconcile the practical perspectives of alternative positions on justice; welfare liberalism, libertarianism, socialism, feminism, multiculturalism, anthropocentric and nonanthropocentric environmental ethics, and pacifism and just war theory. There is an important and intimate connection between the methodological and ethical projects. In fact, at various places throughout the book Sterba suggests that the relationship is one of logical entailment: not only does appeal to a peacemaking model of doing philosophy establish the two main claims of the ethical project; by showing the rational grounds for reconciling alternative philosophical positions on justice, one establishes that a peacemaking model of philosophy ought to be adopted.",
				"libraryCatalog": "EBSCOhost",
				"shortTitle": "Peacemaking and Philosophy"
			}
		]
	}
]
/** END TEST CASES **/
