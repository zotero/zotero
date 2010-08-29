{
        "translatorID":"53f8d182-4edc-4eab-b5a1-141698a10101",
        "label":"The Times and Sunday Times",
        "creator":"Will Smith",
        "creator":"Andrew Brown",
        "target":"^http://www\\.thetimes\\.co\\.uk/.+ece$",
        "minVersion":"1.0",
        "maxVersion":"",
        "priority":100,
        "inRepository":true,
        "translatorType":4,
        "lastUpdated":"2010-08-11 17:23:03"
}

/**/

// TimesOnline.co.uk translator.
// Version 1.5
// Original by William Smith, see http://www.willsmith.org/contactme/
// extensively tweaked by Andrew Brown to cope with the paywalled structure


function detectWeb(doc, url) {
	return "newspaperArticle" ;
}


function getMeta (doc, field) {
	field='//meta[@name="' + field + '"]/@content';
	content = getXPath(doc, field).iterateNext();

	if (content) {
		return content.value;
	}

}

function getXPath (doc, field) {
	xpath=field;
	return doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
}
/*
function getXPathInstance (doc,field) {
	xpath=field;
	return doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext();
}
*/
function doWeb(doc, url){

	var item = new Zotero.Item("newspaperArticle");
	
	//Could be daily or Sunday Times	
	//The ISSN seems to be the same for both:
	item.issn="0140-0460";

	if (url.search(/\/tto\//)!=-1){
		item.publicationTitle = 'The Times (London)';
		item.title = doc.title.replace("| The Times", "");
	}
	
	if(url.search(/\/sto\//)!=-1){
		item.publicationTitle = 'The Sunday Times (London)';
		item.title = doc.title.replace("| The Sunday Times", "");
	}
	
	//Now we have the paper, what section is it in?
	var section=url.match(/\/[ts]to\/([^\/]+)/);
	// Zotero.debug(section[1]);
	// Then print it pretty
	item.section=section[1].substr(0,1).toUpperCase() + section[1].substr(1);
	
	// These next fields are easy...
	item.url = url;
	item.date=getMeta(doc,"dashboard_published_date");
	item.place="London";
	item.abstractNote = getMeta(doc, "description"); 
	// alternative, better, way follows
	var standfirstXpath=doc.evaluate('//div[@class="cf "]//p[@class="f-standfirst"]',doc,null,XPathResult.ANY_TYPE,null); 
	// note space after cf  in class name, haha, Murdoch really got value from those Times designers
	if(standfirstXpath.iterateNext()!=null){
		item.abstractNote=standfirstXpath.iterateNext().textContent;
	}


	// extract authors who may be in an array
	var authorXpath=doc.evaluate('//div[@class="cf "]//strong[@class="f-author"]',doc, null, XPathResult.ANY_TYPE, null);
	var hack;
	while (hack=authorXpath.iterateNext()){
		var hacks= new Array();
		hacks=hack.textContent.split(/and|,/);
//		Zotero.debug("hacks: " +hack.textContent.split(/and/));
		if (hacks.length > 1){
			for (var h in hacks){
				item.creators.push(Zotero.Utilities.cleanAuthor(hacks[h],"author"));	
			}
		}
		else {
			item.creators.push(Zotero.Utilities.cleanAuthor(hack.textContent,"author"));	
		}
	}
		
	//ATTACH A SNAPSHOT
	item.attachments.push({url:url, title:item.title, mimeType:"text/html"});
	item.complete();
}
