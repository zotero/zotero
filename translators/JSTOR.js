{
	"translatorID": "d921155f-0186-1684-615c-ca57682ced9b",
	"label": "JSTOR",
	"creator": "Simon Kornblith, Sean Takats, Michael Berkowitz, and Eli Osherovich",
	"target": "https?://[^/]*jstor\\.org[^/]*/(action/(showArticle|doBasicSearch|doAdvancedSearch|doLocatorSearch|doAdvancedResults|doBasicResults)|stable/|pss/)",
	"minVersion": "2.1.9",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2011-07-01 02:58:17"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
	} : null;
	
	// See if this is a seach results page or Issue content
	if (doc.title == "JSTOR: Search Results" || url.match(/\/i\d+/) ||
		(url.match(/stable|pss/) // Issues with DOIs can't be identified by URL
		 && doc.evaluate('//form[@id="toc"]', doc, nsResolver,
			XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue)
	   ) {
		return "multiple";
	} else if(url.indexOf("/search/") != -1) {
		return false;
	}
	
	// If this is a view page, find the link to the citation
	var xpath = '//a[@id="favorites"]';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	if(elmt || url.match(/pss/)) {
	return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
	if (prefix == 'x') return namespace; else return null;
	} : null;

	var host = doc.location.host;
	
	// If this is a view page, find the link to the citation
	var xpath = '//a[@id="favorites"]';
	var elmt = doc.evaluate(xpath, doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	var allJids = new Array();
	if (elmt && /jid=10\.2307%2F(\d+)/.test(elmt.href)) {
	allJids.push(RegExp.$1);
	var jid = RegExp.$1;
	Zotero.debug("JID found 1 " + jid);
	}
	// Sometimes JSTOR uses DOIs as JID; here we exclude "?" characters, since it's a URL
	// And exclude TOC for journal issues that have their own DOI
	else if (/(?:pss|stable)\/(10\.\d+\/.+)(?:\?.*)?/.test(url)
		 && !doc.evaluate('//form[@id="toc"]', doc, nsResolver,
			XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue) {
	Zotero.debug("URL " + url);
	jid = RegExp.$1;
	allJids.push(jid);
	Zotero.debug("JID found 2 " + jid);
	} 
	else if (/(?:pss|stable)\/(\d+)/.test(url)
		 && !doc.evaluate('//form[@id="toc"]', doc, nsResolver,
			XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue) {
	Zotero.debug("URL " + url);
	jid = RegExp.$1;
	allJids.push(jid);
	Zotero.debug("JID found 2 " + jid);
	} 
	else {
	// We have multiple results
	var resultsBlock = doc.evaluate('//fieldset[@id="results"]', doc, nsResolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
	if (! resultsBlock) {
		return true;
	}

	var allTitlesElmts = doc.evaluate('//li//a[@class="title"]', resultsBlock, nsResolver,  XPathResult.ANY_TYPE, null);
	var currTitleElmt;
	var availableItems = new Object();
	while (currTitleElmt = allTitlesElmts.iterateNext()) {
		var title = currTitleElmt.textContent;
		// Sometimes JSTOR uses DOIs as JID; here we exclude "?" characters, since it's a URL
		if (/(?:pss|stable)\/(10\.\d+\/[^?]+)(?:\?.*)?/.test(currTitleElmt.href))
			var jid = RegExp.$1;
		else
			var jid = currTitleElmt.href.match(/(?:stable|pss)\/([a-z]*?\d+)/)[1];
		if (jid) {
			availableItems[jid] = title;
		}
		Zotero.debug("Found title " + title+jid);
	}
	Zotero.debug("End of titles");
	
	var selectedItems = Zotero.selectItems(availableItems);
	if (!selectedItems) {
		return true;
	}
	for (var j in selectedItems) {
		Zotero.debug("Pushing " + j);
		allJids.push(j);
	}
	}
	
	var sets = [];
	for each(var jid in allJids) {
		sets.push({ jid: jid });
	}
	
	function first(set, next) {
		var jid = set.jid;
		var downloadString = "suffix=" + jid;
		
		Zotero.Utilities.HTTP.doPost("http://"+host+"/action/downloadSingleCitation?format=refman&direct=true&singleCitation=true", downloadString, function(text) {
			// load translator for RIS
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				if(item.notes && item.notes[0]) {
					// For some reason JSTOR exports abstract with 'AB' tag istead of 'N1'
					item.abstractNote = item.notes[0].note;
					item.abstractNote = item.abstractNote.replace(/^<p>(ABSTRACT )?/,'').replace(/<\/p>$/,'');
					delete item.notes;
					item.notes = undefined;
				}
				
				// Don't save HTML snapshot from 'UR' tag
				item.attachments = [];
				
				set.doi = "10.2307/" + jid;
				
				if (/stable\/(\d+)/.test(item.url)) {
					var pdfurl = "http://"+ host + "/stable/pdfplus/" + jid + ".pdf?acceptTC=true";
					item.attachments.push({url:pdfurl, title:"JSTOR Full Text PDF", mimeType:"application/pdf"});
				}

				var matches;
				if (matches = item.ISSN.match(/([0-9]{4})([0-9]{3}[0-9Xx])/)) {
					item.ISSN = matches[1] + '-' + matches[2];
				}

				set.item = item;
				
				next();
			});
			
			translator.translate();
		});
	}
	
	function second(set, next) {
		var item = set.item;
		
		if (!set.doi) {
			item.complete();
			next();
		}
		
		var doi = set.doi;
		var crossrefURL = "http://www.crossref.org/openurl/?req_dat=zter:zter321&url_ver=Z39.88-2004&ctx_ver=Z39.88-2004&rft_id=info%3Adoi/"+doi+"&noredirect=true&format=unixref";
		
		Zotero.Utilities.HTTP.doGet(crossrefURL, function (text) {
			// parse XML with DOMParser
			try {
				var parser = new DOMParser();
                var xml = parser.parseFromString(text, "text/xml");
			} catch(e) {
				item.complete();
				next();
				return;
			}
			
			var doi = ZU.xpathText(xml, '//doi');
			
			// ensure DOI is valid
			if(!ZU.xpath(xml, '//error').length) {
				Zotero.debug("DOI is valid");
				item.DOI = doi;
			}
			
			item.complete();
			next();
		});
	}
	
	var callbacks = [first, second];
	Zotero.Utilities.processAsync(sets, callbacks, function () { Zotero.done(); });
	Zotero.wait();
}


/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://www.jstor.org.libproxy.mit.edu/action/doBasicSearch?Query=chicken&Search.x=0&Search.y=0&wc=on",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.jstor.org.libproxy.mit.edu/stable/1593514?&Search=yes&searchText=chicken&list=hide&searchUri=%2Faction%2FdoBasicSearch%3FQuery%3Dchicken%26Search.x%3D0%26Search.y%3D0%26wc%3Don&prevSearch=&item=1&ttl=70453&returnArticleService=showFullText",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"lastName": "Dimier-Poisson",
						"firstName": "I. H.",
						"creatorType": "author"
					},
					{
						"lastName": "Bout",
						"firstName": "D. T.",
						"creatorType": "author"
					},
					{
						"lastName": "Quéré",
						"firstName": "P.",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "JSTOR Full Text PDF",
						"mimeType": "application/pdf"
					}
				],
				"publicationTitle": "Avian Diseases",
				"title": "Chicken Primary Enterocytes: Inhibition of Eimeria tenella Replication after Activation with Crude Interferon-γ Supernatants",
				"volume": "48",
				"issue": "3",
				"publisher": "American Association of Avian Pathologists, Inc.",
				"ISBN": "00052086",
				"ISSN": "0005-2086",
				"url": "http://www.jstor.org/stable/1593514",
				"date": "2004",
				"pages": "617-624",
				"abstractNote": "A reproducible and original method for the preparation of chicken intestine epithelial cells from 18-day-old embryos for long-term culture was obtained by using a mechanical isolation procedure, as opposed to previous isolation methods using relatively high concentrations of trypsin, collagenase, or EDTA. Chicken intestine epithelial cells typically expressed keratin and chicken E-cadherin, in contrast to chicken embryo fibroblasts, and they increased cell surface MHC II after activation with crude IFN-γ containing supernatants, obtained from chicken spleen cells stimulated with concanavalin A or transformed by reticuloendotheliosis virus. Eimeria tenella was shown to be able to develop until the schizont stage after 46 hr of culture in these chicken intestinal epithelial cells, but it was not able to develop further. However, activation with IFN-γ containing supernatants resulted in strong inhibition of parasite replication, as shown by incorporation of [3 H]uracil. Thus, chicken enterocytes, which are the specific target of Eimeria development in vivo, could be considered as potential local effector cells involved in the protective response against this parasite. /// Se desarrolló un método reproducible y original para la preparación de células epiteliales de intestino de embriones de pollo de 18 días de edad para ser empleadas como cultivo primario de larga duración. Las células epiteliales de intestino fueron obtenidas mediante un procedimiento de aislamiento mecánico, opuesto a métodos de aislamientos previos empleando altas concentraciones de tripsina, colagenasa o EDTA. Las células epiteliales de intestino expresaron típicamente keratina y caderina E, a diferencia de los fibroblastos de embrión de pollo, e incrementaron el complejo mayor de histocompatibilidad tipo II en la superficie de la célula posterior a la activación con sobrenadantes de interferón gamma. Los sobrenadantes de interferón gamma fueron obtenidos a partir de células de bazos de pollos estimuladas con concanavalina A o transformadas con el virus de reticuloendoteliosis. Se observó el desarrollo de la Eimeria tenella hasta la etapa de esquizonte después de 46 horas de cultivo en las células intestinales epiteliales de pollo pero no se observó un desarrollo posterior. Sin embargo, la activación de los enterocitos con los sobrenadantes con interferón gamma resultó en una inhibición fuerte de la replicación del parásito, comprobada mediante la incorporación de uracilo [3 H]. Por lo tanto, los enterocitos de pollo, blanco específico del desarrollo in vivo de la Eimeria, podrían ser considerados como células efectoras locales, involucradas en la respuesta protectora contra este parásito.",
				"extra": "ArticleType: research-article / Full publication date: Sep., 2004 / Copyright © 2004 American Association of Avian Pathologists, Inc.",
				"libraryCatalog": "JSTOR",
				"shortTitle": "Chicken Primary Enterocytes"
			}
		]
	}
]
/** END TEST CASES **/
