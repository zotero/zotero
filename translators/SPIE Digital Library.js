{
	"translatorID":"48d3b115-7e09-4134-ad5d-0beda6296761",
	"translatorType":4,
	"label":"SPIE Digital Library",
	"creator":"Michael Berkowitz",
	"target":"http://(?:spiedl|spiedigitallibrary)\\.aip\\.org/",
	"minVersion":"1.0",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-08-06 17:00:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//table[@class="searchResultsTable"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else if (doc.evaluate('//div[@id="articletoolsdisplay"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	}
}

//http://spiedl.aip.org/getabs/servlet/GetCitation?fn=view_isi&source=scitation&PrefType=ARTICLE&PrefAction=Add+Selected&SelectCheck=JBOPFO000013000002024024000001&downloadcitation=+Go+

function doWeb(doc, url) {
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var results = doc.evaluate('//table[@class="searchResultsTable"]/tbody/tr', doc, null, XPathResult.ANY_TYPE, null);
		var result;
		while (result = results.iterateNext()) {
			var title = doc.evaluate('.//td[3]/a[1]', result, null, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var id = doc.evaluate('.//td[2]/input', result, null, XPathResult.ANY_TYPE, null).iterateNext().value;
			items[id] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		var id = doc.evaluate('//input[@name="SelectCheck"]', doc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
		arts = [id];
	}	
	
	var getstr1 = 'http://' + doc.location.host + '/getabs/servlet/GetCitation?fn=view_isi&source=scitation&PrefType=ARTICLE&PrefAction=Add+Selected&SelectCheck=';
	var getstr2 = '&downloadcitation=+Go+';
	for each (var id in arts) {
		var get = getstr1 + id + getstr2;
		Zotero.Utilities.HTTP.doGet(get, function(text) {
			Zotero.debug(text);
			var translator = Zotero.loadTranslator("import");
			translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
			translator.setString(text);
			translator.translate();
		});
	}
	
}