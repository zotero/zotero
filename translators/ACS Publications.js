{
	"translatorID":"938ebe32-2b2e-4349-a5b3-b3a05d3de627",
	"translatorType":4,
	"label":"ACS Publications",
	"creator":"Sean Takats and Michael Berkowitz and Santawort",
	"target":"http://[^/]*pubs3?.acs.org[^/]*/(?:wls/journals/query/(?:subscriberResults|query)\\.html|acs/journals/toc.page|cgi-bin/(?:article|abstract|sample|asap).cgi)?",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-07-21 19:20:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	if(doc.evaluate('//input[@id="articleListHeader_selectAllToc"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("multiple");
		return "multiple";
	} else if (doc.evaluate('//div[@id="articleHead"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	}
	return false;
}

function doWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var host = 'http://' + doc.location.host + "/";
	Zotero.debug(host);
	var m = url.match(/https?:\/\/[^\/]*\/doi\/(abs|full)\/([^\?]+)/);
	var dois = new Array();
	if(detectWeb(doc, url) == "multiple") { //search
		var doi;
		var title;
		var availableItems = new Array();
		var xpath = '//div[@class="articleBox"]';
		if (doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var elmt = elmts.iterateNext();
			do {
				title = doc.evaluate('./div[@class="articleBoxMeta"]/h2', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				doi = doc.evaluate('./div[@class="articleBoxMeta"]/h2/a/@href', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace("/doi/abs/","");
				if (doi.indexOf("prevSearch") != -1){
					doi = doi.substring(0,doi.indexOf("?"));
				}
				availableItems[doi] = title;
			} while (elmt = elmts.iterateNext())
		}
		var items = Zotero.selectItems(availableItems);
		if(!items) {
			return true;
		}
		for(var i in items) {
			dois.push(i);
		}
	} else if (m){ //single article
		var doi = m[2];
		if (doi.match("prevSearch")) {
			doi = doi.substring(0,doi.indexOf("?"));
		}
		Zotero.debug("DOI= "+doi);
		dois.push(doi);
	}
	
	var setupSets = [];
	for each (doi in dois) {
		var citUrl = host + 'action/showCitFormats?doi=' + doi;
		setupSets.push({ doi: doi, citUrl: citUrl });
	}
	
	var setupCallback = function () {
		//get citation export page's source code;
		if (setupSets.length) {
			var set = setupSets.shift();
			Zotero.Utilities.HTTP.doGet(set.citUrl, function(text){
				//get the exported RIS file name;
				var downloadFileName = text.match(/name=\"downloadFileName\" value=\"([A-Za-z0-9_]+)\"/)[1];
				Zotero.debug("downloadfilename= "+downloadFileName);
				processCallback(set.doi,downloadFileName);
			});
		}
		else {
			Zotero.done();
		}
	}
	var processCallback = function (doi,downloadFileName) {
		var baseurl = "http://pubs.acs.org/action/downloadCitation";
		var post = "doi=" + doi + "&downloadFileName=" + downloadFileName + "&include=abs&format=refman&direct=on&submit=Download+article+citation+data";
		Zotero.Utilities.HTTP.doPost(baseurl, post,function(text){
			// Fix the RIS doi mapping
			text = text.replace("N1  - doi:","M3  - ");
			Zotero.debug("ris= "+ text);
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				var pdfUrl = host + 'doi/pdf/' + doi;
				var fullTextUrl = host + 'doi/full/' + doi;
				item.attachments.push(
					{title:"ACS Full Text PDF",url:pdfUrl, mimeType:"application/pdf"},
					{title:"ACS Full Text Snapshot",url:fullTextUrl, mimeType:"text/html"}
				);
				item.complete();
			});
			translator.translate();
			setupCallback();
		});
	}
	setupCallback();
	Zotero.wait();
}