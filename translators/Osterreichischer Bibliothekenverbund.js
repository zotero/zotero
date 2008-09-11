{
	"translatorID":"e1140aa1-3bcf-4226-9099-78ef0b63bb3e",
	"translatorType":4,
	"label":"Osterreichischer Bibliothekenverbund",
	"creator":"Michael Berkowitz",
	"target":"http://meteor.bibvb.ac.at/F",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-03-19 16:00:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//td[@class="bar"]/a[@class="blue"]/img', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "book";
	} else if (doc.title.indexOf("Ergebnisliste") != -1) {
		return "multiple";
	}
}

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var itemRegexp = '^https?://[^/]+/F/[A-Z0-9\-]+\?.*(?:func=full-set-set.*\&format=999|func=direct)'
		var items = Zotero.Utilities.getItemArray(doc, doc, itemRegexp, '^[0-9]+$');
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		} 
	} else {
		arts = [url];
	}
	Zotero.Utilities.processDocuments(arts, function(newDoc) {
		var link = newDoc.evaluate('//td[@class="bar"]/a[@class="blue"][2]', newDoc, null, XPathResult.ANY_TYPE, null).iterateNext().href;
		link = link.replace(/full\-mail[^&]+&/, "full-mail&") + "&option_type=&format=777&encoding=UTF_TO_WEB_MAIL+++++&SUBJECT=&NAME=&EMAIL=&x=17&y=7";
		Zotero.Utilities.loadDocument([link], function(newDoc2) {
			var newest = newDoc2.evaluate('/html/body/p[@class="text3"]/a', newDoc2, null, XPathResult.ANY_TYPE, null).iterateNext().href;
			Zotero.Utilities.HTTP.doGet(newest, function(text) {
				var translator = Zotero.loadTranslator("import");
				translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
				translator.setString(text);
				translator.setHandler("itemDone", function(obj, item) {
					item.itemType = "book";
					item.complete();
				});
				translator.translate();
			});
		});
	}, function() {Zotero.done;});
	Zotero.wait();
}