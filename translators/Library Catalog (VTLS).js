{
	"translatorID":"63a0a351-3131-18f4-21aa-f46b9ac51d87",
	"translatorType":4,
	"label":"Library Catalog (VTLS)",
	"creator":"Simon Kornblith",
	"target":"/chameleon(?:\\?|$)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-11 20:40:00"
}

function detectWeb(doc, url) {
	var node = doc.evaluate('//tr[@class="intrRow"]/td/table/tbody/tr[th]', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	if(node) {
		return "multiple";
	}
	var node = doc.evaluate('//a[text()="marc"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext();
	if(node) {
		return "book";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var uri = doc.location.href;
	var newUris = new Array();
	
	var marcs = doc.evaluate('//a[text()="marc"]', doc, nsResolver,
	                         XPathResult.ANY_TYPE, null);
	var record = marcs.iterateNext();
	
	if(record && !marcs.iterateNext()) {
		newUris.push(record.href);
	} else {
		// Require link to match this
		var tagRegexp = new RegExp();
		tagRegexp.compile("/chameleon\?.*function=CARDSCR");
		
		var items = new Array();
		
		var tableRows = doc.evaluate('//tr[@class="intrRow"]', doc, nsResolver,
		                             XPathResult.ANY_TYPE, null);
		var tableRow;
		// Go through table rows
		while(tableRow = tableRows.iterateNext()) {
			var links = tableRow.getElementsByTagName("a");
			// Go through links
			var url;
			for(var j=0; j<links.length; j++) {
				if(tagRegexp.test(links[j].href)) {
					url = links[j].href;
					break;
				}
			}
			if(url) {
				// Collect title information
				var fields = doc.evaluate('./td/table/tbody/tr[th]', tableRow,
				                          nsResolver, XPathResult.ANY_TYPE, null);
				var field;
				while(field = fields.iterateNext()) {
					var header = doc.evaluate('./th/text()', field, nsResolver,
					                          XPathResult.ANY_TYPE, null).iterateNext();
					if(header.nodeValue == "Title") {
						var value = doc.evaluate('./td', field, nsResolver,
					    	XPathResult.ANY_TYPE, null).iterateNext();
						if(value) {
							items[url] = Zotero.Utilities.cleanString(value.textContent);
						}
					}
				}
			}
		}
		
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		for(var i in items) {
			Zotero.debug(i.replace(/function=[A-Z]{7}/, "function=MARCSCR"));
			newUris.push(i.replace(/function=[A-Z]{7}/, "function=MARCSCR"));
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	
	Zotero.Utilities.processDocuments(newUris, function(newDoc) {
		var uri = newDoc.location.href
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;
		
		var record = new marc.record();
		
//		var xpath = '//table[@class="outertable"]/tbody/tr[td[4]]'; //old xpath
//		xpaths from virginia college of osteopathic medicine
//		/html/body/table[@class="header2"]/tbody/tr/td[2]/table/tbody/tr/td/table/tbody/tr/td/table[@class="marctable"]/tbody/tr/td[1][@class="marcTag"]
//		/html/body/table[@class="header2"]/tbody/tr/td[2]/table/tbody/tr/td/table/tbody/tr/td/table[@class="marctable"]/tbody/tr/td[2]
//		/html/body/table[@class="header2"]/tbody/tr/td[2]/table/tbody/tr/td/table/tbody/tr/td/table[@class="marctable"]/tbody/tr/td[3]
//		/html/body/table[@class="header2"]/tbody/tr/td[2]/table/tbody/tr/td/table/tbody/tr/td/table[@class="marctable"]/tbody/tr/td[4][@class="marcSubfields"]
		var xpath = '//table[@class="marctable"]/tbody/tr[td[4]]';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver,
		                            XPathResult.ANY_TYPE, null);
		
		while(elmt = elmts.iterateNext()) {
			var field = newDoc.evaluate('./TD[1]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			var ind1 = newDoc.evaluate('./TD[2]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			var ind2 = newDoc.evaluate('./TD[3]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			var value = newDoc.evaluate('./TD[4]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue;
			value = value.replace(/\\([a-z]) /g, marc.subfieldDelimiter+"$1");
			
			record.addField(field, ind1+ind2, value);
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = domain[1]+" Library Catalog";
		
		newItem.complete();
	}, function(){ Zotero.done(); }, null);
	
	Zotero.wait();
}