{
	"translatorID":"8917b41c-8527-4ee7-b2dd-bcbc3fa5eabd",
	"translatorType":4,
	"label":"CiteULike",
	"creator":"Sean Takats",
	"target":"https?://(?:www\\.)?citeulike.org(?:.*/tag/[^/]*$|/search/|/journal/|/group/[0-9]+/library$|/\\?page=[0-9]+$|/.*article/[0-9]+$|/$)",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2008-02-01 19:30:00"
}

function detectWeb(doc, url){
	var articleRe = /\/article\/[0-9]+$/;
	var m = url.match(articleRe);
	var newUris = new Array();
	
	if (m){
		return "journalArticle";
	} else {
		return "multiple";
	}
}

function doWeb(doc, url){
	var articleRe = /\/article\/[0-9]+$/;
	var m = url.match(articleRe);
	var newUris = new Array();
	
	if (m){
		newUris.push(url.replace(/citeulike\.org\//, "citeulike.org/endnote/"));
	} else {
		var namespace = doc.documentElement.namespaceURI;
		var nsResolver = namespace ? function(prefix) {
			if (prefix == 'x') return namespace; else return null;
		} : null;
		var elmt;
		var elmts = doc.evaluate('//a[@class="title"]', doc, nsResolver, XPathResult.ANY_TYPE, null);
		var items = new Object();		
		while(elmt = elmts.iterateNext()) {
			items[elmt.href] = Zotero.Utilities.trimInternal(elmt.textContent);
		} 
		items = Zotero.selectItems(items);
		if(!items) return true;
		for(var uri in items) {
			newUris.push(uri.replace(/citeulike\.org\//, "citeulike.org/endnote/"));
		}
	}
	Zotero.Utilities.HTTP.doGet(newUris, function(text) {
		var translator = Zotero.loadTranslator("import");
		translator.setTranslator("32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7");
		translator.setString(text);
		translator.translate();
		Zotero.done();
	});
	Zotero.wait();
}