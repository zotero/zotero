{
	"translatorID":"3e9dbe21-10f2-40be-a921-f6ec82760927",
	"translatorType":4,
	"label":"ProMED",
	"creator":"Brandon Minich",
	"target":"http://www.promedmail.org",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-03-19 17:15:00"
}

function detectWeb(doc, url)  {
	if (url.toLowerCase().indexOf("f2400_p") != -1)  {
		return "email";
	}
} 
function doWeb(doc, url) {
         Zotero.debug(doc.title);
        
        var namespace = doc.documentElement.namespaceURI;
     	var nsResolver = namespace ? function(prefix) {
      	      if (prefix == 'x') return namespace; else return null;
      	      } : null;
      	      
        var newItem = new Zotero.Item('email');
        
        if (doc.evaluate('//span[@id="F2400_P1001_SUBJECT"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.title= doc.evaluate('//span[@id="F2400_P1001_SUBJECT"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	} else if (doc.evaluate('//span[@id="F2400_P1202_SUBJECT"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.title = doc.evaluate('//span[@id="F2400_P1202_SUBJECT"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	
	
	if (doc.evaluate('//span[@id="F2400_P1001_PUBLISHED_DATE"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.date = doc.evaluate('//span[@id="F2400_P1001_PUBLISHED_DATE"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	} else if (doc.evaluate('//span[@id="F2400_P1202_PUBLISHED_DATE"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.date = doc.evaluate('//span[@id="F2400_P1202_PUBLISHED_DATE"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	
	if (doc.evaluate('//span[@id="F2400_P1001_ARCHIVE_NUMBER"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.extra = "Archive Number: " + doc.evaluate('//span[@id="F2400_P1001_ARCHIVE_NUMBER"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	} else if (doc.evaluate('//span[@id="F2400_P1202_ARCHIVE_NUMBER"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		newItem.extra = "Archive Number: " + doc.evaluate('//span[@id="F2400_P1202_ARCHIVE_NUMBER"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
	}
	
	newItem.url = doc.location.href;

	newItem.complete();
}
