{
        "translatorID":"53f8d182-4edc-4eab-b5a1-141698a20202",
        "label":"TalisPrism",
        "creator":"William Smith and Emma Reisz",
        "target":"/TalisPrism/(browseResults|doSearch)",
        "minVersion":"1.0.0b4.r5",
        "maxVersion":"",
        "priority":100,
        "inRepository":"1",
        "translatorType":4,
        "lastUpdated":"2010-11-15 11:35:54"
}

/* TalisPrism translator.
 Version 1.1
 By William Smith (http://www.willsmith.org/contactme) 
 and Emma Reisz

TalisPrism is a library management system used by a number of universities 
and public bodies in the UK, Ireland and elsewhere.  
For example: http://qu-prism.qub.ac.uk/TalisPrism/ 
and http://http://star.shef.ac.uk/TalisPrism/

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


// TalisPrism doesn't use metadata so everything must be scraped.

function detectWeb(doc, url){

	/* Can't differentiate multiple from single results by URL 
	as single search results have a search URL but display as browse.
	Can't scrape the titles to differentiate between single and multiple as the display format 
	is too different to be scraped consistently.
	Instead we differentiate by URL but make an exception for a solo result.
	*/
	var search=searchTest(doc, url);
		
	if (search==1) {
		var doctype = 'multiple'; 
	} else {doctype=docType(doc, url);
	}
	return doctype;
}

function docType (doc,url){
	//Need xpaths to detect type.
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x" ) return namespace; else return null;
	} : null;

	// Best way to identify item type on an entry page is by its icon.  	
 	if (getXPath(doc, '//img[@alt="sound - disc"]/@alt').length) {		
		doctype = 'audioRecording';
	} else if (getXPath(doc, '//img[@alt="Book"]/@alt').length) {
		doctype = 'book';
	} else if (getXPath(doc, '//img[@alt="video - disc"]/@alt').length) {
		doctype = 'videoRecording';
	} else {
		doctype = 'document';	
	}
	return doctype;	
}


function searchTest (doc, url){
	
	//Need xpaths to differentiate search and item pages.
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x" ) return namespace; else return null;
	} : null;

	var searchPage;
	var search;
	if (url.match(/doSearch/)) {	
		var resultCount;
		var resultCountElements = new Array();
		var resultCountText;
		var resultCountPath = '//table/tbody/tr/td/table/tbody/tr/td[1]/font/span[@class="text"]/font';
		var resultCountObject = doc.evaluate(resultCountPath, doc, nsResolver, XPathResult.ANY_TYPE, null);		
		while (resultCountText = resultCountObject.iterateNext()) {
			resultCountElements.push(resultCountText.textContent);
		}
		resultCount=resultCountElements[0];
		if (resultCount == 1) {
			search=0;
		} else {
			search=1;	
		}
	} else {
		var pageCount;
		var pageCountElements = new Array();
		var pageCountText;
		var pageCountPath= '//tbody/tr/td[2]/font/span[@class="text"]/table/tbody/tr[2]/td/font/span[@class="text"]/table/tbody/tr/td[4]';
		var pageCountObject = doc.evaluate(pageCountPath, doc, nsResolver, XPathResult.ANY_TYPE, null);		
		while (pageCountText = pageCountObject.iterateNext()) {
			pageCountElements.push(pageCountText.textContent);
		}
		pageCount=pageCountElements[0];	
		if (pageCount==undefined){
			search=0;
		} else if (pageCount.match(/Page/)){
			search=1
		} else {
			search=0;
		}
	}
	return search;
}

function getXPath ( doc, field ) {
	xpath = field;
	
	content = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext();

	if (content)
		return content.textContent;
	else
		return '';

}

//TalisPrism displays with labels. The getField function searches for the next different field after a label.

function getField (doc, field) {

	xpath='//span[@class="text"]';

	content = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);

	while (c = content.iterateNext())
	{
		if (c.textContent == field)
		{
			// OK, find the next field
			while (val = content.iterateNext()) {
	
				if (val && val.textContent != c.textContent)
				{
					return val.textContent;
				}
			}
		}
	}
	return '';
}

