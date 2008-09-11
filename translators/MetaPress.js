{
	"translatorID":"62c0e36a-ee2f-4aa0-b111-5e2cbd7bb5ba",
	"translatorType":4,
	"label":"MetaPress",
	"creator":"Michael Berkowitz",
	"target":"https?://(.*).metapress.com/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-03-13 22:30:00"
}

function detectWeb(doc, url) {
	if (doc.title.indexOf("Search Results") != -1) {
		return "multiple";
	} else if (url.match(/content\/[^?/]/)) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var host = doc.location.host;
	var artids = new Array();
	if (detectWeb(doc, url) == "multiple") {
		
	} else {
		artids.push(url.match(/content\/([^/]+)/)[1]);
	}
	for (var i in artids) {
		var newurl = 'http://' + host + '/content/' + artids[i];
		Zotero.Utilities.processDocuments([newurl], function(newDoc) {
			var tagsx = '//td[@class="mainPageContent"]/div[3]';
			if (doc.evaluate(tagsx, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
				var tags = Zotero.Utilities.trimInternal(doc.evaluate(tagsx, doc, null, XPathResult.ANY_TYPE, null).iterateNext().textContent).split(",");
			}
			Zotero.Utilities.HTTP.doPost('http://' + host + '/export.mpx', 'code=' + artids[i] + '&mode=ris', function(text) {
				// load translator for RIS
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					var pdfurl = 'http://' + host + '/content/' + artids[i] + '/fulltext.pdf';
					item.attachments = [
						{url:item.url, title:"MetaPress Snapshot", mimeType:"text/html"},
						{url:pdfurl, title:"MetaPress Full Text PDF", mimeType:"application/pdf"}
					];
					if (tags) item.tags = tags;
					if (item.abstractNote.substr(0, 8) == "Abstract") item.abstractNote = Zotero.Utilities.trimInternal(item.abstractNote.substr(8));
					item.complete();
				});
				translator.translate();
				Zotero.done();
			});
		}, function() {});
	}
}