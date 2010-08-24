{
        "translatorID":"e4660e05-a935-43ec-8eec-df0347362e4c",
        "label":"ERIC",
        "creator":"Ramesh Srigiriraju, Avram Lyon",
        "target":"^http://(?:www\\.)?eric\\.ed\\.gov/",
        "minVersion":"1.0.0b4.r1",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2010-08-24 07:23:41"
}

function detectWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	// Search results
	var searchpath='//div[@id="searchFaceted"]//td[@class="resultHeader"]';
	if(doc.evaluate(searchpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext())
		return "multiple";
	// Clipboard
	if(url.match(/ERICWebPortal\/search\/clipboard\.jsp/))
		return "multiple";	
	// folder
	if(url.match(/ERICWebPortal\/MyERIC\/clipboard\/viewFolder\.jsp\?folderIndex/))
		return "multiple";	
	// Individual record
	var singpath='//div[@id="titleBarBlue"]';
	var res = doc.evaluate(singpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	if(res && res.textContent.indexOf("Record Details") !== -1)	{
		var typepath='//tr[td/span/a/strong/text()="Pub Types:"]/td[2]/text()';
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
	if(detectWeb(doc, url) == "multiple")	{
		var string="http://eric.ed.gov/ERICWebPortal/custom/portlets/clipboard/performExport.jsp";
		var items=new Array();
		if(url.match(/ERICWebPortal\/search\/clipboard\.jsp/)
			|| url.match(/ERICWebPortal\/MyERIC\/clipboard\/viewFolder\.jsp\?folderIndex/)) {
			// We have a clipboard or folder page; structure is the same
			var rowpath='//table[@class="tblDataTable"]/tbody/tr[td]';
			var rows = doc.evaluate(rowpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var row, id, title;
			while(row = rows.iterateNext()) {
				title = doc.evaluate('./td[2]/a', row, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				id = doc.evaluate('./td[6]', row, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				Zotero.debug(title + id);
				items[id] = Zotero.Utilities.cleanTags(Zotero.Utilities.cleanString(title));
			}
		} else {
			// We have normal search results
			var idpath='//a[img[@width="64"]]';
			var ids=doc.evaluate(idpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var titlpath='//table[@class="tblSearchResult"]//td[@class="resultHeader"][1]/p/a';
			var titlerows=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var id;
			while(id=ids.iterateNext())
				items[id.id]=Zotero.Utilities.cleanTags(Zotero.Utilities.cleanString(titlerows.iterateNext().textContent));
		}
		items=Zotero.selectItems(items);
		if (!items) return false;
		var string="http://eric.ed.gov/ERICWebPortal/MyERIC/clipboard/performExport.jsp?";
		for(var ids in items)
			string+="accno="+ids+"&";
		string+="texttype=endnote&citationtype=brief&Download.x=86&Download.y=14";
		Zotero.debug(string);
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
	var type = detectWeb(doc, url);
	if(type && type != "multiple")	{
		var idpath='//tr[/td[1]/span/a/strong/contains("ERIC #")]/td[2]';
		var idpath2='//meta[@name="eric #"]/@content';
		var id = url.match(/accno=([^&]+)/)[1];
		var string="http://eric.ed.gov/ERICWebPortal/MyERIC/clipboard/performExport.jsp?";
		string+= "accno="+ id+"&texttype=endnote&citationtype=brief&Download.x=86&Download.y=14";
		Zotero.debug(string);
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
