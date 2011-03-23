{
        "translatorID":"ce68b0ed-3137-4e38-b691-f3bc49bc1497",
        "label":"Pleade",
        "creator":"DIA Modou",
        "target":"base=ead|ead\\.html|list-results\\.html",
        "minVersion":"1.0",
        "maxVersion":"",
        "priority":100,
        "inRepository":true,
        "translatorType":4,
        "lastUpdated":"2011-03-03 20:46:08"
}

/*
Pleade: Publishing Tool for finding, authority records
and a series of digitized images.
Copyright (C) 2003-2011 AJLSM

AJLSM
17, rue Vital Carles
33000 Bordeaux, France
info@ajlsm.com

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the
Free Software Foundation, Inc.
59 Temple Place - Suite 330, Boston, MA  02111-1307, USA
or connect to:
http://www.fsf.org/copyleft/gpl.html
*/

/* Example URLs:
 - http://jubilotheque.upmc.fr/results.html?base=ead&champ1=fulltext&op1=AND&search_type=simple&query1=pau&ssearch-submit-npt.x=0&ssearch-submit-npt.y=0
 - http://jubilotheque.upmc.fr/ead.html?id=BG_000007_002#!{%22content%22:[%22BG_000007_002_e0000002%22,true,%22%22]}
 - http://jubilotheque.upmc.fr/list-results.html?mode=subset&champ1=subsetall&query1=physique&cop1=AND
 */

/**
 * Function provided by zotero. It permit to detect web page which are compatible with this translator
 */
function detectWeb(doc, url) {
	if (url.match("id=") && url.match("ead.html")) {
		return "book";
	}
	else if (url.match("base=ead") && url.match("results.html")) {
		return "multiple";
	}
	else if (url.match("list-results.html") && url.match("mode=")) {
		return "multiple";	
	}
}

/**
 * Function find-replace
 * @param expr : string to check
 * @param a : string to find
 * @param b : string to use for replacing @a
 */
function Remplace(expr,a,b) {
	var i=0
	while (i!=-1) {
		i=expr.indexOf(a,i);
		if (i>=0) {
			expr=expr.substring(0,i)+b+expr.substring(i+a.length);
			i+=b.length;
		}
	}
	return expr
}

/**
 * Get an author from Pleade and decide if it can be published in zotero or not.
 * This function permit to resolv lot of bug in zotero beacuse  some "string author"
 * in pleade was not normalized.
 * @param newItem : zotero variable which contain field to publish
 * @param author :  "string author"
 * @param managed : this field is provided by Pleade and permit to now if the @author is normalized
 */
function getAuthors(newItem, author, managed) {
	if(managed=="true") newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
}

/**
 * This function take raw data from pleade and it extract field "Tags" for zotero
 * @param newItem : zotero variable which contain field to publish
 * @param book :  raw data; actualy a xml tree
 */
function getTag(newItem, book) {
	var Tags = new Array();
	
	for(var i=0; i<book.subject.length(); i++) {
		Tags.push(Zotero.Utilities.superCleanString(book.subject[i].text().toString()));
	}

	newItem.abstractNote = Tags;
}

/**
* If a web web page that describe book is matched, this function call Pleade for getting metadatas. And then
* it scrape them to zotero.
* @param url : the url to give to pleade for getting metadatas.
*/
function scrape(url) {

	// Debug mode
	Zotero.debug("Getting a term :  "  + url);

	Zotero.Utilities.HTTP.doGet(url, function(text) {

		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
		text = text.replace(/(<[^!>][^>]*>)/g, function replacer(str, p1, p2, offset, s) {return str.replace(/-/gm, "");});
		text = text.replace(/(<[^!>][^>]*>)/g, function replacer(str, p1, p2, offset, s) {return str.replace(/:/gm, "");});
		text = Zotero.Utilities.trim(text);

		XML.prettyPrinting = false;
		XML.ignoreWhitespace = false;
		var xml = new XML(text);

		for(var i=0 ; i <xml.book.length() ; i++) {
			var newItem = new Zotero.Item("book");
			var book = xml.book[i];

			newItem.url = Zotero.Utilities.superCleanString(book.link.text().toString());
			newItem.title = Zotero.Utilities.superCleanString(book.title.text().toString());
			//newItem.seriesNumber = Zotero.Utilities.superCleanString(book.num.text().toString());
			for(var j=0; j<book.author.length(); j++) getAuthors(newItem, Zotero.Utilities.superCleanString(book.author[j].text().toString()),Zotero.Utilities.superCleanString(book.managed[j].text().toString()));
			newItem.date = Zotero.Utilities.superCleanString(book.date.text().toString());
			newItem.publisher = Zotero.Utilities.superCleanString(book.publisher.text().toString());
			newItem.place = Zotero.Utilities.superCleanString(book.publisherAddr.text().toString());
			newItem.language = Zotero.Utilities.superCleanString(book.lang.text().toString());
			newItem.rights = Zotero.Utilities.superCleanString(book.rights.text().toString());
			//getTag(newItem, book);
			//newItem.extra.push({url: Zotero.Utilities.superCleanString(book.doclink.@href.text().toString()), title: Zotero.Utilities.superCleanString(book.doclink.text().toString()), mimeType: Zotero.Utilities.superCleanString(book.doclink.@mime-type.text().toString()), snapshot: false});
			//newItem.archiveLocation = Zotero.Utilities.superCleanString(book.archLoc.text().toString());
			//newItem.libraryCatalog = Zotero.Utilities.superCleanString(book.serverName.text().toString());
			newItem.callNumber = Zotero.Utilities.superCleanString(book.cote.text().toString());
	
			newItem.complete();
		}

		Zotero.done();
	})
	Zotero.wait();
}

