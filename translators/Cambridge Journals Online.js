{
	"translatorID":"850f4c5f-71fb-4669-b7da-7fb7a95500ef",
	"translatorType":4,
	"label":"Cambridge Journals Online",
	"creator":"Sean Takats and Michael Berkowitz",
	"target":"https?://[^/]*journals.cambridge.org[^/]*//?action/(quickSearch|search|displayAbstract|displayFulltext|displayIssue)",
	"minVersion":"1.0.0b3r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-07-08 15:35:00"
}

function detectWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var xpath = '//tr[td/input[@type="checkbox"][@name="toView"]]';
	if ((url.indexOf("/action/displayAbstract") != -1) || (url.indexOf("action/displayFulltext") != -1)){
		return "journalArticle";
	} else if (doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()){
		return "multiple";			
	}
}

function doWeb(doc, url){
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var host = doc.location.host;
	var urlstring="http://" + host + "/action/exportCitation";
	var datastring="format=RIS&emailId=&Download=Download&componentIds=";
	var links = new Array();
	if(detectWeb(doc, url) == "multiple"){
		var xpath = '//tr[td/input[@type="checkbox"][@name="toView"]]';
		var tableRows = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var tableRow;
		var items=new Array();
		while (tableRow = tableRows.iterateNext()){
			var id = doc.evaluate('./td/input[@type="checkbox"][@name="toView"]/@value', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			var title = doc.evaluate('./td/h3', tableRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			items['http://' + host + '/action/displayAbstract?aid=' + id.nodeValue] = Zotero.Utilities.capitalizeTitle(title.textContent);
		}
		items=Zotero.selectItems(items);
		for (var i in items) {
			links.push(i);
		}
	} else {
		links = [url];
	}
	Zotero.Utilities.processDocuments(links, function(doc) {
		if (doc.evaluate('//p[@class="AbsType"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var abs = doc.evaluate('//p[@class="AbsType"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
		}
		if (doc.evaluate('//p[@class="KeyWords"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var kws = doc.evaluate('//p[@class="KeyWords"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent.substr(11).split('; ');
		}
		var pdfpath='//div/ul/li/a[contains(text(), "PDF")]';
		if (doc.evaluate(pdfpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
			var pdflink =doc.evaluate(pdfpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		}
		idRe = /aid=([0-9]+)/
		var m = idRe.exec(doc.location.href);
		var id = m[1];
		Zotero.Utilities.HTTP.doGet(urlstring + "?" + datastring+id, function(text) {
			text = text.replace(/(^|\n)?([A-Z\d]{2})\s+\-\s+(\n)?/g, "\n$2  - $3");
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.setHandler("itemDone", function(obj, item) {
				item.attachments = 	[{url:url, title:"Cambridge Journals Snapshot", mimeType:"text/html"}]
				if (pdflink) item.attachments.push({url:pdflink, title:"Cambridge Journals PDF", mimeType:"application/pdf"});
				item.url = url;
				item.title = Zotero.Utilities.capitalizeTitle(item.title);
				var authors = item.creators;
				item.creators = new Array();
				for each (var aut in authors) {
					item.creators.push({firstName:aut.firstName, lastName:aut.lastName, creatorType:"author"});
				}
				if (kws) item.tags = kws;
				if (abs) item.abstractNote = Zotero.Utilities.trimInternal(abs);
				item.complete();
			});
			translator.translate();
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}