function multiscrape(doc, url) {
	url=doc.documentURI;
	var item;
	var doctype = docType(doc, url);
	item        = new Zotero.Item(doctype);	
	scrape(doc,url, item);	
}


function soloscrape(doc, url) {
	url=doc.documentURI;
	var item;
	item        = new Zotero.Item(doctype);	
	scrape(doc,url, item);
	return '';	
}


function scrape(doc, url, item){
	var namespace = doc.documentElement.namespaceURI; 
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null; 
	} : null;
	
	// The fields often contain multiple data types and need some cleanup.
	var title = getField(doc, 'Title');

	if (title.length == 0) {
		title = 'Unknown Title';
	}
	// If title includes a forward slash, omit the last bit.
	if (title.match('/')) {
		title = title.substring(0, title.lastIndexOf('/'));
	}
	title = title.replace(/^\s+|\s+$/g, '');
	item.title = title;

	var author     = getField(doc, 'Author');
	if (author.length) {
		item.creators.push(Zotero.Utilities.cleanAuthor(author, "author", 1));
	} else {
		author = getField(doc, 'Other Author(s) / Title(s)');
		if (author.length) {
			item.creators.push(Zotero.Utilities.cleanAuthor(author, "author", 1));
		}
	}
	
	
	// Place, publisher and publish date are in the same field.  Format is usually "Place : Publisher, yyyy".

	var publishing              = getField(doc, 'Publisher');
	if (publishing.length == 0) {
		publishing = getField(doc, 'Published');
	}
	if (publishing.length == 0) {
		publishing = getField(doc, 'Publication details');
	}

	if (publishing.match(/(13|14|15|16|17|18|19|20)\d\d/)) {
		var pos = publishing.search(/(13|14|15|16|17|18|19|20)\d\d/);
		item.date = publishing.substring(pos, publishing.lastIndexOf('.')).match(/\d\d\d\d/);
		var place = publishing.substring(0, publishing.indexOf(':'));
		item.place = place.replace(/^\s+|\s+$/g, '');
		var publisher = publishing.substring(publishing.indexOf(':')+1, pos); 
		item.publisher = publisher.replace(/^\s+|\s+$|\,\s+$/g, '');
	}


	var isbn              = getField(doc, 'ISBN');	
	if (isbn.length == 0) {
		isbn = getField(doc, 'ISBN, etc.');
	}
	
	isbn=isbn.replace(/^\D+|\D+$/g, "");	
	item.ISBN = isbn.substring(0).match(/\d+/);

	var series		  = getField(doc, 'Series');
	var pos2 =series.lastIndexOf(';');
	if (pos2==-1){
		item.series=series.replace(/^\s+|\s+$/g, '');
	}else{
		var seriesName = series.substring(0, pos2);
		item.series = seriesName.replace(/^\s+|\s+$/g, '');
		var seriesNumber = series.substring(pos2+1);
		item.seriesNumber = seriesNumber.replace(/^\s+|\s+$/g, '');
	}
		
	item.edition 		  = getField(doc, 'Edition');

	var physical			  = getField(doc, 'Physical details');
	var numPages = physical.substring(0, physical.indexOf(':'));
	item.numPages = numPages.replace(/^\s+|\s+$/g, '');
	
	var physicaldetails  = physical.substring(physical.indexOf(':')+1, physical.lastIndexOf('.'));
	physicaldetails = physicaldetails.replace(/^\s+|\s+$/g, '');
	
	var databasedetails = getField(doc, 'Cited/indexed in');
	databasedetails = databasedetails.replace(/^\s+|\s+$/g, '');
	
	item.extra = databasedetails + physicaldetails
	
	item.attachments.push({url:url, title:"Snapshot of Library Page", mimeType:"text/html"});
	
	var doctitle
	doctitle = doc.title
	if (doctitle == "TalisPrism"){
		item.libraryCatalog =url.substring(url.indexOf('http'), url.indexOf('/TalisPrism'));
	} else {
		item.libraryCatalog = doctitle
	}

	
	/* We need to XPath to the call number as we cannot be sure about the previous cell, 
	so the label method won't work. Some items have multiple call numbers, 
	but a generalised XPath which retrieves multiple sets of location data (tr[2], tr[3] etc.) 
	also retrieves tr [1], which contains all the rest of the bibliographic entry. 
	The size of tr[1] varies and there is no consistent final item, 
	so instead of using a general XPath, we scrape tr[2], tr[3] and tr[4] successively into an array; 
	tr[5] is also scraped into the array, but if non-null, 'See record for additional call numbers.' 
	is returned as the final shelfmark. Note that each call number is itself scraped into an 
	array ('shelfmarkElements'), as we need both the Library and Shelfmark elements.
	*/
	
	var shelfmark = new Array();
	var callNumber = "";

	//Need to test whether the search page has a sidebar showing as this shifts the classmarks.
		
	var authorModePath='//td/table/tbody/tr/td[1]/font/span[@class="text"]/table/tbody/tr[2]/td/font/span[@class="text"]/font/b/span[@class="text"]/table/tbody/tr/td[2]';
	var authorModeObject=doc.evaluate(authorModePath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	var browseModePath='//td/table/tbody/tr/td[1]/font/span[@class="text"]/table/tbody/tr/td[2]/font/span[@class="text"]/table/tbody/tr/td[1]';
	var browseModeObject=doc.evaluate(browseModePath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
	var shelfmarkPath = new Array();
	shelfmarkPath[0] = '//td[2]/font/span[@class="text"]/table/tbody/tr/td/font/span[@class="text"]/table/tbody/tr[2]/td';
	shelfmarkPath[1] = '//td[2]/font/span[@class="text"]/table/tbody/tr/td/font/span[@class="text"]/table/tbody/tr[3]/td';
	shelfmarkPath[2] = '//td[2]/font/span[@class="text"]/table/tbody/tr/td/font/span[@class="text"]/table/tbody/tr[4]/td';
	shelfmarkPath[3] = '//td[2]/font/span[@class="text"]/table/tbody/tr/td/font/span[@class="text"]/table/tbody/tr[5]/td';
	var shelfmarkText;
	if (authorModeObject==null||authorModeObject.innerHTML==null){
		if (browseModeObject==null||browseModeObject.innerHTML==null){
			for (var i=0; i < 4; i ++){
				var shelfmarkObject = new Array();
				var shelfmarkElements = new Array();
				shelfmarkObject[i] = doc.evaluate(shelfmarkPath[i], doc, nsResolver, XPathResult.ANY_TYPE, null);		
				while (shelfmarkText = shelfmarkObject[i].iterateNext()) {
					shelfmarkElements.push(shelfmarkText.textContent);
				}	
				shelfmark[i]=shelfmarkElements[0]+" "+shelfmarkElements[1];
				//Need to remove junk text scraped when there is a request button in the call number field.
				shelfmark[i] = shelfmark[i].replace(/\s*\/*(?:xc_d.write.*\;)/, '');
			}
		} else if  (browseModeObject.innerHTML.match(/arrow/)) {
			for (var i=0; i < 4; i ++){
				var shelfmarkObject = new Array();
				var shelfmarkElements = new Array();
				shelfmarkObject[i] = doc.evaluate(shelfmarkPath[i], doc, nsResolver, XPathResult.ANY_TYPE, null);		
				while (shelfmarkText = shelfmarkObject[i].iterateNext()) {
					shelfmarkElements.push(shelfmarkText.textContent);
				}	
				shelfmark[i]=shelfmarkElements[1]+" "+shelfmarkElements[2];
				shelfmark[i] = shelfmark[i].replace(/\s*\/*(?:xc_d.write.*\;)/, '');
			}
		}
	}else if (authorModeObject.innerHTML.match(/arrow/)){
		for (var i=0; i < 4; i ++){
			var shelfmarkObject = new Array();
			var shelfmarkElements = new Array();
			shelfmarkObject[i] = doc.evaluate(shelfmarkPath[i], doc, nsResolver, XPathResult.ANY_TYPE, null);		
			while (shelfmarkText = shelfmarkObject[i].iterateNext()) {
				shelfmarkElements.push(shelfmarkText.textContent);
			}	
			shelfmark[i]=shelfmarkElements[1]+" "+shelfmarkElements[2];
			shelfmark[i] = shelfmark[i].replace(/\s*\/*(?:xc_d.write.*\;)/, '');
		}
	}
	if (shelfmark[0] != "undefined undefined"){
		callNumber = shelfmark[0];
	}
	for (var i=1; i<3; i++){
		if (shelfmark[i] != "undefined undefined"){
			callNumber = callNumber + "; " + shelfmark[i];
		}
	}
	if (shelfmark[3] != "undefined undefined"){
		callNumber = callNumber + ". See record for additional call numbers.";
	}
		
	item.callNumber = callNumber;
	
	var link = getField (doc, 'Link to');	
	if (link.length == 0) {
		var linkPath='//span[@class="text"]/table/tbody/tr/td/table/tbody/tr/td[2]/font/span[@class="text"]/table/tbody/tr/td/font/span[@class="text"]/table/tbody/tr/td[2]/font/span[@class="text"]/a';
		var linkObject=doc.evaluate(linkPath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
		if (linkObject==null){
		} else {
			var linkTitle=linkObject.textContent;
			var linkLink=linkObject.href;
			if (linkTitle=="Link to electronic text"){
				link=linkLink;
			}
		}
	}
	item.url = link;

	item.complete();
	return '';	
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x" ) return namespace; else return null;
	} : null;

	var articles = new Array ();
	var names = new Array ();
	var items = new Object ();
	var nextTitle;
	doctype=detectWeb(doc, url);

	/* Typically scrapers process both search pages and item pages in the same way; 
	the processDocuments function is used, calling the scraped result link URLs for a search page,
	and for an item page calling the item page's own URL.  
	But Talis displays solo search results with an unstable URL and with no link to an item page. 
	So we cannot call the URL for a solo search result as it will yield a null page. 
	Instead we must process solo search results directly without using processDocuments.
	We want to process item pages in the same way as solo search pages because 
	waiting for the URL on an item page to be called noticeably slows down the scrape.
	*/
	
	var indexPath ='//span[@class="text"]/x:table/x:tbody/x:tr/x:td/x:table/x:tbody/x:tr/x:td[1]'
	var index;
	var indexElements = new Array();
	var indexText;
	var indexObject = doc.evaluate(indexPath, doc, nsResolver, XPathResult.ANY_TYPE, null);		
	while (indexText = indexObject.iterateNext()) {
			indexElements.push(indexText.textContent);
		}
	index=indexElements[0];
	index1=indexElements[1];	
	if (doctype == "multiple" && index.match(/Index/) && index1 == ""){
		var titlePath = '//td[3]/font/span[@class="text"]/table/tbody/tr/td/font/span[@class="text"]/table/tbody/tr/td[1]/font/span[@class="text"]/a';
		var titles = doc.evaluate(titlePath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		while (nextTitle = titles.iterateNext()) {
			items[nextTitle.href] = nextTitle.textContent;
			names.push(nextTitle.textContent);	
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
		Zotero.Utilities.processDocuments(articles, multiscrape, function(){Zotero.done();});
		
	} else if (doctype == "multiple") {
		var titlePath = '//td[4]/font/span[@class="text"]/table/tbody/tr/td/font/span[@class="text"]/table/tbody/tr/td[1]/font/span[@class="text"]/a';
		var titles = doc.evaluate(titlePath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		while (nextTitle = titles.iterateNext()) {
			items[nextTitle.href] = nextTitle.textContent;
			names.push(nextTitle.textContent);	
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			articles.push(i);
		}
		Zotero.Utilities.processDocuments(articles, multiscrape, function(){Zotero.done();});
	} 
	else {
		soloscrape(doc, url);
	}
	Zotero.wait();
		
}