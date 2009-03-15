{
	"translatorID":"8d72adbc-376c-4a33-b6be-730bc235190f",
	"translatorType":4,
	"label":"IEEE Computer Society",
	"creator":"fasthae@gmail.com",
	"target":"^http?://(www[0-9]?|search[0-9]?).computer.org/(portal/web/csdl/(magazines/[0-9a-z]+#(3|4)|transactions/[0-9a-z]+#(3|4)|letters/[0-9a-z]+#(3|4)|proceedings/[0-9a-z]+#(4|5)|doi|abs/proceedings)|search/results)",
	"minVersion":"1.0.7",
	"maxVersion":"",
	"priority":100,
	"inRepository":false,
	"lastUpdated":"2009-03-14 16:07:05"
}

function detectWeb(doc, url) {
	//supports table of contents, seach results and single document pages
	if (url.indexOf("search/results") >1) {
		return "multiple";
	} else if (url.indexOf("/portal/web/csdl/magazines/") > 1) {
		if (url.indexOf("#3") != -1) return "multiple"; 
		else return "magazineArticle";
	} else if (url.indexOf("/portal/web/csdl/transactions/") > 1) {
		if (url.indexOf("#3") != -1) return "multiple"; 
		else return "journalArticle";
	} else if (url.indexOf("/portal/web/csdl/proceedings/") > 1) {
		if (url.indexOf("#4") != -1) return "multiple"; 
		else return "conferencePaper";
	} else if (url.indexOf("/portal/web/csdl/abs/proceedings/") > 1) {
		return "multiple";
	} else if (url.indexOf("/portal/web/csdl/letters/") > 1) {
		if (url.indexOf("#3") != -1) return "multiple"; 
		else return "letter";
	} else if (url.indexOf("/portal/web/csdl/doi/") > 1) {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; 
			else return null;
		} : null;
		var refWork = doc.evaluate('//div[@id="refWorksText-content"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		refWork = refWork.textContent.substr(0,9);
		if (refWork.indexOf("JOUR")>1) return "journalArticle";
		else if  (refWork.indexOf("MGZN")>1) return "magazineArticle";
		else if  (refWork.indexOf("CONF")>1) return "conferencePaper";
		else return false;
	} else {
		return false;
	}

}
// move this to a var to pass to scrape
var templte;

