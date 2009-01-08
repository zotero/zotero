{
	"translatorID":"cae7d3ec-bc8d-465b-974f-8b0dcfe24290",
	"translatorType":4,
	"label":"BIUM",
	"creator":"Michael Berkowitz",
	"target":"http://hip.bium.univ-paris5.fr/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-01-08 08:19:07"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//td/a[@class="itemTitle"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//td[1]/span[@class="uportal-channel-strong"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	}
}

function makeMARCurl(link, rsId, rrsId, query) {
	return 'http://hip.bium.univ-paris5.fr/uPortal/Print?link=' + link + '&xslFileName=com/dynix/hip/uportal/channels/standard/FullMarc.xsl&F=/searching/getmarcdata&responseSessionId=' + rsId + '&responseResultSetId=' + rrsId + '&searchGroup=BIUM-13&query=' + query + '&searchTargets=16&locale=fr_FR';
}

function doWeb(doc, url) {
	var n = doc.documentElement.namespaceURI;
	var ns = n ? function(prefix) {
		if (prefix == 'x') return n; else return null;
	} : null;
	
	var books = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var links = doc.evaluate('//a[@class="itemTitle"]', doc, ns, XPathResult.ANY_TYPE, null);
		var link;
		while (link = links.iterateNext()) {
			items[link.href] = Zotero.Utilities.trimInternal(link.textContent);
		}
		items = Zotero.selectItems(items);
		var rsId = doc.evaluate('//input[@name="responseSessionId"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().value;
		var rrsId = doc.evaluate('//input[@name="responseResultSetId"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().value;
		var query = doc.evaluate('//input[@name="query"]', doc, ns, XPathResult.ANY_TYPE, null).iterateNext().value;
		var linkRE = new RegExp("'([^']+)'", "g");
		for (var i in items) {
			var link = linkRE.exec(i)[1];
			Zotero.debug(link);
			books.push(makeMARCurl(link, rsId, rrsId, query));
		}
	} else {
		var link = url.match(/link=([^&]+)/)[1];
		var rsId = url.match(/responseSessionId=([^&]+)/)[1];
		var rrsId = url.match(/responseResultSetId=([^&]+)/)[1];
		var query = url.match(/query=([^&]+)/)[1];
		books = [makeMARCurl(link, rsId, rrsId, query)];
	}
	var translator = Zotero.loadTranslator("import");
	translator.setTranslator("a6ee60df-1ddc-4aae-bb25-45e0537be973");
	var marc = translator.getTranslatorObject();
	Zotero.Utilities.processDocuments(books, function(doc) {
		var rows = doc.evaluate('//center/table/tbody/tr', doc, ns, XPathResult.ANY_TYPE, null);
		var row;
		var record = new marc.record();
		while (row = rows.iterateNext()) {
			var field = Zotero.Utilities.trimInternal(doc.evaluate('./td[1]', row, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent.replace(":", ""));
			if (field) {
				var value = doc.evaluate('./td[2]', row, ns, XPathResult.ANY_TYPE, null).iterateNext().textContent;
				if (value.split(/\n/)[1]) value = Zotero.Utilities.trimInternal(value.split(/\n/)[1]);
				if (field == "LDR") {
					record.leader = value;
				} else if (field != "FMT") {
					value = value.replace(/\¤([a-z])/g, marc.subfieldDelimiter+ "$1");
					var code = field.substring(0, 3);
					var ind = "";
					if (field.length > 3) {
						ind = field[3];
						if (field.length > 4) {
							ind += field[4];
						}
					}
					record.addField(code, ind, value);
				}
			}
		}
		var item = new Zotero.Item();
		record.translate(item);
		
		var oldauthors = item.creators;
		var newauthors = new Array();
		for each (var aut in oldauthors) {
			if (aut.lastName.match(/^[A-Z][^\s]+\s[^\s]+/)) newauthors.push(Zotero.Utilities.cleanAuthor(aut.lastName.match(/^[A-Z][^\s]+\s[^\s]+/)[0].replace(/^([^\s]+)\s+(.*)$/, "$2 $1"), "author"));
		}
		item.creators = newauthors;
		item.complete();
	}, function() {Zotero.done();});
	Zotero.wait();
}