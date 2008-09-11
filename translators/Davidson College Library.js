{
	"translatorID":"8b35ab14-f18a-4f69-8472-b2df18c984da",
	"translatorType":4,
	"label":"Davidson College Library",
	"creator":"Michael Berkowitz",
	"target":"http://www.lib.davidson.edu/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-04-01 04:50:00"
}

function detectWeb(doc, url) {
	if (url.indexOf("log_in") == -1) {
		if (url.indexOf("screen=Record") != -1) {
			return "book";
		} else {
			return "multiple";
		}
	}
}

function doWeb(doc, url) {
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = Zotero.Utilities.getItemArray(doc, doc, 'screen=Record.html');
		items = Zotero.selectItems(items);
		for (var i in items) {
			books.push(i.replace("Record.html", "MARCRecord.html"));
		}
	} else {
		books = [url.replace("Record.html", "MARCRecord.html")];
	}
	
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	Zotero.Utilities.processDocuments(books, function(newDoc) {
		var uri = newDoc.location.href;
		var namespace = newDoc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
		  if (prefix == 'x') return namespace; else return null;
		} : null;
		var nonstandard = false;
		var xpath;
		var xpath = '//td[@class="body"]/p/table/tbody/tr[td[3]]';
		var elmts = newDoc.evaluate(xpath, newDoc, nsResolver, XPathResult.ANY_TYPE, null);
		var elmt;
		var record = new marc.record();
		while(elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.trimInternal(newDoc.evaluate('./td[1]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			if(field) {
				var value = newDoc.evaluate('./td[3]', elmt, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
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
		}
		
		var newItem = new Zotero.Item();
		record.translate(newItem);
		
		var domain = url.match(/https?:\/\/([^/]+)/);
		newItem.repository = "Davidson College Library Catalog";
		newItem.complete();
	}, function() {Zotero.done;});
	Zotero.wait();
}