/**
* If a web page that describe multiple is matched, this function give the number of different field.
* @param text : variable provided by Pleade wich describe the actual page
*/
function getNbrTerms(text)
{
	var temp1 = text.substr(text.indexOf("nb")+4,10);
	var nbr = temp1.substring(0,temp1.indexOf("\""));

	return parseInt(nbr);
}

/**
* If a web page that describe multiple is matched, this function call Pleade for getting the terms in that page. And then, it call the 
* zotero.selectItem function and finaly it scrape the selected items in zotero.
* @param doc : the javascript doc var
* @param url : url to give to Pleade for getting informations in that page.
*/
function getMultipleQid(doc,url)
{
	var qId;

	Zotero.Utilities.HTTP.doGet(url, function(text) {

		text = text.replace(/<!DOCTYPE[^>]*>/, "").replace(/<\?xml[^>]*\?>/, "");
		text = Zotero.Utilities.trim(text);
		
		var temp1;
		
		if(url.match("base=ead") && url.match("results.html")) {
			temp1 = text.substr(text.indexOf("var oid")+11,30);
			qId = temp1.substring(0,temp1.indexOf("\""));
		}
		else if(url.match("list-results.html") && url.match("mode=")) {
			temp1 = text.substr(text.indexOf("var _qid")+12,30);
			qId = temp1.substring(0,temp1.indexOf("\""));
			//qId = temp1;
		}

		Zotero.debug("qId :  " + qId);
		
		var newURL = url.substring(url.indexOf("http"), url.indexOf("results.html"))+"functions/zotero/results/"+qId;
		Zotero.debug("Getting terms : " + newURL);

		// Getting field.title
		Zotero.Utilities.HTTP.doGet(newURL, function(text2) {
	
			text2 = text2.replace(/(<[^!>][^>]*>)/g, function replacer(str, p1, p2, offset, s) {return str.replace(/-/gm, "");});
			text2 = text2.replace(/(<[^!>][^>]*>)/g, function replacer(str, p1, p2, offset, s) {return str.replace(/:/gm, "");});
			text2 = Zotero.Utilities.trim(text2);


			var temp = text2.substring(text2.indexOf("\<title\>"),text2.lastIndexOf("\<\/pleadeId\>")+11);
			var pids = new Array();
			
			var max=text2.substring(text2.indexOf("nbrresult\>")+20, text2.lastIndexOf("\<nbrresult"));
			max=parseInt(max.substring(max.indexOf("\>")+1, max.lastIndexOf("\<")));
			
			//this loop get fields from Pleade
			for(var i=0; i< max; i++) 
			{
				var title = temp.substring(temp.indexOf("\<title\>")+7,temp.indexOf("\<\/title\>"));
				var pleadeId = temp.substring(temp.indexOf("\<pleadeId\>")+10,temp.indexOf("\<\/pleadeId\>"));
				temp = temp.substring(temp.indexOf("\<result\>")+8,temp.lastIndexOf("\<\/pleadeId\>")+11);
		
				pids[pleadeId] = title;
			}

			var newURL2 = url.substring(url.indexOf("http"), url.indexOf("results.html"))+"functions/zotero/";
		
			var tpids = Zotero.selectItems(pids);
		
			for(var i in tpids) {
				scrape(newURL2+i+".xml?fragment=null");
			}

		})

		Zotero.done();
	})
	Zotero.wait();
}

/**
* Function provided by zotero
*/
function doWeb(doc, url) {
	var pleadeId;
	var fragmentId;
	var text;
	
	if (detectWeb(doc, url) == "multiple") {
		getMultipleQid(doc,url);
	}
	else if (detectWeb(doc, url) == "book") {

		// Building the Pleade id of the actual document
		if(url.indexOf("\&") != -1) pleadeId = url.substring(url.indexOf("id=")+3,url.indexOf("\&"));
		else if(url.indexOf("\&") == -1) pleadeId = url.substring(url.indexOf("id=")+3,url.indexOf("#"));
		else pleadeId = url.substring(url.indexOf("id=")+3,url.length);
		
		// Building the Pleade fragment id of the actual document
		var temp1 = url.substring(url.indexOf("#"),url.length);
		var temp2 = temp1.substring(temp1.indexOf(pleadeId), temp1.length);
		fragmentId = temp2.substring(0,temp2.indexOf("%"));

		scrape(url.substring(url.indexOf("http"), url.indexOf("ead.html"))+"functions/zotero/"+pleadeId+".xml?fragment="+fragmentId);
	}
}
