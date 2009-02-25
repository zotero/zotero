{
	"translatorID":"774d7dc2-3474-2684-392c-f787789ec63d",
	"translatorType":4,
	"label":"Library Catalog (Dynix)",
	"creator":"Simon Kornblith",
	"target":"ipac\\.jsp\\?.*(?:uri=(?:link|full)=[0-9]|menu=search)",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-02-25 07:10:00"
}

function detectWeb(doc, url) {
	var detailsRe = new RegExp('ipac\.jsp\?.*uri=(?:full|link)=[0-9]');
	if(detailsRe.test(doc.location.href)) {
		return "book";
	} else {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;

	var uri = doc.location.href;
	var detailsRe = new RegExp('ipac\.jsp\?.*uri=(?:full|link)=[0-9]');
	
	var uris = new Array();
	if(detailsRe.test(uri)) {
		uris.push(uri+'&fullmarc=true');
	} else {
		var items = Zotero.Utilities.getItemArray(doc, doc, "ipac\.jsp\?.*uri=(?:full|link)=[0-9]|^javascript:buildNewList\\('.*uri%3Dfull%3D[0-9]", "Show details");
		items = Zotero.selectItems(items);
		
		if(!items) {
			return true;
		}
		
		var buildNewList = new RegExp("^javascript:buildNewList\\('([^']+)");
		
		var uris = new Array();
		for(var i in items) {
			var m = buildNewList.exec(i);
			if(m) {
				uris.push(unescape(m[1]+'&fullmarc=true'));
			} else {
				uris.push(i+'&fullmarc=true');
			}
		}
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	
	Zotero.Utilities.processDocuments(uris, function(newDoc) {
		var uri = newDoc.location.href;
		
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;
		
		var xpath = '//form/table[@class="tableBackground"]/tbody/tr/td/table[@class="tableBackground"]/tbody/tr[td[1]/a[@class="normalBlackFont1"]]';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		if (!elmts.iterateNext()) {
			var xpath2 = '//form/table[@class="tableBackground"]/tbody/tr/td/table[@class="tableBackground"]/tbody/tr[td[1]/a[@class="boldBlackFont1"]]';
			var elmts = newDoc.evaluate(xpath2, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		}
		var elmt;
		
		var record = new marc.record();		
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.superCleanString(newDoc.evaluate('./TD[1]/A[1]/text()[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().nodeValue);
			var value = newDoc.evaluate('./TD[2]/TABLE[1]/TBODY[1]/TR[1]/TD[1]/A[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
			
			// value = null for non-marc table entries w/ that xpath
			if (!value) {
				value = '';
			} else {
				value = value.textContent;
			}
			
			if(field == "LDR") {
				record.leader = value;
			} else if(field != "FMT") {
				value = value.replace(/\$([a-z]) /g, marc.subfieldDelimiter+"$1");
				
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
	}, function() { Zotero.done() }, null);
	
	Zotero.wait();
}