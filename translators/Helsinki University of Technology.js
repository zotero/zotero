{
	"translatorID":"2943d7fc-3ce8-401c-afd5-ee1f70b7aae0",
	"translatorType":4,
	"label":"Helsinki University of Technology",
	"creator":"Michael Berkowitz",
	"target":"https?://teemu.linneanet.fi/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (url.match(/v\d+=\d+/)) {
		return "book";
	} else if (url.match(/Search_Arg/)) {
		return "multiple";
	}
}

function MARCify(str) {
	return str.replace(/v\d+=([^&]+)/, "v3=$1");
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var titles = doc.evaluate('/html/body/form/table/tbody/tr/td[3]/a', doc, ns, XPathResult.ANY_TYPE, null);
		var title;
		var items = new Object();
		while (title = titles.iterateNext()) {
			items[title.href] = Zotero.Utilities.trimInternal(title.textContent);
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			books.push(MARCify(i));
		}
	} else {
		books = [MARCify(url)];
	}
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	Zotero.Utilities.processDocuments(books, function(doc) {
		var elmts = doc.evaluate('/html/body/form/table/tbody/tr[th]', doc, ns, XPathResult.ANY_TYPE, null);
		var record = new marc.record();
		var elmt;
		while (elmt = elmts.iterateNext()) {
			var field = Zotero.Utilities.superCleanString(doc.evaluate('./th', elmt, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent);
			if (field) {
				var value = doc.evaluate('./td[1]', elmt, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				if (value.split(/\n/)[1]) value = Zotero.Utilities.trimInternal(value.split(/\n/)[1]);
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
		}
		var item = new Zotero.Item("book");
		record.translate(item);
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}