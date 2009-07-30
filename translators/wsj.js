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
	"lastUpdated":"2008-07-29 19:40:00"
}

function detectWeb(doc, url){
	
	return "newspaperArticle"
	
}

function getDatum(text, key){
	Zotero.debug(key);
	var reg = new RegExp(key+":'(.*?)'(?=,|})");
	return unescape(Zotero.Utilities.unescapeHTML(reg.exec(text)[1].replace("+"," ", "g")));
}

function doWeb(doc, url){
	
	var namespace = doc.documentElement.namespaceURI;
	var nsResolver = namespace ? function(prefix) {
		if (prefix == 'x') return namespace; else return null;
	} : null;
	
	var text = doc.documentElement.innerHTML;
	var item = new Zotero.Item("newspaperArticle");
	var metadata = text.match(/AT_VARS=({[^}]*})/)[1];
	var authors = getDatum(text, "authors").split(',');
	for each (var aut in authors) {
		item.creators.push(Zotero.Utilities.cleanAuthor(aut, "author"));
	}
	item.publicationTitle = Zotero.Utilities.unescapeHTML(metadata.match(/publicationName:'([^'][^,]*)'/)[1]);
	item.date = getDatum(text, "publicationDate"); //Zotero.Utilities.unescapeHTML(metadata.match(/publicationDate:'([^']*[^,]*)'/)[1]); 
	item.abstractNote = getDatum(text, "bodyText"); //Zotero.Utilities.unescapeHTML(metadata.match(/bodyText:'([^']*[^,]*)'/)[1]).replace("+"," ", "g");
	item.title = getDatum(text, "articleHeadline").replace("\\",""); //Zotero.Utilities.unescapeHTML(metadata.match(/articleHeadline:'([^']*[^,]*)'/)[1]).replace("\\","");
	item.url = url;
	item.accessed = Date();
	item.section = getDatum(text, "articleType"); //Zotero.Utilities.unescapeHTML(metadata.match(/articleType:'([^']*[^,]*)'/)[1]).replace("+"," ", "g");
	item.complete();
	
}