{
	"translatorID":"9575e804-219e-4cd6-813d-9b690cbfc0fc",
	"translatorType":4,
	"label":"PLoS Journals",
	"creator":"Michael Berkowitz And Rintze Zelle",
	"target":"^http://www\\.plos(one|ntds|compbiol|pathogens|genetics|medicine|biology)\\.org/(search|article)/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-06-04 00:00:00"
}

function detectWeb(doc, url) {
	if (url.indexOf("Search.action") != -1 || url.indexOf("browse.action") != -1 || url.indexOf("browseIssue.action") != -1) {
			return "multiple";
	} else if (url.indexOf("article/info") != -1) {
		return "journalArticle";
	}
}


function getSelectedItems(doc, articleRegEx) {
	var items = new Object();
	var texts = new Array();
	var articles = doc.evaluate(articleRegEx, doc, null, XPathResult.ANY_TYPE, null);
	var next_art = articles.iterateNext();
	while (next_art) {
		items[next_art.href] = next_art.textContent;
		next_art = articles.iterateNext();
	}
	items = Zotero.selectItems(items);
	for (var i in items) {
		texts.push(i);
	}
	return(texts);
}

function doWeb(doc, url) {
	if (url.indexOf("Search.action") != -1 || url.indexOf("browse.action") != -1) {
		var articlex = '//span[@class="article"]/a';
		var texts = getSelectedItems(doc, articlex);
	} else if (url.indexOf("browseIssue.action") != -1) {
		var articlex = '//div[@class="article"]/h3/a';
		var texts = getSelectedItems(doc, articlex);
	} else {
		var texts = new Array(url);
	}

	var risLinks = new Array();
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
	Zotero.wait();
}
