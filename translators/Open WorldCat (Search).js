{
	"translatorID":"e07e9b8c-0e98-4915-bb5a-32a08cb2f365",
	"translatorType":12,
	"label":"Open WorldCat (Search)",
	"creator":"Simon Kornblith",
	"target":"http://partneraccess.oclc.org/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-03-22 18:15:00"
}

function detectSearch(item) {
	if(item.itemType == "book" || item.itemType == "bookSection") {
		return true;
	}
	return false;
}

// creates an item from an Open WorldCat document
function processOWC(doc) {
	var spanTags = doc.getElementsByTagName("span");
	for(var i=0; i<spanTags.length; i++) {
		var spanClass = spanTags[i].getAttribute("class");
		if(spanClass) {
			var spanClasses = spanClass.split(" ");
			if(Zotero.Utilities.inArray("Z3988", spanClasses)) {
				var spanTitle = spanTags[i].getAttribute("title");
				var item = new Zotero.Item();
				if(Zotero.Utilities.parseContextObject(spanTitle, item)) {
					if(item.title) {
						item.title = Zotero.Utilities.capitalizeTitle(item.title);
					} else {
						item.title = "[Untitled]";
					}
					
					item.complete();
					return true;
				} else {
					return false;
				}
			}
		}
	}
	
	return false;
}

function doSearch(item) {
	if(item.contextObject) {
		var co = item.contextObject;
	} else {
		var co = Zotero.Utilities.createContextObject(item);
	}
	
	Zotero.Utilities.loadDocument("http://partneraccess.oclc.org/wcpa/servlet/OpenUrl?"+co, function(doc) {
		// find new COinS in the Open WorldCat page
		if(processOWC(doc)) {	// we got a single item page
			Zotero.done();
		} else {				// assume we have a search results page
			var items = new Array();
			
			var namespace = doc.documentElement.namespaceURI;
			var nsResolver = namespace ? function(prefix) {
				if (prefix == 'x') return namespace; else return null;
			} : null;
			
			// first try to get only books
			var elmts = doc.evaluate('//table[@class="tableLayout"]/tbody/tr/td[@class="content"]/table[@class="tableResults"]/tbody/tr[td/img[@alt="Book"]]/td/div[@class="title"]/a', doc, nsResolver, Components.interfaces.nsIDOMXPathResult.ANY_TYPE,null);
			var elmt = elmts.iterateNext();
			if(!elmt) {	// if that fails, look for other options
				var elmts = doc.evaluate('//table[@class="tableLayout"]/tbody/tr/td[@class="content"]/table[@class="tableResults"]/tbody/tr[td/img[@alt="Book"]]/td/div[@class="title"]/a', doc, nsResolver, Components.interfaces.nsIDOMXPathResult.ANY_TYPE,null);
				elmt = elmts.iterateNext()
			}
			
			var urlsToProcess = new Array();
			do {
				urlsToProcess.push(elmt.href);
			} while(elmt = elmts.iterateNext());
			
			Zotero.Utilities.processDocuments(urlsToProcess, function(doc) {
				// per URL
				processOWC(doc);
			}, function() {	// done
				Zotero.done();
			});
		}
	}, null);
	
	Zotero.wait();
}