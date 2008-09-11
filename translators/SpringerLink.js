{
	"translatorID":"f8765470-5ace-4a31-b4bd-4327b960ccd",
	"translatorType":4,
	"label":"SpringerLink",
	"creator":"Simon Kornblith and Michael Berkowitz",
	"target":"https?://(www\\.)*springerlink\\.com|springerlink.metapress.com[^/]*/content/",
	"minVersion":"1.0.0b3.r1",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-04-12 18:40:00"
}

function detectWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	if((doc.title == "SpringerLink - All Search Results") || (doc.title == "SpringerLink - Journal Issue")) {
		return "multiple";
	} else if(doc.title == "SpringerLink - Book Chapter") {
		return "bookSection";
	} else if (doc.title == "SpringerLink - Book") {
		return "book";
	} else if (doc.title == "SpringerLink - Journal Article") {
		return "journalArticle";
	} else if(doc.evaluate('//a[text() = "RIS"]', doc, nsResolver, XPathResult.ANY_TYPE, null).iterateNext()) {
		return "journalArticle";
	}
}

function doWeb(doc, url) {
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var m = url.match(/https?:\/\/[^\/]+/);
	var host = m[0];
	
	if(detectWeb(doc, url) == "multiple") {
		var items = new Object();
		if (doc.title == "SpringerLink - Journal Issue") {
			var items = Zotero.Utilities.getItemArray(doc, doc.getElementsByTagName("table")[8], '/content/[^/]+/\\?p=[^&]+&pi=');
		} else {
			var results = doc.evaluate('//div[@class="listItemName"]/a', doc, nsResolver, XPathResult.ANY_TYPE, null);
			var result;
			while (result = results.iterateNext()) {
				items[result.href] = Zotero.Utilities.trimInternal(result.textContent);
			}
		}
		items = Zotero.selectItems(items);
		if(!items) return true;
		
		var urls = new Array();
		for(var url in items) {
			urls.push(url);
		}
	} else {
		var urls = [url];
	}
	
	var RIS = new Array();
	
	for each(var item in urls) {
		var m = item.match(/\/content\/([^/]+)/);
		RIS.push(host+"/export.mpx?code="+m[1]+"&mode=ris");
	}
	Zotero.Utilities.HTTP.doGet(RIS, function(text) {
		// load translator for RIS
		text = text.replace("CHAPTER", "CHAP");
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.setHandler("itemDone", function(obj, item) {
			var url = urls.shift();
			var m = url.match(/https?:\/\/[^\/]+\/content\/[^\/]+\/?/);
			item.attachments = [
				{url:url, title:"SpringerLink Snapshot", mimeType:"text/html"},
				{url:m[0]+"fulltext.pdf", title:"SpringerLink Full Text PDF", mimeType:"application/pdf"}
			];
			
			var oldCreators = item.creators;
			item.creators = new Array();
			for each (var creator in oldCreators) {
				if (creator['lastName'] + creator['firstName'] != "") {
					var fName = creator['firstName'] ? creator['firstName'] : "";
					item.creators.push({firstName:Zotero.Utilities.trimInternal(fName), lastName:creator['lastName'], creatorType:"author"});
				}
			}
			
			// fix incorrect chapters
			if(item.publicationTitle && item.itemType == "book") item.title = item.publicationTitle;
			
			// fix "V" in volume
			if(item.volume) {
				item.volume = item.volume.replace("V", "");
			}
			item.complete();
		});
		translator.translate();
	}, function() { Zotero.done() });
	Zotero.wait();
}