{
	"translatorID":"9346ddef-126b-47ec-afef-8809ed1972ab",
	"translatorType":4,
	"label":"Institute of Physics",
	"creator":"Michael Berkowitz",
	"target":"^http://www.iop.org/EJ/(toc|abstract|search|article)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":99,
	"inRepository":true,
	"lastUpdated":"2008-04-28 17:50:00"
}

function detectWeb(doc, url) {
	if ((doc.location.href.indexOf("toc") == -1) && (doc.location.href.indexOf("search") == -1)) {
		return "journalArticle";
	} else {
		return "multiple";
	}
}

function parseRIS(getURL, pdfURL) {   
    var newGet = getURL.replace(/EJ\/[^/]+/, "EJ/sview").replace(/\?.*$/, '') + "?format=refmgr&submit=1";
    Zotero.Utilities.HTTP.doGet(newGet, function(text){
        // load translator for RIS
        var translator = Zotero.loadTranslator ("import");
        translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
        translator.setString(text);
        translator.setHandler("itemDone", function(obj, item) { 
		item.url = getURL;
		item.attachments = [
	    		{url:item.url, title:"IOP Snapshot", mimeType:"text/html"}
	    	];
	    	if (pdfURL != null) {
		    	item.attachments.push({url:pdfURL, title:"IOP Full Text PDF", mimeType:"application/pdf"});
	    	}
	    	item.complete();
	});
	translator.translate();
        Zotero.done();
    }, function() {}); 
    Zotero.wait();
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == "x") return namespace; else return null;
	} : null;
	
	var arts = new Array();
	if (detectWeb(doc, url) == "multiple") {
		var items = new Object();
		var results = doc.evaluate('//td[*//td[*//a[contains(text(), "Abstract")]]]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var result;
		while (result = results.iterateNext()) {
			var title = doc.evaluate('.//strong', result, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
			var link = doc.evaluate('.//a[contains(text(), "Abstract")]', result, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
			var pdflink = doc.evaluate('.//a[contains(text(), "PDF")]', result, nsResolver, XPathResult.ANY_TYPE, null).iterateNext() ? doc.evaluate('.//a[contains(text(), "PDF")]', result, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href : null;
			var links = new Array(link, pdflink);
			items[links] = title;
		}
		items = Zotero.selectItems(items);
		for (var i in items) {
			arts.push(i);
		}
	} else {
		var pdfurl = doc.evaluate('//a[contains(text(), "PDF")]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().href;
		var links = url + ',' + pdfurl;
		arts = [links];
	}
	for each (var linkset in arts) {
		var urls = linkset.split(',');
		parseRIS(urls[0], urls[1]);
	}
}