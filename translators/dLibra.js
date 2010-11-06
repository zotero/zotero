{
        "translatorID":"915e3ae2-afa9-4b1d-9780-28ed3defe0ab",
        "label":"dLibra",
        "creator":"Pawel Kolodziej <p.kolodziej@gmail.com>",
        "target":"/.*dlibra\\/(doccontent|docmetadata|collectiondescription|results).*|.*/dlibra/?",
        "minVersion":"1.0.0b3.r1",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2010-10-29 21:01:35"
}
/*
   dLibra Translator
   Copyright (C) 2010 Pawel Kolodziej, p.kolodziej@gmail.com
   
   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

dd = Zotero.debug; // shortcut

function detectWeb(doc, url) {
	var singleRe = /.*dlibra\/(doccontent|docmetadata|publication).*/;
	var multipleRe = /.*dlibra\/(collectiondescription|results).*|.*\/dlibra\/?/;
	if(singleRe.test(url)) 
		return "document"; 
	if(multipleRe.test(url)) 
		return "multiple";
	return "";
}

function list2txt(list)
{
	var a= new Array();
	for each(var i in list)
		a.push(i.text());
	return a.join(", ");
	
}

function translateType(type)
{
	var types = {
		"book": /.*książka.*/ ,
		"journalArticle":  /.*artykuł.*/
		}
	
	for (var t in types)
		if (types[t].test(type))
			return t;
}


function doWeb(doc, url) {
	if(detectWeb(doc,url)=="multiple"){
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ?
			function(prefix) {
				if (prefix == 'x') return namespace; else return null;
			}: null;


		var itemsXPath = '//ol[@class="itemlist"]/li/a | //td[@class="searchhit"]/b/a';

		var obj = doc.evaluate(itemsXPath, doc, nsResolver, XPathResult.ANY_TYPE, null); 
		var itemHtml;
		var items= new Object() ;
		while(itemHtml = obj.iterateNext())
			items[itemHtml.href] = itemHtml.textContent;
		
		items = Zotero.selectItems(items);
		for (var itemUrl in items)
			doSingleItem(itemUrl)
	}else
		doSingleItem(url);
		
		
	return true;		
}

function doSingleItem(url)
{

	var reSingle= new RegExp("(.*/dlibra)/(?:doccontent|docmetadata|publication).*[?&]id=([0-9]*).*");
	var m = reSingle.exec(url);
	if(!m)
		return "";
	var baseUrl = m[1];
	var id = m[2];
	var isPIA = baseUrl.match("lib.pia.org.pl|cyfrowaetnografia.pl");
	var rdf = Zotero.Utilities.retrieveSource( baseUrl + "/rdf.xml?type=e&id="+id);
	
	rdf = rdf.replace(/<\?xml[^>]*\?>/, "");
	var rdfXml = new XML(rdf);

	rdf = new Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
	dc = new Namespace("http://purl.org/dc/elements/1.1/");
	var desc = rdfXml.rdf::Description
	
	var itemType = translateType(list2txt(desc.dc::type));
	if(!itemType)
	{
		if( isPIA )
			itemType = "journalArticle";
		else
			var itemType = "document";	
	}
	
	var item = new Zotero.Item(itemType);
	item.title = list2txt(desc.dc::title);
	
	item.rights = list2txt(desc.dc::rights)
	item.publisher = list2txt(desc.dc::publisher)
	var reComa = new RegExp(".*,.*");
	
	for each(var i in desc.dc::creator){
		var hasComa = new Boolean(reComa.exec(i.toString()));
		item.creators.push( Zotero.Utilities.cleanAuthor(i.toString(), "author", hasComa));
	}
	for each(var i in desc.dc::contributor){
		var hasComa = new Boolean(reComa.exec(i.toString()));
		item.creators.push( Zotero.Utilities.cleanAuthor(i.toString(), "contributor", hasComa));
	}
	
	item.date = list2txt(desc.dc::date);
	item.language = list2txt(desc.dc::language);
	item.description = list2txt(desc.dc::description);
	
	if(isPIA) 
	{	// hacks for lib.pia.org.pl
		// trim title at "/" character
		var stripedTitle = item.title.match("[^/]*");	
		if(stripedTitle)
			item.title = stripedTitle[0];
		d = desc.dc::description.match("([A-Za-z/ ]*)(.*)")
		item.publicationTitle = d[1]; 
		if(d[2])
		{
			vol = d[2].match("t\\. *([0-9-, ]*[0-9])");
			//dd(d[2]);
			if(vol)
				item.volume = vol[1];
			pages = d[2].match("s\\. *([0-9-, ]*[0-9])");
			if(pages)
				item.pages = pages[1];
			issue = d[2].match("z\\. *([0-9-, ]*[0-9])");
			if(issue)
				item.issue = issue[1];
		}
		
	}
//	Zotero.debug(item);
	
	item.complete();
	return item;	
}
