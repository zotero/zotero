{
	"translatorID":"e4660e05-a935-43ec-8eec-df0347362e4c",
	"translatorType":4,
	"label":"ERIC",
	"creator":"Ramesh Srigiriraju",
	"target":"^http://(?:www\\.)?eric\\.ed\\.gov/",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-12-15 05:30:00"
}

function detectWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var searchpath='//form[@name="searchResultsForm"][@id="searchResultsForm"]';
	if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
		return "multiple";
	//var singpath='//tr/td[@class="primaryHeader"][contains(text(), "Record Details")]';
	var singpath='contains(//div[@id="titleBarBlue"]/text(), "Record Details")';
	if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).booleanValue)	{
		var typepath='//tr[td/span/strong/text()="Pub Types:"]/td[2]/text()';
		var typestr=doc.evaluate(typepath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
		var typereg=new RegExp("([^;/\-]+)");
		var typearr=typereg.exec(typestr);
		if(typearr[1]=="Journal Articles")
			return "journalArticle";
		if(typearr[1]=="Information Analyses")
			return "journalArticle";
		if(typearr[1]="Machine")
			return "computerProgram";
		if(typearr[1]="Computer Programs")
			return "computerProgram";
		if(typearr[1]="Dissertations")
			return "thesis";
		if(typearr[1]="Reports")
			return "report";
		if(typearr[1]="Non")
			return "audioRecording";
		if(typearr[1]="Legal")
			return "statute";
		else
			return "book";
	}
}

function doWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var searchpath='//form[@name="searchResultsForm"][@id="searchResultsForm"]';
	if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())	{
		var string="http://eric.ed.gov/ERICWebPortal/custom/portlets/clipboard/performExport.jsp";
		var idpath='//a[img]/@id';
		var ids=doc.evaluate(idpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var items=new Array();
		var titlpath='//tr[1]/td[1]/p/a';
		var titlerows=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var id;
		while(id=ids.iterateNext())
			items[id.nodeValue]=Zotero.Utilities.cleanTags(Zotero.Utilities.cleanString(titlerows.iterateNext().textContent));
		items=Zotero.selectItems(items);
		var string="http://eric.ed.gov/ERICWebPortal/custom/portlets/clipboard/performExport.jsp?";
		for(var ids in items)
			string+="accno="+ids+"&";
		string+="texttype=endnote&citationtype=brief&Download.x=86&Download.y=14";
		Zotero.Utilities.HTTP.doGet(string, function(text)	{
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.setHandler("itemDone", function(obj, newItem)	{
				var linkpath='//tbody[tr/td/a/@id="'+newItem.itemID+'"]/tr/td/p/a[@class="action"]';
				var link=doc.evaluate(linkpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(link)
					newItem.attachments.push({url:link.href, title:newItem.title, mimeType:"application/pdf"});
				newItem.complete();
			});
			trans.translate();
			Zotero.done();
		});
		Zotero.wait();
	}
	var singpath='contains(//div[@id="titleBarBlue"]/text(), "Record Details")';
	if(doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).booleanValue)	{
		var idpath='//input[@type="hidden"][@name="accno"]/@value';
		var idpath2='//meta[@name="eric #"]/@content';
		var id = url.match(/accno=([^&]+)/)[1];
		var string="http://eric.ed.gov/ERICWebPortal/custom/portlets/clipboard/performExport.jsp?accno=";
		string+= id+"&texttype=endnote&citationtype=brief&Download.x=86&Download.y=14";
		Zotero.Utilities.HTTP.doGet(string, function(text)	{
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.setHandler("itemDone", function(obj, newItem)	{
				var linkpath='//tr/td/p[img/@alt="PDF"]/a';
				var link=doc.evaluate(linkpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				if(link)
					newItem.attachments.push({url:link.href, title:newItem.title, mimeType:"application/pdf"});
				newItem.complete();
			});
			trans.translate();
			Zotero.done();
		});
		Zotero.wait();
	}
}