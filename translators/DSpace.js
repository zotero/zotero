{
	"translatorID":"0abd577b-ec45-4e9f-9081-448737e2fd34",
	"translatorType":4,
	"label":"DSpace",
	"creator":"Michael Berkowitz",
	"target":"(dspace|upcommons.upc.edu)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-06-06 08:45:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//table[@class="itemDisplayTable"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "document";
	} else if (doc.evaluate('//table[@class="miscTable"]//td[2]', doc, null, XPathResult.ANY_TYPE, null).iterateNext() || doc.evaluate('//div[@id="main"]/ul[@class="browselist"]/li/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	}
}

var itemTypes = {
	"Article":"journalArticle",
	"Book":"book",
	"Thesis":"thesis",
	"Working Paper":"report",
	"Technical Report":"report"
}

function doWeb(doc, url) {
	var records = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.evaluate('//div[@id="main"]/ul[@class="browselist"]/li/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
			var xpath = '//div[@id="main"]/ul[@class="browselist"]/li/a';
		} else {
			var xpath = '//table[@class="miscTable"]//td[2]//a';
		}
		var rows = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		var row;
		while (row = rows.iterateNext()) {
			items[row.href] = row.textContent;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			records.push(i + '?mode=full');
		}
	} else {
		records = [url.match(/^([^?]+)\??/)[1] + "?mode=full"];
	}
	Zotero.Utilities.processDocuments(records, function(newDoc) {
		var values = new Object();
		var fields = newDoc.evaluate('//table[@class="itemDisplayTable"]/tbody/tr/td[1]', newDoc, null, XPathResult.ANY_TYPE, null);
		var data = newDoc.evaluate('//table[@class="itemDisplayTable"]/tbody/tr/td[2]', newDoc, null, XPathResult.ANY_TYPE, null);
		var field2;
		var datum2;
		var newItem = new Zotero.Item();
		while ((field2 = fields.iterateNext()) && (datum2 = data.iterateNext())) {
			var field = field2.textContent.replace(/^dc\./, "");
			var datum = datum2.textContent;
			if (field == "contributor.author") {
				var name = datum.split(",");
				newItem.creators.push({firstName:name[1], lastName:name[0], creatorType:"author"});
			} else if (field == "dentifier.uri") {
				newItem.url = datum;
			} else if (field == "title") {
				newItem.title = datum;
			} else if (field == "type") {
				if (itemTypes[datum]) {
					newItem.itemType = itemTypes[datum];
				} else {
					newItem.itemType = "document";
				}
			} else if (field == "description.abstract") {
				newItem.abstractNote = datum;
			} else if (field == "date.available") {
				newItem.date = datum.replace(/T.*$/, "");
			} else if (field == "subject") {
				newItem.tags.push(datum);
			} else if (field == "publisher") {
				newItem.publisher = datum;
			} else if (field == "identifier.issn") {
				newItem.ISSN = datum;
			} else if (field == "relation.ispartofseries") {
				if (datum.match(/Vol/)) {
					newItem.volume = datum.match(/\d+/)[0];
				} else if (datum.match(/No/)) {
					newItem.issue = datum.match(/\d+/)[0];
				}
			} else if (field == "rights") {
				newItem.rights = datum;
			}
		}
		if (newDoc.evaluate('//td[@class="standard"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) var pdf = newDoc.evaluate('//td[@class="standard"]/a', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		newItem.attachments = [{url:newDoc.location.href, title:"DSpace Snapshot", mimeType:"text/html"}];
		if (pdf) {
			newItem.attachments.push({url:pdf, title:"DSpace PDF", mimeType:"application/pdf"});
		}
		newItem.complete();
	}, function() {Zotero.done;});
}