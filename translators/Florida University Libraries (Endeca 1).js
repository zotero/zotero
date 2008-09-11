{
	"translatorID":"a2363670-7040-4cb9-8c48-6b96584e92ee",
	"translatorType":4,
	"label":"Florida University Libraries (Endeca 1)",
	"creator":"Sean Takats",
	"target":"^http://[^/]+/[^\\.]+.jsp\\?[^/]*(?:Ntt=|NttWRD=)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-09-03 23:35:00"
}

function detectWeb(doc, url){
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;
		
	var xpath = '//div[starts-with(@id, "briefTitle")]';
	if(doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
	if (url.indexOf("&V=D")){
		return "book";
	} else if (url.indexOf("&V=M")){
		return "book";
	} else if (url.indexOf("&V=U")){
		return "book";
	}
}

function doWeb(doc, url){
	var newUris = new Array();
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
		} : null;	
	var xpath = '//div[starts-with(@id, "briefTitle")]/a[starts-with(@id, "Title")]';
	var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
	var elmt;
	if(elmt = elmts.iterateNext()) {
		// search page
		var items = new Array();
		do {
			items[elmt.href] = Zotero.Utilities.cleanString(elmt.textContent);
		} while (elmt = elmts.iterateNext());
		
		items = Zotero.selectItems(items);
		if(!items) {
			return true;
		}
		for(var i in items) {
			var newUri = i.replace(/&V=./, "&V=M");
			newUris.push(newUri);
		}
	} else {
		// single page
		var newURL = url.replace(/&V=./, "&V=M");
		newUris.push(newURL);
	}
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var uri = newDoc.location.href;
		var xpath = '//tr[@class="trGenContent"][td[3]]';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		
		var record = new marc.record();
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.superCleanString(newDoc.evaluate('./TD[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			var value = newDoc.evaluate('./TD[3]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
			if(field == "LDR") {
				record.leader = value;
			} else if(field != "FMT") {
				
				value = value.replace(/\|([a-z]) /g, marc.subfieldDelimiter+"$1");
				
				var code = field.substring(0, 3);
				var ind = "";
				if(field.length > 3) {
					ind = field[3];
					if(field.length > 4) {
						ind += field[4];
					}
				}
				
				record.addField(code, ind, value);
			}
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}, function() { Zotero.done(); }, null);
	Zotero.wait();	
}