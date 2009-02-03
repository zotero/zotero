{
	"translatorID":"3e684d82-73a3-9a34-095f-19b112d88bbf",
	"translatorType":4,
	"label":"Google Books",
	"creator":"Simon Kornblith and Michael Berkowitz",
	"target":"^http://(books|www)\\.google\\.[a-z]+(\\.[a-z]+)?/books\\?(.*id=.*|.*q=.*)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-02-03 05:45:00"
}

function detectWeb(doc, url) {
	var re = new RegExp('^http://(books|www)\\.google\\.[a-z]+(\.[a-z]+)?/books\\?id=([^&]+)', 'i');
	if(re.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}

function doWeb(doc, url) {
	// get local domain suffix
	var psRe = new RegExp("https?://(books|www)\.google\.([^/]+)/");
	var psMatch = psRe.exec(url);
	var suffix = psMatch[2];
	var prefix = psMatch[1];
	var uri = doc.location.href;
	var newUris = new Array();
	
	var re = new RegExp('^http://(?:books|www)\\.google\\.[a-z]+(\.[a-z]+)?/books\\?id=([^&]+)', 'i');
	var m = re.exec(uri);
	if(m) {
		newUris.push('http://'+prefix+'.google.'+suffix+'/books?id='+m[2]);
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, 'http://'+prefix+'\\.google\\.' + suffix + '/books\\?id=([^&]+)', '^(?:All matching pages|About this Book|Table of Contents|Index)');
		// Drop " - Page" thing
		for(var i in items) {
			items[i] = items[i].replace(/- Page [0-9]+\s*$/, "");
		}
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			var m = re.exec(i);
			newUris.push('http://'+prefix+'.google.'+suffix+'/books?id='+m[2]);
		}
	}
	Zotero.debug(newUris);
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var newItem = new Zotero.Item("book");
		newItem.extra = "";
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;

		var xpath = '//h2[@class="title"]'
		var elmt;	
		if (elmt = newDoc.evaluate(xpath, newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null).iterateNext()){
			var title = Zotero.Utilities.superCleanString(elmt.textContent);
			newItem.title = title;
			Zotero.debug("title: " + title);
		}
		xpath = '//div[@class="titlewrap"]/span[@class="addmd"]'
		if (elmt = newDoc.evaluate(xpath, newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null).iterateNext()){
			var authors = Zotero.Utilities.superCleanString(elmt.textContent);
			if (authors.substring(0, 3) == "By "){
				authors = authors.substring(3);
			}
			authors = authors.split(", ");
			for(j in authors) {
				newItem.creators.push(Zotero.Utilities.cleanAuthor(authors[j], "author"));
			}
		}
		
		xpath = '//td[2][@id="bookinfo"]/div[@class="bookinfo_sectionwrap"]/div';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null);
		while(elmt = elmts.iterateNext()) {
			var fieldelmt = newDoc.evaluate('.//text()', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			if(fieldelmt) {
				field = Zotero.Utilities.superCleanString(fieldelmt.nodeValue);
				Zotero.debug("output: " + field);
				if(field.substring(0,10) == "Published ") {
					newItem.date = field.substring(field.length-4);
					var publisher = newDoc.evaluate('..//a', fieldelmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
					if (publisher){
						publisher =  Zotero.Utilities.superCleanString(publisher.textContent);
						newItem.publisher = publisher;
					}
				} else if(field.substring(0,5) == "ISBN ") {
					newItem.ISBN = field.substring(5);
				} else if(field.substring(field.length-6) == " pages") {
					newItem.pages = field.substring(0, field.length-6);
				} else if(field.substring(0,12) == "Contributor ") {
					newItem.creators.push(Zotero.Utilities.cleanAuthor(field.substring(12), "contributor"));
				}
			}
		}		
		newItem.complete();
	}, function() { Zotero.done(); }, null);
	
	Zotero.wait();
}