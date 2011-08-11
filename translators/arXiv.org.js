{
	"translatorID": "ecddda2e-4fc6-4aea-9f17-ef3b56d7377a",
	"label": "arXiv.org",
	"creator": "Sean Takats and Michael Berkowitz",
	"target": "http://(?:([^\\.]+\\.))?(?:(arxiv\\.org|xxx.lanl.gov)/(?:find/\\w|list/\\w|abs/)|eprintweb.org/S/(?:search|archive|article)(?!.*refs$)(?!.*cited$))",
	"minVersion": "2.1.9",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcs",
	"lastUpdated": "2011-07-27 13:39:47"
}

function detectWeb(doc, url) {
	var searchRe = new RegExp('^http://(?:([^\.]+\.))?(?:(arxiv\.org|xxx\.lanl\.gov)/(?:find|list)|eprintweb.org/S/(?:archive|search$))');
	
	if(searchRe.test(url)) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}

function getPDF(articleID) {
	return {url:"http://www.arxiv.org/pdf/" + articleID + ".pdf",
			mimeType:"application/pdf", title:articleID + " PDF"};
}

function doWeb(doc, url) {
	// eprintweb appears to be defunct as of mid-2011. leaving relevant code here for now
	var eprintMultRe = new RegExp('^http://(?:www\.)?eprintweb.org/S/(?:search|archive)');
	var eprintMultM = eprintMultRe.exec(url);
	
	var eprintSingRe = new RegExp('^http://(?:www\.)?eprintweb.org/S/(?:article|search/[0-9]+/A[0-9]+)');
	var eprintSingM = eprintSingRe.exec(url);

	if (eprintMultM) {
		var elmtsXPath = '//table/tbody/tr/td[@class="txt"]/a[text()="Abstract"]/../b';
		var titlesXPath = '//table/tbody/tr/td[@class="lti"]';
		var titleNode = './text()';
	} else {
		var elmtsXPath = '//div[@id="dlpage"]/dl/dt/span[@class="list-identifier"]/a[1]';
		var titlesXPath = '//div[@id="dlpage"]/dl/dd/div[@class="meta"]/div[@class="list-title"]';
	}

	var elmts = doc.evaluate(elmtsXPath, doc, null, XPathResult.ANY_TYPE, null);
	var titles = doc.evaluate(titlesXPath, doc, null, XPathResult.ANY_TYPE, null);

	var newURIs = new Array();
	var elmt = elmts.iterateNext();
	var title = titles.iterateNext();
	if (elmt && titles) {
		var availableItems = new Array();
		var arXivCats = new Array();
		var arXivIDs = new Array();
		var i=0;
		if (eprintMultM){
			do {
				var newID = doc.evaluate('./text()', elmt, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				newID = newID.replace(/arXiv:/, "");
				newID = newID.replace(/\//g, "%2F");
				newID = newID.replace(/v\d*/, ""); //remove version number  
				availableItems[i] = doc.evaluate(titleNode, title, null, XPathResult.ANY_TYPE, null).iterateNext().textContent; 
				arXivIDs[i] = newID;
				i++;
			} while ((elmt = elmts.iterateNext()) && (title = titles.iterateNext()));
		}
		else{
			do {
				var newID= elmt.textContent;
				newID = newID.replace(/arXiv:/, "");
				newID = newID.replace(/\//g, "%2F");
				newID = newID.replace(/v\d*/, ""); //remove version number 
				availableItems[i] = ZU.trimInternal(title.textContent.replace(/^\s*Title:\s+/, "")); 
				arXivIDs[i] = newID;
				i++;
			} while ((elmt = elmts.iterateNext()) && (title = titles.iterateNext()));
		}
		var items = Zotero.selectItems(availableItems, function(items) {
			if(!items) {
				return true;
			}
			for(var i in items) {
				newURIs.push("http://export.arxiv.org/oai2?verb=GetRecord&identifier=oai%3AarXiv.org%3A" + arXivIDs[i] + "&metadataPrefix=oai_dc");
			}
			Zotero.Utilities.HTTP.doGet(newURIs, parseXML, function() {Zotero.done();}, null);
		});
	}
	else {
		if (eprintSingM){
			var titleID = doc.evaluate('//td[@class="ti"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var arXivID = doc.evaluate('//table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[1]/td[@class="txt"]/b', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			arXivID = arXivID.substring(0, arXivID.indexOf(" "));
			arXivID = arXivID.replace(/arXiv:/, "");
			arXivID = arXivID.replace(/\//g, "%2F");
		} else {
			var arXivID = doc.evaluate('//title', doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var titleRe = /\[([^\]]*)]/;
			var m = titleRe.exec(arXivID);
			arXivID = m[1];
			arXivID = arXivID.replace(/\//g, "%2F"); 
		}
		arXivID = arXivID.replace(/v\d*/, ""); //remove version number
		newURIs.push("http://export.arxiv.org/oai2?verb=GetRecord&identifier=oai%3AarXiv.org%3A" + arXivID + "&metadataPrefix=oai_dc");
 		Zotero.Utilities.HTTP.doGet(newURIs, parseXML, function() {Zotero.done();}, null);
	}
	Zotero.wait();
}

function parseXML(text) {
	var newItem = new Zotero.Item("journalArticle");
	//	remove header
	text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
	//	fix non-compliant XML tags (colons)
	text = text.replace(/<dc:/g, "<dc_").replace(/<\/dc:/g, "</dc_");
	text = text.replace(/<oai_dc:dc/g, "<oai_dc_dc").replace(/<\/oai_dc:dc/g, "</oai_dc_dc");
	text = text.replace(/<OAI-PMH[^>]*>/, "").replace(/<\/OAI-PMH[^>]*>/, "");
	text = "<zotero>" + text + "</zotero>";
	
	var xml = (new DOMParser()).parseFromString(text, "text/xml");

	newItem.title = getXPathNodeTrimmed(xml, "dc_title");
	getCreatorNodes(xml, "dc_creator", newItem, "author");		
	newItem.date = getXPathNodeTrimmed(xml, "dc_date");
		
	var descriptions = ZU.xpath(xml, "//GetRecord/record/metadata/oai_dc_dc/dc_description");
	for(var j=0; j<descriptions.length; j++) {
		var noteStr = ZU.trimInternal(descriptions[j].textContent);
		newItem.notes.push({note:noteStr});		
	}	
		
	var subjects = ZU.xpath(xml, "//GetRecord/record/metadata/oai_dc_dc/dc_subject");
	for(var j=0; j<subjects.length; j++) {
		var subject = ZU.trimInternal(subjects[j].textContent);
		newItem.tags.push(subject);		
	}	
					
	var identifiers = ZU.xpath(xml, "//GetRecord/record/metadata/oai_dc_dc/dc_identifier");
	for(var j=0; j<identifiers.length; j++) {
		var identifier = ZU.trimInternal(identifiers[j].textContent);
		if (identifier.substr(0, 4) == "doi:") {
			newItem.DOI = identifier;
		}
		else if (identifier.substr(0, 7) == "http://") {
			newItem.url = identifier;
		}
		else {
			newItem.extra = identifier;
		}
	}	

	var articleID = ZU.xpath(xml, "//GetRecord/record/header/identifier");
	articleID = ZU.trimInternal(articleID[0].textContent);
	articleID = articleID.substr(14);
	var idPrefixRegex = new RegExp('^arXiv:', "i");
	if (idPrefixRegex.test (articleID)) {
		newItem.publicationTitle = articleID;
	}
	else {
		newItem.publicationTitle = "arXiv:" + articleID;
	}

//	TODO add "arXiv.org" to bib data?
	newItem.attachments.push({url:newItem.url, title:"arXiv.org Snapshot", mimeType:"text/html"});
	newItem.attachments.push(getPDF(articleID));
	if (newItem.notes[0]['note']) {
		newItem.abstractNote = newItem.notes[0]['note'];
		newItem.notes = new Array();
	}
	newItem.complete();
}


function getXPathNodeTrimmed(xml, name) {
	var node = ZU.xpath(xml, "//GetRecord/record/metadata/oai_dc_dc/"+name);
	var val = "";
	if(node.length){
		val = Zotero.Utilities.trimInternal(node[0].textContent);
	}
	return val;
}

function getCreatorNodes(xml, name, newItem, creatorType) {
	var nodes = ZU.xpath(xml, "//GetRecord/record/metadata/oai_dc_dc/"+name);
	for(var i=0; i<nodes.length; i++) {
		newItem.creators.push(Zotero.Utilities.cleanAuthor(nodes[i].textContent, creatorType, true));
	}
}/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://arxiv.org/list/astro-ph/new",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://arxiv.org/abs/1107.4612",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "O'Dea, D.",
						"lastName": "T",
						"creatorType": "author"
					},
					{
						"firstName": "Clark, C.",
						"lastName": "N",
						"creatorType": "author"
					},
					{
						"firstName": "Contaldi, C.",
						"lastName": "R",
						"creatorType": "author"
					},
					{
						"firstName": "MacTavish, C.",
						"lastName": "J",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"Astrophysics - Cosmology and Extragalactic Astrophysics",
					"Astrophysics - Galaxy Astrophysics"
				],
				"seeAlso": [],
				"attachments": [
					{
						"url": false,
						"title": "arXiv.org Snapshot",
						"mimeType": "text/html"
					},
					{
						"url": false,
						"mimeType": "application/pdf",
						"title": "1107.4612 PDF"
					}
				],
				"title": "A Model For Polarised Microwave Foreground Emission From Interstellar Dust",
				"date": "2011-07-22",
				"url": "http://arxiv.org/abs/1107.4612",
				"publicationTitle": "arXiv:1107.4612",
				"abstractNote": "The upcoming generation of cosmic microwave background (CMB) experiments face a major challenge in detecting the weak cosmic B-mode signature predicted as a product of primordial gravitational waves. To achieve the required sensitivity these experiments must have impressive control of systematic effects and detailed understanding of the foreground emission that will influence the signal. In this paper we describe a model of foreground dust intensity and polarisation. The model includes a 3D description of the Galactic magnetic field, examining both large and small scales. We also include in the model the details of the dust density, grain alignment and the intrinsic polarisation of the emission from an individual grain. We present here Stokes parameter maps at 150 GHz and provide an on-line repository for these and additional template maps at frequencies that will be targeted by upcoming experiments such as EBEX, Spider and SPTpol.",
				"libraryCatalog": "arXiv.org"
			}
		]
	}
]
/** END TEST CASES **/