{
	"translatorID":"53f8d182-4edc-4eab-b5a1-141698a10101",
	"translatorType":4,
	"label":"The Times UK",
	"creator":"William Smith",
	"target":"timesonline\\.co\\.uk/tol/.+ece$",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2010-06-05 20:35:00"
}


// TimesOnline.co.uk translator.
// Version 1.00
// By William Smith, see http://www.willsmith.org/contactme/


function detectWeb(doc, url) {
	return "newspaperArticle";
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


function doWeb(doc, url){

	var item = new Zotero.Item("newspaperArticle");

	// These fields are easy...

	item.publicationTitle = 'The Times (UK)';
	item.abstractNote = getMeta(doc, "Description");
	item.title = doc.title.replace(/.?-.?Times Online/, "");
	item.url = url;

	// Author is a pain to get.

	var authors = getXPath(doc, '//span[@class="byline"]');

	while (author = authors.iterateNext()) {
		auc = author.textContent;
		if (auc.length > 0) {
			Zotero.debug('authors: ' , auc);
			auc = auc.split(/:|,|and/);						
				for each (var aut in auc) {	
				aut = aut.trim();
				if (aut.length > 0 && (!aut.match(/(Editor|Times|Correspondent)/))) {
					Zotero.debug('author: <' + aut + '>');
	
					item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
				}
			}
		}
	} 

	// Date is also a pain to get.

	var pagetext = doc.documentElement.innerHTML;

	if (pagetext) {
	  try {
	    date = pagetext.match(/Article Published Date : (.{10,15}) \d\d:\d\d/);
  		if (date[1]){
  			Zotero.debug('date: ' + date[1]);
  			item.date = date[1];
  		}
	  } catch(e){
	    // do nothing
	  }
		
		
	}


	item.attachments.push({url:url, title:"The Times (UK) Snapshot", mimeType:"text/html"});
	
	item.complete();
}