function doWeb(doc, url) {
	if (detectWeb(doc,url) == 'multiple') {
			var namespace = doc.documentElement.namespaceURI;
			var nsResolver = namespace ? function(prefix) {
				if (prefix == 'x') return namespace; else return null;
			} : null;
    	
		templte = doc.body.innerHTML;
		templte = templte.substr(templte.indexOf("linkWithParms += '&")+19);
		templte = templte.substr(0,templte.indexOf("';"));
    	
		var items = new Array();
		var search = 0;
    	
		if (url.indexOf("search/results") != -1) {
			var entries = doc.evaluate('//div[@id="toc-articles-list" or @class="searchresult-data"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var entry;
			while(entry = entries.iterateNext()) {
				var title = "";
				var titleNode = doc.evaluate('.//b', entry, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if (titleNode) title += titleNode.textContent;
				var linkNode = doc.evaluate('.//img[@src="images/abstract_icon.gif"]/ancestor::a', entry, nsResolver, XPathResult.ANY_TYPE,null).iterateNext();
				if (linkNode) {
					var link = linkNode.href;
					items[link] = Zotero.Utilities.trimInternal(title);
				}
			}
		}
		else {
			var entries = doc.evaluate('//div[@id="toc-articles-list"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var entry;
			while(entry = entries.iterateNext()) {
				var title = "";
				titleNode = doc.evaluate('./a', entry,nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if (titleNode)  {
					title += titleNode.textContent;
					//add link url of the abstract icon
					var linkk;
					if (titleNode.href.indexOf( 'javascript:void(0)') != -1) {
						linkk = titleNode.attributes.getNamedItem("onclick").value;
						linkk = linkk.substr(linkk.indexOf('"')+1); 
						linkk = linkk.substr(0,linkk.indexOf('"'));
						if (linkk.indexOf("?") > -1) {
							linkk += '&'+templte;
						}
						else {
							linkk += '?'+templte;
						}
						linkk = "http://www2.computer.org"+linkk;
					} else linkk=titleNode.href;
					
					items[linkk] = Zotero.Utilities.trimInternal(title);
				}
			}
		}
		
		// let user select documents to scrape
		items = Zotero.selectItems(items);
		if(!items) return true;
		var urls = new Array();
		for(var url in items) {
			urls.push(url);
		}
		
		if (search != 1)  Zotero.Utilities.processDocuments(urls, scrape, function() { Zotero.done(); }); 
		else Zotero.Utilities.doGet(urls, scrapt,function() { Zotero.done(); });
		
		Zotero.wait();
	} else {
		 scrape(doc);
	}
}

function scrapt(txt) {
	throw "Not Supported yet!";
}


function scrape(doc,url) {

	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;


	var itemType = detectWeb(doc, doc.location.href);
	var abstractText = doc.evaluate('//div[@class="abs-articlesummary"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (abstractText) abstractText = Zotero.Utilities.trimInternal(abstractText.textContent);
	var keywords = new Array();
	var keywordText = doc.evaluate('//div[span="Index Terms:"]/div', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if (keywordText) keywords = (Zotero.Utilities.trimInternal(keywordText.textContent.toLowerCase())).split(",");
	var attachments = new Array();
	var notes = new Array();
	attachments.push({document:doc});

	var htmls = doc.evaluate('//img[@src="/plugins/images/digitalLibrary/dl_html_icon.gif"]/ancestor::a', doc,nsResolver,XPathResult.ANY_TYPE, null);
	var htmlDoc;

	if (htmlDoc = htmls.iterateNext()) {
		//var urlField = htmlDoc.attributes.getNamedItem("onclick").value;
		var urlField = htmlDoc.href;
		urlField = urlField.substr(urlField.indexOf('"')+1);
		urlField = urlField.substr(0,urlField.indexOf('"'));
		if (urlField.indexOf("?") > -1) {
			urlField += '&'+templte;
		}
		else {
			urlField += '?'+templte;
		}
		urlField = "http://www2.computer.org"+urlField;
		var mimeTypeField = "text/html";
		var titleField = "Complete HTML document";
		var attachment = {url:urlField, mimeType:mimeTypeField, title:titleField};
		attachments.push(attachment);
	}

	var pdfs = doc.evaluate('//img[@src="/plugins/images/digitalLibrary/dl_pdf_icon.gif"]/ancestor::a', doc,nsResolver,XPathResult.ANY_TYPE, null);
	var pdf;

	if (pdf = pdfs.iterateNext()) {
		//deprecated
		//var onclickAttrValue = pdf.attributes.getNamedItem("onclick").value;
		//var urlField = onclickAttrValue.substring( 10, onclickAttrValue.indexOf("',") );
		var urlField = pdf.attributes.getNamedItem("onclick").value;
		urlField = urlField.substr(urlField.indexOf('"')+1); 
		urlField = urlField.substr(0,urlField.indexOf('"'));
		
		if (urlField.indexOf("?") > -1) {
			urlField += '&'+templte;
		}
		else {
			urlField += '?'+templte;
		}
		urlField = "http://www2.computer.org"+urlField;
		var mimeTypeField = "application/pdf";
		var titleField = "Complete PDF document";
		var attachment = {url:urlField, mimeType:mimeTypeField, title:titleField};
		attachments.push(attachment);
	} else {
		notes.push( {note:"Complete PDF document was either not available or accessible. Please make sure you're logged in to the digital library to retrieve the complete PDF document."} );
	}

	var bibtex = doc.evaluate('//div[@id="bibText-content"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();

	if (bibtex) {
		bibtex = bibtex.textContent;
		//bibtex = bibtex.substring(bibtex.indexOf("document.write('")+16,bibtex.indexOf("');Popup.document.close();")); 
		//workaround as bibtex translator obviously needs a whitespace following the first curly brace
		bibtex = Zotero.Utilities.cleanTags(bibtex);
		bibtex = Zotero.Utilities.trimInternal(bibtex);

		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("9cb70025-a888-4a29-a210-93ec52da40d4");
		translator.setString(bibtex);
		translator.setHandler("itemDone", function(obj, item) {
			if (item.url) { // add http to url
				item.url = "http://"+item.url;
			}
			if (itemType) item.itemType = itemType;
			item.attachments = attachments;
			if (abstractText) item.abstractNote = abstractText;
			if (keywords) item.tags = keywords;
			if (notes) item.notes = notes;
			
			item.complete();
		});
		translator.translate();

	} else {
		throw "No BibTeX found!";
	}
}