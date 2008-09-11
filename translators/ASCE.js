{
	"translatorID":"303bdfc5-11b8-4107-bca1-63ca97701a0f",
	"translatorType":4,
	"label":"ASCE",
	"creator":"Michael Berkowitz",
	"target":"^http://ascelibrary.aip.org/.+",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2007-09-06 19:30:00"
}

function detectWeb(doc, url) {
	if (doc.evaluate('//div[@id="sr-content-wrap"]//div[@class="sr-right"]/p[@class="sr-art-title"]/a', doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "multiple";
	} else {
		return "journalArticle";
	}
}

function getRIS(doc, url) {
	var newx = '//div[@id="sci-art-options-box"]//input[@name="SelectCheck"]';
	var key = doc.evaluate(newx, doc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
	Zotero.debug(key);
	var citation = 'http://ascelibrary.aip.org/getabs/servlet/GetCitation?source=scitation&PrefType=ARTICLE&PrefAction=Add+Selected&SelectCheck=' + key + '&fn=open_refworks&downloadcitation=+Go+';
	Zotero.Utilities.HTTP.doGet(citation, function(text) {
		var translator = Zotero.loadTranslator("import");
		text = text.replace(/RT/, "TY");
		text = text.replace(/VO/, "VL");
		text = text.replace(/LK/, "UR");
		text = text.replace(/YR/, "PY");
		Zotero.debug(text);
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text.replace(/([A-Z][A-Z\d]\s)/g, "$1 - "));
		translator.setHandler("itemDone", function(obj, item) {
			item.attachments = [
				{url:item.url, title:"ASCE Snapshot", mimeType:"text/html"},
				{url:"http://ascelibrary.aip.org/getpdf/servlet/GetPDFServlet?filetype=pdf&id=" + key + "&idtype=cvips&prog=search", title:"EAS Full Text PDF", mimeType:"application/pdf"}
			];
			//item.itemType = "journalArticle";
			item.complete();
		});
		translator.translate();
		Zotero.wait();
		Zotero.done();
	});
}

function doWeb(doc, url) {
	var articles = new Array();
	var items = new Object();
	var xpath = '//div[@class="sr-right"]/p[@class="sr-art-title"]/a';
	if (doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null).iterateNext()) {
		var titles = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null);
		while (new_title = titles.iterateNext()) {
			items[new_title.href] = new_title.textContent;
		}
		
		items = Zotero.selectItems(items);
		
		for (var i in items) {
			articles.push(i)
		}
	} else {
		var newx = '//div[@id="sci-art-options-box"]//input[@name="SelectCheck"]';
		var stuff = doc.evaluate(newx, doc, null, XPathResult.ANY_TYPE, null).iterateNext().value;
		Zotero.debug(stuff);
		articles.push(url);
	}

	Zotero.debug(articles);
	Zotero.Utilities.processDocuments(articles, getRIS, function() {Zotero.done});
	Zotero.wait();

}
