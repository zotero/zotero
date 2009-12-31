{
	"translatorID":"53f8d182-4edc-4eab-b5a1-141698a1303b",
	"translatorType":4,
	"label":"Wall Street Journal",
	"creator":"Matt Burton",
	"target":"http://online\\.wsj\\.com/article/",
	"minVersion":"1.0.0b4.r5",
	"maxVersion":"",
	"priority":100,
	"inRepository":true,
	"lastUpdated":"2009-12-10 00:45:00"
}

function detectWeb(doc, url){
	return "newspaperArticle";
}

function getDatum(text, key){
	var reg = new RegExp(key+":'(.*?)'(?=,|})");
	return unescape(Zotero.Utilities.unescapeHTML(reg.exec(text)[1].replace("+"," ", "g")));
}

function doWeb(doc, url){
	var text = doc.documentElement.innerHTML;
	var item = new Zotero.Item("newspaperArticle");
	var metadata = text.match(/AT_VARS=({[^}]*})/)[1];
	var authors = getDatum(text, "authors").split(',');
	for each (var aut in authors) {	
		if (aut.length > 0) {	
			item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
		}
	}
	item.publicationTitle = "wsj.com";
	item.date = getDatum(text, "publicationDate");
	item.abstractNote = getDatum(text, "bodyText");
	item.title = getDatum(text, "articleHeadline").replace("\\","");
	item.url = url;
	item.section = getDatum(text, "articleType");
	item.attachments.push({url:url, title:"Wall Street Journal Snapshot", mimeType:"text/html"});
	
	item.complete();
}