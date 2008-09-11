{
	"translatorID":"5e3e6245-83da-4f55-a39b-b712df54a935",
	"translatorType":4,
	"label":"Melvyl",
	"creator":"Sean Takats and Michael Berkowitz",
	"target":"^https?://(?:melvyl.cdlib.org|melvyl-dev.cdlib.org:8162)/F(?:/[A-Z0-9\\-]+(?:\\?.*)?$|\\?func=find|\\?func=scan)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":90,
	"inRepository":true,
	"lastUpdated":"2008-05-19 17:20:00"
}

function detectWeb(doc, url) {
	var singleRe = new RegExp("^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=[0-9]{3}|func=direct)");
	
	if(singleRe.test(doc.location.href)) {
		return "book";
	} else {
		var tags = doc.getElementsByTagName("a");
		for(var i=0; i<tags.length; i++) {
			if(singleRe.test(tags[i].href)) {
				return "multiple";
			}
		}
	}
}

function doWeb(doc, url) {
	var detailRe = new RegExp("^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=[0-9]{3}|func=direct)");
	var uri = doc.location.href;
	var newUris = new Array();
	
	if(detailRe.test(uri)) {
	newUris.push(uri.replace(/\&format=[0-9]{3}/, "&format=001"))
	} else {
		var itemRegexp = '^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=999|func=direct)';
		
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
			
		var reviewXpath = '//table/tbody/tr[td[@class="resultsDisplayWhite"]]'
		
		var reviewRows = doc.evaluate(reviewXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
		var reviewRow;
		
		var items = new Array();
		
		if (reviewRow = reviewRows.iterateNext()){
			var xpath = './td[@class="resultsDisplayWhite"][2]/a[1]';
			var titleXpath = './td[@class="resultsDisplayWhite"][5]';
			var elmt;
			var titleElmt;
			do {
				elmt = doc.evaluate(xpath, reviewRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				titleElmt = doc.evaluate(titleXpath, reviewRow, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
				items[elmt.href] = Zotero.Utilities.cleanString(titleElmt.textContent);
			} while (reviewRow = reviewRows.iterateNext());

		} else {
			var xpath = '//td[2][@class="resultsBrief"]/a[1]';  // gets MELVYL links
			var elmts = doc.evaluate(xpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var elmt;
			var titleXpath = '//tr[td[@class="resultsBrief"][@id="bold"]/b[text()="Title"]]/td[4]'; // gets MELVYL results titles
			var titleElmts = doc.evaluate(titleXpath, doc, nsResolver, XPathResult.ANY_TYPE, null);
			var titleElmt;
			while ((elmt = elmts.iterateNext()) && (titleElmt = titleElmts.iterateNext())){
				items[elmt.href] = Zotero.Utilities.cleanString(titleElmt.textContent);
			}
		}
			
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			var newUri = i.replace(/\&format=[0-9]{3}/, "&format=001")
			if(newUri == i) {
				newUri += "&format=001";
			}
			newUris.push(newUri);
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var uri = newDoc.location.href;

		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;
		
		var xpath = '//tr[td[1][@class="contentSmall"][@id="bold"]/strong]';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		
		var record = new marc.record();
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.trimInternal(newDoc.evaluate('./TD[1]/strong/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
			var value = newDoc.evaluate('./TD[2]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			
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