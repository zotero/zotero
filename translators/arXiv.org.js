{
	"translatorID":"ecddda2e-4fc6-4aea-9f17-ef3b56d7377a",
	"translatorType":4,
	"label":"arXiv.org",
	"creator":"Sean Takats and Michael Berkowitz",
	"target":"http://(?:([^\\.]+\\.))?(?:(arxiv\\.org|xxx.lanl.gov)/(?:find/\\w|list/\\w|abs/)|eprintweb.org/S/(?:search|archive|article)(?!.*refs$)(?!.*cited$))",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2011-01-11 04:31:00"
}

function detectWeb(doc, url) {
	var searchRe = /^http:\/\/(?:([^\.]+\.))?(?:(arxiv\.org|xxx\.lanl\.gov)\/(?:find|list)|eprintweb.org\/S\/(?:archive|search$))/;
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
	var eprintMultRe = /^http:\/\/(?:www\.)?eprintweb.org\/S\/(?:search|archive)/;
	var eprintMultM = eprintMultRe.exec(url);
	
	var eprintSingRe = /^http:\/\/(?:www\.)?eprintweb.org\/S\/(?:article|search\/[0-9]+\/A[0-9]+)/;
	var eprintSingM = eprintSingRe.exec(url);

	if (eprintMultM) {
		var elmtsXPath = '//table/tbody/tr/td[@class="txt"]/a[text()="Abstract"]/../b';
		var titlesXPath = '//table/tbody/tr/td[@class="lti"]';
		var titleNode = './text()';
	} else {
		var elmtsXPath = '//div[@id="dlpage"]/dl/dt/span[@class="list-identifier"]/a[1]';
		var titlesXPath = '//div[@id="dlpage"]/dl/dd/div[@class="meta"]/div[@class="list-title"]';
	}

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var elmts = doc.evaluate(elmtsXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var titles = doc.evaluate(titlesXPath, doc, nsResolver, XPathResult.ANY_TYPE, null);

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
				var newID = doc.evaluate('./text()', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				newID = newID.replace(/arXiv:/, "");
				newID = newID.replace(/\//g, "%2F");
				newID = newID.replace(/v\d*/, ""); //remove version number  
				availableItems[i] = doc.evaluate(titleNode, title, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent; 
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
				availableItems[i] = Zotero.Utilities.trimInternal(title.textContent.replace(/^\s*Title:\s+/, "")); 
				arXivIDs[i] = newID;
				i++;
			} while ((elmt = elmts.iterateNext()) && (title = titles.iterateNext()));
		}
		var items = Zotero.selectItems(availableItems);
		if(!items) {
			return true;
		}
		for(var i in items) {
			newURIs.push("http://export.arxiv.org/oai2?verb=GetRecord&identifier=oai%3AarXiv.org%3A" + arXivIDs[i] + "&metadataPrefix=oai_dc");

		}
	}
	else {
		if (eprintSingM){
			var titleID = doc.evaluate('//td[@class="ti"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var arXivID = doc.evaluate('//table/tbody/tr[4]/td/table/tbody/tr/td[1]/table/tbody/tr[1]/td[@class="txt"]/b', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			arXivID = arXivID.substring(0, arXivID.indexOf(" "));
			arXivID = arXivID.replace(/arXiv:/, "");
			arXivID = arXivID.replace(/\//g, "%2F");
		} else {
			var arXivID = doc.evaluate('//title', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var titleRe = /\[([^\]]*)]/;
			var m = titleRe.exec(arXivID);
			arXivID = m[1];
			arXivID = arXivID.replace(/\//g, "%2F"); 
		}
		arXivID = arXivID.replace(/v\d*/, ""); //remove version number
		Zotero.debug("ID= "+ arXivID);
		newURIs.push("http://export.arxiv.org/oai2?verb=GetRecord&identifier=oai%3AarXiv.org%3A" + arXivID + "&metadataPrefix=oai_dc");

	}

	Zotero.Utilities.HTTP.doGet(newURIs, function(text) {
		var newItem = new Zotero.Item("journalArticle");
		//	remove header
		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
		//	fix non-compliant XML tags (colons)
		text = text.replace(/<dc:/g, "<dc_").replace(/<\/dc:/g, "</dc_");
		text = text.replace(/<oai_dc:dc/g, "<oai_dc_dc").replace(/<\/oai_dc:dc/g, "</oai_dc_dc");
		text = text.replace(/<OAI-PMH[^>]*>/, "").replace(/<\/OAI-PMH[^>]*>/, "");
		text = "<zotero>" + text + "</zotero>";
		var xml = new XML(text);
		var title;
		var citation = xml.GetRecord.record.metadata.oai_dc_dc;
		var test = xml..responseDate.text().toString();

		if (citation.dc_title.length()){
			title = Zotero.Utilities.trimInternal(citation.dc_title.text().toString());
			newItem.title = title;
		}
		Zotero.debug("article title: " + title);
		var type = "";
		if(citation.dc_creator.length()) {
		var authors = citation.dc_creator;
			for(var j=0; j<authors.length(); j++) {
				Zotero.debug("author: " + authors[j]);
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j].text().toString(),type,true));
			}
		}
		if (citation.dc_date.length()) {
			var dates = citation.dc_date;
			newItem.date = Zotero.Utilities.trimInternal(dates[0].text().toString());
		}
		if (citation.dc_description.length()) {
			var descriptions = citation.dc_description;
			for (var j=0; j<descriptions.length(); j++) {
				var noteStr = Zotero.Utilities.trimInternal(descriptions[j].text().toString());
				newItem.notes.push({note:noteStr});
			}
		}
		if (citation.dc_subject.length()) {
			var subjects = citation.dc_subject;
			for (var j=0; j<subjects.length(); j++) { 
				var subjectValue = Zotero.Utilities.trimInternal(subjects[j].text().toString());
				newItem.tags.push(subjectValue);
			}
		}
		if (citation.dc_identifier.length()) {
			var identifiers = citation.dc_identifier;
			for (var j=0; j<identifiers.length(); j++) {
				var identifier = Zotero.Utilities.trimInternal(identifiers[j].text().toString());
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
		}
		var articleID = "";
		if (xml.GetRecord.record.header.identifier.length()) {
			articleID = xml.GetRecord.record.header.identifier.text().toString();
			articleID = articleID.substr(14);
			var idPrefixRegex = /^arXiv:/i;
                        if (idPrefixRegex.test (articleID))
                                newItem.publicationTitle = articleID;
                        else
                                newItem.publicationTitle = "arXiv:" + articleID;
		}
//		TODO add "arXiv.org" to bib data?
		newItem.attachments.push({url:newItem.url, title:"arXiv.org Snapshot", mimeType:"text/html"});
		newItem.attachments.push(getPDF(articleID));
		if (newItem.notes[0]['note']) {
			newItem.abstractNote = newItem.notes[0]['note'];
			newItem.notes = new Array();
		}
		newItem.complete();
	}, function() {Zotero.done();}, null);
	Zotero.wait();
}
