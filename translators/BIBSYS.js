{
	"translatorID":"ab961e61-2a8a-4be1-b8a3-044f20d52d78",
	"translatorType":4,
	"label":"BIBSYS",
	"creator":"Ramesh Srigiriraju",
	"target":"^http://ask\\.bibsys\\.no/ask/action",
	"minVersion":"1.0.0b4.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-07-31 16:45:00"
}

function detectWeb(doc, url)	{
	var multireg=new RegExp("^http://ask\.bibsys\.no/ask/action/result");
	if(multireg.test(url))
		return "multiple";
	var singlereg=new RegExp("^http://ask\.bibsys\.no/ask/action/show");
	if(singlereg.test(url))
		return "book";
}

function doWeb(doc, url)	{
	var namespace=doc.documentElement.namespaceURI;
	var nsResolver=namespace?function(prefix)	{
		return (prefix=="x")?namespace:null;
	}:null;
	var multireg=new RegExp("http://ask\.bibsys\.no/ask/action/result");
	if(multireg.test(url))	{
		var titlpath='//tr/td[@width="49%"][@align="left"][@valign="top"]/a/text()';
		var titles=doc.evaluate(titlpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var codepath='//tr/td/input[@type="checkbox"][@name="valg"]/@value';
		var codes=doc.evaluate(codepath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var items=new Array();
		var title;
		titles.iterateNext();
		while(title=titles.iterateNext())
			items[codes.iterateNext().nodeValue]=title.nodeValue;
		items=Zotero.selectItems(items);
		var string="http://ask.bibsys.no/ask/action/result?control=ctr_top";
		for(var codes in items)
			string+="&valg="+codes;
		string+="&control=ctr_bottom&eksportFormat=refmanager&eksportEpostAdresse=&eksportEpostFormat=fortekst&cmd=sendtil";
		Zotero.Utilities.HTTP.doGet(string, function(text)	{
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.translate();
			Zotero.done();
		});
		Zotero.wait();
	}
	var singlereg=new RegExp("http://ask\.bibsys\.no/ask/action/show");
	if(singlereg.test(url))	{
		var urlstring="http://ask.bibsys.no/ask/action/show";
		var data="visningsformat=fortekst_m_eksemplarer&eksportFormat=refmanager&eksportEpostAdresse=&eksportEpostFormat=fortekst&cmd=sendtil";
		Zotero.Utilities.HTTP.doPost(urlstring, data, function(text)	{
			var trans=Zotero.loadTranslator("import");
			trans.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			trans.setString(text);
			trans.translate();
			Zotero.done();
		});
		Zotero.wait();
	}
}