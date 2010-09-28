{
        "translatorID":"ecd1b7c6-8d31-4056-8c15-1807b2489254",
        "label":"BOCC",
        "creator":"José Antonio Meira da Rocha",
        "target":"^http:\\/\\/[^/]*bocc[^/]*/(?:_listas|_esp)",
        "minVersion":"1.0",
        "maxVersion":"",
        "priority":100,
        "inRepository":true,
        "translatorType":4,
        "lastUpdated":"2010-09-20 18:12:01"
}

/*
	BOCC Translator - Parses BOCC indexes and creates Zotero-based metadata.
	Copyright (C) 2010 José Antonio Meira da Rocha

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program. If not, see <http://www.gnu.org/licenses/>.
*/


// Standard  Zotero function
function detectWeb(doc, url) {
	if (doc.evaluate("//table[@class='ag']/tbody/tr[1]/td[@class='agenda']", doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		Zotero.debug("multiple");
		return "multiple";
	}
}
///////////////////////////////////////
function getAuthors(newItem, itemsAutors) {
  //Formatting and saving "Author" field
  if (items["AUTOR"]) {
    var author = itemsAutors["AUTOR"];
    if (author.match(";")) {
      var authors = author.split(";");
      for (var i in authors) {
        newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[i], "author"));
      }
    } else {
      newItem.creators.push(Zotero.Utilities.cleanAuthor(author, "author"));
    }
  } 
}
// Standard Zotero translator entry point
function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	var articles = new Array();
	var items = new Object();
	var itemsAutors = new Object();
	var itemDate = new Object();
	var nextTitle;
	var urls = new Array();
	var bloco;
	var lines = new Array();
	var resite = /^http:\/\/[^\/]*bocc[^\/]*\/(?:_listas|_esp)/;
	var site = resite.exec(url);
	site = site[0];
	site = site.replace("/_esp", "");
	site = site.replace("/_listas", "");
	Zotero.debug('Site===>'+site+'<===');
	if (detectWeb(doc, url) == "multiple") {
		// Return XPathResult object
		// accessible with .iterateNext() method
		var content = doc.evaluate("//table[@class='ag']/tbody/tr[1]/td[@class='agenda']", doc, nsResolver, XPathResult.ANY_TYPE, null);
		// All articles are in same <td>
		// Get the first <td> data 
		bloco = content.iterateNext().innerHTML;
		lines = bloco.split('<br><br>');
		//Zotero.debug('Artigo===>'+lines[0]+'<===');
		///////////////////////////////////////////////
		// Try get tags
		var tematica = doc.evaluate("//title", doc, nsResolver, XPathResult.ANY_TYPE, null);
		tematica = tematica.iterateNext().textContent;
		//Zotero.debug('<Title>===>'+tematica+'<===');
		var isTematica = tematica.match('Temática');
		if (isTematica) {
			// Get tematicas list to build tags list
			var tematicanum;
			var tematicasnums =  doc.evaluate('//a[@class="tematica"]/@href', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var tematicasname;
			var tematicasnames =  doc.evaluate('//a[@class="tematica"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		
			var tematicas = new Object();
			while (tematicanum = tematicasnums.iterateNext()) {
				tematicanum = tematicanum.textContent;
				tematicanum = tematicanum.match(/=[\d]+$/)[0];
				tematicanum = tematicanum.replace('=','');
				tematicaname = tematicasnames.iterateNext().textContent;
				tematicas[tematicanum] = tematicaname;
			}		
			////////////////////////////////////////////
			// Get current tematica 
			var tagsContent = new Array();


			tematica = tematica.match(/:\s[\d]*\s-/)[0];
			tematica = tematica.replace(': ','');
			tematica = tematica.replace(' -','');
			tematicaname = tematicas[tematica];
			//Zotero.debug('Tematica ===>'+tematicaname+'<===');
			// Build tags
			if (tematicaname.match(' e ')) {
				tagsContent = tematicaname.split(' e ');
				if (tagsContent[0].match(',')) {
					var temp = tagsContent[0].split(',');
					tagsContent.push(temp[1]);
					tagsContent[0] = temp[0];
				}
			} else {
				tagsContent[0] = tematicaname;
			}
			//for (var i in tagsContent) {
			//	Zotero.debug('Tag ===>'+i+'='+tagsContent[i]+'<===');
			//}		
		} // if (isTematica) 
		/////////////////////////////////////////////
		var title;
		var docurl;
		var autores = new Array();
		var reurl = /href="([^"]+)/ ;
		var reautor= /autor.php[^>]+"agenda">([^<]+)/g ;
		var redate = /(\d\d\d\d$)/g ;
		for (var n in lines) {
			title = Zotero.Utilities.cleanTags(lines[n].split('<br>')[0]);
			title = Zotero.Utilities.trimInternal(Zotero.Utilities.trim(title));
			title = Zotero.Utilities.unescapeHTML(title);
			docurl = reurl.exec(lines[n]);
			if (docurl) {
				if (docurl[1].match('autor')) {
					docurl = '';
				} else {
					items[docurl[1]] = title;
					autores = lines[n].match(reautor);
					for(var i in autores){
						autores[i] = autores[i].split('>')[1];
					}
					itemsAutors[docurl[1]] = autores ;
					date = lines[n].match(redate);
					//Zotero.debug('Data===>'+date[0]+'<===');
					itemDate[docurl[1]] = date[0] ;
				}
			}
		}
		//Zotero.debug('URL===>'+docurl[1]+'<===');
		/* Zotero.selectItems()
		 * Presents items to select in the select box. 
		 * Assumes window.arguments[0].dataIn is an object with
		 * URLs as keys and descriptions as values
		 */
		items = Zotero.selectItems(items);
		for (var n in items) {
			Zotero.debug('Item '+n+' ==>'+items[n]+'<==');
		};

		var filetitle;
		var filemime;
		for (var item in items) {			
			var newItem = new Zotero.Item("journalArticle");
			newItem.title = items[item];
			newItem.date = itemDate[item];
			newItem.publicationTitle = "Biblioteca Online de Ciências da Comunicação";
			newItem.ISSN = '1646-3137';
			newItem.journalAbbreviation = 'BOCC' ;
			// http://www.bocc.ubi.pt
			newItem.url = site+item.replace("..", "");
			fileurl = site+item.replace("..", "")
			Zotero.debug('Doc ===>'+fileurl+'<===');
			if (fileurl.match('.html$|.htm$|.HTML$|.HTM$')) {
				filetitle = 'Anexo HTML';
				filemime = 'text/html';
			};
			if (fileurl.match('.pdf$|.PDF$')) {
				filetitle = 'Anexo PDF';
				filemime = 'application/pdf';
			};
			Zotero.debug('File title ===>'+filetitle+'<===');
			Zotero.debug('File mime ===>'+filemime+'<===');
			newItem.attachments.push(
				{url:fileurl, title:filetitle, mimeType:filemime}
			);
			temp = itemsAutors[item];
			for (var i in temp) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(temp[i], "author"));			
			}
			if (isTematica) {
				for (var i = 0; i < tagsContent.length; i++) {
					newItem.tags[i] = tagsContent[i];
				}
			}
			newItem.complete();
		}
		//debug

		Zotero.wait();
	}
}
